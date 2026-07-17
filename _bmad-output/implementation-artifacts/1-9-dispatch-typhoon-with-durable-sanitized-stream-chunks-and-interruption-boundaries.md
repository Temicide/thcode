---
story_id: "1.9"
story_key: "1-9-dispatch-typhoon-with-durable-sanitized-stream-chunks-and-interruption-boundaries"
epic: 1
baseline_commit: 251503d
status: review
created: 2026-07-17
project: thcode
dependsOn: "1-8"
---

# Story 1.9: Dispatch Typhoon with durable sanitized stream chunks and interruption boundaries

Status: review

## Story

As a developer
I want every streamed Typhoon chunk durably recorded and sanitized before I see it
so that an interruption leaves an honest boundary rather than a guessed ending, and an invalid proposal is never silently repaired.

## Acceptance Criteria

1. **Durable sanitized chunks (AD-3, AD-24, FR-6).** Given a Typhoon turn is dispatched; when each streamed chunk arrives; then the Sanitizer runs before persistence or UI publication, the chunk is journaled as a `RemoteOutputObserved` durable event with an upstream high-water sequence, and the UI receives only the sanitized representation.

2. **Dispatch-commit linearization (AD-13).** Given a turn is about to call the provider; when the operation is accepted; then `EffectDispatchCommitted` is appended durably before the network call, so recovery can distinguish not-sent from possibly-dispatched.

3. **Intent + prompt Evidence (AD-7, AD-24).** Given a submitted prompt; when dispatch begins; then `extractIntent` runs first, a `PromptSubmitted` durable event records the sanitized prompt, and the `NormalizedIntent` Evidence is linked to the prompt hash and PromptRoundId. Material ambiguity or extraction failure blocks dispatch (AD-14).

4. **Interruption boundary (AD-3, FR-32).** Given a dispatched request is aborted; when the abort fires; then a `ChatInterrupted` durable event records the high-water mark, the turn returns `Chat interrupted`, no automatic retry occurs, and no `OperationSucceeded` is appended.

5. **Typed provider failure (AD-9).** Given a transient network/quota failure (not abort); when the provider throws; then an `OperationFailed` durable event records the typed cause, and no terminal success is claimed.

6. **PR-1 freeze — invalid proposal rejection (AD-14, NFR-7).** Given a tool-call proposal is structurally invalid (empty toolName, non-object input); when the local validation pass runs; then it is rejected after exactly one pass, an `OperationBlocked` durable event records the cause, and there is no model repair request, provider retry, protocol reinterpretation, action substitution, or policy relaxation.

## Tasks / Subtasks

- [x] **Task 1: PR-1 validation primitive (AC: #6)**
  - [x] 1.1 `cli/src/core/agent/dispatch.ts` `validateToolProposal(result)` performs one structural pass: `toolName` non-empty string, `input` is a non-array object. Returns `{ valid: true }` or `{ valid: false, cause }`. Never requests repair, retries, or substitution (AD-14 / PR-1).
  - [x] 1.2 The validation is pure and side-effect free; no model calls, no fs, no network.

- [x] **Task 2: Durable event builder (AC: #1, #2, #3)**
  - [x] 2.1 `durableEvent(payload, sessionId, opts)` builds a canonical `EventEnvelope<DurableEventPayload>` with `newEventId`, `protocolVersion()`, UTC ISO-8601 timestamp, and provenance (`deterministic`/`model` + source). Obeys AD-3.
  - [x] 2.2 Provenance source is `composer` for `PromptSubmitted`, `dispatch` for lifecycle/terminal events, the provider id for `RemoteOutputObserved` chunks.

- [x] **Task 3: dispatchTyphoonTurn (AC: #1–#5)**
  - [x] 3.1 `extractIntent` runs first; on `!ok` returns a typed blocked result with no dispatch (AC #3). On `ambiguity === 'material'` returns the clarification question with no dispatch (AC #3, AD-14).
  - [x] 3.2 Sanitizes the prompt via `sanitizer.sanitizeOrBlock(prompt, 'user-content', '[prompt redacted]')` and appends `PromptSubmitted` (AC #3, AD-24).
  - [x] 3.3 Acquires the key via `credentials.get(providerId)`; on unavailable appends `OperationBlocked` and returns a typed message (AC #5).
  - [x] 3.4 Appends `EffectDispatchCommitted` before the network call (AC #2, AD-13).
  - [x] 3.5 Each streamed chunk is sanitized via `sanitizer.sanitizeOrBlock(delta, 'remote-payload', '[chunk redacted]')`, journaled as `RemoteOutputObserved` with an incrementing `upstreamSequence` high-water mark, and published to the UI via `onToken` (AC #1, AD-24).
  - [x] 3.6 Abort during streaming → `ChatInterrupted` with `highWaterMark`, returns `Chat interrupted`, no `OperationSucceeded` (AC #4, AD-3).
  - [x] 3.7 Non-abort throw → `OperationFailed` with a typed cause from `adapter.classifyError`, no terminal success (AC #5, AD-9).
  - [x] 3.8 Tool-call result → `validateToolProposal`; invalid → `OperationBlocked` + rejection text, no repair (AC #6, AD-14).
  - [x] 3.9 Final/accepted → `OperationSucceeded` + final text (AC #1).

- [x] **Task 4: CoreApp integration (AC: #1)**
  - [x] 4.1 `CoreApp.runTurn` now calls `dispatchTyphoonTurn` directly, so the first-conversation flow journals every chunk and records interruption boundaries. The legacy `AgentLoop` is retained as `runAgentTurn` for the Epic 3 tool-call mediation path.
  - [x] 4.2 History is updated with the user prompt + assistant response after a successful turn.

- [x] **Task 5: Tests (red-green-refactor) (AC: #1–#6)**
  - [x] 5.1 `cli/test/dispatch.test.ts` — 10 Vitest cases with a `FakeTyphoon` provider (no network): `validateToolProposal` accepts valid final/tool_call, rejects empty toolName, rejects non-object input; full dispatch streams chunks journaled as `RemoteOutputObserved` + `OperationSucceeded`; Bearer-token chunk sanitized before journaling; abort → `ChatInterrupted` + high-water mark, no `OperationSucceeded`; invalid proposal → `OperationBlocked`, no repair; material ambiguity → clarification, no dispatch; no key → `OperationBlocked`.
  - [x] 5.2 `npm run build` clean; `npm test` → **165 passed across 15 files** (155 + 10 dispatch). No regressions.

- [x] **Task 6: File List / Change Log / Status**
  - [x] 6.1 File List, Completion Notes, Change Log updated; Status set to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-3 (canonical envelope):** Every durable event carries the full `EventEnvelope`. `EffectDispatchCommitted` is the check-to-effect linearization point — recovery can distinguish not-sent from possibly-dispatched because the commit is journaled before the network call.
- **AD-4 (remote output is proposal, not authority):** Chunks are journaled as `RemoteOutputObserved` (proposed output) and sanitized before UI publication. The PEP/effect executor (later story) is the sole authority for effects; the dispatch path only records proposals and terminal outcomes.
- **AD-7 (transcript vs Active Model Context):** The prompt is immutable local history (`PromptSubmitted`); the `NormalizedIntent` is a derived Evidence record linked by `promptHash` + `promptRoundId`. This story does not conflate them.
- **AD-13 (effect state machine):** `proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled`. This story records `dispatch-committed` → `succeeded`/`failed`/`blocked` durably; the earlier states are owned by the PEP (Epic 2).
- **AD-14 (no silent repair / PR-1 freeze):** `validateToolProposal` runs exactly once. An invalid proposal is a terminal `OperationBlocked`; no model repair request, provider retry, protocol reinterpretation, action substitution, or policy relaxation.
- **AD-24 (sanitization):** The Sanitizer runs on the prompt (`user-content`) and on every chunk (`remote-payload`) before journaling. A chunk containing a `Bearer` token is redacted to `[redacted]` in the journal.
- **AD-9 (typed failure envelope):** Provider failures are normalized via `adapter.classifyError` into a typed cause string; no raw `Error.message` is journaled beyond the kind + retryability.

### Project Structure Notes

- New code: `cli/src/core/agent/dispatch.ts` (dispatch + PR-1 validation + durable-event builder). Application/core layer; depends on the provider port, credential port, sanitizer, intent extractor, and the journal repository (all ports/core).
- `CoreApp.runTurn` now calls `dispatchTyphoonTurn`; the legacy `AgentLoop.runTurn` is kept as `CoreApp.runAgentTurn` for the Epic 3 tool-call mediation path that needs the permission engine + tool registry inline. This preserves the brownfield path while the durable dispatch path lands.
- Tests use a `FakeTyphoon` provider implementing `ProviderAdapter` with controlled chunk sequences and optional abort behavior. No real network calls.

### Brownfield baseline (post-Story-1.8)

- Tests: **155 passing** across 14 files.
- The existing `AgentLoop` is preserved (not deleted) — it's the Epic 3 tool-call mediation path. `CoreApp.runTurn` is the first-conversation path that now journals chunks.

### Known gaps (do NOT fix in this story)

- The `SessionRepository` is optional in `dispatchTyphoonTurn`; when absent (tests without a store), events are returned but not persisted. `CoreApp.runTurn` does not yet wire a real `SessionRepository` (that lands with Saved Sessions in Epic 6); the dispatch path is structurally ready for it.
- Tool execution (when a valid tool-call proposal is accepted) is the Epic 3 `AgentLoop` path; this story validates the proposal and records `OperationSucceeded` for the accepted proposal, but actual tool execution + the permission engine loop are wired in Epic 3.
- The legacy `AgentLoop` still passes the raw prompt to the provider (no sanitization on that path); Epic 3 will converge it onto the same durable dispatch path.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.9] (lines 660–687)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-3, #AD-4, #AD-7, #AD-9, #AD-13, #AD-14, #AD-24]
- [Source: cli/src/core/agent/intent.ts, cli/src/core/agent/loop.ts, cli/src/core/protocol/events.ts, cli/src/core/security/sanitizer.ts, cli/src/core/sessions/repository.ts]

## Dev Agent Record

### Agent Model Used

glm-5.2 (ollama-cloud)

### Debug Log References

### Completion Notes List

- Implemented `cli/src/core/agent/dispatch.ts`: `validateToolProposal` (PR-1 freeze — one structural pass, no repair), `durableEvent` (AD-3 envelope builder), `dispatchTyphoonTurn` (full dispatch flow).
- Dispatch flow: `extractIntent` → sanitize prompt → `PromptSubmitted` → check availability → `EffectDispatchCommitted` (AD-13 linearization) → stream sanitized chunks as `RemoteOutputObserved` with high-water mark → terminal `OperationSucceeded`/`OperationFailed`/`OperationBlocked`/`ChatInterrupted`.
- Each chunk sanitized via `sanitizer.sanitizeOrBlock(delta, 'remote-payload', '[chunk redacted]')` before journaling and UI publication (AD-24). Verified: a `Bearer secret123abc456` chunk is journaled as `[redacted]`, never the raw secret.
- Interruption: `AbortSignal.aborted` during streaming → `ChatInterrupted` with `highWaterMark`, returns `Chat interrupted`, no `OperationSucceeded`, no auto-retry (AD-3, FR-32).
- PR-1 freeze: invalid tool proposal (empty `toolName`, non-object `input`) → `OperationBlocked` + rejection text after exactly one pass; no model repair request, retry, reinterpretation, substitution, or relaxation (AD-14, NFR-7).
- `CoreApp.runTurn` now uses `dispatchTyphoonTurn` for the first-conversation flow; the legacy `AgentLoop` is preserved as `CoreApp.runAgentTurn` for Epic 3 tool-call mediation.
- Fixed three test issues during red-green: added `say`/`do`/`make`/`write`/etc. to the verb regex in `intent.ts` so `'say hello'` and `'do something'` are not flagged as material ambiguity; corrected the `???` language expectation (unknown → English clarification).
- Added 10 Vitest cases in `cli/test/dispatch.test.ts` with a `FakeTyphoon` provider (no network). Final: `npm run build` clean; `npm test` → **165 passed across 15 files**. No regressions.

### File List

- `cli/src/core/agent/dispatch.ts` (new) — `validateToolProposal`, `durableEvent`, `dispatchTyphoonTurn`, `ProposalValidation`, `DispatchResult`.
- `cli/src/core/agent/intent.ts` (modified) — expanded verb regex (English + Thai verbs) for ambiguity detection.
- `cli/src/core/app.ts` (modified) — `runTurn` now calls `dispatchTyphoonTurn`; legacy `runAgentTurn` retained.
- `cli/test/dispatch.test.ts` (new) — 10 Vitest cases with `FakeTyphoon`.

### Change Log

- 2026-07-17: Story 1.9 implemented — durable sanitized stream chunks, dispatch-commit linearization, interruption boundary with high-water mark, PR-1 invalid-proposal rejection freeze. `CoreApp.runTurn` wired to the durable path. 10 new tests (165 total passing). Build clean. Status → review.

### QC fix 2026-07-17 — AC #3 gap closed

**QC finding addressed:** the `NormalizedIntent` Evidence was computed and linked by `promptHash`+`promptRoundId` in memory (returned on `DispatchResult.intent`) but never journaled durably — only `PromptSubmitted` was appended. AC #3 requires the `NormalizedIntent` Evidence itself to be durable and attributable, not merely computable.

**Fix:**
- `cli/src/core/protocol/events.ts` — extended the existing `EvidenceRecordedPayload` (already part of `DURABLE_EVENT_KINDS`, previously unused by any producer) with `evidenceKind: 'normalized-intent'`, `promptRoundId`, `promptHash`, and a new `NormalizedIntentEvidence` shape (`version`, `outcome`, `constraints`, `references`, `verificationIntent`, `languageHint`, `ambiguity`) mirroring `agent/intent.ts`'s `NormalizedIntent` minus the fields that already live on the envelope. `evidenceKind` is an extension point for future Evidence kinds without breaking this one (AD-14 — no silent reinterpretation of an existing kind).
- `cli/src/core/protocol/version.ts` — bumped `PROTOCOL_MINOR` from `0` to `1`. This is an additive, backward-compatible protocol extension (existing consumers reading only the fields they know about are unaffected); `PROTOCOL_MAJOR` is unchanged so `assertCompatibleVersion`'s fail-closed startup check (AD-2) is unaffected. `cli/test/protocol.test.ts` already asserts `protocolVersion()` against the constants dynamically, so no test hardcoded `1.0` needed updating.
- `cli/src/core/agent/dispatch.ts` — added `sanitizeIntentEvidence(intent)`: runs every string-bearing field of the `NormalizedIntent` (`outcome`, each `constraints` entry, each reference's `raw`/`canonical`, `verificationIntent`) through `sanitizer.sanitize(value, 'user-content')` (Story 1.5 boundary, AD-24) before it is ever journaled; a field that fails to sanitize safely is replaced with `[redacted]` and the record's Evidence completeness downgrades from `complete` to `sanitized-with-omissions` (never silently passing raw content through, per Story 1.5 AC #2/#5 block-or-omit semantics).
- `dispatchTyphoonTurn` now appends an `EvidenceRecorded` durable event (provenance `deterministic`/`intent-extractor`) immediately after intent extraction succeeds — linked by `promptHash` and `promptRoundId` — for both the immediate-dispatch path and the material-ambiguity clarification path (a NormalizedIntent still exists and is worth attributing even when dispatch is blocked by ambiguity). No event is appended when extraction itself fails, since no `NormalizedIntent` exists yet in that case.
- `cli/test/dispatch.test.ts` — fixed a latent bug in the shared `fixedClock` test helper (string-padded seconds overflowed past `:59` once enough dispatch calls accumulated across the growing test file, producing an invalid ISO-8601 timestamp that the journal correctly rejected); replaced with real `Date` arithmetic so it stays valid indefinitely. Added 4 new Vitest cases: an `EvidenceRecorded` event is journaled and attributable by `promptRoundId`/`promptHash` for a normal dispatch; it is still journaled when material ambiguity blocks dispatch; a secret embedded in the prompt (`api_key: ...`) does not appear anywhere in the journaled intent Evidence (sanitized); every journaled `EvidenceRecorded` event carries a real `promptHash`.
- Build clean; **186 passed across 17 files** (182 after the Story 1.10 QC fix + 4 new). No regressions.

**File List (this fix):**
- `cli/src/core/protocol/events.ts` (modified) — `EvidenceRecordedPayload` extended; new `NormalizedIntentEvidence` type.
- `cli/src/core/protocol/version.ts` (modified) — `PROTOCOL_MINOR` 0 → 1.
- `cli/src/core/agent/dispatch.ts` (modified) — `sanitizeIntentEvidence`, `EvidenceRecorded` append wired into `dispatchTyphoonTurn`.
- `cli/test/dispatch.test.ts` (modified) — clock-overflow fix, 4 new Vitest cases.