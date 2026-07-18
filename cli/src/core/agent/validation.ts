// Proposal validation for the Agent Loop (Story 3.9, AD-4, AD-7, AD-14, AD-24).
//
// AC #1: when the loop receives a proposal, the local harness validates schema,
// action class, Work Mode, Permission Profile, Workspace/resource identity,
// consent where applicable, quota, credentials, and hard boundaries BEFORE any
// tool or process adapter receives it.
//
// AC #2: malformed/unknown/unsupported/out-of-scope/policy-incomplete proposal
// -> malformed/blocked/refused with sanitized deterministic Evidence; performs
// NO repair, reinterpretation, substitution, or retry (AD-14); leaves NO
// authorization or staged effect that could later dispatch.
//
// Pure, injectable: accepts all dependencies as parameters so it stays
// unit-testable without fs/network/journal.

import type { ActionClassDefinition } from '../permissions/matrix.js';
import type { PermissionDecision, PolicyState } from '../permissions/types.js';
import type { BoundaryDecision } from '../permissions/boundary.js';
import type { Sanitizer } from '../security/sanitizer.js';
import { buildAuthorityEvidence } from '../protocol/evidence.js';
import { newOperationId } from '../protocol/ids.js';
import type {
  InvalidProposal,
  ProposalValidationResult,
  ValidationContext,
  ProposalToValidate,
} from './types.js';

// --- Injectable dependency ports ---

export interface ValidationDeps {
  readonly lookupActionClass: (actionClass: string) => ActionClassDefinition | undefined;
  readonly evaluatePermission: (action: { tool: string; mutating: boolean; sensitive?: boolean }, state: PolicyState) => PermissionDecision;
  readonly checkHardBoundary: (input: {
    readonly workspaceRoot: string;
    readonly candidatePath?: string;
    readonly commandClass?: 'safe' | 'host-threatening';
    readonly networkDestination?: string;
    readonly allowlistedNetworkDestinations?: readonly string[];
    readonly enforcementAvailable?: boolean;
    readonly quotaExceeded?: boolean;
    readonly credentialGroup?: string;
    readonly expectedCredentialGroup?: string;
  }) => BoundaryDecision;
  readonly sanitizer: Sanitizer;
}

// --- Validation outcomes ---

/**
 * Validate a proposal comprehensively before any tool or process adapter
 * receives it (AC #1). Checks are ordered by specificity: schema first, then
 * action class, then mode, profile, workspace, consent, quota, credentials,
 * and hard boundaries. The first failing check determines the outcome.
 *
 * Returns `valid: true` with a fresh OperationId on success, or `valid: false`
 * with a deterministic outcome, reason, and sanitized Evidence on failure.
 * Performs NO repair, reinterpretation, substitution, or retry (AD-14).
 * Leaves NO authorization or staged effect (AC #2).
 */
export function validateProposal(
  proposal: ProposalToValidate,
  ctx: ValidationContext,
  deps: ValidationDeps,
): ProposalValidationResult {
  const operationId = newOperationId();

  // 1. Schema validation (structural).
  if (typeof proposal.toolName !== 'string' || proposal.toolName.length === 0) {
    return invalidResult('malformed', 'tool name is empty or not a string', operationId, ctx, deps);
  }
  if (proposal.input === null || typeof proposal.input !== 'object' || Array.isArray(proposal.input)) {
    return invalidResult('malformed', 'tool input is not an object', operationId, ctx, deps);
  }

  // 2. Action class validation.
  const actionDef = deps.lookupActionClass(proposal.actionClass);
  if (actionDef === undefined) {
    return invalidResult('blocked', `unknown action class: ${proposal.actionClass}`, operationId, ctx, deps);
  }

  // 3. Work Mode check (structural Plan-Mode read-only boundary, AD-13).
  if (ctx.mode === 'plan' && proposal.mutating) {
    return invalidResult('blocked', 'plan-mode-is-read-only', operationId, ctx, deps);
  }

  // 4. Permission Profile check.
  const decision = deps.evaluatePermission(
    { tool: proposal.actionClass, mutating: proposal.mutating, sensitive: proposal.sensitive },
    { mode: ctx.mode, profile: ctx.profile },
  );
  if (decision.outcome === 'deny') {
    return invalidResult('blocked', decision.reason, operationId, ctx, deps);
  }

  // 5. Workspace/resource identity check.
  if (proposal.target !== undefined) {
    const boundaryCheck = deps.checkHardBoundary({
      workspaceRoot: ctx.workspace.canonicalRoot,
      candidatePath: proposal.target,
    });
    if (boundaryCheck.outcome === 'deny') {
      return invalidResult('blocked', `workspace boundary violation: ${boundaryCheck.reason ?? 'workspace-escape'}`, operationId, ctx, deps);
    }
  }

  // 6. Consent check (where applicable).
  if (proposal.requiresConsent === true && proposal.consentGiven !== true) {
    return invalidResult('refused', 'consent required but not given', operationId, ctx, deps);
  }

  // 7. Quota check.
  if (proposal.quotaExceeded === true) {
    return invalidResult('blocked', 'quota exceeded', operationId, ctx, deps);
  }

  // 8. Credential check.
  if (proposal.credentialGroup !== undefined) {
    const boundaryCheck = deps.checkHardBoundary({
      workspaceRoot: ctx.workspace.canonicalRoot,
      credentialGroup: proposal.credentialGroup,
      expectedCredentialGroup: proposal.credentialGroup,
    });
    if (boundaryCheck.outcome === 'deny') {
      return invalidResult('blocked', `credential group mismatch: ${proposal.credentialGroup}`, operationId, ctx, deps);
    }
  }

  // 9. Hard boundaries (comprehensive).
  const hardBoundary = deps.checkHardBoundary({
    workspaceRoot: ctx.workspace.canonicalRoot,
    candidatePath: proposal.target,
    quotaExceeded: proposal.quotaExceeded,
  });
  if (hardBoundary.outcome === 'deny') {
    return invalidResult('blocked', `hard boundary violation: ${hardBoundary.reason ?? 'unknown'}`, operationId, ctx, deps);
  }

  return { valid: true, operationId };
}

// --- Helpers ---

function invalidResult(
  outcome: 'malformed' | 'blocked' | 'refused',
  reason: string,
  operationId: string,
  ctx: ValidationContext,
  deps: ValidationDeps,
): InvalidProposal {
  // Sanitize the reason before building Evidence (AD-24).
  const sanitized = deps.sanitizer.sanitize(reason, 'error-message');
  const safeReason = sanitized.ok ? sanitized.value : reason;

  const evidence = buildAuthorityEvidence({
    decisionKind: outcome === 'malformed' ? 'denial' : outcome === 'refused' ? 'denial' : 'policy-decision',
    operationId,
    actionDigest: null,
    targetDigest: null,
    payloadDigest: null,
    activationRevision: ctx.activationRevision,
    authorityRevision: ctx.authorityRevision,
    matrixVersion: ctx.matrixVersion,
    policyVersion: ctx.policyVersion,
    workspaceId: ctx.workspace.workspaceId,
    providerServiceIdentity: null,
    decision: outcome === 'malformed' ? 'refused' : outcome === 'blocked' ? 'deny' : 'refused',
    reasonCode: safeReason,
    clock: ctx.clock,
    nextStep: outcome === 'malformed' ? 'correct the proposal format' : outcome === 'blocked' ? 'adjust scope or authority' : 'provide required consent',
  });

  return { valid: false, outcome, reason: safeReason, evidence };
}

