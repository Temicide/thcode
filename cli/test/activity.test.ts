// Story 2.10: activity history + deterministic replay.
import { describe, expect, it } from 'vitest';
import {
  buildActivityProjection,
  filterActivity,
  groupByPromptRoundAndClass,
  renderActivityJson,
  renderActivityText,
} from '../src/core/protocol/activity.js';
import { durableEvent } from '../src/core/agent/dispatch.js';
import { asSessionId } from '../src/core/protocol/ids.js';

const clock = () => '2026-07-17T00:00:00.000Z';
const sid = asSessionId('sess-1');

function ev(payload: Parameters<typeof durableEvent>[0], opts: { promptRoundId?: string; operationId?: string } = {}) {
  return durableEvent(payload, sid, { provenanceKind: 'deterministic', provenanceSource: 'test', clock, ...opts });
}

describe('Activity projection — groups by Prompt Round + operation class, includes every call (AC #1, #4)', () => {
  it('includes auto-permitted list/read/search evidence and terminal outcomes', () => {
    const events = [
      ev({ kind: 'PromptSubmitted', text: 'hi' }, { promptRoundId: 'r1', operationId: 'op1' }),
      ev({ kind: 'AuthorityEvidenceRecorded', operationId: 'op2', promptRoundId: null, decisionKind: 'auto-permit', actionDigest: 'd', targetDigest: 'd', payloadDigest: null, activationRevision: 1, authorityRevision: 1, matrixVersion: 1, policyVersion: 1, workspaceId: 'ws', providerServiceIdentity: 'local-tool', decision: 'allow', reasonCode: 'assisted-read-allow', completeness: 'complete', sourceEventId: null, nextStep: 'continue' }, { operationId: 'op2', promptRoundId: 'r1' }),
      ev({ kind: 'OperationSucceeded', operationId: 'op1' }, { promptRoundId: 'r1', operationId: 'op1' }),
    ];
    const proj = buildActivityProjection({ events });
    expect(proj.records.length).toBe(3);
    const auto = proj.records.find((r) => r.operationClass === 'evidence' && r.status === 'allow');
    expect(auto).toBeDefined();
    expect(auto!.safeSummary).toContain('auto-permit');
  });

  it('groups records by Prompt Round and operation class', () => {
    const events = [
      ev({ kind: 'PromptSubmitted', text: 'hi' }, { promptRoundId: 'r1', operationId: 'op1' }),
      ev({ kind: 'OperationSucceeded', operationId: 'op1' }, { promptRoundId: 'r1', operationId: 'op1' }),
    ];
    const proj = buildActivityProjection({ events });
    expect(proj.grouped.has('r1::prompt')).toBe(true);
    expect(proj.grouped.has('r1::effect')).toBe(true);
  });
});

describe('Activity projection — replay dedup by EventId (AC #3)', () => {
  it('a replayed event is not duplicated', () => {
    const e = ev({ kind: 'OperationSucceeded', operationId: 'op1' }, { promptRoundId: 'r1', operationId: 'op1' });
    const proj = buildActivityProjection({ events: [e, e] });
    expect(proj.records.length).toBe(1);
  });
});

describe('Activity projection — lifecycle through terminal states (AC #4)', () => {
  it('shows proposed → dispatch-committed → succeeded without inventing future events', () => {
    const events = [
      ev({ kind: 'PolicyDecisionRecorded', operationId: 'op1', actionClass: 'write_file', outcome: 'allow', reason: 'approved', matrixVersion: 1, activationRevision: 1 }, { operationId: 'op1', promptRoundId: 'r1' }),
      ev({ kind: 'EffectDispatchCommitted', operationId: 'op1' }, { operationId: 'op1', promptRoundId: 'r1' }),
      ev({ kind: 'OperationSucceeded', operationId: 'op1' }, { operationId: 'op1', promptRoundId: 'r1' }),
    ];
    const proj = buildActivityProjection({ events });
    const statuses = proj.records.map((r) => r.status);
    expect(statuses).toEqual(['authorized', 'dispatch-committed', 'succeeded']);
  });
});

describe('Activity projection — filtering + truncation counts (AC #2)', () => {
  it('filters by Prompt Round and operation class deterministically', () => {
    const events = [
      ev({ kind: 'OperationSucceeded', operationId: 'op1' }, { promptRoundId: 'r1', operationId: 'op1' }),
      ev({ kind: 'OperationSucceeded', operationId: 'op2' }, { promptRoundId: 'r2', operationId: 'op2' }),
    ];
    const proj = buildActivityProjection({ events });
    expect(filterActivity(proj.records, { promptRoundId: 'r1' }).length).toBe(1);
    expect(filterActivity(proj.records, { operationClass: 'effect' }).length).toBe(2);
  });
  it('reports explicit truncation counts when capped', () => {
    const events = Array.from({ length: 5 }, (_, i) => ev({ kind: 'OperationSucceeded', operationId: `op${i}` }, { promptRoundId: 'r1', operationId: `op${i}` }));
    const proj = buildActivityProjection({ events, cap: 2 });
    expect(proj.records.length).toBe(2);
    expect(proj.truncatedCount).toBe(3);
    expect(proj.complete).toBe(false);
  });
});

describe('Activity projection — corrupt replay records (AC #6)', () => {
  it('marks a corrupt event and does not claim a complete history', () => {
    const broken = { id: '', sessionId: sid, schemaVersion: '1.0', timestamp: clock(), provenance: { kind: 'deterministic', source: 'x' }, payload: { kind: 'OperationSucceeded', operationId: 'op1' } } as never;
    const proj = buildActivityProjection({ events: [broken] });
    expect(proj.corruptCount).toBe(1);
    expect(proj.complete).toBe(false);
    expect(renderActivityText(proj)).toContain('corrupt/unavailable: 1');
  });
});

describe('Activity projection — output parity (AC #5)', () => {
  it('text and JSON carry the same status tokens, ids, and counts without color-only meaning', () => {
    const events = [
      ev({ kind: 'OperationSucceeded', operationId: 'op1' }, { promptRoundId: 'r1', operationId: 'op1' }),
    ];
    const proj = buildActivityProjection({ events });
    const text = renderActivityText(proj);
    const json = renderActivityJson(proj);
    expect(text).toContain('succeeded');
    expect(json).toContain('"status":"succeeded"');
    expect(json).toContain('"operationId":"op1"');
  });
});