// SharedSpecialistAdapter — orchestrates the full Specialist invocation lifecycle
// (Story 4.9). validate → lookup handler → credential scope → build transport
// request → send → parse result OR map failure → build SpecialistResult with
// full attribution. NEVER throws — catches and returns unknown-outcome failure.

import { randomUUID } from 'node:crypto';
import { sanitizer } from '../../security/sanitizer.js';
import type {
  SpecialistRequest,
  SpecialistInvocation,
  SpecialistResult,
  SpecialistFailure,
  SpecialistTransport,
  SpecialistServiceHandler,
  CredentialScope,
  SpecialistAdapterRefusal,
} from './types.js';
import type { CapabilityRegistryEntry } from '../registry/types.js';
import type { SpecialistHealthSnapshot } from '../health/types.js';
import { validateSpecialistRequest } from './validation.js';
import { mapSpecialistFailure } from './failureMapper.js';

/** Shared Specialist adapter that orchestrates the full invocation lifecycle.
 * Holds a resolveRawKey closure (injected by app.ts from credentials persistence)
 * and hands a CredentialScope to the handler — the key lives only in the handler
 * closure during buildTransportRequest. */
export class SharedSpecialistAdapter {
  private readonly transport: SpecialistTransport;
  private readonly clock: () => string;
  private readonly resolveRawKey: () => Promise<string>;
  private readonly handlers = new Map<string, SpecialistServiceHandler>();

  constructor(opts: {
    readonly transport: SpecialistTransport;
    readonly clock: () => string;
    readonly resolveRawKey: () => Promise<string>;
    readonly handlers?: readonly SpecialistServiceHandler[];
  }) {
    this.transport = opts.transport;
    this.clock = opts.clock;
    this.resolveRawKey = opts.resolveRawKey;
    if (opts.handlers) {
      for (const h of opts.handlers) {
        this.handlers.set(h.serviceId, h);
      }
    }
  }

  /** Register a handler for a service. */
  registerHandler(handler: SpecialistServiceHandler): void {
    this.handlers.set(handler.serviceId, handler);
  }

  /** Invoke a Specialist service. Orchestrates the full lifecycle:
   * validate → lookup handler → credential scope → build transport request →
   * send → parse result OR map failure → build SpecialistResult.
   * NEVER throws — catches and returns unknown-outcome failure. */
  async invoke(
    request: SpecialistRequest,
    registryEntry: CapabilityRegistryEntry,
    healthSnapshot: SpecialistHealthSnapshot,
  ): Promise<SpecialistInvocation> {
    try {
      // 1. Validate (fail-closed before transport).
      const refusal = validateSpecialistRequest(request, registryEntry, healthSnapshot);
      if (refusal) {
        return refusal;
      }

      // 2. Look up handler.
      const handler = this.handlers.get(request.serviceId);
      if (!handler) {
        return buildHandlerNotRegisteredRefusal(request);
      }

      // 3. Build credential scope (in-scope-only key resolution).
      const credentialScope: CredentialScope = {
        resolveRawKey: this.resolveRawKey,
      };

      // 4. Build transport request via handler (key lives only in this scope).
      const transportRequest = await handler.buildTransportRequest(request, credentialScope);

      // 5. Send via transport.
      const transportResponse = await this.transport.send(transportRequest);

      // 6. Handle transport error.
      if (!transportResponse.ok) {
        return mapSpecialistFailure(
          transportResponse,
          request.serviceId,
          request.operationId,
          request.effectiveConfiguration.id,
          request.startedAt,
          this.clock(),
        );
      }

      const raw = transportResponse.raw;

      // 7. Parse result via handler.
      const parseResult = handler.parseResult(raw, request);

      if (!parseResult.ok) {
        // Parse failure → malformed-response failure.
        return mapSpecialistFailure(
          { ok: true, raw },
          request.serviceId,
          request.operationId,
          request.effectiveConfiguration.id,
          request.startedAt,
          this.clock(),
          'parse-failed',
        );
      }

      // 8. Build SpecialistResult with full attribution.
      return buildSpecialistResult(parseResult, request, raw, transportRequest.method, this.clock);
    } catch (error) {
      // Catch-all: wrap any unexpected error as unknown-outcome failure.
      // NEVER retry an unknown outcome. Sanitize the message so a thrown error
      // cannot leak the raw key, a stack trace, or a secret path into Evidence.
      const errorMessage = error instanceof Error ? error.message : String(error);
      const raw = sanitizer.sanitize(
        `Unexpected error during Specialist invocation: ${errorMessage}`,
        'error-message',
      );
      const safeMessage = raw.ok ? raw.value : 'Unexpected error during Specialist invocation.';
      return {
        ok: false,
        category: 'unknown-outcome',
        retryability: 'not-retryable',
        smallestProvenScope: `${request.serviceId}#${request.operationId}#${request.effectiveConfiguration.id}`,
        effectiveGenerationId: request.effectiveConfiguration.id,
        operationId: request.operationId,
        safeMessage,
        causeCode: 'unknown',
        serviceId: request.serviceId,
        completedAt: this.clock(),
      } satisfies SpecialistFailure;
    }
  }
}

/**
 * Build a handler-not-registered refusal.
 */
function buildHandlerNotRegisteredRefusal(request: SpecialistRequest): SpecialistAdapterRefusal {
  return {
    ok: false,
    refused: true,
    cause: 'handler-not-registered',
    safeMessage: `No handler registered for service "${request.serviceId}".`,
    operationId: request.operationId,
    serviceId: request.serviceId,
  };
}

/**
 * Build a SpecialistResult with full attribution from the handler's parse result.
 */
function buildSpecialistResult(
  result: SpecialistResult,
  request: SpecialistRequest,
  raw: { status: number; statusText: string; elapsedMs: number; completedAt: string },
  method: string,
  clock: () => string,
): SpecialistResult {
  const now = clock();
  const evidenceRef = `ev-${randomUUID()}`;

  // Derive emptyFields from the fields' `present` flag (single source of truth).
  // A field is empty/absent iff its SpecialistFieldValue.present is false; this
  // stays consistent with the field representation and avoids double-counting.
  const emptyFields: string[] = [];
  for (const [key, field] of Object.entries(result.fields)) {
    if (!field.present) {
      emptyFields.push(key);
    }
  }

  return {
    ok: true,
    serviceId: result.serviceId,
    serviceIdentity: result.serviceIdentity,
    configurationGenerationId: request.effectiveConfiguration.id,
    consentReference: request.consentReference,
    sourceContentHash: request.preparedManifest.payloadByteDigest,
    fields: result.fields,
    emptyFields,
    confidence: result.confidence,
    uncertainty: result.uncertainty,
    timing: {
      startedAt: request.startedAt,
      completedAt: raw.completedAt,
      elapsedMs: raw.elapsedMs,
    },
    provenance: {
      endpoint: request.effectiveConfiguration.endpoint,
      method,
      status: raw.status,
      transportVersion: '1.0.0',
    },
    sanitizedRawResponseRef: `raw-${randomUUID()}`,
    evidenceRef,
    createdAt: now,
  };
}
