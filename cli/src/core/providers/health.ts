// HealthRegistry — generation-bound health lifecycle (AD-3, AD-8, AD-9, AD-18).
// (ADR 0010, Story 1.7) A provider/specialist is `available` only after a live
// check of the exact stored configuration passes. Stale results from an older
// generation are rejected; the lifecycle is:
//   unconfigured → configured → checking → available | unavailable | unhealthy | quarantined

/** Canonical health state tokens (UX-DR-031, UX-DR-101). */
export type HealthState =
  | 'unconfigured'
  | 'configured'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'unhealthy'
  | 'quarantined';

/** Immutable effective-configuration generation (AD-8). */
export interface EffectiveConfigurationGeneration {
  readonly id: string;
  readonly providerId: string;
  /** Verified endpoint/origin (no secrets). */
  readonly endpoint: string;
  /** Credential revision/fingerprint (opaque, secret-free). */
  readonly credentialRevision: string;
  /** Adapter/contract mapping identity. */
  readonly adapterVersion: string;
  readonly modelId: string;
  readonly dependencyIdentity: string;
  /** UTC ISO-8601 creation timestamp. */
  readonly createdAt: string;
}

/** Deterministic sanitized failure envelope (AD-9). */
export interface HealthFailure {
  readonly category: 'auth' | 'connectivity' | 'quota' | 'configuration' | 'protocol' | 'unknown';
  readonly retryable: boolean;
  readonly scope: string;
  readonly generationId: string;
  readonly safeMessage: string;
  readonly causeCode: string;
  readonly retryAfterMs?: number;
}

/** Result of a live health probe. */
export type HealthProbeResult =
  | { ok: true; evidence: string }
  | { ok: false; failure: HealthFailure };

/** A health check callback the adapter supplies. Pure-ish: may perform one
 * network call, but must return a typed result — never throw across the
 * boundary (AD-9). */
export type HealthProbe = (gen: EffectiveConfigurationGeneration) => Promise<HealthProbeResult>;

interface HealthRecord {
  readonly generation: EffectiveConfigurationGeneration;
  state: HealthState;
  readonly failure?: HealthFailure;
  readonly evidence?: string;
  readonly checkedAt: string;
}

export interface HealthSnapshot {
  readonly providerId: string;
  readonly state: HealthState;
  readonly generationId?: string;
  readonly endpoint?: string;
  readonly failure?: HealthFailure;
  readonly evidence?: string;
  readonly checkedAt?: string;
}

/**
 * Owns the generation-bound health lifecycle. Stale results from an older
 * generation are rejected: a probe that returns after a newer generation has
 * been registered cannot make the new generation `available` (AD-18).
 */
export class HealthRegistry {
  private readonly records = new Map<string, HealthRecord>();
  private readonly probes = new Map<string, HealthProbe>();
  private readonly clock: () => string;

  constructor(clock: () => string = () => new Date().toISOString()) {
    this.clock = clock;
  }

  /** Register the live probe for a provider. */
  registerProbe(providerId: string, probe: HealthProbe): void {
    this.probes.set(providerId, probe);
  }

  /** Register a new effective-configuration generation and transition to
   * `configured`. Supersedes any prior generation for this provider. */
  registerConfiguration(gen: EffectiveConfigurationGeneration): void {
    const prior = this.records.get(gen.providerId);
    this.records.set(gen.providerId, {
      generation: gen,
      state: 'configured',
      checkedAt: this.clock(),
    });
    // Supersede: prior generation records are no longer current authority.
    void prior;
  }

  /** Mark a provider unconfigured (e.g. credential removed). */
  markUnconfigured(providerId: string): void {
    this.records.delete(providerId);
  }

  /** Current public snapshot (defensive copy — never returns the live record). */
  snapshot(providerId: string): HealthSnapshot {
    const r = this.records.get(providerId);
    if (!r) return { providerId, state: 'unconfigured' };
    return {
      providerId,
      state: r.state,
      generationId: r.generation.id,
      endpoint: r.generation.endpoint,
      failure: r.failure,
      evidence: r.evidence,
      checkedAt: r.checkedAt,
    };
  }

  /** All snapshots. */
  snapshots(): HealthSnapshot[] {
    return [...this.records.keys()].map((id) => this.snapshot(id));
  }

  /** Run the live probe for a provider against its current generation.
   * Transitions `configured → checking → available | unavailable | unhealthy`.
   * Stale probe results (older generation) are rejected. */
  async check(providerId: string): Promise<HealthSnapshot> {
    const record = this.records.get(providerId);
    if (!record) return { providerId, state: 'unconfigured' };
    const probe = this.probes.get(providerId);
    if (!probe) {
      return {
        providerId,
        state: 'unconfigured',
        generationId: record.generation.id,
        failure: {
          category: 'configuration',
          retryable: false,
          scope: providerId,
          generationId: record.generation.id,
          safeMessage: 'No live probe registered for this provider.',
          causeCode: 'probe-missing',
        },
      };
    }
    const gen = record.generation;
    // Transition to checking.
    record.state = 'checking';
    let result: HealthProbeResult;
    try {
      result = await probe(gen);
    } catch (e) {
      result = {
        ok: false,
        failure: {
          category: 'unknown',
          retryable: false,
          scope: providerId,
          generationId: gen.id,
          safeMessage: 'Probe threw before returning a typed result.',
          causeCode: 'probe-threw',
        },
      };
    }
    // Reject stale results: if the generation was superseded during the probe,
    // the current record belongs to a newer generation — do not promote.
    const current = this.records.get(providerId);
    if (!current || current.generation.id !== gen.id) {
      return this.snapshot(providerId);
    }
    if (result.ok) {
      current.state = 'available';
      (current as { evidence?: string }).evidence = result.evidence;
      (current as { failure?: HealthFailure }).failure = undefined;
    } else {
      const f = result.failure;
      const fatal = f.category === 'auth' || f.category === 'configuration' || f.category === 'protocol';
      current.state = fatal ? 'unhealthy' : 'unavailable';
      (current as { failure?: HealthFailure }).failure = f;
      (current as { evidence?: string }).evidence = undefined;
    }
    (current as { checkedAt: string }).checkedAt = this.clock();
    return this.snapshot(providerId);
  }

  /** Quarantine a provider (e.g. shared credential rejected). The provider
   * stays unselectable until an explicit retest passes. */
  quarantine(providerId: string, cause: string): HealthSnapshot {
    const record = this.records.get(providerId);
    if (!record) return { providerId, state: 'unconfigured' };
    record.state = 'quarantined';
    (record as { failure?: HealthFailure }).failure = {
      category: 'auth',
      retryable: false,
      scope: providerId,
      generationId: record.generation.id,
      safeMessage: cause,
      causeCode: 'quarantined',
    };
    return this.snapshot(providerId);
  }

  /** True only when the current generation is `available`. */
  isAvailable(providerId: string): boolean {
    return this.records.get(providerId)?.state === 'available';
  }
}

/** Shared singleton for the application. */
export const healthRegistry = new HealthRegistry();