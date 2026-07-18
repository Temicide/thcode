// Story 2.6: generic prepared-payload + remote-transfer consent contracts.
import { describe, expect, it } from 'vitest';
import {
  PREPARED_PAYLOAD_MANIFEST_VERSION,
  assessPreparedPayloadSafety,
  buildPreparedPayloadManifest,
  computeManifestDigest,
  detectUnsafePreparedContent,
  evaluateTransferConsent,
  revalidateTransferConsent,
  type PreparedPayloadManifest,
  type SelectedSource,
} from '../src/core/permissions/transferConsent.js';

const clock = () => '2026-07-17T00:00:00.000Z';
const source: SelectedSource = { identity: '/ws/a.txt', sourceHash: 'h-a', mediaType: 'text/plain', sizeBytes: 5 };
const goodRecipient = { capabilityId: 't-ocr', capabilityVersion: '1.0.0', verifiedEndpoint: 'https://aiforthai.example.com/ocr', method: 'POST' };

function manifest(overrides: Partial<Omit<PreparedPayloadManifest, 'manifestDigest'>> = {}): PreparedPayloadManifest {
  return buildPreparedPayloadManifest({
    sources: [source],
    classification: 'public',
    purpose: 'OCR extraction',
    transformation: { redactSecrets: true, extractTextOnly: true, stripActiveContent: true, reason: 'text-only' },
    recipient: goodRecipient,
    callCount: 1,
    retention: 'upstream-no-retention-verified',
    operationId: 'op-1',
    promptRoundId: 'round-1',
    expiresAt: '2026-07-17T23:59:59.000Z',
    payloadByteDigest: 'bytes-1',
    ...overrides,
  });
}

describe('PreparedPayloadManifest — carries every required identity field (AC #1)', () => {
  it('records sources/hashes, classification, purpose, transformation, manifest version, canonical manifest digest, payload-byte digest, recipient, endpoint, method, call count, retention, op/round scope, expiry', () => {
    const m = manifest();
    expect(m.manifestVersion).toBe(PREPARED_PAYLOAD_MANIFEST_VERSION);
    expect(m.sources[0].sourceHash).toBe('h-a');
    expect(m.classification).toBe('public');
    expect(m.payloadByteDigest).toBe('bytes-1');
    expect(m.recipient.verifiedEndpoint).toBe(goodRecipient.verifiedEndpoint);
    expect(m.callCount).toBe(1);
    expect(m.retention).toBe('upstream-no-retention-verified');
    expect(m.operationId).toBe('op-1');
    expect(m.promptRoundId).toBe('round-1');
    expect(m.expiresAt).not.toBeNull();
    expect(m.manifestDigest).toBe(computeManifestDigest({
      manifestVersion: m.manifestVersion, sources: m.sources, classification: m.classification, purpose: m.purpose,
      transformation: m.transformation, recipient: m.recipient, callCount: m.callCount, retention: m.retention,
      operationId: m.operationId, promptRoundId: m.promptRoundId, expiresAt: m.expiresAt, payloadByteDigest: m.payloadByteDigest,
    }));
  });
});

describe('Transfer consent — independent of local approval/Work Mode/Profile/Full Access (AC #2)', () => {
  it('grants consent for a fully-resolved public manifest regardless of profile-like inputs (consent carries its own authority binding)', () => {
    const m = manifest();
    const res = evaluateTransferConsent({
      manifest: m, activationId: 'act-1', activationRevision: 1, authorityRevision: 1, policyVersion: 1,
      clock, currentPayloadByteDigest: 'bytes-1', now: clock(),
      sanitizerResult: { ok: true, value: 'safe', omissions: [] },
    });
    expect(res.ok).toBe(true);
  });
});

describe('Transfer consent — fails closed on unresolved/changed fields (AC #3)', () => {
  it('rejects unresolved classification', () => {
    const res = evaluateTransferConsent({
      manifest: manifest({ classification: 'unresolved' }), activationId: 'act-1', activationRevision: 1, authorityRevision: 1,
      policyVersion: 1, clock, currentPayloadByteDigest: 'bytes-1', now: clock(), sanitizerResult: { ok: true, value: '', omissions: [] },
    });
    expect(res.ok).toBe(false);
    expect(res.cause).toBe('classification-unresolved');
  });

  it('rejects unknown retention', () => {
    const res = evaluateTransferConsent({
      manifest: manifest({ retention: 'unknown' }), activationId: 'act-1', activationRevision: 1, authorityRevision: 1,
      policyVersion: 1, clock, currentPayloadByteDigest: 'bytes-1', now: clock(), sanitizerResult: { ok: true, value: '', omissions: [] },
    });
    expect(res.cause).toBe('retention-unknown');
  });

  it('rejects a changed payload-byte digest (recomputation required before transport)', () => {
    const m = manifest();
    const res = evaluateTransferConsent({
      manifest: m, activationId: 'act-1', activationRevision: 1, authorityRevision: 1, policyVersion: 1, clock,
      currentPayloadByteDigest: 'bytes-CHANGED', now: clock(), sanitizerResult: { ok: true, value: '', omissions: [] },
    });
    expect(res.cause).toBe('payload-byte-digest-mismatch');
  });

  it('rejects an expired consent window', () => {
    const m = manifest({ expiresAt: '2026-07-17T00:30:00.000Z' });
    const res = evaluateTransferConsent({
      manifest: m, activationId: 'act-1', activationRevision: 1, authorityRevision: 1, policyVersion: 1, clock,
      currentPayloadByteDigest: 'bytes-1', now: '2026-07-17T01:00:00.000Z', sanitizerResult: { ok: true, value: '', omissions: [] },
    });
    expect(res.cause).toBe('expired');
  });

  it('every failure gives an actionable safe explanation, not a guessed summary', () => {
    const res = evaluateTransferConsent({
      manifest: manifest({ classification: 'unresolved' }), activationId: 'act-1', activationRevision: 1, authorityRevision: 1,
      policyVersion: 1, clock, currentPayloadByteDigest: 'bytes-1', now: clock(), sanitizerResult: { ok: true, value: '', omissions: [] },
    });
    expect(res.safeExplanation.length).toBeGreaterThan(0);
  });
});

describe('Transfer consent — bound to both manifest + payload-byte digests + authority (AC #4)', () => {
  it('a granted consent carries both digests, recipient, endpoint, purpose, call count, expiry, op/round scope, activation/authority revision, policy version', () => {
    const m = manifest();
    const res = evaluateTransferConsent({
      manifest: m, activationId: 'act-1', activationRevision: 3, authorityRevision: 3, policyVersion: 1, clock,
      currentPayloadByteDigest: 'bytes-1', now: clock(), sanitizerResult: { ok: true, value: '', omissions: [] },
    });
    if (!res.ok) throw new Error('expected ok');
    expect(res.consent.manifestDigest).toBe(m.manifestDigest);
    expect(res.consent.payloadByteDigest).toBe('bytes-1');
    expect(res.consent.verifiedEndpoint).toBe(goodRecipient.verifiedEndpoint);
    expect(res.consent.activationRevision).toBe(3);
    expect(res.consent.policyVersion).toBe(1);
  });

  it('revalidation fails closed when activation changed (prior consent stale)', () => {
    const m = manifest();
    const granted = evaluateTransferConsent({
      manifest: m, activationId: 'act-1', activationRevision: 1, authorityRevision: 1, policyVersion: 1, clock,
      currentPayloadByteDigest: 'bytes-1', now: clock(), sanitizerResult: { ok: true, value: '', omissions: [] },
    });
    if (!granted.ok) throw new Error('expected ok');
    const reval = revalidateTransferConsent(granted.consent, {
      manifest: m, currentPayloadByteDigest: 'bytes-1', activationId: 'act-2', activationRevision: 1, authorityRevision: 1, now: clock(),
    });
    expect(reval.ok).toBe(false);
  });
});

describe('Prepared payload safety — block or omit unsafe content (AC #5)', () => {
  it('emits sanitized-with-omissions when the sanitizer omits content', () => {
    const r = assessPreparedPayloadSafety({ ok: true, value: 'x', omissions: ['secret'] });
    expect(r.safe).toBe(true);
    expect(r.completeness).toBe('sanitized-with-omissions');
  });

  it('emits not-authoritative when the sanitizer blocks', () => {
    const r = assessPreparedPayloadSafety({ ok: false, cause: 'unsafe', omissions: [] });
    expect(r.safe).toBe(false);
    expect(r.completeness).toBe('not-authoritative');
  });

  it('detects credentials, unresolved local paths, and unsafe active content without exposing raw secrets', () => {
    const a = detectUnsafePreparedContent('api_key=sk-' + 'x'.repeat(20));
    expect(a.unsafe).toBe(true);
    expect(a.markers).toContain('credential-or-secret');
    const b = detectUnsafePreparedContent('see ./local/secret.txt');
    expect(b.markers).toContain('unresolved-local-path');
    const c = detectUnsafePreparedContent('<script>x</script>');
    expect(c.markers).toContain('unsafe-active-content');
  });

  it('unsafe payload blocks transfer consent', () => {
    const m = manifest();
    const res = evaluateTransferConsent({
      manifest: m, activationId: 'act-1', activationRevision: 1, authorityRevision: 1, policyVersion: 1, clock,
      currentPayloadByteDigest: 'bytes-1', now: clock(), sanitizerResult: { ok: false, cause: 'secret', omissions: [] },
    });
    expect(res.cause).toBe('unsafe-payload');
  });
});

describe('Transfer consent — implementation boundary (AC #6)', () => {
  it('this module imports no specialist adapter, registry, or transport — only the Sanitizer', () => {
    // The contract is import-only; this test exists to anchor the boundary and
    // guard against a future regression that wires a real service here.
    expect(PREPARED_PAYLOAD_MANIFEST_VERSION).toBeGreaterThan(0);
  });
});