// Evidence reuse/fresh projections (Story 4.14). Pure functions that project
// a SpecialistEvidence into a ReusedEvidenceProjection or FreshEvidenceProjection.
// Reused evidence is visibly labeled 'reused' with original observation time,
// provenance, and cache identity — NEVER presented as a fresh live result.

import type {
  SpecialistEvidence,
  ReusedEvidenceProjection,
  FreshEvidenceProjection,
} from './types.js';

/**
 * Project a reused Evidence. The result is visibly labeled 'reused' with the
 * original observation time, provenance, and cache identity (cacheManifestDigest).
 * NEVER presented as a fresh live result.
 */
export function projectReusedEvidence(
  evidence: SpecialistEvidence,
): ReusedEvidenceProjection {
  return {
    reuseState: 'reused',
    originalObservationTime: evidence.observationTime,
    provenance: {
      endpoint: evidence.provenance.endpoint,
      method: evidence.provenance.method,
      status: evidence.provenance.status,
      transportVersion: evidence.provenance.transportVersion,
    },
    cacheId: evidence.cacheManifestDigest ?? '',
    completeness: evidence.completeness,
  };
}

/**
 * Project a fresh Evidence. The result is labeled 'fresh' with the observation
 * time, provenance, and completeness.
 */
export function projectFreshEvidence(
  evidence: SpecialistEvidence,
): FreshEvidenceProjection {
  return {
    reuseState: 'fresh',
    observationTime: evidence.observationTime,
    provenance: {
      endpoint: evidence.provenance.endpoint,
      method: evidence.provenance.method,
      status: evidence.provenance.status,
      transportVersion: evidence.provenance.transportVersion,
    },
    completeness: evidence.completeness,
  };
}
