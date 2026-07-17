// Catalog projection (Story 4.2). Plain serializable objects so Ink, redirected
// text, and headless JSON render identical fields and tokens (AD-2 projection
// parity). No methods; no secrets. Health state is an injectable input — the
// catalog projection accepts a health map (Record<serviceId, HealthState>);
// it never hardcodes health.

import type { HealthState } from '../../providers/health.js';
import type { CapabilityRegistryEntry, CapabilityRegistryManifest } from '../registry/types.js';

/**
 * Canonical catalog entry state tokens (AD-28, UX-DR-101, UX-DR-031).
 * `working` is reserved for invokable+available entries.
 * Non-invokable entries carry the exact `Catalogued — Not available yet` reason.
 * Disabled/unavailable/unhealthy/quarantined each render their own token.
 */
export type CatalogEntryCanonicalState =
  | 'working'
  | 'Catalogued — Not available yet'
  | 'disabled'
  | 'unconfigured'
  | 'configured'
  | 'checking'
  | 'unavailable'
  | 'unhealthy'
  | 'quarantined';

/** Machine-readable action availability for a catalog entry. */
export interface CatalogEntryActionAvailability {
  readonly browse: boolean;
  readonly search: boolean;
  readonly inspect: boolean;
  readonly enable: boolean;
  readonly disable: boolean;
  readonly diagnose: boolean;
  readonly retest: boolean;
}

/** A single catalog entry projection (plain serializable; no methods, no secrets). */
export interface CatalogEntryProjection {
  /** Stable thcode identity (e.g. `t-ocr`). */
  readonly id: string;
  /** Upstream provider's service identity. */
  readonly upstreamId: string;
  /** Thai-language name. */
  readonly nameThai: string;
  /** Canonical English name. */
  readonly nameEnglish: string;
  /** Search terms (Thai + English). */
  readonly searchTerms: readonly string[];
  /** Capability tags. */
  readonly capabilities: readonly string[];
  /** Supported input types. */
  readonly supportedInputs: readonly string[];
  /** Input limits (e.g. max file size, max duration). */
  readonly inputLimits: Record<string, string>;
  /** Entitlement description. */
  readonly entitlement: string;
  /** Evidence level for this service. */
  readonly evidenceLevel: string;
  /** Date the entry was last observed/reviewed. */
  readonly observationDate: string;
  /** Manifest version this entry was defined under. */
  readonly manifestVersion: number;
  /** Contract version for this service. */
  readonly contractVersion: string;
  /** Adapter version for this service. */
  readonly adapterVersion: string;
  /** Latest contract-test result. */
  readonly latestContractTestResult: {
    readonly passed: boolean;
    readonly testedAt: string;
    readonly summary: string;
  };
  /** Whether this service is invokable per the registry. */
  readonly invokable: boolean;
  /** Reason for the invokable state (null when invokable is true). */
  readonly invokableStateReason: string | null;
  /**
   * Canonical state token for the catalog entry.
   * Computed from invokable status, health state, and disabled status.
   * Never silently mapped to `working`/`available`.
   */
  readonly canonicalState: CatalogEntryCanonicalState;
  /** Current health state (injected; never hardcoded). */
  readonly healthState: HealthState;
  /** Whether the entry is eligible for invocation (invokable + health available). */
  readonly invocationEligibility: boolean;
  /** Human-readable next allowed action. */
  readonly nextAllowedAction: string;
  /** Machine-readable action availability. */
  readonly actionAvailability: CatalogEntryActionAvailability;
}

/** The top-level catalog projection (plain serializable). */
export interface CatalogProjection {
  readonly manifestVersion: number;
  readonly observationDate: string;
  readonly source: string;
  readonly revoked: boolean;
  readonly revocationReason: string | null;
  readonly entries: readonly CatalogEntryProjection[];
}

/** Health map: serviceId → HealthState. Injected by the caller. */
export type HealthMap = Record<string, HealthState>;

/** Disabled set: service IDs that the user has disabled. */
export type DisabledSet = ReadonlySet<string>;

/**
 * Compute the canonical catalog state for an entry given its registry
 * invokable status, health state, and disabled status.
 */
export function computeCanonicalState(
  invokable: boolean,
  healthState: HealthState,
  disabled: boolean,
): CatalogEntryCanonicalState {
  if (!invokable) return 'Catalogued — Not available yet';
  if (disabled) return 'disabled';
  if (healthState === 'available') return 'working';
  return healthState;
}

/**
 * Compute the next allowed action for a canonical state.
 */
export function computeNextAllowedAction(state: CatalogEntryCanonicalState): string {
  switch (state) {
    case 'working':
      return 'invoke';
    case 'Catalogued — Not available yet':
      return 'inspect only';
    case 'disabled':
      return 'enable';
    case 'unconfigured':
      return 'configure';
    case 'configured':
      return 'check';
    case 'checking':
      return 'wait';
    case 'unavailable':
      return 'retest';
    case 'unhealthy':
      return 'diagnose';
    case 'quarantined':
      return 'retest';
  }
}

/**
 * Compute machine-readable action availability for a canonical state.
 */
export function computeActionAvailability(
  state: CatalogEntryCanonicalState,
): CatalogEntryActionAvailability {
  const browse = true;
  const search = true;
  const inspect = true;
  const enable = state === 'disabled';
  const disable = state === 'working';
  const diagnose = state === 'unhealthy';
  const retest = state === 'unavailable' || state === 'quarantined';
  return { browse, search, inspect, enable, disable, diagnose, retest };
}

/**
 * Project a single registry entry into a catalog entry projection.
 * Health state and disabled status are injected; never hardcoded.
 */
export function projectEntry(
  entry: CapabilityRegistryEntry,
  healthState: HealthState,
  disabled: boolean,
): CatalogEntryProjection {
  const canonicalState = computeCanonicalState(entry.invokable, healthState, disabled);
  const invocationEligibility = entry.invokable && healthState === 'available' && !disabled;
  const nextAllowedAction = computeNextAllowedAction(canonicalState);
  const actionAvailability = computeActionAvailability(canonicalState);

  return {
    id: entry.id,
    upstreamId: entry.upstreamId,
    nameThai: entry.nameThai,
    nameEnglish: entry.nameEnglish,
    searchTerms: entry.searchTerms,
    capabilities: entry.capabilities,
    supportedInputs: entry.supportedInputs,
    inputLimits: entry.inputLimits,
    entitlement: entry.entitlement,
    evidenceLevel: entry.evidenceLevel,
    observationDate: entry.observationDate,
    manifestVersion: entry.manifestVersion,
    contractVersion: entry.contractVersion,
    adapterVersion: entry.adapterVersion,
    latestContractTestResult: {
      passed: entry.latestContractTestResult.passed,
      testedAt: entry.latestContractTestResult.testedAt,
      summary: entry.latestContractTestResult.summary,
    },
    invokable: entry.invokable,
    invokableStateReason: entry.invokableStateReason,
    canonicalState,
    healthState,
    invocationEligibility,
    nextAllowedAction,
    actionAvailability,
  };
}

/**
 * Project the full registry manifest into a catalog projection.
 * Health map and disabled set are injected; never hardcoded.
 */
export function projectCatalog(
  manifest: CapabilityRegistryManifest,
  healthMap: HealthMap,
  disabledSet: DisabledSet,
): CatalogProjection {
  return {
    manifestVersion: manifest.manifestVersion,
    observationDate: manifest.observationDate,
    source: manifest.source,
    revoked: manifest.revoked,
    revocationReason: manifest.revocationReason,
    entries: manifest.entries.map((entry) =>
      projectEntry(entry, healthMap[entry.id] ?? 'unconfigured', disabledSet.has(entry.id)),
    ),
  };
}
