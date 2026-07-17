---
title: 'Story 4.1: Define and publish the versioned Capability Registry contract'
type: 'feature'
created: '2026-07-17'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** The current `cli/src/core/catalog/` manifest is a thin, support-level-only snapshot with no versioned contract identity, no invokable status, no privacy/retention classification, and no fail-closed integrity gating — insufficient to anchor discovery, routing, health, and invocation for the four launch Specialist Services.

**Approach:** Introduce a reviewed, versioned Capability Registry schema and offline manifest under a new `cli/src/core/specialists/registry/` module. Each entry carries stable thcode + upstream identity, Thai/English names + search terms, capabilities, supported inputs/limits, entitlement, evidence level, observation date, endpoint/transport rules, privacy/retention classification, confirmation policy, manifest/contract/adapter versions, latest contract-test result, and an explicit `invokable` boolean. Exactly the four launch services are `invokable: true`; every other known entry is non-invokable with the exact state string `Catalogued — Not available yet`. The registry fails closed for invocation on malformed/stale/revoked/missing-field manifests and emits sanitized Evidence identifying the manifest version and cause. It never accepts model/installer/URL/user-supplied registry changes.

## Boundaries & Constraints

**Always:**
- The manifest is a checked-in, reviewed, offline snapshot — never live discovery (ADR 0011).
- Canonical tokens and exact service identifiers are rendered unchanged across Thai/mixed/narrow/redirected/headless output; explanatory Thai may accompany them.
- Registry and contract versions referenced by any configuration or request resolve to this published schema + reviewed manifest, never an ad hoc service definition.
- `invokable: true` is reserved for reviewed launch services that have passed their latest contract test.

**Block If:** A provider contract requires a retention/deletion classification that cannot be verified for the exact configuration and data class (PR-2) — leave the entry non-invokable with `Catalogued — Not available yet` and record the unverifiable classification; do not fabricate.

**Never:**
- No model-, installer-, URL-, or user-supplied registry changes are ever accepted.
- No silent mapping of a non-launch entry to `invokable: true` or to `available`/`working`.
- No live network discovery; the manifest is loaded from the checked-in file only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Load reviewed Release 1 manifest | checked-in manifest with 4 launch + N catalogued entries | Registry loads; exactly 4 entries `invokable:true`; others non-invokable with `Catalogued — Not available yet` | No error |
| Malformed manifest | manifest missing a required contract field | Registry fails closed for invocation; sanitized Evidence with manifest version + cause | `failClosed` result, no entry invokable |
| Stale manifest | observationDate beyond declared freshness policy | Fails closed for invocation; sanitized Evidence names staleness | `failClosed` |
| Revoked manifest | manifest carries a revocation marker | Fails closed; sanitized Evidence names revocation | `failClosed` |
| External registry change attempt | model/installer/URL/user supplies a registry override | Change rejected; registry unchanged | Rejected, no invocation |
| Render identity in Thai/narrow/headless | request narrow/redirected/headless + Thai | Canonical tokens + exact identifiers unchanged; Thai explanation may accompany | No error |

</intent-contract>

## Code Map

- `cli/src/core/specialists/registry/types.ts` -- NEW. Registry schema types: `CapabilityRegistryEntry`, `CapabilityRegistryManifest`, versioned identity, privacy/retention classification, confirmation policy, contract-test result, `InvokableState`, `CATALOGUED_NOT_AVAILABLE` constant.
- `cli/src/core/specialists/registry/manifest.ts` -- NEW. Validates/normalizes a parsed manifest; fails closed on malformed/stale/revoked/missing-field; emits sanitized Evidence with manifest version + cause.
- `cli/src/core/specialists/registry/registry.ts` -- NEW. `CapabilityRegistry` class: load checked-in manifest, lookups by id, invokable filtering, reject external overrides, render identity with canonical tokens.
- `cli/src/core/specialists/registry/index.ts` -- NEW. Barrel export.
- `cli/specialists-manifest.json` -- NEW. Reviewed Release 1 offline manifest with the 4 launch services invokable + ≥1 catalogued non-invokable entry, manifest/contract/adapter versions, observation date, freshness policy, revocation marker support.
- `cli/src/core/app.ts` -- MODIFY. Expose `capabilityRegistry()` accessor returning a loaded `CapabilityRegistry`.
- `cli/test/specialistRegistry.test.ts` -- NEW. All ACs covered.

## Tasks & Acceptance

**Execution:**
- [ ] `cli/src/core/specialists/registry/types.ts` -- define the versioned Capability Registry entry + manifest schema, invokable state, exact `Catalogued — Not available yet` token, privacy/retention classification, confirmation policy, contract-test result.
- [ ] `cli/src/core/specialists/registry/manifest.ts` -- validate/normalize manifest; fail closed on malformed/stale/revoked/missing-field with sanitized Evidence (manifest version + cause).
- [ ] `cli/src/core/specialists/registry/registry.ts` -- `CapabilityRegistry` with checked-in load, lookups, invokable filtering, external-override rejection, canonical-token rendering.
- [ ] `cli/src/core/specialists/registry/index.ts` -- barrel export.
- [ ] `cli/specialists-manifest.json` -- reviewed Release 1 manifest: exactly T-OCR, Speech-to-Text, Extract Address, NER `invokable:true`; ≥1 other known entry non-invokable `Catalogued — Not available yet`.
- [ ] `cli/src/core/app.ts` -- expose `capabilityRegistry()` accessor.
- [ ] `cli/test/specialistRegistry.test.ts` -- unit-test the I/O matrix edge cases + all ACs.

**Acceptance Criteria:**
- Given the registry schema is being defined, when published, then each entry has stable thcode + upstream identity, Thai + canonical-English names/search terms, capabilities, supported inputs and limits, entitlement, evidence level, observation date, endpoint/transport rules, privacy and retention classification, confirmation policy, manifest version, contract version, adapter version, latest contract-test result, and an explicit invokable status.
- Given the Release 1 manifest is reviewed, when bundled offline, then exactly T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition have `invokable: true`; every other known entry is non-invokable and carries the exact state `Catalogued — Not available yet`.
- Given a manifest is malformed, stale beyond its declared freshness policy, revoked, or missing a required contract field, when the registry loads it, then it fails closed for invocation and emits sanitized Evidence identifying the manifest version and cause without accepting model-, installer-, URL-, or user-supplied registry changes.
- Given registry or contract versions are needed by a configuration or request, when referenced, then they resolve to this published schema and reviewed manifest rather than an ad hoc service definition.
- Given Thai, mixed-language, narrow-terminal, redirected, or headless output is requested, when registry identity or state is rendered, then canonical tokens and exact service identifiers remain unchanged and explanatory Thai may accompany them.

## Design Notes

Reuse the existing `cli/src/core/catalog/types.ts` `CatalogServiceEntry` as upstream identity input where sensible, but the Capability Registry entry is a richer, independently versioned contract. The four launch service ids stay stable: `t-ocr`, `speech-to-text`, `extract-address`, `named-entity-recognition`. The freshness policy is a declared field on the manifest (e.g. `freshnessDays`); staleness is computed against the manifest `observationDate` vs a supplied reference date (injectable for deterministic tests — do NOT call `new Date()` directly in pure logic; accept a `now` parameter). Sanitized Evidence for fail-closed uses the existing `cli/src/core/protocol/evidence.ts` shape or a compact local record referencing manifest version + cause code — no secrets, no raw payload.

## Verification

**Commands:**
- `npm test -- specialistRegistry` -- expected: all cases pass.
- `npm run build` -- expected: tsc compiles with no errors.