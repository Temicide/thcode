// Versioned PermissionMatrix (Story 2.2, AD-12). One reviewed registry of
// known action classes and their static attributes (mutating, sensitive,
// risk, required enforcement capability). The PEP (`pep.ts`) is the single
// consumer that turns a `{ actionClass, PolicyState }` pair into a decision;
// an action class absent from this registry is UNKNOWN and must fail closed
// (Story 2.2 AC #4) rather than being guessed from its name.

import type { RiskLevel } from './types.js';

export const PERMISSION_MATRIX_VERSION = 1;

/** Canonical non-affirmative tokens (epics.md Pre-Implementation Gate /
 * Story 2.2 AC #7, Story 2.3 AC #6). Never invented ad hoc at call sites. */
export const ENFORCEMENT_UNVERIFIED = 'ENFORCEMENT UNVERIFIED' as const;
export const BUDGET_NOT_SET = 'budget not set' as const;

export interface ActionClassDefinition {
  readonly actionClass: string;
  readonly mutating: boolean;
  readonly sensitive: boolean;
  readonly risk: RiskLevel;
  /** When present, the PEP fails closed with `ENFORCEMENT UNVERIFIED` unless
   * the caller asserts this platform capability is available/verified
   * (PR-3 — the platform/action enforcement matrix). */
  readonly requiresEnforcementCapability?: string;
}

/**
 * The Release-1-floor action classes this matrix version knows about
 * (AD-15's local-tool floor plus a `transfer` placeholder for the Story 2.6
 * remote-transfer consent contract this story does not implement). Adding a
 * new action class is a new matrix version in a later story — this registry
 * is not silently extended at call sites.
 */
const REGISTRY: ReadonlyMap<string, ActionClassDefinition> = new Map(
  (
    [
      { actionClass: 'read_file', mutating: false, sensitive: false, risk: 'low' },
      { actionClass: 'list_dir', mutating: false, sensitive: false, risk: 'low' },
      { actionClass: 'search', mutating: false, sensitive: false, risk: 'low' },
      {
        actionClass: 'write_file',
        mutating: true,
        sensitive: false,
        risk: 'medium',
        requiresEnforcementCapability: 'filesystem-write',
      },
      {
        actionClass: 'delete',
        mutating: true,
        sensitive: false,
        risk: 'high',
        requiresEnforcementCapability: 'filesystem-delete',
      },
      {
        actionClass: 'run_command',
        mutating: true,
        sensitive: false,
        risk: 'high',
        requiresEnforcementCapability: 'command-exec',
      },
      {
        actionClass: 'transfer',
        mutating: false,
        sensitive: true,
        risk: 'high',
        requiresEnforcementCapability: 'network-transfer',
      },
    ] satisfies ActionClassDefinition[]
  ).map((d) => [d.actionClass, d]),
);

/** Look up a known action class's static attributes, or `undefined` when the
 * class is unknown/unsupported by this matrix version (Story 2.2 AC #4). */
export function lookupActionClass(actionClass: string): ActionClassDefinition | undefined {
  return REGISTRY.get(actionClass);
}

/** All action classes this matrix version declares (for `/tools`-style
 * inspection and tests). */
export function knownActionClasses(): readonly string[] {
  return [...REGISTRY.keys()];
}
