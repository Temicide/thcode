import { createHash, randomUUID } from 'node:crypto';
import type { PinId } from './types.js';

export interface PinTarget { readonly itemId: string; readonly transcriptIdentity: string }
export interface ContextPin { readonly id: PinId; readonly sessionId: string; readonly target: PinTarget; readonly reason: string; readonly createdAt: string; readonly status: 'active' | 'removed'; readonly revision: number }
export type PinChange = { readonly kind: 'pin' | 'unpin'; readonly pin: ContextPin; readonly digest: string }

export function newPinId(): PinId { return randomUUID() as PinId }
export function pinDigest(pin: ContextPin): string { return createHash('sha256').update(JSON.stringify(pin)).digest('hex') }
export function createPin(input: { sessionId: string; target: PinTarget; reason?: string; now?: string }): ContextPin {
  const pin: ContextPin = Object.freeze({ id: newPinId(), sessionId: input.sessionId, target: Object.freeze({ ...input.target }), reason: input.reason ?? 'developer pinned context', createdAt: input.now ?? new Date().toISOString(), status: 'active', revision: 1 });
  return pin;
}
export function removePin(pin: ContextPin, now?: string): ContextPin { return Object.freeze({ ...pin, status: 'removed', revision: pin.revision + 1, createdAt: pin.createdAt, ...(now ? {} : {}) }); }
export function resolvePins(pins: readonly ContextPin[], sessionId: string): readonly ContextPin[] { return pins.filter((p) => p.sessionId === sessionId && p.status === 'active').sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)); }
