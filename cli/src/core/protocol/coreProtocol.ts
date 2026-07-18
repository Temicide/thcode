// CoreProtocolV1 facade — version, validators, and the fail-closed startup
// compatibility check (AD-2, AD-3, AD-14, NFR-7). Unknown variants are
// rejected after one validation pass; no coercion, repair, or re-interpretation.

import { INTENT_TYPES, type Intent } from './intents.js';
import { validateEnvelopeShape } from './envelope.js';
import {
  DURABLE_EVENT_KINDS,
  TRANSIENT_EVENT_KINDS,
  type DurableEvent,
} from './events.js';
import { PROTOCOL_MAJOR, PROTOCOL_MINOR, protocolVersion } from './version.js';

export { PROTOCOL_MAJOR, PROTOCOL_MINOR, protocolVersion } from './version.js';
export { newSessionId, newPromptRoundId, newOperationId, newEventId } from './ids.js';
export type { Intent } from './intents.js';
export type { DurableEvent, TransientEvent } from './events.js';

const INTENT_TYPE_SET = new Set<string>(INTENT_TYPES);
const DURABLE_KIND_SET = new Set<string>(DURABLE_EVENT_KINDS);
const TRANSIENT_KIND_SET = new Set<string>(TRANSIENT_EVENT_KINDS);

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; cause: string };

/** Validate an unknown value as an Intent (AD-14 fail-closed). */
export function validateIntent(v: unknown): ValidationResult<Intent> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return { ok: false, cause: 'intent is not an object' };
  }
  const obj = v as { type?: unknown; text?: unknown };
  if (typeof obj.type !== 'string' || !INTENT_TYPE_SET.has(obj.type)) {
    return { ok: false, cause: `unknown intent type: ${String(obj.type)}` };
  }
  // Minimal field check for the prompt.submit intent (the only intent with a
  // required field today). Other intents carry no required fields yet; later
  // stories add per-intent validators.
  if (obj.type === 'prompt.submit') {
    if (typeof obj.text !== 'string' || obj.text.length === 0) {
      return { ok: false, cause: 'prompt.submit requires a non-empty text field' };
    }
  }
  return { ok: true, value: v as Intent };
}

/** Validate an unknown value as a DurableEvent (envelope + payload kind). */
export function validateDurableEvent(v: unknown): ValidationResult<DurableEvent> {
  const shape = validateEnvelopeShape(v, PROTOCOL_MAJOR);
  if (!shape.ok) return { ok: false, cause: shape.cause };
  const payload = shape.env.payload as { kind?: unknown };
  if (typeof payload !== 'object' || payload === null || typeof payload.kind !== 'string') {
    return { ok: false, cause: 'envelope payload is not a { kind: string } object' };
  }
  if (TRANSIENT_KIND_SET.has(payload.kind)) {
    return { ok: false, cause: `${payload.kind} is a transient event, not durable` };
  }
  if (!DURABLE_KIND_SET.has(payload.kind)) {
    return { ok: false, cause: `unknown durable event kind: ${payload.kind}` };
  }
  return { ok: true, value: v as DurableEvent };
}

/** Fail-closed startup check for protocol major-version compatibility (AD-2). */
export function assertCompatibleVersion(major: number): void {
  if (major !== PROTOCOL_MAJOR) {
    throw new ProtocolVersionMismatch(PROTOCOL_MAJOR, major);
  }
}

export class ProtocolVersionMismatch extends Error {
  constructor(public readonly expected: number, public readonly received: number) {
    super(`Protocol version mismatch: expected major ${expected}, received ${received}`);
    this.name = 'ProtocolVersionMismatch';
  }
}

export const PROTOCOL_V1 = {
  major: PROTOCOL_MAJOR,
  minor: PROTOCOL_MINOR,
  version: protocolVersion(),
  validateIntent,
  validateDurableEvent,
  assertCompatibleVersion,
} as const;