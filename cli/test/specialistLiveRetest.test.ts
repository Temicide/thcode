import { describe, expect, it } from 'vitest';
import { CoreApp } from '../src/core/app.js';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';
import { InMemorySpecialistTransport } from '../src/core/specialists/adapter/index.js';

const now = '2026-07-18T12:00:00.000Z';

function onboardingIo() {
  return {
    isTTY: true,
    out: (): void => undefined,
    err: (): void => undefined,
    readMasked: async (): Promise<string> => 'test-aiforthai-key',
  };
}

function successTransport(): { readonly transport: InMemorySpecialistTransport; readonly requests: readonly unknown[] } {
  const transport = new InMemorySpecialistTransport();
  const requests: unknown[] = [];
  transport.registerDefaultResponder((request) => {
    (requests as unknown[]).push({
      url: request.url,
      headersSummary: request.headersSummary,
      bodyKind: request.bodyKind,
      bodyText: request.bodyText,
    });
    return {
      ok: true,
      raw: {
        status: 200,
        statusText: 'OK',
        headersSafe: [],
        bodyText: JSON.stringify({ health: 'ok' }),
        elapsedMs: 1,
        completedAt: now,
      },
    };
  });
  return { transport, requests };
}

describe('live Specialist static-canary retest', () => {
  it('runs an approved non-user canary through CoreApp without exposing the raw key', async () => {
    const credentials = new InMemoryCredentialStore();
    const app = new CoreApp({ credentials, clock: () => now });
    const onboarding = await app.ensureAiForThaiCredential(onboardingIo());
    expect(onboarding.ok).toBe(true);

    const { transport, requests } = successTransport();
    app.setSpecialistTransportForTest(transport);
    const result = await app.retestSpecialist('t-ocr');

    expect(result.ok).toBe(true);
    expect(result.state).toBe('available');
    expect(result.outcome).toBe('passed');
    expect(result.probeEvidence).toContain('health-specialist-gen-');
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests)).not.toContain('test-aiforthai-key');
    expect(JSON.stringify(requests)).not.toContain('Authorization: Bearer');
  });

  it('restores the reviewed shared credential group only after all canaries pass', async () => {
    const credentials = new InMemoryCredentialStore();
    const app = new CoreApp({ credentials, clock: () => now });
    await app.ensureAiForThaiCredential(onboardingIo());
    const { transport, requests } = successTransport();
    app.setSpecialistTransportForTest(transport);

    const result = await app.retestSpecialist('t-ocr', { scope: 'credential-group' });

    expect(result.ok).toBe(true);
    expect(result.scope).toBe('credential-group');
    expect(result.restoredServiceIds).toEqual([
      't-ocr', 'speech-to-text', 'extract-address', 'named-entity-recognition',
    ]);
    expect(requests).toHaveLength(4);
  });

  it('does not partially restore a shared credential group when one canary fails', async () => {
    const credentials = new InMemoryCredentialStore();
    const app = new CoreApp({ credentials, clock: () => now });
    await app.ensureAiForThaiCredential(onboardingIo());
    const transport = new InMemorySpecialistTransport();
    transport.registerDefaultResponder((request) => ({
      ok: true,
      raw: {
        status: request.url.includes('partii-webapi') ? 401 : 200,
        statusText: request.url.includes('partii-webapi') ? 'Unauthorized' : 'OK',
        headersSafe: [],
        bodyText: JSON.stringify({ health: 'ok' }),
        elapsedMs: 1,
        completedAt: now,
      },
    }));
    app.setSpecialistTransportForTest(transport);

    const result = await app.retestSpecialist('t-ocr', { scope: 'credential-group' });

    expect(result.ok).toBe(false);
    expect(result.restoredServiceIds).toEqual([]);
    expect(app.specialistHealthLifecycle().snapshots().every((snapshot) => snapshot.state === 'quarantined')).toBe(true);
  });

  it('runs the async /tools retest command instead of claiming the synchronous advisory completed', async () => {
    const credentials = new InMemoryCredentialStore();
    const app = new CoreApp({ credentials, clock: () => now });
    await app.ensureAiForThaiCredential(onboardingIo());
    const { transport } = successTransport();
    app.setSpecialistTransportForTest(transport);

    const output = await app.dispatchCommandAsync('/tools retest extract-address');

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain('Progress: checking completed');
    expect(output.stdout).toContain('State: available');
    expect(output.json).toContain('"status":"succeeded"');
  });

  it('fails closed without a credential before any canary transport request', async () => {
    const app = new CoreApp({ credentials: new InMemoryCredentialStore(), clock: () => now });
    const { transport, requests } = successTransport();
    app.setSpecialistTransportForTest(transport);

    const result = await app.retestSpecialist('named-entity-recognition');

    expect(result.ok).toBe(false);
    expect(result.state).toBe('unconfigured');
    expect(requests).toHaveLength(0);
  });
});
