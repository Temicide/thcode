// Specialist prompt router (Story 4.5).
// Routes a natural-language prompt to a typed RoutingDecision per the
// precedence order: registry-unavailable -> headless-blocked -> compute matches
// -> direct-id -> no-signal -> single-clear -> ambiguous -> refused.
// Pure function — no side effects, no Date.now, no Math.random.

import { detectLanguage, promptHash } from '../../agent/intent.js';
import type { CapabilityRegistry } from '../registry/registry.js';
import type { CapabilityRegistryEntry } from '../registry/types.js';
import { matchPromptToServices, MATCHER_VERSION, AMBIGUITY_DELTA } from './matcher.js';
import { buildTaskRelevantSchema } from './schema.js';
import type {
  RoutingDecision,
  RoutingOptions,
  RoutingProvenance,
  ProposeDecision,
  ClarifyDecision,
  RefusedDecision,
  BlockedDecision,
  NoneDecision,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a RoutingProvenance for a decision. */
function buildProvenance(
  prompt: string,
  matchedTerms: Record<string, readonly string[]>,
  clock: () => string,
): RoutingProvenance {
  return {
    promptHash: promptHash(prompt),
    matchedTerms,
    matcherVersion: MATCHER_VERSION,
    createdAt: clock(),
  };
}

/** Build a plain-language rationale in the prompt's language style. */
function buildRationale(
  prompt: string,
  entry: CapabilityRegistryEntry,
  matchedTerms: readonly string[],
): string {
  const lang = detectLanguage(prompt);

  // Pick the best matched term for the rationale.
  const bestTerm = matchedTerms.length > 0
    ? matchedTerms[0].replace(/^(?:id:|input:|name:)/, '')
    : '';

  switch (lang) {
    case 'thai':
      return `บริการ ${entry.nameThai} (${entry.nameEnglish}) ตรงกับความต้องการของคุณ${bestTerm ? `: "${bestTerm}"` : ''}`;
    case 'mixed':
      // Mixed-language users get both names: Thai first, English in parens.
      return `Service ${entry.nameThai} (${entry.nameEnglish}) matches your request${bestTerm ? `: "${bestTerm}"` : ''}`;
    case 'english':
    default:
      return `Service ${entry.nameEnglish} matches your request${bestTerm ? `: "${bestTerm}"` : ''}`;
  }
}

/** Build a clarification question in the prompt's language style. */
function buildClarificationQuestion(
  prompt: string,
  candidates: readonly string[],
  entries: readonly CapabilityRegistryEntry[],
): string {
  const lang = detectLanguage(prompt);
  const names = candidates.map((id) => {
    const e = entries.find((en) => en.id === id);
    return e ? `${e.nameEnglish} (${e.nameThai})` : id;
  });

  switch (lang) {
    case 'thai':
      return `คุณต้องการใช้บริการใด? ${names.join(', ')} — โปรดระบุให้ชัดเจน`;
    case 'mixed':
      return `Which service do you need? ${names.join(', ')} — โปรดระบุให้ชัดเจน`;
    case 'english':
    default:
      return `Which service do you need? ${names.join(', ')} — please specify clearly`;
  }
}

/** Check if a prompt has any Specialist signal (matches any entry's terms). */
function hasSpecialistSignal(
  prompt: string,
  invokableEntries: readonly CapabilityRegistryEntry[],
  nonInvokableEntries: readonly CapabilityRegistryEntry[],
): boolean {
  const promptLower = prompt.toLowerCase();
  const allEntries = [...invokableEntries, ...nonInvokableEntries];
  for (const entry of allEntries) {
    // Check id mention
    if (promptLower.includes(entry.id.toLowerCase())) return true;
    // Check searchTerms
    for (const term of entry.searchTerms) {
      if (promptLower.includes(term.toLowerCase())) return true;
    }
    // Check capabilities
    for (const cap of entry.capabilities) {
      if (promptLower.includes(cap.toLowerCase())) return true;
    }
    // Check names
    if (promptLower.includes(entry.nameThai.toLowerCase())) return true;
    if (promptLower.includes(entry.nameEnglish.toLowerCase())) return true;
    // Check supportedInputs
    for (const input of entry.supportedInputs) {
      if (promptLower.includes(input.toLowerCase())) return true;
    }
  }
  return false;
}

/** Check if a prompt matches any non-invokable entry's terms specifically. */
function hasNonInvokableSignal(
  prompt: string,
  nonInvokableEntries: readonly CapabilityRegistryEntry[],
): boolean {
  const promptLower = prompt.toLowerCase();
  for (const entry of nonInvokableEntries) {
    if (promptLower.includes(entry.id.toLowerCase())) return true;
    for (const term of entry.searchTerms) {
      if (promptLower.includes(term.toLowerCase())) return true;
    }
    for (const cap of entry.capabilities) {
      if (promptLower.includes(cap.toLowerCase())) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Route a natural-language prompt to a typed RoutingDecision.
 *
 * Precedence order (implemented exactly):
 *   (a) Registry not loaded -> blocked (registry-unavailable)
 *   (b) Compute matches over invokable entries; track non-invokable signal
 *   (c) Headless + Specialist signal present -> blocked (headless-blocked)
 *   (d) Direct id mention -> propose if available, else blocked
 *   (e) No Specialist signal -> none
 *   (f) Single clear top match -> propose if available, else blocked
 *   (g) Tie within AMBIGUITY_DELTA among >=2 invokable matches -> clarify
 *   (h) Material intent ambiguity + Specialist signal -> clarify
 *   (i) Specialist signal present but zero invokable matches -> refused
 *
 * @param prompt - The original user prompt (preserved verbatim).
 * @param registry - The loaded CapabilityRegistry.
 * @param options - Routing options (isTTY, healthMap, disabledSet, intentAmbiguity).
 * @param clock - Injectable clock function for createdAt timestamps.
 * @returns A typed RoutingDecision.
 */
export function routeSpecialistPrompt(
  prompt: string,
  registry: CapabilityRegistry,
  options: RoutingOptions,
  clock: () => string,
): RoutingDecision {
  // (a) Registry not loaded -> blocked (registry-unavailable)
  // No service health state applies when the registry itself is unavailable,
  // so no stateToken is emitted (canonical tokens only — never 'fail-closed').
  if (!registry.ok) {
    const evidence = registry.evidence;
    const blocked: BlockedDecision = {
      kind: 'blocked',
      cause: 'registry-unavailable',
      nextAction: 'ensure the capability registry manifest is available and retry',
      provenance: {
        ...buildProvenance(prompt, {}, clock),
        matchedTerms: { _registry: [`fail-closed: ${evidence?.detail ?? 'unknown error'}`] },
      },
    };
    return blocked;
  }

  const invokableEntries = registry.invokable();
  const nonInvokableEntries = registry.nonInvokable();

  // (b) Compute matches over invokable entries
  const matches = matchPromptToServices(prompt, invokableEntries);

  // Also check if the prompt matches any non-invokable entry's terms
  const nonInvokableHit = hasNonInvokableSignal(prompt, nonInvokableEntries);

  // Determine if there is any Specialist signal
  const signalPresent = matches.length > 0 || nonInvokableHit ||
    hasSpecialistSignal(prompt, invokableEntries, nonInvokableEntries);

  // Build matchedTerms for provenance
  const matchedTerms: Record<string, readonly string[]> = {};
  for (const m of matches) {
    matchedTerms[m.serviceId] = m.matchedTerms;
  }

  // (c) Headless + Specialist signal present -> blocked (headless-blocked)
  if (signalPresent && !options.isTTY) {
    const provenance = buildProvenance(prompt, matchedTerms, clock);
    const blocked: BlockedDecision = {
      kind: 'blocked',
      cause: 'headless-blocked',
      nextAction: 'rerun interactively',
      provenance,
    };
    return blocked;
  }

  // (d) Direct id mention: check if prompt explicitly names an invokable service id
  const promptLower = prompt.toLowerCase();
  for (const entry of invokableEntries) {
    const idLower = entry.id.toLowerCase();
    // Check for direct id mention with word boundary
    const directIdRe = new RegExp(`\\b${escapeRegex(idLower)}\\b`);
    if (directIdRe.test(promptLower)) {
      // Direct id match takes precedence
      const healthState = options.healthMap[entry.id] ?? 'unconfigured';
      const disabled = options.disabledSet.has(entry.id);

      if (healthState === 'available' && !disabled) {
        const schema = buildTaskRelevantSchema(entry);
        const rationale = buildRationale(prompt, entry, [`id:${entry.id}`]);
        const provenance = buildProvenance(prompt, { [entry.id]: [`id:${entry.id}`] }, clock);
        const propose: ProposeDecision = {
          kind: 'propose',
          serviceId: entry.id,
          serviceName: entry.nameEnglish,
          rationale,
          schema,
          provenance,
        };
        return propose;
      }

      // Service not available or disabled -> blocked
      const stateToken = disabled ? 'disabled' : healthState;
      const nextAction = disabled ? 'enable' : (healthState === 'unavailable' || healthState === 'quarantined' ? 'retest' : 'recover');
      const provenance = buildProvenance(prompt, { [entry.id]: [`id:${entry.id}`] }, clock);
      const blocked: BlockedDecision = {
        kind: 'blocked',
        cause: 'service-unavailable',
        stateToken,
        nextAction,
        provenance,
      };
      return blocked;
    }
  }

  // (e) No Specialist signal at all -> none
  if (!signalPresent) {
    const provenance = buildProvenance(prompt, {}, clock);
    const none: NoneDecision = {
      kind: 'none',
      provenance,
    };
    return none;
  }

  // (f) No invokable matches at all -> refused
  if (matches.length === 0) {
    const provenance = buildProvenance(prompt, matchedTerms, clock);
    if (nonInvokableHit) {
      const refused: RefusedDecision = {
        kind: 'refused',
        reason: 'Catalogued — Not available yet',
        detail: 'The requested capability matches a catalogued service that is not yet available for invocation.',
        provenance,
      };
      return refused;
    }
    const refused: RefusedDecision = {
      kind: 'refused',
      reason: 'unsupported',
      detail: 'No Specialist service can satisfy this request.',
      provenance,
    };
    return refused;
  }

  // (h) Material intent ambiguity + Specialist signal present -> clarify
  if (options.intentAmbiguity === 'material' && signalPresent) {
    const candidates = matches.map((m) => m.serviceId);
    const question = buildClarificationQuestion(prompt, candidates, invokableEntries);
    const provenance = buildProvenance(prompt, matchedTerms, clock);
    const clarify: ClarifyDecision = {
      kind: 'clarify',
      question,
      candidates,
      provenance,
    };
    return clarify;
  }

  // (g) Tie within AMBIGUITY_DELTA among >=2 invokable matches -> clarify
  if (matches.length >= 2) {
    const top = matches[0];
    const runnerUp = matches[1];
    if (top.score <= runnerUp.score + AMBIGUITY_DELTA) {
      const candidates = matches.map((m) => m.serviceId);
      const question = buildClarificationQuestion(prompt, candidates, invokableEntries);
      const provenance = buildProvenance(prompt, matchedTerms, clock);
      const clarify: ClarifyDecision = {
        kind: 'clarify',
        question,
        candidates,
        provenance,
      };
      return clarify;
    }
  }

  // (f) Single clear top match
  const topMatch = matches[0];
  const topEntry = invokableEntries.find((e) => e.id === topMatch.serviceId)!;
  const healthState = options.healthMap[topEntry.id] ?? 'unconfigured';
  const disabled = options.disabledSet.has(topEntry.id);

  if (healthState === 'available' && !disabled) {
    const schema = buildTaskRelevantSchema(topEntry);
    const rationale = buildRationale(prompt, topEntry, topMatch.matchedTerms);
    const provenance = buildProvenance(prompt, matchedTerms, clock);
    const propose: ProposeDecision = {
      kind: 'propose',
      serviceId: topEntry.id,
      serviceName: topEntry.nameEnglish,
      rationale,
      schema,
      provenance,
    };
    return propose;
  }

  // Service not available or disabled -> blocked
  const stateToken = disabled ? 'disabled' : healthState;
  const nextAction = disabled ? 'enable' : (healthState === 'unavailable' || healthState === 'quarantined' ? 'retest' : 'recover');
  const provenance = buildProvenance(prompt, matchedTerms, clock);
  const blocked: BlockedDecision = {
    kind: 'blocked',
    cause: 'service-unavailable',
    stateToken,
    nextAction,
    provenance,
  };
  return blocked;
}

/** Escape regex special characters. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
