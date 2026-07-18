// Recovery types for interrupted checkpoint and mutation operations (Story 3.15,
// AD-3, AD-13, AD-19, AD-20, AD-28). Every operation interrupted by a crash or
// cancellation is classified from the journal; recovery NEVER replays a native
// effect automatically. No `any`. UTF-8/Thai preserved. No raw bytes in evidence
// (AD-24). AD-9 typed failures.

import type { OperationId } from '../protocol/ids.js';
import type { OperationState } from '../sessions/operationState.js';
import type { ExitClass } from '../protocol/uxState.js';

// --- Operation recovery state (AD-13 lifecycle, AD-28 dimension 1) ---

/**
 * The recovery classification of an operation based on journal evidence.
 * Maps to the 7 states from Story 3.15 AC #1:
 * - `not-sent`: no lifecycle-fact event exists (identity capture, authorization,
 *   or checkpoint staging never started)
 * - `prepared`: checkpoint staged but no dispatch-committed event
 * - `dispatch-committed`: EffectDispatchCommitted exists but no terminal event
 * - `succeeded`: OperationSucceeded event exists
 * - `failed`: OperationFailed event exists
 * - `cancelled`: OperationCancelled event exists (before dispatch commit)
 * - `unknown-outcome`: OperationUnknownOutcome event exists or no terminal proof
 */
export type OperationRecoveryState =
  | 'not-sent'
  | 'prepared'
  | 'dispatch-committed'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'unknown-outcome';

// --- Checkpoint material detection ---

export type CheckpointMaterialState =
  | 'complete'
  | 'incomplete'
  | 'unreachable'
  | 'corrupt'
  | 'recovery-locked'
  | 'not-applicable';

// --- Rollback scope label (AC #4) ---

export type RollbackScopeLabel =
  | 'fully-protected'
  | 'partially-protected'
  | 'unprotected'
  | 'corrupt'
  | 'not-applicable';

// --- Dispatch classification ---

export type DispatchClassification =
  | 'not-dispatched'
  | 'pre-dispatch-commit'
  | 'post-dispatch-commit'
  | 'native-mutation-committed'
  | 'reference-publication-failed'
  | 'terminal-evidence-recorded';

// --- Residual risk ---

export interface ResidualRisk {
  readonly description: string;
  readonly scope: 'none' | 'duplicate-mutation' | 'false-rollback-claim' | 'unproven-outcome' | 'partially-protected';
  readonly severity: 'none' | 'low' | 'medium' | 'high';
}

// --- Recovery classification (AC #1) ---

export interface RecoveryClassification {
  readonly operationId: OperationId;
  readonly journalState: OperationRecoveryState;
  readonly operationState: OperationState;
  readonly checkpointMaterial: CheckpointMaterialState;
  readonly residualRisk: ResidualRisk;
  readonly dispatchClassification: DispatchClassification;
  readonly hasEffectDispatchCommitted: boolean;
  readonly hasTerminalEvent: boolean;
  readonly terminalKind: string | null;
}

// --- Recovery action (retry is DISABLED per AC #1, AC #3) ---

export type RecoveryAction =
  | 'inspect'
  | 'reconcile'
  | 'export-safe-evidence'
  | 'exit';

// --- Recovery result (narrow/headless canonical order per AC #6) ---

export interface RecoveryResult {
  readonly heading: string;
  readonly purpose: string;
  readonly state: OperationRecoveryState;
  readonly residualRisk: ResidualRisk;
  readonly action: RecoveryAction;
  readonly nextStep: string;
  readonly exitClass: ExitClass;
  readonly exitCode: number;
  readonly body?: string;
}

// --- Recovery evaluation result (AC #2, AC #3, AC #4) ---

export type RecoveryEvaluationResult =
  | {
      readonly outcome: 'cancelled' | 'blocked';
      readonly reason: string;
      readonly authorityConsumed: false;
      readonly nativeAdapterInvoked: false;
    }
  | {
      readonly outcome: 'unknown-outcome';
      readonly reason: string;
      readonly residualRisk: ResidualRisk;
      readonly blindRetryBlocked: true;
      readonly onlyInspectReconcileExit: true;
    }
  | {
      readonly outcome: 'reconciled';
      readonly reason: string;
      readonly rollbackScopeLabel: RollbackScopeLabel;
      readonly referenceRepairAttempted: boolean;
      readonly fabricatedProtection: false;
    };

// --- Cancellation phase (AC #5) ---

export type CancellationPhase =
  | 'not-requested'
  | 'requested-before-dispatch-commit'
  | 'requested-after-dispatch-commit'
  | 'acknowledged-before-dispatch-commit'
  | 'acknowledged-after-dispatch-commit';

export interface CancellationState {
  readonly phase: CancellationPhase;
  readonly requested: boolean;
  readonly acknowledged: boolean;
  readonly outcome: 'cancelled' | 'still-running' | 'failed' | 'succeeded' | 'unknown-outcome';
  readonly effectAlreadyCommitted: boolean;
}

// --- Recovery command input ---

export interface RecoveryInspectInput {
  readonly operationId: OperationId;
  readonly journalEvents: readonly { readonly kind: string; readonly operationId: string }[];
  readonly checkpointMaterialState: CheckpointMaterialState;
}

export interface RecoveryReconcileInput {
  readonly operationId: OperationId;
  readonly journalEvents: readonly { readonly kind: string; readonly operationId: string }[];
  readonly checkpointRepo: {
    readonly detectIncompleteStages: () => readonly string[];
    readonly reconcile: () => { readonly removedCount: number; readonly markedUnreachableCount: number; readonly details: readonly string[] };
    readonly findByOperationId: (opId: OperationId) => { readonly checkpointId: string; readonly stageState: string; readonly coverageState: string } | null;
  };
}

export interface RecoveryExportInput {
  readonly operationId: OperationId;
  readonly journalEvents: readonly { readonly kind: string; readonly operationId: string; readonly payload?: Record<string, unknown> }[];
}

// --- AD-9 typed failure ---

export type RecoveryFailureCategory = 'operation-not-found' | 'journal-unavailable' | 'checkpoint-unavailable' | 'reconciliation-failed' | 'export-failed';

export interface RecoveryFailure {
  readonly category: RecoveryFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'recovery';
  readonly message: string;
  readonly causeCode: string;
}
