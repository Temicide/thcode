---
story_id: "3.5"
story_key: "3-5-apply-guarded-builtin-file-creation-and-editing"
epic: 3
baseline_commit: 9765947
status: review
created: 2026-07-17
project: thcode
dependsOn: "3.3; 2.4; 3.2"
---

# Story 3.5: Apply guarded built-in file creation and editing

Status: review

## Implementation
- cli/src/core/effects/types.ts — `FileEffectProposal`, `FileEffectPreview`, `EffectExecutionResult`, `EffectConflict` (discriminated: `conflict`|`unknown-outcome`|`stale-approval`), `FsMutator` port, `EffectContext`, AD-9 typed failure envelope. No `any`.
- cli/src/core/effects/preview.ts — `previewFileEffect(kind, target, content, ctx)` builds the exact create/edit preview (target identity, expected pre-image digest/version or `absent`, bounded content summary, post-image digest plan, exclusions, OperationId, authority, checkpoint coverage). Plan mode returns `deny` and cannot authorize (AC #1).
- cli/src/core/effects/fileEffect.ts — `applyFileEffect(kind, target, content, authorization, ctx)` executes the exact ordered steps: resolve stable identity -> capture expected digest/version -> PEP/PermissionMatrix/quota/platform checks -> stage checkpoint originals/metadata/post-plan -> make stage durable -> ATOMICALLY consume authorization + append `EffectDispatchCommitted` (journal = commit authority) -> native mutation -> durable result/post-image -> publish checkpoint reference + terminal event post-commit. No UI completion emitted earlier (AC #2). Reuses `consumeAuthorization` + journal append + checkpoint commit.
- cli/src/core/effects/revalidate.ts — `revalidateFileEffect(proposal, authorization, ctx)` checks if target or proposed bytes differ from reviewed digest/plan -> STALE, not dispatched, fresh exact review required. No generic approval, Full Access, or model output can authorize the changed proposal (AC #3). Reuses Story 2.4 `revalidateAuthorization`.
- cli/src/core/effects/conflict.ts — `detectConflict(input)` checks for concurrent writer, rename, open-handle uncertainty, case/Unicode identity mismatch, symlink/junction/mount change, or failed compare-and-apply -> returns `conflict` or `unknown-outcome` WITHOUT best-effort overwrite, preserves unrelated user work, records deterministic Evidence (AC #4).
- cli/src/core/effects/index.ts — barrel export.
- cli/src/core/app.ts — `previewCreateFile(target, content)`, `previewEditFile(target, content)`, `applyFileEffect(kind, target, content, authorization, opts)`, `checkFileEffectConflict(targetPath, expectedDigest, expectedVersion)` methods on CoreApp facade. Reuses existing authorization/PEP/checkpoint/journal seams. Injects fsProbe + clock; no `new Date()` in domain.
- cli/test/fileEffect.test.ts — 35 test cases across all 5 ACs + edge cases.

## Verify
- npm run build clean; npm test green (existing + new tests).
