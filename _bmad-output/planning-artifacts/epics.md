---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
  - sprint-change-proposal-2026-07-17-applied
extractionStatus: complete
epicDesignStatus: complete
storyCreationStatus: complete
finalValidationStatus: dependency-safe-after-sprint-change-proposal
inputDocuments:
  - prds/prd-thcode-2026-07-14/prd.md
  - prds/prd-thcode-2026-07-14/addendum.md
  - architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md
  - architecture/architecture-thcode-2026-07-16/reviews/review-adversarial-divergence.md
  - architecture/architecture-thcode-2026-07-16/reviews/review-data-integrity.md
  - architecture/architecture-thcode-2026-07-16/reviews/review-rubric.md
  - architecture/architecture-thcode-2026-07-16/reviews/review-security-authority.md
  - architecture/architecture-thcode-2026-07-16/reviews/review-technology-reality.md
  - ux-designs/ux-thcode-2026-07-17/DESIGN.md
  - ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md
  - ux-designs/ux-thcode-2026-07-17/validation-resolution.md
  - implementation-readiness-report-2026-07-17.md
  - sprint-change-proposal-2026-07-17.md
  - ../../../docs/decisions/0001-local-agent-loop-remote-thai-reasoning.md
  - ../../../docs/decisions/0002-developer-cli-first.md
  - ../../../docs/decisions/0003-split-local-and-server-tools.md
  - ../../../docs/decisions/0004-typhoon-default-pluggable-models.md
  - ../../../docs/decisions/0005-cli-only-prototype.md
  - ../../../docs/decisions/0006-plan-before-build.md
  - ../../../docs/decisions/0007-local-byok.md
  - ../../../docs/decisions/0008-windows-first.md
  - ../../../docs/decisions/0009-dependency-preflight.md
  - ../../../docs/decisions/0010-phased-api-key-provider-strategy.md
  - ../../../docs/decisions/0011-registry-driven-aiforthai-tool-catalog.md
  - ../../../docs/decisions/0012-permission-profiles.md
  - ../../../docs/decisions/0013-orthogonal-work-modes.md
  - ../../../docs/decisions/0014-saved-transcript-active-context.md
  - ../../../docs/decisions/0015-context-utilization-meter.md
  - ../../../docs/decisions/0016-session-restoration-boundary.md
  - ../../../docs/decisions/0017-global-local-session-store.md
  - ../../../docs/decisions/0018-encrypted-session-content.md
  - ../../../docs/decisions/0019-npm-cli-distribution.md
  - ../../../docs/decisions/0020-typescript-ink-cli.md
---

# thcode - Epic Breakdown

## Overview

This document is the complete dependency-safe epic and story plan for thcode. The previous epic revision was used only as a rewrite baseline. All 39 FRs remain preserved, while its forward dependencies, late encryption/events, checkpoint ordering, oversized stories, and misplaced release governance have been corrected without adding product scope. The 2026-07-17 readiness report is a historical assessment of the prior plan: its sequencing findings informed this rewrite, but its statements that UX was missing and that the old epic ordering remained current are superseded by the final DESIGN/EXPERIENCE spines and this document. `validation-resolution.md` records the resolved critical/high UX findings; remaining validation items are release audit checks rather than missing-design defects.

### Implementation conventions introduced by the 2026-07-17 Sprint Change Proposal

These conventions apply to every story in this document and are not repeated in each acceptance criterion:

- **Implementation prerequisites PR-1…PR-4 are approved before the consuming feature epics begin** (see the Pre-Implementation Gate section). Epic 7 certifies already-approved artifacts; it does not define them.
- **Every story carries `dependsOn` metadata** listing the story IDs or prerequisite IDs it requires as runtime contracts. A forward edge to a later story or epic blocks the dependent story until its producer is complete, with one exception: certification stories in Epic 7 may consume already-produced evidence.
- **Stable fixture IDs and hashes** are required for every deterministic fixture (Specialist media/document/text, C++ proof, recovery, UX). Each fixture carries a stable ID, source hash, exact input, expected normalized output, accepted uncertainty/tolerance, and failure variant. Retry/backoff and resource-limit policies reference named versioned configurations with concrete test values.
- **Safety caps are separate from NFR-14 performance SLOs.** Implementation-safe default caps (artifact size, recursion depth, search work, process count, Prompt Round wall time, transfer bytes) are defined before the consuming stories in the versioned registry or its referenced policy and may be tuned by Epic 7 release budgets later; they are not deferred to NFR-14.
- **Brownfield baseline is preserved.** The existing `cli/` package, headless `CoreApp`/Ink split, and current entry points are inventoried and kept passing before any Story 1.x work changes them; no generated scaffold or wholesale rewrite is permitted.
- **Specialist Result/Evidence envelope precedes its consumers.** The immutable envelope and ownership foundation (Story 4.14 in the prior plan) is established before the four service integrations (Stories 4.10–4.13 in the prior plan).
- **Context extension envelopes and persistence precede their consumers.** Versioned envelopes (Story 5.11) and encrypted/journaled persistence (Story 5.10) are established before durable pins, usage ledger, compaction, overflow, recovery, and rendering stories (Stories 5.2, 5.7, 5.8, 5.9, 5.12, 5.13).
- **Epic 7 oversized stories are decomposable.** Stories flagged as oversized (7.7, 7.13, 7.17, 7.18–7.20, 7.22) may be split into independently owned evidence producers followed by small aggregate manifest/gate stories during implementation while preserving the original story IDs as traceability anchors.

## Requirements Inventory

### Functional Requirements

FR-1: A developer can install thcode globally through npm and launch it with `thcode` on supported Windows and macOS environments, with reproducible install, update, uninstall, and first-run behavior under the supported Node.js versions.
FR-2: On first use, a developer can enter a Typhoon API key through a protected terminal form after thcode discloses the configured, reviewed, allowlisted origin and credential storage behavior; after entry, thcode performs a minimal live effective-endpoint Typhoon health check before entering the main interface, stores the key in the OS credential facility, and explains failed authentication, connectivity, quota, or configuration checks without exposing the key.
FR-3: When a prompt first requires an AI-for-Thai Specialist Service and no AI-for-Thai credential is configured, thcode explains what is missing, opens a protected just-in-time connection flow, verifies the separate AI-for-Thai key, and lets the user retry; one AI-for-Thai key covers all entitled launch services, remains isolated from Typhoon, and can be explicitly removed or rotated.
FR-4: thcode exposes Typhoon or a Specialist Service as available only after a relevant live connectivity and authentication check passes for the effective configuration; the owning Health Registry and adapter own the live check and cache policy, while CoreApp exposes the resulting projection; it presents configured, checking, available, unavailable, and unhealthy states, rejects stale health evidence, and requires correction plus explicit retest after deterministic protocol or configuration failure. Cache reuse may provide prior Evidence but never makes a currently unverified configuration available.
FR-5: thcode accepts Thai and mixed Thai-English prompts, preserves technical identifiers, extracts the requested outcome, constraints, artifacts, and verification intent, asks for clarification when material ambiguity remains, and can expose normalized intent as diagnostic Evidence.
FR-6: thcode runs an iterative local Agent Loop in which Typhoon may propose local tool or specialist actions, but the local harness validates every proposal against schema, Work Mode, Permission Profile, workspace, consent, quota, credential, and hard-boundary policy before execution; remote output never directly causes a local effect, and the loop stops only on a final or verified response, an accepted disclosed limitation, a refusal, a blocker, or a terminal failure.
FR-7: Typhoon can list, read, and search text only inside the declared Workspace, with safe handling for supported Windows and macOS path semantics; unsupported or out-of-workspace access is refused, while eligible non-sensitive in-workspace inspection may proceed without interruption in Manual profile when no material transfer occurs.
FR-8: In Build mode, Typhoon can propose bounded text-file creation and editing inside the Workspace; the target and proposed change are inspectable before required approval, Plan mode cannot authorize mutation, and before/after Evidence supports verification and rollback.
FR-9: In Build mode, thcode can delete an in-workspace file or directory only through a visibly destructive, policy-controlled operation; Manual requires explicit approval, Full Access cannot bypass workspace or safety boundaries, and eligible built-in deletion participates in rollback retention.
FR-10: In Build mode, thcode can propose and run a validated local command with exact command disclosure, controlled working directory, executable, arguments, environment, streaming output, timeout, cancellation, and orphan prevention; commands that threaten the host or cross hard boundaries are refused.
FR-11: thcode can perform a non-mutating dependency preflight by inspecting project metadata and probing runtimes, compilers, package managers, and documented commands; missing prerequisites produce accurate platform guidance, `/check` can repeat the preflight, and thcode never silently installs dependencies or invents privileged commands or URLs.
FR-12: thcode reports task completion only when verification succeeds, the user accepts a disclosed limitation, or a blocker is honestly stated; the canonical C++ proof requires source creation, successful compilation, successful execution, and expected `Hello, World!` output on both supported platforms, while a missing compiler is classified as a prerequisite issue rather than source failure.
FR-13: thcode provides a reviewed, versioned Capability Registry that records service identity, capabilities, inputs, entitlement, evidence, contract and manifest versions, observation date, operational constraints, and invokable status; T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition are working launch integrations, while other known entries are visible as `Catalogued — Not available yet` and cannot execute.
FR-14: A prompt that requires a supported Specialist Service can cause thcode to propose the relevant service without requiring the user to browse the registry first; the selected service and reason are visible before the call, only task-relevant schemas enter Active Context, and `/tools` supports catalog browsing, search, inspection, enablement, disablement, diagnosis, and retest.
FR-15: thcode handles explicit in-workspace references to code, Markdown, text, images, audio, PDF, DOCX, and bounded manifests according to type-specific containment, format, size, privacy, and compatibility policies; PDF and DOCX text is extracted locally by default, originals transfer only when required and authorized, and unsupported binaries send sanctioned metadata only or fail clearly.
FR-16: Before selected material leaves the machine, thcode presents informed remote-transfer consent containing the purpose, receiving service, verified endpoint, relevant method, safe payload summary, and side effects without credentials; sensitive documents, images, audio, or boundary expansion require risk-appropriate explicit authority.
FR-17: Each Specialist Service result is attributable to the exact source artifact and effective Service Configuration and preserves source hash, service identity, returned fields, confidence or uncertainty, empty fields, provenance, consent reference, and timing; thcode distinguishes service output from Typhoon explanation, never invents missing content, visibly identifies cache reuse, and provides freshness or force-rerun controls.
FR-18: When a Specialist Service cannot run, thcode distinguishes entitlement, quota, unsupported input, transient network failure, failed health, and protocol incompatibility; it provides an actionable reason without silent substitution or fabrication, does not quarantine a service after a single transient request failure, and does not expose unavailable sensitive identity, biometric, or medical capabilities without policy support.
FR-19: Authentication, protocol, and configuration failures receive deterministic categories from sanitized Evidence and the smallest proven scope; service-specific failure affects only that service, a shared AI-for-Thai credential rejection updates all dependent services, model explanation cannot contradict the deterministic category, and quarantined capabilities remain unselectable until correction and explicit retest.
FR-20: After correcting a service configuration, a user can initiate a visible live retest; thcode reports progress, result, timestamp, and Evidence for the corrected effective configuration, rejects stale successes, performs no disguised background retry, and restores availability only after a passing retest.
FR-21: Work Mode is directly switchable between Plan and Build without a mandatory plan-before-build gate; Plan is structurally read-only under every Permission Profile, Build permits eligible mutation and verification, and a fresh interactive session begins in Build mode with the active mode visible.
FR-22: Permission Profile is independently selectable as Manual, Assisted, or Full Access; every Runtime Activation starts in Manual, Assisted applies deterministic rules and asks on uncertainty, Full Access suppresses only eligible prompts within declared boundaries and displays a prominent active warning, and no profile alone authorizes sensitive transfer or overrides hard boundaries.
FR-23: Approval prompts use progressive disclosure: first a plain-language purpose and risk, then authoritative exact details appropriate to the action, including exact commands, mutation targets and changes, destructive deletion scope, or verified Specialist Service destination and transfer summary.
FR-24: thcode enforces non-overridable workspace, command, network, service, quota, credential, and sensitive-transfer boundaries independently of user approval; host-threatening or out-of-workspace actions are refused, Full Access cannot erase hard boundaries, and durable Boundary Expansions are separately scoped, stored, audited, inspectable, revocable, and distinct from temporary approval or transfer consent.
FR-25: Each credential is supplied only to its exact provider or service identity and verified host; Typhoon credentials never reach AI-for-Thai or hosted components, AI-for-Thai credentials never reach Typhoon or SCBx, and credentials never appear in prompts, repositories, logs, telemetry, crash reports, Sessions, previews, generated content, or UI output.
FR-26: A user can create, list, open, rename, delete, and inspect machine-local Saved Sessions through `/session`, with `/sessions` providing the same browser; sessions are global to the current OS user and distinguish the current, another, or missing Workspace, with no cloud synchronization, export/import, recovery archive, or cross-machine migration in Release 1.
FR-27: Opening a Saved Session restores its transcript, Typhoon identity, Work Mode, pins, compaction decisions, artifact manifest, plans, tool and verification history, cumulative usage ledger, Workspace association, and checkpoint lineage; source files are referenced by path, hash, metadata, and derived Evidence rather than copied by default, credentials are excluded, and loss of the encryption key is disclosed as unrecoverable.
FR-28: Every new or restored Runtime Activation resets to Manual and clears Full Access, temporary approvals, and sensitive-transfer authority; Work Mode and valid durable Boundary Expansions may restore only after resource revalidation, and thcode never silently rebinds a missing Workspace to the current directory.
FR-29: thcode retains the complete transcript as immutable local history while deriving a bounded Active Model Context from instructions, recent and pinned turns, Evidence, summaries, and relevant schemas; users can inspect what is verbatim, summarized, or excluded, and protected content is never silently dropped.
FR-30: thcode separately presents Active Context utilization, effective model capacity, and cumulative input, output, cached-token, and call usage; context percentage has a text and non-color fallback, severity bands are labeled, `/context` shows categorized projected and cumulative accounting, and cumulative usage has no percentage unless a real budget exists.
FR-31: Before a request would exceed effective capacity, thcode automatically compacts older unpinned context toward no more than 70%, preserves the full transcript and pins, records the transformation as Evidence, and stops before dispatch with a categorized breakdown and remedies if protected content still overflows.
FR-32: After an interrupted dispatched remote request, thcode restores all durably known output and marks the exact `Chat interrupted` boundary; it never automatically retries, invents an ending, or assumes no remote action occurred, and the user decides whether to reprompt or reconcile.
FR-33: Before an eligible local mutation, thcode records an attributable Prompt Round rollback checkpoint covering built-in file create, edit, and delete operations; shell, remote, permission, external, symlink-side, and untracked effects are explicitly excluded, and incomplete or corrupt checkpoints are detectable and never presented as complete.
FR-34: A user can request reversal of a recent Prompt Round; thcode reverts only content that still matches the attributable post-change state, stops the affected part on conflicting later edits, leaves unrelated user work unchanged, and reports full, partial, blocked, and excluded rollback outcomes honestly.
FR-35: Rollback checkpoints are retained for five subsequent prompts by default, subject to configuration; changed or deleted binary originals are encrypted within the window, each checkpoint is capped at 100 MB and the store at 500 MB, over-cap actions explain the loss of protection and require explicit confirmation, and expired content is deleted and hidden.
FR-36: thcode provides a discoverable command and completion surface for models, tools, status, settings, permissions, mode, context, sessions, checks, connections, compaction, clearing, and exit; Shift+Tab switches mode, Tab accepts completion, Esc dismisses a modal without changing its setting, `/models` is Typhoon inspection-only, and `/tools` exposes registry and diagnostic controls.
FR-37: The TUI keeps Typhoon, Work Mode, Permission Profile, AI-for-Thai connection, service health, and context status persistently visible or immediately inspectable; Plan, Build, Full Access, destructive action, unhealthy service, interruption, and rollback conflict are visually distinct without relying on color alone, and explanations use natural Thai while preserving exact technical identifiers and commands.
FR-38: Significant actions and demonstrations produce sanitized, attributable Evidence linking relevant input or artifact hashes, model or service identity, normalized result, proposal, approval, command output, verification, and failure; every proposed or executed call, including auto-permitted list, read, and search, appears in a compact activity log, and completion summaries identify changes, verification, contributing services, and remaining risk.
FR-39: Every Prompt Round has one end-to-end duration and correlation identifier plus subsystem timings; utilization is separated from cumulative usage, deterministic failure provenance is separated from model explanation, and export of raw prompts, commands, and payloads is disabled by default.

### NonFunctional Requirements

NFR-1: Sensitive local Session content must be encrypted before persistence, while provider and service credentials must remain in the platform credential facility outside the product database.
NFR-2: Headers, URLs, environment data, errors, tool output, payload summaries, and other potentially sensitive material must be sanitized before persistence, display, or export.
NFR-3: Filesystem and command enforcement must fail closed when a required platform boundary or enforcement mechanism is unavailable.
NFR-4: Remote providers and services must receive only deliberately selected content and must never receive an unresolved local path as authority to fetch local material.
NFR-5: Command timeout or cancellation must leave no orphan child process or uncontrolled process tree.
NFR-6: Health, Session, Evidence, interruption, and rollback records must be crash-consistent, with partial or incomplete state detectable during recovery.
NFR-7: thcode must never silently substitute a model, service, protocol interpretation, missing result, or unsupported capability.
NFR-8: Every Specialist Service result must remain attributable to the exact source artifact and effective Service Configuration that produced it.
NFR-9: Thai UTF-8 text must remain valid across supported terminals, persistence, streaming, local processing, and Specialist Service calls.
NFR-10: Status and severity must not rely on color alone and must remain usable in narrow terminal layouts.
NFR-11: Release validation must prove clean-machine installation and the canonical C++ task on Windows 11 25H2+, macOS 14+, and the newest stable supported release of each platform.
NFR-12: Performance must be measured at the Prompt Round boundary, with subsystem latency available for diagnosis.
NFR-13: Context projection and all applicable policy checks must complete before dispatch and cannot be bypassed by provider, adapter, UI, or retry behavior.
NFR-14: Numeric budgets for startup, TUI responsiveness, health checks, Prompt Rounds, compaction, restoration, and Specialist Services remain unresolved and must be defined by a Product Owner decision gate before release validation can claim compliance; this inventory invents no numeric values.
NFR-15: Internal event and Evidence schemas must be versioned independently from any external telemetry or export format.

### Additional Requirements

1. No starter template is specified. Epic 1 Story 1 must build from the existing `cli/` prototype and preserve the adopted headless `CoreApp` plus Ink TUI split rather than replacing it with a generated scaffold.
2. Converge incrementally toward Hexagonal Architecture with `domain/`, `application/`, `ports/`, `adapters/`, and `ui/` ownership; a wholesale directory rewrite is not a prerequisite for feature delivery.
3. Enforce inward dependencies: domain and application depend on canonical contracts and ports, while vendor objects, SQLite rows, Ink values, OS handles, and wire payloads remain inside adapters.
4. Make `CoreApp` the sole UI-facing facade through versioned `dispatch`, `subscribe`, and `query` operations; UI code must not import effect adapters or construct authoritative domain projections.
5. Define stable ports for ReasoningProvider, SpecialistService, CapabilityRegistry, CredentialStore, SessionRepository, CheckpointRepository, ArtifactStore, HealthRegistry, QuotaLedger, ContextBuilder, Sanitizer, ArtifactResolver, and PlatformBoundary.
6. Keep post-install configuration declarative and non-executable; slash commands remain reviewed TypeScript code, and Release 1 does not allow executable user adapters or user-defined commands.
7. Use metadata-driven discovery and reusable UI projections so adding a future provider or service does not require provider-specific UI logic.
8. Define CoreProtocolV1 exhaustive discriminated unions for prompt, session, authority, health, and capability intents; Session, Status, Context, Artifact, and Capability projections; durable lifecycle and Evidence events; and transient token/progress events.
9. Reject unknown protocol variants and fail startup on an incompatible major protocol version; provide shared schema fixtures and compatibility tests across UI, CoreApp, persistence, and adapters.
10. Give every operation SessionId, PromptRoundId, OperationId, immutable EventId, schema version, UTC timestamp, and deterministic or model provenance.
11. Serialize mutation per SessionId and use optimistic aggregate versioning, idempotent append, ordered at-least-once replay, and EventId-based consumer deduplication.
12. Ensure every accepted operation has exactly one durable terminal outcome and that UI completion is derived only from post-commit events.
13. Implement the operation state machine `proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled`.
14. Atomically consume effect authorization and append `EffectDispatchCommitted` before native or remote dispatch; before commit, cancellation or revocation must deny execution without consuming one-shot authority.
15. Persist sanitized provider chunks with upstream sequence or high-water identity before UI publication; completion seals the stream, while interruption restores durable chunks and records the reliable interruption boundary.
16. Treat malformed or invalid structured remote proposals as rejected terminal outcomes after local validation; do not silently repair, reinterpret, relax policy, substitute a dependency, or automatically replay an uncertain effect.
17. Make one local Policy Enforcement Point the sole authority for local and remote effects; only its effect executor may receive concrete effect adapters.
18. Bind every unforgeable effect authorization to OperationId, action digest, authority revision, policy decision, and expiry, and require adapters to reject absent or mismatched authorization.
19. Keep Work Mode, Permission Profile, operation approval, remote-transfer consent, and Boundary Expansion as independent authority dimensions.
20. Implement a versioned PermissionMatrix mapping action class × Work Mode × Permission Profile × risk or sensitivity × boundary state to allow, ask, or deny; unknown action classes fail closed.
21. Recreate Runtime Activation on process start, session create/open/switch, and Workspace rebind; increment authority revision on every mutation and revalidate authority and cancellation immediately before effect start.
22. Bind Boundary Expansions to stable resource identity, platform and Workspace identity, permitted actions, expiry where applicable, and revocation state.
23. Bind operation approval to the exact action digest and OperationId; rewritten proposals and unsafe retries require fresh authority.
24. Reserve quota atomically under OperationId and applicable user budget, dependency generation, service, credential group, transfer, or upstream-quota scope before dispatch; commit actual usage, release proven non-consumption, and hold unknown consumption for reconciliation.
25. Define Prompt Round resource ceilings for model, service, and tool calls, bytes, tokens or cost, wall time, and repeated proposals before release, and ensure repairs or retries share the same budget.
26. Introduce a normative Remote Data Authority policy distinct from local read permission: selected outbound content, purpose, destination, sensitivity, scope, lifetime, and transformations must be locally determined and consented before transfer.
27. Prepare outbound content through ArtifactResolver and Sanitizer, classify code, documents, media, filenames, tool output, and extracted text, and block secrets unless an explicit policy-supported override is granted.
28. Bind transfer consent to a canonical PreparedPayloadManifest digest and exact payload-byte digest plus capability/version, endpoint, purpose, call count, expiry, and operation or Prompt Round scope; recompute both digests immediately before transport and require fresh consent after transformation or mismatch.
29. Require HTTPS with normal certificate and hostname verification, reject TLS bypass or downgrade, reject unauthorized or cross-origin redirects, strip or withhold authorization across redirects, and revalidate the final origin before sending material.
30. Define explicit launch origin allowlists and proxy/custom-CA behavior, pin the launch Typhoon and four AI-for-Thai endpoint contracts before integration freeze, and never place credentials in URLs.
31. Store only opaque credential references, revisions, and secret-free fingerprints in product persistence; provide explicit credential rotation and removal behavior.
32. Treat tool, provider, service, and retrieved artifact content as provenance-tagged, instruction-inert data that cannot alter policy, permissions, destination, or task scope.
33. Apply MIME/signature checks, decompression and media limits, parser resource limits, bounded archive traversal, no-follow behavior, and active-content or external-reference restrictions to hostile artifacts.
34. Build a versioned Windows/macOS platform-and-action enforcement matrix covering file reads, writes, deletion, recursion, commands, process trees, credential facilities, network behavior, and unsupported enforcement; Release 1 must fail closed for unsupported combinations.
35. Bind filesystem authority to Workspace/platform identity, canonical resource identity, expected digest or version, and effect-time revalidation.
36. Use cross-process locking or equivalent compare-and-apply semantics so changed targets return conflict without mutation.
37. Revalidate symlinks, junctions, mounts, renames, case, Unicode, and containment immediately before effects.
38. For recursive deletion, validate an ordered descendant identity/content manifest and atomically quarantine or rename the root before removal; deny recursion when the platform cannot enforce the contract safely.
39. Resolve approved executable identity, validate argv, cwd, and a minimal allowlisted environment without startup hooks, isolate the process tree, and enforce timeout and cancellation.
40. Target Windows 11 25H2+ with Windows Terminal/PowerShell and macOS 14+ with Terminal/zsh; Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, and non-native shells are outside Release 1.
41. Require Node.js `>=22`, validate Node.js 24 LTS and native-module compatibility, distribute through npm, and run clean-machine install, update, uninstall, and C++ proof fixtures on both supported platforms.
42. Keep `client/`, `server/`, hosted proxy, and compatibility-layer components outside the Release 1 request path; local adapters call Typhoon and AI-for-Thai directly.
43. Use the persisted Session as aggregate root for transcript, Prompt Rounds, provider selection, Work Mode, pins, context decisions, artifacts and Evidence, tool and verification history, token ledger, interruption markers, Workspace association, durable Boundary Expansions, and checkpoint lineage.
44. Store Sessions in a per-user machine-local SQLite store at native platform locations; retain source paths, hashes, metadata, and derived Evidence rather than copying source artifacts by default.
45. Treat the complete transcript as immutable local history and Active Model Context as a bounded derived projection with recorded inclusion, exclusion, summarization, and compaction decisions.
46. Return an immutable ContextManifest and transmitted-byte digest before dispatch; compute Effective Capacity from verified provider limits and response/safety reserves, using documented conservative fallback reserves when provider limits are unavailable.
47. Make one local operation journal authoritative for commit visibility; stage artifacts and checkpoint originals durably before references and terminal events become visible.
48. Share OperationId, aggregate version, and commit state across every record participating in an operation.
49. Gate SQLite, journals, projections, artifact envelopes, and checkpoint envelopes with one StoreFormatVersion.
50. Make migrations checksum-verified, restartable or reversible, progress-recorded, and validated before promotion; incompatible or failed stores open read-only without effects or overwrite.
51. On startup, detect incomplete stages and unknown outcomes, repair or remove unreachable staged data, and never replay side effects.
52. Encrypt sensitive fields and retained originals with versioned AES-256-GCM envelopes using a per-install data-encryption key held in Windows Credential Manager or macOS Keychain outside SQLite.
53. Use collision-resistant non-repeating nonces and bind authenticated metadata to store, record/entity, content class, schema/format version, and key version; decryption mismatch fails closed.
54. Stage and journal key rotation across every durable store, verify before atomic promotion, retain old key material until safe cleanup, and enter locked recovery after missing keys or interrupted rotation rather than silently replacing keys.
55. Make Session deletion a journaled tombstone lifecycle that immediately hides the aggregate and cascades through transcript/events, context manifests, usage ledger, checkpoints, projections, Evidence, cache references, WAL/temp material, and zero-reference sensitive artifacts without reviving partial cleanup.
56. Retain only a non-sensitive deletion audit tombstone and document secure-deletion limitations; telemetry remains off by default unless an explicit opt-in contract defines fields and destination.
57. Use one canonical AI-for-Thai CredentialGroupId for the four launch services while keeping Typhoon credentials distinct.
58. Make the Capability Registry the sole authority for discoverability, routing, and invocation; model-supplied tools, installers, URLs, commands, or manifests cannot modify registry authority.
59. Bundle a reviewed offline registry manifest with stable thcode/upstream IDs, source URL, observation date, Thai and English search terms, modalities and limits, normalized schemas, endpoint/transport rules, timeout/retry/quota behavior, credential scope, privacy classification, confirmation policy, support level, adapter version, and latest contract-test result.
60. Version and validate registry freshness and revocation metadata and fail closed when an invokable manifest is invalid.
61. Implement the health lifecycle `unconfigured → configured → checking → available | unavailable | unhealthy | quarantined` against an immutable EffectiveConfigurationGeneration.
62. Reject stale health results, propagate shared credential failure atomically across dependent AI-for-Thai services, and let deterministic authentication/configuration failure outrank stale in-flight success.
63. Convert remote failures to a common sanitized envelope with deterministic category, retryability, scope, effective generation, OperationId, safe message, cause code, Evidence reference, and optional retry-after.
64. Persist immutable Specialist Result artifacts containing source-content hash, service/configuration generation, returned fields, uncertainty, empty fields, consent reference, timing, and normalized failure.
65. Define cache identity from a canonical versioned manifest including service/capability contract, verified origin, ordered semantic inputs and content hashes, request options, preprocessing, mapping/schema version, effective configuration generation, and transformation/redaction policy.
66. Perform cache lookup before live-health gating, expose original observation time and provenance, preserve prior Evidence on force-fresh requests, and coordinate cache invalidation with service changes, quarantine, TTL policy, and Session deletion.
67. Provide repeatable live contract tests and prompt-driven end-to-end fixtures for T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition, plus service-specific and shared-credential health fixtures.
68. Restrict automatic rollback to checkpointed built-in file create/edit/delete operations; never describe shell, remote, permission, symlink-side, external, or unknown effects as reversible.
69. Encrypt all sensitive rollback content and metadata, preflight the complete intended mutation set before the first mutation, and label coverage as fully protected, partially protected, or unprotected.
70. Compare current content with recorded post-images before rollback and report conflicts instead of overwriting later user work.
71. Validate checkpoint atomicity, retention caps, crash recovery, concurrency, rename, deletion, and partial-cleanup behavior through kill-point and adversarial fixtures.
72. Journal remote dispatch before network transmission so recovery can distinguish not-sent, possibly-dispatched, response-started, completed, and reconciled states; automatic retry requires proven idempotency or reconciliation safety.
73. Before release, pin and record the exact Typhoon model ID, endpoint, wire contract, and adapter version in release Evidence.
74. Define the complete action/profile/mode matrix, including list/read/search, mutation, deletion, command, specialist transfer, cache reuse, Boundary Expansion, and rollback-disabled actions.
75. Define numeric performance and resource budgets currently left unresolved by NFR-14.
76. Complete the sensitive-data and Remote Data Authority policy, endpoint allowlists, platform/action enforcement matrix, service contract appendix, critical fixture inventory, deletion cascade, and security-reporting channel as explicit go/no-go release artifacts.
77. Separate deterministic adapter fixtures from live upstream smoke tests and define failure policy and repeat count for the release matrix.
78. Preserve the final PRD as authoritative over earlier proposals: Release 1 is Typhoon-only, supports exactly four working AI-for-Thai services, uses the C++ `Hello, World!` proof, makes direct local BYOK calls, supports native Windows and macOS only, allows direct Plan/Build switching, and excludes hosted execution, alternate reasoning providers, Linux, GUI/web/mobile/IDE products, silent protocol repair, automatic retry of uncertain effects, blind rollback, and permanent retention.

**Rewrite sequencing and traceability checks (non-normative):** Items 79–96 summarize ordering, placement, and validation constraints for the rewrite. The canonical behavioral requirements remain Items 1–78, the FR/NFR inventory, Architecture Spine, and final UX spines.

79. Dependency-safe implementation ordering is mandatory: contracts and durable foundations precede UI, provider, service, mutation, recovery, and release consumers.
80. Implement the durable versioned event/operation/journal foundation before the first conversation, Specialist Service, or mutation use; every operation carries SessionId, PromptRoundId, OperationId, EventId, schema version, UTC time, provenance, replay/deduplication, and exactly one durable terminal outcome.
81. Implement encrypted sensitive persistence before the first sensitive write using versioned AES-256-GCM envelopes, a per-install DEK in Windows Credential Manager or macOS Keychain outside SQLite, authenticated metadata, collision-resistant nonces, staged rotation, and locked recovery.
82. One local operation journal is authoritative for commit visibility. Checkpoint ownership belongs to the built-in mutation owner: preflight the complete set; stage checkpoint originals and artifact/mutation records durably; append prepared/journal state; commit dispatch visibility; apply the native mutation; append post-image and terminal Evidence; expose completion only after post-commit events.
83. Use one local Policy Enforcement Point and effect executor as the sole authority for local and remote effects; only it receives concrete effect adapters.
84. CoreProtocolV1 must define exhaustive discriminated unions and projections for prompt, session, authority, health, capability, operation, and Evidence; unknown variants and incompatible major versions fail closed.
85. Use one versioned PermissionMatrix mapping action class × Work Mode × Permission Profile × risk/sensitivity × boundary state to allow, ask, or deny; bind authority to OperationId, action digest, authority revision, policy decision, and expiry.
86. Use proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled; atomically consume authorization and append EffectDispatchCommitted before native or remote dispatch.
87. Implement Sanitizer before persistence, display, export, logging, or UI publication; sanitizer failure blocks unsafe Evidence. ArtifactResolver and Remote Data Authority remain distinct from local read permission.
88. Recreate Runtime Activation on process start, Session create/open/switch, and Workspace rebind; clear Full Access, temporary approvals, transfer authority, and stale in-flight authority; increment authority revision.
89. Health Registry owns generation-bound lifecycle, stale-result rejection, typed sanitized failures, shared-key propagation, scoped quarantine, cache provenance, force-fresh behavior, and explicit retest.
90. Build the Windows/macOS platform-and-action enforcement matrix and fail closed when enforcement is unavailable; test canonical identity, locking, TOCTOU, symlink/junction/mount, rename, Unicode, executable, argv/cwd/environment, timeout, cancellation, and process-tree cleanup.
91. Provide headless parity: Ink, redirected text, and JSON share projections, state vocabulary, Evidence, authority, terminal outcomes, stable exit classes/codes, and EventId deduplication; interactive authority and secrets fail closed without a TTY.
92. Test UX state catalog ux-state-v1, all canonical components, keyboard/focus/IME/grapheme/cell-width/resize/streaming/cancellation/screen-reader/reduced-motion/no-color behavior at 40/60/80/120 columns.
93. Test UJ-1 through UJ-7 end to end. Treat critical/high validation findings as resolved final spines and retain validation-resolution mechanical checks only as release audit verification.
94. Move repository governance, security-reporting, performance budgets, model pin, and platform matrix out of Specialist Services into release governance; Specialist Services own service contracts, health, routing, cache, and Evidence.
95. Treat the PRD-vs-architecture invalid-proposal repair conflict as an explicit Product Owner/Architecture decision gate: PRD permits bounded recorded repair/retry while final architecture requires rejection; do not silently select either interpretation.
96. All 39 FRs remain preserved; the prior plan’s forward dependencies, late encryption/events, checkpoint ordering, oversized stories, and misplaced release governance are rewrite constraints, not new product scope.

### UX Design Requirements

UX-DR-001: Scope Release 1 as the native `thcode` CLI/TUI.
UX-DR-002: Support Windows 11 25H2+ with Windows Terminal/PowerShell through `pwsh.exe`, and macOS 14+ with Terminal/zsh.
UX-DR-003: Keep Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, web, desktop GUI, mobile, and IDE surfaces out of Release 1.
UX-DR-004: Provide a headless path for noninteractive use.
UX-DR-005: Keep all authority and effects in the headless core; the UI must never own either.
UX-DR-006: Use one canonical projection contract across interactive Ink, redirected text, linearized assistive output, and headless JSON.
UX-DR-007: Use Claude Code-like terminal rhythm only as a familiarity reference, never as a provider, model, capability, or outcome-parity claim.
UX-DR-008: Present Typhoon as the only Release-1 reasoning model and exactly four reviewed AI-for-Thai services as working.
UX-DR-009: Present `Catalogued — Not available yet` entries as non-invokable and non-enableable.
UX-DR-010: Never imply arbitrary provider, tool, adapter, or executable-extension support in Release 1.
UX-DR-011: Implement dark surface tokens `#101214`, `#171A1E`, and `#20252B` for base, raised, and overlay surfaces.
UX-DR-012: Implement the exact dark ink, semantic, accent, and outline tokens from `DESIGN.md`, including `#F1F3F5`, `#D6A85C`, `#79B8FF`, `#7FD39A`, `#E8B86A`, and `#F28B82`.
UX-DR-013: Implement the explicit light token mapping from `DESIGN.md`; missing theme fields are contract failures and dark semantic tokens must never render on light surfaces.
UX-DR-014: Apply prompt, body, label, meta, and code typography by semantic role using the specified sizes, weights, and line heights.
UX-DR-015: Preserve paths, URLs, hashes, commands, endpoint hosts, reason codes, and other technical values as atomic spans or through expanded inspection.
UX-DR-016: Allow Thai prose to localize explanations while preserving canonical English state tokens and exact technical identifiers verbatim.
UX-DR-017: Use 2px, 4px, and 6px radii only for their specified field, overlay, and bounded-surface roles; avoid card-heavy or pill-only presentation.
UX-DR-018: Use the specified spacing scale, including `2ch` gutters, `1lh` dense rows, and `2lh` section separation.
UX-DR-019: Meet at least 4.5:1 contrast for load-bearing text and 3:1 for large labels where terminal color is measurable.
UX-DR-020: Make focus and selection at least 3:1 against adjacent surfaces plus a two-cell or text-label distinction; color must never be the sole state carrier.
UX-DR-021: Render the shell in the stable order status → warnings → transcript/activity → focused decision/result → composer.
UX-DR-022: Keep the shell legible and semantically complete in monochrome, redirected, linearized, and headless output.
UX-DR-023: Keep Workspace, Runtime Activation, Work Mode, Permission Profile, Full Access, Boundary Expansions, transfer consent, enforcement, health, context, and unresolved outcomes persistently visible or deterministically reachable.
UX-DR-024: Use dense status presentation with explicit dark/light semantic mappings and no authority implied by accent color.
UX-DR-025: Make `prompt-composer` preserve Thai IME preedit, graphemes, mixed scripts, multiline input, draft, cursor, selection, technical tokens, and cell-width wrapping.
UX-DR-026: Make `transcript` use separate durable headings for Typhoon explanation, Specialist output, deterministic Evidence, progress, `Chat interrupted`, and terminal outcome.
UX-DR-027: Make `activity-log` include every proposed and executed call, including auto-permitted list/read/search, with grouped and full inspection.
UX-DR-028: Make `approval-dialog` present purpose and risk before exact effect identity.
UX-DR-029: Make `transfer-consent-dialog` independently present recipient, endpoint, payload identity, classification, policy, retention/deletion handling, transformations, call count, expiry, and digests.
UX-DR-030: Make `evidence-panel` separate deterministic completeness and provenance from model-generated explanation.
UX-DR-031: Use the canonical `ux-state-v1` vocabulary unchanged in English, Thai, and mixed-language output.
UX-DR-032: Maintain exactly 73 unique machine rows in the state registry.
UX-DR-033: Give every nonterminal registry row exit class `NONE` and JSON exit code `null`.
UX-DR-034: Give every terminal registry row exactly one symbolic exit class and one stable numeric exit code.
UX-DR-035: Keep JSON statuses unique and mechanically mapped to the canonical display token.
UX-DR-036: Define cause, retryability, recovery, exit behavior, narrow form, noninteractive form, and Thai-capable explanation for every state.
UX-DR-037: Never allow `configured` to imply `available`, or `working` to substitute for health state.
UX-DR-038: Never lead unknown, partial, blocked, cancelled, or unverified work with affirmative success language.
UX-DR-039: Preserve the exact tokens `DESTRUCTIVE`, `UNKNOWN OUTCOME`, `FULL ACCESS`, `ENFORCEMENT UNVERIFIED`, `Chat interrupted`, and `percentage unavailable`.
UX-DR-040: Close every named surface across applicable cold, loading, success, error, blocked, cancelled, unknown, narrow, and noninteractive states with explicit copy, action, and next step.
UX-DR-041: Implement the composer state machine for empty, editing, IME composition, completion, submitted, streaming, interrupted, completed, and overlay-blocked states.
UX-DR-042: Keep IME preedit separate from committed text; do not submit while composing, and make Esc cancel preedit first while preserving committed text.
UX-DR-043: Make cursor movement, deletion, selection, and history operate on grapheme clusters rather than code units.
UX-DR-044: Use terminal-cell width rather than string length for wrapping and cursor placement; do not normalize user text and preserve committed bytes.
UX-DR-045: Preserve multiline paste bytes and line breaks; use Shift+Enter or a visible configurable Ctrl+J alternative for newline.
UX-DR-046: Enable history only at visual boundaries, save and restore drafts, and never place secrets into history.
UX-DR-047: Keep drafts typed during streaming separate and never auto-queue or auto-dispatch them.
UX-DR-048: Wrap technical spans atomically or expose expanded horizontal inspection, while copy/export returns original bytes.
UX-DR-049: Use logical control IDs, a one-level topmost overlay trap, and inspectable reasons for disabled controls.
UX-DR-050: Define deterministic Tab, Shift+Tab, arrow, Enter, Space, Esc, Ctrl+C, Ctrl+D, and return-focus behavior for every surface; Esc must never authorize.
UX-DR-051: Start approval and consent focus on Review or Cancel, never Approve or Consent.
UX-DR-052: Disable stale approval or consent before the next key event, show prior/current identities, and require fresh evaluation and review.
UX-DR-053: Preserve every stale decision as non-authorizing Evidence.
UX-DR-054: Never overwrite warnings; apply the fixed safety priority and show the highest warning plus `+N warnings`.
UX-DR-055: Always pin Workspace, Work Mode, Permission Profile, Full Access, transfer consent, Runtime Activation revision, and enforcement state.
UX-DR-056: At 40 columns, use one-column status with `WS`, `MODE`, `PROFILE`, `FA`, `XFER`, `ACT`, and `ENF`, while keeping composer and focused action reachable.
UX-DR-057: At 60 columns, use stacked compact status and keep approval actions in a separate final row.
UX-DR-058: At 80 columns, use ordinary grouping; at 120 columns, permit expanded identity and activity detail without introducing additional authority.
UX-DR-059: Below 40 columns, switch to command-oriented text preserving heading, purpose, risk, exact target, action, outcome, and next step.
UX-DR-060: Provide golden fixtures at 40/60/80/120 columns and in truecolor, 256-color, 16-color, monochrome, inverted, and invisible-color modes.
UX-DR-061: Auto-follow streaming output until the user scrolls away from the live boundary.
UX-DR-062: After user scrolling, show `N new output`, with `g` to jump live and `b` to jump to the interruption boundary.
UX-DR-063: Preserve a logical content anchor rather than a row index across replay and resize.
UX-DR-064: Group activity by Prompt Round and operation class with count, first/last state, and duration.
UX-DR-065: Provide show-all, filter, copy, detail, and correlation-navigation controls while preserving safe redaction.
UX-DR-066: Label truncation as `showing x of y lines` and provide expand, next, previous, and copy actions.
UX-DR-067: Make the linearized stream emit durable headings and transitions once, deduplicated by immutable EventId.
UX-DR-068: Let `quiet` suppress transient progress only, while `live` announces grouped updates; neither mode may suppress durable warnings or outcomes.
UX-DR-069: In reduced-motion mode, use static checking text, elapsed time, and one transition line.
UX-DR-070: Never make blinking, a spinner, animation, or Ink redraw the semantic source of state.
UX-DR-071: Model Work Mode, Permission Profile, one-shot approval, transfer consent, Boundary Expansion, Workspace, and Runtime Activation as independent authority dimensions.
UX-DR-072: Keep every safety-critical authority dimension visible in persistent status; `/status` is inspection, not a substitute for persistent visibility.
UX-DR-073: Show OperationId, action digest, ContextManifest digest, target/payload digest, recipient capability/version, endpoint/origin, configuration generation, Workspace, profile, and expiry for every proposed effect.
UX-DR-074: Repeat the same effect identities in approval, activity, Evidence, and terminal outcome.
UX-DR-075: Force fresh evaluation whenever identity, context, payload, destination, classification, retention, authority, or expiry changes.
UX-DR-076: Make Full Access grant show scope, Workspace, expiry, affected action classes, and a persistent `FULL ACCESS` warning.
UX-DR-077: Make Full Access revocation invalidate pending/prepared work while distinguishing already committed effects from cancellation requests.
UX-DR-078: Make `/boundaries` inventory resource/platform identity, Workspace binding, actions, provenance, revision, expiry, invalidation, and revoke controls.
UX-DR-079: Keep local operation approval and remote transfer consent separate under every Permission Profile, including Full Access.
UX-DR-080: Make consent show classification, retention/deletion policy, transformations, call count, expiry, exact recipient, and payload/manifest digests.
UX-DR-081: Classify outbound content as `non-sensitive`, `sensitive`, `redacted-sensitive`, or `unknown`; `unknown` must fail closed.
UX-DR-082: Permit transfer only after no-retention and deletion handling are verified for the exact recipient, endpoint, capability/version, configuration generation, and operation scope.
UX-DR-083: Never persist outbound payload bytes; retain only safe manifest, digest, classification, and Evidence metadata.
UX-DR-084: Limit caches to sanitized derived result, Evidence, source hash, configuration generation, consent reference, and retention metadata.
UX-DR-085: Disclose classification, upstream verification, retention scope, observation time, and deletion status on transfer, result, cache, Evidence, export, recovery, and Session surfaces.
UX-DR-086: Make Session deletion cascade through linked cache, derived, export, and recovery records, retaining only a non-sensitive deletion outcome where permitted.
UX-DR-087: Make source or consent revocation invalidate dependent records and mark them `stale` or `unavailable`.
UX-DR-088: Make force-fresh state that a new remote transfer may occur, repeat upstream verification, and never silently fall back to cache.
UX-DR-089: Use the provider deletion lifecycle `deletion-pending` → `deletion-confirmed` only with provider Evidence; `deletion-failed` quarantines and blocks the affected recipient/configuration.
UX-DR-090: Keep credentials absent from UI, accessibility, logs, snapshots, clipboard, scrollback, errors, persistence, headless output, and crash reports, and clear transient secret buffers on every exit path.
UX-DR-091: Support Evidence states `complete`, `sanitized-with-omissions`, `estimated`, `stale`, `unavailable`, `corrupt`, and `not-authoritative`.
UX-DR-092: Name Evidence omissions and reasons, observation/display times, source hashes, generation, consent/operation/context identity, and correlation.
UX-DR-093: Never allow model explanation to fill or contradict missing deterministic Evidence.
UX-DR-094: Separate operation terminal status from Prompt Round aggregate status.
UX-DR-095: Lead with the strongest unresolved state and never use a checkmark or “completed” for uncertain work.
UX-DR-096: Publish completion only after durable post-commit Evidence.
UX-DR-097: Use the same ordered record—heading, purpose, risk, target/recipient, safe summary, authority, operation identity, Evidence completeness, outcome, next step—in all output modes.
UX-DR-098: Detect TTY/output mode before an interactive gate; without a TTY, approval, consent, credential, Boundary Expansion, or uncertain classification must fail closed before preparation or dispatch.
UX-DR-099: Send normal results to stdout and warnings, refusals, diagnostics, and progress to stderr; never emit secrets, raw payloads, unsafe environment values, or unresolved local fetch authority.
UX-DR-100: Emit machine-readable status, reason, cause, target, OperationId, exit class/code, and next step, using exit codes 0, 1, 10, 20, 30, 70, and 130 for the canonical terminal classes.
UX-DR-101: Expose Specialist states `working`, `Catalogued — Not available yet`, `disabled`, `unconfigured`, `unhealthy`, and `quarantined`; catalogued entries cannot be enabled or invoked.
UX-DR-102: Show selected service, routing reason, schema/modality, health, recipient, verified host, and configuration generation before invocation.
UX-DR-103: Resolve `@path` and `@"path with spaces"` locally and show canonical path, type, size, hash, and Workspace relation before preparation.
UX-DR-104: Make `/context` show ranked contributors, inclusion mode, provenance, token contribution, digest, compaction history, Effective Context Capacity, reserves, and ContextManifest.
UX-DR-105: Give context actions inspect, pin, unpin, compact, new session, and retry explicit consequences before activation.
UX-DR-106: Stop before provider invocation when protected context overflows.
UX-DR-107: Keep `/usage` separate, showing cumulative input/output/cache/calls and only a real configured budget; never invent a percentage.
UX-DR-108: Make `/session` canonical and `/sessions` its explicit alias, with stable sort, search, and short-ID disambiguation.
UX-DR-109: Support keyboard open, inspect, rename, and typed-delete confirmation in the Session browser; never silently rebind a missing or changed Workspace.
UX-DR-110: Restore history, Evidence, context decisions, usage, artifacts, and checkpoint lineage, but start a fresh Manual Runtime Activation without temporary authority.
UX-DR-111: Limit rollback claims to built-in create/edit/delete and show pre-image, post-image, current digest/content, rename, symlink/junction/mount, and concurrent-writer state.
UX-DR-112: Use three-way pre-image/post-image/current inspection for every rollback conflict.
UX-DR-113: Offer only skip target, export patch, rebase/apply to new path, or explicit user-authored resolution; never offer generic overwrite, continue, or blind retry.
UX-DR-114: Record actor, selected action, resulting digest, residual conflict, per-target result, and aggregate rollback result.
UX-DR-115: Make `/recover` the single entry with inspect, reconcile, safe reprompt, retry-disabled explanation, export-safe Evidence, and exit actions.
UX-DR-116: Show two-phase cancellation request and acknowledgement; keep a durable row, and after dispatch commit allow still-running, succeeded, failed, or unknown-outcome rather than falsely claiming cancellation.
UX-DR-117: Reconcile unknown remote work through idempotency identity/status probes where supported, prohibit unsafe equivalent reprompting, and preserve chunks plus `Chat interrupted` and dispatch classification.
UX-DR-118: Freeze the slash-command grammar, options, quoting, `@path` syntax, command schemas, aliases, stable `COMMAND_ERROR`, and prohibition on shell/glob/environment/command substitution.
UX-DR-119: Implement UJ-1 first-use onboarding and Thai OCR, UJ-2 catalog and consent, UJ-3 unhealthy-service recovery, UJ-4 bounded CLI task, UJ-5 Session resume, UJ-6 interrupted remote recovery, and UJ-7 safe rollback with explicit failure paths.
UX-DR-120: When downstream decisions are absent, show `Typhoon version: unverified`, `ENFORCEMENT UNVERIFIED`, `budget not set`, or `security reporting route unavailable`; never invent values or imply the gate passed.

### FR Coverage Map

FR-1: Epic 1 - Install and launch the supported CLI.
FR-2: Epic 1 - Securely onboard and verify Typhoon.
FR-3: Epic 4 - Connect AI-for-Thai just in time for a Specialist Service task.
FR-4: Epics 1 and 4 - Establish evidence-backed availability for Typhoon and Specialist Services.
FR-5: Epic 1 - Submit Thai and mixed Thai-English intent safely.
FR-6: Epic 3 - Run the bounded local Agent Loop for verified coding work.
FR-7: Epic 3 - Inspect only the declared Workspace.
FR-8: Epic 3 - Create and edit bounded text files with checkpoint protection.
FR-9: Epic 3 - Delete Workspace content through a destructive, rollback-aware flow.
FR-10: Epic 3 - Execute controlled local commands and process trees.
FR-11: Epic 3 - Diagnose dependencies without mutating the machine.
FR-12: Epic 3 - Verify task completion through the canonical C++ proof.
FR-13: Epic 4 - Publish the reviewed, versioned Capability Registry.
FR-14: Epic 4 - Route prompts to supported Specialist Services.
FR-15: Epic 4 - Resolve and validate type-specific artifacts locally.
FR-16: Epic 4 - Obtain informed consent for exact remote transfers.
FR-17: Epic 4 - Preserve attributable Specialist Evidence and visible cache provenance.
FR-18: Epic 4 - Report service unavailability honestly and without substitution.
FR-19: Epic 4 - Classify deterministic failures and quarantine the smallest invalid scope.
FR-20: Epic 4 - Retest corrected service configurations explicitly.
FR-21: Epic 2 - Switch independently between Plan and Build.
FR-22: Epic 2 - Select Manual, Assisted, or Full Access independently of Work Mode.
FR-23: Epic 2 - Review approvals through progressive disclosure.
FR-24: Epic 2 - Enforce non-overridable boundaries and durable Boundary Expansions.
FR-25: Epic 2 - Isolate credentials by provider, service, and verified host.
FR-26: Epic 6 - Manage machine-local Saved Sessions.
FR-27: Epic 6 - Restore all previously established Session records.
FR-28: Epic 6 - Start every restored Session with a safe fresh Runtime Activation.
FR-29: Epic 5 - Separate the complete transcript from bounded Active Model Context.
FR-30: Epic 5 - Show context utilization separately from cumulative usage.
FR-31: Epic 5 - Compact safely before over-capacity dispatch.
FR-32: Epic 6 - Recover interrupted remote requests without inventing or retrying uncertain outcomes.
FR-33: Epic 3 - Create attributable checkpoints before eligible built-in mutations.
FR-34: Epic 3 - Apply conflict-safe rollback to attributable changes.
FR-35: Epic 3 - Enforce bounded encrypted checkpoint retention and capacity.
FR-36: Epic 2 - Provide the discoverable command and completion surface.
FR-37: Epic 2 - Keep status, authority, health, and recovery states visible and actionable.
FR-38: Epic 2 - Produce sanitized action and result Evidence.
FR-39: Epic 2 - Correlate and measure every Prompt Round.

All 39 FRs are covered. Epic 7 adds no product FR; it owns the cross-cutting NFR, deferred-decision, governance, and release-certification gates.

## Epic List

### Pre-Implementation Gate (approved before any feature epic that depends on it)

Before Epic 3 begins and before Epic 4 begins, the following normative decisions **must be approved as implementation prerequisites**, not later release certifications. They are sourced from PRD §12.1 Approved Prerequisites and the Architecture Spine. Epic 7 verifies and certifies these already-approved artifacts; it does not define them for the first time.

- **PR-1 — Invalid structured-proposal behavior (PRD §12.1 PR-1, Architecture AD-14).** An invalid structured proposal is rejected after one local schema-validation pass; the validation error is recorded and surfaced as the terminal outcome. Release 1 makes no model repair request, provider retry, protocol reinterpretation, action substitution, or policy relaxation. This is the single authoritative rule for FR-6 and AD-14; no later story may re-decide it. Story 7.3 (traceability gate) becomes a release verification of this already-approved rule, not the first authoritative decision.
- **PR-2 — Sensitive-data and Remote Data Authority policy (PRD §12.1 PR-2, Architecture AD-26.1).** Approved before Epic 4 begins. Specialist transfers use an approved, versioned policy matrix; provider retention/deletion handling must be verified and permitted for the exact configuration and data class before any payload is prepared for transport. No-retention is preferred but not universally required. Provider-side deletion lifecycle states apply only when the provider contract supports them; otherwise transfer is `BLOCKED`. Story 7.2 becomes a release verification of the already-approved policy, not its first definition.
- **PR-3 — Platform/action enforcement matrix (PRD §12.1 PR-3, Architecture AD-12).** Approved before Epic 3 begins. A versioned matrix specifies the required mechanism and fail-closed result for every effect on Windows and macOS. Epic 3 implements against the approved matrix; Story 7.6 certifies the already-defined matrix and does not define it for the first time.
- **PR-4 — Context capacity source (PRD §12.1 PR-4).** Before the exact Typhoon verified limit exists, the UI shows `percentage unavailable`; no `128k` raw limit or `115,200` fallback capacity is a release commitment without a named provider/product decision and source.

### Story dependency model

Every story carries **`dependsOn`** metadata listing the story IDs (or approved prerequisite IDs PR-1…PR-4) it requires as runtime contracts. Edges that point to a later story or later epic are rejected, with one explicit exception: certification stories in Epic 7 may consume evidence produced by already-completed stories without defining runtime behavior. The full `dependsOn` graph is generated from this document and verified mechanically before any story begins implementation; a forward edge blocks the dependent story until its producer is complete.

### Epic 1: Install, Connect, and Hold a Trustworthy First Conversation
A developer can install `thcode`, securely connect Typhoon, submit Thai or mixed-language requests, and receive a durable, attributable response through the terminal. This epic establishes the headless-core/UI contract, durable event and journal foundation, encrypted sensitive persistence, OS-backed credential/key storage, sanitization, durable provider chunks, interruption boundaries, and base status/Evidence projections before their first use.
**FRs covered:** FR-1, FR-2, FR-4, FR-5

### Epic 2: Control Authority and Understand Every Action
A developer can choose how much authority `thcode` has, inspect exactly what it proposes, approve or deny effects safely, and understand every operation’s state and Evidence through interactive, redirected, linearized, and headless surfaces.
**FRs covered:** FR-21, FR-22, FR-23, FR-24, FR-25, FR-36, FR-37, FR-38, FR-39

### Epic 3: Complete and Reverse a Verified Local Coding Task
A developer can let Typhoon inspect a Workspace, establish encrypted checkpoint protection before mutation, prepare and apply bounded file changes, execute controlled commands, verify the result, and safely reverse eligible built-in changes through the canonical cross-platform C++ `Hello, World!` proof.
**FRs covered:** FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-33, FR-34, FR-35

### Epic 4: Use Thai Specialist Services with Informed Consent
A developer can discover the reviewed AI-for-Thai catalog, connect just in time, route a prompt to one of four working services, inspect and consent to the exact transfer, receive attributable results, reuse valid cached Evidence, and recover from scoped service failures.
**FRs covered:** FR-3, FR-4, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20

### Epic 5: Govern Active Context and Usage
A developer can inspect what Typhoon will receive, protect important content, distinguish Active Context from cumulative usage, and compact safely before dispatch without losing transcript history or protected material.
**FRs covered:** FR-29, FR-30, FR-31

### Epic 6: Resume Work Safely Across Saved Sessions and Interruptions
A developer can create, browse, restore, rename, inspect, and delete machine-local Sessions; restore every record type established by earlier epics; recover interrupted remote work; and continue through a fresh Manual Runtime Activation without stale authority or silent Workspace rebinding.
**FRs covered:** FR-26, FR-27, FR-28, FR-32

### Epic 7: Certify and Govern the Public Release
A maintainer can issue an evidence-based go/no-go decision using explicit repository governance, security reporting, sensitive-data policy, exact model pins, numeric performance budgets, platform enforcement, package validation, cross-platform certification, UX/accessibility audits, Specialist contract evidence, and named waiver authority.
**FRs covered:** No new product FRs; this epic verifies the cross-cutting NFRs, deferred PRD decisions, and release gates attached to FR-1 through FR-39.

## Epic 1: Install, Connect, and Hold a Trustworthy First Conversation

A developer can install `thcode` through npm on the supported native Windows and macOS environments, complete a disclosed and protected Typhoon connection flow, submit Thai or mixed Thai-English intent, and receive a durable, attributable response through Ink, redirected text, or headless JSON. Before any transcript or streamed content is written or shown, this epic establishes CoreProtocolV1, versioned event and Evidence contracts, crash-consistent journal/store foundations, encrypted sensitive persistence with OS-backed key storage, credential isolation, mandatory sanitization, health generations, durable provider chunks, interruption boundaries, and base projections. Release 1 supports Windows 11 25H2+ with Windows Terminal/PowerShell via `pwsh.exe`, macOS 14+ with Terminal/zsh, and Node.js `>=22` (Node.js 24 LTS is the clean-machine baseline); Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, non-native shells, hosted request paths, Specialist Services, permissions, local mutations, full context governance, Session browser, rollback application, and release governance are out of scope.

### Story 1.1: Install and preflight the supported native CLI

As a developer  
I want to install and launch `thcode` through npm with a startup preflight  
So that I know before any effect whether this machine can run the supported product.

**Acceptance Criteria**

- **Given** a clean machine running Windows 11 25H2+ with Windows Terminal/PowerShell through `pwsh.exe`, or macOS 14+ with Terminal/zsh, and Node.js `>=22`  
  **When** I run the documented global npm install and then `thcode`  
  **Then** the command launches reproducibly and startup preflight reports the detected platform, shell, Node version, output mode, local store posture, and credential/key-store posture before any provider call or other effect.
- **Given** Node.js is below 22, the platform is unsupported, or the shell is Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, or another non-native shell  
  **When** I launch `thcode`  
  **Then** startup stops with the canonical `blocked`/typed unsupported-environment result, a safe remediation or exit action, the documented nonzero exit class/code, and no credential prompt, store write, network call, or effect.
- **Given** the CLI is installed globally  
  **When** I perform the supported npm update and uninstall procedures and reinstall cleanly  
  **Then** the executable name, package behavior, and first-run detection are deterministic, and uninstall/update does not claim to delete encrypted user data or OS credentials unless that operation was explicitly requested through a separate supported lifecycle.
- **Given** the terminal is redirected or has no TTY  
  **When** startup requires an interactive action  
  **Then** preflight emits the canonical ordered machine-readable/text record to stdout/stderr, reports `blocked` with `next: rerun interactively`, and never reads a secret or waits for an implicit prompt.
- **Given** a preflight probe fails or returns an unknown result  
  **When** the result is rendered  
  **Then** it is labeled with a typed cause and recovery action, never presented as supported, and is safe to inspect without exposing environment secrets or raw errors.
- **Given** the existing brownfield `cli/` prototype with its headless `CoreApp`/Ink split and current entry point  
  **When** Story 1.1 is implemented  
  **Then** the work inventories the existing `cli/` package, establishes a passing baseline build and test run before changes, preserves the headless `CoreApp`/Ink boundary, does not replace the workspace with a generated scaffold or wholesale rewrite, and converges incrementally toward the target architecture. The baseline build/test command, expected passing count, current entry points, and integration seams are recorded as Evidence before any later Story 1.x work changes them.

**Requirements:** FR-1; NFR-10; NFR-12; AD-1; AD-23; UX-DR-001–004, UX-DR-098–100, UX-DR-120.  
**dependsOn:** PR-3 (the platform/action enforcement matrix is referenced by preflight when reporting local store/key-store posture but is not consumed for effect until Epic 3).

### Story 1.2: Define and validate CoreProtocolV1 contracts

As a developer  
I want one versioned protocol for intents, events, projections, and transient updates  
So that Ink, redirected text, headless JSON, persistence, and adapters cannot disagree about authoritative state.

**Acceptance Criteria**

- **Given** the protocol package is built  
  **When** CoreProtocolV1 is compiled and exercised  
  **Then** it defines exhaustive discriminated unions for prompt, session, health, capability, operation, Evidence, and base authority/status intents, plus `Session`, `Status`, `Context`, `Artifact`, and `Capability` projections and durable lifecycle/Evidence versus transient `TokenDelta`/`Progress` events.
- **Given** an operation or event is accepted  
  **When** its envelope is serialized  
  **Then** it contains `SessionId`, `PromptRoundId`, `OperationId`, immutable `EventId`, schema version, UTC timestamp, and deterministic or model provenance, with stable UTF-8 handling for Thai and technical identifiers.
- **Given** a UI or adapter sends an unknown variant, missing required envelope field, or incompatible major protocol version  
  **When** CoreApp validates it  
  **Then** it rejects the input deterministically, fails startup for incompatible major versions, records a sanitized validation outcome where a store is available, and performs no effect or partial projection update.
- **Given** the same protocol fixture is consumed by Ink, redirected text, headless JSON, and persistence  
  **When** each surface renders it  
  **Then** canonical state tokens and field meanings remain identical, including `configured`, `checking`, `available`, `unavailable`, `unknown-outcome`, `complete`, `Chat interrupted`, and `percentage unavailable` where applicable.
- **Given** a malformed protocol fixture or failed compatibility test  
  **When** the test suite runs  
  **Then** it fails closed with the offending schema/version identified and does not silently coerce, repair, reinterpret, or drop the unknown data.

**Requirements:** NFR-7; NFR-9; NFR-10; NFR-15; AD-1; AD-2; AD-3; AD-14; AD-24

### Story 1.3: Establish the durable store, journal, and operation lifecycle

As a developer  
I want one local journal to govern commit visibility and replay  
So that every first-conversation record is crash-consistent, attributable, deduplicated, and never shown as complete before commit.

**Acceptance Criteria**

- **Given** a supported first launch  
  **When** the local per-user SQLite store and journal are initialized  
  **Then** one `StoreFormatVersion` gates the database, journal, projections, artifact envelopes, and future checkpoint envelopes, and migration intent/progress/checksum are persisted before promotion.
- **Given** an accepted operation  
  **When** it advances through the operation state machine  
  **Then** the journal records `proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled`, with one durable terminal outcome and serialized mutation per `SessionId` using optimistic aggregate versioning.
- **Given** the same event is appended twice or a subscription reconnects with `afterSequence`  
  **When** the journal replays  
  **Then** replay is ordered and at-least-once, append is idempotent, and consumers deduplicate by immutable `EventId` without duplicating transcript, Evidence, or terminal output.
- **Given** the process is killed during migration, staging, append, or projection publication  
  **When** the application restarts  
  **Then** incomplete stages are detected, unreachable staged data is repaired or removed, unknown outcomes remain explicit, and no network/native side effect is replayed automatically.
- **Given** a migration is incompatible, checksum-invalid, or unrecoverable  
  **When** startup recovery runs  
  **Then** the store opens read-only as `migration-failed` or `recovery-locked`, preserves existing data, gives an inspect/exit recovery path, and does not overwrite the store or continue to provider use.
- **Given** a durable record has not reached post-commit visibility  
  **When** any UI or headless projection queries it  
  **Then** it cannot report completion or expose a terminal success based only on an in-memory callback or transient progress event.

**Requirements:** NFR-6; NFR-15; AD-3; AD-6; AD-13; AD-20

### Story 1.4: Encrypt sensitive persistence with OS-backed key lifecycle

As a developer  
I want sensitive local data encrypted with a per-install key held by the operating system  
So that a database copy alone cannot disclose first-conversation content and key loss is handled honestly.

**Acceptance Criteria**

- **Given** the durable store is ready and before any sensitive field, transcript, Evidence, or provider chunk is persisted  
  **When** the encryption layer writes data  
  **Then** it uses versioned AES-256-GCM envelopes with a collision-resistant non-repeating nonce, key version, format/algorithm metadata, and authenticated metadata bound to store, record/entity, content class, schema/format, and key version.
- **Given** a fresh install on Windows or macOS  
  **When** the per-install data-encryption key is created  
  **Then** the key is stored only in Windows Credential Manager or macOS Keychain, outside SQLite, and product persistence contains only opaque key references/versions and secret-free fingerprints.
- **Given** ciphertext, authentication metadata, or key version does not match  
  **When** data is decrypted  
  **Then** decryption fails closed before plaintext reaches application code, the record is labeled `corrupt` or `recovery-locked`, and no fallback key is generated.
- **Given** key rotation is interrupted, a key is missing/unreadable, or verification fails  
  **When** startup recovery runs  
  **Then** old ciphertext is preserved, the store enters locked recovery, rotation does not partially promote, and the user is told that unrecoverable content cannot be reconstructed.
- **Given** an encryption write fails before commit  
  **When** the operation completes  
  **Then** no plaintext sensitive value is left in the database, journal, temporary staging, error text, or projection, and the operation has a durable typed failure.

**Requirements:** NFR-1; NFR-6; NFR-7; AD-20; AD-21

### Story 1.5: Make sanitization the shared persistence and presentation boundary

As a developer  
I want one versioned sanitizer applied before persistence, display, logging, export, and provider context  
So that credentials and sensitive diagnostics cannot escape through secondary paths.

**Acceptance Criteria**

- **Given** a value may contain credentials, headers, URL query values, environment data, paths, stack traces, command/tool output, remote payloads, or classified user content  
  **When** it crosses a persistence, projection, log, export, or model-context boundary  
  **Then** the versioned `Sanitizer` classifies and redacts it before the boundary, records policy version and source-Evidence reference, and retains only the safe representation permitted for that content class.
- **Given** sanitization cannot determine whether a value is safe  
  **When** an Evidence or projection is prepared  
  **Then** the operation is blocked or emitted as `sanitized-with-omissions`/`not-authoritative`, with omission reason and recovery action; raw content is not used as a fallback.
- **Given** a Typhoon key, authorization header, opaque secret material, or secret-bearing error is supplied  
  **When** UI, accessibility output, logs, snapshots, crash handling, redirected output, or headless JSON is produced  
  **Then** only `secret entered`/`secret not entered` and an opaque reference or revision may appear; the secret never appears in any output or persisted record.
- **Given** a sanitizer regression fixture contains Thai text, technical identifiers, URLs, hashes, and mixed-language content  
  **When** it is sanitized  
  **Then** Thai UTF-8 remains valid, technical identifiers remain exact where safe, and redaction does not normalize or corrupt user bytes.
- **Given** sanitization fails during a response or error path  
  **When** the system handles the failure  
  **Then** it emits a safe deterministic failure, clears transient secret buffers, and does not publish, persist, or export the unsafe value.

**Requirements:** NFR-2; NFR-7; NFR-9; NFR-10; AD-24; UX-DR-090–093.

### Story 1.6: Provide isolated OS-backed Typhoon credential onboarding

As a developer  
I want to enter my Typhoon key through a disclosed protected form  
So that the key is stored for the exact provider without appearing in product data or output.

**Acceptance Criteria**

- **Given** the supported preflight has passed and encrypted store/key foundations are available  
  **When** first-run onboarding opens  
  **Then** it discloses Typhoon as the only Release-1 reasoning provider, the reviewed/allowlisted effective origin and host, the OS credential facility, what is and is not persisted, and the separate AI-for-Thai credential boundary before focusing the masked input.
- **Given** an interactive TTY is present  
  **When** I type, paste, cancel, replace, or remove a Typhoon key  
  **Then** input is non-echoing and inaccessible to accessibility value output, clipboard, scrollback, history, logs, snapshots, errors, or persistence; transient buffers are cleared on every path; only an opaque credential reference/revision is retained.
- **Given** a key is submitted  
  **When** the credential adapter stores it  
  **Then** it writes only to the OS credential facility, binds retrieval to the exact Typhoon identity and verified host, returns a secret-free revision/fingerprint, and never writes the key to `.env`, project files, SQLite, journal, transcript, Evidence, or headless output.
- **Given** no TTY is available  
  **When** onboarding would require secret entry  
  **Then** it fails closed before reading stdin or preparing a request, emits `blocked` with `next: rerun interactively`, and leaves no pending authority or partial secret.
- **Given** the OS credential facility is unavailable, storage fails, or the user cancels  
  **When** onboarding exits  
  **Then** it reports a typed `unavailable`/`cancelled`/`failed` outcome, offers inspect/retry/replace/remove/exit as applicable, clears buffers, and does not open the main conversation.

**Requirements:** FR-2; NFR-1; NFR-2; NFR-7; AD-11; AD-21; UX-DR-023, UX-DR-098–100.

### Story 1.7: Verify Typhoon health by effective configuration generation

As a developer  
I want Typhoon to be marked available only after a live check of the exact stored configuration  
So that a configured credential is never mistaken for a working connection.

**Acceptance Criteria**

- **Given** a Typhoon credential reference and public configuration exist  
  **When** onboarding performs the minimal live effective-endpoint check  
  **Then** `HealthRegistry` creates an immutable `EffectiveConfigurationGeneration` containing endpoint/origin, credential revision, contract/mapping, adapter/model identity, and dependency identity without storing secrets, and transitions `configured → checking → available` only after authentication and protocol evidence passes.
- **Given** the check detects authentication, connectivity, quota, configuration, or protocol failure  
  **When** the result is normalized  
  **Then** it emits the sanitized failure envelope with deterministic category, scope, generation, OperationId, safe message, cause code, Evidence reference, and retryability; the provider remains `unavailable`, `unhealthy`, or `quarantined` as appropriate and the main conversation is not entered.
- **Given** a configuration or credential revision changes while a check is in flight  
  **When** the old check returns success  
  **Then** the result is rejected as stale, cannot make the new generation `available`, and requires an explicit live retest.
- **Given** a transient timeout, network loss, or quota response occurs once  
  **When** health state is updated  
  **Then** the failure is scoped to the request/configuration as proven, does not silently substitute Typhoon or quarantine unrelated capabilities, and exposes a typed recovery action.
- **Given** the health check is interrupted or its terminal append fails  
  **When** the process restarts  
  **Then** the last durable state is replayed, incomplete checking is detectable, no stale success is reused as current availability, and the user sees `unknown-outcome` or a safe retest path rather than an affirmative connection claim.

**Requirements:** FR-2; FR-4; NFR-6; NFR-7; NFR-12; AD-3; AD-8; AD-9; AD-18

### Story 1.8: Capture Thai and mixed-language intent without changing user bytes

As a developer  
I want to submit Thai or mixed Thai-English requests and see their normalized intent as diagnostic Evidence  
So that the system preserves what I wrote while understanding outcome, constraints, artifacts, and verification intent.

**Acceptance Criteria**

- **Given** the main composer is available after a passing Typhoon health check  
  **When** I enter Thai, English, or mixed Thai-English text with paths, commands, URLs, hashes, code identifiers, multiline paste, combining marks, or emoji/ZWJ graphemes  
  **Then** committed UTF-8 bytes, technical spans, line breaks, grapheme behavior, and terminal-cell-width layout are preserved; input is not normalized or split by code unit.
- **Given** IME preedit is active  
  **When** I press submit or `Esc`  
  **Then** submit is prevented while composing, `Esc` cancels only the preedit first, and committed text remains unchanged.
- **Given** a submitted prompt has enough information  
  **When** local intent extraction runs  
  **Then** it records requested outcome, constraints, artifacts/references, and verification intent in a versioned normalized-intent Evidence record linked to the original prompt hash and PromptRoundId, while preserving the original prompt as immutable local history.
- **Given** material ambiguity remains  
  **When** intent extraction cannot safely determine the requested outcome or constraints  
  **Then** the system asks a clarification question in the same language style where possible, identifies the missing information, and does not invent requirements, dispatch a speculative request, or claim success.
- **Given** intent extraction or Evidence sanitization fails  
  **When** the request is handled  
  **Then** it produces a deterministic `failed`, `blocked`, or `not-authoritative` result with safe diagnostics and no provider dispatch, while retaining enough sanitized Evidence to explain the boundary.

**Requirements:** FR-5; NFR-2; NFR-7; NFR-9; NFR-10; AD-7; AD-14; AD-24; UX-DR-025, UX-DR-041–048.

### Story 1.9: Dispatch Typhoon with durable sanitized stream chunks and interruption boundaries

As a developer  
I want each Typhoon response chunk committed before publication  
So that an interruption never erases known output or invents an ending.

**Acceptance Criteria**

- **Given** Typhoon is `available`, a normalized prompt is accepted, and all first-conversation records have durable foundations  
  **When** a Prompt Round is dispatched  
  **Then** the operation records `prepared` and `dispatch-committed` durably before network transmission, binds the call to its OperationId and effective generation, and does not use a silent alternate provider, protocol interpretation, repair request, or retry.
- **Given** a provider chunk arrives  
  **When** the adapter receives it  
  **Then** it is sanitized, tagged with upstream sequence/high-water identity, idempotently appended as a durable `RemoteOutputObserved` event, and only then published as a transient/UI stream update.
- **Given** duplicate chunks or a reconnect replay occurs  
  **When** the journal consumes them  
  **Then** EventId/upstream identity deduplication prevents duplicate visible transcript content while preserving the durable high-water mark.
- **Given** the process, terminal, or network is interrupted after dispatch commit  
  **When** recovery resumes  
  **Then** all durably known chunks remain available, the transcript shows the exact `Chat interrupted` boundary and interruption classification (`possibly dispatched`, `response started`, `interruption-cancelled`, or `interruption-unknown`), and no equivalent request is automatically retried.
- **Given** a malformed structured Typhoon proposal is returned  
  **When** one local validation pass rejects it  
  **Then** the operation ends deterministically as `malformed`/`failed`, records the sanitized validation Evidence, makes no model repair request, provider retry, reinterpretation, substitution, or policy relaxation, and leaves no partial effect authorization.
- **Given** stream sealing or terminal event persistence fails  
  **When** the UI would otherwise show completion  
  **Then** completion is withheld, the operation remains recoverable as incomplete or `unknown-outcome`, and the failure is visible without claiming a complete response.

**Requirements:** FR-4; FR-5; NFR-6; NFR-7; NFR-9; NFR-12; AD-3; AD-13; AD-14; AD-20; AD-24; PRD-vs-architecture invalid-proposal conflict is recorded as a release traceability note, not an implementation dependency.

### Story 1.10: Expose the first attributable conversation through canonical projections

As a developer  
I want the first conversation to look consistent in Ink, redirected text, and headless JSON  
So that I can understand exactly what happened and recover safely regardless of terminal mode.

**Acceptance Criteria**

- **Given** startup preflight passes, Typhoon is live-verified, and a Prompt Round has durable events  
  **When** the main interface opens  
  **Then** the shell presents the canonical order `status → warnings → transcript/activity → focused result → composer`, with Typhoon identity/health, Workspace state `unverified` until a Workspace is declared, Runtime Activation revision, enforcement state `ENFORCEMENT UNVERIFIED` until verified, and `configured`/`available` state vocabulary visible without implying permissions or future capabilities.
- **Given** a response stream or terminal result exists  
  **When** Ink, redirected text, linearized output, and headless JSON render it  
  **Then** they use the same projection and ordered record fields: heading, purpose, risk, target/provider, safe summary, operation identity, Evidence completeness, outcome, and next step; normal results go to stdout and warnings/refusals/diagnostics/progress go to stderr.
- **Given** the response contains Typhoon explanation, deterministic Evidence, progress, or an interruption  
  **When** the transcript is rendered  
  **Then** each has a separate durable heading, technical identifiers remain exact, Thai explanations may accompany but never replace canonical English state tokens, and `Chat interrupted`/`UNKNOWN OUTCOME` is not led by affirmative success language.
- **Given** the output is narrower than 40 columns or color is unavailable  
  **When** status and outcome are rendered  
  **Then** the text remains semantically complete using labels and stable tokens rather than color, animation, or a spinner as the source of truth; JSON includes status, reason, cause, OperationId, exit class/code, and next step.
- **Given** a first-conversation operation fails, is cancelled, is blocked, or has unknown outcome  
  **When** the user inspects the result  
  **Then** the projection preserves durable partial output and Evidence, gives only valid recovery actions (inspect, correct, explicit retest, or reconcile where supported), never offers an unsafe equivalent retry, and leaves no secret or unresolved authority in the UI/headless response.
- **Given** a complete response and terminal Evidence are durably committed  
  **When** the completion summary is emitted  
  **Then** it identifies the PromptRoundId/OperationId, Typhoon generation, response provenance, Evidence completeness, duration and subsystem timing fields (or `not measured`), and only then reports the terminal outcome.

**Requirements:** FR-1; FR-2; FR-4; FR-5; NFR-2; NFR-6; NFR-9; NFR-10; NFR-12; NFR-15; AD-2; AD-3; AD-8; AD-20; AD-24; UX-DR-021–026, UX-DR-031, UX-DR-037–040, UX-DR-067–070, UX-DR-097–100, UX-DR-120.

## Epic 2: Control Authority and Understand Every Action

**Goal:** A developer can select Work Mode and Permission Profile independently, inspect exact effects, approve or deny safely, rely on hard boundaries, and understand status, Evidence, activity, timing, and command/headless behavior. Epic 2 builds only on Epic 1's CoreProtocolV1, durable journal, encrypted persistence, Sanitizer, Typhoon credential boundary, and first attributable Prompt Round. It establishes authority and observability contracts without implementing file mutation, command execution, checkpoints, Specialist services, full context/session features, or release governance.

### Story 2.1: Establish Runtime Activation and independent authority state

As a developer  
I want Runtime Activation, Work Mode, and Permission Profile to be separate state  
So that changing one control cannot silently grant, retain, or imply another authority.

**Acceptance Criteria**

- **Given** thcode starts, a Session is created or opened, a Session is switched, or the Workspace is rebound  
  **When** Runtime Activation is established  
  **Then** a new activation has a unique activation identity and incremented authority revision, begins in `Manual`, clears Full Access, temporary approvals, transfer consent, and in-flight authority, and records a sanitized durable activation Evidence event before any approval can be requested.
- **Given** a fresh interactive Runtime Activation is ready  
  **When** the initial authority projection is queried  
  **Then** Work Mode is `Build`, Permission Profile is `Manual`, and Workspace identity, activation revision, mode, and profile are independently addressable fields; no profile selection changes Work Mode and no mode selection changes Profile.
- **Given** I select `Plan` or `Build`  
  **When** the mode command or equivalent control is accepted at an idle composer  
  **Then** only Work Mode changes, the authority revision increments, pending authority is invalidated, the new mode is visible immediately, and `Plan` is structurally read-only under every Profile.
- **Given** I select `Manual`, `Assisted`, or `Full Access`  
  **When** the profile command or equivalent control is accepted  
  **Then** only Permission Profile changes, the authority revision increments, pending authority is invalidated, and the projection shows the profile's scope without treating selection as approval, transfer consent, Boundary Expansion, or a health/session/context state.
- **Given** a Runtime Activation is recreated after process restart or a Workspace identity changes  
  **When** old approvals, transfer consents, or Full Access state are encountered  
  **Then** they cannot authorize a new operation, while a valid durable Boundary Expansion is merely revalidated and remains separately inspectable rather than silently granting temporary authority.
- **Given** a mode/profile change is attempted while a prompt is being composed or IME preedit is active  
  **When** the input is processed  
  **Then** the setting does not change until the composer is idle, preedit and committed bytes remain intact, and `Esc` cancels preedit or an overlay without authorizing or mutating authority.

**Requirements:** FR-21; FR-22; FR-28; NFR-7; NFR-10; UX-DR-023–025, UX-DR-041–050, UX-DR-055–059, UX-DR-071–075, UX-DR-120.

### Story 2.2: Implement the versioned PermissionMatrix and local Policy Enforcement Point

As a developer  
I want one versioned policy decision point to evaluate every proposed effect  
So that profiles and modes have deterministic, testable behavior and unknown actions fail closed.

**Acceptance Criteria**

- **Given** the authority package is built  
  **When** a `PermissionMatrix` is loaded  
  **Then** its version and decision inputs are explicit: action class, Work Mode, Permission Profile, risk/sensitivity, Workspace/boundary state, activation revision, and applicable consent or expansion state; each result is exactly `allow`, `ask`, or `deny` with a sanitized reason and policy version.
- **Given** the same action class and authority inputs are evaluated twice  
  **When** the authority revision and policy version are unchanged  
  **Then** the decision and reason are deterministic, attributable to the exact matrix version, and do not depend on UI wording, provider output, or an adapter-local rule.
- **Given** Work Mode is `Plan`  
  **When** any mutation, deletion, command, or other effect proposal is evaluated under Manual, Assisted, or Full Access  
  **Then** the PEP returns `deny` with a read-only boundary reason and no approval control can convert it to `allow`.
- **Given** an unknown, malformed, unsupported, or policy-incomplete action class is evaluated  
  **When** the PEP receives the proposal  
  **Then** it returns `deny`/`not-authoritative`, emits sanitized deterministic Evidence, and does not infer a safer class, repair the proposal, invoke a provider, or reach an effect adapter.
- **Given** an eligible non-sensitive read/list/search proposal is evaluated in Build mode  
  **When** Manual, Assisted, and Full Access decisions are requested  
  **Then** at least one governed action exhibits the defined profile behavior: Manual may `ask` when policy requires, Assisted applies the deterministic matrix and asks on uncertainty, and Full Access suppresses only eligible prompts within declared boundaries; the result is observable in the authority projection and activity Evidence.
- **Given** an effect proposal is accepted by CoreApp  
  **When** the PEP evaluates it  
  **Then** only the local PEP-owned effect executor may receive the resulting authorization or a denied/asked decision; UI, Typhoon, remote output, and concrete adapters cannot authorize or invoke effects directly.
- **Given** the platform/action enforcement capability required by a matrix entry is unavailable or unverified  
  **When** policy evaluation occurs  
  **Then** the PEP fails closed with `ENFORCEMENT UNVERIFIED`, a stable reason code, and a remediation/inspection next step rather than claiming a permissive decision.

**Requirements:** FR-21; FR-22; FR-24; NFR-3; NFR-7; NFR-13; AD-1; AD-2; AD-14; UX-DR-005, UX-DR-023–024, UX-DR-071–075, UX-DR-120.

### Story 2.3: Define Workspace identity and non-overridable hard boundaries

As a developer  
I want every proposal checked against explicit resource and platform boundaries  
So that approval and Full Access cannot authorize unsafe or out-of-scope effects.

**Acceptance Criteria**

- **Given** a Runtime Activation has a declared Workspace  
  **When** a proposal is prepared for policy evaluation  
  **Then** the authority record includes stable Workspace identity, platform identity, canonical target/resource identity, action class, and boundary revision; missing or ambiguous identity is not treated as permission.
- **Given** a proposal targets outside the Workspace, an unsafe path/resource, a host-threatening command class, an unallowlisted network/service destination, an unavailable enforcement mechanism, an exceeded quota, or the wrong credential group  
  **When** the PEP evaluates it under any mode/profile  
  **Then** it returns `deny`, identifies the hard boundary and safe next step, and does not expose an approval or Full Access path that could override it.
- **Given** a proposal changes target identity, path containment, executable identity, destination, service identity, sensitivity, quota scope, or enforcement state after evaluation  
  **When** effect-time revalidation runs  
  **Then** the previous decision is stale, the operation is denied or returned for fresh evaluation, and the old authorization is not consumed.
- **Given** a developer requests a Boundary Expansion  
  **When** the expansion contract is evaluated  
  **Then** it is separately scoped to stable resource identity, Workspace/platform identity, permitted action classes, reason, creation authority, revision, expiry where applicable, and revocation state; it is not represented as a temporary approval or transfer consent.
- **Given** a Boundary Expansion is stored, inspected, revoked, expired, or fails resource revalidation  
  **When** the boundary inventory is queried  
  **Then** its state and exact scope are auditable, revocation prevents future authorization, failure is fail-closed, and no claim is made that an already committed effect was cancelled.
- **Given** the product has not yet resolved a platform/action matrix or numeric release budget  
  **When** a boundary status is shown  
  **Then** it uses `ENFORCEMENT UNVERIFIED` or `budget not set` as applicable and never invents a platform guarantee or release-governance result.

**Requirements:** FR-24; NFR-3; NFR-7; NFR-13; AD-18; AD-22; UX-DR-023–024, UX-DR-055–059, UX-DR-071–079, UX-DR-120.

### Story 2.4: Bind operation authorization to exact proposals and revocation

As a developer  
I want approval to authorize only the exact operation I reviewed  
So that rewritten, replayed, or stale proposals cannot acquire authority.

**Acceptance Criteria**

- **Given** the PEP returns `ask` for a proposal  
  **When** an approval record is created  
  **Then** it binds an unforgeable authorization to `OperationId`, exact action digest, target/context/payload digests where applicable, activation and authority revision, policy decision and matrix version, creation time, expiry, one-shot/consumption state, and the approving interaction.
- **Given** the proposal, target, payload, destination, classification, credential group, authority revision, policy version, or expiry differs from the approved record  
  **When** the effect executor receives the authorization  
  **Then** it rejects the authorization as stale/mismatched, emits non-authorizing Evidence, and requires fresh evaluation and approval.
- **Given** an authorized operation is still before dispatch commit  
  **When** the user denies, cancels, revokes, changes mode/profile, changes Workspace, or a boundary is revoked  
  **Then** the operation becomes `cancelled` or `failed` with a durable reason, the one-shot authority is not consumed as an effect authorization, and no adapter is invoked.
- **Given** an operation has reached `dispatch-committed`  
  **When** revocation or cancellation is requested  
  **Then** the result distinguishes still-running, succeeded, failed, or `unknown-outcome` according to durable Evidence and never claims cancellation without proof; reconciliation remains explicit and does not silently retry.
- **Given** the same approval request is replayed or a duplicate approval event arrives  
  **When** the journal applies it  
  **Then** EventId and authorization identity deduplication prevent double consumption or duplicate execution authority.
- **Given** an approval expires before effect start  
  **When** the executor revalidates immediately before dispatch  
  **Then** it refuses the authorization, records the expiry and next step, and does not treat an expired approval as Full Access or transfer consent.

**Requirements:** FR-23; FR-24; NFR-6; NFR-7; AD-3; AD-13; AD-18; UX-DR-049–053, UX-DR-071–079, UX-DR-091–097.

### Story 2.5: Provide progressive approval disclosure and safe decision controls

As a developer  
I want an approval prompt to start with purpose and risk and reveal exact effect details on demand  
So that I can approve or deny without guessing what will happen.

**Acceptance Criteria**

- **Given** a proposal is eligible for user approval  
  **When** the approval surface opens  
  **Then** it first presents plain-language purpose, risk, proposed outcome, current Workspace, Work Mode, Profile, Full Access state, enforcement state, OperationId, and a clear `Review`/`Cancel` starting focus; it never starts focus on `Approve`.
- **Given** I choose `Review`  
  **When** progressive disclosure expands  
  **Then** it presents authoritative exact details appropriate to the action: exact command/executable/argv/cwd/environment class, mutation target and change summary, deletion scope, or verified Specialist destination and safe transfer summary; technical identifiers remain exact and raw secrets remain absent.
- **Given** the proposal is sensitive, destructive, boundary-expanding, or otherwise ineligible for silent profile approval  
  **When** the decision controls are rendered  
  **Then** the surface requires the explicitly applicable authority and shows why Full Access or an unrelated local approval is insufficient; the user cannot approve an unresolved destination, classification, digest, or enforcement state.
- **Given** I select `Approve`, `Deny`, `Cancel`, or dismiss the overlay  
  **When** the action is processed  
  **Then** the selected decision is recorded against the exact OperationId and digest, `Esc` only cancels/dismisses and never authorizes, and the focus order is deterministic and accessible.
- **Given** the approval becomes stale while open  
  **When** the next key event or submit is received  
  **Then** the committing control is disabled before it can authorize, the prompt changes to stale/mismatch Evidence, and a fresh review is required.
- **Given** no TTY is available for an interactive approval  
  **When** the operation would wait for a decision  
  **Then** it fails closed with `blocked`, `next: rerun interactively`, a stable exit class/code, no stdin secret or authority read, and no effect dispatch.

**Requirements:** FR-23; FR-24; NFR-3; NFR-7; UX-DR-015–016, UX-DR-028, UX-DR-041–050, UX-DR-049–053, UX-DR-071–079, UX-DR-098–100.

### Story 2.6: Define generic prepared-payload and remote-transfer consent contracts

As a developer  
I want remote-transfer consent to bind to a prepared payload and recipient  
So that local read permission, Full Access, and transfer authority cannot be conflated.

**Acceptance Criteria**

- **Given** a future or current operation may send selected material outside the machine  
  **When** `ArtifactResolver`, `Sanitizer`, and `PreparedPayloadManifest` contracts are exercised  
  **Then** they define selected source identities/hashes, safe classification, purpose, transformation/redaction policy, manifest version, canonical manifest digest, exact payload-byte digest, recipient capability/version, verified endpoint, method, call count, retention/deletion handling, operation/Prompt Round scope, expiry, and consent reference without implementing Specialist artifacts or transport.
- **Given** local read permission exists but remote-transfer consent is absent  
  **When** the PEP evaluates the transfer  
  **Then** it returns `ask` or `deny` for transfer independently of local approval, Work Mode, Profile, or Full Access; no provider or service receives the material.
- **Given** classification, destination, retention, deletion handling, transformation, manifest digest, or exact payload-byte digest is unknown or changes  
  **When** consent is requested or effect-time revalidation runs  
  **Then** the transfer fails closed, any prior consent is stale, and the user receives an actionable safe explanation rather than a guessed summary.
- **Given** a consent is granted  
  **When** the contract is serialized  
  **Then** it is bound to both canonical manifest and exact payload-byte digests, recipient capability/version, endpoint, purpose, call count, expiry, operation/Prompt Round scope, activation/authority revision, and policy version; recomputation is required immediately before transport.
- **Given** the prepared payload contains credentials, unresolved local paths, disallowed secrets, or unsafe active content  
  **When** ArtifactResolver or Sanitizer processes it  
  **Then** it blocks or emits `sanitized-with-omissions`/`not-authoritative`, never transfers the unsafe content, and does not expose raw material in the consent UI or Evidence.
- **Given** the consent contract is inspected in Epic 2  
  **When** its implementation boundary is reviewed  
  **Then** it contains no concrete specialist artifact preparation, service adapter, registry invocation, or remote execution; those consumers can attach later without changing authority semantics.

**Requirements:** FR-16; FR-24; FR-25; NFR-2; NFR-4; NFR-7; AD-19; AD-24; UX-DR-029, UX-DR-071–079, UX-DR-091–093.

### Story 2.7: Enforce credential identity and service-host isolation

As a developer  
I want every credential reference bound to one verified provider or service host  
So that an approval or transfer cannot redirect secrets across trust boundaries.

**Acceptance Criteria**

- **Given** Typhoon credential storage from Epic 1 exists  
  **When** authority and provider/service connection identities are projected  
  **Then** Typhoon remains distinct from the AI-for-Thai `CredentialGroupId`, each reference includes exact provider/service identity, verified host/origin, credential revision, and secret-free fingerprint, and no credential value enters CoreProtocol projections.
- **Given** a future credential is requested for an AI-for-Thai service or other declared service host  
  **When** the credential binding contract is evaluated  
  **Then** the request is restricted to the exact verified host and service identity, rejects cross-origin redirects, TLS bypass/downgrade, host mismatch, and credential-in-URL cases, and does not implement onboarding for that service.
- **Given** a Typhoon request is routed toward AI-for-Thai/SCBx or an AI-for-Thai request is routed toward Typhoon  
  **When** the PEP/effect executor validates credential scope  
  **Then** it denies the request as a credential-boundary violation and emits sanitized Evidence without contacting the destination.
- **Given** credential references, revisions, or health/configuration generations change  
  **When** an existing approval or transfer consent is revalidated  
  **Then** the authority is stale and requires fresh policy evaluation; a changed credential cannot silently reuse a prior authorization.
- **Given** logs, prompts, context, transcript, activity, Evidence, accessibility output, clipboard, crash handling, preview, redirected output, or headless JSON is produced  
  **When** it includes connection information  
  **Then** only secret-free identity, host, revision, and sanitized failure information appear; raw credentials and authorization headers never appear.
- **Given** the exact Typhoon model or service contract is not pinned for release  
  **When** the identity is displayed  
  **Then** unresolved values use `Typhoon version: unverified` or an equivalent non-affirmative token and do not claim release governance is complete.

**Requirements:** FR-25; NFR-1; NFR-2; NFR-4; NFR-7; AD-11, AD-19, AD-21; UX-DR-008, UX-DR-023, UX-DR-071–079, UX-DR-090–093, UX-DR-120.

### Story 2.8: Define the base status envelope and state vocabulary

As a developer  
I want one persistent base status contract  
So that every surface can distinguish authority, operation, enforcement, and unresolved outcomes without depending on future feature states.

**Acceptance Criteria**

- **Given** CoreApp publishes a status projection  
  **When** the base envelope is serialized  
  **Then** it includes schema/version, SessionId and Runtime Activation identity/revision, Workspace identity/state, Work Mode, Permission Profile, Full Access scope/expiry if active, Boundary Expansion summary, enforcement state, operation/Prompt Round identity when applicable, stable cause/reason, Evidence completeness/provenance, next step, and timestamp.
- **Given** a base operation is observed  
  **When** status is rendered  
  **Then** it uses the canonical applicable vocabulary `idle`, `proposed`, `authorized`, `prepared`, `dispatch-committed`, `succeeded`, `failed`, `cancelled`, `unknown-outcome`, `reconciled`, `blocked`, `stale`, `not-authoritative`, and `complete` without implying that `configured` means `available` or that approval means success.
- **Given** no current health, context, session-restoration, interruption, or rollback implementation exists in Epic 2  
  **When** the base status is queried  
  **Then** those future typed extension fields are absent or explicitly `not available in this status contract`; Epic 2 does not emit fabricated health/session/context/rollback states or require their implementation.
- **Given** multiple warnings apply  
  **When** the warning projection is ordered  
  **Then** warning priority is deterministic: `UNKNOWN OUTCOME`, stale/mismatch, hard-boundary or enforcement failure, active Full Access, destructive pending action, then ordinary unresolved/pressure diagnostics; warnings are additive and never overwritten by a lower-priority status.
- **Given** a status is shown at 40, 60, 80, or 120 columns, in monochrome, redirected output, linearized output, or JSON  
  **When** it is rendered  
  **Then** Workspace, activation, mode, profile, Full Access, boundaries, transfer consent, enforcement, operation identity, state, cause, and next step remain visible or deterministically inspectable, with text labels rather than color-only meaning.
- **Given** a status field is unknown or not measured  
  **When** the projection is emitted  
  **Then** it uses explicit non-affirmative values such as `ENFORCEMENT UNVERIFIED`, `budget not set`, or `not measured`, and never fills gaps with model explanation or guessed values.
- **Given** the canonical `ux-state-v1` catalog exists as a single mechanical contract across five distinct dimensions (operation status, lifecycle fact, Evidence completeness, measurement quality, provider-deletion lifecycle; see Architecture AD-28)  
  **When** Story 2.8 is implemented  
  **Then** it owns the full versioned registry and mechanically validates every row for: unique display token, unique JSON token, explicit dimension membership, explicit terminality, exactly one symbolic exit class (`NONE` for nonterminal rows), one exit code, and required cause/retry/recovery/narrow/localized fields. `COMMAND_ERROR` is recorded as a fixed error heading layered over a canonical operation status of `blocked` or `malformed`, not as a distinct operation status and not as an additional registry row. `effect-already-committed` is recorded as a nonterminal lifecycle fact whose underlying effect outcome is observed separately, never as a terminal `SUCCESS` outcome. `percentage unavailable`, `estimated`, and `sanitized-with-omissions` are recorded as nonterminal Evidence/measurement qualifiers, never as terminal operation outcomes. Provider-deletion lifecycle rows (`upstream-no-retention-verified`, `deletion-not-required`, `deletion-confirmed`) are recorded as nonterminal lifecycle facts conditional on a verified provider contract. Epic 2-applicable rows are produced in the shared projection contract; future-feature rows remain extension points for later epics and are not fabricated.
- **Given** the registry is mechanically validated  
  **When** later epics add new rows or transition existing rows  
  **Then** they cannot break the dimension, terminality, or exit-class contract owned by Story 2.8; a validation failure blocks the change. Story 7.18 certifies surface parity against this already-frozen contract and is not the first validator.

**Requirements:** FR-21; FR-22; FR-24; FR-37; NFR-6; NFR-7; NFR-10; NFR-15; AD-28; UX-DR-021–024, UX-DR-031–040, UX-DR-054–059, UX-DR-091–100, UX-DR-120.  
**dependsOn:** PR-1 (invalid-proposal behavior pins `malformed` as terminal); Story 1.2 (CoreProtocolV1 contract); Story 1.3 (durable event lifecycle).

### Story 2.9: Record deterministic Evidence and provenance for authority decisions

As a developer  
I want every significant authority decision to have sanitized provenance  
So that I can distinguish what the system proved from what Typhoon explained.

**Acceptance Criteria**

- **Given** a proposal, policy decision, approval, denial, revocation, boundary change, consent decision, or credential-boundary refusal occurs  
  **When** Evidence is appended  
  **Then** it links the relevant PromptRoundId/OperationId, action/target/context/payload digests where applicable, authority revision, matrix/policy version, Workspace identity, provider/service identity, decision, reason code, timestamp, and source event without storing secrets or raw payloads.
- **Given** Evidence is generated from deterministic enforcement or policy evaluation  
  **When** it is presented beside Typhoon explanation  
  **Then** the projection labels deterministic Evidence, model explanation, and user decision separately; model text cannot override a deterministic `deny`, stale, boundary, or unknown-outcome classification.
- **Given** a digest, source, sanitizer result, or required field is unavailable  
  **When** Evidence is persisted or displayed  
  **Then** it is explicitly `sanitized-with-omissions`, `estimated`, `stale`, `unavailable`, `corrupt`, or `not-authoritative` as applicable, records omission/provenance details and next step, and never implies complete proof.
- **Given** an action is auto-permitted by policy, including eligible list/read/search  
  **When** its decision is applied  
  **Then** a compact sanitized Evidence record still identifies the proposal, policy decision, authority revision, and outcome; auto-permission does not make the action invisible.
- **Given** the same Evidence event is replayed  
  **When** projections rebuild  
  **Then** immutable EventId and source provenance preserve one logical record, and an Evidence reference remains navigable from status, activity, approval, and terminal output.
- **Given** raw prompt, command, or payload export is requested  
  **When** export policy is checked  
  **Then** export is disabled by default and only the permitted sanitized, attributable representation can be returned; raw values are not reconstructed from Evidence.

**Requirements:** FR-23; FR-24; FR-25; FR-38; FR-39; NFR-2; NFR-6; NFR-7; NFR-8; NFR-15; UX-DR-026, UX-DR-030, UX-DR-071–079, UX-DR-089–097.

### Story 2.10: Provide activity history and deterministic replay

As a developer  
I want to inspect every proposed and executed call in grouped activity history  
So that automatic actions, decisions, and outcomes can be replayed without duplicate or hidden events.

**Acceptance Criteria**

- **Given** a Prompt Round contains proposals, policy decisions, approval events, consent events, progress, Evidence, or terminal outcomes  
  **When** the activity projection is built  
  **Then** it groups records by Prompt Round and operation class, includes every proposed or executed call including auto-permitted list/read/search, and shows OperationId, event identity, status, safe summary, authority revision, and Evidence reference.
- **Given** the user opens `/activity` or an equivalent activity control  
  **When** the list is inspected  
  **Then** it supports show-all, deterministic filtering, detail expansion, copy of sanitized identifiers/summaries, correlation navigation to approval/Evidence/terminal records, and explicit truncation counts without exposing raw prompts, commands, or payloads by default.
- **Given** journal replay delivers events at least once or out of a reconnecting subscription  
  **When** the activity projection consumes them  
  **Then** it orders by durable sequence/timestamp rules, deduplicates by EventId, preserves source/provenance, and does not duplicate calls or terminal outcomes.
- **Given** an operation has a durable terminal result  
  **When** activity history is queried  
  **Then** it shows the operation lifecycle through `proposed`, `authorized`, `prepared`, `dispatch-committed`, and its applicable terminal/reconciliation state, without inventing future specialist, context, or rollback events.
- **Given** the activity record is narrow, redirected, linearized, headless JSON, screen-reader, or no-color output  
  **When** it is rendered  
  **Then** labels, operation/event identities, state tokens, counts, warnings, and next steps remain semantically complete and navigable without animation or color-only cues.
- **Given** an event or projection is corrupt, incomplete, or unavailable during replay  
  **When** activity is shown  
  **Then** the affected record is marked `corrupt`/`unavailable`/`not-authoritative`, the gap and recovery action are visible, and replay does not claim a complete history.

**Requirements:** FR-36; FR-37; FR-38; FR-39; NFR-6; NFR-7; NFR-10; NFR-15; UX-DR-027, UX-DR-064–070, UX-DR-091–097.

### Story 2.11: Correlate Prompt Rounds and measure timing

As a developer  
I want one correlation identity and end-to-end duration for each Prompt Round  
So that I can understand timing without confusing utilization, usage, or model explanation with deterministic performance Evidence.

**Acceptance Criteria**

- **Given** a prompt is accepted into a Prompt Round  
  **When** the round is initialized  
  **Then** it receives one stable `PromptRoundId` and correlation identity shared by intent, authority, proposals, approvals/consents, provider observations, activity, Evidence, and terminal records, while each operation retains its own `OperationId`.
- **Given** a Prompt Round progresses or terminates  
  **When** timing Evidence is recorded  
  **Then** it contains one end-to-end duration measured from accepted request to durable terminal visibility plus attributable subsystem timings for available phases, with missing measurements labeled `not measured` rather than guessed.
- **Given** multiple operations occur within one Prompt Round  
  **When** timing and activity are displayed  
  **Then** operation durations remain distinct from the Prompt Round duration, correlation navigation is bidirectional, and no child timing is silently presented as the whole round.
- **Given** utilization or cumulative usage data is available  
  **When** status and timing are rendered  
  **Then** context/utilization and cumulative usage remain separate from elapsed time, no percentage is shown without a real budget, and unresolved numeric budgets use `budget not set`.
- **Given** a Prompt Round is interrupted, blocked, stale, or has unknown outcome  
  **When** its timing record is finalized  
  **Then** the duration remains attributable to the actual terminal state, warnings retain priority, and the record does not claim successful completion or an absent remote effect.
- **Given** a timing event is replayed or terminal persistence fails  
  **When** timing projections rebuild  
  **Then** EventId deduplication prevents double counting and completion/timing remain pending or `unknown-outcome` until durable Evidence makes the state authoritative.

**Requirements:** FR-37; FR-39; NFR-6; NFR-12; NFR-14; NFR-15; UX-DR-037–040, UX-DR-064–070, UX-DR-091–100, UX-DR-120.

### Story 2.12: Define post-commit completion and terminal semantics

As a developer  
I want completion to mean durable, attributable terminal Evidence  
So that progress, callbacks, and optimistic UI cannot claim an action finished prematurely.

**Acceptance Criteria**

- **Given** an accepted operation reaches a terminal outcome  
  **When** completion is considered  
  **Then** exactly one durable terminal outcome is appended and made visible after the journal has committed the relevant post-dispatch Evidence, result/provenance, timing, and sanitizer outcome; transient callbacks cannot emit completion.
- **Given** an operation is `succeeded`, `failed`, `cancelled`, `unknown-outcome`, or `reconciled`  
  **When** the terminal projection is rendered  
  **Then** it includes OperationId, PromptRoundId, authority revision, action/target digests where applicable, deterministic cause, Evidence completeness/provenance, duration, next step, and the stable outcome token; it never leads an unresolved outcome with affirmative success language.
- **Given** dispatch has not committed  
  **When** cancellation, denial, revocation, or stale authority is durable  
  **Then** the operation may end `cancelled`, `failed`, `blocked`, or `stale` without consuming effect authority or claiming an effect occurred.
- **Given** dispatch has committed but an outcome is not proven  
  **When** the process, terminal append, or remote response is interrupted  
  **Then** the operation is `unknown-outcome` or an explicitly supported interruption state, preserves known Evidence, prevents automatic equivalent retry, and exposes reconciliation/inspection rather than cancellation fiction.
- **Given** an operation's completion event is duplicated or a late progress event arrives  
  **When** projections consume events  
  **Then** one terminal result remains authoritative, late progress cannot reopen or overwrite it, and EventId deduplication preserves deterministic output.
- **Given** a completion summary is emitted to stdout, stderr, or JSON  
  **When** exit behavior is selected  
  **Then** normal result content is on stdout, warnings/diagnostics/progress are on stderr, and the `ux-state-v1` exit mapping is exact and stable: `SUCCESS=0` for `succeeded`/`reconciled`, `FAILED=1` for `failed`/`malformed`/`corrupt`, `BLOCKED=20` for `blocked`/`denied`/`stale`/`refused`/`unavailable`/`not-authoritative`/`ENFORCEMENT UNVERIFIED`, `UNKNOWN_OUTCOME=70` for `unknown-outcome` and possible-dispatch states, and `CANCELLED=130` for `cancelled`; nonterminal states use `NONE` and JSON `null`, with no color-only meaning.

**Requirements:** FR-37; FR-38; FR-39; NFR-6; NFR-7; NFR-10; NFR-12; NFR-15; UX-DR-026, UX-DR-054, UX-DR-091–100.

### Story 2.13: Define the controlled command grammar and CoreApp dispatch surface

As a developer  
I want a frozen, discoverable command grammar that dispatches only through CoreApp  
So that aliases, completion, and command errors cannot bypass authority or invoke arbitrary shell behavior.

**Acceptance Criteria**

- **Given** the Epic 2 command surface is available  
  **When** I invoke `/status`, `/permissions`, `/mode`, `/boundaries`, `/connections`, `/activity`, `/models`, `/tools`, `/check`, `/help`, or a declared product-controlled alias/completion path  
  **Then** each command and alias is covered by the frozen grammar fixture, maps to a reviewed CoreApp dispatch/query, uses the canonical projection and state vocabulary, preserves exact technical identifiers, and never permits shell expansion, globbing, environment interpolation, command substitution, implicit Workspace rebinding, or executable user-defined commands.
- **Given** a command is typed with an alias, partial name, argument, option, or completion request  
  **When** grammar parsing and completion run  
  **Then** only declared commands/aliases/options are suggested, completion is deterministic and context-aware, technical tokens remain atomic, and `Tab` accepts a completion only while the completion menu is open; otherwise it remains focus traversal.
- **Given** `/models` or `/tools` is invoked  
  **When** the result is rendered  
  **Then** `/models` remains Typhoon inspection-only with health/configuration identity and unresolved pin values honestly labeled, while `/tools` may expose registry command-shell and diagnostic controls without implementing or invoking the Epic 4 Capability Registry or Specialist services; `Catalogued — Not available yet` entries are not made invokable.
- **Given** a command, alias, argument, option, completion request, or dispatch intent is malformed or unsupported  
  **When** CoreApp handles it  
  **Then** it returns a sanitized deterministic error with canonical state token, reason/cause, usage/remediation, and the applicable exit class/code, does not execute a shell command or mutate a file, and records the rejected intent in activity/Evidence where durable storage is available.
- **Given** the command surface is used from redirected, linearized, or headless mode  
  **When** a command succeeds or fails  
  **Then** it uses the same CoreApp projection and grammar result as Ink, preserves stdout for normal results and stderr for warnings/diagnostics/progress, and includes status, cause, target, OperationId/PromptRoundId where applicable, exit class/code, and next step in JSON.
- **Given** a command would require an interactive approval or consent  
  **When** no TTY is available  
  **Then** dispatch fails closed before waiting for stdin or preparing an effect, emits `blocked` with `next: rerun interactively` and the exact stable exit mapping, and leaves no pending authority.

**Requirements:** FR-36; FR-37; FR-38; FR-39; NFR-3; NFR-7; NFR-9; NFR-10; NFR-15; UX-DR-004–006, UX-DR-015–016, UX-DR-021–024, UX-DR-031–040, UX-DR-064–070, UX-DR-091–100, UX-DR-098–100, UX-DR-118, UX-DR-120.

### Story 2.14: Integrate authority control surfaces and accessible output behavior

As a developer  
I want authority controls and their status to behave consistently across terminal surfaces  
So that focus, IME, stale decisions, and constrained output cannot cause an unsafe or misleading action.

**Acceptance Criteria**

- **Given** a mode, profile, boundary, permission, approval, or consent control is focused  
  **When** keyboard navigation is used  
  **Then** focus is deterministic and logical, approval/consent begins on `Review` or `Cancel`, `Shift+Tab` switches Plan/Build only at an idle composer, and `Esc` dismisses overlays or cancels IME preedit without authorizing or changing settings.
- **Given** a stale approval or consent is visible  
  **When** the next key event or submit is received  
  **Then** the committing control is disabled before it can authorize, stale/mismatch Evidence is shown, fresh review is required, and focus plus screen-reader output identifies the disabled reason.
- **Given** Thai IME preedit, mixed scripts, grapheme clusters, multiline drafts, technical tokens, or narrow terminal-cell widths are present  
  **When** authority controls, prompts, warnings, activity, approval details, or terminal results render  
  **Then** preedit and draft bytes are preserved, atomic technical spans remain intact, wrapping is cell-width safe, and mode/profile/approval changes cannot consume or corrupt input.
- **Given** output is redirected, linearized, headless JSON, monochrome, or the process has no TTY  
  **When** a status, approval, denial, warning, activity, or terminal result is produced  
  **Then** the same canonical projection remains semantically complete; interactive approval/consent fails closed with `blocked`, `next: rerun interactively`, exact exit class/code, and no stdin wait, while JSON includes status, cause, target, OperationId, PromptRoundId, exit class/code, and next step.
- **Given** the shell is rendered at 40, 60, 80, or 120 columns or reduced-motion/accessibility mode is active  
  **When** the surface updates  
  **Then** status, warnings, transcript/activity, focused decision/result, and composer retain the stable order, warning priority, text-label state distinction, screen-reader names/descriptions, and non-animated semantic updates; durable updates remain visible after scrolling and do not rely on animation.
- **Given** a control-surface interaction is cancelled, denied, interrupted, or unavailable  
  **When** the result is announced  
  **Then** canonical English state tokens remain exact, Thai explanations may accompany them, no color is the sole state carrier, and only valid next actions are exposed.
- **Given** the same authority state is rendered in Ink, redirected text, linearized output, and headless JSON  
  **When** the projections are compared  
  **Then** Workspace, Runtime Activation, Work Mode, Permission Profile, Full Access, Boundary Expansions, transfer consent, enforcement, warnings, operation identity, and next step retain the same meaning and order appropriate to the surface.

**Requirements:** FR-21; FR-22; FR-23; FR-24; FR-37; FR-38; FR-39; NFR-3; NFR-7; NFR-9; NFR-10; NFR-15; UX-DR-004–006, UX-DR-015–016, UX-DR-021–030, UX-DR-031–040, UX-DR-041–050, UX-DR-054–070, UX-DR-071–080, UX-DR-091–100, UX-DR-118, UX-DR-120.

## Epic 3: Complete and Reverse a Verified Local Coding Task

A developer can inspect a declared Workspace, establish encrypted rollback protection before mutation, create/edit/delete bounded files, execute controlled commands, verify results, and reverse eligible built-in changes through the canonical cross-platform C++ `Hello, World!` proof. This epic builds on Epics 1–2: CoreProtocolV1, the durable operation journal and post-commit event contract, encrypted persistence and OS-backed key lifecycle, Sanitizer, Runtime Activation, PermissionMatrix, Policy Enforcement Point, exact operation authorization, headless parity, and canonical UX state/output contracts.

**Implementation prerequisite:** Epic 3 implements against the approved platform/action enforcement matrix (PRD §12.1 PR-3, Architecture AD-12). Stories 3.1, 3.7, and 3.11 fail closed with `ENFORCEMENT UNVERIFIED` only when an implementation problem with an already-approved matrix is discovered; they do not wait for a matrix first defined later in Epic 7. Epic 7 certifies the already-defined matrix.

**FRs covered:** FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-33, FR-34, FR-35.

### Story 3.1: Resolve Workspace, platform, and resource identity with bounded read policy

As a developer  
I want thcode to bind every local operation to a stable Workspace and platform/resource identity  
So that inspection and later effects cannot escape the declared boundary or act on an ambiguous target.

**Acceptance Criteria**

- **Given** a supported native Windows 11 25H2+ `pwsh.exe` or macOS 14+ zsh Runtime Activation declares a Workspace
  **When** Workspace binding is established
  **Then** thcode records a stable Workspace identity containing platform identity, canonical root identity, case/Unicode policy, filesystem volume or device identity where available, and an explicit binding status; a missing, inaccessible, or ambiguous root is `blocked` and cannot authorize local effects.
- **Given** a path, directory entry, open handle, or resource reference is supplied
  **When** the resolver evaluates it
  **Then** it produces a canonical resource identity plus display path, type, size, and expected digest/version without treating a display string as authority; Windows drive/UNC paths, macOS paths, separators, spaces, case behavior, Unicode normalization, rename, and inode/file-ID or equivalent identity are handled according to the versioned platform/action matrix.
- **Given** a path traverses a symlink, Windows junction, mount point, reparse point, or equivalent boundary
  **When** containment is checked
  **Then** the resolver follows only the explicitly allowed policy, revalidates the target immediately before use, and returns `denied`, `conflict`, or `ENFORCEMENT UNVERIFIED` rather than claiming containment when identity cannot be proven.
- **Given** list, read, or search is proposed
  **When** the local PEP evaluates it in Plan or Build
  **Then** it permits only bounded, non-sensitive in-Workspace inspection according to the PermissionMatrix; Plan remains structurally read-only, Manual does not interrupt eligible inspection when no material transfer occurs, and Full Access cannot expand the Workspace or bypass platform checks.
- **Given** the platform/action enforcement matrix or required identity mechanism is unavailable
  **When** any affected operation is evaluated
  **Then** thcode emits `ENFORCEMENT UNVERIFIED`, fails closed for the affected operation, preserves safe inspection of the reason, and performs no native filesystem effect.

**Requirements:** FR-6; FR-7; FR-24; NFR-3; NFR-7; NFR-9; NFR-10; AD-4; AD-5; AD-12; AD-22; AD-27; UX-DR-023, UX-DR-055–059, UX-DR-071–075, UX-DR-098–100, UX-DR-103, UX-DR-120.

### Story 3.2: Establish encrypted CheckpointRepository and ArtifactStore foundations

As a developer  
I want checkpoint metadata and retained originals stored through encrypted, crash-consistent repositories  
So that rollback protection exists before a mutation can depend on it and cannot be mistaken for an in-memory promise.

**Acceptance Criteria**

- **Given** Epic 1 encryption, journal, StoreFormatVersion, and OS-backed DEK facilities are available
  **When** the checkpoint persistence ports are introduced
  **Then** `CheckpointRepository` owns checkpoint content references, mutation metadata, lineage references, coverage state, retention state, and integrity state; `ArtifactStore` owns immutable encrypted bytes and content metadata; Session owns only checkpoint lineage and references; and the operation journal owns commit visibility.
- **Given** an original file or binary must be retained
  **When** `ArtifactStore` stages it
  **Then** the bytes are encrypted with the existing versioned AES-256-GCM envelope, collision-resistant nonce, and authenticated metadata bound to store/entity/content class/schema/key version; plaintext originals never enter SQLite, logs, UI, Evidence, or unencrypted temporary storage.
- **Given** checkpoint metadata or immutable bytes are staged
  **When** a crash occurs before commit, during append, or during reference publication
  **Then** startup detects incomplete stages, removes or marks unreachable staged material, preserves unknown operation state, and never exposes an incomplete/corrupt checkpoint as complete or replays a native effect.
- **Given** a repository record, artifact digest, operation identity, or authenticated metadata is altered or mismatched
  **When** it is read
  **Then** decryption/integrity verification fails closed as `corrupt` or `recovery-locked`, no content reaches application code, and the user receives inspect/read-only recovery actions only.
- **Given** checkpoint data is committed
  **When** references and terminal events become visible
  **Then** the journal is the sole commit-visibility authority, all participating records share `OperationId`, aggregate version, and commit state, and UI/headless completion is derived only from post-commit events.

**Requirements:** FR-33; FR-35; NFR-1; NFR-6; NFR-15; AD-3; AD-5; AD-20; AD-21; AD-24; UX-DR-091–093, UX-DR-110–115.

### Story 3.3: Preflight the complete mutation set and establish protection status

As a developer  
I want thcode to plan every intended built-in mutation before the first mutation  
So that I know whether the whole change set is protected, partially protected, or unprotected before approving any effect.

**Acceptance Criteria**

- **Given** Typhoon proposes one or more built-in create, edit, or delete operations in Build mode
  **When** mutation planning runs
  **Then** the plan is read-only and enumerates the complete intended set, stable resource identities, action digests, expected pre-image digest/version, proposed post-image or deletion manifest, rename/alias relationships, checkpoint size, binary status, and excluded effects before any native mutation.
- **Given** the complete mutation set is known
  **When** protection preflight evaluates it
  **Then** thcode checks, in order: resolve stable identity → capture expected digest/version → evaluate PEP/PermissionMatrix/quota/platform checks → stage checkpoint originals/metadata/post-plan → make the stage durable; only then may the result be labeled `fully protected`, `partially protected`, or `unprotected`.
- **Given** any target changes identity/content, is inaccessible, crosses a symlink/junction/mount, has an open-handle or concurrent-writer uncertainty, exceeds a per-checkpoint/store cap, or cannot be represented safely
  **When** preflight completes
  **Then** the affected target is excluded or the whole operation is blocked according to policy, the exact reason and protection coverage are shown, and no mutation occurs before a new plan/review.
- **Given** protection is partial or unavailable but the requested action is otherwise eligible
  **When** the developer reviews the plan
  **Then** thcode discloses the exact unprotected scope and residual risk; proceeding requires explicit confirmation for that exact scope, and Full Access cannot suppress checkpoint rules or convert Plan into authorization.
- **Given** the user changes the proposal, Workspace, authority revision, target, digest, quota, or platform state after planning
  **When** effect-time validation runs
  **Then** the plan and any approval are `stale`/`mismatch`, staged authorization is not consumed, and a fresh read-only plan is required.

**Requirements:** FR-6; FR-8; FR-9; FR-24; FR-33; FR-35; NFR-3; NFR-6; NFR-7; NFR-13; AD-4; AD-12; AD-13; AD-19; AD-20; AD-27; UX-DR-073–080, UX-DR-095–097, UX-DR-111, UX-DR-120.

### Story 3.4: Safely list, read, and search Workspace text

As a developer  
I want to inspect bounded Workspace files safely  
So that Typhoon can understand a repository without receiving out-of-scope content or changing it.

**Acceptance Criteria**

- **Given** a valid Workspace binding exists
  **When** list, read, or search executes
  **Then** the tool resolves and revalidates every resource identity, stays within the Workspace, applies no-follow and parser/resource limits, bounds recursion, file count, text bytes, and search work, and returns sanitized results with path/type/size/digest metadata.
- **Given** a path is outside the Workspace, unsupported, ambiguous, inaccessible, a symlink/junction/mount target cannot be proven safe, or a rename changes identity during inspection
  **When** the tool evaluates it
  **Then** it returns `denied`, `inaccessible`, `conflict`, or `ENFORCEMENT UNVERIFIED` with a safe next step and no content from the unsafe target.
- **Given** a file is binary, hostile, over the configured read limit, malformed UTF-8, or contains active/external references
  **When** read or search considers it
  **Then** thcode applies the type and resource policy, returns bounded metadata or a typed refusal, preserves valid Thai UTF-8 and technical identifiers, and never silently decodes, expands, or transfers the file.
- **Given** Manual profile is active and inspection is eligible, in-Workspace, and non-transferring
  **When** the operation is proposed
  **Then** it may proceed without an approval interruption, still appears in the activity log and Evidence, and cannot authorize a later mutation or remote transfer.
- **Given** Plan mode is active
  **When** any list/read/search operation runs
  **Then** it remains read-only and the resulting plan/Evidence cannot be consumed as mutation authorization.

**Requirements:** FR-6; FR-7; FR-21; FR-22; FR-24; FR-38; NFR-2; NFR-3; NFR-4; NFR-9; AD-4; AD-12; AD-15; AD-24; UX-DR-027, UX-DR-037–040, UX-DR-091–093, UX-DR-103.

### Story 3.5: Apply guarded built-in file creation and editing

As a developer  
I want proposed text-file creation and edits shown and applied only after exact checks  
So that bounded changes are attributable, inspectable, and protected for rollback.

**Acceptance Criteria**

- **Given** Build mode and an eligible text-file create/edit proposal
  **When** the proposal is prepared
  **Then** the preview shows exact target identity, expected pre-image digest/version or `absent`, bounded patch/content summary, resulting post-image digest plan, exclusions, OperationId, authority, and checkpoint coverage; Plan returns `deny` and cannot authorize.
- **Given** the mutation set has passed protection preflight
  **When** the effect executor starts the operation
  **Then** it performs the exact order: resolve stable identity → capture expected digest/version → PEP/PermissionMatrix/quota/platform checks → stage checkpoint originals/metadata/post-plan → make stage durable → atomically consume authorization + append `EffectDispatchCommitted` → native mutation → durable result/post-image → publish checkpoint reference and terminal event post-commit; no UI completion is emitted earlier.
- **Given** Manual profile is active
  **When** the target or proposed bytes differ from the reviewed digest/plan
  **Then** approval is stale, the operation is not dispatched, and a fresh exact review is required; no generic approval, Full Access, or model output can authorize the changed proposal.
- **Given** a concurrent writer, rename, open-handle uncertainty, case/Unicode identity mismatch, symlink/junction/mount change, or failed compare-and-apply occurs
  **When** the native adapter revalidates
  **Then** it returns `conflict` or `unknown-outcome` without best-effort overwrite, preserves unrelated user work, and records deterministic Evidence.
- **Given** the native mutation succeeds
  **When** post-image capture and durable append finish
  **Then** the result records the actual post-image digest/version, bytes/line metadata as permitted, verification status, checkpoint reference, and exclusions; completion is withheld until post-commit Evidence is visible.

**Requirements:** FR-6; FR-8; FR-21; FR-22; FR-23; FR-24; FR-33; FR-38; FR-39; NFR-3; NFR-6; NFR-7; AD-4; AD-12; AD-13; AD-19; AD-20; AD-27; UX-DR-028, UX-DR-073–077, UX-DR-095–097, UX-DR-111.

### Story 3.6: Apply guarded destructive deletion with quarantine

As a developer  
I want destructive deletion to be visibly scoped and safely quarantined  
So that recursive removal cannot traverse changed content or claim protection it did not establish.

**Acceptance Criteria**

- **Given** Build mode proposes deletion of an in-Workspace file or directory
  **When** the deletion preview is prepared
  **Then** it is labeled `DESTRUCTIVE`, shows exact root identity, ordered descendant identity/content manifest, count/size bounds, symlink/junction/mount/open-handle policy, checkpoint coverage, and exclusions; Plan denies it under every profile.
- **Given** Manual profile is active
  **When** the deletion is reviewed
  **Then** explicit approval is required for the unchanged exact root and manifest; Full Access may suppress only eligible prompts inside the declared boundary and cannot bypass the destructive, identity, checkpoint, or platform rules.
- **Given** the manifest and protection plan pass
  **When** the effect executor starts
  **Then** it performs the exact order: resolve stable identity → capture expected digest/version and ordered descendant manifest → PEP/PermissionMatrix/quota/platform checks → stage checkpoint originals/metadata/post-plan → make stage durable → atomically consume authorization + append `EffectDispatchCommitted` → atomically rename/quarantine the root on the same filesystem → remove the quarantined content → durable result/post-image/deletion Evidence → publish checkpoint reference and terminal event post-commit; no UI completion occurs earlier.
- **Given** any descendant changed, disappeared, was added, crossed a link/mount, is open or locked, or quarantine cannot be enforced atomically
  **When** deletion revalidation runs
  **Then** thcode stops before removal, returns `conflict`, `unknown-outcome`, or `ENFORCEMENT UNVERIFIED`, and never continues best-effort recursion.
- **Given** deletion succeeds
  **When** post-commit Evidence is published
  **Then** it records the deleted root and manifest identity, encrypted recoverability where retained, exact excluded effects, and a terminal result; shell, permission, process, symlink-side, and external effects are never described as reversed by rollback.

**Requirements:** FR-6; FR-9; FR-21; FR-22; FR-23; FR-24; FR-33; FR-34; FR-35; FR-38; NFR-3; NFR-6; NFR-7; AD-4; AD-12; AD-13; AD-19; AD-20; AD-27; UX-DR-028, UX-DR-039, UX-DR-073–077, UX-DR-111.

### Story 3.7: Validate and execute controlled commands and process trees

As a developer  
I want exact local commands run inside a controlled process tree  
So that compilation and verification cannot escape the Workspace or leave orphaned work.

**Acceptance Criteria**

- **Given** Build mode proposes a command
  **When** the command is validated
  **Then** thcode resolves the approved executable identity, validates an explicit argv vector, Workspace-contained cwd, allowed environment names/values, shell/startup-hook policy, timeout, output limits, and action digest; shell expansion, command substitution, implicit current-directory rebinding, unsafe environment inheritance, and host-threatening commands are rejected.
- **Given** a command targets an unsupported shell/platform, out-of-Workspace resource, privileged/system mutation, network boundary, or unavailable process enforcement
  **When** the PEP evaluates it
  **Then** it returns `denied`, `refused`, or `ENFORCEMENT UNVERIFIED`, records the reason, and does not launch a process under any profile.
- **Given** the exact command has passed policy and approval requirements
  **When** execution starts
  **Then** the operation records the exact executable, argv, cwd, safe environment summary, authority, and timeout; the PEP atomically consumes authorization and appends `EffectDispatchCommitted` before launch, and output is sanitized before Evidence or UI publication.
- **Given** timeout, Ctrl+C, cancellation, terminal loss, or process failure occurs
  **When** cancellation is requested
  **Then** thcode shows request and acknowledgement phases, terminates the controlled process tree, waits for descendants or records cleanup uncertainty, prevents orphan processes, and reports `cancelled`, `failed`, `still-running`, or `unknown-outcome` honestly.
- **Given** a command changes files, permissions, processes, remote state, or external resources
  **When** rollback scope is displayed
  **Then** those effects are marked excluded/`never-protected` unless separately observed as built-in file mutations, and no command result is treated as a rollback checkpoint.

**Requirements:** FR-6; FR-10; FR-12; FR-24; FR-38; FR-39; NFR-2; NFR-3; NFR-5; NFR-6; NFR-7; AD-4; AD-12; AD-13; AD-24; UX-DR-023, UX-DR-073–077, UX-DR-097, UX-DR-116.

### Story 3.8: Run non-mutating dependency preflight

As a developer  
I want `/check` to inspect project prerequisites without changing the machine  
So that missing tools are diagnosed accurately before a proof attempt.

**Acceptance Criteria**

- **Given** a declared Workspace is readable
  **When** dependency preflight runs
  **Then** it inspects bounded project metadata and verified documentation, probes only approved runtimes, compilers, package managers, and documented commands, and records platform, version, executable identity, probe output classification, and evidence without installing or modifying anything.
- **Given** the C++ compiler required by the canonical proof is present and invokable
  **When** the probe completes on Windows or macOS
  **Then** it records the compiler identity/version and a `verified` prerequisite result tied to the current platform/Workspace generation; it does not claim source or task success yet.
- **Given** no supported compiler is found, invocation is inaccessible, or the probe is incompatible
  **When** preflight completes
  **Then** it classifies the result as a prerequisite blocker, provides platform-specific guidance from the maintained registry or verified project documentation, does not blame source code, invent URLs, run privileged installers, or silently install dependencies.
- **Given** `/check` is rerun after an environment change
  **When** the new result is produced
  **Then** it is a fresh explicit probe with a new Evidence identity and does not reuse a stale success as current availability; unknown probe results remain `probe-failed` or `incompatible`.
- **Given** Plan mode, Manual, Assisted, Full Access, or no TTY is active
  **When** preflight runs
  **Then** it remains read-only, cannot be converted into mutation authorization, and emits the canonical narrow/headless result without an interactive gate.

**Requirements:** FR-6; FR-11; FR-12; FR-21; FR-22; FR-24; FR-38; NFR-3; NFR-7; NFR-10; AD-4; AD-12; AD-15; UX-DR-039, UX-DR-037–040, UX-DR-098–100, UX-DR-120.

### Story 3.9: Establish Agent Loop lifecycle and validated tool-result mediation

As a developer  
I want the local Agent Loop to mediate every validated proposal and tool result  
So that Typhoon can iterate through bounded work without becoming local effect authority.

**Acceptance Criteria**

- **Given** Typhoon is available and a Prompt Round has normalized intent
  **When** the Agent Loop receives a proposal
  **Then** the local harness validates the schema, action class, Work Mode, Permission Profile, Workspace/resource identity, consent where applicable, quota, credentials, and hard boundaries before any tool or process adapter receives it.
- **Given** a proposal is malformed, unknown, unsupported, out of scope, or policy-incomplete
  **When** validation runs
  **Then** it ends as `malformed`, `blocked`, or `refused` with sanitized deterministic Evidence, performs no repair, reinterpretation, substitution, or retry, and leaves no authorization or staged effect that could later dispatch.
- **Given** a validated local tool operation returns
  **When** the result is mediated back to the loop
  **Then** it is source-labelled, instruction-inert, sanitized, bounded, and durably recorded in activity/Evidence before it is offered as context for another proposal; remote output cannot change policy, permissions, boundaries, registry authority, or task scope.
- **Given** Typhoon proposes a subsequent bounded step after a tool result
  **When** the next proposal is received
  **Then** it undergoes a new local schema and policy validation with its own operation identity, and a prior tool result or approval is not treated as authority for a changed action.
- **Given** the loop has no valid next proposal or receives an invalid terminal response
  **When** lifecycle handling runs
  **Then** it stops with a durable typed result and does not invent a final answer, silently repair the proposal, or dispatch an unvalidated effect.

**Requirements:** FR-6; FR-7; FR-8; FR-9; FR-10; FR-21; FR-22; FR-24; FR-38; FR-39; NFR-2; NFR-3; NFR-6; NFR-7; NFR-13; AD-2; AD-3; AD-4; AD-14; AD-15; AD-24; AD-27; UX-DR-073–075, UX-DR-091–093, UX-DR-097.

### Story 3.10: Aggregate Agent Loop terminals and revalidate authority

As a developer  
I want loop cancellation, authority changes, and uncertain effects aggregated into truthful terminal outcomes  
So that no stale permission or unknown native result is presented as completion.

**Acceptance Criteria**

- **Given** the loop reaches a final response, verified result, accepted disclosed limitation, refusal, hard boundary, blocker, cancellation, or terminal failure
  **When** Prompt Round completion is decided
  **Then** the strongest unresolved state is selected, all included and excluded effects are named, and completion is published only after durable post-commit Evidence.
- **Given** a loop operation is cancelled, the Runtime Activation changes, Full Access is revoked, or a Boundary Expansion is revoked
  **When** the next effect would start
  **Then** the PEP revalidates authority revision, exact action identity, Workspace, checkpoint authorization, quota, platform state, and cancellation immediately; pending/prepared work is denied without consuming one-shot authority.
- **Given** an effect has reached `dispatch-committed`
  **When** cancellation or revocation is requested
  **Then** the result is `still-running`, `succeeded`, `failed`, or `unknown-outcome` according to durable evidence, never an unsupported cancellation claim, and no equivalent retry is started automatically.
- **Given** a native command or mutation may have started but its result, cleanup, or post-image is not proven
  **When** terminal aggregation runs
  **Then** it preserves `unknown-outcome`, records residual risk and dispatch classification, blocks blind/equivalent retry, and exposes only inspection, supported reconciliation, or exit.
- **Given** all loop operations reach terminal states
  **When** the Prompt Round summary is published
  **Then** operation status remains distinct from aggregate Prompt Round status, deterministic Evidence is separate from model explanation, and the summary identifies applied, excluded, blocked, cancelled, and unresolved scope without affirmative success language for partial or unknown work.

**Requirements:** FR-6; FR-10; FR-12; FR-21; FR-22; FR-24; FR-33; FR-34; FR-38; FR-39; NFR-3; NFR-5; NFR-6; NFR-7; NFR-13; AD-3; AD-4; AD-13; AD-19; AD-20; AD-22; AD-27; UX-DR-073–077, UX-DR-094–100, UX-DR-115–117.

### Story 3.11: Prove the canonical cross-platform C++ task

As a developer  
I want thcode to complete the bounded C++ `Hello, World!` proof  
So that I can verify the full local Agent Loop on both supported platforms without overstating success.

**Acceptance Criteria**

- **Given** a supported Workspace, Build mode, a passing current dependency preflight, and Typhoon available
  **When** I request the canonical proof
  **Then** the loop inspects the Workspace, plans a bounded C++ source creation, displays exact target/change/checkpoint coverage and authority, and requires the applicable exact approval before creating the source file.
- **Given** source creation is authorized and protected according to the complete mutation-set plan
  **When** the file is created
  **Then** the exact checkpoint/mutation order is followed: resolve stable identity → capture expected digest/version → PEP/PermissionMatrix/quota/platform checks → stage checkpoint originals/metadata/post-plan → make stage durable → atomically consume authorization + append `EffectDispatchCommitted` → native mutation → durable result/post-image → publish checkpoint reference and terminal event post-commit; no completion appears earlier.
- **Given** source creation succeeded
  **When** compilation and execution are proposed
  **Then** each exact executable/argv/cwd/environment is validated and disclosed, each command follows controlled process-tree execution and cancellation rules, and output is streamed as sanitized Evidence.
- **Given** compilation exits `0`, execution exits `0`, and stdout contains exactly `Hello, World!` after permitted line-ending normalization
  **When** verification completes
  **Then** the task is `succeeded`, the summary identifies the source file, compiler/commands, observed exit codes, exact expected output, Typhoon/PromptRound/Operation identities, checkpoint coverage, and excluded effects, and only post-commit Evidence can publish completion.
- **Given** the compiler is missing or cannot be safely invoked
  **When** the proof is attempted
  **Then** the result is a prerequisite blocker with platform guidance, not a source failure and not success; no command is invented, no dependency is installed, and no later mutation is implied.
- **Given** compilation, execution, verification, cancellation, conflict, or process cleanup fails
  **When** the proof ends
  **Then** it reports `failed`, `cancelled`, `conflict`, `unknown-outcome`, or `accepted-limitation` as applicable, never leads with affirmative completion, and states which built-in file changes are protected and which command/process effects are excluded.

**Requirements:** FR-6; FR-7; FR-8; FR-10; FR-11; FR-12; FR-21; FR-22; FR-23; FR-24; FR-33; FR-38; FR-39; NFR-3; NFR-5; NFR-6; NFR-7; NFR-11; AD-4; AD-12; AD-13; AD-19; AD-20; UX-DR-039, UX-DR-073–077, UX-DR-095–100, UX-DR-111, UX-DR-119.

### Story 3.12: Discover and preview eligible rollback checkpoints

As a developer  
I want to inspect recent Prompt Round checkpoints before choosing rollback targets  
So that I understand retention, coverage, identity, and excluded effects before anything changes.

**Acceptance Criteria**

- **Given** committed checkpoint lineage exists for the current Session
  **When** `/rollback list` or `/rollback inspect <id>` runs
  **Then** it shows PromptRoundId, checkpoint identity, created/observed time, subsequent-prompt age, target count, pre/post digests, rename information, retention expiry, per-checkpoint and store usage, encryption/integrity state, and `fully protected`, `partially protected`, `unprotected`, `expired`, `corrupt`, or `locked` coverage.
- **Given** a checkpoint contains excluded shell, remote, permission, process, symlink-side, external, or unknown effects
  **When** its preview is rendered
  **Then** those effects are explicitly `excluded`/`never-protected`, and the UI/headless summary never implies that the whole Prompt Round is reversible.
- **Given** a checkpoint is incomplete, corrupt, expired, locked, or references unavailable bytes
  **When** it is discovered
  **Then** it is hidden from apply-eligible targets, remains inspectable as a non-authoritative/recovery record, and offers only safe Evidence/recovery/exit actions.
- **Given** a developer selects a checkpoint for possible rollback
  **When** the selection is staged
  **Then** no target changes, approval, or native effect occurs; the preview remains read-only until a later exact per-target analysis and apply decision.
- **Given** the terminal is narrow, redirected, or headless
  **When** the preview is emitted
  **Then** it preserves the canonical order heading, purpose, risk, target, authority, Evidence completeness, outcome, and next step, including exact rollback tokens and no color-only meaning.

**Requirements:** FR-33; FR-34; FR-35; FR-37; FR-38; NFR-2; NFR-6; NFR-10; AD-6; AD-19; AD-20; AD-24; UX-DR-039, UX-DR-091–097, UX-DR-111, UX-DR-114–115.

### Story 3.13: Analyze rollback conflicts with three-way identity and content comparison

As a developer  
I want thcode to analyze each rollback target against its pre-image, post-image, and current state  
So that later user work is never overwritten blindly.

**Acceptance Criteria**

- **Given** an eligible checkpoint target is selected
  **When** rollback analysis runs
  **Then** it resolves stable current identity and captures current digest/version before any effect, then compares recorded pre-image, recorded agent post-image/patch, and current content or deletion state as a three-way analysis.
- **Given** current state still matches the recorded agent post-image and identity is unchanged
  **When** analysis completes
  **Then** the target is `applied`-eligible with a concrete inverse operation, expected current digest/version, rename handling, and no unrelated target included.
- **Given** current state differs, a later edit overlaps the patch, a target was renamed, deleted, recreated, changed by case/Unicode normalization, is behind a symlink/junction/mount, or concurrency/open-handle state is uncertain
  **When** analysis completes
  **Then** the target is `conflict`, `skipped`, `inaccessible`, `mismatch`, or `unknown-outcome` as appropriate; no overwrite or best-effort reversal is prepared.
- **Given** a target is a binary original retained in the encrypted ArtifactStore
  **When** analysis reads it
  **Then** it verifies integrity and compares digests without exposing raw bytes in UI/logs/Evidence; missing or corrupt originals are not apply-eligible.
- **Given** a conflict is shown
  **When** the rollback panel renders safe choices
  **Then** it offers only skip target, export a sanitized patch/Evidence, rebase/apply to a new path where identity policy permits, or explicit user-authored resolution; generic overwrite, continue, and blind retry are unavailable.

**Requirements:** FR-33; FR-34; FR-35; FR-37; FR-38; NFR-3; NFR-6; NFR-7; AD-12; AD-13; AD-19; AD-20; AD-24; UX-DR-111–114.

### Story 3.14: Apply conflict-free rollback targets

As a developer  
I want to apply only analyzed, conflict-free inverse changes  
So that rollback changes exactly the eligible built-in file state and leaves unrelated work untouched.

**Acceptance Criteria**

- **Given** a rollback target is `applied`-eligible and the user selects it explicitly
  **When** rollback authorization is evaluated
  **Then** the exact inverse target, expected current digest/version, checkpoint identity, action digest, Runtime Activation revision, and selected targets are reviewed; Plan denies application, Manual requires exact approval, and Full Access cannot bypass conflict, identity, retention, or checkpoint rules.
- **Given** the inverse operation is authorized
  **When** the native rollback effect starts
  **Then** it performs the exact order: resolve stable identity → capture expected digest/version → PEP/PermissionMatrix/quota/platform checks → stage checkpoint originals/metadata/post-plan → make stage durable → atomically consume authorization + append `EffectDispatchCommitted` → native inverse mutation → durable result/post-image → publish checkpoint reference and terminal event post-commit; no UI completion is emitted earlier.
- **Given** the target changes between analysis and effect start, or apply encounters a concurrent writer, rename, symlink/junction/mount change, open handle, or platform identity mismatch
  **When** effect-time revalidation runs
  **Then** it stops that target without overwrite, records `conflict` or `unknown-outcome`, and leaves unrelated targets untouched.
- **Given** all selected targets apply and their resulting digests match the recorded pre-images
  **When** post-commit Evidence is durable
  **Then** the aggregate is `full`, each target is `applied`, the resulting digest and actor/action are recorded, and completion is published only from the post-commit event.
- **Given** some targets apply and others conflict, are skipped, excluded, expired, corrupt, or unprotected
  **When** rollback completes
  **Then** the aggregate is `partial` or `blocked`, per-target outcomes and residual conflicts are shown, and excluded shell/remote/permission/process/symlink-side/external effects remain explicitly unreversed.

**Requirements:** FR-33; FR-34; FR-35; FR-37; FR-38; FR-39; NFR-3; NFR-6; NFR-7; AD-12; AD-13; AD-19; AD-20; UX-DR-073–077, UX-DR-095–097, UX-DR-111–115.

### Story 3.15: Recover interrupted checkpoint and mutation operations

As a developer  
I want `/recover` to distinguish incomplete preparation, committed effects, and unknown local outcomes  
So that a crash or cancellation never causes duplicate mutation or a false rollback claim.

**Acceptance Criteria**

- **Given** the process stops during identity capture, authorization, checkpoint staging, durable-stage commit, dispatch commit, native mutation, post-image capture, or terminal publication
  **When** startup or `/recover inspect` runs
  **Then** the journal classifies the operation as not sent, prepared, dispatch-committed, succeeded, failed, cancelled, or `unknown-outcome`, detects unreachable/incomplete checkpoint material, and never replays a native effect automatically.
- **Given** no `EffectDispatchCommitted` event exists
  **When** recovery evaluates the operation
  **Then** it may safely mark the operation cancelled/blocked or discard unconsumed authorization according to the journal, without consuming authority or invoking a native adapter.
- **Given** `EffectDispatchCommitted` exists but native result/post-image is missing
  **When** recovery evaluates the operation
  **Then** it preserves `unknown-outcome` until a platform-supported local inspection/reconciliation proves the result, records the residual risk, and prohibits blind re-execution or equivalent retry.
- **Given** a native mutation is known to have committed but checkpoint reference publication failed
  **When** recovery runs
  **Then** it attempts only repository/journal reconciliation and safe reference repair, never fabricates complete protection, and labels the affected rollback scope `partially protected`, `unprotected`, or `corrupt` when evidence is insufficient.
- **Given** cancellation is requested before or after dispatch commit
  **When** the request is processed
  **Then** the UI shows request and acknowledgement, distinguishes `cancelled`, `still-running`, `failed`, `succeeded`, and `unknown-outcome`, and never claims that an already committed native effect was cancelled.
- **Given** recovery is narrow, redirected, or headless
  **When** it renders
  **Then** `/recover` is the single entry point with inspect, reconcile where supported, export-safe Evidence, retry-disabled explanation, and exit; unresolved state remains visible with stable exit class/code.

**Requirements:** FR-6; FR-33; FR-34; FR-35; FR-37; FR-38; FR-39; NFR-5; NFR-6; NFR-7; AD-3; AD-13; AD-19; AD-20; UX-DR-095–100, UX-DR-115–117.

### Story 3.16: Enforce rollback retention, caps, and cleanup

As a developer  
I want rollback data retained only within explicit time and capacity bounds  
So that protection is predictable, encrypted, and does not silently consume unlimited local storage.

**Acceptance Criteria**

- **Given** a checkpoint is committed
  **When** retention is calculated
  **Then** it remains eligible for five subsequent Prompt Rounds by default, supports a validated user-configured window, records expiry deterministically, and does not count unrelated Session or artifact retention as rollback protection.
- **Given** a proposed checkpoint exceeds 100 MB or the store would exceed 500 MB
  **When** mutation preflight evaluates capacity
  **Then** it reports `over-cap`, identifies the exact checkpoint/store usage and unprotected scope, does not silently evict active protection, and requires explicit confirmation to proceed without rollback protection; Full Access cannot suppress this disclosure or alter the cap implicitly.
- **Given** the action is explicitly confirmed unprotected
  **When** the mutation proceeds
  **Then** the user-visible operation records `unprotected`/`never-protected`, states that only built-in changes within retained checkpoint coverage may later be reversible, and follows the normal exact mutation order with no fabricated checkpoint reference.
- **Given** a checkpoint expires, is deleted, or a Session cleanup removes its last reference
  **When** cleanup runs
  **Then** encrypted originals, metadata, staging files, and unreachable references are removed through a journaled crash-consistent lifecycle, shared immutable bytes remain only for other valid references, and expired content is hidden from rollback discovery.
- **Given** cleanup is interrupted, the store/key is locked, a reference count is inconsistent, or deletion fails
  **When** recovery runs
  **Then** cleanup resumes or remains `recovery-locked`/`corrupt` without exposing bytes as eligible, never overwrites live data, and reports secure-deletion limitations and a safe inspect/exit action.
- **Given** retention or capacity status is displayed
  **When** the rollback panel, activity log, completion summary, or headless output renders it
  **Then** it shows encryption/integrity status, age/window, cap usage, exclusions, and exact next steps in narrow/noninteractive forms, with no claim that shell, remote, permission, process, symlink-side, or external effects are reversible.

**Requirements:** FR-33; FR-34; FR-35; FR-37; FR-38; FR-39; NFR-1; NFR-6; NFR-7; NFR-10; AD-19; AD-20; AD-21; AD-26; UX-DR-039, UX-DR-085–093, UX-DR-111–115, UX-DR-120.

## Epic 4: Use Thai Specialist Services with Informed Consent

A developer can discover the reviewed AI-for-Thai catalog, connect just in time, route natural prompts to one of exactly four working services, resolve and minimize local artifacts, consent to exact transfers, receive attributable results, reuse valid cache Evidence, and recover from scoped failures. The official AI-for-Thai endpoint is called directly from the local CLI; no hosted proxy, client/server path, or compatibility layer is used. One local AI-for-Thai key group serves the four launch services and never reaches Typhoon.

**Implementation prerequisite:** Epic 4 implements against the approved sensitive-data and Remote Data Authority policy (PRD §12.1 PR-2, Architecture AD-26.1). Specialist transfers use an approved, versioned policy matrix; provider retention/deletion handling must be verified and permitted for the exact configuration and data class before any payload is prepared for transport. No-retention is preferred but not universally required; provider-side deletion lifecycle states apply only when the provider contract supports them. Story 7.2 certifies the already-approved policy and does not define it for the first time.

**Internal record-order correction:** The immutable Specialist Result/Evidence envelope and ownership foundation (Story 4.14 in the prior plan) is established **before** the four service integrations (Stories 4.10–4.13 in the prior plan). Service integrations consume the already-owned envelope rather than defining it. See the reordered story sequence below.

**FRs covered:** FR-3, FR-4, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20.

### Story 4.1: Define and publish the versioned Capability Registry contract

As a developer
I want a reviewed, versioned Capability Registry and offline manifest
So that discovery, routing, health, and invocation all use the same authoritative service contract.

**Acceptance Criteria**

- **Given** the registry schema is being defined
  **When** it is published
  **Then** each entry has a stable thcode and upstream identity, Thai and canonical-English names/search terms, capabilities, supported inputs and limits, entitlement, evidence level, observation date, endpoint/transport rules, privacy and retention classification, confirmation policy, manifest version, contract version, adapter version, latest contract-test result, and an explicit invokable status.
- **Given** the Release 1 manifest is reviewed
  **When** it is bundled offline
  **Then** exactly T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition have `invokable: true`; every other known entry is non-invokable and carries the exact state `Catalogued — Not available yet`.
- **Given** a manifest is malformed, stale beyond its declared freshness policy, revoked, or missing a required contract field
  **When** the registry loads it
  **Then** the registry fails closed for invocation and emits sanitized Evidence identifying the manifest version and cause without accepting model-, installer-, URL-, or user-supplied registry changes.
- **Given** registry or contract versions are needed by a configuration or request
  **When** those versions are referenced
  **Then** they resolve to this published schema and reviewed manifest rather than an ad hoc service definition.
- **Given** Thai, mixed-language, narrow-terminal, redirected, or headless output is requested
  **When** registry identity or state is rendered
  **Then** canonical tokens and exact service identifiers remain unchanged and explanatory Thai may accompany them.

**Requirements:** FR-13, FR-14, FR-18; NFR-2, NFR-7, NFR-9, NFR-10, NFR-15; AD-15, AD-24; Additional Requirements 8, 30, 58–60; UX-DR-021–024, UX-DR-037–040, UX-DR-091–100, UX-DR-120.

### Story 4.2: Browse, search, inspect, and honestly disable catalog entries

As a developer
I want `/tools` to browse and inspect the reviewed catalog
So that I can understand what exists without mistaking catalog presence for availability.

**Acceptance Criteria**

- **Given** the reviewed registry is loaded
  **When** I run `/tools`
  **Then** the catalog supports browse, Thai/English search, inspect, enablement where permitted, disablement, diagnosis, and retest controls through the canonical CoreApp projection.
- **Given** a four-service entry is reviewed and invokable
  **When** it is shown
  **Then** its identity, capabilities, supported input types, limits, entitlement, evidence level, manifest/contract versions, observation date, current health, and invocation eligibility are visible.
- **Given** any non-launch or not-yet-available entry is shown
  **When** I inspect it
  **Then** the UI shows exactly `Catalogued — Not available yet`, offers inspection only, and cannot produce an invocation proposal, adapter call, prepared payload, or consent prompt.
- **Given** a service is disabled, unavailable, unhealthy, or quarantined
  **When** the catalog renders it
  **Then** it uses the corresponding canonical state and names the next allowed action; no state is silently mapped to `working` or `available`.
- **Given** output is redirected, headless, Thai, mixed-language, or narrower than the interactive layout
  **When** the catalog is rendered
  **Then** every row retains a stable identifier, canonical state token, safe reason, and machine-readable action availability without relying on color.

**Requirements:** FR-13, FR-14, FR-18, FR-19; NFR-2, NFR-7, NFR-9, NFR-10; AD-15, AD-24; UX-DR-021–024, UX-DR-031–040, UX-DR-054–059, UX-DR-091–100, UX-DR-120.

### Story 4.3: Onboard the shared AI-for-Thai credential just in time

As a developer
I want a protected just-in-time AI-for-Thai connection flow
So that Specialist Services can be enabled without preconfiguring or exposing credentials.

**Acceptance Criteria**

- **Given** a prompt requires an invokable Specialist Service and no AI-for-Thai credential is configured
  **When** routing reaches the connection boundary
  **Then** thcode pauses before any Specialist request, explains the reviewed endpoint, separate credential purpose, local OS credential storage, and four-service scope, and opens the masked credential form only in an interactive mode.
- **Given** a key is entered
  **When** thcode stores and verifies it
  **Then** it uses one distinct opaque `CredentialGroupId` shared by the four launch services, stores only its reference, revision, and secret-free fingerprint in product persistence, and never sends it to Typhoon, SCBx, a hosted component, logs, prompts, sessions, previews, or output.
- **Given** credential storage, authentication, connectivity, quota, or origin verification fails
  **When** onboarding ends
  **Then** the user receives a typed sanitized cause and `unavailable` or `unhealthy` state with Inspect, Replace, Remove, or Exit actions; no Specialist invocation occurs.
- **Given** a user removes or rotates the key
  **When** the operation commits
  **Then** the old credential reference is invalidated, dependent configuration generations become stale or unavailable, and no cached credential value remains in product buffers or persistence.
- **Given** onboarding is cancelled, noninteractive, or its outcome is unknown
  **When** the flow ends
  **Then** the state is reported as cancelled or `unknown-outcome` as applicable, no provider use is claimed, and no automatic retry occurs.

**Requirements:** FR-3, FR-4, FR-18, FR-19; NFR-1, NFR-2, NFR-6, NFR-7; AD-11, AD-18, AD-21, AD-24; Additional Requirements 31, 57, 62; UX-DR-008, UX-DR-023–025, UX-DR-090–100, UX-DR-120.

### Story 4.4: Generate effective configuration and enforce the health lifecycle

As a developer
I want health tied to an immutable effective configuration
So that availability means the exact endpoint, credential group, mapping, and contract were checked.

**Acceptance Criteria**

- **Given** the reviewed registry and manifest exist
  **When** EffectiveConfigurationGeneration is created
  **Then** its fingerprint binds endpoint/origin, service mapping, credential reference and revision, registry manifest version, contract version, adapter version, transport policy, and relevant request configuration; it is immutable.
- **Given** a service has no stored credential, a stored credential, or an in-flight check
  **When** its lifecycle is projected
  **Then** states transition deterministically through `unconfigured`, `configured`, and `checking`, with `configured` never implying `available`.
- **Given** a live check passes for the current generation
  **When** the result commits
  **Then** the service becomes `available` with timestamp and Evidence; stale, mismatched, or superseded results cannot establish availability.
- **Given** a check fails
  **When** the cause is authentication, quota, transient network, unsupported input, failed health, or protocol/configuration incompatibility
  **Then** the service becomes the corresponding `unavailable` or `unhealthy` state with sanitized cause, retryability, scope, and next action.
- **Given** health is shown in TUI, linearized, redirected, or headless output
  **When** the projection renders
  **Then** `configured`, `checking`, `available`, `unavailable`, `unhealthy`, and `quarantined` remain exact canonical tokens with Thai-capable explanations and no color-only meaning.

**Requirements:** FR-3, FR-4, FR-18, FR-19, FR-20; NFR-2, NFR-6, NFR-7, NFR-10, NFR-15; AD-8–AD-9, AD-18, AD-24; Additional Requirements 10, 61–63; UX-DR-021–024, UX-DR-031–040, UX-DR-091–100, UX-DR-120.

### Story 4.5: Route natural prompts with only task-relevant schemas

As a developer
I want a natural Thai or mixed-language prompt to select the right Specialist Service
So that I do not need to understand the catalog before asking for an outcome.

**Acceptance Criteria**

- **Given** a prompt identifies a task supported by one reviewed invokable service
  **When** intent normalization completes
  **Then** thcode proposes that service with the selected service identity and a plain-language rationale before any remote call.
- **Given** the prompt names an artifact or modality
  **When** routing selects a service
  **Then** thcode creates and persists a versioned SchemaSelectionManifest containing the selected service, task-relevant schema identifiers and versions, request-schema projection, artifact references, exclusions, rationale, and a deterministic digest; the immediate provider request contains only the schemas listed in that manifest, while unrelated schemas and catalog entries are excluded.
- **Given** the prompt is ambiguous, unsupported, or maps to more than one materially different service
  **When** routing evaluates it
  **Then** thcode asks a bounded clarification or reports `refused`/`blocked` with the reason and never silently substitutes a service.
- **Given** a model proposes a service, URL, tool, schema, or endpoint not authorized by the Registry
  **When** the local harness validates the proposal
  **Then** it rejects the proposal as malformed or blocked without repair, reinterpretation, or invocation.
- **Given** the prompt route is rendered in Thai, mixed-language, narrow, redirected, or headless mode
  **When** the proposal is shown
  **Then** technical identifiers and canonical status tokens remain exact and the user can inspect or cancel before preparation.

**Requirements:** FR-5, FR-13, FR-14, FR-18; NFR-2, NFR-7, NFR-9, NFR-10, NFR-13; AD-14–AD-15, AD-24; UX-DR-025, UX-DR-037–040, UX-DR-041–050, UX-DR-091–100, UX-DR-120.

### Story 4.6: Resolve explicit artifacts and preserve source identity

As a developer
I want explicit `@path` references resolved locally
So that a Specialist request is bound to the intended Workspace artifact rather than an ambiguous path or remote fetch.

**Acceptance Criteria**

- **Given** a prompt contains an explicit `@path`
  **When** ArtifactResolver resolves it
  **Then** it canonicalizes the path within the declared Workspace, records artifact identity, type, format, size, metadata, and source-content hash, and rejects out-of-workspace, symlink/junction escape, inaccessible, or changed resources.
- **Given** a prompt does not contain an explicit artifact identity
  **When** a Specialist would require local material
  **Then** thcode asks the user to select or name the artifact and does not infer a path from a remote instruction or unresolved filename.
- **Given** the source changes after resolution
  **When** preparation or dispatch revalidates it
  **Then** the operation becomes `stale` or `mismatch`, no old authorization or consent is reused, and the user must review the new identity.
- **Given** the artifact is an eligible bounded directory
  **When** it is resolved
  **Then** the resolver records an ordered descendant manifest and refuses traversal beyond declared bounds, unsupported links, active content, or parser limits.
- **Given** the artifact identity is shown in Evidence, consent, activity, and headless output
  **When** it is rendered
  **Then** it uses the canonical path identity and digest without exposing unrelated local paths or secrets.

**Requirements:** FR-15, FR-16, FR-17; NFR-2, NFR-3, NFR-4, NFR-7, NFR-8, NFR-9; AD-22, AD-24–AD-25; Additional Requirements 27, 33, 35–38; UX-DR-023–024, UX-DR-071–079, UX-DR-091–097, UX-DR-103, UX-DR-120.

### Story 4.7: Validate and minimize each supported artifact type

As a developer
I want type-specific local validation and minimization
So that only the smallest compatible material is prepared for a Specialist Service.

**Acceptance Criteria**

- **Given** a code, Markdown, or text artifact is selected
  **When** it is prepared
  **Then** MIME/signature, encoding, size, secret, and compatibility checks run locally; the payload contains only the requested bounded content and records omissions or redactions.
- **Given** an image or audio artifact is selected
  **When** it is prepared
  **Then** format, codec, dimensions or duration, size, metadata, and sensitivity checks run locally; unsupported or policy-blocked media is metadata-only or clearly refused.
- **Given** a PDF or DOCX is selected
  **When** it is prepared
  **Then** text extraction occurs locally by default with parser/resource limits, active-content and external-reference restrictions, extraction provenance, and an explicit decision if the original binary is necessary.
- **Given** a bounded directory manifest is selected
  **When** it is prepared
  **Then** only approved descendants and derived text/metadata are included; traversal, archive expansion, hidden content, and unbounded recursion are rejected or omitted with a named reason.
- **Given** classification, compatibility, retention, or deletion handling is unknown or unverifiable
  **When** local preparation would otherwise begin
  **Then** thcode blocks before payload preparation and transport and presents the exact blocking state and remedy.
- **Given** type-specific output is displayed in Thai, narrow, redirected, or headless mode
  **When** validation finishes
  **Then** the result includes canonical type, size/boundary summary, sanitized omissions, and no raw secret or hidden payload bytes.

**Requirements:** FR-15, FR-16, FR-17, FR-18; NFR-2, NFR-3, NFR-4, NFR-7, NFR-9, NFR-13; AD-24–AD-25; Additional Requirements 27, 33; UX-DR-023–024, UX-DR-071–079, UX-DR-091–093, UX-DR-103, UX-DR-120.

### Story 4.8: Prepare exact payload identity and independent transfer consent

As a developer
I want to consent to the exact prepared transfer
So that Full Access, local approval, or cache reuse can never imply permission to send content remotely.

**Acceptance Criteria**

- **Given** ArtifactResolver and Sanitizer finish local preparation
  **When** a remote call is proposed
  **Then** thcode creates a versioned PreparedPayloadManifest containing purpose, recipient service identity, verified final origin, method where relevant, ordered semantic inputs, source identities and hashes, transformations/redactions, retention/deletion classification, call count, scope, expiry, contract/capability versions, and exact payload-byte digest.
- **Given** a payload includes content
  **When** the consent surface opens
  **Then** it independently shows the recipient, verified HTTPS endpoint, purpose, method, safe payload summary, source identity, classification, retention/deletion status, side effects, manifest digest, payload digest, and ConsentReference; credentials and raw secrets never appear.
- **Given** local approval, Full Access, an existing Boundary Expansion, or a valid cached Evidence record exists
  **When** transfer consent is evaluated
  **Then** none of them substitutes for a fresh exact consent decision for this transfer.
- **Given** the manifest, endpoint, origin, TLS validation, payload bytes, or source digest changes after consent
  **When** dispatch is attempted
  **Then** thcode marks the consent `mismatch`/`stale`, blocks sending, and requires a new exact consent; no automatic repair or retry occurs.
- **Given** retention or deletion behavior is unknown, unverifiable, or unacceptable for the selected material
  **When** consent would otherwise be requested
  **Then** the operation is blocked before payload preparation/transport according to the final UX state and no outbound payload bytes are persisted.
- **Given** the user denies or cancels
  **When** the consent operation terminates
  **Then** the state is `denied` or `cancelled`, the payload is not sent, and only sanitized manifest metadata and the decision reference may remain.

**Requirements:** FR-15, FR-16, FR-17; NFR-2, NFR-4, NFR-7, NFR-13, NFR-15; AD-19, AD-24–AD-25; Additional Requirements 26–30; UX-DR-029, UX-DR-071–079, UX-DR-091–097, UX-DR-120.

### Story 4.9: Establish shared Specialist adapter, result, and failure contracts

As a developer
I want one adapter and result contract for all launch services
So that service-specific integrations preserve the same attribution, consent, health, and failure semantics.

**Acceptance Criteria**

- **Given** an invokable Registry entry is selected
  **When** its adapter is called
  **Then** the adapter accepts the exact service identity, contract/manifest versions, EffectiveConfigurationGeneration, PreparedPayloadManifest, ConsentReference, OperationId, and bounded request options and calls the official endpoint directly from the local CLI.
- **Given** a service returns a result
  **When** the adapter normalizes it
  **Then** it preserves returned fields, explicitly represented empty fields, confidence/uncertainty, source-content hash, service identity, configuration generation, consent reference, timing, provenance, and sanitized raw-response references without inventing fields.
- **Given** a service returns an error, malformed response, timeout, quota signal, or unknown outcome
  **When** the adapter maps it
  **Then** it emits the common sanitized failure envelope with deterministic category, retryability, smallest proven scope, effective generation, OperationId, safe message, cause code, Evidence reference, and optional retry-after.
- **Given** an adapter receives an invalid proposal, mismatched consent, stale generation, unsupported input, or non-invokable Registry entry
  **When** local validation runs
  **Then** it refuses before transport and does not repair protocol, substitute a service, or retry an unknown outcome.
- **Given** any adapter result or failure is projected
  **When** interactive, linearized, redirected, or headless output renders
  **Then** Specialist output, Typhoon explanation, Evidence, and failure provenance have separate headings and stable canonical tokens.

**Requirements:** FR-4, FR-16, FR-17, FR-18, FR-19; NFR-2, NFR-4, NFR-6–NFR-10, NFR-15; AD-9–AD-10, AD-14, AD-24; Additional Requirements 8, 16, 42, 63–65; UX-DR-037–040, UX-DR-054–060, UX-DR-091–100, UX-DR-120.

### Story 4.10: Integrate T-OCR as a working Specialist Service

As a developer
I want T-OCR to process an approved image or PDF-derived visual input
So that I can obtain attributable Thai OCR output through the common Specialist flow.

**Acceptance Criteria**

- **Given** the reviewed T-OCR fixture contains a deterministic Thai image and expected text
  **When** the prompt asks to read `@receipt.png`
  **Then** routing selects T-OCR, ArtifactResolver validates and minimizes the image, and the service proposal shows the T-OCR identity and rationale.
- **Given** the prepared image transfer has exact consent and the current EffectiveConfigurationGeneration is available
  **When** the request is dispatched
  **Then** the direct AI-for-Thai T-OCR adapter returns the expected recognized text and preserves source hash, service/configuration identity, consent reference, confidence/uncertainty, timing, and empty-field semantics in immutable Evidence.
- **Given** the fixture is unsupported, consent is denied, or the service is unavailable
  **When** the prompt flow ends
  **Then** no silent fallback to Typhoon occurs and the typed blocked/refused/unavailable outcome names the next action.
- **Given** the flow is run in Thai, narrow, redirected, or headless mode
  **When** the result is shown
  **Then** canonical T-OCR identity, state tokens, recognized fields, uncertainty, and Evidence reference remain available without color-only status.

**Requirements:** FR-13–FR-18; NFR-2, NFR-4, NFR-7–NFR-10; AD-9–AD-10, AD-14–AD-15, AD-24; Additional Requirements 59, 64–67; UX-DR-025, UX-DR-037–040, UX-DR-054–060, UX-DR-091–100, UX-DR-120.

### Story 4.11: Integrate Speech-to-Text as a working Specialist Service

As a developer
I want Speech-to-Text to transcribe an approved audio artifact
So that I can receive attributable Thai transcription without sending the wrong media or losing uncertainty.

**Acceptance Criteria**

- **Given** the deterministic audio fixture contains Thai speech and a bounded expected transcript
  **When** the prompt asks to transcribe `@meeting.wav`
  **Then** routing selects Speech-to-Text and local validation records codec, duration, size, sensitivity, and minimized transfer identity before consent.
- **Given** exact consent and current service health exist
  **When** the direct adapter dispatches the fixture
  **Then** the returned transcript, segment or timing fields if provided, uncertainty, empty fields, source hash, service/configuration identity, consent reference, and timing are sealed as immutable Evidence.
- **Given** audio format, duration, size, or sensitivity is unsupported or classification/retention is unverifiable
  **When** preparation or consent is evaluated
  **Then** the operation blocks before transport and does not send the original or a silent substitute.
- **Given** the service returns quota, transient network, or unknown outcome
  **When** the failure is classified
  **Then** the result is typed and no automatic retry or alternate service invocation occurs; a single transient failure does not quarantine the service.
- **Given** the prompt-driven flow is rendered in Thai, narrow, redirected, or headless mode
  **When** the transcript is presented
  **Then** Specialist output, Typhoon explanation, confidence/uncertainty, and Evidence remain visibly distinct.

**Requirements:** FR-13–FR-18; NFR-2, NFR-4, NFR-7–NFR-10; AD-9–AD-10, AD-14–AD-15, AD-24; Additional Requirements 59, 64–67; UX-DR-025, UX-DR-037–040, UX-DR-054–060, UX-DR-091–100, UX-DR-120.

### Story 4.12: Integrate Extract Address as a working Specialist Service

As a developer
I want Extract Address to extract structured address fields from an approved Thai document
So that empty or uncertain fields remain honest and attributable.

**Acceptance Criteria**

- **Given** the deterministic Thai address fixture is a Markdown, text, PDF, or DOCX artifact
  **When** the prompt asks to extract the address from `@invoice.pdf`
  **Then** routing selects Extract Address and local extraction/minimization records the derived text provenance and any need for the original.
- **Given** the selected fields and exact transfer are consented
  **When** the direct adapter dispatches
  **Then** it returns only the service-defined address schema, preserves empty fields as empty, records uncertainty/confidence and source spans or provenance where supplied, and never fabricates missing address components.
- **Given** a PDF/DOCX parser cannot safely extract text or the original binary is required
  **When** preparation evaluates the input
  **Then** it reports the exact compatibility or policy cause and asks for a separately reviewed original transfer rather than silently sending it.
- **Given** the service returns protocol incompatibility or deterministic configuration/authentication failure
  **When** the common failure contract classifies it
  **Then** the service enters the smallest proven unhealthy scope and the result explains correction and explicit retest.
- **Given** the result is shown through any output mode
  **When** the user inspects it
  **Then** service fields, empty fields, uncertainty, Typhoon explanation, source identity, and Evidence reference are separate and canonical tokens remain unchanged in Thai or mixed output.

**Requirements:** FR-13–FR-19; NFR-2, NFR-4, NFR-7–NFR-10; AD-9–AD-10, AD-14–AD-15, AD-24; Additional Requirements 59, 64–67; UX-DR-025, UX-DR-037–040, UX-DR-054–060, UX-DR-091–100, UX-DR-120.

### Story 4.13: Integrate Named Entity Recognition as a working Specialist Service

As a developer
I want Named Entity Recognition to identify entities in an approved bounded text input
So that entity labels and uncertainty are attributable to the exact source.

**Acceptance Criteria**

- **Given** the deterministic Thai/mixed-language text fixture contains known names, organizations, and locations
  **When** the prompt asks to identify entities in `@notes.md`
  **Then** routing selects Named Entity Recognition, includes only its task schema, and binds the request to the source-content hash.
- **Given** exact consent and current health exist
  **When** the direct adapter dispatches
  **Then** returned entities, labels, offsets or provenance if supplied, confidence/uncertainty, empty results, service/configuration identity, consent reference, and timing are sealed as immutable Evidence.
- **Given** the prompt requests a sensitive identity or unsupported capability outside the reviewed manifest
  **When** routing or preparation evaluates it
  **Then** thcode refuses or blocks without invoking another service, inventing labels, or exposing unavailable capabilities.
- **Given** a malformed response or protocol mismatch occurs
  **When** the adapter classifies it
  **Then** it emits deterministic failure Evidence and prevents the affected service from being selected until the defined retest path succeeds.
- **Given** the user views the flow in Thai, mixed-language, narrow, redirected, or headless mode
  **When** the result is presented
  **Then** entity output is clearly separated from Typhoon explanation and the exact source, service, and Evidence identities remain inspectable.

**Requirements:** FR-13–FR-19; NFR-2, NFR-4, NFR-7–NFR-10; AD-9–AD-10, AD-14–AD-15, AD-24; Additional Requirements 59, 64–67; UX-DR-025, UX-DR-037–040, UX-DR-054–060, UX-DR-091–100, UX-DR-120.

### Story 4.14: Persist immutable Specialist Evidence and versioned CacheManifest identity

As a developer
I want every Specialist result and cache key to be immutable and attributable
So that reuse never detaches an answer from its exact source, contract, consent, or configuration.

**Acceptance Criteria**

- **Given** a Specialist call completes or fails
  **When** Evidence is sealed
  **Then** it includes source-content hash, service/capability identity, effective configuration generation, returned and empty fields, confidence/uncertainty, provenance, ConsentReference, timing, normalized failure if any, schema version, and completeness state.
- **Given** a cache candidate is created
  **When** CacheManifest is generated
  **Then** its versioned identity includes service/capability contract, verified origin, ordered semantic inputs and content hashes, request options, preprocessing, mapping/schema version, effective configuration generation, transformation/redaction policy, and source identity.
- **Given** Evidence is reused
  **When** it is displayed
  **Then** the original observation time, source/configuration provenance, cache identity, and reuse state are visible; reused Evidence is never presented as a fresh live result.
- **Given** source bytes, service contract, endpoint, mapping, generation, preprocessing, redaction, or request options differ
  **When** cache identity is compared
  **Then** the candidate is invalid and cannot be returned as a match.
- **Given** Evidence contains sensitive content
  **When** it is persisted or rendered
  **Then** only sanitized summaries, hashes, references, and policy-approved derived fields remain; raw payload bytes are not persisted as outbound transfer records.

**Requirements:** FR-4, FR-16, FR-17; NFR-1, NFR-2, NFR-6, NFR-8, NFR-15; AD-10, AD-16, AD-24; Additional Requirements 15, 46, 63–66; UX-DR-026, UX-DR-054–060, UX-DR-089–097, UX-DR-120.

### Story 4.15: Reuse, force-fresh, retain, and invalidate Specialist cache Evidence

As a developer
I want visible cache reuse and a force-fresh control
So that I can choose freshness without losing the prior Evidence or depending on a quarantined service for valid historical results.

**Acceptance Criteria**

- **Given** a valid CacheManifest match exists
  **When** a prompt requests the same service input
  **Then** cache lookup runs before live-health gating and returns the immutable Evidence even if the current service is `unavailable`, `unhealthy`, or `quarantined`; the result is visibly labeled reused with original observation time.
- **Given** the user selects force-fresh
  **When** the request is evaluated
  **Then** the prior Evidence is preserved, the cache is bypassed, and a current `available` health check for the exact generation is required before any transfer; no force-fresh result is returned while the service is unavailable.
- **Given** cache Evidence reaches its retention or TTL boundary
  **When** retention evaluation runs
  **Then** the record is marked expired and hidden from reuse with retention metadata and the defined deletion/invalidation state visible.
- **Given** a service contract, registry manifest, endpoint, credential revision, mapping, preprocessing policy, source hash, or quarantine scope changes
  **When** invalidation is triggered
  **Then** affected cache identities are invalidated without deleting unrelated service Evidence.
- **Given** Session deletion is not implemented in this epic
  **When** cache ownership needs deletion coordination
  **Then** the system exposes a typed invalidation/deletion port and stable reference behavior without claiming that deletion has occurred.
- **Given** cache lookup or invalidation fails
  **When** the result is projected
  **Then** thcode reports `stale`, `corrupt`, `expired`, or `unavailable` as applicable and never silently falls through to a live transfer or substitutes a service.

**Requirements:** FR-4, FR-17, FR-18, FR-19; NFR-1, NFR-2, NFR-6–NFR-8, NFR-15; AD-10, AD-16, AD-18, AD-24; Additional Requirements 55–56, 65–66; UX-DR-026, UX-DR-054–060, UX-DR-085–097, UX-DR-120.

### Story 4.16: Classify failures and quarantine the smallest proven scope

As a developer
I want deterministic failure classification and scoped quarantine
So that one service failure does not unnecessarily disable the other reviewed services.

**Acceptance Criteria**

- **Given** a remote or local Specialist failure occurs
  **When** the failure envelope is created
  **Then** it has exactly one deterministic category among entitlement, quota/rate limit, unsupported input, transient network, failed health, authentication, protocol incompatibility, configuration failure, or unknown outcome, plus retryability, cause code, scope, generation, OperationId, safe message, and Evidence reference.
- **Given** one transient network failure, quota/rate-limit response, or unsupported input occurs
  **When** the failure is recorded
  **Then** the service is not quarantined solely for that occurrence; the user receives a typed remedy and no automatic retry of unknown outcomes.
- **Given** deterministic service-specific authentication, protocol, or configuration evidence proves one service invalid
  **When** quarantine is applied
  **Then** only that service becomes `quarantined`/unavailable and remains unselectable while other services retain their own health states.
- **Given** deterministic rejection of the shared AI-for-Thai credential group is proven
  **When** propagation runs
  **Then** all four dependent services atomically become unavailable or quarantined for the shared scope, with one shared-key Evidence reference and no contradictory model explanation.
- **Given** failure evidence is stale, conflicting, or insufficient to prove scope
  **When** quarantine is considered
  **Then** thcode uses the smallest known safe scope, refuses invocation where necessary, and does not broaden quarantine by inference.
- **Given** any failure is shown in Thai, narrow, redirected, or headless mode
  **When** it is rendered
  **Then** the canonical category, scope, retryability, and next action remain explicit without revealing credential or raw payload data.

**Requirements:** FR-4, FR-18, FR-19; NFR-2, NFR-6, NFR-7, NFR-10, NFR-15; AD-8–AD-9, AD-18, AD-24; Additional Requirements 61–63; UX-DR-021–024, UX-DR-054–060, UX-DR-091–100, UX-DR-120.

### Story 4.17: Provide explicit retest and scoped recovery

As a developer
I want to correct a dependency and explicitly retest it
So that a stale pass or background retry cannot restore a Specialist Service silently.

**Acceptance Criteria**

- **Given** a service is `unavailable`, `unhealthy`, or `quarantined`
  **When** I choose Diagnose or Retest
  **Then** thcode shows the current failure scope, effective generation, correction needed, and a visible live retest action; background health checks cannot be presented as a user retest.
- **Given** I correct a credential, endpoint, contract, or service configuration
  **When** the retest begins
  **Then** thcode creates a new EffectiveConfigurationGeneration, reports `checking` progress, and invalidates older in-flight successes for availability purposes.
- **Given** the retest passes
  **When** the result commits
  **Then** the service becomes `available` only for the corrected generation and records timestamp, health Evidence, endpoint/origin identity, and shared-key propagation result if applicable.
- **Given** the retest fails, is cancelled, or ends with an unknown outcome
  **When** the operation ends
  **Then** the service remains unavailable/quarantined or enters the appropriate unknown state, no stale success is reused, and no automatic equivalent retry occurs.
- **Given** a service-specific retest succeeds after a service-specific failure
  **When** the result is projected
  **Then** only that service is restored; a shared-key retest restores dependents only when the shared credential group check passes for the current generation.
- **Given** the retest is displayed interactively, redirected, or headless
  **When** progress and result are emitted
  **Then** canonical state tokens, timestamp, generation, Evidence reference, and next action are available with Thai-capable explanations.

**Requirements:** FR-4, FR-18, FR-19, FR-20; NFR-2, NFR-6, NFR-7, NFR-10, NFR-15; AD-8–AD-9, AD-18, AD-24; Additional Requirements 61–63; UX-DR-021–024, UX-DR-054–060, UX-DR-091–100, UX-DR-120.

### Story 4.18: Verify the deterministic registry and shared-adapter contract matrix

As a developer
I want deterministic contract-matrix verification for the reviewed registry and shared adapter
So that every launch service obeys the same invocation, consent, result, and failure contracts.

**Acceptance Criteria**

- **Given** deterministic contract fixtures for the reviewed Capability Registry and all four launch services exist
  **When** the contract matrix runs
  **Then** each fixture validates manifest identity and version, invokable status, request schema, direct endpoint/origin rules, response normalization, source/configuration attribution, and exact consent binding.
- **Given** a registry entry is malformed, non-invokable, revoked, or version-incompatible
  **When** the contract matrix exercises it
  **Then** invocation is rejected with a deterministic sanitized result and no adapter transport occurs.
- **Given** a shared adapter receives valid and invalid result, failure, consent, generation, and OperationId combinations
  **When** the matrix runs
  **Then** it emits the common immutable result or failure contract without protocol repair, field fabrication, service substitution, or automatic retry of unknown outcomes.
- **Given** each contract fixture is run through direct local CLI adapters
  **When** the matrix completes
  **Then** no hosted proxy, client/server path, compatibility layer, Typhoon credential, or outbound payload-byte persistence is used.

**Requirements:** FR-3, FR-4, FR-13, FR-16–FR-19; NFR-2, NFR-4, NFR-6–NFR-10, NFR-15; AD-9–AD-11, AD-14–AD-16, AD-24; Additional Requirements 8, 42, 57–65; UX-DR-037–040, UX-DR-054–060, UX-DR-091–100, UX-DR-120.

### Story 4.19: Verify per-service prompt-driven end-to-end flows

As a developer
I want one deterministic prompt-driven end-to-end flow for each launch service
So that natural requests reach only their intended Specialist Service and return attributable results.

**Acceptance Criteria**

- **Given** deterministic fixtures exist for T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition
  **When** one natural Thai or mixed-language prompt per service runs through routing, schema selection, local artifact resolution/minimization, exact consent, direct dispatch, and Evidence projection
  **Then** the expected service is selected and no other service is invoked.
- **Given** the T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition prompts use their respective image/PDF, audio, document, and bounded text fixtures
  **When** each flow completes
  **Then** the result preserves the exact source identity, service identity, configuration generation, returned and empty fields, uncertainty, consent reference, timing, and provenance.
- **Given** a prompt is ambiguous, the fixture input is unsupported, consent is denied, or the current service is unavailable
  **When** the corresponding end-to-end flow ends
  **Then** it reports the typed blocked/refused/denied/unavailable outcome without silent fallback, fabricated fields, or automatic retry.
- **Given** each flow is rendered interactively, in Thai or mixed language, redirected, narrow, or headless
  **When** its result is projected
  **Then** Specialist output, Typhoon explanation, Evidence, source identity, recipient identity, and canonical state tokens remain distinct and inspectable.

**Requirements:** FR-5, FR-13–FR-18; NFR-2, NFR-4, NFR-7–NFR-10, NFR-13; AD-10, AD-14–AD-15, AD-24–AD-25; Additional Requirements 27, 33, 59, 64–65; UX-DR-025, UX-DR-037–040, UX-DR-054–060, UX-DR-071–079, UX-DR-091–100, UX-DR-120.

### Story 4.20: Verify failure, cache, quarantine, retest, and output parity

As a developer
I want deterministic recovery and projection verification across Specialist Services
So that failure scope, cache freshness, retest behavior, and output meaning remain trustworthy.

**Acceptance Criteria**

- **Given** shared-key authentication failure, service-specific authentication or protocol failure, transient failure, quota, unsupported input, denied consent, stale generation, and unknown outcome fixtures exist
  **When** the verification suite runs
  **Then** each produces the expected deterministic category, retryability, smallest proven quarantine scope, no-fallback rule, and no-automatic-retry behavior.
- **Given** a valid CacheManifest fixture exists
  **When** cache lookup is exercised before live-health gating
  **Then** valid cached Evidence is visibly reusable while the service is quarantined, with original observation time and provenance preserved; no outbound transfer occurs.
- **Given** a force-fresh fixture is selected
  **When** the request runs
  **Then** prior Evidence remains preserved, current availability for the exact generation is required, and no force-fresh result is returned while the service is unavailable or quarantined.
- **Given** a corrected service-specific or shared-key configuration is retested
  **When** the explicit retest fixture runs
  **Then** only the proven scope is restored after a passing live check; failed, cancelled, stale, or unknown retests do not restore availability.
- **Given** the same Specialist outcomes are rendered in interactive, redirected, narrow, Thai/mixed-language, and headless projections
  **When** parity snapshots are compared
  **Then** canonical tokens, service and recipient identities, payload identity, Evidence headings, failure scope, cache reuse, and refusal/blocking reasons are semantically equivalent and color-independent.
- **Given** this verification story is executed
  **When** its scope is reviewed
  **Then** it reports only Specialist-domain failure, cache, recovery, and projection observations, with no unrelated release decision or platform certification claim.

**Requirements:** FR-3, FR-4, FR-13–FR-20; NFR-2, NFR-4, NFR-6–NFR-10, NFR-13, NFR-15; AD-8–AD-11, AD-14–AD-16, AD-18, AD-24–AD-25; Additional Requirements 55–67; UX-DR-021–024, UX-DR-025, UX-DR-037–040, UX-DR-054–060, UX-DR-071–079, UX-DR-085–100, UX-DR-120.

## Epic 5: Govern Active Context and Usage

A developer can inspect what Typhoon will receive, protect important content, distinguish Active Model Context from cumulative usage, and compact safely before dispatch without losing transcript history or protected material. Epic 5 builds only on capabilities already delivered by Epics 1–4. It uses the durable encrypted store and journal for current-session records while leaving complete Saved Session browsing and restoration to a later standalone outcome. Context projection, trust classification, capacity checks, compaction, consent/approval invalidation, and protected-overflow stops are mandatory pre-dispatch gates in every Work Mode and Permission Profile.

**Internal record-order correction:** Versioned context extension envelopes and ownership (Story 5.11 in the prior plan) plus encrypted/journaled persistence for context/usage/compaction records (Story 5.10 in the prior plan) are established **before** durable pin, usage ledger, context-manifest, compaction, overflow, recovery, and rendering consumers (Stories 5.2, 5.7, 5.8, 5.9, 5.12, 5.13 in the prior plan). A story does not require durability before the record contract and persistence adapter it depends on exist. See the reordered story sequence below.

**Implementation prerequisite:** PR-4 (Context capacity source) — no `128k` raw limit or `115,200` fallback capacity is a release commitment without a named provider/product decision and source. Effective Context Capacity uses the verified model limit only; before that exists, the UI shows `percentage unavailable`.

**FRs covered:** FR-29, FR-30, FR-31.

### Story 5.1: Define immutable transcript and Active Model Context contracts

As a developer  
I want the complete transcript and transmitted context represented as separate canonical models  
So that history remains lossless while each provider request receives a bounded, attributable projection.

**Acceptance Criteria**

- **Given** a Session has prompt rounds, user and Typhoon turns, tool activity, Specialist Service results, Evidence, and summaries  
  **When** the canonical context domain is compiled and validated  
  **Then** it defines an immutable Chat Transcript record and a separately versioned Active Model Context projection; deriving, compacting, or transmitting context never mutates, deletes, or rewrites transcript records.
- **Given** an Active Model Context is built  
  **When** each context item is serialized for inspection  
  **Then** it carries a stable context-item identity, source/provenance reference, source class, inclusion state, inclusion mode (`verbatim`, `summarized`, `compacted`, `pinned`, `protected`, `excluded`, or `unavailable`), trust classification, token/byte measurement status, and transformation history.
- **Given** context content comes from application instructions, Capability Registry schemas, user turns, Workspace content, artifacts, tool results, Specialist Service results, or remote/provider output  
  **When** the trust policy is applied  
  **Then** only application-owned instructions and reviewed Registry schemas enter trusted instruction channels; all other content is source-labelled, delimited, provenance-bound, and instruction-inert data that cannot define tools, change policy, grant authority, or alter task scope.
- **Given** a context item is missing, malformed, stale, unavailable, or sanitized with omissions  
  **When** the projection is prepared  
  **Then** the item retains its explicit Evidence state and omission reason, is never silently replaced by model explanation, and cannot be represented as complete raw content.
- **Given** a provider, UI, or adapter attempts to submit a transcript mutation through the context contract  
  **When** the command is validated  
  **Then** it is rejected as a projection-boundary violation and no transcript or context state changes.

**Requirements:** FR-29; FR-30; FR-31; NFR-2; NFR-4; NFR-7; NFR-13; NFR-15; AD-1; AD-3; AD-6; AD-7; AD-14; AD-24; UX-DR-026, UX-DR-030, UX-DR-091–093, UX-DR-104–106.

### Story 5.2: Establish durable PinId and pin persistence before context building

As a developer  
I want important transcript material to have a durable PinId and pin record  
So that protected content can be selected consistently before any pin-aware ContextBuilder runs.

**Acceptance Criteria**

- **Given** a transcript item can be protected for future context projections  
  **When** the pin domain contract is created  
  **Then** it defines an opaque immutable `PinId` and a minimal versioned pin record containing SessionId, PinId, target transcript/context-item identity, actor, creation time, reason/label, protection level, active/revoked state, and provenance; PinId is never derived from display text or mutable position.
- **Given** the Epic 1 encrypted store, journal, and post-commit event protocol are available  
  **When** a user pins or unpins an item in the current Session  
  **Then** the pin mutation is serialized by SessionId, journaled and encrypted before publication, idempotent by EventId/PinId, attributed to the user action, and visible only after post-commit Evidence.
- **Given** a pin target is missing, stale, outside the Session, or no longer maps to immutable transcript history  
  **When** pin or unpin is requested  
  **Then** the operation fails closed with `stale`, `unavailable`, or `not-authoritative`, records the reason, and does not retarget the pin implicitly.
- **Given** a pin is active  
  **When** later context projection code asks for pinned items  
  **Then** the ContextBuilder can consume the durable pin record and its target identity without creating, guessing, or persisting pins itself.
- **Given** a process crash occurs during pin/unpin staging, append, or projection publication  
  **When** the current Session recovers through the Epic 1 journal  
  **Then** the last committed pin state is restored, incomplete mutations are detectable, no half-applied pin is presented as active, and the transcript remains unchanged.

**Requirements:** FR-29; FR-31; NFR-1; NFR-6; NFR-7; AD-3; AD-6; AD-7; AD-20; AD-21; UX-DR-104–105.

### Story 5.3: Build a bounded, provenance-aware Active Model Context

As a developer  
I want ContextBuilder to select and rank only the material needed for the next Typhoon request  
So that the transmitted context is useful, bounded, inspectable, and safe against untrusted instructions.

**Acceptance Criteria**

- **Given** a valid transcript, current prompt, durable pins, Evidence, summaries, and Capability Registry schemas exist  
  **When** ContextBuilder projects the next request  
  **Then** it considers application instructions, the current request, recent turns, active pinned/protected items, task-relevant Evidence, summaries, and only relevant reviewed schemas in a deterministic order with stable ranking contributors.
- **Given** a user, Workspace, artifact, tool-result, Specialist Service, or remote/provider item contains imperative text, markup, tool-shaped data, or instructions to change policy  
  **When** the item is included  
  **Then** it is delimited and source-labelled as untrusted data, remains instruction-inert, and cannot alter the trusted instruction channel, tool list, permissions, consent, destination, or context policy.
- **Given** an item is selected, summarized, compacted, pinned, protected, excluded, or unavailable  
  **When** the projection is returned  
  **Then** the decision includes the item identity, rank, provenance, inclusion mode, reason, source hash where applicable, and measured or estimated contribution; protected items are never silently omitted.
- **Given** the same transcript, pins, policy, model, schemas, and request inputs are supplied twice  
  **When** ContextBuilder runs  
  **Then** it produces the same ordered projection and decision reasons, including stable serialization for Thai text and technical identifiers.
- **Given** context projection or its trust/policy validation fails  
  **When** dispatch is attempted  
  **Then** CoreApp stops before provider invocation with a typed `blocked`, `failed`, `not-authoritative`, or `percentage unavailable` outcome as applicable; no provider or retry path bypasses ContextBuilder.

**Requirements:** FR-14; FR-29; FR-30; FR-31; NFR-2; NFR-4; NFR-7; NFR-13; AD-2; AD-4; AD-5; AD-7; AD-14; AD-24; UX-DR-102, UX-DR-104–106.

### Story 5.4: Compute Effective Context Capacity with verified and fallback measurements

As a developer  
I want context capacity calculated from the actual model limit and explicit reserves  
So that utilization and dispatch decisions are conservative, honest, and recalculated when the model changes.

**Acceptance Criteria**

- **Given** a verified provider/model context limit and the request's configured maximum output are available  
  **When** capacity is calculated  
  **Then** Effective Context Capacity equals the verified model limit minus a response reserve and safety margin, with the response reserve equal to the greater of configured max output or 8% of raw context and the safety margin equal to the greater of 2,048 tokens or 2% of raw context.
- **Given** the verified model limit is unavailable or cannot be trusted  
  **When** capacity is calculated  
  **Then** no `128k` raw limit or `115,200` fallback capacity is assumed (PR-4); the denominator is labelled `percentage unavailable`, no numeric utilization percentage is emitted, and dispatch is blocked or proceeds only with explicit non-affirmative labelling. Any future fallback denominator requires a named provider/product decision and source recorded in Evidence before it can be used.
- **Given** provider-reported token counts are available after a request  
  **When** the context projection is reconciled  
  **Then** reported counts are kept distinct from local estimates and measurements, their source and observation time are recorded, and no invented precision or percentage is emitted.
- **Given** the selected model, verified model limit, configured output reserve, or safety policy changes  
  **When** the next projection is requested  
  **Then** Effective Context Capacity and all utilization bands are recalculated for the new identity; prior manifests remain immutable and are not relabelled as current.
- **Given** utilization is computed  
  **When** the percentage is rendered  
  **Then** the exact severity thresholds are used: green `<70%`, amber `70–84%`, orange `85–94%`, and red `95–100%`, each with its text label; capacity unknown never produces a numeric percentage.

**Requirements:** FR-30; FR-31; NFR-7; NFR-13; AD-7; AD-8; AD-9; UX-DR-039, UX-DR-091, UX-DR-104, UX-DR-107, UX-DR-120.

### Story 5.5: Finalize ContextManifest and transmitted identity before dispatch

As a developer  
I want the exact context bytes and identity finalized before Typhoon receives them  
So that approvals, transfer consent, usage, and Evidence refer to one request and cannot drift silently.

**Acceptance Criteria**

- **Given** ContextBuilder has produced a candidate projection and capacity decision  
  **When** the provider adapter finalizes the request  
  **Then** it returns an immutable versioned `ContextManifest` containing ordered item identities, inclusion/provenance decisions, model and configuration generation, capacity/reserve values, token/byte measurements, serialization version, exact transmitted-byte digest, and manifest digest before network dispatch.
- **Given** provider serialization, sanitization, redaction, schema selection, or compaction changes any context byte or manifest field  
  **When** finalization detects the change  
  **Then** the prior manifest, approval, and transfer consent are stale; a new manifest and fresh applicable review are required before dispatch.
- **Given** an operation approval or transfer consent references a ContextManifest  
  **When** the PEP revalidates immediately before dispatch  
  **Then** it recomputes the manifest and transmitted-byte digest and rejects any mismatch, stale authority revision, changed destination, changed classification, or changed expiry without invoking the provider.
- **Given** finalization succeeds  
  **When** dispatch proceeds  
  **Then** the same manifest/digest identity is attached to the operation, usage Evidence, provider request record, and resulting transcript/Evidence, and no adapter may substitute a different serialized context.
- **Given** a provider adapter cannot produce exact bytes, a digest, or a trustworthy capacity basis  
  **When** dispatch is evaluated  
  **Then** it stops with `not-authoritative` or `percentage unavailable` and an inspectable remedy rather than sending an unidentifiable request.

**Requirements:** FR-16; FR-29; FR-30; FR-31; NFR-4; NFR-7; NFR-13; AD-4; AD-7; AD-17; AD-20; AD-24; UX-DR-073–075, UX-DR-080, UX-DR-104–106.

### Story 5.6: Expose `/context` inspection and explicit context actions

As a developer  
I want `/context` to explain what will be sent and why  
So that I can inspect contributors, protect or release content, and compact deliberately without guessing.

**Acceptance Criteria**

- **Given** a current context projection or a capacity-unknown state exists  
  **When** I run `/context inspect`  
  **Then** it shows ranked contributors, inclusion mode, provenance, trust/source label, token contribution, digest, Effective Context Capacity, response reserve, safety margin, measurement source, compaction history, and final ContextManifest identity; unknown measurements use `percentage unavailable` and a reason.
- **Given** I select a context item from `/context`  
  **When** I choose `inspect`, `pin`, `unpin`, `compact`, `new-session`, or `retry`  
  **Then** the command validates one explicit action, states its consequence before activation, records the action and correlation identity, and never hides transcript deletion or silently changes protected status.
- **Given** I run `/context pin <id>` or `/context unpin <id>`  
  **When** the target is valid or stale  
  **Then** the command uses the durable PinId contract, reports the committed result or typed failure, and preserves the prior decision as Evidence when it is stale or rejected.
- **Given** the context contains protected material or an active approval/consent  
  **When** a context action changes the candidate transmitted request  
  **Then** the affected approval/consent becomes visibly `stale`, cannot authorize, and requires fresh evaluation; `Esc` dismisses without authorizing.
- **Given** output is redirected, headless, monochrome, or narrower than 40 columns  
  **When** `/context inspect --json` or text output renders  
  **Then** it preserves the same fields and labels, uses a text accounting form such as `CTX 82% 70–84%` when measured, and never relies on the Context Donut or color to convey severity.

**Requirements:** FR-29; FR-30; FR-31; NFR-9; NFR-10; NFR-13; AD-2; AD-3; AD-7; AD-17; AD-24; UX-DR-021–022, UX-DR-039–040, UX-DR-055–059, UX-DR-060, UX-DR-091–093, UX-DR-104–106, UX-DR-118.

### Story 5.7: Separate `/usage` cumulative ledger from Active Context

As a developer  
I want cumulative token usage shown separately from current context utilization  
So that I can understand spend and calls without mistaking history for the next request's capacity.

**Acceptance Criteria**

- **Given** Typhoon requests, responses, cache activity, and provider usage observations occur  
  **When** the usage ledger records them  
  **Then** it keeps cumulative input, output, cached-input, total-call, model, session, period, source, and observation fields separate from the current ContextManifest and Active Context utilization.
- **Given** a usage value is provider-reported, locally measured, estimated, fallback-derived, or unknown  
  **When** it is displayed or persisted  
  **Then** the value carries that label and Evidence/provenance; estimates never overwrite provider-reported observations.
- **Given** no explicit user budget exists  
  **When** I run `/usage`  
  **Then** it shows cumulative accounting without a percentage, progress bar, or implied quota; it may show `budget not set` and an explicit configuration/remedy path.
- **Given** I run `/usage --period=<scope>` or `/usage --json`  
  **When** the ledger is queried  
  **Then** the command returns the selected period and the same canonical categories in text and JSON, with no context contributors or compaction decisions substituted into the cumulative ledger.
- **Given** a request has a provider-reported count that differs from an estimate  
  **When** reconciliation occurs  
  **Then** both observations remain attributable, the ledger records the correction without rewriting the prior manifest, and the context projection uses only the measurement appropriate to its capacity contract.

**Requirements:** FR-30; NFR-6; NFR-7; NFR-9; NFR-10; NFR-15; AD-3; AD-6; AD-7; AD-20; AD-24; UX-DR-039, UX-DR-091–093, UX-DR-107, UX-DR-118.

### Story 5.8: Compact deterministically before over-capacity dispatch

As a developer  
I want thcode to compact older unpinned context automatically in every mode and profile  
So that ordinary requests fit without losing transcript history, pins, or protected material.

**Acceptance Criteria**

- **Given** a projected request exceeds Effective Context Capacity or would cross the dispatch safety threshold  
  **When** the pre-dispatch gate runs in Plan or Build and under Manual, Assisted, or Full Access  
  **Then** compaction runs automatically before provider dispatch and cannot be disabled or bypassed by mode, profile, provider output, retry, or UI path.
- **Given** older unpinned material can be compacted  
  **When** deterministic compaction runs  
  **Then** it selects material by stable age/relevance/protection rules, preserves current instructions, recent required turns, all active pins and protected items, and produces a target projection at or below 70% utilization where the unprotected material permits it.
- **Given** compaction transforms one or more context items  
  **When** the result is committed  
  **Then** the transcript remains byte-for-byte immutable, the new summarized/compacted items retain source identities and provenance, and the transformation records inputs, output identities, policy/version, reason, before/after measurements, and ContextManifest linkage as Evidence.
- **Given** a compaction attempt is cancelled or fails  
  **When** the pre-dispatch gate resolves  
  **Then** the prior valid projection remains available, no partial compacted projection is dispatched, and the operation reports `cancelled`, `failed`, or `blocked` with the next safe action.
- **Given** the request remains over capacity after all permissible unprotected compaction  
  **When** the gate evaluates the result  
  **Then** it routes to protected-overflow handling and never silently truncates, unpins, drops, or rewrites protected material.

**Requirements:** FR-29; FR-30; FR-31; NFR-6; NFR-7; NFR-13; AD-3; AD-6; AD-7; AD-13; AD-20; AD-24; UX-DR-039, UX-DR-065, UX-DR-104–106, UX-DR-118.

### Story 5.9: Stop protected overflow with categorized accounting and remedies

As a developer  
I want a clear stop when protected content cannot fit  
So that I can choose a safe remedy without thcode silently losing material or dispatching an incomplete request.

**Acceptance Criteria**

- **Given** protected, pinned, required-instruction, recent-required, schema, reserve, safety, and other context categories together exceed Effective Context Capacity  
  **When** automatic compaction cannot bring the request within the limit  
  **Then** dispatch stops before provider invocation with `blocked`/`over-cap`, a durable warning, and a categorized token/byte breakdown showing capacity, reserves, each protected category, and the remaining excess.
- **Given** the protected-overflow stop is rendered  
  **When** the user inspects it through Ink, redirected text, or headless JSON  
  **Then** it preserves exact identities/digests, non-color severity labels, Evidence completeness, and explicit remedies such as inspect, unpin/release a selected item, start a new session, or revise the request; it never offers a hidden drop or blind retry.
- **Given** a user chooses a remedy that changes protected content, context inputs, model, reserve, destination, or manifest  
  **When** the remedy is activated  
  **Then** the old manifest and any related approval/consent are stale, the change is recorded, and a fresh projection and review are required before dispatch.
- **Given** a user declines all remedies or no safe remedy is available  
  **When** the operation terminates  
  **Then** the complete transcript and prior valid context remain intact, the provider is not contacted, and the terminal outcome remains `blocked` with a truthful next step.
- **Given** Effective Context Capacity is unknown or the measurement source is not authoritative  
  **When** protected overflow is evaluated  
  **Then** thcode fails closed with `percentage unavailable`/`not-authoritative`, does not guess that the request fits, and does not dispatch.

**Requirements:** FR-29; FR-30; FR-31; NFR-4; NFR-7; NFR-13; AD-4; AD-7; AD-13; AD-17; UX-DR-039–040, UX-DR-091–093, UX-DR-104–107, UX-DR-120.

### Story 5.10: Persist context decisions, manifests, compaction, and usage crash-consistently

As a developer  
I want current-session context governance records persisted through the Epic 1 encrypted journal  
So that a crash cannot erase what was protected, compacted, transmitted, or counted.

**Acceptance Criteria**

- **Given** a current Session performs pin changes, context projections, capacity calculations, manifest finalization, usage reconciliation, compaction, or protected-overflow handling  
  **When** each record is committed  
  **Then** sanitized versioned records are encrypted with the existing OS-held key, carry SessionId/PromptRoundId/OperationId/EventId, aggregate version, ContextManifest or PinId linkage where applicable, provenance, and post-commit visibility state.
- **Given** a context decision or compaction transformation includes content-derived data  
  **When** it is persisted  
  **Then** it stores only the permitted sanitized representation, source identity/hash, decision metadata, and Evidence references; credentials, raw provider payloads, and unapproved outbound bytes are never persisted.
- **Given** the process is killed during projection, compaction, manifest, usage, or overflow staging  
  **When** the application restarts  
  **Then** incomplete records are detectable, the last committed projection/manifest/ledger remains authoritative, staged unreachable data is repaired or removed, and no provider dispatch or compaction side effect is replayed automatically.
- **Given** duplicate events, provider retries, or repeated post-commit publication occur  
  **When** records are applied  
  **Then** EventId and operation/manifest identity deduplication prevent duplicate pins, transformations, usage entries, or transcript content while retaining the durable high-water state.
- **Given** an encrypted record fails authentication, schema validation, or migration checks  
  **When** recovery reads it  
  **Then** the record is marked `corrupt` or `recovery-locked`, the store preserves existing ciphertext, no fallback plaintext/key is generated, and context dispatch fails closed with an inspectable recovery action.

**Requirements:** FR-29; FR-30; FR-31; NFR-1; NFR-2; NFR-6; NFR-7; NFR-15; AD-3; AD-6; AD-7; AD-20; AD-21; AD-24; UX-DR-091–093, UX-DR-104–107.

### Story 5.11: Define versioned context extension envelopes and ownership

As a developer  
I want context-governance records to have versioned, owned persistence envelopes  
So that current-session recovery and future Epic 6 restoration can consume them without coupling Epic 5 to a Session browser.

**Acceptance Criteria**

- **Given** Epic 5 needs to persist pins, context decisions, capacity bases, compaction history, ContextManifests, or usage Evidence  
  **When** the extension-record contract is defined  
  **Then** each record has an explicit kind, schema version, stable identity, SessionId and ownership boundary, checksum, provenance, format version, and forward-compatibility metadata, and is independent of Saved Session listing or navigation.
- **Given** a record contains content-derived context information  
  **When** its envelope is serialized  
  **Then** it stores only the permitted sanitized representation, source identity/hash, decision metadata, and Evidence references; credentials, raw provider payloads, and unapproved outbound bytes are excluded.
- **Given** a later schema version or unknown extension kind is encountered  
  **When** the current Epic 5 reader cannot interpret it  
  **Then** it preserves the opaque validated record, exposes `unavailable`/`not-authoritative` metadata, and never silently drops protected-content ownership, invents a migration, or treats unknown data as current authority.
- **Given** a later Epic 6 Saved Session browser or restoration flow consumes these records  
  **When** it reads the ownership contract  
  **Then** it can identify and restore the records without requiring Epic 5 to implement Session listing, browser navigation, deletion, Workspace rebinding, or complete Session restoration.

**Requirements:** FR-27; FR-28; FR-29; FR-30; FR-31; NFR-1; NFR-2; NFR-6; NFR-7; NFR-15; AD-3; AD-6; AD-7; AD-20; AD-21; AD-24; UX-DR-091–093, UX-DR-104–107.

### Story 5.12: Recover current-session context governance safely

As a developer  
I want current-session context, pin, compaction, manifest, and usage records to recover safely after restart  
So that a crash cannot erase protection or cause stale authority or an unsafe dispatch.

**Acceptance Criteria**

- **Given** the Epic 1 encrypted store and journal contain committed Epic 5 extension records  
  **When** the current runtime/store path reopens a Session without invoking the Epic 6 browser  
  **Then** active PinIds, last valid context decisions, compaction history, ContextManifests, capacity basis, and cumulative usage ledger are reconstructed from post-commit records or explicitly marked `unavailable`/`corrupt`; the immutable transcript remains authoritative.
- **Given** the process is killed during extension-record staging, append, projection publication, or recovery  
  **When** startup recovery runs  
  **Then** incomplete records are detectable, the last committed state remains authoritative, unreachable staged data is repaired or removed, and no provider dispatch, compaction transformation, pin mutation, or side effect is replayed automatically.
- **Given** duplicate events, provider retries, or repeated post-commit publication occur  
  **When** recovered records are applied  
  **Then** EventId, PinId, operation identity, and ContextManifest identity deduplication prevent duplicate pins, transformations, usage entries, or transcript content while retaining the durable high-water state.
- **Given** an encrypted record fails authentication, checksum, schema, or migration validation  
  **When** recovery reads it  
  **Then** the record is marked `corrupt` or `recovery-locked`, existing ciphertext is preserved, no fallback plaintext/key is generated, and any dispatch depending on the record fails closed with an inspectable recovery action.
- **Given** recovered context decisions or capacity measurements are stale, unavailable, or tied to a different model/manifest  
  **When** a new request is prepared  
  **Then** thcode rebuilds or revalidates the projection before dispatch and never treats a recovered record as permission to bypass context, trust, capacity, policy, or consent checks.

**Requirements:** FR-27; FR-28; FR-29; FR-30; FR-31; NFR-1; NFR-6; NFR-7; NFR-13; NFR-15; AD-3; AD-6; AD-7; AD-13; AD-20; AD-21; AD-22; AD-24; UX-DR-104–107, UX-DR-120.

### Story 5.13: Render recovered context and usage accessibly and invalidate stale authority

As a developer  
I want recovered context and usage state to remain inspectable in every supported output mode  
So that I can understand recovery limits and never act on stale approval or transfer consent.

**Acceptance Criteria**

- **Given** recovered context, usage, compaction, or pin records are complete, estimated, stale, unavailable, corrupt, or not authoritative  
  **When** Ink, redirected, linearized, headless JSON, monochrome, reduced-motion, screen-reader, or narrow-terminal output renders  
  **Then** it uses the same canonical fields and labels, preserves Evidence completeness/provenance and omission reasons, degrades the Context Donut to text accounting, keeps technical tokens exact/atomic, and never relies on color or durable redraw for meaning.
- **Given** a recovered context projection is inspectable through `/context`  
  **When** the user reviews it  
  **Then** ranked contributors, inclusion mode, provenance, token contribution, digest, compaction history, Effective Context Capacity, reserves, measurement source, and ContextManifest identity remain visible or available through the explicit inspection path; protected overflow remains a pre-dispatch stop.
- **Given** a recovered cumulative ledger is inspected through `/usage`  
  **When** the user requests text or JSON output  
  **Then** cumulative input/output/cache/call values remain separate from Active Context and are labelled provider-reported, locally measured, estimated, fallback, or unknown; no percentage is shown without a real configured budget.
- **Given** context, usage, pin, or compaction state changes while an approval or transfer-consent surface is open  
  **When** the next key event or submit is received  
  **Then** the decision is disabled as `stale`, the prior decision is retained as non-authorizing Evidence, prior/current identities are inspectable, focus moves to Review/Cancel, and no stale authority can dispatch.
- **Given** no TTY is available or the recovered state is not authoritative  
  **When** an action would require approval, consent, pin protection, or an uncertain context decision  
  **Then** the command fails closed before preparation/dispatch with the canonical machine-readable state, safe next step, and no ambient authority or secret read.

**Requirements:** FR-27; FR-28; FR-29; FR-30; FR-31; NFR-6; NFR-7; NFR-9; NFR-10; NFR-13; AD-2; AD-3; AD-7; AD-17; AD-20; AD-22; AD-24; UX-DR-021–022, UX-DR-026, UX-DR-039–040, UX-DR-055–060, UX-DR-067–070, UX-DR-091–093, UX-DR-104–107, UX-DR-118–120.

## Epic 6: Resume Work Safely Across Saved Sessions and Interruptions

A developer can create, browse, open, rename, inspect, and delete machine-local Saved Sessions; restore every record type established in Epics 1–5; start a fresh Manual Runtime Activation; recover interrupted remote work; and handle missing, locked, corrupt, or incomplete state without stale authority or silent Workspace rebinding. Sessions are global to the current OS user, stored only in the existing encrypted local store/journal, and never synchronize to cloud or another machine.

**FRs covered:** FR-26, FR-27, FR-28, FR-32.

### Story 6.1: Define the global Saved Session index and Workspace association states

As a developer  
I want a per-user index of Saved Sessions with explicit Workspace association state  
So that I can find work safely without treating a repository-local directory or a missing Workspace as authority.

**Acceptance Criteria**

- **Given** the existing encrypted SQLite store and operation journal are available  
  **When** the Session index is initialized or migrated  
  **Then** it stores global-per-OS-user Session metadata including `SessionId`, display name, created/updated/last-opened timestamps, aggregate version, transcript/activity counts, last known provider identity, Work Mode, recovery state, deletion state, and store/schema versions; credentials and secret material are excluded.
- **Given** a Session references a Workspace  
  **When** its association is resolved for the current machine  
  **Then** it is classified as `current-workspace`, `other-workspace`, `missing-workspace`, `changed-workspace`, or `unverified-workspace` using stable Workspace/platform identity, canonical path, source metadata, and recorded hashes where available.
- **Given** the Session store is opened by a different repository or current directory  
  **When** the index is queried  
  **Then** all Sessions for the OS user remain discoverable and no Session is implicitly scoped to, copied into, or rebound to the current directory.
- **Given** an index write, migration, or journal append is interrupted  
  **When** startup recovery runs  
  **Then** the last committed index remains authoritative, incomplete stages are detectable and repairable, and no Session becomes visible or active solely from an in-memory update.
- **Given** index metadata is encrypted, unreadable, schema-incompatible, or checksum-invalid  
  **When** it is read  
  **Then** the affected state is reported as `locked`, `corrupt`, or `migration-incomplete` without a replacement key, overwrite, credential exposure, or effect capability.

**Requirements:** FR-26; FR-27; FR-28; NFR-1; NFR-6; NFR-7; NFR-15; AD-3; AD-6; AD-20; AD-21; AD-22; UX-DR-023, UX-DR-085–086, UX-DR-109, UX-DR-118–120.

### Story 6.2: Provide the canonical Session browser and lifecycle commands

As a developer  
I want to create, list, search, sort, inspect, rename, and open Sessions through one browser  
So that `/session` is predictable and `/sessions` remains a compatible alias.

**Acceptance Criteria**

- **Given** the Session index is readable  
  **When** I invoke `/session`  
  **Then** the browser supports create, list, search, sort, inspect, open, rename, and delete intents against the global per-user index, with stable `SessionId`, display name, Workspace state, provider, Work Mode, updated time, recovery state, and next action fields.
- **Given** I invoke `/sessions`  
  **When** the command is parsed  
  **Then** it resolves to the same canonical `/session` browser, projections, permissions, keyboard behavior, and headless contract without a divergent implementation or state vocabulary.
- **Given** a search term, sort key, narrow terminal, redirected output, linearized accessibility output, or headless JSON mode  
  **When** the browser renders  
  **Then** results remain complete and deterministic, preserve Thai text and exact technical identifiers, use text labels rather than color-only status, and never reveal credentials or raw sensitive payloads.
- **Given** I request creation or rename  
  **When** the mutation is accepted  
  **Then** it is journaled and encrypted, serialized by `SessionId` or index revision, idempotent on replay, visible only after post-commit projection, and cannot change Workspace identity or restore authority.
- **Given** a Session is deleted, locked, corrupt, missing its Workspace, or in incomplete recovery  
  **When** I inspect or open it  
  **Then** the browser exposes the typed state and only valid next actions; it does not claim the Session is usable or offer a silent replacement.

**Requirements:** FR-26; FR-27; NFR-2; NFR-6; NFR-7; NFR-9; NFR-10; AD-1–AD-3; AD-6; AD-14; UX-DR-006, UX-DR-015–016, UX-DR-021–023, UX-DR-037–040, UX-DR-067–070, UX-DR-098–100, UX-DR-109, UX-DR-118–120.

### Story 6.3: Restore base Session records atomically before activation commit

As a developer  
I want the core Session aggregate restored as one cancellable operation  
So that opening a Session cannot expose a half-restored conversation or authorize work prematurely.

**Acceptance Criteria**

- **Given** I select an undeleted readable Session  
  **When** restore begins  
  **Then** the restore operation has `SessionId`, `OperationId`, schema/store versions, progress, cancellation, aggregate version, and a durable stage; it reads the base records already defined by Epics 1–5: Session identity, immutable transcript, lifecycle/events, Prompt Rounds, Typhoon identity/configuration reference, Work Mode, Workspace association, artifact/source manifest references, plans, tool history, verification history, and Evidence references.
- **Given** base records include durable provider chunks, high-water identities, or post-commit terminal events  
  **When** they are replayed  
  **Then** EventId/upstream identity deduplication and aggregate-version checks reconstruct one authoritative projection without duplicate transcript, activity, Evidence, or completion.
- **Given** restore is cancelled or the process stops before the restore commit  
  **When** recovery runs  
  **Then** the pre-open Session remains unchanged, no partial projection is presented as active, staged material is retained only as recoverable staging or safely removed, and no Runtime Activation or effect authority is committed.
- **Given** a required base record is missing, malformed, unsupported at its major version, or fails integrity validation  
  **When** restore validates the aggregate  
  **Then** it stops with a typed `corrupt`, `unsupported`, or `incomplete` result, identifies the affected record class without exposing secrets, and does not synthesize content or silently drop a required base record.
- **Given** base restore reaches its durable commit  
  **When** the projection is published  
  **Then** the Session is available as a read-only restored projection with effects blocked and an explicit activation-ready state; this story does not create execution authority.

**Requirements:** FR-27; FR-28; NFR-6; NFR-7; NFR-9; NFR-15; AD-3; AD-6; AD-13; AD-14; AD-20; AD-24; UX-DR-021–026, UX-DR-067–070, UX-DR-091–093, UX-DR-104–107.

### Story 6.4: Restore typed extension envelopes from Specialist, context, and checkpoint records

As a developer  
I want earlier-epic extension records restored by ownership and version  
So that useful governance and provenance survive without making unknown future data a hidden dependency.

**Acceptance Criteria**

- **Given** base restore has committed  
  **When** extension restore runs  
  **Then** it restores only record types already established in Epics 1–5: Specialist Evidence and cache references; context pins, context decisions, ContextManifests, capacity/compaction decisions, and cumulative usage ledger; and checkpoint lineage, rollback references, coverage, retention, and integrity state.
- **Given** each extension envelope is read  
  **When** its ownership, schema/version, checksum, SessionId, stable record identity, aggregate linkage, and provenance are validated  
  **Then** valid records are reconstructed atomically or explicitly marked unavailable/corrupt, and credentials, copied source files, raw unapproved payloads, and temporary authority are never restored.
- **Given** a valid extension envelope has a newer schema or unknown record kind  
  **When** the current runtime cannot interpret it  
  **Then** it preserves the opaque versioned envelope and integrity metadata, exposes `unsupported`/`not-authoritative`, and does not require, reinterpret, discard, or mutate the unknown extension.
- **Given** an extension record is corrupt, partially staged, or references a missing artifact/cache/checkpoint  
  **When** restore validates references  
  **Then** the affected extension is marked `corrupt`, `incomplete`, or `unavailable`, valid unrelated extensions remain inspectable, and dispatch or rollback cannot rely on missing authority or invented provenance.
- **Given** extension restore is cancelled or interrupted  
  **When** recovery resumes  
  **Then** no half-applied extension projection is published, the last committed extension state remains authoritative, and retrying restore does not duplicate records or effects.

**Requirements:** FR-27; FR-28; NFR-1; NFR-6; NFR-7; NFR-8; NFR-15; AD-3; AD-6; AD-17; AD-20; AD-21; AD-24; UX-DR-085–086, UX-DR-091–093, UX-DR-104–107, UX-DR-118–120.

### Story 6.5: Commit a fresh safe Runtime Activation after restore

As a developer  
I want opening a Session to create a new safe activation only after resource revalidation  
So that restoration never revives temporary authority or binds effects to the wrong Workspace.

**Acceptance Criteria**

- **Given** base and applicable extension restore completed  
  **When** activation commit is requested  
  **Then** a new Runtime Activation identity and authority revision are journaled before the Session becomes effect-capable, with Permission Profile `Manual`, Full Access cleared, temporary approvals cleared, transfer consent cleared, and all in-flight authority invalidated.
- **Given** a saved Work Mode is valid  
  **When** activation commits  
  **Then** Work Mode may restore independently, while Permission Profile remains `Manual`; restoring Work Mode never restores approval, transfer consent, Full Access, or any other authority dimension.
- **Given** durable Boundary Expansions exist  
  **When** activation commits  
  **Then** each expansion is revalidated against stable resource identity, platform, Workspace identity, permitted actions, expiry, and revocation; invalid or changed expansions are unavailable and cannot authorize effects.
- **Given** the saved Workspace is current and verified  
  **When** activation commits  
  **Then** the activation records the verified Workspace identity and current resource checks; if the Workspace is missing, changed, other, or unverified, the Session remains open for inspect/repair but all effects are blocked.
- **Given** the current directory resembles a missing or changed saved Workspace  
  **When** activation is attempted  
  **Then** thcode never silently rebinds the Session, never changes its saved association, and requires an explicit supported Workspace resolution and fresh activation before effects.
- **Given** activation commit fails or is interrupted  
  **When** recovery runs  
  **Then** the Session is left read-only or blocked with no stale authority, no consumed approval, and no provider/native effect.

**Requirements:** FR-28; NFR-3; NFR-6; NFR-7; NFR-13; AD-18; AD-22; AD-23; UX-DR-023–024, UX-DR-055–060, UX-DR-071–079, UX-DR-109, UX-DR-118–120.

### Story 6.6: Restore transcript, remote chunks, and the exact interruption boundary

As a developer  
I want durable remote output and interruption state restored exactly  
So that known work remains visible without a fabricated completion.

**Acceptance Criteria**

- **Given** a Session contains an interrupted or in-flight remote Prompt Round  
  **When** restore replays its transcript and operation journal  
  **Then** all durably committed sanitized provider chunks, upstream sequence/high-water identity, operation state, timing, cancellation evidence, and terminal events are restored in order with duplicate suppression.
- **Given** the reliable boundary after the last durable chunk or durable interruption event is known  
  **When** the transcript projection is rebuilt  
  **Then** it inserts exactly one durable heading `Chat interrupted` at that boundary, with the known operation identity and interruption status, without appending an invented assistant ending or synthesized completion.
- **Given** a response had no durable chunks, partial chunks, or a sealed complete stream  
  **When** it is restored  
  **Then** the projection distinguishes no-known-output, partial-output, and complete terminal records and never upgrades an incomplete stream to success.
- **Given** a duplicate interruption event, chunk replay, or restart occurs  
  **When** the journal applies it  
  **Then** EventId and upstream identity deduplication preserve one interruption boundary and one high-water state.
- **Given** transcript or chunk decryption/integrity validation fails  
  **When** restoration reads it  
  **Then** the affected content is marked `corrupt`/`recovery-locked`, no plaintext fallback is used, and the Session cannot claim a complete response.

**Requirements:** FR-27; FR-32; NFR-1; NFR-2; NFR-6; NFR-7; NFR-9; AD-3; AD-13; AD-20; AD-21; UX-DR-026, UX-DR-037–040, UX-DR-067–070, UX-DR-118–120.

### Story 6.7: Classify interrupted remote operations without guessing

As a developer  
I want an interrupted remote operation classified by durable evidence  
So that I know whether reconciliation is possible without an unsafe automatic retry.

**Acceptance Criteria**

- **Given** a remote operation has a durable journal entry and may have been interrupted  
  **When** classification runs  
  **Then** it emits one of the supported states `not-sent`, `possibly-dispatched`, `response-started`, or `unknown`, including OperationId, dispatch-commit evidence, response high-water identity, provider/configuration generation, cancellation timing, and safe reason.
- **Given** the journal proves no `dispatch-committed` state and no network transmission evidence  
  **When** classification completes  
  **Then** it reports `not-sent` and does not represent the operation as a remote completion or unknown remote effect.
- **Given** dispatch was committed but no response chunk exists, or response chunks exist without a terminal seal  
  **When** classification completes  
  **Then** it reports `possibly-dispatched` or `response-started` respectively and retains the exact durable output and `Chat interrupted` boundary.
- **Given** commit, transmission, response, or terminal evidence is contradictory or incomplete  
  **When** classification completes  
  **Then** it reports `unknown`, preserves the contradiction as sanitized Evidence, and offers no automatic retry or synthesized completion.
- **Given** a classification is replayed  
  **When** the same evidence is consumed again  
  **Then** the result is idempotent and cannot downgrade a stronger known state without an explicit versioned correction event.

**Requirements:** FR-32; NFR-6; NFR-7; NFR-15; AD-3; AD-13; AD-20; AD-24; UX-DR-037–040, UX-DR-067–070, UX-DR-085, UX-DR-118–120.

### Story 6.8: Reconcile interrupted remote work through `/recover`

As a developer  
I want `/recover` to reconcile only when identity and safety are proven  
So that unresolved remote work stays honest and is never repeated by an equivalent reprompt.

**Acceptance Criteria**

- **Given** an interrupted operation is classified  
  **When** I invoke `/recover`  
  **Then** the command lists recoverable operations, classification, known output, provider/configuration identity, and supported next actions through interactive, redirected, linearized, and headless projections.
- **Given** the provider supports a verified status or idempotency lookup bound to the exact OperationId/request identity and current endpoint/configuration contract  
  **When** reconciliation is explicitly requested  
  **Then** it performs the supported lookup under a fresh Manual authority, records the result durably, preserves the original operation identity, and transitions only to a proven terminal or `reconciled` state.
- **Given** no supported idempotency/status identity exists, identity mismatches, or lookup is unavailable  
  **When** `/recover` is requested  
  **Then** it reports `unknown`/`not-reconciled`, does not dispatch an equivalent prompt, does not retry automatically, and does not synthesize a completion.
- **Given** reconciliation returns a response or completion  
  **When** the result is applied  
  **Then** it is attributable to the exact original operation and provider identity, deduplicated against stored chunks, and clearly separated from the original interrupted transcript boundary.
- **Given** a user chooses to reprompt rather than reconcile  
  **When** the command confirms the choice  
  **Then** it starts a new Prompt Round with a new OperationId and fresh policy/authority evaluation, explicitly labels the original outcome unresolved, and never implies equivalence or safety from textual similarity alone.

**Requirements:** FR-32; NFR-6; NFR-7; NFR-13; NFR-15; AD-3; AD-13; AD-18; AD-20; AD-24; UX-DR-026, UX-DR-037–040, UX-DR-067–070, UX-DR-085, UX-DR-091–093, UX-DR-118–120.

### Story 6.9: Hide deleted Sessions immediately with a journaled tombstone

As a developer  
I want deletion to become authoritative at the tombstone commit  
So that a deleted Session cannot be reopened through stale UI, replay, or an old handle.

**Acceptance Criteria**

- **Given** I select a live Session and complete the typed deletion confirmation  
  **When** deletion starts  
  **Then** the operation records the exact SessionId, aggregate/index revision, actor intent, deletion scope, and a journaled non-sensitive tombstone stage before cleanup.
- **Given** the tombstone reaches durable commit  
  **When** any browser, open request, subscription, cached projection, stale command, or replay references the Session  
  **Then** the Session is immediately inaccessible and cannot create or restore Runtime Activation, read sensitive records, dispatch effects, or appear as live; requests receive a typed `deleted` outcome.
- **Given** deletion is cancelled before tombstone commit  
  **When** the operation ends  
  **Then** the Session remains unchanged and accessible, and no partial deletion is presented as complete.
- **Given** the process stops after tombstone commit  
  **When** recovery runs  
  **Then** the tombstone remains authoritative, cleanup resumes or remains visibly incomplete, and no cleanup path can revive the Session aggregate.
- **Given** tombstone metadata is rendered  
  **When** it appears in UI, headless output, logs, or recovery state  
  **Then** it contains only non-sensitive deletion identity/status permitted by policy and never transcript, credentials, raw paths, payloads, or secret-bearing diagnostics.

**Requirements:** FR-26; FR-27; FR-28; NFR-2; NFR-6; NFR-7; AD-3; AD-6; AD-20; AD-24; UX-DR-085–086, UX-DR-109, UX-DR-118–120.

### Story 6.10: Cascade deletion and reclaim Session-owned sensitive data

As a developer  
I want deletion to remove every Session-owned reference and zero-reference sensitive byte  
So that cleanup is complete, attributable, and recoverable without reviving deleted work.

**Acceptance Criteria**

- **Given** a committed Session tombstone exists  
  **When** cascade cleanup runs  
  **Then** it removes or securely stages deletion for the Session-owned transcript, events, Prompt Rounds, context pins/manifests/decisions/compaction/usage, projections, Evidence, Specialist Evidence and cache references, artifact references, exports, recovery records, checkpoint lineage and rollback references, WAL/journal/temp staging, and other records owned by the Session.
- **Given** an artifact, cached Specialist result, checkpoint original, or encrypted byte has reference counts from multiple live owners  
  **When** the Session reference is removed  
  **Then** only the Session reference is deleted; shared content remains while its reference count is nonzero and ownership updates are journaled atomically.
- **Given** a sensitive artifact or encrypted byte reaches zero references  
  **When** cleanup commits its removal  
  **Then** it is deleted or securely staged for deletion according to the existing store contract, with no plaintext copy left in WAL, temp, projection, export, or recovery staging; secure-deletion limitations are reported honestly.
- **Given** cleanup fails, is interrupted, or encounters an already-removed item  
  **When** recovery resumes  
  **Then** each step is idempotent and typed, remaining cleanup is retryable or inspectable, the tombstone remains authoritative, and no partial cleanup makes the Session accessible again.
- **Given** cascade cleanup completes  
  **When** the index is queried  
  **Then** only the permitted non-sensitive tombstone/audit outcome remains, no live Session record or sensitive reference remains, and recovery cannot reconstruct the deleted aggregate.

**Requirements:** FR-26; FR-27; NFR-1; NFR-2; NFR-6; NFR-7; NFR-15; AD-3; AD-6; AD-20; AD-21; AD-24; UX-DR-085–086, UX-DR-109, UX-DR-118–120.

### Story 6.11: Open locked and incomplete state in safe read-only recovery

As a developer  
I want missing keys, corrupt stores, missing Workspaces, and incomplete stages explained as recoverable or unrecoverable states  
So that recovery never overwrites evidence or performs effects without trustworthy state.

**Acceptance Criteria**

- **Given** the OS-held data-encryption key is missing, unreadable, or fails authentication  
  **When** a Session or index is opened  
  **Then** thcode enters `recovery-locked`/`unrecoverable-key` read-only mode, preserves ciphertext, does not generate a replacement key, and clearly explains that encrypted content cannot be reconstructed without the original key.
- **Given** the store is corrupt, migration-incomplete, checksum-invalid, or format-incompatible  
  **When** recovery runs  
  **Then** it records the precise typed state and progress, preserves the original store, permits only safe inspect/exit or supported repair, and performs no overwrite, provider dispatch, native effect, credential use, or automatic migration guess.
- **Given** a saved Workspace or source reference is missing, changed, or cannot be verified  
  **When** a Session is inspected or opened  
  **Then** the Session remains available for safe transcript/metadata inspection where decryptable, effects are blocked, and the UI requires explicit Workspace resolution rather than rebinding to the current directory.
- **Given** an incomplete restore, activation, deletion, key rotation, or cleanup stage exists  
  **When** startup or Session recovery runs  
  **Then** it reports progress and ownership, resumes only journaled local cleanup/repair that is proven idempotent, never replays a remote/native effect, and does not expose a false terminal outcome.
- **Given** recovery cannot establish integrity or authority  
  **When** any command requests a mutation, remote call, approval, transfer, rollback, or reprompt  
  **Then** it fails closed with a stable outcome and next step; no temporary workaround, replacement key, synthesized record, or stale authorization is offered.

**Requirements:** FR-26; FR-27; FR-28; FR-32; NFR-1; NFR-3; NFR-6; NFR-7; NFR-13; NFR-15; AD-3; AD-6; AD-18; AD-20; AD-21; AD-22; AD-24; UX-DR-023–024, UX-DR-037–040, UX-DR-085–086, UX-DR-091–093, UX-DR-118–120.

### Story 6.12: Make the Session browser safe and accessible across widths

As a developer  
I want to navigate and manage Sessions safely in the browser  
So that opening, inspecting, renaming, and deleting work predictably without relying on color, a wide terminal, or accidental focus.

**Acceptance Criteria**

- **Given** the Session browser is focused  
  **When** I use keyboard navigation  
  **Then** focus order supports list/search/sort, open, inspect, rename, and delete; focus is visible and deterministic; and focus never defaults to an irreversible action.
- **Given** I choose delete for a Session  
  **When** the confirmation surface opens  
  **Then** it requires typed confirmation matching the Session identity or name, discloses the cascade scope and non-sensitive tombstone outcome, and `Esc` dismisses without mutation.
- **Given** a Session has current, other, missing, or changed Workspace state, locked/corrupt data, interrupted output, unknown outcome, or incomplete deletion  
  **When** the browser renders it  
  **Then** status, reason, evidence completeness, authority posture, and valid next actions are explicit labels and headings, with no color-only or spinner-only meaning.
- **Given** the terminal is 40, 60, 80, or 120 columns wide, monochrome, resized, or using linearized assistive output  
  **When** the browser renders  
  **Then** rows remain semantically complete, technical identifiers remain intact or available through inspection, focus/selection remains distinguishable by text or layout, and no required action is hidden by truncation.
- **Given** Session metadata contains Thai prose, paths, URLs, hashes, commands, or provider identities  
  **When** it is presented  
  **Then** Thai explanations may localize the message while canonical English state tokens and technical identifiers remain exact/atomic, and credentials or raw sensitive payloads never appear.

**Requirements:** FR-26; FR-27; FR-28; NFR-2; NFR-9; NFR-10; AD-1–AD-3; AD-14; AD-24; UX-DR-006, UX-DR-015–016, UX-DR-021–024, UX-DR-037–040, UX-DR-098–100, UX-DR-104–109, UX-DR-118–120.

### Story 6.13: Project recovery-center outcomes consistently across output modes

As a developer  
I want interrupted-work recovery to expose the same secret-safe projection everywhere  
So that unresolved outcomes, identities, and recovery limits remain understandable in interactive and headless use.

**Acceptance Criteria**

- **Given** `/recover` has classified or reconciled an interrupted operation  
  **When** Ink, redirected text, linearized assistive output, monochrome output, or headless JSON is selected  
  **Then** each mode uses the same canonical fields and state tokens, including SessionId, PromptRoundId, OperationId, EventId where applicable, classification, known output, Evidence completeness, durable outcome, supported next action, and stable exit class/code.
- **Given** the operation is `not-sent`, `possibly-dispatched`, `response-started`, `unknown`, `not-reconciled`, or cleanup/recovery is incomplete  
  **When** the recovery center renders  
  **Then** the unresolved state is prominent, `Chat interrupted` and known output remain distinct from completion, and no message implies that an unproven remote action succeeded, failed, or was safely repeated.
- **Given** recovery output contains Thai prose, paths, URLs, hashes, provider identities, or sanitized diagnostics  
  **When** it crosses a display, accessibility, log, redirected, or JSON boundary  
  **Then** raw secrets and credential material are absent, technical identifiers remain exact/atomic, and only the permitted sanitized representation is emitted.
- **Given** a recovery action requires interactive authority or typed confirmation but no TTY is available  
  **When** the headless command is run  
  **Then** it fails closed with `blocked`, `next: rerun interactively`, and a stable exit class/code without reading secrets, consuming authority, retrying remote work, or mutating the Session.
- **Given** recovery projection or terminal-event persistence fails  
  **When** the result would otherwise be emitted  
  **Then** completion is withheld, the operation remains inspectable as incomplete/unknown, and no UI or headless surface hides the unresolved authority, cleanup limitation, or safe next step.

**Requirements:** FR-27; FR-28; FR-32; NFR-2; NFR-6; NFR-7; NFR-9; NFR-10; AD-1–AD-3; AD-14; AD-24; UX-DR-006, UX-DR-015–016, UX-DR-021–026, UX-DR-037–040, UX-DR-067–070, UX-DR-085–086, UX-DR-091–093, UX-DR-098–100, UX-DR-104–107, UX-DR-118–120.

**Traceability and scope verification:** This Epic contains 13 contiguous stories (6.1–6.13). FR-26 is covered by Stories 6.1, 6.2, 6.9, 6.10, and 6.12; FR-27 by Stories 6.1, 6.2, 6.3, 6.4, 6.6, 6.9–6.13; FR-28 by Stories 6.1, 6.2, 6.3–6.5, 6.9, 6.11–6.13; and FR-32 by Stories 6.6–6.8, 6.11, and 6.13. The only restored records are the base Session/transcript/events/provider/mode/Workspace records, Specialist Evidence/cache references, context pins/manifests/compaction/usage records, and checkpoint lineage/rollback records established in Epics 1–5. Unknown valid extension versions are preserved in versioned envelopes and are never required for restore. Credentials, cloud sync, export/import, cross-device migration, recovery archives, copied source files, future record kinds, and future epics are not dependencies.

## Epic 7: Certify and Govern the Public Release

A maintainer can issue an evidence-based go/no-go decision using explicit repository governance, security reporting, sensitive-data policy, exact model pins, numeric performance budgets, platform enforcement, packaging validation, cross-platform certification, UX/accessibility audits, Specialist contract evidence, and named waiver authority. This epic adds no product FRs; it verifies the relevant NFRs, deferred PRD and architecture decisions, cross-cutting release gates, and evidence attached to FR-1–FR-39. Product behavior already exists from the preceding epics; these stories define governance artifacts, decision records, fixtures, audits, and certification evidence rather than new runtime scope.

**Reclassification (from the Sprint Change Proposal):** Epic 7 is a release-governance/certification workstream, not a normal product epic. Implementation prerequisites PR-1, PR-2, PR-3, and PR-4 (see the Pre-Implementation Gate section) are approved **before** their consuming feature epics begin; they are not first defined inside Epic 7. Stories 7.2, 7.3, and 7.6 therefore certify already-approved artifacts rather than deciding them. The remaining work verifies release compliance, evidence, and go/no-go authorization.

**Story sizing:** Stories flagged as oversized in the readiness report (7.7, 7.13, 7.17, 7.18–7.20, 7.22) are decomposed into independently owned evidence producers followed by small aggregate manifest/gate stories that consume already completed evidence. The exact decomposition is recorded in the per-story acceptance criteria; the high-level epic structure below preserves the original story identifiers as anchors for traceability while permitting sub-story splitting during implementation.

**FRs covered:** No new product FRs; this epic verifies FR-1 through FR-39 and NFR-1 through NFR-15.

### Story 7.1: Establish public repository governance and private security reporting

As a maintainer  
I want repository authority, contribution, support, and security-reporting rules recorded before publication  
So that the public project has an accountable operating model and vulnerabilities are not disclosed first through public issues.

**Acceptance Criteria**

- **Given** the repository is intended for public MIT distribution  
  **When** the release-governance package is prepared  
  **Then** it names the maintainer/release owner, defines who can approve releases and waivers, records the MIT/public positioning, and explicitly prohibits unsupported claims such as coding parity with another product or being the first Thai CLI.
- **Given** a prospective contributor or maintainer  
  **When** they inspect the governance artifact  
  **Then** it specifies contribution eligibility, pull-request and review requirements, required tests/evidence, code-of-conduct/reporting contact, supported environments, support boundaries, expected response targets, and unsupported platforms/features without the words `actionable` or `appropriate` as acceptance criteria.
- **Given** a security researcher finds a vulnerability before the public repository is opened  
  **When** they follow the documented route  
  **Then** a private security mailbox or equivalent private intake route, triage owner, acknowledgement target, severity/classification fields, disclosure/coordination process, and emergency maintainer contact are usable without requiring a public issue or exposing secrets.
- **Given** the public repository is opened  
  **When** governance checks run  
  **Then** the repository contains the approved governance, contribution, support, license, and private-security references, each has an owner and review date, and publication fails if the private route is missing, unreachable, or points only to public disclosure.

**Requirements:** No new FRs; NFR-2, NFR-3, NFR-7, NFR-15; Additional Requirement 76, Additional Requirement 78; UX-DR-007, UX-DR-010, UX-DR-120.

### Story 7.2: Certify the approved sensitive-data and Remote Data Authority policy

As a maintainer  
I want the already-approved sensitive-data policy certified as a release gate  
So that Specialist transfers and cached Evidence have an explicit release-evidence record rather than a deferred gate.

**Reclassification (from the Sprint Change Proposal):** The sensitive-data and Remote Data Authority policy is approved as implementation prerequisite **PR-2** (PRD §12.1, Architecture AD-26.1) **before Epic 4 begins**. Story 7.2 certifies the already-approved policy and records release evidence; it does not define the policy for the first time. Implementation of Specialist transfers and cache reuse has already operated against the approved policy since Epic 4.

**Acceptance Criteria**

- **Given** the approved policy matrix is in force for Epic 4 implementation  
  **When** the policy is reviewed for release certification  
  **Then** it classifies code, documents, extracted text, images, audio, filenames, tool output, credentials, paths, metadata, Specialist results, and cached Evidence into named classes with transfer eligibility, required consent level, prohibited fields, transformation rules, and exact blocking behavior.
- **Given** a transfer-consent screen is rendered  
  **When** a selected artifact is prepared  
  **Then** the approved copy names purpose, receiving service, verified endpoint, method, payload classification/summary, transformations, retention and deletion handling (where the verified provider contract supports a deletion lifecycle), call count, expiry, payload digests, and the fact that credentials and unresolved local paths are excluded; user consent is bound to the exact prepared manifest and bytes.
- **Given** local transcript, Session, Evidence, checkpoint, or cache data is created  
  **When** retention and deletion rules are applied  
  **Then** the policy gives exact default retention, maximum retention, deletion trigger, deletion cascade, cache invalidation rule, and non-sensitive tombstone rule for each data class, including the five-prompt checkpoint window and the policy for expired Specialist cache entries.
- **Given** an upstream provider receives a permitted payload  
  **When** release evidence is collected  
  **Then** the evidence identifies the provider's documented retention/no-retention and deletion behavior (conditional on the verified provider contract supporting it), contract/version/date, source URL or signed provider statement, owner, and verification date; an unverifiable provider claim blocks that service from public enablement or records a named waiver that cannot override a mandatory privacy prohibition.
- **Given** the approved policy matrix was made a prerequisite before Epic 4 rather than a deferred release gate  
  **When** Product and Security sign the certification  
  **Then** the certification records release evidence for the already-approved policy, marks the PRD gate resolved, and confirms no later story re-decided it.

**Requirements:** FR-15–FR-18, FR-25–FR-27, FR-35, FR-38–FR-39; NFR-1, NFR-2, NFR-4, NFR-7, NFR-8; AD-26, AD-26.1, AD-27; Additional Requirements 28–31, Additional Requirements 55–56, Additional Requirements 65–66, Additional Requirement 76; UX-DR-029, UX-DR-090–093, UX-DR-102–103, UX-DR-120.  
**dependsOn:** PR-2; Epic 4 stories 4.10–4.20 (consumes already produced transfer evidence).

### Story 7.3: Certify product and architecture traceability decisions

As a release owner  
I want conflicts and superseded assumptions certified as signed decisions  
So that certification cannot rely on silent ambiguity or obsolete hosted, Windows-only, or demo-only premises.

**Reclassification (from the Sprint Change Proposal):** The invalid structured-proposal conflict is resolved by implementation prerequisite **PR-1** (PRD §12.1, Architecture AD-14) before Epic 3 begins. Story 7.3 certifies the already-signed decision; it does not decide the behavior for the first time. Implementation of Stories 1.9, 3.9, and 4.9 has already operated under the approved PR-1 rule.

**Acceptance Criteria**

- **Given** the PRD and Architecture previously allowed conflicting interpretations of invalid structured-proposal behavior  
  **When** the Product Owner and Architecture owner sign the certification  
  **Then** the certification record states that PR-1 has been approved before Epic 3, names the selected normative behavior (rejection after one local schema-validation pass; no model repair request, provider retry, protocol reinterpretation, action substitution, or policy relaxation), the validation boundary, terminal outcome, and migration impact; no implementation or test may infer the answer from wording left unresolved.
- **Given** earlier documents assume hosted execution, Windows-only support, compatibility layers, or demo-only proof  
  **When** the traceability ledger is completed  
  **Then** each assumption is labeled `superseded`, `retained`, or `out of Release 1`, linked to the authoritative PRD/addendum/architecture decision, and mapped to the current direct-local, native Windows plus macOS, C++ proof, Typhoon-only scope.
- **Given** a requirement, architecture rule, or UX commitment is checked for release  
  **When** the ledger is audited  
  **Then** it points to an FR/NFR/AD/UX requirement, owning story, evidence artifact, decision owner, status, and blocking condition; missing or contradictory mappings fail the gate rather than being inferred.
- **Given** the certification is not approved  
  **When** integration freeze or certification begins  
  **Then** the release status is `blocked`, the unresolved wording is named, and no story claims compliance based on a selected behavior that lacks the signed decision.

**Requirements:** FR-6, FR-10, FR-12, FR-24, FR-32, FR-38; NFR-7, NFR-13, NFR-15; AD-16; UX-DR-007–010, UX-DR-120.

### Story 7.4: Freeze the Typhoon model and wire contract

As a release owner  
I want the exact Typhoon model, endpoint, wire contract, and adapter pinned before integration freeze  
So that health, dispatch, Evidence, and certification refer to one reproducible upstream configuration.

**Acceptance Criteria**

- **Given** the launch Typhoon provider configuration is selected  
  **When** integration freeze is approved  
  **Then** release Evidence records the exact model ID, effective HTTPS endpoint and origin allowlist, request/response wire contract version and checksum, adapter package/version/commit, authentication header placement, timeout, streaming/framing rules, health-check request, and date/owner of verification.
- **Given** a model, endpoint, contract, adapter, or mapping changes  
  **When** the release candidate is built  
  **Then** the build fails or produces a new release candidate identity; no silent fallback, provider substitution, protocol reinterpretation, or unrecorded configuration override is allowed.
- **Given** a clean environment with the pinned configuration  
  **When** deterministic contract fixtures and a live Typhoon smoke test run  
  **Then** the fixture validates serialization, streaming, malformed response handling, health generation, sanitization, and no-retry behavior, while the live test records effective generation, response correlation, timing, sanitized outcome, and upstream observation without storing credentials.
- **Given** the live upstream test fails  
  **When** the release matrix evaluates it  
  **Then** deterministic fixtures remain separately reportable, the live test is retried exactly twice after the defined backoff, transient failure is classified as an external blocker rather than converted to pass, and release remains blocked unless the named waiver authority approves a time-bounded non-mandatory waiver.

**Requirements:** FR-2, FR-4, FR-6, FR-32, FR-38–FR-39; NFR-6, NFR-7, NFR-12, NFR-15; AD-9, AD-13; UX-DR-008, UX-DR-120.

### Story 7.5: Set numeric NFR-14 performance budgets and waiver ownership

As a release owner  
I want numeric budgets with reproducible test conditions  
So that NFR-14 is measurable and a timing result cannot be declared compliant without a defined baseline.

**Acceptance Criteria**

- **Given** NFR-14 is unresolved  
  **When** the Product Owner approves the budget record  
  **Then** it defines p50 and p95 budgets, timeout/failure thresholds, warm/cold conditions, sample count, retry policy, measurement boundary, and required evidence for startup, TUI response, Typhoon health, Prompt Round, compaction, Session restore, and each of the four Specialist Services.
- **Given** performance tests run  
  **When** results are collected  
  **Then** the record identifies CPU, RAM, disk, network, terminal, locale/UTF-8, Node version, exact model/service configuration, payload sizes, context size, cache state, clean/warm state, and supported OS/platform; Prompt Round duration is the user-visible metric and subsystem timings are diagnostic.
- **Given** the supported baseline  
  **When** the matrix is executed  
  **Then** Node 24 LTS is tested on Windows 11 25H2+ with Windows Terminal/PowerShell via `pwsh.exe`, macOS 14+ with Terminal/zsh, and the newest stable supported OS release for each platform; Node 22 compatibility is separately reported where required.
- **Given** a budget is exceeded or the test condition is incomplete  
  **When** the release ledger is generated  
  **Then** the result is `fail` or `not measured`, not pass; only the named Product Owner may issue a waiver with metric, measured value, cause, user impact, mitigation, expiry/retest date, and affected FR/NFR, and mandatory safety, privacy, enforcement, or integrity gates cannot be waived.

**Requirements:** FR-1, FR-4, FR-20, FR-26–FR-32, FR-39; NFR-6, NFR-10, NFR-12, NFR-13, NFR-14; AD-25; UX-DR-120.

### Story 7.6: Certify the approved versioned Windows/macOS platform-action enforcement matrix

As a release owner  
I want release certification of the already-approved platform/action enforcement matrix  
So that every supported effect is verified against the matrix Epic 3 already implemented against, and unsupported enforcement fails closed.

**Reclassification (from the Sprint Change Proposal):** The platform/action enforcement matrix is approved as implementation prerequisite **PR-3** (PRD §12.1, Architecture AD-12) **before Epic 3 begins**. Story 7.6 certifies the already-approved matrix and records release evidence; it does not define or publish the matrix for the first time. Epic 3 implementation has already operated against the approved matrix.

**Acceptance Criteria**

- **Given** the approved platform/action matrix is in force for Epic 3 implementation  
  **When** the matrix is certified for release  
  **Then** it has separate Windows and macOS rows for file list/read/search/write/delete/recursive delete, workspace containment, symlink/junction/mount, case/Unicode/rename/TOCTOU, executable/argv/cwd/environment, process-tree timeout/cancel, credential facility, network origin/redirect/TLS, transfer consent, Boundary Expansion, and rollback-disabled/external effects.
- **Given** each matrix cell is evaluated  
  **When** the enforcement mechanism is available  
  **Then** the fixture records platform/build, mechanism/version, input identity, policy decision (`allow`, `ask`, or `deny`), authorization digest, effect-time revalidation, terminal result, and sanitized Evidence; an unavailable mechanism yields `deny`/`blocked` before preparation or dispatch.
- **Given** a path changes through a symlink, junction, mount, rename, case variant, Unicode variant, or concurrent writer  
  **When** the effect starts  
  **Then** canonical identity and expected digest/version are revalidated and the operation returns conflict or denial without mutation when the contract no longer holds.
- **Given** a command times out or cancellation is requested  
  **When** the process fixture ends  
  **Then** the entire child process tree is confirmed absent, the operation has the correct cancellation/unknown-outcome state, no uncontrolled network or credential access occurred, and no orphan process remains.
- **Given** a matrix cell is unsupported, untested, or contradictory  
  **When** certification is assembled  
  **Then** that cell is a release blocker and cannot be hidden under a platform-wide pass claim.

**Requirements:** FR-7–FR-12, FR-16, FR-22–FR-25, FR-33–FR-35; NFR-3, NFR-4, NFR-5, NFR-7, NFR-13; AD-12, AD-20, AD-24; UX-DR-098–100, UX-DR-120.  
**dependsOn:** PR-3; Epic 3 stories 3.1, 3.7, 3.11 (consumes already produced effect evidence).

### Story 7.7: Verify protocol, schema, store, migration, key, checkpoint, and deletion compatibility

As a developer  
I want versioned compatibility fixtures for every durable lifecycle  
So that a release cannot pass with mismatched schemas, unrecoverable migrations, unsafe key rotation, or incomplete deletion.

**Acceptance Criteria**

- **Given** CoreProtocolV1, event/Evidence schemas, StoreFormatVersion, journal, projections, artifact envelopes, and checkpoint envelopes exist  
  **When** shared fixture tests run across UI, CoreApp, persistence, and adapters  
  **Then** valid fixtures round-trip byte/schema compatibility, unknown variants and incompatible major versions fail closed, and schemas are versioned independently from external telemetry/export formats.
- **Given** a store is upgraded, interrupted, checksum-invalid, partially staged, or opened with an incompatible version  
  **When** migration/recovery fixtures execute  
  **Then** checksum, progress, restartability/reversibility, read-only lock behavior, staged-data cleanup, unknown-outcome preservation, and no side-effect replay are proven with kill points before and after each commit boundary.
- **Given** a data-encryption key is rotated, missing, mismatched, or interrupted  
  **When** key lifecycle fixtures execute  
  **Then** every durable store is staged and verified before atomic promotion, old key material is retained until safe cleanup, authenticated metadata and key version are checked, and failure enters locked recovery without replacement keys or plaintext fallback.
- **Given** a checkpoint is created, retained, over-cap, expired, corrupted, or rolled back concurrently  
  **When** checkpoint fixtures execute  
  **Then** the 100 MB per-checkpoint and 500 MB store caps, five-prompt default window, encrypted originals, conflict-safe post-image comparison, and excluded-effect labels are proven; incomplete checkpoints are never reported complete.
- **Given** a Session is deleted  
  **When** deletion lifecycle fixtures run through crash and restart points  
  **Then** the tombstone immediately hides the aggregate and cascades through transcript/events, context manifests, usage, checkpoints, projections, Evidence, caches, WAL/temp material, and zero-reference sensitive artifacts, retaining only the specified non-sensitive audit tombstone and never reviving partial cleanup.

**Requirements:** FR-26–FR-35, FR-38–FR-39; NFR-1, NFR-2, NFR-6, NFR-7, NFR-15; AD-3, AD-6, AD-13, AD-20–AD-21

### Story 7.8: Verify AI-for-Thai manifests, contracts, and Specialist smoke evidence

As a release owner  
I want deterministic Specialist fixtures and separately governed live smoke tests  
So that the four launch services are evidenced without turning certification into new product implementation.

**Acceptance Criteria**

- **Given** the bundled Capability Registry manifest is reviewed  
  **When** manifest validation runs  
  **Then** T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition each have stable IDs, endpoint/transport, normalized input/output schema, modality and limits, entitlement/quota behavior, privacy classification, credential group, timeout/retry policy, adapter version, observation date, source, contract version, and latest test result; all other entries remain `Catalogued — Not available yet` and non-invokable.
- **Given** deterministic offline fixtures are available  
  **When** contract tests run  
  **Then** each service covers valid response mapping, empty fields, uncertainty, malformed response, auth/configuration/protocol failure, timeout, quota, unsupported input, sanitization, source hash/provenance, cache identity, consent digest, stale health, force-fresh, and shared AI-for-Thai credential failure without contacting an upstream.
- **Given** live upstream smoke tests are enabled with test-safe artifacts and credentials  
  **When** each service is tested  
  **Then** the result records endpoint, effective configuration generation, request contract, source hash, returned fields, timing, sanitized response, consent reference, and provider observation; it retries exactly twice only for the defined transient classes and never treats a model explanation or cached result as live success.
- **Given** a live service test fails or upstream is unavailable  
  **When** the release matrix evaluates the service  
  **Then** offline contract status remains distinct, the failure category/scope is recorded, no service is silently substituted or quarantined after one transient failure, and public enablement is blocked unless the service-specific waiver authority approves a documented, expiring waiver; shared-key rejection blocks all four services.

**Requirements:** FR-3, FR-4, FR-13–FR-20, FR-25, FR-38; NFR-4, NFR-6, NFR-7, NFR-8, NFR-12, NFR-15; Additional Requirements 57–67, Additional Requirements 76–78; UX-DR-008–010, UX-DR-101–103, UX-DR-120.

### Story 7.9: Validate npm package ownership, lifecycle, and dependency integrity

As a release owner  
I want the published npm package and installation lifecycle verified  
So that users receive the intended `thcode` binary with supported engines and reproducible dependencies.

**Acceptance Criteria**

- **Given** the package is prepared for publication  
  **When** package metadata is inspected  
  **Then** ownership, package name/version, MIT license, repository/homepage/bug and security links, files allowlist, `bin.thcode`, engines `node >=22`, exports/types, provenance/source reference, and absence of secrets/build debris are validated against the release manifest.
- **Given** the lockfile and dependency graph are evaluated  
  **When** integrity checks run  
  **Then** the committed lockfile is current, registry integrity hashes verify, lifecycle scripts and bundled executables are reviewed, dependency licenses/advisories are recorded, undeclared runtime imports fail the check, and `npm pack --dry-run` contains only approved files.
- **Given** a clean machine with Node 22 and Node 24 LTS  
  **When** global install, launch, update, uninstall, reinstall, and first-run fixtures run  
  **Then** each lifecycle has recorded commands, package version, exit class/code, binary resolution, no implicit secret/effect, and expected retention of user data/OS credentials; update and uninstall do not claim to delete data they do not delete.
- **Given** a dependency has a native module or platform-specific binary  
  **When** package validation runs on Windows and macOS  
  **Then** install, load, and runtime compatibility are proven for Node 22 and Node 24, with compiler/toolchain prerequisites recorded separately from product failures; failed native validation blocks publication.

**Requirements:** FR-1, FR-2, FR-11, FR-26; NFR-1, NFR-2, NFR-6, NFR-11, NFR-15; AD-1, AD-23; UX-DR-001–004, UX-DR-098–100, UX-DR-120.

### Story 7.10: Certify the Windows clean-install, credential, and Thai baseline

As a release owner  
I want the Windows clean-machine baseline verified before effect certification  
So that package, startup, credential, encryption, Thai, and compiler prerequisites are proven on the supported Windows release.

**Acceptance Criteria**

- **Given** a clean Windows 11 25H2+ machine using Windows Terminal and PowerShell through `pwsh.exe`, with Node 24 LTS  
  **When** the release candidate is installed from npm  
  **Then** package ownership/lifecycle, startup preflight, binary resolution, detected platform/shell/Node version, and no implicit effect are recorded before feature tests begin.
- **Given** first-run credential and store setup is exercised  
  **When** Typhoon onboarding initializes Windows Credential Manager and the encrypted local store  
  **Then** credential identity/host binding, key reference, encryption/key version, sanitization, no-secret output, and failure-locked behavior are verified without persisting a secret in product data.
- **Given** Thai and mixed Thai-English input is entered through the supported terminal  
  **When** IME preedit, committed text, technical identifiers, graphemes, UTF-8 persistence, redirected output, and cell-width rendering are tested  
  **Then** bytes and identifiers remain intact, preedit cannot submit accidentally, and any failure is recorded with the exact terminal/locale/input fixture.
- **Given** the C++ proof fixture is run  
  **When** thcode creates the source, compiles, executes, and verifies it  
  **Then** compiler identity/version, exact command/cwd/argv, exit code 0, stdout containing `Hello, World!`, output encoding, timing, and post-test process-tree cleanup are recorded; missing C++ is a prerequisite blocker, not a source pass.
- **Given** any mandatory baseline fixture fails  
  **When** Windows certification proceeds  
  **Then** the baseline is `fail` or `blocked` with fixture ID, evidence path, owner, and remediation; no later Windows story or aggregate release claim may treat it as passed.

**Requirements:** FR-1–FR-5, FR-11–FR-12, FR-25–FR-28, FR-38–FR-39; NFR-1, NFR-2, NFR-6, NFR-9, NFR-11, NFR-12, NFR-15; Additional Requirements 1, 20–21, 41–44, 52–56; UX-DR-002–004, UX-DR-025, UX-DR-090–100, UX-DR-119–120.

### Story 7.11: Certify Windows platform effects and process safety

As a release owner  
I want Windows effect enforcement and process cleanup tested independently  
So that unsupported or changed resources fail closed before a local or remote effect.

**Acceptance Criteria**

- **Given** the Windows row of the versioned platform/action matrix is available from Story 7.6  
  **When** file list/read/search/write/delete/recursive-delete, workspace containment, junction/symlink/mount, case/Unicode/rename, and concurrent-writer fixtures run  
  **Then** canonical identity, expected digest/version, lock/compare-and-apply, descendant manifest, and effect-time revalidation are recorded; changed or unsupported targets return conflict/deny without mutation.
- **Given** Windows command and process fixtures run  
  **When** executable identity, argv, cwd, environment, timeout, cancellation, and child-process-tree behavior are tested  
  **Then** allow/ask/deny, authorization digest, dispatch state, cancellation/unknown-outcome classification, and proof that no orphan process remains are recorded.
- **Given** Windows credential, network, redirect/TLS, transfer-consent, Boundary Expansion, and rollback-excluded-effect paths are exercised  
  **When** a required enforcement mechanism is absent or inconsistent  
  **Then** the path denies/blocks before preparation or dispatch and records sanitized Evidence rather than silently weakening policy.
- **Given** a matrix cell is unsupported, untested, or contradictory  
  **When** Windows certification is assembled  
  **Then** that cell is a release blocker and cannot be hidden under a platform-wide pass claim.

**Requirements:** FR-7–FR-10, FR-16, FR-22–FR-25, FR-33–FR-35; NFR-3, NFR-4, NFR-5, NFR-7, NFR-13; Additional Requirements 34–40, Additional Requirements 68–70; UX-DR-098–100, UX-DR-120.

### Story 7.12: Certify Windows Specialist journeys

As a release owner  
I want Windows Specialist journeys certified after baseline and effect safety pass  
So that each launch service is evidenced through the supported consent, health, routing, and result paths.

**Acceptance Criteria**

- **Given** Stories 7.10 and 7.11 pass and the pinned Typhoon/Specialist configurations are available  
  **When** Windows UJ-1 first use, UJ-2 catalog and consent, and UJ-3 unhealthy-service recovery run  
  **Then** each journey records PromptRoundId/OperationId, selected service and rationale, endpoint/configuration generation, credential-group boundary, consent/cache evidence, authority transitions, deterministic failure category, retry count, and terminal outcome.
- **Given** T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition are exercised on Windows  
  **When** deterministic offline fixtures and permitted live smoke tests run  
  **Then** source hash, input classification, returned fields including empty/uncertain fields, provenance, timing, cache observation, and sanitized upstream evidence are recorded; offline and live results remain separate.
- **Given** a Specialist entitlement, quota, unsupported-input, transient network, health, auth, or protocol failure occurs  
  **When** Windows recovery is rendered  
  **Then** the smallest proven service/configuration scope is unavailable or quarantined, no service is silently substituted, one transient failure does not quarantine, and only explicit retest or supported recovery actions are offered.
- **Given** any mandatory Windows Specialist journey fails or upstream smoke is unavailable  
  **When** the integrated Specialist report is generated  
  **Then** the result is `fail`/`blocked` with fixture ID, evidence path, owner, and retry classification; release remains blocked unless an authorized, expiring non-mandatory waiver applies.

**Requirements:** FR-3–FR-4, FR-13–FR-20, FR-25, FR-38; NFR-4, NFR-6–NFR-8, NFR-12, NFR-15; AD-9; UX-DR-008–010, UX-DR-101–103, UX-DR-120.

### Story 7.13: Certify Windows Session, context, and rollback continuity

As a release owner  
I want Windows continuity and recovery journeys certified separately from Specialist calls  
So that durable state, context, interruption, and rollback guarantees are not hidden inside a broad demo.

**Acceptance Criteria**

- **Given** Windows baseline and platform-effect stories pass  
  **When** UJ-4 bounded C++ task, UJ-5 Session resume, and UJ-6 interrupted remote recovery run  
  **Then** the report records verification output, restored transcript/Evidence/context/usage/checkpoint lineage, missing or changed Workspace behavior, Manual reset, compaction decisions, durable chunks, `Chat interrupted`, unknown-outcome state, and no-automatic-retry behavior.
- **Given** Windows UJ-7 safe rollback runs  
  **When** built-in create/edit/delete, later edits, conflicts, deleted targets, checkpoint expiry, and excluded shell/remote/symlink effects are tested  
  **Then** full, partial, blocked, expired, and excluded results are labeled accurately using current post-image comparison, and no blind overwrite or unsupported rollback claim is made.
- **Given** a crash, kill point, incomplete checkpoint, migration issue, deletion cascade, or restore mismatch occurs  
  **When** Windows recovery fixtures restart the product  
  **Then** incomplete state is detectable, no side effect is replayed, deleted sessions stay hidden, credentials stay absent, and the operation has one durable terminal/reconciliation outcome.
- **Given** any mandatory Windows continuity journey fails  
  **When** certification is assembled  
  **Then** Windows remains `fail`/`blocked` with exact owner, evidence, remediation, and re-test condition; it cannot be converted to a Specialist or macOS pass.

**Requirements:** FR-6, FR-8–FR-12, FR-26–FR-35, FR-38–FR-39; NFR-1–NFR-7, NFR-9, NFR-12–NFR-15; AD-3, AD-6, AD-13, AD-20–AD-21; UX-DR-104–105, UX-DR-109–117, UX-DR-119–120.

### Story 7.14: Certify the macOS clean-install, credential, and Thai baseline

As a release owner  
I want the macOS clean-machine baseline verified before effect certification  
So that package, startup, credential, encryption, Thai, and compiler prerequisites are proven independently on macOS.

**Acceptance Criteria**

- **Given** a clean macOS 14+ machine using Terminal and zsh, with Node 24 LTS  
  **When** the release candidate is installed from npm  
  **Then** package ownership/lifecycle, startup preflight, binary resolution, detected platform/shell/Node version, and no implicit effect are recorded before feature tests begin.
- **Given** first-run credential and store setup is exercised  
  **When** Typhoon onboarding initializes macOS Keychain and the encrypted local store  
  **Then** credential identity/host binding, key reference, encryption/key version, sanitization, no-secret output, and failure-locked behavior are verified without persisting a secret in product data.
- **Given** Thai and mixed Thai-English input is entered through the supported terminal  
  **When** IME preedit, committed text, technical identifiers, graphemes, UTF-8 persistence, redirected output, and cell-width rendering are tested  
  **Then** bytes and identifiers remain intact, preedit cannot submit accidentally, and any failure is recorded with the exact terminal/locale/input fixture.
- **Given** the C++ proof fixture is run  
  **When** thcode creates the source, compiles, executes, and verifies it  
  **Then** compiler identity/version, exact command/cwd/argv, exit code 0, stdout containing `Hello, World!`, output encoding, timing, and post-test process-tree cleanup are recorded; missing C++ is a prerequisite blocker, not a source pass.
- **Given** any mandatory baseline fixture fails  
  **When** macOS certification proceeds  
  **Then** the baseline is `fail` or `blocked` with fixture ID, evidence path, owner, and remediation; no later macOS story or aggregate release claim may treat it as passed.

**Requirements:** FR-1–FR-5, FR-11–FR-12, FR-25–FR-28, FR-38–FR-39; NFR-1, NFR-2, NFR-6, NFR-9, NFR-11, NFR-12, NFR-15; AD-1, AD-20–AD-21, AD-23–AD-24; UX-DR-002–004, UX-DR-025, UX-DR-090–100, UX-DR-119–120.

### Story 7.15: Certify macOS platform effects and process safety

As a release owner  
I want macOS effect enforcement and process cleanup tested independently  
So that unsupported or changed resources fail closed before a local or remote effect.

**Acceptance Criteria**

- **Given** the macOS row of the versioned platform/action matrix is available from Story 7.6  
  **When** file list/read/search/write/delete/recursive-delete, workspace containment, symlink/mount, case/Unicode/rename, and concurrent-writer fixtures run  
  **Then** canonical identity, expected digest/version, lock/compare-and-apply, descendant manifest, and effect-time revalidation are recorded; changed or unsupported targets return conflict/deny without mutation.
- **Given** macOS command and process fixtures run  
  **When** executable identity, argv, cwd, environment, timeout, cancellation, and child-process-tree behavior are tested  
  **Then** allow/ask/deny, authorization digest, dispatch state, cancellation/unknown-outcome classification, and proof that no orphan process remains are recorded.
- **Given** macOS credential, network, redirect/TLS, transfer-consent, Boundary Expansion, and rollback-excluded-effect paths are exercised  
  **When** a required enforcement mechanism is absent or inconsistent  
  **Then** the path denies/blocks before preparation or dispatch and records sanitized Evidence rather than silently weakening policy.
- **Given** a matrix cell is unsupported, untested, or contradictory  
  **When** macOS certification is assembled  
  **Then** that cell is a release blocker and cannot be hidden under a platform-wide pass claim.

**Requirements:** FR-7–FR-10, FR-16, FR-22–FR-25, FR-33–FR-35; NFR-3–NFR-5, NFR-7, NFR-13; AD-20, AD-24; UX-DR-098–100, UX-DR-120.

### Story 7.16: Certify macOS Specialist journeys

As a release owner  
I want macOS Specialist journeys certified after baseline and effect safety pass  
So that each launch service is evidenced through the supported consent, health, routing, and result paths.

**Acceptance Criteria**

- **Given** Stories 7.14 and 7.15 pass and the pinned Typhoon/Specialist configurations are available  
  **When** macOS UJ-1 first use, UJ-2 catalog and consent, and UJ-3 unhealthy-service recovery run  
  **Then** each journey records PromptRoundId/OperationId, selected service and rationale, endpoint/configuration generation, credential-group boundary, consent/cache evidence, authority transitions, deterministic failure category, retry count, and terminal outcome.
- **Given** T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition are exercised on macOS  
  **When** deterministic offline fixtures and permitted live smoke tests run  
  **Then** source hash, input classification, returned fields including empty/uncertain fields, provenance, timing, cache observation, and sanitized upstream evidence are recorded; offline and live results remain separate and no Windows result is reused.
- **Given** a Specialist entitlement, quota, unsupported-input, transient network, health, auth, or protocol failure occurs  
  **When** macOS recovery is rendered  
  **Then** the smallest proven service/configuration scope is unavailable or quarantined, no service is silently substituted, one transient failure does not quarantine, and only explicit retest or supported recovery actions are offered.
- **Given** any mandatory macOS Specialist journey fails or upstream smoke is unavailable  
  **When** the integrated Specialist report is generated  
  **Then** the result is `fail`/`blocked` with fixture ID, evidence path, owner, and retry classification; release remains blocked unless an authorized, expiring non-mandatory waiver applies.

**Requirements:** FR-3–FR-4, FR-13–FR-20, FR-25, FR-38; NFR-4, NFR-6–NFR-8, NFR-12, NFR-15; AD-9; UX-DR-008–010, UX-DR-101–103, UX-DR-120.

### Story 7.17: Certify macOS Session, context, and rollback continuity

As a release owner  
I want macOS continuity and recovery journeys certified separately from Specialist calls  
So that durable state, context, interruption, and rollback guarantees are not hidden inside a broad demo.

**Acceptance Criteria**

- **Given** macOS baseline and platform-effect stories pass  
  **When** UJ-4 bounded C++ task, UJ-5 Session resume, and UJ-6 interrupted remote recovery run  
  **Then** the report records verification output, restored transcript/Evidence/context/usage/checkpoint lineage, missing or changed Workspace behavior, Manual reset, compaction decisions, durable chunks, `Chat interrupted`, unknown-outcome state, and no-automatic-retry behavior.
- **Given** macOS UJ-7 safe rollback runs  
  **When** built-in create/edit/delete, later edits, conflicts, deleted targets, checkpoint expiry, and excluded shell/remote/symlink effects are tested  
  **Then** full, partial, blocked, expired, and excluded results are labeled accurately using current post-image comparison, and no blind overwrite or unsupported rollback claim is made.
- **Given** a crash, kill point, incomplete checkpoint, migration issue, deletion cascade, or restore mismatch occurs  
  **When** macOS recovery fixtures restart the product  
  **Then** incomplete state is detectable, no side effect is replayed, deleted sessions stay hidden, credentials stay absent, and the operation has one durable terminal/reconciliation outcome.
- **Given** any mandatory macOS continuity journey fails  
  **When** certification is assembled  
  **Then** macOS remains `fail`/`blocked` with exact owner, evidence, remediation, and re-test condition; it cannot be converted to a Specialist or Windows pass.

**Requirements:** FR-6, FR-8–FR-12, FR-26–FR-35, FR-38–FR-39; NFR-1–NFR-7, NFR-9, NFR-12–NFR-15; AD-3, AD-6, AD-13, AD-20–AD-21; UX-DR-104–105, UX-DR-109–117, UX-DR-119–120.

### Story 7.18: Audit UX states, components, tokens, widths, and color modes

As a release owner  
I want the state catalog and visual contracts checked first  
So that every component remains semantically complete across supported terminal widths and themes.

**Acceptance Criteria**

- **Given** Windows Stories 7.10–7.13 and macOS Stories 7.14–7.17 have produced certification evidence, `ux-state-v1` contains 73 rows, and the canonical component inventory is available  
  **When** state/component fixtures run in Ink and redirected text  
  **Then** all 73 rows and every component are checked for status, warnings, activity, decision/result, composer, exact identifiers, terminal outcome, and canonical heading/order at 40, 60, 80, and 120 columns.
- **Given** dark, light, and no-color modes are rendered  
  **When** semantic tokens and focus/selection states are measured  
  **Then** the required dark/light mappings, contrast thresholds, non-color labels, focus distinction, and narrow-layout fallbacks pass without mixing theme tokens or relying on color alone.
- **Given** a component/state fixture fails  
  **When** the audit report is written  
  **Then** it names state/component, width/theme/output mode, expected result, observed result, owner, evidence, and release impact; no later audit story treats the item as passed.

**Requirements:** FR-21–FR-24, FR-36–FR-39; NFR-2, NFR-7, NFR-9, NFR-10, NFR-15; UX-DR-004–006, UX-DR-011–024, UX-DR-031–040, UX-DR-067–070, UX-DR-120.

### Story 7.19: Audit keyboard, focus, Thai IME, graphemes, streaming, and reduced motion

As a release owner  
I want interactive input and motion behavior tested independently  
So that keyboard authority, Thai composition, cancellation, and progress remain safe and usable.

**Acceptance Criteria**

- **Given** keyboard, focus, modal, resize, streaming, cancellation, and stale-approval scenarios run  
  **When** the audit executes at 40, 60, 80, and 120 columns  
  **Then** focus order, Esc semantics, Tab completion, Shift+Tab mode switch, approval invalidation, streaming boundaries, cancellation acknowledgement, and stale-authority refusal are recorded.
- **Given** Thai IME preedit, mixed scripts, combining marks, emoji/ZWJ graphemes, technical identifiers, and multiline input are entered  
  **When** submit, Esc, cursor, selection, wrapping, and cell-width behavior are exercised  
  **Then** preedit cannot submit accidentally, committed bytes remain unchanged, graphemes are not split by code unit, technical spans remain exact, and cell-width output matches the fixture.
- **Given** reduced-motion and no-animation settings are tested  
  **When** progress, health, interruption, and terminal outcomes render  
  **Then** labels and durable state carry meaning without a spinner, animation, or color being the sole signal, and timing/cancellation results remain attributable.
- **Given** an interaction fixture fails  
  **When** the audit report is written  
  **Then** it names the key sequence, IME/locale, width, expected/observed state, owner, evidence, and release impact.

**Requirements:** FR-5, FR-21–FR-24, FR-36–FR-39; NFR-7, NFR-9, NFR-10, NFR-12, NFR-13; AD-2, AD-7, AD-14, AD-24; UX-DR-025, UX-DR-041–060, UX-DR-071–075, UX-DR-080–090, UX-DR-116, UX-DR-120.

### Story 7.20: Audit linearized, headless, output-parity, secrecy, and Evidence behavior

As a release owner  
I want noninteractive and assistive output audited separately from visual interaction  
So that redirected, linearized, screen-reader-oriented, and JSON consumers receive the same safe truth.

**Acceptance Criteria**

- **Given** a screen reader or linearized consumer reads output  
  **When** warnings, transfer consent, Specialist results, deterministic Evidence, interruption, unknown outcome, rollback conflict, or cache reuse are rendered  
  **Then** reading order preserves the canonical ordered record and distinguishes explanation, progress, Evidence, and terminal outcome.
- **Given** Ink, redirected text, linearized output, and headless JSON consume the same fixture  
  **When** output parity is compared  
  **Then** state vocabulary, target/provider, operation identity, Evidence completeness, reason/cause, exit class/code, and next step match; output-mode differences do not change authority or outcome.
- **Given** secrets, raw prompts, commands, payloads, paths-as-authority, or unsafe environment data could reach output  
  **When** accessibility, logs, snapshots, stdout/stderr, and JSON are inspected  
  **Then** the values are absent or sanitized, credentials never appear, and omitted Evidence states name the omission reason.
- **Given** deterministic Evidence conflicts with model explanation  
  **When** the projection is rendered  
  **Then** deterministic category/provenance wins, contradiction is visible, and no completion or success label is emitted for uncertain work.
- **Given** an output/secrecy fixture fails  
  **When** the audit report is written  
  **Then** it names the mode, record, secret class or parity field, expected/observed result, owner, evidence, and release impact.

**Requirements:** FR-16–FR-20, FR-23–FR-25, FR-29–FR-39; NFR-1, NFR-2, NFR-4, NFR-7, NFR-8, NFR-9, NFR-10, NFR-13, NFR-15; AD-24, AD-26–AD-27; UX-DR-004–006, UX-DR-026–030, UX-DR-037–040, UX-DR-091–120.

### Story 7.21: Define and validate the release evidence-bundle schema

As a release owner  
I want a versioned evidence-bundle schema and validator  
So that every release claim is attributable, reproducible, and safe before assembly.

**Acceptance Criteria**

- **Given** evidence comes from governance, decisions, budgets, fixtures, package checks, platform certifications, Specialist tests, and UX audits  
  **When** the schema is approved  
  **Then** each entry defines version, release version/commit, immutable artifact ID/hash, source commit/build/package identity, test input/environment, timestamp, owner, reviewer, requirement IDs, result (`pass`, `fail`, `blocked`, `not measured`, or `waived`), evidence location, and blocker/waiver references.
- **Given** a bundle entry is validated  
  **When** the schema validator runs  
  **Then** missing fields, invalid result values, malformed hashes, stale source identity, contradictory status, duplicate artifact IDs, secrets, and raw prohibited payloads fail validation with entry ID and reason.
- **Given** internal event/Evidence schemas and external release metadata coexist  
  **When** compatibility fixtures run  
  **Then** internal versions remain independently versioned, unknown variants fail closed, and the validator records the schema version used without silently coercing records.
- **Given** schema validation fails  
  **When** downstream assembly is requested  
  **Then** no bundle is marked complete and no gate evaluator can consume it as release evidence.

**Requirements:** FR-38–FR-39; NFR-1–NFR-2, NFR-6–NFR-7, NFR-15; AD-3, AD-6, AD-13, AD-15; UX-DR-091–093, UX-DR-097–100, UX-DR-120.

### Story 7.22: Assemble the complete release evidence bundle

As a release owner  
I want all validated evidence assembled into one release manifest  
So that gate evaluation sees complete coverage without merging deterministic and live claims.

**Acceptance Criteria**

- **Given** Story 7.21 validates the bundle schema and Stories 7.1–7.20 have produced artifacts  
  **When** the assembly command runs  
  **Then** the manifest contains the 39-FR trace, 15-NFR trace, all deferred-decision records, governance/security policy, exact Typhoon model/endpoint/wire/adapter pin, numeric budget report, separate Windows and macOS certifications, package/dependency report, protocol/store/key/deletion report, Specialist manifest/contract/live-smoke report, UX audit reports, UJ-1–UJ-7 evidence, and SM1–SM4 plus countermetric results.
- **Given** live upstream smoke tests and deterministic offline fixtures both exist  
  **When** the manifest is assembled  
  **Then** they remain separate sections with their retry count and failure policy; no live availability, provider correctness, service entitlement, or unsupported coding-parity/first-Thai-CLI claim is inferred from offline fixtures or model prose.
- **Given** a required artifact is missing or fails schema validation  
  **When** assembly completes  
  **Then** the command returns `blocked`/`failed`, names the artifact and requirement, does not publish the manifest as complete, and leaves no secret-bearing copy.
- **Given** all required artifacts validate  
  **When** the manifest is sealed  
  **Then** it records a deterministic bundle hash, source release identity, assembly tool/version, timestamp, and immutable artifact index for the gate evaluator.

**Requirements:** FR-1–FR-39; NFR-1–NFR-15; UX-DR-001–010, UX-DR-090–120.

### Story 7.23: Evaluate the release gate policy

As a release owner  
I want a deterministic gate evaluator  
So that every mandatory release condition produces an explicit pass or blocking status before any waiver is considered.

**Acceptance Criteria**

- **Given** the sealed evidence bundle exists  
  **When** the gate evaluator runs  
  **Then** every FR, NFR, deferred decision, model pin, governance artifact, package check, Windows/macOS certification, Specialist check, UX audit, UJ, SM, and countermetric has a status of `pass`, `fail`, `blocked`, `not measured`, or `unresolved` with owner and evidence reference.
- **Given** a mandatory gate is `fail`, `blocked`, `not measured`, or `unresolved`  
  **When** policy evaluation completes  
  **Then** the aggregate status is `NO-GO`, the exact gate and remediation/re-test condition are listed, and publication is not authorized.
- **Given** all mandatory gates pass  
  **When** policy evaluation completes  
  **Then** the aggregate result is `GO-ELIGIBLE`, but no publication signature is created by this story and no waiver is assumed.
- **Given** the bundle is stale, tampered with, or not sealed by Story 7.22  
  **When** the evaluator runs  
  **Then** it returns `blocked` and does not infer status from prior evaluation output.

**Requirements:** FR-1–FR-39; NFR-1–NFR-15; UX-DR-007–010, UX-DR-090–120.

### Story 7.24: Validate waiver eligibility and authority

As a maintainer  
I want waiver requests checked against named authority and non-waivable gates  
So that exceptions cannot conceal unresolved safety, privacy, integrity, or truthful-outcome failures.

**Acceptance Criteria**

- **Given** a failed, blocked, or not-measured finding is proposed for waiver  
  **When** waiver validation runs  
  **Then** it requires the named authority from the applicable governance, budget, sensitive-data, or certification decision, scope, rationale, measured evidence, cause, user impact, mitigation, expiry, re-test date, and affected requirements; missing or expired fields reject the request.
- **Given** a proposed waiver concerns privacy, credential secrecy, fail-closed enforcement, crash consistency, schema integrity, truthful outcomes, unresolved security reporting, or unsupported platform/action  
  **When** eligibility is evaluated  
  **Then** it is rejected as non-waivable and the gate remains blocking.
- **Given** an eligible waiver is approved  
  **When** it is attached to the evidence bundle  
  **Then** the approval identity, authority scope, expiry, re-test condition, and exact affected evidence are immutable and the gate evaluator can distinguish `waived` from `pass`.
- **Given** a waiver is unauthorized, expired, out of scope, or contradicts a newer decision  
  **When** final gate inputs are prepared  
  **Then** it is rejected and the aggregate result remains `NO-GO`.

**Requirements:** FR-1–FR-39; NFR-1–NFR-15; UX-DR-007–010, UX-DR-090–120.

### Story 7.25: Sign and publish or refuse the final go/no-go decision

As a maintainer  
I want publication to follow the already validated gate result  
So that one named authority signs only a complete, eligible release decision.

**Acceptance Criteria**

- **Given** the gate evaluator returns `NO-GO`, or an eligible waiver is missing/invalid  
  **When** the maintainer attempts to sign or publish  
  **Then** the operation is refused, records the exact blocking gates and owners, and leaves package/repository publication disabled.
- **Given** the gate evaluator returns `GO-ELIGIBLE` and waiver validation has accepted all attached waivers  
  **When** the named maintainer/release owner signs  
  **Then** the decision records release version/commit, supported OS and Node baselines, sealed evidence-bundle hash, gate-policy version, waiver references, timestamp, and signer identity, and permits the approved publication action.
- **Given** a signed release is published  
  **When** the public decision is inspected  
  **Then** it preserves MIT/public positioning, identifies native Windows/macOS and Node 24 clean baselines, states upstream availability/entitlement/quota/correctness remain external dependencies, and makes no unsupported coding-parity or first-Thai-CLI claims.
- **Given** any signed input changes after signing  
  **When** publication automation detects the change  
  **Then** the signature and publication authorization are invalidated and a new validated gate result and signature are required.

**Requirements:** FR-1–FR-39; NFR-1–NFR-15; UX-DR-001–010, UX-DR-090–120.
