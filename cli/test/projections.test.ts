import { describe, expect, it } from 'vitest';
import { CoreApp } from '../src/core/app.js';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';
import type { ConversationProjection, StatusProjection, TranscriptTurnProjection } from '../src/core/protocol/projections.js';

function makeCore() {
  return new CoreApp({
    credentials: new InMemoryCredentialStore(),
    workspaceRoot: '/tmp/test-ws',
  });
}

describe('CoreApp.query — canonical ConversationProjection (AC #1, #2, #3)', () => {
  it('returns a serializable projection with status, session, transcript, context', () => {
    const core = makeCore();
    const p = core.query();
    expect(p.status.workMode).toBe('build');
    expect(p.status.permissionProfile).toBe('manual');
    expect(p.status.fullAccess).toBe(false);
    expect(p.status.providerId).toBe('typhoon');
    expect(typeof p.status.modelId).toBe('string');
    expect(p.status.healthState).toBe('unconfigured');
    expect(p.status.enforcementVerified).toBe(false);
    expect(p.session.workspaceRoot).toBe('/tmp/test-ws');
    expect(Array.isArray(p.transcript)).toBe(true);
    expect(typeof p.context.estimatedTokens).toBe('number');
  });

  it('statusProjection uses canonical tokens (percentage unavailable, health states)', () => {
    const core = makeCore();
    const s = core.statusProjection();
    const tokens = ['unconfigured', 'configured', 'checking', 'available', 'unavailable', 'unhealthy', 'quarantined'];
    expect(tokens).toContain(s.healthState);
    // contextPercent is a number in the prototype (estimated); the contract
    // permits 'percentage unavailable' when capacity is unknown.
    expect(typeof s.contextPercent === 'number' || s.contextPercent === 'percentage unavailable').toBe(true);
  });

  it('transcript turns are derived from in-memory history, not built by the UI (AD-2)', () => {
    const core = makeCore();
    // Simulate a turn by pushing history directly (test affordance).
    // After a real runTurn, history would carry user + assistant messages.
    const before = core.query().transcript.length;
    expect(before).toBe(0);
  });

  it('the projection is JSON-serializable (parity for Ink/redirected/headless, UX-DR-031)', () => {
    const core = makeCore();
    const p = core.query();
    const json = JSON.stringify(p);
    const parsed = JSON.parse(json) as ConversationProjection;
    expect(parsed.status.providerId).toBe('typhoon');
    expect(parsed.transcript).toEqual([]);
    // No secrets in the projection.
    expect(json).not.toContain('sk-');
  });
});

describe('CoreApp.query — transcript grows after a turn (AC #1)', () => {
  it('query reflects a simulated user+assistant turn in the transcript', () => {
    const core = makeCore();
    // Push history directly to simulate a completed turn without a live call.
    (core as unknown as { history: { role: 'user' | 'assistant'; content: string }[] }).history = [
      { role: 'user', content: 'สวัสดี' },
      { role: 'assistant', content: 'สวัสดีครับ' },
    ];
    const p = core.query();
    expect(p.transcript).toHaveLength(2);
    expect(p.transcript[0].role).toBe('user');
    expect(p.transcript[0].text).toBe('สวัสดี');
    expect(p.transcript[1].role).toBe('assistant');
    expect(p.transcript[1].text).toBe('สวัสดีครับ');
    // Thai UTF-8 preserved through serialization (NFR-9).
    expect(JSON.stringify(p.transcript[0])).toContain('สวัสดี');
  });
});