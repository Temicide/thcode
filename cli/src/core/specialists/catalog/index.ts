// Catalog barrel export (Story 4.2).

export {
  type CatalogEntryCanonicalState,
  type CatalogEntryActionAvailability,
  type CatalogEntryProjection,
  type CatalogProjection,
  type HealthMap,
  type DisabledSet,
  computeCanonicalState,
  computeNextAllowedAction,
  computeActionAvailability,
  projectEntry,
  projectCatalog,
} from './projection.js';

export {
  type CatalogRenderMode,
  type CatalogRowRender,
  safeReasonForState,
  actionAvailabilityString,
  renderEntryRow,
  renderEntryDetail,
  renderCatalogList,
  renderCatalogRow,
} from './render.js';

export {
  type CatalogControlResult,
  type CatalogSearchResult,
  type CatalogDiagnosis,
  browseCatalog,
  searchCatalog,
  inspectEntry,
  enableService,
  disableService,
  diagnoseService,
  retestService,
} from './controls.js';
