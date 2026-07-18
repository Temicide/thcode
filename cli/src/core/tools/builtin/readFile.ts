import { readFile } from 'node:fs/promises';
import type { Tool } from '../types.js';
import { resolveWithinWorkspace } from '../workspace.js';
import { redactSecrets } from '../../security/redact.js';

const MAX_BYTES = 256 * 1024;

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read a UTF-8 text file inside the workspace.',
  mutating: false,
  async execute(input, ctx) {
    const rel = String(input.path ?? '');
    if (!rel) return { ok: false, output: 'read_file: "path" is required' };
    const abs = resolveWithinWorkspace(ctx.workspaceRoot, rel);
    const buf = await readFile(abs);
    const clipped = buf.subarray(0, MAX_BYTES).toString('utf8');
    const note = buf.byteLength > MAX_BYTES ? '\n[...truncated...]' : '';
    return { ok: true, output: redactSecrets(clipped) + note };
  },
};
