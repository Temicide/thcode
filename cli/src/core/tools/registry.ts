import type { WorkMode } from '../permissions/types.js';
import type { Tool } from './types.js';
import { readFileTool } from './builtin/readFile.js';
import { listDirTool } from './builtin/listDir.js';
import { searchTool } from './builtin/search.js';
import { writeFileTool } from './builtin/writeFile.js';
import { runCommandTool } from './builtin/runCommand.js';

/**
 * Raised when a mutating tool is requested in Plan Mode. This is a STRUCTURAL
 * refusal (ADR 0013): it fires before the permission engine and regardless of
 * Permission Profile, so Plan + Full Access still cannot mutate.
 */
export class PlanModeToolRefusedError extends Error {
  constructor(tool: string) {
    super(`Tool "${tool}" is mutating and cannot run in Plan Mode (read-only).`);
    this.name = 'PlanModeToolRefusedError';
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  /** Tools structurally usable in the given Work Mode (mutating hidden in Plan). */
  listForMode(mode: WorkMode): Tool[] {
    return this.list().filter((t) => mode === 'build' || !t.mutating);
  }

  /**
   * Resolve a tool for execution in a Work Mode, enforcing the Plan-Mode
   * read-only boundary structurally. Throws if unknown or refused.
   */
  resolveForMode(name: string, mode: WorkMode): Tool {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    if (mode === 'plan' && tool.mutating) {
      throw new PlanModeToolRefusedError(name);
    }
    return tool;
  }
}

/** Registry seeded with the minimal-but-real Local Tools. */
export function createDefaultToolRegistry(): ToolRegistry {
  const reg = new ToolRegistry();
  reg.register(readFileTool);
  reg.register(listDirTool);
  reg.register(searchTool);
  reg.register(writeFileTool);
  reg.register(runCommandTool);
  return reg;
}
