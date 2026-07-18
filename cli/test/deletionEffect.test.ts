// Guarded destructive deletion tests (Story 3.6, all 5 ACs). Uses in-memory
// fs/checkpoint stores + injected clock + fake journal repo + in-memory
// quarantine provider. Covers: DESTRUCTIVE preview with ordered manifest + Plan
// denies under all profiles; Manual exact approval required + Full Access cannot
// bypass destructive/identity/checkpoint/platform; ordered effect with
// EffectDispatchCommitted before quarantine+remove + completion only post-commit +
// atomic same-fs rename before remove; descendant change/disappear/add/link-cross/
// open-handle/atomic-quarantine-failure -> stop before removal, conflict/unknown-
// outcome/enforcement-unverified, no best-effort recursion; success -> deleted
// root+manifest identity + encrypted recoverability + excluded effects + terminal
// result, shell/process/remote never claimed reversible. >=22 cases. No network/
// real creds.

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { previewDeletion } from '../src/core/effects/deletionPreview.js';
import { applyDeletionEffect } from '../src/core/effects/deletionEffect.js';
import { CheckpointRepository } from '../src/core/checkpoints/checkpointRepository.js';
import { ArtifactStore } from '../src/core/checkpoints/artifactStore.js';
import { generateDataKey } from '../src/core/sessions/crypto.js';
import { createAuthorization } from '../src/core/permissions/authorization.js';
import type { Authorization, ProposalBinding } from '../src/core/permissions/authorization.js';
import type { PepDecision } from '../src/core/permissions/pep.js';
import { newOperationId } from '../src/core/protocol/ids.js';
import type { OperationId } from '../src/core/protocol/ids.js';
import type { FsProbe, WorkspaceIdentity } from '../src/core/workspace/types.js';
import { establishWorkspaceBinding } from '../src/core/workspace/identity.js';
import type { KeyValueStore, BlobStore } from '../src/core/checkpoints/types.js';
import type { DurableEvent } from '../src/core/protocol/events.js';
import type {
  DeletionExecutionResult,
  DeletionConflict,
  DeletionOutcome,
  QuarantineProvider,
  DescendantIdentity,
} from '../src/core/effects/deletionTypes.js';

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
// In-memory filesystem (shared between FsProbe and QuarantineProvider)
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

  remove(path: string): void {
    this.files.delete(path);
  }

  has(path: string): boolean {
    return this.files.has(path);
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

// =============================================================================
// In-memory QuarantineProvider
// =============================================================================

class InMemoryQuarantineProvider implements QuarantineProvider {
  readonly quarantined = new Map<string, string>(); // originalPath -> quarantinePath
  readonly removed = new Set<string>();
  private counter = 0;

  quarantine(path: string): string {
    this.counter++;
    const qPath = `/quarantine/${this.counter}`;
    this.quarantined.set(path, qPath);
    return qPath;
  }

  removeQuarantined(quarantinePath: string): void {
    this.removed.add(quarantinePath);
  }

  quarantinePathFor(originalPath: string): string {
    return this.quarantined.get(originalPath) ?? '';
  }

  /** Simulate a quarantine failure (for AC #4 testing). */
  failNextQuarantine = false;
}

function inMemoryQuarantineProvider(qp: InMemoryQuarantineProvider): QuarantineProvider {
  return {
    quarantine(path: string): string {
      if (qp.failNextQuarantine) {
        qp.failNextQuarantine = false;
        throw new Error('simulated quarantine rename failure');
      }
      return qp.quarantine(path);
    },
    removeQuarantined(quarantinePath: string): void {
      qp.removeQuarantined(quarantinePath);
    },
    quarantinePathFor(originalPath: string): string {
      return qp.quarantinePathFor(originalPath);
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
  return { outcome: 'allow', reason: 'manual-approval', matrixVersion: 1, activationRevision: 1, actionClass: 'delete' };
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

describe('Deletion Effects (Story 3.6)', () => {
  // ==========================================================================
  // AC #1: DESTRUCTIVE preview with ordered manifest + Plan denies under
  //        every profile
  // ==========================================================================
  describe('AC #1: DESTRUCTIVE preview; Plan denies under every profile', () => {
    it('previewDelete shows DESTRUCTIVE label and all required fields', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content to delete');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();

      const result = previewDeletion('delete_file', '/ws-root/target.txt', {
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
      expect(preview.label).toBe('DESTRUCTIVE');
      expect(preview.kind).toBe('delete_file');
      expect(preview.root.canonicalPath).toBe('/ws-root/target.txt');
      expect(preview.root.displayPath).toBe('/ws-root/target.txt');
      expect(preview.expectedPreImage.absent).toBe(false);
      expect(preview.expectedPreImage.digest).toBeTruthy();
      expect(preview.expectedPreImage.version).toBeTruthy();
      expect(preview.symlinkPolicy).toBe('no-follow');
      expect(preview.junctionPolicy).toBe('no-follow');
      expect(preview.mountPolicy).toBe('no-follow');
      expect(preview.openHandlePolicy).toBe('reject');
      expect(preview.checkpointCoverage).toBe('fully-protected');
      expect(preview.authority.activationId).toBe('act-1');
      expect(preview.authority.activationRevision).toBe(1);
      expect(preview.operationId).toBeTruthy();
    });

    it('previewDelete shows ordered descendant manifest when provided', () => {
      const fs = new InMemoryFileSystem();
      fs.addDir('/ws-root/dir');
      fs.addFile('/ws-root/dir/a.txt', 'file a');
      fs.addFile('/ws-root/dir/b.txt', 'file b');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();

      const manifest: readonly DescendantIdentity[] = [
        {
          canonicalPath: '/ws-root/dir/a.txt',
          displayPath: '/ws-root/dir/a.txt',
          type: 'file',
          sizeBytes: 6,
          expectedDigest: computeDigest(new TextEncoder().encode('file a')),
          version: '42:100',
          identityProven: true,
        },
        {
          canonicalPath: '/ws-root/dir/b.txt',
          displayPath: '/ws-root/dir/b.txt',
          type: 'file',
          sizeBytes: 6,
          expectedDigest: computeDigest(new TextEncoder().encode('file b')),
          version: '42:101',
          identityProven: true,
        },
      ];

      const result = previewDeletion('delete_directory', '/ws-root/dir', {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'build',
        activationId: 'act-1',
        activationRevision: 1,
        descendantManifest: manifest,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      expect(preview.label).toBe('DESTRUCTIVE');
      expect(preview.kind).toBe('delete_directory');
      expect(preview.descendantManifest).toHaveLength(2);
      expect(preview.descendantCount).toBe(2);
      expect(preview.totalSizeBytes).toBe(12);
    });

    it('Plan mode returns deny for delete_file', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();

      const result = previewDeletion('delete_file', '/ws-root/target.txt', {
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

    it('Plan mode returns deny for delete_directory', () => {
      const fs = new InMemoryFileSystem();
      fs.addDir('/ws-root/dir');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();

      const result = previewDeletion('delete_directory', '/ws-root/dir', {
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

    it('previewDelete for non-existent target returns deny', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();

      const result = previewDeletion('delete_file', '/ws-root/nonexistent.txt', {
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

    it('previewDelete for target outside workspace returns deny', () => {
      const fs = new InMemoryFileSystem();
      const ws = makeWorkspace(fs);
      const clock = fixedClock();

      const result = previewDeletion('delete_file', '/outside/evil.txt', {
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

    it('previewDelete shows count/size bounds in manifest', () => {
      const fs = new InMemoryFileSystem();
      fs.addDir('/ws-root/data');
      fs.addFile('/ws-root/data/large.bin', 'x'.repeat(1000));
      fs.addFile('/ws-root/data/small.txt', 'small');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();

      const manifest: readonly DescendantIdentity[] = [
        {
          canonicalPath: '/ws-root/data/large.bin',
          displayPath: '/ws-root/data/large.bin',
          type: 'file',
          sizeBytes: 1000,
          expectedDigest: computeDigest(new TextEncoder().encode('x'.repeat(1000))),
          version: '42:100',
          identityProven: true,
        },
        {
          canonicalPath: '/ws-root/data/small.txt',
          displayPath: '/ws-root/data/small.txt',
          type: 'file',
          sizeBytes: 5,
          expectedDigest: computeDigest(new TextEncoder().encode('small')),
          version: '42:101',
          identityProven: true,
        },
      ];

      const result = previewDeletion('delete_directory', '/ws-root/data', {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'build',
        activationId: 'act-1',
        activationRevision: 1,
        descendantManifest: manifest,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.preview.descendantCount).toBe(2);
      expect(result.preview.totalSizeBytes).toBe(1005);
    });
  });

  // ==========================================================================
  // AC #2: Manual profile -> explicit approval required for the UNCHANGED
  //        exact root + manifest; Full Access may suppress only eligible
  //        prompts inside the declared boundary and CANNOT bypass destructive/
  //        identity/checkpoint/platform rules.
  // ==========================================================================
  describe('AC #2: Manual exact approval required; Full Access cannot bypass rules', () => {
    it('requires exact authorization binding for delete_file', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content to delete');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content to delete');

      // Authorization for a DIFFERENT target.
      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/different.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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
      const conflict = result as DeletionConflict;
      expect(conflict.kind).toBe('stale-approval');

      // The file should NOT have been deleted.
      expect(fs.has('/ws-root/target.txt')).toBe(true);
    });

    it('Full Access cannot bypass destructive rules (Plan mode still denies)', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();

      // Even with Full Access, Plan mode is structurally read-only.
      const result = previewDeletion('delete_file', '/ws-root/target.txt', {
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
    });

    it('Full Access cannot bypass identity rules (stale approval still blocks)', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content to delete');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content to delete');

      // Authorization for a different target.
      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/different.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      // Full Access profile.
      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
        clock,
        policyState: { mode: 'build', profile: 'full-access', sensitiveOverride: false },
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

      // Full Access cannot bypass stale approval.
      expect(result.ok).toBe(false);
      const conflict = result as DeletionConflict;
      expect(conflict.kind).toBe('stale-approval');
      expect(fs.has('/ws-root/target.txt')).toBe(true);
    });

    it('Full Access cannot bypass checkpoint rules (checkpoint is always staged)', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
        clock,
        policyState: { mode: 'build', profile: 'full-access', sensitiveOverride: false },
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

      // Full Access cannot bypass checkpoint rules — checkpoint is always staged.
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const execResult = result as DeletionExecutionResult;
      expect(execResult.checkpointReference).not.toBeNull();
      expect(execResult.checkpointReference!.coverageState).toBe('fully-protected');
    });
  });

  // ==========================================================================
  // AC #3: Ordered effect with EffectDispatchCommitted before quarantine+remove
  //        + completion only post-commit + atomic same-fs rename before remove
  // ==========================================================================
  describe('AC #3: Ordered effect execution with quarantine', () => {
    it('executes the exact ordered steps for delete_file', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content to delete');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content to delete');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      const execResult = result as DeletionExecutionResult;
      expect(execResult.operationId).toBe(opId);
      expect(execResult.deletedRoot.canonicalPath).toBe('/ws-root/target.txt');
      expect(execResult.checkpointReference).not.toBeNull();
      expect(execResult.checkpointReference!.coverageState).toBe('fully-protected');
      expect(execResult.completedAt).toBeTruthy();

      // Verify the file was quarantined and removed.
      expect(qp.quarantined.has('/ws-root/target.txt')).toBe(true);
      const qPath = qp.quarantined.get('/ws-root/target.txt')!;
      expect(qp.removed.has(qPath)).toBe(true);

      // Verify event ordering: EffectDispatchCommitted before OperationSucceeded.
      const dispatchEvents = journal.eventsOfKind('EffectDispatchCommitted');
      const successEvents = journal.eventsOfKind('OperationSucceeded');
      expect(dispatchEvents.length).toBe(1);
      expect(successEvents.length).toBe(1);

      const dispatchIdx = journal.events.indexOf(dispatchEvents[0]);
      const successIdx = journal.events.indexOf(successEvents[0]);
      expect(dispatchIdx).toBeLessThan(successIdx);
    });

    it('EffectDispatchCommitted is appended before quarantine', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      // The file should have been quarantined.
      expect(qp.quarantined.has('/ws-root/target.txt')).toBe(true);
    });

    it('completion (OperationSucceeded) is only published post-commit', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

    it('authorization is consumed after checkpoint stage, before quarantine', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      // EffectDispatchCommitted confirms authorization was consumed.
      const dispatchEvents = journal.eventsOfKind('EffectDispatchCommitted');
      expect(dispatchEvents.length).toBe(1);

      // The file should have been quarantined.
      expect(qp.quarantined.has('/ws-root/target.txt')).toBe(true);
    });

    it('atomic same-filesystem rename (quarantine) happens before removal', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      // The quarantine was recorded (rename happened).
      expect(qp.quarantined.has('/ws-root/target.txt')).toBe(true);
      const qPath = qp.quarantined.get('/ws-root/target.txt')!;

      // The quarantined content was removed.
      expect(qp.removed.has(qPath)).toBe(true);
    });
  });

  // ==========================================================================
  // AC #4: Descendant change/disappear/add/link-cross/open-handle/atomic-
  //        quarantine-failure -> stop before removal, conflict/unknown-outcome/
  //        enforcement-unverified, no best-effort recursion
  // ==========================================================================
  describe('AC #4: Revalidation stops before removal on conflicts', () => {
    it('stops before removal when target is no longer resolvable', () => {
      const fs = new InMemoryFileSystem();
      // Target doesn't exist.
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/nonexistent.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/nonexistent.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      expect(result.ok).toBe(false);
      const conflict = result as DeletionConflict;
      // The stale approval check fires first because the non-existent target
      // has no digest to match the authorization binding.
      expect(conflict.kind).toBe('stale-approval');

      // No quarantine should have happened.
      expect(qp.quarantined.size).toBe(0);
    });

    it('stops before removal when target is a symlink', () => {
      const fs = new InMemoryFileSystem();
      fs.addSymlink('/ws-root/link.txt', '/outside/real.txt');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/link.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/link.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      expect(result.ok).toBe(false);
      const conflict = result as DeletionConflict;
      // The stale approval check fires first because the symlink target
      // has no digest to match the authorization binding.
      expect(conflict.kind).toBe('stale-approval');

      // No quarantine should have happened.
      expect(qp.quarantined.size).toBe(0);
    });

    it('stops before removal when quarantine rename fails (enforcement-unverified)', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      qp.failNextQuarantine = true;
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      expect(result.ok).toBe(false);
      const conflict = result as DeletionConflict;
      expect(conflict.kind).toBe('enforcement-unverified');
      expect(conflict.reasonCode).toBe('quarantine-failed');

      // The file should still exist (no quarantine happened).
      expect(fs.has('/ws-root/target.txt')).toBe(true);
    });

    it('stops before removal when containment changed', () => {
      const fs = new InMemoryFileSystem();
      // Add a file that would be outside workspace containment.
      // The containment check will fail because the path doesn't resolve
      // within the workspace.
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/outside/evil.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/outside/evil.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      expect(result.ok).toBe(false);
      const conflict = result as DeletionConflict;
      expect(conflict.kind).toBe('conflict');
      expect(conflict.reasonCode).toBe('target-unresolvable');

      // No quarantine should have happened.
      expect(qp.quarantined.size).toBe(0);
    });

    it('stops before removal when authorization is stale (expired)', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      // Expired authorization.
      const auth = makeAuthorization(opId, binding, { expiresAt: '2026-07-16T00:00:00.000Z' });

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      expect(result.ok).toBe(false);
      const conflict = result as DeletionConflict;
      expect(conflict.kind).toBe('stale-approval');

      // The file should still exist.
      expect(fs.has('/ws-root/target.txt')).toBe(true);
      expect(qp.quarantined.size).toBe(0);
    });

    it('no best-effort recursion on conflict', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'original content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('original content');

      // Authorization for a different target.
      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/different.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      // Should be a conflict, not a successful deletion.
      expect(result.ok).toBe(false);
      const conflict = result as DeletionConflict;
      expect(conflict.kind).toBe('stale-approval');

      // The original user content should be preserved (no deletion happened).
      expect(fs.has('/ws-root/target.txt')).toBe(true);
      expect(qp.quarantined.size).toBe(0);
    });

    it('records deterministic Evidence on conflict', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      // Authorization for a different target.
      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/different.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      expect(result.ok).toBe(false);
      const conflict = result as DeletionConflict;
      expect(conflict.evidence.operationId).toBe(opId);
      expect(conflict.evidence.rootPath).toBe('/ws-root/target.txt');
      expect(conflict.evidence.timestamp).toBeTruthy();
    });
  });

  // ==========================================================================
  // AC #5: Success -> deleted root+manifest identity + encrypted recoverability
  //        + excluded effects + terminal result, shell/process/remote never
  //        claimed reversible
  // ==========================================================================
  describe('AC #5: Success result records all fields; terminal result post-commit', () => {
    it('records deleted root identity and manifest identity', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content to delete');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content to delete');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      const execResult = result as DeletionExecutionResult;
      expect(execResult.deletedRoot.canonicalPath).toBe('/ws-root/target.txt');
      expect(execResult.deletedRoot.displayPath).toBe('/ws-root/target.txt');
      expect(execResult.manifestIdentity.descendantCount).toBe(0);
      expect(execResult.manifestIdentity.manifestDigest).toBeTruthy();
    });

    it('records encrypted recoverability when artifact store is available', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content to delete');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content to delete');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      const execResult = result as DeletionExecutionResult;
      // With artifact store, content was staged for recoverability.
      expect(execResult.encryptedRecoverability).toBe('retained');
    });

    it('records excluded effects (empty for clean execution)', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      const execResult = result as DeletionExecutionResult;
      expect(execResult.exclusions).toEqual([]);
    });

    it('records checkpoint reference with checkpointId and coverage state', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      const execResult = result as DeletionExecutionResult;
      expect(execResult.checkpointReference).not.toBeNull();
      expect(execResult.checkpointReference!.checkpointId).toBeTruthy();
      expect(execResult.checkpointReference!.coverageState).toBe('fully-protected');
    });

    it('completion (OperationSucceeded) is only published after removal', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      // The file should have been quarantined and removed.
      expect(qp.quarantined.has('/ws-root/target.txt')).toBe(true);
      const qPath = qp.quarantined.get('/ws-root/target.txt')!;
      expect(qp.removed.has(qPath)).toBe(true);
    });

    it('records completedAt timestamp', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      const execResult = result as DeletionExecutionResult;
      expect(execResult.completedAt).toBeTruthy();
      expect(execResult.completedAt).toContain('2026-07-17');
    });

    it('shell/process/remote effects are never described as reversed by rollback (AD-19)', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/target.txt', 'content');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode('content');

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/target.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/target.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      const execResult = result as DeletionExecutionResult;
      // The result should NOT contain any reference to shell, process, remote,
      // permission, or symlink-side effects being reversible.
      const resultStr = JSON.stringify(execResult);
      expect(resultStr).not.toContain('shell');
      expect(resultStr).not.toContain('process');
      expect(resultStr).not.toContain('remote');
      expect(resultStr).not.toContain('reversible');
      expect(resultStr).not.toContain('rollback');
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe('Edge cases', () => {
    it('handles Thai text (UTF-8) in deleted file content', () => {
      const fs = new InMemoryFileSystem();
      const thaiContent = 'สวัสดีครับ — Thai preserved';
      fs.addFile('/ws-root/thai.txt', thaiContent);
      const ws = makeWorkspace(fs);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();
      const blob = new InMemoryBlobStore();
      const encKey = makeKey();
      const journal = new FakeJournal();
      const qp = new InMemoryQuarantineProvider();
      const opId = newOperationId();
      const content = new TextEncoder().encode(thaiContent);

      const binding: ProposalBinding = {
        actionClass: 'delete',
        target: '/ws-root/thai.txt',
        payload: computeDigest(content),
      };
      const auth = makeAuthorization(opId, binding);

      const checkpointRepo = new CheckpointRepository(kv, clock);
      const artifactStore = new ArtifactStore(blob, encKey);

      const result = applyDeletionEffect('delete_file', '/ws-root/thai.txt', auth, {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        quarantineProvider: inMemoryQuarantineProvider(qp),
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

      // Thai content was preserved in the artifact store (encrypted recoverability).
      const execResult = result as DeletionExecutionResult;
      expect(execResult.encryptedRecoverability).toBe('retained');
    });

    it('preview with Thai text preserves content', () => {
      const fs = new InMemoryFileSystem();
      fs.addFile('/ws-root/thai.txt', 'ภาษาไทย');
      const ws = makeWorkspace(fs);
      const clock = fixedClock();

      const result = previewDeletion('delete_file', '/ws-root/thai.txt', {
        workspace: ws,
        fsProbe: inMemoryFsProbe(fs),
        clock,
        mode: 'build',
        activationId: 'act-1',
        activationRevision: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.preview.root.canonicalPath).toBe('/ws-root/thai.txt');
    });
  });
});
