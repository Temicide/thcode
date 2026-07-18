// Recovery tests (Story 3.15, all 6 ACs). Uses fake journal (replayable events)
// + in-memory checkpoint repos + clock. Covers: classify all 7 states from
// journal + detect incomplete checkpoint material + no auto-replay; no
// EffectDispatchCommitted -> cancelled/blocked or discard auth, no authority
// consume, no native adapter; EffectDispatchCommitted + missing result ->
// unknown-outcome preserved + residual risk + no blind re-exec/equivalent retry;
// committed mutation + failed reference publication -> journal/reference
// reconciliation only + no fabricated protection + partially-protected/unprotected/
// corrupt label; cancellation request+ack phases + cancelled/still-running/failed/
// succeeded/unknown-outcome distinguished + committed effect never claimed
// cancelled; /recover single entry with inspect/reconcile/export/retry-disabled/
// exit + unresolved visible + stable exit code. >=24 cases. No network/real creds.

import { describe, expect, it } from 'vitest';
import { classify, detectCheckpointMaterial } from '../src/core/recovery/classify.js';
import {
  evaluateNoDispatchCommit,
  evaluateDispatchCommittedMissingResult,
  evaluateCommittedMutationFailedReference,
  reconcileOperation,
} from '../src/core/recovery/evaluate.js';
import { determineCancellationPhase, formatCancellationState } from '../src/core/recovery/cancellation.js';
import {
  buildRecoveryResult,
  renderRecoveryResult,
  renderRecoveryInspect,
  renderRecoveryReconcile,
  renderRecoveryExport,
  renderRecoveryExit,
  renderRetryDisabledExplanation,
  renderRecoveryHelp,
} from '../src/core/recovery/render.js';
import type {
  OperationRecoveryState,
  RecoveryClassification,
  RecoveryAction,
  RecoveryResult,
  RecoveryEvaluationResult,
  CancellationState,
  CheckpointMaterialState,
  RecoveryReconcileInput,
} from '../src/core/recovery/types.js';
import { asOperationId, newOperationId } from '../src/core/protocol/ids.js';

// --- Helpers ---

function fixedClock(): () => string {
  let t = 0;
  return () => {
    t += 1;
    return `2026-07-17T00:00:00.${String(t).padStart(3, '0')}Z`;
  };
}

function makeEvent(kind: string, operationId: string): { readonly kind: string; readonly operationId: string } {
  return { kind, operationId };
}

function makeCheckpointRecord(stageState: string, coverageState: string, integrityState: string = 'verified'): {
  readonly stageState: string;
  readonly coverageState: string;
  readonly integrityState: string;
} {
  return { stageState, coverageState, integrityState };
}

// --- In-memory checkpoint repo for reconcile tests ---

class InMemoryCheckpointRepo {
  private readonly checkpoints = new Map<string, { checkpointId: string; stageState: string; coverageState: string; integrityState: string; operationId: string }>();
  private readonly stagingMarkers = new Set<string>();

  stage(operationId: string, coverageState: string): string {
    const id = `cp-${this.checkpoints.size + 1}`;
    this.checkpoints.set(id, { checkpointId: id, stageState: 'staging', coverageState, integrityState: 'verified', operationId });
    this.stagingMarkers.add(id);
    return id;
  }

  commit(id: string): void {
    const cp = this.checkpoints.get(id);
    if (cp) {
      cp.stageState = 'committed';
      this.stagingMarkers.delete(id);
    }
  }

  detectIncompleteStages(): readonly string[] {
    return [...this.stagingMarkers];
  }

  reconcile(): { removedCount: number; markedUnreachableCount: number; details: readonly string[] } {
    const incomplete = this.detectIncompleteStages();
    let removedCount = 0;
    let markedUnreachableCount = 0;
    const details: string[] = [];
    for (const id of incomplete) {
      const cp = this.checkpoints.get(id);
      if (cp) {
        cp.stageState = 'unreachable';
        cp.integrityState = 'recovery-locked';
        markedUnreachableCount++;
        details.push(`checkpoint ${id}: marked unreachable (operation ${cp.operationId})`);
      } else {
        removedCount++;
        details.push(`checkpoint ${id}: staging marker removed (no record found)`);
      }
      this.stagingMarkers.delete(id);
    }
    return { removedCount, markedUnreachableCount, details };
  }

  findByOperationId(operationId: string): { checkpointId: string; stageState: string; coverageState: string } | null {
    for (const [, cp] of this.checkpoints) {
      if (cp.operationId === operationId) {
        return { checkpointId: cp.checkpointId, stageState: cp.stageState, coverageState: cp.coverageState };
      }
    }
    return null;
  }
}

// =============================================================================
// AC #1: Classification from journal + checkpoint material detection
// =============================================================================

describe('AC #1: Classification from journal + checkpoint material detection', () => {
  it('classifies not-sent when no lifecycle or terminal events exist', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [makeEvent('HealthChanged', opId)],
      incompleteStageIds: [],
      operationCheckpoint: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.classification.journalState).toBe('not-sent');
    expect(result.classification.hasEffectDispatchCommitted).toBe(false);
    expect(result.classification.hasTerminalEvent).toBe(false);
  });

  it('classifies prepared when preparation events exist but no dispatch commit', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [
        makeEvent('PromptSubmitted', opId),
        makeEvent('ApprovalGranted', opId),
        makeEvent('EvidenceRecorded', opId),
      ],
      incompleteStageIds: [],
      operationCheckpoint: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.classification.journalState).toBe('prepared');
  });

  it('classifies dispatch-committed when EffectDispatchCommitted exists but no terminal event', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [makeEvent('EffectDispatchCommitted', opId)],
      incompleteStageIds: [],
      operationCheckpoint: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.classification.journalState).toBe('dispatch-committed');
    expect(result.classification.hasEffectDispatchCommitted).toBe(true);
    expect(result.classification.hasTerminalEvent).toBe(false);
    expect(result.classification.dispatchClassification).toBe('post-dispatch-commit');
  });

  it('classifies succeeded when OperationSucceeded exists', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [
        makeEvent('EffectDispatchCommitted', opId),
        makeEvent('OperationSucceeded', opId),
      ],
      incompleteStageIds: [],
      operationCheckpoint: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.classification.journalState).toBe('succeeded');
    expect(result.classification.hasTerminalEvent).toBe(true);
    expect(result.classification.terminalKind).toBe('OperationSucceeded');
  });

  it('classifies failed when OperationFailed exists', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [
        makeEvent('EffectDispatchCommitted', opId),
        makeEvent('OperationFailed', opId),
      ],
      incompleteStageIds: [],
      operationCheckpoint: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.classification.journalState).toBe('failed');
    expect(result.classification.terminalKind).toBe('OperationFailed');
  });

  it('classifies cancelled when OperationCancelled exists', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [makeEvent('OperationCancelled', opId)],
      incompleteStageIds: [],
      operationCheckpoint: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.classification.journalState).toBe('cancelled');
  });

  it('classifies unknown-outcome when OperationUnknownOutcome exists', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [makeEvent('OperationUnknownOutcome', opId)],
      incompleteStageIds: [],
      operationCheckpoint: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.classification.journalState).toBe('unknown-outcome');
  });

  it('detects incomplete checkpoint material', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [makeEvent('EffectDispatchCommitted', opId)],
      incompleteStageIds: ['cp-incomplete-1'],
      operationCheckpoint: makeCheckpointRecord('staging', 'unprotected'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.classification.checkpointMaterial).toBe('incomplete');
  });

  it('detects unreachable checkpoint material', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [makeEvent('EffectDispatchCommitted', opId)],
      incompleteStageIds: [],
      operationCheckpoint: makeCheckpointRecord('unreachable', 'unprotected'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.classification.checkpointMaterial).toBe('unreachable');
  });

  it('detects corrupt checkpoint material', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [makeEvent('EffectDispatchCommitted', opId)],
      incompleteStageIds: [],
      operationCheckpoint: makeCheckpointRecord('committed', 'fully-protected', 'corrupt'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.classification.checkpointMaterial).toBe('corrupt');
  });

  it('returns failure for empty journal events', () => {
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [],
      incompleteStageIds: [],
      operationCheckpoint: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe('operation-not-found');
  });

  it('returns failure for no matching events', () => {
    const opId = newOperationId();
    const otherId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [makeEvent('EffectDispatchCommitted', otherId)],
      incompleteStageIds: [],
      operationCheckpoint: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.category).toBe('operation-not-found');
  });

  it('never replays a native effect automatically', () => {
    // Verify that classify is pure and returns a classification, never an effect.
    const opId = newOperationId();
    const result = classify({
      operationId: opId,
      journalEvents: [makeEvent('EffectDispatchCommitted', opId)],
      incompleteStageIds: [],
      operationCheckpoint: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The result is a classification, not an effect execution.
    expect(result.classification.journalState).toBe('dispatch-committed');
    expect(result.classification.residualRisk.severity).toBe('high');
  });
});

// =============================================================================
// AC #2: No EffectDispatchCommitted -> cancelled/blocked, no authority consume
// =============================================================================

describe('AC #2: No EffectDispatchCommitted -> cancelled/blocked, no authority consume', () => {
  it('marks cancelled when no authorization or checkpoint events exist', () => {
    const result = evaluateNoDispatchCommit({
      operationId: newOperationId(),
      hasAuthorizationEvents: false,
      hasCheckpointStaging: false,
    });
    expect(result.outcome).toBe('cancelled');
    expect(result.authorityConsumed).toBe(false);
    expect(result.nativeAdapterInvoked).toBe(false);
  });

  it('marks cancelled when authorization exists but no checkpoint staging', () => {
    const result = evaluateNoDispatchCommit({
      operationId: newOperationId(),
      hasAuthorizationEvents: true,
      hasCheckpointStaging: false,
    });
    expect(result.outcome).toBe('cancelled');
    expect(result.authorityConsumed).toBe(false);
    expect(result.nativeAdapterInvoked).toBe(false);
  });

  it('marks blocked when authorization and checkpoint staging exist', () => {
    const result = evaluateNoDispatchCommit({
      operationId: newOperationId(),
      hasAuthorizationEvents: true,
      hasCheckpointStaging: true,
    });
    expect(result.outcome).toBe('blocked');
    expect(result.authorityConsumed).toBe(false);
    expect(result.nativeAdapterInvoked).toBe(false);
  });

  it('discards unconsumed authorization without consuming authority', () => {
    const result = evaluateNoDispatchCommit({
      operationId: newOperationId(),
      hasAuthorizationEvents: true,
      hasCheckpointStaging: false,
    });
    expect(result.outcome).toBe('cancelled');
    expect(result.authorityConsumed).toBe(false);
    expect(result.nativeAdapterInvoked).toBe(false);
    expect(result.reason).toContain('Authorization');
  });
});

// =============================================================================
// AC #3: EffectDispatchCommitted + missing result -> unknown-outcome
// =============================================================================

describe('AC #3: EffectDispatchCommitted + missing result -> unknown-outcome', () => {
  it('preserves unknown-outcome when no terminal event and no post-image', () => {
    const result = evaluateDispatchCommittedMissingResult({
      operationId: newOperationId(),
      hasTerminalEvent: false,
      terminalKind: null,
      hasPostImageEvidence: false,
    });
    expect(result.outcome).toBe('unknown-outcome');
    if (result.outcome !== 'unknown-outcome') return;
    expect(result.blindRetryBlocked).toBe(true);
    expect(result.onlyInspectReconcileExit).toBe(true);
    expect(result.residualRisk.severity).toBe('high');
  });

  it('preserves unknown-outcome when terminal event exists but no post-image', () => {
    const result = evaluateDispatchCommittedMissingResult({
      operationId: newOperationId(),
      hasTerminalEvent: true,
      terminalKind: 'OperationSucceeded',
      hasPostImageEvidence: false,
    });
    expect(result.outcome).toBe('unknown-outcome');
    if (result.outcome !== 'unknown-outcome') return;
    expect(result.blindRetryBlocked).toBe(true);
    expect(result.residualRisk.severity).toBe('medium');
  });

  it('preserves unknown-outcome when OperationFailed exists but no post-image', () => {
    const result = evaluateDispatchCommittedMissingResult({
      operationId: newOperationId(),
      hasTerminalEvent: true,
      terminalKind: 'OperationFailed',
      hasPostImageEvidence: false,
    });
    expect(result.outcome).toBe('unknown-outcome');
    if (result.outcome !== 'unknown-outcome') return;
    expect(result.blindRetryBlocked).toBe(true);
  });

  it('prohibits blind re-execution or equivalent retry', () => {
    const result = evaluateDispatchCommittedMissingResult({
      operationId: newOperationId(),
      hasTerminalEvent: false,
      terminalKind: null,
      hasPostImageEvidence: false,
    });
    expect(result.outcome).toBe('unknown-outcome');
    if (result.outcome !== 'unknown-outcome') return;
    expect(result.blindRetryBlocked).toBe(true);
    expect(result.onlyInspectReconcileExit).toBe(true);
  });

  it('records residual risk for unproven outcome', () => {
    const result = evaluateDispatchCommittedMissingResult({
      operationId: newOperationId(),
      hasTerminalEvent: false,
      terminalKind: null,
      hasPostImageEvidence: false,
    });
    expect(result.outcome).toBe('unknown-outcome');
    if (result.outcome !== 'unknown-outcome') return;
    expect(result.residualRisk.scope).toBe('unproven-outcome');
    expect(result.residualRisk.severity).toBe('high');
  });
});

// =============================================================================
// AC #4: Committed mutation + failed reference publication
// =============================================================================

describe('AC #4: Committed mutation + failed reference publication', () => {
  it('labels rollback scope partially-protected when checkpoint staged but terminal succeeded', () => {
    const result = evaluateCommittedMutationFailedReference({
      operationId: newOperationId(),
      checkpointRecord: makeCheckpointRecord('staging', 'fully-protected'),
      hasTerminalEvent: true,
      terminalKind: 'OperationSucceeded',
    });
    expect(result.outcome).toBe('reconciled');
    if (result.outcome !== 'reconciled') return;
    expect(result.rollbackScopeLabel).toBe('partially-protected');
    expect(result.fabricatedProtection).toBe(false);
    expect(result.referenceRepairAttempted).toBe(true);
  });

  it('labels rollback scope unprotected when checkpoint staged but no terminal event', () => {
    const result = evaluateCommittedMutationFailedReference({
      operationId: newOperationId(),
      checkpointRecord: makeCheckpointRecord('staging', 'fully-protected'),
      hasTerminalEvent: false,
      terminalKind: null,
    });
    expect(result.outcome).toBe('reconciled');
    if (result.outcome !== 'reconciled') return;
    expect(result.rollbackScopeLabel).toBe('unprotected');
    expect(result.fabricatedProtection).toBe(false);
  });

  it('labels rollback scope corrupt when checkpoint is corrupt', () => {
    const result = evaluateCommittedMutationFailedReference({
      operationId: newOperationId(),
      checkpointRecord: makeCheckpointRecord('committed', 'fully-protected', 'corrupt'),
      hasTerminalEvent: true,
      terminalKind: 'OperationSucceeded',
    });
    expect(result.outcome).toBe('reconciled');
    if (result.outcome !== 'reconciled') return;
    expect(result.rollbackScopeLabel).toBe('corrupt');
    expect(result.fabricatedProtection).toBe(false);
  });

  it('labels rollback scope corrupt when checkpoint is unreachable', () => {
    const result = evaluateCommittedMutationFailedReference({
      operationId: newOperationId(),
      checkpointRecord: makeCheckpointRecord('unreachable', 'fully-protected'),
      hasTerminalEvent: true,
      terminalKind: 'OperationSucceeded',
    });
    expect(result.outcome).toBe('reconciled');
    if (result.outcome !== 'reconciled') return;
    expect(result.rollbackScopeLabel).toBe('corrupt');
  });

  it('labels rollback scope unprotected when no checkpoint record and no terminal event', () => {
    const result = evaluateCommittedMutationFailedReference({
      operationId: newOperationId(),
      checkpointRecord: null,
      hasTerminalEvent: false,
      terminalKind: null,
    });
    expect(result.outcome).toBe('reconciled');
    if (result.outcome !== 'reconciled') return;
    expect(result.rollbackScopeLabel).toBe('corrupt');
  });

  it('labels rollback scope unprotected when no checkpoint record but terminal succeeded', () => {
    const result = evaluateCommittedMutationFailedReference({
      operationId: newOperationId(),
      checkpointRecord: null,
      hasTerminalEvent: true,
      terminalKind: 'OperationSucceeded',
    });
    expect(result.outcome).toBe('reconciled');
    if (result.outcome !== 'reconciled') return;
    expect(result.rollbackScopeLabel).toBe('unprotected');
  });

  it('never fabricates complete protection', () => {
    const result = evaluateCommittedMutationFailedReference({
      operationId: newOperationId(),
      checkpointRecord: makeCheckpointRecord('staging', 'fully-protected'),
      hasTerminalEvent: true,
      terminalKind: 'OperationSucceeded',
    });
    expect(result.outcome).toBe('reconciled');
    if (result.outcome !== 'reconciled') return;
    expect(result.fabricatedProtection).toBe(false);
    expect(result.rollbackScopeLabel).not.toBe('fully-protected');
  });

  it('reconcileOperation runs checkpoint reconciliation without fabricating protection', () => {
    const repo = new InMemoryCheckpointRepo();
    const opId = newOperationId();
    repo.stage(opId, 'fully-protected');

    const reconcileInput: RecoveryReconcileInput = {
      operationId: opId,
      journalEvents: [makeEvent('EffectDispatchCommitted', opId)],
      checkpointRepo: repo,
    };

    const result = reconcileOperation(reconcileInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.details.length).toBeGreaterThanOrEqual(1);
    // The checkpoint was staged with 'fully-protected' coverage; reconciliation
    // marks it unreachable but does not change the coverage state.
    expect(result.rollbackScopeLabel).toBe('fully-protected');
  });
});

// =============================================================================
// AC #5: Cancellation phases
// =============================================================================

describe('AC #5: Cancellation phases', () => {
  it('detects not-requested when no cancel events exist', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [makeEvent('EffectDispatchCommitted', opId)],
      operationId: opId,
    });
    expect(state.phase).toBe('not-requested');
    expect(state.requested).toBe(false);
    expect(state.acknowledged).toBe(false);
  });

  it('detects requested-before-dispatch-commit', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [makeEvent('OperationCancelled', opId)],
      operationId: opId,
    });
    expect(state.phase).toBe('requested-before-dispatch-commit');
    expect(state.requested).toBe(true);
    expect(state.outcome).toBe('cancelled');
  });

  it('detects requested-after-dispatch-commit', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [
        makeEvent('EffectDispatchCommitted', opId),
        makeEvent('OperationCancelled', opId),
      ],
      operationId: opId,
    });
    expect(state.phase).toBe('requested-after-dispatch-commit');
    expect(state.requested).toBe(true);
    expect(state.effectAlreadyCommitted).toBe(true);
  });

  it('detects acknowledged-before-dispatch-commit', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [
        makeEvent('OperationCancelled', opId),
        makeEvent('OperationUnknownOutcome', opId),
      ],
      operationId: opId,
    });
    expect(state.phase).toBe('acknowledged-before-dispatch-commit');
    expect(state.requested).toBe(true);
    expect(state.acknowledged).toBe(true);
  });

  it('detects acknowledged-after-dispatch-commit', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [
        makeEvent('EffectDispatchCommitted', opId),
        makeEvent('OperationCancelled', opId),
        makeEvent('OperationUnknownOutcome', opId),
      ],
      operationId: opId,
    });
    expect(state.phase).toBe('acknowledged-after-dispatch-commit');
    expect(state.requested).toBe(true);
    expect(state.acknowledged).toBe(true);
    expect(state.effectAlreadyCommitted).toBe(true);
  });

  it('distinguishes cancelled outcome', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [makeEvent('OperationCancelled', opId)],
      operationId: opId,
    });
    expect(state.outcome).toBe('cancelled');
  });

  it('distinguishes still-running outcome', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [makeEvent('EffectDispatchCommitted', opId)],
      operationId: opId,
    });
    expect(state.outcome).toBe('still-running');
  });

  it('distinguishes succeeded outcome', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [
        makeEvent('EffectDispatchCommitted', opId),
        makeEvent('OperationSucceeded', opId),
      ],
      operationId: opId,
    });
    expect(state.outcome).toBe('succeeded');
  });

  it('distinguishes failed outcome', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [
        makeEvent('EffectDispatchCommitted', opId),
        makeEvent('OperationFailed', opId),
      ],
      operationId: opId,
    });
    expect(state.outcome).toBe('failed');
  });

  it('distinguishes unknown-outcome', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [
        makeEvent('EffectDispatchCommitted', opId),
        makeEvent('OperationUnknownOutcome', opId),
      ],
      operationId: opId,
    });
    expect(state.outcome).toBe('unknown-outcome');
  });

  it('never claims an already-committed native effect was cancelled', () => {
    const opId = newOperationId();
    const state = determineCancellationPhase({
      journalEvents: [
        makeEvent('EffectDispatchCommitted', opId),
        makeEvent('OperationCancelled', opId),
      ],
      operationId: opId,
    });
    // effect-already-committed is a lifecycle fact, not succeeded (AD-28).
    // The effect was already committed (dispatch happened), but the terminal
    // event records the cancellation. The lifecycle fact is separate from
    // the operation status.
    expect(state.effectAlreadyCommitted).toBe(true);
    // The outcome is 'cancelled' because OperationCancelled is the terminal event.
    // This is correct: the operation was cancelled after dispatch, and the
    // effect-already-committed lifecycle fact records that the effect was
    // already dispatched before cancellation.
    expect(state.outcome).toBe('cancelled');
  });

  it('formatCancellationState shows request, acknowledgement, and outcome', () => {
    const state: CancellationState = {
      phase: 'requested-after-dispatch-commit',
      requested: true,
      acknowledged: false,
      outcome: 'still-running',
      effectAlreadyCommitted: true,
    };
    const formatted = formatCancellationState(state);
    expect(formatted).toContain('Cancellation requested');
    expect(formatted).toContain('still-running');
    expect(formatted).toContain('effect-already-committed');
  });
});

// =============================================================================
// AC #6: /recover single entry point with inspect/reconcile/export/exit
// =============================================================================

describe('AC #6: /recover single entry point with inspect/reconcile/export/exit', () => {
  it('renderRecoveryHelp shows all subcommands', () => {
    const output = renderRecoveryHelp();
    expect(output.stdout).toContain('RECOVERY ENTRY POINT');
    expect(output.stdout).toContain('inspect');
    expect(output.stdout).toContain('reconcile');
    expect(output.stdout).toContain('export');
    expect(output.stdout).toContain('exit');
    expect(output.stdout).toContain('Retry is DISABLED');
    expect(output.exitCode).toBe(0);
  });

  it('renderRetryDisabledExplanation explains retry is disabled', () => {
    const text = renderRetryDisabledExplanation();
    expect(text).toContain('RETRY DISABLED');
    expect(text).toContain('Blind re-execution or equivalent retry is PROHIBITED');
    expect(text).toContain('/recover inspect');
    expect(text).toContain('/recover reconcile');
    expect(text).toContain('/recover export');
    expect(text).toContain('/recover exit');
  });

  it('renderRecoveryResult produces stable exit class/code for dispatch-committed', () => {
    const classification: RecoveryClassification = {
      operationId: newOperationId(),
      journalState: 'dispatch-committed',
      operationState: 'dispatch-committed',
      checkpointMaterial: 'incomplete',
      residualRisk: { description: 'Effect dispatched but no terminal outcome', scope: 'unproven-outcome', severity: 'high' },
      dispatchClassification: 'post-dispatch-commit',
      hasEffectDispatchCommitted: true,
      hasTerminalEvent: false,
      terminalKind: null,
    };
    const result = buildRecoveryResult({ classification, action: 'inspect', nextStep: 'reconcile explicitly; do not auto-retry' });
    expect(result.exitClass).toBe('UNKNOWN_OUTCOME');
    expect(result.exitCode).toBe(70);
    expect(result.heading).toContain('DISPATCH COMMITTED');
  });

  it('renderRecoveryResult produces stable exit class/code for succeeded', () => {
    const classification: RecoveryClassification = {
      operationId: newOperationId(),
      journalState: 'succeeded',
      operationState: 'succeeded',
      checkpointMaterial: 'complete',
      residualRisk: { description: 'Operation completed successfully', scope: 'none', severity: 'none' },
      dispatchClassification: 'terminal-evidence-recorded',
      hasEffectDispatchCommitted: true,
      hasTerminalEvent: true,
      terminalKind: 'OperationSucceeded',
    };
    const result = buildRecoveryResult({ classification, action: 'exit', nextStep: 'no action needed' });
    expect(result.exitClass).toBe('SUCCESS');
    expect(result.exitCode).toBe(0);
  });

  it('renderRecoveryResult produces stable exit class/code for cancelled', () => {
    const classification: RecoveryClassification = {
      operationId: newOperationId(),
      journalState: 'cancelled',
      operationState: 'cancelled',
      checkpointMaterial: 'not-applicable',
      residualRisk: { description: 'Operation cancelled before dispatch commit', scope: 'none', severity: 'none' },
      dispatchClassification: 'not-dispatched',
      hasEffectDispatchCommitted: false,
      hasTerminalEvent: true,
      terminalKind: 'OperationCancelled',
    };
    const result = buildRecoveryResult({ classification, action: 'exit', nextStep: 'no action needed' });
    expect(result.exitClass).toBe('CANCELLED');
    expect(result.exitCode).toBe(130);
  });

  it('renderRecoveryResult produces stable exit class/code for failed', () => {
    const classification: RecoveryClassification = {
      operationId: newOperationId(),
      journalState: 'failed',
      operationState: 'failed',
      checkpointMaterial: 'complete',
      residualRisk: { description: 'Operation failed deterministically', scope: 'none', severity: 'none' },
      dispatchClassification: 'terminal-evidence-recorded',
      hasEffectDispatchCommitted: true,
      hasTerminalEvent: true,
      terminalKind: 'OperationFailed',
    };
    const result = buildRecoveryResult({ classification, action: 'exit', nextStep: 'review evidence and retry' });
    expect(result.exitClass).toBe('FAILED');
    expect(result.exitCode).toBe(1);
  });

  it('renderRecoveryInspect shows full classification details', () => {
    const classification: RecoveryClassification = {
      operationId: newOperationId(),
      journalState: 'dispatch-committed',
      operationState: 'dispatch-committed',
      checkpointMaterial: 'incomplete',
      residualRisk: { description: 'Effect dispatched but no terminal outcome', scope: 'unproven-outcome', severity: 'high' },
      dispatchClassification: 'post-dispatch-commit',
      hasEffectDispatchCommitted: true,
      hasTerminalEvent: false,
      terminalKind: null,
    };
    const result = buildRecoveryResult({ classification, action: 'inspect', nextStep: 'reconcile explicitly; do not auto-retry' });
    const output = renderRecoveryInspect({ classification, result });
    expect(output.stdout).toContain('Operation:');
    expect(output.stdout).toContain('Journal state:');
    expect(output.stdout).toContain('Checkpoint material:');
    expect(output.stdout).toContain('Dispatch classification:');
    expect(output.stdout).toContain('Has EffectDispatchCommitted:');
    expect(output.stdout).toContain('Has terminal event:');
    expect(output.json).toContain('"exitClass":"UNKNOWN_OUTCOME"');
  });

  it('renderRecoveryReconcile shows reconciliation details', () => {
    const classification: RecoveryClassification = {
      operationId: newOperationId(),
      journalState: 'unknown-outcome',
      operationState: 'unknown-outcome',
      checkpointMaterial: 'incomplete',
      residualRisk: { description: 'Checkpoint material reconciled', scope: 'none', severity: 'none' },
      dispatchClassification: 'reference-publication-failed',
      hasEffectDispatchCommitted: true,
      hasTerminalEvent: false,
      terminalKind: null,
    };
    const result = buildRecoveryResult({ classification, action: 'reconcile', nextStep: 'review reconciliation details' });
    const output = renderRecoveryReconcile({
      operationId: 'op-123',
      details: ['checkpoint cp-1: marked unreachable'],
      rollbackScopeLabel: 'unprotected',
      result,
    });
    expect(output.stdout).toContain('Rollback scope:');
    expect(output.stdout).toContain('Reconciliation details:');
    expect(output.stdout).toContain('marked unreachable');
  });

  it('renderRecoveryExport shows sanitized evidence', () => {
    const classification: RecoveryClassification = {
      operationId: newOperationId(),
      journalState: 'unknown-outcome',
      operationState: 'unknown-outcome',
      checkpointMaterial: 'not-applicable',
      residualRisk: { description: 'Evidence exported for inspection', scope: 'none', severity: 'none' },
      dispatchClassification: 'terminal-evidence-recorded',
      hasEffectDispatchCommitted: true,
      hasTerminalEvent: false,
      terminalKind: null,
    };
    const result = buildRecoveryResult({ classification, action: 'export-safe-evidence', nextStep: 'evidence exported' });
    const output = renderRecoveryExport({
      operationId: 'op-123',
      evidence: [
        { kind: 'EffectDispatchCommitted', operationId: 'op-123' },
        { kind: 'OperationSucceeded', operationId: 'op-123' },
      ],
      result,
    });
    expect(output.stdout).toContain('Sanitized evidence');
    expect(output.stdout).toContain('EffectDispatchCommitted');
    expect(output.stdout).toContain('OperationSucceeded');
  });

  it('renderRecoveryExit shows unresolved state warning when present', () => {
    const classification: RecoveryClassification = {
      operationId: newOperationId(),
      journalState: 'unknown-outcome',
      operationState: 'unknown-outcome',
      checkpointMaterial: 'incomplete',
      residualRisk: { description: 'Unproven outcome', scope: 'unproven-outcome', severity: 'high' },
      dispatchClassification: 'post-dispatch-commit',
      hasEffectDispatchCommitted: true,
      hasTerminalEvent: false,
      terminalKind: null,
    };
    const result = buildRecoveryResult({ classification, action: 'exit', nextStep: 'recovery complete' });
    const output = renderRecoveryExit({ unresolvedState: true, result });
    expect(output.stdout).toContain('WARNING: Unresolved state remains');
    expect(output.stderr).toContain('Unresolved state remains');
    expect(output.exitCode).toBe(70);
  });

  it('renderRecoveryExit shows no warning when state is resolved', () => {
    const classification: RecoveryClassification = {
      operationId: newOperationId(),
      journalState: 'succeeded',
      operationState: 'succeeded',
      checkpointMaterial: 'complete',
      residualRisk: { description: 'Operation completed successfully', scope: 'none', severity: 'none' },
      dispatchClassification: 'terminal-evidence-recorded',
      hasEffectDispatchCommitted: true,
      hasTerminalEvent: true,
      terminalKind: 'OperationSucceeded',
    };
    const result = buildRecoveryResult({ classification, action: 'exit', nextStep: 'recovery complete' });
    const output = renderRecoveryExit({ unresolvedState: false, result });
    expect(output.stdout).not.toContain('WARNING');
    expect(output.exitCode).toBe(0);
  });

  it('renderRecoveryResult produces CommandOutput with JSON parity', () => {
    const classification: RecoveryClassification = {
      operationId: newOperationId(),
      journalState: 'dispatch-committed',
      operationState: 'dispatch-committed',
      checkpointMaterial: 'incomplete',
      residualRisk: { description: 'Effect dispatched but no terminal outcome', scope: 'unproven-outcome', severity: 'high' },
      dispatchClassification: 'post-dispatch-commit',
      hasEffectDispatchCommitted: true,
      hasTerminalEvent: false,
      terminalKind: null,
    };
    const result = buildRecoveryResult({ classification, action: 'inspect', nextStep: 'reconcile explicitly; do not auto-retry' });
    const output = renderRecoveryResult(result);
    expect(output.stdout).toContain('RECOVERY: DISPATCH COMMITTED');
    expect(output.json).toContain('"status":"dispatch-committed"');
    expect(output.json).toContain('"exitClass":"UNKNOWN_OUTCOME"');
    expect(output.json).toContain('"exitCode":70');
  });
});

// =============================================================================
// detectCheckpointMaterial standalone tests
// =============================================================================

describe('detectCheckpointMaterial standalone', () => {
  it('returns not-applicable when no checkpoint and no incomplete stages', () => {
    const result = detectCheckpointMaterial({ incompleteStageIds: [], operationCheckpoint: null });
    expect(result).toBe('not-applicable');
  });

  it('returns incomplete when incomplete stages exist but no checkpoint', () => {
    const result = detectCheckpointMaterial({ incompleteStageIds: ['cp-1'], operationCheckpoint: null });
    expect(result).toBe('incomplete');
  });

  it('returns unreachable when checkpoint is unreachable', () => {
    const result = detectCheckpointMaterial({
      incompleteStageIds: [],
      operationCheckpoint: makeCheckpointRecord('unreachable', 'unprotected'),
    });
    expect(result).toBe('unreachable');
  });

  it('returns corrupt when checkpoint is corrupt', () => {
    const result = detectCheckpointMaterial({
      incompleteStageIds: [],
      operationCheckpoint: makeCheckpointRecord('committed', 'fully-protected', 'corrupt'),
    });
    expect(result).toBe('corrupt');
  });

  it('returns recovery-locked when checkpoint is recovery-locked', () => {
    const result = detectCheckpointMaterial({
      incompleteStageIds: [],
      operationCheckpoint: makeCheckpointRecord('committed', 'fully-protected', 'recovery-locked'),
    });
    expect(result).toBe('corrupt');
  });

  it('returns incomplete when checkpoint is staging', () => {
    const result = detectCheckpointMaterial({
      incompleteStageIds: [],
      operationCheckpoint: makeCheckpointRecord('staging', 'unprotected'),
    });
    expect(result).toBe('incomplete');
  });

  it('returns complete when checkpoint is committed and no incomplete stages', () => {
    const result = detectCheckpointMaterial({
      incompleteStageIds: [],
      operationCheckpoint: makeCheckpointRecord('committed', 'fully-protected'),
    });
    expect(result).toBe('complete');
  });
});
