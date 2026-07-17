// Story 2.2: versioned PermissionMatrix + local Policy Enforcement Point.
import { describe, expect, it } from 'vitest';
import { knownActionClasses, lookupActionClass, PERMISSION_MATRIX_VERSION } from '../src/core/permissions/matrix.js';
import {
  EffectExecutor,
  EffectNotAuthorizedError,
  ENFORCEMENT_UNVERIFIED,
  PolicyEnforcementPoint,
  pep,
} from '../src/core/permissions/pep.js';
import type { PolicyState } from '../src/core/permissions/types.js';

const manualBuild: PolicyState = { mode: 'build', profile: 'manual' };
const assistedBuild: PolicyState = { mode: 'build', profile: 'assisted' };
const fullAccessBuild: PolicyState = { mode: 'build', profile: 'full-access' };
const planFullAccess: PolicyState = { mode: 'plan', profile: 'full-access' };

describe('PermissionMatrix — versioned, explicit decision inputs (AC #1)', () => {
  it('exposes a stable version and known action classes with explicit attributes', () => {
    expect(PERMISSION_MATRIX_VERSION).toBeGreaterThan(0);
    expect(knownActionClasses()).toContain('write_file');
    const def = lookupActionClass('write_file');
    expect(def).toMatchObject({ mutating: true, sensitive: false, risk: 'medium' });
  });
});

describe('PEP — deterministic decisions (AC #2)', () => {
  it('the same action class + state + activation revision always decide the same way', () => {
    const d1 = pep.evaluate({ actionClass: 'write_file', state: manualBuild, activationRevision: 3 });
    const d2 = pep.evaluate({ actionClass: 'write_file', state: manualBuild, activationRevision: 3 });
    expect(d1).toEqual(d2);
    expect(d1.matrixVersion).toBe(PERMISSION_MATRIX_VERSION);
    expect(d1.activationRevision).toBe(3);
  });
});

describe('PEP — Plan mode is structurally read-only (AC #3)', () => {
  it('denies a mutating action class under every profile in Plan mode; no profile converts it to allow', () => {
    for (const profile of ['manual', 'assisted', 'full-access'] as const) {
      const decision = pep.evaluate({
        actionClass: 'write_file',
        state: { mode: 'plan', profile },
        activationRevision: 1,
      });
      expect(decision.outcome).toBe('deny');
      expect(decision.reason).toBe('plan-mode-is-read-only');
    }
  });

  it('Plan + Full Access still cannot mutate', () => {
    const decision = pep.evaluate({ actionClass: 'delete', state: planFullAccess, activationRevision: 1 });
    expect(decision.outcome).toBe('deny');
  });
});

describe('PEP — unknown action class fails closed (AC #4)', () => {
  it('denies an unknown action class as not-authoritative without inferring a safer class', () => {
    const decision = pep.evaluate({ actionClass: 'launch_missiles', state: fullAccessBuild, activationRevision: 1 });
    expect(decision.outcome).toBe('deny');
    expect(decision.reason).toBe('unknown-action-class-not-authoritative');
  });
});

describe('PEP — profile behavior for a non-sensitive read/list/search proposal (AC #5)', () => {
  it('Manual may ask on mutation, Assisted applies the deterministic matrix, Full Access auto-approves within bounds', () => {
    const manualRead = pep.evaluate({ actionClass: 'read_file', state: manualBuild, activationRevision: 1 });
    expect(manualRead.outcome).toBe('allow');

    const manualWrite = pep.evaluate({ actionClass: 'write_file', state: manualBuild, activationRevision: 1 });
    expect(manualWrite.outcome).toBe('ask');

    const assistedRead = pep.evaluate({ actionClass: 'read_file', state: assistedBuild, activationRevision: 1 });
    expect(assistedRead.outcome).toBe('allow');

    const fullAccessWrite = pep.evaluate({ actionClass: 'write_file', state: fullAccessBuild, activationRevision: 1 });
    expect(fullAccessWrite.outcome).toBe('allow');
  });
});

describe('PEP — enforcement fails closed (AC #7)', () => {
  it('denies with the canonical ENFORCEMENT UNVERIFIED token when a required platform capability is unavailable', () => {
    const decision = pep.evaluate({
      actionClass: 'run_command',
      state: fullAccessBuild,
      activationRevision: 1,
      enforcementAvailable: false,
    });
    expect(decision.outcome).toBe('deny');
    expect(decision.reason).toBe(ENFORCEMENT_UNVERIFIED);
  });

  it('action classes with no declared enforcement requirement are unaffected by enforcementAvailable', () => {
    const decision = pep.evaluate({
      actionClass: 'read_file',
      state: manualBuild,
      activationRevision: 1,
      enforcementAvailable: false,
    });
    expect(decision.outcome).toBe('allow');
  });
});

describe('EffectExecutor — sole authorization path (AC #6)', () => {
  it('authorizes an allow decision and returns it', () => {
    const executor = new EffectExecutor(new PolicyEnforcementPoint());
    const decision = executor.authorize({ actionClass: 'read_file', state: manualBuild, activationRevision: 1 });
    expect(decision.outcome).toBe('allow');
  });

  it('throws EffectNotAuthorizedError for a deny decision — never silently invokes an effect', () => {
    const executor = new EffectExecutor(new PolicyEnforcementPoint());
    expect(() =>
      executor.authorize({ actionClass: 'write_file', state: planFullAccess, activationRevision: 1 }),
    ).toThrow(EffectNotAuthorizedError);
  });

  it('throws for an ask decision too — ask is not yet an authorization', () => {
    const executor = new EffectExecutor(new PolicyEnforcementPoint());
    expect(() =>
      executor.authorize({ actionClass: 'write_file', state: manualBuild, activationRevision: 1 }),
    ).toThrow(EffectNotAuthorizedError);
  });
});
