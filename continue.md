# Continue — thcode BMAD dev-auto loop (Epic 4)

**Paused:** 2026-07-18 ~08:51 (Asia/Bangkok)
**Branch:** `update/prototype-v1` · GitHub `Temicide/thcode`
**Product:** `cli/` only. `client/` + `server/` are out of the Release-1 path — do not touch.

## What happened this session
1. **Pushed 2 previously-local commits** — `origin/update/prototype-v1` is now up to date at `9650d11` (ahead/behind = 0/0):
   - `9650d11` Story 4.2 — CoreApp /tools catalog coverage + inspect disclosure fix
   - `d367c84` Fix cross-platform path handling in workspace containment/inspection
2. **Decided the story order.** User asked to "just do 4-10", but 4-10 is blocked:
   - **Forward-dependency violation** — 4-10 (T-OCR) needs 4-8, 4-9, 4-14 `done` first; all three are still `ready-for-dev`.
   - **No spec + no code** — there is no `4-10-*.md`, no `specialists/services/`, no OCR code. From-scratch.
   - ⟹ Agreed to walk deps first: **4-14 → 4-8 → 4-9**, then open 4-10.
3. **Started the loop on 4-14, then paused before implementing** (no code written).

## ⚠️ Correction to the prior handoff — 4-14 is NOT "done/audit", it is PARTIAL
Verified on disk: `cli/src/core/specialists/evidence/` contains **only** `types.ts` + `cacheManifest.ts`.
**Missing** (per the spec's `## Code Map`):
- `cli/src/core/specialists/evidence/seal.ts` — `sealSpecialistEvidence(...)`
- `cli/src/core/specialists/evidence/repository.ts` — `InMemoryEvidenceRepository`
- `cli/src/core/specialists/evidence/projection.ts` — `projectReusedEvidence` / `projectFreshEvidence`
- `cli/src/core/specialists/evidence/index.ts` — barrel
- `cli/src/core/app.ts` — accessors `sealSpecialistEvidence` / `computeSpecialistCacheManifest` / `specialistEvidenceRepository` (+ lazy `_specialistEvidenceRepo`)
- `cli/test/specialistEvidence.test.ts` — no test file exists yet

So 4-14 is a **real implement**, not an audit. Treat 4-3..4-9 with the same skepticism — verify file-by-file, don't trust "code exists + tests pass".

## Verified-good state (safe to build on)
- `cd cli && npm run build` → **tsc clean** (the 2 existing evidence files compile).
- Dependencies for 4-14 are present: 4.9 types at `cli/src/core/specialists/adapter/types.ts` (`SpecialistResult`, `SpecialistFailure`, `SpecialistFieldValue`); 4.8 `ConsentReference` at `cli/src/core/specialists/consent/types.ts`. `evidence/types.ts` already imports them correctly.
- Did NOT re-run the full 1537-test suite this session — run it first to confirm baseline before adding work.

## Next action (resume here)
Run the repo-local skill `.claude/skills/bmad-dev-auto/` (read `step-01` first). For 4-14, status `ready-for-dev` routes straight to **step-03 (implement)**:
1. In the spec frontmatter set `baseline_revision: 9650d11` and `status: in-progress`.
2. Hand to a **Sonnet** implementation subagent, **synchronously** (`run_in_background: false` — the skill forbids backgrounded subagents). Build the 6 missing items above per the spec's `## Code Map` / `## Design Notes`. Binding rules: `_bmad-output/project-context.md` (95 rules: `.js` import specifiers, no `any`, `readonly`, deterministic SHA-256 for CacheManifest digest + evidence id, Sanitizer before any derived field, inject clock, cite governing AD in header — AD-10/AD-24).
3. Verify: `npm run build` clean → `npx vitest run specialistEvidence` pass → `npx vitest run` full green (report new totals vs 57 files / 1537 tests).
4. step-04: dual-Opus review (`bmad-review-adversarial-general` + `bmad-review-edge-case-hunter`, parallel/blocking), triage findings, commit, flip status `done`.
5. Then repeat for **4-8**, **4-9** (likely also partial — verify).

Spec file: `_bmad-output/implementation-artifacts/4-14-persist-immutable-specialist-evidence-and-versioned-cachemanifest-identity.md`

## Gotchas
- Windows / PowerShell. Git native stderr shows red `NativeCommandError` that is NOT a failure — check the real result line.
- Multi-line commit messages via PowerShell here-strings failed once → use `git commit -F <file>`.
- `_bmad`, `_bmad-output`, `.agents`, `.claude` are gitignored — story specs and BMAD artifacts never get committed (this `continue.md` at repo root does).
- **Do not push without explicit user confirmation.**
