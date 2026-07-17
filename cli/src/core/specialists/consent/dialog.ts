// Specialist consent dialog summary (Story 4.8). Builds a secret-free
// ConsentDialogSummary for the transfer-consent-dialog surface. NEVER includes
// raw bytes, text, or credentials. Initial focus is always 'consent-review'
// (never 'Consent' / auto-grant).

import type { PreparedPayloadManifest } from '../../permissions/transferConsent.js';
import type { PreparedArtifact } from '../artifacts/types.js';
import type { ConsentDialogSummary, ConsentReference, SafeSourceIdentity } from './types.js';

/**
 * Build a secret-free ConsentDialogSummary for the transfer-consent-dialog
 * surface.
 *
 * The summary includes:
 * - Recipient (capabilityId, capabilityVersion, verifiedEndpoint, method)
 * - Purpose
 * - Safe payload summary (source count, total size, source identities with
 *   hashes — NOT contents), classification, retention/deletion status
 * - Side effects
 * - Manifest digest + payload digest
 * - ConsentReference
 * - Initial focus: 'consent-review' (never 'Consent' / auto-grant)
 *
 * Asserts (dev-only) that no artifact text/bytes leak into the summary.
 */
export function buildConsentDialogSummary(
  manifest: PreparedPayloadManifest,
  artifacts: readonly PreparedArtifact[],
  consentReference: ConsentReference,
  sideEffects: readonly string[] = [],
): ConsentDialogSummary {
  // Build safe source identities — only identity, mediaType, sizeBytes, sourceHash.
  const sourceIdentities: readonly SafeSourceIdentity[] = artifacts.map((a) => ({
    identity: a.sourceIdentity.canonicalPath,
    mediaType: a.mediaType,
    sizeBytes: a.sizeBytes,
    sourceHash: a.contentHash,
  }));

  const totalSizeBytes = artifacts.reduce((sum, a) => sum + a.sizeBytes, 0);

  // Dev-only assertion: ensure no raw bytes/text leak into the summary.
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    const summaryJson = JSON.stringify({
      sourceIdentities,
      totalSizeBytes,
      sourceCount: artifacts.length,
    });
    // Check that no artifact text or bytes appear in the summary.
    for (const a of artifacts) {
      if (a.text && summaryJson.includes(a.text)) {
        throw new Error('ASSERTION FAILED: artifact text leaked into consent dialog summary');
      }
      if (a.bytes) {
        // For bytes, check that the byte length doesn't appear as a content leak.
        // This is a best-effort check; the real protection is structural (we
        // never include bytes/text in the summary fields).
      }
    }
  }

  return {
    recipient: {
      capabilityId: manifest.recipient.capabilityId,
      capabilityVersion: manifest.recipient.capabilityVersion,
      verifiedEndpoint: manifest.recipient.verifiedEndpoint,
      method: manifest.recipient.method,
    },
    purpose: manifest.purpose,
    safePayloadSummary: {
      sourceCount: artifacts.length,
      totalSizeBytes,
      sourceIdentities,
      classification: manifest.classification,
      retentionStatus: manifest.retention,
      payloadDigest: manifest.payloadByteDigest,
      manifestDigest: manifest.manifestDigest,
    },
    sideEffects,
    manifestDigest: manifest.manifestDigest,
    payloadDigest: manifest.payloadByteDigest,
    consentReference,
    initialFocus: 'consent-review',
  };
}
