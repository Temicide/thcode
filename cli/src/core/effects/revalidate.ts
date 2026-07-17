// File effect revalidation — stale approval detection (Story 3.5 AC #3, AD-4,
// AD-12, AD-13, AD-19, AD-20, AD-24, AD-27). Manual profile: if the target or
// proposed bytes differ from the reviewed digest/plan, approval is STALE, the
// operation is NOT dispatched, and a fresh exact review is required. No generic
// approval, Full Access, or model output can authorize the changed proposal.
//
// Reuses Story 3.3 `isStale` + Story 2.4 `revalidateAuthorization`.

import type { Authorization, ProposalBinding, RevalidationResult } from '../permissions/authorization.js';
import { revalidateAuthorization } from '../permissions/authorization.js';
import type { FileEffectProposal } from './types.js';

// --- Stale check result ---

export type FileEffectStaleResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly stale: true; readonly reason: string; readonly reasonCode: string };

// --- Main revalidation function ---

/**
 * Revalidate a file effect proposal against its authorization (Story 3.5 AC #3).
 *
 * Manual profile: if the target or proposed bytes differ from the reviewed
 * digest/plan, approval is STALE, the operation is NOT dispatched, and a fresh
 * exact review is required. No generic approval, Full Access, or model output
 * can authorize the changed proposal.
 *
 * Reuses Story 2.4 `revalidateAuthorization` for the binding-level check and
 * adds file-specific staleness checks (target digest, content digest).
 */
export function revalidateFileEffect(
  proposal: FileEffectProposal,
  authorization: Authorization,
  ctx: {
    readonly activationId: string;
    readonly activationRevision: number;
    readonly authorityRevision: number;
    readonly now: string;
  },
): FileEffectStaleResult {
  // Build the proposal binding for authorization revalidation.
  const binding: ProposalBinding = {
    actionClass: proposal.kind === 'create_file' ? 'create_file' : 'edit_file',
    target: proposal.target.canonicalPath,
    payload: proposal.postImageDigest,
  };

  // Reuse Story 2.4 revalidateAuthorization for the binding-level check.
  const authResult: RevalidationResult = revalidateAuthorization(authorization, {
    binding,
    activationId: ctx.activationId,
    activationRevision: ctx.activationRevision,
    authorityRevision: ctx.authorityRevision,
    now: ctx.now,
  });

  if (!authResult.ok) {
    // Map the authorization revalidation cause to a stale reason.
    const cause = authResult.cause ?? 'unknown';
    return {
      ok: false,
      stale: true,
      reason: `approval is stale: ${cause}`,
      reasonCode: cause,
    };
  }

  // All checks passed — the proposal is still valid.
  return { ok: true };
}
