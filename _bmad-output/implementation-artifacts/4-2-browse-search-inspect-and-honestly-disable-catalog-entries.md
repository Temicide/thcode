---
title: 'Story 4.2: Browse, search, inspect, and honestly disable catalog entries'
type: 'feature'
created: '2026-07-17'
status: 'ready-for-dev'
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
- [ ] `cli/src/core/specialists/catalog/projection.ts` -- define plain serializable catalog + entry projections with canonical state token, invokable eligibility, next allowed action, machine-readable action availability.
- [ ] `cli/src/core/specialists/catalog/render.ts` -- render across interactive/linearized/redirected/headless/Thai/mixed/narrow with stable identifier + canonical token + safe reason, no color reliance.
- [ ] `cli/src/core/specialists/catalog/controls.ts` -- browse/search/inspect/enable/disable/diagnose/retest; non-invokable inspection is read-only and produces no proposal/payload/consent.
- [ ] `cli/src/core/specialists/catalog/index.ts` -- barrel export.
- [ ] `cli/src/core/app.ts` -- wire `/tools` to the catalog projection + controls.
- [ ] `cli/test/specialistCatalog.test.ts` -- unit-test the I/O matrix edge cases + all ACs.

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