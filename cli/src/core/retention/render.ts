// Retention and capacity status rendering (Story 3.16 AC #6, AD-19, AD-24, AD-28).
// AC #6: retention/capacity status displayed in the rollback panel, activity log,
// completion summary, or headless output -> shows encryption/integrity status,
// age/window, cap usage, exclusions, and exact next steps in narrow/noninteractive
// forms, with NO claim that shell/remote/permission/process/symlink-side/external
// effects are reversible (AD-19).
//
// AD-19 rollback honesty: automatic rollback covers checkpointed built-in
// create/edit/delete ONLY. Shell, process, remote, permission, symlink-side,
// and external effects are NEVER claimed reversible.

import type { CapacityUsage, RetentionStatus } from './types.js';
import type { CleanupOutcome } from './types.js';
import { renderCommandOutput, type CommandOutput } from '../protocol/commandGrammar.js';

/**
 * Render a RetentionStatus for narrow/noninteractive output (AC #6).
 * Shows encryption/integrity status, age/window, cap usage, exclusions, and
 * exact next steps. Makes NO claim that excluded effects are reversible.
 */
export function renderRetentionStatus(status: RetentionStatus): string {
  const lines: string[] = [];

  lines.push(`Checkpoint: ${status.checkpointId}`);
  lines.push(`Encryption: ${status.encryptionState}`);
  lines.push(`Integrity: ${status.integrityState}`);
  lines.push(`Age: ${status.ageMs}ms`);
  lines.push(`Retention window: ${status.retentionWindow} Prompt Round(s)`);
  lines.push(`Expiry: ${status.expiryPromptRound !== null ? `Prompt Round ${status.expiryPromptRound}` : '(indefinite)'}`);

  if (status.capUsage) {
    const cap = status.capUsage;
    lines.push(`Checkpoint usage: ${cap.checkpointSizeBytes} bytes / ${cap.perCheckpointCapBytes} bytes cap`);
    lines.push(`Store usage: ${cap.storeUsageBytes} bytes / ${cap.storeCapBytes} bytes cap`);
    lines.push(`Within limits: ${cap.withinLimits ? 'yes' : 'no'}`);
  }

  if (status.exclusions.length > 0) {
    lines.push('Exclusions:');
    for (const exclusion of status.exclusions) {
      lines.push(`  - ${exclusion}`);
    }
  }

  // AD-19: NEVER claim excluded effects are reversible.
  lines.push('');
  lines.push('Automatic rollback covers checkpointed built-in create/edit/delete ONLY.');
  lines.push('Shell, process, remote, permission, symlink-side, and external effects are NEVER claimed reversible (AD-19).');

  if (status.nextSteps.length > 0) {
    lines.push('');
    lines.push('Next steps:');
    for (const step of status.nextSteps) {
      lines.push(`  - ${step}`);
    }
  }

  return lines.join('\n');
}

/**
 * Render a CapacityUsage for narrow/noninteractive output.
 */
export function renderCapacityUsage(usage: CapacityUsage): string {
  const lines: string[] = [];

  lines.push(`Checkpoint size: ${usage.checkpointSizeBytes} bytes`);
  lines.push(`Current store usage: ${usage.storeUsageBytes} bytes`);
  lines.push(`Estimated store usage: ${usage.estimatedStoreUsageBytes} bytes`);
  lines.push(`Per-checkpoint cap: ${usage.perCheckpointCapBytes} bytes (100 MB)`);
  lines.push(`Store cap: ${usage.storeCapBytes} bytes (500 MB)`);
  lines.push(`Within limits: ${usage.withinLimits ? 'yes' : 'no'}`);

  if (!usage.withinLimits) {
    lines.push('');
    lines.push('Over-cap: this operation exceeds capacity limits.');
    lines.push('Proceeding WITHOUT rollback protection requires explicit confirmation.');
    lines.push('Only built-in changes within retained checkpoint coverage may later be reversible.');
    lines.push('Shell, process, remote, permission, symlink-side, and external effects are NEVER claimed reversible (AD-19).');
  }

  return lines.join('\n');
}

/**
 * Render a CleanupOutcome for narrow/noninteractive output.
 */
export function renderCleanupOutcome(outcome: CleanupOutcome): string {
  const lines: string[] = [];

  switch (outcome.kind) {
    case 'removed':
      lines.push(`Checkpoint ${outcome.checkpointId}: removed successfully.`);
      break;
    case 'recovery-locked':
      lines.push(`Checkpoint ${outcome.checkpointId}: recovery-locked.`);
      lines.push(`Reason: ${outcome.reason}`);
      if (outcome.secureDeletionLimitation) {
        lines.push(`Secure deletion limitation: ${outcome.secureDeletionLimitation}`);
      }
      lines.push('Safe actions:');
      for (const action of outcome.safeActions) {
        lines.push(`  - ${action.kind}`);
      }
      break;
    case 'corrupt':
      lines.push(`Checkpoint ${outcome.checkpointId}: corrupt.`);
      lines.push(`Reason: ${outcome.reason}`);
      if (outcome.secureDeletionLimitation) {
        lines.push(`Secure deletion limitation: ${outcome.secureDeletionLimitation}`);
      }
      lines.push('Safe actions:');
      for (const action of outcome.safeActions) {
        lines.push(`  - ${action.kind}`);
      }
      break;
  }

  return lines.join('\n');
}

/**
 * Render retention status as a CommandOutput for narrow/redirected/headless
 * parity (AC #6).
 */
export function renderRetentionStatusOutput(status: RetentionStatus): CommandOutput {
  const body = renderRetentionStatus(status);
  return renderCommandOutput({
    status: 'succeeded',
    body,
    nextStep: 'use /rollback list to see all checkpoints',
  });
}

/**
 * Render capacity usage as a CommandOutput.
 */
export function renderCapacityUsageOutput(usage: CapacityUsage): CommandOutput {
  const body = renderCapacityUsage(usage);
  return renderCommandOutput({
    status: usage.withinLimits ? 'succeeded' : 'blocked',
    body,
    nextStep: usage.withinLimits ? 'continue' : 'confirm unprotected operation to proceed',
  });
}

/**
 * Render cleanup outcome as a CommandOutput.
 */
export function renderCleanupOutcomeOutput(outcome: CleanupOutcome): CommandOutput {
  const body = renderCleanupOutcome(outcome);
  const status = outcome.kind === 'removed' ? 'succeeded' : 'blocked';
  return renderCommandOutput({
    status,
    body,
    nextStep: outcome.kind === 'removed' ? 'continue' : 'inspect the checkpoint store',
  });
}
