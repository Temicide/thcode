// Intent capture (FR-5, AD-7, AD-24, NFR-9). Preserves committed UTF-8 bytes
// (no normalization), extracts requested outcome / constraints / artifact
// references / verification intent, and records a versioned normalized-intent
// Evidence record linked to the original prompt hash and PromptRoundId.
// Material ambiguity produces a typed clarification request — no speculative
// dispatch or invented requirements (AD-14).

import { createHash } from 'node:crypto';

export const INTENT_EXTRACTOR_VERSION = 1;

/** Opaque prompt hash — SHA-256 of the committed UTF-8 bytes. */
export function promptHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** A reference extracted from the prompt: `@path`, `@"path with spaces"`,
 * a URL, a hash, or a command span. */
export interface ExtractedReference {
  readonly kind: 'path' | 'url' | 'hash' | 'command' | 'identifier';
  readonly raw: string;
  /** Canonicalized form (e.g. resolved path) — never alters the original bytes. */
  readonly canonical?: string;
}

/** Versioned normalized intent Evidence (AD-7). */
export interface NormalizedIntent {
  readonly version: number;
  readonly promptRoundId: string;
  readonly promptHash: string;
  readonly outcome: string | null;
  readonly constraints: readonly string[];
  readonly references: readonly ExtractedReference[];
  readonly verificationIntent: string | null;
  readonly languageHint: 'thai' | 'english' | 'mixed' | 'unknown';
  readonly ambiguity: 'none' | 'material' | null;
  readonly clarificationQuestion: string | null;
  readonly createdAt: string;
}

export type IntentExtractionResult =
  | { ok: true; intent: NormalizedIntent }
  | { ok: false; cause: 'failed' | 'blocked' | 'not-authoritative'; message: string; promptHash: string };

/** Heuristic language hint: Thai codepoints in U+0E00–U+0E7F range. */
export function detectLanguage(text: string): 'thai' | 'english' | 'mixed' | 'unknown' {
  let hasThai = false;
  let hasLatin = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp >= 0x0e00 && cp <= 0x0e7f) hasThai = true;
    else if (cp >= 0x41 && cp <= 0x5a) hasLatin = true;
    else if (cp >= 0x61 && cp <= 0x7a) hasLatin = true;
  }
  if (hasThai && hasLatin) return 'mixed';
  if (hasThai) return 'thai';
  if (hasLatin) return 'english';
  return 'unknown';
}

/** Extract `@path` / `@"path with spaces"` references without altering bytes.
 * References are returned in source order. The character class includes the
 * Thai range U+0E00–U+0E7F so Thai paths match. */
export function extractReferences(text: string): ExtractedReference[] {
  const refs: Array<ExtractedReference & { index: number }> = [];
  // `@"path with spaces"` — quoted form.
  for (const m of text.matchAll(/@"([^"]+)"/g)) {
    refs.push({ kind: 'path', raw: m[0], canonical: m[1], index: m.index ?? 0 });
  }
  // `@path/to/file` — unquoted form (no whitespace, ends at word boundary).
  // Character class: ASCII path chars + Thai range, so `@src/ไฟล์ใหม่.ts` matches.
  const unquoted = /(?:^|\s)@([A-Za-z0-9_./\u0e00-\u0e7f-]+[A-Za-z0-9_\u0e00-\u0e7f])/g;
  for (const m of text.matchAll(unquoted)) {
    const raw = m[0].trimStart();
    if (raw.startsWith('@"')) continue; // captured by quoted form
    refs.push({ kind: 'path', raw, canonical: m[1], index: m.index ?? 0 });
  }
  // URLs.
  for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) {
    refs.push({ kind: 'url', raw: m[0], canonical: m[0], index: m.index ?? 0 });
  }
  // Hashes (e.g. `commit:abc123` or bare `hash:abc123`).
  for (const m of text.matchAll(/\b(?:commit|hash|sha)[: ]\s*([0-9a-f]{7,40})\b/gi)) {
    refs.push({ kind: 'hash', raw: m[0], canonical: m[1], index: m.index ?? 0 });
  }
  return refs.sort((a, b) => a.index - b.index).map(({ index, ...ref }) => ref);
}

/** Extract verification intent keywords (Thai + English). */
export function extractVerificationIntent(text: string): string | null {
  const markers = [
    { re: /\bcompile\b|\brun\b|\bbuild\b|\btest\b|\bverify\b|\bprove\b/i, label: 'verify-and-run' },
    { re: /\u0e25\u0e07\u0e08\u0e14|\u0e17\u0e14\u0e2a\u0e2d\u0e1a|\u0e23\u0e31\u0e19|\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a/i, label: 'verify-and-run' },
  ];
  for (const { re, label } of markers) {
    if (re.test(text)) return label;
  }
  return null;
}

/** Extract explicit constraints (e.g. "do not ...", "ห้าม...", "only ...", "เฉพาะ..."). */
export function extractConstraints(text: string): string[] {
  const constraints: string[] = [];
  const patterns = [
    /\b(?:do not|don't|never|only|must|always)\b[^.\n]*[.\n]?/gi,
    /\u0e2b\u0e49\u0e32\u0e21[^.\n]*[.\n]?/g,
    /\u0e40\u0e09\u0e1e\u0e32\u0e30[^.\n]*[.\n]?/g,
    /\u0e15\u0e49\u0e2d\u0e07[^.\n]*[.\n]?/g,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      constraints.push(m[0].trim());
    }
  }
  return constraints;
}

/** Detect material ambiguity: a prompt with no clear verb/outcome and no
 * artifact reference. This is a conservative heuristic — it errs on the side
 * of asking when intent is unclear. */
export function detectAmbiguity(text: string, references: ExtractedReference[]): 'none' | 'material' {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'material';
  // A prompt with an artifact reference and at least one verb is likely not ambiguous.
  const hasVerb = /\b(?:create|edit|read|list|search|delete|run|build|test|explain|show|find|fix|add)\b/i.test(text)
    || /\u0e2a\u0e23\u0e49\u0e32\u0e07|\u0e41\u0e01\u0e49|\u0e2d\u0e48\u0e32\u0e19|\u0e25\u0e34\u0e2a\u0e15\u0e4c|\u0e25\u0e1a|\u0e23\u0e31\u0e19|\u0e2a\u0e23\u0e49\u0e32\u0e07|\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22|\u0e41\u0e2a\u0e14\u0e07|\u0e04\u0e49\u0e19\u0e2b\u0e32|\u0e1b\u0e23\u0e31\u0e1a/i.test(text);
  if (references.length === 0 && !hasVerb) return 'material';
  return 'none';
}

/** Build a clarification question in the same language style. */
export function buildClarificationQuestion(languageHint: NormalizedIntent['languageHint']): string {
  switch (languageHint) {
    case 'thai':
      return 'โปรดระบุสิ่งที่ต้องการให้ทำและไฟล์หรือที่อยู่ที่เกี่ยวข้อง (What would you like me to do, and which files or references are involved?)';
    case 'english':
      return 'Please specify what you would like me to do and any relevant files or references.';
    case 'mixed':
      return 'Please specify what you would like me to do และไฟล์ที่เกี่ยวข้อง (and any relevant files or references).';
    default:
      return 'Please specify the requested action and any relevant files or references.';
  }
}

/**
 * Extract normalized intent from a prompt without changing user bytes.
 * The original prompt is preserved as immutable local history by the caller;
 * this function only produces the derived Evidence record (AD-7).
 */
export function extractIntent(
  promptText: string,
  promptRoundId: string,
  clock: () => string = () => new Date().toISOString(),
): IntentExtractionResult {
  const hash = promptHash(promptText);
  try {
    const references = extractReferences(promptText);
    const constraints = extractConstraints(promptText);
    const verificationIntent = extractVerificationIntent(promptText);
    const languageHint = detectLanguage(promptText);
    const ambiguity = detectAmbiguity(promptText, references);
    const clarificationQuestion = ambiguity === 'material' ? buildClarificationQuestion(languageHint) : null;
    // Outcome: the first non-reference, non-constraint sentence-ish span.
    // Conservative: if ambiguity is material, outcome is null and we ask.
    const outcome = ambiguity === 'none' ? promptText.trim().split(/[.\n]/)[0]?.trim() || null : null;
    const intent: NormalizedIntent = {
      version: INTENT_EXTRACTOR_VERSION,
      promptRoundId,
      promptHash: hash,
      outcome,
      constraints,
      references,
      verificationIntent,
      languageHint,
      ambiguity,
      clarificationQuestion,
      createdAt: clock(),
    };
    return { ok: true, intent };
  } catch {
    return {
      ok: false,
      cause: 'failed',
      message: 'Intent extraction failed; no provider dispatch.',
      promptHash: hash,
    };
  }
}