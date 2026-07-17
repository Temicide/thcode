#!/usr/bin/env node
// thcode entry point. --version / --help are a fast path that never imports
// Ink or React, so they work in CI and non-TTY environments (requirement 12).
// A startup preflight gate (Story 1.1) runs after the fast path and before
// `main()`; on a blocked/unknown result it emits a typed record and exits
// without ever importing Ink.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function pkgVersion(): string {
  try {
    return (require('../package.json') as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
  console.log(`thcode ${pkgVersion()}`);
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(
    [
      `thcode ${pkgVersion()} — Thai-first coding agent CLI (prototype)`,
      '',
      'Usage: thcode [options]',
      '',
      'Options:',
      '  -v, --version   Print version and exit',
      '  -h, --help      Show this help and exit',
      '',
      'Interactive commands: /plan /build /models /permissions /tools /exit',
      'Shift+Tab cycles Plan/Build. New sessions start in Build + Manual.',
      '',
      'Requires Node.js >= 22. Windows-first prototype (ADR 0008).',
    ].join('\n'),
  );
  process.exit(0);
}

// Preflight gate: runs before any Ink import (AD-23, UX-DR-098–100). A
// blocked/unknown result exits the process here; the supported path falls
// through to `main()` below.
async function preflight(): Promise<void> {
  const [{ createCredentialStore }, { runtimeEnvFromProcess, runPreflight }] = await Promise.all([
    import('./core/platform/index.js'),
    import('./core/preflight/run.js'),
  ]);
  const env = runtimeEnvFromProcess(createCredentialStore());
  const result = runPreflight(env);
  if (result.status === 'supported') {
    // One-line safe summary to stdout (UX-DR-099). No secrets, no diagnostics.
    console.log(`thcode: ${result.message}`);
    return;
  }
  // Blocked / unknown: safe summary to stdout, typed diagnostics to stderr,
  // then exit with the canonical code. NEVER import Ink on this path.
  console.log(`thcode: ${result.message}`);
  console.error(`cause: ${result.cause}`);
  console.error(`recovery: ${result.recovery}`);
  console.error(
    `platform=${result.platform} shell=${result.shell} node=${result.nodeVersion ?? 'unknown'} mode=${result.outputMode}`,
  );
  process.exit(result.exitCode);
}

void preflight().then(main).catch((err) => {
  console.error(`thcode failed to start: ${(err as Error).message}`);
  process.exit(1);
});

// Interactive path: import Ink lazily so the fast path above stays raw-mode free.
async function main(): Promise<void> {
  const [{ render }, React, { App }, { CoreApp }] = await Promise.all([
    import('ink'),
    import('react'),
    import('./ui/App.js'),
    import('./core/app.js'),
  ]);

  const core = new CoreApp({ workspaceRoot: process.cwd() });
  const instance = render(React.createElement(App, { core }), { exitOnCtrlC: true });
  await instance.waitUntilExit();
}
