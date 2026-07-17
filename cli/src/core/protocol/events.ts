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
export interface EvidenceRecordedPayload { readonly kind: 'EvidenceRecorded'; readonly operationId: string; readonly completeness: EvidenceCompleteness }
export interface ContextCompactedPayload { readonly kind: 'ContextCompacted'; readonly targetPercent: number }

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
  | ContextCompactedPayload;

export const DURABLE_EVENT_KINDS = [
  'PromptSubmitted', 'ChatInterrupted', 'RemoteOutputObserved', 'EffectDispatchCommitted',
  'OperationSucceeded', 'OperationFailed', 'OperationBlocked', 'OperationCancelled',
  'OperationUnknownOutcome', 'HealthChanged', 'CapabilityChanged', 'EvidenceRecorded',
  'ContextCompacted',
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
};