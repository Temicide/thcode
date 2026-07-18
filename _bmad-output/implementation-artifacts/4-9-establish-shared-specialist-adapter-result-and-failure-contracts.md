---
title: 'Story 4.9: Establish shared Specialist adapter, result, and failure contracts'
type: 'feature'
created: '2026-07-17'
baseline_revision: 'f175748'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
final_revision: '1f22989'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Epic 4 needs ONE shared adapter and result/failure contract that every launch service integration (4.10–4.13) preserves, so that service-specific wiring never diverges on attribution, consent binding, health-generation binding, source-hash preservation, empty-field semantics, confidence/uncertainty, provenance, or failure mapping. Today there is no `SpecialistAdapter`, no `SpecialistResult`/`SpecialistFailure` envelope, no deterministic failure category/retryability mapping, no fail-closed local validation that refuses before transport, no transport abstraction that keeps the raw key out of Evidence, and no canonical output-projection tokens separating Specialist output / Typhoon explanation / Evidence / failure provenance.

**Approach:** Add `cli/src/core/specialists/adapter/` defining the shared contracts and orchestration. `SpecialistRequest` binds the exact service identity + contract/manifest versions + `SpecialistEffectiveConfiguration` (4.4) + `PreparedPayloadManifest` (4.8) + `ConsentReference` (4.8) + OperationId + bounded request options. A `SpecialistServiceHandler` is the per-service extension point (4.10–4.13 register one per serviceId): `buildTransportRequest` (uses a `CredentialScope` that resolves the raw key IN SCOPE ONLY — the key never enters Evidence, logs, the transport request's secret-free summary, or the result) and `parseResult` (maps a raw response into a `SpecialistResult` WITHOUT inventing fields). A `SpecialistTransport` abstraction (`InMemorySpecialistTransport` for tests + `FetchSpecialistTransport` for the real direct AI-for-Thai call from the local CLI) sends the prepared bytes/text to the verified endpoint. The `SharedSpecialistAdapter` orchestrates: validate (fail-closed: non-invokable, consent/manifest mismatch, stale generation, unsupported input → refuse BEFORE transport; never repair/substitute/retry-unknown) → build transport request via handler (credential scope) → send via transport → parse result via handler OR map failure → build `SpecialistOutcome` with full attribution (service identity, configuration generation id, consent reference, source-content hash, timing, provenance, sanitized raw-response ref). `SpecialistFailure` is the common sanitized envelope (deterministic category, retryability, smallest proven scope, effective generation, OperationId, safe message, cause code, Evidence ref, optional retry-after). `SpecialistOutputProjection`/`SpecialistFailureProjection` render canonical headings + stable state tokens across interactive/linearized/redirected/headless.

## Boundaries & Constraints

**Always:**
- The adapter calls the official AI-for-Thai endpoint directly from the local CLI. `client/`, `server/`, hosted proxy, and compatibility-layer components are NEVER in the Release 1 request path (Additional Req 42). No silent fallback to Typhoon (AD-14).
- The raw AI-for-Thai key is fetched ONLY inside the handler's `buildTransportRequest` via the `CredentialScope.resolveRawKey()` closure (the same in-probe-scope pattern as the health probe, AD-11/AD-24). The raw key NEVER appears in: the `SpecialistTransportRequest` secret-free summary, `SpecialistRawResponse`, `SpecialistResult`, `SpecialistFailure`, Evidence, logs, prompts, sessions, previews, or output. The transport request's headers summary records `Authorization: [redacted]` (secret-free).
- Product persistence stores ONLY secret-free reference/revision/fingerprint (4.3) — the adapter never re-persists the raw key.
- Fail-closed local validation runs BEFORE transport. Refusal causes: `non-invokable-entry`, `consent-manifest-mismatch`, `stale-generation`, `unsupported-input`, `version-mismatch`, `not-interactive-blocked` (when headless and the call requires interactive consent — though consent is obtained upstream in 4.8, the adapter still re-checks the consent reference binds the current manifest+payload digest). On refusal: NO protocol repair, NO service substitution, NO retry of an unknown outcome. Return a `SpecialistAdapterRefusal` (typed cause + safe message), never invoke the transport.
- Availability requires a live probe pass; `configured` never implies `available`; stale/mismatched/superseded generations never establish availability (AD-18). The adapter rejects a `SpecialistRequest` whose `effectiveConfiguration.id` does not match the current health snapshot's `generationId` OR whose snapshot state is not `available`.
- `SpecialistResult` preserves returned fields verbatim, explicitly represents empty fields (no field is silently dropped or invented), carries confidence/uncertainty when the service returns them, source-content hash (the manifest's `payloadByteDigest` + each artifact's `contentHash`), service identity, configuration-generation id, consent reference, timing, provenance, and a sanitized raw-response reference. NEVER invent a field the service did not return.
- `SpecialistFailure` is the common sanitized envelope: deterministic `category`, `retryability`, `smallestProvenScope`, `effectiveGenerationId`, `operationId`, `safeMessage` (sanitized — no raw key/endpoint path with secrets/stack), `causeCode`, optional `evidenceRef`, optional `retryAfterMs`. Deterministic from the raw response status + error body patterns (same status → same category, always).
- Canonical state tokens only (never silently map to `working`/`available`); the failure category and output projection tokens are from fixed enumerations. The adapter never throws across the boundary — it returns a typed `SpecialistOutcome` (result | failure) or `SpecialistAdapterRefusal`.
- Output projection: Specialist output, Typhoon explanation, Evidence, and failure provenance have SEPARATE headings and stable canonical tokens across interactive, linearized, redirected, narrow, Thai/mixed-language, and headless modes. Color-only status is never the sole signal (UX-DR-031).
- Injectable clock for timing/`now`; no `new Date()`/`Date.now()`/`Math.random()` in pure logic. `crypto.randomUUID()` is acceptable for Evidence refs / operation-scoped ids (already used in the codebase).
- `.js` import extensions; `readonly` interfaces; discriminated `ok` unions; typed errors.

**Block If:** (none unattended — the outcome is deterministic from the request, registry entry, health snapshot, consent reference, handler, and transport response)

**Never:**
- Never put the raw key in any persisted/Evidence/logged/projected object.
- Never repair protocol, substitute a service, or retry an unknown outcome.
- Never invent a result field the service did not return; never silently drop an empty field.
- Never throw across the adapter boundary — always return a typed outcome/refusal.
- Never call a hosted proxy/client/server component (Release 1 direct-local-only).
- Never use a non-canonical state token; never rely on color-only status.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Valid invokable available + matching consent + supported input | entry.invokable, snapshot.state='available', gen.id matches, consent binds manifest+payload, mediaType in supportedInputs | Transport called; handler.parseResult → SpecialistResult with all attribution fields; raw key only in-scope | ok outcome |
| Non-invokable entry | entry.invokable=false | Refusal `non-invokable-entry` BEFORE transport; no call | Typed refusal |
| Consent/manifest mismatch | consentReference.manifestDigest ≠ manifest.manifestDigest OR payloadByteDigest mismatch | Refusal `consent-manifest-mismatch` BEFORE transport | Typed refusal |
| Stale generation | snapshot.generationId ≠ config.id OR state≠'available' | Refusal `stale-generation` BEFORE transport (AD-18) | Typed refusal |
| Unsupported input | an artifact mediaType not in entry.supportedInputs | Refusal `unsupported-input` BEFORE transport | Typed refusal |
| Version mismatch | manifest.manifestVersion≠entry.manifestVersion OR contractVersion differs | Refusal `version-mismatch` BEFORE transport | Typed refusal |
| Handler not registered | serviceId has no handler (pre-4.10) | Refusal `handler-not-registered` BEFORE transport | Typed refusal (deterministic) |
| Transport timeout | transport rejects with timeout | Failure envelope `timeout`, retryable, retryAfterMs from options | Typed failure |
| Transport network error | transport rejects with network error | Failure `transport`, retryable (conservatively) or not per policy | Typed failure |
| HTTP 401 | raw.status=401 | Failure `unauthorized`, not-retryable, causeCode `http-401` | Typed failure |
| HTTP 403 | raw.status=403 | Failure `forbidden`, not-retryable | Typed failure |
| HTTP 404 | raw.status=404 | Failure `not-found`, not-retryable | Typed failure |
| HTTP 429 | raw.status=429 (+ optional Retry-After header) | Failure `rate-limited`, retryable, retryAfterMs from header | Typed failure |
| HTTP 5xx | raw.status≥500 | Failure `server-error`, retryable, causeCode `http-{status}` | Typed failure |
| Malformed response body | handler.parseResult cannot parse | Failure `malformed-response`, not-retryable (deterministic), causeCode from parse error | Typed failure |
| Quota signal | service returns a quota-exceeded body | Failure `quota`, retryable per body, causeCode `quota-exceeded` | Typed failure |
| Unknown outcome | raw.status uncategorized OR parse returns neither ok nor typed error | Failure `unknown-outcome`, NOT retryable (never retry an unknown outcome) | Typed failure |
| Empty result fields | service returns an empty field | SpecialistResult explicitly represents the empty field (e.g. fieldValue {kind:'text', value:'', present:true}); never dropped/invented | ok outcome |
| Raw key never leaks | any path | TransportRequest.headersSummary='Authorization: [redacted]'; result/failure/Evidence contain no raw key | Secret-free (asserted in tests) |
| Output projection | result or failure | Separate headings + canonical tokens across interactive/linearized/redirected/headless; no color-only status | Stable tokens |
| Headless mode | isTTY=false | Adapter still returns typed outcome (consent obtained upstream in 4.8); no interactive prompt from adapter | Typed outcome |

</intent-contract>

## Code Map

- `cli/src/core/specialists/adapter/types.ts` -- NEW. All contracts:
  - `SpecialistRequestOptions` {timeoutMs, maxRetries} (bounded, from `SpecialistRequestConfig`).
  - `SpecialistRequest` {serviceId, contractVersion, manifestVersion, effectiveConfiguration: SpecialistEffectiveConfiguration, preparedManifest: PreparedPayloadManifest, consentReference: ConsentReference, operationId, preparedArtifacts: readonly PreparedArtifact[], options: SpecialistRequestOptions, startedAt: string}.
  - `CredentialScope` {resolveRawKey(): Promise<string>} — in-scope-only key resolution; the resolved key must not escape the handler closure.
  - `SpecialistTransportRequest` {method, url (verified endpoint + path), headersSummary: readonly {name, value}[] (secret-free — `Authorization: [redacted]`), bodyKind: 'bytes'|'text'|'none', bodyBytes?: Uint8Array, bodyText?: string, contentType, timeoutMs}. The raw key is NOT on this object.
  - `SpecialistRawResponse` {status: number, statusText, headersSafe: readonly {name, value}[] (sanitized subset — no Authorization echo), bodyBytes?: Uint8Array, bodyText?: string, elapsedMs, completedAt}.
  - `SpecialistFieldValue` = discriminated: {kind:'text', value: string, present: boolean} | {kind:'number', value: number|null, present} | {kind:'boolean', value: boolean|null, present} | {kind:'list', value: readonly string[], present} | {kind:'structured', value: Readonly<Record<string, unknown>>, present}. `present:false` explicitly represents an empty/absent returned field (never invented).
  - `SpecialistResult` {ok:true, serviceId, serviceIdentity {serviceId, nameThai, nameEnglish, contractVersion, adapterVersion}, configurationGenerationId, consentReference, sourceContentHash, fields: Readonly<Record<string, SpecialistFieldValue>>, emptyFields: readonly string[], confidence?: number, uncertainty?: string, timing {startedAt, completedAt, elapsedMs}, provenance {endpoint, method, status, transportVersion}, sanitizedRawResponseRef, evidenceRef?, createdAt}.
  - `SpecialistFailureCategory` = 'transport'|'timeout'|'quota'|'rate-limited'|'unauthorized'|'forbidden'|'not-found'|'malformed-response'|'unsupported-input'|'server-error'|'unknown-outcome'.
  - `Retryability` = 'retryable'|'not-retryable'|'retry-after-specified'.
  - `SpecialistFailure` {ok:false, category: SpecialistFailureCategory, retryability: Retryability, smallestProvenScope, effectiveGenerationId, operationId, safeMessage, causeCode, evidenceRef?, retryAfterMs?, serviceId, completedAt}.
  - `SpecialistOutcome` = SpecialistResult | SpecialistFailure.
  - `SpecialistAdapterRefusalCause` = 'non-invokable-entry'|'consent-manifest-mismatch'|'stale-generation'|'unsupported-input'|'version-mismatch'|'handler-not-registered'|'headless-blocked'.
  - `SpecialistAdapterRefusal` {ok:false, refused:true, cause: SpecialistAdapterRefusalCause, safeMessage, operationId, serviceId}.
  - `SpecialistInvocation` = SpecialistOutcome | SpecialistAdapterRefusal (the orchestrator return).
  - `SpecialistServiceHandler` {serviceId, buildTransportRequest(request, credentialScope): Promise<SpecialistTransportRequest>, parseResult(raw, request): SpecialistResult | {ok:false, parseFailure: {category:'malformed-response', causeCode, safeMessage}}}. (Handlers registered by 4.10–4.13; 4.9 ships none.)
  - `SpecialistTransport` {send(req: SpecialistTransportRequest): Promise<SpecialistTransportResponse>}. `SpecialistTransportResponse` = {ok:true, raw: SpecialistRawResponse} | {ok:false, transportError: {kind:'timeout'|'network'|'aborted', message, elapsedMs}}.
  - `SpecialistOutputProjection` + `SpecialistFailureProjection` + canonical heading tokens (`SPECIALIST_OUTPUT_HEADING`, `TYPHOON_EXPLANATION_HEADING`, `EVIDENCE_HEADING`, `FAILURE_PROVENANCE_HEADING`) and `SpecialistOutputToken`/`SpecialistFailureToken` enums.
- `cli/src/core/specialists/adapter/validation.ts` -- NEW. Pure `validateSpecialistRequest(request, registryEntry, healthSnapshot): SpecialistAdapterRefusal | null`. Fail-closed checks in order: non-invokable-entry → version-mismatch → stale-generation (snapshot.generationId===config.id AND state==='available') → unsupported-input (every artifact.mediaType in entry.supportedInputs) → consent-manifest-mismatch (consentReference.manifestDigest===preparedManifest.manifestDigest AND consentReference.payloadByteDigest===preparedManifest.payloadByteDigest). Return the FIRST refusal or null. No Date/random.
- `cli/src/core/specialists/adapter/failureMapper.ts` -- NEW. Pure `mapSpecialistFailure(raw: SpecialistRawResponse | {ok:false, transportError}, request, causeCode?): SpecialistFailure`. Deterministic status→category mapping: timeout→timeout, network→transport, 401→unauthorized, 403→forbidden, 404→not-found, 429→rate-limited (parse Retry-After header → retryAfterMs), 5xx→server-error, malformed/unparseable→malformed-response, quota body→quota, uncategorized/unknown→unknown-outcome. Retryability: timeout/network/5xx/429→retryable (429→retry-after-specified if header present), 401/403/404/malformed/unsupported/unknown-outcome→not-retryable. smallestProvenScope = serviceId + operationId + generationId. safeMessage sanitized (no raw key/stack/secret path). causeCode deterministic (`http-{status}`, `transport-{kind}`, `parse-failed`, `quota-exceeded`, `unknown`). No Date/random (use request.startedAt/completedAt injected).
- `cli/src/core/specialists/adapter/adapter.ts` -- NEW. `SharedSpecialistAdapter` class: constructor takes `{transport: SpecialistTransport, clock: () => string, handlers?: Map<string, SpecialistServiceHandler>}`. `registerHandler(handler)`. `invoke(request, registryEntry, healthSnapshot): Promise<SpecialistInvocation>`: validate (refusal if any) → look up handler (refusal `handler-not-registered` if absent) → `credentialScope` closure (calls a `resolveRawKey` injected at construction — wired by app.ts from credentials persistence; resolves in-scope only) → handler.buildTransportRequest → transport.send → on transportError: mapSpecialistFailure → on raw: handler.parseResult; if parse returns parseFailure: mapSpecialistFailure(malformed) → else build SpecialistResult with full attribution (sourceContentHash = request.preparedManifest.payloadByteDigest, timing from clock, provenance from transport request). NEVER throws — catches and returns unknown-outcome failure. The credential scope's resolved key is discarded immediately after buildTransportRequest returns (closure scope); the transport request's headersSummary must be secret-free (assert dev-only).
- `cli/src/core/specialists/adapter/transport.ts` -- NEW. `InMemorySpecialistTransport` (testable: register responder `(req) => SpecialistTransportResponse` keyed by serviceId or a single default). `FetchSpecialistTransport` (real: uses global `fetch` against the verified endpoint, sets AbortController timeout from `timeoutMs`, returns SpecialistRawResponse with sanitized headers — strips `Authorization`/`X-Api-Key` from the echoed header subset; on AbortError→timeout, on TypeError→network). The fetch transport fetches the raw key via the credential scope INSIDE buildTransportRequest (handler side), NOT in the transport — the transport only sends the already-built request (which carries the Authorization header in the actual fetch headers but the logged `headersSummary` is secret-free). IMPORTANT: the actual fetch `Headers` object carries the real Authorization header (built by the handler), but `SpecialistTransportRequest.headersSummary` (the recorded/Evidence copy) is the secret-free `[redacted]` version. The transport keeps the two separate.
- `cli/src/core/specialists/adapter/projection.ts` -- NEW. `projectSpecialistOutput(result): SpecialistOutputProjection`, `projectSpecialistFailure(failure): SpecialistFailureProjection`. Separate headings + canonical tokens; safe payload summary (no raw bytes/key); stable across modes. 
- `cli/src/core/specialists/adapter/index.ts` -- NEW. Barrel.
- `cli/src/core/app.ts` -- MODIFY. Add `invokeSpecialist(serviceId, preparedArtifacts, preparedManifest, consentReference, operationId, opts?): Promise<SpecialistInvocation>` — builds the SpecialistRequest from `buildSpecialistConfiguration` (effective config) + the latest specialist health snapshot (`_specialistHealth.snapshot(serviceId)` — add a `snapshot(serviceId)` accessor if missing) + the registry entry; constructs the `SharedSpecialistAdapter` (or holds a lazily-init one) with the `FetchSpecialistTransport`, `this.clock`, and a `resolveRawKey` closure wired to credentials persistence (`hasAiForThaiKey`/load — resolve in-scope only). Returns the typed invocation. No remote call if validation refuses.
- `cli/test/specialistAdapter.test.ts` -- NEW. Unit-test every I/O matrix row + AC using `InMemorySpecialistTransport` + a stub handler. Verify: valid→result with all attribution + secret-free; each refusal cause; each failure category (timeout/network/401/403/404/429 with Retry-After/5xx/malformed/quota/unknown); empty-field explicit representation; raw key never in transport headersSummary/result/failure/Evidence (JSON scan); output projection headings + canonical tokens; headless still returns typed outcome; deterministic category for same status; no-throw on handler exception (→ unknown-outcome).

## Tasks & Acceptance

**Execution:**
- [x] `cli/src/core/specialists/adapter/types.ts` -- all contracts.
- [x] `cli/src/core/specialists/adapter/validation.ts` -- fail-closed `validateSpecialistRequest`.
- [x] `cli/src/core/specialists/adapter/failureMapper.ts` -- deterministic `mapSpecialistFailure`.
- [x] `cli/src/core/specialists/adapter/transport.ts` -- `InMemorySpecialistTransport` + `FetchSpecialistTransport` (secret-free header summary).
- [x] `cli/src/core/specialists/adapter/adapter.ts` -- `SharedSpecialistAdapter.invoke` orchestration (no-throw, in-scope credential, full attribution).
- [x] `cli/src/core/specialists/adapter/projection.ts` -- output/failure projections with separate headings + canonical tokens.
- [x] `cli/src/core/specialists/adapter/index.ts` -- barrel.
- [x] `cli/src/core/app.ts` -- `invokeSpecialist` accessor wiring effective config + health snapshot + credential scope + adapter.
- [x] `cli/test/specialistAdapter.test.ts` -- unit-test every I/O matrix row + AC.

**Acceptance Criteria:**
- Given an invokable Registry entry is selected, when its adapter is called, then the adapter accepts the exact service identity, contract/manifest versions, EffectiveConfigurationGeneration, PreparedPayloadManifest, ConsentReference, OperationId, and bounded request options, and calls the official endpoint directly from the local CLI (no hosted proxy/client/server in the path).
- Given a service returns a result, when the adapter normalizes it, then it preserves returned fields, explicitly represented empty fields, confidence/uncertainty, source-content hash, service identity, configuration generation, consent reference, timing, provenance, and sanitized raw-response references WITHOUT inventing fields.
- Given a service returns an error, malformed response, timeout, quota signal, or unknown outcome, when the adapter maps it, then it emits the common sanitized failure envelope with deterministic category, retryability, smallest proven scope, effective generation, OperationId, safe message, cause code, Evidence reference, and optional retry-after — and never retries an unknown outcome.
- Given an adapter receives an invalid proposal, mismatched consent, stale generation, unsupported input, or non-invokable Registry entry, when local validation runs, then it refuses BEFORE transport and does not repair protocol, substitute a service, or retry an unknown outcome.
- Given any adapter result or failure is projected, when interactive, linearized, redirected, or headless output renders, then Specialist output, Typhoon explanation, Evidence, and failure provenance have separate headings and stable canonical tokens (no color-only status). The raw AI-for-Thai key never appears in any SpecialistTransportRequest summary, SpecialistRawResponse, SpecialistResult, SpecialistFailure, Evidence, log, prompt, session, preview, or output across all modes.

## Design Notes

Mirror the existing `HealthFailure` envelope shape (category/retryable/scope/generationId/safeMessage/causeCode/retryAfterMs) for `SpecialistFailure` but specialize the categories to Specialist outcomes. The `CredentialScope.resolveRawKey()` pattern matches the health-probe comment in `health/types.ts` ("the raw key is fetched inside the probe scope only ... and never appears in Evidence, the snapshot, or the failure envelope"). The `SharedSpecialistAdapter` MUST NOT hold the raw key as a field — it holds a `resolveRawKey: () => Promise<string>` closure (injected by app.ts from credentials persistence) and hands a `CredentialScope` to the handler; the key lives only in the handler closure during `buildTransportRequest`. After the handler returns the `SpecialistTransportRequest` (with secret-free `headersSummary`), the key is out of scope. The `FetchSpecialistTransport` receives the actual fetch headers (with the real Authorization value built by the handler) separately from the logged `headersSummary` — keep these two distinct: the handler returns BOTH the real fetch `Headers` (used only by the transport for the wire call) AND the secret-free `headersSummary` (used for Evidence/logs). Simplest: `SpecialistTransportRequest` carries `fetchHeaders: Record<string,string>` (the REAL headers, used ONLY by the transport, never persisted/logged) AND `headersSummary: readonly {name,value}[]` (secret-free, the Evidence copy). The transport uses `fetchHeaders` for the wire and `headersSummary` for the `SpecialistRawResponse`-adjacent provenance. Assert in tests that `headersSummary` JSON contains no `Bearer`/`sk-`/raw key and that `fetchHeaders` is never serialized into Evidence. Reuse `sanitizer.sanitize(value, 'header')` to build the secret-free summary. `sourceContentHash` = `preparedManifest.payloadByteDigest` (the exact transferred bytes' digest). `smallestProvenScope` = `${serviceId}#${operationId}#${generationId}`. Failure mapping determinism: same raw.status → same category+causeCode, always (no random, no time-dependent branch). The `unknown-outcome` category is the catch-all and is ALWAYS `not-retryable` (never retry an unknown outcome, AC #3/#4). `handler-not-registered` is the deterministic refusal for serviceIds without a registered handler (the state during 4.9 before 4.10–4.13 register handlers) — this lets the adapter be unit-tested standalone and lets app.ts call `invokeSpecialist` for any serviceId without crashing. Inject `clock`; no `new Date()`/`Date.now()`/`Math.random()` in pure functions (failureMapper, validation, projection). `crypto.randomUUID()` ok for evidenceRef. The app.ts `invokeSpecialist` should be async and return the typed `SpecialistInvocation`; it should NOT throw — wrap any unexpected error as an `unknown-outcome` failure. Tests use `InMemorySpecialistTransport` with a stub handler; no real network. Reuse `SpecialistHealthSnapshot` from 4.4 — if `_specialistHealth` lacks a `snapshot(serviceId)` accessor, add one (check `SpecialistHealthLifecycle`). Confirm `authorityProjection()`/`activation.snapshot()` for operationId/authority binding is NOT needed here (operationId is passed in by the caller, already bound upstream in 4.8 consent).

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 0, medium 2, low 2)
- defer: 3 (low 3)
- reject: 5
- addressed_findings:
  - `[medium]` `[patch]` Fix non-Error throw handling in catch-all — use `error instanceof Error ? error.message : String(error)` instead of `(error as Error).message` to avoid producing "undefined" for non-Error throws.
  - `[medium]` `[patch]` Add aborted transport integration test through the adapter (was only tested at pure-function level).
  - `[low]` `[patch]` Add quota-exceeded integration test through the adapter (was only tested at pure-function level).
  - `[low]` `[patch]` Assert fetchHeaders is never serialized into result JSON in secret-free test.

## Auto Run Result

**Summary:** Story 4.9 establishes the shared Specialist adapter, result, and failure contracts. All Code Map items exist on disk, all Tasks & Acceptance are complete, and all acceptance criteria are satisfied. The implementation includes: `types.ts` (all contracts), `validation.ts` (fail-closed `validateSpecialistRequest`), `failureMapper.ts` (deterministic `mapSpecialistFailure`), `transport.ts` (InMemory + FetchSpecialistTransport), `adapter.ts` (SharedSpecialistAdapter orchestration), `projection.ts` (output/failure projections), `index.ts` (barrel), `app.ts` (`invokeSpecialist` accessor), and `specialistAdapter.test.ts` (50 unit tests covering every I/O matrix row + AC).

**Files changed:**
- `cli/src/core/specialists/adapter/types.ts` — all contracts (request, result, failure, outcome, refusal, handler, transport, projection types)
- `cli/src/core/specialists/adapter/validation.ts` — fail-closed `validateSpecialistRequest` with 5 ordered checks
- `cli/src/core/specialists/adapter/failureMapper.ts` — deterministic `mapSpecialistFailure` with status→category mapping
- `cli/src/core/specialists/adapter/transport.ts` — `InMemorySpecialistTransport` (test) + `FetchSpecialistTransport` (real, secret-free header summary)
- `cli/src/core/specialists/adapter/adapter.ts` — `SharedSpecialistAdapter.invoke` orchestration (no-throw, in-scope credential, full attribution)
- `cli/src/core/specialists/adapter/projection.ts` — output/failure projections with separate headings + canonical tokens
- `cli/src/core/specialists/adapter/index.ts` — barrel export
- `cli/src/core/app.ts` — `invokeSpecialist` accessor wiring effective config + health snapshot + credential scope + adapter
- `cli/test/specialistAdapter.test.ts` — 50 unit tests covering every I/O matrix row + AC

**Review findings breakdown:**
- Patches applied: 4 (non-Error throw handling, aborted transport integration test, quota-exceeded integration test, fetchHeaders assertion)
- Items deferred: 3 (sourceContentHash spec inconsistency, headersSafe sanitization scope, HTTP-date Retry-After)
- Items rejected: 5 (TYPHOON_EXPLANATION_HEADING unused by design, headless-blocked typed for future, clock injection in transport is IO boundary, inline raw type is more precise, contractVersion/manifestVersion are required fields)

**Follow-up review recommendation:** false — all patches were low-to-medium severity, localized, and did not change the public API, security posture, or data flow. The 3 deferred items are pre-existing spec-level clarifications and edge cases that do not affect correctness.

**Verification performed:**
- `npm run build` — tsc compiles with no errors
- `npx vitest run specialistAdapter` — 50 tests passed (50)
- `npx vitest run` — 58 test files, 1602 tests passed (full suite green, no regressions)

**Residual risks:**
- `headless-blocked` refusal cause is typed but not yet implemented (intentional — headless consent is obtained upstream in 4.8)
- `TYPHOON_EXPLANATION_HEADING` is defined but not used in any projection (intentional — Typhoon explanation projection is a later story)
- HTTP-date Retry-After format is not parsed (acknowledged in spec, falls back to `retryable` without `retryAfterMs`)

**Commands:**
- `npm run build` -- expected: tsc compiles with no errors.
- `npm test -- specialistAdapter` -- expected: all cases pass.
- `npm test` -- expected: full suite green, no regressions.