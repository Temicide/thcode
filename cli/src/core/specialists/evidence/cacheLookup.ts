// Cache lookup resolver (Story 4.15). Encodes the gating order:
//   computeCacheManifest → resolveCacheHit (cache) →
//   [on reused: return projectReusedEvidence, STOP] →
//   health gate (force-fresh requires available) →
//   adapter dispatch → sealSpecialistEvidence → cacheIndex.record
//
// Cache lookup runs BEFORE live-health gating. A valid hit (non-expired,
// non-invalidated, forceFresh:false) returns the prior Evidence as
// reuseState:'reused' — EVEN if the service is currently unavailable/
// unhealthy/quarantined (AC #1). No outbound transfer occurs on a hit.
//
// forceFresh:true bypasses cache lookup, preserves prior Evidence (the index
// entry is NOT deleted), and requires a current 'available' health state for
// the exact generation before any transfer (AC #2).
//
// Cache lookup or invalidation failure projects exactly one of
// 'expired' | 'corrupt' | 'unavailable' and NEVER silently falls through to
// a live transfer or substitutes a service (AD-14, AC #6).

import type { CacheManifest } from './types.js';
import type { CacheIndex, CacheIndexEntry } from './cacheIndex.js';
import type { EvidenceRepository, SpecialistEvidence } from './types.js';
import type { HealthState } from '../../providers/health.js';

// ---------------------------------------------------------------------------
// ResolveCacheHitInput
// ---------------------------------------------------------------------------

export interface ResolveCacheHitInput {
  /** The CacheIndex to look up. */
  readonly index: CacheIndex;
  /** The EvidenceRepository to load Evidence from. */
  readonly repo: EvidenceRepository;
  /** The CacheManifest (with digest) to look up. */
  readonly manifest: CacheManifest;
  /** Whether to force a fresh result (bypass cache). */
  readonly forceFresh: boolean;
  /** Current time (ISO-8601 from the injected clock). */
  readonly now: string;
  /** Current health state of the service. */
  readonly healthState: HealthState;
}

// ---------------------------------------------------------------------------
// ResolveCacheHitResult
// ---------------------------------------------------------------------------

/**
 * Result of resolving a cache hit.
 *
 * - kind:'reused': a valid cache hit was found; the caller should return
 *   the Evidence relabeled via projectReusedEvidence. No transfer occurred.
 * - kind:'miss': no valid cache hit; proceed to health gate + adapter dispatch.
 * - ok:false with cause 'expired': the entry exists but is expired.
 * - ok:false with cause 'corrupt': the Evidence record is corrupt.
 * - ok:false with cause 'unavailable': force-fresh was requested but the
 *   service is not available.
 */
export type ResolveCacheHitResult =
  | { readonly ok: true; readonly kind: 'reused'; readonly evidence: SpecialistEvidence; readonly entry: CacheIndexEntry }
  | { readonly ok: true; readonly kind: 'miss' }
  | { readonly ok: false; readonly cause: 'expired' | 'corrupt' | 'unavailable' };

// ---------------------------------------------------------------------------
// resolveCacheHit
// ---------------------------------------------------------------------------

/**
 * Resolve a cache hit for a Specialist invocation. Encodes the gating order:
 *
 * 1. If forceFresh is true:
 *    - Bypass cache lookup entirely.
 *    - Require 'available' health state (AC #2).
 *    - If not available, return 'unavailable'.
 *    - If available, return 'miss' (proceed to live dispatch).
 *    - Prior Evidence is preserved (index entry NOT deleted).
 *
 * 2. If forceFresh is false:
 *    - Look up the manifest digest in the cache index.
 *    - On miss: return 'miss' (proceed to health gate + adapter dispatch).
 *    - On expired: return 'expired' (AC #6).
 *    - On invalidated: return 'miss' (treated as miss — proceed to live).
 *    - On valid entry: load the Evidence from the repository.
 *      - If load fails with 'corrupt': mark entry invalidated, return 'corrupt'.
 *      - If load fails with 'not-found': return 'miss' (entry exists but
 *        Evidence was lost — proceed to live dispatch).
 *      - If load succeeds: return 'reused' with the loaded Evidence.
 *
 * Cache lookup runs BEFORE live-health gating (AC #1). A valid hit is
 * returned even if the service is currently unavailable/unhealthy/quarantined.
 */
export async function resolveCacheHit(
  input: ResolveCacheHitInput,
): Promise<ResolveCacheHitResult> {
  const { index, repo, manifest, forceFresh, now, healthState } = input;

  // --- Force-fresh path ---
  if (forceFresh) {
    // Force-fresh requires 'available' health for the exact generation (AC #2).
    if (healthState !== 'available') {
      return { ok: false, cause: 'unavailable' };
    }
    // Bypass cache — return miss to proceed to live dispatch.
    // Prior Evidence is preserved (index entry NOT deleted).
    return { ok: true, kind: 'miss' };
  }

  // --- Normal cache lookup path ---
  // Run retention sweep first so expired entries are marked.
  index.markExpired(now);

  // Look up the manifest digest in the cache index.
  const lookupResult = index.lookup(manifest.digest);

  if (!lookupResult.ok) {
    if (lookupResult.cause === 'expired') {
      return { ok: false, cause: 'expired' };
    }
    // 'miss' or 'invalidated' — proceed to live dispatch.
    return { ok: true, kind: 'miss' };
  }

  // Valid entry found. Load the Evidence from the repository.
  const entry = lookupResult.entry;
  const loadResult = await repo.load(entry.evidenceId);

  if (!loadResult.ok) {
    if (loadResult.cause === 'corrupt') {
      // Mark ONLY this entry invalid (per-digest) so future lookups fail
      // closed. Per-digest invalidation preserves the smallest proven scope
      // (AD-18): a single corrupt Evidence does NOT touch any other entry,
      // and previously expired/invalidated entries are NOT resurrected.
      index.invalidateDigest(manifest.digest);
      return { ok: false, cause: 'corrupt' };
    }
    // 'not-found' — the entry exists but the Evidence was lost.
    // Treat as a miss (proceed to live dispatch).
    return { ok: true, kind: 'miss' };
  }

  // Evidence loaded successfully. Return it for reuse.
  return { ok: true, kind: 'reused', evidence: loadResult.evidence, entry };
}
