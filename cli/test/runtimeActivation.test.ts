// Story 2.1: Establish Runtime Activation and independent authority state.
import { describe, expect, it } from 'vitest';
import {
  activationEstablishedPayload,
  RuntimeActivation,
} from '../src/core/permissions/runtimeActivation.js';

const fixedClock = (() => {
  let n = 0;
  const base = Date.parse('2026-07-17T09:00:00.000Z');
  return () => new Date(base + n++ * 1000).toISOString();
})();

describe('RuntimeActivation — establishment (AC #1)', () => {
  it('a new activation has a unique activationId and starts revision 1', () => {
    const a1 = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    const a2 = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    expect(a1.snapshot().activationId).not.toBe(a2.snapshot().activationId);
    expect(a1.snapshot().revision).toBe(1);
  });

  it('begins in Manual, clears Full Access / sensitive-transfer override / composer-busy', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'session-open', clock: fixedClock });
    const s = a.snapshot();
    expect(s.profile).toBe('manual');
    expect(s.sensitiveTransferOverride).toBe(false);
    expect(s.composerBusy).toBe(false);
  });

  it('activationEstablishedPayload is a sanitized durable-event payload with no secrets', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'session-create', clock: fixedClock });
    const payload = activationEstablishedPayload(a.snapshot());
    expect(payload.kind).toBe('RuntimeActivationEstablished');
    expect(payload.activationId).toBe(a.snapshot().activationId);
    expect(payload.workspaceId).toBe('ws-1');
    expect(payload.mode).toBe('build');
    expect(payload.profile).toBe('manual');
    expect(payload.reason).toBe('session-create');
    expect(JSON.stringify(payload)).not.toMatch(/sk-|secret|password/i);
  });
});

describe('RuntimeActivation — fresh interactive default (AC #2)', () => {
  it('Work Mode is Build, Profile is Manual, and fields are independently addressable', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    const s = a.snapshot();
    expect(s.mode).toBe('build');
    expect(s.profile).toBe('manual');
    expect(s.workspaceId).toBe('ws-1');
    expect(s.activationId).toBeTruthy();
    expect(s.revision).toBeTruthy();
  });

  it('no profile selection changes mode', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    a.setProfile('full-access');
    expect(a.snapshot().mode).toBe('build');
  });

  it('no mode selection changes profile', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    a.setMode('plan');
    expect(a.snapshot().profile).toBe('manual');
  });
});

describe('RuntimeActivation — Work Mode change (AC #3)', () => {
  it('only Work Mode changes; revision increments; new mode is visible immediately', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    const before = a.snapshot();
    const result = a.setMode('plan');
    expect(result.applied).toBe(true);
    expect(result.changedField).toBe('mode');
    expect(a.snapshot().mode).toBe('plan');
    expect(a.snapshot().profile).toBe(before.profile);
    expect(a.snapshot().revision).toBe(before.revision + 1);
  });

  it('selecting the already-active mode is a no-op (no spurious revision bump)', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    const before = a.snapshot().revision;
    const result = a.setMode('build');
    expect(result.applied).toBe(false);
    expect(a.snapshot().revision).toBe(before);
  });
});

describe('RuntimeActivation — Permission Profile change (AC #4)', () => {
  it('only Permission Profile changes; revision increments; selection is not itself approval', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    const before = a.snapshot();
    const result = a.setProfile('assisted');
    expect(result.applied).toBe(true);
    expect(result.changedField).toBe('profile');
    expect(a.snapshot().profile).toBe('assisted');
    expect(a.snapshot().mode).toBe(before.mode);
    expect(a.snapshot().revision).toBe(before.revision + 1);
  });

  it('switching away from full-access clears the sensitive-transfer override', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    a.setProfile('full-access');
    // The override itself is only ever set by a separate authority grant in
    // this prototype's scope; simulate it directly to prove the clearing rule.
    (a as unknown as { state: { sensitiveTransferOverride: boolean } }).state.sensitiveTransferOverride = true;
    a.setProfile('manual');
    expect(a.snapshot().sensitiveTransferOverride).toBe(false);
  });
});

describe('RuntimeActivation — stale authority across activations (AC #5)', () => {
  it('a prior activationId+revision does not authorize the current activation', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    const staleId = a.snapshot().activationId;
    const staleRevision = a.snapshot().revision;
    a.setMode('plan'); // bumps revision within the SAME activation
    expect(a.authorizes(staleId, staleRevision)).toBe(false);
    expect(a.authorizes(staleId, a.snapshot().revision)).toBe(true);

    const fresh = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'session-switch', clock: fixedClock });
    expect(fresh.authorizes(staleId, staleRevision)).toBe(false);
  });
});

describe('RuntimeActivation — composer-busy guard (AC #6)', () => {
  it('setMode is refused while the composer is busy; state and revision are unchanged', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    a.setComposerBusy(true);
    const before = a.snapshot();
    const result = a.setMode('plan');
    expect(result.applied).toBe(false);
    expect(a.snapshot()).toEqual(before);
  });

  it('setProfile is refused while the composer is busy', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    a.setComposerBusy(true);
    const before = a.snapshot();
    const result = a.setProfile('full-access');
    expect(result.applied).toBe(false);
    expect(a.snapshot()).toEqual(before);
  });

  it('once idle again, the change applies', () => {
    const a = new RuntimeActivation({ workspaceId: 'ws-1', reason: 'process-start', clock: fixedClock });
    a.setComposerBusy(true);
    a.setMode('plan');
    a.setComposerBusy(false);
    const result = a.setMode('plan'); // still same value; the busy attempt never applied
    // mode was never actually changed while busy, so this now DOES apply.
    expect(result.applied).toBe(true);
    expect(a.snapshot().mode).toBe('plan');
  });
});
