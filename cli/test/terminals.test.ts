// Story 3.10: Aggregate Agent Loop terminals and revalidate authority.
// Covers all 5 ACs offline with injected clock + fake journal. >=22 cases.
// No network/real creds.

import { describe, expect, it } from 'vitest';
import {
  aggregateTerminals,
  strongerTerminal,
  strongestUnresolved,
  revalidateAuthorityForNextEffect,
  dispatchCommittedOutcome,
  unprovenNativeResult,
  aggregateLeadLanguage,
  buildAggregateSummary,
  type TerminalAggregatorDeps,
  type RevalidateNextEffectInput,
} from '../src/core/agent/terminals.js';
import type {
  OperationTerminalKind,
  OperationTerminalState,
  AggregateRoundOutcome,
  RevalidationContext,
} from '../src/core/agent/types.js';
import { createAuthorization, type Authorization } from '../src/core/permissions/authorization.js';
import type { PepDecision } from '../src/core/permissions/pep.js';

// Deterministic, monotonically increasing clock.
const fixedClock = (() => {
  let n = 0;
  const base = Date.parse('2026-07-17T09:00:00.000Z');
  return () => new Date(base + n++ * 1000).toISOString();
})();

// Shared aggregator deps.
const aggregatorDeps: TerminalAggregatorDeps = {
  clock: fixedClock,
  activationRevision: 1,
  authorityRevision: 1,
  matrixVersion: 1,
  policyVersion: 1,
  workspaceId: 'test-ws-001',
};

// Shared revalidation context.
const revalidationCtx: RevalidationContext = {
  activationId: 'act-1',
  activationRevision: 1,
  authorityRevision: 1,
  workspaceId: 'test-ws-001',
  workspaceRoot: '/tmp/test-workspace',
  clock: fixedClock,
};

// Helper to build an operation terminal state.
function op(
  effectName: string,
  kind: OperationTerminalKind,
  overrides: Partial<OperationTerminalState> = {},
): OperationTerminalState {
  return {
    operationId: `op-${effectName}`,
    kind,
    effectName,
    evidenceCompleteness: 'complete',
    timestamp: fixedClock(),
    ...overrides,
  };
}

// Helper to build a revalidation input.
function revalInput(overrides: Partial<RevalidateNextEffectInput> = {}): RevalidateNextEffectInput {
  return {
    effectName: 'write_file',
    actionClass: 'write_file',
    target: '/tmp/test-workspace/file.ts',
    activationId: 'act-1',
    activationRevision: 1,
    authorityRevision: 1,
    workspaceId: 'test-ws-001',
    workspaceRoot: '/tmp/test-workspace',
    checkpointAuthorized: true,
    quotaExceeded: false,
    platformState: 'healthy',
    cancelled: false,
    ...overrides,
  };
}

// =============================================================================
// AC #1: Strongest unresolved state + included/excluded effects + post-commit
// =============================================================================

describe('AC #1: aggregateTerminals — strongest unresolved + effects + post-commit', () => {
  it('selects unknown-outcome as strongest when present alongside succeeded', () => {
    const result = aggregateTerminals(
      [op('read', 'succeeded'), op('write', 'unknown-outcome')],
      aggregatorDeps,
      true,
    );
    expect(result.strongestUnresolved).toBe('unknown-outcome');
    expect(result.aggregateStatus).toBe('unknown-outcome');
  });

  it('selects still-running as stronger than failed', () => {
    const result = aggregateTerminals(
      [op('read', 'failed'), op('cmd', 'still-running')],
      aggregatorDeps,
      true,
    );
    expect(result.strongestUnresolved).toBe('still-running');
  });

  it('selects failed as stronger than cancelled', () => {
    const result = aggregateTerminals(
      [op('read', 'cancelled'), op('write', 'failed')],
      aggregatorDeps,
      true,
    );
    expect(result.strongestUnresolved).toBe('failed');
  });

  it('selects cancelled as stronger than blocked', () => {
    const result = aggregateTerminals(
      [op('read', 'blocked'), op('write', 'cancelled')],
      aggregatorDeps,
      true,
    );
    expect(result.strongestUnresolved).toBe('cancelled');
  });

  it('selects blocked as stronger than refused', () => {
    const result = aggregateTerminals(
      [op('read', 'refused'), op('write', 'blocked')],
      aggregatorDeps,
      true,
    );
    expect(result.strongestUnresolved).toBe('blocked');
  });

  it('selects refused as stronger than succeeded', () => {
    const result = aggregateTerminals(
      [op('read', 'succeeded'), op('write', 'refused')],
      aggregatorDeps,
      true,
    );
    expect(result.strongestUnresolved).toBe('refused');
  });

  it('selects succeeded when all operations succeeded', () => {
    const result = aggregateTerminals(
      [op('read', 'succeeded'), op('write', 'succeeded')],
      aggregatorDeps,
      true,
    );
    expect(result.strongestUnresolved).toBe('succeeded');
    expect(result.aggregateStatus).toBe('succeeded');
  });

  it('names all included and excluded effects', () => {
    const result = aggregateTerminals(
      [op('read', 'succeeded'), op('write', 'succeeded'), op('delete', 'blocked'), op('cmd', 'cancelled')],
      aggregatorDeps,
      true,
    );
    expect(result.includedEffects).toEqual(['read', 'write']);
    expect(result.blockedEffects).toEqual(['delete']);
    expect(result.cancelledEffects).toEqual(['cmd']);
    expect(result.unresolvedEffects).toEqual([]);
  });

  it('completion is published only after durable post-commit Evidence', () => {
    const committed = aggregateTerminals([op('read', 'succeeded')], aggregatorDeps, true);
    expect(committed.committed).toBe(true);

    const notCommitted = aggregateTerminals([op('read', 'succeeded')], aggregatorDeps, false);
    expect(notCommitted.committed).toBe(false);
  });

  it('handles empty operations list as succeeded', () => {
    const result = aggregateTerminals([], aggregatorDeps, true);
    expect(result.strongestUnresolved).toBe('succeeded');
    expect(result.aggregateStatus).toBe('succeeded');
    expect(result.includedEffects).toEqual([]);
  });

  it('categorizes malformed and denied as blocked', () => {
    const result = aggregateTerminals(
      [op('read', 'malformed'), op('write', 'denied')],
      aggregatorDeps,
      true,
    );
    expect(result.blockedEffects).toContain('read');
    expect(result.blockedEffects).toContain('write');
    expect(result.aggregateStatus).toBe('blocked');
  });

  it('categorizes reconciled as included', () => {
    const result = aggregateTerminals(
      [op('read', 'reconciled')],
      aggregatorDeps,
      true,
    );
    expect(result.includedEffects).toContain('read');
    expect(result.aggregateStatus).toBe('succeeded');
  });
});

// =============================================================================
// AC #2: Authority revalidation on cancel/activation-change/revocation
// =============================================================================

describe('AC #2: revalidateAuthorityForNextEffect — denies pending work without consuming one-shot', () => {
  it('denies pending work when operation is cancelled', () => {
    const result = revalidateAuthorityForNextEffect(revalInput({ cancelled: true }), revalidationCtx);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('operation-cancelled');
    expect(result.authorityConsumed).toBe(false);
  });

  it('denies pending work when activation changes', () => {
    const result = revalidateAuthorityForNextEffect(
      revalInput({ activationId: 'act-old' }),
      revalidationCtx,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('activation-changed');
    expect(result.authorityConsumed).toBe(false);
  });

  it('denies pending work when activation revision changes', () => {
    const result = revalidateAuthorityForNextEffect(
      revalInput({ activationRevision: 0 }),
      revalidationCtx,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('activation-revision-changed');
    expect(result.authorityConsumed).toBe(false);
  });

  it('denies pending work when authority revision changes', () => {
    const result = revalidateAuthorityForNextEffect(
      revalInput({ authorityRevision: 0 }),
      revalidationCtx,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('authority-revision-changed');
    expect(result.authorityConsumed).toBe(false);
  });

  it('denies pending work when workspace changes', () => {
    const result = revalidateAuthorityForNextEffect(
      revalInput({ workspaceId: 'other-ws' }),
      revalidationCtx,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('workspace-changed');
    expect(result.authorityConsumed).toBe(false);
  });

  it('denies pending work when checkpoint is not authorized', () => {
    const result = revalidateAuthorityForNextEffect(
      revalInput({ checkpointAuthorized: false }),
      revalidationCtx,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('checkpoint-not-authorized');
    expect(result.authorityConsumed).toBe(false);
  });

  it('denies pending work when quota is exceeded', () => {
    const result = revalidateAuthorityForNextEffect(
      revalInput({ quotaExceeded: true }),
      revalidationCtx,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('quota-exceeded');
    expect(result.authorityConsumed).toBe(false);
  });

  it('denies pending work when platform is unhealthy', () => {
    const result = revalidateAuthorityForNextEffect(
      revalInput({ platformState: 'unhealthy' }),
      revalidationCtx,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('platform-unhealthy');
    expect(result.authorityConsumed).toBe(false);
  });

  it('denies pending work when authorization is stale', () => {
    const allowDecision: PepDecision = {
      outcome: 'allow', reason: 'manual-approval', matrixVersion: 1, activationRevision: 1, actionClass: 'write_file',
    };
    const auth: Authorization = createAuthorization({
      operationId: 'op-auth',
      binding: { actionClass: 'write_file', target: '/tmp/test-workspace/file.ts' },
      decision: allowDecision,
      activationId: 'act-1',
      activationRevision: 1,
      authorityRevision: 1,
      approvingInteraction: 'int-1',
      clock: fixedClock,
    });
    // Revoke the authorization to make it stale.
    const revokedAuth: Authorization = { ...auth, revoked: true, revokedReason: 'user-denied' };
    const result = revalidateAuthorityForNextEffect(
      revalInput({ authorization: revokedAuth }),
      revalidationCtx,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('authorization-stale');
    expect(result.authorityConsumed).toBe(false);
  });

  it('allows valid effect with all checks passing', () => {
    const result = revalidateAuthorityForNextEffect(revalInput(), revalidationCtx);
    expect(result.ok).toBe(true);
    expect(result.authorityConsumed).toBe(false);
  });
});

// =============================================================================
// AC #3: Dispatch-committed outcome per durable evidence
// =============================================================================

describe('AC #3: dispatchCommittedOutcome — honest outcome per durable evidence', () => {
  it('returns still-running when dispatch-committed but no terminal event', () => {
    const evidence = [
      { kind: 'EffectDispatchCommitted', operationId: 'op-1' },
    ];
    expect(dispatchCommittedOutcome(evidence, 'op-1')).toBe('still-running');
  });

  it('returns succeeded when OperationSucceeded evidence exists', () => {
    const evidence = [
      { kind: 'EffectDispatchCommitted', operationId: 'op-1' },
      { kind: 'OperationSucceeded', operationId: 'op-1' },
    ];
    expect(dispatchCommittedOutcome(evidence, 'op-1')).toBe('succeeded');
  });

  it('returns failed when OperationFailed evidence exists', () => {
    const evidence = [
      { kind: 'EffectDispatchCommitted', operationId: 'op-1' },
      { kind: 'OperationFailed', operationId: 'op-1' },
    ];
    expect(dispatchCommittedOutcome(evidence, 'op-1')).toBe('failed');
  });

  it('returns unknown-outcome when OperationUnknownOutcome evidence exists', () => {
    const evidence = [
      { kind: 'EffectDispatchCommitted', operationId: 'op-1' },
      { kind: 'OperationUnknownOutcome', operationId: 'op-1' },
    ];
    expect(dispatchCommittedOutcome(evidence, 'op-1')).toBe('unknown-outcome');
  });

  it('returns unknown-outcome when no evidence at all', () => {
    expect(dispatchCommittedOutcome([], 'op-1')).toBe('unknown-outcome');
  });

  it('NEVER returns cancelled for a dispatch-committed effect', () => {
    const evidence = [
      { kind: 'EffectDispatchCommitted', operationId: 'op-1' },
    ];
    const result = dispatchCommittedOutcome(evidence, 'op-1');
    expect(result).not.toBe('cancelled');
  });

  it('filters evidence by operationId correctly', () => {
    const evidence = [
      { kind: 'EffectDispatchCommitted', operationId: 'op-1' },
      { kind: 'OperationSucceeded', operationId: 'op-2' },
    ];
    // op-1 has dispatch-committed but no terminal event -> still-running
    expect(dispatchCommittedOutcome(evidence, 'op-1')).toBe('still-running');
    // op-2 has succeeded -> succeeded
    expect(dispatchCommittedOutcome(evidence, 'op-2')).toBe('succeeded');
  });
});

// =============================================================================
// AC #4: Unproven native result
// =============================================================================

describe('AC #4: unprovenNativeResult — preserves unknown-outcome + blocks retry', () => {
  it('preserves unknown-outcome for unproven native result', () => {
    const result = unprovenNativeResult('op-native', 'native-command', 'command may have modified files');
    expect(result.outcome).toBe('unknown-outcome');
  });

  it('records residual risk and dispatch classification', () => {
    const result = unprovenNativeResult('op-native', 'native-command', 'command may have modified files');
    expect(result.residualRisk).toBe('command may have modified files');
    expect(result.dispatchClassification).toBe('native-command');
  });

  it('blocks blind/equivalent retry', () => {
    const result = unprovenNativeResult('op-native', 'native-command', 'risk');
    expect(result.blindRetryBlocked).toBe(true);
  });

  it('exposes only inspection, supported reconciliation, or exit', () => {
    const result = unprovenNativeResult('op-native', 'native-command', 'risk');
    expect(result.onlyInspectReconcileExit).toBe(true);
  });
});

// =============================================================================
// AC #5: Summary with distinct dimensions + no affirmative success for partial
// =============================================================================

describe('AC #5: aggregateTerminals — distinct dimensions + summary', () => {
  it('operation status is distinct from aggregate Prompt Round status', () => {
    // When there's a mix of succeeded and blocked, operation status is the
    // strongest unresolved (blocked), but aggregate status is 'blocked'.
    const result = aggregateTerminals(
      [op('read', 'succeeded'), op('write', 'blocked')],
      aggregatorDeps,
      true,
    );
    expect(result.operationStatus).toBe('blocked');
    expect(result.aggregateStatus).toBe('blocked');
    // They are the same value here, but they are distinct fields with distinct
    // semantics: operationStatus is the per-operation strongest unresolved,
    // aggregateStatus is the round-level status.
    expect(typeof result.operationStatus).toBe('string');
    expect(typeof result.aggregateStatus).toBe('string');
    expect(result.operationStatus).not.toBe('succeeded');
  });

  it('deterministic Evidence is separate from model explanation', () => {
    const result = aggregateTerminals(
      [op('read', 'succeeded')],
      aggregatorDeps,
      true,
      'The model thinks everything is fine.',
    );
    expect(result.evidence.provenance).toBe('deterministic');
    expect(result.modelExplanation).toBe('The model thinks everything is fine.');
    // Evidence and model explanation are separate fields.
    expect(result.evidence.reasonCode).not.toContain('model');
  });

  it('summary identifies applied, excluded, blocked, cancelled, and unresolved scope', () => {
    const result = aggregateTerminals(
      [
        op('read', 'succeeded'),
        op('write', 'succeeded'),
        op('delete', 'blocked'),
        op('cmd', 'cancelled'),
        op('network', 'unknown-outcome'),
      ],
      aggregatorDeps,
      true,
    );
    const summary = buildAggregateSummary(result);
    expect(summary).toContain('Applied: read, write');
    expect(summary).toContain('Blocked: delete');
    expect(summary).toContain('Cancelled: cmd');
    expect(summary).toContain('Unresolved: network');
  });

  it('no affirmative success language for partial work', () => {
    const result = aggregateTerminals(
      [op('read', 'succeeded'), op('write', 'blocked')],
      aggregatorDeps,
      true,
    );
    const language = aggregateLeadLanguage(result.aggregateStatus);
    expect(language).not.toMatch(/All operations completed/i);
    expect(language).toMatch(/blocked/i);
  });

  it('no affirmative success language for unknown outcome', () => {
    const result = aggregateTerminals(
      [op('read', 'unknown-outcome')],
      aggregatorDeps,
      true,
    );
    const language = aggregateLeadLanguage(result.aggregateStatus);
    expect(language).not.toMatch(/All operations completed/i);
    expect(language).toMatch(/unknown outcomes/i);
    expect(language).toMatch(/Do not auto-retry/i);
  });

  it('affirmative success language only when all operations succeeded', () => {
    const result = aggregateTerminals(
      [op('read', 'succeeded'), op('write', 'succeeded')],
      aggregatorDeps,
      true,
    );
    const language = aggregateLeadLanguage(result.aggregateStatus);
    expect(language).toMatch(/All operations completed/i);
  });

  it('buildAggregateSummary returns empty round message for no operations', () => {
    const result = aggregateTerminals([], aggregatorDeps, true);
    const summary = buildAggregateSummary(result);
    expect(summary).toBe('No operations in this round.');
  });
});

// =============================================================================
// strongerTerminal and strongestUnresolved unit tests
// =============================================================================

describe('strongerTerminal — deterministic ordering', () => {
  it('unknown-outcome is stronger than still-running', () => {
    expect(strongerTerminal('unknown-outcome', 'still-running')).toBe('unknown-outcome');
  });

  it('still-running is stronger than failed', () => {
    expect(strongerTerminal('still-running', 'failed')).toBe('still-running');
  });

  it('failed is stronger than cancelled', () => {
    expect(strongerTerminal('failed', 'cancelled')).toBe('failed');
  });

  it('cancelled is stronger than blocked', () => {
    expect(strongerTerminal('cancelled', 'blocked')).toBe('cancelled');
  });

  it('blocked is stronger than malformed', () => {
    expect(strongerTerminal('blocked', 'malformed')).toBe('blocked');
  });

  it('malformed is stronger than denied', () => {
    expect(strongerTerminal('malformed', 'denied')).toBe('malformed');
  });

  it('denied is stronger than refused', () => {
    expect(strongerTerminal('denied', 'refused')).toBe('denied');
  });

  it('refused is stronger than reconciled', () => {
    expect(strongerTerminal('refused', 'reconciled')).toBe('refused');
  });

  it('reconciled is stronger than succeeded', () => {
    expect(strongerTerminal('reconciled', 'succeeded')).toBe('reconciled');
  });

  it('succeeded is the weakest', () => {
    expect(strongerTerminal('succeeded', 'unknown-outcome')).toBe('unknown-outcome');
    expect(strongerTerminal('succeeded', 'still-running')).toBe('still-running');
    expect(strongerTerminal('succeeded', 'failed')).toBe('failed');
  });
});

describe('strongestUnresolved — empty list returns succeeded', () => {
  it('returns succeeded for empty list', () => {
    expect(strongestUnresolved([])).toBe('succeeded');
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('Edge cases', () => {
  it('aggregateTerminals with mixed succeeded and cancelled returns partial', () => {
    const result = aggregateTerminals(
      [op('read', 'succeeded'), op('write', 'cancelled')],
      aggregatorDeps,
      true,
    );
    expect(result.aggregateStatus).toBe('partial');
  });

  it('aggregateTerminals with all blocked returns blocked', () => {
    const result = aggregateTerminals(
      [op('read', 'blocked'), op('write', 'blocked')],
      aggregatorDeps,
      true,
    );
    expect(result.aggregateStatus).toBe('blocked');
  });

  it('aggregateTerminals with all failed returns failed', () => {
    const result = aggregateTerminals(
      [op('read', 'failed'), op('write', 'failed')],
      aggregatorDeps,
      true,
    );
    expect(result.aggregateStatus).toBe('failed');
  });

  it('aggregateTerminals with all unknown-outcome returns unknown-outcome', () => {
    const result = aggregateTerminals(
      [op('read', 'unknown-outcome'), op('write', 'unknown-outcome')],
      aggregatorDeps,
      true,
    );
    expect(result.aggregateStatus).toBe('unknown-outcome');
    expect(result.blindRetryBlocked).toBe(true);
    expect(result.onlyInspectReconcileExit).toBe(true);
  });

  it('aggregateTerminals preserves Thai text in effect names', () => {
    const result = aggregateTerminals(
      [op('ไฟล์ทดสอบ', 'succeeded')],
      aggregatorDeps,
      true,
    );
    expect(result.includedEffects).toContain('ไฟล์ทดสอบ');
  });

  it('revalidateAuthorityForNextEffect with valid authorization passes', () => {
    const allowDecision: PepDecision = {
      outcome: 'allow', reason: 'manual-approval', matrixVersion: 1, activationRevision: 1, actionClass: 'write_file',
    };
    const auth: Authorization = createAuthorization({
      operationId: 'op-auth',
      binding: { actionClass: 'write_file', target: '/tmp/test-workspace/file.ts' },
      decision: allowDecision,
      activationId: 'act-1',
      activationRevision: 1,
      authorityRevision: 1,
      approvingInteraction: 'int-1',
      clock: fixedClock,
    });
    const result = revalidateAuthorityForNextEffect(
      revalInput({ authorization: auth }),
      revalidationCtx,
    );
    expect(result.ok).toBe(true);
    expect(result.authorityConsumed).toBe(false);
  });
});
