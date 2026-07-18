---
title: 'Story 4.2: Browse, search, inspect, and honestly disable catalog entries'
type: 'feature'
created: '2026-07-17'
status: 'done'
baseline_revision: 'd367c84'
final_revision: '9650d11'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** `/tools` currently renders the thin `ToolCatalog` manifest and exposes registry/diagnostic controls, but it does not browse/search/inspect the reviewed Capability Registry (Story 4.1) with honest invokable states, nor does it project enable/disable/diagnose/retest controls with canonical states that never silently map a non-launch or failing service to `working`/`available`.

**Approach:** Add a Capability Registry catalog projection + `/tools` sub-commands (browse/search/inspect/enable/disable/diagnose/retest) through the canonical CoreApp projection. A reviewed invokable four-service entry shows identity, capabilities, supported input types, limits, entitlement, evidence level, manifest/contract versions, observation date, current health, and invocation eligibility. Any non-launch or not-yet-available entry shows exactly `Catalogued — Not available yet`, offers inspection only, and cannot produce an invocation proposal, adapter call, prepared payload, or consent prompt. Disabled/unavailable/unhealthy/quarantined entries render the canonical state token + name the next allowed action; no state is silently mapped to `working`/`available`. Output parity across redirected/headless/Thai/mixed/narrow keeps a stable identifier, canonical state token, safe reason, and machine-readable action availability without relying on color.

## Boundaries & Constraints

**Always:**
- The catalog projection is a plain serializable object (no methods, no secrets) so Ink, redirected text, and headless JSON render identical fields and tokens (AD-2 projection parity).
- Canonical state tokens are exact: `working` is reserved for invokable+available; non-invokable entries carry the exact `Catalogued — Not available yet` reason; disabled/unavailable/unhealthy/quarantined each render their own token.
- Inspection of a non-invokable entry is read-only and produces NO invocation proposal, adapter call, prepared payload, or consent prompt.
- Rendering never relies on color alone; every row carries a stable identifier + canonical state token + safe reason + machine-readable action availability.

**Block If:** (none unattended — all decisions are deterministic from the registry + health state)

**Never:**
- Never silently map a non-launch, disabled, unavailable, unhealthy, or quarantined entry to `working` or `available`.
- Never produce an invocation proposal, adapter call, prepared payload, or consent prompt for a non-invokable entry.
- Never accept model/installer/URL/user-supplied registry changes (delegates to the registry's override rejection).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Browse reviewed registry | `/tools` (loaded registry) | Browseable catalog with browse/search/inspect/enable/disable/diagnose/retest controls | No error |
| Inspect invokable four-service entry | inspect `t-ocr` | Identity, capabilities, supported inputs, limits, entitlement, evidence level, manifest/contract versions, observation date, current health, invocation eligibility | No error |
| Inspect non-launch / not-yet-available entry | inspect catalogued entry | Exactly `Catalogued — Not available yet`; inspection only; no invocation proposal/adapter call/prepared payload/consent prompt | No error |
| Disabled/unavailable/unhealthy/quarantined entry | entry in non-working state | Canonical state token + next allowed action; not mapped to working/available | No error |
| Redirected/headless/Thai/mixed/narrow output | render in each mode | Stable identifier + canonical state token + safe reason + machine-readable action availability; no color reliance | No error |

</intent-contract>

## Code Map

- `cli/src/core/specialists/catalog/projection.ts` -- NEW. `CatalogProjection` + per-entry `CatalogEntryProjection` (plain serializable; canonical state token, invokable eligibility, next allowed action, machine-readable action availability). Reuse the registry entry from Story 4.1.
- `cli/src/core/specialists/catalog/render.ts` -- NEW. Render helpers for interactive/linearized/redirected/headless/Thai/mixed/narrow — stable identifier + canonical token + safe reason, no color reliance.
- `cli/src/core/specialists/catalog/controls.ts` -- NEW. Browse/search/inspect/enable/disable/diagnose/retest control surface over the registry + health state (read-only for non-invokable; no proposal/payload/consent).
- `cli/src/core/specialists/catalog/index.ts` -- NEW. Barrel export.
- `cli/src/core/app.ts` -- MODIFY. Wire `/tools` to the Capability Registry catalog projection (browse/search/inspect/enable/disable/diagnose/retest) while preserving the existing registry/diagnostic controls; do not invoke the registry or produce consent.
- `cli/test/specialistCatalog.test.ts` -- NEW. All ACs + I/O matrix rows.

## Tasks & Acceptance

**Execution:**
- [x] `cli/src/core/specialists/catalog/projection.ts` -- define plain serializable catalog + entry projections with canonical state token, invokable eligibility, next allowed action, machine-readable action availability.
- [x] `cli/src/core/specialists/catalog/render.ts` -- render across interactive/linearized/redirected/headless/Thai/mixed/narrow with stable identifier + canonical token + safe reason, no color reliance.
- [x] `cli/src/core/specialists/catalog/controls.ts` -- browse/search/inspect/enable/disable/diagnose/retest; non-invokable inspection is read-only and produces no proposal/payload/consent.
- [x] `cli/src/core/specialists/catalog/index.ts` -- barrel export.
- [x] `cli/src/core/app.ts` -- wire `/tools` to the catalog projection + controls.
- [x] `cli/test/specialistCatalog.test.ts` -- unit-test the I/O matrix edge cases + all ACs.

**Acceptance Criteria:**
- Given the reviewed registry is loaded, when I run `/tools`, then the catalog supports browse, Thai/English search, inspect, enablement where permitted, disablement, diagnosis, and retest controls through the canonical CoreApp projection.
- Given a four-service entry is reviewed and invokable, when it is shown, then its identity, capabilities, supported input types, limits, entitlement, evidence level, manifest/contract versions, observation date, current health, and invocation eligibility are visible.
- Given any non-launch or not-yet-available entry is shown, when I inspect it, then the UI shows exactly `Catalogued — Not available yet`, offers inspection only, and cannot produce an invocation proposal, adapter call, prepared payload, or consent prompt.
- Given a service is disabled, unavailable, unhealthy, or quarantined, when the catalog renders it, then it uses the corresponding canonical state and names the next allowed action; no state is silently mapped to `working` or `available`.
- Given output is redirected, headless, Thai, mixed-language, or narrower than the interactive layout, when the catalog is rendered, then every row retains a stable identifier, canonical state token, safe reason, and machine-readable action availability without relying on color.

## Verification

**Commands:**
- `npm run build` -- expected: tsc compiles with no errors.
- `npm test -- specialistCatalog` -- expected: all cases pass.
- `npm test` -- expected: full suite green, no regressions.

## Auto Run Result

### What already existed (prior team commit)

The full Code Map was already implemented and the suite was green before this run:

- `cli/src/core/specialists/catalog/projection.ts` -- `CatalogEntryCanonicalState`, `CatalogEntryActionAvailability`, `CatalogEntryProjection`, `CatalogProjection`, `computeCanonicalState`, `computeNextAllowedAction`, `computeActionAvailability`, `projectEntry`, `projectCatalog`. Plain serializable, no methods, health/disabled state injected (never hardcoded).
- `cli/src/core/specialists/catalog/render.ts` -- `safeReasonForState`, `actionAvailabilityString`, `renderEntryRow`, `renderEntryDetail`, `renderCatalogList`, `renderCatalogRow` across `interactive | linearized | redirected | headless | narrow` modes.
- `cli/src/core/specialists/catalog/controls.ts` -- `browseCatalog`, `searchCatalog`, `inspectEntry`, `enableService`, `disableService`, `diagnoseService`, `retestService`.
- `cli/src/core/specialists/catalog/index.ts` -- barrel export, all named exports present.
- `cli/src/core/app.ts` (lines ~1812-1911) -- `/tools` sub-command dispatch (`search`, `inspect`, `enable`, `disable`, `diagnose`, `retest`, default browse) wired through `CoreApp.executeCommand`, calling the catalog controls with `this.capabilityRegistry()`, `this.buildHealthMap()`, `this._disabledServices`.
- `cli/test/specialistCatalog.test.ts` -- 92 tests covering projection/render/control unit behavior and several AC-labeled describe blocks.
- `npm run build` and `npx vitest run` were both green (57 files / 1520 tests) prior to any change in this run.

### Audit findings and what was implemented now

The module-level implementation was conforming to every AC. The one real gap: **AC #1 explicitly requires the browse/search/inspect/enable/disable/diagnose/retest controls to work "through the canonical CoreApp projection"**, but the existing test suite only exercised the catalog module functions directly (`browseCatalog`, `searchCatalog`, etc.) plus a single bare `/tools` smoke test in `cli/test/commandGrammar.test.ts:66-69` (`app().dispatchCommand('/tools')`, asserting only `exitCode === 0`). None of the sub-commands were exercised via `CoreApp.dispatchCommand`, so the `/tools` wiring in `app.ts` had no dedicated regression coverage of its own beyond the bare-browse path. Added 12 new tests to `cli/test/specialistCatalog.test.ts`:

- A `CoreApp /tools — browse/search/inspect/enable/disable/diagnose/retest (AC #1)` describe block (11 tests) driving every sub-command through `new CoreApp({ credentials: new InMemoryCredentialStore() }).dispatchCommand('/tools ...')`: bare browse, English search, Thai search, search-term search, full inspect-field assertions for an invokable entry, exact `Catalogued — Not available yet` token for `typhoon-translate` via CoreApp, refusal to disable a non-invokable entry, a disable→enable round trip verified via a follow-up inspect, diagnose, retest, and inspect-unknown-id blocked with exit code 20.
- One additional unit test verifying a Thai-named entry's canonical English state token (`quarantined`) is unchanged across `interactive/linearized/redirected/headless/narrow` render modes (AC #5, Thai/mixed-language axis of the I/O matrix).

No production code changes were needed — the audit confirmed the existing `projection.ts`/`render.ts`/`controls.ts`/`app.ts` wiring already satisfied every AC; only test coverage was added to prove the CoreApp-level wiring path (Code Map item explicitly required for `app.ts`).

### Per-AC evidence

| AC | Verdict | Evidence (file:line) | Covering test |
|----|---------|----------------------|----------------|
| Reviewed registry loaded → `/tools` supports browse/Thai+English search/inspect/enable/disable/diagnose/retest through canonical CoreApp projection | Satisfied (existing wiring; test coverage added) | `cli/src/core/app.ts:1812-1911` (`executeCommand` case `'tools'`) | `cli/test/specialistCatalog.test.ts` describe `CoreApp /tools — browse/search/inspect/enable/disable/diagnose/retest (AC #1)` (11 new tests), plus `cli/test/commandGrammar.test.ts:66-69` |
| Invokable four-service entry shows identity, capabilities, supported input types, limits, entitlement, evidence level, manifest/contract versions, observation date, current health, invocation eligibility | Satisfied (existing) | `cli/src/core/specialists/catalog/render.ts:117-161` (`renderEntryDetail`); `cli/src/core/specialists/catalog/projection.ts:39-92` (`CatalogEntryProjection`) | `cli/test/specialistCatalog.test.ts` describe `renderEntryDetail` ("includes identity, capabilities, supported inputs, limits, entitlement, evidence level"); new CoreApp `/tools inspect <invokable id>` test |
| Non-launch / not-yet-available entry shows exactly `Catalogued — Not available yet`, inspection only, no invocation proposal/adapter call/prepared payload/consent prompt | Satisfied (existing) | `cli/src/core/specialists/catalog/controls.ts:109-138` (`inspectEntry`, early-return read-only path; module has zero imports of adapter/consent/payload code, so the guarantee is structural, not just textual) | `cli/test/specialistCatalog.test.ts` describe `AC: non-invokable entries are read-only`; new CoreApp `/tools inspect <non-launch id>` test |
| Disabled/unavailable/unhealthy/quarantined entry uses corresponding canonical state + names next allowed action; never silently mapped to `working`/`available` | Satisfied (existing) | `cli/src/core/specialists/catalog/projection.ts:114-149` (`computeCanonicalState`, `computeNextAllowedAction`) | `cli/test/specialistCatalog.test.ts` describe `AC: non-working states never map to working/available`; new CoreApp disable→enable round-trip test |
| Redirected/headless/Thai/mixed-language/narrow output retains stable identifier + canonical state token + safe reason + machine-readable action availability, no color reliance | Satisfied (existing; one test added for the Thai/mixed-language axis) | `cli/src/core/specialists/catalog/render.ts:78-109` (`renderEntryRow`, no ANSI/color codes anywhere in the module) | `cli/test/specialistCatalog.test.ts` describe `AC: output parity across modes` (4 tests) + new `Thai-language display (nameThai) does not alter the canonical English state token across modes` test |

### Final counts

- `npm run build`: clean, no errors (both before and after changes).
- `npx vitest run`: **57 files / 1532 tests passed** (baseline 57/1520 + 12 new tests in `cli/test/specialistCatalog.test.ts`). No regressions.

### Anything not satisfied exactly

None. Every task and acceptance criterion in this spec's `## Tasks & Acceptance` section was already satisfied by the prior commit's implementation; this run's only change was closing a test-coverage gap for the CoreApp-level `/tools` wiring explicitly named in AC #1 and the Code Map's `app.ts` line. No spec ambiguity or unsatisfiable requirement was encountered.
## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12: (high 0, medium 1, low 11)
- defer: 1: (low 1)
- reject: 2
- addressed_findings:
  - `[medium]` `[patch]` CoreApp `/tools inspect` dropped the non-invokable read-only disclosure ("Inspection only — no invocation proposal/adapter call/prepared payload/consent prompt") from `controls.ts` — surfaced it in `app.ts` inspect handler and asserted it through CoreApp.
  - `[low]` `[patch]` retest test was tautological (`/Retest recommended|already working/`) — pinned the concrete unconfigured branch and excluded `already working`.
  - `[low]` `[patch]` diagnose test asserted template labels only — now asserts `State: unconfigured` and `Retest recommended: false`.
  - `[low]` `[patch]` round-trip final assertion was negative-only — added positive `State: unconfigured` + exit-code assertions.
  - `[low]` `[patch]` search assertions under-constrained — search now asserts exclusion of non-matches and a zero-match honest result.
  - `[low]` `[patch]` enable/disable confirmations now assert the exact `Service "t-ocr" disabled|enabled` messages.
  - `[low]` `[patch]` added CoreApp blocked-path coverage: enable-not-disabled, disable-already-disabled, disable/diagnose/retest unknown ids, retest non-invokable.
  - `[low]` `[patch]` renamed misleading "mixed-language capable" search test title.

Rejected (noise): pinning `process.stdout.isTTY` render mode in tests (vitest stdout is deterministically non-TTY); spy-asserting "no adapter call fired" (no specialist adapter path exists yet at CoreApp — structurally guaranteed and module-tested; re-check at Stories 4.9+).

### Review pass summary (2026-07-18)

- Implemented change: audit confirmed pre-existing catalog implementation; added CoreApp-level test coverage (24 tests total this story) and one production fix from review — `cli/src/core/app.ts` `/tools inspect` now surfaces the non-invokable read-only disclosure (AC #3) instead of dropping the controls message.
- Files changed: `../../cli/src/core/app.ts` (inspect disclosure), `../../cli/test/specialistCatalog.test.ts` (+24 tests net).
- Review findings: 12 patched (1 medium, 11 low), 1 deferred (argumentless subcommand falls through to browse), 2 rejected as noise.
- Follow-up review recommendation: false — fixes are localized to one command surface, each verified by a direct test; no API/security/data impact beyond surfacing an existing message.
- Verification: `npm run build` clean; `npx vitest run` 57 files / 1537 tests passing (baseline 1520 → 1537).
- Residual risks: specialist adapter no-invocation invariant is structural only until Stories 4.9+ introduce a callable path — re-assert with spies then.
