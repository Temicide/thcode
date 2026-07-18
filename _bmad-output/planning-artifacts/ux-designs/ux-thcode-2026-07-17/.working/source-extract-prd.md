# UX-relevant source extract — thcode PRD

Source: `prd.md` (updated 2026-07-16)

This extract preserves the PRD’s UX-relevant facts and constraints only. Source terminology is retained verbatim.

## Users and non-users

### Target user

- The first-release user is a **Thai-speaking or Thai-English-speaking developer** who is comfortable with a terminal, curious about Thai models and Thai AI services, and willing to bring their own API credentials.
- **Nok** represents this user inline; there is no separate persona model.
- The product is for a curiosity-driven, experimental experience, not dependable production coding work.

### Non-users for the first release

- Developers seeking a replacement for frontier-model coding agents or dependable production coding automation.
- Nontechnical users seeking a graphical, no-code, desktop-computer-use, web, mobile, or IDE product.
- Teams requiring Linux support, cloud-synchronized sessions, enterprise identity, or centrally managed deployment.
- Users without their own Typhoon and AI-for-Thai credentials.

## Jobs to be done

Users need to:

- Experience Typhoon responding naturally to Thai or mixed Thai-English prompts.
- Prove that Typhoon can inspect a bounded workspace, call essential local tools, create and execute a small program, and verify the result.
- Invoke T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition through natural prompts rather than hand-wiring each service.
- Understand which model or service acted, what data left the machine, which permissions applied, and what Evidence supports the result.
- Diagnose failed credentials, unavailable services, missing dependencies, unsafe actions, and uncertain remote outcomes without silent fallback or fabrication.
- Resume earlier experiments without restoring stale execution authority or losing control of active context.

## Core experience principles and product tone

- The unifying experience principle is **legibility**: actions remain visible, deterministic Evidence precedes model explanation, and uncertainty is preserved rather than smoothed over.
- The harness must remain trustworthy even when Typhoon or a remote service performs poorly.
- Positioning must be honest: thcode does not promise better coding productivity, coding parity, or superior coding outcomes.
- User-facing purpose, consequence, error, and completion explanations support **natural Thai** while preserving exact technical identifiers and commands.
- Explanations are plain-language, actionable, and anchored to deterministic Evidence.
- thcode must not silently substitute a model, service, protocol mapping, missing result, or unsupported capability; it must not fabricate content or imply unverified compatibility.

## Form factor, platform, and distribution

- Native terminal CLI/TUI; launch by entering `thcode` in the terminal.
- npm package, installed as a global CLI exposing the `thcode` command.
- Windows 11 version 25H2 or later through Windows Terminal with PowerShell.
- macOS 14 Sonoma or later through Terminal with zsh.
- Node.js 22+ required; Node.js 24 LTS is the clean-machine release baseline.
- Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, web, desktop GUI, mobile, IDE, and autonomous computer-use support are out of scope.
- The TUI must remain usable in narrow terminals and provide a text fallback where needed.

## Surfaces and entry points

- First-run onboarding and protected credential forms.
- Normal terminal interface / conversation surface.
- Persistent or immediately inspectable status for Typhoon, Work Mode, Permission Profile, AI-for-Thai connection, active service health, and Active Context Utilization.
- Slash-command surface with completion and explicit controls for models, tools, status, settings, permissions, Work Mode, context, Saved Sessions, dependency checks, connections, compaction, clearing, and exit.
- `/models`: inspection-only view of Typhoon identity, version, capabilities, authentication, and health; no model-selection flow.
- `/tools`: Capability Registry browsing, searching, inspection, enabling, disabling, diagnosing, and retesting.
- `/context`: categorized projected and cumulative usage.
- `/session`: create, list, open, rename, delete, and inspect machine-local Saved Sessions.
- `/sessions`: opens the same Saved Sessions browser.
- `/check`: repeats dependency preflight after the user changes the environment.
- Context Donut with percentage and non-color severity signals, plus a text fallback for narrow terminals.
- Compact activity log showing every proposed and executed tool call, including automatically permitted list, read, and search actions.
- Action previews / approval surfaces for file changes, deletion, commands, and Specialist Service calls.
- Saved Sessions browser showing session names, workspace associations, selected model, Work Mode, and context status.
- Transcript and Evidence views, including tool and verification history, context/compaction history, artifact manifest, usage, and rollback state.
- Rollback surface for selecting a recent Prompt Round checkpoint and presenting conflicts for manual resolution.

## Key journeys and interaction requirements

### UJ-1 — Nok’s curiosity-driven first experience

1. Install and launch with `thcode`.
2. Explain that the release uses Typhoon, provided by SCBx; request the Typhoon API key.
3. Enter the Typhoon API key in a protected form and submit.
4. Run a live availability check; on pass, open the normal terminal interface.
5. Send a low-risk first prompt such as “hello world” and receive a conversational response.
6. When an image-document OCR request needs an unconfigured AI-for-Thai credential, explain what is missing and open the specialist-service connection flow.
7. Enter a separate AI-for-Thai API key; verify key and service availability; retry OCR.
8. Route the image through the configured AI-for-Thai OCR extension and supply OCR result to the reasoning experience.
9. Return extracted document text without inventing unrecognized content.
10. Explore controls through slash commands: Typhoon status and capabilities, settings, usage, permissions, and Plan/Build modes.

Critical trust moments: provider identity, separate key and service health, OCR destination, data leaving the machine, active Work Mode and Permission Profile.

### UJ-2 — Nok explores the AI-for-Thai service catalog

- One AI-for-Thai API key covers all entitled first-release Specialist Services; no separate key per service.
- Natural-language prompts imply specialist capabilities such as Thai audio transcription, Thai address extraction, or named-entity identification.
- thcode identifies the relevant available service and shows which service and user data the proposed call will involve.
- After required consent, invoke the service and return its result through the conversation for inspection or continued prompting.
- Discover the catalog through tasks rather than manually wiring integrations.
- If unavailable, unsupported, unhealthy, or outside entitlement/quota, explain that state instead of substituting or fabricating.

Critical trust moments: selected service, relevance, content leaving the machine, health/authorization, and what came from the service versus the reasoning model.

### UJ-3 — Nok diagnoses and recovers an unhealthy specialist service

- Show inspectable network/protocol evidence when a request fails.
- Derive a deterministic failure category and present a plain-language explanation; retain sanitized Evidence without credentials.
- Scope unhealthy state to the evidence: service-specific protocol failure quarantines only that service; rejected shared AI-for-Thai Key makes the shared connection and dependent services unavailable.
- Do not silently reinterpret protocol, substitute another service, or invent a result.
- User corrects configuration/credential and explicitly requests a retest through service management.
- Passing live retest returns the affected service to the available catalog.
- Keep entitlement, quota, unsupported-input, timeout, network, rate-limit, upstream-server, protocol-health, and shared-credential states visibly distinct.

Critical trust moments: deterministic evidence, hidden credentials, unmistakable unavailable state, explicit retest.

### UJ-4 — Nok proves a Thai model can complete a bounded CLI-agent task

- Start in a bounded Workspace with Typhoon selected and a C++ compiler installed.
- Ask for a C++ file that prints `Hello, World!`.
- Inspect the Workspace and preflight the compiler without installing anything.
- If missing/unavailable, stop, explain the prerequisite problem, and give actionable guidance for installing a supported toolchain such as Clang.
- Show target path and proposed file change before approval; write through a controlled local tool.
- Show exact compilation/execution commands; enforce Work Mode and Permission Profile; stream results.
- Verify compilation exit code `0`, execution exit code `0`, and expected stdout.
- Show created file, tool activity, command Evidence, and final verification in the terminal.

### UJ-5 — Nok safely resumes a Saved Session

- Open Saved Sessions from any directory on the same machine and local OS account.
- Show names, Workspace associations, selected model, Work Mode, and context status.
- Restore complete local transcript, Typhoon selection, Work Mode, pinned turns, context and compaction history, referenced-artifact manifest, tool and verification history, cumulative token usage, and original Workspace binding.
- Keep transcript browsable while the next provider request uses bounded Active Model Context.
- Start a fresh Runtime Activation: Permission Profile resets to Manual; Full Access, sensitive-transfer authorization, and temporary approvals do not restore.
- Previously approved Boundary Expansions remain visibly inspectable and active until explicitly revoked.
- Surface missing or changed original Workspace; never silently rebind.
- Continue only after reviewing restored context and granting new temporary authority as required.

### UJ-6 — Nok recovers from an interrupted remote request

- Restore all response content and Evidence known to have arrived.
- Insert an explicit **`Chat interrupted`** marker where reliable history ends.
- Do not automatically retry, invent missing completion, or assume the remote side did nothing.
- Let Nok inspect preserved content and uncertainty and deliberately decide whether/how to prompt again.

### UJ-7 — Nok safely rolls back an agent change

- Select a recent prompt-level Rollback Checkpoint.
- Check whether current file state still matches the attributable Prompt Round change.
- Reverse matching agent changes without undoing unrelated user work.
- Stop overlapping later edits and present them for manual resolution.
- Keep changed/deleted binary originals recoverable during configured retention.
- Default checkpoint expiry is five subsequent prompts; expired rollback data is deleted.

## States and state distinctions

### Connection and service states

The UI distinguishes **configured**, **checking**, **available**, **unavailable**, and **unhealthy** states. Availability means the relevant live connectivity and authentication check passed for the effective configuration.

Service states remain distinct for:

- Missing entitlement.
- Exhausted quota.
- Unsupported input.
- Transient network state.
- Failed health check.
- Protocol incompatibility.
- Timeout, network loss, rate limit, quota exhaustion, upstream server failure (temporary or quota states; do not quarantine after one occurrence).
- Deterministic service-specific entitlement/protocol failure versus deterministic shared AI-for-Thai Key rejection.

Catalog entries not operational at launch display **Catalogued — Not available yet**, cannot be selected or invoked, and include manifest version or observation date.

### Work, permission, and approval states

- Work Mode is **Plan** or **Build**; Plan is structurally read-only under every Permission Profile; Build permits eligible mutation and verification.
- Permission Profile is **Manual**, **Assisted**, or **Full Access**, independently of Work Mode.
- Every new/restored Runtime Activation starts in Manual.
- Fresh interactive sessions start in Build with Manual.
- Full Access has a prominent, session-scoped activation warning visible while active; it does not restore across Runtime Activations.
- Full Access does not approve sensitive transfer; sensitive transfer requires separate explicit override.
- Plan, Build, Full Access, destructive action, unhealthy service, interruption, and rollback conflict are visually distinct.
- Approval never replaces enforcement; non-overridable boundaries remain enforced.

### Context and usage states

- Active Context Utilization is measured against Effective Context Capacity, separate from cumulative token usage.
- Context Donut severity bands: below 70% green, 70–84% amber, 85–94% orange, 95–100% red; each band also has a non-color label.
- `/context` distinguishes provider-reported token counts from estimates and cumulative input, output, and cached usage.
- Projected context sizing occurs before every provider call.
- Automatic, inspectable compaction targets no more than 70% utilization while preserving complete transcript and pinned content.
- If protected content cannot fit, stop before sending with token breakdown and explicit remedies; never silently unpin, truncate, or drop protected content.

### Action/result states

- Tool proposals are untrusted input and are validated against tool schemas, Work Mode, Permission Profile, Workspace, and hard boundaries.
- Invalid proposals are never executed; unresolved invalid proposals are rejected with the validation error.
- The loop may stop on final response, verified completion, explicit user acceptance of a disclosed limitation, refusal, hard boundary, or defined error.
- Significant actions and demonstrations link input/artifact hash, model, Specialist Service, normalized Evidence, proposed action, approval state, command output, verification result, and error state.
- Completion summaries state what changed, what was verified, which service contributed, and what risk remains.

## Interactions and controls

- **Shift+Tab** switches Plan and Build.
- **Tab** accepts completion.
- **Esc** dismisses a modal without changing its setting.
- Slash commands must be discoverable; completion and explicit controls reduce command memorization.
- In-workspace listing, reading, and searching proceed without interrupting the user under default Manual when within Workspace and without material remote transfer.
- Creating, editing, deleting, and executing commands show the proposed action and require approval in Manual; deletion is visibly destructive.
- Local commands show exact command text; file mutations show target and change; deletion is marked destructive; Specialist calls show verified destination and safe transfer details.
- Before material leaves the machine, show plain-language purpose plus service, verified endpoint, method where relevant, safe payload summary, and expected side effects.
- Images, audio, sensitive documents, and Boundary Expansions require explicit authority appropriate to risk.
- Retest is a visible user action with progress, result, timestamp, and updated Evidence; background retries must not masquerade as explicit retest.
- Freshness/re-run control can force a Specialist Service call despite cached Evidence; show when cached Evidence is reused.
- Rollback UI states covered built-in file changes and does not imply reversal of excluded effects.
- Command cancellation and timeout must not leave orphaned child processes (behavioral constraint affecting interaction feedback).

## Accessibility and inclusive interaction constraints

- Status and severity information must not rely on color alone.
- Context Donut has percentage plus non-color severity signals and a text fallback for narrow terminals.
- Plan, Build, Full Access, destructive action, unhealthy service, interruption, and rollback conflict require visual distinction beyond color.
- Thai input and output must remain valid UTF-8 across supported terminals, persistence, streaming, and service calls.
- Preserve exact technical identifiers and commands while supporting natural Thai explanations.
- Narrow-terminal usability is an explicit requirement.
- Protected forms use masked, non-echoing input for credentials.

## Explicit visual direction

- Terminal-first TUI, with persistent or immediately inspectable status.
- Overall direction is **legibility**: visible actions, visible state/risk/availability/results, deterministic Evidence before model explanation, and preserved uncertainty.
- Use visually distinct states for Plan, Build, Full Access, destructive action, unhealthy service, interruption, and rollback conflict.
- Do not rely on color alone; pair color severity with labels/non-color signals.
- Use a Context Donut for context utilization, with text fallback in narrow terminals.
- Activity should be inspectable but compact: every proposed/executed tool call appears in a compact activity log.
- Progressive disclosure: first show purpose and risk in plain language, then allow inspection of exact authoritative details.
- Preserve technical fidelity in the visual language: exact commands, target paths, endpoints, service identity, evidence, timestamps, and verification outcomes.

## Privacy, trust, and credential UX constraints

- Before key entry, identify the provider’s verified host and explain where the key will be stored and used.
- Typhoon Key and AI-for-Thai Key are separate; keys are stored through the OS credential facility, not project files, environment files, transcripts, or Saved Session store.
- Keys never enter prompts, repository files, logs, telemetry, crash reports, Saved Sessions, action previews, or generated UI.
- Sensitive local session content is encrypted before persistence.
- Sanitize before content is persisted, displayed, or exported, including headers, URLs, environment values, errors, tool output, and payload summaries.
- Remote services receive only deliberately selected content and never an unresolved local path as fetch authority.
- Transcript distinguishes Specialist Service output from Typhoon-generated explanation.
- Preserve source hash, selected service, returned fields, confidence/uncertainty, empty fields, and provenance; missing or uncertain fields are not invented.
- Raw prompt, command, or payload export is disabled by default.

## Anti-patterns explicitly prohibited

- Silent fallback, substitution, protocol reinterpretation, silent repair, or fabricated result/content.
- Claiming coding parity, superior coding outcomes, dependable production coding automation, or unverified capability compatibility.
- Sending credentials to the wrong provider, hosted thcode component, prompts, logs, or persisted session data.
- Automatic retry of remote requests with unknown outcomes.
- Silently restoring stale execution authority, Full Access, temporary approvals, sensitive-transfer authorization, or rebinding a Saved Session to the current directory.
- Silently dropping protected context, unpinning, truncating, or removing protected content.
- Silent installation of compilers, runtimes, SDKs, package managers, or dependencies.
- Invoking catalog entries labeled **Catalogued — Not available yet**.
- Treating approval as a substitute for enforcement or allowing Full Access to erase hard boundaries.
- Hiding service-specific versus shared-key failures or disguising background retries as explicit retests.
- Claiming rollback for shell-command effects, remote-service effects, permission changes, external processes, symlink side effects, or other unobservable mutations.
- Relying on color alone for status/severity.
- Presenting `/models` as a model-selection flow or implying other first-release Reasoning Models.
- Forcing a mandatory Plan-before-Build gate; users can switch directly between Plan and Build.
- Requiring one AI-for-Thai credential per service.

## Unresolved gaps and deferred decisions affecting UX

- **Sensitive-data policy** (owner: product/security): classification, consent language, local retention and deletion, and upstream data-handling disclosure must be defined before affected AI-for-Thai services are publicly enabled.
- **Numeric performance budgets** (owner: engineering/QA): startup, TUI response, health checks, Prompt Rounds, compaction, session restore, and each Specialist Service are not yet assigned targets.
- **Platform enforcement matrix** (owner: architecture/security): Windows/macOS enforcement for Workspace, command, process, network, and fail-closed behavior must be documented before implementation sign-off; the PRD notes implementation must define this matrix.
- **Exact Typhoon release pin** (owner: product/engineering): launch model identifier, endpoint contract, and adapter version must be recorded before integration freeze and included in release Evidence.
- Repository governance, contribution policy, private security-reporting channel, and support expectations remain undefined before public publication.
- Numeric context/usage budget behavior is only defined when Nok configures a budget; no default cumulative-usage percentage is specified.
- Service/catalog metadata includes manifest version or observation date, but the PRD does not define the final presentation format.
- The PRD requires an operating-system credential facility and encrypted local persistence but does not name the final implementation or recovery UX; loss of the local encryption key is disclosed as unrecoverable.
- The PRD calls for a platform/action enforcement matrix and fail-closed behavior when sandbox/boundary mechanisms are unavailable, but leaves the concrete enforcement UX and platform-specific interaction details to implementation/security.
