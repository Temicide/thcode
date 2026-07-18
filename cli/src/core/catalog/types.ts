// Registry-driven AI for Thai tool catalog (ADR 0011). The manifest is a
// versioned, checked-in snapshot — NOT live discovery. Support level is
// explicit so the CLI never describes a catalogued-only service as callable.

export type ServiceCategory = 'language' | 'vision' | 'conversation' | 'other';

export type ServiceModality = 'text' | 'image' | 'audio' | 'video' | 'document';

/** Support level ladder (ADR 0011). Only 'integrated'+ may be advertised callable. */
export type SupportLevel = 'catalogued' | 'integrated' | 'verified' | 'demo-certified';

export const SUPPORT_LEVELS: readonly SupportLevel[] = [
  'catalogued',
  'integrated',
  'verified',
  'demo-certified',
];

export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  'language',
  'vision',
  'conversation',
  'other',
];

export interface CatalogServiceEntry {
  readonly id: string;
  readonly upstreamName: string;
  readonly category: ServiceCategory;
  readonly modality: ServiceModality;
  readonly endpoint: string;
  readonly supportLevel: SupportLevel;
  readonly description?: string;
  readonly searchTerms?: readonly string[];
}

export interface CatalogManifest {
  readonly manifestVersion: number;
  readonly observationDate: string;
  readonly source: string;
  readonly note?: string;
  readonly services: readonly CatalogServiceEntry[];
}
