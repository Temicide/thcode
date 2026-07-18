// Bounded text search (Story 3.4, AD-4, AD-12, AD-13, AD-24, AD-27).
// Revalidates identity, bounds search work + file count + text bytes, no-follow,
// sanitized matches with metadata. Same binary/hostile/malformed-utf8 handling
// as read.ts.
//
// Injectable fsProbe + clock for offline testing.

import type { PlatformPath } from 'node:path';
import { resolveWithinWorkspace, WorkspaceBoundaryError } from '../tools/workspace.js';
import { checkContainment } from '../workspace/containment.js';
import { pathFor, platformForRoot } from '../workspace/platformPath.js';
import type { WorkspaceIdentity } from '../workspace/types.js';
import type {
  InspectionFsProbe,
  InspectionLimits,
  InspectionRefusal,
  SearchMatch,
  SearchResult,
} from './types.js';
import { DEFAULT_INSPECTION_LIMITS } from './types.js';

export interface SearchOptions {
  readonly fsProbe?: InspectionFsProbe;
  readonly limits?: InspectionLimits;
}

// Patterns that indicate active external references in file content.
const ACTIVE_REFERENCE_PATTERNS: RegExp[] = [
  /\brequire\s*\(/g,
  /\bimport\s*\(/g,
  /\bfetch\s*\(/g,
  /\bexec\s*\(/g,
  /\bspawn\s*\(/g,
  /\beval\s*\(/g,
  /https?:\/\/[^\s"')\]]{8,}/g,
  /file:\/\/[^\s"')\]]+/g,
];

// Maximum line length before a file is considered hostile.
const MAX_LINE_LENGTH = 10_000;

/**
 * Perform a bounded text search within the workspace.
 *
 * Revalidates identity, bounds search work + file count + text bytes, no-follow,
 * returns sanitized matches with metadata. Same binary/hostile/malformed-utf8
 * handling as read.ts.
 */
export function inspectSearch(
  ws: WorkspaceIdentity,
  query: string,
  relPath: string,
  opts: SearchOptions = {},
): SearchResult | InspectionRefusal {
  const fsProbe = opts.fsProbe;
  const limits = opts.limits ?? DEFAULT_INSPECTION_LIMITS;

  if (!query) {
    return {
      kind: 'denied',
      reason: 'search query is empty',
      nextStep: 'provide a non-empty search query',
    };
  }

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

  // 2. Check containment (no-follow).
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
        nextStep: 'provide a directory path for searching',
      };
    }
  } catch {
    return {
      kind: 'inaccessible',
      reason: `cannot access path: ${relPath}`,
      nextStep: 'check that the path exists and is readable',
    };
  }

  // 4. Walk the directory tree and search files.
  const matches: SearchMatch[] = [];
  let filesSearched = 0;
  let searchWork = 0;
  let truncated = false;

  walkAndSearch(
    fsProbe,
    pathFor(platformForRoot(ws.canonicalRoot)),
    resolvedPath,
    resolvedPath,
    0,
    query,
    limits,
    matches,
    (n) => { filesSearched += n; },
    (n) => { searchWork += n; },
  );

  const totalMatches = matches.length;
  if (totalMatches >= limits.maxFileCount || searchWork >= limits.maxSearchWork) {
    truncated = true;
  }

  return {
    outcome: 'allowed',
    kind: 'search',
    matches,
    truncated,
    totalMatches,
    filesSearched,
  };
}

/**
 * Walk a directory tree and search file contents for the given query.
 * Bounds recursion depth, file count, text bytes, and search work.
 */
function walkAndSearch(
  fsProbe: InspectionFsProbe,
  p: PlatformPath,
  root: string,
  dir: string,
  depth: number,
  query: string,
  limits: InspectionLimits,
  matches: SearchMatch[],
  addFilesSearched: (n: number) => void,
  addSearchWork: (n: number) => void,
): void {
  if (depth > limits.maxRecursionDepth) return;
  if (matches.length >= limits.maxFileCount) return;

  let dirEntries: string[];
  try {
    dirEntries = fsProbe.readdirSync(dir);
  } catch {
    return; // skip unreadable directories
  }

  let filesSearched = 0;
  let searchWork = 0;

  for (const name of dirEntries) {
    if (matches.length >= limits.maxFileCount) return;
    if (searchWork >= limits.maxSearchWork) return;

    const absPath = p.join(dir, name);

    try {
      const stats = fsProbe.lstat(absPath);

      // No-follow: skip symlinks entirely.
      if (stats.isSymbolicLink) continue;

      if (stats.isDirectory) {
        walkAndSearch(fsProbe, p, root, absPath, depth + 1, query, limits, matches, (n) => { filesSearched += n; }, (n) => { searchWork += n; });
      } else if (stats.isFile) {
        // Skip files that exceed the size limit.
        if (stats.size > limits.maxFileSize) continue;

        // Read and search the file.
        const result = searchFile(fsProbe, p, root, absPath, query);
        if (result) {
          for (const match of result.matches) {
            matches.push(match);
          }
          filesSearched++;
          searchWork += result.searchWork;
        }
      }
    } catch {
      continue; // skip unreadable entries
    }
  }

  addFilesSearched(filesSearched);
  addSearchWork(searchWork);
}

interface SearchFileResult {
  readonly matches: SearchMatch[];
  readonly searchWork: number;
}

/**
 * Search a single file for the given query. Returns matches and search work
 * cost, or null if the file cannot be read.
 */
function searchFile(
  fsProbe: InspectionFsProbe,
  p: PlatformPath,
  root: string,
  filePath: string,
  query: string,
): SearchFileResult | null {
  let rawBuffer: Buffer;
  try {
    rawBuffer = fsProbe.readFileSync(filePath);
  } catch {
    return null;
  }

  // Detect binary content (null bytes in first 4KB).
  const head = rawBuffer.subarray(0, 4096);
  if (head.includes(0)) return null;

  // Decode as UTF-8.
  let text: string;
  try {
    text = rawBuffer.toString('utf8');
    // Verify round-trip.
    const reEncoded = Buffer.from(text, 'utf8');
    if (Buffer.compare(reEncoded, rawBuffer) !== 0) return null;
  } catch {
    return null;
  }

  // Check for hostile content (extremely long lines).
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.length > MAX_LINE_LENGTH) return null;
  }

  // Check for active external references.
  for (const pattern of ACTIVE_REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return null;
  }

  // Search for the query.
  const matches: SearchMatch[] = [];
  const relPath = p.relative(root, filePath).split(p.sep).join('/');
  const searchWork = Math.ceil(text.length / 100); // approximate work units

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(query)) {
      matches.push({
        path: relPath,
        lineNumber: i + 1,
        text: lines[i].trim(),
      });
    }
  }

  return { matches, searchWork };
}
