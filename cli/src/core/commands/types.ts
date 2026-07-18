// Controlled command execution typed contracts (Story 3.7, AD-4, AD-12, AD-13,
// AD-19, AD-24, AD-27). Discriminated unions, opaque branded ids, no `any`.
// Every failure uses the AD-9 typed envelope.

import type { OperationId } from '../protocol/ids.js';

// --- ProcessRunner: injectable process-spawning port ---

export interface ProcessRunner {
  spawn(
    executable: string,
    argv: readonly string[],
    opts: {
      readonly cwd: string;
      readonly env: Record<string, string>;
      readonly timeoutMs: number;
      readonly signal?: AbortSignal;
    },
  ): ControlledProcess;
}

export interface ControlledProcess {
  readonly pid: number;
  kill(): void;
  killTree(): Promise<void>;
  wait(): Promise<ProcessExit>;
}

export interface ProcessExit {
  readonly exitCode: number | null;
  readonly exitSignal: string | null;
  readonly stdout: string;
  readonly stderr: string;
}

// --- CommandProposal (resolved approved executable identity) ---

export interface CommandProposal {
  readonly operationId: OperationId;
  /** Resolved approved executable identity (canonical name, no path separators). */
  readonly executable: string;
  /** Explicit argv vector (argv[0] is the executable name). */
  readonly argv: readonly string[];
  /** Workspace-contained cwd. */
  readonly cwd: string;
  /** Allowed environment names and values (never raw secrets). */
  readonly environment: Record<string, string>;
  /** Shell/startup-hook policy. */
  readonly shellPolicy: ShellPolicy;
  /** Timeout in milliseconds. */
  readonly timeoutMs: number;
  /** Maximum output bytes to capture. */
  readonly outputLimitBytes: number;
  /** Hex-encoded SHA-256 action digest of the canonical proposal. */
  readonly actionDigest: string;
}

export type ShellPolicy = 'no-shell' | 'allowed-shell' | 'startup-hook-only';

// --- CommandExecutionResult ---

export interface CommandExecutionResult {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly environmentSummary: Record<string, string>;
  readonly authority: {
    readonly activationId: string;
    readonly activationRevision: number;
    readonly authorizationId: string;
  };
  readonly timeoutMs: number;
  readonly sanitizedStdout: string;
  readonly sanitizedStderr: string;
  readonly exitCode: number | null;
  readonly terminalStatus: ProcessTreeState;
  readonly completedAt: string;
}

// --- CommandRefusal (AC #2) ---

export type CommandRefusal = 'denied' | 'refused' | 'enforcement-unverified';

// --- CancellationPhase (AC #4) ---

export type CancellationPhase = 'requested' | 'acknowledged';

// --- ProcessTreeState (AC #4) ---

export type ProcessTreeState =
  | 'cancelled'
  | 'failed'
  | 'still-running'
  | 'unknown-outcome'
  | 'succeeded';

// --- CancellationLifecycle (AC #4) ---

export interface CancellationLifecycle {
  readonly phase: CancellationPhase;
  readonly state: ProcessTreeState;
  readonly requestedAt: string;
  readonly acknowledgedAt: string | null;
  readonly completedAt: string;
}

// --- Validation result ---

export type CommandValidationResult =
  | { readonly ok: true; readonly proposal: CommandProposal }
  | { readonly ok: false; readonly refusal: CommandRefusal; readonly reason: string; readonly reasonCode: string };

// --- AD-9 typed failure envelope ---

export type CommandFailureCategory =
  | 'invalid-proposal'
  | 'execution-failed'
  | 'authorization-failed'
  | 'cancellation-failed'
  | 'internal-error';

export interface CommandFailure {
  readonly category: CommandFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'command';
  readonly message: string;
  readonly causeCode: string;
  readonly retryAfter?: number;
}

// --- Execution context (injectable dependencies) ---

export interface CommandExecutionContext {
  readonly processRunner: ProcessRunner;
  readonly clock: () => string;
  readonly sessionId: string;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly journal: {
    append(event: unknown): number;
  };
  readonly sanitizer: {
    sanitizeOrBlock(value: string, contentClass: string, fallback: string): string;
  };
}

// --- Validation context ---

export interface ValidationContext {
  readonly workspaceRoot: string;
  readonly allowedExecutables: ReadonlySet<string>;
  readonly blockedEnvNames: ReadonlySet<string>;
  readonly maxTimeoutMs: number;
  readonly maxOutputBytes: number;
  readonly platform: NodeJS.Platform;
  readonly enforcementAvailable: boolean;
  readonly clock: () => string;
}
