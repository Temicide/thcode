// Bounded directory listing (Story 3.4, AD-4, AD-12, AD-13, AD-24, AD-27).
// Resolves + revalidates every resource identity via Story 3.1, stays within
// Workspace, no-follow (symlinks/junctions/mount points not traversed), bounds
// recursion + file count, returns sanitized entries with path/type/size/digest
// metadata. Refusals per AC #2.
//
// Injectable fsProbe + clock for offline testing.

import { createHash } from 'node:crypto';
import { resolveWithinWorkspace, WorkspaceBoundaryError } from '../tools/workspace.js';
import { checkContainment } from '../workspace/containment.js';
import { pathFor, platformForRoot } from '../workspace/platformPath.js';
import type { WorkspaceIdentity } from '../workspace/types.js';
import type {
  EntryMetadata,
  InspectionFsProbe,
  InspectionLimits,
  InspectionRefusal,
  ListResult,
} from './types.js';
import { DEFAULT_INSPECTION_LIMITS } from './types.js';

export interface ListOptions {
  readonly fsProbe?: InspectionFsProbe;
  readonly limits?: InspectionLimits;
  readonly computeDigests?: boolean;
}

/**
 * Perform a bounded directory listing within the workspace.
 *
 * Resolves the path, revalidates containment (no-follow), walks the directory
 * tree with bounded recursion and file count, and returns sanitized entries
 * with path/type/size/digest metadata.
 *
 * Returns a `ListResult` on success, or an `InspectionRefusal` on failure.
 */
export function inspectList(
  ws: WorkspaceIdentity,
  relPath: string,
  opts: ListOptions = {},
): ListResult | InspectionRefusal {
  const fsProbe = opts.fsProbe;
  const limits = opts.limits ?? DEFAULT_INSPECTION_LIMITS;
  const computeDigests = opts.computeDigests ?? false;

  // 1. Resolve containment — no-follow by default.
  if (!fsProbe) {
    return {
      kind: 'enforcement-unverified',
      reason: 'no filesystem probe available to verify containment',
      nextStep: 'retry with a configured filesystem probe',
    };
  }

  let resolvedPath: string;
  try {
    resolvedPath = resolveWithinWorkspace(ws.canonicalRoot, relPath);
  } catch (e) {
    if (e instanceof WorkspaceBoundaryError) {
      return {
        kind: 'denied',
        reason: `path escapes workspace boundary: ${relPath}`,
        nextStep: 'provide a path within the workspace',
      };
    }
    return {
      kind: 'inaccessible',
      reason: `cannot resolve path: ${relPath}`,
      nextStep: 'check that the path is valid and accessible',
    };
  }

  // 2. Check containment (no-follow — symlinks/junctions/mount points denied).
  const containment = checkContainment(ws, relPath, { fsProbe });
  if (containment.outcome === 'denied') {
    return {
      kind: 'denied',
      reason: containment.reason,
      nextStep: 'use a direct path within the workspace, not a symlink/junction/mount point',
    };
  }
  if (containment.outcome === 'conflict') {
    return {
      kind: 'conflict',
      reason: containment.reason,
      nextStep: 'resolve the conflicting identity before retrying',
    };
  }
  if (containment.outcome === 'enforcement-unverified') {
    return {
      kind: 'enforcement-unverified',
      reason: containment.reason,
      nextStep: 'ensure the platform enforcement mechanism is available',
    };
  }

  // 3. Verify the resolved path is a directory.
  try {
    const stats = fsProbe.lstat(resolvedPath);
    if (!stats.isDirectory) {
      return {
        kind: 'denied',
        reason: `path is not a directory: ${relPath}`,
        nextStep: 'provide a directory path for listing',
      };
    }
  } catch {
    return {
      kind: 'inaccessible',
      reason: `cannot access path: ${relPath}`,
      nextStep: 'check that the path exists and is readable',
    };
  }

  // 4. Walk the directory tree with bounded recursion and file count.
  const entries: EntryMetadata[] = [];
  let truncated = false;
  let totalEntries = 0;

  try {
    walkDirectory(fsProbe, ws, resolvedPath, resolvedPath, 0, limits, computeDigests, entries);
    totalEntries = entries.length;
    if (totalEntries >= limits.maxFileCount) {
      truncated = true;
    }
  } catch (e) {
    return {
      kind: 'inaccessible',
      reason: `error during directory walk: ${(e as Error).message}`,
      nextStep: 'retry with a smaller or simpler directory',
    };
  }

  return {
    outcome: 'allowed',
    kind: 'list',
    entries,
    truncated,
    totalEntries,
  };
}

/**
 * Walk a directory tree with bounded recursion, collecting entry metadata.
 * Skips symlinks (no-follow), respects recursion depth and file count limits.
 */
function walkDirectory(
  fsProbe: InspectionFsProbe,
  ws: WorkspaceIdentity,
  root: string,
  dir: string,
  depth: number,
  limits: InspectionLimits,
  computeDigests: boolean,
  entries: EntryMetadata[],
): void {
  if (depth > limits.maxRecursionDepth) return;
  if (entries.length >= limits.maxFileCount) return;

  const p = pathFor(platformForRoot(ws.canonicalRoot));
  let dirEntries: string[];
  try {
    dirEntries = fsProbe.readdirSync(dir);
  } catch {
    return; // skip unreadable directories
  }

  for (const name of dirEntries) {
    if (entries.length >= limits.maxFileCount) return;

    const absPath = p.join(dir, name);

    try {
      const stats = fsProbe.lstat(absPath);

      // No-follow: skip symlinks entirely.
      if (stats.isSymbolicLink) continue;

      if (stats.isDirectory) {
        // Add directory entry. Display paths use forward slashes regardless of
        // platform (stable cross-platform convention).
        const relPath = p.relative(root, absPath).split(p.sep).join('/');
        entries.push({
          path: relPath,
          type: 'directory',
          sizeBytes: stats.size,
          digest: null,
        });
        // Recurse into subdirectory.
        walkDirectory(fsProbe, ws, root, absPath, depth + 1, limits, computeDigests, entries);
      } else if (stats.isFile) {
        const relPath = p.relative(root, absPath).split(p.sep).join('/');
        let digest: string | null = null;
        if (computeDigests) {
          digest = computeFileDigest(fsProbe, absPath);
        }
        entries.push({
          path: relPath,
          type: 'file',
          sizeBytes: stats.size,
          digest,
        });
      }
      // Skip other types (sockets, FIFOs, etc.)
    } catch {
      // Skip unreadable entries.
      continue;
    }
  }
}

/**
 * Compute a SHA-256 digest of a file's content. Returns hex-encoded digest
 * or null on failure.
 */
function computeFileDigest(fsProbe: InspectionFsProbe, filePath: string): string | null {
  try {
    const content = fsProbe.readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}
