import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveWithinWorkspace,
  WorkspaceBoundaryError,
} from '../src/core/tools/workspace.js';
import { createDefaultToolRegistry, PlanModeToolRefusedError } from '../src/core/tools/registry.js';

const ROOT = process.platform === 'win32' ? 'C:\\work\\repo' : '/work/repo';

describe('workspace boundary check', () => {
  it('resolves a simple relative path inside the workspace', () => {
    const p = resolveWithinWorkspace(ROOT, 'src/index.ts');
    expect(p).toBe(path.join(path.resolve(ROOT), 'src', 'index.ts'));
  });

  it('allows the workspace root itself', () => {
    expect(resolveWithinWorkspace(ROOT, '.')).toBe(path.resolve(ROOT));
  });

  it('rejects .. traversal escapes', () => {
    expect(() => resolveWithinWorkspace(ROOT, '../outside.txt')).toThrow(WorkspaceBoundaryError);
    expect(() => resolveWithinWorkspace(ROOT, 'a/../../outside.txt')).toThrow(WorkspaceBoundaryError);
  });

  it('rejects absolute paths outside the workspace', () => {
    const outside = process.platform === 'win32' ? 'C:\\Windows\\system32' : '/etc/passwd';
    expect(() => resolveWithinWorkspace(ROOT, outside)).toThrow(WorkspaceBoundaryError);
  });

  it('allows absolute paths inside the workspace', () => {
    const inside = path.join(path.resolve(ROOT), 'deep', 'file.txt');
    expect(resolveWithinWorkspace(ROOT, inside)).toBe(inside);
  });

  it('handles .. that stays inside the workspace', () => {
    const p = resolveWithinWorkspace(ROOT, 'src/../docs/readme.md');
    expect(p).toBe(path.join(path.resolve(ROOT), 'docs', 'readme.md'));
  });

  if (process.platform === 'win32') {
    it('rejects a different drive letter (cross-drive escape)', () => {
      expect(() => resolveWithinWorkspace('C:\\work\\repo', 'E:\\other\\file.txt')).toThrow(
        WorkspaceBoundaryError,
      );
    });
    it('is case-insensitive on Windows paths', () => {
      const p = resolveWithinWorkspace('C:\\Work\\Repo', 'C:\\work\\repo\\file.txt');
      expect(p.toLowerCase()).toContain('file.txt');
    });
  }
});

describe('tool registry plan-mode structural refusal', () => {
  const reg = createDefaultToolRegistry();

  it('every tool declares mutating explicitly', () => {
    for (const t of reg.list()) {
      expect(typeof t.mutating).toBe('boolean');
    }
  });

  it('refuses mutating tools in plan mode regardless of profile', () => {
    expect(() => reg.resolveForMode('write_file', 'plan')).toThrow(PlanModeToolRefusedError);
    expect(() => reg.resolveForMode('run_command', 'plan')).toThrow(PlanModeToolRefusedError);
  });

  it('permits read-only tools in plan mode', () => {
    expect(reg.resolveForMode('read_file', 'plan').name).toBe('read_file');
    expect(reg.resolveForMode('list_dir', 'plan').name).toBe('list_dir');
    expect(reg.resolveForMode('search', 'plan').name).toBe('search');
  });

  it('permits mutating tools in build mode (policy engine still gates them)', () => {
    expect(reg.resolveForMode('write_file', 'build').name).toBe('write_file');
  });

  it('hides mutating tools from the plan-mode tool list', () => {
    const names = reg.listForMode('plan').map((t) => t.name);
    expect(names).not.toContain('write_file');
    expect(names).not.toContain('run_command');
    expect(names).toContain('read_file');
  });
});
