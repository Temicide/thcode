// File effect conflict detection (Story 3.5 AC #4, AD-4, AD-12, AD-13, AD-19,
// AD-20, AD-24, AD-27). Concurrent writer, rename, open-handle uncertainty,
// case/Unicode identity mismatch, symlink/junction/mount change, or failed
// compare-and-apply -> native adapter revalidates -> returns `conflict` or
// `unknown-outcome` WITHOUT best-effort overwrite, preserves unrelated user
// work, records deterministic Evidence.

import type { FsProbe, WorkspaceIdentity } from '../workspace/types.js';
import { resolveResource } from '../workspace/resourceResolver.js';
import { checkContainment } from '../workspace/containment.js';
import type { OperationId } from '../protocol/ids.js';
import type { EffectConflict, EffectConflictKind } from './types.js';

// --- Conflict detection input ---

export interface ConflictDetectionInput {
  readonly operationId: OperationId;
  readonly targetPath: string;
  readonly expectedDigest: string | null;
  readonly expectedVersion: string | null;
  readonly workspace: WorkspaceIdentity;
  readonly fsProbe: FsProbe;
  readonly clock: () => string;
  /** When 'create_file', the target not existing is expected — skip identity-proven check. */
  readonly kind?: 'create_file' | 'edit_file';
}

// --- Main conflict detection function ---

/**
 * Detect conflicts before executing a file effect (Story 3.5 AC #4).
 *
 * Checks for:
 * - Concurrent writer (content changed since planning)
 * - Rename (target no longer resolvable)
 * - Open-handle uncertainty (cannot lstat)
 * - Case/Unicode identity mismatch (resolved path differs from expected)
 * - Symlink/junction/mount change (containment changed)
 * - Failed compare-and-apply (digest mismatch)
 *
 * Returns `conflict` or `unknown-outcome` WITHOUT best-effort overwrite.
 * Preserves unrelated user work. Records deterministic Evidence.
 */
export function detectConflict(input: ConflictDetectionInput): EffectConflict | null {
  const { operationId, targetPath, expectedDigest, expectedVersion, workspace, fsProbe, clock, kind } = input;
  const now = clock();

  // Step 1: Try to resolve the target.
  let resolved;
  try {
    resolved = resolveResource(workspace, targetPath, { fsProbe, computeDigest: true, includeVersion: true });
  } catch {
    // Target is no longer resolvable — likely renamed or deleted.
    // For create_file, the target not existing is expected — not a conflict.
    if (kind === 'create_file') return null;
    return buildConflict(operationId, 'conflict', 'target-unresolvable', `target is no longer resolvable: ${targetPath}`, expectedDigest, null, expectedVersion, null, targetPath, now);
  }

  // Step 2: Check for symlink/junction/mount change (before containment, so
  // the symlink itself is reported, not its escaped target).
  if (resolved.type === 'symlink') {
    return buildConflict(operationId, 'conflict', 'symlink-detected', `target is a symlink: ${targetPath}`, expectedDigest, null, expectedVersion, null, targetPath, now);
  }

  // Step 3: Check containment.
  const containment = checkContainment(workspace, targetPath, { fsProbe, followSymlinks: false, followJunctions: false, followMountPoints: false, followReparsePoints: false });
  if (containment.outcome !== 'allowed') {
    return buildConflict(operationId, 'conflict', 'containment-changed', `containment changed: ${containment.reason}`, expectedDigest, null, expectedVersion, null, targetPath, now);
  }

  // Step 4: Check for case/Unicode identity mismatch.
  if (resolved.canonicalPath !== targetPath) {
    return buildConflict(operationId, 'conflict', 'identity-mismatch', `resolved path differs from expected: ${resolved.canonicalPath} vs ${targetPath}`, expectedDigest, resolved.expectedDigest, expectedVersion, resolved.version, targetPath, now);
  }

  // Step 5: Check for concurrent writer (content changed).
  if (expectedDigest !== null && resolved.expectedDigest !== null && resolved.expectedDigest !== expectedDigest) {
    return buildConflict(operationId, 'conflict', 'digest-mismatch', `content digest mismatch: expected ${expectedDigest}, actual ${resolved.expectedDigest}`, expectedDigest, resolved.expectedDigest, expectedVersion, resolved.version, targetPath, now);
  }

  // Step 6: Check for version change (rename or concurrent modification).
  if (expectedVersion !== null && resolved.version !== null && resolved.version !== expectedVersion) {
    return buildConflict(operationId, 'conflict', 'version-mismatch', `version mismatch: expected ${expectedVersion}, actual ${resolved.version}`, expectedDigest, resolved.expectedDigest, expectedVersion, resolved.version, targetPath, now);
  }

  // Step 7: Check for open-handle uncertainty (cannot lstat).
  // For create_file, the target not existing is expected — skip this check.
  if (!resolved.identityProven && kind !== 'create_file') {
    return buildConflict(operationId, 'unknown-outcome', 'open-handle-uncertainty', `cannot verify target identity: ${targetPath}`, expectedDigest, null, expectedVersion, null, targetPath, now);
  }

  // No conflict detected.
  return null;
}

// --- Helper ---

function buildConflict(
  operationId: OperationId,
  kind: EffectConflictKind,
  reasonCode: string,
  reason: string,
  expectedDigest: string | null,
  actualDigest: string | null,
  expectedVersion: string | null,
  actualVersion: string | null,
  targetPath: string,
  timestamp: string,
): EffectConflict {
  return {
    ok: false,
    kind,
    reason,
    reasonCode,
    evidence: {
      operationId,
      expectedDigest,
      actualDigest,
      expectedVersion,
      actualVersion,
      targetPath,
      timestamp,
    },
  };
}
