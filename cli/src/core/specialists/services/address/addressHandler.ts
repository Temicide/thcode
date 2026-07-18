// ExtractAddressSpecialistHandler — implements SpecialistServiceHandler for the
// Extract Address service (Story 4.12). buildTransportRequest reads the prepared
// artifact's text (text or extractedText), sends it in a JSON body against the
// defined AI-for-Thai Extract Address request shape, and emits a
// Bearer-authenticated POST with a secret-free headersSummary. parseResult maps
// the defined response shape into SpecialistResult fields without inventing
// fields — each address component is present only when the service returns a
// non-empty string.

import type {
  SpecialistServiceHandler,
  SpecialistRequest,
  SpecialistTransportRequest,
  SpecialistRawResponse,
  SpecialistResult,
  SpecialistFieldValue,
  CredentialScope,
  SpecialistHealthProbeRequest,
} from '../../adapter/types.js';
import { FIXTURE_ADDRESS_TEXT } from './fixture.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_ID = 'extract-address';
const SERVICE_NAME_THAI = 'แยกที่อยู่';
const SERVICE_NAME_ENGLISH = 'Extract Address';
const CONTRACT_VERSION = '1.0.0';
const ADAPTER_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Address component keys
// ---------------------------------------------------------------------------

const ADDRESS_COMPONENTS = [
  'houseNumber',
  'street',
  'subdistrict',
  'district',
  'province',
  'postalCode',
] as const;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export class ExtractAddressSpecialistHandler implements SpecialistServiceHandler {
  readonly serviceId = SERVICE_ID;
  readonly healthCanaryFixtureDigest = 'c19b73451e86b3cfaba336fb4efabb5dfd33df657582ed160f5fd6a0888a4a5f';

  async buildTransportRequest(
    request: SpecialistRequest,
    credentialScope: CredentialScope,
  ): Promise<SpecialistTransportRequest> {
    // Read the first prepared artifact.
    const artifact = request.preparedArtifacts[0];

    // Read text from the artifact — prefer text, fall back to extractedText.
    const text = artifact?.text ?? artifact?.extractedText;

    // Validate that we have text content.
    if (!text || typeof text !== 'string' || text.length === 0) {
      throw new Error('extract-address requires a text artifact');
    }

    // Build the request body per the defined AI-for-Thai Extract Address fixture contract.
    const body = JSON.stringify({ text });

    // Resolve the raw key IN SCOPE ONLY — used ONLY for fetchHeaders.Authorization.
    const rawKey = await credentialScope.resolveRawKey();

    return {
      method: 'POST',
      url: request.effectiveConfiguration.endpoint,
      headersSummary: [
        { name: 'Authorization', value: '[redacted]' },
        { name: 'Content-Type', value: 'application/json' },
      ],
      fetchHeaders: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      bodyKind: 'text',
      bodyText: body,
      contentType: 'application/json',
      timeoutMs: request.options.timeoutMs,
    };
  }

  async buildHealthProbeRequest(
    request: SpecialistHealthProbeRequest,
    credentialScope: CredentialScope,
  ): Promise<SpecialistTransportRequest> {
    if (request.canary.mediaType !== 'text/plain') {
      throw new Error('extract-address health canary media type is not approved');
    }
    const rawKey = await credentialScope.resolveRawKey();
    return {
      method: request.canary.method,
      url: request.effectiveConfiguration.endpoint,
      headersSummary: [
        { name: 'Authorization', value: '[redacted]' },
        { name: 'Content-Type', value: 'application/json' },
      ],
      fetchHeaders: { Authorization: `Bearer ${rawKey}`, 'Content-Type': 'application/json' },
      bodyKind: 'text',
      bodyText: JSON.stringify({ text: FIXTURE_ADDRESS_TEXT }),
      contentType: 'application/json',
      timeoutMs: request.effectiveConfiguration.requestConfig.timeoutMs,
    };
  }

  acceptsHealthProbeResponse(raw: SpecialistRawResponse): boolean {
    return isJsonObject(raw.bodyText);
  }

  parseResult(
    raw: SpecialistRawResponse,
    _request: SpecialistRequest,
  ): SpecialistResult | { readonly ok: false; readonly parseFailure: { readonly category: 'malformed-response'; readonly causeCode: string; readonly safeMessage: string } } {
    // Check for empty body.
    if (!raw.bodyText) {
      return {
        ok: false,
        parseFailure: {
          category: 'malformed-response',
          causeCode: 'parse-failed',
          safeMessage: 'Empty response body.',
        },
      };
    }

    // Parse JSON.
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.bodyText) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        parseFailure: {
          category: 'malformed-response',
          causeCode: 'parse-failed',
          safeMessage: 'Failed to parse response body as JSON.',
        },
      };
    }

    // Validate that parsed is a plain object.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        ok: false,
        parseFailure: {
          category: 'malformed-response',
          causeCode: 'parse-failed',
          safeMessage: 'Response body is not a JSON object.',
        },
      };
    }

    // Map fields from the defined AI-for-Thai Extract Address response shape.
    // NEVER invent fields: a key present and non-null → present:true;
    // a key absent, null, or wrong-typed → present:false + listed in emptyFields.
    const fields: Record<string, SpecialistFieldValue> = {};
    const emptyFields: string[] = [];

    // Extract the address object from the response.
    const addressObj =
      'address' in parsed && parsed.address !== null && typeof parsed.address === 'object' && !Array.isArray(parsed.address)
        ? (parsed.address as Record<string, unknown>)
        : null;

    // Map each address component to its own text SpecialistFieldValue.
    // Present iff a non-empty string. Do NOT String() non-strings.
    for (const component of ADDRESS_COMPONENTS) {
      if (
        addressObj !== null &&
        component in addressObj &&
        addressObj[component] !== null &&
        typeof addressObj[component] === 'string' &&
        (addressObj[component] as string).length > 0
      ) {
        fields[component] = { kind: 'text', value: addressObj[component] as string, present: true };
      } else {
        fields[component] = { kind: 'text', value: '', present: false };
        emptyFields.push(component);
      }
    }

    // Map `confidence` → `confidence` (number field).
    if ('confidence' in parsed && parsed.confidence !== null && typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)) {
      fields.confidence = { kind: 'number', value: parsed.confidence, present: true };
    } else {
      fields.confidence = { kind: 'number', value: null, present: false };
      emptyFields.push('confidence');
    }

    // Map `sourceSpans` → `sourceSpans` (structured field).
    // Per-element filter: keep only valid object elements (non-null, non-array objects).
    if ('sourceSpans' in parsed && parsed.sourceSpans !== null && Array.isArray(parsed.sourceSpans)) {
      const validSpans = parsed.sourceSpans.filter(
        (s: unknown) => typeof s === 'object' && s !== null && !Array.isArray(s),
      );
      if (validSpans.length > 0) {
        fields.sourceSpans = { kind: 'structured', value: { items: validSpans } as Readonly<Record<string, unknown>>, present: true };
      } else {
        fields.sourceSpans = { kind: 'structured', value: {} as Readonly<Record<string, unknown>>, present: false };
        emptyFields.push('sourceSpans');
      }
    } else {
      fields.sourceSpans = { kind: 'structured', value: {} as Readonly<Record<string, unknown>>, present: false };
      emptyFields.push('sourceSpans');
    }

    // Build the result. The adapter's buildSpecialistResult will overwrite
    // configurationGenerationId, consentReference, sourceContentHash, timing,
    // provenance, sanitizedRawResponseRef, evidenceRef, and createdAt.
    return {
      ok: true,
      serviceId: SERVICE_ID,
      serviceIdentity: {
        serviceId: SERVICE_ID,
        nameThai: SERVICE_NAME_THAI,
        nameEnglish: SERVICE_NAME_ENGLISH,
        contractVersion: CONTRACT_VERSION,
        adapterVersion: ADAPTER_VERSION,
      },
      configurationGenerationId: _request.effectiveConfiguration.id,
      consentReference: _request.consentReference,
      sourceContentHash: _request.preparedManifest.payloadByteDigest,
      fields,
      emptyFields,
      confidence: fields.confidence.present ? (fields.confidence.value as number) : undefined,
      uncertainty: undefined,
      timing: {
        startedAt: _request.startedAt,
        completedAt: raw.completedAt,
        elapsedMs: raw.elapsedMs,
      },
      provenance: {
        endpoint: _request.effectiveConfiguration.endpoint,
        method: 'POST',
        status: raw.status,
        transportVersion: '1.0.0',
      },
      sanitizedRawResponseRef: '',
      evidenceRef: undefined,
      createdAt: _request.startedAt,
    };
  }
}

function isJsonObject(bodyText: string | undefined): boolean {
  if (!bodyText) return false;
  try {
    const parsed: unknown = JSON.parse(bodyText);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}
