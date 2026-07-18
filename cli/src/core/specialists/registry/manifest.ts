// Manifest validation and normalization for the Capability Registry (Story 4.1).
// Fails closed on malformed/stale/revoked/missing-field manifests and emits
// sanitized Evidence with manifest version + cause. Entry-level validation
// also fails closed (never throws) so a single bad entry cannot crash the host.

import {
  type CapabilityRegistryEntry,
  type RegistryFailClosedEvidence,
  type RegistryLoadResult,
  type HealthCanarySpec,
} from './types.js';

/** Error thrown only by low-level callers that opt into throwing (kept for
 * backward-compatible synchronous callers). `validateManifest` itself never
 * throws — it returns a fail-closed result. */
export class RegistryManifestError extends Error {
  constructor(message: string) {
    super(`Registry manifest invalid: ${message}`);
    this.name = 'RegistryManifestError';
  }
}

/** True when `x` is an array of strings. */
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}

/** True when `x` is a finite, non-negative integer. */
function isNonNegInt(x: unknown): boolean {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0;
}

/** Build a fail-closed Evidence record. */
function failClosed(
  manifestVersion: number,
  cause: RegistryFailClosedEvidence['cause'],
  detail: string,
  now: string,
): { readonly ok: false; readonly evidence: RegistryFailClosedEvidence } {
  return {
    ok: false,
    evidence: {
      manifestVersion,
      cause,
      detail,
      timestamp: now,
    },
  };
}

/** Validate and normalize a parsed manifest object. Never throws — returns a
 * fail-closed result on any malformed/stale/revoked/missing-field manifest. */
export function validateManifest(raw: unknown, now: string): RegistryLoadResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return failClosed(0, 'malformed', 'root is not an object', now);
  }
  const obj = raw as Record<string, unknown>;

  if (!Number.isInteger(obj.manifestVersion) || (obj.manifestVersion as number) <= 0) {
    return failClosed(0, 'malformed', 'manifestVersion must be a positive integer', now);
  }
  const manifestVersion = obj.manifestVersion as number;

  if (typeof obj.observationDate !== 'string') {
    return failClosed(manifestVersion, 'missing-field', 'observationDate must be a string', now);
  }
  const observationDate = obj.observationDate as string;

  if (typeof obj.freshnessDays !== 'number') {
    return failClosed(manifestVersion, 'missing-field', 'freshnessDays must be a number', now);
  }
  if (!Number.isInteger(obj.freshnessDays) || (obj.freshnessDays as number) <= 0) {
    return failClosed(manifestVersion, 'malformed', 'freshnessDays must be a positive integer', now);
  }
  const freshnessDays = obj.freshnessDays as number;

  if (typeof obj.source !== 'string') {
    return failClosed(manifestVersion, 'missing-field', 'source must be a string', now);
  }

  // Revocation marker: must be a strict boolean when present.
  if (obj.revoked !== undefined && typeof obj.revoked !== 'boolean') {
    return failClosed(manifestVersion, 'malformed', 'revoked must be a boolean when present', now);
  }
  const revoked = obj.revoked === true;
  const revocationReason = typeof obj.revocationReason === 'string' ? (obj.revocationReason as string) : null;
  if (revoked) {
    return failClosed(manifestVersion, 'revoked', revocationReason ?? 'manifest is revoked', now);
  }

  // Staleness: freshnessDays is a verified positive integer, so the check
  // always runs (a zero/negative value was already rejected as malformed).
  const observed = new Date(observationDate).getTime();
  const reference = new Date(now).getTime();
  if (Number.isNaN(observed) || Number.isNaN(reference)) {
    return failClosed(manifestVersion, 'malformed', 'invalid date format in observationDate or reference date', now);
  }
  const ageMs = reference - observed;
  const maxAgeMs = freshnessDays * 24 * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) {
    return failClosed(
      manifestVersion,
      'stale',
      `observationDate ${observationDate} exceeds freshness policy of ${freshnessDays} days`,
      now,
    );
  }

  if (!Array.isArray(obj.entries)) {
    return failClosed(manifestVersion, 'missing-field', 'entries must be an array', now);
  }

  const seen = new Set<string>();
  const entries: CapabilityRegistryEntry[] = [];
  const rawEntries = obj.entries as unknown[];
  for (let i = 0; i < rawEntries.length; i++) {
    const s = rawEntries[i];
    if (typeof s !== 'object' || s === null || Array.isArray(s)) {
      return failClosed(manifestVersion, 'malformed', `entries[${i}] is not an object`, now);
    }
    const e = s as Record<string, unknown>;

    const id = e.id;
    if (typeof id !== 'string' || !id) {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].id must be a non-empty string`, now);
    }
    if (seen.has(id)) {
      return failClosed(manifestVersion, 'malformed', `duplicate entry id "${id}"`, now);
    }
    seen.add(id);

    const requiredFields: Array<[string, string]> = [
      ['upstreamId', 'string'],
      ['nameThai', 'string'],
      ['nameEnglish', 'string'],
      ['entitlement', 'string'],
      ['evidenceLevel', 'string'],
      ['observationDate', 'string'],
      ['endpoint', 'string'],
      ['contractVersion', 'string'],
      ['adapterVersion', 'string'],
    ];
    for (const [field, type] of requiredFields) {
      if (typeof e[field] !== type) {
        return failClosed(manifestVersion, 'missing-field', `entries[${i}].${field} must be a ${type}`, now);
      }
    }

    if (!isStringArray(e.searchTerms)) {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].searchTerms must be an array of strings`, now);
    }
    if (!isStringArray(e.capabilities)) {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].capabilities must be an array of strings`, now);
    }
    if (!isStringArray(e.supportedInputs)) {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].supportedInputs must be an array of strings`, now);
    }

    if (typeof e.inputLimits !== 'object' || e.inputLimits === null || Array.isArray(e.inputLimits)) {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].inputLimits must be an object`, now);
    }
    const inputLimits = e.inputLimits as Record<string, unknown>;
    for (const [k, v] of Object.entries(inputLimits)) {
      if (typeof v !== 'string') {
        return failClosed(manifestVersion, 'malformed', `entries[${i}].inputLimits.${k} must be a string`, now);
      }
    }

    if (typeof e.transportRules !== 'object' || e.transportRules === null || Array.isArray(e.transportRules)) {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].transportRules must be an object`, now);
    }
    const tr = e.transportRules as Record<string, unknown>;
    if (!isStringArray(tr.allowedProtocols)) {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].transportRules.allowedProtocols must be an array of strings`, now);
    }
    if (typeof tr.requiresTls !== 'boolean') {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].transportRules.requiresTls must be a boolean`, now);
    }
    if (!isStringArray(tr.allowedMethods)) {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].transportRules.allowedMethods must be an array of strings`, now);
    }

    if (typeof e.privacyClassification !== 'object' || e.privacyClassification === null || Array.isArray(e.privacyClassification)) {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].privacyClassification must be an object`, now);
    }
    const pc = e.privacyClassification as Record<string, unknown>;
    if (typeof pc.category !== 'string') {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].privacyClassification.category must be a string`, now);
    }
    if (!isStringArray(pc.dataClasses)) {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].privacyClassification.dataClasses must be an array of strings`, now);
    }
    if (typeof pc.requiresConsent !== 'boolean') {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].privacyClassification.requiresConsent must be a boolean`, now);
    }

    if (typeof e.retentionClassification !== 'object' || e.retentionClassification === null || Array.isArray(e.retentionClassification)) {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].retentionClassification must be an object`, now);
    }
    const rc = e.retentionClassification as Record<string, unknown>;
    if (typeof rc.policy !== 'string') {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].retentionClassification.policy must be a string`, now);
    }
    if (typeof rc.providerDeletionSupported !== 'boolean') {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].retentionClassification.providerDeletionSupported must be a boolean`, now);
    }
    let defaultRetentionDays: number | null = null;
    if (rc.defaultRetentionDays !== null && rc.defaultRetentionDays !== undefined) {
      if (!isNonNegInt(rc.defaultRetentionDays)) {
        return failClosed(manifestVersion, 'malformed', `entries[${i}].retentionClassification.defaultRetentionDays must be a non-negative integer or null`, now);
      }
      defaultRetentionDays = rc.defaultRetentionDays as number;
    }

    if (typeof e.confirmationPolicy !== 'object' || e.confirmationPolicy === null || Array.isArray(e.confirmationPolicy)) {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].confirmationPolicy must be an object`, now);
    }
    const cp = e.confirmationPolicy as Record<string, unknown>;
    if (typeof cp.requiresExplicitConsent !== 'boolean') {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].confirmationPolicy.requiresExplicitConsent must be a boolean`, now);
    }
    if (typeof cp.scope !== 'string') {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].confirmationPolicy.scope must be a string`, now);
    }

    if (typeof e.latestContractTestResult !== 'object' || e.latestContractTestResult === null || Array.isArray(e.latestContractTestResult)) {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].latestContractTestResult must be an object`, now);
    }
    const ctr = e.latestContractTestResult as Record<string, unknown>;
    if (typeof ctr.passed !== 'boolean') {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].latestContractTestResult.passed must be a boolean`, now);
    }
    if (typeof ctr.testedAt !== 'string') {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].latestContractTestResult.testedAt must be a string`, now);
    }
    if (typeof ctr.summary !== 'string') {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].latestContractTestResult.summary must be a string`, now);
    }

    if (typeof e.invokable !== 'boolean') {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].invokable must be a boolean`, now);
    }
    const invokable = e.invokable as boolean;
    const invokableStateReason = typeof e.invokableStateReason === 'string' ? (e.invokableStateReason as string) : null;

    if (!invokable && invokableStateReason === null) {
      return failClosed(manifestVersion, 'missing-field', `entries[${i}].invokableStateReason must be provided when invokable is false`, now);
    }
    if (invokable && invokableStateReason !== null) {
      return failClosed(manifestVersion, 'malformed', `entries[${i}].invokableStateReason must be null when invokable is true`, now);
    }

    let healthCanary: HealthCanarySpec | undefined;
    if (invokable) {
      if (typeof e.healthCanary !== 'object' || e.healthCanary === null || Array.isArray(e.healthCanary)) {
        return failClosed(manifestVersion, 'missing-field', `entries[${i}].healthCanary must be a reviewed static capability canary`, now);
      }
      const canary = e.healthCanary as Record<string, unknown>;
      if (canary.kind !== 'static-capability-canary' || canary.dataClassification !== 'built-in-non-user') {
        return failClosed(manifestVersion, 'malformed', `entries[${i}].healthCanary must declare a built-in non-user static capability canary`, now);
      }
      if (canary.method !== 'POST' || typeof canary.mediaType !== 'string' || !isStringArray(e.supportedInputs) || !e.supportedInputs.includes(canary.mediaType)) {
        return failClosed(manifestVersion, 'malformed', `entries[${i}].healthCanary must use an allowed POST media type`, now);
      }
      if (typeof canary.fixtureDigest !== 'string' || !/^[a-f0-9]{64}$/i.test(canary.fixtureDigest)) {
        return failClosed(manifestVersion, 'malformed', `entries[${i}].healthCanary.fixtureDigest must be a SHA-256 hex digest`, now);
      }
      if (canary.responseRule !== 'valid-service-response' || canary.contractVersion !== e.contractVersion || canary.adapterVersion !== e.adapterVersion) {
        return failClosed(manifestVersion, 'malformed', `entries[${i}].healthCanary must bind the current contract and adapter versions`, now);
      }
      healthCanary = {
        kind: 'static-capability-canary',
        dataClassification: 'built-in-non-user',
        method: 'POST',
        mediaType: canary.mediaType,
        fixtureDigest: canary.fixtureDigest,
        responseRule: 'valid-service-response',
        contractVersion: canary.contractVersion as string,
        adapterVersion: canary.adapterVersion as string,
      };
    }

    entries.push({
      id,
      upstreamId: e.upstreamId as string,
      nameThai: e.nameThai as string,
      nameEnglish: e.nameEnglish as string,
      searchTerms: e.searchTerms as string[],
      capabilities: e.capabilities as string[],
      supportedInputs: e.supportedInputs as string[],
      inputLimits: e.inputLimits as Record<string, string>,
      entitlement: e.entitlement as string,
      evidenceLevel: e.evidenceLevel as string,
      observationDate: e.observationDate as string,
      endpoint: e.endpoint as string,
      transportRules: {
        allowedProtocols: tr.allowedProtocols as string[],
        requiresTls: tr.requiresTls as boolean,
        allowedMethods: tr.allowedMethods as string[],
      },
      privacyClassification: {
        category: pc.category as string,
        dataClasses: pc.dataClasses as string[],
        requiresConsent: pc.requiresConsent as boolean,
      },
      retentionClassification: {
        policy: rc.policy as string,
        providerDeletionSupported: rc.providerDeletionSupported as boolean,
        defaultRetentionDays,
      },
      confirmationPolicy: {
        requiresExplicitConsent: cp.requiresExplicitConsent as boolean,
        scope: cp.scope as string,
      },
      manifestVersion,
      contractVersion: e.contractVersion as string,
      adapterVersion: e.adapterVersion as string,
      latestContractTestResult: {
        passed: ctr.passed as boolean,
        testedAt: ctr.testedAt as string,
        summary: ctr.summary as string,
      },
      healthCanary,
      invokable,
      invokableStateReason,
    });
  }

  return {
    ok: true,
    manifest: {
      manifestVersion,
      observationDate,
      freshnessDays,
      revoked: false,
      revocationReason: null,
      source: obj.source as string,
      entries,
    },
  };
}

/** Parse + validate a manifest from a JSON string. */
export function parseManifest(json: string, now: string): RegistryLoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return failClosed(0, 'malformed', `not valid JSON: ${(e as Error).message}`, now);
  }
  return validateManifest(raw, now);
}