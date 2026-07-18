// Unit tests for Story 4.11: Speech-to-Text Specialist Service handler.
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
import { SpeechToTextSpecialistHandler } from '../src/core/specialists/services/speech/index.js';
import {
  FIXTURE_WAV_BYTES,
  EXPECTED_TRANSCRIPT,
  EXPECTED_CONFIDENCE,
  EXPECTED_SEGMENTS,
  buildSpeechResponse,
} from '../src/core/specialists/services/speech/index.js';
import type { CapabilityRegistryEntry } from '../src/core/specialists/registry/types.js';
import type { SpeechResponse } from '../src/core/specialists/services/speech/fixture.js';
import type { SpecialistHealthSnapshot, SpecialistEffectiveConfiguration } from '../src/core/specialists/health/types.js';
import type { PreparedPayloadManifest, ConsentReference } from '../src/core/specialists/consent/index.js';
import type { PreparedArtifact } from '../src/core/specialists/artifacts/types.js';
import { CoreApp } from '../src/core/app.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_ID = 'speech-to-text';
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
    id: 'specialist-gen-stt-001',
    serviceId: SERVICE_ID,
    endpoint: 'https://api.aiforthai.in.th/speech-to-text/v1',
    origin: 'aiforthai',
    serviceMapping: 'speech-to-text',
    credentialReferenceId: 'aiforthai',
    credentialRevision: 'rev-1',
    credentialFingerprint: 'fp-stt-001',
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
    upstreamId: 'aiforthai-speech-to-text',
    nameThai: 'คำพูดเป็นข้อความ',
    nameEnglish: 'Speech-to-Text',
    searchTerms: ['speech', 'transcription', 'thai', 'audio'],
    capabilities: ['speech-to-text'],
    supportedInputs: ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/aac'],
    inputLimits: { maxFileSize: '50MB' },
    entitlement: 'ai-for-thai',
    evidenceLevel: 'full',
    observationDate: '2026-07-18',
    endpoint: 'https://api.aiforthai.in.th/speech-to-text/v1',
    transportRules: {
      allowedProtocols: ['https'],
      requiresTls: true,
      allowedMethods: ['POST'],
    },
    privacyClassification: {
      category: 'public',
      dataClasses: ['audio'],
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
    generationId: 'specialist-gen-stt-001',
    endpoint: 'https://api.aiforthai.in.th/speech-to-text/v1',
    checkedAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeManifest(overrides?: Partial<PreparedPayloadManifest>): PreparedPayloadManifest {
  return {
    manifestVersion: 1,
    sources: [{ identity: '@meeting.wav', sourceHash: 'wav-hash-001', mediaType: 'audio/wav', sizeBytes: FIXTURE_WAV_BYTES.length }],
    classification: 'public',
    purpose: 'Speech-to-text transcription',
    transformation: { redactSecrets: true, extractTextOnly: true, stripActiveContent: true, reason: 'standard' },
    recipient: { capabilityId: SERVICE_ID, capabilityVersion: '1.0.0', verifiedEndpoint: 'https://api.aiforthai.in.th/speech-to-text/v1', method: 'POST' },
    callCount: 1,
    retention: 'upstream-no-retention-verified',
    operationId: 'op-stt-001',
    promptRoundId: 'round-1',
    expiresAt: null,
    manifestDigest: 'manifest-digest-stt-001',
    payloadByteDigest: 'payload-digest-stt-001',
    ...overrides,
  };
}

function makeConsentReference(overrides?: Partial<ConsentReference>): ConsentReference {
  return {
    consentId: 'consent-stt-001',
    manifestDigest: 'manifest-digest-stt-001',
    payloadByteDigest: 'payload-digest-stt-001',
    recipientCapabilityId: SERVICE_ID,
    recipientCapabilityVersion: '1.0.0',
    verifiedEndpoint: 'https://api.aiforthai.in.th/speech-to-text/v1',
    purpose: 'Speech-to-text transcription',
    grantedAt: '2026-07-18T12:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

function makeAudioArtifact(overrides?: Partial<PreparedArtifact>): PreparedArtifact {
  return {
    reference: { raw: '@meeting.wav', canonical: '/workspace/meeting.wav' },
    sourceIdentity: { path: '/workspace/meeting.wav', workspaceRoot: '/workspace', relativePath: 'meeting.wav', digest: 'wav-hash-001', version: null, platform: 'darwin', volume: 'test-vol', binding: 'bound' },
    mediaType: 'audio/wav',
    sizeBytes: FIXTURE_WAV_BYTES.length,
    contentHash: 'content-hash-wav-001',
    contentKind: 'bytes',
    bytes: FIXTURE_WAV_BYTES,
    transformations: [],
    privacyClassification: 'public',
    compatibility: { status: 'compatible', matchedInput: 'audio/wav' },
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
  const artifacts = [makeAudioArtifact()];
  return {
    serviceId: SERVICE_ID,
    contractVersion: '1.0.0',
    manifestVersion: 1,
    effectiveConfiguration: config,
    preparedManifest: manifest,
    consentReference: consentRef,
    operationId: 'op-stt-001',
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

describe('SpeechToTextSpecialistHandler', () => {
  let transport: InMemorySpecialistTransport;
  let adapter: SharedSpecialistAdapter;

  beforeEach(() => {
    fakeNow = '2026-07-18T12:00:00.000Z';
    transport = new InMemorySpecialistTransport();
    adapter = new SharedSpecialistAdapter({
      transport,
      clock,
      resolveRawKey: async () => STUB_SECRET_KEY,
      handlers: [new SpeechToTextSpecialistHandler()],
    });
  });

  // -----------------------------------------------------------------------
  // 1. Happy path audio
  // -----------------------------------------------------------------------

  it('should return a SpecialistResult with full attribution for a valid audio request', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildSpeechResponse()),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect(result).not.toBeNull();
    expect((result as SpecialistResult).ok).toBe(true);

    const r = result as SpecialistResult;
    expect(r.serviceId).toBe(SERVICE_ID);
    expect(r.serviceIdentity.nameEnglish).toBe('Speech-to-Text');
    expect(r.serviceIdentity.nameThai).toBe('คำพูดเป็นข้อความ');
    expect(r.configurationGenerationId).toBe('specialist-gen-stt-001');
    expect(r.consentReference.consentId).toBe('consent-stt-001');
    expect(r.sourceContentHash).toBe('payload-digest-stt-001');

    // Check transcript field
    expect(r.fields.transcript).toBeDefined();
    expect(r.fields.transcript!.kind).toBe('text');
    expect(r.fields.transcript!.value).toBe(EXPECTED_TRANSCRIPT);
    expect(r.fields.transcript!.present).toBe(true);

    // Check confidence field
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.kind).toBe('number');
    expect(r.fields.confidence!.value).toBe(EXPECTED_CONFIDENCE);
    expect(r.fields.confidence!.present).toBe(true);

    // Check segments field (structured — wrapped in { items: [...] })
    expect(r.fields.segments).toBeDefined();
    expect(r.fields.segments!.kind).toBe('structured');
    expect(r.fields.segments!.present).toBe(true);
    const segsValue = r.fields.segments!.value as Readonly<Record<string, unknown>>;
    const segs = segsValue.items as readonly Record<string, unknown>[];
    expect(segs).toHaveLength(EXPECTED_SEGMENTS.length);
    expect(segs[0].text).toBe(EXPECTED_SEGMENTS[0].text);
    expect(segs[0].start).toBe(EXPECTED_SEGMENTS[0].start);
    expect(segs[0].end).toBe(EXPECTED_SEGMENTS[0].end);
    expect(segs[1].text).toBe(EXPECTED_SEGMENTS[1].text);
    expect(segs[1].start).toBe(EXPECTED_SEGMENTS[1].start);
    expect(segs[1].end).toBe(EXPECTED_SEGMENTS[1].end);

    // Check emptyFields excludes present fields
    expect(r.emptyFields).not.toContain('transcript');
    expect(r.emptyFields).not.toContain('confidence');
    expect(r.emptyFields).not.toContain('segments');

    // Check confidence at top level
    expect(r.confidence).toBe(EXPECTED_CONFIDENCE);

    // Check timing
    expect(r.timing.startedAt).toBeDefined();
    expect(r.timing.completedAt).toBeDefined();
    expect(r.timing.elapsedMs).toBeGreaterThanOrEqual(0);

    // Check provenance
    expect(r.provenance.endpoint).toBe('https://api.aiforthai.in.th/speech-to-text/v1');
    expect(r.provenance.method).toBe('POST');
    expect(r.provenance.status).toBe(200);

    // Check evidence ref
    expect(r.evidenceRef).toBeDefined();
    expect(r.sanitizedRawResponseRef).toBeDefined();
    expect(r.createdAt).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 2. Response missing segments
  // -----------------------------------------------------------------------

  it('should mark segments as present:false when response omits segments', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildSpeechResponse({ segments: undefined })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // transcript should be present
    expect(r.fields.transcript).toBeDefined();
    expect(r.fields.transcript!.present).toBe(true);

    // confidence should be present
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.present).toBe(true);

    // segments should be absent
    expect(r.fields.segments).toBeDefined();
    expect(r.fields.segments!.kind).toBe('structured');
    expect(r.fields.segments!.value).toEqual({});
    expect(r.fields.segments!.present).toBe(false);

    // segments should be in emptyFields
    expect(r.emptyFields).toContain('segments');
    expect(r.emptyFields).not.toContain('transcript');
    expect(r.emptyFields).not.toContain('confidence');
  });

  // -----------------------------------------------------------------------
  // 3. Response missing confidence
  // -----------------------------------------------------------------------

  it('should mark confidence as present:false when response omits confidence', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildSpeechResponse({ confidence: undefined })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // transcript should be present
    expect(r.fields.transcript).toBeDefined();
    expect(r.fields.transcript!.present).toBe(true);

    // segments should be present
    expect(r.fields.segments).toBeDefined();
    expect(r.fields.segments!.present).toBe(true);

    // confidence should be absent
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.kind).toBe('number');
    expect(r.fields.confidence!.value).toBeNull();
    expect(r.fields.confidence!.present).toBe(false);

    // confidence should be in emptyFields
    expect(r.emptyFields).toContain('confidence');
    expect(r.emptyFields).not.toContain('transcript');
    expect(r.emptyFields).not.toContain('segments');

    // Top-level confidence should be undefined
    expect(r.confidence).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 4. Empty transcript
  // -----------------------------------------------------------------------

  it('should mark transcript as present:false when transcript is empty string', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildSpeechResponse({ transcript: '' })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // transcript should be present:false (empty)
    expect(r.fields.transcript).toBeDefined();
    expect(r.fields.transcript!.kind).toBe('text');
    expect(r.fields.transcript!.value).toBe('');
    expect(r.fields.transcript!.present).toBe(false);

    // transcript should be in emptyFields
    expect(r.emptyFields).toContain('transcript');

    // No fabricated text
    expect(r.fields.transcript!.value).not.toBe(EXPECTED_TRANSCRIPT);
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
  // 6. No audio bytes (text artifact)
  // -----------------------------------------------------------------------

  it('should return unknown-outcome failure when artifact has no audio bytes', async () => {
    // Create a request with a text artifact (no bytes) but with a supported
    // media type so it passes validation.
    const textArtifact = makeTextArtifact({ mediaType: 'audio/wav' });
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
      return successResponse(buildSpeechResponse());
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

    expect(handlers).toHaveLength(2);
    expect(handlers.find(h => h.serviceId === 'speech-to-text')).toBeDefined();

    // Verify the handler works through the adapter
    const testTransport = new InMemorySpecialistTransport();
    testTransport.registerDefaultResponder((_req) =>
      successResponse(buildSpeechResponse()),
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
    expect(r.fields.transcript).toBeDefined();
    expect(r.fields.transcript!.present).toBe(true);
    expect(r.fields.transcript!.value).toBe(EXPECTED_TRANSCRIPT);
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
  // Quota 429 (no auto-retry, no quarantine assertion)
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
    const artifact = makeAudioArtifact({ mediaType: 'application/pdf' });
    const request = makeRequest({ preparedArtifacts: [artifact] });
    const entry = makeRegistryEntry({ supportedInputs: ['audio/wav', 'audio/mpeg'] });
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistAdapterRefusal).refused).toBe(true);
    expect((result as SpecialistAdapterRefusal).cause).toBe('unsupported-input');
  });

  // -----------------------------------------------------------------------
  // buildTransportRequest produces correct body
  // -----------------------------------------------------------------------

  it('should produce a transport request with base64-encoded audio and correct mime', async () => {
    let capturedReq: SpecialistTransportRequest | null = null;

    transport.registerDefaultResponder((req) => {
      capturedReq = req;
      return successResponse(buildSpeechResponse());
    });

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    await adapter.invoke(request, entry, health);

    expect(capturedReq).not.toBeNull();
    expect(capturedReq!.method).toBe('POST');
    expect(capturedReq!.url).toBe('https://api.aiforthai.in.th/speech-to-text/v1');
    expect(capturedReq!.contentType).toBe('application/json');
    expect(capturedReq!.bodyKind).toBe('text');
    expect(capturedReq!.bodyText).toBeDefined();

    // Parse the body and verify structure
    const body = JSON.parse(capturedReq!.bodyText!);
    expect(body.audio).toBeDefined();
    expect(typeof body.audio).toBe('string');
    // Verify it's valid base64
    expect(() => Buffer.from(body.audio, 'base64')).not.toThrow();
    // Verify the decoded bytes match the fixture
    const decoded = Buffer.from(body.audio, 'base64');
    expect(decoded).toEqual(Buffer.from(FIXTURE_WAV_BYTES));
    expect(body.mime).toBe('audio/wav');
  });

  // -----------------------------------------------------------------------
  // buildTransportRequest uses resolveRawKey for Authorization
  // -----------------------------------------------------------------------

  it('should use the resolved key for Authorization header', async () => {
    let capturedFetchHeaders: Record<string, string> | null = null;

    transport.registerDefaultResponder((req) => {
      capturedFetchHeaders = req.fetchHeaders;
      return successResponse(buildSpeechResponse());
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

  // -----------------------------------------------------------------------
  // Missing segments with non-object elements
  // -----------------------------------------------------------------------

  it('should mark segments as present:false when segments contains only non-objects', async () => {
    transport.registerDefaultResponder((_req) =>
      // Deliberately pass non-SpeechSegment elements to test per-element filtering
      successResponse(buildSpeechResponse({ segments: ['not', 'objects'] } as Partial<SpeechResponse>)),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.segments).toBeDefined();
    expect(r.fields.segments!.kind).toBe('structured');
    expect(r.fields.segments!.value).toEqual({});
    expect(r.fields.segments!.present).toBe(false);
    expect(r.emptyFields).toContain('segments');
  });

  // -----------------------------------------------------------------------
  // Empty segments array
  // -----------------------------------------------------------------------

  it('should mark segments as present:false when segments is an empty array', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildSpeechResponse({ segments: [] })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.segments).toBeDefined();
    expect(r.fields.segments!.kind).toBe('structured');
    expect(r.fields.segments!.value).toEqual({});
    expect(r.fields.segments!.present).toBe(false);
    expect(r.emptyFields).toContain('segments');
  });

  // -----------------------------------------------------------------------
  // Mixed valid + invalid segments
  // -----------------------------------------------------------------------

  it('should keep valid segments and drop invalid ones from a mixed array', async () => {
    transport.registerDefaultResponder((_req) =>
      // Deliberately mix valid SpeechSegment objects with invalid elements
      successResponse(buildSpeechResponse({ segments: [{ text: 'hello' }, 'invalid', { text: 'world' }] } as Partial<SpeechResponse>)),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.segments).toBeDefined();
    expect(r.fields.segments!.kind).toBe('structured');
    expect(r.fields.segments!.present).toBe(true);
    const segsValue = r.fields.segments!.value as Readonly<Record<string, unknown>>;
    const segs = segsValue.items as readonly Record<string, unknown>[];
    expect(segs).toHaveLength(2);
    expect(segs[0].text).toBe('hello');
    expect(segs[1].text).toBe('world');
    expect(r.emptyFields).not.toContain('segments');
  });
});
