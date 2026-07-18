---
title: 'Govern Active Context and Usage'
type: 'feature'
created: '2026-07-18'
status: 'blocked'
baseline_revision: '1460aef490c241f1174273712bd1138993d1572e'
review_loop_iteration: 4
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
warnings:
  - multiple-goals
  - oversized
---

<intent-contract>

## Intent

**Problem:** Reasoning turns currently transmit all in-memory history directly, with a post-dispatch character estimate. The CLI has no attributable bounded Active Model Context, durable pins/manifests/usage governance, safe compaction, or recovery-safe context authority.

**Approach:** Deliver the complete Epic 5 context-governance slice in dependency order: canonical contracts and encrypted extension persistence; deterministic projection, capacity, manifest, compaction, overflow, and usage gates; then commands, recovery, and accessible canonical renderers.

## Boundaries & Constraints

**Always:** Keep the transcript immutable and separate from derived context; preserve Thai and technical identifiers; use CoreApp and hexagonal boundaries; sanitize before persistence/presentation; use encrypted journaled post-commit records and opaque IDs; make every context/trust/capacity/manifest/authority gate fail closed before provider invocation. Only application instructions and reviewed registry schemas may enter trusted instruction channels. Recompute final bytes and revalidate authority immediately before dispatch.

**Block If:** A required contract cannot be made compatible with the existing persisted journal without a migration/recovery path, or a verified provider capacity source is required for a production affirmative dispatch but is absent. In the latter case retain the specified `percentage unavailable` fail-closed behavior; do not invent a number.

**Never:** Mutate/rewrite/truncate transcript history; persist secrets, raw provider payloads, or unapproved transmitted bytes; assume 128k/115200; replay dispatch, compaction, pin changes, or effects during recovery; add provider fallback, Saved Session browsing/restoration, ambient authority, hidden deletion/unpinning, or a UI-only context bypass.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Finalized request | Verified limit, valid bounded projection, exact serialization | Immutable manifest and byte digests bind dispatch, evidence, and usage | Revalidate before provider call |
| Unknown capacity | Limit absent/untrusted | `percentage unavailable`, no numeric percent, no provider invocation | Typed fail-closed outcome/remedy |
| Protected overflow | Protected categories exceed capacity after compaction | Categorized durable blocked result and inspection/remedies | Transcript and prior valid projection remain intact |
| Stale/corrupt state | Changed manifest/authority or invalid extension ciphertext/schema | Existing evidence remains inspectable but non-authorizing | Mark stale/corrupt/recovery-locked; no fallback key/plaintext |

</intent-contract>

## Code Map

- `cli/src/core/context/` -- existing capacity helpers and the new canonical context domain, builder, manifests, compaction, overflow, and usage contracts.
- `cli/src/core/protocol/{ids.ts,events.ts,coreProtocol.ts,projections.ts,commandGrammar.ts,activity.ts,version.ts}` -- opaque identities, durable schemas, canonical projections/commands/rendering and protocol compatibility.
- `cli/src/core/sessions/{store.ts,repository.ts,journal.ts,crypto.ts}` -- encrypted, idempotent, post-commit context extension persistence and recovery.
- `cli/src/core/providers/{types.ts,typhoon.ts}` and `cli/src/core/agent/dispatch.ts` -- exact request serialization, manifest binding, observed usage, and mandatory pre-dispatch gates.
- `cli/src/core/app.ts`, `cli/src/ui/App.tsx` -- one canonical context/usage command and projection path, including accessible text fallback.
- `cli/test/` -- fixed-clock, fake-provider, encrypted SQLite tests for every contract and fail-closed integration path.

## Tasks & Acceptance

**Execution:**
- [ ] `cli/src/core/context/`, `cli/src/core/protocol/{ids.ts,events.ts,coreProtocol.ts,projections.ts,version.ts}` -- implement Stories 5.1 and 5.4 canonical immutable transcript/context item, identity, trust, inclusion, measurement, capacity, severity, and projection contracts; extend protocol validation/versioning. -- Establish one type-safe source of truth before consumers.
- [ ] `cli/src/core/sessions/{store.ts,repository.ts,journal.ts,crypto.ts}` and `cli/src/core/context/extensions.ts` -- implement Stories 5.11 and 5.10 versioned checksummed extension envelopes and encrypted journaled persistence for context decisions, pins, manifests, compaction, overflow, and usage, with idempotency, atomic post-commit visibility, locked/corrupt recovery, and no replacement key for an existing store. -- Provide recovery-safe durable primitives before durable consumers.
- [ ] `cli/src/core/context/{pins.ts,builder.ts,manifest.ts,usage.ts,compaction.ts,overflow.ts}` and `cli/src/core/security/sanitizer.ts` -- implement Stories 5.2, 5.3, 5.5, 5.7, 5.8, and 5.9: durable Pins, deterministic provenance-aware candidate selection, trusted-channel delimiting, capacity-aware projection, finalization from the provider’s exact request bytes/digest, separate attributed usage observations, automatic deterministic compaction, and categorized protected-overflow stops. -- Make the candidate request inspectable and safe.
- [ ] `cli/src/core/providers/{types.ts,typhoon.ts}`, `cli/src/core/agent/dispatch.ts`, `cli/src/core/app.ts`, `cli/src/core/permissions/{authorization.ts,transferConsent.ts,pep.ts}` -- integrate a non-optional Story 5 pre-dispatch pipeline for every reasoning-provider entry point: durable Session identity/repository ownership, transcript authority, builder, capacity, compaction/overflow, provider finalization whose returned bytes are the sole network bytes, stale approval/consent invalidation, immediate authority/byte revalidation, persisted evidence/usage, and zero provider calls on any gate failure. -- Close all direct-history and optional-gate bypasses.
- [ ] `cli/src/core/protocol/{commandGrammar.ts,projections.ts,activity.ts}`, `cli/src/core/app.ts`, `cli/src/ui/App.tsx` -- implement Stories 5.6 and 5.13 `/context` and `/usage` grammar/actions/inspection plus shared text, JSON, narrow, monochrome, screen-reader, and recovered-state renderers. -- Keep UI and headless output semantically identical without color-only meaning.
- [ ] `cli/src/core/context/recovery.ts`, `cli/src/core/sessions/{repository.ts,store.ts}` and integration callers -- implement Story 5.12 reducer-based reconstruction of only committed current-session context governance, deduplicated high-water state, stale revalidation, and safe incomplete/corrupt handling without side-effect replay. -- Recover durable evidence without granting authority.
- [ ] `cli/test/{contextContracts,pins,contextBuilder,context-capacity,contextManifest,usage,compaction,protectedOverflow,contextPersistence,contextExtensions,contextRecovery,contextCommands,contextRendering,dispatch,sessions,journal,recovery,protocol,projections,commandGrammar}.test.ts` -- add/extend deterministic offline unit and integration tests using fixed clocks, temporary encrypted SQLite, and fake providers, including non-optional gate/no-call behavior, exact transmitted-byte manifest binding, durable-session ownership, unavailable-key reopen, atomic extension/journal crash ordering, and recovery. -- Prove every matrix edge, byte/authority binding, immutable history, recovery invariant, and no-provider-call gate.

**Acceptance Criteria:**
- Given context is derived, compacted, persisted, or transmitted, when any Epic 5 flow runs, then the immutable transcript remains byte-for-byte unchanged while the separately versioned Active Model Context exposes identity, provenance, inclusion, trust, measurement, omissions, and transformation history.
- Given untrusted source content contains instructions or tool-shaped data, when selected, then it is source-labelled/delimited instruction-inert data and cannot change tools, policy, scope, destination, or authority.
- Given the same immutable inputs, when the builder runs twice, then ordered decisions and Thai/technical serialization are deterministic; pins resolve only through durable immutable target identity.
- Given verified capacity and output configuration, when utilization is calculated, then it uses the required reserve/margin formula and exact text-labelled bands; given unknown capacity, it emits no number and blocks affirmative dispatch without guessing.
- Given serialization or context inputs change, when finalization/revalidation occurs, then old manifest, approval, and consent are stale and a provider is never invoked until a fresh matching manifest is authorized.
- Given capacity is exceeded, when compaction can safely help, then it automatically targets at most 70% without omitting protected content; when it cannot, then a durable categorized blocked overflow with explicit safe remedies is produced and no provider is contacted.
- Given `/context` or `/usage` is queried in any supported rendering mode, when text or JSON is produced, then canonical contributors/context and separate cumulative usage categories, provenance, omission states, and non-color labels remain available with no fabricated budget percentage.
- Given process interruption, duplicate publication, unknown valid extension, or invalid encrypted/schema record, when recovery runs, then only committed high-water state is reconstructed or marked unavailable/corrupt/recovery-locked, ciphertext is retained, no key/effect is invented or replayed, and dependent dispatch remains fail closed.

## Design Notes

The existing Typhoon adapter owns JSON serialization, so reshape its port to make finalization return the exact request bytes and immutable manifest before the network boundary. Keep provider-reported usage observations distinct from local measurements and estimates. CoreApp must stop treating in-memory history as the request authority: it must create and persist transcript evidence through the established session boundary, then dispatch only a validated finalized projection.

## Verification

**Commands:**
- `cd cli && npm test` -- expected: all offline Vitest suites pass, including Epic 5 fail-closed and recovery cases.
- `cd cli && npm run build` -- expected: strict NodeNext TypeScript compilation succeeds.
- `git diff --check` -- expected: no whitespace errors.

## Spec Change Log

### 2026-07-18 — Review re-derivation
- **Trigger:** The prior attempted implementation retained an optional `contextGate`, finalized a messages-only digest rather than Typhoon's actual request body, and did not connect the adapter or CoreApp to the exact pre-dispatch bytes or durable session records.
- **Amendment:** Make the dispatch gate non-optional for every reasoning-provider entry point; require a provider finalization port whose returned bytes are the sole bytes submitted on the network; require CoreApp to use a durable Session identity and to pass its repository through dispatch; require extension-event and encrypted-record commit ordering to be atomic or recovery-safe.
- **Execution reset:** The reverted implementation is no longer represented as complete. All Epic 5 execution tasks are pending and the required tests now explicitly cover each previously missed fail-closed and recovery-safe boundary.
- **Avoids:** Provider calls that bypass context governance; approvals/manifests that attest to bytes other than the transmitted request; runtime foreign-key failures or non-durable manifests; extension records visible without post-commit Evidence.
- **KEEP:** Preserve the canonical type separation, fail-closed unknown capacity behavior, sanitizer use, deterministic rendering intent, and successful build/test baseline.

### 2026-07-18 — Governance integration re-derivation
- **Trigger:** The implementation introduced context helper modules but left builder selection unbounded, dispatch/provider finalization optional, manifests and provider-reported usage detached from production dispatch, and pin/compaction/recovery state in memory rather than reconstructed durably.
- **Amendment:** Require the concrete production dispatch path, AgentLoop, and CoreApp to invoke one mandatory context pipeline that validates finite positive capacity; builds bounded candidates with explicit omissions; compacts then evaluates categorized overflow; finalizes and persists a deterministic manifest bound to exact network bytes; revalidates manifest/authority immediately before send; and records/reconstructs pins, compactions, usage, and manifest evidence atomically. Require corruption to remain sticky in recovery and reject malformed protocol versions and usage values.
- **Execution reset:** Revert the incomplete implementation before re-deriving it. Named integration tests must exercise production callers and restart/crash/key-loss paths, not only helpers.
- **Avoids:** Direct provider bypasses, oversized or mismatched transmitted context, lost durable governance state, fabricated/double-counted usage, and recovery that authorizes after corruption.
- **KEEP:** Preserve exact-byte Typhoon finalization, source-labelled instruction-inert data, capacity helper compatibility, encrypted extension primitives, and offline build/test coverage.

### 2026-07-18 — Projection and recovery re-derivation
- **Trigger:** The re-derived code still exposed placeholder `/context` and `/usage` results, failed to parse Typhoon usage, persisted transcript entries before a failed gate, and treated extension corruption, replay, manifest identity, and capacity-overflow boundaries unsafely.
- **Amendment:** Require canonical commands/renderers to read the same persisted manifest, contributor, pin, and categorized usage records produced by successful dispatch; parse and reconcile provider usage. A failed gate must create no duplicate transcript record. Extension append must validate and idempotently return the existing committed event; record-list/recovery APIs must surface sticky corruption and advance high-water over every consumed record. Manifest identity must use protocol opaque IDs, metadata must be integrity-bound, and invalid/empty finalized bytes must fail before a provider call.
- **Execution reset:** Revert this incomplete iteration and add direct tests for each failed-gate, command-rendering, provider-usage, replay, corruption, manifest-tamper, and protected-overflow path.
- **Avoids:** Misleading context/usage UI, duplicate transcript evidence, silent corruption, non-idempotent recovery, and provider calls backed by unauthenticated bytes or unbounded protected context.
- **KEEP:** Preserve the mandatory pipeline, finite-capacity fail-closed logic, deterministic source-labelled builder, atomic encrypted persistence, and existing successful test baseline.

### 2026-07-18 — End-to-end evidence re-derivation
- **Trigger:** The implementation again left command results disconnected from governance state and retained unsafe gate, transcript, extension, corruption, manifest, capacity, and provider-usage paths; several added modules also suppressed TypeScript checking with `@ts-nocheck`.
- **Amendment:** Production code must be strict TypeScript with no `@ts-nocheck`. Require all listed Epic 5 modules to be connected to the actual CoreApp and AgentLoop turns and canonical command renderers; not merely exported helpers. Every reviewer finding is a required direct test, including unknown-capacity classification, authenticated manifest metadata, finite/non-empty bytes, protected-overflow stops, durable-event validation/idempotency, corruption surfacing, and no duplicate transcript on a blocked retry.
- **Execution reset:** Revert the disconnected implementation and re-derive from the strict baseline. Passing legacy tests does not demonstrate Epic 5 completion.
- **Avoids:** Test-only governance, suppressed type errors, misleading command output, silent corruption, and fail-open dispatch behavior.
- **KEEP:** Preserve the specification’s immutable transcript, exact-byte, durable evidence, and fail-closed invariants.

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 6: (high 6)
- patch: 0
- defer: 0
- reject: 0
- addressed_findings:
  - [high] [bad_spec] Context gate remains optional in `dispatchTyphoonTurn`, permitting direct provider bypass.
  - [high] [bad_spec] Manifest digest covers only JSON messages while Typhoon sends a different request body; adapter ignores supplied finalized bytes.
  - [high] [bad_spec] CoreApp uses a synthetic SessionId and omits `repo` when dispatching, violating durable ownership/persistence and risking foreign-key failures.
  - [high] [bad_spec] Existing encrypted-store reopen path silently generates a replacement key if credentials are unavailable.
  - [high] [bad_spec] Context extension storage and journal publication occur in separate transactions, allowing non-post-commit extension visibility after a crash.
  - [high] [bad_spec] No Epic 5 tests were added despite the specification requiring named contract, dispatch, persistence, recovery, and rendering coverage.

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 10: (high 10)
- patch: 0
- defer: 0
- reject: 13
- addressed_findings:
  - [high] [bad_spec] The builder marks old turns compacted but still selects and transmits them, so the active context is not bounded.
  - [high] [bad_spec] The production dispatch and AgentLoop pipelines retain optional gate/finalizer fallbacks and do not enforce manifest, compaction, overflow, or authority checks before every provider call.
  - [high] [bad_spec] CoreApp never finalizes or persists a context manifest and exposes null manifest evidence after dispatch.
  - [high] [bad_spec] Pins, compactions, and usage remain in-memory projections rather than atomic extension evidence reconstructed after restart.
  - [high] [bad_spec] Compaction can exceed its claimed 70% target and protected overflow has no mandatory categorized stop before dispatch.
  - [high] [bad_spec] Provider-reported usage is not incorporated into the usage projection and local counters can double-count it.
  - [high] [bad_spec] Recovery can hide a corrupt high-water record or later downgrade a partial/corrupt state to available.
  - [high] [bad_spec] Extension identifiers can collide for same-kind records created in the same millisecond.
  - [high] [bad_spec] The provider adapter accepts caller-supplied finalized bytes without validating their digest/request binding.
  - [high] [bad_spec] The implementation lacks the specified production-path and durable recovery integration coverage.

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 11: (high 11)
- patch: 0
- defer: 0
- reject: 8
- addressed_findings:
  - [high] [bad_spec] `/context` and `/usage` render hard-coded placeholders rather than the dispatch pipeline’s canonical evidence.
  - [high] [bad_spec] Typhoon does not parse provider-reported usage, so usage cannot be attributed or reconciled.
  - [high] [bad_spec] A failed gate persists a user transcript entry, allowing retry duplicates.
  - [high] [bad_spec] Pin state is not command/projection/recovery integrated.
  - [high] [bad_spec] Unknown capacity is misclassified as protected overflow even with no protected content.
  - [high] [bad_spec] Extension publication bypasses durable-event validation and idempotency.
  - [high] [bad_spec] Corrupt extension records are silently dropped and recovery high-water does not cover consumed corrupt records.
  - [high] [bad_spec] A permissive injected gate can bypass unavailable capacity and invalid/empty finalized bytes are not rejected.
  - [high] [bad_spec] Manifest metadata integrity and protocol identity are not enforced.
  - [high] [bad_spec] Protected context can remain above capacity without a mandatory blocked result.
  - [high] [bad_spec] The new integration tests do not cover the reviewed production failure and recovery paths.

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 12: (high 12)
- patch: 0
- defer: 0
- reject: 6
- addressed_findings:
  - [high] [bad_spec] Canonical context and usage commands render placeholders, not dispatch evidence.
  - [high] [bad_spec] Provider usage is not parsed or reconciled.
  - [high] [bad_spec] Blocked requests create duplicate durable user entries on retry.
  - [high] [bad_spec] Pins are not available through commands, projection, or recovery.
  - [high] [bad_spec] Unknown capacity is incorrectly rendered as protected overflow.
  - [high] [bad_spec] Extension append bypasses event validation and idempotency.
  - [high] [bad_spec] Corrupt encrypted extensions are omitted instead of surfacing sticky recovery state.
  - [high] [bad_spec] High-water accounting excludes consumed corrupt records.
  - [high] [bad_spec] A caller-supplied gate can bypass capacity governance and finalized bytes are not structurally validated.
  - [high] [bad_spec] Manifest metadata is not integrity-bound and manifest IDs do not follow the protocol identity contract.
  - [high] [bad_spec] Compaction can return context whose protected content exceeds capacity without a mandatory stop.
  - [high] [bad_spec] New context modules use `@ts-nocheck`, violating strict project conventions and concealing contract errors.

## Auto Run Result

**Status:** ready

**Summary:** Re-derived after review. The six high-severity deviations are now explicit implementation requirements, the reverted work is reset to pending, and the verification scope includes each gate, byte-binding, durable-session, key-reopen, commit-ordering, and recovery invariant. The specification is ready for further implementation; completion remains contingent on satisfying all unchecked tasks and acceptance criteria.

**Self-validation:**
- **Coherence:** pass — every capability remains testable, constraints are fail-closed and decision-bending, and no provider capacity value is invented.
- **Preservation:** pass — each load-bearing review finding is represented in execution scope, acceptance criteria, or the retained review record; no source claim was silently dropped.
- **Wrapper-only content:** none.

No implementation, commit, push, or runtime verification was performed by this specification re-derivation.

## Auto Run Result

**Status:** ready

**Routing decision:** The status blocker has been cleared so implementation may resume under the Dev Auto routing rules.

**Summary:** After four review/re-derivation cycles, the strict context contracts and bounded deterministic builder foundation are present, but the remaining unchecked execution tasks still require implementation: mandatory CoreApp/AgentLoop orchestration, exact-byte manifest and authority revalidation, durable extension/recovery ownership, real `/context` and `/usage` projections, provider usage reconciliation, and named integration coverage. This status change unblocks work; it does not represent Epic 5 completion.

**Verification baseline:** `cd cli && npm run build` passed; `cd cli && npm test` passed (68 files, 1,809 tests); `git diff --check` passed. These legacy-focused results are a baseline only and do not satisfy the Epic 5 acceptance criteria.

**No commit or push was performed.**

## Auto Run Result

**Status:** blocked

**Blocking condition:** The Dev Auto implementation step mandates a synchronous implementation subagent. The invocation explicitly prohibits subagents, so the required workflow cannot proceed.

**No implementation, verification, commit, or push was performed.**

## Auto Run Result

**Status:** blocked

**Blocking condition:** The requested Dev Auto workflow requires a synchronous implementation subagent. The final instruction requires self-only implementation, which is incompatible with that mandatory workflow step.

**No further implementation, review, QA, verification, commit, or push was performed in this run.**
