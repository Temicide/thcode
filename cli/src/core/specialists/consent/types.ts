// Specialist consent types (Story 4.8). Secret-free ConsentReference for
// Evidence/dialog, ConsentDialogSummary for the transfer-consent-dialog surface,
// and typed input contracts for manifest building, consent evaluation, and
// revalidation. Reuses the generic contracts from transferConsent.ts — never
// duplicates authority semantics.

import type { PreparedPayloadManifest, RetentionHandling } from '../../permissions/transferConsent.js';
import type { PreparedArtifact } from '../artifacts/types.js';
import type { SpecialistEffectiveConfiguration } from '../health/types.js';
import type { CapabilityRegistryEntry } from '../registry/types.js';
import type { SanitizeResult } from '../../security/sanitizer.js';

// ---------------------------------------------------------------------------
// ConsentReference — secret-free handle for Evidence/dialog
// ---------------------------------------------------------------------------

/** Secret-free handle to a granted transfer consent. Carries only the
 * consentId, both digests, recipient identity, purpose, and timestamps —
 * NEVER raw bytes, secrets, or credentials. */
export interface ConsentReference {
  readonly consentId: string;
  readonly manifestDigest: string;
  readonly payloadByteDigest: string;
  readonly recipientCapabilityId: string;
  readonly recipientCapabilityVersion: string;
  readonly verifiedEndpoint: string;
  readonly purpose: string;
  readonly grantedAt: string;
  readonly expiresAt: string | null;
}

// ---------------------------------------------------------------------------
// ConsentDialogSummary — secret-free surface for the transfer-consent-dialog
// ---------------------------------------------------------------------------

export type ConsentDialogInitialFocus = 'consent-review' | 'consent-cancel';

export interface SafeSourceIdentity {
  readonly identity: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly sourceHash: string;
}

export interface SafePayloadSummary {
  readonly sourceCount: number;
  readonly totalSizeBytes: number;
  readonly sourceIdentities: readonly SafeSourceIdentity[];
  readonly classification: string;
  readonly retentionStatus: RetentionHandling;
  readonly payloadDigest: string;
  readonly manifestDigest: string;
}

export interface ConsentDialogSummary {
  readonly recipient: {
    readonly capabilityId: string;
    readonly capabilityVersion: string;
    readonly verifiedEndpoint: string;
    readonly method: string;
  };
  readonly purpose: string;
  readonly safePayloadSummary: SafePayloadSummary;
  readonly sideEffects: readonly string[];
  readonly manifestDigest: string;
  readonly payloadDigest: string;
  readonly consentReference: ConsentReference;
  readonly initialFocus: ConsentDialogInitialFocus;
}

// ---------------------------------------------------------------------------
// SpecialistManifestInput — input to buildSpecialistPreparedPayloadManifest
// ---------------------------------------------------------------------------

export interface SpecialistManifestInput {
  readonly proposal: {
    readonly serviceId: string;
    readonly name: string;
    readonly rationale: string;
  };
  readonly preparedArtifacts: readonly PreparedArtifact[];
  readonly effectiveConfiguration: SpecialistEffectiveConfiguration;
  readonly registryEntry: CapabilityRegistryEntry;
  readonly operationId: string;
  readonly promptRoundId: string;
  readonly callCount: number;
  readonly expiresAt: string | null;
}

// ---------------------------------------------------------------------------
// SpecialistConsentInput — input to requestSpecialistTransferConsent
// ---------------------------------------------------------------------------

export interface SpecialistConsentInput {
  readonly manifest: PreparedPayloadManifest;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly policyVersion: number;
  readonly clock: () => string;
  readonly currentPayloadByteDigest: string;
  readonly now: string;
  readonly sanitizerResult: SanitizeResult;
}

// ---------------------------------------------------------------------------
// SpecialistRevalidationInput — input to revalidateSpecialistTransferConsent
// ---------------------------------------------------------------------------

export interface SpecialistRevalidationInput {
  readonly manifest: PreparedPayloadManifest;
  readonly currentPayloadByteDigest: string;
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly now: string;
}
