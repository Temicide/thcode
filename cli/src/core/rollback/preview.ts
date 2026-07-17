// Rollback preview rendering (Story 3.12, AD-6, AD-19, AD-20, AD-24, AD-28).
// Renders CheckpointSummary and RollbackPreview for narrow/redirected/headless
// output. Preserves canonical order: heading, purpose, risk, target, authority,
// Evidence completeness, outcome, next step. Exact rollback tokens, no color-only
// meaning (AC #5). UTF-8/Thai preserved through every layer.
//
// AC #4: selecting a checkpoint for possible rollback stages NOTHING — no target
// changes, approval, or native effect; the preview remains read-only until a
// later exact per-target analysis + apply decision (3.13/3.14).

import type { CheckpointSummary, RollbackPreview } from './types.js';
import { renderCommandOutput, type CommandOutput } from '../protocol/commandGrammar.js';

// --- Text rendering ---

/**
 * Render a CheckpointSummary as a human-readable text block for narrow/
 * redirected/headless output (AC #5). Preserves canonical order with exact
 * rollback tokens and no color-only meaning.
 */
export function renderCheckpointSummary(summary: CheckpointSummary): string {
  const lines: string[] = [];

  lines.push(`Checkpoint: ${summary.checkpointId}`);
  lines.push(`Prompt Round: ${summary.promptRoundId}`);
  lines.push(`Created: ${summary.createdAt}`);
  lines.push(`Observed: ${summary.observedAt}`);
  lines.push(`Age: ${summary.subsequentPromptAgeMs}ms`);
  lines.push(`Targets: ${summary.targetCount}`);
  lines.push(`Pre-digests: ${summary.preDigests.length > 0 ? summary.preDigests.join(', ') : '(none)'}`);
  lines.push(`Post-digests: ${summary.postDigests.length > 0 ? summary.postDigests.join(', ') : '(none)'}`);
  lines.push(`Rename info: ${summary.renameInfo.length > 0 ? summary.renameInfo.map((r) => `${r.from} -> ${r.to}${r.isRename ? ' (rename)' : ''}`).join('; ') : '(none)'}`);
  lines.push(`Retention expiry: ${summary.retentionExpiry ?? '(indefinite)'}`);
  lines.push(`Checkpoint usage: ${summary.perCheckpointUsageBytes} bytes`);
  lines.push(`Store usage: ${summary.storeUsageBytes} bytes`);
  lines.push(`Encryption: ${summary.encryptionState}`);
  lines.push(`Integrity: ${summary.integrityState}`);
  lines.push(`Coverage: ${summary.coverage}`);

  // Excluded effects (AD-19) — explicitly listed so the summary NEVER implies
  // the whole Prompt Round is reversible.
  const excluded = summary.excludedEffects;
  const hasExcluded =
    excluded.shell.length > 0 ||
    excluded.remote.length > 0 ||
    excluded.permission.length > 0 ||
    excluded.process.length > 0 ||
    excluded.symlinkSide.length > 0 ||
    excluded.external.length > 0 ||
    excluded.unknown.length > 0;

  if (hasExcluded) {
    lines.push('Excluded effects (NEVER claimed reversible — AD-19):');
    for (const e of excluded.shell) lines.push(`  shell: ${e.target} (${e.status})`);
    for (const e of excluded.remote) lines.push(`  remote: ${e.target} (${e.status})`);
    for (const e of excluded.permission) lines.push(`  permission: ${e.target} (${e.status})`);
    for (const e of excluded.process) lines.push(`  process: ${e.target} (${e.status})`);
    for (const e of excluded.symlinkSide) lines.push(`  symlink-side: ${e.target} (${e.status})`);
    for (const e of excluded.external) lines.push(`  external: ${e.target} (${e.status})`);
    for (const e of excluded.unknown) lines.push(`  unknown: ${e.target} (${e.status})`);
  } else {
    lines.push('Excluded effects: none');
  }

  return lines.join('\n');
}

/**
 * Render a RollbackPreview as a human-readable text block (AC #5).
 * Canonical order: heading, purpose, risk, target, authority, Evidence
 * completeness, outcome, next step. Exact rollback tokens, no color-only
 * meaning. Read-only — no target changes, approval, or native effect (AC #4).
 */
export function renderRollbackPreview(preview: RollbackPreview): string {
  const lines: string[] = [];

  // Heading
  lines.push(preview.heading);
  lines.push('');

  // Purpose
  lines.push(`Purpose: ${preview.purpose}`);
  lines.push('');

  // Risk (AD-19)
  lines.push(`Risk: ${preview.risk}`);
  lines.push('');

  // Target
  lines.push(`Target: ${preview.target}`);
  lines.push('');

  // Authority
  lines.push(`Authority: ${preview.authority}`);
  lines.push('');

  // Evidence completeness
  lines.push(`Evidence: ${preview.evidenceCompleteness}`);
  lines.push('');

  // Outcome
  lines.push(`Outcome: ${preview.outcome}`);
  lines.push('');

  // Next step
  lines.push(`Next: ${preview.nextStep}`);
  lines.push('');

  // Rollback tokens (exact, no color-only meaning)
  if (preview.rollbackTokens.length > 0) {
    lines.push('Rollback tokens:');
    for (const token of preview.rollbackTokens) {
      lines.push(`  /${token}`);
    }
  }

  return lines.join('\n');
}

/**
 * Render a list of CheckpointSummaries as a human-readable text block.
 */
export function renderCheckpointList(summaries: readonly CheckpointSummary[]): string {
  if (summaries.length === 0) {
    return 'No checkpoints found for the current session.';
  }

  const lines: string[] = [];
  lines.push(`Checkpoints (${summaries.length}):`);
  lines.push('');

  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i];
    lines.push(`[${i + 1}] ${s.checkpointId}`);
    lines.push(`    Prompt Round: ${s.promptRoundId}`);
    lines.push(`    Created: ${s.createdAt} (age: ${s.subsequentPromptAgeMs}ms)`);
    lines.push(`    Targets: ${s.targetCount} | Coverage: ${s.coverage} | Integrity: ${s.integrityState}`);
    lines.push(`    Usage: ${s.perCheckpointUsageBytes}B / ${s.storeUsageBytes}B store`);
    lines.push(`    Encryption: ${s.encryptionState} | Retention: ${s.retentionExpiry ?? 'indefinite'}`);

    // Excluded effects summary (AD-19).
    const excluded = s.excludedEffects;
    const excludedCount =
      excluded.shell.length +
      excluded.remote.length +
      excluded.permission.length +
      excluded.process.length +
      excluded.symlinkSide.length +
      excluded.external.length +
      excluded.unknown.length;
    if (excludedCount > 0) {
      lines.push(`    Excluded effects: ${excludedCount} (NEVER claimed reversible — AD-19)`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render a rollback list as a CommandOutput for narrow/redirected/headless
 * parity (AC #5).
 */
export function renderRollbackListOutput(
  summaries: readonly CheckpointSummary[],
): CommandOutput {
  const body = renderCheckpointList(summaries);
  return renderCommandOutput({
    status: 'succeeded',
    body,
    nextStep: 'use /rollback inspect <id> for details',
  });
}

/**
 * Render a rollback inspect result as a CommandOutput for narrow/redirected/
 * headless parity (AC #5). Read-only — no target changes, approval, or native
 * effect (AC #4).
 */
export function renderRollbackInspectOutput(preview: RollbackPreview): CommandOutput {
  const body = renderRollbackPreview(preview);
  return renderCommandOutput({
    status: 'succeeded',
    body,
    nextStep: preview.nextStep,
  });
}
