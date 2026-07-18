// Unit tests for Story 4.13: Named Entity Recognition Specialist Service handler.
// Offline tests using InMemorySpecialistTransport. Covers every I/O matrix row + AC.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SharedSpecialistAdapter,
  InMemorySpecialistTransport,
  type SpecialistRequest,
  type SpecialistResult,
  type SpecialistFailure,
  type SpecialistAdapterRefusal,
  type SpecialistTransportRequest,
  type SpecialistRawResponse,
  type SpecialistTransportResponse,
  type SpecialistFieldValue,
  type SpecialistInvocation,
  type CredentialScope,
} from '../src/core/specialists/adapter/index.js';
import { NerSpecialistHandler } from '../src/core/specialists/services/ner/index.js';
import {
  FIXTURE_NER_TEXT,
  EXPECTED_ENTITY_PERSON,
  EXPECTED_ENTITY_ORG,
  EXPECTED_ENTITY_LOC,
  EXPECTED_ENTITY_PERSON2,
  EXPECTED_ENTITY_LOC2,
  EXPECTED_ENTITIES,
  EXPECTED_CONFIDENCE,
  buildNerResponse,
} from '../src/core/specialists/services/ner/index.js';
import type { CapabilityRegistryEntry } from '../src/core/specialists/registry/types.js';
import type { NerResponse } from '../src/core/specialists/services/ner/fixture.js';
import type { SpecialistHealthSnapshot, SpecialistEffectiveConfiguration } from '../src/core/specialists/health/types.js';
import type { PreparedPayloadManifest, ConsentReference } from '../src/core/specialists/consent/index.js';
import type { PreparedArtifact } from '../src/core/specialists/artifacts/types.js';
import { CoreApp } from '../src/core/app.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_ID = 'named-entity-recognition';
const STUB_SECRET_KEY = 'sk-test-secret-key-1234567890abcdef';

// ---------------------------------------------------------------------------
// Fixed clock for deterministic tests
// ---------------------------------------------------------------------------

let fakeNow = '2026-07-18T12:00:00.000Z';
const clock = (): string => fakeNow;

function advanceClock(ms: number): void {
  const d = new Date(fakeNow);
  d.setMilliseconds(d.getMilliseconds() + ms);
  fakeNow = d.toISOString();
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<SpecialistEffectiveConfiguration>): SpecialistEffectiveConfiguration {
  return {
    id: 'specialist-gen-ner-001',
    serviceId: SERVICE_ID,
    endpoint: 'https://api.aiforthai.in.th/ner/v1',
    origin: 'aiforthai',
    serviceMapping: 'named-entity-recognition',
    credentialReferenceId: 'aiforthai',
    credentialRevision: 'rev-1',
    credentialFingerprint: 'fp-ner-001',
    manifestVersion: 1,
    contractVersion: '1.0.0',
    adapterVersion: '1.0.0',
    transportPolicy: {
      allowedProtocols: ['https'],
      requiresTls: true,
      allowedMethods: ['POST'],
    },
    requestConfig: {
      timeoutMs: 30000,
      maxRetries: 0,
    },
    createdAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeRegistryEntry(overrides?: Partial<CapabilityRegistryEntry>): CapabilityRegistryEntry {
  return {
    id: SERVICE_ID,
    upstreamId: 'aiforthai-ner',
    nameThai: 'การรู้จำเอนทิตี',
    nameEnglish: 'Named Entity Recognition',
    searchTerms: ['ner', 'entity', 'recognition', 'thai', 'name', 'organization', 'location'],
    capabilities: ['named-entity-recognition'],
    supportedInputs: ['text/plain', 'text/markdown'],
    inputLimits: { maxFileSize: '10MB' },
    entitlement: 'ai-for-thai',
    evidenceLevel: 'full',
    observationDate: '2026-07-18',
    endpoint: 'https://api.aiforthai.in.th/ner/v1',
    transportRules: {
      allowedProtocols: ['https'],
      requiresTls: true,
      allowedMethods: ['POST'],
    },
    privacyClassification: {
      category: 'public',
      dataClasses: ['text'],
      requiresConsent: true,
    },
    retentionClassification: {
      policy: 'no-retention',
      providerDeletionSupported: true,
      defaultRetentionDays: null,
    },
    confirmationPolicy: {
      requiresExplicitConsent: true,
      scope: 'transfer',
    },
    manifestVersion: 1,
    contractVersion: '1.0.0',
    adapterVersion: '1.0.0',
    latestContractTestResult: {
      passed: true,
      testedAt: '2026-07-18',
      summary: 'All tests pass',
    },
    invokable: true,
    invokableStateReason: null,
    ...overrides,
  };
}

function makeHealthSnapshot(overrides?: Partial<SpecialistHealthSnapshot>): SpecialistHealthSnapshot {
  return {
    serviceId: SERVICE_ID,
    state: 'available',
    generationId: 'specialist-gen-ner-001',
    endpoint: 'https://api.aiforthai.in.th/ner/v1',
    checkedAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeManifest(overrides?: Partial<PreparedPayloadManifest>): PreparedPayloadManifest {
  return {
    manifestVersion: 1,
    sources: [{ identity: '@notes.md', sourceHash: 'md-hash-001', mediaType: 'text/plain', sizeBytes: FIXTURE_NER_TEXT.length }],
    classification: 'public',
    purpose: 'Extract named entities from Thai text',
    transformation: { redactSecrets: true, extractTextOnly: true, stripActiveContent: true, reason: 'standard' },
    recipient: { capabilityId: SERVICE_ID, capabilityVersion: '1.0.0', verifiedEndpoint: 'https://api.aiforthai.in.th/ner/v1', method: 'POST' },
    callCount: 1,
    retention: 'upstream-no-retention-verified',
    operationId: 'op-ner-001',
    promptRoundId: 'round-1',
    expiresAt: null,
    manifestDigest: 'manifest-digest-ner-001',
    payloadByteDigest: 'payload-digest-ner-001',
    ...overrides,
  };
}

function makeConsentReference(overrides?: Partial<ConsentReference>): ConsentReference {
  return {
    consentId: 'consent-ner-001',
    manifestDigest: 'manifest-digest-ner-001',
    payloadByteDigest: 'payload-digest-ner-001',
    recipientCapabilityId: SERVICE_ID,
    recipientCapabilityVersion: '1.0.0',
    verifiedEndpoint: 'https://api.aiforthai.in.th/ner/v1',
    purpose: 'Extract named entities from Thai text',
    grantedAt: '2026-07-18T12:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

function makeTextArtifact(overrides?: Partial<PreparedArtifact>): PreparedArtifact {
  return {
    reference: { raw: '@notes.md', canonical: '/workspace/notes.md' },
    sourceIdentity: { path: '/workspace/notes.md', workspaceRoot: '/workspace', relativePath: 'notes.md', digest: 'md-hash-001', version: null, platform: 'darwin', volume: 'test-vol', binding: 'bound' },
    mediaType: 'text/plain',
    sizeBytes: FIXTURE_NER_TEXT.length,
    contentHash: 'content-hash-ner-001',
    contentKind: 'text',
    text: FIXTURE_NER_TEXT,
    transformations: [],
    privacyClassification: 'public',
    compatibility: { status: 'compatible', matchedInput: 'text/plain' },
    createdAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeExtractedTextArtifact(overrides?: Partial<PreparedArtifact>): PreparedArtifact {
  return {
    reference: { raw: '@notes.md', canonical: '/workspace/notes.md' },
    sourceIdentity: { path: '/workspace/notes.md', workspaceRoot: '/workspace', relativePath: 'notes.md', digest: 'md-hash-001', version: null, platform: 'darwin', volume: 'test-vol', binding: 'bound' },
    mediaType: 'text/markdown',
    sizeBytes: FIXTURE_NER_TEXT.length,
    contentHash: 'content-hash-ner-extracted-001',
    contentKind: 'text',
    extractedText: FIXTURE_NER_TEXT,
    transformations: [{ type: 'extract-text', description: 'Markdown text extraction' }],
    privacyClassification: 'public',
    compatibility: { status: 'compatible', matchedInput: 'text/markdown' },
    createdAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<SpecialistRequest>): SpecialistRequest {
  const config = makeConfig();
  const manifest = makeManifest();
  const consentRef = makeConsentReference();
  const artifacts = [makeTextArtifact()];
  return {
    serviceId: SERVICE_ID,
    contractVersion: '1.0.0',
    manifestVersion: 1,
    effectiveConfiguration: config,
    preparedManifest: manifest,
    consentReference: consentRef,
    operationId: 'op-ner-001',
    preparedArtifacts: artifacts,
    options: { timeoutMs: 30000, maxRetries: 0 },
    startedAt: clock(),
    ...overrides,
  } as SpecialistRequest;
}

// ---------------------------------------------------------------------------
// Helper: build transport responses
// ---------------------------------------------------------------------------

function successResponse(body: Record<string, unknown>, status = 200): SpecialistTransportResponse {
  return {
    ok: true,
    raw: {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headersSafe: [{ name: 'content-type', value: 'application/json' }],
      bodyText: JSON.stringify(body),
      elapsedMs: 100,
      completedAt: clock(),
    },
  };
}

function errorResponse(
  kind: 'timeout' | 'network' | 'aborted',
  message: string,
): SpecialistTransportResponse {
  return {
    ok: false,
    transportError: { kind, message, elapsedMs: 100 },
  };
}

function rawResponse(overrides: Partial<SpecialistRawResponse> & { status: number }): SpecialistTransportResponse {
  return {
    ok: true,
    raw: {
      status: overrides.status,
      statusText: overrides.statusText ?? 'Error',
      headersSafe: overrides.headersSafe ?? [],
      bodyText: overrides.bodyText ?? '',
      elapsedMs: overrides.elapsedMs ?? 100,
      completedAt: overrides.completedAt ?? clock(),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NerSpecialistHandler', () => {
  let transport: InMemorySpecialistTransport;
  let adapter: SharedSpecialistAdapter;

  beforeEach(() => {
    fakeNow = '2026-07-18T12:00:00.000Z';
    transport = new InMemorySpecialistTransport();
    adapter = new SharedSpecialistAdapter({
      transport,
      clock,
      resolveRawKey: async () => STUB_SECRET_KEY,
      handlers: [new NerSpecialistHandler()],
    });
  });

  // -----------------------------------------------------------------------
  // 1. Happy path — entities with offsets
  // -----------------------------------------------------------------------

  it('should return a SpecialistResult with all entities for a valid text request', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildNerResponse()),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect(result).not.toBeNull();
    expect((result as SpecialistResult).ok).toBe(true);

    const r = result as SpecialistResult;
    expect(r.serviceId).toBe(SERVICE_ID);
    expect(r.serviceIdentity.nameEnglish).toBe('Named Entity Recognition');
    expect(r.serviceIdentity.nameThai).toBe('การรู้จำเอนทิตี');
    expect(r.configurationGenerationId).toBe('specialist-gen-ner-001');
    expect(r.consentReference.consentId).toBe('consent-ner-001');
    expect(r.sourceContentHash).toBe('payload-digest-ner-001');

    // Check entities field (structured — wrapped in { items: [...] })
    expect(r.fields.entities).toBeDefined();
    expect(r.fields.entities!.kind).toBe('structured');
    expect(r.fields.entities!.present).toBe(true);
    const entitiesValue = r.fields.entities!.value as Readonly<Record<string, unknown>>;
    const entities = entitiesValue.items as readonly Record<string, unknown>[];
    expect(entities).toHaveLength(EXPECTED_ENTITIES.length);

    // Verify verbatim content with offsets preserved
    expect(entities[0].text).toBe(EXPECTED_ENTITY_PERSON.text);
    expect(entities[0].label).toBe(EXPECTED_ENTITY_PERSON.label);
    expect(entities[0].offset).toBe(EXPECTED_ENTITY_PERSON.offset);

    expect(entities[1].text).toBe(EXPECTED_ENTITY_ORG.text);
    expect(entities[1].label).toBe(EXPECTED_ENTITY_ORG.label);
    expect(entities[1].offset).toBe(EXPECTED_ENTITY_ORG.offset);

    expect(entities[2].text).toBe(EXPECTED_ENTITY_LOC.text);
    expect(entities[2].label).toBe(EXPECTED_ENTITY_LOC.label);
    expect(entities[2].offset).toBe(EXPECTED_ENTITY_LOC.offset);

    expect(entities[3].text).toBe(EXPECTED_ENTITY_PERSON2.text);
    expect(entities[3].label).toBe(EXPECTED_ENTITY_PERSON2.label);
    expect(entities[3].offset).toBe(EXPECTED_ENTITY_PERSON2.offset);

    expect(entities[4].text).toBe(EXPECTED_ENTITY_LOC2.text);
    expect(entities[4].label).toBe(EXPECTED_ENTITY_LOC2.label);
    expect(entities[4].offset).toBe(EXPECTED_ENTITY_LOC2.offset);

    // Check confidence field
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.kind).toBe('number');
    expect(r.fields.confidence!.value).toBe(EXPECTED_CONFIDENCE);
    expect(r.fields.confidence!.present).toBe(true);

    // Check emptyFields excludes present fields
    expect(r.emptyFields).not.toContain('entities');
    expect(r.emptyFields).not.toContain('confidence');

    // Check confidence at top level
    expect(r.confidence).toBe(EXPECTED_CONFIDENCE);

    // Check timing
    expect(r.timing.startedAt).toBeDefined();
    expect(r.timing.completedAt).toBeDefined();
    expect(r.timing.elapsedMs).toBeGreaterThanOrEqual(0);

    // Check provenance
    expect(r.provenance.endpoint).toBe('https://api.aiforthai.in.th/ner/v1');
    expect(r.provenance.method).toBe('POST');
    expect(r.provenance.status).toBe(200);

    // Check evidence ref
    expect(r.evidenceRef).toBeDefined();
    expect(r.sanitizedRawResponseRef).toBeDefined();
    expect(r.createdAt).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 2. Entities without offsets
  // -----------------------------------------------------------------------

  it('should keep entities verbatim when offsets are not provided', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildNerResponse({
        entities: [
          { text: 'สมชาย ใจดี', label: 'PERSON' },
          { text: 'ไทยเทค จำกัด', label: 'ORGANIZATION' },
        ],
      })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.entities).toBeDefined();
    expect(r.fields.entities!.kind).toBe('structured');
    expect(r.fields.entities!.present).toBe(true);
    const entitiesValue = r.fields.entities!.value as Readonly<Record<string, unknown>>;
    const entities = entitiesValue.items as readonly Record<string, unknown>[];
    expect(entities).toHaveLength(2);

    // Entities kept verbatim — no offset field fabricated
    expect(entities[0].text).toBe('สมชาย ใจดี');
    expect(entities[0].label).toBe('PERSON');
    expect(entities[0]).not.toHaveProperty('offset');

    expect(entities[1].text).toBe('ไทยเทค จำกัด');
    expect(entities[1].label).toBe('ORGANIZATION');
    expect(entities[1]).not.toHaveProperty('offset');
  });

  // -----------------------------------------------------------------------
  // 3. Missing confidence
  // -----------------------------------------------------------------------

  it('should mark confidence as present:false when response omits confidence', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildNerResponse({ confidence: undefined })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // Entities should be present
    expect(r.fields.entities).toBeDefined();
    expect(r.fields.entities!.present).toBe(true);

    // confidence should be absent
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.kind).toBe('number');
    expect(r.fields.confidence!.value).toBeNull();
    expect(r.fields.confidence!.present).toBe(false);

    // confidence should be in emptyFields
    expect(r.emptyFields).toContain('confidence');
    expect(r.emptyFields).not.toContain('entities');

    // Top-level confidence should be undefined
    expect(r.confidence).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 4. Empty entities (present:false, no fabrication)
  // -----------------------------------------------------------------------

  it('should mark entities as present:false when entities array is empty', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildNerResponse({ entities: [] })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.entities).toBeDefined();
    expect(r.fields.entities!.kind).toBe('structured');
    expect(r.fields.entities!.value).toEqual({});
    expect(r.fields.entities!.present).toBe(false);
    expect(r.emptyFields).toContain('entities');

    // No fabricated entities
    const entitiesValue = r.fields.entities!.value as Readonly<Record<string, unknown>>;
    expect(entitiesValue.items).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 5. Mixed valid+invalid entities (valid kept, invalid dropped)
  // -----------------------------------------------------------------------

  it('should keep valid entities and drop invalid ones from a mixed array', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildNerResponse({
        entities: [
          { text: 'สมชาย ใจดี', label: 'PERSON', offset: 3 },
          'invalid-string-element',
          { text: 12345, label: 'NUMBER' },
          { text: 'ไทยเทค จำกัด', label: 'ORGANIZATION', offset: 28 },
          null,
          { text: '', label: 'EMPTY' },
        ],
      })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.entities).toBeDefined();
    expect(r.fields.entities!.kind).toBe('structured');
    expect(r.fields.entities!.present).toBe(true);
    const entitiesValue = r.fields.entities!.value as Readonly<Record<string, unknown>>;
    const entities = entitiesValue.items as readonly Record<string, unknown>[];
    // Valid entities: {text:'สมชาย ใจดี',label:'PERSON'}, {text:'ไทยเทค จำกัด',label:'ORGANIZATION'}, {text:'',label:'EMPTY'}
    // Invalid: 'invalid-string-element' (not object), {text:12345,label:'NUMBER'} (text not string), null
    expect(entities).toHaveLength(3);
    expect(entities[0].text).toBe('สมชาย ใจดี');
    expect(entities[0].label).toBe('PERSON');
    expect(entities[0].offset).toBe(3);
    expect(entities[1].text).toBe('ไทยเทค จำกัด');
    expect(entities[1].label).toBe('ORGANIZATION');
    expect(entities[1].offset).toBe(28);
    // Empty string text is still a string — kept verbatim
    expect(entities[2].text).toBe('');
    expect(entities[2].label).toBe('EMPTY');
    expect(r.emptyFields).not.toContain('entities');
  });

  // -----------------------------------------------------------------------
  // 6. Malformed response body
  // -----------------------------------------------------------------------

  it('should return malformed-response failure for non-JSON body', async () => {
    transport.registerDefaultResponder((_req) =>
      rawResponse({ status: 200, bodyText: 'not-json' }),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('malformed-response');
    expect((result as SpecialistFailure).retryability).toBe('not-retryable');
    expect((result as SpecialistFailure).causeCode).toBe('parse-failed');
  });

  it('should return malformed-response failure for empty body', async () => {
    transport.registerDefaultResponder((_req) =>
      rawResponse({ status: 200, bodyText: '' }),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('malformed-response');
    expect((result as SpecialistFailure).causeCode).toBe('parse-failed');
  });

  it('should return malformed-response failure for JSON array body', async () => {
    transport.registerDefaultResponder((_req) =>
      rawResponse({ status: 200, bodyText: '["not", "an", "object"]' }),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('malformed-response');
    expect((result as SpecialistFailure).causeCode).toBe('parse-failed');
  });

  // -----------------------------------------------------------------------
  // 7. No text artifact
  // -----------------------------------------------------------------------

  it('should return unknown-outcome failure when artifact has no text or extractedText', async () => {
    // Create a request with a text/plain artifact that has no text or extractedText
    const noTextArtifact: PreparedArtifact = {
      reference: { raw: '@notes.md', canonical: '/workspace/notes.md' },
      sourceIdentity: { path: '/workspace/notes.md', workspaceRoot: '/workspace', relativePath: 'notes.md', digest: 'md-hash-001', version: null, platform: 'darwin', volume: 'test-vol', binding: 'bound' },
      mediaType: 'text/plain',
      sizeBytes: 0,
      contentHash: 'content-hash-empty-001',
      contentKind: 'text',
      text: '',
      transformations: [],
      privacyClassification: 'public',
      compatibility: { status: 'compatible', matchedInput: 'text/plain' },
      createdAt: '2026-07-18T12:00:00.000Z',
    };
    const request = makeRequest({ preparedArtifacts: [noTextArtifact] });
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    // The handler throws, adapter catches → unknown-outcome
    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('unknown-outcome');
    expect((result as SpecialistFailure).retryability).toBe('not-retryable');
  });

  // -----------------------------------------------------------------------
  // 8. Transport timeout
  // -----------------------------------------------------------------------

  it('should return timeout failure for transport timeout', async () => {
    transport.registerDefaultResponder((_req) => errorResponse('timeout', 'Request timed out'));

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('timeout');
    expect((result as SpecialistFailure).retryability).toBe('retryable');
    expect((result as SpecialistFailure).causeCode).toBe('transport-timeout');
  });

  // -----------------------------------------------------------------------
  // 9. Unauthorized 401
  // -----------------------------------------------------------------------

  it('should return unauthorized failure for HTTP 401', async () => {
    transport.registerDefaultResponder((_req) => rawResponse({ status: 401, bodyText: 'Unauthorized' }));

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('unauthorized');
    expect((result as SpecialistFailure).retryability).toBe('not-retryable');
    expect((result as SpecialistFailure).causeCode).toBe('http-401');
  });

  // -----------------------------------------------------------------------
  // 10. Non-finite confidence (1e999 → present:false)
  // -----------------------------------------------------------------------

  it('should mark confidence as present:false when confidence is non-finite (1e999)', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildNerResponse({ confidence: 1e999 })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // Entities should be present
    expect(r.fields.entities).toBeDefined();
    expect(r.fields.entities!.present).toBe(true);

    // confidence should be absent (Infinity not stored)
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.kind).toBe('number');
    expect(r.fields.confidence!.value).toBeNull();
    expect(r.fields.confidence!.present).toBe(false);

    // confidence should be in emptyFields
    expect(r.emptyFields).toContain('confidence');

    // Top-level confidence should be undefined
    expect(r.confidence).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 11. Raw key never leaks
  // -----------------------------------------------------------------------

  it('should never leak the raw key in transport request headersSummary, result, or failure', async () => {
    let capturedHeadersSummary: readonly { name: string; value: string }[] | null = null;
    let capturedFetchHeaders: Record<string, string> | null = null;

    transport.registerDefaultResponder((req) => {
      capturedHeadersSummary = req.headersSummary;
      capturedFetchHeaders = req.fetchHeaders;
      return successResponse(buildNerResponse());
    });

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    // Check headersSummary is secret-free
    expect(capturedHeadersSummary).not.toBeNull();
    const headersJson = JSON.stringify(capturedHeadersSummary);
    expect(headersJson).not.toContain('Bearer');
    expect(headersJson).not.toContain(STUB_SECRET_KEY);
    expect(headersJson).not.toContain('sk-');
    expect(headersJson).toContain('[redacted]');

    // Check fetchHeaders has the real key (for the wire call only)
    expect(capturedFetchHeaders).not.toBeNull();
    expect(capturedFetchHeaders!.Authorization).toBe(`Bearer ${STUB_SECRET_KEY}`);

    // Check result is secret-free
    const resultJson = JSON.stringify(result);
    expect(resultJson).not.toContain('Bearer');
    expect(resultJson).not.toContain(STUB_SECRET_KEY);
    expect(resultJson).not.toContain('sk-');

    // Assert fetchHeaders is never serialized into the result (AD-11)
    expect(resultJson).not.toContain('fetchHeaders');
  });

  // -----------------------------------------------------------------------
  // 12. Handler registered via defaultSpecialistHandlers (by serviceId, not index)
  // -----------------------------------------------------------------------

  it('should be registered in defaultSpecialistHandlers and resolvable by the adapter via find by serviceId', async () => {
    const { defaultSpecialistHandlers } = await import('../src/core/specialists/services/index.js');
    const handlers = defaultSpecialistHandlers();

    // Assert count is 4 (all launch services wired)
    expect(handlers).toHaveLength(4);

    // Find by serviceId — NOT by index
    const nerHandler = handlers.find(h => h.serviceId === 'named-entity-recognition');
    expect(nerHandler).toBeDefined();
    expect(nerHandler!.serviceId).toBe('named-entity-recognition');

    // Verify the handler works through the adapter
    const testTransport = new InMemorySpecialistTransport();
    testTransport.registerDefaultResponder((_req) =>
      successResponse(buildNerResponse()),
    );

    const testAdapter = new SharedSpecialistAdapter({
      transport: testTransport,
      clock,
      resolveRawKey: async () => STUB_SECRET_KEY,
      handlers,
    });

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await testAdapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;
    expect(r.serviceId).toBe(SERVICE_ID);
    expect(r.fields.entities).toBeDefined();
    expect(r.fields.entities!.present).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 13. Transport network error
  // -----------------------------------------------------------------------

  it('should return transport failure for network error', async () => {
    transport.registerDefaultResponder((_req) => errorResponse('network', 'Network unreachable'));

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('transport');
    expect((result as SpecialistFailure).retryability).toBe('retryable');
    expect((result as SpecialistFailure).causeCode).toBe('transport-network');
  });

  // -----------------------------------------------------------------------
  // 14. HTTP 403
  // -----------------------------------------------------------------------

  it('should return forbidden failure for HTTP 403', async () => {
    transport.registerDefaultResponder((_req) => rawResponse({ status: 403, bodyText: 'Forbidden' }));

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('forbidden');
    expect((result as SpecialistFailure).retryability).toBe('not-retryable');
    expect((result as SpecialistFailure).causeCode).toBe('http-403');
  });

  // -----------------------------------------------------------------------
  // 15. HTTP 404
  // -----------------------------------------------------------------------

  it('should return not-found failure for HTTP 404', async () => {
    transport.registerDefaultResponder((_req) => rawResponse({ status: 404, bodyText: 'Not Found' }));

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('not-found');
    expect((result as SpecialistFailure).retryability).toBe('not-retryable');
    expect((result as SpecialistFailure).causeCode).toBe('http-404');
  });

  // -----------------------------------------------------------------------
  // 16. HTTP 429
  // -----------------------------------------------------------------------

  it('should return rate-limited failure for HTTP 429', async () => {
    transport.registerDefaultResponder((_req) => rawResponse({ status: 429, bodyText: 'Rate limited' }));

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('rate-limited');
    expect((result as SpecialistFailure).retryability).toBe('retryable');
    expect((result as SpecialistFailure).causeCode).toBe('http-429');
  });

  // -----------------------------------------------------------------------
  // 17. HTTP 5xx
  // -----------------------------------------------------------------------

  it('should return server-error failure for HTTP 500', async () => {
    transport.registerDefaultResponder((_req) => rawResponse({ status: 500, bodyText: 'Internal Server Error' }));

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('server-error');
    expect((result as SpecialistFailure).retryability).toBe('retryable');
    expect((result as SpecialistFailure).causeCode).toBe('http-500');
  });

  // -----------------------------------------------------------------------
  // 18. Handler not registered
  // -----------------------------------------------------------------------

  it('should refuse with handler-not-registered when no handler is registered', async () => {
    const adapterNoHandler = new SharedSpecialistAdapter({
      transport,
      clock,
      resolveRawKey: async () => STUB_SECRET_KEY,
    });

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapterNoHandler.invoke(request, entry, health);

    expect((result as SpecialistAdapterRefusal).refused).toBe(true);
    expect((result as SpecialistAdapterRefusal).cause).toBe('handler-not-registered');
  });

  // -----------------------------------------------------------------------
  // 19. Non-invokable entry
  // -----------------------------------------------------------------------

  it('should refuse with non-invokable-entry when entry is not invokable', async () => {
    const request = makeRequest();
    const entry = makeRegistryEntry({ invokable: false, invokableStateReason: 'Service under maintenance' });
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistAdapterRefusal).refused).toBe(true);
    expect((result as SpecialistAdapterRefusal).cause).toBe('non-invokable-entry');
  });

  // -----------------------------------------------------------------------
  // 20. Unsupported input
  // -----------------------------------------------------------------------

  it('should refuse with unsupported-input when artifact mediaType is not supported', async () => {
    const artifact = makeTextArtifact({ mediaType: 'image/png' });
    const request = makeRequest({ preparedArtifacts: [artifact] });
    const entry = makeRegistryEntry({ supportedInputs: ['text/plain', 'text/markdown'] });
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistAdapterRefusal).refused).toBe(true);
    expect((result as SpecialistAdapterRefusal).cause).toBe('unsupported-input');
  });

  // -----------------------------------------------------------------------
  // 21. buildTransportRequest produces correct body
  // -----------------------------------------------------------------------

  it('should produce a transport request with text body and correct content type', async () => {
    let capturedReq: SpecialistTransportRequest | null = null;

    transport.registerDefaultResponder((req) => {
      capturedReq = req;
      return successResponse(buildNerResponse());
    });

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    await adapter.invoke(request, entry, health);

    expect(capturedReq).not.toBeNull();
    expect(capturedReq!.method).toBe('POST');
    expect(capturedReq!.url).toBe('https://api.aiforthai.in.th/ner/v1');
    expect(capturedReq!.contentType).toBe('application/json');
    expect(capturedReq!.bodyKind).toBe('text');
    expect(capturedReq!.bodyText).toBeDefined();

    // Parse the body and verify structure — only {text} in the body
    const body = JSON.parse(capturedReq!.bodyText!);
    expect(body.text).toBeDefined();
    expect(typeof body.text).toBe('string');
    expect(body.text).toBe(FIXTURE_NER_TEXT);
    // Only the NER task schema enters the request
    expect(Object.keys(body)).toEqual(['text']);
  });

  // -----------------------------------------------------------------------
  // 22. buildTransportRequest uses resolveRawKey for Authorization
  // -----------------------------------------------------------------------

  it('should use the resolved key for Authorization header', async () => {
    let capturedFetchHeaders: Record<string, string> | null = null;

    transport.registerDefaultResponder((req) => {
      capturedFetchHeaders = req.fetchHeaders;
      return successResponse(buildNerResponse());
    });

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    await adapter.invoke(request, entry, health);

    expect(capturedFetchHeaders).not.toBeNull();
    expect(capturedFetchHeaders!.Authorization).toBe(`Bearer ${STUB_SECRET_KEY}`);
    expect(capturedFetchHeaders!['Content-Type']).toBe('application/json');
  });

  // -----------------------------------------------------------------------
  // 23. Adapter never throws
  // -----------------------------------------------------------------------

  it('should not throw for a valid request', async () => {
    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    await expect(adapter.invoke(request, entry, health)).resolves.toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 24. extractedText fallback (Markdown extracted content)
  // -----------------------------------------------------------------------

  it('should read from extractedText when text is not available', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildNerResponse()),
    );

    // Use an artifact with extractedText but no text field
    const extractedArtifact = makeExtractedTextArtifact();
    const request = makeRequest({ preparedArtifacts: [extractedArtifact] });
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;
    expect(r.fields.entities).toBeDefined();
    expect(r.fields.entities!.present).toBe(true);
    const entitiesValue = r.fields.entities!.value as Readonly<Record<string, unknown>>;
    const entities = entitiesValue.items as readonly Record<string, unknown>[];
    expect(entities).toHaveLength(EXPECTED_ENTITIES.length);
  });

  // -----------------------------------------------------------------------
  // 25. Null entities (non-array → present:false)
  // -----------------------------------------------------------------------

  it('should mark entities as present:false when entities is null', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildNerResponse({ entities: null })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.entities).toBeDefined();
    expect(r.fields.entities!.kind).toBe('structured');
    expect(r.fields.entities!.value).toEqual({});
    expect(r.fields.entities!.present).toBe(false);
    expect(r.emptyFields).toContain('entities');
  });

  // -----------------------------------------------------------------------
  // 26. Missing entities key
  // -----------------------------------------------------------------------

  it('should mark entities as present:false when entities key is missing from response', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse({ confidence: 0.85 }),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.entities).toBeDefined();
    expect(r.fields.entities!.kind).toBe('structured');
    expect(r.fields.entities!.value).toEqual({});
    expect(r.fields.entities!.present).toBe(false);
    expect(r.emptyFields).toContain('entities');
  });

  // -----------------------------------------------------------------------
  // 27. App test seam: setSpecialistTransportForTest
  // -----------------------------------------------------------------------

  it('should accept a transport override via setSpecialistTransportForTest', () => {
    const app = new CoreApp({ clock });
    const testTransport = new InMemorySpecialistTransport();

    // The method should not throw
    expect(() => app.setSpecialistTransportForTest(testTransport)).not.toThrow();

    // Calling it again (re-override) should also work
    expect(() => app.setSpecialistTransportForTest(testTransport)).not.toThrow();
  });
});
