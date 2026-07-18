// Specialist static-canary health probe (Story 4.17). A probe sends only the
// registry-reviewed, built-in non-user canary through a service's normal direct
// endpoint. It never accepts a user artifact, payload manifest, or consent.

import type { HealthFailure, HealthProbeResult } from '../../providers/health.js';
import type { SpecialistServiceHandler, SpecialistTransport } from '../adapter/types.js';
import type { CapabilityRegistryEntry } from '../registry/types.js';
import type { SpecialistEffectiveConfiguration, SpecialistHealthProbe } from './types.js';

export function createSpecialistHealthProbe(opts: {
  readonly entry: CapabilityRegistryEntry;
  readonly handler: SpecialistServiceHandler;
  readonly transport: SpecialistTransport;
  readonly resolveRawKey: () => Promise<string>;
  readonly clock: () => string;
}): SpecialistHealthProbe {
  return async (configuration): Promise<HealthProbeResult> => {
    const canary = opts.entry.healthCanary;
    if (
      !canary
      || canary.contractVersion !== configuration.contractVersion
      || canary.adapterVersion !== configuration.adapterVersion
      || canary.fixtureDigest !== opts.handler.healthCanaryFixtureDigest
      || !opts.handler.buildHealthProbeRequest
      || !opts.handler.acceptsHealthProbeResponse
    ) {
      return failure(configuration, 'configuration', false, 'health-canary-unavailable', 'No approved health canary is available for this Specialist configuration.');
    }

    try {
      const request = await opts.handler.buildHealthProbeRequest(
        {
          serviceId: configuration.serviceId,
          effectiveConfiguration: configuration,
          canary,
          startedAt: opts.clock(),
        },
        { resolveRawKey: opts.resolveRawKey },
      );
      const response = await opts.transport.send(request);
      if (!response.ok) {
        return failure(
          configuration,
          response.transportError.kind === 'timeout' || response.transportError.kind === 'network' ? 'connectivity' : 'unknown',
          response.transportError.kind !== 'aborted',
          `health-${response.transportError.kind}`,
          'The Specialist health probe did not receive a confirmed response.',
        );
      }
      const raw = response.raw;
      if (raw.status < 200 || raw.status >= 300) {
        return failureForStatus(configuration, raw.status);
      }
      if (!opts.handler.acceptsHealthProbeResponse(raw)) {
        return failure(configuration, 'protocol', false, 'health-response-invalid', 'The Specialist health probe returned an invalid service response.');
      }
      return { ok: true, evidence: `health-${configuration.id}` };
    } catch {
      return failure(configuration, 'unknown', false, 'health-probe-unknown', 'The Specialist health probe ended without a confirmed outcome.');
    }
  };
}

function failureForStatus(configuration: SpecialistEffectiveConfiguration, status: number): HealthProbeResult {
  if (status === 401 || status === 403) {
    return failure(configuration, 'auth', false, `http-${status}`, 'The Specialist health probe was not authorized.');
  }
  if (status === 429) {
    return failure(configuration, 'quota', true, 'http-429', 'The Specialist health probe was rate limited.');
  }
  if (status === 404) {
    return failure(configuration, 'configuration', false, 'http-404', 'The Specialist health probe endpoint was not found.');
  }
  if (status >= 500) {
    return failure(configuration, 'connectivity', true, `http-${status}`, 'The Specialist health probe received a server error.');
  }
  return failure(configuration, 'protocol', false, `http-${status}`, 'The Specialist health probe received an unexpected response.');
}

function failure(
  configuration: SpecialistEffectiveConfiguration,
  category: HealthFailure['category'],
  retryable: boolean,
  causeCode: string,
  safeMessage: string,
): HealthProbeResult {
  return {
    ok: false,
    failure: {
      category,
      retryable,
      scope: configuration.serviceId,
      generationId: configuration.id,
      safeMessage,
      causeCode,
    },
  };
}
