// Specialist Evidence contracts (Story 4.14). Immutable, sanitized, sealed
// envelope wrapping a SpecialistResult or SpecialistFailure. NEVER carries raw
// payload bytes — only source-content hash, sanitized summaries, references,
// hashes, and policy-approved derived fields. CacheManifest is a versioned
// deterministic identity digest over all bound request fields.

import type { SpecialistFieldValue, SpecialistFailure } from '../adapter/types.js';
import type { ConsentReference } from '../consent/types.js';
import type { TransformationPolicy } from '../../permissions/transferConsent.js';

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

export const SPECIALIST_EVIDENCE_SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Reuse state
// ---------------------------------------------------------------------------

/** Whether this Evidence is a fresh live result or a reused cache hit. */
export type EvidenceReuseState = 'fresh' | 'reused';

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

/** Completeness of the Evidence record. */
export type EvidenceCompleteness =
  | 'complete'
  | 'sanitized-with-omissions'
  | 'failed'
  | 'incomplete';

// ---------------------------------------------------------------------------
// SpecialistEvidence
// ---------------------------------------------------------------------------

/**
 * Immutable, sealed Evidence envelope wrapping a SpecialistResult or
 * SpecialistFailure. Deterministic id over canonical sealed fields. Deep
 * Object.freeze. NEVER carries raw payload bytes — only source-content hash,
 * sanitized summaries, references, hashes, and policy-approved derived fields.
 */
export interface SpecialistEvidence {
  /** Deterministic id: `ev-${sha256(canonical sealed fields)}`. */
  readonly id: string;
  /** Schema version for forward compatibility. */
  readonly schemaVersion: typeof SPECIALIST_EVIDENCE_SCHEMA_VERSION;
  /** Whether this is a fresh live result or a reused cache hit. */
  readonly reuseState: EvidenceReuseState;
  /** Completeness of the evidence record. */
  readonly completeness: EvidenceCompleteness;
  /** Service/capability identity. */
  readonly serviceIdentity: {
    readonly serviceId: string;
    readonly nameThai: string;
    readonly nameEnglish: string;
    readonly contractVersion: string;
    readonly adapterVersion: string;
  };
  /** Effective configuration generation id. */
  readonly configurationGenerationId: string;
  /** Source-content hash (from the result's sourceContentHash). */
  readonly sourceContentHash: string;
  /** Secret-free consent reference (never the raw key). */
  readonly consentReference: ConsentReference;
  /** Returned fields (sanitized). */
  readonly fields: Readonly<Record<string, SpecialistFieldValue>>;
  /** Explicitly empty field names. */
  readonly emptyFields: readonly string[];
  /** Confidence score (when the service returns one). */
  readonly confidence?: number;
  /** Uncertainty description (when the service returns one). */
  readonly uncertainty?: string;
  /** Provenance of the invocation. */
  readonly provenance: {
    readonly endpoint: string;
    readonly method: string;
    readonly status: number;
    readonly transportVersion: string;
  };
  /** Timing of the invocation. */
  readonly timing: {
    readonly startedAt: string;
    readonly completedAt: string;
    readonly elapsedMs: number;
  };
  /** Normalized failure (present only when the outcome is a failure). */
  readonly normalizedFailure?: SpecialistFailure;
  /** CacheManifest digest (the cache key for this invocation). */
  readonly cacheManifestDigest?: string;
  /** When the observation was made (from the injected clock). */
  readonly observationTime: string;
  /** When the evidence was displayed/sealed (from the injected clock). */
  readonly displayTime: string;
  /** Sanitized raw-response reference. */
  readonly sanitizedRawResponseRef: string;
  /** Optional evidence reference (from the service's own evidence chain). */
  readonly evidenceRef?: string;
}

// ---------------------------------------------------------------------------
// CacheManifest
// ---------------------------------------------------------------------------

/**
 * Versioned deterministic identity for a Specialist cache entry. The digest
 * is SHA-256 over canonical JSON of ALL bound fields in a fixed order. ANY
 * field difference produces a different digest — no match.
 */
export interface CacheManifest {
  /** Manifest version for forward compatibility. */
  readonly manifestVersion: number;
  /** Stable thcode service identity. */
  readonly serviceId: string;
  /** Contract version for this service. */
  readonly contractVersion: string;
  /** Verified origin endpoint URL. */
  readonly verifiedOrigin: string;
  /** Ordered semantic inputs (mediaType + contentHash pairs). Order matters. */
  readonly semanticInputs: readonly { readonly mediaType: string; readonly contentHash: string }[];
  /** Request options (timeout, retries). */
  readonly requestOptions: {
    readonly timeoutMs: number;
    readonly maxRetries: number;
  };
  /** Preprocessing transformations applied (sorted). */
  readonly preprocessing: readonly string[];
  /** Mapping version (from contractVersion). */
  readonly mappingVersion: string;
  /** Schema version (from manifestVersion). */
  readonly schemaVersion: number;
  /** Effective configuration generation id. */
  readonly effectiveConfigurationId: string;
  /** Transformation/redaction policy. */
  readonly transformationPolicy: TransformationPolicy;
  /** Source identity (canonical path of the primary artifact). */
  readonly sourceIdentity: string;
  /** Deterministic SHA-256 digest over all bound fields. */
  readonly digest: string;
}

// ---------------------------------------------------------------------------
// CacheManifestInput
// ---------------------------------------------------------------------------

/** All fields of a CacheManifest except the digest. Used to compute the digest. */
export interface CacheManifestInput {
  readonly manifestVersion: number;
  readonly serviceId: string;
  readonly contractVersion: string;
  readonly verifiedOrigin: string;
  readonly semanticInputs: readonly { readonly mediaType: string; readonly contentHash: string }[];
  readonly requestOptions: {
    readonly timeoutMs: number;
    readonly maxRetries: number;
  };
  readonly preprocessing: readonly string[];
  readonly mappingVersion: string;
  readonly schemaVersion: number;
  readonly effectiveConfigurationId: string;
  readonly transformationPolicy: TransformationPolicy;
  readonly sourceIdentity: string;
}

// ---------------------------------------------------------------------------
// EvidenceRepository port
// ---------------------------------------------------------------------------

/** Typed cause for a load failure. */
export type EvidenceLoadCause = 'not-found' | 'corrupt';

/** Result of loading an Evidence record. */
export type EvidenceLoadResult =
  | { readonly ok: true; readonly evidence: SpecialistEvidence }
  | { readonly ok: false; readonly cause: EvidenceLoadCause };

/**
 * EvidenceRepository port. Durable persistence is a later epic; 4.14 ships
 * the port + an in-memory implementation.
 */
export interface EvidenceRepository {
  store(evidence: SpecialistEvidence): Promise<void>;
  load(id: string): Promise<EvidenceLoadResult>;
  list(): Promise<readonly SpecialistEvidence[]>;
  has(id: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

/** Typed error for CacheManifest operations. */
export type CacheManifestError =
  | { readonly ok: false; readonly cause: 'invalid-input'; readonly detail: string }
  | { readonly ok: false; readonly cause: 'digest-mismatch'; readonly detail: string };

// ---------------------------------------------------------------------------
// Projection types
// ---------------------------------------------------------------------------

/** Projection of a reused Evidence — visibly labeled, not fresh. */
export interface ReusedEvidenceProjection {
  readonly reuseState: 'reused';
  readonly originalObservationTime: string;
  readonly provenance: {
    readonly endpoint: string;
    readonly method: string;
    readonly status: number;
    readonly transportVersion: string;
  };
  readonly cacheId: string;
  readonly completeness: EvidenceCompleteness;
}

/** Projection of a fresh Evidence — a live result. */
export interface FreshEvidenceProjection {
  readonly reuseState: 'fresh';
  readonly observationTime: string;
  readonly provenance: {
    readonly endpoint: string;
    readonly method: string;
    readonly status: number;
    readonly transportVersion: string;
  };
  readonly completeness: EvidenceCompleteness;
}

// ---------------------------------------------------------------------------
// Cache hit result (Story 4.15)
// ---------------------------------------------------------------------------

/**
 * Result of a cache hit in invokeSpecialist. Returned when a valid, non-expired,
 * non-invalidated cache entry is found and forceFresh is false. The Evidence
 * is the SAME immutable frozen record from the EvidenceRepository, relabeled
 * via projectReusedEvidence — NEVER re-sealed, NEVER mutated, NEVER presented
 * as fresh.
 */
export interface SpecialistCacheHit {
  readonly ok: true;
  readonly reused: true;
  readonly projection: ReusedEvidenceProjection;
  readonly evidence: SpecialistEvidence;
}
