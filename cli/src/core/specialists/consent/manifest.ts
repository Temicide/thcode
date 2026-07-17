// Specialist prepared-payload manifest building (Story 4.8). Maps routing
// proposal + prepared/minimized artifacts + effective configuration + registry
// entry into a PreparedPayloadManifest. Reuses the generic
// buildPreparedPayloadManifest from transferConsent.ts — never duplicates
// authority semantics.

import { createHash } from 'node:crypto';
import {
  buildPreparedPayloadManifest,
  type PreparedPayloadManifest,
  type SelectedSource,
  type PayloadClassification,
  type TransformationPolicy,
  type Recipient,
} from '../../permissions/transferConsent.js';
import { resolveRetentionHandling } from './retention.js';
import type { SpecialistManifestInput } from './types.js';
import type { PreparedArtifact } from '../artifacts/types.js';

/**
 * Compute the SHA-256 payload-byte digest over the ordered concatenation of
 * each artifact's transferable content. Each artifact is framed as:
 *
 *   `<mediaType>\n<contentHash>\n<byteLen>\n<content bytes>`
 *
 * where `content bytes` is the artifact's text (utf8) for contentKind 'text'
 * or the raw bytes for contentKind 'bytes'. The framing ensures order matters
 * and empty payloads still hash deterministically (the framing of zero artifacts
 * produces a valid digest of the empty concatenation).
 */
export function computePayloadByteDigest(artifacts: readonly PreparedArtifact[]): string {
  const hash = createHash('sha256');
  for (const artifact of artifacts) {
    hash.update(artifact.mediaType);
    hash.update('\n');
    hash.update(artifact.contentHash);
    hash.update('\n');
    const contentBytes = artifact.contentKind === 'text' && artifact.text !== undefined
      ? Buffer.from(artifact.text, 'utf8')
      : artifact.bytes ?? Buffer.alloc(0);
    hash.update(String(contentBytes.length));
    hash.update('\n');
    hash.update(contentBytes);
  }
  return hash.digest('hex');
}

/**
 * Build a Specialist PreparedPayloadManifest from a routing proposal, prepared
 * artifacts, effective configuration, and registry entry.
 *
 * Maps:
 * - sources: artifacts → SelectedSource {identity, sourceHash, mediaType, sizeBytes}
 * - classification: derived from artifacts' privacyClassification + entry's
 *   privacyClassification. If ANY artifact is 'secret' → 'unresolved' (blocked).
 *   If entry.requiresConsent or dataClasses include sensitive → 'sensitive'.
 *   If any artifact is 'internal' → 'internal'. Otherwise 'public'.
 * - transformation: redactSecrets:true, extractTextOnly if any artifact is text,
 *   stripActiveContent:true, reason: deduped joined transformations or 'none'.
 * - recipient: {capabilityId, capabilityVersion, verifiedEndpoint, method}
 * - purpose: proposal.rationale
 * - retention: resolveRetentionHandling(entry)
 * - payloadByteDigest: computePayloadByteDigest(artifacts)
 *
 * Calls the existing buildPreparedPayloadManifest which computes the canonical
 * manifest digest.
 */
export function buildSpecialistPreparedPayloadManifest(
  input: SpecialistManifestInput,
): PreparedPayloadManifest {
  const { proposal, preparedArtifacts, effectiveConfiguration, registryEntry } = input;

  // Map sources from artifacts.
  const sources: readonly SelectedSource[] = preparedArtifacts.map((a) => ({
    identity: a.sourceIdentity.canonicalPath,
    sourceHash: a.contentHash,
    mediaType: a.mediaType,
    sizeBytes: a.sizeBytes,
  }));

  // Derive classification from artifacts + entry.
  const classification = deriveClassification(preparedArtifacts, registryEntry);

  // Derive transformation policy from artifact transformations.
  const transformation = deriveTransformationPolicy(preparedArtifacts);

  // Build recipient from effective configuration + registry entry.
  const method = registryEntry.transportRules.allowedMethods[0] ?? 'POST';
  const recipient: Recipient = {
    capabilityId: registryEntry.id,
    capabilityVersion: registryEntry.contractVersion,
    verifiedEndpoint: effectiveConfiguration.endpoint,
    method,
  };

  // Resolve retention handling.
  const retention = resolveRetentionHandling(registryEntry);

  // Compute payload byte digest.
  const payloadByteDigest = computePayloadByteDigest(preparedArtifacts);

  // Build the manifest using the generic builder.
  return buildPreparedPayloadManifest({
    sources,
    classification,
    purpose: proposal.rationale,
    transformation,
    recipient,
    callCount: input.callCount,
    retention,
    operationId: input.operationId,
    promptRoundId: input.promptRoundId,
    expiresAt: input.expiresAt,
    payloadByteDigest,
  });
}

/**
 * Derive the PayloadClassification from artifacts and the registry entry.
 *
 * - If ANY artifact has privacyClassification 'secret' → 'unresolved' (blocked).
 * - If the entry's privacyClassification.requiresConsent is true or dataClasses
 *   include sensitive classes → 'sensitive'.
 * - If any artifact is 'internal' → 'internal'.
 * - Otherwise → 'public'.
 */
function deriveClassification(
  artifacts: readonly PreparedArtifact[],
  entry: { readonly privacyClassification: { readonly requiresConsent: boolean; readonly dataClasses: readonly string[] } },
): PayloadClassification {
  // Secret artifacts always resolve to 'unresolved' (blocked).
  if (artifacts.some((a) => a.privacyClassification === 'secret')) {
    return 'unresolved';
  }

  // Entry requires consent or dataClasses indicate sensitive.
  if (
    entry.privacyClassification.requiresConsent ||
    entry.privacyClassification.dataClasses.some(
      (dc) => dc.toLowerCase().includes('sensitive') || dc.toLowerCase().includes('personal') || dc.toLowerCase().includes('pii'),
    )
  ) {
    return 'sensitive';
  }

  // Any internal artifact → internal.
  if (artifacts.some((a) => a.privacyClassification === 'internal')) {
    return 'internal';
  }

  // Default: public.
  return 'public';
}

/**
 * Derive the TransformationPolicy from the artifacts' transformations.
 * - redactSecrets: always true (secrets are always redacted before transport).
 * - extractTextOnly: true if any artifact has contentKind 'text'.
 * - stripActiveContent: always true.
 * - reason: deduped joined transformations, or 'none' if no transformations.
 */
function deriveTransformationPolicy(artifacts: readonly PreparedArtifact[]): TransformationPolicy {
  const allTransforms = new Set<string>();
  for (const a of artifacts) {
    for (const t of a.transformations) {
      allTransforms.add(t);
    }
  }
  const reason = allTransforms.size > 0
    ? [...allTransforms].join(', ')
    : 'none';

  return {
    redactSecrets: true,
    extractTextOnly: artifacts.some((a) => a.contentKind === 'text'),
    stripActiveContent: true,
    reason,
  };
}
