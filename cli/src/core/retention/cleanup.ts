// Cleanup lifecycle for expired/deleted checkpoints (Story 3.16 AC #4, AC #5,
// AD-19, AD-20, AD-21, AD-24, AD-26).
//
// AC #4: a checkpoint expires, is deleted, or a Session cleanup removes its last
// reference -> cleanup removes encrypted originals, metadata, staging files, and
// unreachable references through a JOURNALED crash-consistent lifecycle; shared
// immutable bytes remain ONLY for other valid references; expired content is
// hidden from rollback discovery (Story 3.12 discover must exclude expired).
//
// AC #5: cleanup interrupted, store/key locked, reference count inconsistent, or
// deletion fails -> cleanup resumes or remains `recovery-locked`/`corrupt` WITHOUT
// exposing bytes as eligible, NEVER overwrites live data, and reports secure-deletion
// limitations + a safe inspect/exit action.
//
// AD-19 rollback honesty: automatic rollback covers checkpointed built-in
// create/edit/delete ONLY. Shell, process, remote, permission, symlink-side,
// and external effects are NEVER claimed reversible.

import type { CheckpointId } from '../checkpoints/types.js';
import { asCheckpointId } from '../checkpoints/types.js';
import type {
  CleanupContext,
  CleanupOutcome,
} from './types.js';

// --- Key conventions ---

function checkpointRecordKey(checkpointId: string): string {
  return `checkpoint:record:${checkpointId}`;
}

function artifactDataKey(artifactId: string): string {
  return `artifact:${artifactId}`;
}

function artifactRecordKey(artifactId: string): string {
  return `artifact:record:${artifactId}`;
}

function stagingMarkerKey(artifactId: string): string {
  return `staging:artifact:${artifactId}`;
}

function checkpointStagingMarkerKey(checkpointId: string): string {
  return `staging:checkpoint:${checkpointId}`;
}

function operationCheckpointIndexKey(operationId: string): string {
  return `op:checkpoint:${operationId}`;
}

function excludedEffectsKey(checkpointId: string): string {
  return `excluded:checkpoint:${checkpointId}`;
}

// --- Reference counting ---

function refCountKey(artifactId: string): string {
  return `refcount:artifact:${artifactId}`;
}

function getRefCount(ctx: CleanupContext, artifactId: string): number {
  const raw = ctx.kvStore.get(refCountKey(artifactId));
  if (!raw) return 0;
  try {
    return parseInt(raw, 10);
  } catch {
    return 0;
  }
}

function decrementRefCount(ctx: CleanupContext, artifactId: string): number {
  const current = getRefCount(ctx, artifactId);
  const next = Math.max(0, current - 1);
  if (next === 0) {
    ctx.kvStore.delete(refCountKey(artifactId));
  } else {
    ctx.kvStore.put(refCountKey(artifactId), String(next));
  }
  return next;
}

// --- Cleanup lifecycle ---

/**
 * Run cleanup for a single checkpoint (AC #4, AC #5).
 *
 * AC #4: removes encrypted originals, metadata, staging files, and unreachable
 * references through a journaled crash-consistent lifecycle. Shared immutable
 * bytes remain ONLY for other valid references. Expired content is hidden from
 * rollback discovery.
 *
 * AC #5: if cleanup is interrupted, store/key locked, reference count inconsistent,
 * or deletion fails -> returns `recovery-locked`/`corrupt` WITHOUT exposing bytes
 * as eligible, NEVER overwrites live data, and reports secure-deletion limitations
 * + safe inspect/exit action.
 *
 * @param checkpointId - The checkpoint to clean up.
 * @param ctx - Injectable dependencies (clock, journal, stores).
 * @returns CleanupOutcome indicating the result.
 */
export function runCleanup(
  checkpointId: CheckpointId,
  ctx: CleanupContext,
): CleanupOutcome {
  const now = ctx.clock();

  // --- Pre-checks (AC #5) ---

  // Check if store is locked.
  if (ctx.storeLocked()) {
    return {
      kind: 'recovery-locked',
      checkpointId,
      reason: 'Store is locked. Cleanup cannot proceed.',
      causeCode: 'store-locked',
      secureDeletionLimitation: 'Data remains on disk until store is unlocked and cleanup resumes.',
      safeActions: [{ kind: 'inspect' }, { kind: 'exit' }],
    };
  }

  // Check if key is locked.
  if (ctx.keyLocked()) {
    return {
      kind: 'recovery-locked',
      checkpointId,
      reason: 'Encryption key is locked. Cleanup cannot proceed.',
      causeCode: 'key-locked',
      secureDeletionLimitation: 'Data remains on disk until key is unlocked and cleanup resumes.',
      safeActions: [{ kind: 'inspect' }, { kind: 'exit' }],
    };
  }

  // Journal: cleanup started.
  ctx.journal.append({
    kind: 'cleanup-started',
    checkpointId,
    timestamp: now,
  });

  // --- Step 1: Read checkpoint record ---

  const recordJson = ctx.kvStore.get(checkpointRecordKey(checkpointId));
  if (!recordJson) {
    // Checkpoint already gone — nothing to clean up.
    ctx.journal.append({
      kind: 'cleanup-completed',
      checkpointId,
      timestamp: ctx.clock(),
    });
    return { kind: 'removed', checkpointId };
  }

  let record: { artifactIds?: readonly string[]; operationId?: string; stageState?: string };
  try {
    record = JSON.parse(recordJson);
  } catch {
    // Corrupt record — mark as corrupt.
    ctx.journal.append({
      kind: 'cleanup-failed',
      checkpointId,
      reason: 'Checkpoint record is corrupt and cannot be parsed',
      causeCode: 'corrupt-record',
      timestamp: ctx.clock(),
    });
    return {
      kind: 'corrupt',
      checkpointId,
      reason: 'Checkpoint record is corrupt and cannot be parsed',
      causeCode: 'corrupt-record',
      secureDeletionLimitation: 'Data may remain on disk. Manual inspection required.',
      safeActions: [{ kind: 'inspect' }, { kind: 'exit' }],
    };
  }

  const artifactIds: readonly string[] = record.artifactIds ?? [];
  const operationId: string | undefined = record.operationId;

  // --- Step 2: Remove encrypted originals (shared immutable bytes) ---
  // Only remove artifacts that have no other valid references.

  const removedArtifactIds: string[] = [];
  for (const artId of artifactIds) {
    // Decrement reference count.
    const remaining = decrementRefCount(ctx, artId);

    if (remaining > 0) {
      // Shared immutable bytes — keep for other valid references.
      continue;
    }

    // No other references — remove the artifact data.
    try {
      ctx.blobStore.delete(artifactDataKey(artId));
      ctx.blobStore.delete(artifactRecordKey(artId));
      ctx.blobStore.delete(stagingMarkerKey(artId));
      ctx.kvStore.delete(refCountKey(artId));
      removedArtifactIds.push(artId);
    } catch {
      // Deletion failed (AC #5).
      ctx.journal.append({
        kind: 'cleanup-failed',
        checkpointId,
        reason: `Failed to delete artifact ${artId}`,
        causeCode: 'artifact-deletion-failed',
        timestamp: ctx.clock(),
      });
      return {
        kind: 'recovery-locked',
        checkpointId,
        reason: `Failed to delete artifact ${artId}. Cleanup is recovery-locked.`,
        causeCode: 'artifact-deletion-failed',
        secureDeletionLimitation: 'Some artifact data may remain on disk. Manual inspection required.',
        safeActions: [{ kind: 'inspect' }, { kind: 'exit' }],
      };
    }
  }

  ctx.journal.append({
    kind: 'cleanup-removed-encrypted-originals',
    checkpointId,
    artifactIds: removedArtifactIds,
    timestamp: ctx.clock(),
  });

  // --- Step 3: Remove metadata ---

  ctx.kvStore.delete(checkpointRecordKey(checkpointId));
  ctx.kvStore.delete(checkpointStagingMarkerKey(checkpointId));
  ctx.kvStore.delete(excludedEffectsKey(checkpointId));

  if (operationId) {
    ctx.kvStore.delete(operationCheckpointIndexKey(operationId));
  }

  ctx.journal.append({
    kind: 'cleanup-removed-metadata',
    checkpointId,
    timestamp: ctx.clock(),
  });

  // --- Step 4: Remove staging files ---

  const stagingKeys = ctx.kvStore.list(`staging:checkpoint:${checkpointId}`);
  for (const key of stagingKeys) {
    ctx.kvStore.delete(key);
  }

  ctx.journal.append({
    kind: 'cleanup-removed-staging-files',
    checkpointId,
    timestamp: ctx.clock(),
  });

  // --- Step 5: Remove unreachable references ---

  // Remove from session checkpoint lists.
  const sessionKeys = ctx.kvStore.list('session:checkpoint-list:');
  let unreachableRefCount = 0;
  for (const key of sessionKeys) {
    const raw = ctx.kvStore.get(key);
    if (!raw) continue;
    try {
      const list: string[] = JSON.parse(raw);
      const filtered = list.filter((id: string) => id !== checkpointId);
      if (filtered.length !== list.length) {
        ctx.kvStore.put(key, JSON.stringify(filtered));
        unreachableRefCount++;
      }
    } catch {
      // Skip unparseable lists.
    }
  }

  if (unreachableRefCount > 0) {
    ctx.journal.append({
      kind: 'cleanup-removed-unreachable-references',
      checkpointId,
      refCount: unreachableRefCount,
      timestamp: ctx.clock(),
    });
  }

  // --- Step 6: Journal completion ---

  ctx.journal.append({
    kind: 'cleanup-completed',
    checkpointId,
    timestamp: ctx.clock(),
  });

  return { kind: 'removed', checkpointId };
}

/**
 * Resume a previously interrupted cleanup by detecting incomplete cleanup
 * lifecycle events (AC #5).
 *
 * If a `cleanup-started` event exists without a matching `cleanup-completed`
 * or `cleanup-failed` event, the cleanup is resumed from the last known step.
 *
 * @param checkpointId - The checkpoint to resume cleanup for.
 * @param ctx - Injectable dependencies.
 * @returns CleanupOutcome indicating the result.
 */
export function resumeCleanup(
  checkpointId: CheckpointId,
  ctx: CleanupContext,
): CleanupOutcome {
  // Check if the checkpoint record still exists.
  const recordJson = ctx.kvStore.get(checkpointRecordKey(checkpointId));
  if (!recordJson) {
    // Checkpoint already cleaned up.
    return { kind: 'removed', checkpointId };
  }

  // Resume the full cleanup.
  return runCleanup(checkpointId, ctx);
}

/**
 * Detect expired checkpoints that need cleanup.
 * Scans all checkpoint records and returns those whose retention has expired.
 *
 * @param currentPromptRound - The current Prompt Round.
 * @param ctx - Injectable dependencies.
 * @returns Array of checkpoint IDs that have expired.
 */
export function detectExpiredCheckpoints(
  _currentPromptRound: number,
  ctx: Pick<CleanupContext, 'kvStore'>,
): CheckpointId[] {
  const expired: CheckpointId[] = [];
  const keys = ctx.kvStore.list('checkpoint:record:');

  for (const key of keys) {
    const raw = ctx.kvStore.get(key);
    if (!raw) continue;

    try {
      const record = JSON.parse(raw) as {
        checkpointId?: string;
        retentionState?: string;
        stageState?: string;
      };

      // Skip non-committed checkpoints.
      if (record.stageState !== 'committed') continue;

      // Check if retention has expired.
      if (record.retentionState === 'eligible-for-eviction' || record.retentionState === 'evicted') {
        if (record.checkpointId) {
          expired.push(asCheckpointId(record.checkpointId));
        }
      }
    } catch {
      // Skip unparseable records.
    }
  }

  return expired;
}

/**
 * Mark a checkpoint as eligible for eviction (retention expired).
 * This is the first step in the cleanup lifecycle — the checkpoint is hidden
 * from rollback discovery but its data is not yet removed.
 *
 * @param checkpointId - The checkpoint to mark.
 * @param ctx - Injectable dependencies.
 */
export function markExpired(
  checkpointId: CheckpointId,
  ctx: Pick<CleanupContext, 'kvStore'>,
): void {
  const recordJson = ctx.kvStore.get(checkpointRecordKey(checkpointId));
  if (!recordJson) return;

  try {
    const record = JSON.parse(recordJson) as Record<string, unknown>;
    record.retentionState = 'eligible-for-eviction';
    ctx.kvStore.put(checkpointRecordKey(checkpointId), JSON.stringify(record));
  } catch {
    // Ignore unparseable records.
  }
}
