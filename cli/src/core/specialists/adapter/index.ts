// Specialist adapter barrel export (Story 4.9).

export type {
  SpecialistRequestOptions,
  SpecialistRequest,
  CredentialScope,
  SpecialistTransportRequest,
  SpecialistRawResponse,
  SpecialistFieldValue,
  SpecialistResult,
  SpecialistFailureCategory,
  Retryability,
  SpecialistFailure,
  SpecialistOutcome,
  SpecialistAdapterRefusalCause,
  SpecialistAdapterRefusal,
  SpecialistInvocation,
  SpecialistServiceHandler,
  SpecialistTransport,
  SpecialistTransportResponse,
  SpecialistOutputProjection,
  SpecialistFailureProjection,
  SpecialistOutputToken,
  SpecialistFailureToken,
} from './types.js';

export {
  SPECIALIST_OUTPUT_HEADING,
  TYPHOON_EXPLANATION_HEADING,
  EVIDENCE_HEADING,
  FAILURE_PROVENANCE_HEADING,
} from './types.js';

export { validateSpecialistRequest } from './validation.js';
export { mapSpecialistFailure } from './failureMapper.js';
export { SharedSpecialistAdapter } from './adapter.js';
export { InMemorySpecialistTransport, FetchSpecialistTransport } from './transport.js';
export { projectSpecialistOutput, projectSpecialistFailure } from './projection.js';
