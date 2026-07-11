# thcode Proposal Discovery

This folder is the working record for the AI for Thai Service Onboarding proposal interview.
Statements are tagged so that guesses do not silently become proposal claims.

- **Confirmed**: supported by the repository, official event material, or the applicant.
- **Hypothesis**: plausible, but must be validated in the interview or with evidence.
- **Open**: unanswered and capable of changing the proposal materially.

## Confirmed competition constraints

- Application closes on 17 July 2026 at 18:00 (Thailand time).
- The event accepts the first 150 applicants and selects 15 finalists.
- Each finalist receives THB 15,000 to develop and test the service from 23 July to 17 August 2026.
- Final presentations are onsite on 19 August 2026.
- The submission is one PDF of no more than 20 MB, using `template_proposal.docx` as the form.
- The finalist must develop a service that can actually be offered on the AI for Thai platform and pass committee review.
- External services are expected to expose a separate API as a Docker image, include basic load-test evidence, and provide API documentation.

Official sources:

- Competition: https://events.ai.in.th/e/aift_service_onboarding
- Provider/onboarding FAQ: https://aiforthai.in.th/services/service_pa.php
- Service catalog: https://aiforthai.in.th/services/

## Confirmed repository state

- `thcode` describes itself as an experiment in Thai LLMs as backbones for agentic coding tools.
- The README mentions Typhoon-2.5, OpenThaiGPT-R1, Pathumma-LLM, and ThaLLE-0.1.
- There is not yet a working coding-agent loop.
- The server currently exposes only a health endpoint.
- The web client is still the default Next.js starter page.

## Current team and estimate

- The applicant is directing product scope and proposal decisions.
- A second person is expected to implement the prototype using Claude Code and Codex to accelerate development.
- The second builder has a native Windows machine and relevant implementation experience.
- The applicant currently estimates one to two days.
- Working assessment: one to two days may produce a narrow vertical slice, but it is not a credible estimate for the complete Windows-first, secure, Dockerized, evaluated competition service.

See `docs/proposal-discovery/delivery-plan.md`.

## Accepted product direction

**Confirmed by applicant:** thcode will be a hybrid local/cloud coding agent.

- A downloadable local CLI owns the agent loop, session state, provider adapters, reasoning-model calls, repository access, permission checks, secret redaction, structured-action validation, tool execution, and verification.
- User-supplied reasoning-provider keys remain in the operating system's credential store and are used only by the local CLI.
- In Phase 1, the local CLI uses the user's separately supplied AI for Thai key to call selected external services. In Phase 2, an onboarded thcode Artifact Intelligence API provides mixed-artifact processing, specialist-service routing, and normalized evidence; the exact gateway credential flow remains to be confirmed with the organizers.
- The hosted service never receives the user's Typhoon or other reasoning-provider key and never directly connects to the developer's computer.
- The CLI sends only explicitly approved artifacts or bounded context to the hosted service rather than automatically uploading the repository.
- Users can explicitly reference repository artifacts such as source code, Markdown, images, and office documents. The CLI resolves each reference locally and applies a type-specific extraction or upload policy.

See `docs/decisions/0001-local-agent-loop-remote-thai-reasoning.md`.
See `docs/decisions/0003-split-local-and-server-tools.md`.
See `docs/decisions/0007-local-byok.md`.

## Accepted product ladder

- **Long-term vision:** a Thai-first general-purpose agent for people who want to build applications, understand images, and complete computer-based work through natural Thai instructions.
- **Competition wedge:** a downloadable CLI coding agent for developers.
- **First Target User:** a Thai-speaking student, junior developer, or small-team developer using native Windows and primarily working with Node.js, TypeScript, or web repositories while providing Thai instructions and referenced images, audio, or documents.
- **Reason for the wedge:** the local agent loop, permissions, tools, context handling, and remote reasoning interface form the foundation for later non-developer and multimodal clients.
- **Not in the initial deliverable:** a general desktop-work agent, autonomous computer use, broad image workflows, and a complete no-code application builder.

See `docs/decisions/0002-developer-cli-first.md`.

## Accepted prototype interface

- The competition prototype is CLI-only.
- The CLI is the primary user experience for starting sessions, referencing artifacts, selecting models, reviewing proposed actions, approving tools, viewing diffs, and inspecting results.
- The hosted Thai Agent Compatibility Layer is consumed behind the CLI and does not require its own end-user UI.
- Web, desktop, mobile, and IDE interfaces are explicitly deferred.

See `docs/decisions/0005-cli-only-prototype.md`.

## Accepted platform order

1. Windows prototype
2. macOS support
3. Linux support

The competition prototype runs natively in Windows Terminal and executes commands through PowerShell with Windows paths, Windows Credential Manager, and native child processes. WSL is explicitly unsupported for the prototype.

The minimum supported shell is PowerShell 7.4 through `pwsh.exe`; the clean-machine baseline is PowerShell 7.6 LTS. Windows PowerShell 5.1 is unsupported because its behavior and encoding differ. Missing or outdated PowerShell produces a WinGet recommendation but no silent installation.

The preferred installation is `npm install -g thcode`, exposing the `thcode` command. The same package architecture later supports macOS and Linux through platform adapters; a standalone Windows executable is not part of the prototype. Node.js is an explicit installation prerequisite. The unscoped name appeared unclaimed on 12 July 2026, with an organization-scoped package retained as the fallback if publication fails.

The minimum supported runtime is Node.js 22, and the clean-machine competition baseline is Node.js 24 LTS. Node.js 20 and earlier receive an explicit unsupported-version message; the prototype does not depend on Node.js 26-only behavior.

The CLI uses TypeScript, React, and Ink. Ink owns only the terminal presentation and input layer; a headless TypeScript core owns providers, tools, permissions, context, sessions, and platform adapters so future interfaces can reuse the same behavior. OpenTUI and Bun are not prototype dependencies.

See `docs/decisions/0008-windows-first.md`.
See `docs/decisions/0019-npm-cli-distribution.md`.
See `docs/decisions/0020-typescript-ink-cli.md`.

## Accepted interaction safety

- Plan and Build are independently selectable Work Modes; a Plan-to-Build sequence is optional.
- A new interactive session starts in Build Mode with the Manual Permission Profile.
- Plan Mode uses a planning-focused system instruction set and may inspect permitted context or call permitted read-only services, but structural tool policy prevents it from editing files or running mutating commands.
- Build Mode uses execution-focused instructions and enables changes and verification under the active Permission Profile.
- Work Mode and Permission Profile are separate state: Full Access cannot mutate in Plan Mode, while Full Access in Build Mode auto-approves every action inside declared hard boundaries.
- The current Work Mode must remain visible in the terminal. `Shift+Tab` cycles Plan and Build, plain `Tab` accepts `/command` or `@file` completion, and `/plan` and `/build` remain explicit alternatives.

See `docs/decisions/0013-orthogonal-work-modes.md`.

## Accepted permission profiles

- Manual is the new-session default and asks before material remote transfers, changes, commands, and sensitive actions.
- Assisted applies hard rules and deterministic policy before using an AI risk classifier as an advisory signal; the proposing model cannot authorize itself or override policy.
- Full Access skips per-action confirmation inside declared session boundaries, but cannot expose credentials or disable other non-negotiable security rules. Sensitive transfer requires a separate override.
- `/permissions` opens an interactive terminal selector rather than requiring an inline-only command.
- Full Access does not require a Plan-to-Build checkpoint and skips all per-action approval prompts in Build Mode within declared hard boundaries.

See `docs/decisions/0012-permission-profiles.md`.

## Accepted session direction

- `/resume` is replaced by a Saved Session experience with an interactive session browser and session-management commands.
- `/session` opens the browser and provides `new`, `list`, `open <id>`, `rename <id>`, `delete <id>`, and `info`; `/sessions` is a browser alias.
- Saved Sessions live in a machine-local Global Session Store scoped to the current OS user rather than inside individual repositories; cloud synchronization is deferred.
- The Global Session Store uses one SQLite database for transcript, session, context, token, workspace-binding, and audit records.
- Workspace-aware sessions retain an explicit Workspace Binding and are never silently rebound to the directory from which they are opened.
- Referenced repository files are not copied into SQLite by default; sessions retain paths, hashes, metadata, and deliberately retained derived evidence.
- Every Saved Session retains its complete previous Chat Transcript locally and displays it when reopened.
- API keys, Full Access, sensitive-transfer permission, and temporary approvals are not part of the stored chat.
- Opening restores the model, Work Mode, pins, compaction history, artifact manifest, plans, tool and verification history, token ledger, and workspace association, but starts a fresh Runtime Activation in Manual.
- Provider keys stay in the operating-system credential store and are never copied into Saved Session data.
- Sensitive session content is encrypted per record with authenticated AES-256-GCM. The per-install data-encryption key is a separate Windows Credential Manager entry and is never stored in SQLite.
- The prototype has no session export, import, cloud sync, recovery archive, or cross-device migration. Portability is deferred to Phase 2, and key or machine loss may make sessions unrecoverable.
- The complete Chat Transcript and Active Model Context are separate: the transcript remains browsable locally, while the model receives a bounded selection containing recent turns, pinned turns, selected evidence, tool definitions, and inspectable summaries.
- Context Compaction never deletes the stored transcript and must reveal what is verbatim, summarized, or excluded.

See `docs/decisions/0014-saved-transcript-active-context.md`.
See `docs/decisions/0016-session-restoration-boundary.md`.
See `docs/decisions/0017-global-local-session-store.md`.
See `docs/decisions/0018-encrypted-session-content.md`.

## Accepted token and context visibility

- A Context Donut appears at the lower-right of the Prompt Composer with a numeric percentage and non-color-only severity state.
- The donut reports Active Context Utilization, not cumulative session consumption.
- Its 100% denominator is the selected model's Effective Context Capacity: verified context limit minus response reserve and safety margin.
- `/context` shows the full category breakdown plus cumulative input, output, cached tokens, and model calls; estimates are marked separately from provider-reported counts.
- Cumulative Token Usage has no percentage unless the user later configures a separate session budget.
- When the projected next request would exceed 100% Effective Context Capacity, thcode automatically compacts before sending, targets at most 70%, preserves the complete transcript and pinned turns, and records an inspectable event.
- `/compact` remains available for manual early compaction.
- If protected content still does not fit, thcode blocks the provider call, shows a category breakdown, and requires an explicit unpin, evidence reduction, reserve adjustment, or model switch. It never silently drops protected content.

See `docs/decisions/0015-context-utilization-meter.md`.

## Prototype smoke-test demonstration

The first end-to-end smoke test is image-to-code. C++ is one possible demonstration language, not a product requirement:

1. Start `thcode` in a terminal and complete first-run model setup.
2. Select Typhoon.
3. Ask in Thai to create C++ code that prints the text contained in a referenced image.
4. thcode sends the explicitly selected image through its local AI for Thai adapter.
5. The adapter calls AI for Thai OCR with the user's separately stored AI for Thai key and returns normalized text evidence.
6. Typhoon proposes a plan, local coding actions, and required toolchain checks.
7. The user approves Build mode.
8. The CLI writes and runs the program using an available toolchain.
9. The terminal output is compared with the OCR result.

This is a plumbing smoke test, not yet a sufficient final competition demonstration because it does not prove meaningful repository understanding.

See `docs/proposal-discovery/prototype-demo.md`.

## Accepted headline demonstration

The competition headline fixture is the thcode repository itself. From Plan mode, the user asks in Thai to replace the default Next.js branding with `@thcode_logo.png`, explain that thcode is a Thai-first coding agent, and verify the build. The agent must analyze the referenced logo through AI for Thai, discover the client structure, identify the correct files, propose a bounded plan, obtain Build-mode approval, edit locally, and run the documented build.

See `docs/proposal-discovery/prototype-demo.md#headline-demonstration-existing-thcode-repository`.

## Accepted dependency behavior

- Before proposing execution, thcode checks whether required runtimes, compilers, package managers, and project commands are available.
- Missing dependencies produce clear, platform-specific recommendations rather than unexplained command failures.
- The MVP does not silently install a compiler or runtime. Installation requires an explicit user decision and remains outside Plan mode.

See `docs/decisions/0009-dependency-preflight.md`.

## Current user-pain and capability hypothesis

**Applicant observation:** local or openly accessible models used in coding workflows often cannot accept or inspect images. Developers therefore cannot reliably give the agent screenshots, visual errors, mockups, or diagrams as task context.

**Hypothesis:** the first differentiated thcode workflow may be a Thai-language multimodal coding task. The CLI accepts explicit repository references, calls applicant-owned orchestration on AI for Thai, combines specialized Thai services with a Thai LLM, and then continues the local coding-agent loop.

This hypothesis is not yet narrow enough. The first image class must be selected from possibilities such as an error screenshot, a UI screenshot/mockup, or an architecture diagram. Each requires different vision capabilities and evaluation criteria.

Current catalog evidence shows task-specific vision building blocks including OCR, caption generation, object recognition, and image-text search. A general-purpose visual reasoning capability has not yet been confirmed.

Current model evidence also shows that raw-image support differs by model and endpoint. Pathumma has a NECTEC multimodal vision preview for visual question answering and captioning, while the reviewed THaLLE release is a text-generation model. Typhoon documents separate text and OCR APIs, so image support must be verified for each selected endpoint rather than inferred from the model family.

See `docs/proposal-discovery/model-capabilities.md`.

## Confirmed access state

- **Typhoon API:** applicant has access.
- **AI for Thai API:** applicant expects to obtain a key; registration, specific service entitlement, and effective quota are not yet verified.
- **Pathumma Vision:** model capability is documented, but applicant access and deployment license are not verified.
- **THaLLE:** public model availability is documented, but applicant has not confirmed an inference endpoint or local deployment.

The MVP dependency order is therefore Typhoon for reasoning first, AI for Thai vision as the required competition integration next, and Pathumma/THaLLE as optional adapters until their access is proven.

## Accepted model-selection direction

- Typhoon is the default and primary reasoning model for the competition MVP.
- The CLI exposes `/models` to list available reasoning-model adapters and select one for the current session.
- Pathumma, THaLLE, and other models appear only when a working local provider adapter and locally stored credential or endpoint are available.
- AI for Thai services are tools, not entries in the reasoning-model selector.
- Model changes must be explicit; the system must not silently fall back to a different model with different capabilities or data handling.
- In Phase 1, reasoning-provider and AI for Thai tool keys are separate local BYOK credentials. Phase 2 credential handling depends on the verified onboarding gateway contract.

See `docs/decisions/0004-typhoon-default-pluggable-models.md`.

## Accepted phased provider and API-key strategy

### Phase 1: prototype before AI for Thai onboarding

- Typhoon is the required primary reasoning provider.
- The user supplies a Typhoon API key through local BYOK.
- AI for Thai is treated as an external specialist-tool provider, not the primary reasoning provider.
- If available, the user supplies an AI for Thai API key through local BYOK for OCR or other selected tools.
- No OAuth or thcode account system is required.

### Phase 2: after AI for Thai onboarding

- The AI for Thai API key becomes the primary platform credential for accessing the onboarded thcode service and available AI for Thai models/tools.
- Typhoon may remain an optional external reasoning provider through a separate local key.
- Exact gateway behavior and whether one key authorizes the onboarded service plus upstream tools must be verified with AI for Thai.

See `docs/decisions/0010-phased-api-key-provider-strategy.md`.

## Accepted AI for Thai service scope

- The product architecture targets the complete AI for Thai service catalog, not OCR alone.
- `/tools` exposes a searchable registry across language, vision, conversation, and other categories.
- Tool schemas are selected dynamically; the reasoning model does not receive the entire catalog on every turn.
- Every service is labelled catalogued, integrated, verified, or demo-certified.
- The proposal will claim complete-catalog compatibility as a design target, while current operational support is reported only from passing contract tests.
- The accepted Verification Quartet is Named Entity Recognition for Language, T-OCR for Vision, Speech-to-Text for Conversation, and Extract Address for Other.
- The accepted Demo Portfolio is T-OCR, Speech-to-Text, and Extract Address. Each requires a complete Typhoon-driven coding scenario.
- The three Demo Scenarios are short and independent; failure of one service must not prevent the other scenarios from being demonstrated.
- Named Entity Recognition is required to pass a live contract test but does not require a public demonstration.
- The accepted Speech-to-Text scenario converts a Thai audio feature request into a tested Express `GET /info` endpoint.
- The accepted Extract Address scenario converts a synthetic Thai address fixture into a typed Next.js `/address-preview` page and verifies the production build.

The official catalog snapshot reviewed on 12 July 2026 contained 49 active entries: 20 language, 20 vision, 7 conversation, and 2 other services. The snapshot is evidence of catalog breadth, not evidence that every endpoint is accessible or compatible.

Phase 1 packages this discovery data as a reviewed, versioned Catalog Manifest. The CLI does not scrape the AI for Thai website at startup; it displays the manifest version and observation date, and a newly published service requires a manifest update. Live synchronization is deferred until a documented discovery API or trusted versioned feed exists.

See `docs/decisions/0011-registry-driven-aiforthai-tool-catalog.md`.

## Defensible novelty position

The proposal must not claim that nobody has ever connected a Thai model to a CLI or agent harness. Typhoon already documents an MCP-enabled CLI ReAct agent, and generic coding agents can use OpenAI-compatible or self-hosted endpoints.

The narrower opportunity identified so far is:

> The current AI for Thai catalog does not expose a developer-oriented agent service that converts Thai requests and mixed repository artifacts into capability-aware Thai AI service calls and safe local coding actions.

thcode's differentiation must therefore be demonstrated in the complete system behavior, not merely the presence of a terminal interface or a Typhoon adapter.

See `docs/proposal-discovery/competitive-landscape.md`.

## Recommended hosted-service core

**Working recommendation:** position the full product as a **Thai Agent Compatibility Layer for Software Engineering**, split across the local CLI and an onboarded **Artifact Intelligence API**.

The full product makes Thai reasoning models and AI for Thai services behave as a reliable coding-agent runtime even when a selected model is text-only, has imperfect structured tool calling, or cannot efficiently consume every tool schema. It includes:

- a Thai Developer Intent Compiler;
- a mixed-artifact conversion layer;
- dynamic AI for Thai tool discovery and schema selection;
- structured-action validation and repair;
- context budgeting for Thai models;
- normalized local tool-call proposals and verification criteria.

The downloadable thcode CLI owns the intent compiler, context governor, provider calls, action validation, permissions, and local tools. In Phase 1 it also holds the user's separate AI for Thai key and calls selected AI for Thai tools through a local adapter. In Phase 2, the independently onboardable Artifact Intelligence API owns mixed-artifact processing, specialist-service routing, and normalized evidence; its exact gateway credential behavior remains unverified.

See `docs/proposal-discovery/differentiation-options.md`.

## Proposal sections to resolve through the interview

1. Applicant/team identity and execution capacity
2. Product name, competition category, artifact type, and readiness level
3. Painful user problem and narrowly defined first user
4. Original service boundary and defensible differentiation
5. User workflow, agent loop, and system architecture
6. Thai models, AI for Thai APIs, datasets, and foreign technology roles
7. Four-week implementation and validation plan
8. Service/business model and path to adoption
9. Security, privacy, responsible AI, and disclosed limitations
10. Evidence: prototype, benchmark, user interviews, demand, or letters of intent

## Interview status

- Product-boundary gate: accepted.
- Current gate: select one developer image workflow and define its measurable outcome.
- Current gate: accept, revise, or reject the Thai Agent Compatibility Layer as the hosted-service core, then benchmark it against OpenCode with the same Typhoon model and AI for Thai tools.
