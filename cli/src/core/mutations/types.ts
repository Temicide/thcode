// Mutation planning typed contracts (Story 3.3, AD-4, AD-12, AD-13, AD-19,
// AD-20, AD-27). Discriminated unions, opaque branded ids, no `any`. Every
// failure uses the AD-9 typed envelope.

import type { OperationId } from '../protocol/ids.js';
import type { CoverageState } from '../checkpoints/types.js';

// --- Opaque branded id types ---

export type MutationProposalId = string & { readonly __brand: 'MutationProposalId' };
export type MutationSetId = string & { readonly __brand: 'MutationSetId' };
export type PlanFingerprintId = string & { readonly __brand: 'PlanFingerprintId' };

export function asMutationProposalId(s: string): MutationProposalId {
  return s as MutationProposalId;
}

export function asMutationSetId(s: string): MutationSetId {
  return s as MutationSetId;
}

export function asPlanFingerprintId(s: string): PlanFingerprintId {
  return s as PlanFingerprintId;
}

// --- Action class ---

export type MutationActionClass = 'create_file' | 'edit_file' | 'delete_file';

// --- Resource identity (stable identity for a mutation target) ---

export interface StableResourceIdentity {
  /** Canonical absolute path within the workspace. */
  readonly canonicalPath: string;
  /** Display path as proposed by Typhoon. */
  readonly displayPath: string;
  /** Hex-encoded SHA-256 digest of the current content, or null for new files. */
  readonly expectedDigest: string | null;
  /** Version identifier (e.g. dev:ino or mtime), or null when unavailable. */
  readonly version: string | null;
  /** True when the identity was proven by direct filesystem inspection. */
  readonly identityProven: boolean;
}

// --- Action digest ---

export interface ActionDigest {
  /** Hex-encoded SHA-256 of the action class + target identity + proposed content. */
  readonly digest: string;
  /** The algorithm used (always 'sha256'). */
  readonly algorithm: string;
}

// --- Pre-image / post-image ---

export interface PreImage {
  /** Expected hex-encoded SHA-256 digest of the current file content. */
  readonly expectedDigest: string | null;
  /** Expected version identifier, or null for new files. */
  readonly expectedVersion: string | null;
  /** Size of the current file in bytes, or null for new files. */
  readonly sizeBytes: number | null;
  /** True when the pre-image is absent (file does not exist yet — create). */
  readonly absent: boolean;
}

export interface PostImage {
  /** Hex-encoded SHA-256 digest of the proposed content. */
  readonly digest: string;
  /** Size of the proposed content in bytes. */
  readonly sizeBytes: number;
  /** The proposed content bytes (for create/edit). */
  readonly content: Uint8Array;
}

export interface DeletionManifest {
  /** Hex-encoded SHA-256 digest of the file being deleted. */
  readonly expectedDigest: string | null;
  /** Expected version before deletion. */
  readonly expectedVersion: string | null;
  /** Current size in bytes. */
  readonly sizeBytes: number | null;
}

// --- Rename / alias relationship ---

export interface RenameAlias {
  /** The original path before rename. */
  readonly from: string;
  /** The new path after rename. */
  readonly to: string;
  /** True when this is a rename (vs. a symlink alias). */
  readonly isRename: boolean;
}

// --- Binary status ---

export type BinaryStatus = 'text' | 'binary' | 'unknown';

// --- Excluded effect ---

export interface ExcludedEffect {
  readonly target: string;
  readonly reason: string;
  readonly reasonCode: string;
}

// --- MutationProposal (discriminated union) ---

export type MutationProposal =
  | CreateFileProposal
  | EditFileProposal
  | DeleteFileProposal;

export interface CreateFileProposal {
  readonly kind: 'create_file';
  readonly proposalId: MutationProposalId;
  readonly resource: StableResourceIdentity;
  readonly actionDigest: ActionDigest;
  readonly preImage: PreImage;
  readonly postImage: PostImage;
  readonly renameAlias: readonly RenameAlias[];
  readonly binaryStatus: BinaryStatus;
  readonly excludedEffects: readonly ExcludedEffect[];
}

export interface EditFileProposal {
  readonly kind: 'edit_file';
  readonly proposalId: MutationProposalId;
  readonly resource: StableResourceIdentity;
  readonly actionDigest: ActionDigest;
  readonly preImage: PreImage;
  readonly postImage: PostImage;
  readonly renameAlias: readonly RenameAlias[];
  readonly binaryStatus: BinaryStatus;
  readonly excludedEffects: readonly ExcludedEffect[];
}

export interface DeleteFileProposal {
  readonly kind: 'delete_file';
  readonly proposalId: MutationProposalId;
  readonly resource: StableResourceIdentity;
  readonly actionDigest: ActionDigest;
  readonly preImage: PreImage;
  readonly postImage: null;
  readonly deletionManifest: DeletionManifest;
  readonly renameAlias: readonly RenameAlias[];
  readonly binaryStatus: BinaryStatus;
  readonly excludedEffects: readonly ExcludedEffect[];
}

// --- MutationSet ---

export interface MutationSet {
  readonly setId: MutationSetId;
  readonly operationId: OperationId;
  readonly proposals: readonly MutationProposal[];
  readonly totalCheckpointSizeBytes: number;
  readonly totalStoreSizeBytes: number;
  readonly binaryCount: number;
  readonly textCount: number;
  readonly excludedCount: number;
  readonly createdAt: string;
}

// --- Protection status ---

export type ProtectionStatus = 'fully-protected' | 'partially-protected' | 'unprotected';

// --- Per-target protection state ---

export type TargetProtectionState =
  | { readonly status: 'protected'; readonly reason: string }
  | { readonly status: 'excluded'; readonly reason: string; readonly reasonCode: string }
  | { readonly status: 'blocked'; readonly reason: string; readonly reasonCode: string };

// --- Quota check (AD-19) ---

export interface QuotaCheck {
  /** Per-checkpoint cap in bytes (100 MB). */
  readonly perCheckpointCapBytes: number;
  /** Store cap in bytes (500 MB). */
  readonly storeCapBytes: number;
  /** Estimated checkpoint size in bytes. */
  readonly estimatedCheckpointSizeBytes: number;
  /** Current store usage in bytes. */
  readonly currentStoreUsageBytes: number;
  /** Estimated store usage after this operation. */
  readonly estimatedStoreUsageBytes: number;
  /** True when both caps are within limits. */
  readonly withinLimits: boolean;
  /** Reason when over cap. */
  readonly overCapReason: string | null;
}

// --- ProtectionPreflightResult ---

export interface ProtectionPreflightResult {
  readonly setId: MutationSetId;
  readonly operationId: OperationId;
  readonly protectionStatus: ProtectionStatus;
  readonly perTarget: readonly TargetProtectionState[];
  readonly excludedTargets: readonly ExcludedEffect[];
  readonly blockedTargets: readonly ExcludedEffect[];
  readonly quotaCheck: QuotaCheck;
  readonly checkpointSizeBytes: number;
  readonly storeUsageBytes: number;
  /** The checkpoint coverage state that was staged. */
  readonly coverageState: CoverageState;
  /** True when the stage was made durable. */
  readonly stageDurable: boolean;
  /** Human-readable summary of protection coverage. */
  readonly coverageSummary: string;
  /** Unprotected scope disclosure (for partial/unavailable protection). */
  readonly unprotectedScope: UnprotectedScope | null;
}

// --- Unprotected scope disclosure ---

export interface UnprotectedScope {
  readonly targets: readonly string[];
  readonly residualRisk: string;
  readonly reason: string;
}

// --- PlanFingerprint ---

export interface PlanFingerprint {
  readonly fingerprintId: PlanFingerprintId;
  readonly mutationSetId: MutationSetId;
  readonly operationId: OperationId;
  /** Digest of the entire proposal set (canonical JSON). */
  readonly proposalDigest: string;
  /** Authority revision at planning time. */
  readonly authorityRevision: number;
  /** Workspace identity digest. */
  readonly workspaceDigest: string;
  /** Digest of all target identities + expected digests. */
  readonly targetDigest: string;
  /** Quota state at planning time. */
  readonly quotaDigest: string;
  /** Platform state digest (OS, platform, case policy). */
  readonly platformDigest: string;
  /** When the fingerprint was created. */
  readonly createdAt: string;
}

// --- Stale reason (discriminated union) ---

export type StaleReason =
  | { readonly kind: 'proposal-changed'; readonly detail: string }
  | { readonly kind: 'workspace-changed'; readonly detail: string }
  | { readonly kind: 'authority-revision-changed'; readonly detail: string }
  | { readonly kind: 'target-changed'; readonly detail: string }
  | { readonly kind: 'digest-mismatch'; readonly detail: string }
  | { readonly kind: 'quota-changed'; readonly detail: string }
  | { readonly kind: 'platform-changed'; readonly detail: string }
  | { readonly kind: 'expired'; readonly detail: string };

// --- Stale check result ---

export type StaleCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly stale: true; readonly reason: StaleReason };

// --- Confirmation scope ---

export interface ConfirmationScope {
  readonly unprotectedTargets: readonly string[];
  readonly residualRisk: string;
  readonly operationId: OperationId;
  readonly mutationSetId: MutationSetId;
}

// --- Confirmation result ---

export type ConfirmationResult =
  | { readonly ok: true; readonly scope: ConfirmationScope }
  | { readonly ok: false; readonly reason: string };

// --- AD-9 typed failure envelope ---

export type MutationFailureCategory =
  | 'invalid-proposal'
  | 'planning-failed'
  | 'preflight-failed'
  | 'stale-plan'
  | 'quota-exceeded'
  | 'containment-violation'
  | 'identity-unproven'
  | 'internal-error';

export interface MutationFailure {
  readonly category: MutationFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'mutation' | 'plan' | 'preflight' | 'fingerprint';
  readonly message: string;
  readonly causeCode: string;
  readonly retryAfter?: number;
}

// --- Plan mutation result ---

export type PlanMutationResult =
  | { readonly ok: true; readonly mutationSet: MutationSet }
  | { readonly ok: false; readonly failure: MutationFailure };

// --- Preflight result ---

export type PreflightResult =
  | { readonly ok: true; readonly result: ProtectionPreflightResult }
  | { readonly ok: false; readonly failure: MutationFailure };

// --- Revalidation result ---

export type PlanRevalidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly stale: true; readonly reason: StaleReason }
  | { readonly ok: false; readonly failure: MutationFailure };

// --- Constants ---

/** Per-checkpoint cap: 100 MB (AD-19). */
export const PER_CHECKPOINT_CAP_BYTES = 100 * 1024 * 1024;

/** Store cap: 500 MB (AD-19). */
export const STORE_CAP_BYTES = 500 * 1024 * 1024;

/** Default fingerprint expiry: 5 minutes. */
export const DEFAULT_FINGERPRINT_TTL_MS = 5 * 60 * 1000;
