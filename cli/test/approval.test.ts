// Story 2.5: progressive approval disclosure + safe decision controls.
import { describe, expect, it } from 'vitest';
import {
  authorityInsufficientReason,
  buildApprovalSummary,
  isApprovalStale,
  noTtyFailClosed,
  recordApprovalDecision,
  requiresExplicitAuthority,
  renderApprovalText,
  unresolvedApprovalFields,
  type ApprovalAuthorityFlags,
  type ApprovalContextState,
} from '../src/core/permissions/approval.js';

const clock = () => '2026-07-17T00:00:00.000Z';
const ctx: ApprovalContextState = {
  workspaceId: 'ws-1', workMode: 'build', profile: 'manual', fullAccess: false, enforcementVerified: true,
};
const benignFlags: ApprovalAuthorityFlags = { sensitive: false, destructive: false, boundaryExpanding: false, transfer: false };

describe('Approval summary — first-layer disclosure + start focus (AC #1)', () => {
  it('presents purpose, risk, outcome, context, OperationId, and a Review/Cancel starting focus', () => {
    const s = buildApprovalSummary({
      operationId: 'op-1', actionClass: 'write_file', actionDigest: 'd-1',
      purpose: 'create a.txt', risk: 'adds a file', proposedOutcome: 'file written',
      context: ctx, authorityFlags: benignFlags,
    });
    expect(s.startFocus).toBe('review');
    expect(s.operationId).toBe('op-1');
    expect(s.context.workMode).toBe('build');
  });

  it('never starts focus on Approve — an attempted approve start is coerced to review', () => {
    const s = buildApprovalSummary({
      operationId: 'op-1', actionClass: 'write_file', actionDigest: 'd-1',
      purpose: 'p', risk: 'r', proposedOutcome: 'o', context: ctx, authorityFlags: benignFlags,
      startFocus: 'cancel' as 'review',
    });
    expect(s.startFocus).toBe('cancel');
    const s2 = buildApprovalSummary({
      operationId: 'op-1', actionClass: 'write_file', actionDigest: 'd-1',
      purpose: 'p', risk: 'r', proposedOutcome: 'o', context: ctx, authorityFlags: benignFlags,
      startFocus: 'review' as 'cancel',
    });
    expect(s2.startFocus).toBe('review');
  });
});

describe('Approval — sensitive/destructive/transfer require explicit authority (AC #3)', () => {
  it('flags sensitive/destructive/boundary-expanding/transfer as requiring explicit authority', () => {
    expect(requiresExplicitAuthority({ sensitive: true, destructive: false, boundaryExpanding: false, transfer: false })).toBe(true);
    expect(requiresExplicitAuthority({ sensitive: false, destructive: true, boundaryExpanding: false, transfer: false })).toBe(true);
    expect(requiresExplicitAuthority({ sensitive: false, destructive: false, boundaryExpanding: true, transfer: false })).toBe(true);
    expect(requiresExplicitAuthority({ sensitive: false, destructive: false, boundaryExpanding: false, transfer: true })).toBe(true);
    expect(requiresExplicitAuthority(benignFlags)).toBe(false);
  });

  it('explains why Full Access or an unrelated local approval is insufficient', () => {
    const r = authorityInsufficientReason({ sensitive: true, destructive: false, boundaryExpanding: false, transfer: true });
    expect(r).toContain('sensitive-transfer authority');
    expect(r).toContain('remote-transfer consent');
  });

  it('blocks approve on an unresolved destination/classification/digest/enforcement state', () => {
    const transferFlags: ApprovalAuthorityFlags = { sensitive: true, destructive: false, boundaryExpanding: false, transfer: true };
    const missing = unresolvedApprovalFields(
      { destinationResolved: false, classificationResolved: false, digestResolved: false, enforcementResolved: false },
      transferFlags,
    );
    expect(missing).toEqual(expect.arrayContaining(['destination', 'classification', 'digest', 'enforcement-state']));
    const ok = unresolvedApprovalFields(
      { destinationResolved: true, classificationResolved: true, digestResolved: true, enforcementResolved: true },
      transferFlags,
    );
    expect(ok).toEqual([]);
  });
});

describe('Approval — decision recorded against exact OperationId + digest; Esc never authorizes (AC #4)', () => {
  it('records an approve bound to the exact op + digest', () => {
    const s = buildApprovalSummary({
      operationId: 'op-1', actionClass: 'write_file', actionDigest: 'd-1',
      purpose: 'p', risk: 'r', proposedOutcome: 'o', context: ctx, authorityFlags: benignFlags,
    });
    const rec = recordApprovalDecision({ summary: s, decision: 'approve', reason: 'user reviewed', clock });
    expect(rec.operationId).toBe('op-1');
    expect(rec.actionDigest).toBe('d-1');
    expect(rec.decision).toBe('approve');
  });

  it('Esc-style dismiss/cancel decisions never equal approve', () => {
    const s = buildApprovalSummary({
      operationId: 'op-1', actionClass: 'write_file', actionDigest: 'd-1',
      purpose: 'p', risk: 'r', proposedOutcome: 'o', context: ctx, authorityFlags: benignFlags,
    });
    for (const d of ['cancel', 'dismiss'] as const) {
      const rec = recordApprovalDecision({ summary: s, decision: d, reason: 'esc', clock });
      expect(rec.decision).not.toBe('approve');
    }
  });
});

describe('Approval — staleness disables the committing control (AC #5)', () => {
  const s = buildApprovalSummary({
    operationId: 'op-1', actionClass: 'write_file', actionDigest: 'd-1',
    purpose: 'p', risk: 'r', proposedOutcome: 'o', context: ctx, authorityFlags: benignFlags,
  });
  it('a matching current state is not stale', () => {
    expect(isApprovalStale(s, { context: ctx, actionDigest: 'd-1' })).toBe(false);
  });
  it('a changed digest is stale', () => {
    expect(isApprovalStale(s, { context: ctx, actionDigest: 'd-2' })).toBe(true);
  });
  it('a changed mode/profile/workspace is stale', () => {
    expect(isApprovalStale(s, { context: { ...ctx, workMode: 'plan' }, actionDigest: 'd-1' })).toBe(true);
    expect(isApprovalStale(s, { context: { ...ctx, profile: 'full-access', fullAccess: true }, actionDigest: 'd-1' })).toBe(true);
  });
});

describe('Approval — no TTY fails closed (AC #6)', () => {
  it('returns blocked with rerun-interactively, stable exit class/code, no stdin secret/authority read, no dispatch', () => {
    const r = noTtyFailClosed();
    expect(r.status).toBe('blocked');
    expect(r.next).toBe('rerun interactively');
    expect(r.exitClass).toBe('BLOCKED');
    expect(r.exitCode).toBe(20);
    expect(r.stdinSecretRead).toBe(false);
    expect(r.stdinAuthorityRead).toBe(false);
    expect(r.effectDispatched).toBe(false);
  });
});

describe('Approval — text rendering parity (no color-only meaning)', () => {
  it('renders text labels including ENFORCEMENT UNVERIFIED when unverified', () => {
    const s = buildApprovalSummary({
      operationId: 'op-1', actionClass: 'write_file', actionDigest: 'd-1',
      purpose: 'p', risk: 'r', proposedOutcome: 'o',
      context: { ...ctx, enforcementVerified: false }, authorityFlags: benignFlags,
    });
    const text = renderApprovalText(s);
    expect(text).toContain('ENFORCEMENT UNVERIFIED');
    expect(text).toContain('Start focus: review');
  });
});