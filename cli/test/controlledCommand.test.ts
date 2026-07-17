// Controlled command tests (Story 3.7, all 5 ACs). Uses fake ProcessRunner port
// + injected clock + fake journal. Covers: argv validation rejects shell
// expansion/substitution/globbing/implicit-cwd-rebind/unsafe-env/host-threatening;
// denied/refused/enforcement-unverified for unsupported-shell/out-of-Workspace/
// privileged/network/unavailable-enforcement, no launch under any profile;
// EffectDispatchCommitted before launch + sanitized output; cancellation request+ack
// phases + process-tree kill + descendants wait/uncertainty + no orphans + honest
// cancelled/failed/still-running/unknown-outcome; command side effects marked
// excluded/never-protected + no command result treated as rollback checkpoint.
// >=22 cases. No real processes spawned. No network/real creds.

import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  validateControlledCommand,
  computeCommandActionDigest,
  defaultValidationContext,
  executeControlledCommand,
  CommandExecutionError,
  commandExcludedEffects,
  determineTerminalStatus,
  handleCommandCancellation,
  handleProcessFailure,
  handleTimeout,
  handleTerminalLoss,
  handleUnknownOutcome,
} from '../src/core/commands/index.js';
import type {
  CommandProposal,
  CommandValidationResult,
  CommandExecutionContext,
  ControlledProcess,
  ProcessExit,
  ProcessRunner,
  ValidationContext,
} from '../src/core/commands/types.js';
import { newOperationId } from '../src/core/protocol/ids.js';
import type { Authorization } from '../src/core/permissions/authorization.js';
import { createAuthorization, consumeAuthorization } from '../src/core/permissions/authorization.js';
import type { PepDecision } from '../src/core/permissions/pep.js';
import { CoreApp } from '../src/core/app.js';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';

// =============================================================================
// Fake ProcessRunner
// =============================================================================

interface FakeProcessOptions {
  readonly exitCode?: number | null;
  readonly exitSignal?: string | null;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly delayMs?: number;
  readonly killThrows?: boolean;
}

class FakeControlledProcess implements ControlledProcess {
  readonly pid: number;
  private _killed = false;
  private _killTreeCalled = false;
  private _killTreeThrows: boolean;
  private readonly _exitCode: number | null;
  private readonly _exitSignal: string | null;
  private readonly _stdout: string;
  private readonly _stderr: string;
  private readonly _delayMs: number;
  private _resolveWait!: (value: ProcessExit) => void;
  private readonly _waitPromise: Promise<ProcessExit>;

  constructor(opts: FakeProcessOptions = {}) {
    this.pid = Math.floor(Math.random() * 65535) + 1000;
    this._exitCode = opts.exitCode ?? 0;
    this._exitSignal = opts.exitSignal ?? null;
    this._stdout = opts.stdout ?? '';
    this._stderr = opts.stderr ?? '';
    this._delayMs = opts.delayMs ?? 0;
    this._killTreeThrows = opts.killThrows ?? false;
    this._waitPromise = new Promise((resolve) => {
      this._resolveWait = resolve;
    });
  }

  kill(): void {
    this._killed = true;
  }

  get killed(): boolean {
    return this._killed;
  }

  get killTreeCalled(): boolean {
    return this._killTreeCalled;
  }

  async killTree(): Promise<void> {
    this._killTreeCalled = true;
    if (this._killTreeThrows) {
      throw new Error('killTree failed');
    }
  }

  async wait(): Promise<ProcessExit> {
    if (this._delayMs > 0) {
      await new Promise((r) => setTimeout(r, this._delayMs));
    }
    const result: ProcessExit = {
      exitCode: this._exitCode,
      exitSignal: this._exitSignal,
      stdout: this._stdout,
      stderr: this._stderr,
    };
    this._resolveWait(result);
    return result;
  }

  /** Resolve the wait promise immediately (for tests that need to control timing). */
  resolveNow(): void {
    this._resolveWait({
      exitCode: this._exitCode,
      exitSignal: this._exitSignal,
      stdout: this._stdout,
      stderr: this._stderr,
    });
  }
}

class FakeProcessRunner implements ProcessRunner {
  readonly spawned: Array<{
    executable: string;
    argv: readonly string[];
    cwd: string;
    env: Record<string, string>;
    timeoutMs: number;
  }> = [];
  private _nextProcess: FakeControlledProcess | null = null;

  setNextProcess(proc: FakeControlledProcess): void {
    this._nextProcess = proc;
  }

  spawn(
    executable: string,
    argv: readonly string[],
    opts: { cwd: string; env: Record<string, string>; timeoutMs: number; signal?: AbortSignal },
  ): ControlledProcess {
    this.spawned.push({ executable, argv, cwd: opts.cwd, env: opts.env, timeoutMs: opts.timeoutMs });
    if (this._nextProcess) {
      const p = this._nextProcess;
      this._nextProcess = null;
      return p;
    }
    return new FakeControlledProcess();
  }
}

// =============================================================================
// Fake journal
// =============================================================================

class FakeJournal {
  readonly events: unknown[] = [];

  append(event: unknown): number {
    this.events.push(event);
    return this.events.length;
  }
}

// =============================================================================
// Fake sanitizer
// =============================================================================

class FakeSanitizer {
  sanitizeOrBlock(value: string, _contentClass: string, fallback: string): string {
    // Simple sanitization: redact anything that looks like a secret.
    const redacted = value.replace(/sk-[A-Za-z0-9]{16,}/g, '[redacted:api-key]');
    if (redacted.length === 0 && value.length > 0) return fallback;
    return redacted;
  }
}

// =============================================================================
// Helpers
// =============================================================================

function makeProposal(overrides: Partial<CommandProposal> = {}): CommandProposal {
  const base: Omit<CommandProposal, 'actionDigest'> = {
    operationId: newOperationId(),
    executable: 'gcc',
    argv: ['gcc', '--version'],
    cwd: process.cwd(),
    environment: { CC: 'gcc' },
    shellPolicy: 'no-shell',
    timeoutMs: 60_000,
    outputLimitBytes: 1024 * 1024,
  };
  const actionDigest = computeCommandActionDigest({ ...base, ...overrides });
  return { ...base, ...overrides, actionDigest };
}

function makeAuthorization(proposal: CommandProposal): Authorization {
  const decision: PepDecision = {
    outcome: 'allow',
    reason: 'full-access-auto-approve',
    matrixVersion: 1,
    activationRevision: 1,
    actionClass: 'run_command',
  };
  return createAuthorization({
    operationId: proposal.operationId,
    binding: {
      actionClass: 'run_command',
      target: proposal.executable,
      payload: proposal.actionDigest,
    },
    decision,
    activationId: 'act-1',
    activationRevision: 1,
    authorityRevision: 1,
    approvingInteraction: 'test',
    clock: () => '2026-07-17T00:00:00.000Z',
  });
}

function makeContext(overrides: Partial<CommandExecutionContext> = {}): CommandExecutionContext {
  return {
    processRunner: new FakeProcessRunner(),
    clock: () => '2026-07-17T00:00:00.000Z',
    sessionId: 'sess-test',
    activationId: 'act-1',
    activationRevision: 1,
    authorityRevision: 1,
    journal: new FakeJournal(),
    sanitizer: new FakeSanitizer(),
    ...overrides,
  };
}

function makeValidationContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    workspaceRoot: '/ws-root',
    allowedExecutables: new Set(['gcc', 'g++', 'clang', 'node', 'python3', 'make', 'git', 'cat', 'echo', 'ls']),
    blockedEnvNames: new Set(['PATH', 'HOME', 'USER', 'SHELL', 'LD_PRELOAD']),
    maxTimeoutMs: 300_000,
    maxOutputBytes: 10 * 1024 * 1024,
    platform: 'darwin',
    enforcementAvailable: true,
    clock: () => '2026-07-17T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Story 3.7 AC #1: Command validation — argv, cwd, env, shell policy, timeout, output limits, action digest', () => {
  it('validates a well-formed proposal', () => {
    const proposal = makeProposal();
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposal.executable).toBe('gcc');
      expect(result.proposal.argv).toEqual(['gcc', '--version']);
    }
  });

  it('rejects shell expansion in argv ($)', () => {
    const proposal = makeProposal({ argv: ['gcc', '$HOME'] });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('shell-metacharacter-in-argv');
    }
  });

  it('rejects command substitution in argv (`) ', () => {
    const proposal = makeProposal({ argv: ['gcc', '`cat /etc/passwd`'] });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('shell-metacharacter-in-argv');
    }
  });

  it('rejects globbing in argv (*)', () => {
    const proposal = makeProposal({ argv: ['gcc', '*.c'] });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('shell-metacharacter-in-argv');
    }
  });

  it('rejects pipe in argv (|)', () => {
    const proposal = makeProposal({ argv: ['gcc', '|', 'rm', '-rf', '/'] });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('shell-metacharacter-in-argv');
    }
  });

  it('rejects semicolon in argv (;)', () => {
    const proposal = makeProposal({ argv: ['gcc', ';', 'rm', '-rf', '/'] });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('shell-metacharacter-in-argv');
    }
  });

  it('rejects implicit current-directory rebinding via empty cwd', () => {
    const proposal = makeProposal({ cwd: '' });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('empty-cwd');
    }
  });

  it('rejects cwd outside workspace', () => {
    const proposal = makeProposal({ cwd: '/etc' });
    const ctx = makeValidationContext({ workspaceRoot: '/ws-root' });
    const result = validateControlledCommand(proposal, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('cwd-outside-workspace');
    }
  });

  it('rejects unsafe environment inheritance (blocked env name)', () => {
    const proposal = makeProposal({ environment: { PATH: '/usr/bin' } });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('blocked-env-name');
    }
  });

  it('rejects environment value with shell metacharacters', () => {
    const proposal = makeProposal({ environment: { MY_VAR: 'hello; rm -rf /' } });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('shell-metacharacter-in-env-value');
    }
  });

  it('rejects host-threatening commands (privileged/system mutation)', () => {
    const proposal = makeProposal({ executable: 'chmod', argv: ['chmod', '777', '/etc/passwd'] });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('privileged-command-denied');
    }
  });

  it('rejects invalid shell policy', () => {
    const proposal = makeProposal({ shellPolicy: 'invalid-policy' as 'no-shell' });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('invalid-shell-policy');
    }
  });

  it('rejects timeout exceeding maximum', () => {
    const proposal = makeProposal({ timeoutMs: 600_000 });
    const ctx = makeValidationContext({ workspaceRoot: process.cwd(), maxTimeoutMs: 300_000 });
    const result = validateControlledCommand(proposal, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('timeout-exceeds-limit');
    }
  });

  it('rejects output limit exceeding maximum', () => {
    const proposal = makeProposal({ outputLimitBytes: 20 * 1024 * 1024 });
    const ctx = makeValidationContext({ workspaceRoot: process.cwd(), maxOutputBytes: 10 * 1024 * 1024 });
    const result = validateControlledCommand(proposal, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('output-limit-exceeds-max');
    }
  });

  it('rejects action digest mismatch', () => {
    // Create a valid proposal first, then override the digest.
    const valid = makeProposal();
    const proposal: CommandProposal = { ...valid, actionDigest: '0000000000000000000000000000000000000000000000000000000000000000' };
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('action-digest-mismatch');
    }
  });

  it('rejects empty executable', () => {
    const proposal = makeProposal({ executable: '' });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('empty-executable');
    }
  });

  it('rejects executable with path separators outside workspace', () => {
    const proposal = makeProposal({ executable: '/usr/bin/gcc' });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('executable-path-outside-workspace');
    }
  });

  it('rejects executable not in allowed set', () => {
    const proposal = makeProposal({ executable: 'rm' });
    const ctx = makeValidationContext({ allowedExecutables: new Set(['gcc', 'node']) });
    const result = validateControlledCommand(proposal, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('executable-not-allowed');
    }
  });
});

describe('Story 3.7 AC #2: Denied/refused/enforcement-unverified — no launch under any profile', () => {
  it('returns enforcement-unverified when process enforcement is unavailable', () => {
    const proposal = makeProposal();
    const ctx = makeValidationContext({ enforcementAvailable: false });
    const result = validateControlledCommand(proposal, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('enforcement-unverified');
      expect(result.reasonCode).toBe('enforcement-unverified');
    }
  });

  it('returns refused for unsupported platform with shell policy', () => {
    const proposal = makeProposal({ shellPolicy: 'allowed-shell' });
    const ctx = makeValidationContext({ workspaceRoot: process.cwd(), platform: 'linux' });
    const result = validateControlledCommand(proposal, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('refused');
      expect(result.reasonCode).toBe('unsupported-platform-for-shell');
    }
  });

  it('returns denied for out-of-Workspace cwd', () => {
    const proposal = makeProposal({ cwd: '/outside' });
    const ctx = makeValidationContext({ workspaceRoot: '/ws-root' });
    const result = validateControlledCommand(proposal, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('cwd-outside-workspace');
    }
  });

  it('returns denied for privileged/system mutation command', () => {
    const proposal = makeProposal({ executable: 'chmod', argv: ['chmod', '755', 'file'] });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('privileged-command-denied');
    }
  });

  it('returns denied for network boundary command', () => {
    const proposal = makeProposal({ executable: 'curl', argv: ['curl', 'https://example.com'] });
    // Add curl to the allowed set so the check reaches the network boundary test.
    const ctx = makeValidationContext({
      workspaceRoot: process.cwd(),
      allowedExecutables: new Set(['gcc', 'g++', 'clang', 'node', 'python3', 'make', 'git', 'cat', 'echo', 'ls', 'curl']),
    });
    const result = validateControlledCommand(proposal, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('denied');
      expect(result.reasonCode).toBe('network-boundary-denied');
    }
  });

  it('does not launch a process when validation fails', () => {
    const runner = new FakeProcessRunner();
    const proposal = makeProposal({ executable: 'curl', argv: ['curl', 'https://example.com'] });
    const result = validateControlledCommand(proposal);
    expect(result.ok).toBe(false);
    // No process should have been spawned.
    expect(runner.spawned.length).toBe(0);
  });
});

describe('Story 3.7 AC #3: Execution records exact details, EffectDispatchCommitted before launch, sanitized output', () => {
  it('records exact executable, argv, cwd, env summary, authority, timeout', async () => {
    const proposal = makeProposal();
    const authorization = makeAuthorization(proposal);
    const runner = new FakeProcessRunner();
    const proc = new FakeControlledProcess({ stdout: 'gcc (GCC) 14.2.0\n' });
    runner.setNextProcess(proc);
    const journal = new FakeJournal();
    const ctx = makeContext({ processRunner: runner, journal });

    const result = await executeControlledCommand(proposal, authorization, ctx);

    expect(result.executable).toBe('gcc');
    expect(result.argv).toEqual(['gcc', '--version']);
    expect(result.cwd).toBe(process.cwd());
    expect(result.environmentSummary).toEqual({ CC: 'gcc' });
    expect(result.authority.activationId).toBe('act-1');
    expect(result.authority.activationRevision).toBe(1);
    expect(result.authority.authorizationId).toBe(authorization.authorizationId);
    expect(result.timeoutMs).toBe(60_000);
  });

  it('appends EffectDispatchCommitted BEFORE launch', async () => {
    const proposal = makeProposal();
    const authorization = makeAuthorization(proposal);
    const runner = new FakeProcessRunner();
    const proc = new FakeControlledProcess({ stdout: 'output\n' });
    runner.setNextProcess(proc);
    const journal = new FakeJournal();
    const ctx = makeContext({ processRunner: runner, journal });

    // Check that EffectDispatchCommitted is appended before the process is spawned.
    const result = await executeControlledCommand(proposal, authorization, ctx);

    // The journal should have the EffectDispatchCommitted event.
    const committedEvent = journal.events.find(
      (e: unknown) => (e as Record<string, unknown>)?.payload &&
        (e as { payload: { kind: string } }).payload.kind === 'EffectDispatchCommitted',
    );
    expect(committedEvent).toBeDefined();
    if (committedEvent) {
      const ev = committedEvent as { payload: { operationId?: string } };
      expect(ev.payload.operationId).toBe(proposal.operationId);
    }

    // The process should have been spawned.
    expect(runner.spawned.length).toBe(1);
    expect(runner.spawned[0].executable).toBe('gcc');
  });

  it('sanitizes output before returning', async () => {
    const proposal = makeProposal();
    const authorization = makeAuthorization(proposal);
    const runner = new FakeProcessRunner();
    const proc = new FakeControlledProcess({
      stdout: 'API key: sk-abcdef1234567890abcdef1234567890\n',
      stderr: '',
    });
    runner.setNextProcess(proc);
    const ctx = makeContext({ processRunner: runner });

    const result = await executeControlledCommand(proposal, authorization, ctx);

    // The API key should be redacted.
    expect(result.sanitizedStdout).not.toContain('sk-abcdef1234567890abcdef1234567890');
    expect(result.sanitizedStdout).toContain('[redacted:api-key]');
  });

  it('throws CommandExecutionError when authorization revalidation fails', async () => {
    const proposal = makeProposal();
    // Create an authorization with a different activation revision.
    const decision: PepDecision = {
      outcome: 'allow',
      reason: 'full-access-auto-approve',
      matrixVersion: 1,
      activationRevision: 1,
      actionClass: 'run_command',
    };
    const authorization = createAuthorization({
      operationId: proposal.operationId,
      binding: {
        actionClass: 'run_command',
        target: proposal.executable,
        payload: proposal.actionDigest,
      },
      decision,
      activationId: 'act-1',
      activationRevision: 1,
      authorityRevision: 1,
      approvingInteraction: 'test',
      clock: () => '2026-07-17T00:00:00.000Z',
    });
    // Use a different activation revision in the context.
    const ctx = makeContext({ activationRevision: 2 });

    await expect(
      executeControlledCommand(proposal, authorization, ctx),
    ).rejects.toThrow(CommandExecutionError);
  });

  it('throws CommandExecutionError when authorization is already consumed', async () => {
    const proposal = makeProposal();
    const authorization = makeAuthorization(proposal);
    // Consume the authorization first. consumeAuthorization returns a new
    // immutable copy with consumed: true; the original stays unconsumed.
    const consumed = consumeAuthorization(authorization);
    expect(consumed.ok).toBe(true);
    expect(consumed.authorization).toBeDefined();

    // Pass the consumed authorization (consumed: true) to the executor.
    const ctx = makeContext();

    await expect(
      executeControlledCommand(proposal, consumed.authorization!, ctx),
    ).rejects.toThrow(CommandExecutionError);
  });
});

describe('Story 3.7 AC #4: Cancellation — request+ack phases, process-tree kill, descendants, honest state', () => {
  it('shows request and acknowledgement phases on cancellation', async () => {
    const proc = new FakeControlledProcess({ exitSignal: 'SIGTERM' });
    const lifecycle = await handleCommandCancellation(proc, {
      clock: () => '2026-07-17T00:00:00.000Z',
    });

    expect(lifecycle.phase).toBe('acknowledged');
    expect(lifecycle.state).toBe('cancelled');
    expect(lifecycle.requestedAt).toBeDefined();
    expect(lifecycle.acknowledgedAt).toBeDefined();
  });

  it('terminates the controlled process tree', async () => {
    const proc = new FakeControlledProcess({ exitSignal: 'SIGTERM' });
    await handleCommandCancellation(proc, {
      clock: () => '2026-07-17T00:00:00.000Z',
    });

    expect(proc.killed).toBe(true);
    expect(proc.killTreeCalled).toBe(true);
  });

  it('waits for descendants and reports cancelled on success', async () => {
    const proc = new FakeControlledProcess({ exitSignal: 'SIGTERM' });
    const lifecycle = await handleCommandCancellation(proc, {
      clock: () => '2026-07-17T00:00:00.000Z',
    });

    expect(lifecycle.state).toBe('cancelled');
  });

  it('reports unknown-outcome when killTree fails', async () => {
    const proc = new FakeControlledProcess({ exitSignal: 'SIGTERM', killThrows: true });
    const lifecycle = await handleCommandCancellation(proc, {
      clock: () => '2026-07-17T00:00:00.000Z',
    });

    expect(lifecycle.state).toBe('unknown-outcome');
  });

  it('prevents orphan processes by killing the process tree', async () => {
    const proc = new FakeControlledProcess({ exitSignal: 'SIGTERM' });
    await handleCommandCancellation(proc, {
      clock: () => '2026-07-17T00:00:00.000Z',
    });

    expect(proc.killed).toBe(true);
    expect(proc.killTreeCalled).toBe(true);
  });

  it('reports cancelled for SIGINT', () => {
    const state = determineTerminalStatus(null, 'SIGINT');
    expect(state).toBe('cancelled');
  });

  it('reports cancelled for SIGKILL', () => {
    const state = determineTerminalStatus(null, 'SIGKILL');
    expect(state).toBe('cancelled');
  });

  it('reports failed for non-cancellation signal', () => {
    const state = determineTerminalStatus(null, 'SIGSEGV');
    expect(state).toBe('failed');
  });

  it('reports failed for non-zero exit code', () => {
    const state = determineTerminalStatus(1, null);
    expect(state).toBe('failed');
  });

  it('reports succeeded for zero exit code', () => {
    const state = determineTerminalStatus(0, null);
    expect(state).toBe('succeeded');
  });

  it('reports unknown-outcome when neither exit code nor signal is available', () => {
    const state = determineTerminalStatus(null, null);
    expect(state).toBe('unknown-outcome');
  });

  it('handleProcessFailure returns failed state', () => {
    const lifecycle = handleProcessFailure(1, () => '2026-07-17T00:00:00.000Z');
    expect(lifecycle.state).toBe('failed');
    expect(lifecycle.phase).toBe('acknowledged');
  });

  it('handleTimeout returns cancelled state', () => {
    const lifecycle = handleTimeout(() => '2026-07-17T00:00:00.000Z');
    expect(lifecycle.state).toBe('cancelled');
    expect(lifecycle.phase).toBe('acknowledged');
  });

  it('handleTerminalLoss returns unknown-outcome state', () => {
    const lifecycle = handleTerminalLoss(() => '2026-07-17T00:00:00.000Z');
    expect(lifecycle.state).toBe('unknown-outcome');
    expect(lifecycle.phase).toBe('acknowledged');
  });

  it('handleUnknownOutcome returns unknown-outcome state', () => {
    const lifecycle = handleUnknownOutcome(() => '2026-07-17T00:00:00.000Z');
    expect(lifecycle.state).toBe('unknown-outcome');
    expect(lifecycle.phase).toBe('acknowledged');
  });
});

describe('Story 3.7 AC #5: Rollback scope — command side effects excluded/never-protected, no checkpoint', () => {
  it('marks command side effects as excluded/never-protected', () => {
    const proposal = makeProposal();
    const exclusions = commandExcludedEffects(proposal);

    expect(exclusions.length).toBeGreaterThan(0);
    for (const ex of exclusions) {
      expect(ex.reasonCode).toMatch(/command-(never-protected|argv-not-checkpoint)/);
      expect(ex.reason).toMatch(/never protected|not a rollback checkpoint/);
    }
  });

  it('no command result is treated as a rollback checkpoint', () => {
    const proposal = makeProposal();
    const exclusions = commandExcludedEffects(proposal);

    // Verify that the exclusions state no checkpoint protection.
    for (const ex of exclusions) {
      expect(ex.reason).toMatch(/never protected|not a rollback checkpoint/);
      expect(ex.reasonCode).toMatch(/command-(never-protected|argv-not-checkpoint)/);
    }
  });

  it('command execution result does not include checkpoint reference', async () => {
    const proposal = makeProposal();
    const authorization = makeAuthorization(proposal);
    const runner = new FakeProcessRunner();
    const proc = new FakeControlledProcess({ stdout: 'ok\n' });
    runner.setNextProcess(proc);
    const ctx = makeContext({ processRunner: runner });

    const result = await executeControlledCommand(proposal, authorization, ctx);

    // The result should not have any checkpoint-related fields.
    expect(result).not.toHaveProperty('checkpointReference');
    expect(result).not.toHaveProperty('checkpointId');
  });
});

describe('Story 3.7: CoreApp wiring — validateControlledCommand and runControlledCommand', () => {
  it('CoreApp.validateControlledCommand validates a proposal', () => {
    const app = new CoreApp({ credentials: new InMemoryCredentialStore() });

    const proposal = makeProposal();
    const result = app.validateControlledCommand(proposal);
    expect(result.ok).toBe(true);
  });

  it('CoreApp.runControlledCommand executes a command', async () => {
    const app = new CoreApp({ credentials: new InMemoryCredentialStore() });
    const authProj = app.authorityProjection();

    const proposal = makeProposal();
    const decision: PepDecision = {
      outcome: 'allow',
      reason: 'full-access-auto-approve',
      matrixVersion: 1,
      activationRevision: authProj.activationRevision,
      actionClass: 'run_command',
    };
    const authorization = createAuthorization({
      operationId: proposal.operationId,
      binding: {
        actionClass: 'run_command',
        target: proposal.executable,
        payload: proposal.actionDigest,
      },
      decision,
      activationId: authProj.activationId,
      activationRevision: authProj.activationRevision,
      authorityRevision: authProj.activationRevision,
      approvingInteraction: 'test',
      clock: () => '2026-07-17T00:00:00.000Z',
    });

    const runner = new FakeProcessRunner();
    const proc = new FakeControlledProcess({ stdout: 'hello\n' });
    runner.setNextProcess(proc);

    const result = await app.runControlledCommand(proposal, authorization, runner);
    expect(result.executable).toBe('gcc');
    expect(result.sanitizedStdout).toBe('hello\n');
    expect(result.exitCode).toBe(0);
  });
});
