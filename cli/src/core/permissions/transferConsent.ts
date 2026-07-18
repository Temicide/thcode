// Generic prepared-payload + remote-transfer consent contracts (Story 2.6,
// FR-16, FR-24, FR-25, AD-19, AD-24). These are CONTRACTS ONLY — no concrete
// Specialist artifact preparation, service adapter, registry invocation, or
// remote execution (AC #6). Consumers (Epic 4) attach later without changing
// authority semantics.
//
// Local read permission, Full Access, and transfer authority CANNOT be
// conflated: a transfer requires its OWN consent bound to both the canonical
// manifest digest AND the exact payload-byte digest + recipient + endpoint +
// purpose + call count + expiry + operation/Prompt Round scope + activation/
// authority revision + policy version (AC #4). Recomputation is required
// immediately before transport — a changed classification/destination/
// retention/deletion/transformation/manifest-digest/payload-byte-digest makes
// any prior consent stale and the transfer fails closed (AC #3). The PEP
// returns `ask`/`deny` for a transfer independently of local approval, Work
// Mode, Profile, or Full Access (AC #2). Unsafe prepared content (credentials,
// unresolved local paths, disallowed secrets, unsafe active content) is blocked
// or emitted as `sanitized-with-omissions`/`not-authoritative` and never
// transferred or exposed in the consent UI/Evidence (AC #5).

import { createHash, randomUUID } from 'node:crypto';
import { sanitizer, type SanitizeResult } from '../security/sanitizer.js';

export const PREPARED_PAYLOAD_MANIFEST_VERSION = 1;

/** A selected source identity — path/hash/metadata, never the raw bytes (AD-24,
 * FR-25 — an unresolved local path is never authority to fetch material). */
export interface SelectedSource {
  readonly identity: string;
  readonly sourceHash: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
}

/** Safe payload classification (FR-16, AC #3). `unresolved` blocks transfer. */
export type PayloadClassification =
  | 'public'
  | 'internal'
  | 'sensitive'
  | 'unresolved';

/** Transformation/redaction policy applied before transport (AC #1, AC #5). */
export interface TransformationPolicy {
  readonly redactSecrets: boolean;
  readonly extractTextOnly: boolean;
  readonly stripActiveContent: boolean;
  readonly reason: string;
}

/** Recipient capability/version + verified endpoint (AC #1). The endpoint is
 * the verified host; cross-origin redirects are rejected elsewhere (Story 2.7). */
export interface Recipient {
  readonly capabilityId: string;
  readonly capabilityVersion: string;
  readonly verifiedEndpoint: string;
  readonly method: string;
}

/** Retention/deletion handling declared by the verified provider contract
 * (AC #1, AD-28 dimension 5). `unknown` fails closed (AC #3). */
export type RetentionHandling = 'upstream-no-retention-verified' | 'deletion-not-required' | 'deletion-confirmed' | 'unknown';

/** The prepared payload manifest (AC #1). Carries identity + digests + policy
 * + recipient + scope + expiry — NEVER the raw payload bytes. */
export interface PreparedPayloadManifest {
  readonly manifestVersion: number;
  readonly sources: readonly SelectedSource[];
  readonly classification: PayloadClassification;
  readonly purpose: string;
  readonly transformation: TransformationPolicy;
  readonly recipient: Recipient;
  readonly callCount: number;
  readonly retention: RetentionHandling;
  readonly operationId: string;
  readonly promptRoundId: string;
  readonly expiresAt: string | null;
  /** Digest of the canonical manifest (this object minus the digest itself). */
  readonly manifestDigest: string;
  /** Digest of the EXACT payload bytes that would be transported. */
  readonly payloadByteDigest: string;
}

/** Build a manifest, computing the canonical manifest digest and requiring the
 * exact payload-byte digest from the caller (the caller hashes the prepared
 * bytes — this module never sees raw payload). Any `unresolved` classification
 * or `unknown` retention is recorded verbatim; the consent gate fails closed
 * on them (AC #3). */
export function buildPreparedPayloadManifest(input: {
  readonly sources: readonly SelectedSource[];
  readonly classification: PayloadClassification;
  readonly purpose: string;
  readonly transformation: TransformationPolicy;
  readonly recipient: Recipient;
  readonly callCount: number;
  readonly retention: RetentionHandling;
  readonly operationId: string;
  readonly promptRoundId: string;
  readonly expiresAt: string | null;
  readonly payloadByteDigest: string;
}): PreparedPayloadManifest {
  const manifestVersion = PREPARED_PAYLOAD_MANIFEST_VERSION;
  const manifestDigest = computeManifestDigest({ ...input, manifestVersion });
  return { ...input, manifestVersion, manifestDigest };
}

/** Canonical manifest digest — sha256 of a stable canonical JSON of every
 * manifest field except the digest itself. Deterministic so a revalidation can
 * detect any changed field (AC #3). */
export function computeManifestDigest(fields: Omit<PreparedPayloadManifest, 'manifestDigest'>): string {
  const canonical = JSON.stringify({
    manifestVersion: fields.manifestVersion,
    sources: fields.sources,
    classification: fields.classification,
    purpose: fields.purpose,
    transformation: fields.transformation,
    recipient: fields.recipient,
    callCount: fields.callCount,
    retention: fields.retention,
    operationId: fields.operationId,
    promptRoundId: fields.promptRoundId,
    expiresAt: fields.expiresAt,
    payloadByteDigest: fields.payloadByteDigest,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** A bound transfer consent (AC #4). Serialized bound to BOTH the canonical
 * manifest digest AND the exact payload-byte digest + recipient + endpoint +
 * purpose + call count + expiry + op/round scope + activation/authority
 * revision + policy version. Recomputation is required immediately before
 * transport (AC #3, AC #4). */
export interface TransferConsent {
  readonly consentId: string;
  readonly manifestDigest: string;
  readonly payloadByteDigest: string;
  readonly recipientCapabilityId: string;
  readonly recipientCapabilityVersion: string;
  readonly verifiedEndpoint: string;
  readonly purpose: string;
  readonly callCount: number;
  readonly expiresAt: string | null;
  readonly operationId: string;
  readonly promptRoundId: string;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly policyVersion: number;
  readonly granted: true;
  readonly grantedAt: string;
}

export interface TransferConsentInput {
  readonly manifest: PreparedPayloadManifest;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly policyVersion: number;
  readonly clock: () => string;
  readonly consentId?: string;
}

export type ConsentFailureCause =
  | 'classification-unresolved'
  | 'retention-unknown'
  | 'destination-unresolved'
  | 'manifest-digest-mismatch'
  | 'payload-byte-digest-mismatch'
  | 'unsafe-payload'
  | 'expired'
  | 'activation-changed';

export type ConsentEvaluationResult =
  | { readonly ok: true; readonly consent: TransferConsent }
  | { readonly ok: false; readonly cause: ConsentFailureCause; readonly safeExplanation: string };

/** AC #2, AC #3: evaluate a transfer for consent INDEPENDENTLY of local read
 * permission, Work Mode, Profile, or Full Access. Any unresolved field, any
 * digest mismatch vs the current manifest, an expired consent, or unsafe
 * prepared content fails closed with an actionable safe explanation. No
 * provider or service receives the material (this function never transports). */
export function evaluateTransferConsent(input: TransferConsentInput & {
  readonly currentPayloadByteDigest: string;
  readonly now: string;
  readonly sanitizerResult: SanitizeResult;
}): ConsentEvaluationResult {
  const m = input.manifest;
  if (m.classification === 'unresolved') {
    return { ok: false, cause: 'classification-unresolved', safeExplanation: 'Payload classification is unresolved; classify before requesting transfer consent.' };
  }
  if (m.retention === 'unknown') {
    return { ok: false, cause: 'retention-unknown', safeExplanation: 'Recipient retention/deletion handling is unknown; a verified provider contract is required.' };
  }
  if (!m.recipient.verifiedEndpoint) {
    return { ok: false, cause: 'destination-unresolved', safeExplanation: 'Recipient endpoint is not verified; cannot request transfer consent.' };
  }
  // AC #3: recomputation immediately before transport — the manifest digest
  // must still match a freshly computed one (no field changed since build).
  const fresh = computeManifestDigest({
    manifestVersion: m.manifestVersion,
    sources: m.sources,
    classification: m.classification,
    purpose: m.purpose,
    transformation: m.transformation,
    recipient: m.recipient,
    callCount: m.callCount,
    retention: m.retention,
    operationId: m.operationId,
    promptRoundId: m.promptRoundId,
    expiresAt: m.expiresAt,
    payloadByteDigest: m.payloadByteDigest,
  });
  if (fresh !== m.manifestDigest) {
    return { ok: false, cause: 'manifest-digest-mismatch', safeExplanation: 'Manifest changed since preparation; fresh preparation and consent are required.' };
  }
  if (input.currentPayloadByteDigest !== m.payloadByteDigest) {
    return { ok: false, cause: 'payload-byte-digest-mismatch', safeExplanation: 'Payload bytes changed since preparation; fresh preparation and consent are required.' };
  }
  // AC #5: unsafe prepared content blocks the transfer.
  if (!input.sanitizerResult.ok) {
    return { ok: false, cause: 'unsafe-payload', safeExplanation: `Prepared payload contains unsafe content (${input.sanitizerResult.cause}); it will not be transferred.` };
  }
  if (m.expiresAt !== null && m.expiresAt <= input.now) {
    return { ok: false, cause: 'expired', safeExplanation: 'Prepared payload consent window expired; rerun preparation and consent.' };
  }
  const consent: TransferConsent = {
    consentId: input.consentId ?? randomId(),
    manifestDigest: m.manifestDigest,
    payloadByteDigest: m.payloadByteDigest,
    recipientCapabilityId: m.recipient.capabilityId,
    recipientCapabilityVersion: m.recipient.capabilityVersion,
    verifiedEndpoint: m.recipient.verifiedEndpoint,
    purpose: m.purpose,
    callCount: m.callCount,
    expiresAt: m.expiresAt,
    operationId: m.operationId,
    promptRoundId: m.promptRoundId,
    activationId: input.activationId,
    activationRevision: input.activationRevision,
    authorityRevision: input.authorityRevision,
    policyVersion: input.policyVersion,
    granted: true,
    grantedAt: input.clock(),
  };
  return { ok: true, consent };
}

/** AC #5: the ArtifactResolver/Sanitizer boundary. Run the prepared payload
 * through the Sanitizer; a result with omissions downgrades to
 * `sanitized-with-omissions` and a block result is `not-authoritative`. Never
 * returns raw material. */
export interface PreparedPayloadSafetyResult {
  readonly safe: boolean;
  readonly completeness: 'complete' | 'sanitized-with-omissions' | 'not-authoritative';
  readonly omissions: readonly string[];
  readonly cause?: string;
}

export function assessPreparedPayloadSafety(sanitizeResult: SanitizeResult): PreparedPayloadSafetyResult {
  if (!sanitizeResult.ok) {
    return { safe: false, completeness: 'not-authoritative', omissions: sanitizeResult.omissions, cause: sanitizeResult.cause };
  }
  if (sanitizeResult.omissions.length > 0) {
    return { safe: true, completeness: 'sanitized-with-omissions', omissions: sanitizeResult.omissions };
  }
  return { safe: true, completeness: 'complete', omissions: [] };
}

/** Detect unresolved local paths / credentials / unsafe active content markers
 * in prepared payload text (AC #5). Returns the unsafe markers found (never the
 * raw secret). The Sanitizer performs the actual redaction; this is the
 * consent-gate check. */
export function detectUnsafePreparedContent(text: string): { unsafe: boolean; markers: readonly string[] } {
  const markers: string[] = [];
  const sanitized = sanitizer.sanitize(text, 'credential');
  if (!sanitized.ok || sanitized.omissions.length > 0) markers.push('credential-or-secret');
  // An unresolved local path is never authority to fetch material (NFR-4).
  if (/(^|\s)(\/|[A-Za-z]:[\\\/]|\.\/|\.\.\/|\.\.\\)/.test(text)) markers.push('unresolved-local-path');
  if (/<script|javascript:|on\w+\s*=/i.test(text)) markers.push('unsafe-active-content');
  return { unsafe: markers.length > 0, markers };
}

/** Revalidate a granted consent against the CURRENT manifest + activation
 * immediately before transport (AC #3, AC #4). Any change fails closed and
 * makes the prior consent stale. */
export function revalidateTransferConsent(
  consent: TransferConsent,
  current: {
    readonly manifest: PreparedPayloadManifest;
    readonly currentPayloadByteDigest: string;
    readonly activationId: string;
    readonly activationRevision: number;
    readonly authorityRevision: number;
    readonly now: string;
  },
): ConsentEvaluationResult {
  if (consent.activationId !== current.activationId) {
    return { ok: false, cause: 'activation-changed', safeExplanation: 'Runtime Activation changed; fresh consent is required.' };
  }
  if (consent.activationRevision !== current.activationRevision || consent.authorityRevision !== current.authorityRevision) {
    return { ok: false, cause: 'activation-changed', safeExplanation: 'Authority revision changed; fresh consent is required.' };
  }
  return evaluateTransferConsent({
    manifest: current.manifest,
    activationId: current.activationId,
    activationRevision: current.activationRevision,
    authorityRevision: current.authorityRevision,
    policyVersion: consent.policyVersion,
    clock: () => consent.grantedAt,
    currentPayloadByteDigest: current.currentPayloadByteDigest,
    now: current.now,
    sanitizerResult: { ok: true, value: '', omissions: [] },
  }).ok
    ? { ok: true, consent }
    : { ok: false, cause: 'manifest-digest-mismatch', safeExplanation: 'Consent no longer matches the current prepared payload; fresh consent is required.' };
}

function randomId(): string {
  return `consent-${randomUUID()}`;
}