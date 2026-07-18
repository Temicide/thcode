import { describe, expect, it } from 'vitest';
import { evaluatePermission } from '../src/core/permissions/policy.js';
import {
  NEW_SESSION_DEFAULT,
  type PermissionProfile,
  type WorkMode,
} from '../src/core/permissions/types.js';

const MODES: WorkMode[] = ['plan', 'build'];
const PROFILES: PermissionProfile[] = ['manual', 'assisted', 'full-access'];

const read = { tool: 'read_file', mutating: false } as const;
const write = { tool: 'write_file', mutating: true } as const;

describe('permission policy — orthogonal Work Mode × Permission Profile matrix', () => {
  it('new session default is build + manual (ADR 0012/0013)', () => {
    expect(NEW_SESSION_DEFAULT).toEqual({ mode: 'build', profile: 'manual' });
  });

  describe('plan mode is structurally read-only for EVERY profile', () => {
    for (const profile of PROFILES) {
      it(`plan + ${profile}: mutation denied`, () => {
        const d = evaluatePermission(write, { mode: 'plan', profile });
        expect(d.outcome).toBe('deny');
        expect(d.reason).toBe('plan-mode-is-read-only');
      });
      it(`plan + ${profile}: read allowed`, () => {
        const d = evaluatePermission(read, { mode: 'plan', profile });
        expect(d.outcome).toBe('allow');
      });
    }
  });

  it('plan + full-access with sensitive override STILL cannot mutate', () => {
    const d = evaluatePermission(write, {
      mode: 'plan',
      profile: 'full-access',
      sensitiveOverride: true,
    });
    expect(d.outcome).toBe('deny');
  });

  describe('build mode', () => {
    it('build + manual: mutation asks', () => {
      expect(evaluatePermission(write, { mode: 'build', profile: 'manual' }).outcome).toBe('ask');
    });
    it('build + manual: read allows', () => {
      expect(evaluatePermission(read, { mode: 'build', profile: 'manual' }).outcome).toBe('allow');
    });
    it('build + assisted: mutation without risk hint asks (uncertainty → developer)', () => {
      expect(evaluatePermission(write, { mode: 'build', profile: 'assisted' }).outcome).toBe('ask');
    });
    it('build + assisted: low-risk mutation allows', () => {
      expect(
        evaluatePermission({ ...write, risk: 'low' }, { mode: 'build', profile: 'assisted' }).outcome,
      ).toBe('allow');
    });
    it('build + full-access: mutation auto-approves', () => {
      expect(evaluatePermission(write, { mode: 'build', profile: 'full-access' }).outcome).toBe('allow');
    });
  });

  describe('sensitive actions', () => {
    const sensitive = { tool: 'upload_artifact', mutating: true, sensitive: true } as const;
    for (const profile of PROFILES) {
      it(`build + ${profile}: sensitive asks without override`, () => {
        expect(evaluatePermission(sensitive, { mode: 'build', profile }).outcome).toBe('ask');
      });
    }
    it('build + full-access + explicit override: sensitive allows', () => {
      expect(
        evaluatePermission(sensitive, {
          mode: 'build',
          profile: 'full-access',
          sensitiveOverride: true,
        }).outcome,
      ).toBe('allow');
    });
    it('build + manual + override flag: override only applies to full-access', () => {
      expect(
        evaluatePermission(sensitive, { mode: 'build', profile: 'manual', sensitiveOverride: true })
          .outcome,
      ).toBe('ask');
    });
  });

  it('reads allow in every cell of the matrix', () => {
    for (const mode of MODES) {
      for (const profile of PROFILES) {
        expect(evaluatePermission(read, { mode, profile }).outcome).toBe('allow');
      }
    }
  });
});
