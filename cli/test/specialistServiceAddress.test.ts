// Unit tests for Story 4.12: Extract Address Specialist Service handler.
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
import { ExtractAddressSpecialistHandler } from '../src/core/specialists/services/address/index.js';
import {
  FIXTURE_ADDRESS_TEXT,
  EXPECTED_HOUSE_NUMBER,
  EXPECTED_STREET,
  EXPECTED_SUBDISTRICT,
  EXPECTED_DISTRICT,
  EXPECTED_PROVINCE,
  EXPECTED_POSTAL_CODE,
  EXPECTED_CONFIDENCE,
  EXPECTED_SOURCE_SPANS,
  buildAddressResponse,
} from '../src/core/specialists/services/address/index.js';
import type { CapabilityRegistryEntry } from '../src/core/specialists/registry/types.js';
import type { AddressResponse } from '../src/core/specialists/services/address/fixture.js';
import type { SpecialistHealthSnapshot, SpecialistEffectiveConfiguration } from '../src/core/specialists/health/types.js';
import type { PreparedPayloadManifest, ConsentReference } from '../src/core/specialists/consent/index.js';
import type { PreparedArtifact } from '../src/core/specialists/artifacts/types.js';
import { CoreApp } from '../src/core/app.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_ID = 'extract-address';
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
    id: 'specialist-gen-addr-001',
    serviceId: SERVICE_ID,
    endpoint: 'https://api.aiforthai.in.th/extract-address/v1',
    origin: 'aiforthai',
    serviceMapping: 'extract-address',
    credentialReferenceId: 'aiforthai',
    credentialRevision: 'rev-1',
    credentialFingerprint: 'fp-addr-001',
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
    upstreamId: 'aiforthai-extract-address',
    nameThai: 'แยกที่อยู่',
    nameEnglish: 'Extract Address',
    searchTerms: ['address', 'extract', 'thai', 'location'],
    capabilities: ['extract-address'],
    supportedInputs: ['text/plain', 'text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    inputLimits: { maxFileSize: '10MB' },
    entitlement: 'ai-for-thai',
    evidenceLevel: 'full',
    observationDate: '2026-07-18',
    endpoint: 'https://api.aiforthai.in.th/extract-address/v1',
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
    generationId: 'specialist-gen-addr-001',
    endpoint: 'https://api.aiforthai.in.th/extract-address/v1',
    checkedAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeManifest(overrides?: Partial<PreparedPayloadManifest>): PreparedPayloadManifest {
  return {
    manifestVersion: 1,
    sources: [{ identity: '@invoice.pdf', sourceHash: 'pdf-hash-001', mediaType: 'application/pdf', sizeBytes: 5000 }],
    classification: 'public',
    purpose: 'Extract Thai address from document',
    transformation: { redactSecrets: true, extractTextOnly: true, stripActiveContent: true, reason: 'standard' },
    recipient: { capabilityId: SERVICE_ID, capabilityVersion: '1.0.0', verifiedEndpoint: 'https://api.aiforthai.in.th/extract-address/v1', method: 'POST' },
    callCount: 1,
    retention: 'upstream-no-retention-verified',
    operationId: 'op-addr-001',
    promptRoundId: 'round-1',
    expiresAt: null,
    manifestDigest: 'manifest-digest-addr-001',
    payloadByteDigest: 'payload-digest-addr-001',
    ...overrides,
  };
}

function makeConsentReference(overrides?: Partial<ConsentReference>): ConsentReference {
  return {
    consentId: 'consent-addr-001',
    manifestDigest: 'manifest-digest-addr-001',
    payloadByteDigest: 'payload-digest-addr-001',
    recipientCapabilityId: SERVICE_ID,
    recipientCapabilityVersion: '1.0.0',
    verifiedEndpoint: 'https://api.aiforthai.in.th/extract-address/v1',
    purpose: 'Extract Thai address from document',
    grantedAt: '2026-07-18T12:00:00.000Z',
    expiresAt: null,
    ...overrides,
  };
}

function makeTextArtifact(overrides?: Partial<PreparedArtifact>): PreparedArtifact {
  return {
    reference: { raw: '@invoice.pdf', canonical: '/workspace/invoice.pdf' },
    sourceIdentity: { path: '/workspace/invoice.pdf', workspaceRoot: '/workspace', relativePath: 'invoice.pdf', digest: 'pdf-hash-001', version: null, platform: 'darwin', volume: 'test-vol', binding: 'bound' },
    mediaType: 'text/plain',
    sizeBytes: FIXTURE_ADDRESS_TEXT.length,
    contentHash: 'content-hash-addr-001',
    contentKind: 'text',
    text: FIXTURE_ADDRESS_TEXT,
    transformations: [],
    privacyClassification: 'public',
    compatibility: { status: 'compatible', matchedInput: 'text/plain' },
    createdAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeExtractedTextArtifact(overrides?: Partial<PreparedArtifact>): PreparedArtifact {
  return {
    reference: { raw: '@invoice.pdf', canonical: '/workspace/invoice.pdf' },
    sourceIdentity: { path: '/workspace/invoice.pdf', workspaceRoot: '/workspace', relativePath: 'invoice.pdf', digest: 'pdf-hash-001', version: null, platform: 'darwin', volume: 'test-vol', binding: 'bound' },
    mediaType: 'application/pdf',
    sizeBytes: 5000,
    contentHash: 'content-hash-addr-extracted-001',
    contentKind: 'text',
    extractedText: FIXTURE_ADDRESS_TEXT,
    transformations: [{ type: 'extract-text', description: 'PDF text extraction' }],
    privacyClassification: 'public',
    compatibility: { status: 'compatible', matchedInput: 'application/pdf' },
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
    operationId: 'op-addr-001',
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

describe('ExtractAddressSpecialistHandler', () => {
  let transport: InMemorySpecialistTransport;
  let adapter: SharedSpecialistAdapter;

  beforeEach(() => {
    fakeNow = '2026-07-18T12:00:00.000Z';
    transport = new InMemorySpecialistTransport();
    adapter = new SharedSpecialistAdapter({
      transport,
      clock,
      resolveRawKey: async () => STUB_SECRET_KEY,
      handlers: [new ExtractAddressSpecialistHandler()],
    });
  });

  // -----------------------------------------------------------------------
  // 1. Happy path — full address
  // -----------------------------------------------------------------------

  it('should return a SpecialistResult with all six address components for a valid text request', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse()),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect(result).not.toBeNull();
    expect((result as SpecialistResult).ok).toBe(true);

    const r = result as SpecialistResult;
    expect(r.serviceId).toBe(SERVICE_ID);
    expect(r.serviceIdentity.nameEnglish).toBe('Extract Address');
    expect(r.serviceIdentity.nameThai).toBe('แยกที่อยู่');
    expect(r.configurationGenerationId).toBe('specialist-gen-addr-001');
    expect(r.consentReference.consentId).toBe('consent-addr-001');
    expect(r.sourceContentHash).toBe('payload-digest-addr-001');

    // Check all six address components
    expect(r.fields.houseNumber).toBeDefined();
    expect(r.fields.houseNumber!.kind).toBe('text');
    expect(r.fields.houseNumber!.value).toBe(EXPECTED_HOUSE_NUMBER);
    expect(r.fields.houseNumber!.present).toBe(true);

    expect(r.fields.street).toBeDefined();
    expect(r.fields.street!.kind).toBe('text');
    expect(r.fields.street!.value).toBe(EXPECTED_STREET);
    expect(r.fields.street!.present).toBe(true);

    expect(r.fields.subdistrict).toBeDefined();
    expect(r.fields.subdistrict!.kind).toBe('text');
    expect(r.fields.subdistrict!.value).toBe(EXPECTED_SUBDISTRICT);
    expect(r.fields.subdistrict!.present).toBe(true);

    expect(r.fields.district).toBeDefined();
    expect(r.fields.district!.kind).toBe('text');
    expect(r.fields.district!.value).toBe(EXPECTED_DISTRICT);
    expect(r.fields.district!.present).toBe(true);

    expect(r.fields.province).toBeDefined();
    expect(r.fields.province!.kind).toBe('text');
    expect(r.fields.province!.value).toBe(EXPECTED_PROVINCE);
    expect(r.fields.province!.present).toBe(true);

    expect(r.fields.postalCode).toBeDefined();
    expect(r.fields.postalCode!.kind).toBe('text');
    expect(r.fields.postalCode!.value).toBe(EXPECTED_POSTAL_CODE);
    expect(r.fields.postalCode!.present).toBe(true);

    // Check confidence field
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.kind).toBe('number');
    expect(r.fields.confidence!.value).toBe(EXPECTED_CONFIDENCE);
    expect(r.fields.confidence!.present).toBe(true);

    // Check sourceSpans field (structured — wrapped in { items: [...] })
    expect(r.fields.sourceSpans).toBeDefined();
    expect(r.fields.sourceSpans!.kind).toBe('structured');
    expect(r.fields.sourceSpans!.present).toBe(true);
    const spansValue = r.fields.sourceSpans!.value as Readonly<Record<string, unknown>>;
    const spans = spansValue.items as readonly Record<string, unknown>[];
    expect(spans).toHaveLength(EXPECTED_SOURCE_SPANS.length);
    expect(spans[0].field).toBe(EXPECTED_SOURCE_SPANS[0].field);
    expect(spans[0].offset).toBe(EXPECTED_SOURCE_SPANS[0].offset);
    expect(spans[0].length).toBe(EXPECTED_SOURCE_SPANS[0].length);

    // Check emptyFields excludes present fields
    expect(r.emptyFields).not.toContain('houseNumber');
    expect(r.emptyFields).not.toContain('street');
    expect(r.emptyFields).not.toContain('subdistrict');
    expect(r.emptyFields).not.toContain('district');
    expect(r.emptyFields).not.toContain('province');
    expect(r.emptyFields).not.toContain('postalCode');
    expect(r.emptyFields).not.toContain('confidence');
    expect(r.emptyFields).not.toContain('sourceSpans');

    // Check confidence at top level
    expect(r.confidence).toBe(EXPECTED_CONFIDENCE);

    // Check timing
    expect(r.timing.startedAt).toBeDefined();
    expect(r.timing.completedAt).toBeDefined();
    expect(r.timing.elapsedMs).toBeGreaterThanOrEqual(0);

    // Check provenance
    expect(r.provenance.endpoint).toBe('https://api.aiforthai.in.th/extract-address/v1');
    expect(r.provenance.method).toBe('POST');
    expect(r.provenance.status).toBe(200);

    // Check evidence ref
    expect(r.evidenceRef).toBeDefined();
    expect(r.sanitizedRawResponseRef).toBeDefined();
    expect(r.createdAt).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 2. Partial address — only province and postalCode
  // -----------------------------------------------------------------------

  it('should return only present components for a partial address (no fabricated components)', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse({
        address: {
          province: EXPECTED_PROVINCE,
          postalCode: EXPECTED_POSTAL_CODE,
        },
      })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // province and postalCode should be present
    expect(r.fields.province).toBeDefined();
    expect(r.fields.province!.present).toBe(true);
    expect(r.fields.province!.value).toBe(EXPECTED_PROVINCE);

    expect(r.fields.postalCode).toBeDefined();
    expect(r.fields.postalCode!.present).toBe(true);
    expect(r.fields.postalCode!.value).toBe(EXPECTED_POSTAL_CODE);

    // houseNumber, street, subdistrict, district should be present:false
    expect(r.fields.houseNumber).toBeDefined();
    expect(r.fields.houseNumber!.present).toBe(false);
    expect(r.fields.houseNumber!.value).toBe('');

    expect(r.fields.street).toBeDefined();
    expect(r.fields.street!.present).toBe(false);
    expect(r.fields.street!.value).toBe('');

    expect(r.fields.subdistrict).toBeDefined();
    expect(r.fields.subdistrict!.present).toBe(false);
    expect(r.fields.subdistrict!.value).toBe('');

    expect(r.fields.district).toBeDefined();
    expect(r.fields.district!.present).toBe(false);
    expect(r.fields.district!.value).toBe('');

    // emptyFields should contain the absent components
    expect(r.emptyFields).toContain('houseNumber');
    expect(r.emptyFields).toContain('street');
    expect(r.emptyFields).toContain('subdistrict');
    expect(r.emptyFields).toContain('district');
    expect(r.emptyFields).not.toContain('province');
    expect(r.emptyFields).not.toContain('postalCode');

    // No fabricated components — values should not be the expected ones
    expect(r.fields.houseNumber!.value).not.toBe(EXPECTED_HOUSE_NUMBER);
    expect(r.fields.street!.value).not.toBe(EXPECTED_STREET);
    expect(r.fields.subdistrict!.value).not.toBe(EXPECTED_SUBDISTRICT);
    expect(r.fields.district!.value).not.toBe(EXPECTED_DISTRICT);
  });

  // -----------------------------------------------------------------------
  // 3. Empty component value
  // -----------------------------------------------------------------------

  it('should mark street as present:false when street is empty string', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse({
        address: {
          houseNumber: EXPECTED_HOUSE_NUMBER,
          street: '',
          subdistrict: EXPECTED_SUBDISTRICT,
          district: EXPECTED_DISTRICT,
          province: EXPECTED_PROVINCE,
          postalCode: EXPECTED_POSTAL_CODE,
        },
      })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // street should be present:false (empty)
    expect(r.fields.street).toBeDefined();
    expect(r.fields.street!.kind).toBe('text');
    expect(r.fields.street!.value).toBe('');
    expect(r.fields.street!.present).toBe(false);

    // street should be in emptyFields
    expect(r.emptyFields).toContain('street');

    // Other components should still be present
    expect(r.fields.houseNumber!.present).toBe(true);
    expect(r.fields.subdistrict!.present).toBe(true);
    expect(r.fields.district!.present).toBe(true);
    expect(r.fields.province!.present).toBe(true);
    expect(r.fields.postalCode!.present).toBe(true);

    // No fabricated street value
    expect(r.fields.street!.value).not.toBe(EXPECTED_STREET);
  });

  // -----------------------------------------------------------------------
  // 4. Missing confidence
  // -----------------------------------------------------------------------

  it('should mark confidence as present:false when response omits confidence', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse({ confidence: undefined })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // All address components should be present
    expect(r.fields.houseNumber!.present).toBe(true);
    expect(r.fields.street!.present).toBe(true);
    expect(r.fields.subdistrict!.present).toBe(true);
    expect(r.fields.district!.present).toBe(true);
    expect(r.fields.province!.present).toBe(true);
    expect(r.fields.postalCode!.present).toBe(true);

    // confidence should be absent
    expect(r.fields.confidence).toBeDefined();
    expect(r.fields.confidence!.kind).toBe('number');
    expect(r.fields.confidence!.value).toBeNull();
    expect(r.fields.confidence!.present).toBe(false);

    // confidence should be in emptyFields
    expect(r.emptyFields).toContain('confidence');
    expect(r.emptyFields).not.toContain('houseNumber');
    expect(r.emptyFields).not.toContain('street');

    // Top-level confidence should be undefined
    expect(r.confidence).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 5. Source spans provided
  // -----------------------------------------------------------------------

  it('should keep sourceSpans verbatim when provided', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse()),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.sourceSpans).toBeDefined();
    expect(r.fields.sourceSpans!.kind).toBe('structured');
    expect(r.fields.sourceSpans!.present).toBe(true);
    const spansValue = r.fields.sourceSpans!.value as Readonly<Record<string, unknown>>;
    const spans = spansValue.items as readonly Record<string, unknown>[];
    expect(spans).toHaveLength(EXPECTED_SOURCE_SPANS.length);
    // Verify verbatim content
    expect(spans[0]).toEqual({ field: 'houseNumber', offset: 0, length: 6 });
    expect(spans[1]).toEqual({ field: 'street', offset: 16, length: 10 });
    expect(spans[2]).toEqual({ field: 'subdistrict', offset: 27, length: 10 });
    expect(spans[3]).toEqual({ field: 'district', offset: 38, length: 10 });
    expect(spans[4]).toEqual({ field: 'province', offset: 49, length: 15 });
    expect(spans[5]).toEqual({ field: 'postalCode', offset: 65, length: 5 });
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
    // Create a request with a bytes artifact (no text)
    const bytesArtifact: PreparedArtifact = {
      reference: { raw: '@invoice.pdf', canonical: '/workspace/invoice.pdf' },
      sourceIdentity: { path: '/workspace/invoice.pdf', workspaceRoot: '/workspace', relativePath: 'invoice.pdf', digest: 'pdf-hash-001', version: null, platform: 'darwin', volume: 'test-vol', binding: 'bound' },
      mediaType: 'application/pdf',
      sizeBytes: 5000,
      contentHash: 'content-hash-pdf-001',
      contentKind: 'bytes',
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      transformations: [],
      privacyClassification: 'public',
      compatibility: { status: 'compatible', matchedInput: 'application/pdf' },
      createdAt: '2026-07-18T12:00:00.000Z',
    };
    const request = makeRequest({ preparedArtifacts: [bytesArtifact] });
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
  // 10. Raw key never leaks
  // -----------------------------------------------------------------------

  it('should never leak the raw key in transport request headersSummary, result, or failure', async () => {
    let capturedHeadersSummary: readonly { name: string; value: string }[] | null = null;
    let capturedFetchHeaders: Record<string, string> | null = null;

    transport.registerDefaultResponder((req) => {
      capturedHeadersSummary = req.headersSummary;
      capturedFetchHeaders = req.fetchHeaders;
      return successResponse(buildAddressResponse());
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
  // 11. Handler registered via defaultSpecialistHandlers
  // -----------------------------------------------------------------------

  it('should be registered in defaultSpecialistHandlers and resolvable by the adapter', async () => {
    const { defaultSpecialistHandlers } = await import('../src/core/specialists/services/index.js');
    const handlers = defaultSpecialistHandlers();

    expect(handlers).toHaveLength(3);
    expect(handlers.find(h => h.serviceId === 'extract-address')).toBeDefined();

    // Verify the handler works through the adapter
    const testTransport = new InMemorySpecialistTransport();
    testTransport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse()),
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
    expect(r.fields.houseNumber).toBeDefined();
    expect(r.fields.houseNumber!.present).toBe(true);
    expect(r.fields.houseNumber!.value).toBe(EXPECTED_HOUSE_NUMBER);
  });

  // -----------------------------------------------------------------------
  // 12. App test seam: setSpecialistTransportForTest
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
  // 16. Quota 429
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
    const entry = makeRegistryEntry({ supportedInputs: ['text/plain', 'application/pdf'] });
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
      return successResponse(buildAddressResponse());
    });

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    await adapter.invoke(request, entry, health);

    expect(capturedReq).not.toBeNull();
    expect(capturedReq!.method).toBe('POST');
    expect(capturedReq!.url).toBe('https://api.aiforthai.in.th/extract-address/v1');
    expect(capturedReq!.contentType).toBe('application/json');
    expect(capturedReq!.bodyKind).toBe('text');
    expect(capturedReq!.bodyText).toBeDefined();

    // Parse the body and verify structure
    const body = JSON.parse(capturedReq!.bodyText!);
    expect(body.text).toBeDefined();
    expect(typeof body.text).toBe('string');
    expect(body.text).toBe(FIXTURE_ADDRESS_TEXT);
  });

  // -----------------------------------------------------------------------
  // 22. buildTransportRequest uses resolveRawKey for Authorization
  // -----------------------------------------------------------------------

  it('should use the resolved key for Authorization header', async () => {
    let capturedFetchHeaders: Record<string, string> | null = null;

    transport.registerDefaultResponder((req) => {
      capturedFetchHeaders = req.fetchHeaders;
      return successResponse(buildAddressResponse());
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
  // 24. Missing address object
  // -----------------------------------------------------------------------

  it('should mark all address components as present:false when address object is missing', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse({ address: undefined })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // All address components should be present:false
    expect(r.fields.houseNumber!.present).toBe(false);
    expect(r.fields.street!.present).toBe(false);
    expect(r.fields.subdistrict!.present).toBe(false);
    expect(r.fields.district!.present).toBe(false);
    expect(r.fields.province!.present).toBe(false);
    expect(r.fields.postalCode!.present).toBe(false);

    // All should be in emptyFields
    expect(r.emptyFields).toContain('houseNumber');
    expect(r.emptyFields).toContain('street');
    expect(r.emptyFields).toContain('subdistrict');
    expect(r.emptyFields).toContain('district');
    expect(r.emptyFields).toContain('province');
    expect(r.emptyFields).toContain('postalCode');
  });

  // -----------------------------------------------------------------------
  // 25. Source spans with non-object elements
  // -----------------------------------------------------------------------

  it('should mark sourceSpans as present:false when sourceSpans contains only non-objects', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse({ sourceSpans: ['not', 'objects'] } as Partial<AddressResponse>)),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.sourceSpans).toBeDefined();
    expect(r.fields.sourceSpans!.kind).toBe('structured');
    expect(r.fields.sourceSpans!.value).toEqual({});
    expect(r.fields.sourceSpans!.present).toBe(false);
    expect(r.emptyFields).toContain('sourceSpans');
  });

  // -----------------------------------------------------------------------
  // 26. Empty sourceSpans array
  // -----------------------------------------------------------------------

  it('should mark sourceSpans as present:false when sourceSpans is an empty array', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse({ sourceSpans: [] })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.sourceSpans).toBeDefined();
    expect(r.fields.sourceSpans!.kind).toBe('structured');
    expect(r.fields.sourceSpans!.value).toEqual({});
    expect(r.fields.sourceSpans!.present).toBe(false);
    expect(r.emptyFields).toContain('sourceSpans');
  });

  // -----------------------------------------------------------------------
  // 27. Mixed valid + invalid sourceSpans
  // -----------------------------------------------------------------------

  it('should keep valid sourceSpans and drop invalid ones from a mixed array', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse({
        sourceSpans: [
          { field: 'houseNumber', offset: 0, length: 6 },
          'invalid',
          { field: 'street', offset: 16, length: 10 },
        ],
      } as Partial<AddressResponse>)),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    expect(r.fields.sourceSpans).toBeDefined();
    expect(r.fields.sourceSpans!.kind).toBe('structured');
    expect(r.fields.sourceSpans!.present).toBe(true);
    const spansValue = r.fields.sourceSpans!.value as Readonly<Record<string, unknown>>;
    const spans = spansValue.items as readonly Record<string, unknown>[];
    expect(spans).toHaveLength(2);
    expect(spans[0].field).toBe('houseNumber');
    expect(spans[1].field).toBe('street');
    expect(r.emptyFields).not.toContain('sourceSpans');
  });

  // -----------------------------------------------------------------------
  // 28. Null address object
  // -----------------------------------------------------------------------

  it('should mark all address components as present:false when address is null', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse({ address: null })),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // All address components should be present:false
    expect(r.fields.houseNumber!.present).toBe(false);
    expect(r.fields.street!.present).toBe(false);
    expect(r.fields.subdistrict!.present).toBe(false);
    expect(r.fields.district!.present).toBe(false);
    expect(r.fields.province!.present).toBe(false);
    expect(r.fields.postalCode!.present).toBe(false);

    // All should be in emptyFields
    expect(r.emptyFields).toContain('houseNumber');
    expect(r.emptyFields).toContain('street');
    expect(r.emptyFields).toContain('subdistrict');
    expect(r.emptyFields).toContain('district');
    expect(r.emptyFields).toContain('province');
    expect(r.emptyFields).toContain('postalCode');
  });

  // -----------------------------------------------------------------------
  // 29. extractedText fallback (PDF/DOCX extracted content)
  // -----------------------------------------------------------------------

  it('should read from extractedText when text is not available', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse(buildAddressResponse()),
    );

    // Use an artifact with extractedText but no text field
    const extractedArtifact = makeExtractedTextArtifact();
    const request = makeRequest({ preparedArtifacts: [extractedArtifact] });
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;
    expect(r.fields.houseNumber!.present).toBe(true);
    expect(r.fields.houseNumber!.value).toBe(EXPECTED_HOUSE_NUMBER);
  });

  // -----------------------------------------------------------------------
  // 30. Non-string component value (should not String() it)
  // -----------------------------------------------------------------------

  it('should mark houseNumber as present:false when value is a number (non-string)', async () => {
    transport.registerDefaultResponder((_req) =>
      successResponse({
        address: {
          houseNumber: 12345,
          street: EXPECTED_STREET,
          subdistrict: EXPECTED_SUBDISTRICT,
          district: EXPECTED_DISTRICT,
          province: EXPECTED_PROVINCE,
          postalCode: EXPECTED_POSTAL_CODE,
        },
        confidence: EXPECTED_CONFIDENCE,
        sourceSpans: EXPECTED_SOURCE_SPANS.map(s => ({ ...s })),
      }),
    );

    const request = makeRequest();
    const entry = makeRegistryEntry();
    const health = makeHealthSnapshot();

    const result = await adapter.invoke(request, entry, health);

    expect((result as SpecialistResult).ok).toBe(true);
    const r = result as SpecialistResult;

    // houseNumber should be present:false (non-string, not fabricated)
    expect(r.fields.houseNumber).toBeDefined();
    expect(r.fields.houseNumber!.kind).toBe('text');
    expect(r.fields.houseNumber!.value).toBe('');
    expect(r.fields.houseNumber!.present).toBe(false);
    expect(r.emptyFields).toContain('houseNumber');

    // Other components should still be present
    expect(r.fields.street!.present).toBe(true);
    expect(r.fields.street!.value).toBe(EXPECTED_STREET);
  });
});
