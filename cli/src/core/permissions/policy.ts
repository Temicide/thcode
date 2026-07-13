import type {
  ActionRequest,
  PermissionDecision,
  PolicyState,
} from './types.js';

/**
 * The deterministic Permission Policy engine (ADR 0012 + ADR 0013).
 *
 * Order of precedence (highest first):
 *   1. Plan Mode is structurally read-only. Any mutating action is DENIED
 *      regardless of Permission Profile — Full Access in Plan Mode still
 *      cannot mutate. This is a Hard Security Rule, evaluated first.
 *   2. Sensitive operations always ask, unless Full Access holds the explicit
 *      session-scoped sensitive-transfer override.
 *   3. Otherwise the Permission Profile decides:
 *        - full-access: allow (within the boundaries already enforced above)
 *        - assisted:    reads allow; low-risk mutations allow; else ask
 *        - manual:      reads allow; any mutation asks
 *
 * The engine is pure and side-effect free so it can be unit-tested over the
 * full orthogonal matrix without any UI, filesystem, or network.
 */
export function evaluatePermission(
  action: ActionRequest,
  state: PolicyState,
): PermissionDecision {
  // 1. Structural read-only boundary of Plan Mode (ADR 0013). Non-negotiable.
  if (state.mode === 'plan' && action.mutating) {
    return {
      outcome: 'deny',
      reason: 'plan-mode-is-read-only',
    };
  }

  // 2. Sensitive operations (ADR 0012). Even Full Access must ask unless the
  //    separate session-scoped sensitive-transfer override is set.
  if (action.sensitive) {
    if (state.profile === 'full-access' && state.sensitiveOverride) {
      return { outcome: 'allow', reason: 'full-access-sensitive-override' };
    }
    return { outcome: 'ask', reason: 'sensitive-requires-approval' };
  }

  // 3. Profile-driven decision for non-sensitive actions.
  switch (state.profile) {
    case 'full-access':
      // Every action permitted by the active Work Mode is auto-approved.
      return { outcome: 'allow', reason: 'full-access-auto-approve' };

    case 'assisted':
      if (!action.mutating) {
        return { outcome: 'allow', reason: 'assisted-read-allowed' };
      }
      // Deterministic policy first; the AI risk classifier (ADR 0012) is an
      // extension point that may only *recommend* escalation, never override.
      // TODO(assisted-classifier): plug a risk classifier here; uncertainty
      // must return authority to the developer (i.e. 'ask').
      if (action.risk === 'low') {
        return { outcome: 'allow', reason: 'assisted-low-risk-allowed' };
      }
      return { outcome: 'ask', reason: 'assisted-uncertain-asks-developer' };

    case 'manual':
    default:
      if (!action.mutating) {
        return { outcome: 'allow', reason: 'manual-read-allowed' };
      }
      return { outcome: 'ask', reason: 'manual-requires-approval' };
  }
}
