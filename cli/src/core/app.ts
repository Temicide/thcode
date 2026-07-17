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
import { HealthRegistry, type HealthSnapshot } from './providers/health.js';
import { typhoonGeneration, typhoonHealthProbe } from './providers/typhoonHealth.js';
import { createDefaultToolRegistry, type ToolRegistry } from './tools/registry.js';
import { assertCompatibleVersion, PROTOCOL_MAJOR } from './protocol/coreProtocol.js';

export interface CoreStatus {
  readonly mode: WorkMode;
  readonly profile: PermissionProfile;
  readonly providerId: string;
  readonly modelId: string;
  readonly contextPercent: number;
  readonly healthState: string;
}

export interface CoreAppOptions {
  workspaceRoot?: string;
  credentials?: CredentialStore;
  providers?: ProviderRegistry;
  tools?: ToolRegistry;
  health?: HealthRegistry;
}

export class CoreApp {
  readonly providers: ProviderRegistry;
  readonly tools: ToolRegistry;
  readonly credentials: CredentialStore;
  readonly health: HealthRegistry;
  readonly workspaceRoot: string;

  private mode: WorkMode = NEW_SESSION_DEFAULT.mode;
  private profile: PermissionProfile = NEW_SESSION_DEFAULT.profile;
  private history: NormalizedMessage[] = [];
  private estimatedContextTokens = 0;
  private readonly loop: AgentLoop;

  constructor(opts: CoreAppOptions = {}) {
    // Fail-closed startup: incompatible protocol major version throws before
    // any state is constructed (AD-2).
    assertCompatibleVersion(PROTOCOL_MAJOR);
    this.workspaceRoot = opts.workspaceRoot ?? process.cwd();
    this.credentials = opts.credentials ?? createCredentialStore();
    this.providers = opts.providers ?? createDefaultProviderRegistry();
    this.tools = opts.tools ?? createDefaultToolRegistry();
    this.health = opts.health ?? new HealthRegistry();
    this.loop = new AgentLoop({
      providers: this.providers,
      tools: this.tools,
      credentials: this.credentials,
      workspaceRoot: this.workspaceRoot,
    });
    // Register the Typhoon live probe and wire a generation on startup if a
    // key is present (FR-2, FR-4, AD-8). A live check is run lazily by the
    // caller via checkTyphoonHealth(); availability is never assumed from
    // the presence of a key alone.
    this.health.registerProbe(
      'typhoon',
      typhoonHealthProbe((g) => {
        if (g.providerId !== 'typhoon') return null;
        const syncGet = (this.credentials as unknown as { getSync?: (id: string) => string | null }).getSync;
        return syncGet ? syncGet.call(this.credentials, 'typhoon') : null;
      }),
    );
  }

  /** Live Typhoon health check (FR-2, FR-4, AD-8). Registers the current
   * effective configuration generation and runs the probe; returns the typed
   * health snapshot. Never assumes `available` from a key alone. */
  async checkTyphoonHealth(): Promise<HealthSnapshot> {
    const caps = this.providers.selected.capabilities;
    const syncGet = (this.credentials as unknown as { getSync?: (id: string) => string | null }).getSync;
    const hasKey = syncGet ? syncGet.call(this.credentials, 'typhoon') !== null : false;
    if (!hasKey) {
      this.health.markUnconfigured('typhoon');
      return this.health.snapshot('typhoon');
    }
    const g = typhoonGeneration({
      credentialRevision: `rev-${Date.now().toString(36)}`,
      adapterVersion: '1.0.0',
      modelId: caps.modelId,
    });
    this.health.registerConfiguration(g);
    return this.health.check('typhoon');
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
      healthState: this.health.snapshot(this.providers.selectedId).state,
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
