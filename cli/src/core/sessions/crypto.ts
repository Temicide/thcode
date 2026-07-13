import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

// Authenticated AES-256-GCM for sensitive Global Session Store fields (ADR 0018).
// Each record uses a unique 12-byte nonce and binds record identity + schema
// version as additional authenticated data (AAD) so ciphertext cannot be
// silently moved between records. The 32-byte data-encryption key lives in the
// CredentialStore, never in SQLite.

export const SESSION_ENC_VERSION = 1;

export interface EncryptedField {
  /** Base64 nonce (12 bytes). */
  readonly n: string;
  /** Base64 ciphertext. */
  readonly c: string;
  /** Base64 GCM auth tag (16 bytes). */
  readonly t: string;
  /** Encryption schema version (also bound as AAD). */
  readonly v: number;
}

/** Additional authenticated data binding record identity + version. */
function aadFor(recordId: string, version: number): Buffer {
  return Buffer.from(`${recordId}:${version}`, 'utf8');
}

export function encryptField(plaintext: string, key: Buffer, recordId: string): EncryptedField {
  if (key.length !== 32) throw new Error('session data key must be 32 bytes (AES-256)');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aadFor(recordId, SESSION_ENC_VERSION));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    n: nonce.toString('base64'),
    c: ct.toString('base64'),
    t: tag.toString('base64'),
    v: SESSION_ENC_VERSION,
  };
}

export function decryptField(field: EncryptedField, key: Buffer, recordId: string): string {
  if (key.length !== 32) throw new Error('session data key must be 32 bytes (AES-256)');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(field.n, 'base64'));
  decipher.setAAD(aadFor(recordId, field.v));
  decipher.setAuthTag(Buffer.from(field.t, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(field.c, 'base64')), decipher.final()]).toString('utf8');
}

/** Generate a fresh 32-byte data-encryption key (store via CredentialStore). */
export function generateDataKey(): Buffer {
  return randomBytes(32);
}

/** Keyed, non-reversible index value for a Workspace Binding path (ADR 0018) —
 * lets SQLite equality-filter without storing the plaintext path. */
export function workspaceBindingIndex(workspacePath: string, key: Buffer): string {
  // HMAC-SHA256 keyed with the data key; deterministic, non-reversible.
  return createHmac('sha256', key).update(workspacePath).digest('hex');
}
