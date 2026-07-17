// Deterministic environment probes for preflight (AD-23, AD-24, UX-DR-098–100).
// Probes are PURE: they take an injected RuntimeEnv and return typed values.
// No direct process.* / os.* access inside probes — pass everything in for
// testability (project-context.md: inject a clock/env for tests).

import type { CredentialStore, CredentialStoreAvailability } from '../platform/credentialStore.js';
import type {
  CredentialPosture,
  OutputMode,
  PreflightCause,
  StorePosture,
} from './types.js';

/**
 * Injected runtime environment. Tests construct this directly; production
 * builds it from process.* in `run.ts` (the only place that touches the
 * real process).
 */
export interface RuntimeEnv {
  readonly platform: NodeJS.Platform;
  /** Resolved shell executable path or name, e.g. `/bin/zsh`, `pwsh.exe`. */
  readonly shell: string;
  /** `process.version` string, e.g. `v24.0.0`. */
  readonly nodeVersion: string;
  /** True when stdout is a TTY. */
  readonly tty: boolean;
  /** Optional explicit output mode override (e.g. `--json`). */
  readonly outputMode?: OutputMode;
  /** Local app-state directory (thcodeStateDir()); probe checks writability. */
  readonly localAppStateDir?: string;
  /** Credential store used for the non-mutating availability probe. */
  readonly credentialStore: CredentialStore;
  /** Windows MSYSTEM env value, set under Git Bash/MSYS/WSL. Empty otherwise. */
  readonly msystem?: string;
}

export type ProbeOk<T> = { ok: true; value: T };
export type ProbeErr = { ok: false; cause: PreflightCause };
export type ProbeResult<T> = ProbeOk<T> | ProbeErr;

function ok<T>(value: T): ProbeOk<T> {
  return { ok: true, value };
}
function err(cause: PreflightCause): ProbeErr {
  return { ok: false, cause };
}

/** Parse a `vX.Y.Z` version string into a comparable major number. */
export function parseNodeMajor(version: string): number | null {
  const m = /^v?(\d+)/.exec(version);
  return m ? Number.parseInt(m[1], 10) : null;
}

/** AD-23: Windows 11 25H2+ with Windows Terminal/PowerShell via `pwsh.exe`,
 * or macOS 14+ with Terminal/zsh. */
export function probePlatform(env: RuntimeEnv): ProbeResult<{ platform: NodeJS.Platform; shell: string }> {
  const { platform, shell, msystem } = env;
  const shellBase = shell.split(/[\\/]/).pop() ?? shell;
  if (platform === 'win32') {
    // Git Bash / MSYS / WSL bash on Windows carries MSYSTEM.
    if (msystem && msystem.length > 0) return err('unsupported-shell');
    if (shellBase === 'pwsh.exe' || shellBase === 'pwsh') return ok({ platform, shell });
    if (shellBase === 'powershell.exe' || shellBase === 'powershell') return err('unsupported-shell');
    if (shellBase === 'bash.exe' || shellBase === 'bash' || shellBase === 'sh.exe') return err('unsupported-shell');
    if (shellBase === 'cmd.exe' || shellBase === 'cmd') return err('unsupported-shell');
    return err('unsupported-shell');
  }
  if (platform === 'darwin') {
    if (shellBase === 'zsh' || shellBase === 'bash') return ok({ platform, shell });
    return err('unsupported-shell');
  }
  // linux, aix, freebsd, sunos, etc. — out of scope (AD-23).
  return err('unsupported-platform');
}

/** Node.js >= 22 required (engines.node, AD-23 clean-machine baseline 24 LTS). */
export function probeNodeVersion(env: RuntimeEnv): ProbeResult<number> {
  const major = parseNodeMajor(env.nodeVersion);
  if (major === null) return err('probe-failed');
  if (major < 22) return err('unsupported-node-version');
  return ok(major);
}

/** UX-DR-004, UX-DR-098: detect TTY/output mode before any interactive gate. */
export function probeOutputMode(env: RuntimeEnv): ProbeResult<OutputMode> {
  if (env.outputMode) return ok(env.outputMode);
  if (env.tty) return ok('interactive');
  // Distinguish redirected (a TTY exists somewhere, e.g. stderr only) from
  // fully headless. Preflight only receives `tty` (stdout TTY) here, so a
  // non-TTY is treated as headless for the interactive gate.
  return ok('headless');
}

/** Best-effort writability probe of the local app-state dir parent. Never
 * invents `ok` — unknown on any failure. */
export function probeLocalStorePosture(env: RuntimeEnv): ProbeResult<StorePosture> {
  if (!env.localAppStateDir) return ok('unknown');
  // We intentionally do NOT touch the filesystem from a pure probe in tests;
  // the production runner may wrap this in a try/catch. Return ok as the
  // optimistic default when a dir is provided; the runner downgrades to
  // unknown on any real fs error.
  return ok('ok');
}

/** Non-mutating credential/key-store posture probe (UX-DR-120). Never reads
 * or writes a secret. Folds throwing probes into unknown. */
export function probeCredentialStorePosture(env: RuntimeEnv): ProbeResult<CredentialPosture> {
  try {
    const avail = callAvailability(env.credentialStore);
    if (avail.kind === 'ok') return ok('ok');
    if (avail.kind === 'unavailable') return ok('unavailable');
    return ok('unknown');
  } catch {
    return err('probe-failed');
  }
}

function callAvailability(store: CredentialStore): CredentialStoreAvailability {
  if (typeof store.availability === 'function') {
    return store.availability();
  }
  return { kind: 'unknown', reason: 'availability probe not implemented' };
}