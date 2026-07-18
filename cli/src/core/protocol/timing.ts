// Prompt Round correlation + timing (Story 2.11, FR-37, FR-39, NFR-12,
// NFR-14, NFR-15, AD-3, AD-28). Each Prompt Round receives ONE stable
// PromptRoundId that is also its correlation identity — shared by intent,
// authority, proposals, approvals/consents, provider observations, activity,
// Evidence, and terminal records — while each operation retains its own
// OperationId (AC #1). Timing Evidence carries one end-to-end duration measured
// from accepted request to durable terminal visibility plus attributable
// subsystem timings for available phases; missing measurements are labeled
// `not measured` rather than guessed (AC #2). Operation durations stay distinct
// from the round duration with bidirectional correlation navigation (AC #3).
// Context utilization and cumulative usage remain separate from elapsed time;
// no percentage without a real budget, and unresolved budgets use
// `budget not set` (AC #4). An interrupted/blocked/stale/unknown-outcome round
// attributes its duration to the actual terminal state and never claims
// successful completion or an absent remote effect (AC #5). EventId dedup
// prevents double counting and completion stays pending/unknown-outcome until
// durable Evidence makes the state authoritative (AC #6).

import { BUDGET_NOT_SET } from '../permissions/matrix.js';
import type { MeasurementQuality } from './events.js';

export const NOT_MEASURED = 'not measured' as const;

export interface SubsystemTiming {
  readonly phase: string;
  readonly durationMs: number | typeof NOT_MEASURED;
  readonly quality: MeasurementQuality;
}

/** One Prompt Round's timing + correlation record (AC #1, AC #2). */
export interface PromptRoundTiming {
  readonly promptRoundId: string;
  /** The single correlation identity — equal to the PromptRoundId (AC #1). */
  readonly correlationId: string;
  readonly startedAt: string;
  readonly terminalVisibleAt: string | null;
  readonly endToEndDurationMs: number | typeof NOT_MEASURED;
  readonly subsystems: readonly SubsystemTiming[];
  readonly terminalState: string | null;
  readonly measurementQuality: MeasurementQuality;
  /** Operation ids that participated in this round (AC #3 — bidirectional
   * correlation navigation between round and operations). */
  readonly operationIds: readonly string[];
}

/** Begin a Prompt Round timing record at the accepted-request instant. */
export function beginPromptRoundTiming(promptRoundId: string, startedAt: string, operationIds: readonly string[] = []): PromptRoundTiming {
  return {
    promptRoundId,
    correlationId: promptRoundId,
    startedAt,
    terminalVisibleAt: null,
    endToEndDurationMs: NOT_MEASURED,
    subsystems: [],
    terminalState: null,
    measurementQuality: 'unknown',
    operationIds,
  };
}

/** AC #2: finalize a round's timing at durable terminal visibility. The
 * end-to-end duration is measured from accepted request to terminal visibility;
 * if either timestamp or the terminal visibility is missing, the duration is
 * `not measured` rather than guessed. `terminalState` drives the attributable
 * duration (AC #5). */
export function finalizePromptRoundTiming(input: {
  readonly timing: PromptRoundTiming;
  readonly terminalVisibleAt: string;
  readonly terminalState: string;
  readonly clock: () => string;
}): PromptRoundTiming {
  const startMs = Date.parse(input.timing.startedAt);
  const endMs = Date.parse(input.terminalVisibleAt);
  const duration: number | typeof NOT_MEASURED =
    Number.isNaN(startMs) || Number.isNaN(endMs) ? NOT_MEASURED : Math.max(0, endMs - startMs);
  return {
    ...input.timing,
    terminalVisibleAt: input.terminalVisibleAt,
    endToEndDurationMs: duration,
    terminalState: input.terminalState,
    measurementQuality: duration === NOT_MEASURED ? 'unknown' : 'locally-measured',
  };
}

/** AC #2: record a subsystem timing for an available phase. Missing
 * measurements use `not measured`. */
export function withSubsystem(timing: PromptRoundTiming, subsystem: SubsystemTiming): PromptRoundTiming {
  return { ...timing, subsystems: [...timing.subsystems, subsystem] };
}

/** AC #3: correlate an operation to its round (bidirectional navigation). */
export interface OperationCorrelation {
  readonly operationId: string;
  readonly promptRoundId: string;
  readonly correlationId: string;
}

export function correlateOperation(operationId: string, promptRoundId: string): OperationCorrelation {
  return { operationId, promptRoundId, correlationId: promptRoundId };
}

/** AC #3: an operation duration is distinct from the round duration — never
 * present a child timing as the whole round. */
export function operationDurationMs(operationStartedAt: string, operationEndedAt: string): number | typeof NOT_MEASURED {
  const s = Date.parse(operationStartedAt);
  const e = Date.parse(operationEndedAt);
  if (Number.isNaN(s) || Number.isNaN(e)) return NOT_MEASURED;
  return Math.max(0, e - s);
}

/** AC #4: a context/utilization percentage requires a REAL budget. Returns the
 * numeric percent only when a real budget exists, otherwise the canonical
 * `budget not set` token (never a fabricated percentage). */
export function utilizationPercentOrBudgetNotSet(used: number, budget: number | null): number | typeof BUDGET_NOT_SET | 'percentage unavailable' {
  if (budget === null) return BUDGET_NOT_SET;
  if (budget <= 0) return BUDGET_NOT_SET;
  return Math.min(100, Math.round((used / budget) * 100));
}

/** AC #5: the canonical non-affirmative states that must NOT be led with
 * affirmative success language or claim an absent remote effect. */
const NON_AFFIRMATIVE_TERMINAL: ReadonlySet<string> = new Set([
  'unknown-outcome',
  'blocked',
  'stale',
  'cancelled',
  'failed',
  'interruption-unknown',
]);

/** AC #5: true when a terminal state must be reported non-affirmatively. */
export function isNonAffirmativeTerminal(state: string | null): boolean {
  return state !== null && NON_AFFIRMATIVE_TERMINAL.has(state);
}

/** AC #6: deduplicate timing events by EventId during replay so a late progress
 * event cannot double-count a duration or reopen a terminal result. */
export function deduplicateTimingEvents<T extends { readonly eventId: string }>(events: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of events) {
    if (!seen.has(e.eventId)) {
      seen.add(e.eventId);
      out.push(e);
    }
  }
  return out;
}