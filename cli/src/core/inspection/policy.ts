// Inspection policy mediation (Story 3.4, AD-4, AD-12, AD-13, AD-24, AD-27).
// Mediates each inspection request through the local PEP/PermissionMatrix
// (Story 3.1 boundedReadPolicy / permissions/policy.ts):
//
//   AC #4: Manual profile + eligible/in-Workspace/non-transferring inspection
//   may proceed WITHOUT approval interruption, still appears in activity/
//   Evidence, cannot authorize a later mutation or remote transfer.
//
//   AC #5: Plan mode -> read-only, resulting plan/Evidence cannot be consumed
//   as mutation authorization.
//
// Pure function — no side effects, no fs/network/journal.

import { evaluatePermission } from '../permissions/policy.js';
import type { PolicyState } from '../permissions/types.js';
import type { InspectionRefusal } from './types.js';

export type InspectionActionClass = 'read_file' | 'list_dir' | 'search';

export interface InspectionPolicyInput {
  readonly actionClass: InspectionActionClass;
  readonly state: PolicyState;
}

export interface InspectionPolicyDecision {
  readonly outcome: 'allow' | 'deny';
  readonly reason: string;
}

/**
 * Evaluate an inspection operation through the permission policy.
 *
 * AC #4: Manual profile + eligible/in-Workspace/non-transferring inspection
 * may proceed WITHOUT approval interruption. The PEP already allows non-
 * mutating actions in Manual mode (`manual-read-allowed`), so no additional
 * approval is needed. The operation still appears in activity/Evidence via
 * the caller's journaling. The resulting authorization cannot be consumed
 * for a later mutation or remote transfer because the PEP evaluates each
 * action independently — a read_file authorization is not a write_file
 * authorization.
 *
 * AC #5: Plan mode is structurally read-only. The PEP allows non-mutating
 * actions in Plan mode. The resulting plan/Evidence cannot be consumed as
 * mutation authorization because the PEP denies mutating actions in Plan
 * mode structurally (before any profile check).
 *
 * Pure function — no side effects, no fs/network/journal.
 */
export function evaluateInspectionPolicy(input: InspectionPolicyInput): InspectionPolicyDecision {
  const decision = evaluatePermission(
    {
      tool: input.actionClass,
      mutating: false,
      sensitive: false,
      risk: 'low',
    },
    input.state,
  );

  if (decision.outcome === 'allow') {
    return { outcome: 'allow', reason: decision.reason };
  }

  return { outcome: 'deny', reason: decision.reason };
}

/**
 * Convert a policy decision to an InspectionRefusal when the outcome is deny.
 */
export function policyDecisionToRefusal(
  decision: InspectionPolicyDecision,
  actionClass: string,
): InspectionRefusal {
  return {
    kind: 'denied',
    reason: `${actionClass} refused by policy: ${decision.reason}`,
    nextStep: 'adjust the Work Mode or Permission Profile, or use a different action',
  };
}
