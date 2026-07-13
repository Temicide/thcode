// Redact recognized credential patterns from tool output before it enters a
// reasoning turn, log, or transcript (ADR 0007 security invariant). This is a
// best-effort scrub of common shapes; provider keys never flow through here in
// the first place because they live only in the CredentialStore.

const PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /sk-[A-Za-z0-9]{16,}/g, label: '[redacted:api-key]' },
  { re: /Bearer\s+[A-Za-z0-9._-]{16,}/g, label: 'Bearer [redacted:token]' },
  // Generic KEY=VALUE / "api_key": "..." style assignments.
  { re: /((?:api[_-]?key|secret|token|password)\s*[:=]\s*)["']?[^\s"']{8,}["']?/gi, label: '$1[redacted]' },
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const { re, label } of PATTERNS) {
    out = out.replace(re, label);
  }
  return out;
}
