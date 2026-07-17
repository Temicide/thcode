// AI-for-Thai credential onboarding barrel export (Story 4.3).

export {
  AI_FOR_THAI_CREDENTIAL_ID,
  AI_FOR_THAI_VERIFIED_HOST,
  AI_FOR_THAI_DISCLOSURE,
  type AiForThaiCredentialReference,
  type CredentialRevision,
  type AiForThaiOnboardingResult,
  type CredentialRemovalResult,
  type CredentialRotationResult,
} from './types.js';

export {
  onboardAiForThai,
  hasAiForThaiKey,
} from './onboarding.js';

export {
  type CredentialPersistence,
  type LoadReferenceResult,
  type InvalidateReferenceResult,
  InMemoryCredentialPersistence,
} from './persistence.js';
