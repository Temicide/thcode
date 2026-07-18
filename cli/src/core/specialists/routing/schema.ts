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
/** Keys that are never allowed in inputLimits — defense in depth against
 *  malformed manifests leaking secrets into Active Model Context. */
const FORBIDDEN_INPUT_LIMIT_KEYS = new Set([
  'apiKey', 'apikey', 'api_key', 'secret', 'secretKey', 'secret_key',
  'token', 'credential', 'password', 'passwd', 'endpoint', 'url',
]);

export function buildTaskRelevantSchema(entry: CapabilityRegistryEntry): TaskRelevantSchema {
  // Sanitize inputLimits: strip any keys that look like secrets.
  const sanitizedLimits: Record<string, string> = {};
  for (const [key, value] of Object.entries(entry.inputLimits)) {
    if (!FORBIDDEN_INPUT_LIMIT_KEYS.has(key)) {
      sanitizedLimits[key] = value;
    }
  }

  return {
    serviceId: entry.id,
    supportedInputs: entry.supportedInputs,
    inputLimits: sanitizedLimits,
    transportPolicy: {
      allowedProtocols: [...entry.transportRules.allowedProtocols],
      requiresTls: entry.transportRules.requiresTls,
      allowedMethods: [...entry.transportRules.allowedMethods],
    },
  };
}
