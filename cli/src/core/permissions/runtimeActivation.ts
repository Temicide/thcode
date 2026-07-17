// Runtime Activation (Story 2.1, AD-22). A fresh Runtime Activation is
// established on process start, Session create/open/switch, and Workspace
// rebind (AD-22). It owns the LIVE Permission Profile, Full Access, temporary
// approvals, and transfer consent — separate from Work Mode, which is
// session-level per ADR 0013. Every authority mutation increments the
// activation's own revision counter; a new activation gets a brand-new
// activationId, so approvals/consents bound to a prior activationId can never
// authorize anything against the new one, regardless of revision numbers
// (AD-17, AD-22).

import { randomUUID } from 'node:crypto';
import { NEW_SESSION_DEFAULT, type PermissionProfile, type WorkMode } from './types.js';

export type ActivationReason =
  | 'process-start'
  | 'session-create'
  | 'session-open'
  | 'session-switch'
  | 'workspace-rebind';

/** Immutable snapshot of Runtime Activation state (plain, serializable). */
export interface RuntimeActivationState {
  readonly activationId: string;
  readonly revision: number;
  readonly workspaceId: string;
  readonly mode: WorkMode;
  readonly profile: PermissionProfile;
  /** Full Access is itself just the `profile` value; this flag is the
   * session-scoped SENSITIVE-transfer override layered on top of it (ADR
   * 0012) — independent authority, per AD-17. */
  readonly sensitiveTransferOverride: boolean;
  /** True while a prompt is being composed / IME preedit is active. Mode and
   * Profile changes are refused (not merely queued) while this is true
   * (Story 2.1 AC #6). */
  readonly composerBusy: boolean;
  readonly reason: ActivationReason;
  readonly createdAt: string;
}

export type AuthorityField = 'mode' | 'profile';

export interface AuthorityMutationResult {
  /** False when the mutation was refused (e.g. composer busy) — the state is
   * unchanged and the revision does NOT increment (Story 2.1 AC #6). */
  readonly applied: boolean;
  readonly state: RuntimeActivationState;
  /** Present only when `applied` is true — the field that changed, for the
   * caller to build a durable `AuthorityChanged` event (AD-3). */
  readonly changedField?: AuthorityField;
}

/**
 * One live Runtime Activation (Story 2.1, AD-22). Pure in-memory state
 * machine; the caller (CoreApp) is responsible for journaling the durable
 * `RuntimeActivationEstablished`/`AuthorityChanged` events this class's
 * transitions imply (AD-3 — this module has no journal/IO dependency so it
 * stays trivially unit-testable).
 */
export class RuntimeActivation {
  private state: RuntimeActivationState;

  constructor(opts: {
    readonly workspaceId: string;
    readonly reason: ActivationReason;
    readonly clock: () => string;
    readonly activationId?: string;
  }) {
    // AD-22: starts at Manual, clears Full Access / temporary approvals /
    // transfer consent / in-flight authority. Work Mode starts at the fresh
    // Session default (Build, ADR 0013) — a RESTORED session may later
    // revalidate a prior Work Mode (Story 2.1 AC #5), which is the caller's
    // concern (this constructor always represents a FRESH activation).
    this.state = {
      activationId: opts.activationId ?? randomUUID(),
      revision: 1,
      workspaceId: opts.workspaceId,
      mode: NEW_SESSION_DEFAULT.mode,
      profile: NEW_SESSION_DEFAULT.profile,
      sensitiveTransferOverride: false,
      composerBusy: false,
      reason: opts.reason,
      createdAt: opts.clock(),
    };
  }

  /** Defensive copy — callers never mutate the live record. */
  snapshot(): RuntimeActivationState {
    return { ...this.state };
  }

  /** Mark whether the composer is idle (no pending input / no IME preedit).
   * Does NOT itself mutate authority or increment the revision — it only
   * gates `setMode`/`setProfile` (Story 2.1 AC #6). */
  setComposerBusy(busy: boolean): void {
    this.state = { ...this.state, composerBusy: busy };
  }

  /** Change Work Mode. Refused (no-op, `applied: false`) while the composer
   * is busy (AC #6). Only `mode` changes — `profile` is untouched (AC #3). */
  setMode(mode: WorkMode): AuthorityMutationResult {
    if (this.state.composerBusy) {
      return { applied: false, state: this.snapshot() };
    }
    if (this.state.mode === mode) {
      // No-op selection of the already-active mode does not manufacture a
      // spurious revision bump or AuthorityChanged event.
      return { applied: false, state: this.snapshot() };
    }
    this.state = { ...this.state, mode, revision: this.state.revision + 1 };
    return { applied: true, state: this.snapshot(), changedField: 'mode' };
  }

  /** Change Permission Profile. Refused while the composer is busy (AC #6).
   * Only `profile` changes — `mode` is untouched (AC #4). Selecting a
   * profile is NEVER itself approval, transfer consent, or a Boundary
   * Expansion (AC #4) — this method only ever mutates `profile`. Switching
   * away from `full-access` clears the sensitive-transfer override, since
   * that override is scoped to Full Access sessions only (ADR 0012). */
  setProfile(profile: PermissionProfile): AuthorityMutationResult {
    if (this.state.composerBusy) {
      return { applied: false, state: this.snapshot() };
    }
    if (this.state.profile === profile) {
      return { applied: false, state: this.snapshot() };
    }
    this.state = {
      ...this.state,
      profile,
      sensitiveTransferOverride: profile === 'full-access' ? this.state.sensitiveTransferOverride : false,
      revision: this.state.revision + 1,
    };
    return { applied: true, state: this.snapshot(), changedField: 'profile' };
  }

  /** True if `otherActivationId`/`otherRevision` still authorizes against
   * this activation — i.e. it is the SAME activation at the SAME revision.
   * Used to reject stale approvals/consent/Full Access bound to a prior
   * activation or an earlier revision within this one (AD-17, AC #5). */
  authorizes(otherActivationId: string, otherRevision: number): boolean {
    return this.state.activationId === otherActivationId && this.state.revision === otherRevision;
  }
}

/** Build the `RuntimeActivationEstablished` durable-event payload shape for
 * a freshly constructed activation (Story 2.1 AC #1). The caller wraps this
 * in the canonical envelope and appends it BEFORE any approval can be
 * requested. */
export function activationEstablishedPayload(state: RuntimeActivationState): {
  readonly kind: 'RuntimeActivationEstablished';
  readonly activationId: string;
  readonly workspaceId: string;
  readonly mode: WorkMode;
  readonly profile: PermissionProfile;
  readonly reason: ActivationReason;
} {
  return {
    kind: 'RuntimeActivationEstablished',
    activationId: state.activationId,
    workspaceId: state.workspaceId,
    mode: state.mode,
    profile: state.profile,
    reason: state.reason,
  };
}
