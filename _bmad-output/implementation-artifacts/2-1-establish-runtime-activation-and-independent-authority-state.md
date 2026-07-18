---
story_id: "2.1"
story_key: "2-1-establish-runtime-activation-and-independent-authority-state"
epic: 2
baseline_commit: 1b28f2e
status: review
created: 2026-07-17
project: thcode
dependsOn: "1-10 (Epic 1 CoreProtocolV1, durable journal, Sanitizer, Typhoon credential boundary, and the first attributable Prompt Round — Epic 2 builds only on these per epics.md's Epic 2 goal statement)"
---

# Story 2.1: Establish Runtime Activation and independent authority state

Status: review

## Story

As a developer
I want Runtime Activation, Work Mode, and Permission Profile to be separate state
so that changing one control cannot silently grant, retain, or imply another authority.

## Acceptance Criteria

1. **Given** thcode starts, a Session is created or opened, a Session is switched, or the Workspace is rebound
   **When** Runtime Activation is established
   **Then** a new activation has a unique activation identity and incremented authority revision, begins in `Manual`, clears Full Access, temporary approvals, transfer consent, and in-flight authority, and records a sanitized durable activation Evidence event before any approval can be requested.
2. **Given** a fresh interactive Runtime Activation is ready
   **When** the initial authority projection is queried
   **Then** Work Mode is `Build`, Permission Profile is `Manual`, and Workspace identity, activation revision, mode, and profile are independently addressable fields; no profile selection changes Work Mode and no mode selection changes Profile.
3. **Given** I select `Plan` or `Build`
   **When** the mode command or equivalent control is accepted at an idle composer
   **Then** only Work Mode changes, the authority revision increments, pending authority is invalidated, the new mode is visible immediately, and `Plan` is structurally read-only under every Profile.
4. **Given** I select `Manual`, `Assisted`, or `Full Access`
   **When** the profile command or equivalent control is accepted
   **Then** only Permission Profile changes, the authority revision increments, pending authority is invalidated, and the projection shows the profile's scope without treating selection as approval, transfer consent, Boundary Expansion, or a health/session/context state.
5. **Given** a Runtime Activation is recreated after process restart or a Workspace identity changes
   **When** old approvals, transfer consents, or Full Access state are encountered
   **Then** they cannot authorize a new operation, while a valid durable Boundary Expansion is merely revalidated and remains separately inspectable rather than silently granting temporary authority.
6. **Given** a mode/profile change is attempted while a prompt is being composed or IME preedit is active
   **When** the input is processed
   **Then** the setting does not change until the composer is idle, preedit and committed bytes remain intact, and `Esc` cancels preedit or an overlay without authorizing or mutating authority.

**Requirements:** FR-21; FR-22; FR-28; NFR-7; NFR-10; UX-DR-023–025, UX-DR-041–050, UX-DR-055–059, UX-DR-071–075, UX-DR-120.

## Tasks / Subtasks

- [x] **Task 1: RuntimeActivation state machine (AC: #1, #2, #5, #6)**
  - [x] 1.1 `cli/src/core/permissions/runtimeActivation.ts` — `RuntimeActivation` class: unique `activationId` (UUID), per-activation `revision` counter starting at 1, `workspaceId`, `mode`/`profile` (fresh default Build+Manual per ADR 0012/0013), `sensitiveTransferOverride`, `composerBusy`, `reason` (`process-start`/`session-create`/`session-open`/`session-switch`/`workspace-rebind`), `createdAt`. Pure in-memory state machine — no fs/network/journal dependency, so it stays trivially unit-testable.
  - [x] 1.2 `setMode`/`setProfile` mutate only their own field, increment `revision`, and are refused (no state change, no revision bump) while `composerBusy` is `true` (AC #6). Selecting the already-active value is a no-op (no spurious revision bump / no fabricated `AuthorityChanged`).
  - [x] 1.3 `authorizes(activationId, revision)` — true only for the exact current activation at the exact current revision; a prior activation's id/revision pair never authorizes the current one, even if the numeric revision happens to coincide (AC #5).
  - [x] 1.4 `activationEstablishedPayload(state)` builds the sanitized `RuntimeActivationEstablished` durable-event payload shape (no secrets — activation id, workspace id, mode, profile, reason only).

- [x] **Task 2: Durable events (AC: #1, #3, #4)**
  - [x] 2.1 `cli/src/core/protocol/events.ts` — added `RuntimeActivationEstablishedPayload` and `AuthorityChangedPayload` to `DurableEventPayload`/`DURABLE_EVENT_KINDS`/the exhaustiveness map. Protocol bumped to `1.2` (additive, backward-compatible — `cli/src/core/protocol/version.ts`).
  - [x] 2.2 `CoreApp` journals `RuntimeActivationEstablished` BEFORE any approval can be requested (it is the very first durable event appended by a fresh activation, from the constructor) and `AuthorityChanged` on every applied `setMode`/`setProfile` mutation, each carrying the new `revision`.

- [x] **Task 3: CoreApp integration (AC: #1, #2, #3, #4, #6)**
  - [x] 3.1 `cli/src/core/app.ts` — `CoreApp` now owns a `RuntimeActivation` instead of raw `mode`/`profile` fields. A fresh activation is established in the constructor (`process-start`) via `establishActivation`, which journals `RuntimeActivationEstablished` when a `SessionRepository` is wired (`CoreAppOptions.repo`, optional — matches the existing Story 1.9 brownfield gap where CoreApp does not yet wire a real repo by default).
  - [x] 3.2 `authorityProjection()` — new canonical `AuthorityProjection` (`cli/src/core/protocol/projections.ts`): `activationId`, `activationRevision`, `workspaceId`, `workMode`, `permissionProfile`, `fullAccess`, `sensitiveTransferOverride`, `activeBoundaryExpansionCount`, `enforcementVerified`. Kept as a separate contract from `StatusProjection` rather than widening it, so existing Epic 1 consumers/tests of `StatusProjection` are unaffected.
  - [x] 3.3 `setMode`/`setProfile` now return `boolean` (whether the mutation actually applied) and delegate to the activation, journaling `AuthorityChanged` on success. `toggleMode()` keeps its existing `WorkMode`-returning signature. `setComposerBusy(busy)` is the new composer-idle gate (AC #6); it defaults to idle so existing callers (`cli/src/ui/App.tsx`, which only calls `setMode`/`toggleMode` at natural idle points) are unaffected without further UI wiring.
  - [x] 3.4 `beginNewActivation(reason, workspaceRoot?)` establishes a fresh activation for Session create/open/switch and Workspace rebind (AC #1, #5) — new `activationId`, reset to Manual, Full Access/override cleared. Durable Boundary Expansions (Story 2.3) are NOT cleared by this call; they are a separately stored, separately revalidated authority per AD-17/AC #5.

- [x] **Task 4: Tests (red-green-refactor) (AC: #1–#6)**
  - [x] 4.1 `cli/test/runtimeActivation.test.ts` — 14 Vitest cases against the pure state machine: unique activation id + revision-1 start, Manual/no-override/composer-idle defaults, sanitized `activationEstablishedPayload`, fresh Build+Manual default with independently addressable fields, mode/profile mutation isolation + revision increment + no-op-on-same-value, sensitive-override clearing on leaving Full Access, stale cross-activation `authorizes()` checks, and the composer-busy refusal/recovery sequence.
  - [x] 4.2 `cli/test/authority-app.test.ts` — 11 Vitest cases (shared with Stories 2.2/2.3) covering the `CoreApp` integration: `RuntimeActivationEstablished` is journaled and durably queryable via `SessionRepository` before the projection is even read; the fresh projection's independence; `setMode`/`setProfile` journal `AuthorityChanged` with the correct field/value/revision and leave the other field untouched; composer-busy refusal at the `CoreApp` level; `beginNewActivation` producing a new `activationId` and resetting authority; workspace rebind changing `workspaceId`.
  - [x] 4.3 `npm run build` clean; `npx vitest run` → **243 passed across 21 files** (186 baseline after the Story 1.9/1.10 QC fixes + 14 + 21 [`pep.test.ts`/`boundary.test.ts`, landed together with Stories 2.2/2.3] + 11 + tests from 2.2/2.3 — see those stories' File Lists for the exact split). No regressions.

- [x] **Task 5: File List / Change Log / Status**
  - [x] 5.1 File List, Completion Notes, Change Log updated; Status set to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-22 (fresh, session/workspace-bound authority):** A new Runtime Activation is created on process start, Session create/open/switch, and Workspace rebind. It starts at Manual with no temporary approval or transfer consent. Every authority mutation increments the activation's revision; `authorizes()` is the atomic revalidation primitive the PEP (Story 2.2) will consult immediately before effect start.
- **AD-17 (independent authority dimensions):** Work Mode, Permission Profile, operation approval, transfer consent, and Boundary Expansion are evaluated independently. This story implements the first two as genuinely separate fields with independent mutators; it does not implement operation approval (Story 2.4) or the transfer-consent contract (Story 2.6) — those remain future extension points, consistent with the Epic 2 goal statement's explicit scope boundary.
- **ADR 0012 / ADR 0013:** Fresh Session default is Build + Manual. Plan Mode's structural read-only guarantee is enforced by the PEP (Story 2.2, `policy.ts`'s existing `plan-mode-is-read-only` rule), not by `RuntimeActivation` itself — this story only guarantees Work Mode changes independently of Profile so that guarantee has a stable input to consult.
- **AD-3 (canonical envelope):** `RuntimeActivationEstablished`/`AuthorityChanged` are ordinary `DurableEvent`s built with the existing `durableEvent` helper from `agent/dispatch.ts` (reused, not forked) and appended via the existing `SessionRepository`.

### Project Structure Notes

- New code: `cli/src/core/permissions/runtimeActivation.ts` — pure state machine, zero IO. `CoreApp` (`cli/src/core/app.ts`) is the sole owner of a live `RuntimeActivation` instance and the sole place that journals its transitions, per AD-2 (CoreApp is the sole UI-facing facade).
- `cli/src/core/protocol/projections.ts` gained `AuthorityProjection` as a new, additive contract rather than widening `StatusProjection` — this avoids destabilizing the frozen Epic 1 `StatusProjection` shape that `cli/test/protocol.test.ts` type-checks structurally.
- `cli/src/core/protocol/events.ts` / `version.ts` — protocol bumped 1.1 → 1.2 (additive; `PROTOCOL_MAJOR` unchanged, so `assertCompatibleVersion`'s fail-closed startup check, AD-2, is unaffected).

### Brownfield baseline (post Story 1.9/1.10 QC fixes)

- Tests: **186 passing** across 17 files (172 original baseline + 9 PR-4 context-capacity tests + 1 modified Typhoon-capability assertion + 4 NormalizedIntent-evidence tests).
- `CoreApp` previously held raw `private mode`/`private profile` fields with no activation identity, no revision, and no durable record of mode/profile changes. This story replaces that with `RuntimeActivation` while preserving the existing `setMode`/`toggleMode`/`setProfile` call sites in `cli/src/ui/App.tsx` (their signatures are backward compatible — `setMode`/`setProfile` gained a `boolean` return value that existing callers simply don't consume).

### Known gaps (do NOT fix in this story — explicitly out of Epic 2's stated scope or a later story)

- **IME preedit UI wiring is not implemented.** AC #6's composer-idle guard is implemented and tested at the `CoreApp`/`RuntimeActivation` level (`setComposerBusy`, refusal while busy). The Ink UI (`cli/src/ui/App.tsx`) does not yet call `setComposerBusy` around real IME preedit/composer lifecycle events — Ink's current input handling in this brownfield prototype has no IME preedit concept wired up at all (no preedit state exists anywhere in `App.tsx` to hook), and building that harness is a UI-layer feature substantially larger than this backend authority story. This is flagged, not silently reinterpreted: the CORE contract (refuse mutation while composer busy) is real and tested; the UI trigger for it is a gap.
- **Boundary Expansion revalidation on activation recreation** (AC #5's "a valid durable Boundary Expansion is merely revalidated") is implemented as "not cleared by `beginNewActivation`" plus the `revalidateBoundary` primitive from Story 2.3 — full automatic re-revalidation against a rebound workspace on every activation switch is not wired as an automatic side effect of `beginNewActivation`; the caller must invoke `revalidateBoundary` explicitly. This matches Epic 2's stated scope (it "establishes authority and observability contracts" — full checkpoint/rollback and mutation-effect wiring is Epic 3).
- Operation approval binding (Story 2.4) and remote-transfer consent (Story 2.6) are NOT implemented — `sensitiveTransferOverride` exists as a field or Full Access to layer onto, but nothing in Epic 2 yet grants it; that is out of this story's and this task's assigned scope (only 2.1–2.3 were requested).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.1] (lines 722–749)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-17, #AD-22, #AD-2, #AD-3]
- [Source: cli/src/core/permissions/runtimeActivation.ts, cli/src/core/app.ts, cli/src/core/protocol/events.ts, cli/src/core/protocol/projections.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

### Completion Notes List

- Implemented `cli/src/core/permissions/runtimeActivation.ts`: `RuntimeActivation` (pure state machine), `activationEstablishedPayload`. Unique `activationId` per instance; `revision` starts at 1 and increments only on an applied `setMode`/`setProfile`; `authorizes(id, revision)` is the stale-authority check consumed conceptually by AC #5 (a prior activation's id can never match the current one).
- Extended `cli/src/core/protocol/events.ts` with `RuntimeActivationEstablishedPayload`/`AuthorityChangedPayload` (plus Story 2.2/2.3's payloads, landed together) and bumped `cli/src/core/protocol/version.ts` to `1.2` (additive).
- `cli/src/core/app.ts`: `CoreApp` now owns `RuntimeActivation` + `AuthorityProjection`; constructor establishes a `process-start` activation and journals it before returning; `setMode`/`setProfile`/`setComposerBusy`/`beginNewActivation` wired with durable `AuthorityChanged` journaling.
- Added `cli/src/core/protocol/projections.ts#AuthorityProjection` as a new, additive projection.
- 14 new Vitest cases in `cli/test/runtimeActivation.test.ts`; CoreApp integration covered by the shared `cli/test/authority-app.test.ts` (11 cases spanning Stories 2.1–2.3). Final combined suite (with Stories 2.2/2.3 landed together): `npm run build` clean; `npx vitest run` → **243 passed across 21 files**. No regressions.

### File List

- `cli/src/core/permissions/runtimeActivation.ts` (new) — `RuntimeActivation`, `RuntimeActivationState`, `activationEstablishedPayload`, `ActivationReason`.
- `cli/src/core/protocol/events.ts` (modified) — `RuntimeActivationEstablishedPayload`, `AuthorityChangedPayload` (+ Story 2.2/2.3 payloads).
- `cli/src/core/protocol/version.ts` (modified) — `PROTOCOL_MINOR` 1 → 2.
- `cli/src/core/protocol/projections.ts` (modified) — new `AuthorityProjection`.
- `cli/src/core/app.ts` (modified) — `RuntimeActivation` integration, `authorityProjection()`, `setComposerBusy`, `beginNewActivation`, durable `AuthorityChanged` journaling (+ Story 2.2/2.3 methods, landed together).
- `cli/test/runtimeActivation.test.ts` (new) — 14 Vitest cases.
- `cli/test/authority-app.test.ts` (new, shared with 2.2/2.3) — 11 Vitest cases.

### Change Log

- 2026-07-17: Story 2.1 implemented — `RuntimeActivation` state machine, durable `RuntimeActivationEstablished`/`AuthorityChanged` events, `CoreApp` integration with a new `AuthorityProjection`, composer-busy mutation guard. Landed together with Stories 2.2 and 2.3 against a shared `CoreApp` integration test file. Build clean; 243 tests passing across 21 files. Status → review.
