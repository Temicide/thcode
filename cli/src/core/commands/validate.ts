// Controlled command validation (Story 3.7 AC #1, AC #2, AD-4, AD-12, AD-13,
// AD-24, AD-27). Resolves approved executable identity, validates explicit argv
// vector (reuses commandGrammar SHELL_METACHARACTER_RE), Workspace-contained cwd,
// allowed environment names/values, shell/startup-hook policy, timeout, output
// limits, and action digest. Rejects shell expansion, command substitution,
// implicit current-directory rebinding, unsafe environment inheritance, and
// host-threatening commands (AC #1). Returns denied/refused/enforcement-unverified
// for unsupported shell/platform, out-of-Workspace resource, privileged/system
// mutation, network boundary, or unavailable process enforcement (AC #2).
//
// Pure and side-effect free (no fs/network/journal) so it stays trivially
// unit-testable.

import { createHash } from 'node:crypto';
import { resolveWithinWorkspace } from '../tools/workspace.js';
import type {
  CommandProposal,
  CommandValidationResult,
  ValidationContext,
} from './types.js';

// Reuse the shell metacharacter regex from commandGrammar.ts (Story 2.13).
// Rejects: $, `, *, ?, ;, |, <, >, &, \, $(), and bare `sh -c`.
const SHELL_METACHARACTER_RE = /[$`*?;|<>&]|\\\n|\$\(|\bsh\b\s+-c/i;

// --- Default allowed executables ---

const DEFAULT_ALLOWED_EXECUTABLES = new Set([
  'gcc', 'g++', 'clang', 'clang++', 'cc', 'c++',
  'node', 'npm', 'npx',
  'python3', 'python', 'pip3', 'pip',
  'rustc', 'cargo',
  'go',
  'make', 'cmake',
  'git',
  'cat', 'echo', 'ls', 'cp', 'mv', 'rm', 'mkdir', 'touch', 'chmod',
  'diff', 'cmp', 'head', 'tail', 'wc', 'sort', 'uniq',
  'find', 'grep', 'sed', 'awk',
  'tee', 'xargs',
  'env', 'which', 'type', 'true', 'false',
  'sh', 'bash', 'zsh',
  'pwsh', 'pwsh.exe',
]);

// --- Default blocked environment variable names ---

const DEFAULT_BLOCKED_ENV_NAMES = new Set([
  'PATH', 'HOME', 'USER', 'SHELL', 'LOGNAME',
  'LD_PRELOAD', 'LD_LIBRARY_PATH', 'LD_AUDIT', 'LD_DEBUG',
  'DYLD_INSERT_LIBRARIES', 'DYLD_LIBRARY_PATH', 'DYLD_FRAMEWORK_PATH',
  'PYTHONPATH', 'PYTHONHOME', 'NODE_PATH', 'PERL5LIB', 'PERLLIB',
  'IFS', 'BASH_ENV', 'ENV', 'PROMPT_COMMAND',
  'HOSTNAME', 'HOSTTYPE', 'MACHTYPE', 'OSTYPE',
]);

// --- Default limits ---

const DEFAULT_MAX_TIMEOUT_MS = 300_000; // 5 minutes
const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10 MB

// --- Allowed environment name pattern ---

const ALLOWED_ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// --- Default validation context ---

export function defaultValidationContext(opts?: {
  readonly workspaceRoot?: string;
  readonly platform?: NodeJS.Platform;
  readonly enforcementAvailable?: boolean;
  readonly clock?: () => string;
}): ValidationContext {
  return {
    workspaceRoot: opts?.workspaceRoot ?? process.cwd(),
    allowedExecutables: DEFAULT_ALLOWED_EXECUTABLES,
    blockedEnvNames: DEFAULT_BLOCKED_ENV_NAMES,
    maxTimeoutMs: DEFAULT_MAX_TIMEOUT_MS,
    maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
    platform: opts?.platform ?? process.platform,
    enforcementAvailable: opts?.enforcementAvailable ?? true,
    clock: opts?.clock ?? (() => new Date().toISOString()),
  };
}

// --- Compute action digest ---

export function computeCommandActionDigest(proposal: Omit<CommandProposal, 'actionDigest' | 'operationId'>): string {
  const canonical = JSON.stringify({
    executable: proposal.executable,
    argv: proposal.argv,
    cwd: proposal.cwd,
    environment: Object.keys(proposal.environment).sort(),
    shellPolicy: proposal.shellPolicy,
    timeoutMs: proposal.timeoutMs,
    outputLimitBytes: proposal.outputLimitBytes,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// --- Main validation function ---

/**
 * Validate a controlled command proposal (Story 3.7 AC #1, AC #2).
 *
 * AC #1 checks:
 * - Resolve approved executable identity
 * - Validate explicit argv vector (no shell metacharacters)
 * - Validate Workspace-contained cwd
 * - Validate allowed environment names/values
 * - Validate shell/startup-hook policy
 * - Validate timeout
 * - Validate output limits
 * - Validate action digest
 *
 * AC #2 checks:
 * - Unsupported shell/platform
 * - Out-of-Workspace resource
 * - Privileged/system mutation
 * - Network boundary
 * - Unavailable process enforcement
 */
export function validateControlledCommand(
  proposal: CommandProposal,
  ctx?: ValidationContext,
): CommandValidationResult {
  const context = ctx ?? defaultValidationContext();

  // --- AC #2: Unavailable process enforcement ---
  if (!context.enforcementAvailable) {
    return {
      ok: false,
      refusal: 'enforcement-unverified',
      reason: 'process enforcement is unavailable or unverified',
      reasonCode: 'enforcement-unverified',
    };
  }

  // --- AC #1: Resolve approved executable identity ---
  if (!proposal.executable || proposal.executable.length === 0) {
    return {
      ok: false,
      refusal: 'denied',
      reason: 'executable identity is empty',
      reasonCode: 'empty-executable',
    };
  }

  // Executable must be a simple name (no path separators) OR a path
  // that resolves within the workspace (e.g. a compiled binary).
  if (proposal.executable.includes('/') || proposal.executable.includes('\\')) {
    try {
      resolveWithinWorkspace(context.workspaceRoot, proposal.executable);
    } catch {
      return {
        ok: false,
        refusal: 'denied',
        reason: 'executable path is outside the workspace',
        reasonCode: 'executable-path-outside-workspace',
      };
    }
  }

  // Executable must be in the allowed set (simple names) or a workspace path.
  if (!proposal.executable.includes('/') && !proposal.executable.includes('\\')) {
    if (!context.allowedExecutables.has(proposal.executable)) {
      return {
        ok: false,
        refusal: 'denied',
        reason: `executable "${proposal.executable}" is not in the allowed set`,
        reasonCode: 'executable-not-allowed',
      };
    }
  }

  // --- AC #1: Validate explicit argv vector ---
  if (!proposal.argv || proposal.argv.length === 0) {
    return {
      ok: false,
      refusal: 'denied',
      reason: 'argv vector is empty',
      reasonCode: 'empty-argv',
    };
  }

  // Check each argv element for shell metacharacters.
  for (let i = 0; i < proposal.argv.length; i++) {
    const arg = proposal.argv[i];
    if (SHELL_METACHARACTER_RE.test(arg)) {
      return {
        ok: false,
        refusal: 'denied',
        reason: `argv[${i}] contains shell metacharacters: "${arg}"`,
        reasonCode: 'shell-metacharacter-in-argv',
      };
    }
  }

  // --- AC #1: Validate Workspace-contained cwd ---
  if (!proposal.cwd || proposal.cwd.length === 0) {
    return {
      ok: false,
      refusal: 'denied',
      reason: 'cwd is empty',
      reasonCode: 'empty-cwd',
    };
  }

  try {
    resolveWithinWorkspace(context.workspaceRoot, proposal.cwd);
  } catch {
    return {
      ok: false,
      refusal: 'denied',
      reason: `cwd "${proposal.cwd}" is outside the workspace`,
      reasonCode: 'cwd-outside-workspace',
    };
  }

  // --- AC #1: Validate allowed environment names/values ---
  for (const [name, value] of Object.entries(proposal.environment)) {
    if (!ALLOWED_ENV_NAME_RE.test(name)) {
      return {
        ok: false,
        refusal: 'denied',
        reason: `environment variable name "${name}" contains invalid characters`,
        reasonCode: 'invalid-env-name',
      };
    }
    if (context.blockedEnvNames.has(name)) {
      return {
        ok: false,
        refusal: 'denied',
        reason: `environment variable "${name}" is blocked for security reasons`,
        reasonCode: 'blocked-env-name',
      };
    }
    // Check for shell metacharacters in environment values.
    if (SHELL_METACHARACTER_RE.test(value)) {
      return {
        ok: false,
        refusal: 'denied',
        reason: `environment variable "${name}" contains shell metacharacters in its value`,
        reasonCode: 'shell-metacharacter-in-env-value',
      };
    }
  }

  // --- AC #1: Validate shell/startup-hook policy ---
  if (!['no-shell', 'allowed-shell', 'startup-hook-only'].includes(proposal.shellPolicy)) {
    return {
      ok: false,
      refusal: 'denied',
      reason: `invalid shell policy: "${proposal.shellPolicy}"`,
      reasonCode: 'invalid-shell-policy',
    };
  }

  // --- AC #2: Unsupported shell/platform ---
  if (proposal.shellPolicy !== 'no-shell') {
    // On non-native platforms, shell invocation is unsupported.
    if (context.platform !== 'darwin' && context.platform !== 'win32') {
      return {
        ok: false,
        refusal: 'refused',
        reason: `shell invocation is not supported on platform "${context.platform}"`,
        reasonCode: 'unsupported-platform-for-shell',
      };
    }
  }

  // --- AC #1: Validate timeout ---
  if (typeof proposal.timeoutMs !== 'number' || proposal.timeoutMs <= 0) {
    return {
      ok: false,
      refusal: 'denied',
      reason: 'timeout must be a positive number',
      reasonCode: 'invalid-timeout',
    };
  }
  if (proposal.timeoutMs > context.maxTimeoutMs) {
    return {
      ok: false,
      refusal: 'denied',
      reason: `timeout ${proposal.timeoutMs}ms exceeds maximum ${context.maxTimeoutMs}ms`,
      reasonCode: 'timeout-exceeds-limit',
    };
  }

  // --- AC #1: Validate output limits ---
  if (typeof proposal.outputLimitBytes !== 'number' || proposal.outputLimitBytes <= 0) {
    return {
      ok: false,
      refusal: 'denied',
      reason: 'output limit must be a positive number',
      reasonCode: 'invalid-output-limit',
    };
  }
  if (proposal.outputLimitBytes > context.maxOutputBytes) {
    return {
      ok: false,
      refusal: 'denied',
      reason: `output limit ${proposal.outputLimitBytes} bytes exceeds maximum ${context.maxOutputBytes} bytes`,
      reasonCode: 'output-limit-exceeds-max',
    };
  }

  // --- AC #1: Validate action digest ---
  const expectedDigest = computeCommandActionDigest(proposal);
  if (proposal.actionDigest !== expectedDigest) {
    return {
      ok: false,
      refusal: 'denied',
      reason: 'action digest does not match canonical proposal',
      reasonCode: 'action-digest-mismatch',
    };
  }

  // --- AC #2: Privileged/system mutation check ---
  // Check if the executable is a privileged/system-level command.
  const privilegedExecutables = new Set(['chmod', 'chown', 'chgrp', 'mount', 'umount', 'fdisk', 'mkfs']);
  if (privilegedExecutables.has(proposal.executable)) {
    return {
      ok: false,
      refusal: 'denied',
      reason: `executable "${proposal.executable}" is a privileged/system mutation command`,
      reasonCode: 'privileged-command-denied',
    };
  }

  // --- AC #2: Network boundary check ---
  // Check if the executable is a network-facing command.
  const networkExecutables = new Set(['curl', 'wget', 'nc', 'netcat', 'ssh', 'scp', 'rsync', 'telnet', 'ftp']);
  if (networkExecutables.has(proposal.executable)) {
    return {
      ok: false,
      refusal: 'denied',
      reason: `executable "${proposal.executable}" crosses the network boundary`,
      reasonCode: 'network-boundary-denied',
    };
  }

  // All checks passed.
  return { ok: true, proposal };
}
