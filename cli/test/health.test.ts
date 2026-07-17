import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthRegistry, type EffectiveConfigurationGeneration } from '../src/core/providers/health.js';
import { typhoonGeneration, typhoonHealthProbe } from '../src/core/providers/typhoonHealth.js';

const fixedClock = () => '2026-07-17T09:00:00.000Z';

function gen(id = 'typhoon-gen-test'): EffectiveConfigurationGeneration {
  return {
    id,
    providerId: 'typhoon',
    endpoint: 'https://api.opentyphoon.ai/v1',
    credentialRevision: 'rev-1',
    adapterVersion: '1.0.0',
    modelId: 'typhoon-v2.5-instruct',
    dependencyIdentity: 'typhoon:typhoon-v2.5-instruct:1.0.0',
    createdAt: '2026-07-17T09:00:00.000Z',
  };
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HealthRegistry — lifecycle (AC #1)', () => {
  it('transitions configured → checking → available after a passing live check', async () => {
    mockFetch(async () => jsonResponse(200, { data: [{ id: 'typhoon-v2.5-instruct' }] }));
    const reg = new HealthRegistry(fixedClock);
    const g = gen();
    reg.registerConfiguration(g);
    reg.registerProbe('typhoon', typhoonHealthProbe(() => 'sk-test'));
    expect(reg.snapshot('typhoon').state).toBe('configured');
    const checking = await Promise.resolve(reg.check('typhoon'));
    // check() is async; the final state should be available.
    expect(checking.state).toBe('available');
    expect(reg.isAvailable('typhoon')).toBe(true);
  });

  it('rejects stale success from an older generation (AD-18, AC #3)', async () => {
    let resolveProbe: ((r: { ok: true; evidence: string } | { ok: false; failure: import('../src/core/providers/health.js').HealthFailure }) => void) | undefined;
    let probeCall = 0;
    const reg = new HealthRegistry(fixedClock);
    const g1 = gen('gen-1');
    reg.registerConfiguration(g1);
    reg.registerProbe('typhoon', async () => {
      probeCall++;
      return new Promise((resolve) => {
        resolveProbe = resolve as typeof resolveProbe;
      });
    });
    const pending = reg.check('typhoon');
    // While probe #1 is in flight, supersede with a new generation.
    reg.registerConfiguration(gen('gen-2'));
    resolveProbe!({ ok: true, evidence: 'stale-evidence' });
    const snap = await pending;
    // Stale success must not make the new generation available.
    expect(snap.state).not.toBe('available');
    expect(reg.snapshot('typhoon').generationId).toBe('gen-2');
    expect(probeCall).toBe(1);
  });
});

describe('HealthRegistry — typed failure envelope (AC #2)', () => {
  it('classifies auth rejection as unhealthy (fatal)', async () => {
    mockFetch(async () => jsonResponse(401, { error: 'invalid key' }));
    const reg = new HealthRegistry(fixedClock);
    reg.registerConfiguration(gen());
    reg.registerProbe('typhoon', typhoonHealthProbe(() => 'sk-bad'));
    const snap = await reg.check('typhoon');
    expect(snap.state).toBe('unhealthy');
    expect(snap.failure?.category).toBe('auth');
    expect(snap.failure?.retryable).toBe(false);
    expect(snap.failure?.causeCode).toBe('auth-rejected');
  });

  it('classifies rate-limit as unavailable (transient, retryable)', async () => {
    mockFetch(async () => jsonResponse(429, { error: 'rate limit' }));
    const reg = new HealthRegistry(fixedClock);
    reg.registerConfiguration(gen());
    reg.registerProbe('typhoon', typhoonHealthProbe(() => 'sk-test'));
    const snap = await reg.check('typhoon');
    expect(snap.state).toBe('unavailable');
    expect(snap.failure?.category).toBe('quota');
    expect(snap.failure?.retryable).toBe(true);
    expect(snap.failure?.retryAfterMs).toBe(5_000);
  });

  it('classifies network error as unavailable (transient, retryable)', async () => {
    mockFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const reg = new HealthRegistry(fixedClock);
    reg.registerConfiguration(gen());
    reg.registerProbe('typhoon', typhoonHealthProbe(() => 'sk-test'));
    const snap = await reg.check('typhoon');
    expect(snap.state).toBe('unavailable');
    expect(snap.failure?.category).toBe('connectivity');
    expect(snap.failure?.retryable).toBe(true);
  });

  it('classifies protocol schema mismatch as unhealthy (fatal)', async () => {
    mockFetch(async () => jsonResponse(200, { unexpected: true }));
    const reg = new HealthRegistry(fixedClock);
    reg.registerConfiguration(gen());
    reg.registerProbe('typhoon', typhoonHealthProbe(() => 'sk-test'));
    const snap = await reg.check('typhoon');
    expect(snap.state).toBe('unhealthy');
    expect(snap.failure?.category).toBe('protocol');
    expect(snap.failure?.causeCode).toBe('protocol-schema-mismatch');
  });

  it('no-credential probe returns auth failure without a network call', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const reg = new HealthRegistry(fixedClock);
    reg.registerConfiguration(gen());
    reg.registerProbe('typhoon', typhoonHealthProbe(() => null));
    const snap = await reg.check('typhoon');
    expect(snap.state).toBe('unhealthy');
    expect(snap.failure?.category).toBe('auth');
    expect(snap.failure?.causeCode).toBe('no-credential');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('HealthRegistry — no silent substitution (AC #2, NFR-7)', () => {
  it('quarantine keeps the provider unselectable until retest', () => {
    const reg = new HealthRegistry(fixedClock);
    reg.registerConfiguration(gen());
    reg.quarantine('typhoon', 'shared credential rejected');
    expect(reg.snapshot('typhoon').state).toBe('quarantined');
    expect(reg.isAvailable('typhoon')).toBe(false);
  });

  it('markUnconfigured resets to unconfigured', () => {
    const reg = new HealthRegistry(fixedClock);
    reg.registerConfiguration(gen());
    reg.markUnconfigured('typhoon');
    expect(reg.snapshot('typhoon').state).toBe('unconfigured');
  });
});

describe('HealthRegistry — probe-threw safety (AD-9)', () => {
  it('folds a throwing probe into a typed unknown failure', async () => {
    const reg = new HealthRegistry(fixedClock);
    reg.registerConfiguration(gen());
    reg.registerProbe('typhoon', async () => {
      throw new Error('boom');
    });
    const snap = await reg.check('typhoon');
    expect(snap.failure?.category).toBe('unknown');
    expect(snap.failure?.causeCode).toBe('probe-threw');
  });
});

describe('typhoonGeneration — secret-free generation (AC #1)', () => {
  it('builds a generation without secrets', () => {
    const g = typhoonGeneration({
      credentialRevision: 'rev-1',
      adapterVersion: '1.0.0',
      modelId: 'typhoon-v2.5-instruct',
      clock: fixedClock,
    });
    expect(g.providerId).toBe('typhoon');
    expect(g.credentialRevision).toBe('rev-1');
    expect(g.endpoint).toBe('https://api.opentyphoon.ai/v1');
    expect(JSON.stringify(g)).not.toContain('sk-');
  });
});