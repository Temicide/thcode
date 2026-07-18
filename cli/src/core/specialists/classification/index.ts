// Specialist failure classification barrel export (Story 4.16).

export type {
  FailureClass,
  FailureScope,
  ClassifiedFailure,
  QuarantineDecision,
  QuarantineReceipt,
  CredentialGroupMember,
  ClassifiedFailureProjection,
  ClassifiedSpecialistFailure,
} from './types.js';

export {
  classifySpecialistFailure,
  classifyHealthFailure,
  type ClassificationContext,
} from './classifier.js';

export {
  decideQuarantine,
  applyQuarantine,
} from './quarantine.js';

export {
  projectClassifiedFailure,
  nextActionFor,
} from './projection.js';
