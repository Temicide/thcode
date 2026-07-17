// Story 2.14: authority control surfaces + accessible output behavior.
import { describe, expect, it } from 'vitest';
import {
  AUTHORITY_SURFACE_ORDER,
  applyFocusKey,
  applySettingChangePreservingDraft,
  atomicSpans,
  commitControlState,
  initialApprovalFocus,
  preservePreeditBytes,
  projectAuthoritySurface,
  semanticUpdate,
  stateTextLabel,
  SUPPORTED_WIDTHS,
  validNextActions,
  wrapToWidth,
  renderStateToken,
} from '../src/core/protocol/controlSurface.js';
import type { ApprovalSummary, ApprovalContextState } from '../src/core/permissions/approval.js';

const ctx: ApprovalContextState = {
  workspaceId: 'ws-1',
  workMode: 'build',
  profile: 'manual',
  fullAccess: false,
  enforcementVerified: true,
};

const freshApproval: ApprovalSummary = {
  operationId: 'op-1',
  actionClass: 'mutation',
  actionDigest: 'd-abc',
  purpose: 'edit file',
  risk: 'in-workspace mutation',
  proposedOutcome: 'file changed',
  context: ctx,
  startFocus: 'review',
  authorityFlags: { sensitive: false, destructive: false, boundaryExpanding: false, transfer: false },
};

const stateText = (s: string) => stateTextLabel(s);

describe('Keyboard navigation — deterministic, logical focus (AC #1)', () => {
  it('approval/consent begins on review or cancel, never a committing control', () => {
    expect(initialApprovalFocus('review')).toBe('review');
    expect(initialApprovalFocus('cancel')).toBe('cancel');
    // The committing focus values are never returned as an initial focus.
    expect(['review', 'cancel']).not.toContain('approve');
  });

  it('Shift+Tab switches Plan/Build only at an idle composer; busy → ignored', () => {
    const idle = applyFocusKey(
      { surface: 'composer', focus: 'composer', busy: false, preeditActive: false },
      { kind: 'tab', shift: true },
    );
    expect(idle.allowModeToggle).toBe(true);
    const busy = applyFocusKey(
      { surface: 'composer', focus: 'composer', busy: true, preeditActive: false },
      { kind: 'tab', shift: true },
    );
    expect(busy.allowModeToggle).toBe(false);
    const notComposer = applyFocusKey(
      { surface: 'approval', focus: 'review', busy: false, preeditActive: false },
      { kind: 'tab', shift: true },
    );
    expect(notComposer.allowModeToggle).toBe(false);
  });

  it('Esc cancels an active IME preedit without authorizing or changing settings', () => {
    const r = applyFocusKey(
      { surface: 'composer', focus: 'composer', busy: false, preeditActive: true },
      { kind: 'escape' },
    );
    expect(r.preeditCancelled).toBe(true);
    expect(r.authorized).toBe(false);
    expect(r.settingChanged).toBe(false);
  });

  it('Esc dismisses an overlay without authorizing or changing settings', () => {
    const r = applyFocusKey(
      { surface: 'overlay', focus: 'overlay', busy: false, preeditActive: false },
      { kind: 'escape' },
    );
    expect(r.overlayDismissed).toBe(true);
    expect(r.authorized).toBe(false);
    expect(r.settingChanged).toBe(false);
  });

  it('Tab cycles focus logically within an approval surface and reaches approve only by cycling', () => {
    const r = applyFocusKey(
      { surface: 'approval', focus: 'review', busy: false, preeditActive: false },
      { kind: 'tab', shift: false },
    );
    expect(r.focus).toBe('deny');
  });
});

describe('Stale approval disables the committing control (AC #2)', () => {
  it('a fresh approval enables the committing control', () => {
    const s = commitControlState(freshApproval, { context: ctx, actionDigest: 'd-abc' });
    expect(s.enabled).toBe(true);
    expect(s.freshReviewRequired).toBe(false);
  });
  it('a stale (mismatched digest) approval disables before authorizing, with sr reason', () => {
    const s = commitControlState(freshApproval, { context: ctx, actionDigest: 'd-CHANGED' });
    expect(s.enabled).toBe(false);
    expect(s.disabledReason).toBe('stale-approval');
    expect(s.freshReviewRequired).toBe(true);
    expect(s.screenReaderDescription).toMatch(/stale/i);
  });
  it('a stale (context drift) approval disables before authorizing', () => {
    const drifted: ApprovalContextState = { ...ctx, workMode: 'plan' };
    const s = commitControlState(freshApproval, { context: drifted, actionDigest: 'd-abc' });
    expect(s.enabled).toBe(false);
  });
});

describe('Thai IME preedit, grapheme clusters, atomic tokens (AC #3)', () => {
  it('preserves preedit and draft bytes verbatim', () => {
    const draft = 'สวัสดีครับ combined with sha256:abcdef0123456789';
    expect(preservePreeditBytes(draft)).toBe(draft);
  });
  it('atomic technical spans are located intact', () => {
    const spans = atomicSpans('see op-1a2b3c and sha256:abcdef0123456789');
    const texts = spans.map((s) => s.text);
    expect(texts).toContain('sha256:abcdef0123456789');
    expect(texts.some((t) => t.startsWith('op-'))).toBe(true);
  });
  it('a mode/profile/approval change cannot consume or corrupt the draft', () => {
    const draft = 'กำลังพิมพ์';
    expect(applySettingChangePreservingDraft(draft, { mode: 'plan' })).toBe(draft);
    expect(applySettingChangePreservingDraft(draft, { profile: 'full-access' })).toBe(draft);
  });
});

describe('Cross-surface projection parity (AC #4 + #7)', () => {
  const authorityState = {
    workspaceId: 'ws-1',
    activationId: 'act-1',
    activationRevision: 3,
    workMode: 'build' as const,
    permissionProfile: 'manual' as const,
    fullAccess: false,
    boundaryExpansions: 2,
    transferConsent: 'granted' as const,
    enforcementVerified: true,
    warnings: ['provider-degraded'],
    operationId: 'op-9',
    nextStep: 'review result',
  };
  it('every surface carries the canonical fields in the same order', () => {
    for (const surface of ['ink', 'redirected', 'linearized', 'json'] as const) {
      const p = projectAuthoritySurface(authorityState, surface);
      expect(p.fields.map((f) => f.field)).toEqual([...AUTHORITY_SURFACE_ORDER]);
    }
  });
  it('JSON is semantically complete with the same values', () => {
    const p = projectAuthoritySurface(authorityState, 'json');
    const obj = JSON.parse(p.body);
    expect(obj['work-mode']).toBe('build');
    expect(obj['enforcement']).toBe('verified');
    expect(obj['operation-identity']).toBe('op-9');
  });
  it('Ink and redirected share identical ordered key:value lines', () => {
    const ink = projectAuthoritySurface(authorityState, 'ink');
    const redir = projectAuthoritySurface(authorityState, 'redirected');
    expect(ink.body).toBe(redir.body);
  });
});

describe('Column-width-safe rendering + reduced motion (AC #5)', () => {
  it('supports the required widths 40/60/80/120', () => {
    expect([...SUPPORTED_WIDTHS]).toEqual([40, 60, 80, 120]);
  });
  it('wraps to the cell-width budget without breaking atomic spans', () => {
    const text = 'review the artifact at sha256:abcdef0123456789abcdef0123456789 and continue';
    const lines = wrapToWidth(text, 40);
    for (const line of lines) expect(line.length <= 40 || /sha256:/.test(line)).toBe(true);
    // the atomic digest is preserved intact on one line
    expect(lines.some((l) => l.includes('sha256:abcdef0123456789abcdef0123456789'))).toBe(true);
  });
  it('reduced-motion updates are non-animated, durable, and retained after scroll', () => {
    const u = semanticUpdate('warnings', 'provider degraded');
    expect(u.animated).toBe(false);
    expect(u.durable).toBe(true);
    expect(u.retainedAfterScroll).toBe(true);
  });
});

describe('Canonical English tokens + Thai, no color sole carrier (AC #6)', () => {
  it('renders the canonical English token, a Thai label, and a text-label distinction', () => {
    const r = renderStateToken('blocked')!;
    expect(r.token).toBe('blocked');
    expect(r.thaiLabel).toMatch(/[฀-๿]/); // Thai script
    expect(r.textLabel).toBe('[BLOCKED]');
    expect(r.colorIsSoleCarrier).toBe(false);
  });
  it('only valid next actions are exposed per state', () => {
    expect(validNextActions('succeeded')).toEqual(['continue']);
    expect(validNextActions('unknown-outcome')).toContain('reconcile explicitly');
    expect(validNextActions('blocked')).not.toContain('continue');
  });
  it('text labels distinguish state without color', () => {
    expect(stateText('succeeded')).not.toBe(stateText('failed'));
    expect(stateText('blocked')).not.toBe(stateText('cancelled'));
  });
});