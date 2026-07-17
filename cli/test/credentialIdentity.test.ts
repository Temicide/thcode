// Story 2.7: credential identity + service-host isolation.
import { describe, expect, it } from 'vitest';
import {
  TYPHOON_VERSION_UNVERIFIED,
  buildCredentialIdentity,
  checkCredentialBoundary,
  credentialFingerprint,
  isCredentialAuthorityStale,
  projectConnectionInfo,
  scrubConnectionSecrets,
  validateCredentialRequest,
} from '../src/core/permissions/credentialIdentity.js';

describe('CredentialIdentity — Typhoon distinct from AI-for-Thai; secret-free (AC #1)', () => {
  it('records group, service identity, verified host, revision, and a secret-free fingerprint', () => {
    const id = buildCredentialIdentity({ credentialGroupId: 'typhoon', serviceIdentity: 'typhoon', verifiedHost: 'https://api.typhoon.example.com', credentialRevision: 'rev-1' });
    expect(id.credentialGroupId).toBe('typhoon');
    expect(id.fingerprint).toBe(credentialFingerprint('typhoon', 'https://api.typhoon.example.com', 'rev-1'));
    expect(id.fingerprint).not.toContain('secret');
  });

  it('the fingerprint is stable and does not depend on the secret value', () => {
    const a = buildCredentialIdentity({ credentialGroupId: 'typhoon', serviceIdentity: 'typhoon', verifiedHost: 'h', credentialRevision: 'rev-1' });
    const b = buildCredentialIdentity({ credentialGroupId: 'typhoon', serviceIdentity: 'typhoon', verifiedHost: 'h', credentialRevision: 'rev-1' });
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});

describe('Credential request — restricted to exact verified host (AC #2)', () => {
  const verified = 'https://aiforthai.example.com';
  it('accepts a matching, TLS-verified, no-redirect request', () => {
    expect(validateCredentialRequest({ credentialGroupId: 'aiforthai', serviceIdentity: 'aiforthai:t-ocr', requestedHost: verified, tlsVerified: true, redirectAccepted: false }, verified).ok).toBe(true);
  });
  it('rejects a cross-origin redirect', () => {
    expect(validateCredentialRequest({ credentialGroupId: 'aiforthai', serviceIdentity: 'aiforthai:t-ocr', requestedHost: verified, tlsVerified: true, redirectAccepted: true }, verified).cause).toBe('cross-origin-redirect');
  });
  it('rejects a TLS bypass/downgrade', () => {
    expect(validateCredentialRequest({ credentialGroupId: 'aiforthai', serviceIdentity: 'aiforthai:t-ocr', requestedHost: verified, tlsVerified: false, redirectAccepted: false }, verified).cause).toBe('tls-bypass');
  });
  it('rejects a host mismatch', () => {
    expect(validateCredentialRequest({ credentialGroupId: 'aiforthai', serviceIdentity: 'aiforthai:t-ocr', requestedHost: 'https://evil.example.com', tlsVerified: true, redirectAccepted: false }, verified).cause).toBe('host-mismatch');
  });
});

describe('Credential boundary — Typhoon↔AI-for-Thai routing denied (AC #3)', () => {
  it('denies a Typhoon credential routed toward an AI-for-Thai host with a sanitized explanation and no contact', () => {
    const r = checkCredentialBoundary({ credentialGroupId: 'typhoon', targetGroupId: 'aiforthai' });
    expect(r.ok).toBe(false);
    expect(r.cause).toBe('group-mismatch');
    expect(r.safeExplanation.toLowerCase()).toContain('credential-boundary violation');
  });
  it('denies an AI-for-Thai credential routed toward SCBx', () => {
    expect(checkCredentialBoundary({ credentialGroupId: 'aiforthai', targetGroupId: 'scbx' }).ok).toBe(false);
  });
  it('accepts same-group routing', () => {
    expect(checkCredentialBoundary({ credentialGroupId: 'typhoon', targetGroupId: 'typhoon' }).ok).toBe(true);
  });
});

describe('Credential authority staleness (AC #4)', () => {
  it('a changed credential revision makes prior approval/consent stale', () => {
    expect(isCredentialAuthorityStale({ approvedCredentialRevision: 'rev-1', currentCredentialRevision: 'rev-2' })).toBe(true);
  });
  it('a changed health/configuration generation makes prior authority stale', () => {
    expect(isCredentialAuthorityStale({ approvedCredentialRevision: 'rev-1', currentCredentialRevision: 'rev-1', approvedHealthGeneration: 'g-1', currentHealthGeneration: 'g-2' })).toBe(true);
  });
  it('unchanged revision + generation is not stale', () => {
    expect(isCredentialAuthorityStale({ approvedCredentialRevision: 'rev-1', currentCredentialRevision: 'rev-1', approvedHealthGeneration: 'g-1', currentHealthGeneration: 'g-1' })).toBe(false);
  });
});

describe('Connection info projection — secret-free across all surfaces (AC #5)', () => {
  it('projects only identity/host/revision/fingerprint + model pin', () => {
    const id = buildCredentialIdentity({ credentialGroupId: 'typhoon', serviceIdentity: 'typhoon', verifiedHost: 'h', credentialRevision: 'rev-1' });
    const p = projectConnectionInfo(id, null);
    expect(p.credentialGroupId).toBe('typhoon');
    expect(p.verifiedHost).toBe('h');
    expect(p.credentialRevision).toBe('rev-1');
    expect(p.modelPin).toBe(TYPHOON_VERSION_UNVERIFIED);
  });
  it('scrubs Authorization headers, Bearer tokens, api keys, and credential-in-URL without exposing the secret', () => {
    const s = scrubConnectionSecrets('Authorization: Bearer abc123def456ghi789 sk-aaaaaaaaaaaaaaaa ?api_key=SECRETVALUE');
    expect(s.value).not.toContain('SECRETVALUE');
    expect(s.value).not.toContain('Bearer abc');
    expect(s.redacted.length).toBeGreaterThan(0);
  });
});

describe('Typhoon model/contract pin — non-affirmative when unresolved (AC #6)', () => {
  it('uses Typhoon version: unverified and does not claim release governance is complete', () => {
    expect(TYPHOON_VERSION_UNVERIFIED).toMatch(/unverified/i);
    const id = buildCredentialIdentity({ credentialGroupId: 'typhoon', serviceIdentity: 'typhoon', verifiedHost: 'h', credentialRevision: 'rev-1' });
    expect(projectConnectionInfo(id, null).modelPin).toBe(TYPHOON_VERSION_UNVERIFIED);
  });
});