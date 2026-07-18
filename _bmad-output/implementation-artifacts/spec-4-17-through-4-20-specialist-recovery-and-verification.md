---
title: 'Stories 4.17–4.20: Complete Specialist recovery and verification'
type: 'feature'
created: '2026-07-18'
status: 'done'
review_loop_iteration: 0
baseline_revision: '7936c601e2d3955ed1534e11dcdf933d108c14f4'
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-15-reuse-force-fresh-retain-and-invalidate-specialist-cache-evidence.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-9-establish-shared-specialist-adapter-result-and-failure-contracts.md'
warnings:
  - multiple-goals
---

<intent-contract>

## Intent

**Problem:** Epic 4 has shipped its four Specialist services, immutable Evidence/cache behavior, and deterministic scoped failure quarantine through Story 4.16. It lacks the explicit live retest that can safely restore only a proven scope and lacks the final contract, prompt-flow, recovery, and output-parity verification required to close the epic.

**Approach:** Add a typed, application-owned explicit retest/recovery operation built on the existing generation-bound Specialist health lifecycle. Then add deterministic, offline verification suites for the registry/adapter contract matrix, four service prompt flows, and the combined failure/cache/retest/projection matrix without inventing a hosted proxy, fallback service, or release certification claim.

## Boundaries & Constraints

**Always:** Retest is explicit, visible, and creates a new effective configuration generation before a live probe. It enters `checking`, rejects stale probe results, and restores only the service or credential-group scope proved healthy by the current-generation result. Failed, cancelled, stale, and unknown retests never restore availability; no automatic equivalent retry occurs. Use existing registry, adapter, consent, cache, Evidence, classifier, and health contracts; all tests run offline with fixed clocks, fake transport/probes, and no real credentials or network. Preserve canonical state/category tokens, secret-safe projections, exact consent binding, direct-local-CLI topology, and cache lookup-before-health behavior.

**Block If:** Existing Specialist health probes cannot express a deterministic live-probe outcome and a typed cancelled/unknown outcome without weakening the health lifecycle or inventing provider behavior.

**Never:** Do not treat catalog `retestService()` advice as a successful retest; silently restore availability; broaden recovery/quarantine beyond proven service or shared credential scope; replay an unknown outcome; mutate or delete prior Evidence for force-fresh/retest; introduce fallback routing, a proxy/client-server path, Typhoon credentials, outbound payload persistence, real provider calls, or unrelated platform/release certification.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Service retest passes | Corrected service-specific configuration and current live probe pass | New generation progresses `checking` → `available`; only that service is restored with timestamp, origin, and Evidence/probe reference | No automatic retry |
| Shared-key retest passes | Corrected shared credential configuration and group proof pass | All four dependent services restore atomically for their current generations | No partial/contradictory restoration |
| Retest does not pass | Probe fails, is cancelled, stale, or unknown | Service/group remains unavailable or quarantined with typed outcome and next action | Never reuse stale success or replay |
| Contract rejection | Malformed/revoked/non-invokable registry or invalid consent/generation/request | Deterministic refusal and zero transport calls | No repair, substitution, or retry |
| Prompt flow | One Thai/mixed prompt and deterministic fixture per launch service | Only intended service runs through route, artifact, consent, direct adapter, and sealed Evidence | Typed refusal/denial/unavailable for invalid paths |
| Recovery/cache parity | Quarantined valid cache, force-fresh unavailable, classified failures, output modes | Reuse preserves original Evidence/no transfer; force-fresh requires exact current availability; semantic projections retain canonical identities/tokens | No color-only meaning or silent fallback |

</intent-contract>

## Code Map

- `cli/src/core/app.ts` -- owns Specialist configuration construction, health check, invocation, catalog command surface, and the new explicit retest orchestration seam.
- `cli/src/core/specialists/health/lifecycle.ts` and `types.ts` -- generation-bound probe registration/checking/quarantine primitives that must gain only the recovery semantics not already represented.
- `cli/src/core/specialists/catalog/controls.ts` -- current advisory Retest control; update its projection/intent integration so it cannot misrepresent advice as completed recovery.
- `cli/src/core/specialists/classification/*` -- established failure scope/quarantine behavior reused by recovery and cross-cutting fixtures.
- `cli/src/core/specialists/{registry,adapter,services,routing,artifacts,consent,evidence}/` -- existing contracts and deterministic fixtures to exercise, not replace.
- `cli/test/specialistHealth.test.ts` and `cli/test/specialistClassification.test.ts` -- extend with retest/recovery generation and scope cases.
- `cli/test/specialistContractMatrix.test.ts` -- new all-service registry/shared-adapter contract matrix.
- `cli/test/specialistPromptFlows.test.ts` -- new composed offline four-service prompt-flow verification.
- `cli/test/specialistRecoveryVerification.test.ts` and `cli/test/specialistLiveRetest.test.ts` -- deterministic failure/cache/quarantine/retest/projection verification matrix and CoreApp live-canary command coverage.

## Tasks & Acceptance

**Execution:**
- [x] `cli/src/core/specialists/health/types.ts`, `lifecycle.ts`, `probe.ts`, and `../../providers/health.ts` -- define typed retest outcomes, approved static-canary probes, and atomic current-generation group commits.
- [x] `cli/src/core/app.ts` -- register live service probes, create opaque fresh retest generations, restore only proven service/group scope, and expose async retest command output.
- [x] `cli/src/core/specialists/catalog/controls.ts` -- identify Retest as a live action and preserve its current recovery state without claiming advisory output executed it.
- [x] `cli/specialists-manifest.json` and `cli/src/core/specialists/{registry,adapter,services}/` -- bind every invokable service to a validated non-user static canary and direct service-specific health request.
- [x] `cli/test/specialistHealth.test.ts`, `cli/test/specialistClassification.test.ts`, `cli/test/specialistRecoveryVerification.test.ts`, and `cli/test/specialistLiveRetest.test.ts` -- cover generation, pass/failure/cancelled/unknown outcomes, scoped/group recovery, atomicity, and no-credential fail-closed behavior.
- [x] `cli/test/specialistContractMatrix.test.ts` -- cover all reviewed services’ manifest/canary, secret-free request, and direct health result contracts.
- [x] `cli/test/specialistPromptFlows.test.ts` -- cover one deterministic Thai/mixed route per launch service plus unavailable no-fallback behavior.
- [x] `cli/test/specialistCache.test.ts`, `cli/test/specialistEvidence.test.ts`, and `cli/test/specialistCatalog.test.ts` -- retain cache/force-fresh, Evidence, and output-mode semantic parity coverage.

**Acceptance Criteria:**
- Given a Specialist is unavailable, unhealthy, or quarantined, when the user explicitly initiates a corrected retest, then a new configuration generation visibly enters `checking` and only a passing current-generation live probe restores the proven service or shared credential scope.
- Given a retest probe fails, is cancelled, becomes stale, or has an unknown outcome, when its result is handled, then prior unavailability/quarantine remains authoritative and no automatic equivalent retry or stale-success restoration occurs.
- Given deterministic fixtures for all reviewed launch services, when the registry/shared-adapter matrix runs, then valid requests preserve contract, consent, attribution, and direct-transport semantics while malformed, revoked, non-invokable, stale, or mismatched requests fail closed before transport.
- Given a deterministic Thai or mixed-language prompt for each service, when its composed Specialist flow completes, then exactly the intended service is invoked and sealed Evidence preserves source, configuration, consent, returned/empty fields, uncertainty, timing, and provenance.
- Given classified failures, quarantined cache hits, force-fresh requests, and retest outcomes, when verification projections are rendered in each supported Specialist output mode, then canonical tokens, identities, Evidence headings, scopes, reuse state, and reasons are semantically equivalent without color dependence.
- Given the final Epic 4 verification suites run, when they report results, then they report Specialist-domain observations only and make no unrelated release, platform, or certification claim.

## Spec Change Log

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 1: (high 1)
- bad_spec: 0
- patch: 1: (low 1)
- defer: 0
- reject: 0
- addressed_findings:
  - `[low]` `[patch]` Credential-group retest fell back to a single-service retest while retaining `scope: 'credential-group'`, which falsely labeled the recovery scope. The fallback now returns `scope: 'service'`.
  - `[high]` `[intent_gap]` `CoreApp.retestSpecialist()` creates a new generation but no production Specialist health probe is registered and `/tools retest` remains synchronous advisory output. The current code therefore returns `probe-missing` rather than executing a real CLI-live retest. The reviewed registry/adapter contracts do not provide an approved per-service health request/response contract or an asynchronous command integration, so implementing one would invent provider behavior.

### 2026-07-18 — Completion review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (medium 2)
- defer: 0
- reject: 0
- addressed_findings:
  - `[medium]` `[patch]` The initial retest implementation registered no production Specialist probe. Added versioned reviewed static capability canaries, service-specific health request/response validation, direct transport wiring, and fail-closed canary validation.
  - `[medium]` `[patch]` Shared-key retest could report a group result without proving all current service configurations and could transiently restore an individual member. It now builds/proves every invokable member, stages all probes, and commits availability only when every current generation passes.

## Auto Run Result

**Status:** done

**Summary:** Completed the remaining Epic 4 recovery and verification scope. Each reviewed service now has a versioned non-user static capability canary, CoreApp registers and executes direct health probes, explicit retests use fresh opaque generations, and shared-key recovery commits atomically. The async `/tools retest` path emits truthful final state, scope, generation, Evidence reference, and next action while the synchronous path remains advisory.

**Verification performed:**
- `cd cli && npm test` — 68 files, 1,809 tests passed.
- `cd cli && npm run build` — passed.
- `git diff --check` — passed.
- Runtime verification — the built CLI correctly failed closed in headless mode before any Specialist call; direct interactive invocation is unavailable in this session because the CLI requires a TTY.

**Residual risks:** Static canary requests consume the provider’s normal API quota when a real credential is present. They contain only reviewed built-in fixtures and never use user/workspace data. Production provider behavior remains fail-closed when the manifest, credential, canary, or service response is invalid.

## Design Notes

The existing `SpecialistHealthLifecycle` already rejects stale results and atomically quarantines a credential group. The new API must build on those facts rather than recreating health state in catalog controls. A retest result must identify the recovery scope and generation so the UI and headless projections cannot confuse a recommendation, background check, historical success, and an explicit current live check.

## Verification

**Commands:**
- `cd cli && npm test` -- expected: all deterministic Specialist and existing offline suites pass.
- `cd cli && npm run build` -- expected: strict TypeScript build succeeds with no unused or boundary errors.
