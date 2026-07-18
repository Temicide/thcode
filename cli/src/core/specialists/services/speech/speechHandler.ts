// SpeechToTextSpecialistHandler — implements SpecialistServiceHandler for the
// Speech-to-Text service (Story 4.11). buildTransportRequest reads the prepared
// audio artifact's bytes, base64-encodes them into a JSON body against the
// defined AI-for-Thai Speech-to-Text request shape, and emits a
// Bearer-authenticated POST with a secret-free headersSummary. parseResult maps
// the defined response shape into SpecialistResult fields without inventing
// fields.

import type {
  SpecialistServiceHandler,
  SpecialistRequest,
  SpecialistTransportRequest,
  SpecialistRawResponse,
  SpecialistResult,
  SpecialistFieldValue,
  CredentialScope,
} from '../../adapter/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_ID = 'speech-to-text';
const SERVICE_NAME_THAI = 'คำพูดเป็นข้อความ';
const SERVICE_NAME_ENGLISH = 'Speech-to-Text';
const CONTRACT_VERSION = '1.0.0';
const ADAPTER_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export class SpeechToTextSpecialistHandler implements SpecialistServiceHandler {
  readonly serviceId = SERVICE_ID;

  async buildTransportRequest(
    request: SpecialistRequest,
    credentialScope: CredentialScope,
  ): Promise<SpecialistTransportRequest> {
    // Read the first prepared artifact.
    const artifact = request.preparedArtifacts[0];

    // Validate that the artifact has binary bytes (audio data).
    if (!artifact || artifact.contentKind !== 'bytes' || !artifact.bytes || artifact.bytes.length === 0) {
      throw new Error('speech-to-text requires a binary audio artifact');
    }

    // Base64-encode the audio bytes.
    const base64Audio = Buffer.from(artifact.bytes).toString('base64');

    // Build the request body per the defined AI-for-Thai Speech-to-Text fixture contract.
    const body = JSON.stringify({
      audio: base64Audio,
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

    // Map fields from the defined AI-for-Thai Speech-to-Text response shape.
    // NEVER invent fields: a key present and non-null → present:true;
    // a key absent, null, or wrong-typed → present:false + listed in emptyFields.
    const fields: Record<string, SpecialistFieldValue> = {};
    const emptyFields: string[] = [];

    // Map `transcript` → `transcript` (text field).
    // Empty string is treated as not-present (no meaningful content).
    if ('transcript' in parsed && parsed.transcript !== null && typeof parsed.transcript === 'string' && parsed.transcript.length > 0) {
      fields.transcript = { kind: 'text', value: parsed.transcript, present: true };
    } else {
      const value = 'transcript' in parsed && parsed.transcript !== null && typeof parsed.transcript === 'string' ? parsed.transcript : '';
      fields.transcript = { kind: 'text', value, present: false };
      emptyFields.push('transcript');
    }

    // Map `segments` → `segments` (structured field — keep service objects verbatim
    // wrapped in a record since the structured type expects a single record).
    // Per-element filter (mirrors 4.10 words filter pattern): keep only valid
    // segment objects; drop non-object / non-segment elements.
    if ('segments' in parsed && parsed.segments !== null && Array.isArray(parsed.segments)) {
      const validSegments = parsed.segments.filter(
        (s: unknown) => typeof s === 'object' && s !== null && !Array.isArray(s) && typeof (s as any).text === 'string',
      );
      if (validSegments.length > 0) {
        fields.segments = { kind: 'structured', value: { items: validSegments } as Readonly<Record<string, unknown>>, present: true };
      } else {
        fields.segments = { kind: 'structured', value: {} as Readonly<Record<string, unknown>>, present: false };
        emptyFields.push('segments');
      }
    } else {
      fields.segments = { kind: 'structured', value: {} as Readonly<Record<string, unknown>>, present: false };
      emptyFields.push('segments');
    }

    // Map `confidence` → `confidence` (number field).
    if ('confidence' in parsed && parsed.confidence !== null && typeof parsed.confidence === 'number') {
      fields.confidence = { kind: 'number', value: parsed.confidence, present: true };
    } else {
      const value = 'confidence' in parsed && parsed.confidence !== null && typeof parsed.confidence === 'number' ? parsed.confidence : null;
      fields.confidence = { kind: 'number', value, present: false };
      emptyFields.push('confidence');
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
