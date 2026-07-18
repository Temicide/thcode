import { createHash } from 'node:crypto';
import { newContextExtensionId } from '../protocol/ids.js';
import type { SessionId } from '../protocol/ids.js';
import { PROTOCOL_MAJOR, protocolVersion } from '../protocol/version.js';

export type ContextExtensionKind = 'pin' | 'context-decision' | 'manifest' | 'compaction' | 'overflow' | 'usage' | 'unknown';
export interface ContextExtensionEnvelope { readonly id: string; readonly kind: ContextExtensionKind | string; readonly schemaVersion: string; readonly sessionId: SessionId; readonly owner: string; readonly checksum: string; readonly provenance: { readonly source: string; readonly at: string }; readonly forwardCompatible: boolean; readonly authoritative: boolean; readonly payload: unknown }
export type ExtensionValidation = { readonly ok: true; readonly value: ContextExtensionEnvelope } | { readonly ok: false; readonly cause: string; readonly highWater: number };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function extensionChecksum(input: Omit<ContextExtensionEnvelope, 'checksum'>): string { return createHash('sha256').update(canonical(input)).digest('hex'); }
export function createExtension(input: { kind: ContextExtensionKind | string; sessionId: SessionId; owner: string; payload: unknown; source?: string; now?: string; forwardCompatible?: boolean }): ContextExtensionEnvelope { const base = { id: newContextExtensionId(), kind: input.kind, schemaVersion: protocolVersion(), sessionId: input.sessionId, owner: input.owner, provenance: { source: input.source ?? 'core', at: input.now ?? new Date().toISOString() }, forwardCompatible: input.forwardCompatible ?? true, authoritative: input.kind !== 'unknown', payload: input.payload }; return Object.freeze({ ...base, checksum: extensionChecksum(base) }); }
export function validateExtension(value: unknown, expectedSession?: string): ExtensionValidation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { ok: false, cause: 'extension is not an object', highWater: 0 };
  const e = value as Partial<ContextExtensionEnvelope>;
  if (
    typeof e.id !== 'string' || e.id.length === 0 || typeof e.kind !== 'string' || e.kind.length === 0
    || typeof e.schemaVersion !== 'string' || typeof e.sessionId !== 'string' || e.sessionId.length === 0
    || typeof e.owner !== 'string' || e.owner.length === 0 || typeof e.checksum !== 'string'
    || typeof e.forwardCompatible !== 'boolean' || typeof e.authoritative !== 'boolean'
    || !e.provenance || typeof e.provenance.source !== 'string' || e.provenance.source.length === 0
    || typeof e.provenance.at !== 'string' || e.provenance.at.length === 0
  ) return { ok: false, cause: 'extension envelope missing required fields', highWater: 0 };
  if (expectedSession !== undefined && e.sessionId !== expectedSession) return { ok: false, cause: 'extension ownership mismatch', highWater: 0 };
  if (!/^\d+\.\d+$/.test(e.schemaVersion)) return { ok: false, cause: 'unsupported extension schema version', highWater: 0 };
  const [major] = e.schemaVersion.split('.');
  if (Number(major) > PROTOCOL_MAJOR || Number(major) < 1) return { ok: false, cause: 'unsupported extension schema version', highWater: 0 };
  const { checksum: _checksum, ...rest } = e as ContextExtensionEnvelope;
  if (extensionChecksum(rest) !== e.checksum) return { ok: false, cause: 'extension checksum mismatch', highWater: 0 };
  const authoritative = ['pin', 'context-decision', 'manifest', 'compaction', 'overflow', 'usage'].includes(e.kind) && Number(major) === PROTOCOL_MAJOR;
  return { ok: true, value: Object.freeze({ ...e, authoritative }) as ContextExtensionEnvelope };
}
