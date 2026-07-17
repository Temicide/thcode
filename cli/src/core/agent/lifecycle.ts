// Agent Loop lifecycle handling (Story 3.9, AD-3, AD-4, AD-7, AD-14, AD-24).
//
// AC #5: the loop has no valid next proposal or receives an invalid terminal
// response -> STOPS with a durable typed result; does NOT invent a final answer,
// silently repair the proposal, or dispatch an unvalidated effect.
//
// Pure, injectable: accepts all dependencies as parameters so it stays
// unit-testable without fs/network/journal.

import type { Sanitizer } from '../security/sanitizer.js';
import { buildAuthorityEvidence } from '../protocol/evidence.js';
import { newOperationId } from '../protocol/ids.js';
import type { LoopTerminal, LifecycleContext } from './types.js';

// --- Injectable dependency ports ---

export interface LifecycleDeps {
  readonly sanitizer: Sanitizer;
}

// --- Lifecycle step ---

/**
 * Handle a lifecycle step for the Agent Loop (AC #5).
 *
 * When the loop has no valid next proposal or receives an invalid terminal
 * response, this function produces a durable typed result that STOPS the loop.
 * It does NOT invent a final answer, silently repair the proposal, or dispatch
 * an unvalidated effect.
 *
 * @param hasValidNext - whether there is a valid next proposal to process
 * @param terminalResponse - optional terminal response from the provider (e.g.
 *   final text, or an invalid/empty response)
 * @param ctx - lifecycle context (workspace, authority, clock)
 * @param deps - injectable dependencies
 * @returns a LoopTerminal that stops the loop with a durable typed result
 */
export function handleLifecycleStep(
  hasValidNext: boolean,
  terminalResponse: string | null,
  ctx: LifecycleContext,
  deps: LifecycleDeps,
): LoopTerminal {
  const operationId = newOperationId();

  // No valid next proposal -> stop.
  if (!hasValidNext) {
    const evidence = buildAuthorityEvidence({
      decisionKind: 'policy-decision',
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
      decision: 'stale',
      reasonCode: 'no-valid-next-proposal',
      clock: ctx.clock,
      nextStep: 'provide a new prompt or adjust scope',
    });

    return {
      kind: 'no-valid-proposal',
      reason: 'No valid next proposal available. The loop has exhausted all valid proposals.',
      evidence,
      durable: true as const,
    };
  }

  // Invalid terminal response -> stop. An invalid terminal response is one
  // that is empty, contains only whitespace, or is otherwise not a valid
  // terminal outcome.
  if (terminalResponse === null || terminalResponse.trim().length === 0) {
    const sanitized = deps.sanitizer.sanitize('invalid-terminal-response', 'error-message');
    const safeReason = sanitized.ok ? sanitized.value : 'invalid-terminal-response';

    const evidence = buildAuthorityEvidence({
      decisionKind: 'policy-decision',
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
      decision: 'refused',
      reasonCode: safeReason,
      clock: ctx.clock,
      nextStep: 'provide a valid prompt',
    });

    return {
      kind: 'invalid-terminal-response',
      reason: 'Invalid terminal response received. The provider returned an empty or malformed response.',
      evidence,
      durable: true as const,
    };
  }

  // Valid terminal response -> completed (normal termination).
  const evidence = buildAuthorityEvidence({
    decisionKind: 'policy-decision',
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
    decision: 'allow',
    reasonCode: 'loop-completed',
    clock: ctx.clock,
    nextStep: 'continue',
  });

  return {
    kind: 'completed',
    reason: 'Loop completed normally.',
    evidence,
    durable: true as const,
  };
}
