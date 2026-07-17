---
title: 'Story 4.4: Generate effective configuration and enforce the health lifecycle'
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

**Problem:** A Specialist Service must never be marked `available` from configuration alone — only a live check of the *exact* stored configuration can establish availability. There is no immutable, secret-free effective-configuration generation that binds endpoint/origin, service mapping, credential reference+revision, registry manifest version, contract version, adapter version, transport policy, and relevant request configuration, and no enforced `unconfigured → configured → checking → available | unavailable | unhealthy | quarantined` lifecycle whose results are valid only for the generation they were checked against.

**Approach:** Add a specialist health module under `cli/src/core/specialists/health/`. It defines an immutable, secret-free `SpecialistEffectiveConfiguration` (deterministic digest of endpoint/origin, service mapping, credential reference id+revision, registry manifest version, contract version, adapter version, transport policy, request config), a pure `buildSpecialistEffectiveConfiguration(entry, credentialReference, requestConfig, clock)` builder that fails closed for non-invokable entries, missing credentials, transport-policy violations, and missing fields, and a `SpecialistHealthLifecycle` that projects the configuration into the existing shared `HealthRegistry` and enforces the full lifecycle with stale/mismatched/superseded rejection. Canonical state tokens are emitted unchanged across interactive/linearized/redirected/narrow/Thai/headless.

## Boundaries & Constraints

**Always:**
- `SpecialistEffectiveConfiguration` is immutable and secret-free: it carries the credential reference id + revision + fingerprint only — never the raw key.
- Availability is established ONLY by a live probe of the exact generation passing; `configured` never implies `available`.
- A probe that returns after its generation was superseded cannot make the newer generation `available` (stale-result rejection, AD-18); the current snapshot is returned without promotion.
- Health results are snapshots (defensive copies); the registry is the single authority for health state.
- Canonical state tokens (`unconfigured`/`configured`/`checking`/`available`/`unavailable`/`unhealthy`/`quarantined`) are emitted unchanged in every output mode; color is never the sole carrier.
- Non-invokable (`Catalogued — Not available yet`) entries can never establish availability; the builder fails closed with `not-invokable`.
- Transport policy violations (endpoint not TLS when required, disallowed protocol/method) fail closed at generation build with `transport-policy` and never reach a probe.
- A throwing probe is folded into a typed `unknown` failure (`causeCode: 'probe-threw'`); no raw error crosses the boundary.

**Block If:** (none unattended — all decisions are deterministic from the registry entry, credential reference, transport rules, and probe result)

**Never:**
- Never persist or log the raw credential key in the configuration, the snapshot, the Evidence string, or the failure envelope.
- Never silently map a stale/mismatched/superseded generation to `working`/`available`.
- Never allow a non-invokable entry to become `available`.
- Never substitute one Specialist for another on failure (no silent fallback; AD-14).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Invokable service, credential present, live probe passes | entry.invokable + credentialReference + passing probe | Generation registered (`configured`), check transitions `configured → checking → available` with timestamp + secret-free Evidence | No error; `available` snapshot with evidence + checkedAt |
| Live probe fails (auth/config/protocol) | probe returns fatal failure | State `unhealthy`; typed `HealthFailure` with category, scope, generationId, safeMessage, causeCode | Typed failure envelope; no promotion |
| Live probe fails (connectivity/quota/unknown) | probe returns transient failure | State `unavailable`; `retryable: true`; optional `retryAfterMs` | Typed failure envelope; not quarantined on one occurrence |
| Generation superseded during in-flight probe | newer generation registered before old probe returns | Old success rejected as stale; current snapshot returned without promotion | No stale `available`; requires explicit retest |
| Credential removed / rotated | `markUnconfigured(serviceId)` or new credential revision | Old generation superseded/unconfigured; dependent results stale; no cached key in buffers | `unconfigured` snapshot |
| Non-invokable entry | `entry.invokable === false` | Builder fails closed `not-invokable`; no generation, no probe, never `available` | Typed `not-invokable` cause |
| Transport policy violation | endpoint not TLS while `requiresTls`, or disallowed protocol/method | Builder fails closed `transport-policy`; no generation, no probe | Typed `transport-policy` cause |
| Missing credential / missing field | no credentialReference, or entry missing endpoint/contractVersion/adapterVersion | Builder fails closed `missing-credential`/`missing-field` | Typed cause; no generation |
| Quarantine (shared-key rejection) | `quarantine(serviceId, cause)` | State `quarantined`; unselectable until explicit retest passes | Quarantine snapshot; never auto-recovered |
| Throwing probe | probe throws | Folded to typed `unknown` failure `causeCode: 'probe-threw'` | No raw error crosses boundary |

</intent-contract>

## Code Map

- `cli/src/core/specialists/health/types.ts` -- NEW. `SpecialistEffectiveConfiguration` (immutable, secret-free: `id` digest, `serviceId`, `endpoint`, `origin`, `serviceMapping`, `credentialReferenceId`, `credentialRevision`, `credentialFingerprint`, `manifestVersion`, `contractVersion`, `adapterVersion`, `transportPolicy`, `requestConfig`, `createdAt`), `SpecialistTransportPolicy` (allowedProtocols, requiresTls, allowedMethods — projected from `TransportRules`), `SpecialistRequestConfig` (bounded options relevant to the call), `SpecialistGenerationResult` (ok + configuration, or typed cause `not-invokable|missing-credential|missing-field|transport-policy`), `SpecialistHealthSnapshot` (serviceId, state, generationId?, endpoint?, failure?, evidence?, checkedAt?), `SpecialistHealthProbe` = `(gen: SpecialistEffectiveConfiguration) => Promise<HealthProbeResult>`.
- `cli/src/core/specialists/health/generation.ts` -- NEW. Pure `buildSpecialistEffectiveConfiguration(entry, credentialReference, requestConfig, clock)` returns `SpecialistGenerationResult`. Computes a deterministic secret-free digest id over all bound fields (endpoint/origin, serviceMapping, credentialReferenceId+revision, manifestVersion, contractVersion, adapterVersion, transportPolicy, requestConfig) so any change supersedes. Validates: invokable, credential reference present, endpoint+contractVersion+adapterVersion present, transport policy satisfied (TLS required ⟹ endpoint is https; endpoint protocol ∈ allowedProtocols; method ∈ allowedMethods). `projectToHealthGeneration(config)` maps to `EffectiveConfigurationGeneration` (providerId=serviceId, endpoint, credentialRevision, adapterVersion, modelId=contractVersion, dependencyIdentity=digest). `specialistConfigurationDigest(...)` exported for testing.
- `cli/src/core/specialists/health/lifecycle.ts` -- NEW. `SpecialistHealthLifecycle` wrapping the shared `HealthRegistry`: `register(config)` (configured), `registerProbe(serviceId, probe)`, `check(serviceId)` (checking → available/unavailable/unhealthy; stale rejection via HealthRegistry), `quarantine(serviceId, cause)`, `markUnconfigured(serviceId)`, `snapshot(serviceId)`, `isAvailable(serviceId)`, `snapshots()`. Probes receive the `SpecialistEffectiveConfiguration` (the lifecycle looks up the registered config by serviceId and runs the specialist probe, then forwards the `HealthProbeResult` to the HealthRegistry so stale-rejection + state transitions are centralized). Injectable clock.
- `cli/src/core/specialists/health/index.ts` -- NEW. Barrel export.
- `cli/src/core/app.ts` -- MODIFY. Own a `SpecialistHealthLifecycle` (backed by the existing `healthRegistry` or a dedicated instance) and expose `specialistHealthLifecycle()`, `buildSpecialistConfiguration(serviceId)` (loads registry entry + aiforthai credential reference + transport rules), and `checkSpecialistHealth(serviceId)`. Probes per service are registered by Stories 4.10–4.13; until then `check` returns the `probe-missing` configuration failure (already produced by HealthRegistry). No Specialist is invoked here.
- `cli/test/specialistHealth.test.ts` -- NEW. All ACs + I/O matrix rows with a fake `SpecialistHealthProbe` (no network): generation built + available; stale-success rejection after supersede; auth → unhealthy; connectivity → unavailable (retryable); transport-policy violation fails closed; non-invokable fails closed `not-invokable`; missing credential fails closed; quarantine keeps unselectable; markUnconfigured resets; throwing probe folds to typed `unknown`; digest changes when any bound field changes (supersede); secret-free assertion (no raw key in config/snapshot/evidence/failure).

## Tasks & Acceptance

**Execution:**
- [ ] `cli/src/core/specialists/health/types.ts` -- immutable secret-free `SpecialistEffectiveConfiguration` + transport policy + request config + typed generation result + specialist health snapshot + specialist probe type.
- [ ] `cli/src/core/specialists/health/generation.ts` -- pure builder with deterministic digest, fail-closed validation (invokable/credential/fields/transport policy), projection to `EffectiveConfigurationGeneration`.
- [ ] `cli/src/core/specialists/health/lifecycle.ts` -- `SpecialistHealthLifecycle` over the shared `HealthRegistry` enforcing the full lifecycle + stale rejection + quarantine + markUnconfigured.
- [ ] `cli/src/core/specialists/health/index.ts` -- barrel export.
- [ ] `cli/src/core/app.ts` -- `specialistHealthLifecycle()` accessor + `buildSpecialistConfiguration(serviceId)` + `checkSpecialistHealth(serviceId)`; no Specialist invocation.
- [ ] `cli/test/specialistHealth.test.ts` -- unit-test the I/O matrix edge cases + all ACs (fake probe, injectable clock, no network).

**Acceptance Criteria:**
- Given an invokable Specialist registry entry and a stored AI-for-Thai credential reference exist, when thcode builds the effective configuration and runs the live check, then it creates an immutable secret-free `SpecialistEffectiveConfiguration` binding endpoint/origin, service mapping, credential reference id+revision+fingerprint, registry manifest version, contract version, adapter version, transport policy, and request config, and transitions `configured → checking → available` only after the probe passes with timestamp + secret-free Evidence.
- Given the live check detects authentication, connectivity, quota, configuration, or protocol failure, when the result is normalized, then it emits the sanitized failure envelope with deterministic category, scope, generation id, safe message, cause code, and retryability, and the service remains `unavailable`, `unhealthy`, or `quarantined` as appropriate; no Specialist invocation occurs.
- Given the configuration or credential revision changes while a check is in flight, when the old check returns success, then the result is rejected as stale, cannot make the newer generation `available`, and requires an explicit live retest.
- Given the entry is non-invokable, the endpoint violates transport policy, or the credential/required field is missing, when the configuration is built, then the builder fails closed with a typed `not-invokable`/`transport-policy`/`missing-credential`/`missing-field` cause and never registers a generation or establishes availability.
- Given a shared credential rejection or explicit quarantine occurs, when the service is quarantined, then it stays unselectable until an explicit retest passes, the failure is scoped to the proven service, and no other Specialist is silently substituted; canonical state tokens are emitted unchanged across interactive, linearized, redirected, narrow, Thai, and headless modes.

## Design Notes

Reuse the existing `cli/src/core/providers/health.ts` `HealthRegistry`, `HealthState`, `HealthFailure`, `HealthProbeResult`, `HealthProbe`, and `EffectiveConfigurationGeneration` — do NOT duplicate the lifecycle or stale-rejection logic. `SpecialistEffectiveConfiguration` is the richer immutable binding; `projectToHealthGeneration` narrows it to `EffectiveConfigurationGeneration` so the shared registry remains the single authority. The digest id must incorporate every bound field so that a manifest/contract/adapter/transport/credential/endpoint change produces a new id and supersedes (AD-8, AD-18). The probe receives the `SpecialistEffectiveConfiguration` (secret-free); the raw key is fetched inside the probe scope only (by Stories 4.10–4.13) and never appears in Evidence, the snapshot, or the failure envelope (AD-11, AD-24). Inject a `clock` for timestamps; do not call `new Date()`/`Date.now()`/`Math.random()` in pure logic. The transport-policy check reuses the entry's `TransportRules` (`allowedProtocols`, `requiresTls`, `allowedMethods`) — map them to `SpecialistTransportPolicy` and validate the endpoint protocol + the intended method. Tests mock the probe (no `fetch`, no network) per project testing rules.

## Verification

**Commands:**
- `npm run build` -- expected: tsc compiles with no errors.
- `npm test -- specialistHealth` -- expected: all cases pass.
- `npm test` -- expected: full suite green, no regressions.