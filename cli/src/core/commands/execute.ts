// Controlled command execution (Story 3.7 AC #3, AC #5, AD-4, AD-12, AD-13,
// AD-19, AD-24, AD-27). Exact command passes policy + approval -> execution
// records exact executable, argv, cwd, safe env summary, authority, timeout;
// the PEP ATOMICALLY consumes authorization + appends EffectDispatchCommitted
// BEFORE launch; output sanitized before Evidence/UI publication (AC #3).
// Command side effects are marked excluded/never-protected for rollback scope;
// NO command result is treated as a rollback checkpoint (AC #5, AD-19).

import type { Authorization } from '../permissions/authorization.js';
import { consumeAuthorization, revalidateAuthorization } from '../permissions/authorization.js';
import type { ProposalBinding } from '../permissions/authorization.js';
import { durableEvent } from '../agent/dispatch.js';
import { asSessionId } from '../protocol/ids.js';
import type {
  CommandExecutionContext,
  CommandExecutionResult,
  CommandProposal,
  ProcessTreeState,
} from './types.js';

// --- Error class ---

export class CommandExecutionError extends Error {
  constructor(
    public readonly category: string,
    public readonly causeCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

// --- Main execution function ---

/**
 * Execute a controlled command (Story 3.7 AC #3, AC #5).
 *
 * Exact ordered execution:
 * 1. Revalidate authorization against current proposal
 * 2. ATOMICALLY consume authorization + append EffectDispatchCommitted
 * 3. Launch process via ProcessRunner
 * 4. Wait for completion (with timeout)
 * 5. Sanitize output before Evidence/UI publication
 * 6. Return result with honest terminal status
 *
 * AC #5: Command side effects are marked excluded/never-protected for rollback
 * scope. NO command result is treated as a rollback checkpoint.
 */
export async function executeControlledCommand(
  proposal: CommandProposal,
  authorization: Authorization,
  ctx: CommandExecutionContext,
  signal?: AbortSignal,
): Promise<CommandExecutionResult> {
  // 1. Revalidate authorization against current proposal.
  const binding: ProposalBinding = {
    actionClass: 'run_command',
    target: proposal.executable,
    payload: proposal.actionDigest,
  };

  const revalidation = revalidateAuthorization(authorization, {
    binding,
    activationId: ctx.activationId,
    activationRevision: ctx.activationRevision,
    authorityRevision: ctx.authorityRevision,
    now: ctx.clock(),
  });

  if (!revalidation.ok) {
    throw new CommandExecutionError(
      'authorization-failed',
      revalidation.cause ?? 'unknown',
      `authorization revalidation failed: ${revalidation.cause ?? 'unknown'}`,
    );
  }

  // 2. ATOMICALLY consume authorization + append EffectDispatchCommitted.
  const consumeResult = consumeAuthorization(authorization);
  if (!consumeResult.ok || !consumeResult.authorization) {
    throw new CommandExecutionError(
      'authorization-failed',
      consumeResult.cause ?? 'already-consumed',
      `authorization consumption failed: ${consumeResult.cause ?? 'already-consumed'}`,
    );
  }

  // Append EffectDispatchCommitted BEFORE launch (linearization point).
  ctx.journal.append(
    durableEvent(
      { kind: 'EffectDispatchCommitted', operationId: proposal.operationId },
      asSessionId(ctx.sessionId),
      {
        operationId: proposal.operationId,
        provenanceKind: 'deterministic',
        provenanceSource: 'command-executor',
        clock: ctx.clock,
      },
    ),
  );

  // 3. Launch process via ProcessRunner.
  const process = ctx.processRunner.spawn(proposal.executable, proposal.argv, {
    cwd: proposal.cwd,
    env: proposal.environment,
    timeoutMs: proposal.timeoutMs,
    signal,
  });

  // 4. Wait for completion.
  const exit = await process.wait();

  // 5. Sanitize output before Evidence/UI publication (AD-24).
  const sanitizedStdout = ctx.sanitizer.sanitizeOrBlock(
    exit.stdout,
    'command-output',
    '(output redacted)',
  );
  const sanitizedStderr = ctx.sanitizer.sanitizeOrBlock(
    exit.stderr,
    'command-output',
    '(output redacted)',
  );

  // 6. Determine terminal status.
  const terminalStatus: ProcessTreeState = determineTerminalStatus(exit.exitCode, exit.exitSignal);

  // 7. Return result.
  return {
    executable: proposal.executable,
    argv: proposal.argv,
    cwd: proposal.cwd,
    environmentSummary: { ...proposal.environment },
    authority: {
      activationId: ctx.activationId,
      activationRevision: ctx.activationRevision,
      authorizationId: authorization.authorizationId,
    },
    timeoutMs: proposal.timeoutMs,
    sanitizedStdout,
    sanitizedStderr,
    exitCode: exit.exitCode,
    terminalStatus,
    completedAt: ctx.clock(),
  };
}

// --- Terminal status determination ---

/**
 * Determine the honest terminal status from process exit information (AC #4).
 * Never fabricates a `succeeded` or `cancelled` status when the outcome is
 * uncertain.
 */
export function determineTerminalStatus(
  exitCode: number | null,
  exitSignal: string | null,
): ProcessTreeState {
  if (exitSignal !== null) {
    // Process was killed by a signal.
    if (exitSignal === 'SIGTERM' || exitSignal === 'SIGINT' || exitSignal === 'SIGKILL') {
      return 'cancelled';
    }
    return 'failed';
  }
  if (exitCode !== null) {
    return exitCode === 0 ? 'succeeded' : 'failed';
  }
  // Neither exit code nor signal — outcome is unknown.
  return 'unknown-outcome';
}

// --- AC #5: Rollback scope marker ---

/**
 * Mark command side effects as excluded/never-protected for rollback scope
 * (Story 3.7 AC #5, AD-19). Command results are NEVER treated as rollback
 * checkpoints. Returns a list of excluded effects describing the command's
 * potential side effects.
 */
export function commandExcludedEffects(
  proposal: CommandProposal,
): readonly { readonly target: string; readonly reason: string; readonly reasonCode: string }[] {
  return [
    {
      target: `command:${proposal.executable}`,
      reason: 'command execution side effects are never protected by rollback',
      reasonCode: 'command-never-protected',
    },
    {
      target: `argv:${proposal.argv.join(' ')}`,
      reason: 'command argv is not a rollback checkpoint',
      reasonCode: 'command-argv-not-checkpoint',
    },
  ];
}
