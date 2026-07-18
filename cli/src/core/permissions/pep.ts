// The local Policy Enforcement Point (Story 2.2, AD-12). One versioned
// PermissionMatrix consulted by ONE local PEP; deny-by-default for unknown
// action classes; fail-closed `ENFORCEMENT UNVERIFIED` when a required
// platform capability is unavailable/unverified (PR-3). Deterministic: the
// same action class + PolicyState + activation revision + matrix version
// always produce the same decision — no UI wording, provider output, or
// adapter-local rule feeds in (Story 2.2 AC #2).

import { evaluatePermission } from './policy.js';
import { ENFORCEMENT_UNVERIFIED, lookupActionClass, PERMISSION_MATRIX_VERSION } from './matrix.js';
import type { PermissionOutcome, PolicyState } from './types.js';

export { ENFORCEMENT_UNVERIFIED } from './matrix.js';

export interface PepInput {
  readonly actionClass: string;
  readonly state: PolicyState;
  readonly activationRevision: number;
  /**
   * Whether the platform/action enforcement capability this action class
   * requires (per the PermissionMatrix entry) is currently available and
   * verified. `undefined`/`true` means available (the common case for
   * non-mutating reads, which require no platform enforcement mechanism);
   * pass `false` to simulate/assert an unresolved PR-3 matrix entry so the
   * PEP fails closed rather than claiming a permissive decision (AC #7).
   */
  readonly enforcementAvailable?: boolean;
}

export interface PepDecision {
  readonly outcome: PermissionOutcome;
  /** Stable, sanitized, machine-readable reason — safe to log/journal
   * (never contains secrets, AD-24). */
  readonly reason: string;
  readonly matrixVersion: number;
  readonly activationRevision: number;
  readonly actionClass: string;
}

/**
 * One local Policy Enforcement Point (Story 2.2). `evaluate` is pure and
 * side-effect free (no fs/network/journal) so CoreApp can call it
 * synchronously and journal the resulting `PolicyDecisionRecorded` Evidence
 * itself (AD-3) — the PEP does not persist anything by itself.
 */
export class PolicyEnforcementPoint {
  evaluate(input: PepInput): PepDecision {
    const def = lookupActionClass(input.actionClass);

    // AC #4: unknown/malformed/unsupported/policy-incomplete action class →
    // deny/not-authoritative. Never infer a safer class, repair the
    // proposal, or reach an effect adapter.
    if (!def) {
      return {
        outcome: 'deny',
        reason: 'unknown-action-class-not-authoritative',
        matrixVersion: PERMISSION_MATRIX_VERSION,
        activationRevision: input.activationRevision,
        actionClass: input.actionClass,
      };
    }

    // AC #7: required platform enforcement capability unavailable/unverified
    // → fail closed with the canonical `ENFORCEMENT UNVERIFIED` token, never
    // a permissive decision.
    if (def.requiresEnforcementCapability && input.enforcementAvailable === false) {
      return {
        outcome: 'deny',
        reason: ENFORCEMENT_UNVERIFIED,
        matrixVersion: PERMISSION_MATRIX_VERSION,
        activationRevision: input.activationRevision,
        actionClass: input.actionClass,
      };
    }

    // AC #1, #3, #5: delegate to the deterministic mode/profile/sensitivity
    // matrix (policy.ts) — Plan mode is structurally read-only (checked
    // first there, regardless of profile), sensitive actions always ask
    // unless Full Access holds the explicit override, and the profile then
    // decides for everything else.
    const decision = evaluatePermission(
      { tool: def.actionClass, mutating: def.mutating, sensitive: def.sensitive, risk: def.risk },
      input.state,
    );
    return {
      outcome: decision.outcome,
      reason: decision.reason,
      matrixVersion: PERMISSION_MATRIX_VERSION,
      activationRevision: input.activationRevision,
      actionClass: input.actionClass,
    };
  }
}

/** Shared singleton — one local PEP for the application (AD-12). */
export const pep = new PolicyEnforcementPoint();

/** Raised by `EffectExecutor.authorize` when a decision is not `allow`. */
export class EffectNotAuthorizedError extends Error {
  constructor(public readonly decision: PepDecision) {
    super(`effect not authorized: ${decision.outcome} (${decision.reason})`);
    this.name = 'EffectNotAuthorizedError';
  }
}

/**
 * The ONLY sanctioned local effect-authorization surface (Story 2.2 AC #6).
 * UI, Typhoon/remote output, and concrete adapters must go through this —
 * they never evaluate the PEP themselves and branch on `outcome === 'allow'`
 * to invoke an adapter directly. `authorize` throws for any non-`allow`
 * outcome (`ask` still requires the separate approval flow — Story 2.4 — to
 * produce a bound authorization before this can succeed; that flow is out of
 * this story's scope, so `ask` is treated as not-yet-authorized here too).
 */
export class EffectExecutor {
  constructor(private readonly enforcementPoint: PolicyEnforcementPoint = pep) {}

  authorize(input: PepInput): PepDecision {
    const decision = this.enforcementPoint.evaluate(input);
    if (decision.outcome !== 'allow') {
      throw new EffectNotAuthorizedError(decision);
    }
    return decision;
  }
}
