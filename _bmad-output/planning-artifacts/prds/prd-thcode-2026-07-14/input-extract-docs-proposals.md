# Source Extract: Proposal Discovery Documents

## Source and extraction scope

- Source directory: `docs/proposal-discovery/`.
- Read in full: `README.md`, `access-validation-plan.md`, `competitive-landscape.md`, `delivery-plan.md`, `differentiation-options.md`, `domain-model.md`, `glossary.md`, `model-capabilities.md`, `opencode-comparison.md`, `prototype-demo.md`, and `terminal-interface.md`.
- Comparison source: `input-extract-brainstorm.md`, the existing extraction from the production-foundation brainstorm.
- This document distills proposal-discovery material for PRD creation. It distinguishes accepted product decisions from hypotheses and open items; it does not promote competition-specific proposals or implementation mechanisms into requirements without noting their status.

## Executive synthesis

The proposal work turns thcode from an architecture-led production-hardening effort into a product with a clear first wedge: an open-source, Thai-first coding agent for Thai-speaking students, junior developers, and developers in small teams, initially running natively on Windows and focused on Node.js, TypeScript, and web repositories. Users issue Thai or Thai-English instructions and explicitly reference repository artifacts such as code, documents, images, and audio. thcode interprets the request, processes selected artifacts through Thai AI services when needed, proposes safe local actions, obtains appropriate approval, edits the repository locally, and verifies the result.

The durable product thesis is not “a CLI that connects to a Thai model.” OpenCode and Typhoon's own MCP example already cover much of that ground. The defensible target is a Thai Agent Compatibility Layer for software engineering: compile colloquial Thai developer intent into a structured task, detect material ambiguity, expose only relevant Thai-service schemas, convert mixed artifacts into normalized evidence for text-only models, validate model-proposed actions, govern context, preserve a distributed safety boundary, and measure whether this improves outcomes over an OpenCode baseline using the same model and tools.

The local CLI owns the agent loop, repository access, provider credentials, permission checks, action validation, execution, verification, sessions, and context. In the near-term prototype it calls Typhoon directly and, when available, calls selected AI for Thai tools directly using separate locally stored credentials. The intended onboarded service is a Dockerized Artifact Intelligence API that receives only explicitly approved artifacts or bounded context, routes them through appropriate AI for Thai services, and returns normalized evidence. The hosted service never receives the developer's Typhoon key and never gains direct access to the workstation or repository.

The source is strong on target user, interaction contract, demonstrations, risk boundaries, and comparative evaluation. It remains weak or internally inconsistent on the exact competition delivery boundary, the Phase 1 versus Phase 2 hosted-service credential flow, quantitative production targets, business/adoption strategy, and whether broad provider/service extensibility from the brainstorm belongs in the first release or only the foundation/roadmap.

## Product vision and problem

### Long-term vision

thcode is intended to become a Thai-first general-purpose agent for people who want to build applications, understand mixed media, and complete computer-based work through natural Thai instructions. The coding-agent CLI is the product wedge, not the end-state. Its local agent loop, permission system, tool execution, context handling, and remote reasoning interface are meant to support later non-developer and multimodal clients.

### First-release vision

Deliver an open-source, downloadable, terminal-based coding agent that makes Thai reasoning models and AI for Thai specialist services usable in a reliable software-engineering loop. The agent should accept Thai and Thai-English requests, understand explicitly referenced repository artifacts, safely modify local code, and provide verifiable outcomes while protecting credentials and repository boundaries.

### User problem

Thai-speaking developers can connect generic coding harnesses to Thai-capable models, but the resulting workflow is not reliably adapted to their needs:

- Natural requests often mix colloquial Thai, English technical terms, omitted subjects, local conventions, and artifact references.
- Some Thai reasoning endpoints are text-only, so screenshots, mockups, images, office documents, and audio cannot be used directly.
- Exposing a large AI-service or MCP catalog consumes context and leaves tool selection and schema reliability to the model.
- Structured tool calls from a model may be invalid, unsafe, or incompatible with local policy.
- Generic agents do not necessarily surface Thai-specific ambiguity, application conventions, or data-handling consequences clearly.
- Developers should not have to upload a whole repository or give a hosted service direct access to their workstation merely to use Thai AI capabilities.

The user observation behind the multimodal wedge is that local or openly accessible models in coding workflows often cannot inspect images. A developer therefore cannot reliably use a screenshot, visual error, mockup, or diagram as task context. This pain is accepted as real, but the proposal documents do not yet settle the single highest-value image class. The competition demonstrations instead prove separate OCR, speech-to-text, and address-extraction workflows.

## Primary users, stakeholders, and jobs

### First Target User — accepted

A Thai-speaking student, junior developer, or developer in a small team who:

- uses native Windows;
- mainly works in Node.js, TypeScript, or web repositories;
- prefers to describe software work in Thai or Thai-English;
- may provide screenshots, images, audio, text documents, PDFs, DOCX, or repository files as context;
- can inspect a plan, proposed changes, commands, and results;
- expects the agent to ask before transferring material or taking sensitive actions.

The first release should not be framed as serving all developers or all computer users equally. Native Windows web-development work is the explicit entry point.

### Primary jobs to be done

- Turn a natural Thai request, including code-switched terminology and explicit artifact references, into a precise software task and acceptance checks.
- Understand a mixed artifact even when the selected reasoning model cannot consume its raw modality.
- Discover the relevant repository structure and files rather than relying on framework assumptions.
- Review a read-only plan, understand intended transfers and actions, then approve bounded implementation work.
- Apply repository changes locally and verify them with the project's actual commands.
- Know which model and Thai service were used, what evidence was derived, what changed, and whether verification passed.
- Resume a prior local session without silently restoring elevated authority or changing the workspace binding.
- Understand active model-context pressure and intervene when protected context cannot fit.

### Other stakeholders

- **Service operator:** packages, deploys, monitors, and documents the onboarded API.
- **AI for Thai platform:** hosts the submitted service and supplies specialist Thai AI APIs.
- **Reasoning-model and specialist-service providers:** perform inference and modality-specific extraction.
- **Open-source maintainers and contributors:** maintain provider adapters, tool mappings, policy behavior, and supported-platform contracts.
- **Competition reviewers:** evaluate usefulness, novelty, feasibility, Thai-technology use, safety, and service readiness.
- **Security-conscious users or organizational owners:** care about workspace, transfer, credentials, auditability, and permission boundaries.

## Positioning and differentiation

### Recommended positioning

> thcode is a downloadable Thai-first coding agent powered by a Thai Agent Compatibility Layer. It adapts Thai models for software-engineering loops by compiling Thai intent, converting explicitly referenced mixed artifacts, dynamically routing Thai AI services, and validating safe local coding actions.

The intended onboarded component is described more narrowly as the Artifact Intelligence API: it processes explicitly approved artifacts, selects specialist services, and returns normalized evidence without repository or local-tool authority.

### Defensible market/category claim

The current AI for Thai catalog does not appear to contain a developer-oriented agent service that converts Thai requests and mixed repository artifacts into capability-aware Thai AI service calls and safe local coding actions. Any final claim should state the catalog/search scope and observation date rather than claim universal novelty.

### Claims that must not be made

- “The first Thai LLM CLI agent ever.”
- “No Thai developer has built a coding-agent harness.”
- “Thai models cannot use tools.”
- “Existing coding agents cannot connect to Typhoon.”
- “thcode is better than OpenCode” before a fair same-model, same-tools benchmark shows a material benefit.

### Differentiators that must be demonstrated as system behavior

1. **Thai intent compilation:** normalize Thai/code-switched requests into a typed coding task, surface Thailand-specific requirements, and ask about material ambiguity.
2. **Mixed-artifact conversion:** process code, Markdown, images, audio, PDF, DOCX, text, and directory manifests through type-specific policies and convert them to normalized evidence appropriate to the reasoning model.
3. **Capability-aware Thai service routing:** search a verified registry and expose only relevant schemas rather than load a complete tool catalog into context.
4. **Validated local actions:** validate, repair, retry, or reject structured actions against tool schemas, workspace rules, and permission policy before local execution.
5. **Context governance:** select, rank, compress, cache, and budget repository and tool context for the selected Thai model.
6. **Distributed safety:** remote services cannot browse the repository or invoke local tools; all material crosses the boundary through explicit artifact selection and local consent.
7. **Thai trust experience:** explain ambiguity, transfers, commands, consequences, and completion status naturally in Thai.
8. **Thailand-aware application engineering:** recognize relevant Thai-language and local conventions such as address structure, Thai text normalization, Buddhist Era display versus ISO storage, fonts/localization, and PDPA-sensitive material. These are evaluation categories, not blanket automatic behavior.

Mixed artifacts, a terminal UI, model selection, permissions, repository tools, MCP connectivity, and attachment handling are valuable but are not independently defensible differentiators because OpenCode already supplies comparable primitives.

### Competitive proof requirement

Compare thcode with the current OpenCode release using:

- the same Typhoon model;
- the same selected AI for Thai services;
- equivalent local permissions;
- the same repository commits and task fixtures.

The task set should contain at least 20 reproducible cases spanning Thai-only and code-switched requests, intentional ambiguity, image or document context, multi-file repository work, a Thailand-specific application requirement, and unsafe/out-of-workspace attempts.

Measure passing tests or acceptance checks, relevant-file selection, valid tool-call rate, AI for Thai tool-selection accuracy, context/tool-schema tokens, model turns, service calls, wall-clock time, user interventions, and blocked policy violations. A positive positioning claim requires a material improvement in at least one meaningful outcome without materially worsening the others.

## Product form and initial operating scope

### Form factor — accepted

- Competition prototype and first wedge: interactive CLI/TUI only.
- The hosted compatibility/artifact service has an API but no separate end-user UI.
- Deferred: web, desktop, mobile, IDE, and autonomous computer-use interfaces.
- The terminal owns starting sessions, first-run setup, artifact references, model/tool inspection, work-mode selection, permission selection, plans, approvals, diffs, verification evidence, sessions, and context inspection.

### Platform order — accepted

1. Native Windows prototype.
2. macOS support.
3. Linux support.

The Windows prototype runs in Windows Terminal, uses PowerShell and Windows paths, and does not support WSL. Missing prerequisites should yield actionable guidance and must not trigger silent installation.

### Initial technology/workload boundary — accepted product scope

- Primary repositories: Node.js, TypeScript, and web projects.
- The agent may support another language for a smoke test, but C++ is not a product requirement.
- The first release must inspect project structure and commands rather than assume Next.js, Express, a package version, or a test framework.

## Core user experience and journeys

The proposal sources specify workflows but do not provide named protagonists or observed user narratives. These should be converted into formal PRD journeys only after the product owner confirms representative people and real-session context.

### Journey A: first-run setup and model/tool connection

1. A developer launches `thcode` from a native Windows terminal.
2. The CLI identifies supported reasoning adapters and makes Typhoon the competition default.
3. The developer supplies a Typhoon credential, which is verified and stored locally in the OS credential store.
4. The developer may separately connect AI for Thai tools using an AI for Thai key.
5. Unconfigured or unreachable optional models remain visibly unavailable; AI for Thai specialist services appear in `/tools`, not `/models`.
6. The developer begins a session with the selected model and an explicit workspace boundary.

### Journey B: artifact-assisted Plan-to-Build coding task

1. The developer gives a Thai request and explicitly references a repository artifact with `@path`.
2. thcode validates that the path is inside the workspace, detects the type, checks size/privacy rules, and identifies the destination service.
3. The developer sees what will leave the workstation and grants or refuses transfer consent.
4. The selected AI for Thai service returns normalized evidence; uncertainty and missing fields remain visible rather than being invented.
5. Typhoon inspects relevant repository structure and dependency state.
6. In Plan Mode, the agent proposes affected files, actions, verification, and risk without mutation.
7. The developer explicitly enters Build Mode and approves actions according to the active Permission Profile.
8. thcode applies bounded local changes, runs the repository's verification command, and reports the diff, command output, model, tool/service, evidence hash, and outcome without exposing credentials.

Plan and Build are independently selectable; a Plan-to-Build sequence is recommended for the demonstrations but is not mandatory product state.

### Journey C: saved session restoration

1. The developer opens `/session` or `/sessions` and filters local Saved Sessions.
2. The browser shows name, model, work mode, context use, and workspace association.
3. Opening a session restores its transcript, selected model, work mode, pins, context history, artifacts, plan/tool/verification history, token ledger, and workspace binding.
4. The complete transcript remains browsable, while the next model request uses a bounded Active Model Context.
5. A new Runtime Activation resets permissions to Manual; Full Access, sensitive-transfer authority, and temporary approvals do not survive.
6. Opening from another directory never silently rebinds the session workspace.

### Journey D: context pressure and compaction

1. The Context Donut reports Active Context Utilization against safe effective capacity, not cumulative session tokens.
2. `/context` reveals a categorized token breakdown and distinguishes provider-reported counts from estimates.
3. Before an over-capacity request, thcode compacts automatically, preserves the complete local transcript and pinned turns, targets no more than 70%, and records an inspectable event.
4. If protected content still cannot fit, the provider call is blocked and the developer must unpin, reduce evidence, adjust reserves, or switch models; protected content is never silently dropped.

### Journey E: independent demo portfolio

Three short demonstrations prove tool breadth without creating a single brittle dependency chain:

- A Thai audio request becomes a tested Express `GET /info` endpoint through Speech-to-Text.
- A synthetic Thai address becomes a typed Next.js `/address-preview` page through Extract Address.
- A repository logo image guides replacement of the default Next.js homepage through T-OCR, followed by a passing production build.

Failure of one service must not prevent another scenario from running.

## Feature and capability scope

### 1. Local coding-agent loop

- Run the iterative reasoning, local tool, result, and verification loop on the developer's machine.
- Keep repository search, file reading, patching, shell commands, tests, session state, permissions, action validation, and verification local.
- Stop on a final model response, a policy refusal, a hard boundary, or a defined error/termination condition.
- The hosted service can return normalized evidence or propose structured information; it cannot directly execute local actions.

### 2. Thai developer intent handling

- Accept Thai and Thai-English developer instructions.
- Produce a normalized task representation with desired outcome, constraints, relevant artifacts, affected context, and verification criteria.
- Ask clarification questions when ambiguity would materially change the implementation or outcome.
- Preserve English identifiers and technical terms appropriately rather than forcing literal translation.
- Identify relevant Thailand-specific application requirements without inventing them when they are absent.

### 3. Explicit artifact references and type-specific handling

- Resolve explicitly referenced repository paths for code, Markdown, images, audio, plain text, PDF, DOCX, and directory manifests.
- Validate workspace containment, file type, supported format, size, and privacy policy before use.
- Name the destination service and obtain consent before material leaves the workstation.
- Use native model modality only when the exact selected endpoint is verified to support it.
- Otherwise derive normalized evidence through an appropriate AI for Thai specialist service.
- Cache derived evidence by content hash so an unchanged artifact need not consume another service call.
- Preserve source hash, returned fields, confidence/uncertainty, empty fields, and provenance.
- Never fabricate data absent from a specialist-service response.

### 4. Reasoning-model adapters and explicit selection

- Typhoon is the required/default reasoning model for the competition MVP.
- `/models` lists configured and reachable reasoning adapters with capability and availability metadata.
- Model changes are explicit; thcode must not silently fall back to another provider with different capability or data handling.
- Pathumma, THaLLE, OpenThaiGPT, or other adapters appear only when a working endpoint/adapter and locally stored credential are available.
- AI for Thai specialist services remain tools in `/tools`, not reasoning models.

### 5. AI for Thai catalog and capability registry

- Represent the full current AI for Thai catalog in a versioned, reviewed manifest as a compatibility target.
- Allow users to search the tool registry by category/capability.
- Distinguish catalogued, integrated, verified, and demo-certified services.
- Select and reveal only schemas relevant to the current task.
- Do not scrape the public website at CLI startup; show the manifest version and observation date.
- Do not imply operational support merely because a service is catalogued.

Operational evidence for the first release is deliberately narrower:

- Named Entity Recognition: passing live contract test.
- T-OCR: verified and demo-certified.
- Speech-to-Text: verified and demo-certified.
- Extract Address: verified and demo-certified.

### 6. Work modes and permissions

- Plan and Build are orthogonal to Permission Profile.
- Plan structurally excludes mutation even when the profile is Full Access.
- Build enables mutation subject to Manual, Assisted, or Full Access policy.
- A new interactive session starts in Build Mode with Manual permissions.
- Manual asks before material remote transfers, changes, commands, and sensitive actions.
- Assisted applies deterministic policy and hard rules, then may use an AI risk classifier only as an advisory signal; the proposing model cannot authorize itself.
- Full Access skips per-action prompts within declared hard boundaries but cannot expose credentials, override Plan's read-only contract, or disable non-negotiable security rules.
- Sensitive transfer requires separate authority.
- `/permissions` presents an interactive selector and an additional Full Access warning.
- Work Mode, model, permission profile, AI for Thai connection, and active-context status remain visible.

### 7. Dependency preflight

- Inspect required runtimes, compilers, package managers, and project commands before proposing execution.
- Report missing dependencies with platform-specific, documented guidance.
- Do not silently install a compiler, runtime, or package manager.
- Installation requires an explicit user decision and remains unavailable in Plan Mode.
- If verification cannot run, state that code can be generated but cannot yet be verified.

### 8. Saved Sessions and local history

- Provide `/session new|list|open|rename|delete|info`; `/sessions` opens the same browser.
- Store Saved Sessions for the current OS user outside individual repositories.
- Preserve the complete chat transcript locally and distinguish it from Active Model Context.
- Retain paths, hashes, metadata, and deliberately retained evidence for referenced files rather than copying repository files into session storage by default.
- Restore model, Work Mode, pins, compaction history, artifact manifest, plans, tool/verification history, token ledger, and workspace association.
- Reset authority to Manual on each Runtime Activation; do not restore Full Access, transfer consent, or temporary approvals.
- Do not include API keys in session data.
- Do not silently rebind a session to the current directory.
- Prototype exclusions: export/import, cloud synchronization, recovery archive, and cross-device migration.
- Make loss of the local encryption key an explicit unrecoverable state rather than promise false recovery.

### 9. Active context and token visibility

- Show Active Context Utilization as a numeric percentage and non-color-only state near the prompt composer.
- Use Effective Context Capacity as the denominator: verified model limit minus response reserve and safety margin.
- Keep cumulative input/output/cached tokens and model calls separate; cumulative usage has no percentage unless the user configures a budget.
- `/context` breaks down system instructions, recent chat, pinned turns, summaries, workspace evidence, tool schemas/results, reserves, margins, and cumulative usage.
- Compact automatically before an over-capacity call, target at most 70%, preserve complete local transcript and pinned turns, and record the transformation.
- Block rather than silently discard protected context if compaction remains insufficient.

### 10. Audit and evidence

- For every demonstration and significant action, link the input/artifact hash, normalized evidence, model, specialist service, proposed action, approval state, diff, commands, verification result, and error state.
- Never record provider credentials in prompts, source files, logs, audit records, reports, or generated UI.
- Preserve enough evidence to reproduce benchmark and demonstration failures.

## Prototype demonstrations and acceptance signals

### Headline repository demonstration — accepted

Using the existing thcode repository, a Thai instruction asks the agent to replace default Next.js branding with `@thcode_logo.png`, explain thcode as a Thai-first coding agent, and verify the build.

Key acceptance signals:

- explicit logo reference is workspace-valid and no image leaves before consent;
- T-OCR produces visible normalized evidence;
- the agent discovers the client structure and relevant files rather than assuming them;
- Plan Mode names the asset operation, page edits, affected paths, command, and risks without mutation;
- Build Mode changes only relevant client/assets;
- the resulting page uses a valid Next.js asset path and no longer centers default branding;
- product copy makes no unsupported claim;
- `npm run build` succeeds from `client/`;
- final evidence identifies model and AI for Thai service without exposing either credential.

### Speech-to-Text demonstration — accepted

A Thai WAV feature request asks for `GET /info`, product name, version, `ready` status, and an automated test.

Key acceptance signals:

- explicit consent before audio transfer;
- transcript retains every material requirement;
- the agent inspects the Express server and test setup;
- no mutation in Plan Mode;
- Build Mode adds a typed, testable endpoint using built-in Node test facilities without installing a third-party test framework;
- existing `/health` behavior remains intact;
- repeatable test passes;
- fixture is independent of other scenarios.

### Extract Address demonstration — accepted

A clearly labelled synthetic Thai address is processed into a typed `/address-preview` page.

Key acceptance signals:

- explicit consent and sensitive-data warning before transfer;
- live Extract Address service, not a stub, for demo-certified status;
- original address and structured returned fields are rendered with clear Thai labels;
- missing/uncertain fields are omitted or shown unavailable, never invented;
- page tolerates optional fields;
- repository changes remain bounded;
- production build passes;
- service refusal/failure leaves the clean repository unchanged;
- no real personal data or credentials appear in fixture, logs, or UI.

### Image-to-code smoke test — supporting only

Use OCR evidence from an image to generate and run a small program whose output matches the normalized text. This proves onboarding, references, consent, Thai service plumbing, plan/build separation, dependency checks, local tool calls, and verification. It does not prove repository understanding or competitive superiority and should not be the headline demonstration.

## Release plan and MVP boundaries

### Tier 0: one-to-two-day vertical integration spike

The current one-to-two-day estimate is credible only for a narrow end-to-end spike:

1. Launch a minimal CLI.
2. Connect Typhoon using a non-committed secret.
3. Resolve one in-workspace image.
4. Obtain real AI for Thai OCR evidence or use a prominently labelled temporary stub while access is pending.
5. Send the Thai request and evidence to Typhoon.
6. Show a read-only plan.
7. Require Build approval.
8. Change the known Next.js fixture locally.
9. Run and display `npm run build` evidence.

This spike may omit a polished TUI, full credential adapter, multiple models, dynamic catalog, general sandbox, benchmark suite, production Docker hardening, and full session implementation.

### Tier 1: proposal-ready evidence before submission

- Capture the vertical slice honestly, including partial status.
- Obtain and test the AI for Thai key.
- Confirm selected service, quota, payload, response, and data behavior.
- Finalize security and system boundaries.
- Define the OpenCode baseline and benchmark tasks.
- Produce a feasible finalist schedule.
- Complete and visually verify the required proposal artifact.

Competition timing recorded in the source: application deadline 17 July 2026 at 18:00 Thailand time; finalist development 23 July through 17 August 2026; final presentation 19 August 2026. These are competition constraints, not long-term product-release milestones.

### Tier 2: finalist prototype

- Native Windows TUI and clean global installation.
- Windows credential-store integration.
- Typhoon streaming/retry adapter.
- Dockerized Artifact Intelligence API.
- Plan/Build state machine and local permission policy.
- Dependency preflight and curated Windows guidance.
- Artifact consent, hashing, caching, redaction, and size limits.
- Headline repository demo and independent service scenarios.
- Error recovery, audit trail, and session continuation.
- API documentation and basic load-test evidence.
- Same-model, same-tools OpenCode comparison.
- Reproducible clean-machine/VM verification.

### Tier 3: roadmap, excluded from the initial deliverable

- Pathumma, OpenThaiGPT, and THaLLE adapters.
- Wider AI for Thai operational integration beyond the verification portfolio.
- macOS and Linux.
- IDE, desktop, web, and broader work-agent interfaces.
- General desktop work, autonomous computer use, broad image workflows, and complete no-code app building.

### Competition/platform packaging constraints

The onboarded service must be independently deployable as a Docker image, expose a separate API, include API documentation, and provide basic load-test evidence. The public proposal source records a 20 MB PDF submission constraint using the official template. These requirements belong to the competition delivery context and may not all be relevant to the open-source product release itself.

## External integrations and dependencies

### Required primary path

- **Typhoon API:** confirmed applicant access; default reasoning provider; exact current model/endpoint behavior and structured-action reliability still require live validation.
- **AI for Thai:** required competition integration; key, entitlement, quota, retention/data terms, and selected endpoints remain to be verified.
- **T-OCR, Speech-to-Text, Extract Address:** demo portfolio.
- **Named Entity Recognition:** live contract-test evidence only.

### Optional adapters

- **Pathumma Vision:** documented preview modality, but access, license, coding behavior, and tool use are unverified.
- **THaLLE:** public text-model availability is documented, but there is no confirmed inference path and no evidence of raw-image input.
- **Typhoon OCR:** development fallback for artifact plumbing if entitled, but it does not satisfy the required AI for Thai integration.
- Optional adapters must not delay the Typhoon-plus-AI-for-Thai primary path.

### Access validation exit criterion

Access risk is closed only when one Thai reasoning call can request one real AI for Thai operation, consume normalized evidence, propose a safe local repository action, and complete with an auditable response.

For each selected service verify formats, payload limits, schema, latency, quota, error behavior, retention/data terms, and competition entitlement. Confirm whether finalists get higher quota and how an onboarded service is authorized to compose upstream AI for Thai services.

## UX expectations

- The terminal must remain understandable without memorizing commands: `Shift+Tab` switches Plan/Build; `Tab` accepts completion; `/plan`, `/build`, `/models`, `/tools`, `/permissions`, `/session`, and `/context` provide explicit alternatives.
- Work Mode and Permission Profile remain visually separate and persistent.
- Approval and transfer disclosure should begin with plain Thai purpose and consequences, with exact details inspectable.
- Plan Mode must be unmistakably read-only; Build state and Full Access must be visually salient.
- Unavailable model/tool states require capability and reason, not a misleading disabled label.
- Context severity cannot rely on color alone and should degrade gracefully on narrow terminals.
- Complete chat history remains visible even when older material leaves Active Model Context; compaction state must be inspectable.
- Missing dependencies, service refusal, blocked policy, unavailable encryption key, and over-capacity context all need actionable, non-fabricated explanations.
- Completion summaries should identify what changed, what was verified, evidence used, and remaining risk in Thai.

## Success and quality signals

### Product/task success

- End-to-end task acceptance checks and repository tests pass.
- Relevant files are selected and unrelated files remain unchanged.
- Material ambiguity is identified before a wrong implementation.
- The correct AI for Thai service is selected for the artifact/task.
- Structured local actions are valid, policy-conformant, and executable.
- Unsafe and out-of-workspace attempts are rejected.
- Verification results, evidence, model, service, and interventions are reproducible.

### Comparative success

- At least 20 fair, reproducible tasks against OpenCode with the same model, tools, permissions, and fixtures.
- thcode materially improves at least one meaningful outcome without materially degrading the others before claiming superiority.

### Integration quality

- A service is called operational only at its demonstrated registry level.
- Required services pass live contract tests; demo-certified services pass their independent end-to-end scenarios.
- No unverified modality, quota, license, or endpoint capability is promoted as fact.

### Trust and safety quality

- No credentials appear in source, prompts, hosted-service payloads unrelated to their provider, logs, transcripts, audit records, reports, or generated UI.
- No artifact leaves the workstation before informed consent.
- Remote services never receive implicit local-path access.
- No mutation occurs in Plan Mode or outside the declared workspace.
- Full Access cannot erase hard boundaries or persist into a restored Runtime Activation.
- Specialist output uncertainty and absent fields remain visible rather than being invented.

### Release-quality gates

- Clean Windows installation, update, uninstall, first-run setup, missing-prerequisite paths, and demo fixtures are reproducibly tested.
- Dockerized API runs with documented contract and stated load evidence.
- Completion is tied to passing acceptance checks and verified external access, not elapsed coding time or use of AI coding assistants.

### Quantitative gaps

The source supplies a benchmark size and context-compaction target but no production targets for adoption, availability, latency, task-success rate, crash recovery, action-validity rate, unsafe-rejection accuracy, service health, TUI responsiveness, or user satisfaction. The PRD needs product-owner targets or explicitly labelled launch hypotheses.

Potential counter-metrics that need explicit thresholds include user interventions, false ambiguity prompts, approval fatigue, false policy blocks, wrong service selection, context-compaction information loss, remote-service calls per completed task, cost, and time to passing verification.

## Risks and concerns

### Product and positioning risk

- Generic terminal-agent, provider selection, permissions, attachments, and MCP features are already available; thcode's differentiation fails unless the adaptation layer is measurably useful.
- “Thai-first,” “Thai model,” “better,” and “Thai coding intelligence” remain underspecified terms.
- The initial target user is broad across student, junior, and small-team developer, and has not been validated with user interviews.
- No adoption, sustainability, maintainer, contribution, or open-source governance model is defined.

### Delivery risk

- The repository reportedly has no working agent loop, only a server health endpoint, and a default Next.js client.
- A one-to-two-day estimate does not cover production Windows behavior, credential security, external access, Docker packaging, load testing, benchmarking, documentation, and proposal work.
- AI coding tools accelerate implementation but do not remove provider access delays or clean-machine validation.
- The dated competition schedule creates a severe evidence and packaging constraint.

### External dependency risk

- AI for Thai key, entitlement, quota, formats, schemas, data terms, and composition behavior are unverified.
- A public trial quota may be too small for development or demonstrations.
- Pathumma access/license and THaLLE inference availability are unresolved.
- Model-family claims can be wrong when the selected endpoint has a narrower modality.

### Security, privacy, and governance risk

- Mixed artifacts may include source, screenshots, audio, addresses, or other sensitive data.
- Consent must be specific to destination and material; generic permission is insufficient.
- Hosted service composition must not leak reasoning-provider credentials or broaden repository access.
- Local session history contains sensitive content and becomes unrecoverable if its encryption key is lost.
- The relationship between persistent approved boundary expansions from the brainstorm and reset session authority in these docs is unresolved.

### Reliability and correctness risk

- Model-generated structured calls may be malformed or unsafe.
- Specialist-service output may be incomplete or uncertain; a reasoning model may hallucinate missing fields.
- Automatic repair/retry can conceal protocol failure or duplicate effects.
- The proposed compaction target may still lose decision-relevant nuance unless summaries are inspectable and tested.
- Catalog presence can be confused with entitlement or verified endpoint support.

### Operational risk

- Dockerized API load, logs, monitoring, secrets, quotas, and incident handling are not fully specified.
- The Phase 2 AI for Thai gateway credential model is unknown.
- No numeric SLOs, retention schedule for audit/evidence, or incident-response expectations are defined.

## Accepted assumptions and provisional assumptions

### Accepted/strongly supported

- The first wedge is an open-source CLI coding agent, not a general desktop agent.
- Native Windows and web repositories are the first target environment.
- Typhoon is the primary MVP reasoning provider.
- AI for Thai specialist services are tools, not entries in the model selector.
- The local machine owns the agent loop, repository, credentials, permissions, actions, and verification.
- Only explicitly referenced/approved artifacts cross to remote processing.
- The hosted service has no direct local-tool or repository authority.
- Model and service capability must be verified at the endpoint, not inferred from family branding.
- Operational claims follow registry evidence state.

### Provisional and requiring confirmation

- The Thai Agent Compatibility Layer is the final product name/category rather than a proposal framing.
- Artifact Intelligence API is the definitive onboarded service boundary for the open-source production release.
- The initial user is comfortable installing Node/npm and PowerShell and configuring multiple API keys.
- Typhoon structured action quality is sufficient after validation/repair.
- The first high-value multimodal workflow is adequately represented by OCR/logo, audio feature request, and address extraction.
- Full catalog compatibility is worth product investment even though only four services receive operational evidence.
- The competition prototype's Saved Session and context features belong in the first production release rather than a later milestone.

## Material open questions

### Product and users

- Which one user segment is the true launch focus: student, junior developer, or developer in a small team?
- What existing workflow do they use today, what fails, and how often?
- Which single artifact-assisted job has the highest repeat value after the competition demo?
- What does “Thai-first” commit to: Thai interaction, Thai models, local-domain engineering, Thai data governance, or a defined combination?
- What evidence of user demand is required for an open-source production release?

### Initial scope

- Is the PRD for the competition finalist prototype, the open-source production foundation, or one phased product containing both?
- Which production-foundation capabilities from the brainstorm—generic declarative providers/services, live health gating, deterministic failure states, crash uncertainty, and prompt rollback—are required for the first release?
- Are Saved Sessions, encrypted history, the context donut, automatic compaction, Full Access, and the full catalog manifest launch-blocking or post-MVP?
- Does “complete catalog compatibility” mean discoverability metadata, declarative mapping support, or tested runtime compatibility?

### Hosted-service and credential boundary

- What must the Dockerized competition service do in Phase 1 if the CLI calls Typhoon and AI for Thai directly?
- Is the onboarded service an Artifact Intelligence API only, a coding-reasoning API, or a broader Thai Agent Compatibility Layer?
- Does the AI for Thai gateway pass a caller credential to the onboarded service, authorize upstream AI for Thai composition, or require service-owned credentials?
- Which code/context may the hosted service retain, cache, or log, for how long, and under what deletion policy?

### Interaction and policy

- What actions require separate transfer consent under Manual, Assisted, and Full Access?
- Do approved network/service/workspace boundary expansions persist across Runtime Activations, or does every restored session reset all such authority?
- What hard boundaries are non-overridable, and how are patterns, symlinks, junctions, subprocesses, and network redirects handled?
- What is the role and measured accuracy requirement of the advisory AI risk classifier?
- Should new sessions truly start in Build Mode, or should the production default be Plan given the trust positioning?

### Sessions and context

- Which session fields contain sensitive data, what is the retention/deletion behavior, and what is the threat model for the local store?
- How are workspace moves, deleted paths, and repositories at new locations handled without silent rebind?
- What quality tests prove compaction preserves acceptance criteria and important decisions?
- Are users allowed to configure context reserves or token budgets, and what safe defaults apply?

### Release and evaluation

- What numeric targets define production readiness for task success, tool-call validity, unsafe-action blocking, service latency, clean installation, and crash recovery?
- What constitutes a material improvement over OpenCode?
- Who authors and adjudicates the 20-task benchmark, and how is leakage/overfitting controlled?
- What exact load target and API behavior satisfy onboarding review?
- Which external-access failure would trigger a scope pivot, and what is the acceptable fallback that does not overstate completion?

### Open-source operations

- What license, contribution model, maintainer policy, release channel, compatibility policy, and security-reporting process will support the production release?
- Who reviews provider adapters, service manifests, policy changes, and benchmark contributions?
- How are catalog updates, revoked endpoints, breaking schemas, and vulnerable dependencies communicated and shipped?

## Rejected alternatives and rationale

- **Complete hosted agent loop:** rejected for the initial version because it requires broader repository upload, expands the security boundary, and complicates local tools.
- **Direct Pathumma wrapper as the product:** rejected because it does not establish an original onboardable capability and access/capability remain unverified.
- **Developer desktop/general work agent as the first release:** rejected to preserve a deliverable developer wedge.
- **Web, desktop, mobile, IDE, WSL, and standalone Windows executable in the prototype:** deferred to avoid parallel surfaces and packaging paths.
- **OAuth or thcode account system for Phase 1:** rejected; API-key/BYOK setup is sufficient.
- **Silent model fallback:** rejected because capability and data-handling changes must be explicit.
- **AI for Thai services in `/models`:** rejected because they are specialist tools, not the session reasoning model.
- **Live website scraping for catalog discovery:** rejected in favor of a reviewed versioned manifest until a trusted discovery API/feed exists.
- **Claiming catalogued equals supported:** rejected; evidence states remain explicit.
- **Compound all-services demonstration:** rejected because one unavailable service would break the entire showcase; scenarios remain independent.
- **OCR image-to-code smoke test as final proof:** rejected as insufficient evidence of repository understanding.
- **Silent dependency installation:** rejected; users receive explicit, platform-specific next steps.
- **Plan-to-Build as the only allowed workflow:** rejected; Work Mode and Permission Profile remain independent.
- **Persisting Full Access and temporary approvals on session restore:** rejected to prevent restored history from silently restoring authority.
- **Cloud session synchronization, export/import, and recovery archive in the prototype:** deferred to reduce security and portability scope.
- **Inventing missing specialist-service fields:** rejected; uncertainty and omissions remain visible.
- **Broad universal novelty or superiority claims:** rejected unless supported by current catalog review and fair benchmark evidence.

## Conflicts and reconciliation with the production-foundation brainstorm

### Scope: generic extension foundation versus Thai developer wedge

The brainstorm makes provider/service connectivity and generic extension governance the architectural center. The proposal docs make Thai intent, mixed artifacts, AI for Thai routing, and safe local coding the product center. These are compatible only if the PRD treats the generic extension platform as enabling architecture/roadmap rather than the user-facing launch proposition. Otherwise the release scope becomes too broad.

### Provider/service breadth

The brainstorm explicitly wants post-install declarative local/private reasoning providers and private OCR/STT endpoints, with OpenAI-compatible and Anthropic profiles. The proposal MVP accepts Typhoon as the only required reasoning provider, AI for Thai tools as the required specialist path, and other adapters as optional/roadmap. The PRD must decide whether generic declarative endpoints ship in the first release or are postponed.

### Health versus capability state

The brainstorm defines live API health checks, availability gating, unhealthy state after protocol failure, and explicit retest. The proposal defines a richer capability registry and evidence states but does not fully carry forward that health-state lifecycle. These can be combined: connectivity health and operational evidence are different dimensions. The release must state whether live health/retest behavior is in scope.

### Safety boundary alignment

Both sources agree that the local harness owns tools and permissions, the hosted service has no workstation authority, credentials are not disclosed, and workspace boundaries survive broad access modes. The proposal adds explicit artifact-transfer consent, Plan/Build separation, and session authority reset.

### Persistent approvals conflict

The brainstorm says approved boundary expansions persist across later activations. The proposal says Full Access, sensitive-transfer permission, and temporary approvals never survive a Runtime Activation. These may describe different kinds of state, but the distinction is not defined. The PRD must explicitly categorize durable configured boundaries versus temporary authority and say which survive restore.

### Crash recovery and rollback gap

The brainstorm commits to preserving partial output, marking interruption, never retrying an uncertain remote operation automatically, and prompt-level conflict-safe rollback with five-prompt retention. The proposal delivery plan mentions error recovery, audit, and session continuation but does not repeat those contracts. They should not be silently dropped; decide whether they are production-launch requirements, finalist scope, or deferred.

### Session/context expansion

The proposal adds substantial product scope absent from the brainstorm: encrypted global Saved Sessions, transcript/context separation, workspace-binding behavior, token accounting, a Context Donut, automatic compaction, and protected-context blocking. These are coherent with the brainstorm's trust goals but materially expand the first release and need prioritization.

### Form factor and trust model

The sources align on CLI/TUI, progressive disclosure, inspectable action details, visible risk, deterministic evidence, and separation of user-level status from developer diagnostics.

### Failure semantics gap

The brainstorm requires deterministic remote failure classification, sanitized evidence, and a model-generated explanation that cannot replace the underlying category. The proposal's demo requirements include evidence and service-failure safety but do not explicitly preserve the deterministic classification contract. Decide whether to retain it as a cross-cutting release requirement.

### Rollback versus Saved Session data

The brainstorm requires short-lived rollback checkpoints and binary originals; the proposal's session design says repository files are not copied into SQLite by default. This is not necessarily a conflict if rollback storage is separate and expiring, but the storage, encryption, visibility, and cleanup contract needs a deliberate design.

### Platform narrowing

The brainstorm leaves platform and shell open. The proposal resolves the first release to native Windows, Windows Terminal, and PowerShell, with macOS then Linux. This is a useful clarification and should supersede the brainstorm ambiguity for MVP scope.

### Success metrics

The brainstorm lacked numeric success measures. The proposal supplies a benchmark shape, at least 20 cases, context-compaction target, demonstration acceptance criteria, and release gates, but still lacks most numeric SLOs. The PRD can use the demonstration criteria immediately while marking production thresholds as open.

## Internal inconsistencies within the proposal-discovery sources

These conflicts should be resolved before requirements are finalized:

1. **Typhoon credential location.** Most accepted decisions say Typhoon BYOK stays in the OS credential store, the CLI calls Typhoon directly, and the hosted service never receives the key. `access-validation-plan.md` Gate 1 instead says to keep the key server-side and out of the downloadable CLI. The local-BYOK position is repeated more often and appears later/more integrated, but the contradictory line must be explicitly superseded.
2. **Reasoning-turn route.** The accepted boundary and domain relationships say the local CLI calls the selected reasoning provider directly. `glossary.md` defines a reasoning turn as a request from the local harness to the hosted thcode API and describes a hosted server sub-loop. Those terms appear stale relative to the accepted local-BYOK architecture.
3. **Competition MVP hosted service.** The glossary calls the MVP “CLI plus Dockerized Thai coding-reasoning API,” while the accepted recommendation and delivery plan call the onboarded component an Artifact Intelligence API that does not own the reasoning loop. The service contract needs one canonical boundary.
4. **Phase 1 versus onboarding requirement.** Phase 1 describes direct local AI for Thai calls before onboarding; competition constraints require a Dockerized onboardable service that can actually be offered on the platform. The proposal must explain what service is submitted and demonstrated during the competition rather than leaving it as a future Phase 2 concept.
5. **New-session default versus demo framing.** The interface contract says sessions start in Build/Manual. Every key demo begins by invoking Plan Mode. This is not logically inconsistent, but the safety rationale for defaulting to Build should be revisited for an open-source production release.
6. **Catalog completeness language.** The product targets complete-catalog compatibility while only four services have operational evidence. The evidence-state model limits the claim, but “compatibility” must be defined narrowly enough not to imply untested endpoint mappings.

## Implementation and architecture material for `addendum.md`

The following is useful downstream design content but should not dominate capability-focused PRD requirements:

### Local/remote component allocation

- Headless TypeScript agent core beneath the terminal presentation.
- React and Ink for the prototype TUI; OpenTUI and Bun excluded.
- Local components: provider adapters, direct model calls, intent compiler, artifact resolver, context governor, action compiler/validator, permissions, tools, sessions, and verification.
- Phase 1 local AI for Thai adapter versus Phase 2 Dockerized Artifact Intelligence API.
- Hosted API routing of approved artifacts to specialist AI services and normalized evidence responses.

### Packaging and platform mechanisms

- npm global package with a `thcode` bin entry; organization-scoped package as fallback if the unscoped name cannot be published.
- Node.js minimum 22 and clean-machine baseline 24 LTS.
- PowerShell minimum 7.4 via `pwsh.exe` and clean-machine baseline 7.6 LTS; explicit rejection of Windows PowerShell 5.1.
- Windows Credential Manager for provider credentials and the per-install data-encryption key.
- Native child processes, Windows paths, and no WSL support in the prototype.

### Session storage and cryptography

- One per-user SQLite Global Session Store.
- Per-record authenticated AES-256-GCM for sensitive session content.
- Per-install encryption key held separately in the OS credential store.
- Stored paths, hashes, metadata, and derived evidence rather than copying repository files by default.
- Transcript, active context, token ledger, workspace binding, artifact manifest, approvals/audit, and compaction-event schema.

### Context accounting mechanisms

- Effective Context Capacity formula: verified context limit less response reserve and safety margin.
- Token categories, provider-reported versus estimated counts, projected next-call sizing, and compaction targeting.
- Selection/ranking/compression/cache strategy and preservation rules for pinned turns.

### Capability and artifact schemas

- Versioned `CodingTaskSpec` for normalized intent, ambiguity, artifact plan, Thailand-specific flags, and verification criteria.
- Capability registry schema including catalog identity, modality, entitlement, policy, operational evidence level, and observation date.
- Type-specific artifact resolver policies, hash-based evidence cache, upload schemas, normalized result contracts, and uncertainty fields.
- Structured action validation, schema repair/retry policy, path normalization, and policy evaluation.

### Benchmark and delivery mechanics

- Reproducible fixtures/commits, same-model/same-tools harness, benchmark task format, measurement capture, and materiality analysis.
- Docker image, API contract/documentation, load-test harness, deployment monitoring, quotas, and gateway credential design.
- Independent demo fixtures and evidence bundle format.

### Production-foundation mechanisms to preserve downstream

- Generic extension metadata, declarative provider/service mappings, reviewed adapter fallback, and metadata-driven TUI rendering.
- Deterministic network-failure classifier with sanitized raw evidence separated from model explanation.
- Prompt rollback using before hashes and exact patches, binary originals, overlap detection, and expiry cleanup.
- Append-safe interruption history and no automatic retry on uncertain remote outcomes.

## Discovery handoff

The docs answer the previously missing questions of product wedge, first platform, primary workflows, and demonstrable differentiation. The next product discussion should not re-litigate every mechanism. It should resolve five decisions that materially change PRD scope:

1. Is this PRD primarily for the competition prototype, the open-source production release, or a phased product with an explicit boundary between them?
2. Which production-foundation trust capabilities are launch-blocking: generic extensions, provider health/retest, deterministic failure semantics, crash recovery, and prompt rollback?
3. What is the canonical hosted-service contract and credential route during the competition versus after onboarding?
4. Which one first user and repeated artifact-assisted job should drive the narrative beyond demo fixtures?
5. Which quantitative release targets and counter-metrics define “production” and justify differentiation from OpenCode?
