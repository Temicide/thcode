import {
  ProviderUnavailableError,
  type ProviderAdapter,
  type ProviderAvailability,
  type ProviderCapabilities,
  type ProviderResult,
  type RetryableErrorMeta,
} from './types.js';

// Roadmap adapters for the ThaiLLM Playground ecosystem (ADR 0004 MVP limit).
// They are catalogued but report `unconfigured: no endpoint` and never run.
// Real endpoints, auth, and streaming parsers are a future extension point.
class UnconfiguredAdapter implements ProviderAdapter {
  constructor(readonly capabilities: ProviderCapabilities) {}

  availability(): ProviderAvailability {
    return {
      available: false,
      authState: 'unconfigured',
      reason: 'unavailable: no endpoint configured',
    };
  }

  classifyError(): RetryableErrorMeta {
    return { retryable: false, kind: 'unknown' };
  }

  async complete(): Promise<ProviderResult> {
    throw new ProviderUnavailableError(this.capabilities.provider, 'no endpoint configured');
  }
}

function stub(provider: string, modelId: string, contextLimit: number): ProviderAdapter {
  return new UnconfiguredAdapter({
    modelId,
    provider,
    inputModalities: ['text'],
    contextLimit,
    supportsToolCalls: false,
    supportsStreaming: false,
    dataHandling: 'No endpoint configured; adapter is a roadmap stub.',
  });
}

export const pathummaAdapter = stub('pathumma', 'pathumma-llm', 32_000);
export const openthaigptAdapter = stub('openthaigpt', 'openthaigpt-1.5', 32_000);
export const thalleAdapter = stub('thalle', 'thalle-7b', 32_000);
