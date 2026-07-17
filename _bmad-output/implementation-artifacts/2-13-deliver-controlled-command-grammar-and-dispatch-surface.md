---
story_id: "2.13"
story_key: "2-13-deliver-controlled-command-grammar-and-dispatch-surface"
epic: 2
baseline_commit: f5703e0
status: review
created: 2026-07-17
project: thcode
dependsOn: "2.8; 2.5; 1.3"
---

# Story 2.13: Controlled command grammar + CoreApp dispatch surface

Status: review

## Implementation
- cli/src/core/protocol/commandGrammar.ts — frozen `COMMAND_GRAMMAR` (status/permissions/mode/boundaries/connections/activity/models/tools/check/help + aliases + mayRequireApproval flags); `CoreCommand` union; `SHELL_METACHARACTER_RE` rejects shell expansion/globbing/interpolation/substitution/user executables; `parseCommand` (empty/shell/unknown → sanitized deterministic error + exit class/code); `completeCommand` (declared-only, deterministic); `commandRejection` (shellExecuted=false, fileMutated=false); `noTtyCommandBlocked` (no pending authority, next: rerun interactively); `renderCommandOutput` (stdout/stderr/JSON parity). Exit class via ux-state-v1 EXIT_CODES (BLOCKED=20).
- cli/src/core/app.ts — `dispatchCommand(input, opts)` parses against the frozen grammar; on rejection journals OperationBlocked + renders parity output; on no-TTY + mayRequireApproval fails closed (AC #6); private `executeCommand(cmd, args)` maps each CoreCommand to a CoreApp projection (status→statusProjection, permissions→matrix version, mode→setMode, boundaries→listBoundaryExpansions, connections→health, activity→projection, models→Typhoon inspection-only, tools→catalog (no Specialist invocation), check→preflight, help→grammar listing).
- cli/test/commandGrammar.test.ts — 13 cases across all 6 ACs.

## Verify
- npm run build clean; npm test green (381 tests).