// Preflight typed result contract (AD-9, AD-24, AD-28, UX-DR-100).
// A PreflightResult is the small, secret-safe envelope produced by the
// startup preflight gate. It never carries env values, raw errors, or
// credential material; it is safe to render, persist, and log.

/** Canonical operation status (AD-28 dimension 1). */
export type PreflightStatus = 'supported' | 'blocked' | 'unknown';

/** Canonical exit classes for preflight (UX-DR-100). */
export type ExitClass = 'SUCCESS' | 'BLOCKED' | 'FAILED';

/** Output mode (UX-DR-004, UX-DR-098). */
export type OutputMode = 'interactive' | 'redirected' | 'headless';

/** Local store posture (honest, never invented — UX-DR-120). */
export type StorePosture = 'ok' | 'unavailable' | 'unknown';

/** Credential/key-store posture (honest, never invented — UX-DR-120). */
export type CredentialPosture = 'ok' | 'unavailable' | 'unknown';

/** Deterministic cause codes for blocked/unknown results (AD-9). */
export type PreflightCause =
  | 'unsupported-platform'
  | 'unsupported-shell'
  | 'unsupported-node-version'
  | 'interactive-required-in-headless'
  | 'probe-failed';

/** Exit code mapping (UX-DR-100): 0 SUCCESS, 20 BLOCKED, 30 FAILED. */
export const PREFLIGHT_EXIT_CODES: Record<ExitClass, number> = {
  SUCCESS: 0,
  BLOCKED: 20,
  FAILED: 30,
};

/** Base fields shared by every PreflightResult variant. */
export interface PreflightBase {
  readonly status: PreflightStatus;
  readonly exitClass: ExitClass;
  readonly exitCode: number;
  readonly platform: NodeJS.Platform | 'unknown';
  readonly shell: string | 'unknown';
  readonly nodeVersion: string | null;
  readonly outputMode: OutputMode;
  readonly localStorePosture: StorePosture;
  readonly credentialStorePosture: CredentialPosture;
  /** Safe, non-secret message (AD-24). */
  readonly message: string;
  /** Recovery / next-step action; empty string when none. */
  readonly recovery: string;
}

export interface PreflightSupported extends PreflightBase {
  readonly status: 'supported';
  readonly exitClass: 'SUCCESS';
  readonly exitCode: 0;
  readonly cause: null;
}

export interface PreflightBlocked extends PreflightBase {
  readonly status: 'blocked';
  readonly exitClass: 'BLOCKED';
  readonly exitCode: 20;
  readonly cause: Exclude<PreflightCause, 'probe-failed'>;
}

export interface PreflightUnknown extends PreflightBase {
  readonly status: 'unknown';
  readonly exitClass: 'FAILED';
  readonly exitCode: 30;
  readonly cause: 'probe-failed';
}

export type PreflightResult = PreflightSupported | PreflightBlocked | PreflightUnknown;