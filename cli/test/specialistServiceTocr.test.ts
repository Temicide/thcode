// Unit tests for Story 4.10: T-OCR Specialist Service handler.
// Offline tests using InMemorySpecialistTransport. Covers every I/O matrix row + AC.

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
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
import { TocrSpecialistHandler } from '../src/core/specialists/services/tocr/index.js';
import {
  FIXTURE_PNG_BYTES,
  EXPECTED_TEXT,
  EXPECTED_CONFIDENCE,
  EXPECTED_WORDS,
  buildTocrResponse,
} from '../src/core/specialists/services/tocr/index.js';
import type { CapabilityRegistryEntry } from '../src/core/specialists/registry/types.js';
import type { SpecialistHealthSnapshot, SpecialistEffectiveConfiguration } from '../src/core/specialists/health/types.js';
import type { PreparedPayloadManifest, ConsentReference } from '../src/core/specialists/consent/index.js';
import type { PreparedArtifact } from '../src/core/specialists/artifacts/types.js';
import { CoreApp } from '../src/core/app.js';
import type { SpecialistTransport } from '../src/core/specialists/adapter/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_ID = 't-ocr';
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
    id: 'specialist-gen-tocr-001',
    serviceId: SERVICE_ID,
    endpoint: 'https://api.aiforthai.in.th/t-ocr/v1',
    origin: 'aiforthai',
    serviceMapping: 't-ocr',
    credentialReferenceId: 'aiforthai',
    credentialRevision: 'rev-1',
    credentialFingerprint: 'fp-tocr-001',
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
    upstreamId: 'aiforthai-t-ocr',
    nameThai: 'ที-โอซีอาร์',
    nameEnglish: 'T-OCR',
    searchTerms: ['ocr', 'thai', 'optical character recognition'],
    capabilities: ['ocr'],
    supportedInputs: ['image/png', 'image/jpeg'],
    inputLimits: { maxFileSize: '10MB' },
    entitlement: 'ai-for-thai',
    evidenceLevel: 'full',
    observationDate: '2026-07-18',
    endpoint: 'https://api.aiforthai.in.th/t-ocr/v1',
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
    generationId: 'specialist-gen-tocr-001',
    endpoint: 'https://api.aiforthai.in.th/t-ocr/v1',
    checkedAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeManifest(overrides?: Partial<PreparedPayloadManifest>): PreparedPayloadManifest {
  return {
    manifestVersion: 1,
    sources: [{ identity: '@receipt.png', sourceHash: 'png-hash-001', mediaType: 'image/png', sizeBytes: FIXTURE_PNG_BYTES.length }],
    classification: 'public',
    purpose: 'OCR processing',
    transformation: { redactSecrets: true, extractTextOnly: true, stripActiveContent: true, reason: 'standard' },
    recipient: { capabilityId: SERVICE_ID, capabilityVersion: '1.0.0', verifiedEndpoint: 'https://api.aiforthai.in.th/t-ocr/v1', method: 'POST' },
    callCount: 1,
    retention: 'upstream-no-retention-verified',
    operationId: 'op-tocr-001',
    promptRoundId: 'round-1',
    expiresAt: null,
    manifestDigest: 'manifest-digest-tocr-001',
    payloadByteDigest: 'payload-digest-tocr-001',
    ...overrides,
  };
}

function makeConsentReference(overrides?: Partial<ConsentReference>): ConsentReference {
  return {
    consentId: 'consent-tocr-001',
    manifestDigest: 'manifest-digest-tocr-001',
    payloadByteDigest: 'payload-digest-tocr-001',
    recipientCapabilityId: SERVICE_ID,
    recipientCapabilityVersion: '1.0.0',
    verifiedEndpoint: 'https://api.aiforthai.in.th/t-ocr/v1',
    purpose: 'OCR processing',
    grantedAt: '2026-07-18T12:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

function makeImageArtifact(overrides?: Partial<PreparedArtifact>): PreparedArtifact {
  return {
    reference: { raw: '@receipt.png', canonical: '/workspace/receipt.png' },
    sourceIdentity: { path: '/workspace/receipt.png', workspaceRoot: '/workspace', relativePath: 'receipt.png', digest: 'png-hash-001', version: null, platform: 'darwin', volume: 'test-vol', binding: 'bound' },
    mediaType: 'image/png',
    sizeBytes: FIXTURE_PNG_BYTES.length,
    contentHash: 'content-hash-png-001',
    contentKind: 'bytes',
    bytes: FIXTURE_PNG_BYTES,
    transformations: [],
    privacyClassification: 'public',
    compatibility: { status: 'compatible', matchedInput: 'image/png' },
    createdAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeTextArtifact(overrides?: Partial<PreparedArtifact>): PreparedArtifact {
  return {
    reference: { raw: '@note.txt', canonical: '/workspace/note.txt' },
    sourceIdentity: { path: '/workspace/note.txt', workspaceRoot: '/workspace', relativePath: 'note.txt', digest: 'txt-hash-001', version: null, platform: 'darwin', volume: 'test-vol', binding: 'bound' },
    mediaType: 'text/plain',
    sizeBytes: 50,
    contentHash: 'content-hash-txt-001',
    contentKind: 'text',
    text: 'Hello, world!',
    transformations: [],
    privacyClassification: 'public',
    compatibility: { status: 'compatible', matchedInput: 'text/plain' },
    createdAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<SpecialistRequest>): SpecialistRequest {
  const config = makeConfig();
  const manifest = makeManifest();
  const consentRef = makeConsentReference();
  const artifacts = [makeImageArtifact()];
  return {
    serviceId: SERVICE_ID,
    contractVersion: '1.0.0',
    manifestVersion: 1,
    effectiveConfiguration: config,
    preparedManifest: manifest,
    consentReference: consentRef,
    operationId: 'op-tocr-001',
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

describe('TocrSpecialistHandler', () => {
  let transport: InMemorySpecialistTransport;
  let adapter: SharedSpecialistAdapter;

  beforeEach(() => {
    fakeNow = '2026-07-18T12:00:00.000Z';
    transport = new InMemorySpecialistTransport();
    adapter = new SharedSpecialistAdapter({
      transport,
      clock,
      resolveRawKey: async () => STUB_SECRET_KEY,
      handlers: [new TocrSpecialistHandler()],
    });
  });

  // -----------------------------------------------------------------------
  // 1. Happy path image
  // -----------------------------------------------------------------------

  it('should return a SpecialistResult with full attribution for a valid image request', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildTocrResponse()),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect(result).not.toBeNull();
    expect((result as SpecialistResult).ok).toBe(true);

    const r = result as SpecialistResult;
    expect(r.serviceId).toBe(SERVICE_ID);
    expect(r.serviceIdentity.nameEnglish).toBe('T-OCR');
    expect(r.serviceIdentity.nameThai).toBe('ที-โอซีอาร์');
    expect(r.configurationGenerationId).toBe('specialist-gen-tocr-001');
    expect(r.consentReference.consentId).toBe('consent-tocr-001');
    expect(r.sourceContentHash).toBe('payload-digest-tocr-001');

    // Check recognizedText field
    expect(r.fields.recognizedText).toBeDefined();
    expect(r.fields.recognizedText!.kind).toBe('text');
    expect(r.fields.recognizedText!.value).toBe(EXPECTED_TEXT);
    expect(r.fields.recognizedText!.present).toBe(true);

    // Check confidence field
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.kind).toBe('number');
    expect(r.fields.confidence!.value).toBe(EXPECTED_CONFIDENCE);
    expect(r.fields.confidence!.present).toBe(true);

    // Check words field
    expect(r.fields.words).toBeDefined();
    expect(r.fields.words!.kind).toBe('list');
    expect(r.fields.words!.value).toEqual([...EXPECTED_WORDS]);
    expect(r.fields.words!.present).toBe(true);

    // Check emptyFields excludes present fields
    expect(r.emptyFields).not.toContain('recognizedText');
    expect(r.emptyFields).not.toContain('confidence');
    expect(r.emptyFields).not.toContain('words');

    // Check confidence at top level
    expect(r.confidence).toBe(EXPECTED_CONFIDENCE);

    // Check timing
    expect(r.timing.startedAt).toBeDefined();
    expect(r.timing.completedAt).toBeDefined();
    expect(r.timing.elapsedMs).toBeGreaterThanOrEqual(0);

    // Check provenance
    expect(r.provenance.endpoint).toBe('https://api.aiforthai.in.th/t-ocr/v1');
    expect(r.provenance.method).toBe('POST');
    expect(r.provenance.status).toBe(200);

    // Check evidence ref
    expect(r.evidenceRef).toBeDefined();
    expect(r.sanitizedRawResponseRef).toBeDefined();
    expect(r.createdAt).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 2. Response missing confidence
  // -----------------------------------------------------------------------

  it('should mark confidence as present:false when response omits confidence', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildTocrResponse({ confidence: undefined })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // recognizedText should be present
    expect(r.fields.recognizedText).toBeDefined();
    expect(r.fields.recognizedText!.present).toBe(true);

    // words should be present
    expect(r.fields.words).toBeDefined();
    expect(r.fields.words!.present).toBe(true);

    // confidence should be absent
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.kind).toBe('number');
    expect(r.fields.confidence!.value).toBeNull();
    expect(r.fields.confidence!.present).toBe(false);

    // confidence should be in emptyFields
    expect(r.emptyFields).toContain('confidence');
    expect(r.emptyFields).not.toContain('recognizedText');
    expect(r.emptyFields).not.toContain('words');

    // Top-level confidence should be undefined
    expect(r.confidence).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 3. Response missing words
  // -----------------------------------------------------------------------

  it('should mark words as present:false when response omits words', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildTocrResponse({ words: undefined })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // recognizedText should be present
    expect(r.fields.recognizedText).toBeDefined();
    expect(r.fields.recognizedText!.present).toBe(true);

    // confidence should be present
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.present).toBe(true);

    // words should be absent
    expect(r.fields.words).toBeDefined();
    expect(r.fields.words!.kind).toBe('list');
    expect(r.fields.words!.value).toEqual([]);
    expect(r.fields.words!.present).toBe(false);

    // words should be in emptyFields
    expect(r.emptyFields).toContain('words');
    expect(r.emptyFields).not.toContain('recognizedText');
    expect(r.emptyFields).not.toContain('confidence');
  });

  // -----------------------------------------------------------------------
  // 4. Empty result text
  // -----------------------------------------------------------------------

  it('should mark recognizedText as present:false when result is empty string', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildTocrResponse({ result: '' })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // recognizedText should be present:false (empty)
    expect(r.fields.recognizedText).toBeDefined();
    expect(r.fields.recognizedText!.kind).toBe('text');
    expect(r.fields.recognizedText!.value).toBe('');
    expect(r.fields.recognizedText!.present).toBe(false);

    // recognizedText should be in emptyFields
    expect(r.emptyFields).toContain('recognizedText');

    // No fabricated text
    expect(r.fields.recognizedText!.value).not.toBe(EXPECTED_TEXT);
  });

  // -----------------------------------------------------------------------
  // 5. Malformed response body
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
  // 6. No image bytes (text artifact)
  // -----------------------------------------------------------------------

  it('should return unknown-outcome failure when artifact has no image bytes', async () => {
    // Create a request with a text artifact (no bytes) but with a supported
    // media type so it passes validation.
    const textArtifact = makeTextArtifact({ mediaType: 'image/png' });
    const request = makeRequest({ preparedArtifacts: [textArtifact] });
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    // The handler throws, adapter catches → unknown-outcome
    expect((result as SpecialistFailure).ok).toBe(false);
    expect((result as SpecialistFailure).category).toBe('unknown-outcome');
    expect((result as SpecialistFailure).retryability).toBe('not-retryable');
  });

  // -----------------------------------------------------------------------
  // 7. Transport timeout
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
  // 8. Unauthorized 401
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
  // 9. Raw key never leaks
  // -----------------------------------------------------------------------

  it('should never leak the raw key in transport request headersSummary, result, or failure', async () => {
    let capturedHeadersSummary: readonly { name: string; value: string }[] | null = null;
    let capturedFetchHeaders: Record<string, string> | null = null;

    transport.registerDefaultResponder((req) => {
      capturedHeadersSummary = req.headersSummary;
      capturedFetchHeaders = req.fetchHeaders;
      return successResponse(buildTocrResponse());
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
  // 10. Handler registered via defaultSpecialistHandlers
  // -----------------------------------------------------------------------

  it('should be registered in defaultSpecialistHandlers and resolvable by the adapter', async () => {
    const { defaultSpecialistHandlers } = await import('../src/core/specialists/services/index.js');
    const handlers = defaultSpecialistHandlers();

    expect(handlers).toHaveLength(3);
    expect(handlers[0].serviceId).toBe(SERVICE_ID);

    // Verify the handler works through the adapter
    const testTransport = new InMemorySpecialistTransport();
    testTransport.registerDefaultResponder((_req) =>
      successResponse(buildTocrResponse()),
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
    expect(r.fields.recognizedText).toBeDefined();
    expect(r.fields.recognizedText!.present).toBe(true);
    expect(r.fields.recognizedText!.value).toBe(EXPECTED_TEXT);
  });

  // -----------------------------------------------------------------------
  // 11. App test seam: setSpecialistTransportForTest
  // -----------------------------------------------------------------------

  it('should accept a transport override via setSpecialistTransportForTest', () => {
    const app = new CoreApp({ clock });
    const testTransport = new InMemorySpecialistTransport();

    // The method should not throw
    expect(() => app.setSpecialistTransportForTest(testTransport)).not.toThrow();

    // Calling it again with null should also work
    expect(() => app.setSpecialistTransportForTest(testTransport)).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // Transport network error
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
  // HTTP 403
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
  // HTTP 404
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
  // HTTP 429
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
  // HTTP 5xx
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
  // Handler not registered
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
  // Non-invokable entry
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
  // Unsupported input
  // -----------------------------------------------------------------------

  it('should refuse with unsupported-input when artifact mediaType is not supported', async () => {
    const artifact = makeImageArtifact({ mediaType: 'application/pdf' });
    const request = makeRequest({ preparedArtifacts: [artifact] });
    const entry = makeRegistryEntry({ supportedInputs: ['image/png', 'image/jpeg'] });
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistAdapterRefusal).refused).toBe(true);
    expect((result as SpecialistAdapterRefusal).cause).toBe('unsupported-input');
  });

  // -----------------------------------------------------------------------
  // buildTransportRequest produces correct body
  // -----------------------------------------------------------------------

  it('should produce a transport request with base64-encoded image and correct mime', async () => {
    let capturedReq: SpecialistTransportRequest | null = null;

    transport.registerDefaultResponder((req) => {
      capturedReq = req;
      return successResponse(buildTocrResponse());
    });

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    await adapter.invoke(request, entry, health);

    expect(capturedReq).not.toBeNull();
    expect(capturedReq!.method).toBe('POST');
    expect(capturedReq!.url).toBe('https://api.aiforthai.in.th/t-ocr/v1');
    expect(capturedReq!.contentType).toBe('application/json');
    expect(capturedReq!.bodyKind).toBe('text');
    expect(capturedReq!.bodyText).toBeDefined();

    // Parse the body and verify structure
    const body = JSON.parse(capturedReq!.bodyText!);
    expect(body.image).toBeDefined();
    expect(typeof body.image).toBe('string');
    // Verify it's valid base64
    expect(() => Buffer.from(body.image, 'base64')).not.toThrow();
    // Verify the decoded bytes match the fixture
    const decoded = Buffer.from(body.image, 'base64');
    expect(decoded).toEqual(Buffer.from(FIXTURE_PNG_BYTES));
    expect(body.mime).toBe('image/png');
  });

  // -----------------------------------------------------------------------
  // buildTransportRequest uses resolveRawKey for Authorization
  // -----------------------------------------------------------------------

  it('should use the resolved key for Authorization header', async () => {
    let capturedFetchHeaders: Record<string, string> | null = null;

    transport.registerDefaultResponder((req) => {
      capturedFetchHeaders = req.fetchHeaders;
      return successResponse(buildTocrResponse());
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
  // Adapter never throws
  // -----------------------------------------------------------------------

  it('should not throw for a valid request', async () => {
    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    await expect(adapter.invoke(request, entry, health)).resolves.toBeDefined();
  });
});
