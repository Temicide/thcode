// Catalog controls (Story 4.2). Browse/search/inspect/enable/disable/diagnose/
// retest control surface over the registry + health state. Non-invokable
// inspection is read-only and produces NO invocation proposal, adapter call,
// prepared payload, or consent prompt.

import type { HealthState } from '../../providers/health.js';
import { CapabilityRegistry } from '../registry/registry.js';
import {
  type CatalogEntryProjection,
  type CatalogProjection,
  type DisabledSet,
  type HealthMap,
  computeCanonicalState,
  computeNextAllowedAction,
  projectCatalog,
  projectEntry,
} from './projection.js';
import { safeReasonForState } from './render.js';

/** Result of a catalog control operation. */
export interface CatalogControlResult {
  readonly ok: boolean;
  readonly message: string;
  readonly entry?: CatalogEntryProjection;
  /** Retest intent is not a completed probe; app orchestration owns execution. */
  readonly action?: 'retest-live';
  readonly recoveryState?: HealthState | 'not-started';
}

/** Result of a search operation. */
export interface CatalogSearchResult {
  readonly query: string;
  readonly matches: readonly CatalogEntryProjection[];
  readonly total: number;
}

/** Result of a diagnosis. */
export interface CatalogDiagnosis {
  readonly id: string;
  readonly canonicalState: string;
  readonly healthState: HealthState;
  readonly safeReason: string;
  readonly nextAllowedAction: string;
  readonly retestRecommended: boolean;
}

/**
 * Browse the full catalog projection.
 * Returns the complete catalog with all entries projected with health state
 * and disabled status.
 */
export function browseCatalog(
  registry: CapabilityRegistry,
  healthMap: HealthMap,
  disabledSet: DisabledSet,
): CatalogProjection | { readonly ok: false; readonly message: string } {
  if (!registry.ok) {
    return {
      ok: false,
      message: `Registry unavailable: ${registry.evidence?.detail ?? 'unknown error'}`,
    };
  }
  return projectCatalog(registry.manifest, healthMap, disabledSet);
}

/**
 * Search the catalog by query string (matches id, nameThai, nameEnglish,
 * searchTerms, and capabilities).
 */
export function searchCatalog(
  registry: CapabilityRegistry,
  healthMap: HealthMap,
  disabledSet: DisabledSet,
  query: string,
): CatalogSearchResult | { readonly ok: false; readonly message: string } {
  if (!registry.ok) {
    return { ok: false, message: 'Registry unavailable' };
  }

  const q = query.toLowerCase().trim();
  if (!q) {
    return { query, matches: [], total: 0 };
  }

  const matches: CatalogEntryProjection[] = [];
  for (const entry of registry.all()) {
    const healthState = healthMap[entry.id] ?? 'unconfigured';
    const disabled = disabledSet.has(entry.id);
    const projected = projectEntry(entry, healthState, disabled);

    const searchable = [
      entry.id.toLowerCase(),
      entry.nameThai.toLowerCase(),
      entry.nameEnglish.toLowerCase(),
      ...entry.searchTerms.map((t) => t.toLowerCase()),
      ...entry.capabilities.map((c) => c.toLowerCase()),
    ];

    if (searchable.some((s) => s.includes(q))) {
      matches.push(projected);
    }
  }

  return { query, matches, total: matches.length };
}

/**
 * Inspect a single catalog entry by ID.
 * Non-invokable entries are read-only and produce NO invocation proposal,
 * adapter call, prepared payload, or consent prompt.
 */
export function inspectEntry(
  registry: CapabilityRegistry,
  healthMap: HealthMap,
  disabledSet: DisabledSet,
  id: string,
): CatalogControlResult {
  if (!registry.ok) {
    return { ok: false, message: `Registry unavailable: ${registry.evidence?.detail ?? 'unknown error'}` };
  }

  const entry = registry.byId(id);
  if (!entry) {
    return { ok: false, message: `Service "${id}" not found in registry` };
  }

  const healthState = healthMap[id] ?? 'unconfigured';
  const disabled = disabledSet.has(id);
  const projected = projectEntry(entry, healthState, disabled);

  // Non-invokable entries are read-only — no proposal/payload/consent.
  if (!entry.invokable) {
    return {
      ok: true,
      message: `Inspection only — "${id}" is not invokable. No invocation proposal, adapter call, prepared payload, or consent prompt can be produced.`,
      entry: projected,
    };
  }

  return { ok: true, message: `Inspected "${id}"`, entry: projected };
}

/**
 * Enable a previously disabled service.
 * Only valid when the entry is currently disabled.
 */
export function enableService(
  disabledSet: Set<string>,
  id: string,
): CatalogControlResult {
  if (!disabledSet.has(id)) {
    return { ok: false, message: `Service "${id}" is not disabled` };
  }
  disabledSet.delete(id);
  return { ok: true, message: `Service "${id}" enabled` };
}

/**
 * Disable a service.
 * Only valid when the entry is invokable and not already disabled.
 */
export function disableService(
  registry: CapabilityRegistry,
  disabledSet: Set<string>,
  id: string,
): CatalogControlResult {
  if (!registry.ok) {
    return { ok: false, message: 'Registry unavailable' };
  }

  const entry = registry.byId(id);
  if (!entry) {
    return { ok: false, message: `Service "${id}" not found in registry` };
  }

  if (!entry.invokable) {
    return { ok: false, message: `Service "${id}" is not invokable and cannot be disabled` };
  }

  if (disabledSet.has(id)) {
    return { ok: false, message: `Service "${id}" is already disabled` };
  }

  disabledSet.add(id);
  return { ok: true, message: `Service "${id}" disabled` };
}

/**
 * Diagnose a service's current state.
 * Returns a diagnosis with the canonical state, health state, safe reason,
 * next allowed action, and whether retest is recommended.
 */
export function diagnoseService(
  registry: CapabilityRegistry,
  healthMap: HealthMap,
  disabledSet: DisabledSet,
  id: string,
): CatalogDiagnosis | { readonly ok: false; readonly message: string } {
  if (!registry.ok) {
    return { ok: false, message: 'Registry unavailable' };
  }

  const entry = registry.byId(id);
  if (!entry) {
    return { ok: false, message: `Service "${id}" not found in registry` };
  }

  const healthState = healthMap[id] ?? 'unconfigured';
  const disabled = disabledSet.has(id);
  const canonicalState = computeCanonicalState(entry.invokable, healthState, disabled);
  const safeReason = safeReasonForState(canonicalState, entry.invokableStateReason);
  const nextAllowedAction = computeNextAllowedAction(canonicalState);
  const retestRecommended = canonicalState === 'unavailable' || canonicalState === 'quarantined';

  return {
    id,
    canonicalState,
    healthState,
    safeReason,
    nextAllowedAction,
    retestRecommended,
  };
}

/**
 * Retest a service (trigger a health re-evaluation).
 * Since actual health probing is in later stories, this returns a retest
 * recommendation based on the current state.
 */
export function retestService(
  registry: CapabilityRegistry,
  healthMap: HealthMap,
  disabledSet: DisabledSet,
  id: string,
): CatalogControlResult {
  if (!registry.ok) {
    return { ok: false, message: 'Registry unavailable' };
  }

  const entry = registry.byId(id);
  if (!entry) {
    return { ok: false, message: `Service "${id}" not found in registry` };
  }

  const healthState = healthMap[id] ?? 'unconfigured';
  const disabled = disabledSet.has(id);
  const canonicalState = computeCanonicalState(entry.invokable, healthState, disabled);

  if (canonicalState === 'working') {
    return { ok: true, message: `Service "${id}" is already working. No retest needed.` };
  }

  if (canonicalState === 'Catalogued — Not available yet') {
    return { ok: true, message: `Service "${id}" is not invokable. Retest not applicable.` };
  }

  return {
    ok: true,
    message: `Retest recommended for "${id}". Explicit live retest available. Current state: ${canonicalState}. No probe has run yet.`,
    action: 'retest-live',
    recoveryState: healthState,
  };
}
