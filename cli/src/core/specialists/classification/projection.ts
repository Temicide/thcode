// Secret-free projection for classified failures (Story 4.16). Canonical class
// token + scope + retryability + nextAction + safeMessage. NO raw key, Bearer,
// credential, or raw payload data. Pure functions — no Date/random/IO.

import type { FailureClass, ClassifiedFailure, ClassifiedFailureProjection, FailureScope } from './types.js';
import { sanitizer } from '../../security/sanitizer.js';

// ---------------------------------------------------------------------------
// nextAction per class (canonical, secret-free)
// ---------------------------------------------------------------------------

/**
 * Get the canonical next-action string for a failure class. Pure function.
 *
 * @param failureClass - The failure class.
 * @param retryAfterMs - Optional retry-after milliseconds (for quota-rate-limit).
 * @returns The canonical next-action string.
 */
export function nextActionFor(failureClass: FailureClass, retryAfterMs?: number): string {
  switch (failureClass) {
    case 'authentication':
      return 're-onboard the AI-for-Thai credential then explicitly retest';
    case 'entitlement':
      return 'entitlement not permitted for this service';
    case 'protocol-incompatibility':
      return 'contract/endpoint mismatch — correct then explicitly retest';
    case 'configuration-failure':
      return 'correct the endpoint/configuration then explicitly retest';
    case 'transient-network':
      return 'retry the request';
    case 'quota-rate-limit':
      if (retryAfterMs !== undefined) {
        const seconds = Math.ceil(retryAfterMs / 1000);
        return `wait and retry (retry after ${seconds}s)`;
      }
      return 'wait and retry';
    case 'unsupported-input':
      return 'use a supported input';
    case 'failed-health':
      return 'retest health';
    case 'unknown-outcome':
      return 'no automatic retry; retest explicitly';
  }
}

// ---------------------------------------------------------------------------
// Scope rendering (secret-free)
// ---------------------------------------------------------------------------

/**
 * Render a FailureScope to a secret-free string for the projection.
 */
function renderScope(scope: FailureScope): string {
  switch (scope.kind) {
    case 'service':
      return `service:${scope.serviceId}`;
    case 'credential-group':
      return `credential-group:${scope.credentialGroupId} (${scope.members.length} members)`;
    case 'none':
      return 'none';
  }
}

// ---------------------------------------------------------------------------
// projectClassifiedFailure
// ---------------------------------------------------------------------------

/**
 * Project a classified failure into a secret-free ClassifiedFailureProjection.
 * Sanitizes any service-derived text via the shared sanitizer.
 *
 * @param classified - The classified failure.
 * @returns The secret-free projection.
 */
export function projectClassifiedFailure(classified: ClassifiedFailure): ClassifiedFailureProjection {
  // Sanitize the safeMessage (service-derived text) to ensure no secrets leak.
  const sanitizedMessage = sanitizer.sanitize(classified.safeMessage, 'error-message');
  const headerSafeMessage = sanitizedMessage.ok
    ? sanitizer.sanitize(sanitizedMessage.value, 'header')
    : sanitizedMessage;
  const safeMessage = headerSafeMessage.ok
    ? headerSafeMessage.value
    : 'An error occurred during the Specialist request.';

  return {
    heading: 'Failure Classification',
    token: 'failure-classification',
    serviceId: classified.serviceId,
    failureClass: classified.failureClass,
    retryability: classified.retryability,
    scope: renderScope(classified.scope),
    safeMessage,
    causeCode: classified.causeCode,
    evidenceRef: classified.evidenceRef,
    nextAction: nextActionFor(classified.failureClass, classified.retryAfterMs),
    retryAfterMs: classified.retryAfterMs,
  };
}
