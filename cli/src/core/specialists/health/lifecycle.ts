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
  SpecialistRetestRequest,
  SpecialistRetestResult,
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
      // Cancellation/unknown are deliberately converted to unavailable health
      // evidence; the explicit retest API reads the typed cause and never
      // promotes either outcome to availability.
      const result = await probe(config);
      if ('outcome' in result) {
        return {
          ok: false,
          failure: {
            category: 'unknown',
            retryable: false,
            scope: serviceId,
            generationId: config.id,
            safeMessage: result.safeReason ?? `Specialist retest ${result.outcome}.`,
            causeCode: `retest-${result.outcome}`,
          },
        };
      }
      return result;
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
   * Run one explicit, generation-bound retest. Registration happens before the
   * probe so every retest has a fresh generation and enters `checking`; only a
   * current pass can restore availability. This is intentionally separate from
   * catalog advice and normal/background health checks.
   */
  async retest(
    request: SpecialistRetestRequest,
    configuration: SpecialistEffectiveConfiguration,
  ): Promise<SpecialistRetestResult> {
    const prior = this.snapshot(request.serviceId);
    this.register(configuration);
    const checked = await this.check(request.serviceId);
    const stale = checked.generationId !== configuration.id;
    const failureCause = checked.failure?.causeCode;
    const outcome = checked.state === 'available' && !stale
      ? 'passed'
      : stale
        ? 'stale'
        : failureCause === 'retest-cancelled'
          ? 'cancelled'
          : failureCause === 'retest-unknown'
            ? 'unknown'
            : 'failed';

    // A failed explicit retest cannot clear a prior quarantine. Other failed
    // outcomes remain in the lifecycle's typed unavailable/unhealthy state.
    if (outcome !== 'passed' && prior.state === 'quarantined') {
      this.quarantine(request.serviceId, prior.failure?.safeMessage ?? 'Retest did not restore the quarantined service.');
    }
    const finalSnapshot = this.snapshot(request.serviceId);
    return {
      ok: outcome === 'passed',
      operationId: request.operationId,
      serviceId: request.serviceId,
      scope: request.scope ?? 'service',
      outcome,
      generationId: configuration.id,
      restoredServiceIds: outcome === 'passed' ? [request.serviceId] : [],
      state: finalSnapshot.state,
      checkedAt: finalSnapshot.checkedAt,
      probeEvidence: finalSnapshot.evidence,
      safeReason: finalSnapshot.failure?.safeMessage ?? (outcome === 'passed' ? 'Current-generation live probe passed.' : 'Retest did not restore availability.'),
    };
  }

  /**
   * Retest a shared credential group atomically. All configurations are
   * registered before any check; a partial pass is quarantined and reports no
   * restored members.
   */
  async retestGroup(
    request: SpecialistRetestRequest,
    configurations: readonly SpecialistEffectiveConfiguration[],
  ): Promise<SpecialistRetestResult> {
    const prior = new Map(configurations.map((config) => [config.serviceId, this.snapshot(config.serviceId)]));
    for (const configuration of configurations) this.register(configuration);
    const checked = this.registry.checkAtomically(configurations.map((config) => config.serviceId))
      .then((snapshots) => snapshots.map((snapshot) => this.toSpecialistSnapshot(snapshot.providerId, snapshot)));
    const resolvedChecked = await checked;
    const stale = resolvedChecked.some((snapshot, index) => snapshot.generationId !== configurations[index]?.id);
    const cancelled = resolvedChecked.some((snapshot) => snapshot.failure?.causeCode === 'retest-cancelled');
    const unknown = resolvedChecked.some((snapshot) => snapshot.failure?.causeCode === 'retest-unknown');
    const passed = !stale && resolvedChecked.every((snapshot) => snapshot.state === 'available');
    const outcome = passed ? 'passed' : stale ? 'stale' : cancelled ? 'cancelled' : unknown ? 'unknown' : 'failed';
    if (!passed) {
      for (const configuration of configurations) {
        const previous = prior.get(configuration.serviceId);
        if (previous?.state === 'quarantined' || request.scope === 'credential-group') {
          this.quarantine(configuration.serviceId, previous?.failure?.safeMessage ?? 'Shared credential retest did not pass atomically.');
        }
      }
    }
    const finalSnapshot = this.snapshot(request.serviceId);
    return {
      ok: passed,
      operationId: request.operationId,
      serviceId: request.serviceId,
      scope: 'credential-group',
      outcome,
      generationId: configurations.find((config) => config.serviceId === request.serviceId)?.id,
      restoredServiceIds: passed ? configurations.map((config) => config.serviceId) : [],
      state: finalSnapshot.state,
      checkedAt: finalSnapshot.checkedAt,
      probeEvidence: finalSnapshot.evidence,
      safeReason: passed ? 'All current-generation credential-group probes passed atomically.' : 'Shared credential-group retest did not pass atomically.',
    };
  }

  /** Explicitly named alias for callers that want to distinguish this from a check. */
  async explicitRetest(
    request: SpecialistRetestRequest,
    configuration: SpecialistEffectiveConfiguration,
  ): Promise<SpecialistRetestResult> {
    return this.retest(request, configuration);
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
