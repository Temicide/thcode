---
story_id: "2.10"
story_key: "2-10-provide-activity-history-and-deterministic-replay"
epic: 2
baseline_commit: 077c38b
status: review
created: 2026-07-17
project: thcode
dependsOn: "2.8; 2.9; 1.3"
---

# Story 2.10: Activity history + deterministic replay

Status: review

## Implementation
- cli/src/core/protocol/activity.ts — ActivityRecord + buildActivityProjection (groups by Prompt Round + operation class, includes every call incl auto-permit, EventId dedup, sequence ordering, truncation + corrupt counts, complete flag). classifyEvent maps every durable kind to operation-class + canonical status + safe summary + authority revision + Evidence ref. filterActivity (deterministic), groupByPromptRoundAndClass, renderActivityText + renderActivityJson (parity, no color-only/animation). Corrupt events marked corrupt/unavailable.
- cli/test/activity.test.ts — 8 cases across all 6 ACs.

## Verify
- npm run build clean; npm test green.
