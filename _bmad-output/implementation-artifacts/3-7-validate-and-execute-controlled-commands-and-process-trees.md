---
story_id: '3.7'
epic: 3
status: review
created: 2026-07-17
dependsOn: '3.3;2.4;PR-3'
---

# Story 3.7: Validate and execute controlled commands and process trees

## Files created

- `cli/src/core/commands/types.ts` — All typed contracts: `CommandProposal`, `CommandExecutionResult`, `CommandRefusal`, `CancellationPhase`, `ProcessTreeState`, `ProcessRunner` port, `ControlledProcess`, `CommandExecutionContext`, `ValidationContext`, AD-9 failure envelope.
- `cli/src/core/commands/validate.ts` — `validateControlledCommand()`: AC #1 resolution of approved executable identity, explicit argv validation (reuses `SHELL_METACHARACTER_RE` from commandGrammar.ts), Workspace-contained cwd, allowed env names/values, shell/startup-hook policy, timeout, output limits, action digest. AC #2: denied/refused/enforcement-unverified for unsupported shell/platform, out-of-Workspace resource, privileged/system mutation, network boundary, unavailable process enforcement. Pure/side-effect free.
- `cli/src/core/commands/execute.ts` — `executeControlledCommand()`: AC #3 exact ordered execution (revalidate -> consume authorization + EffectDispatchCommitted atomically -> launch -> wait -> sanitize output). AC #5: `commandExcludedEffects()` marks side effects excluded/never-protected; no command result treated as rollback checkpoint.
- `cli/src/core/commands/cancellation.ts` — `handleCommandCancellation()`: AC #4 request+ack phases, process-tree kill, descendant wait/uncertainty, honest cancelled/failed/still-running/unknown-outcome reporting. Plus `handleProcessFailure`, `handleTimeout`, `handleTerminalLoss`, `handleUnknownOutcome`.
- `cli/src/core/commands/index.ts` — Barrel export.

## Files modified

- `cli/src/core/app.ts` — Added imports for commands module + sanitizer. Added `validateControlledCommand(proposal)` and `runControlledCommand(proposal, authorization, processRunner, signal?)` methods. Named `runControlledCommand` to avoid collision with existing `dispatchCommand`/`executeCommand` grammar dispatch.

## Test file

- `cli/test/controlledCommand.test.ts` — 47 test cases across all 5 ACs. Uses `FakeProcessRunner` + `FakeControlledProcess` + `FakeJournal` + `FakeSanitizer` + injected clock. No real processes spawned. No network/real creds.

## AC coverage

| AC | Description | Test cases |
|---|---|---|
| AC #1 | Validate argv, cwd, env, shell policy, timeout, output limits, action digest; reject shell expansion/substitution/globbing/implicit-cwd-rebind/unsafe-env/host-threatening | 18 cases |
| AC #2 | Denied/refused/enforcement-unverified for unsupported-shell/out-of-Workspace/privileged/network/unavailable-enforcement; no launch under any profile | 6 cases |
| AC #3 | Execution records exact details; EffectDispatchCommitted before launch; sanitized output; authorization revalidation/consumption | 5 cases |
| AC #4 | Cancellation request+ack phases; process-tree kill; descendant wait/uncertainty; no orphans; honest cancelled/failed/still-running/unknown-outcome | 12 cases |
| AC #5 | Command side effects excluded/never-protected; no command result treated as rollback checkpoint | 3 cases |
| Wiring | CoreApp.validateControlledCommand + CoreApp.runControlledCommand | 2 cases |

**Total: 47 test cases** (>=22 required)

## Key design decisions

1. **ProcessRunner port** — Injectable `ProcessRunner` interface with `spawn()` returning `ControlledProcess`. Tests use `FakeProcessRunner`/`FakeControlledProcess`; production would use `child_process.spawn` with process-tree tracking.
2. **SHELL_METACHARACTER_RE reuse** — The regex from `commandGrammar.ts` (Story 2.13) is redeclared in `validate.ts` to keep the commands module self-contained and avoid circular dependencies.
3. **Action digest** — `computeCommandActionDigest()` produces a SHA-256 of the canonical JSON proposal (executable, argv, cwd, sorted env keys, shellPolicy, timeoutMs, outputLimitBytes). The digest is validated before execution to prevent proposal tampering.
4. **Allowed executables** — A default set of known safe executables (compilers, interpreters, build tools, basic POSIX utilities) is defined. Privileged (`chmod`, `chown`, etc.) and network (`curl`, `wget`, etc.) commands are explicitly denied.
5. **Blocked environment variables** — `PATH`, `HOME`, `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES`, etc. are blocked to prevent environment-based privilege escalation.
6. **Cancellation lifecycle** — `handleCommandCancellation` returns a `CancellationLifecycle` with explicit `requestedAt`/`acknowledgedAt` timestamps and honest `ProcessTreeState`. Process tree kill is attempted; failure reports `unknown-outcome`.
7. **Rollback honesty (AD-19)** — `commandExcludedEffects()` returns exclusions stating that command side effects are never protected by rollback. No command result carries a checkpoint reference.
