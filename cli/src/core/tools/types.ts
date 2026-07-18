import type { WorkMode } from '../permissions/types.js';

/**
 * Execution context handed to a Local Tool by the core. The UI never
 * constructs this and never touches fs/network/child_process itself (ADR 0020).
 */
export interface ToolContext {
  /** Absolute Workspace Binding root. All paths must resolve inside this. */
  readonly workspaceRoot: string;
  /** Current Work Mode, for defense-in-depth checks inside a tool. */
  readonly mode: WorkMode;
  /** Optional cancellation for long-running tools (e.g. run_command). */
  readonly signal?: AbortSignal;
}

export interface ToolResult {
  readonly ok: boolean;
  /** Human-readable output or error text. Secrets must be redacted upstream. */
  readonly output: string;
  /** Optional structured payload for the agent loop / normalization. */
  readonly data?: unknown;
}

/**
 * A Local Tool (ADR 0003 local side). Every tool declares whether it is
 * `mutating`; the ToolRegistry refuses mutating tools in Plan Mode, and the
 * permission engine gates execution independently.
 */
export interface Tool {
  readonly name: string;
  readonly description: string;
  /** Structural classification driving Plan-Mode refusal + permission policy. */
  readonly mutating: boolean;
  /** Marks sensitive operations needing stricter consent (ADR 0011/0012). */
  readonly sensitive?: boolean;
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
