// Story 2.9: deterministic Evidence + provenance for authority decisions.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXPORT_POLICY,
  authorityEvidencePayload,
  buildAutoPermitEvidence,
  buildAuthorityEvidence,
  deduplicateEvidence,
  labelEvidenceVersusExplanation,
  sanitizeEvidenceForExport,
  type AuthorityDecisionKind,
} from '../src/core/protocol/evidence.js';

const clock = () => '2026-07-17T00:00:00.000Z';
const base = {
  operationId: 'op-1', activationRevision: 1, authorityRevision: 1, matrixVersion: 1, policyVersion: 1, workspaceId: 'ws-1', clock,
};

describe('AuthorityEvidence — links every required field without secrets (AC #1)', () => {
  it('records decisionKind, ids, digests, revisions, versions, workspace, provider identity, decision, reason, timestamp, source event', () => {
    const e = buildAuthorityEvidence({
      ...base, decisionKind: 'approval', actionDigest: 'd-1', targetDigest: 't-1', payloadDigest: 'p-1',
      providerServiceIdentity: 'typhoon', decision: 'allow', reasonCode: 'user-approved', sourceEventId: 'evt-1', nextStep: 'dispatch',
    });
    expect(e.operationId).toBe('op-1');
    expect(e.actionDigest).toBe('d-1');
    expect(e.matrixVersion).toBe(1);
    expect(e.workspaceId).toBe('ws-1');
    expect(e.providerServiceIdentity).toBe('typhoon');
    expect(e.sourceEventId).toBe('evt-1');
    expect(e.completeness).toBe('complete');
    expect(JSON.stringify(e)).not.toContain('secret');
  });

  it('every authority decision kind produces a record', () => {
    const kinds: AuthorityDecisionKind[] = ['policy-decision', 'approval', 'denial', 'revocation', 'boundary-change', 'consent-decision', 'credential-boundary-refusal', 'auto-permit'];
    for (const k of kinds) {
      const e = buildAuthorityEvidence({ ...base, decisionKind: k, decision: 'deny', reasonCode: 'r', nextStep: 'n' });
      expect(e.decisionKind).toBe(k);
    }
  });
});

describe('AuthorityEvidence — deterministic vs model explanation (AC #2)', () => {
  it('labels deterministic evidence and model explanation separately', () => {
    const e = buildAuthorityEvidence({ ...base, decisionKind: 'denial', decision: 'deny', reasonCode: 'policy-deny', nextStep: 'change inputs' });
    const lab = labelEvidenceVersusExplanation(e, 'I think it succeeded');
    expect(lab.evidenceLabel).toBe('deterministic-evidence');
    expect(lab.explanationLabel).toBe('model-explanation');
    expect(lab.modelConsistent).toBe(false);
  });
  it('model text cannot override a deterministic deny', () => {
    const e = buildAuthorityEvidence({ ...base, decisionKind: 'denial', decision: 'deny', reasonCode: 'policy-deny', nextStep: 'n' });
    expect(labelEvidenceVersusExplanation(e, 'the action was allowed and succeeded').modelConsistent).toBe(false);
  });
  it('a consistent explanation reports modelConsistent true', () => {
    const e = buildAuthorityEvidence({ ...base, decisionKind: 'approval', decision: 'allow', reasonCode: 'approved', nextStep: 'n' });
    expect(labelEvidenceVersusExplanation(e, 'the action was allowed').modelConsistent).toBe(true);
  });
});

describe('AuthorityEvidence — unavailable fields downgrade completeness (AC #3)', () => {
  it('a missing action digest downgrades to sanitized-with-omissions and records the gap', () => {
    const e = buildAuthorityEvidence({ ...base, decisionKind: 'policy-decision', decision: 'deny', reasonCode: 'r', nextStep: 'n' });
    expect(e.actionDigest).toBe(null);
    expect(e.completeness).toBe('sanitized-with-omissions');
  });
  it('an explicitly stale/corrupt completeness is preserved', () => {
    const e = buildAuthorityEvidence({ ...base, decisionKind: 'policy-decision', decision: 'deny', reasonCode: 'r', completeness: 'stale', actionDigest: 'd', nextStep: 'n' });
    expect(e.completeness).toBe('stale');
  });
});

describe('AuthorityEvidence — auto-permit is not invisible (AC #4)', () => {
  it('records a compact sanitized Evidence record for an eligible read/list/search auto-permit', () => {
    const e = buildAutoPermitEvidence({ operationId: 'op-2', actionDigest: 'd-read', activationRevision: 1, authorityRevision: 1, matrixVersion: 1, policyVersion: 1, workspaceId: 'ws-1', reasonCode: 'assisted-read-allow', clock });
    expect(e.decisionKind).toBe('auto-permit');
    expect(e.decision).toBe('allow');
    expect(e.completeness).toBe('complete');
  });
});

describe('AuthorityEvidence — replay dedup by EventId (AC #5)', () => {
  it('a replayed Evidence event preserves one logical record', () => {
    const e = buildAuthorityEvidence({ ...base, decisionKind: 'approval', decision: 'allow', reasonCode: 'r', actionDigest: 'd', nextStep: 'n' });
    const records = [
      { eventId: 'evt-1', evidence: e },
      { eventId: 'evt-1', evidence: e },
      { eventId: 'evt-2', evidence: e },
    ];
    expect(deduplicateEvidence(records).length).toBe(2);
  });
  it('the durable payload is secret-free and attributable', () => {
    const e = buildAuthorityEvidence({ ...base, decisionKind: 'policy-decision', decision: 'deny', reasonCode: 'r', actionDigest: 'd', nextStep: 'n' });
    const p = authorityEvidencePayload(e);
    expect(p.kind).toBe('AuthorityEvidenceRecorded');
    expect(JSON.stringify(p)).not.toContain('secret');
  });
});

describe('AuthorityEvidence — raw export disabled by default (AC #6)', () => {
  it('DEFAULT_EXPORT_POLICY disallows raw export and allows sanitized export', () => {
    expect(DEFAULT_EXPORT_POLICY.rawExportAllowed).toBe(false);
    expect(DEFAULT_EXPORT_POLICY.sanitizedExportAllowed).toBe(true);
  });
  it('sanitizeEvidenceForExport returns an attributable representation without reconstructing raw values', () => {
    const e = buildAuthorityEvidence({ ...base, decisionKind: 'approval', decision: 'allow', reasonCode: 'r', actionDigest: 'd', nextStep: 'n' });
    const s = sanitizeEvidenceForExport(e);
    expect(s.operationId).toBe('op-1');
    expect(s).not.toHaveProperty('actionDigest');
    expect(s).not.toHaveProperty('payloadDigest');
  });
});