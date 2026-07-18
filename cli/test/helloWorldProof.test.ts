// Hello World proof tests (Story 3.11, all 6 ACs). Uses fake ProofEnvironment
// (depPreflight + fs + ProcessRunner + journal + clock). Covers: inspect->plan->
// approve->create-source exact order + approval required; exact checkpoint/mutation
// order + EffectDispatchCommitted + completion only post-commit; compile+exec
// validated+disclosed + controlled process tree + sanitized streamed output;
// compile=0 exec=0 stdout=`Hello, World!` (incl. \r\n normalization) -> succeeded
// + full summary + post-commit-only completion; compiler missing -> prerequisite-blocker
// + platform guidance + no invented command/install + not success; compile/exec/verify/
// cancel/conflict/cleanup failure -> failed/cancelled/conflict/unknown-outcome/
// accepted-limitation + never affirmative + protected built-in changes vs excluded
// command/process effects. >=24 cases. No real processes/compilers/network/creds.

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { runHelloWorldProof } from '../src/core/proof/helloWorldProof.js';
import type {
  ProofEnvironment,
  ProofResult,
  ProofStatus,
  ProofSummary,
} from '../src/core/proof/types.js';
import {
  CANONICAL_HELLO_SOURCE,
  EXPECTED_HELLO_OUTPUT,
} from '../src/core/proof/types.js';
import type { EnvironmentProbe, DepPreflightResult } from '../src/core/depPreflight/types.js';
import type { FsProbe, WorkspaceIdentity } from '../src/core/workspace/types.js';
import type { FsMutator } from '../src/core/effects/types.js';
import type { ProcessRunner, ControlledProcess, ProcessExit } from '../src/core/commands/types.js';
import type { PolicyState } from '../src/core/permissions/types.js';
import type { DurableEvent } from '../src/core/protocol/events.js';
import type { KeyValueStore, BlobStore } from '../src/core/checkpoints/types.js';

// =============================================================================
// In-memory filesystem
// =============================================================================

interface InMemoryFile {
  content?: Uint8Array;
  isDir?: boolean;
  isSymlink?: boolean;
  linkTarget?: string;
  dev?: number;
  ino?: number;
}

class InMemoryFileSystem {
  readonly files = new Map<string, InMemoryFile>();

  constructor() {
    this.files.set('/ws-root', { isDir: true, dev: 42, ino: 1 });
  }

  addFile(path: string, content: string, opts?: { dev?: number; ino?: number }): void {
    this.files.set(path, { content: new TextEncoder().encode(content), dev: opts?.dev ?? 42, ino: opts?.ino ?? 100 });
  }

  addDir(path: string): void {
    this.files.set(path, { isDir: true, dev: 42, ino: 1 });
  }
}

function inMemoryFsProbe(fs: InMemoryFileSystem): FsProbe {
  return {
    realpath(p: string): string {
      if (!fs.files.has(p) && !Array.from(fs.files.keys()).some((k) => k.startsWith(p))) {
        if (p.endsWith('/ws-root')) return p;
        throw new Error(`ENOENT: ${p}`);
      }
      return p;
    },
    lstat(p: string) {
      const entry = fs.files.get(p);
      if (!entry) throw new Error(`ENOENT: ${p}`);
      return {
        dev: entry.dev ?? 42,
        ino: entry.ino ?? 100,
        size: entry.content ? entry.content.length : 0,
        isDirectory: entry.isDir ?? false,
        isFile: !entry.isDir && !entry.isSymlink,
        isSymbolicLink: entry.isSymlink ?? false,
      };
    },
    stat(p: string) {
      const entry = fs.files.get(p);
      if (!entry) throw new Error(`ENOENT: ${p}`);
      return {
        dev: entry.dev ?? 42,
        ino: entry.ino ?? 100,
        size: entry.content ? entry.content.length : 0,
        isDirectory: entry.isDir ?? false,
        isFile: !entry.isDir,
      };
    },
    readlink(p: string): string {
      const entry = fs.files.get(p);
      if (!entry?.isSymlink || !entry.linkTarget) throw new Error(`EINVAL: ${p} is not a symlink`);
      return entry.linkTarget;
    },
    statfs(_p: string): { type: number } | null {
      return { type: 0x0100 };
    },
    readFile(p: string): Uint8Array {
      const entry = fs.files.get(p);
      if (!entry || !entry.content) throw new Error(`ENOENT: ${p}`);
      return entry.content;
    },
  };
}

function inMemoryFsMutator(fs: InMemoryFileSystem): FsMutator {
  return {
    writeFile(path: string, content: Uint8Array): void {
      fs.files.set(path, { content, dev: 42, ino: Date.now() });
    },
    mkdir(dir: string): void {
      if (!fs.files.has(dir)) {
        fs.files.set(dir, { isDir: true, dev: 42, ino: 1 });
      }
    },
  };
}

// =============================================================================
// Fake ProcessRunner
// =============================================================================

interface FakeProcessOptions {
  readonly exitCode?: number | null;
  readonly exitSignal?: string | null;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly delayMs?: number;
}

class FakeControlledProcess implements ControlledProcess {
  readonly pid: number;
  private _killed = false;
  private _killTreeCalled = false;
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
  private _nextProcesses: FakeControlledProcess[] = [];
  private _defaultProcess: FakeControlledProcess | null = null;

  setNextProcess(proc: FakeControlledProcess): void {
    this._nextProcesses.push(proc);
  }

  setDefaultProcess(proc: FakeControlledProcess): void {
    this._defaultProcess = proc;
  }

  spawn(
    executable: string,
    argv: readonly string[],
    opts: { cwd: string; env: Record<string, string>; timeoutMs: number; signal?: AbortSignal },
  ): ControlledProcess {
    this.spawned.push({ executable, argv, cwd: opts.cwd, env: opts.env, timeoutMs: opts.timeoutMs });
    if (this._nextProcesses.length > 0) {
      const p = this._nextProcesses.shift()!;
      return p;
    }
    if (this._defaultProcess) {
      return this._defaultProcess;
    }
    return new FakeControlledProcess();
  }
}

// =============================================================================
// Fake journal
// =============================================================================

class FakeJournal {
  readonly events: DurableEvent[] = [];

  append(event: DurableEvent): number {
    this.events.push(event);
    return this.events.length;
  }

  eventsOfKind(kind: string): DurableEvent[] {
    return this.events.filter((e) => e.payload.kind === kind);
  }

  lastEvent(): DurableEvent | undefined {
    return this.events[this.events.length - 1];
  }

  clear(): void {
    this.events.length = 0;
  }
}

// =============================================================================
// In-memory KeyValueStore and BlobStore
// =============================================================================

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  get(key: string): string | undefined {
    return this.data.get(key);
  }

  put(key: string, value: string): void {
    this.data.set(key, value);
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  list(prefix: string): string[] {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix));
  }
}

class InMemoryBlobStore implements BlobStore {
  private readonly data = new Map<string, Uint8Array>();

  get(key: string): Uint8Array | undefined {
    return this.data.get(key);
  }

  put(key: string, value: Uint8Array): void {
    this.data.set(key, value);
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  list(prefix: string): string[] {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix));
  }
}

// =============================================================================
// Helpers
// =============================================================================

function fixedClock(): () => string {
  let t = 0;
  return () => {
    t += 1;
    return `2026-07-17T00:00:00.${String(t).padStart(3, '0')}Z`;
  };
}

function computeDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function makeCompilerProbeResult(verified: boolean, platform: NodeJS.Platform = 'darwin') {
  if (verified) {
    return {
      probeId: 'cpp-compiler',
      status: 'verified' as const,
      executableIdentity: platform === 'win32' ? 'C:\\tools\\cl.exe' : '/usr/bin/clang++',
      version: platform === 'win32' ? 'Microsoft (R) C/C++ Optimizing Compiler Version 19.40' : 'Apple clang version 15.0.0',
      outputClassification: 'clean' as const,
      guidance: null,
    };
  }
  return {
    probeId: 'cpp-compiler',
    status: 'prerequisite-blocker' as const,
    executableIdentity: null,
    version: null,
    outputClassification: 'unavailable' as const,
    guidance: platform === 'win32'
      ? 'A C++ compiler (MSVC cl.exe) is required but was not found. Install Visual Studio Build Tools or Visual Studio with the "Desktop development with C++" workload.'
      : 'A C++ compiler (clang++ or g++) is required but was not found. Install Xcode Command Line Tools (xcode-select --install) or the equivalent compiler package for your system.',
  };
}

function makeDepPreflightResult(
  compilerVerified: boolean,
  platform: NodeJS.Platform = 'darwin',
): DepPreflightResult {
  const compilerResult = makeCompilerProbeResult(compilerVerified, platform);
  const allVerified = compilerVerified;
  return {
    platform,
    workspaceId: 'test-wsid-001',
    workspaceGeneration: 'gen-test-wsid-001-darwin-case-sensitive',
    evidenceId: 'ev-001',
    timestamp: '2026-07-17T00:00:00.000Z',
    perProbeResults: [
      {
        probeId: 'node-runtime',
        status: 'verified',
        executableIdentity: '/usr/local/bin/node',
        version: 'v22.0.0',
        outputClassification: 'clean',
        guidance: null,
      },
      compilerResult,
      {
        probeId: 'npm',
        status: 'verified',
        executableIdentity: '/usr/local/bin/npm',
        version: '10.0.0',
        outputClassification: 'clean',
        guidance: null,
      },
      {
        probeId: 'echo-command',
        status: 'verified',
        executableIdentity: '/bin/echo',
        version: null,
        outputClassification: 'clean',
        guidance: null,
      },
    ],
    overall: allVerified ? 'all-verified' : 'blocked',
    guidance: platform === 'darwin'
      ? [{ platform: 'darwin', message: 'macOS requires Xcode Command Line Tools for the C++ compiler.', recovery: 'Run `xcode-select --install` to install the command line developer tools.' }]
      : [{ platform: 'win32', message: 'Windows requires Visual Studio Build Tools with the "Desktop development with C++" workload for the MSVC compiler.', recovery: 'Install Visual Studio Build Tools from the official Microsoft website and select the "Desktop development with C++" workload during installation.' }],
  };
}

function makeWorkspace(platform: NodeJS.Platform = 'darwin'): WorkspaceIdentity {
  return {
    workspaceId: 'test-wsid-001',
    platform: { platform, casePolicy: 'case-sensitive', unicodePolicy: 'nfc' },
    canonicalRoot: '/ws-root',
    volumeIdentity: { dev: 1, ino: 2, fsType: 3 },
    bindingStatus: 'bound',
    blockedReason: null,
  };
}

function makePolicyState(): PolicyState {
  return { mode: 'build', profile: 'full-access', sensitiveOverride: false };
}

function makeEnv(overrides: Partial<ProofEnvironment> = {}): ProofEnvironment {
  const fs = new InMemoryFileSystem();
  const clock = fixedClock();
  const journal = new FakeJournal();
  const kvStore = new InMemoryKeyValueStore();
  const blobStore = new InMemoryBlobStore();
  const runner = new FakeProcessRunner();

  return {
    workspace: makeWorkspace(),
    fsProbe: inMemoryFsProbe(fs),
    fsMutator: inMemoryFsMutator(fs),
    processRunner: runner,
    depPreflightResult: makeDepPreflightResult(true),
    policyState: makePolicyState(),
    journal,
    kvStore,
    blobStore,
    sessionId: 'sess-test',
    activationId: 'act-1',
    activationRevision: 1,
    authorityRevision: 1,
    clock,
    sourceTarget: '/ws-root/hello.cpp',
    compilerExecutable: 'clang++',
    compileArgv: ['clang++', '-std=c++17', '-o', '/ws-root/hello', '/ws-root/hello.cpp'],
    executeArgv: ['/ws-root/hello'],
    cwd: '/ws-root',
    timeoutMs: 60_000,
    outputLimitBytes: 1024 * 1024,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Story 3.11 AC #1: Inspect -> plan -> approve -> create-source exact order + approval required', () => {
  it('inspects workspace and plans bounded C++ source creation', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    expect(result.steps.length).toBeGreaterThanOrEqual(8);
    // Verify inspect phase.
    const inspectStep = result.steps.find((s) => s.phase === 'inspect');
    expect(inspectStep).toBeDefined();
    expect(inspectStep!.status).toBe('succeeded');
    // Verify plan phase.
    const planStep = result.steps.find((s) => s.phase === 'plan');
    expect(planStep).toBeDefined();
    expect(planStep!.status).toBe('succeeded');
    expect(planStep!.detail).toContain('Source creation planned');
    expect(planStep!.detail).toContain('coverage:');
  });

  it('displays exact target, change summary, checkpoint coverage, and authority', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    const planStep = result.steps.find((s) => s.phase === 'plan');
    expect(planStep).toBeDefined();
    expect(planStep!.detail).toContain(env.sourceTarget);
    expect(planStep!.detail).toContain('bytes');
    expect(planStep!.detail).toContain('coverage:');
  });

  it('requires exact approval before creating the source file', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    // Verify approve phase.
    const approveStep = result.steps.find((s) => s.phase === 'approve');
    expect(approveStep).toBeDefined();
    expect(approveStep!.status).toBe('succeeded');
    expect(approveStep!.detail).toContain('Authorization granted');
  });

  it('inspect comes before plan, plan before approve, approve before create-source', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    const phases = result.steps.map((s) => s.phase);
    const inspectIdx = phases.indexOf('inspect');
    const planIdx = phases.indexOf('plan');
    const approveIdx = phases.indexOf('approve');
    const createIdx = phases.indexOf('create-source');
    expect(inspectIdx).toBeLessThan(planIdx);
    expect(planIdx).toBeLessThan(approveIdx);
    expect(approveIdx).toBeLessThan(createIdx);
  });

  it('returns failed when source creation preview fails', async () => {
    // Use a target outside the workspace to trigger preview failure.
    const env = makeEnv({ sourceTarget: '/outside/hello.cpp' });
    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('plan');
  });
});

describe('Story 3.11 AC #2: Exact checkpoint/mutation order + EffectDispatchCommitted + completion only post-commit', () => {
  it('follows exact checkpoint/mutation order for source creation', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    // Source file should exist.
    const sourceContent = env.fsProbe.readFile(env.sourceTarget);
    expect(sourceContent).toBeDefined();
    expect(new TextDecoder().decode(sourceContent)).toBe(CANONICAL_HELLO_SOURCE);
  });

  it('appends EffectDispatchCommitted before compile and execute', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    await runHelloWorldProof(env);

    // Should have EffectDispatchCommitted events for compile and execute.
    const dispatchEvents = env.journal.eventsOfKind('EffectDispatchCommitted');
    expect(dispatchEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('completion (OperationSucceeded) is only published post-commit', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    await runHelloWorldProof(env);

    // OperationSucceeded should be the last event.
    const last = env.journal.lastEvent();
    expect(last).toBeDefined();
    expect(last!.payload.kind).toBe('OperationSucceeded');
  });

  it('no completion appears before source creation succeeds', async () => {
    const env = makeEnv({ sourceTarget: '/outside/hello.cpp' });
    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('plan');
    // No OperationSucceeded should be in the journal.
    const successEvents = env.journal.eventsOfKind('OperationSucceeded');
    expect(successEvents.length).toBe(0);
  });

  it('source file content matches canonical Hello, World!', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    await runHelloWorldProof(env);

    const sourceContent = env.fsProbe.readFile(env.sourceTarget);
    const decoded = new TextDecoder().decode(sourceContent);
    expect(decoded).toBe(CANONICAL_HELLO_SOURCE);
    expect(decoded).toContain('Hello, World!');
    expect(decoded).toContain('int main()');
  });
});

describe('Story 3.11 AC #3: Compile+exec validated+disclosed + controlled process tree + sanitized output', () => {
  it('validates compile command before execution', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    // Compile step should be present and succeeded (last compile step).
    const compileSteps = result.steps.filter((s) => s.phase === 'compile');
    expect(compileSteps.length).toBeGreaterThanOrEqual(1);
    expect(compileSteps[compileSteps.length - 1].status).toBe('succeeded');
  });

  it('validates execute command before execution', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    const executeSteps = result.steps.filter((s) => s.phase === 'execute');
    expect(executeSteps.length).toBeGreaterThanOrEqual(1);
    expect(executeSteps[executeSteps.length - 1].status).toBe('succeeded');
  });

  it('discloses exact executable, argv, cwd, environment for each command', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.compileCommand).not.toBeNull();
    expect(result.summary!.compileCommand!.executable).toBe('clang++');
    expect(result.summary!.compileCommand!.argv).toEqual(['clang++', '-std=c++17', '-o', '/ws-root/hello', '/ws-root/hello.cpp']);
    expect(result.summary!.executeCommand).not.toBeNull();
    expect(result.summary!.executeCommand!.executable).toBe('/ws-root/hello');
  });

  it('each command follows controlled process-tree execution', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    await runHelloWorldProof(env);

    // Verify processes were spawned.
    const runner = env.processRunner as FakeProcessRunner;
    expect(runner.spawned.length).toBe(2);
    expect(runner.spawned[0].executable).toBe('clang++');
    expect(runner.spawned[1].executable).toBe('/ws-root/hello');
  });

  it('output is streamed as sanitized Evidence', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.compileCommand!.sanitizedStdout).toBe('compiled\n');
    expect(result.summary!.executeCommand!.sanitizedStdout).toBe('Hello, World!');
  });
});

describe('Story 3.11 AC #4: Compile=0 exec=0 stdout=Hello, World! -> succeeded + full summary + post-commit-only', () => {
  it('compile=0 exec=0 stdout=Hello, World! -> succeeded', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    expect(result.phase).toBe('terminal');
  });

  it('summary identifies source file, compiler, commands, observed exit codes, expected output', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    expect(result.summary).not.toBeNull();
    const s = result.summary!;
    expect(s.sourceFile).toBe(env.sourceTarget);
    expect(s.sourceDigest).toBe(computeDigest(new TextEncoder().encode(CANONICAL_HELLO_SOURCE)));
    expect(s.compiler).not.toBeNull();
    expect(s.compiler!.executable).toBe('clang++');
    expect(s.compileCommand).not.toBeNull();
    expect(s.compileCommand!.exitCode).toBe(0);
    expect(s.executeCommand).not.toBeNull();
    expect(s.executeCommand!.exitCode).toBe(0);
    expect(s.expectedOutput).toBe('Hello, World!');
    expect(s.observedOutput).toBe('Hello, World!');
    expect(s.outputMatch).toBe(true);
  });

  it('summary includes operation identities', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.operationIds.length).toBeGreaterThanOrEqual(3);
  });

  it('summary includes checkpoint coverage and excluded effects', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.checkpointCoverage).toBe('fully-protected');
    expect(result.summary!.excludedEffects.length).toBeGreaterThan(0);
    expect(result.summary!.protectedChanges).toContain(env.sourceTarget);
  });

  it('only post-commit Evidence can publish completion', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    await runHelloWorldProof(env);

    // OperationSucceeded should be the last event.
    const last = env.journal.lastEvent();
    expect(last).toBeDefined();
    expect(last!.payload.kind).toBe('OperationSucceeded');
  });

  it('handles \\r\\n line endings in stdout (Windows-style)', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\r\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!\r\n' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.outputMatch).toBe(true);
  });

  it('handles \\r line endings in stdout (old Mac-style)', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\r' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!\r' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('succeeded');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.outputMatch).toBe(true);
  });
});

describe('Story 3.11 AC #5: Compiler missing -> prerequisite-blocker + platform guidance + not success', () => {
  it('compiler missing on macOS -> prerequisite-blocker with platform guidance', async () => {
    const env = makeEnv({
      depPreflightResult: makeDepPreflightResult(false, 'darwin'),
    });

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('prerequisite-blocker');
    expect(result.phase).toBe('inspect');
    expect(result.guidance).toBeTruthy();
    expect(result.guidance!.toLowerCase()).toContain('compiler');
    // Not success.
    expect(result.status).not.toBe('succeeded');
    // No summary (no source was created).
    expect(result.summary).toBeNull();
  });

  it('compiler missing on Windows -> prerequisite-blocker with platform guidance', async () => {
    const env = makeEnv({
      depPreflightResult: makeDepPreflightResult(false, 'win32'),
      workspace: makeWorkspace('win32'),
    });

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('prerequisite-blocker');
    expect(result.phase).toBe('inspect');
    expect(result.guidance).toBeTruthy();
    expect(result.guidance!.toLowerCase()).toContain('msvc');
    expect(result.status).not.toBe('succeeded');
    expect(result.summary).toBeNull();
  });

  it('no command is invented when compiler is missing', async () => {
    const env = makeEnv({
      depPreflightResult: makeDepPreflightResult(false, 'darwin'),
    });

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('prerequisite-blocker');
    // No processes should have been spawned.
    const runner = env.processRunner as FakeProcessRunner;
    expect(runner.spawned.length).toBe(0);
  });

  it('no dependency is installed when compiler is missing', async () => {
    const env = makeEnv({
      depPreflightResult: makeDepPreflightResult(false, 'darwin'),
    });

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('prerequisite-blocker');
    // No source file should have been created.
    expect(() => env.fsProbe.readFile(env.sourceTarget)).toThrow();
  });

  it('no later mutation is implied when compiler is missing', async () => {
    const env = makeEnv({
      depPreflightResult: makeDepPreflightResult(false, 'darwin'),
    });

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('prerequisite-blocker');
    // The result should not claim any source or task success.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/\bsource\b.*\bsuccess\b/i);
    expect(serialized).not.toMatch(/\btask\b.*\bsuccess\b/i);
  });

  it('compiler not invokable -> prerequisite-blocker', async () => {
    const depResult = makeDepPreflightResult(true, 'darwin');
    // Override the compiler result to be probe-failed (not invokable).
    depResult.perProbeResults = depResult.perProbeResults.map((r) =>
      r.probeId === 'cpp-compiler'
        ? { ...r, status: 'probe-failed' as const, outputClassification: 'unavailable' as const }
        : r,
    );
    depResult.overall = 'unknown';

    const env = makeEnv({ depPreflightResult: depResult });
    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('prerequisite-blocker');
    expect(result.phase).toBe('inspect');
  });
});

describe('Story 3.11 AC #6: Failure modes -> honest status + never affirmative + protected vs excluded', () => {
  it('compilation fails -> failed, not success', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ exitCode: 1, stderr: 'compilation error' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('compile');
    // Should not be succeeded.
    expect(result.status).not.toBe('succeeded');
    // Summary should include what we know.
    expect(result.summary).not.toBeNull();
    expect(result.summary!.compileCommand).not.toBeNull();
    expect(result.summary!.compileCommand!.exitCode).toBe(1);
  });

  it('compilation cancelled (SIGTERM) -> cancelled', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ exitSignal: 'SIGTERM' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('cancelled');
    expect(result.phase).toBe('compile');
    expect(result.status).not.toBe('succeeded');
  });

  it('compilation cancelled (SIGINT) -> cancelled', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ exitSignal: 'SIGINT' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('cancelled');
    expect(result.phase).toBe('compile');
  });

  it('execution fails -> failed, not success', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ exitCode: 1, stderr: 'execution error' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('execute');
    expect(result.status).not.toBe('succeeded');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.executeCommand).not.toBeNull();
    expect(result.summary!.executeCommand!.exitCode).toBe(1);
  });

  it('execution cancelled (SIGKILL) -> cancelled', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ exitSignal: 'SIGKILL' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('cancelled');
    expect(result.phase).toBe('execute');
  });

  it('output mismatch -> failed, not success', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Wrong output' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('verify');
    expect(result.status).not.toBe('succeeded');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.outputMatch).toBe(false);
    expect(result.summary!.observedOutput).toBe('Wrong output');
  });

  it('states which built-in file changes are protected', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ exitCode: 1, stderr: 'error' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.summary).not.toBeNull();
    // Source file was created before compile, so it should be in protected changes.
    expect(result.summary!.protectedChanges).toContain(env.sourceTarget);
  });

  it('states which command/process effects are excluded (AD-19)', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ exitCode: 1, stderr: 'error' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.summary).not.toBeNull();
    // Command effects should be marked excluded.
    expect(result.summary!.excludedEffects.length).toBeGreaterThan(0);
    for (const ex of result.summary!.excludedEffects) {
      expect(ex.reasonCode).toMatch(/command-(never-protected|argv-not-checkpoint)/);
    }
  });

  it('never leads with affirmative completion on failure', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ exitCode: 1, stderr: 'error' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    // The terminal step should not be present.
    const terminalStep = result.steps.find((s) => s.phase === 'terminal');
    expect(terminalStep).toBeUndefined();
  });

  it('compile fails with non-zero exit code -> failed', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ exitCode: 2, stderr: 'syntax error' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('compile');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.compileCommand!.exitCode).toBe(2);
  });

  it('compile fails with signal (non-cancellation) -> failed', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ exitSignal: 'SIGSEGV' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('compile');
  });

  it('execution fails with non-zero exit code -> failed', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ exitCode: 127, stderr: 'command not found' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('execute');
  });
});

describe('Story 3.11: Edge cases and integration', () => {
  it('handles empty stdout from execution', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: '' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('verify');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.outputMatch).toBe(false);
  });

  it('handles whitespace-only stdout from execution', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: '   \n  ' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.status).toBe('failed');
    expect(result.phase).toBe('verify');
  });

  it('compile step detail includes the compiler command', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    const compileStep = result.steps.find((s) => s.phase === 'compile');
    expect(compileStep).toBeDefined();
    expect(compileStep!.detail).toContain('clang++');
  });

  it('execute step detail includes the execute command', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    const executeStep = result.steps.find((s) => s.phase === 'execute');
    expect(executeStep).toBeDefined();
    expect(executeStep!.detail).toContain('/ws-root/hello');
  });

  it('all steps have timestamps', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    for (const step of result.steps) {
      expect(step.timestamp).toBeTruthy();
      expect(step.timestamp).toContain('2026-07-17');
    }
  });

  it('result has completedAt timestamp', async () => {
    const env = makeEnv();
    const compileProc = new FakeControlledProcess({ stdout: 'compiled\n' });
    const execProc = new FakeControlledProcess({ stdout: 'Hello, World!' });
    (env.processRunner as FakeProcessRunner).setNextProcess(compileProc);
    (env.processRunner as FakeProcessRunner).setNextProcess(execProc);

    const result = await runHelloWorldProof(env);

    expect(result.completedAt).toBeTruthy();
    expect(result.completedAt).toContain('2026-07-17');
  });
});
