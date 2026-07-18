// Scoped quarantine application (Story 4.16). A failure may only disable the
// smallest evidence-proven scope; shared credentials use a preflighted health
// batch so no partial group transition is ever reported (AD-18).

import type { SpecialistHealthLifecycle } from '../health/index.js';
import type {
  ClassifiedFailure,
  QuarantineDecision,
  QuarantineReceipt,
} from './types.js';

const QUARANTINABLE = new Set<ClassifiedFailure['failureClass']>([
  'authentication',
  'entitlement',
  'protocol-incompatibility',
  'configuration-failure',
]);

function safeReason(classified: ClassifiedFailure): string {
  switch (classified.scope.kind) {
    case 'credential-group':
      return `Shared credential group ${classified.scope.credentialGroupId} rejected (evidence ${classified.evidenceRef}).`;
    case 'service':
      return `Service ${classified.scope.serviceId} quarantined for ${classified.failureClass} (evidence ${classified.evidenceRef}).`;
    case 'none':
      return `No quarantine scope proven for ${classified.failureClass} (evidence ${classified.evidenceRef}).`;
  }
}

/** Decide quarantine without performing a health or cache mutation. */
export function decideQuarantine(classified: ClassifiedFailure): QuarantineDecision {
  const canQuarantine = QUARANTINABLE.has(classified.failureClass) && classified.scope.kind !== 'none';
  return {
    quarantine: canQuarantine,
    scope: canQuarantine ? classified.scope : { kind: 'none' },
    failureClass: classified.failureClass,
    evidenceRef: classified.evidenceRef,
    safeReason: safeReason(classified),
  };
}

/**
 * Apply the pre-decided scope. Shared scope uses the lifecycle batch operation
 * and returns no service IDs when any target lacks current configuration.
 */
export function applyQuarantine(
  decision: QuarantineDecision,
  healthLifecycle: SpecialistHealthLifecycle,
): QuarantineReceipt {
  if (!decision.quarantine) {
    return {
      applied: false,
      serviceIds: [],
      evidenceRef: decision.evidenceRef,
      safeReason: decision.safeReason,
    };
  }

  const targets = decision.scope.kind === 'credential-group'
    ? decision.scope.members.map(({ serviceId, generationId }) => ({ serviceId, generationId }))
    : decision.scope.kind === 'service'
      ? [{ serviceId: decision.scope.serviceId, generationId: decision.scope.generationId }]
      : [];
  const applied = healthLifecycle.quarantineMany(targets, decision.safeReason);

  if (!applied.ok) {
    return {
      applied: false,
      serviceIds: [],
      evidenceRef: decision.evidenceRef,
      safeReason: decision.safeReason,
      blockedReason: applied.cause,
    };
  }

  return {
    applied: true,
    serviceIds: applied.snapshots.map((snapshot) => snapshot.serviceId),
    evidenceRef: decision.evidenceRef,
    safeReason: decision.safeReason,
  };
}
