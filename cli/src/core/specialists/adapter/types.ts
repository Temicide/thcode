// Shared Specialist adapter contracts (Story 4.9). All types are readonly and
// secret-free by construction. The raw AI-for-Thai key is fetched ONLY inside the
// handler's buildTransportRequest via CredentialScope.resolveRawKey() and NEVER
// appears in headersSummary, SpecialistRawResponse, SpecialistResult,
// SpecialistFailure, Evidence, logs, prompts, sessions, previews, or output.

import type { SpecialistEffectiveConfiguration } from '../health/types.js';
import type { PreparedPayloadManifest, ConsentReference } from '../consent/index.js';
import type { PreparedArtifact } from '../artifacts/types.js';

// ---------------------------------------------------------------------------
// Request contracts
// ---------------------------------------------------------------------------

/** Bounded request options projected from SpecialistRequestConfig. */
export interface SpecialistRequestOptions {
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

/** The full Specialist invocation request. Binds service identity, contract/
 * manifest versions, effective configuration, prepared manifest, consent
 * reference, operation id, prepared artifacts, and bounded options. */
export interface SpecialistRequest {
  readonly serviceId: string;
  readonly contractVersion: string;
  readonly manifestVersion: number;
  readonly effectiveConfiguration: SpecialistEffectiveConfiguration;
  readonly preparedManifest: PreparedPayloadManifest;
  readonly consentReference: ConsentReference;
  readonly operationId: string;
  readonly preparedArtifacts: readonly PreparedArtifact[];
  readonly options: SpecialistRequestOptions;
  readonly startedAt: string;
}

/** In-scope-only credential resolution. The resolved key must not escape the
 * handler closure — it is used only to build the transport request's fetch
 * headers and is discarded immediately after. */
export interface CredentialScope {
  readonly resolveRawKey: () => Promise<string>;
}

/** The transport request built by a handler. Carries BOTH the real fetch
 * headers (used ONLY for the wire call, NEVER persisted/logged) AND the
 * secret-free headersSummary (the Evidence copy). */
export interface SpecialistTransportRequest {
  readonly method: string;
  /** Verified endpoint URL (from the effective configuration). */
  readonly url: string;
  /** Secret-free header summary for Evidence/logging — Authorization is
   * already redacted to `[redacted]` by the handler. */
  readonly headersSummary: readonly { readonly name: string; readonly value: string }[];
  /** REAL headers used for the wire fetch — NEVER persisted or logged. */
  readonly fetchHeaders: Record<string, string>;
  readonly bodyKind: 'bytes' | 'text' | 'none';
  readonly bodyBytes?: Uint8Array;
  readonly bodyText?: string;
  readonly contentType: string;
  readonly timeoutMs: number;
}

/** The raw response from a transport call. headersSafe is sanitized — no
 * Authorization or X-Api-Key headers are echoed. */
export interface SpecialistRawResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headersSafe: readonly { readonly name: string; readonly value: string }[];
  readonly bodyBytes?: Uint8Array;
  readonly bodyText?: string;
  readonly elapsedMs: number;
  readonly completedAt: string;
}

// ---------------------------------------------------------------------------
// Result contracts
// ---------------------------------------------------------------------------

/** Discriminated field value — explicitly represents empty/absent fields. */
export type SpecialistFieldValue =
  | { readonly kind: 'text'; readonly value: string; readonly present: boolean }
  | { readonly kind: 'number'; readonly value: number | null; readonly present: boolean }
  | { readonly kind: 'boolean'; readonly value: boolean | null; readonly present: boolean }
  | { readonly kind: 'list'; readonly value: readonly string[]; readonly present: boolean }
  | { readonly kind: 'structured'; readonly value: Readonly<Record<string, unknown>>; readonly present: boolean };

/** A successful Specialist invocation result. Preserves returned fields
 * verbatim, explicitly represents empty fields, carries confidence/uncertainty
 * when the service returns them, source-content hash, service identity,
 * configuration-generation id, consent reference, timing, provenance, and a
 * sanitized raw-response reference. NEVER invents a field. */
export interface SpecialistResult {
  readonly ok: true;
  readonly serviceId: string;
  readonly serviceIdentity: {
    readonly serviceId: string;
    readonly nameThai: string;
    readonly nameEnglish: string;
    readonly contractVersion: string;
    readonly adapterVersion: string;
  };
  readonly configurationGenerationId: string;
  readonly consentReference: ConsentReference;
  readonly sourceContentHash: string;
  readonly fields: Readonly<Record<string, SpecialistFieldValue>>;
  readonly emptyFields: readonly string[];
  readonly confidence?: number;
  readonly uncertainty?: string;
  readonly timing: {
    readonly startedAt: string;
    readonly completedAt: string;
    readonly elapsedMs: number;
  };
  readonly provenance: {
    readonly endpoint: string;
    readonly method: string;
    readonly status: number;
    readonly transportVersion: string;
  };
  readonly sanitizedRawResponseRef: string;
  readonly evidenceRef?: string;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Failure contracts
// ---------------------------------------------------------------------------

/** Deterministic failure category for a Specialist invocation. */
export type SpecialistFailureCategory =
  | 'transport'
  | 'timeout'
  | 'quota'
  | 'rate-limited'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'malformed-response'
  | 'unsupported-input'
  | 'server-error'
  | 'unknown-outcome';

/** Retryability classification. */
export type Retryability = 'retryable' | 'not-retryable' | 'retry-after-specified';

/** A typed Specialist invocation failure. Deterministic category, retryability,
 * smallest proven scope, effective generation, operation id, safe message
 * (sanitized), cause code, optional evidence ref, optional retry-after-ms. */
export interface SpecialistFailure {
  readonly ok: false;
  readonly category: SpecialistFailureCategory;
  readonly retryability: Retryability;
  readonly smallestProvenScope: string;
  readonly effectiveGenerationId: string;
  readonly operationId: string;
  readonly safeMessage: string;
  readonly causeCode: string;
  readonly evidenceRef?: string;
  readonly retryAfterMs?: number;
  readonly serviceId: string;
  readonly completedAt: string;
}

// ---------------------------------------------------------------------------
// Outcome / Invocation / Refusal
// ---------------------------------------------------------------------------

/** A Specialist invocation outcome — either a result or a failure. */
export type SpecialistOutcome = SpecialistResult | SpecialistFailure;

/** Typed cause for a pre-transport refusal. */
export type SpecialistAdapterRefusalCause =
  | 'non-invokable-entry'
  | 'consent-manifest-mismatch'
  | 'stale-generation'
  | 'unsupported-input'
  | 'version-mismatch'
  | 'handler-not-registered'
  | 'headless-blocked';

/** A pre-transport refusal. The adapter refuses BEFORE calling the transport;
 * no protocol repair, no service substitution, no retry of unknown outcome. */
export interface SpecialistAdapterRefusal {
  readonly ok: false;
  readonly refused: true;
  readonly cause: SpecialistAdapterRefusalCause;
  readonly safeMessage: string;
  readonly operationId: string;
  readonly serviceId: string;
}

/** The top-level adapter return — either a typed outcome (result or failure)
 * or a pre-transport refusal. The adapter NEVER throws across the boundary. */
export type SpecialistInvocation = SpecialistOutcome | SpecialistAdapterRefusal;

// ---------------------------------------------------------------------------
// Handler contract
// ---------------------------------------------------------------------------

/** A per-service extension point (registered by Stories 4.10–4.13).
 * buildTransportRequest uses a CredentialScope that resolves the raw key IN
 * SCOPE ONLY — the key never enters Evidence, logs, the transport request's
 * secret-free summary, or the result. parseResult maps a raw response into a
 * SpecialistResult WITHOUT inventing fields. */
export interface SpecialistServiceHandler {
  readonly serviceId: string;
  buildTransportRequest(
    request: SpecialistRequest,
    credentialScope: CredentialScope,
  ): Promise<SpecialistTransportRequest>;
  parseResult(
    raw: SpecialistRawResponse,
    request: SpecialistRequest,
  ): SpecialistResult | { readonly ok: false; readonly parseFailure: { readonly category: 'malformed-response'; readonly causeCode: string; readonly safeMessage: string } };
}

// ---------------------------------------------------------------------------
// Transport contract
// ---------------------------------------------------------------------------

/** Transport response — either a successful raw response or a typed transport
 * error (timeout, network, aborted). */
export type SpecialistTransportResponse =
  | { readonly ok: true; readonly raw: SpecialistRawResponse }
  | { readonly ok: false; readonly transportError: { readonly kind: 'timeout' | 'network' | 'aborted'; readonly message: string; readonly elapsedMs: number } };

/** Abstract transport for sending a Specialist request. */
export interface SpecialistTransport {
  send(req: SpecialistTransportRequest): Promise<SpecialistTransportResponse>;
}

// ---------------------------------------------------------------------------
// Projection contracts
// ---------------------------------------------------------------------------

/** Canonical heading tokens for output projection. */
export const SPECIALIST_OUTPUT_HEADING = 'Specialist Output';
export const TYPHOON_EXPLANATION_HEADING = 'Typhoon Explanation';
export const EVIDENCE_HEADING = 'Evidence';
export const FAILURE_PROVENANCE_HEADING = 'Failure Provenance';

/** Canonical state tokens for Specialist output projection. */
export type SpecialistOutputToken =
  | 'specialist-output'
  | 'typhoon-explanation'
  | 'evidence'
  | 'failure-provenance';

/** Canonical state tokens for Specialist failure projection. */
export type SpecialistFailureToken =
  | 'failure-provenance'
  | 'failure-category'
  | 'failure-retryability'
  | 'failure-scope'
  | 'failure-safe-message'
  | 'failure-cause-code';

/** Projected Specialist output for rendering. */
export interface SpecialistOutputProjection {
  readonly heading: typeof SPECIALIST_OUTPUT_HEADING;
  readonly token: 'specialist-output';
  readonly serviceId: string;
  readonly serviceName: string;
  readonly fields: Readonly<Record<string, SpecialistFieldValue>>;
  readonly emptyFields: readonly string[];
  readonly confidence?: number;
  readonly uncertainty?: string;
  readonly evidenceHeading: typeof EVIDENCE_HEADING;
  readonly evidenceToken: 'evidence';
  readonly evidenceRef?: string;
  readonly timing: {
    readonly startedAt: string;
    readonly completedAt: string;
    readonly elapsedMs: number;
  };
}

/** Projected Specialist failure for rendering. */
export interface SpecialistFailureProjection {
  readonly heading: typeof FAILURE_PROVENANCE_HEADING;
  readonly token: 'failure-provenance';
  readonly serviceId: string;
  readonly category: SpecialistFailureCategory;
  readonly retryability: Retryability;
  readonly scope: string;
  readonly safeMessage: string;
  readonly causeCode: string;
  readonly retryAfterMs?: number;
}
