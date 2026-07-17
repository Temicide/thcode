// Secret-free AI-for-Thai credential reference persistence (Story 4.3). Stores
// ONLY the credential reference, revision, and secret-free fingerprint — never
// the secret value. Invalidation removes the reference and signals that
// dependent EffectiveConfigurationGenerations are stale/unavailable. No cached
// credential value remains in product buffers or persistence after invalidation.

import type { AiForThaiCredentialReference } from './types.js';

/** Result of loading a credential reference from persistence. */
export type LoadReferenceResult =
  | { readonly ok: true; readonly reference: AiForThaiCredentialReference }
  | { readonly ok: false; readonly cause: 'not-found' | 'corrupt'; readonly message: string };

/** Result of invalidating a credential reference. */
export type InvalidateReferenceResult =
  | { readonly ok: true; readonly invalidatedReferenceId: string; readonly generationsStale: true }
  | { readonly ok: false; readonly cause: 'not-found'; readonly message: string };

/** Product persistence for the secret-free AI-for-Thai credential reference.
 * Implementations must NEVER store the raw secret value. */
export interface CredentialPersistence {
  /** Persist a secret-free credential reference. Returns the stored reference. */
  save(reference: AiForThaiCredentialReference): Promise<AiForThaiCredentialReference>;
  /** Load the current credential reference, or return not-found. */
  load(): Promise<LoadReferenceResult>;
  /** Invalidate the current credential reference. Removes it from persistence
   * and signals that dependent EffectiveConfigurationGenerations are stale. */
  invalidate(): Promise<InvalidateReferenceResult>;
  /** True if a credential reference is currently persisted. */
  exists(): Promise<boolean>;
}

/** In-memory CredentialPersistence for tests and non-persistent runs. Never
 * stores the secret value — only the reference, revision, and fingerprint. */
export class InMemoryCredentialPersistence implements CredentialPersistence {
  private _reference: AiForThaiCredentialReference | null = null;

  async save(reference: AiForThaiCredentialReference): Promise<AiForThaiCredentialReference> {
    this._reference = reference;
    return reference;
  }

  async load(): Promise<LoadReferenceResult> {
    if (this._reference === null) {
      return { ok: false, cause: 'not-found', message: 'No AI-for-Thai credential reference is persisted.' };
    }
    return { ok: true, reference: this._reference };
  }

  async invalidate(): Promise<InvalidateReferenceResult> {
    if (this._reference === null) {
      return { ok: false, cause: 'not-found', message: 'No AI-for-Thai credential reference to invalidate.' };
    }
    const refId = this._reference.referenceId;
    this._reference = null;
    return { ok: true, invalidatedReferenceId: refId, generationsStale: true };
  }

  async exists(): Promise<boolean> {
    return this._reference !== null;
  }
}
