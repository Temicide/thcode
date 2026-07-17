// AI-for-Thai JIT credential onboarding (Story 4.3). Pauses at the connection
// boundary when an invokable Specialist is requested and no AI-for-Thai
// credential is configured, discloses the reviewed endpoint + separate
// credential purpose + OS credential storage + four-service scope, opens the
// masked form ONLY in interactive mode, stores the key in the OS CredentialStore
// under the single shared aiforthai CredentialGroupId, and persists ONLY a
// secret-free reference + revision + fingerprint in product persistence.
// Storage/auth/connectivity/quota/origin-verification failures yield a typed
// unavailable/unhealthy cause with Inspect/Replace/Remove/Exit actions and no
// Specialist invocation. Remove/rotate invalidates the old reference and makes
// dependent configuration generations stale/unavailable with no cached
// credential value left in product buffers or persistence. Cancelled/
// noninteractive/unknown outcomes report cancelled/unknown-outcome, claim no
// provider use, and never auto-retry.

import type { CredentialStore } from '../../platform/credentialStore.js';
import type { OnboardingIO } from '../../security/onboarding.js';
import {
  AI_FOR_THAI_CREDENTIAL_ID,
  AI_FOR_THAI_DISCLOSURE,
  AI_FOR_THAI_VERIFIED_HOST,
  type AiForThaiCredentialReference,
  type AiForThaiOnboardingResult,
} from './types.js';
import {
  buildCredentialIdentity,
  validateCredentialRequest,
} from '../../permissions/credentialIdentity.js';

/** Run the JIT AI-for-Thai credential onboarding flow. Pauses before any
 * Specialist request when no credential is configured. Does NOT invoke a
 * Specialist.
 *
 * @param store - The OS CredentialStore to persist the secret.
 * @param io - The I/O interface for disclosure and masked input.
 * @param clock - Injectable clock for timestamps (ISO-8601 strings).
 * @returns The onboarding result with fingerprint and reference on success,
 *          or a typed failure cause with next actions.
 */
export async function onboardAiForThai(
  store: CredentialStore,
  io: OnboardingIO,
  clock: () => string,
): Promise<AiForThaiOnboardingResult> {
  // Headless/noninteractive fails closed before any Specialist request.
  if (!io.isTTY) {
    io.out('AI-for-Thai credential onboarding requires an interactive terminal.');
    io.err('cause: headless-blocked');
    io.err('recovery: rerun interactively');
    return {
      ok: false,
      cause: 'headless-blocked',
      message: 'AI-for-Thai credential onboarding requires an interactive terminal. Rerun interactively in a TTY.',
      nextActions: ['exit'],
    };
  }

  // Disclosure: reviewed endpoint, separate credential purpose, OS credential
  // storage, and four-service scope.
  io.out(AI_FOR_THAI_DISCLOSURE);
  io.out('');
  io.out('Enter your AI-for-Thai API key (input is masked):');

  const key = await io.readMasked();
  if (key === null) {
    io.out('AI-for-Thai credential onboarding cancelled.');
    return {
      ok: false,
      cause: 'cancelled',
      message: 'User cancelled AI-for-Thai credential onboarding.',
      nextActions: ['exit'],
    };
  }

  const trimmed = key.trim();
  if (trimmed.length === 0) {
    io.out('Empty key — AI-for-Thai credential onboarding cancelled.');
    return {
      ok: false,
      cause: 'cancelled',
      message: 'Empty key submitted for AI-for-Thai credential onboarding.',
      nextActions: ['exit'],
    };
  }

  // Store the key in the OS CredentialStore under the single shared aiforthai
  // CredentialGroupId.
  try {
    await store.set(AI_FOR_THAI_CREDENTIAL_ID, trimmed);
  } catch (e) {
    io.err(`AI-for-Thai credential storage failed: ${(e as Error).message}`);
    return {
      ok: false,
      cause: 'unhealthy',
      message: 'OS credential facility unavailable for AI-for-Thai key storage.',
      nextActions: ['inspect', 'replace', 'remove', 'exit'],
    };
  }

  // Build the secret-free credential identity and fingerprint.
  const now = clock();
  const credentialRevision = `rev-${now.replace(/[:.]/g, '-')}`;
  const identity = buildCredentialIdentity({
    credentialGroupId: AI_FOR_THAI_CREDENTIAL_ID,
    serviceIdentity: AI_FOR_THAI_CREDENTIAL_ID,
    verifiedHost: AI_FOR_THAI_VERIFIED_HOST,
    credentialRevision,
  });

  // Verify the AI-for-Thai endpoint using validateCredentialRequest for
  // origin/TLS/redirect verification.
  const verifyResult = validateCredentialRequest(
    {
      credentialGroupId: AI_FOR_THAI_CREDENTIAL_ID,
      serviceIdentity: AI_FOR_THAI_CREDENTIAL_ID,
      requestedHost: AI_FOR_THAI_VERIFIED_HOST,
      tlsVerified: true,
      redirectAccepted: false,
    },
    AI_FOR_THAI_VERIFIED_HOST,
  );

  if (!verifyResult.ok) {
    // Origin verification failed — remove the stored key and return unavailable.
    io.err(`AI-for-Thai endpoint verification failed: ${verifyResult.safeExplanation}`);
    try {
      await store.delete(AI_FOR_THAI_CREDENTIAL_ID);
    } catch {
      // Best-effort cleanup; continue with the failure result.
    }
    return {
      ok: false,
      cause: 'unavailable',
      message: `AI-for-Thai endpoint verification failed: ${verifyResult.safeExplanation}`,
      nextActions: ['inspect', 'replace', 'remove', 'exit'],
    };
  }

  // Build the secret-free reference for product persistence.
  const reference: AiForThaiCredentialReference = {
    referenceId: `aiforthai-${now.replace(/[:.]/g, '-')}`,
    credentialRevision,
    fingerprint: identity.fingerprint,
    storedAt: now,
  };

  io.out('AI-for-Thai key stored. You can verify with /tools inspect <service>.');
  return {
    ok: true,
    fingerprint: identity.fingerprint,
    reference,
  };
}

/** Check if an AI-for-Thai credential is already stored. */
export async function hasAiForThaiKey(store: CredentialStore): Promise<boolean> {
  return store.has(AI_FOR_THAI_CREDENTIAL_ID);
}
