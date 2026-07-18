// CoreProtocolV1 events — durable (post-commit, persisted) vs transient
// (progress only) (AD-3, AD-28). Durable events carry the canonical state
// tokens verbatim (AC #4). No secrets or raw vendor payloads (AD-24).

import type { EventEnvelope } from './envelope.js';

// --- Operation status (AD-28 dimension 1) ---
export type OperationStatus =
  | 'succeeded'
  | 'failed'
  | 'blocked'
  | 'malformed'
  | 'denied'
  | 'refused'
  | 'cancelled'
  | 'unknown-outcome'
  | 'reconciled';

// --- Lifecycle fact (AD-28 dimension 2) — nonterminal ---
export type LifecycleFact =
  | 'proposed'
  | 'authorized'
  | 'prepared'
  | 'dispatch-committed'
  | 'effect-already-committed'
  | 'cancel-requested'
  | 'cancel-acknowledged'
  | 'still-running'
  | 'interruption-cancelled'
  | 'interruption-unknown';

// --- Evidence completeness (AD-28 dimension 3) — qualifier ---
export type EvidenceCompleteness =
  | 'complete'
  | 'partial'
  | 'sanitized-with-omissions'
  | 'stale'
  | 'unavailable'
  | 'corrupt'
  | 'not-authoritative';

// --- Measurement quality (AD-28 dimension 4) — qualifier ---
export type MeasurementQuality =
  | 'estimated'
  | 'provider-reported'
  | 'locally-measured'
  | 'fallback'
  | 'unknown'
  | 'percentage unavailable';

// --- Health state (UX-DR-037, AC #4 canonical tokens) ---
export type HealthState = 'configured' | 'checking' | 'available' | 'unavailable' | 'unhealthy' | 'quarantined';

// --- Durable event payloads ---
export interface PromptSubmittedPayload { readonly kind: 'PromptSubmitted'; readonly text: string }
export interface ChatInterruptedPayload { readonly kind: 'ChatInterrupted'; readonly highWaterMark: string | null }
export interface RemoteOutputObservedPayload { readonly kind: 'RemoteOutputObserved'; readonly chunk: string; readonly upstreamSequence: string }
export interface EffectDispatchCommittedPayload { readonly kind: 'EffectDispatchCommitted'; readonly operationId: string }
export interface OperationSucceededPayload { readonly kind: 'OperationSucceeded'; readonly operationId: string }
export interface OperationFailedPayload { readonly kind: 'OperationFailed'; readonly operationId: string; readonly cause: string }
export interface OperationBlockedPayload { readonly kind: 'OperationBlocked'; readonly operationId: string; readonly cause: string }
export interface OperationCancelledPayload { readonly kind: 'OperationCancelled'; readonly operationId: string }
export interface OperationUnknownOutcomePayload { readonly kind: 'OperationUnknownOutcome'; readonly operationId: string }
export interface HealthChangedPayload { readonly kind: 'HealthChanged'; readonly providerId: string; readonly state: HealthState }
export interface CapabilityChangedPayload { readonly kind: 'CapabilityChanged'; readonly id: string; readonly state: string }
/**
 * Sanitized snapshot of a `NormalizedIntent` (Story 1.5 sanitization boundary
 * applied before persistence — no raw prompt bytes beyond what already
 * cleared the boundary, no secrets). Mirrors `agent/intent.ts`'s
 * `NormalizedIntent` shape minus `promptRoundId`/`promptHash`/`createdAt`,
 * which live on the envelope/payload directly.
 */
export interface NormalizedIntentEvidence {
  readonly version: number;
  readonly outcome: string | null;
  readonly constraints: readonly string[];
  readonly references: readonly { readonly kind: string; readonly raw: string; readonly canonical?: string }[];
  readonly verificationIntent: string | null;
  readonly languageHint: string;
  readonly ambiguity: 'none' | 'material' | null;
}

/**
 * `EvidenceRecorded` (protocol 1.1, additive/backward-compatible — AD-3,
 * AD-7). `evidenceKind` is an extension point: `'normalized-intent'` closes
 * Story 1.9 AC #3 (the derived `NormalizedIntent` is linked to `promptHash` +
 * `promptRoundId` and journaled durably, not just referenced). Future
 * Evidence kinds add variants without breaking this one (AD-14 — no silent
 * reinterpretation of an existing kind).
 */
export interface EvidenceRecordedPayload {
  readonly kind: 'EvidenceRecorded';
  readonly operationId: string;
  readonly completeness: EvidenceCompleteness;
  readonly evidenceKind: 'normalized-intent';
  readonly promptRoundId: string;
  readonly promptHash: string;
  readonly intent: NormalizedIntentEvidence;
}
export interface ContextCompactedPayload { readonly kind: 'ContextCompacted'; readonly targetPercent: number; readonly sourceIds?: readonly string[]; readonly policyVersion?: string; readonly manifestId?: string | null; readonly measuredTokens?: number }
export interface PinChangedPayload { readonly kind: 'PinChanged'; readonly pinId: string; readonly operation: 'pin' | 'unpin'; readonly itemId: string; readonly sessionId: string }
export interface ContextDecisionRecordedPayload { readonly kind: 'ContextDecisionRecorded'; readonly itemId: string; readonly included: boolean; readonly mode: string; readonly reason?: string; readonly manifestId?: string | null }
export interface ContextManifestFinalizedPayload { readonly kind: 'ContextManifestFinalized'; readonly manifestId: string; readonly requestBytesDigest: string; readonly requestBytesLength: number; readonly contextDigest: string; readonly operationId: string }
export interface ContextOverflowBlockedPayload { readonly kind: 'ContextOverflowBlocked'; readonly category: string; readonly protectedTokens: number; readonly availableTokens: number | 'percentage unavailable'; readonly remedies: readonly string[] }
export interface UsageObservedPayload { readonly kind: 'UsageObserved'; readonly operationId: string; readonly modelId: string; readonly inputTokens: number; readonly outputTokens: number; readonly cachedInputTokens: number; readonly source: string; readonly requestDigest?: string }

// --- Epic 2: Runtime Activation, PEP, and Boundary events (AD-12, AD-13,
// AD-17, AD-18, AD-22, Stories 2.1-2.3). Literal mode/profile unions are
// redeclared here (not imported from permissions/types.ts) following the
// existing convention of this file (see HealthState above) so the protocol
// layer stays the dependency root.

/** A fresh Runtime Activation is established (AD-22, Story 2.1 AC #1).
 * Recorded BEFORE any approval can be requested against it. */
export interface RuntimeActivationEstablishedPayload {
  readonly kind: 'RuntimeActivationEstablished';
  readonly activationId: string;
  readonly workspaceId: string;
  readonly mode: 'plan' | 'build';
  readonly profile: 'manual' | 'assisted' | 'full-access';
  readonly reason: 'process-start' | 'session-create' | 'session-open' | 'session-switch' | 'workspace-rebind';
}

/** Work Mode or Permission Profile changed within the current activation
 * (Story 2.1 AC #3, #4). Each mutation increments `revision`; the two fields
 * are independently addressable and this event never conflates them. */
export interface AuthorityChangedPayload {
  readonly kind: 'AuthorityChanged';
  readonly activationId: string;
  readonly revision: number;
  readonly field: 'mode' | 'profile';
  readonly value: string;
}

/** A PEP policy decision (Story 2.2 AC #1, #2, #5, AD-12). Deterministic,
 * attributable to the exact matrix version and activation revision. */
export interface PolicyDecisionRecordedPayload {
  readonly kind: 'PolicyDecisionRecorded';
  readonly operationId: string;
  readonly actionClass: string;
  readonly outcome: 'allow' | 'ask' | 'deny';
  readonly reason: string;
  readonly matrixVersion: number;
  readonly activationRevision: number;
}

/** A durable Boundary Expansion was granted (Story 2.3 AC #4). Separately
 * scoped from temporary approval or transfer consent (AD-17). */
export interface BoundaryExpansionGrantedPayload {
  readonly kind: 'BoundaryExpansionGranted';
  readonly expansionId: string;
  readonly resourceIdentity: string;
  readonly workspaceId: string;
  readonly actionClasses: readonly string[];
  readonly reason: string;
  readonly expiresAt: string | null;
}

/** A durable Boundary Expansion was revoked (Story 2.3 AC #5). Revocation
 * prevents future authorization; it never claims a committed effect was
 * cancelled. */
export interface BoundaryExpansionRevokedPayload {
  readonly kind: 'BoundaryExpansionRevoked';
  readonly expansionId: string;
  readonly reason: string;
}

// --- Story 2.4: exact-proposal authorization + revocation (AD-13, AD-17,
// AD-18). An approval binds an unforgeable authorization to the exact
// OperationId + digests + activation/authority revision + matrix version; a
// replayed/duplicate approval event is deduplicated by EventId + authorization
// identity and never double-consumed. No secrets or raw payloads (AD-24). */

/** A bound one-shot authorization was granted for an exact proposal (Story 2.4
 * AC #1). Carries only digests + identity/revision — never the raw proposal. */
export interface ApprovalGrantedPayload {
  readonly kind: 'ApprovalGranted';
  readonly authorizationId: string;
  readonly operationId: string;
  readonly actionDigest: string;
  readonly targetDigest: string | null;
  readonly contextDigest: string | null;
  readonly payloadDigest: string | null;
  readonly destinationDigest: string | null;
  readonly classification: string | null;
  readonly credentialGroup: string | null;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly policyOutcome: 'allow' | 'ask' | 'deny';
  readonly matrixVersion: number;
  readonly expiresAt: string | null;
  readonly approvingInteraction: string;
}

/** A bound authorization was consumed by a dispatched effect (one-shot — Story
 * 2.4 AC #1, AC #5). A replayed approval cannot consume it a second time. */
export interface AuthorizationConsumedPayload {
  readonly kind: 'AuthorizationConsumed';
  readonly authorizationId: string;
  readonly operationId: string;
}

/** A bound authorization was revoked or cancelled before dispatch commit
 * (Story 2.4 AC #3). After dispatch commit, revocation is recorded with the
 * honest `outcome` observed from durable Evidence rather than a cancellation
 * fiction (AC #4). */
export interface AuthorizationRevokedPayload {
  readonly kind: 'AuthorizationRevoked';
  readonly authorizationId: string;
  readonly operationId: string;
  readonly reason: string;
  /** Honest post-revocation outcome. `cancelled` is only valid before dispatch
   * commit; after commit the outcome is whatever durable Evidence proves
   * (`succeeded`/`failed`/`unknown-outcome`/`still-running`). */
  readonly outcome: 'cancelled' | 'failed' | 'succeeded' | 'unknown-outcome' | 'still-running';
}

/** Deterministic authority-decision Evidence (Story 2.9, AD-3, AD-7, AD-24).
 * Sanitized + attributable: links PromptRoundId/OperationId + digests +
 * authority/matrix/policy versions + Workspace + provider/service identity +
 * decision + reason + source event. No secrets or raw payloads. Distinct from
 * `EvidenceRecordedPayload` (which carries the derived NormalizedIntent) — this
 * is an additive, backward-compatible durable kind (AD-14). */
export interface AuthorityEvidenceRecordedPayload {
  readonly kind: 'AuthorityEvidenceRecorded';
  readonly operationId: string;
  readonly promptRoundId: string | null;
  readonly decisionKind: 'policy-decision' | 'approval' | 'denial' | 'revocation' | 'boundary-change' | 'consent-decision' | 'credential-boundary-refusal' | 'auto-permit';
  readonly actionDigest: string | null;
  readonly targetDigest: string | null;
  readonly payloadDigest: string | null;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly matrixVersion: number;
  readonly policyVersion: number;
  readonly workspaceId: string;
  readonly providerServiceIdentity: string | null;
  readonly decision: 'allow' | 'ask' | 'deny' | 'cancelled' | 'stale' | 'refused';
  readonly reasonCode: string;
  readonly completeness: EvidenceCompleteness;
  readonly sourceEventId: string | null;
  readonly nextStep: string;
}

export type DurableEventPayload =
  | PromptSubmittedPayload
  | ChatInterruptedPayload
  | RemoteOutputObservedPayload
  | EffectDispatchCommittedPayload
  | OperationSucceededPayload
  | OperationFailedPayload
  | OperationBlockedPayload
  | OperationCancelledPayload
  | OperationUnknownOutcomePayload
  | HealthChangedPayload
  | CapabilityChangedPayload
  | EvidenceRecordedPayload
  | ContextCompactedPayload
  | PinChangedPayload
  | ContextDecisionRecordedPayload
  | ContextManifestFinalizedPayload
  | ContextOverflowBlockedPayload
  | UsageObservedPayload
  | RuntimeActivationEstablishedPayload
  | AuthorityChangedPayload
  | PolicyDecisionRecordedPayload
  | BoundaryExpansionGrantedPayload
  | BoundaryExpansionRevokedPayload
  | ApprovalGrantedPayload
  | AuthorizationConsumedPayload
  | AuthorizationRevokedPayload
  | AuthorityEvidenceRecordedPayload;

export const DURABLE_EVENT_KINDS = [
  'PromptSubmitted', 'ChatInterrupted', 'RemoteOutputObserved', 'EffectDispatchCommitted',
  'OperationSucceeded', 'OperationFailed', 'OperationBlocked', 'OperationCancelled',
  'OperationUnknownOutcome', 'HealthChanged', 'CapabilityChanged', 'EvidenceRecorded',
  'ContextCompacted', 'PinChanged', 'ContextDecisionRecorded', 'ContextManifestFinalized', 'ContextOverflowBlocked', 'UsageObserved', 'RuntimeActivationEstablished', 'AuthorityChanged',
  'PolicyDecisionRecorded', 'BoundaryExpansionGranted', 'BoundaryExpansionRevoked',
  'ApprovalGranted', 'AuthorizationConsumed', 'AuthorizationRevoked',
  'AuthorityEvidenceRecorded',
] as const;

export type DurableEventKind = (typeof DURABLE_EVENT_KINDS)[number];

/** A durable event is an envelope whose payload is a DurableEventPayload. */
export type DurableEvent = EventEnvelope<DurableEventPayload>;

// --- Transient events (NOT durable; progress only — AD-3) ---
export interface TokenDelta { readonly kind: 'TokenDelta'; readonly delta: string }
export interface Progress { readonly kind: 'Progress'; readonly message: string; readonly ratio?: number }
export type TransientEvent = TokenDelta | Progress;

export const TRANSIENT_EVENT_KINDS = ['TokenDelta', 'Progress'] as const;

/** Compile-time exhaustiveness map for durable event kinds. */
export const _DURABLE_EXHAUSTIVE: Record<DurableEventPayload['kind'], true> = {
  PromptSubmitted: true,
  ChatInterrupted: true,
  RemoteOutputObserved: true,
  EffectDispatchCommitted: true,
  OperationSucceeded: true,
  OperationFailed: true,
  OperationBlocked: true,
  OperationCancelled: true,
  OperationUnknownOutcome: true,
  HealthChanged: true,
  CapabilityChanged: true,
  EvidenceRecorded: true,
  ContextCompacted: true,
  PinChanged: true,
  ContextDecisionRecorded: true,
  ContextManifestFinalized: true,
  ContextOverflowBlocked: true,
  UsageObserved: true,
  RuntimeActivationEstablished: true,
  AuthorityChanged: true,
  PolicyDecisionRecorded: true,
  BoundaryExpansionGranted: true,
  BoundaryExpansionRevoked: true,
  ApprovalGranted: true,
  AuthorizationConsumed: true,
  AuthorizationRevoked: true,
  AuthorityEvidenceRecorded: true,
};