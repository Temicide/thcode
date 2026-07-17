// Plan fingerprint — binds proposal + authority revision + workspace + digest +
// quota + platform state (Story 3.3 AC #5, AD-4, AD-12, AD-13, AD-19, AD-20,
// AD-27). If the user changes the proposal, Workspace, authority revision, target,
// digest, quota, or platform state after planning, effect-time validation marks
// the plan + approval `stale`/`mismatch`; staged authorization is not consumed;
// a fresh read-only plan is required.

import { createHash, randomUUID } from 'node:crypto';
import type { FsProbe, WorkspaceIdentity } from '../workspace/types.js';
import type {
  MutationSet,
  PlanFingerprint,
  StaleCheckResult,
} from './types.js';
import { asPlanFingerprintId, DEFAULT_FINGERPRINT_TTL_MS } from './types.js';

// --- Input types ---

export interface FingerprintContext {
  readonly workspace: WorkspaceIdentity;
  readonly authorityRevision: number;
  readonly fsProbe: FsProbe;
  readonly clock: () => string;
  readonly currentStoreUsageBytes: number;
  readonly platformDigest?: string;
}

export interface RevalidationContext {
  readonly workspace: WorkspaceIdentity;
  readonly authorityRevision: number;
  readonly fsProbe: FsProbe;
  readonly clock: () => string;
  readonly currentStoreUsageBytes: number;
  readonly platformDigest?: string;
  readonly mutationSet: MutationSet;
}

// --- Helpers ---

function computeDigest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function computeProposalDigest(mutationSet: MutationSet): string {
  const canonical = JSON.stringify({
    setId: mutationSet.setId,
    operationId: mutationSet.operationId,
    proposals: mutationSet.proposals.map((p) => ({
      kind: p.kind,
      target: p.resource.canonicalPath,
      actionDigest: p.actionDigest.digest,
      preImageDigest: p.preImage.expectedDigest,
      postImageDigest: p.kind === 'delete_file' ? null : (p as any).postImage?.digest ?? null,
    })),
  });
  return computeDigest(canonical);
}

function computeWorkspaceDigest(ws: WorkspaceIdentity): string {
  const canonical = JSON.stringify({
    workspaceId: ws.workspaceId,
    canonicalRoot: ws.canonicalRoot,
    platform: ws.platform,
    volumeIdentity: ws.volumeIdentity,
    bindingStatus: ws.bindingStatus,
  });
  return computeDigest(canonical);
}

function computeTargetDigest(mutationSet: MutationSet): string {
  const canonical = JSON.stringify(
    mutationSet.proposals.map((p) => ({
      canonicalPath: p.resource.canonicalPath,
      expectedDigest: p.resource.expectedDigest,
      version: p.resource.version,
    })),
  );
  return computeDigest(canonical);
}

function computeQuotaDigest(currentStoreUsageBytes: number): string {
  return computeDigest(String(currentStoreUsageBytes));
}

function computePlatformDigest(ws: WorkspaceIdentity, extra?: string): string {
  const canonical = JSON.stringify({
    platform: ws.platform.platform,
    casePolicy: ws.platform.casePolicy,
    unicodePolicy: ws.platform.unicodePolicy,
    extra: extra ?? null,
  });
  return computeDigest(canonical);
}

// --- Main functions ---

/**
 * Create a PlanFingerprint that binds the proposal + authority revision +
 * workspace + target digest + quota + platform state (Story 3.3 AC #5).
 *
 * The fingerprint is a stable hash of all the dimensions that, if changed,
 * would invalidate the plan. Effect-time validation compares the current
 * context against the fingerprint to detect staleness.
 */
export function fingerprintPlan(
  mutationSet: MutationSet,
  ctx: FingerprintContext,
): PlanFingerprint {
  const fingerprintId = asPlanFingerprintId(randomUUID());
  const proposalDigest = computeProposalDigest(mutationSet);
  const workspaceDigest = computeWorkspaceDigest(ctx.workspace);
  const targetDigest = computeTargetDigest(mutationSet);
  const quotaDigest = computeQuotaDigest(ctx.currentStoreUsageBytes);
  const platformDigest = computePlatformDigest(ctx.workspace, ctx.platformDigest);

  return {
    fingerprintId,
    mutationSetId: mutationSet.setId,
    operationId: mutationSet.operationId,
    proposalDigest,
    authorityRevision: ctx.authorityRevision,
    workspaceDigest,
    targetDigest,
    quotaDigest,
    platformDigest,
    createdAt: ctx.clock(),
  };
}

/**
 * Check whether a plan fingerprint is stale against the current context
 * (Story 3.3 AC #5). If the user changes the proposal, Workspace, authority
 * revision, target, digest, quota, or platform state after planning, the
 * fingerprint is stale and a fresh read-only plan is required.
 *
 * Staged authorization is not consumed when stale — the caller must reject
 * the effect and require a new plan.
 */
export function isStale(
  fingerprint: PlanFingerprint,
  ctx: RevalidationContext,
): StaleCheckResult {
  // Check proposal digest.
  const currentProposalDigest = computeProposalDigest(ctx.mutationSet);
  if (currentProposalDigest !== fingerprint.proposalDigest) {
    return {
      ok: false,
      stale: true,
      reason: { kind: 'proposal-changed', detail: 'proposal content has changed since planning' },
    };
  }

  // Check authority revision.
  if (ctx.authorityRevision !== fingerprint.authorityRevision) {
    return {
      ok: false,
      stale: true,
      reason: {
        kind: 'authority-revision-changed',
        detail: `authority revision changed from ${fingerprint.authorityRevision} to ${ctx.authorityRevision}`,
      },
    };
  }

  // Check workspace identity.
  const currentWorkspaceDigest = computeWorkspaceDigest(ctx.workspace);
  if (currentWorkspaceDigest !== fingerprint.workspaceDigest) {
    return {
      ok: false,
      stale: true,
      reason: { kind: 'workspace-changed', detail: 'workspace identity has changed since planning' },
    };
  }

  // Check target digests.
  const currentTargetDigest = computeTargetDigest(ctx.mutationSet);
  if (currentTargetDigest !== fingerprint.targetDigest) {
    return {
      ok: false,
      stale: true,
      reason: { kind: 'target-changed', detail: 'target identity or digest has changed since planning' },
    };
  }

  // Check quota.
  const currentQuotaDigest = computeQuotaDigest(ctx.currentStoreUsageBytes);
  if (currentQuotaDigest !== fingerprint.quotaDigest) {
    return {
      ok: false,
      stale: true,
      reason: { kind: 'quota-changed', detail: 'store usage has changed since planning' },
    };
  }

  // Check platform state.
  const currentPlatformDigest = computePlatformDigest(ctx.workspace);
  if (currentPlatformDigest !== fingerprint.platformDigest) {
    return {
      ok: false,
      stale: true,
      reason: { kind: 'platform-changed', detail: 'platform state has changed since planning' },
    };
  }

  // Check expiry (default 5 minutes TTL).
  const now = ctx.clock();
  const createdAt = new Date(fingerprint.createdAt).getTime();
  const nowMs = new Date(now).getTime();
  if (nowMs - createdAt > DEFAULT_FINGERPRINT_TTL_MS) {
    return {
      ok: false,
      stale: true,
      reason: { kind: 'expired', detail: 'plan fingerprint has expired' },
    };
  }

  return { ok: true };
}
