---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
inputDocuments:
  prd:
    - prds/prd-thcode-2026-07-14/prd.md
    - prds/prd-thcode-2026-07-14/addendum.md
  architecture:
    - architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md
  epics:
    - epics.md
  ux:
    - ux-designs/ux-thcode-2026-07-17/DESIGN.md
    - ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md
trigger:
  - sprint-change-proposal-2026-07-17.md
priorReport:
  - implementation-readiness-report-2026-07-17.md
---

# Implementation Readiness Assessment Report — Reassessment

**Date:** 2026-07-17
**Project:** thcode
**Trigger:** Sprint Change Proposal `sprint-change-proposal-2026-07-17.md` (status: implemented)
**Prior report:** `implementation-readiness-report-2026-07-17.md` (verdict: NOT READY)

This reassessment verifies whether the corrections applied by the approved Sprint Change Proposal cleared the blockers identified in the prior report. The prior report's findings are reused as the test set; only delta analysis and any new issues are examined in depth.

## Document Inventory

### PRD

- `prds/prd-thcode-2026-07-14/prd.md` — primary PRD, `updated: 2026-07-17`
- `prds/prd-thcode-2026-07-14/addendum.md` — PRD addendum (no frontmatter date; body updated for PR-4)

### Architecture

- `architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md` — `updated: 2026-07-17`; UX companions added

### Epics and Stories

- `epics.md` — `finalValidationStatus: dependency-safe-after-sprint-change-proposal`; `sprint-change-proposal-2026-07-17-applied` recorded in stepsCompleted

### UX Design

- `ux-designs/ux-thcode-2026-07-17/DESIGN.md` — unchanged
- `ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md` — state registry restructured into five dimensions; sensitive-data policy rewritten

### Sprint Change Proposal

- `sprint-change-proposal-2026-07-17.md` — `status: implemented`; Section 8 Execution Log records exactly what was changed

### Discovery Issues

- No new documents were created by the correction pass; the four canonical artifacts were edited in place.
- The prior 2026-07-17 readiness report is preserved for comparison; this reassessment is written to a distinct filename.

## PRD Analysis

### Functional Requirements

The 39 FRs and 15 NFRs are unchanged in count. The corrections touched FR-6 and added §12.1 without altering any other FR/NFR text.

**FR-6 — Local Agent Loop (corrected).** The prior conflict — "thcode may request a bounded, recorded schema repair or retry" — has been replaced with: "thcode rejects an invalid structured proposal after one local schema-validation pass; the validation error is recorded and surfaced as the terminal outcome. Release 1 makes no model repair request, provider retry, protocol reinterpretation, action substitution, or policy relaxation for an invalid proposal." The Non-Goals section was aligned to the same rule. FR-6 now agrees with Architecture AD-14. ✅ Conflict resolved.

### New §12.1 Approved Prerequisites Before Feature Epics

The PRD gained a normative subsection declaring four prerequisites that must be approved before their consuming feature epics begin:

- **PR-1 — Invalid structured-proposal behavior.** Single authoritative rule for FR-6 and AD-14; no later epic or story may re-decide it.
- **PR-2 — Sensitive-data and Remote Data Authority policy.** Approved before Epic 4; provider retention/deletion handling verified per configuration; no-retention preferred but not universal; provider-side deletion conditional on verified provider contract.
- **PR-3 — Platform/action enforcement matrix.** Approved before Epic 3; Epic 7 certifies the already-defined matrix.
- **PR-4 — Context capacity source.** No `128k` raw limit or `115,200` fallback capacity is a release commitment without a named provider/product decision; UI shows `percentage unavailable` until a verified limit exists.

These prerequisites are separated from the existing §12 Deferred Release Decisions, which remain release gates (repository governance, numeric performance budgets, sensitive-data policy final certification, platform matrix final certification, exact Typhoon pin). The PRD is explicit that PR-1/PR-2/PR-3 resolve the implementation-blocking dimensions of Deferred Decisions 3 and 5 while leaving final release certification in §12. ✅ Prerequisites are normative and correctly scoped.

### PRD Completeness Assessment

The PRD remains comprehensive and is now internally consistent on invalid-proposal behavior and on the four prerequisites. No FR was lost, added, or weakened. NFR-14 (numeric performance budgets) remains correctly deferred as a release gate. The addendum's Effective Context Capacity entry was extended to record the no-unverified-capacity rule and reference PR-4.

## Epic Coverage Validation

### Coverage Statistics

- **Total PRD FRs:** 39
- **FRs claimed in the explicit epic coverage map:** 39
- **FRs with story-level implementation paths:** 39
- **Missing FRs:** 0
- **Extraneous product FR identifiers:** 0
- **Coverage:** 100%

The corrections did not add, remove, or reassign any FR to a different epic. The epic-level coverage map and story-level `Requirements` lines are unchanged. ✅ Coverage preserved.

### Dependency model

The epics document now declares a **Story dependency model** section: every story carries `dependsOn` metadata listing story IDs or prerequisite IDs (PR-1…PR-4); forward edges to a later story or epic are rejected, with one exception for certification stories that consume already-produced evidence. The `dependsOn` graph is to be generated and mechanically verified before any story begins implementation.

This resolves the prior m4 concern (traceability stronger than the explicit dependency model). The remaining work — generating the literal `dependsOn` edges for every story and running a cycle/forward-edge check — is an implementation-time mechanical task, not a planning defect.

## UX Alignment Assessment

### UX ↔ PRD Alignment

#### Critical conflict 1 — Invalid structured-proposal behavior

**Status: RESOLVED.** PRD FR-6 and Architecture AD-14 now prescribe one rule (reject after one local validation pass; no repair). The UX `malformed` state already matched this rule. All three artifacts agree.

#### Critical conflict 2 — UX declares a sensitive-transfer policy the PRD left unresolved

**Status: RESOLVED.** PR-2 is approved before Epic 4 and the UX sensitive-data transfer policy has been rewritten to be conditional on the approved policy matrix and a verified provider contract. The UX no longer claims a universal "committed" no-retention guarantee. The consent disclosure now states the verified handling for the exact configuration rather than a blanket `Provider handling verified: no retention; deletion handling verified.`

#### High conflict 3 — Provider-side deletion states beyond the PRD contract

**Status: RESOLVED.** Architecture AD-26.1 makes provider-side deletion lifecycle states conditional on a verified provider contract that supports them. The UX upstream retention/deletion lifecycle section now states that all five statuses are conditional on a verified provider contract; if the contract does not support a deletion lifecycle, no provider-deletion lifecycle state is published and the transfer is `BLOCKED`. The provider-deletion lifecycle rows in the registry are reclassified as nonterminal lifecycle facts (not terminal `SUCCESS` outcomes), with only `deletion-failed` remaining terminal.

#### High conflict 4 — Context fallback capacity value not sourced

**Status: RESOLVED.** PR-4 declares that no `128k` raw limit or `115,200` fallback capacity is a release commitment without a named provider/product decision. Story 5.4's acceptance criterion was rewritten to remove the fallback and emit `percentage unavailable` until a verified limit exists. The addendum's Effective Context Capacity entry records the same rule.

#### Moderate conflict 5 — `COMMAND_ERROR` outside the 73-row registry

**Status: RESOLVED.** UX now documents `COMMAND_ERROR` as a fixed error display heading layered over a canonical operation status of `blocked` or `malformed`, not a distinct operation status and not an additional registry row. Architecture AD-28 records the same rule. The claimed row count is no longer contradicted.

#### Moderate conflict 6 — `effect-already-committed` mapped to `SUCCESS=0`

**Status: RESOLVED.** The UX registry now records `effect-already-committed` as a nonterminal lifecycle fact with exit class `NONE` and exit code `null`. The behavior row states it is NOT a success outcome and that the underlying effect outcome is observed separately. Architecture AD-28 records the same rule.

#### Moderate conflict 7 — Evidence qualifiers treated as terminal operation outcomes

**Status: RESOLVED.** `percentage unavailable`, `estimated`, and `sanitized-with-omissions` are now recorded as nonterminal Evidence/measurement qualifiers with exit class `NONE`. Architecture AD-28 defines the five mechanically distinct dimensions (operation status, lifecycle fact, Evidence completeness, measurement quality, process exit) and forbids conflating them.

### UX ↔ Architecture Alignment

#### Architecture gaps requiring closure

- **UX documents not listed as architecture companions:** RESOLVED. The Architecture Spine frontmatter now lists `DESIGN.md` and `EXPERIENCE.md` as companions.
- **State/exit contract underspecified:** RESOLVED. New AD-28 binds `ux-state-v1` to CoreProtocolV1 and defines the five dimensions, the `COMMAND_ERROR` heading rule, the `effect-already-committed` lifecycle-fact rule, and the qualifier rule.
- **Platform/action matrix as a named dependency:** RESOLVED. AD-12 now records the approved matrix as a prerequisite before Epic 3 (PR-3).
- **Numeric responsiveness budgets:** correctly remains deferred under NFR-14. No change expected.
- **Exact Typhoon pin, service contracts, security reporting:** correctly remain release gates. No change expected.

### Warnings

- ⚠️ The literal per-story block reordering in Epic 4 (Specialist Result/Evidence envelope before Stories 4.10–4.13) and Epic 5 (context extension envelopes/persistence before consumers) is recorded as an implementation convention rather than performed by moving story blocks in the document. This is acceptable because the convention is normative: a story requiring a durability contract before that contract's owning story is complete is blocked by `dependsOn`. Implementation must honor the convention.
- ⚠️ Per-story stable fixture IDs, hashes, expected outputs, tolerances, and failure variants are recorded as a global convention in the Overview but are not yet enumerated per story. This is an implementation-time elaboration, not a planning blocker, but the readiness assessor should re-check during the first story that uses a deterministic fixture.

### UX Readiness Conclusion

UX readiness is now **fully aligned** for the conflicts the proposal targeted. The seven conflicts listed above are all resolved. The remaining UX release-audit items (per-state surface closure, keyboard matrix, approval safety) are certification work for Story 7.18 and were already classified as release audit checks rather than missing-design defects in the prior report.

## Epic Quality Review

### Critical Violations

#### C1 — Structured-proposal behavior implemented before the decision

**Status: RESOLVED.** PR-1 is the single authoritative rule. PRD FR-6 and Architecture AD-14 both carry it. Story 7.3 has been rewritten as "Certify product and architecture traceability decisions" and certifies the already-approved PR-1 rather than deciding it. The acceptance criterion no longer treats the PRD/Architecture conflict as open. Stories 1.9, 3.9, and 4.9 implement under an already-approved rule.

#### C2 — Epic 4 depends on Epic 7's sensitive-data policy

**Status: RESOLVED.** PR-2 is approved before Epic 4 begins. Epic 4's epic-level description references PR-2 and Architecture AD-26.1. Story 7.2 has been rewritten as "Certify the approved sensitive-data and Remote Data Authority policy" and certifies the already-approved policy. The forward dependency is removed.

#### C3 — Epic 3 depends on platform/action matrix from Epic 7

**Status: RESOLVED.** PR-3 is approved before Epic 3 begins. Epic 3's epic-level description references PR-3 and clarifies that Stories 3.1, 3.7, and 3.11 fail closed only against an already-approved matrix. Story 7.6 has been rewritten as "Certify the approved versioned Windows/macOS platform-action enforcement matrix." The forward dependency is removed.

### Major Issues

#### M1 — Specialist integrations precede durable Evidence

**Status: RESOLVED (as convention).** Epic 4's epic-level description records the internal record-order correction: the immutable Specialist Result/Evidence envelope and ownership foundation (Story 4.14 in the prior plan) is established before the four service integrations (Stories 4.10–4.13). The Overview carries the same convention normatively. Literal story block reordering was not performed in the document; implementation must honor the convention through `dependsOn` edges. This is acceptable for planning readiness.

#### M2 — Context consumers precede extension-envelope/persistence

**Status: RESOLVED (as convention).** Epic 5's epic-level description records the ordering correction: versioned context extension envelopes (Story 5.11) and encrypted/journaled persistence (Story 5.10) are established before durable pins, usage ledger, compaction, overflow, recovery, and rendering stories. The Overview carries the same convention. Literal block reordering was not performed; implementation must honor `dependsOn`.

#### M3 — Epic 7 is a release-governance workstream, not a product epic

**Status: RESOLVED.** Epic 7's epic-level description now explicitly states it is a release-governance/certification workstream, not a normal product epic. Prerequisites PR-1/PR-2/PR-3 are approved before their consuming feature epics. Epic 7 verifies and certifies already-approved artifacts and release evidence.

#### M4 — Brownfield baseline not tested in Story 1.1

**Status: RESOLVED.** Story 1.1 has a new acceptance criterion that inventories the existing `cli/` package, establishes a passing baseline build/test run before changes, preserves the headless `CoreApp`/Ink boundary, prohibits generated scaffold or wholesale rewrite, and records the baseline build/test command, expected passing count, current entry points, and integration seams as Evidence. A `dependsOn` line references PR-3.

#### M5 — Mechanical ownership of ux-state-v1 incomplete

**Status: RESOLVED.** Story 2.8 now owns mechanical validation of the full versioned `ux-state-v1` registry across the five AD-28 dimensions. The acceptance criterion explicitly handles `COMMAND_ERROR`, `effect-already-committed`, and the qualifier reclassifications. Story 7.18 is now a parity audit of an already-frozen contract, not the first validator. A `dependsOn` line references PR-1, Story 1.2, and Story 1.3.

#### M6 — Fixture-based criteria not objectively bounded

**Status: PARTIALLY RESOLVED.** The Overview now carries a global convention requiring stable fixture IDs, source hashes, exact inputs, expected normalized outputs, tolerances, and failure variants, plus named versioned retry/backoff and resource-limit policies with concrete test values. This addresses the rule. Per-story fixture enumeration is still to be applied during implementation. This is an implementation-time elaboration; the planning blocker (no normative rule) is removed, but the assessor should re-check during the first fixture-using story.

#### M7 — Oversized certification stories

**Status: PARTIALLY RESOLVED.** Epic 7's epic-level description now explicitly permits Stories 7.7, 7.13, 7.17, 7.18–7.20, and 7.22 to be decomposed into independently owned evidence producers followed by small aggregate manifest/gate stories, with original story IDs preserved as traceability anchors. Actual decomposition is deferred to implementation time. The planning blocker (no permission to split) is removed; the splitting itself is implementation work.

### Minor Concerns

#### m1 — Story 1.1 installation criteria not self-contained

**Status: PARTIALLY RESOLVED.** Story 1.1 now carries the brownfield baseline criterion and a `dependsOn` line. Exact development package fixture and exact installation/launch expectations are still to be elaborated at implementation time. The prior recommendation to define a development package fixture in Story 1.1 remains valid as an implementation task.

#### m2 — Some stories combine many output modes and lifecycle states

**Status: UNCHANGED (acceptable).** Stories 2.14, 4.20, 5.13, 6.13, and several Epic 7 audits still span many output modes. The prior recommendation to split canonical projection/domain behavior from surface integration remains valid as an implementation-time option. This was not a planning blocker.

#### m3 — Numeric resource ceilings deferred despite enforcement language

**Status: RESOLVED.** The Overview now carries a convention separating safety caps from NFR-14 performance SLOs: implementation-safe default caps (artifact size, recursion depth, search work, process count, Prompt Round wall time, transfer bytes) are defined before consuming stories in the versioned registry or its referenced policy and may be tuned by Epic 7 release budgets later. Architecture AD-28 records the same rule.

#### m4 — Traceability stronger than the explicit dependency model

**Status: RESOLVED (as convention).** The Story dependency model section declares `dependsOn` for every story and rejects forward edges. Generating the literal graph and running the cycle/forward-edge check is an implementation-time mechanical task. The planning blocker (no dependency rule) is removed.

### Database and Entity Timing Assessment

The prior assessment found no physical table-timing defect; the defects were logical record-contract timing. Those logical defects (Specialist Evidence ownership after consumers; context envelopes/persistence after consumers) are now resolved as implementation conventions (M1, M2). No new entity-timing issue was introduced.

### Starter and Existing-Code Assessment

The brownfield baseline is now acceptance-tested in Story 1.1 (M4). No starter template is required. CI/CD release validation remains extensive and decomposable per M7.

### Epic Quality Conclusion

All three critical violations are resolved. All seven major issues are resolved or resolved-as-convention with implementation-time follow-up. The minor concerns are resolved, partially resolved with implementation-time follow-up, or unchanged-but-acceptable. The epic plan is now dependency-safe at the planning level; the remaining work is implementation-time elaboration of conventions already declared normatively.

## Summary and Recommendations

### Overall Readiness Status

# READY WITH RESIDUAL IMPLEMENTATION-TIME ITEMS

The project is ready to begin Phase 4 implementation against the corrected story order. The Sprint Change Proposal cleared all three critical forward-dependency violations, both internal record-order defects (as normative conventions), the state-registry semantic defects, the brownfield baseline gap, and the safety-cap/dependency-model gaps. The remaining items are implementation-time elaborations of conventions already declared in the planning artifacts, not planning blockers.

### Resolved by the Sprint Change Proposal

- ✅ C1 — Invalid structured-proposal behavior (PR-1)
- ✅ C2 — Epic 4 depends on Epic 7's sensitive-data policy (PR-2)
- ✅ C3 — Epic 3 depends on platform/action matrix from Epic 7 (PR-3)
- ✅ M1 — Specialist integrations precede durable Evidence (convention)
- ✅ M2 — Context consumers precede extension-envelope/persistence (convention)
- ✅ M3 — Epic 7 reclassified as release-governance/certification workstream
- ✅ M4 — Brownfield baseline acceptance-tested in Story 1.1
- ✅ M5 — Story 2.8 owns full ux-state-v1 mechanical validation
- ✅ m3 — Safety caps separated from NFR-14 performance SLOs
- ✅ m4 — Story dependency model declared
- ✅ UX conflict 1 — Invalid structured-proposal behavior
- ✅ UX conflict 2 — Sensitive-transfer policy authority (PR-2)
- ✅ UX conflict 3 — Provider-side deletion scope (AD-26.1)
- ✅ UX conflict 4 — Context fallback capacity source (PR-4)
- ✅ UX conflict 5 — `COMMAND_ERROR` outside the registry
- ✅ UX conflict 6 — `effect-already-committed` false success
- ✅ UX conflict 7 — Evidence qualifiers as terminal outcomes
- ✅ Architecture gap — UX companions
- ✅ Architecture gap — State/exit contract (AD-28)

### Partially resolved (implementation-time follow-up)

- ⚠️ M6 — Fixture-based criteria: global convention declared; per-story fixture IDs/hashes to be enumerated during implementation. Re-check at the first fixture-using story.
- ⚠️ M7 — Oversized certification stories: splitting permitted and traceability anchors preserved; actual decomposition deferred to implementation.
- ⚠️ m1 — Story 1.1 installation criteria: brownfield baseline added; exact development package fixture to be elaborated at implementation.

### Unchanged (acceptable, not blockers)

- ➖ m2 — Some stories combine many output modes and lifecycle states. Splitting canonical projection/domain from surface integration remains an implementation-time option.

### Cross-cutting release gates (correctly still deferred)

- 📋 NFR-14 numeric performance budgets — release gate, Story 7.5.
- 📋 Exact Typhoon model/endpoint/adapter pin — release gate, Story 7.4.
- 📋 Repository governance and private security reporting — release gate, Story 7.1.
- 📋 Approved provider-handling evidence for public enablement — release gate, Story 7.2 certification.

These are deferred by design and are not implementation blockers for Phase 4 feature work.

### New issues introduced by the corrections

None. The corrections did not introduce new conflicts, new forward dependencies, or new scope. The PRD, Architecture, UX, and Epics now prescribe one invalid-proposal rule, one sensitive-data policy authority, one platform matrix prerequisite, and one context-capacity source rule.

### Recommended next steps

1. Generate the literal `dependsOn` graph for every story from the conventions declared in the epics Overview and Pre-Implementation Gate section, and mechanically reject any forward edge before the dependent story begins.
2. Enumerate per-story stable fixture IDs, hashes, expected outputs, tolerances, and failure variants at the start of the first story that uses a deterministic fixture.
3. Honor the Epic 4 and Epic 5 record-order conventions: a story requiring a durability contract before that contract's owning story is complete is blocked.
4. Begin Phase 4 implementation with Story 1.1 (brownfield baseline) and proceed through Epic 1. Effectful Epic 3 and Specialist Epic 4 work may begin once PR-3 and PR-2 respectively are confirmed approved and Story 1.x foundations are in place.
5. Decompose oversized Epic 7 stories into independently owned evidence producers as implementation reaches them.

### Final note

The Sprint Change Proposal achieved its goal: the planning artifacts are now dependency-safe at the planning level. The prior NOT READY verdict is superseded. Phase 4 implementation may proceed, with the residual implementation-time items tracked as explicit tasks rather than planning blockers.

**Assessment date:** 2026-07-17
**Assessor:** BMAD Implementation Readiness workflow (reassessment after Sprint Change Proposal implementation)