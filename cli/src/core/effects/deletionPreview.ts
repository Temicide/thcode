// Guarded destructive deletion preview (Story 3.6 AC #1, AD-4, AD-12, AD-13,
// AD-19, AD-20, AD-24, AD-27). Labeled `DESTRUCTIVE`, shows exact root identity,
// ordered descendant identity/content manifest, count/size bounds, symlink/junction/
// mount/open-handle policy, checkpoint coverage, and exclusions. Plan mode returns
// `deny` under every profile. Pure/injectable: accepts fsProbe + clock + workspace
// binding. No side effects.

import type { FsProbe, WorkspaceIdentity } from '../workspace/types.js';
import { resolveResource } from '../workspace/resourceResolver.js';
import { checkContainment } from '../workspace/containment.js';
import { newOperationId } from '../protocol/ids.js';
import type { OperationId } from '../protocol/ids.js';
import type { CoverageState } from '../checkpoints/types.js';
import type { ExcludedEffect } from '../mutations/types.js';
import type { DeletionPreview, DeletionPreviewResult, DescendantIdentity } from './deletionTypes.js';

// --- Helpers ---

function collectDescendants(
  rootPath: string,
  fsProbe: FsProbe,
  _workspace: WorkspaceIdentity,
): { descendants: DescendantIdentity[]; totalSizeBytes: number; exclusions: ExcludedEffect[] } {
  const descendants: DescendantIdentity[] = [];
  let totalSizeBytes = 0;
  const exclusions: ExcludedEffect[] = [];

  // Use a simple recursive directory walk via the fsProbe.
  // We simulate readdir by trying to lstat children — for the in-memory fs
  // used in tests, we enumerate known paths. For real fs, we'd use readdir.
  // The contract: collect all direct children recursively, no-follow.
  try {
    const rootStat = fsProbe.lstat(rootPath);
    if (!rootStat.isDirectory) {
      // Single file — no descendants beyond the root itself.
      return { descendants, totalSizeBytes, exclusions };
    }
  } catch {
    // Root doesn't exist — no descendants.
    return { descendants, totalSizeBytes, exclusions };
  }

  // For the in-memory fs, we need a way to list children. We use a heuristic:
  // the fsProbe doesn't have readdir, so we rely on the caller to provide
  // the manifest. The preview function accepts an optional pre-collected
  // manifest. If none is provided, we return an empty manifest with an
  // exclusion noting that descendant enumeration requires readdir capability.
  exclusions.push({
    target: rootPath,
    reason: 'descendant enumeration requires readdir capability — provide manifest explicitly',
    reasonCode: 'readdir-unavailable',
  });

  return { descendants, totalSizeBytes, exclusions };
}

// --- Main preview function ---

/**
 * Build the exact destructive deletion preview (Story 3.6 AC #1).
 *
 * Shows:
 * - `DESTRUCTIVE` label
 * - exact root identity (canonical path, display path)
 * - expected pre-image digest/version or `absent`
 * - ordered descendant identity/content manifest
 * - count/size bounds
 * - symlink/junction/mount/open-handle policy
 * - checkpoint coverage
 * - exclusions
 * - OperationId
 * - authority (activationId, activationRevision)
 *
 * Plan mode returns `deny` and cannot authorize.
 */
export function previewDeletion(
  kind: 'delete_file' | 'delete_directory',
  target: string,
  ctx: {
    readonly workspace: WorkspaceIdentity;
    readonly fsProbe: FsProbe;
    readonly clock: () => string;
    readonly mode: 'plan' | 'build';
    readonly activationId: string;
    readonly activationRevision: number;
    readonly operationId?: OperationId;
    /** Optional pre-collected descendant manifest. When absent, the preview
     * attempts to enumerate descendants via fsProbe (which may not support
     * readdir). */
    readonly descendantManifest?: readonly DescendantIdentity[];
  },
): DeletionPreviewResult {
  // Plan mode is structurally read-only — deny immediately (AC #1).
  if (ctx.mode === 'plan') {
    return {
      ok: false,
      kind: 'deny',
      reason: 'Plan mode is structurally read-only. Switch to Build mode to preview destructive deletion.',
    };
  }

  const operationId = ctx.operationId ?? newOperationId();
  const exclusions: ExcludedEffect[] = [];

  // Resolve the target resource identity.
  let resolved;
  try {
    resolved = resolveResource(ctx.workspace, target, {
      fsProbe: ctx.fsProbe,
      computeDigest: true,
      includeVersion: true,
    });
  } catch {
    return {
      ok: false,
      kind: 'deny',
      reason: `target cannot be resolved within workspace: ${target}`,
    };
  }

  // Check containment.
  const containment = checkContainment(ctx.workspace, target, {
    fsProbe: ctx.fsProbe,
    followSymlinks: false,
    followJunctions: false,
    followMountPoints: false,
    followReparsePoints: false,
  });
  if (containment.outcome !== 'allowed') {
    return {
      ok: false,
      kind: 'deny',
      reason: `containment check failed: ${containment.reason}`,
    };
  }

  // Check for symlink root.
  if (resolved.type === 'symlink') {
    exclusions.push({
      target,
      reason: 'target is a symlink — deletion of symlinks is not supported',
      reasonCode: 'symlink-root',
    });
  }

  // Check that the target exists (cannot delete what doesn't exist).
  if (!resolved.identityProven) {
    exclusions.push({
      target,
      reason: 'target does not exist — cannot delete',
      reasonCode: 'target-not-found',
    });
  }

  // Collect descendant manifest.
  let descendantManifest: readonly DescendantIdentity[];
  let descendantCount: number;
  let totalSizeBytes: number;

  if (ctx.descendantManifest) {
    descendantManifest = ctx.descendantManifest;
    descendantCount = descendantManifest.length;
    totalSizeBytes = descendantManifest.reduce((sum, d) => sum + (d.sizeBytes ?? 0), 0);
  } else {
    const collected = collectDescendants(resolved.canonicalPath, ctx.fsProbe, ctx.workspace);
    descendantManifest = collected.descendants;
    descendantCount = collected.descendants.length;
    totalSizeBytes = collected.totalSizeBytes;
    exclusions.push(...collected.exclusions);
  }

  // Determine checkpoint coverage.
  let checkpointCoverage: CoverageState = 'fully-protected';
  if (exclusions.length > 0) {
    checkpointCoverage = 'partially-protected';
  }

  const preview: DeletionPreview = {
    kind,
    label: 'DESTRUCTIVE',
    operationId,
    root: {
      canonicalPath: resolved.canonicalPath,
      displayPath: resolved.displayPath,
    },
    expectedPreImage: {
      digest: resolved.expectedDigest,
      version: resolved.version,
      absent: !resolved.identityProven,
    },
    descendantManifest,
    descendantCount,
    totalSizeBytes,
    symlinkPolicy: 'no-follow',
    junctionPolicy: 'no-follow',
    mountPolicy: 'no-follow',
    openHandlePolicy: 'reject',
    checkpointCoverage,
    exclusions,
    authority: {
      activationId: ctx.activationId,
      activationRevision: ctx.activationRevision,
    },
  };

  return { ok: true, preview };
}
