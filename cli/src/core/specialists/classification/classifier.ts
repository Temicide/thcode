// Pure deterministic Specialist failure classifier (Story 4.16). It maps the
// Story 4.9 transport categories into one canonical class and refuses to widen
// quarantine scope without exact, current credential-binding evidence (AD-18).

import type { HealthFailure } from '../../providers/health.js';
import type { SpecialistFailure, SpecialistFailureCategory } from '../adapter/types.js';
import type {
  ClassifiedFailure,
  CredentialGroupMember,
  FailureClass,
  FailureScope,
} from './types.js';

/** Authoritative context collected by CoreApp after a failure was sealed. */
export interface ClassificationContext {
  readonly sealedEvidenceRef: string;
  readonly credentialGroup?: {
    readonly id: string;
    readonly credentialReferenceId: string;
    readonly credentialRevision: string;
    readonly members: readonly CredentialGroupMember[];
  };
}

const CLASS_MAP: Record<SpecialistFailureCategory, FailureClass> = {
  transport: 'transient-network',
  timeout: 'transient-network',
  quota: 'quota-rate-limit',
  'rate-limited': 'quota-rate-limit',
  unauthorized: 'authentication',
  forbidden: 'entitlement',
  'malformed-response': 'protocol-incompatibility',
  'not-found': 'configuration-failure',
  'unsupported-input': 'unsupported-input',
  'server-error': 'unknown-outcome',
  'unknown-outcome': 'unknown-outcome',
};

function hasProvenCredentialGroup(
  serviceId: string,
  group: ClassificationContext['credentialGroup'],
): group is NonNullable<ClassificationContext['credentialGroup']> {
  if (!group || group.members.length === 0) return false;

  const memberIds = new Set<string>();
  for (const member of group.members) {
    if (
      memberIds.has(member.serviceId)
      || member.credentialReferenceId !== group.credentialReferenceId
      || member.credentialRevision !== group.credentialRevision
    ) {
      return false;
    }
    memberIds.add(member.serviceId);
  }
  return memberIds.has(serviceId);
}

function narrowScope(
  failure: SpecialistFailure,
  context: ClassificationContext,
): FailureScope {
  switch (failure.category) {
    case 'unauthorized': {
      if (hasProvenCredentialGroup(failure.serviceId, context.credentialGroup)) {
        const group = context.credentialGroup;
        return {
          kind: 'credential-group',
          credentialGroupId: group.id,
          credentialReferenceId: group.credentialReferenceId,
          credentialRevision: group.credentialRevision,
          members: group.members,
        };
      }
      return {
        kind: 'service',
        serviceId: failure.serviceId,
        generationId: failure.effectiveGenerationId,
      };
    }
    case 'forbidden':
    case 'malformed-response':
    case 'not-found':
      return {
        kind: 'service',
        serviceId: failure.serviceId,
        generationId: failure.effectiveGenerationId,
      };
    case 'transport':
    case 'timeout':
    case 'quota':
    case 'rate-limited':
    case 'unsupported-input':
    case 'server-error':
    case 'unknown-outcome':
      return { kind: 'none' };
  }
}

/** Classify a sealed Story 4.9 failure with one of the nine canonical classes. */
export function classifySpecialistFailure(
  failure: SpecialistFailure,
  context: ClassificationContext,
): ClassifiedFailure {
  return {
    failureClass: CLASS_MAP[failure.category],
    retryability: failure.retryability,
    causeCode: failure.causeCode,
    smallestProvenScope: failure.smallestProvenScope,
    scope: narrowScope(failure, context),
    effectiveGenerationId: failure.effectiveGenerationId,
    operationId: failure.operationId,
    serviceId: failure.serviceId,
    safeMessage: failure.safeMessage,
    evidenceRef: context.sealedEvidenceRef,
    retryAfterMs: failure.retryAfterMs,
  };
}

/**
 * Project a health failure without turning it into a service invocation failure.
 * Health has no prompt-round OperationId, so the caller supplies an explicit
 * operation id only when one exists; an empty id is intentional provenance.
 */
export function classifyHealthFailure(
  healthFailure: HealthFailure,
  sealedEvidenceRef: string,
  operationId = '',
): ClassifiedFailure {
  return {
    failureClass: 'failed-health',
    retryability: healthFailure.retryable ? 'retryable' : 'not-retryable',
    causeCode: healthFailure.causeCode,
    smallestProvenScope: healthFailure.scope,
    scope: { kind: 'none' },
    effectiveGenerationId: healthFailure.generationId,
    operationId,
    serviceId: healthFailure.scope,
    safeMessage: healthFailure.safeMessage,
    evidenceRef: sealedEvidenceRef,
    retryAfterMs: healthFailure.retryAfterMs,
  };
}
