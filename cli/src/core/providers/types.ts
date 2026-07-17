// Provider-adapter contract (ADR 0004). Each Reasoning Provider adapter reports
// a stable capability descriptor and accepts thcode's normalized message + tool
// schemas, returning either a normalized tool-call proposal or a final response.
// No adapter may silently substitute another model (ADR 0004).

export type Modality = 'text' | 'image' | 'audio' | 'video';

export type AuthState =
  | 'authenticated' // a credential is present (not validated against the network here)
  | 'no-credential' // BYOK key missing from the CredentialStore
  | 'unconfigured'; // adapter has no endpoint configured at all (stub)

/** Static capability descriptor a provider must report (ADR 0004). */
export interface ProviderCapabilities {
  readonly modelId: string;
  readonly provider: string;
  readonly inputModalities: readonly Modality[];
  /**
   * Verified raw context limit in tokens (denominator basis for ADR 0015).
   * `null` means no sourced, verified limit exists yet for this provider/model
   * (PR-4, epics.md Pre-Implementation Gate): no `128k` raw limit or `115,200`
   * fallback capacity may be assumed as a release commitment. Consumers MUST
   * treat `null` as "unverified" and surface the canonical `percentage
   * unavailable` token rather than deriving a numeric percentage from it.
   */
  readonly contextLimit: number | null;
  readonly supportsToolCalls: boolean;
  readonly supportsStreaming: boolean;
  /** Data-handling note surfaced by `/models` and `/status`. */
  readonly dataHandling: string;
}

export interface ProviderAvailability {
  readonly available: boolean;
  readonly authState: AuthState;
  /** Shown to the user when unavailable; never contains secrets. */
  readonly reason?: string;
}

export interface RetryableErrorMeta {
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly kind: 'rate-limit' | 'server' | 'network' | 'auth' | 'client' | 'unknown';
}

export interface NormalizedMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
}

export interface ToolSchema {
  readonly name: string;
  readonly description: string;
  /** JSON-schema-ish parameter object. */
  readonly parameters: Record<string, unknown>;
}

export interface ProviderRequest {
  readonly messages: readonly NormalizedMessage[];
  readonly tools?: readonly ToolSchema[];
  readonly maxOutputTokens?: number;
  readonly signal?: AbortSignal;
}

/** Normalized result: either a final answer or a proposed tool call. */
export type ProviderResult =
  | { readonly kind: 'final'; readonly text: string }
  | { readonly kind: 'tool_call'; readonly toolName: string; readonly input: Record<string, unknown> };

export type TokenSink = (delta: string) => void;

/**
 * A Reasoning Provider adapter. Availability is computed from whether a BYOK
 * credential is present (adapters never read the CredentialStore themselves —
 * the key is injected), so an adapter can report `unavailable` and NEVER crash
 * when no key is configured.
 */
export interface ProviderAdapter {
  readonly capabilities: ProviderCapabilities;
  /** Compute availability given whether a BYOK key exists for this provider. */
  availability(apiKeyPresent: boolean): ProviderAvailability;
  /** Classify an error for retry/rate-limit handling (ADR 0004). */
  classifyError(err: unknown): RetryableErrorMeta;
  /**
   * Execute one turn. `apiKey` is required; callers must check availability
   * first. `onToken` streams text deltas to the UI when supported.
   */
  complete(request: ProviderRequest, apiKey: string, onToken?: TokenSink): Promise<ProviderResult>;
}

/** Thrown by an adapter asked to run without a usable credential/endpoint. */
export class ProviderUnavailableError extends Error {
  constructor(public readonly provider: string, reason: string) {
    super(`Provider "${provider}" unavailable: ${reason}`);
    this.name = 'ProviderUnavailableError';
  }
}
