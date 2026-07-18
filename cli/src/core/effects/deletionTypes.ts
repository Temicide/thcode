// Guarded destructive deletion typed contracts (Story 3.6, AD-4, AD-12, AD-13,
// AD-19, AD-20, AD-24, AD-27). DESTRUCTIVE label, exact root identity, ORDERED
// descendant identity/content manifest, count/size bounds, symlink/junction/mount/
// open-handle policy, checkpoint coverage, exclusions, OperationId, authority.
// Discriminated unions, opaque branded ids, no `any`. Every failure uses the
// AD-9 typed envelope.

import type { OperationId } from '../protocol/ids.js';
import type { CoverageState, CheckpointId } from '../checkpoints/types.js';
import type { ExcludedEffect } from '../mutations/types.js';

// --- Descendant identity in the ordered manifest ---

export interface DescendantIdentity {
  readonly canonicalPath: string;
  readonly displayPath: string;
  readonly type: 'file' | 'directory' | 'symlink' | 'other' | 'unknown';
  readonly sizeBytes: number | null;
  readonly expectedDigest: string | null;
  readonly version: string | null;
  readonly identityProven: boolean;
}

// --- DeletionProposal (effect-level, after authorization) ---

export interface DeletionProposal {
  readonly kind: 'delete_file' | 'delete_directory';
  readonly operationId: OperationId;
  readonly root: {
    readonly canonicalPath: string;
    readonly displayPath: string;
  };
  readonly expectedPreImage: {
    readonly digest: string | null;
    readonly version: string | null;
    readonly absent: boolean;
  };
  readonly descendantManifest: readonly DescendantIdentity[];
  readonly descendantCount: number;
  readonly totalSizeBytes: number;
  readonly symlinkPolicy: 'no-follow';
  readonly junctionPolicy: 'no-follow';
  readonly mountPolicy: 'no-follow';
  readonly openHandlePolicy: 'reject';
  readonly checkpointCoverage: CoverageState;
  readonly exclusions: readonly ExcludedEffect[];
  readonly authorizationId: string;
  readonly activationId: string;
  readonly activationRevision: number;
}

// --- DeletionPreview (AC #1) ---

export interface DeletionPreview {
  readonly kind: 'delete_file' | 'delete_directory';
  readonly label: 'DESTRUCTIVE';
  readonly operationId: OperationId;
  readonly root: {
    readonly canonicalPath: string;
    readonly displayPath: string;
  };
  readonly expectedPreImage: {
    readonly digest: string | null;
    readonly version: string | null;
    readonly absent: boolean;
  };
  readonly descendantManifest: readonly DescendantIdentity[];
  readonly descendantCount: number;
  readonly totalSizeBytes: number;
  readonly symlinkPolicy: 'no-follow';
  readonly junctionPolicy: 'no-follow';
  readonly mountPolicy: 'no-follow';
  readonly openHandlePolicy: 'reject';
  readonly checkpointCoverage: CoverageState;
  readonly exclusions: readonly ExcludedEffect[];
  readonly authority: {
    readonly activationId: string;
    readonly activationRevision: number;
  };
}

export type DeletionPreviewResult =
  | { readonly ok: true; readonly preview: DeletionPreview }
  | { readonly ok: false; readonly kind: 'deny'; readonly reason: string };

// --- DeletionExecutionResult (AC #5) ---

export interface DeletionExecutionResult {
  readonly ok: true;
  readonly operationId: OperationId;
  readonly deletedRoot: {
    readonly canonicalPath: string;
    readonly displayPath: string;
  };
  readonly manifestIdentity: {
    readonly descendantCount: number;
    readonly totalSizeBytes: number;
    readonly manifestDigest: string;
  };
  readonly encryptedRecoverability: 'retained' | 'not-retained';
  readonly exclusions: readonly ExcludedEffect[];
  readonly checkpointReference: {
    readonly checkpointId: CheckpointId;
    readonly coverageState: CoverageState;
  } | null;
  readonly completedAt: string;
}

// --- DeletionConflict (AC #4) ---

export type DeletionConflictKind = 'conflict' | 'unknown-outcome' | 'enforcement-unverified' | 'stale-approval';

export interface DeletionConflict {
  readonly ok: false;
  readonly kind: DeletionConflictKind;
  readonly reason: string;
  readonly reasonCode: string;
  readonly evidence: {
    readonly operationId: OperationId;
    readonly rootPath: string;
    readonly changedDescendant: string | null;
    readonly expectedDigest: string | null;
    readonly actualDigest: string | null;
    readonly expectedVersion: string | null;
    readonly actualVersion: string | null;
    readonly timestamp: string;
  };
}

// --- Deletion outcome (success or conflict) ---

export type DeletionOutcome = DeletionExecutionResult | DeletionConflict;

// --- QuarantineProvider (injectable) ---

export interface QuarantineProvider {
  /** Rename a path into the quarantine area on the same filesystem.
   * Returns the quarantine path. Throws on failure. */
  quarantine(path: string): string;
  /** Recursively remove quarantined content. Throws on failure. */
  removeQuarantined(quarantinePath: string): void;
  /** Read the quarantine path for a given original path. */
  quarantinePathFor(originalPath: string): string;
}

// --- DeletionEffectContext (injectable dependencies) ---

export interface DeletionEffectContext {
  readonly workspace: import('../workspace/types.js').WorkspaceIdentity;
  readonly fsProbe: import('../workspace/types.js').FsProbe;
  readonly quarantineProvider: QuarantineProvider;
  readonly clock: () => string;
  readonly policyState: import('../permissions/types.js').PolicyState;
  readonly checkpointRepo: import('../checkpoints/checkpointRepository.js').CheckpointRepository;
  readonly artifactStore?: import('../checkpoints/artifactStore.js').ArtifactStore;
  readonly kvStore: import('../checkpoints/types.js').KeyValueStore;
  readonly blobStore?: import('../checkpoints/types.js').BlobStore;
  readonly journal: {
    append(event: import('../protocol/events.js').DurableEvent): number;
  };
  readonly sessionId: string;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
}

// --- AD-9 typed failure envelope ---

export type DeletionFailureCategory =
  | 'invalid-proposal'
  | 'execution-failed'
  | 'checkpoint-failed'
  | 'authorization-failed'
  | 'conflict-detected'
  | 'stale-approval'
  | 'quarantine-failed'
  | 'internal-error';

export interface DeletionFailure {
  readonly category: DeletionFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'deletion';
  readonly message: string;
  readonly causeCode: string;
  readonly retryAfter?: number;
}
