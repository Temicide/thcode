// Story 2.12: post-commit completion + terminal semantics.
import { describe, expect, it } from 'vitest';
import {
  CompletionRegistry,
  finalizeCompletion,
  interruptionOutcome,
  leadLanguageForOutcome,
  renderCompletionOutput,
  type CompletionOutcome,
} from '../src/core/protocol/completion.js';

const baseInput = {
  operationId: 'op-1', promptRoundId: 'r1', authorityRevision: 1, actionDigest: 'd', targetDigest: 't',
  cause: 'ok', evidenceCompleteness: 'complete' as const, nextStep: 'continue', postCommitEvidenceCommitted: true,
};

describe('Completion — durable terminal Evidence only (AC #1)', () => {
  it('emits completion only after the journal commits post-dispatch Evidence', () => {
    const r = finalizeCompletion({ ...baseInput, outcome: 'succeeded' });
    expect(r).not.toBeNull();
    expect(r!.committed).toBe(true);
  });
  it('a transient callback (post-commit Evidence not committed) cannot emit completion', () => {
    const r = finalizeCompletion({ ...baseInput, outcome: 'succeeded', postCommitEvidenceCommitted: false });
    expect(r).toBeNull();
  });
});

describe('Completion — terminal projection fields (AC #2)', () => {
  it('includes OperationId, PromptRoundId, authority revision, digests, cause, evidence, duration, next step, outcome, exit class/code', () => {
    const r = finalizeCompletion({ ...baseInput, outcome: 'failed', cause: 'compile-error', evidenceCompleteness: 'complete', durationMs: 120, nextStep: 'fix source' })!;
    expect(r.operationId).toBe('op-1');
    expect(r.promptRoundId).toBe('r1');
    expect(r.authorityRevision).toBe(1);
    expect(r.actionDigest).toBe('d');
    expect(r.durationMs).toBe(120);
    expect(r.outcome).toBe('failed');
    expect(r.exitClass).toBe('FAILED');
    expect(r.exitCode).toBe(1);
  });
  it('never leads an unresolved outcome with affirmative success language', () => {
    expect(leadLanguageForOutcome('unknown-outcome')).not.toMatch(/succeed|complete/i);
    expect(leadLanguageForOutcome('succeeded')).toMatch(/complete/i);
  });
});

describe('Completion — before/after dispatch commit (AC #3, #4)', () => {
  it('before commit, cancellation/denial/stale end without consuming effect authority', () => {
    const cancelled = finalizeCompletion({ ...baseInput, outcome: 'cancelled', cause: 'user-cancelled', nextStep: 'rerun if intended' })!;
    expect(cancelled.outcome).toBe('cancelled');
    expect(cancelled.exitCode).toBe(130);
  });
  it('after commit with an unproven outcome is unknown-outcome — no cancellation fiction, no auto-retry', () => {
    expect(interruptionOutcome(true, false)).toBe('unknown-outcome');
    expect(interruptionOutcome(false, false)).toBe('cancelled');
    expect(interruptionOutcome(true, true)).toBe('succeeded');
  });
});

describe('Completion — one authoritative terminal result (AC #5)', () => {
  it('a duplicated completion event does not reopen or overwrite the first terminal', () => {
    const reg = new CompletionRegistry();
    const r1 = finalizeCompletion({ ...baseInput, outcome: 'succeeded' })!;
    const first = reg.recordTerminal(r1);
    expect(first.reopened).toBe(true);
    const r2 = finalizeCompletion({ ...baseInput, outcome: 'failed', cause: 'late' })!;
    const second = reg.recordTerminal(r2);
    expect(second.reopened).toBe(false);
    expect(second.authoritative.outcome).toBe('succeeded');
  });
  it('late progress cannot reopen a terminal result', () => {
    const reg = new CompletionRegistry();
    reg.recordTerminal(finalizeCompletion({ ...baseInput, outcome: 'succeeded' })!);
    expect(reg.canProgress('op-1')).toBe(false);
    expect(reg.canProgress('op-2')).toBe(true);
  });
});

describe('Completion — exact stable exit mapping + stdout/stderr/JSON split (AC #6)', () => {
  const cases: Array<[CompletionOutcome, number]> = [
    ['succeeded', 0], ['reconciled', 0], ['failed', 1], ['blocked', 20], ['stale', 20], ['cancelled', 130], ['unknown-outcome', 70],
  ];
  for (const [outcome, code] of cases) {
    it(`${outcome} → exit ${code}`, () => {
      const r = finalizeCompletion({ ...baseInput, outcome, cause: 'c', nextStep: 'n' })!;
      expect(r.exitCode).toBe(code);
    });
  }
  it('normal result on stdout, warnings/diagnostics on stderr, JSON carries ids + exit mapping', () => {
    const r = finalizeCompletion({ ...baseInput, outcome: 'unknown-outcome', cause: 'interrupted', nextStep: 'reconcile' })!;
    const out = renderCompletionOutput(r);
    expect(out.stdout).toContain('Unknown outcome');
    expect(out.stderr).toContain('reconcile');
    expect(out.json).toContain('"exitCode":70');
    expect(out.json).toContain('"operationId":"op-1"');
    expect(out.exitCode).toBe(70);
  });
});