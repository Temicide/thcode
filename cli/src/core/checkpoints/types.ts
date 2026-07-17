// CheckpointRepository and ArtifactStore typed contracts (Story 3.2, AD-3, AD-5,
// AD-19, AD-20, AD-21, AD-24). Discriminated unions, opaque branded ids, no `any`.
// Every failure uses the AD-9 typed envelope.

import type { OperationId } from '../protocol/ids.js';

// --- Opaque branded id types ---

export type CheckpointId = string & { readonly __brand: 'CheckpointId' };
export type ArtifactId = string & { readonly __brand: 'ArtifactId' };

export function asCheckpointId(s: string): CheckpointId {
  return s as CheckpointId;
}

export function asArtifactId(s: string): ArtifactId {
  return s as ArtifactId;
}

// --- Content metadata (ArtifactStore-owned) ---

export interface ContentMetadata {
  /** Hex-encoded SHA-256 digest of the original plaintext bytes. */
  readonly digest: string;
  /** Size of the original plaintext bytes. */
  readonly size: number;
  /** Content class identifier (e.g. 'file-content', 'binary-blob'). */
  readonly contentClass: string;
  /** Schema version of the content metadata structure. */
  readonly schemaVersion: number;
  /** Encryption key version used to encrypt this artifact. */
  readonly keyVersion: number;
}

// --- State enums ---

export type CoverageState = 'fully-protected' | 'partially-protected' | 'unprotected';

export type RetentionState = 'retained' | 'eligible-for-eviction' | 'evicted';

export type IntegrityState = 'verified' | 'corrupt' | 'recovery-locked';

export type StageState = 'staging' | 'staged' | 'committed' | 'unreachable';

// --- Mutation metadata ---

export interface MutationMetadata {
  readonly operationId: OperationId;
  readonly aggregateVersion: number;
  readonly commitState: 'pending' | 'committed' | 'failed';
}

// --- CheckpointRecord (CheckpointRepository-owned) ---

export interface CheckpointRecord {
  readonly checkpointId: CheckpointId;
  readonly mutation: MutationMetadata;
  /** References to ArtifactIds owned by the ArtifactStore. */
  readonly artifactIds: readonly ArtifactId[];
  /** Lineage: parent CheckpointIds this checkpoint derives from. */
  readonly parentCheckpointIds: readonly CheckpointId[];
  readonly coverageState: CoverageState;
  readonly retentionState: RetentionState;
  readonly integrityState: IntegrityState;
  readonly stageState: StageState;
  readonly createdAt: string;
}

// --- ArtifactRecord (ArtifactStore-owned) ---

export interface ArtifactRecord {
  readonly artifactId: ArtifactId;
  readonly checkpointId: CheckpointId;
  readonly contentMetadata: ContentMetadata;
  readonly stageState: StageState;
  readonly createdAt: string;
}

// --- Stage input for CheckpointRepository ---

export interface CheckpointStageInput {
  readonly operationId: OperationId;
  readonly aggregateVersion: number;
  readonly artifactIds: readonly ArtifactId[];
  readonly parentCheckpointIds?: readonly CheckpointId[];
  readonly coverageState?: CoverageState;
}

// --- Stage input for ArtifactStore ---

export interface ArtifactStageInput {
  readonly bytes: Uint8Array;
  readonly contentClass: string;
  readonly schemaVersion?: number;
  readonly keyVersion?: number;
}

// --- Integrity failure (AD-9 typed envelope) ---

export type IntegrityFailureCategory = 'corrupt' | 'recovery-locked';

export interface IntegrityFailure {
  readonly category: IntegrityFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'checkpoint' | 'artifact';
  readonly message: string;
  readonly causeCode: string;
  readonly recoveryActions: readonly string[];
}

// --- Read results ---

export type CheckpointReadResult =
  | { ok: true; record: CheckpointRecord }
  | { ok: false; failure: IntegrityFailure };

export type ArtifactReadResult =
  | { ok: true; bytes: Uint8Array; metadata: ContentMetadata }
  | { ok: false; failure: IntegrityFailure };

// --- Stage results ---

export type StageResult =
  | { ok: true; checkpointId: CheckpointId }
  | { ok: false; cause: string };

export type ArtifactStageResult =
  | { ok: true; artifactId: ArtifactId }
  | { ok: false; cause: string };

// --- Commit result ---

export type CommitResult =
  | { ok: true }
  | { ok: false; cause: string };

// --- Reconcile result ---

export interface ReconcileResult {
  readonly removedCount: number;
  readonly markedUnreachableCount: number;
  readonly details: readonly string[];
}

// --- Injectable backing store ports ---

/**
 * Simple key-value store port for checkpoint metadata.
 * Production implementation can use SQLite; tests use in-memory.
 */
export interface KeyValueStore {
  get(key: string): string | undefined;
  put(key: string, value: string): void;
  delete(key: string): void;
  list(prefix: string): string[];
}

/**
 * Simple blob store port for encrypted artifact bytes.
 * Production implementation can use SQLite or filesystem; tests use in-memory.
 */
export interface BlobStore {
  get(key: string): Uint8Array | undefined;
  put(key: string, value: Uint8Array): void;
  delete(key: string): void;
  list(prefix: string): string[];
}

/**
 * Mutable<T> strips readonly from all properties of T.
 * Used internally for mutation of deserialized records.
 */
export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
