import { describe, expect, it } from 'vitest';
import {
  InMemoryCredentialStore,
  SESSION_DATA_KEY_ID,
} from '../src/core/platform/credentialStore.js';
import {
  decryptField,
  encryptField,
  generateDataKey,
  workspaceBindingIndex,
} from '../src/core/sessions/crypto.js';

describe('CredentialStore interface (in-memory fake)', () => {
  it('get returns null when nothing stored', async () => {
    const store = new InMemoryCredentialStore();
    expect(await store.get('typhoon')).toBeNull();
    expect(await store.has('typhoon')).toBe(false);
  });

  it('set/get/has round-trips a secret by provider id', async () => {
    const store = new InMemoryCredentialStore();
    await store.set('typhoon', 'sk-test-not-a-real-key');
    expect(await store.has('typhoon')).toBe(true);
    expect(await store.get('typhoon')).toBe('sk-test-not-a-real-key');
  });

  it('set replaces an existing secret (rotation)', async () => {
    const store = new InMemoryCredentialStore();
    await store.set('typhoon', 'old');
    await store.set('typhoon', 'new');
    expect(await store.get('typhoon')).toBe('new');
  });

  it('delete removes a secret and is a no-op when absent', async () => {
    const store = new InMemoryCredentialStore();
    await store.set('typhoon', 'x');
    await store.delete('typhoon');
    expect(await store.get('typhoon')).toBeNull();
    await expect(store.delete('typhoon')).resolves.toBeUndefined();
  });

  it('keys are isolated per provider id', async () => {
    const store = new InMemoryCredentialStore();
    await store.set('typhoon', 'a');
    await store.set('pathumma', 'b');
    expect(await store.get('typhoon')).toBe('a');
    expect(await store.get('pathumma')).toBe('b');
    await store.delete('typhoon');
    expect(await store.get('pathumma')).toBe('b');
  });

  it('reserves a distinct id for the session data key (ADR 0018)', async () => {
    const store = new InMemoryCredentialStore();
    await store.set(SESSION_DATA_KEY_ID, generateDataKey().toString('base64'));
    await store.set('typhoon', 'provider-key');
    // Provider keys are never reused as session-encryption keys.
    expect(await store.get(SESSION_DATA_KEY_ID)).not.toBe(await store.get('typhoon'));
  });
});

describe('session field encryption (AES-256-GCM, ADR 0018)', () => {
  it('round-trips with the correct key and record id', () => {
    const key = generateDataKey();
    const field = encryptField('บันทึกลับของเปรม', key, 'transcript:abc');
    expect(decryptField(field, key, 'transcript:abc')).toBe('บันทึกลับของเปรม');
  });

  it('unique nonce per record: same plaintext encrypts differently', () => {
    const key = generateDataKey();
    const a = encryptField('same', key, 'r1');
    const b = encryptField('same', key, 'r1');
    expect(a.c).not.toBe(b.c);
    expect(a.n).not.toBe(b.n);
  });

  it('binds record identity: ciphertext cannot be moved between records', () => {
    const key = generateDataKey();
    const field = encryptField('secret', key, 'session:1:name');
    expect(() => decryptField(field, key, 'session:2:name')).toThrow();
  });

  it('rejects the wrong key', () => {
    const field = encryptField('secret', generateDataKey(), 'r1');
    expect(() => decryptField(field, generateDataKey(), 'r1')).toThrow();
  });

  it('workspace binding index is deterministic and non-reversible-shaped', () => {
    const key = generateDataKey();
    const i1 = workspaceBindingIndex('C:\\work\\repo', key);
    const i2 = workspaceBindingIndex('C:\\work\\repo', key);
    const other = workspaceBindingIndex('C:\\work\\other', key);
    expect(i1).toBe(i2);
    expect(i1).not.toBe(other);
    expect(i1).toMatch(/^[0-9a-f]{64}$/);
    expect(i1).not.toContain('repo');
  });
});
