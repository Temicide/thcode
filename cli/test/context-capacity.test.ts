// QC fix 2026-07-17 (Story 1.10, PR-4 violation). Proves:
//   (a) with an unverified limit, status + query projections carry the
//       literal `'percentage unavailable'` token and no numeric percent;
//   (b) no fabricated numeric ever reaches the UI rendering path;
//   (c) with a hypothetical verified limit injected, numeric percent works.
// epics.md Pre-Implementation Gate PR-4: no `128k` raw limit or `115,200`
// fallback capacity is a release commitment without a named provider/product
// decision and source.

import { describe, expect, it } from 'vitest';
import { CoreApp } from '../src/core/app.js';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';
import { formatContextPercent } from '../src/ui/App.js';
import {
  contextUtilizationPercentOrUnavailable,
  effectiveContextCapacityOrUnavailable,
} from '../src/core/context/types.js';
import { ProviderRegistry } from '../src/core/providers/registry.js';
import { TyphoonAdapter } from '../src/core/providers/typhoon.js';
import type {
  ProviderAdapter,
  ProviderAvailability,
  ProviderCapabilities,
  ProviderResult,
  RetryableErrorMeta,
} from '../src/core/providers/types.js';

function makeCore() {
  return new CoreApp({
    credentials: new InMemoryCredentialStore(),
    workspaceRoot: '/tmp/test-ws',
  });
}

describe('PR-4 — no fabricated context capacity before a verified Typhoon limit exists', () => {
  it('(a) statusProjection carries the literal token and no numeric percent', () => {
    const core = makeCore();
    const s = core.statusProjection();
    expect(s.contextPercent).toBe('percentage unavailable');
    expect(typeof s.contextPercent).not.toBe('number');
  });

  it('(a) query() ContextProjection carries the literal token for capacity and utilization', () => {
    const core = makeCore();
    const p = core.query();
    expect(p.context.effectiveCapacity).toBe('percentage unavailable');
    expect(p.context.utilizationPercent).toBe('percentage unavailable');
    expect(p.status.contextPercent).toBe('percentage unavailable');
  });

  it('(a) legacy status() also propagates the literal token (no bypass)', () => {
    const core = makeCore();
    expect(core.status().contextPercent).toBe('percentage unavailable');
  });

  it('(a) no `128000` or `115200`-derived number appears anywhere in the serialized projection', () => {
    const core = makeCore();
    const json = JSON.stringify(core.query());
    expect(json).not.toMatch(/128000|115200/);
  });

  it('(b) the UI formatter renders the literal token verbatim, never a fabricated `Ctx N%`', () => {
    expect(formatContextPercent('percentage unavailable')).toBe('percentage unavailable');
  });

  it('(b) the UI formatter never fabricates a percent from CoreApp output for the real Typhoon adapter', () => {
    const core = makeCore();
    const rendered = formatContextPercent(core.statusProjection().contextPercent);
    expect(rendered).toBe('percentage unavailable');
    expect(rendered).not.toMatch(/^Ctx \d/);
  });

  it('(c) with a hypothetical verified limit, numeric percent works end to end', () => {
    // A fake adapter reporting a verified (non-null) context limit, exactly
    // the shape a real sourced Typhoon limit would take once approved.
    class VerifiedAdapter implements ProviderAdapter {
      readonly capabilities: ProviderCapabilities = {
        modelId: 'typhoon-verified-fixture',
        provider: 'typhoon',
        inputModalities: ['text'],
        contextLimit: 100_000, // hypothetical verified limit, NOT 128_000/115_200
        supportsToolCalls: true,
        supportsStreaming: true,
        dataHandling: 'fixture',
      };
      availability(): ProviderAvailability {
        return { available: true, authState: 'authenticated' };
      }
      classifyError(): RetryableErrorMeta {
        return { retryable: false, kind: 'unknown' };
      }
      async complete(): Promise<ProviderResult> {
        return { kind: 'final', text: 'ok' };
      }
    }
    const registry = new ProviderRegistry('typhoon');
    registry.register(new VerifiedAdapter());
    const core = new CoreApp({
      credentials: new InMemoryCredentialStore(),
      workspaceRoot: '/tmp/test-ws',
      providers: registry,
    });
    const s = core.statusProjection();
    expect(typeof s.contextPercent).toBe('number');
    expect(formatContextPercent(s.contextPercent)).toMatch(/^Ctx \d+%$/);
  });

  it('(c) the null-aware helpers compute a real numeric capacity/percent when a verified limit is supplied', () => {
    const capacity = effectiveContextCapacityOrUnavailable(100_000);
    expect(typeof capacity).toBe('number');
    const percent = contextUtilizationPercentOrUnavailable(1000, capacity);
    expect(typeof percent).toBe('number');
  });

  it('(c) the null-aware helpers propagate unavailability from a null limit', () => {
    expect(effectiveContextCapacityOrUnavailable(null)).toBe('percentage unavailable');
    expect(contextUtilizationPercentOrUnavailable(1000, 'percentage unavailable')).toBe('percentage unavailable');
  });
});
