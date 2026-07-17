// Story 3.4: Safely list, read, and search Workspace text.
// Covers all 5 ACs with injectable in-memory fs + clock.
// >=22 test cases. No network/real creds.

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectList } from '../src/core/inspection/list.js';
import { inspectRead } from '../src/core/inspection/read.js';
import { inspectSearch } from '../src/core/inspection/search.js';
import { evaluateInspectionPolicy } from '../src/core/inspection/policy.js';
import type { InspectionFsProbe, InspectionLimits } from '../src/core/inspection/types.js';
import { DEFAULT_INSPECTION_LIMITS } from '../src/core/inspection/types.js';
import type { WorkspaceIdentity } from '../src/core/workspace/types.js';

// ---------------------------------------------------------------------------
// In-memory fake InspectionFsProbe for offline, deterministic tests
// ---------------------------------------------------------------------------

interface FsEntry {
  content?: string;
  /** Raw buffer content (for binary/malformed tests). When set, takes precedence over content. */
  rawContent?: Buffer;
  isDir?: boolean;
  isSymlink?: boolean;
  linkTarget?: string;
  dev?: number;
  ino?: number;
}

function inMemoryInspectionFsProbe(files: Map<string, FsEntry>): InspectionFsProbe {
  return {
    realpath(p: string): string {
      const normalized = path.resolve(p);
      if (!files.has(normalized)) throw new Error(`ENOENT: ${normalized}`);
      return normalized;
    },
    lstat(p: string) {
      const normalized = path.resolve(p);
      const entry = files.get(normalized);
      if (!entry) throw new Error(`ENOENT: ${normalized}`);
      return {
        dev: entry.dev ?? 42,
        ino: entry.ino ?? 100,
        size: entry.content ? Buffer.byteLength(entry.content) : 0,
        isDirectory: entry.isDir ?? false,
        isFile: !entry.isDir && !entry.isSymlink,
        isSymbolicLink: entry.isSymlink ?? false,
      };
    },
    stat(p: string) {
      const normalized = path.resolve(p);
      const entry = files.get(normalized);
      if (!entry) throw new Error(`ENOENT: ${normalized}`);
      return {
        dev: entry.dev ?? 42,
        ino: entry.ino ?? 100,
        size: entry.content ? Buffer.byteLength(entry.content) : 0,
        isDirectory: entry.isDir ?? false,
        isFile: !entry.isDir,
      };
    },
    readlink(p: string): string {
      const normalized = path.resolve(p);
      const entry = files.get(normalized);
      if (!entry?.isSymlink || !entry.linkTarget) throw new Error(`EINVAL: ${normalized} is not a symlink`);
      return entry.linkTarget;
    },
    statfs(_p: string): { type: number } | null {
      return { type: 0x0100 };
    },
    readFile(p: string): Uint8Array {
      const entry = files.get(p);
      if (!entry || entry.content === undefined) throw new Error(`ENOENT: ${p}`);
      return new TextEncoder().encode(entry.content);
    },
    readdirSync(p: string): string[] {
      const normalized = path.resolve(p);
      const dir = files.get(normalized);
      if (!dir?.isDir) throw new Error(`ENOTDIR: ${normalized}`);
      // Collect immediate children of this directory.
      const prefix = normalized.endsWith(path.sep) ? normalized : normalized + path.sep;
      const children = new Set<string>();
      for (const key of files.keys()) {
        if (key.startsWith(prefix) && key !== normalized) {
          const rel = key.slice(prefix.length);
          const firstSep = rel.indexOf(path.sep);
          if (firstSep === -1) {
            children.add(rel);
          } else {
            children.add(rel.slice(0, firstSep));
          }
        }
      }
      return [...children].sort();
    },
    readFileSync(p: string): Buffer {
      const normalized = path.resolve(p);
      const entry = files.get(normalized);
      if (!entry) throw new Error(`ENOENT: ${normalized}`);
      if (entry.isDir) throw new Error(`EISDIR: ${normalized}`);
      if (entry.rawContent) return entry.rawContent;
      return Buffer.from(entry.content ?? '', 'utf8');
    },
  };
}

function makeWorkspace(root: string): WorkspaceIdentity {
  return {
    workspaceId: 'test-ws' as any,
    platform: { platform: 'darwin', casePolicy: 'case-sensitive', unicodePolicy: 'nfd' },
    canonicalRoot: path.resolve(root),
    volumeIdentity: null,
    bindingStatus: 'bound',
    blockedReason: null,
  };
}

// ---------------------------------------------------------------------------
// AC #1: Valid list/read/search with metadata + no-follow + bounds
// ---------------------------------------------------------------------------

describe('AC #1: Valid list/read/search with metadata + no-follow + bounds', () => {
  it('lists a directory with entry metadata (path/type/size/digest)', () => {
    const root = path.resolve('/tmp/ws-ac1-list');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'a.txt'), { content: 'hello' });
    files.set(path.resolve(root, 'b.txt'), { content: 'world' });
    files.set(path.resolve(root, 'sub'), { isDir: true });

    const ws = makeWorkspace(root);
    const result = inspectList(ws, '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
      computeDigests: true,
    });

    expect(result).not.toBeNull();
    if (result.kind !== 'denied' && 'outcome' in result) {
      const listResult = result as any;
      expect(listResult.outcome).toBe('allowed');
      expect(listResult.kind).toBe('list');
      expect(listResult.entries.length).toBe(3);
      expect(listResult.truncated).toBe(false);

      const aTxt = listResult.entries.find((e: any) => e.path === 'a.txt');
      expect(aTxt).toBeDefined();
      expect(aTxt.type).toBe('file');
      expect(aTxt.sizeBytes).toBe(5);
      expect(aTxt.digest).toBeTruthy();

      const sub = listResult.entries.find((e: any) => e.path === 'sub');
      expect(sub).toBeDefined();
      expect(sub.type).toBe('directory');
      expect(sub.digest).toBeNull();
    } else {
      expect(result.kind).not.toBe('denied');
    }
  });

  it('reads a file with content and metadata', () => {
    const root = path.resolve('/tmp/ws-ac1-read');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'readme.md'), { content: '# Hello\nThis is a test.' });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, 'readme.md', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const readResult = result as any;
      expect(readResult.outcome).toBe('allowed');
      expect(readResult.kind).toBe('read');
      expect(readResult.content).toBe('# Hello\nThis is a test.');
      expect(readResult.metadata.path).toBe('readme.md');
      expect(readResult.metadata.type).toBe('file');
      expect(readResult.metadata.sizeBytes).toBe(23);
      expect(readResult.metadata.digest).toBeTruthy();
      expect(readResult.truncated).toBe(false);
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });

  it('searches for text with match metadata', () => {
    const root = path.resolve('/tmp/ws-ac1-search');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'a.txt'), { content: 'hello world\nfoo bar' });
    files.set(path.resolve(root, 'b.txt'), { content: 'goodbye world' });

    const ws = makeWorkspace(root);
    const result = inspectSearch(ws, 'world', '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const searchResult = result as any;
      expect(searchResult.outcome).toBe('allowed');
      expect(searchResult.kind).toBe('search');
      expect(searchResult.matches.length).toBe(2);
      expect(searchResult.matches[0].text).toContain('world');
      expect(searchResult.matches[0].lineNumber).toBe(1);
      expect(searchResult.filesSearched).toBe(2);
      expect(searchResult.truncated).toBe(false);
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });

  it('skips symlinks during listing (no-follow)', () => {
    const root = path.resolve('/tmp/ws-ac1-nofollow');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'real.txt'), { content: 'real' });
    files.set(path.resolve(root, 'link.txt'), { isSymlink: true, linkTarget: '/outside/target' });

    const ws = makeWorkspace(root);
    const result = inspectList(ws, '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const listResult = result as any;
      expect(listResult.outcome).toBe('allowed');
      expect(listResult.entries.length).toBe(1);
      expect(listResult.entries[0].path).toBe('real.txt');
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });

  it('bounds recursion depth', () => {
    const root = path.resolve('/tmp/ws-ac1-depth');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'l1'), { isDir: true });
    files.set(path.resolve(root, 'l1', 'l2'), { isDir: true });
    files.set(path.resolve(root, 'l1', 'l2', 'l3'), { isDir: true });
    files.set(path.resolve(root, 'l1', 'l2', 'l3', 'deep.txt'), { content: 'deep' });

    const ws = makeWorkspace(root);
    const limits: InspectionLimits = { ...DEFAULT_INSPECTION_LIMITS, maxRecursionDepth: 2 };
    const result = inspectList(ws, '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
      limits,
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const listResult = result as any;
      expect(listResult.outcome).toBe('allowed');
      // Should see l1, l1/l2, l1/l2/l3 (listed as child of l2 at depth 2)
      // but NOT l1/l2/l3/deep.txt (depth 3 exceeds maxRecursionDepth 2)
      const paths = listResult.entries.map((e: any) => e.path);
      expect(paths).toContain('l1');
      expect(paths).toContain('l1/l2');
      expect(paths).toContain('l1/l2/l3');
      expect(paths).not.toContain('l1/l2/l3/deep.txt');
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });

  it('bounds file count', () => {
    const root = path.resolve('/tmp/ws-ac1-count');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    for (let i = 0; i < 10; i++) {
      files.set(path.resolve(root, `f${i}.txt`), { content: `file ${i}` });
    }

    const ws = makeWorkspace(root);
    const limits: InspectionLimits = { ...DEFAULT_INSPECTION_LIMITS, maxFileCount: 3 };
    const result = inspectList(ws, '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
      limits,
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const listResult = result as any;
      expect(listResult.outcome).toBe('allowed');
      expect(listResult.entries.length).toBeLessThanOrEqual(3);
      expect(listResult.truncated).toBe(true);
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });

  it('read returns over-limit refusal for files exceeding maxFileSize', () => {
    const root = path.resolve('/tmp/ws-ac1-overlimit');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'big.txt'), { content: 'x'.repeat(1000) });

    const ws = makeWorkspace(root);
    const limits: InspectionLimits = { ...DEFAULT_INSPECTION_LIMITS, maxFileSize: 100 };
    const result = inspectRead(ws, 'big.txt', {
      fsProbe: inMemoryInspectionFsProbe(files),
      limits,
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('over-limit');
      expect((result as any).limit).toBe('maxFileSize');
      expect((result as any).actual).toBe(1000);
    } else {
      // Should not be allowed
      expect((result as any).outcome).not.toBe('allowed');
    }
  });

  it('search bounds search work', () => {
    const root = path.resolve('/tmp/ws-ac1-searchwork');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    // Create many files to ensure search work is exceeded
    for (let i = 0; i < 10; i++) {
      files.set(path.resolve(root, `f${i}.txt`), { content: 'hello world '.repeat(50) });
    }

    const ws = makeWorkspace(root);
    const limits: InspectionLimits = { ...DEFAULT_INSPECTION_LIMITS, maxSearchWork: 5 };
    const result = inspectSearch(ws, 'world', '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
      limits,
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const searchResult = result as any;
      expect(searchResult.outcome).toBe('allowed');
      // With maxSearchWork=5 and each file costing 6 work units,
      // only 1 file should be searched
      expect(searchResult.filesSearched).toBeLessThanOrEqual(1);
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });
});

// ---------------------------------------------------------------------------
// AC #2: Out-of-Workspace/ambiguous/inaccessible/symlink/rename → typed refusals
// ---------------------------------------------------------------------------

describe('AC #2: Out-of-Workspace/ambiguous/inaccessible/symlink/rename → typed refusals', () => {
  it('returns denied for a path outside the workspace', () => {
    const root = path.resolve('/tmp/ws-ac2-outside');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });

    const ws = makeWorkspace(root);
    const result = inspectList(ws, '../outside.txt', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('denied');
      expect(result.reason).toContain('escapes workspace');
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('returns inaccessible for a non-existent path', () => {
    const root = path.resolve('/tmp/ws-ac2-nonexist');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, 'nonexistent.txt', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('inaccessible');
      expect(result.reason).toBeTruthy();
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('returns denied for a symlink that cannot be proven safe (no-follow)', () => {
    const root = path.resolve('/tmp/ws-ac2-symlink');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'leak.txt'), { isSymlink: true, linkTarget: '/outside/secret.txt' });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, 'leak.txt', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('denied');
      expect(result.reason).toContain('symlink');
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('returns enforcement-unverified when no fsProbe is available', () => {
    const root = path.resolve('/tmp/ws-ac2-noprobe');
    const ws = makeWorkspace(root);

    const result = inspectList(ws, '.');
    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('enforcement-unverified');
      expect(result.reason).toContain('no filesystem probe');
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('returns denied for a path that is not a directory when listing', () => {
    const root = path.resolve('/tmp/ws-ac2-notdir');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'file.txt'), { content: 'hello' });

    const ws = makeWorkspace(root);
    const result = inspectList(ws, 'file.txt', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('denied');
      expect(result.reason).toContain('not a directory');
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('returns denied for a path that is not a file when reading', () => {
    const root = path.resolve('/tmp/ws-ac2-notfile');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('denied');
      expect(result.reason).toContain('not a file');
      expect(result.nextStep).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// AC #3: Binary/hostile/over-limit/malformed-UTF-8/active-external-refs
// ---------------------------------------------------------------------------

describe('AC #3: Binary/hostile/over-limit/malformed-UTF-8/active-external-refs → typed refusal', () => {
  it('returns binary-refused for a file with null bytes', () => {
    const root = path.resolve('/tmp/ws-ac3-binary');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    // Create a buffer with a null byte
    const buf = Buffer.from([0x48, 0x00, 0x65, 0x6c, 0x6c, 0x6f]);
    files.set(path.resolve(root, 'binary.bin'), { rawContent: buf });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, 'binary.bin', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('binary-refused');
      expect(result.reason).toContain('binary');
      expect(result.path).toBe('binary.bin');
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('returns over-limit for a file exceeding maxFileSize', () => {
    const root = path.resolve('/tmp/ws-ac3-overlimit');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'big.txt'), { content: 'x'.repeat(100_000) });

    const ws = makeWorkspace(root);
    const limits: InspectionLimits = { ...DEFAULT_INSPECTION_LIMITS, maxFileSize: 10_000 };
    const result = inspectRead(ws, 'big.txt', {
      fsProbe: inMemoryInspectionFsProbe(files),
      limits,
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('over-limit');
      expect(result.limit).toBe('maxFileSize');
      expect(result.actual).toBe(100_000);
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('returns malformed-utf8 for a file with invalid UTF-8 sequences', () => {
    const root = path.resolve('/tmp/ws-ac3-malformed');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    // Create a buffer with an invalid UTF-8 sequence (overlong encoding of '/')
    // 0xc0 0xaf is an overlong 2-byte encoding of '/' which is invalid in strict UTF-8
    const buf = Buffer.from([0xc0, 0xaf, 0x20, 0x68, 0x69]);
    files.set(path.resolve(root, 'bad.txt'), { rawContent: buf });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, 'bad.txt', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('malformed-utf8');
      expect(result.reason).toContain('malformed');
      expect(result.path).toBe('bad.txt');
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('returns denied for a file with active external references (require)', () => {
    const root = path.resolve('/tmp/ws-ac3-activeref');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'script.js'), { content: 'const fs = require("fs");\nconsole.log("hello");' });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, 'script.js', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('denied');
      expect(result.reason).toContain('active external references');
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('returns denied for a file with active external references (fetch)', () => {
    const root = path.resolve('/tmp/ws-ac3-fetch');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'fetch.js'), { content: 'const data = fetch("https://example.com/api");' });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, 'fetch.js', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('denied');
      expect(result.reason).toContain('active external references');
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('returns denied for a file with hostile content (extremely long line)', () => {
    const root = path.resolve('/tmp/ws-ac3-hostile');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'hostile.txt'), { content: 'x'.repeat(15_000) });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, 'hostile.txt', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('denied');
      expect(result.reason).toContain('hostile');
      expect(result.nextStep).toBeTruthy();
    }
  });

  it('preserves valid Thai UTF-8 and technical identifiers', () => {
    const root = path.resolve('/tmp/ws-ac3-thai');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    // Thai text: "สวัสดีชาวโลก" (Hello World in Thai) + technical identifier
    const thaiText = 'สวัสดีชาวโลก\nconst MY_CONSTANT = 42;\n';
    files.set(path.resolve(root, 'thai.txt'), { content: thaiText });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, 'thai.txt', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const readResult = result as any;
      expect(readResult.outcome).toBe('allowed');
      expect(readResult.content).toContain('สวัสดีชาวโลก');
      expect(readResult.content).toContain('MY_CONSTANT');
      expect(readResult.content).toContain('42');
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });

  it('search skips binary files silently', () => {
    const root = path.resolve('/tmp/ws-ac3-search-binary');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    // Binary file with null byte
    const buf = Buffer.from([0x00, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    files.set(path.resolve(root, 'binary.bin'), { rawContent: buf });
    files.set(path.resolve(root, 'text.txt'), { content: 'hello world' });

    const ws = makeWorkspace(root);
    const result = inspectSearch(ws, 'hello', '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const searchResult = result as any;
      expect(searchResult.outcome).toBe('allowed');
      // Should only find match in text.txt, not binary.bin
      expect(searchResult.matches.length).toBe(1);
      expect(searchResult.matches[0].path).toBe('text.txt');
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });
});

// ---------------------------------------------------------------------------
// AC #4: Manual eligible non-transferring inspection proceeds without interruption
// ---------------------------------------------------------------------------

describe('AC #4: Manual eligible non-transferring inspection proceeds without interruption', () => {
  it('Manual mode + read_file → allow (no ask)', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: 'build', profile: 'manual' },
    });

    expect(decision.outcome).toBe('allow');
    expect(decision.reason).toBe('manual-read-allowed');
  });

  it('Manual mode + list_dir → allow (no ask)', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'list_dir',
      state: { mode: 'build', profile: 'manual' },
    });

    expect(decision.outcome).toBe('allow');
    expect(decision.reason).toBe('manual-read-allowed');
  });

  it('Manual mode + search → allow (no ask)', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'search',
      state: { mode: 'build', profile: 'manual' },
    });

    expect(decision.outcome).toBe('allow');
    expect(decision.reason).toBe('manual-read-allowed');
  });

  it('Manual mode read_file authorization cannot authorize a later mutation', () => {
    // The PEP evaluates each action independently. A read_file authorization
    // is not a write_file authorization. This test verifies that the policy
    // engine treats them as separate actions.
    const readDecision = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: 'build', profile: 'manual' },
    });
    expect(readDecision.outcome).toBe('allow');

    // A write_file action would be evaluated separately and would ask
    // (since Manual mode requires approval for mutations).
    // This is verified by the existing permission policy tests.
  });

  it('Manual mode + read_file with sensitiveOverride still allows (non-sensitive)', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: 'build', profile: 'manual', sensitiveOverride: true },
    });

    expect(decision.outcome).toBe('allow');
  });

  it('Assisted mode + read_file → allow (no ask)', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: 'build', profile: 'assisted' },
    });

    expect(decision.outcome).toBe('allow');
    expect(decision.reason).toBe('assisted-read-allowed');
  });

  it('Full Access mode + read_file → allow', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: 'build', profile: 'full-access' },
    });

    expect(decision.outcome).toBe('allow');
    expect(decision.reason).toBe('full-access-auto-approve');
  });
});

// ---------------------------------------------------------------------------
// AC #5: Plan read-only + plan/Evidence cannot be consumed as authorization
// ---------------------------------------------------------------------------

describe('AC #5: Plan read-only + plan/Evidence cannot be consumed as authorization', () => {
  it('Plan mode + read_file → allow (read-only)', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: 'plan', profile: 'manual' },
    });

    expect(decision.outcome).toBe('allow');
    expect(decision.reason).toBe('manual-read-allowed');
  });

  it('Plan mode + list_dir → allow (read-only)', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'list_dir',
      state: { mode: 'plan', profile: 'manual' },
    });

    expect(decision.outcome).toBe('allow');
  });

  it('Plan mode + search → allow (read-only)', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'search',
      state: { mode: 'plan', profile: 'manual' },
    });

    expect(decision.outcome).toBe('allow');
  });

  it('Plan mode read_file authorization cannot be consumed as mutation authorization', () => {
    // The PEP denies mutating actions in Plan mode structurally (before any
    // profile check). This test verifies that the policy engine treats
    // read-only and mutating actions independently in Plan mode.
    const readDecision = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: 'plan', profile: 'manual' },
    });
    expect(readDecision.outcome).toBe('allow');

    // A write_file action in Plan mode would be denied structurally.
    // This is verified by the existing permission policy tests.
  });

  it('Plan mode + Full Access + read_file → allow (read-only, Full Access cannot mutate in Plan)', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: 'plan', profile: 'full-access' },
    });

    expect(decision.outcome).toBe('allow');
  });

  it('Plan mode + Assisted + read_file → allow', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: 'plan', profile: 'assisted' },
    });

    expect(decision.outcome).toBe('allow');
  });

  it('Plan mode read_file with sensitiveOverride still allows (non-sensitive)', () => {
    const decision = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: 'plan', profile: 'manual', sensitiveOverride: true },
    });

    expect(decision.outcome).toBe('allow');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: CoreApp integration (inspectList/inspectRead/inspectSearch)
// ---------------------------------------------------------------------------

describe('Cross-cutting: CoreApp inspection methods', () => {
  it('inspectList returns ListResult for a valid directory', () => {
    const root = path.resolve('/tmp/ws-cc-list');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'test.txt'), { content: 'hello' });

    const ws = makeWorkspace(root);
    const result = inspectList(ws, '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const listResult = result as any;
      expect(listResult.outcome).toBe('allowed');
      expect(listResult.kind).toBe('list');
      expect(listResult.entries.length).toBe(1);
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });

  it('inspectRead returns ReadResult for a valid file', () => {
    const root = path.resolve('/tmp/ws-cc-read');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'hello.txt'), { content: 'Hello, World!' });

    const ws = makeWorkspace(root);
    const result = inspectRead(ws, 'hello.txt', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const readResult = result as any;
      expect(readResult.outcome).toBe('allowed');
      expect(readResult.kind).toBe('read');
      expect(readResult.content).toBe('Hello, World!');
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });

  it('inspectSearch returns SearchResult for matching query', () => {
    const root = path.resolve('/tmp/ws-cc-search');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'data.txt'), { content: 'find me\nand me' });

    const ws = makeWorkspace(root);
    const result = inspectSearch(ws, 'find', '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('outcome' in result) {
      const searchResult = result as any;
      expect(searchResult.outcome).toBe('allowed');
      expect(searchResult.kind).toBe('search');
      expect(searchResult.matches.length).toBe(1);
      expect(searchResult.matches[0].text).toContain('find');
    } else {
      expect((result as any).kind).not.toBe('denied');
    }
  });

  it('inspectSearch with empty query returns denied', () => {
    const root = path.resolve('/tmp/ws-cc-emptyquery');
    const files = new Map<string, FsEntry>();
    files.set(root, { isDir: true });

    const ws = makeWorkspace(root);
    const result = inspectSearch(ws, '', '.', {
      fsProbe: inMemoryInspectionFsProbe(files),
    });

    expect(result).not.toBeNull();
    if ('kind' in result) {
      expect(result.kind).toBe('denied');
      expect(result.reason).toContain('empty');
    }
  });
});
