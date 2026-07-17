---
story_id: "2.5"
story_key: "2-5-provide-progressive-approval-disclosure-and-safe-decision-controls"
epic: 2
baseline_commit: b0d8e75
status: review
created: 2026-07-17
project: thcode
dependsOn: "2.4 (decision binds to exact OperationId + digest); 2.8 (no-TTY exit class/code)"
---

# Story 2.5: Progressive approval disclosure + safe decision controls

Status: review

## Implementation
- cli/src/core/permissions/approval.ts — ApprovalSummary (plain-language purpose/risk/outcome + context + OperationId, startFocus always review/cancel never approve), ApprovalExactDetails discriminated union (command/mutation/deletion/transfer), requiresExplicitAuthority + authorityInsufficientReason, unresolvedApprovalFields (blocks approve on unresolved destination/classification/digest/enforcement), recordApprovalDecision (bound to exact op+digest; Esc never authorizes), isApprovalStale, noTtyFailClosed (blocked, rerun-interactively, BLOCKED=20, no stdin secret/authority, no dispatch), renderApprovalText parity.
- cli/test/approval.test.ts — 12 cases across all 6 ACs.

## Verify
- npm run build clean; npm test green.
