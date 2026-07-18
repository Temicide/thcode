// Story 4.16: deterministic failure classification and smallest-proven-scope
// quarantine. All tests are offline and use typed fixtures only (AD-18, AD-24).

import { describe, expect, it } from 'vitest';
import {
  applyQuarantine,
  classifyHealthFailure,
  classifySpecialistFailure,
  decideQuarantine,
  nextActionFor,
  projectClassifiedFailure,
  type ClassificationContext,
  type CredentialGroupMember,
  type FailureClass,
} from '../src/core/specialists/classification/index.js';
import type {
  SpecialistFailure,
  SpecialistFailureCategory,
} from '../src/core/specialists/adapter/types.js';
import type { HealthFailure } from '../src/core/providers/health.js';
import { SpecialistHealthLifecycle } from '../src/core/specialists/health/index.js';
import type { SpecialistEffectiveConfiguration } from '../src/core/specialists/health/types.js';
import { CacheIndex, invalidateCache } from '../src/core/specialists/evidence/index.js';

const NOW = '2026-07-18T12:00:00.000Z';
const clock = (): string => NOW;
const services = ['t-ocr', 'speech-to-text', 'extract-address', 'named-entity-recognition'] as const;

type ServiceId = (typeof services)[number];

function makeFailure(
  category: SpecialistFailureCategory,
  overrides: Partial<SpecialistFailure> = {},
): SpecialistFailure {
  return {
    ok: false,
    category,
    retryability: category === 'rate-limited' ? 'retry-after-specified' : 'not-retryable',
    smallestProvenScope: 't-ocr#op-1#gen-t-ocr',
    effectiveGenerationId: 'gen-t-ocr',
    operationId: 'op-1',
    safeMessage: `Specialist request failed: ${category}.`,
    causeCode: `cause-${category}`,
    serviceId: 't-ocr',
    completedAt: NOW,
    ...overrides,
  };
}

function configuration(serviceId: ServiceId): SpecialistEffectiveConfiguration {
  return {
    id: `gen-${serviceId}`,
    serviceId,
    endpoint: `https://api.example.test/${serviceId}`,
    origin: 'aiforthai',
    serviceMapping: serviceId,
    credentialReferenceId: 'aiforthai-ref',
    credentialRevision: 'rev-1',
    credentialFingerprint: 'fingerprint',
    manifestVersion: 1,
    contractVersion: '1.0.0',
    adapterVersion: '1.0.0',
    transportPolicy: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
    requestConfig: { timeoutMs: 30000, maxRetries: 0 },
    createdAt: NOW,
  };
}

const groupMembers: readonly CredentialGroupMember[] = services.map((serviceId) => ({
  serviceId,
  generationId: `gen-${serviceId}`,
  credentialReferenceId: 'aiforthai-ref',
  credentialRevision: 'rev-1',
}));

const groupContext: ClassificationContext = {
  sealedEvidenceRef: 'evidence-specialist-failure-1',
  credentialGroup: {
    id: 'aiforthai',
    credentialReferenceId: 'aiforthai-ref',
    credentialRevision: 'rev-1',
    members: groupMembers,
  },
};

const expectedClasses: readonly [SpecialistFailureCategory, FailureClass, 'none' | 'service' | 'credential-group'][] = [
  ['transport', 'transient-network', 'none'],
  ['timeout', 'transient-network', 'none'],
  ['quota', 'quota-rate-limit', 'none'],
  ['rate-limited', 'quota-rate-limit', 'none'],
  ['unauthorized', 'authentication', 'credential-group'],
  ['forbidden', 'entitlement', 'service'],
  ['malformed-response', 'protocol-incompatibility', 'service'],
  ['not-found', 'configuration-failure', 'service'],
  ['unsupported-input', 'unsupported-input', 'none'],
  ['server-error', 'unknown-outcome', 'none'],
  ['unknown-outcome', 'unknown-outcome', 'none'],
];

describe('Story 4.16 classification', () => {
  it.each(expectedClasses)('maps %s to exactly %s at %s scope', (category, failureClass, scope) => {
    const failure = makeFailure(category, { retryAfterMs: category === 'rate-limited' ? 5000 : undefined });
    const classified = classifySpecialistFailure(failure, groupContext);

    expect(classified.failureClass).toBe(failureClass);
    expect(classified.scope.kind).toBe(scope);
    expect(classified.retryability).toBe(failure.retryability);
    expect(classified.causeCode).toBe(failure.causeCode);
    expect(classified.smallestProvenScope).toBe(failure.smallestProvenScope);
    expect(classified.effectiveGenerationId).toBe(failure.effectiveGenerationId);
    expect(classified.operationId).toBe(failure.operationId);
    expect(classified.evidenceRef).toBe('evidence-specialist-failure-1');
  });

  it('falls back to service scope when shared credential proof is incomplete', () => {
    const classified = classifySpecialistFailure(makeFailure('unauthorized'), {
      sealedEvidenceRef: 'evidence-1',
      credentialGroup: {
        ...groupContext.credentialGroup,
        members: groupMembers.slice(1),
      },
    });

    expect(classified.scope).toEqual({ kind: 'service', serviceId: 't-ocr', generationId: 'gen-t-ocr' });
  });

  it('rejects conflicting credential group members instead of broadening scope', () => {
    const conflicting: CredentialGroupMember = {
      ...groupMembers[1],
      credentialRevision: 'rev-other',
    };
    const classified = classifySpecialistFailure(makeFailure('unauthorized'), {
      sealedEvidenceRef: 'evidence-1',
      credentialGroup: { ...groupContext.credentialGroup, members: [groupMembers[0], conflicting] },
    });

    expect(classified.scope.kind).toBe('service');
  });

  it('classifies health failures without quarantine scope or invented evidence', () => {
    const healthFailure: HealthFailure = {
      category: 'connectivity',
      retryable: true,
      scope: 't-ocr',
      generationId: 'gen-t-ocr',
      safeMessage: 'Probe timed out.',
      causeCode: 'probe-timeout',
    };
    const classified = classifyHealthFailure(healthFailure, 'evidence-health-1');

    expect(classified.failureClass).toBe('failed-health');
    expect(classified.scope).toEqual({ kind: 'none' });
    expect(classified.evidenceRef).toBe('evidence-health-1');
    expect(decideQuarantine(classified).quarantine).toBe(false);
  });

  it('never quarantines transient, quota, unsupported, health, or unknown failures', () => {
    const categories: readonly SpecialistFailureCategory[] = [
      'transport', 'timeout', 'quota', 'rate-limited', 'unsupported-input', 'server-error', 'unknown-outcome',
    ];
    for (const category of categories) {
      expect(decideQuarantine(classifySpecialistFailure(makeFailure(category), groupContext)).quarantine).toBe(false);
    }
  });

  it('uses a shared Evidence reference and atomically quarantines every proven member', () => {
    const lifecycle = new SpecialistHealthLifecycle(clock);
    for (const serviceId of services) lifecycle.register(configuration(serviceId));

    const classified = classifySpecialistFailure(makeFailure('unauthorized'), groupContext);
    const receipt = applyQuarantine(decideQuarantine(classified), lifecycle);

    expect(receipt).toMatchObject({
      applied: true,
      serviceIds: services,
      evidenceRef: 'evidence-specialist-failure-1',
    });
    for (const serviceId of services) {
      expect(lifecycle.snapshot(serviceId).state).toBe('quarantined');
    }
  });

  it('does not partially quarantine a group when any generation is unconfigured', () => {
    const lifecycle = new SpecialistHealthLifecycle(clock);
    lifecycle.register(configuration('t-ocr'));
    lifecycle.register(configuration('speech-to-text'));
    lifecycle.register(configuration('extract-address'));

    const receipt = applyQuarantine(
      decideQuarantine(classifySpecialistFailure(makeFailure('unauthorized'), groupContext)),
      lifecycle,
    );

    expect(receipt).toMatchObject({ applied: false, serviceIds: [], blockedReason: 'unconfigured' });
    expect(lifecycle.snapshot('t-ocr').state).toBe('configured');
    expect(lifecycle.snapshot('speech-to-text').state).toBe('configured');
  });

  it('quarantines only the proven service for entitlement, protocol, and configuration failures', () => {
    const categories: readonly SpecialistFailureCategory[] = ['forbidden', 'malformed-response', 'not-found'];
    for (const category of categories) {
      const lifecycle = new SpecialistHealthLifecycle(clock);
      lifecycle.register(configuration('t-ocr'));
      lifecycle.register(configuration('speech-to-text'));
      const receipt = applyQuarantine(
        decideQuarantine(classifySpecialistFailure(makeFailure(category), groupContext)),
        lifecycle,
      );
      expect(receipt.serviceIds).toEqual(['t-ocr']);
      expect(lifecycle.snapshot('t-ocr').state).toBe('quarantined');
      expect(lifecycle.snapshot('speech-to-text').state).toBe('configured');
    }
  });

  it('projects canonical attribution, next action, and an evidence reference without secrets', () => {
    const classified = classifySpecialistFailure(makeFailure('rate-limited', {
      retryAfterMs: 5000,
      safeMessage: 'Authorization: Bearer secret-value',
    }), groupContext);
    const projection = projectClassifiedFailure(classified);

    expect(projection).toMatchObject({
      token: 'failure-classification',
      failureClass: 'quota-rate-limit',
      scope: 'none',
      evidenceRef: 'evidence-specialist-failure-1',
      nextAction: 'wait and retry (retry after 5s)',
    });
    expect(projection.safeMessage).not.toContain('secret-value');
    expect(nextActionFor('unknown-outcome')).toBe('no automatic retry; retest explicitly');
  });

  it('invalidates only the cache scope selected by successful quarantine', () => {
    const index = new CacheIndex();
    index.record('t-ocr-cache', 'evidence-t-ocr', {
      serviceId: 't-ocr', effectiveConfigurationId: 'gen-t-ocr', contractVersion: '1',
      credentialRevision: 'rev-1', sourceContentHash: 'source-1', endpoint: 'https://api.example.test/t-ocr',
      observationTime: NOW, retention: { kind: 'none' },
    });
    index.record('other-cache', 'evidence-other', {
      serviceId: 'other', effectiveConfigurationId: 'gen-other', contractVersion: '1',
      credentialRevision: 'rev-other', sourceContentHash: 'source-2', endpoint: 'https://other.example.test',
      observationTime: NOW, retention: { kind: 'none' },
    });

    const receipt = invalidateCache(index, { kind: 'serviceId', serviceId: 't-ocr' });
    expect(receipt.affectedDigests).toEqual(['t-ocr-cache']);
    expect(index.lookup('t-ocr-cache')).toEqual({ ok: false, cause: 'invalidated' });
    expect(index.lookup('other-cache').ok).toBe(true);
  });
});
