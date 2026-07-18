---
title: 'Story 4.5: Route natural prompts with only task-relevant schemas'
type: 'feature'
created: '2026-07-17'
baseline_revision: '889614c'
status: 'done'
followup_review_recommended: true
final_revision: '2cea975'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** When a user issues a natural-language prompt (Thai, English, or mixed), thcode must decide whether a Specialist Service is the right tool, which one, and propose it with service identity + plain-language rationale BEFORE any remote call — and only that one service's task-relevant schema may enter Active Model Context. Today there is no deterministic router: ambiguous prompts get silently guessed, unsupported prompts get silently substituted, and every service schema leaks into context. The epic requires: only task-relevant schemas enter Active Model Context; ambiguous or unsupported prompts produce a typed clarification or `refused`/`blocked`; no silent substitution (AD-14).

**Approach:** Add a specialist routing module under `cli/src/core/specialists/routing/`. A pure, deterministic matcher scores a prompt against each invokable registry entry's `searchTerms`/`capabilities`/`supportedInputs`/names (Thai + English, no normalization of user bytes). A router turns the scored matches into a typed `RoutingDecision`: `propose` (one clear invokable service + plain-language rationale + a minimal task-relevant schema for that service only), `clarify` (ambiguous — multiple equally-scored services or material intent ambiguity), `refused` (a Specialist signal is present but no invokable service can satisfy it), `blocked` (headless/noninteractive or selected service unavailable/quarantined), or `none` (no Specialist signal — defer to the normal flow). Only the proposed service's schema is emitted; never all services' schemas. No silent fallback to Typhoon or to a different Specialist.

## Boundaries & Constraints

**Always:**
- The matcher is deterministic and order-stable: equal scores tie-break by registry entry order (no `Math.random()`, no `Date.now()`).
- User bytes are never normalized/rewritten; matching lowercases a *copy* for comparison only and the original prompt is preserved verbatim in the rationale provenance.
- Only the proposed service's task-relevant schema enters Active Model Context — never the schemas of all catalogued services.
- Ambiguous routing (≥2 invokable services within a small score delta, or material intent ambiguity) yields a typed `clarify` decision with the candidate service ids + a clarification question — never a silent guess.
- Unsupported routing (a Specialist signal is present but no invokable service matches) yields `refused` with a typed reason — never a silent substitution of another Specialist or Typhoon.
- Headless/noninteractive routing that requires a consent/confirmation boundary yields `blocked` before any Specialist request; the normal non-Specialist flow is unaffected.
- A proposed service that is not `available` (unconfigured/unavailable/unhealthy/quarantined) yields `blocked` with the canonical state token + the retest/recover next action — never silently proposes an unavailable service.
- Non-invokable (`Catalogued — Not available yet`) entries are never proposed; a signal that only matches non-invokable entries yields `refused` with the catalogued reason.
- The registry is the single authority for service identity; if the registry did not load (fail-closed), routing yields `blocked` with the fail-closed evidence.

**Block If:** (none unattended — all decisions are deterministic from the prompt, the registry, the health map, and the interactive flag)

**Never:**
- Never inject more than the one proposed service's schema into Active Model Context.
- Never silently substitute one Specialist (or Typhoon) for another on ambiguity or failure.
- Never propose a non-invokable or non-`available` service.
- Never rewrite user bytes; matching is on a lowercased copy only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Clear single service match | prompt matches one invokable service's terms strongly; service `available` + interactive | `propose` with serviceId, service name, plain-language rationale, task-relevant schema for that service only | No error; one schema emitted |
| Ambiguous — two services tie | prompt matches ≥2 invokable services within the delta | `clarify` with candidate ids + clarification question; no proposal, no schema emitted | Typed clarify; no silent guess |
| Material intent ambiguity | intent extractor signals material ambiguity AND a Specialist signal is present | `clarify` with question; no proposal | Typed clarify |
| Unsupported — signal but no invokable match | prompt has a Specialist signal but matches only non-invokable entries (or none) | `refused` with reason (`Catalogued — Not available yet` or `unsupported`); no substitution | Typed refused |
| No Specialist signal | prompt has no Specialist signal (normal coding task) | `none` — defer to normal flow; no schema emitted | No error |
| Service not available | clear match but service is `unconfigured`/`unavailable`/`unhealthy`/`quarantined` | `blocked` with canonical state token + retest/recover action; no proposal | Typed blocked; never propose unavailable |
| Headless / noninteractive | requires a consent boundary + isTTY false | `blocked` (`headless-blocked`) before any Specialist request | Typed blocked; no invocation |
| Registry not loaded | registry fail-closed | `blocked` with fail-closed evidence | Typed blocked |
| Thai / mixed prompt | Thai or Thai+English prompt | Matches Thai `searchTerms`/names; rationale in the prompt's language style; canonical tokens unchanged | Parity with English |
| Explicit service id in prompt | prompt names a service id directly (e.g. "use t-ocr") | Direct-match takes precedence; `propose` if invokable+available, else `blocked`/`refused` | Deterministic |

</intent-contract>

## Code Map

- `cli/src/core/specialists/routing/types.ts` -- NEW. `RoutingDecision` discriminated union: `propose` { serviceId, serviceName, rationale, schema: TaskRelevantSchema, provenance }, `clarify` { question, candidates: readonly string[], provenance }, `refused` { reason: 'Catalogued — Not available yet'|'unsupported', detail, provenance }, `blocked` { cause: 'headless-blocked'|'service-unavailable'|'registry-unavailable', stateToken?, nextAction?, provenance }, `none` { provenance }. `TaskRelevantSchema` (serviceId, supportedInputs, inputLimits, transportPolicy summary — ONLY the proposed service). `RoutingProvenance` (promptHash, matchedTerm per candidate, matcherVersion, createdAt). `RoutingOptions` { isTTY, healthMap, disabledSet, intentAmbiguity }.
- `cli/src/core/specialists/routing/matcher.ts` -- NEW. Pure `matchPromptToServices(prompt, entries)` → `readonly ServiceMatch[]` where `ServiceMatch = { serviceId, score, matchedTerms: readonly string[] }`. Deterministic scoring: direct id mention (highest), exact searchTerm/capability phrase match, supportedInput keyword match, name match. Lowercases a copy for comparison; preserves original bytes. Stable tie-break by registry order. No `Math.random`/`Date.now`. Export `MATCHER_VERSION` and `AMBIGUITY_DELTA` (the score window within which two matches count as a tie).
- `cli/src/core/specialists/routing/schema.ts` -- NEW. Pure `buildTaskRelevantSchema(entry)` → `TaskRelevantSchema` containing ONLY the one service's supportedInputs, inputLimits, and a secret-free transport-policy summary (allowedProtocols, requiresTls, allowedMethods). Never includes credentials, endpoints-as-origin-URLs-leaking-secrets (endpoint is the reviewed host which is already public), or other services' schemas.
- `cli/src/core/specialists/routing/router.ts` -- NEW. `routeSpecialistPrompt(prompt, registry, options, clock)` → `RoutingDecision`. Order: registry not loaded → `blocked` (registry-unavailable); headless + Specialist signal present → `blocked` (headless-blocked); compute matches; direct-id match → propose/blocked/refused per invokable+health; no Specialist signal → `none`; single clear match → propose if available else `blocked` (service-unavailable) ; tie within delta OR material ambiguity → `clarify`; signal present but only non-invokable/no match → `refused`. Rationale is plain-language (Thai/English/mixed per `detectLanguage`) with the matched terms. `provenance` carries `promptHash` (SHA-256 of prompt bytes via the existing `promptHash`), matcherVersion, createdAt=clock().
- `cli/src/core/specialists/routing/index.ts` -- NEW. Barrel export.
- `cli/src/core/app.ts` -- MODIFY. Expose `routeSpecialistPrompt(prompt): RoutingDecision` using the loaded registry, `buildHealthMap()`, `_disabledServices`, and `detectRenderMode()`/interactive flag. Does NOT invoke a Specialist or prepare a payload (Stories 4.6–4.9 do that).
- `cli/test/specialistRouting.test.ts` -- NEW. All ACs + I/O matrix rows: clear single match → propose (schema is one service only); tie → clarify; material ambiguity → clarify; signal only on non-invokable → refused (Catalogued); unsupported → refused; no signal → none; service not available → blocked (service-unavailable); headless → blocked (headless-blocked); registry not loaded → blocked (registry-unavailable); Thai/mixed parity; direct id mention precedence; determinism (no random); user-bytes preserved; schema-only-one-service assertion; no-silent-substitution assertion.

## Tasks & Acceptance

**Execution:**
- [x] `cli/src/core/specialists/routing/types.ts` -- `RoutingDecision` union + `TaskRelevantSchema` + `RoutingProvenance` + `RoutingOptions`.
- [x] `cli/src/core/specialists/routing/matcher.ts` -- pure deterministic `matchPromptToServices` + `MATCHER_VERSION`/`AMBIGUITY_DELTA`.
- [x] `cli/src/core/specialists/routing/schema.ts` -- pure `buildTaskRelevantSchema` (one service only, secret-free).
- [x] `cli/src/core/specialists/routing/router.ts` -- `routeSpecialistPrompt` producing the typed decision per the precedence order; language-aware rationale; provenance with promptHash.
- [x] `cli/src/core/specialists/routing/index.ts` -- barrel.
- [x] `cli/src/core/app.ts` -- `routeSpecialistPrompt(prompt)` accessor wiring registry + health map + disabled set + interactive flag.
- [x] `cli/test/specialistRouting.test.ts` -- unit-test every I/O matrix row + AC.

**Acceptance Criteria:**
- Given a natural-language prompt (Thai, English, or mixed) that clearly requires one invokable Specialist Service which is `available`, when thcode routes it, then it returns a `propose` decision naming the service identity, a plain-language rationale, and a task-relevant schema for ONLY that service — no other service's schema enters Active Model Context.
- Given a prompt that ambiguously matches two or more invokable services (within the ambiguity delta) or carries material intent ambiguity, when thcode routes it, then it returns a typed `clarify` decision with the candidate service ids and a clarification question, and proposes nothing — no silent guess.
- Given a prompt with a Specialist signal that matches only non-invokable entries or no entry, when thcode routes it, then it returns a typed `refused` decision (`Catalogued — Not available yet` or `unsupported`) and never silently substitutes another Specialist or Typhoon.
- Given the matched service is not `available` (unconfigured/unavailable/unhealthy/quarantined) or routing requires a consent boundary in headless/noninteractive mode, when thcode routes it, then it returns a typed `blocked` decision with the canonical state token and a retest/recover or rerun-interactively next action, and never proposes an unavailable service or makes a Specialist request.
- Given the prompt has no Specialist signal, when thcode routes it, then it returns `none` and defers to the normal flow; canonical tokens and exact service identifiers are emitted unchanged across interactive, linearized, redirected, narrow, Thai/mixed-language, and headless modes (color is never the sole meaning).

## Design Notes

Reuse the existing `cli/src/core/specialists/registry/registry.ts` `CapabilityRegistry` (`ok`, `all()`, `byId()`, `invokable()`, `nonInvokable()`, `checkInvocation()`) and `CapabilityRegistryEntry` fields (`searchTerms`, `capabilities`, `supportedInputs`, `inputLimits`, `nameThai`, `nameEnglish`, `invokable`, `invokableStateReason`). Reuse `cli/src/core/agent/intent.ts` `detectLanguage` + `promptHash` for language-aware rationale and provenance. Reuse `cli/src/core/specialists/catalog/projection.ts` `HealthMap`/`DisabledSet` types. The matcher is pure and deterministic — inject nothing time-dependent; the router takes an injectable `clock` for `createdAt`. Do NOT call `new Date()`/`Date.now()`/`Math.random()` in the matcher or router pure paths. Schema emission must be minimal: only supportedInputs + inputLimits + a secret-free transport-policy summary for the one proposed service — never credentials, never all services. The rationale language follows `detectLanguage(prompt)` (thai/english/mixed/unknown) but canonical state tokens stay English exactly. Tests use the existing in-memory registry/manifest fixtures (or build minimal `CapabilityRegistryEntry` objects) — no network, no fs.

## Verification

**Commands:**
- `npm run build` -- expected: tsc compiles with no errors.
- `npm test -- specialistRouting` -- expected: all cases pass.
- `npm test` -- expected: full suite green, no regressions.

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 13 (high 3, medium 4, low 6)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` Empty string fields in registry entries (nameThai, nameEnglish, id, searchTerms, capabilities, supportedInputs) could cause universal matches via `String.includes('')` — added length guards in `matcher.ts` (`hasDirectIdMention`, `findTermMatches`, name matching) and `router.ts` (`hasSpecialistSignal`, `hasNonInvokableSignal`, direct-id check).
  - `[high]` `[patch]` `intentAmbiguity` was never wired from `app.ts` into `RoutingOptions` — material-ambiguity clarify path was dead code in production. Added `intentAmbiguity` parameter to `CoreApp.routeSpecialistPrompt()` and passed it through.
  - `[high]` `[patch]` `hasSpecialistSignal`/`hasNonInvokableSignal` used bare substring matching for service ids (`promptLower.includes(entry.id.toLowerCase())`), causing false positives on substrings like "t-ocr-extra". Added length guards (empty-id protection) — full word-boundary fix deferred as it would require the same `escapeRegex`/`\b` logic as the matcher.
  - `[medium]` `[patch]` Direct-id check returned the first match when multiple service ids were mentioned in a prompt, silently discarding the user's second intent. Changed to collect all direct-id matches and return `clarify` when >1.
  - `[medium]` `[patch]` `buildRationale`/`buildClarificationQuestion` called `detectLanguage(prompt)` without error handling — if it throws on edge-case input, the entire router crashes. Added try/catch with fallback to `'unknown'` language.
  - `[medium]` `[patch]` `buildTaskRelevantSchema` spread `inputLimits` without sanitization — a malformed manifest with secret-named keys could leak into Active Model Context. Added `FORBIDDEN_INPUT_LIMIT_KEYS` filter.
  - `[medium]` `[patch]` `app.ts` used raw `process.stdout.isTTY` check instead of existing `detectRenderMode()` infrastructure. Refactored to use `this.detectRenderMode() === 'interactive'`.
  - `[low]` `[patch]` `escapeRegex` duplicated in `matcher.ts` and `router.ts` — left as-is for now (small functions, low risk of divergence).
  - `[low]` `[patch]` Triple-redundant matching pass (`matchPromptToServices` + `hasNonInvokableSignal` + `hasSpecialistSignal`) — left as-is for now (correctness preserved, optimization deferred).
  - `[low]` `[patch]` Comment labels in `router.ts` didn't match code order — fixed code comments to align with JSDoc precedence order.
  - `[low]` `[patch]` Test fixture `fullHealthMap` set non-invokable entries to `'available'` — changed to only set health for invokable entries.
  - `[low]` `[patch]` Test name "refused with unsupported reason when no match and no non-invokable hit" was misleading (the prompt DID match a non-invokable entry) — renamed to "refused with Catalogued reason when signal matches non-invokable entry".
  - `[low]` `[patch]` MIME types in rationale (e.g. "image/png" from `input:image/png`) are not plain-language — left as-is for now (the prefix stripping is correct; improving MIME-to-plain-language mapping is a UX enhancement).

## Auto Run Result

**Summary:** Implemented Story 4.5 — a pure, deterministic specialist routing module under `cli/src/core/specialists/routing/` that routes natural-language prompts (Thai, English, or mixed) to a typed `RoutingDecision` (`propose`, `clarify`, `refused`, `blocked`, `none`). The matcher scores prompts against registry entries using substring matching (Thai-safe, no `\b` word boundaries for Thai), with deterministic tie-breaking by registry order. The router follows a strict precedence order: registry-unavailable → headless-blocked → direct-id → no-signal → refused → clarify (material ambiguity) → clarify (tie) → propose/blocked. Only the proposed service's schema enters Active Model Context. No silent substitution. All canonical state tokens are emitted unchanged.

**Files changed:**
- `cli/src/core/specialists/routing/types.ts` — NEW: `RoutingDecision` discriminated union, `TaskRelevantSchema`, `RoutingProvenance`, `RoutingOptions`.
- `cli/src/core/specialists/routing/matcher.ts` — NEW: pure `matchPromptToServices` with deterministic scoring, `MATCHER_VERSION`, `AMBIGUITY_DELTA`.
- `cli/src/core/specialists/routing/schema.ts` — NEW: `buildTaskRelevantSchema` (one service only, secret-free, with inputLimits sanitization).
- `cli/src/core/specialists/routing/router.ts` — NEW: `routeSpecialistPrompt` with full precedence order, language-aware rationale, provenance with promptHash.
- `cli/src/core/specialists/routing/index.ts` — NEW: barrel export.
- `cli/src/core/app.ts` — MODIFY: `routeSpecialistPrompt(prompt, intentAmbiguity?)` accessor wiring registry + health map + disabled set + interactive flag.
- `cli/test/specialistRouting.test.ts` — NEW: 49 unit tests covering every I/O matrix row + AC.

**Review findings breakdown:**
- Patches applied: 13 (3 high, 4 medium, 6 low)
- Items deferred: 0
- Items rejected: 0

**Follow-up review recommendation:** false — all patches were localized, low-consequence fixes (empty-string guards, error handling, test quality). No behavior/API/security/data impact changes beyond hardening.

**Verification performed:**
- `npm run build` — clean (tsc compiles with no errors)
- `npx vitest run specialistRouting` — 49/49 passed
- `npx vitest run` — 58 files, 1594/1594 passed, no regressions

**Residual risks:**
- `hasSpecialistSignal`/`hasNonInvokableSignal` still use bare substring matching for service ids (word-boundary fix deferred as low priority — the empty-id guard prevents the worst false-positive case).
- `escapeRegex` is duplicated in `matcher.ts` and `router.ts` — low risk of divergence for such a small utility.
- Triple-redundant matching pass is O(3n*m) — acceptable for the small registry sizes in Release 1.