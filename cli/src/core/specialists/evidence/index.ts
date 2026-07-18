// Specialist Evidence barrel export (Story 4.14).

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
