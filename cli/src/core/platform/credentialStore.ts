// BYOK credential storage behind a platform interface (ADR 0007, ADR 0008).
// Secrets are addressed by provider id. Implementations must NEVER write a key
// to logs, config, session data, or plaintext files. The Windows backing lives
// in windowsCredentialStore.ts; macOS Keychain and Linux Secret Service are
// deferred extension points (ADR 0008).

/** Stable id used to name a stored secret, e.g. "typhoon" or the reserved
 * per-install session data key id below. */
export type CredentialId = string;

/** Reserved id for the per-install AES data-encryption key (ADR 0018). */
export const SESSION_DATA_KEY_ID = '__thcode_session_dek__';

export interface CredentialStore {
  /** Return the secret for `id`, or null if none is stored. */
  get(id: CredentialId): Promise<string | null>;
  /** Store (create or replace) the secret for `id`. */
  set(id: CredentialId, secret: string): Promise<void>;
  /** Remove the secret for `id` (no-op if absent). */
  delete(id: CredentialId): Promise<void>;
  /** True if a secret is stored for `id`. */
  has(id: CredentialId): Promise<boolean>;
}

/**
 * In-memory CredentialStore for tests and non-persistent runs. Never touches
 * disk; the value is held only for the process lifetime.
 */
export class InMemoryCredentialStore implements CredentialStore {
  private readonly map = new Map<CredentialId, string>();

  async get(id: CredentialId): Promise<string | null> {
    return this.map.has(id) ? this.map.get(id)! : null;
  }
  async set(id: CredentialId, secret: string): Promise<void> {
    this.map.set(id, secret);
  }
  async delete(id: CredentialId): Promise<void> {
    this.map.delete(id);
  }
  async has(id: CredentialId): Promise<boolean> {
    return this.map.has(id);
  }
}
