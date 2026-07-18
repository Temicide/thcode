---
story_id: "3.10"
story_key: "3-10-aggregate-agent-loop-terminals-and-revalidate-authority"
epic: 3
baseline_commit: 9765947
status: review
created: 2026-07-17
project: thcode
dependsOn: "3.9;2.1;2.4"
---

# Story 3.10: Aggregate Agent Loop terminals and revalidate authority

Status: review

## Implementation
- `cli/src/core/agent/terminals.ts` — `TerminalAggregator` (pure, injectable): `aggregateTerminals` (AC #1: strongest unresolved + included/excluded effects + post-commit gate), `revalidateAuthorityForNextEffect` (AC #2: authority/workspace/quota/platform/cancellation checks, denies without consuming one-shot), `dispatchCommittedOutcome` (AC #3: honest outcome per durable evidence, no cancellation fiction), `unprovenNativeResult` (AC #4: preserves unknown-outcome + residual risk + blocks retry), `aggregateLeadLanguage`/`buildAggregateSummary` (AC #5: distinct dimensions, no affirmative success for partial/unknown). Strongest-unresolved ordering documented: unknown-outcome > still-running > failed > cancelled > blocked > malformed > denied > refused > reconciled > succeeded.
- `cli/src/core/agent/types.ts` — added `OperationTerminalKind`, `OperationTerminalState`, `AggregateStatus`, `AggregateRoundOutcome`, `RevalidationContext` types.
- `cli/src/core/app.ts` — `aggregateTerminals(...)` and `revalidateNextEffect(...)` methods on `CoreApp` facade, delegating to the pure functions with live activation state.
- `cli/test/terminals.test.ts` — 57 cases across all 5 ACs + edge cases. Injected clock, fake journal, no network/real creds.

## Verify
- npm run build clean; npm test green (787 tests, 42 files).
