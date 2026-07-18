// Terminal aggregation for the Agent Loop (Story 3.10, AD-3, AD-13, AD-19, AD-22, AD-28).
//
// AC #1: when the loop reaches a terminal state, Prompt Round completion selects
// the STRONGEST unresolved state, names ALL included + excluded effects, and
// completion is published ONLY after durable post-commit Evidence.
//
// AC #2: a loop operation is cancelled, Runtime Activation changes, Full Access
// revoked, or a Boundary Expansion revoked -> the PEP revalidates authority
// revision, exact action identity, Workspace, checkpoint authorization, quota,
// platform state, and cancellation IMMEDIATELY; pending/prepared work is denied
// WITHOUT consuming one-shot authority.
//
// AC #3: an effect has reached `dispatch-committed` -> cancellation/revocation
// requested -> the result is `still-running`/`succeeded`/`failed`/`unknown-outcome`
// per durable evidence, NEVER an unsupported cancellation claim, and NO equivalent
// retry is started automatically.
//
// AC #4: a native command or mutation may have started but its result/cleanup/
// post-image is not proven -> terminal aggregation preserves `unknown-outcome`,
// records residual risk + dispatch classification, blocks blind/equivalent retry,
// and exposes ONLY inspection, supported reconciliation, or exit.
//
// AC #5: all loop operations reach terminal states -> the Prompt Round summary is
// published with operation status DISTINCT from aggregate Prompt Round status
// (AD-28), deterministic Evidence SEPARATE from model explanation, and the
// summary identifies applied/excluded/blocked/cancelled/unresolved scope WITHOUT
// affirmative success language for partial or unknown work.
//
// Pure, injectable: accepts all dependencies as parameters so it stays
// unit-testable without fs/network/journal.

import { buildAuthorityEvidence } from '../protocol/evidence.js';
import type { EvidenceCompleteness } from '../protocol/events.js';
import type { Authorization, RevalidationResult } from '../permissions/authorization.js';
import { revalidateAuthorization } from '../permissions/authorization.js';
import type {
  OperationTerminalKind,
  AggregateStatus,
  AggregateRoundOutcome,
  OperationTerminalState,
  RevalidationContext,
} from './types.js';

// --- Strongest unresolved ordering ---
//
// Deterministic ordering from most severe (highest priority) to least severe.
// When multiple operations have different terminal states, the strongest
// unresolved state is selected as the representative outcome.
//
// Ordering (most severe first):
//   1. unknown-outcome  — no terminal proof, highest risk
//   2. still-running    — effect may still be in flight
//   3. failed           — deterministic failure
//   4. cancelled        — user or system cancellation
//   5. blocked          — policy or boundary block
//   6. malformed        — structurally invalid proposal
//   7. denied           — policy denial
//   8. refused          — hard boundary refusal
//   9. reconciled       — previously unknown outcome resolved
//   10. succeeded       — clean terminal success (least severe)

const STRONGEST_ORDER: Record<OperationTerminalKind, number> = {
  'unknown-outcome': 10,
  'still-running': 9,
  'failed': 8,
  'cancelled': 7,
  'blocked': 6,
  'malformed': 5,
  'denied': 4,
  'refused': 3,
  'reconciled': 2,
  'succeeded': 1,
};

/**
 * Compare two terminal kinds and return the stronger (more severe) one.
 * Deterministic: the same pair always produces the same result.
 */
export function strongerTerminal(a: OperationTerminalKind, b: OperationTerminalKind): OperationTerminalKind {
  return STRONGEST_ORDER[a] >= STRONGEST_ORDER[b] ? a : b;
}

/**
 * Find the strongest unresolved state among a set of operation terminals.
 * Returns the kind with the highest severity according to the documented ordering.
 * When the set is empty, returns 'succeeded' (no operations = nothing unresolved).
 */
export function strongestUnresolved(operations: readonly OperationTerminalState[]): OperationTerminalKind {
  if (operations.length === 0) return 'succeeded';
  return operations.map((o) => o.kind).reduce(strongerTerminal);
}

// --- Aggregate status derivation ---

function deriveAggregateStatus(operations: readonly OperationTerminalState[]): AggregateStatus {
  if (operations.length === 0) return 'succeeded';

  const hasUnknown = operations.some((o) => o.kind === 'unknown-outcome' || o.kind === 'still-running');
  const hasFailed = operations.some((o) => o.kind === 'failed');
  const hasBlocked = operations.some((o) =>
    o.kind === 'blocked' || o.kind === 'malformed' || o.kind === 'denied' || o.kind === 'refused',
  );
  const hasCancelled = operations.some((o) => o.kind === 'cancelled');
  const allSucceeded = operations.every((o) => o.kind === 'succeeded' || o.kind === 'reconciled');

  if (hasUnknown) return 'unknown-outcome';
  if (hasFailed) return 'failed';
  if (hasBlocked) return 'blocked';
  if (hasCancelled) return 'partial';
  if (allSucceeded) return 'succeeded';
  return 'partial';
}

// --- Categorize effects ---

function categorizeEffects(operations: readonly OperationTerminalState[]): {
  readonly included: readonly string[];
  readonly excluded: readonly string[];
  readonly blocked: readonly string[];
  readonly cancelled: readonly string[];
  readonly unresolved: readonly string[];
} {
  const included: string[] = [];
  const excluded: string[] = [];
  const blocked: string[] = [];
  const cancelled: string[] = [];
  const unresolved: string[] = [];

  for (const op of operations) {
    switch (op.kind) {
      case 'succeeded':
      case 'reconciled':
        included.push(op.effectName);
        break;
      case 'blocked':
      case 'malformed':
      case 'denied':
      case 'refused':
        blocked.push(op.effectName);
        break;
      case 'cancelled':
        cancelled.push(op.effectName);
        break;
      case 'unknown-outcome':
      case 'still-running':
        unresolved.push(op.effectName);
        break;
    }
  }

  return { included, excluded, blocked, cancelled, unresolved };
}

// --- Residual risk ---

function hasResidualRisk(operations: readonly OperationTerminalState[]): boolean {
  return operations.some((o) => o.kind === 'unknown-outcome' || o.kind === 'still-running');
}

function collectResidualRisks(operations: readonly OperationTerminalState[]): readonly string[] {
  return operations
    .filter((o) => o.kind === 'unknown-outcome' || o.kind === 'still-running')
    .map((o) => o.residualRisk ?? `unproven outcome for ${o.effectName}`);
}

// --- AC #1: Aggregate terminals ---

export interface TerminalAggregatorDeps {
  readonly clock: () => string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly matrixVersion: number;
  readonly policyVersion: number;
  readonly workspaceId: string;
}

/**
 * Aggregate per-operation terminal states into a Prompt Round outcome (AC #1).
 *
 * Selects the strongest unresolved state, names all included + excluded effects,
 * and only publishes completion when post-commit Evidence is committed.
 *
 * @param operations - per-operation terminal states
 * @param deps - injectable dependencies (clock, authority, workspace)
 * @param postCommitEvidenceCommitted - true only after the journal has committed
 *   the post-dispatch Evidence
 * @param modelExplanation - optional model explanation (kept separate from
 *   deterministic Evidence per AC #5)
 * @returns an AggregateRoundOutcome with the round's terminal summary
 */
export function aggregateTerminals(
  operations: readonly OperationTerminalState[],
  deps: TerminalAggregatorDeps,
  postCommitEvidenceCommitted: boolean,
  modelExplanation: string | null = null,
): AggregateRoundOutcome {
  const strongest = strongestUnresolved(operations);
  const categorized = categorizeEffects(operations);
  const aggregateStatus = deriveAggregateStatus(operations);
  const risks = collectResidualRisks(operations);
  const hasResidual = hasResidualRisk(operations);

  // Build deterministic Evidence (AC #5: separate from model explanation).
  const evidence = buildAuthorityEvidence({
    decisionKind: 'policy-decision',
    operationId: 'aggregate',
    actionDigest: null,
    targetDigest: null,
    payloadDigest: null,
    activationRevision: deps.activationRevision,
    authorityRevision: deps.authorityRevision,
    matrixVersion: deps.matrixVersion,
    policyVersion: deps.policyVersion,
    workspaceId: deps.workspaceId,
    providerServiceIdentity: null,
    decision: aggregateStatus === 'succeeded' ? 'allow' : aggregateStatus === 'blocked' ? 'deny' : 'stale',
    reasonCode: `aggregate-${aggregateStatus}`,
    clock: deps.clock,
    nextStep: aggregateStatus === 'succeeded' ? 'continue' : aggregateStatus === 'unknown-outcome' ? 'reconcile; do not auto-retry' : 'review and retry',
  });

  const evidenceCompleteness: EvidenceCompleteness = hasResidual ? 'partial' : 'complete';

  return {
    strongestUnresolved: strongest,
    includedEffects: categorized.included,
    excludedEffects: categorized.excluded,
    blockedEffects: categorized.blocked,
    cancelledEffects: categorized.cancelled,
    unresolvedEffects: categorized.unresolved,
    operationStatus: strongest,
    aggregateStatus,
    evidence,
    evidenceCompleteness,
    modelExplanation,
    residualRisks: risks,
    blindRetryBlocked: hasResidual,
    onlyInspectReconcileExit: hasResidual,
    committed: postCommitEvidenceCommitted,
  };
}

// --- AC #2: Revalidate authority for next effect ---

export interface RevalidateNextEffectInput {
  readonly effectName: string;
  readonly actionClass: string;
  readonly target?: string;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly workspaceId: string;
  readonly workspaceRoot: string;
  readonly checkpointAuthorized: boolean;
  readonly quotaExceeded: boolean;
  readonly platformState: 'healthy' | 'unhealthy';
  readonly cancelled: boolean;
  readonly authorization?: Authorization;
}

export interface RevalidateNextEffectResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly authorityConsumed: boolean;
}

/**
 * Revalidate authority for the next effect before it starts (AC #2).
 *
 * When a loop operation is cancelled, Runtime Activation changes, Full Access
 * is revoked, or a Boundary Expansion is revoked, this function revalidates:
 * - authority revision
 * - exact action identity
 * - Workspace
 * - checkpoint authorization
 * - quota
 * - platform state
 * - cancellation
 *
 * Pending/prepared work is denied WITHOUT consuming one-shot authority.
 * Delegates to the existing PEP/authorization/runtimeActivation modules.
 */
export function revalidateAuthorityForNextEffect(
  input: RevalidateNextEffectInput,
  ctx: RevalidationContext,
): RevalidateNextEffectResult {
  // 1. Check cancellation first.
  if (input.cancelled) {
    return { ok: false, reason: 'operation-cancelled', authorityConsumed: false };
  }

  // 2. Check activation/authority revision (Runtime Activation changes).
  if (input.activationId !== ctx.activationId) {
    return { ok: false, reason: 'activation-changed', authorityConsumed: false };
  }
  if (input.activationRevision !== ctx.activationRevision) {
    return { ok: false, reason: 'activation-revision-changed', authorityConsumed: false };
  }
  if (input.authorityRevision !== ctx.authorityRevision) {
    return { ok: false, reason: 'authority-revision-changed', authorityConsumed: false };
  }

  // 3. Check Workspace identity.
  if (input.workspaceId !== ctx.workspaceId) {
    return { ok: false, reason: 'workspace-changed', authorityConsumed: false };
  }

  // 4. Check checkpoint authorization.
  if (!input.checkpointAuthorized) {
    return { ok: false, reason: 'checkpoint-not-authorized', authorityConsumed: false };
  }

  // 5. Check quota.
  if (input.quotaExceeded) {
    return { ok: false, reason: 'quota-exceeded', authorityConsumed: false };
  }

  // 6. Check platform state.
  if (input.platformState === 'unhealthy') {
    return { ok: false, reason: 'platform-unhealthy', authorityConsumed: false };
  }

  // 7. If an authorization is provided, revalidate it (delegates to
  //    authorization.ts). This does NOT consume the one-shot — it only checks
  //    that the authorization is still valid.
  if (input.authorization !== undefined) {
    const revalidation: RevalidationResult = revalidateAuthorization(input.authorization, {
      binding: { actionClass: input.actionClass, target: input.target },
      activationId: ctx.activationId,
      activationRevision: ctx.activationRevision,
      authorityRevision: ctx.authorityRevision,
      now: ctx.clock(),
    });
    if (!revalidation.ok) {
      return { ok: false, reason: `authorization-stale: ${revalidation.cause}`, authorityConsumed: false };
    }
  }

  return { ok: true, authorityConsumed: false };
}

// --- AC #3: Dispatch-committed outcome ---

/**
 * Determine the outcome of a dispatch-committed effect from durable evidence
 * (AC #3). When cancellation or revocation is requested for a dispatch-committed
 * effect, this function returns the honest outcome per durable evidence:
 * - `still-running` if dispatch-committed but no terminal event
 * - `succeeded` if OperationSucceeded evidence exists
 * - `failed` if OperationFailed evidence exists
 * - `unknown-outcome` if OperationUnknownOutcome evidence exists or no evidence
 *
 * NEVER returns `cancelled` for a dispatch-committed effect (no cancellation
 * fiction). NO equivalent retry is started automatically — the caller must
 * handle the outcome explicitly.
 */
export function dispatchCommittedOutcome(
  evidence: readonly { readonly kind: string; readonly operationId: string }[],
  operationId: string,
): 'still-running' | 'succeeded' | 'failed' | 'unknown-outcome' {
  const ops = evidence.filter((e) => e.operationId === operationId);

  // Check for terminal outcomes in order of precedence.
  if (ops.some((e) => e.kind === 'OperationSucceeded')) return 'succeeded';
  if (ops.some((e) => e.kind === 'OperationFailed')) return 'failed';
  if (ops.some((e) => e.kind === 'OperationUnknownOutcome')) return 'unknown-outcome';

  // Check if dispatch-committed but no terminal event yet.
  if (ops.some((e) => e.kind === 'EffectDispatchCommitted')) return 'still-running';

  // No evidence at all.
  return 'unknown-outcome';
}

// --- AC #4: Unproven native result ---

export interface UnprovenNativeResult {
  readonly outcome: 'unknown-outcome';
  readonly residualRisk: string;
  readonly dispatchClassification: string;
  readonly blindRetryBlocked: true;
  readonly onlyInspectReconcileExit: true;
}

/**
 * Handle an unproven native command or mutation result (AC #4).
 *
 * When a native command or mutation may have started but its result, cleanup,
 * or post-image is not proven, this function:
 * - preserves `unknown-outcome`
 * - records residual risk and dispatch classification
 * - blocks blind/equivalent retry
 * - exposes only inspection, supported reconciliation, or exit
 */
export function unprovenNativeResult(
  operationId: string,
  dispatchClassification: string,
  residualRisk: string,
): UnprovenNativeResult {
  void operationId; // carried by the caller's durable event
  return {
    outcome: 'unknown-outcome',
    residualRisk,
    dispatchClassification,
    blindRetryBlocked: true as const,
    onlyInspectReconcileExit: true as const,
  };
}

// --- AC #5: Summary helpers ---

/**
 * Build the lead language for an aggregate round outcome (AC #5).
 * Never uses affirmative success language for partial or unknown work.
 */
export function aggregateLeadLanguage(aggregateStatus: AggregateStatus): string {
  switch (aggregateStatus) {
    case 'succeeded':
      return 'All operations completed successfully.';
    case 'partial':
      return 'Some operations completed; others did not. Review the summary below.';
    case 'blocked':
      return 'Operations were blocked by policy or boundaries.';
    case 'failed':
      return 'Operations failed. Review evidence and retry with corrections.';
    case 'unknown-outcome':
      return 'Some operations have unknown outcomes. Reconcile before proceeding. Do not auto-retry.';
  }
}

/**
 * Build a human-readable summary of the aggregate round outcome (AC #5).
 * Identifies applied, excluded, blocked, cancelled, and unresolved scope.
 * Does NOT use affirmative success language for partial or unknown work.
 */
export function buildAggregateSummary(outcome: AggregateRoundOutcome): string {
  const parts: string[] = [];

  if (outcome.includedEffects.length > 0) {
    parts.push(`Applied: ${outcome.includedEffects.join(', ')}`);
  }
  if (outcome.excludedEffects.length > 0) {
    parts.push(`Excluded: ${outcome.excludedEffects.join(', ')}`);
  }
  if (outcome.blockedEffects.length > 0) {
    parts.push(`Blocked: ${outcome.blockedEffects.join(', ')}`);
  }
  if (outcome.cancelledEffects.length > 0) {
    parts.push(`Cancelled: ${outcome.cancelledEffects.join(', ')}`);
  }
  if (outcome.unresolvedEffects.length > 0) {
    parts.push(`Unresolved: ${outcome.unresolvedEffects.join(', ')}`);
  }

  if (parts.length === 0) {
    return 'No operations in this round.';
  }

  return parts.join('\n');
}
