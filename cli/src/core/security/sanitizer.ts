// Versioned Sanitizer (AD-24, NFR-2). Applied before persistence, display,
// logging, export, and model-context boundaries. Content-class-specific
// policies; unsafe content is blocked or emitted as sanitized-with-omissions.

export const SANITIZER_VERSION = 1;

export type ContentClass =
  | 'credential'
  | 'header'
  | 'url-query'
  | 'environment'
  | 'path'
  | 'stack-trace'
  | 'command-output'
  | 'tool-output'
  | 'remote-payload'
  | 'user-content'
  | 'error-message';

export type SanitizeResult =
  | { ok: true; value: string; omissions: string[] }
  | { ok: false; cause: string; omissions: string[] };

const CREDENTIAL_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /sk-[A-Za-z0-9]{16,}/g, label: '[redacted:api-key]' },
  { re: /Bearer\s+[A-Za-z0-9._-]{16,}/g, label: 'Bearer [redacted:token]' },
  { re: /((?:api[_-]?key|secret|token|password)\s*[:=]\s*)["']?[^\s"']{8,}["']?/gi, label: '$1[redacted]' },
];

const HEADER_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /Authorization:\s*[^\n\r]+/gi, label: 'Authorization: [redacted]' },
  { re: /X-Api-Key:\s*[^\n\r]+/gi, label: 'X-Api-Key: [redacted]' },
];

const URL_QUERY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /[?&](api[_-]?key|token|secret|password|auth)=[^&\s]+/gi, label: '$1=[redacted]' },
];

const ENV_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /(?:^|\n)([A-Z_]+(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)\s*=\s*)[^\n]+/gim, label: '$1[redacted]' },
];

const STACK_TRACE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /at\s+.*\n/g, label: '' },
];

export class Sanitizer {
  constructor(readonly version: number = SANITIZER_VERSION) {}

  sanitize(value: string, contentClass: ContentClass): SanitizeResult {
    const omissions: string[] = [];
    let result = value;

    switch (contentClass) {
      case 'credential':
        result = this.applyPatterns(result, CREDENTIAL_PATTERNS, omissions);
        if (result !== value) omissions.push('credential patterns redacted');
        break;
      case 'header':
        result = this.applyPatterns(result, HEADER_PATTERNS, omissions);
        result = this.applyPatterns(result, CREDENTIAL_PATTERNS, omissions);
        break;
      case 'url-query':
        result = this.applyPatterns(result, URL_QUERY_PATTERNS, omissions);
        break;
      case 'environment':
        result = this.applyPatterns(result, ENV_PATTERNS, omissions);
        break;
      case 'stack-trace':
        result = this.applyPatterns(result, STACK_TRACE_PATTERNS, omissions);
        break;
      case 'command-output':
      case 'tool-output':
      case 'remote-payload':
        result = this.applyPatterns(result, CREDENTIAL_PATTERNS, omissions);
        result = this.applyPatterns(result, HEADER_PATTERNS, omissions);
        result = this.applyPatterns(result, ENV_PATTERNS, omissions);
        break;
      case 'user-content':
      case 'path':
      case 'error-message':
        result = this.applyPatterns(result, CREDENTIAL_PATTERNS, omissions);
        break;
    }

    if (result.length === 0 && value.length > 0) {
      return { ok: false, cause: 'content fully redacted', omissions };
    }

    return { ok: true, value: result, omissions };
  }

  /** Sanitize or block: if the result is not ok, return a safe fallback. */
  sanitizeOrBlock(value: string, contentClass: ContentClass, fallback: string): string {
    const r = this.sanitize(value, contentClass);
    return r.ok ? r.value : fallback;
  }

  private applyPatterns(
    text: string,
    patterns: Array<{ re: RegExp; label: string }>,
    omissions: string[],
  ): string {
    let out = text;
    for (const { re, label } of patterns) {
      const before = out;
      out = out.replace(re, label);
      if (out !== before) omissions.push(`pattern: ${label}`);
    }
    return out;
  }
}

/** Shared singleton for the application. */
export const sanitizer = new Sanitizer(SANITIZER_VERSION);