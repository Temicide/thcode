// Bounded read policy (Story 3.1 AC #4, AD-12, AD-13, AD-27). Evaluates
// list/read/search through the local PEP/PermissionMatrix: permits only
// bounded, non-sensitive in-Workspace inspection. Plan stays structurally
// read-only (DENY mutating first). Manual does not interrupt eligible
// inspection when no material transfer occurs. Full Access cannot expand the
// Workspace or bypass platform checks.
//
// Delegates to `permissions/policy.ts` `evaluatePermission` (pure) — does not
// re-implement precedence.

import { checkHardBoundary, type BoundaryDecision } from '../permissions/boundary.js';
import { pep, type PepDecision, type PepInput } from '../permissions/pep.js';
import type { PolicyState } from '../permissions/types.js';

export type BoundedReadActionClass = 'read_file' | 'list_dir' | 'search';

export interface BoundedReadInput {
  readonly actionClass: BoundedReadActionClass;
  readonly state: PolicyState;
  readonly activationRevision: number;
  readonly workspaceRoot: string;
  /** Candidate path for workspace containment check. */
  readonly candidatePath?: string;
  readonly enforcementAvailable?: boolean;
}

export interface BoundedReadDecision {
  readonly outcome: 'allow' | 'deny';
  readonly reason: string;
  readonly pepDecision: PepDecision;
  readonly boundaryDecision: BoundaryDecision;
}

/**
 * Evaluate a bounded read operation (list_dir, read_file, search) through the
 * local PEP, with workspace containment enforced by the hard boundary check.
 *
 * - Plan mode: structurally read-only — read operations are allowed, but
 *   mutating operations are denied first (enforced by the PEP, not here).
 * - Manual mode: eligible read inspection is not interrupted when no material
 *   transfer occurs (reads are allowed by the PEP in Manual).
 * - Full Access: cannot expand the Workspace (enforced by the hard boundary
 *   check) or bypass platform checks (enforced by the PEP).
 *
 * Pure function — no side effects, no fs/network/journal.
 */
export function evaluateBoundedRead(input: BoundedReadInput): BoundedReadDecision {
  // 1. Check the hard boundary first — workspace containment is non-overridable.
  const boundaryDecision = checkHardBoundary({
    workspaceRoot: input.workspaceRoot,
    candidatePath: input.candidatePath,
    enforcementAvailable: input.enforcementAvailable,
  });

  if (boundaryDecision.outcome === 'deny') {
    return {
      outcome: 'deny',
      reason: boundaryDecision.reason ?? 'hard-boundary-denied',
      pepDecision: {
        outcome: 'deny',
        reason: boundaryDecision.reason ?? 'hard-boundary-denied',
        matrixVersion: 0,
        activationRevision: input.activationRevision,
        actionClass: input.actionClass,
      },
      boundaryDecision,
    };
  }

  // 2. Delegate to the PEP for the mode/profile decision.
  const pepInput: PepInput = {
    actionClass: input.actionClass,
    state: input.state,
    activationRevision: input.activationRevision,
    enforcementAvailable: input.enforcementAvailable,
  };

  const pepDecision = pep.evaluate(pepInput);

  if (pepDecision.outcome !== 'allow') {
    return {
      outcome: 'deny',
      reason: pepDecision.reason,
      pepDecision,
      boundaryDecision,
    };
  }

  return {
    outcome: 'allow',
    reason: pepDecision.reason,
    pepDecision,
    boundaryDecision,
  };
}
