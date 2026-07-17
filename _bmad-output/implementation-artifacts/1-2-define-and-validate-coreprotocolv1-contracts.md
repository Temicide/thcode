---
story_id: "1.2"
story_key: "1-2-define-and-validate-coreprotocolv1-contracts"
epic: 1
baseline_commit: b0a1705b6df7be9a40478795c74fd02e3c4aaa86
status: review
created: 2026-07-17
project: thcode
dependsOn: "1-1"
---

# Story 1.2: Define and validate CoreProtocolV1 contracts

Status: review

## Story

As a developer
I want one versioned protocol for intents, events, projections, and transient updates
so that Ink, redirected text, headless JSON, persistence, and adapters cannot disagree about authoritative state.

## Acceptance Criteria

1. **Exhaustive discriminated unions (AD-2, AD-3).** Given the protocol package is built; when CoreProtocolV1 is compiled and exercised; then it defines exhaustive discriminated unions for prompt, session, health, capability, operation, Evidence, and base authority/status intents, plus `Session`, `Status`, `Context`, `Artifact`, and `Capability` projections and durable lifecycle/Evidence versus transient `TokenDelta`/`Progress` events.

2. **Canonical envelope (AD-3).** Given an operation or event is accepted; when its envelope is serialized; then it contains `SessionId`, `PromptRoundId`, `OperationId`, immutable `EventId`, schema version, UTC timestamp, and deterministic or model provenance, with stable UTF-8 handling for Thai and technical identifiers.

3. **Unknown variant rejection (AD-2, AD-14, NFR-7).** Given a UI or adapter sends an unknown variant, missing required envelope field, or incompatible major protocol version; when CoreApp validates it; then it rejects the input deterministically, fails startup for incompatible major versions, records a sanitized validation outcome where a store is available, and performs no effect or partial projection update.

4. **Surface parity (AD-2, UX-DR-031).** Given the same protocol fixture is consumed by Ink, redirected text, headless JSON, and persistence; when each surface renders it; then canonical state tokens and field meanings remain identical, including `configured`, `checking`, `available`, `unavailable`, `unknown-outcome`, `complete`, `Chat interrupted`, and `percentage unavailable` where applicable.

5. **Fail-closed compatibility tests (NFR-7, NFR-15).** Given a malformed protocol fixture or failed compatibility test; when the test suite runs; then it fails closed with the offending schema/version identified and does not silently coerce, repair, reinterpret, or drop the unknown data.

## Tasks / Subtasks

- [x] **Task 1: CoreProtocolV1 module skeleton (AC: #1)**
  - [x] 1.1 Create `cli/src/core/protocol/version.ts` with `PROTOCOL_MAJOR = 1`, `PROTOCOL_MINOR = 0`, and `protocolVersion()` returning `"1.0"`. Document AD-2/AD-3 in the header.
  - [x] 1.2 Create `cli/src/core/protocol/ids.ts` with opaque branded types: `SessionId`, `PromptRoundId`, `OperationId`, `EventId` (each a branded string), plus `newSessionId()`, `newPromptRoundId()`, `newOperationId()`, `newEventId()` generators using `crypto.randomUUID()`.
  - [x] 1.3 Create `cli/src/core/protocol/provenance.ts` with `Provenance` type (`deterministic | model`) carrying source label and optional adapter/service id.

- [x] **Task 2: Canonical envelope (AC: #2)**
  - [x] 2.1 Create `cli/src/core/protocol/envelope.ts` with `EventEnvelope<T>` carrying `id: EventId`, `sessionId`, `promptRoundId?`, `operationId?`, `schemaVersion: string` (must equal `protocolVersion()`), `timestamp: string` (UTC ISO-8601), `provenance: Provenance`, and `payload: T`.
  - [x] 2.2 `validateEnvelope(env, expectedMajor)`: returns `{ ok: true } | { ok: false; cause }`. Checks: `schemaVersion` major matches; all required id fields present and non-empty; `timestamp` is valid UTC ISO-8601; `provenance` is one of the allowed kinds. No secret scanning here (envelopes carry no secrets by construction).
  - [x] 2.3 UTF-8 stability: envelope serialization uses `JSON.stringify` which is UTF-8 safe; add a test that Thai strings and technical identifiers round-trip through `serializeEnvelope` / `parseEnvelope` byte-for-byte.

- [x] **Task 3: Intents — exhaustive discriminated union (AC: #1)**
  - [x] 3.1 Create `cli/src/core/protocol/intents.ts` with `Intent` discriminated union by `type`:
    - `prompt.submit` `{ text: string }`
    - `session.create | session.open | session.close | session.list | session.rename | session.delete`
    - `mode.set | mode.toggle`
    - `profile.set`
    - `health.check | health.retest`
    - `capability.list | capability.inspect | capability.enable | capability.disable`
    - `operation.approve | operation.deny | operation.cancel`
    - `context.inspect | context.pin | context.unpin | context.compact`
    - `boundary.list | boundary.revoke`
    - `exit`
  - [x] 3.2 Export `isIntent(v): v is Intent` type guard that rejects unknown `type` strings (AD-14 fail-closed).

- [x] **Task 4: Events — durable vs transient (AC: #1)**
  - [x] 4.1 Create `cli/src/core/protocol/events.ts` with two unions:
    - `DurableEvent` (persisted, post-commit): `PromptSubmitted`, `ChatInterrupted`, `RemoteOutputObserved`, `EffectDispatchCommitted`, `OperationSucceeded`, `OperationFailed`, `OperationBlocked`, `OperationCancelled`, `OperationUnknownOutcome`, `HealthChanged`, `CapabilityChanged`, `EvidenceRecorded`, `ContextCompacted`. Each carries the AD-28 operation status / lifecycle fact / Evidence completeness qualifiers as appropriate.
    - `TransientEvent`: `TokenDelta { delta: string }`, `Progress { message: string; ratio?: number }`.
  - [x] 4.2 Each durable event carries its own typed payload; none carry secrets or raw vendor payloads (AD-24).
  - [x] 4.3 `DurableEvent` payloads use the canonical state tokens from AC #4 verbatim: `configured`, `checking`, `available`, `unavailable`, `unknown-outcome`, `complete`, `Chat interrupted`, `percentage unavailable`.

- [x] **Task 5: Projections (AC: #1, #4)**
  - [x] 5.1 Create `cli/src/core/protocol/projections.ts` with `SessionProjection`, `StatusProjection`, `ContextProjection`, `ArtifactProjection`, `CapabilityProjection`. Each is a plain serializable object (no methods) so Ink, redirected text, and headless JSON render the same fields.
  - [x] 5.2 `StatusProjection` carries: `workMode`, `permissionProfile`, `fullAccess`, `providerId`, `modelId`, `healthState` (canonical token), `contextPercent | 'percentage unavailable'`, `enforcementVerified: boolean`.
  - [x] 5.3 `CapabilityProjection` carries the canonical capability states from UX-DR-101: `working`, `Catalogued — Not available yet`, `disabled`, `unconfigured`, `unhealthy`, `quarantined`.

- [x] **Task 6: CoreProtocolV1 facade + validation (AC: #1, #3)**
  - [x] 6.1 Create `cli/src/core/protocol/coreProtocol.ts` exporting:
    - `PROTOCOL_V1` constant with version, intent guard, event discriminator, projection validators.
    - `validateIntent(v): { ok: true; intent } | { ok: false; cause }` — rejects unknown variants (AD-14).
    - `validateDurableEvent(v): { ok: true; event } | { ok: false; cause }`.
    - `assertCompatibleVersion(major: number): void` — throws `ProtocolVersionMismatch` on major mismatch (startup fail-closed).
  - [x] 6.2 `ProtocolVersionMismatch` error carries `expected` and `received` majors; safe to log (no secrets).

- [x] **Task 7: Tests (red-green-refactor) (AC: #1–#5)**
  - [x] 7.1 `cli/test/protocol.test.ts` — cases: valid intent accepted; unknown intent type rejected; valid durable event accepted with full envelope; missing `schemaVersion` rejected; wrong major version rejected by `assertCompatibleVersion`; Thai text round-trips through `serializeEnvelope`/`parseEnvelope`; `StatusProjection` uses canonical tokens (`percentage unavailable`, `unknown-outcome`); `CapabilityProjection` uses UX-DR-101 tokens; transient `TokenDelta`/`Progress` are NOT durable; malformed fixture fails closed with offending schema/version identified.
  - [x] 7.2 Exhaustiveness test: a `Record<Intent['type'], true>` map fails to compile if a new intent type is added without covering it (compile-time guard). Mirror for durable events.
  - [x] 7.3 Run `npm run build` and `npm test` from `cli/`; confirm no regressions (target ≥77 passing).

- [x] **Task 8: Wire CoreApp to assert protocol version on startup (AC: #3)**
  - [x] 8.1 In `cli/src/core/app.ts` constructor, call `assertCompatibleVersion(PROTOCOL_MAJOR)` as the first statement (fail-closed startup). Do NOT restructure `CoreApp` beyond this one line + import.
  - [x] 8.2 Update `cli/src/index.ts` preflight-supported path comment to note that protocol-version compatibility is checked in `CoreApp` construction.

- [x] **Task 9: File List / Change Log / Status**
  - [x] 9.1 Update File List, Completion Notes, Change Log; set Status to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-2 (CoreApp facade):** CoreProtocolV1 is the shared contract. UI uses only `dispatch(intent)`, `subscribe`, `query`. This story defines the contract types and validators; the actual `dispatch`/`subscribe`/`query` methods on `CoreApp` arrive incrementally in later stories (1.3+). Do NOT build the full reactive subscription bus here — only the typed contract + validators.
- **AD-3 (canonical envelope):** Every durable event carries the full envelope. `SessionRepository` (Story 1.3) will atomically allocate sequence + version; this story only defines the envelope shape and validator.
- **AD-14 (no silent repair):** Unknown variants are rejected after one validation pass. No coercion, re-interpretation, or model repair request.
- **AD-24 (sanitization):** Envelopes and payloads carry no secrets by construction. Validation does not need to scan for secrets (the Sanitizer Story 1.5 owns that), but payloads MUST be typed to forbid raw vendor payloads / credentials.
- **AD-28 (five dimensions):** Event payloads keep operation status, lifecycle fact, Evidence completeness, measurement quality, and process exit mechanically distinct. `OperationSucceeded`/`OperationFailed`/`OperationBlocked`/`OperationCancelled`/`OperationUnknownOutcome` are operation statuses; `Chat interrupted` and `effect-already-committed` are lifecycle facts; `complete`/`partial`/`stale` are Evidence completeness; `percentage unavailable`/`estimated` are measurement quality.

### Project Structure Notes

- New code lives in `cli/src/core/protocol/` (`version.ts`, `ids.ts`, `provenance.ts`, `envelope.ts`, `intents.ts`, `events.ts`, `projections.ts`, `coreProtocol.ts`). Obeys hexagonal boundary; protocol is application/core layer.
- Use branded string types for ids (compile-time nominal typing without runtime overhead). `SessionId = string & { readonly __brand: 'SessionId' }`.
- TypeScript strictness applies. Use `import type` for type-only imports. `.js` specifiers in relative imports (NodeNext).
- Tests in `cli/test/protocol.test.ts` follow the existing Vitest pattern (`globals: false`, node env).
- Do NOT remove or alter the existing `CoreApp` methods (`status`, `setMode`, `runTurn`, etc.) — only add the `assertCompatibleVersion` call.

### Brownfield baseline (post-Story-1.1)

- Tests: **77 passing** across 7 files (added `preflight` 15).
- Existing types to converge toward (do NOT break): `cli/src/core/permissions/types.ts` (`WorkMode`, `PermissionProfile`), `cli/src/core/providers/types.ts` (`ProviderCapabilities`, `ProviderAvailability`), `cli/src/core/context/types.ts` (`ContextBuildResult`). CoreProtocolV1 may reference these as the canonical source for those vocabulary words, or re-declare them in protocol/ and have the others import from protocol/ — prefer the latter to make protocol/ the single source of truth for the shared contract.

### Known gaps (do NOT fix in this story)

- `SessionRepository` (Story 1.3) does not yet exist; the envelope validator runs against in-memory objects in tests only.
- The Sanitizer (Story 1.5) does not yet run on payloads; this story's payloads are typed to forbid secrets but no runtime sanitization occurs yet.
- `dispatch`/`subscribe`/`query` reactive bus is a later story; this story only defines the typed contract + validators + startup version check.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2] (lines 475–499)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-2, #AD-3, #AD-14, #AD-24, #AD-28]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md#UX-DR-031, #UX-DR-101]
- [Source: cli/src/core/app.ts, cli/src/core/permissions/types.ts, cli/src/core/providers/types.ts, cli/src/core/context/types.ts]

## Dev Agent Record

### Agent Model Used

glm-5.2 (ollama-cloud)

### Debug Log References

### Completion Notes List

- Implemented CoreProtocolV1 under `cli/src/core/protocol/` (8 files): `version.ts`, `ids.ts`, `provenance.ts`, `envelope.ts`, `intents.ts`, `events.ts`, `projections.ts`, `coreProtocol.ts`.
- Exhaustive discriminated unions for Intent (26 variants) and DurableEventPayload (13 kinds) + TransientEvent (`TokenDelta`, `Progress`). Compile-time exhaustiveness maps enforce coverage.
- Canonical `EventEnvelope<T>` with `SessionId`/`PromptRoundId`/`OperationId`/`EventId` branded ids, `schemaVersion`, UTC ISO-8601 `timestamp`, `provenance`. `validateEnvelopeShape` checks all required fields, major-version match, timestamp validity, and provenance kind.
- `validateIntent` and `validateDurableEvent` reject unknown variants (AD-14), identify the offending schema/version in the cause (AC #5), and never coerce/repair.
- `assertCompatibleVersion` throws `ProtocolVersionMismatch` on major mismatch; wired as the first statement in `CoreApp` constructor (fail-closed startup, AD-2).
- Projections are plain serializable objects using canonical tokens verbatim: `percentage unavailable`, `unknown-outcome`, `configured`/`checking`/`available`/`unavailable`, `Catalogued — Not available yet` (UX-DR-101).
- Thai + technical-identifier round-trip test confirms UTF-8 stability through `serializeEnvelope`/`parseEnvelope`.
- 20 new Vitest cases in `cli/test/protocol.test.ts`. Final: `npm run build` clean; `npm test` → **97 passed across 8 files** (77 + 20). No regressions.

### File List

- `cli/src/core/protocol/version.ts` (new)
- `cli/src/core/protocol/ids.ts` (new)
- `cli/src/core/protocol/provenance.ts` (new)
- `cli/src/core/protocol/envelope.ts` (new)
- `cli/src/core/protocol/intents.ts` (new)
- `cli/src/core/protocol/events.ts` (new)
- `cli/src/core/protocol/projections.ts` (new)
- `cli/src/core/protocol/coreProtocol.ts` (new)
- `cli/test/protocol.test.ts` (new)
- `cli/src/core/app.ts` (modified — `assertCompatibleVersion(PROTOCOL_MAJOR)` as first constructor statement)

### Change Log

- 2026-07-17: Story created from epics.md Story 1.2 with comprehensive CoreProtocolV1 contract breakdown.
- 2026-07-17: Story 1.2 implemented — CoreProtocolV1 typed contract, envelope validation, fail-closed startup, 20 new tests (97 total passing), build clean. Status → review.