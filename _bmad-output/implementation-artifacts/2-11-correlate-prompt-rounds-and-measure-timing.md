---
story_id: "2.11"
story_key: "2-11-correlate-prompt-rounds-and-measure-timing"
epic: 2
baseline_commit: 199e226
status: review
created: 2026-07-17
project: thcode
dependsOn: "2.8; 2.10; 1.3"
---

# Story 2.11: Correlate Prompt Rounds + measure timing

Status: review

## Implementation
- cli/src/core/protocol/timing.ts — PromptRoundTiming (promptRoundId == correlationId; operationIds retained), beginPromptRoundTiming, finalizePromptRoundTiming (end-to-end accepted→terminal-visibility; NOT_MEASURED when timestamp missing; quality locally-measured/unknown), withSubsystem (attributable phase timings), correlateOperation (bidirectional), operationDurationMs (distinct from round), utilizationPercentOrBudgetNotSet (budget not set when no real budget), isNonAffirmativeTerminal (unknown-outcome/blocked/stale/cancelled/failed/interruption-unknown non-affirmative), deduplicateTimingEvents (EventId dedup).
- cli/test/timing.test.ts — 9 cases across all 6 ACs.

## Verify
- npm run build clean; npm test green.
