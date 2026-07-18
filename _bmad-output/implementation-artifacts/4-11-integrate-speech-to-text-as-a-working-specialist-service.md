---
title: 'Story 4.11: Integrate Speech-to-Text as a working Specialist Service'
type: 'feature'
created: '2026-07-18'
status: 'done'
review_loop_iteration: 0
baseline_revision: '95f0d68'
final_revision: 'cd94479'
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-9-establish-shared-specialist-adapter-result-and-failure-contracts.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-14-persist-immutable-specialist-evidence-and-versioned-cachemanifest-identity.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-10-integrate-t-ocr-as-a-working-specialist-service.md'
warnings:
  - fixture-based-contract
---

<intent-contract>

## Intent

**Problem:** `defaultSpecialistHandlers()` (4.10) registers only `t-ocr`, so `speech-to-text` (invokable in the registry) returns `handler-not-registered` and cannot transcribe an approved audio artifact through the common Specialist flow. 4.11 wires the second working service so a prepared, consented audio dispatch reaches the direct AI-for-Thai Speech-to-Text endpoint and returns attributable Thai transcription with honest uncertainty.

**Approach:** Add a `SpeechToTextSpecialistHandler` implementing the 4.9 `SpecialistServiceHandler` contract (`serviceId: 'speech-to-text'`), mirroring the 4.10 handler pattern. `buildTransportRequest` reads the prepared audio artifact's `bytes`, base64-encodes them into a JSON body against a **defined, fixture-based AI-for-Thai Speech-to-Text request shape**, and emits a `Bearer`-authenticated POST with a secret-free `headersSummary` (`Authorization: [redacted]`). `parseResult` maps the defined response shape (transcript + optional segments/timing + optional confidence) into `SpecialistResult` fields **without inventing fields**; absent response keys yield empty fields, never fabricated content. Register the handler in `defaultSpecialistHandlers()` (extend the 4.10 aggregator). Tests are OFFLINE: `InMemorySpecialistTransport` + a reviewed audio fixture (no real network/credentials). The AI-for-Thai per-service API contract is NOT verified against real endpoints — implement against the defined fixture contract and defer real-endpoint confirmation (tracked in deferred-work).

## Boundaries & Constraints

**Always:**
- The handler implements the 4.9 `SpecialistServiceHandler` interface verbatim — `buildTransportRequest(request, credentialScope)` and `parseResult(raw, request)`. No new adapter surface. Mirror the 4.10 `TocrSpecialistHandler` structure.
- The raw key is resolved ONLY via `credentialScope.resolveRawKey()` inside `buildTransportRequest`, used for `fetchHeaders.Authorization` only, never in `headersSummary` (redact to `[redacted]`), the body, the result, Evidence, logs, or output (AD-11).
- `parseResult` never invents fields: present-and-non-null → `present:true`; absent/null/wrong-typed → `present:false` + `emptyFields`. Non-string transcript/segment text is NOT stringified into fake data — wrong-typed content is treated as absent.
- The handler reads audio bytes from `request.preparedArtifacts[0].bytes`. If the artifact has no bytes or the media type is not audio the registry lists for `speech-to-text`, `buildTransportRequest` throws a typed `Error('speech-to-text requires a binary audio artifact')` (adapter wraps as `unknown-outcome` — the 4.9 contract cannot emit a typed pre-transport failure; same constraint as 4.10).
- Confidence/uncertainty carried ONLY when the service provides them. Segments/timing carried ONLY when the service provides them (the AC says "segment or timing fields if provided").
- `.js` import specifiers; `readonly`; no `any`; deterministic placeholders for adapter-overwritten fields (`evidenceRef`, `sanitizedRawResponseRef`, `createdAt` — use `undefined`/`''`/`request.startedAt`, NOT `randomUUID()`/`new Date()`, per the 4.10 review patch); no `Math.random`/`Date.now` in pure logic.
- The fixture contract is documented in Design Notes and shared by handler + tests.

**Block If:** (none unattended — deterministic from the prepared artifact + fixture response)

**Never:**
- Never fabricate transcript, segments, timing, confidence, or any field the service did not return.
- Never let the raw key escape `buildTransportRequest`'s fetch headers.
- Never make a real network call in tests — `InMemorySpecialistTransport` only.
- Never silently fall back to Typhoon or another service (AD-14); never auto-retry quota/transient/unknown outcomes (the adapter does not retry; quarantine is 4.16's concern, not 4.11's).
- Never mutate the prepared artifact or request.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Happy path audio | prepared WAV artifact with bytes + fixture 200 `{transcript,segments,confidence}` | SpecialistResult with `transcript` (text,present), `segments` (structured,present), `confidence` (number,present); emptyFields excludes those; full provenance from adapter | ok |
| Response missing segments | fixture 200 `{transcript,confidence}` | `segments` `present:false` in emptyFields; transcript+confidence present | ok (honest empty) |
| Response missing confidence | fixture 200 `{transcript,segments}` | `confidence` `present:false` in emptyFields | ok |
| Empty transcript | fixture 200 `{transcript:"",segments:[],confidence}` | `transcript` `present:false`, in emptyFields; no fabricated text | ok |
| Malformed response body | fixture 200 non-JSON / wrong shape | handler returns `{ok:false, parseFailure:{category:'malformed-response',…}}`; adapter → `malformed-response` failure | typed failure |
| No audio bytes | artifact `contentKind:'text'` / no `bytes` | `buildTransportRequest` throws → adapter `unknown-outcome` failure | typed failure |
| Transport timeout/network | InMemory transport returns transportError | adapter `mapSpecialistFailure` → `timeout`/`transport` failure | typed failure |
| Quota 429 | fixture 429 response | adapter `mapSpecialistFailure` → `quota`/`rate-limited` failure; no auto-retry; no quarantine in 4.11 | typed failure |
| Unauthorized 401 | fixture 401 response | adapter → `unauthorized` failure | typed failure |
| Raw key never leaks | any path | `headersSummary` `Authorization: [redacted]`; body no key; result JSON no `Bearer`/`sk-`/raw key | secret-free (asserted) |

</intent-contract>

## Code Map

- `cli/src/core/specialists/services/speech/fixture.ts` -- NEW. Reviewed Speech-to-Text fixture: deterministic minimal WAV bytes (valid WAV header + a tiny silent/zero PCM chunk), expected Thai transcript, expected segments, and the defined AI-for-Thai Speech-to-Text response JSON. Pure constants + `buildSpeechResponse(overrides?: Partial<SpeechResponse>)` helper typed against a `SpeechResponse` interface.
- `cli/src/core/specialists/services/speech/speechHandler.ts` -- NEW. `SpeechToTextSpecialistHandler implements SpecialistServiceHandler` (`serviceId: 'speech-to-text'`). `buildTransportRequest`: read `preparedArtifacts[0].bytes`; if absent/non-audio → throw typed Error; base64-encode; body = JSON `{audio, mime}`; `fetchHeaders` = `Authorization: Bearer <key>`, `Content-Type: application/json`; `headersSummary` redacts Authorization. `parseResult`: parse JSON; map `transcript`→`transcript` (text), `segments`→`segments` (structured — array of `{text,start?,end?}` objects, kept verbatim), `confidence`→`confidence` (number); honest `present` flags; return fields OR `{ok:false,parseFailure}` on non-JSON/wrong shape. Deterministic placeholders for adapter-overwritten fields.
- `cli/src/core/specialists/services/speech/index.ts` -- NEW. Barrel.
- `cli/src/core/specialists/services/index.ts` -- MODIFY. Extend `defaultSpecialistHandlers()` to return `[new TocrSpecialistHandler(), new SpeechToTextSpecialistHandler()]`.
- `cli/test/specialistServiceSpeech.test.ts` -- NEW. Offline tests: every I/O matrix row + AC. Reuse the 4.10 test scaffolding patterns (fixed clock, InMemory transport, request/registry/health fixture builders).

## Tasks & Acceptance

**Execution:**
- [ ] `cli/src/core/specialists/services/speech/fixture.ts` -- reviewed audio fixture (WAV bytes + expected transcript + segments + defined response JSON + typed override helper).
- [ ] `cli/src/core/specialists/services/speech/speechHandler.ts` -- `SpeechToTextSpecialistHandler` (buildTransportRequest + parseResult; no invented fields; redacted headers; deterministic placeholders).
- [ ] `cli/src/core/specialists/services/speech/index.ts` -- barrel.
- [ ] `cli/src/core/specialists/services/index.ts` -- add `SpeechToTextSpecialistHandler` to `defaultSpecialistHandlers()`.
- [ ] `cli/test/specialistServiceSpeech.test.ts` -- unit-test every I/O matrix row + AC offline.

**Acceptance Criteria:**
- Given the deterministic audio fixture contains Thai speech and a bounded expected transcript, when the prompt asks to transcribe `@meeting.wav`, then routing selects Speech-to-Text and local validation records codec, duration, size, sensitivity, and minimized transfer identity before consent.
- Given exact consent and current service health exist, when the direct adapter dispatches the fixture, then the returned transcript, segment or timing fields if provided, uncertainty, empty fields, source hash, service/configuration identity, consent reference, and timing are sealed as immutable Evidence.
- Given audio format, duration, size, or sensitivity is unsupported or classification/retention is unverifiable, when preparation or consent is evaluated, then the operation blocks before transport and does not send the original or a silent substitute.
- Given the service returns quota, transient network, or unknown outcome, when the failure is classified, then the result is typed and no automatic retry or alternate service invocation occurs; a single transient failure does not quarantine the service.
- Given the prompt-driven flow is rendered in Thai, narrow, redirected, or headless mode, when the transcript is presented, then Specialist output, Typhoon explanation, confidence/uncertainty, and Evidence remain visibly distinct.

## Spec Change Log

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (medium 1, low 2)
- defer: 0
- reject: 13: (low 13)
- addressed_findings:
  - `[medium]` `[patch]` `segments` used an all-or-nothing `every()` check: a mixed array with one non-object element discarded ALL valid segment objects (data loss), diverging from the 4.10 `words` filter pattern. Now filters per-element to valid segment objects (`typeof object, !null, !Array, text:string`); `present:true` iff ≥1 valid segment remains; valid segments kept verbatim in the `{items}` wrapper. Tests updated: all-invalid → present:false; new mixed valid+invalid → valid kept, invalid dropped.
  - `[low]` `[patch]` speech handler-registration test asserted `handlers[0].serviceId === 't-ocr'`, coupling the speech test to t-ocr's position. Now asserts the speech handler via `find(h => h.serviceId === 'speech-to-text')`.
  - `[low]` `[patch]` removed unused `SpecialistTransport` type import from the test file (confirmed unused by build).
  - `[low]` `[reject]` `buildSpeechResponse` uses the `in` operator for override detection — prototype-chain edge is unreachable; tests pass plain object literals.
  - `[low]` `[reject]` `segments` stored as `structured` `{items:[…]}` — constrained by the 4.9 `SpecialistFieldValue` type (no array-of-objects kind); `structured` is the spec-sanctioned kind for object arrays; the wrapper is a documented convention.
  - `[low]` `[reject]` `mediaType` not re-validated in the handler — upstream-validated by ArtifactResolver (4.6/4.7) against the service's supportedInputs; the handler trusts the prepared artifact per the 4.9 contract (same as 4.10).
  - `[low]` `[reject]` `as SpecialistRequest` / `as Partial<SpeechResponse>` test-helper casts — idiomatic test scaffolding (same as 4.10).
  - `[low]` `[reject]` empty-string-vs-missing `present` collapse for transcript/confidence — by-design `present` semantics (spec-sanctioned, matches 4.10); distinguishing empty-vs-omitted is out of scope.
  - `[low]` `[reject]` `setSpecialistTransportForTest` test is a setter no-op — full invocation-path E2E is the 4.18–4.20 verification stories' job (same as 4.10).
  - `[low]` `[reject]` loose `Partial<SpeechResponse>` fixture typing — the handler validates field types at runtime; the fixture is a test helper.
  - `[low]` `[reject]` whitespace-only transcript / out-of-[0,1] confidence — spec-silent; storing the service value verbatim is honest (no fabrication); matches 4.10.
  - `[low]` `[reject]` empty / double-`Bearer` key — the credential contract (4.3 onboarding) stores a raw key with no prefix; the `resolveRawKey` closure throws on null; unreachable per the onboarding contract (same as 4.10).
  - `[low]` `[reject]` negative elapsedMs / completedAt-before-started / invalid startedAt / empty config-id / empty source-hash / zero timeoutMs — upstream-validated by the effective configuration, prepared manifest, and transport contract; the adapter overwrites `timing`/`provenance`; handler re-validation redundant (same as 4.10).
  - `[low]` `[reject]` duplicated edge-case-hunter findings (whitespace/confidence-range/key/timing/mediaType/segment-subfield) — same root causes as the adversarial findings; the segment-subfield concern is resolved by the segments-filter patch above.

## Design Notes

**Defined AI-for-Thai Speech-to-Text fixture contract (NOT verified against the real endpoint — deferred):**
- Request: `POST <endpoint>`, headers `Authorization: Bearer <key>`, `Content-Type: application/json`, body `{ "audio": "<base64 of audio bytes>", "mime": "<mediaType>" }`.
- Response 200: `{ "transcript": "<Thai text>", "segments": [{ "text": "<string>", "start": <number>, "end": <number> }], "confidence": 0.0–1.0 }`. Any key may be omitted by the service. `segments` may be an empty array.
- The handler maps exactly: `transcript`→`transcript` (text), `segments`→`segments` (structured — the segment objects kept verbatim as a readonly record), `confidence`→`confidence` (number). No other fields synthesized. `uncertainty` is left unset unless the response supplies it (it does not in this contract).

**Fixture audio:** a minimal valid WAV (44-byte header + a small zero-PCM payload) whose bytes are deterministic constants in `fixture.ts`. The expected transcript is a Thai string constant; segments are deterministic.

**Quarantine scope:** 4.11 verifies the typed failure outcome (quota/transient/unknown) from the adapter but does NOT assert quarantine state — quarantine is 4.16's concern. A single transient/quota/unsupported-input failure must NOT quarantine (asserted in 4.16, not here).

**Reuse the 4.10 app test seam:** `setSpecialistTransportForTest` (already test-only guarded) injects the InMemory transport; no new app.ts change needed beyond the aggregator.

## Verification

**Commands:**
- `npm run build` -- expected: tsc clean.
- `npm test -- specialistServiceSpeech` -- expected: all pass.
- `npm test` -- expected: full suite green, no regressions.

## Auto Run Result

**Summary:** Implemented Story 4.11 — the second working Specialist Service integration. `SpeechToTextSpecialistHandler` implements the 4.9 `SpecialistServiceHandler` contract for `speech-to-text`, mirroring the 4.10 pattern: `buildTransportRequest` base64-encodes the prepared audio artifact's bytes into the defined AI-for-Thai Speech-to-Text fixture request (`{audio, mime}` JSON, `Bearer` auth, redacted `headersSummary`); `parseResult` maps `transcript`/`segments`/`confidence` into `SpecialistResult` fields with honest `present` flags and no fabricated data. Registered via `defaultSpecialistHandlers()` (extended alongside `TocrSpecialistHandler`). Then applied 3 review-driven patches.

**Files changed:**
- `cli/src/core/specialists/services/speech/fixture.ts` (NEW) — deterministic WAV fixture (244-byte valid WAV + zero PCM), expected Thai transcript, expected segments, `buildSpeechResponse` helper typed as `SpeechResponse`.
- `cli/src/core/specialists/services/speech/speechHandler.ts` (NEW) — `SpeechToTextSpecialistHandler` (buildTransportRequest + parseResult; redacted headers; per-element segments filter; deterministic placeholders).
- `cli/src/core/specialists/services/speech/index.ts` (NEW) — barrel.
- `cli/src/core/specialists/services/index.ts` (MOD) — `defaultSpecialistHandlers()` now returns `[TocrSpecialistHandler, SpeechToTextSpecialistHandler]`.
- `cli/test/specialistServiceTocr.test.ts` (MOD) — aggregator-count assertion 1→2.
- `cli/test/specialistServiceSpeech.test.ts` (NEW) — 27 offline tests covering every I/O matrix row + AC.

**Review findings breakdown:** 3 patches applied (1 medium: segments data-loss filter; 2 low: test decoupling, unused import), 0 deferred, 13 rejected.

**Follow-up review recommendation:** `true` — the final pass made a review-driven change with data-integrity impact (segments filtering — a mixed array no longer discards valid service-returned segments, which is what Evidence records). An independent follow-up review would confirm the filter + `{items}` wrapper semantics.

**Verification performed:**
- `npm run build` → tsc clean.
- `npx vitest run specialistServiceSpeech` → 27/27 pass.
- `npx vitest run` → 60 files / 1653 tests pass (baseline 60/1652; +1 file, +27 tests, 0 regressions).

**Residual risks:** The AI-for-Thai Speech-to-Text request/response contract is a defined fixture shape, NOT verified against the real endpoint (per the continue.md key-gap decision). Real-endpoint confirmation is deferred. The `segments` array is stored as `structured` `{items:[…]}` because the 4.9 `SpecialistFieldValue` type has no array-of-objects kind — consumers must access `fields.segments.value.items`. No-audio-bytes surfaces as `unknown-outcome` (4.9 contract constraint, same as 4.10).