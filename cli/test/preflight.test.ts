import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runPreflight } from '../src/core/preflight/run.js';
import type { RuntimeEnv } from '../src/core/preflight/probes.js';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';

function env(over: Partial<RuntimeEnv> = {}): RuntimeEnv {
  return {
    platform: 'darwin',
    shell: '/bin/zsh',
    nodeVersion: 'v22.0.0',
    tty: true,
    localAppStateDir: '/tmp/thcode-test-state',
    credentialStore: new InMemoryCredentialStore(),
    ...over,
  };
}

describe('preflight — supported environments (AC #1)', () => {
  it('passes on macOS 14+ with zsh and Node 22', () => {
    const r = runPreflight(env({ platform: 'darwin', shell: '/bin/zsh', nodeVersion: 'v22.0.0' }));
    expect(r.status).toBe('supported');
    expect(r.exitCode).toBe(0);
    expect(r.platform).toBe('darwin');
    expect(r.shell).toBe('/bin/zsh');
    expect(r.nodeVersion).toBe('v22.0.0');
  });

  it('passes on Windows with pwsh.exe and Node 24', () => {
    const r = runPreflight(env({ platform: 'win32', shell: 'pwsh.exe', nodeVersion: 'v24.0.0' }));
    expect(r.status).toBe('supported');
    expect(r.exitCode).toBe(0);
  });

  it('passes on macOS with Node 26 (future LTS)', () => {
    const r = runPreflight(env({ nodeVersion: 'v26.0.0' }));
    expect(r.status).toBe('supported');
  });

  it('credential store is never read for a secret during preflight', async () => {
    const store = new InMemoryCredentialStore();
    await store.set('typhoon', 'sk-secret-never-read');
    const r = runPreflight(env({ credentialStore: store }));
    expect(r.status).toBe('supported');
    expect(await store.get('typhoon')).toBe('sk-secret-never-read');
  });
});

describe('preflight — unsupported environments block (AC #2)', () => {
  it('blocks Node below 22', () => {
    const r = runPreflight(env({ nodeVersion: 'v20.0.0' }));
    expect(r.status).toBe('blocked');
    expect(r.exitCode).toBe(20);
    expect(r.cause).toBe('unsupported-node-version');
  });

  it('blocks Linux platform', () => {
    const r = runPreflight(env({ platform: 'linux', shell: '/bin/bash' }));
    expect(r.status).toBe('blocked');
    expect(r.exitCode).toBe(20);
    expect(r.cause).toBe('unsupported-platform');
  });

  it('blocks WSL (MSYSTEM env set)', () => {
    const r = runPreflight(env({ platform: 'win32', shell: '/bin/bash', msystem: 'MINGW64' }));
    expect(r.status).toBe('blocked');
    expect(r.cause).toBe('unsupported-shell');
  });

  it('blocks PowerShell 5.1 (powershell.exe without pwsh)', () => {
    const r = runPreflight(env({ platform: 'win32', shell: 'powershell.exe' }));
    expect(r.status).toBe('blocked');
    expect(r.cause).toBe('unsupported-shell');
  });

  it('blocks Git Bash/MSYS', () => {
    const r = runPreflight(env({ platform: 'win32', shell: 'C:\\Program Files\\Git\\bin\\bash.exe', msystem: 'MSYS' }));
    expect(r.status).toBe('blocked');
    expect(r.cause).toBe('unsupported-shell');
  });

  it('blocked path never prompts for credentials (no secret read)', () => {
    const store = new InMemoryCredentialStore();
    const r = runPreflight(env({ nodeVersion: 'v18.0.0', credentialStore: store }));
    expect(r.status).toBe('blocked');
    expect(store.getCallCount()).toBe(0);
  });
});

describe('preflight — headless/redirected (AC #4)', () => {
  it('headless with interactive-required action blocks with rerun interactively', () => {
    const r = runPreflight(env({ tty: false }));
    expect(r.status).toBe('blocked');
    expect(r.cause).toBe('interactive-required-in-headless');
    expect(r.exitCode).toBe(20);
    expect(r.recovery.toLowerCase()).toContain('rerun interactively');
  });

  it('redirected (no stdout TTY) blocks the same way', () => {
    const r = runPreflight(env({ tty: false, outputMode: 'redirected' }));
    expect(r.status).toBe('blocked');
    expect(r.cause).toBe('interactive-required-in-headless');
  });
});

describe('preflight — unknown probe failures (AC #5)', () => {
  it('folds a throwing probe into unknown, never supported', () => {
    const throwingStore = {
      get: () => {
        throw new Error('boom');
      },
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      has: () => Promise.resolve(false),
      availability: () => {
        throw new Error('probe boom');
      },
    } as unknown as InMemoryCredentialStore;
    const r = runPreflight(env({ credentialStore: throwingStore }));
    expect(r.status).toBe('unknown');
    expect(r.exitCode).toBe(30);
    expect(r.cause).toBe('probe-failed');
  });
});

describe('preflight — output is secret-safe (AD-24, AC #5)', () => {
  it('result JSON contains no env values or raw errors', () => {
    const r = runPreflight(env({ platform: 'linux', shell: '/bin/bash' }));
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain('sk-');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('Error:');
    expect(serialized).not.toContain('stack');
  });
});

describe('preflight — headless/Ink boundary regression (AC #6, AD-1)', () => {
  it('src/ui/App.tsx imports only react, ink, and core/app.js', async () => {
    const uiSource = await readFile(
      path.resolve(__dirname, '..', 'src', 'ui', 'App.tsx'),
      'utf8',
    );
    const importLines = uiSource.split('\n').filter((l) => /^\s*import/.test(l));
    for (const line of importLines) {
      const m = line.match(/from\s+['"]([^'"]+)['"]/);
      if (!m) continue;
      const spec = m[1];
      const ok =
        spec === 'react' ||
        spec === 'ink' ||
        /^(\.\.\/core\/app\.js|\.\.\/core\/app)$/.test(spec);
      expect(ok, `UI imports forbidden module: ${spec}`).toBe(true);
    }
    const forbidden = ['node:fs', 'node:child_process', 'node:net', 'node:https'];
    for (const line of importLines) {
      for (const f of forbidden) {
        expect(line, `UI import mentions ${f}`).not.toContain(f);
      }
      expect(line, `UI import mentions child_process`).not.toMatch(/\bchild_process\b/);
      expect(line, `UI import mentions net/http`).not.toMatch(/\b(node:)?(net|https)\b/);
    }
  });
});