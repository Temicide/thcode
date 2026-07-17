---
title: thcode Product Requirements Document
status: final
created: 2026-07-14
updated: 2026-07-17
---

# thcode Product Requirements Document

## 0. Document Purpose

This PRD defines the first public open-source release of thcode for product, UX, architecture, implementation, testing, and release planning. It distills the confirmed user journeys and source decisions into grouped capabilities with globally stable Functional Requirement IDs. Architecture mechanisms, rejected-alternative rationale, and solution details live in [addendum.md](addendum.md); source extracts and the append-only memory log preserve discovery provenance.

## 1. Vision

thcode is a production-quality terminal harness that lets Thai developers experience a Thai reasoning model as a bounded CLI agent and use AI-for-Thai specialist services as external tools. It is designed around Typhoon, Thai and Thai-English interaction, prompt-driven service selection, local tool control, explicit permissions, inspectable evidence, and honest failure behavior.

The immediate opportunity is curiosity. Thai developers already have access to mature frontier-model coding agents, while current Thai models are not competitive for serious coding work. thcode therefore does not promise better coding productivity. It makes a narrower, defensible promise: a developer can install one polished CLI, connect Typhoon and AI-for-Thai with separate keys, prove that Typhoon can operate a real local tool loop, and explore four Thai specialist services without inflated capability claims.

Production quality applies to the harness rather than to the intelligence of the underlying model. Credentials, boundaries, consent, service health, recovery, rollback, session continuity, context governance, and explanations must remain trustworthy even when Typhoon or a remote service performs poorly. The unifying experience principle is legibility: actions remain visible, deterministic Evidence precedes model explanation, and uncertainty is preserved rather than smoothed over.

## 2. Target User

The first-release user is a Thai-speaking or Thai-English-speaking developer who is comfortable with a terminal, curious about Thai models and Thai AI services, and willing to bring their own API credentials. Nok in the journeys represents this user inline; there is no separate persona model.

### 2.1 Jobs To Be Done

- Experience Typhoon responding naturally to Thai or mixed Thai-English prompts.
- Prove that Typhoon can inspect a bounded workspace, call essential local tools, create and execute a small program, and verify the result.
- Invoke T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition through natural prompts rather than hand-wiring each service.
- Understand which model or service acted, what data left the machine, which permissions applied, and what evidence supports the result.
- Diagnose failed credentials, unavailable services, missing dependencies, unsafe actions, and uncertain remote outcomes without silent fallback or fabrication.
- Resume earlier experiments without restoring stale execution authority or losing control of active context.

### 2.2 Non-Users for the First Release

- Developers seeking a replacement for frontier-model coding agents or dependable production coding automation.
- Nontechnical users seeking a graphical, no-code, desktop-computer-use, web, mobile, or IDE product.
- Teams requiring Linux support, cloud-synchronized sessions, enterprise identity, or centrally managed deployment.
- Users without their own Typhoon and AI-for-Thai credentials.

### 2.3 Key User Journeys

### UJ-1 — Nok’s curiosity-driven first experience

**Protagonist and context.** Nok is a Thai developer who already knows that mature frontier-model coding agents exist and that current Thai models are not competitive for serious coding work. He is curious—but skeptical—about what a CLI purpose-built for Thai reasoning models and Thai specialist AI services can do today.

**Trigger.** Nok encounters thcode positioned as a Thai-focused CLI agent whose harness and terminal experience are tuned for Thai models and can use AI-for-Thai specialist services. Curiosity about an experience he has not tried before motivates him to install it.

**Journey.**

1. Nok installs thcode and launches it by entering `thcode` in his terminal.
2. The first-run experience explains that the release uses Typhoon, provided by SCBx, and asks him to enter his Typhoon API key.
3. Nok enters his Typhoon API key in the protected form and submits it.
4. thcode runs a live availability check. When the check passes, it opens the normal terminal interface.
5. Nok sends a low-risk first prompt such as “hello world” and receives a conversational response, confirming that the model connection works.
6. Later, Nok references an image of a document and asks thcode to extract its text. Because no AI-for-Thai credential is configured yet, thcode explains what is missing and opens the specialist-service connection flow.
7. Nok enters a separate AI-for-Thai API key, distinct from his Typhoon reasoning-provider key. thcode verifies the key and service availability, then lets him retry the OCR task.
8. thcode routes the document image through the configured AI-for-Thai OCR extension and supplies the OCR result to the reasoning experience.
9. thcode returns the extracted document text to Nok without inventing content that the OCR service did not recognize.
10. Nok explores the product controls through slash commands: inspecting Typhoon status and capabilities, configuring settings, inspecting usage, changing permissions, and switching between Plan and Build modes.

**Critical trust moments.** Nok needs immediate clarity about which provider he is connecting, whether each separate API key and service is healthy, which OCR service receives the document image, what data leaves his machine, and which work mode and permission profile are active.

**Successful outcome.** Nok gets a fast, honest first-hand experience with a Thai model, successfully extracts text from a document image through an AI-for-Thai OCR extension, sees the model's capabilities and limitations without inflated claims, and understands that the terminal gives him explicit control over models, services, usage, permissions, and work mode.

### UJ-2 — Nok explores the AI-for-Thai service catalog

**Protagonist and context.** After completing the OCR example, Nok is curious about what else the same AI-for-Thai connection can do. He is exploring capabilities rather than depending on thcode for production coding work.

**Journey.**

1. Nok keeps the AI-for-Thai API key that he configured during UJ-1; he does not connect a separate credential for every service covered by that key.
2. Nok enters a natural-language prompt that implies a specialist capability, such as transcribing Thai audio, extracting a Thai address, or identifying named entities.
3. thcode interprets the request, identifies the relevant available AI-for-Thai service, and shows which service and user data the proposed call will involve.
4. After any required consent, thcode invokes the service and returns its result through the conversation so Nok can inspect it or continue prompting from it.
5. Nok repeats the pattern with other available services, discovering the breadth of the catalog through tasks rather than manually wiring each integration.
6. When a service is unavailable, unsupported, unhealthy, or outside the key's entitlement or quota, thcode explains that state instead of silently substituting another service or fabricating a result.

**Critical trust moments.** Nok must be able to see which specialist service was selected, why it is relevant, what content will leave his machine, whether the service is healthy and authorized, and which result came from the service rather than the reasoning model.

**Successful outcome.** Nok experiences several Thai specialist capabilities through one coherent prompt-first interface, understands the limits and evidence behind each result, and has a concrete experience worth sharing with another curious Thai developer.

### UJ-3 — Nok diagnoses and recovers an unhealthy specialist service

**Protagonist and context.** While exploring the AI-for-Thai catalog, Nok invokes a specialist service that appeared available but fails during a real request because its configured protocol or connection is no longer valid.

**Journey.**

1. Nok enters a prompt whose task requires a particular AI-for-Thai specialist service.
2. thcode attempts the call through the configured service contract; the request fails with inspectable network or protocol evidence.
3. thcode derives a deterministic failure category, presents Nok with a plain-language explanation, and retains sanitized evidence for inspection without exposing credentials.
4. thcode scopes the unhealthy state to the evidence: a service-specific protocol failure quarantines only that service, while rejection of the shared AI-for-Thai Key makes the shared connection and all dependent services unavailable. It does not silently reinterpret the protocol, substitute another service, or invent a result.
5. Nok corrects the relevant configuration or credential condition and explicitly requests a retest through the service-management experience.
6. A passing live retest returns the affected service to the available catalog. Nok retries his prompt and continues exploring.
7. Service-specific entitlement, quota, unsupported-input, timeout, network, rate-limit, and upstream-server states remain visibly distinct from protocol-health and shared-credential failure so Nok knows what action is possible.

**Critical trust moments.** The failure explanation must remain anchored to deterministic evidence; credentials must remain hidden; the unavailable state must be unmistakable; and recovery must require an explicit retest rather than an invisible workaround.

**Successful outcome.** Nok understands what failed, sees that thcode did not fabricate or conceal the problem, repairs the condition when possible, and restores the service without losing trust in the rest of the catalog.

**Release scope.** This journey is required in the first public release. Service-specific protocol quarantine and retesting apply only to the failing configuration. A deterministically rejected shared AI-for-Thai Key makes the connection and all dependent services unavailable until the credential is corrected and retested.

### UJ-4 — Nok proves a Thai model can complete a bounded CLI-agent task

**Protagonist and context.** Nok wants to test whether a Typhoon model can use a real local-agent loop, even though he does not expect it to match frontier coding models. He starts in a bounded workspace on a supported machine with a C++ compiler already installed.

**Journey.**

1. Nok launches thcode with Typhoon selected as the reasoning model and asks it to create a C++ file that prints `Hello, World!`.
2. thcode interprets this as a local coding task. It does not invoke AI-for-Thai because the request contains no artifact or specialist capability that requires an external service.
3. The agent inspects the bounded workspace and checks whether an appropriate C++ compiler is available without installing anything. If the compiler is missing or cannot be invoked, thcode stops the execution path, explains the detected prerequisite problem, and gives actionable guidance for installing a supported toolchain such as Clang before retrying.
4. The model proposes creation of the C++ source file. thcode validates the target path, shows the change and applicable approval, and writes the file through a controlled local tool.
5. The model proposes compilation and execution commands. thcode shows the exact commands, enforces the active work mode and permission profile, and streams the results.
6. thcode verifies that compilation exited successfully and that running the program produced the expected `Hello, World!` output.
7. Nok sees the created file, tool activity, command evidence, and final verification result in the terminal.

**Critical trust moments.** The model may propose actions, but the local harness remains authoritative over paths, mutations, commands, approvals, timeouts, cancellation, and verification. Missing compiler prerequisites produce accurate, actionable installation guidance rather than silent installation or a misleading claim that the source code failed. The harness must not invoke an unrelated external service simply because one is available.

**Successful outcome.** A Typhoon model has completed a small but genuine observe–act–verify loop using controlled local tools. The result proves technical feasibility without claiming that the model is ready for serious coding work.

**Headline acceptance evidence.** The source file exists inside the declared workspace, compilation returns exit code `0`, execution returns exit code `0`, and stdout contains the expected greeting.

**Approval behavior.** Fresh sessions start in Build mode with the Manual permission profile. In-workspace listing, reading, and searching proceed without interrupting Nok. Creating, editing, deleting, and executing commands show the proposed action and require approval; deletion is visibly destructive. Plan mode blocks all mutation. Full Access may automate only actions allowed by the active work mode and declared safety boundaries.

#### Confirmed minimum first-release tool set

- **List workspace:** inspect bounded directory structure.
- **Read file:** inspect text files within the declared workspace.
- **Search workspace:** locate files and text without broad manual reading.
- **Apply file change:** create or edit text files through an inspectable patch or equivalent change preview.
- **Delete path:** remove an in-workspace file or directory only through a clearly identified destructive action and applicable approval.
- **Run command:** execute a validated local command with visible command text, streaming output, timeout, cancellation, and orphan-process prevention.
- **Invoke specialist service:** call a capability-selected AI-for-Thai service only when the prompt and supplied artifact require it, with transfer disclosure and service provenance.

The C++ proof directly requires workspace inspection, file creation/editing, command execution, and verification. Search, deletion, and generic specialist invocation establish a small reusable CLI-agent foundation beyond the one demo. Git status and diff inspection are not required in the first public release.

### UJ-5 — Nok safely resumes a Saved Session

**Protagonist and context.** Nok has completed several Thai-model and AI-for-Thai experiments, exits thcode, and later wants to revisit one without reconstructing the conversation and evidence manually.

**Journey.**

1. Nok opens the Saved Sessions experience from any directory on the same machine and local OS account.
2. thcode shows locally saved sessions with their names, workspace associations, selected model, work mode, and context status.
3. Nok opens a session. thcode restores the complete local transcript, Typhoon selection, work mode, pinned turns, context and compaction history, referenced-artifact manifest, tool and verification history, cumulative token usage, and original workspace binding.
4. The transcript remains available for browsing while the next provider request uses a bounded Active Model Context rather than blindly resending the entire history.
5. The restored session starts a fresh Runtime Activation: its permission profile resets to Manual, and Full Access, sensitive-transfer authorization, and temporary approvals are not restored.
6. Previously approved Boundary Expansions remain in force until Nok explicitly revokes them and remain visibly inspectable after restoration.
7. If the original workspace is missing or Nok opened thcode elsewhere, the session remains visibly bound to its recorded workspace and never silently rebinds.
8. Nok continues the session after reviewing its restored context and granting any new temporary authority required for subsequent actions.

**Critical trust moments.** Sensitive session content remains machine-local; restored history must not restore stale execution authority; protected context must not be silently dropped; and a changed or missing workspace must be surfaced rather than rewritten implicitly.

**Successful outcome.** Nok regains the useful history and evidence from an earlier experiment while thcode re-establishes safe permissions and an explicit workspace boundary.

### UJ-6 — Nok recovers from an interrupted remote request

**Protagonist and context.** Nok invokes Typhoon or an AI-for-Thai service, but thcode crashes or is interrupted after dispatch and cannot prove whether the remote side completed the request.

**Journey.**

1. thcode restores all response content and evidence known to have arrived before interruption.
2. The transcript shows an explicit `Chat interrupted` marker at the exact point where reliable history ends.
3. thcode does not automatically retry the remote request, invent a missing completion, or assume that the remote side did nothing.
4. Nok inspects the preserved content and uncertainty, then deliberately decides whether and how to prompt again.

**Successful outcome.** Nok resumes from truthful recorded state without duplicated remote effects or fabricated output.

### UJ-7 — Nok safely rolls back an agent change

**Protagonist and context.** After allowing Typhoon to create, edit, or delete local files, Nok decides to undo the changes associated with a prior prompt.

**Journey.**

1. Nok selects a recent prompt-level rollback checkpoint.
2. thcode checks whether each current file state still matches the change attributable to that prompt.
3. Matching agent changes are reversed without undoing unrelated user work.
4. If a later edit overlaps a change to be reversed, thcode stops that part of the rollback and presents it for manual resolution.
5. Changed or deleted binary originals remain recoverable within the configured retention window.
6. Checkpoints expire after five subsequent prompts by default; expired rollback data is deleted.

**Critical trust moments.** Rollback must never claim success for changes it cannot safely attribute or reverse, and it must not overwrite later user edits merely to recreate an earlier state.

**Successful outcome.** Nok can reverse recent agent changes when evidence is sufficient and receives a safe, explicit conflict when it is not.

## 3. Product Promise Boundary and Guardrails

thcode is currently a curiosity-driven, experimental experience rather than a replacement for frontier-model coding agents or a dependable tool for production coding work. “Production release” describes the expected quality of the CLI harness—installation, credential handling, service connections, permissions, observability, failure behavior, and user experience—not a guarantee that current Thai models can complete real coding tasks. The product must not claim coding parity or superior coding outcomes where the underlying models cannot support them.

This boundary does not remove agent functionality. The first public release must provide the essential local tools and control loop needed to demonstrate that a Thai reasoning model can operate as a bounded CLI agent and can invoke AI-for-Thai specialist services as external tools. The intended proof is technical feasibility and an honest first-hand experience, not dependable coding productivity or parity with frontier-model agents. UJ-4 defines the confirmed minimum tool set and canonical proof task.

## 4. First Public Release Scope

### Reasoning model

The first public release supports Typhoon as its only reasoning model. Typhoon is provided by SCBx, and users connect it with their own Typhoon API key. The exact launch model identifier and adapter version are pinned before integration freeze and recorded in release Evidence. Other reasoning providers—including generic OpenAI-compatible and Anthropic connections—are not launch requirements, although the internal extension architecture may preserve a path to add them later.

### AI-for-Thai specialist services

The first public release provides working integrations for:

- T-OCR
- Speech-to-Text
- Extract Address
- Named Entity Recognition

The rest of the AI-for-Thai catalog remains visible for discovery but is labeled **Catalogued — Not available yet**. Those entries cannot be selected or invoked and must not imply verified compatibility. Catalog displays include the manifest version or observation date so users can distinguish current evidence from future intent.

The user configures the AI-for-Thai Key locally. Typhoon may propose a Specialist Service tool call, but the local thcode harness validates the proposal and calls the official AI-for-Thai endpoint itself. The key never enters Active Model Context and is never sent to SCBx or a hosted thcode component.

### Platform and distribution

The first public release supports Windows 11 version 25H2 or later through Windows Terminal with PowerShell and macOS 14 Sonoma or later through Terminal with zsh. thcode is distributed as an npm package and installed as a global CLI exposing the `thcode` command. Linux and other execution environments are deferred. Node.js 22+ is required, and clean-machine release testing uses Node.js 24 LTS. Release validation covers each minimum OS version plus the newest stable Windows and macOS versions. The baselines follow the current [Microsoft lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-11-home-and-pro) and [Apple security-release coverage](https://support.apple.com/en-us/100100).

### Open-source licensing

The first public release is distributed under the MIT License. Repository governance, contribution, security-reporting, and support policies remain to be defined before publication.

### Saved Sessions

The first public release stores Saved Sessions locally for the current OS user and machine. It restores the complete transcript and session evidence described in UJ-5 while rebuilding a bounded Active Model Context for future model calls. Sessions are not silently rebound to a new workspace, and restored runtime authority always resets to Manual. Cloud synchronization is not required for launch.

### Recovery and rollback

The first public release includes the uncertainty-preserving crash recovery in UJ-6 and the conflict-safe prompt rollback in UJ-7. Remote requests with unknown outcomes are never retried automatically. Rollback retention defaults to five subsequent prompts, is configurable, and removes expired checkpoint data.

### Context and usage governance

The first public release preserves the complete local transcript while constructing a bounded Active Model Context for each Typhoon request. It includes:

- Active Context Utilization measured against Effective Context Capacity, separate from cumulative token usage.
- A Context Donut with percentage and non-color severity signals, plus a text fallback for narrow terminals.
- A categorized `/context` view that distinguishes provider-reported token counts from estimates and cumulative input, output, and cached usage.
- Projected context sizing before every provider call, including new input, evidence, tool schemas, response reserve, and safety reserve.
- Automatic, inspectable compaction of older unpinned material when required, targeting no more than 70% utilization while preserving the complete transcript and pinned content.
- A hard stop before sending when protected content still cannot fit, with a token breakdown and explicit remedies; thcode never silently unpins, truncates, or drops protected content.

### Authoritative scope

This PRD is the authoritative and exhaustive definition of the first public release scope. The Functional Requirements (§6), Non-Functional Requirements (§7), Constraints (§8), Non-Goals (§9), and Deferred Release Decisions (§12) enumerate every Release-1 commitment: no accepted capability outside these sections is in scope, and no external document can create a release commitment. Architecture mechanisms, rejected-alternative rationale, and solution detail live in [addendum.md](addendum.md) and the project ADRs; they inform implementation but do not add product scope. Source decision and proposal documents were reconciled into this PRD (see `reconcile-decisions.md` and `reconcile-proposals.md`); any capability not carried into an FR, NFR, non-goal, or deferred item here is not part of Release 1.

### Demonstration evidence

The canonical Release-1 evidence is the C++ `Hello, World!` local-agent proof (SM-1) and the four prompt-driven Specialist Service flows (SM-2). Earlier competition-era scenarios from `docs/proposal-discovery/prototype-demo.md`—Speech-to-Text driving an Express endpoint, Extract Address driving a Next.js page, and T-OCR driving a repository landing-page task—are superseded as headline acceptance journeys and are not normative release fixtures; their reusable privacy and fixture mechanics may inform QA but do not gate the release.

## 5. Glossary

- **Active Model Context** — The bounded content assembled for the next Typhoon call. It is not the complete Chat Transcript.
- **AI-for-Thai Key** — The user-supplied credential used for entitled AI-for-Thai Specialist Services. It is distinct from the Typhoon Key.
- **Agent Loop** — The local observe–reason–propose–approve–act–verify cycle controlled by thcode.
- **Boundary Expansion** — A user-approved durable widening of a declared Workspace, command, network, service, or quota boundary. It persists across Runtime Activations until revoked and is distinct from Permission Profile, Full Access, sensitive-transfer permission, and temporary action approval.
- **Capability Registry** — The versioned manifest describing AI-for-Thai Specialist Services, evidence state, schema, entitlement, and availability.
- **Chat Transcript** — The complete machine-local conversational history retained for a Saved Session.
- **Effective Context Capacity** — The verified Typhoon context limit minus response reserve and safety margin.
- **Evidence** — Attributable information supporting a result or action, including artifact hashes, Specialist Service results, tool output, approval state, and verification.
- **Permission Profile** — Manual, Assisted, or Full Access policy controlling eligible actions independently of Work Mode.
- **Prompt Round** — One user submission through all Typhoon, local tool, and Specialist Service activity until a terminal result, refusal, or blocker.
- **Rollback Checkpoint** — Short-lived evidence that permits safe reversal of local agent changes attributable to a Prompt Round.
- **Runtime Activation** — A fresh process or restored session execution period. Temporary authority does not cross this boundary.
- **Saved Session** — A machine-local persistent record containing a Chat Transcript, workspace association, context history, and Evidence.
- **Service Configuration** — The credential-bound settings and contract used to invoke one Specialist Service.
- **Specialist Service** — An AI-for-Thai capability used as an external tool, not as the Reasoning Model.
- **Typhoon** — The SCBx-provided and only first-release Reasoning Model.
- **Typhoon Key** — The user's Typhoon credential, bound only to Typhoon's verified host and never shared with AI-for-Thai.
- **Work Mode** — Plan or Build. Work Mode determines whether mutation is structurally possible.
- **Workspace** — The user-declared local filesystem boundary within which thcode may inspect or mutate resources.

## 6. Features and Functional Requirements

### 6.1 Installation, onboarding, and connections

**Description:** A developer can install one npm CLI on native Windows or macOS, connect Typhoon during first run, and connect AI-for-Thai later when a Specialist Service is first needed. Credentials and health state remain explicit. Realizes UJ-1 and UJ-2.

#### FR-1: Cross-platform CLI installation

A developer can install thcode globally through npm and launch it with the **thcode** command on supported Windows and macOS environments.

**Consequences:**
- Windows 11 25H2 with Windows Terminal/PowerShell and macOS 14 Sonoma with Terminal/zsh are minimum release-tested environments; the newest stable OS versions are tested as well.
- Installation, update, uninstall, and first-run behavior are documented and reproducible.
- Node.js 22+ is the minimum runtime, and Node.js 24 LTS is the clean-machine release baseline.

#### FR-2: Typhoon onboarding

A first-time user can enter a Typhoon Key through a protected terminal form and complete a minimal live health check before entering the main interface.

**Consequences:**
- Typhoon is the only first-release Reasoning Model and cannot be silently replaced.
- The key is stored through the operating-system credential facility rather than project files, environment files, transcripts, or the Saved Session store.
- Before entry, thcode identifies Typhoon's verified host, explains where the key will be stored and used, and accepts it through masked input.
- A failed check explains authentication, connectivity, quota, or configuration state without exposing the key.

#### FR-3: Just-in-time AI-for-Thai connection

When a prompt first requires a Specialist Service and no AI-for-Thai Key exists, thcode explains the missing connection, opens a protected connection flow, verifies the key, and lets the user retry.

**Consequences:**
- The AI-for-Thai Key is stored separately from the Typhoon Key.
- One AI-for-Thai Key covers all entitled first-release Specialist Services; users do not enter one key per service.
- Before entry, thcode identifies the AI-for-Thai verified endpoint, explains where the key will be stored and used, and accepts it through masked, non-echoing input—the same pre-entry disclosure and protected form required for the Typhoon Key.
- Credential removal and rotation remain explicit user actions.
- The local harness stores and uses the key; Typhoon receives only the tool schema and sanitized result, never the credential.

#### FR-4: Evidence-backed availability

thcode exposes Typhoon or a Specialist Service as available only when the relevant live connectivity and authentication check passes for the effective configuration.

**Consequences:**
- Availability wording states what was tested and does not imply untested capability compatibility.
- Health evidence is associated with an effective configuration fingerprint covering credential reference/version, endpoint, service mapping, and relevant contract version.
- The UI distinguishes configured, checking, available, unavailable, and unhealthy states.
- A real Typhoon protocol failure makes the effective Typhoon configuration unavailable until correction and an explicit live retest; thcode does not silently reinterpret or repair it.

### 6.2 Thai interaction and bounded Agent Loop

**Description:** Typhoon operates through a local harness that understands Thai and mixed Thai-English intent, exposes only bounded tools, validates every proposal, and completes only with evidence. Realizes UJ-1 and UJ-4.

#### FR-5: Thai and code-switched intent

Nok can submit Thai or mixed Thai-English requests while thcode preserves technical identifiers and extracts the desired outcome, constraints, referenced artifacts, and verification criteria.

**Consequences:**
- Material ambiguity produces a clarification instead of an invented choice.
- Thailand-specific requirements are represented when stated or strongly implied, never fabricated.
- Normalized intent remains inspectable in diagnostic Evidence.

#### FR-6: Local Agent Loop

thcode runs the iterative Typhoon, local-tool, result, and verification loop on the user's machine.

**Consequences:**
- Typhoon proposals are untrusted input; the harness validates them against tool schemas, Work Mode, Permission Profile, Workspace, and hard boundaries.
- Invalid structured proposals are never executed. thcode rejects an invalid structured proposal after one local schema-validation pass; the validation error is recorded and surfaced as the terminal outcome. Release 1 makes no model repair request, provider retry, protocol reinterpretation, action substitution, or policy relaxation for an invalid proposal.
- The loop stops on a final response, verified completion, explicit user acceptance of a disclosed limitation, refusal, hard boundary, or defined error.
- Remote components cannot execute local filesystem, shell, build, or test actions directly.
- Typhoon responses may stream, but a remote request with an unknown dispatched outcome cannot be retried unless replay safety and outcome reconciliation are proven.

#### FR-7: Workspace inspection

Typhoon can list, read, and search text content only within the declared Workspace.

**Consequences:**
- Path resolution covers Windows and macOS path behavior, including spaces, case behavior, symlinks, and platform separators.
- List, read, and search do not interrupt the user under the default Manual Permission Profile when they remain within the Workspace and do not trigger a material remote transfer.
- Unsupported or out-of-Workspace paths are refused with an explanation.

#### FR-8: Inspectable file creation and editing

In Build Work Mode, Typhoon can create and edit text files through a bounded change tool.

**Consequences:**
- The target path and proposed content change are visible before approval in Manual.
- Plan Work Mode cannot authorize the mutation.
- thcode records enough before/after Evidence to support verification and Rollback Checkpoints.

#### FR-9: Controlled deletion

In Build Work Mode, Typhoon can delete an in-Workspace file or directory only as a visibly destructive action.

**Consequences:**
- Manual requires explicit approval.
- Full Access cannot delete outside the Workspace or bypass non-overridable safety rules.
- Eligible deleted content participates in rollback retention.

#### FR-10: Controlled command execution

In Build Work Mode, Typhoon can propose and run a validated local command with exact command disclosure.

**Consequences:**
- Output streams to the terminal; the action supports timeout, cancellation, and orphan-process prevention.
- thcode validates working directory, executable, arguments, environment exposure, and policy before launch.
- Commands threatening the host operating system or resources outside the Workspace are refused.

#### FR-11: Dependency preflight

thcode can inspect project metadata and probe required runtimes, compilers, package managers, and documented commands without mutating the machine.

**Consequences:**
- Missing prerequisites produce accurate platform-specific guidance, such as installing a supported C++ compiler.
- thcode never silently installs a compiler, runtime, SDK, or package manager.
- After the user changes the environment, **/check** can repeat the preflight.
- Installation guidance comes from a maintained thcode registry or verified project documentation, not a model-invented URL or privileged command.

#### FR-12: Verified task completion

thcode completes a local task only when defined verification succeeds, the user accepts a disclosed limitation, or a blocker is reported.

**Consequences:**
- The headline proof creates a C++ source file, compiles it with exit code 0, executes it with exit code 0, and observes the expected “Hello, World!” output on both supported platforms.
- If no compiler is available, thcode reports the missing prerequisite rather than claiming a source failure.
- Git status and diff integration are not first-release requirements.

### 6.3 AI-for-Thai catalog, routing, and artifacts

**Description:** A prompt can select the relevant Specialist Service through a reviewed Capability Registry. Four integrations work at launch; the rest remain discoverable without implying support. Realizes UJ-1, UJ-2, and UJ-3.

#### FR-13: Versioned Capability Registry

thcode ships a reviewed, versioned representation of the AI-for-Thai catalog.

**Consequences:**
- Entries expose service identity, capability, supported inputs, entitlement state, evidence level, manifest version, and observation date.
- Registry metadata also records mapping or contract version, modalities, input limits, operational Evidence level, and available quota or data-handling notes.
- T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition are first-release working integrations.
- All other entries display **Catalogued — Not available yet** and cannot be invoked.

#### FR-14: Prompt-first service routing

When a prompt requires a supported Specialist Service, Typhoon can propose the relevant tool call without requiring the user to browse the registry first, and the local harness validates and executes the call.

**Consequences:**
- Only task-relevant service schemas enter Active Model Context.
- The selected service and reason are visible before invocation.
- **/tools** remains available for browsing, searching, inspecting, enabling, disabling, diagnosing, and retesting.
- The official AI-for-Thai endpoint is called from the local machine using the locally stored AI-for-Thai Key.

#### FR-15: Type-specific artifact handling

thcode can resolve explicit in-Workspace references to code, Markdown, plain text, images, audio, PDF, DOCX, and bounded directory manifests using type-specific policies.

**Consequences:**
- Each artifact is checked for Workspace containment, type, format, size, privacy policy, and service compatibility.
- Code and Markdown send only selected text; PDF and DOCX extract text locally by default; original documents transfer only when required and approved.
- Unsupported binaries send metadata only or are rejected clearly.

#### FR-16: Informed remote-transfer consent

Before material leaves the machine, thcode shows a plain-language purpose and inspectable authoritative details.

**Consequences:**
- Exact details include service, verified endpoint, method where relevant, safe payload summary, and expected side effects.
- Credentials are never included.
- Images, audio, sensitive documents, and boundary expansions require explicit authority appropriate to their risk.

#### FR-17: Attributable Specialist Service Evidence

thcode preserves the source hash, selected service, returned fields, confidence or uncertainty, empty fields, and provenance for a Specialist Service result.

**Consequences:**
- The Chat Transcript distinguishes Specialist Service output from Typhoon-generated explanation.
- Missing or uncertain fields are not invented.
- Derived Evidence is cached by source-content hash as a first-release outcome: an unchanged artifact is processed once per Service Configuration, so repeat prompts do not re-transfer or re-charge for the same input. Nok can see when cached Evidence is reused, and an explicit freshness or re-run control lets Nok force a new call regardless of the cache.
- Cache retention and deletion are coordinated with the deferred sensitive-data policy (§12 item 3); cached Evidence never contains credentials and is sanitized like any other persisted content.

#### FR-18: Honest service unavailability

thcode distinguishes missing entitlement, exhausted quota, unsupported input, transient network state, failed health check, and protocol incompatibility.

**Consequences:**
- It does not silently substitute a different service or fabricate a result.
- The user receives an actionable reason when action is possible.
- Sensitive identity, biometric, medical, or similar services remain unavailable unless a dedicated policy exists.
- Timeout, network loss, rate limit, quota exhaustion, and upstream server failure are temporary or quota states and do not quarantine a configuration after one occurrence.
- Unsupported input rejects only the current request and does not make the service unhealthy.

#### FR-19: Deterministic failure and quarantine

When a real invocation exposes an authentication, protocol, or configuration failure, thcode derives a deterministic category from sanitized evidence and scopes quarantine to the smallest configuration proven invalid.

**Consequences:**
- A service-specific entitlement or protocol failure affects only that service.
- Deterministic rejection of the shared AI-for-Thai Key makes the AI-for-Thai connection and all dependent services unavailable.
- The model-generated explanation cannot replace or contradict the deterministic category.
- The quarantined service cannot be selected again until correction and explicit retest.

#### FR-20: Explicit service retest

After correcting a Service Configuration or credential condition, Nok can initiate a live retest and restore that service only if the retest passes.

**Consequences:**
- Retest is a visible user action with progress, result, timestamp, and updated evidence.
- Retest evaluates the corrected effective configuration fingerprint; a stale pass cannot validate a changed key, endpoint, or mapping.
- thcode does not disguise background retries as an explicit retest.
- A failed retest leaves the affected service unavailable.

### 6.4 Work Modes, Permission Profiles, and boundaries

**Description:** Work Mode defines structural capability; Permission Profile governs eligible actions. Approval never replaces enforcement. Realizes UJ-1, UJ-4, UJ-5, and UJ-7.

#### FR-21: Orthogonal Work Modes

Nok can switch directly between Plan and Build without a mandatory plan-before-build gate.

**Consequences:**
- Plan is structurally read-only under every Permission Profile.
- Build permits eligible mutation and verification.
- A new interactive session starts in Build and keeps the active Work Mode visible.

#### FR-22: Permission Profiles

Nok can select Manual, Assisted, or Full Access independently of Work Mode.

**Consequences:**
- Every Runtime Activation starts in Manual.
- Assisted applies deterministic rules; any AI risk signal is advisory, cannot authorize an action, and unresolved Assisted uncertainty resolves to asking Nok rather than guessing or defaulting to act.
- Full Access suppresses eligible prompts only inside declared hard boundaries, surfaces a prominent, session-scoped activation warning that remains visible while Full Access is active, and cannot restore across Runtime Activations.
- Full Access by itself cannot approve a sensitive transfer; a sensitive transfer always requires a separate explicit override appropriate to its risk, even while Full Access is active.

#### FR-23: Progressive approval disclosure

For an action requiring approval, thcode first shows purpose and risk in plain language and allows inspection of exact authoritative details.

**Consequences:**
- Local commands show exact command text.
- File mutations show target and change; deletion is marked destructive.
- Specialist calls show verified destination and safe transfer details.

#### FR-24: Non-overridable boundaries

thcode enforces Workspace, command, network, service, quota, credential, and sensitive-transfer boundaries independently of user approval.

**Consequences:**
- Host-operating-system threats and out-of-Workspace resources are hard-refused.
- Full Access cannot erase these boundaries.
- A user-approved Boundary Expansion persists across Runtime Activations until explicitly revoked; it is stored and audited separately from temporary action approval and sensitive-transfer permission.
- [NOTE FOR PM: The implementation must define a platform/action enforcement matrix and fail-closed behavior when the required sandbox or boundary mechanism is unavailable.]

#### FR-25: Credential isolation

thcode binds each key to its exact provider or service identity and verified host.

**Consequences:**
- The Typhoon Key never reaches AI-for-Thai or a hosted thcode service.
- The AI-for-Thai Key is never reused as a Typhoon Key.
- The AI-for-Thai Key never reaches Typhoon, SCBx, or a hosted thcode service; only the local harness uses it to call the official AI-for-Thai endpoint.
- Keys never enter prompts, repository files, logs, telemetry, crash reports, Saved Sessions, action previews, or generated UI.

### 6.5 Saved Sessions and context governance

**Description:** thcode preserves full local history while controlling what reaches Typhoon and resetting authority safely. Realizes UJ-5.

#### FR-26: Saved Session lifecycle

Nok can create, list, open, rename, delete, and inspect machine-local Saved Sessions through **/session**; **/sessions** opens the same browser.

**Consequences:**
- Sessions are global to the current OS user rather than repository-local.
- The browser can distinguish current, other, and missing Workspace associations.
- Cloud sync, export/import, recovery archives, and cross-device migration are out of scope.

#### FR-27: Complete session restoration

Opening a Saved Session restores its Chat Transcript, Typhoon selection, Work Mode, pins, compaction history, artifact manifest, plans, tool and verification history, cumulative token ledger, and Workspace association.

**Consequences:**
- Repository artifacts are referenced by path, hash, metadata, and chosen derived Evidence rather than copied by default.
- API keys are not part of Saved Session data.
- Loss of the local encryption key is disclosed as unrecoverable rather than hidden behind false recovery.

#### FR-28: Safe Runtime Activation

Every new or restored Runtime Activation resets the Permission Profile to Manual and clears Full Access, temporary approvals, and sensitive-transfer authority.

**Consequences:**
- Work Mode may be restored, but execution authority is not.
- Durable Boundary Expansions remain active and inspectable until explicitly revoked.
- A Saved Session never silently rebinds to the current directory.
- A missing Workspace is explicit and blocks affected actions.

#### FR-29: Transcript and Active Model Context separation

thcode preserves the complete Chat Transcript while assembling a bounded Active Model Context from instructions, recent and pinned turns, selected Evidence, summaries, and relevant tool schemas.

**Consequences:**
- Nok can inspect what will be included verbatim, summarized, or excluded.
- Protected content is never silently dropped.
- Context transformations are recorded as session Evidence.

#### FR-30: Context and usage visibility

thcode shows Active Context Utilization against Effective Context Capacity separately from cumulative input, output, cached tokens, and model calls.

**Consequences:**
- A Context Donut uses percentage plus non-color severity state and degrades to text on narrow terminals.
- Severity bands are below 70% green, 70–84% amber, 85–94% orange, and 95–100% red, with a non-color label at every band.
- **/context** presents categorized projected and cumulative usage.
- Cumulative usage has no percentage unless Nok configures a budget.

#### FR-31: Safe compaction

Before an over-capacity call, thcode automatically compacts older unpinned material, targets no more than 70% utilization, preserves the Chat Transcript and pins, and records the transformation.

**Consequences:**
- If protected content still cannot fit, thcode stops before sending.
- The stop explains the token breakdown and remedies.
- thcode never silently unpins, truncates, or removes protected content.

### 6.6 Recovery and Rollback Checkpoints

**Description:** Crashes preserve uncertainty; rollback reverses only changes that thcode can prove safe. Realizes UJ-6 and UJ-7.

#### FR-32: Interrupted remote-request recovery

After interruption of a dispatched remote request, thcode restores all known received output and inserts **Chat interrupted** where reliable history ends.

**Consequences:**
- It does not automatically retry an unknown remote outcome.
- It does not invent a missing ending or assume the remote side did nothing.
- Nok deliberately chooses whether and how to prompt again.

#### FR-33: Prompt-level Rollback Checkpoints

Before eligible local mutation, thcode records a Rollback Checkpoint that attributes recoverable changes to the Prompt Round.

**Consequences:**
- The checkpoint covers thcode-controlled file creation, editing, and deletion.
- The rollback guarantee excludes shell-command effects, remote-service effects, permission changes, external processes, symlink side effects, and any other mutation thcode did not perform through its built-in file tools.
- Incomplete or corrupt checkpoint state is detectable and cannot be presented as complete.

#### FR-34: Conflict-safe rollback

Nok can request reversal of a recent Prompt Round, and thcode reverses only current content that still matches the attributable agent change.

**Consequences:**
- Later overlapping edits stop the affected reversal for manual resolution.
- Unrelated user work remains unchanged.
- thcode reports partial or blocked rollback honestly.
- The rollback UI states the covered built-in file changes and does not imply reversal of excluded effects from the same Prompt Round.

#### FR-35: Bounded rollback retention

Rollback Checkpoints remain available for five subsequent prompts by default, with a user-configurable retention value.

**Consequences:**
- Changed or deleted binary originals remain encrypted and available within the window.
- Each Rollback Checkpoint may retain up to 100 MB, and the total rollback store may retain up to 500 MB.
- Before an action would exceed either cap, thcode explains that the action cannot be rollback-protected and requires explicit confirmation to proceed.
- Expired data is deleted.
- Cleanup removes expired originals and checkpoint metadata without exposing their content.

### 6.7 Terminal experience, commands, and Evidence

**Description:** The TUI keeps state, risk, availability, and results understandable without forcing command memorization.

#### FR-36: Discoverable command surface

thcode provides completion and explicit controls for models, tools, status, settings, permissions, Work Mode, context, Saved Sessions, dependency checks, connections, compaction, clearing, and exit.

**Consequences:**
- **Shift+Tab** switches Plan and Build; **Tab** accepts completion; **Esc** dismisses a modal without changing its setting.
- **/models** is inspection-only and shows Typhoon identity, version, capabilities, authentication, and health without presenting a model-selection flow or implying other first-release Reasoning Models.
- **/tools** exposes the Capability Registry and service diagnostics.

#### FR-37: Persistent status and actionable explanations

The TUI keeps Typhoon, Work Mode, Permission Profile, AI-for-Thai connection, active service health, and Active Context Utilization visible or immediately inspectable.

**Consequences:**
- Plan, Build, Full Access, destructive action, unhealthy service, interruption, and rollback conflict are visually distinct.
- State does not rely on color alone.
- Missing dependencies, service refusal, blocked policy, lost encryption key, and context overflow produce truthful next steps.
- User-facing purpose, consequence, error, and completion explanations support natural Thai while preserving exact technical identifiers and commands.

#### FR-38: Action and result Evidence

For significant actions and demonstrations, thcode links the input or artifact hash, model, Specialist Service, normalized Evidence, proposed action, approval state, command output, verification result, and error state.

**Consequences:**
- Evidence remains sanitized before persistence or display.
- Every proposed and executed tool call appears in a compact activity log, including automatically permitted list, read, and search actions.
- Completion summaries say what changed, what was verified, which service contributed, and what risk remains.
- Evidence can reproduce release validation failures without containing credentials.

#### FR-39: Prompt Round observability

thcode records one end-to-end duration and correlation identity per Prompt Round while retaining subsystem timing for diagnostics.

**Consequences:**
- Active Context Utilization and cumulative token usage remain distinct.
- Deterministic failure evidence and model explanations retain separate provenance.
- Raw prompt, command, or payload export is disabled by default.

## 7. Cross-Cutting Non-Functional Requirements

### Security and privacy

- **NFR-1:** Sensitive local session content must be encrypted before persistence; credential material must remain in the platform credential facility and outside the session database.
- **NFR-2:** Sanitization must occur before content is persisted, displayed, or exported, including headers, URLs, environment values, errors, tool output, and payload summaries.
- **NFR-3:** Filesystem and command enforcement must fail closed when a required non-overridable boundary cannot be established.
- **NFR-4:** Remote services receive only deliberately selected content and never an unresolved local path as fetch authority.

### Reliability and correctness

- **NFR-5:** Command cancellation and timeout must not leave orphaned child processes.
- **NFR-6:** Health, session, Evidence, interruption, and rollback records must be crash-consistent; partial records must be detectable.
- **NFR-7:** thcode must never silently substitute a model, service, protocol mapping, missing result, or unsupported capability.
- **NFR-8:** A Specialist Service result must remain attributable to the exact source artifact and Service Configuration.

### Compatibility and accessibility

- **NFR-9:** Thai input and output must remain valid UTF-8 across supported terminals, persistence, streaming, and service calls.
- **NFR-10:** Status and severity information must not rely on color alone and must remain usable in narrow terminals.
- **NFR-11:** The release must pass clean-machine installation and C++ proof validation on Windows 11 25H2, macOS 14 Sonoma, and the newest stable version of each OS.

### Performance and observability

- **NFR-12:** User-visible performance is measured by Prompt Round; subsystem latency is diagnostic detail.
- **NFR-13:** Context projection and policy checks must complete before dispatch and must not be bypassed for perceived speed.
- **NFR-14:** [NOTE FOR PM: Numeric budgets for startup, TUI response, health checks, Prompt Rounds, compaction, session restore, and service calls are not yet set.]
- **NFR-15:** Internal event and Evidence schemas must be versioned independently of any external telemetry convention.

## 8. Constraints and Guardrails

- Typhoon is the only first-release Reasoning Model.
- Working Specialist Services are limited to T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition; visible catalog entries marked unavailable are not operational commitments.
- Users supply both credentials and depend on SCBx and AI-for-Thai availability, entitlement, quotas, schemas, and data terms.
- Native Windows/PowerShell and macOS/zsh are the only first-release platform/shell commitments.
- npm remains the distribution mechanism; a standalone executable or native installer is not required.
- Source code is released under the MIT License.
- User configuration cannot execute adapter code or define slash-command implementations.
- Local filesystem, command, and AI-for-Thai invocation authority remains in the CLI. A hosted thcode proxy or artifact service is not part of the first-release request path.
- Model quality is an upstream dependency. thcode owns harness behavior and Evidence, not the correctness of Typhoon reasoning or Specialist Service output.

## 9. Non-Goals

- Replacing frontier-model coding agents or claiming superior coding outcomes.
- Supporting Reasoning Models other than Typhoon in the first release.
- Making unavailable AI-for-Thai catalog entries invokable or implying full-catalog operational support.
- Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, web, desktop GUI, mobile, IDE, or autonomous computer-use support.
- Git status or diff integration.
- Silent installation of runtimes, compilers, package managers, SDKs, or dependencies.
- Cloud session synchronization, cross-device identity, export/import, recovery archives, or migration.
- Proxying the user's AI-for-Thai Key or Specialist Service payloads through a hosted thcode service.
- Executable user adapters, user-defined slash-command code, or silent protocol repair.
- Repairing or re-prompting imperfect Typhoon tool output through a Thai Agent Compatibility Layer in the first release. thcode validates structured proposals and rejects invalid ones after one local schema-validation pass (FR-6); action repair, retry loops for invalid tool calls, and any policy relaxation are not first-release behavior. Release-1 differentiation rests on honest Thai interaction, bounded routing, inspectable evidence, and legibility—not on output repair.
- Automatically retrying uncertain remote effects or promising rollback for effects thcode cannot observe and verify.
- Guaranteeing model judgment, service availability, upstream credentials, quota, or third-party data correctness.

## 10. Success Measures

### Primary

- **SM-1 — Local Agent Loop proof:** On a clean supported Windows environment and a clean supported macOS environment with a documented C++ compiler installed, Typhoon completes UJ-4: it uses the required local tools, creates the source file, compiles with exit code 0, runs with exit code 0, and produces the expected greeting. Target: pass on both release environments. Validates FR-5 through FR-12 and FR-21 through FR-25.
- **SM-2 — Four-service proof:** Each of T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition passes a repeatable live contract test and at least one prompt-driven end-to-end flow using the configured AI-for-Thai Key. Target: 4 of 4. Validates FR-3, FR-13 through FR-20.

### Secondary release-quality gates

- **SM-3 — Health recovery:** Each working Specialist Service demonstrates deterministic service-specific failure presentation, scoped quarantine, and explicit successful retest without disabling unrelated services; a separate shared-key fixture makes all four dependent services unavailable. Target: all five fixtures pass. Validates FR-18 through FR-20.
- **SM-4 — Safe continuity:** Saved Session restore, interrupted-request recovery, context preservation, and eligible rollback pass their release fixtures on both supported platforms. Target: all critical fixtures pass. Validates FR-26 through FR-35.

### Counter-metrics

- **SM-C1 — Unauthorized effects:** Zero release-validation cases in which Plan mutates, an action escapes the Workspace, or a material transfer or Manual mutation occurs without required approval. Counterbalances SM-1.
- **SM-C2 — Credential exposure:** Zero Typhoon or AI-for-Thai credentials in repository files, prompts, transcripts, session storage, logs, telemetry, action previews, or reports. Counterbalances SM-2.
- **SM-C3 — False capability:** Zero invocations of entries labeled **Catalogued — Not available yet**, and zero fabricated missing Specialist Service fields in validation fixtures. Counterbalances SM-2.
- **SM-C4 — Inflated positioning:** No public claim of coding parity, superiority, or “first Thai CLI agent” without separate substantiation. Counterbalances adoption pressure.

No adoption, retention, or revenue target is required for this release; the confirmed product objective is technical capability proof.

## 11. Principal Risks and Mitigations

- **Underlying model limitation:** Typhoon may fail even simple structured actions. Mitigate with a bounded proof, strict schema validation, honest blockers, and no productivity claim.
- **External service dependency:** Keys, quota, schemas, latency, and data terms may change. Mitigate with live contract tests, dated registry evidence, explicit states, and no unavailable-service fallback.
- **Scope concentration:** Sessions, context governance, crash recovery, rollback, two platforms, and four services make the first release large. Mitigate with independent acceptance fixtures and stable FR-level ownership.
- **Cross-platform boundary gaps:** Windows and macOS differ in paths, shells, processes, credential stores, and sandboxing. Mitigate with a platform/action enforcement matrix and fail-closed release tests.
- **Rollback overclaim:** Shell or external effects may be unobservable. Mitigate with an explicit coverage matrix, attributable checkpoints, conflict stops, and precise user-facing wording.
- **Sensitive artifact transfer:** Images, audio, documents, addresses, and source can contain private data. Mitigate with type-specific handling, destination-specific consent, data minimization, redaction, and provenance.
- **Open-source reputation:** Inflated novelty or capability claims would damage trust. Mitigate with purpose-built-for-Thai positioning, dated evidence, non-goals, and public limitations.

## 12. Deferred Release Decisions

These items do not block PRD finalization, UX planning, or initial architecture. They remain mandatory gates before the stated milestones.

1. **Repository governance** — Owner: Temicide. Define maintainer authority, contribution policy, private security-reporting channel, and support expectations before the public repository is published.
2. **Numeric performance budgets** — Owner: engineering/QA. Set targets for startup, TUI response, health checks, Prompt Rounds, compaction, session restore, and each Specialist Service before the release candidate is approved.
3. **Sensitive-data policy** — Owner: product/security. Define classification, consent language, local retention and deletion, and upstream data-handling disclosure before affected AI-for-Thai services are publicly enabled.
4. **Platform enforcement matrix** — Owner: architecture/security. Document Windows and macOS enforcement for Workspace, command, process, network, and fail-closed behavior before implementation sign-off.
5. **Exact Typhoon release pin** — Owner: product/engineering. Record the launch model identifier, endpoint contract, and adapter version before integration freeze and include them in release Evidence.

## 12.1 Approved Prerequisites Before Feature Epics

The following normative decisions are **approved before the consuming feature epics begin**, not later release gates. They are separated from the deferred release decisions above because implementation of Epic 3 (effectful local coding task) and Epic 4 (Specialist Services with transfers) depends on them as runtime contracts rather than release certifications.

- **PR-1 — Invalid structured-proposal behavior.** An invalid structured proposal is rejected after one local schema-validation pass; the validation error is recorded and surfaced as the terminal outcome. Release 1 makes no model repair request, provider retry, protocol reinterpretation, action substitution, or policy relaxation. This is the single authoritative rule for FR-6 and AD-14; no later epic or story may re-decide it. (Resolves Deferred Decision 5's structured-proposal dimension; the exact Typhoon model pin remains deferred.)
- **PR-2 — Sensitive-data and Remote Data Authority policy.** Specialist transfers use an approved, versioned policy matrix. Provider retention/deletion handling must be verified and permitted for the exact configuration and data class before any payload is prepared for transport. No-retention is preferred but not universally required. Provider-side deletion lifecycle states apply only when the provider contract supports them; if the contract does not support deletion, transfer is `BLOCKED` rather than assumed safe. This policy is approved before Epic 4 begins and is not first created by a later certification story. (Resolves the implementation-blocking dimension of Deferred Decision 3; final release certification of full provider contracts remains a release gate.)
- **PR-3 — Platform/action enforcement matrix.** A versioned matrix specifies the required mechanism and fail-closed result for every effect on Windows and macOS before Epic 3 begins. Epic 3 implements against the approved matrix; Epic 7 may only certify the already-defined matrix, not define it for the first time. (Resolves the implementation-blocking dimension of Deferred Decision 4; release certification of the matrix remains a release gate.)
- **PR-4 — Context capacity source.** Before the exact Typhoon verified limit exists, the UI shows `percentage unavailable` and no unverified context-capacity denominator is assumed. No `128k` raw limit or `115,200` fallback capacity is a release commitment without a named provider/product decision and source.

## 13. Assumptions Index

- **A-1:** Release-1 scope is exhausted by this PRD (§4 Authoritative scope). The earlier "everything according to the docs" reading is superseded: source decision and proposal documents were reconciled into the FRs, NFRs, non-goals, and deferred items here, and nothing outside those sections is a release commitment.
- **A-2:** The C++ success fixture begins with a supported compiler installed; missing-compiler behavior is validated separately through dependency guidance.
- **A-3:** The user can obtain separate working Typhoon and AI-for-Thai credentials with entitlement to the four launch services.
- **A-4:** AI-for-Thai exposes sufficiently stable contracts for reviewed mappings, live health checks, prompt routing, and repeatable release fixtures.
- **A-5:** Platform credential facilities and encrypted local persistence can support the confirmed session and credential boundaries on both launch platforms.
