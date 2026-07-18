// SpecialistHealthLifecycle (Story 4.4). Wraps the shared HealthRegistry to
// enforce the full specialist health lifecycle:
//   unconfigured → configured → checking → available | unavailable | unhealthy | quarantined
// Stale/mismatched/superseded generation results are rejected by the underlying
// HealthRegistry (AD-18). The lifecycle stores the richer
// SpecialistEffectiveConfiguration and projects it to EffectiveConfigurationGeneration
// for the shared registry.

import { HealthRegistry, type HealthProbe, type HealthProbeResult, type HealthSnapshot } from '../../providers/health.js';
import type {
  SpecialistEffectiveConfiguration,
  SpecialistHealthProbe,
  SpecialistHealthSnapshot,
} from './types.js';
import { projectToHealthGeneration } from './generation.js';

/**
 * Wraps the shared HealthRegistry to enforce the specialist health lifecycle.
 * Keeps a Map of serviceId → SpecialistEffectiveConfiguration and
 * serviceId → SpecialistHealthProbe. The probe adapter looks up the stored
 * specialist config by the incoming EffectiveConfigurationGeneration.id
 * (matched by digest) and calls the specialist probe.
 */
export class SpecialistHealthLifecycle {
  private readonly registry: HealthRegistry;
  private readonly configs = new Map<string, SpecialistEffectiveConfiguration>();
  private readonly probes = new Map<string, SpecialistHealthProbe>();
  private readonly clock: () => string;

  constructor(clock?: () => string) {
    this.clock = clock ?? (() => new Date().toISOString());
    this.registry = new HealthRegistry(this.clock);
  }

  /** Access the underlying HealthRegistry (for direct inspection). */
  get healthRegistry(): HealthRegistry {
    return this.registry;
  }

  /**
   * Register a SpecialistEffectiveConfiguration. Stores the config and
   * projects it to an EffectiveConfigurationGeneration in the HealthRegistry,
   * transitioning the service to `configured`. Supersedes any prior generation.
   */
  register(config: SpecialistEffectiveConfiguration): void {
    this.configs.set(config.serviceId, config);
    this.registry.registerConfiguration(projectToHealthGeneration(config));
  }

  /**
   * Register a SpecialistHealthProbe for a service. Stores the probe and
   * registers an adapter HealthProbe with the HealthRegistry that looks up
   * the stored specialist config by the incoming generation id (matched by
   * digest) and calls the specialist probe.
   */
  registerProbe(serviceId: string, probe: SpecialistHealthProbe): void {
    this.probes.set(serviceId, probe);

    const adapter: HealthProbe = async (gen): Promise<HealthProbeResult> => {
      // Look up the stored specialist config by matching the generation id
      // (which is the digest-based id). If the config is not found, return
      // a configuration failure.
      const config = this.configs.get(gen.providerId);
      if (!config || config.id !== gen.id) {
        return {
          ok: false,
          failure: {
            category: 'configuration',
            retryable: false,
            scope: gen.providerId,
            generationId: gen.id,
            safeMessage: 'Specialist configuration not found for this generation.',
            causeCode: 'config-not-found',
          },
        };
      }

      // Call the specialist probe with the full SpecialistEffectiveConfiguration.
      return probe(config);
    };

    this.registry.registerProbe(serviceId, adapter);
  }

  /**
   * Run a live health check for a service. Returns the health snapshot.
   * If no probe is registered, the HealthRegistry returns a `probe-missing`
   * configuration failure (correct until Stories 4.10–4.13 register probes).
   */
  async check(serviceId: string): Promise<SpecialistHealthSnapshot> {
    const snap = await this.registry.check(serviceId);
    return this.toSpecialistSnapshot(serviceId, snap);
  }

  /**
   * Quarantine a service (e.g. shared credential rejected). The service stays
   * unselectable until an explicit retest passes.
   */
  quarantine(serviceId: string, cause: string): SpecialistHealthSnapshot {
    const snap = this.registry.quarantine(serviceId, cause);
    return this.toSpecialistSnapshot(serviceId, snap);
  }

  /**
   * Atomically quarantine current, configured generations. Every target is
   * checked before the first mutation so a stale or unconfigured group member
   * can never yield a partially quarantined credential group (AD-18).
   */
  quarantineMany(
    targets: readonly { readonly serviceId: string; readonly generationId: string }[],
    cause: string,
  ):
    | { readonly ok: true; readonly snapshots: readonly SpecialistHealthSnapshot[] }
    | { readonly ok: false; readonly cause: 'unconfigured' | 'stale-generation' } {
    for (const target of targets) {
      const snapshot = this.snapshot(target.serviceId);
      if (snapshot.state === 'unconfigured' || snapshot.generationId === undefined) {
        return { ok: false, cause: 'unconfigured' };
      }
      if (snapshot.generationId !== target.generationId) {
        return { ok: false, cause: 'stale-generation' };
      }
    }

    return {
      ok: true,
      snapshots: targets.map((target) => this.quarantine(target.serviceId, cause)),
    };
  }

  /** Return the currently registered effective configuration, if any. */
  configuration(serviceId: string): SpecialistEffectiveConfiguration | undefined {
    return this.configs.get(serviceId);
  }

  /**
   * Mark a service as unconfigured. Clears the stored config and probe, and
   * removes the generation from the HealthRegistry.
   */
  markUnconfigured(serviceId: string): SpecialistHealthSnapshot {
    this.configs.delete(serviceId);
    this.probes.delete(serviceId);
    this.registry.markUnconfigured(serviceId);
    return { serviceId, state: 'unconfigured' };
  }

  /** Get the current health snapshot for a service. */
  snapshot(serviceId: string): SpecialistHealthSnapshot {
    const snap = this.registry.snapshot(serviceId);
    return this.toSpecialistSnapshot(serviceId, snap);
  }

  /** True only when the current generation is `available`. */
  isAvailable(serviceId: string): boolean {
    return this.registry.isAvailable(serviceId);
  }

  /** All health snapshots. */
  snapshots(): SpecialistHealthSnapshot[] {
    return this.registry.snapshots().map((s) => this.toSpecialistSnapshot(s.providerId, s));
  }

  /** Map a HealthSnapshot to a SpecialistHealthSnapshot. */
  private toSpecialistSnapshot(
    serviceId: string,
    snap: HealthSnapshot,
  ): SpecialistHealthSnapshot {
    return {
      serviceId,
      state: snap.state,
      generationId: snap.generationId,
      endpoint: snap.endpoint,
      failure: snap.failure,
      evidence: snap.evidence,
      checkedAt: snap.checkedAt,
    };
  }
}
