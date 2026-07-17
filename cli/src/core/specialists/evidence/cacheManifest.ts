// CacheManifest identity computation (Story 4.14). Deterministic SHA-256 over
// canonical JSON of ALL bound fields in a fixed order. ANY field difference
// produces a different digest — no match. Pure, no Date/random.

import { createHash } from 'node:crypto';
import type { CacheManifest, CacheManifestInput } from './types.js';

// ---------------------------------------------------------------------------
// Canonical JSON serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a value to canonical JSON for deterministic hashing. Uses a fixed
 * field order: sorted keys for objects, declared order for arrays. No
 * whitespace. This ensures the same logical input always produces the same
 * byte sequence.
 */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalJson(item));
    return `[${items.join(',')}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const pairs = keys.map((k) => {
      const v = (value as Record<string, unknown>)[k];
      // Skip undefined values for optional fields
      if (v === undefined) return null;
      return `${canonicalJson(k)}:${canonicalJson(v)}`;
    }).filter(Boolean);
    return `{${pairs.join(',')}}`;
  }

  return String(value);
}

// ---------------------------------------------------------------------------
// Digest computation
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic SHA-256 digest over all bound fields of a
 * CacheManifestInput. The canonical JSON uses a fixed field order (sorted
 * keys; semanticInputs in their declared order). ANY field difference
 * produces a different digest.
 */
export function computeCacheManifestDigest(input: CacheManifestInput): string {
  const hash = createHash('sha256');

  // Fixed field order for deterministic hashing
  hash.update(canonicalJson(input.manifestVersion));
  hash.update('\x00');
  hash.update(canonicalJson(input.serviceId));
  hash.update('\x00');
  hash.update(canonicalJson(input.contractVersion));
  hash.update('\x00');
  hash.update(canonicalJson(input.verifiedOrigin));
  hash.update('\x00');

  // semanticInputs: each as mediaType:contentHash in declared order
  for (const si of input.semanticInputs) {
    hash.update(canonicalJson(si.mediaType));
    hash.update('\x00');
    hash.update(canonicalJson(si.contentHash));
    hash.update('\x00');
  }

  hash.update(canonicalJson(input.requestOptions));
  hash.update('\x00');

  // preprocessing: sorted array
  const sortedPreprocessing = [...input.preprocessing].sort();
  for (const p of sortedPreprocessing) {
    hash.update(canonicalJson(p));
    hash.update('\x00');
  }

  hash.update(canonicalJson(input.mappingVersion));
  hash.update('\x00');
  hash.update(canonicalJson(input.schemaVersion));
  hash.update('\x00');
  hash.update(canonicalJson(input.effectiveConfigurationId));
  hash.update('\x00');
  hash.update(canonicalJson(input.transformationPolicy));
  hash.update('\x00');
  hash.update(canonicalJson(input.sourceIdentity));

  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Build CacheManifest
// ---------------------------------------------------------------------------

/**
 * Build a complete CacheManifest from input fields, computing the
 * deterministic digest.
 */
export function buildCacheManifest(input: CacheManifestInput): CacheManifest {
  const digest = computeCacheManifestDigest(input);

  return {
    manifestVersion: input.manifestVersion,
    serviceId: input.serviceId,
    contractVersion: input.contractVersion,
    verifiedOrigin: input.verifiedOrigin,
    semanticInputs: input.semanticInputs,
    requestOptions: input.requestOptions,
    preprocessing: input.preprocessing,
    mappingVersion: input.mappingVersion,
    schemaVersion: input.schemaVersion,
    effectiveConfigurationId: input.effectiveConfigurationId,
    transformationPolicy: input.transformationPolicy,
    sourceIdentity: input.sourceIdentity,
    digest,
  };
}

// ---------------------------------------------------------------------------
// Match check
// ---------------------------------------------------------------------------

/**
 * Check whether a CacheManifest matches a candidate input. Recomputes the
 * digest for the candidate and compares. ANY field difference → false.
 */
export function cacheManifestMatches(
  a: CacheManifest,
  bInput: CacheManifestInput,
): boolean {
  const bDigest = computeCacheManifestDigest(bInput);
  return a.digest === bDigest;
}
