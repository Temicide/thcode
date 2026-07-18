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

export interface ContextContributorProjection {
  readonly itemId: string;
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  readonly inclusion: string;
  readonly provenance: string;
  readonly trust: string;
  readonly estimatedTokens: number;
  readonly measuredBytes: number;
  readonly omittedReason?: string;
}
export interface ContextProjection {
  readonly estimatedTokens: number;
  readonly effectiveCapacity: number | 'percentage unavailable';
  readonly utilizationPercent: number | 'percentage unavailable';
  readonly pinnedTurnCount: number;
  readonly contributors?: readonly ContextContributorProjection[];
  readonly omissions?: readonly { readonly itemId: string; readonly reason: string }[];
  readonly manifestId?: string | null;
  readonly measurement?: string;
}
export interface UsageProjection {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly calls: number;
  readonly measurement: string;
  readonly observations: readonly { readonly operationId: string; readonly modelId: string; readonly source: string; readonly observedAt: string }[];
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

/**
 * Runtime Activation / authority projection (Story 2.1 AC #2, AD-22, AD-28).
 * Workspace identity, activation identity/revision, Work Mode, and Permission
 * Profile are independently addressable fields — none of them implies any
 * other. A separate contract from `StatusProjection` (rather than widening
 * it) so existing Epic 1 consumers of `StatusProjection` are unaffected;
 * Story 2.8's future base envelope may later fold these fields in.
 */
export interface AuthorityProjection {
  readonly activationId: string;
  readonly activationRevision: number;
  readonly workspaceId: string;
  readonly workMode: 'plan' | 'build';
  readonly permissionProfile: 'manual' | 'assisted' | 'full-access';
  readonly fullAccess: boolean;
  /** The Full-Access-only sensitive-transfer override (ADR 0012) — separate
   * authority from `fullAccess` itself per AD-17. */
  readonly sensitiveTransferOverride: boolean;
  /** Count of durable Boundary Expansions currently on record for this
   * activation's Workspace (revoked/expired ones excluded) — AC #5. */
  readonly activeBoundaryExpansionCount: number;
  readonly enforcementVerified: boolean;
}