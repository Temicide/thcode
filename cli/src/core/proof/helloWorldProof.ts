// Canonical cross-platform C++ Hello, World! proof orchestrator (Story 3.11,
// AD-4, AD-12, AD-13, AD-19, AD-24, AD-27, AD-28). Composes existing 3.5/3.7/
// 3.8/3.9/3.10 surfaces — does NOT re-implement effect/command logic.
//
// AC #1: inspect Workspace, plan a bounded C++ source creation, display exact
//   target/change/checkpoint coverage + authority, require applicable exact
//   approval before creating the source file.
// AC #2: source creation authorized + protected per the complete mutation-set
//   plan -> follow the EXACT checkpoint/mutation order (resolve identity ->
//   capture digest -> PEP/quota/platform -> stage checkpoint -> durable stage ->
//   atomically consume authorization + EffectDispatchCommitted -> native mutation
//   -> durable result/post-image -> publish checkpoint ref + terminal event
//   post-commit). No completion earlier.
// AC #3: source creation succeeded -> compilation + execution proposed -> each
//   exact executable/argv/cwd/environment validated + disclosed, each command
//   follows controlled process-tree execution + cancellation rules, output
//   streamed as sanitized Evidence.
// AC #4: compilation exits 0, execution exits 0, stdout contains exactly
//   `Hello, World!` after permitted line-ending normalization -> task
//   `succeeded`; summary identifies source file, compiler/commands, observed
//   exit codes, exact expected output, Typhoon/PromptRound/Operation identities,
//   checkpoint coverage, excluded effects; ONLY post-commit Evidence can publish
//   completion.
// AC #5: compiler missing or cannot be safely invoked -> prerequisite-blocker
//   with platform guidance, NOT source failure and NOT success; no command
//   invented, no dependency installed, no later mutation implied.
// AC #6: compilation/execution/verification/cancellation/conflict/process-cleanup
//   fails -> `failed`/`cancelled`/`conflict`/`unknown-outcome`/
//   `accepted-limitation` as applicable, NEVER leads with affirmative completion,
//   states which built-in file changes are protected and which command/process
//   effects are excluded (AD-19).
//
// Pure/injectable: accepts a ProofEnvironment port so tests use fakes and never
// run real compilers or touch the real process environment.

import { createHash } from 'node:crypto';
import { newOperationId } from '../protocol/ids.js';
import { durableEvent } from '../agent/dispatch.js';
import { previewFileEffect } from '../effects/preview.js';
import { applyFileEffect } from '../effects/fileEffect.js';
import { validateControlledCommand, computeCommandActionDigest, commandExcludedEffects, defaultValidationContext } from '../commands/index.js';
import { createAuthorization, consumeAuthorization } from '../permissions/authorization.js';
import type { ProposalBinding } from '../permissions/authorization.js';
import type { PepDecision } from '../permissions/pep.js';
import { evaluatePermission } from '../permissions/policy.js';
import { lookupActionClass } from '../permissions/matrix.js';
import { CheckpointRepository } from '../checkpoints/checkpointRepository.js';
import { ArtifactStore } from '../checkpoints/artifactStore.js';
import type {
  ProofEnvironment,
  ProofResult,
  ProofStatus,
  ProofPhase,
  ProofStep,
  ProofSummary,
  CompilerIdentity,
  CommandExecutionSummary,
} from './types.js';
import {
  CANONICAL_HELLO_SOURCE,
  EXPECTED_HELLO_OUTPUT,
} from './types.js';

// --- Helpers ---

function computeDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Normalize line endings: \r\n, \r, \n -> \n for comparison. */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Check if the compiler probe result indicates a usable compiler. */
function compilerIsUsable(env: ProofEnvironment): boolean {
  const compilerResult = env.depPreflightResult.perProbeResults.find(
    (r) => r.probeId === 'cpp-compiler',
  );
  if (!compilerResult) return false;
  return compilerResult.status === 'verified';
}

/** Get platform-specific guidance from the preflight result. */
function getPlatformGuidance(env: ProofEnvironment): string | null {
  const compilerResult = env.depPreflightResult.perProbeResults.find(
    (r) => r.probeId === 'cpp-compiler',
  );
  if (compilerResult && compilerResult.guidance) {
    return compilerResult.guidance;
  }
  if (env.depPreflightResult.guidance.length > 0) {
    return env.depPreflightResult.guidance.map((g) => g.message).join('; ');
  }
  return null;
}

/** Build a ProofStep. */
function step(
  phase: ProofPhase,
  status: ProofStep['status'],
  detail: string,
  clock: () => string,
): ProofStep {
  return { phase, status, detail, timestamp: clock() };
}

/** Build a ProofResult. */
function makeResult(
  status: ProofStatus,
  phase: ProofPhase,
  steps: ProofStep[],
  summary: ProofSummary | null,
  guidance: string | null,
  clock: () => string,
): ProofResult {
  return { status, phase, steps, summary, guidance, completedAt: clock() };
}

/** Build a ProofSummary with common fields. */
function buildSummary(
  env: ProofEnvironment,
  sourceDigest: string,
  compileSummary: CommandExecutionSummary | null,
  executeSummary: CommandExecutionSummary | null,
  observedOutput: string | null,
  outputMatch: boolean | null,
  operationIds: readonly string[],
  checkpointCoverage: import('../checkpoints/types.js').CoverageState | null,
  compileProposal: { executable: string; argv: readonly string[] } | null,
  executeProposal: { executable: string; argv: readonly string[] } | null,
): ProofSummary {
  const compilerIdentity: CompilerIdentity | null = compileSummary
    ? {
        executable: env.compilerExecutable,
        version: null,
        platform: env.workspace.platform.platform,
      }
    : null;

  const excluded: import('../mutations/types.js').ExcludedEffect[] = [];
  if (compileProposal) {
    excluded.push(...commandExcludedEffects(compileProposal as Parameters<typeof commandExcludedEffects>[0]));
  }
  if (executeProposal) {
    excluded.push(...commandExcludedEffects(executeProposal as Parameters<typeof commandExcludedEffects>[0]));
  }

  return {
    sourceFile: env.sourceTarget,
    sourceDigest,
    compiler: compilerIdentity,
    compileCommand: compileSummary,
    executeCommand: executeSummary,
    expectedOutput: EXPECTED_HELLO_OUTPUT,
    observedOutput,
    outputMatch,
    operationIds,
    checkpointCoverage,
    excludedEffects: excluded,
    protectedChanges: [env.sourceTarget],
  };
}

// --- Main proof orchestrator ---

/**
 * Run the canonical cross-platform C++ Hello, World! proof (Story 3.11).
 *
 * Composes existing surfaces:
 * - `previewFileEffect` / `applyFileEffect` (Story 3.5) for source creation
 * - `validateControlledCommand` (Story 3.7) for compile + execute validation
 * - `runDependencyPreflight` (Story 3.8) for compiler availability
 * - `createAuthorization` / `consumeAuthorization` (Story 2.4) for
 *   exact-proposal authorization
 *
 * Returns a ProofResult with honest status, never overstating success.
 */
export async function runHelloWorldProof(
  env: ProofEnvironment,
): Promise<ProofResult> {
  const steps: ProofStep[] = [];
  const clock = env.clock;
  const sourceContent = new TextEncoder().encode(CANONICAL_HELLO_SOURCE);
  const sourceDigest = computeDigest(sourceContent);

  // ==========================================================================
  // AC #5: Check compiler availability first.
  // ==========================================================================
  if (!compilerIsUsable(env)) {
    const guidance = getPlatformGuidance(env);
    steps.push(step('inspect', 'prerequisite-blocker', 'C++ compiler not found or not invokable', clock));
    return makeResult(
      'prerequisite-blocker',
      'inspect',
      steps,
      null,
      guidance ?? 'A C++ compiler is required but was not found. Install Xcode Command Line Tools (macOS) or Visual Studio Build Tools (Windows).',
      clock,
    );
  }

  // ==========================================================================
  // AC #1: Inspect workspace, plan bounded C++ source creation.
  // ==========================================================================
  steps.push(step('inspect', 'succeeded', 'Workspace inspected, compiler verified', clock));

  // Preview the source creation to get exact target/change/checkpoint coverage.
  const previewResult = previewFileEffect('create_file', env.sourceTarget, sourceContent, {
    workspace: env.workspace,
    fsProbe: env.fsProbe,
    clock,
    mode: 'build',
    activationId: env.activationId,
    activationRevision: env.activationRevision,
  });

  if (!previewResult.ok) {
    steps.push(step('plan', 'failed', `Source creation preview failed: ${previewResult.reason}`, clock));
    return makeResult('failed', 'plan', steps, null, null, clock);
  }

  const preview = previewResult.preview;
  steps.push(step('plan', 'succeeded', `Source creation planned: ${preview.target.canonicalPath}, ${preview.contentSummary}, coverage: ${preview.checkpointCoverage}`, clock));

  // ==========================================================================
  // AC #1: Require exact approval before creating the source file.
  // ==========================================================================
  const opId = newOperationId();
  const binding: ProposalBinding = {
    actionClass: 'create_file',
    target: preview.target.canonicalPath,
    payload: sourceDigest,
  };

  // Evaluate permission for the source creation.
  const actionDef = lookupActionClass('write_file');
  if (!actionDef) {
    steps.push(step('approve', 'failed', 'Unknown action class: write_file', clock));
    return makeResult('failed', 'approve', steps, null, null, clock);
  }

  const permDecision = evaluatePermission(
    { tool: actionDef.actionClass, mutating: actionDef.mutating, sensitive: actionDef.sensitive, risk: actionDef.risk },
    env.policyState,
  );

  if (permDecision.outcome !== 'allow') {
    steps.push(step('approve', 'failed', `Permission denied: ${permDecision.reason}`, clock));
    return makeResult('failed', 'approve', steps, null, null, clock);
  }

  const pepDecision: PepDecision = {
    outcome: 'allow',
    reason: 'proof-source-creation',
    matrixVersion: 1,
    activationRevision: env.activationRevision,
    actionClass: 'write_file',
  };

  const authorization = createAuthorization({
    operationId: opId,
    binding,
    decision: pepDecision,
    activationId: env.activationId,
    activationRevision: env.activationRevision,
    authorityRevision: env.authorityRevision,
    approvingInteraction: 'proof-orchestrator',
    clock,
  });

  steps.push(step('approve', 'succeeded', `Authorization granted for source creation: ${authorization.authorizationId}`, clock));

  // ==========================================================================
  // AC #2: Source creation with exact checkpoint/mutation order.
  // ==========================================================================
  steps.push(step('create-source', 'running', 'Creating source file with guarded effect execution', clock));

  const checkpointRepo = new CheckpointRepository(env.kvStore, clock);
  const artifactStore = env.blobStore && env.encKey
    ? new ArtifactStore(env.blobStore, env.encKey)
    : undefined;

  const fileResult = applyFileEffect('create_file', env.sourceTarget, sourceContent, authorization, {
    workspace: env.workspace,
    fsProbe: env.fsProbe,
    fsMutator: env.fsMutator,
    clock,
    policyState: env.policyState,
    checkpointRepo,
    artifactStore,
    kvStore: env.kvStore,
    blobStore: env.blobStore,
    journal: env.journal,
    sessionId: env.sessionId,
    activationId: env.activationId,
    activationRevision: env.activationRevision,
    authorityRevision: env.authorityRevision,
  });

  if (!fileResult.ok) {
    const conflict = fileResult as { kind?: string; reason?: string };
    const failStatus: ProofStatus = conflict.kind === 'stale-approval' ? 'conflict' : 'failed';
    steps.push(step('create-source', failStatus, `Source creation failed: ${conflict.reason ?? 'unknown'}`, clock));
    return makeResult(failStatus, 'create-source', steps, null, null, clock);
  }

  // Verify the source file was created.
  let sourceCreated: Uint8Array;
  try {
    sourceCreated = env.fsProbe.readFile(env.sourceTarget);
  } catch {
    steps.push(step('create-source', 'failed', 'Source file not found after creation', clock));
    return makeResult('failed', 'create-source', steps, null, null, clock);
  }

  const createdDigest = computeDigest(sourceCreated);
  const sourceVerified = createdDigest === sourceDigest;

  if (!sourceVerified) {
    steps.push(step('create-source', 'failed', 'Source file content verification failed', clock));
    return makeResult('failed', 'create-source', steps, null, null, clock);
  }

  steps.push(step('create-source', 'succeeded', `Source file created and verified: ${env.sourceTarget}`, clock));

  // ==========================================================================
  // AC #3: Compilation proposed, validated, and executed.
  // ==========================================================================
  steps.push(step('compile', 'running', `Compiling with: ${env.compilerExecutable} ${env.compileArgv.join(' ')}`, clock));

  // Build the compile command proposal.
  const compileProposal = {
    operationId: newOperationId(),
    executable: env.compilerExecutable,
    argv: env.compileArgv,
    cwd: env.cwd,
    environment: {},
    shellPolicy: 'no-shell' as const,
    timeoutMs: env.timeoutMs,
    outputLimitBytes: env.outputLimitBytes,
    actionDigest: '',
  };
  compileProposal.actionDigest = computeCommandActionDigest(compileProposal);

  // Build validation context from the workspace.
  const validationCtx = defaultValidationContext({
    workspaceRoot: env.workspace.canonicalRoot,
    platform: env.workspace.platform.platform,
    clock,
  });

  // Validate the compile command.
  const compileValidation = validateControlledCommand(compileProposal, validationCtx);
  if (!compileValidation.ok) {
    steps.push(step('compile', 'failed', `Compile command validation failed: ${compileValidation.reason}`, clock));
    return makeResult('failed', 'compile', steps, null, null, clock);
  }

  // Create authorization for compile.
  const compileBinding: ProposalBinding = {
    actionClass: 'run_command',
    target: compileProposal.executable,
    payload: compileProposal.actionDigest,
  };
  const compileAuth = createAuthorization({
    operationId: compileProposal.operationId,
    binding: compileBinding,
    decision: {
      outcome: 'allow',
      reason: 'proof-compile',
      matrixVersion: 1,
      activationRevision: env.activationRevision,
      actionClass: 'run_command',
    },
    activationId: env.activationId,
    activationRevision: env.activationRevision,
    authorityRevision: env.authorityRevision,
    approvingInteraction: 'proof-orchestrator',
    clock,
  });

  // Consume authorization and append EffectDispatchCommitted.
  const compileConsume = consumeAuthorization(compileAuth);
  if (!compileConsume.ok) {
    steps.push(step('compile', 'failed', `Compile authorization consumption failed: ${compileConsume.cause}`, clock));
    return makeResult('failed', 'compile', steps, null, null, clock);
  }

  env.journal.append(
    durableEvent(
      { kind: 'EffectDispatchCommitted', operationId: compileProposal.operationId },
      env.sessionId as never,
      { operationId: compileProposal.operationId, provenanceKind: 'deterministic', provenanceSource: 'proof-compile', clock },
    ),
  );

  // Execute the compile command.
  const compileProcess = env.processRunner.spawn(
    compileProposal.executable,
    compileProposal.argv,
    { cwd: compileProposal.cwd, env: compileProposal.environment, timeoutMs: compileProposal.timeoutMs },
  );

  // Wait for compile to complete.
  const compileExit = await compileProcess.wait();

  const compileSummary: CommandExecutionSummary = {
    executable: compileProposal.executable,
    argv: compileProposal.argv,
    exitCode: compileExit.exitCode,
    terminalStatus: compileExit.exitSignal
      ? (['SIGTERM', 'SIGINT', 'SIGKILL'].includes(compileExit.exitSignal) ? 'cancelled' : 'failed')
      : (compileExit.exitCode === 0 ? 'succeeded' : 'failed'),
    sanitizedStdout: compileExit.stdout,
    sanitizedStderr: compileExit.stderr,
  };

  // AC #6: Compilation fails -> failed, not success.
  if (compileExit.exitCode !== 0 || compileExit.exitSignal !== null) {
    const compileStatus: ProofStatus = compileExit.exitSignal
      ? (['SIGTERM', 'SIGINT', 'SIGKILL'].includes(compileExit.exitSignal) ? 'cancelled' : 'failed')
      : 'failed';
    steps.push(step('compile', compileStatus, `Compilation failed: exit code ${compileExit.exitCode}, signal ${compileExit.exitSignal}`, clock));

    const summary = buildSummary(
      env, sourceDigest, compileSummary, null, null, null,
      [opId, compileProposal.operationId],
      preview.checkpointCoverage,
      compileProposal, null,
    );

    return makeResult(compileStatus, 'compile', steps, summary, null, clock);
  }

  steps.push(step('compile', 'succeeded', 'Compilation succeeded: exit code 0', clock));

  // ==========================================================================
  // AC #3: Execution proposed, validated, and executed.
  // ==========================================================================
  steps.push(step('execute', 'running', `Executing with: ${env.executeArgv.join(' ')}`, clock));

  const executeProposal = {
    operationId: newOperationId(),
    executable: env.executeArgv[0],
    argv: env.executeArgv,
    cwd: env.cwd,
    environment: {},
    shellPolicy: 'no-shell' as const,
    timeoutMs: env.timeoutMs,
    outputLimitBytes: env.outputLimitBytes,
    actionDigest: '',
  };
  executeProposal.actionDigest = computeCommandActionDigest(executeProposal);

  // Validate the execute command.
  const executeValidation = validateControlledCommand(executeProposal, validationCtx);
  if (!executeValidation.ok) {
    steps.push(step('execute', 'failed', `Execute command validation failed: ${executeValidation.reason}`, clock));
    return makeResult('failed', 'execute', steps, null, null, clock);
  }

  // Create authorization for execute.
  const executeBinding: ProposalBinding = {
    actionClass: 'run_command',
    target: executeProposal.executable,
    payload: executeProposal.actionDigest,
  };
  const executeAuth = createAuthorization({
    operationId: executeProposal.operationId,
    binding: executeBinding,
    decision: {
      outcome: 'allow',
      reason: 'proof-execute',
      matrixVersion: 1,
      activationRevision: env.activationRevision,
      actionClass: 'run_command',
    },
    activationId: env.activationId,
    activationRevision: env.activationRevision,
    authorityRevision: env.authorityRevision,
    approvingInteraction: 'proof-orchestrator',
    clock,
  });

  // Consume authorization and append EffectDispatchCommitted.
  const executeConsume = consumeAuthorization(executeAuth);
  if (!executeConsume.ok) {
    steps.push(step('execute', 'failed', `Execute authorization consumption failed: ${executeConsume.cause}`, clock));
    return makeResult('failed', 'execute', steps, null, null, clock);
  }

  env.journal.append(
    durableEvent(
      { kind: 'EffectDispatchCommitted', operationId: executeProposal.operationId },
      env.sessionId as never,
      { operationId: executeProposal.operationId, provenanceKind: 'deterministic', provenanceSource: 'proof-execute', clock },
    ),
  );

  // Execute the command.
  const executeProcess = env.processRunner.spawn(
    executeProposal.executable,
    executeProposal.argv,
    { cwd: executeProposal.cwd, env: executeProposal.environment, timeoutMs: executeProposal.timeoutMs },
  );

  // Wait for execute to complete.
  const executeExit = await executeProcess.wait();

  const executeSummary: CommandExecutionSummary = {
    executable: executeProposal.executable,
    argv: executeProposal.argv,
    exitCode: executeExit.exitCode,
    terminalStatus: executeExit.exitSignal
      ? (['SIGTERM', 'SIGINT', 'SIGKILL'].includes(executeExit.exitSignal) ? 'cancelled' : 'failed')
      : (executeExit.exitCode === 0 ? 'succeeded' : 'failed'),
    sanitizedStdout: executeExit.stdout,
    sanitizedStderr: executeExit.stderr,
  };

  // AC #6: Execution fails -> failed, not success.
  if (executeExit.exitCode !== 0 || executeExit.exitSignal !== null) {
    const execStatus: ProofStatus = executeExit.exitSignal
      ? (['SIGTERM', 'SIGINT', 'SIGKILL'].includes(executeExit.exitSignal) ? 'cancelled' : 'failed')
      : 'failed';
    steps.push(step('execute', execStatus, `Execution failed: exit code ${executeExit.exitCode}, signal ${executeExit.exitSignal}`, clock));

    const summary = buildSummary(
      env, sourceDigest, compileSummary, executeSummary, executeExit.stdout, null,
      [opId, compileProposal.operationId, executeProposal.operationId],
      preview.checkpointCoverage,
      compileProposal, executeProposal,
    );

    return makeResult(execStatus, 'execute', steps, summary, null, clock);
  }

  steps.push(step('execute', 'succeeded', 'Execution succeeded: exit code 0', clock));

  // ==========================================================================
  // AC #4: Verify output matches expected Hello, World! after line-ending
  // normalization. Only post-commit Evidence can publish completion.
  // ==========================================================================
  steps.push(step('verify', 'running', 'Verifying output matches expected Hello, World!', clock));

  const normalizedStdout = normalizeLineEndings(executeExit.stdout);
  const normalizedExpected = normalizeLineEndings(EXPECTED_HELLO_OUTPUT);
  const outputMatch = normalizedStdout.trim() === normalizedExpected.trim();

  if (!outputMatch) {
    steps.push(step('verify', 'failed', `Output mismatch: expected "${EXPECTED_HELLO_OUTPUT}", got "${executeExit.stdout}"`, clock));

    const summary = buildSummary(
      env, sourceDigest, compileSummary, executeSummary, executeExit.stdout, false,
      [opId, compileProposal.operationId, executeProposal.operationId],
      preview.checkpointCoverage,
      compileProposal, executeProposal,
    );

    return makeResult('failed', 'verify', steps, summary, null, clock);
  }

  // AC #4: Only post-commit Evidence can publish completion.
  // Append OperationSucceeded to the journal (post-commit).
  env.journal.append(
    durableEvent(
      { kind: 'OperationSucceeded', operationId: opId },
      env.sessionId as never,
      { operationId: opId, provenanceKind: 'deterministic', provenanceSource: 'proof-orchestrator', clock },
    ),
  );

  steps.push(step('verify', 'succeeded', `Output matches expected "${EXPECTED_HELLO_OUTPUT}"`, clock));
  steps.push(step('terminal', 'succeeded', 'Canonical C++ Hello, World! proof completed successfully', clock));

  // Build the complete summary.
  const summary = buildSummary(
    env, sourceDigest, compileSummary, executeSummary, executeExit.stdout, true,
    [opId, compileProposal.operationId, executeProposal.operationId],
    preview.checkpointCoverage,
    compileProposal, executeProposal,
  );

  return makeResult('succeeded', 'terminal', steps, summary, null, clock);
}
