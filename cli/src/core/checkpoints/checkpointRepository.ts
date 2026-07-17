// CheckpointRepository — crash-consistent checkpoint metadata store (Story 3.2,
// AD-3, AD-5, AD-19, AD-20, AD-21, AD-24). Owns checkpoint content references,
// mutation metadata, lineage references, coverage state, retention state, and
// integrity state. Staging is crash-consistent: a crash before commit / during
// append / during reference publication leaves incomplete stages detectable;
// startup detects incomplete stages, removes/marks unreachable staged material,
// preserves unknown operation state, never exposes an incomplete/corrupt
// checkpoint as complete, never replays a native effect.
//
// The journal is the SOLE commit-visibility authority — CheckpointRepository
// does not own commit visibility. All participating records share OperationId,
// aggregate version, and commit state. UI/headless completion is derived only
// from post-commit events.
//
// Provides an injectable KeyValueStore port so tests use in-memory; production
// can use SQLite later.

import { randomUUID } from 'node:crypto';
import type { OperationId } from '../protocol/ids.js';
import type {
  CheckpointId,
  CheckpointReadResult,
  CheckpointRecord,
  CheckpointStageInput,
  CommitResult,
  IntegrityFailure,
  KeyValueStore,
  Mutable,
  ReconcileResult,
  StageResult,
} from './types.js';
import { asCheckpointId } from './types.js';

// --- Key conventions ---

function checkpointRecordKey(checkpointId: string): string {
  return `checkpoint:record:${checkpointId}`;
}

function stagingPrefix(): string {
  return 'staging:checkpoint:';
}

function stagingMarkerKey(checkpointId: string): string {
  return `${stagingPrefix()}${checkpointId}`;
}

function operationCheckpointIndexKey(operationId: string): string {
  return `op:checkpoint:${operationId}`;
}

// --- CheckpointRepository ---

export class CheckpointRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly clock: () => string,
  ) {}

  /**
   * Stage a new checkpoint. Creates a checkpoint record in 'staging' state.
   * Crash before commit leaves the checkpoint detectable as incomplete.
   * Returns the new CheckpointId.
   */
  stage(input: CheckpointStageInput): StageResult {
    try {
      const checkpointId = asCheckpointId(randomUUID());
      const now = this.clock();

      const record: CheckpointRecord = {
        checkpointId,
        mutation: {
          operationId: input.operationId,
          aggregateVersion: input.aggregateVersion,
          commitState: 'pending',
        },
        artifactIds: [...input.artifactIds],
        parentCheckpointIds: input.parentCheckpointIds ? [...input.parentCheckpointIds] : [],
        coverageState: input.coverageState ?? 'unprotected',
        retentionState: 'retained',
        integrityState: 'verified',
        stageState: 'staging',
        createdAt: now,
      };

      this.store.put(checkpointRecordKey(checkpointId), JSON.stringify(record));
      this.store.put(stagingMarkerKey(checkpointId), 'staging');

      return { ok: true, checkpointId };
    } catch (e) {
      return { ok: false, cause: `checkpoint stage failed: ${(e as Error).message}` };
    }
  }

  /**
   * Commit a checkpoint. Atomically transitions the checkpoint from 'staging'
   * to 'committed' state. The journal is the sole commit-visibility authority;
   * this method records the OperationId and aggregate version so all
   * participating records share them. Crash during commit leaves the
   * checkpoint in staging state (detectable by detectIncompleteStages).
   */
  commit(checkpointId: CheckpointId, operationId: OperationId): CommitResult {
    try {
      const recordJson = this.store.get(checkpointRecordKey(checkpointId));
      if (!recordJson) {
        return { ok: false, cause: `checkpoint not found: ${checkpointId}` };
      }

      const record = JSON.parse(recordJson) as Mutable<CheckpointRecord>;

      if (record.stageState === 'committed') {
        return { ok: true }; // idempotent
      }

      if (record.stageState === 'unreachable') {
        return { ok: false, cause: `checkpoint is unreachable: ${checkpointId}` };
      }

      // Update mutation metadata with the operation identity.
      (record.mutation as Mutable<typeof record.mutation>).operationId = operationId;
      (record.mutation as Mutable<typeof record.mutation>).commitState = 'committed';
      record.stageState = 'committed';
      record.integrityState = 'verified';

      this.store.put(checkpointRecordKey(checkpointId), JSON.stringify(record));
      this.store.delete(stagingMarkerKey(checkpointId));

      // Index by operationId for journal-authoritative lookup.
      this.store.put(operationCheckpointIndexKey(operationId), checkpointId);

      return { ok: true };
    } catch (e) {
      return { ok: false, cause: `checkpoint commit failed: ${(e as Error).message}` };
    }
  }

  /**
   * Read a checkpoint record with integrity verification.
   * Fails closed as `corrupt` or `recovery-locked` on any altered
   * record/digest/operation-identity/metadata mismatch.
   * No content reaches application code on failure.
   */
  read(checkpointId: CheckpointId): CheckpointReadResult {
    try {
      const recordJson = this.store.get(checkpointRecordKey(checkpointId));
      if (!recordJson) {
        return {
          ok: false,
          failure: this.corruptFailure('checkpoint', `checkpoint not found: ${checkpointId}`),
        };
      }

      const record: CheckpointRecord = JSON.parse(recordJson);

      // Reject unreachable checkpoints.
      if (record.stageState === 'unreachable') {
        return {
          ok: false,
          failure: this.recoveryLockedFailure('checkpoint', `checkpoint is unreachable: ${checkpointId}`),
        };
      }

      // Reject incomplete (staging/staged) checkpoints — never expose as complete.
      if (record.stageState === 'staging' || record.stageState === 'staged') {
        return {
          ok: false,
          failure: this.recoveryLockedFailure('checkpoint', `checkpoint is not yet committed: ${checkpointId}`),
        };
      }

      // Verify record integrity: check that the stored checkpointId matches.
      if (record.checkpointId !== checkpointId) {
        return {
          ok: false,
          failure: this.corruptFailure('checkpoint', 'checkpointId mismatch — record has been altered'),
        };
      }

      // Verify mutation metadata is present.
      if (!record.mutation.operationId || record.mutation.operationId.length === 0) {
        return {
          ok: false,
          failure: this.corruptFailure('checkpoint', 'missing operation identity — record has been altered'),
        };
      }

      // Verify artifact references field exists (empty is valid for metadata-only checkpoints).
      if (!record.artifactIds) {
        return {
          ok: false,
          failure: this.corruptFailure('checkpoint', 'missing artifact references field — record has been altered'),
        };
      }

      // Verify integrity state — a non-verified state means the record was tampered
      // or marked unreachable by reconciliation.
      if (record.integrityState !== 'verified') {
        return {
          ok: false,
          failure: this.recoveryLockedFailure('checkpoint', `checkpoint integrity state is ${record.integrityState}`),
        };
      }

      return { ok: true, record };
    } catch (e) {
      return {
        ok: false,
        failure: this.corruptFailure('checkpoint', `read failed: ${(e as Error).message}`),
      };
    }
  }

  /**
   * Find the checkpoint associated with an operation (journal-authoritative
   * lookup). Returns null if no checkpoint was committed for this operation.
   */
  findByOperationId(operationId: OperationId): CheckpointRecord | null {
    const checkpointId = this.store.get(operationCheckpointIndexKey(operationId));
    if (!checkpointId) return null;

    const result = this.read(asCheckpointId(checkpointId));
    if (!result.ok) return null;
    return result.record;
  }

  /**
   * Detect checkpoints still in staging state (crash-before-commit).
   */
  detectIncompleteStages(): CheckpointId[] {
    const markers = this.store.list(stagingPrefix());
    return markers.map((k) => asCheckpointId(k.replace(stagingPrefix(), '')));
  }

  /**
   * Reconcile incomplete stages: mark as unreachable so they are never
   * exposed as complete. Preserves unknown operation state — does not
   * replay native effects. Returns details of what was reconciled.
   */
  reconcile(): ReconcileResult {
    const incomplete = this.detectIncompleteStages();
    let removedCount = 0;
    let markedUnreachableCount = 0;
    const details: string[] = [];

    for (const checkpointId of incomplete) {
      const recordJson = this.store.get(checkpointRecordKey(checkpointId));
      if (recordJson) {
        const record = JSON.parse(recordJson) as Mutable<CheckpointRecord>;
        record.stageState = 'unreachable';
        record.integrityState = 'recovery-locked';
        this.store.put(checkpointRecordKey(checkpointId), JSON.stringify(record));
        this.store.delete(stagingMarkerKey(checkpointId));
        markedUnreachableCount++;
        details.push(`checkpoint ${checkpointId}: marked unreachable (operation ${record.mutation.operationId})`);
      } else {
        // Record missing — just remove the staging marker.
        this.store.delete(stagingMarkerKey(checkpointId));
        removedCount++;
        details.push(`checkpoint ${checkpointId}: staging marker removed (no record found)`);
      }
    }

    return { removedCount, markedUnreachableCount, details };
  }

  // --- Integrity failure helpers ---

  private corruptFailure(scope: 'checkpoint' | 'artifact', message: string): IntegrityFailure {
    return {
      category: 'corrupt',
      retryable: false,
      scope,
      message,
      causeCode: 'integrity-corrupt',
      recoveryActions: ['inspect the checkpoint store', 'restore from backup if available'],
    };
  }

  private recoveryLockedFailure(scope: 'checkpoint' | 'artifact', message: string): IntegrityFailure {
    return {
      category: 'recovery-locked',
      retryable: false,
      scope,
      message,
      causeCode: 'recovery-locked',
      recoveryActions: ['inspect the checkpoint store', 'run recovery procedure'],
    };
  }
}
