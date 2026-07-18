import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { routeSpecialistPrompt } from '../src/core/specialists/routing/index.js';
import { CapabilityRegistry } from '../src/core/specialists/registry/index.js';
import type { HealthMap } from '../src/core/specialists/catalog/index.js';

const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'specialists-manifest.json');
const now = '2026-07-18T12:00:00.000Z';

function availableHealth(registry: CapabilityRegistry): HealthMap {
  return Object.fromEntries(registry.all().map((entry) => [entry.id, 'available'])) as HealthMap;
}

describe('Story 4.19 prompt-driven Specialist routing flows', () => {
  it.each([
    ['อ่านข้อความในภาพด้วย t-ocr', 't-ocr'],
    ['ถอดเสียงด้วย speech-to-text', 'speech-to-text'],
    ['แยกที่อยู่ด้วย extract-address', 'extract-address'],
    ['หาเอนทิตีด้วย named-entity-recognition', 'named-entity-recognition'],
  ])('selects only %s for its explicit Thai/mixed-language prompt', (prompt, serviceId) => {
    const registry = CapabilityRegistry.load(now, manifestPath);
    const decision = routeSpecialistPrompt(prompt, registry, {
      isTTY: true,
      healthMap: availableHealth(registry),
      disabledSet: new Set(),
      intentAmbiguity: 'none',
    }, () => now);

    expect(decision.kind).toBe('propose');
    if (decision.kind !== 'propose') return;
    expect(decision.serviceId).toBe(serviceId);
    expect(decision.schema.serviceId).toBe(serviceId);
  });

  it('does not substitute a service when the selected service is unavailable', () => {
    const registry = CapabilityRegistry.load(now, manifestPath);
    const health = availableHealth(registry);
    health['t-ocr'] = 'quarantined';
    const decision = routeSpecialistPrompt('อ่านข้อความในภาพด้วย t-ocr', registry, {
      isTTY: true,
      healthMap: health,
      disabledSet: new Set(),
      intentAmbiguity: 'none',
    }, () => now);

    expect(decision).toMatchObject({ kind: 'blocked', cause: 'service-unavailable', stateToken: 'quarantined' });
  });
});
