// CoreProtocolV1 projections (AD-2). Plain serializable objects so Ink,
// redirected text, and headless JSON render identical fields and tokens
// (AC #4). No methods; no secrets.

export interface StatusProjection {
  readonly workMode: 'plan' | 'build';
  readonly permissionProfile: 'manual' | 'assisted' | 'full-access';
  readonly fullAccess: boolean;
  readonly providerId: string;
  readonly modelId: string;
  readonly healthState: 'unconfigured' | 'configured' | 'checking' | 'available' | 'unavailable' | 'unhealthy' | 'quarantined';
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

/** A single attributable transcript turn derived from durable events (AD-2, AD-3).
 * The UI renders these; it never builds its own authoritative transcript. */
export interface TranscriptTurnProjection {
  readonly promptRoundId: string;
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  readonly text: string;
  readonly timestamp: string;
  readonly interrupted: boolean;
  readonly evidenceComplete: 'complete' | 'partial' | 'sanitized-with-omissions' | 'stale' | 'unavailable';
}

/** The first attributable conversation projection (AD-2). Aggregates status,
 * transcript, context, and health into one serializable object so Ink,
 * redirected text, and headless JSON render identically (UX-DR-031). */
export interface ConversationProjection {
  readonly status: StatusProjection;
  readonly session: SessionProjection;
  readonly transcript: readonly TranscriptTurnProjection[];
  readonly context: ContextProjection;
}