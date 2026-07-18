// Cache invalidation (Story 4.15). Scoped invalidation of cache index entries.
// CacheInvalidationScope is a discriminated union of the smallest proven scopes
// (AD-18). matchesEntry compares only the scope's bound field against the
// entry's recorded bound field. invalidateCache marks ONLY matching entries
// 'invalidated'; unrelated service Evidence is untouched. The raw key NEVER
// enters any invalidation structure (AD-11).

import type { CacheIndexEntry } from './cacheIndex.js';

// ---------------------------------------------------------------------------
// CacheInvalidationScope
// ---------------------------------------------------------------------------

/**
 * Discriminated scope for cache invalidation. Each kind targets the smallest
 * proven scope (AD-18):
 * - serviceId: invalidate all entries for a specific service.
 * - effectiveConfigurationId: invalidate entries with a specific generation id.
 * - credentialRevision: invalidate entries with a specific credential revision.
 * - contractVersion: invalidate entries with a specific contract version.
 * - sourceContentHash: invalidate entries with a specific source content hash.
 * - endpoint: invalidate entries with a specific endpoint URL.
 * - all: invalidate every entry in the index.
 */
export type CacheInvalidationScope =
  | { readonly kind: 'serviceId'; readonly serviceId: string }
  | { readonly kind: 'effectiveConfigurationId'; readonly id: string }
  | { readonly kind: 'credentialRevision'; readonly revision: string }
  | { readonly kind: 'contractVersion'; readonly version: string }
  | { readonly kind: 'sourceContentHash'; readonly hash: string }
  | { readonly kind: 'endpoint'; readonly endpoint: string }
  | { readonly kind: 'all' };

// ---------------------------------------------------------------------------
// InvalidationReceipt
// ---------------------------------------------------------------------------

/** Receipt from a cache invalidation operation. */
export interface InvalidationReceipt {
  /** The scope that was invalidated. */
  readonly scope: CacheInvalidationScope;
  /** Number of entries that were invalidated. */
  readonly affectedCount: number;
  /** Digests of the affected entries. */
  readonly affectedDigests: readonly string[];
}

// ---------------------------------------------------------------------------
// matchesEntry
// ---------------------------------------------------------------------------

/**
 * Check whether a CacheIndexEntry matches a CacheInvalidationScope.
 * Pure function — compares only the scope's bound field against the entry's
 * recorded bound field. Smallest-proven-scope semantics (AD-18).
 */
export function matchesEntry(
  scope: CacheInvalidationScope,
  entry: CacheIndexEntry,
): boolean {
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

// ---------------------------------------------------------------------------
// invalidateCache
// ---------------------------------------------------------------------------

/**
 * Invalidate entries in a CacheIndex matching the given scope. Marks ONLY
 * matching entries as 'invalidated'. Unrelated service Evidence is untouched
 * (AD-18). Returns an InvalidationReceipt with the affected digests.
 *
 * Does NOT delete any Evidence record — deletion is out of this epic.
 */
export function invalidateCache(
  index: { invalidate(scope: CacheInvalidationScope): readonly string[] },
  scope: CacheInvalidationScope,
): InvalidationReceipt {
  const affectedDigests = index.invalidate(scope);
  return {
    scope,
    affectedCount: affectedDigests.length,
    affectedDigests,
  };
}
