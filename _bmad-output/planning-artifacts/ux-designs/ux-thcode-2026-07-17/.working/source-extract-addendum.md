# UX Source Extract — PRD Addendum

Source: `prd-thcode-2026-07-14/addendum.md`

This extract includes only UX-relevant additions, overrides, constraints, terminology, states, workflows, and unresolved gaps. It does not infer requirements beyond the addendum.

## Overrides

- **Release scope:** Release 1 remains Typhoon-only with four reviewed AI-for-Thai integrations. Arbitrary OpenAI-compatible, Anthropic, and private Specialist Service configuration is post-launch architecture, not a Release 1 UX promise.
- **Product positioning:** Release 1 is the curiosity-driven Thai-model CLI-agent proof. A broader Thai work-agent experience is post-launch, not a Release 1 promise.
- **Canonical demonstration:** The C++ Hello World journey is the canonical Release 1 local-agent proof.
- **Superseded demonstrations:** Logo-to-page, Speech-to-Text-to-Express, and Extract-Address-to-Next.js are no longer headline acceptance journeys or normative Release 1 fixtures. Their reusable privacy and fixture mechanics may inform QA but do not gate release.
- **Hosted boundary:** A Dockerized hosted artifact-processing/orchestration path is deferred and is not part of the launch request path. Release 1 calls official AI-for-Thai endpoints directly from the local CLI using the locally stored user key; Typhoon proposes tool calls but never receives the key.
- **Connectivity health gate:** It proves initial availability/connectivity only; tool-calling compatibility is handled explicitly when encountered.
- **Rollback guarantee:** First-release rollback covers only mutations through thcode’s built-in create, edit, and delete tools. It does not claim reversal of shell-command effects, remote-service effects, permission changes, external processes, symlink side effects, or other untracked mutations.
- **Rollback retention:** Retention is bounded and configurable rather than permanent: default is five subsequent prompts, with expired data garbage-collected.
- **Configuration boundary:** User-defined executable configuration, custom adapters, and user-defined slash commands are rejected. Slash commands are product-controlled and implemented as reviewed TypeScript.
- **Failure explanation:** Model-only diagnosis is rejected. User-facing explanations must remain anchored to deterministic classification and inspectable evidence.
- **Remote retry:** Automatic retry after an uncertain remote effect is rejected; the system must not duplicate possible side effects.
- **Rollback behavior:** Blind rollback through later edits is rejected; overlapping later edits stop for manual resolution.
- **Permission model:** Unbounded Full Access is rejected; workspace, command, network, service, quota, and sensitive-transfer boundaries remain independently meaningful.

## Additions and UX-relevant constraints

### Extensibility and integrations

- Discovery is metadata-driven and uses reusable generic TUI components; adding providers or specialist services should not require provider-specific UI changes.
- Post-install configuration is declarative and non-executable.
- Built-in OpenAI-compatible and Anthropic protocol profiles are available for reasoning providers, but arbitrary configuration is post-launch.
- Specialist services use declarative HTTP request/response mappings where practical, with reviewed built-in adapters for protocols that cannot fit that model.
- Release 1 has four reviewed AI-for-Thai integrations; the UX must not imply unrestricted provider/service extensibility in this release.

### Failure evidence and observability

- Remote-service failure categories are derived deterministically from network evidence.
- Sanitized underlying evidence is retained separately from any model-generated explanation. The UX needs to distinguish evidence from explanation rather than presenting them as equivalent.
- Total prompt-round duration is the primary user-visible performance unit. Subsystem timings remain available for diagnostics.
- Active Context Utilization and Cumulative Token Usage are separate concepts and must not be conflated in presentation.
- An append-only incident/event record is only a consideration, not an architectural commitment.

### Recovery, rollback, and uncertain remote work

- Prompt-level rollback checkpoints contain before hashes and exact agent patches.
- A reverse operation applies only when the current state still matches the recorded agent change.
- If later edits overlap the recorded change, rollback stops for manual resolution rather than overwriting later work.
- Complete originals of changed or deleted binary files are temporarily retained.
- Checkpoint retention defaults to five subsequent prompts, is configurable, and expires through garbage collection.
- Retained binary originals are encrypted. Each checkpoint is capped at 100 MB and the rollback store at 500 MB.
- Before an unprotected action would exceed a cap, explicit confirmation is required.
- After an uncertain remote dispatch, preserve received output and interruption state; do not automatically retry or synthesize a missing completion. The UX must leave the outcome visibly unresolved until it can be reconciled.

### Permissions and authority

- Durable Boundary Expansions are separate from Permission Profile, Full Access, sensitive-transfer permission, and temporary action approvals.
- Boundary Expansions persist and are audited across Runtime Activations until explicitly revoked.
- Other authority classes reset on activation.
- The UX must preserve these distinctions rather than collapsing them into one permission state.

### Sessions, context, and privacy

- There is one per-user, machine-local SQLite Global Session Store.
- Sensitive session fields are encrypted before persistence; the per-install encryption key is kept in the OS credential store.
- By default, store repository paths, hashes, metadata, and deliberately retained derived evidence rather than copying source artifacts.
- The complete local transcript is separate from the bounded Active Model Context sent to a provider.
- Effective Context Capacity is calculated from the verified model limit minus output reserve and safety margin. Categorized counts are retained, and provider-reported values are distinguished from estimates.
- Until provider-specific verified limits override them, response reserve is the greater of configured maximum output or 8% of raw context; safety margin is the greater of 2,048 tokens or 2% of raw context.
- Pinned content is preserved, compaction is inspectable, and a provider call stops when protected content cannot fit.

### Artifacts, evidence, and freshness

- Artifact policies are type-specific.
- Evidence contracts are normalized and include uncertainty fields; local-action validation is structured.
- Derived Specialist Service Evidence is cached by source-content hash. In Release 1, an unchanged artifact is processed once per Service Configuration.
- The UX must expose freshness or re-run control for cached derived evidence.
- Cache retention must be coordinated with the deferred sensitive-data policy.

### Platform and delivery constraints with UX impact

- The product is a headless TypeScript agent core beneath a React/Ink terminal presentation; non-interactive validation must not depend on TUI rendering.
- The global npm package exposes the lowercase `thcode` command. An organization-scoped package is used only if the unscoped name is unavailable; this does not change product or command spelling.
- Supported first-release environments are Windows 11 version 25H2+ using Windows Terminal and PowerShell via `pwsh.exe`, and macOS 14 Sonoma+ using standard Terminal with zsh. WSL and Windows PowerShell 5.1 are not supported.
- Node.js 22+ is the minimum runtime; Node.js 24 LTS is the clean-machine release baseline.
- Clean global install, update, uninstall, package-name ownership, lockfile reproducibility, and supported-platform artifact contents must be validated before release.

## Terminology to preserve

- **Active Context Utilization** — separate from Cumulative Token Usage.
- **Cumulative Token Usage**
- **Effective Context Capacity**
- **Active Model Context** — bounded context sent to a provider.
- **complete local transcript** — separate from Active Model Context.
- **Boundary Expansions** — durable, separately persisted/audited authority.
- **Permission Profile**
- **Full Access**
- **sensitive-transfer permission**
- **temporary action approvals**
- **Runtime Activations**
- **Global Session Store**
- **Specialist Service Evidence**
- **Service Configuration**
- **prompt-level rollback checkpoint**
- **before hashes** and **exact agent patches**
- **rollback store**
- **uncertain remote dispatch/effect**
- **deterministic classification** and **sanitized underlying evidence**
- **provider-reported values** vs. **estimates**
- **freshness** and **re-run**

## States and state transitions explicitly implied

- **Remote service result:** classified failure based on network evidence; retain sanitized evidence; optionally provide a separate model-generated explanation.
- **Remote dispatch:** completed/received output; or uncertain/interrupted with received output and interruption state preserved. Uncertain outcomes are not automatically retried and no completion is synthesized.
- **Rollback checkpoint:** retained and available; expired and garbage-collected; blocked pending explicit confirmation when a size cap would be exceeded; or stopped for manual resolution when later edits overlap.
- **Context fit:** protected content fits and the provider call may proceed; or protected content cannot fit, so compaction remains inspectable and the provider call stops.
- **Derived evidence:** cached/fresh for a source-content hash and Service Configuration; or requires a user-invoked re-run/freshness action.
- **Authority:** Boundary Expansion persists across Runtime Activations until revoked; Permission Profile, Full Access, sensitive-transfer permission, and temporary action approvals reset on activation.
- **Provider capability values:** provider-reported or estimated.

## Workflows and interaction requirements

1. **Release 1 local-agent proof:** User follows the C++ Hello World journey as the canonical local-agent demonstration.
2. **Provider/service discovery:** Generic TUI discovers reviewed integrations through metadata rather than provider-specific screens.
3. **Prompt action and rollback:** A built-in create/edit/delete mutation creates a checkpoint; a later reverse action proceeds only if the current state matches the recorded agent change. If it does not, stop and request manual resolution.
4. **Rollback capacity:** If an action would exceed an unprotected 100 MB checkpoint or 500 MB total rollback-store cap, obtain explicit confirmation before proceeding.
5. **Uncertain remote operation:** Preserve received output and interruption state; surface the unresolved outcome without retrying or inventing completion.
6. **Context governance:** Preserve pinned content, make compaction inspectable, and stop before provider invocation if protected content cannot fit.
7. **Specialist evidence reuse:** Reuse cached evidence for unchanged content within a Service Configuration; expose a freshness/re-run action.
8. **Activation permissions:** On Runtime Activation, retain durable Boundary Expansions and reset the other authority classes.
9. **Failure diagnosis:** Present deterministic failure classification and inspectable sanitized evidence separately from any generated explanation.

## Unresolved gaps for downstream UX/architecture

- Extension registry ownership, distribution, versioning, updates, revocation, naming collisions, and compatibility rules.
- Credential entry, secure storage, reference, rotation, and redaction flows.
- Metadata and declarative-mapping schemas, validation, and migration rules.
- Exact endpoint-verification semantics and health-check contracts for each extension type.
- Durable chat/event-recording guarantees and reconciliation of remote outcomes that remain unknown after recovery.
- Checkpoint behavior across renames, directories, permissions, symlinks, large files, Git changes, concurrent processes, and multiple agents; also protection, sizing, and garbage collection details.
- Exact UX and policy for the deferred sensitive-data/cache-retention relationship.
- Exact presentation and interaction for separate authority classes, including revocation and activation reset behavior.
- The append-only incident/event-record mechanism is not confirmed and must not be treated as committed.
