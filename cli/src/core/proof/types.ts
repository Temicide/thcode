// Proof task typed contracts (Story 3.11, AD-4, AD-12, AD-13, AD-19, AD-24,
// AD-27, AD-28). Discriminated unions, opaque branded ids, no `any`. Every
// failure uses the AD-9 typed envelope.
//
// The canonical cross-platform C++ Hello, World! proof composes existing
// 3.5/3.7/3.8/3.9/3.10 surfaces — it does NOT re-implement effect/command logic.

import type { CoverageState } from '../checkpoints/types.js';
import type { ExcludedEffect } from '../mutations/types.js';
import type { DepPreflightResult } from '../depPreflight/types.js';
import type { FsProbe, WorkspaceIdentity } from '../workspace/types.js';
import type { ProcessRunner } from '../commands/types.js';
import type { FsMutator } from '../effects/types.js';
import type { PolicyState } from '../permissions/types.js';
import type { DurableEvent } from '../protocol/events.js';
import type { KeyValueStore, BlobStore } from '../checkpoints/types.js';

// --- Canonical C++ Hello, World! source ---

/** The canonical portable C++ Hello, World! source content (cross-platform). */
export const CANONICAL_HELLO_SOURCE = `#include <iostream>
int main() {
    std::cout << "Hello, World!";
    return 0;
}
`;

/** The expected stdout after permitted line-ending normalization. */
export const EXPECTED_HELLO_OUTPUT = 'Hello, World!';

/** The canonical source filename. */
export const CANONICAL_SOURCE_FILENAME = 'hello.cpp';

// --- Proof phases ---

export type ProofPhase =
  | 'inspect'
  | 'plan'
  | 'approve'
  | 'create-source'
  | 'compile'
  | 'execute'
  | 'verify'
  | 'terminal';

// --- Proof status ---

export type ProofStatus =
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'conflict'
  | 'unknown-outcome'
  | 'accepted-limitation'
  | 'prerequisite-blocker';

// --- Proof step ---

export interface ProofStep {
  readonly phase: ProofPhase;
  readonly status: 'pending' | 'running' | ProofStatus;
  readonly detail: string;
  readonly timestamp: string;
}

// --- Compiler identity ---

export interface CompilerIdentity {
  readonly executable: string;
  readonly version: string | null;
  readonly platform: NodeJS.Platform;
}

// --- Command execution summary ---

export interface CommandExecutionSummary {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly exitCode: number | null;
  readonly terminalStatus: string;
  readonly sanitizedStdout: string;
  readonly sanitizedStderr: string;
}

// --- Proof summary ---

export interface ProofSummary {
  readonly sourceFile: string;
  readonly sourceDigest: string;
  readonly compiler: CompilerIdentity | null;
  readonly compileCommand: CommandExecutionSummary | null;
  readonly executeCommand: CommandExecutionSummary | null;
  readonly expectedOutput: string;
  readonly observedOutput: string | null;
  readonly outputMatch: boolean | null;
  readonly operationIds: readonly string[];
  readonly checkpointCoverage: CoverageState | null;
  readonly excludedEffects: readonly ExcludedEffect[];
  readonly protectedChanges: readonly string[];
}

// --- Proof result ---

export interface ProofResult {
  readonly status: ProofStatus;
  readonly phase: ProofPhase;
  readonly steps: readonly ProofStep[];
  readonly summary: ProofSummary | null;
  readonly guidance: string | null;
  readonly completedAt: string;
}

// --- Proof environment (injectable port) ---

export interface ProofEnvironment {
  readonly workspace: WorkspaceIdentity;
  readonly fsProbe: FsProbe;
  readonly fsMutator: FsMutator;
  readonly processRunner: ProcessRunner;
  readonly depPreflightResult: DepPreflightResult;
  readonly policyState: PolicyState;
  readonly journal: {
    append(event: DurableEvent): number;
    eventsOfKind(kind: string): DurableEvent[];
    lastEvent(): DurableEvent | undefined;
  };
  readonly kvStore: KeyValueStore;
  readonly blobStore?: BlobStore;
  readonly encKey?: Buffer;
  readonly sessionId: string;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly clock: () => string;
  readonly sourceTarget: string;
  readonly compilerExecutable: string;
  readonly compileArgv: readonly string[];
  readonly executeArgv: readonly string[];
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly outputLimitBytes: number;
}

// --- AD-9 typed failure envelope ---

export type ProofFailureCategory =
  | 'invalid-environment'
  | 'preflight-blocked'
  | 'source-creation-failed'
  | 'compilation-failed'
  | 'execution-failed'
  | 'verification-failed'
  | 'cancelled'
  | 'conflict-detected'
  | 'unknown-outcome'
  | 'internal-error';

export interface ProofFailure {
  readonly category: ProofFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'proof';
  readonly message: string;
  readonly causeCode: string;
  readonly retryAfter?: number;
}
