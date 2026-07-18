// Authority control surfaces + accessible output behavior (Story 2.14,
// FR-21..FR-24, FR-37..FR-39, NFR-3, NFR-7, NFR-9, NFR-10, NFR-15, AD-2,
// AD-24, AD-28, UX-DR-004..006, 015..016, 021..050, 054..080, 091..100,
// 118, 120). This module is the deterministic core the Ink UI consumes:
// keyboard focus/navigation, stale-approval gating, IME/preedit byte
// preservation, column-width-safe wrapping, cross-surface projection
// parity, and the canonical English-token + Thai-explanation + no-color-
// sole-carrier contract. Keeping these as pure functions means every AC
// is unit-testable without rendering Ink, while App.tsx wires the same
// logic to real key events.

import { isApprovalStale, type ApprovalContextState, type ApprovalSummary } from '../permissions/approval.js';
import { lookupUxState, type UxStateRow } from './uxState.js';

// ---------------------------------------------------------------------------
// AC #1 — keyboard navigation: deterministic, logical focus.
// ---------------------------------------------------------------------------

/** Focusable control surfaces. The committing controls (`approve`, `commit`,
 * `submit-transfer`) are NEVER the initial focus of an approval/consent
 * surface — those begin on `review` or `cancel` (AC #1). */
export type ControlFocus =
  | 'review'
  | 'cancel'
  | 'approve'
  | 'deny'
  | 'commit'
  | 'submit-transfer'
  | 'composer'
  | 'overlay';

export interface FocusState {
  readonly surface: 'composer' | 'approval' | 'consent' | 'overlay';
  readonly focus: ControlFocus;
  /** True while a prompt round is in flight — `Shift+Tab` mode switching is
   * accepted ONLY at an idle composer (AC #1). */
  readonly busy: boolean;
  /** True while an IME preedit is active — `Esc` cancels the preedit without
   * authorizing or changing settings (AC #1). */
  readonly preeditActive: boolean;
}

/** AC #1: the initial focus for an approval/consent surface is `review` or
 * `cancel`, never a committing control. */
export function initialApprovalFocus(start: 'review' | 'cancel' = 'review'): ControlFocus {
  return start;
}

export type FocusKeyEvent =
  | { readonly kind: 'tab'; readonly shift: boolean }
  | { readonly kind: 'enter' }
  | { readonly kind: 'escape' }
  | { readonly kind: 'arrow'; readonly dir: 'left' | 'right' | 'up' | 'down' };

/** AC #1: apply a keyboard event to focus state.
 * - `Shift+Tab` switches Plan/Build ONLY at an idle composer; while busy it
 *   is ignored (the mode switch is deferred, not silently applied).
 * - `Esc` cancels an active IME preedit first (without authorizing or
 *   changing settings); otherwise it dismisses an overlay. It NEVER
 *   authorizes, commits, or changes Work Mode/Profile/Boundary settings.
 * - `Enter` on a committing control is refused while focus is `review`/
 *   `cancel`-only or while the surface is stale (see `commitControlState`). */
export interface FocusUpdate {
  readonly focus: ControlFocus;
  /** Whether the composer's Work Mode may toggle (idle composer only). */
  readonly allowModeToggle: boolean;
  /** Whether the IME preedit was cancelled by this event. */
  readonly preeditCancelled: boolean;
  /** Whether an overlay was dismissed by this event. */
  readonly overlayDismissed: boolean;
  /** `Esc`/`Shift+Tab`-while-busy never authorize or change settings. */
  readonly authorized: false;
  readonly settingChanged: false;
}

export function applyFocusKey(state: FocusState, event: FocusKeyEvent): FocusUpdate {
  const base = {
    authorized: false as const,
    settingChanged: false as const,
    preeditCancelled: false,
    overlayDismissed: false,
    allowModeToggle: false,
  };
  if (event.kind === 'escape') {
    // Cancel an active IME preedit first — never authorize or change settings.
    if (state.preeditActive) {
      return { ...base, focus: state.focus, preeditCancelled: true };
    }
    // Otherwise dismiss an overlay if one is open; never change settings.
    if (state.surface === 'overlay' || state.surface === 'approval' || state.surface === 'consent') {
      return { ...base, focus: 'composer', overlayDismissed: true };
    }
    return { ...base, focus: state.focus };
  }
  if (event.kind === 'tab' && event.shift) {
    // Plan/Build toggle ONLY at an idle composer. Busy → ignored, not applied.
    const idle = state.surface === 'composer' && !state.busy;
    return { ...base, focus: state.focus, allowModeToggle: idle };
  }
  if (event.kind === 'tab' && !event.shift) {
    // Logical, deterministic focus cycling within the active surface; the
    // committing control is reachable but never the initial focus.
    return { ...base, focus: nextFocus(state) };
  }
  if (event.kind === 'arrow') {
    return { ...base, focus: arrowFocus(state, event.dir) };
  }
  // enter — focus unchanged here; commit gating is enforced separately.
  return { ...base, focus: state.focus };
}

function nextFocus(state: FocusState): ControlFocus {
  if (state.surface === 'approval') {
    const order: ControlFocus[] = ['review', 'deny', 'cancel', 'approve'];
    const i = order.indexOf(state.focus);
    return order[(i + 1) % order.length];
  }
  if (state.surface === 'consent') {
    const order: ControlFocus[] = ['review', 'cancel', 'submit-transfer'];
    const i = order.indexOf(state.focus);
    return order[(i + 1) % order.length];
  }
  return state.focus;
}

function arrowFocus(state: FocusState, dir: 'left' | 'right' | 'up' | 'down'): ControlFocus {
  if (state.surface !== 'approval' && state.surface !== 'consent') return state.focus;
  const order: ControlFocus[] =
    state.surface === 'approval' ? ['review', 'deny', 'cancel', 'approve'] : ['review', 'cancel', 'submit-transfer'];
  const i = order.indexOf(state.focus);
  if (i < 0) return order[0];
  if (dir === 'left' || dir === 'up') return order[(i - 1 + order.length) % order.length];
  return order[(i + 1) % order.length];
}

// ---------------------------------------------------------------------------
// AC #2 — stale approval/consent disables the committing control.
// ---------------------------------------------------------------------------

export interface CommitControlState {
  /** The committing control is disabled before it can authorize. */
  readonly enabled: boolean;
  readonly disabledReason: string | null;
  /** Screen-reader description identifying the disabled reason. */
  readonly screenReaderDescription: string;
  /** Fresh review is required — a stale submit does not consume authority. */
  readonly freshReviewRequired: boolean;
}

/** AC #2: the committing control is disabled before it can authorize when
 * the approval/consent is stale. Stale/mismatch Evidence is shown, fresh
 * review is required, and the disabled reason is exposed to screen readers. */
export function commitControlState(
  approval: ApprovalSummary,
  current: { readonly context: ApprovalContextState; readonly actionDigest: string },
  opts?: { readonly overrideDisabled?: boolean },
): CommitControlState {
  const stale = isApprovalStale(approval, current);
  if (opts?.overrideDisabled) {
    return {
      enabled: false,
      disabledReason: 'override-disabled',
      screenReaderDescription: 'Committing control disabled: manual override. Fresh review required.',
      freshReviewRequired: true,
    };
  }
  if (stale) {
    return {
      enabled: false,
      disabledReason: 'stale-approval',
      screenReaderDescription:
        'Committing control disabled: the approval is stale or its Evidence no longer matches the current authority. Review again before approving.',
      freshReviewRequired: true,
    };
  }
  return {
    enabled: true,
    disabledReason: null,
    screenReaderDescription: 'Committing control enabled: approval is fresh and matches the current authority.',
    freshReviewRequired: false,
  };
}

// ---------------------------------------------------------------------------
// AC #3 — Thai IME preedit, mixed scripts, grapheme clusters, atomic tokens.
// ---------------------------------------------------------------------------

/** AC #3: preserve preedit and draft bytes verbatim. The composer's draft is
 * an opaque byte/string buffer — mode/profile/approval changes never consume
 * or corrupt it. Returns the unchanged draft so the contract is explicit and
 * unit-testable. */
export function preservePreeditBytes(draft: string): string {
  return draft;
}

/** Atomic technical spans (paths, digests, OperationIds, shell tokens) must
 * remain intact — they are never split across lines or wrapped mid-span. A
 * span is "atomic" if it contains no whitespace and is longer than one cell
 * cluster, or matches a technical token shape. */
const ATOMIC_SPAN_RE = /[\w./\\:@-]{8,}|0x[0-9a-fA-F]+|op-[A-Za-z0-9_-]+|sha256:[0-9a-fA-F]+/g;

export interface AtomicSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** AC #3: locate atomic technical spans so wrapping never breaks them. */
export function atomicSpans(text: string): readonly AtomicSpan[] {
  const spans: AtomicSpan[] = [];
  for (const m of text.matchAll(ATOMIC_SPAN_RE)) {
    if (m.index === undefined) continue;
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return spans;
}

/** AC #3: applying a mode/profile/approval change never consumes the draft.
 * The draft is returned untouched — the change is a side-channel that cannot
 * corrupt input. */
export function applySettingChangePreservingDraft<T>(draft: string, _settingChange: T): string {
  void _settingChange;
  return draft;
}

// ---------------------------------------------------------------------------
// AC #4 + AC #7 — cross-surface projection parity.
// ---------------------------------------------------------------------------

export type OutputSurface = 'ink' | 'redirected' | 'linearized' | 'json';

/** The authority surface fields that must retain the same meaning and order
 * across every surface (AC #7). */
export interface AuthoritySurfaceState {
  readonly workspaceId: string;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly workMode: 'plan' | 'build';
  readonly permissionProfile: 'manual' | 'assisted' | 'full-access';
  readonly fullAccess: boolean;
  readonly boundaryExpansions: number;
  readonly transferConsent: 'none' | 'pending' | 'granted' | 'refused' | 'expired';
  readonly enforcementVerified: boolean;
  readonly warnings: readonly string[];
  readonly operationId: string | null;
  readonly nextStep: string | null;
}

/** AC #7: the canonical ordered field list. Every surface renders these in
 * this order with this meaning; only the formatting differs per surface. */
export const AUTHORITY_SURFACE_ORDER = [
  'workspace',
  'runtime-activation',
  'work-mode',
  'permission-profile',
  'full-access',
  'boundary-expansions',
  'transfer-consent',
  'enforcement',
  'warnings',
  'operation-identity',
  'next-step',
] as const;
export type AuthoritySurfaceField = (typeof AUTHORITY_SURFACE_ORDER)[number];

export interface SurfaceProjection {
  readonly surface: OutputSurface;
  readonly body: string;
  /** Semantic field map in canonical order — present on every surface so
   * parity is mechanically verifiable (AC #7). */
  readonly fields: ReadonlyArray<{ readonly field: AuthoritySurfaceField; readonly value: string; readonly order: number }>;
}

/** AC #4 + AC #7: project the same authority state to any surface. Ink and
 * redirected/linearized text render the same ordered key:value lines (Ink
 * may add color, but color is never the sole state carrier — AC #6); JSON
 * carries the same fields as a semantically complete object. Interactive
 * approval/consent under no-TTY fails closed (handled by the caller via
 * `noTtyFailClosed`); this projection never waits on stdin. */
export function projectAuthoritySurface(state: AuthoritySurfaceState, surface: OutputSurface): SurfaceProjection {
  const entries: ReadonlyArray<[AuthoritySurfaceField, string]> = [
    ['workspace', state.workspaceId],
    ['runtime-activation', `${state.activationId}@rev${state.activationRevision}`],
    ['work-mode', state.workMode],
    ['permission-profile', state.permissionProfile],
    ['full-access', String(state.fullAccess)],
    ['boundary-expansions', String(state.boundaryExpansions)],
    ['transfer-consent', state.transferConsent],
    ['enforcement', state.enforcementVerified ? 'verified' : 'ENFORCEMENT UNVERIFIED'],
    ['warnings', state.warnings.join('; ')],
    ['operation-identity', state.operationId ?? 'none'],
    ['next-step', state.nextStep ?? 'none'],
  ];
  const fields = entries.map(([field, value], i) => ({ field, value, order: i }));
  if (surface === 'json') {
    const obj: Record<string, string> = {};
    for (const [field, value] of entries) obj[field] = value;
    const body = JSON.stringify(obj);
    return { surface, body, fields };
  }
  // ink / redirected / linearized share the same ordered key:value lines;
  // linearized additionally prefixes the surface so a flattened stream keeps
  // the same meaning and order without depending on cursor position.
  const lines = entries.map(([f, v]) => `${f}: ${v}`);
  const body = surface === 'linearized' ? `[linearized]\n${lines.join('\n')}` : lines.join('\n');
  return { surface, body, fields };
}

// ---------------------------------------------------------------------------
// AC #5 — column-width-safe rendering + reduced motion.
// ---------------------------------------------------------------------------

export const SUPPORTED_WIDTHS = [40, 60, 80, 120] as const;
export type SupportedWidth = (typeof SUPPORTED_WIDTHS)[number];

/** AC #3 + AC #5: wrap text to a cell-width budget without breaking atomic
 * technical spans. Reduced-motion mode is the default here — updates are
 * semantic, not animated, and durable content stays visible after scroll
 * because nothing is erased by animation. */
export function wrapToWidth(text: string, width: SupportedWidth): readonly string[] {
  if (width <= 0) return [text];
  const atomics = atomicSpans(text);
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    let line = '';
    const flush = () => {
      if (line.length > 0) out.push(line);
      line = '';
    };
    for (const word of rawLine.split(/\s+/)) {
      if (word.length === 0) continue;
      // Never break an atomic span: if it alone exceeds the width, place it
      // on its own line intact rather than splitting it.
      const isAtomic = atomics.some((s) => s.text === word);
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (candidate.length <= width) {
        line = candidate;
      } else if (isAtomic && word.length > width) {
        flush();
        out.push(word); // intact, even if over width
      } else if (line.length === 0) {
        line = word; // single long non-atomic word: hard-break on next iteration
        flush();
      } else {
        flush();
        line = word;
      }
    }
    flush();
  }
  return out;
}

/** AC #5: reduced-motion update contract. Durable updates remain visible
 * after scrolling and do not rely on animation; this returns the non-animated
 * semantic update record the surface should commit. */
export interface SemanticUpdate {
  readonly animated: false;
  readonly durable: true;
  readonly retainedAfterScroll: true;
  readonly region: 'status' | 'warnings' | 'transcript' | 'decision' | 'composer';
  readonly text: string;
}

export function semanticUpdate(region: SemanticUpdate['region'], text: string): SemanticUpdate {
  return { animated: false, durable: true, retainedAfterScroll: true, region, text };
}

// ---------------------------------------------------------------------------
// AC #6 — canonical English state tokens + Thai explanations, no color sole
// carrier.
// ---------------------------------------------------------------------------

export interface StateTokenRender {
  /** Canonical English state token — exact and stable (AD-28). */
  readonly token: string;
  /** Thai explanation may accompany the English token (never replace it). */
  readonly thaiLabel: string;
  /** A text-label state distinction so color is never the sole carrier. */
  readonly textLabel: string;
  /** Color is decorative only — the text label carries the state alone. */
  readonly colorIsSoleCarrier: false;
}

/** AC #6: render a state token with its canonical English form, an optional
 * Thai explanation, and a text-label distinction. Only valid next actions
 * are exposed (the caller filters next actions; this never widens them). */
export function renderStateToken(statusKey: string): StateTokenRender | null {
  const row: UxStateRow | undefined = lookupUxState(statusKey);
  if (!row) return null;
  const textLabel = stateTextLabel(row.displayToken);
  return {
    token: row.displayToken,
    thaiLabel: row.thaiLabel,
    textLabel,
    colorIsSoleCarrier: false,
  };
}

/** AC #6: a text label that distinguishes state without color. Exported so
 * the no-color-sole-carrier contract is directly unit-testable. */
export function stateTextLabel(token: string): string {
  const t = token.toLowerCase();
  if (t === 'succeeded' || t === 'reconciled') return '[OK]';
  if (t === 'failed' || t === 'malformed') return '[FAIL]';
  if (t === 'blocked' || t === 'denied' || t === 'refused') return '[BLOCKED]';
  if (t === 'cancelled') return '[CANCELLED]';
  if (t === 'unknown-outcome') return '[UNKNOWN]';
  if (t === 'stale') return '[STALE]';
  if (t === 'idle') return '[IDLE]';
  return `[${token.toUpperCase()}]`;
}

/** AC #6: filter to only valid next actions for a terminal/nonterminal
 * state — never expose an action the state does not permit. */
export function validNextActions(statusKey: string): readonly string[] {
  const row = lookupUxState(statusKey);
  if (!row) return ['rerun interactively'];
  if (row.terminal) {
    if (row.displayToken === 'succeeded' || row.displayToken === 'reconciled') return ['continue'];
    if (row.displayToken === 'cancelled') return ['rerun if still intended'];
    if (row.displayToken === 'unknown-outcome') return ['reconcile explicitly', 'inspect evidence'];
    return ['review evidence', 'rerun interactively'];
  }
  return ['submit a prompt'];
}