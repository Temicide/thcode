// Opaque branded id types (project-context.md naming conventions). Each id is
// generated once by the owning boundary and is a UUID-shaped string at runtime;
// the brand gives compile-time nominal typing without runtime overhead.

import { randomUUID } from 'node:crypto';

export type SessionId = string & { readonly __brand: 'SessionId' };
export type PromptRoundId = string & { readonly __brand: 'PromptRoundId' };
export type OperationId = string & { readonly __brand: 'OperationId' };
export type EventId = string & { readonly __brand: 'EventId' };

function brand<T extends string>(value: string): T {
  return value as T;
}

export function newSessionId(): SessionId {
  return brand<SessionId>(randomUUID());
}
export function newPromptRoundId(): PromptRoundId {
  return brand<PromptRoundId>(randomUUID());
}
export function newOperationId(): OperationId {
  return brand<OperationId>(randomUUID());
}
export function newEventId(): EventId {
  return brand<EventId>(randomUUID());
}

/** Parse a string into a branded id (for restoration from persistence). */
export function asSessionId(s: string): SessionId {
  return brand<SessionId>(s);
}
export function asPromptRoundId(s: string): PromptRoundId {
  return brand<PromptRoundId>(s);
}
export function asOperationId(s: string): OperationId {
  return brand<OperationId>(s);
}
export function asEventId(s: string): EventId {
  return brand<EventId>(s);
}