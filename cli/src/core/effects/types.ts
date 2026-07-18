// File effect typed contracts (Story 3.5, AD-4, AD-12, AD-13, AD-19, AD-20,
// AD-24, AD-27). Discriminated unions, opaque branded ids, no `any`. Every
// failure uses the AD-9 typed envelope.

import type { OperationId } from '../protocol/ids.js';
import type { CoverageState, CheckpointId } from '../checkpoints/types.js';
import type { ExcludedEffect } from '../mutations/types.js';

// --- FsMutator: injectable file-system mutation port ---

export interface FsMutator {
  writeFile(path: string, content: Uint8Array): void;
  mkdir(dir: string): void;
}

// --- FileEffectProposal (effect-level, after authorization) ---

export interface FileEffectProposal {
  readonly kind: 'create_file' | 'edit_file';
  readonly operationId: OperationId;
  readonly target: {
    readonly canonicalPath: string;
    readonly displayPath: string;
  };
  readonly expectedPreImage: {
    readonly digest: string | null;
    readonly version: string | null;
    readonly absent: boolean;
  };
  readonly content: Uint8Array;
  readonly contentSummary: string;
  readonly postImageDigest: string;
  readonly postImageSizeBytes: number;
  readonly lineCount: number;
  readonly exclusions: readonly ExcludedEffect[];
  readonly checkpointCoverage: CoverageState;
  readonly authorizationId: string;
  readonly activationId: string;
  readonly activationRevision: number;
}

// --- FileEffectPreview (AC #1) ---

export interface FileEffectPreview {
  readonly kind: 'create_file' | 'edit_file';
  readonly operationId: OperationId;
  readonly target: {
    readonly canonicalPath: string;
    readonly displayPath: string;
  };
  readonly expectedPreImage: {
    readonly digest: string | null;
    readonly version: string | null;
    readonly absent: boolean;
  };
  readonly contentSummary: string;
  readonly postImageDigest: string;
  readonly postImageSizeBytes: number;
  readonly lineCount: number;
  readonly exclusions: readonly ExcludedEffect[];
  readonly checkpointCoverage: CoverageState;
  readonly authority: {
    readonly activationId: string;
    readonly activationRevision: number;
  };
}

export type PreviewResult =
  | { readonly ok: true; readonly preview: FileEffectPreview }
  | { readonly ok: false; readonly kind: 'deny'; readonly reason: string };

// --- EffectExecutionResult (AC #5) ---

export interface EffectExecutionResult {
  readonly ok: true;
  readonly operationId: OperationId;
  readonly actualPostImage: {
    readonly digest: string;
    readonly version: string;
    readonly sizeBytes: number;
    readonly lineCount: number;
  };
  readonly verificationStatus: 'verified' | 'unverified';
  readonly checkpointReference: {
    readonly checkpointId: CheckpointId;
    readonly coverageState: CoverageState;
  } | null;
  readonly exclusions: readonly ExcludedEffect[];
  readonly completedAt: string;
}

// --- EffectConflict (AC #4) ---

export type EffectConflictKind = 'conflict' | 'unknown-outcome' | 'stale-approval';

export interface EffectConflict {
  readonly ok: false;
  readonly kind: EffectConflictKind;
  readonly reason: string;
  readonly reasonCode: string;
  readonly evidence: {
    readonly operationId: OperationId;
    readonly expectedDigest: string | null;
    readonly actualDigest: string | null;
    readonly expectedVersion: string | null;
    readonly actualVersion: string | null;
    readonly targetPath: string;
    readonly timestamp: string;
  };
}

// --- Effect outcome (success or conflict) ---

export type EffectOutcome = EffectExecutionResult | EffectConflict;

// --- AD-9 typed failure envelope ---

export type EffectFailureCategory =
  | 'invalid-proposal'
  | 'execution-failed'
  | 'checkpoint-failed'
  | 'authorization-failed'
  | 'conflict-detected'
  | 'stale-approval'
  | 'internal-error';

export interface EffectFailure {
  readonly category: EffectFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'effect';
  readonly message: string;
  readonly causeCode: string;
  readonly retryAfter?: number;
}

// --- Effect context (injectable dependencies) ---

export interface EffectContext {
  readonly fsMutator: FsMutator;
  readonly clock: () => string;
  readonly operationId: OperationId;
  readonly sessionId: string;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
}
