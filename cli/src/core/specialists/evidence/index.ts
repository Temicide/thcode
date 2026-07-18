// Specialist Evidence barrel export (Story 4.14, 4.15).

export {
  SPECIALIST_EVIDENCE_SCHEMA_VERSION,
  type EvidenceReuseState,
  type EvidenceCompleteness,
  type SpecialistEvidence,
  type CacheManifest,
  type CacheManifestInput,
  type EvidenceRepository,
  type EvidenceLoadResult,
  type EvidenceLoadCause,
  type CacheManifestError,
  type ReusedEvidenceProjection,
  type FreshEvidenceProjection,
  type SpecialistCacheHit,
} from './types.js';

export {
  computeCacheManifestDigest,
  buildCacheManifest,
  cacheManifestMatches,
  canonicalJson,
} from './cacheManifest.js';

export {
  sealSpecialistEvidence,
  type SealSpecialistEvidenceInput,
} from './seal.js';

export {
  InMemoryEvidenceRepository,
} from './repository.js';

export {
  projectReusedEvidence,
  projectFreshEvidence,
} from './projection.js';

// --- Story 4.15: Cache index, retention, invalidation, port, lookup ---

export {
  CacheIndex,
  type CacheIndexEntry,
  type CacheIndexEntryState,
} from './cacheIndex.js';

export {
  type RetentionPolicy,
  type RetentionEvaluation,
  evaluateRetention,
  applyRetention,
} from './retention.js';

export {
  type CacheInvalidationScope,
  type InvalidationReceipt,
  matchesEntry,
  invalidateCache,
} from './invalidation.js';

export {
  InMemoryCacheInvalidationPort,
  type CacheInvalidationPort,
  type DeletionReceipt,
} from './cachePort.js';

export {
  resolveCacheHit,
  type ResolveCacheHitInput,
  type ResolveCacheHitResult,
} from './cacheLookup.js';
