---
story_id: "3.3"
story_key: "3-3-preflight-complete-mutation-set-and-establish-protection-status"
epic: 3
baseline_commit: 9765947
status: review
created: 2026-07-17
project: thcode
dependsOn: "3.2;2.4;3.1"
---

# Story 3.3: Preflight the complete mutation set and establish protection status

Status: review

## Implementation
- `cli/src/core/mutations/types.ts` — typed contracts: `MutationProposal` (discriminated union for create/edit/delete), `MutationSet`, `ProtectionStatus`, `ProtectionPreflightResult`, `QuotaCheck` (100 MB per-checkpoint, 500 MB store caps — AD-19), `PlanFingerprint`, `StaleReason` (discriminated union), `ConfirmationScope`, `ConfirmationResult`. Branded ids (`MutationProposalId`, `MutationSetId`, `PlanFingerprintId`). AD-9 typed failure envelope. No `any`.
- `cli/src/core/mutations/plan.ts` — `planMutationSet(proposals, ctx)`: READ-ONLY plan enumerating the complete intended set with stable resource identities, action digests, expected pre-image digest/version, proposed post-image or deletion manifest, rename/alias relationships, checkpoint size, binary status, and excluded effects BEFORE any native mutation. Pure/injectable (fsProbe + clock + workspace binding).
- `cli/src/core/mutations/protectionPreflight.ts` — `runProtectionPreflight(plan, ctx)`: executes the exact ordered checks per AC #2: resolve stable identity -> capture expected digest/version -> evaluate PEP/PermissionMatrix/quota/platform checks -> stage checkpoint originals/metadata/post-plan -> make the stage durable. Targets that change identity/content, are inaccessible, cross symlink/junction/mount, exceed per-checkpoint/store cap, or cannot be represented safely -> excluded or whole operation blocked per policy, with exact reason + protection coverage shown.
- `cli/src/core/mutations/planFingerprint.ts` — `fingerprintPlan(...)` + `isStale(fingerprint, currentCtx)`: AC #5 — if the user changes proposal, Workspace, authority revision, target, digest, quota, or platform state after planning, effect-time validation marks plan + approval `stale`/`mismatch`; staged authorization is not consumed; a fresh read-only plan is required.
- `cli/src/core/mutations/confirmation.ts` — `processConfirmation(ctx)`: AC #4 — when protection is partial/unavailable but the action is otherwise eligible, discloses the exact unprotected scope + residual risk; proceeding requires explicit confirmation for that exact scope; Full Access CANNOT suppress checkpoint rules or convert Plan into authorization.
- `cli/src/core/mutations/index.ts` — barrel export.
- `cli/src/core/app.ts` — minimal wiring: `planMutations(proposals)`, `preflightProtection(plan, opts)`, `createPlanFingerprint(mutationSet)`, `revalidatePlan(fingerprint, mutationSet)`, `confirmMutation(preflightResult, userConfirmed, confirmedScope)`. Reuses Story 3.2 checkpoint stage path and Story 3.1 workspace/enforcement. Injects clocks; no `new Date()` in domain code.
- `cli/test/mutationPlan.test.ts` — 30+ test cases across all 5 ACs with injected in-memory fs/checkpoint stores + clock. Covers: read-only plan enumerates full set with identities/digests/pre-image/post-image/rename/binary/exclusions; ordered preflight -> fully/partially/unprotected labeling only after durable stage; identity-change/inaccessible/symlink-cross/over-cap -> excluded or blocked with reason, no mutation; partial protection -> exact unprotected scope disclosure + explicit confirmation required + Full-Access cannot suppress; stale/mismatch on proposal/workspace/authority/digest/quota/platform change -> staged authorization not consumed, fresh plan required. Edge cases: empty proposals, Thai text, binary content, missing kv store, fingerprint dimensions.

## Verify
- `npm run build` clean; `npm test` green (existing + new tests).
