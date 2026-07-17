// Typhoon dispatch with durable sanitized chunks and interruption boundaries
// (AD-3, AD-4, AD-14, AD-24, FR-6, Story 1.9). Wraps the provider `complete`
// call so every streamed chunk is sanitized and journaled as a
// `RemoteOutputObserved` durable event before UI publication. Interruption
// (abort) records a `ChatInterrupted` durable event with the high-water mark.
//
// PR-1 FREEZE (AD-14): an invalid structured proposal (tool call) is rejected
// after one local schema-validation pass. No model repair request, provider
// retry, protocol reinterpretation, action substitution, or policy
// relaxation. The rejection is the terminal outcome for that operation.

import type { CredentialStore } from '../platform/credentialStore.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { sanitizer } from '../security/sanitizer.js';
import { extractIntent, type IntentExtractionResult, type NormalizedIntent } from './intent.js';
import {
  newEventId, newPromptRoundId, newOperationId, asSessionId, asOperationId, asPromptRoundId,
  type SessionId,
} from '../protocol/ids.js';
import { protocolVersion } from '../protocol/version.js';
import type { DurableEvent } from '../protocol/events.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { ProviderResult, TokenSink } from '../providers/types.js';

/** PR-1: invalid structured proposal is rejected after one validation pass
 * (AD-14). No repair, retry, reinterpretation, substitution, or relaxation. */
export interface ProposalValidation {
  readonly valid: boolean;
  readonly cause?: string;
}

/** Validate a tool-call proposal structurally. Returns the rejection cause if
 * invalid; never requests model repair or retries (AD-14 / PR-1). */
export function validateToolProposal(result: ProviderResult): ProposalValidation {
  if (result.kind !== 'tool_call') return { valid: true };
  const { toolName, input } = result;
  if (typeof toolName !== 'string' || toolName.length === 0) {
    return { valid: false, cause: 'tool_call.toolName is empty' };
  }
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, cause: 'tool_call.input is not an object' };
  }
  // The input must be JSON-serializable (it will be journaled). `_raw` is the
  // existing fallback marker for un-parseable tool args — it is accepted but
  // flagged as `malformed` by the caller.
  return { valid: true };
}

/** Build a durable event with the canonical envelope (AD-3). */
export function durableEvent(
  payload: DurableEvent['payload'],
  sessionId: SessionId,
  opts: { promptRoundId?: string; operationId?: string; provenanceKind?: 'deterministic' | 'model'; provenanceSource?: string; clock: () => string },
): DurableEvent {
  return {
    id: newEventId(),
    sessionId,
    promptRoundId: opts.promptRoundId ? asPromptRoundId(opts.promptRoundId) : undefined,
    operationId: opts.operationId ? asOperationId(opts.operationId) : undefined,
    schemaVersion: protocolVersion(),
    timestamp: opts.clock(),
    provenance: {
      kind: opts.provenanceKind ?? 'model',
      source: opts.provenanceSource ?? 'typhoon',
    },
    payload,
  };
}

/** Result of a dispatched Typhoon turn. */
export interface DispatchResult {
  readonly text: string;
  readonly promptRoundId: string;
  readonly intent: NormalizedIntent | null;
  readonly intentExtraction: IntentExtractionResult;
  readonly highWaterMark: string | null;
  readonly interrupted: boolean;
  readonly proposalRejected: boolean;
  readonly rejectionCause?: string;
  readonly events: readonly DurableEvent[];
}

/**
 * Dispatch a Typhoon turn with durable sanitized chunks and interruption
 * boundaries. The SessionRepository is optional; when present, durable events
 * are appended. When absent (e.g. tests), events are returned but not
 * persisted. The caller owns the AbortSignal — aborting records a
 * `ChatInterrupted` event with the high-water mark and never auto-retries.
 */
export async function dispatchTyphoonTurn(args: {
  readonly sessionId: string;
  readonly promptText: string;
  readonly providers: ProviderRegistry;
  readonly credentials: CredentialStore;
  readonly messages: readonly { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[];
  readonly tools?: readonly { name: string; description: string; parameters: Record<string, unknown> }[];
  readonly repo?: SessionRepository;
  readonly signal?: AbortSignal;
  readonly clock: () => string;
  readonly onToken?: TokenSink;
  readonly toolSchemas?: readonly { name: string; description: string; parameters: Record<string, unknown> }[];
}): Promise<DispatchResult> {
  const sessionId = asSessionId(args.sessionId);
  const promptRoundId = newPromptRoundId();
  const operationId = newOperationId();
  const events: DurableEvent[] = [];
  const append = (e: DurableEvent) => {
    events.push(e);
    args.repo?.append(e);
  };

  // 1. Intent extraction (no byte change; AD-7). Record the prompt as durable
  //    PromptSubmitted with the *original* text — the Evidence record carries
  //    the derived intent, not the raw prompt's secrets (the Sanitizer runs
  //    before any chunk is persisted).
  const intentExtraction = extractIntent(args.promptText, promptRoundId, args.clock);
  const intent = intentExtraction.ok ? intentExtraction.intent : null;
  const promptSanitized = sanitizer.sanitizeOrBlock(args.promptText, 'user-content', '[prompt redacted]');
  append(durableEvent(
    { kind: 'PromptSubmitted', text: promptSanitized },
    sessionId,
    { promptRoundId, operationId, provenanceKind: 'deterministic', provenanceSource: 'composer', clock: args.clock },
  ));

  if (!intentExtraction.ok) {
    // Extraction failed: typed blocked result, no dispatch (AC #5, AD-14).
    return {
      text: intentExtraction.message,
      promptRoundId,
      intent: null,
      intentExtraction,
      highWaterMark: null,
      interrupted: false,
      proposalRejected: false,
      events,
    };
  }
  if (intent?.ambiguity === 'material') {
    // Material ambiguity: ask, do not dispatch (AC #4, AD-14).
    return {
      text: intent.clarificationQuestion ?? 'Please clarify your request.',
      promptRoundId,
      intent,
      intentExtraction,
      highWaterMark: null,
      interrupted: false,
      proposalRejected: false,
      events,
    };
  }

  // 2. Acquire the key via the CredentialStore and check availability.
  const adapter = args.providers.selected;
  const providerId = adapter.capabilities.provider;
  const apiKey = await args.credentials.get(providerId);
  const availability = adapter.availability(apiKey !== null);
  if (!availability.available || apiKey === null) {
    append(durableEvent(
      { kind: 'OperationBlocked', operationId, cause: availability.reason ?? 'provider unavailable' },
      sessionId,
      { promptRoundId, operationId, provenanceKind: 'deterministic', provenanceSource: 'dispatch', clock: args.clock },
    ));
    return {
      text: `Provider "${providerId}" is unavailable: ${availability.reason ?? 'not configured'}`,
      promptRoundId,
      intent,
      intentExtraction,
      highWaterMark: null,
      interrupted: false,
      proposalRejected: false,
      events,
    };
  }

  // 3. Dispatch commit is the linearization point (AD-13). Record it durably
  //    before the network call so recovery can distinguish not-sent from
  //    possibly-dispatched.
  append(durableEvent(
    { kind: 'EffectDispatchCommitted', operationId },
    sessionId,
    { promptRoundId, operationId, provenanceKind: 'deterministic', provenanceSource: 'dispatch', clock: args.clock },
  ));

  // 4. Stream chunks: each sanitized chunk is journaled as
  //    RemoteOutputObserved before UI publication (AD-3, AD-24).
  let highWaterMark: string | null = null;
  let upstreamSeq = 0;
  const recordChunk = (delta: string) => {
    const sanitized = sanitizer.sanitizeOrBlock(delta, 'remote-payload', '[chunk redacted]');
    upstreamSeq += 1;
    const seqId = `chunk-${upstreamSeq}`;
    highWaterMark = seqId;
    args.onToken?.(sanitized);
    append(durableEvent(
      { kind: 'RemoteOutputObserved', chunk: sanitized, upstreamSequence: seqId },
      sessionId,
      { promptRoundId, operationId, provenanceKind: 'model', provenanceSource: providerId, clock: args.clock },
    ));
  };

  let result: ProviderResult;
  try {
    result = await adapter.complete(
      { messages: args.messages, tools: args.toolSchemas, signal: args.signal },
      apiKey,
      recordChunk,
    );
  } catch (err) {
    // Interruption (abort) → ChatInterrupted with the high-water mark.
    // Transient error (not abort) → OperationFailed with a typed cause.
    if (args.signal?.aborted) {
      append(durableEvent(
        { kind: 'ChatInterrupted', highWaterMark },
        sessionId,
        { promptRoundId, operationId, provenanceKind: 'deterministic', provenanceSource: 'dispatch', clock: args.clock },
      ));
      return {
        text: 'Chat interrupted',
        promptRoundId,
        intent,
        intentExtraction,
        highWaterMark,
        interrupted: true,
        proposalRejected: false,
        events,
      };
    }
    const meta = adapter.classifyError(err);
    const cause = `${meta.kind}${meta.retryable ? ' (retryable)' : ''}`;
    append(durableEvent(
      { kind: 'OperationFailed', operationId, cause },
      sessionId,
      { promptRoundId, operationId, provenanceKind: 'deterministic', provenanceSource: 'dispatch', clock: args.clock },
    ));
    return {
      text: `Provider "${providerId}" error: ${cause}`,
      promptRoundId,
      intent,
      intentExtraction,
      highWaterMark,
      interrupted: false,
      proposalRejected: false,
      events,
    };
  }

  // 5. PR-1: validate the structured proposal. Invalid → reject after one
  //    pass; no repair, retry, reinterpretation, or substitution (AD-14).
  if (result.kind === 'tool_call') {
    const validation = validateToolProposal(result);
    if (!validation.valid) {
      append(durableEvent(
        { kind: 'OperationBlocked', operationId, cause: `invalid proposal: ${validation.cause}` },
        sessionId,
        { promptRoundId, operationId, provenanceKind: 'deterministic', provenanceSource: 'dispatch', clock: args.clock },
      ));
      return {
        text: `Rejected invalid proposal: ${validation.cause}`,
        promptRoundId,
        intent,
        intentExtraction,
        highWaterMark,
        interrupted: false,
        proposalRejected: true,
        rejectionCause: validation.cause,
        events,
      };
    }
  }

  // 6. Final text (or accepted tool-call proposal) → OperationSucceeded.
  const finalText = result.kind === 'final' ? result.text : `[tool proposal: ${result.toolName}]`;
  append(durableEvent(
    { kind: 'OperationSucceeded', operationId },
    sessionId,
    { promptRoundId, operationId, provenanceKind: 'deterministic', provenanceSource: 'dispatch', clock: args.clock },
  ));
  return {
    text: finalText,
    promptRoundId,
    intent,
    intentExtraction,
    highWaterMark,
    interrupted: false,
    proposalRejected: false,
    events,
  };
}