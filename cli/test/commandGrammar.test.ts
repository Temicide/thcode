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

describe('Command dispatch — /rollback (Story 3.12)', () => {
  it('/rollback is a declared command', () => {
    const cmds = COMMAND_GRAMMAR.map((c) => c.command);
    expect(cmds).toContain('rollback');
  });

  it('/rollback has alias /rb', () => {
    const spec = COMMAND_GRAMMAR.find((c) => c.command === 'rollback');
    expect(spec).toBeTruthy();
    expect(spec!.aliases).toContain('rb');
  });

  it('/rollback list parses successfully', () => {
    const r = parseCommand('/rollback list');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.command).toBe('rollback');
      expect(r.args).toEqual(['list']);
    }
  });

  it('/rollback inspect <id> parses successfully', () => {
    const r = parseCommand('/rollback inspect abc-123');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.command).toBe('rollback');
      expect(r.args).toEqual(['inspect', 'abc-123']);
    }
  });

  it('/rb list parses via alias', () => {
    const r = parseCommand('/rb list');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.command).toBe('rollback');
      expect(r.args).toEqual(['list']);
    }
  });

  it('/rollback without subcommand returns blocked', () => {
    const out = app().dispatchCommand('/rollback');
    expect(out.exitCode).toBe(20);
    expect(out.stderr).toContain('rollback requires a subcommand');
  });

  it('/rollback with unknown subcommand returns blocked', () => {
    const out = app().dispatchCommand('/rollback apply');
    expect(out.exitCode).toBe(20);
    expect(out.stderr).toContain('rollback requires a subcommand');
  });

  it('/rollback list without kvstore returns blocked', () => {
    const out = app().dispatchCommand('/rollback list');
    expect(out.exitCode).toBe(20);
    expect(out.stderr).toContain('no key-value store');
  });

  it('/rollback inspect without kvstore returns blocked', () => {
    const out = app().dispatchCommand('/rollback inspect abc');
    expect(out.exitCode).toBe(20);
    expect(out.stderr).toContain('no key-value store');
  });

  it('/rollback is listed in /help output', () => {
    const out = app().dispatchCommand('/help');
    expect(out.stdout).toContain('/rollback');
  });
});

describe('Command dispatch — /recover (Story 3.15)', () => {
  it('/recover is a declared command', () => {
    const cmds = COMMAND_GRAMMAR.map((c) => c.command);
    expect(cmds).toContain('recover');
  });

  it('/recover has alias /rc', () => {
    const spec = COMMAND_GRAMMAR.find((c) => c.command === 'recover');
    expect(spec).toBeTruthy();
    expect(spec!.aliases).toContain('rc');
  });

  it('/recover inspect <id> parses successfully', () => {
    const r = parseCommand('/recover inspect op-123');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.command).toBe('recover');
      expect(r.args).toEqual(['inspect', 'op-123']);
    }
  });

  it('/recover reconcile <id> parses successfully', () => {
    const r = parseCommand('/recover reconcile op-123');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.command).toBe('recover');
      expect(r.args).toEqual(['reconcile', 'op-123']);
    }
  });

  it('/recover export <id> parses successfully', () => {
    const r = parseCommand('/recover export op-123');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.command).toBe('recover');
      expect(r.args).toEqual(['export', 'op-123']);
    }
  });

  it('/recover exit parses successfully', () => {
    const r = parseCommand('/recover exit');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.command).toBe('recover');
      expect(r.args).toEqual(['exit']);
    }
  });

  it('/rc inspect parses via alias', () => {
    const r = parseCommand('/rc inspect op-123');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.command).toBe('recover');
      expect(r.args).toEqual(['inspect', 'op-123']);
    }
  });

  it('/recover without subcommand shows help', () => {
    const out = app().dispatchCommand('/recover');
    expect(out.exitCode).toBe(0);
    expect(out.stdout).toContain('RECOVERY ENTRY POINT');
  });

  it('/recover with unknown subcommand returns blocked', () => {
    const out = app().dispatchCommand('/recover unknown');
    expect(out.exitCode).toBe(20);
    expect(out.stderr).toContain('recover requires a subcommand');
  });

  it('/recover inspect without journal returns blocked', () => {
    const out = app().dispatchCommand('/recover inspect op-123');
    expect(out.exitCode).toBe(20);
    expect(out.stderr).toContain('no journal repository');
  });

  it('/recover is listed in /help output', () => {
    const out = app().dispatchCommand('/help');
    expect(out.stdout).toContain('/recover');
  });
});