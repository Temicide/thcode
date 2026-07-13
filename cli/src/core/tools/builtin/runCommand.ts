import { spawn } from 'node:child_process';
import type { Tool, ToolContext, ToolResult } from '../types.js';
import { redactSecrets } from '../../security/redact.js';

const DEFAULT_TIMEOUT_MS = 60_000;

// ADR 0008: the Windows target executes commands through PowerShell 7+
// (`pwsh.exe`), never legacy Windows PowerShell 5.1. The shell binary is a
// platform detail; a macOS/Linux process adapter is a future extension point.
const SHELL_BIN = process.platform === 'win32' ? 'pwsh.exe' : 'pwsh';

function runInShell(command: string, cwd: string, signal?: AbortSignal): Promise<ToolResult> {
  return new Promise<ToolResult>((resolve) => {
    const child = spawn(
      SHELL_BIN,
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { cwd, windowsHide: true },
    );

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        child.kill();
        settled = true;
        resolve({ ok: false, output: `run_command: timed out after ${DEFAULT_TIMEOUT_MS}ms` });
      }
    }, DEFAULT_TIMEOUT_MS);

    const onAbort = () => {
      if (!settled) {
        child.kill();
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, output: 'run_command: cancelled' });
      }
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        output: `run_command: failed to launch ${SHELL_BIN}: ${err.message}. ` +
          `Install PowerShell 7.4+ (see ADR 0008).`,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      const combined = redactSecrets([stdout, stderr].filter(Boolean).join('\n').trim());
      resolve({
        ok: code === 0,
        output: combined || `(exit ${code})`,
        data: { exitCode: code },
      });
    });
  });
}

export const runCommandTool: Tool = {
  name: 'run_command',
  description: 'Run a PowerShell 7 command in the workspace (streams, times out, cancellable).',
  mutating: true,
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const command = String(input.command ?? '');
    if (!command) return { ok: false, output: 'run_command: "command" is required' };
    return runInShell(command, ctx.workspaceRoot, ctx.signal);
  },
};
