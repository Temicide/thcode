// PR-3 platform/action enforcement matrix (Story 3.1 AC #5, AD-4, AD-12, PR-3).
// A versioned, frozen data structure mapping (platform, action) → mechanism
// availability. When the matrix/required identity mechanism is unavailable,
// affected operations emit `ENFORCEMENT UNVERIFIED`, fail closed, preserve safe
// inspection of the reason, and perform no native filesystem effect.

import { ENFORCEMENT_UNVERIFIED } from '../permissions/matrix.js';
import type { EnforcementStatus } from './types.js';

export { ENFORCEMENT_UNVERIFIED } from '../permissions/matrix.js';

/** Current version of the enforcement matrix. Bump when adding/modifying entries. */
export const ENFORCEMENT_MATRIX_VERSION = 1;

/**
 * A single entry in the PR-3 enforcement matrix. Each entry declares that for
 * a given (platform, action) pair, a specific mechanism is available and
 * verified.
 */
export interface EnforcementMatrixEntry {
  readonly platform: NodeJS.Platform;
  readonly action: string;
  readonly mechanism: string;
  readonly available: boolean;
}

/**
 * The PR-3 platform/action enforcement matrix. Frozen and versioned — never
 * modified at runtime. Each entry maps a (platform, action) pair to a mechanism
 * and its availability status.
 *
 * Supported platforms: win32 (Windows 11 25H2+), darwin (macOS 14+).
 * Unsupported platforms have no entries and will always return unavailable.
 */
const ENFORCEMENT_MATRIX: readonly EnforcementMatrixEntry[] = Object.freeze([
  // --- Windows (win32) ---
  { platform: 'win32', action: 'filesystem-write', mechanism: 'windows-ntfs-write', available: true },
  { platform: 'win32', action: 'filesystem-delete', mechanism: 'windows-ntfs-delete', available: true },
  { platform: 'win32', action: 'command-exec', mechanism: 'windows-process-create', available: true },
  { platform: 'win32', action: 'network-transfer', mechanism: 'windows-winsock-transfer', available: true },
  // --- macOS (darwin) ---
  { platform: 'darwin', action: 'filesystem-write', mechanism: 'darwin-apfs-write', available: true },
  { platform: 'darwin', action: 'filesystem-delete', mechanism: 'darwin-apfs-delete', available: true },
  { platform: 'darwin', action: 'command-exec', mechanism: 'darwin-posix-spawn', available: true },
  { platform: 'darwin', action: 'network-transfer', mechanism: 'darwin-bsd-sockets-transfer', available: true },
]);

/**
 * Check whether the enforcement mechanism for a given (platform, action) pair
 * is available according to the PR-3 matrix.
 *
 * Returns `true` when the matrix has an entry for the pair and the mechanism is
 * marked available. Returns `false` when the pair is unknown or the mechanism
 * is unavailable — callers must fail closed with `ENFORCEMENT UNVERIFIED`.
 */
export function enforcementAvailable(platform: NodeJS.Platform, action: string): boolean {
  const entry = ENFORCEMENT_MATRIX.find(
    (e) => e.platform === platform && e.action === action,
  );
  if (!entry) return false;
  return entry.available;
}

/**
 * Get the full enforcement status for a (platform, action) pair, including a
 * safe, inspectable reason when unavailable.
 */
export function enforcementStatus(platform: NodeJS.Platform, action: string): EnforcementStatus {
  const entry = ENFORCEMENT_MATRIX.find(
    (e) => e.platform === platform && e.action === action,
  );
  if (!entry) {
    return {
      available: false,
      reason: `no enforcement matrix entry for platform ${platform}, action ${action}`,
    };
  }
  if (!entry.available) {
    return {
      available: false,
      reason: `enforcement mechanism ${entry.mechanism} is marked unavailable`,
    };
  }
  return { available: true, reason: null };
}

/**
 * Return the canonical `ENFORCEMENT UNVERIFIED` token. Exists so callers can
 * import it from this module without reaching into the permissions layer.
 */
export function enforcementUnverifiedToken(): typeof ENFORCEMENT_UNVERIFIED {
  return ENFORCEMENT_UNVERIFIED;
}
