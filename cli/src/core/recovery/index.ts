// Recovery module barrel export (Story 3.15).

export { classify, detectCheckpointMaterial } from './classify.js';
export type { ClassifyInput, ClassifyResult, CheckpointMaterialInput } from './classify.js';
export {
  evaluateNoDispatchCommit,
  evaluateDispatchCommittedMissingResult,
  evaluateCommittedMutationFailedReference,
  reconcileOperation,
} from './evaluate.js';
export type {
  NoDispatchCommitInput,
  DispatchCommittedMissingResultInput,
  CommittedMutationFailedReferenceInput,
  ReconcileResult,
} from './evaluate.js';
export { determineCancellationPhase, formatCancellationState } from './cancellation.js';
export type { CancellationInput } from './cancellation.js';
export {
  buildRecoveryResult,
  renderRecoveryResult,
  renderRecoveryInspect,
  renderRecoveryReconcile,
  renderRecoveryExport,
  renderRecoveryExit,
  renderRetryDisabledExplanation,
  renderRecoveryHelp,
} from './render.js';
export type {
  BuildRecoveryResultInput,
  RecoveryInspectOutput,
  RecoveryReconcileOutput,
  RecoveryExportOutput,
  RecoveryExitOutput,
} from './render.js';
export type {
  OperationRecoveryState,
  RecoveryClassification,
  RecoveryAction,
  RecoveryResult,
  RecoveryEvaluationResult,
  CancellationPhase,
  CancellationState,
  RecoveryFailure,
  RecoveryFailureCategory,
  CheckpointMaterialState,
  DispatchClassification,
  ResidualRisk,
  RollbackScopeLabel,
  RecoveryInspectInput,
  RecoveryReconcileInput,
  RecoveryExportInput,
} from './types.js';
