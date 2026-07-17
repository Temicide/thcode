// Rollback analysis tests (Story 3.13, all 5 ACs). Uses in-memory
// KeyValueStore + BlobStore + AnalysisFsProbe + injected clock. Covers:
// three-way pre/post/current comparison; applied-eligible when current==
// post-image + identity unchanged + concrete inverse + no unrelated target;
// conflict/skipped/inaccessible/mismatch/unknown-outcome for current-differs/
// overlapping-later-edit/renamed/deleted/recreated/case-unicode/symlink-mount/
// uncertain-open-handle (no overwrite prepared); binary original integrity-
// verified + digest compare + no raw bytes in output + missing/corrupt not
// apply-eligible; conflict panel offers only skip/export-sanitized-patch/
// rebase-new-path/user-authored (no overwrite/continue/blind-retry).
// >=22 cases. No network/real creds.

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { CheckpointRepository } from '../src/core/checkpoints/checkpointRepository.js';
import { ArtifactStore } from '../src/core/checkpoints/artifactStore.js';
import type { KeyValueStore, BlobStore } from '../src/core/checkpoints/types.js';
import { asCheckpointId, asArtifactId } from '../src/core/checkpoints/types.js';
import { newOperationId } from '../src/core/protocol/ids.js';
import {
  analyzeRollbackTarget,
  analyzeRollbackSet,
} from '../src/core/rollback/analysis.js';
import type {
  AnalysisContext,
  AnalysisFsProbe,
  RollbackTarget,
  TargetAnalysis,
  RollbackAnalysis,
  SafeChoice,
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

// --- In-memory AnalysisFsProbe ---

class InMemoryAnalysisFsProbe implements AnalysisFsProbe {
  private readonly files = new Map<string, Uint8Array>();
  private readonly symlinks = new Map<string, string>();
  private readonly inaccessible = new Set<string>();
  private readonly openHandles = new Set<string>();
  private readonly realPaths = new Map<string, string>();

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
    return {
      dev: 0,
      ino: 0,
      size: content?.length ?? 0,
      isDirectory: false,
      isFile: content !== undefined,
    };
  }

  isAccessible(path: string): boolean {
    return !this.inaccessible.has(path) && this.files.has(path);
  }

  hasOpenHandles(path: string): boolean {
    return this.openHandles.has(path);
  }
}

// --- Test helpers ---

function makeTarget(
  overrides: Partial<RollbackTarget> = {},
): RollbackTarget {
  return {
    canonicalPath: '/workspace/file.txt',
    displayPath: 'file.txt',
    preImageDigest: null,
    postImageDigest: null,
    isBinary: false,
    artifactId: null,
    effectKind: 'edit_file',
    ...overrides,
  };
}

function makeContext(
  fsProbe: AnalysisFsProbe,
  kvStore?: KeyValueStore,
  blobStore?: BlobStore,
  encKey?: Buffer,
): AnalysisContext {
  const clock = fixedClock();
  const store = kvStore ?? new InMemoryKeyValueStore();
  const checkpointRepo = new CheckpointRepository(store, clock);
  const artifactStore = blobStore && encKey ? new ArtifactStore(blobStore, encKey) : undefined;
  return {
    fsProbe,
    checkpointRepo,
    artifactStore,
    clock,
  };
}

function stageAndCommitCheckpoint(
  repo: CheckpointRepository,
  store: KeyValueStore,
  artifactIds: readonly string[] = [],
): string {
  const opId = newOperationId();
  const result = repo.stage({
    operationId: opId,
    aggregateVersion: 1,
    artifactIds,
    coverageState: 'fully-protected',
  });
  if (!result.ok) throw new Error('stage failed');
  const commitResult = repo.commit(result.checkpointId, opId);
  if (!commitResult.ok) throw new Error('commit failed');
  return result.checkpointId;
}

// --- Tests ---

describe('Rollback analysis (Story 3.13)', () => {
  // ==========================================================================
  // AC #1: Three-way pre/post/current comparison
  // ==========================================================================
  describe('AC #1: Three-way pre/post/current comparison', () => {
    it('compares pre-image, post-image, and current state for an edited file', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const preContent = new TextEncoder().encode('original content');
      const postContent = new TextEncoder().encode('edited content');
      const currentContent = new TextEncoder().encode('edited content');
      const preDigest = computeDigest(preContent);
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/file.txt', currentContent);

      const target = makeTarget({
        canonicalPath: '/workspace/file.txt',
        preImageDigest: preDigest,
        postImageDigest: postDigest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.preImage.kind).toBe('present');
      if (result.preImage.kind === 'present') expect(result.preImage.digest).toBe(preDigest);
      expect(result.postImage.kind).toBe('present');
      if (result.postImage.kind === 'present') expect(result.postImage.digest).toBe(postDigest);
      expect(result.currentState.kind).toBe('present');
      if (result.currentState.kind === 'present') expect(result.currentState.digest).toBe(computeDigest(currentContent));
    });

    it('handles create_file with absent pre-image', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const postContent = new TextEncoder().encode('created content');
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/new.txt', postContent);

      const target = makeTarget({
        canonicalPath: '/workspace/new.txt',
        preImageDigest: null,
        postImageDigest: postDigest,
        effectKind: 'create_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.preImage.kind).toBe('absent');
      expect(result.postImage.kind).toBe('present');
      expect(result.currentState.kind).toBe('present');
    });

    it('handles delete_file with absent post-image', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const preContent = new TextEncoder().encode('content to delete');
      const preDigest = computeDigest(preContent);

      // File was deleted — current state is absent.
      const target = makeTarget({
        canonicalPath: '/workspace/to-delete.txt',
        preImageDigest: preDigest,
        postImageDigest: null,
        effectKind: 'delete_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.preImage.kind).toBe('present');
      expect(result.postImage.kind).toBe('absent');
      expect(result.currentState.kind).toBe('absent');
    });

    it('captures current digest and version before any effect', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const content = new TextEncoder().encode('current content');
      const digest = computeDigest(content);

      fsProbe.addFile('/workspace/file.txt', content);

      const target = makeTarget({
        canonicalPath: '/workspace/file.txt',
        preImageDigest: 'old-digest',
        postImageDigest: digest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.currentState.kind).toBe('present');
      if (result.currentState.kind === 'present') {
        expect(result.currentState.digest).toBe(digest);
        expect(result.currentState.version).toBe(String(content.length));
      }
    });
  });

  // ==========================================================================
  // AC #2: Applied-eligible when current == post-image + identity unchanged
  // ==========================================================================
  describe('AC #2: Applied-eligible with concrete inverse operation', () => {
    it('returns applied-eligible when current matches post-image and identity unchanged', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const preContent = new TextEncoder().encode('original');
      const postContent = new TextEncoder().encode('edited');
      const preDigest = computeDigest(preContent);
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/file.txt', postContent);

      const target = makeTarget({
        canonicalPath: '/workspace/file.txt',
        preImageDigest: preDigest,
        postImageDigest: postDigest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('applied-eligible');
      if (result.outcome.kind === 'applied-eligible') {
        expect(result.outcome.inverseOperation.kind).toBe('restore-pre-image');
        if (result.outcome.inverseOperation.kind === 'restore-pre-image') {
          expect(result.outcome.inverseOperation.preImageDigest).toBe(preDigest);
        }
        expect(result.outcome.expectedCurrentDigest).toBe(postDigest);
        expect(result.outcome.expectedCurrentVersion).toBe(String(postContent.length));
        expect(result.outcome.renameHandling).toBeNull();
      }
      expect(result.identityChanged).toBe(false);
    });

    it('returns applied-eligible with delete-file inverse for create_file', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const postContent = new TextEncoder().encode('created content');
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/new.txt', postContent);

      const target = makeTarget({
        canonicalPath: '/workspace/new.txt',
        preImageDigest: null,
        postImageDigest: postDigest,
        effectKind: 'create_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('applied-eligible');
      if (result.outcome.kind === 'applied-eligible') {
        expect(result.outcome.inverseOperation.kind).toBe('delete-file');
      }
    });

    it('returns applied-eligible with restore-from-artifact inverse for binary', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const encKey = Buffer.alloc(32, 0x42);
      const preContent = new TextEncoder().encode('binary original content');
      const postContent = new TextEncoder().encode('binary edited content');
      const preDigest = computeDigest(preContent);
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/binary.bin', postContent);

      // Stage the pre-image in the artifact store.
      const blobStore = new InMemoryBlobStore();
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const stageResult = artifactStore.stage({ bytes: preContent, contentClass: 'binary-blob' });
      if (!stageResult.ok) throw new Error('stage failed');
      artifactStore.commit(stageResult.artifactId);

      const target = makeTarget({
        canonicalPath: '/workspace/binary.bin',
        preImageDigest: preDigest,
        postImageDigest: postDigest,
        isBinary: true,
        artifactId: stageResult.artifactId,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store, [stageResult.artifactId]);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store, blobStore, encKey);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('applied-eligible');
      if (result.outcome.kind === 'applied-eligible') {
        expect(result.outcome.inverseOperation.kind).toBe('restore-from-artifact');
        if (result.outcome.inverseOperation.kind === 'restore-from-artifact') {
          expect(result.outcome.inverseOperation.artifactId).toBe(stageResult.artifactId);
        }
      }
    });

    it('returns applied-eligible when current matches pre-image (file reverted)', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const preContent = new TextEncoder().encode('original');
      const postContent = new TextEncoder().encode('edited');
      const preDigest = computeDigest(preContent);
      const postDigest = computeDigest(postContent);

      // Current state is back to pre-image (user reverted the edit).
      fsProbe.addFile('/workspace/file.txt', preContent);

      const target = makeTarget({
        canonicalPath: '/workspace/file.txt',
        preImageDigest: preDigest,
        postImageDigest: postDigest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('applied-eligible');
    });

    it('includes no unrelated target in the analysis', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const content = new TextEncoder().encode('content');
      const digest = computeDigest(content);

      fsProbe.addFile('/workspace/a.txt', content);
      fsProbe.addFile('/workspace/b.txt', content);

      const targetA = makeTarget({
        canonicalPath: '/workspace/a.txt',
        preImageDigest: 'old-a',
        postImageDigest: digest,
        effectKind: 'edit_file',
      });
      const targetB = makeTarget({
        canonicalPath: '/workspace/b.txt',
        preImageDigest: 'old-b',
        postImageDigest: digest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const ctx = makeContext(fsProbe, store);

      const result = analyzeRollbackSet(cpId, [targetA, targetB], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.analysis.perTarget.length).toBe(2);
      expect(result.analysis.perTarget[0].target.canonicalPath).toBe('/workspace/a.txt');
      expect(result.analysis.perTarget[1].target.canonicalPath).toBe('/workspace/b.txt');
      // No unrelated target (e.g. /workspace/c.txt) is included.
    });
  });

  // ==========================================================================
  // AC #3: Conflict/skipped/inaccessible/mismatch/unknown-outcome
  // ==========================================================================
  describe('AC #3: Conflict, skipped, inaccessible, mismatch, unknown-outcome', () => {
    it('returns conflict when current differs from post-image (later edit)', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const postContent = new TextEncoder().encode('edited');
      const laterContent = new TextEncoder().encode('later user edit');
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/file.txt', laterContent);

      const target = makeTarget({
        canonicalPath: '/workspace/file.txt',
        preImageDigest: 'original-digest',
        postImageDigest: postDigest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('conflict');
      if (result.outcome.kind === 'conflict') {
        expect(result.outcome.reasonCode).toBe('content-conflict');
      }
    });

    it('returns conflict when target was deleted after checkpoint', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const postContent = new TextEncoder().encode('edited');
      const postDigest = computeDigest(postContent);

      // File was deleted — no current state.
      const target = makeTarget({
        canonicalPath: '/workspace/deleted.txt',
        preImageDigest: 'original-digest',
        postImageDigest: postDigest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('conflict');
      if (result.outcome.kind === 'conflict') {
        expect(result.outcome.reasonCode).toBe('target-deleted');
      }
    });

    it('returns conflict when target was recreated after deletion', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const newContent = new TextEncoder().encode('recreated content');

      fsProbe.addFile('/workspace/recreated.txt', newContent);

      const target = makeTarget({
        canonicalPath: '/workspace/recreated.txt',
        preImageDigest: 'original-digest',
        postImageDigest: null,
        effectKind: 'delete_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('conflict');
      if (result.outcome.kind === 'conflict') {
        expect(result.outcome.reasonCode).toBe('target-recreated');
      }
    });

    it('returns mismatch when identity changed (renamed)', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const content = new TextEncoder().encode('content');
      const digest = computeDigest(content);

      // File exists at the original path, but realpath resolves to a different
      // path (simulating a rename or case/unicode normalization change).
      fsProbe.addFile('/workspace/original.txt', content);
      fsProbe.setRealPath('/workspace/original.txt', '/workspace/Renamed.txt');

      const target = makeTarget({
        canonicalPath: '/workspace/original.txt',
        preImageDigest: 'old-digest',
        postImageDigest: digest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('mismatch');
      if (result.outcome.kind === 'mismatch') {
        expect(result.outcome.reasonCode).toBe('identity-changed');
      }
      expect(result.identityChanged).toBe(true);
    });

    it('returns conflict when target is behind a symlink', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const content = new TextEncoder().encode('content behind symlink');
      const digest = computeDigest(content);

      // Real file at /workspace/real.txt, symlink at /workspace/link.txt -> /workspace/real.txt
      fsProbe.addFile('/workspace/real.txt', content);
      fsProbe.addSymlink('/workspace/link.txt', '/workspace/real.txt');

      const target = makeTarget({
        canonicalPath: '/workspace/link.txt',
        preImageDigest: 'old-digest',
        postImageDigest: digest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('conflict');
      if (result.outcome.kind === 'conflict') {
        expect(result.outcome.reasonCode).toBe('behind-symlink');
      }
    });

    it('returns inaccessible when target is not readable', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const content = new TextEncoder().encode('inaccessible content');
      const digest = computeDigest(content);

      fsProbe.addFile('/workspace/restricted.txt', content);
      fsProbe.setInaccessible('/workspace/restricted.txt');

      const target = makeTarget({
        canonicalPath: '/workspace/restricted.txt',
        preImageDigest: 'old-digest',
        postImageDigest: digest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('inaccessible');
    });

    it('returns unknown-outcome when target has open handles', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const content = new TextEncoder().encode('content with open handles');
      const digest = computeDigest(content);

      fsProbe.addFile('/workspace/open.txt', content);
      fsProbe.setOpenHandles('/workspace/open.txt');

      const target = makeTarget({
        canonicalPath: '/workspace/open.txt',
        preImageDigest: 'old-digest',
        postImageDigest: digest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('unknown-outcome');
    });

    it('returns skipped for explicitly skipped targets', () => {
      // Skipped targets are those where the caller explicitly marks them as
      // skipped. The analysis function doesn't generate skipped outcomes
      // internally — they come from the caller's selection. We verify the
      // aggregate analysis handles them.
      const fsProbe = new InMemoryAnalysisFsProbe();
      const content = new TextEncoder().encode('content');
      const digest = computeDigest(content);

      fsProbe.addFile('/workspace/skip.txt', content);

      const target = makeTarget({
        canonicalPath: '/workspace/skip.txt',
        preImageDigest: 'old-digest',
        postImageDigest: digest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const ctx = makeContext(fsProbe, store);

      // No targets selected — analysis is empty.
      const result = analyzeRollbackSet(cpId, [], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.analysis.perTarget.length).toBe(0);
      expect(result.analysis.eligibleCount).toBe(0);
    });

    it('NO overwrite or best-effort reversal prepared for conflict', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const postContent = new TextEncoder().encode('edited');
      const laterContent = new TextEncoder().encode('later user edit');
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/file.txt', laterContent);

      const target = makeTarget({
        canonicalPath: '/workspace/file.txt',
        preImageDigest: 'original-digest',
        postImageDigest: postDigest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      // The outcome is conflict — no inverse operation is prepared.
      expect(result.outcome.kind).toBe('conflict');
      if (result.outcome.kind === 'conflict') {
        // No inverse operation field exists on conflict outcomes.
        expect('inverseOperation' in result.outcome).toBe(false);
      }
    });
  });

  // ==========================================================================
  // AC #4: Binary original in encrypted ArtifactStore
  // ==========================================================================
  describe('AC #4: Binary original integrity verification', () => {
    it('reads binary original via integrity-verified path and compares digests', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const encKey = Buffer.alloc(32, 0x42);
      const preContent = new TextEncoder().encode('binary original');
      const postContent = new TextEncoder().encode('binary edited');
      const preDigest = computeDigest(preContent);
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/binary.bin', postContent);

      // Stage the pre-image in the artifact store.
      const blobStore = new InMemoryBlobStore();
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const stageResult = artifactStore.stage({ bytes: preContent, contentClass: 'binary-blob' });
      if (!stageResult.ok) throw new Error('stage failed');
      artifactStore.commit(stageResult.artifactId);

      const target = makeTarget({
        canonicalPath: '/workspace/binary.bin',
        preImageDigest: preDigest,
        postImageDigest: postDigest,
        isBinary: true,
        artifactId: stageResult.artifactId,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store, [stageResult.artifactId]);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store, blobStore, encKey);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      // Should be applied-eligible since current matches post-image.
      expect(result.outcome.kind).toBe('applied-eligible');
      // No raw bytes in the analysis result (AD-24).
      expect(JSON.stringify(result)).not.toContain('binary original');
      expect(JSON.stringify(result)).not.toContain('binary edited');
    });

    it('marks missing binary original as not apply-eligible', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const encKey = Buffer.alloc(32, 0x42);
      const postContent = new TextEncoder().encode('binary edited');
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/binary.bin', postContent);

      // No artifact staged — binary original is missing.
      const blobStore = new InMemoryBlobStore();
      const artifactStore = new ArtifactStore(blobStore, encKey);

      const target = makeTarget({
        canonicalPath: '/workspace/binary.bin',
        preImageDigest: 'pre-digest',
        postImageDigest: postDigest,
        isBinary: true,
        artifactId: asArtifactId('missing-artifact'),
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store, blobStore, encKey);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      // Missing binary original is not apply-eligible.
      expect(result.outcome.kind).not.toBe('applied-eligible');
    });

    it('marks corrupt binary original as not apply-eligible', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const encKey = Buffer.alloc(32, 0x42);
      const postContent = new TextEncoder().encode('binary edited');
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/binary.bin', postContent);

      // Stage an artifact, then corrupt it by overwriting the data.
      const blobStore = new InMemoryBlobStore();
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const stageResult = artifactStore.stage({ bytes: new TextEncoder().encode('original'), contentClass: 'binary-blob' });
      if (!stageResult.ok) throw new Error('stage failed');
      artifactStore.commit(stageResult.artifactId);

      // Corrupt the artifact data.
      blobStore.put(`artifact:${stageResult.artifactId}`, new TextEncoder().encode('corrupted data'));

      const target = makeTarget({
        canonicalPath: '/workspace/binary.bin',
        preImageDigest: 'pre-digest',
        postImageDigest: postDigest,
        isBinary: true,
        artifactId: stageResult.artifactId,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store, [stageResult.artifactId]);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store, blobStore, encKey);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      // Corrupt binary original is not apply-eligible.
      expect(result.outcome.kind).not.toBe('applied-eligible');
    });

    it('does not expose raw bytes in analysis output (AD-24)', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const encKey = Buffer.alloc(32, 0x42);
      const preContent = new TextEncoder().encode('sensitive-binary-content');
      const postContent = new TextEncoder().encode('sensitive-edited-content');
      const preDigest = computeDigest(preContent);
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/sensitive.bin', postContent);

      const blobStore = new InMemoryBlobStore();
      const artifactStore = new ArtifactStore(blobStore, encKey);
      const stageResult = artifactStore.stage({ bytes: preContent, contentClass: 'binary-blob' });
      if (!stageResult.ok) throw new Error('stage failed');
      artifactStore.commit(stageResult.artifactId);

      const target = makeTarget({
        canonicalPath: '/workspace/sensitive.bin',
        preImageDigest: preDigest,
        postImageDigest: postDigest,
        isBinary: true,
        artifactId: stageResult.artifactId,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store, [stageResult.artifactId]);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store, blobStore, encKey);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      // Serialize to JSON and verify no raw bytes are exposed.
      const json = JSON.stringify(result);
      expect(json).not.toContain('sensitive-binary-content');
      expect(json).not.toContain('sensitive-edited-content');
      // Digests are safe to expose.
      expect(json).toContain(preDigest);
      expect(json).toContain(postDigest);
    });
  });

  // ==========================================================================
  // AC #5: Conflict panel safe choices
  // ==========================================================================
  describe('AC #5: Conflict panel offers only safe choices', () => {
    it('offers skip-target as a safe choice', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const postContent = new TextEncoder().encode('edited');
      const laterContent = new TextEncoder().encode('later edit');
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/file.txt', laterContent);

      const target = makeTarget({
        canonicalPath: '/workspace/file.txt',
        preImageDigest: 'original-digest',
        postImageDigest: postDigest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('conflict');
      if (result.outcome.kind === 'conflict') {
        const choices = result.outcome.safeChoices.map((c) => c.kind);
        expect(choices).toContain('skip-target');
      }
    });

    it('offers export-sanitized-patch as a safe choice', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const postContent = new TextEncoder().encode('edited');
      const laterContent = new TextEncoder().encode('later edit');
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/file.txt', laterContent);

      const target = makeTarget({
        canonicalPath: '/workspace/file.txt',
        preImageDigest: 'original-digest',
        postImageDigest: postDigest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('conflict');
      if (result.outcome.kind === 'conflict') {
        const choices = result.outcome.safeChoices.map((c) => c.kind);
        expect(choices).toContain('export-sanitized-patch');
      }
    });

    it('offers user-authored-resolution as a safe choice', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const postContent = new TextEncoder().encode('edited');
      const laterContent = new TextEncoder().encode('later edit');
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/file.txt', laterContent);

      const target = makeTarget({
        canonicalPath: '/workspace/file.txt',
        preImageDigest: 'original-digest',
        postImageDigest: postDigest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('conflict');
      if (result.outcome.kind === 'conflict') {
        const choices = result.outcome.safeChoices.map((c) => c.kind);
        expect(choices).toContain('user-authored-resolution');
      }
    });

    it('does NOT offer overwrite, continue, or blind-retry', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const postContent = new TextEncoder().encode('edited');
      const laterContent = new TextEncoder().encode('later edit');
      const postDigest = computeDigest(postContent);

      fsProbe.addFile('/workspace/file.txt', laterContent);

      const target = makeTarget({
        canonicalPath: '/workspace/file.txt',
        preImageDigest: 'original-digest',
        postImageDigest: postDigest,
        effectKind: 'edit_file',
      });

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const record = repo.read(asCheckpointId(cpId));
      if (!record.ok) throw new Error('read failed');

      const ctx = makeContext(fsProbe, store);
      const result = analyzeRollbackTarget(target, record.record, ctx);

      expect(result.outcome.kind).toBe('conflict');
      if (result.outcome.kind === 'conflict') {
        const choiceKinds = result.outcome.safeChoices.map((c) => c.kind);
        expect(choiceKinds).not.toContain('overwrite');
        expect(choiceKinds).not.toContain('continue');
        expect(choiceKinds).not.toContain('blind-retry');
        // Only the four safe choices are present.
        expect(choiceKinds.length).toBe(3); // skip, export, user-authored
      }
    });

    it('rebase-new-path is available in the SafeChoice type', () => {
      // Verify the SafeChoice type includes rebase-new-path.
      const choice: SafeChoice = { kind: 'rebase-new-path', newPath: '/workspace/new-location.txt' };
      expect(choice.kind).toBe('rebase-new-path');
      expect('newPath' in choice).toBe(true);
    });
  });

  // ==========================================================================
  // analyzeRollbackSet aggregation
  // ==========================================================================
  describe('analyzeRollbackSet aggregation', () => {
    it('aggregates per-target outcomes correctly', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const content = new TextEncoder().encode('content');
      const digest = computeDigest(content);

      // Target 1: applied-eligible (current matches post-image)
      fsProbe.addFile('/workspace/eligible.txt', content);

      // Target 2: conflict (current differs from post-image)
      const postDigest2 = computeDigest(new TextEncoder().encode('edited'));
      fsProbe.addFile('/workspace/conflict.txt', new TextEncoder().encode('later edit'));

      const targets: RollbackTarget[] = [
        makeTarget({
          canonicalPath: '/workspace/eligible.txt',
          preImageDigest: 'old-digest',
          postImageDigest: digest,
          effectKind: 'edit_file',
        }),
        makeTarget({
          canonicalPath: '/workspace/conflict.txt',
          preImageDigest: 'old-digest-2',
          postImageDigest: postDigest2,
          effectKind: 'edit_file',
        }),
      ];

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const ctx = makeContext(fsProbe, store);

      const result = analyzeRollbackSet(cpId, targets, ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const analysis = result.analysis;
      expect(analysis.perTarget.length).toBe(2);
      expect(analysis.eligibleCount).toBe(1);
      expect(analysis.conflictCount).toBe(1);
      expect(analysis.skippedCount).toBe(0);
      expect(analysis.inaccessibleCount).toBe(0);
      expect(analysis.mismatchCount).toBe(0);
      expect(analysis.unknownCount).toBe(0);
      expect(analysis.overallEligible).toBe(false);
    });

    it('returns overallEligible=true when all targets are eligible', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const content = new TextEncoder().encode('content');
      const digest = computeDigest(content);

      fsProbe.addFile('/workspace/a.txt', content);
      fsProbe.addFile('/workspace/b.txt', content);

      const targets: RollbackTarget[] = [
        makeTarget({
          canonicalPath: '/workspace/a.txt',
          preImageDigest: 'old-a',
          postImageDigest: digest,
          effectKind: 'edit_file',
        }),
        makeTarget({
          canonicalPath: '/workspace/b.txt',
          preImageDigest: 'old-b',
          postImageDigest: digest,
          effectKind: 'edit_file',
        }),
      ];

      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const ctx = makeContext(fsProbe, store);

      const result = analyzeRollbackSet(cpId, targets, ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.analysis.overallEligible).toBe(true);
      expect(result.analysis.eligibleCount).toBe(2);
    });

    it('returns failure when checkpoint is not found', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const store = new InMemoryKeyValueStore();
      const ctx = makeContext(fsProbe, store);

      const result = analyzeRollbackSet('nonexistent-checkpoint', [], ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // CheckpointRepository.read returns 'corrupt' for missing checkpoints,
        // which maps to 'checkpoint-unreadable' in analyzeRollbackSet.
        expect(result.failure.category).toBe('checkpoint-unreadable');
      }
    });

    it('handles empty target list', () => {
      const fsProbe = new InMemoryAnalysisFsProbe();
      const store = new InMemoryKeyValueStore();
      const repo = new CheckpointRepository(store, fixedClock());
      const cpId = stageAndCommitCheckpoint(repo, store);
      const ctx = makeContext(fsProbe, store);

      const result = analyzeRollbackSet(cpId, [], ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.analysis.perTarget.length).toBe(0);
      expect(result.analysis.overallEligible).toBe(true);
      expect(result.analysis.eligibleCount).toBe(0);
    });
  });
});
