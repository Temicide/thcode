// CoreProtocolV1 projections (AD-2). Plain serializable objects so Ink,
// redirected text, and headless JSON render identical fields and tokens
// (AC #4). No methods; no secrets.

import type { HealthState } from './events.js';

export interface StatusProjection {
  readonly workMode: 'plan' | 'build';
  readonly permissionProfile: 'manual' | 'assisted' | 'full-access';
  readonly fullAccess: boolean;
  readonly providerId: string;
  readonly modelId: string;
  readonly healthState: HealthState;
  /** Canonical: a number when known, or `'percentage unavailable'` (AD-28, UX-DR-031). */
  readonly contextPercent: number | 'percentage unavailable';
  readonly enforcementVerified: boolean;
}

export interface SessionProjection {
  readonly sessionId: string;
  readonly name: string;
  readonly workspaceRoot: string;
  readonly lastActivity: string;
}

export interface ContextProjection {
  readonly estimatedTokens: number;
  readonly effectiveCapacity: number | 'percentage unavailable';
  readonly utilizationPercent: number | 'percentage unavailable';
  readonly pinnedTurnCount: number;
}

export interface ArtifactProjection {
  readonly id: string;
  readonly kind: string;
  readonly contentHash: string;
  readonly sizeBytes: number;
  readonly completeness: 'complete' | 'partial' | 'sanitized-with-omissions' | 'stale' | 'unavailable';
}

/** Canonical capability states (UX-DR-101). */
export interface CapabilityProjection {
  readonly id: string;
  readonly state: 'working' | 'Catalogued — Not available yet' | 'disabled' | 'unconfigured' | 'unhealthy' | 'quarantined';
  readonly category: string;
  readonly modality: string;
}