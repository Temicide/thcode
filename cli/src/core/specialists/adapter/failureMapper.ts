// Deterministic failure mapping for Specialist transport responses (Story 4.9).
// Same status → same category + causeCode, always. No Date/random.

import type { SpecialistFailure, SpecialistFailureCategory, Retryability, SpecialistRawResponse, SpecialistTransportResponse } from './types.js';
import { sanitizer } from '../../security/sanitizer.js';

/**
 * Map a transport response (raw or transport error) to a deterministic
 * SpecialistFailure. Pure function — no Date/random/IO.
 *
 * @param response - The transport response (raw success or transport error).
 * @param serviceId - The service identity.
 * @param operationId - The operation identity.
 * @param generationId - The effective configuration generation id.
 * @param startedAt - The request start time (ISO-8601).
 * @param completedAt - The completion time (ISO-8601).
 * @param causeCodeOverride - Optional override for the cause code (used for
 *   malformed-response and quota).
 */
export function mapSpecialistFailure(
  response: SpecialistTransportResponse,
  serviceId: string,
  operationId: string,
  generationId: string,
  startedAt: string,
  completedAt: string,
  causeCodeOverride?: string,
): SpecialistFailure {
  const smallestProvenScope = `${serviceId}#${operationId}#${generationId}`;

  if (!response.ok) {
    // Transport error (timeout, network, aborted)
    const kind = response.transportError.kind;
    const message = response.transportError.message;

    if (kind === 'timeout') {
      return buildFailure({
        category: 'timeout',
        retryability: 'retryable',
        smallestProvenScope,
        effectiveGenerationId: generationId,
        operationId,
        safeMessage: sanitizeMessage(`Specialist request timed out: ${message}`),
        causeCode: 'transport-timeout',
        serviceId,
        completedAt,
      });
    }

    if (kind === 'network') {
      return buildFailure({
        category: 'transport',
        retryability: 'retryable',
        smallestProvenScope,
        effectiveGenerationId: generationId,
        operationId,
        safeMessage: sanitizeMessage(`Specialist request network error: ${message}`),
        causeCode: 'transport-network',
        serviceId,
        completedAt,
      });
    }

    // aborted
    return buildFailure({
      category: 'transport',
      retryability: 'not-retryable',
      smallestProvenScope,
      effectiveGenerationId: generationId,
      operationId,
      safeMessage: sanitizeMessage(`Specialist request aborted: ${message}`),
      causeCode: 'transport-aborted',
      serviceId,
      completedAt,
    });
  }

  // Raw response — map by status code.
  const raw = response.raw;
  return mapByStatus(raw, serviceId, operationId, generationId, startedAt, completedAt, causeCodeOverride);
}

/**
 * Map a raw response by status code to a deterministic failure.
 */
function mapByStatus(
  raw: SpecialistRawResponse,
  serviceId: string,
  operationId: string,
  generationId: string,
  _startedAt: string,
  completedAt: string,
  causeCodeOverride?: string,
): SpecialistFailure {
  const smallestProvenScope = `${serviceId}#${operationId}#${generationId}`;
  const status = raw.status;

  // 401 → unauthorized
  if (status === 401) {
    return buildFailure({
      category: 'unauthorized',
      retryability: 'not-retryable',
      smallestProvenScope,
      effectiveGenerationId: generationId,
      operationId,
      safeMessage: sanitizeMessage('Specialist request was unauthorized (401).'),
      causeCode: 'http-401',
      serviceId,
      completedAt,
    });
  }

  // 403 → forbidden
  if (status === 403) {
    return buildFailure({
      category: 'forbidden',
      retryability: 'not-retryable',
      smallestProvenScope,
      effectiveGenerationId: generationId,
      operationId,
      safeMessage: sanitizeMessage('Specialist request was forbidden (403).'),
      causeCode: 'http-403',
      serviceId,
      completedAt,
    });
  }

  // 404 → not-found
  if (status === 404) {
    return buildFailure({
      category: 'not-found',
      retryability: 'not-retryable',
      smallestProvenScope,
      effectiveGenerationId: generationId,
      operationId,
      safeMessage: sanitizeMessage('Specialist endpoint not found (404).'),
      causeCode: 'http-404',
      serviceId,
      completedAt,
    });
  }

  // 429 → rate-limited (parse Retry-After header)
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(raw.headersSafe);
    const retryability: Retryability = retryAfterMs !== undefined ? 'retry-after-specified' : 'retryable';
    return buildFailure({
      category: 'rate-limited',
      retryability,
      smallestProvenScope,
      effectiveGenerationId: generationId,
      operationId,
      safeMessage: sanitizeMessage('Specialist request was rate-limited (429).'),
      causeCode: 'http-429',
      serviceId,
      completedAt,
      retryAfterMs,
    });
  }

  // 5xx → server-error
  if (status >= 500 && status < 600) {
    return buildFailure({
      category: 'server-error',
      retryability: 'retryable',
      smallestProvenScope,
      effectiveGenerationId: generationId,
      operationId,
      safeMessage: sanitizeMessage(`Specialist server error (${status}).`),
      causeCode: `http-${status}`,
      serviceId,
      completedAt,
    });
  }

  // If a causeCode override is provided (e.g. 'parse-failed', 'quota-exceeded'),
  // use it to determine the category.
  if (causeCodeOverride === 'parse-failed') {
    return buildFailure({
      category: 'malformed-response',
      retryability: 'not-retryable',
      smallestProvenScope,
      effectiveGenerationId: generationId,
      operationId,
      safeMessage: sanitizeMessage('Specialist response could not be parsed.'),
      causeCode: 'parse-failed',
      serviceId,
      completedAt,
    });
  }

  if (causeCodeOverride === 'quota-exceeded') {
    return buildFailure({
      category: 'quota',
      retryability: 'retryable',
      smallestProvenScope,
      effectiveGenerationId: generationId,
      operationId,
      safeMessage: sanitizeMessage('Specialist quota exceeded.'),
      causeCode: 'quota-exceeded',
      serviceId,
      completedAt,
    });
  }

  // Unknown/uncategorized status → unknown-outcome (NOT retryable)
  return buildFailure({
    category: 'unknown-outcome',
    retryability: 'not-retryable',
    smallestProvenScope,
    effectiveGenerationId: generationId,
    operationId,
    safeMessage: sanitizeMessage(`Specialist request returned unexpected status ${status}.`),
    causeCode: 'unknown',
    serviceId,
    completedAt,
  });
}

/**
 * Build a SpecialistFailure from partial fields.
 */
function buildFailure(fields: {
  readonly category: SpecialistFailureCategory;
  readonly retryability: Retryability;
  readonly smallestProvenScope: string;
  readonly effectiveGenerationId: string;
  readonly operationId: string;
  readonly safeMessage: string;
  readonly causeCode: string;
  readonly serviceId: string;
  readonly completedAt: string;
  readonly retryAfterMs?: number;
}): SpecialistFailure {
  const result: SpecialistFailure = {
    ok: false,
    category: fields.category,
    retryability: fields.retryability,
    smallestProvenScope: fields.smallestProvenScope,
    effectiveGenerationId: fields.effectiveGenerationId,
    operationId: fields.operationId,
    safeMessage: fields.safeMessage,
    causeCode: fields.causeCode,
    serviceId: fields.serviceId,
    completedAt: fields.completedAt,
  };
  if (fields.retryAfterMs !== undefined) {
    (result as { retryAfterMs?: number }).retryAfterMs = fields.retryAfterMs;
  }
  return result;
}

/**
 * Parse the Retry-After header from a response's safe headers.
 * Returns milliseconds or undefined if not present.
 */
function parseRetryAfter(
  headersSafe: readonly { readonly name: string; readonly value: string }[],
): number | undefined {
  for (const h of headersSafe) {
    if (h.name.toLowerCase() === 'retry-after') {
      const val = h.value.trim();
      // Try as seconds (integer).
      const seconds = parseInt(val, 10);
      if (!isNaN(seconds) && seconds > 0) {
        return seconds * 1000;
      }
      // Try as HTTP-date (not implemented — return undefined).
      return undefined;
    }
  }
  return undefined;
}

/**
 * Sanitize a message using the sanitizer with 'error-message' content class.
 * Falls back to a safe default if sanitization fails.
 */
function sanitizeMessage(message: string): string {
  const result = sanitizer.sanitize(message, 'error-message');
  return result.ok ? result.value : 'An error occurred during the Specialist request.';
}
