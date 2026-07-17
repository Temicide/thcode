// Fail-closed local validation for Specialist requests (Story 4.9). Runs BEFORE
// transport. First refusal wins. NO protocol repair, NO service substitution,
// NO retry of unknown outcome.

import type { SpecialistRequest, SpecialistAdapterRefusal } from './types.js';
import type { CapabilityRegistryEntry } from '../registry/types.js';
import type { SpecialistHealthSnapshot } from '../health/types.js';

/**
 * Validate a SpecialistRequest against the registry entry and health snapshot.
 * Returns the FIRST refusal or null if all checks pass.
 *
 * Order: non-invokable-entry → version-mismatch → stale-generation →
 * unsupported-input → consent-manifest-mismatch.
 *
 * Pure function — no Date/random/IO.
 */
export function validateSpecialistRequest(
  request: SpecialistRequest,
  registryEntry: CapabilityRegistryEntry,
  healthSnapshot: SpecialistHealthSnapshot,
): SpecialistAdapterRefusal | null {
  // 1. Non-invokable entry
  if (!registryEntry.invokable) {
    return {
      ok: false,
      refused: true,
      cause: 'non-invokable-entry',
      safeMessage: `Service "${request.serviceId}" is not invokable.`,
      operationId: request.operationId,
      serviceId: request.serviceId,
    };
  }

  // 2. Version mismatch (manifest version or contract version)
  if (request.manifestVersion !== registryEntry.manifestVersion) {
    return {
      ok: false,
      refused: true,
      cause: 'version-mismatch',
      safeMessage: `Manifest version mismatch: request ${request.manifestVersion}, registry ${registryEntry.manifestVersion}.`,
      operationId: request.operationId,
      serviceId: request.serviceId,
    };
  }
  if (request.contractVersion !== registryEntry.contractVersion) {
    return {
      ok: false,
      refused: true,
      cause: 'version-mismatch',
      safeMessage: `Contract version mismatch: request ${request.contractVersion}, registry ${registryEntry.contractVersion}.`,
      operationId: request.operationId,
      serviceId: request.serviceId,
    };
  }

  // 3. Stale generation: generationId must match AND state must be 'available'
  // (AD-18: configured never implies available; stale/mismatched/superseded
  // never establish availability).
  const configId = request.effectiveConfiguration.id;
  const snapGenId = healthSnapshot.generationId;
  const snapState = healthSnapshot.state;

  if (snapGenId !== configId || snapState !== 'available') {
    return {
      ok: false,
      refused: true,
      cause: 'stale-generation',
      safeMessage: `Generation mismatch or service not available: generation ${snapGenId ?? '(none)'}, state ${snapState}.`,
      operationId: request.operationId,
      serviceId: request.serviceId,
    };
  }

  // 4. Unsupported input: every artifact mediaType must be in the registry
  // entry's supportedInputs.
  for (const artifact of request.preparedArtifacts) {
    if (!registryEntry.supportedInputs.includes(artifact.mediaType)) {
      return {
        ok: false,
        refused: true,
        cause: 'unsupported-input',
        safeMessage: `Unsupported input media type "${artifact.mediaType}" for service "${request.serviceId}".`,
        operationId: request.operationId,
        serviceId: request.serviceId,
      };
    }
  }

  // 5. Consent/manifest mismatch: consentReference must bind the current
  // manifest digest AND payload byte digest.
  if (request.consentReference.manifestDigest !== request.preparedManifest.manifestDigest) {
    return {
      ok: false,
      refused: true,
      cause: 'consent-manifest-mismatch',
      safeMessage: 'Consent reference manifest digest does not match the prepared manifest digest.',
      operationId: request.operationId,
      serviceId: request.serviceId,
    };
  }
  if (request.consentReference.payloadByteDigest !== request.preparedManifest.payloadByteDigest) {
    return {
      ok: false,
      refused: true,
      cause: 'consent-manifest-mismatch',
      safeMessage: 'Consent reference payload byte digest does not match the prepared manifest payload byte digest.',
      operationId: request.operationId,
      serviceId: request.serviceId,
    };
  }

  // All checks passed.
  return null;
}
