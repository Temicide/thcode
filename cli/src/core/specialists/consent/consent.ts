// Specialist transfer consent (Story 4.8). Wraps the generic
// evaluateTransferConsent and revalidateTransferConsent from transferConsent.ts
// with the Specialist activation/authority/policy context. Projects a granted
// consent into a secret-free ConsentReference for Evidence/dialog.

import {
  evaluateTransferConsent,
  revalidateTransferConsent,
  type ConsentEvaluationResult,
  type TransferConsent,
} from '../../permissions/transferConsent.js';
import type { SpecialistConsentInput, SpecialistRevalidationInput, ConsentReference } from './types.js';

/**
 * Request a Specialist transfer consent. Wraps the generic
 * evaluateTransferConsent with the Specialist activation/authority/policy
 * context. The sanitizerResult must be computed from the prepared payload
 * text (see app.ts accessor for the recommended approach).
 *
 * AD-17: consent is INDEPENDENT per exact transfer. Full Access, local
 * approval, cache reuse, and prior consent NEVER substitute for a fresh
 * exact consent decision. This function does not accept a fullAccess flag
 * or any profile — it evaluates purely on manifest validity.
 */
export function requestSpecialistTransferConsent(
  input: SpecialistConsentInput,
): ConsentEvaluationResult {
  return evaluateTransferConsent({
    manifest: input.manifest,
    activationId: input.activationId,
    activationRevision: input.activationRevision,
    authorityRevision: input.authorityRevision,
    policyVersion: input.policyVersion,
    clock: input.clock,
    currentPayloadByteDigest: input.currentPayloadByteDigest,
    now: input.now,
    sanitizerResult: input.sanitizerResult,
  });
}

/**
 * Revalidate a granted Specialist transfer consent immediately before
 * transport. Wraps the generic revalidateTransferConsent. Any change in
 * activation, authority, manifest, or payload bytes fails closed.
 */
export function revalidateSpecialistTransferConsent(
  consent: TransferConsent,
  current: SpecialistRevalidationInput,
): ConsentEvaluationResult {
  return revalidateTransferConsent(consent, {
    manifest: current.manifest,
    currentPayloadByteDigest: current.currentPayloadByteDigest,
    activationId: current.activationId,
    activationRevision: current.activationRevision,
    authorityRevision: current.authorityRevision,
    now: current.now,
  });
}

/**
 * Project a granted TransferConsent into a secret-free ConsentReference for
 * Evidence/dialog. The TransferConsent is already secret-free; ConsentReference
 * is the subset suitable for Evidence/dialog display.
 */
export function toConsentReference(consent: TransferConsent): ConsentReference {
  return {
    consentId: consent.consentId,
    manifestDigest: consent.manifestDigest,
    payloadByteDigest: consent.payloadByteDigest,
    recipientCapabilityId: consent.recipientCapabilityId,
    recipientCapabilityVersion: consent.recipientCapabilityVersion,
    verifiedEndpoint: consent.verifiedEndpoint,
    purpose: consent.purpose,
    grantedAt: consent.grantedAt,
    expiresAt: consent.expiresAt,
  };
}
