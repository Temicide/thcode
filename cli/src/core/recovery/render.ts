// Recovery rendering for narrow/redirected/headless parity (Story 3.15, AC #6,
// AD-28). `/recover` is the SINGLE entry point with inspect, reconcile where
// supported, export-safe-evidence, retry-disabled explanation, and exit;
// unresolved state remains visible with stable exit class/code.
//
// Pure, injectable: accepts all dependencies as parameters so it stays
// unit-testable without fs/network/journal.

import { EXIT_CODES, type ExitClass } from '../protocol/uxState.js';
import type { CommandOutput } from '../protocol/commandGrammar.js';
import type {
  OperationRecoveryState,
  RecoveryAction,
  RecoveryClassification,
  RecoveryResult,
} from './types.js';

// --- Recovery result builder ---

export interface BuildRecoveryResultInput {
  readonly classification: RecoveryClassification;
  readonly action: RecoveryAction;
  readonly nextStep: string;
  readonly body?: string;
}

/**
 * Build a RecoveryResult from a classification and action (AC #6).
 * Follows narrow/headless canonical order: heading, purpose, state,
 * residual risk, action, next step, stable exit class/code.
 */
export function buildRecoveryResult(input: BuildRecoveryResultInput): RecoveryResult {
  const { classification, action, nextStep, body } = input;
  const { journalState, residualRisk } = classification;

  const heading = recoveryHeading(journalState);
  const purpose = recoveryPurpose(journalState);
  const { exitClass, exitCode } = recoveryExit(journalState);

  return {
    heading,
    purpose,
    state: journalState,
    residualRisk,
    action,
    nextStep,
    exitClass,
    exitCode,
    body,
  };
}

// --- Recovery heading ---

function recoveryHeading(state: OperationRecoveryState): string {
  switch (state) {
    case 'not-sent': return 'RECOVERY: NOT SENT';
    case 'prepared': return 'RECOVERY: PREPARED';
    case 'dispatch-committed': return 'RECOVERY: DISPATCH COMMITTED';
    case 'succeeded': return 'RECOVERY: SUCCEEDED';
    case 'failed': return 'RECOVERY: FAILED';
    case 'cancelled': return 'RECOVERY: CANCELLED';
    case 'unknown-outcome': return 'RECOVERY: UNKNOWN OUTCOME';
  }
}

// --- Recovery purpose ---

function recoveryPurpose(state: OperationRecoveryState): string {
  switch (state) {
    case 'not-sent': return 'Operation was never dispatched. No native effect was started.';
    case 'prepared': return 'Operation was prepared but never dispatched. Checkpoint material may be incomplete.';
    case 'dispatch-committed': return 'Effect was dispatched but no terminal outcome is recorded. The native mutation may have committed.';
    case 'succeeded': return 'Operation completed successfully. No recovery action needed.';
    case 'failed': return 'Operation failed deterministically. Review evidence and retry with corrections.';
    case 'cancelled': return 'Operation was cancelled before dispatch commit. No native effect was started.';
    case 'unknown-outcome': return 'No terminal proof exists. The native mutation may have committed with unknown result.';
  }
}

// --- Recovery exit mapping ---

function recoveryExit(state: OperationRecoveryState): { exitClass: ExitClass; exitCode: number } {
  switch (state) {
    case 'not-sent': return { exitClass: 'SUCCESS', exitCode: EXIT_CODES.SUCCESS };
    case 'prepared': return { exitClass: 'BLOCKED', exitCode: EXIT_CODES.BLOCKED };
    case 'dispatch-committed': return { exitClass: 'UNKNOWN_OUTCOME', exitCode: EXIT_CODES.UNKNOWN_OUTCOME };
    case 'succeeded': return { exitClass: 'SUCCESS', exitCode: EXIT_CODES.SUCCESS };
    case 'failed': return { exitClass: 'FAILED', exitCode: EXIT_CODES.FAILED };
    case 'cancelled': return { exitClass: 'CANCELLED', exitCode: EXIT_CODES.CANCELLED };
    case 'unknown-outcome': return { exitClass: 'UNKNOWN_OUTCOME', exitCode: EXIT_CODES.UNKNOWN_OUTCOME };
  }
}

// --- Render recovery result as CommandOutput (AC #6) ---

/**
 * Render a RecoveryResult as a CommandOutput for narrow/redirected/headless
 * parity (AC #6). The output includes:
 * - heading (e.g. "RECOVERY: DISPATCH COMMITTED")
 * - purpose
 * - state
 * - residual risk
 * - action
 * - next step
 * - stable exit class/code
 *
 * Unresolved state remains visible with stable exit class/code.
 */
export function renderRecoveryResult(result: RecoveryResult): CommandOutput {
  const lines: string[] = [
    result.heading,
    '',
    `Purpose: ${result.purpose}`,
    `State: ${result.state}`,
    `Residual risk: ${result.residualRisk.description} (${result.residualRisk.severity})`,
    `Action: ${result.action}`,
    `Next step: ${result.nextStep}`,
  ];

  if (result.body) {
    lines.push('');
    lines.push(result.body);
  }

  const stdout = lines.join('\n');

  const json = JSON.stringify({
    status: result.state,
    heading: result.heading,
    purpose: result.purpose,
    residualRisk: result.residualRisk,
    action: result.action,
    nextStep: result.nextStep,
    exitClass: result.exitClass,
    exitCode: result.exitCode,
  });

  return {
    stdout,
    stderr: result.exitClass !== 'SUCCESS' ? `Recovery state: ${result.state}. ${result.nextStep}` : '',
    json,
    exitCode: result.exitCode,
  };
}

// --- Render recovery inspect output ---

export interface RecoveryInspectOutput {
  readonly classification: RecoveryClassification;
  readonly result: RecoveryResult;
}

/**
 * Render a recovery inspect result (AC #6).
 * Shows the full classification including checkpoint material state.
 */
export function renderRecoveryInspect(input: RecoveryInspectOutput): CommandOutput {
  const { classification, result } = input;
  const lines: string[] = [
    result.heading,
    '',
    `Operation: ${classification.operationId}`,
    `Journal state: ${classification.journalState}`,
    `Operation state: ${classification.operationState}`,
    `Checkpoint material: ${classification.checkpointMaterial}`,
    `Dispatch classification: ${classification.dispatchClassification}`,
    `Has EffectDispatchCommitted: ${classification.hasEffectDispatchCommitted}`,
    `Has terminal event: ${classification.hasTerminalEvent}`,
    `Terminal kind: ${classification.terminalKind ?? 'none'}`,
    '',
    `Purpose: ${result.purpose}`,
    `Residual risk: ${result.residualRisk.description} (${result.residualRisk.severity})`,
    `Action: ${result.action}`,
    `Next step: ${result.nextStep}`,
  ];

  if (result.body) {
    lines.push('');
    lines.push(result.body);
  }

  const stdout = lines.join('\n');

  const json = JSON.stringify({
    status: result.state,
    operationId: classification.operationId,
    journalState: classification.journalState,
    operationState: classification.operationState,
    checkpointMaterial: classification.checkpointMaterial,
    dispatchClassification: classification.dispatchClassification,
    hasEffectDispatchCommitted: classification.hasEffectDispatchCommitted,
    hasTerminalEvent: classification.hasTerminalEvent,
    terminalKind: classification.terminalKind,
    residualRisk: result.residualRisk,
    action: result.action,
    nextStep: result.nextStep,
    exitClass: result.exitClass,
    exitCode: result.exitCode,
  });

  return {
    stdout,
    stderr: result.exitClass !== 'SUCCESS' ? `Recovery state: ${result.state}. ${result.nextStep}` : '',
    json,
    exitCode: result.exitCode,
  };
}

// --- Render recovery reconcile output ---

export interface RecoveryReconcileOutput {
  readonly operationId: string;
  readonly details: readonly string[];
  readonly rollbackScopeLabel: string;
  readonly result: RecoveryResult;
}

/**
 * Render a recovery reconcile result (AC #6).
 * Shows reconciliation details and rollback scope label.
 */
export function renderRecoveryReconcile(input: RecoveryReconcileOutput): CommandOutput {
  const { operationId, details, rollbackScopeLabel, result } = input;
  const lines: string[] = [
    result.heading,
    '',
    `Operation: ${operationId}`,
    `Rollback scope: ${rollbackScopeLabel}`,
    '',
    'Reconciliation details:',
    ...(details.length > 0 ? details.map((d) => `  - ${d}`) : ['  (none)']),
    '',
    `Purpose: ${result.purpose}`,
    `Residual risk: ${result.residualRisk.description} (${result.residualRisk.severity})`,
    `Action: ${result.action}`,
    `Next step: ${result.nextStep}`,
  ];

  const stdout = lines.join('\n');

  const json = JSON.stringify({
    status: result.state,
    operationId,
    rollbackScopeLabel,
    reconciliationDetails: details,
    residualRisk: result.residualRisk,
    action: result.action,
    nextStep: result.nextStep,
    exitClass: result.exitClass,
    exitCode: result.exitCode,
  });

  return {
    stdout,
    stderr: result.exitClass !== 'SUCCESS' ? `Recovery state: ${result.state}. ${result.nextStep}` : '',
    json,
    exitCode: result.exitCode,
  };
}

// --- Render recovery export output ---

export interface RecoveryExportOutput {
  readonly operationId: string;
  readonly evidence: readonly { readonly kind: string; readonly operationId: string }[];
  readonly result: RecoveryResult;
}

/**
 * Render a recovery export result (AC #6).
 * Shows sanitized evidence for the operation.
 */
export function renderRecoveryExport(input: RecoveryExportOutput): CommandOutput {
  const { operationId, evidence, result } = input;
  const lines: string[] = [
    result.heading,
    '',
    `Operation: ${operationId}`,
    '',
    'Sanitized evidence (AD-24):',
    ...(evidence.length > 0
      ? evidence.map((e) => `  - ${e.kind} (operation: ${e.operationId})`)
      : ['  (no evidence found)']),
    '',
    `Purpose: ${result.purpose}`,
    `Residual risk: ${result.residualRisk.description} (${result.residualRisk.severity})`,
    `Action: ${result.action}`,
    `Next step: ${result.nextStep}`,
  ];

  const stdout = lines.join('\n');

  const json = JSON.stringify({
    status: result.state,
    operationId,
    evidenceCount: evidence.length,
    residualRisk: result.residualRisk,
    action: result.action,
    nextStep: result.nextStep,
    exitClass: result.exitClass,
    exitCode: result.exitCode,
  });

  return {
    stdout,
    stderr: result.exitClass !== 'SUCCESS' ? `Recovery state: ${result.state}. ${result.nextStep}` : '',
    json,
    exitCode: result.exitCode,
  };
}

// --- Render recovery exit output ---

export interface RecoveryExitOutput {
  readonly unresolvedState: boolean;
  readonly result: RecoveryResult;
}

/**
 * Render a recovery exit result (AC #6).
 * Shows unresolved state if present, with stable exit class/code.
 */
export function renderRecoveryExit(input: RecoveryExitOutput): CommandOutput {
  const { unresolvedState, result } = input;
  const lines: string[] = [
    result.heading,
    '',
    `Purpose: ${result.purpose}`,
    `State: ${result.state}`,
    `Residual risk: ${result.residualRisk.description} (${result.residualRisk.severity})`,
    `Action: ${result.action}`,
    `Next step: ${result.nextStep}`,
  ];

  if (unresolvedState) {
    lines.push('');
    lines.push('WARNING: Unresolved state remains. The operation may have unproven outcomes.');
    lines.push('Run /recover inspect to review the full classification.');
  }

  const stdout = lines.join('\n');

  const json = JSON.stringify({
    status: result.state,
    unresolvedState,
    residualRisk: result.residualRisk,
    action: result.action,
    nextStep: result.nextStep,
    exitClass: result.exitClass,
    exitCode: result.exitCode,
  });

  return {
    stdout,
    stderr: unresolvedState ? 'Unresolved state remains. Review with /recover inspect.' : '',
    json,
    exitCode: result.exitCode,
  };
}

// --- Retry-disabled explanation (AC #6) ---

/**
 * Render the retry-disabled explanation (AC #6).
 * Recovery NEVER replays a native effect automatically.
 */
export function renderRetryDisabledExplanation(): string {
  return [
    'RETRY DISABLED',
    '',
    'Recovery does not support automatic retry of interrupted operations.',
    'Blind re-execution or equivalent retry is PROHIBITED (AD-13, AD-19).',
    '',
    'Available actions:',
    '  - /recover inspect <operationId> — classify the operation from the journal',
    '  - /recover reconcile <operationId> — reconcile checkpoint material (where supported)',
    '  - /recover export <operationId> — export sanitized evidence',
    '  - /recover exit — exit recovery with stable exit class/code',
    '',
    'If you need to retry, create a new operation with a fresh proposal.',
  ].join('\n');
}

// --- Recovery entry point help (AC #6) ---

/**
 * Render the recovery entry point help (AC #6).
 * `/recover` is the SINGLE entry point with inspect, reconcile where supported,
 * export-safe-evidence, retry-disabled explanation, and exit.
 */
export function renderRecoveryHelp(): CommandOutput {
  const stdout = [
    'RECOVERY ENTRY POINT',
    '',
    '/recover is the single entry point for recovering interrupted checkpoint',
    'and mutation operations.',
    '',
    'Subcommands:',
    '  /recover inspect <operationId> — classify the operation from the journal',
    '  /recover reconcile <operationId> — reconcile checkpoint material (where supported)',
    '  /recover export <operationId> — export sanitized evidence (AD-24)',
    '  /recover exit — exit recovery with stable exit class/code',
    '',
    'Retry is DISABLED. Recovery NEVER replays a native effect automatically.',
    'Unresolved state remains visible with stable exit class/code.',
  ].join('\n');

  const json = JSON.stringify({
    status: 'recovery-entry',
    subcommands: ['inspect', 'reconcile', 'export', 'exit'],
    retryDisabled: true,
    exitClass: 'SUCCESS',
    exitCode: EXIT_CODES.SUCCESS,
  });

  return {
    stdout,
    stderr: '',
    json,
    exitCode: EXIT_CODES.SUCCESS,
  };
}
