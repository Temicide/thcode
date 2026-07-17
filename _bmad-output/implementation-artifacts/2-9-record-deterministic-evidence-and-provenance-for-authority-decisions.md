---
story_id: "2.9"
story_key: "2-9-record-deterministic-evidence-and-provenance-for-authority-decisions"
epic: 2
baseline_commit: 0071f7f
status: review
created: 2026-07-17
project: thcode
dependsOn: "2.4; 2.8; 1.5"
---

# Story 2.9: Deterministic Evidence + provenance for authority decisions

Status: review

## Implementation
- cli/src/core/protocol/events.ts — AuthorityEvidenceRecordedPayload (additive durable kind; secret-free digests + identity/revision/version + decision + reason + source event + next step).
- cli/src/core/protocol/evidence.ts — AuthorityEvidence + buildAuthorityEvidence (missing digests/identity downgrade to sanitized-with-omissions), buildAutoPermitEvidence (compact, not invisible), authorityEvidencePayload, labelEvidenceVersusExplanation (model text cannot override deterministic deny/stale/refused), DEFAULT_EXPORT_POLICY (raw disabled, sanitized allowed), sanitizeEvidenceForExport (no raw reconstruction), deduplicateEvidence (EventId dedup).
- cli/test/evidence.test.ts — 12 cases across all 6 ACs.

## Verify
- npm run build clean; npm test green.
