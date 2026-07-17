// Retention, capacity, and cleanup typed contracts (Story 3.16, AD-19, AD-20,
// AD-21, AD-24, AD-26). Discriminated unions, opaque branded ids, no `any`.
// Every failure uses the AD-9 typed envelope. No raw bytes in output (AD-24).
// UTF-8/Thai preserved through every layer.
//
// AD-19 rollback honesty: automatic rollback covers checkpointed built-in
// create/edit/delete ONLY. Shell, process, remote, permission, symlink-side,
// and external effects are NEVER claimed reversible. Over-cap actions require
// explicit confirmation without rollback protection.

import type { CheckpointId } from '../checkpoints/types.js';

// --- RetentionConfig ---

/**
 * User-configured retention window for rollback protection.
 * Default: 5 subsequent Prompt Rounds. Validated at configuration time.
 * The window is measured in Prompt Rounds, not wall-clock time, so it
 * remains predictable regardless of session activity.
 */
export interface RetentionConfig {
  /** Number of subsequent Prompt Rounds to retain rollback protection.
   * Default is 5. Must be >= 1. */
  readonly subsequentPromptRounds: number;
}

/** Default retention window: 5 subsequent Prompt Rounds. */
export const DEFAULT_RETENTION_PROMPT_ROUNDS = 5;

/** Minimum allowed retention window. */
export const MIN_RETENTION_PROMPT_ROUNDS = 1;

/** Maximum allowed retention window. */
export const MAX_RETENTION_PROMPT_ROUNDS = 100;

/**
 * Validate a user-configured retention window.
 * Returns the validated config or a failure with the reason.
 */
export type RetentionConfigValidationResult =
  | { readonly ok: true; readonly config: RetentionConfig }
  | { readonly ok: false; readonly failure: RetentionConfigFailure };

export interface RetentionConfigFailure {
  readonly category: 'invalid-retention-config';
  readonly retryable: false;
  readonly scope: 'retention';
  readonly message: string;
  readonly causeCode: string;
}

export function validateRetentionConfig(rounds: number): RetentionConfigValidationResult {
  if (!Number.isInteger(rounds) || rounds < MIN_RETENTION_PROMPT_ROUNDS) {
    return {
      ok: false,
      failure: {
        category: 'invalid-retention-config',
        retryable: false,
        scope: 'retention',
        message: `Retention window must be at least ${MIN_RETENTION_PROMPT_ROUNDS} Prompt Round(s), got ${rounds}`,
        causeCode: 'retention-window-too-small',
      },
    };
  }
  if (rounds > MAX_RETENTION_PROMPT_ROUNDS) {
    return {
      ok: false,
      failure: {
        category: 'invalid-retention-config',
        retryable: false,
        scope: 'retention',
        message: `Retention window must be at most ${MAX_RETENTION_PROMPT_ROUNDS} Prompt Rounds, got ${rounds}`,
        causeCode: 'retention-window-too-large',
      },
    };
  }
  return { ok: true, config: { subsequentPromptRounds: rounds } };
}

// --- RetentionState ---

/**
 * Deterministic retention state for a checkpoint.
 * Expiry is computed deterministically from the checkpoint's creation Prompt
 * Round and the configured window. Unrelated Session or artifact retention
 * is NOT counted as rollback protection.
 */
export interface RetentionState {
  readonly checkpointId: CheckpointId;
  /** The Prompt Round at which this checkpoint was created. */
  readonly creationPromptRound: number;
  /** The Prompt Round at which this checkpoint expires (exclusive).
   * Expiry = creationPromptRound + config.subsequentPromptRounds. */
  readonly expiryPromptRound: number;
  /** Whether the checkpoint is currently retained (not expired). */
  readonly retained: boolean;
  /** The configured window that produced this state. */
  readonly config: RetentionConfig;
}

// --- CapacityUsage ---

/**
 * Capacity usage snapshot for a checkpoint or store.
 * Per-checkpoint cap: 100 MB. Store cap: 500 MB (AD-19).
 * Constants are imported from mutations/types.js to avoid duplication.
 */
export interface CapacityUsage {
  /** Size of the proposed checkpoint in bytes. */
  readonly checkpointSizeBytes: number;
  /** Current total store usage in bytes. */
  readonly storeUsageBytes: number;
  /** Estimated store usage after this operation. */
  readonly estimatedStoreUsageBytes: number;
  /** Per-checkpoint cap in bytes (100 MB). */
  readonly perCheckpointCapBytes: number;
  /** Store cap in bytes (500 MB). */
  readonly storeCapBytes: number;
  /** True when both caps are within limits. */
  readonly withinLimits: boolean;
}

// --- OverCapResult ---

/**
 * Result of evaluating a proposed checkpoint against capacity caps.
 * When over-cap, identifies exact usage and unprotected scope.
 * Does NOT silently evict active protection.
 */
export type OverCapResult =
  | { readonly ok: true; readonly usage: CapacityUsage }
  | {
      readonly ok: false;
      readonly overCap: true;
      readonly usage: CapacityUsage;
      /** Human-readable description of what exceeds the cap. */
      readonly overCapReason: string;
      /** The unprotected scope: targets that would proceed without protection. */
      readonly unprotectedScope: OverCapUnprotectedScope;
      /** Whether explicit confirmation is required to proceed. */
      readonly requiresExplicitConfirmation: true;
    };

export interface OverCapUnprotectedScope {
  readonly targets: readonly string[];
  readonly residualRisk: string;
  readonly reason: string;
}

// --- CleanupOutcome ---

/**
 * Outcome of a cleanup operation on a checkpoint.
 * - `removed`: checkpoint and all its data were successfully removed.
 * - `recovery-locked`: cleanup was interrupted or partially completed;
 *   the checkpoint is locked for recovery.
 * - `corrupt`: cleanup encountered an integrity failure.
 */
export type CleanupOutcome =
  | { readonly kind: 'removed'; readonly checkpointId: CheckpointId }
  | {
      readonly kind: 'recovery-locked';
      readonly checkpointId: CheckpointId;
      readonly reason: string;
      readonly causeCode: string;
      readonly secureDeletionLimitation: string | null;
      readonly safeActions: readonly SafeCleanupAction[];
    }
  | {
      readonly kind: 'corrupt';
      readonly checkpointId: CheckpointId;
      readonly reason: string;
      readonly causeCode: string;
      readonly secureDeletionLimitation: string | null;
      readonly safeActions: readonly SafeCleanupAction[];
    };

export type SafeCleanupAction =
  | { readonly kind: 'inspect' }
  | { readonly kind: 'exit' };

// --- CleanupLifecycleEvent ---

/**
 * A journaled event in the cleanup lifecycle.
 * The cleanup lifecycle is crash-consistent: each step is journaled before
 * the corresponding mutation, so an interruption can be detected and resumed.
 */
export type CleanupLifecycleEvent =
  | { readonly kind: 'cleanup-started'; readonly checkpointId: CheckpointId; readonly timestamp: string }
  | { readonly kind: 'cleanup-removed-encrypted-originals'; readonly checkpointId: CheckpointId; readonly artifactIds: readonly string[]; readonly timestamp: string }
  | { readonly kind: 'cleanup-removed-metadata'; readonly checkpointId: CheckpointId; readonly timestamp: string }
  | { readonly kind: 'cleanup-removed-staging-files'; readonly checkpointId: CheckpointId; readonly timestamp: string }
  | { readonly kind: 'cleanup-removed-unreachable-references'; readonly checkpointId: CheckpointId; readonly refCount: number; readonly timestamp: string }
  | { readonly kind: 'cleanup-completed'; readonly checkpointId: CheckpointId; readonly timestamp: string }
  | { readonly kind: 'cleanup-failed'; readonly checkpointId: CheckpointId; readonly reason: string; readonly causeCode: string; readonly timestamp: string }
  | { readonly kind: 'cleanup-recovery-locked'; readonly checkpointId: CheckpointId; readonly reason: string; readonly causeCode: string; readonly timestamp: string };

// --- AD-9 typed failure envelope ---

export type RetentionFailureCategory =
  | 'invalid-retention-config'
  | 'checkpoint-not-found'
  | 'cleanup-failed'
  | 'store-locked'
  | 'key-locked'
  | 'reference-count-inconsistent'
  | 'deletion-failed'
  | 'internal-error';

export interface RetentionFailure {
  readonly category: RetentionFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'retention' | 'cleanup';
  readonly message: string;
  readonly causeCode: string;
  readonly retryAfter?: number;
}

// --- Retention status for rendering ---

export interface RetentionStatus {
  readonly checkpointId: CheckpointId;
  readonly encryptionState: 'encrypted' | 'unencrypted';
  readonly integrityState: string;
  readonly ageMs: number;
  readonly retentionWindow: number;
  readonly expiryPromptRound: number | null;
  readonly capUsage: CapacityUsage | null;
  readonly exclusions: readonly string[];
  readonly nextSteps: readonly string[];
}

// --- Cleanup context (injectable dependencies) ---

export interface CleanupContext {
  readonly clock: () => string;
  readonly journal: { append(event: CleanupLifecycleEvent): void };
  readonly kvStore: {
    get(key: string): string | undefined;
    put(key: string, value: string): void;
    delete(key: string): void;
    list(prefix: string): string[];
  };
  readonly blobStore: {
    get(key: string): Uint8Array | undefined;
    put(key: string, value: Uint8Array): void;
    delete(key: string): void;
    list(prefix: string): string[];
  };
  readonly storeLocked: () => boolean;
  readonly keyLocked: () => boolean;
}
