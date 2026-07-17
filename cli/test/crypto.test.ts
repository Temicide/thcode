import { describe, expect, it } from 'vitest';
import {
  decryptField,
  decryptFieldWithFallback,
  encryptField,
  generateDataKey,
  rotateKey,
} from '../src/core/sessions/crypto.js';

describe('crypto — AES-256-GCM with AAD (AC #1, #3)', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const key = generateDataKey();
    const field = encryptField('สวัสดีครับ', key, 'record:1');
    expect(field.alg).toBe('aes-256-gcm');
    expect(field.v).toBe(1);
    const decrypted = decryptField(field, key, 'record:1');
    expect(decrypted).toBe('สวัสดีครับ');
  });

  it('decryption fails with wrong key (fail-closed, AC #3)', () => {
    const key1 = generateDataKey();
    const key2 = generateDataKey();
    const field = encryptField('secret', key1, 'record:1');
    expect(() => decryptField(field, key2, 'record:1')).toThrow();
  });

  it('decryption fails with wrong recordId (AAD mismatch)', () => {
    const key = generateDataKey();
    const field = encryptField('secret', key, 'record:1');
    expect(() => decryptField(field, key, 'record:2')).toThrow();
  });

  it('decryptFieldWithFallback tries old key on failure', () => {
    const oldKey = generateDataKey();
    const newKey = generateDataKey();
    const field = encryptField('legacy data', oldKey, 'record:1');
    const r = decryptFieldWithFallback(field, newKey, oldKey, 'record:1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('legacy data');
  });

  it('decryptFieldWithFallback fails when both keys fail', () => {
    const oldKey = generateDataKey();
    const newKey = generateDataKey();
    const wrongKey = generateDataKey();
    const field = encryptField('data', wrongKey, 'record:1');
    const r = decryptFieldWithFallback(field, newKey, oldKey, 'record:1');
    expect(r.ok).toBe(false);
  });

  it('rotateKey stages, migrates, and verifies', () => {
    const oldKey = generateDataKey();
    const newKey = generateDataKey();
    let migrated = false;
    const reEncrypt = (_old: Buffer, _new: Buffer) => {
      migrated = true;
      return true;
    };
    const r = rotateKey(oldKey, newKey, reEncrypt);
    expect(r.ok).toBe(true);
    expect(migrated).toBe(true);
  });

  it('rotateKey fails when re-encryption fails', () => {
    const r = rotateKey(generateDataKey(), generateDataKey(), () => false);
    expect(r.ok).toBe(false);
  });
});