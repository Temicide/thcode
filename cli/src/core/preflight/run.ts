// Preflight runner: composes deterministic probes into a typed PreflightResult
// (AD-9, AD-23, AD-24, AD-28; UX-DR-098–100, UX-DR-120). It runs before
// CoreApp/Ink construction on the entry path (cli/src/index.ts). The blocked
// path MUST NOT import Ink.

import { PREFLIGHT_EXIT_CODES, type PreflightResult } from './types.js';

const EXIT_SUCCESS = PREFLIGHT_EXIT_CODES.SUCCESS as 0;
const EXIT_BLOCKED = PREFLIGHT_EXIT_CODES.BLOCKED as 20;
const EXIT_FAILED = PREFLIGHT_EXIT_CODES.FAILED as 30;
import {
  type RuntimeEnv,
  type ProbeResult,
  probeCredentialStorePosture,
  probeLocalStorePosture,
  probeNodeVersion,
  probeOutputMode,
  probePlatform,
} from './probes.js';

/** Build a RuntimeEnv from the real process. Only this function touches
 * `process.*` directly; everything else takes an injected env. */
export function runtimeEnvFromProcess(credentialStore: RuntimeEnv['credentialStore']): RuntimeEnv {
  const msystem = (process.env.MSYSTEM ?? '').trim();
  return {
    platform: process.platform,
    shell: (process.env.SHELL ?? (process.platform === 'win32' ? 'powershell.exe' : '/bin/sh')),
    nodeVersion: process.version,
    tty: process.stdout.isTTY === true,
    localAppStateDir: undefined,
    credentialStore,
    msystem: msystem.length > 0 ? msystem : undefined,
  };
}

/** Compose preflight from an injected env. Pure: no fs/network/secret read.
 * Short-circuits on the first hard blocker (platform, node). Folds any
 * thrown probe into `unknown` (AC #5, NFR-12). */
export function runPreflight(env: RuntimeEnv): PreflightResult {
  const base = {
    platform: env.platform,
    shell: env.shell,
    nodeVersion: env.nodeVersion,
  } as const;

  // 1) Platform + shell — hard blocker.
  const platformProbe = run(probePlatform, env);
  if (!platformProbe.ok) {
    return fromProbeFail(platformProbe, base, env, 'ok', 'ok');
  }

  // 2) Node version — hard blocker.
  const nodeProbe = run(probeNodeVersion, env);
  if (!nodeProbe.ok) {
    return fromProbeFail(nodeProbe, base, env, 'ok', 'ok');
  }

  // 3) Output mode — informs the interactive gate (AC #4).
  const outputProbe = run(probeOutputMode, env);
  if (!outputProbe.ok) {
    return fromProbeFail(outputProbe, base, env, 'unknown', 'unknown');
  }
  const outputMode = outputProbe.value;

  // 4) Local store posture (best-effort, honest).
  const storeProbe = run(probeLocalStorePosture, env);
  const localStorePosture = storeProbe.ok ? storeProbe.value : 'unknown';

  // 5) Credential store posture (non-mutating; never reads a secret).
  const credProbe = run(probeCredentialStorePosture, env);
  if (!credProbe.ok) {
    return fromProbeFail(credProbe, base, env, localStorePosture, 'unknown', outputMode);
  }
  const credentialStorePosture = credProbe.value;

  // 6) Interactive gate: headless/redirected cannot proceed to an interactive
  //    main path; block with `rerun interactively` (AC #4, UX-DR-098).
  if (outputMode !== 'interactive') {
    return makeBlocked(
      'interactive-required-in-headless',
      base,
      env,
      localStorePosture,
      credentialStorePosture,
      outputMode,
    );
  }

  // All probes passed and we are interactive → supported.
  return {
    status: 'supported',
    exitClass: 'SUCCESS',
    exitCode: EXIT_SUCCESS,
    platform: env.platform,
    shell: env.shell,
    nodeVersion: env.nodeVersion,
    outputMode,
    localStorePosture,
    credentialStorePosture,
    message: `Supported: ${env.platform} / ${env.shell} / ${env.nodeVersion}`,
    recovery: '',
    cause: null,
  };
}

/** Run a probe, catching thrown exceptions as a 'probe-failed' result. */
function run<T>(
  probe: (env: RuntimeEnv) => ProbeResult<T>,
  env: RuntimeEnv,
): ProbeResult<T> {
  try {
    return probe(env);
  } catch {
    return { ok: false, cause: 'probe-failed' };
  }
}

type BaseFields = Pick<RuntimeEnv, 'platform' | 'shell' | 'nodeVersion'>;

/** Convert a failed probe into the appropriate PreflightResult: a typed
 * `blocked` for hard blockers, or `unknown` for probe-failed. */
function fromProbeFail(
  probe: { ok: false; cause: string },
  base: BaseFields,
  env: RuntimeEnv,
  localStorePosture: 'ok' | 'unavailable' | 'unknown',
  credentialStorePosture: 'ok' | 'unavailable' | 'unknown',
  outputMode: 'interactive' | 'redirected' | 'headless' = env.tty ? 'interactive' : 'headless',
): PreflightResult {
  if (probe.cause === 'probe-failed') {
    return {
      status: 'unknown',
      exitClass: 'FAILED',
      exitCode: EXIT_FAILED,
      platform: base.platform,
      shell: base.shell,
      nodeVersion: base.nodeVersion,
      outputMode,
      localStorePosture: 'unknown',
      credentialStorePosture: 'unknown',
      message: 'A preflight probe could not produce a reliable result.',
      recovery: 'Inspect the typed cause and rerun after remediation.',
      cause: 'probe-failed',
    };
  }
  return makeBlocked(
    probe.cause as 'unsupported-platform' | 'unsupported-shell' | 'unsupported-node-version' | 'interactive-required-in-headless',
    base,
    env,
    localStorePosture,
    credentialStorePosture,
    outputMode,
  );
}

function makeBlocked(
  cause: 'unsupported-platform' | 'unsupported-shell' | 'unsupported-node-version' | 'interactive-required-in-headless',
  base: BaseFields,
  _env: RuntimeEnv,
  localStorePosture: 'ok' | 'unavailable' | 'unknown',
  credentialStorePosture: 'ok' | 'unavailable' | 'unknown',
  outputMode: 'interactive' | 'redirected' | 'headless',
): PreflightResult {
  const recovery =
    cause === 'unsupported-node-version'
      ? 'Install Node.js 22 or newer (Node.js 24 LTS is the clean-machine baseline).'
      : cause === 'unsupported-platform'
        ? 'Use Windows 11 25H2+ with Windows Terminal/PowerShell (pwsh.exe) or macOS 14+ with Terminal/zsh.'
        : cause === 'unsupported-shell'
          ? 'Use a supported native shell: pwsh.exe on Windows, or zsh on macOS.'
          : 'Rerun interactively in a TTY, or use the supported headless/noninteractive path.';
  return {
    status: 'blocked',
    exitClass: 'BLOCKED',
    exitCode: EXIT_BLOCKED,
    platform: base.platform,
    shell: base.shell,
    nodeVersion: base.nodeVersion,
    outputMode,
    localStorePosture,
    credentialStorePosture,
    message: `Blocked: ${cause}`,
    recovery,
    cause,
  };
}