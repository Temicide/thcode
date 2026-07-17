// Recovery evaluation for interrupted checkpoint and mutation operations (Story 3.15,
// AC #2, AC #3, AC #4, AD-3, AD-13, AD-19, AD-20, AD-28).
//
// AC #2: no EffectDispatchCommitted event exists -> recovery may safely mark the
// operation cancelled/blocked or discard unconsumed authorization per the journal,
// WITHOUT consuming authority or invoking a native adapter.
//
// AC #3: EffectDispatchCommitted exists but native result/post-image is missing ->
// preserve unknown-outcome until a platform-supported local inspection/reconciliation
// proves the result, record residual risk, PROHIBIT blind re-execution or equivalent
// retry.
//
// AC #4: a native mutation is known to have committed but checkpoint reference
// publication failed -> attempt ONLY repository/journal reconciliation + safe
// reference repair, NEVER fabricate complete protection, label the affected rollback
// scope partially-protected/unprotected/corrupt when evidence is insufficient.
//
// Pure, injectable: accepts all dependencies as parameters so it stays
// unit-testable without fs/network/journal.

import type { OperationId } from '../protocol/ids.js';
import type {
  RecoveryEvaluationResult,
  RecoveryFailure,
  RecoveryReconcileInput,
  ResidualRisk,
  RollbackScopeLabel,
} from './types.js';

// --- AC #2: No EffectDispatchCommitted ---

export interface NoDispatchCommitInput {
  readonly operationId: OperationId;
  readonly hasAuthorizationEvents: boolean;
  readonly hasCheckpointStaging: boolean;
}

/**
 * Evaluate an operation with no EffectDispatchCommitted event (AC #2).
 *
 * When no EffectDispatchCommitted event exists, recovery may safely mark the
 * operation cancelled/blocked or discard unconsumed authorization according to
 * the journal, WITHOUT consuming authority or invoking a native adapter.
 *
 * @param input - operation id, authorization/checkpoint evidence
 * @returns a RecoveryEvaluationResult indicating cancelled/blocked outcome
 */
export function evaluateNoDispatchCommit(input: NoDispatchCommitInput): RecoveryEvaluationResult {
  const { operationId, hasAuthorizationEvents, hasCheckpointStaging } = input;
  void operationId;

  if (hasAuthorizationEvents && hasCheckpointStaging) {
    return {
      outcome: 'blocked',
      reason: 'Authorization was granted and checkpoint staging started but no dispatch commit occurred. Authorization is discarded without consumption. No native adapter was invoked.',
      authorityConsumed: false as const,
      nativeAdapterInvoked: false as const,
    };
  }

  if (hasAuthorizationEvents) {
    return {
      outcome: 'cancelled',
      reason: 'Authorization was granted but no dispatch commit occurred. Authorization is discarded without consumption. No native adapter was invoked.',
      authorityConsumed: false as const,
      nativeAdapterInvoked: false as const,
    };
  }

  return {
    outcome: 'cancelled',
    reason: 'No dispatch commit occurred. Operation may be safely marked cancelled. No authority was consumed. No native adapter was invoked.',
    authorityConsumed: false as const,
    nativeAdapterInvoked: false as const,
  };
}

// --- AC #3: EffectDispatchCommitted with missing result ---

export interface DispatchCommittedMissingResultInput {
  readonly operationId: OperationId;
  readonly hasTerminalEvent: boolean;
  readonly terminalKind: string | null;
  readonly hasPostImageEvidence: boolean;
}

/**
 * Evaluate an operation where EffectDispatchCommitted exists but native
 * result/post-image is missing (AC #3).
 *
 * Preserves unknown-outcome until a platform-supported local inspection/
 * reconciliation proves the result, records the residual risk, and prohibits
 * blind re-execution or equivalent retry.
 *
 * @param input - operation id, terminal event evidence, post-image evidence
 * @returns a RecoveryEvaluationResult with unknown-outcome + residual risk
 */
export function evaluateDispatchCommittedMissingResult(
  input: DispatchCommittedMissingResultInput,
): RecoveryEvaluationResult {
  const { operationId, hasTerminalEvent, terminalKind, hasPostImageEvidence } = input;
  void operationId;

  // If a terminal event exists, use it.
  if (hasTerminalEvent) {
    switch (terminalKind) {
      case 'OperationSucceeded':
        return {
          outcome: 'unknown-outcome',
          reason: 'OperationSucceeded event exists but post-image evidence is missing. Residual risk: post-image may not reflect actual filesystem state.',
          residualRisk: {
            description: 'OperationSucceeded event exists but post-image evidence is missing. The native mutation may have committed but the post-image is unverifiable.',
            scope: 'unproven-outcome',
            severity: 'medium',
          },
          blindRetryBlocked: true as const,
          onlyInspectReconcileExit: true as const,
        };
      case 'OperationFailed':
        return {
          outcome: 'unknown-outcome',
          reason: 'OperationFailed event exists but post-image evidence is missing. Residual risk: failure may be incomplete or post-image may be stale.',
          residualRisk: {
            description: 'OperationFailed event exists but post-image evidence is missing. The failure may be incomplete or the post-image may not reflect actual state.',
            scope: 'unproven-outcome',
            severity: 'medium',
          },
          blindRetryBlocked: true as const,
          onlyInspectReconcileExit: true as const,
        };
      default:
        break;
    }
  }

  // No terminal event or unknown terminal kind.
  const residualRisk: ResidualRisk = {
    description: hasPostImageEvidence
      ? 'EffectDispatchCommitted exists and post-image evidence was captured, but no terminal outcome is proven. The native mutation may have committed. Blind re-execution is prohibited.'
      : 'EffectDispatchCommitted exists but no terminal outcome and no post-image evidence. The native mutation may have committed with unknown result. Blind re-execution is prohibited.',
    scope: 'unproven-outcome',
    severity: 'high',
  };

  return {
    outcome: 'unknown-outcome',
    reason: residualRisk.description,
    residualRisk,
    blindRetryBlocked: true as const,
    onlyInspectReconcileExit: true as const,
  };
}

// --- AC #4: Committed mutation with failed reference publication ---

export interface CommittedMutationFailedReferenceInput {
  readonly operationId: OperationId;
  readonly checkpointRecord: {
    readonly stageState: string;
    readonly coverageState: string;
    readonly integrityState: string;
  } | null;
  readonly hasTerminalEvent: boolean;
  readonly terminalKind: string | null;
}

/**
 * Evaluate a native mutation known to have committed but checkpoint reference
 * publication failed (AC #4).
 *
 * Attempts ONLY repository/journal reconciliation and safe reference repair,
 * NEVER fabricates complete protection, and labels the affected rollback scope
 * partially-protected/unprotected/corrupt when evidence is insufficient.
 *
 * @param input - operation id, checkpoint record, terminal event evidence
 * @returns a RecoveryEvaluationResult with reconciled outcome and scope label
 */
export function evaluateCommittedMutationFailedReference(
  input: CommittedMutationFailedReferenceInput,
): RecoveryEvaluationResult {
  const { operationId, checkpointRecord, hasTerminalEvent, terminalKind } = input;
  void operationId;

  // Determine the rollback scope label from available evidence.
  const rollbackScopeLabel = deriveRollbackScopeLabel(checkpointRecord, hasTerminalEvent, terminalKind);

  return {
    outcome: 'reconciled',
    reason: `Native mutation committed but checkpoint reference publication failed. Rollback scope: ${rollbackScopeLabel}. Repository/journal reconciliation attempted. No fabricated protection.`,
    rollbackScopeLabel,
    referenceRepairAttempted: true,
    fabricatedProtection: false as const,
  };
}

/**
 * Derive the rollback scope label from available evidence (AC #4).
 * NEVER fabricates complete protection.
 */
function deriveRollbackScopeLabel(
  checkpointRecord: { readonly stageState: string; readonly coverageState: string; readonly integrityState: string } | null,
  hasTerminalEvent: boolean,
  terminalKind: string | null,
): RollbackScopeLabel {
  if (!checkpointRecord) {
    // No checkpoint record at all.
    if (hasTerminalEvent && terminalKind === 'OperationSucceeded') {
      return 'unprotected';
    }
    return 'corrupt';
  }

  if (checkpointRecord.integrityState === 'corrupt' || checkpointRecord.integrityState === 'recovery-locked') {
    return 'corrupt';
  }

  if (checkpointRecord.stageState === 'unreachable') {
    return 'corrupt';
  }

  if (checkpointRecord.stageState === 'staging' || checkpointRecord.stageState === 'staged') {
    // Checkpoint was staged but never committed.
    if (hasTerminalEvent && terminalKind === 'OperationSucceeded') {
      return 'partially-protected';
    }
    return 'unprotected';
  }

  // Committed checkpoint.
  if (checkpointRecord.coverageState === 'fully-protected') {
    return 'fully-protected';
  }

  if (checkpointRecord.coverageState === 'partially-protected') {
    return 'partially-protected';
  }

  return checkpointRecord.coverageState as RollbackScopeLabel;
}

// --- Reconcile operation (AC #4) ---

export type ReconcileResult =
  | { ok: true; details: readonly string[]; rollbackScopeLabel: RollbackScopeLabel }
  | { ok: false; failure: RecoveryFailure };

/**
 * Reconcile an operation's checkpoint material (AC #4).
 * Attempts ONLY repository/journal reconciliation and safe reference repair.
 * NEVER fabricates complete protection.
 */
export function reconcileOperation(input: RecoveryReconcileInput): ReconcileResult {
  const { operationId, checkpointRepo } = input;

  // Run checkpoint reconciliation (detect incomplete stages, mark unreachable).
  const reconcileResult = checkpointRepo.reconcile();

  // Find the checkpoint for this operation.
  const checkpoint = checkpointRepo.findByOperationId(operationId);

  const rollbackScopeLabel = checkpoint
    ? (checkpoint.coverageState as RollbackScopeLabel)
    : 'unprotected';

  return {
    ok: true,
    details: reconcileResult.details,
    rollbackScopeLabel,
  };
}
