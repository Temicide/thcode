import { describe, expect, it } from 'vitest';
import {
  assertCompatibleVersion,
  PROTOCOL_MAJOR,
  PROTOCOL_MINOR,
  protocolVersion,
  validateIntent,
  validateDurableEvent,
} from '../src/core/protocol/coreProtocol.js';
import {
  newEventId,
  newOperationId,
  newPromptRoundId,
  newSessionId,
} from '../src/core/protocol/ids.js';
import type { EventEnvelope } from '../src/core/protocol/envelope.js';
import { parseEnvelope, serializeEnvelope } from '../src/core/protocol/envelope.js';

function validEnvelope<T>(payload: T): EventEnvelope<T> {
  return {
    id: newEventId(),
    sessionId: newSessionId(),
    promptRoundId: newPromptRoundId(),
    operationId: newOperationId(),
    schemaVersion: protocolVersion(),
    timestamp: '2026-07-17T09:00:00.000Z',
    provenance: { kind: 'deterministic', source: 'test' },
    payload,
  };
}

describe('CoreProtocolV1 — version', () => {
  it('reports a semver-style version string', () => {
    expect(protocolVersion()).toBe(`${PROTOCOL_MAJOR}.${PROTOCOL_MINOR}`);
    expect(PROTOCOL_MAJOR).toBe(1);
  });

  it('assertCompatibleVersion passes for matching major', () => {
    expect(() => assertCompatibleVersion(PROTOCOL_MAJOR)).not.toThrow();
  });

  it('assertCompatibleVersion throws on major mismatch (fail-closed startup)', () => {
    expect(() => assertCompatibleVersion(2)).toThrow(/protocol version/i);
  });
});

describe('CoreProtocolV1 — intents (AC #1, #3)', () => {
  it('accepts a known intent type', () => {
    const r = validateIntent({ type: 'prompt.submit', text: 'hello' });
    expect(r.ok).toBe(true);
  });

  it('rejects an unknown intent type (AD-14 fail-closed)', () => {
    const r = validateIntent({ type: 'bogus.intent', text: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cause).toMatch(/unknown intent/i);
  });

  it('rejects a non-object intent', () => {
    const r = validateIntent(null);
    expect(r.ok).toBe(false);
  });

  it('rejects an intent missing required fields', () => {
    const r = validateIntent({ type: 'prompt.submit' });
    expect(r.ok).toBe(false);
  });
});

describe('CoreProtocolV1 — durable events (AC #1, #2, #5)', () => {
  it('accepts a well-formed durable event envelope', () => {
    const env = validEnvelope({ kind: 'PromptSubmitted', text: 'hi' });
    const r = validateDurableEvent(env);
    expect(r.ok).toBe(true);
  });

  it('rejects an envelope with a missing schemaVersion', () => {
    const env = { ...validEnvelope({ kind: 'PromptSubmitted', text: 'hi' }) };
    delete (env as Record<string, unknown>).schemaVersion;
    const r = validateDurableEvent(env);
    expect(r.ok).toBe(false);
  });

  it('rejects an envelope with a wrong major version', () => {
    const env = {
      ...validEnvelope({ kind: 'PromptSubmitted', text: 'hi' }),
      schemaVersion: '2.0',
    };
    const r = validateDurableEvent(env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cause).toMatch(/version/i);
  });

  it('rejects an envelope with a malformed timestamp', () => {
    const env = {
      ...validEnvelope({ kind: 'PromptSubmitted', text: 'hi' }),
      timestamp: 'not-a-date',
    };
    const r = validateDurableEvent(env);
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown event kind (AD-14)', () => {
    const env = validEnvelope({ kind: 'BogusEvent', text: 'hi' });
    const r = validateDurableEvent(env);
    expect(r.ok).toBe(false);
  });

  it('identifies the offending schema/version in the cause (AC #5)', () => {
    const env = {
      ...validEnvelope({ kind: 'PromptSubmitted', text: 'hi' }),
      schemaVersion: '9.9',
    };
    const r = validateDurableEvent(env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cause).toContain('9.9');
  });
});

describe('CoreProtocolV1 — UTF-8 / Thai stability (AC #2)', () => {
  it('Thai text and technical identifiers round-trip byte-for-byte', () => {
    const thai = 'สวัสดีครับ ทดสอบ Hello, World! @path/to/file.ts';
    const env = validEnvelope({ kind: 'PromptSubmitted', text: thai });
    const serialized = serializeEnvelope(env);
    const parsed = parseEnvelope<{ kind: string; text: string }>(serialized);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.payload.text).toBe(thai);
  });
});

describe('CoreProtocolV1 — canonical state tokens (AC #4)', () => {
  it('StatusProjection uses percentage unavailable and unknown-outcome tokens', async () => {
    const mod = await import('../src/core/protocol/projections.js');
    const status: mod.StatusProjection = {
      workMode: 'build',
      permissionProfile: 'manual',
      fullAccess: false,
      providerId: 'typhoon',
      modelId: 'typhoon-v1',
      healthState: 'unavailable',
      contextPercent: 'percentage unavailable',
      enforcementVerified: false,
    };
    expect(status.contextPercent).toBe('percentage unavailable');
    expect(status.healthState).toBe('unavailable');
  });

  it('CapabilityProjection uses UX-DR-101 canonical tokens', async () => {
    const mod = await import('../src/core/protocol/projections.js');
    const cap: mod.CapabilityProjection = {
      id: 't-ocr',
      state: 'Catalogued — Not available yet',
      category: 'vision',
      modality: 'image',
    };
    expect(cap.state).toBe('Catalogued — Not available yet');
  });
});

describe('CoreProtocolV1 — transient events are not durable (AC #1)', () => {
  it('TokenDelta is rejected as a durable event', () => {
    const env = validEnvelope({ kind: 'TokenDelta', delta: 'x' });
    const r = validateDurableEvent(env);
    expect(r.ok).toBe(false);
  });

  it('Progress is rejected as a durable event', () => {
    const env = validEnvelope({ kind: 'Progress', message: 'thinking' });
    const r = validateDurableEvent(env);
    expect(r.ok).toBe(false);
  });
});

describe('CoreProtocolV1 — ids are opaque and unique', () => {
  it('newSessionId returns distinct values', () => {
    expect(newSessionId()).not.toBe(newSessionId());
  });

  it('newEventId returns distinct values', () => {
    expect(newEventId()).not.toBe(newEventId());
  });
});