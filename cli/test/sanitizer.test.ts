import { describe, expect, it } from 'vitest';
import { Sanitizer } from '../src/core/security/sanitizer.js';

describe('Sanitizer (AD-24, NFR-2)', () => {
  const s = new Sanitizer();

  it('redacts API keys in credential class', () => {
    const r = s.sanitize('key: sk-abc123def4567890ghijklmnop', 'credential');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toContain('sk-abc');
  });

  it('redacts Bearer tokens in header class', () => {
    const r = s.sanitize('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc', 'header');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toContain('[redacted]');
  });

  it('redacts URL query secrets', () => {
    const r = s.sanitize('https://api.example.com?api_key=secret123&foo=bar', 'url-query');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toContain('secret123');
  });

  it('redacts env KEY=value patterns', () => {
    const r = s.sanitize('TYPHOON_API_KEY=sk-secret\nHOME=/home', 'environment');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toContain('sk-secret');
    if (r.ok) expect(r.value).toContain('HOME=/home');
  });

  it('preserves Thai UTF-8 and technical identifiers (AC #4)', () => {
    const thai = 'สวัสดีครับ @path/to/file.ts https://example.com hash:abc123';
    const r = s.sanitize(thai, 'user-content');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toContain('สวัสดีครับ');
      expect(r.value).toContain('@path/to/file.ts');
      expect(r.value).toContain('https://example.com');
    }
  });

  it('sanitizeOrBlock returns redacted value when sanitization succeeds', () => {
    const r = s.sanitizeOrBlock('sk-abc123def4567890ghijklmnop', 'credential', '[redacted]');
    expect(r).toContain('[redacted:api-key]');
  });

  it('records omissions in the result', () => {
    const r = s.sanitize('Authorization: Bearer token123', 'header');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.omissions.length).toBeGreaterThan(0);
  });
});