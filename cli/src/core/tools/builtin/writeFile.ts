import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Tool } from '../types.js';
import { resolveWithinWorkspace } from '../workspace.js';

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Create or overwrite a UTF-8 text file inside the workspace.',
  mutating: true,
  async execute(input, ctx) {
    const rel = String(input.path ?? '');
    if (!rel) return { ok: false, output: 'write_file: "path" is required' };
    const content = String(input.content ?? '');
    const abs = resolveWithinWorkspace(ctx.workspaceRoot, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
    return { ok: true, output: `Wrote ${content.length} chars to ${rel}` };
  },
};
