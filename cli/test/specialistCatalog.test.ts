import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CapabilityRegistry } from '../src/core/specialists/registry/index.js';
import {
  computeCanonicalState,
  computeNextAllowedAction,
  computeActionAvailability,
  projectEntry,
  projectCatalog,
  browseCatalog,
  searchCatalog,
  inspectEntry,
  enableService,
  disableService,
  diagnoseService,
  retestService,
  renderEntryRow,
  renderEntryDetail,
  renderCatalogList,
  renderCatalogRow,
  safeReasonForState,
  actionAvailabilityString,
  type CatalogEntryProjection,
  type CatalogProjection,
  type HealthMap,
} from '../src/core/specialists/catalog/index.js';
import type { HealthState } from '../src/core/providers/health.js';

const MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'specialists-manifest.json',
);

const NOW = '2026-07-17T12:00:00.000Z';

function loadRegistry(): CapabilityRegistry {
  return CapabilityRegistry.load(NOW, MANIFEST_PATH);
}

function fullHealthMap(state: HealthState = 'available'): HealthMap {
  const registry = loadRegistry();
  const map: HealthMap = {};
  for (const entry of registry.all()) {
    map[entry.id] = state;
  }
  return map;
}

// ---------------------------------------------------------------------------
// projection.ts — computeCanonicalState
// ---------------------------------------------------------------------------

describe('computeCanonicalState', () => {
  it('returns working for invokable + available + not disabled', () => {
    expect(computeCanonicalState(true, 'available', false)).toBe('working');
  });

  it('returns Catalogued — Not available yet for non-invokable', () => {
    expect(computeCanonicalState(false, 'available', false)).toBe('Catalogued — Not available yet');
  });

  it('returns disabled for invokable + available + disabled', () => {
    expect(computeCanonicalState(true, 'available', true)).toBe('disabled');
  });

  it('returns unconfigured for invokable + unconfigured', () => {
    expect(computeCanonicalState(true, 'unconfigured', false)).toBe('unconfigured');
  });

  it('returns configured for invokable + configured', () => {
    expect(computeCanonicalState(true, 'configured', false)).toBe('configured');
  });

  it('returns checking for invokable + checking', () => {
    expect(computeCanonicalState(true, 'checking', false)).toBe('checking');
  });

  it('returns unavailable for invokable + unavailable', () => {
    expect(computeCanonicalState(true, 'unavailable', false)).toBe('unavailable');
  });

  it('returns unhealthy for invokable + unhealthy', () => {
    expect(computeCanonicalState(true, 'unhealthy', false)).toBe('unhealthy');
  });

  it('returns quarantined for invokable + quarantined', () => {
    expect(computeCanonicalState(true, 'quarantined', false)).toBe('quarantined');
  });

  it('non-invokable always returns Catalogued — Not available yet regardless of health', () => {
    const healthStates: HealthState[] = ['unconfigured', 'configured', 'checking', 'available', 'unavailable', 'unhealthy', 'quarantined'];
    for (const hs of healthStates) {
      expect(computeCanonicalState(false, hs, false)).toBe('Catalogued — Not available yet');
      expect(computeCanonicalState(false, hs, true)).toBe('Catalogued — Not available yet');
    }
  });
});

// ---------------------------------------------------------------------------
// projection.ts — computeNextAllowedAction
// ---------------------------------------------------------------------------

describe('computeNextAllowedAction', () => {
  it('returns invoke for working', () => {
    expect(computeNextAllowedAction('working')).toBe('invoke');
  });

  it('returns inspect only for Catalogued — Not available yet', () => {
    expect(computeNextAllowedAction('Catalogued — Not available yet')).toBe('inspect only');
  });

  it('returns enable for disabled', () => {
    expect(computeNextAllowedAction('disabled')).toBe('enable');
  });

  it('returns configure for unconfigured', () => {
    expect(computeNextAllowedAction('unconfigured')).toBe('configure');
  });

  it('returns check for configured', () => {
    expect(computeNextAllowedAction('configured')).toBe('check');
  });

  it('returns wait for checking', () => {
    expect(computeNextAllowedAction('checking')).toBe('wait');
  });

  it('returns retest for unavailable', () => {
    expect(computeNextAllowedAction('unavailable')).toBe('retest');
  });

  it('returns diagnose for unhealthy', () => {
    expect(computeNextAllowedAction('unhealthy')).toBe('diagnose');
  });

  it('returns retest for quarantined', () => {
    expect(computeNextAllowedAction('quarantined')).toBe('retest');
  });
});

// ---------------------------------------------------------------------------
// projection.ts — computeActionAvailability
// ---------------------------------------------------------------------------

describe('computeActionAvailability', () => {
  it('browse, search, inspect are always available', () => {
    const states: Array<Parameters<typeof computeActionAvailability>[0]> = [
      'working', 'Catalogued — Not available yet', 'disabled', 'unconfigured',
      'configured', 'checking', 'unavailable', 'unhealthy', 'quarantined',
    ];
    for (const state of states) {
      const a = computeActionAvailability(state);
      expect(a.browse).toBe(true);
      expect(a.search).toBe(true);
      expect(a.inspect).toBe(true);
    }
  });

  it('enable is only available for disabled', () => {
    expect(computeActionAvailability('disabled').enable).toBe(true);
    expect(computeActionAvailability('working').enable).toBe(false);
    expect(computeActionAvailability('unavailable').enable).toBe(false);
  });

  it('disable is only available for working', () => {
    expect(computeActionAvailability('working').disable).toBe(true);
    expect(computeActionAvailability('disabled').disable).toBe(false);
    expect(computeActionAvailability('unavailable').disable).toBe(false);
  });

  it('diagnose is only available for unhealthy', () => {
    expect(computeActionAvailability('unhealthy').diagnose).toBe(true);
    expect(computeActionAvailability('working').diagnose).toBe(false);
  });

  it('retest is available for unavailable and quarantined', () => {
    expect(computeActionAvailability('unavailable').retest).toBe(true);
    expect(computeActionAvailability('quarantined').retest).toBe(true);
    expect(computeActionAvailability('working').retest).toBe(false);
    expect(computeActionAvailability('unhealthy').retest).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// projection.ts — projectEntry
// ---------------------------------------------------------------------------

describe('projectEntry', () => {
  it('projects an invokable entry with available health as working', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    expect(projected.id).toBe('t-ocr');
    expect(projected.canonicalState).toBe('working');
    expect(projected.healthState).toBe('available');
    expect(projected.invocationEligibility).toBe(true);
    expect(projected.nextAllowedAction).toBe('invoke');
    expect(projected.actionAvailability.disable).toBe(true);
  });

  it('projects a non-invokable entry as Catalogued — Not available yet', () => {
    const registry = loadRegistry();
    const entry = registry.byId('typhoon-translate')!;
    expect(entry.invokable).toBe(false);
    const projected = projectEntry(entry, 'available', false);
    expect(projected.canonicalState).toBe('Catalogued — Not available yet');
    expect(projected.invocationEligibility).toBe(false);
    expect(projected.nextAllowedAction).toBe('inspect only');
    expect(projected.actionAvailability.enable).toBe(false);
    expect(projected.actionAvailability.disable).toBe(false);
  });

  it('projects a disabled entry as disabled', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', true);
    expect(projected.canonicalState).toBe('disabled');
    expect(projected.invocationEligibility).toBe(false);
    expect(projected.nextAllowedAction).toBe('enable');
    expect(projected.actionAvailability.enable).toBe(true);
  });

  it('projects an unhealthy entry as unhealthy', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'unhealthy', false);
    expect(projected.canonicalState).toBe('unhealthy');
    expect(projected.invocationEligibility).toBe(false);
    expect(projected.nextAllowedAction).toBe('diagnose');
    expect(projected.actionAvailability.diagnose).toBe(true);
  });

  it('projects a quarantined entry as quarantined', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'quarantined', false);
    expect(projected.canonicalState).toBe('quarantined');
    expect(projected.invocationEligibility).toBe(false);
    expect(projected.nextAllowedAction).toBe('retest');
    expect(projected.actionAvailability.retest).toBe(true);
  });

  it('projects an unavailable entry as unavailable', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'unavailable', false);
    expect(projected.canonicalState).toBe('unavailable');
    expect(projected.invocationEligibility).toBe(false);
    expect(projected.nextAllowedAction).toBe('retest');
    expect(projected.actionAvailability.retest).toBe(true);
  });

  it('includes identity, capabilities, supported inputs, limits, entitlement, evidence level', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    expect(projected.id).toBe('t-ocr');
    expect(projected.upstreamId).toBe('ocr');
    expect(projected.nameThai).toBe('ที-โอซีอาร์');
    expect(projected.nameEnglish).toBe('T-OCR');
    expect(projected.capabilities).toContain('thai-ocr');
    expect(projected.supportedInputs).toContain('image/png');
    expect(projected.inputLimits.maxFileSize).toBe('20MB');
    expect(projected.entitlement).toBe('AI-for-Thai API key required');
    expect(projected.evidenceLevel).toBe('deterministic');
  });

  it('includes manifest/contract versions and observation date', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    expect(projected.manifestVersion).toBe(1);
    expect(projected.contractVersion).toBe('1.0.0');
    expect(projected.adapterVersion).toBe('1.0.0');
    expect(projected.observationDate).toBeTruthy();
  });

  it('includes latest contract test result', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    expect(projected.latestContractTestResult.passed).toBe(true);
    expect(projected.latestContractTestResult.testedAt).toBeTruthy();
    expect(projected.latestContractTestResult.summary).toContain('T-OCR');
  });
});

// ---------------------------------------------------------------------------
// projection.ts — projectCatalog
// ---------------------------------------------------------------------------

describe('projectCatalog', () => {
  it('projects the full manifest with health map', () => {
    const registry = loadRegistry();
    const healthMap: HealthMap = { 't-ocr': 'available', 'speech-to-text': 'unavailable' };
    const disabledSet = new Set<string>(['speech-to-text']);
    const projection = projectCatalog(registry.manifest, healthMap, disabledSet);
    expect(projection.manifestVersion).toBe(1);
    expect(projection.entries.length).toBeGreaterThanOrEqual(5);

    const tOcr = projection.entries.find((e) => e.id === 't-ocr')!;
    expect(tOcr.canonicalState).toBe('working');
    expect(tOcr.healthState).toBe('available');

    const stt = projection.entries.find((e) => e.id === 'speech-to-text')!;
    expect(stt.canonicalState).toBe('disabled');
    expect(stt.healthState).toBe('unavailable');
  });

  it('defaults health to unconfigured when not in health map', () => {
    const registry = loadRegistry();
    const projection = projectCatalog(registry.manifest, {}, new Set());
    for (const entry of projection.entries) {
      expect(entry.healthState).toBe('unconfigured');
    }
  });
});

// ---------------------------------------------------------------------------
// controls.ts — browseCatalog
// ---------------------------------------------------------------------------

describe('browseCatalog', () => {
  it('returns a catalog projection when registry is loaded', () => {
    const registry = loadRegistry();
    const result = browseCatalog(registry, fullHealthMap('available'), new Set());
    expect('ok' in result).toBe(false); // not a fail result
    const projection = result as CatalogProjection;
    expect(projection.manifestVersion).toBe(1);
    expect(projection.entries.length).toBeGreaterThanOrEqual(5);
  });

  it('returns fail result when registry is not loaded', () => {
    const failRegistry = CapabilityRegistry.fromLoadResult(
      { ok: false, evidence: { manifestVersion: 0, cause: 'malformed', detail: 'test failure', timestamp: NOW } },
      NOW,
    );
    const result = browseCatalog(failRegistry, {}, new Set());
    expect('ok' in result).toBe(true);
    if ('ok' in result) {
      expect(result.ok).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// controls.ts — searchCatalog
// ---------------------------------------------------------------------------

describe('searchCatalog', () => {
  it('finds entries by id', () => {
    const registry = loadRegistry();
    const result = searchCatalog(registry, fullHealthMap('available'), new Set(), 't-ocr');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].id).toBe('t-ocr');
  });

  it('finds entries by Thai name', () => {
    const registry = loadRegistry();
    const result = searchCatalog(registry, fullHealthMap('available'), new Set(), 'ที-โอซีอาร์');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].id).toBe('t-ocr');
  });

  it('finds entries by English name', () => {
    const registry = loadRegistry();
    const result = searchCatalog(registry, fullHealthMap('available'), new Set(), 'T-OCR');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('finds entries by search terms', () => {
    const registry = loadRegistry();
    const result = searchCatalog(registry, fullHealthMap('available'), new Set(), 'ocr');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('finds entries by capabilities', () => {
    const registry = loadRegistry();
    const result = searchCatalog(registry, fullHealthMap('available'), new Set(), 'thai-ner');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].id).toBe('named-entity-recognition');
  });

  it('returns empty for no match', () => {
    const registry = loadRegistry();
    const result = searchCatalog(registry, fullHealthMap('available'), new Set(), 'zzzzz_nonexistent');
    expect(result.matches).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns empty for empty query', () => {
    const registry = loadRegistry();
    const result = searchCatalog(registry, fullHealthMap('available'), new Set(), '');
    expect(result.matches).toHaveLength(0);
  });

  it('returns fail result when registry is not loaded', () => {
    const failRegistry = CapabilityRegistry.fromLoadResult(
      { ok: false, evidence: { manifestVersion: 0, cause: 'malformed', detail: 'test failure', timestamp: NOW } },
      NOW,
    );
    const result = searchCatalog(failRegistry, {}, new Set(), 't-ocr');
    expect('ok' in result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// controls.ts — inspectEntry
// ---------------------------------------------------------------------------

describe('inspectEntry', () => {
  it('returns entry details for a valid invokable service', () => {
    const registry = loadRegistry();
    const result = inspectEntry(registry, fullHealthMap('available'), new Set(), 't-ocr');
    expect(result.ok).toBe(true);
    expect(result.entry).toBeDefined();
    expect(result.entry!.id).toBe('t-ocr');
    expect(result.entry!.canonicalState).toBe('working');
  });

  it('returns entry details for a non-invokable service with read-only message', () => {
    const registry = loadRegistry();
    const result = inspectEntry(registry, fullHealthMap('available'), new Set(), 'typhoon-translate');
    expect(result.ok).toBe(true);
    expect(result.entry).toBeDefined();
    expect(result.entry!.canonicalState).toBe('Catalogued — Not available yet');
    expect(result.message).toContain('Inspection only');
    expect(result.message).toContain('No invocation proposal');
  });

  it('returns not found for unknown id', () => {
    const registry = loadRegistry();
    const result = inspectEntry(registry, fullHealthMap('available'), new Set(), 'nonexistent');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('returns fail result when registry is not loaded', () => {
    const failRegistry = CapabilityRegistry.fromLoadResult(
      { ok: false, evidence: { manifestVersion: 0, cause: 'malformed', detail: 'test failure', timestamp: NOW } },
      NOW,
    );
    const result = inspectEntry(failRegistry, {}, new Set(), 't-ocr');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// controls.ts — enableService / disableService
// ---------------------------------------------------------------------------

describe('enableService', () => {
  it('enables a disabled service', () => {
    const disabled = new Set<string>(['t-ocr']);
    const result = enableService(disabled, 't-ocr');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('enabled');
    expect(disabled.has('t-ocr')).toBe(false);
  });

  it('fails when service is not disabled', () => {
    const disabled = new Set<string>();
    const result = enableService(disabled, 't-ocr');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not disabled');
  });
});

describe('disableService', () => {
  it('disables an invokable service', () => {
    const registry = loadRegistry();
    const disabled = new Set<string>();
    const result = disableService(registry, disabled, 't-ocr');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('disabled');
    expect(disabled.has('t-ocr')).toBe(true);
  });

  it('fails when service is already disabled', () => {
    const registry = loadRegistry();
    const disabled = new Set<string>(['t-ocr']);
    const result = disableService(registry, disabled, 't-ocr');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('already disabled');
  });

  it('fails when service is not invokable', () => {
    const registry = loadRegistry();
    const disabled = new Set<string>();
    const result = disableService(registry, disabled, 'typhoon-translate');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not invokable');
  });

  it('fails when service is not found', () => {
    const registry = loadRegistry();
    const disabled = new Set<string>();
    const result = disableService(registry, disabled, 'nonexistent');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// controls.ts — diagnoseService
// ---------------------------------------------------------------------------

describe('diagnoseService', () => {
  it('returns diagnosis for a working service', () => {
    const registry = loadRegistry();
    const result = diagnoseService(registry, fullHealthMap('available'), new Set(), 't-ocr');
    if ('ok' in result) {
      expect(result.ok).toBe(false);
      return;
    }
    expect(result.id).toBe('t-ocr');
    expect(result.canonicalState).toBe('working');
    expect(result.healthState).toBe('available');
    expect(result.retestRecommended).toBe(false);
  });

  it('returns diagnosis with retest recommended for unavailable', () => {
    const registry = loadRegistry();
    const result = diagnoseService(registry, fullHealthMap('unavailable'), new Set(), 't-ocr');
    if ('ok' in result) {
      expect(result.ok).toBe(false);
      return;
    }
    expect(result.canonicalState).toBe('unavailable');
    expect(result.retestRecommended).toBe(true);
  });

  it('returns diagnosis with retest recommended for quarantined', () => {
    const registry = loadRegistry();
    const result = diagnoseService(registry, fullHealthMap('quarantined'), new Set(), 't-ocr');
    if ('ok' in result) {
      expect(result.ok).toBe(false);
      return;
    }
    expect(result.canonicalState).toBe('quarantined');
    expect(result.retestRecommended).toBe(true);
  });

  it('returns fail result for unknown service', () => {
    const registry = loadRegistry();
    const result = diagnoseService(registry, fullHealthMap('available'), new Set(), 'nonexistent');
    expect('ok' in result).toBe(true);
    if ('ok' in result) {
      expect(result.ok).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// controls.ts — retestService
// ---------------------------------------------------------------------------

describe('retestService', () => {
  it('returns no retest needed for working service', () => {
    const registry = loadRegistry();
    const result = retestService(registry, fullHealthMap('available'), new Set(), 't-ocr');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('already working');
  });

  it('returns retest recommended for unavailable service', () => {
    const registry = loadRegistry();
    const result = retestService(registry, fullHealthMap('unavailable'), new Set(), 't-ocr');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('Retest recommended');
  });

  it('returns retest not applicable for non-invokable service', () => {
    const registry = loadRegistry();
    const result = retestService(registry, fullHealthMap('available'), new Set(), 'typhoon-translate');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('not invokable');
  });
});

// ---------------------------------------------------------------------------
// render.ts — safeReasonForState
// ---------------------------------------------------------------------------

describe('safeReasonForState', () => {
  it('returns safe reason for working', () => {
    expect(safeReasonForState('working', null)).toContain('invokable');
  });

  it('returns invokableStateReason for Catalogued — Not available yet', () => {
    expect(safeReasonForState('Catalogued — Not available yet', 'Catalogued — Not available yet')).toBe('Catalogued — Not available yet');
  });

  it('returns safe reason for disabled', () => {
    expect(safeReasonForState('disabled', null)).toContain('disabled');
  });

  it('returns safe reason for quarantined', () => {
    expect(safeReasonForState('quarantined', null)).toContain('quarantined');
  });
});

// ---------------------------------------------------------------------------
// render.ts — actionAvailabilityString
// ---------------------------------------------------------------------------

describe('actionAvailabilityString', () => {
  it('includes all available actions for working', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const s = actionAvailabilityString(projected);
    expect(s).toContain('browse');
    expect(s).toContain('search');
    expect(s).toContain('inspect');
    expect(s).toContain('disable');
    expect(s).not.toContain('enable');
  });

  it('includes enable for disabled', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', true);
    const s = actionAvailabilityString(projected);
    expect(s).toContain('enable');
    expect(s).not.toContain('disable');
  });
});

// ---------------------------------------------------------------------------
// render.ts — renderEntryRow
// ---------------------------------------------------------------------------

describe('renderEntryRow', () => {
  it('renders with stable identifier and canonical state in interactive mode', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const line = renderEntryRow(projected, 'interactive');
    expect(line).toContain('t-ocr');
    expect(line).toContain('working');
    expect(line).toContain('T-OCR');
    expect(line).toContain('ที-โอซีอาร์');
  });

  it('renders with stable identifier and canonical state in narrow mode', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const line = renderEntryRow(projected, 'narrow');
    expect(line).toContain('t-ocr');
    expect(line).toContain('working');
    expect(line).toContain('|');
  });

  it('renders with stable identifier and canonical state in headless mode', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const line = renderEntryRow(projected, 'headless');
    const parsed = JSON.parse(line);
    expect(parsed.id).toBe('t-ocr');
    expect(parsed.canonicalState).toBe('working');
  });

  it('renders with stable identifier and canonical state in linearized mode', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const line = renderEntryRow(projected, 'linearized');
    expect(line).toContain('t-ocr');
    expect(line).toContain('working');
  });

  it('renders with stable identifier and canonical state in redirected mode', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const line = renderEntryRow(projected, 'redirected');
    expect(line).toContain('t-ocr');
    expect(line).toContain('working');
  });

  it('renders non-invokable entry with Catalogued — Not available yet', () => {
    const registry = loadRegistry();
    const entry = registry.byId('typhoon-translate')!;
    const projected = projectEntry(entry, 'available', false);
    const line = renderEntryRow(projected, 'interactive');
    expect(line).toContain('Catalogued');
    expect(line).toContain('Not available');
  });

  it('renders disabled entry with disabled state', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', true);
    const line = renderEntryRow(projected, 'interactive');
    expect(line).toContain('disabled');
  });
});

// ---------------------------------------------------------------------------
// render.ts — renderEntryDetail
// ---------------------------------------------------------------------------

describe('renderEntryDetail', () => {
  it('includes identity, capabilities, supported inputs, limits, entitlement, evidence level', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const detail = renderEntryDetail(projected, 'interactive');
    expect(detail).toContain('t-ocr');
    expect(detail).toContain('T-OCR');
    expect(detail).toContain('thai-ocr');
    expect(detail).toContain('image/png');
    expect(detail).toContain('maxFileSize=20MB');
    expect(detail).toContain('AI-for-Thai API key required');
    expect(detail).toContain('deterministic');
    expect(detail).toContain('Manifest v1');
    expect(detail).toContain('Contract 1.0.0');
    expect(detail).toContain('Adapter 1.0.0');
    expect(detail).toContain('2026-07-17');
    expect(detail).toContain('available');
    expect(detail).toContain('true');
  });

  it('renders in headless mode as JSON', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const detail = renderEntryDetail(projected, 'headless');
    const parsed = JSON.parse(detail);
    expect(parsed.id).toBe('t-ocr');
    expect(parsed.canonicalState).toBe('working');
  });

  it('renders in narrow mode compactly', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const detail = renderEntryDetail(projected, 'narrow');
    expect(detail).toContain('t-ocr');
    expect(detail).toContain('working');
    expect(detail).toContain('|');
  });
});

// ---------------------------------------------------------------------------
// render.ts — renderCatalogRow
// ---------------------------------------------------------------------------

describe('renderCatalogRow', () => {
  it('returns structured row with id, canonicalState, safeReason, actionAvailability', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const row = renderCatalogRow(projected, 'interactive');
    expect(row.id).toBe('t-ocr');
    expect(row.canonicalState).toBe('working');
    expect(row.safeReason).toBeTruthy();
    expect(row.actionAvailability).toBeTruthy();
    expect(row.line).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// render.ts — renderCatalogList
// ---------------------------------------------------------------------------

describe('renderCatalogList', () => {
  it('renders the full catalog list', () => {
    const registry = loadRegistry();
    const projection = projectCatalog(registry.manifest, fullHealthMap('available'), new Set());
    const list = renderCatalogList(projection, 'interactive');
    expect(list).toContain('Capability Registry');
    expect(list).toContain('t-ocr');
    expect(list).toContain('typhoon-translate');
  });

  it('renders in headless mode as JSON', () => {
    const registry = loadRegistry();
    const projection = projectCatalog(registry.manifest, fullHealthMap('available'), new Set());
    const list = renderCatalogList(projection, 'headless');
    const parsed = JSON.parse(list);
    expect(parsed.manifestVersion).toBe(1);
    expect(parsed.entries.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// AC: Non-invokable entries cannot produce invocation proposal/adapter call/
// prepared payload/consent prompt
// ---------------------------------------------------------------------------

describe('AC: non-invokable entries are read-only', () => {
  it('inspectEntry for non-invokable returns read-only message', () => {
    const registry = loadRegistry();
    const result = inspectEntry(registry, fullHealthMap('available'), new Set(), 'typhoon-translate');
    expect(result.ok).toBe(true);
    expect(result.message).toContain('Inspection only');
    expect(result.message).toContain('No invocation proposal');
    expect(result.message).toContain('adapter call');
    expect(result.message).toContain('prepared payload');
    expect(result.message).toContain('consent prompt');
  });

  it('disableService fails for non-invokable entry', () => {
    const registry = loadRegistry();
    const result = disableService(registry, new Set(), 'typhoon-translate');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not invokable');
  });
});

// ---------------------------------------------------------------------------
// AC: Disabled/unavailable/unhealthy/quarantined → canonical state token +
// next allowed action; never mapped to working/available
// ---------------------------------------------------------------------------

describe('AC: non-working states never map to working/available', () => {
  it('disabled state is never working', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', true);
    expect(projected.canonicalState).not.toBe('working');
    expect(projected.canonicalState).not.toBe('available');
    expect(projected.canonicalState).toBe('disabled');
  });

  it('unavailable state is never working', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'unavailable', false);
    expect(projected.canonicalState).not.toBe('working');
    expect(projected.canonicalState).not.toBe('available');
    expect(projected.canonicalState).toBe('unavailable');
  });

  it('unhealthy state is never working', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'unhealthy', false);
    expect(projected.canonicalState).not.toBe('working');
    expect(projected.canonicalState).not.toBe('available');
    expect(projected.canonicalState).toBe('unhealthy');
  });

  it('quarantined state is never working', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'quarantined', false);
    expect(projected.canonicalState).not.toBe('working');
    expect(projected.canonicalState).not.toBe('available');
    expect(projected.canonicalState).toBe('quarantined');
  });

  it('Catalogued — Not available yet is never working', () => {
    const registry = loadRegistry();
    const entry = registry.byId('typhoon-translate')!;
    const projected = projectEntry(entry, 'available', false);
    expect(projected.canonicalState).not.toBe('working');
    expect(projected.canonicalState).not.toBe('available');
    expect(projected.canonicalState).toBe('Catalogued — Not available yet');
  });
});

// ---------------------------------------------------------------------------
// AC: Output parity — stable identifier + canonical state token + safe reason +
// machine-readable action availability across all modes
// ---------------------------------------------------------------------------

describe('AC: output parity across modes', () => {
  it('every mode includes stable identifier', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const modes: Array<Parameters<typeof renderEntryRow>[1]> = ['interactive', 'linearized', 'redirected', 'headless', 'narrow'];
    for (const mode of modes) {
      const line = renderEntryRow(projected, mode);
      if (mode === 'headless') {
        const parsed = JSON.parse(line);
        expect(parsed.id).toBe('t-ocr');
      } else {
        expect(line).toContain('t-ocr');
      }
    }
  });

  it('every mode includes canonical state token', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const modes: Array<Parameters<typeof renderEntryRow>[1]> = ['interactive', 'linearized', 'redirected', 'headless', 'narrow'];
    for (const mode of modes) {
      const line = renderEntryRow(projected, mode);
      if (mode === 'headless') {
        const parsed = JSON.parse(line);
        expect(parsed.canonicalState).toBe('working');
      } else {
        expect(line).toContain('working');
      }
    }
  });

  it('every mode includes safe reason', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const modes: Array<Parameters<typeof renderEntryRow>[1]> = ['interactive', 'linearized', 'redirected', 'headless', 'narrow'];
    for (const mode of modes) {
      const line = renderEntryRow(projected, mode);
      if (mode === 'headless') {
        const parsed = JSON.parse(line);
        expect(parsed.safeReason).toBeTruthy();
      } else if (mode === 'narrow') {
        // AC #5: narrow output must retain the safe reason (not just be non-empty).
        const reason = safeReasonForState(projected.canonicalState, projected.invokableStateReason);
        expect(line).toContain(reason);
      } else {
        expect(line).toContain('invokable');
      }
    }
  });

  it('every mode includes machine-readable action availability', () => {
    const registry = loadRegistry();
    const entry = registry.byId('t-ocr')!;
    const projected = projectEntry(entry, 'available', false);
    const modes: Array<Parameters<typeof renderEntryRow>[1]> = ['interactive', 'linearized', 'redirected', 'headless', 'narrow'];
    for (const mode of modes) {
      const line = renderEntryRow(projected, mode);
      if (mode === 'headless') {
        const parsed = JSON.parse(line);
        expect(parsed.actionAvailability).toBeTruthy();
      } else {
        expect(line).toContain('browse');
      }
    }
  });
});
