// Mutation planning barrel export (Story 3.3).

export * from './types.js';
export { planMutationSet } from './plan.js';
export type { RawProposal, PlanContext } from './plan.js';
export { runProtectionPreflight } from './protectionPreflight.js';
export type { PreflightContext } from './protectionPreflight.js';
export { fingerprintPlan, isStale } from './planFingerprint.js';
export type { FingerprintContext, RevalidationContext } from './planFingerprint.js';
export { processConfirmation } from './confirmation.js';
export type { ConfirmationContext } from './confirmation.js';
