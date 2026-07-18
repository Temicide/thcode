// Retention barrel export (Story 3.16).

export * from './types.js';
export { calculateRetention, isExpired, roundsRemaining } from './retention.js';
export { evaluateCapacity, recordUnprotectedOperation, recordNeverProtectedOperation } from './capacity.js';
export type { UnprotectedOperationRecord } from './capacity.js';
export {
  runCleanup,
  resumeCleanup,
  detectExpiredCheckpoints,
  markExpired,
} from './cleanup.js';
export {
  renderRetentionStatus,
  renderCapacityUsage,
  renderCleanupOutcome,
  renderRetentionStatusOutput,
  renderCapacityUsageOutput,
  renderCleanupOutcomeOutput,
} from './render.js';
