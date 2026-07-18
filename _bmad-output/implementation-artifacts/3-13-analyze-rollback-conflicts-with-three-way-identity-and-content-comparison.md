---
story_id: "3.13"
story_key: "3-13-analyze-rollback-conflicts-with-three-way-identity-and-content-comparison"
epic: 3
status: review
created: 2026-07-17
project: thcode
dependsOn: "3.12;3.2"
---

# Story 3.13: Analyze rollback conflicts with three-way identity and content comparison

Status: review

## Implementation

- `cli/src/core/rollback/types.ts` — Added `ThreeWayState` (`present`|`absent`|`unknown` with digest/version), `AnalysisOutcome` (`applied-eligible`|`conflict`|`skipped`|`inaccessible`|`mismatch`|`unknown-outcome`), `InverseOperation` (`restore-pre-image`|`delete-file`|`restore-from-artifact`), `RenameHandling`, `SafeChoice` (`skip-target`|`export-sanitized-patch`|`rebase-new-path`|`user-authored-resolution`), `TargetAnalysis`, `RollbackAnalysis`, `RollbackTarget`, `AnalysisFsProbe`, `AnalysisContext`, `AnalysisFailure` (AD-9 typed envelope), `AnalyzeRollbackResult`. No `any`. No raw bytes in output (AD-24).

- `cli/src/core/rollback/analysis.ts` — `analyzeRollbackTarget(target, checkpoint, ctx)`: AC #1 resolves stable current identity + captures current digest/version BEFORE any effect, then compares recorded pre-image, recorded agent post-image/patch, and current content/deletion state as a three-way analysis. AC #2: current state matches post-image AND identity unchanged → `applied`-eligible with concrete inverse operation, expected current digest/version, rename handling, and no unrelated target included. AC #3: current state differs, later edit overlaps, renamed/deleted/recreated, case/unicode changed, behind symlink/mount, or concurrency/open-handle uncertain → `conflict`/`skipped`/`inaccessible`/`mismatch`/`unknown-outcome`; NO overwrite or best-effort reversal prepared. AC #4: binary original in encrypted ArtifactStore → reads via integrity-verified path, verifies integrity + compares digests WITHOUT exposing raw bytes in UI/logs/Evidence; missing or corrupt originals are NOT apply-eligible. AC #5: conflict offers ONLY safe choices: skip target, export a sanitized patch/Evidence, rebase/apply to a new path where identity policy permits, or explicit user-authored resolution. Generic overwrite, continue, and blind retry are UNAVAILABLE. `analyzeRollbackSet(checkpointId, selectedTargets, ctx)`: aggregates per-target `TargetAnalysis` into `RollbackAnalysis` (per-target outcomes + overall eligibility). Pure/injectable: `AnalysisFsProbe` + `CheckpointRepository` + `ArtifactStore` + clock. No `new Date()` in domain. AD-9 failures. UTF-8/Thai preserved.

- `cli/src/core/rollback/index.ts` — barrel export of `analyzeRollbackTarget` and `analyzeRollbackSet`.

- `cli/src/core/app.ts` — `analyzeRollback(checkpointId, selectedTargets, opts)` method returning `AnalyzeRollbackResult`. Wires `CheckpointRepository`, `ArtifactStore`, and `defaultAnalysisFsProbe`. Does NOT apply anything (apply is 3.14).

- `cli/test/rollbackAnalysis.test.ts` — 30 test cases covering all 5 ACs offline with in-memory `KeyValueStore` + `BlobStore` + `AnalysisFsProbe` + injected clock. Covers: three-way pre/post/current comparison; applied-eligible when current==post-image + identity unchanged + concrete inverse + no unrelated target; conflict/skipped/inaccessible/mismatch/unknown-outcome for current-differs/overlapping-later-edit/renamed/deleted/recreated/case-unicode/symlink-mount/uncertain-open-handle (no overwrite prepared); binary original integrity-verified + digest compare + no raw bytes in output + missing/corrupt not apply-eligible; conflict panel offers only skip/export-sanitized-patch/rebase-new-path/user-authored (no overwrite/continue/blind-retry); aggregate analysis with per-target counts and overall eligibility.

## Verify

- `npm run build` clean.
- `npm test` green (existing + new tests).
