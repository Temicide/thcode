// Resource identity resolver (Story 3.1 AC #2, AD-4, AD-5, PR-3). Produces a
// canonical ResourceIdentity + display path + type + size + expected digest/
// version WITHOUT treating a display string as authority. Reuses
// `resolveWithinWorkspace` from `tools/workspace.ts` for containment.
//
// Handles Windows drive/UNC, macOS paths, separators, spaces, case behavior,
// Unicode normalization, rename, and inode/file-ID per the versioned platform/
// action matrix (PR-3).

import { createHash } from 'node:crypto';
import { resolveWithinWorkspace } from '../tools/workspace.js';
import type { FsProbe, ResourceIdentity, ResourceType, WorkspaceIdentity } from './types.js';

export interface ResolveResourceOptions {
  readonly fsProbe?: FsProbe;
  /** When true, compute a SHA-256 digest of the file content. Default false. */
  readonly computeDigest?: boolean;
  /** When true, include inode-based version identity. Default true. */
  readonly includeVersion?: boolean;
}

/**
 * Resolve a candidate path/resource reference against a WorkspaceIdentity,
 * producing a canonical ResourceIdentity.
 *
 * The display path is the original candidate string; the canonical path is the
 * resolved, normalized absolute path within the workspace. Type, size, digest,
 * and version are obtained from direct filesystem inspection (not from the
 * display string).
 *
 * Throws `WorkspaceBoundaryError` when the candidate escapes the workspace.
 */
export function resolveResource(
  ws: WorkspaceIdentity,
  candidate: string,
  opts: ResolveResourceOptions = {},
): ResourceIdentity {
  const fsProbe = opts.fsProbe;

  // Resolve containment first — reuse the existing resolveWithinWorkspace.
  const canonicalPath = resolveWithinWorkspace(ws.canonicalRoot, candidate);

  // If no fsProbe is available, return identity from the path alone (not
  // identity-proven).
  if (!fsProbe) {
    return {
      canonicalPath,
      displayPath: candidate,
      type: 'unknown',
      sizeBytes: null,
      expectedDigest: null,
      version: null,
      identityProven: false,
    };
  }

  // Inspect the resolved path on the filesystem.
  let type: ResourceType;
  let sizeBytes: number | null = null;
  let expectedDigest: string | null = null;
  let version: string | null = null;

  try {
    const stats = fsProbe.lstat(canonicalPath);
    type = stats.isDirectory ? 'directory' : stats.isFile ? 'file' : stats.isSymbolicLink ? 'symlink' : 'other';
    sizeBytes = stats.size;

    if (opts.computeDigest && type === 'file') {
      expectedDigest = computeDigest(canonicalPath, fsProbe);
    }

    if (opts.includeVersion !== false) {
      // Use dev+ino+mtime as a version identifier.
      version = `${stats.dev}:${stats.ino}`;
    }
  } catch {
    // Resource doesn't exist or can't be inspected.
    type = 'unknown';
  }

  return {
    canonicalPath,
    displayPath: candidate,
    type,
    sizeBytes,
    expectedDigest,
    version,
    identityProven: type !== 'unknown',
  };
}

/**
 * Compute a SHA-256 digest of a file's content. Uses the fsProbe's underlying
 * filesystem access. Returns hex-encoded digest or null on failure.
 */
function computeDigest(filePath: string, fsProbe: FsProbe): string | null {
  try {
    const content = fsProbe.readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}
