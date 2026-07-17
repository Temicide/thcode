// Typhoon credential onboarding (AD-11, FR-2). Discloses the provider identity,
// verified host, and storage behavior before accepting a masked key. Headless
// fails closed. Keys never enter SQLite, journal, transcript, or output.

import type { CredentialStore } from '../platform/credentialStore.js';

export const TYPHOON_PROVIDER_ID = 'typhoon';
export const TYPHOON_DISCLOSURE = [
  'Typhoon is the only Release-1 reasoning provider.',
  'Your API key is stored in the OS credential facility (Windows Credential Manager / macOS Keychain).',
  'The key is never written to .env, project files, SQLite, journal, transcript, or output.',
  'AI-for-Thai credentials are separate and onboarded just-in-time.',
  'You can remove or rotate the key at any time.',
].join('\n');

export type OnboardingResult =
  | { ok: true; fingerprint: string }
  | { ok: false; cause: 'cancelled' | 'unavailable' | 'failed' | 'headless-blocked'; message: string };

export interface OnboardingIO {
  /** True when stdout is a TTY (interactive). */
  readonly isTTY: boolean;
  /** Write a line to stdout (disclosure, prompts). */
  out(line: string): void;
  /** Write a line to stderr (diagnostics). */
  err(line: string): void;
  /** Read a line of masked input. Returns null on EOF/cancel. */
  readMasked(): Promise<string | null>;
}

/** Onboard a Typhoon key through a disclosed, protected form. */
export async function onboardTyphoon(
  store: CredentialStore,
  io: OnboardingIO,
): Promise<OnboardingResult> {
  if (!io.isTTY) {
    io.out('Typhoon onboarding requires an interactive terminal.');
    io.err('cause: headless-blocked');
    io.err('recovery: rerun interactively');
    return { ok: false, cause: 'headless-blocked', message: 'Rerun interactively in a TTY.' };
  }

  io.out(TYPHOON_DISCLOSURE);
  io.out('');
  io.out('Enter your Typhoon API key (input is masked):');

  const key = await io.readMasked();
  if (key === null) {
    io.out('Onboarding cancelled.');
    return { ok: false, cause: 'cancelled', message: 'User cancelled onboarding.' };
  }

  const trimmed = key.trim();
  if (trimmed.length === 0) {
    io.out('Empty key — onboarding cancelled.');
    return { ok: false, cause: 'cancelled', message: 'Empty key submitted.' };
  }

  try {
    await store.set(TYPHOON_PROVIDER_ID, trimmed);
  } catch (e) {
    io.err(`Credential storage failed: ${(e as Error).message}`);
    return { ok: false, cause: 'failed', message: 'OS credential facility unavailable.' };
  }

  const fingerprint = `typhoon:${Date.now().toString(36)}`;
  io.out('Typhoon key stored. You can verify with /models.');
  return { ok: true, fingerprint };
}

/** Check if a Typhoon key is already stored. */
export async function hasTyphoonKey(store: CredentialStore): Promise<boolean> {
  return store.has(TYPHOON_PROVIDER_ID);
}