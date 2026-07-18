# Source Extract: `docs/decisions`

## Source and authority

- Sources reviewed: `docs/decisions/README.md` and ADRs 0001–0020, all Markdown files present on 14 July 2026.
- This extract treats accepted ADRs and the latest amendments/supersessions as confirmed project decisions. Older text is retained only when it remains compatible with the later decision.
- This is a distilled PRD-discovery input, not an attempt to import architecture detail into the PRD.
- Decision precedence applied:
  - ADR 0013 supersedes ADR 0006: Plan and Build are independently selectable; a plan is not a mandatory gate.
  - ADR 0007 amends ADRs 0001 and 0004: reasoning-provider adapters and calls are local, and provider keys never reach the hosted service.
  - ADR 0010 amends ADRs 0003 and 0007 with Phase 1 versus Phase 2 credential and AI-for-Thai routing.
  - ADR 0011 further defines the AI-for-Thai catalog and support-level contract.

## Confirmed product direction

thcode is a Thai-first terminal coding agent for developers. The first product and competition wedge is a downloadable CLI that performs repository work locally while calling remote Thai reasoning and specialist services only with deliberately selected context. The longer-term vision is a broader Thai work agent, but consumer, general desktop-computer-use, no-code, and nontechnical experiences are not initial commitments.

The first release scope described by the ADRs is explicitly a competition prototype rather than broad platform parity. It must establish a trustworthy local agent loop, Thai/Thai-English developer workflow, clear remote-service boundary, permission enforcement, context/session continuity, and reproducible end-to-end demonstrations.

## Users and jobs

### Confirmed primary audience

- Thai-speaking or Thai-English-speaking software developers working in an existing local repository.
- Developers comfortable installing a global npm CLI and operating in Windows Terminal with PowerShell.
- Developers who bring their own Typhoon credential and may separately connect AI for Thai services.

### Core jobs to be done

- Ask for a coding task in Thai or mixed Thai-English without translating the request manually.
- Let the agent inspect a bounded repository, propose or make changes, run local commands, and verify the result without surrendering control of the machine.
- Reference code, Markdown, directories, images, PDFs, DOCX, and other artifacts while understanding what content will leave the machine.
- Select a reasoning model, understand service/tool availability, and diagnose missing credentials, quota, health, or capability.
- Review plans, tool calls, patches, tests, context usage, and errors from one coherent terminal experience.
- Resume prior work while retaining knowledge but resetting runtime authority to a safe default.

### Still unresolved

The ADRs explicitly say that “developers” is too broad. They do not choose the first developer segment, its painful recurring job, or a representative named user journey. Those are still required to make the value proposition and evaluation set product-specific.

## Release, scope, and platform assumptions

### In scope for the initial prototype

- One end-user surface: an interactive CLI.
- Native Windows, Windows Terminal, and PowerShell 7.4+ via `pwsh.exe`; PowerShell 7.6 LTS is the clean-machine baseline.
- Node.js 22+; Node.js 24 LTS is the clean-machine baseline.
- Distribution as a global npm package exposing the `thcode` command.
- Typhoon `typhoon-v2.5` as the default and only required reasoning adapter for the competition demonstration.
- Local repository search/read, patching, shell commands, Git-state inspection, builds/tests, verification, context management, permissions, and session management.
- Phase 1 optional AI-for-Thai integration using a separate user-supplied API key.
- A hosted Dockerized thcode API for the AI-for-Thai onboarding boundary; it owns specialist artifact processing/orchestration, not developer-machine execution.
- A small reproducible Thai developer-task evaluation set and three independent specialist-service demo scenarios.

### Deferred or excluded

- macOS, then Linux, follow Windows; neither has prototype parity.
- WSL, Windows PowerShell 5.1, Git Bash/MSYS as the required shell, and Unix-path/command assumptions.
- Web, desktop, mobile, IDE, and nontechnical consumer interfaces.
- General desktop computer use, broad non-code image workflows, and no-code generation.
- Pathumma and THaLLE reasoning adapters until access and validation exist.
- OAuth, a thcode subscription account, cloud session sync, cross-device identity, export/import, recovery archives, and migration.
- A standalone `.exe` or parallel native installer.
- Automatic installation of runtimes, compilers, SDKs, and package managers.
- Claims that all AI-for-Thai services work merely because they appear in the catalog.

## Capability requirements

### Local agent loop and repository work

- The CLI owns the outer agent loop, stop conditions, repository discovery, context selection, secret detection/redaction, local tool schemas and execution, permissions, session history, and task verification.
- Only the CLI may execute repository, filesystem, Git, shell, build, or test operations on the developer machine.
- A model or hosted service may return a structured local-tool proposal, but the CLI treats it as untrusted data and validates it before execution.
- A task concludes only when verification succeeds, the user accepts a disclosed limitation, or the product reports a blocker.

### Work Modes

- Plan and Build are orthogonal, directly selectable Work Modes.
- Plan is structurally read-only. No Permission Profile can authorize a mutation while Plan is active.
- Build enables eligible mutation and verification operations.
- A user can enter Build directly without producing or accepting a plan.
- New interactive sessions start in Build Mode.
- The active mode remains visible; `Shift+Tab` cycles Plan/Build, and `/plan` and `/build` remain explicit alternatives.

### Permission Profiles

- Manual, Assisted, and Full Access are session-selectable independently of Work Mode.
- Manual is the default for every fresh runtime activation and asks for approval for material transfers, changes, commands, and sensitive operations.
- Assisted applies hard rules and deterministic policy; an AI classifier may recommend but may not authorize or override policy. Uncertainty asks the developer.
- Full Access auto-approves only actions already allowed by the active Work Mode and declared workspace, command, network, service, and quota boundaries.
- Full Access is session-only and still requires a distinct sensitive-transfer override.
- All profiles preserve credential secrecy, provider-host binding, workspace boundaries, audit evidence, and emergency cancellation.
- `/permissions` uses an interactive selector rather than requiring the user to remember profile arguments.

### Dependency preflight

- During Plan, inspect manifests and documented commands; identify required runtimes, compilers, package managers, and environment variables; probe versions non-mutatively; compare requirements; and disclose gaps before mutation.
- Setup advice must come from a maintained thcode registry or verified project documentation, not model-invented URLs or privileged commands.
- `/check` reruns preflight after the user changes their environment.
- thcode does not silently install missing toolchains.

### Artifact references and data transfer

- Code/Markdown: validate workspace path, size-limit, secret-scan, and send selected text only.
- Images: validate type/size, disclose that the image will leave the machine, and require explicit consent.
- DOCX/PDF: extract text locally by default; upload originals only when layout or embedded images are required and the user consents.
- Unsupported binaries: send metadata only or reject clearly.
- Directories: send a bounded manifest first, then read individual files through later local calls.
- Server-side services receive only content deliberately transferred by the CLI and never an unresolved local path as fetch authority.

### Provider and model management

- Typhoon is selected by default and remains stable for a session unless the user changes it.
- `/models` lists adapters, availability/authentication, and permits explicit selection.
- Unavailable or unconfigured adapters show a reason and cannot be selected; the product never silently substitutes another model.
- Provider adapters normalize messages/tool proposals and expose stable identity, authentication state, modalities, context limit, structured-output/tool-call support, streaming, data-handling notes, retryable errors, and rate-limit metadata.
- Session evidence records the exact model and adapter version used.

### AI-for-Thai tool catalog

- The product targets the complete catalog through a versioned capability registry, while making no blanket claim of complete working support.
- Every catalog service has one explicit level: Catalogued, Integrated, Verified, or Demo-certified.
- `/tools` supports browse, search, inspect, enable, disable, and diagnose, and shows manifest version/observation date and honest availability.
- The reasoning model receives only a small task-relevant subset of tool schemas.
- Missing entitlement, exhausted quota, unsupported media, and failed health checks remain explicit unavailable states; there is no silent fallback.
- Sensitive identity, biometric, medical, or similar services require stricter consent/data policies.
- Phase 1 must catalog the then-current official manifest; live runtime scraping is deferred.
- The Verification Quartet is Named Entity Recognition, T-OCR, Speech-to-Text, and Extract Address.
- The public Demo Portfolio is three short independent Typhoon-driven scenarios: T-OCR, Speech-to-Text, and Extract Address. NER supplies verified coverage but is not mandatory in the public demo.

### CLI interaction surface

Candidate commands include `thcode`, `/models`, `/tools`, `/status`, `/permissions`, `/plan`, `/build`, `/context`, `/diff`, `/test`, `/session`/`/sessions`, `/clear`, `/check`, `/connect`, `/disconnect`, `/compact`, and `/exit`. Only headline-demo commands are required in the first implementation milestone.

Session operations are `new`, `list`, `open <id>`, `rename <id>`, `delete <id>`, and `info` under `/session`; `/resume` and separate plural operation commands are excluded. `Tab` accepts slash-command and file completion, `Enter` submits/confirms, and `Esc` dismisses a modal without changing the setting.

## Session, context, and data behavior

### Saved Sessions

- Saved Sessions are global to the current local OS user and machine-local, not repository-local and not cloud-synchronized.
- `/session` can browse from any directory and filter by current, other, or missing workspace association.
- A workspace-aware session retains an explicit binding and never silently rebinds when opened elsewhere.
- Opening restores complete transcript, selected model, Work Mode, pinned turns, compaction history, referenced-artifact manifest, plans, tool/verification history, cumulative token usage, and workspace path.
- Opening also creates a fresh Runtime Activation: Permission Profile resets to Manual; Full Access, sensitive-transfer authorization, and temporary approvals are never restored.
- Session deletion exists; export, import, recovery archive, sync, and migration do not in the prototype.

### Transcript versus Active Model Context

- Preserve and redisplay the complete local Chat Transcript, but build a bounded Active Model Context from current instructions, recent and pinned turns, selected evidence, tool definitions, and inspectable summaries.
- As context pressure rises, compact older unpinned material while leaving the retained transcript unchanged.
- Users can inspect what will be verbatim, summarized, or excluded from the next request.
- Before every provider call, estimate projected context, including new input, evidence, tool schemas, response reserve, and safety reserve.
- If oversized, compact automatically without approval in all modes/profiles and target at most 70% utilization.
- If protected content still cannot fit, stop before sending and show a token breakdown with explicit remedies. Never silently unpin, truncate, or drop protected material.

### Context and token presentation

- The Context Donut measures Active Context Utilization against Effective Context Capacity, not cumulative spend.
- Effective capacity is the verified model context limit minus output reserve and safety margin. Fallback reserves are the greater of configured max output or 8% of raw context, plus the greater of 2,048 tokens or 2% safety; provider limits override.
- Severity bands: below 70% green, 70–84% amber, 85–94% orange, 95–100% red, with segmented ring, percentage, and non-color signal. Narrow terminals use a text fallback.
- Cumulative Token Usage remains separate, reported as input/output/cached totals in `/context`; it has no percentage without a configured budget.

### Persistence and encryption

- One local SQLite Global Session Store holds session metadata, transcripts, pins, compaction records, token ledgers, workspace bindings, plans, audit records, and deliberately retained derived evidence.
- Referenced repository artifacts remain in the workspace; the store retains paths, hashes, metadata, and chosen derived evidence rather than copying source/media by default.
- Sensitive fields—including transcript, names, workspace paths, plans, tool inputs/results, and derived evidence—are encrypted before SQLite persistence.
- Loss of the machine or encryption key can make sessions unrecoverable and must be disclosed.
- API-provider credentials never appear as session database fields.

## Security, credentials, and privacy invariants

- Reasoning is local BYOK: the CLI stores credentials in the OS credential store and calls the selected provider directly.
- The hosted thcode service never receives a reasoning-provider credential.
- Typhoon and AI-for-Thai keys are separate entries bound to exact adapter identities and verified hostnames; a credential is never silently reused for another provider or host.
- Credentials never enter repository files, `.env`, thcode config, logs, telemetry, crash reports, prompts, tool output, session transcripts, or action previews.
- Recognized secrets in tool output are redacted before a reasoning turn.
- Users can explicitly rotate/remove credentials, and onboarding uses masked input plus a minimal health check.
- Workspace resolution and containment apply to every file operation, including Windows drive letters, backslashes, UNC paths, spaces, and case-insensitive behavior.
- Commands stream, cancel, and time out reliably; cancellation must leave no orphaned process.
- Thai input/output remains valid UTF-8.
- Provider/API errors expose connection or quota status without exposing keys.

## Integrations and delivery phases

### Phase 1: before AI-for-Thai onboarding

- Typhoon is the required reasoning provider, called directly from the CLI using the user's local credential.
- A separate AI-for-Thai developer key is optional but competition-relevant; the local CLI calls only configured official endpoints.
- AI-for-Thai results enrich Typhoon context and do not replace Typhoon as the reasoning provider.
- No OAuth, thcode subscription, hosted proxying of user keys, or assumption of catalog onboarding.

### Phase 2: onboarded thcode service

- An AI-for-Thai API key is intended to become the primary platform credential for the onboarded thcode service and permitted platform tools/models.
- Typhoon remains an optional external provider when separately configured.
- Local repository execution, permissions, and the outer agent loop remain local even as remote orchestration expands.
- Gateway headers, endpoints, quotas, downstream-composition authorization, internal credentials, and whether caller keys reach the container are explicitly unverified and cannot be promised until organizers confirm them.

### Hosted service boundary

- The hosted Docker service owns normalized specialist artifact processing and bounded orchestration over AI-for-Thai tools.
- It never connects to a developer machine and never executes local repository/shell/test tools.
- The local CLI may pause/resume a turn to satisfy a structured remote request while retaining authority over transfer and execution.

## Success, quality, and release signals

### Explicit acceptance and exit signals

- A developer can globally install thcode on a fresh supported Windows machine, start it in a repository, and complete the headline Thai multimodal coding task without leaving the terminal.
- The Manual Profile exposes every material action for review, and the developer can verify the result.
- Thai prompts render and submit correctly.
- First-run onboarding stores/retrieves a Typhoon credential without plaintext disk persistence.
- An image within the Windows workspace is resolved and remotely processed only after consent.
- Plan remains read-only and Build can create/run the selected demonstration program with an available documented toolchain.
- Missing/old `pwsh.exe`, unsupported Node.js, and missing project toolchains produce actionable errors without automatic installation.
- Process streaming/cancellation leaves no orphaned child.
- The result reproduces on a second clean Windows machine or VM.
- The hosted API is documented, Dockerized, and has basic load-test evidence.
- Structured tool-call generation, a small Thai coding evaluation set, reasoning-turn count, end-to-end latency, provider cost/quota, and adversarial workspace/redaction behavior are validated.
- Each demo-certified AI-for-Thai service passes a repeatable live contract test and a complete Typhoon-driven scenario.

### Product metrics still missing

The ADRs do not set numeric launch SLOs, evaluation pass thresholds, latency targets, crash/session durability thresholds, support/issue response expectations, user adoption or retention targets, or counter-metrics for approval fatigue, over-refusal, context compaction loss, false availability, or data-store growth. “Production release” therefore needs a release-quality definition beyond the competition demo criteria.

## Rejected and superseded options

- Complete cloud agent: rejected because repository access, remote execution, isolation, and credentials exceed the initial scope.
- Existing-model-API CLI as the whole submission: rejected because it lacks an applicant-owned hosted service boundary.
- MCP gateway only: rejected as insufficient differentiated Thai coding intelligence.
- Mandatory plan-before-build workflow: superseded; Plan and Build are now independent, and new sessions start Build + Manual.
- Multiple initial interfaces: rejected to preserve focus on the terminal agent and service boundary.
- macOS/Linux parity in the prototype: deferred behind Windows.
- Silent dependency/toolchain installation: rejected for security, licensing, disk, and admin-permission reasons.
- OAuth/subscription login in Phase 1: rejected because authoritative platform support does not exist.
- Provider-key proxying through thcode: rejected; BYOK credentials remain local and provider-bound.
- Dynamic catalog scraping at CLI startup: deferred in favor of a reviewed versioned manifest.
- Describing catalog presence as callable support: rejected; support levels must remain explicit.
- Sending all tool schemas to the model: rejected in favor of task-relevant routing.
- Standalone `.exe` alongside npm: excluded from the prototype.
- OpenTUI/Bun: rejected for Node/npm alignment and Windows packaging risk; TypeScript/React/Ink selected.
- Treating the transcript as the whole prompt forever: rejected in favor of bounded inspectable Active Model Context.
- Restoring Full Access or transfer approvals with session history: rejected; knowledge restores, authority resets.

## Open questions and gaps for PRD discovery

### Product and user

- Which specific Thai developer segment is first, and what recurring task/pain is important enough to switch from existing coding agents?
- What is the canonical start-to-finish user journey and headline task beyond “Thai multimodal coding task”?
- Is the PRD's target the time-bounded competition prototype, an open-source production release, or a staged plan that defines both separately?
- What does open-source success mean: users, contributors, integrations, adoption, trust, or competition acceptance?

### Scope and prioritization

- Which candidate commands and local tools are genuinely MVP-critical?
- Which repository languages/frameworks and verification workflows are supported/tested at launch?
- Are configurable private OpenAI-compatible providers, Anthropic, Ollama, and vLLM release requirements or post-MVP architecture?
- Must the initial open-source release include the brainstorm's crash recovery and prompt-level rollback, or are those later production-hardening milestones?
- What upstream service entitlement, quota, and fixture access is actually available for the Verification Quartet?

### Safety and policy

- Define material action, sensitive transfer, dangerous action, hard refusal, command/network/service boundaries, quota limits, and the audit evidence required for each.
- Clarify whether any boundary expansion may persist across activations, and if so distinguish durable administrative configuration from temporary permission/transfer authorization.
- Define retention/deletion, corruption recovery, key rotation, and privacy disclosure for encrypted sessions.
- Define how telemetry remains useful while respecting code, path, tool-result, and credential secrecy.

### Reliability and UX

- Numeric SLOs for startup, input responsiveness, context operations, provider health, prompt round, tool execution, cancellation, persistence, and recovery.
- Exact behavior for provider outage, quota exhaustion, malformed tool calls, partial streams, SQLite corruption/migration failure, credential-store failure, and workspace movement/deletion.
- Accessibility and fallback behavior for terminals that lack color, Unicode ring support, mouse interactions, or sufficient width.
- Which context items can be pinned/protected and how users inspect/override compaction without becoming context engineers.

### Distribution and maintenance

- Reverify npm package-name availability at publication; the 12 July 2026 check is not a durable guarantee.
- Define npm provenance/signing, dependency integrity, lifecycle-script policy, versioning, upgrades, rollback, uninstall, vulnerability response, and compatibility windows.
- Define extension/catalog governance: contributor model, review, ownership, updates, revocation, schema compatibility, and deprecation.

## Relationship to the production-foundation brainstorm

### Confirmed or strengthened

- Thai-first CLI form factor and developer audience are confirmed.
- TypeScript is confirmed; the terminal UI is React/Ink and the headless core stays UI-independent.
- Generic provider/tool contracts, metadata/registry-driven discovery, explicit availability, and honest support levels align strongly with the extension-platform direction.
- Local authority, declared boundaries, inspectable actions, credential secrecy, and remote service separation align with the trust-harness proposition.
- Active Context Utilization versus Cumulative Token Usage is fully specified by ADRs 0014–0015.
- Session continuity, encrypted local storage, and runtime-authority reset add concrete durability/privacy requirements absent from the brainstorm.

### Scope tensions or conflicts

- **Open-source production foundation versus competition prototype:** the brainstorm asks for production-grade restructuring, while most ADR acceptance criteria are scoped to a Windows-only competition prototype. The PRD must explicitly decide whether production is Release 1 or a later quality bar after the demo.
- **Broad extension configuration versus one-adapter MVP:** the brainstorm expects post-install local/private OpenAI-compatible and Anthropic-style extensibility; ADR 0004 requires only Typhoon and defers other reasoning adapters. This can be reconciled as architecture versus release scope, but the milestones must say so.
- **Persistent boundary expansion versus fresh authority:** the brainstorm says previously approved boundary expansions persist across activations, while ADRs 0012 and 0016 say Full Access, sensitive-transfer authorization, and temporary approvals never restore. If durable boundary configuration is intended, it needs a separate administrative model; otherwise the brainstorm statement is superseded.
- **Health semantics:** the brainstorm says configured models are available only after a live health check and real-use protocol failure blocks them pending explicit retest. The AI-for-Thai ADRs use Catalogued/Integrated/Verified/Demo-certified support levels and explicit unavailable states, but do not fully specify the same provider unhealthy/retest state machine. This is an additive requirement, not yet a fully reconciled shared lifecycle.
- **Rollback and uncertain-crash recovery:** these are explicit brainstorm commitments but absent from the ADR set. Session restoration and encrypted persistence do not by themselves satisfy exact interruption markers, no-retry-on-unknown-outcome, or prompt-level conflict-safe rollback.
- **Approval disclosure:** ADR 0012 defines when approval occurs, but not the brainstorm's two-depth preview content, exact command disclosure, verified endpoint/payload summaries, or deterministic remote-failure evidence. Those remain PRD requirements needing detailed acceptance criteria.

### ADR decisions that narrow or supersede brainstorm ambiguity

- Surface: CLI only, native Windows first.
- Shell/runtime/distribution: PowerShell 7.4+, Node.js 22+, npm, TypeScript/React/Ink.
- Default runtime state: Build + Manual, not mandatory Plan first.
- Credentials: local OS credential store; direct provider calls; separate Typhoon and AI-for-Thai identities.
- Sessions: global machine-local store, encrypted sensitive content, complete transcript with bounded Active Context, no prototype cloud sync/export.
- AI-for-Thai: complete catalog is discoverable by manifest, but callable claims are graduated and evidence-based.

## Mechanism-level material for `addendum.md`

The PRD should preserve the externally meaningful contracts but move these implementation choices and rationale into the technical addendum/architecture record:

- Local outer loop plus optional bounded server sub-loop; resumable turn protocol and normalized tool-call schema.
- Headless agent core separated from React/Ink views; UI dispatches typed intents and never calls providers/filesystem/shell/services directly.
- TypeScript, React, Ink, Node version pinning, npm `bin`, package-name fallback, and OpenTUI/Bun rejection rationale.
- Windows-specific adapters for `pwsh.exe`, subprocess streaming/cancellation, paths/UNC/case semantics, and Credential Manager.
- SQLite as the Global Session Store and native per-platform state directories.
- AES-256-GCM field encryption, unique nonces, record identity/schema version as authenticated metadata, keyed workspace indexes, and per-install encryption key storage.
- Exact Active Context fallback formulas, token estimation/reconciliation, compaction representation, and provider-specific override mechanics.
- Versioned AI-for-Thai Catalog Manifest schema, adapter families, normalized I/O mappings, routing only relevant schemas, contract-test fixtures, and support-level metadata fields.
- Docker service packaging, remote API transport, bounded sub-loop budgets, payload/time/size limits, retries, and gateway integration details.
- Provider-adapter interface fields and normalized message/tool schemas.
- Toolchain registry structure and verified setup-instruction provenance.
- Candidate command namespace, keybindings, terminal component architecture, and snapshot/interaction testing strategy.

## Discovery handoff

The ADR set supplies unusually concrete platform, security, data, and runtime contracts. The next product work should not re-litigate those mechanisms unless the open-source production target intentionally supersedes them. It should resolve the specific launch user/job, competition-versus-production release boundary, a real named developer journey, minimum capability slice, production quality metrics/counter-metrics, and whether crash recovery/rollback/extensible private endpoints are Release 1 requirements.
