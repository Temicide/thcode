---
story_id: "2.2"
story_key: "2-2-implement-the-versioned-permissionmatrix-and-local-policy-enforcement-point"
epic: 2
baseline_commit: 1b28f2e
status: review
created: 2026-07-17
project: thcode
dependsOn: "2-1 (Runtime Activation supplies the mode/profile/activation-revision inputs the PEP decides against); PR-3 (the platform/action enforcement matrix — referenced structurally as the `ENFORCEMENT UNVERIFIED` fail-closed path when a required capability is unavailable/unverified; not consumed for real platform effect until Epic 3, matching Story 1.1's precedent for PR-3)"
---

# Story 2.2: Implement the versioned PermissionMatrix and local Policy Enforcement Point

Status: review

## Story

As a developer
I want one versioned policy decision point to evaluate every proposed effect
so that profiles and modes have deterministic, testable behavior and unknown actions fail closed.

## Acceptance Criteria

1. **Given** the authority package is built
   **When** a `PermissionMatrix` is loaded
   **Then** its version and decision inputs are explicit: action class, Work Mode, Permission Profile, risk/sensitivity, Workspace/boundary state, activation revision, and applicable consent or expansion state; each result is exactly `allow`, `ask`, or `deny` with a sanitized reason and policy version.
2. **Given** the same action class and authority inputs are evaluated twice
   **When** the authority revision and policy version are unchanged
   **Then** the decision and reason are deterministic, attributable to the exact matrix version, and do not depend on UI wording, provider output, or an adapter-local rule.
3. **Given** Work Mode is `Plan`
   **When** any mutation, deletion, command, or other effect proposal is evaluated under Manual, Assisted, or Full Access
   **Then** the PEP returns `deny` with a read-only boundary reason and no approval control can convert it to `allow`.
4. **Given** an unknown, malformed, unsupported, or policy-incomplete action class is evaluated
   **When** the PEP receives the proposal
   **Then** it returns `deny`/`not-authoritative`, emits sanitized deterministic Evidence, and does not infer a safer class, repair the proposal, invoke a provider, or reach an effect adapter.
5. **Given** an eligible non-sensitive read/list/search proposal is evaluated in Build mode
   **When** Manual, Assisted, and Full Access decisions are requested
   **Then** at least one governed action exhibits the defined profile behavior: Manual may `ask` when policy requires, Assisted applies the deterministic matrix and asks on uncertainty, and Full Access suppresses only eligible prompts within declared boundaries; the result is observable in the authority projection and activity Evidence.
6. **Given** an effect proposal is accepted by CoreApp
   **When** the PEP evaluates it
   **Then** only the local PEP-owned effect executor may receive the resulting authorization or a denied/asked decision; UI, Typhoon, remote output, and concrete adapters cannot authorize or invoke effects directly.
7. **Given** the platform/action enforcement capability required by a matrix entry is unavailable or unverified
   **When** policy evaluation occurs
   **Then** the PEP fails closed with `ENFORCEMENT UNVERIFIED`, a stable reason code, and a remediation/inspection next step rather than claiming a permissive decision.

**Requirements:** FR-21; FR-22; FR-24; NFR-3; NFR-7; NFR-13; AD-1; AD-2; AD-14; UX-DR-005, UX-DR-023–024, UX-DR-071–075, UX-DR-120.

## Tasks / Subtasks

- [x] **Task 1: Versioned PermissionMatrix (AC: #1, #4)**
  - [x] 1.1 `cli/src/core/permissions/matrix.ts` — `PERMISSION_MATRIX_VERSION = 1`; `ActionClassDefinition` (`actionClass`, `mutating`, `sensitive`, `risk`, optional `requiresEnforcementCapability`); a reviewed registry of the Release-1-floor action classes (`read_file`, `list_dir`, `search`, `write_file`, `delete`, `run_command`, `transfer`). `lookupActionClass(actionClass)` returns `undefined` for anything not in the registry — the explicit "unknown" signal Task 2 fails closed on.
  - [x] 1.2 Canonical non-affirmative tokens `ENFORCEMENT_UNVERIFIED = 'ENFORCEMENT UNVERIFIED'` and `BUDGET_NOT_SET = 'budget not set'` defined once here and reused (not reinvented) by `pep.ts` and `boundary.ts` (Story 2.3).

- [x] **Task 2: PolicyEnforcementPoint (AC: #1–#5, #7)**
  - [x] 2.1 `cli/src/core/permissions/pep.ts` — `PolicyEnforcementPoint.evaluate(input)`: unknown action class → `deny`/`unknown-action-class-not-authoritative` (AC #4); required enforcement capability unavailable → `deny`/`ENFORCEMENT UNVERIFIED` (AC #7); otherwise delegates to the existing `evaluatePermission` (`policy.ts`, unmodified — reused, not forked) for the mode/profile/sensitivity matrix, which already encodes Plan-mode-is-structurally-read-only-under-every-profile (AC #3) and the Manual/Assisted/Full-Access behavior (AC #5).
  - [x] 2.2 `evaluate` is pure — same `{ actionClass, PolicyState, activationRevision, enforcementAvailable }` always produces the same `{ outcome, reason, matrixVersion, activationRevision, actionClass }` (AC #2). No UI wording, provider output, or adapter-local rule feeds the decision.

- [x] **Task 3: Sole effect-authorization surface (AC: #6)**
  - [x] 3.1 `EffectExecutor.authorize(input)` is the ONLY sanctioned path from a PEP decision to permission-to-run: it evaluates via the PEP and throws `EffectNotAuthorizedError` for any non-`allow` outcome (including `ask`, which still requires the separate approval-binding flow of Story 2.4 — out of this story's scope — before it could ever become an authorization). Callers are structurally steered away from evaluating the PEP themselves and branching on `outcome === 'allow'` to invoke an adapter directly.
  - [x] 3.2 `CoreApp.authorizeEffect(actionClass, opts)` is the only `CoreApp` method that returns an authorization suitable for driving an effect; `CoreApp.evaluateEffect(actionClass, opts)` is the separate, non-authorizing inspection/observability path that journals `PolicyDecisionRecorded` (AC #5) without granting anything.

- [x] **Task 4: Durable Evidence (AC: #5)**
  - [x] 4.1 `cli/src/core/protocol/events.ts` — `PolicyDecisionRecordedPayload` (`operationId`, `actionClass`, `outcome`, `reason`, `matrixVersion`, `activationRevision`), added to `DurableEventPayload`/`DURABLE_EVENT_KINDS` (protocol 1.2, landed with Story 2.1's bump).
  - [x] 4.2 `CoreApp.evaluateEffect` appends `PolicyDecisionRecorded` via the existing `durableEvent` builder + `SessionRepository` when a repo is wired, so a governed action's profile behavior is durably observable, not just returned in memory.

- [x] **Task 5: Tests (red-green-refactor) (AC: #1–#7)**
  - [x] 5.1 `cli/test/pep.test.ts` — 11 Vitest cases: matrix version + explicit action-class attributes (AC #1); identical-input determinism (AC #2); Plan+every-profile denial including Plan+Full-Access (AC #3); unknown action class denial with the exact `not-authoritative` reason (AC #4); Manual/Assisted/Full-Access profile behavior for both a read and a mutating action class (AC #5); `EffectExecutor` authorizing `allow` and throwing `EffectNotAuthorizedError` for `deny`/`ask` (AC #6); `ENFORCEMENT UNVERIFIED` fail-closed for a capability-requiring class, and unaffected behavior for a class with no such requirement (AC #7).
  - [x] 5.2 `cli/test/authority-app.test.ts` — `CoreApp.evaluateEffect`/`authorizeEffect` integration cases (durable `PolicyDecisionRecorded`, `authorizeEffect` throwing then succeeding after a profile change) — shared file with Stories 2.1/2.3.
  - [x] 5.3 `npm run build` clean; `npx vitest run` → **243 passed across 21 files**. No regressions.

- [x] **Task 6: File List / Change Log / Status**
  - [x] 6.1 File List, Completion Notes, Change Log updated; Status set to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-12 (fail-closed enforcement matrix):** This story does NOT define the Release-1 platform/action enforcement matrix itself (that is PR-3, approved before Epic 3, per epics.md's Pre-Implementation Gate). It defines the PEP's own reaction when a matrix entry's required capability is asserted unavailable: fail closed with the literal `ENFORCEMENT UNVERIFIED` token, never a permissive decision. `enforcementAvailable` is caller-supplied (defaults to available for capability-free action classes) because Epic 2 has no platform adapter of its own to probe — that wiring is Epic 3's.
- **AD-14 (no silent fallback):** An unknown action class is `deny`, never guessed into a known one; the PEP does not "helpfully" reinterpret a malformed proposal.
- **AD-2 (CoreApp sole facade) / AD-1 (hexagonal core):** `matrix.ts` and `pep.ts` have zero fs/network/journal/UI imports — pure domain logic, consistent with the existing `policy.ts` this story extends rather than forks. `CoreApp` is the only integration point that adds journaling.
- **Reused, not forked:** `evaluatePermission` (`cli/src/core/permissions/policy.ts`) already implemented the Plan-read-only / sensitive-ask / profile-driven matrix from Stories predating Epic 2. This story wraps it with action-class lookup, unknown-class fail-closed, and enforcement fail-closed, rather than duplicating its logic.

### Project Structure Notes

- New code: `cli/src/core/permissions/matrix.ts`, `cli/src/core/permissions/pep.ts`. Both are pure `permissions/` domain modules alongside the existing `policy.ts`/`types.ts`.
- `CoreApp` (`cli/src/core/app.ts`) owns one `PolicyEnforcementPoint` instance and one `EffectExecutor` wrapping it — "one local PEP" per AD-12's binding statement.
- Story 2.4 (operation-authorization binding to exact proposals/digests) and Story 2.6 (remote-transfer consent) are explicitly out of this story's and this task's scope — `EffectExecutor.authorize` treats `ask` as not-yet-authorized rather than implementing the approval-binding flow that would eventually turn an `ask` into an `allow`.

### Brownfield baseline

- Landed together with Stories 2.1 and 2.3 against the Epic 1 baseline of 186 passing tests across 17 files (see Story 2.1's Dev Notes for that baseline's composition).

### Known gaps (do NOT fix in this story)

- **Real platform-enforcement probing is not implemented.** `enforcementAvailable` is a caller-supplied boolean (test/integration affordance); no adapter in this codebase yet asks the OS "is filesystem-write enforceable here." That capability arrives with Epic 3's platform adapters, consuming the already-approved PR-3 matrix — this story's job was only to make the PEP react correctly (fail closed) once that signal exists, which is tested directly.
- **Consent/expansion state (AC #1's "applicable consent or expansion state")** is included as an input concept but is only wired through as far as Story 2.3's Boundary Expansion registry currently reaches; the full transfer-consent contract (Story 2.6) is not implemented — out of this task's assigned scope (only 2.1–2.3).
- **Operation approval binding (Story 2.4)** — an `ask` decision from the PEP does not yet produce a bound, one-shot authorization record; that is Story 2.4's job. `EffectExecutor` correctly refuses to treat `ask` as authorization in the meantime rather than fabricating one.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.2] (lines 751–781)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-12, #AD-14, #AD-2, #AD-1]
- [Source: cli/src/core/permissions/policy.ts, cli/src/core/permissions/matrix.ts, cli/src/core/permissions/pep.ts, cli/src/core/app.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

### Completion Notes List

- Implemented `cli/src/core/permissions/matrix.ts`: versioned action-class registry (`PERMISSION_MATRIX_VERSION = 1`), canonical `ENFORCEMENT_UNVERIFIED`/`BUDGET_NOT_SET` tokens.
- Implemented `cli/src/core/permissions/pep.ts`: `PolicyEnforcementPoint` (deterministic, reuses `evaluatePermission`), `EffectExecutor` (sole authorization surface, throws `EffectNotAuthorizedError` for non-`allow`).
- `CoreApp.evaluateEffect`/`authorizeEffect` wired with durable `PolicyDecisionRecorded` journaling on the inspection path.
- 11 new Vitest cases in `cli/test/pep.test.ts` covering every AC; shared `cli/test/authority-app.test.ts` cases cover the `CoreApp` integration. Final combined suite: `npm run build` clean; `npx vitest run` → **243 passed across 21 files**. No regressions.

### File List

- `cli/src/core/permissions/matrix.ts` (new) — `PERMISSION_MATRIX_VERSION`, `ActionClassDefinition`, `lookupActionClass`, `knownActionClasses`, `ENFORCEMENT_UNVERIFIED`, `BUDGET_NOT_SET`.
- `cli/src/core/permissions/pep.ts` (new) — `PolicyEnforcementPoint`, `pep` singleton, `EffectExecutor`, `EffectNotAuthorizedError`, `PepInput`, `PepDecision`.
- `cli/src/core/protocol/events.ts` (modified) — `PolicyDecisionRecordedPayload` (landed with Story 2.1's protocol bump).
- `cli/src/core/app.ts` (modified) — `evaluateEffect`, `authorizeEffect` (landed with Story 2.1/2.3's `CoreApp` changes).
- `cli/test/pep.test.ts` (new) — 11 Vitest cases.
- `cli/test/authority-app.test.ts` (new, shared with 2.1/2.3) — includes the `evaluateEffect`/`authorizeEffect` integration cases.

### Change Log

- 2026-07-17: Story 2.2 implemented — versioned `PermissionMatrix`, deterministic local `PolicyEnforcementPoint`, `ENFORCEMENT UNVERIFIED` fail-closed path, `EffectExecutor` as the sole effect-authorization surface, durable `PolicyDecisionRecorded` Evidence. Landed together with Stories 2.1 and 2.3. Build clean; 243 tests passing across 21 files. Status → review.
