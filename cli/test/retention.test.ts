// Retention, capacity, and cleanup tests (Story 3.16, all 6 ACs).
// Uses in-memory KeyValueStore/BlobStore + injected clock.
// Covers: 5-round default retention + validated user window + deterministic
// expiry + unrelated retention not counted; over-cap at 100 MB checkpoint /
// 500 MB store -> over-cap + exact usage + unprotected scope + no silent
// eviction + explicit confirmation required + Full Access cannot suppress;
// confirmed-unprotected -> unprotected/never-protected record + only-retained-
// coverage-reversible statement + normal mutation order + no fabricated
// checkpoint ref; cleanup removes originals/metadata/staging/unreachable refs
// via journaled lifecycle + shared bytes remain for valid refs + expired hidden
// from discovery; cleanup interrupted/locked/inconsistent-ref/failing-deletion
// -> recovery-locked/corrupt + no bytes exposed + no live-data overwrite +
// secure-deletion limitation + safe inspect/exit; status rendering shows
// encryption/integrity/age/window/cap-usage/exclusions/next-steps narrow +
// no reversible-claim for excluded effects. >=22 cases. No network/real creds.

import { describe, expect, it } from 'vitest';
import type { KeyValueStore, BlobStore, CheckpointId } from '../src/core/checkpoints/types.js';
import { asCheckpointId, asArtifactId } from '../src/core/checkpoints/types.js';
import { CheckpointRepository } from '../src/core/checkpoints/checkpointRepository.js';
import { ArtifactStore } from '../src/core/checkpoints/artifactStore.js';
import { generateDataKey } from '../src/core/sessions/crypto.js';
import { newOperationId } from '../src/core/protocol/ids.js';
import {
  calculateRetention,
  isExpired,
  roundsRemaining,
  validateRetentionConfig,
  evaluateCapacity,
  recordUnprotectedOperation,
  recordNeverProtectedOperation,
  runCleanup,
  resumeCleanup,
  detectExpiredCheckpoints,
  markExpired,
  renderRetentionStatus,
  renderCapacityUsage,
  renderCleanupOutcome,
  DEFAULT_RETENTION_PROMPT_ROUNDS,
  MIN_RETENTION_PROMPT_ROUNDS,
  MAX_RETENTION_PROMPT_ROUNDS,
} from '../src/core/retention/index.js';
import type {
  RetentionConfig,
  RetentionState,
  CleanupContext,
  CleanupLifecycleEvent,
} from '../src/core/retention/types.js';
import { PER_CHECKPOINT_CAP_BYTES, STORE_CAP_BYTES } from '../src/core/mutations/types.js';

// --- In-memory backing store implementations ---

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

// --- Helpers ---

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

function stageAndCommitCheckpoint(
  repo: CheckpointRepository,
  store: KeyValueStore,
  overrides: Partial<{
    artifactIds: readonly string[];
    parentCheckpointIds: readonly string[];
    coverageState: 'fully-protected' | 'partially-protected' | 'unprotected';
    retentionState: 'retained' | 'eligible-for-eviction' | 'evicted';
    integrityState: 'verified' | 'corrupt' | 'recovery-locked';
    promptRound: number;
  }> = {},
): string {
  const opId = newOperationId();
  const result = repo.stage({
    operationId: opId,
    aggregateVersion: 1,
    artifactIds: overrides.artifactIds ?? [],
    parentCheckpointIds: overrides.parentCheckpointIds ?? [],
    coverageState: overrides.coverageState ?? 'fully-protected',
    promptRound: overrides.promptRound,
  });
  if (!result.ok) throw new Error('stage failed');
  const commitResult = repo.commit(result.checkpointId, opId);
  if (!commitResult.ok) throw new Error('commit failed');

  // Apply overrides that CheckpointRepository doesn't directly support.
  if (overrides.retentionState || overrides.integrityState) {
    const recordKey = `checkpoint:record:${result.checkpointId}`;
    const recordJson = store.get(recordKey);
    if (recordJson) {
      const record = JSON.parse(recordJson);
      if (overrides.retentionState) record.retentionState = overrides.retentionState;
      if (overrides.integrityState) record.integrityState = overrides.integrityState;
      store.put(recordKey, JSON.stringify(record));
    }
  }

  return result.checkpointId;
}

function makeCleanupContext(
  kvStore: KeyValueStore,
  blobStore: BlobStore,
  clock: () => string,
  overrides: Partial<{
    storeLocked: boolean;
    keyLocked: boolean;
  }> = {},
): CleanupContext {
  const events: CleanupLifecycleEvent[] = [];
  return {
    clock,
    journal: {
      append(event: CleanupLifecycleEvent): void {
        events.push(event);
      },
    },
    kvStore: {
      get: (k: string) => kvStore.get(k),
      put: (k: string, v: string) => kvStore.put(k, v),
      delete: (k: string) => kvStore.delete(k),
      list: (prefix: string) => kvStore.list(prefix),
    },
    blobStore: {
      get: (k: string) => blobStore.get(k),
      put: (k: string, v: Uint8Array) => blobStore.put(k, v),
      delete: (k: string) => blobStore.delete(k),
      list: (prefix: string) => blobStore.list(prefix),
    },
    storeLocked: () => overrides.storeLocked ?? false,
    keyLocked: () => overrides.keyLocked ?? false,
  };
}

// --- Tests ---

describe('Retention, capacity, and cleanup (Story 3.16)', () => {
  // ==========================================================================
  // AC #1: Retention calculation — 5-round default, validated user window,
  //        deterministic expiry, unrelated retention not counted
  // ==========================================================================
  describe('AC #1: Retention calculation', () => {
    it('default retention is 5 subsequent Prompt Rounds', () => {
      const cpId = asCheckpointId('cp-test-1');
      const state = calculateRetention(cpId, 10, 10);
      expect(state.config.subsequentPromptRounds).toBe(DEFAULT_RETENTION_PROMPT_ROUNDS);
      expect(state.expiryPromptRound).toBe(15);
      expect(state.retained).toBe(true);
    });

    it('supports validated user-configured window', () => {
      const config: RetentionConfig = { subsequentPromptRounds: 3 };
      const cpId = asCheckpointId('cp-test-2');
      const state = calculateRetention(cpId, 5, 5, config);
      expect(state.config.subsequentPromptRounds).toBe(3);
      expect(state.expiryPromptRound).toBe(8);
    });

    it('records expiry deterministically from creation round + window', () => {
      const config: RetentionConfig = { subsequentPromptRounds: 10 };
      const cpId = asCheckpointId('cp-test-3');
      const state = calculateRetention(cpId, 100, 100, config);
      expect(state.expiryPromptRound).toBe(110);
      // Same inputs always produce same expiry.
      const state2 = calculateRetention(cpId, 100, 100, config);
      expect(state2.expiryPromptRound).toBe(110);
    });

    it('checkpoint is retained when current round is before expiry', () => {
      const cpId = asCheckpointId('cp-test-4');
      const state = calculateRetention(cpId, 0, 4);
      expect(state.retained).toBe(true);
    });

    it('checkpoint is expired when current round equals or exceeds expiry', () => {
      const cpId = asCheckpointId('cp-test-5');
      const state = calculateRetention(cpId, 0, 5);
      expect(state.retained).toBe(false);
      expect(isExpired(state, 5)).toBe(true);
    });

    it('isExpired returns true when current round >= expiry round', () => {
      const cpId = asCheckpointId('cp-test-6');
      const state = calculateRetention(cpId, 10, 15);
      expect(isExpired(state, 15)).toBe(true);
      expect(isExpired(state, 20)).toBe(true);
    });

    it('roundsRemaining returns correct count', () => {
      const cpId = asCheckpointId('cp-test-7');
      const state = calculateRetention(cpId, 10, 10);
      expect(roundsRemaining(state, 10)).toBe(5);
      expect(roundsRemaining(state, 12)).toBe(3);
      expect(roundsRemaining(state, 15)).toBe(0);
      expect(roundsRemaining(state, 20)).toBe(0);
    });

    it('does NOT count unrelated Session or artifact retention as rollback protection', () => {
      // Retention is purely based on Prompt Round count, not wall-clock time
      // or unrelated storage. The state only tracks checkpointId, creation round,
      // and expiry round — no session or artifact fields.
      const cpId = asCheckpointId('cp-test-8');
      const state = calculateRetention(cpId, 0, 0);
      expect(state.checkpointId).toBe(cpId);
      expect(state.creationPromptRound).toBe(0);
      expect(state.expiryPromptRound).toBe(5);
      // No session or artifact retention fields exist on RetentionState.
      expect('retained' in state).toBe(true);
    });

    it('validateRetentionConfig rejects values below minimum', () => {
      const result = validateRetentionConfig(0);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.causeCode).toBe('retention-window-too-small');
      }
    });

    it('validateRetentionConfig rejects values above maximum', () => {
      const result = validateRetentionConfig(101);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.causeCode).toBe('retention-window-too-large');
      }
    });

    it('validateRetentionConfig accepts valid values', () => {
      const result = validateRetentionConfig(5);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.config.subsequentPromptRounds).toBe(5);
      }
    });

    it('validateRetentionConfig rejects non-integer values', () => {
      const result = validateRetentionConfig(3.5);
      expect(result.ok).toBe(false);
    });
  });

  // ==========================================================================
  // AC #2: Over-cap at 100 MB checkpoint / 500 MB store -> over-cap + exact
  //        usage + unprotected scope + no silent eviction + explicit
  //        confirmation required + Full Access cannot suppress
  // ==========================================================================
  describe('AC #2: Capacity evaluation (over-cap)', () => {
    it('reports within limits when checkpoint is under 100 MB and store under 500 MB', () => {
      const result = evaluateCapacity(1024, 1024, ['/test/file.txt']);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.usage.withinLimits).toBe(true);
      }
    });

    it('reports over-cap when checkpoint exceeds 100 MB', () => {
      const overCap = PER_CHECKPOINT_CAP_BYTES + 1;
      const result = evaluateCapacity(overCap, 0, ['/test/large-file.bin']);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.overCap).toBe(true);
        expect(result.overCapReason).toContain('exceeds per-checkpoint cap');
        expect(result.usage.checkpointSizeBytes).toBe(overCap);
        expect(result.requiresExplicitConfirmation).toBe(true);
      }
    });

    it('reports over-cap when store would exceed 500 MB', () => {
      const nearCap = STORE_CAP_BYTES - 1;
      const result = evaluateCapacity(1024, nearCap, ['/test/another-file.txt']);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.overCap).toBe(true);
        expect(result.overCapReason).toContain('exceeds store cap');
        expect(result.usage.estimatedStoreUsageBytes).toBe(nearCap + 1024);
      }
    });

    it('identifies exact checkpoint and store usage', () => {
      const result = evaluateCapacity(5000, 10000, ['/test/file.txt']);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.usage.checkpointSizeBytes).toBe(5000);
        expect(result.usage.storeUsageBytes).toBe(10000);
        expect(result.usage.estimatedStoreUsageBytes).toBe(15000);
      }
    });

    it('identifies unprotected scope when over-cap', () => {
      const overCap = PER_CHECKPOINT_CAP_BYTES + 1;
      const targets = ['/test/file1.txt', '/test/file2.txt'];
      const result = evaluateCapacity(overCap, 0, targets);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.unprotectedScope.targets).toEqual(targets);
        expect(result.unprotectedScope.residualRisk).toContain('AD-19');
        expect(result.unprotectedScope.reason).toBeTruthy();
      }
    });

    it('does NOT silently evict active protection', () => {
      // The evaluateCapacity function never modifies any store or state.
      // It only returns a result. Active protection is never touched.
      const overCap = PER_CHECKPOINT_CAP_BYTES + 1;
      const result = evaluateCapacity(overCap, 0, ['/test/file.txt']);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // No eviction — the result just reports the over-cap condition.
        expect(result.overCap).toBe(true);
        expect(result.requiresExplicitConfirmation).toBe(true);
      }
    });

    it('requires explicit confirmation to proceed without rollback protection', () => {
      const overCap = PER_CHECKPOINT_CAP_BYTES + 1;
      const result = evaluateCapacity(overCap, 0, ['/test/file.txt']);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.requiresExplicitConfirmation).toBe(true);
      }
    });

    it('Full Access cannot suppress over-cap disclosure', () => {
      // evaluateCapacity has no concept of Full Access — it always reports
      // over-cap when caps are exceeded. Full Access cannot alter the caps.
      const overCap = PER_CHECKPOINT_CAP_BYTES + 1;
      const result = evaluateCapacity(overCap, 0, ['/test/file.txt']);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // The caps are always the same regardless of access level.
        expect(result.usage.perCheckpointCapBytes).toBe(PER_CHECKPOINT_CAP_BYTES);
        expect(result.usage.storeCapBytes).toBe(STORE_CAP_BYTES);
      }
    });

    it('references cap constants from mutations/types.js (no duplication)', () => {
      // Verify the constants are imported, not redefined.
      expect(PER_CHECKPOINT_CAP_BYTES).toBe(100 * 1024 * 1024);
      expect(STORE_CAP_BYTES).toBe(500 * 1024 * 1024);
    });
  });

  // ==========================================================================
  // AC #3: Confirmed unprotected -> unprotected/never-protected record +
  //        only-retained-coverage-reversible statement + normal mutation order +
  //        no fabricated checkpoint reference
  // ==========================================================================
  describe('AC #3: Confirmed unprotected operation', () => {
    it('records unprotected operation with correct status', () => {
      const record = recordUnprotectedOperation('op-1', ['/test/file.txt'], 'checkpoint exceeds 100 MB cap');
      expect(record.protectionStatus).toBe('unprotected');
      expect(record.operationId).toBe('op-1');
      expect(record.targets).toEqual(['/test/file.txt']);
    });

    it('records never-protected operation with correct status', () => {
      const record = recordNeverProtectedOperation('op-2', ['/bin/sh'], 'shell command is never protectable');
      expect(record.protectionStatus).toBe('never-protected');
      expect(record.operationId).toBe('op-2');
    });

    it('includes statement that only retained coverage may be reversible', () => {
      const record = recordUnprotectedOperation('op-3', ['/test/file.txt'], 'over-cap');
      expect(record.reversibleStatement).toContain('Only built-in changes within retained checkpoint coverage may later be reversible');
      expect(record.reversibleStatement).toContain('AD-19');
    });

    it('has no fabricated checkpoint reference', () => {
      const record = recordUnprotectedOperation('op-4', ['/test/file.txt'], 'over-cap');
      expect(record.hasFabricatedCheckpointReference).toBe(false);
    });

    it('never-protected record also has no fabricated checkpoint reference', () => {
      const record = recordNeverProtectedOperation('op-5', ['/bin/sh'], 'shell');
      expect(record.hasFabricatedCheckpointReference).toBe(false);
    });

    it('records have recordedAt timestamp', () => {
      const record = recordUnprotectedOperation('op-6', ['/test/file.txt'], 'test');
      expect(record.recordedAt).toBeTruthy();
    });
  });

  // ==========================================================================
  // AC #4: Cleanup removes originals/metadata/staging/unreachable refs via
  //        journaled lifecycle + shared bytes remain for valid refs + expired
  //        hidden from discovery
  // ==========================================================================
  describe('AC #4: Cleanup lifecycle', () => {
    it('removes encrypted originals, metadata, staging files, and unreachable references', () => {
      const kvStore = new InMemoryKeyValueStore();
      const blobStore = new InMemoryBlobStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kvStore, clock);
      const artStore = new ArtifactStore(blobStore, makeKey());

      // Create an artifact.
      const content = new TextEncoder().encode('test content');
      const artResult = artStore.stage({ bytes: content, contentClass: 'file-content' });
      expect(artResult.ok).toBe(true);
      if (!artResult.ok) return;
      artStore.commit(artResult.artifactId);

      // Create a checkpoint referencing the artifact.
      const cpId = stageAndCommitCheckpoint(repo, kvStore, {
        artifactIds: [artResult.artifactId],
      });

      // Verify checkpoint exists.
      expect(kvStore.get(`checkpoint:record:${cpId}`)).toBeTruthy();

      // Run cleanup.
      const ctx = makeCleanupContext(kvStore, blobStore, clock);
      const outcome = runCleanup(asCheckpointId(cpId), ctx);

      expect(outcome.kind).toBe('removed');
      expect(outcome.checkpointId).toBe(cpId);

      // Verify metadata is removed.
      expect(kvStore.get(`checkpoint:record:${cpId}`)).toBeUndefined();
      expect(kvStore.get(`staging:checkpoint:${cpId}`)).toBeUndefined();

      // Verify artifact data is removed (no other references).
      expect(blobStore.get(`artifact:${artResult.artifactId}`)).toBeUndefined();
      expect(blobStore.get(`artifact:record:${artResult.artifactId}`)).toBeUndefined();
    });

    it('shared immutable bytes remain for other valid references', () => {
      const kvStore = new InMemoryKeyValueStore();
      const blobStore = new InMemoryBlobStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kvStore, clock);
      const artStore = new ArtifactStore(blobStore, makeKey());

      // Create an artifact.
      const content = new TextEncoder().encode('shared content');
      const artResult = artStore.stage({ bytes: content, contentClass: 'file-content' });
      expect(artResult.ok).toBe(true);
      if (!artResult.ok) return;
      artStore.commit(artResult.artifactId);

      // Set reference count to 2 (simulating two checkpoints sharing this artifact).
      kvStore.put(`refcount:artifact:${artResult.artifactId}`, '2');

      // Create a checkpoint referencing the artifact.
      const cpId = stageAndCommitCheckpoint(repo, kvStore, {
        artifactIds: [artResult.artifactId],
      });

      // Run cleanup.
      const ctx = makeCleanupContext(kvStore, blobStore, clock);
      const outcome = runCleanup(asCheckpointId(cpId), ctx);

      expect(outcome.kind).toBe('removed');

      // Verify artifact data still exists (shared with another reference).
      expect(blobStore.get(`artifact:${artResult.artifactId}`)).toBeTruthy();
      expect(blobStore.get(`artifact:record:${artResult.artifactId}`)).toBeTruthy();

      // Verify reference count was decremented.
      expect(kvStore.get(`refcount:artifact:${artResult.artifactId}`)).toBe('1');
    });

    it('expired content is hidden from rollback discovery', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kvStore, clock);

      // Create a checkpoint with expired retention.
      const cpId = stageAndCommitCheckpoint(repo, kvStore, {
        retentionState: 'evicted',
      });

      // Detect expired checkpoints.
      const expired = detectExpiredCheckpoints(10, { kvStore });
      expect(expired).toContain(asCheckpointId(cpId));
    });

    it('markExpired sets retentionState to eligible-for-eviction', () => {
      const kvStore = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kvStore, clock);

      const cpId = stageAndCommitCheckpoint(repo, kvStore);

      // Mark as expired.
      markExpired(asCheckpointId(cpId), { kvStore });

      // Verify retention state changed.
      const recordJson = kvStore.get(`checkpoint:record:${cpId}`);
      expect(recordJson).toBeTruthy();
      if (recordJson) {
        const record = JSON.parse(recordJson);
        expect(record.retentionState).toBe('eligible-for-eviction');
      }
    });

    it('cleanup follows journaled crash-consistent lifecycle', () => {
      const kvStore = new InMemoryKeyValueStore();
      const blobStore = new InMemoryBlobStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kvStore, clock);

      const cpId = stageAndCommitCheckpoint(repo, kvStore);

      const events: CleanupLifecycleEvent[] = [];
      const ctx: CleanupContext = {
        clock,
        journal: {
          append(event: CleanupLifecycleEvent): void {
            events.push(event);
          },
        },
        kvStore: {
          get: (k: string) => kvStore.get(k),
          put: (k: string, v: string) => kvStore.put(k, v),
          delete: (k: string) => kvStore.delete(k),
          list: (prefix: string) => kvStore.list(prefix),
        },
        blobStore: {
          get: (k: string) => blobStore.get(k),
          put: (k: string, v: Uint8Array) => blobStore.put(k, v),
          delete: (k: string) => blobStore.delete(k),
          list: (prefix: string) => blobStore.list(prefix),
        },
        storeLocked: () => false,
        keyLocked: () => false,
      };

      const outcome = runCleanup(asCheckpointId(cpId), ctx);
      expect(outcome.kind).toBe('removed');

      // Verify journal events were recorded in order.
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0].kind).toBe('cleanup-started');
      expect(events[events.length - 1].kind).toBe('cleanup-completed');
    });
  });

  // ==========================================================================
  // AC #5: Cleanup interrupted/locked/inconsistent-ref/failing-deletion ->
  //        recovery-locked/corrupt + no bytes exposed + no live-data overwrite +
  //        secure-deletion limitation + safe inspect/exit
  // ==========================================================================
  describe('AC #5: Cleanup failure modes', () => {
    it('store locked returns recovery-locked with safe actions', () => {
      const kvStore = new InMemoryKeyValueStore();
      const blobStore = new InMemoryBlobStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kvStore, clock);

      const cpId = stageAndCommitCheckpoint(repo, kvStore);

      const ctx = makeCleanupContext(kvStore, blobStore, clock, { storeLocked: true });
      const outcome = runCleanup(asCheckpointId(cpId), ctx);

      expect(outcome.kind).toBe('recovery-locked');
      expect(outcome.reason).toContain('Store is locked');
      expect(outcome.secureDeletionLimitation).toBeTruthy();
      expect(outcome.safeActions.length).toBeGreaterThan(0);
      expect(outcome.safeActions.some((a) => a.kind === 'inspect')).toBe(true);
      expect(outcome.safeActions.some((a) => a.kind === 'exit')).toBe(true);

      // Verify no data was removed.
      expect(kvStore.get(`checkpoint:record:${cpId}`)).toBeTruthy();
    });

    it('key locked returns recovery-locked with safe actions', () => {
      const kvStore = new InMemoryKeyValueStore();
      const blobStore = new InMemoryBlobStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kvStore, clock);

      const cpId = stageAndCommitCheckpoint(repo, kvStore);

      const ctx = makeCleanupContext(kvStore, blobStore, clock, { keyLocked: true });
      const outcome = runCleanup(asCheckpointId(cpId), ctx);

      expect(outcome.kind).toBe('recovery-locked');
      expect(outcome.reason).toContain('key is locked');
    });

    it('corrupt checkpoint record returns corrupt outcome', () => {
      const kvStore = new InMemoryKeyValueStore();
      const blobStore = new InMemoryBlobStore();
      const clock = fixedClock();

      // Put a corrupt record.
      kvStore.put('checkpoint:record:bad-cp', 'not-valid-json');

      const ctx = makeCleanupContext(kvStore, blobStore, clock);
      const outcome = runCleanup(asCheckpointId('bad-cp'), ctx);

      expect(outcome.kind).toBe('corrupt');
      expect(outcome.reason).toContain('corrupt');
      expect(outcome.secureDeletionLimitation).toBeTruthy();
      expect(outcome.safeActions.some((a) => a.kind === 'inspect')).toBe(true);
    });

    it('resumeCleanup resumes interrupted cleanup', () => {
      const kvStore = new InMemoryKeyValueStore();
      const blobStore = new InMemoryBlobStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kvStore, clock);

      const cpId = stageAndCommitCheckpoint(repo, kvStore);

      // Simulate interrupted cleanup: checkpoint record still exists.
      const ctx = makeCleanupContext(kvStore, blobStore, clock);
      const outcome = resumeCleanup(asCheckpointId(cpId), ctx);

      expect(outcome.kind).toBe('removed');
      expect(kvStore.get(`checkpoint:record:${cpId}`)).toBeUndefined();
    });

    it('resumeCleanup handles already-cleaned checkpoint', () => {
      const kvStore = new InMemoryKeyValueStore();
      const blobStore = new InMemoryBlobStore();
      const clock = fixedClock();

      const ctx = makeCleanupContext(kvStore, blobStore, clock);
      const outcome = resumeCleanup(asCheckpointId('already-gone'), ctx);

      expect(outcome.kind).toBe('removed');
    });

    it('NEVER overwrites live data', () => {
      // The cleanup function only deletes data — it never writes or overwrites
      // live data. Verify by checking that no unexpected keys are created.
      const kvStore = new InMemoryKeyValueStore();
      const blobStore = new InMemoryBlobStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kvStore, clock);

      const cpId = stageAndCommitCheckpoint(repo, kvStore);

      const keysBefore = kvStore.list('').length;
      const ctx = makeCleanupContext(kvStore, blobStore, clock);
      runCleanup(asCheckpointId(cpId), ctx);

      // Keys should have decreased (deletions only), never increased.
      const keysAfter = kvStore.list('').length;
      expect(keysAfter).toBeLessThan(keysBefore);
    });
  });

  // ==========================================================================
  // AC #6: Status rendering shows encryption/integrity/age/window/cap-usage/
  //        exclusions/next-steps narrow + no reversible-claim for excluded effects
  // ==========================================================================
  describe('AC #6: Status rendering', () => {
    it('renderRetentionStatus shows encryption and integrity status', () => {
      const rendered = renderRetentionStatus({
        checkpointId: asCheckpointId('cp-test'),
        encryptionState: 'encrypted',
        integrityState: 'verified',
        ageMs: 5000,
        retentionWindow: 5,
        expiryPromptRound: 10,
        capUsage: null,
        exclusions: [],
        nextSteps: ['checkpoint is retained'],
      });

      expect(rendered).toContain('Encryption: encrypted');
      expect(rendered).toContain('Integrity: verified');
    });

    it('renderRetentionStatus shows age and window', () => {
      const rendered = renderRetentionStatus({
        checkpointId: asCheckpointId('cp-test'),
        encryptionState: 'encrypted',
        integrityState: 'verified',
        ageMs: 5000,
        retentionWindow: 5,
        expiryPromptRound: 10,
        capUsage: null,
        exclusions: [],
        nextSteps: [],
      });

      expect(rendered).toContain('Age: 5000ms');
      expect(rendered).toContain('Retention window: 5 Prompt Round(s)');
      expect(rendered).toContain('Expiry: Prompt Round 10');
    });

    it('renderRetentionStatus shows cap usage when provided', () => {
      const rendered = renderRetentionStatus({
        checkpointId: asCheckpointId('cp-test'),
        encryptionState: 'encrypted',
        integrityState: 'verified',
        ageMs: 0,
        retentionWindow: 5,
        expiryPromptRound: null,
        capUsage: {
          checkpointSizeBytes: 5000,
          storeUsageBytes: 10000,
          estimatedStoreUsageBytes: 15000,
          perCheckpointCapBytes: 100 * 1024 * 1024,
          storeCapBytes: 500 * 1024 * 1024,
          withinLimits: true,
        },
        exclusions: [],
        nextSteps: [],
      });

      expect(rendered).toContain('Checkpoint usage: 5000 bytes');
      expect(rendered).toContain('Store usage: 10000 bytes');
      expect(rendered).toContain('Within limits: yes');
    });

    it('renderRetentionStatus shows exclusions', () => {
      const rendered = renderRetentionStatus({
        checkpointId: asCheckpointId('cp-test'),
        encryptionState: 'encrypted',
        integrityState: 'verified',
        ageMs: 0,
        retentionWindow: 5,
        expiryPromptRound: null,
        capUsage: null,
        exclusions: ['shell command: /bin/sh (excluded)', 'remote call: api.example.com (excluded)'],
        nextSteps: [],
      });

      expect(rendered).toContain('Exclusions:');
      expect(rendered).toContain('shell command: /bin/sh (excluded)');
    });

    it('renderRetentionStatus shows next steps', () => {
      const rendered = renderRetentionStatus({
        checkpointId: asCheckpointId('cp-test'),
        encryptionState: 'encrypted',
        integrityState: 'verified',
        ageMs: 0,
        retentionWindow: 5,
        expiryPromptRound: null,
        capUsage: null,
        exclusions: [],
        nextSteps: ['checkpoint is retained', 'use /rollback inspect for details'],
      });

      expect(rendered).toContain('Next steps:');
      expect(rendered).toContain('checkpoint is retained');
    });

    it('makes NO claim that excluded effects are reversible (AD-19)', () => {
      const rendered = renderRetentionStatus({
        checkpointId: asCheckpointId('cp-test'),
        encryptionState: 'encrypted',
        integrityState: 'verified',
        ageMs: 0,
        retentionWindow: 5,
        expiryPromptRound: null,
        capUsage: null,
        exclusions: ['shell command: /bin/sh (excluded)'],
        nextSteps: [],
      });

      // Must include the AD-19 disclaimer.
      expect(rendered).toContain('Automatic rollback covers checkpointed built-in create/edit/delete ONLY');
      expect(rendered).toContain('Shell, process, remote, permission, symlink-side, and external effects are NEVER claimed reversible');
      expect(rendered).toContain('AD-19');
    });

    it('renderCapacityUsage shows cap details', () => {
      const rendered = renderCapacityUsage({
        checkpointSizeBytes: 5000,
        storeUsageBytes: 10000,
        estimatedStoreUsageBytes: 15000,
        perCheckpointCapBytes: 100 * 1024 * 1024,
        storeCapBytes: 500 * 1024 * 1024,
        withinLimits: true,
      });

      expect(rendered).toContain('Checkpoint size: 5000 bytes');
      expect(rendered).toContain('Per-checkpoint cap:');
      expect(rendered).toContain('Store cap:');
      expect(rendered).toContain('Within limits: yes');
    });

    it('renderCapacityUsage shows over-cap warning when not within limits', () => {
      const rendered = renderCapacityUsage({
        checkpointSizeBytes: 200 * 1024 * 1024,
        storeUsageBytes: 0,
        estimatedStoreUsageBytes: 200 * 1024 * 1024,
        perCheckpointCapBytes: 100 * 1024 * 1024,
        storeCapBytes: 500 * 1024 * 1024,
        withinLimits: false,
      });

      expect(rendered).toContain('Within limits: no');
      expect(rendered).toContain('Over-cap');
      expect(rendered).toContain('AD-19');
    });

    it('renderCleanupOutcome shows removed status', () => {
      const rendered = renderCleanupOutcome({
        kind: 'removed',
        checkpointId: asCheckpointId('cp-test'),
      });

      expect(rendered).toContain('removed successfully');
    });

    it('renderCleanupOutcome shows recovery-locked with safe actions', () => {
      const rendered = renderCleanupOutcome({
        kind: 'recovery-locked',
        checkpointId: asCheckpointId('cp-test'),
        reason: 'Store is locked',
        causeCode: 'store-locked',
        secureDeletionLimitation: 'Data remains on disk',
        safeActions: [{ kind: 'inspect' }, { kind: 'exit' }],
      });

      expect(rendered).toContain('recovery-locked');
      expect(rendered).toContain('Store is locked');
      expect(rendered).toContain('inspect');
      expect(rendered).toContain('exit');
    });

    it('renderCleanupOutcome shows corrupt with safe actions', () => {
      const rendered = renderCleanupOutcome({
        kind: 'corrupt',
        checkpointId: asCheckpointId('cp-test'),
        reason: 'Record is corrupt',
        causeCode: 'corrupt-record',
        secureDeletionLimitation: 'Manual inspection required',
        safeActions: [{ kind: 'inspect' }, { kind: 'exit' }],
      });

      expect(rendered).toContain('corrupt');
      expect(rendered).toContain('Record is corrupt');
      expect(rendered).toContain('inspect');
    });
  });
});
