// Mutation confirmation — exact unprotected scope disclosure + explicit
// confirmation (Story 3.3 AC #4, AD-4, AD-12, AD-13, AD-19, AD-20, AD-27).
// When protection is partial or unavailable but the requested action is otherwise
// eligible, thcode discloses the exact unprotected scope and residual risk;
// proceeding requires explicit confirmation for that exact scope, and Full Access
// CANNOT suppress checkpoint rules or convert Plan into authorization.

import type {
  ConfirmationResult,
  ConfirmationScope,
  ProtectionPreflightResult,
} from './types.js';

// --- Input types ---

export interface ConfirmationContext {
  /** The preflight result that disclosed the unprotected scope. */
  readonly preflightResult: ProtectionPreflightResult;
  /** Whether the current profile is Full Access. */
  readonly isFullAccess: boolean;
  /** Whether the current mode is Plan. */
  readonly isPlanMode: boolean;
  /** The user's explicit confirmation decision. */
  readonly userConfirmed: boolean;
  /** The exact scope the user is confirming (must match unprotected scope). */
  readonly confirmedScope: ConfirmationScope | null;
}

// --- Main confirmation function ---

/**
 * Process a confirmation request for a partially protected or unprotected
 * mutation set (Story 3.3 AC #4).
 *
 * When protection is partial or unavailable but the requested action is otherwise
 * eligible, this function:
 * 1. Discloses the exact unprotected scope and residual risk
 * 2. Requires explicit confirmation for that exact scope
 * 3. Full Access CANNOT suppress checkpoint rules or convert Plan into
 *    authorization
 *
 * Returns a ConfirmationResult indicating whether the confirmation is valid
 * and the scope that was confirmed.
 */
export function processConfirmation(
  ctx: ConfirmationContext,
): ConfirmationResult {
  const preflight = ctx.preflightResult;

  // If protection is fully available, no confirmation is needed.
  if (preflight.protectionStatus === 'fully-protected') {
    return {
      ok: true,
      scope: {
        unprotectedTargets: [],
        residualRisk: 'All targets are fully protected.',
        operationId: preflight.operationId,
        mutationSetId: preflight.setId,
      },
    };
  }

  // Full Access CANNOT suppress checkpoint rules (AC #4).
  if (ctx.isFullAccess) {
    return {
      ok: false,
      reason: 'Full Access cannot suppress checkpoint rules. Protection preflight must be satisfied before any mutation.',
    };
  }

  // Plan Mode is structurally read-only — no mutations allowed (AC #4).
  if (ctx.isPlanMode) {
    return {
      ok: false,
      reason: 'Plan Mode is structurally read-only. Switch to Build mode to proceed with mutations.',
    };
  }

  // If there's no unprotected scope, something is inconsistent.
  if (!preflight.unprotectedScope) {
    return {
      ok: false,
      reason: 'No unprotected scope disclosed but protection is not full. Internal inconsistency.',
    };
  }

  // The user must have explicitly confirmed.
  if (!ctx.userConfirmed) {
    return {
      ok: false,
      reason: 'Explicit confirmation required for unprotected scope. Review the disclosed risks and confirm.',
    };
  }

  // The confirmed scope must match the unprotected scope exactly.
  if (!ctx.confirmedScope) {
    return {
      ok: false,
      reason: 'Confirmation scope is required. Specify the exact scope you are confirming.',
    };
  }

  // Validate that the confirmed scope matches the unprotected scope.
  const disclosedTargets = preflight.unprotectedScope.targets;
  const confirmedTargets = ctx.confirmedScope.unprotectedTargets;

  if (confirmedTargets.length !== disclosedTargets.length) {
    return {
      ok: false,
      reason: `Confirmation scope mismatch: disclosed ${disclosedTargets.length} unprotected targets, confirmed ${confirmedTargets.length}. Review and confirm the exact scope.`,
    };
  }

  // Check that all disclosed targets are covered by the confirmation.
  for (const disclosed of disclosedTargets) {
    if (!confirmedTargets.includes(disclosed)) {
      return {
        ok: false,
        reason: `Confirmation scope incomplete: missing target "${disclosed}". Confirm the exact unprotected scope.`,
      };
    }
  }

  // Validate operationId and mutationSetId match.
  if (ctx.confirmedScope.operationId !== preflight.operationId) {
    return {
      ok: false,
      reason: 'Confirmation scope operationId does not match the preflight result.',
    };
  }

  if (ctx.confirmedScope.mutationSetId !== preflight.setId) {
    return {
      ok: false,
      reason: 'Confirmation scope mutationSetId does not match the preflight result.',
    };
  }

  // All checks passed — confirmation is valid.
  return {
    ok: true,
    scope: {
      unprotectedTargets: [...confirmedTargets],
      residualRisk: preflight.unprotectedScope.residualRisk,
      operationId: preflight.operationId,
      mutationSetId: preflight.setId,
    },
  };
}
