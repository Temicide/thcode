// Specialist consent barrel export (Story 4.8).

export type {
  ConsentReference,
  ConsentDialogSummary,
  ConsentDialogInitialFocus,
  SafeSourceIdentity,
  SafePayloadSummary,
  SpecialistManifestInput,
  SpecialistConsentInput,
  SpecialistRevalidationInput,
} from './types.js';

export type { ConsentEvaluationResult, PreparedPayloadManifest, TransferConsent } from '../../permissions/transferConsent.js';

export {
  resolveRetentionHandling,
} from './retention.js';

export {
  computePayloadByteDigest,
  buildSpecialistPreparedPayloadManifest,
} from './manifest.js';

export {
  requestSpecialistTransferConsent,
  revalidateSpecialistTransferConsent,
  toConsentReference,
} from './consent.js';

export {
  buildConsentDialogSummary,
} from './dialog.js';
