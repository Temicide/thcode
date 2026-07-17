// Workspace identity and resource identity typed contracts (Story 3.1, AD-4,
// AD-5, AD-12, AD-22, AD-27, PR-3). Discriminated unions, opaque branded ids,
// no `any`. Every failure uses the AD-9 typed envelope.

// --- Opaque branded id types ---

export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };

export function asWorkspaceId(s: string): WorkspaceId {
  return s as WorkspaceId;
}

// --- Platform / filesystem policy ---

export type CasePolicy = 'case-sensitive' | 'case-insensitive';

export type UnicodePolicy = 'nfc' | 'nfd' | 'unknown';

export interface PlatformIdentity {
  readonly platform: NodeJS.Platform;
  readonly casePolicy: CasePolicy;
  readonly unicodePolicy: UnicodePolicy;
}

// --- Volume / device identity ---

export interface VolumeIdentity {
  readonly dev: number;
  readonly ino: number;
  /** Filesystem type identifier (e.g. `statfs.f_type` on Unix, `0` on
   * platforms where statfs is unavailable). */
  readonly fsType: number;
}

// --- Binding status ---

export type WorkspaceBindingStatus = 'bound' | 'blocked';

// --- WorkspaceIdentity ---

export interface WorkspaceIdentity {
  readonly workspaceId: WorkspaceId;
  readonly platform: PlatformIdentity;
  readonly canonicalRoot: string;
  readonly volumeIdentity: VolumeIdentity | null;
  readonly bindingStatus: WorkspaceBindingStatus;
  /** Human-readable reason when bindingStatus is 'blocked'. */
  readonly blockedReason: string | null;
}

// --- Resource type ---

export type ResourceType = 'file' | 'directory' | 'symlink' | 'other' | 'unknown';

// --- ResourceIdentity ---

export interface ResourceIdentity {
  readonly canonicalPath: string;
  readonly displayPath: string;
  readonly type: ResourceType;
  readonly sizeBytes: number | null;
  /** Hex-encoded SHA-256 digest of content, or null when not requested or
   * unavailable. */
  readonly expectedDigest: string | null;
  /** Version identifier (e.g. mtime epoch or inode change counter), or null
   * when unavailable. */
  readonly version: string | null;
  /** True when the identity was proven by direct filesystem inspection (not
   * derived from a display string alone). */
  readonly identityProven: boolean;
}

// --- Containment decision ---

export type ContainmentOutcome = 'allowed' | 'denied' | 'conflict' | 'enforcement-unverified';

export interface ContainmentDecision {
  readonly outcome: ContainmentOutcome;
  /** Machine-readable reason code, safe to log. */
  readonly reason: string;
  /** The resolved canonical path (present when outcome is 'allowed' or
   * 'conflict'). */
  readonly resolvedPath: string | null;
}

// --- Enforcement status ---

export interface EnforcementStatus {
  readonly available: boolean;
  /** When available is false, the reason enforcement is unavailable. */
  readonly reason: string | null;
}

// --- AD-9 typed failure envelope ---

export type FailureCategory = 'invalid-input' | 'workspace-unavailable' | 'containment-violation' | 'enforcement-unavailable' | 'internal-error';

export interface Failure {
  readonly category: FailureCategory;
  readonly retryable: boolean;
  readonly scope: 'workspace' | 'resource' | 'containment' | 'enforcement';
  readonly message: string;
  readonly causeCode: string;
  readonly retryAfter?: number;
}

// --- Injectables for testability ---

export interface FsProbe {
  realpath(path: string): string;
  lstat(path: string): {
    dev: number;
    ino: number;
    size: number;
    isDirectory: boolean;
    isFile: boolean;
    isSymbolicLink: boolean;
  };
  stat(path: string): {
    dev: number;
    ino: number;
    size: number;
    isDirectory: boolean;
    isFile: boolean;
  };
  readlink(path: string): string;
  statfs(path: string): { type: number } | null;
}

export interface PlatformProbe {
  readonly platform: NodeJS.Platform;
  readonly casePolicy: CasePolicy;
  readonly unicodePolicy: UnicodePolicy;
}
