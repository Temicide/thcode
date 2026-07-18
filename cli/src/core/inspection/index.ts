// Inspection module barrel export (Story 3.4).

export { inspectList } from './list.js';
export { inspectRead } from './read.js';
export { inspectSearch } from './search.js';
export { evaluateInspectionPolicy, policyDecisionToRefusal } from './policy.js';
export type {
  InspectionRequest,
  InspectionKind,
  InspectionResult,
  InspectionSuccess,
  InspectionRefusal,
  InspectionRefusalKind,
  InspectionLimits,
  InspectionFsProbe,
  EntryMetadata,
  ListResult,
  ReadResult,
  SearchResult,
  SearchMatch,
  ListRequest,
  ReadRequest,
  SearchRequest,
  DeniedRefusal,
  InaccessibleRefusal,
  ConflictRefusal,
  EnforcementUnverifiedRefusal,
  OverLimitRefusal,
  BinaryRefusedRefusal,
  MalformedUtf8Refusal,
} from './types.js';
export { DEFAULT_INSPECTION_LIMITS, defaultInspectionFsProbe } from './types.js';
