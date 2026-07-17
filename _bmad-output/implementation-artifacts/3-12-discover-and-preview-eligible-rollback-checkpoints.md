---
story_id: "3.12"
story_key: "3-12-discover-and-preview-eligible-rollback-checkpoints"
epic: 3
status: review
created: 2026-07-17
project: thcode
dependsOn: "3.2;3.5"
---

# Story 3.12: Discover and preview eligible rollback checkpoints

Status: review

## Implementation

- `cli/src/core/rollback/types.ts` — `CheckpointSummary` (PromptRoundId, checkpoint identity, created/observed time, subsequent-prompt age, target count, pre/post digests, rename info, retention expiry, per-checkpoint + store usage, encryption/integrity state, coverage: `fully protected`|`partially protected`|`unprotected`|`expired`|`corrupt`|`locked`), `ExcludedEffects` (shell/remote/permission/process/symlink-side/external/unknown — explicitly `excluded`/`never-protected`), `RollbackPreview` (canonical order: heading, purpose, risk, target, authority, Evidence completeness, outcome, next step — including exact rollback tokens, no color-only meaning), `RollbackEligibility` (`apply-eligible`|`hidden`/non-authoritative recovery record). AD-9 failures. No `any`.
- `cli/src/core/rollback/discover.ts` — `listCheckpoints(sessionId, store, clock, opts)`: returns committed checkpoint lineage for the current Session. `inspectCheckpoint(checkpointId, store, clock)`: returns the full preview. Incomplete/corrupt/expired/locked/unavailable-bytes checkpoints are HIDDEN from apply-eligible targets but remain inspectable as non-authoritative/recovery records offering only safe Evidence/recovery/exit actions (AC #3). `buildRollbackPreview(summary, eligibility)`: builds canonical preview.
- `cli/src/core/rollback/preview.ts` — AC #1: `/rollback list` or `/rollback inspect <id>` shows PromptRoundId, checkpoint identity, created/observed time, subsequent-prompt age, target count, pre/post digests, rename info, retention expiry, per-checkpoint + store usage, encryption/integrity state, and coverage. AC #2: a checkpoint contains excluded shell/remote/permission/process/symlink-side/external/unknown effects → those are explicitly `excluded`/`never-protected`; the summary NEVER implies the whole Prompt Round is reversible (AD-19). AC #4: selecting a checkpoint for possible rollback stages NOTHING — no target changes, approval, or native effect; the preview remains read-only until a later exact per-target analysis + apply decision (3.13/3.14). AC #5: narrow/redirected/headless preview preserves the canonical order heading/purpose/risk/target/authority/Evidence completeness/outcome/next step, exact rollback tokens, no color-only meaning.
- `cli/src/core/rollback/index.ts` — barrel export.
- `cli/src/core/protocol/commandGrammar.ts` — added `rollback` to `CoreCommand` union and `COMMAND_GRAMMAR` with alias `rb`, `mayRequireApproval: false` (declared-only, deterministic; no shell).
- `cli/src/core/app.ts` — `rollbackList(opts)`, `rollbackInspect(checkpointId, opts)` methods; `executeCommand` switch maps `rollback list`/`rollback inspect <id>` to canonical narrow/headless `renderCommandOutput` result. Stores `_kvStore` reference for rollback dispatch.
- `cli/test/rollbackDiscover.test.ts` — 37 test cases covering all 5 ACs offline with in-memory KeyValueStore + clock. Covers: list/inspect shows all summary fields + coverage; excluded effects explicitly excluded/never-protected + no whole-round-reversible implication; incomplete/corrupt/expired/locked hidden from apply-eligible but inspectable as recovery record with only safe actions; selection stages nothing (read-only); narrow/headless canonical order preserved + exact rollback tokens + no color-only meaning.
- `cli/test/commandGrammar.test.ts` — 10 additional cases proving `/rollback list` + `/rollback inspect <id>` parse+dispatch and unknown subcommands fail closed.

## Verify

- `npm run build` clean.
- `npm test` green (880 tests, 44 files).
