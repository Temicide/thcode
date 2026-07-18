// Work Modes and Permission Profiles are INDEPENDENT session state (ADR 0013,
// ADR 0012). Neither implies the other; both must be shown as separate UI
// state. This file defines the vocabulary only — the policy lives in policy.ts.

/**
 * Work Mode (ADR 0013). Plan is structurally read-only: no Permission Profile,
 * including Full Access, can turn a Plan action into a mutation.
 */
export type WorkMode = 'plan' | 'build';

/**
 * Permission Profile (ADR 0012). Governs WHEN an otherwise-permitted action is
 * executed automatically vs. asks the developer. Orthogonal to Work Mode.
 */
export type PermissionProfile = 'manual' | 'assisted' | 'full-access';

/** New Session Default (CONTEXT.md / ADR 0012+0013): Build + Manual. */
export const NEW_SESSION_DEFAULT: { mode: WorkMode; profile: PermissionProfile } = {
  mode: 'build',
  profile: 'manual',
};

/** Coarse deterministic risk hint. Extension point for the ADR 0012 Assisted
 * AI risk classifier — a classifier may only *recommend*, never override policy. */
export type RiskLevel = 'low' | 'medium' | 'high';

/** A normalized action the policy engine evaluates before execution. */
export interface ActionRequest {
  /** Tool / operation identifier, e.g. "write_file", "run_command". */
  readonly tool: string;
  /** True if the action can change the workspace or external state. */
  readonly mutating: boolean;
  /** True for sensitive transfers/operations (identity, biometric, medical,
   * credential-adjacent, material remote transfer). Requires stricter handling. */
  readonly sensitive?: boolean;
  /** Optional deterministic risk hint used by the Assisted profile. */
  readonly risk?: RiskLevel;
}

/** Current permission-relevant session state. */
export interface PolicyState {
  readonly mode: WorkMode;
  readonly profile: PermissionProfile;
  /** Full Access session-only sensitive-transfer override (ADR 0012). */
  readonly sensitiveOverride?: boolean;
}

export type PermissionOutcome = 'allow' | 'ask' | 'deny';

export interface PermissionDecision {
  readonly outcome: PermissionOutcome;
  /** Stable machine-readable reason code, safe to log (never contains secrets). */
  readonly reason: string;
}
