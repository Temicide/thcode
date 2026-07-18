// Specialist services barrel (Story 4.10–4.13). Aggregates all per-service
// handlers and provides a default handler list for the SharedSpecialistAdapter.

import { TocrSpecialistHandler } from './tocr/index.js';
import type { SpecialistServiceHandler } from '../adapter/types.js';

/**
 * Return the default set of registered Specialist service handlers.
 * Extended by Stories 4.11–4.13 as new services are integrated.
 */
export function defaultSpecialistHandlers(): readonly SpecialistServiceHandler[] {
  return [new TocrSpecialistHandler()];
}

export { TocrSpecialistHandler } from './tocr/index.js';
