// AI-for-Thai credential onboarding types (Story 4.3). One shared opaque
// CredentialGroupId = aiforthai for the four launch services; never reaches
// Typhoon, SCBx, hosted components, logs, prompts, sessions, previews, or
// output. Product persistence stores ONLY reference + revision + secret-free
// fingerprint — never the secret value.

import type { CredentialGroupId } from '../../permissions/credentialIdentity.js';

/** The single shared credential group id for all four AI-for-Thai launch
 * services (T-OCR, Speech-to-Text, Extract Address, NER). */
export const AI_FOR_THAI_CREDENTIAL_ID: CredentialGroupId = 'aiforthai';

/** The verified AI-for-Thai API endpoint host. */
export const AI_FOR_THAI_VERIFIED_HOST = 'https://api.aiforthai.in.th';

/** A secret-free reference to a stored AI-for-Thai credential. The fingerprint
 * is a hash of identity + host + revision — never of the secret value. */
export interface AiForThaiCredentialReference {
  /** Opaque reference id for this credential record. */
  readonly referenceId: string;
  /** Credential revision — changes when the key is rotated/replaced. */
  readonly credentialRevision: string;
  /** Secret-free fingerprint (hash of identity + host + revision). */
  readonly fingerprint: string;
  /** ISO-8601 timestamp when the credential was stored. */
  readonly storedAt: string;
}

/** A credential revision string. */
export type CredentialRevision = string;

/** Typed result of the AI-for-Thai JIT onboarding flow. */
export type AiForThaiOnboardingResult =
  | {
      readonly ok: true;
      readonly fingerprint: string;
      readonly reference: AiForThaiCredentialReference;
    }
  | {
      readonly ok: false;
      readonly cause: 'cancelled' | 'headless-blocked' | 'unavailable' | 'unhealthy' | 'unknown-outcome';
      readonly message: string;
      readonly nextActions: readonly ('inspect' | 'replace' | 'remove' | 'exit')[];
    };

/** Typed result of removing an AI-for-Thai credential. */
export type CredentialRemovalResult =
  | { readonly ok: true; readonly invalidatedReferenceId: string }
  | { readonly ok: false; readonly cause: 'not-found' | 'store-error'; readonly message: string };

/** Typed result of rotating an AI-for-Thai credential. */
export type CredentialRotationResult =
  | { readonly ok: true; readonly newReference: AiForThaiCredentialReference }
  | {
      readonly ok: false;
      readonly cause:
        | 'not-found'
        | 'store-error'
        | 'cancelled'
        | 'headless-blocked'
        | 'unavailable'
        | 'unhealthy'
        | 'unknown-outcome';
      readonly message: string;
      readonly nextActions: readonly ('inspect' | 'replace' | 'remove' | 'exit')[];
    };

/** Disclosure text shown before the masked credential form. Explains the
 * reviewed endpoint, separate credential purpose, local OS credential storage,
 * and four-service scope. */
export const AI_FOR_THAI_DISCLOSURE = [
  'AI-for-Thai is the shared credential group for four Specialist Services:',
  '  - T-OCR (Thai Optical Character Recognition)',
  '  - Speech-to-Text (Thai speech recognition)',
  '  - Extract Address (Thai address extraction)',
  '  - Named Entity Recognition (Thai NER)',
  '',
  `Reviewed endpoint: ${AI_FOR_THAI_VERIFIED_HOST} (called directly from this CLI; no hosted proxy).`,
  'Your API key is stored in the OS credential facility (Windows Credential Manager / macOS Keychain).',
  'The key is never written to .env, project files, SQLite, journal, transcript, or output.',
  'The key is shared by all four services and never reaches Typhoon, SCBx, or any hosted component.',
  'You can remove or rotate the key at any time.',
].join('\n');
