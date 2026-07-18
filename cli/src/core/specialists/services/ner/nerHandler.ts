// NerSpecialistHandler — implements SpecialistServiceHandler for the Named Entity
// Recognition service (Story 4.13). buildTransportRequest reads the prepared
// artifact's text (text or extractedText), sends it in a JSON body against the
// defined AI-for-Thai NER request shape, and emits a Bearer-authenticated POST
// with a secret-free headersSummary. parseResult maps the defined response shape
// into SpecialistResult fields without inventing entities or labels — the
// entities array is filtered to valid objects (text:string AND label:string),
// kept verbatim (including optional offset), and stored as a structured field
// ({items:[…]}). confidence is a finite-checked number.

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

const SERVICE_ID = 'named-entity-recognition';
const SERVICE_NAME_THAI = 'การรู้จำเอนทิตี';
const SERVICE_NAME_ENGLISH = 'Named Entity Recognition';
const CONTRACT_VERSION = '1.0.0';
const ADAPTER_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export class NerSpecialistHandler implements SpecialistServiceHandler {
  readonly serviceId = SERVICE_ID;

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
      throw new Error('named-entity-recognition requires a text artifact');
    }

    // Build the request body per the defined AI-for-Thai NER fixture contract.
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

    // Map fields from the defined AI-for-Thai NER response shape.
    // NEVER invent fields: a key present and valid → present:true;
    // a key absent, null, or wrong-typed → present:false + listed in emptyFields.
    const fields: Record<string, SpecialistFieldValue> = {};
    const emptyFields: string[] = [];

    // Map `entities` → `entities` (structured field — keep service objects
    // verbatim wrapped in { items: [...] }).
    // Per-element filter: keep only valid entity objects with text:string AND
    // label:string. Drop non-object / non-entity elements. Never fabricate
    // entities or labels.
    if ('entities' in parsed && parsed.entities !== null && Array.isArray(parsed.entities)) {
      const validEntities = parsed.entities.filter(
        (e: unknown) =>
          typeof e === 'object' &&
          e !== null &&
          !Array.isArray(e) &&
          typeof (e as Record<string, unknown>).text === 'string' &&
          typeof (e as Record<string, unknown>).label === 'string',
      );
      if (validEntities.length > 0) {
        fields.entities = { kind: 'structured', value: { items: validEntities } as Readonly<Record<string, unknown>>, present: true };
      } else {
        fields.entities = { kind: 'structured', value: {} as Readonly<Record<string, unknown>>, present: false };
        emptyFields.push('entities');
      }
    } else {
      fields.entities = { kind: 'structured', value: {} as Readonly<Record<string, unknown>>, present: false };
      emptyFields.push('entities');
    }

    // Map `confidence` → `confidence` (number field).
    // Present iff typeof === 'number' && Number.isFinite(...).
    if ('confidence' in parsed && parsed.confidence !== null && typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)) {
      fields.confidence = { kind: 'number', value: parsed.confidence, present: true };
    } else {
      fields.confidence = { kind: 'number', value: null, present: false };
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
