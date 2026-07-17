// Versioned Capability Registry contract (Story 4.1, AD-15). Each entry is a
// reviewed, offline snapshot — never live discovery. The registry fails closed
// for invocation on malformed/stale/revoked/missing-field manifests.

/** Exact state string for catalogued-but-not-yet-available entries. */
export const CATALOGUED_NOT_AVAILABLE = 'Catalogued — Not available yet' as const;

/** Invokable state reason — either the exact constant or a free-form string. */
export type InvokableStateReason = typeof CATALOGUED_NOT_AVAILABLE | string;

/** Result of the latest contract test for a specialist service. */
export interface ContractTestResult {
  readonly passed: boolean;
  readonly testedAt: string;
  readonly summary: string;
}

/** Privacy classification for a specialist service. */
export interface PrivacyClassification {
  readonly category: string;
  readonly dataClasses: readonly string[];
  readonly requiresConsent: boolean;
}

/** Retention classification for a specialist service. */
export interface RetentionClassification {
  readonly policy: string;
  readonly providerDeletionSupported: boolean;
  readonly defaultRetentionDays: number | null;
}

/** Confirmation policy for a specialist service. */
export interface ConfirmationPolicy {
  readonly requiresExplicitConsent: boolean;
  readonly scope: string;
}

/** Transport rules for a specialist service endpoint. */
export interface TransportRules {
  readonly allowedProtocols: readonly string[];
  readonly requiresTls: boolean;
  readonly allowedMethods: readonly string[];
}

/** A single entry in the Capability Registry. */
export interface CapabilityRegistryEntry {
  /** Stable thcode identity (e.g. `t-ocr`). */
  readonly id: string;
  /** Upstream provider's service identity. */
  readonly upstreamId: string;
  /** Thai-language name. */
  readonly nameThai: string;
  /** Canonical English name. */
  readonly nameEnglish: string;
  /** Search terms (Thai + English). */
  readonly searchTerms: readonly string[];
  /** Capability tags. */
  readonly capabilities: readonly string[];
  /** Supported input types. */
  readonly supportedInputs: readonly string[];
  /** Input limits (e.g. max file size, max duration). */
  readonly inputLimits: Record<string, string>;
  /** Entitlement description. */
  readonly entitlement: string;
  /** Evidence level for this service. */
  readonly evidenceLevel: string;
  /** Date the entry was last observed/reviewed. */
  readonly observationDate: string;
  /** Base endpoint URL. */
  readonly endpoint: string;
  /** Transport rules for the endpoint. */
  readonly transportRules: TransportRules;
  /** Privacy classification. */
  readonly privacyClassification: PrivacyClassification;
  /** Retention classification. */
  readonly retentionClassification: RetentionClassification;
  /** Confirmation policy. */
  readonly confirmationPolicy: ConfirmationPolicy;
  /** Manifest version this entry was defined under. */
  readonly manifestVersion: number;
  /** Contract version for this service. */
  readonly contractVersion: string;
  /** Adapter version for this service. */
  readonly adapterVersion: string;
  /** Latest contract-test result. */
  readonly latestContractTestResult: ContractTestResult;
  /** Whether this service is invokable. */
  readonly invokable: boolean;
  /** Reason for the invokable state (null when invokable is true). */
  readonly invokableStateReason: string | null;
}

/** The top-level Capability Registry manifest. */
export interface CapabilityRegistryManifest {
  readonly manifestVersion: number;
  readonly observationDate: string;
  /** Maximum age in days before the manifest is considered stale. */
  readonly freshnessDays: number;
  /** Whether this manifest has been revoked. */
  readonly revoked: boolean;
  /** Reason for revocation (null when not revoked). */
  readonly revocationReason: string | null;
  /** Source of the manifest data. */
  readonly source: string;
  /** Registry entries. */
  readonly entries: readonly CapabilityRegistryEntry[];
}

/** Sanitized fail-closed Evidence for registry invocation gating. */
export interface RegistryFailClosedEvidence {
  readonly manifestVersion: number;
  readonly cause:
    | 'malformed'
    | 'stale'
    | 'revoked'
    | 'missing-field'
    | 'not-found'
    | 'not-invokable';
  readonly detail: string;
  readonly timestamp: string;
}

/** Result of loading and validating a registry manifest. */
export type RegistryLoadResult =
  | { readonly ok: true; readonly manifest: CapabilityRegistryManifest }
  | { readonly ok: false; readonly evidence: RegistryFailClosedEvidence };
