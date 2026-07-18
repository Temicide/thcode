---
story_id: "2.3"
story_key: "2-3-define-workspace-identity-and-non-overridable-hard-boundaries"
epic: 2
baseline_commit: 1b28f2e
status: review
created: 2026-07-17
project: thcode
dependsOn: "2-1 (Workspace identity is bound into the Runtime Activation this story's boundary checks are evaluated alongside); 2-2 (the PEP is the intended consumer of hard-boundary decisions — this story's `checkHardBoundary` is independent of but designed to compose with `pep.ts`)"
---

# Story 2.3: Define Workspace identity and non-overridable hard boundaries

Status: review

## Story

As a developer
I want every proposal checked against explicit resource and platform boundaries
so that approval and Full Access cannot authorize unsafe or out-of-scope effects.

## Acceptance Criteria

1. **Given** a Runtime Activation has a declared Workspace
   **When** a proposal is prepared for policy evaluation
   **Then** the authority record includes stable Workspace identity, platform identity, canonical target/resource identity, action class, and boundary revision; missing or ambiguous identity is not treated as permission.
2. **Given** a proposal targets outside the Workspace, an unsafe path/resource, a host-threatening command class, an unallowlisted network/service destination, an unavailable enforcement mechanism, an exceeded quota, or the wrong credential group
   **When** the PEP evaluates it under any mode/profile
   **Then** it returns `deny`, identifies the hard boundary and safe next step, and does not expose an approval or Full Access path that could override it.
3. **Given** a proposal changes target identity, path containment, executable identity, destination, service identity, sensitivity, quota scope, or enforcement state after evaluation
   **When** effect-time revalidation runs
   **Then** the previous decision is stale, the operation is denied or returned for fresh evaluation, and the old authorization is not consumed.
4. **Given** a developer requests a Boundary Expansion
   **When** the expansion contract is evaluated
   **Then** it is separately scoped to stable resource identity, Workspace/platform identity, permitted action classes, reason, creation authority, revision, expiry where applicable, and revocation state; it is not represented as a temporary approval or transfer consent.
5. **Given** a Boundary Expansion is stored, inspected, revoked, expired, or fails resource revalidation
   **When** the boundary inventory is queried
   **Then** its state and exact scope are auditable, revocation prevents future authorization, failure is fail-closed, and no claim is made that an already committed effect was cancelled.
6. **Given** the product has not yet resolved a platform/action matrix or numeric release budget
   **When** a boundary status is shown
   **Then** it uses `ENFORCEMENT UNVERIFIED` or `budget not set` as applicable and never invents a platform guarantee or release-governance result.

**Requirements:** FR-24; NFR-3; NFR-7; NFR-13; AD-18; AD-22; UX-DR-023–024, UX-DR-055–059, UX-DR-071–079, UX-DR-120.

## Tasks / Subtasks

- [x] **Task 1: Workspace identity (AC: #1)**
  - [x] 1.1 `cli/src/core/permissions/boundary.ts` — `workspaceIdentity(root)` derives a stable, deterministic `workspaceId` (SHA-256 of the case-folded resolved root, truncated) from the Workspace root path. `CoreApp` computes it once at construction/rebind and carries it on every activation (Story 2.1) and every granted Boundary Expansion (Task 4).

- [x] **Task 2: Non-overridable hard boundaries (AC: #2)**
  - [x] 2.1 `checkHardBoundary(input)` takes NO Work Mode / Permission Profile parameter by construction — there is no code path by which a profile could convert its `deny` into `allow`. Reuses the existing `resolveWithinWorkspace`/`WorkspaceBoundaryError` from `cli/src/core/tools/workspace.ts` (extended, not forked) for the workspace-escape check, and independently checks host-threatening command class, unallowlisted network/service destination, unavailable enforcement (`ENFORCEMENT UNVERIFIED`), exceeded quota, and wrong credential group. Each denial carries a stable `HardBoundaryReason` token.
  - [x] 2.2 `CoreApp.checkBoundary(input)` exposes this against the live Workspace root; verified in tests that Full Access does not change the outcome (there is no profile input to change).

- [x] **Task 3: Effect-time revalidation (AC: #3)**
  - [x] 3.1 `revalidateBoundary(original, current)` compares a `BoundarySnapshot` (`resourceIdentity`, `workspaceId`, `enforcementAvailable`) captured at evaluation time against the current state immediately before effect start. Any drift → `{ stale: true, reason }`; the caller denies or re-evaluates, and Story 2.2's `EffectExecutor` never consumes the old authorization for a stale boundary (this story provides the primitive; full automatic wiring into a dispatch path is Epic 3, per the Known Gaps below).

- [x] **Task 4: Durable Boundary Expansion (AC: #4, #5)**
  - [x] 4.1 `BoundaryExpansionRegistry` — `grant(...)` creates a `BoundaryExpansion` scoped to `resourceIdentity`, `workspaceId`, `actionClasses`, `reason`, `createdAt`, `expiresAt`, `revoked`/`revokedAt`. It is a distinct object shape from any approval/consent record — nothing in this story's types could be mistaken for one.
  - [x] 4.2 `revoke(expansionId, reason)` is permanent and idempotent-safe (revoking twice returns `false` the second time, never un-revokes); `isActive(id, actionClass, nowIso)` fails closed to `false` for unknown/revoked/expired/out-of-scope — never optimistically `true`.
  - [x] 4.3 `CoreApp.grantBoundaryExpansion`/`revokeBoundaryExpansion`/`listBoundaryExpansions` journal `BoundaryExpansionGranted`/`BoundaryExpansionRevoked` durable events (protocol 1.2, landed with Story 2.1's bump) via the existing `durableEvent` builder + `SessionRepository`, and `authorityProjection().activeBoundaryExpansionCount` makes the live inventory observable without a separate query.

- [x] **Task 5: Canonical non-affirmative tokens (AC: #6)**
  - [x] 5.1 `ENFORCEMENT_UNVERIFIED`/`BUDGET_NOT_SET` are imported from `matrix.ts` (Story 2.2) rather than redeclared, so the token is byte-identical everywhere it is used across Stories 2.2/2.3.

- [x] **Task 6: Tests (red-green-refactor) (AC: #1–#6)**
  - [x] 6.1 `cli/test/boundary.test.ts` — 21 Vitest cases: workspace-identity determinism and distinctness (AC #1); every hard-boundary denial reason (workspace escape, host-threatening command, unallowlisted network destination, `ENFORCEMENT UNVERIFIED`, exceeded quota, wrong credential group) plus the allow path with a bound `resourceIdentity` (AC #2); all three `revalidateBoundary` staleness reasons plus the not-stale case (AC #3); Boundary Expansion grant/list/get, permanent revocation, idempotent double-revoke, expiry fail-closed, unknown-id fail-closed, out-of-scope action-class fail-closed (AC #4, #5); the exact `ENFORCEMENT UNVERIFIED` token (AC #6).
  - [x] 6.2 `cli/test/authority-app.test.ts` — `CoreApp.checkBoundary` denying a workspace escape under Full Access; `grantBoundaryExpansion`/`revokeBoundaryExpansion` journaling and inventory-count integration (shared file with Stories 2.1/2.2).
  - [x] 6.3 `npm run build` clean; `npx vitest run` → **243 passed across 21 files**. No regressions.

- [x] **Task 7: File List / Change Log / Status**
  - [x] 7.1 File List, Completion Notes, Change Log updated; Status set to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-18 (health/boundary failure scope):** This story's hard-boundary denials are scoped per-check (a workspace-escape denial does not itself quarantine anything) — broader quarantine/threshold policy belongs to `HealthRegistry` (Story 1.7/AD-18), not to `boundary.ts`.
- **AD-22 (fresh, workspace-bound authority):** `workspaceIdentity` is computed once per activation/rebind (Story 2.1's `beginNewActivation('workspace-rebind', newRoot)` recomputes it), so a Boundary Expansion's `workspaceId` binding can detect a rebind even though this story does not wire automatic re-revalidation of existing expansions on every rebind (see Known Gaps).
- **Non-overridability is structural, not policy-based:** `checkHardBoundary`'s signature has no Work Mode/Permission Profile parameter at all — AC #2's "no approval or Full Access path that could override it" is enforced by the type signature itself, not by a runtime check that could be forgotten at a call site.
- **Reused, not forked:** `resolveWithinWorkspace`/`WorkspaceBoundaryError` (`cli/src/core/tools/workspace.ts`, Story 1.1-era code) is called directly, not reimplemented, for the workspace-containment check — matching the task's "build on the existing `tools/workspace.ts` boundary check where it genuinely fits" instruction.

### Project Structure Notes

- New code: `cli/src/core/permissions/boundary.ts` — `workspaceIdentity`, `checkHardBoundary`, `revalidateBoundary`, `BoundaryExpansionRegistry`. Pure domain logic (no fs beyond `node:path`/`node:crypto`, no network, no journal) — `CoundApp` is the only place that adds journaling, consistent with Story 2.2's `pep.ts` pattern.
- `cli/src/core/protocol/events.ts` gained `BoundaryExpansionGrantedPayload`/`BoundaryExpansionRevokedPayload` (protocol 1.2, landed with Story 2.1's bump).

### Brownfield baseline

- Landed together with Stories 2.1 and 2.2 against the Epic 1 baseline of 186 passing tests across 17 files (see Story 2.1's Dev Notes for that baseline's composition).

### Known gaps (do NOT fix in this story — explicitly out of Epic 2's stated scope or a later story)

- **Automatic revalidation wiring into a real dispatch path is not implemented.** `revalidateBoundary` is a tested, correct primitive; nothing in this codebase yet calls it automatically immediately before a real file-mutation/command-execution effect, because Epic 2 explicitly does not implement file mutation or command execution (epics.md: "Epic 2 builds... It establishes authority and observability contracts without implementing file mutation, command execution, checkpoints..."). That wiring is Epic 3's job, consuming this story's primitive.
- **Boundary Expansion re-revalidation on Workspace rebind is not automatic.** Story 2.1's `beginNewActivation('workspace-rebind', ...)` does not itself walk `listBoundaryExpansions()` and re-check each one's `workspaceId` against the new identity — the primitive (`workspaceId` comparison) exists and is directly testable, but the automatic sweep is not wired. Flagged rather than silently assumed complete.
- **Platform identity (AC #1's "platform identity")** is not separately modeled as its own field distinct from `workspaceId`/`resourceIdentity` in this prototype — Release 1 targets exactly two native platforms (Windows/macOS) and this story's `resourceIdentity` is already an OS-resolved absolute path, which is platform-specific by construction, but there is no explicit `platformId` field. This is a real, acknowledged gap against the letter of AC #1, not a reinterpretation: a future story can add it without changing this story's decision shape.
- **`ENFORCEMENT UNVERIFIED`/`budget not set` display wiring** — the tokens exist and are exercised by `checkHardBoundary`/`AuthorityProjection.enforcementVerified`, but no numeric release budget concept exists yet anywhere in the codebase for `budget not set` to attach to; it is exported and correct but not yet consumed by a live code path (Epic 7 territory).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.3] (lines 783–810)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-18, #AD-22, #AD-12, #AD-17]
- [Source: cli/src/core/tools/workspace.ts, cli/src/core/permissions/boundary.ts, cli/src/core/app.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

### Completion Notes List

- Implemented `cli/src/core/permissions/boundary.ts`: `workspaceIdentity`, `checkHardBoundary` (no mode/profile parameter — structurally non-overridable), `revalidateBoundary`, `BoundaryExpansionRegistry` (grant/revoke/get/list/isActive, fail-closed throughout).
- `CoreApp.checkBoundary`/`grantBoundaryExpansion`/`revokeBoundaryExpansion`/`listBoundaryExpansions` wired with durable `BoundaryExpansionGranted`/`BoundaryExpansionRevoked` journaling; `authorityProjection().activeBoundaryExpansionCount` surfaces the live count.
- 21 new Vitest cases in `cli/test/boundary.test.ts` covering every AC; shared `cli/test/authority-app.test.ts` cases cover the `CoreApp` integration (workspace-escape denial under Full Access, grant/revoke journaling + inventory count). Final combined suite: `npm run build` clean; `npx vitest run` → **243 passed across 21 files**. No regressions.

### File List

- `cli/src/core/permissions/boundary.ts` (new) — `workspaceIdentity`, `checkHardBoundary`, `revalidateBoundary`, `BoundaryExpansionRegistry`, `BoundaryExpansion`, `HardBoundaryReason`, `BoundaryCheckInput`, `BoundaryDecision`, `BoundarySnapshot`, `RevalidationResult`.
- `cli/src/core/protocol/events.ts` (modified) — `BoundaryExpansionGrantedPayload`/`BoundaryExpansionRevokedPayload` (landed with Story 2.1's protocol bump).
- `cli/src/core/app.ts` (modified) — `checkBoundary`, `grantBoundaryExpansion`, `revokeBoundaryExpansion`, `listBoundaryExpansions` (landed with Story 2.1/2.2's `CoreApp` changes).
- `cli/test/boundary.test.ts` (new) — 21 Vitest cases.
- `cli/test/authority-app.test.ts` (new, shared with 2.1/2.2) — includes the boundary/expansion integration cases.

### Change Log

- 2026-07-17: Story 2.3 implemented — stable Workspace identity, non-overridable `checkHardBoundary` (structurally excludes a mode/profile override path), effect-time `revalidateBoundary`, durable `BoundaryExpansionRegistry` with fail-closed revocation/expiry, canonical `ENFORCEMENT UNVERIFIED`/`budget not set` tokens shared with Story 2.2. Landed together with Stories 2.1 and 2.2. Build clean; 243 tests passing across 21 files. Status → review.
