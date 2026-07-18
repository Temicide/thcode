// CacheIndex (Story 4.15). In-memory index mapping cacheManifestDigest to
// CacheIndexEntry. Deterministic; injectable clock; no raw key. The index
// records which Evidence records are available for reuse, their retention
// state, and their invalidation state. Entries are NEVER deleted — only
// marked expired or invalidated (deletion is out of this epic).

import type { CacheInvalidationScope } from './invalidation.js';
import type { RetentionPolicy } from './retention.js';

// ---------------------------------------------------------------------------
// CacheIndexEntry
// ---------------------------------------------------------------------------

/** State of a cache index entry. */
export type CacheIndexEntryState = 'valid' | 'expired' | 'invalidated';

/**
 * A single entry in the CacheIndex. Records the cacheManifestDigest, the
 * evidenceId it points to, the service identity and bound fields from the
 * manifest, observation time, optional expiry, retention policy, and state.
 *
 * The raw key NEVER enters this structure (AD-11, AD-24).
 */
export interface CacheIndexEntry {
  /** Deterministic SHA-256 digest of the CacheManifest (the cache key). */
  readonly cacheManifestDigest: string;
  /** Evidence id this entry points to. */
  readonly evidenceId: string;
  /** Service identity. */
  readonly serviceId: string;
  /** Effective configuration generation id. */
  readonly effectiveConfigurationId: string;
  /** Contract version. */
  readonly contractVersion: string;
  /** Credential revision (optional — may be absent for some services). */
  readonly credentialRevision?: string;
  /** Source content hash. */
  readonly sourceContentHash: string;
  /** Endpoint URL. */
  readonly endpoint: string;
  /** When the observation was made (ISO-8601 from the injected clock). */
  readonly observationTime: string;
  /** When this entry expires (ISO-8601), if a TTL was set. */
  readonly expiresAt?: string;
  /** Retention policy bound at record time. */
  readonly retention: RetentionPolicy;
  /** Current state of this entry. */
  readonly state: CacheIndexEntryState;
}

// ---------------------------------------------------------------------------
// CacheIndex
// ---------------------------------------------------------------------------

/**
 * In-memory CacheIndex. Maps cacheManifestDigest → CacheIndexEntry.
 * Deterministic; injectable clock; no raw key.
 *
 * - record: add or update an entry for a given digest.
 * - lookup: find an entry by digest, returning its state.
 * - markExpired: sweep all entries whose expiresAt < now, marking them expired.
 * - invalidate: mark matching entries as invalidated (scoped).
 * - list: return all entries.
 */
export class CacheIndex {
  private readonly _entries = new Map<string, CacheIndexEntry>();

  // ---------------------------------------------------------------------------
  // Record
  // ---------------------------------------------------------------------------

  /**
   * Record a new cache index entry. If an entry already exists for the same
   * digest, it is overwritten (e.g. after a force-fresh produces new Evidence).
   */
  record(
    manifestDigest: string,
    evidenceId: string,
    opts: {
      readonly serviceId: string;
      readonly effectiveConfigurationId: string;
      readonly contractVersion: string;
      readonly credentialRevision?: string;
      readonly sourceContentHash: string;
      readonly endpoint: string;
      readonly observationTime: string;
      readonly retention: RetentionPolicy;
      readonly expiresAt?: string;
    },
  ): void {
    const entry: CacheIndexEntry = {
      cacheManifestDigest: manifestDigest,
      evidenceId,
      serviceId: opts.serviceId,
      effectiveConfigurationId: opts.effectiveConfigurationId,
      contractVersion: opts.contractVersion,
      credentialRevision: opts.credentialRevision,
      sourceContentHash: opts.sourceContentHash,
      endpoint: opts.endpoint,
      observationTime: opts.observationTime,
      expiresAt: opts.expiresAt,
      retention: opts.retention,
      state: 'valid',
    };
    this._entries.set(manifestDigest, entry);
  }

  // ---------------------------------------------------------------------------
  // Lookup
  // ---------------------------------------------------------------------------

  /**
   * Look up an entry by cacheManifestDigest. Returns the entry if found and
   * in 'valid' state. Returns a typed cause for miss/expired/invalidated.
   */
  lookup(
    digest: string,
  ): { readonly ok: true; readonly entry: CacheIndexEntry } | { readonly ok: false; readonly cause: 'miss' | 'expired' | 'invalidated' } {
    const entry = this._entries.get(digest);
    if (entry === undefined) {
      return { ok: false, cause: 'miss' };
    }
    if (entry.state === 'expired') {
      return { ok: false, cause: 'expired' };
    }
    if (entry.state === 'invalidated') {
      return { ok: false, cause: 'invalidated' };
    }
    return { ok: true, entry };
  }

  // ---------------------------------------------------------------------------
  // Mark expired
  // ---------------------------------------------------------------------------

  /**
   * Sweep all entries whose expiresAt is defined and < now, marking them
   * 'expired'. Returns the digests of entries that were newly marked expired.
   * Does NOT delete any entry or Evidence record.
   */
  markExpired(now: string): readonly string[] {
    const expired: string[] = [];
    for (const [digest, entry] of this._entries) {
      if (entry.state === 'valid' && entry.expiresAt !== undefined && entry.expiresAt < now) {
        this._entries.set(digest, { ...entry, state: 'expired' });
        expired.push(digest);
      }
    }
    return expired;
  }

  // ---------------------------------------------------------------------------
  // Invalidate
  // ---------------------------------------------------------------------------

  /**
   * Invalidate entries matching the given scope. Marks ONLY matching entries
   * as 'invalidated'. Unrelated service Evidence is untouched (AD-18).
   * Returns the digests of entries that were invalidated.
   */
  invalidate(scope: CacheInvalidationScope): readonly string[] {
    const invalidated: string[] = [];
    for (const [digest, entry] of this._entries) {
      if (entry.state === 'valid' && this._matchesScope(scope, entry)) {
        this._entries.set(digest, { ...entry, state: 'invalidated' });
        invalidated.push(digest);
      }
    }
    return invalidated;
  }

  /**
   * Invalidate a single entry by its cacheManifestDigest (per-digest). Marks
   * the entry 'invalidated' regardless of its current state. Used for the
   * corrupt-Evidence and deletion-coordination paths where one specific digest
   * must be dropped without affecting any other entry (AD-18 smallest proven
   * scope). Returns true if the entry existed. Does NOT delete the Evidence
   * record (deletion is out of this epic).
   */
  invalidateDigest(digest: string): boolean {
    const entry = this._entries.get(digest);
    if (entry === undefined) {
      return false;
    }
    this._entries.set(digest, { ...entry, state: 'invalidated' });
    return true;
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  /** Return all entries (read-only snapshot). */
  list(): readonly CacheIndexEntry[] {
    return [...this._entries.values()];
  }

  // ---------------------------------------------------------------------------
  // Scope matching (internal)
  // ---------------------------------------------------------------------------

  /**
   * Check whether a CacheIndexEntry matches a CacheInvalidationScope.
   * Smallest-proven-scope semantics (AD-18): only the exact bound field
   * named by the scope is compared.
   */
  private _matchesScope(scope: CacheInvalidationScope, entry: CacheIndexEntry): boolean {
    switch (scope.kind) {
      case 'serviceId':
        return entry.serviceId === scope.serviceId;
      case 'effectiveConfigurationId':
        return entry.effectiveConfigurationId === scope.id;
      case 'credentialRevision':
        return entry.credentialRevision === scope.revision;
      case 'contractVersion':
        return entry.contractVersion === scope.version;
      case 'sourceContentHash':
        return entry.sourceContentHash === scope.hash;
      case 'endpoint':
        return entry.endpoint === scope.endpoint;
      case 'all':
        return true;
    }
  }
}
