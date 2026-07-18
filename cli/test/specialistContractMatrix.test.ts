import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildSpecialistEffectiveConfiguration, createSpecialistHealthProbe } from '../src/core/specialists/health/index.js';
import { CapabilityRegistry } from '../src/core/specialists/registry/index.js';
import { InMemorySpecialistTransport } from '../src/core/specialists/adapter/index.js';
import { defaultSpecialistHandlers } from '../src/core/specialists/services/index.js';

const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'specialists-manifest.json');
const now = '2026-07-18T12:00:00.000Z';
const credential = {
  referenceId: 'aiforthai',
  credentialRevision: 'test-revision',
  fingerprint: 'test-fingerprint',
  provider: 'ai-for-thai',
  verifiedHost: 'api.aiforthai.in.th',
  storage: 'os-credential-store' as const,
  createdAt: now,
};

describe('Story 4.18 reviewed registry and health-probe contract matrix', () => {
  it('binds every invokable registry service to exactly one handler and secret-free static canary request', async () => {
    const registry = CapabilityRegistry.load(now, manifestPath);
    const handlers = new Map(defaultSpecialistHandlers().map((handler) => [handler.serviceId, handler]));

    for (const entry of registry.invokable()) {
      const handler = handlers.get(entry.id);
      expect(handler).toBeDefined();
      expect(entry.healthCanary).toBeDefined();
      const generation = buildSpecialistEffectiveConfiguration(entry, credential, undefined, () => now);
      expect(generation.ok).toBe(true);
      if (!handler || !entry.healthCanary || !generation.ok || !handler.buildHealthProbeRequest) continue;

      const request = await handler.buildHealthProbeRequest(
        { serviceId: entry.id, effectiveConfiguration: generation.configuration, canary: entry.healthCanary, startedAt: now },
        { resolveRawKey: async () => 'test-secret' },
      );
      expect(request.url).toBe(entry.endpoint);
      expect(request.method).toBe('POST');
      expect(request.headersSummary).toContainEqual({ name: 'Authorization', value: '[redacted]' });
      expect(JSON.stringify(request.headersSummary)).not.toContain('test-secret');
      expect(handler.healthCanaryFixtureDigest).toBe(entry.healthCanary.fixtureDigest);
    }
  });

  it('maps an authenticated static-canary success to health Evidence without serializing request data', async () => {
    const registry = CapabilityRegistry.load(now, manifestPath);
    const entry = registry.byId('t-ocr');
    const handler = defaultSpecialistHandlers().find((candidate) => candidate.serviceId === 't-ocr');
    expect(entry).toBeDefined();
    expect(handler).toBeDefined();
    if (!entry || !handler) return;
    const generation = buildSpecialistEffectiveConfiguration(entry, credential, undefined, () => now);
    if (!generation.ok) throw new Error(generation.detail);
    const transport = new InMemorySpecialistTransport();
    transport.registerDefaultResponder(() => ({
      ok: true,
      raw: { status: 200, statusText: 'OK', headersSafe: [], bodyText: '{}', elapsedMs: 1, completedAt: now },
    }));

    const result = await createSpecialistHealthProbe({
      entry,
      handler,
      transport,
      resolveRawKey: async () => 'test-secret',
      clock: () => now,
    })(generation.configuration);

    expect(result).toEqual({ ok: true, evidence: `health-${generation.configuration.id}` });
    expect(JSON.stringify(result)).not.toContain('test-secret');
  });
});
