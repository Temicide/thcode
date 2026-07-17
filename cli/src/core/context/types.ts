// Active Model Context construction (ADR 0014) and the Context Donut
// measurement (ADR 0015). These are EXTENSION POINTS for the prototype:
// interfaces only — compaction, pinning, and token estimation are future work.

import type { NormalizedMessage } from '../providers/types.js';

export interface ContextBuildResult {
  /** Messages selected for the next provider request. */
  readonly messages: readonly NormalizedMessage[];
  /** Estimated tokens of the projected request (estimate, not verified). */
  readonly estimatedTokens: number;
}

/**
 * Builds the bounded Active Model Context from instructions, recent turns,
 * pinned turns, evidence, and summaries (ADR 0014).
 *
 * TODO(context-compaction): implement Automatic Compaction targeting <=70%
 * utilization before any provider call that would exceed Effective Context
 * Capacity, plus Irreducible Context Overflow blocking with a token breakdown.
 */
export interface ContextBuilder {
  build(history: readonly NormalizedMessage[], newInput: string): ContextBuildResult;
}

/**
 * Effective Context Capacity (ADR 0015): raw context limit minus reserved
 * response space (max(configured output, 8%)) minus safety margin
 * (max(2048, 2%)). Provider-specific limits override this fallback.
 */
export function effectiveContextCapacity(rawLimit: number, configuredMaxOutput = 0): number {
  const responseReserve = Math.max(configuredMaxOutput, Math.ceil(rawLimit * 0.08));
  const safety = Math.max(2048, Math.ceil(rawLimit * 0.02));
  return rawLimit - responseReserve - safety;
}

/**
 * Active Context Utilization percentage for the Context Donut / `Ctx N%`
 * textual fallback (ADR 0015).
 *
 * TODO(context-donut): segmented Unicode ring + severity styling in the UI;
 * the core only supplies the number.
 */
export function contextUtilizationPercent(estimatedTokens: number, capacity: number): number {
  if (capacity <= 0) return 100;
  return Math.round((estimatedTokens / capacity) * 100);
}

/**
 * Null-aware Effective Context Capacity (PR-4, epics.md Pre-Implementation
 * Gate). `rawLimit` is a provider's verified raw context limit, or `null`
 * when no sourced/verified limit exists (e.g. Typhoon today). `null` in ⇒
 * the canonical `'percentage unavailable'` token out — never a `128k`/
 * `115,200`-derived number. `effectiveContextCapacity()` itself stays
 * available, unchanged, for the verified-limit case.
 */
export function effectiveContextCapacityOrUnavailable(
  rawLimit: number | null,
  configuredMaxOutput = 0,
): number | 'percentage unavailable' {
  if (rawLimit === null) return 'percentage unavailable';
  return effectiveContextCapacity(rawLimit, configuredMaxOutput);
}

/**
 * Null-aware Active Context Utilization percentage (PR-4). Propagates
 * `'percentage unavailable'` from an unavailable capacity rather than
 * computing a fabricated numeric percentage against an unverified capacity.
 */
export function contextUtilizationPercentOrUnavailable(
  estimatedTokens: number,
  capacity: number | 'percentage unavailable',
): number | 'percentage unavailable' {
  if (capacity === 'percentage unavailable') return 'percentage unavailable';
  return contextUtilizationPercent(estimatedTokens, capacity);
}
