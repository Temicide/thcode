# thcode PRD Addendum

This addendum preserves architecture and solution-design depth supplied during product discovery. It informs downstream architecture and UX work without turning implementation mechanisms into product requirements.

## Extension architecture direction

- Use metadata-driven discovery and reusable generic TUI components so adding a provider or specialist service does not require provider-specific UI changes or changes to existing implementations.
- Keep post-install configuration declarative and non-executable.
- Provide built-in OpenAI-compatible and Anthropic protocol profiles for reasoning providers.
- Use declarative HTTP request/response mappings for specialist services where practical, with reviewed built-in adapters for protocols that cannot fit the declarative model.
- Keep slash commands product-controlled and implemented as reviewed TypeScript rather than user-defined executable configuration.
- Treat arbitrary OpenAI-compatible, Anthropic, and private Specialist Service configuration as post-launch architecture; Release 1 remains Typhoon-only with four reviewed AI-for-Thai integrations.

## Failure evidence and observability direction

- Derive remote-service failure categories deterministically from network evidence.
- Retain sanitized underlying evidence separately from any model-generated explanation.
- Treat total prompt-round duration as the primary user-visible performance unit while retaining subsystem timings for diagnostics.
- Track Active Context Utilization separately from Cumulative Token Usage.
- Consider an append-only incident/event record, but confirm this mechanism before treating it as an architectural commitment; it appeared as supporting presentation language rather than an explicit primary-source decision.

## Recovery and rollback mechanisms

- Build prompt-level rollback checkpoints from before hashes and exact agent patches.
- Reverse only changes whose current state still matches the recorded agent change; overlapping later edits stop for manual resolution.
- Temporarily retain complete originals for changed or deleted binary files.
- Default checkpoint retention to five subsequent prompts, make retention configurable, and garbage-collect expired data.
- Encrypt retained binary originals, cap each checkpoint at 100 MB and the total rollback store at 500 MB, and require explicit confirmation before an unprotected action that would exceed a cap.
- Limit the first-release rollback guarantee to mutations performed through thcode's built-in create, edit, and delete tools. Do not claim reversal of shell-command effects, remote-service effects, permission changes, external processes, symlink side effects, or other untracked mutations.
- After an uncertain remote dispatch, preserve received output and interruption state without automatically retrying or synthesizing a missing completion.

## Rejected approaches and rationale

- **Provider-specific UI:** rejected because it couples product surfaces to each implementation and makes every integration more expensive to add and maintain.
- **Executable user configuration or custom adapters:** rejected to preserve a reviewed execution boundary and reduce arbitrary-code risk.
- **User-defined slash commands in configuration:** rejected in favor of reviewed product code.
- **Tool-calling compatibility in the connectivity health gate:** rejected because initial availability is intended to prove connectivity; actual protocol incompatibility is handled explicitly when encountered.
- **Silent protocol repair or reinterpretation:** rejected because it hides configuration errors and weakens trustworthy evidence.
- **Unbounded Full Access:** rejected because workspace, command, network, service, quota, and sensitive-transfer boundaries remain independently meaningful.
- **Model-only failure diagnosis:** rejected because explanations must remain anchored to deterministic classification and inspectable evidence.
- **Automatic retry after uncertain remote effects:** rejected because it can duplicate side effects.
- **Blind rollback through later edits:** rejected because it can destroy user work.
- **Permanent rollback retention:** rejected in favor of bounded, configurable retention to limit storage and exposure.

## Architecture questions to resolve downstream

- Extension registry ownership, distribution, versioning, update, revocation, naming-collision, and compatibility rules.
- Credential entry, secure storage, reference, rotation, and redaction mechanisms.
- Metadata and declarative-mapping schema, validation, and migration rules.
- Exact endpoint verification semantics and health-check contracts for each extension type.
- Store durable Boundary Expansions separately from Permission Profile, Full Access, sensitive-transfer permission, and temporary action approvals. Persist and audit expansions across Runtime Activations until explicit revocation; reset the other authority classes on activation.
- Durable chat/event recording guarantees and reconciliation of remote outcomes that remain unknown after recovery.
- Checkpoint protection, sizing, garbage collection, and behavior across renames, directories, permissions, symlinks, large files, Git changes, concurrent processes, and multiple agents.

## Delivery baseline captured from project decisions

- Keep a headless TypeScript agent core beneath the terminal presentation, with React and Ink as the current TUI direction.
- Distribute the CLI as a global npm package exposing the `thcode` command; use an organization-scoped package if the unscoped name is unavailable.
- Target Windows 11 version 25H2 or later and macOS 14 Sonoma or later in the first public release. Windows uses Windows Terminal and PowerShell through `pwsh.exe`; macOS uses the standard Terminal with zsh. Release-test each minimum plus the newest stable OS versions. Do not treat WSL or Windows PowerShell 5.1 as supported Windows environments.
- Use Node.js 22+ as the minimum runtime and Node.js 24 LTS as the clean-machine release baseline. PowerShell 7.4+ with 7.6 LTS remains the source-derived Windows baseline.
- Keep provider adapters, direct reasoning-provider calls, intent and artifact handling, context governance, action validation, permissions, local tools, sessions, and verification in the local CLI.
- Keep the hosted service unable to reach the developer machine or execute repository, filesystem, shell, build, or test operations.
- For the first public release, call official AI-for-Thai endpoints directly from the local CLI using the locally stored user key. Typhoon proposes tool calls but never receives the key. A Dockerized hosted artifact-processing/orchestration boundary is deferred and is not part of the launch request path.

## Session and context mechanisms

- Use one per-user, machine-local SQLite Global Session Store.
- Encrypt sensitive session fields before persistence with per-record authenticated AES-256-GCM and keep the per-install encryption key in the OS credential store.
- Store repository paths, hashes, metadata, and deliberately retained derived evidence rather than copying source artifacts by default.
- Separate the complete local transcript from the bounded Active Model Context sent to a provider.
- Calculate Effective Context Capacity from the verified model limit minus output reserve and safety margin; retain categorized counts and distinguish provider-reported values from estimates.
- Until provider-specific verified limits override them, use a response reserve equal to the greater of configured maximum output or 8% of raw context, plus a safety margin equal to the greater of 2,048 tokens or 2% of raw context.
- No unverified raw context limit (for example `128k`) or unverified fallback capacity (for example `115,200`) is a release commitment without a named provider/product decision and source. Before the exact verified limit exists, the UI shows `percentage unavailable` and no fabricated denominator is used. (See PRD §12.1 PR-4.)
- Preserve pinned content, make compaction inspectable, and stop before a provider call when protected content cannot fit.

## Product schemas and evaluation mechanics

- Use a versioned normalized coding-task representation for intent, ambiguity, artifact handling, Thailand-specific flags, and verification criteria.
- Use a versioned capability registry covering catalog identity, modality, entitlement, policy, operational evidence level, and observation date.
- Define type-specific artifact policies, normalized evidence contracts, uncertainty fields, and structured local-action validation.
- Cache derived Specialist Service Evidence by source-content hash as a first-release outcome so an unchanged artifact is processed once per Service Configuration; expose a freshness or re-run control and coordinate cache retention with the deferred sensitive-data policy.
- Evaluate differentiation with reproducible repository fixtures, the same model and tool access, captured outcomes and safety violations, and a materiality analysis rather than unsupported category claims.
- Preserve Docker packaging, API documentation, load testing, deployment monitoring, quotas, and gateway credential design as downstream delivery work for the hosted boundary.

## Product ladder and demonstration disposition

- Release 1 is the curiosity-driven Thai-model CLI-agent proof defined by the PRD.
- A broader Thai work-agent experience remains a post-launch direction rather than a Release 1 promise.
- The C++ Hello World journey is the canonical Release 1 local-agent proof. Earlier logo-to-page, Speech-to-Text-to-Express, and Extract-Address-to-Next.js competition scenarios are superseded as headline acceptance journeys and are not normative Release-1 fixtures; their reusable privacy and fixture mechanics may inform QA but do not gate the release.

## Release engineering direction

- Keep the headless TypeScript core isolated from React/Ink terminal presentation so non-interactive validation does not depend on TUI rendering.
- Publish an npm package with an explicit thcode binary entry and engines metadata matching the confirmed Node.js baseline.
- Validate clean global install, update, uninstall, package-name ownership, lockfile reproducibility, and supported-platform artifact contents before release.
- Use an organization-scoped npm package only if the canonical unscoped name cannot be published, without changing the lowercase product and command spelling.
