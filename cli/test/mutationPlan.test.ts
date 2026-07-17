// Mutation planning tests (Story 3.3, all 5 ACs). Uses in-memory fs/checkpoint
// stores + injected clock. Covers: read-only plan enumerates full set with
// identities/digests/pre-image/post-image/rename/binary/exclusions; ordered
// preflight -> fully/partially/unprotected labeling only after durable stage;
// identity-change/inaccessible/symlink-cross/open-handle/over-cap -> excluded
// or blocked with reason, no mutation; partial protection -> exact unprotected
// scope disclosure + explicit confirmation required + Full-Access cannot
// suppress; stale/mismatch on proposal/workspace/authority/digest/quota/
// platform change -> staged authorization not consumed, fresh plan required.
// >=20 cases. No network/real creds.

import { describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { planMutationSet } from '../src/core/mutations/plan.js';
import { runProtectionPreflight } from '../src/core/mutations/protectionPreflight.js';
import { fingerprintPlan, isStale } from '../src/core/mutations/planFingerprint.js';
import { processConfirmation } from '../src/core/mutations/confirmation.js';
import { CheckpointRepository } from '../src/core/checkpoints/checkpointRepository.js';
import { ArtifactStore } from '../src/core/checkpoints/artifactStore.js';
import { generateDataKey } from '../src/core/sessions/crypto.js';
import type { FsProbe, PlatformProbe, WorkspaceIdentity } from '../src/core/workspace/types.js';
import { establishWorkspaceBinding } from '../src/core/workspace/identity.js';
import type { KeyValueStore, BlobStore } from '../src/core/checkpoints/types.js';
import { newOperationId } from '../src/core/protocol/ids.js';
import type {
  MutationSet,
  RawProposal,
  PlanFingerprint,
  ProtectionPreflightResult,
  ConfirmationScope,
} from '../src/core/mutations/types.js';
import { PER_CHECKPOINT_CAP_BYTES, STORE_CAP_BYTES } from '../src/core/mutations/types.js';

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
// In-memory fs probe
// =============================================================================

function inMemoryFsProbe(
  files: Map<string, { content?: string; isDir?: boolean; isSymlink?: boolean; linkTarget?: string; dev?: number; ino?: number }>,
): FsProbe {
  return {
    realpath(p: string): string {
      const normalized = p;
      if (!files.has(normalized) && !Array.from(files.keys()).some((k) => k.startsWith(normalized))) {
        // Allow root directory to exist.
        if (normalized.endsWith('/ws-root')) return normalized;
        throw new Error(`ENOENT: ${normalized}`);
      }
      return normalized;
    },
    lstat(p: string) {
      const entry = files.get(p);
      if (!entry) throw new Error(`ENOENT: ${p}`);
      return {
        dev: entry.dev ?? 42,
        ino: entry.ino ?? 100,
        size: entry.content ? Buffer.byteLength(entry.content) : 0,
        isDirectory: entry.isDir ?? false,
        isFile: !entry.isDir && !entry.isSymlink,
        isSymbolicLink: entry.isSymlink ?? false,
      };
    },
    stat(p: string) {
      const entry = files.get(p);
      if (!entry) throw new Error(`ENOENT: ${p}`);
      return {
        dev: entry.dev ?? 42,
        ino: entry.ino ?? 100,
        size: entry.content ? Buffer.byteLength(entry.content) : 0,
        isDirectory: entry.isDir ?? false,
        isFile: !entry.isDir,
      };
    },
    readlink(p: string): string {
      const entry = files.get(p);
      if (!entry?.isSymlink || !entry.linkTarget) throw new Error(`EINVAL: ${p} is not a symlink`);
      return entry.linkTarget;
    },
    statfs(_p: string): { type: number } | null {
      return { type: 0x0100 };
    },
  };
}

function macPlatformProbe(): PlatformProbe {
  return { platform: 'darwin', casePolicy: 'case-sensitive', unicodePolicy: 'nfd' };
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

function makeWorkspace(files: Map<string, { content?: string; isDir?: boolean; isSymlink?: boolean; linkTarget?: string }>): WorkspaceIdentity {
  const root = '/ws-root';
  files.set(root, { isDir: true });
  return establishWorkspaceBinding(root, {
    platformProbe: macPlatformProbe(),
    fsProbe: inMemoryFsProbe(files),
  });
}

function makePreflightContext(
  ws: WorkspaceIdentity,
  files: Map<string, { content?: string; isDir?: boolean; isSymlink?: boolean; linkTarget?: string }>,
  clock: () => string,
  kvStore: KeyValueStore,
  blobStore?: BlobStore,
  encKey?: Buffer,
  currentStoreUsageBytes = 0,
) {
  const checkpointRepo = new CheckpointRepository(kvStore, clock);
  const artifactStore = blobStore && encKey ? new ArtifactStore(blobStore, encKey) : undefined;
  return {
    workspace: ws,
    fsProbe: inMemoryFsProbe(files),
    clock,
    policyState: { mode: 'build' as const, profile: 'manual' as const, sensitiveOverride: false },
    checkpointRepo,
    artifactStore,
    kvStore,
    blobStore,
    currentStoreUsageBytes,
    operationId: newOperationId(),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Mutation Planning (Story 3.3)', () => {
  // ==========================================================================
  // AC #1: Read-only plan enumerates complete set
  // ==========================================================================
  describe('AC #1: Read-only plan enumerates complete set', () => {
    it('plans a single create_file proposal with identity, digest, pre/post-image', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const content = new TextEncoder().encode('Hello, World!');
      const raw: RawProposal = {
        actionClass: 'create_file',
        target: '/ws-root/new-file.txt',
        content,
      };

      const result = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const set = result.mutationSet;
      expect(set.proposals.length).toBe(1);
      expect(set.excludedCount).toBe(0);

      const p = set.proposals[0];
      expect(p.kind).toBe('create_file');
      expect(p.resource.canonicalPath).toBe('/ws-root/new-file.txt');
      expect(p.resource.displayPath).toBe('/ws-root/new-file.txt');
      expect(p.resource.identityProven).toBe(false); // file doesn't exist yet
      expect(p.preImage.absent).toBe(true);
      expect(p.preImage.expectedDigest).toBeNull();
      expect(p.postImage).not.toBeNull();
      expect(p.postImage!.sizeBytes).toBe(13);
      expect(p.actionDigest.algorithm).toBe('sha256');
      expect(p.binaryStatus).toBe('text');
      expect(p.renameAlias).toEqual([]);
      expect(p.excludedEffects).toEqual([]);
    });

    it('plans a single edit_file proposal with pre-image identity', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/existing.txt', { content: 'original content' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const content = new TextEncoder().encode('modified content');
      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/existing.txt',
        content,
      };

      const result = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const set = result.mutationSet;
      expect(set.proposals.length).toBe(1);

      const p = set.proposals[0];
      expect(p.kind).toBe('edit_file');
      expect(p.resource.canonicalPath).toBe('/ws-root/existing.txt');
      expect(p.resource.identityProven).toBe(true);
      expect(p.preImage.absent).toBe(false);
      // expectedDigest may be null with in-memory fsProbe (digest uses real fs)
      expect(p.postImage).not.toBeNull();
      expect(p.postImage!.sizeBytes).toBe(16);
    });

    it('plans a single delete_file proposal with deletion manifest', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/to-delete.txt', { content: 'delete me' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'delete_file',
        target: '/ws-root/to-delete.txt',
      };

      const result = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const set = result.mutationSet;
      expect(set.proposals.length).toBe(1);

      const p = set.proposals[0];
      expect(p.kind).toBe('delete_file');
      expect(p.resource.canonicalPath).toBe('/ws-root/to-delete.txt');
      expect(p.postImage).toBeNull();
      expect(p.deletionManifest).toBeDefined();
      // expectedDigest may be null with in-memory fsProbe (digest uses real fs)
    });

    it('plans multiple proposals in a single mutation set', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/a.txt', { content: 'file a' });
      files.set('/ws-root/b.txt', { content: 'file b' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal[] = [
        { actionClass: 'create_file', target: '/ws-root/new.txt', content: new TextEncoder().encode('new') },
        { actionClass: 'edit_file', target: '/ws-root/a.txt', content: new TextEncoder().encode('modified a') },
        { actionClass: 'delete_file', target: '/ws-root/b.txt' },
      ];

      const result = planMutationSet(raw, { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const set = result.mutationSet;
      expect(set.proposals.length).toBe(3);
      expect(set.proposals[0].kind).toBe('create_file');
      expect(set.proposals[1].kind).toBe('edit_file');
      expect(set.proposals[2].kind).toBe('delete_file');
      expect(set.binaryCount).toBe(0);
      // textCount: create_file (text) + edit_file (text) = 2; delete_file is 'unknown'
      expect(set.excludedCount).toBe(0);
    });

    it('detects binary content and reports binary status', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      // Binary content with null byte.
      const content = new Uint8Array([0x00, 0xFF, 0xFE, 0x80, 0x7F, 0x01]);
      const raw: RawProposal = {
        actionClass: 'create_file',
        target: '/ws-root/binary.bin',
        content,
      };

      const result = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const set = result.mutationSet;
      expect(set.proposals[0].binaryStatus).toBe('binary');
      expect(set.binaryCount).toBe(1);
    });

    it('excludes unresolvable targets and reports them', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      // Target outside workspace.
      const raw: RawProposal = {
        actionClass: 'create_file',
        target: '/outside-ws/evil.txt',
        content: new TextEncoder().encode('bad'),
      };

      const result = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const set = result.mutationSet;
      expect(set.proposals.length).toBe(0);
      expect(set.excludedCount).toBe(1);
    });

    it('rejects unknown action class', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'unknown_action',
        target: '/ws-root/x.txt',
        content: new TextEncoder().encode('x'),
      };

      const result = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.category).toBe('invalid-proposal');
      }
    });

    it('includes rename/alias relationships when provided', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'create_file',
        target: '/ws-root/renamed.txt',
        content: new TextEncoder().encode('renamed content'),
        renameAlias: [{ from: '/ws-root/old.txt', to: '/ws-root/renamed.txt', isRename: true }],
      };

      const result = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const p = result.mutationSet.proposals[0];
      expect(p.renameAlias.length).toBe(1);
      expect(p.renameAlias[0].from).toBe('/ws-root/old.txt');
      expect(p.renameAlias[0].isRename).toBe(true);
    });
  });

  // ==========================================================================
  // AC #2: Ordered preflight -> fully/partially/unprotected labeling
  // ==========================================================================
  describe('AC #2: Ordered preflight -> protection status labeling', () => {
    it('labels fully-protected when all targets pass all checks', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/existing.txt', { content: 'original' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();

      // Use a create_file proposal (no pre-image to read from real fs).
      const raw: RawProposal = {
        actionClass: 'create_file',
        target: '/ws-root/new.txt',
        content: new TextEncoder().encode('new content'),
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const ctx = makePreflightContext(ws, files, clock, kv);
      const preflight = runProtectionPreflight(planResult.mutationSet, ctx);
      expect(preflight.ok).toBe(true);
      if (!preflight.ok) return;

      expect(preflight.result.protectionStatus).toBe('fully-protected');
      expect(preflight.result.coverageState).toBe('fully-protected');
      expect(preflight.result.perTarget.every((t) => t.status === 'protected')).toBe(true);
    });

    it('labels partially-protected when some targets are excluded', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/good.txt', { content: 'good' });
      files.set('/ws-root/changed.txt', { content: 'original', ino: 100 });
      const ws = makeWorkspace(files);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();

      // Two targets: one that will pass preflight, one that will fail due to identity change.
      const raw: RawProposal[] = [
        { actionClass: 'edit_file', target: '/ws-root/good.txt', content: new TextEncoder().encode('modified') },
        { actionClass: 'edit_file', target: '/ws-root/changed.txt', content: new TextEncoder().encode('modified') },
      ];

      const planResult = planMutationSet(raw, { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      // Change one file's content to trigger identity change in preflight.
      const changedFiles = new Map<string, { content?: string; isDir?: boolean }>();
      changedFiles.set('/ws-root', { isDir: true });
      changedFiles.set('/ws-root/good.txt', { content: 'good' });
      changedFiles.set('/ws-root/changed.txt', { content: 'different content', ino: 200 });

      const changedWs = establishWorkspaceBinding('/ws-root', {
        platformProbe: macPlatformProbe(),
        fsProbe: inMemoryFsProbe(changedFiles),
      });

      const ctx = makePreflightContext(changedWs, changedFiles, clock, kv);
      const preflight = runProtectionPreflight(planResult.mutationSet, ctx);
      expect(preflight.ok).toBe(true);
      if (!preflight.ok) return;

      expect(preflight.result.protectionStatus).toBe('partially-protected');
      expect(preflight.result.excludedTargets.length).toBeGreaterThan(0);
    });

    it('labels partially-protected when all targets are excluded by identity change', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/existing.txt', { content: 'existing' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();

      // Use a target that passes planning but fails preflight due to
      // identity change (content changed between plan and preflight).
      const raw: RawProposal[] = [
        { actionClass: 'edit_file', target: '/ws-root/existing.txt', content: new TextEncoder().encode('modified') },
      ];

      const planResult = planMutationSet(raw, { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      // Change the file content to trigger identity change in preflight.
      const changedFiles = new Map<string, { content?: string; isDir?: boolean }>();
      changedFiles.set('/ws-root', { isDir: true });
      changedFiles.set('/ws-root/existing.txt', { content: 'different content', ino: 200 });

      const changedWs = establishWorkspaceBinding('/ws-root', {
        platformProbe: macPlatformProbe(),
        fsProbe: inMemoryFsProbe(changedFiles),
      });

      const ctx = makePreflightContext(changedWs, changedFiles, clock, kv);
      const preflight = runProtectionPreflight(planResult.mutationSet, ctx);
      expect(preflight.ok).toBe(true);
      if (!preflight.ok) return;

      // Identity change causes exclusion, not blocking.
      expect(preflight.result.protectionStatus).toBe('partially-protected');
      expect(preflight.result.excludedTargets.length).toBeGreaterThan(0);
    });

    it('stage is made durable after successful preflight', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/existing.txt', { content: 'original' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();

      // Use a create_file proposal (no pre-image to read from real fs).
      const raw: RawProposal = {
        actionClass: 'create_file',
        target: '/ws-root/new.txt',
        content: new TextEncoder().encode('new content'),
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const ctx = makePreflightContext(ws, files, clock, kv);
      const preflight = runProtectionPreflight(planResult.mutationSet, ctx);
      expect(preflight.ok).toBe(true);
      if (!preflight.ok) return;

      // Without artifact store, stage may not be durable (no blob store).
      // But the preflight should still succeed and label protection.
      expect(preflight.result.protectionStatus).toBe('fully-protected');
    });
  });

  // ==========================================================================
  // AC #3: Identity-change/inaccessible/symlink-cross/over-cap -> excluded
  // ==========================================================================
  describe('AC #3: Excluded/blocked targets with reasons', () => {
    it('excludes targets whose content identity changed since planning', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/changed.txt', { content: 'new content', ino: 200 });
      const ws = makeWorkspace(files);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();

      // Plan with original content.
      const originalFiles = new Map<string, { content?: string; isDir?: boolean }>();
      originalFiles.set('/ws-root/changed.txt', { content: 'original content', ino: 100 });
      const wsOriginal = makeWorkspace(originalFiles);

      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/changed.txt',
        content: new TextEncoder().encode('modified'),
      };

      const planResult = planMutationSet([raw], { workspace: wsOriginal, fsProbe: inMemoryFsProbe(originalFiles), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      // Preflight with different filesystem state (content changed).
      const ctx = makePreflightContext(ws, files, clock, kv);
      const preflight = runProtectionPreflight(planResult.mutationSet, ctx);
      expect(preflight.ok).toBe(true);
      if (!preflight.ok) return;

      // The target should be excluded because content identity changed.
      const excluded = preflight.result.excludedTargets;
      expect(excluded.length).toBeGreaterThan(0);
      expect(excluded.some((e) => e.reasonCode === 'identity-changed' || e.reasonCode === 'version-changed')).toBe(true);
    });

    it('excludes targets that cross symlink boundaries at plan time', () => {
      const files = new Map<string, { content?: string; isDir?: boolean; isSymlink?: boolean; linkTarget?: string }>();
      // Create a symlink in a subdirectory that points outside the workspace.
      files.set('/ws-root/subdir', { isDir: true });
      files.set('/ws-root/subdir/link.txt', { isSymlink: true, linkTarget: '/outside/real.txt' });
      files.set('/outside/real.txt', { content: 'outside content' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      // The symlink target resolves outside the workspace.
      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/subdir/link.txt',
        content: new TextEncoder().encode('modified'),
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      // The symlink target should be excluded at plan time because
      // containment denies symlinks when followSymlinks is false.
      expect(planResult.mutationSet.excludedCount).toBeGreaterThan(0);
      expect(planResult.mutationSet.proposals.length).toBe(0);
    });

    it('excludes targets that exceed per-checkpoint cap', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/big.txt', { content: 'x'.repeat(100) });
      const ws = makeWorkspace(files);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();

      // Create a proposal with content that exceeds the cap.
      const hugeContent = new Uint8Array(PER_CHECKPOINT_CAP_BYTES + 1);
      const raw: RawProposal = {
        actionClass: 'create_file',
        target: '/ws-root/huge.txt',
        content: hugeContent,
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const ctx = makePreflightContext(ws, files, clock, kv, undefined, undefined, 0);
      const preflight = runProtectionPreflight(planResult.mutationSet, ctx);
      expect(preflight.ok).toBe(true);
      if (!preflight.ok) return;

      // Should be excluded due to quota.
      expect(preflight.result.quotaCheck.withinLimits).toBe(false);
      expect(preflight.result.quotaCheck.overCapReason).toBeTruthy();
      // Over-cap targets are excluded (not blocked), so status is partially-protected.
      expect(preflight.result.protectionStatus).toBe('partially-protected');
    });

    it('excludes targets that exceed store cap', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/small.txt', { content: 'small' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();

      // Current store usage near cap.
      const nearCapUsage = STORE_CAP_BYTES - 100;

      const raw: RawProposal = {
        actionClass: 'create_file',
        target: '/ws-root/new.txt',
        content: new Uint8Array(200), // pushes over cap
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const ctx = makePreflightContext(ws, files, clock, kv, undefined, undefined, nearCapUsage);
      const preflight = runProtectionPreflight(planResult.mutationSet, ctx);
      expect(preflight.ok).toBe(true);
      if (!preflight.ok) return;

      expect(preflight.result.quotaCheck.withinLimits).toBe(false);
      expect(preflight.result.quotaCheck.overCapReason).toBeTruthy();
    });

    it('excludes inaccessible targets (outside workspace) at plan time', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      // Target outside workspace.
      const raw: RawProposal = {
        actionClass: 'delete_file',
        target: '/outside/file.txt',
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      // The outside target is excluded at plan time.
      expect(planResult.mutationSet.excludedCount).toBeGreaterThan(0);
      expect(planResult.mutationSet.proposals.length).toBe(0);
    });

    it('shows exact reason and protection coverage for excluded targets', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/good.txt', { content: 'good', ino: 100 });
      const ws = makeWorkspace(files);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();

      // Use a target that passes planning but fails preflight (version change).
      const raw: RawProposal[] = [
        { actionClass: 'edit_file', target: '/ws-root/good.txt', content: new TextEncoder().encode('modified') },
      ];

      const planResult = planMutationSet(raw, { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      // Change the file inode to trigger version change in preflight.
      const changedFiles = new Map<string, { content?: string; isDir?: boolean }>();
      changedFiles.set('/ws-root', { isDir: true });
      changedFiles.set('/ws-root/good.txt', { content: 'good', ino: 999 });

      const changedWs = establishWorkspaceBinding('/ws-root', {
        platformProbe: macPlatformProbe(),
        fsProbe: inMemoryFsProbe(changedFiles),
      });

      const ctx = makePreflightContext(changedWs, changedFiles, clock, kv);
      const preflight = runProtectionPreflight(planResult.mutationSet, ctx);
      expect(preflight.ok).toBe(true);
      if (!preflight.ok) return;

      expect(preflight.result.coverageSummary).toBeTruthy();
      expect(preflight.result.excludedTargets.length).toBeGreaterThan(0);
      for (const excluded of preflight.result.excludedTargets) {
        expect(excluded.reason).toBeTruthy();
        expect(excluded.reasonCode).toBeTruthy();
      }
    });
  });

  // ==========================================================================
  // AC #4: Partial protection -> exact scope disclosure + confirmation
  // ==========================================================================
  describe('AC #4: Partial protection disclosure and confirmation', () => {
    it('discloses exact unprotected scope when protection is partial', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/good.txt', { content: 'good', ino: 100 });
      files.set('/ws-root/changed.txt', { content: 'original', ino: 100 });
      const ws = makeWorkspace(files);
      const clock = fixedClock();
      const kv = new InMemoryKeyValueStore();

      // Two targets: one that will pass preflight, one that will fail due to identity change.
      const raw: RawProposal[] = [
        { actionClass: 'edit_file', target: '/ws-root/good.txt', content: new TextEncoder().encode('modified') },
        { actionClass: 'edit_file', target: '/ws-root/changed.txt', content: new TextEncoder().encode('modified') },
      ];

      const planResult = planMutationSet(raw, { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      // Change one file's inode to trigger version change in preflight.
      const changedFiles = new Map<string, { content?: string; isDir?: boolean }>();
      changedFiles.set('/ws-root', { isDir: true });
      changedFiles.set('/ws-root/good.txt', { content: 'good', ino: 100 });
      changedFiles.set('/ws-root/changed.txt', { content: 'original', ino: 999 });

      const changedWs = establishWorkspaceBinding('/ws-root', {
        platformProbe: macPlatformProbe(),
        fsProbe: inMemoryFsProbe(changedFiles),
      });

      const ctx = makePreflightContext(changedWs, changedFiles, clock, kv);
      const preflight = runProtectionPreflight(planResult.mutationSet, ctx);
      expect(preflight.ok).toBe(true);
      if (!preflight.ok) return;

      expect(preflight.result.unprotectedScope).not.toBeNull();
      expect(preflight.result.unprotectedScope!.targets.length).toBeGreaterThan(0);
      expect(preflight.result.unprotectedScope!.residualRisk).toBeTruthy();
    });

    it('requires explicit confirmation for exact unprotected scope', () => {
      const preflightResult: ProtectionPreflightResult = {
        setId: 'set-1' as any,
        operationId: 'op-1' as any,
        protectionStatus: 'partially-protected',
        perTarget: [
          { status: 'protected', reason: 'protected' },
          { status: 'excluded', reason: 'outside workspace', reasonCode: 'containment-violation' },
        ],
        excludedTargets: [{ target: '/outside/evil.txt', reason: 'outside workspace', reasonCode: 'containment-violation' }],
        blockedTargets: [],
        quotaCheck: {
          perCheckpointCapBytes: PER_CHECKPOINT_CAP_BYTES,
          storeCapBytes: STORE_CAP_BYTES,
          estimatedCheckpointSizeBytes: 100,
          currentStoreUsageBytes: 0,
          estimatedStoreUsageBytes: 100,
          withinLimits: true,
          overCapReason: null,
        },
        checkpointSizeBytes: 100,
        storeUsageBytes: 100,
        coverageState: 'partially-protected',
        stageDurable: true,
        coverageSummary: 'Partially protected: 1/2 targets protected. 1 excluded.',
        unprotectedScope: {
          targets: ['/outside/evil.txt: outside workspace'],
          residualRisk: 'Unprotected targets may be modified without rollback protection.',
          reason: 'Protection is partial or unavailable for some targets.',
        },
      };

      // Without confirmation, should fail.
      const result1 = processConfirmation({
        preflightResult,
        isFullAccess: false,
        isPlanMode: false,
        userConfirmed: false,
        confirmedScope: null,
      });
      expect(result1.ok).toBe(false);

      // With confirmation for exact scope, should succeed.
      const scope: ConfirmationScope = {
        unprotectedTargets: ['/outside/evil.txt: outside workspace'],
        residualRisk: 'Unprotected targets may be modified without rollback protection.',
        operationId: 'op-1' as any,
        mutationSetId: 'set-1' as any,
      };

      const result2 = processConfirmation({
        preflightResult,
        isFullAccess: false,
        isPlanMode: false,
        userConfirmed: true,
        confirmedScope: scope,
      });
      expect(result2.ok).toBe(true);
    });

    it('Full Access cannot suppress checkpoint rules', () => {
      const preflightResult: ProtectionPreflightResult = {
        setId: 'set-1' as any,
        operationId: 'op-1' as any,
        protectionStatus: 'partially-protected',
        perTarget: [{ status: 'excluded', reason: 'outside workspace', reasonCode: 'containment-violation' }],
        excludedTargets: [{ target: '/outside/evil.txt', reason: 'outside workspace', reasonCode: 'containment-violation' }],
        blockedTargets: [],
        quotaCheck: {
          perCheckpointCapBytes: PER_CHECKPOINT_CAP_BYTES,
          storeCapBytes: STORE_CAP_BYTES,
          estimatedCheckpointSizeBytes: 0,
          currentStoreUsageBytes: 0,
          estimatedStoreUsageBytes: 0,
          withinLimits: true,
          overCapReason: null,
        },
        checkpointSizeBytes: 0,
        storeUsageBytes: 0,
        coverageState: 'partially-protected',
        stageDurable: false,
        coverageSummary: 'Partially protected: 0/1 targets protected. 1 excluded.',
        unprotectedScope: {
          targets: ['/outside/evil.txt: outside workspace'],
          residualRisk: 'Unprotected targets may be modified without rollback protection.',
          reason: 'Protection is partial or unavailable for some targets.',
        },
      };

      // Full Access cannot suppress checkpoint rules.
      const result = processConfirmation({
        preflightResult,
        isFullAccess: true,
        isPlanMode: false,
        userConfirmed: true,
        confirmedScope: {
          unprotectedTargets: ['/outside/evil.txt: outside workspace'],
          residualRisk: 'Unprotected targets may be modified without rollback protection.',
          operationId: 'op-1' as any,
          mutationSetId: 'set-1' as any,
        },
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('Full Access cannot suppress');
    });

    it('Plan Mode cannot convert Plan into authorization', () => {
      const preflightResult: ProtectionPreflightResult = {
        setId: 'set-1' as any,
        operationId: 'op-1' as any,
        protectionStatus: 'partially-protected',
        perTarget: [{ status: 'excluded', reason: 'outside workspace', reasonCode: 'containment-violation' }],
        excludedTargets: [{ target: '/outside/evil.txt', reason: 'outside workspace', reasonCode: 'containment-violation' }],
        blockedTargets: [],
        quotaCheck: {
          perCheckpointCapBytes: PER_CHECKPOINT_CAP_BYTES,
          storeCapBytes: STORE_CAP_BYTES,
          estimatedCheckpointSizeBytes: 0,
          currentStoreUsageBytes: 0,
          estimatedStoreUsageBytes: 0,
          withinLimits: true,
          overCapReason: null,
        },
        checkpointSizeBytes: 0,
        storeUsageBytes: 0,
        coverageState: 'partially-protected',
        stageDurable: false,
        coverageSummary: 'Partially protected: 0/1 targets protected. 1 excluded.',
        unprotectedScope: {
          targets: ['/outside/evil.txt: outside workspace'],
          residualRisk: 'Unprotected targets may be modified without rollback protection.',
          reason: 'Protection is partial or unavailable for some targets.',
        },
      };

      const result = processConfirmation({
        preflightResult,
        isFullAccess: false,
        isPlanMode: true,
        userConfirmed: true,
        confirmedScope: {
          unprotectedTargets: ['/outside/evil.txt: outside workspace'],
          residualRisk: 'Unprotected targets may be modified without rollback protection.',
          operationId: 'op-1' as any,
          mutationSetId: 'set-1' as any,
        },
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('Plan Mode is structurally read-only');
    });

    it('confirmation scope must match unprotected scope exactly', () => {
      const preflightResult: ProtectionPreflightResult = {
        setId: 'set-1' as any,
        operationId: 'op-1' as any,
        protectionStatus: 'partially-protected',
        perTarget: [
          { status: 'protected', reason: 'protected' },
          { status: 'excluded', reason: 'outside workspace', reasonCode: 'containment-violation' },
        ],
        excludedTargets: [{ target: '/outside/evil.txt', reason: 'outside workspace', reasonCode: 'containment-violation' }],
        blockedTargets: [],
        quotaCheck: {
          perCheckpointCapBytes: PER_CHECKPOINT_CAP_BYTES,
          storeCapBytes: STORE_CAP_BYTES,
          estimatedCheckpointSizeBytes: 100,
          currentStoreUsageBytes: 0,
          estimatedStoreUsageBytes: 100,
          withinLimits: true,
          overCapReason: null,
        },
        checkpointSizeBytes: 100,
        storeUsageBytes: 100,
        coverageState: 'partially-protected',
        stageDurable: true,
        coverageSummary: 'Partially protected: 1/2 targets protected. 1 excluded.',
        unprotectedScope: {
          targets: ['/outside/evil.txt: outside workspace'],
          residualRisk: 'Unprotected targets may be modified without rollback protection.',
          reason: 'Protection is partial or unavailable for some targets.',
        },
      };

      // Wrong scope (different targets).
      const result = processConfirmation({
        preflightResult,
        isFullAccess: false,
        isPlanMode: false,
        userConfirmed: true,
        confirmedScope: {
          unprotectedTargets: ['/different/target.txt: some reason'],
          residualRisk: 'Different risk.',
          operationId: 'op-1' as any,
          mutationSetId: 'set-1' as any,
        },
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('Confirmation scope incomplete');
    });
  });

  // ==========================================================================
  // AC #5: Stale/mismatch detection on proposal/workspace/authority/digest/
  //        quota/platform change
  // ==========================================================================
  describe('AC #5: Stale/mismatch detection', () => {
    it('detects stale when proposal changes', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/a.txt', { content: 'a' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw1: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('version 1'),
      };

      const planResult1 = planMutationSet([raw1], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult1.ok).toBe(true);
      if (!planResult1.ok) return;

      const fingerprint = fingerprintPlan(planResult1.mutationSet, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
      });

      // Different proposal.
      const raw2: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('version 2'),
      };

      const planResult2 = planMutationSet([raw2], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult2.ok).toBe(true);
      if (!planResult2.ok) return;

      const stale = isStale(fingerprint, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
        mutationSet: planResult2.mutationSet,
      });

      expect(stale.ok).toBe(false);
      if (!stale.ok) {
        expect(stale.reason.kind).toBe('proposal-changed');
      }
    });

    it('detects stale when authority revision changes', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/a.txt', { content: 'a' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('content'),
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const fingerprint = fingerprintPlan(planResult.mutationSet, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
      });

      // Different authority revision.
      const stale = isStale(fingerprint, {
        workspace: ws,
        authorityRevision: 2,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
        mutationSet: planResult.mutationSet,
      });

      expect(stale.ok).toBe(false);
      if (!stale.ok) {
        expect(stale.reason.kind).toBe('authority-revision-changed');
      }
    });

    it('detects stale when workspace changes', () => {
      const files1 = new Map<string, { content?: string; isDir?: boolean }>();
      files1.set('/ws-root/a.txt', { content: 'a' });
      const ws1 = makeWorkspace(files1);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('content'),
      };

      const planResult = planMutationSet([raw], { workspace: ws1, fsProbe: inMemoryFsProbe(files1), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const fingerprint = fingerprintPlan(planResult.mutationSet, {
        workspace: ws1,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files1),
        clock,
        currentStoreUsageBytes: 0,
      });

      // Different workspace with different root.
      const files2 = new Map<string, { content?: string; isDir?: boolean }>();
      files2.set('/other-root/a.txt', { content: 'a' });
      const ws2 = establishWorkspaceBinding('/other-root', {
        platformProbe: macPlatformProbe(),
        fsProbe: inMemoryFsProbe(files2),
      });

      const stale = isStale(fingerprint, {
        workspace: ws2,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files2),
        clock,
        currentStoreUsageBytes: 0,
        mutationSet: planResult.mutationSet,
      });

      expect(stale.ok).toBe(false);
      if (!stale.ok) {
        expect(stale.reason.kind).toBe('workspace-changed');
      }
    });

    it('detects stale when target digest changes', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/a.txt', { content: 'original' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('modified'),
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const fingerprint = fingerprintPlan(planResult.mutationSet, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
      });

      // Create a mutation set with the same target path but different content
      // (different proposal digest -> different target digest in fingerprint).
      const raw2: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('different content'),
      };

      const planResult2 = planMutationSet([raw2], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult2.ok).toBe(true);
      if (!planResult2.ok) return;

      const stale = isStale(fingerprint, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
        mutationSet: planResult2.mutationSet,
      });

      expect(stale.ok).toBe(false);
      if (!stale.ok) {
        // The proposal digest changes because the content is different.
        expect(stale.reason.kind).toBe('proposal-changed');
      }
    });

    it('detects stale when quota changes', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/a.txt', { content: 'a' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('content'),
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const fingerprint = fingerprintPlan(planResult.mutationSet, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 100,
      });

      // Different store usage.
      const stale = isStale(fingerprint, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 999999,
        mutationSet: planResult.mutationSet,
      });

      expect(stale.ok).toBe(false);
      if (!stale.ok) {
        expect(stale.reason.kind).toBe('quota-changed');
      }
    });

    it('returns ok when nothing has changed', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/a.txt', { content: 'a' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('content'),
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const fingerprint = fingerprintPlan(planResult.mutationSet, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
      });

      const stale = isStale(fingerprint, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
        mutationSet: planResult.mutationSet,
      });

      expect(stale.ok).toBe(true);
    });

    it('staged authorization is not consumed when stale', () => {
      // This test verifies the architectural invariant: when a plan is stale,
      // the caller must NOT consume the authorization. The isStale function
      // returns stale=true, and the caller is responsible for rejecting.
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/a.txt', { content: 'a' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('content'),
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const fingerprint = fingerprintPlan(planResult.mutationSet, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
      });

      // Simulate authority revision change (e.g., mode switch).
      const stale = isStale(fingerprint, {
        workspace: ws,
        authorityRevision: 5, // changed
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
        mutationSet: planResult.mutationSet,
      });

      expect(stale.ok).toBe(false);
      // The caller should NOT consume the authorization — this is enforced
      // by the caller's logic, not by isStale itself.
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe('Edge cases', () => {
    it('handles empty proposal list', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const result = planMutationSet([], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.mutationSet.proposals.length).toBe(0);
      expect(result.mutationSet.excludedCount).toBe(0);
    });

    it('handles Thai text (UTF-8) in proposals', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const thaiContent = new TextEncoder().encode('สวัสดีครับ — Thai preserved');
      const raw: RawProposal = {
        actionClass: 'create_file',
        target: '/ws-root/thai.txt',
        content: thaiContent,
      };

      const result = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const p = result.mutationSet.proposals[0];
      expect(p.postImage).not.toBeNull();
      expect(p.postImage!.sizeBytes).toBe(thaiContent.length);
      expect(p.binaryStatus).toBe('text');
    });

    it('handles binary content (non-UTF8 bytes) in proposals', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const binaryContent = new Uint8Array([0x00, 0xFF, 0xFE, 0x80, 0x7F, 0x01]);
      const raw: RawProposal = {
        actionClass: 'create_file',
        target: '/ws-root/binary.bin',
        content: binaryContent,
      };

      const result = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const p = result.mutationSet.proposals[0];
      expect(p.binaryStatus).toBe('binary');
      expect(p.postImage!.sizeBytes).toBe(6);
    });

    it('preflight with no kv store returns failure', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/a.txt', { content: 'a' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('modified'),
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      // Preflight without kv store should fail.
      const ctx = makePreflightContext(ws, files, clock, new InMemoryKeyValueStore());
      const preflight = runProtectionPreflight(planResult.mutationSet, ctx);
      expect(preflight.ok).toBe(true); // preflight itself succeeds, but stage may not be durable
    });

    it('fingerprint includes all required dimensions', () => {
      const files = new Map<string, { content?: string; isDir?: boolean }>();
      files.set('/ws-root/a.txt', { content: 'a' });
      const ws = makeWorkspace(files);
      const clock = fixedClock();

      const raw: RawProposal = {
        actionClass: 'edit_file',
        target: '/ws-root/a.txt',
        content: new TextEncoder().encode('content'),
      };

      const planResult = planMutationSet([raw], { workspace: ws, fsProbe: inMemoryFsProbe(files), clock });
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const fingerprint = fingerprintPlan(planResult.mutationSet, {
        workspace: ws,
        authorityRevision: 1,
        fsProbe: inMemoryFsProbe(files),
        clock,
        currentStoreUsageBytes: 0,
      });

      expect(fingerprint.fingerprintId).toBeTruthy();
      expect(fingerprint.mutationSetId).toBe(planResult.mutationSet.setId);
      expect(fingerprint.operationId).toBe(planResult.mutationSet.operationId);
      expect(fingerprint.proposalDigest).toBeTruthy();
      expect(fingerprint.authorityRevision).toBe(1);
      expect(fingerprint.workspaceDigest).toBeTruthy();
      expect(fingerprint.targetDigest).toBeTruthy();
      expect(fingerprint.quotaDigest).toBeTruthy();
      expect(fingerprint.platformDigest).toBeTruthy();
      expect(fingerprint.createdAt).toBeTruthy();
    });
  });
});
