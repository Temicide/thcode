import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SERVICE_CATEGORIES,
  SUPPORT_LEVELS,
  type CatalogManifest,
  type CatalogServiceEntry,
  type ServiceCategory,
  type SupportLevel,
} from './types.js';

export class CatalogManifestError extends Error {
  constructor(message: string) {
    super(`Catalog manifest invalid: ${message}`);
    this.name = 'CatalogManifestError';
  }
}

const VALID_MODALITIES = new Set(['text', 'image', 'audio', 'video', 'document']);

/** Validate and normalize a parsed manifest object. Throws on any bad entry. */
export function validateManifest(raw: unknown): CatalogManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new CatalogManifestError('root is not an object');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.manifestVersion !== 'number') {
    throw new CatalogManifestError('manifestVersion must be a number');
  }
  if (typeof obj.observationDate !== 'string') {
    throw new CatalogManifestError('observationDate must be a string');
  }
  if (typeof obj.source !== 'string') {
    throw new CatalogManifestError('source must be a string');
  }
  if (!Array.isArray(obj.services)) {
    throw new CatalogManifestError('services must be an array');
  }

  const seen = new Set<string>();
  const services: CatalogServiceEntry[] = obj.services.map((s, i) => {
    if (typeof s !== 'object' || s === null) {
      throw new CatalogManifestError(`services[${i}] is not an object`);
    }
    const e = s as Record<string, unknown>;
    const id = e.id;
    if (typeof id !== 'string' || !id) {
      throw new CatalogManifestError(`services[${i}].id must be a non-empty string`);
    }
    if (seen.has(id)) throw new CatalogManifestError(`duplicate service id "${id}"`);
    seen.add(id);
    if (typeof e.upstreamName !== 'string') {
      throw new CatalogManifestError(`services[${i}].upstreamName must be a string`);
    }
    if (!SERVICE_CATEGORIES.includes(e.category as ServiceCategory)) {
      throw new CatalogManifestError(`services[${i}].category "${String(e.category)}" is invalid`);
    }
    if (!VALID_MODALITIES.has(e.modality as string)) {
      throw new CatalogManifestError(`services[${i}].modality "${String(e.modality)}" is invalid`);
    }
    if (typeof e.endpoint !== 'string') {
      throw new CatalogManifestError(`services[${i}].endpoint must be a string`);
    }
    if (!SUPPORT_LEVELS.includes(e.supportLevel as SupportLevel)) {
      throw new CatalogManifestError(`services[${i}].supportLevel "${String(e.supportLevel)}" is invalid`);
    }
    return {
      id,
      upstreamName: e.upstreamName,
      category: e.category as ServiceCategory,
      modality: e.modality as CatalogServiceEntry['modality'],
      endpoint: e.endpoint,
      supportLevel: e.supportLevel as SupportLevel,
      description: typeof e.description === 'string' ? e.description : undefined,
      searchTerms: Array.isArray(e.searchTerms) ? (e.searchTerms as string[]) : undefined,
    };
  });

  return {
    manifestVersion: obj.manifestVersion,
    observationDate: obj.observationDate,
    source: obj.source,
    note: typeof obj.note === 'string' ? obj.note : undefined,
    services,
  };
}

/** Parse + validate a manifest from a JSON string. */
export function parseManifest(json: string): CatalogManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new CatalogManifestError(`not valid JSON: ${(e as Error).message}`);
  }
  return validateManifest(raw);
}

/** Default checked-in manifest path (repo root: cli/catalog-manifest.json). */
export function defaultManifestPath(): string {
  // loader.js lives at dist/core/catalog/loader.js → up 3 to package root.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', '..', 'catalog-manifest.json');
}

/** Load the checked-in manifest (or a supplied path). */
export function loadCatalogManifest(manifestPath: string = defaultManifestPath()): CatalogManifest {
  return parseManifest(readFileSync(manifestPath, 'utf8'));
}

/** Typed accessors over a loaded manifest. */
export class ToolCatalog {
  constructor(private readonly manifest: CatalogManifest) {}

  static load(manifestPath?: string): ToolCatalog {
    return new ToolCatalog(loadCatalogManifest(manifestPath));
  }

  get version(): number {
    return this.manifest.manifestVersion;
  }
  get observationDate(): string {
    return this.manifest.observationDate;
  }
  all(): readonly CatalogServiceEntry[] {
    return this.manifest.services;
  }
  byId(id: string): CatalogServiceEntry | undefined {
    return this.manifest.services.find((s) => s.id === id);
  }
  byCategory(category: ServiceCategory): CatalogServiceEntry[] {
    return this.manifest.services.filter((s) => s.category === category);
  }
  bySupportLevel(level: SupportLevel): CatalogServiceEntry[] {
    return this.manifest.services.filter((s) => s.supportLevel === level);
  }
  /** True if every AI for Thai category is represented (ADR 0011 Category Coverage). */
  hasCategoryCoverage(): boolean {
    return SERVICE_CATEGORIES.every((c) => this.byCategory(c).length > 0);
  }
}
