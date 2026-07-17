// Retention calculation for rollback protection (Story 3.16 AC #1, AD-19, AD-20).
// A checkpoint is committed -> retention calculated: eligible for FIVE subsequent
// Prompt Rounds by default, supports a validated user-configured window, records
// expiry deterministically, and does NOT count unrelated Session or artifact
// retention as rollback protection.
//
// AD-19 rollback honesty: automatic rollback covers checkpointed built-in
// create/edit/delete ONLY. Shell, process, remote, permission, symlink-side,
// and external effects are NEVER claimed reversible.

import type { CheckpointId } from '../checkpoints/types.js';
import type { RetentionConfig, RetentionState } from './types.js';
import { DEFAULT_RETENTION_PROMPT_ROUNDS } from './types.js';

/**
 * Calculate retention for a checkpoint at the given creation Prompt Round.
 *
 * AC #1:
 * - Default: 5 subsequent Prompt Rounds.
 * - Supports a validated user-configured window.
 * - Expiry is deterministic: creationPromptRound + config.subsequentPromptRounds.
 * - Unrelated Session or artifact retention is NOT counted as rollback protection.
 *
 * @param checkpointId - The checkpoint to calculate retention for.
 * @param creationPromptRound - The Prompt Round at which the checkpoint was created.
 * @param currentPromptRound - The current Prompt Round (for retained check).
 * @param config - Optional user-configured retention window. Defaults to 5 rounds.
 * @returns The deterministic RetentionState.
 */
export function calculateRetention(
  checkpointId: CheckpointId,
  creationPromptRound: number,
  currentPromptRound: number,
  config?: RetentionConfig,
): RetentionState {
  const effectiveConfig = config ?? { subsequentPromptRounds: DEFAULT_RETENTION_PROMPT_ROUNDS };
  const expiryPromptRound = creationPromptRound + effectiveConfig.subsequentPromptRounds;
  const retained = currentPromptRound < expiryPromptRound;

  return {
    checkpointId,
    creationPromptRound,
    expiryPromptRound,
    retained,
    config: effectiveConfig,
  };
}

/**
 * Check whether a checkpoint has expired based on its retention state.
 * Expired checkpoints are hidden from rollback discovery (Story 3.12).
 *
 * @param state - The retention state to check.
 * @param currentPromptRound - The current Prompt Round.
 * @returns True if the checkpoint has expired.
 */
export function isExpired(state: RetentionState, currentPromptRound: number): boolean {
  return currentPromptRound >= state.expiryPromptRound;
}

/**
 * Compute the number of Prompt Rounds remaining before expiry.
 *
 * @param state - The retention state.
 * @param currentPromptRound - The current Prompt Round.
 * @returns The number of Prompt Rounds remaining (0 if expired).
 */
export function roundsRemaining(state: RetentionState, currentPromptRound: number): number {
  return Math.max(0, state.expiryPromptRound - currentPromptRound);
}

/**
 * Validate and create a user-configured retention window.
 * Returns the validated config or a failure with the reason.
 */
export { validateRetentionConfig } from './types.js';
