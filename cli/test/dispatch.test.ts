import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { dispatchTyphoonTurn, validateToolProposal } from '../src/core/agent/dispatch.js';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';
import { ProviderRegistry } from '../src/core/providers/registry.js';
import type { ProviderAdapter, ProviderAvailability, ProviderCapabilities, ProviderRequest, ProviderResult, RetryableErrorMeta, TokenSink } from '../src/core/providers/types.js';
import { SessionStore } from '../src/core/sessions/store.js';
import { SessionRepository } from '../src/core/sessions/repository.js';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'thcode-dispatch-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const fixedClock = (() => {
  let n = 0;
  return () => `2026-07-17T09:00:${String(n++).padStart(2, '0')}.000Z`;
})();

/** Fake provider that streams a controlled sequence of chunks and returns a
 * final or tool-call result. */
class FakeTyphoon implements ProviderAdapter {
  readonly capabilities: ProviderCapabilities = {
    modelId: 'typhoon-fake',
    provider: 'typhoon',
    inputModalities: ['text'],
    contextLimit: 128_000,
    supportsToolCalls: true,
    supportsStreaming: true,
    dataHandling: 'fake',
  };
  constructor(
    private readonly chunks: string[],
    private readonly final: ProviderResult,
    private readonly shouldThrow?: (signal?: AbortSignal) => boolean,
  ) {}
  availability(apiKeyPresent: boolean): ProviderAvailability {
    return apiKeyPresent
      ? { available: true, authState: 'authenticated' }
      : { available: false, authState: 'no-credential', reason: 'no key' };
  }
  classifyError(err: unknown): RetryableErrorMeta {
    const status = (err as { status?: number })?.status;
    if (status === 429) return { retryable: true, kind: 'rate-limit' };
    return { retryable: false, kind: 'unknown' };
  }
  async complete(request: ProviderRequest, apiKey: string, onToken?: TokenSink): Promise<ProviderResult> {
    if (this.shouldThrow?.(request.signal)) {
      throw Object.assign(new Error('network failed'), { status: 500 });
    }
    for (const ch of this.chunks) {
      if (request.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      onToken?.(ch);
    }
    return this.final;
  }
}

function makeRegistry(adapter: ProviderAdapter): ProviderRegistry {
  const reg = new ProviderRegistry('typhoon');
  reg.register(adapter);
  return reg;
}

function makeRepo(file: string): { repo: SessionRepository; store: SessionStore } {
  const creds = new InMemoryCredentialStore();
  const result = SessionStore.openSync(creds, path.join(tmp, file));
  if (!result.ok) throw new Error(`open failed: ${result.cause}`);
  return { repo: new SessionRepository(result.store, fixedClock), store: result.store };
}

describe('validateToolProposal — PR-1 freeze (AD-14, AC #6)', () => {
  it('accepts a valid final result', () => {
    expect(validateToolProposal({ kind: 'final', text: 'hi' }).valid).toBe(true);
  });
  it('accepts a well-formed tool_call', () => {
    expect(validateToolProposal({ kind: 'tool_call', toolName: 'read', input: { path: 'a.ts' } }).valid).toBe(true);
  });
  it('rejects an empty toolName after one pass (no repair)', () => {
    const v = validateToolProposal({ kind: 'tool_call', toolName: '', input: {} });
    expect(v.valid).toBe(false);
    expect(v.cause).toBe('tool_call.toolName is empty');
  });
  it('rejects a non-object input after one pass (no repair)', () => {
    const v = validateToolProposal({ kind: 'tool_call', toolName: 'read', input: 'not-an-object' as unknown as Record<string, unknown> });
    expect(v.valid).toBe(false);
    expect(v.cause).toBe('tool_call.input is not an object');
  });
});

describe('dispatchTyphoonTurn — durable sanitized chunks (AC #1, #2, #3)', () => {
  it('streams chunks, journals each as RemoteOutputObserved, and returns final text', async () => {
    const creds = new InMemoryCredentialStore();
    await creds.set('typhoon', 'sk-test');
    const reg = makeRegistry(new FakeTyphoon(['สวัสดี', ' world'], { kind: 'final', text: 'สวัสดี world' }));
    const { repo, store } = makeRepo('d1.db');
    const tokens: string[] = [];
    const r = await dispatchTyphoonTurn({
      sessionId: 'sess-1', promptText: 'say hello', providers: reg, credentials: creds,
      messages: [{ role: 'user', content: 'say hello' }], repo, clock: fixedClock,
      onToken: (d) => tokens.push(d),
    });
    expect(r.interrupted).toBe(false);
    expect(r.text).toBe('สวัสดี world');
    expect(tokens).toEqual(['สวัสดี', ' world']);
    expect(r.highWaterMark).toBe('chunk-2');
    const kinds = r.events.map((e) => e.payload.kind);
    expect(kinds).toContain('PromptSubmitted');
    expect(kinds.filter((k) => k === 'RemoteOutputObserved')).toHaveLength(2);
    expect(kinds).toContain('OperationSucceeded');
    // Journaled in the repo too.
    const journalKinds = repo.queryEvents('sess-1' as never, 0).map((e) => e.payload.kind);
    expect(journalKinds).toContain('OperationSucceeded');
    store.close();
  });

  it('sanitizes a chunk that contains a Bearer token before journaling', async () => {
    const creds = new InMemoryCredentialStore();
    await creds.set('typhoon', 'sk-test');
    const reg = makeRegistry(new FakeTyphoon(['Authorization: Bearer secret123abc456'], { kind: 'final', text: 'ok' }));
    const { repo, store } = makeRepo('d2.db');
    const r = await dispatchTyphoonTurn({
      sessionId: 'sess-2', promptText: 'show me', providers: reg, credentials: creds,
      messages: [{ role: 'user', content: 'show me' }], repo, clock: fixedClock,
    });
    const chunkEvents = r.events.filter((e) => e.payload.kind === 'RemoteOutputObserved');
    expect(chunkEvents).toHaveLength(1);
    const chunkJson = JSON.stringify(chunkEvents[0]);
    expect(chunkJson).not.toContain('secret123abc456');
    expect(chunkJson).toContain('[redacted]');
    store.close();
  });
});

describe('dispatchTyphoonTurn — interruption boundary (AC #4, AD-3)', () => {
  it('records ChatInterrupted with the high-water mark on abort, no auto-retry', async () => {
    const creds = new InMemoryCredentialStore();
    await creds.set('typhoon', 'sk-test');
    const reg = makeRegistry(new FakeTyphoon(['chunk-a', 'chunk-b'], { kind: 'final', text: 'never' }));
    const { repo, store } = makeRepo('d3.db');
    const ac = new AbortController();
    const tokens: string[] = [];
    // Abort after the first chunk is recorded.
    const r = await dispatchTyphoonTurn({
      sessionId: 'sess-3', promptText: 'test', providers: reg, credentials: creds,
      messages: [{ role: 'user', content: 'test' }], repo, clock: fixedClock,
      signal: ac.signal,
      onToken: (d) => { tokens.push(d); ac.abort(); },
    });
    expect(r.interrupted).toBe(true);
    expect(r.text).toBe('Chat interrupted');
    expect(r.highWaterMark).not.toBeNull();
    const kinds = r.events.map((e) => e.payload.kind);
    expect(kinds).toContain('ChatInterrupted');
    expect(kinds).not.toContain('OperationSucceeded');
    store.close();
  });
});

describe('dispatchTyphoonTurn — PR-1 invalid proposal rejection (AC #6, AD-14)', () => {
  it('rejects an invalid tool proposal after one pass, no repair', async () => {
    const creds = new InMemoryCredentialStore();
    await creds.set('typhoon', 'sk-test');
    const reg = makeRegistry(new FakeTyphoon([], { kind: 'tool_call', toolName: '', input: {} }));
    const { repo, store } = makeRepo('d4.db');
    const r = await dispatchTyphoonTurn({
      sessionId: 'sess-4', promptText: 'do something', providers: reg, credentials: creds,
      messages: [{ role: 'user', content: 'do something' }], repo, clock: fixedClock,
    });
    expect(r.proposalRejected).toBe(true);
    expect(r.rejectionCause).toBe('tool_call.toolName is empty');
    expect(r.text).toContain('Rejected invalid proposal');
    const kinds = r.events.map((e) => e.payload.kind);
    expect(kinds).toContain('OperationBlocked');
    expect(kinds).not.toContain('OperationSucceeded');
    store.close();
  });
});

describe('dispatchTyphoonTurn — ambiguity + unavailability (AC #5)', () => {
  it('asks for clarification on material ambiguity without dispatching', async () => {
    const creds = new InMemoryCredentialStore();
    await creds.set('typhoon', 'sk-test');
    const reg = makeRegistry(new FakeTyphoon([], { kind: 'final', text: 'never' }));
    const r = await dispatchTyphoonTurn({
      sessionId: 'sess-5', promptText: '???', providers: reg, credentials: creds,
      messages: [{ role: 'user', content: '???' }], clock: fixedClock,
    });
    expect(r.intent?.ambiguity).toBe('material');
    expect(r.text).toMatch(/Please specify|โปรดระบุ/);
    expect(r.events.some((e) => e.payload.kind === 'OperationSucceeded')).toBe(false);
  });

  it('blocks with a typed cause when no key is present', async () => {
    const creds = new InMemoryCredentialStore();
    const reg = makeRegistry(new FakeTyphoon([], { kind: 'final', text: 'never' }));
    const r = await dispatchTyphoonTurn({
      sessionId: 'sess-6', promptText: 'compile @main.cpp', providers: reg, credentials: creds,
      messages: [{ role: 'user', content: 'compile @main.cpp' }], clock: fixedClock,
    });
    expect(r.text).toContain('unavailable');
    expect(r.events.some((e) => e.payload.kind === 'OperationBlocked')).toBe(true);
  });
});