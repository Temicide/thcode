// Capacity evaluation for rollback protection (Story 3.16 AC #2, AC #3, AD-19).
// AC #2: a proposed checkpoint exceeds 100 MB or the store would exceed 500 MB
// -> mutation preflight reports `over-cap`, identifies exact checkpoint/store
// usage + unprotected scope, does NOT silently evict active protection, and
// requires explicit confirmation to proceed WITHOUT rollback protection;
// Full Access CANNOT suppress this disclosure or alter the cap implicitly.
//
// AC #3: the action is explicitly confirmed unprotected -> the user-visible
// operation records `unprotected`/`never-protected`, states that only built-in
// changes within retained checkpoint coverage may later be reversible, and
// follows the normal exact mutation order with NO fabricated checkpoint reference.
//
// AD-19 rollback honesty: automatic rollback covers checkpointed built-in
// create/edit/delete ONLY. Shell, process, remote, permission, symlink-side,
// and external effects are NEVER claimed reversible. Over-cap actions require
// explicit confirmation without rollback protection.

import { PER_CHECKPOINT_CAP_BYTES, STORE_CAP_BYTES } from '../mutations/types.js';
import type { CapacityUsage, OverCapResult, OverCapUnprotectedScope } from './types.js';

/**
 * Evaluate a proposed checkpoint against capacity caps (AC #2).
 *
 * When over-cap:
 * - Reports `over-cap` with exact checkpoint/store usage and unprotected scope.
 * - Does NOT silently evict active protection.
 * - Requires explicit confirmation to proceed WITHOUT rollback protection.
 * - Full Access CANNOT suppress this disclosure or alter the cap implicitly.
 *
 * @param checkpointSizeBytes - Estimated size of the proposed checkpoint.
 * @param currentStoreUsageBytes - Current total store usage.
 * @param targetPaths - The target paths that would be affected (for unprotected scope).
 * @returns OverCapResult with exact usage and unprotected scope when over-cap.
 */
export function evaluateCapacity(
  checkpointSizeBytes: number,
  currentStoreUsageBytes: number,
  targetPaths: readonly string[],
): OverCapResult {
  const estimatedStoreUsageBytes = currentStoreUsageBytes + checkpointSizeBytes;

  const usage: CapacityUsage = {
    checkpointSizeBytes,
    storeUsageBytes: currentStoreUsageBytes,
    estimatedStoreUsageBytes,
    perCheckpointCapBytes: PER_CHECKPOINT_CAP_BYTES,
    storeCapBytes: STORE_CAP_BYTES,
    withinLimits: checkpointSizeBytes <= PER_CHECKPOINT_CAP_BYTES && estimatedStoreUsageBytes <= STORE_CAP_BYTES,
  };

  if (usage.withinLimits) {
    return { ok: true, usage };
  }

  // Build over-cap reason.
  let overCapReason: string;
  if (checkpointSizeBytes > PER_CHECKPOINT_CAP_BYTES) {
    overCapReason = `checkpoint size ${checkpointSizeBytes} bytes exceeds per-checkpoint cap of ${PER_CHECKPOINT_CAP_BYTES} bytes (100 MB)`;
  } else {
    overCapReason = `estimated store usage ${estimatedStoreUsageBytes} bytes exceeds store cap of ${STORE_CAP_BYTES} bytes (500 MB)`;
  }

  // Build unprotected scope.
  const unprotectedScope: OverCapUnprotectedScope = {
    targets: [...targetPaths],
    residualRisk: 'Over-cap operations proceed WITHOUT rollback protection. Only built-in changes within retained checkpoint coverage may later be reversible. Shell, process, remote, permission, symlink-side, and external effects are NEVER claimed reversible (AD-19).',
    reason: overCapReason,
  };

  return {
    ok: false,
    overCap: true,
    usage,
    overCapReason,
    unprotectedScope,
    requiresExplicitConfirmation: true,
  };
}

/**
 * Record an unprotected operation (AC #3).
 *
 * When the action is explicitly confirmed unprotected:
 * - The user-visible operation records `unprotected`/`never-protected`.
 * - States that only built-in changes within retained checkpoint coverage
 *   may later be reversible.
 * - Follows the normal exact mutation order with NO fabricated checkpoint reference.
 *
 * @param operationId - The operation being recorded.
 * @param targetPaths - The target paths that are unprotected.
 * @param reason - The reason for unprotected status.
 * @returns A record of the unprotected operation.
 */
export function recordUnprotectedOperation(
  operationId: string,
  targetPaths: readonly string[],
  reason: string,
): UnprotectedOperationRecord {
  return {
    operationId,
    protectionStatus: 'unprotected' as const,
    reason,
    targets: [...targetPaths],
    reversibleStatement: 'Only built-in changes within retained checkpoint coverage may later be reversible. Shell, process, remote, permission, symlink-side, and external effects are NEVER claimed reversible (AD-19).',
    hasFabricatedCheckpointReference: false,
    recordedAt: new Date().toISOString(),
  };
}

/**
 * Record a never-protected operation (AC #3).
 * For effects that are inherently never protectable (shell, process, remote, etc.).
 */
export function recordNeverProtectedOperation(
  operationId: string,
  targetPaths: readonly string[],
  reason: string,
): UnprotectedOperationRecord {
  return {
    operationId,
    protectionStatus: 'never-protected' as const,
    reason,
    targets: [...targetPaths],
    reversibleStatement: 'Only built-in changes within retained checkpoint coverage may later be reversible. Shell, process, remote, permission, symlink-side, and external effects are NEVER claimed reversible (AD-19).',
    hasFabricatedCheckpointReference: false,
    recordedAt: new Date().toISOString(),
  };
}

/**
 * Record of an unprotected or never-protected operation.
 */
export interface UnprotectedOperationRecord {
  readonly operationId: string;
  readonly protectionStatus: 'unprotected' | 'never-protected';
  readonly reason: string;
  readonly targets: readonly string[];
  readonly reversibleStatement: string;
  readonly hasFabricatedCheckpointReference: false;
  readonly recordedAt: string;
}
