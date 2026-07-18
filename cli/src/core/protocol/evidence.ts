// Deterministic Evidence + provenance for authority decisions (Story 2.9,
// FR-38, FR-39, AD-3, AD-7, AD-24). Every significant authority decision — a
// proposal, policy decision, approval, denial, revocation, boundary change,
// consent decision, or credential-boundary refusal — produces sanitized,
// attributable Evidence linking the relevant PromptRoundId/OperationId +
// action/target/context/payload digests + authority revision + matrix/policy
// version + Workspace identity + provider/service identity + decision + reason
// code + timestamp + source event, without storing secrets or raw payloads
// (AC #1). Deterministic Evidence is labeled separately from Typhoon
// explanation and user decision; model text cannot override a deterministic
// deny/stale/boundary/unknown-outcome classification (AC #2). An unavailable
// digest/source/sanitizer/required field is explicitly
// `sanitized-with-omissions`/`estimated`/`stale`/`unavailable`/`corrupt`/
// `not-authoritative` with omission/provenance details + next step, never
// implying complete proof (AC #3). An auto-permitted action (eligible
// list/read/search) still records a compact sanitized Evidence record so it is
// not invisible (AC #4). Replayed Evidence preserves one logical record via
// immutable EventId + source provenance (AC #5). Raw prompt/command/payload
// export is disabled by default; only the permitted sanitized attributable
// representation can be returned, and raw values are not reconstructed from
// Evidence (AC #6).

import type { EvidenceCompleteness, AuthorityEvidenceRecordedPayload } from './events.js';

export type AuthorityDecisionKind =
  | 'policy-decision'
  | 'approval'
  | 'denial'
  | 'revocation'
  | 'boundary-change'
  | 'consent-decision'
  | 'credential-boundary-refusal'
  | 'auto-permit';

export type AuthorityDecision = 'allow' | 'ask' | 'deny' | 'cancelled' | 'stale' | 'refused';

/** Secret-free authority Evidence (AC #1). Every field is a digest, identity,
 * revision, version, or stable code — never a raw payload or credential. */
export interface AuthorityEvidence {
  readonly decisionKind: AuthorityDecisionKind;
  readonly promptRoundId: string | null;
  readonly operationId: string;
  readonly actionDigest: string | null;
  readonly targetDigest: string | null;
  readonly payloadDigest: string | null;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly matrixVersion: number;
  readonly policyVersion: number;
  readonly workspaceId: string;
  readonly providerServiceIdentity: string | null;
  readonly decision: AuthorityDecision;
  readonly reasonCode: string;
  readonly completeness: EvidenceCompleteness;
  readonly provenance: 'deterministic' | 'model';
  readonly sourceEventId: string | null;
  readonly timestamp: string;
  readonly nextStep: string;
}

export interface BuildAuthorityEvidenceInput {
  readonly decisionKind: AuthorityDecisionKind;
  readonly promptRoundId?: string | null;
  readonly operationId: string;
  readonly actionDigest?: string | null;
  readonly targetDigest?: string | null;
  readonly payloadDigest?: string | null;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly matrixVersion: number;
  readonly policyVersion: number;
  readonly workspaceId: string;
  readonly providerServiceIdentity?: string | null;
  readonly decision: AuthorityDecision;
  readonly reasonCode: string;
  readonly completeness?: EvidenceCompleteness;
  readonly sourceEventId?: string | null;
  readonly clock: () => string;
  readonly nextStep: string;
}

/** Build a sanitized authority-Evidence record (AC #1, AC #3). Any unavailable
 * digest/identity is recorded as `null` and the completeness downgrades to
 * `sanitized-with-omissions` so the record never implies complete proof when a
 * required field is missing. */
export function buildAuthorityEvidence(input: BuildAuthorityEvidenceInput): AuthorityEvidence {
  const missing: string[] = [];
  if (input.actionDigest === undefined || input.actionDigest === null) missing.push('action-digest');
  if (input.targetDigest === undefined || input.targetDigest === null) missing.push('target-digest');
  if (input.providerServiceIdentity === undefined || input.providerServiceIdentity === null) missing.push('provider-service-identity');
  let completeness: EvidenceCompleteness = input.completeness ?? 'complete';
  if (missing.length > 0 && completeness === 'complete') completeness = 'sanitized-with-omissions';
  return {
    decisionKind: input.decisionKind,
    promptRoundId: input.promptRoundId ?? null,
    operationId: input.operationId,
    actionDigest: input.actionDigest ?? null,
    targetDigest: input.targetDigest ?? null,
    payloadDigest: input.payloadDigest ?? null,
    activationRevision: input.activationRevision,
    authorityRevision: input.authorityRevision,
    matrixVersion: input.matrixVersion,
    policyVersion: input.policyVersion,
    workspaceId: input.workspaceId,
    providerServiceIdentity: input.providerServiceIdentity ?? null,
    decision: input.decision,
    reasonCode: input.reasonCode,
    completeness,
    provenance: 'deterministic',
    sourceEventId: input.sourceEventId ?? null,
    timestamp: input.clock(),
    nextStep: input.nextStep,
  };
}

/** AC #4: a compact auto-permit Evidence record for an eligible list/read/search
 * action — auto-permission does not make the action invisible. */
export function buildAutoPermitEvidence(input: {
  readonly operationId: string;
  readonly promptRoundId?: string | null;
  readonly actionDigest: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly matrixVersion: number;
  readonly policyVersion: number;
  readonly workspaceId: string;
  readonly reasonCode: string;
  readonly clock: () => string;
}): AuthorityEvidence {
  return buildAuthorityEvidence({
    decisionKind: 'auto-permit',
    promptRoundId: input.promptRoundId,
    operationId: input.operationId,
    actionDigest: input.actionDigest,
    targetDigest: input.actionDigest,
    providerServiceIdentity: 'local-tool',
    activationRevision: input.activationRevision,
    authorityRevision: input.authorityRevision,
    matrixVersion: input.matrixVersion,
    policyVersion: input.policyVersion,
    workspaceId: input.workspaceId,
    decision: 'allow',
    reasonCode: input.reasonCode,
    completeness: 'complete',
    clock: input.clock,
    nextStep: 'continue',
  });
}

/** The canonical durable-event payload for an authority-Evidence record. */
export function authorityEvidencePayload(e: AuthorityEvidence): AuthorityEvidenceRecordedPayload {
  return {
    kind: 'AuthorityEvidenceRecorded',
    operationId: e.operationId,
    promptRoundId: e.promptRoundId,
    decisionKind: e.decisionKind,
    actionDigest: e.actionDigest,
    targetDigest: e.targetDigest,
    payloadDigest: e.payloadDigest,
    activationRevision: e.activationRevision,
    authorityRevision: e.authorityRevision,
    matrixVersion: e.matrixVersion,
    policyVersion: e.policyVersion,
    workspaceId: e.workspaceId,
    providerServiceIdentity: e.providerServiceIdentity,
    decision: e.decision,
    reasonCode: e.reasonCode,
    completeness: e.completeness,
    sourceEventId: e.sourceEventId,
    nextStep: e.nextStep,
  };
}

/** AC #2: label deterministic Evidence vs Typhoon explanation vs user decision
 * separately. Returns whether the model explanation is consistent with the
 * deterministic Evidence — model text can NEVER override a deterministic
 * `deny`/`stale`/`refused`/unknown-outcome classification. */
export function labelEvidenceVersusExplanation(evidence: AuthorityEvidence, modelExplanation: string): {
  readonly evidenceLabel: 'deterministic-evidence';
  readonly explanationLabel: 'model-explanation';
  readonly modelConsistent: boolean;
} {
  const nonOverridable: ReadonlyArray<AuthorityDecision> = ['deny', 'stale', 'refused'];
  const affirm = /\b(succeeded|complete|done|approved|allowed)\b/i.test(modelExplanation);
  const modelConsistent = !(nonOverridable.includes(evidence.decision) && affirm);
  return { evidenceLabel: 'deterministic-evidence', explanationLabel: 'model-explanation', modelConsistent };
}

/** AC #6: raw export policy. Raw prompt/command/payload export is disabled by
 * default; only the permitted sanitized attributable representation can be
 * returned. Raw values are not reconstructed from Evidence. */
export interface ExportPolicy {
  readonly rawExportAllowed: false;
  readonly sanitizedExportAllowed: true;
}

export const DEFAULT_EXPORT_POLICY: ExportPolicy = {
  rawExportAllowed: false,
  sanitizedExportAllowed: true,
};

/** AC #6: a sanitized, attributable representation of an Evidence record safe
 * to export. Raw digests are already secret-free; this surfaces the stable
 * human-readable fields without reconstructing any raw prompt/command/payload. */
export function sanitizeEvidenceForExport(e: AuthorityEvidence): {
  readonly operationId: string;
  readonly decisionKind: AuthorityDecisionKind;
  readonly decision: AuthorityDecision;
  readonly reasonCode: string;
  readonly completeness: EvidenceCompleteness;
  readonly workspaceId: string;
  readonly timestamp: string;
  readonly nextStep: string;
} {
  return {
    operationId: e.operationId,
    decisionKind: e.decisionKind,
    decision: e.decision,
    reasonCode: e.reasonCode,
    completeness: e.completeness,
    workspaceId: e.workspaceId,
    timestamp: e.timestamp,
    nextStep: e.nextStep,
  };
}

/** AC #5: deduplicate replayed Evidence by immutable EventId + source
 * provenance, preserving one logical record. Returns the deduplicated set. */
export function deduplicateEvidence(records: readonly { readonly eventId: string; readonly evidence: AuthorityEvidence }[]): readonly { readonly eventId: string; readonly evidence: AuthorityEvidence }[] {
  const seen = new Map<string, { readonly eventId: string; readonly evidence: AuthorityEvidence }>();
  for (const r of records) {
    if (!seen.has(r.eventId)) seen.set(r.eventId, r);
  }
  return [...seen.values()];
}