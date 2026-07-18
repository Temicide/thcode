import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CapabilityRegistry,
  CATALOGUED_NOT_AVAILABLE,
  loadRegistryManifest,
  parseManifest,
  validateManifest,
} from '../src/core/specialists/registry/index.js';

const MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'specialists-manifest.json',
);

const NOW = '2026-07-17T12:00:00.000Z';

describe('specialist registry — Release 1 manifest', () => {
  it('loads the checked-in manifest successfully', () => {
    const result = loadRegistryManifest(MANIFEST_PATH, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.manifestVersion).toBe(1);
    expect(result.manifest.observationDate).toBeTruthy();
    expect(result.manifest.freshnessDays).toBeGreaterThan(0);
    expect(result.manifest.revoked).toBe(false);
    expect(result.manifest.entries.length).toBeGreaterThanOrEqual(5);
  });

  it('has exactly 4 invokable launch services', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    expect(registry.ok).toBe(true);
    const invokable = registry.invokable();
    expect(invokable).toHaveLength(4);
    const ids = invokable.map((e) => e.id).sort();
    expect(ids).toEqual([
      'extract-address',
      'named-entity-recognition',
      'speech-to-text',
      't-ocr',
    ]);
  });

  it('has at least one non-invokable entry with Catalogued — Not available yet', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    expect(registry.ok).toBe(true);
    const nonInvokable = registry.nonInvokable();
    expect(nonInvokable.length).toBeGreaterThanOrEqual(1);
    for (const entry of nonInvokable) {
      expect(entry.invokable).toBe(false);
      expect(entry.invokableStateReason).toBe(CATALOGUED_NOT_AVAILABLE);
    }
  });

  it('each entry carries all required fields', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    expect(registry.ok).toBe(true);
    for (const entry of registry.all()) {
      expect(entry.id).toBeTruthy();
      expect(entry.upstreamId).toBeTruthy();
      expect(entry.nameThai).toBeTruthy();
      expect(entry.nameEnglish).toBeTruthy();
      expect(entry.searchTerms.length).toBeGreaterThan(0);
      expect(entry.capabilities.length).toBeGreaterThan(0);
      expect(entry.supportedInputs.length).toBeGreaterThan(0);
      expect(entry.inputLimits).toBeTruthy();
      expect(entry.entitlement).toBeTruthy();
      expect(entry.evidenceLevel).toBeTruthy();
      expect(entry.observationDate).toBeTruthy();
      expect(entry.endpoint).toBeTruthy();
      expect(entry.transportRules.allowedProtocols.length).toBeGreaterThan(0);
      expect(typeof entry.transportRules.requiresTls).toBe('boolean');
      expect(entry.transportRules.allowedMethods.length).toBeGreaterThan(0);
      expect(entry.privacyClassification.category).toBeTruthy();
      expect(entry.privacyClassification.dataClasses.length).toBeGreaterThan(0);
      expect(typeof entry.privacyClassification.requiresConsent).toBe('boolean');
      expect(entry.retentionClassification.policy).toBeTruthy();
      expect(typeof entry.retentionClassification.providerDeletionSupported).toBe('boolean');
      expect(entry.confirmationPolicy.requiresExplicitConsent).toBe(true);
      expect(entry.confirmationPolicy.scope).toBeTruthy();
      expect(entry.manifestVersion).toBe(1);
      expect(entry.contractVersion).toBeTruthy();
      expect(entry.adapterVersion).toBeTruthy();
      expect(typeof entry.latestContractTestResult.passed).toBe('boolean');
      expect(entry.latestContractTestResult.testedAt).toBeTruthy();
      expect(entry.latestContractTestResult.summary).toBeTruthy();
      expect(typeof entry.invokable).toBe('boolean');
    }
  });

  it('looks up entries by id', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const ocr = registry.byId('t-ocr');
    expect(ocr).toBeDefined();
    expect(ocr!.nameEnglish).toBe('T-OCR');
    expect(ocr!.invokable).toBe(true);

    const ner = registry.byId('named-entity-recognition');
    expect(ner).toBeDefined();
    expect(ner!.nameEnglish).toBe('Named Entity Recognition');
    expect(ner!.invokable).toBe(true);

    const missing = registry.byId('nonexistent');
    expect(missing).toBeUndefined();
  });
});

describe('specialist registry — invocation gating', () => {
  it('allows invocation of invokable services', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const result = registry.checkInvocation('t-ocr');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.id).toBe('t-ocr');
    }
  });

  it('blocks invocation of non-invokable services', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const nonInvokable = registry.nonInvokable();
    for (const entry of nonInvokable) {
      const result = registry.checkInvocation(entry.id);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.evidence.cause).toBe('not-invokable');
        expect(result.evidence.detail).toContain('not invokable');
      }
    }
  });

  it('blocks invocation of unknown services', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const result = registry.checkInvocation('unknown-service');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('not-found');
      expect(result.evidence.detail).toContain('not found');
    }
  });

  it('fails closed when registry is not loaded', () => {
    const badResult = validateManifest(null, NOW);
    const registry = CapabilityRegistry.fromLoadResult(badResult);
    const result = registry.checkInvocation('t-ocr');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('malformed');
    }
  });
});

describe('specialist registry — fail-closed scenarios', () => {
  it('rejects a malformed manifest (null)', () => {
    const result = validateManifest(null, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('malformed');
      expect(result.evidence.manifestVersion).toBe(0);
      expect(result.evidence.timestamp).toBe(NOW);
    }
  });

  it('rejects a malformed manifest (non-object)', () => {
    const result = validateManifest('not-an-object', NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('malformed');
    }
  });

  it('rejects a manifest missing manifestVersion', () => {
    const raw = {
      observationDate: '2026-07-17',
      freshnessDays: 90,
      source: 'test',
      entries: [],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('malformed');
      expect(result.evidence.detail).toContain('manifestVersion');
    }
  });

  it('rejects a manifest missing observationDate', () => {
    const raw = {
      manifestVersion: 1,
      freshnessDays: 90,
      source: 'test',
      entries: [],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('missing-field');
      expect(result.evidence.detail).toContain('observationDate');
    }
  });

  it('rejects a manifest missing freshnessDays', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-17',
      source: 'test',
      entries: [],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('missing-field');
      expect(result.evidence.detail).toContain('freshnessDays');
    }
  });

  it('rejects a stale manifest', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-01-01',
      freshnessDays: 30,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [],
    };
    // now is 2026-07-17, which is > 30 days from 2026-01-01
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('stale');
      expect(result.evidence.manifestVersion).toBe(1);
      expect(result.evidence.detail).toContain('exceeds freshness policy');
    }
  });

  it('accepts a fresh manifest', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-15',
      freshnessDays: 30,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(true);
  });

  it('rejects a revoked manifest', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-17',
      freshnessDays: 90,
      revoked: true,
      revocationReason: 'Security advisory: credential rotation required',
      source: 'test',
      entries: [],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('revoked');
      expect(result.evidence.manifestVersion).toBe(1);
      expect(result.evidence.detail).toContain('Security advisory');
    }
  });

  it('rejects a manifest missing entries array', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-17',
      freshnessDays: 90,
      source: 'test',
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('missing-field');
      expect(result.evidence.detail).toContain('entries');
    }
  });

  it('rejects invalid JSON', () => {
    const result = parseManifest('{invalid json}', NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.cause).toBe('malformed');
      expect(result.evidence.detail).toContain('not valid JSON');
    }
  });

  it('rejects duplicate entry ids', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-17',
      freshnessDays: 90,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [
        {
          id: 'dup',
          upstreamId: 'u1',
          nameThai: 'A',
          nameEnglish: 'A',
          searchTerms: ['a'],
          capabilities: ['c'],
          supportedInputs: ['text/plain'],
          inputLimits: {},
          entitlement: 'key',
          evidenceLevel: 'deterministic',
          observationDate: '2026-07-17',
          endpoint: 'https://example.invalid',
          transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
          privacyClassification: { category: 'text', dataClasses: ['text'], requiresConsent: true },
          retentionClassification: { policy: 'no-retention', providerDeletionSupported: false, defaultRetentionDays: null },
          confirmationPolicy: { requiresExplicitConsent: true, scope: 'per-transfer' },
          manifestVersion: 1,
          contractVersion: '1.0.0',
          adapterVersion: '1.0.0',
          latestContractTestResult: { passed: true, testedAt: '2026-07-17', summary: 'ok' },
          invokable: false,
          invokableStateReason: 'Catalogued — Not available yet',
        },
        {
          id: 'dup',
          upstreamId: 'u2',
          nameThai: 'B',
          nameEnglish: 'B',
          searchTerms: ['b'],
          capabilities: ['c'],
          supportedInputs: ['text/plain'],
          inputLimits: {},
          entitlement: 'key',
          evidenceLevel: 'deterministic',
          observationDate: '2026-07-17',
          endpoint: 'https://example.invalid',
          transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
          privacyClassification: { category: 'text', dataClasses: ['text'], requiresConsent: true },
          retentionClassification: { policy: 'no-retention', providerDeletionSupported: false, defaultRetentionDays: null },
          confirmationPolicy: { requiresExplicitConsent: true, scope: 'per-transfer' },
          manifestVersion: 1,
          contractVersion: '1.0.0',
          adapterVersion: '1.0.0',
          latestContractTestResult: { passed: true, testedAt: '2026-07-17', summary: 'ok' },
          invokable: false,
          invokableStateReason: 'Catalogued — Not available yet',
        },
      ],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('malformed');
    expect(result.evidence.detail).toContain('duplicate');
    expect(result.evidence.manifestVersion).toBe(1);
    expect(result.evidence.timestamp).toBe(NOW);
  });

  it('rejects entry missing required fields', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-17',
      freshnessDays: 90,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [
        {
          id: 'bad-entry',
          // missing upstreamId
          nameThai: 'Test',
          nameEnglish: 'Test',
          searchTerms: ['test'],
          capabilities: ['c'],
          supportedInputs: ['text/plain'],
          inputLimits: {},
          entitlement: 'key',
          evidenceLevel: 'deterministic',
          observationDate: '2026-07-17',
          endpoint: 'https://example.invalid',
          transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
          privacyClassification: { category: 'text', dataClasses: ['text'], requiresConsent: true },
          retentionClassification: { policy: 'no-retention', providerDeletionSupported: false, defaultRetentionDays: null },
          confirmationPolicy: { requiresExplicitConsent: true, scope: 'per-transfer' },
          manifestVersion: 1,
          contractVersion: '1.0.0',
          adapterVersion: '1.0.0',
          latestContractTestResult: { passed: true, testedAt: '2026-07-17', summary: 'ok' },
          invokable: false,
          invokableStateReason: 'Catalogued — Not available yet',
        },
      ],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('missing-field');
    expect(result.evidence.detail).toContain('upstreamId');
    expect(result.evidence.manifestVersion).toBe(1);
    expect(result.evidence.timestamp).toBe(NOW);
  });

  it('rejects non-invokable entry without invokableStateReason', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-17',
      freshnessDays: 90,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [
        {
          id: 'no-reason',
          upstreamId: 'u1',
          nameThai: 'Test',
          nameEnglish: 'Test',
          searchTerms: ['test'],
          capabilities: ['c'],
          supportedInputs: ['text/plain'],
          inputLimits: {},
          entitlement: 'key',
          evidenceLevel: 'deterministic',
          observationDate: '2026-07-17',
          endpoint: 'https://example.invalid',
          transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
          privacyClassification: { category: 'text', dataClasses: ['text'], requiresConsent: true },
          retentionClassification: { policy: 'no-retention', providerDeletionSupported: false, defaultRetentionDays: null },
          confirmationPolicy: { requiresExplicitConsent: true, scope: 'per-transfer' },
          manifestVersion: 1,
          contractVersion: '1.0.0',
          adapterVersion: '1.0.0',
          latestContractTestResult: { passed: true, testedAt: '2026-07-17', summary: 'ok' },
          invokable: false,
          // invokableStateReason is missing
        },
      ],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('missing-field');
    expect(result.evidence.detail).toContain('invokableStateReason');
    expect(result.evidence.manifestVersion).toBe(1);
    expect(result.evidence.timestamp).toBe(NOW);
  });

  it('rejects an invokable entry that carries a non-null invokableStateReason', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-17',
      freshnessDays: 90,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [
        {
          id: 't-ocr',
          upstreamId: 'u1',
          nameThai: 'A',
          nameEnglish: 'A',
          searchTerms: ['a'],
          capabilities: ['c'],
          supportedInputs: ['text/plain'],
          inputLimits: {},
          entitlement: 'key',
          evidenceLevel: 'deterministic',
          observationDate: '2026-07-17',
          endpoint: 'https://example.invalid',
          transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
          privacyClassification: { category: 'text', dataClasses: ['text'], requiresConsent: true },
          retentionClassification: { policy: 'no-retention', providerDeletionSupported: false, defaultRetentionDays: null },
          confirmationPolicy: { requiresExplicitConsent: true, scope: 'per-transfer' },
          manifestVersion: 1,
          contractVersion: '1.0.0',
          adapterVersion: '1.0.0',
          latestContractTestResult: { passed: true, testedAt: '2026-07-17', summary: 'ok' },
          invokable: true,
          invokableStateReason: 'Catalogued — Not available yet',
        },
      ],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('malformed');
    expect(result.evidence.detail).toContain('invokableStateReason');
  });

  it('rejects a non-positive-integer freshnessDays (zero bypasses staleness)', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2020-01-01',
      freshnessDays: 0,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('malformed');
    expect(result.evidence.detail).toContain('freshnessDays');
  });

  it('rejects a non-integer manifestVersion', () => {
    const result = validateManifest({ manifestVersion: 1.5, observationDate: '2026-07-17', freshnessDays: 90, source: 't', entries: [] }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('malformed');
  });

  it('rejects a NaN freshnessDays', () => {
    const result = validateManifest({ manifestVersion: 1, observationDate: '2026-07-17', freshnessDays: NaN, source: 't', entries: [] }, NOW);
    expect(result.ok).toBe(false);
  });

  it('rejects array elements that are not strings (searchTerms)', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-17',
      freshnessDays: 90,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [
        {
          id: 'x', upstreamId: 'u', nameThai: 'A', nameEnglish: 'A',
          searchTerms: ['ok', 5], capabilities: ['c'], supportedInputs: ['text/plain'],
          inputLimits: {}, entitlement: 'key', evidenceLevel: 'deterministic',
          observationDate: '2026-07-17', endpoint: 'https://example.invalid',
          transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
          privacyClassification: { category: 'text', dataClasses: ['text'], requiresConsent: true },
          retentionClassification: { policy: 'no-retention', providerDeletionSupported: false, defaultRetentionDays: null },
          confirmationPolicy: { requiresExplicitConsent: true, scope: 'per-transfer' },
          manifestVersion: 1, contractVersion: '1.0.0', adapterVersion: '1.0.0',
          latestContractTestResult: { passed: true, testedAt: '2026-07-17', summary: 'ok' },
          invokable: false, invokableStateReason: 'Catalogued — Not available yet',
        },
      ],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('malformed');
    expect(result.evidence.detail).toContain('searchTerms');
  });

  it('rejects non-string inputLimits values', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-17',
      freshnessDays: 90,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [
        {
          id: 'x', upstreamId: 'u', nameThai: 'A', nameEnglish: 'A',
          searchTerms: ['a'], capabilities: ['c'], supportedInputs: ['text/plain'],
          inputLimits: { maxSize: 100 }, entitlement: 'key', evidenceLevel: 'deterministic',
          observationDate: '2026-07-17', endpoint: 'https://example.invalid',
          transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
          privacyClassification: { category: 'text', dataClasses: ['text'], requiresConsent: true },
          retentionClassification: { policy: 'no-retention', providerDeletionSupported: false, defaultRetentionDays: null },
          confirmationPolicy: { requiresExplicitConsent: true, scope: 'per-transfer' },
          manifestVersion: 1, contractVersion: '1.0.0', adapterVersion: '1.0.0',
          latestContractTestResult: { passed: true, testedAt: '2026-07-17', summary: 'ok' },
          invokable: false, invokableStateReason: 'Catalogued — Not available yet',
        },
      ],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('malformed');
    expect(result.evidence.detail).toContain('inputLimits');
  });

  it('rejects a negative defaultRetentionDays', () => {
    const raw = {
      manifestVersion: 1,
      observationDate: '2026-07-17',
      freshnessDays: 90,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [
        {
          id: 'x', upstreamId: 'u', nameThai: 'A', nameEnglish: 'A',
          searchTerms: ['a'], capabilities: ['c'], supportedInputs: ['text/plain'],
          inputLimits: {}, entitlement: 'key', evidenceLevel: 'deterministic',
          observationDate: '2026-07-17', endpoint: 'https://example.invalid',
          transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
          privacyClassification: { category: 'text', dataClasses: ['text'], requiresConsent: true },
          retentionClassification: { policy: 'no-retention', providerDeletionSupported: false, defaultRetentionDays: -5 },
          confirmationPolicy: { requiresExplicitConsent: true, scope: 'per-transfer' },
          manifestVersion: 1, contractVersion: '1.0.0', adapterVersion: '1.0.0',
          latestContractTestResult: { passed: true, testedAt: '2026-07-17', summary: 'ok' },
          invokable: false, invokableStateReason: 'Catalogued — Not available yet',
        },
      ],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('malformed');
    expect(result.evidence.detail).toContain('defaultRetentionDays');
  });

  it('rejects a non-boolean revoked marker (string "true" must not pass as revoked-or-not)', () => {
    const result = validateManifest({ manifestVersion: 1, observationDate: '2026-07-17', freshnessDays: 90, revoked: 'true', source: 't', entries: [] }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('malformed');
    expect(result.evidence.detail).toContain('revoked');
  });

  it('rejects a JSON array root', () => {
    const result = parseManifest('[{"id":"x"}]', NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.evidence.cause).toBe('malformed');
    expect(result.evidence.detail).toContain('root is not an object');
  });

  it('checkInvocation timestamps and categorizes not-found vs not-invokable', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const notFound = registry.checkInvocation('does-not-exist');
    expect(notFound.ok).toBe(false);
    if (notFound.ok) return;
    expect(notFound.evidence.cause).toBe('not-found');
    expect(notFound.evidence.timestamp).toBe(NOW);
    const nonInvokableEntry = registry.nonInvokable()[0];
    const notInvokable = registry.checkInvocation(nonInvokableEntry.id);
    expect(notInvokable.ok).toBe(false);
    if (notInvokable.ok) return;
    expect(notInvokable.evidence.cause).toBe('not-invokable');
    expect(notInvokable.evidence.timestamp).toBe(NOW);
  });
});

describe('specialist registry — external override rejection', () => {
  it('rejects model-supplied registry overrides', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    expect(registry.rejectOverride('model')).toBe(false);
  });

  it('rejects installer-supplied registry overrides', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    expect(registry.rejectOverride('installer')).toBe(false);
  });

  it('rejects URL-supplied registry overrides', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    expect(registry.rejectOverride('url')).toBe(false);
  });

  it('rejects user-supplied registry overrides', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    expect(registry.rejectOverride('user')).toBe(false);
  });
});

describe('specialist registry — rendering and identity', () => {
  it('renders identity with canonical tokens unchanged', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const ocr = registry.byId('t-ocr')!;
    const rendered = registry.renderIdentity(ocr);
    expect(rendered).toContain('t-ocr');
    expect(rendered).toContain('T-OCR');
    expect(rendered).toContain('ที-โอซีอาร์');
    expect(rendered).toContain('working');
  });

  it('renders non-invokable identity with Catalogued — Not available yet', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const nonInvokable = registry.nonInvokable();
    for (const entry of nonInvokable) {
      const rendered = registry.renderIdentity(entry);
      expect(rendered).toContain(entry.id);
      expect(rendered).toContain('Catalogued — Not available yet');
    }
  });

  it('renders compact identity for narrow/headless output', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const ocr = registry.byId('t-ocr')!;
    const compact = registry.renderCompact(ocr);
    expect(compact).toBe('t-ocr|working');

    const nonInvokable = registry.nonInvokable()[0];
    const compactNon = registry.renderCompact(nonInvokable);
    expect(compactNon).toContain(nonInvokable.id);
    expect(compactNon).toContain('not-available');
  });

  it('renders identity unchanged in narrow mode', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const ocr = registry.byId('t-ocr')!;
    const narrow = registry.renderIdentity(ocr, 'narrow');
    expect(narrow).toContain('t-ocr');
    expect(narrow).toContain('working');
  });

  it('renders identity unchanged in headless mode', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const ocr = registry.byId('t-ocr')!;
    const headless = registry.renderIdentity(ocr, 'headless');
    expect(headless).toContain('t-ocr');
    expect(headless).toContain('working');
  });

  it('renders identity unchanged in redirected mode', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    const ocr = registry.byId('t-ocr')!;
    const redirected = registry.renderIdentity(ocr, 'redirected');
    expect(redirected).toContain('t-ocr');
    expect(redirected).toContain('working');
  });
});

describe('specialist registry — manifest version and contract resolution', () => {
  it('registry version resolves to published schema', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    expect(registry.manifest.manifestVersion).toBe(1);
    for (const entry of registry.all()) {
      expect(entry.manifestVersion).toBe(1);
      expect(entry.contractVersion).toBe('1.0.0');
    }
  });

  it('adapter version is present on every entry', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    for (const entry of registry.all()) {
      expect(entry.adapterVersion).toBeTruthy();
    }
  });

  it('latest contract test result is present on every entry', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    for (const entry of registry.all()) {
      expect(typeof entry.latestContractTestResult.passed).toBe('boolean');
      expect(entry.latestContractTestResult.testedAt).toBeTruthy();
      expect(entry.latestContractTestResult.summary).toBeTruthy();
    }
  });
});

describe('specialist registry — sanitized fail-closed evidence', () => {
  it('fail-closed evidence includes manifest version and cause', () => {
    const result = validateManifest(null, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.manifestVersion).toBe(0);
      expect(result.evidence.cause).toBe('malformed');
      expect(result.evidence.detail).toBeTruthy();
      expect(result.evidence.timestamp).toBe(NOW);
    }
  });

  it('fail-closed evidence for stale manifest includes version and staleness detail', () => {
    const raw = {
      manifestVersion: 2,
      observationDate: '2026-01-01',
      freshnessDays: 10,
      revoked: false,
      revocationReason: null,
      source: 'test',
      entries: [],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.manifestVersion).toBe(2);
      expect(result.evidence.cause).toBe('stale');
      expect(result.evidence.detail).toContain('exceeds freshness policy');
    }
  });

  it('fail-closed evidence for revoked manifest includes version and revocation detail', () => {
    const raw = {
      manifestVersion: 3,
      observationDate: '2026-07-17',
      freshnessDays: 90,
      revoked: true,
      revocationReason: 'test revocation',
      source: 'test',
      entries: [],
    };
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.evidence.manifestVersion).toBe(3);
      expect(result.evidence.cause).toBe('revoked');
      expect(result.evidence.detail).toContain('test revocation');
    }
  });
});

describe('specialist registry — reviewed health canaries', () => {
  it('fails closed when an invokable entry is missing its approved static canary', () => {
    const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { entries: Array<Record<string, unknown>> };
    delete raw.entries[0]!.healthCanary;
    const result = validateManifest(raw, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.evidence.cause).toBe('missing-field');
  });

  it('binds each invokable entry to a built-in, version-matched canary', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    for (const entry of registry.invokable()) {
      expect(entry.healthCanary?.dataClassification).toBe('built-in-non-user');
      expect(entry.healthCanary?.contractVersion).toBe(entry.contractVersion);
      expect(entry.healthCanary?.adapterVersion).toBe(entry.adapterVersion);
    }
  });
});

describe('specialist registry — CATALOGUED_NOT_AVAILABLE constant', () => {
  it('has the exact expected string', () => {
    expect(CATALOGUED_NOT_AVAILABLE).toBe('Catalogued — Not available yet');
  });

  it('is used as the invokableStateReason for non-invokable entries in the manifest', () => {
    const registry = CapabilityRegistry.load(NOW, MANIFEST_PATH);
    for (const entry of registry.nonInvokable()) {
      expect(entry.invokableStateReason).toBe(CATALOGUED_NOT_AVAILABLE);
    }
  });
});
