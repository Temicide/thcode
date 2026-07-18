// Mutation planning — read-only plan enumerating the complete intended set
// (Story 3.3 AC #1, AD-4, AD-12, AD-13, AD-19, AD-20, AD-27). Pure/injectable:
// accepts fsProbe + clock + workspace binding + checkpoint repos. No side effects.
//
// `planMutationSet` produces a MutationSet with stable resource identities, action
// digests, expected pre-image digest/version, proposed post-image or deletion
// manifest, rename/alias relationships, checkpoint size, binary status, and
// excluded effects BEFORE any native mutation.

import { createHash, randomUUID } from 'node:crypto';
import type { FsProbe, WorkspaceIdentity } from '../workspace/types.js';
import { resolveResource } from '../workspace/resourceResolver.js';
import { checkContainment } from '../workspace/containment.js';
import { newOperationId } from '../protocol/ids.js';
import type { OperationId } from '../protocol/ids.js';
import type {
  ActionDigest,
  BinaryStatus,
  CreateFileProposal,
  DeletionManifest,
  DeleteFileProposal,
  EditFileProposal,
  ExcludedEffect,
  MutationProposal,
  MutationSet,
  PlanMutationResult,
  PostImage,
  PreImage,
  RenameAlias,
  StableResourceIdentity,
} from './types.js';
import { asMutationSetId, asMutationProposalId } from './types.js';

// --- Input types ---

export interface RawProposal {
  /** The action class: 'create_file', 'edit_file', or 'delete_file'. */
  readonly actionClass: string;
  /** The target path as proposed by Typhoon. */
  readonly target: string;
  /** Proposed content bytes (for create/edit). Null for delete. */
  readonly content?: Uint8Array;
  /** Rename/alias relationships. */
  readonly renameAlias?: readonly RenameAlias[];
}

export interface PlanContext {
  readonly workspace: WorkspaceIdentity;
  readonly fsProbe: FsProbe;
  readonly clock: () => string;
  readonly operationId?: OperationId;
}

// --- Helpers ---

function computeDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function computeActionDigest(
  actionClass: string,
  target: string,
  contentDigest: string | null,
): ActionDigest {
  const canonical = JSON.stringify({
    actionClass,
    target,
    contentDigest,
  });
  return {
    digest: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    algorithm: 'sha256',
  };
}

function detectBinary(bytes: Uint8Array): BinaryStatus {
  // Check for null bytes in the first 8KB — a common heuristic for binary content.
  const sample = bytes.slice(0, 8192);
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return 'binary';
  }
  return 'text';
}

function estimateCheckpointSize(proposals: readonly RawProposal[]): number {
  // Rough estimate: metadata overhead (~512 bytes per proposal) + content bytes.
  let total = 0;
  for (const p of proposals) {
    total += 512; // metadata overhead
    if (p.content) {
      total += p.content.length;
    }
  }
  return total;
}

// --- Main planning function ---

/**
 * Plan a complete mutation set from raw proposals. READ-ONLY: enumerates the
 * complete intended set with stable resource identities, action digests, expected
 * pre-image digest/version, proposed post-image or deletion manifest, rename/alias
 * relationships, checkpoint size, binary status, and excluded effects BEFORE any
 * native mutation (Story 3.3 AC #1).
 *
 * Pure/injectable: accepts fsProbe + clock + workspace binding. No side effects
 * on the filesystem or checkpoint store.
 */
export function planMutationSet(
  rawProposals: readonly RawProposal[],
  ctx: PlanContext,
): PlanMutationResult {
  try {
    const operationId = ctx.operationId ?? newOperationId();
    const setId = asMutationSetId(randomUUID());
    const proposals: MutationProposal[] = [];
    const excludedEffects: ExcludedEffect[] = [];
    let totalCheckpointSizeBytes = 0;
    let binaryCount = 0;
    let textCount = 0;

    for (const raw of rawProposals) {
      const proposalId = asMutationProposalId(randomUUID());

      // Validate action class.
      if (raw.actionClass !== 'create_file' && raw.actionClass !== 'edit_file' && raw.actionClass !== 'delete_file') {
        return {
          ok: false,
          failure: {
            category: 'invalid-proposal',
            retryable: true,
            scope: 'plan',
            message: `unknown action class: ${raw.actionClass}`,
            causeCode: 'unknown-action-class',
          },
        };
      }

      // Resolve the target resource identity.
      let resource: StableResourceIdentity;
      try {
        const resolved = resolveResource(ctx.workspace, raw.target, {
          fsProbe: ctx.fsProbe,
          computeDigest: true,
          includeVersion: true,
        });
        resource = {
          canonicalPath: resolved.canonicalPath,
          displayPath: resolved.displayPath,
          expectedDigest: resolved.expectedDigest,
          version: resolved.version,
          identityProven: resolved.identityProven,
        };
      } catch {
        // Resource cannot be resolved — exclude it.
        excludedEffects.push({
          target: raw.target,
          reason: 'target cannot be resolved within workspace',
          reasonCode: 'unresolvable-target',
        });
        continue;
      }

      // Check containment.
      const containment = checkContainment(ctx.workspace, raw.target, {
        fsProbe: ctx.fsProbe,
        followSymlinks: false,
        followJunctions: false,
        followMountPoints: false,
        followReparsePoints: false,
      });
      if (containment.outcome !== 'allowed') {
        excludedEffects.push({
          target: raw.target,
          reason: `containment check failed: ${containment.reason}`,
          reasonCode: 'containment-violation',
        });
        continue;
      }

      // Build the proposal based on action class.
      switch (raw.actionClass) {
        case 'create_file': {
          const content = raw.content ?? new Uint8Array(0);
          const contentDigest = computeDigest(content);
          const actionDigest = computeActionDigest(raw.actionClass, resource.canonicalPath, contentDigest);
          const binaryStatus = detectBinary(content);

          const preImage: PreImage = {
            expectedDigest: null,
            expectedVersion: null,
            sizeBytes: null,
            absent: true,
          };

          const postImage: PostImage = {
            digest: contentDigest,
            sizeBytes: content.length,
            content,
          };

          const proposal: CreateFileProposal = {
            kind: 'create_file',
            proposalId,
            resource,
            actionDigest,
            preImage,
            postImage,
            renameAlias: raw.renameAlias ?? [],
            binaryStatus,
            excludedEffects: [],
          };

          proposals.push(proposal);
          totalCheckpointSizeBytes += content.length;
          if (binaryStatus === 'binary') binaryCount++;
          else textCount++;
          break;
        }

        case 'edit_file': {
          const content = raw.content ?? new Uint8Array(0);
          const contentDigest = computeDigest(content);
          const actionDigest = computeActionDigest(raw.actionClass, resource.canonicalPath, contentDigest);
          const binaryStatus = detectBinary(content);

          const preImage: PreImage = {
            expectedDigest: resource.expectedDigest,
            expectedVersion: resource.version,
            sizeBytes: null, // will be filled by preflight
            absent: false,
          };

          const postImage: PostImage = {
            digest: contentDigest,
            sizeBytes: content.length,
            content,
          };

          const proposal: EditFileProposal = {
            kind: 'edit_file',
            proposalId,
            resource,
            actionDigest,
            preImage,
            postImage,
            renameAlias: raw.renameAlias ?? [],
            binaryStatus,
            excludedEffects: [],
          };

          proposals.push(proposal);
          totalCheckpointSizeBytes += content.length;
          if (binaryStatus === 'binary') binaryCount++;
          else textCount++;
          break;
        }

        case 'delete_file': {
          const actionDigest = computeActionDigest(raw.actionClass, resource.canonicalPath, null);
          const binaryStatus: BinaryStatus = 'unknown';

          const preImage: PreImage = {
            expectedDigest: resource.expectedDigest,
            expectedVersion: resource.version,
            sizeBytes: null,
            absent: false,
          };

          const deletionManifest: DeletionManifest = {
            expectedDigest: resource.expectedDigest,
            expectedVersion: resource.version,
            sizeBytes: null,
          };

          const proposal: DeleteFileProposal = {
            kind: 'delete_file',
            proposalId,
            resource,
            actionDigest,
            preImage,
            postImage: null,
            deletionManifest,
            renameAlias: raw.renameAlias ?? [],
            binaryStatus,
            excludedEffects: [],
          };

          proposals.push(proposal);
          // Use string comparison to avoid TS literal type narrowing issues.
          if (String(binaryStatus) === 'binary') binaryCount++;
          else if (String(binaryStatus) === 'text') textCount++;
          break;
        }
      }
    }

    const estimatedCheckpointSize = estimateCheckpointSize(rawProposals);

    const mutationSet: MutationSet = {
      setId,
      operationId,
      proposals,
      totalCheckpointSizeBytes: estimatedCheckpointSize,
      totalStoreSizeBytes: estimatedCheckpointSize,
      binaryCount,
      textCount,
      excludedCount: excludedEffects.length,
      createdAt: ctx.clock(),
    };

    return { ok: true, mutationSet };
  } catch (e) {
    return {
      ok: false,
      failure: {
        category: 'planning-failed',
        retryable: true,
        scope: 'plan',
        message: `mutation planning failed: ${(e as Error).message}`,
        causeCode: 'planning-error',
      },
    };
  }
}
