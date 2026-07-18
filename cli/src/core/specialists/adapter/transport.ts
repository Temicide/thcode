// Specialist transport implementations (Story 4.9).
// InMemorySpecialistTransport for tests + FetchSpecialistTransport for the real
// direct AI-for-Thai call from the local CLI.

import type { SpecialistTransport, SpecialistTransportRequest, SpecialistTransportResponse, SpecialistRawResponse } from './types.js';

// ---------------------------------------------------------------------------
// InMemorySpecialistTransport (testable)
// ---------------------------------------------------------------------------

/** A test-only transport that registers responders keyed by URL or a default
 * responder. Returns the registered response synchronously. */
export class InMemorySpecialistTransport implements SpecialistTransport {
  private readonly responders = new Map<string, (req: SpecialistTransportRequest) => SpecialistTransportResponse>();
  private defaultResponder: ((req: SpecialistTransportRequest) => SpecialistTransportResponse) | null = null;

  /** Register a responder for a specific URL. */
  registerResponder(url: string, responder: (req: SpecialistTransportRequest) => SpecialistTransportResponse): void {
    this.responders.set(url, responder);
  }

  /** Register a default responder (used when no URL-specific match). */
  registerDefaultResponder(responder: (req: SpecialistTransportRequest) => SpecialistTransportResponse): void {
    this.defaultResponder = responder;
  }

  /** Clear all responders. */
  clear(): void {
    this.responders.clear();
    this.defaultResponder = null;
  }

  async send(req: SpecialistTransportRequest): Promise<SpecialistTransportResponse> {
    const responder = this.responders.get(req.url) ?? this.defaultResponder;
    if (!responder) {
      return {
        ok: false,
        transportError: {
          kind: 'network',
          message: `No responder registered for URL: ${req.url}`,
          elapsedMs: 0,
        },
      };
    }
    return responder(req);
  }
}

// ---------------------------------------------------------------------------
// FetchSpecialistTransport (real)
// ---------------------------------------------------------------------------

/** Real transport using global fetch against the verified endpoint. Sets
 * AbortController timeout from timeoutMs. Returns SpecialistRawResponse with
 * sanitized headers — strips Authorization/X-Api-Key from the echoed header
 * subset. On AbortError → timeout, on TypeError → network, on abort → aborted. */
export class FetchSpecialistTransport implements SpecialistTransport {
  readonly transportVersion: string;

  constructor(transportVersion: string = '1.0.0') {
    this.transportVersion = transportVersion;
  }

  async send(req: SpecialistTransportRequest): Promise<SpecialistTransportResponse> {
    const startedAt = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), req.timeoutMs);

      // Build the fetch Headers from the real fetchHeaders (NOT headersSummary).
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.fetchHeaders)) {
        headers.set(key, value);
      }

      // Build the body.
      let body: string | Uint8Array | undefined;
      if (req.bodyKind === 'bytes' && req.bodyBytes) {
        body = req.bodyBytes;
      } else if (req.bodyKind === 'text' && req.bodyText !== undefined) {
        body = req.bodyText;
      }

      let response: Response;
      try {
        response = await globalThis.fetch(req.url, {
          method: req.method,
          headers,
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const elapsedMs = Date.now() - startedAt;
      const completedAt = new Date(startedAt + elapsedMs).toISOString();

      // Read the response body.
      const contentType = response.headers.get('content-type') ?? '';
      let bodyText: string | undefined;
      let bodyBytes: Uint8Array | undefined;

      if (contentType.includes('text') || contentType.includes('json') || contentType.includes('xml')) {
        bodyText = await response.text();
      } else {
        const arrayBuffer = await response.arrayBuffer();
        bodyBytes = new Uint8Array(arrayBuffer);
      }

      // Build sanitized headersSafe — strip Authorization and X-Api-Key.
      const headersSafe: { name: string; value: string }[] = [];
      response.headers.forEach((value, name) => {
        const lower = name.toLowerCase();
        if (lower !== 'authorization' && lower !== 'x-api-key') {
          headersSafe.push({ name, value });
        }
      });

      const raw: SpecialistRawResponse = {
        status: response.status,
        statusText: response.statusText,
        headersSafe,
        bodyBytes,
        bodyText,
        elapsedMs,
        completedAt,
      };

      return { ok: true, raw };
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;

      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          ok: false,
          transportError: {
            kind: 'timeout',
            message: `Request timed out after ${req.timeoutMs}ms.`,
            elapsedMs,
          },
        };
      }

      if (error instanceof TypeError) {
        return {
          ok: false,
          transportError: {
            kind: 'network',
            message: `Network error: ${(error as Error).message}`,
            elapsedMs,
          },
        };
      }

      // Unknown error — treat as network.
      return {
        ok: false,
        transportError: {
          kind: 'network',
          message: `Unexpected transport error: ${(error as Error).message}`,
          elapsedMs,
        },
      };
    }
  }
}
