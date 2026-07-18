// Workspace identity and non-overridable hard boundaries (Story 2.3, AD-12,
// AD-17, AD-18). `checkHardBoundary` takes NO Work Mode / Permission Profile
// parameter by construction — a hard boundary is evaluated independently of
// authority and cannot be converted from `deny` to `allow` by any profile,
// including Full Access (AC #2). Builds on the existing workspace-escape
// check in `tools/workspace.ts` rather than forking it.

import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { resolveWithinWorkspace, WorkspaceBoundaryError } from '../tools/workspace.js';
import { ENFORCEMENT_UNVERIFIED } from './matrix.js';

export { BUDGET_NOT_SET, ENFORCEMENT_UNVERIFIED } from './matrix.js';

/** Stable Workspace identity (Story 2.3 AC #1). Deterministic — the same
 * resolved root always yields the same `workspaceId`, case-insensitively on
 * Windows (matches the existing `resolveWithinWorkspace` case-folding
 * behavior), so identity does not depend on incidental path casing. */
export interface WorkspaceIdentity {
  readonly workspaceId: string;
  readonly root: string;
}

export function workspaceIdentity(root: string): WorkspaceIdentity {
  const resolved = path.resolve(root);
  const workspaceId = createHash('sha256').update(resolved.toLowerCase()).digest('hex').slice(0, 16);
  return { workspaceId, root: resolved };
}

export type HardBoundaryReason =
  | 'workspace-escape'
  | 'unsafe-path'
  | 'host-threatening-command'
  | 'unallowlisted-network-destination'
  | typeof ENFORCEMENT_UNVERIFIED
  | 'quota-exceeded'
  | 'wrong-credential-group';

export interface BoundaryCheckInput {
  readonly workspaceRoot: string;
  /** Present for filesystem-shaped effects; checked against the Workspace
   * boundary via the existing `resolveWithinWorkspace`. */
  readonly candidatePath?: string;
  readonly commandClass?: 'safe' | 'host-threatening';
  readonly networkDestination?: string;
  readonly allowlistedNetworkDestinations?: readonly string[];
  /** Undefined/true = the required platform enforcement mechanism for this
   * effect class is available and verified (PR-3). */
  readonly enforcementAvailable?: boolean;
  readonly quotaExceeded?: boolean;
  readonly credentialGroup?: string;
  readonly expectedCredentialGroup?: string;
}

export interface BoundaryDecision {
  readonly outcome: 'allow' | 'deny';
  readonly reason?: HardBoundaryReason;
  /** Canonical target/resource identity bound into the decision, so
   * effect-time revalidation (`revalidateBoundary`) can detect drift
   * (Story 2.3 AC #3). */
  readonly resourceIdentity?: string;
}

/**
 * Evaluate a proposal against the non-overridable hard boundaries (Story 2.3
 * AC #2): workspace escape, unsafe path, host-threatening command class,
 * unallowlisted network/service destination, unavailable enforcement
 * mechanism, exceeded quota, wrong credential group. `deny` here can NEVER
 * be converted to `allow` by any Work Mode/Permission Profile decision —
 * this function has no such parameter, and the PEP (`pep.ts`) must consult
 * it independently of (and before/after, but never instead of) the
 * mode/profile matrix.
 */
export function checkHardBoundary(input: BoundaryCheckInput): BoundaryDecision {
  let resourceIdentity: string | undefined;

  if (input.candidatePath !== undefined) {
    try {
      resourceIdentity = resolveWithinWorkspace(input.workspaceRoot, input.candidatePath);
    } catch (e) {
      if (e instanceof WorkspaceBoundaryError) {
        return { outcome: 'deny', reason: 'workspace-escape' };
      }
      return { outcome: 'deny', reason: 'unsafe-path' };
    }
  }

  if (input.commandClass === 'host-threatening') {
    return { outcome: 'deny', reason: 'host-threatening-command', resourceIdentity };
  }

  if (input.networkDestination !== undefined) {
    const allowed = input.allowlistedNetworkDestinations?.includes(input.networkDestination) ?? false;
    if (!allowed) {
      return { outcome: 'deny', reason: 'unallowlisted-network-destination', resourceIdentity };
    }
  }

  if (input.enforcementAvailable === false) {
    return { outcome: 'deny', reason: ENFORCEMENT_UNVERIFIED, resourceIdentity };
  }

  if (input.quotaExceeded) {
    return { outcome: 'deny', reason: 'quota-exceeded', resourceIdentity };
  }

  if (input.expectedCredentialGroup !== undefined && input.credentialGroup !== input.expectedCredentialGroup) {
    return { outcome: 'deny', reason: 'wrong-credential-group', resourceIdentity };
  }

  return { outcome: 'allow', resourceIdentity };
}

/** Minimal identity snapshot bound into a boundary decision, for effect-time
 * revalidation (Story 2.3 AC #3). */
export interface BoundarySnapshot {
  readonly resourceIdentity?: string;
  readonly workspaceId: string;
  readonly enforcementAvailable?: boolean;
}

export interface RevalidationResult {
  readonly stale: boolean;
  readonly reason?: 'resource-identity-changed' | 'workspace-identity-changed' | 'enforcement-state-changed';
}

/**
 * Revalidate a previously evaluated boundary decision against the CURRENT
 * state immediately before effect start (Story 2.3 AC #3, AD-13). Any drift
 * in target identity, workspace/platform identity, or enforcement state
 * makes the previous decision stale — the caller must deny or re-evaluate,
 * and the old authorization is never consumed as-is.
 */
export function revalidateBoundary(original: BoundarySnapshot, current: BoundarySnapshot): RevalidationResult {
  if (original.resourceIdentity !== current.resourceIdentity) {
    return { stale: true, reason: 'resource-identity-changed' };
  }
  if (original.workspaceId !== current.workspaceId) {
    return { stale: true, reason: 'workspace-identity-changed' };
  }
  if (original.enforcementAvailable !== current.enforcementAvailable) {
    return { stale: true, reason: 'enforcement-state-changed' };
  }
  return { stale: false };
}

/** A durable Boundary Expansion (Story 2.3 AC #4, #5, AD-17). Separately
 * scoped from temporary approval or transfer consent — granting one is NOT
 * itself an approval or a transfer consent, and it is independently
 * inspectable/revocable. */
export interface BoundaryExpansion {
  readonly expansionId: string;
  readonly resourceIdentity: string;
  readonly workspaceId: string;
  readonly actionClasses: readonly string[];
  readonly reason: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly revoked: boolean;
  readonly revokedAt: string | null;
}

/**
 * In-memory registry of durable Boundary Expansions for one Runtime
 * Activation's lifetime. The caller (CoreApp) is responsible for journaling
 * `BoundaryExpansionGranted`/`BoundaryExpansionRevoked` durable events
 * alongside calls into this registry (AD-3) — this module stays a pure,
 * synchronously testable state container with no journal/IO dependency.
 */
export class BoundaryExpansionRegistry {
  private readonly expansions = new Map<string, BoundaryExpansion>();

  constructor(private readonly clock: () => string = () => new Date().toISOString()) {}

  grant(input: {
    readonly resourceIdentity: string;
    readonly workspaceId: string;
    readonly actionClasses: readonly string[];
    readonly reason: string;
    readonly expiresAt?: string | null;
  }): BoundaryExpansion {
    const expansion: BoundaryExpansion = {
      expansionId: randomUUID(),
      resourceIdentity: input.resourceIdentity,
      workspaceId: input.workspaceId,
      actionClasses: input.actionClasses,
      reason: input.reason,
      createdAt: this.clock(),
      expiresAt: input.expiresAt ?? null,
      revoked: false,
      revokedAt: null,
    };
    this.expansions.set(expansion.expansionId, expansion);
    return expansion;
  }

  /** Revocation is permanent and fail-closed: it prevents all FUTURE
   * authorization but never claims an already-committed effect was
   * cancelled (AC #5, AD-13). Returns `false` if the id is unknown. */
  revoke(expansionId: string, reason: string): boolean {
    const existing = this.expansions.get(expansionId);
    if (!existing || existing.revoked) return false;
    this.expansions.set(expansionId, { ...existing, revoked: true, revokedAt: this.clock() });
    void reason; // carried by the caller's durable BoundaryExpansionRevoked event, not stored here
    return true;
  }

  get(expansionId: string): BoundaryExpansion | undefined {
    return this.expansions.get(expansionId);
  }

  /** Full, auditable inventory (AC #5) — defensive copy. */
  list(): readonly BoundaryExpansion[] {
    return [...this.expansions.values()];
  }

  /** True only for a non-revoked, non-expired expansion that covers the
   * exact resource/workspace/action-class combination right now. Unknown,
   * revoked, or expired all fail closed to `false` — never optimistically
   * `true` (AC #5). */
  isActive(expansionId: string, actionClass: string, nowIso: string): boolean {
    const e = this.expansions.get(expansionId);
    if (!e || e.revoked) return false;
    if (e.expiresAt !== null && e.expiresAt <= nowIso) return false;
    return e.actionClasses.includes(actionClass);
  }
}
