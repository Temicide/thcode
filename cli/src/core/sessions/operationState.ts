// Operation state machine (AD-13). Every operation advances through this
// lifecycle; one durable terminal outcome per operation. Once terminal, only
// `reconciled` is a valid further transition.

export type OperationState =
  | 'proposed'
  | 'authorized'
  | 'prepared'
  | 'dispatch-committed'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'unknown-outcome'
  | 'reconciled';

const TERMINAL: ReadonlySet<OperationState> = new Set([
  'succeeded', 'failed', 'cancelled', 'unknown-outcome', 'reconciled',
]);

const TRANSITIONS: ReadonlyMap<OperationState, ReadonlySet<OperationState>> = new Map([
  ['proposed', new Set(['authorized'])],
  ['authorized', new Set(['prepared'])],
  ['prepared', new Set(['dispatch-committed'])],
  ['dispatch-committed', new Set(['succeeded', 'failed', 'cancelled', 'unknown-outcome'])],
  ['succeeded', new Set(['reconciled'])],
  ['failed', new Set(['reconciled'])],
  ['cancelled', new Set(['reconciled'])],
  ['unknown-outcome', new Set(['reconciled'])],
  ['reconciled', new Set()],
]);

export function isTerminal(state: OperationState): boolean {
  return TERMINAL.has(state);
}

export function canTransition(from: OperationState, to: OperationState): boolean {
  const allowed = TRANSITIONS.get(from);
  return allowed !== undefined && allowed.has(to);
}