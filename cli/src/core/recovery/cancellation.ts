// Cancellation phases for interrupted operations (Story 3.15, AC #5, AD-13,
// AD-28). Cancellation requested before or after dispatch commit -> UI shows
// request + acknowledgement, distinguishes cancelled/still-running/failed/
// succeeded/unknown-outcome, and NEVER claims an already-committed native effect
// was cancelled (AD-28: effect-already-committed is a lifecycle fact, not
// succeeded).
//
// Pure, injectable: accepts all dependencies as parameters so it stays
// unit-testable without fs/network/journal.

import type { CancellationPhase, CancellationState } from './types.js';

// --- Journal event kind constants ---

const CANCEL_REQUEST_KINDS = new Set([
  'OperationCancelled',
  'AuthorizationRevoked',
]);

const CANCEL_ACKNOWLEDGE_KINDS = new Set([
  'OperationUnknownOutcome',
]);

const DISPATCH_COMMITTED_KIND = 'EffectDispatchCommitted';

const TERMINAL_KINDS = new Set([
  'OperationSucceeded',
  'OperationFailed',
  'OperationCancelled',
  'OperationUnknownOutcome',
]);

// --- Cancellation phase detection ---

export interface CancellationInput {
  readonly journalEvents: readonly { readonly kind: string; readonly operationId: string }[];
  readonly operationId: string;
}

/**
 * Determine the cancellation phase for an operation from journal evidence (AC #5).
 *
 * Examines the journal for cancel-request events, cancel-acknowledge events,
 * dispatch-committed events, and terminal events to determine the exact phase.
 *
 * NEVER claims an already-committed native effect was cancelled.
 * Distinguishes cancelled/still-running/failed/succeeded/unknown-outcome.
 *
 * @param input - journal events and operation id
 * @returns a CancellationState with phase, request/acknowledgement, outcome
 */
export function determineCancellationPhase(input: CancellationInput): CancellationState {
  const { journalEvents, operationId } = input;

  const opEvents = journalEvents.filter((e) => e.operationId === operationId);

  const hasCancelRequest = opEvents.some((e) => CANCEL_REQUEST_KINDS.has(e.kind));
  const hasCancelAcknowledge = opEvents.some((e) => CANCEL_ACKNOWLEDGE_KINDS.has(e.kind));
  const hasDispatchCommitted = opEvents.some((e) => e.kind === DISPATCH_COMMITTED_KIND);
  const terminalEvent = opEvents.find((e) => TERMINAL_KINDS.has(e.kind));

  // Determine the phase.
  let phase: CancellationPhase;
  if (!hasCancelRequest && !hasCancelAcknowledge) {
    phase = 'not-requested';
  } else if (hasCancelRequest && !hasCancelAcknowledge) {
    phase = hasDispatchCommitted
      ? 'requested-after-dispatch-commit'
      : 'requested-before-dispatch-commit';
  } else {
    // hasCancelAcknowledge
    phase = hasDispatchCommitted
      ? 'acknowledged-after-dispatch-commit'
      : 'acknowledged-before-dispatch-commit';
  }

  // Determine the outcome.
  let outcome: CancellationState['outcome'];
  if (terminalEvent) {
    switch (terminalEvent.kind) {
      case 'OperationSucceeded': outcome = 'succeeded'; break;
      case 'OperationFailed': outcome = 'failed'; break;
      case 'OperationCancelled': outcome = 'cancelled'; break;
      case 'OperationUnknownOutcome': outcome = 'unknown-outcome'; break;
      default: outcome = 'unknown-outcome'; break;
    }
  } else if (hasDispatchCommitted) {
    // Dispatch committed but no terminal event -> still-running.
    outcome = 'still-running';
  } else {
    outcome = 'cancelled';
  }

  // effect-already-committed is a lifecycle fact, not succeeded (AD-28).
  // If dispatch was committed, the effect was already committed regardless
  // of the terminal outcome. Even a subsequent cancellation event does not
  // undo the fact that the effect was dispatched.
  const effectAlreadyCommitted = hasDispatchCommitted;

  return {
    phase,
    requested: hasCancelRequest,
    acknowledged: hasCancelAcknowledge,
    outcome,
    effectAlreadyCommitted,
  };
}

/**
 * Build a human-readable summary of the cancellation state (AC #5).
 * Shows request + acknowledgement, distinguishes outcomes, and never claims
 * an already-committed native effect was cancelled.
 */
export function formatCancellationState(state: CancellationState): string {
  const parts: string[] = [];

  if (state.requested) {
    parts.push('Cancellation requested');
  }
  if (state.acknowledged) {
    parts.push('Cancellation acknowledged');
  }

  if (state.effectAlreadyCommitted) {
    parts.push('Effect was already committed before cancellation (AD-28: effect-already-committed is a lifecycle fact, not succeeded)');
  }

  parts.push(`Outcome: ${state.outcome}`);

  return parts.join('\n');
}
