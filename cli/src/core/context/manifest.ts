import { createHash } from 'node:crypto';
import { newContextManifestId } from '../protocol/ids.js';
import type { ContextBuildResult, ContextManifestId } from './types.js';

export interface ContextManifest {
  readonly id: ContextManifestId;
  readonly sessionId: string;
  readonly operationId: string;
  readonly promptRoundId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly configurationGeneration: string;
  readonly contextDigest: string;
  readonly requestBytesDigest: string;
  readonly requestBytesLength: number;
  readonly metadataDigest: string;
  readonly capacity: ContextBuildResult['capacity'];
  readonly itemIds: readonly string[];
  readonly omissions: readonly { readonly itemId: string; readonly reason: string }[];
  readonly createdAt: string;
  readonly version: number;
}

export interface FinalizedContextRequest { readonly bytes: Uint8Array; readonly digest: string; readonly manifest: ContextManifest }
export function digestBytes(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex') }
export function canonicalJson(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(normalize);
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, normalize(entry)]));
    }
    return v;
  };
  return JSON.stringify(normalize(value));
}
export function createContextManifest(input: { readonly sessionId: string; readonly operationId: string; readonly promptRoundId: string; readonly providerId: string; readonly modelId: string; readonly configurationGeneration: string; readonly requestBytes: Uint8Array; readonly metadata?: Record<string, unknown>; readonly context: ContextBuildResult; readonly now?: string }): ContextManifest {
  const contextDigest = digestBytes(new TextEncoder().encode(canonicalJson(input.context.messages)));
  const metadataDigest = digestBytes(new TextEncoder().encode(canonicalJson({ sessionId: input.sessionId, operationId: input.operationId, promptRoundId: input.promptRoundId, providerId: input.providerId, modelId: input.modelId, generation: input.configurationGeneration, metadata: input.metadata ?? {} })));
  return Object.freeze({ id: newContextManifestId() as ContextManifestId, sessionId: input.sessionId, operationId: input.operationId, promptRoundId: input.promptRoundId, providerId: input.providerId, modelId: input.modelId, configurationGeneration: input.configurationGeneration, contextDigest, requestBytesDigest: digestBytes(input.requestBytes), requestBytesLength: input.requestBytes.byteLength, metadataDigest, capacity: input.context.capacity, itemIds: input.context.items.filter((i) => !['omitted', 'excluded', 'unavailable'].includes(i.inclusion)).map((i) => i.id), omissions: input.context.omissions.map((i) => ({ itemId: i.id, reason: i.omissionReason ?? 'not-selected' })), createdAt: input.now ?? new Date().toISOString(), version: 1 });
}
export function verifyContextManifest(manifest: ContextManifest, bytes: Uint8Array, context: ContextBuildResult, metadata: Record<string, unknown> = {}): boolean {
  if (manifest.requestBytesLength !== bytes.byteLength || manifest.requestBytesDigest !== digestBytes(bytes)) return false;
  if (manifest.contextDigest !== digestBytes(new TextEncoder().encode(canonicalJson(context.messages)))) return false;
  const expected = digestBytes(new TextEncoder().encode(canonicalJson({ sessionId: manifest.sessionId, operationId: manifest.operationId, promptRoundId: manifest.promptRoundId, providerId: manifest.providerId, modelId: manifest.modelId, generation: manifest.configurationGeneration, metadata })));
  return expected === manifest.metadataDigest;
}
