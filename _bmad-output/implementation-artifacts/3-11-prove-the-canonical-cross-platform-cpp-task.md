# Story 3.11: Prove the canonical cross-platform C++ Hello, World! task end-to-end

**Status:** Implemented  
**Epic:** 3 — Core Agent Loop  
**Stories composed:** 3.5, 3.7, 3.8, 3.9, 3.10  
**ADRs applied:** AD-4, AD-12, AD-13, AD-19, AD-24, AD-27, AD-28

---

## Summary

The proof orchestrator (`runHelloWorldProof`) composes existing Story 3.5 (file effects), 3.7 (controlled commands), 3.8 (dependency preflight), 3.9 (dispatch), and 3.10 (terminals) surfaces to prove the canonical cross-platform C++ Hello, World! task end-to-end on both supported platforms (macOS, Windows) without overstating success.

The orchestrator is a pure, injectable function that accepts a `ProofEnvironment` port, making it fully testable offline with fakes — no real compilers, processes, filesystem, or network required.

---

## Files created/modified

| File | Action | Purpose |
|------|--------|---------|
| `cli/src/core/proof/types.ts` | Created | All proof type definitions, constants, and the `ProofEnvironment` injectable port |
| `cli/src/core/proof/helloWorldProof.ts` | Created | Async orchestrator implementing all 6 ACs |
| `cli/src/core/proof/index.ts` | Created | Barrel export |
| `cli/src/core/app.ts` | Modified | Added `runHelloWorldProof` method delegating to proof module |
| `cli/src/core/commands/validate.ts` | Modified | Updated path validation to allow workspace-contained paths (for compiled binary execution) |
| `cli/test/helloWorldProof.test.ts` | Created | 46 test cases covering all 6 ACs |
| `cli/test/controlledCommand.test.ts` | Modified | Updated test to expect new reason code for out-of-workspace paths |

---

## Architecture

### ProofEnvironment (injectable port)

```
ProofEnvironment {
  workspace: WorkspaceIdentity
  fsProbe: FsProbe              // Story 3.5
  fsMutator: FsMutator          // Story 3.5
  processRunner: ProcessRunner  // Story 3.7
  depPreflightResult: DepPreflightResult  // Story 3.8
  policyState: PolicyState
  journal: { append, eventsOfKind, lastEvent }
  kvStore: KeyValueStore
  blobStore?: BlobStore
  encKey?: Buffer
  sessionId, activationId, activationRevision, authorityRevision: string|number
  clock: () => string
  sourceTarget: string
  compilerExecutable: string
  compileArgv: readonly string[]
  executeArgv: readonly string[]
  cwd: string
  timeoutMs: number
  outputLimitBytes: number
}
```

### Orchestrator phases

```
inspect -> plan -> approve -> create-source -> compile -> execute -> verify -> terminal
```

Each phase produces one or more `ProofStep` entries with phase, status, detail, and timestamp.

---

## Acceptance Criteria coverage

### AC #1: Inspect -> plan -> approve -> create-source exact order + approval required

- **inspect**: Checks workspace identity, dep preflight result, compiler availability
- **plan**: Previews source file creation via `previewFileEffect`, displays exact target path, change summary (bytes/digest), checkpoint coverage, and authority
- **approve**: Evaluates permission via `evaluatePermission`, creates authorization via `createAuthorization` with `PepDecision`
- **create-source**: Only proceeds after authorization is granted

### AC #2: Exact checkpoint/mutation order + EffectDispatchCommitted + completion only post-commit

- Source creation follows: resolve identity -> capture digest -> PEP/quota/platform -> stage checkpoint -> durable stage -> atomically consume authorization + `EffectDispatchCommitted` -> native mutation -> durable result/post-image -> publish checkpoint ref + terminal event post-commit
- Uses `applyFileEffect` (Story 3.5) with `CheckpointRepository` and `ArtifactStore`
- `OperationSucceeded` is the last event appended to the journal

### AC #3: Compile+exec validated+disclosed + controlled process tree + sanitized output

- Each command proposal is validated via `validateControlledCommand` (Story 3.7) with workspace-rooted validation context
- Each command is authorized via `createAuthorization` + `consumeAuthorization`
- Each command follows controlled process-tree execution via `ProcessRunner.spawn()`
- Output is streamed as sanitized `CommandExecutionSummary`

### AC #4: Compile=0 exec=0 stdout=Hello, World! -> succeeded + full summary

- Line-ending normalization: `\r\n`, `\r`, `\n` -> `\n` for cross-platform comparison
- Summary includes: source file, source digest, compiler identity, compile/execute command summaries, expected/observed output, output match, operation IDs, checkpoint coverage, excluded effects, protected changes
- Only post-commit Evidence publishes completion (`OperationSucceeded`)

### AC #5: Compiler missing -> prerequisite-blocker + platform guidance

- Checks `depPreflightResult.perProbeResults` for `cpp-compiler` probe status
- If not `verified`, returns `prerequisite-blocker` with platform-specific guidance
- No command invented, no dependency installed, no later mutation implied
- Summary is `null` (no source was created)

### AC #6: Failure modes -> honest status + never affirmative

- Compilation/execution failure (non-zero exit code) -> `failed`
- Cancellation (SIGTERM/SIGINT/SIGKILL) -> `cancelled`
- Output mismatch -> `failed` at verify phase
- Source creation failure -> `failed` or `conflict`
- Never leads with affirmative completion
- States which built-in file changes are protected and which command/process effects are excluded (AD-19)

---

## Key design decisions

1. **ProofEnvironment is an injectable port**: All dependencies (fs, process runner, journal, kv store, etc.) are injected, enabling fully offline testing with fakes.

2. **Composition over implementation**: The orchestrator composes existing Story 3.5/3.7/3.8/3.9/3.10 surfaces rather than re-implementing effect/command logic.

3. **Line-ending normalization**: `normalizeLineEndings()` converts `\r\n`, `\r`, `\n` to `\n` before comparing stdout to expected output, ensuring cross-platform compatibility.

4. **Workspace-rooted validation context**: The `validateControlledCommand` function is called with a validation context derived from the workspace's canonical root, ensuring proper path resolution.

5. **Path validation for compiled binaries**: The `validateControlledCommand` function was updated to allow executable paths that resolve within the workspace (needed for executing the compiled binary).

---

## Test coverage

46 test cases in `cli/test/helloWorldProof.test.ts`:

- **AC #1** (5 tests): inspect->plan->approve->create-source order, target display, approval required, phase ordering, preview failure
- **AC #2** (5 tests): checkpoint/mutation order, EffectDispatchCommitted, post-commit completion, no premature completion, source content verification
- **AC #3** (5 tests): compile validation, execute validation, command disclosure, process-tree execution, sanitized output
- **AC #4** (8 tests): success status, full summary, operation identities, checkpoint coverage/excluded effects, post-commit completion, `\r\n` normalization, `\r` normalization
- **AC #5** (6 tests): macOS blocker, Windows blocker, no invented command, no dependency installed, no later mutation implied, probe-failed compiler
- **AC #6** (12 tests): compile failure, SIGTERM cancellation, SIGINT cancellation, execution failure, SIGKILL cancellation, output mismatch, protected changes, excluded effects, non-affirmative completion, non-zero exit, signal failure, execution non-zero exit
- **Edge cases** (5 tests): empty stdout, whitespace-only stdout, compile step detail, execute step detail, timestamps

All 833 tests pass across 43 test files (including 49 controlled command tests and 46 proof tests).

---

## Build

`npm run build` passes clean with zero errors.
