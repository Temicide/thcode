---
story_id: "2.12"
story_key: "2-12-define-post-commit-completion-and-terminal-semantics"
epic: 2
baseline_commit: 88d71f3
status: review
created: 2026-07-17
project: thcode
dependsOn: "2.8; 2.11; 1.3"
---

# Story 2.12: Post-commit completion + terminal semantics

Status: review

## Implementation
- cli/src/core/protocol/completion.ts — CompletionRecord + finalizeCompletion (emits only after post-commit Evidence committed; transient callbacks cannot complete), terminal projection (OperationId/PromptRoundId/authority revision/digests/cause/evidence/duration/next step/outcome/exit class+code), interruptionOutcome (commit+unproven → unknown-outcome; no cancellation fiction), leadLanguageForOutcome (non-affirmative for unresolved), CompletionRegistry (first terminal wins; late progress can't reopen), renderCompletionOutput (stdout normal/stderr warnings/JSON ids+exit mapping). Exit mapping from ux-state-v1 EXIT_CODES: SUCCESS=0, FAILED=1, BLOCKED=20, CANCELLED=130, UNKNOWN_OUTCOME=70.
- cli/test/completion.test.ts — 16 cases across all 6 ACs.

## Verify
- npm run build clean; npm test green.
