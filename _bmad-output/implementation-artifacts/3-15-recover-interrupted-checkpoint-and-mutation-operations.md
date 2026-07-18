---
story_id: "3.15"
story_key: "3-15-recover-interrupted-checkpoint-and-mutation-operations"
epic: 3
baseline_commit: 9765947
status: review
created: 2026-07-17
project: thcode
dependsOn: "3.10;3.2"
---

# Story 3.15: Recover interrupted checkpoint and mutation operations

Status: review

## Implementation
- cli/src/core/recovery/types.ts — `OperationRecoveryState` (not-sent/prepared/dispatch-committed/succeeded/failed/cancelled/unknown-outcome), `RecoveryClassification` (operation id, journal-derived state, checkpoint material detection, residual risk, dispatch classification), `RecoveryAction` (inspect/reconcile/export-safe-evidence/exit — retry DISABLED), `RecoveryResult` (narrow/headless canonical order: heading, purpose, state, residual risk, action, next step, stable exit class/code), `RecoveryEvaluationResult`, `CancellationState`, `CancellationPhase`, AD-9 typed failures. No `any`. UTF-8/Thai preserved. No raw bytes in evidence (AD-24).
- cli/src/core/recovery/classify.ts — AC #1: classifies all 7 states from journal events (EffectDispatchCommitted lifecycle detection, terminal event detection, proposal/preparation event detection), detects unreachable/incomplete/corrupt checkpoint material via `detectCheckpointMaterial` (delegates to Story 3.2 detectIncompleteStages surface), NEVER replays a native effect automatically. Pure, injectable.
- cli/src/core/recovery/evaluate.ts — AC #2: `evaluateNoDispatchCommit` — no EffectDispatchCommitted -> cancelled/blocked, discards unconsumed authorization, no authority consumed, no native adapter invoked. AC #3: `evaluateDispatchCommittedMissingResult` — EffectDispatchCommitted + missing result -> unknown-outcome preserved, residual risk recorded, blind retry blocked, only inspect/reconcile/exit. AC #4: `evaluateCommittedMutationFailedReference` — committed mutation + failed reference -> reconciled with rollback scope label (partially-protected/unprotected/corrupt), reference repair attempted, NEVER fabricates complete protection. `reconcileOperation` — runs checkpoint reconciliation.
- cli/src/core/recovery/cancellation.ts — AC #5: `determineCancellationPhase` — detects all 5 phases (not-requested/requested-before-dispatch-commit/requested-after-dispatch-commit/acknowledged-before-dispatch-commit/acknowledged-after-dispatch-commit), distinguishes cancelled/still-running/failed/succeeded/unknown-outcome, NEVER claims an already-committed native effect was cancelled (AD-28: effect-already-committed is a lifecycle fact, not succeeded). `formatCancellationState` — human-readable summary.
- cli/src/core/recovery/render.ts — AC #6: `/recover` is the SINGLE entry point. `renderRecoveryHelp` — shows inspect/reconcile/export/exit subcommands. `renderRetryDisabledExplanation` — explains retry is disabled. `buildRecoveryResult` — builds RecoveryResult with stable exit class/code per AD-28 EXIT_CODES. `renderRecoveryResult`/`renderRecoveryInspect`/`renderRecoveryReconcile`/`renderRecoveryExport`/`renderRecoveryExit` — narrow/redirected/headless parity with stdout/stderr/JSON. Unresolved state remains visible with stable exit class/code.
- cli/src/core/protocol/commandGrammar.ts — added `recover` to `CoreCommand` union and `COMMAND_GRAMMAR` with alias `rc`, description, `mayRequireApproval: false`.
- cli/src/core/app.ts — added `recoverInspect(operationId)`, `recoverReconcile(operationId)`, `recoverExport(operationId)`, `recoverExit()` methods. Added `recover` case to `executeCommand` switch mapping `recover inspect <id>`/`recover reconcile <id>`/`recover export <id>`/`recover exit` to canonical narrow/headless `renderCommandOutput`. Added imports from `./recovery/index.js`.
- cli/test/recovery.test.ts — 60+ cases across all 6 ACs. Fake journal (replayable events) + in-memory checkpoint repos + clock. Covers: classify all 7 states from journal + detect incomplete checkpoint material + no auto-replay; no EffectDispatchCommitted -> cancelled/blocked or discard auth, no authority consume, no native adapter; EffectDispatchCommitted + missing result -> unknown-outcome preserved + residual risk + no blind re-exec/equivalent retry; committed mutation + failed reference publication -> journal/reference reconciliation only + no fabricated protection + partially-protected/unprotected/corrupt label; cancellation request+ack phases + cancelled/still-running/failed/succeeded/unknown-outcome distinguished + committed effect never claimed cancelled; /recover single entry with inspect/reconcile/export/retry-disabled/exit + unresolved visible + stable exit code. No network/real creds.
- cli/test/commandGrammar.test.ts — added 11 cases for the new `recover` command (declared, alias, subcommand parsing, help, blocked, journal-required, help listing).

## Verify
- npm run build clean; npm test green (existing + new).