import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export const SESSION_ENC_VERSION = 1;
export const SESSION_ENC_ALGORITHM = 'aes-256-gcm' as const;

export interface EncryptedField {
  /** Base64 nonce (12 bytes). */
  readonly n: string;
  /** Base64 ciphertext. */
  readonly c: string;
  /** Base64 GCM auth tag (16 bytes). */
  readonly t: string;
  /** Encryption schema version (also bound as AAD). */
  readonly v: number;
  /** Algorithm identifier (bound as AAD). */
  readonly alg: string;
}

/** Additional authenticated data binding record identity + version + algorithm. */
function aadFor(recordId: string, version: number, algorithm: string): Buffer {
  return Buffer.from(`${recordId}:v${version}:${algorithm}`, 'utf8');
}

export function encryptField(plaintext: string, key: Buffer, recordId: string): EncryptedField {
  if (key.length !== 32) throw new Error('session data key must be 32 bytes (AES-256)');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aadFor(recordId, SESSION_ENC_VERSION, SESSION_ENC_ALGORITHM));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    n: nonce.toString('base64'),
    c: ct.toString('base64'),
    t: tag.toString('base64'),
    v: SESSION_ENC_VERSION,
    alg: SESSION_ENC_ALGORITHM,
  };
}

export function decryptField(field: EncryptedField, key: Buffer, recordId: string): string {
  if (key.length !== 32) throw new Error('session data key must be 32 bytes (AES-256)');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(field.n, 'base64'));
  decipher.setAAD(aadFor(recordId, field.v, field.alg ?? SESSION_ENC_ALGORITHM));
  decipher.setAuthTag(Buffer.from(field.t, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(field.c, 'base64')), decipher.final()]).toString('utf8');
}

export function generateDataKey(): Buffer {
  return randomBytes(32);
}

export function workspaceBindingIndex(workspacePath: string, key: Buffer): string {
  return createHmac('sha256', key).update(workspacePath).digest('hex');
}

/** Key rotation result. */
export type RotationResult =
  | { ok: true; newKeyVersion: number }
  | { ok: false; cause: string };

/**
 * Stage a new key, migrate all encrypted fields, verify, and atomically promote.
 * Old key material is retained until cleanup is safe (AD-21).
 */
export function rotateKey(
  oldKey: Buffer,
  newKey: Buffer,
  reEncrypt: (oldKey: Buffer, newKey: Buffer) => boolean,
): RotationResult {
  if (oldKey.length !== 32 || newKey.length !== 32) {
    return { ok: false, cause: 'key must be 32 bytes' };
  }
  const ok = reEncrypt(oldKey, newKey);
  if (!ok) return { ok: false, cause: 're-encryption failed' };
  return { ok: true, newKeyVersion: SESSION_ENC_VERSION + 1 };
}

/** Decrypt with fallback: try the current key, then the old key (rotation window). */
export function decryptFieldWithFallback(
  field: EncryptedField,
  currentKey: Buffer,
  oldKey: Buffer | null,
  recordId: string,
): { ok: true; value: string } | { ok: false; cause: string } {
  try {
    return { ok: true, value: decryptField(field, currentKey, recordId) };
  } catch {
    if (oldKey) {
      try {
        return { ok: true, value: decryptField(field, oldKey, recordId) };
      } catch {
        return { ok: false, cause: 'decryption failed with both current and old key' };
      }
    }
    return { ok: false, cause: 'decryption failed' };
  }
}
