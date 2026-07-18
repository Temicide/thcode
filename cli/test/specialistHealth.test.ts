import { describe, expect, it } from 'vitest';
import { HealthRegistry, type EffectiveConfigurationGeneration } from '../src/core/providers/health.js';
import {
  buildSpecialistEffectiveConfiguration,
  projectToHealthGeneration,
  specialistConfigurationDigest,
  SpecialistHealthLifecycle,
  type SpecialistEffectiveConfiguration,
  type SpecialistHealthProbe,
  type SpecialistGenerationResult,
  type SpecialistHealthSnapshot,
} from '../src/core/specialists/health/index.js';
import type { CapabilityRegistryEntry } from '../src/core/specialists/registry/types.js';
import type { AiForThaiCredentialReference } from '../src/core/specialists/credential/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fixedClock = () => '2026-07-17T09:00:00.000Z';

const VALID_ENTRY: CapabilityRegistryEntry = {
  id: 't-ocr',
  upstreamId: 'ocr',
  nameThai: 'ที-โอซีอาร์',
  nameEnglish: 'T-OCR',
  searchTerms: ['ocr', 'thai-ocr'],
  capabilities: ['thai-ocr'],
  supportedInputs: ['image/png'],
  inputLimits: { maxFileSize: '20MB' },
  entitlement: 'AI-for-Thai API key required',
  evidenceLevel: 'deterministic',
  observationDate: '2026-07-17',
  endpoint: 'https://api.aiforthai.in.th/ocr',
  transportRules: {
    allowedProtocols: ['https'],
    requiresTls: true,
    allowedMethods: ['POST'],
  },
  privacyClassification: {
    category: 'standard',
    dataClasses: ['image'],
    requiresConsent: false,
  },
  retentionClassification: {
    policy: 'delete-after-30-days',
    providerDeletionSupported: true,
    defaultRetentionDays: 30,
  },
  confirmationPolicy: {
    requiresExplicitConsent: false,
    scope: 'none',
  },
  manifestVersion: 1,
  contractVersion: '1.0.0',
  adapterVersion: '1.0.0',
  latestContractTestResult: {
    passed: true,
    testedAt: '2026-07-17T08:00:00.000Z',
    summary: 'T-OCR contract test passed',
  },
  invokable: true,
  invokableStateReason: null,
};

const NON_INVOKABLE_ENTRY: CapabilityRegistryEntry = {
  ...VALID_ENTRY,
  id: 'typhoon-translate',
  invokable: false,
  invokableStateReason: 'Catalogued — Not available yet',
};

const CREDENTIAL_REFERENCE: AiForThaiCredentialReference = {
  referenceId: 'aiforthai-ref-1',
  credentialRevision: 'rev-abc123',
  fingerprint: 'fp-aiforthai-abc123',
  storedAt: '2026-07-17T08:00:00.000Z',
};

function passingProbe(): SpecialistHealthProbe {
  return async (_gen) => ({
    ok: true,
    evidence: 'specialist:live-check:passed:v1',
  });
}

function failingProbe(category: 'auth' | 'connectivity' | 'quota' | 'configuration' | 'protocol'): SpecialistHealthProbe {
  return async (gen) => ({
    ok: false,
    failure: {
      category,
      retryable: category === 'connectivity' || category === 'quota',
      scope: gen.serviceId,
      generationId: gen.id,
      safeMessage: `Probe failure: ${category}`,
      causeCode: `test-${category}`,
      ...(category === 'quota' ? { retryAfterMs: 5_000 } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// generation.ts — buildSpecialistEffectiveConfiguration
// ---------------------------------------------------------------------------

describe('buildSpecialistEffectiveConfiguration', () => {
  it('builds a valid configuration for an invokable entry with credential', () => {
    const result = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const config = result.configuration;
    expect(config.serviceId).toBe('t-ocr');
    expect(config.endpoint).toBe('https://api.aiforthai.in.th/ocr');
    expect(config.origin).toBe('ocr');
    expect(config.serviceMapping).toBe('t-ocr->ocr');
    expect(config.credentialReferenceId).toBe('aiforthai-ref-1');
    expect(config.credentialRevision).toBe('rev-abc123');
    expect(config.credentialFingerprint).toBe('fp-aiforthai-abc123');
    expect(config.manifestVersion).toBe(1);
    expect(config.contractVersion).toBe('1.0.0');
    expect(config.adapterVersion).toBe('1.0.0');
    expect(config.transportPolicy.allowedProtocols).toEqual(['https']);
    expect(config.transportPolicy.requiresTls).toBe(true);
    expect(config.transportPolicy.allowedMethods).toEqual(['POST']);
    expect(config.requestConfig.timeoutMs).toBe(10_000);
    expect(config.requestConfig.maxRetries).toBe(0);
    expect(config.createdAt).toBe('2026-07-17T09:00:00.000Z');
    expect(config.id).toMatch(/^specialist-gen-[a-f0-9]+$/);
  });

  it('fails closed for non-invokable entry', () => {
    const result = buildSpecialistEffectiveConfiguration(NON_INVOKABLE_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('not-invokable');
    expect(result.detail).toContain('typhoon-translate');
  });

  it('fails closed for missing credential reference', () => {
    const result = buildSpecialistEffectiveConfiguration(VALID_ENTRY, null, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('missing-credential');
    expect(result.detail).toContain('t-ocr');
  });

  it('fails closed for missing endpoint', () => {
    const entry = { ...VALID_ENTRY, endpoint: '' };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('missing-field');
    expect(result.detail).toContain('endpoint');
  });

  it('fails closed for missing contractVersion', () => {
    const entry = { ...VALID_ENTRY, contractVersion: '' };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('missing-field');
    expect(result.detail).toContain('contractVersion');
  });

  it('fails closed for missing adapterVersion', () => {
    const entry = { ...VALID_ENTRY, adapterVersion: '' };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('missing-field');
    expect(result.detail).toContain('adapterVersion');
  });

  it('fails closed for missing upstreamId', () => {
    const entry = { ...VALID_ENTRY, upstreamId: '' };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('missing-field');
    expect(result.detail).toContain('upstreamId');
  });

  it('fails closed for whitespace-only contractVersion', () => {
    const entry = { ...VALID_ENTRY, contractVersion: '   ' };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('missing-field');
    expect(result.detail).toContain('contractVersion');
  });

  it('fails closed for whitespace-only adapterVersion', () => {
    const entry = { ...VALID_ENTRY, adapterVersion: '   ' };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('missing-field');
    expect(result.detail).toContain('adapterVersion');
  });

  it('fails closed for TLS violation (requiresTls but not https)', () => {
    const entry = {
      ...VALID_ENTRY,
      endpoint: 'http://api.aiforthai.in.th/ocr',
      transportRules: { ...VALID_ENTRY.transportRules, requiresTls: true },
    };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('transport-policy');
    expect(result.detail).toContain('HTTPS');
  });

  it('fails closed for disallowed protocol', () => {
    const entry = {
      ...VALID_ENTRY,
      endpoint: 'http://api.aiforthai.in.th/ocr',
      transportRules: { ...VALID_ENTRY.transportRules, allowedProtocols: ['https'], requiresTls: false },
    };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('transport-policy');
    expect(result.detail).toContain('allowedProtocols');
  });

  it('accepts protocol with case-insensitive matching', () => {
    const entry = {
      ...VALID_ENTRY,
      endpoint: 'https://api.aiforthai.in.th/ocr',
      transportRules: { ...VALID_ENTRY.transportRules, allowedProtocols: ['HTTPS'], requiresTls: true },
    };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.configuration.transportPolicy.allowedProtocols).toEqual(['HTTPS']);
  });

  it('fails closed for empty allowedMethods', () => {
    const entry = {
      ...VALID_ENTRY,
      transportRules: { ...VALID_ENTRY.transportRules, allowedMethods: [] },
    };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('transport-policy');
    expect(result.detail).toContain('allowed methods');
  });

  it('fails closed for invalid URL', () => {
    const entry = {
      ...VALID_ENTRY,
      endpoint: 'not-a-valid-url',
    };
    const result = buildSpecialistEffectiveConfiguration(entry, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('transport-policy');
    expect(result.detail).toContain('valid URL');
  });

  it('is secret-free: raw key never appears in configuration', () => {
    const result = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const json = JSON.stringify(result.configuration);
    // Raw credential patterns that would indicate a secret value leaked.
    expect(json).not.toContain('sk-');
    expect(json).not.toContain('api_key');
    expect(json).not.toContain('"secret"');
    // The credential reference id, revision, and fingerprint are present but
    // the raw secret value is never stored.
    expect(json).toContain('aiforthai-ref-1');
    expect(json).toContain('rev-abc123');
    expect(json).toContain('fp-aiforthai-abc123');
  });

  it('digest changes when any bound field changes (supersede)', () => {
    const result1 = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;
    const id1 = result1.configuration.id;

    // Change endpoint
    const entry2 = { ...VALID_ENTRY, endpoint: 'https://api.aiforthai.in.th/ocr/v2' };
    const result2 = buildSpecialistEffectiveConfiguration(entry2, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;
    expect(result2.configuration.id).not.toBe(id1);

    // Change credential revision
    const cred2 = { ...CREDENTIAL_REFERENCE, credentialRevision: 'rev-def456' };
    const result3 = buildSpecialistEffectiveConfiguration(VALID_ENTRY, cred2, undefined, fixedClock);
    expect(result3.ok).toBe(true);
    if (!result3.ok) return;
    expect(result3.configuration.id).not.toBe(id1);
    expect(result3.configuration.id).not.toBe(result2.configuration.id);

    // Change contract version
    const entry4 = { ...VALID_ENTRY, contractVersion: '2.0.0' };
    const result4 = buildSpecialistEffectiveConfiguration(entry4, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result4.ok).toBe(true);
    if (!result4.ok) return;
    expect(result4.configuration.id).not.toBe(id1);

    // Change adapter version
    const entry5 = { ...VALID_ENTRY, adapterVersion: '2.0.0' };
    const result5 = buildSpecialistEffectiveConfiguration(entry5, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result5.ok).toBe(true);
    if (!result5.ok) return;
    expect(result5.configuration.id).not.toBe(id1);

    // Change manifest version
    const entry6 = { ...VALID_ENTRY, manifestVersion: 2 };
    const result6 = buildSpecialistEffectiveConfiguration(entry6, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result6.ok).toBe(true);
    if (!result6.ok) return;
    expect(result6.configuration.id).not.toBe(id1);

    // Change request config
    const result7 = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, { timeoutMs: 30_000, maxRetries: 2 }, fixedClock);
    expect(result7.ok).toBe(true);
    if (!result7.ok) return;
    expect(result7.configuration.id).not.toBe(id1);
  });
});

// ---------------------------------------------------------------------------
// generation.ts — projectToHealthGeneration
// ---------------------------------------------------------------------------

describe('projectToHealthGeneration', () => {
  it('maps SpecialistEffectiveConfiguration to EffectiveConfigurationGeneration', () => {
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;
    const config = buildResult.configuration;
    const gen = projectToHealthGeneration(config);
    expect(gen.id).toBe(config.id);
    expect(gen.providerId).toBe('t-ocr');
    expect(gen.endpoint).toBe('https://api.aiforthai.in.th/ocr');
    expect(gen.credentialRevision).toBe('rev-abc123');
    expect(gen.adapterVersion).toBe('1.0.0');
    expect(gen.modelId).toBe('1.0.0');
    expect(gen.dependencyIdentity).toBe(config.id);
    expect(gen.createdAt).toBe('2026-07-17T09:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// generation.ts — specialistConfigurationDigest
// ---------------------------------------------------------------------------

describe('specialistConfigurationDigest', () => {
  it('produces a deterministic hex digest', () => {
    const fields = {
      endpoint: 'https://api.aiforthai.in.th/ocr',
      origin: 'ocr',
      serviceMapping: 't-ocr->ocr',
      credentialReferenceId: 'aiforthai-ref-1',
      credentialRevision: 'rev-abc123',
      manifestVersion: 1,
      contractVersion: '1.0.0',
      adapterVersion: '1.0.0',
      transportPolicy: { allowedProtocols: ['https'] as readonly string[], requiresTls: true, allowedMethods: ['POST'] as readonly string[] },
      requestConfig: { timeoutMs: 10_000, maxRetries: 0 },
    };
    const d1 = specialistConfigurationDigest(fields);
    const d2 = specialistConfigurationDigest(fields);
    expect(d1).toBe(d2);
    expect(d1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when any field changes', () => {
    const base = {
      endpoint: 'https://api.aiforthai.in.th/ocr',
      origin: 'ocr',
      serviceMapping: 't-ocr->ocr',
      credentialReferenceId: 'aiforthai-ref-1',
      credentialRevision: 'rev-abc123',
      manifestVersion: 1,
      contractVersion: '1.0.0',
      adapterVersion: '1.0.0',
      transportPolicy: { allowedProtocols: ['https'] as readonly string[], requiresTls: true, allowedMethods: ['POST'] as readonly string[] },
      requestConfig: { timeoutMs: 10_000, maxRetries: 0 },
    };
    const baseDigest = specialistConfigurationDigest(base);
    expect(specialistConfigurationDigest({ ...base, endpoint: 'https://other.com' })).not.toBe(baseDigest);
    expect(specialistConfigurationDigest({ ...base, credentialRevision: 'rev-xyz' })).not.toBe(baseDigest);
    expect(specialistConfigurationDigest({ ...base, contractVersion: '2.0.0' })).not.toBe(baseDigest);
    expect(specialistConfigurationDigest({ ...base, adapterVersion: '2.0.0' })).not.toBe(baseDigest);
    expect(specialistConfigurationDigest({ ...base, manifestVersion: 2 })).not.toBe(baseDigest);
    expect(specialistConfigurationDigest({ ...base, requestConfig: { timeoutMs: 30_000, maxRetries: 2 } })).not.toBe(baseDigest);
  });

  it('changes when origin changes', () => {
    const base = {
      endpoint: 'https://api.aiforthai.in.th/ocr',
      origin: 'ocr',
      serviceMapping: 't-ocr->ocr',
      credentialReferenceId: 'aiforthai-ref-1',
      credentialRevision: 'rev-abc123',
      manifestVersion: 1,
      contractVersion: '1.0.0',
      adapterVersion: '1.0.0',
      transportPolicy: { allowedProtocols: ['https'] as readonly string[], requiresTls: true, allowedMethods: ['POST'] as readonly string[] },
      requestConfig: { timeoutMs: 10_000, maxRetries: 0 },
    };
    const baseDigest = specialistConfigurationDigest(base);
    expect(specialistConfigurationDigest({ ...base, origin: 'ocr-v2' })).not.toBe(baseDigest);
  });

  it('changes when serviceMapping changes', () => {
    const base = {
      endpoint: 'https://api.aiforthai.in.th/ocr',
      origin: 'ocr',
      serviceMapping: 't-ocr->ocr',
      credentialReferenceId: 'aiforthai-ref-1',
      credentialRevision: 'rev-abc123',
      manifestVersion: 1,
      contractVersion: '1.0.0',
      adapterVersion: '1.0.0',
      transportPolicy: { allowedProtocols: ['https'] as readonly string[], requiresTls: true, allowedMethods: ['POST'] as readonly string[] },
      requestConfig: { timeoutMs: 10_000, maxRetries: 0 },
    };
    const baseDigest = specialistConfigurationDigest(base);
    expect(specialistConfigurationDigest({ ...base, serviceMapping: 't-ocr->ocr-v2' })).not.toBe(baseDigest);
  });

  it('changes when credentialReferenceId changes', () => {
    const base = {
      endpoint: 'https://api.aiforthai.in.th/ocr',
      origin: 'ocr',
      serviceMapping: 't-ocr->ocr',
      credentialReferenceId: 'aiforthai-ref-1',
      credentialRevision: 'rev-abc123',
      manifestVersion: 1,
      contractVersion: '1.0.0',
      adapterVersion: '1.0.0',
      transportPolicy: { allowedProtocols: ['https'] as readonly string[], requiresTls: true, allowedMethods: ['POST'] as readonly string[] },
      requestConfig: { timeoutMs: 10_000, maxRetries: 0 },
    };
    const baseDigest = specialistConfigurationDigest(base);
    expect(specialistConfigurationDigest({ ...base, credentialReferenceId: 'aiforthai-ref-2' })).not.toBe(baseDigest);
  });

  it('changes when transportPolicy changes', () => {
    const base = {
      endpoint: 'https://api.aiforthai.in.th/ocr',
      origin: 'ocr',
      serviceMapping: 't-ocr->ocr',
      credentialReferenceId: 'aiforthai-ref-1',
      credentialRevision: 'rev-abc123',
      manifestVersion: 1,
      contractVersion: '1.0.0',
      adapterVersion: '1.0.0',
      transportPolicy: { allowedProtocols: ['https'] as readonly string[], requiresTls: true, allowedMethods: ['POST'] as readonly string[] },
      requestConfig: { timeoutMs: 10_000, maxRetries: 0 },
    };
    const baseDigest = specialistConfigurationDigest(base);
    expect(specialistConfigurationDigest({ ...base, transportPolicy: { allowedProtocols: ['https', 'http'] as readonly string[], requiresTls: false, allowedMethods: ['POST'] as readonly string[] } })).not.toBe(baseDigest);
  });
});

// ---------------------------------------------------------------------------
// lifecycle.ts — SpecialistHealthLifecycle
// ---------------------------------------------------------------------------

describe('SpecialistHealthLifecycle', () => {
  it('transitions configured → checking → available after a passing probe', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    expect(lifecycle.snapshot('t-ocr').state).toBe('configured');

    lifecycle.registerProbe('t-ocr', passingProbe());
    const snap = await lifecycle.check('t-ocr');
    expect(snap.state).toBe('available');
    expect(snap.evidence).toBe('specialist:live-check:passed:v1');
    expect(snap.checkedAt).toBe('2026-07-17T09:00:00.000Z');
    expect(lifecycle.isAvailable('t-ocr')).toBe(true);
  });

  it('transitions to unhealthy for auth failure (fatal)', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', failingProbe('auth'));
    const snap = await lifecycle.check('t-ocr');
    expect(snap.state).toBe('unhealthy');
    expect(snap.failure?.category).toBe('auth');
    expect(snap.failure?.retryable).toBe(false);
    expect(snap.failure?.causeCode).toBe('test-auth');
    expect(lifecycle.isAvailable('t-ocr')).toBe(false);
  });

  it('transitions to unhealthy for configuration failure (fatal)', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', failingProbe('configuration'));
    const snap = await lifecycle.check('t-ocr');
    expect(snap.state).toBe('unhealthy');
    expect(snap.failure?.category).toBe('configuration');
    expect(snap.failure?.retryable).toBe(false);
  });

  it('transitions to unhealthy for protocol failure (fatal)', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', failingProbe('protocol'));
    const snap = await lifecycle.check('t-ocr');
    expect(snap.state).toBe('unhealthy');
    expect(snap.failure?.category).toBe('protocol');
    expect(snap.failure?.retryable).toBe(false);
  });

  it('transitions to unavailable for connectivity failure (transient, retryable)', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', failingProbe('connectivity'));
    const snap = await lifecycle.check('t-ocr');
    expect(snap.state).toBe('unavailable');
    expect(snap.failure?.category).toBe('connectivity');
    expect(snap.failure?.retryable).toBe(true);
  });

  it('transitions to unavailable for quota failure (transient, retryable)', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', failingProbe('quota'));
    const snap = await lifecycle.check('t-ocr');
    expect(snap.state).toBe('unavailable');
    expect(snap.failure?.category).toBe('quota');
    expect(snap.failure?.retryable).toBe(true);
    expect(snap.failure?.retryAfterMs).toBe(5_000);
  });

  it('rejects stale success from a superseded generation (AD-18)', async () => {
    let resolveProbe: ((r: { ok: true; evidence: string } | { ok: false; failure: import('../src/core/providers/health.js').HealthFailure }) => void) | undefined;
    let probeCall = 0;

    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult1 = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult1.ok).toBe(true);
    if (!buildResult1.ok) return;

    lifecycle.register(buildResult1.configuration);
    lifecycle.registerProbe('t-ocr', async (gen) => {
      probeCall++;
      return new Promise((resolve) => {
        resolveProbe = resolve as typeof resolveProbe;
      });
    });

    const pending = lifecycle.check('t-ocr');

    // While probe #1 is in flight, supersede with a new generation (change endpoint).
    const entry2 = { ...VALID_ENTRY, endpoint: 'https://api.aiforthai.in.th/ocr/v2' };
    const buildResult2 = buildSpecialistEffectiveConfiguration(entry2, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult2.ok).toBe(true);
    if (!buildResult2.ok) return;
    lifecycle.register(buildResult2.configuration);

    // Resolve the old probe with success.
    resolveProbe!({ ok: true, evidence: 'stale-evidence' });
    const snap = await pending;

    // Stale success must not make the new generation available.
    expect(snap.state).not.toBe('available');
    expect(lifecycle.isAvailable('t-ocr')).toBe(false);
    expect(probeCall).toBe(1);
  });

  it('quarantine keeps the service unselectable until retest', () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    const snap = lifecycle.quarantine('t-ocr', 'shared credential rejected');
    expect(snap.state).toBe('quarantined');
    expect(snap.failure?.causeCode).toBe('quarantined');
    expect(lifecycle.isAvailable('t-ocr')).toBe(false);
  });

  it('markUnconfigured resets to unconfigured and clears config/probe', () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', passingProbe());
    expect(lifecycle.snapshot('t-ocr').state).toBe('configured');

    const snap = lifecycle.markUnconfigured('t-ocr');
    expect(snap.state).toBe('unconfigured');
    expect(lifecycle.snapshot('t-ocr').state).toBe('unconfigured');
    expect(lifecycle.isAvailable('t-ocr')).toBe(false);
  });

  it('folds a throwing probe into a typed unknown failure', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', async () => {
      throw new Error('probe crashed');
    });
    const snap = await lifecycle.check('t-ocr');
    expect(snap.failure?.category).toBe('unknown');
    expect(snap.failure?.causeCode).toBe('probe-threw');
    // unknown is not fatal (auth/configuration/protocol), so it maps to unavailable.
    expect(snap.state).toBe('unavailable');
  });

  it('returns unconfigured for unknown service', () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const snap = lifecycle.snapshot('nonexistent');
    expect(snap.state).toBe('unconfigured');
    expect(lifecycle.isAvailable('nonexistent')).toBe(false);
  });

  it('snapshots returns all registered services', () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    const all = lifecycle.snapshots();
    expect(all.length).toBe(1);
    expect(all[0].serviceId).toBe('t-ocr');
    expect(all[0].state).toBe('configured');
  });

  it('probe-missing returns configuration failure (no probe registered)', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    // No probe registered — HealthRegistry returns probe-missing.
    const snap = await lifecycle.check('t-ocr');
    expect(snap.state).toBe('unconfigured');
    expect(snap.failure?.causeCode).toBe('probe-missing');
  });

  it('secret-free: raw key never appears in snapshot/evidence/failure', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;

    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', passingProbe());
    const snap = await lifecycle.check('t-ocr');
    const json = JSON.stringify(snap);
    expect(json).not.toContain('sk-');
    expect(json).not.toContain('api_key');
    expect(json).not.toContain('"secret"');

    // Failure envelope should also be secret-free.
    const lifecycle2 = new SpecialistHealthLifecycle(fixedClock);
    const buildResult2 = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult2.ok).toBe(true);
    if (!buildResult2.ok) return;
    lifecycle2.register(buildResult2.configuration);
    lifecycle2.registerProbe('t-ocr', failingProbe('auth'));
    const failSnap = await lifecycle2.check('t-ocr');
    const failJson = JSON.stringify(failSnap);
    expect(failJson).not.toContain('sk-');
    expect(failJson).not.toContain('api_key');
    expect(failJson).not.toContain('"secret"');
  });
});

// ---------------------------------------------------------------------------
// AC: Non-invokable entries can never establish availability
// ---------------------------------------------------------------------------

describe('AC: non-invokable entries never establish availability', () => {
  it('builder fails closed with not-invokable', () => {
    const result = buildSpecialistEffectiveConfiguration(NON_INVOKABLE_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('not-invokable');
  });

  it('lifecycle never registers a generation for non-invokable', () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const result = buildSpecialistEffectiveConfiguration(NON_INVOKABLE_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    // The lifecycle never receives a config, so the service stays unconfigured.
    expect(lifecycle.snapshot('typhoon-translate').state).toBe('unconfigured');
  });
});

// ---------------------------------------------------------------------------
// AC: Canonical state tokens are never silently mapped
// ---------------------------------------------------------------------------

describe('AC: canonical state tokens never silently mapped', () => {
  it('configured never implies available', () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;
    lifecycle.register(buildResult.configuration);
    expect(lifecycle.snapshot('t-ocr').state).toBe('configured');
    expect(lifecycle.isAvailable('t-ocr')).toBe(false);
  });

  it('unavailable is never mapped to available', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;
    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', failingProbe('connectivity'));
    const snap = await lifecycle.check('t-ocr');
    expect(snap.state).toBe('unavailable');
    expect(snap.state).not.toBe('available');
  });

  it('unhealthy is never mapped to available', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;
    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', failingProbe('auth'));
    const snap = await lifecycle.check('t-ocr');
    expect(snap.state).toBe('unhealthy');
    expect(snap.state).not.toBe('available');
  });

  it('quarantined is never mapped to available', () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;
    lifecycle.register(buildResult.configuration);
    lifecycle.quarantine('t-ocr', 'test');
    expect(lifecycle.snapshot('t-ocr').state).toBe('quarantined');
    expect(lifecycle.isAvailable('t-ocr')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC: No silent fallback to another Specialist on failure
// ---------------------------------------------------------------------------

describe('AC: no silent fallback on failure', () => {
  it('a failing probe does not substitute another service', async () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;
    lifecycle.register(buildResult.configuration);
    lifecycle.registerProbe('t-ocr', failingProbe('auth'));
    const snap = await lifecycle.check('t-ocr');
    expect(snap.state).toBe('unhealthy');
    // The failure is scoped to the proven service.
    expect(snap.failure?.scope).toBe('t-ocr');
    // No other service is affected.
    expect(lifecycle.snapshot('speech-to-text').state).toBe('unconfigured');
  });
});

// ---------------------------------------------------------------------------
// AC: Headless/noninteractive fails closed before any Specialist request
// ---------------------------------------------------------------------------

describe('AC: headless/noninteractive fails closed', () => {
  it('builder does not assume availability from configuration alone', () => {
    const lifecycle = new SpecialistHealthLifecycle(fixedClock);
    const buildResult = buildSpecialistEffectiveConfiguration(VALID_ENTRY, CREDENTIAL_REFERENCE, undefined, fixedClock);
    expect(buildResult.ok).toBe(true);
    if (!buildResult.ok) return;
    lifecycle.register(buildResult.configuration);
    // Even with a valid config, the service is not available until a probe passes.
    expect(lifecycle.isAvailable('t-ocr')).toBe(false);
  });
});
