// Dependency preflight runner (Story 3.8, AD-9, AD-15, AD-24, AD-28). Inspects
// bounded project metadata + verified documentation, probes ONLY approved
// runtimes/compilers/package-managers/documented commands. Never installs or
// modifies anything. Every run produces a FRESH Evidence identity (AC #4).
//
// Pure/injectable: accepts an EnvironmentProbe port and clock so tests use
// fakes and never run real compilers or touch the real process environment.
//
// (AD-14, AD-15) — platform-specific guidance is sourced from the maintained
// registry or verified project documentation ONLY. Never invented URLs,
// installers, or commands.

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { WorkspaceIdentity } from '../workspace/types.js';
import type {
  DepPreflightResult,
  EnvironmentProbe,
} from './types.js';
import {
  computeOverall,
  guidanceForPlatform,
  runApprovedProbes,
} from './registry.js';

/** Default EnvironmentProbe using real child_process (for production use).
 * Never installs or modifies anything — only reads version strings and checks
 * invokability. */
export function defaultEnvironmentProbe(): EnvironmentProbe {
  return {
    platform: process.platform,
    findExecutable(name: string): string | null {
      try {
        const cmd = process.platform === 'win32' ? 'where' : 'which';
        const result = execFileSync(cmd, [name], {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        const path = result.split('\n')[0]?.trim() ?? '';
        return path.length > 0 ? path : null;
      } catch {
        return null;
      }
    },
    getVersion(executablePath: string): string | null {
      try {
        const result = execFileSync(executablePath, ['--version'], {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        const firstLine = result.split('\n')[0]?.trim() ?? '';
        return firstLine.length > 0 ? firstLine : null;
      } catch {
        return null;
      }
    },
    isInvokable(executablePath: string): boolean {
      try {
        execFileSync(executablePath, ['--version'], {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Compute a stable workspace generation string from the WorkspaceIdentity. */
function workspaceGeneration(workspace: WorkspaceIdentity): string {
  return `gen-${workspace.workspaceId}-${workspace.platform.platform}-${workspace.platform.casePolicy}`;
}

/** Run a full dependency preflight (Story 3.8).
 *
 * Inspects bounded project metadata + verified documentation, probes ONLY
 * approved runtimes/compilers/package-managers/documented commands, and records
 * platform, version, executable identity, probe output classification, and
 * evidence WITHOUT installing or modifying anything.
 *
 * AC #2: C++ compiler present+invokable → records compiler identity/version
 * and a `verified` prerequisite result tied to the current platform/Workspace
 * generation; does NOT claim source or task success yet.
 *
 * AC #3: no supported compiler found / invocation inaccessible / incompatible →
 * `prerequisite-blocker` with platform-specific guidance from the maintained
 * registry or verified project documentation; does NOT blame source code, invent
 * URLs, run privileged installers, or silently install dependencies.
 *
 * AC #4: each call produces a FRESH explicit probe with a NEW Evidence identity;
 * does not reuse a stale success; unknown probe results remain `probe-failed` or
 * `incompatible`.
 *
 * AC #5: remains read-only regardless of mode/profile/TTY; cannot be converted
 * into mutation authorization; emits canonical narrow/headless result without
 * an interactive gate.
 */
export function runDependencyPreflight(
  workspace: WorkspaceIdentity,
  env: EnvironmentProbe,
  clock: () => string,
): DepPreflightResult {
  // AC #4: fresh Evidence identity per run.
  const evidenceId = randomUUID();

  // Run all approved probes for the current platform.
  const perProbeResults = runApprovedProbes(env);

  // Compute overall status.
  const overall = computeOverall(perProbeResults);

  // Collect platform-specific guidance for blockers.
  const platformGuidance = guidanceForPlatform(env.platform);
  const guidance: DepPreflightResult['guidance'] = platformGuidance
    ? [platformGuidance]
    : [];

  return {
    platform: env.platform,
    workspaceId: workspace.workspaceId,
    workspaceGeneration: workspaceGeneration(workspace),
    evidenceId,
    timestamp: clock(),
    perProbeResults,
    overall,
    guidance,
  };
}
