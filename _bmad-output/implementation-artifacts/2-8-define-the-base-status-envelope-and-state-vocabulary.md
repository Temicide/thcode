---
story_id: "2.8"
story_key: "2-8-define-the-base-status-envelope-and-state-vocabulary"
epic: 2
baseline_commit: 0de9e99
status: review
created: 2026-07-17
project: thcode
dependsOn: "PR-1; 1.2; 1.3"
---

# Story 2.8: Base status envelope + state vocabulary (ux-state-v1)

Status: review

## Implementation
- cli/src/core/protocol/uxState.ts — frozen ux-state-v1 registry across 5 AD-28 dimensions (operation-status, lifecycle-fact, evidence-completeness, measurement-quality, provider-deletion-lifecycle). Each row: unique display/JSON token, explicit dimension, terminality, exit class + code, cause/retry/recovery/narrow/localized/Thai label. validateUxStateRegistry() mechanical validation; COMMAND_ERROR heading over blocked/malformed (not a row); effect-already-committed nonterminal; percentage-unavailable/estimated/sanitized-with-omissions nonterminal qualifiers; provider-deletion rows conditional on verified provider contract. Exit mapping: SUCCESS=0, FAILED=1, BLOCKED=20, UNKNOWN_OUTCOME=70, CANCELLED=130, NONE=null.
- cli/test/uxState.test.ts — 18 cases.

## Verify
- npm run build clean; npm test green.
