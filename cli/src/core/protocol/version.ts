// CoreProtocolV1 version (AD-2, AD-3). A major-version mismatch fails startup
// (AD-2 "major-version mismatch fails startup"). The version is the single
// compatibility gate between UI, persistence, and adapters.

export const PROTOCOL_MAJOR = 1 as const;
// 1.1: additive — EvidenceRecordedPayload gained evidenceKind/promptRoundId/
// promptHash/intent fields (Story 1.9 AC #3 fix: NormalizedIntent Evidence is
// now durably journaled, not just referenced).
// 1.2: additive — Epic 2 durable event kinds (RuntimeActivationEstablished,
// AuthorityChanged, PolicyDecisionRecorded, BoundaryExpansionGranted,
// BoundaryExpansionRevoked; Stories 2.1-2.3). Backward-compatible; major
// unchanged so existing consumers are unaffected (AD-2 fail-closed only on
// major mismatch).
export const PROTOCOL_MINOR = 2 as const;

export function protocolVersion(): string {
  return `${PROTOCOL_MAJOR}.${PROTOCOL_MINOR}`;
}