// TocrSpecialistHandler — implements SpecialistServiceHandler for the T-OCR
// service (Story 4.10). buildTransportRequest reads the prepared image artifact's
// bytes, base64-encodes them into a JSON body against the defined AI-for-Thai
// T-OCR request shape, and emits a Bearer-authenticated POST with a secret-free
// headersSummary. parseResult maps the defined response shape into
// SpecialistResult fields without inventing fields.

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
import { FIXTURE_PNG_BYTES } from './fixture.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_ID = 't-ocr';
const SERVICE_NAME_THAI = 'ที-โอซีอาร์';
const SERVICE_NAME_ENGLISH = 'T-OCR';
const CONTRACT_VERSION = '1.0.0';
const ADAPTER_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export class TocrSpecialistHandler implements SpecialistServiceHandler {
  readonly serviceId = SERVICE_ID;
  readonly healthCanaryFixtureDigest = 'c8af280b69cb50aa121299fbf0413fdf45b6ee1a58b3ce4f6da1776d1ed8e210';

  async buildTransportRequest(
    request: SpecialistRequest,
    credentialScope: CredentialScope,
  ): Promise<SpecialistTransportRequest> {
    // Read the first prepared artifact.
    const artifact = request.preparedArtifacts[0];

    // Validate that the artifact has binary bytes (image data).
    if (!artifact || artifact.contentKind !== 'bytes' || !artifact.bytes || artifact.bytes.length === 0) {
      throw new Error('t-ocr requires a binary image artifact');
    }

    // Base64-encode the image bytes.
    const base64Image = Buffer.from(artifact.bytes).toString('base64');

    // Build the request body per the defined AI-for-Thai T-OCR fixture contract.
    const body = JSON.stringify({
      image: base64Image,
      mime: artifact.mediaType,
    });

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
    if (request.canary.mediaType !== 'image/png') {
      throw new Error('t-ocr health canary media type is not approved');
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
      bodyText: JSON.stringify({ image: Buffer.from(FIXTURE_PNG_BYTES).toString('base64'), mime: request.canary.mediaType }),
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

    // Map fields from the defined AI-for-Thai T-OCR response shape.
    // NEVER invent fields: a key present and non-null → present:true;
    // a key absent, null, or wrong-typed → present:false + listed in emptyFields.
    const fields: Record<string, SpecialistFieldValue> = {};
    const emptyFields: string[] = [];

    // Map `result` → `recognizedText` (text field).
    // Empty string is treated as not-present (no meaningful content).
    if ('result' in parsed && parsed.result !== null && typeof parsed.result === 'string' && parsed.result.length > 0) {
      fields.recognizedText = { kind: 'text', value: parsed.result, present: true };
    } else {
      const value = 'result' in parsed && parsed.result !== null && typeof parsed.result === 'string' ? parsed.result : '';
      fields.recognizedText = { kind: 'text', value, present: false };
      emptyFields.push('recognizedText');
    }

    // Map `confidence` → `confidence` (number field).
    if ('confidence' in parsed && parsed.confidence !== null && typeof parsed.confidence === 'number') {
      fields.confidence = { kind: 'number', value: parsed.confidence, present: true };
    } else {
      const value = 'confidence' in parsed && parsed.confidence !== null && typeof parsed.confidence === 'number' ? parsed.confidence : null;
      fields.confidence = { kind: 'number', value, present: false };
      emptyFields.push('confidence');
    }

    // Map `words` → `words` (list field).
    // Keep only string elements; non-strings are treated as absent.
    if ('words' in parsed && parsed.words !== null && Array.isArray(parsed.words)) {
      const wordValues = parsed.words.filter((w: unknown) => typeof w === 'string');
      if (wordValues.length > 0) {
        fields.words = { kind: 'list', value: wordValues, present: true };
      } else {
        fields.words = { kind: 'list', value: [], present: false };
        emptyFields.push('words');
      }
    } else {
      fields.words = { kind: 'list', value: [], present: false };
      emptyFields.push('words');
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
