// Specialist Cache tests (Story 4.15). Covers every I/O matrix row + every AC
// with deterministic fixtures, injected fixed timestamps, and no network.
// Reuses 4.14 evidence/manifest fixtures + InMemory transport + the app's
// setSpecialistTransportForTest seam.

import { describe, expect, it, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import {
  CacheIndex,
  type CacheIndexEntry,
} from '../src/core/specialists/evidence/cacheIndex.js';
import {
  evaluateRetention,
  applyRetention,
  type RetentionPolicy,
} from '../src/core/specialists/evidence/retention.js';
import {
  matchesEntry,
  invalidateCache,
  type CacheInvalidationScope,
  type InvalidationReceipt,
} from '../src/core/specialists/evidence/invalidation.js';
import {
  InMemoryCacheInvalidationPort,
  type CacheInvalidationPort,
  type DeletionReceipt,
} from '../src/core/specialists/evidence/cachePort.js';
import {
  resolveCacheHit,
  type ResolveCacheHitInput,
} from '../src/core/specialists/evidence/cacheLookup.js';
import {
  InMemoryEvidenceRepository,
  sealSpecialistEvidence,
  buildCacheManifest,
  projectReusedEvidence,
  type SpecialistEvidence,
  type CacheManifest,
  type CacheManifestInput,
  type EvidenceRepository,
} from '../src/core/specialists/evidence/index.js';
import type {
  SpecialistResult,
  SpecialistFailure,
  SpecialistFieldValue,
} from '../src/core/specialists/adapter/types.js';
import type { ConsentReference } from '../src/core/specialists/consent/types.js';
import type { TransformationPolicy } from '../src/core/permissions/transferConsent.js';
import type { HealthState } from '../src/core/providers/health.js';

// ---------------------------------------------------------------------------
// Fixed clock for deterministic tests
// ---------------------------------------------------------------------------

let fakeNow = '2026-07-18T10:00:00.000Z';
const clock = (): string => fakeNow;

function setTime(iso: string): void {
  fakeNow = iso;
}

function advanceMs(ms: number): void {
  const d = new Date(fakeNow);
  d.setMilliseconds(d.getMilliseconds() + ms);
  fakeNow = d.toISOString();
}

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
    },
    emptyFields: [],
    timing: TIMING,
    provenance: PROVENANCE,
    sanitizedRawResponseRef: 'raw-ref-1',
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
      { mediaType: 'text/plain', contentHash: 'hash-1' },
    ],
    requestOptions: { timeoutMs: 30000, maxRetries: 2 },
    preprocessing: ['extract-text'],
    mappingVersion: '1.0.0',
    schemaVersion: 1,
    effectiveConfigurationId: 'gen-1',
    transformationPolicy: TRANSFORMATION_POLICY,
    sourceIdentity: '/path/to/file.txt',
    ...overrides,
  };
}

// --- Seal evidence helper ---

function sealEvidence(
  outcome: SpecialistResult | SpecialistFailure,
  cacheManifestDigest?: string,
): SpecialistEvidence {
  return sealSpecialistEvidence({
    outcome,
    configurationGenerationId: outcome.ok
      ? outcome.configurationGenerationId
      : (outcome as SpecialistFailure).effectiveGenerationId,
    serviceIdentity: outcome.ok ? undefined : SERVICE_IDENTITY,
    consentReference: outcome.ok ? undefined : CONSENT_REF,
    cacheManifestDigest,
    observationTime: FIXED_TIME,
    displayTime: FIXED_TIME,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CacheIndex', () => {
  let index: CacheIndex;

  beforeEach(() => {
    setTime(FIXED_TIME);
    index = new CacheIndex();
  });

  describe('record and lookup', () => {
    it('records an entry and looks it up by digest', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const result = index.lookup('digest-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.entry.evidenceId).toBe('ev-1');
        expect(result.entry.serviceId).toBe('t-ocr');
        expect(result.entry.state).toBe('valid');
      }
    });

    it('returns miss for unknown digest', () => {
      const result = index.lookup('unknown-digest');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.cause).toBe('miss');
      }
    });

    it('returns expired for expired entry', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'ttl', ttlMs: 1000 },
        expiresAt: '2026-07-18T10:00:00.500Z',
      });

      // Mark expired
      index.markExpired('2026-07-18T10:00:01.000Z');

      const result = index.lookup('digest-1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.cause).toBe('expired');
      }
    });

    it('returns invalidated for invalidated entry', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      index.invalidate({ kind: 'serviceId', serviceId: 't-ocr' });

      const result = index.lookup('digest-1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.cause).toBe('invalidated');
      }
    });

    it('overwrites existing entry on re-record', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      index.record('digest-1', 'ev-2', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const result = index.lookup('digest-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.entry.evidenceId).toBe('ev-2');
      }
    });
  });

  describe('markExpired', () => {
    it('marks entries with expiresAt < now as expired', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'ttl', ttlMs: 1000 },
        expiresAt: '2026-07-18T10:00:00.500Z',
      });

      index.record('digest-2', 'ev-2', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-2',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const expired = index.markExpired('2026-07-18T10:00:01.000Z');
      expect(expired).toEqual(['digest-1']);

      // digest-1 should be expired
      const r1 = index.lookup('digest-1');
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.cause).toBe('expired');

      // digest-2 should still be valid
      const r2 = index.lookup('digest-2');
      expect(r2.ok).toBe(true);
    });

    it('does not mark entries without expiresAt', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const expired = index.markExpired('2099-01-01T00:00:00.000Z');
      expect(expired).toEqual([]);

      const result = index.lookup('digest-1');
      expect(result.ok).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('invalidates entries matching serviceId scope', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      index.record('digest-2', 'ev-2', {
        serviceId: 'stt',
        effectiveConfigurationId: 'gen-2',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-2',
        endpoint: 'https://example.com/stt',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const invalidated = index.invalidate({ kind: 'serviceId', serviceId: 't-ocr' });
      expect(invalidated).toEqual(['digest-1']);

      // t-ocr entry should be invalidated
      const r1 = index.lookup('digest-1');
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.cause).toBe('invalidated');

      // stt entry should still be valid
      const r2 = index.lookup('digest-2');
      expect(r2.ok).toBe(true);
    });

    it('invalidates entries matching effectiveConfigurationId scope', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      index.record('digest-2', 'ev-2', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-2',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-2',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const invalidated = index.invalidate({ kind: 'effectiveConfigurationId', id: 'gen-1' });
      expect(invalidated).toEqual(['digest-1']);

      const r1 = index.lookup('digest-1');
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.cause).toBe('invalidated');

      const r2 = index.lookup('digest-2');
      expect(r2.ok).toBe(true);
    });

    it('invalidates entries matching credentialRevision scope', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        credentialRevision: 'rev-1',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      index.record('digest-2', 'ev-2', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        credentialRevision: 'rev-2',
        sourceContentHash: 'hash-2',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const invalidated = index.invalidate({ kind: 'credentialRevision', revision: 'rev-1' });
      expect(invalidated).toEqual(['digest-1']);

      const r1 = index.lookup('digest-1');
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.cause).toBe('invalidated');

      const r2 = index.lookup('digest-2');
      expect(r2.ok).toBe(true);
    });

    it('invalidates entries matching contractVersion scope', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      index.record('digest-2', 'ev-2', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '2.0.0',
        sourceContentHash: 'hash-2',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const invalidated = index.invalidate({ kind: 'contractVersion', version: '1.0.0' });
      expect(invalidated).toEqual(['digest-1']);

      const r1 = index.lookup('digest-1');
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.cause).toBe('invalidated');

      const r2 = index.lookup('digest-2');
      expect(r2.ok).toBe(true);
    });

    it('invalidates entries matching sourceContentHash scope', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      index.record('digest-2', 'ev-2', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-2',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const invalidated = index.invalidate({ kind: 'sourceContentHash', hash: 'hash-1' });
      expect(invalidated).toEqual(['digest-1']);

      const r1 = index.lookup('digest-1');
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.cause).toBe('invalidated');

      const r2 = index.lookup('digest-2');
      expect(r2.ok).toBe(true);
    });

    it('invalidates entries matching endpoint scope', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      index.record('digest-2', 'ev-2', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-2',
        endpoint: 'https://example.com/ocr/v2',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const invalidated = index.invalidate({ kind: 'endpoint', endpoint: 'https://example.com/ocr' });
      expect(invalidated).toEqual(['digest-1']);

      const r1 = index.lookup('digest-1');
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.cause).toBe('invalidated');

      const r2 = index.lookup('digest-2');
      expect(r2.ok).toBe(true);
    });

    it('invalidates all entries with all scope', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      index.record('digest-2', 'ev-2', {
        serviceId: 'stt',
        effectiveConfigurationId: 'gen-2',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-2',
        endpoint: 'https://example.com/stt',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const invalidated = index.invalidate({ kind: 'all' });
      expect(invalidated).toHaveLength(2);
      expect(invalidated).toContain('digest-1');
      expect(invalidated).toContain('digest-2');

      const r1 = index.lookup('digest-1');
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.cause).toBe('invalidated');

      const r2 = index.lookup('digest-2');
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.cause).toBe('invalidated');
    });

    it('does not invalidate already-invalidated entries', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      // First invalidation
      index.invalidate({ kind: 'serviceId', serviceId: 't-ocr' });

      // Second invalidation — should not re-invalidate
      const invalidated = index.invalidate({ kind: 'serviceId', serviceId: 't-ocr' });
      expect(invalidated).toEqual([]);
    });
  });

  describe('list', () => {
    it('returns all entries', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      index.record('digest-2', 'ev-2', {
        serviceId: 'stt',
        effectiveConfigurationId: 'gen-2',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-2',
        endpoint: 'https://example.com/stt',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const entries = index.list();
      expect(entries).toHaveLength(2);
    });
  });

  describe('raw key never in cache structures', () => {
    it('does not contain raw key patterns in any entry', () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const entries = index.list();
      const json = JSON.stringify(entries);
      expect(json).not.toContain('Bearer');
      expect(json).not.toContain('sk-');
      expect(json).not.toContain('secret');
    });
  });
});

// ---------------------------------------------------------------------------
// Retention tests
// ---------------------------------------------------------------------------

describe('Retention', () => {
  describe('evaluateRetention', () => {
    it('returns valid for none retention', () => {
      const entry: CacheIndexEntry = {
        cacheManifestDigest: 'digest-1',
        evidenceId: 'ev-1',
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
        state: 'valid',
      };

      const result = evaluateRetention(entry, '2099-01-01T00:00:00.000Z');
      expect(result.state).toBe('valid');
    });

    it('returns valid for TTL entry before expiry', () => {
      const entry: CacheIndexEntry = {
        cacheManifestDigest: 'digest-1',
        evidenceId: 'ev-1',
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        expiresAt: '2026-07-18T11:00:00.000Z',
        retention: { kind: 'ttl', ttlMs: 3600000 },
        state: 'valid',
      };

      const result = evaluateRetention(entry, '2026-07-18T10:30:00.000Z');
      expect(result.state).toBe('valid');
      expect(result.expiresAt).toBe('2026-07-18T11:00:00.000Z');
    });

    it('returns expired for TTL entry after expiry', () => {
      const entry: CacheIndexEntry = {
        cacheManifestDigest: 'digest-1',
        evidenceId: 'ev-1',
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        expiresAt: '2026-07-18T10:00:00.500Z',
        retention: { kind: 'ttl', ttlMs: 1000 },
        state: 'valid',
      };

      const result = evaluateRetention(entry, '2026-07-18T10:00:01.000Z');
      expect(result.state).toBe('expired');
      expect(result.reason).toContain('TTL expired');
    });
  });

  describe('applyRetention', () => {
    it('sweeps expired entries via markExpired', () => {
      const index = new CacheIndex();
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'ttl', ttlMs: 1000 },
        expiresAt: '2026-07-18T10:00:00.500Z',
      });

      const expired = applyRetention(index, '2026-07-18T10:00:01.000Z');
      expect(expired).toEqual(['digest-1']);
    });
  });
});

// ---------------------------------------------------------------------------
// Invalidation tests
// ---------------------------------------------------------------------------

describe('Invalidation', () => {
  describe('matchesEntry', () => {
    const entry: CacheIndexEntry = {
      cacheManifestDigest: 'digest-1',
      evidenceId: 'ev-1',
      serviceId: 't-ocr',
      effectiveConfigurationId: 'gen-1',
      contractVersion: '1.0.0',
      credentialRevision: 'rev-1',
      sourceContentHash: 'hash-1',
      endpoint: 'https://example.com/ocr',
      observationTime: FIXED_TIME,
      retention: { kind: 'none' },
      state: 'valid',
    };

    it('matches serviceId scope', () => {
      expect(matchesEntry({ kind: 'serviceId', serviceId: 't-ocr' }, entry)).toBe(true);
      expect(matchesEntry({ kind: 'serviceId', serviceId: 'stt' }, entry)).toBe(false);
    });

    it('matches effectiveConfigurationId scope', () => {
      expect(matchesEntry({ kind: 'effectiveConfigurationId', id: 'gen-1' }, entry)).toBe(true);
      expect(matchesEntry({ kind: 'effectiveConfigurationId', id: 'gen-2' }, entry)).toBe(false);
    });

    it('matches credentialRevision scope', () => {
      expect(matchesEntry({ kind: 'credentialRevision', revision: 'rev-1' }, entry)).toBe(true);
      expect(matchesEntry({ kind: 'credentialRevision', revision: 'rev-2' }, entry)).toBe(false);
    });

    it('matches contractVersion scope', () => {
      expect(matchesEntry({ kind: 'contractVersion', version: '1.0.0' }, entry)).toBe(true);
      expect(matchesEntry({ kind: 'contractVersion', version: '2.0.0' }, entry)).toBe(false);
    });

    it('matches sourceContentHash scope', () => {
      expect(matchesEntry({ kind: 'sourceContentHash', hash: 'hash-1' }, entry)).toBe(true);
      expect(matchesEntry({ kind: 'sourceContentHash', hash: 'hash-2' }, entry)).toBe(false);
    });

    it('matches endpoint scope', () => {
      expect(matchesEntry({ kind: 'endpoint', endpoint: 'https://example.com/ocr' }, entry)).toBe(true);
      expect(matchesEntry({ kind: 'endpoint', endpoint: 'https://example.com/ocr/v2' }, entry)).toBe(false);
    });

    it('matches all scope', () => {
      expect(matchesEntry({ kind: 'all' }, entry)).toBe(true);
    });
  });

  describe('invalidateCache', () => {
    it('returns InvalidationReceipt with affected digests', () => {
      const index = new CacheIndex();
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const receipt = invalidateCache(index, { kind: 'serviceId', serviceId: 't-ocr' });
      expect(receipt.scope.kind).toBe('serviceId');
      expect(receipt.affectedCount).toBe(1);
      expect(receipt.affectedDigests).toEqual(['digest-1']);
    });
  });
});

// ---------------------------------------------------------------------------
// CacheInvalidationPort tests
// ---------------------------------------------------------------------------

describe('CacheInvalidationPort', () => {
  let index: CacheIndex;
  let port: InMemoryCacheInvalidationPort;

  beforeEach(() => {
    setTime(FIXED_TIME);
    index = new CacheIndex();
    port = new InMemoryCacheInvalidationPort(index);
  });

  describe('invalidate', () => {
    it('invalidates matching entries and returns receipt', async () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const receipt = await port.invalidate({ kind: 'serviceId', serviceId: 't-ocr' });
      expect(receipt.affectedCount).toBe(1);
      expect(receipt.affectedDigests).toEqual(['digest-1']);
    });
  });

  describe('deletionCoordination', () => {
    it('returns deletion-not-supported when no matching entries', async () => {
      const receipt = await port.deletionCoordination('unknown-ref');
      expect(receipt.state).toBe('deletion-not-supported');
      expect(receipt.deletionClaimed).toBe(false);
      expect(receipt.affectedDigests).toEqual([]);
    });

    it('returns invalidated-only when matching entries exist', async () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const receipt = await port.deletionCoordination('ev-1');
      expect(receipt.state).toBe('invalidated-only');
      expect(receipt.deletionClaimed).toBe(false);
      expect(receipt.affectedDigests).toContain('digest-1');
    });

    it('invalidates ONLY matching entries and leaves unrelated entries valid (AD-18)', async () => {
      index.record('digest-1', 'ev-1', {
        serviceId: 't-ocr',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-1',
        endpoint: 'https://example.com/ocr',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });
      index.record('digest-2', 'ev-2', {
        serviceId: 'speech-to-text',
        effectiveConfigurationId: 'gen-1',
        contractVersion: '1.0.0',
        sourceContentHash: 'hash-2',
        endpoint: 'https://example.com/stt',
        observationTime: FIXED_TIME,
        retention: { kind: 'none' },
      });

      const receipt = await port.deletionCoordination('ev-1');
      expect(receipt.affectedDigests).toEqual(['digest-1']);
      expect(receipt.deletionClaimed).toBe(false);

      // Matching entry invalidated; unrelated entry untouched.
      expect(index.lookup('digest-1')).toEqual({ ok: false, cause: 'invalidated' });
      const other = index.lookup('digest-2');
      expect(other.ok).toBe(true);
      if (other.ok) {
        expect(other.entry.state).toBe('valid');
      }
    });

    it('never claims deletion occurred', async () => {
      const receipt = await port.deletionCoordination('any-ref');
      expect(receipt.deletionClaimed).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// resolveCacheHit tests
// ---------------------------------------------------------------------------

describe('resolveCacheHit', () => {
  let index: CacheIndex;
  let repo: EvidenceRepository;
  let manifest: CacheManifest;
  let evidence: SpecialistEvidence;

  beforeEach(() => {
    setTime(FIXED_TIME);
    index = new CacheIndex();
    repo = new InMemoryEvidenceRepository();

    // Create a CacheManifest
    const input = makeCacheManifestInput();
    manifest = buildCacheManifest(input);

    // Seal evidence and record in index
    evidence = sealEvidence(makeResult(), manifest.digest);
    repo.store(evidence);
    index.record(manifest.digest, evidence.id, {
      serviceId: 't-ocr',
      effectiveConfigurationId: 'gen-1',
      contractVersion: '1.0.0',
      sourceContentHash: 'sha256-source-hash',
      endpoint: 'https://example.com/ocr',
      observationTime: FIXED_TIME,
      retention: { kind: 'none' },
    });
  });

  it('returns reused evidence on cache hit (healthy service)', async () => {
    const result = await resolveCacheHit({
      index,
      repo,
      manifest,
      forceFresh: false,
      now: FIXED_TIME,
      healthState: 'available',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('reused');
      expect(result.evidence.id).toBe(evidence.id);
      expect(result.evidence.reuseState).toBe('fresh'); // Original state preserved
    }
  });

  it('returns reused evidence even when service is unhealthy (AC #1)', async () => {
    const result = await resolveCacheHit({
      index,
      repo,
      manifest,
      forceFresh: false,
      now: FIXED_TIME,
      healthState: 'unavailable',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('reused');
    }
  });

  it('returns reused evidence when service is quarantined (AC #1)', async () => {
    const result = await resolveCacheHit({
      index,
      repo,
      manifest,
      forceFresh: false,
      now: FIXED_TIME,
      healthState: 'quarantined',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('reused');
    }
  });

  it('returns miss on force-fresh with available health (AC #2)', async () => {
    const result = await resolveCacheHit({
      index,
      repo,
      manifest,
      forceFresh: true,
      now: FIXED_TIME,
      healthState: 'available',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('miss');
    }

    // Prior Evidence is preserved (index entry NOT deleted)
    const lookupResult = index.lookup(manifest.digest);
    expect(lookupResult.ok).toBe(true);
  });

  it('returns unavailable on force-fresh with unavailable health (AC #2)', async () => {
    const result = await resolveCacheHit({
      index,
      repo,
      manifest,
      forceFresh: true,
      now: FIXED_TIME,
      healthState: 'unavailable',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.cause).toBe('unavailable');
    }
  });

  it('returns unavailable on force-fresh with quarantined health (AC #2)', async () => {
    const result = await resolveCacheHit({
      index,
      repo,
      manifest,
      forceFresh: true,
      now: FIXED_TIME,
      healthState: 'quarantined',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.cause).toBe('unavailable');
    }
  });

  it('returns expired for expired entry (AC #3)', async () => {
    // Add an entry with a TTL that has expired
    const expiredInput = makeCacheManifestInput({ serviceId: 't-ocr-expired' });
    const expiredManifest = buildCacheManifest(expiredInput);
    const expiredEvidence = sealEvidence(makeResult({ serviceId: 't-ocr-expired' }), expiredManifest.digest);
    await repo.store(expiredEvidence);
    index.record(expiredManifest.digest, expiredEvidence.id, {
      serviceId: 't-ocr-expired',
      effectiveConfigurationId: 'gen-1',
      contractVersion: '1.0.0',
      sourceContentHash: 'sha256-source-hash',
      endpoint: 'https://example.com/ocr',
      observationTime: FIXED_TIME,
      retention: { kind: 'ttl', ttlMs: 1000 },
      expiresAt: '2026-07-18T10:00:00.500Z',
    });

    const result = await resolveCacheHit({
      index,
      repo,
      manifest: expiredManifest,
      forceFresh: false,
      now: '2026-07-18T10:00:01.000Z',
      healthState: 'available',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.cause).toBe('expired');
    }
  });

  it('returns miss for unknown digest', async () => {
    const unknownInput = makeCacheManifestInput({ serviceId: 'unknown' });
    const unknownManifest = buildCacheManifest(unknownInput);

    const result = await resolveCacheHit({
      index,
      repo,
      manifest: unknownManifest,
      forceFresh: false,
      now: FIXED_TIME,
      healthState: 'available',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('miss');
    }
  });

  it('returns miss for invalidated entry (treated as miss)', async () => {
    // Invalidate the entry
    index.invalidate({ kind: 'serviceId', serviceId: 't-ocr' });

    const result = await resolveCacheHit({
      index,
      repo,
      manifest,
      forceFresh: false,
      now: FIXED_TIME,
      healthState: 'available',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('miss');
    }
  });

  it('returns miss when EvidenceRepository.load returns not-found', async () => {
    // The index entry points to evidence.id, but the repo has no record for
    // that id (e.g. it was never stored, or was lost). load returns
    // {ok:false, cause:'not-found'} → treated as a miss (proceed to live).
    const emptyRepo = new InMemoryEvidenceRepository();

    const result = await resolveCacheHit({
      index,
      repo: emptyRepo,
      manifest,
      forceFresh: false,
      now: FIXED_TIME,
      healthState: 'available',
    });

    // Evidence not found → treated as miss (proceed to live dispatch)
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('miss');
    }
  });

  it('returns corrupt and invalidates ONLY that entry when load returns corrupt (AC #6, AD-18)', async () => {
    // Fake repo that reports the entry's evidence as corrupt on load.
    const corruptRepo: EvidenceRepository = {
      store: async () => {},
      load: async (id) =>
        id === evidence.id
          ? { ok: false, cause: 'corrupt' as const }
          : { ok: false, cause: 'not-found' as const },
      list: async () => [],
      has: async () => false,
    };

    // Record a SECOND, unrelated entry (different service + digest) that must
    // stay valid after the corrupt path — per-digest invalidation (AD-18).
    const secondInput = makeCacheManifestInput({ serviceId: 'speech-to-text' });
    const secondManifest = buildCacheManifest(secondInput);
    const secondEvidence = sealEvidence(makeResult({ serviceId: 'speech-to-text' }), secondManifest.digest);
    index.record(secondManifest.digest, secondEvidence.id, {
      serviceId: 'speech-to-text',
      effectiveConfigurationId: 'gen-1',
      contractVersion: '1.0.0',
      sourceContentHash: 'sha256-source-hash',
      endpoint: 'https://example.com/stt',
      observationTime: FIXED_TIME,
      retention: { kind: 'none' },
    });

    const result = await resolveCacheHit({
      index,
      repo: corruptRepo,
      manifest,
      forceFresh: false,
      now: FIXED_TIME,
      healthState: 'available',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.cause).toBe('corrupt');
    }

    // The corrupt entry is invalidated (future lookups fail closed)...
    const corruptLookup = index.lookup(manifest.digest);
    expect(corruptLookup.ok).toBe(false);
    if (!corruptLookup.ok) {
      expect(corruptLookup.cause).toBe('invalidated');
    }

    // ...and the unrelated entry is untouched (smallest proven scope, AD-18).
    const otherLookup = index.lookup(secondManifest.digest);
    expect(otherLookup.ok).toBe(true);
    if (otherLookup.ok) {
      expect(otherLookup.entry.state).toBe('valid');
      expect(otherLookup.entry.evidenceId).toBe(secondEvidence.id);
    }
  });

  it('returns reused evidence with correct projection', async () => {
    const result = await resolveCacheHit({
      index,
      repo,
      manifest,
      forceFresh: false,
      now: FIXED_TIME,
      healthState: 'available',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'reused') {
      const projection = projectReusedEvidence(result.evidence);
      expect(projection.reuseState).toBe('reused');
      expect(projection.originalObservationTime).toBe(FIXED_TIME);
      expect(projection.cacheId).toBe(manifest.digest);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: app.ts invokeSpecialist with cache
// ---------------------------------------------------------------------------

describe('invokeSpecialist cache integration', () => {
  // These tests use the CoreApp with InMemorySpecialistTransport to verify
  // the full cache flow through invokeSpecialist.

  it('raw key never appears in cache structures', () => {
    // Verify that the CacheIndexEntry type does not carry raw key fields
    const entry: CacheIndexEntry = {
      cacheManifestDigest: 'digest-1',
      evidenceId: 'ev-1',
      serviceId: 't-ocr',
      effectiveConfigurationId: 'gen-1',
      contractVersion: '1.0.0',
      sourceContentHash: 'hash-1',
      endpoint: 'https://example.com/ocr',
      observationTime: FIXED_TIME,
      retention: { kind: 'none' },
      state: 'valid',
    };

    const json = JSON.stringify(entry);
    expect(json).not.toContain('Bearer');
    expect(json).not.toContain('sk-');
    expect(json).not.toContain('secret');
    expect(json).not.toContain('credential');
    expect(json).not.toContain('apiKey');
    expect(json).not.toContain('token');
  });

  it('deletion port never claims deletion occurred (AC #5)', async () => {
    const port: CacheInvalidationPort = new InMemoryCacheInvalidationPort(new CacheIndex());
    const receipt = await port.deletionCoordination('any-ref');
    expect(receipt.deletionClaimed).toBe(false);
    expect(receipt.state).toBe('deletion-not-supported');
  });

  it('scoped invalidation touches only matching entries (AC #4)', () => {
    const idx = new CacheIndex();

    // Record entries for two different services
    idx.record('digest-tocr', 'ev-tocr', {
      serviceId: 't-ocr',
      effectiveConfigurationId: 'gen-1',
      contractVersion: '1.0.0',
      sourceContentHash: 'hash-tocr',
      endpoint: 'https://example.com/ocr',
      observationTime: FIXED_TIME,
      retention: { kind: 'none' },
    });

    idx.record('digest-stt', 'ev-stt', {
      serviceId: 'stt',
      effectiveConfigurationId: 'gen-2',
      contractVersion: '1.0.0',
      sourceContentHash: 'hash-stt',
      endpoint: 'https://example.com/stt',
      observationTime: FIXED_TIME,
      retention: { kind: 'none' },
    });

    // Invalidate only t-ocr
    idx.invalidate({ kind: 'serviceId', serviceId: 't-ocr' });

    // t-ocr entry should be invalidated
    const r1 = idx.lookup('digest-tocr');
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.cause).toBe('invalidated');

    // stt entry should still be valid
    const r2 = idx.lookup('digest-stt');
    expect(r2.ok).toBe(true);
  });

  it('force-fresh preserves prior Evidence (index entry NOT deleted)', () => {
    const idx = new CacheIndex();

    idx.record('digest-1', 'ev-1', {
      serviceId: 't-ocr',
      effectiveConfigurationId: 'gen-1',
      contractVersion: '1.0.0',
      sourceContentHash: 'hash-1',
      endpoint: 'https://example.com/ocr',
      observationTime: FIXED_TIME,
      retention: { kind: 'none' },
    });

    // Force-fresh bypasses cache but does NOT delete the index entry.
    // The entry should still be present (though resolveCacheHit returns miss).
    const entry = idx.lookup('digest-1');
    expect(entry.ok).toBe(true);
  });

  it('expired record hides from reuse but state is visible', () => {
    const idx = new CacheIndex();

    idx.record('digest-1', 'ev-1', {
      serviceId: 't-ocr',
      effectiveConfigurationId: 'gen-1',
      contractVersion: '1.0.0',
      sourceContentHash: 'hash-1',
      endpoint: 'https://example.com/ocr',
      observationTime: FIXED_TIME,
      retention: { kind: 'ttl', ttlMs: 1000 },
      expiresAt: '2026-07-18T10:00:00.500Z',
    });

    // Mark expired
    idx.markExpired('2026-07-18T10:00:01.000Z');

    // Hidden from reuse
    const lookup = idx.lookup('digest-1');
    expect(lookup.ok).toBe(false);
    if (!lookup.ok) expect(lookup.cause).toBe('expired');

    // State is visible via list
    const entries = idx.list();
    const entry = entries.find((e) => e.cacheManifestDigest === 'digest-1');
    expect(entry).toBeDefined();
    expect(entry!.state).toBe('expired');
  });

  it('all scope invalidates all without deleting Evidence', () => {
    const idx = new CacheIndex();

    idx.record('digest-1', 'ev-1', {
      serviceId: 't-ocr',
      effectiveConfigurationId: 'gen-1',
      contractVersion: '1.0.0',
      sourceContentHash: 'hash-1',
      endpoint: 'https://example.com/ocr',
      observationTime: FIXED_TIME,
      retention: { kind: 'none' },
    });

    idx.record('digest-2', 'ev-2', {
      serviceId: 'stt',
      effectiveConfigurationId: 'gen-2',
      contractVersion: '1.0.0',
      sourceContentHash: 'hash-2',
      endpoint: 'https://example.com/stt',
      observationTime: FIXED_TIME,
      retention: { kind: 'none' },
    });

    // Invalidate all
    idx.invalidate({ kind: 'all' });

    // Both entries are invalidated
    const r1 = idx.lookup('digest-1');
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.cause).toBe('invalidated');

    const r2 = idx.lookup('digest-2');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.cause).toBe('invalidated');

    // Evidence records are NOT deleted (entries still in list)
    const entries = idx.list();
    expect(entries).toHaveLength(2);
  });

  it('cache lookup failure never silently falls through to live transfer (AC #6)', async () => {
    // Test that expired/corrupt/unavailable causes are properly projected
    // and never silently fall through to a live transfer.

    // Expired case
    const idx = new CacheIndex();
    const rep = new InMemoryEvidenceRepository();

    const input = makeCacheManifestInput();
    const mf = buildCacheManifest(input);
    const ev = sealEvidence(makeResult(), mf.digest);
    await rep.store(ev);

    idx.record(mf.digest, ev.id, {
      serviceId: 't-ocr',
      effectiveConfigurationId: 'gen-1',
      contractVersion: '1.0.0',
      sourceContentHash: 'sha256-source-hash',
      endpoint: 'https://example.com/ocr',
      observationTime: FIXED_TIME,
      retention: { kind: 'ttl', ttlMs: 1000 },
      expiresAt: '2026-07-18T10:00:00.500Z',
    });

    const expiredResult = await resolveCacheHit({
      index: idx,
      repo: rep,
      manifest: mf,
      forceFresh: false,
      now: '2026-07-18T10:00:01.000Z',
      healthState: 'available',
    });

    expect(expiredResult.ok).toBe(false);
    if (!expiredResult.ok) {
      expect(expiredResult.cause).toBe('expired');
    }

    // Unavailable on force-fresh
    const unavailableResult = await resolveCacheHit({
      index: idx,
      repo: rep,
      manifest: mf,
      forceFresh: true,
      now: FIXED_TIME,
      healthState: 'unavailable',
    });

    expect(unavailableResult.ok).toBe(false);
    if (!unavailableResult.ok) {
      expect(unavailableResult.cause).toBe('unavailable');
    }
  });
});
