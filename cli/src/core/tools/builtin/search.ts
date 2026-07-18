import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Tool } from '../types.js';
import { resolveWithinWorkspace } from '../workspace.js';

const IGNORE = new Set(['node_modules', '.git', 'dist', '.next', 'build']);
const MAX_HITS = 200;
const MAX_FILE_BYTES = 512 * 1024;

// Naive recursive substring search. A real ripgrep-style engine is a future
// extension point; this proves the tool contract and boundary enforcement.
async function walk(root: string, dir: string, query: string, hits: string[]): Promise<void> {
  if (hits.length >= MAX_HITS) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (hits.length >= MAX_HITS) return;
    if (IGNORE.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(root, abs, query, hits);
    } else if (e.isFile()) {
      const s = await stat(abs);
      if (s.size > MAX_FILE_BYTES) continue;
      let text: string;
      try {
        text = await readFile(abs, 'utf8');
      } catch {
        continue; // skip binary/unreadable
      }
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(query)) {
          hits.push(`${path.relative(root, abs)}:${i + 1}: ${lines[i].trim()}`);
          if (hits.length >= MAX_HITS) return;
        }
      }
    }
  }
}

export const searchTool: Tool = {
  name: 'search',
  description: 'Naive recursive substring search across workspace files.',
  mutating: false,
  async execute(input, ctx) {
    const query = String(input.query ?? '');
    if (!query) return { ok: false, output: 'search: "query" is required' };
    const rel = String(input.path ?? '.');
    const start = resolveWithinWorkspace(ctx.workspaceRoot, rel);
    const hits: string[] = [];
    await walk(ctx.workspaceRoot, start, query, hits);
    return {
      ok: true,
      output: hits.length ? hits.join('\n') : `No matches for "${query}"`,
      data: hits,
    };
  },
};
