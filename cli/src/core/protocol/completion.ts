// Post-commit completion + terminal semantics (Story 2.12, FR-37, FR-38,
// FR-39, AD-3, AD-13, AD-28). Completion means durable, attributable terminal
// Evidence — exactly one terminal outcome is appended and made visible AFTER
// the journal has committed the post-dispatch Evidence, result/provenance,
// timing, and sanitizer outcome; transient callbacks cannot emit completion
// (AC #1). The terminal projection carries OperationId, PromptRoundId,
// authority revision, action/target digests, deterministic cause, Evidence
// completeness/provenance, duration, next step, and the stable outcome token;
// it never leads an unresolved outcome with affirmative success language
// (AC #2). Before dispatch commit, cancellation/denial/revocation/stale end
// `cancelled`/`failed`/`blocked`/`stale` without consuming effect authority or
// claiming an effect occurred (AC #3). After commit with an unproven outcome,
// the operation is `unknown-outcome` (or a supported interruption state),
// preserves known Evidence, prevents automatic equivalent retry, and exposes
// reconciliation/inspection rather than a cancellation fiction (AC #4). A
// duplicated completion event or late progress cannot reopen or overwrite the
// one authoritative terminal result (AC #5). The exit mapping is exact and
// stable from ux-state-v1 (AC #6): normal result content on stdout,
// warnings/diagnostics/progress on stderr, JSON `null` for nonterminal.

import { EXIT_CODES, type ExitClass } from './uxState.js';
import type { EvidenceCompleteness } from './events.js';
import { NOT_MEASURED } from './timing.js';

export type CompletionOutcome =
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'unknown-outcome'
  | 'reconciled'
  | 'blocked'
  | 'stale';

/** One durable terminal completion record (AC #1, AC #2). `committed` is true
 * only once the journal has committed the post-dispatch Evidence — until then
 * no completion is emitted (AC #1). */
export interface CompletionRecord {
  readonly operationId: string;
  readonly promptRoundId: string | null;
  readonly authorityRevision: number;
  readonly actionDigest: string | null;
  readonly targetDigest: string | null;
  readonly cause: string;
  readonly evidenceCompleteness: EvidenceCompleteness;
  readonly evidenceProvenance: 'deterministic' | 'model';
  readonly durationMs: number | typeof NOT_MEASURED;
  readonly nextStep: string;
  readonly outcome: CompletionOutcome;
  readonly exitClass: ExitClass;
  readonly exitCode: number | null;
  readonly committed: boolean;
}

export interface FinalizeCompletionInput {
  readonly operationId: string;
  readonly promptRoundId?: string | null;
  readonly authorityRevision: number;
  readonly actionDigest?: string | null;
  readonly targetDigest?: string | null;
  readonly cause: string;
  readonly evidenceCompleteness: EvidenceCompleteness;
  readonly evidenceProvenance?: 'deterministic' | 'model';
  readonly durationMs?: number | typeof NOT_MEASURED;
  readonly nextStep: string;
  readonly outcome: CompletionOutcome;
  /** AC #1: true only once the journal has committed the post-dispatch
   * Evidence/result/provenance/timing/sanitizer. Transient callers pass false. */
  readonly postCommitEvidenceCommitted: boolean;
}

/** AC #1, AC #2: build the terminal completion record. If the post-commit
 * Evidence has NOT committed, returns `null` — a transient callback cannot
 * emit completion. */
export function finalizeCompletion(input: FinalizeCompletionInput): CompletionRecord | null {
  if (!input.postCommitEvidenceCommitted) return null;
  // Completion outcomes are all terminal; derive the exit class from the
  // outcome (exitClassForOutcome) and the code from ux-state-v1's EXIT_CODES.
  // `exitCodeForStatus` is NOT used here because some completion outcomes
  // (e.g. `stale`) share a token with a nonterminal ux-state dimension and
  // would otherwise resolve to `null` — the completion semantic is terminal.
  const exitClass: ExitClass = exitClassForOutcome(input.outcome);
  const exitCode: number = EXIT_CODES[exitClass as Exclude<ExitClass, 'NONE'>];
  return {
    operationId: input.operationId,
    promptRoundId: input.promptRoundId ?? null,
    authorityRevision: input.authorityRevision,
    actionDigest: input.actionDigest ?? null,
    targetDigest: input.targetDigest ?? null,
    cause: input.cause,
    evidenceCompleteness: input.evidenceCompleteness,
    evidenceProvenance: input.evidenceProvenance ?? 'deterministic',
    durationMs: input.durationMs ?? NOT_MEASURED,
    nextStep: input.nextStep,
    outcome: input.outcome,
    exitClass,
    exitCode,
    committed: true,
  };
}

function exitClassForOutcome(outcome: CompletionOutcome): ExitClass {
  switch (outcome) {
    case 'succeeded': return 'SUCCESS';
    case 'reconciled': return 'SUCCESS';
    case 'failed': return 'FAILED';
    case 'blocked': return 'BLOCKED';
    case 'stale': return 'BLOCKED';
    case 'cancelled': return 'CANCELLED';
    case 'unknown-outcome': return 'UNKNOWN_OUTCOME';
  }
}

/** AC #4: an interruption with no proven terminal outcome is `unknown-outcome`
 * — preserves known Evidence, prevents automatic equivalent retry, and exposes
 * reconciliation/inspection. */
export function interruptionOutcome(dispatchCommitted: boolean, terminalProven: boolean): CompletionOutcome {
  if (dispatchCommitted && !terminalProven) return 'unknown-outcome';
  if (!dispatchCommitted) return 'cancelled';
  return 'succeeded';
}

/** AC #2: never lead an unresolved outcome with affirmative success language.
 * Returns a non-affirmative lead token for unresolved outcomes. */
export function leadLanguageForOutcome(outcome: CompletionOutcome): string {
  switch (outcome) {
    case 'succeeded': return 'Completed';
    case 'reconciled': return 'Reconciled';
    case 'unknown-outcome': return 'Unknown outcome — reconcile before proceeding';
    case 'blocked': return 'Blocked';
    case 'stale': return 'Stale — re-evaluate';
    case 'cancelled': return 'Cancelled';
    case 'failed': return 'Failed';
  }
}

/**
 * AC #5: one authoritative terminal result per operation. The first terminal
 * record wins; a duplicated completion event or a late progress event cannot
 * reopen or overwrite it. EventId dedup is the caller's responsibility for the
 * durable stream; this registry is the projection-side defense-in-depth.
 */
export class CompletionRegistry {
  private readonly terminals = new Map<string, CompletionRecord>();

  /** Record a terminal completion. Returns the authoritative record (the first
   * one); a later duplicate is rejected and reported as `reopened: false`. */
  recordTerminal(record: CompletionRecord): { authoritative: CompletionRecord; reopened: boolean } {
    const existing = this.terminals.get(record.operationId);
    if (existing) return { authoritative: existing, reopened: false };
    this.terminals.set(record.operationId, record);
    return { authoritative: record, reopened: true };
  }

  /** Late progress cannot reopen a terminal result (AC #5). Returns false if a
   * terminal result already exists for the operation. */
  canProgress(operationId: string): boolean {
    return !this.terminals.has(operationId);
  }

  isTerminal(operationId: string): boolean {
    return this.terminals.has(operationId);
  }

  get(operationId: string): CompletionRecord | undefined {
    return this.terminals.get(operationId);
  }
}

/** AC #6: split completion output across stdout/stderr/JSON with the exact
 * stable exit mapping. Normal result content → stdout; warnings/diagnostics/
 * progress → stderr; JSON carries status, cause, target, OperationId,
 * PromptRoundId, exit class/code, and next step. */
export interface CompletionOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly json: string;
  readonly exitCode: number | null;
}

export function renderCompletionOutput(record: CompletionRecord): CompletionOutput {
  const lead = leadLanguageForOutcome(record.outcome);
  const normal = `${lead}: ${record.cause}`;
  const warnings: string[] = [];
  if (record.evidenceCompleteness !== 'complete') warnings.push(`evidence ${record.evidenceCompleteness}`);
  if (record.outcome === 'unknown-outcome') warnings.push('dispatch committed, no terminal proof — reconcile; do not auto-retry');
  const stderr = warnings.length > 0 ? warnings.join('\n') : '';
  const json = JSON.stringify({
    status: record.outcome,
    cause: record.cause,
    target: record.targetDigest,
    operationId: record.operationId,
    promptRoundId: record.promptRoundId,
    exitClass: record.exitClass,
    exitCode: record.exitCode,
    nextStep: record.nextStep,
  });
  return { stdout: normal, stderr, json, exitCode: record.exitCode };
}