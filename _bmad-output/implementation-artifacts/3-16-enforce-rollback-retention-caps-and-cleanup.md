# Story 3.16: Enforce rollback retention, caps, and cleanup

**Epic 3 — Protection, Rollback, and Recovery**

## Summary

Implemented retention, capacity, and cleanup enforcement for checkpoint-based rollback protection. All 6 acceptance criteria are covered with 49 test cases across 6 source files and 3 convergent modifications.

## Files Created

| File | Purpose |
|---|---|
| `cli/src/core/retention/types.ts` | All type definitions: RetentionConfig, RetentionState, CapacityUsage, OverCapResult, CleanupOutcome, CleanupLifecycleEvent, CleanupContext, RetentionStatus, validation functions. Constants: DEFAULT_RETENTION_PROMPT_ROUNDS=5, MIN=1, MAX=100. |
| `cli/src/core/retention/retention.ts` | AC #1: `calculateRetention()` computes deterministic expiry from creationPromptRound + config. `isExpired()` checks current >= expiry. `roundsRemaining()` returns remaining rounds. Re-exports `validateRetentionConfig`. |
| `cli/src/core/retention/capacity.ts` | AC #2, AC #3: `evaluateCapacity()` checks against 100 MB per-checkpoint / 500 MB store caps. `recordUnprotectedOperation()` and `recordNeverProtectedOperation()` create records with AD-19 reversible statement and no fabricated checkpoint reference. |
| `cli/src/core/retention/cleanup.ts` | AC #4, AC #5: `runCleanup()` performs journaled crash-consistent cleanup. `resumeCleanup()` detects interrupted cleanup. `detectExpiredCheckpoints()` scans for expired. `markExpired()` sets retentionState to eligible-for-eviction. |
| `cli/src/core/retention/render.ts` | AC #6: `renderRetentionStatus()`, `renderCapacityUsage()`, `renderCleanupOutcome()` produce CommandOutput with encryption/integrity/age/window/cap-usage/exclusions/next-steps and AD-19 disclaimer. |
| `cli/src/core/retention/index.ts` | Barrel export re-exporting all public types and functions. |
| `cli/test/retention.test.ts` | 49 test cases covering all 6 ACs. |

## Files Modified

| File | Change |
|---|---|
| `cli/src/core/checkpoints/types.ts` | Added `readonly promptRound?: number` to `CheckpointRecord` and `CheckpointStageInput` interfaces. |
| `cli/src/core/checkpoints/checkpointRepository.ts` | Updated `stage()` to propagate `promptRound` into the created CheckpointRecord. |
| `cli/src/core/app.ts` | Added imports from `./retention/index.js`. Added `retentionStatus()`, `evaluateCapacity()`, `runCleanup()` methods. |

## Acceptance Criteria Coverage

### AC #1: Retention calculation (11 tests)
- Default 5-round retention window
- Validated user-configured window (3, 10 rounds)
- Deterministic expiry from creation round + window
- Retained when current < expiry, expired when current >= expiry
- `isExpired()` and `roundsRemaining()` correctness
- Unrelated Session/artifact retention NOT counted
- `validateRetentionConfig()` rejects below MIN, above MAX, non-integer; accepts valid

### AC #2: Over-cap disclosure (9 tests)
- Within limits when under 100 MB checkpoint / 500 MB store
- Over-cap when checkpoint exceeds 100 MB
- Over-cap when store would exceed 500 MB
- Exact checkpoint and store usage reported
- Unprotected scope identified with targets and AD-19 residual risk
- No silent eviction of active protection
- Requires explicit confirmation to proceed
- Full Access cannot suppress over-cap disclosure
- Cap constants imported from mutations/types.js (no duplication)

### AC #3: Confirmed unprotected operation (6 tests)
- Records unprotected operation with correct status
- Records never-protected operation with correct status
- Includes only-retained-coverage-reversible statement (AD-19)
- No fabricated checkpoint reference
- Never-protected record also has no fabricated reference
- Records have recordedAt timestamp

### AC #4: Cleanup lifecycle (5 tests)
- Removes encrypted originals, metadata, staging files, unreachable references
- Shared immutable bytes remain for other valid references (reference counting)
- Expired content hidden from rollback discovery
- `markExpired()` sets retentionState to eligible-for-eviction
- Cleanup follows journaled crash-consistent lifecycle

### AC #5: Cleanup failure modes (6 tests)
- Store locked -> recovery-locked with safe inspect/exit actions
- Key locked -> recovery-locked
- Corrupt checkpoint record -> corrupt outcome
- `resumeCleanup()` resumes interrupted cleanup
- `resumeCleanup()` handles already-cleaned checkpoint
- NEVER overwrites live data (keys decrease, never increase)

### AC #6: Status rendering (12 tests)
- Shows encryption and integrity status
- Shows age and retention window
- Shows cap usage when provided
- Shows exclusions
- Shows next steps
- Makes NO claim that excluded effects are reversible (AD-19 disclaimer)
- `renderCapacityUsage()` shows cap details
- `renderCapacityUsage()` shows over-cap warning
- `renderCleanupOutcome()` shows removed status
- `renderCleanupOutcome()` shows recovery-locked with safe actions
- `renderCleanupOutcome()` shows corrupt with safe actions

## Key Design Decisions

1. **Prompt Round-based expiry**: Retention is measured in Prompt Rounds, not wall-clock time, so it remains predictable regardless of session activity.

2. **Constants from mutations/types.js**: PER_CHECKPOINT_CAP_BYTES (100 MB) and STORE_CAP_BYTES (500 MB) are imported, not redefined, to avoid duplication.

3. **Journaled crash-consistent cleanup**: Each cleanup step is journaled before the corresponding mutation, so interruption can be detected and resumed.

4. **Reference counting**: Shared immutable bytes remain for other valid references; only the last reference triggers actual deletion.

5. **AD-19 disclaimer in all render output**: Every rendered status includes the statement that automatic rollback covers built-in create/edit/delete ONLY, and shell/process/remote/permission/symlink-side/external effects are NEVER claimed reversible.

## Test Results

```
 ✓ test/retention.test.ts (49 tests) 20ms
```

All 48 test files pass (1060 tests total).
