// CacheInvalidationPort (Story 4.15). Typed port for cache invalidation and
// deletion coordination. Because session/durable deletion is NOT in this epic,
// DeletionReceipt carries a typed 'deletion-not-supported'/'invalidated-only'
// state — stable reference behavior, NEVER claiming deletion has occurred (AC #5).
// The raw key NEVER enters any port structure (AD-11).

import type { CacheInvalidationScope, InvalidationReceipt } from './invalidation.js';
import type { CacheIndex } from './cacheIndex.js';

// ---------------------------------------------------------------------------
// DeletionReceipt
// ---------------------------------------------------------------------------

/**
 * Receipt from a deletion coordination request. Because deletion is not
 * implemented in this epic, the receipt always reports that deletion was not
 * performed. If an invalidation was applied, the state is 'invalidated-only';
 * otherwise it is 'deletion-not-supported'.
 */
export interface DeletionReceipt {
  /** Opaque reference for the deletion coordination request. */
  readonly ref: string;
  /**
   * State of the deletion coordination:
   * - 'deletion-not-supported': deletion is not supported (no action taken).
   * - 'invalidated-only': the entry was invalidated but not deleted.
   */
  readonly state: 'deletion-not-supported' | 'invalidated-only';
  /** Digests of entries affected by the coordination. */
  readonly affectedDigests: readonly string[];
  /** Always false — deletion is never claimed in this epic. */
  readonly deletionClaimed: false;
}

// ---------------------------------------------------------------------------
// CacheInvalidationPort
// ---------------------------------------------------------------------------

/**
 * Port for cache invalidation and deletion coordination. Exposes stable
 * reference behavior without claiming deletion has occurred (AC #5).
 */
export interface CacheInvalidationPort {
  /**
   * Invalidate cache entries matching the given scope. Returns a receipt
   * with the affected digests. Does NOT delete any Evidence record.
   */
  invalidate(scope: CacheInvalidationScope): Promise<InvalidationReceipt>;

  /**
   * Coordinate deletion for a reference. Because deletion is not implemented
   * in this epic, this always returns a DeletionReceipt with
   * 'deletion-not-supported' or 'invalidated-only' and deletionClaimed: false.
   */
  deletionCoordination(ref: string): Promise<DeletionReceipt>;
}

// ---------------------------------------------------------------------------
// InMemoryCacheInvalidationPort
// ---------------------------------------------------------------------------

/**
 * In-memory implementation of CacheInvalidationPort. Wraps a CacheIndex.
 * Typed; never claims deletion occurred (AC #5).
 */
export class InMemoryCacheInvalidationPort implements CacheInvalidationPort {
  private readonly _index: CacheIndex;

  constructor(index: CacheIndex) {
    this._index = index;
  }

  async invalidate(scope: CacheInvalidationScope): Promise<InvalidationReceipt> {
    const affectedDigests = this._index.invalidate(scope);
    return {
      scope,
      affectedCount: affectedDigests.length,
      affectedDigests,
    };
  }

  async deletionCoordination(ref: string): Promise<DeletionReceipt> {
    // Deletion is not supported in this epic. Check if the ref matches any
    // entry's evidenceId or cacheManifestDigest and invalidate if so.
    const entries = this._index.list();
    const matchingDigests: string[] = [];

    for (const entry of entries) {
      if (entry.evidenceId === ref || entry.cacheManifestDigest === ref) {
        matchingDigests.push(entry.cacheManifestDigest);
      }
    }

    if (matchingDigests.length > 0) {
      // Invalidate ONLY the matching digests (per-digest). This preserves the
      // smallest proven scope (AD-18) and does NOT resurrect unrelated
      // expired/invalidated entries. Deletion is never claimed (AC #5).
      for (const digest of matchingDigests) {
        this._index.invalidateDigest(digest);
      }

      return {
        ref,
        state: 'invalidated-only',
        affectedDigests: matchingDigests,
        deletionClaimed: false,
      };
    }

    return {
      ref,
      state: 'deletion-not-supported',
      affectedDigests: [],
      deletionClaimed: false,
    };
  }
}
