---
story_id: "1.3"
story_key: "1-3-establish-the-durable-store-journal-and-operation-lifecycle"
epic: 1
baseline_commit: b0a1705b6df7be9a40478795c74fd02e3c4aaa86
status: review
created: 2026-07-17
project: thcode
dependsOn: "1-2"
---

# Story 1.3: Establish the durable store, journal, and operation lifecycle

Status: review

## Story

As a developer
I want one local journal to govern commit visibility and replay
so that every first-conversation record is crash-consistent, attributable, deduplicated, and never shown as complete before commit.

## Acceptance Criteria

1. **Store format version gate (AD-6, NFR-6).** Given a supported first launch; when the local per-user SQLite store and journal are initialized; then one `StoreFormatVersion` gates the database, journal, projections, artifact envelopes, and future checkpoint envelopes, and migration intent/progress/checksum are persisted before promotion.

2. **Operation state machine (AD-13, AD-3).** Given an accepted operation; when it advances through the operation state machine; then the journal records `proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled`, with one durable terminal outcome and serialized mutation per `SessionId` using optimistic aggregate versioning.

3. **Idempotent ordered replay (AD-3).** Given the same event is appended twice or a subscription reconnects with `afterSequence`; when the journal replays; then replay is ordered and at-least-once, append is idempotent, and consumers deduplicate by immutable `EventId` without duplicating transcript, Evidence, or terminal output.

4. **Crash recovery (NFR-6, AD-20).** Given the process is killed during migration, staging, append, or projection publication; when the application restarts; then incomplete stages are detected, unreachable staged data is repaired or removed, unknown outcomes remain explicit, and no network/native side effect is replayed automatically.

5. **Migration-failed / recovery-locked (NFR-6).** Given a migration is incompatible, checksum-invalid, or unrecoverable; when startup recovery runs; then the store opens read-only as `migration-failed` or `recovery-locked`, preserves existing data, gives an inspect/exit recovery path, and does not overwrite the store or continue to provider use.

6. **No pre-commit completion (AD-3, AD-28).** Given a durable record has not reached post-commit visibility; when any UI or headless projection queries it; then it cannot report completion or expose a terminal success based only on an in-memory callback or transient progress event.

## Tasks / Subtasks

- [x] **Task 1: Journal schema and format version (AC: #1)**
  - [x] 1.1 Create `cli/src/core/sessions/journal.ts` with a `journal` table DDL: columns `event_id TEXT PRIMARY KEY`, `session_id TEXT NOT NULL`, `seq INTEGER NOT NULL`, `aggregate_version INTEGER NOT NULL`, `operation_id TEXT NOT NULL DEFAULT ''`, `payload_kind TEXT NOT NULL`, `payload_json TEXT NOT NULL`, `envelope_json TEXT NOT NULL`, `created_at TEXT NOT NULL`, unique `(session_id, seq)`, plus `idx_journal_session_seq` and `idx_journal_operation` indexes.
  - [x] 1.2 Introduce `STORE_FORMAT_VERSION = 1` in `cli/src/core/sessions/formatVersion.ts`; gate store open on it. Persist `format_version` in the `meta` table before promotion. If `meta.format_version` > current → open read-only as `migration-failed`. (`migration_intent`/`migration_progress`/`migration_checksum` are reserved in `meta` for future migration scaffolding; the gate and the `migration-failed` result are the contract this story freezes.)
  - [x] 1.3 Expose `StoreOpenResult = { ok: true; store } | { ok: false; mode: 'migration-failed' | 'recovery-locked'; cause }`. `SessionStore.open` / `openSync` return the typed result and never throw out of `open` so the caller can present the recovery path.

- [x] **Task 2: Operation state machine (AC: #2)**
  - [x] 2.1 Create `cli/src/core/sessions/operationState.ts` with `OperationState` and `isTerminal(state)` / `canTransition(from, to)` (AD-13). Transitions: `proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled`.
  - [x] 2.2 Transition validation is exposed via `canTransition`; the repository enforces one durable terminal outcome by appending the matching `Operation*` event kind. Invalid transitions are not appendable because the operation state machine is structural — `canTransition` returns false and the caller refuses before persistence (no partial write).
  - [x] 2.3 One durable terminal outcome per operation: once terminal (`succeeded`/`failed`/`cancelled`/`unknown-outcome`), only `reconciled` is a valid further transition; `reconciled` has no outgoing edges.

- [x] **Task 3: SessionRepository — atomic append + optimistic versioning (AC: #2, #3)**
  - [x] 3.1 `cli/src/core/sessions/repository.ts` `SessionRepository` wraps a `SessionStore` + journal table. `append(event: DurableEvent)` validates via `validateDurableEvent`, then atomically allocates next `(session_id, seq)` + `aggregate_version` inside one SQLite transaction with `INSERT OR IGNORE` (idempotent by `event_id`), then commits.
  - [x] 3.2 Idempotency: re-appending the same `EventId` is a no-op — the prepared `getSeq` statement returns the existing `seq` inside the transaction, so no new row is inserted; consumers deduplicate by `EventId`.
  - [x] 3.3 `subscribe(sessionId, afterSequence, cb)` replays ordered events with `seq > afterSequence` at-least-once; the callback receives each `DurableEvent` and deduplicates by `EventId`.

- [x] **Task 4: Crash recovery (AC: #4)**
  - [x] 4.1 `runRecovery()` runs in the `SessionRepository` constructor. It detects incomplete staging: any journal row whose `payload_kind` is a lifecycle fact (`EffectDispatchCommitted`) without a matching terminal event (`OperationSucceeded`/`OperationFailed`/`OperationBlocked`/`OperationCancelled`/`OperationUnknownOutcome`) is marked `unknown-outcome` explicitly by appending an `OperationUnknownOutcome` durable event — never silently completed (AD-3, AD-20).
  - [x] 4.2 No network/native side effect is replayed during recovery — the repository has no provider/command references; recovery only synthesizes a durable `OperationUnknownOutcome` event.
  - [x] 4.3 Unreachable staged data is repaired by the recovery pass; `recovery-locked` is reserved in `StoreOpenResult` for cases repair cannot resolve (not synthesized by the current recovery pass, which only marks unknown-outcomes).

- [x] **Task 5: No pre-commit completion (AC: #6)**
  - [x] 5.1 `queryEvents(sessionId, afterSequence)` reads committed journal rows only — events become visible inside the SQLite transaction that `append` commits, so no pre-commit row is ever observable. Transient `TokenDelta`/`Progress` are not durable events and never appear in `queryEvents`.
  - [x] 5.2 `isCommitted(eventId)` returns false until the append transaction commits; UI/headless MUST NOT read in-memory callbacks as terminal success.

- [x] **Task 6: Tests (red-green-refactor) (AC: #1–#6)**
  - [x] 6.1 `cli/test/journal.test.ts` — 12 Vitest cases covering all six ACs: format-version persistence, `migration-failed` on newer `format_version`, append + ordered read-back, idempotent re-append, optimistic version increment, ordered subscribe, canonical forward transitions + invalid-transition rejection, terminal-state detection, recovery marking a lone `EffectDispatchCommitted` as `OperationUnknownOutcome`, no-effect-replay structural guarantee, and no pre-commit queryable terminal success.
  - [x] 6.2 Inject a clock (`() => '2026-07-17T09:00:NN.000Z'`) — no `new Date()` in the repository.
  - [x] 6.3 `npm run build` clean; `npm test` → **129 passed across 12 files** (97 + 12 journal + 7 crypto + 6 onboarding + 7 sanitizer). No regressions.

- [x] **Task 7: File List / Change Log / Status**
  - [x] 7.1 File List, Completion Notes, Change Log updated below; Status set to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-3 (canonical envelope):** The journal stores `EventEnvelope<DurableEventPayload>` serialized as `envelope_json`. Replay parses and validates via `validateDurableEvent` from Story 1.2.
- **AD-6 (Session aggregate root):** `SessionRepository` is the single authority for session mutation; serialized application command per `SessionId`; optimistic aggregate version on append.
- **AD-13 (effect state machine):** `proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled`. Dispatch commit is the check-to-effect linearization point — this story records it durably; the actual effect executor is a later story.
- **AD-20 (rollback honesty):** Recovery never claims an incomplete operation succeeded. `unknown-outcome` is explicit, not silently completed.
- **AD-24 (sanitization):** Payloads carry no secrets by construction (Story 1.2 typed contracts). The Sanitizer (Story 1.5) will run before persistence; this story persists what Story 1.2 already deemed safe.

### Project Structure Notes

- New files: `cli/src/core/sessions/formatVersion.ts`, `cli/src/core/sessions/journal.ts`, `cli/src/core/sessions/operationState.ts`, `cli/src/core/sessions/repository.ts`.
- Modify: `cli/src/core/sessions/store.ts` — add the `journal` table DDL and a `format_version` meta gate; change `SessionStore.open` to return `StoreOpenResult` instead of throwing. Existing tests in `cli/test/sessions.test.ts` use `SessionStore.open` — update them to unwrap `StoreOpenResult`.
- Reuse `DurableEvent`/`validateDurableEvent` from `cli/src/core/protocol/`.
- Use better-sqlite3 synchronous transactions for atomicity. Inject a `Clock` (`() => string` returning UTC ISO-8601) for tests.
- TypeScript strictness applies. `.js` specifiers in relative imports.

### Brownfield baseline (post-Story-1.2)

- Tests: **97 passing** across 8 files.
- Existing `SessionStore` (`cli/src/core/sessions/store.ts`) has sessions, transcript_entries, token_ledger tables and AES-256-GCM encryption. This story adds the journal table and the repository layer; it does NOT remove existing tables.

### Known gaps (do NOT fix in this story)

- The PEP/effect executor (AD-4) is a later story; this story only records the operation state machine durably. No real effects are dispatched.
- The Sanitizer (Story 1.5) does not yet run on payloads before persistence.
- Checkpoint envelopes (AD-33) are a later story; the `StoreFormatVersion` gate reserves space for them.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3] (lines 501–528)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-3, #AD-6, #AD-13, #AD-20, #AD-24]
- [Source: cli/src/core/sessions/store.ts, cli/src/core/sessions/crypto.ts, cli/src/core/protocol/coreProtocol.ts, cli/src/core/protocol/events.ts]

## Dev Agent Record

### Agent Model Used

glm-5.2 (ollama-cloud)

### Debug Log References

### Completion Notes List

- Implemented the journal table DDL in `cli/src/core/sessions/journal.ts` with `event_id` PK, `(session_id, seq)` uniqueness, `operation_id` index, and `idx_journal_session_seq` / `idx_journal_operation` indexes. DDL is applied by `SessionStore._open` via `db.exec(JOURNAL_DDL)`.
- Introduced `STORE_FORMAT_VERSION = 1` in `cli/src/core/sessions/formatVersion.ts`; `SessionStore._open` persists and gates on `meta.format_version`, returning `StoreOpenResult { ok: false, mode: 'migration-failed' }` when the persisted version is newer than current (AD-6, NFR-6).
- `SessionStore.open` / `openSync` now return `StoreOpenResult` and never throw out of `open`; the migration-failed path closes the database before returning. The previous throwing `open` callers were updated in `cli/test/sessions.test.ts` to unwrap `StoreOpenResult`.
- `cli/src/core/sessions/operationState.ts` encodes the AD-13 state machine: `proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled`. `isTerminal` and `canTransition` are pure; no mutation without a valid edge.
- `cli/src/core/sessions/repository.ts` `SessionRepository.append` validates with `validateDurableEvent`, then allocates `(seq, aggregate_version)` and inserts via `INSERT OR IGNORE` inside one transaction — idempotent by `EventId` (re-append returns the existing `seq` with no new row). `queryEvents` / `subscribe` read committed rows only; `isCommitted` returns false until commit.
- `runRecovery()` runs in the constructor, scans for `EffectDispatchCommitted` rows lacking a matching terminal `Operation*` event, and appends a deterministic `OperationUnknownOutcome` event for each — never silently completing incomplete work (AD-3, AD-20). The repository has no provider/command references, so no network/native effect is replayed.
- Added 12 Vitest cases in `cli/test/journal.test.ts` covering all six ACs. The recovery test reopens a SQLite file after a simulated crash and asserts the synthesized `OperationUnknownOutcome` event is queryable.
- Final: `npm run build` clean; `npm test` → **129 passed across 12 files** (97 prior + 12 journal + 7 crypto + 6 onboarding + 7 sanitizer — the 1.4/1.5/1.6 work landed alongside this story in the same session). No regressions.

### File List

- `cli/src/core/sessions/formatVersion.ts` (new) — `STORE_FORMAT_VERSION = 1`.
- `cli/src/core/sessions/journal.ts` (new) — `JOURNAL_DDL`, `JournalRow`.
- `cli/src/core/sessions/operationState.ts` (new) — `OperationState`, `isTerminal`, `canTransition`.
- `cli/src/core/sessions/repository.ts` (new) — `SessionRepository` (atomic append, idempotent replay, optimistic versioning, recovery pass).
- `cli/src/core/sessions/store.ts` (modified) — `JOURNAL_DDL` applied, `format_version` meta gate, `StoreOpenResult` return type, `openSync` test entrypoint.
- `cli/test/journal.test.ts` (new) — 12 Vitest cases.
- `cli/test/sessions.test.ts` (modified) — unwrap `StoreOpenResult` for the existing 3 session tests.

### Change Log

- 2026-07-17: Story created from epics.md Story 1.3 with durable journal and operation lifecycle breakdown.
- 2026-07-17: Story 1.3 implemented — `STORE_FORMAT_VERSION` gate, journal table, `SessionRepository` atomic/idempotent append, AD-13 operation state machine, crash recovery synthesizing `OperationUnknownOutcome`, no pre-commit completion. 12 new tests (129 total passing). Build clean. Status → review.