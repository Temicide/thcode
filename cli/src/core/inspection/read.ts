// Bounded file read (Story 3.4, AD-4, AD-12, AD-13, AD-24, AD-27).
// Revalidates identity, applies no-follow + file-size limit, detects
// binary/hostile/over-limit/malformed-UTF-8/active-external-references per
// AC #3, returns bounded metadata or typed refusal, preserves valid Thai UTF-8
// + technical identifiers, never silently decodes/expands/transfers.
//
// Injectable fsProbe + clock for offline testing.

import { createHash } from 'node:crypto';
import { resolveWithinWorkspace, WorkspaceBoundaryError } from '../tools/workspace.js';
import { checkContainment } from '../workspace/containment.js';
import type { WorkspaceIdentity } from '../workspace/types.js';
import type {
  EntryMetadata,
  InspectionFsProbe,
  InspectionLimits,
  InspectionRefusal,
  ReadResult,
} from './types.js';
import { DEFAULT_INSPECTION_LIMITS } from './types.js';

export interface ReadOptions {
  readonly fsProbe?: InspectionFsProbe;
  readonly limits?: InspectionLimits;
}

// Patterns that indicate active external references in file content.
// These are checked against the decoded text to detect files that would
// cause side effects if processed (require, import, fetch, exec, URLs).
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
 * Perform a bounded file read within the workspace.
 *
 * Revalidates identity, checks containment (no-follow), enforces file size
 * limit, detects binary/hostile/over-limit/malformed-UTF-8/active-external-
 * references, and returns bounded content with metadata or a typed refusal.
 *
 * Preserves valid Thai UTF-8 and technical identifiers. Never silently
 * decodes, expands, or transfers the file.
 */
export function inspectRead(
  ws: WorkspaceIdentity,
  relPath: string,
  opts: ReadOptions = {},
): ReadResult | InspectionRefusal {
  const fsProbe = opts.fsProbe;
  const limits = opts.limits ?? DEFAULT_INSPECTION_LIMITS;

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

  // 3. Verify the resolved path is a file and check size.
  let fileSize: number;
  try {
    const stats = fsProbe.lstat(resolvedPath);
    if (!stats.isFile) {
      return {
        kind: 'denied',
        reason: `path is not a file: ${relPath}`,
        nextStep: 'provide a file path for reading',
      };
    }
    fileSize = stats.size;
  } catch {
    return {
      kind: 'inaccessible',
      reason: `cannot access path: ${relPath}`,
      nextStep: 'check that the file exists and is readable',
    };
  }

  // 4. Check file size limit.
  if (fileSize > limits.maxFileSize) {
    return {
      kind: 'over-limit',
      reason: `file exceeds maximum read size (${fileSize} > ${limits.maxFileSize} bytes)`,
      limit: 'maxFileSize',
      actual: fileSize,
      nextStep: 'increase the file size limit or use a smaller file',
    };
  }

  // 5. Read the file content.
  let rawBuffer: Buffer;
  try {
    rawBuffer = fsProbe.readFileSync(resolvedPath);
  } catch {
    return {
      kind: 'inaccessible',
      reason: `cannot read file: ${relPath}`,
      nextStep: 'check that the file is readable',
    };
  }

  // 6. Detect binary content (null bytes in first 4KB).
  const head = rawBuffer.subarray(0, 4096);
  if (head.includes(0)) {
    return {
      kind: 'binary-refused',
      reason: `file appears to be binary (contains null bytes): ${relPath}`,
      path: relPath,
      nextStep: 'binary files cannot be read as text; use a different tool',
    };
  }

  // 7. Decode as UTF-8 and check for malformed encoding.
  let text: string;
  try {
    text = rawBuffer.toString('utf8');
    // Verify round-trip: re-encode and check for data loss.
    const reEncoded = Buffer.from(text, 'utf8');
    if (Buffer.compare(reEncoded, rawBuffer) !== 0) {
      return {
        kind: 'malformed-utf8',
        reason: `file contains malformed UTF-8 sequences: ${relPath}`,
        path: relPath,
        nextStep: 'the file has encoding issues; use a binary-safe tool',
      };
    }
  } catch {
    return {
      kind: 'malformed-utf8',
      reason: `file cannot be decoded as UTF-8: ${relPath}`,
      path: relPath,
      nextStep: 'the file has encoding issues; use a binary-safe tool',
    };
  }

  // 8. Check for hostile content (extremely long lines).
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.length > MAX_LINE_LENGTH) {
      return {
        kind: 'denied',
        reason: `file contains hostile content (extremely long line): ${relPath}`,
        nextStep: 'the file has unusually long lines; use a binary-safe tool',
      };
    }
  }

  // 9. Check for active external references.
  for (const pattern of ACTIVE_REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return {
        kind: 'denied',
        reason: `file contains active external references: ${relPath}`,
        nextStep: 'the file contains code that would execute or fetch external resources',
      };
    }
  }

  // 10. Compute digest.
  const digest = createHash('sha256').update(rawBuffer).digest('hex');

  // 11. Build metadata.
  const metadata: EntryMetadata = {
    path: relPath,
    type: 'file',
    sizeBytes: fileSize,
    digest,
  };

  // 12. Truncate if over text byte limit.
  let truncated = false;
  let displayContent = text;
  if (Buffer.byteLength(text, 'utf8') > limits.maxTextBytes) {
    const truncatedBuf = rawBuffer.subarray(0, limits.maxTextBytes);
    displayContent = truncatedBuf.toString('utf8');
    truncated = true;
  }

  return {
    outcome: 'allowed',
    kind: 'read',
    content: displayContent,
    metadata,
    truncated,
  };
}
