// Story 2.4: exact-proposal operation authorization + revocation (AD-13,
// AD-17, AD-18).
import { describe, expect, it } from 'vitest';
import {
  AuthorizationRegistry,
  computeProposalDigest,
  consumeAuthorization,
  createAuthorization,
  revalidateAuthorization,
  revokeAuthorization,
  revocationOutcome,
  type DispatchState,
  type ProposalBinding,
} from '../src/core/permissions/authorization.js';
import type { PepDecision } from '../src/core/permissions/pep.js';
import type { OperationId } from '../src/core/protocol/ids.js';

const clock = () => '2026-07-17T00:00:00.000Z';
const laterClock = () => '2026-07-17T01:00:00.000Z';

const allowDecision: PepDecision = {
  outcome: 'allow', reason: 'manual-approval', matrixVersion: 1, activationRevision: 1, actionClass: 'write_file',
};
const askDecision: PepDecision = {
  outcome: 'ask', reason: 'manual-mutation-asks', matrixVersion: 1, activationRevision: 1, actionClass: 'write_file',
};

const binding: ProposalBinding = { actionClass: 'write_file', target: '/ws/a.txt', payload: 'hello' };
const opId = 'op-1' as OperationId;

function makeAuth(overrides: Partial<Parameters<typeof createAuthorization>[0]> = {}) {
  return createAuthorization({
    operationId: opId,
    binding,
    decision: allowDecision,
    activationId: 'act-1',
    activationRevision: 1,
    authorityRevision: 1,
    approvingInteraction: 'int-1',
    clock,
    ...overrides,
  });
}

describe('Authorization — binds to the exact proposal (AC #1)', () => {
  it('records OperationId, every applicable digest, activation/authority revision, policy decision, matrix version, creation time, expiry, one-shot state, and approving interaction', () => {
    const auth = makeAuth({ expiresAt: '2026-07-17T02:00:00.000Z' });
    expect(auth.operationId).toBe(opId);
    expect(auth.actionDigest).toBe(computeProposalDigest(binding));
    expect(auth.targetDigest).not.toBeNull();
    expect(auth.payloadDigest).not.toBeNull();
    expect(auth.activationId).toBe('act-1');
    expect(auth.activationRevision).toBe(1);
    expect(auth.authorityRevision).toBe(1);
    expect(auth.policyOutcome).toBe('allow');
    expect(auth.policyReason).toBe('manual-approval');
    expect(auth.matrixVersion).toBe(1);
    expect(auth.createdAt).toBe(clock());
    expect(auth.expiresAt).toBe('2026-07-17T02:00:00.000Z');
    expect(auth.consumed).toBe(false);
    expect(auth.revoked).toBe(false);
    expect(auth.approvingInteraction).toBe('int-1');
  });

  it('digests are deterministic — the same binding yields the same digest', () => {
    expect(computeProposalDigest(binding)).toBe(computeProposalDigest(binding));
    const different: ProposalBinding = { actionClass: 'write_file', target: '/ws/b.txt', payload: 'hello' };
    expect(computeProposalDigest(different)).not.toBe(computeProposalDigest(binding));
  });
});

describe('Authorization — rejects stale/mismatched proposals (AC #2)', () => {
  const baseOpts = { activationId: 'act-1', activationRevision: 1, authorityRevision: 1, now: clock() };

  it('accepts the exact same proposal + activation', () => {
    const auth = makeAuth();
    expect(revalidateAuthorization(auth, { binding, ...baseOpts })).toEqual({ ok: true });
  });

  it('rejects a rewritten target as target-mismatch', () => {
    const auth = makeAuth();
    const res = revalidateAuthorization(auth, { binding: { ...binding, target: '/ws/other.txt' }, ...baseOpts });
    expect(res.ok).toBe(false);
    expect(res.cause).toBe('target-mismatch');
  });

  it('rejects a rewritten payload as payload-mismatch', () => {
    const auth = makeAuth();
    const res = revalidateAuthorization(auth, { binding: { ...binding, payload: 'evil' }, ...baseOpts });
    expect(res.ok).toBe(false);
    expect(res.cause).toBe('payload-mismatch');
  });

  it('rejects a changed destination as destination-mismatch', () => {
    const auth = makeAuth({ binding: { actionClass: 'transfer', destination: 'https://a.example.com', classification: 'public' } });
    const res = revalidateAuthorization(auth, {
      binding: { actionClass: 'transfer', destination: 'https://b.example.com', classification: 'public' },
      ...baseOpts,
    });
    expect(res.cause).toBe('destination-mismatch');
  });

  it('rejects a changed activationId as activation-changed (prior activation authority is stale)', () => {
    const auth = makeAuth();
    const res = revalidateAuthorization(auth, { binding, activationId: 'act-2', activationRevision: 1, authorityRevision: 1, now: clock() });
    expect(res.cause).toBe('activation-changed');
  });

  it('rejects a changed authority/activation revision as authority-revision-changed', () => {
    const auth = makeAuth();
    expect(revalidateAuthorization(auth, { binding, activationId: 'act-1', activationRevision: 2, authorityRevision: 1, now: clock() }).cause)
      .toBe('authority-revision-changed');
    expect(revalidateAuthorization(auth, { binding, activationId: 'act-1', activationRevision: 1, authorityRevision: 2, now: clock() }).cause)
      .toBe('authority-revision-changed');
  });
});

describe('Authorization — one-shot consumption + revocation before commit (AC #3)', () => {
  it('consume marks the authorization consumed and refuses double consumption', () => {
    const auth = makeAuth();
    const first = consumeAuthorization(auth);
    expect(first.ok).toBe(true);
    expect(first.authorization!.consumed).toBe(true);
    const second = consumeAuthorization(first.authorization!);
    expect(second.ok).toBe(false);
    expect(second.cause).toBe('already-consumed');
  });

  it('a revoked authorization cannot be consumed', () => {
    const auth = revokeAuthorization(makeAuth(), 'user-denied');
    expect(auth.revoked).toBe(true);
    expect(consumeAuthorization(auth).cause).toBe('revoked');
  });

  it('an ask decision never authorizes an effect even with matching digests', () => {
    const auth = makeAuth({ decision: askDecision });
    expect(consumeAuthorization(auth).cause).toBe('not-allow');
    expect(revalidateAuthorization(auth, { binding, activationId: 'act-1', activationRevision: 1, authorityRevision: 1, now: clock() }).cause)
      .toBe('policy-outcome-not-allow');
  });
});

describe('Authorization — honest revocation outcome after dispatch commit (AC #4)', () => {
  const cases: Array<[DispatchState, 'cancelled' | 'failed' | 'succeeded' | 'unknown-outcome' | 'still-running']> = [
    [{ state: 'before-commit' }, 'cancelled'],
    [{ state: 'dispatch-committed', terminal: 'still-running' }, 'still-running'],
    [{ state: 'dispatch-committed', terminal: 'succeeded' }, 'succeeded'],
    [{ state: 'dispatch-committed', terminal: 'failed' }, 'failed'],
    [{ state: 'dispatch-committed', terminal: 'none' }, 'unknown-outcome'],
    [{ state: 'dispatch-committed', terminal: 'unknown-outcome' }, 'unknown-outcome'],
  ];
  for (const [dispatch, expected] of cases) {
    it(`${dispatch.state}${dispatch.state === 'dispatch-committed' ? `/${dispatch.terminal}` : ''} → ${expected}`, () => {
      expect(revocationOutcome(dispatch)).toBe(expected);
    });
  }

  it('after commit, revocation never claims cancelled without proof', () => {
    expect(revocationOutcome({ state: 'dispatch-committed', terminal: 'none' })).not.toBe('cancelled');
  });
});

describe('AuthorizationRegistry — EventId + identity dedup (AC #5)', () => {
  it('replays of the same approval event do not mint a second consumable authorization', () => {
    const reg = new AuthorizationRegistry();
    const auth = makeAuth();
    const first = reg.applyApprovalEvent('evt-1', auth);
    expect(first.deduplicated).toBe(false);
    const replay = reg.applyApprovalEvent('evt-1', auth);
    expect(replay.deduplicated).toBe(true);
    expect(replay.record).toBe(first.record);
  });

  it('a duplicate approval for the same exact proposal identity is deduplicated', () => {
    const reg = new AuthorizationRegistry();
    const a1 = makeAuth();
    const a2 = makeAuth({ approvingInteraction: 'int-2' }); // same (opId, actionDigest)
    reg.grant(a1);
    const res = reg.grant(a2);
    expect(res.deduplicated).toBe(true);
    expect(res.record.authorizationId).toBe(a1.authorizationId);
  });

  it('findByIdentity returns the exact-proposal authorization', () => {
    const reg = new AuthorizationRegistry();
    const auth = makeAuth();
    reg.grant(auth);
    expect(reg.findByIdentity(opId, auth.actionDigest)?.authorizationId).toBe(auth.authorizationId);
  });
});

describe('Authorization — expiry revalidation before dispatch (AC #6)', () => {
  it('refuses an expired authorization and does not treat it as Full Access or consent', () => {
    const auth = makeAuth({ expiresAt: '2026-07-17T00:30:00.000Z' });
    const res = revalidateAuthorization(auth, {
      binding, activationId: 'act-1', activationRevision: 1, authorityRevision: 1, now: laterClock(),
    });
    expect(res.ok).toBe(false);
    expect(res.cause).toBe('expired');
  });

  it('a non-expired authorization with future expiry revalidates fine', () => {
    const auth = makeAuth({ expiresAt: '2026-07-17T23:59:59.000Z' });
    expect(revalidateAuthorization(auth, { binding, activationId: 'act-1', activationRevision: 1, authorityRevision: 1, now: clock() }).ok).toBe(true);
  });
});