// Rollback apply tests (Story 3.14, all 5 ACs). Uses in-memory
// KeyValueStore + BlobStore + ApplyFsProbe + injected clock + FakeJournal.
// Covers: apply-only-conflict-free (AC #1); durable events before/after
// mutation (AC #2); revalidation before apply (AC #3); aggregate result
// full/partial/blocked (AC #4); new checkpoint for rollback (AC #5).
// >=22 cases. No network/real creds.

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { CheckpointRepository } from '../src/core/checkpoints/checkpointRepository.js';
import { ArtifactStore } from '../src/core/checkpoints/artifactStore.js';
import type { KeyValueStore, BlobStore } from '../src/core/checkpoints/types.js';
import { asCheckpointId, asArtifactId } from '../src/core/checkpoints/types.js';
import { newOperationId } from '../src/core/protocol/ids.js';
import { applyRollback } from '../src/core/rollback/apply.js';
import type {
  ApplyContext,
  ApplyFsProbe,
  RollbackTarget,
  RollbackApplyResult,
  ApplyTargetOutcome,
  DurableEvent,
  WorkspaceIdentity,
} from '../src/core/rollback/types.js';

// --- Helpers ---

function computeDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function fixedClock(): () => string {
  let t = 0;
  return () => {
    t += 1;
    return `2026-07-17T00:00:00.${String(t).padStart(3, '0')}Z`;
  };
}

// --- In-memory KeyValueStore ---

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  get(key: string): string | undefined {
    return this.data.get(key);
  }

  put(key: string, value: string): void {
    this.data.set(key, value);
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  list(prefix: string): string[] {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix));
  }
}

// --- In-memory BlobStore ---

class InMemoryBlobStore implements BlobStore {
  private readonly data = new Map<string, Uint8Array>();

  get(key: string): Uint8Array | undefined {
    return this.data.get(key);
  }

  put(key: string, value: Uint8Array): void {
    this.data.set(key, value);
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  list(prefix: string): string[] {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix));
  }
}

// --- FakeJournal ---

class FakeJournal {
  readonly events: unknown[] = [];

  append(event: DurableEvent): number {
    this.events.push(event);
    return this.events.length;
  }
}

// --- In-memory ApplyFsProbe ---

class InMemoryApplyFsProbe implements ApplyFsProbe {
  readonly files = new Map<string, Uint8Array>();
  readonly symlinks = new Map<string, string>();
  readonly inaccessible = new Set<string>();
  readonly openHandles = new Set<string>();
  readonly realPaths = new Map<string, string>();
  readonly deletedFiles = new Set<string>();
  readonly writtenFiles = new Map<string, Uint8Array>();
  readonly createdDirs = new Set<string>();

  addFile(path: string, content: Uint8Array): void {
    this.files.set(path, content);
    this.realPaths.set(path, path);
  }

  removeFile(path: string): void {
    this.files.delete(path);
    this.realPaths.delete(path);
  }

  addSymlink(path: string, target: string): void {
    this.symlinks.set(path, target);
    this.realPaths.set(path, target);
  }

  setInaccessible(path: string): void {
    this.inaccessible.add(path);
  }

  setOpenHandles(path: string): void {
    this.openHandles.add(path);
  }

  setRealPath(path: string, realPath: string): void {
    this.realPaths.set(path, realPath);
  }

  readFile(path: string): Uint8Array {
    const content = this.files.get(path);
    if (!content) throw new Error(`ENOENT: ${path}`);
    return content;
  }

  writeFile(path: string, content: Uint8Array): void {
    this.files.set(path, content);
    this.writtenFiles.set(path, content);
  }

  deleteFile(path: string): void {
    this.files.delete(path);
    this.deletedFiles.add(path);
  }

  lstat(path: string) {
    const isSymlink = this.symlinks.has(path);
    const content = this.files.get(path);
    if (content === undefined && !isSymlink) {
      throw new Error(`ENOENT: ${path}`);
    }
    return {
      dev: 0,
      ino: 0,
      size: content?.length ?? 0,
      isDirectory: false,
      isFile: !isSymlink && content !== undefined,
      isSymbolicLink: isSymlink,
    };
  }

  realpath(path: string): string {
    const rp = this.realPaths.get(path);
    if (rp) return rp;
    if (this.files.has(path)) return path;
    throw new Error(`ENOENT: ${path}`);
  }

  stat(path: string) {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return {
      dev: 0,
      ino: 0,
      size: content.length,
      isDirectory: false,
      isFile: true,
    };
  }

  isAccessible(path: string): boolean {
    return !this.inaccessible.has(path);
  }

  hasOpenHandles(path: string): boolean {
    return this.openHandles.has(path);
  }

  mkdir(dir: string): void {
    this.createdDirs.add(dir);
  }
}

// --- Test helpers ---

function makeWorkspaceIdentity(): WorkspaceIdentity {
  return {
    workspaceId: 'ws-test',
    canonicalRoot: '/workspace',
    displayRoot: '/workspace',
    platform: { platform: 'darwin', arch: 'arm64', release: '24.0.0' },
    volume: { deviceId: 'dev-1', filesystem: 'apfs', mountPoint: '/' },
    bindingStatus: 'bound',
    casePolicy: 'case-sensitive',
    unicodePolicy: 'nfc',
  };
}

function makeContext(
  kvStore: KeyValueStore,
  blobStore?: BlobStore,
  encKey?: Buffer,
  journal?: FakeJournal,
): ApplyContext {
  const clock = fixedClock();
  const checkpointRepo = new CheckpointRepository(kvStore, clock);
  const artifactStore = blobStore && encKey ? new ArtifactStore(blobStore, encKey) : undefined;
  return {
    fsProbe: new InMemoryApplyFsProbe(),
    checkpointRepo,
    artifactStore,
    journal: journal ?? { append: () => 0 },
    sessionId: 'sess-test',
    activationId: 'act-1',
    activationRevision: 1,
    authorityRevision: 1,
    workspace: makeWorkspaceIdentity(),
    clock,
  };
}

function makeEditTarget(
  path: string,
  preImageContent: Uint8Array,
  postImageContent: Uint8Array,
): RollbackTarget {
  return {
    canonicalPath: path,
    displayPath: path,
    preImageDigest: computeDigest(preImageContent),
    postImageDigest: computeDigest(postImageContent),
    isBinary: false,
    artifactId: null,
    effectKind: 'edit_file',
  };
}

function makeCreateTarget(path: string, content: Uint8Array): RollbackTarget {
  return {
    canonicalPath: path,
    displayPath: path,
    preImageDigest: null,
    postImageDigest: computeDigest(content),
    isBinary: false,
    artifactId: null,
    effectKind: 'create_file',
  };
}

function makeDeleteTarget(
  path: string,
  preImageContent: Uint8Array,
): RollbackTarget {
  return {
    canonicalPath: path,
    displayPath: path,
    preImageDigest: computeDigest(preImageContent),
    postImageDigest: null,
    isBinary: false,
    artifactId: null,
    effectKind: 'delete_file',
  };
}

function makeBinaryTarget(
  path: string,
  preImageContent: Uint8Array,
  artifactId: string,
): RollbackTarget {
  return {
    canonicalPath: path,
    displayPath: path,
    preImageDigest: computeDigest(preImageContent),
    postImageDigest: null,
    isBinary: true,
    artifactId,
    effectKind: 'delete_file',
  };
}

function stagePreImageArtifact(
  artifactStore: ArtifactStore,
  content: Uint8Array,
): string {
  const stageResult = artifactStore.stage({
    bytes: content,
    contentClass: 'file-content',
  });
  if (!stageResult.ok) throw new Error('failed to stage artifact');
  artifactStore.commit(stageResult.artifactId);
  return stageResult.artifactId;
}

function stageCheckpoint(
  kvStore: KeyValueStore,
  clock: () => string,
): string {
  const repo = new CheckpointRepository(kvStore, clock);
  const stageResult = repo.stage({
    operationId: newOperationId(),
    aggregateVersion: 1,
    artifactIds: [],
    coverageState: 'fully-protected',
  });
  if (!stageResult.ok) throw new Error('failed to stage checkpoint');
  const commitResult = repo.commit(stageResult.checkpointId, newOperationId());
  if (!commitResult.ok) throw new Error('failed to commit checkpoint');
  return stageResult.checkpointId;
}

// --- Tests ---

describe('Story 3.14: Apply conflict-free rollback targets', () => {
  // AC #1: applies ONLY analyzed, conflict-free inverse changes so rollback
  // changes exactly the eligible built-in file state and leaves unrelated
  // work untouched. Excluded effects (shell, process, remote, permission,
  // symlink-side, external) are NEVER claimed reversible (AD-19).

  describe('AC #1: apply only conflict-free inverse changes', () => {
    it('applies edit_file inverse (restore pre-image) when current matches post-image', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3, 4]);
      const postImage = new Uint8Array([5, 6, 7, 8]);
      fsProbe.addFile('/workspace/file.txt', postImage);

      // Stage pre-image in artifact store for restore.
      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage);

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      // Override artifactId to point to the staged pre-image.
      const targetWithArtifact: RollbackTarget = { ...target, artifactId };

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal: { append: () => 0 },
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [targetWithArtifact], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('full');
      expect(result.result.appliedCount).toBe(1);
      expect(result.result.perTarget[0].kind).toBe('applied');
      // Verify the file was restored to pre-image.
      const restored = fsProbe.readFile('/workspace/file.txt');
      expect(restored).toEqual(preImage);
    });

    it('applies create_file inverse (delete) when file exists', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const content = new Uint8Array([1, 2, 3]);
      fsProbe.addFile('/workspace/new.txt', content);

      const target = makeCreateTarget('/workspace/new.txt', content);
      const ctx = makeContext(kvStore);
      ctx.fsProbe = fsProbe;

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('full');
      expect(result.result.appliedCount).toBe(1);
      // Verify the file was deleted.
      expect(fsProbe.deletedFiles.has('/workspace/new.txt')).toBe(true);
      expect(fsProbe.files.has('/workspace/new.txt')).toBe(false);
    });

    it('applies delete_file inverse (restore pre-image) when file is absent', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([10, 20, 30]);
      // File was deleted — not present on filesystem.

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage);

      const target = makeDeleteTarget('/workspace/deleted.txt', preImage);
      const targetWithArtifact: RollbackTarget = { ...target, artifactId };

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal: { append: () => 0 },
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [targetWithArtifact], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('full');
      expect(result.result.appliedCount).toBe(1);
      // Verify the file was restored.
      const restored = fsProbe.readFile('/workspace/deleted.txt');
      expect(restored).toEqual(preImage);
    });

    it('excluded effects (shell, process, remote, etc.) are never claimed reversible', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const ctx = makeContext(kvStore);

      // Only built-in effects are passed; excluded effects are reported in result.
      const result = applyRollback(checkpointId, [], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('blocked');
      expect(result.result.excludedEffects.shell.length).toBeGreaterThan(0);
      expect(result.result.excludedEffects.process.length).toBeGreaterThan(0);
      expect(result.result.excludedEffects.remote.length).toBeGreaterThan(0);
      expect(result.result.excludedEffects.permission.length).toBeGreaterThan(0);
      expect(result.result.excludedEffects.symlinkSide.length).toBeGreaterThan(0);
      expect(result.result.excludedEffects.external.length).toBeGreaterThan(0);
      expect(result.result.excludedEffects.unknown.length).toBeGreaterThan(0);
    });

    it('leaves unrelated files untouched when applying rollback', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/target.txt', postImage);
      // Unrelated file.
      const unrelatedContent = new Uint8Array([99, 100, 101]);
      fsProbe.addFile('/workspace/unrelated.txt', unrelatedContent);

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage);

      const target = makeEditTarget('/workspace/target.txt', preImage, postImage);
      const targetWithArtifact: RollbackTarget = { ...target, artifactId };

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal: { append: () => 0 },
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [targetWithArtifact], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('full');
      // Unrelated file should be unchanged.
      const unrelated = fsProbe.readFile('/workspace/unrelated.txt');
      expect(unrelated).toEqual(unrelatedContent);
    });
  });

  // AC #2: each applied target produces a durable EffectDispatchCommitted event
  // BEFORE the native mutation, and a durable OperationSucceeded event AFTER
  // the mutation. The journal is the sole commit-visibility authority.

  describe('AC #2: durable events before/after mutation', () => {
    it('produces EffectDispatchCommitted before mutation and OperationSucceeded after', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file.txt', postImage);
      const journal = new FakeJournal();

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage);

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const targetWithArtifact: RollbackTarget = { ...target, artifactId };

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal,
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [targetWithArtifact], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('full');

      // Should have at least 2 events: EffectDispatchCommitted + OperationSucceeded.
      const dispatchEvents = journal.events.filter(
        (e: unknown) => (e as { payload?: { kind?: string } }).payload?.kind === 'EffectDispatchCommitted',
      );
      const successEvents = journal.events.filter(
        (e: unknown) => (e as { payload?: { kind?: string } }).payload?.kind === 'OperationSucceeded',
      );
      expect(dispatchEvents.length).toBe(1);
      expect(successEvents.length).toBe(1);
    });

    it('produces OperationFailed for a target that could not be applied', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const postImage = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file.txt', postImage);
      // No pre-image in artifact store — will fail.
      const journal = new FakeJournal();

      const target = makeEditTarget('/workspace/file.txt', new Uint8Array([1, 2, 3]), postImage);

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore: undefined,
        journal,
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Should have OperationFailed events.
      const failEvents = journal.events.filter(
        (e: unknown) => (e as { payload?: { kind?: string } }).payload?.kind === 'OperationFailed',
      );
      expect(failEvents.length).toBeGreaterThan(0);
    });

    it('journal events are ordered: dispatch-committed before mutation, succeeded after', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file.txt', postImage);
      const journal = new FakeJournal();

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage);

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const targetWithArtifact: RollbackTarget = { ...target, artifactId };

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal,
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [targetWithArtifact], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Find the first dispatch and first success event indices.
      const dispatchIdx = journal.events.findIndex(
        (e: unknown) => (e as { payload?: { kind?: string } }).payload?.kind === 'EffectDispatchCommitted',
      );
      const successIdx = journal.events.findIndex(
        (e: unknown) => (e as { payload?: { kind?: string } }).payload?.kind === 'OperationSucceeded',
      );
      expect(dispatchIdx).toBeLessThan(successIdx);
    });
  });

  // AC #3: each target is revalidated immediately before apply — if the
  // current state has changed since analysis (concurrent writer, rename,
  // deletion, re-creation), the apply is refused for that target. No stale
  // inverse is applied.

  describe('AC #3: revalidation before apply', () => {
    it('refuses apply when current content differs from post-image (concurrent writer)', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      // Current content differs from post-image.
      const currentContent = new Uint8Array([7, 8, 9]);
      fsProbe.addFile('/workspace/file.txt', currentContent);

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const ctx = makeContext(kvStore);
      ctx.fsProbe = fsProbe;

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('blocked');
      expect(result.result.conflictCount).toBe(1);
      expect(result.result.perTarget[0].kind).toBe('conflict');
      if (result.result.perTarget[0].kind === 'conflict') {
        expect(result.result.perTarget[0].reasonCode).toBe('content-conflict');
      }
    });

    it('refuses apply when target was deleted after analysis', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      // File was created (post-image present) but is now absent.
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const ctx = makeContext(kvStore);
      ctx.fsProbe = fsProbe;

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.conflictCount).toBe(1);
      expect(result.result.perTarget[0].kind).toBe('conflict');
    });

    it('refuses apply when target was recreated after deletion', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      // File was deleted (post-image absent) but is now present.
      const preImage = new Uint8Array([1, 2, 3]);
      fsProbe.addFile('/workspace/file.txt', new Uint8Array([99, 100]));

      const target = makeDeleteTarget('/workspace/file.txt', preImage);
      const ctx = makeContext(kvStore);
      ctx.fsProbe = fsProbe;

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.conflictCount).toBe(1);
      expect(result.result.perTarget[0].kind).toBe('conflict');
    });

    it('refuses apply when target identity changed (symlink)', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      // Target is behind a symlink.
      fsProbe.addFile('/workspace/real.txt', postImage);
      fsProbe.addSymlink('/workspace/file.txt', '/workspace/real.txt');

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const ctx = makeContext(kvStore);
      ctx.fsProbe = fsProbe;

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.conflictCount).toBe(1);
      expect(result.result.perTarget[0].kind).toBe('conflict');
    });

    it('refuses apply when target is inaccessible', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file.txt', postImage);
      fsProbe.setInaccessible('/workspace/file.txt');

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const ctx = makeContext(kvStore);
      ctx.fsProbe = fsProbe;

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.inaccessibleCount).toBe(1);
      expect(result.result.perTarget[0].kind).toBe('inaccessible');
    });

    it('refuses apply when target has open handles (concurrency uncertain)', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file.txt', postImage);
      fsProbe.setOpenHandles('/workspace/file.txt');

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const ctx = makeContext(kvStore);
      ctx.fsProbe = fsProbe;

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.unknownCount).toBe(1);
      expect(result.result.perTarget[0].kind).toBe('unknown-outcome');
    });

    it('applies eligible targets and refuses stale ones in the same batch', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const journal = new FakeJournal();

      // Target 1: eligible (current matches post-image).
      const preImage1 = new Uint8Array([1, 2, 3]);
      const postImage1 = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file1.txt', postImage1);

      // Target 2: stale (current differs from post-image).
      const preImage2 = new Uint8Array([10, 20, 30]);
      const postImage2 = new Uint8Array([40, 50, 60]);
      fsProbe.addFile('/workspace/file2.txt', new Uint8Array([70, 80, 90]));

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage1);

      const target1 = makeEditTarget('/workspace/file1.txt', preImage1, postImage1);
      const target1WithArtifact: RollbackTarget = { ...target1, artifactId };
      const target2 = makeEditTarget('/workspace/file2.txt', preImage2, postImage2);

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal,
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [target1WithArtifact, target2], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('partial');
      expect(result.result.appliedCount).toBe(1);
      expect(result.result.conflictCount).toBe(1);
    });
  });

  // AC #4: the aggregate result is one of `full` (all targets applied),
  // `partial` (some applied, some had issues), or `blocked` (none applied).
  // Residual conflicts are reported so the user can choose next steps.

  describe('AC #4: aggregate result full/partial/blocked', () => {
    it('returns full when all targets are applied', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file.txt', postImage);

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage);

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const targetWithArtifact: RollbackTarget = { ...target, artifactId };

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal: { append: () => 0 },
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [targetWithArtifact], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('full');
      expect(result.result.appliedCount).toBe(1);
    });

    it('returns partial when some targets are applied and some have issues', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage1 = new Uint8Array([1, 2, 3]);
      const postImage1 = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file1.txt', postImage1);
      // Second file has different content.
      fsProbe.addFile('/workspace/file2.txt', new Uint8Array([99, 100]));

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage1);

      const target1 = makeEditTarget('/workspace/file1.txt', preImage1, postImage1);
      const target1WithArtifact: RollbackTarget = { ...target1, artifactId };
      const target2 = makeEditTarget('/workspace/file2.txt', new Uint8Array([10, 20, 30]), new Uint8Array([40, 50, 60]));

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal: { append: () => 0 },
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [target1WithArtifact, target2], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('partial');
      expect(result.result.appliedCount).toBe(1);
      expect(result.result.conflictCount).toBe(1);
    });

    it('returns blocked when no targets can be applied', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      // Both files have different content.
      fsProbe.addFile('/workspace/file1.txt', new Uint8Array([99, 100]));
      fsProbe.addFile('/workspace/file2.txt', new Uint8Array([101, 102]));

      const target1 = makeEditTarget('/workspace/file1.txt', new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6]));
      const target2 = makeEditTarget('/workspace/file2.txt', new Uint8Array([10, 20, 30]), new Uint8Array([40, 50, 60]));

      const ctx = makeContext(kvStore);
      ctx.fsProbe = fsProbe;

      const result = applyRollback(checkpointId, [target1, target2], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('blocked');
      expect(result.result.appliedCount).toBe(0);
    });

    it('reports residual conflicts with safe choices', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      fsProbe.addFile('/workspace/file.txt', new Uint8Array([99, 100]));

      const target = makeEditTarget('/workspace/file.txt', new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6]));
      const ctx = makeContext(kvStore);
      ctx.fsProbe = fsProbe;

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.residualConflicts.length).toBe(1);
      expect(result.result.residualConflicts[0].safeChoices.length).toBeGreaterThan(0);
      // Verify safe choices don't include overwrite/continue/blind-retry.
      const choiceKinds = result.result.residualConflicts[0].safeChoices.map((c) => c.kind);
      expect(choiceKinds).not.toContain('overwrite');
      expect(choiceKinds).not.toContain('continue');
      expect(choiceKinds).toContain('skip-target');
      expect(choiceKinds).toContain('export-sanitized-patch');
      expect(choiceKinds).toContain('user-authored-resolution');
    });
  });

  // AC #5: a new checkpoint is created for the rollback operation itself, so
  // the rollback can itself be rolled back. The checkpoint reference is
  // included in the result.

  describe('AC #5: new checkpoint for rollback', () => {
    it('creates a new checkpoint for the rollback operation', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file.txt', postImage);

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage);

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const targetWithArtifact: RollbackTarget = { ...target, artifactId };

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal: { append: () => 0 },
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [targetWithArtifact], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.checkpointCreated).toBe(true);
      expect(result.result.checkpointIdAfter).toBeDefined();
      // Verify the new checkpoint exists in the store.
      const repo = new CheckpointRepository(kvStore, clock);
      const readResult = repo.read(asCheckpointId(result.result.checkpointIdAfter!));
      expect(readResult.ok).toBe(true);
    });

    it('the new checkpoint can be read and is committed', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file.txt', postImage);

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage);

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const targetWithArtifact: RollbackTarget = { ...target, artifactId };

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal: { append: () => 0 },
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [targetWithArtifact], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const repo = new CheckpointRepository(kvStore, clock);
      const readResult = repo.read(asCheckpointId(result.result.checkpointIdAfter!));
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.record.stageState).toBe('committed');
    });
  });

  // --- Edge cases ---

  describe('Edge cases', () => {
    it('handles checkpoint-not-found failure', () => {
      const kvStore = new InMemoryKeyValueStore();
      const ctx = makeContext(kvStore);

      const result = applyRollback('nonexistent-checkpoint', [], ctx);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.category).toBe('checkpoint-unreadable');
    });

    it('handles empty targets list', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const ctx = makeContext(kvStore);

      const result = applyRollback(checkpointId, [], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('blocked');
      expect(result.result.appliedCount).toBe(0);
    });

    it('handles binary file restore from artifact store', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([0xFF, 0xFE, 0xFD, 0xFC]);
      // File was deleted — not present.

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage);

      const target = makeBinaryTarget('/workspace/binary.bin', preImage, artifactId);

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal: { append: () => 0 },
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('full');
      expect(result.result.appliedCount).toBe(1);
      // Verify binary content was restored.
      const restored = fsProbe.readFile('/workspace/binary.bin');
      expect(restored).toEqual(preImage);
    });

    it('handles create_file inverse when file was already deleted', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      // File was created but is now already deleted — inverse is delete,
      // and the file is already gone.

      const content = new Uint8Array([1, 2, 3]);
      const target = makeCreateTarget('/workspace/gone.txt', content);
      const ctx = makeContext(kvStore);
      ctx.fsProbe = fsProbe;

      const result = applyRollback(checkpointId, [target], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('full');
      expect(result.result.appliedCount).toBe(1);
    });

    it('per-target outcomes include correct inverse operation metadata', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const preImage = new Uint8Array([1, 2, 3]);
      const postImage = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/file.txt', postImage);

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage);

      const target = makeEditTarget('/workspace/file.txt', preImage, postImage);
      const targetWithArtifact: RollbackTarget = { ...target, artifactId };

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal: { append: () => 0 },
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [targetWithArtifact], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const outcome = result.result.perTarget[0];
      expect(outcome.kind).toBe('applied');
      if (outcome.kind === 'applied') {
        expect(outcome.inverseOperation.kind).toBe('restore-pre-image');
        expect(outcome.preImageDigest).toBe(computeDigest(preImage));
        expect(outcome.postImageDigest).toBe(computeDigest(postImage));
      }
    });

    it('handles multiple targets of different effect kinds', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const checkpointId = stageCheckpoint(kvStore, clock);
      const fsProbe = new InMemoryApplyFsProbe();
      const journal = new FakeJournal();

      // Target 1: edit_file — restore pre-image.
      const preImage1 = new Uint8Array([1, 2, 3]);
      const postImage1 = new Uint8Array([4, 5, 6]);
      fsProbe.addFile('/workspace/edit.txt', postImage1);

      // Target 2: create_file — delete.
      const createContent = new Uint8Array([7, 8, 9]);
      fsProbe.addFile('/workspace/created.txt', createContent);

      const blobStore = new InMemoryBlobStore();
      const encKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const artifactId = stagePreImageArtifact(artifactStore, preImage1);

      const target1 = makeEditTarget('/workspace/edit.txt', preImage1, postImage1);
      const target1WithArtifact: RollbackTarget = { ...target1, artifactId };
      const target2 = makeCreateTarget('/workspace/created.txt', createContent);

      const ctx: ApplyContext = {
        fsProbe,
        checkpointRepo: new CheckpointRepository(kvStore, clock),
        artifactStore,
        journal,
        sessionId: 'sess-test',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
        workspace: makeWorkspaceIdentity(),
        clock,
      };

      const result = applyRollback(checkpointId, [target1WithArtifact, target2], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.aggregate).toBe('full');
      expect(result.result.appliedCount).toBe(2);

      // Verify edit was restored.
      const restored = fsProbe.readFile('/workspace/edit.txt');
      expect(restored).toEqual(preImage1);

      // Verify create was deleted.
      expect(fsProbe.files.has('/workspace/created.txt')).toBe(false);
    });

    it('handles checkpoint-unreadable failure', () => {
      const kvStore = new InMemoryKeyValueStore();
      const ctx = makeContext(kvStore);
      // Store a corrupt record.
      kvStore.put('checkpoint:record:corrupt-id', '{invalid json');

      const result = applyRollback('corrupt-id', [], ctx);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.category).toBe('checkpoint-unreadable');
    });
  });
});
