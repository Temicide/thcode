// Specialist effective configuration generation (Story 4.4). Pure builder that
// produces an immutable, secret-free SpecialistEffectiveConfiguration with a
// deterministic digest over all bound fields. Fail-closed validation in order:
// non-invokable → not-invokable; missing credential reference → missing-credential;
// missing endpoint/contractVersion/adapterVersion → missing-field; transport
// policy violation → transport-policy.

import { createHash } from 'node:crypto';
import type { CapabilityRegistryEntry } from '../registry/types.js';
import type { AiForThaiCredentialReference } from '../credential/types.js';
import type { EffectiveConfigurationGeneration } from '../../providers/health.js';
import type {
  SpecialistEffectiveConfiguration,
  SpecialistGenerationResult,
  SpecialistRequestConfig,
  SpecialistTransportPolicy,
} from './types.js';

/** Default request configuration for Specialist probes. */
const DEFAULT_REQUEST_CONFIG: SpecialistRequestConfig = {
  timeoutMs: 10_000,
  maxRetries: 0,
};

/**
 * Compute a deterministic secret-free digest over all bound fields of a
 * SpecialistEffectiveConfiguration. The digest incorporates endpoint, origin,
 * serviceMapping, credentialReferenceId, credentialRevision, manifestVersion,
 * contractVersion, adapterVersion, transportPolicy, and requestConfig so that
 * any change produces a new id and supersedes the prior generation (AD-8, AD-18).
 */
export function specialistConfigurationDigest(fields: {
  endpoint: string;
  origin: string;
  serviceMapping: string;
  credentialReferenceId: string;
  credentialRevision: string;
  manifestVersion: number;
  contractVersion: string;
  adapterVersion: string;
  transportPolicy: SpecialistTransportPolicy;
  requestConfig: SpecialistRequestConfig;
}): string {
  const hash = createHash('sha256');
  hash.update(fields.endpoint);
  hash.update('\x00');
  hash.update(fields.origin);
  hash.update('\x00');
  hash.update(fields.serviceMapping);
  hash.update('\x00');
  hash.update(fields.credentialReferenceId);
  hash.update('\x00');
  hash.update(fields.credentialRevision);
  hash.update('\x00');
  hash.update(String(fields.manifestVersion));
  hash.update('\x00');
  hash.update(fields.contractVersion);
  hash.update('\x00');
  hash.update(fields.adapterVersion);
  hash.update('\x00');
  hash.update(JSON.stringify(fields.transportPolicy));
  hash.update('\x00');
  hash.update(JSON.stringify(fields.requestConfig));
  return hash.digest('hex');
}

/**
 * Build a SpecialistEffectiveConfiguration from a registry entry, credential
 * reference, and request config. Fail-closed validation in this order:
 *
 * 1. Non-invokable → `not-invokable`
 * 2. Missing credential reference → `missing-credential`
 * 3. Missing endpoint/contractVersion/adapterVersion → `missing-field`
 * 4. Transport policy violation → `transport-policy`
 *
 * On success, returns an immutable, secret-free configuration with a
 * deterministic digest id. The raw credential key is NEVER included.
 */
export function buildSpecialistEffectiveConfiguration(
  entry: CapabilityRegistryEntry,
  credentialReference: AiForThaiCredentialReference | null,
  requestConfig: SpecialistRequestConfig = DEFAULT_REQUEST_CONFIG,
  clock: () => string = () => new Date().toISOString(),
): SpecialistGenerationResult {
  // 1. Non-invokable check.
  if (!entry.invokable) {
    return {
      ok: false,
      cause: 'not-invokable',
      detail: `Service "${entry.id}" is not invokable: ${entry.invokableStateReason ?? 'unknown reason'}`,
    };
  }

  // 2. Missing credential reference.
  if (!credentialReference) {
    return {
      ok: false,
      cause: 'missing-credential',
      detail: `No AI-for-Thai credential reference available for service "${entry.id}".`,
    };
  }

  // 3. Missing required fields.
  if (!entry.endpoint) {
    return {
      ok: false,
      cause: 'missing-field',
      detail: `Registry entry "${entry.id}" is missing required field: endpoint.`,
    };
  }
  if (!entry.contractVersion) {
    return {
      ok: false,
      cause: 'missing-field',
      detail: `Registry entry "${entry.id}" is missing required field: contractVersion.`,
    };
  }
  if (!entry.adapterVersion) {
    return {
      ok: false,
      cause: 'missing-field',
      detail: `Registry entry "${entry.id}" is missing required field: adapterVersion.`,
    };
  }

  // 4. Transport policy validation.
  const transportPolicy: SpecialistTransportPolicy = {
    allowedProtocols: entry.transportRules.allowedProtocols,
    requiresTls: entry.transportRules.requiresTls,
    allowedMethods: entry.transportRules.allowedMethods,
  };

  // Validate endpoint protocol.
  let endpointProtocol: string;
  try {
    endpointProtocol = new URL(entry.endpoint).protocol.replace(':', '');
  } catch {
    return {
      ok: false,
      cause: 'transport-policy',
      detail: `Endpoint "${entry.endpoint}" for service "${entry.id}" is not a valid URL.`,
    };
  }

  if (transportPolicy.requiresTls && endpointProtocol !== 'https') {
    return {
      ok: false,
      cause: 'transport-policy',
      detail: `Endpoint "${entry.endpoint}" for service "${entry.id}" must use HTTPS (requiresTls=true).`,
    };
  }

  if (!transportPolicy.allowedProtocols.includes(endpointProtocol)) {
    return {
      ok: false,
      cause: 'transport-policy',
      detail: `Protocol "${endpointProtocol}" for endpoint "${entry.endpoint}" is not in allowedProtocols: [${transportPolicy.allowedProtocols.join(', ')}].`,
    };
  }

  // Validate that at least one allowed method is present.
  if (transportPolicy.allowedMethods.length === 0) {
    return {
      ok: false,
      cause: 'transport-policy',
      detail: `No allowed methods defined for service "${entry.id}".`,
    };
  }

  // Build the digest fields.
  const digestFields = {
    endpoint: entry.endpoint,
    origin: entry.upstreamId,
    serviceMapping: `${entry.id}->${entry.upstreamId}`,
    credentialReferenceId: credentialReference.referenceId,
    credentialRevision: credentialReference.credentialRevision,
    manifestVersion: entry.manifestVersion,
    contractVersion: entry.contractVersion,
    adapterVersion: entry.adapterVersion,
    transportPolicy,
    requestConfig,
  };

  const digest = specialistConfigurationDigest(digestFields);
  const createdAt = clock();

  const configuration: SpecialistEffectiveConfiguration = {
    id: `specialist-gen-${digest}`,
    serviceId: entry.id,
    endpoint: entry.endpoint,
    origin: entry.upstreamId,
    serviceMapping: `${entry.id}->${entry.upstreamId}`,
    credentialReferenceId: credentialReference.referenceId,
    credentialRevision: credentialReference.credentialRevision,
    credentialFingerprint: credentialReference.fingerprint,
    manifestVersion: entry.manifestVersion,
    contractVersion: entry.contractVersion,
    adapterVersion: entry.adapterVersion,
    transportPolicy,
    requestConfig,
    createdAt,
  };

  return { ok: true, configuration };
}

/**
 * Project a SpecialistEffectiveConfiguration into an EffectiveConfigurationGeneration
 * for the shared HealthRegistry. The generation carries the serviceId as providerId,
 * the endpoint, credential revision, adapter version, contract version as modelId,
 * and the digest as dependencyIdentity.
 */
export function projectToHealthGeneration(
  config: SpecialistEffectiveConfiguration,
): EffectiveConfigurationGeneration {
  return {
    id: config.id,
    providerId: config.serviceId,
    endpoint: config.endpoint,
    credentialRevision: config.credentialRevision,
    adapterVersion: config.adapterVersion,
    modelId: config.contractVersion,
    dependencyIdentity: config.id,
    createdAt: config.createdAt,
  };
}
