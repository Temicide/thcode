// Epic 2 integration: CoreApp wiring for RuntimeActivation, the PEP, and
// hard boundaries/Boundary Expansions, proving durable journaling end to end.
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CoreApp } from '../src/core/app.js';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';
import { SessionRepository } from '../src/core/sessions/repository.js';
import { SessionStore } from '../src/core/sessions/store.js';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'thcode-authority-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const fixedClock = (() => {
  let n = 0;
  const base = Date.parse('2026-07-17T09:00:00.000Z');
  return () => new Date(base + n++ * 1000).toISOString();
})();

function makeRepo(file: string): { repo: SessionRepository; store: SessionStore } {
  const creds = new InMemoryCredentialStore();
  const result = SessionStore.openSync(creds, path.join(tmp, file));
  if (!result.ok) throw new Error(`open failed: ${result.cause}`);
  return { repo: new SessionRepository(result.store, fixedClock), store: result.store };
}

describe('CoreApp — Runtime Activation established on construction (Story 2.1 AC #1)', () => {
  it('journals RuntimeActivationEstablished before any approval can be requested', () => {
    const { repo, store } = makeRepo('a1.db');
    const core = new CoreApp({
      credentials: new InMemoryCredentialStore(),
      workspaceRoot: '/tmp/authority-ws',
      repo,
      clock: fixedClock,
    });
    const authority = core.authorityProjection();
    const sessionId = `sess-${core.providers.selectedId}`;
    const events = repo.queryEvents(sessionId as never, 0);
    expect(events.map((e) => e.payload.kind)).toContain('RuntimeActivationEstablished');
    const established = events.find((e) => e.payload.kind === 'RuntimeActivationEstablished');
    expect((established?.payload as { activationId: string }).activationId).toBe(authority.activationId);
    store.close();
  });

  it('the fresh authority projection has independently addressable fields (AC #2)', () => {
    const core = new CoreApp({ credentials: new InMemoryCredentialStore(), workspaceRoot: '/tmp/authority-ws' });
    const a = core.authorityProjection();
    expect(a.workMode).toBe('build');
    expect(a.permissionProfile).toBe('manual');
    expect(a.fullAccess).toBe(false);
    expect(a.workspaceId).toBeTruthy();
    expect(a.activationId).toBeTruthy();
    expect(a.activationRevision).toBeGreaterThan(0);
  });
});

describe('CoreApp — mode/profile mutation journals AuthorityChanged (Story 2.1 AC #3, #4)', () => {
  it('setMode only changes mode and journals AuthorityChanged with the new revision', () => {
    const { repo, store } = makeRepo('a2.db');
    const core = new CoreApp({
      credentials: new InMemoryCredentialStore(),
      workspaceRoot: '/tmp/authority-ws',
      repo,
      clock: fixedClock,
    });
    const before = core.authorityProjection();
    const applied = core.setMode('plan');
    expect(applied).toBe(true);
    const after = core.authorityProjection();
    expect(after.workMode).toBe('plan');
    expect(after.permissionProfile).toBe(before.permissionProfile);
    expect(after.activationRevision).toBe(before.activationRevision + 1);

    const sessionId = `sess-${core.providers.selectedId}`;
    const changed = repo
      .queryEvents(sessionId as never, 0)
      .find((e) => e.payload.kind === 'AuthorityChanged');
    expect(changed).toBeDefined();
    expect((changed?.payload as { field: string; value: string }).field).toBe('mode');
    expect((changed?.payload as { field: string; value: string }).value).toBe('plan');
    store.close();
  });

  it('setProfile only changes profile and is never itself an approval/consent/expansion', () => {
    const core = new CoreApp({ credentials: new InMemoryCredentialStore(), workspaceRoot: '/tmp/authority-ws' });
    const before = core.authorityProjection();
    core.setProfile('full-access');
    const after = core.authorityProjection();
    expect(after.workMode).toBe(before.workMode);
    expect(after.permissionProfile).toBe('full-access');
    expect(after.fullAccess).toBe(true);
    expect(after.activeBoundaryExpansionCount).toBe(0);
  });

  it('composer-busy refuses mode/profile mutation (AC #6)', () => {
    const core = new CoreApp({ credentials: new InMemoryCredentialStore(), workspaceRoot: '/tmp/authority-ws' });
    core.setComposerBusy(true);
    const before = core.authorityProjection();
    expect(core.setMode('plan')).toBe(false);
    expect(core.setProfile('full-access')).toBe(false);
    expect(core.authorityProjection()).toEqual(before);
    core.setComposerBusy(false);
    expect(core.setMode('plan')).toBe(true);
  });
});

describe('CoreApp — fresh activation on session switch / workspace rebind (Story 2.1 AC #1, #5)', () => {
  it('beginNewActivation gets a new activationId and resets to Manual, invalidating prior authority', () => {
    const core = new CoreApp({ credentials: new InMemoryCredentialStore(), workspaceRoot: '/tmp/authority-ws' });
    core.setProfile('full-access');
    const before = core.authorityProjection();
    expect(before.permissionProfile).toBe('full-access');

    const after = core.beginNewActivation('session-switch');
    expect(after.activationId).not.toBe(before.activationId);
    expect(after.permissionProfile).toBe('manual');
    expect(after.fullAccess).toBe(false);
  });

  it('rebinding the workspace changes workspaceId in the new activation', () => {
    const core = new CoreApp({ credentials: new InMemoryCredentialStore(), workspaceRoot: '/tmp/authority-ws-a' });
    const before = core.authorityProjection();
    const after = core.beginNewActivation('workspace-rebind', '/tmp/authority-ws-b');
    expect(after.workspaceId).not.toBe(before.workspaceId);
  });
});

describe('CoreApp — PEP evaluation + journaling (Story 2.2 AC #1, #5)', () => {
  it('evaluateEffect journals a PolicyDecisionRecorded event and is observable in the decision', () => {
    const { repo, store } = makeRepo('a3.db');
    const core = new CoreApp({
      credentials: new InMemoryCredentialStore(),
      workspaceRoot: '/tmp/authority-ws',
      repo,
      clock: fixedClock,
    });
    const decision = core.evaluateEffect('write_file');
    expect(decision.outcome).toBe('ask'); // Manual + mutating
    const sessionId = `sess-${core.providers.selectedId}`;
    const recorded = repo
      .queryEvents(sessionId as never, 0)
      .find((e) => e.payload.kind === 'PolicyDecisionRecorded');
    expect(recorded).toBeDefined();
    expect((recorded?.payload as { outcome: string }).outcome).toBe('ask');
    store.close();
  });

  it('authorizeEffect throws for a non-allow decision, and only it can authorize execution (AC #6)', () => {
    const core = new CoreApp({ credentials: new InMemoryCredentialStore(), workspaceRoot: '/tmp/authority-ws' });
    expect(() => core.authorizeEffect('write_file')).toThrow();
    core.setProfile('full-access');
    const decision = core.authorizeEffect('write_file');
    expect(decision.outcome).toBe('allow');
  });
});

describe('CoreApp — hard boundaries and Boundary Expansions (Story 2.3 AC #2, #4, #5)', () => {
  it('checkBoundary denies a workspace escape regardless of Full Access', () => {
    const core = new CoreApp({ credentials: new InMemoryCredentialStore(), workspaceRoot: '/tmp/authority-ws' });
    core.setProfile('full-access');
    const d = core.checkBoundary({ candidatePath: '../escape.txt' });
    expect(d.outcome).toBe('deny');
    expect(d.reason).toBe('workspace-escape');
  });

  it('grantBoundaryExpansion journals BoundaryExpansionGranted and is inspectable/revocable', () => {
    const { repo, store } = makeRepo('a4.db');
    const core = new CoreApp({
      credentials: new InMemoryCredentialStore(),
      workspaceRoot: '/tmp/authority-ws',
      repo,
      clock: fixedClock,
    });
    const expansion = core.grantBoundaryExpansion({
      resourceIdentity: '/tmp/authority-ws/build',
      actionClasses: ['write_file'],
      reason: 'long-lived build output',
    });
    expect(core.listBoundaryExpansions()).toHaveLength(1);
    expect(core.authorityProjection().activeBoundaryExpansionCount).toBe(1);

    const sessionId = `sess-${core.providers.selectedId}`;
    const granted = repo
      .queryEvents(sessionId as never, 0)
      .find((e) => e.payload.kind === 'BoundaryExpansionGranted');
    expect(granted).toBeDefined();

    const revoked = core.revokeBoundaryExpansion(expansion.expansionId, 'no longer needed');
    expect(revoked).toBe(true);
    expect(core.authorityProjection().activeBoundaryExpansionCount).toBe(0);
    const revokedEvent = repo
      .queryEvents(sessionId as never, 0)
      .find((e) => e.payload.kind === 'BoundaryExpansionRevoked');
    expect(revokedEvent).toBeDefined();
    store.close();
  });
});
