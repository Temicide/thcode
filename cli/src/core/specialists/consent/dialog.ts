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
  // Stringifies the FULL return value (not just a subset) to catch any field
  // that might accidentally contain artifact content.
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // Build a preliminary summary to check for leaks before returning.
    const preliminarySummary: ConsentDialogSummary = {
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
    const summaryJson = JSON.stringify(preliminarySummary);
    // Check that no artifact text appears in the summary. Use a substring
    // check on the raw text (not the JSON-escaped form) — JSON.stringify
    // escapes double quotes, backslashes, and control characters, so we
    // check the original text against the unescaped JSON to catch leaks
    // even when the text contains characters that JSON would escape.
    for (const a of artifacts) {
      if (a.text && a.text.length > 0) {
        // Check each line/segment of the text individually to avoid false
        // negatives from JSON escaping. A short text that appears in the
        // JSON will still be findable as a substring of the raw JSON string.
        const textSegments = a.text.split(/\s+/).filter((s) => s.length >= 4);
        for (const segment of textSegments) {
          if (summaryJson.includes(segment)) {
            throw new Error('ASSERTION FAILED: artifact text leaked into consent dialog summary');
          }
        }
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
