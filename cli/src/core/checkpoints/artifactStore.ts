// ArtifactStore — encrypted, crash-consistent immutable byte storage (Story 3.2,
// AD-3, AD-5, AD-19, AD-20, AD-21, AD-24). Stages original file/binary bytes
// encrypted with the existing versioned AES-256-GCM envelope (reuses
// sessions/crypto.ts), collision-resistant nonce, authenticated metadata bound
// to store/entity/content class/schema/key version. Plaintext originals NEVER
// enter the backing store, logs, UI, Evidence, or unencrypted temporary storage.
//
// Provides an injectable BlobStore port so tests use in-memory; production can
// use SQLite or filesystem later. Crash-before-commit leaves staged material
// unreachable.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { SESSION_ENC_VERSION, SESSION_ENC_ALGORITHM } from '../sessions/crypto.js';
import type { EncryptedField } from '../sessions/crypto.js';
import type {
  ArtifactId,
  ArtifactReadResult,
  ArtifactRecord,
  ArtifactStageInput,
  ArtifactStageResult,
  BlobStore,
  ContentMetadata,
  IntegrityFailure,
  Mutable,
} from './types.js';
import { asArtifactId } from './types.js';

// --- Constants ---

const ARTIFACT_STORE_ID = 'thcode-artifact-store';
const ARTIFACT_ENC_SCHEMA_VERSION = 1;
const DEFAULT_KEY_VERSION = 1;

// --- AAD context builder ---

function aadForArtifact(
  artifactId: string,
  contentClass: string,
  schemaVersion: number,
  keyVersion: number,
): string {
  return `artifact-store:${ARTIFACT_STORE_ID}:${artifactId}:${contentClass}:v${schemaVersion}:k${keyVersion}`;
}

// --- Binary encrypt/decrypt helpers (reuse AES-256-GCM from crypto.ts pattern) ---

function encryptBytes(plaintext: Buffer, key: Buffer, aadContext: string): EncryptedField {
  if (key.length !== 32) throw new Error('data key must be 32 bytes (AES-256)');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(aadContext, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    n: nonce.toString('base64'),
    c: ct.toString('base64'),
    t: tag.toString('base64'),
    v: SESSION_ENC_VERSION,
    alg: SESSION_ENC_ALGORITHM,
  };
}

function decryptBytes(field: EncryptedField, key: Buffer, aadContext: string): Buffer {
  if (key.length !== 32) throw new Error('data key must be 32 bytes (AES-256)');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(field.n, 'base64'));
  decipher.setAAD(Buffer.from(aadContext, 'utf8'));
  decipher.setAuthTag(Buffer.from(field.t, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(field.c, 'base64')), decipher.final()]);
}

// --- Digest computation ---

function computeDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// --- BlobStore key conventions ---

function artifactDataKey(artifactId: string): string {
  return `artifact:${artifactId}`;
}

function artifactRecordKey(artifactId: string): string {
  return `artifact:record:${artifactId}`;
}

function stagingPrefix(): string {
  return 'staging:artifact:';
}

function stagingMarkerKey(artifactId: string): string {
  return `${stagingPrefix()}${artifactId}`;
}

// --- ArtifactStore ---

export class ArtifactStore {
  private readonly key: Buffer;
  private readonly keyVersion: number;

  constructor(
    private readonly blobStore: BlobStore,
    key: Buffer,
    keyVersion?: number,
  ) {
    if (key.length !== 32) throw new Error('data key must be 32 bytes (AES-256)');
    this.key = key;
    this.keyVersion = keyVersion ?? DEFAULT_KEY_VERSION;
  }

  /**
   * Stage original bytes: encrypt with AES-256-GCM + collision-resistant nonce
   * + authenticated metadata. Stores only ciphertext in the backing store.
   * Returns an ArtifactId. Crash before commit leaves staged material detectable.
   */
  stage(input: ArtifactStageInput): ArtifactStageResult {
    try {
      const artifactId = asArtifactId(randomUUID());
      const schemaVersion = input.schemaVersion ?? ARTIFACT_ENC_SCHEMA_VERSION;
      const keyVersion = input.keyVersion ?? this.keyVersion;
      const contentClass = input.contentClass;

      // Compute digest of original plaintext bytes.
      const digest = computeDigest(input.bytes);

      // Build authenticated metadata context.
      const aadContext = aadForArtifact(artifactId, contentClass, schemaVersion, keyVersion);

      // Encrypt the original bytes.
      const encrypted = encryptBytes(Buffer.from(input.bytes), this.key, aadContext);

      // Build content metadata (plaintext metadata — safe; no original bytes).
      const metadata: ContentMetadata = {
        digest,
        size: input.bytes.length,
        contentClass,
        schemaVersion,
        keyVersion,
      };

      // Store encrypted data.
      const dataPayload = JSON.stringify({
        encrypted,
        metadata,
      });
      this.blobStore.put(artifactDataKey(artifactId), new TextEncoder().encode(dataPayload));

      // Store record.
      const record: ArtifactRecord = {
        artifactId,
        checkpointId: '' as never, // assigned by CheckpointRepository
        contentMetadata: metadata,
        stageState: 'staging',
        createdAt: new Date().toISOString(),
      };
      this.blobStore.put(artifactRecordKey(artifactId), new TextEncoder().encode(JSON.stringify(record)));

      // Write staging marker.
      this.blobStore.put(stagingMarkerKey(artifactId), new TextEncoder().encode('staging'));

      return { ok: true, artifactId };
    } catch (e) {
      return { ok: false, cause: `artifact stage failed: ${(e as Error).message}` };
    }
  }

  /**
   * Mark an artifact as committed. After commit, the artifact is visible
   * and can be read. Crash before commit leaves it in staging state.
   */
  commit(artifactId: ArtifactId): void {
    const recordJson = this.blobStore.get(artifactRecordKey(artifactId));
    if (!recordJson) return; // already gone or never existed

    const record = JSON.parse(new TextDecoder().decode(recordJson)) as Mutable<ArtifactRecord>;
    record.stageState = 'committed';
    this.blobStore.put(artifactRecordKey(artifactId), new TextEncoder().encode(JSON.stringify(record)));

    // Remove staging marker.
    this.blobStore.delete(stagingMarkerKey(artifactId));
  }

  /**
   * Read and decrypt an artifact. Verifies integrity: digest, AAD binding,
   * metadata consistency. Fails closed as `corrupt` or `recovery-locked` on
   * any mismatch. No content reaches application code on failure.
   */
  read(artifactId: ArtifactId): ArtifactReadResult {
    try {
      // Read encrypted data.
      const dataRaw = this.blobStore.get(artifactDataKey(artifactId));
      if (!dataRaw) {
        return {
          ok: false,
          failure: this.corruptFailure('artifact', `artifact not found: ${artifactId}`),
        };
      }

      const data = JSON.parse(new TextDecoder().decode(dataRaw)) as {
        encrypted: EncryptedField;
        metadata: ContentMetadata;
      };

      // Read record for stage state.
      const recordRaw = this.blobStore.get(artifactRecordKey(artifactId));
      if (!recordRaw) {
        return {
          ok: false,
          failure: this.corruptFailure('artifact', `artifact record not found: ${artifactId}`),
        };
      }
      const record: ArtifactRecord = JSON.parse(new TextDecoder().decode(recordRaw));

      // Reject unreachable or staging artifacts (not yet committed).
      if (record.stageState === 'unreachable') {
        return {
          ok: false,
          failure: this.recoveryLockedFailure('artifact', `artifact is unreachable: ${artifactId}`),
        };
      }
      if (record.stageState === 'staging' || record.stageState === 'staged') {
        return {
          ok: false,
          failure: this.recoveryLockedFailure('artifact', `artifact is not yet committed: ${artifactId}`),
        };
      }

      const metadata = data.metadata;

      // Rebuild AAD context and decrypt.
      const aadContext = aadForArtifact(
        artifactId,
        metadata.contentClass,
        metadata.schemaVersion,
        metadata.keyVersion,
      );

      let plaintext: Buffer;
      try {
        plaintext = decryptBytes(data.encrypted, this.key, aadContext);
      } catch {
        return {
          ok: false,
          failure: this.corruptFailure('artifact', 'decryption failed — data may be altered'),
        };
      }

      // Verify digest.
      const actualDigest = computeDigest(plaintext);
      if (actualDigest !== metadata.digest) {
        return {
          ok: false,
          failure: this.corruptFailure('artifact', 'digest mismatch — content has been altered'),
        };
      }

      // Verify size.
      if (plaintext.length !== metadata.size) {
        return {
          ok: false,
          failure: this.corruptFailure('artifact', 'size mismatch — content has been altered'),
        };
      }

      return { ok: true, bytes: new Uint8Array(plaintext), metadata };
    } catch (e) {
      return {
        ok: false,
        failure: this.corruptFailure('artifact', `read failed: ${(e as Error).message}`),
      };
    }
  }

  /**
   * Detect artifacts still in staging state (crash-before-commit).
   */
  detectIncompleteStages(): ArtifactId[] {
    const markers = this.blobStore.list(stagingPrefix());
    return markers.map((k) => asArtifactId(k.replace(stagingPrefix(), '')));
  }

  /**
   * Reconcile incomplete stages: mark as unreachable so they are never
   * exposed as complete. Returns count of artifacts affected.
   */
  reconcile(): number {
    const incomplete = this.detectIncompleteStages();
    let count = 0;
    for (const artifactId of incomplete) {
      const recordRaw = this.blobStore.get(artifactRecordKey(artifactId));
      if (recordRaw) {
        const record = JSON.parse(new TextDecoder().decode(recordRaw)) as Mutable<ArtifactRecord>;
        record.stageState = 'unreachable';
        this.blobStore.put(artifactRecordKey(artifactId), new TextEncoder().encode(JSON.stringify(record)));
      }
      this.blobStore.delete(stagingMarkerKey(artifactId));
      count++;
    }
    return count;
  }

  // --- Integrity failure helpers ---

  private corruptFailure(scope: 'checkpoint' | 'artifact', message: string): IntegrityFailure {
    return {
      category: 'corrupt',
      retryable: false,
      scope,
      message,
      causeCode: 'integrity-corrupt',
      recoveryActions: ['inspect the artifact store', 'restore from backup if available'],
    };
  }

  private recoveryLockedFailure(scope: 'checkpoint' | 'artifact', message: string): IntegrityFailure {
    return {
      category: 'recovery-locked',
      retryable: false,
      scope,
      message,
      causeCode: 'recovery-locked',
      recoveryActions: ['inspect the artifact store', 'run recovery procedure'],
    };
  }
}
