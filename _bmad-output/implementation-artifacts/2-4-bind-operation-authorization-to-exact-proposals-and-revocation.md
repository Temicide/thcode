---
story_id: "2.4"
story_key: "2-4-bind-operation-authorization-to-exact-proposals-and-revocation"
epic: 2
baseline_commit: f5703e0
status: review
created: 2026-07-17
project: thcode
dependsOn: "2-1 (Runtime Activation identity/revision the authorization binds to); 2-2 (the PEP decision + matrix version recorded verbatim on the authorization)"
---

# Story 2.4: Bind operation authorization to exact proposals and revocation

Status: review

## Implementation

- `cli/src/core/permissions/authorization.ts` — `Authorization` record bound to OperationId + action/target/context/payload/destination/classification/credential-group digests + activationId + activationRevision + authorityRevision + policy decision + matrix version + createdAt + expiresAt + approvingInteraction + one-shot consumed/revoked state. `computeProposalDigest`, `createAuthorization`, `revalidateAuthorization` (mismatch → stale with specific cause), `consumeAuthorization` (one-shot, double-consume refused), `revokeAuthorization`, `revocationOutcome` (before-commit → cancelled; after-commit → honest observed terminal). `AuthorizationRegistry` dedups by authorizationId + `(operationId, actionDigest)` identity and by EventId.
- `cli/src/core/protocol/events.ts` — `ApprovalGranted` / `AuthorizationConsumed` / `AuthorizationRevoked` durable payloads (digests + identity only; no raw payload).
- `cli/src/core/app.ts` — `grantApproval` / `revalidateAuthorization` / `consumeAuthorization` / `revokeAuthorization` / `getAuthorization` wired with durable journaling.
- `cli/test/authorization.test.ts` — 23 cases across all 6 ACs.

## Verify

- `npm run build` clean.
- `npm test` → 264 passed (22 files).
