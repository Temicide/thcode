// Catalog render helpers (Story 4.2). Render across interactive/linearized/
// redirected/headless/Thai/mixed/narrow — stable identifier + canonical token +
// safe reason, no color reliance. Every row retains a stable identifier,
// canonical state token, safe reason, and machine-readable action availability
// without relying on color.

import type { CatalogEntryProjection, CatalogProjection } from './projection.js';

/** Output surface modes for catalog rendering. */
export type CatalogRenderMode =
  | 'interactive'
  | 'linearized'
  | 'redirected'
  | 'headless'
  | 'narrow';

/** A single rendered row with stable identifier + canonical token + safe reason. */
export interface CatalogRowRender {
  readonly id: string;
  readonly canonicalState: string;
  readonly safeReason: string;
  readonly actionAvailability: string;
  readonly line: string;
}

/**
 * Build a safe reason string for a catalog entry's canonical state.
 * Never exposes raw payloads, secrets, or internal details.
 */
export function safeReasonForState(canonicalState: string, invokableStateReason: string | null): string {
  switch (canonicalState) {
    case 'working':
      return 'Service is invokable and health check passed';
    case 'Catalogued — Not available yet':
      return invokableStateReason ?? 'Catalogued — Not available yet';
    case 'disabled':
      return 'Service has been disabled by the user';
    case 'unconfigured':
      return 'Service is not yet configured';
    case 'configured':
      return 'Service is configured but health has not been checked';
    case 'checking':
      return 'Health check is in progress';
    case 'unavailable':
      return 'Service is currently unreachable';
    case 'unhealthy':
      return 'Service health check failed';
    case 'quarantined':
      return 'Service has been quarantined due to failures';
    default:
      return 'Unknown state';
  }
}

/**
 * Build a machine-readable action availability string from the entry's
 * action availability flags. Returns a comma-separated list of available
 * actions.
 */
export function actionAvailabilityString(entry: CatalogEntryProjection): string {
  const actions: string[] = [];
  const a = entry.actionAvailability;
  if (a.browse) actions.push('browse');
  if (a.search) actions.push('search');
  if (a.inspect) actions.push('inspect');
  if (a.enable) actions.push('enable');
  if (a.disable) actions.push('disable');
  if (a.diagnose) actions.push('diagnose');
  if (a.retest) actions.push('retest');
  return actions.join(',');
}

/**
 * Render a single catalog entry row for a given output mode.
 * Every mode includes: stable identifier + canonical state token + safe reason +
 * machine-readable action availability. No color reliance.
 */
export function renderEntryRow(
  entry: CatalogEntryProjection,
  mode: CatalogRenderMode,
): string {
  const id = entry.id;
  const state = entry.canonicalState;
  const reason = safeReasonForState(state, entry.invokableStateReason);
  const actions = actionAvailabilityString(entry);

  switch (mode) {
    case 'headless':
      return JSON.stringify({
        id,
        canonicalState: state,
        healthState: entry.healthState,
        safeReason: reason,
        actionAvailability: actions,
        invocationEligibility: entry.invocationEligibility,
        nextAllowedAction: entry.nextAllowedAction,
      });
    case 'narrow':
      // AC #5: narrow output still retains stable identifier + canonical
      // state token + safe reason + machine-readable action availability.
      return `${id}|${state}|${reason}|${actions}`;
    case 'linearized':
    case 'redirected':
      return `[${id}] ${state} — ${reason} | actions: ${actions}`;
    case 'interactive':
    default:
      return `${id} (${entry.nameEnglish} / ${entry.nameThai}) — ${state} — ${reason} | actions: ${actions}`;
  }
}

/**
 * Render a full catalog entry detail view (for inspect).
 * Includes identity, capabilities, supported input types, limits, entitlement,
 * evidence level, manifest/contract versions, observation date, current health,
 * and invocation eligibility.
 */
export function renderEntryDetail(
  entry: CatalogEntryProjection,
  mode: CatalogRenderMode,
): string {
  if (mode === 'headless') {
    return JSON.stringify(entry, null, 2);
  }

  const lines: string[] = [];
  const id = entry.id;
  const state = entry.canonicalState;
  const reason = safeReasonForState(state, entry.invokableStateReason);

  if (mode === 'narrow') {
    lines.push(`${id}|${state}|${reason}`);
    lines.push(`health:${entry.healthState}|eligible:${entry.invocationEligibility}`);
    lines.push(`next:${entry.nextAllowedAction}`);
    return lines.join('\n');
  }

  // interactive / linearized / redirected
  const prefix = mode === 'linearized' ? '[catalog] ' : '';
  lines.push(`${prefix}${id} (${entry.nameEnglish} / ${entry.nameThai})`);
  lines.push(`${prefix}  State: ${state}`);
  lines.push(`${prefix}  Reason: ${reason}`);
  lines.push(`${prefix}  Capabilities: ${entry.capabilities.join(', ')}`);
  lines.push(`${prefix}  Supported inputs: ${entry.supportedInputs.join(', ')}`);
  lines.push(
    `${prefix}  Limits: ${Object.entries(entry.inputLimits)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`,
  );
  lines.push(`${prefix}  Entitlement: ${entry.entitlement}`);
  lines.push(`${prefix}  Evidence level: ${entry.evidenceLevel}`);
  lines.push(
    `${prefix}  Manifest v${entry.manifestVersion}, Contract ${entry.contractVersion}, Adapter ${entry.adapterVersion}`,
  );
  lines.push(`${prefix}  Observed: ${entry.observationDate}`);
  lines.push(`${prefix}  Health: ${entry.healthState}`);
  lines.push(`${prefix}  Invocation eligible: ${entry.invocationEligibility}`);
  lines.push(`${prefix}  Next allowed action: ${entry.nextAllowedAction}`);
  lines.push(`${prefix}  Actions: ${actionAvailabilityString(entry)}`);

  return lines.join('\n');
}

/**
 * Render the full catalog projection as a list.
 */
export function renderCatalogList(
  projection: CatalogProjection,
  mode: CatalogRenderMode,
): string {
  if (mode === 'headless') {
    return JSON.stringify(projection, null, 2);
  }

  const lines: string[] = [];
  const prefix = mode === 'linearized' ? '[catalog] ' : '';

  lines.push(
    `${prefix}Capability Registry v${projection.manifestVersion} (observed ${projection.observationDate})`,
  );
  if (projection.revoked) {
    lines.push(`${prefix}  REVOKED: ${projection.revocationReason ?? 'manifest is revoked'}`);
  }
  lines.push(`${prefix}Source: ${projection.source}`);
  lines.push('');

  for (const entry of projection.entries) {
    lines.push(renderEntryRow(entry, mode));
  }

  return lines.join('\n');
}

/**
 * Render a single catalog row with stable identifier + canonical state token +
 * safe reason + machine-readable action availability. Returns a structured
 * CatalogRowRender for parity verification across modes.
 */
export function renderCatalogRow(
  entry: CatalogEntryProjection,
  mode: CatalogRenderMode,
): CatalogRowRender {
  const state = entry.canonicalState;
  const reason = safeReasonForState(state, entry.invokableStateReason);
  const actions = actionAvailabilityString(entry);
  const line = renderEntryRow(entry, mode);
  return { id: entry.id, canonicalState: state, safeReason: reason, actionAvailability: actions, line };
}
