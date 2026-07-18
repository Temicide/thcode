# Story 3.14: Apply conflict-free rollback targets

## Goal

Apply ONLY analyzed, conflict-free inverse changes so rollback changes exactly the eligible built-in file state and leaves unrelated work untouched.

## Files created/modified

### Created

- `cli/src/core/rollback/apply.ts` — Core `applyRollback()` function implementing all 5 ACs
- `cli/test/rollbackApply.test.ts` — 28 test cases covering all 5 ACs + edge cases

### Modified

- `cli/src/core/rollback/types.ts` — Added `ApplyFsProbe`, `ApplyTargetOutcome`, `RollbackApplyResult`, `RollbackApplyResultType`, `ApplyContext`, `ApplyFailure`, `ApplyFailureCategory`, `RollbackApplyResultOrFailure`
- `cli/src/core/rollback/index.ts` — Added `applyRollback` export
- `cli/src/core/app.ts` — Added `applyRollback()` method + `defaultApplyFsProbe()` function

## Architecture

### `applyRollback(checkpointId, selectedTargets, ctx)`

Ordered effect execution (matching Story 3.5 pattern):

1. Read checkpoint record (verify exists)
2. Filter to built-in create/edit/delete effects only (AD-19)
3. Stage + commit new checkpoint for the rollback itself (AC #5)
4. For each target:
   a. Resolve identity
   b. Capture current digest/version
   c. Check accessibility (symlink, open handles, permissions)
   d. Revalidate against analysis (AC #3)
   e. Append `EffectDispatchCommitted` to journal (AC #2)
   f. Apply inverse operation (native mutation)
   g. Append `OperationSucceeded`/`OperationFailed` to journal (AC #2)
5. Aggregate result: `full` / `partial` / `blocked` (AC #4)

### Inverse operations

| Effect kind | Inverse | Handler |
|---|---|---|
| `create_file` | `delete-file` | `applyDeleteFile()` |
| `edit_file` | `restore-pre-image` | `applyRestorePreImage()` |
| `delete_file` | `restore-from-artifact` (binary) or `restore-pre-image` | `applyRestoreFromArtifact()` / `applyRestorePreImage()` |

### Types added

- **`ApplyFsProbe`**: extends FsProbe with `writeFile`, `deleteFile`, `mkdir`
- **`ApplyTargetOutcome`**: discriminated union — `applied`, `skipped`, `conflict`, `inaccessible`, `mismatch`, `unknown-outcome`
- **`RollbackApplyResult`**: aggregate result with per-target outcomes, counts, residual conflicts, excluded effects, checkpoint reference
- **`RollbackApplyResultType`**: `'full' | 'partial' | 'blocked'`
- **`ApplyContext`**: injectable dependencies (fsProbe, checkpointRepo, artifactStore, journal, session/activation/authority ids, workspace, clock)
- **`ApplyFailure`**: AD-9 typed failure envelope
- **`RollbackApplyResultOrFailure`**: top-level result type

## Acceptance criteria coverage

| AC | Description | Test count | Status |
|---|---|---|---|
| AC #1 | Apply only conflict-free inverse changes; excluded effects never claimed reversible | 5 | Covered |
| AC #2 | Durable EffectDispatchCommitted before mutation, OperationSucceeded after | 3 | Covered |
| AC #3 | Revalidate before apply; refuse stale targets | 7 | Covered |
| AC #4 | Aggregate result full/partial/blocked + residual conflicts | 5 | Covered |
| AC #5 | New checkpoint for rollback operation | 2 | Covered |
| — | Edge cases (missing checkpoint, empty targets, binary, already-deleted, multiple kinds, corrupt record) | 6 | Covered |

## Test results

- 28 tests, all passing
- Full suite: 46 test files, 939 tests, all passing
- Build: clean (0 errors)
