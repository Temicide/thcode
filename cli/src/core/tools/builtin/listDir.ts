import { readdir } from 'node:fs/promises';
import type { Tool } from '../types.js';
import { resolveWithinWorkspace } from '../workspace.js';

export const listDirTool: Tool = {
  name: 'list_dir',
  description: 'List entries of a directory inside the workspace.',
  mutating: false,
  async execute(input, ctx) {
    const rel = String(input.path ?? '.');
    const abs = resolveWithinWorkspace(ctx.workspaceRoot, rel);
    const entries = await readdir(abs, { withFileTypes: true });
    const lines = entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort();
    return { ok: true, output: lines.join('\n'), data: lines };
  },
};
