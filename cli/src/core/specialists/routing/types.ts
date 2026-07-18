// Routing types for Specialist prompt routing (Story 4.5).
// Discriminated union of routing decisions with typed provenance and
// task-relevant schema (one service only — never all services' schemas).

import type { HealthMap, DisabledSet } from '../catalog/projection.js';

// ---------------------------------------------------------------------------
// TaskRelevantSchema — only the ONE proposed service's schema
// ---------------------------------------------------------------------------

/** Secret-free transport-policy summary for a single service. */
export interface TransportPolicySummary {
  readonly allowedProtocols: readonly string[];
  readonly requiresTls: boolean;
  readonly allowedMethods: readonly string[];
}

/**
 * Task-relevant schema for exactly ONE proposed service.
 * Never includes credentials, other services' schemas, or endpoint URLs
 * that could leak secrets.
 */
export interface TaskRelevantSchema {
  readonly serviceId: string;
  readonly supportedInputs: readonly string[];
  readonly inputLimits: Record<string, string>;
  readonly transportPolicy: TransportPolicySummary;
}

// ---------------------------------------------------------------------------
// RoutingProvenance
// ---------------------------------------------------------------------------

export interface RoutingProvenance {
  /** SHA-256 hex of the original prompt bytes (via promptHash). */
  readonly promptHash: string;
  /** Matched terms per candidate service (serviceId -> matched terms). */
  readonly matchedTerms: Record<string, readonly string[]>;
  /** Matcher version constant. */
  readonly matcherVersion: number;
  /** ISO-8601 timestamp from the injectable clock. */
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// RoutingOptions
// ---------------------------------------------------------------------------

export interface RoutingOptions {
  /** Whether the session is interactive (TTY). */
  readonly isTTY: boolean;
  /** Health map: serviceId -> HealthState. */
  readonly healthMap: HealthMap;
  /** Set of disabled service IDs. */
  readonly disabledSet: DisabledSet;
  /** Material intent ambiguity signal from the intent extractor. */
  readonly intentAmbiguity?: 'none' | 'material';
}

// ---------------------------------------------------------------------------
// RoutingDecision — discriminated union
// ---------------------------------------------------------------------------

/** A clear single-service proposal with task-relevant schema. */
export interface ProposeDecision {
  readonly kind: 'propose';
  readonly serviceId: string;
  readonly serviceName: string;
  readonly rationale: string;
  readonly schema: TaskRelevantSchema;
  readonly provenance: RoutingProvenance;
}

/** Ambiguous routing — two or more services tie within the delta. */
export interface ClarifyDecision {
  readonly kind: 'clarify';
  readonly question: string;
  readonly candidates: readonly string[];
  readonly provenance: RoutingProvenance;
}

/** Unsupported routing — Specialist signal present but no invokable match. */
export interface RefusedDecision {
  readonly kind: 'refused';
  readonly reason: 'Catalogued — Not available yet' | 'unsupported';
  readonly detail: string;
  readonly provenance: RoutingProvenance;
}

/** Blocked routing — service unavailable, headless, or registry not loaded. */
export interface BlockedDecision {
  readonly kind: 'blocked';
  readonly cause: 'headless-blocked' | 'service-unavailable' | 'registry-unavailable';
  /** Canonical state token (e.g. 'unavailable', 'disabled', 'unhealthy'). */
  readonly stateToken?: string;
  /** Human-readable next action. */
  readonly nextAction?: string;
  readonly provenance: RoutingProvenance;
}

/** No Specialist signal — defer to normal flow. */
export interface NoneDecision {
  readonly kind: 'none';
  readonly provenance: RoutingProvenance;
}

export type RoutingDecision =
  | ProposeDecision
  | ClarifyDecision
  | RefusedDecision
  | BlockedDecision
  | NoneDecision;
