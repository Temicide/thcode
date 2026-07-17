---
story_id: "2.14"
story_key: "2-14-integrate-authority-control-surfaces-and-accessible-output"
epic: 2
baseline_commit: 66c34f3
status: review
created: 2026-07-17
project: thcode
dependsOn: "2.5; 2.8; 2.13; 1.3"
---

# Story 2.14: Integrate authority control surfaces + accessible output behavior

Status: review

## Implementation
- cli/src/core/protocol/controlSurface.ts — deterministic core consumed by the UI, all 7 ACs unit-testable without rendering Ink:
  - AC #1 keyboard navigation: `initialApprovalFocus` (review/cancel never approve), `applyFocusKey` (Shift+Tab mode toggle ONLY at idle composer; Esc cancels IME preedit first then dismisses overlay; never authorizes or changes settings — `authorized:false, settingChanged:false`).
  - AC #2 stale-approval gating: `commitControlState` disables the committing control before it can authorize via `isApprovalStale`; exposes disabled reason + screen-reader description + fresh-review-required.
  - AC #3 IME/grapheme/atomic-token preservation: `preservePreeditBytes`, `atomicSpans` (paths/digests/OperationIds/sha256 intact), `applySettingChangePreservingDraft` (mode/profile/approval changes cannot consume input).
  - AC #4 + #7 cross-surface parity: `projectAuthoritySurface(state, 'ink'|'redirected'|'linearized'|'json')` renders the canonical ordered fields (Workspace, Runtime Activation, Work Mode, Permission Profile, Full Access, Boundary Expansions, transfer consent, enforcement, warnings, operation identity, next step) with the same meaning+order; `AUTHORITY_SURFACE_ORDER` frozen. Ink/redirected share identical lines; JSON is semantically complete.
  - AC #5 column widths: `wrapToWidth(text, 40|60|80|120)` cell-width safe, never breaks atomic spans; `semanticUpdate` is non-animated/durable/retained-after-scroll (reduced-motion default).
  - AC #6 tokens + Thai + no-color-sole-carrier: `renderStateToken` (canonical English `displayToken` + `thaiLabel` + `stateTextLabel` distinction, `colorIsSoleCarrier:false`); `validNextActions` exposes only state-permitted next actions.
- cli/src/ui/App.tsx — minimal wiring mirroring the contract without crossing the AD-1 boundary (preflight-enforced): Esc cancels preedit/dismisses without authorizing; Shift+Tab gated by `!busy` (idle composer only). Color is not the sole state carrier (mode badge carries text PLAN/BUILD, health shown as text).
- cli/test/controlSurface.test.ts — 20 cases across all 7 ACs.

## Verify
- npm run build clean; npm test green (401 tests).