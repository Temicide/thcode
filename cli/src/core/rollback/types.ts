// Rollback discovery typed contracts (Story 3.12, AD-6, AD-19, AD-20, AD-24,
// AD-28). Discriminated unions, opaque branded ids, no `any`. Every failure
// uses the AD-9 typed envelope. No raw bytes in preview (AD-24 — digests/
// metadata only). UTF-8/Thai preserved through every layer.
//
// AD-19 rollback honesty: automatic rollback covers checkpointed built-in
// create/edit/delete ONLY. Shell, process, remote, permission, symlink-side,
// and external effects are NEVER claimed reversible.

import type { CheckpointId, IntegrityState } from '../checkpoints/types.js';
import type { PromptRoundId } from '../protocol/ids.js';
import type { WorkspaceIdentity } from '../workspace/types.js';
import type { DurableEvent } from '../protocol/events.js';

// --- Excluded effects (AD-19) ---

/**
 * Every excluded effect category that is NEVER claimed reversible (AD-19).
 * Each effect is explicitly `excluded` or `never-protected` so the summary
 * never implies the whole Prompt Round is reversible.
 */
export interface ExcludedEffects {
  readonly shell: readonly ExcludedEffectEntry[];
  readonly remote: readonly ExcludedEffectEntry[];
  readonly permission: readonly ExcludedEffectEntry[];
  readonly process: readonly ExcludedEffectEntry[];
  readonly symlinkSide: readonly ExcludedEffectEntry[];
  readonly external: readonly ExcludedEffectEntry[];
  readonly unknown: readonly ExcludedEffectEntry[];
}

export interface ExcludedEffectEntry {
  readonly target: string;
  readonly reason: string;
  readonly reasonCode: string;
  readonly status: 'excluded' | 'never-protected';
}

// --- Checkpoint coverage for rollback ---

export type RollbackCoverage =
  | 'fully protected'
  | 'partially protected'
  | 'unprotected'
  | 'expired'
  | 'corrupt'
  | 'locked';

// --- CheckpointSummary ---

export interface CheckpointSummary {
  readonly promptRoundId: PromptRoundId;
  readonly checkpointId: CheckpointId;
  readonly createdAt: string;
  readonly observedAt: string;
  /** Age in milliseconds since the checkpoint was created (subsequent-prompt age). */
  readonly subsequentPromptAgeMs: number;
  /** Number of targets (files) covered by this checkpoint. */
  readonly targetCount: number;
  /** Pre-image digests per target (hex SHA-256). */
  readonly preDigests: readonly string[];
  /** Post-image digests per target (hex SHA-256). */
  readonly postDigests: readonly string[];
  /** Rename/alias information. */
  readonly renameInfo: readonly RenameInfoEntry[];
  /** Retention expiry timestamp (ISO-8601), or null if indefinite. */
  readonly retentionExpiry: string | null;
  /** Per-checkpoint usage in bytes. */
  readonly perCheckpointUsageBytes: number;
  /** Total store usage in bytes. */
  readonly storeUsageBytes: number;
  /** Encryption state. */
  readonly encryptionState: 'encrypted' | 'unencrypted';
  /** Integrity state. */
  readonly integrityState: IntegrityState;
  /** Rollback coverage. */
  readonly coverage: RollbackCoverage;
  /** Excluded effects (AD-19). */
  readonly excludedEffects: ExcludedEffects;
}

export interface RenameInfoEntry {
  readonly from: string;
  readonly to: string;
  readonly isRename: boolean;
}

// --- RollbackEligibility ---

export type RollbackEligibility =
  | { readonly kind: 'apply-eligible' }
  | { readonly kind: 'hidden'; readonly reason: string }
  | { readonly kind: 'non-authoritative-recovery-record'; readonly reason: string };

// --- RollbackPreview (canonical order: heading, purpose, risk, target,
// authority, Evidence completeness, outcome, next step) ---

export interface RollbackPreview {
  /** Canonical heading (e.g. "ROLLBACK INSPECT"). */
  readonly heading: string;
  /** Purpose of this preview. */
  readonly purpose: string;
  /** Risk disclosure (AD-19). */
  readonly risk: string;
  /** Target checkpoint identity. */
  readonly target: string;
  /** Authority context. */
  readonly authority: string;
  /** Evidence completeness. */
  readonly evidenceCompleteness: string;
  /** Outcome summary. */
  readonly outcome: string;
  /** Next step / available actions. */
  readonly nextStep: string;
  /** Exact rollback tokens (no color-only meaning). */
  readonly rollbackTokens: readonly string[];
  /** The full summary data backing this preview. */
  readonly summary: CheckpointSummary;
  /** Eligibility for rollback. */
  readonly eligibility: RollbackEligibility;
}

// --- Discover options ---

export interface DiscoverOptions {
  readonly maxCheckpoints?: number;
  readonly includeHidden?: boolean;
}

// --- AD-9 typed failure envelope ---

export type RollbackFailureCategory =
  | 'checkpoint-not-found'
  | 'checkpoint-unreadable'
  | 'session-not-found'
  | 'internal-error';

export interface RollbackFailure {
  readonly category: RollbackFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'rollback';
  readonly message: string;
  readonly causeCode: string;
  readonly retryAfter?: number;
}

// --- List result ---

export type ListCheckpointsResult =
  | { readonly ok: true; readonly checkpoints: readonly CheckpointSummary[] }
  | { readonly ok: false; readonly failure: RollbackFailure };

// --- Inspect result ---

export type InspectCheckpointResult =
  | { readonly ok: true; readonly preview: RollbackPreview }
  | { readonly ok: false; readonly failure: RollbackFailure };

// --- Three-way analysis types (Story 3.13, AD-6, AD-19, AD-20, AD-24, AD-28) ---

/**
 * The state of a file at a point in time: present with digest/version, absent,
 * or unknown (inaccessible).
 */
export type ThreeWayState =
  | { readonly kind: 'present'; readonly digest: string; readonly version: string | null }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unknown' };

/**
 * The outcome of analyzing a single rollback target.
 * - `applied-eligible`: current state matches post-image, identity unchanged.
 * - `conflict`: current state differs, later edit overlaps, or behind symlink/mount.
 * - `skipped`: target was explicitly excluded or not covered.
 * - `inaccessible`: cannot read current state (permissions, missing).
 * - `mismatch`: identity changed (renamed, recreated, case/unicode).
 * - `unknown-outcome`: concurrency/open-handle state uncertain.
 */
export type AnalysisOutcome =
  | {
      readonly kind: 'applied-eligible';
      readonly inverseOperation: InverseOperation;
      readonly expectedCurrentDigest: string;
      readonly expectedCurrentVersion: string | null;
      readonly renameHandling: RenameHandling | null;
    }
  | {
      readonly kind: 'conflict';
      readonly reason: string;
      readonly reasonCode: string;
      readonly safeChoices: readonly SafeChoice[];
    }
  | { readonly kind: 'skipped'; readonly reason: string }
  | { readonly kind: 'inaccessible'; readonly reason: string; readonly causeCode: string }
  | { readonly kind: 'mismatch'; readonly reason: string; readonly reasonCode: string }
  | { readonly kind: 'unknown-outcome'; readonly reason: string };

/**
 * The concrete inverse operation to apply for an applied-eligible target.
 * - `restore-pre-image`: write the pre-image content back (text file).
 * - `delete-file`: remove the file (inverse of create).
 * - `restore-from-artifact`: restore from encrypted artifact store (binary).
 */
export type InverseOperation =
  | { readonly kind: 'restore-pre-image'; readonly preImageDigest: string }
  | { readonly kind: 'delete-file' }
  | { readonly kind: 'restore-from-artifact'; readonly artifactId: string };

export interface RenameHandling {
  readonly originalPath: string;
  readonly currentPath: string;
  readonly isRename: boolean;
}

/**
 * Safe choices available when a conflict is detected (AC #5).
 * Generic overwrite, continue, and blind retry are UNAVAILABLE.
 */
export type SafeChoice =
  | { readonly kind: 'skip-target' }
  | { readonly kind: 'export-sanitized-patch' }
  | { readonly kind: 'rebase-new-path'; readonly newPath: string }
  | { readonly kind: 'user-authored-resolution' };

/**
 * Per-target analysis result from three-way comparison.
 */
export interface TargetAnalysis {
  readonly target: {
    readonly canonicalPath: string;
    readonly displayPath: string;
  };
  readonly preImage: ThreeWayState;
  readonly postImage: ThreeWayState;
  readonly currentState: ThreeWayState;
  readonly outcome: AnalysisOutcome;
  readonly identityChanged: boolean;
  readonly isBinary: boolean;
}

/**
 * Aggregate analysis for a set of rollback targets.
 */
export interface RollbackAnalysis {
  readonly checkpointId: CheckpointId;
  readonly perTarget: readonly TargetAnalysis[];
  readonly overallEligible: boolean;
  readonly eligibleCount: number;
  readonly conflictCount: number;
  readonly skippedCount: number;
  readonly inaccessibleCount: number;
  readonly mismatchCount: number;
  readonly unknownCount: number;
}

/**
 * Input describing a single rollback target for analysis.
 */
export interface RollbackTarget {
  readonly canonicalPath: string;
  readonly displayPath: string;
  readonly preImageDigest: string | null;
  readonly postImageDigest: string | null;
  readonly isBinary: boolean;
  readonly artifactId: string | null;
  readonly effectKind: 'create_file' | 'edit_file' | 'delete_file';
}

/**
 * Injectable filesystem probe for rollback analysis.
 * Extends the workspace FsProbe with accessibility and open-handle checks.
 */
export interface AnalysisFsProbe {
  readFile(path: string): Uint8Array;
  lstat(path: string): {
    dev: number;
    ino: number;
    size: number;
    isDirectory: boolean;
    isFile: boolean;
    isSymbolicLink: boolean;
  };
  realpath(path: string): string;
  stat(path: string): {
    dev: number;
    ino: number;
    size: number;
    isDirectory: boolean;
    isFile: boolean;
  };
  isAccessible(path: string): boolean;
  hasOpenHandles(path: string): boolean;
}

/**
 * Context for rollback analysis (injectable dependencies).
 */
export interface AnalysisContext {
  readonly fsProbe: AnalysisFsProbe;
  readonly checkpointRepo: import('../checkpoints/checkpointRepository.js').CheckpointRepository;
  readonly artifactStore?: import('../checkpoints/artifactStore.js').ArtifactStore;
  readonly clock: () => string;
}

// --- AD-9 typed failure envelope for analysis ---

export type AnalysisFailureCategory = 'checkpoint-not-found' | 'checkpoint-unreadable' | 'internal-error';

export interface AnalysisFailure {
  readonly category: AnalysisFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'rollback-analysis';
  readonly message: string;
  readonly causeCode: string;
}

// --- Analysis result ---

export type AnalyzeRollbackResult =
  | { readonly ok: true; readonly analysis: RollbackAnalysis }
  | { readonly ok: false; readonly failure: AnalysisFailure };

// --- Story 3.14: Apply conflict-free rollback targets ---

/**
 * Injectable filesystem probe for rollback apply.
 * Extends the workspace FsProbe with write, delete, accessibility, and
 * open-handle checks needed for applying inverse operations.
 */
export interface ApplyFsProbe {
  readFile(path: string): Uint8Array;
  writeFile(path: string, content: Uint8Array): void;
  deleteFile(path: string): void;
  lstat(path: string): {
    dev: number;
    ino: number;
    size: number;
    isDirectory: boolean;
    isFile: boolean;
    isSymbolicLink: boolean;
  };
  realpath(path: string): string;
  stat(path: string): {
    dev: number;
    ino: number;
    size: number;
    isDirectory: boolean;
    isFile: boolean;
  };
  isAccessible(path: string): boolean;
  hasOpenHandles(path: string): boolean;
  mkdir(dir: string): void;
}

/**
 * Per-target outcome of applying a rollback inverse operation.
 * - `applied`: the inverse operation was applied successfully.
 * - `skipped`: target was explicitly excluded or not covered.
 * - `conflict`: current state differs from expected — no change made.
 * - `inaccessible`: cannot read/write current state.
 * - `mismatch`: identity changed (renamed, recreated, case/unicode).
 * - `unknown-outcome`: concurrency/open-handle state uncertain.
 */
export type ApplyTargetOutcome =
  | {
      readonly kind: 'applied';
      readonly target: { readonly canonicalPath: string; readonly displayPath: string };
      readonly inverseOperation: InverseOperation;
      readonly preImageDigest: string | null;
      readonly postImageDigest: string | null;
    }
  | {
      readonly kind: 'skipped';
      readonly target: { readonly canonicalPath: string; readonly displayPath: string };
      readonly reason: string;
    }
  | {
      readonly kind: 'conflict';
      readonly target: { readonly canonicalPath: string; readonly displayPath: string };
      readonly reason: string;
      readonly reasonCode: string;
      readonly safeChoices: readonly SafeChoice[];
    }
  | {
      readonly kind: 'inaccessible';
      readonly target: { readonly canonicalPath: string; readonly displayPath: string };
      readonly reason: string;
      readonly causeCode: string;
    }
  | {
      readonly kind: 'mismatch';
      readonly target: { readonly canonicalPath: string; readonly displayPath: string };
      readonly reason: string;
      readonly reasonCode: string;
    }
  | {
      readonly kind: 'unknown-outcome';
      readonly target: { readonly canonicalPath: string; readonly displayPath: string };
      readonly reason: string;
    };

/**
 * Aggregate result type for a rollback apply operation.
 * - `full`: all selected targets were applied successfully.
 * - `partial`: some targets applied, some had issues.
 * - `blocked`: no targets could be applied.
 */
export type RollbackApplyResultType = 'full' | 'partial' | 'blocked';

/**
 * Result of applying a set of rollback inverse operations.
 * Includes per-target outcomes, aggregate type, residual conflicts,
 * excluded effects, and checkpoint reference.
 */
export interface RollbackApplyResult {
  readonly checkpointId: CheckpointId;
  readonly aggregate: RollbackApplyResultType;
  readonly perTarget: readonly ApplyTargetOutcome[];
  readonly appliedCount: number;
  readonly skippedCount: number;
  readonly conflictCount: number;
  readonly inaccessibleCount: number;
  readonly mismatchCount: number;
  readonly unknownCount: number;
  readonly residualConflicts: readonly {
    readonly target: { readonly canonicalPath: string; readonly displayPath: string };
    readonly reason: string;
    readonly reasonCode: string;
    readonly safeChoices: readonly SafeChoice[];
  }[];
  readonly excludedEffects: ExcludedEffects;
  readonly checkpointCreated: boolean;
  readonly checkpointIdAfter?: CheckpointId;
}

/**
 * Context for rollback apply (injectable dependencies).
 */
export interface ApplyContext {
  readonly fsProbe: ApplyFsProbe;
  readonly checkpointRepo: import('../checkpoints/checkpointRepository.js').CheckpointRepository;
  readonly artifactStore?: import('../checkpoints/artifactStore.js').ArtifactStore;
  readonly journal: { append(event: DurableEvent): number };
  readonly sessionId: string;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly workspace: WorkspaceIdentity;
  readonly clock: () => string;
}

// --- AD-9 typed failure envelope for apply ---

export type ApplyFailureCategory = 'checkpoint-not-found' | 'checkpoint-unreadable' | 'internal-error';

export interface ApplyFailure {
  readonly category: ApplyFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'rollback-apply';
  readonly message: string;
  readonly causeCode: string;
}

// --- Apply result (top-level) ---

export type RollbackApplyResultOrFailure =
  | { readonly ok: true; readonly result: RollbackApplyResult }
  | { readonly ok: false; readonly failure: ApplyFailure };
