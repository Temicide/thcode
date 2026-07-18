// Activity history + deterministic replay (Story 2.10, FR-36, FR-37, FR-38,
// FR-39, AD-3, AD-28). The activity projection groups records by Prompt Round
// and operation class, includes EVERY proposed or executed call (including
// auto-permitted list/read/search — AC #4), and shows OperationId, event
// identity, canonical status, safe summary, authority revision, and Evidence
// reference (AC #1). Journal replay orders by durable sequence/timestamp,
// deduplicates by EventId, preserves source/provenance, and never duplicates
// calls or terminal outcomes (AC #3). Corrupt/incomplete/unavailable replay
// records are marked `corrupt`/`unavailable`/`not-authoritative` with the gap
// and recovery action visible — replay never claims a complete history (AC #6).
// No raw prompts/commands/payloads by default (AC #2); narrow/redirected/
// linearized/headless JSON/screen-reader/no-color output stays semantically
// complete and navigable without animation or color-only cues (AC #5).

import type { DurableEvent } from './events.js';

export type ActivityCompleteness = 'complete' | 'corrupt' | 'unavailable' | 'not-authoritative';

/** One activity record derived from a durable event (AC #1). Secret-free. */
export interface ActivityRecord {
  readonly sequence: number;
  readonly eventId: string;
  readonly promptRoundId: string | null;
  readonly operationId: string | null;
  readonly operationClass: string;
  readonly status: string;
  readonly safeSummary: string;
  readonly authorityRevision: number | null;
  readonly evidenceRef: string | null;
  readonly timestamp: string;
  readonly completeness: ActivityCompleteness;
}

export interface ActivityProjection {
  readonly records: readonly ActivityRecord[];
  readonly grouped: ReadonlyMap<string, readonly ActivityRecord[]>;
  readonly truncatedCount: number;
  readonly corruptCount: number;
  readonly complete: boolean;
}

/** Map a durable event payload kind to an operation class + canonical status
 * token (AC #1, AD-28). Terminal events map to their terminal status; lifecycle
 * events stay nonterminal. */
function classifyEvent(event: DurableEvent): { operationClass: string; status: string; summary: string; authorityRevision: number | null; evidenceRef: string | null; completeness: ActivityCompleteness } {
  const p = event.payload;
  switch (p.kind) {
    case 'PromptSubmitted': return { operationClass: 'prompt', status: 'proposed', summary: 'prompt submitted', authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'EffectDispatchCommitted': return { operationClass: 'effect', status: 'dispatch-committed', summary: 'effect dispatch committed', authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'OperationSucceeded': return { operationClass: 'effect', status: 'succeeded', summary: 'operation succeeded', authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'OperationFailed': return { operationClass: 'effect', status: 'failed', summary: `failed: ${p.cause}`, authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'OperationBlocked': return { operationClass: 'effect', status: 'blocked', summary: `blocked: ${p.cause}`, authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'OperationCancelled': return { operationClass: 'effect', status: 'cancelled', summary: 'cancelled before dispatch commit', authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'OperationUnknownOutcome': return { operationClass: 'effect', status: 'unknown-outcome', summary: 'dispatch committed, no terminal proof', authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'RuntimeActivationEstablished': return { operationClass: 'authority', status: 'idle', summary: 'runtime activation established', authorityRevision: 1, evidenceRef: null, completeness: 'complete' };
    case 'AuthorityChanged': return { operationClass: 'authority', status: 'idle', summary: `authority changed: ${p.field}=${p.value}`, authorityRevision: p.revision, evidenceRef: null, completeness: 'complete' };
    case 'PolicyDecisionRecorded': return { operationClass: 'authority', status: p.outcome === 'allow' ? 'authorized' : p.outcome === 'ask' ? 'proposed' : 'denied', summary: `policy ${p.outcome}: ${p.reason}`, authorityRevision: p.activationRevision, evidenceRef: null, completeness: 'complete' };
    case 'ApprovalGranted': return { operationClass: 'authority', status: 'authorized', summary: 'approval granted for exact proposal', authorityRevision: p.authorityRevision, evidenceRef: p.authorizationId, completeness: 'complete' };
    case 'AuthorizationConsumed': return { operationClass: 'authority', status: 'dispatch-committed', summary: 'one-shot authorization consumed', authorityRevision: null, evidenceRef: p.authorizationId, completeness: 'complete' };
    case 'AuthorizationRevoked': return { operationClass: 'authority', status: p.outcome, summary: `authorization revoked: ${p.reason}`, authorityRevision: null, evidenceRef: p.authorizationId, completeness: 'complete' };
    case 'BoundaryExpansionGranted': return { operationClass: 'boundary', status: 'idle', summary: 'boundary expansion granted', authorityRevision: null, evidenceRef: p.expansionId, completeness: 'complete' };
    case 'BoundaryExpansionRevoked': return { operationClass: 'boundary', status: 'idle', summary: 'boundary expansion revoked', authorityRevision: null, evidenceRef: p.expansionId, completeness: 'complete' };
    case 'AuthorityEvidenceRecorded': return { operationClass: 'evidence', status: p.decision, summary: `${p.decisionKind}: ${p.reasonCode}`, authorityRevision: p.authorityRevision, evidenceRef: event.id, completeness: p.completeness as ActivityCompleteness };
    case 'EvidenceRecorded': return { operationClass: 'evidence', status: 'complete', summary: 'normalized-intent evidence', authorityRevision: null, evidenceRef: event.id, completeness: 'complete' };
    case 'RemoteOutputObserved': return { operationClass: 'remote', status: 'still-running', summary: 'remote output observed', authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'ChatInterrupted': return { operationClass: 'remote', status: 'interruption-unknown', summary: 'chat interrupted', authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'HealthChanged': return { operationClass: 'health', status: p.state, summary: `health: ${p.providerId} ${p.state}`, authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'CapabilityChanged': return { operationClass: 'capability', status: p.state, summary: `capability: ${p.id} ${p.state}`, authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    case 'ContextCompacted': return { operationClass: 'context', status: 'idle', summary: `context compacted to ${p.targetPercent}%`, authorityRevision: null, evidenceRef: null, completeness: 'complete' };
    default: return { operationClass: 'unknown', status: 'not-authoritative', summary: 'unknown event kind', authorityRevision: null, evidenceRef: null, completeness: 'not-authoritative' };
  }
}

export interface BuildActivityProjectionInput {
  readonly events: readonly DurableEvent[];
  /** Cap on records returned; older records beyond the cap are counted in
   * `truncatedCount` (AC #2 — explicit truncation counts). 0 = no cap. */
  readonly cap?: number;
}

/** Build the activity projection from a durable-event stream (AC #1, AC #3).
   * Events are ordered by their durable sequence (caller-supplied order); a
   * replayed EventId is deduplicated so a call or terminal outcome never
   * appears twice. Corrupt/unavailable records are marked (AC #6). */
export function buildActivityProjection(input: BuildActivityProjectionInput): ActivityProjection {
  const seen = new Set<string>();
  const all: ActivityRecord[] = [];
  let corrupt = 0;
  let seq = 0;
  for (const event of input.events) {
    seq += 1;
    if (!event.id || !event.payload || !event.payload.kind) {
      corrupt += 1;
      all.push({ sequence: seq, eventId: event.id ?? '?', promptRoundId: null, operationId: null, operationClass: 'corrupt', status: 'corrupt', safeSummary: 'corrupt event record', authorityRevision: null, evidenceRef: null, timestamp: event.timestamp ?? '', completeness: 'corrupt' });
      continue;
    }
    if (seen.has(event.id)) continue; // AC #3 dedup
    seen.add(event.id);
    const cls = classifyEvent(event);
    all.push({
      sequence: seq,
      eventId: event.id,
      promptRoundId: event.promptRoundId ?? null,
      operationId: event.operationId ?? null,
      operationClass: cls.operationClass,
      status: cls.status,
      safeSummary: cls.summary,
      authorityRevision: cls.authorityRevision,
      evidenceRef: cls.evidenceRef,
      timestamp: event.timestamp,
      completeness: cls.completeness,
    });
  }
  const cap = input.cap ?? 0;
  let records = all;
  let truncatedCount = 0;
  if (cap > 0 && all.length > cap) {
    records = all.slice(all.length - cap);
    truncatedCount = all.length - cap;
  }
  const grouped = groupByPromptRoundAndClass(records);
  return {
    records,
    grouped,
    truncatedCount,
    corruptCount: corrupt,
    complete: corrupt === 0 && truncatedCount === 0,
  };
}

/** AC #1: group records by Prompt Round and operation class. */
export function groupByPromptRoundAndClass(records: readonly ActivityRecord[]): ReadonlyMap<string, readonly ActivityRecord[]> {
  const map = new Map<string, ActivityRecord[]>();
  for (const r of records) {
    const key = `${r.promptRoundId ?? 'no-round'}::${r.operationClass}`;
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return map;
}

export interface ActivityFilter {
  readonly promptRoundId?: string;
  readonly operationClass?: string;
  readonly showAll?: boolean;
}

/** AC #2: deterministic filtering. */
export function filterActivity(records: readonly ActivityRecord[], filter: ActivityFilter): readonly ActivityRecord[] {
  return records.filter((r) => {
    if (filter.promptRoundId !== undefined && r.promptRoundId !== filter.promptRoundId) return false;
    if (filter.operationClass !== undefined && r.operationClass !== filter.operationClass) return false;
    return true;
  });
}

/** AC #5: text rendering for redirected/linearized/headless/no-color output.
   * No color-only meaning; no animation; labels and identities stay intact. */
export function renderActivityText(projection: ActivityProjection, width = 0): string {
  const lines: string[] = [];
  if (projection.truncatedCount > 0) lines.push(`(truncated ${projection.truncatedCount} older record(s))`);
  if (projection.corruptCount > 0) lines.push(`(corrupt/unavailable: ${projection.corruptCount})`);
  for (const r of projection.records) {
    const line = `#${r.sequence} [${r.promptRoundId ?? '-'}/${r.operationClass}] op=${r.operationId ?? '-'} ${r.status} — ${r.safeSummary} (rev=${r.authorityRevision ?? '-'})`;
    lines.push(width > 0 && line.length > width ? `${line.slice(0, width - 1)}…` : line);
  }
  if (!projection.complete) lines.push('Activity history is incomplete; see gaps and recovery actions above.');
  return lines.join('\n');
}

/** AC #5: headless JSON rendering — same fields/tokens as text (UX-DR-031). */
export function renderActivityJson(projection: ActivityProjection): string {
  return JSON.stringify({
    records: projection.records,
    truncatedCount: projection.truncatedCount,
    corruptCount: projection.corruptCount,
    complete: projection.complete,
  });
}