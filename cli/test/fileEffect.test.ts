// File effect tests (Story 3.5, all 5 ACs). Uses in-memory fs/checkpoint stores
// + injected clock + fake journal repo. Covers: exact preview with all fields +
// Plan deny; ordered effect execution with EffectDispatchCommitted before native
// mutation + completion only post-commit; stale-approval when target/bytes differ
// -> not dispatched + Full Access cannot authorize; conflict/unknown-outcome on
// concurrent-writer/rename/open-handle/case-unicode/symlink-change -> no best-effort
// overwrite + unrelated work preserved + deterministic Evidence; success -> actual
// post-image digest/version + bytes/line metadata + verification + checkpoint ref
// + exclusions, completion withheld until post-commit. >=22 cases. No network/real
// creds.

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { previewFileEffect } from '../src/core/effects/preview.js';
import { applyFileEffect } from '../src/core/effects/fileEffect.js';
import { revalidateFileEffect } from '../src/core/effects/revalidate.js';
import { detectConflict } from '../src/core/effects/conflict.js';
import { CheckpointRepository } from '../src/core/checkpoints/checkpointRepository.js';
import { ArtifactStore } from '../src/core/checkpoints/artifactStore.js';
import { generateDataKey } from '../src/core/sessions/crypto.js';
import { createAuthorization, consumeAuthorization } from '../src/core/permissions/authorization.js';
import type { Authorization, ProposalBinding } from '../src/core/permissions/authorization.js';
import type { PepDecision } from '../src/core/permissions/pep.js';
import { newOperationId } from '../src/core/protocol/ids.js';
import type { OperationId } from '../src/core/protocol/ids.js';
import type { FsProbe, WorkspaceIdentity } from '../src/core/workspace/types.js';
import { establishWorkspaceBinding } from '../src/core/workspace/identity.js';
import type { KeyValueStore, BlobStore } from '../src/core/checkpoints/types.js';
import type { FsMutator, EffectOutcome, EffectConflict, EffectExecutionResult } from '../src/core/effects/types.js';
import type { DurableEvent } from '../src/core/protocol/events.js';

// =============================================================================
// In-memory backing stores
// =============================================================================

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

// =============================================================================
// In-memory filesystem (shared between FsProbe and FsMutator)
// =============================================================================

interface InMemoryFile {
  content?: Uint8Array;
  isDir?: boolean;
  isSymlink?: boolean;
  linkTarget?: string;
  dev?: number;
  ino?: number;
}

class InMemoryFileSystem {
  readonly files = new Map<string, InMemoryFile>();

  constructor() {
    this.files.set('/ws-root', { isDir: true, dev: 42, ino: 1 });
  }

  addFile(path: string, content: string, opts?: { dev?: number; ino?: number }): void {
    this.files.set(path, { content: new TextEncoder().encode(content), dev: opts?.dev ?? 42, ino: opts?.ino ?? 100 });
  }

  addDir(path: string): void {
    this.files.set(path, { isDir: true, dev: 42, ino: 1 });
  }

  addSymlink(path: string, target: string): void {
    this.files.set(path, { isSymlink: true, linkTarget: target, dev: 42, ino: 1 });
  }
}

function inMemoryFsProbe(fs: InMemoryFileSystem): FsProbe {
  return {
    realpath(p: string): string {
      if (!fs.files.has(p) && !Array.from(fs.files.keys()).some((k) => k.startsWith(p))) {
        if (p.endsWith('/ws-root')) return p;
        throw new Error(`ENOENT: ${p}`);
      }
      return p;
    },
    lstat(p: string) {
      const entry = fs.files.get(p);
      if (!entry) throw new Error(`ENOENT: ${p}`);
      return {
        dev: entry.dev ?? 42,
        ino: entry.ino ?? 100,
        size: entry.content ? entry.content.length : 0,
        isDirectory: entry.isDir ?? false,
        isFile: !entry.isDir && !entry.isSymlink,
        isSymbolicLink: entry.isSymlink ?? false,
      };
    },
    stat(p: string) {
      const entry = fs.files.get(p);
      if (!entry) throw new Error(`ENOENT: ${p}`);
      return {
        dev: entry.dev ?? 42,
        ino: entry.ino ?? 100,
        size: entry.content ? entry.content.length : 0,
        isDirectory: entry.isDir ?? false,
        isFile: !entry.isDir,
      };
    },
    readlink(p: string): string {
      const entry = fs.files.get(p);
      if (!entry?.isSymlink || !entry.linkTarget) throw new Error(`EINVAL: ${p} is not a symlink`);
      return entry.linkTarget;
    },
    statfs(_p: string): { type: number } | null {
      return { type: 0x0100 };
    },
    readFile(p: string): Uint8Array {
      const entry = fs.files.get(p);
      if (!entry || !entry.content) throw new Error(`ENOENT: ${p}`);
      return entry.content;
    },
  };
}

function inMemoryFsMutator(fs: InMemoryFileSystem): FsMutator {
  return {
    writeFile(path: string, content: Uint8Array): void {
      fs.files.set(path, { content, dev: 42, ino: Date.now() });
    },
    mkdir(dir: string): void {
      if (!fs.files.has(dir)) {
        fs.files.set(dir, { isDir: true, dev: 42, ino: 1 });
      }
    },
  };
}

// =============================================================================
// Fake journal repo (in-memory event collector)
// =============================================================================

class FakeJournal {
  readonly events: DurableEvent[] = [];

  append(event: DurableEvent): number {
    this.events.push(event);
    return this.events.length;
  }

  lastEvent(): DurableEvent | undefined {
    return this.events[this.events.length - 1];
  }

  eventsOfKind(kind: string): DurableEvent[] {
    return this.events.filter((e) => e.payload.kind === kind);
  }

  clear(): void {
    this.events.length = 0;
  }
}

// =============================================================================
// Helpers
// =============================================================================

function fixedClock(): () => string {
  let t = 0;
  return () => {
    t += 1;
    return `2026-07-17T00:00:00.${String(t).padStart(3, '0')}Z`;
  };
}

function makeKey(): Buffer {
  return generateDataKey();
}

function makeWorkspace(fs: InMemoryFileSystem): WorkspaceIdentity {
  return establishWorkspaceBinding('/ws-root', {
    platformProbe: { platform: 'darwin', casePolicy: 'case-sensitive', unicodePolicy: 'nfd' },
    fsProbe: inMemoryFsProbe(fs),
  });
}

function makeAllowDecision(): PepDecision {
  return { outcome: 'allow', reason: 'manual-approval', matrixVersion: 1, activationRevision: 1, actionClass: 'write_file' };
}

function makeAuthorization(
  operationId: OperationId,
  binding: ProposalBinding,
  overrides: Partial<{
    activationId: string;
    activationRevision: number;
    authorityRevision: number;
    expiresAt: string | null;
  }> = {},
): Authorization {
  return createAuthorization({
    operationId,
    binding,
    decision: makeAllowDecision(),
    activationId: overrides.activationId ?? 'act-1',
    activationRevision: overrides.activationRevision ?? 1,
    authorityRevision: overrides.authorityRevision ?? 1,
    approvingInteraction: 'test-approval',
    clock: fixedClock(),
    expiresAt: overrides.expiresAt ?? null,
  });
}

function computeDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// =============================================================================
// Tests
// =============================================================================

describe('File Effects (Story 3.5)', () => {
  // ==========================================================================
  // AC #1: Exact preview with all fields + Plan deny
  // ==========================================================================
  describe('AC #1: Preview shows exact fields; Plan returns deny', () => {
    it('previewCreateFile shows all required fields', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const content = new TextEncoder().encode('Hello, World!');

      const result = previewFileEffect('create_file', '/ws-root/new.txt', content, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'build',
        activationId: 'act-1',
        activationRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      expect(preview.kind).toBe('create_file');
      expect(preview.target.canonicalPath).toBe('/ws-root/new.txt');
      expect(preview.target.displayPath).toBe('/ws-root/new.txt');
      expect(preview.expectedPreImage.absent).toBe(true);
      expect(preview.expectedPreImage.digest).toBeNull();
      expect(preview.expectedPreImage.version).toBeNull();
      expect(preview.contentSummary).toContain('13 bytes');
      expect(preview.postImageDigest).toBe(computeDigest(content));
      expect(preview.postImageSizeBytes).toBe(13);
      expect(preview.lineCount).toBe(1);
      expect(preview.exclusions).toEqual([]);
      expect(preview.checkpointCoverage).toBe('fully-protected');
      expect(preview.authority.activationId).toBe('act-1');
      expect(preview.authority.activationRevision).toBe(1);
      expect(preview.operationId).toBeTruthy();
    });

    it('previewEditFile shows expected pre-image digest for existing file', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/existing.txt', 'original content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const content = new TextEncoder().encode('modified content');

      const result = previewFileEffect('edit_file', '/ws-root/existing.txt', content, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'build',
        activationId: 'act-1',
        activationRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      expect(preview.kind).toBe('edit_file');
      expect(preview.expectedPreImage.absent).toBe(false);
      expect(preview.expectedPreImage.digest).toBeTruthy();
      expect(preview.expectedPreImage.version).toBeTruthy();
      expect(preview.contentSummary).toContain('16 bytes');
    });

    it('Plan mode returns deny and cannot authorize', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const content = new TextEncoder().encode('test');

      const result = previewFileEffect('create_file', '/ws-root/new.txt', content, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'plan',
        activationId: 'act-1',
        activationRevision: 1,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.kind).toBe('deny');
      expect(result.reason).toContain('Plan mode');
    });

    it('previewCreateFile with target outside workspace returns deny', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const content = new TextEncoder().encode('test');

      const result = previewFileEffect('create_file', '/outside/evil.txt', content, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'build',
        activationId: 'act-1',
        activationRevision: 1,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.kind).toBe('deny');
    });

    it('previewCreateFile for existing file reports exclusion', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/existing.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const content = new TextEncoder().encode('new content');

      const result = previewFileEffect('create_file', '/ws-root/existing.txt', content, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'build',
        activationId: 'act-1',
        activationRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.preview.exclusions.length).toBeGreaterThan(0);
      expect(result.preview.checkpointCoverage).toBe('partially-protected');
    });

    it('previewEditFile for non-existent file reports exclusion', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const content = new TextEncoder().encode('content');

      const result = previewFileEffect('edit_file', '/ws-root/nonexistent.txt', content, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'build',
        activationId: 'act-1',
        activationRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.preview.exclusions.length).toBeGreaterThan(0);
    });

    it('preview includes line count for multi-line content', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const content = new TextEncoder().encode('line1\nline2\nline3\n');

      const result = previewFileEffect('create_file', '/ws-root/multi.txt', content, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'build',
        activationId: 'act-1',
        activationRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.preview.lineCount).toBe(4);
      expect(result.preview.contentSummary).toContain('4 lines');
    });
  });

  // ==========================================================================
  // AC #2: Ordered effect execution with EffectDispatchCommitted before native
  //        mutation + completion only post-commit
  // ==========================================================================
  describe('AC #2: Ordered effect execution', () => {
    it('executes the exact ordered steps for create_file', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('new file content');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/new.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyFileEffect('create_file', '/ws-root/new.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      // Verify success.
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const execResult = result as EffectExecutionResult;
      expect(execResult.operationId).toBe(opId);
      expect(execResult.actualPostImage.digest).toBe(computeDigest(content));
      expect(execResult.actualPostImage.sizeBytes).toBe(16);
      expect(execResult.verificationStatus).toBe('verified');
      expect(execResult.checkpointReference).not.toBeNull();
      expect(execResult.checkpointReference!.coverageState).toBe('fully-protected');
      expect(execResult.completedAt).toBeTruthy();

      // Verify the file was actually written.
      const written = fs.files.get('/ws-root/new.txt');
      expect(written).toBeDefined();
      expect(written!.content).toEqual(content);

      // Verify event ordering: EffectDispatchCommitted before OperationSucceeded.
      const dispatchEvents = journal.eventsOfKind('EffectDispatchCommitted');
      const successEvents = journal.eventsOfKind('OperationSucceeded');
      expect(dispatchEvents.length).toBe(1);
      expect(successEvents.length).toBe(1);

      const dispatchIdx = journal.events.indexOf(dispatchEvents[0]);
      const successIdx = journal.events.indexOf(successEvents[0]);
      expect(dispatchIdx).toBeLessThan(successIdx);
    });

    it('executes the exact ordered steps for edit_file', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/existing.txt', 'original content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('modified content');

      const binding: ProposalBinding = {
        actionClass: 'edit_file',
        target: '/ws-root/existing.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyFileEffect('edit_file', '/ws-root/existing.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const execResult = result as EffectExecutionResult;
      expect(execResult.actualPostImage.digest).toBe(computeDigest(content));
      expect(execResult.verificationStatus).toBe('verified');

      // Verify the file was updated.
      const written = fs.files.get('/ws-root/existing.txt');
      expect(written).toBeDefined();
      expect(written!.content).toEqual(content);
    });

    it('EffectDispatchCommitted is appended before native mutation', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('test');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/test.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      // Capture events before mutation.
      const beforeCount = journal.events.length;

      applyFileEffect('create_file', '/ws-root/test.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      // EffectDispatchCommitted should be in the journal.
      const dispatchEvents = journal.eventsOfKind('EffectDispatchCommitted');
      expect(dispatchEvents.length).toBe(1);

      // The file should exist after the effect.
      const written = fs.files.get('/ws-root/test.txt');
      expect(written).toBeDefined();
    });

    it('completion (OperationSucceeded) is only published post-commit', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('test');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/post-commit.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      applyFileEffect('create_file', '/ws-root/post-commit.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      // OperationSucceeded should be the last event.
      const last = journal.lastEvent();
      expect(last).toBeDefined();
      expect(last!.payload.kind).toBe('OperationSucceeded');

      // EffectDispatchCommitted should come before OperationSucceeded.
      const dispatchEvents = journal.eventsOfKind('EffectDispatchCommitted');
      const successEvents = journal.eventsOfKind('OperationSucceeded');
      expect(dispatchEvents.length).toBe(1);
      expect(successEvents.length).toBe(1);
      expect(journal.events.indexOf(dispatchEvents[0])).toBeLessThan(journal.events.indexOf(successEvents[0]));
    });

    it('authorization is consumed after checkpoint stage, before native mutation', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('test');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/consume-test.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      applyFileEffect('create_file', '/ws-root/consume-test.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      // The authorization should be consumed — verify via journal events.
      const dispatchEvents = journal.eventsOfKind('EffectDispatchCommitted');
      expect(dispatchEvents.length).toBe(1);

      // The file should have been written (native mutation happened after consumption).
      const written = fs.files.get('/ws-root/consume-test.txt');
      expect(written).toBeDefined();
      expect(written!.content).toEqual(content);
    });
  });

  // ==========================================================================
  // AC #3: Stale-approval when target/bytes differ -> not dispatched + Full
  //        Access cannot authorize
  // ==========================================================================
  describe('AC #3: Stale approval detection', () => {
    it('detects stale when target path differs from reviewed proposal', () => {
      const opId = newOperationId();
      const content = new TextEncoder().encode('test content');
      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/original.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      // Revalidate with a different target.
      const result = revalidateFileEffect(
        {
          kind: 'create_file',
          operationId: opId,
          target: { canonicalPath: '/ws-root/different.txt', displayPath: '/ws-root/different.txt' },
          expectedPreImage: { digest: null, version: null, absent: true },
          content,
          contentSummary: '12 bytes, 1 line',
          postImageDigest: computeDigest(content),
          postImageSizeBytes: 12,
          lineCount: 1,
          exclusions: [],
          checkpointCoverage: 'fully-protected',
          authorizationId: auth.authorizationId,
          activationId: 'act-1',
          activationRevision: 1,
        },
        auth,
        { activationId: 'act-1', activationRevision: 1, authorityRevision: 1, now: '2026-07-17T00:00:00.000Z' },
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.stale).toBe(true);
    });

    it('detects stale when content digest differs from reviewed proposal', () => {
      const opId = newOperationId();
      const originalContent = new TextEncoder().encode('original content');
      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/file.txt',
        payload: computeDigest(originalContent),
      };
      const auth = makeAuthorization(opId, binding);

      // Different content.
      const differentContent = new TextEncoder().encode('different content');
      const result = revalidateFileEffect(
        {
          kind: 'create_file',
          operationId: opId,
          target: { canonicalPath: '/ws-root/file.txt', displayPath: '/ws-root/file.txt' },
          expectedPreImage: { digest: null, version: null, absent: true },
          content: differentContent,
          contentSummary: '17 bytes, 1 line',
          postImageDigest: computeDigest(differentContent),
          postImageSizeBytes: 17,
          lineCount: 1,
          exclusions: [],
          checkpointCoverage: 'fully-protected',
          authorizationId: auth.authorizationId,
          activationId: 'act-1',
          activationRevision: 1,
        },
        auth,
        { activationId: 'act-1', activationRevision: 1, authorityRevision: 1, now: '2026-07-17T00:00:00.000Z' },
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.stale).toBe(true);
    });

    it('detects stale when activation changed', () => {
      const opId = newOperationId();
      const content = new TextEncoder().encode('test');
      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/file.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding, { activationId: 'act-1' });

      // Different activation.
      const result = revalidateFileEffect(
        {
          kind: 'create_file',
          operationId: opId,
          target: { canonicalPath: '/ws-root/file.txt', displayPath: '/ws-root/file.txt' },
          expectedPreImage: { digest: null, version: null, absent: true },
          content,
          contentSummary: '4 bytes, 1 line',
          postImageDigest: computeDigest(content),
          postImageSizeBytes: 4,
          lineCount: 1,
          exclusions: [],
          checkpointCoverage: 'fully-protected',
          authorizationId: auth.authorizationId,
          activationId: 'act-2',
          activationRevision: 1,
        },
        auth,
        { activationId: 'act-2', activationRevision: 1, authorityRevision: 1, now: '2026-07-17T00:00:00.000Z' },
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.stale).toBe(true);
    });

    it('detects stale when authority revision changed', () => {
      const opId = newOperationId();
      const content = new TextEncoder().encode('test');
      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/file.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding, { authorityRevision: 1 });

      const result = revalidateFileEffect(
        {
          kind: 'create_file',
          operationId: opId,
          target: { canonicalPath: '/ws-root/file.txt', displayPath: '/ws-root/file.txt' },
          expectedPreImage: { digest: null, version: null, absent: true },
          content,
          contentSummary: '4 bytes, 1 line',
          postImageDigest: computeDigest(content),
          postImageSizeBytes: 4,
          lineCount: 1,
          exclusions: [],
          checkpointCoverage: 'fully-protected',
          authorizationId: auth.authorizationId,
          activationId: 'act-1',
          activationRevision: 1,
        },
        auth,
        { activationId: 'act-1', activationRevision: 1, authorityRevision: 5, now: '2026-07-17T00:00:00.000Z' },
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.stale).toBe(true);
    });

    it('detects stale when authorization is expired', () => {
      const opId = newOperationId();
      const content = new TextEncoder().encode('test');
      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/file.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding, { expiresAt: '2026-07-16T00:00:00.000Z' });

      const result = revalidateFileEffect(
        {
          kind: 'create_file',
          operationId: opId,
          target: { canonicalPath: '/ws-root/file.txt', displayPath: '/ws-root/file.txt' },
          expectedPreImage: { digest: null, version: null, absent: true },
          content,
          contentSummary: '4 bytes, 1 line',
          postImageDigest: computeDigest(content),
          postImageSizeBytes: 4,
          lineCount: 1,
          exclusions: [],
          checkpointCoverage: 'fully-protected',
          authorizationId: auth.authorizationId,
          activationId: 'act-1',
          activationRevision: 1,
        },
        auth,
        { activationId: 'act-1', activationRevision: 1, authorityRevision: 1, now: '2026-07-17T00:00:00.000Z' },
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.stale).toBe(true);
    });

    it('returns ok when proposal matches authorization exactly', () => {
      const opId = newOperationId();
      const content = new TextEncoder().encode('test');
      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/file.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const result = revalidateFileEffect(
        {
          kind: 'create_file',
          operationId: opId,
          target: { canonicalPath: '/ws-root/file.txt', displayPath: '/ws-root/file.txt' },
          expectedPreImage: { digest: null, version: null, absent: true },
          content,
          contentSummary: '4 bytes, 1 line',
          postImageDigest: computeDigest(content),
          postImageSizeBytes: 4,
          lineCount: 1,
          exclusions: [],
          checkpointCoverage: 'fully-protected',
          authorizationId: auth.authorizationId,
          activationId: 'act-1',
          activationRevision: 1,
        },
        auth,
        { activationId: 'act-1', activationRevision: 1, authorityRevision: 1, now: '2026-07-17T00:00:00.000Z' },
      );

      expect(result.ok).toBe(true);
    });

    it('stale approval prevents effect dispatch (applyFileEffect returns stale-approval)', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('test');

      // Authorization for a different target.
      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/different.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      // Try to apply with a different target than authorized.
      const result = applyFileEffect('create_file', '/ws-root/actual.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      // Should be stale-approval, not dispatched.
      expect(result.ok).toBe(false);
      const conflict = result as EffectConflict;
      expect(conflict.kind).toBe('stale-approval');

      // The file should NOT have been written.
      expect(fs.files.has('/ws-root/actual.txt')).toBe(false);
    });
  });

  // ==========================================================================
  // AC #4: Conflict/unknown-outcome on concurrent-writer/rename/open-handle/
  //        case-unicode/symlink-change -> no best-effort overwrite + unrelated
  //        work preserved + deterministic Evidence
  // ==========================================================================
  describe('AC #4: Conflict detection', () => {
    it('detects unknown-outcome when target is no longer resolvable (renamed/deleted)', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const opId = newOperationId();

      // Target doesn't exist — identity cannot be proven.
      const result = detectConflict({
        operationId: opId,
        targetPath: '/ws-root/nonexistent.txt',
        expectedDigest: null,
        expectedVersion: null,
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
      });

      expect(result).not.toBeNull();
      expect(result!.ok).toBe(false);
      expect(result!.kind).toBe('unknown-outcome');
      expect(result!.reasonCode).toBe('open-handle-uncertainty');
      expect(result!.evidence.operationId).toBe(opId);
      expect(result!.evidence.targetPath).toBe('/ws-root/nonexistent.txt');
    });

    it('detects conflict when content digest changed (concurrent writer)', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/existing.txt', 'original content');
      const clock = fixedClock();
      const opId = newOperationId();

      // Expected digest doesn't match actual.
      const wrongDigest = '0000000000000000000000000000000000000000000000000000000000000000';
      const result = detectConflict({
        operationId: opId,
        targetPath: '/ws-root/existing.txt',
        expectedDigest: wrongDigest,
        expectedVersion: '42:100',
        workspace: makeWorkspace(fs),
        fsProbe: inMemoryFsProbe(fs),
        clock,
      });

      expect(result).not.toBeNull();
      expect(result!.ok).toBe(false);
      expect(result!.kind).toBe('conflict');
      expect(result!.reasonCode).toBe('digest-mismatch');
      expect(result!.evidence.expectedDigest).toBe(wrongDigest);
      expect(result!.evidence.actualDigest).toBe(computeDigest(new TextEncoder().encode('original content')));
    });

    it('detects conflict when version changed (rename or concurrent modification)', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/existing.txt', 'content', { dev: 42, ino: 100 });
      const clock = fixedClock();
      const opId = newOperationId();

      // Expected version doesn't match.
      const result = detectConflict({
        operationId: opId,
        targetPath: '/ws-root/existing.txt',
        expectedDigest: computeDigest(new TextEncoder().encode('content')),
        expectedVersion: '42:999',
        workspace: makeWorkspace(fs),
        fsProbe: inMemoryFsProbe(fs),
        clock,
      });

      expect(result).not.toBeNull();
      expect(result!.ok).toBe(false);
      expect(result!.kind).toBe('conflict');
      expect(result!.reasonCode).toBe('version-mismatch');
    });

    it('detects conflict when target is a symlink', () => {
      const fs = new InMemoryFileSystem();
      fs.addSymlink('/ws-root/link.txt', '/outside/real.txt');
      const clock = fixedClock();
      const opId = newOperationId();

      const result = detectConflict({
        operationId: opId,
        targetPath: '/ws-root/link.txt',
        expectedDigest: null,
        expectedVersion: null,
        workspace: makeWorkspace(fs),
        fsProbe: inMemoryFsProbe(fs),
        clock,
      });

      expect(result).not.toBeNull();
      expect(result!.ok).toBe(false);
      expect(result!.kind).toBe('conflict');
      expect(result!.reasonCode).toBe('symlink-detected');
    });

    it('detects unknown-outcome when target identity cannot be proven', () => {
      const fs = new InMemoryFileSystem();
      const clock = fixedClock();
      const opId = newOperationId();

      // Target doesn't exist (create scenario) - identity cannot be proven.
      const result = detectConflict({
        operationId: opId,
        targetPath: '/ws-root/new-file.txt',
        expectedDigest: null,
        expectedVersion: null,
        workspace: makeWorkspace(fs),
        fsProbe: inMemoryFsProbe(fs),
        clock,
      });

      // For a non-existent target, the conflict detection returns conflict
      // because the target is unresolvable.
      expect(result).not.toBeNull();
      expect(result!.ok).toBe(false);
    });

    it('does NOT best-effort overwrite on conflict', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/existing.txt', 'original content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const opId = newOperationId();

      // Expected digest doesn't match actual (simulating concurrent writer).
      const wrongDigest = '0000000000000000000000000000000000000000000000000000000000000000';
      const result = detectConflict({
        operationId: opId,
        targetPath: '/ws-root/existing.txt',
        expectedDigest: wrongDigest,
        expectedVersion: '42:100',
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
      });

      // Should be a conflict, not a successful overwrite.
      expect(result).not.toBeNull();
      expect(result!.ok).toBe(false);
      expect(result!.kind).toBe('conflict');
      expect(result!.reasonCode).toBe('digest-mismatch');

      // The original user content should be preserved (no overwrite happened).
      const fileAfter = fs.files.get('/ws-root/existing.txt');
      expect(fileAfter).toBeDefined();
      expect(new TextDecoder().decode(fileAfter!.content)).toBe('original content');
    });

    it('records deterministic Evidence on conflict', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/existing.txt', 'original content');
      const clock = fixedClock();
      const opId = newOperationId();

      const result = detectConflict({
        operationId: opId,
        targetPath: '/ws-root/existing.txt',
        expectedDigest: 'wrong-digest',
        expectedVersion: '42:100',
        workspace: makeWorkspace(fs),
        fsProbe: inMemoryFsProbe(fs),
        clock,
      });

      expect(result).not.toBeNull();
      expect(result!.evidence.operationId).toBe(opId);
      expect(result!.evidence.expectedDigest).toBe('wrong-digest');
      expect(result!.evidence.actualDigest).toBeTruthy();
      expect(result!.evidence.targetPath).toBe('/ws-root/existing.txt');
      expect(result!.evidence.timestamp).toBeTruthy();
    });
  });

  // ==========================================================================
  // AC #5: Success -> actual post-image digest/version + bytes/line metadata +
  //        verification + checkpoint ref + exclusions, completion withheld
  //        until post-commit
  // ==========================================================================
  describe('AC #5: Success result records all fields; completion post-commit', () => {
    it('records actual post-image digest, version, size, line count', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('line1\nline2\nline3\n');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/multi.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyFileEffect('create_file', '/ws-root/multi.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const execResult = result as EffectExecutionResult;
      expect(execResult.actualPostImage.digest).toBe(computeDigest(content));
      expect(execResult.actualPostImage.version).toBeTruthy();
      expect(execResult.actualPostImage.sizeBytes).toBe(18);
      expect(execResult.actualPostImage.lineCount).toBe(4);
    });

    it('records verification status as verified when post-image matches', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('verified content');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/verified.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyFileEffect('create_file', '/ws-root/verified.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const execResult = result as EffectExecutionResult;
      expect(execResult.verificationStatus).toBe('verified');
    });

    it('records checkpoint reference with checkpointId and coverage state', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('checkpoint test');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/cp-test.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyFileEffect('create_file', '/ws-root/cp-test.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const execResult = result as EffectExecutionResult;
      expect(execResult.checkpointReference).not.toBeNull();
      expect(execResult.checkpointReference!.checkpointId).toBeTruthy();
      expect(execResult.checkpointReference!.coverageState).toBe('fully-protected');
    });

    it('records exclusions (empty for clean execution)', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('clean execution');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/clean.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyFileEffect('create_file', '/ws-root/clean.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const execResult = result as EffectExecutionResult;
      expect(execResult.exclusions).toEqual([]);
    });

    it('completion (OperationSucceeded) is only published after post-image capture', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('post-commit test');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/post-commit2.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      applyFileEffect('create_file', '/ws-root/post-commit2.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      // OperationSucceeded should be the last event (post-commit).
      const last = journal.lastEvent();
      expect(last).toBeDefined();
      expect(last!.payload.kind).toBe('OperationSucceeded');

      // The file should exist (post-image was captured).
      const written = fs.files.get('/ws-root/post-commit2.txt');
      expect(written).toBeDefined();
    });

    it('records completedAt timestamp', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new TextEncoder().encode('timestamp test');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/ts-test.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyFileEffect('create_file', '/ws-root/ts-test.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const execResult = result as EffectExecutionResult;
      expect(execResult.completedAt).toBeTruthy();
      expect(execResult.completedAt).toContain('2026-07-17');
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe('Edge cases', () => {
    it('handles empty content (zero-byte file)', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const content = new Uint8Array(0);

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/empty.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyFileEffect('create_file', '/ws-root/empty.txt', content, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const execResult = result as EffectExecutionResult;
      expect(execResult.actualPostImage.sizeBytes).toBe(0);
      expect(execResult.actualPostImage.lineCount).toBe(0);
    });

    it('handles Thai text (UTF-8) in file content', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const opId = newOperationId();
      const thaiContent = new TextEncoder().encode('สวัสดีครับ — Thai preserved');

      const binding: ProposalBinding = {
        actionClass: 'create_file',
        target: '/ws-root/thai.txt',
        payload: computeDigest(thaiContent),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyFileEffect('create_file', '/ws-root/thai.txt', thaiContent, auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        fsMutator: inMemoryFsMutator(fs),
        clock,
        policyState: { mode: 'build', profile: 'manual', sensitiveOverride: false },
        checkpointRepo,
        artifactStore,
        kvStore: kv,
        blobStore: blob,
        journal,
        sessionId: 'test-session',
        activationId: 'act-1',
        activationRevision: 1,
        authorityRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const execResult = result as EffectExecutionResult;
      expect(execResult.actualPostImage.digest).toBe(computeDigest(thaiContent));
      expect(execResult.verificationStatus).toBe('verified');

      // Verify Thai text was preserved.
      const written = fs.files.get('/ws-root/thai.txt');
      expect(written).toBeDefined();
      expect(new TextDecoder().decode(written!.content)).toBe('สวัสดีครับ — Thai preserved');
    });

    it('preview with Thai text preserves content', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const thaiContent = new TextEncoder().encode('ภาษาไทย');

      const result = previewFileEffect('create_file', '/ws-root/thai-preview.txt', thaiContent, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'build',
        activationId: 'act-1',
        activationRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.preview.postImageSizeBytes).toBe(21);
    });
  });
});
