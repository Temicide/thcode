// Immutable SpecialistEvidence sealing (Story 4.14, AD-10, AD-24).
// Builds the immutable envelope from a SpecialistResult or SpecialistFailure.
// Sanitizes derived text fields via the sanitizer. Deterministic id over
// canonical sealed fields. Deep-freezes the result. NEVER carries raw payload
// bytes — only source-content hash, sanitized summaries, references, hashes,
// and policy-approved derived fields.

import { createHash } from 'node:crypto';
import { sanitizer, type ContentClass, type SanitizeResult } from '../../security/sanitizer.js';
import { canonicalJson } from './cacheManifest.js';
import type {
  SpecialistEvidence,
  EvidenceCompleteness,
} from './types.js';
import { SPECIALIST_EVIDENCE_SCHEMA_VERSION } from './types.js';
import type {
  SpecialistResult,
  SpecialistFailure,
  SpecialistFieldValue,
} from '../adapter/types.js';
import type { ConsentReference } from '../consent/types.js';

// ---------------------------------------------------------------------------
// Seal input
// ---------------------------------------------------------------------------

export interface SealSpecialistEvidenceInput {
  /** The invocation outcome — either a result or a failure. */
  readonly outcome: SpecialistResult | SpecialistFailure;
  /** Effective configuration generation id. */
  readonly configurationGenerationId: string;
  /** Service identity (required for failures; for results defaults from outcome). */
  readonly serviceIdentity?: {
    readonly serviceId: string;
    readonly nameThai: string;
    readonly nameEnglish: string;
    readonly contractVersion: string;
    readonly adapterVersion: string;
  };
  /** Consent reference (required for failures; for results defaults from outcome). */
  readonly consentReference?: ConsentReference;
  /** Source content hash (required for failures; for results defaults from outcome). */
  readonly sourceContentHash?: string;
  /** Optional cache manifest digest. */
  readonly cacheManifestDigest?: string;
  /** When the observation was made (from the injected clock). */
  readonly observationTime: string;
  /** When the evidence was displayed/sealed (from the injected clock). */
  readonly displayTime: string;
}

// ---------------------------------------------------------------------------
// Deep freeze helper
// ---------------------------------------------------------------------------

/** Recursively Object.freeze a value and all nested objects/arrays. */
function deepFreeze<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return Object.freeze(value) as unknown as T;
  }

  if (typeof value === 'object') {
    const props = Object.getOwnPropertyNames(value);
    for (const prop of props) {
      const v = (value as Record<string, unknown>)[prop];
      if (v !== null && v !== undefined && (typeof v === 'object' || Array.isArray(v))) {
        deepFreeze(v);
      }
    }
    return Object.freeze(value);
  }

  return value;
}

// ---------------------------------------------------------------------------
// Sanitize string leaves helper
// ---------------------------------------------------------------------------

/**
 * Recursively walk a value and sanitize only string leaves.
 * Preserves all non-string values (numbers, booleans, nulls, nested
 * objects, arrays) in place. Does not mutate input — builds a new object.
 * Tracks omissions for completeness downgrade.
 */
function sanitizeStringLeaves(
  value: unknown,
  s: { sanitize: (text: string, contentClass: ContentClass) => SanitizeResult },
  contentClass: ContentClass,
  omissions: string[],
): unknown {
  if (typeof value === 'string') {
    const result = s.sanitize(value, contentClass);
    if (result.omissions.length > 0) {
      omissions.push(...result.omissions);
    }
    if (result.ok) {
      return result.value;
    }
    // ok:false — the sanitizer returned a cause but may have partially redacted.
    // Use the original value with '[sanitized]' as a safe fallback.
    return '[sanitized]';
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStringLeaves(item, s, contentClass, omissions));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = sanitizeStringLeaves(val, s, contentClass, omissions);
    }
    return result;
  }
  // number, boolean — pass through
  return value;
}

// ---------------------------------------------------------------------------
// Sanitize fields helper
// ---------------------------------------------------------------------------

interface SanitizedFields {
  readonly fields: Readonly<Record<string, SpecialistFieldValue>>;
  readonly omissions: readonly string[];
}

/**
 * Sanitize the value strings inside SpecialistFieldValue text/structured
 * entries. Preserves the kind/present structure. Returns the sanitized fields
 * and any omissions recorded.
 */
function sanitizeFields(
  fields: Readonly<Record<string, SpecialistFieldValue>>,
): SanitizedFields {
  const result: Record<string, SpecialistFieldValue> = {};
  const allOmissions: string[] = [];

  for (const [key, field] of Object.entries(fields)) {
    if (field.kind === 'text') {
      const sanitized = sanitizer.sanitize(field.value, 'remote-payload');
      result[key] = {
        kind: 'text',
        value: sanitized.ok ? sanitized.value : '[sanitized]',
        present: field.present,
      };
      if (sanitized.omissions.length > 0) {
        allOmissions.push(...sanitized.omissions);
      }
    } else if (field.kind === 'structured') {
      // For structured fields, recursively sanitize only string leaves.
      // Preserves the original object structure (kind/value/present) but
      // sanitizes string values. Non-string values (numbers, booleans,
      // nulls, nested objects, arrays) are preserved in place.
      const structuredOmissions: string[] = [];
      const sanitizedValue = sanitizeStringLeaves(
        field.value,
        sanitizer,
        'remote-payload',
        structuredOmissions,
      ) as Record<string, unknown>;
      result[key] = {
        kind: 'structured',
        value: sanitizedValue,
        present: field.present,
      };
      if (structuredOmissions.length > 0) {
        allOmissions.push(...structuredOmissions);
      }
    } else {
      // number, boolean, list — no text sanitization needed
      result[key] = field;
    }
  }

  return { fields: result, omissions: allOmissions };
}

// ---------------------------------------------------------------------------
// Deterministic evidence id
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic evidence id from the canonical JSON of the evidence
 * fields (excluding the id itself). Same sealed content → same id.
 */
function computeEvidenceId(evidence: Omit<SpecialistEvidence, 'id'>): string {
  const canonical = canonicalJson(evidence);
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `ev-${hash}`;
}

// ---------------------------------------------------------------------------
// Seal
// ---------------------------------------------------------------------------

/**
 * Seal a SpecialistResult or SpecialistFailure into an immutable
 * SpecialistEvidence envelope. Sanitizes derived text fields, computes a
 * deterministic id, and deep-freezes the result.
 *
 * For a result (outcome.ok === true):
 *   - Copies serviceIdentity, configurationGenerationId, consentReference,
 *     sourceContentHash, fields (sanitized), emptyFields, confidence,
 *     uncertainty, provenance, timing, sanitizedRawResponseRef, evidenceRef.
 *   - Completeness: 'complete' if no omissions and no emptyFields, else
 *     'sanitized-with-omissions' if omissions occurred, else 'complete'
 *     (empty fields alone still complete — they're explicitly represented).
 *
 * For a failure (outcome.ok === false):
 *   - normalizedFailure = outcome (already sanitized by 4.9).
 *   - completeness = 'failed', fields = {}, emptyFields = [].
 *   - sourceContentHash: for a failure there is no source-content hash; use
 *     the passed sourceContentHash or the outcome's effectiveGenerationId.
 */
export function sealSpecialistEvidence(
  input: SealSpecialistEvidenceInput,
): SpecialistEvidence {
  const {
    outcome,
    configurationGenerationId,
    cacheManifestDigest,
    observationTime,
    displayTime,
  } = input;

  if (outcome.ok) {
    // --- Result evidence ---
    const result = outcome as SpecialistResult;

    // Resolve serviceIdentity, consentReference, sourceContentHash from outcome
    // or explicit input.
    const serviceIdentity = input.serviceIdentity ?? result.serviceIdentity;
    const consentReference = input.consentReference ?? result.consentReference;
    const sourceContentHash = input.sourceContentHash ?? result.sourceContentHash;

    // Sanitize fields
    const { fields: sanitizedFields, omissions } = sanitizeFields(result.fields);

    // Determine completeness
    const hasOmissions = omissions.length > 0;
    const completeness: EvidenceCompleteness = hasOmissions
      ? 'sanitized-with-omissions'
      : 'complete';

    const evidenceBase: Omit<SpecialistEvidence, 'id'> = {
      schemaVersion: SPECIALIST_EVIDENCE_SCHEMA_VERSION,
      reuseState: 'fresh',
      completeness,
      serviceIdentity,
      configurationGenerationId,
      sourceContentHash,
      consentReference,
      fields: sanitizedFields,
      emptyFields: result.emptyFields,
      confidence: result.confidence,
      uncertainty: result.uncertainty,
      provenance: result.provenance,
      timing: result.timing,
      cacheManifestDigest,
      observationTime,
      displayTime,
      sanitizedRawResponseRef: result.sanitizedRawResponseRef,
      evidenceRef: result.evidenceRef,
    };

    const id = computeEvidenceId(evidenceBase);
    const evidence: SpecialistEvidence = { id, ...evidenceBase };
    return deepFreeze(evidence);
  } else {
    // --- Failure evidence ---
    const failure = outcome as SpecialistFailure;

    // For failures, serviceIdentity is required — never synthesize a placeholder.
    if (!input.serviceIdentity) {
      throw new Error('sealSpecialistEvidence: serviceIdentity is required to seal a failure outcome.');
    }
    const serviceIdentity = input.serviceIdentity;

    // For failures, consentReference is required — never synthesize a placeholder.
    if (!input.consentReference) {
      throw new Error('sealSpecialistEvidence: consentReference is required to seal a failure outcome.');
    }
    const consentReference: ConsentReference = input.consentReference;
    // For failures, sourceContentHash is not available; use the passed one or
    // the effectiveGenerationId.
    const sourceContentHash = input.sourceContentHash ?? failure.effectiveGenerationId;

    const evidenceBase: Omit<SpecialistEvidence, 'id'> = {
      schemaVersion: SPECIALIST_EVIDENCE_SCHEMA_VERSION,
      reuseState: 'fresh',
      completeness: 'failed',
      serviceIdentity,
      configurationGenerationId,
      sourceContentHash,
      consentReference,
      fields: {},
      emptyFields: [],
      provenance: {
        endpoint: '',
        method: '',
        status: 0,
        transportVersion: '',
      },
      timing: {
        startedAt: '',
        completedAt: failure.completedAt,
        elapsedMs: 0,
      },
      normalizedFailure: failure,
      cacheManifestDigest,
      observationTime,
      displayTime,
      sanitizedRawResponseRef: '',
      evidenceRef: failure.evidenceRef,
    };

    const id = computeEvidenceId(evidenceBase);
    const evidence: SpecialistEvidence = { id, ...evidenceBase };
    return deepFreeze(evidence);
  }
}
