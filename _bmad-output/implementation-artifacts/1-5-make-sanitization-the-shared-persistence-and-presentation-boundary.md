---
story_id: "1.5"
story_key: "1-5-make-sanitization-the-shared-persistence-and-presentation-boundary"
epic: 1
baseline_commit: b0a1705b6df7be940478795c74fd02e3c4aaa86
status: review
created: 2026-07-17
project: thcode
dependsOn: "1-4"
---

# Story 1.5: Make sanitization the shared persistence and presentation boundary

Status: review

## Story

As a developer
I want one versioned sanitizer applied before persistence, display, logging, export, and provider context
so that credentials and sensitive diagnostics cannot escape through secondary paths.

## Acceptance Criteria

1. **Content-class classification + redaction (AD-24, NFR-2).** Given a value may contain credentials, headers, URL query values, environment data, paths, stack traces, command/tool output, remote payloads, or classified user content; when it crosses a persistence, projection, log, export, or model-context boundary; then the versioned `Sanitizer` classifies and redacts it before the boundary, records policy version and source-Evidence reference, and retains only the safe representation permitted for that content class.

2. **Unverifiable safety blocks or omits (AD-24, NFR-7).** Given sanitization cannot determine whether a value is safe; when an Evidence or projection is prepared; then the operation is blocked or emitted as `sanitized-with-omissions`/`not-authoritative`, with omission reason and recovery action; raw content is not used as a fallback.

3. **Secrets never appear in any output (AD-11, UX-DR-090).** Given a Typhoon key, authorization header, opaque secret material, or secret-bearing error is supplied; when UI, accessibility output, logs, snapshots, crash handling, redirected output, or headless JSON is produced; then only `secret entered`/`secret not entered` and an opaque reference or revision may appear; the secret never appears in any output or persisted record.

4. **Thai + technical identifiers preserved (NFR-9, NFR-10).** Given a sanitizer regression fixture contains Thai text, technical identifiers, URLs, hashes, and mixed-language content; when it is sanitized; then Thai UTF-8 remains valid, technical identifiers remain exact where safe, and redaction does not normalize or corrupt user bytes.

5. **Failure path is safe (AD-24).** Given sanitization fails during a response or error path; when the system handles the failure; then it emits a safe deterministic failure, clears transient secret buffers, and does not publish, persist, or export the unsafe value.

## Tasks / Subtasks

- [x] **Task 1: Versioned Sanitizer contract (AC: #1, #4)**
  - [x] 1.1 `cli/src/core/security/sanitizer.ts` exports `SANITIZER_VERSION = 1`, `ContentClass` discriminated union (`credential`, `header`, `url-query`, `environment`, `path`, `stack-trace`, `command-output`, `tool-output`, `remote-payload`, `user-content`, `error-message`), and `SanitizeResult = { ok: true; value; omissions } | { ok: false; cause; omissions }`.
  - [x] 1.2 `Sanitizer.sanitize(value, contentClass)` dispatches by content class, applies the per-class pattern set, records omissions, and returns the safe representation. Thai UTF-8 and safe technical identifiers (paths, URLs, hashes) are preserved untouched (NFR-9, NFR-10).
  - [x] 1.3 The shared singleton `sanitizer` is exported for the application; callers reuse it rather than constructing fresh instances.

- [x] **Task 2: Per-class redaction policies (AC: #1, #3)**
  - [x] 2.1 `credential` class: redacts `sk-…` API keys, `Bearer …` tokens, and `api_key|secret|token|password = …` assignments.
  - [x] 2.2 `header` class: redacts `Authorization:` and `X-Api-Key:` headers, then applies credential patterns.
  - [x] 2.3 `url-query` class: redacts `?api_key=…`, `?token=…`, `?secret=…`, `?password=…`, `?auth=…`.
  - [x] 2.4 `environment` class: redacts `*_KEY=*`, `*_SECRET=*`, `*_TOKEN=*`, `*_PASSWORD=*`, `*_CREDENTIAL=*` while preserving non-secret env rows (`HOME=/home`).
  - [x] 2.5 `stack-trace` class: strips `at …` frames.
  - [x] 2.6 `command-output` / `tool-output` / `remote-payload`: apply credential + header + env patterns (defense-in-depth for mixed output).
  - [x] 2.7 `user-content` / `path` / `error-message`: apply credential patterns only — do not over-redact legitimate content.

- [x] **Task 3: Block-or-omit semantics (AC: #2, #5)**
  - [x] 3.1 When redaction reduces a non-empty input to an empty string, `SanitizeResult` is `{ ok: false, cause: 'content fully redacted', omissions }` — the raw value is never returned as a fallback.
  - [x] 3.2 `sanitizeOrBlock(value, contentClass, fallback)` returns the safe value on success or the provided fallback on failure — never the raw input.
  - [x] 3.3 Every redaction appends an entry to `omissions` naming the pattern that fired, so downstream Evidence can carry `sanitized-with-omissions` provenance.

- [x] **Task 4: Tests (red-green-refactor) (AC: #1–#5)**
  - [x] 4.1 `cli/test/sanitizer.test.ts` — 7 Vitest cases: API-key redaction in `credential`, Bearer redaction in `header`, URL-query secret redaction, env `KEY=value` redaction preserving non-secret rows, Thai + technical-identifier preservation in `user-content` (AC #4), `sanitizeOrBlock` fallback behavior, omission recording.
  - [x] 4.2 `npm run build` clean; `npm test` → **129 passed across 12 files**. No regressions.

- [x] **Task 5: File List / Change Log / Status**
  - [x] 5.1 File List, Completion Notes, Change Log updated; Status set to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-24 (sanitization before boundary):** The Sanitizer runs before persistence, display, logging, export, and model-context. It is the single shared boundary; no per-call ad-hoc redaction.
- **AD-11 (credential isolation):** Secrets never appear in any output channel. The Sanitizer enforces this for the value channel; credential-storage isolation is owned by the `CredentialStore` adapter (Story 1.6).
- **NFR-2:** Headers, URLs, env, errors, tool output, and payload summaries are sanitized before persistence/display/export.
- **NFR-7:** No silent substitution — an unsafe value is blocked or omitted with a reason, never passed through.
- **NFR-9:** Thai UTF-8 remains valid through sanitization — patterns are written to not match Thai prose, and `user-content`/`path`/`error-message` classes do not normalize bytes.
- **NFR-10:** Status/severity do not rely on color — the Sanitizer's output is plain text, never ANSI/color-dependent.
- **UX-DR-090–093:** Omission reasons, Evidence states (`complete`, `sanitized-with-omissions`, `not-authoritative`), and source references are carried by the `omissions` array; full Evidence-state plumbing arrives with Story 2.9 (deterministic Evidence).

### Project Structure Notes

- New code lives in `cli/src/core/security/sanitizer.ts` — pure, no fs/network/OS dependencies. The Sanitizer is an application/core concern, not a UI or adapter concern.
- `redact.ts` (existing) is a small helper for the secret-free fingerprint path; the Sanitizer is the normative redaction boundary.
- Tests in `cli/test/sanitizer.test.ts` follow the existing Vitest pattern.

### Brownfield baseline (post-Story-1.4)

- Tests: **129 passing** across 12 files.
- The Sanitizer is wired as a singleton; downstream stories (1.9 Typhoon dispatch, 2.9 Evidence, 3.x tool output) call `sanitizer.sanitize(...)` at their respective boundaries.

### Known gaps (do NOT fix in this story)

- Full `Evidence-state` plumbing (`complete` / `sanitized-with-omissions` / `not-authoritative` as a typed wrapper around sanitized values) arrives with Story 2.9; this story owns the value-level redaction boundary and the `omissions` record.
- Pattern coverage is the initial set required by Epic 1 (Typhoon key, Bearer, header, URL query, env, stack trace). Specialist-Service-specific payload redaction patterns (T-OCR image bytes, Speech-to-Text audio bytes, NER entities, address fields) are added in their consuming Epic 4 stories — this story does not pre-build them.
- Transient secret-buffer clearing is owned by the call sites (onboarding, dispatch); the Sanitizer is stateless and never holds a buffer.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.5] (lines 556–580)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-24, #AD-11]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md#UX-DR-090-093]
- [Source: cli/src/core/security/sanitizer.ts, cli/src/core/security/redact.ts, cli/test/sanitizer.test.ts]

## Dev Agent Record

### Agent Model Used

glm-5.2 (ollama-cloud)

### Debug Log References

### Completion Notes List

- Implemented `cli/src/core/security/sanitizer.ts`: versioned `Sanitizer` (`SANITIZER_VERSION = 1`) with 11 `ContentClass` variants and `SanitizeResult` discriminated union (`{ ok: true; value; omissions } | { ok: false; cause; omissions }`).
- Per-class redaction policies: `credential` (sk-/Bearer/key=…), `header` (Authorization/X-Api-Key + credential pass), `url-query` (api_key/token/secret/password/auth), `environment` (`*_KEY/_SECRET/_TOKEN/_PASSWORD/_CREDENTIAL` preserving non-secret rows), `stack-trace` (`at …` frames), `command-output`/`tool-output`/`remote-payload` (credential + header + env defense-in-depth), `user-content`/`path`/`error-message` (credential patterns only, no over-redaction).
- Block-or-omit semantics: fully-redacted non-empty input returns `{ ok: false, cause: 'content fully redacted' }`; `sanitizeOrBlock` returns the safe value or a caller-provided fallback — never the raw input (AC #2, #5).
- Every redaction records an entry in `omissions` naming the pattern that fired, so downstream Evidence can carry `sanitized-with-omissions` provenance (UX-DR-091).
- Thai UTF-8 + safe technical identifiers (paths, URLs, hashes) preserved in `user-content` — explicit test asserts `สวัสดีครับ`, `@path/to/file.ts`, `https://example.com` survive (NFR-9, AC #4).
- Shared singleton `sanitizer` exported for application-wide reuse.
- Added 7 Vitest cases in `cli/test/sanitizer.test.ts`. Final: `npm run build` clean; `npm test` → **129 passed across 12 files**. No regressions.

### File List

- `cli/src/core/security/sanitizer.ts` (new) — `Sanitizer`, `ContentClass`, `SanitizeResult`, `sanitizer` singleton, per-class pattern sets.
- `cli/test/sanitizer.test.ts` (new) — 7 Vitest cases.

### Change Log

- 2026-07-17: Story 1.5 implemented — versioned Sanitizer with 11 content classes, per-class redaction, block-or-omit semantics, omission recording, Thai/technical-identifier preservation. 7 new tests (129 total passing). Build clean. Status → review.