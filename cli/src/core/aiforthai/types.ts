// AI for Thai adapter families (ADR 0011). EXTENSION POINT: interfaces only.
// Rather than 49 unrelated implementations, services are executed through
// reusable transport/normalization families. Execution here is a clearly
// labeled stub until services move from 'catalogued' to 'integrated'.

import type { CatalogServiceEntry } from '../catalog/types.js';

export type AdapterFamily =
  | 'text-json'
  | 'image-upload'
  | 'audio-upload'
  | 'binary-output'
  | 'async-job-polling'
  | 'chat-streaming'
  | 'custom';

export interface ServiceInvocation {
  readonly service: CatalogServiceEntry;
  readonly input: Record<string, unknown>;
}

export interface ServiceResult {
  readonly ok: boolean;
  readonly output: unknown;
  readonly raw?: unknown;
}

/**
 * TODO(aiforthai-families): implement one adapter per family (text/JSON first
 * for Extract Address + NER, image upload for T-OCR, audio upload for
 * Speech-to-Text) with credential scope, timeout/retry/quota behavior, and
 * contract tests that promote services to 'integrated'/'verified' (ADR 0011).
 */
export interface AiForThaiAdapter {
  readonly family: AdapterFamily;
  supports(service: CatalogServiceEntry): boolean;
  invoke(invocation: ServiceInvocation, apiKey: string): Promise<ServiceResult>;
}

/** Stub executor: catalogued services are discoverable but NOT callable. */
export function stubInvoke(service: CatalogServiceEntry): ServiceResult {
  return {
    ok: false,
    output:
      `Service "${service.upstreamName}" is ${service.supportLevel} only — ` +
      `not yet integrated. (STUB: no network call was made.)`,
  };
}
