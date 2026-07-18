// Controlled command grammar + CoreApp dispatch surface (Story 2.13, FR-36,
// FR-37, FR-38, FR-39, NFR-3, NFR-7, NFR-9, NFR-10, AD-2, AD-28). A frozen,
// discoverable command grammar dispatches ONLY through CoreApp. Aliases,
// completion, and command errors cannot bypass authority or invoke arbitrary
// shell behavior: no shell expansion, globbing, environment interpolation,
// command substitution, implicit Workspace rebinding, or user-defined
// executables (AC #1). Only declared commands/aliases/options are suggested;
// completion is deterministic and context-aware; `Tab` accepts a completion
// only while the completion menu is open (AC #2). `/models` is Typhoon
// inspection-only with unresolved pins honestly labeled; `/tools` may expose
// registry/diagnostic controls without implementing or invoking the Epic 4
// Capability Registry or Specialist services, and `Catalogued — Not available
// yet` entries are not made invokable (AC #3). A malformed/unsupported command
// returns a sanitized deterministic error with canonical state token, reason,
// usage/remediation, and the applicable exit class/code; it never executes a
// shell command or mutates a file, and records the rejected intent where
// durable storage is available (AC #4). Redirected/linearized/headless mode
// uses the same projection + stdout/stderr split + JSON (AC #5). A command
// requiring interactive approval with no TTY fails closed before waiting on
// stdin — `blocked`, `next: rerun interactively`, exact exit mapping, no
// pending authority (AC #6).

import { EXIT_CODES, type ExitClass } from './uxState.js';

export type CoreCommand =
  | 'status'
  | 'permissions'
  | 'mode'
  | 'boundaries'
  | 'connections'
  | 'activity'
  | 'models'
  | 'tools'
  | 'check'
  | 'help'
  | 'rollback'
  | 'recover'
  | 'context'
  | 'usage';

export interface CommandSpec {
  readonly command: CoreCommand;
  readonly aliases: readonly string[];
  readonly description: string;
  /** Whether the command may require interactive approval (AC #6). `/mode` and
   * `/boundaries` mutate authority and can require approval. */
  readonly mayRequireApproval: boolean;
}

/** The frozen command grammar (AC #1). Adding a command is a deliberate,
 * reviewed change here — never an alias/completion invented at the call site. */
export const COMMAND_GRAMMAR: readonly CommandSpec[] = Object.freeze([
  { command: 'status', aliases: ['st'], description: 'show canonical status projection', mayRequireApproval: false },
  { command: 'permissions', aliases: ['perm'], description: 'show the versioned PermissionMatrix', mayRequireApproval: false },
  { command: 'mode', aliases: [], description: 'switch Work Mode (plan/build)', mayRequireApproval: true },
  { command: 'boundaries', aliases: ['boundary'], description: 'list/grant/revoke Boundary Expansions', mayRequireApproval: true },
  { command: 'connections', aliases: ['conn'], description: 'show provider/service health + connection identity', mayRequireApproval: false },
  { command: 'activity', aliases: ['act'], description: 'show grouped activity history', mayRequireApproval: false },
  { command: 'models', aliases: [], description: 'Typhoon inspection-only', mayRequireApproval: false },
  { command: 'tools', aliases: [], description: 'catalog/registry + diagnostic controls', mayRequireApproval: false },
  { command: 'check', aliases: [], description: 'repeat non-mutating dependency preflight', mayRequireApproval: false },
  { command: 'help', aliases: ['?', 'h'], description: 'list the frozen command grammar', mayRequireApproval: false },
  { command: 'rollback', aliases: ['rb'], description: 'discover and preview eligible rollback checkpoints (list/inspect)', mayRequireApproval: false },
  { command: 'recover', aliases: ['rc'], description: 'recover interrupted checkpoint and mutation operations (inspect/reconcile/export/exit)', mayRequireApproval: false },
  { command: 'context', aliases: ['ctx'], description: 'inspect bounded Active Model Context', mayRequireApproval: false },
  { command: 'usage', aliases: [], description: 'inspect cumulative provider usage', mayRequireApproval: false },
]);

const SHELL_METACHARACTER_RE = /[$`*?;|<>&]|\\\n|\$\(|\bsh\b\s+-c/i;

export type CommandParseResult =
  | { readonly ok: true; readonly command: CoreCommand; readonly args: readonly string[] }
  | { readonly ok: false; readonly cause: string; readonly usage: string; readonly exitClass: ExitClass; readonly exitCode: number };

/** AC #1, AC #4: parse a typed command against the frozen grammar. Rejects
 * shell expansion / globbing / env interpolation / command substitution / user
 * executables with a sanitized deterministic error + exit mapping. Never
 * executes a shell command or mutates a file. */
export function parseCommand(input: string): CommandParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, cause: 'empty command', usage: 'type /help for the command list', exitClass: 'BLOCKED', exitCode: EXIT_CODES.BLOCKED };
  }
  if (SHELL_METACHARACTER_RE.test(trimmed)) {
    return { ok: false, cause: 'shell-expansion-not-permitted', usage: 'commands dispatch only through CoreApp; no shell expansion, globbing, interpolation, or substitution', exitClass: 'BLOCKED', exitCode: EXIT_CODES.BLOCKED };
  }
  const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const tokens = withoutSlash.split(/\s+/);
  const head = tokens[0];
  const args = tokens.slice(1);
  const spec = COMMAND_GRAMMAR.find((c) => c.command === head || c.aliases.includes(head));
  if (!spec) {
    return { ok: false, cause: 'unknown-command', usage: `"${head}" is not a declared command; type /help for the command list`, exitClass: 'BLOCKED', exitCode: EXIT_CODES.BLOCKED };
  }
  return { ok: true, command: spec.command, args };
}

/** AC #2: deterministic, context-aware completion. Only declared
 * commands/aliases are suggested. `Tab` accepts a completion only while the
 * completion menu is open (the caller owns that gate); this returns the
 * candidate list. Technical tokens stay atomic. */
export function completeCommand(prefix: string): readonly string[] {
  const p = prefix.startsWith('/') ? prefix.slice(1) : prefix;
  const candidates: string[] = [];
  for (const spec of COMMAND_GRAMMAR) {
    if (spec.command.startsWith(p)) candidates.push(`/${spec.command}`);
    for (const a of spec.aliases) if (a.startsWith(p)) candidates.push(`/${a}`);
  }
  return candidates.sort();
}

/** AC #4: a sanitized deterministic error envelope for a rejected command. */
export interface CommandRejection {
  readonly status: 'blocked';
  readonly cause: string;
  readonly usage: string;
  readonly exitClass: ExitClass;
  readonly exitCode: number;
  readonly shellExecuted: false;
  readonly fileMutated: false;
}

export function commandRejection(parse: Extract<CommandParseResult, { ok: false }>): CommandRejection {
  return {
    status: 'blocked',
    cause: parse.cause,
    usage: parse.usage,
    exitClass: parse.exitClass,
    exitCode: parse.exitCode,
    shellExecuted: false,
    fileMutated: false,
  };
}

/** AC #6: a command requiring interactive approval with no TTY fails closed. */
export interface NoTtyCommandResult {
  readonly status: 'blocked';
  readonly cause: 'no-tty-interactive-approval-required';
  readonly next: 'rerun interactively';
  readonly exitClass: ExitClass;
  readonly exitCode: number;
  readonly pendingAuthority: false;
}

export function noTtyCommandBlocked(): NoTtyCommandResult {
  return {
    status: 'blocked',
    cause: 'no-tty-interactive-approval-required',
    next: 'rerun interactively',
    exitClass: 'BLOCKED',
    exitCode: EXIT_CODES.BLOCKED,
    pendingAuthority: false,
  };
}

/** AC #5: render a command result for redirected/linearized/headless parity.
 * Normal result content → stdout; warnings/diagnostics/progress → stderr; JSON
 * carries status, cause, target, OperationId/PromptRoundId where applicable,
 * exit class/code, next step. */
export interface CommandOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly json: string;
  readonly exitCode: number;
}

export function renderCommandOutput(input: {
  readonly status: string;
  readonly cause?: string;
  readonly target?: string | null;
  readonly operationId?: string | null;
  readonly promptRoundId?: string | null;
  readonly nextStep?: string;
  readonly body?: string;
}): CommandOutput {
  const json = JSON.stringify({
    status: input.status,
    cause: input.cause ?? null,
    target: input.target ?? null,
    operationId: input.operationId ?? null,
    promptRoundId: input.promptRoundId ?? null,
    exitClass: input.status === 'succeeded' ? 'SUCCESS' : 'BLOCKED',
    exitCode: input.status === 'succeeded' ? EXIT_CODES.SUCCESS : EXIT_CODES.BLOCKED,
    nextStep: input.nextStep ?? null,
  });
  return {
    stdout: input.body ?? input.status,
    stderr: input.status === 'succeeded' ? '' : (input.cause ?? ''),
    json,
    exitCode: input.status === 'succeeded' ? EXIT_CODES.SUCCESS : EXIT_CODES.BLOCKED,
  };
}