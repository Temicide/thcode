// Story 4.8: Specialist transfer consent — unit tests.
// Tests every I/O matrix row + AC from the spec. Builds PreparedArtifact,
// CapabilityRegistryEntry, and SpecialistEffectiveConfiguration fixtures
// directly (no fs/network). Uses a fixed clock.

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  buildPreparedPayloadManifest,
  computeManifestDigest,
  type PreparedPayloadManifest,
  type TransferConsent,
} from '../src/core/permissions/transferConsent.js';
import {
  resolveRetentionHandling,
  computePayloadByteDigest,
  buildSpecialistPreparedPayloadManifest,
  requestSpecialistTransferConsent,
  revalidateSpecialistTransferConsent,
  toConsentReference,
  buildConsentDialogSummary,
  type SpecialistManifestInput,
  type SpecialistConsentInput,
  type SpecialistRevalidationInput,
  type ConsentReference,
  type ConsentEvaluationResult,
} from '../src/core/specialists/consent/index.js';
import type { PreparedArtifact, PrivacyClassification, ContentKind } from '../src/core/specialists/artifacts/types.js';
import type { CapabilityRegistryEntry } from '../src/core/specialists/registry/types.js';
import type { SpecialistEffectiveConfiguration } from '../src/core/specialists/health/types.js';

// ---------------------------------------------------------------------------
// Fixed clock
// ---------------------------------------------------------------------------

const FIXED_ISO = '2026-07-17T00:00:00.000Z';
const clock = () => FIXED_ISO;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeArtifact(overrides: Partial<PreparedArtifact> & {
  contentKind: ContentKind;
  privacyClassification: PrivacyClassification;
  text?: string;
  bytes?: Uint8Array;
}): PreparedArtifact {
  const contentHash = overrides.contentHash ?? createHash('sha256').update(overrides.text ?? '').digest('hex');
  return {
    reference: { raw: '@path/to/file', canonical: '/ws/file' },
    sourceIdentity: {
      canonicalPath: overrides.sourceIdentity?.canonicalPath ?? '/ws/file',
      displayPath: '/ws/file',
      type: 'file',
      sizeBytes: overrides.sizeBytes ?? 100,
      expectedDigest: null,
      version: null,
      identityProven: true,
    },
    mediaType: overrides.mediaType ?? 'text/plain',
    sizeBytes: overrides.sizeBytes ?? 100,
    contentHash,
    contentKind: overrides.contentKind,
    text: overrides.contentKind === 'text' ? (overrides.text ?? 'hello world') : undefined,
    bytes: overrides.contentKind === 'bytes' ? (overrides.bytes ?? Buffer.from('binary-data')) : undefined,
    transformations: overrides.transformations ?? [],
    privacyClassification: overrides.privacyClassification,
    compatibility: { status: 'compatible' },
    createdAt: FIXED_ISO,
  };
}

function makeTextArtifact(
  text: string,
  privacy: PrivacyClassification = 'public',
  overrides: Partial<PreparedArtifact> = {},
): PreparedArtifact {
  return makeArtifact({
    contentKind: 'text',
    privacyClassification: privacy,
    text,
    ...overrides,
  });
}

function makeBinaryArtifact(
  bytes: Uint8Array,
  privacy: PrivacyClassification = 'public',
  overrides: Partial<PreparedArtifact> = {},
): PreparedArtifact {
  return makeArtifact({
    contentKind: 'bytes',
    privacyClassification: privacy,
    bytes,
    ...overrides,
  });
}

function makeRegistryEntry(overrides: Partial<CapabilityRegistryEntry> = {}): CapabilityRegistryEntry {
  return {
    id: 't-ocr',
    upstreamId: 'upstream-ocr',
    nameThai: 'บริการ OCR',
    nameEnglish: 'OCR Service',
    searchTerms: ['ocr', 'text'],
    capabilities: ['ocr'],
    supportedInputs: ['image/png', 'image/jpeg'],
    inputLimits: { maxFileSize: '10MB' },
    entitlement: 'standard',
    evidenceLevel: 'high',
    observationDate: FIXED_ISO,
    endpoint: 'https://aiforthai.example.com/ocr',
    transportRules: {
      allowedProtocols: ['https'],
      requiresTls: true,
      allowedMethods: ['POST'],
    },
    privacyClassification: {
      category: 'public',
      dataClasses: [],
      requiresConsent: false,
      ...(overrides.privacyClassification ?? {}),
    },
    retentionClassification: {
      policy: 'no-retention',
      providerDeletionSupported: true,
      defaultRetentionDays: null,
      ...(overrides.retentionClassification ?? {}),
    },
    confirmationPolicy: {
      requiresExplicitConsent: true,
      scope: 'per-transfer',
    },
    manifestVersion: 1,
    contractVersion: '1.0.0',
    adapterVersion: '1.0.0',
    latestContractTestResult: {
      passed: true,
      testedAt: FIXED_ISO,
      summary: 'All tests passed',
    },
    invokable: true,
    invokableStateReason: null,
    ...overrides,
  };
}

function makeEffectiveConfig(overrides: Partial<SpecialistEffectiveConfiguration> = {}): SpecialistEffectiveConfiguration {
  return {
    id: 'specialist-gen-abc123',
    serviceId: 't-ocr',
    endpoint: 'https://aiforthai.example.com/ocr',
    origin: 'upstream-ocr',
    serviceMapping: 't-ocr->upstream-ocr',
    credentialReferenceId: 'cred-ref-1',
    credentialRevision: 'rev-1',
    credentialFingerprint: 'fp-abc',
    manifestVersion: 1,
    contractVersion: '1.0.0',
    adapterVersion: '1.0.0',
    transportPolicy: {
      allowedProtocols: ['https'],
      requiresTls: true,
      allowedMethods: ['POST'],
    },
    requestConfig: {
      timeoutMs: 10000,
      maxRetries: 0,
    },
    createdAt: FIXED_ISO,
    ...overrides,
  };
}

function makeManifestInput(overrides: Partial<SpecialistManifestInput> = {}): SpecialistManifestInput {
  const artifacts = overrides.preparedArtifacts ?? [makeTextArtifact('hello world')];
  const entry = overrides.registryEntry ?? makeRegistryEntry();
  const config = overrides.effectiveConfiguration ?? makeEffectiveConfig();
  return {
    proposal: { serviceId: 't-ocr', name: 'OCR Service', rationale: 'Extract text from image' },
    preparedArtifacts: artifacts,
    effectiveConfiguration: config,
    registryEntry: entry,
    operationId: 'op-1',
    promptRoundId: 'round-1',
    callCount: 1,
    expiresAt: '2026-07-17T23:59:59.000Z',
    ...overrides,
  };
}

function makeConsentInput(overrides: Partial<SpecialistConsentInput> & {
  manifest: PreparedPayloadManifest;
  currentPayloadByteDigest?: string;
  sanitizerResult?: { ok: true; value: string; omissions: string[] } | { ok: false; cause: string; omissions: string[] };
}): SpecialistConsentInput {
  return {
    manifest: overrides.manifest,
    activationId: 'act-1',
    activationRevision: 1,
    authorityRevision: 1,
    policyVersion: 1,
    clock,
    currentPayloadByteDigest: overrides.currentPayloadByteDigest ?? overrides.manifest.payloadByteDigest,
    now: FIXED_ISO,
    sanitizerResult: overrides.sanitizerResult ?? { ok: true, value: '', omissions: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveRetentionHandling', () => {
  it('returns upstream-no-retention-verified for "no-retention" policy with providerDeletionSupported', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'no-retention', providerDeletionSupported: true, defaultRetentionDays: null },
    });
    expect(resolveRetentionHandling(entry)).toBe('upstream-no-retention-verified');
  });

  it('returns upstream-no-retention-verified for "none" policy', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'none', providerDeletionSupported: true, defaultRetentionDays: null },
    });
    expect(resolveRetentionHandling(entry)).toBe('upstream-no-retention-verified');
  });

  it('returns upstream-no-retention-verified for "zero-retention" policy', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'zero-retention', providerDeletionSupported: true, defaultRetentionDays: null },
    });
    expect(resolveRetentionHandling(entry)).toBe('upstream-no-retention-verified');
  });

  it('returns upstream-no-retention-verified for "retention:none" policy', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'retention:none', providerDeletionSupported: true, defaultRetentionDays: null },
    });
    expect(resolveRetentionHandling(entry)).toBe('upstream-no-retention-verified');
  });

  it('returns upstream-no-retention-verified for "no-retention" policy regardless of providerDeletionSupported (matches real specialists-manifest.json)', () => {
    // The real manifest declares policy "no-retention" + providerDeletionSupported
    // false for all five launch services: with no retention there is nothing to
    // delete, so the deletion flag is irrelevant to the no-retention verdict.
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'no-retention', providerDeletionSupported: false, defaultRetentionDays: null },
    });
    expect(resolveRetentionHandling(entry)).toBe('upstream-no-retention-verified');
  });

  it('returns deletion-confirmed for "deletion-confirmed" policy when provider supports deletion', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'deletion-confirmed', providerDeletionSupported: true, defaultRetentionDays: 30 },
    });
    expect(resolveRetentionHandling(entry)).toBe('deletion-confirmed');
  });

  it('returns unknown for "deletion-confirmed" policy when providerDeletionSupported is false (inconsistent contract)', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'deletion-confirmed', providerDeletionSupported: false, defaultRetentionDays: 30 },
    });
    expect(resolveRetentionHandling(entry)).toBe('unknown');
  });

  it('returns deletion-not-required for "deletion-not-required" policy', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'deletion-not-required', providerDeletionSupported: false, defaultRetentionDays: null },
    });
    expect(resolveRetentionHandling(entry)).toBe('deletion-not-required');
  });

  it('returns deletion-not-required for "not-required" policy', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'not-required', providerDeletionSupported: false, defaultRetentionDays: null },
    });
    expect(resolveRetentionHandling(entry)).toBe('deletion-not-required');
  });

  it('returns unknown for unrecognized policy', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'some-other-policy', providerDeletionSupported: false, defaultRetentionDays: 90 },
    });
    expect(resolveRetentionHandling(entry)).toBe('unknown');
  });

  it('returns unknown for empty policy', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: '', providerDeletionSupported: false, defaultRetentionDays: null },
    });
    expect(resolveRetentionHandling(entry)).toBe('unknown');
  });
});

describe('computePayloadByteDigest', () => {
  it('produces a valid digest for a single text artifact', () => {
    const artifact = makeTextArtifact('hello world');
    const digest = computePayloadByteDigest([artifact]);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a valid digest for a single binary artifact', () => {
    const artifact = makeBinaryArtifact(Buffer.from('binary-data'));
    const digest = computePayloadByteDigest([artifact]);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a valid digest for empty payload (zero artifacts)', () => {
    const digest = computePayloadByteDigest([]);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    // Empty payload should still produce a deterministic digest.
    const digest2 = computePayloadByteDigest([]);
    expect(digest).toBe(digest2);
  });

  it('produces different digests for different orderings (A,B vs B,A)', () => {
    const a = makeTextArtifact('first', 'public', { mediaType: 'text/plain', sourceIdentity: { canonicalPath: '/ws/a', displayPath: '/ws/a', type: 'file', sizeBytes: 5, expectedDigest: null, version: null, identityProven: true } });
    const b = makeTextArtifact('second', 'public', { mediaType: 'text/plain', sourceIdentity: { canonicalPath: '/ws/b', displayPath: '/ws/b', type: 'file', sizeBytes: 6, expectedDigest: null, version: null, identityProven: true } });
    const ab = computePayloadByteDigest([a, b]);
    const ba = computePayloadByteDigest([b, a]);
    expect(ab).not.toBe(ba);
  });

  it('produces the same digest for the same order', () => {
    const a = makeTextArtifact('hello');
    const b = makeTextArtifact('world');
    const first = computePayloadByteDigest([a, b]);
    const second = computePayloadByteDigest([a, b]);
    expect(first).toBe(second);
  });
});

describe('buildSpecialistPreparedPayloadManifest', () => {
  it('builds a manifest with both digests for a valid proposal + artifacts + verified no-retention', () => {
    const input = makeManifestInput();
    const manifest = buildSpecialistPreparedPayloadManifest(input);

    // Both digests present and valid.
    expect(manifest.manifestDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.payloadByteDigest).toMatch(/^[0-9a-f]{64}$/);

    // Manifest digest matches recomputation.
    const recomputed = computeManifestDigest({
      manifestVersion: manifest.manifestVersion,
      sources: manifest.sources,
      classification: manifest.classification,
      purpose: manifest.purpose,
      transformation: manifest.transformation,
      recipient: manifest.recipient,
      callCount: manifest.callCount,
      retention: manifest.retention,
      operationId: manifest.operationId,
      promptRoundId: manifest.promptRoundId,
      expiresAt: manifest.expiresAt,
      payloadByteDigest: manifest.payloadByteDigest,
    });
    expect(manifest.manifestDigest).toBe(recomputed);

    // Payload byte digest matches recomputation.
    expect(manifest.payloadByteDigest).toBe(computePayloadByteDigest(input.preparedArtifacts));

    // Fields are populated correctly.
    expect(manifest.sources[0].identity).toBe('/ws/file');
    expect(manifest.sources[0].sourceHash).toBe(input.preparedArtifacts[0].contentHash);
    expect(manifest.classification).toBe('public');
    expect(manifest.purpose).toBe('Extract text from image');
    expect(manifest.recipient.capabilityId).toBe('t-ocr');
    expect(manifest.recipient.verifiedEndpoint).toBe('https://aiforthai.example.com/ocr');
    expect(manifest.recipient.method).toBe('POST');
    expect(manifest.retention).toBe('upstream-no-retention-verified');
    expect(manifest.callCount).toBe(1);
    expect(manifest.operationId).toBe('op-1');
    expect(manifest.promptRoundId).toBe('round-1');
    expect(manifest.expiresAt).toBe('2026-07-17T23:59:59.000Z');
  });

  it('maps classification: public artifacts + public entry → public', () => {
    const input = makeManifestInput({
      preparedArtifacts: [makeTextArtifact('hello', 'public')],
      registryEntry: makeRegistryEntry({
        privacyClassification: { category: 'public', dataClasses: [], requiresConsent: false },
      }),
    });
    const manifest = buildSpecialistPreparedPayloadManifest(input);
    expect(manifest.classification).toBe('public');
  });

  it('maps classification: internal artifacts → internal', () => {
    const input = makeManifestInput({
      preparedArtifacts: [makeTextArtifact('internal doc', 'internal')],
    });
    const manifest = buildSpecialistPreparedPayloadManifest(input);
    expect(manifest.classification).toBe('internal');
  });

  it('maps classification: secret artifact → unresolved (blocked)', () => {
    const input = makeManifestInput({
      preparedArtifacts: [makeTextArtifact('secret', 'secret')],
    });
    const manifest = buildSpecialistPreparedPayloadManifest(input);
    expect(manifest.classification).toBe('unresolved');
  });

  it('maps classification: entry requiresConsent → sensitive', () => {
    const input = makeManifestInput({
      registryEntry: makeRegistryEntry({
        privacyClassification: { category: 'personal', dataClasses: ['email'], requiresConsent: true },
      }),
    });
    const manifest = buildSpecialistPreparedPayloadManifest(input);
    expect(manifest.classification).toBe('sensitive');
  });

  it('maps classification: dataClasses include sensitive → sensitive', () => {
    const input = makeManifestInput({
      registryEntry: makeRegistryEntry({
        privacyClassification: { category: 'general', dataClasses: ['sensitive-data'], requiresConsent: false },
      }),
    });
    const manifest = buildSpecialistPreparedPayloadManifest(input);
    expect(manifest.classification).toBe('sensitive');
  });

  it('maps retention: unknown retention from entry → unknown in manifest', () => {
    const input = makeManifestInput({
      registryEntry: makeRegistryEntry({
        retentionClassification: { policy: 'unspecified', providerDeletionSupported: false, defaultRetentionDays: null },
      }),
    });
    const manifest = buildSpecialistPreparedPayloadManifest(input);
    expect(manifest.retention).toBe('unknown');
  });

  it('maps transformation: deduped artifact transformations', () => {
    const a = makeTextArtifact('hello', 'public', { transformations: ['utf8-decode', 'trim'] });
    const b = makeTextArtifact('world', 'public', { transformations: ['trim', 'normalize'] });
    const input = makeManifestInput({ preparedArtifacts: [a, b] });
    const manifest = buildSpecialistPreparedPayloadManifest(input);
    expect(manifest.transformation.redactSecrets).toBe(true);
    expect(manifest.transformation.extractTextOnly).toBe(true);
    expect(manifest.transformation.stripActiveContent).toBe(true);
    // Should contain all unique transformations.
    expect(manifest.transformation.reason).toContain('utf8-decode');
    expect(manifest.transformation.reason).toContain('trim');
    expect(manifest.transformation.reason).toContain('normalize');
  });

  it('maps transformation: reason is "none" when no transformations', () => {
    const input = makeManifestInput({
      preparedArtifacts: [makeTextArtifact('hello', 'public', { transformations: [] })],
    });
    const manifest = buildSpecialistPreparedPayloadManifest(input);
    expect(manifest.transformation.reason).toBe('none');
  });

  it('uses first allowed method from transport rules', () => {
    const input = makeManifestInput({
      registryEntry: makeRegistryEntry({
        transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['PUT', 'POST'] },
      }),
    });
    const manifest = buildSpecialistPreparedPayloadManifest(input);
    expect(manifest.recipient.method).toBe('PUT');
  });

  it('defaults method to POST when no allowed methods', () => {
    const input = makeManifestInput({
      registryEntry: makeRegistryEntry({
        transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: [] },
      }),
    });
    const manifest = buildSpecialistPreparedPayloadManifest(input);
    expect(manifest.recipient.method).toBe('POST');
  });
});

describe('requestSpecialistTransferConsent', () => {
  it('grants consent for a fully-resolved manifest with valid payload digest', () => {
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    const payloadDigest = computePayloadByteDigest(artifacts);

    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: payloadDigest,
      sanitizerResult: { ok: true, value: 'hello world', omissions: [] },
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.consent.consentId).toMatch(/^consent-/);
      expect(result.consent.granted).toBe(true);
      expect(result.consent.manifestDigest).toBe(manifest.manifestDigest);
      expect(result.consent.payloadByteDigest).toBe(payloadDigest);
    }
  });

  it('blocks unresolved classification', () => {
    const artifacts = [makeTextArtifact('secret', 'secret')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    expect(manifest.classification).toBe('unresolved');

    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cause).toBe('classification-unresolved');
  });

  it('blocks unknown retention', () => {
    const entry = makeRegistryEntry({
      retentionClassification: { policy: 'unspecified', providerDeletionSupported: false, defaultRetentionDays: null },
    });
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ registryEntry: entry }));
    expect(manifest.retention).toBe('unknown');

    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cause).toBe('retention-unknown');
  });

  it('blocks payload-byte-digest-mismatch', () => {
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));

    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: 'different-digest',
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cause).toBe('payload-byte-digest-mismatch');
  });

  it('blocks manifest-digest-mismatch (mutated manifest field)', () => {
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    // Mutate a field after building (the manifestDigest won't match anymore).
    const mutated = { ...manifest, purpose: 'CHANGED' };

    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest: mutated,
      currentPayloadByteDigest: manifest.payloadByteDigest,
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cause).toBe('manifest-digest-mismatch');
  });

  it('blocks expired consent window', () => {
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({
      preparedArtifacts: artifacts,
      expiresAt: '2026-07-16T23:59:59.000Z', // yesterday
    }));

    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
      now: FIXED_ISO, // now is after expiresAt
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cause).toBe('expired');
  });

  it('blocks unsafe-payload (text containing secret pattern)', () => {
    const artifacts = [makeTextArtifact('sk-abc123def456ghijklmnop')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));

    // Simulate sanitizer detecting the secret.
    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
      sanitizerResult: { ok: false, cause: 'credential patterns redacted', omissions: ['credential patterns redacted'] },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cause).toBe('unsafe-payload');
  });

  it('consent is independent of Full Access (AD-17) — no fullAccess flag exists', () => {
    // The function does not accept a fullAccess flag, demonstrating structural
    // independence. Consent is evaluated purely on manifest validity.
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    const payloadDigest = computePayloadByteDigest(artifacts);

    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: payloadDigest,
      sanitizerResult: { ok: true, value: 'hello world', omissions: [] },
    }));
    // AD-17: Full Access, local approval, cache reuse, and prior consent NEVER
    // substitute for a fresh exact consent decision. The function has no
    // fullAccess parameter — it evaluates purely on manifest validity.
    expect(result.ok).toBe(true);
  });

  it('empty-payload digest: zero artifacts → valid digest, consent ok if other gates pass', () => {
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: [] }));
    const payloadDigest = computePayloadByteDigest([]);
    expect(manifest.payloadByteDigest).toBe(payloadDigest);
    expect(payloadDigest).toMatch(/^[0-9a-f]{64}$/);

    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: payloadDigest,
    }));
    expect(result.ok).toBe(true);
  });
});

describe('revalidateSpecialistTransferConsent', () => {
  function grantedConsent(manifest: PreparedPayloadManifest, overrides: Partial<TransferConsent> = {}): TransferConsent {
    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
      sanitizerResult: { ok: true, value: '', omissions: [] },
    }));
    if (!result.ok) throw new Error('Failed to grant consent for test setup');
    return { ...result.consent, ...overrides };
  }

  it('passes when unchanged (same manifest, payload, activation)', () => {
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    const consent = grantedConsent(manifest);

    const current: SpecialistRevalidationInput = {
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
      activationId: 'act-1',
      activationRevision: 1,
      authorityRevision: 1,
      now: FIXED_ISO,
    };
    const result = revalidateSpecialistTransferConsent(consent, current);
    expect(result.ok).toBe(true);
  });

  it('fails on payload change (different currentPayloadByteDigest)', () => {
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    const consent = grantedConsent(manifest);

    const current: SpecialistRevalidationInput = {
      manifest,
      currentPayloadByteDigest: 'changed-digest',
      activationId: 'act-1',
      activationRevision: 1,
      authorityRevision: 1,
      now: FIXED_ISO,
    };
    const result = revalidateSpecialistTransferConsent(consent, current);
    expect(result.ok).toBe(false);
    // Note: revalidateTransferConsent maps all non-ok evaluate results to
    // 'manifest-digest-mismatch' (by design in the existing generic contract).
    if (!result.ok) expect(result.cause).toBe('manifest-digest-mismatch');
  });

  it('fails on manifest change (mutated field)', () => {
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    const consent = grantedConsent(manifest);

    const mutated = { ...manifest, purpose: 'CHANGED' };
    const current: SpecialistRevalidationInput = {
      manifest: mutated,
      currentPayloadByteDigest: manifest.payloadByteDigest,
      activationId: 'act-1',
      activationRevision: 1,
      authorityRevision: 1,
      now: FIXED_ISO,
    };
    const result = revalidateSpecialistTransferConsent(consent, current);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cause).toBe('manifest-digest-mismatch');
  });

  it('fails on activation change (different activationId)', () => {
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    const consent = grantedConsent(manifest);

    const current: SpecialistRevalidationInput = {
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
      activationId: 'act-CHANGED',
      activationRevision: 1,
      authorityRevision: 1,
      now: FIXED_ISO,
    };
    const result = revalidateSpecialistTransferConsent(consent, current);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.cause).toBe('activation-changed');
  });
});

describe('toConsentReference', () => {
  it('produces a secret-free reference with consentId + digests + recipient + timestamps', () => {
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
      sanitizerResult: { ok: true, value: 'hello world', omissions: [] },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ref = toConsentReference(result.consent);

    // Has all required fields.
    expect(ref.consentId).toBe(result.consent.consentId);
    expect(ref.manifestDigest).toBe(manifest.manifestDigest);
    expect(ref.payloadByteDigest).toBe(manifest.payloadByteDigest);
    expect(ref.recipientCapabilityId).toBe('t-ocr');
    expect(ref.recipientCapabilityVersion).toBe('1.0.0');
    expect(ref.verifiedEndpoint).toBe('https://aiforthai.example.com/ocr');
    expect(ref.purpose).toBe('Extract text from image');
    expect(ref.grantedAt).toBe(FIXED_ISO);
    expect(ref.expiresAt).toBe('2026-07-17T23:59:59.000Z');

    // Secret-free: JSON.stringify should NOT contain raw content.
    const json = JSON.stringify(ref);
    expect(json).not.toContain('hello world');
    expect(json).not.toContain('sk-');
    expect(json).not.toContain('secret');
    expect(json).not.toContain('credential');
  });
});

describe('buildConsentDialogSummary', () => {
  it('produces a secret-free dialog summary with initialFocus consent-review', () => {
    const artifacts = [makeTextArtifact('hello world')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
      sanitizerResult: { ok: true, value: 'hello world', omissions: [] },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ref = toConsentReference(result.consent);
    const summary = buildConsentDialogSummary(manifest, artifacts, ref);

    // Initial focus is consent-review (never Consent/auto-grant).
    expect(summary.initialFocus).toBe('consent-review');

    // Recipient info.
    expect(summary.recipient.capabilityId).toBe('t-ocr');
    expect(summary.recipient.verifiedEndpoint).toBe('https://aiforthai.example.com/ocr');
    expect(summary.recipient.method).toBe('POST');

    // Purpose.
    expect(summary.purpose).toBe('Extract text from image');

    // Safe payload summary — no raw content.
    expect(summary.safePayloadSummary.sourceCount).toBe(1);
    expect(summary.safePayloadSummary.totalSizeBytes).toBe(100);
    expect(summary.safePayloadSummary.sourceIdentities[0].identity).toBe('/ws/file');
    expect(summary.safePayloadSummary.sourceIdentities[0].sourceHash).toBe(artifacts[0].contentHash);
    expect(summary.safePayloadSummary.classification).toBe('public');
    expect(summary.safePayloadSummary.retentionStatus).toBe('upstream-no-retention-verified');
    expect(summary.safePayloadSummary.payloadDigest).toBe(manifest.payloadByteDigest);
    expect(summary.safePayloadSummary.manifestDigest).toBe(manifest.manifestDigest);

    // Digests.
    expect(summary.manifestDigest).toBe(manifest.manifestDigest);
    expect(summary.payloadDigest).toBe(manifest.payloadByteDigest);

    // Consent reference.
    expect(summary.consentReference.consentId).toBe(ref.consentId);

    // Side effects default to empty.
    expect(summary.sideEffects).toEqual([]);

    // Secret-free: JSON should not contain raw content.
    const json = JSON.stringify(summary);
    expect(json).not.toContain('hello world');
    expect(json).not.toContain('sk-');
    expect(json).not.toContain('credential');
  });

  it('includes side effects when provided', () => {
    const artifacts = [makeTextArtifact('hello')];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
      sanitizerResult: { ok: true, value: 'hello', omissions: [] },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ref = toConsentReference(result.consent);
    const summary = buildConsentDialogSummary(manifest, artifacts, ref, ['Data will be processed on external servers', 'Results cached for 24 hours']);
    expect(summary.sideEffects).toHaveLength(2);
    expect(summary.sideEffects[0]).toBe('Data will be processed on external servers');
  });

  it('never includes raw bytes or text in the summary', () => {
    const secretText = 'this-is-a-secret-sk-abc123';
    const artifacts = [makeTextArtifact(secretText)];
    const manifest = buildSpecialistPreparedPayloadManifest(makeManifestInput({ preparedArtifacts: artifacts }));
    const result = requestSpecialistTransferConsent(makeConsentInput({
      manifest,
      currentPayloadByteDigest: manifest.payloadByteDigest,
      sanitizerResult: { ok: true, value: secretText, omissions: [] },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ref = toConsentReference(result.consent);
    const summary = buildConsentDialogSummary(manifest, artifacts, ref);

    const json = JSON.stringify(summary);
    // The secret text should NOT appear in the summary.
    expect(json).not.toContain(secretText);
    expect(json).not.toContain('sk-abc123');
  });
});
