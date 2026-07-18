// Pure deterministic matcher for Specialist prompt routing (Story 4.5).
// Scores a prompt against each registry entry's searchTerms, capabilities,
// supportedInputs, and names. No Math.random, no Date.now, no user-bytes
// normalization — only a lowercased copy for comparison.
// Uses substring matching (like the catalog search) for robust Thai support,
// since JavaScript \b word boundaries do not work with Thai characters.

import type { CapabilityRegistryEntry } from '../registry/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Matcher version — bump when scoring logic changes. */
export const MATCHER_VERSION = 1;

/**
 * Score window within which two matches count as a tie.
 * If top.score <= runner-up.score + AMBIGUITY_DELTA, the result is ambiguous.
 */
export const AMBIGUITY_DELTA = 15;

// ---------------------------------------------------------------------------
// Score weights
// ---------------------------------------------------------------------------

const DIRECT_ID_SCORE = 100;
const EXACT_TERM_SCORE = 50;
const SUPPORTED_INPUT_SCORE = 30;
const NAME_SUBSTRING_SCORE = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServiceMatch {
  readonly serviceId: string;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

/** Check if the prompt directly mentions a service id (e.g. "use t-ocr").
 *  Uses \b for Latin-script ids; for ids with non-Latin characters, falls
 *  back to substring matching. */
function hasDirectIdMention(promptLower: string, id: string): boolean {
  // Guard against empty id — empty string includes() always returns true.
  if (id.length === 0) return false;
  const idLower = id.toLowerCase();
  // Try word-boundary regex first (works for Latin-script ids like "t-ocr").
  try {
    const re = new RegExp(`\\b${escapeRegex(idLower)}\\b`);
    if (re.test(promptLower)) return true;
  } catch {
    // Fall through to substring check.
  }
  // Also check "use <id>", "run <id>", "call <id>" patterns via substring.
  const prefixes = ['use ', 'run ', 'call '];
  for (const p of prefixes) {
    if (promptLower.includes(p + idLower)) return true;
  }
  return false;
}

/** Escape regex special characters. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find term matches using substring inclusion.
 * This is the same approach used by the catalog search (controls.ts) and
 * handles Thai text correctly (JavaScript \b does not work with Thai).
 */
function findTermMatches(promptLower: string, terms: readonly string[]): readonly string[] {
  const matched: string[] = [];
  for (const term of terms) {
    // Guard against empty term — empty string includes() always returns true.
    if (term.length === 0) continue;
    const termLower = term.toLowerCase();
    if (promptLower.includes(termLower)) {
      matched.push(term);
    }
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Main matcher
// ---------------------------------------------------------------------------

/**
 * Match a prompt against registry entries and return scored matches.
 *
 * Scoring (deterministic):
 * - Direct id mention (`\b<id>\b` or "use <id>" style) → 100
 * - Exact searchTerm/capability phrase token match (substring) → 50
 * - supportedInput keyword match (substring) → 30
 * - Name (Thai/English) substring match → 10
 *
 * Scores are summed across all hit categories for each entry.
 * Stable tie-break by registry entry order (input order).
 * Lowercases a COPY for comparison; original prompt bytes are never altered.
 *
 * @param prompt - The original user prompt (preserved verbatim).
 * @param entries - Registry entries to match against.
 * @returns Scored matches sorted by score descending, then by registry order.
 */
export function matchPromptToServices(
  prompt: string,
  entries: readonly CapabilityRegistryEntry[],
): readonly ServiceMatch[] {
  // Lowercase a copy for comparison only — original bytes preserved.
  const promptLower = prompt.toLowerCase();

  const results: ServiceMatch[] = [];

  for (const entry of entries) {
    let score = 0;
    const allMatchedTerms: string[] = [];

    // 1. Direct id mention (highest fixed score)
    if (hasDirectIdMention(promptLower, entry.id)) {
      score += DIRECT_ID_SCORE;
      allMatchedTerms.push(`id:${entry.id}`);
    }

    // 2. Exact searchTerm/capability phrase match (substring)
    const searchTermMatches = findTermMatches(promptLower, entry.searchTerms);
    const capabilityMatches = findTermMatches(promptLower, entry.capabilities);
    if (searchTermMatches.length > 0 || capabilityMatches.length > 0) {
      score += EXACT_TERM_SCORE;
      allMatchedTerms.push(...searchTermMatches, ...capabilityMatches);
    }

    // 3. supportedInput keyword match (substring)
    const inputMatches = findTermMatches(promptLower, entry.supportedInputs);
    if (inputMatches.length > 0) {
      score += SUPPORTED_INPUT_SCORE;
      allMatchedTerms.push(...inputMatches.map((i) => `input:${i}`));
    }

    // 4. Name (Thai/English) substring match
    const thaiLower = entry.nameThai.toLowerCase();
    const engLower = entry.nameEnglish.toLowerCase();
    if (thaiLower.length > 0 && promptLower.includes(thaiLower)) {
      score += NAME_SUBSTRING_SCORE;
      allMatchedTerms.push(`name:${entry.nameThai}`);
    }
    if (engLower.length > 0 && promptLower.includes(engLower)) {
      score += NAME_SUBSTRING_SCORE;
      allMatchedTerms.push(`name:${entry.nameEnglish}`);
    }

    if (score > 0) {
      results.push({
        serviceId: entry.id,
        score,
        matchedTerms: allMatchedTerms,
      });
    }
  }

  // Sort by score descending, then by registry order (stable).
  // Since we iterate in registry order, we can sort by score descending
  // and entries with equal scores will retain their original order.
  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return 0; // stable: preserve registry order for equal scores
  });
}
