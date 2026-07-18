// Credential identity + service-host isolation (Story 2.7, FR-25, AD-11,
// AD-19, AD-21). Each credential reference is bound to ONE verified provider or
// service host. Typhoon is distinct from the AI-for-Thai CredentialGroupId;
// credentials never appear in CoreProtocol projections, prompts, repositories,
// logs, telemetry, crash reports, Sessions, previews, generated content, or UI
// output (FR-25). A credential-boundary violation (Typhoon request routed
// toward AI-for-Thai/SCBx, or vice versa) is denied without contacting the
// destination, with sanitized Evidence (AC #3). A changed credential revision
// or health/configuration generation makes a prior approval/transfer consent
// stale (AC #4). Unresolved Typhoon model/contract pins use the non-affirmative
// `Typhoon version: unverified` token (AC #6).

import { createHash } from 'node:crypto';

/** Canonical credential groups — mutually isolated trust boundaries (FR-25). */
export type CredentialGroupId = 'typhoon' | 'aiforthai' | 'scbx';

/** A secret-free credential identity reference (AC #1). The fingerprint is a
 * hash of the credential revision only — never of the secret value. */
export interface CredentialIdentity {
  readonly credentialGroupId: CredentialGroupId;
  /** Exact provider or service identity, e.g. "typhoon", "aiforthai:t-ocr". */
  readonly serviceIdentity: string;
  /** Verified host/origin the credential may be presented to. */
  readonly verifiedHost: string;
  /** Credential revision — changes when the key is rotated/replaced. */
  readonly credentialRevision: string;
  /** Secret-free fingerprint (hash of revision + identity + host). */
  readonly fingerprint: string;
}

/** The canonical non-affirmative token for an unresolved Typhoon model/contract
 * pin (AC #6). Never claims release governance is complete. */
export const TYPHOON_VERSION_UNVERIFIED = 'Typhoon version: unverified';

/** Compute a secret-free fingerprint from identity + host + revision. The
 * secret value NEVER participates in the fingerprint (FR-25, AD-11). */
export function credentialFingerprint(
  serviceIdentity: string,
  verifiedHost: string,
  credentialRevision: string,
): string {
  return createHash('sha256').update(`${serviceIdentity}|${verifiedHost}|${credentialRevision}`).digest('hex').slice(0, 16);
}

export function buildCredentialIdentity(input: {
  readonly credentialGroupId: CredentialGroupId;
  readonly serviceIdentity: string;
  readonly verifiedHost: string;
  readonly credentialRevision: string;
}): CredentialIdentity {
  return {
    credentialGroupId: input.credentialGroupId,
    serviceIdentity: input.serviceIdentity,
    verifiedHost: input.verifiedHost,
    credentialRevision: input.credentialRevision,
    fingerprint: credentialFingerprint(input.serviceIdentity, input.verifiedHost, input.credentialRevision),
  };
}

/** A request for a credential, restricted to the exact verified host + service
 * identity (AC #2). */
export interface CredentialRequest {
  readonly credentialGroupId: CredentialGroupId;
  readonly serviceIdentity: string;
  readonly requestedHost: string;
  readonly tlsVerified: boolean;
  readonly redirectAccepted: boolean;
}

export type CredentialBoundaryResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly cause: 'cross-origin-redirect' | 'tls-bypass' | 'host-mismatch' | 'credential-in-url' | 'group-mismatch'; readonly safeExplanation: string };

/** AC #2: validate a credential request against its exact verified host + service
 * identity. Rejects cross-origin redirects, TLS bypass/downgrade, host mismatch,
 * and credential-in-URL cases. Does NOT implement onboarding. */
export function validateCredentialRequest(request: CredentialRequest, verifiedHost: string): CredentialBoundaryResult {
  if (request.redirectAccepted) {
    return { ok: false, cause: 'cross-origin-redirect', safeExplanation: 'Cross-origin redirect refused; credential is bound to the verified host.' };
  }
  if (!request.tlsVerified) {
    return { ok: false, cause: 'tls-bypass', safeExplanation: 'TLS verification bypass/downgrade refused for credential presentation.' };
  }
  if (request.requestedHost !== verifiedHost) {
    return { ok: false, cause: 'host-mismatch', safeExplanation: 'Requested host does not match the verified host for this credential.' };
  }
  return { ok: true };
}

/** AC #3: a request to route one group's credential toward another group's
 * service host is a credential-boundary violation. Denied without contacting
 * the destination; sanitized Evidence only. */
export function checkCredentialBoundary(
  request: { readonly credentialGroupId: CredentialGroupId; readonly targetGroupId: CredentialGroupId },
): CredentialBoundaryResult {
  if (request.credentialGroupId !== request.targetGroupId) {
    return {
      ok: false,
      cause: 'group-mismatch',
      safeExplanation: `Credential-boundary violation: ${request.credentialGroupId} credential cannot be presented to a ${request.targetGroupId} service host.`,
    };
  }
  return { ok: true };
}

/** AC #4: a credential revision / health-configuration-generation change makes
 * a prior approval or transfer consent stale. Returns true when the authority
 * must be re-evaluated (a changed credential cannot silently reuse a prior
 * authorization). */
export function isCredentialAuthorityStale(input: {
  readonly approvedCredentialRevision: string;
  readonly currentCredentialRevision: string;
  readonly approvedHealthGeneration?: string;
  readonly currentHealthGeneration?: string;
}): boolean {
  if (input.approvedCredentialRevision !== input.currentCredentialRevision) return true;
  if (input.approvedHealthGeneration !== undefined && input.currentHealthGeneration !== undefined) {
    if (input.approvedHealthGeneration !== input.currentHealthGeneration) return true;
  }
  return false;
}

/** AC #1, AC #5: a secret-free connection-info projection safe for logs,
 * prompts, context, transcript, activity, Evidence, accessibility output,
 * clipboard, crash handling, preview, redirected output, and headless JSON.
 * Only identity, host, revision, and sanitized failure information appear —
 * raw credentials and authorization headers never appear (FR-25, AD-24). */
export interface ConnectionInfoProjection {
  readonly credentialGroupId: CredentialGroupId;
  readonly serviceIdentity: string;
  readonly verifiedHost: string;
  readonly credentialRevision: string;
  readonly fingerprint: string;
  /** `TYPHOON_VERSION_UNVERIFIED` until a verified pin exists (AC #6). */
  readonly modelPin: string;
}

export function projectConnectionInfo(identity: CredentialIdentity, modelPin: string | null): ConnectionInfoProjection {
  return {
    credentialGroupId: identity.credentialGroupId,
    serviceIdentity: identity.serviceIdentity,
    verifiedHost: identity.verifiedHost,
    credentialRevision: identity.credentialRevision,
    fingerprint: identity.fingerprint,
    modelPin: modelPin ?? TYPHOON_VERSION_UNVERIFIED,
  };
}

/** AC #5: scrub any raw credential / authorization header from a string before
 * it enters a log, prompt, context, transcript, preview, or JSON output. Returns
 * the scrubbed text plus the markers redacted (never the secret). This is a
 * defense-in-depth gate alongside the Sanitizer; it specifically targets
 * connection/authorization material. */
export function scrubConnectionSecrets(text: string): { readonly value: string; readonly redacted: readonly string[] } {
  const redacted: string[] = [];
  let value = text;
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /Authorization:\s*[^\n\r]+/gi, label: 'Authorization header' },
    { re: /X-Api-Key:\s*[^\n\r]+/gi, label: 'X-Api-Key header' },
    { re: /Bearer\s+[A-Za-z0-9._-]{8,}/gi, label: 'Bearer token' },
    { re: /sk-[A-Za-z0-9]{16,}/g, label: 'API key' },
    { re: /([?&](api[_-]?key|token|secret|password|auth)=[^&\s]+)/gi, label: 'credential-in-URL' },
  ];
  for (const p of patterns) {
    if (p.re.test(value)) {
      redacted.push(p.label);
      value = value.replace(p.re, '[redacted]');
    }
  }
  return { value, redacted };
}