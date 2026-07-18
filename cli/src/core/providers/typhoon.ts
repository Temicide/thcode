import { ProviderUnavailableError, type ProviderAdapter, type ProviderAvailability, type ProviderCapabilities, type ProviderFinalizationInput, type ProviderRequest, type ProviderResult, type ProviderUsage, type RetryableErrorMeta, type TokenSink, type ToolSchema, type FinalizedProviderRequest } from './types.js';
import { digestBytes } from '../context/manifest.js';
const TYPHOON_BASE_URL = 'https://api.opentyphoon.ai/v1';
export class TyphoonAdapter implements ProviderAdapter {
  readonly capabilities: ProviderCapabilities = { modelId: 'typhoon-v2.5-instruct', provider: 'typhoon', inputModalities: ['text'], contextLimit: null, supportsToolCalls: true, supportsStreaming: true, dataHandling: 'Requests sent directly from this machine to api.opentyphoon.ai; key stays local (ADR 0007).' };
  constructor(private readonly baseUrl: string = TYPHOON_BASE_URL) {}
  availability(apiKeyPresent: boolean): ProviderAvailability { return apiKeyPresent ? { available: true, authState: 'authenticated' } : { available: false, authState: 'no-credential', reason: 'No Typhoon API key configured. Run /connect to add one (stored locally via the OS credential-store adapter).' }; }
  classifyError(err: unknown): RetryableErrorMeta { const status = (err as { status?: number })?.status; if (status === 429) return { retryable: true, kind: 'rate-limit' }; if (status !== undefined && status >= 500) return { retryable: true, kind: 'server' }; if (status === 401 || status === 403) return { retryable: false, kind: 'auth' }; if (status !== undefined && status >= 400) return { retryable: false, kind: 'client' }; if (err instanceof TypeError) return { retryable: true, kind: 'network' }; return { retryable: false, kind: 'unknown' }; }
  finalize(input: ProviderFinalizationInput): FinalizedProviderRequest { const body = { model: this.capabilities.modelId, stream: true, max_tokens: input.maxOutputTokens ?? 2048, messages: input.messages.map((m) => ({ role: m.role, content: m.content })), ...(input.tools && input.tools.length > 0 ? { tools: input.tools.map(toOpenAiTool), tool_choice: 'auto' } : {}) }; const bytes = new TextEncoder().encode(JSON.stringify(body)); return Object.freeze({ bytes, digest: digestBytes(bytes), manifest: input.manifest }); }
  async complete(request: ProviderRequest, apiKey: string, onToken?: TokenSink): Promise<ProviderResult> {
    if (!apiKey) throw new ProviderUnavailableError('typhoon', 'missing API key');
    const finalized = request.finalized;
    if (!finalized || finalized.bytes.byteLength === 0 || finalized.digest !== digestBytes(finalized.bytes)
      || finalized.manifest.requestBytesDigest !== finalized.digest
      || finalized.manifest.requestBytesLength !== finalized.bytes.byteLength
      || finalized.manifest.providerId !== this.capabilities.provider
      || finalized.manifest.modelId !== this.capabilities.modelId) {
      throw new Error('provider request must be finalized with valid manifest-bound non-empty bytes');
    }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(finalized.bytes)); } catch { throw new Error('provider request bytes are not valid JSON'); }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('provider request bytes must encode an object');
    const body = parsed as Record<string, unknown>;
    if (body.model !== this.capabilities.modelId || body.stream !== true || !Array.isArray(body.messages)) throw new Error('provider request bytes have invalid Typhoon shape');
    const expected = this.finalize({
      messages: request.messages,
      tools: request.tools,
      maxOutputTokens: typeof body.max_tokens === 'number' ? body.max_tokens : undefined,
      manifest: finalized.manifest,
    });
    if (expected.digest !== finalized.digest || expected.bytes.byteLength !== finalized.bytes.byteLength
      || new TextDecoder().decode(expected.bytes) !== new TextDecoder().decode(finalized.bytes)) {
      throw new Error('provider request bytes do not match the finalized request input');
    }
    const res = await fetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: new TextDecoder().decode(finalized.bytes), signal: request.signal });
    if (!res.ok || !res.body) throw Object.assign(new Error(`Typhoon HTTP ${res.status}`), { status: res.status });
    return parseStream(res.body, onToken);
  }
}
function toOpenAiTool(t: ToolSchema) { return { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }; }
async function parseStream(body: ReadableStream<Uint8Array>, onToken?: TokenSink): Promise<ProviderResult> { const reader = body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let text = ''; let toolName: string | undefined; let toolArgs = ''; let usage: ProviderUsage | undefined; for (;;) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split(/\r?\n\r?\n/); buffer = events.pop() ?? ''; for (const event of events) for (const line of event.split(/\r?\n/)) { const trimmed = line.trim(); if (!trimmed.startsWith('data:')) continue; const payload = trimmed.slice(5).trim(); if (payload === '[DONE]') continue; let json: unknown; try { json = JSON.parse(payload); } catch { continue; } const obj = json as { choices?: readonly { delta?: { content?: unknown; tool_calls?: readonly { function?: { name?: unknown; arguments?: unknown } }[] } }[]; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; prompt_tokens_details?: { cached_tokens?: unknown } } }; const reported = obj.usage; if (reported && typeof reported.prompt_tokens === 'number' && Number.isInteger(reported.prompt_tokens) && reported.prompt_tokens >= 0 && typeof reported.completion_tokens === 'number' && Number.isInteger(reported.completion_tokens) && reported.completion_tokens >= 0) {
          const cached = typeof reported.prompt_tokens_details?.cached_tokens === 'number' && Number.isInteger(reported.prompt_tokens_details.cached_tokens) && reported.prompt_tokens_details.cached_tokens >= 0 ? reported.prompt_tokens_details.cached_tokens : 0;
          if (cached <= reported.prompt_tokens) usage = { inputTokens: reported.prompt_tokens, outputTokens: reported.completion_tokens, cachedInputTokens: cached };
        } const delta = obj.choices?.[0]?.delta; if (!delta) continue; if (typeof delta.content === 'string' && delta.content) { text += delta.content; onToken?.(delta.content); } const call = delta.tool_calls?.[0]; if (call) { if (typeof call.function?.name === 'string') toolName = call.function.name; if (typeof call.function?.arguments === 'string') toolArgs += call.function.arguments; } } } if (toolName) { try { return { kind: 'tool_call', toolName, input: toolArgs ? JSON.parse(toolArgs) as Record<string, unknown> : {}, usage }; } catch { return { kind: 'tool_call', toolName, input: { _raw: '[malformed tool arguments]' }, usage }; } } return { kind: 'final', text, usage }; }
