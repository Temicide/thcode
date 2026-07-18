// Typhoon health probe (AD-8, AD-9, AD-18, FR-2, FR-4). A minimal live
// effective-endpoint check: authenticates against the exact stored
// configuration and verifies the OpenAI-compatible protocol shape without
// exposing the key. The probe returns a typed HealthProbeResult — never
// throws across the boundary (AD-9).

import type { EffectiveConfigurationGeneration, HealthProbe, HealthProbeResult } from './health.js';

const TYPHOON_BASE_URL = 'https://api.opentyphoon.ai/v1';

/** Build a Typhoon effective-configuration generation (no secrets). */
export function typhoonGeneration(opts: {
  credentialRevision: string;
  adapterVersion: string;
  modelId: string;
  endpoint?: string;
  clock?: () => string;
}): EffectiveConfigurationGeneration {
  return {
    id: `typhoon-gen-${opts.credentialRevision}-${Date.now().toString(36)}`,
    providerId: 'typhoon',
    endpoint: opts.endpoint ?? TYPHOON_BASE_URL,
    credentialRevision: opts.credentialRevision,
    adapterVersion: opts.adapterVersion,
    modelId: opts.modelId,
    dependencyIdentity: `typhoon:${opts.modelId}:${opts.adapterVersion}`,
    createdAt: (opts.clock ?? (() => new Date().toISOString()))(),
  };
}

/** Minimal live Typhoon health probe: one lightweight authenticated request
 * to `/models` (or equivalent). The key is passed in scope only for this
 * probe; it never appears in the returned Evidence or failure envelope. */
export function typhoonHealthProbe(
  apiKeyFetcher: (gen: EffectiveConfigurationGeneration) => string | null,
): HealthProbe {
  return async (gen): Promise<HealthProbeResult> => {
    const key = apiKeyFetcher(gen);
    if (!key) {
      return {
        ok: false,
        failure: {
          category: 'auth',
          retryable: false,
          scope: 'typhoon',
          generationId: gen.id,
          safeMessage: 'No Typhoon API key configured.',
          causeCode: 'no-credential',
        },
      };
    }
    try {
      const res = await fetch(`${gen.endpoint}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          failure: {
            category: 'auth',
            retryable: false,
            scope: 'typhoon',
            generationId: gen.id,
            safeMessage: 'Typhoon rejected the API key.',
            causeCode: 'auth-rejected',
          },
        };
      }
      if (res.status === 429) {
        return {
          ok: false,
          failure: {
            category: 'quota',
            retryable: true,
            scope: 'typhoon',
            generationId: gen.id,
            safeMessage: 'Typhoon rate-limited the health check.',
            causeCode: 'rate-limited',
            retryAfterMs: 5_000,
          },
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          failure: {
            category: res.status >= 500 ? 'connectivity' : 'configuration',
            retryable: res.status >= 500,
            scope: 'typhoon',
            generationId: gen.id,
            safeMessage: `Typhoon endpoint returned HTTP ${res.status}.`,
            causeCode: `http-${res.status}`,
          },
        };
      }
      // Protocol verification: response should be JSON listing models.
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        return {
          ok: false,
          failure: {
            category: 'protocol',
            retryable: false,
            scope: 'typhoon',
            generationId: gen.id,
            safeMessage: 'Typhoon endpoint returned a non-JSON response.',
            causeCode: 'protocol-non-json',
          },
        };
      }
      const data = body as { data?: unknown[] };
      if (!Array.isArray(data?.data)) {
        return {
          ok: false,
          failure: {
            category: 'protocol',
            retryable: false,
            scope: 'typhoon',
            generationId: gen.id,
            safeMessage: 'Typhoon endpoint response did not match the OpenAI-compatible /models schema.',
            causeCode: 'protocol-schema-mismatch',
          },
        };
      }
      return {
        ok: true,
        evidence: `typhoon:models:${data.data!.length}:${gen.adapterVersion}`,
      };
    } catch (e) {
      const isNetwork = e instanceof TypeError;
      return {
        ok: false,
        failure: {
          category: isNetwork ? 'connectivity' : 'unknown',
          retryable: isNetwork,
          scope: 'typhoon',
          generationId: gen.id,
          safeMessage: isNetwork
            ? 'Could not reach the Typhoon endpoint.'
            : 'Unexpected error during the Typhoon health check.',
          causeCode: isNetwork ? 'network' : 'unknown',
        },
      };
    }
  };
}