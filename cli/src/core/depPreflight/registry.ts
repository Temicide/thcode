// Maintained, versioned registry of approved prerequisite probes (Story 3.8,
// AD-15, ADR 0011). Each probe is a pure function over an injectable
// EnvironmentProbe port — tests use fakes; never run real compilers.
//
// Probes record platform, version, executable identity, probe output
// classification, and evidence WITHOUT installing or modifying anything.
// Model-supplied capabilities, installers, URLs, or commands are NEVER registry
// authority (AD-14, AD-15).
//
// Platform-specific guidance is sourced from the maintained registry or
// verified project documentation ONLY — never invented URLs or installers.

import type {
  EnvironmentProbe,
  PrerequisiteCategory,
  PrerequisiteProbe,
  PrerequisiteProbeResult,
  PrerequisiteGuidance,
} from './types.js';

// --- Registry version ---

export const DEP_PREFLIGHT_REGISTRY_VERSION = 1;

// --- Probe result helpers ---

function verified(
  probeId: string,
  executableIdentity: string | null,
  version: string | null,
): PrerequisiteProbeResult {
  return {
    probeId,
    status: 'verified',
    executableIdentity,
    version,
    outputClassification: 'clean',
    guidance: null,
  };
}

function blocker(
  probeId: string,
  guidance: string,
): PrerequisiteProbeResult {
  return {
    probeId,
    status: 'prerequisite-blocker',
    executableIdentity: null,
    version: null,
    outputClassification: 'unavailable',
    guidance,
  };
}

function probeFailed(probeId: string): PrerequisiteProbeResult {
  return {
    probeId,
    status: 'probe-failed',
    executableIdentity: null,
    version: null,
    outputClassification: 'unavailable',
    guidance: null,
  };
}

// --- Individual probe definitions ---

/** Probe: Node.js runtime is present and invokable. */
const nodeRuntimeProbe: PrerequisiteProbe = {
  id: 'node-runtime',
  displayName: 'Node.js Runtime',
  category: 'runtime' as PrerequisiteCategory,
  platform: 'any',
  probe(env: EnvironmentProbe): PrerequisiteProbeResult {
    const nodePath = env.findExecutable('node');
    if (nodePath === null) {
      return blocker('node-runtime', 'Node.js is not found in PATH. Install Node.js 22 or later (Node.js 24 LTS is the clean-machine baseline).');
    }
    if (!env.isInvokable(nodePath)) {
      return blocker('node-runtime', 'Node.js is found but cannot be invoked. Check file permissions and PATH.');
    }
    const version = env.getVersion(nodePath);
    if (version === null) {
      return probeFailed('node-runtime');
    }
    return verified('node-runtime', nodePath, version);
  },
};

/** Probe: C++ compiler required by the canonical proof.
 * On macOS: clang++ (preferred) or g++.
 * On Windows: cl.exe (MSVC).
 * On other platforms: not applicable (blocked by startup preflight). */
const cppCompilerProbe: PrerequisiteProbe = {
  id: 'cpp-compiler',
  displayName: 'C++ Compiler',
  category: 'compiler' as PrerequisiteCategory,
  platform: 'any',
  probe(env: EnvironmentProbe): PrerequisiteProbeResult {
    const candidates = env.platform === 'win32'
      ? ['cl.exe', 'cl']
      : ['clang++', 'g++'];

    for (const name of candidates) {
      const exePath = env.findExecutable(name);
      if (exePath !== null && env.isInvokable(exePath)) {
        const version = env.getVersion(exePath);
        return verified('cpp-compiler', exePath, version);
      }
    }

    // No supported compiler found — provide platform-specific guidance.
    const guidance = env.platform === 'win32'
      ? 'A C++ compiler (MSVC cl.exe) is required but was not found. Install Visual Studio Build Tools or Visual Studio with the "Desktop development with C++" workload.'
      : 'A C++ compiler (clang++ or g++) is required but was not found. Install Xcode Command Line Tools (xcode-select --install) or the equivalent compiler package for your system.';
    return blocker('cpp-compiler', guidance);
  },
};

/** Probe: npm package manager. */
const npmProbe: PrerequisiteProbe = {
  id: 'npm',
  displayName: 'npm',
  category: 'package-manager' as PrerequisiteCategory,
  platform: 'any',
  probe(env: EnvironmentProbe): PrerequisiteProbeResult {
    const npmPath = env.findExecutable('npm');
    if (npmPath === null) {
      return blocker('npm', 'npm is not found in PATH. npm is typically installed with Node.js — reinstall Node.js if missing.');
    }
    if (!env.isInvokable(npmPath)) {
      return blocker('npm', 'npm is found but cannot be invoked. Check file permissions and PATH.');
    }
    const version = env.getVersion(npmPath);
    if (version === null) {
      return probeFailed('npm');
    }
    return verified('npm', npmPath, version);
  },
};

/** Probe: documented command `echo` (required by the canonical proof). */
const echoCommandProbe: PrerequisiteProbe = {
  id: 'echo-command',
  displayName: 'echo',
  category: 'documented-command' as PrerequisiteCategory,
  platform: 'any',
  probe(env: EnvironmentProbe): PrerequisiteProbeResult {
    const candidates = env.platform === 'win32'
      ? ['echo.exe', 'echo.cmd']
      : ['echo'];

    for (const name of candidates) {
      const exePath = env.findExecutable(name);
      if (exePath !== null && env.isInvokable(exePath)) {
        return verified('echo-command', exePath, null);
      }
    }
    return blocker('echo-command', 'The echo command is required but was not found. This is unusual — check your system PATH.');
  },
};

// --- The full registry ---

/** All approved prerequisite probes. Adding a probe is a deliberate, reviewed
 * change to this array — never an ad-hoc probe at the call site (AD-15). */
export const APPROVED_PROBES: readonly PrerequisiteProbe[] = Object.freeze([
  nodeRuntimeProbe,
  cppCompilerProbe,
  npmProbe,
  echoCommandProbe,
]);

// --- Platform-specific guidance registry ---

/** Maintained guidance for prerequisite blockers, keyed by platform. Guidance
 * is sourced from the maintained registry or verified project documentation
 * ONLY — never invented URLs or installers (AD-14, AD-15). */
export const PLATFORM_GUIDANCE: readonly PrerequisiteGuidance[] = Object.freeze([
  {
    platform: 'darwin',
    message: 'macOS requires Xcode Command Line Tools for the C++ compiler.',
    recovery: 'Run `xcode-select --install` to install the command line developer tools.',
  },
  {
    platform: 'win32',
    message: 'Windows requires Visual Studio Build Tools with the "Desktop development with C++" workload for the MSVC compiler.',
    recovery: 'Install Visual Studio Build Tools from the official Microsoft website and select the "Desktop development with C++" workload during installation.',
  },
]);

/** Look up platform-specific guidance for a given platform. */
export function guidanceForPlatform(platform: NodeJS.Platform): PrerequisiteGuidance | undefined {
  return PLATFORM_GUIDANCE.find((g) => g.platform === platform);
}

/** Run all approved probes for the given platform and return results. */
export function runApprovedProbes(
  env: EnvironmentProbe,
): PrerequisiteProbeResult[] {
  const results: PrerequisiteProbeResult[] = [];
  for (const probe of APPROVED_PROBES) {
    if (probe.platform !== 'any' && probe.platform !== env.platform) {
      // Skip probes that don't apply to this platform.
      continue;
    }
    try {
      results.push(probe.probe(env));
    } catch {
      results.push(probeFailed(probe.id));
    }
  }
  return results;
}

/** Compute the overall status from per-probe results. */
export function computeOverall(
  results: readonly PrerequisiteProbeResult[],
): 'all-verified' | 'blocked' | 'unknown' {
  let hasBlocker = false;
  let hasUnknown = false;
  for (const r of results) {
    if (r.status === 'prerequisite-blocker' || r.status === 'incompatible') {
      hasBlocker = true;
    }
    if (r.status === 'probe-failed') {
      hasUnknown = true;
    }
  }
  if (hasBlocker) return 'blocked';
  if (hasUnknown) return 'unknown';
  return 'all-verified';
}
