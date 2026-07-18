// Exact-proposal operation authorization (Story 2.4, AD-13, AD-17, AD-18).
// Approval binds an UNFORGEABLE one-shot authorization to the exact
// OperationId + action/target/context/payload/destination/classification/
// credential-group digests + activationId + activationRevision + authority
// revision + policy decision + matrix version + creation time + expiry +
// approving interaction. A rewritten, replayed, or stale proposal cannot
// acquire authority: the effect executor revalidates every binding immediately
// before dispatch and rejects any mismatch as stale, emitting non-authorizing
// Evidence (AC #2). One-shot consumption (AC #1) + EventId/authorization
// identity dedup (AC #5) prevent double execution authority.
//
// Pure and side-effect free (no fs/network/journal) so it stays trivially
// unit-testable; CoreApp owns journaling of the durable ApprovalGranted /
// AuthorizationConsumed / AuthorizationRevoked events (AD-3).

import { createHash, randomUUID } from 'node:crypto';
import type { PepDecision } from './pep.js';
import type { OperationId } from '../protocol/ids.js';

/** The exact proposal fields an authorization is bound to (AC #1, AC #2). Any
 * field present at approval time becomes part of the binding digest; a
 * differing value at effect time is a stale/mismatched authorization. */
export interface ProposalBinding {
  readonly actionClass: string;
  readonly target?: string;
  readonly context?: string;
  /** Exact payload bytes (or sanitized safe summary) — never the raw secret. */
  readonly payload?: string;
  /** Verified recipient endpoint for a remote transfer (Story 2.6). */
  readonly destination?: string;
  /** Safe payload classification (Story 2.6). */
  readonly classification?: string;
  /** Credential group identity (Story 2.7) — never the credential value. */
  readonly credentialGroup?: string;
}

/** Stable canonical digest of a proposal field set (sha256 of canonical JSON).
 * Deterministic: the same binding always produces the same digest, so a
 * revalidated proposal can be compared byte-for-byte against the approved one. */
export function computeProposalDigest(binding: ProposalBinding): string {
  const canonical = JSON.stringify({
    actionClass: binding.actionClass,
    target: binding.target ?? null,
    context: binding.context ?? null,
    payload: binding.payload ?? null,
    destination: binding.destination ?? null,
    classification: binding.classification ?? null,
    credentialGroup: binding.credentialGroup ?? null,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** Digest a single optional field, or `null` when absent (so an absent binding
 * field is distinguishable from a present one and never silently matches). */
function digestOptional(value: string | undefined): string | null {
  return value === undefined ? null : createHash('sha256').update(value, 'utf8').digest('hex');
}

/** An unforgeable one-shot authorization bound to an exact proposal (AC #1). */
export interface Authorization {
  readonly authorizationId: string;
  readonly operationId: string;
  readonly actionDigest: string;
  readonly targetDigest: string | null;
  readonly contextDigest: string | null;
  readonly payloadDigest: string | null;
  readonly destinationDigest: string | null;
  readonly classification: string | null;
  readonly credentialGroup: string | null;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly policyOutcome: 'allow' | 'ask' | 'deny';
  readonly policyReason: string;
  readonly matrixVersion: number;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly approvingInteraction: string;
  /** One-shot consumption state (AC #1). `true` after the effect executor has
   * used this authorization to authorize a dispatch. */
  readonly consumed: boolean;
  readonly revoked: boolean;
  readonly revokedReason: string | null;
}

export interface CreateAuthorizationInput {
  readonly operationId: OperationId | string;
  readonly binding: ProposalBinding;
  readonly decision: PepDecision;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly expiresAt?: string | null;
  readonly approvingInteraction: string;
  readonly clock: () => string;
}

/** Build a fresh, unconsumed, unrevoked authorization bound to the exact
 * proposal (AC #1). The `decision` is the PEP evaluation the user approved —
 * recorded verbatim so a later matrix/policy change is detectable as stale. */
export function createAuthorization(input: CreateAuthorizationInput): Authorization {
  return {
    authorizationId: randomUUID(),
    operationId: input.operationId,
    actionDigest: computeProposalDigest(input.binding),
    targetDigest: digestOptional(input.binding.target),
    contextDigest: digestOptional(input.binding.context),
    payloadDigest: digestOptional(input.binding.payload),
    destinationDigest: digestOptional(input.binding.destination),
    classification: input.binding.classification ?? null,
    credentialGroup: input.binding.credentialGroup ?? null,
    activationId: input.activationId,
    activationRevision: input.activationRevision,
    authorityRevision: input.authorityRevision,
    policyOutcome: input.decision.outcome,
    policyReason: input.decision.reason,
    matrixVersion: input.decision.matrixVersion,
    createdAt: input.clock(),
    expiresAt: input.expiresAt ?? null,
    approvingInteraction: input.approvingInteraction,
    consumed: false,
    revoked: false,
    revokedReason: null,
  };
}

/** Why a revalidation refused an authorization (AC #2, AC #6). Stable,
 * sanitized, machine-readable — safe to journal (AD-24). */
export type RevalidationCause =
  | 'revoked'
  | 'consumed'
  | 'expired'
  | 'activation-changed'
  | 'authority-revision-changed'
  | 'action-mismatch'
  | 'target-mismatch'
  | 'context-mismatch'
  | 'payload-mismatch'
  | 'destination-mismatch'
  | 'classification-mismatch'
  | 'credential-group-mismatch'
  | 'policy-outcome-not-allow';

export interface RevalidationResult {
  readonly ok: boolean;
  readonly cause?: RevalidationCause;
}

/** Re-evaluate an authorization against the CURRENT proposal + activation
 * immediately before dispatch (AC #2, AC #6). Any mismatch — a rewritten
 * proposal, a changed activation/authority revision, an expired approval, or a
 * consumed/revoked one-shot — refuses the authorization and requires fresh
 * evaluation + approval. Never treats an expired/stale approval as Full Access
 * or transfer consent. */
export function revalidateAuthorization(
  auth: Authorization,
  opts: {
    readonly binding: ProposalBinding;
    readonly activationId: string;
    readonly activationRevision: number;
    readonly authorityRevision: number;
    readonly now: string;
  },
): RevalidationResult {
  if (auth.revoked) return { ok: false, cause: 'revoked' };
  if (auth.consumed) return { ok: false, cause: 'consumed' };
  if (auth.expiresAt !== null && auth.expiresAt <= opts.now) {
    return { ok: false, cause: 'expired' };
  }
  if (auth.activationId !== opts.activationId) return { ok: false, cause: 'activation-changed' };
  if (auth.activationRevision !== opts.activationRevision) {
    return { ok: false, cause: 'authority-revision-changed' };
  }
  if (auth.authorityRevision !== opts.authorityRevision) {
    return { ok: false, cause: 'authority-revision-changed' };
  }
  // The action digest is the canonical binding; a single combined digest
  // mismatch is reported as the most specific field that differs so the user
  // gets an actionable cause (AC #2).
  const cur = computeProposalDigest(opts.binding);
  if (cur !== auth.actionDigest) {
    if (auth.targetDigest !== null && digestOptional(opts.binding.target) !== auth.targetDigest) {
      return { ok: false, cause: 'target-mismatch' };
    }
    if (auth.contextDigest !== null && digestOptional(opts.binding.context) !== auth.contextDigest) {
      return { ok: false, cause: 'context-mismatch' };
    }
    if (auth.payloadDigest !== null && digestOptional(opts.binding.payload) !== auth.payloadDigest) {
      return { ok: false, cause: 'payload-mismatch' };
    }
    if (auth.destinationDigest !== null && digestOptional(opts.binding.destination) !== auth.destinationDigest) {
      return { ok: false, cause: 'destination-mismatch' };
    }
    if (auth.classification !== null && (opts.binding.classification ?? null) !== auth.classification) {
      return { ok: false, cause: 'classification-mismatch' };
    }
    if (auth.credentialGroup !== null && (opts.binding.credentialGroup ?? null) !== auth.credentialGroup) {
      return { ok: false, cause: 'credential-group-mismatch' };
    }
    return { ok: false, cause: 'action-mismatch' };
  }
  // An `ask`/`deny` decision never authorizes an effect even if the digests
  // match — the approval must have been for an `allow` decision (AC #2).
  if (auth.policyOutcome !== 'allow') return { ok: false, cause: 'policy-outcome-not-allow' };
  return { ok: true };
}

export interface ConsumeResult {
  readonly ok: boolean;
  readonly authorization?: Authorization;
  readonly cause?: 'already-consumed' | 'revoked' | 'not-allow';
}

/** Mark a one-shot authorization consumed by a dispatched effect (AC #1).
 * Double consumption is refused (AC #5) — a replayed approval cannot acquire
 * effect authority a second time. Returns a NEW authorization record with
 * `consumed: true`; the original stays unchanged (immutable). */
export function consumeAuthorization(auth: Authorization): ConsumeResult {
  if (auth.revoked) return { ok: false, cause: 'revoked' };
  if (auth.consumed) return { ok: false, cause: 'already-consumed' };
  if (auth.policyOutcome !== 'allow') return { ok: false, cause: 'not-allow' };
  return { ok: true, authorization: { ...auth, consumed: true } };
}

/** Revoke an authorization before dispatch commit (AC #3). Returns a NEW
 * record with `revoked: true`. */
export function revokeAuthorization(auth: Authorization, reason: string): Authorization {
  return { ...auth, revoked: true, revokedReason: reason };
}

/** The durable state of the underlying effect when revocation is requested
 * (AC #4). `before-commit` means the effect has NOT linearized — revocation
 * cancels cleanly. `dispatch-committed` means the effect may have already run;
 * revocation CANNOT claim cancellation without proof and must report the
 * observed outcome instead. */
export type DispatchState =
  | { readonly state: 'before-commit' }
  | { readonly state: 'dispatch-committed'; readonly terminal: 'succeeded' | 'failed' | 'unknown-outcome' | 'still-running' | 'none' };

/** Honest post-revocation outcome (AC #4). Before dispatch commit →
 * `cancelled`. After commit, revocation reports whatever durable Evidence
 * proves — never a cancellation fiction: a still-running effect stays
 * `still-running`, a succeeded one stays `succeeded`, an interrupted one is
 * `unknown-outcome`. Reconciliation remains explicit (no silent retry). */
export function revocationOutcome(dispatch: DispatchState): 'cancelled' | 'failed' | 'succeeded' | 'unknown-outcome' | 'still-running' {
  if (dispatch.state === 'before-commit') return 'cancelled';
  if (dispatch.terminal === 'none') return 'unknown-outcome';
  return dispatch.terminal;
}

/**
 * In-memory AuthorizationRegistry (Story 2.4 AC #5). Deduplicates by
 * `authorizationId` AND by authorization identity `(operationId,
 * actionDigest)` so a replayed or duplicate approval event cannot create a
 * second consumable authorization for the same exact proposal. Consumers
 * (CoreApp) deduplicate the durable approval EVENT by EventId before reaching
 * this registry; this registry is the second defense-in-depth layer.
 */
export class AuthorizationRegistry {
  private readonly byId = new Map<string, Authorization>();
  private readonly appliedEventIds = new Set<string>();

  /** Record a granted authorization. If an authorization for the same
   * `(operationId, actionDigest)` already exists, the existing record is kept
   * (dedup) and `deduplicated: true` is returned — the replay cannot mint a
   * fresh one-shot. */
  grant(auth: Authorization): { record: Authorization; deduplicated: boolean } {
    const existing = this.findByIdentity(auth.operationId, auth.actionDigest);
    if (existing) return { record: existing, deduplicated: true };
    this.byId.set(auth.authorizationId, auth);
    return { record: auth, deduplicated: false };
  }

  /** Apply an approval event, deduplicating by EventId (AC #5). A replayed
   * event (same EventId) is a no-op and reports `deduplicated: true`. */
  applyApprovalEvent(eventId: string, auth: Authorization): { record: Authorization; deduplicated: boolean } {
    if (this.appliedEventIds.has(eventId)) {
      const existing = this.byId.get(auth.authorizationId);
      if (existing) return { record: existing, deduplicated: true };
    }
    this.appliedEventIds.add(eventId);
    const res = this.grant(auth);
    return res;
  }

  get(authorizationId: string): Authorization | undefined {
    return this.byId.get(authorizationId);
  }

  /** Find an authorization by exact-proposal identity `(operationId,
   * actionDigest)` — the dedup key (AC #5). */
  findByIdentity(operationId: string, actionDigest: string): Authorization | undefined {
    for (const auth of this.byId.values()) {
      if (auth.operationId === operationId && auth.actionDigest === actionDigest) return auth;
    }
    return undefined;
  }

  /** Replace a record (e.g. after consume/revoke produced a new immutable
   * copy). No-op if the id is unknown. */
  replace(auth: Authorization): void {
    if (this.byId.has(auth.authorizationId)) this.byId.set(auth.authorizationId, auth);
  }

  clear(): void {
    this.byId.clear();
    this.appliedEventIds.clear();
  }
}