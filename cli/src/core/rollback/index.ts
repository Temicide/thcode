// Rollback barrel export (Story 3.12, Story 3.13, Story 3.14).

export * from './types.js';
export { listCheckpoints, inspectCheckpoint, buildRollbackPreview } from './discover.js';
export {
  renderCheckpointSummary,
  renderRollbackPreview,
  renderCheckpointList,
  renderRollbackListOutput,
  renderRollbackInspectOutput,
} from './preview.js';
export { analyzeRollbackTarget, analyzeRollbackSet } from './analysis.js';
export { applyRollback } from './apply.js';
