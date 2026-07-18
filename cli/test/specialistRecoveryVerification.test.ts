import { describe, expect, it } from 'vitest';
import { SpecialistHealthLifecycle, buildSpecialistEffectiveConfiguration } from '../src/core/specialists/health/index.js';
import type { SpecialistEffectiveConfiguration, SpecialistHealthProbe } from '../src/core/specialists/health/index.js';
import type { CapabilityRegistryEntry } from '../src/core/specialists/registry/types.js';
import { defaultSpecialistHandlers } from '../src/core/specialists/services/index.js';
import { diagnoseService, retestService } from '../src/core/specialists/catalog/controls.js';
import { projectSpecialistFailure } from '../src/core/specialists/adapter/index.js';
import type { SpecialistFailure } from '../src/core/specialists/adapter/index.js';

const now = '2026-07-18T12:00:00.000Z';
const clock = (): string => now;

function entry(id = 't-ocr'): CapabilityRegistryEntry {
  return {
    id,
    upstreamId: `aiforthai-${id}`,
    nameThai: id,
    nameEnglish: id,
    searchTerms: [id],
    capabilities: [id],
    supportedInputs: ['text/plain'],
    inputLimits: {},
    entitlement: 'ai-for-thai',
    evidenceLevel: 'reviewed',
    observationDate: '2026-07-18',
    endpoint: `https://api.aiforthai.in.th/${id}`,
    transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
    privacyClassification: { category: 'text', dataClasses: ['text'], requiresConsent: true },
    retentionClassification: { policy: 'no-retention', providerDeletionSupported: true, defaultRetentionDays: null },
    confirmationPolicy: { requiresExplicitConsent: true, scope: 'transfer' },
    manifestVersion: 1,
    contractVersion: '1.0.0',
    adapterVersion: '1.0.0',
    latestContractTestResult: { passed: true, testedAt: now, summary: 'offline' },
    invokable: true,
    invokableStateReason: null,
  };
}

const credential = {
  referenceId: 'aiforthai',
  credentialRevision: 'rev-1',
  fingerprint: 'fp-1',
  provider: 'ai-for-thai',
  verifiedHost: 'api.aiforthai.in.th',
  storage: 'os-credential-store' as const,
  createdAt: now,
};

function config(id = 't-ocr', nonce?: string): SpecialistEffectiveConfiguration {
  const result = buildSpecialistEffectiveConfiguration(entry(id), credential, undefined, clock, nonce);
  if (!result.ok) throw new Error(result.detail);
  return result.configuration;
}

function passing(evidence = 'probe-pass'): SpecialistHealthProbe {
  return async () => ({ ok: true, evidence });
}

function failing(outcome: 'cancelled' | 'unknown'): SpecialistHealthProbe {
  return async () => ({ ok: false, outcome, safeReason: `fixture-${outcome}` });
}

describe('Story 4.17 explicit retest and scoped recovery', () => {
  it('creates a fresh generation and restores only a passing service', async () => {
    const lifecycle = new SpecialistHealthLifecycle(clock);
    const first = config();
    lifecycle.register(first);
    lifecycle.registerProbe('t-ocr', passing());
    await lifecycle.check('t-ocr');
    lifecycle.quarantine('t-ocr', 'fixture quarantine');

    const result = await lifecycle.retest({ serviceId: 't-ocr', operationId: 'op-1' }, config('t-ocr', 'op-1:1'));
    expect(result.outcome).toBe('passed');
    expect(result.restoredServiceIds).toEqual(['t-ocr']);
    expect(result.generationId).not.toBe(first.id);
    expect(lifecycle.snapshot('t-ocr').state).toBe('available');
  });

  it.each(['cancelled', 'unknown'] as const)('does not restore a %s retest', async (outcome) => {
    const lifecycle = new SpecialistHealthLifecycle(clock);
    lifecycle.register(config());
    lifecycle.quarantine('t-ocr', 'still quarantined');
    lifecycle.registerProbe('t-ocr', failing(outcome));
    const result = await lifecycle.explicitRetest({ serviceId: 't-ocr', operationId: `op-${outcome}` }, config('t-ocr', outcome));
    expect(result.outcome).toBe(outcome);
    expect(result.restoredServiceIds).toEqual([]);
    expect(lifecycle.snapshot('t-ocr').state).toBe('quarantined');
  });

  it('restores a shared credential group atomically', async () => {
    const lifecycle = new SpecialistHealthLifecycle(clock);
    const configs = ['t-ocr', 'speech-to-text', 'extract-address', 'ner'].map((id) => config(id, 'group-1'));
    for (const item of configs) {
      lifecycle.registerProbe(item.serviceId, passing(item.serviceId));
    }
    const result = await lifecycle.retestGroup({ serviceId: 't-ocr', scope: 'credential-group', operationId: 'group-op' }, configs);
    expect(result.outcome).toBe('passed');
    expect(result.restoredServiceIds).toHaveLength(4);
    expect(lifecycle.snapshots().every((snapshot) => snapshot.state === 'available')).toBe(true);
  });
});

describe('Stories 4.18–4.20 deterministic verification surfaces', () => {
  it('registers exactly the four reviewed launch handlers', () => {
    const handlers = defaultSpecialistHandlers();
    expect(handlers.map((handler) => handler.serviceId)).toEqual([
      't-ocr', 'speech-to-text', 'extract-address', 'named-entity-recognition',
    ]);
  });

  it('catalog retest is an explicit live action, not a completed recovery claim', () => {
    const registry = { ok: true, byId: () => entry(), manifest: { entries: [entry()] } } as never;
    const result = retestService(registry, { 't-ocr': 'unavailable' }, new Set(), 't-ocr');
    expect(result.ok).toBe(true);
    expect(result.action).toBe('retest-live');
    expect(result.recoveryState).toBe('unavailable');
    expect(result.message).toContain('No probe has run yet');
  });

  it('keeps canonical failure projection semantics independent of presentation mode', () => {
    const failure: SpecialistFailure = {
      ok: false,
      serviceId: 't-ocr',
      category: 'rate-limited',
      retryability: 'retryable',
      smallestProvenScope: 't-ocr#op#gen',
      effectiveGenerationId: 'gen',
      operationId: 'op',
      safeMessage: 'Rate limited.',
      causeCode: 'http-429',
      completedAt: now,
    };
    const projection = projectSpecialistFailure(failure);
    expect(projection.token).toBe('failure-provenance');
    expect(projection.category).toBe('rate-limited');
    expect(projection.heading).toBe('Failure Provenance');
    expect(JSON.stringify(projection)).not.toContain('sk-');
  });

  it('diagnosis retains exact quarantine token and explicit next action', () => {
    const registry = { ok: true, byId: () => entry(), manifest: { entries: [entry()] } } as never;
    const result = diagnoseService(registry, { 't-ocr': 'quarantined' }, new Set(), 't-ocr');
    expect('ok' in result && result.ok === false).toBe(false);
    if ('ok' in result && result.ok === false) return;
    expect(result.healthState).toBe('quarantined');
    expect(result.retestRecommended).toBe(true);
  });
});
