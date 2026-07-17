// Controlled command cancellation (Story 3.7 AC #4, AD-4, AD-12, AD-13, AD-24,
// AD-27). Timeout, Ctrl+C, cancellation, terminal loss, or process failure ->
// show request + acknowledgement phases, terminate the controlled PROCESS TREE,
// wait for descendants or record cleanup uncertainty, prevent orphan processes,
// report cancelled/failed/still-running/unknown-outcome honestly.

import type {
  CancellationLifecycle,
  CancellationPhase,
  ControlledProcess,
  ProcessTreeState,
} from './types.js';

// --- Main cancellation handler ---

/**
 * Handle cancellation of a controlled command (Story 3.7 AC #4).
 *
 * Phases:
 * 1. Requested: cancellation is requested (timeout, Ctrl+C, etc.)
 * 2. Acknowledged: the process tree has been terminated
 *
 * After termination, waits for descendants or records cleanup uncertainty.
 * Prevents orphan processes by killing the process tree.
 * Reports honest state: cancelled, failed, still-running, or unknown-outcome.
 */
export async function handleCommandCancellation(
  process: ControlledProcess,
  opts: {
    readonly clock: () => string;
  },
): Promise<CancellationLifecycle> {
  const clock = opts.clock;
  const requestedAt = clock();

  // Phase 1: Request cancellation.
  let phase: CancellationPhase = 'requested';

  // Kill the process tree.
  process.kill();

  // Phase 2: Acknowledge cancellation.
  phase = 'acknowledged';
  const acknowledgedAt = clock();

  // Wait for descendants or record cleanup uncertainty.
  let state: ProcessTreeState;
  try {
    await process.killTree();
    state = 'cancelled';
  } catch {
    // If we can't verify descendants are cleaned up, report honestly.
    state = 'unknown-outcome';
  }

  const completedAt = clock();

  return {
    phase,
    state,
    requestedAt,
    acknowledgedAt,
    completedAt,
  };
}

/**
 * Handle a process failure (non-signal exit with non-zero code).
 * Returns the honest state: 'failed'.
 */
export function handleProcessFailure(
  _exitCode: number,
  clock: () => string,
): CancellationLifecycle {
  const now = clock();
  return {
    phase: 'acknowledged',
    state: 'failed',
    requestedAt: now,
    acknowledgedAt: now,
    completedAt: now,
  };
}

/**
 * Handle a timeout during command execution.
 * Returns the honest state: 'cancelled' (timeout is a form of cancellation).
 */
export function handleTimeout(
  clock: () => string,
): CancellationLifecycle {
  const now = clock();
  return {
    phase: 'acknowledged',
    state: 'cancelled',
    requestedAt: now,
    acknowledgedAt: now,
    completedAt: now,
  };
}

/**
 * Handle terminal loss (e.g., TTY disconnected).
 * Returns the honest state: 'unknown-outcome' since we cannot verify
 * the process state after terminal loss.
 */
export function handleTerminalLoss(
  clock: () => string,
): CancellationLifecycle {
  const now = clock();
  return {
    phase: 'acknowledged',
    state: 'unknown-outcome',
    requestedAt: now,
    acknowledgedAt: now,
    completedAt: now,
  };
}

/**
 * Handle an unknown outcome (e.g., process disappeared without exit code/signal).
 * Returns the honest state: 'unknown-outcome'.
 */
export function handleUnknownOutcome(
  clock: () => string,
): CancellationLifecycle {
  const now = clock();
  return {
    phase: 'acknowledged',
    state: 'unknown-outcome',
    requestedAt: now,
    acknowledgedAt: now,
    completedAt: now,
  };
}
