// Story 2.11: Prompt Round correlation + timing.
import { describe, expect, it } from 'vitest';
import {
  NOT_MEASURED,
  beginPromptRoundTiming,
  correlateOperation,
  deduplicateTimingEvents,
  finalizePromptRoundTiming,
  isNonAffirmativeTerminal,
  operationDurationMs,
  utilizationPercentOrBudgetNotSet,
  withSubsystem,
} from '../src/core/protocol/timing.js';
import { BUDGET_NOT_SET } from '../src/core/permissions/matrix.js';

describe('Prompt Round timing — one correlation identity (AC #1)', () => {
  it('the PromptRoundId is the correlation identity; operations keep their own OperationId', () => {
    const t = beginPromptRoundTiming('r1', '2026-07-17T00:00:00.000Z', ['op1', 'op2']);
    expect(t.correlationId).toBe('r1');
    expect(t.operationIds).toEqual(['op1', 'op2']);
    const c = correlateOperation('op1', 'r1');
    expect(c.operationId).toBe('op1');
    expect(c.correlationId).toBe('r1');
  });
});

describe('Prompt Round timing — end-to-end + subsystems, not measured (AC #2)', () => {
  it('measures end-to-end from accepted request to durable terminal visibility', () => {
    const t = beginPromptRoundTiming('r1', '2026-07-17T00:00:00.000Z');
    const fin = finalizePromptRoundTiming({ timing: t, terminalVisibleAt: '2026-07-17T00:00:01.500Z', terminalState: 'succeeded', clock: () => '2026-07-17T00:00:01.500Z' });
    expect(fin.endToEndDurationMs).toBe(1500);
    expect(fin.measurementQuality).toBe('locally-measured');
  });
  it('a missing timestamp leaves duration not measured rather than guessed', () => {
    const t = beginPromptRoundTiming('r1', 'not-a-date');
    const fin = finalizePromptRoundTiming({ timing: t, terminalVisibleAt: '2026-07-17T00:00:01.500Z', terminalState: 'succeeded', clock: () => '2026-07-17T00:00:01.500Z' });
    expect(fin.endToEndDurationMs).toBe(NOT_MEASURED);
    expect(fin.measurementQuality).toBe('unknown');
  });
  it('records attributable subsystem timings with quality', () => {
    const t = withSubsystem(beginPromptRoundTiming('r1', '2026-07-17T00:00:00.000Z'), { phase: 'dispatch', durationMs: 200, quality: 'locally-measured' });
    expect(t.subsystems[0].phase).toBe('dispatch');
  });
});

describe('Prompt Round timing — operation duration distinct from round (AC #3)', () => {
  it('an operation duration is its own value, not the whole round', () => {
    expect(operationDurationMs('2026-07-17T00:00:00.000Z', '2026-07-17T00:00:00.500Z')).toBe(500);
    expect(operationDurationMs('bad', '2026-07-17T00:00:00.000Z')).toBe(NOT_MEASURED);
  });
});

describe('Prompt Round timing — no percentage without a real budget (AC #4)', () => {
  it('returns budget not set when no real budget exists', () => {
    expect(utilizationPercentOrBudgetNotSet(100, null)).toBe(BUDGET_NOT_SET);
    expect(utilizationPercentOrBudgetNotSet(100, 0)).toBe(BUDGET_NOT_SET);
  });
  it('returns a numeric percent when a real budget exists', () => {
    expect(utilizationPercentOrBudgetNotSet(50, 200)).toBe(25);
  });
});

describe('Prompt Round timing — non-affirmative terminal (AC #5)', () => {
  it('unknown-outcome/blocked/stale/cancelled/failed are non-affirmative', () => {
    for (const s of ['unknown-outcome', 'blocked', 'stale', 'cancelled', 'failed', 'interruption-unknown']) {
      expect(isNonAffirmativeTerminal(s)).toBe(true);
    }
    expect(isNonAffirmativeTerminal('succeeded')).toBe(false);
    expect(isNonAffirmativeTerminal(null)).toBe(false);
  });
});

describe('Prompt Round timing — replay dedup (AC #6)', () => {
  it('replayed timing events do not double-count', () => {
    const events = [{ eventId: 'e1' }, { eventId: 'e1' }, { eventId: 'e2' }];
    expect(deduplicateTimingEvents(events).length).toBe(2);
  });
});