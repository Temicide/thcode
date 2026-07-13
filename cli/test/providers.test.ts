import { describe, expect, it } from 'vitest';
import {
  createDefaultProviderRegistry,
  DEFAULT_PROVIDER_ID,
  UnknownProviderError,
} from '../src/core/providers/registry.js';
import { TyphoonAdapter } from '../src/core/providers/typhoon.js';
import { AgentLoop } from '../src/core/agent/loop.js';
import { createDefaultToolRegistry } from '../src/core/tools/registry.js';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';

describe('provider registry (ADR 0004)', () => {
  it('typhoon is the default selection', () => {
    const reg = createDefaultProviderRegistry();
    expect(reg.selectedId).toBe('typhoon');
    expect(DEFAULT_PROVIDER_ID).toBe('typhoon');
    expect(reg.selected.capabilities.provider).toBe('typhoon');
  });

  it('registers the ThaiLLM Playground stubs as unconfigured', () => {
    const reg = createDefaultProviderRegistry();
    for (const id of ['pathumma', 'openthaigpt', 'thalle']) {
      const a = reg.get(id);
      expect(a, `missing adapter ${id}`).toBeDefined();
      const avail = a!.availability(false);
      expect(avail.available).toBe(false);
      expect(avail.authState).toBe('unconfigured');
      expect(avail.reason).toMatch(/no endpoint configured/);
    }
  });

  it('selection is explicit — unknown id throws, selection does not change (no silent fallback)', () => {
    const reg = createDefaultProviderRegistry();
    expect(() => reg.select('gpt-4')).toThrow(UnknownProviderError);
    expect(reg.selectedId).toBe('typhoon'); // unchanged, not silently swapped
  });

  it('selection is session-stable until explicitly changed', () => {
    const reg = createDefaultProviderRegistry();
    reg.select('pathumma');
    expect(reg.selectedId).toBe('pathumma');
    expect(reg.selectedId).toBe('pathumma'); // stays put
    reg.select('typhoon');
    expect(reg.selectedId).toBe('typhoon');
  });

  it('typhoon reports the full ADR 0004 capability contract', () => {
    const caps = new TyphoonAdapter().capabilities;
    expect(caps.modelId).toBeTruthy();
    expect(caps.provider).toBe('typhoon');
    expect(caps.inputModalities).toContain('text');
    expect(caps.contextLimit).toBeGreaterThan(0);
    expect(typeof caps.supportsToolCalls).toBe('boolean');
    expect(typeof caps.supportsStreaming).toBe('boolean');
    expect(caps.dataHandling).toBeTruthy();
  });

  it('typhoon degrades gracefully without a key (unavailable, never crash)', () => {
    const avail = new TyphoonAdapter().availability(false);
    expect(avail.available).toBe(false);
    expect(avail.authState).toBe('no-credential');
    expect(avail.reason).toBeTruthy();
  });

  it('typhoon classifies retryable errors', () => {
    const a = new TyphoonAdapter();
    expect(a.classifyError(Object.assign(new Error('x'), { status: 429 }))).toMatchObject({
      retryable: true,
      kind: 'rate-limit',
    });
    expect(a.classifyError(Object.assign(new Error('x'), { status: 500 })).retryable).toBe(true);
    expect(a.classifyError(Object.assign(new Error('x'), { status: 401 })).retryable).toBe(false);
  });
});

describe('agent loop without credentials', () => {
  it('returns a clear provider-unavailable message instead of crashing', async () => {
    const loop = new AgentLoop({
      providers: createDefaultProviderRegistry(),
      tools: createDefaultToolRegistry(),
      credentials: new InMemoryCredentialStore(), // empty: no key stored
      workspaceRoot: process.cwd(),
    });
    const result = await loop.runTurn('สวัสดี ช่วยอ่านไฟล์หน่อย', {
      mode: 'build',
      profile: 'manual',
      history: [],
    });
    expect(result.text).toMatch(/unavailable/i);
    expect(result.text).toMatch(/typhoon/);
    expect(result.history.at(-1)?.role).toBe('assistant');
  });
});
