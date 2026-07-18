// Specialist Evidence tests (Story 4.14). Covers every I/O matrix row + every
// AC with deterministic fixtures, injected fixed timestamps, and no network.
// Reuses SpecialistResult/SpecialistFailure types from 4.9 directly.

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  sealSpecialistEvidence,
  type SealSpecialistEvidenceInput,
} from '../src/core/specialists/evidence/seal.js';
import {
  InMemoryEvidenceRepository,
} from '../src/core/specialists/evidence/repository.js';
import {
  projectReusedEvidence,
  projectFreshEvidence,
} from '../src/core/specialists/evidence/projection.js';
import {
  computeCacheManifestDigest,
  buildCacheManifest,
  cacheManifestMatches,
} from '../src/core/specialists/evidence/cacheManifest.js';
import {
  SPECIALIST_EVIDENCE_SCHEMA_VERSION,
} from '../src/core/specialists/evidence/types.js';
import type {
  SpecialistEvidence,
  CacheManifestInput,
  CacheManifest,
} from '../src/core/specialists/evidence/types.js';
import type {
  SpecialistResult,
  SpecialistFailure,
  SpecialistFieldValue,
} from '../src/core/specialists/adapter/types.js';
import type { ConsentReference } from '../src/core/specialists/consent/types.js';
import type { TransformationPolicy } from '../src/core/permissions/transferConsent.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_TIME = '2026-07-18T10:00:00.000Z';

const CONSENT_REF: ConsentReference = {
  consentId: 'consent-abc123',
  manifestDigest: 'abc',
  payloadByteDigest: 'def',
  recipientCapabilityId: 'cap-1',
  recipientCapabilityVersion: '1.0',
  verifiedEndpoint: 'https://example.com/api',
  purpose: 'test',
  grantedAt: FIXED_TIME,
  expiresAt: null,
};

const SERVICE_IDENTITY = {
  serviceId: 't-ocr',
  nameThai: 'บริการ OCR',
  nameEnglish: 'OCR Service',
  contractVersion: '1.0.0',
  adapterVersion: '1.0.0',
};

const PROVENANCE = {
  endpoint: 'https://example.com/ocr',
  method: 'POST',
  status: 200,
  transportVersion: '1.0',
};

const TIMING = {
  startedAt: '2026-07-18T09:59:00.000Z',
  completedAt: '2026-07-18T10:00:00.000Z',
  elapsedMs: 60000,
};

const TRANSFORMATION_POLICY: TransformationPolicy = {
  redactSecrets: true,
  extractTextOnly: false,
  stripActiveContent: true,
  reason: 'standard',
};

// --- SpecialistResult fixture ---

function makeResult(overrides: Partial<SpecialistResult> = {}): SpecialistResult {
  return {
    ok: true,
    serviceId: 't-ocr',
    serviceIdentity: SERVICE_IDENTITY,
    configurationGenerationId: 'gen-1',
    consentReference: CONSENT_REF,
    sourceContentHash: 'sha256-source-hash',
    fields: {
      text: { kind: 'text', value: 'Hello, world!', present: true },
      score: { kind: 'number', value: 0.95, present: true },
      flag: { kind: 'boolean', value: true, present: true },
      tags: { kind: 'list', value: ['a', 'b'], present: true },
      meta: { kind: 'structured', value: { key: 'value' }, present: true },
    },
    emptyFields: [],
    confidence: 0.95,
    uncertainty: 'low',
    timing: TIMING,
    provenance: PROVENANCE,
    sanitizedRawResponseRef: 'raw-ref-1',
    evidenceRef: 'ev-service-1',
    createdAt: FIXED_TIME,
    ...overrides,
  };
}

// --- SpecialistFailure fixture ---

function makeFailure(overrides: Partial<SpecialistFailure> = {}): SpecialistFailure {
  return {
    ok: false,
    category: 'transport',
    retryability: 'retryable',
    smallestProvenScope: 'transport',
    effectiveGenerationId: 'gen-1',
    operationId: 'op-1',
    safeMessage: 'Connection refused',
    causeCode: 'ECONNREFUSED',
    serviceId: 't-ocr',
    completedAt: FIXED_TIME,
    ...overrides,
  };
}

// --- CacheManifestInput fixture ---

function makeCacheManifestInput(overrides: Partial<CacheManifestInput> = {}): CacheManifestInput {
  return {
    manifestVersion: 1,
    serviceId: 't-ocr',
    contractVersion: '1.0.0',
    verifiedOrigin: 'https://example.com/ocr',
    semanticInputs: [
      { mediaType: 'text/plain', contentHash: 'hash-a' },
    ],
    requestOptions: { timeoutMs: 30000, maxRetries: 2 },
    preprocessing: ['utf8-decode'],
    mappingVersion: '1.0.0',
    schemaVersion: 1,
    effectiveConfigurationId: 'cfg-1',
    transformationPolicy: TRANSFORMATION_POLICY,
    sourceIdentity: '/workspace/doc.txt',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Tests: seal result
// ---------------------------------------------------------------------------

describe('sealSpecialistEvidence (result)', () => {
  it('produces frozen immutable evidence with all attribution', () => {
    const result = makeResult();
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    // Root is frozen
    expect(Object.isFrozen(evidence)).toBe(true);
    // Nested objects are frozen
    expect(Object.isFrozen(evidence.serviceIdentity)).toBe(true);
    expect(Object.isFrozen(evidence.provenance)).toBe(true);
    expect(Object.isFrozen(evidence.timing)).toBe(true);
    // Nested arrays are frozen
    expect(Object.isFrozen(evidence.emptyFields)).toBe(true);

    // Schema version
    expect(evidence.schemaVersion).toBe(SPECIALIST_EVIDENCE_SCHEMA_VERSION);
    expect(evidence.schemaVersion).toBe(1);

    // Reuse state
    expect(evidence.reuseState).toBe('fresh');

    // Completeness
    expect(evidence.completeness).toBe('complete');

    // Attribution
    expect(evidence.serviceIdentity).toEqual(SERVICE_IDENTITY);
    expect(evidence.configurationGenerationId).toBe('gen-1');
    expect(evidence.consentReference).toEqual(CONSENT_REF);
    expect(evidence.sourceContentHash).toBe('sha256-source-hash');
    expect(evidence.provenance).toEqual(PROVENANCE);
    expect(evidence.timing).toEqual(TIMING);
    expect(evidence.sanitizedRawResponseRef).toBe('raw-ref-1');
    expect(evidence.evidenceRef).toBe('ev-service-1');
    expect(evidence.observationTime).toBe(FIXED_TIME);
    expect(evidence.displayTime).toBe(FIXED_TIME);

    // Fields preserved
    expect(evidence.fields.text).toEqual({ kind: 'text', value: 'Hello, world!', present: true });
    expect(evidence.fields.score).toEqual({ kind: 'number', value: 0.95, present: true });
    expect(evidence.fields.flag).toEqual({ kind: 'boolean', value: true, present: true });
    expect(evidence.fields.tags).toEqual({ kind: 'list', value: ['a', 'b'], present: true });
    expect(evidence.fields.meta).toEqual({ kind: 'structured', value: { key: 'value' }, present: true });

    // No normalizedFailure for a result
    expect(evidence.normalizedFailure).toBeUndefined();
  });

  it('has a deterministic id — same content produces same id', () => {
    const result = makeResult();
    const input: SealSpecialistEvidenceInput = {
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    };

    const evidence1 = sealSpecialistEvidence(input);
    const evidence2 = sealSpecialistEvidence(input);

    expect(evidence1.id).toBe(evidence2.id);
    expect(evidence1.id).toMatch(/^ev-[a-f0-9]{64}$/);
  });

  it('different content produces different id', () => {
    const result1 = makeResult();
    const result2 = makeResult({ sourceContentHash: 'different-hash' });

    const e1 = sealSpecialistEvidence({
      outcome: result1,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });
    const e2 = sealSpecialistEvidence({
      outcome: result2,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    expect(e1.id).not.toBe(e2.id);
  });

  it('includes cacheManifestDigest when provided', () => {
    const result = makeResult();
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      cacheManifestDigest: 'cm-digest-123',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    expect(evidence.cacheManifestDigest).toBe('cm-digest-123');
  });

  it('includes confidence and uncertainty', () => {
    const result = makeResult({ confidence: 0.85, uncertainty: 'medium' });
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    expect(evidence.confidence).toBe(0.85);
    expect(evidence.uncertainty).toBe('medium');
  });
});

// ---------------------------------------------------------------------------
// Tests: seal failure
// ---------------------------------------------------------------------------

describe('sealSpecialistEvidence (failure)', () => {
  it('produces frozen evidence with normalizedFailure and completeness failed', () => {
    const failure = makeFailure();
    const evidence = sealSpecialistEvidence({
      outcome: failure,
      configurationGenerationId: 'gen-1',
      serviceIdentity: SERVICE_IDENTITY,
      consentReference: CONSENT_REF,
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    expect(Object.isFrozen(evidence)).toBe(true);
    expect(evidence.schemaVersion).toBe(1);
    expect(evidence.reuseState).toBe('fresh');
    expect(evidence.completeness).toBe('failed');
    expect(evidence.normalizedFailure).toBeDefined();
    expect(evidence.normalizedFailure!.category).toBe('transport');
    expect(evidence.normalizedFailure!.safeMessage).toBe('Connection refused');
    expect(evidence.fields).toEqual({});
    expect(evidence.emptyFields).toEqual([]);
  });

  it('uses passed serviceIdentity for failures', () => {
    const failure = makeFailure();
    const evidence = sealSpecialistEvidence({
      outcome: failure,
      configurationGenerationId: 'gen-1',
      serviceIdentity: SERVICE_IDENTITY,
      consentReference: CONSENT_REF,
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    expect(evidence.serviceIdentity).toEqual(SERVICE_IDENTITY);
  });

  it('throws when serviceIdentity is not provided for a failure', () => {
    const failure = makeFailure();
    expect(() => sealSpecialistEvidence({
      outcome: failure,
      configurationGenerationId: 'gen-1',
      consentReference: CONSENT_REF,
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    })).toThrow('sealSpecialistEvidence: serviceIdentity is required to seal a failure outcome.');
  });

  it('throws when consentReference is not provided for a failure', () => {
    const failure = makeFailure();
    expect(() => sealSpecialistEvidence({
      outcome: failure,
      configurationGenerationId: 'gen-1',
      serviceIdentity: SERVICE_IDENTITY,
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    })).toThrow('sealSpecialistEvidence: consentReference is required to seal a failure outcome.');
  });

  it('has deterministic id for failures too', () => {
    const failure = makeFailure();
    const input: SealSpecialistEvidenceInput = {
      outcome: failure,
      configurationGenerationId: 'gen-1',
      serviceIdentity: SERVICE_IDENTITY,
      consentReference: CONSENT_REF,
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    };

    const e1 = sealSpecialistEvidence(input);
    const e2 = sealSpecialistEvidence(input);

    expect(e1.id).toBe(e2.id);
    expect(e1.id).toMatch(/^ev-[a-f0-9]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// Tests: sanitize path
// ---------------------------------------------------------------------------

describe('sealSpecialistEvidence (sanitize)', () => {
  it('redacts secrets in text field values', () => {
    const result = makeResult({
      fields: {
        text: { kind: 'text', value: 'My key is sk-abc123def456ghij', present: true },
      },
    });
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    const textField = evidence.fields.text as { kind: 'text'; value: string; present: boolean };
    expect(textField.value).not.toContain('sk-abc123def456ghij');
    expect(textField.value).toContain('[redacted');
  });

  it('redacts Bearer tokens in text field values', () => {
    const result = makeResult({
      fields: {
        text: { kind: 'text', value: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', present: true },
      },
    });
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    const textField = evidence.fields.text as { kind: 'text'; value: string; present: boolean };
    expect(textField.value).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(textField.value).toContain('[redacted');
  });

  it('preserves kind/present structure after sanitization', () => {
    const result = makeResult({
      fields: {
        text: { kind: 'text', value: 'sk-abc123def456ghij', present: true },
      },
    });
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    const textField = evidence.fields.text as { kind: 'text'; value: string; present: boolean };
    expect(textField.kind).toBe('text');
    expect(textField.present).toBe(true);
  });

  it('sanitizes structured field values', () => {
    const result = makeResult({
      fields: {
        meta: { kind: 'structured', value: { secret: 'sk-abc123def456ghij', ok: true }, present: true },
      },
    });
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    const metaField = evidence.fields.meta as { kind: 'structured'; value: Record<string, unknown>; present: boolean };
    const json = JSON.stringify(metaField.value);
    expect(json).not.toContain('sk-abc123def456ghij');
  });

  it('preserves non-string values in structured fields after sanitization', () => {
    const result = makeResult({
      fields: {
        meta: {
          kind: 'structured',
          value: {
            token: 'sk-abc123def456ghij',
            page: 3,
            active: true,
            tags: ['a', 'b'],
            nested: { inner: 'safe', count: 42 },
          },
          present: true,
        },
      },
    });
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    const metaField = evidence.fields.meta as { kind: 'structured'; value: Record<string, unknown>; present: boolean };
    // Legitimate non-string values survive
    expect(metaField.value.page).toBe(3);
    expect(metaField.value.active).toBe(true);
    expect(metaField.value.tags).toEqual(['a', 'b']);
    expect(metaField.value.nested).toEqual({ inner: expect.any(String), count: 42 });
    // Secret string leaf is redacted
    expect(JSON.stringify(metaField.value)).not.toContain('sk-abc123def456ghij');
    // Structure kind/present preserved
    expect(metaField.kind).toBe('structured');
    expect(metaField.present).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: raw key never in evidence
// ---------------------------------------------------------------------------

describe('raw key never in evidence', () => {
  it('JSON.stringify(evidence) does not contain raw secrets', () => {
    const result = makeResult({
      fields: {
        text: { kind: 'text', value: 'My key is sk-abc123def456ghij', present: true },
        token: { kind: 'text', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', present: true },
      },
    });
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    const json = JSON.stringify(evidence);
    expect(json).not.toContain('sk-abc123def456ghij');
    expect(json).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(json).not.toContain('Bearer eyJ');
  });

  it('ConsentReference is secret-free (no raw key)', () => {
    const result = makeResult();
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    const ref = evidence.consentReference;
    expect(ref.consentId).toBe('consent-abc123');
    expect(ref.manifestDigest).toBe('abc');
    expect(ref.payloadByteDigest).toBe('def');
    // No raw key field
    expect('rawKey' in ref).toBe(false);
    expect('key' in ref).toBe(false);
    expect('secret' in ref).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: CacheManifest deterministic
// ---------------------------------------------------------------------------

describe('CacheManifest deterministic', () => {
  it('same inputs produce same digest', () => {
    const input = makeCacheManifestInput();
    const digest1 = computeCacheManifestDigest(input);
    const digest2 = computeCacheManifestDigest(input);
    expect(digest1).toBe(digest2);
  });

  it('buildCacheManifest round-trip', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    expect(manifest.digest).toBe(computeCacheManifestDigest(input));
    expect(manifest.serviceId).toBe('t-ocr');
    expect(manifest.contractVersion).toBe('1.0.0');
    expect(manifest.verifiedOrigin).toBe('https://example.com/ocr');
    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.mappingVersion).toBe('1.0.0');
    expect(manifest.effectiveConfigurationId).toBe('cfg-1');
    expect(manifest.sourceIdentity).toBe('/workspace/doc.txt');
  });

  it('cacheManifestMatches true for identical', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    expect(cacheManifestMatches(manifest, input)).toBe(true);
  });

  it('cacheManifestMatches false when contractVersion differs', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    const changed = makeCacheManifestInput({ contractVersion: '2.0.0' });
    expect(cacheManifestMatches(manifest, changed)).toBe(false);
  });

  it('cacheManifestMatches false when verifiedOrigin differs', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    const changed = makeCacheManifestInput({ verifiedOrigin: 'https://other.com/api' });
    expect(cacheManifestMatches(manifest, changed)).toBe(false);
  });

  it('cacheManifestMatches false when semanticInputs differ', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    const changed = makeCacheManifestInput({
      semanticInputs: [{ mediaType: 'image/png', contentHash: 'hash-b' }],
    });
    expect(cacheManifestMatches(manifest, changed)).toBe(false);
  });

  it('cacheManifestMatches false when requestOptions differ', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    const changed = makeCacheManifestInput({
      requestOptions: { timeoutMs: 60000, maxRetries: 5 },
    });
    expect(cacheManifestMatches(manifest, changed)).toBe(false);
  });

  it('cacheManifestMatches false when preprocessing differs', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    const changed = makeCacheManifestInput({ preprocessing: ['utf8-decode', 'minify'] });
    expect(cacheManifestMatches(manifest, changed)).toBe(false);
  });

  it('cacheManifestMatches false when mappingVersion differs', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    const changed = makeCacheManifestInput({ mappingVersion: '2.0.0' });
    expect(cacheManifestMatches(manifest, changed)).toBe(false);
  });

  it('cacheManifestMatches false when schemaVersion differs', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    const changed = makeCacheManifestInput({ schemaVersion: 2 });
    expect(cacheManifestMatches(manifest, changed)).toBe(false);
  });

  it('cacheManifestMatches false when effectiveConfigurationId differs', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    const changed = makeCacheManifestInput({ effectiveConfigurationId: 'cfg-2' });
    expect(cacheManifestMatches(manifest, changed)).toBe(false);
  });

  it('cacheManifestMatches false when transformationPolicy differs', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    const changed = makeCacheManifestInput({
      transformationPolicy: { redactSecrets: false, extractTextOnly: true, stripActiveContent: false, reason: 'custom' },
    });
    expect(cacheManifestMatches(manifest, changed)).toBe(false);
  });

  it('cacheManifestMatches false when sourceIdentity differs', () => {
    const input = makeCacheManifestInput();
    const manifest = buildCacheManifest(input);
    const changed = makeCacheManifestInput({ sourceIdentity: '/workspace/other.txt' });
    expect(cacheManifestMatches(manifest, changed)).toBe(false);
  });

  it('input order [A,B] vs [B,A] produces different digest', () => {
    const inputAB = makeCacheManifestInput({
      semanticInputs: [
        { mediaType: 'text/plain', contentHash: 'hash-a' },
        { mediaType: 'image/png', contentHash: 'hash-b' },
      ],
    });
    const inputBA = makeCacheManifestInput({
      semanticInputs: [
        { mediaType: 'image/png', contentHash: 'hash-b' },
        { mediaType: 'text/plain', contentHash: 'hash-a' },
      ],
    });

    const digestAB = computeCacheManifestDigest(inputAB);
    const digestBA = computeCacheManifestDigest(inputBA);
    expect(digestAB).not.toBe(digestBA);
  });
});

// ---------------------------------------------------------------------------
// Tests: projection
// ---------------------------------------------------------------------------

describe('projectReusedEvidence', () => {
  it('returns reuseState reused with original observation time and cacheId', () => {
    const result = makeResult();
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      cacheManifestDigest: 'cm-digest-123',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    const projection = projectReusedEvidence(evidence);
    expect(projection.reuseState).toBe('reused');
    expect(projection.originalObservationTime).toBe(FIXED_TIME);
    expect(projection.cacheId).toBe('cm-digest-123');
    expect(projection.provenance).toEqual(PROVENANCE);
    expect(projection.completeness).toBe('complete');
  });

  it('cacheId is empty string when no cacheManifestDigest', () => {
    const result = makeResult();
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    const projection = projectReusedEvidence(evidence);
    expect(projection.cacheId).toBe('');
  });
});

describe('projectFreshEvidence', () => {
  it('returns reuseState fresh with observation time', () => {
    const result = makeResult();
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    const projection = projectFreshEvidence(evidence);
    expect(projection.reuseState).toBe('fresh');
    expect(projection.observationTime).toBe(FIXED_TIME);
    expect(projection.provenance).toEqual(PROVENANCE);
    expect(projection.completeness).toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// Tests: repository
// ---------------------------------------------------------------------------

describe('InMemoryEvidenceRepository', () => {
  it('store then load by id returns same frozen record', async () => {
    const repo = new InMemoryEvidenceRepository();
    const result = makeResult();
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    await repo.store(evidence);
    const loaded = await repo.load(evidence.id);

    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    // Same object reference (frozen, stored as-is)
    expect(loaded.evidence).toBe(evidence);
    expect(Object.isFrozen(loaded.evidence)).toBe(true);
  });

  it('has returns true for stored id', async () => {
    const repo = new InMemoryEvidenceRepository();
    const result = makeResult();
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    await repo.store(evidence);
    expect(await repo.has(evidence.id)).toBe(true);
    expect(await repo.has('nonexistent')).toBe(false);
  });

  it('load unknown id returns not-found', async () => {
    const repo = new InMemoryEvidenceRepository();
    const loaded = await repo.load('nonexistent-id');
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.cause).toBe('not-found');
  });

  it('list returns all stored records', async () => {
    const repo = new InMemoryEvidenceRepository();
    const result1 = makeResult();
    const result2 = makeResult({ sourceContentHash: 'hash-2' });

    const e1 = sealSpecialistEvidence({
      outcome: result1,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });
    const e2 = sealSpecialistEvidence({
      outcome: result2,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    await repo.store(e1);
    await repo.store(e2);

    const all = await repo.list();
    expect(all).toHaveLength(2);
    expect(all).toContain(e1);
    expect(all).toContain(e2);
  });

  it('store is idempotent — same id overwrites with identical record', async () => {
    const repo = new InMemoryEvidenceRepository();
    const result = makeResult();
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    await repo.store(evidence);
    await repo.store(evidence); // second store with same record

    const loaded = await repo.load(evidence.id);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.evidence).toBe(evidence);
  });
});

// ---------------------------------------------------------------------------
// Tests: completeness states
// ---------------------------------------------------------------------------

describe('completeness states', () => {
  it('result with omissions produces sanitized-with-omissions', () => {
    const result = makeResult({
      fields: {
        text: { kind: 'text', value: 'sk-abc123def456ghij', present: true },
      },
    });
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    expect(evidence.completeness).toBe('sanitized-with-omissions');
  });

  it('failure produces failed', () => {
    const failure = makeFailure();
    const evidence = sealSpecialistEvidence({
      outcome: failure,
      configurationGenerationId: 'gen-1',
      serviceIdentity: SERVICE_IDENTITY,
      consentReference: CONSENT_REF,
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    expect(evidence.completeness).toBe('failed');
  });

  it('result with empty fields but no omissions is still complete', () => {
    const result = makeResult({
      fields: {
        text: { kind: 'text', value: 'Hello', present: true },
      },
      emptyFields: ['optional_field'],
    });
    const evidence = sealSpecialistEvidence({
      outcome: result,
      configurationGenerationId: 'gen-1',
      observationTime: FIXED_TIME,
      displayTime: FIXED_TIME,
    });

    expect(evidence.completeness).toBe('complete');
  });
});
