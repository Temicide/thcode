// File effect preview — build the exact create/edit preview (Story 3.5 AC #1,
// AD-4, AD-12, AD-13, AD-19, AD-20, AD-24, AD-27). Plan mode returns `deny`
// and cannot authorize. Pure/injectable: accepts fsProbe + clock + workspace
// binding. No side effects.

import { createHash } from 'node:crypto';
import type { FsProbe, WorkspaceIdentity } from '../workspace/types.js';
import { resolveResource } from '../workspace/resourceResolver.js';
import { checkContainment } from '../workspace/containment.js';
import { newOperationId } from '../protocol/ids.js';
import type { OperationId } from '../protocol/ids.js';
import type { CoverageState } from '../checkpoints/types.js';
import type { ExcludedEffect } from '../mutations/types.js';
import type { FileEffectPreview, PreviewResult } from './types.js';

// --- Helpers ---

function computeDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function countLines(bytes: Uint8Array): number {
  const text = new TextDecoder().decode(bytes);
  if (text.length === 0) return 0;
  let lines = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lines++;
  }
  return lines;
}

function buildContentSummary(bytes: Uint8Array): string {
  const size = bytes.length;
  const lines = countLines(bytes);
  return `${size} bytes, ${lines} line${lines === 1 ? '' : 's'}`;
}

// --- Main preview function ---

/**
 * Build the exact create/edit file preview (Story 3.5 AC #1).
 *
 * Shows:
 * - exact target identity (canonical path, display path)
 * - expected pre-image digest/version or `absent`
 * - bounded patch/content summary
 * - resulting post-image digest plan
 * - exclusions
 * - OperationId
 * - authority (activationId, activationRevision)
 * - checkpoint coverage
 *
 * Plan mode returns `deny` and cannot authorize.
 */
export function previewFileEffect(
  kind: 'create_file' | 'edit_file',
  target: string,
  content: Uint8Array,
  ctx: {
    readonly workspace: WorkspaceIdentity;
    readonly fsProbe: FsProbe;
    readonly clock: () => string;
    readonly mode: 'plan' | 'build';
    readonly activationId: string;
    readonly activationRevision: number;
    readonly operationId?: OperationId;
  },
): PreviewResult {
  // Plan mode is structurally read-only — deny immediately (AC #1).
  if (ctx.mode === 'plan') {
    return {
      ok: false,
      kind: 'deny',
      reason: 'Plan mode is structurally read-only. Switch to Build mode to preview file effects.',
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

  // For create_file, the target must not exist (absent).
  if (kind === 'create_file' && resolved.identityProven) {
    exclusions.push({
      target,
      reason: 'target already exists — use edit_file instead',
      reasonCode: 'target-exists',
    });
  }

  // For edit_file, the target must exist.
  if (kind === 'edit_file' && !resolved.identityProven) {
    exclusions.push({
      target,
      reason: 'target does not exist — use create_file instead',
      reasonCode: 'target-not-found',
    });
  }

  const contentDigest = computeDigest(content);
  const lineCount = countLines(content);
  const contentSummary = buildContentSummary(content);

  // Determine checkpoint coverage.
  let checkpointCoverage: CoverageState = 'fully-protected';
  if (exclusions.length > 0) {
    checkpointCoverage = 'partially-protected';
  }

  const preview: FileEffectPreview = {
    kind,
    operationId,
    target: {
      canonicalPath: resolved.canonicalPath,
      displayPath: resolved.displayPath,
    },
    expectedPreImage: {
      digest: resolved.expectedDigest,
      version: resolved.version,
      absent: !resolved.identityProven,
    },
    contentSummary,
    postImageDigest: contentDigest,
    postImageSizeBytes: content.length,
    lineCount,
    exclusions,
    checkpointCoverage,
    authority: {
      activationId: ctx.activationId,
      activationRevision: ctx.activationRevision,
    },
  };

  return { ok: true, preview };
}
