import { validateExtension, type ContextExtensionEnvelope } from './extensions.js';
import type { ContextManifest } from './manifest.js';
import type { ContextPin } from './pins.js';
import type { UsageObservation } from './usage.js';

export interface ContextRecoveryState { readonly pins: readonly ContextPin[]; readonly manifests: readonly ContextManifest[]; readonly usage: readonly UsageObservation[]; readonly compactions: readonly unknown[]; readonly overflows: readonly unknown[]; readonly opaque: readonly ContextExtensionEnvelope[]; readonly highWater: number; readonly status: 'available' | 'unavailable' | 'corrupt' | 'recovery-locked' }
export function recoverContextExtensions(records: readonly unknown[], sessionId: string): ContextRecoveryState {
  const pins = new Map<string, ContextPin>();
  const manifests = new Map<string, ContextManifest>();
  const usage = new Map<string, UsageObservation>();
  const compactions: unknown[] = [];
  const overflows: unknown[] = [];
  const opaque = new Map<string, ContextExtensionEnvelope>();
  let status: ContextRecoveryState['status'] = 'available';
  let highWater = 0;

  for (let index = 0; index < records.length; index += 1) {
    // A consumed record advances high-water even when it is corrupt. Corruption
    // is sticky, but later records remain evidence-only and may not restore
    // dispatch authority (AD-7).
    highWater = index + 1;
    const result = validateExtension(records[index], sessionId);
    if (!result.ok) {
      status = 'corrupt';
      continue;
    }
    const e = result.value;
    switch (e.kind) {
      case 'pin': {
        const pin = e.payload as ContextPin;
        const prior = pins.get(pin.id);
        if (!prior || pin.revision >= prior.revision) pins.set(pin.id, pin);
        break;
      }
      case 'manifest': {
        const manifest = e.payload as ContextManifest;
        manifests.set(manifest.id, manifest);
        break;
      }
      case 'usage': {
        const observation = e.payload as UsageObservation;
        usage.set(`${observation.operationId}:${observation.requestDigest ?? observation.id}`, observation);
        break;
      }
      case 'compaction': compactions.push(e.payload); break;
      case 'overflow': overflows.push(e.payload); break;
      default: opaque.set(e.id, e); break;
    }
  }
  return Object.freeze({ pins: [...pins.values()], manifests: [...manifests.values()], usage: [...usage.values()], compactions, overflows, opaque: [...opaque.values()], highWater, status });
}
