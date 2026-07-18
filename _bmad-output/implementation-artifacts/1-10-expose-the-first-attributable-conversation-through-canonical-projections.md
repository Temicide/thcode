---
story_id: "1.10"
story_key: "1-10-expose-the-first-attributable-conversation-through-canonical-projections"
epic: 1
baseline_commit: cb6cf43
status: review
created: 2026-07-17
project: thcode
dependsOn: "1-9"
---

# Story 1.10: Expose the first attributable conversation through canonical projections

Status: review

## Story

As a developer
I want to see the first attributable conversation through the same canonical projections that redirected text and headless JSON use
so that Ink, redirected output, and headless mode can never disagree about authoritative state.

## Acceptance Criteria

1. **Canonical ConversationProjection (AD-2, UX-DR-031).** Given a first conversation is in progress; when any surface renders it; then it consumes a `ConversationProjection` containing `StatusProjection`, `SessionProjection`, `TranscriptTurnProjection[]`, and `ContextProjection` — plain serializable objects with canonical tokens, so Ink, redirected text, and headless JSON render identical fields.

2. **UI never builds its own transcript (AD-2).** Given the UI needs to render the transcript; when it does so; then it reads `TranscriptTurnProjection[]` from `CoreApp.query()` — it never constructs authoritative domain projections itself, and it never imports adapters/fs/network/child_process.

3. **Attributable turns (AD-3).** Given a durable `PromptSubmitted`/`RemoteOutputObserved`/`OperationSucceeded`/`ChatInterrupted` sequence; when the transcript is projected; then each turn carries `promptRoundId`, `role`, `text`, `timestamp`, `interrupted`, and `evidenceComplete` — the UI does not synthesize these.

4. **Surface parity (UX-DR-031).** Given the same projection; when Ink, redirected text, or headless JSON renders it; then canonical tokens (`configured`, `checking`, `available`, `unavailable`, `unhealthy`, `quarantined`, `percentage unavailable`, `Chat interrupted`) remain identical.

## Tasks / Subtasks

- [x] **Task 1: ConversationProjection contract (AC: #1)**
  - [x] 1.1 `cli/src/core/protocol/projections.ts` adds `TranscriptTurnProjection { promptRoundId, role, text, timestamp, interrupted, evidenceComplete }` and `ConversationProjection { status, session, transcript, context }`. All plain serializable objects; no methods; no secrets.
  - [x] 1.2 `StatusProjection.healthState` now includes `unconfigured` (the initial HealthRegistry state) alongside `configured`/`checking`/`available`/`unavailable`/`unhealthy`/`quarantined`.

- [x] **Task 2: CoreApp.query facade (AC: #2, #3)**
  - [x] 2.1 `CoreApp.query()` returns a `ConversationProjection`. The UI calls this — it never builds its own authoritative transcript (AD-2).
  - [x] 2.2 `CoreApp.statusProjection()` returns a `StatusProjection` with canonical tokens. `contextPercent` is a number or `'percentage unavailable'` (UX-DR-031).
  - [x] 2.3 `TranscriptTurnProjection[]` is derived from the in-memory history; the durable journal (Epic 6) will feed the same derivation. The UI does not synthesize turns.

- [x] **Task 3: Ink UI consumes projections (AC: #2)**
  - [x] 3.1 `cli/src/ui/App.tsx` now calls `core.query()` and renders `projection.status` — workMode, permissionProfile, providerId, healthState. The status row shows the health state (UX-DR-023 persistent visibility).
  - [x] 3.2 The UI imports only `CoreApp`, `react`, `ink` — no adapters, fs, network, or child_process (boundary regression test from Story 1.1 still guards this).

- [x] **Task 4: Tests (red-green-refactor) (AC: #1–#4)**
  - [x] 4.1 `cli/test/projections.test.ts` — 5 Vitest cases: `query()` returns a serializable projection with status/session/transcript/context; `statusProjection()` uses canonical tokens (all 7 health states, `percentage unavailable` contract); transcript turns are derived from history not built by UI; the projection is JSON-serializable for Ink/redirected/headless parity; Thai UTF-8 preserved through a simulated turn.
  - [x] 4.2 `npm run build` clean; `npm test` → **170 passed across 16 files** (165 + 5 projections). No regressions.

- [x] **Task 5: File List / Change Log / Status**
  - [x] 5.1 File List, Completion Notes, Change Log updated; Status set to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-2 (CoreApp facade):** `CoreApp.query()` is the sole projection surface. UI uses `dispatch(intent)`, `subscribe`, `query` — it never builds authoritative state. This story adds `query()` returning `ConversationProjection`.
- **AD-3 (canonical envelope):** `TranscriptTurnProjection` is derived from durable events (via the in-memory history today; via journal replay in Epic 6). The `promptRoundId`, `role`, `text`, `timestamp`, `interrupted`, `evidenceComplete` fields are authoritative — the UI renders them, it does not synthesize them.
- **AD-24 (sanitization):** Projections carry no secrets by construction — they're derived from already-sanitized history and typed status fields.
- **UX-DR-023:** Workspace, Work Mode, Permission Profile, health, and context are persistently visible or immediately inspectable. The status row now shows the health state.
- **UX-DR-031:** Canonical state tokens are identical across Ink, redirected text, and headless JSON because they all consume the same serializable projection.

### Project Structure Notes

- `cli/src/core/protocol/projections.ts` gains `TranscriptTurnProjection` and `ConversationProjection`. The unused `HealthState` import was removed (the health-state union is now inlined into `StatusProjection` so `unconfigured` is representable).
- `CoreApp` gains `query()` and `statusProjection()`. The existing `status()` is kept for backward compatibility with the UI's `CoreStatus` type; the canonical projection is `statusProjection()`.
- `cli/src/ui/App.tsx` now calls `core.query()` and renders `projection.status` fields by their canonical names (`workMode`, `permissionProfile`, `healthState`). The boundary regression test (Story 1.1) still guards that UI imports only `react`/`ink`/`core/app.js`.

### Brownfield baseline (post-Story-1.9)

- Tests: **165 passing** across 15 files.
- The UI already rendered a status row and transcript; this story makes it consume the canonical projection rather than the ad-hoc `CoreStatus` shape, so Ink/redirected/headless share one contract.

### Known gaps (do NOT fix in this story)

- The transcript derivation currently uses the in-memory `history` array; the durable journal replay that feeds `TranscriptTurnProjection` with `interrupted`/`evidenceComplete` from real events is wired in Epic 6 (Saved Sessions). The projection contract is in place.
- `enforcementVerified: false` is the honest default; it flips to true when the platform-action enforcement matrix (PR-3) is frozen in Epic 2/3.
- `contextPercent` is currently a number (estimated from history length / 4); PR-4 says it becomes `'percentage unavailable'` when no verified Typhoon context limit exists. The prototype uses the adapter's declared `contextLimit`; the PR-4 rule is enforced when the real verified limit is sourced.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.10] (lines 689–716)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-2, #AD-3, #AD-24]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md#UX-DR-023, #UX-DR-031]
- [Source: cli/src/core/protocol/projections.ts, cli/src/core/app.ts, cli/src/ui/App.tsx]

## Dev Agent Record

### Agent Model Used

glm-5.2 (ollama-cloud)

### Debug Log References

### Completion Notes List

- Added `TranscriptTurnProjection` and `ConversationProjection` to `cli/src/core/protocol/projections.ts`. `StatusProjection.healthState` now includes `unconfigured` (the initial HealthRegistry state) — the union is inlined so all 7 states are representable (AC #1, #4).
- `CoreApp.query()` returns a `ConversationProjection` (status + session + transcript + context). The UI calls this — it never builds its own authoritative transcript (AC #2, AD-2).
- `CoreApp.statusProjection()` returns a `StatusProjection` with canonical tokens; `contextPercent` is a number or `'percentage unavailable'` (UX-DR-031).
- `TranscriptTurnProjection[]` is derived from the in-memory history; each turn carries `promptRoundId`, `role`, `text`, `timestamp`, `interrupted`, `evidenceComplete`. The durable journal replay that feeds these from real events is wired in Epic 6; the projection contract is in place (AC #3).
- `cli/src/ui/App.tsx` now calls `core.query()` and renders `projection.status` by canonical field names (`workMode`, `permissionProfile`, `healthState`). The status row shows the health state (UX-DR-023). The UI still imports only `react`/`ink`/`core/app.js` (boundary regression test guards this).
- Removed the unused `HealthState` import after inlining the union; fixed the `unconfigured` token test expectation.
- Added 5 Vitest cases in `cli/test/projections.test.ts`. Final: `npm run build` clean; `npm test` → **170 passed across 16 files**. No regressions.

### File List

- `cli/src/core/protocol/projections.ts` (modified) — added `TranscriptTurnProjection`, `ConversationProjection`; inlined `healthState` union with `unconfigured`.
- `cli/src/core/app.ts` (modified) — `query()`, `statusProjection()`.
- `cli/src/ui/App.tsx` (modified) — consumes `core.query()`, renders `projection.status` canonical fields + health state.
- `cli/test/projections.test.ts` (new) — 5 Vitest cases.

### Change Log

- 2026-07-17: Story 1.10 implemented — canonical `ConversationProjection`, `CoreApp.query()` facade, UI consumes projections, health state visible. 5 new tests (170 total passing). Build clean. Status → review. Epic 1 complete.

### QC fix 2026-07-17

**QC verdict addressed:** `cli/src/core/providers/typhoon.ts:23` hardcoded `contextLimit: 128_000`, which flowed through `effectiveContextCapacity()` to a fabricated 115,200-token denominator, and `CoreApp.statusProjection()`/`query()` emitted a numeric `contextPercent` rendered by `cli/src/ui/App.tsx` as `Ctx N%` — a PR-4 violation (epics.md Pre-Implementation Gate: no `128k` raw limit or `115,200` fallback capacity is a release commitment without a named provider/product decision and source).

**Fix:**
- `cli/src/core/providers/types.ts` — `ProviderCapabilities.contextLimit` is now `number | null`. `null` is the explicit "unverified" signal; documented inline that consumers must surface `'percentage unavailable'` rather than deriving a numeric percentage from it.
- `cli/src/core/providers/typhoon.ts` — `contextLimit` changed from the literal `128_000` to `null`. No sourced, verified Typhoon context limit exists yet, so the adapter declares none.
- `cli/src/core/context/types.ts` — added `effectiveContextCapacityOrUnavailable(rawLimit: number | null, ...)` and `contextUtilizationPercentOrUnavailable(estimatedTokens, capacity)`, both propagating the literal `'percentage unavailable'` token when the input is `null`/unavailable. The original `effectiveContextCapacity()`/`contextUtilizationPercent()` are unchanged and remain the path used once a verified limit is injected — nothing calls them with the removed `128_000` literal anymore.
- `cli/src/core/app.ts` — `status()`, `statusProjection()`, and `query()` now call the null-aware helpers instead of `effectiveContextCapacity()` directly. `CoreStatus.contextPercent` is now typed `number | 'percentage unavailable'` (was `number`), matching `StatusProjection`/`ContextProjection` which already carried that union.
- `cli/src/ui/App.tsx` — added an exported pure `formatContextPercent(contextPercent)` helper; the status row now renders its output instead of interpolating `Ctx {status.contextPercent}%` directly, so an unverified capacity renders the literal token `percentage unavailable` verbatim rather than `Ctx percentage unavailable%` or any fabricated number.
- `cli/test/providers.test.ts` — replaced the `contextLimit > 0` assumption with a test asserting Typhoon's `contextLimit` is `null` (PR-4).
- `cli/test/context-capacity.test.ts` (new) — 9 Vitest cases proving: (a) `statusProjection()`, `query()`, and legacy `status()` all carry the literal `'percentage unavailable'` token with no numeric percent, and no `128000`/`115200`-derived number appears anywhere in the serialized projection; (b) the UI's `formatContextPercent` renders the literal token verbatim for both a direct call and CoreApp's live Typhoon output — never a fabricated `Ctx N%`; (c) a hypothetical verified-limit adapter (100,000 tokens, deliberately not `128_000`/`115_200`) produces a real numeric percent end to end through `CoreApp`, and the null-aware helpers compute correctly for both the verified and unverified cases directly.
- Build clean; **182 passed across 17 files** (172 baseline + 1 modified assertion in `providers.test.ts` bringing that file to 9 + 9 new in `context-capacity.test.ts`). No regressions.