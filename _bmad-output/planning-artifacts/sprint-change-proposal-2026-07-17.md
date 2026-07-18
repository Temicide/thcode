---
project: thcode
date: 2026-07-17
status: implemented
trigger: implementation-readiness-report-2026-07-17.md
scope: major
reviewMode: batch-autonomous
appliedOn: 2026-07-17
appliedBy: bmad-correct-course workflow (Step 5)
artifactsModified:
  - prds/prd-thcode-2026-07-14/prd.md
  - prds/prd-thcode-2026-07-14/addendum.md
  - architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md
  - ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md
  - epics.md
---

# Sprint Change Proposal — Restore Implementation Readiness

## 1. Issue Summary

The 2026-07-17 implementation-readiness assessment found that thcode's product scope and traceability are complete, but the implementation plan is not yet dependency-safe. All 39 Functional Requirements are represented, the Architecture Spine covers the required trust boundaries, and the final UX spines provide a detailed terminal interaction contract. The blocking defects are planning order and normative authority:

1. invalid structured-proposal behavior is decided after stories already implement one side of a PRD/architecture conflict;
2. Specialist Service stories require a sensitive-data policy currently approved only in the later release-certification epic;
3. effectful Workspace stories require a platform/action enforcement matrix currently established only in the later certification epic;
4. Specialist Result/Evidence and context persistence contracts follow stories that already consume them;
5. the UX state registry conflates operation outcome, lifecycle facts, Evidence completeness, measurement quality, and process exit;
6. brownfield baseline, deterministic fixtures, resource limits, dependency metadata, and certification-story sizing need correction.

The trigger is a planning assessment rather than failed implementation. Phase 4 has not started, so no code or completed story work requires rollback.

## 2. Change Analysis Checklist

### 2.1 Trigger and Context

- [N/A] 1.1 — No implementation story triggered the correction; the readiness assessment did.
- [x] 1.2 — Issue type: misunderstanding/inconsistency in original requirements plus planning dependency defects.
- [x] 1.3 — Evidence: readiness report with three critical, eight major, four minor, and four cross-cutting gate findings.

### 2.2 Epic Impact

- [x] 2.1 — Product epics remain viable after correction.
- [x] 2.2 — Existing epic scope is retained; prerequisite decisions move earlier and internal stories are reordered.
- [x] 2.3 — Epics 1–7 were assessed for dependency impact.
- [x] 2.4 — No product epic becomes obsolete and no new product epic is required.
- [x] 2.5 — Epic 7 becomes certification-only; prerequisites move into a pre-implementation gate section; Epics 4 and 5 are internally resequenced.

### 2.3 Artifact Conflict and Impact

- [x] 3.1 — PRD requires FR-6 correction and earlier policy/matrix prerequisites.
- [x] 3.2 — Architecture requires explicit UX companionship, matrix ownership, conditional provider deletion, and multidimensional protocol state.
- [x] 3.3 — UX requires state-registry repair, conditional provider-retention behavior, and removal of the unsupported context fallback.
- [x] 3.4 — Epics require dependency metadata, deterministic fixture contracts, safety caps, brownfield baseline, and decomposed certification.

### 2.4 Path Forward

- [x] 4.1 — Direct Adjustment is viable. Effort: Medium. Risk: Medium.
- [N/A] 4.2 — Potential Rollback is unnecessary because Phase 4 has not started.
- [x] 4.3 — The Release-1 MVP remains achievable without reducing scope.
- [x] 4.4 — Selected approach: Direct Adjustment with prerequisite gates, artifact alignment, dependency-safe resequencing, and certification decomposition.

## 3. Impact Analysis

### Epic Impact

- **Epic 1:** preserve durable foundations; add explicit brownfield baseline acceptance; freeze invalid-proposal rejection before Story 1.9.
- **Epic 2:** make the canonical state contract mechanically owned and validated before downstream surfaces consume it.
- **Epic 3:** require the approved platform/action enforcement matrix before effectful stories.
- **Epic 4:** require the approved Sensitive-Data and Remote Data Authority policy; move immutable Specialist Result/Evidence ownership before service integrations.
- **Epic 5:** move context extension envelopes and encrypted/journaled persistence before pin, usage, compaction, and recovery consumers.
- **Epic 6:** retain current order; consume only record types established by prior epics.
- **Epic 7:** retain release governance and certification, but remove first-time definition of runtime prerequisites; split oversized evidence producers where needed.

### Artifact Conflicts

- **PRD:** FR-6 contradicts its own Non-Goal and Architecture AD-14; Deferred Decisions 3 and 4 occur after consuming epics.
- **Architecture:** concrete matrix ownership is deferred; UX spines are not listed as companions; AD-26 can be read as universal provider-deletion behavior; protocol state dimensions are underspecified.
- **UX:** provider no-retention is universal despite unresolved policy; `COMMAND_ERROR` is outside `ux-state-v1`; `effect-already-committed` can falsely signal success; Evidence qualifiers are terminal operation states; the `128k → 115,200` fallback lacks an authoritative source.
- **Epics:** two internal record-order defects, prerequisite decisions in Epic 7, no explicit dependency graph, and several oversized/underspecified certification stories.

### Technical Impact

No technology-stack replacement is required. The correction affects contracts and sequencing rather than implementation direction. The existing TypeScript, React/Ink, SQLite, OS credential facilities, Hexagonal Architecture, local PEP, and direct provider topology remain unchanged.

## 4. Recommended Approach

Use **Direct Adjustment**.

### Approved decisions

1. Invalid structured proposals are rejected after one local schema-validation pass. Release 1 makes no model repair request, provider retry, protocol reinterpretation, action substitution, or policy relaxation for that proposal.
2. Specialist transfers use an approved, versioned policy matrix. Provider retention/deletion handling must be verified and permitted for the exact configuration and data class. No-retention is preferred but not universally required. Provider-side deletion lifecycle states apply only when the provider contract supports them.
3. Before the exact Typhoon limit is verified, the UI shows `percentage unavailable`; no `128k` or `115,200` capacity is assumed.
4. Prerequisite decisions and contracts live in a pre-implementation gate section, not a new product epic.

### Effort and risk

- **Scope classification:** Major planning correction; no MVP reduction.
- **Artifact effort:** Medium–High because four canonical artifact sets require synchronized edits.
- **Implementation impact:** Positive; prevents rework and unsafe assumptions before Phase 4.
- **Schedule impact:** Short planning delay now in exchange for eliminating later cross-epic rework.
- **Primary risk:** inconsistent partial edits. Mitigation is synchronized updates followed by a full readiness rerun.

## 5. Detailed Change Proposals

Detailed approved old → new edits are grouped below by artifact and are applied as one synchronized correction set.

### 5.1 PRD

- Make immediate deterministic rejection authoritative in FR-6 and Non-Goals.
- Convert sensitive-data policy from a late release gate to an approved prerequisite before Epic 4.
- Convert the platform/action matrix from a later sign-off artifact to an approved prerequisite before Epic 3.
- Clarify provider-side deletion as conditional on verified provider capability and approved policy.
- Remove any implication of an assumed unverified context-capacity denominator.

### 5.2 Architecture

- Add final UX spines as companions and bind their canonical interaction/state contracts to CoreProtocolV1.
- Reference the approved platform/action matrix as a prerequisite artifact under AD-12.
- Separate local Session deletion from conditional provider-side deletion under AD-26.
- Define distinct fields/types for operation status, lifecycle fact, Evidence completeness, measurement quality, and process exit.
- Preserve AD-14 immediate rejection and link it to the corrected FR-6.

### 5.3 UX

- Replace universal no-retention wording with policy-matrix eligibility and exact verified handling disclosure.
- Make provider deletion states conditional on a supported provider contract.
- Remove the unsupported `128k → 115,200` fallback.
- Refactor `ux-state-v1` into mechanically distinct dimensions.
- Treat `COMMAND_ERROR` as an error heading/cause layered over canonical `blocked` or `malformed` status.
- Make `effect-already-committed` a lifecycle fact, not a success outcome.
- Keep `estimated`, `sanitized-with-omissions`, and `percentage unavailable` as Evidence/measurement qualifiers rather than universal operation-terminal statuses.

### 5.4 Epics and Stories

- Add a pre-implementation gate section with approved artifacts and explicit blocking dependencies.
- Add `dependsOn` metadata or a generated dependency table and reject forward edges.
- Strengthen Story 1.1 with brownfield baseline preservation and exact development package fixtures.
- Make Story 2.8 own mechanical state-contract validation.
- Require the platform/action matrix before Epic 3.
- Move Specialist Result/Evidence ownership before Stories 4.10–4.13.
- Move context extension envelopes and persistence before context consumers.
- Define safety/resource caps separately from NFR-14 performance SLOs.
- Add stable fixture IDs, hashes, expected normalized outputs, retry classes, and backoff/resource policy references.
- Keep Epic 7 certification-only and split broad evidence stories into independently owned producers plus aggregate gates.

## 6. Implementation Handoff

### Classification

**Major** — synchronized PM, Architect, UX, and backlog correction is required, but the core MVP and technology strategy remain intact.

### Responsibilities

- **Product Manager / Product Owner:** approve PRD normative changes and the Sensitive-Data policy matrix.
- **Solution Architect / Security:** approve the platform/action matrix, protocol dimensions, and provider-handling boundaries.
- **UX Designer:** repair the canonical state/exit contract and policy-dependent copy.
- **Product Owner / Developer:** resequence stories, add dependency metadata, define fixtures/caps, and decompose certification work.
- **Readiness assessor:** rerun implementation readiness and reject remaining forward dependencies.

### Success Criteria

1. PRD, Architecture, UX, and Epics prescribe one invalid-proposal rule.
2. No Epic 3 story depends on a matrix first defined later.
3. No Epic 4 story depends on a policy first approved later.
4. Record envelopes and persistence precede all consumers.
5. State, lifecycle, Evidence, measurement, and exit dimensions are mechanically coherent.
6. Every story has no dependency on a later story or epic.
7. Fixtures and safety caps are reproducible and version-owned.
8. A rerun of implementation readiness returns no implementation-blocking defects.

## 7. Approval and Execution

The user approved the complete correction scope and authorized applying the planning-artifact edits and iterating readiness validation until the blockers are cleared on 2026-07-17.

## 8. Execution Log (2026-07-17)

The approved Section 5 corrections were applied to all four canonical artifact sets in one synchronized correction pass. The artifact edits are normative; per-story reordering of Specialist Result/Evidence (Epic 4) and context envelopes/persistence (Epic 5) is recorded as an implementation convention to be applied mechanically during story execution rather than by moving story blocks in this document.

### Artifacts modified

- **PRD `prds/prd-thcode-2026-07-14/prd.md`**
  - FR-6 made authoritative: invalid structured proposals are rejected after one local schema-validation pass; no model repair request, provider retry, protocol reinterpretation, action substitution, or policy relaxation.
  - Non-Goals aligned to the corrected FR-6.
  - Added §12.1 Approved Prerequisites Before Feature Epics: PR-1 (invalid-proposal behavior), PR-2 (sensitive-data/Remote Data Authority policy), PR-3 (platform/action enforcement matrix), PR-4 (context capacity source).
  - `updated` bumped to 2026-07-17.
- **PRD addendum `prds/prd-thcode-2026-07-14/addendum.md`**
  - Added the no-unverified-context-capacity rule referencing PR-4.
- **Architecture `architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md`**
  - UX DESIGN.md and EXPERIENCE.md added as companions in the frontmatter.
  - AD-12 references the approved platform/action matrix prerequisite (PR-3).
  - AD-14 links to corrected FR-6 and PR-1.
  - AD-26 separated local Session deletion from new AD-26.1 conditional provider-side deletion (PR-2).
  - New AD-28 defines the five mechanically distinct protocol dimensions (operation status, lifecycle fact, Evidence completeness, measurement quality, process exit) and binds `ux-state-v1` to CoreProtocolV1.
  - Capability → Architecture Map updated to reference AD-26.1 and AD-28.
  - `updated` bumped to 2026-07-17.
- **UX `ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md`**
  - Canonical state vocabulary restructured into the five dimensions from AD-28.
  - `COMMAND_ERROR` documented as a fixed error heading layered over canonical `blocked`/`malformed`, not a registry row.
  - `effect-already-committed` reclassified as a nonterminal lifecycle fact; no longer maps to `SUCCESS=0`.
  - `percentage unavailable`, `estimated`, and `sanitized-with-omissions` reclassified as nonterminal Evidence/measurement qualifiers.
  - Provider-deletion lifecycle rows (`upstream-no-retention-verified`, `deletion-not-required`, `deletion-confirmed`) reclassified as nonterminal lifecycle facts conditional on a verified provider contract; `deletion-failed` remains terminal.
  - Sensitive-data transfer policy rewritten to make provider no-retention conditional on the approved policy matrix (PR-2) and verified provider contract; universal no-retention guarantee removed.
  - Upstream retention/deletion lifecycle section rewritten to make all five states conditional on a verified provider contract (AD-26.1).
- **Epics `epics.md`**
  - Frontmatter records `sprint-change-proposal-2026-07-17-applied` and the proposal as an input document.
  - Overview section now carries the implementation conventions introduced by the proposal (PR-1…PR-4 prerequisites, `dependsOn` metadata, stable fixture IDs/hashes, safety caps separate from NFR-14, brownfield baseline, Specialist Evidence envelope precedes consumers, context envelopes/persistence precede consumers, Epic 7 oversized stories decomposable).
  - Added a Pre-Implementation Gate section declaring PR-1…PR-4 and a Story dependency model section declaring `dependsOn`.
  - Story 1.1 acceptance criterion strengthened to inventory the existing brownfield `cli/` package, establish a passing baseline build/test, preserve the headless `CoreApp`/Ink boundary, and prohibit generated scaffold or wholesale rewrite.
  - Story 2.8 now owns mechanical validation of the full versioned `ux-state-v1` registry across the five AD-28 dimensions, including `COMMAND_ERROR`, `effect-already-committed`, and qualifier fixes; Story 7.18 becomes a parity audit of an already-frozen contract.
  - Epic 3 epic-level description references PR-3 and clarifies that Stories 3.1/3.7/3.11 fail closed only against an already-approved matrix.
  - Epic 4 epic-level description references PR-2 and records the internal record-order correction (Specialist Result/Evidence envelope precedes the four service integrations).
  - Epic 5 epic-level description records the context-envelope/persistence ordering correction and references PR-4.
  - Story 5.4 acceptance criterion corrected to remove the `128k → 115,200` fallback; before a verified limit exists, the denominator is `percentage unavailable` and no numeric percentage is emitted.
  - Epic 7 reclassified as a release-governance/certification workstream with oversized stories explicitly decomposable.
  - Story 7.2 renamed and rewritten to certify the already-approved PR-2 policy.
  - Story 7.3 renamed and rewritten to certify the already-approved PR-1 invalid-proposal decision.
  - Story 7.6 renamed and rewritten to certify the already-approved PR-3 matrix.

### Items intentionally not edited

- Per-story block reordering in Epic 4 (moving the immutable Specialist Result/Evidence envelope before Stories 4.10–4.13) and Epic 5 (moving envelopes/persistence before consumers) is recorded as an implementation convention rather than performed in this document, to preserve the traceability anchors and acceptance criteria already attached to each story ID. The convention is normative: a story that requires a durability contract before that contract's owning story is complete is blocked by `dependsOn`.
- Detailed sub-story decomposition of oversized Epic 7 stories (7.7, 7.13, 7.17, 7.18–7.20, 7.22) is left to implementation time, with the original story IDs preserved as traceability anchors.
- Historical review, reconcile, and memory-log files under the PRD, Architecture, and UX document sets are provenance and are not modified by this correction pass.

### Next step

Rerun the BMAD implementation readiness workflow to verify that the three critical forward dependencies, the two internal record-order defects, the state-registry semantics, and the fixture/safety-cap conventions no longer block Phase 4 implementation. Expected exit criteria: no unresolved normative conflict, no feature dependency on Epic 7 decisions, no forward persistence dependency, mechanically coherent state/exit contracts, independently completable stories, and reproducible fixtures.
