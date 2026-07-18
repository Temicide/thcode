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
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-17
**Project:** thcode

## Document Inventory

### PRD

- `prds/prd-thcode-2026-07-14/prd.md` — primary PRD
- `prds/prd-thcode-2026-07-14/addendum.md` — PRD addendum
- The containing document set has no `index.md`; supporting research, extraction, reconciliation, review, and memory-log files are excluded from the primary assessment inputs.

### Architecture

- `architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md` — primary architecture document
- The containing document set has no `index.md`; specialist reviews, review rubric, and memory-log files are excluded from the primary assessment inputs.

### Epics and Stories

- `epics.md` — whole epics and stories document

### UX Design

- `ux-designs/ux-thcode-2026-07-17/DESIGN.md` — UX design contract
- `ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md` — detailed UX experience specification
- The containing document set has no `index.md`; validation, review, working-source, and memory-log files are excluded from the primary assessment inputs.

### Discovery Issues

- PRD, Architecture, and UX use non-standard document-set layouts without `index.md` files; the explicit primary files listed above were confirmed for assessment.
- No conflicting whole-versus-sharded duplicates were found.
- An earlier report for 2026-07-17 existed without UX inputs and was replaced for this reassessment after confirmation.

## PRD Analysis

### Functional Requirements

**FR-1 — Cross-platform CLI installation:** A developer can install thcode globally through npm and launch it with the `thcode` command on supported Windows and macOS environments. Windows 11 25H2 with Windows Terminal/PowerShell and macOS 14 Sonoma with Terminal/zsh are the minimum release-tested environments, and the newest stable OS versions are tested as well. Installation, update, uninstall, and first-run behavior must be documented and reproducible. Node.js 22+ is required, with Node.js 24 LTS as the clean-machine release baseline.

**FR-2 — Typhoon onboarding:** A first-time user can enter a Typhoon Key through a protected terminal form and complete a minimal live health check before entering the main interface. Typhoon is the only first-release Reasoning Model and cannot be silently replaced. The key must be stored through the operating-system credential facility and excluded from project files, environment files, transcripts, and Saved Sessions. Before masked entry, thcode identifies Typhoon's verified host and explains where the key is stored and used. Failed checks distinguish authentication, connectivity, quota, and configuration state without exposing the key.

**FR-3 — Just-in-time AI-for-Thai connection:** When a prompt first requires a Specialist Service and no AI-for-Thai Key exists, thcode explains the missing connection, opens a protected connection flow, verifies the key, and lets the user retry. The AI-for-Thai Key is separate from the Typhoon Key, covers all entitled launch services, and is entered through the same verified-endpoint disclosure and masked-input protections. Removal and rotation are explicit. The local harness alone stores and uses the key; Typhoon receives only tool schemas and sanitized results.

**FR-4 — Evidence-backed availability:** thcode exposes Typhoon or a Specialist Service as available only when the relevant live connectivity and authentication check passes for the effective configuration. Availability wording states what was tested. Health evidence binds to a configuration fingerprint covering credential reference/version, endpoint, service mapping, and contract version. The UI distinguishes configured, checking, available, unavailable, and unhealthy states. A real Typhoon protocol failure requires correction and explicit live retest rather than silent reinterpretation or repair.

**FR-5 — Thai and code-switched intent:** Nok can submit Thai or mixed Thai-English requests while thcode preserves technical identifiers and extracts the desired outcome, constraints, referenced artifacts, and verification criteria. Material ambiguity requires clarification; Thailand-specific requirements may be represented only when stated or strongly implied; normalized intent remains inspectable in diagnostic Evidence.

**FR-6 — Local Agent Loop:** thcode runs the iterative Typhoon, local-tool, result, and verification loop on the user's machine. Typhoon proposals are untrusted and must be validated against tool schemas, Work Mode, Permission Profile, Workspace, and hard boundaries. Invalid structured proposals are never executed; bounded recorded schema repair may be requested, but unresolved invalid proposals are rejected with the validation error. The loop ends only at a final response, verified completion, accepted disclosed limitation, refusal, hard boundary, or defined error. Remote components cannot perform local actions. Unknown dispatched remote outcomes cannot be retried without proven replay safety and reconciliation.

**FR-7 — Workspace inspection:** Typhoon can list, read, and search text content only within the declared Workspace. Path enforcement covers supported Windows and macOS behavior, including spaces, case behavior, symlinks, and separators. In-Workspace list/read/search proceeds without interruption under default Manual unless a material remote transfer occurs. Unsupported or out-of-Workspace paths are refused with explanation.

**FR-8 — Inspectable file creation and editing:** In Build Work Mode, Typhoon can create and edit text files through a bounded change tool. Manual shows the target and proposed content change before approval; Plan cannot authorize mutation; enough before/after Evidence is recorded for verification and Rollback Checkpoints.

**FR-9 — Controlled deletion:** In Build Work Mode, Typhoon can delete an in-Workspace file or directory only as a visibly destructive action. Manual requires explicit approval. Full Access cannot delete outside the Workspace or bypass non-overridable rules. Eligible deleted content participates in rollback retention.

**FR-10 — Controlled command execution:** In Build Work Mode, Typhoon can propose and run a validated local command with exact command disclosure. Output streams to the terminal, with timeout, cancellation, and orphan-process prevention. Working directory, executable, arguments, environment exposure, and policy are validated before launch. Commands threatening the host OS or out-of-Workspace resources are refused.

**FR-11 — Dependency preflight:** thcode can inspect project metadata and probe required runtimes, compilers, package managers, and documented commands without mutating the machine. Missing prerequisites produce accurate platform-specific guidance; thcode never silently installs them. `/check` repeats preflight after an environment change. Guidance comes from a maintained registry or verified project documentation, not model-invented URLs or privileged commands.

**FR-12 — Verified task completion:** thcode completes a local task only when defined verification succeeds, the user accepts a disclosed limitation, or a blocker is reported. The canonical proof creates a C++ source file, compiles and executes it with exit code 0, and observes `Hello, World!` on both supported platforms. Missing compilers are reported as prerequisites rather than source failures. Git status/diff integration is not required.

**FR-13 — Versioned Capability Registry:** thcode ships a reviewed, versioned representation of the AI-for-Thai catalog. Entries expose service identity, capability, supported inputs, entitlement, evidence level, manifest version/date, contract mapping, modality, limits, and available quota/data-handling notes. T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition work at launch. All other entries are labeled `Catalogued — Not available yet` and cannot be invoked.

**FR-14 — Prompt-first service routing:** When a prompt requires a supported Specialist Service, Typhoon can propose the relevant tool call without requiring registry browsing first, and the local harness validates and executes it. Only task-relevant schemas enter Active Model Context. Service selection and rationale are visible before invocation. `/tools` supports discovery and diagnostics. Calls go directly from the local machine to the official endpoint using the locally stored key.

**FR-15 — Type-specific artifact handling:** thcode can resolve explicit in-Workspace references to code, Markdown, plain text, images, audio, PDF, DOCX, and bounded directory manifests under type-specific policies. Every artifact is checked for containment, type, format, size, privacy policy, and compatibility. Code and Markdown send selected text; PDF and DOCX extract locally by default; originals transfer only when necessary and approved. Unsupported binaries send metadata only or are rejected clearly.

**FR-16 — Informed remote-transfer consent:** Before material leaves the machine, thcode shows a plain-language purpose and inspectable authoritative details. Details include service, verified endpoint, method where relevant, safe payload summary, and expected side effects; credentials are excluded. Images, audio, sensitive documents, and boundary expansions require explicit risk-appropriate authority.

**FR-17 — Attributable Specialist Service Evidence:** thcode preserves source hash, selected service, returned fields, confidence or uncertainty, empty fields, and provenance for a Specialist Service result. The transcript distinguishes service output from Typhoon explanation and never invents missing fields. Derived Evidence is cached by source-content hash per Service Configuration, with visible reuse and an explicit fresh/re-run control. Cache retention follows the deferred sensitive-data policy; cached Evidence is credential-free and sanitized.

**FR-18 — Honest service unavailability:** thcode distinguishes missing entitlement, exhausted quota, unsupported input, transient network state, failed health check, and protocol incompatibility. It neither substitutes another service nor fabricates a result and gives actionable reasons where possible. Sensitive identity, biometric, medical, or similar services stay unavailable without a dedicated policy. Temporary network, timeout, rate-limit, quota, and upstream failures do not quarantine after one occurrence; unsupported input rejects only the current request.

**FR-19 — Deterministic failure and quarantine:** When a real invocation exposes an authentication, protocol, or configuration failure, thcode derives a deterministic category from sanitized evidence and quarantines the smallest configuration proven invalid. Service-specific entitlement or protocol failures affect only that service; deterministic rejection of the shared key disables the connection and dependents. Model explanation cannot replace or contradict the category. A quarantined service remains unavailable pending correction and explicit retest.

**FR-20 — Explicit service retest:** After correcting a Service Configuration or credential condition, Nok can initiate a live retest and restore the service only if it passes. Retest is visible and records progress, result, timestamp, and evidence against the corrected fingerprint. Stale passes cannot validate changed configuration; background retries cannot masquerade as retests; failure leaves the service unavailable.

**FR-21 — Orthogonal Work Modes:** Nok can switch directly between Plan and Build without a mandatory plan-before-build gate. Plan is structurally read-only under every Permission Profile; Build permits eligible mutation and verification. New interactive sessions start in Build and keep the active mode visible.

**FR-22 — Permission Profiles:** Nok can select Manual, Assisted, or Full Access independently of Work Mode. Every Runtime Activation starts Manual. Assisted uses deterministic rules; AI risk signals are advisory and unresolved uncertainty asks Nok. Full Access suppresses only eligible prompts inside hard boundaries, displays a persistent session warning, and never restores across activations. Sensitive transfer always requires a separate explicit override.

**FR-23 — Progressive approval disclosure:** For an action requiring approval, thcode first shows purpose and risk in plain language and permits inspection of authoritative details. Commands show exact text, file mutations show target/change with deletion marked destructive, and Specialist calls show verified destination and safe transfer details.

**FR-24 — Non-overridable boundaries:** thcode enforces Workspace, command, network, service, quota, credential, and sensitive-transfer boundaries independently of approval. Host-OS threats and out-of-Workspace resources are hard-refused; Full Access cannot erase boundaries. Approved Boundary Expansions persist until revoked and are stored and audited separately from temporary approval and sensitive-transfer permission. Implementation must define a platform/action enforcement matrix and fail closed when required enforcement is unavailable.

**FR-25 — Credential isolation:** thcode binds each key to its exact provider/service identity and verified host. Typhoon and AI-for-Thai keys are never cross-used or sent to the other provider or a hosted thcode service. Keys never enter prompts, repository files, logs, telemetry, crash reports, Saved Sessions, previews, or generated UI.

**FR-26 — Saved Session lifecycle:** Nok can create, list, open, rename, delete, and inspect machine-local Saved Sessions through `/session`; `/sessions` opens the same browser. Sessions are global to the current OS user and distinguish current, other, and missing Workspace associations. Cloud sync, export/import, recovery archives, and cross-device migration are out of scope.

**FR-27 — Complete session restoration:** Opening a Saved Session restores its Chat Transcript, Typhoon selection, Work Mode, pins, compaction history, artifact manifest, plans, tool and verification history, cumulative token ledger, and Workspace association. Repository artifacts are referenced rather than copied by default. Keys are excluded. Loss of the local encryption key is disclosed as unrecoverable.

**FR-28 — Safe Runtime Activation:** Every new or restored Runtime Activation resets Permission Profile to Manual and clears Full Access, temporary approvals, and sensitive-transfer authority. Work Mode may restore, but authority does not. Durable Boundary Expansions remain active and inspectable until revoked. Sessions never silently rebind; a missing Workspace is explicit and blocks affected actions.

**FR-29 — Transcript and Active Model Context separation:** thcode preserves the complete Chat Transcript while assembling bounded Active Model Context from instructions, recent and pinned turns, selected Evidence, summaries, and relevant schemas. Nok can inspect what is verbatim, summarized, or excluded; protected content is never silently dropped; transformations are recorded as Evidence.

**FR-30 — Context and usage visibility:** thcode shows Active Context Utilization against Effective Context Capacity separately from cumulative input, output, cached tokens, and calls. A Context Donut includes percentage, non-color severity, and narrow-terminal text fallback. Bands are below 70% green, 70–84% amber, 85–94% orange, and 95–100% red, each with a non-color label. `/context` shows projected and cumulative categories. Cumulative usage has no percentage absent a configured budget.

**FR-31 — Safe compaction:** Before an over-capacity call, thcode automatically compacts older unpinned material, targets no more than 70% utilization, preserves transcript and pins, and records the transformation. If protected content still cannot fit, dispatch stops with token breakdown and remedies. Protected content is never silently unpinned, truncated, or removed.

**FR-32 — Interrupted remote-request recovery:** After interruption of a dispatched remote request, thcode restores all known received output and inserts `Chat interrupted` where reliable history ends. It does not automatically retry, invent an ending, or assume the remote side did nothing; Nok deliberately decides how to continue.

**FR-33 — Prompt-level Rollback Checkpoints:** Before eligible local mutation, thcode records a Rollback Checkpoint attributing recoverable changes to the Prompt Round. Coverage includes built-in file creation, editing, and deletion, but excludes shell, remote-service, permission, external-process, symlink, and other untracked effects. Incomplete or corrupt state is detectable and cannot be represented as complete.

**FR-34 — Conflict-safe rollback:** Nok can reverse a recent Prompt Round, but thcode reverses only current content still matching the attributable agent change. Overlapping later edits stop that portion for manual resolution; unrelated work remains unchanged; partial or blocked rollback is reported honestly; UI wording states exact built-in file coverage and excluded effects.

**FR-35 — Bounded rollback retention:** Rollback Checkpoints remain available for five subsequent prompts by default with configurable retention. Changed or deleted binary originals remain encrypted within the window. Each checkpoint is capped at 100 MB and the total store at 500 MB. An action exceeding a cap requires disclosure and explicit confirmation to proceed unprotected. Expired originals and metadata are deleted safely.

**FR-36 — Discoverable command surface:** thcode provides completion and controls for models, tools, status, settings, permissions, Work Mode, context, Sessions, dependency checks, connections, compaction, clearing, and exit. Shift+Tab switches Plan/Build, Tab accepts completion, and Esc dismisses a modal without changing state. `/models` is inspection-only for Typhoon; `/tools` exposes the registry and diagnostics.

**FR-37 — Persistent status and actionable explanations:** The TUI keeps Typhoon, Work Mode, Permission Profile, AI-for-Thai connection, active service health, and Active Context Utilization visible or immediately inspectable. Plan, Build, Full Access, destructive action, unhealthy service, interruption, and rollback conflict are distinct without relying on color alone. Dependency, service, policy, encryption-key, and context-overflow failures provide truthful next steps. User-facing explanations support Thai while preserving exact identifiers and commands.

**FR-38 — Action and result Evidence:** For significant actions and demonstrations, thcode links input or artifact hash, model, service, normalized Evidence, proposed action, approval state, command output, verification, and error state. Evidence is sanitized before persistence/display. Every proposed and executed tool call appears in a compact log, including automatic list/read/search. Completion summaries state changes, verification, service contribution, and residual risk. Evidence can reproduce release-validation failures without credentials.

**FR-39 — Prompt Round observability:** thcode records one end-to-end duration and correlation identity per Prompt Round while retaining subsystem timing for diagnostics. Context utilization and cumulative token usage remain distinct; deterministic failure evidence and model explanation have separate provenance; raw prompt, command, or payload export is disabled by default.

**Total Functional Requirements: 39**

### Non-Functional Requirements

**NFR-1 — Sensitive persistence:** Sensitive local session content must be encrypted before persistence; credential material must remain in the platform credential facility and outside the session database.

**NFR-2 — Sanitization:** Sanitization must occur before content is persisted, displayed, or exported, including headers, URLs, environment values, errors, tool output, and payload summaries.

**NFR-3 — Fail-closed enforcement:** Filesystem and command enforcement must fail closed when a required non-overridable boundary cannot be established.

**NFR-4 — Deliberate remote content:** Remote services receive only deliberately selected content and never an unresolved local path as fetch authority.

**NFR-5 — Process cleanup:** Command cancellation and timeout must not leave orphaned child processes.

**NFR-6 — Crash consistency:** Health, Session, Evidence, interruption, and rollback records must be crash-consistent; partial records must be detectable.

**NFR-7 — No silent substitution:** thcode must never silently substitute a model, service, protocol mapping, missing result, or unsupported capability.

**NFR-8 — Result attribution:** A Specialist Service result must remain attributable to the exact source artifact and Service Configuration.

**NFR-9 — UTF-8 compatibility:** Thai input and output must remain valid UTF-8 across supported terminals, persistence, streaming, and service calls.

**NFR-10 — Accessible status:** Status and severity information must not rely on color alone and must remain usable in narrow terminals.

**NFR-11 — Clean-machine compatibility:** The release must pass clean-machine installation and C++ proof validation on Windows 11 25H2, macOS 14 Sonoma, and the newest stable version of each OS.

**NFR-12 — Prompt Round performance unit:** User-visible performance is measured by Prompt Round; subsystem latency is diagnostic detail.

**NFR-13 — Pre-dispatch checks:** Context projection and policy checks must complete before dispatch and must not be bypassed for perceived speed.

**NFR-14 — Numeric performance budgets unresolved:** Numeric budgets for startup, TUI response, health checks, Prompt Rounds, compaction, Session restore, and service calls are not yet set.

**NFR-15 — Versioned internal schemas:** Internal event and Evidence schemas must be versioned independently of any external telemetry convention.

**Total Non-Functional Requirements: 15**

### Additional Requirements

#### Release constraints and guardrails

- Typhoon is the sole Release-1 Reasoning Model.
- Launch Specialist Services are limited to T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition; other catalog entries are visible but non-invokable.
- Users bring separate Typhoon and AI-for-Thai credentials and remain dependent on upstream availability, entitlements, quotas, schemas, and terms.
- Supported execution environments are native Windows 11/PowerShell and macOS/zsh only. Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, web, desktop, mobile, IDE, and computer-use support are excluded.
- npm is the required distribution mechanism; MIT is the required source license.
- User configuration cannot execute adapter code or define slash-command implementations.
- Local filesystem, command, and AI-for-Thai authority stays in the CLI; no hosted proxy or artifact service participates in the launch request path.
- The product owns harness behavior and Evidence, not upstream model or service correctness.
- Canonical Release-1 demonstrations are the cross-platform C++ `Hello, World!` Agent Loop and four prompt-driven Specialist Service flows.
- Saved Sessions are per-user, machine-local, encrypted, and separate complete transcript storage from bounded Active Model Context.
- Rollback guarantees apply only to mutations made by built-in create, edit, and delete tools.

#### Mandatory milestone decisions

1. Define repository governance, contribution policy, private security-reporting channel, and support expectations before public repository publication.
2. Set numeric performance budgets before release-candidate approval.
3. Define sensitive-data classification, consent, retention/deletion, and upstream disclosure before affected Specialist Services are publicly enabled.
4. Document the Windows/macOS enforcement matrix for Workspace, command, process, network, and fail-closed behavior before implementation sign-off.
5. Pin the exact Typhoon model identifier, endpoint contract, and adapter version before integration freeze.

#### Architecture and solution direction from the addendum

- Use metadata-driven provider/service discovery with reusable generic TUI components and declarative, non-executable post-install configuration.
- Keep product slash commands in reviewed TypeScript; reject arbitrary executable user adapters.
- Derive remote failures deterministically from sanitized network evidence and keep that evidence distinct from model explanation.
- Build prompt-level rollback from before hashes and exact patches; retain encrypted binary originals within explicit per-checkpoint and total caps.
- Use a per-user machine-local SQLite Global Session Store, encrypt sensitive fields with per-record authenticated AES-256-GCM, and keep the install key in the OS credential store.
- Preserve full local transcripts while sending only bounded Active Model Context. Until provider-specific verified limits supersede them, Effective Context Capacity reserves the greater of configured maximum output or 8% of raw context, plus a safety margin of the greater of 2,048 tokens or 2% of raw context.
- Use versioned normalized schemas for coding-task intent, Capability Registry, artifact policies, Evidence, uncertainty, and local-action validation.
- Cache derived Specialist Service Evidence by source-content hash per Service Configuration, subject to the pending sensitive-data policy.
- Keep the TypeScript headless core isolated from the React/Ink terminal presentation and publish an npm package with an explicit `thcode` binary and matching engines metadata.

#### Explicitly unresolved architecture questions

- Extension registry ownership, distribution, versioning, update, revocation, naming collision, and compatibility.
- Credential entry, secure storage, reference, rotation, and redaction mechanisms.
- Metadata and declarative-mapping schema validation and migration.
- Exact endpoint-verification and health-check contracts.
- Durable Boundary Expansion persistence and auditing versus temporary authority classes.
- Durable chat/event guarantees and reconciliation of unknown remote outcomes.
- Rollback behavior across renames, directories, permissions, symlinks, large files, Git changes, concurrency, and multiple agents.

### PRD Completeness Assessment

The PRD is comprehensive and explicitly authoritative for Release-1 scope. It contains 39 globally stable FRs, 15 NFRs, seven detailed user journeys, release gates, success measures, counter-metrics, non-goals, risks, assumptions, and milestone-bound deferred decisions. Requirement language generally identifies observable behavior, authority boundaries, failure behavior, and acceptance evidence rather than relying on feature labels alone.

The principal readiness concerns to carry into the remaining assessment are:

- NFR-14 has no measurable numeric performance budgets.
- The platform/action enforcement matrix is a mandatory pre-implementation-sign-off decision and directly affects FR-24 and NFR-3.
- The sensitive-data policy is unresolved even though artifact transfer and cached Evidence are Release-1 features.
- The exact Typhoon release pin and service health contracts remain unresolved before their stated milestones.
- Several rollback and extension-registry edge semantics remain architecture questions.
- The newly identified UX documents must be checked against the PRD's terminal interaction, accessibility, Thai-language, authority, consent, recovery, and failure-state requirements.

## Epic Coverage Validation

### Epic FR Coverage Extracted

The revised epics document contains an explicit `FR Coverage Map`, epic-level `FRs covered` declarations, and story-level `Requirements` traceability. The seven epics allocate the PRD requirements as follows:

- **Epic 1 — Install, Connect, and Hold a Trustworthy First Conversation:** FR-1, FR-2, FR-4, FR-5
- **Epic 2 — Control Authority and Understand Every Action:** FR-21 through FR-25 and FR-36 through FR-39
- **Epic 3 — Complete and Reverse a Verified Local Coding Task:** FR-6 through FR-12 and FR-33 through FR-35
- **Epic 4 — Use Thai Specialist Services with Informed Consent:** FR-3, FR-4, and FR-13 through FR-20
- **Epic 5 — Govern Active Context and Usage:** FR-29 through FR-31
- **Epic 6 — Resume Work Safely Across Saved Sessions and Interruptions:** FR-26 through FR-28 and FR-32
- **Epic 7 — Certify and Govern the Public Release:** no new product FR; verifies FR-1 through FR-39, NFR-1 through NFR-15, deferred decisions, and release gates

### Coverage Matrix

| FR | PRD requirement | Epic/story implementation path | Status |
|---|---|---|---|
| FR-1 | Cross-platform CLI installation | Epic 1; Stories 1.1 and 1.10 | ✓ Covered |
| FR-2 | Protected Typhoon onboarding | Epic 1; Stories 1.6, 1.7, and 1.10 | ✓ Covered |
| FR-3 | Just-in-time AI-for-Thai connection | Epic 4; Stories 4.3, 4.18, and 4.20 | ✓ Covered |
| FR-4 | Evidence-backed provider/service availability | Epics 1 and 4; Stories 1.7, 1.9–1.10, 4.3–4.4, 4.9, and 4.14–4.20 | ✓ Covered |
| FR-5 | Thai and code-switched intent | Epic 1, with Specialist routing integration in Epic 4; Stories 1.8–1.10, 4.5, and 4.19 | ✓ Covered |
| FR-6 | Local Agent Loop | Epic 3; Stories 3.1, 3.3–3.11, and 3.15 | ✓ Covered |
| FR-7 | Bounded Workspace inspection | Epic 3; Stories 3.1, 3.4, 3.9, and 3.11 | ✓ Covered |
| FR-8 | Inspectable file creation/editing | Epic 3; Stories 3.3, 3.5, 3.9, and 3.11 | ✓ Covered |
| FR-9 | Controlled deletion | Epic 3; Stories 3.3, 3.6, and 3.9 | ✓ Covered |
| FR-10 | Controlled command execution | Epic 3; Stories 3.7 and 3.9–3.11 | ✓ Covered |
| FR-11 | Non-mutating dependency preflight | Epic 3; Stories 3.8 and 3.11 | ✓ Covered |
| FR-12 | Verified task completion and C++ proof | Epic 3; Stories 3.7–3.8 and 3.10–3.11 | ✓ Covered |
| FR-13 | Versioned Capability Registry | Epic 4; Stories 4.1–4.2, 4.5, 4.10–4.13, and 4.18–4.20 | ✓ Covered |
| FR-14 | Prompt-first Specialist Service routing | Epic 4; Stories 4.1–4.2, 4.5, and 4.19; context integration in Story 5.3 | ✓ Covered |
| FR-15 | Type-specific artifact handling | Epic 4; Stories 4.6–4.8 and 4.10–4.13 | ✓ Covered |
| FR-16 | Informed remote-transfer consent | Base contract in Story 2.6; Epic 4 Stories 4.6–4.10 and 4.14 | ✓ Covered |
| FR-17 | Attributable Specialist Service Evidence/cache | Epic 4; Stories 4.6–4.15 and 4.19 | ✓ Covered |
| FR-18 | Honest service unavailability | Epic 4; Stories 4.1–4.5, 4.7, 4.9–4.13, and 4.15–4.20 | ✓ Covered |
| FR-19 | Deterministic failure and scoped quarantine | Epic 4; Stories 4.2–4.4, 4.12–4.18, and 4.20 | ✓ Covered |
| FR-20 | Explicit service retest | Epic 4; Stories 4.4, 4.17, and 4.20 | ✓ Covered |
| FR-21 | Orthogonal Plan/Build Work Modes | Epic 2; Stories 2.1–2.2 and 2.14; enforced by Epic 3 effect stories | ✓ Covered |
| FR-22 | Manual, Assisted, and Full Access profiles | Epic 2; Stories 2.1–2.2 and 2.14; enforced by Epic 3 effect stories | ✓ Covered |
| FR-23 | Progressive approval disclosure | Epic 2; Stories 2.4–2.5, 2.9, and 2.14; applied in Stories 3.5–3.6 and 3.11 | ✓ Covered |
| FR-24 | Non-overridable boundaries and expansions | Epic 2; Stories 2.1–2.9 and 2.14; consumed by later effect stories | ✓ Covered |
| FR-25 | Credential isolation | Epic 2; Stories 2.7 and 2.9, with provider/service integrations in Epics 1 and 4 | ✓ Covered |
| FR-26 | Saved Session lifecycle | Epic 6; Stories 6.1–6.2, 6.9–6.10, and 6.12 | ✓ Covered |
| FR-27 | Complete Session restoration | Epic 6; Stories 6.1–6.4, 6.6, and 6.9–6.13 | ✓ Covered |
| FR-28 | Safe Runtime Activation | Epic 6; Stories 6.1–6.5, 6.9, and 6.11–6.13 | ✓ Covered |
| FR-29 | Transcript/Active Context separation | Epic 5; Stories 5.1–5.3, 5.6, and 5.8–5.13 | ✓ Covered |
| FR-30 | Context and usage visibility | Epic 5; Stories 5.1, 5.3–5.7, and 5.10–5.13 | ✓ Covered |
| FR-31 | Safe compaction | Epic 5; Stories 5.1–5.6 and 5.8–5.13 | ✓ Covered |
| FR-32 | Interrupted remote-request recovery | Epic 6; Stories 6.6–6.8, 6.11, and 6.13 | ✓ Covered |
| FR-33 | Prompt-level Rollback Checkpoints | Epic 3; Stories 3.2–3.6 and 3.10–3.16 | ✓ Covered |
| FR-34 | Conflict-safe rollback | Epic 3; Stories 3.6, 3.10, and 3.12–3.16 | ✓ Covered |
| FR-35 | Bounded rollback retention | Epic 3; Stories 3.2–3.3, 3.6, and 3.12–3.16 | ✓ Covered |
| FR-36 | Discoverable command surface | Epic 2; Stories 2.10 and 2.13–2.14 | ✓ Covered |
| FR-37 | Persistent status and explanations | Epic 2; Stories 2.8 and 2.10–2.14 | ✓ Covered |
| FR-38 | Action and result Evidence | Epic 2; Stories 2.9–2.14, with feature-domain Evidence in later epics | ✓ Covered |
| FR-39 | Prompt Round observability | Epic 2; Stories 2.9–2.14, with feature-domain correlation in later epics | ✓ Covered |

### Missing Requirements

No PRD Functional Requirement is absent from the explicit epic coverage map or from story-level implementation paths.

No out-of-range or epics-only Functional Requirement identifiers were found. Epic 7 intentionally introduces no new product FR and instead owns cross-cutting certification, governance, NFR, and deferred-decision gates.

### Coverage Statistics

- **Total PRD FRs:** 39
- **FRs claimed in the explicit epic coverage map:** 39
- **FRs with story-level implementation paths:** 39
- **Missing FRs:** 0
- **Extraneous product FR identifiers:** 0
- **Coverage:** 100%

### Coverage Validation Notes

- FR-4 is intentionally split between Epic 1 for Typhoon availability and Epic 4 for Specialist Service availability.
- FR-5 has primary ownership in Epic 1 and is reused by Specialist routing stories in Epic 4.
- FR-16 begins with a provider-independent prepared-payload and transfer-consent contract in Epic 2, then receives concrete Specialist implementation in Epic 4.
- FR-14 is owned by Epic 4 but Story 5.3 also enforces task-relevant schema selection during Active Context construction.
- FR-33 through FR-35 have been moved into Epic 3 so secure checkpoint storage and protection precede the first built-in mutation and rollback is completed in the same implementation sequence.
- FR-26 through FR-28 and FR-32 are consolidated in Epic 6 after the record types they restore have been established by Epics 1–5.
- Epic 7 provides release verification rather than feature ownership and therefore does not inflate the product FR namespace.
- This step validates presence and traceability only. Story independence, sequencing, sizing, acceptance quality, and architecture/UX alignment are evaluated in later steps.

## UX Alignment Assessment

### UX Document Status

**Found and final.** The UX specification is composed of two complementary primary documents:

- `ux-designs/ux-thcode-2026-07-17/DESIGN.md` — visual system, semantic tokens, typography, spacing, component inventory, terminal-width behavior, themes, and contrast targets.
- `ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md` — information architecture, surface/state closure, canonical state catalog, focus and keyboard behavior, headless parity, authority/consent interactions, recovery, Sessions, context, rollback, and UJ-1 through UJ-7.

The documents are substantially complete for a terminal-first product. They define interactive Ink behavior together with redirected, linearized, monochrome, narrow-terminal, and headless JSON behavior rather than treating accessibility and noninteractive output as later variants.

### UX ↔ PRD Alignment

#### Strong alignment

- All seven PRD user journeys have explicit UX flows, including first-use Typhoon onboarding, AI-for-Thai discovery and consent, unhealthy-service recovery, the C++ proof, Saved Session restoration, interruption recovery, and rollback.
- The UX preserves the PRD's Release-1 boundary: Typhoon-only reasoning, exactly four working AI-for-Thai services, non-invokable catalog entries, native Windows/macOS support, local BYOK calls, and no arbitrary executable extensions.
- Work Mode, Permission Profile, operation approval, transfer consent, Boundary Expansion, Workspace, and Runtime Activation are visibly independent, matching FR-21 through FR-25.
- The terminal experience operationalizes FR-36 through FR-39 with command grammar, completion, persistent status, Evidence separation, Prompt Round correlation, exact terminal outcomes, and stdout/stderr/headless contracts.
- Thai and mixed-language behavior is concretely specified through IME precedence, grapheme-safe editing, terminal-cell-width wrapping, byte preservation, and exact technical-token handling, strengthening FR-5 and NFR-9.
- Accessibility requirements cover non-color state, 40/60/80/120-column behavior, focus, keyboard-only operation, linearized output, reduced motion, contrast, and no-spinner semantics, strengthening NFR-10.
- Context, Session, interruption, and rollback UX follows FR-26 through FR-35 and avoids stale authority, silent rebinding, hidden compaction, blind retry, and rollback overclaim.

#### Alignment conflicts and scope risks

1. **Critical — Invalid structured-proposal behavior conflicts across authoritative artifacts.** PRD FR-6 permits a bounded, recorded schema repair or retry, while Architecture AD-14 and the UX `malformed` state require rejection after one local validation pass with no model repair request or provider retry. The epics correctly expose this as a signed Product Owner/Architecture decision gate in Story 7.3, but implementation cannot safely choose either behavior until that gate is resolved and the losing artifact is corrected.

2. **Critical — The UX declares a sensitive-transfer policy that the PRD still marks as unresolved.** `EXPERIENCE.md` calls its policy “committed” and permits transfer only after exact upstream no-retention and deletion handling are verified. The PRD instead assigns sensitive-data classification, consent language, retention/deletion, and upstream disclosure to Deferred Release Decision 3. Architecture fixes authority and lifecycle boundaries but defers exact time-based retention and provider policy details. The UX may be a strong proposed resolution, but it cannot become an authoritative Release-1 commitment without Product/Security approval and an update to the PRD or a linked normative decision.

3. **High — Provider-side deletion states introduce behavior beyond the current PRD contract.** UX adds `upstream-no-retention-verified`, `deletion-not-required`, `deletion-pending`, `deletion-confirmed`, and `deletion-failed`, including quarantine after failed provider deletion. The PRD requires local Session deletion, cache retention coordination, informed consent, and a future sensitive-data policy, but does not currently require a provider deletion API or provider-confirmed deletion lifecycle. These states must either be approved as the resolution of Deferred Decision 3 and traced into FR/NFR scope, or narrowed to policy Evidence without implying an upstream deletion capability.

4. **High — The context fallback capacity value is not clearly sourced from the PRD or Architecture Spine.** The UX-derived epics specify a `128k` fallback effective capacity of `115,200`. The PRD/addendum defines reserve formulas and requires provider-reported values to be distinguished from estimates, but does not clearly establish that raw fallback limit. The value needs a named provider/product decision and source, or the UX should retain `percentage unavailable`/fail-closed behavior until a verified limit exists.

5. **Moderate — `COMMAND_ERROR` is outside the declared 73-row canonical state registry.** The command contract requires fixed display token `COMMAND_ERROR`, while the authoritative `ux-state-v1` mechanical registry and behavior table do not define that token, JSON mapping, terminality, exit class, or exit code. Either add it as a versioned registry row and adjust the claimed row count, or define it explicitly as a non-status error heading whose underlying canonical status is `blocked` or `malformed`.

6. **Moderate — `effect-already-committed` is mapped to `SUCCESS=0` without proving effect success.** The token means dispatch commit was observed before cancellation or revocation; the effect may still be running, fail, or have an unknown outcome. Mapping it as a terminal success risks contradicting the PRD's truthful-completion and unknown-outcome rules. It should be a nonterminal lifecycle fact or pair with the actual terminal outcome rather than independently signal process success.

7. **Moderate — Several UX state rows treat evidence qualifiers as terminal process outcomes.** `estimated`, `sanitized-with-omissions`, and `percentage unavailable` can describe a field or Evidence record while the enclosing operation continues safely. Their registry-wide terminal `BLOCKED` mapping may over-block behavior or conflict with PRD language that permits clearly labeled estimates. The protocol should distinguish operation status from Evidence completeness/measurement qualifiers, as the UX already does conceptually elsewhere.

### UX ↔ Architecture Alignment

#### Architecture support confirmed

- AD-2 and AD-3 provide the UI-safe `CoreApp` protocol, durable events, replay/deduplication, correlated intents, streaming chunks, and post-commit completion needed by the UX.
- AD-4, AD-13, AD-17, AD-22, and AD-27 support exact effect identity, independent authority dimensions, stale decision invalidation, cancellation phases, and fresh Runtime Activation behavior.
- AD-7 supports inspectable Active Model Context, immutable transcript history, context manifests, safe compaction, and protected-overflow stops.
- AD-8 through AD-11, AD-15, AD-16, and AD-18 support provider/service identity, health generations, deterministic failures, scoped quarantine, Capability Registry presentation, credential isolation, cache provenance, and explicit retest.
- AD-12 and AD-23 support the UX's native Windows/macOS boundary and fail-closed platform behavior.
- AD-19 through AD-21 and AD-26 support rollback retention, encrypted persistence, crash consistency, Session deletion, cache/artifact references, and recovery surfaces.
- AD-24 and AD-25 support shared sanitization, local artifact resolution, data minimization, and exact transfer preparation.
- React 18.3.1 and Ink 5.2.1 support the intended terminal presentation, while the headless `CoreApp` split prevents the UI from owning state or effects.
- Architecture's deferral of the exact Ink component tree is compatible with UX ownership: the UX defines canonical component behavior and styling without moving authority into presentation code.

#### Architecture gaps requiring closure

- The final UX documents postdate the Architecture Spine but are not listed as architecture sources or companions. The architecture is broadly capable of supporting them, yet an explicit architecture traceability update would prevent later implementation from treating UX requirements—especially the canonical state catalog, headless exit semantics, focus behavior, and provider-retention states—as optional UI details.
- Numeric responsiveness budgets remain intentionally unresolved. UX defines progress, static fallbacks, and `budget not set`, but startup, input response, overlay opening, health feedback, streaming, compaction, and restore cannot receive performance pass/fail criteria until NFR-14 is approved.
- The platform/action enforcement matrix remains a named dependency. UX correctly shows `ENFORCEMENT UNVERIFIED` and blocks affected effects, but implementation sign-off remains impossible until concrete Windows/macOS mechanisms and unsupported combinations are documented.
- Exact Typhoon pin, verified service contracts, upstream handling evidence, and the security-reporting route remain downstream dependencies; the UX safely exposes non-affirmative placeholders rather than inventing values.

### Warnings

- ⚠️ The UX specification is no longer missing and is much stronger than the prior readiness report assumed; the earlier missing-UX finding is superseded.
- ⚠️ Do not implement remote-transfer enablement from the UX's “committed” policy wording until Deferred Decision 3 receives formal Product/Security approval.
- ⚠️ Resolve the FR-6 versus AD-14 invalid-proposal conflict before implementing the Agent Loop or writing conformance tests.
- ⚠️ Reconcile the state registry before freezing `CoreProtocolV1`; status tokens, Evidence qualifiers, lifecycle facts, and process exit outcomes currently overlap in ways that can create false success or unnecessary blocking.
- ⚠️ NFR-14, the platform/action matrix, exact model/service pins, and repository/security governance remain real release gates despite complete UX fallback behavior.

### UX Readiness Conclusion

The UX artifacts provide a coherent, highly detailed, implementable interaction contract and are strongly supported by the architecture. They close the major UX-documentation gap identified in the earlier report. UX readiness is therefore **substantially achieved**, but not fully aligned until the invalid-proposal conflict, sensitive-data policy authority, provider-deletion scope, context fallback source, and state-registry semantics are resolved. These are targeted cross-artifact corrections rather than a need to redesign the terminal experience.

## Epic Quality Review

### Overall Structure Verdict

The rewritten epic plan is materially stronger than the earlier version. It moves durable event, journal, encryption, sanitizer, and credential foundations into Epic 1; places secure checkpoint storage before mutation in Epic 3; moves context before Session restoration; gives each product epic a recognizable user outcome; and separates release governance into Epic 7. FR traceability is complete and acceptance criteria are unusually explicit about safety, failures, crash consistency, accessibility, and headless parity.

However, the plan still does **not** fully satisfy the required dependency rule. Three normative decisions or contracts are first resolved in Epic 7 even though earlier feature epics require them to function. There are also within-epic ordering defects in Specialist Evidence and context-record persistence, plus several oversized certification stories and mechanically underspecified fixtures.

### Epic-Level Compliance Summary

| Epic | User value | Independence | Story quality | Verdict |
|---|---|---|---|---|
| Epic 1 — Install, connect, converse | Clear first-use outcome; establishes critical durable foundations early | Mostly independent, but structured-proposal behavior is hard-coded before later decision | Strong BDD detail; brownfield baseline is not explicit enough | ⚠️ Decision prerequisite required |
| Epic 2 — Control authority | Clear user control, inspectability, and headless parity outcome | Can build on Epic 1; no required later feature state is fabricated | Strong, though state-registry ownership needs tightening | ✓ Largely compliant |
| Epic 3 — Complete and reverse coding task | Clear demonstrable user outcome | Depends on a concrete platform/action matrix first published/certified in Epic 7 | Strong ordering for checkpoints; some limits remain unbounded | ❌ Forward dependency |
| Epic 4 — Use Specialist Services | Clear catalog, consent, invocation, Evidence, cache, and recovery outcome | Depends on the later sensitive-data policy approval; service stories precede durable Evidence ownership | Detailed but several fixtures are underspecified | ❌ Forward dependencies |
| Epic 5 — Govern context and usage | Clear inspectability and safe-compaction outcome | Product-level dependency order is correct, but persistence/envelope stories follow consumers | Strong behavior, incorrect internal durability order | ❌ Within-epic forward dependency |
| Epic 6 — Resume Sessions and interruptions | Clear continuity and recovery outcome | Correctly follows record-producing epics and restores only prior record types | Strong explicit scope and recovery behavior | ✓ Largely compliant |
| Epic 7 — Certify and govern release | Valuable to maintainers and users indirectly through trustworthy release | Contains prerequisites that must move before Epics 3–4 | Many strong gates, but several stories are oversized | ⚠️ Reclassify and split |

### 🔴 Critical Violations

#### C1 — Structured-proposal behavior is implemented before the decision that defines it

**Evidence:** PRD FR-6 permits a bounded, recorded schema repair or retry. Architecture AD-14 requires rejection after one local validation pass with no repair request or provider retry. Story 7.3 schedules the Product Owner/Architecture decision, but Stories 1.9, 3.9, and 4.9 already implement the AD-14 interpretation and make it acceptance-tested behavior.

**Impact:** If Story 7.3 selects the PRD interpretation, completed implementation and tests in three earlier epics become incorrect. The later decision cannot govern code that has already been accepted.

**Recommendation:** Resolve and approve the normative behavior before Story 1.9. Update the PRD, Architecture Spine, UX state contract, and all affected stories to one rule. Story 7.3 may retain a release traceability check but must not be the first authoritative decision.

#### C2 — Epic 4 depends on Epic 7's sensitive-data policy decision

**Evidence:** Story 4.8 blocks transfer when retention or deletion handling is unknown or unverifiable. UX-DR-082 through UX-DR-089 require verified upstream no-retention/deletion handling and define provider deletion states. Story 4.1 needs privacy and retention classification in the registry. Story 7.2 is the later story that formally approves classification, consent, retention, deletion, provider handling, and waiver rules.

**Impact:** Epic 4 cannot independently deliver its core user outcome—an actual Specialist Service transfer—until a later epic defines and approves the runtime policy it must enforce. Implementers would have to invent policy, treat unapproved UX text as authoritative, or leave the feature blocked.

**Recommendation:** Move the approved sensitive-data and Remote Data Authority policy before Epic 4. Separate the normative runtime policy and provider-evidence contract from final release certification. Epic 7 should verify approved policy compliance rather than create a prerequisite after the feature epic.

#### C3 — Epic 3 depends on a platform/action enforcement matrix first established in Epic 7

**Evidence:** AD-12 requires a versioned platform/action enforcement matrix but defers concrete mechanism choices. Stories 3.1, 3.7, and 3.11 fail closed with `ENFORCEMENT UNVERIFIED` when the matrix or enforcement mechanism is unavailable. Story 7.6 is the later story that publishes and certifies the Windows/macOS matrix, with platform implementation evidence in Stories 7.11 and 7.15.

**Impact:** Epic 3 cannot deliver its canonical C++ proof or effectful file/command behavior while the required matrix remains unresolved. Its promised user outcome is blocked by a later epic.

**Recommendation:** Create and approve the normative matrix before Epic 3, including required mechanisms and fail-closed outcomes. Epic 3 should implement against it. Keep Epic 7 responsible only for release certification of the already-defined matrix.

### 🟠 Major Issues

#### M1 — Specialist integrations precede the durable Evidence artifact they require

Stories 4.10 through 4.13 require immutable attributable Specialist Evidence, but Story 4.14 later establishes persistence of immutable Specialist Evidence and `CacheManifest` identity. Story 4.9 defines a normalized adapter contract but does not clearly own the durable artifact envelope and persistence boundary.

**Recommendation:** Move the immutable Specialist Result/Evidence envelope and ownership foundation before service-specific integrations. Alternatively, narrow Stories 4.10–4.13 to normalized adapter results and delay end-to-end immutable Evidence claims until Story 4.14 is complete.

#### M2 — Context consumers precede their extension-envelope and persistence foundations

Story 5.2 requires encrypted, journaled durable pins; Story 5.7 requires a durable usage ledger; Story 5.8 requires committed compaction Evidence. Story 5.10 later establishes crash-consistent persistence for those records, and Story 5.11 later defines their versioned extension envelopes and ownership.

**Recommendation:** Reorder Epic 5 as: versioned context-extension envelopes and ownership → encrypted/journaled persistence → pin/context/usage/compaction consumers → recovery and rendering. Do not require durability in a story before the record contract and persistence adapter exist.

#### M3 — Epic 7 is a release-governance workstream rather than a normal product epic

Epic 7 explicitly adds no product FR and contains governance, policy approval, model pins, budgets, certification, audits, evidence assembly, waivers, and go/no-go publication. This is valuable but is not independently delivered end-user capability in the create-epics-and-stories sense.

**Recommendation:** Model it as a cross-cutting release-gate/certification workstream, or explicitly label it a non-product maintainer epic. Move prerequisite decisions before their consuming feature epics and leave Epic 7 with verification, evidence aggregation, waiver validation, and publication authorization.

#### M4 — Brownfield baseline handling is not acceptance-tested in the first story

The requirements inventory correctly states that this is a brownfield evolution of `cli/`, with an existing headless `CoreApp`/Ink split and no starter template. Story 1.1 tests npm installation and startup preflight but does not require preservation of the existing entry point, baseline build/tests, CoreApp/Ink boundary, or avoidance of a generated scaffold/wholesale rewrite.

**Recommendation:** Add an initial brownfield-baseline story or expand Story 1.1 to inventory and preserve the existing package, establish passing baseline build/test behavior, and prove incremental convergence rather than replacement.

#### M5 — Mechanical ownership of `ux-state-v1` is incomplete

Story 2.8 consumes the canonical state catalog and says applicable rows are represented, while Story 7.18 later audits all 73 rows. No early story unambiguously owns mechanical validation of unique display/JSON tokens, terminality, one exit class/code, `NONE` for nonterminal rows, and required cause/retry/recovery/narrow/localized fields. The separate `COMMAND_ERROR` and problematic qualifier/lifecycle mappings further increase ambiguity.

**Recommendation:** Make Story 2.8 establish and mechanically validate the full versioned registry. Story 7.18 should certify surface parity against an already frozen contract, not be the first comprehensive validator.

#### M6 — Several fixture-based criteria are not objectively bounded

Examples include:

- Stories 4.10–4.13 refer to deterministic media/document/text fixtures without stable fixture IDs, exact inputs, expected normalized outputs, tolerances, or golden hashes.
- Story 4.19 refers to expected routing and source identity without naming the prompt/artifact fixtures.
- Stories 7.4 and 7.8 require exactly two retries after a “defined backoff” or for “defined transient classes” without identifying the authoritative policy/version or numeric schedule.
- Story 3.4 requires bounded recursion, file counts, text bytes, and search work without specifying values or the owning versioned configuration.

**Recommendation:** Give each fixture a stable ID, source hash, exact input, expected normalized fields, accepted uncertainty/tolerance, and failure variants. Name the versioned retry/backoff and resource-limit policy, with concrete test values.

#### M7 — Several certification stories are too large for independent completion

The clearest examples are:

- **Story 7.7:** protocol/schema compatibility, migrations, key rotation, checkpoints, Session deletion, crash points, and cleanup.
- **Stories 7.13 and 7.17:** C++ proof, Session restore, interrupted recovery, rollback, crash recovery, and deletion continuity for an entire platform.
- **Stories 7.18–7.20:** broad cross-surface UX, interaction, output, secrecy, and Evidence audit suites.
- **Story 7.22:** assembly of all 39 FRs, 15 NFRs, all decisions, both platforms, package, services, UX, journeys, success measures, and countermetrics.

**Recommendation:** Split certification by independently owned domain and artifact, then keep small aggregate manifest/gate stories that consume already completed evidence.

### 🟡 Minor Concerns

#### m1 — Story 1.1 installation criteria are not self-contained

“Documented global npm install” and “launches reproducibly” do not identify the package artifact/version, exact command, clean-machine fixture, expected binary resolution, or baseline expected output. Those details appear much later in Story 7.9.

**Recommendation:** Define a development package fixture and exact installation/launch expectations in Story 1.1; reserve Story 7.9 for final publication certification.

#### m2 — Some stories combine domain, persistence, UI, accessibility, and recovery in one acceptance boundary

Stories 2.14, 4.20, 5.13, 6.13, and several Epic 7 audits span many output modes and lifecycle states. They are testable in principle but difficult to estimate and review as one implementation unit.

**Recommendation:** Where implementation ownership differs, split canonical projection/domain behavior from surface integration and cross-mode certification.

#### m3 — Numeric resource ceilings remain deferred despite being used as enforcement language

The requirements inventory requires Prompt Round ceilings and bounded artifact/search behavior, but many feature stories refer to limits without values. NFR-14 is correctly deferred, yet safety/resource ceilings needed for deterministic behavior should not all wait for performance-budget approval.

**Recommendation:** Separate safety caps from performance SLOs. Define implementation-safe default caps before the consuming stories and allow Epic 7 to certify or tune release budgets later.

#### m4 — Traceability is stronger than the explicit dependency model

The document has excellent FR/NFR/AD/UX traceability and narrative dependency notes, but no compact machine-checkable story dependency graph. The remaining forward dependencies were therefore able to survive the rewrite.

**Recommendation:** Add `dependsOn` metadata or a generated dependency table for every story and reject any edge to a later story or epic, except explicitly identified certification-only consumption of already produced evidence.

### Database and Entity Timing Assessment

- Epic 1 correctly introduces the store, journal, encryption, and migration protocol before the first sensitive transcript/provider write.
- Epic 3 correctly introduces `CheckpointRepository` and `ArtifactStore` before the first built-in mutation.
- Epic 6 introduces the Saved Session index and tombstone/cascade lifecycle when Session browsing and deletion are first required.
- No requirement to create all final SQLite tables up front was found; exact tables remain adapter-owned.
- The principal timing defects are logical record-contract timing rather than physical table timing: Specialist Evidence ownership arrives after service consumers, and context extension envelopes/persistence arrive after pin, usage, and compaction consumers.

### Starter and Existing-Code Assessment

- Architecture specifies no starter template, so a generated-starter setup story is not required.
- This is a brownfield evolution of the existing `cli/` prototype and must preserve the headless `CoreApp`/Ink boundary while converging incrementally toward the target architecture.
- The plan states this constraint but does not make the initial baseline preservation sufficiently testable in Story 1.1.
- A separate CI/CD product story is not mandatory, but release validation is extensive and should be decomposed into independently owned certification tasks.

### Epic Quality Conclusion

The rewrite successfully fixes many defects from the earlier assessment, especially late encryption, late event durability, checkpoint ownership, future status fabrication, Session restoration order, and release-governance mixing inside the Specialist epic. It is nevertheless **not yet dependency-safe**. The remaining blockers are concentrated and correctable: resolve the invalid-proposal decision before implementation, approve the sensitive-data policy before Epic 4, define the platform/action matrix before Epic 3, reorder Specialist Evidence and context persistence foundations, and split oversized certification work. Once those corrections are made, most of the detailed acceptance criteria can be retained with limited redistribution.

## Summary and Recommendations

### Overall Readiness Status

# NOT READY

The project is not ready to begin unrestricted Phase 4 implementation against the current story order.

This verdict is narrower than the earlier assessment and reflects significant planning improvement. The current artifacts provide:

- complete PRD scope with **39 FRs and 15 NFRs**;
- **100% FR-to-epic coverage** with story-level implementation paths;
- a final, detailed UX design and experience contract;
- a strong architecture covering authority, durability, encryption, evidence, context, Sessions, rollback, remote services, and platform boundaries;
- a rewritten epic sequence that correctly moves event durability, encryption, sanitization, and checkpoint foundations earlier.

The remaining blockers are not missing product scope. They are three forward dependencies on unresolved normative decisions, two internal persistence-order defects, and several contract/testability issues that would cause early stories either to guess future policy or to be accepted against behavior that may later change.

Targeted work on artifact correction, approved foundations, and non-conflicting technical spikes may proceed. Normal story-by-story implementation should not pass Story 1.8 or begin effectful Epic 3/Specialist Epic 4 work until the critical prerequisites are resolved.

### Critical Issues Requiring Immediate Action

1. **Resolve invalid structured-proposal behavior before Story 1.9.** PRD FR-6 permits bounded recorded repair/retry; Architecture AD-14 and earlier stories prohibit it. Story 7.3 is too late to decide behavior already implemented in Stories 1.9, 3.9, and 4.9.

2. **Approve the sensitive-data and Remote Data Authority policy before Epic 4.** Specialist transfer, registry classification, consent, cache retention, and provider-deletion behavior depend on a policy currently scheduled for Story 7.2. Epic 4 cannot independently deliver its core user outcome without it.

3. **Define the normative Windows/macOS platform-action enforcement matrix before Epic 3.** Stories 3.1, 3.7, and 3.11 must fail closed without the matrix, while Story 7.6 currently publishes/certifies it later. The implementation contract must precede local filesystem and command effects.

4. **Reconcile provider-side deletion scope with the authoritative PRD.** The UX defines upstream deletion lifecycle states and quarantine behavior not currently established by an FR or approved sensitive-data policy. Approve and trace that behavior, or narrow it to policy Evidence without implying an upstream deletion API.

5. **Repair the canonical state/exit contract before freezing CoreProtocolV1.** `COMMAND_ERROR` is outside the 73-row registry; `effect-already-committed` is incorrectly capable of signaling `SUCCESS=0`; and Evidence qualifiers such as `estimated` and `sanitized-with-omissions` are treated as terminal operation outcomes. Status, lifecycle, Evidence completeness, measurement quality, and process exit must be separate dimensions.

6. **Reorder durable record foundations before their consumers.** Move immutable Specialist Result/Evidence ownership before Stories 4.10–4.13, and move context extension envelopes plus persistence before durable pins, usage, compaction, and recovery consumers in Epic 5.

### Recommended Next Steps

1. **Create three prerequisite decision artifacts.** Approve: (a) invalid structured-proposal behavior, (b) sensitive-data/Remote Data Authority policy, and (c) the normative platform/action enforcement matrix. Link each decision to the PRD, Architecture Spine, UX, and affected stories.

2. **Correct the authoritative source documents.** Do not leave conflicting language with a downstream note. Update FR-6 or AD-14 to the selected behavior; update the PRD/deferred-decision status for the approved data policy; and record the platform matrix as an implementation prerequisite rather than only a release certification artifact.

3. **Refactor Epic 7 into prerequisite decisions and release certification.** Move policy/matrix decisions before consuming feature epics. Keep final governance, audits, evidence assembly, waiver validation, and go/no-go authorization as a clearly labeled non-product certification workstream.

4. **Reorder Epic 4.** Establish the immutable Specialist Result/Evidence envelope, artifact ownership, and persistence contract before the four service integrations. Then implement services, cache behavior, failure/quarantine, and end-to-end flows.

5. **Reorder Epic 5.** Establish versioned context extension envelopes and encrypted/journaled persistence before pin, usage, context-manifest, compaction, overflow, recovery, and rendering stories.

6. **Freeze and mechanically validate `ux-state-v1` in Epic 2.** Define every display token, JSON token, dimension, terminality, exit class/code, cause, retryability, recovery, narrow form, and Thai-capable explanation. Treat Story 7.18 as certification of an existing contract.

7. **Add a brownfield-baseline acceptance story.** Prove the existing `cli/` package builds and tests, preserve the headless `CoreApp`/Ink boundary, identify current entry points and integration seams, and prohibit replacement with a generated scaffold or wholesale rewrite.

8. **Separate safety caps from performance budgets.** Define required artifact, recursion, search, process, Prompt Round, and transfer ceilings before consuming stories. Leave user-facing latency SLOs and NFR-14 certification to the approved performance-budget gate.

9. **Make fixtures reproducible.** Assign stable fixture IDs and hashes; specify exact prompts, inputs, normalized outputs, tolerances, failure variants, retry classes, backoff policy, and platform environments for Specialist, C++, recovery, and UX tests.

10. **Split oversized certification stories.** Decompose Story 7.7, platform continuity stories, UX audit suites, and evidence assembly into independently owned evidence producers followed by small aggregate gate stories.

11. **Add an explicit story dependency graph.** Record `dependsOn` for every story and mechanically reject edges to later stories or epics, except certification stories that consume already completed evidence without defining runtime behavior.

12. **Re-run implementation readiness after correction.** Exit criteria should be: no unresolved normative conflict, no feature dependency on Epic 7 decisions, no forward persistence dependency, mechanically coherent state/exit contracts, independently completable stories, and reproducible fixtures.

### What Can Proceed Safely Now

- Correction and approval of the three prerequisite decisions.
- Refinement of PRD, Architecture Spine, UX state registry, and epic dependency metadata.
- Brownfield baseline characterization of the existing `cli/` prototype.
- Implementation planning or time-boxed spikes for CoreProtocolV1, the durable journal, encrypted store envelopes, OS credential/key adapters, and Sanitizer—provided they avoid selecting the unresolved invalid-proposal behavior.
- Test-harness design for deterministic fixtures and platform enforcement, without claiming feature-story completion.

Effectful Workspace tools, the canonical C++ proof, actual Specialist transfers, provider deletion behavior, and structured-proposal dispatch should wait for their named decisions and contracts.

### Final Note

This reassessment identified **19 distinct planning issues across four categories**:

- **3 critical forward-dependency and normative-authority violations**
- **8 major sequencing, scope, state-contract, and story-sizing issues**
- **4 minor implementation-readiness and testability concerns**
- **4 unresolved cross-cutting release gates**: numeric performance budgets, exact model/service pins, repository/security governance, and approved provider-handling evidence

It also confirmed substantial strengths: **100% FR coverage**, no extraneous product FRs, complete UX documentation, architecture capable of supporting the intended experience, strong safety-oriented acceptance criteria, and a materially improved dependency order compared with the prior epic revision.

The correct next move is a focused correction pass, not another wholesale rewrite. Most existing acceptance detail can be preserved after prerequisite decisions are moved earlier, record foundations are reordered, and the state/fixture contracts are made mechanically coherent.

**Assessment date:** 2026-07-17  
**Assessor:** Claude Code — BMAD Implementation Readiness workflow
