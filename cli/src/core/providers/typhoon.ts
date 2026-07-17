import {
  ProviderUnavailableError,
  type ProviderAdapter,
  type ProviderAvailability,
  type ProviderCapabilities,
  type ProviderRequest,
  type ProviderResult,
  type RetryableErrorMeta,
  type TokenSink,
  type ToolSchema,
} from './types.js';

const TYPHOON_BASE_URL = 'https://api.opentyphoon.ai/v1';

// Typhoon is the default, primary Reasoning Provider (ADR 0004). It exposes an
// OpenAI-compatible chat completions endpoint, so the request building,
// streaming SSE parse, and tool-call extraction below follow that schema.
export class TyphoonAdapter implements ProviderAdapter {
  readonly capabilities: ProviderCapabilities = {
    modelId: 'typhoon-v2.5-instruct',
    provider: 'typhoon',
    inputModalities: ['text'],
    // PR-4 (epics.md Pre-Implementation Gate): no sourced, verified Typhoon
    // context limit exists yet. `null` is the explicit "unverified" signal —
    // no `128k` raw limit or `115,200` fallback capacity may be assumed as a
    // release commitment. `effectiveContextCapacity()` remains available for
    // when a verified limit is later sourced and injected here; nothing may
    // call it with this unverified literal in the meantime.
    contextLimit: null,
    supportsToolCalls: true,
    supportsStreaming: true,
    dataHandling: 'Requests sent directly from this machine to api.opentyphoon.ai; key stays local (ADR 0007).',
  };

  constructor(private readonly baseUrl: string = TYPHOON_BASE_URL) {}

  availability(apiKeyPresent: boolean): ProviderAvailability {
    if (!apiKeyPresent) {
      return {
        available: false,
        authState: 'no-credential',
        reason: 'No Typhoon API key configured. Run /connect to add one (stored locally via the OS credential-store adapter).',
      };
    }
    return { available: true, authState: 'authenticated' };
  }

  classifyError(err: unknown): RetryableErrorMeta {
    const status = (err as { status?: number })?.status;
    if (status === 429) return { retryable: true, kind: 'rate-limit' };
    if (status !== undefined && status >= 500) return { retryable: true, kind: 'server' };
    if (status === 401 || status === 403) return { retryable: false, kind: 'auth' };
    if (status !== undefined && status >= 400) return { retryable: false, kind: 'client' };
    if (err instanceof TypeError) return { retryable: true, kind: 'network' };
    return { retryable: false, kind: 'unknown' };
  }

  async complete(request: ProviderRequest, apiKey: string, onToken?: TokenSink): Promise<ProviderResult> {
    if (!apiKey) {
      throw new ProviderUnavailableError('typhoon', 'missing API key');
    }

    const body = {
      model: this.capabilities.modelId,
      stream: true,
      max_tokens: request.maxOutputTokens ?? 2048,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(request.tools && request.tools.length > 0
        ? { tools: request.tools.map(toOpenAiTool), tool_choice: 'auto' }
        : {}),
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!res.ok || !res.body) {
      const err = Object.assign(new Error(`Typhoon HTTP ${res.status}`), { status: res.status });
      throw err;
    }

    return parseStream(res.body, onToken);
  }
}

function toOpenAiTool(t: ToolSchema) {
  return {
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  };
}

/**
 * Parse an OpenAI-compatible SSE stream, accumulating assistant text and any
 * tool call. Returns a normalized tool-call proposal if one is present,
 * otherwise the final text.
 */
async function parseStream(
  body: ReadableStream<Uint8Array>,
  onToken?: TokenSink,
): Promise<ProviderResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let toolName: string | undefined;
  let toolArgs = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by blank lines; each carries `data:` lines.
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      for (const line of event.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        let json: any;
        try {
          json = JSON.parse(payload);
        } catch {
          continue;
        }
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        if (typeof delta.content === 'string' && delta.content) {
          text += delta.content;
          onToken?.(delta.content);
        }
        const call = delta.tool_calls?.[0];
        if (call) {
          if (call.function?.name) toolName = call.function.name;
          if (call.function?.arguments) toolArgs += call.function.arguments;
        }
      }
    }
  }

  if (toolName) {
    let input: Record<string, unknown> = {};
    try {
      input = toolArgs ? JSON.parse(toolArgs) : {};
    } catch {
      input = { _raw: toolArgs };
    }
    return { kind: 'tool_call', toolName, input };
  }
  return { kind: 'final', text };
}
