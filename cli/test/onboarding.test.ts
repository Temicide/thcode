import { describe, expect, it } from 'vitest';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';
import { hasTyphoonKey, onboardTyphoon, TYPHOON_PROVIDER_ID } from '../src/core/security/onboarding.js';

function ttyIO(key: string | null) {
  return {
    isTTY: true,
    out: () => {},
    err: () => {},
    readMasked: async () => key,
  };
}

function headlessIO() {
  return { ...ttyIO(null), isTTY: false };
}

describe('Typhoon credential onboarding (AD-11, FR-2)', () => {
  it('stores a key and returns a fingerprint', async () => {
    const store = new InMemoryCredentialStore();
    const r = await onboardTyphoon(store, ttyIO('sk-test-key-12345'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fingerprint).toContain('typhoon:');
    expect(await store.get(TYPHOON_PROVIDER_ID)).toBe('sk-test-key-12345');
  });

  it('fails closed when headless (AC #4)', async () => {
    const store = new InMemoryCredentialStore();
    const r = await onboardTyphoon(store, headlessIO());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cause).toBe('headless-blocked');
  });

  it('returns cancelled on null input', async () => {
    const store = new InMemoryCredentialStore();
    const r = await onboardTyphoon(store, ttyIO(null));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cause).toBe('cancelled');
  });

  it('returns cancelled on empty key', async () => {
    const store = new InMemoryCredentialStore();
    const r = await onboardTyphoon(store, ttyIO('  '));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cause).toBe('cancelled');
  });

  it('hasTyphoonKey returns false when no key stored', async () => {
    const store = new InMemoryCredentialStore();
    expect(await hasTyphoonKey(store)).toBe(false);
  });

  it('hasTyphoonKey returns true after onboarding', async () => {
    const store = new InMemoryCredentialStore();
    await onboardTyphoon(store, ttyIO('sk-key'));
    expect(await hasTyphoonKey(store)).toBe(true);
  });
});