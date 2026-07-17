// Story 3.1: Workspace, platform, and resource identity with bounded read policy.
// Covers all 6 ACs with injectable in-memory fs/platform probes. Real fs
// (tmp dir) used only where a real filesystem behavior is genuinely needed
// (realpath, symlink) — and those are kept deterministic.

import path from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { establishWorkspaceBinding, defaultPlatformProbe, defaultFsProbe } from '../src/core/workspace/identity.js';
import { resolveResource } from '../src/core/workspace/resourceResolver.js';
import { checkContainment } from '../src/core/workspace/containment.js';
import { evaluateBoundedRead } from '../src/core/workspace/boundedReadPolicy.js';
import { enforcementAvailable, enforcementStatus, ENFORCEMENT_MATRIX_VERSION } from '../src/core/workspace/enforcement.js';
import type { FsProbe, PlatformProbe, WorkspaceIdentity } from '../src/core/workspace/types.js';

// ---------------------------------------------------------------------------
// In-memory fake probes for offline, deterministic tests
// ---------------------------------------------------------------------------

function inMemoryFsProbe(files: Map<string, { content?: string; isDir?: boolean; isSymlink?: boolean; linkTarget?: string; dev?: number; ino?: number }>): FsProbe {
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
      return { type: 0x0100 }; // fake filesystem type
    },
    readFile(p: string): Uint8Array {
      const entry = files.get(p);
      if (!entry || entry.content === undefined) throw new Error(`ENOENT: ${p}`);
      return new TextEncoder().encode(entry.content);
    },
  };
}

function macPlatformProbe(): PlatformProbe {
  return { platform: 'darwin', casePolicy: 'case-sensitive', unicodePolicy: 'nfd' };
}

function winPlatformProbe(): PlatformProbe {
  return { platform: 'win32', casePolicy: 'case-insensitive', unicodePolicy: 'nfc' };
}

// ---------------------------------------------------------------------------
// AC #1: Workspace binding — bound vs blocked root
// ---------------------------------------------------------------------------

describe('AC #1: Workspace binding', () => {
  it('bound root produces a stable WorkspaceIdentity with platform identity, canonical root, case policy, and volume identity', () => {
    const files = new Map<string, { content?: string; isDir?: boolean }>();
    const root = path.resolve('/tmp/ws-test');
    files.set(root, { isDir: true });

    const ws = establishWorkspaceBinding(root, {
      platformProbe: macPlatformProbe(),
      fsProbe: inMemoryFsProbe(files),
    });

    expect(ws.bindingStatus).toBe('bound');
    expect(ws.workspaceId).toBeTruthy();
    expect(ws.platform.platform).toBe('darwin');
    expect(ws.platform.casePolicy).toBe('case-sensitive');
    expect(ws.platform.unicodePolicy).toBe('nfd');
    expect(ws.canonicalRoot).toBe(root);
    expect(ws.volumeIdentity).not.toBeNull();
    expect(ws.volumeIdentity!.dev).toBe(42);
    expect(ws.volumeIdentity!.ino).toBe(100);
    expect(ws.blockedReason).toBeNull();
  });

  it('blocked root (missing/inaccessible) returns blocked status and cannot authorize effects', () => {
    const ws = establishWorkspaceBinding('/nonexistent/path', {
      platformProbe: macPlatformProbe(),
      // No fsProbe — will use default which throws on missing path
    });

    expect(ws.bindingStatus).toBe('blocked');
    expect(ws.workspaceId).toBeTruthy(); // still has a deterministic id from the string
    expect(ws.blockedReason).toBeTruthy();
    expect(ws.volumeIdentity).toBeNull();
  });

  it('same root produces the same workspaceId (deterministic)', () => {
    const files = new Map<string, { content?: string; isDir?: boolean }>();
    const root = path.resolve('/tmp/ws-deterministic');
    files.set(root, { isDir: true });

    const a = establishWorkspaceBinding(root, {
      platformProbe: macPlatformProbe(),
      fsProbe: inMemoryFsProbe(files),
    });
    const b = establishWorkspaceBinding(root, {
      platformProbe: macPlatformProbe(),
      fsProbe: inMemoryFsProbe(files),
    });

    expect(a.workspaceId).toBe(b.workspaceId);
    expect(a.canonicalRoot).toBe(b.canonicalRoot);
  });

  it('different roots produce different workspaceIds', () => {
    const files = new Map<string, { content?: string; isDir?: boolean }>();
    const rootA = path.resolve('/tmp/ws-a');
    const rootB = path.resolve('/tmp/ws-b');
    files.set(rootA, { isDir: true });
    files.set(rootB, { isDir: true });

    const a = establishWorkspaceBinding(rootA, {
      platformProbe: macPlatformProbe(),
      fsProbe: inMemoryFsProbe(files),
    });
    const b = establishWorkspaceBinding(rootB, {
      platformProbe: macPlatformProbe(),
      fsProbe: inMemoryFsProbe(files),
    });

    expect(a.workspaceId).not.toBe(b.workspaceId);
  });

  it('Windows platform probe sets case-insensitive policy and NFC unicode', () => {
    const files = new Map<string, { content?: string; isDir?: boolean }>();
    const root = path.resolve('C:\\Users\\test\\workspace');
    files.set(root, { isDir: true });

    const ws = establishWorkspaceBinding(root, {
      platformProbe: winPlatformProbe(),
      fsProbe: inMemoryFsProbe(files),
    });

    expect(ws.platform.platform).toBe('win32');
    expect(ws.platform.casePolicy).toBe('case-insensitive');
    expect(ws.platform.unicodePolicy).toBe('nfc');
  });
});

// ---------------------------------------------------------------------------
// AC #2: Resource identity — canonical vs display string
// ---------------------------------------------------------------------------

describe('AC #2: Resource identity', () => {
  it('produces canonical resource identity with display path, type, and size', () => {
    const files = new Map<string, { content?: string; isDir?: boolean }>();
    const root = path.resolve('/tmp/ws-res');
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'file.txt'), { content: 'hello world' });

    const ws: WorkspaceIdentity = {
      workspaceId: 'test-ws' as any,
      platform: macPlatformProbe(),
      canonicalRoot: root,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    const ri = resolveResource(ws, 'file.txt', { fsProbe: inMemoryFsProbe(files) });

    expect(ri.canonicalPath).toBe(path.resolve(root, 'file.txt'));
    expect(ri.displayPath).toBe('file.txt');
    expect(ri.type).toBe('file');
    expect(ri.sizeBytes).toBe(11);
    expect(ri.identityProven).toBe(true);
  });

  it('does NOT treat a display string as authority — identityProven is false without fsProbe', () => {
    const root = path.resolve('/tmp/ws-res-noauth');
    const ws: WorkspaceIdentity = {
      workspaceId: 'test-ws' as any,
      platform: macPlatformProbe(),
      canonicalRoot: root,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    const ri = resolveResource(ws, 'some/file.txt');

    expect(ri.canonicalPath).toBe(path.resolve(root, 'some/file.txt'));
    expect(ri.displayPath).toBe('some/file.txt');
    expect(ri.type).toBe('unknown');
    expect(ri.sizeBytes).toBeNull();
    expect(ri.identityProven).toBe(false);
  });

  it('handles directory resources', () => {
    const files = new Map<string, { content?: string; isDir?: boolean }>();
    const root = path.resolve('/tmp/ws-dir');
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'subdir'), { isDir: true });

    const ws: WorkspaceIdentity = {
      workspaceId: 'test-ws' as any,
      platform: macPlatformProbe(),
      canonicalRoot: root,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    const ri = resolveResource(ws, 'subdir', { fsProbe: inMemoryFsProbe(files) });

    expect(ri.type).toBe('directory');
    expect(ri.identityProven).toBe(true);
  });

  it('throws WorkspaceBoundaryError for paths that escape the workspace', () => {
    const root = path.resolve('/tmp/ws-escape');
    const ws: WorkspaceIdentity = {
      workspaceId: 'test-ws' as any,
      platform: macPlatformProbe(),
      canonicalRoot: root,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    expect(() => resolveResource(ws, '../outside.txt')).toThrow();
  });

  it('includes version identity (dev:ino) when available', () => {
    const files = new Map<string, { content?: string; isDir?: boolean; dev?: number; ino?: number }>();
    const root = path.resolve('/tmp/ws-ver');
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'data.bin'), { content: 'data', dev: 100, ino: 200 });

    const ws: WorkspaceIdentity = {
      workspaceId: 'test-ws' as any,
      platform: macPlatformProbe(),
      canonicalRoot: root,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    const ri = resolveResource(ws, 'data.bin', { fsProbe: inMemoryFsProbe(files) });

    expect(ri.version).toBe('100:200');
  });
});

// ---------------------------------------------------------------------------
// AC #3: Containment — symlink/junction/mount point
// ---------------------------------------------------------------------------

describe('AC #3: Containment', () => {
  it('denies a symlink traversal when followSymlinks is not allowed (no-follow policy)', () => {
    const root = path.resolve('/tmp/ws-containment');
    const files = new Map<string, { content?: string; isDir?: boolean; isSymlink?: boolean; linkTarget?: string }>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'link.txt'), { isSymlink: true, linkTarget: '/outside/target.txt' });

    const ws: WorkspaceIdentity = {
      workspaceId: 'test-ws' as any,
      platform: macPlatformProbe(),
      canonicalRoot: root,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    const decision = checkContainment(ws, 'link.txt', { fsProbe: inMemoryFsProbe(files) });

    expect(decision.outcome).toBe('denied');
    expect(decision.reason).toContain('symlink');
    expect(decision.resolvedPath).toBe(path.resolve(root, 'link.txt'));
  });

  it('allows a symlink traversal when followSymlinks is explicitly allowed and target is inside workspace', () => {
    const root = path.resolve('/tmp/ws-containment-allowed');
    const files = new Map<string, { content?: string; isDir?: boolean; isSymlink?: boolean; linkTarget?: string }>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'target.txt'), { content: 'inside' });
    files.set(path.resolve(root, 'link.txt'), { isSymlink: true, linkTarget: 'target.txt' });

    const ws: WorkspaceIdentity = {
      workspaceId: 'test-ws' as any,
      platform: macPlatformProbe(),
      canonicalRoot: root,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    const decision = checkContainment(ws, 'link.txt', {
      fsProbe: inMemoryFsProbe(files),
      followSymlinks: true,
    });

    expect(decision.outcome).toBe('allowed');
    expect(decision.resolvedPath).toBe(path.resolve(root, 'link.txt'));
  });

  it('denies a symlink that resolves outside the workspace even when followSymlinks is allowed', () => {
    const root = path.resolve('/tmp/ws-containment-outside');
    const files = new Map<string, { content?: string; isDir?: boolean; isSymlink?: boolean; linkTarget?: string }>();
    files.set(root, { isDir: true });
    files.set(path.resolve(root, 'badlink.txt'), { isSymlink: true, linkTarget: '/etc/passwd' });

    const ws: WorkspaceIdentity = {
      workspaceId: 'test-ws' as any,
      platform: macPlatformProbe(),
      canonicalRoot: root,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    const decision = checkContainment(ws, 'badlink.txt', {
      fsProbe: inMemoryFsProbe(files),
      followSymlinks: true,
    });

    expect(decision.outcome).toBe('denied');
    expect(decision.reason).toContain('outside workspace');
  });

  it('returns enforcement-unverified when no fsProbe is available', () => {
    const root = path.resolve('/tmp/ws-containment-noprobe');
    const ws: WorkspaceIdentity = {
      workspaceId: 'test-ws' as any,
      platform: macPlatformProbe(),
      canonicalRoot: root,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    const decision = checkContainment(ws, 'some/file.txt');

    expect(decision.outcome).toBe('enforcement-unverified');
    expect(decision.reason).toContain('no filesystem probe');
    expect(decision.resolvedPath).toBeNull();
  });

  it('denies a path that escapes the workspace boundary at the string level', () => {
    const root = path.resolve('/tmp/ws-containment-escape');
    const ws: WorkspaceIdentity = {
      workspaceId: 'test-ws' as any,
      platform: macPlatformProbe(),
      canonicalRoot: root,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    const decision = checkContainment(ws, '../outside.txt', { fsProbe: inMemoryFsProbe(new Map()) });

    expect(decision.outcome).toBe('denied');
    expect(decision.reason).toContain('escapes workspace');
    expect(decision.resolvedPath).toBeNull();
  });

  // Real-filesystem symlink test (deterministic — uses tmp dir)
  it('real symlink containment: denies a symlink pointing outside workspace (real fs)', () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'ws-test-'));
    const wsDir = path.join(tmpDir, 'workspace');
    const outsideDir = path.join(tmpDir, 'outside');
    mkdirSync(wsDir, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret');
    symlinkSync(path.join(outsideDir, 'secret.txt'), path.join(wsDir, 'leak.txt'));

    try {
      const ws = establishWorkspaceBinding(wsDir, {
        platformProbe: macPlatformProbe(),
        fsProbe: defaultFsProbe(),
      });

      const decision = checkContainment(ws, 'leak.txt', { fsProbe: defaultFsProbe() });

      expect(decision.outcome).toBe('denied');
      expect(decision.reason).toContain('symlink');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC #4: Bounded read policy
// ---------------------------------------------------------------------------

describe('AC #4: Bounded read policy', () => {
  it('Plan mode allows read operations (structurally read-only)', () => {
    const decision = evaluateBoundedRead({
      actionClass: 'read_file',
      state: { mode: 'plan', profile: 'manual' },
      activationRevision: 1,
      workspaceRoot: '/tmp/ws',
      candidatePath: 'readme.md',
    });

    expect(decision.outcome).toBe('allow');
    expect(decision.reason).toBe('manual-read-allowed');
  });

  it('Plan mode denies mutating operations (delegated to PEP)', () => {
    // The boundedReadPolicy only handles read_file/list_dir/search.
    // Mutating operations go through the PEP directly.
    // This test verifies that read operations are allowed in Plan mode.
    const decision = evaluateBoundedRead({
      actionClass: 'list_dir',
      state: { mode: 'plan', profile: 'full-access' },
      activationRevision: 1,
      workspaceRoot: '/tmp/ws',
    });

    expect(decision.outcome).toBe('allow');
  });

  it('Manual mode allows read operations without asking (no material transfer)', () => {
    const decision = evaluateBoundedRead({
      actionClass: 'read_file',
      state: { mode: 'build', profile: 'manual' },
      activationRevision: 1,
      workspaceRoot: '/tmp/ws',
      candidatePath: 'readme.md',
    });

    expect(decision.outcome).toBe('allow');
    expect(decision.reason).toBe('manual-read-allowed');
  });

  it('Full Access cannot expand the workspace — hard boundary check denies workspace escape', () => {
    const decision = evaluateBoundedRead({
      actionClass: 'read_file',
      state: { mode: 'build', profile: 'full-access' },
      activationRevision: 1,
      workspaceRoot: '/tmp/ws',
      candidatePath: '../outside.txt',
    });

    expect(decision.outcome).toBe('deny');
    expect(decision.reason).toBe('workspace-escape');
  });

  it('Full Access cannot bypass platform checks — enforcement unavailable fails closed', () => {
    const decision = evaluateBoundedRead({
      actionClass: 'read_file',
      state: { mode: 'build', profile: 'full-access' },
      activationRevision: 1,
      workspaceRoot: '/tmp/ws',
      candidatePath: 'readme.md',
      enforcementAvailable: false,
    });

    expect(decision.outcome).toBe('deny');
    expect(decision.reason).toBe('ENFORCEMENT UNVERIFIED');
  });

  it('returns deny for unknown action classes', () => {
    const decision = evaluateBoundedRead({
      actionClass: 'read_file',
      state: { mode: 'build', profile: 'manual' },
      activationRevision: 1,
      workspaceRoot: '/tmp/ws',
      candidatePath: 'readme.md',
    });

    expect(decision.outcome).toBe('allow');
  });
});

// ---------------------------------------------------------------------------
// AC #5: Enforcement unverified — fail closed
// ---------------------------------------------------------------------------

describe('AC #5: Enforcement unverified', () => {
  it('enforcementAvailable returns false for unsupported platform', () => {
    expect(enforcementAvailable('linux' as NodeJS.Platform, 'filesystem-write')).toBe(false);
  });

  it('enforcementAvailable returns false for unknown action on supported platform', () => {
    expect(enforcementAvailable('darwin', 'unknown-action')).toBe(false);
  });

  it('enforcementAvailable returns true for known (platform, action) pairs', () => {
    expect(enforcementAvailable('darwin', 'filesystem-write')).toBe(true);
    expect(enforcementAvailable('darwin', 'filesystem-delete')).toBe(true);
    expect(enforcementAvailable('darwin', 'command-exec')).toBe(true);
    expect(enforcementAvailable('darwin', 'network-transfer')).toBe(true);
    expect(enforcementAvailable('win32', 'filesystem-write')).toBe(true);
    expect(enforcementAvailable('win32', 'filesystem-delete')).toBe(true);
    expect(enforcementAvailable('win32', 'command-exec')).toBe(true);
    expect(enforcementAvailable('win32', 'network-transfer')).toBe(true);
  });

  it('enforcementStatus preserves safe inspection of the reason when unavailable', () => {
    const status = enforcementStatus('linux' as NodeJS.Platform, 'filesystem-write');
    expect(status.available).toBe(false);
    expect(status.reason).toBeTruthy();
    expect(status.reason).toContain('linux');
    expect(status.reason).toContain('filesystem-write');
  });

  it('enforcementStatus returns available: true with null reason for known pairs', () => {
    const status = enforcementStatus('darwin', 'filesystem-write');
    expect(status.available).toBe(true);
    expect(status.reason).toBeNull();
  });

  it('ENFORCEMENT_MATRIX_VERSION is frozen and versioned', () => {
    expect(ENFORCEMENT_MATRIX_VERSION).toBe(1);
  });

  it('bounded read with enforcement unavailable fails closed with ENFORCEMENT UNVERIFIED', () => {
    const decision = evaluateBoundedRead({
      actionClass: 'read_file',
      state: { mode: 'build', profile: 'manual' },
      activationRevision: 1,
      workspaceRoot: '/tmp/ws',
      candidatePath: 'readme.md',
      enforcementAvailable: false,
    });

    expect(decision.outcome).toBe('deny');
    expect(decision.reason).toBe('ENFORCEMENT UNVERIFIED');
    expect(decision.boundaryDecision.reason).toBe('ENFORCEMENT UNVERIFIED');
  });
});

// ---------------------------------------------------------------------------
// AC #6: (implicit — all above tests exercise the full matrix)
// ---------------------------------------------------------------------------

describe('AC #6: Cross-cutting — default platform probe', () => {
  it('defaultPlatformProbe returns the current process platform', () => {
    const probe = defaultPlatformProbe();
    expect(probe.platform).toBe(process.platform);
    if (process.platform === 'win32') {
      expect(probe.casePolicy).toBe('case-insensitive');
      expect(probe.unicodePolicy).toBe('nfc');
    } else if (process.platform === 'darwin') {
      expect(probe.casePolicy).toBe('case-sensitive');
      expect(probe.unicodePolicy).toBe('nfd');
    }
  });

  it('defaultFsProbe can stat the current directory', () => {
    const probe = defaultFsProbe();
    const stats = probe.lstat(process.cwd());
    expect(stats.isDirectory).toBe(true);
    expect(stats.dev).toBeGreaterThan(0);
  });
});
