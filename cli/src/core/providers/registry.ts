import type { ProviderAdapter } from './types.js';
import { TyphoonAdapter } from './typhoon.js';
import { pathummaAdapter, openthaigptAdapter, thalleAdapter } from './stubs.js';

export const DEFAULT_PROVIDER_ID = 'typhoon';

export class UnknownProviderError extends Error {
  constructor(id: string) {
    super(`Unknown provider "${id}". Selection is explicit; thcode never silently falls back.`);
    this.name = 'UnknownProviderError';
  }
}

/**
 * Registry of Reasoning Provider adapters with explicit, session-stable
 * selection (ADR 0004). Typhoon is the default. There is NO silent fallback:
 * selecting an unknown id throws instead of quietly reverting to the default,
 * and the selected id only changes on an explicit `select()` call.
 */
export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();
  private currentId: string;

  constructor(defaultId: string = DEFAULT_PROVIDER_ID) {
    this.currentId = defaultId;
  }

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.capabilities.provider, adapter);
  }

  get(id: string): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): ProviderAdapter[] {
    return [...this.adapters.values()];
  }

  get selectedId(): string {
    return this.currentId;
  }

  get selected(): ProviderAdapter {
    const a = this.adapters.get(this.currentId);
    if (!a) throw new UnknownProviderError(this.currentId);
    return a;
  }

  /** Explicit selection. Throws on unknown id — never falls back silently. */
  select(id: string): ProviderAdapter {
    const a = this.adapters.get(id);
    if (!a) throw new UnknownProviderError(id);
    this.currentId = id;
    return a;
  }
}

/** Registry seeded with the Typhoon default plus roadmap stubs. */
export function createDefaultProviderRegistry(): ProviderRegistry {
  const reg = new ProviderRegistry(DEFAULT_PROVIDER_ID);
  reg.register(new TyphoonAdapter());
  reg.register(pathummaAdapter);
  reg.register(openthaigptAdapter);
  reg.register(thalleAdapter);
  return reg;
}
