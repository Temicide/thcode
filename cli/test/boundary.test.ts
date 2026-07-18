// Story 2.3: Workspace identity and non-overridable hard boundaries.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BoundaryExpansionRegistry,
  checkHardBoundary,
  ENFORCEMENT_UNVERIFIED,
  revalidateBoundary,
  workspaceIdentity,
} from '../src/core/permissions/boundary.js';

const WS = path.resolve('/tmp/thcode-ws-fixture');

const fixedClock = (() => {
  let n = 0;
  const base = Date.parse('2026-07-17T09:00:00.000Z');
  return () => new Date(base + n++ * 1000).toISOString();
})();

describe('Workspace identity (AC #1)', () => {
  it('is stable/deterministic for the same resolved root', () => {
    const a = workspaceIdentity(WS);
    const b = workspaceIdentity(WS);
    expect(a.workspaceId).toBe(b.workspaceId);
    expect(a.workspaceId).toBeTruthy();
  });

  it('differs for a different root', () => {
    const a = workspaceIdentity(WS);
    const b = workspaceIdentity(path.resolve('/tmp/thcode-ws-other'));
    expect(a.workspaceId).not.toBe(b.workspaceId);
  });
});

describe('checkHardBoundary — non-overridable denials (AC #2)', () => {
  it('denies a path that escapes the Workspace, independent of any profile parameter (there is none)', () => {
    const d = checkHardBoundary({ workspaceRoot: WS, candidatePath: '../outside.txt' });
    expect(d.outcome).toBe('deny');
    expect(d.reason).toBe('workspace-escape');
  });

  it('denies a host-threatening command class', () => {
    const d = checkHardBoundary({ workspaceRoot: WS, commandClass: 'host-threatening' });
    expect(d.outcome).toBe('deny');
    expect(d.reason).toBe('host-threatening-command');
  });

  it('denies an unallowlisted network/service destination', () => {
    const d = checkHardBoundary({
      workspaceRoot: WS,
      networkDestination: 'https://evil.example.com',
      allowlistedNetworkDestinations: ['https://api.opentyphoon.ai'],
    });
    expect(d.outcome).toBe('deny');
    expect(d.reason).toBe('unallowlisted-network-destination');
  });

  it('allows an allowlisted network destination', () => {
    const d = checkHardBoundary({
      workspaceRoot: WS,
      networkDestination: 'https://api.opentyphoon.ai',
      allowlistedNetworkDestinations: ['https://api.opentyphoon.ai'],
    });
    expect(d.outcome).toBe('allow');
  });

  it('denies with the canonical ENFORCEMENT UNVERIFIED token when enforcement is unavailable', () => {
    const d = checkHardBoundary({ workspaceRoot: WS, candidatePath: 'src/index.ts', enforcementAvailable: false });
    expect(d.outcome).toBe('deny');
    expect(d.reason).toBe(ENFORCEMENT_UNVERIFIED);
  });

  it('denies an exceeded quota', () => {
    const d = checkHardBoundary({ workspaceRoot: WS, candidatePath: 'src/index.ts', quotaExceeded: true });
    expect(d.outcome).toBe('deny');
    expect(d.reason).toBe('quota-exceeded');
  });

  it('denies the wrong credential group', () => {
    const d = checkHardBoundary({
      workspaceRoot: WS,
      candidatePath: 'src/index.ts',
      credentialGroup: 'ai-for-thai',
      expectedCredentialGroup: 'typhoon',
    });
    expect(d.outcome).toBe('deny');
    expect(d.reason).toBe('wrong-credential-group');
  });

  it('allows a safe in-workspace path with no other boundary hit, and binds a resourceIdentity', () => {
    const d = checkHardBoundary({ workspaceRoot: WS, candidatePath: 'src/index.ts' });
    expect(d.outcome).toBe('allow');
    expect(d.resourceIdentity).toBe(path.resolve(WS, 'src/index.ts'));
  });
});

describe('Effect-time revalidation (AC #3)', () => {
  it('is stale when the resource identity changes after evaluation', () => {
    const original = { resourceIdentity: 'a', workspaceId: 'ws-1', enforcementAvailable: true };
    const current = { resourceIdentity: 'b', workspaceId: 'ws-1', enforcementAvailable: true };
    const r = revalidateBoundary(original, current);
    expect(r.stale).toBe(true);
    expect(r.reason).toBe('resource-identity-changed');
  });

  it('is stale when the workspace identity changes', () => {
    const original = { resourceIdentity: 'a', workspaceId: 'ws-1' };
    const current = { resourceIdentity: 'a', workspaceId: 'ws-2' };
    expect(revalidateBoundary(original, current).reason).toBe('workspace-identity-changed');
  });

  it('is stale when enforcement state changes', () => {
    const original = { resourceIdentity: 'a', workspaceId: 'ws-1', enforcementAvailable: true };
    const current = { resourceIdentity: 'a', workspaceId: 'ws-1', enforcementAvailable: false };
    expect(revalidateBoundary(original, current).reason).toBe('enforcement-state-changed');
  });

  it('is not stale when nothing relevant changed', () => {
    const snap = { resourceIdentity: 'a', workspaceId: 'ws-1', enforcementAvailable: true };
    expect(revalidateBoundary(snap, { ...snap }).stale).toBe(false);
  });
});

describe('BoundaryExpansionRegistry — durable, scoped, revocable (AC #4, #5)', () => {
  it('grants a separately-scoped expansion, distinct from approval/transfer consent', () => {
    const reg = new BoundaryExpansionRegistry(fixedClock);
    const e = reg.grant({
      resourceIdentity: path.resolve(WS, 'build'),
      workspaceId: 'ws-1',
      actionClasses: ['write_file'],
      reason: 'long-running build output directory',
    });
    expect(e.expansionId).toBeTruthy();
    expect(e.revoked).toBe(false);
    expect(reg.get(e.expansionId)).toEqual(e);
  });

  it('is auditable via list()', () => {
    const reg = new BoundaryExpansionRegistry(fixedClock);
    reg.grant({ resourceIdentity: 'r1', workspaceId: 'ws-1', actionClasses: ['read_file'], reason: 'x' });
    reg.grant({ resourceIdentity: 'r2', workspaceId: 'ws-1', actionClasses: ['read_file'], reason: 'y' });
    expect(reg.list()).toHaveLength(2);
  });

  it('revocation prevents future authorization and is permanent', () => {
    const reg = new BoundaryExpansionRegistry(fixedClock);
    const e = reg.grant({ resourceIdentity: 'r1', workspaceId: 'ws-1', actionClasses: ['write_file'], reason: 'x' });
    expect(reg.isActive(e.expansionId, 'write_file', fixedClock())).toBe(true);
    const revoked = reg.revoke(e.expansionId, 'no longer needed');
    expect(revoked).toBe(true);
    expect(reg.get(e.expansionId)?.revoked).toBe(true);
    expect(reg.isActive(e.expansionId, 'write_file', fixedClock())).toBe(false);
    // Revoking again is a no-op, not an error, and does not un-revoke.
    expect(reg.revoke(e.expansionId, 'again')).toBe(false);
  });

  it('an expired expansion fails closed to inactive', () => {
    const reg = new BoundaryExpansionRegistry(fixedClock);
    const e = reg.grant({
      resourceIdentity: 'r1',
      workspaceId: 'ws-1',
      actionClasses: ['write_file'],
      reason: 'x',
      expiresAt: '2026-07-17T09:00:01.000Z',
    });
    expect(reg.isActive(e.expansionId, 'write_file', '2026-07-17T09:00:05.000Z')).toBe(false);
  });

  it('an unknown expansion id fails closed to inactive', () => {
    const reg = new BoundaryExpansionRegistry(fixedClock);
    expect(reg.isActive('does-not-exist', 'write_file', fixedClock())).toBe(false);
  });

  it('does not authorize an action class outside its granted scope', () => {
    const reg = new BoundaryExpansionRegistry(fixedClock);
    const e = reg.grant({ resourceIdentity: 'r1', workspaceId: 'ws-1', actionClasses: ['read_file'], reason: 'x' });
    expect(reg.isActive(e.expansionId, 'delete', fixedClock())).toBe(false);
  });
});

describe('Unresolved enforcement/budget tokens (AC #6)', () => {
  it('ENFORCEMENT UNVERIFIED is the exact canonical token', () => {
    expect(ENFORCEMENT_UNVERIFIED).toBe('ENFORCEMENT UNVERIFIED');
  });
});
