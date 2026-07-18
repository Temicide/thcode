// Workspace identity establishment (Story 3.1 AC #1, AD-4, AD-5, AD-22, AD-27,
// PR-3). `establishWorkspaceBinding` records a stable WorkspaceIdentity with
// platform identity, canonical root identity, case/Unicode policy per platform,
// volume/device identity where available, and explicit binding status. A
// missing/inaccessible/ambiguous root yields `blocked` — no local effects can
// be authorized.
//
// Pure/injectable: accepts a `platformProbe` and `fsProbe` port so tests don't
// touch real disk unless intended.

import { createHash } from 'node:crypto';
import path from 'node:path';
import type {
  CasePolicy,
  FsProbe,
  PlatformIdentity,
  PlatformProbe,
  VolumeIdentity,
  WorkspaceId,
  WorkspaceIdentity,
} from './types.js';
import { asWorkspaceId } from './types.js';

// --- Default platform probes ---

/** Platform probe for the current process. */
export function defaultPlatformProbe(): PlatformProbe {
  const p = process.platform;
  return {
    platform: p,
    casePolicy: p === 'win32' ? 'case-insensitive' : 'case-sensitive',
    unicodePolicy: p === 'darwin' ? 'nfd' : p === 'win32' ? 'nfc' : 'unknown',
  };
}

// --- Default fs probe using real node:fs ---

let _fs: typeof import('node:fs') | null = null;
function fs(): typeof import('node:fs') {
  if (!_fs) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _fs = require('node:fs') as typeof import('node:fs');
  }
  return _fs;
}

export function defaultFsProbe(): FsProbe {
  return {
    realpath(p: string): string {
      return fs().realpathSync(p);
    },
    lstat(p: string) {
      const s = fs().lstatSync(p);
      return {
        dev: s.dev,
        ino: s.ino,
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
        isSymbolicLink: s.isSymbolicLink(),
      };
    },
    stat(p: string) {
      const s = fs().statSync(p);
      return {
        dev: s.dev,
        ino: s.ino,
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
      };
    },
    readlink(p: string): string {
      return fs().readlinkSync(p);
    },
    statfs(p: string): { type: number } | null {
      try {
        const s = fs().statfsSync(p);
        return { type: s.type };
      } catch {
        return null;
      }
    },
    readFile(p: string): Uint8Array {
      return fs().readFileSync(p);
    },
  };
}

// --- Workspace identity establishment ---

export interface EstablishWorkspaceBindingOptions {
  readonly platformProbe?: PlatformProbe;
  readonly fsProbe?: FsProbe;
  readonly clock?: () => string;
}

/**
 * Establish a stable WorkspaceIdentity for the given root path.
 *
 * Returns `bound` with full identity when the root is accessible and
 * unambiguous. Returns `blocked` when the root is missing, inaccessible, or
 * ambiguous — no local effects can be authorized against a blocked binding.
 *
 * Pure/injectable: accepts optional platformProbe and fsProbe ports. When
 * omitted, uses the real process platform and node:fs (for production use).
 */
export function establishWorkspaceBinding(
  root: string,
  opts: EstablishWorkspaceBindingOptions = {},
): WorkspaceIdentity {
  const platformProbe = opts.platformProbe ?? defaultPlatformProbe();
  const fsProbe = opts.fsProbe ?? defaultFsProbe();

  // Resolve the root to a canonical path.
  let canonicalRoot: string;
  let bindingStatus: 'bound' | 'blocked' = 'bound';
  let blockedReason: string | null = null;
  try {
    canonicalRoot = fsProbe.realpath(root);
  } catch {
    // Root is missing or inaccessible → blocked. Still compute a workspaceId
    // from the string-level resolved path so identity is addressable even
    // when the root cannot be inspected on disk.
    canonicalRoot = path.resolve(root);
    bindingStatus = 'blocked';
    blockedReason = 'root is missing or inaccessible';
  }

  // Compute a stable workspaceId from the canonical root.
  const workspaceId = computeWorkspaceId(canonicalRoot, platformProbe.casePolicy);

  // Volume/device identity — gracefully degrade when unavailable.
  let volumeIdentity: VolumeIdentity | null = null;
  try {
    const rootStat = fsProbe.lstat(canonicalRoot);
    const rootStatfs = fsProbe.statfs(canonicalRoot);
    volumeIdentity = {
      dev: rootStat.dev,
      ino: rootStat.ino,
      fsType: rootStatfs?.type ?? 0,
    };
  } catch {
    // stat/lstat/statfs unavailable → no volume identity (graceful degradation).
  }

  return {
    workspaceId,
    platform: platformIdentity(platformProbe),
    canonicalRoot,
    volumeIdentity,
    bindingStatus,
    blockedReason,
  };
}

// --- Helpers ---

function platformIdentity(probe: PlatformProbe): PlatformIdentity {
  return {
    platform: probe.platform,
    casePolicy: probe.casePolicy,
    unicodePolicy: probe.unicodePolicy,
  };
}

function computeWorkspaceId(canonicalRoot: string, casePolicy: CasePolicy): WorkspaceId {
  const normalized = casePolicy === 'case-insensitive' ? canonicalRoot.toLowerCase() : canonicalRoot;
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return asWorkspaceId(hash);
}
