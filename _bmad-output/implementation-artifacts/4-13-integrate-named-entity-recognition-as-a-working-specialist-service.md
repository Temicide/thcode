---
title: 'Story 4.13: Integrate Named Entity Recognition as a working Specialist Service'
type: 'feature'
created: '2026-07-18'
status: 'done'
review_loop_iteration: 0
baseline_revision: '7fd2925'
final_revision: '456c4f6'
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-9-establish-shared-specialist-adapter-result-and-failure-contracts.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-14-persist-immutable-specialist-evidence-and-versioned-cachemanifest-identity.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-11-integrate-speech-to-text-as-a-working-specialist-service.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-12-integrate-extract-address-as-a-working-specialist-service.md'
warnings:
  - fixture-based-contract
---

<intent-contract>

## Intent

**Problem:** `defaultSpecialistHandlers()` (4.10/4.11/4.12) registers `t-ocr`, `speech-to-text`, `extract-address`, so `named-entity-recognition` (invokable, `text/plain` input) returns `handler-not-registered` and cannot identify entities in an approved bounded text input through the common Specialist flow. 4.13 wires the fourth and final launch service — a TEXT-input service whose result is a structured entity list — so a prepared, consented text dispatch reaches the direct AI-for-Thai NER endpoint and returns attributable entities with honest labels and no fabrication.

**Approach:** Add a `NerSpecialistHandler` implementing the 4.9 `SpecialistServiceHandler` contract (`serviceId: 'named-entity-recognition'`), combining the 4.12 text-input pattern with the 4.11 structured-list pattern. `buildTransportRequest` reads the prepared artifact's **text** (`text`/`extractedText`) and sends it in a JSON body against a **defined, fixture-based AI-for-Thai NER request shape** with a `Bearer`-authenticated POST and secret-free `headersSummary` (`Authorization: [redacted]`). `parseResult` maps the response into `SpecialistResult` fields **without inventing entities or labels** — the `entities` array is filtered to valid entity objects (`text:string` AND `label:string`), kept verbatim, and stored as a `structured` field (`{items:[…]}`); each entity's optional offset is preserved. `confidence` is a finite-checked number. Absent/empty entities → `present:false` + emptyFields. Register the handler in `defaultSpecialistHandlers()`. Tests are OFFLINE: `InMemorySpecialistTransport` + a reviewed Thai/mixed-language entity fixture (no real network/credentials). The AI-for-Thai per-service API contract is NOT verified against real endpoints — implement against the defined fixture contract and defer real-endpoint confirmation (tracked in deferred-work).

## Boundaries & Constraints

**Always:**
- The handler implements the 4.9 `SpecialistServiceHandler` interface verbatim. Mirror the 4.12 text-reading pattern and the 4.11 structured-list-filter pattern.
- The raw key is resolved ONLY via `credentialScope.resolveRawKey()` inside `buildTransportRequest`, used for `fetchHeaders.Authorization` only, never in `headersSummary` (redact to `[redacted]`), the body, the result, Evidence, logs, or output (AD-11).
- `parseResult` never invents entities or labels: filter `entities` to valid objects (`typeof object, !null, !Array, text:string, label:string`); keep valid entity objects verbatim (including optional `offset`/provenance fields); `entities` `present:true` iff ≥1 valid entity remains; non-array/null/empty → `present:false` + emptyFields. No synthesized entity text or label.
- `confidence` present iff `typeof === 'number' && Number.isFinite(...)` (the 4.12 finite-check — `JSON.parse('1e999')` → `Infinity` would otherwise serialize to `null` and corrupt Evidence).
- The handler reads text from `request.preparedArtifacts[0].text ?? preparedArtifacts[0].extractedText`. If no text, `buildTransportRequest` throws a typed `Error('named-entity-recognition requires a text artifact')` (adapter wraps as `unknown-outcome` — 4.9 contract constraint, same as 4.10/4.11/4.12).
- The request binds to the source-content hash (the adapter sets `sourceContentHash = preparedManifest.payloadByteDigest`; the handler does not recompute it). Only the NER task schema enters the request (routing 4.5 selects the service; the handler sends only `{text}`).
- `.js` import specifiers; `readonly`; no `any`; deterministic placeholders for adapter-overwritten fields (`evidenceRef: undefined`, `sanitizedRawResponseRef: ''`, `createdAt: request.startedAt`); no `Math.random`/`Date.now`.
- The fixture contract is documented in Design Notes and shared by handler + tests.

**Block If:** (none unattended — deterministic from the prepared text artifact + fixture response)

**Never:**
- Never fabricate entities, labels, offsets, confidence, or any field the service did not return.
- Never let the raw key escape `buildTransportRequest`'s fetch headers.
- Never make a real network call in tests — `InMemorySpecialistTransport` only.
- Never silently fall back to Typhoon or another service (AD-14); never invent labels for sensitive identities or unsupported capabilities; never auto-retry. A malformed response/protocol mismatch yields deterministic failure Evidence and the affected service is not selectable until the defined retest path succeeds (quarantine/retest are 4.16/4.17's concern — 4.13 produces the typed failure, not the quarantine state).
- Never mutate the prepared artifact or request.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Happy path text | prepared text + fixture 200 `{entities:[{text,label,offset}],confidence}` | SpecialistResult with `entities` (structured,present, verbatim valid entities) + `confidence` (number,present); emptyFields excludes those; full provenance | ok |
| Entities without offsets | fixture 200 `{entities:[{text,label}]}` | `entities` present, entities kept verbatim (no offset) | ok |
| Missing confidence | fixture 200 entities, no `confidence` | `confidence` `present:false` in emptyFields | ok |
| Empty entities | fixture 200 `{entities:[],confidence}` | `entities` `present:false` + emptyFields; no fabricated entities | ok (honest empty) |
| Mixed valid+invalid entities | fixture 200 `{entities:[{text,label},"x",{text:1,label:"L"}]}` | valid entities kept, invalid dropped; `present:true` iff ≥1 valid | ok |
| Malformed response body | fixture 200 non-JSON / wrong shape | handler `{ok:false,parseFailure:{category:'malformed-response',…}}`; adapter → `malformed-response` failure | typed failure |
| No text artifact | artifact with no `text`/`extractedText` | `buildTransportRequest` throws → adapter `unknown-outcome` failure | typed failure |
| Transport timeout/network | InMemory transport returns transportError | adapter `mapSpecialistFailure` → `timeout`/`transport` failure | typed failure |
| Non-finite confidence | fixture 200 `{entities,confidence:1e999}` | `confidence` `present:false` + emptyFields (Infinity not stored) | ok |
| Auth/protocol failure | fixture 401 / 400 | adapter → `unauthorized`/`server-error` failure; quarantine/retest in 4.16/4.17, not here | typed failure |
| Raw key never leaks | any path | `headersSummary` `Authorization: [redacted]`; body no key; result JSON no `Bearer`/`sk-`/raw key | secret-free (asserted) |

</intent-contract>

## Code Map

- `cli/src/core/specialists/services/ner/fixture.ts` -- NEW. Reviewed NER fixture: deterministic Thai/mixed-language text containing known names/organizations/locations, expected entities (text+label+offset), and the defined AI-for-Thai NER response JSON. `NerResponse` interface (`{entities?: readonly {text:string,label:string,offset?:number}[], confidence?: number}`). `buildNerResponse(overrides?: Partial<NerResponse>)` helper with `overrides != null` guard.
- `cli/src/core/specialists/services/ner/nerHandler.ts` -- NEW. `NerSpecialistHandler implements SpecialistServiceHandler` (`serviceId: 'named-entity-recognition'`). `buildTransportRequest`: read `text ?? extractedText`; if absent/empty → throw typed Error; body = JSON `{text}`; `fetchHeaders` = `Authorization: Bearer <key>`, `Content-Type: application/json`; `headersSummary` redacts Authorization. `parseResult`: parse JSON; filter `entities` to valid objects (text:string AND label:string), keep verbatim incl. optional offset, store as `structured` `{items:[…]}`; `present:true` iff ≥1 valid; `confidence` finite-checked number; honest present flags + emptyFields; return fields OR `{ok:false,parseFailure}` on non-JSON/wrong shape. Deterministic placeholders for adapter-overwritten fields.
- `cli/src/core/specialists/services/ner/index.ts` -- NEW. Barrel.
- `cli/src/core/specialists/services/index.ts` -- MODIFY. Extend `defaultSpecialistHandlers()` to also include `NerSpecialistHandler` (now 4 handlers).
- `cli/test/specialistServiceNer.test.ts` -- NEW. Offline tests: every I/O matrix row + AC. Reuse 4.11/4.12 test scaffolding. Assert no fabricated entities/labels, mixed valid+invalid filtering, empty entities, non-finite confidence, handler-registration via `find` by serviceId (not index). Update 4.10/4.11/4.12 aggregator-count assertions (3→4) if present.

## Tasks & Acceptance

**Execution:**
- [ ] `cli/src/core/specialists/services/ner/fixture.ts` -- reviewed NER fixture (input text + expected entities + defined response JSON + typed override helper).
- [ ] `cli/src/core/specialists/services/ner/nerHandler.ts` -- `NerSpecialistHandler` (text input; entity filter; no fabricated labels; finite confidence; redacted headers; deterministic placeholders).
- [ ] `cli/src/core/specialists/services/ner/index.ts` -- barrel.
- [ ] `cli/src/core/specialists/services/index.ts` -- add `NerSpecialistHandler` to `defaultSpecialistHandlers()` (now 4 handlers — all launch services wired).
- [ ] `cli/test/specialistServiceNer.test.ts` -- unit-test every I/O matrix row + AC offline.

**Acceptance Criteria:**
- Given the deterministic Thai/mixed-language text fixture contains known names, organizations, and locations, when the prompt asks to identify entities in `@notes.md`, then routing selects Named Entity Recognition, includes only its task schema, and binds the request to the source-content hash.
- Given exact consent and current health exist, when the direct adapter dispatches, then returned entities, labels, offsets or provenance if supplied, confidence/uncertainty, empty results, service/configuration identity, consent reference, and timing are sealed as immutable Evidence.
- Given the prompt requests a sensitive identity or unsupported capability outside the reviewed manifest, when routing or preparation evaluates it, then thcode refuses or blocks without invoking another service, inventing labels, or exposing unavailable capabilities.
- Given a malformed response or protocol mismatch occurs, when the adapter classifies it, then it emits deterministic failure Evidence and prevents the affected service from being selected until the defined retest path succeeds.
- Given the user views the flow in Thai, mixed-language, narrow, redirected, or headless mode, when the result is presented, then entity output is clearly separated from Typhoon explanation and the exact source, service, and Evidence identities remain inspectable.

## Spec Change Log

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (low 1)
- defer: 0
- reject: 14: (low 14)
- addressed_findings:
  - `[low]` `[patch]` test comment at `specialistServiceNer.test.ts:1076` read "Calling it again with null should also work" but the assertion re-overrides the transport (not null). Corrected to "Calling it again (re-override) should also work" to reflect actual coverage.
  - `[low]` `[reject]` empty/whitespace-only `text` artifact passes the `length > 0` pre-check → `present:true` for the request — spec defines non-empty (length>0); whitespace-only is the user's bounded input sent verbatim; matches the 4.10/4.11/4.12 whitespace rejections. No fabrication occurs in the response mapping.
  - `[low]` `[reject]` no `contentKind` re-validation in the handler — upstream-validated by ArtifactResolver (4.6/4.7); the handler reading `text ?? extractedText` is correct for a text-input service (same as 4.12).
  - `[low]` `[reject]` `offset` not range-checked against text length — spec-silent; storing the service-returned offset verbatim is honest (no fabrication); matches 4.10/4.11/4.12 verbatim-storage policy.
  - `[low]` `[reject]` `confidence` not range-checked to [0,1] — spec is silent on range; storing the service value verbatim (finite-checked) is honest (same as 4.10/4.11/4.12).
  - `[low]` `[reject]` `null` entity element / non-object entity handled by the filter — the filter already drops non-object / null / Array elements and entities lacking `text:string` AND `label:string`; null inputs are unreachable once the filter runs (defensive, not a defect).
  - `[low]` `[reject]` `entities` stored as `structured` `{items:[…]}` — constrained by the 4.9 `SpecialistFieldValue` type (no array-of-objects kind); `structured` is the spec-sanctioned kind for object arrays (same convention as 4.11 segments / 4.12 spans).
  - `[low]` `[reject]` getter / proxy / aliasing on the parsed response object — `JSON.parse` returns a plain object; downstream Evidence immutability is owned by `sealSpecialistEvidence` (4.14), not the handler.
  - `[low]` `[reject]` `JSON.parse` plain-object cast (`as …`) — idiomatic; the handler validates field types (`Array.isArray`, `typeof === 'string'`, `Number.isFinite`) before use.
  - `[low]` `[reject]` fixture mechanics (`buildNerResponse` override detection / `{entities:undefined}` / extra-keys / non-plain-object overrides) — test-fixture helper mechanics; tests control overrides; not a story defect (same as 4.12).
  - `[low]` `[reject]` label ontology (e.g. `PERSON`/`ORG`/`LOC` vs Thai labels) not validated — label ontology is out of scope; the handler keeps service-returned labels verbatim without inventing or normalizing them (core honesty guarantee).
  - `[low]` `[reject]` null bytes / control chars in entity text — Sanitizer (AD-24) runs before persisted/displayed fields downstream; the handler stores service-returned content verbatim (same as 4.10/4.11/4.12).
  - `[low]` `[reject]` `resolveRawKey()` throws with no handler try/catch — the adapter's catch-all sanitizes the error message and wraps as `unknown-outcome`; matches the 4.10/4.11/4.12 pattern (AD-11 compliant).
  - `[low]` `[reject]` handler-count assertion drift risk — the aggregator now has 4 handlers (t-ocr, speech-to-text, extract-address, named-entity-recognition); 4.14 adds no handler so the count is stable; registration is asserted via `find` by `serviceId` (not index), matching the 4.11/4.12 decoupling patch.
  - `[low]` `[reject]` duplicated edge-case-hunter findings (whitespace / offset / confidence-range / label-ontology / null-entity / resolveRawKey) — same root causes as the adversarial findings; counted once.

## Design Notes

**Defined AI-for-Thai NER fixture contract (NOT verified against the real endpoint — deferred):**
- Request: `POST <endpoint>`, headers `Authorization: Bearer <key>`, `Content-Type: application/json`, body `{ "text": "<bounded text>" }`.
- Response 200: `{ "entities": [{ "text": "<string>", "label": "<string>", "offset": <number> }], "confidence": 0.0–1.0 }`. `entities` may be omitted/empty; each entity's `offset` is optional; `confidence` may be omitted.
- The handler maps exactly: `entities`→`structured` `{items:[…]}` (filtered to valid objects with text:string AND label:string, kept verbatim incl. optional offset), `confidence`→number (finite-checked). No other fields synthesized. No entity or label is fabricated.

**Entity storage:** `structured` `{items:[…]}` wrapper (same convention as 4.11 segments) because the 4.9 `SpecialistFieldValue` type has no array-of-objects kind. Consumers access `fields.entities.value.items`.

**Quarantine/retest scope:** 4.13 verifies the typed failure outcome (malformed/auth/protocol/transport) but does NOT assert quarantine or retest state — those are 4.16/4.17. AC #4's "prevents the affected service from being selected until the defined retest path succeeds" is realized by 4.16/4.17; 4.13 contributes the deterministic failure Evidence that feeds those stories.

**Reuse the 4.10 app test seam:** `setSpecialistTransportForTest` (test-only guarded) injects the InMemory transport; no app.ts change needed beyond the aggregator.

## Verification

**Commands:**
- `npm run build` -- expected: tsc clean.
- `npm test -- specialistServiceNer` -- expected: all pass.
- `npm test` -- expected: full suite green, no regressions.

## Auto Run Result

**Summary:** Implemented Story 4.13 — the fourth and final launch Specialist Service integration (second TEXT-input service). `NerSpecialistHandler` implements the 4.9 `SpecialistServiceHandler` contract for `named-entity-recognition`, combining the 4.12 text-input pattern with the 4.11 structured-list-filter pattern: `buildTransportRequest` reads the prepared artifact's `text`/`extractedText` and sends `{text}` JSON to the defined AI-for-Thai NER fixture endpoint (`Bearer` auth, redacted `headersSummary`); `parseResult` filters `entities` to valid objects (`text:string` AND `label:string`), keeps them verbatim (including optional `offset`), stores them as a `structured` `{items:[…]}` field, and finite-checks `confidence`. No fabricated entities or labels — absent/empty entities → `present:false` + emptyFields. Registered via `defaultSpecialistHandlers()` (now 4 handlers — all launch services wired). Then applied 1 review-driven patch.

**Files changed:**
- `cli/src/core/specialists/services/ner/fixture.ts` (NEW) — deterministic Thai/mixed-language text fixture, expected entities (text+label+offset), `NerResponse` interface, `buildNerResponse` helper.
- `cli/src/core/specialists/services/ner/nerHandler.ts` (NEW) — `NerSpecialistHandler` (text input; entity filter to valid objects; no fabricated labels; finite confidence; redacted headers; deterministic placeholders).
- `cli/src/core/specialists/services/ner/index.ts` (NEW) — barrel.
- `cli/src/core/specialists/services/index.ts` (MOD) — `defaultSpecialistHandlers()` now returns 4 handlers (t-ocr, speech-to-text, extract-address, named-entity-recognition).
- `cli/test/specialistServiceTocr.test.ts` + `cli/test/specialistServiceSpeech.test.ts` + `cli/test/specialistServiceAddress.test.ts` (MOD) — aggregator-count assertions 3→4.
- `cli/test/specialistServiceNer.test.ts` (NEW) — 29 offline tests covering every I/O matrix row + AC.

**Review findings breakdown:** 1 patch applied (low: stale test comment), 0 deferred, 14 rejected (all low).

**Follow-up review recommendation:** `false` — the final pass made a single localized low-consequence cosmetic fix (a stale test comment). No data-integrity or security impact; no independent follow-up review warranted.

**Verification performed:**
- `npm run build` → tsc clean.
- `npx vitest run specialistServiceNer` → 29/29 pass.
- `npx vitest run` → 62 files / 1714 tests pass (baseline 61/1685; +1 file, +29 tests, 0 regressions).

**Residual risks:** The AI-for-Thai NER request/response contract is a defined fixture shape, NOT verified against the real endpoint (per the continue.md key-gap decision). Real-endpoint confirmation is deferred. The `entities` array is stored as `structured` `{items:[…]}` because the 4.9 `SpecialistFieldValue` type has no array-of-objects kind — consumers must access `fields.entities.value.items`. No-text-artifact surfaces as `unknown-outcome` (4.9 contract constraint, same as 4.10/4.11/4.12). Quarantine/retest state is owned by 4.16/4.17; 4.13 contributes only the deterministic failure Evidence.