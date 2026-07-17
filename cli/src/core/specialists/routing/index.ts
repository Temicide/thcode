// Specialist routing barrel export (Story 4.5).

export {
  type RoutingDecision,
  type ProposeDecision,
  type ClarifyDecision,
  type RefusedDecision,
  type BlockedDecision,
  type NoneDecision,
  type TaskRelevantSchema,
  type TransportPolicySummary,
  type RoutingProvenance,
  type RoutingOptions,
} from './types.js';

export {
  matchPromptToServices,
  MATCHER_VERSION,
  AMBIGUITY_DELTA,
  type ServiceMatch,
} from './matcher.js';

export {
  buildTaskRelevantSchema,
} from './schema.js';

export {
  routeSpecialistPrompt,
} from './router.js';
