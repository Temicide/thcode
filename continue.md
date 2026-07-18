# Continue — thcode BMAD dev-auto loop (Epic 4)

**Updated:** 2026-07-18 ~10:05 (Asia/Bangkok)
**Branch:** `update/prototype-v1` · GitHub `Temicide/thcode`
**Product:** `cli/` only. `client/` + `server/` are out of the Release-1 path — do not touch.

## Status this session — 10 of 20 Epic-4 stories DONE & pushed

All stories that had specs are now `done`, dual-reviewed (adversarial + edge-case),
and committed. Build clean; **58 test files / 1602 tests pass** (baseline was 57/1535).

| Story | Status | Commit | Notes |
|---|---|---|---|
| 4.1  | done | (prior) | Capability Registry — was already done. |
| 4.2  | done | 4e06980 | Review was completed in a prior session; flipped to done. |
| 4.3  | done | ed3b8e4 | 13 review patches (raw error-leak removal, EPIPE-safe I/O, unknown-outcome cleanup). follow-up=true. |
| 4.4  | done | a62de47 | 8 patches (unhandled-rejection guard, validation, case-insensitive protocol). 3 deferred. |
| 4.5  | done | 05b3904 | 13 patches (empty-string universal-match misrouting, intentAmbiguity dead-code wiring, secret-key filter). follow-up=true. |
| 4.6  | done | f72be21 | 9 patches (PDF/DOCX extractedText, permission-denied fail-closed, WebP sniff). 4 deferred. follow-up=true. |
| 4.7  | done | f368984 | 17 patches (JPEG/WAV/PNG/VP8 parser hardening, +6 tests). |
| 4.8  | done | 519c30a | 1 bad_spec (newline vs colon digest framing — spec amended) + 5 patches (serviceId cross-validation). 3 deferred. |
| 4.9  | done | 7626ca8 | 4 patches (non-Error throw handling, integration tests). 3 deferred. |
| 4.14 | done | 7e2258d + 0fb7bc4 | NEWLY IMPLEMENTED this session: seal/repository/projection/index + app.ts accessors + 42 tests. 4 review patches (no invented ConsentReference/serviceIdentity, structured-sanitization preserves structure, no fabricated request options). follow-up=true. |

`deferred-work.md` accumulated entries from 4.4/4.6/4.8/4.9 — review before/with the next stories.

## What remains — 4.10–4.20 (NO specs yet)

These have no spec files. Each needs BMAD dev-auto **step-02** (spec authoring) before
step-03/04. Order (per epic-4-context dependencies — all deps are now done):

1. **4.10–4.13** — the four working service integrations (T-OCR, Speech-to-Text, Extract
   Address, NER). Independent of each other. Depend on 4.8/4.9/4.14 (done ✓) + 4.3 (done ✓).
   Each registers a `SpecialistServiceHandler` (4.9 contract) with `SharedSpecialistAdapter`,
   builds the AI-for-Thai transport request, parses the response into `SpecialistResult`
   fields, and seals `SpecialistEvidence` (4.14). Tests are OFFLINE (fake transport + fixture;
   no real network/credentials per project rules).
   - **Key gap:** the repo does NOT contain the concrete AI-for-Thai per-service API contracts
     (endpoint paths, request body shapes, response field names). `cli/src/core/aiforthai/types.ts`
     is an old Jul-14 STUB (`stubInvoke`), not the real contract. The 4.10 ACs use a
     "reviewed T-OCR fixture" — so implement against a **defined, fixture-based contract**
     (plausible AI-for-Thai request/response shape) and defer real-endpoint confirmation.
     Decide before starting: fixture-based contract now, or wait for verified AI-for-Thai API docs.
2. **4.15** — cache reuse/force-fresh/retain/invalidate (depends 4.14 ✓).
3. **4.16** — failure classification + quarantine smallest-proven-scope (depends 4.9 ✓).
4. **4.17** — explicit retest + scoped recovery (depends 4.16).
5. **4.18–4.20** — verification stories (depend on all preceding).

## How to resume

Run the repo-local skill `.claude/skills/bmad-dev-auto/` (read `step-01` first). For each
remaining story: step-01 routes to **step-02** (no spec yet) → author spec from
`_bmad-output/planning-artifacts/epics.md` Story 4.N section + epic-4-context + the PRD
FR/AD/UX-DR refs it cites → step-03 implement (delegate to a synchronous subagent) →
step-04 dual review (blind adversarial + edge-case subagents, parallel/blocking) →
triage → commit → flip `done`.

Reusable orchestration prompt for already-specced stories is at `/tmp/orchestrate-story.md`
(session-temp; recreate if gone). For new specs, follow `step-02` + `.claude/skills/bmad-dev-auto/spec-template.md`.

## Binding rules (carry forward)
- `_bmad/` and `_bmad-output/` ARE committed by project policy (.gitignore comment + memory);
  `.claude/` and `.agents/` stay ignored. Spec status flips + triage logs get committed.
- Synchronous subagents only — never `run_in_background: true` for dev-auto subagents.
- Reviewers run at session model capability; spawn blind (fresh prompts), parallel/blocking.
- `.js` import specifiers; no `any`; `readonly`; injected clock; Sanitizer before persisted/displayed
  fields (AD-24); deterministic SHA-256 for digests/evidence-id; cite governing AD in headers.
- Do not push without explicit user confirmation (this session: user authorized the end-of-epic push).

## Gotchas (still true)
- Windows/PowerShell target — but dev was macOS this session. Git native stderr red herring on Windows.
- Multi-line commit messages: use `git commit -F <file>` (heredoc to /tmp works on macOS too).
- `final_revision` bookkeeping: I set it to the story's code+spec commit hash and `git commit --amend`
  so the field rides in the commit it points to (the amend changes the hash slightly — known minor drift,
  matches the 4.14 convention).