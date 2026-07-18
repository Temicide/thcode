// Recovery classification from journal evidence (Story 3.15, AC #1, AD-3, AD-13,
// AD-20, AD-28). The process stops during identity capture, authorization,
// checkpoint staging, durable-stage commit, dispatch commit, native mutation,
// post-image capture, or terminal publication -> startup or `/recover inspect`
// classifies the operation from the journal, detects unreachable/incomplete
// checkpoint material (Story 3.2 detectIncompleteStages), and NEVER replays a
// native effect automatically.
//
// Pure, injectable: accepts all dependencies as parameters so it stays
// unit-testable without fs/network/journal.

import type { OperationId } from '../protocol/ids.js';
import type { OperationState } from '../sessions/operationState.js';
import type {
  CheckpointMaterialState,
  DispatchClassification,
  OperationRecoveryState,
  RecoveryClassification,
  RecoveryFailure,
  ResidualRisk,
} from './types.js';

// --- Journal event kind constants ---

const LIFECYCLE_KINDS = new Set([
  'EffectDispatchCommitted',
]);

const TERMINAL_KINDS = new Set([
  'OperationSucceeded',
  'OperationFailed',
  'OperationBlocked',
  'OperationCancelled',
  'OperationUnknownOutcome',
]);

const PROPOSAL_KINDS = new Set([
  'PromptSubmitted',
  'ApprovalGranted',
  'AuthorizationConsumed',
]);

const PREPARATION_KINDS = new Set([
  'EvidenceRecorded',
  'AuthorityEvidenceRecorded',
]);

// --- Classification helpers ---

function classifyOperationState(
  hasLifecycle: boolean,
  hasTerminal: boolean,
  terminalKind: string | null,
  hasProposal: boolean,
  hasPreparation: boolean,
): OperationRecoveryState {
  if (!hasLifecycle && !hasTerminal) {
    // No lifecycle-fact event at all.
    if (hasProposal || hasPreparation) return 'prepared';
    return 'not-sent';
  }

  if (hasLifecycle && !hasTerminal) {
    return 'dispatch-committed';
  }

  // Terminal event exists.
  switch (terminalKind) {
    case 'OperationSucceeded': return 'succeeded';
    case 'OperationFailed': return 'failed';
    case 'OperationCancelled': return 'cancelled';
    case 'OperationUnknownOutcome': return 'unknown-outcome';
    case 'OperationBlocked': return 'cancelled';
    default: return 'unknown-outcome';
  }
}

function classifyDispatch(hasLifecycle: boolean, hasTerminal: boolean, _terminalKind: string | null): DispatchClassification {
  if (!hasLifecycle && !hasTerminal) return 'not-dispatched';
  if (hasLifecycle && !hasTerminal) return 'post-dispatch-commit';
  if (hasTerminal) return 'terminal-evidence-recorded';
  return 'not-dispatched';
}

function residualRiskForState(state: OperationRecoveryState): ResidualRisk {
  switch (state) {
    case 'not-sent':
      return { description: 'No operation evidence found; no risk of duplicate mutation', scope: 'none', severity: 'none' };
    case 'prepared':
      return { description: 'Preparation started but no dispatch commit; checkpoint material may be incomplete', scope: 'duplicate-mutation', severity: 'low' };
    case 'dispatch-committed':
      return { description: 'Effect dispatched but no terminal outcome; native mutation may have committed', scope: 'unproven-outcome', severity: 'high' };
    case 'succeeded':
      return { description: 'Operation completed successfully', scope: 'none', severity: 'none' };
    case 'failed':
      return { description: 'Operation failed deterministically', scope: 'none', severity: 'none' };
    case 'cancelled':
      return { description: 'Operation cancelled before dispatch commit', scope: 'none', severity: 'none' };
    case 'unknown-outcome':
      return { description: 'No terminal proof; native mutation may have committed', scope: 'unproven-outcome', severity: 'high' };
  }
}

// --- Checkpoint material detection ---

export interface CheckpointMaterialInput {
  readonly incompleteStageIds: readonly string[];
  readonly operationCheckpoint: { readonly stageState: string; readonly integrityState: string } | null;
}

/**
 * Detect unreachable/incomplete checkpoint material for an operation (AC #1).
 * Delegates to Story 3.2's detectIncompleteStages surface.
 * Returns the checkpoint material state for the classification.
 */
export function detectCheckpointMaterial(input: CheckpointMaterialInput): CheckpointMaterialState {
  const { incompleteStageIds, operationCheckpoint } = input;

  if (operationCheckpoint === null) {
    // No checkpoint record for this operation.
    if (incompleteStageIds.length > 0) return 'incomplete';
    return 'not-applicable';
  }

  if (operationCheckpoint.stageState === 'unreachable') return 'unreachable';
  if (operationCheckpoint.integrityState === 'corrupt' || operationCheckpoint.integrityState === 'recovery-locked') return 'corrupt';
  if (operationCheckpoint.stageState === 'staging' || operationCheckpoint.stageState === 'staged') return 'incomplete';

  // Check if this operation's checkpoint is among the incomplete stages.
  if (incompleteStageIds.length > 0) return 'incomplete';

  return 'complete';
}

// --- Main classification ---

export interface ClassifyInput {
  readonly operationId: OperationId;
  readonly journalEvents: readonly { readonly kind: string; readonly operationId: string }[];
  readonly incompleteStageIds: readonly string[];
  readonly operationCheckpoint: { readonly stageState: string; readonly integrityState: string } | null;
}

export type ClassifyResult =
  | { ok: true; classification: RecoveryClassification }
  | { ok: false; failure: RecoveryFailure };

/**
 * Classify an operation from journal evidence (AC #1).
 *
 * Examines the journal for lifecycle-fact events (EffectDispatchCommitted),
 * terminal events, proposal/preparation events, and checkpoint material.
 * NEVER replays a native effect automatically.
 *
 * @param input - operation id, journal events, checkpoint material
 * @returns a RecoveryClassification with the operation's recovery state
 */
export function classify(input: ClassifyInput): ClassifyResult {
  const { operationId, journalEvents, incompleteStageIds, operationCheckpoint } = input;

  if (journalEvents.length === 0) {
    return {
      ok: false,
      failure: {
        category: 'operation-not-found',
        retryable: false,
        scope: 'recovery',
        message: `No journal events found for operation ${operationId}`,
        causeCode: 'no-journal-events',
      },
    };
  }

  // Filter events for this operation.
  const opEvents = journalEvents.filter((e) => e.operationId === operationId);

  if (opEvents.length === 0) {
    return {
      ok: false,
      failure: {
        category: 'operation-not-found',
        retryable: false,
        scope: 'recovery',
        message: `No journal events found for operation ${operationId}`,
        causeCode: 'no-journal-events',
      },
    };
  }

  const hasLifecycle = opEvents.some((e) => LIFECYCLE_KINDS.has(e.kind));
  const terminalEvent = opEvents.find((e) => TERMINAL_KINDS.has(e.kind));
  const hasTerminal = terminalEvent !== undefined;
  const terminalKind = terminalEvent?.kind ?? null;
  const hasProposal = opEvents.some((e) => PROPOSAL_KINDS.has(e.kind));
  const hasPreparation = opEvents.some((e) => PREPARATION_KINDS.has(e.kind));

  const journalState = classifyOperationState(hasLifecycle, hasTerminal, terminalKind, hasProposal, hasPreparation);
  const checkpointMaterial = detectCheckpointMaterial({ incompleteStageIds, operationCheckpoint });
  const residualRisk = residualRiskForState(journalState);
  const dispatchClassification = classifyDispatch(hasLifecycle, hasTerminal, terminalKind);

  // Derive the AD-13 operation state from the recovery state.
  const operationState = journalStateToOperationState(journalState);

  return {
    ok: true,
    classification: {
      operationId,
      journalState,
      operationState,
      checkpointMaterial,
      residualRisk,
      dispatchClassification,
      hasEffectDispatchCommitted: hasLifecycle,
      hasTerminalEvent: hasTerminal,
      terminalKind,
    },
  };
}

/**
 * Map a recovery state to the AD-13 operation state machine state.
 */
function journalStateToOperationState(state: OperationRecoveryState): OperationState {
  switch (state) {
    case 'not-sent': return 'proposed';
    case 'prepared': return 'prepared';
    case 'dispatch-committed': return 'dispatch-committed';
    case 'succeeded': return 'succeeded';
    case 'failed': return 'failed';
    case 'cancelled': return 'cancelled';
    case 'unknown-outcome': return 'unknown-outcome';
  }
}
