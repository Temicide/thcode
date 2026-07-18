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

  const result = Math.round(num * multiplier);
  if (!isFinite(result)) return null;
  return result;
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
 * Parse a resolution limit string into width and height. Accepts `WxH` format
 * (e.g. `4000x4000`, `1920X1080`). Returns `null` when the value cannot be
 * parsed.
 */
export function parseResolutionLimit(value: string): { width: number; height: number } | null {
  const m = /^(\d+)\s*[xX]\s*(\d+)$/.exec(value.trim());
  if (!m) return null;
  const width = parseInt(m[1], 10);
  const height = parseInt(m[2], 10);
  if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * Parse a duration limit string into seconds. Accepts:
 * - Plain seconds: `30` → 30
 * - With `s` suffix: `30s` → 30
 * - With `m` suffix: `2m` → 120
 * - With `h` suffix: `1h` → 3600
 * Returns `null` when the value cannot be parsed.
 */
export function parseDurationLimit(value: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(s|m|h)?$/i.exec(value.trim());
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (!isFinite(num) || num < 0) return null;
  const unit = (m[2] ?? 's').toLowerCase();
  switch (unit) {
    case 's': return Math.round(num);
    case 'm': return Math.round(num * 60);
    case 'h': return Math.round(num * 3600);
    default: return null;
  }
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
