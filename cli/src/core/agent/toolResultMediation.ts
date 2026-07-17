// Tool result mediation for the Agent Loop (Story 3.9, AD-4, AD-7, AD-14, AD-24).
//
// AC #3: a validated local tool operation returns -> the result is source-labelled,
// instruction-inert (AD-7), sanitized, bounded, and durably recorded in
// activity/Evidence BEFORE it is offered as context for another proposal;
// remote/tool output CANNOT change policy, permissions, boundaries, registry
// authority, or task scope.
//
// AC #4: a subsequent bounded step proposal -> undergoes a NEW local schema +
// policy validation with its OWN operation identity; a prior tool result or
// approval is NOT treated as authority for a changed action.
//
// Pure, injectable: accepts all dependencies as parameters so it stays
// unit-testable without fs/network/journal.

import type { Sanitizer } from '../security/sanitizer.js';
import { buildAuthorityEvidence } from '../protocol/evidence.js';
import type { MediatedToolResult, MediationContext, ToolResultToMediate } from './types.js';

// --- Injectable dependency ports ---

export interface MediationDeps {
  readonly sanitizer: Sanitizer;
}

// --- Mediation ---

/**
 * Mediate a tool result before it is offered as context for another proposal
 * (AC #3). The result is:
 * - source-labelled (which tool produced it)
 * - instruction-inert (AD-7 — type-level marker)
 * - sanitized (AD-24 — secrets redacted)
 * - bounded (size-limited)
 * - durably recorded in Evidence
 *
 * Remote/tool output CANNOT change policy, permissions, boundaries, registry
 * authority, or task scope (AC #3). The mediated result is a data record, not
 * an instruction channel.
 */
export function mediateToolResult(
  result: ToolResultToMediate,
  ctx: MediationContext,
  deps: MediationDeps,
): MediatedToolResult {
  // 1. Sanitize the output (AD-24).
  const sanitized = deps.sanitizer.sanitize(result.output, 'tool-output');
  const safeOutput = sanitized.ok ? sanitized.value : '[tool output fully redacted]';

  // 2. Bound the output size.
  const bounded = safeOutput.length <= ctx.maxResultBytes;
  const boundedOutput = bounded ? safeOutput : safeOutput.slice(0, ctx.maxResultBytes);

  // 3. Build deterministic Evidence (AD-3, AD-24). No raw payloads.
  const evidence = buildAuthorityEvidence({
    decisionKind: 'auto-permit',
    operationId: result.operationId,
    actionDigest: null,
    targetDigest: null,
    payloadDigest: null,
    activationRevision: ctx.activationRevision,
    authorityRevision: ctx.authorityRevision,
    matrixVersion: ctx.matrixVersion,
    policyVersion: ctx.policyVersion,
    workspaceId: ctx.workspace.workspaceId,
    providerServiceIdentity: `local-tool:${result.toolName}`,
    decision: result.ok ? 'allow' : 'deny',
    reasonCode: result.ok ? 'tool-execution-succeeded' : 'tool-execution-failed',
    clock: ctx.clock,
    nextStep: 'continue',
  });

  return {
    source: result.toolName,
    sanitizedOutput: boundedOutput,
    bounded,
    evidence,
    instructionInert: true as const,
  };
}
