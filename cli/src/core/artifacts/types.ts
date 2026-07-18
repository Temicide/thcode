// Workspace Artifact resolution + consent flow (ADR 0003). EXTENSION POINT:
// interfaces only. A Workspace Artifact (source file, document, image) is
// resolved within the Workspace Binding and processed only after explicit
// developer consent before any remote transfer (see ADR 0008 acceptance
// criteria: "processed only after consent").

export interface ResolvedArtifact {
  readonly absolutePath: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
}

export interface ArtifactConsent {
  readonly artifact: ResolvedArtifact;
  /** Where the artifact would be sent (provider / AI for Thai service host). */
  readonly destinationHost: string;
  readonly granted: boolean;
}

/**
 * TODO(artifact-resolver): implement `@file` reference resolution inside the
 * workspace boundary, media-type sniffing, and size limits.
 * TODO(artifact-consent): implement the consent prompt flow — a remote
 * transfer of artifact bytes is a sensitive action for the permission engine.
 */
export interface ArtifactResolver {
  resolve(reference: string, workspaceRoot: string): Promise<ResolvedArtifact>;
  requestConsent(artifact: ResolvedArtifact, destinationHost: string): Promise<ArtifactConsent>;
}

// --- Story 3.2: Checkpoint and ArtifactStore extensions ---
// These types extend the artifacts module with checkpoint/artifact store
// contracts. The canonical definitions live in core/checkpoints/types.ts;
// re-exported here for convenience and to maintain the artifacts boundary.

export type {
  CheckpointId,
  ArtifactId,
  ContentMetadata,
  CoverageState,
  RetentionState,
  IntegrityState,
  StageState,
  CheckpointRecord,
  ArtifactRecord,
  MutationMetadata,
  IntegrityFailure,
  CheckpointReadResult,
  ArtifactReadResult,
  StageResult,
  CommitResult,
  ReconcileResult,
  KeyValueStore,
  BlobStore,
} from '../checkpoints/types.js';
