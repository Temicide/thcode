// Conservative retention/deletion handling resolution (Story 4.8, AD-26.1, PR-2).
// Maps a CapabilityRegistryEntry's retentionClassification to a RetentionHandling
// value. Conservative keyword matching: only explicit verified no-retention or
// deletion-confirmed/deletion-not-required policies map to safe values; anything
// else yields `unknown` (blocked). No Date/random.

import type { RetentionHandling } from '../../permissions/transferConsent.js';
import type { CapabilityRegistryEntry } from '../registry/types.js';

/**
 * Resolve a registry entry's retention classification to a `RetentionHandling`
 * value. Conservative keyword matching on the lowercased policy string:
 *
 * - Contains "no-retention", "none", "zero-retention", or "retention:none"
 *   → `upstream-no-retention-verified`. The policy itself verifies there is no
 *     upstream retention, so there is nothing to delete — `providerDeletionSupported`
 *     is IRRELEVANT here (a no-retention provider legitimately reports `false`,
 *     because deletion is not applicable). This is the case for all five launch
 *     Specialist services in specialists-manifest.json.
 * - Contains "deletion-confirmed" → `deletion-confirmed` ONLY when
 *   `providerDeletionSupported` is true. A policy that claims deletion is
 *   confirmed while the provider does not support deletion is inconsistent →
 *   `unknown` (blocked). This is where the consistency check actually belongs.
 * - Contains "deletion-not-required" or "not-required" → `deletion-not-required`.
 * - Otherwise → `unknown` (blocked — never assumed safe).
 *
 * When in doubt, returns `unknown` so the consent gate fails closed.
 */
export function resolveRetentionHandling(entry: CapabilityRegistryEntry): RetentionHandling {
  const policy = entry.retentionClassification.policy.toLowerCase();

  // upstream-no-retention-verified: the policy itself verifies no upstream
  // retention. providerDeletionSupported is irrelevant (nothing retained to
  // delete), so this is returned unconditionally for no-retention policies.
  if (
    policy.includes('no-retention') ||
    policy.includes('none') ||
    policy.includes('zero-retention') ||
    policy.includes('retention:none')
  ) {
    return 'upstream-no-retention-verified';
  }

  // deletion-confirmed: only safe when the provider actually supports deletion.
  // A "deletion-confirmed" claim without provider-side deletion support is an
  // inconsistent contract → fail closed.
  if (policy.includes('deletion-confirmed')) {
    return entry.retentionClassification.providerDeletionSupported
      ? 'deletion-confirmed'
      : 'unknown';
  }

  // deletion-not-required: provider explicitly says deletion is not required.
  if (policy.includes('deletion-not-required') || policy.includes('not-required')) {
    return 'deletion-not-required';
  }

  // Conservative default: unknown (blocked).
  return 'unknown';
}
