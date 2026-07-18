// Progressive approval disclosure + safe decision controls (Story 2.5, AD-13,
// AD-17, AD-18, FR-23, FR-24). The approval surface is a pure contract: it
// first presents plain-language purpose/risk/outcome + Workspace/Mode/Profile/
// Full Access/enforcement state + OperationId with a `Review`/`Cancel` STARTING
// focus (never `Approve`), then reveals authoritative exact details on demand
// (AC #1, #2). Sensitive/destructive/boundary-expanding actions require the
// explicitly applicable authority and cannot be approved on an unresolved
// destination/classification/digest/enforcement state (AC #3). A decision is
// recorded against the exact OperationId + digest; `Esc` only cancels/dismisses
// and never authorizes (AC #4). A stale approval disables the committing
// control before it can authorize (AC #5). With no TTY the operation fails
// closed — `blocked`, `next: rerun interactively`, stable exit class/code, no
// stdin secret/authority read, no effect dispatch (AC #6).
//
// Pure and side-effect free; CoreApp wires the durable journal + authorization
// grant on an `approve` decision (Story 2.4).

import { EXIT_CODES, type ExitClass } from '../protocol/uxState.js';

export type ApprovalDecision = 'approve' | 'deny' | 'cancel' | 'dismiss';

/** Deterministic starting focus — always `review` or `cancel`, NEVER `approve`
 * (AC #1). The committing control cannot receive initial focus. */
export type ApprovalStartFocus = 'review' | 'cancel';

export interface ApprovalContextState {
  readonly workspaceId: string;
  readonly workMode: 'plan' | 'build';
  readonly profile: 'manual' | 'assisted' | 'full-access';
  readonly fullAccess: boolean;
  readonly enforcementVerified: boolean;
}

/** Whether an approval requires the explicitly applicable authority beyond a
 * generic local approval / Full Access (AC #3). */
export interface ApprovalAuthorityFlags {
  readonly sensitive: boolean;
  readonly destructive: boolean;
  readonly boundaryExpanding: boolean;
  /** True for remote transfers — require resolved destination + classification
   * + payload digest before an `approve` can bind (AC #3). */
  readonly transfer: boolean;
}

/** Plain-language first-layer disclosure (AC #1). Raw secrets never appear. */
export interface ApprovalSummary {
  readonly operationId: string;
  readonly actionClass: string;
  readonly actionDigest: string;
  readonly purpose: string;
  readonly risk: string;
  readonly proposedOutcome: string;
  readonly context: ApprovalContextState;
  readonly startFocus: ApprovalStartFocus;
  readonly authorityFlags: ApprovalAuthorityFlags;
}

/** Authoritative exact details revealed on `Review` (AC #2). Discriminated by
 * action kind so the exact fields shown match the action; technical identifiers
 * remain exact and raw secrets remain absent (AD-24). */
export type ApprovalExactDetails =
  | { readonly kind: 'command'; readonly executable: string; readonly argv: readonly string[]; readonly cwd: string; readonly envClass: string }
  | { readonly kind: 'mutation'; readonly target: string; readonly changeSummary: string }
  | { readonly kind: 'deletion'; readonly scope: string }
  | { readonly kind: 'transfer'; readonly verifiedDestination: string; readonly safeTransferSummary: string; readonly classification: string };

/** An unresolved required field blocks `approve` (AC #3). `null`/empty values
 * for destination/classification/digest/enforcement state mean the user cannot
 * approve — the surface must refuse and require resolution. */
export interface ApprovalResolvedState {
  readonly destinationResolved: boolean;
  readonly classificationResolved: boolean;
  readonly digestResolved: boolean;
  readonly enforcementResolved: boolean;
}

export interface BuildApprovalSummaryInput {
  readonly operationId: string;
  readonly actionClass: string;
  readonly actionDigest: string;
  readonly purpose: string;
  readonly risk: string;
  readonly proposedOutcome: string;
  readonly context: ApprovalContextState;
  readonly authorityFlags: ApprovalAuthorityFlags;
  /** Starting focus override — only `review` or `cancel` is accepted; an
   * attempt to start on `approve`/`deny` is coerced to `review` (AC #1). */
  readonly startFocus?: ApprovalStartFocus;
}

/** Build the first-layer summary. The starting focus is ALWAYS `review` or
 * `cancel` — any other value is coerced to `review` so the committing control
 * never receives initial focus (AC #1). */
export function buildApprovalSummary(input: BuildApprovalSummaryInput): ApprovalSummary {
  const startFocus: ApprovalStartFocus =
    input.startFocus === 'cancel' ? 'cancel' : 'review';
  return {
    operationId: input.operationId,
    actionClass: input.actionClass,
    actionDigest: input.actionDigest,
    purpose: input.purpose,
    risk: input.risk,
    proposedOutcome: input.proposedOutcome,
    context: input.context,
    startFocus,
    authorityFlags: input.authorityFlags,
  };
}

/** True when the action requires the explicitly applicable authority (AC #3) —
 * Full Access alone or an unrelated local approval is insufficient. */
export function requiresExplicitAuthority(flags: ApprovalAuthorityFlags): boolean {
  return flags.sensitive || flags.destructive || flags.boundaryExpanding || flags.transfer;
}

/** The reason text shown when Full Access / an unrelated approval is
 * insufficient (AC #3). */
export function authorityInsufficientReason(flags: ApprovalAuthorityFlags): string {
  const parts: string[] = [];
  if (flags.sensitive) parts.push('sensitive-transfer authority is required and is separate from Full Access');
  if (flags.destructive) parts.push('destructive action requires explicit destructive approval');
  if (flags.boundaryExpanding) parts.push('a durable Boundary Expansion is required and is separate from a one-off approval');
  if (flags.transfer) parts.push('remote-transfer consent bound to the exact payload + recipient is required');
  return parts.join('; ') || 'explicit applicable authority is required';
}

/** AC #3: an `approve` is only bindable when every required field is resolved.
 * Returns the unresolved field names (empty array = resolvable/approvable). */
export function unresolvedApprovalFields(resolved: ApprovalResolvedState, flags: ApprovalAuthorityFlags): readonly string[] {
  const missing: string[] = [];
  if (flags.transfer && !resolved.destinationResolved) missing.push('destination');
  if (flags.transfer && !resolved.classificationResolved) missing.push('classification');
  if (!resolved.digestResolved) missing.push('digest');
  if (!resolved.enforcementResolved) missing.push('enforcement-state');
  return missing;
}

/** A decision record bound to the exact OperationId + digest (AC #4). `Esc`
 * maps to `dismiss`/`cancel` and never to `approve`. */
export interface ApprovalDecisionRecord {
  readonly operationId: string;
  readonly actionDigest: string;
  readonly decision: ApprovalDecision;
  readonly reason: string;
  readonly timestamp: string;
}

/** Record a decision against the exact OperationId + digest. `Esc`-style
 * dismissal is coerced to a non-authorizing `cancel`/`dismiss` — never
 * `approve` (AC #4). */
export function recordApprovalDecision(input: {
  readonly summary: ApprovalSummary;
  readonly decision: ApprovalDecision;
  readonly reason: string;
  readonly clock: () => string;
}): ApprovalDecisionRecord {
  return {
    operationId: input.summary.operationId,
    actionDigest: input.summary.actionDigest,
    decision: input.decision,
    reason: input.reason,
    timestamp: input.clock(),
  };
}

/** Whether an open approval is stale vs the current context/digest (AC #5). */
export function isApprovalStale(
  summary: ApprovalSummary,
  current: { readonly context: ApprovalContextState; readonly actionDigest: string },
): boolean {
  if (summary.actionDigest !== current.actionDigest) return true;
  const a = summary.context;
  const b = current.context;
  return (
    a.workspaceId !== b.workspaceId ||
    a.workMode !== b.workMode ||
    a.profile !== b.profile ||
    a.fullAccess !== b.fullAccess ||
    a.enforcementVerified !== b.enforcementVerified
  );
}

/** AC #6: the canonical no-TTY fail-closed result. The operation never waits
 * on stdin, never reads a secret or authority from stdin, and never dispatches
 * an effect. Carries the stable exit class/code from ux-state-v1 (Story 2.8). */
export interface NoTtyFailClosedResult {
  readonly status: 'blocked';
  readonly cause: 'no-tty-interactive-approval-required';
  readonly next: 'rerun interactively';
  readonly exitClass: ExitClass;
  readonly exitCode: number;
  readonly stdinSecretRead: false;
  readonly stdinAuthorityRead: false;
  readonly effectDispatched: false;
}

export function noTtyFailClosed(): NoTtyFailClosedResult {
  return {
    status: 'blocked',
    cause: 'no-tty-interactive-approval-required',
    next: 'rerun interactively',
    exitClass: 'BLOCKED',
    exitCode: EXIT_CODES.BLOCKED,
    stdinSecretRead: false,
    stdinAuthorityRead: false,
    effectDispatched: false,
  };
}

/** Render an approval summary as text labels for redirected/linearized/headless
 * output parity (AC #1, UX-DR-031). No color-only meaning; technical
 * identifiers stay exact. `width` clamps the line width (0 = no wrap). */
export function renderApprovalText(summary: ApprovalSummary, width = 0): string {
  const c = summary.context;
  const lines = [
    `Operation: ${summary.operationId}`,
    `Action: ${summary.actionClass}`,
    `Purpose: ${summary.purpose}`,
    `Risk: ${summary.risk}`,
    `Outcome: ${summary.proposedOutcome}`,
    `Workspace: ${c.workspaceId}`,
    `Mode: ${c.workMode}  Profile: ${c.profile}  Full Access: ${c.fullAccess ? 'yes' : 'no'}`,
    `Enforcement: ${c.enforcementVerified ? 'verified' : 'ENFORCEMENT UNVERIFIED'}`,
    `Start focus: ${summary.startFocus} (review exact details before approving)`,
  ];
  if (requiresExplicitAuthority(summary.authorityFlags)) {
    lines.push(`Requires explicit authority: ${authorityInsufficientReason(summary.authorityFlags)}`);
  }
  if (width > 0) {
    return lines.map((l) => (l.length > width ? `${l.slice(0, width - 1)}…` : l)).join('\n');
  }
  return lines.join('\n');
}