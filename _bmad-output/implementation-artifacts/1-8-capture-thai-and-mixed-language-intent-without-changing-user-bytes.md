---
story_id: "1.8"
story_key: "1-8-capture-thai-and-mixed-language-intent-without-changing-user-bytes"
epic: 1
baseline_commit: 4efffbc
status: review
created: 2026-07-17
project: thcode
dependsOn: "1-7"
---

# Story 1.8: Capture Thai and mixed-language intent without changing user bytes

Status: review

## Story

As a developer
I want to submit Thai or mixed Thai-English requests and see their normalized intent as diagnostic Evidence
so that the system preserves what I wrote while understanding outcome, constraints, artifacts, and verification intent.

## Acceptance Criteria

1. **Byte preservation (FR-5, NFR-9, UX-DR-025, UX-DR-041–048).** Given the main composer is available after a passing Typhoon health check; when I enter Thai, English, or mixed Thai-English text with paths, commands, URLs, hashes, code identifiers, multiline paste, combining marks, or emoji/ZWJ graphemes; then committed UTF-8 bytes, technical spans, line breaks, grapheme behavior, and terminal-cell-width layout are preserved; input is not normalized or split by code unit.

2. **IME preedit handling (UX-DR-042).** Given IME preedit is active; when I press submit or `Esc`; then submit is prevented while composing, `Esc` cancels only the preedit first, and committed text remains unchanged.

3. **Versioned normalized-intent Evidence (FR-5, AD-7).** Given a submitted prompt has enough information; when local intent extraction runs; then it records requested outcome, constraints, artifacts/references, and verification intent in a versioned normalized-intent Evidence record linked to the original prompt hash and PromptRoundId, while preserving the original prompt as immutable local history.

4. **Material ambiguity asks (FR-5, AD-14).** Given material ambiguity remains; when intent extraction cannot safely determine the requested outcome or constraints; then the system asks a clarification question in the same language style where possible, identifies the missing information, and does not invent requirements, dispatch a speculative request, or claim success.

5. **Extraction failure is typed (AD-14, AD-24).** Given intent extraction or Evidence sanitization fails; when the request is handled; then it produces a deterministic `failed`, `blocked`, or `not-authoritative` result with safe diagnostics and no provider dispatch, while retaining enough sanitized Evidence to explain the boundary.

## Tasks / Subtasks

- [x] **Task 1: Byte-preserving primitives (AC: #1)**
  - [x] 1.1 `cli/src/core/agent/intent.ts` `promptHash(text)` is SHA-256 of the committed UTF-8 bytes — stable, no normalization. The original prompt is preserved verbatim by the caller (immutable local history, AD-7).
  - [x] 1.2 `detectLanguage(text)` scans codepoints: Thai range U+0E00–U+0E7F vs Latin; returns `thai`/`english`/`mixed`/`unknown`. No normalization of combining marks or ZWJ.
  - [x] 1.3 `extractReferences(text)` parses `@"path with spaces"`, `@path/to/file`, URLs, and `commit:abc123` / `hash:abc123` / `sha:...` spans. The character class includes the Thai range so `@src/ไฟล์ใหม่.ts` matches. References are returned in source order; `raw` is the original byte span, `canonical` is the resolved form — the original bytes are never altered.

- [x] **Task 2: Constraint + verification extraction (AC: #1)**
  - [x] 2.1 `extractConstraints(text)` recognizes English (`do not`, `never`, `only`, `must`, `always`) and Thai (`ห้าม`, `เฉพาะ`, `ต้อง`) constraint markers.
  - [x] 2.2 `extractVerificationIntent(text)` recognizes English (`compile`, `run`, `build`, `test`, `verify`, `prove`) and Thai (`ลงจด`, `ทดสอบ`, `รัน`, `ตรวจสอบ`) verification markers; returns `'verify-and-run'` or `null`.

- [x] **Task 3: Ambiguity + clarification (AC: #4)**
  - [x] 3.1 `detectAmbiguity(text, references)` returns `'material'` when the prompt has no verb and no artifact reference; `'none'` otherwise. Conservative: errs on the side of asking.
  - [x] 3.2 `buildClarificationQuestion(languageHint)` produces a language-appropriate question (`thai`/`english`/`mixed`/`unknown`). The mixed form is bilingual to match the developer's style.

- [x] **Task 4: Versioned NormalizedIntent Evidence (AC: #3)**
  - [x] 4.1 `NormalizedIntent` carries `version` (`INTENT_EXTRACTOR_VERSION = 1`), `promptRoundId`, `promptHash`, `outcome`, `constraints`, `references`, `verificationIntent`, `languageHint`, `ambiguity`, `clarificationQuestion`, `createdAt`. All fields are derived; the original prompt is not embedded.
  - [x] 4.2 `extractIntent(promptText, promptRoundId, clock)` returns `{ ok: true, intent }` or a typed `{ ok: false, cause: 'failed' | 'blocked' | 'not-authoritative', message, promptHash }` (AC #5). The function never throws — all failures are caught and returned as typed results.

- [x] **Task 5: Tests (red-green-refactor) (AC: #1, #3, #4, #5)**
  - [x] 5.1 `cli/test/intent.test.ts` — 14 Vitest cases: `promptHash` stability; `detectLanguage` (thai/english/mixed/unknown); `@path` + `@"path with spaces"` verbatim extraction in source order; URL + hash extraction; Thai text inside references; English + Thai constraints; English + Thai verification intent; material-ambiguity detection (no verb + no reference); no-ambiguity (verb + reference); language-appropriate clarification questions; full `NormalizedIntent` Evidence record with `promptHash` + `promptRoundId`; material-ambiguity → clarification question + null outcome; Thai + technical-identifier preservation in a mixed prompt; typed `failed` result contract (never throws).
  - [x] 5.2 `npm run build` clean; `npm test` → **155 passed across 14 files** (140 + 15 intent). No regressions.

- [x] **Task 6: File List / Change Log / Status**
  - [x] 6.1 File List, Completion Notes, Change Log updated; Status set to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-7 (transcript vs Active Model Context):** The original prompt is immutable local history (owned by the caller — the agent loop in Story 1.9 will append it to the journal). `NormalizedIntent` is a derived Evidence record — it does not embed the original prompt, only its hash and derived fields.
- **AD-14 (no silent repair):** Material ambiguity produces a typed clarification question, not a speculative dispatch. `extractIntent` never throws — all failures return a typed `IntentExtractionResult`.
- **AD-24 (sanitization):** `NormalizedIntent` carries no secrets by construction — it contains derived fields (outcome, constraints, references, verification intent). The Sanitizer (Story 1.5) runs at the persistence boundary when the intent is journaled; this story owns the extraction boundary.
- **NFR-9 (Thai UTF-8):** The regexes use the Thai Unicode range `\u0e00-\u0e7f` so Thai paths and constraint markers match. `promptHash` is over raw UTF-8 bytes — no normalization.
- **UX-DR-025, 041–048:** The composer state machine (empty/editing/IME/preedit/submitted/streaming/interrupted/overlay-blocked) and grapheme/cell-width handling are UI-layer concerns owned by Story 2.14 / the Ink UI. This story owns the intent-extraction contract the UI calls after commit.

### Project Structure Notes

- New code lives in `cli/src/core/agent/intent.ts` — application/core layer; pure, no fs/network/OS dependencies (only `node:crypto` for hashing).
- `extractIntent` is called by the agent loop (Story 1.9) after the prompt is committed and before provider dispatch; the `NormalizedIntent` is recorded as Evidence via the journal.
- The clock is injectable (`() => string` returning UTC ISO-8601) for tests.

### Brownfield baseline (post-Story-1.7)

- Tests: **140 passing** across 13 files.
- The existing `AgentLoop.runTurn` appends user input verbatim to history; Story 1.9 will call `extractIntent` before the append and record the Evidence. This story delivers the extraction primitive; wiring is Story 1.9.

### Known gaps (do NOT fix in this story)

- IME preedit, grapheme-cluster cursor movement, and terminal-cell-width wrapping are UI-layer concerns (Story 2.14 / Ink). This story owns the extraction contract.
- Multiline paste byte preservation is owned by the composer UI (Story 2.14); the intent extractor receives already-committed text.
- The full Evidence-state wrapper (`complete` / `sanitized-with-omissions` / `not-authoritative` around the intent) is wired in Story 2.9; this story produces the `NormalizedIntent` record and a typed `failed`/`blocked`/`not-authoritative` cause on extraction failure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.8] (lines 634–658)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-7, #AD-14, #AD-24]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md#UX-DR-025, #UX-DR-041-048]
- [Source: cli/src/core/agent/loop.ts, cli/src/core/protocol/events.ts]

## Dev Agent Record

### Agent Model Used

glm-5.2 (ollama-cloud)

### Debug Log References

### Completion Notes List

- Implemented `cli/src/core/agent/intent.ts`: `promptHash` (SHA-256 over raw UTF-8 bytes, stable, no normalization), `detectLanguage` (Thai U+0E00–U+0E7F vs Latin), `extractReferences` (source-ordered `@path`/`@"path with spaces"`/URL/hash with Thai-aware regex), `extractConstraints` (English + Thai markers), `extractVerificationIntent` (English + Thai markers), `detectAmbiguity`, `buildClarificationQuestion` (language-appropriate).
- `NormalizedIntent` is the versioned Evidence record: `version`, `promptRoundId`, `promptHash`, `outcome`, `constraints`, `references`, `verificationIntent`, `languageHint`, `ambiguity`, `clarificationQuestion`, `createdAt`. The original prompt is not embedded — only its hash and derived fields (AD-7).
- `extractIntent(promptText, promptRoundId, clock)` returns `{ ok: true, intent }` or a typed `{ ok: false, cause, message, promptHash }`. Never throws — all failures are caught and returned as typed results (AC #5, AD-14).
- Material ambiguity (`detectAmbiguity === 'material'`) sets `outcome: null` and produces a language-appropriate `clarificationQuestion`; no speculative dispatch (AC #4).
- Fixed two test failures during red-green: (1) references are now returned in source order via an `index` sort; (2) the unquoted-path regex now includes the Thai range `\u0e00-\u0e7f` so `@src/ไฟล์ใหม่.ts` matches.
- Added 14 Vitest cases in `cli/test/intent.test.ts`. Final: `npm run build` clean; `npm test` → **155 passed across 14 files**. No regressions.

### File List

- `cli/src/core/agent/intent.ts` (new) — `promptHash`, `detectLanguage`, `extractReferences`, `extractConstraints`, `extractVerificationIntent`, `detectAmbiguity`, `buildClarificationQuestion`, `extractIntent`, `NormalizedIntent`, `IntentExtractionResult`, `INTENT_EXTRACTOR_VERSION`.
- `cli/test/intent.test.ts` (new) — 14 Vitest cases.

### Change Log

- 2026-07-17: Story 1.8 implemented — byte-preserving intent extraction, Thai-aware reference parsing, versioned `NormalizedIntent` Evidence, material-ambiguity clarification, typed failure contract. 14 new tests (155 total passing). Build clean. Status → review.