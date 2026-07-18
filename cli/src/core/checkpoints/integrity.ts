// Integrity verification for checkpoint and artifact records (Story 3.2, AD-3,
// AD-5, AD-19, AD-20, AD-21, AD-24). Decryption/integrity verification that
// fails closed as `corrupt` or `recovery-locked` on any altered
// record/digest/operation-identity/metadata mismatch. No content reaches
// application code. User receives inspect/read-only recovery actions only.

import { createHash } from 'node:crypto';
import type {
  ArtifactId,
  ArtifactReadResult,
  CheckpointId,
  CheckpointReadResult,
  CheckpointRecord,
  ContentMetadata,
  IntegrityFailure,
} from './types.js';

// --- Digest computation ---

/**
 * Compute SHA-256 hex digest of the given bytes.
 */
export function computeDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// --- Integrity verification for CheckpointRecord ---

export interface CheckpointIntegrityInput {
  readonly checkpointId: CheckpointId;
  readonly record: CheckpointRecord;
  /** Expected operation identity for cross-reference. */
  readonly expectedOperationId?: string;
}

export type CheckpointIntegrityResult =
  | { ok: true; record: CheckpointRecord }
  | { ok: false; failure: IntegrityFailure };

/**
 * Verify the integrity of a CheckpointRecord. Checks:
 * - checkpointId matches the record
 * - mutation metadata is present and well-formed
 * - artifact references are present
 * - operation identity matches expected (if provided)
 *
 * Fails closed as `corrupt` or `recovery-locked` on any mismatch.
 */
export function verifyCheckpointIntegrity(input: CheckpointIntegrityInput): CheckpointIntegrityResult {
  const { checkpointId, record, expectedOperationId } = input;

  // Check checkpointId match.
  if (record.checkpointId !== checkpointId) {
    return {
      ok: false,
      failure: corruptFailure('checkpoint', 'checkpointId mismatch'),
    };
  }

  // Check mutation metadata.
  if (!record.mutation || !record.mutation.operationId) {
    return {
      ok: false,
      failure: corruptFailure('checkpoint', 'missing or invalid mutation metadata'),
    };
  }

  // Check operation identity if expected.
  if (expectedOperationId !== undefined && record.mutation.operationId !== expectedOperationId) {
    return {
      ok: false,
      failure: corruptFailure('checkpoint', 'operation identity mismatch'),
    };
  }

  // Check artifact references field exists (empty is valid for metadata-only checkpoints).
  if (!record.artifactIds) {
    return {
      ok: false,
      failure: corruptFailure('checkpoint', 'missing artifact references'),
    };
  }

  // Check stage state — unreachable checkpoints are recovery-locked.
  if (record.stageState === 'unreachable') {
    return {
      ok: false,
      failure: recoveryLockedFailure('checkpoint', 'checkpoint is unreachable'),
    };
  }

  // Check integrity state.
  if (record.integrityState === 'corrupt' || record.integrityState === 'recovery-locked') {
    return {
      ok: false,
      failure: recoveryLockedFailure('checkpoint', `checkpoint integrity state is ${record.integrityState}`),
    };
  }

  return { ok: true, record };
}

// --- Integrity verification for artifact content ---

export interface ArtifactIntegrityInput {
  readonly artifactId: ArtifactId;
  readonly plaintext: Uint8Array;
  readonly metadata: ContentMetadata;
}

export type ArtifactIntegrityResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; failure: IntegrityFailure };

/**
 * Verify the integrity of decrypted artifact content. Checks:
 * - digest matches the stored metadata
 * - size matches the stored metadata
 *
 * Fails closed as `corrupt` on any mismatch. No content reaches application code.
 */
export function verifyArtifactIntegrity(input: ArtifactIntegrityInput): ArtifactIntegrityResult {
  const { artifactId, plaintext, metadata } = input;

  // Verify digest.
  const actualDigest = computeDigest(plaintext);
  if (actualDigest !== metadata.digest) {
    return {
      ok: false,
      failure: corruptFailure('artifact', `digest mismatch for artifact ${artifactId}`),
    };
  }

  // Verify size.
  if (plaintext.length !== metadata.size) {
    return {
      ok: false,
      failure: corruptFailure('artifact', `size mismatch for artifact ${artifactId}`),
    };
  }

  return { ok: true, bytes: plaintext };
}

// --- Combined read-with-integrity for checkpoint + artifacts ---

export interface CombinedReadResult {
  readonly checkpoint: CheckpointRecord;
  readonly artifacts: Map<ArtifactId, Uint8Array>;
}

export type CombinedReadOutcome =
  | { ok: true; result: CombinedReadResult }
  | { ok: false; failure: IntegrityFailure };

/**
 * Read a checkpoint and all its referenced artifacts with full integrity
 * verification. If any artifact fails integrity check, the entire read
 * fails closed — no partial content reaches application code.
 */
export function readCheckpointWithArtifacts(
  checkpointResult: CheckpointReadResult,
  artifactReader: (artifactId: ArtifactId) => ArtifactReadResult,
): CombinedReadOutcome {
  if (!checkpointResult.ok) {
    return { ok: false, failure: checkpointResult.failure };
  }

  const record = checkpointResult.record;
  const artifacts = new Map<ArtifactId, Uint8Array>();

  for (const artifactId of record.artifactIds) {
    const artifactResult = artifactReader(artifactId);
    if (!artifactResult.ok) {
      return {
        ok: false,
        failure: {
          ...artifactResult.failure,
          message: `artifact ${artifactId} integrity check failed: ${artifactResult.failure.message}`,
        },
      };
    }
    artifacts.set(artifactId, artifactResult.bytes);
  }

  return { ok: true, result: { checkpoint: record, artifacts } };
}

// --- Failure helpers ---

function corruptFailure(scope: 'checkpoint' | 'artifact', message: string): IntegrityFailure {
  return {
    category: 'corrupt',
    retryable: false,
    scope,
    message,
    causeCode: 'integrity-corrupt',
    recoveryActions: ['inspect the store', 'restore from backup if available'],
  };
}

function recoveryLockedFailure(scope: 'checkpoint' | 'artifact', message: string): IntegrityFailure {
  return {
    category: 'recovery-locked',
    retryable: false,
    scope,
    message,
    causeCode: 'recovery-locked',
    recoveryActions: ['inspect the store', 'run recovery procedure'],
  };
}
