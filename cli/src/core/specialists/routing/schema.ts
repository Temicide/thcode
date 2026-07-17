// Task-relevant schema builder (Story 4.5).
// Builds a minimal TaskRelevantSchema for exactly ONE service — only its
// supportedInputs, inputLimits, and a secret-free transport-policy summary.
// Never includes credentials, other services' schemas, or endpoint URLs
// that could leak secrets.

import type { CapabilityRegistryEntry } from '../registry/types.js';
import type { TaskRelevantSchema } from './types.js';

/**
 * Build a task-relevant schema for exactly ONE service.
 *
 * The schema contains ONLY the proposed service's:
 * - supportedInputs
 * - inputLimits
 * - A secret-free transport-policy summary (allowedProtocols, requiresTls,
 *   allowedMethods)
 *
 * Never includes:
 * - Credentials or credential references
 * - Other services' schemas
 * - Endpoint URLs that could leak secrets (the endpoint is a reviewed public
 *   host, but we exclude it from the schema to be conservative)
 *
 * @param entry - The registry entry for the proposed service.
 * @returns A minimal TaskRelevantSchema for that service only.
 */
export function buildTaskRelevantSchema(entry: CapabilityRegistryEntry): TaskRelevantSchema {
  return {
    serviceId: entry.id,
    supportedInputs: entry.supportedInputs,
    inputLimits: { ...entry.inputLimits },
    transportPolicy: {
      allowedProtocols: [...entry.transportRules.allowedProtocols],
      requiresTls: entry.transportRules.requiresTls,
      allowedMethods: [...entry.transportRules.allowedMethods],
    },
  };
}
