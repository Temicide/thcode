// Dependency preflight typed contracts (Story 3.8, AD-9, AD-15, AD-24, AD-28,
// UX-DR-037–040, UX-DR-098–100, UX-DR-120). A non-mutating probe surface that
// inspects project prerequisites without changing the machine. Every result is
// secret-safe, attributable, and carries an Evidence identity. No `any`.
//
// (ADR 0011, AD-15) — probe definitions come from a maintained, versioned
// registry; model-supplied capabilities, installers, URLs, or commands are NEVER
// registry authority.

/** Category of a prerequisite probe (AD-15). */
export type PrerequisiteCategory =
  | 'runtime'
  | 'compiler'
  | 'package-manager'
  | 'documented-command';

/** Status of a single prerequisite probe result. */
export type PrerequisiteProbeStatus =
  | 'verified'
  | 'prerequisite-blocker'
  | 'probe-failed'
  | 'incompatible';

/** Classification of raw probe output (AD-24). Never carries raw output text. */
export type ProbeOutputClassification =
  | 'clean'
  | 'suspicious'
  | 'malformed'
  | 'unavailable';

/** Overall dependency preflight status. */
export type DepPreflightOverall =
  | 'all-verified'
  | 'blocked'
  | 'unknown';

/** Injected environment probe port. Tests construct a fake; production uses the
 * default implementation in `run.ts`. Never installs or modifies anything. */
export interface EnvironmentProbe {
  readonly platform: NodeJS.Platform;
  /** Find an executable by name in PATH or known platform-specific locations.
   * Returns the resolved path, or null if not found. Never installs anything. */
  findExecutable(name: string): string | null;
  /** Run the executable with `--version` (or equivalent) and return the stdout
   * version string. Returns null on failure. Never modifies anything. */
  getVersion(executablePath: string): string | null;
  /** Check whether the executable at the given path is invokable (exists and
   * can be executed). Never modifies anything. */
  isInvokable(executablePath: string): boolean;
}

/** A single approved prerequisite probe definition (AD-15). The `probe`
 * function is pure over the injected EnvironmentProbe — it never touches the
 * real filesystem, network, or process environment directly. */
export interface PrerequisiteProbe {
  readonly id: string;
  readonly displayName: string;
  readonly category: PrerequisiteCategory;
  /** The platform(s) this probe applies to. `'any'` means all supported
   * platforms. */
  readonly platform: NodeJS.Platform | 'any';
  /** Pure probe function. Returns a PrerequisiteProbeResult without installing
   * or modifying anything. */
  readonly probe: (env: EnvironmentProbe) => PrerequisiteProbeResult;
}

/** Result of probing a single prerequisite. */
export interface PrerequisiteProbeResult {
  readonly probeId: string;
  readonly status: PrerequisiteProbeStatus;
  /** Resolved executable path or identity, or null when not found. */
  readonly executableIdentity: string | null;
  /** Version string (e.g. `"14.0.0"`, `"15.0.1"`), or null when unavailable. */
  readonly version: string | null;
  readonly outputClassification: ProbeOutputClassification;
  /** Platform-specific guidance when status is `prerequisite-blocker` or
   * `incompatible`. Sourced from the maintained registry or verified project
   * documentation ONLY — never invented URLs or installers (AD-14, AD-15). */
  readonly guidance: string | null;
}

/** Platform-specific guidance for a prerequisite blocker. */
export interface PrerequisiteGuidance {
  readonly platform: NodeJS.Platform;
  readonly message: string;
  readonly recovery: string;
}

/** Complete dependency preflight result (Story 3.8). Carries platform identity,
 * Workspace binding, a fresh Evidence identity per run, per-probe results, and
 * overall status. Secret-safe: no raw output, no credentials, no stack traces. */
export interface DepPreflightResult {
  readonly platform: NodeJS.Platform;
  readonly workspaceId: string;
  readonly workspaceGeneration: string;
  /** Fresh Evidence identity per run (AC #4). Never reused across runs. */
  readonly evidenceId: string;
  readonly timestamp: string;
  readonly perProbeResults: readonly PrerequisiteProbeResult[];
  readonly overall: DepPreflightOverall;
  readonly guidance: readonly PrerequisiteGuidance[];
}

/** AD-9 typed failure envelope for dependency preflight. */
export type DepPreflightFailureCategory =
  | 'invalid-input'
  | 'workspace-unavailable'
  | 'probe-registry-error'
  | 'internal-error';

export interface DepPreflightFailure {
  readonly category: DepPreflightFailureCategory;
  readonly retryable: boolean;
  readonly scope: 'dep-preflight' | 'workspace' | 'probe-registry';
  readonly message: string;
  readonly causeCode: string;
  readonly retryAfter?: number;
}
