---
title: 'Story 4.12: Integrate Extract Address as a working Specialist Service'
type: 'feature'
created: '2026-07-18'
status: 'done'
review_loop_iteration: 0
baseline_revision: 'a8689cb'
final_revision: '20c572d'
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-9-establish-shared-specialist-adapter-result-and-failure-contracts.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-14-persist-immutable-specialist-evidence-and-versioned-cachemanifest-identity.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-10-integrate-t-ocr-as-a-working-specialist-service.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-11-integrate-speech-to-text-as-a-working-specialist-service.md'
warnings:
  - fixture-based-contract
---

<intent-contract>

## Intent

**Problem:** `defaultSpecialistHandlers()` (4.10/4.11) registers `t-ocr` and `speech-to-text`, so `extract-address` (invokable, `text/plain` input) returns `handler-not-registered` and cannot extract structured Thai address fields from an approved document through the common Specialist flow. 4.12 wires the third working service — a TEXT-input service (unlike 4.10/4.11's binary inputs) — so a prepared, consented text dispatch reaches the direct AI-for-Thai Extract Address endpoint and returns the service-defined address schema with honest empty fields and no fabricated components.

**Approach:** Add an `ExtractAddressSpecialistHandler` implementing the 4.9 `SpecialistServiceHandler` contract (`serviceId: 'extract-address'`), mirroring the 4.10/4.11 pattern but reading the prepared artifact's **text** (`text` or `extractedText`) instead of bytes. `buildTransportRequest` sends the text in a JSON body against a **defined, fixture-based AI-for-Thai Extract Address request shape** with a `Bearer`-authenticated POST and secret-free `headersSummary` (`Authorization: [redacted]`). `parseResult` maps the service-defined address schema into per-component `SpecialistResult` text fields **without fabricating missing components** — each address component is a `SpecialistFieldValue` with an honest `present` flag; absent/empty components are `present:false` and listed in `emptyFields`, never synthesized. Register the handler in `defaultSpecialistHandlers()`. Tests are OFFLINE: `InMemorySpecialistTransport` + a reviewed Thai address fixture (no real network/credentials). The AI-for-Thai per-service API contract is NOT verified against real endpoints — implement against the defined fixture contract and defer real-endpoint confirmation (tracked in deferred-work).

## Boundaries & Constraints

**Always:**
- The handler implements the 4.9 `SpecialistServiceHandler` interface verbatim. Mirror the 4.10/4.11 handler structure; the only material difference is reading text (`preparedArtifacts[0].text ?? preparedArtifacts[0].extractedText`) instead of bytes, and `Content-Type: application/json` with a `{text}` body.
- The raw key is resolved ONLY via `credentialScope.resolveRawKey()` inside `buildTransportRequest`, used for `fetchHeaders.Authorization` only, never in `headersSummary` (redact to `[redacted]`), the body, the result, Evidence, logs, or output (AD-11).
- `parseResult` never fabricates address components: each component present-and-non-empty-string → `present:true` with the service value; absent/null/empty-string/non-string → `present:false` + `emptyFields`. No synthesized house number, street, subdistrict, district, province, or postal code.
- The handler reads text from `request.preparedArtifacts[0].text` (or `extractedText` for PDF/DOCX-extracted content). If no text is available, `buildTransportRequest` throws a typed `Error('extract-address requires a text artifact')` (adapter wraps as `unknown-outcome` — the 4.9 contract cannot emit a typed pre-transport failure; same constraint as 4.10/4.11).
- Confidence carried ONLY when the service provides it. Source spans/provenance carried ONLY when the service provides them (the AC says "source spans or provenance where supplied").
- `.js` import specifiers; `readonly`; no `any`; deterministic placeholders for adapter-overwritten fields (`evidenceRef: undefined`, `sanitizedRawResponseRef: ''`, `createdAt: request.startedAt` — NOT `randomUUID()`/`new Date()`); no `Math.random`/`Date.now`.
- The fixture contract is documented in Design Notes and shared by handler + tests.

**Block If:** (none unattended — deterministic from the prepared text artifact + fixture response)

**Never:**
- Never fabricate any address component the service did not return.
- Never let the raw key escape `buildTransportRequest`'s fetch headers.
- Never make a real network call in tests — `InMemorySpecialistTransport` only.
- Never silently fall back to Typhoon or another service (AD-14); never auto-retry. If a PDF/DOCX parser cannot safely extract text or the original binary is required, the operation blocks before transport (that path is owned by ArtifactResolver 4.6/4.7 + consent 4.8 — the handler only runs on a successfully prepared text artifact; it does not silently send an original binary).
- Never mutate the prepared artifact or request.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Happy path text | prepared text artifact + fixture 200 with full address `{houseNumber,street,subdistrict,district,province,postalCode,confidence}` | SpecialistResult with all six address components (text,present) + `confidence` (number,present); emptyFields excludes those; full provenance from adapter | ok |
| Partial address | fixture 200 with only `province,postalCode` | only those two `present:true`; houseNumber/street/subdistrict/district `present:false` + in emptyFields; no fabricated components | ok (honest empty) |
| Empty component values | fixture 200 with `street:""` | `street` `present:false` + emptyFields; other present components kept | ok |
| Missing confidence | fixture 200 full address, no `confidence` | `confidence` `present:false` in emptyFields | ok |
| Source spans provided | fixture 200 with `sourceSpans:[{field,offset,length}]` | `sourceSpans` (structured,present) kept verbatim | ok |
| Malformed response body | fixture 200 non-JSON / wrong shape | handler returns `{ok:false, parseFailure:{category:'malformed-response',…}}`; adapter → `malformed-response` failure | typed failure |
| No text artifact | artifact with no `text`/`extractedText` | `buildTransportRequest` throws → adapter `unknown-outcome` failure | typed failure |
| Transport timeout/network | InMemory transport returns transportError | adapter `mapSpecialistFailure` → `timeout`/`transport` failure | typed failure |
| Protocol incompatibility / auth failure | fixture 401 / 400 protocol error | adapter → `unauthorized` / `server-error` (or `malformed-response` for protocol) failure; service enters smallest proven unhealthy scope in 4.16, not here | typed failure |
| Raw key never leaks | any path | `headersSummary` `Authorization: [redacted]`; body no key; result JSON no `Bearer`/`sk-`/raw key | secret-free (asserted) |

</intent-contract>

## Code Map

- `cli/src/core/specialists/services/address/fixture.ts` -- NEW. Reviewed Extract Address fixture: a deterministic Thai address text fixture (the input text containing a Thai address), the expected address components, and the defined AI-for-Thai Extract Address response JSON. `AddressResponse` interface (`{address?: {houseNumber?,street?,subdistrict?,district?,province?,postalCode?}, confidence?: number, sourceSpans?: readonly {field:string,offset:number,length:number}[]}`). `buildAddressResponse(overrides?: Partial<AddressResponse>)` helper with `overrides != null` guard.
- `cli/src/core/specialists/services/address/addressHandler.ts` -- NEW. `ExtractAddressSpecialistHandler implements SpecialistServiceHandler` (`serviceId: 'extract-address'`). `buildTransportRequest`: read `preparedArtifacts[0].text ?? preparedArtifacts[0].extractedText`; if absent/empty → throw typed Error; body = JSON `{text}`; `fetchHeaders` = `Authorization: Bearer <key>`, `Content-Type: application/json`; `headersSummary` redacts Authorization. `parseResult`: parse JSON; map each of the six address components → its own text `SpecialistFieldValue` (present iff non-empty string); `confidence` → number; `sourceSpans` → structured (kept verbatim if array of objects, else present:false); honest `present` flags + emptyFields; return fields OR `{ok:false,parseFailure}` on non-JSON/wrong shape. Deterministic placeholders for adapter-overwritten fields.
- `cli/src/core/specialists/services/address/index.ts` -- NEW. Barrel.
- `cli/src/core/specialists/services/index.ts` -- MODIFY. Extend `defaultSpecialistHandlers()` to also include `ExtractAddressSpecialistHandler`.
- `cli/test/specialistServiceAddress.test.ts` -- NEW. Offline tests: every I/O matrix row + AC. Reuse 4.10/4.11 test scaffolding. Assert no fabricated components (partial address → only present components, absent ones in emptyFields). Assert handler-registration via `find` by serviceId (not index).

## Tasks & Acceptance

**Execution:**
- [ ] `cli/src/core/specialists/services/address/fixture.ts` -- reviewed address fixture (input text + expected components + defined response JSON + typed override helper).
- [ ] `cli/src/core/specialists/services/address/addressHandler.ts` -- `ExtractAddressSpecialistHandler` (text input; per-component present flags; no fabricated components; redacted headers; deterministic placeholders).
- [ ] `cli/src/core/specialists/services/address/index.ts` -- barrel.
- [ ] `cli/src/core/specialists/services/index.ts` -- add `ExtractAddressSpecialistHandler` to `defaultSpecialistHandlers()`.
- [ ] `cli/test/specialistServiceAddress.test.ts` -- unit-test every I/O matrix row + AC offline.

**Acceptance Criteria:**
- Given the deterministic Thai address fixture is a Markdown, text, PDF, or DOCX artifact, when the prompt asks to extract the address from `@invoice.pdf`, then routing selects Extract Address and local extraction/minimization records the derived text provenance and any need for the original.
- Given the selected fields and exact transfer are consented, when the direct adapter dispatches, then it returns only the service-defined address schema, preserves empty fields as empty, records uncertainty/confidence and source spans or provenance where supplied, and never fabricates missing address components.
- Given a PDF/DOCX parser cannot safely extract text or the original binary is required, when preparation evaluates the input, then it reports the exact compatibility or policy cause and asks for a separately reviewed original transfer rather than silently sending it.
- Given the service returns protocol incompatibility or deterministic configuration/authentication failure, when the common failure contract classifies it, then the service enters the smallest proven unhealthy scope and the result explains correction and explicit retest.
- Given the result is shown through any output mode, when the user inspects it, then service fields, empty fields, uncertainty, Typhoon explanation, source identity, and Evidence reference are separate and canonical tokens remain unchanged in Thai or mixed output.

## Spec Change Log

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (low 2)
- defer: 1: (low 1)
- reject: 10: (low 10)
- addressed_findings:
  - `[low]` `[patch]` `parseResult` else-branches used dead ternaries (truthy arms unreachable after the `if` guard) for address-component `value` and `confidence` `value` — simplified to plain constants (`''` / `null`) for clarity; `present:false` + emptyFields behavior unchanged.
  - `[low]` `[patch]` confidence present-check accepted `Infinity`/`-Infinity` (`JSON.parse('1e999')` → `Infinity` passes `typeof === 'number'`), and `JSON.stringify(Infinity)` → `null` would silently corrupt Evidence. Added `&& Number.isFinite(parsed.confidence)` so non-finite confidence → `present:false` + emptyFields.
  - `[low]` `[defer]` 4.10/4.11 confidence fields have the same `Number.isFinite` gap (pre-existing relative to 4.12) — logged to `deferred-work.md` for a consistency fix.
  - `[low]` `[reject]` `buildAddressResponse` duplicate default-logic / `{address:undefined}` / extra-keys / non-plain-object overrides — test-fixture helper mechanics; tests control overrides; not a story defect.
  - `[low]` `[reject]` no `contentKind` re-validation in the handler — the artifact pipeline (4.6/4.7) produces consistent artifacts (`contentKind` correlates with text/bytes fields by construction); the handler reading `text ?? extractedText` is correct for a text-input service.
  - `[low]` `[reject]` `sourceSpans` filter keeps any non-null non-array object — spec says spans are "kept verbatim"; storing service-returned span objects verbatim is honest (no fabrication, no dropping); downstream renderers handle structured fields.
  - `[low]` `[reject]` whitespace-only address component passes `length > 0` → `present:true` — spec defines non-empty (length>0); whitespace-only is service-returned content stored verbatim; matches 4.10/4.11 whitespace rejections.
  - `[low]` `[reject]` `resolveRawKey()` throws with no handler try/catch — the adapter's catch-all sanitizes the error message and wraps as `unknown-outcome`; matches the 4.10/4.11 pattern.
  - `[low]` `[reject]` dead-ternary / duplicate-default / undefined-override findings (adversarial) — same root causes as the edge-case findings; the dead-ternary is patched above, the rest are test-helper mechanics.
  - `[low]` `[reject]` duplicated edge-case-hunter findings (whitespace / resolveRawKey / confidence-Infinity) — confidence-Infinity patched above; whitespace and resolveRawKey rejected for the reasons above.

## Design Notes

**Defined AI-for-Thai Extract Address fixture contract (NOT verified against the real endpoint — deferred):**
- Request: `POST <endpoint>`, headers `Authorization: Bearer <key>`, `Content-Type: application/json`, body `{ "text": "<extracted document text>" }`.
- Response 200: `{ "address": { "houseNumber": "<string>", "street": "<string>", "subdistrict": "<string>", "district": "<string>", "province": "<string>", "postalCode": "<string>" }, "confidence": 0.0–1.0, "sourceSpans": [{ "field": "<string>", "offset": <number>, "length": <number> }] }`. The `address` object and every component may be omitted or empty; `confidence` and `sourceSpans` may be omitted.
- The handler maps exactly the six address components each to its own `text` `SpecialistFieldValue` (present iff a non-empty string), `confidence`→number, `sourceSpans`→structured (kept verbatim). No other fields synthesized. No component is fabricated when the service omits/empties it — that is the core honesty guarantee of this story.

**PDF/DOCX original-binary path (AC #3):** owned by ArtifactResolver (4.6/4.7) + consent (4.8), already implemented — when a parser cannot safely extract text or the original binary is required, preparation blocks before transport and reports the compatibility/policy cause. The 4.12 handler only runs on a successfully prepared text artifact; it does not send original binaries. 4.12 tests assert the handler's text-input behavior; the binary-blocking path is covered by the 4.6/4.7/4.8 tests and is not re-tested here.

**Quarantine scope:** 4.12 verifies the typed failure outcome (auth/protocol/transport) from the adapter but does NOT assert quarantine/unhealthy-scope state — that is 4.16's concern.

**Reuse the 4.10 app test seam:** `setSpecialistTransportForTest` (test-only guarded) injects the InMemory transport; no app.ts change needed beyond the aggregator.

## Verification

**Commands:**
- `npm run build` -- expected: tsc clean.
- `npm test -- specialistServiceAddress` -- expected: all pass.
- `npm test` -- expected: full suite green, no regressions.

## Auto Run Result

**Summary:** Implemented Story 4.12 — the third working Specialist Service integration (first TEXT-input service). `ExtractAddressSpecialistHandler` implements the 4.9 `SpecialistServiceHandler` contract for `extract-address`: `buildTransportRequest` reads the prepared artifact's `text`/`extractedText` and sends `{text}` JSON to the defined AI-for-Thai Extract Address fixture endpoint (`Bearer` auth, redacted `headersSummary`); `parseResult` maps the six address components (houseNumber/street/subdistrict/district/province/postalCode) each to its own `text` field with an honest `present` flag, plus `confidence` (number, finite-checked) and optional `sourceSpans` (structured, verbatim). No fabricated components — absent/empty components are `present:false` + emptyFields. Registered via `defaultSpecialistHandlers()`. Then applied 2 review-driven patches.

**Files changed:**
- `cli/src/core/specialists/services/address/fixture.ts` (NEW) — deterministic Thai address text fixture, six expected components, `AddressResponse` interface, `buildAddressResponse` helper.
- `cli/src/core/specialists/services/address/addressHandler.ts` (NEW) — `ExtractAddressSpecialistHandler` (text input; per-component present flags; no fabricated components; finite confidence; redacted headers; deterministic placeholders).
- `cli/src/core/specialists/services/address/index.ts` (NEW) — barrel.
- `cli/src/core/specialists/services/index.ts` (MOD) — `defaultSpecialistHandlers()` now returns 3 handlers (t-ocr, speech-to-text, extract-address).
- `cli/test/specialistServiceTocr.test.ts` + `cli/test/specialistServiceSpeech.test.ts` (MOD) — aggregator-count assertions 2→3.
- `cli/test/specialistServiceAddress.test.ts` (NEW) — 32 offline tests covering every I/O matrix row + AC.

**Review findings breakdown:** 2 patches applied (low: dead-ternary simplification, confidence finite-check), 1 deferred (4.10/4.11 confidence-finite gap), 10 rejected.

**Follow-up review recommendation:** `false` — the final pass made only two localized low-consequence fixes (one data-integrity but very narrow `1e999`→Infinity edge, one cosmetic dead-code simplification). No independent follow-up review warranted.

**Verification performed:**
- `npm run build` → tsc clean.
- `npx vitest run specialistServiceAddress` → 32/32 pass.
- `npx vitest run` → 61 files / 1685 tests pass (baseline 61/1685; +1 file, +32 tests, 0 regressions).

**Residual risks:** The AI-for-Thai Extract Address request/response contract is a defined fixture shape, NOT verified against the real endpoint. Real-endpoint confirmation is deferred. The PDF/DOCX original-binary blocking path (AC #3) is owned by ArtifactResolver (4.6/4.7) + consent (4.8) and is not re-tested here. No-text-artifact surfaces as `unknown-outcome` (4.9 contract constraint, same as 4.10/4.11).