// Retention/TTL evaluation (Story 4.15). Pure functions that evaluate whether a
// cache index entry has expired based on its retention policy. Marks expired
// at/after the TTL boundary. NEVER deletes Evidence records — deletion is out
// of this epic (AC #3).

import type { CacheIndexEntry, CacheIndexEntryState } from './cacheIndex.js';

// ---------------------------------------------------------------------------
// RetentionPolicy
// ---------------------------------------------------------------------------

/**
 * Retention policy for a cache index entry.
 * - 'ttl': entry expires after ttlMs milliseconds from observationTime.
 * - 'none': entry never expires (no TTL).
 */
export type RetentionPolicy =
  | { readonly kind: 'ttl'; readonly ttlMs: number }
  | { readonly kind: 'none' };

// ---------------------------------------------------------------------------
// Retention evaluation result
// ---------------------------------------------------------------------------

/** Result of evaluating retention for a single entry. */
export interface RetentionEvaluation {
  /** The resulting state after evaluation. */
  readonly state: CacheIndexEntryState;
  /** The expiresAt timestamp (ISO-8601), if a TTL was set. */
  readonly expiresAt?: string;
  /** Human-readable reason for the state transition. */
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// evaluateRetention
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a cache index entry has expired based on its retention
 * policy and the current time. Pure function — does not mutate the entry.
 *
 * - TTL: if expiresAt is defined and < now, the entry is expired.
 * - None: the entry is always valid (no expiry).
 *
 * NEVER deletes the Evidence record — only reports the state.
 */
export function evaluateRetention(
  entry: CacheIndexEntry,
  now: string,
): RetentionEvaluation {
  if (entry.retention.kind === 'none') {
    return { state: 'valid' };
  }

  // TTL policy
  if (entry.expiresAt !== undefined && entry.expiresAt < now) {
    return {
      state: 'expired',
      expiresAt: entry.expiresAt,
      reason: `TTL expired at ${entry.expiresAt} (now: ${now})`,
    };
  }

  return { state: 'valid', expiresAt: entry.expiresAt };
}

// ---------------------------------------------------------------------------
// applyRetention
// ---------------------------------------------------------------------------

/**
 * Sweep all entries in a CacheIndex, marking expired ones. Returns the digests
 * of entries that were newly marked expired. Does NOT delete any entry or
 * Evidence record — deletion is out of this epic (AC #3).
 *
 * This is a convenience wrapper that calls the index's markExpired method.
 * The index already handles the sweep; this function exists for explicit
 * retention evaluation at the application layer.
 */
export function applyRetention(
  index: { markExpired(now: string): readonly string[] },
  now: string,
): readonly string[] {
  return index.markExpired(now);
}
