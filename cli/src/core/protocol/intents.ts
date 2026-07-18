// CoreProtocolV1 intents — exhaustive discriminated union (AD-2, AD-14).
// Unknown variants are rejected; no silent coercion or repair.

export interface PromptSubmitIntent {
  readonly type: 'prompt.submit';
  readonly text: string;
}

export type SessionIntent =
  | { readonly type: 'session.create' }
  | { readonly type: 'session.open'; readonly sessionId: string }
  | { readonly type: 'session.close' }
  | { readonly type: 'session.list' }
  | { readonly type: 'session.rename'; readonly sessionId: string; readonly name: string }
  | { readonly type: 'session.delete'; readonly sessionId: string };

export type ModeIntent =
  | { readonly type: 'mode.set'; readonly mode: 'plan' | 'build' }
  | { readonly type: 'mode.toggle' };

export type ProfileIntent =
  | { readonly type: 'profile.set'; readonly profile: 'manual' | 'assisted' | 'full-access' };

export type HealthIntent =
  | { readonly type: 'health.check' }
  | { readonly type: 'health.retest'; readonly providerId: string };

export type CapabilityIntent =
  | { readonly type: 'capability.list' }
  | { readonly type: 'capability.inspect'; readonly id: string }
  | { readonly type: 'capability.enable'; readonly id: string }
  | { readonly type: 'capability.disable'; readonly id: string };

export type OperationIntent =
  | { readonly type: 'operation.approve'; readonly operationId: string }
  | { readonly type: 'operation.deny'; readonly operationId: string }
  | { readonly type: 'operation.cancel'; readonly operationId: string };

export type ContextIntent =
  | { readonly type: 'context.inspect' }
  | { readonly type: 'context.pin'; readonly turnId: string }
  | { readonly type: 'context.unpin'; readonly turnId: string }
  | { readonly type: 'context.compact' };

export type BoundaryIntent =
  | { readonly type: 'boundary.list' }
  | { readonly type: 'boundary.revoke'; readonly id: string };

export type ExitIntent = { readonly type: 'exit' };

export type Intent =
  | PromptSubmitIntent
  | SessionIntent
  | ModeIntent
  | ProfileIntent
  | HealthIntent
  | CapabilityIntent
  | OperationIntent
  | ContextIntent
  | BoundaryIntent
  | ExitIntent;

/** All known intent type strings. Used for exhaustiveness and validation. */
export const INTENT_TYPES = [
  'prompt.submit',
  'session.create', 'session.open', 'session.close', 'session.list', 'session.rename', 'session.delete',
  'mode.set', 'mode.toggle',
  'profile.set',
  'health.check', 'health.retest',
  'capability.list', 'capability.inspect', 'capability.enable', 'capability.disable',
  'operation.approve', 'operation.deny', 'operation.cancel',
  'context.inspect', 'context.pin', 'context.unpin', 'context.compact',
  'boundary.list', 'boundary.revoke',
  'exit',
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];

/** Compile-time exhaustiveness map. If a new intent type is added to `Intent`
 * without covering it here, this line fails to type-check. */
export const _INTENT_EXHAUSTIVE: Record<Intent['type'], true> = {
  'prompt.submit': true,
  'session.create': true, 'session.open': true, 'session.close': true, 'session.list': true, 'session.rename': true, 'session.delete': true,
  'mode.set': true, 'mode.toggle': true,
  'profile.set': true,
  'health.check': true, 'health.retest': true,
  'capability.list': true, 'capability.inspect': true, 'capability.enable': true, 'capability.disable': true,
  'operation.approve': true, 'operation.deny': true, 'operation.cancel': true,
  'context.inspect': true, 'context.pin': true, 'context.unpin': true, 'context.compact': true,
  'boundary.list': true, 'boundary.revoke': true,
  'exit': true,
};