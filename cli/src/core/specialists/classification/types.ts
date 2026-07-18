// Deterministic Specialist failure classification (Story 4.16). This layer
// preserves the Story 4.9 adapter failure as provenance while making one
// canonical class, the smallest proven quarantine scope, and sealed Evidence
// attribution available to every renderer (AD-9, AD-18, AD-24).

import type { SpecialistFailure, Retryability } from '../adapter/types.js';

/** Exactly one canonical category is assigned to every Specialist failure. */
export type FailureClass =
  | 'entitlement'
  | 'quota-rate-limit'
  | 'unsupported-input'
  | 'transient-network'
  | 'failed-health'
  | 'authentication'
  | 'protocol-incompatibility'
  | 'configuration-failure'
  | 'unknown-outcome';

/**
 * A configured service proven to use the same credential binding as the
 * failing service. The generation pin prevents a stale failure from widening
 * a quarantine after configuration changes (AD-18).
 */
export interface CredentialGroupMember {
  readonly serviceId: string;
  readonly generationId: string;
  readonly credentialReferenceId: string;
  readonly credentialRevision: string;
}

/** The narrowest scope that may be quarantined for a classified failure. */
export type FailureScope =
  | { readonly kind: 'service'; readonly serviceId: string; readonly generationId: string }
  | {
    readonly kind: 'credential-group';
    readonly credentialGroupId: string;
    readonly credentialReferenceId: string;
    readonly credentialRevision: string;
    readonly members: readonly CredentialGroupMember[];
  }
  | { readonly kind: 'none' };

/**
 * Canonical attribution layered on the immutable Story 4.9 failure.
 * `evidenceRef` is the local sealed Specialist Evidence ID, not an adapter
 * payload reference; this avoids mutating the failure after it was sealed.
 */
export interface ClassifiedFailure {
  readonly failureClass: FailureClass;
  readonly retryability: Retryability;
  readonly causeCode: string;
  readonly smallestProvenScope: string;
  readonly scope: FailureScope;
  readonly effectiveGenerationId: string;
  readonly operationId: string;
  readonly serviceId: string;
  readonly safeMessage: string;
  readonly evidenceRef: string;
  readonly retryAfterMs?: number;
}

/** Pure decision; application happens only after all scope preconditions pass. */
export interface QuarantineDecision {
  readonly quarantine: boolean;
  readonly scope: FailureScope;
  readonly failureClass: FailureClass;
  readonly evidenceRef: string;
  readonly safeReason: string;
}

/** Result of a quarantine attempt; partial shared-group application is forbidden. */
export interface QuarantineReceipt {
  readonly applied: boolean;
  readonly serviceIds: readonly string[];
  readonly evidenceRef: string;
  readonly safeReason: string;
  readonly blockedReason?: 'unconfigured' | 'stale-generation';
}

/** Secret-safe canonical projection shared by all output modes. */
export interface ClassifiedFailureProjection {
  readonly heading: 'Failure Classification';
  readonly token: 'failure-classification';
  readonly serviceId: string;
  readonly failureClass: FailureClass;
  readonly retryability: Retryability;
  readonly scope: string;
  readonly safeMessage: string;
  readonly causeCode: string;
  readonly evidenceRef: string;
  readonly nextAction: string;
  readonly retryAfterMs?: number;
}

/** A Story 4.9 failure with its immutable Story 4.16 attribution/projection. */
export interface ClassifiedSpecialistFailure extends SpecialistFailure {
  readonly classifiedFailure: ClassifiedFailure;
  readonly classifiedProjection: ClassifiedFailureProjection;
  readonly quarantineReceipt: QuarantineReceipt;
}
