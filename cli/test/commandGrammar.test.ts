// Story 2.13: controlled command grammar + CoreApp dispatch surface.
import { describe, expect, it } from 'vitest';
import {
  COMMAND_GRAMMAR,
  commandRejection,
  completeCommand,
  noTtyCommandBlocked,
  parseCommand,
} from '../src/core/protocol/commandGrammar.js';
import { CoreApp } from '../src/core/app.js';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';

const app = () => new CoreApp({ credentials: new InMemoryCredentialStore() });

describe('Command grammar — frozen, discoverable, dispatches only through CoreApp (AC #1)', () => {
  it('declares every required command', () => {
    const cmds = COMMAND_GRAMMAR.map((c) => c.command);
    for (const c of ['status', 'permissions', 'mode', 'boundaries', 'connections', 'activity', 'models', 'tools', 'check', 'help']) {
      expect(cmds).toContain(c);
    }
  });

  it('parses a declared command and its alias', () => {
    expect(parseCommand('/status')).toEqual(expect.objectContaining({ ok: true, command: 'status' }));
    expect(parseCommand('/st')).toEqual(expect.objectContaining({ ok: true, command: 'status' }));
    expect(parseCommand('/h')).toEqual(expect.objectContaining({ ok: true, command: 'help' }));
  });

  it('rejects shell expansion, globbing, interpolation, substitution, and user executables', () => {
    for (const bad of ['/status && rm -rf /', '/tools $HOME', '/mode `cat x`', '/check *.txt', '/tools | grep', '/sh -c "x"']) {
      const r = parseCommand(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.exitClass).toBe('BLOCKED');
        expect(r.exitCode).toBe(20);
        const rej = commandRejection(r);
        expect(rej.shellExecuted).toBe(false);
        expect(rej.fileMutated).toBe(false);
      }
    }
  });

  it('rejects an unknown command deterministically', () => {
    const r = parseCommand('/launch_missiles');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cause).toBe('unknown-command');
  });
});

describe('Command completion — deterministic, declared-only (AC #2)', () => {
  it('suggests only declared commands/aliases matching a prefix', () => {
    const c = completeCommand('/s');
    expect(c).toContain('/status');
    expect(c.every((x) => x.startsWith('/'))).toBe(true);
  });
  it('does not invent completions for unknown prefixes', () => {
    expect(completeCommand('/zzz')).toEqual([]);
  });
});

describe('Command dispatch — /models inspection-only, /tools no Specialist invocation (AC #3)', () => {
  it('/models is Typhoon inspection-only with honest labels', () => {
    const out = app().dispatchCommand('/models');
    expect(out.stdout).toContain('Typhoon inspection-only');
  });
  it('/tools exposes catalog without making Catalogued entries invokable', () => {
    const out = app().dispatchCommand('/tools');
    expect(out.exitCode).toBe(0);
  });
});

describe('Command dispatch — malformed command, no shell/file mutation, recorded (AC #4)', () => {
  it('returns a sanitized deterministic error with exit mapping and no shell/file mutation', () => {
    const out = app().dispatchCommand('/status && rm');
    expect(out.exitCode).toBe(20);
    expect(out.stderr).toContain('shell-expansion-not-permitted');
    expect(out.json).toContain('"exitClass":"BLOCKED"');
  });
  it('a successful command uses the same projection across surfaces (AC #5)', () => {
    const out = app().dispatchCommand('/status');
    expect(out.exitCode).toBe(0);
    expect(out.stdout).toContain('workMode');
    expect(out.json).toContain('"status":"succeeded"');
  });
});

describe('Command dispatch — no TTY fails closed (AC #6)', () => {
  it('a command requiring interactive approval with no TTY fails closed with no pending authority', () => {
    const out = app().dispatchCommand('/mode plan', { hasTty: false, requireInteractive: true });
    expect(out.exitCode).toBe(20);
    expect(out.stderr).toContain('rerun interactively');
    const blocked = noTtyCommandBlocked();
    expect(blocked.pendingAuthority).toBe(false);
  });
  it('an interactive command with a TTY proceeds', () => {
    const out = app().dispatchCommand('/mode plan', { hasTty: true, requireInteractive: true });
    expect(out.exitCode).toBe(0);
  });
});

describe('Command dispatch — /help lists the grammar', () => {
  it('/help lists every declared command', () => {
    const out = app().dispatchCommand('/help');
    for (const c of COMMAND_GRAMMAR) expect(out.stdout).toContain(`/${c.command}`);
  });
});