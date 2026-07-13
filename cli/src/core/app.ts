// CoreApp: the stable application-facing interface of the headless core
// (ADR 0020). UI layers (Ink today; desktop/web/IDE later) interact ONLY
// through this facade via typed intents — never touching fs, network, or
// child_process directly.

import { AgentLoop, type ApprovalCallback } from './agent/loop.js';
import { ToolCatalog } from './catalog/loader.js';
import { contextUtilizationPercent, effectiveContextCapacity } from './context/types.js';
import { NEW_SESSION_DEFAULT, type PermissionProfile, type WorkMode } from './permissions/types.js';
import { createCredentialStore, type CredentialStore } from './platform/index.js';
import { createDefaultProviderRegistry, ProviderRegistry } from './providers/registry.js';
import type { NormalizedMessage } from './providers/types.js';
import { createDefaultToolRegistry, type ToolRegistry } from './tools/registry.js';

export interface CoreStatus {
  readonly mode: WorkMode;
  readonly profile: PermissionProfile;
  readonly providerId: string;
  readonly modelId: string;
  readonly contextPercent: number;
}

export interface CoreAppOptions {
  workspaceRoot?: string;
  credentials?: CredentialStore;
  providers?: ProviderRegistry;
  tools?: ToolRegistry;
}

export class CoreApp {
  readonly providers: ProviderRegistry;
  readonly tools: ToolRegistry;
  readonly credentials: CredentialStore;
  readonly workspaceRoot: string;

  private mode: WorkMode = NEW_SESSION_DEFAULT.mode;
  private profile: PermissionProfile = NEW_SESSION_DEFAULT.profile;
  private history: NormalizedMessage[] = [];
  private estimatedContextTokens = 0;
  private readonly loop: AgentLoop;

  constructor(opts: CoreAppOptions = {}) {
    this.workspaceRoot = opts.workspaceRoot ?? process.cwd();
    this.credentials = opts.credentials ?? createCredentialStore();
    this.providers = opts.providers ?? createDefaultProviderRegistry();
    this.tools = opts.tools ?? createDefaultToolRegistry();
    this.loop = new AgentLoop({
      providers: this.providers,
      tools: this.tools,
      credentials: this.credentials,
      workspaceRoot: this.workspaceRoot,
    });
  }

  status(): CoreStatus {
    const caps = this.providers.selected.capabilities;
    const capacity = effectiveContextCapacity(caps.contextLimit);
    return {
      mode: this.mode,
      profile: this.profile,
      providerId: this.providers.selectedId,
      modelId: caps.modelId,
      contextPercent: contextUtilizationPercent(this.estimatedContextTokens, capacity),
    };
  }

  setMode(mode: WorkMode): void {
    this.mode = mode;
  }

  toggleMode(): WorkMode {
    this.mode = this.mode === 'plan' ? 'build' : 'plan';
    return this.mode;
  }

  setProfile(profile: PermissionProfile): void {
    this.profile = profile;
  }

  /** `/models` listing: adapters with availability + reasons (ADR 0004). */
  async listModels(): Promise<string[]> {
    const lines: string[] = [];
    for (const a of this.providers.list()) {
      const key = await this.credentials.get(a.capabilities.provider);
      const avail = a.availability(key !== null);
      const marker = a.capabilities.provider === this.providers.selectedId ? '*' : ' ';
      const state = avail.available ? 'available' : `unavailable — ${avail.reason ?? 'not configured'}`;
      lines.push(`${marker} ${a.capabilities.provider} (${a.capabilities.modelId}): ${state}`);
    }
    return lines;
  }

  /** `/tools` view of the Catalog Manifest (ADR 0011). */
  listCatalog(): string[] {
    try {
      const catalog = ToolCatalog.load();
      const header = `Catalog Manifest v${catalog.version} (observed ${catalog.observationDate})`;
      return [
        header,
        ...catalog
          .all()
          .map((s) => `  ${s.id} [${s.category}/${s.modality}] — ${s.upstreamName} (${s.supportLevel})`),
      ];
    } catch (e) {
      return [`Catalog unavailable: ${(e as Error).message}`];
    }
  }

  async runTurn(
    input: string,
    approve: ApprovalCallback = async () => false,
    onToken?: (delta: string) => void,
  ): Promise<string> {
    const result = await this.loop.runTurn(
      input,
      { mode: this.mode, profile: this.profile, history: this.history },
      approve,
      onToken,
    );
    this.history = [...result.history];
    this.estimatedContextTokens = Math.ceil(
      this.history.reduce((n, m) => n + m.content.length, 0) / 4,
    );
    return result.text;
  }
}
