// Specialist output/failure projections (Story 4.9). Separate headings +
// canonical tokens; safe payload summary (no raw bytes/key); stable across
// interactive, linearized, redirected, and headless modes.

import type {
  SpecialistResult,
  SpecialistFailure,
  SpecialistOutputProjection,
  SpecialistFailureProjection,
  SPECIALIST_OUTPUT_HEADING,
  EVIDENCE_HEADING,
  FAILURE_PROVENANCE_HEADING,
} from './types.js';

/**
 * Project a SpecialistResult into a SpecialistOutputProjection for rendering.
 * Separate headings for Specialist output, Typhoon explanation, and Evidence.
 * No raw bytes/key in the projection.
 */
export function projectSpecialistOutput(result: SpecialistResult): SpecialistOutputProjection {
  return {
    heading: 'Specialist Output' as typeof SPECIALIST_OUTPUT_HEADING,
    token: 'specialist-output',
    serviceId: result.serviceId,
    serviceName: result.serviceIdentity.nameEnglish,
    fields: result.fields,
    emptyFields: result.emptyFields,
    confidence: result.confidence,
    uncertainty: result.uncertainty,
    evidenceHeading: 'Evidence' as typeof EVIDENCE_HEADING,
    evidenceToken: 'evidence',
    evidenceRef: result.evidenceRef,
    timing: result.timing,
  };
}

/**
 * Project a SpecialistFailure into a SpecialistFailureProjection for rendering.
 * Separate heading for failure provenance. No raw bytes/key in the projection.
 */
export function projectSpecialistFailure(failure: SpecialistFailure): SpecialistFailureProjection {
  return {
    heading: 'Failure Provenance' as typeof FAILURE_PROVENANCE_HEADING,
    token: 'failure-provenance',
    serviceId: failure.serviceId,
    category: failure.category,
    retryability: failure.retryability,
    scope: failure.smallestProvenScope,
    safeMessage: failure.safeMessage,
    causeCode: failure.causeCode,
    retryAfterMs: failure.retryAfterMs,
  };
}
