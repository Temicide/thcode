// Canonical event envelope (AD-3). Every durable operation/event carries this
// envelope. UTF-8 stable end-to-end (Thai and technical identifiers preserved).

import type { EventId, OperationId, PromptRoundId, SessionId } from './ids.js';
import type { Provenance } from './provenance.js';
import { protocolVersion } from './version.js';

export interface EventEnvelope<T> {
  readonly id: EventId;
  readonly sessionId: SessionId;
  readonly promptRoundId?: PromptRoundId;
  readonly operationId?: OperationId;
  readonly schemaVersion: string;
  readonly timestamp: string;
  readonly provenance: Provenance;
  readonly payload: T;
}

/** Serialize an envelope to a UTF-8 JSON string (stable for Thai). */
export function serializeEnvelope<T>(env: EventEnvelope<T>): string {
  return JSON.stringify(env);
}

/** Parse and return a typed envelope, or a parse failure. Does NOT validate
 * the payload kind — use `validateDurableEvent` for that. */
export function parseEnvelope<T>(json: string):
  | { ok: true; value: EventEnvelope<T> }
  | { ok: false; cause: string } {
  try {
    const value = JSON.parse(json) as EventEnvelope<T>;
    return { ok: true, value };
  } catch (e) {
    return { ok: false, cause: `envelope parse failed: ${(e as Error).message}` };
  }
}

/** Structural envelope validation (independent of payload kind). */
export function validateEnvelopeShape(
  v: unknown,
  expectedMajor: number,
): { ok: true; env: Record<string, unknown> } | { ok: false; cause: string } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return { ok: false, cause: 'envelope is not an object' };
  }
  const env = v as Record<string, unknown>;
  const required: Array<keyof EventEnvelope<unknown>> = [
    'id', 'sessionId', 'schemaVersion', 'timestamp', 'provenance', 'payload',
  ];
  for (const key of required) {
    if (!(key in env) || env[key as string] === undefined || env[key as string] === null) {
      return { ok: false, cause: `envelope missing required field: ${String(key)}` };
    }
  }
  if (typeof env.id !== 'string' || env.id.length === 0) {
    return { ok: false, cause: 'envelope.id is not a non-empty string' };
  }
  if (typeof env.sessionId !== 'string' || env.sessionId.length === 0) {
    return { ok: false, cause: 'envelope.sessionId is not a non-empty string' };
  }
  if (typeof env.schemaVersion !== 'string') {
    return { ok: false, cause: 'envelope.schemaVersion is not a string' };
  }
  const major = Number.parseInt(String(env.schemaVersion).split('.')[0] ?? '', 10);
  if (Number.isNaN(major)) {
    return { ok: false, cause: `envelope.schemaVersion is malformed: ${String(env.schemaVersion)}` };
  }
  if (major !== expectedMajor) {
    return {
      ok: false,
      cause: `envelope schemaVersion ${String(env.schemaVersion)} does not match expected major ${expectedMajor}`,
    };
  }
  if (typeof env.timestamp !== 'string' || Number.isNaN(Date.parse(env.timestamp))) {
    return { ok: false, cause: `envelope.timestamp is not a valid UTC ISO-8601 string: ${String(env.timestamp)}` };
  }
  if (typeof env.provenance !== 'object' || env.provenance === null) {
    return { ok: false, cause: 'envelope.provenance is not an object' };
  }
  const prov = env.provenance as { kind?: unknown };
  if (prov.kind !== 'deterministic' && prov.kind !== 'model') {
    return { ok: false, cause: `envelope.provenance.kind is not 'deterministic' or 'model'` };
  }
  return { ok: true, env };
}

export const ENVELOPE_SCHEMA_VERSION = protocolVersion();