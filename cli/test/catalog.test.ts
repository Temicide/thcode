import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CatalogManifestError,
  loadCatalogManifest,
  parseManifest,
  ToolCatalog,
} from '../src/core/catalog/loader.js';

const MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'catalog-manifest.json',
);

describe('catalog manifest loading', () => {
  it('loads the checked-in manifest', () => {
    const m = loadCatalogManifest(MANIFEST_PATH);
    expect(m.manifestVersion).toBe(1);
    expect(m.observationDate).toBeTruthy();
    expect(m.services.length).toBe(4);
  });

  it('seeds the four Phase-1 Verification Quartet services as catalogued', () => {
    const catalog = new ToolCatalog(loadCatalogManifest(MANIFEST_PATH));
    const expected: Array<[string, string]> = [
      ['t-ocr', 'vision'],
      ['speech-to-text', 'conversation'],
      ['extract-address', 'other'],
      ['named-entity-recognition', 'language'],
    ];
    for (const [id, category] of expected) {
      const entry = catalog.byId(id);
      expect(entry, `missing service ${id}`).toBeDefined();
      expect(entry!.category).toBe(category);
      expect(entry!.supportLevel).toBe('catalogued');
    }
  });

  it('has Category Coverage across all four AI for Thai categories (ADR 0011)', () => {
    const catalog = new ToolCatalog(loadCatalogManifest(MANIFEST_PATH));
    expect(catalog.hasCategoryCoverage()).toBe(true);
  });

  it('typed accessors filter by category and support level', () => {
    const catalog = new ToolCatalog(loadCatalogManifest(MANIFEST_PATH));
    expect(catalog.byCategory('vision').map((s) => s.id)).toEqual(['t-ocr']);
    expect(catalog.bySupportLevel('catalogued').length).toBe(4);
    expect(catalog.bySupportLevel('demo-certified').length).toBe(0);
  });
});

describe('catalog manifest validation', () => {
  const valid = {
    manifestVersion: 1,
    observationDate: '2026-07-12',
    source: 'test',
    services: [
      {
        id: 'x',
        upstreamName: 'X',
        category: 'language',
        modality: 'text',
        endpoint: 'https://example.invalid',
        supportLevel: 'catalogued',
      },
    ],
  };

  it('accepts a valid manifest', () => {
    expect(() => parseManifest(JSON.stringify(valid))).not.toThrow();
  });

  it('rejects invalid JSON', () => {
    expect(() => parseManifest('{nope')).toThrow(CatalogManifestError);
  });

  it('rejects a missing manifestVersion', () => {
    const { manifestVersion: _drop, ...rest } = valid;
    expect(() => parseManifest(JSON.stringify(rest))).toThrow(/manifestVersion/);
  });

  it('rejects an invalid category', () => {
    const bad = { ...valid, services: [{ ...valid.services[0], category: 'magic' }] };
    expect(() => parseManifest(JSON.stringify(bad))).toThrow(/category/);
  });

  it('rejects an invalid support level', () => {
    const bad = { ...valid, services: [{ ...valid.services[0], supportLevel: 'supported' }] };
    expect(() => parseManifest(JSON.stringify(bad))).toThrow(/supportLevel/);
  });

  it('rejects duplicate service ids', () => {
    const bad = { ...valid, services: [valid.services[0], valid.services[0]] };
    expect(() => parseManifest(JSON.stringify(bad))).toThrow(/duplicate/);
  });
});
