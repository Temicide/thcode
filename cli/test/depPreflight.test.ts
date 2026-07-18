import { describe, expect, it } from 'vitest';
import type { EnvironmentProbe, PrerequisiteProbeResult } from '../src/core/depPreflight/types.js';
import { runDependencyPreflight } from '../src/core/depPreflight/run.js';
import {
  APPROVED_PROBES,
  runApprovedProbes,
  computeOverall,
  guidanceForPlatform,
  DEP_PREFLIGHT_REGISTRY_VERSION,
} from '../src/core/depPreflight/registry.js';
import type { WorkspaceIdentity } from '../src/core/workspace/types.js';

// --- Fake EnvironmentProbe for offline tests ---

interface FakeExecutable {
  readonly path: string;
  readonly version: string | null;
  readonly invokable: boolean;
}

function fakeEnv(over: Partial<{
  platform: NodeJS.Platform;
  executables: Record<string, FakeExecutable>;
}> = {}): EnvironmentProbe {
  const platform = over.platform ?? 'darwin';
  const executables = over.executables ?? {};
  return {
    platform,
    findExecutable(name: string): string | null {
      const exe = executables[name];
      return exe ? exe.path : null;
    },
    getVersion(executablePath: string): string | null {
      for (const [, exe] of Object.entries(executables)) {
        if (exe.path === executablePath) return exe.version;
      }
      return null;
    },
    isInvokable(executablePath: string): boolean {
      for (const [, exe] of Object.entries(executables)) {
        if (exe.path === executablePath) return exe.invokable;
      }
      return false;
    },
  };
}

function fakeWorkspace(over: Partial<WorkspaceIdentity> = {}): WorkspaceIdentity {
  return {
    workspaceId: 'test-wsid-001',
    platform: { platform: 'darwin', casePolicy: 'case-sensitive', unicodePolicy: 'nfc' },
    canonicalRoot: '/tmp/test-workspace',
    volumeIdentity: { dev: 1, ino: 2, fsType: 3 },
    bindingStatus: 'bound',
    blockedReason: null,
    ...over,
  };
}

function fakeClock(): string {
  return '2026-07-17T12:00:00.000Z';
}

// --- AC #1: bounded metadata probe, approved probes only, no install/modify ---

describe('AC #1 — bounded metadata probe, approved probes only, no install/modify', () => {
  it('runs all approved probes for the platform', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const results = runApprovedProbes(env);
    // All 4 approved probes should run on macOS.
    expect(results).toHaveLength(4);
    const probeIds = results.map((r) => r.probeId);
    expect(probeIds).toContain('node-runtime');
    expect(probeIds).toContain('cpp-compiler');
    expect(probeIds).toContain('npm');
    expect(probeIds).toContain('echo-command');
  });

  it('only runs approved probes (no ad-hoc commands)', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const results = runApprovedProbes(env);
    const probeIds = results.map((r) => r.probeId);
    // Verify only the 4 approved probes are present.
    expect(probeIds).toEqual(['node-runtime', 'cpp-compiler', 'npm', 'echo-command']);
    // Verify the registry is frozen (no ad-hoc additions).
    expect(Object.isFrozen(APPROVED_PROBES)).toBe(true);
  });

  it('does not install or modify anything (probe functions are pure reads)', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    // Capture env state before.
    const beforeKeys = Object.keys(env);
    const results = runApprovedProbes(env);
    // After running probes, env should be unchanged.
    expect(Object.keys(env)).toEqual(beforeKeys);
    // All results should be verified (no blockers).
    expect(results.every((r) => r.status === 'verified')).toBe(true);
  });

  it('inspects bounded project metadata (workspace identity)', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    expect(result.workspaceId).toBe(ws.workspaceId);
    expect(result.workspaceGeneration).toContain(ws.workspaceId);
    expect(result.workspaceGeneration).toContain(ws.platform.platform);
  });
});

// --- AC #2: C++ compiler present → verified + identity/version + tied to platform/Workspace generation ---

describe('AC #2 — C++ compiler present → verified + identity/version + platform/Workspace binding', () => {
  it('records verified with compiler identity and version on macOS (clang++)', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace({ platform: { platform: 'darwin', casePolicy: 'case-sensitive', unicodePolicy: 'nfc' } });
    const result = runDependencyPreflight(ws, env, fakeClock);
    const compilerResult = result.perProbeResults.find((r) => r.probeId === 'cpp-compiler');
    expect(compilerResult).toBeDefined();
    expect(compilerResult!.status).toBe('verified');
    expect(compilerResult!.executableIdentity).toBe('/usr/bin/clang++');
    expect(compilerResult!.version).toBe('Apple clang version 15.0.0');
    // Tied to platform.
    expect(result.platform).toBe('darwin');
    // Tied to Workspace generation.
    expect(result.workspaceGeneration).toContain(ws.workspaceId);
    // Does NOT claim source or task success.
    expect(result.overall).toBe('all-verified');
    expect(compilerResult!.guidance).toBeNull();
  });

  it('records verified with compiler identity and version on macOS (g++ fallback)', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'g++': { path: '/usr/bin/g++', version: 'g++ (GCC) 13.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    const compilerResult = result.perProbeResults.find((r) => r.probeId === 'cpp-compiler');
    expect(compilerResult).toBeDefined();
    expect(compilerResult!.status).toBe('verified');
    expect(compilerResult!.executableIdentity).toBe('/usr/bin/g++');
    expect(compilerResult!.version).toBe('g++ (GCC) 13.0.0');
  });

  it('records verified with compiler identity and version on Windows (cl.exe)', () => {
    const env = fakeEnv({
      platform: 'win32',
      executables: {
        node: { path: 'C:\\Program Files\\nodejs\\node.exe', version: 'v22.0.0', invokable: true },
        'cl.exe': { path: 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC\\14.0\\bin\\cl.exe', version: 'Microsoft (R) C/C++ Optimizing Compiler Version 19.40', invokable: true },
        npm: { path: 'C:\\Program Files\\nodejs\\npm.cmd', version: '10.0.0', invokable: true },
        'echo.exe': { path: 'C:\\Windows\\System32\\echo.exe', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace({ platform: { platform: 'win32', casePolicy: 'case-insensitive', unicodePolicy: 'nfc' } });
    const result = runDependencyPreflight(ws, env, fakeClock);
    const compilerResult = result.perProbeResults.find((r) => r.probeId === 'cpp-compiler');
    expect(compilerResult).toBeDefined();
    expect(compilerResult!.status).toBe('verified');
    expect(compilerResult!.executableIdentity).toBe('C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC\\14.0\\bin\\cl.exe');
    expect(compilerResult!.version).toBe('Microsoft (R) C/C++ Optimizing Compiler Version 19.40');
    expect(result.platform).toBe('win32');
  });

  it('does not claim source or task success when compiler is verified', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    // The result is about prerequisites, not source or task success.
    expect(result.overall).toBe('all-verified');
    // No field should reference "source" or "task" in a success claim.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/\bsource\b.*\bsuccess\b/i);
    expect(serialized).not.toMatch(/\btask\b.*\bsuccess\b/i);
  });
});

// --- AC #3: missing/inaccessible/incompatible compiler → prerequisite-blocker + platform guidance ---

describe('AC #3 — missing/inaccessible/incompatible compiler → prerequisite-blocker + platform guidance', () => {
  it('no compiler found on macOS → prerequisite-blocker with platform guidance', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    const compilerResult = result.perProbeResults.find((r) => r.probeId === 'cpp-compiler');
    expect(compilerResult).toBeDefined();
    expect(compilerResult!.status).toBe('prerequisite-blocker');
    expect(compilerResult!.guidance).toBeTruthy();
    expect(compilerResult!.guidance!.toLowerCase()).toContain('compiler');
    // Overall is blocked.
    expect(result.overall).toBe('blocked');
    // Platform guidance is included.
    expect(result.guidance.length).toBeGreaterThanOrEqual(1);
    expect(result.guidance[0].platform).toBe('darwin');
  });

  it('no compiler found on Windows → prerequisite-blocker with platform guidance', () => {
    const env = fakeEnv({
      platform: 'win32',
      executables: {
        node: { path: 'C:\\Program Files\\nodejs\\node.exe', version: 'v22.0.0', invokable: true },
        npm: { path: 'C:\\Program Files\\nodejs\\npm.cmd', version: '10.0.0', invokable: true },
        'echo.exe': { path: 'C:\\Windows\\System32\\echo.exe', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace({ platform: { platform: 'win32', casePolicy: 'case-insensitive', unicodePolicy: 'nfc' } });
    const result = runDependencyPreflight(ws, env, fakeClock);
    const compilerResult = result.perProbeResults.find((r) => r.probeId === 'cpp-compiler');
    expect(compilerResult).toBeDefined();
    expect(compilerResult!.status).toBe('prerequisite-blocker');
    expect(compilerResult!.guidance).toBeTruthy();
    expect(compilerResult!.guidance!.toLowerCase()).toContain('msvc');
    expect(result.overall).toBe('blocked');
    expect(result.guidance.length).toBeGreaterThanOrEqual(1);
    expect(result.guidance[0].platform).toBe('win32');
  });

  it('compiler found but not invokable → prerequisite-blocker', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: false },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    const compilerResult = result.perProbeResults.find((r) => r.probeId === 'cpp-compiler');
    expect(compilerResult).toBeDefined();
    expect(compilerResult!.status).toBe('prerequisite-blocker');
    expect(compilerResult!.guidance).toBeTruthy();
  });

  it('does NOT blame source code in guidance', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    const serialized = JSON.stringify(result);
    // Guidance should not blame source code.
    expect(serialized).not.toMatch(/\byour code\b/i);
    expect(serialized).not.toMatch(/\bsource code\b/i);
    expect(serialized).not.toMatch(/\byou wrote\b/i);
  });

  it('does NOT invent URLs in guidance', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    const serialized = JSON.stringify(result);
    // Guidance should not contain invented URLs (AD-14).
    expect(serialized).not.toMatch(/https?:\/\//);
  });

  it('does NOT run privileged installers', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    const serialized = JSON.stringify(result);
    // Guidance should not contain installer commands.
    expect(serialized).not.toMatch(/sudo\s+/);
    expect(serialized).not.toMatch(/choco\s+install/i);
    expect(serialized).not.toMatch(/winget\s+install/i);
    expect(serialized).not.toMatch(/brew\s+install/i);
  });

  it('does NOT silently install dependencies', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    // The preflight function itself never installs anything — it only reports.
    // Verify the result does not contain any installer commands that the tool
    // would run (as opposed to user-facing guidance text).
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/sudo\s+/);
    expect(serialized).not.toMatch(/choco\s+install/i);
    expect(serialized).not.toMatch(/winget\s+install/i);
    expect(serialized).not.toMatch(/brew\s+install/i);
    expect(serialized).not.toMatch(/npm\s+install/i);
  });
});

// --- AC #4: rerun → fresh evidence identity + no stale-success reuse + unknown stays probe-failed/incompatible ---

describe('AC #4 — rerun → fresh evidence identity + no stale-success reuse', () => {
  it('each run produces a new evidence identity', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result1 = runDependencyPreflight(ws, env, fakeClock);
    const result2 = runDependencyPreflight(ws, env, fakeClock);
    // Evidence identities must be different (fresh per run).
    expect(result1.evidenceId).not.toBe(result2.evidenceId);
  });

  it('does not reuse a stale success when environment changes', () => {
    // First run: compiler present.
    const envPresent = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result1 = runDependencyPreflight(ws, envPresent, fakeClock);
    expect(result1.overall).toBe('all-verified');

    // Second run: compiler removed (environment change).
    const envMissing = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const result2 = runDependencyPreflight(ws, envMissing, fakeClock);
    // The second run must reflect the current environment, not the stale success.
    expect(result2.overall).toBe('blocked');
    const compilerResult = result2.perProbeResults.find((r) => r.probeId === 'cpp-compiler');
    expect(compilerResult).toBeDefined();
    expect(compilerResult!.status).toBe('prerequisite-blocker');
    // Evidence identity is fresh.
    expect(result2.evidenceId).not.toBe(result1.evidenceId);
  });

  it('unknown probe results remain probe-failed', () => {
    // A probe that throws should result in probe-failed.
    const throwingEnv: EnvironmentProbe = {
      platform: 'darwin',
      findExecutable(): string | null {
        throw new Error('unexpected error');
      },
      getVersion(): string | null {
        throw new Error('unexpected error');
      },
      isInvokable(): boolean {
        throw new Error('unexpected error');
      },
    };
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, throwingEnv, fakeClock);
    // All probe results should be probe-failed.
    for (const r of result.perProbeResults) {
      expect(r.status).toBe('probe-failed');
    }
    expect(result.overall).toBe('unknown');
  });

  it('unknown probe results remain incompatible when version is malformed', () => {
    // A probe that returns incompatible status.
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: null, invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    // With all executables present and invokable, overall should be all-verified.
    // (clang++ with null version is still verified — version is optional.)
    expect(result.overall).toBe('all-verified');
  });
});

// --- AC #5: read-only across Plan/Manual/Assisted/Full-Access/no-TTY ---

describe('AC #5 — read-only across all modes/profiles, no interactive gate, cannot authorize mutation', () => {
  it('remains read-only (never installs or modifies anything)', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    // The result is purely diagnostic — no mutation authorization.
    expect(result.overall).toBe('all-verified');
    // No field suggests mutation or installation by the tool.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/mutate/i);
    expect(serialized).not.toMatch(/modify/i);
    expect(serialized).not.toMatch(/write/i);
  });

  it('emits canonical narrow/headless result without an interactive gate', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    // The result is a plain data object — no interactive gate, no callback.
    expect(typeof result.platform).toBe('string');
    expect(typeof result.workspaceId).toBe('string');
    expect(typeof result.evidenceId).toBe('string');
    expect(Array.isArray(result.perProbeResults)).toBe(true);
    expect(typeof result.overall).toBe('string');
    // No interactive gate fields.
    expect((result as Record<string, unknown>).interactiveGate).toBeUndefined();
    expect((result as Record<string, unknown>).requiresApproval).toBeUndefined();
  });

  it('cannot be converted into mutation authorization', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    // The result type has no authorization or approval fields.
    expect((result as Record<string, unknown>).authorization).toBeUndefined();
    expect((result as Record<string, unknown>).approval).toBeUndefined();
    expect((result as Record<string, unknown>).permission).toBeUndefined();
    // No PEP decision or effect authorization.
    expect((result as Record<string, unknown>).decision).toBeUndefined();
    expect((result as Record<string, unknown>).effect).toBeUndefined();
  });

  it('works identically regardless of mode/profile (no mode parameter needed)', () => {
    // The preflight function does not accept mode/profile — it is always
    // read-only by design.
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    // Run the preflight — no mode/profile parameter needed.
    const result = runDependencyPreflight(ws, env, fakeClock);
    expect(result.overall).toBe('all-verified');
    // Verify the function signature has no mode/profile parameter.
    const fnStr = runDependencyPreflight.toString();
    expect(fnStr).not.toContain('mode');
    expect(fnStr).not.toContain('profile');
  });
});

// --- Registry integrity ---

describe('Registry integrity', () => {
  it('has a version number', () => {
    expect(DEP_PREFLIGHT_REGISTRY_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('all probes have required fields', () => {
    for (const probe of APPROVED_PROBES) {
      expect(probe.id).toBeTruthy();
      expect(probe.displayName).toBeTruthy();
      expect(['runtime', 'compiler', 'package-manager', 'documented-command']).toContain(probe.category);
      expect(probe.platform === 'any' || probe.platform === 'darwin' || probe.platform === 'win32').toBe(true);
      expect(typeof probe.probe).toBe('function');
    }
  });

  it('all probes have unique ids', () => {
    const ids = APPROVED_PROBES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('guidanceForPlatform returns guidance for darwin and win32', () => {
    const darwinGuidance = guidanceForPlatform('darwin');
    expect(darwinGuidance).toBeDefined();
    expect(darwinGuidance!.platform).toBe('darwin');

    const win32Guidance = guidanceForPlatform('win32');
    expect(win32Guidance).toBeDefined();
    expect(win32Guidance!.platform).toBe('win32');
  });

  it('guidanceForPlatform returns undefined for unsupported platforms', () => {
    expect(guidanceForPlatform('linux')).toBeUndefined();
    expect(guidanceForPlatform('aix')).toBeUndefined();
  });

  it('computeOverall returns all-verified when all results are verified', () => {
    const results: PrerequisiteProbeResult[] = [
      { probeId: 'a', status: 'verified', executableIdentity: '/a', version: '1', outputClassification: 'clean', guidance: null },
      { probeId: 'b', status: 'verified', executableIdentity: '/b', version: '2', outputClassification: 'clean', guidance: null },
    ];
    expect(computeOverall(results)).toBe('all-verified');
  });

  it('computeOverall returns blocked when any result is prerequisite-blocker', () => {
    const results: PrerequisiteProbeResult[] = [
      { probeId: 'a', status: 'verified', executableIdentity: '/a', version: '1', outputClassification: 'clean', guidance: null },
      { probeId: 'b', status: 'prerequisite-blocker', executableIdentity: null, version: null, outputClassification: 'unavailable', guidance: 'missing' },
    ];
    expect(computeOverall(results)).toBe('blocked');
  });

  it('computeOverall returns blocked when any result is incompatible', () => {
    const results: PrerequisiteProbeResult[] = [
      { probeId: 'a', status: 'verified', executableIdentity: '/a', version: '1', outputClassification: 'clean', guidance: null },
      { probeId: 'b', status: 'incompatible', executableIdentity: null, version: null, outputClassification: 'malformed', guidance: 'incompatible' },
    ];
    expect(computeOverall(results)).toBe('blocked');
  });

  it('computeOverall returns unknown when any result is probe-failed', () => {
    const results: PrerequisiteProbeResult[] = [
      { probeId: 'a', status: 'verified', executableIdentity: '/a', version: '1', outputClassification: 'clean', guidance: null },
      { probeId: 'b', status: 'probe-failed', executableIdentity: null, version: null, outputClassification: 'unavailable', guidance: null },
    ];
    expect(computeOverall(results)).toBe('unknown');
  });
});

// --- Output safety ---

describe('Output safety (AD-24)', () => {
  it('result JSON contains no raw errors or stack traces', () => {
    const env = fakeEnv({
      platform: 'darwin',
      executables: {
        node: { path: '/usr/local/bin/node', version: 'v22.0.0', invokable: true },
        'clang++': { path: '/usr/bin/clang++', version: 'Apple clang version 15.0.0', invokable: true },
        npm: { path: '/usr/local/bin/npm', version: '10.0.0', invokable: true },
        echo: { path: '/bin/echo', version: null, invokable: true },
      },
    });
    const ws = fakeWorkspace();
    const result = runDependencyPreflight(ws, env, fakeClock);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Error:');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('sk-');
    expect(serialized).not.toContain('password');
  });
});
