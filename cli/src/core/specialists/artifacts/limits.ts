// Pure size/text-length limit parsing and checking (Story 4.6).
// No `new Date`/`Math.random`/`Date.now`. All functions are deterministic.

// --- Unit multipliers ---

const UNIT_MULTIPLIERS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  TB: 1024 * 1024 * 1024 * 1024,
};

const UNIT_PATTERN = /^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i;

/**
 * Parse a size limit string into bytes. Supports:
 * - Plain integers: `10000` → 10000 bytes
 * - With units: `20MB`, `2.5GB`, `1024KB`, `1TB`
 * - Case-insensitive units: B, KB, MB, GB, TB
 * - Fractional values: `2.5GB` → 2684354560
 *
 * Returns `null` when the value cannot be parsed.
 */
export function parseSizeLimit(value: string): number | null {
  const m = UNIT_PATTERN.exec(value.trim());
  if (!m) return null;

  const num = parseFloat(m[1]);
  if (!isFinite(num) || num < 0) return null;

  const unit = (m[2] ?? 'B').toUpperCase();
  const multiplier = UNIT_MULTIPLIERS[unit];
  if (multiplier === undefined) return null;

  return Math.round(num * multiplier);
}

/**
 * Parse a text length limit string into a character count. Accepts plain
 * integer strings. Returns `null` when the value cannot be parsed.
 */
export function parseTextLengthLimit(value: string): number | null {
  const trimmed = value.trim();
  const n = parseInt(trimmed, 10);
  if (isNaN(n) || n < 0 || String(n) !== trimmed) return null;
  return n;
}

/**
 * Check whether `sizeBytes` exceeds the limits defined in `inputLimits`.
 *
 * - When `kind` is `'file'`, checks against `maxFileSize`.
 * - When `kind` is `'text'`, checks against `maxTextLength`.
 * - Missing limits → skip (returns `{ok: true}`).
 *
 * Returns `{ok: true}` when within limits, or `{ok: false, limit, kind}` when
 * the artifact exceeds the limit.
 */
export function checkSizeLimit(
  sizeBytes: number,
  inputLimits: Record<string, string> | undefined,
  kind: 'file' | 'text',
): { ok: true } | { ok: false; limit: number; kind: 'file' | 'text' } {
  if (!inputLimits) return { ok: true };

  if (kind === 'file') {
    const raw = inputLimits.maxFileSize;
    if (raw === undefined) return { ok: true };
    const limit = parseSizeLimit(raw);
    if (limit === null) return { ok: true }; // unparseable limit → skip
    if (sizeBytes > limit) {
      return { ok: false, limit, kind: 'file' };
    }
  }

  if (kind === 'text') {
    const raw = inputLimits.maxTextLength;
    if (raw === undefined) return { ok: true };
    const limit = parseTextLengthLimit(raw);
    if (limit === null) return { ok: true }; // unparseable limit → skip
    if (sizeBytes > limit) {
      return { ok: false, limit, kind: 'text' };
    }
  }

  return { ok: true };
}
