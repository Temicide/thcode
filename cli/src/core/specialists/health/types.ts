// Specialist health types (Story 4.4). Immutable, secret-free effective
// configuration for a Specialist Service, binding endpoint/origin, service
// mapping, credential reference id+revision+fingerprint, registry manifest
// version, contract version, adapter version, transport policy, and request
// config. The digest id incorporates every bound field so any change
// supersedes the generation (AD-8, AD-18).

import type { HealthProbeResult, HealthFailure, HealthState } from '../../providers/health.js';

/** Transport policy projected from the registry entry's TransportRules. */
export interface SpecialistTransportPolicy {
  readonly allowedProtocols: readonly string[];
  readonly requiresTls: boolean;
  readonly allowedMethods: readonly string[];
}

/** Bounded request configuration options relevant to a Specialist call. */
export interface SpecialistRequestConfig {
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

/**
 * Immutable, secret-free effective configuration for a Specialist Service.
 * Carries ONLY the credential reference id + revision + fingerprint — never
 * the raw key. The digest id is deterministic over all bound fields.
 */
export interface SpecialistEffectiveConfiguration {
  /** Deterministic digest id: `specialist-gen-{sha256hex}` over all bound fields. */
  readonly id: string;
  /** Stable thcode service identity (e.g. `t-ocr`). */
  readonly serviceId: string;
  /** Verified endpoint URL. */
  readonly endpoint: string;
  /** Origin identity (from the registry entry's upstreamId). */
  readonly origin: string;
  /** Service mapping identity (serviceId → upstreamId). */
  readonly serviceMapping: string;
  /** Credential reference id (opaque, secret-free). */
  readonly credentialReferenceId: string;
  /** Credential revision (changes when the key is rotated). */
  readonly credentialRevision: string;
  /** Secret-free fingerprint (hash of identity + host + revision). */
  readonly credentialFingerprint: string;
  /** Registry manifest version. */
  readonly manifestVersion: number;
  /** Contract version for this service. */
  readonly contractVersion: string;
  /** Adapter version for this service. */
  readonly adapterVersion: string;
  /** Transport policy projected from the registry entry's TransportRules. */
  readonly transportPolicy: SpecialistTransportPolicy;
  /** Bounded request configuration. */
  readonly requestConfig: SpecialistRequestConfig;
  /** UTC ISO-8601 creation timestamp. */
  readonly createdAt: string;
}

/** Typed cause for a failed generation build. */
export type SpecialistGenerationCause =
  | 'not-invokable'
  | 'missing-credential'
  | 'missing-field'
  | 'transport-policy';

/** Typed result of building a SpecialistEffectiveConfiguration. */
export type SpecialistGenerationResult =
  | { readonly ok: true; readonly configuration: SpecialistEffectiveConfiguration }
  | { readonly ok: false; readonly cause: SpecialistGenerationCause; readonly detail: string };

/** A health snapshot for a Specialist Service. */
export interface SpecialistHealthSnapshot {
  readonly serviceId: string;
  readonly state: HealthState;
  readonly generationId?: string;
  readonly endpoint?: string;
  readonly failure?: HealthFailure;
  readonly evidence?: string;
  readonly checkedAt?: string;
}

/**
 * A live health probe for a Specialist Service. Receives the secret-free
 * effective configuration; the raw key is fetched inside the probe scope only
 * (by Stories 4.10–4.13) and never appears in Evidence, the snapshot, or the
 * failure envelope (AD-11, AD-24).
 */
export type SpecialistRetestProbeResult = HealthProbeResult | {
  readonly ok: false;
  readonly outcome: 'cancelled' | 'unknown';
  readonly safeReason?: string;
};

export type SpecialistHealthProbe = (
  gen: SpecialistEffectiveConfiguration,
) => Promise<SpecialistRetestProbeResult>;

/** Explicit retest outcomes are kept distinct from advisory catalog controls.
 * Cancellation and unknown outcomes are not successful health evidence and must
 * never restore availability (AD-8, AD-13, AD-18). */
export type SpecialistRetestOutcome =
  | 'passed'
  | 'failed'
  | 'cancelled'
  | 'stale'
  | 'unknown';

export type SpecialistRetestScope = 'service' | 'credential-group';

export interface SpecialistRetestRequest {
  readonly serviceId: string;
  readonly scope?: SpecialistRetestScope;
  readonly operationId: string;
}

export interface SpecialistRetestResult {
  readonly ok: boolean;
  readonly operationId: string;
  readonly serviceId: string;
  readonly scope: SpecialistRetestScope;
  readonly outcome: SpecialistRetestOutcome;
  readonly generationId?: string;
  readonly restoredServiceIds: readonly string[];
  readonly state: HealthState;
  readonly checkedAt?: string;
  readonly probeEvidence?: string;
  readonly safeReason: string;
}
