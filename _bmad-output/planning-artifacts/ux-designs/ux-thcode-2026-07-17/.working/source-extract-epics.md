# UX Source Extraction — `epics.md`

- **Source:** `/Users/temicide/Documents/thcode/_bmad-output/planning-artifacts/epics.md`
- **Product:** `thcode`, a local-first terminal UI (Ink over headless `CoreApp`) for Thai/mixed Thai-English developer conversations, governed local coding actions, and four direct AI-for-Thai specialist integrations.
- **Extraction date:** 2026-07-17
- **Scope:** User-visible capabilities, acceptance criteria, journeys, screens/surfaces, states, errors, interactions, accessibility implications, terminology, and surface-closure gaps. This is an extraction, not a proposal of new behavior.

## 1. Product UX contract in the source

The source states that no standalone UX contract existed; its actionable UX requirements are derived from the PRD, addendum, reviews, and Architecture Spine. The central UX promise is **trustworthy, inspectable, bounded terminal work**:

- Natural Thai and mixed Thai-English input is supported while exact technical tokens, paths, commands, IDs, model/service names, error codes, and uncertainty are preserved.
- Remote/provider output is never local authority. Every proposed effect is locally schema-validated, policy-evaluated, and shown with attributable Evidence.
- Hard boundaries remain denied regardless of approval, Permission Profile, Full Access, or model insistence.
- User-visible completion means observed verification, an accepted disclosed limitation, or an honestly stated blocker; uncertain work is never presented as success.
- Status, severity, authority, and outcome must remain understandable without color and in narrow terminals.
- Credentials, raw payloads, unsafe paths, and other sensitive material are excluded from UI, transcript, Sessions, Evidence, logs, previews, telemetry, and ordinary export.

## 2. UX-relevant capabilities by epic

### Epic 1 — Install and hold a trusted Thai conversation

User-visible capabilities:

- Install globally through npm on supported Windows and macOS environments; launch with `thcode`.
- Detect unsupported Node/platform/shell environments before provider calls or local effects and provide safe corrective guidance.
- Launch a usable terminal shell through the `CoreApp` boundary; render safely in narrow, resized, color-limited, redirected, and noninteractive streams; terminate cleanly with exit, Ctrl+C, or Ctrl+D.
- First-run Typhoon onboarding:
  - identify Typhoon and SCBx;
  - disclose the verified HTTPS origin/host and OS credential-facility storage before secret entry;
  - accept a masked/non-echoing key;
  - store only in Windows Credential Manager or macOS Keychain;
  - show `configured` without implying availability;
  - run a visible live effective-configuration check before normal conversation opens;
  - support cancellation, explicit replace/remove, typed storage/auth/configuration failures, and retry.
- Show Typhoon health as `configured`, `checking`, `available`, `unavailable`, `unhealthy`, or quarantined as applicable; reject stale health evidence and require visible retest after deterministic correction.
- Accept Thai/mixed prompts, preserve graphemes and technical identifiers, normalize outcome/constraints/artifacts/verification intent, and ask concise Thai clarification when material ambiguity remains.
- Stream a first response with durable chunks and one terminal result; expose interruption, cancellation, refusal, malformed response, and provider failure without retry or fabricated ending.

Key story coverage: 1.1–1.6; UX-DR1, 3, 5, 9, 10, 18, 20, 22.

### Epic 2 — Understand and control authority

User-visible capabilities:

- Fresh interactive activation visibly starts in `Build` mode and `Manual` Permission Profile; temporary approvals and transfer authority are absent.
- Switch directly between `Plan` and `Build` with Shift+Tab or the reviewed mode command. Plan is structurally read-only; Build means only that eligible mutation may be considered, not that it is authorized.
- Select `Manual`, `Assisted`, or `Full Access` independently. Full Access has a persistent prominent warning and does not grant hard-boundary or sensitive-transfer authority.
- Review approval prompts with progressive disclosure:
  1. plain-language purpose and material risk;
  2. exact authoritative details for the action.
- Details include exact executable/argv/cwd, mutation target and change, destructive deletion scope, or specialist destination and safe transfer summary. User can approve, deny, cancel, or dismiss with Esc; dismissal must not change unrelated settings.
- Inspect hard boundaries and separately scoped Boundary Expansions, including resource identity, Workspace/platform binding, action scope, expiry/revocation, and deterministic decision.
- See denied states for host threat, Workspace escape, unsupported enforcement, unknown action, quota, wrong credential, unauthorized origin, or other hard-boundary violations with truthful next steps.
- Use a discoverable command/completion surface for status, settings, permissions, mode, boundaries, connections, usage, context, compaction, rollback, clearing, checks, models, tools, sessions, and exit.
- `/models` is Typhoon inspection-only, not model selection. `/tools` provides registry browse/search/inspect/enable/disable/diagnose/retest once the registry is available; before delivery it must show an honest not-available state.
- Inspect compact activity and Evidence for every proposed/executed call, including auto-permitted list/read/search actions, with policy result, operation state, provenance, timing, and safe target/destination.
- View completion summaries that state changes, verification, contributing provider/service/tool, supporting Evidence, limitations, uncertainty, unknown outcome, or remaining risk.
- Distinguish deterministic facts from Typhoon/model explanation.

Key story coverage: 2.1–2.9; UX-DR3–9, 13, 18–20, 22.

### Epic 3 — Complete a safe, verified local coding task

User-visible capabilities:

- Declare and inspect a canonical Workspace; list/read/search only bounded in-Workspace text or safe metadata.
- Handle Windows/macOS paths, spaces, backslashes, case, Unicode, `.`/`..`, symlinks, junctions, mounts, renames, and traversal attempts with explicit allow/deny outcomes.
- In Build, review bounded text-file create/edit proposals with exact target, create-versus-edit, expected pre-image, bounded diff/change summary, resulting size, and post-image digest.
- Delete files/directories through a visibly destructive flow with explicit scope, recursion, descendant summary, estimated bytes, exclusions, and rollback coverage.
- Review and run controlled local commands with exact executable identity, argv, cwd, environment categories, expected output, timeout, resource limits, and cancellation behavior.
- Stream sanitized stdout/stderr with order metadata and explicit truncation markers; expose success/failure/cancelled/unknown outcome and prove no orphan process tree.
- Run non-mutating `/check` preflight for runtimes, compilers, package managers, project metadata, and documented commands. Distinguish present/verified, missing, unsupported, inaccessible, incompatible, probe-failed, and unknown; never silently install.
- Verify requested outcomes with bounded commands/inspection. The canonical proof requires C++ source creation, successful compilation, execution, and observed `Hello World` on supported Windows and macOS. Missing compiler is a prerequisite/platform blocker, not source failure.
- Report full, partial, blocked, conflict, excluded, cancelled, failed, or unknown outcomes honestly and link changes, commands, verification, and Evidence.

Key story coverage: 3.1–3.7; UX-DR5, 7–10, 16, 18–22.

### Epic 4 — Use Thai Specialist AI Services safely

User-visible capabilities:

- Trigger AI-for-Thai connection only when a task first needs a Specialist Service; pause in `unconfigured` before any service request, explain the requested capability, and offer just-in-time connection.
- Distinguish AI-for-Thai from Typhoon/SCBx; disclose verified host, OS storage, shared credential scope (exactly four launch services), and isolation before masked entry.
- Show checking progress, timestamp, safe generation fingerprint, result, and immediate retry; support explicit replace/remove. Shared-key rejection updates all four dependent services, not Typhoon.
- Browse/search/inspect a reviewed offline Capability Registry through `/tools`. Four working launch integrations are T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition. Known but unsupported entries display exactly `Catalogued — Not available yet` and cannot execute.
- Route natural Thai/mixed prompts to a reviewed invokable service without requiring registry browsing. Show selected service, routing reason, required artifact type, schema, health, and verified host before invocation; ask clarification for ambiguity, missing artifacts, or unavailable capability.
- Resolve concrete artifact references with discoverable syntax/completion; show canonical path, type, size, hash, Workspace relation, and intended service before transfer.
- Validate code, Markdown, text, image, audio, PDF, DOCX, and bounded manifests locally. Extract PDF/DOCX text locally by default; unsupported, oversized, active, or sensitive inputs produce sanctioned metadata or an actionable refusal.
- Obtain independent remote-transfer consent. First show plain-language purpose/risk, then exact service, verified HTTPS endpoint, method, safe payload summary, source count/types, transformations/redactions, call count, expiry, and side effects. Bind consent to exact manifest and payload-byte digests.
- Show attributable immutable Specialist Results with source hash, service/configuration identity, fields and empty fields, confidence/uncertainty, provenance, consent reference, timing, and failure. Keep Typhoon explanation separate.
- Show cache reuse as prior Evidence with original observation time and configuration provenance; provide force-fresh and explain when current health/retest blocks it. Never silently substitute cache for a requested fresh call.
- Distinguish entitlement, quota/rate limit, unsupported input, transient network/timeout, authentication, failed health, protocol incompatibility, TLS/origin failure, conflict, cancelled, and unknown outcome. Quarantine only proven scope; quarantined capabilities are unselectable until correction and explicit retest.

Key story coverage: 4.1–4.16; UX-DR2, 3, 5–10, 13, 17–22.

### Epic 5 — Resume experiments without stale authority

User-visible capabilities:

- Manage machine-local Saved Sessions through `/session` and `/sessions`: create, list/browse, open, rename, inspect/info, and delete.
- Show current/other/missing Workspace state; opening another or missing Workspace restores history but does not silently rebind to the current directory. Workspace-dependent actions are blocked or require a separately governed rebind.
- Show lifecycle states such as current, open, closed, missing-Workspace, deletion-pending, deleted, and recovery-locked; action availability follows state.
- Restore transcript, Typhoon identity/configuration metadata, mode, pins, compaction/context decisions, artifact manifest, plans, tool/verification history, usage, interruption markers, Workspace association, Evidence, and checkpoint lineage.
- Mark changed/missing source references stale/missing/conflicted instead of substituting current-directory content; restore references/hashes/metadata rather than copying sources by default.
- Explicitly show that a new Runtime Activation resets to Manual, clears Full Access, temporary approvals, one-shot authorizations, transfer consent, reservations, and in-flight authority. Only validated Work Mode and durable Boundary Expansions may restore.
- Recover known streamed output after interruption, append exactly one visible `Chat interrupted` marker, distinguish not sent/possibly dispatched/response started/interrupted/completed/reconciled, and offer explicit reprompt, inspect, or reconcile. No automatic retry.
- Handle locked/corrupt/incompatible store states read-only or unavailable; make migration/recovery status visible.
- Delete Sessions via immediate journaled tombstone, then cascade dependent records/artifacts without resurrecting history; retain only a non-sensitive deletion audit tombstone.

Key story coverage: 5.1–5.10; UX-DR3–6, 8, 12, 14, 15, 18–22.

### Epic 6 — Govern active context and usage

User-visible capabilities:

- Keep immutable full transcript separate from bounded Active Model Context.
- Inspect whether each item is verbatim, summarized, compacted, pinned, protected, excluded, or unavailable, with source identity, reason, provenance, token contribution, and digest where safe.
- Pin/unpin exact transcript/Evidence/schema items through explicit reviewed actions; automatic compaction or model/tool text cannot alter pins.
- Before dispatch, expose immutable ContextManifest and safe transmitted-byte digest, destination, byte/token counts, and manifest state.
- `/context` shows active projected tokens, Effective Capacity, response/safety reserves, percentage or `percentage unavailable`, labeled severity band, categorized included/summarized/excluded/pinned/protected material, and governance/manifest state.
- `/usage` separately shows cumulative input, output, cached-read/cache-write where available, calls, source labels, period/session scope, and any real budget. Cumulative usage has no invented percentage.
- Label values as provider-reported, locally measured, estimated, fallback, or unknown. Severity labels are text-based: `under 70%`, `70–84%`, `85–94%`, `95–100%`, with overflow separately identified.
- Automatically compact eligible older unpinned content toward no more than 70% before dispatch while preserving transcript and pins. Record what was retained, summarized, excluded, or compacted.
- Stop before dispatch on protected overflow; show categorized token accounting and explicit remedies (pin changes, output/reserve changes where allowed, new Session, inspection/archive, documented model/configuration choice) without implicit authority/content changes.
- Preserve prior context on compaction failure/cancellation/crash and recover context governance without inventing dispatch or usage.

Key story coverage: 6.1–6.7; UX-DR3, 5, 8, 10–12, 15, 18–22.

### Epic 7 — Reverse eligible local changes safely

User-visible capabilities:

- Before mutation, preview complete built-in file mutation set and checkpoint/rollback coverage.
- Label each round/change `fully protected`, `partially protected`, or `unprotected`; list exact protected and unprotected members and reasons.
- Explicitly list excluded shell/process, remote, permission, external, symlink-side, and untracked effects; never imply whole-round reversal.
- Show retention and capacity: default five subsequent prompts, configurable window, 100 MB per-checkpoint cap, 500 MB store cap, available/reserved/projected capacity, expiry and cleanup state.
- Warn and require explicit confirmation when a mutation proceeds with partial/unprotected coverage; identify exact changes losing protection and do not silently evict retained checkpoints.
- `/rollback` preview lists eligible recent rounds, age, remaining retention, coverage, protected changes, exclusions, cap status, unavailable/corrupt/locked/expired entries.
- Select exact round or changes; compare current content to recorded post-image; apply only conflict-free built-in file changes. Show per-target applied, skipped, conflict, blocked, excluded, failed, expired, corrupt, locked, and never-protected outcomes.
- Aggregate results are `full`, `partial`, `blocked`, or `unprotected`; summaries state what remains changed and never claim external effects were reversed.
- Recover rollback/checkpoint state after crashes without stale replay; prevent Session deletion or cleanup from reviving checkpoint lineage or shared artifacts.

Key story coverage: 7.1–7.6; UX-DR5, 7–9, 16, 18–22.

## 3. Primary user journeys and required visible checkpoints

### A. Clean install to first conversation

1. Install/preflight checks Node, OS, shell, and package lifecycle.
2. Launch shell without effects or network-required rendering.
3. Show Typhoon/SCBx, verified origin, and credential storage disclosure.
4. Masked key entry; Esc/cancel leaves no partial configuration.
5. Store securely; show `configured`, not `available`.
6. Run visible live check for the exact effective generation.
7. On success, show timestamp/Evidence and enter normal TUI. On failure, show typed category, safe reason, retryability, and explicit retest.
8. Enter Thai/mixed prompt; preserve graphemes and exact identifiers.
9. Normalize intent; clarify before dispatch if ambiguous.
10. Stream response and seal one terminal outcome, or show interruption/failure honestly.

### B. Governed local coding task

1. Start in Build + Manual; Workspace is declared and shown.
2. Prompt produces local normalized intent and Agent Loop.
3. Safe list/read/search may appear in activity even when auto-permitted.
4. Proposed mutation/command/deletion goes through purpose/risk then exact-detail approval.
5. Policy, boundaries, quota, consent, credential, and platform checks may allow/ask/deny.
6. Before mutation, show diff/scope and rollback coverage; before command, show exact executable/argv/cwd.
7. Stream effects with cancellation/timeout and no orphan.
8. Run preflight/verification; classify missing prerequisites separately from source failure.
9. Completion summary identifies changes, verification, contributing model/tool, Evidence, exclusions, and remaining risk.

### C. Specialist-service task

1. Prompt identifies a capability and artifact.
2. If AI-for-Thai is unconfigured, pause with capability-specific explanation and JIT connection.
3. Disclose separate credential/host/storage; masked entry and visible check.
4. Route through Registry; show service/reason/schema/health/host.
5. Resolve and validate artifact locally; show canonical reference metadata.
6. Prepare exact sanitized payload; show purpose/risk then destination/payload details.
7. Obtain independent transfer consent; reject changed digest/scope at dispatch.
8. Show service result separately from Typhoon explanation, including empty/uncertain fields.
9. If cache hit, identify prior Evidence and offer force-fresh. If failure, show typed scope and retest path.

### D. Session resume after interruption

1. Browse Sessions and Workspace state (current/other/missing).
2. Open only after journal commit; never silently rebind Workspace.
3. Restore history/Evidence and identify stale/missing source references.
4. Show fresh Manual activation and reset temporary authority.
5. Restore streamed chunks and exact `Chat interrupted` marker if applicable.
6. Offer inspect, reprompt, or reconcile as explicit choices; do not retry automatically.

### E. Context/usage management

1. Inspect `/context` and `/usage` separately.
2. Pin important transcript/Evidence items and inspect inclusion decisions.
3. Before capacity overflow, show compaction/projection decisions and preserved transcript.
4. If protected material cannot fit, stop before dispatch and show categorized breakdown/remedies.
5. If dispatch proceeds, show manifest/digest identity and labeled capacity/usage.

### F. Rollback

1. Preview recent retained rounds and coverage/capacity/expiry.
2. Inspect exact eligible built-in changes and excluded effects.
3. Select round/change scope and confirm.
4. Compare post-images; apply only unchanged conflict-free targets.
5. Show per-target outcomes and aggregate full/partial/blocked/unprotected result.

## 4. Screens and surfaces implied by the source

The source implies the following surfaces, though some are only command/projection contracts rather than specified layouts:

- Install/preflight output and unsupported-environment guidance.
- Launch/startup shell, including redirected/noninteractive output and termination states.
- First-run Typhoon disclosure, masked credential form, storage result, live-check progress/result, retest, replace/remove.
- Main TUI with persistent/immediately inspectable status: Typhoon, Work Mode, Permission Profile, Full Access warning, AI-for-Thai, relevant service health, context utilization, interruption, rollback conflict, boundary state.
- Prompt composer and normalized-intent/clarification view.
- Streaming response/transcript view, interruption marker, reconciliation/reprompt choice.
- Progressive approval modal for generic effects, file mutations, destructive deletion, commands, and remote transfers.
- Boundary/Permission/Profile controls and Boundary Expansion review/revocation.
- Compact activity log with expandable safe details and Evidence references.
- Completion summary.
- `/status`, `/settings`, `/permissions`, mode/boundary/connection/usage/context/compaction/rollback/clear/check commands.
- `/models` inspection surface.
- `/tools` catalog browser/search/inspection/enable/disable/diagnose/retest; honest unavailable/not-available-yet state before registry delivery.
- Artifact-reference parsing/completion preview.
- `/check` preflight result surface.
- `/session` and `/sessions` browser plus create/open/rename/info/delete flows.
- `/context` governance, pin/unpin, compaction, capacity, manifest, digest, overflow/remedy views.
- `/usage` cumulative ledger view.
- Rollback preview, coverage exception, selection, confirmation, and outcome views.
- Recovery/locked-store/migration/incomplete-stage states.
- Security-reporting channel release artifact display (release surface, not runtime authority).

## 5. States and errors extracted from acceptance criteria

### Service/provider/health states

`unconfigured`, `configured`, `checking`, `available`, `unavailable`, `unhealthy`, `quarantined`, `disabled`, `not-configured`, `not-available-yet`, `Catalogued — Not available yet`, `not-measured`.

Typed causes include authentication rejection, credential storage failure, connectivity/DNS, timeout, quota/rate limit, provider/server failure, TLS/origin/redirect failure, protocol/configuration incompatibility, entitlement, unsupported input, transient network, failed health, conflict, cancelled, and unknown outcome. Retest must be visible, timestamped, generation-specific, and explicit after deterministic correction.

### Operation/effect states

`proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled`; also denied, expired, stale, mismatch, blocked, refused, malformed, unavailable, and not sent/possibly dispatched/response started/interrupted/completed/reconciled for remote work.

### Local coding states

Allowed/auto-permitted, approval required, denied by Plan, denied by hard boundary, unsupported platform, Workspace conflict/escape, pre-image mismatch, inaccessible/unreadable/oversized/binary/invalid encoding, timeout, cancelled, failed, unknown, partial, and verified success.

### Context/usage states

Verbatim, summarized, compacted, pinned, protected, excluded, unavailable; provider-reported, locally measured, estimated, fallback, unknown; under 70%, 70–84%, 85–94%, 95–100%, overflow, protected overflow, percentage unavailable; compaction success, blocked, failed, cancelled, invalid summary, and recovered prior projection.

### Session/recovery states

Current, open, closed, other Workspace, missing Workspace, deletion-pending, deleted, recovery-locked, stale/missing/conflicted source, incomplete stage, read-only incompatible store, migration pending/failed, not-sent, unknown dispatch, interrupted, and reconciled.

### Rollback states

Fully protected, partially protected, unprotected, over-cap, unavailable, corrupt, locked, expired; per-target applied, skipped, conflict, blocked, excluded, failed, never-protected; aggregate `full`, `partial`, `blocked`, `unprotected`.

## 6. Interactions and keyboard behavior

Explicitly specified:

- `Shift+Tab`: switch Plan/Build.
- `Tab`: accept completion.
- `Esc`: dismiss modal without committing a setting; cancel forms/approvals where specified.
- `Ctrl+C` / `Ctrl+D`: terminate according to launch/terminal contract, restoring terminal state and avoiding orphan processes.
- Explicit approval decisions: approve, deny, cancel; approval is bound to exact OperationId/action digest.
- Explicit retest, force-fresh, replace/remove credential, pin/unpin, Boundary Expansion grant/revoke, Session open/rebind/delete, rollback selection/confirmation, reprompt/reconcile.
- Completion must be discoverable and argument validation must define empty/loading/success/error/cancellation/narrow-layout states.
- Long activity/output requires safe summarization with an explicit inspection affordance, not silent truncation.
- Resize, paste, IME, multiline input, grapheme-boundary submission, Thai text, and redirected output are explicitly in scope.

## 7. Accessibility and inclusive-use implications

The source requires:

- No reliance on color alone; use explicit text, labels, or shapes for Plan, Build, Full Access, destructive, unhealthy/quarantined, interrupted, unknown, rollback conflict, severity, and other status.
- Usable narrow-terminal layouts, color-limited terminals, resized views, redirected/noninteractive streams, and text-only forms.
- Stable logical text order for screen-reader/text-oriented accessibility fixtures: heading, purpose, risk, exact target, action state, outcome, next step.
- Keyboard navigation, modal dismissal, completion, Ctrl+C/Ctrl+D, streaming, and resize behavior must preserve authority, Evidence, and recovery information.
- Thai UTF-8 and mixed-language support across IME composition, grapheme clusters/combining marks, cursor movement, paste, wrapping, resizing, persistence, streaming, and service calls.
- Exact technical identifiers, versions, commands, paths, hashes/IDs, reason codes, and service/model names remain copyable and unchanged.
- Loading, success, error, cancelled, blocker, unknown, and unavailable states need stable noninteractive text forms.
- Long commands/output must not be silently presented as complete when truncated.
- Secrets must remain hidden despite paste, resize, IME, diagnostics, snapshots, or errors.

The source does not define a formal WCAG target, terminal screen-reader support matrix, or specific assistive technology behavior beyond these fixture-level requirements.

## 8. Terminology and user-facing labels

### Core concepts

- **CoreApp:** sole UI-facing application facade through versioned dispatch/subscribe/query.
- **TUI / Ink shell:** terminal interface; effect adapters must remain outside UI.
- **Prompt Round:** one end-to-end correlated user request and its context, policy, provider, effects, verification, and terminal outcome.
- **Runtime Activation:** per-process/session/workspace authority context; every fresh activation resets to Manual.
- **Work Mode:** `Plan` or `Build`; Plan is structurally read-only, Build permits eligible mutation evaluation.
- **Permission Profile:** `Manual`, `Assisted`, `Full Access`; separate from Work Mode.
- **Hard boundary:** non-overridable Workspace, command, network, service, quota, credential, transfer, or platform constraint.
- **Boundary Expansion:** separately scoped, durable/revocable resource authority; distinct from approval and transfer consent.
- **Workspace:** declared, canonical, platform-bound root for local inspection/effects.
- **Evidence:** sanitized, attributable, immutable/versioned record of inputs, proposals, decisions, outputs, results, and failures.
- **Activity log:** compact inspectable projection of proposed/executed calls and outcomes.
- **Effective Configuration Generation:** immutable provider/service identity, endpoint, credential revision, protocol/contract, model/service, and adapter configuration used for a health/result observation.
- **Capability Registry:** reviewed authority for specialist discoverability/routing/invocation.
- **AI-for-Thai / Specialist Service:** separate service provider/group; four Release 1 integrations are T-OCR, Speech-to-Text, Extract Address, NER.
- **Remote-transfer consent:** authority to send an exact prepared payload; independent from local read permission and Full Access.
- **PreparedPayloadManifest:** canonical, digestable outbound content identity and safe summary.
- **Specialist Result:** immutable attributable service output/failure artifact.
- **Active Model Context:** bounded derived projection sent/eligible for Typhoon; distinct from immutable transcript.
- **ContextManifest:** immutable dispatch context decisions and identity.
- **Effective Capacity:** verified provider capacity minus documented response/safety reserves, or labeled fallback.
- **Checkpoint/RollbackCandidate:** attributable protection record for eligible built-in file create/edit/delete only.
- **Saved Session:** encrypted machine-local aggregate containing history/Evidence and references, not credentials or source copies by default.

### Exact labels/phrases with UX significance

`configured` is not `available`; `Catalogued — Not available yet`; `Chat interrupted`; `not-configured`; `not-available-yet`; `not-measured`; `percentage unavailable`; `current`, `other`, `missing` Workspace; `fully protected`, `partially protected`, `unprotected`; `full`, `partial`, `blocked`, `unprotected` rollback outcomes; `under 70%`, `70–84%`, `85–94%`, `95–100%`; `unknown-outcome`.

## 9. Surface-closure gaps and unresolved UX details

These are gaps in the source’s ability to close a user-facing surface. They are not proposed solutions.

### Explicitly unresolved/deferred in the source

- **NFR-14 budgets:** numeric targets for startup, TUI responsiveness, health checks, Prompt Rounds, compaction, restoration, Specialist Services, and resource ceilings require a Product Owner decision gate. Until approved, measurements are observations only and release claims remain blocked.
- **Release security-reporting channel:** the source requires an approved verified route/artifact but does not provide the route itself.
- **Endpoint/contract specifics:** the source requires launch origin allowlists and pinned Typhoon/AI-for-Thai endpoint contracts, but this document does not supply the concrete values.
- **Capability Registry contents beyond the four launch services:** known entries are described as catalogued/unavailable, but the complete catalog and support reasons are not enumerated.
- **Policy matrix values:** a versioned action × mode × profile × sensitivity matrix is required, but the concrete allow/ask/deny table is not included.
- **Remote Data Authority and sensitive-data policy:** the source requires completion of a normative policy, but not all classifications, thresholds, or overrides are spelled out.
- **Windows/macOS platform/action enforcement matrix:** required before release, but the supported combinations and exact user-facing remediation text are not listed here.

### Surface definitions that remain underspecified

- **Command grammar:** canonical syntax, aliases, argument grammar, completion ranking, quoting, error copy, and navigation for the many commands are required, but only command names and some behavior are defined. `/rollback`, `/context`, `/usage`, `/tools`, `/session`, `/check`, connection, boundary, and setting subcommand syntax is not fully closed.
- **Artifact-reference syntax:** a concrete grammar/completion flow is required, including quoting/globs, but the actual syntax, delimiters, completion interaction, and ambiguity presentation are absent.
- **Main TUI layout:** persistent versus immediate-inspection placement, panel/region hierarchy, scroll behavior, focus model, and what remains visible during streaming are not specified.
- **Status projection details:** fields are enumerated, but ordering, compact/narrow representation, update timing, and how simultaneous warnings compose are not defined.
- **Approval modal mechanics:** progressive disclosure is required, but expansion/collapse interaction, focus order, default action, repeated approvals, and exact behavior while underlying state changes are not specified.
- **Full Access warning treatment:** persistence and prominence are required, but exact wording, placement, and interaction with other status warnings are open.
- **Boundary Expansion UI:** data to show is specified, but the discovery path, review controls, expiry editing, revocation confirmation, and inactive/invalid presentation are not closed.
- **Activity/Evidence inspection:** compact entries and an inspection affordance are required, but the expansion mechanism, pagination/scrolling, filtering, correlation navigation, and copy behavior are not defined.
- **Streaming and interruption UI:** durable boundary and marker are specified, but rendering of partial chunks, progress, cancellation affordance, connection loss, and reconciliation choices are not fully described.
- **Workspace selection/rebind:** identity and no-silent-rebind rules are clear, but the selection UI, path picker/input grammar, validation loop, and separately governed rebind flow are not defined.
- **Session browser:** lifecycle and Workspace labels are defined, but list sorting, selection/navigation, duplicate-name handling UI, delete confirmation, stale-open behavior, and restoration progress are not closed.
- **Context inspection:** categories and accounting are defined, but the item hierarchy, verbatim-versus-summary comparison, pin controls, digest display, and compaction progress/notification are not specified.
- **Protected-overflow remedies:** possible remedy categories are listed, but the exact controls, confirmation needs, preview of consequence, and ordering are open.
- **Specialist catalog:** browse/search/inspect/enable/disable/diagnose/retest are required, but catalog information architecture, service detail layout, unavailable-entry explanation, and enable/disable confirmation are not specified.
- **Specialist result display:** attribution fields and cache/freshness labels are required, but result layouts for OCR, transcript, address fields, and NER—including empty fields and uncertainty—are not defined.
- **Transfer consent payload summary:** “safe payload summary,” classification, transformations, and source counts are required, but the exact summary vocabulary and redaction presentation are not closed.
- **Preflight and verification:** typed results and remediation are specified, but command-result grouping, evidence drill-down, rerun affordance, and verification-plan presentation are not defined.
- **Destructive deletion:** exact scope and confirmation are required, but the destructive visual treatment, typed confirmation interaction, and partial/unknown recovery presentation are not closed.
- **Rollback:** command discovery, preview, selection, and outcomes are required, but retention countdown presentation, per-target diff/restore preview, conflict inspection, and post-rollback navigation are not defined.
- **Recovery/locked states:** read-only, locked, corrupt, migration, incomplete-stage, and unknown-outcome states are required, but a unified recovery entry point and prioritization of available actions are not specified.
- **Noninteractive/redirected streams:** stable text forms are required, but behavior when approval, secret entry, transfer consent, or other interactive authority is needed is not defined.
- **Screen-reader support:** logical order is required, but supported terminals/assistive technologies, announcements for live updates, focus semantics, and alternate descriptions for shapes/icons are not specified.
- **Thai copy:** natural Thai is required while exact technical identifiers remain intact, but no language policy, translation glossary, fallback language, or copy ownership is defined.
- **Error-copy contract:** typed categories and actionable next steps are required, but the message catalog, cause-code mapping, retry guidance, and localization rules are not provided.
- **Performance feedback:** measurements and some visible progress are required, but numeric thresholds and exact progress behavior remain open due to NFR-14.
- **Credential management outside onboarding:** explicit replace/remove is required, but where these controls live in the command/UI surface and how current dependent health is summarized are not specified.

### Potential cross-surface closure risks visible in the source

- Numerous status dimensions may be simultaneously active (mode, profile, Full Access, boundary, provider/service health, context severity, interruption, rollback conflict); the source names all of them but does not define priority or compositional rules.
- Exact technical details must remain copyable while sensitive values must be hidden; the source does not define a complete safe-display/redaction taxonomy for paths, URLs, command output, payload summaries, hashes, and environment values.
- Approval, transfer consent, retest, force-fresh, rollback, deletion, and Session open can all be interrupted or race with authority changes; deterministic backend behavior is specified, but user-facing stale-modal/refresh behavior is not.
- The same typed state appears in startup, main TUI, commands, activity, completion, recovery, and redirected output; a cross-surface message/state vocabulary is implied but not explicitly provided.
- The document requires exact user-visible Thai-capable copy and stable noninteractive output but does not establish a canonical copy deck or text snapshot contract.

## 10. Source-grounded UX design inputs

The highest-priority inputs for subsequent UX design are:

1. Make the authority model continuously legible: Work Mode, Permission Profile, Full Access warning, hard boundaries, transfer consent, and current Workspace must not be conflated.
2. Make every potentially consequential action follow purpose/risk → exact details → bounded decision → attributable outcome.
3. Treat `configured`/`checking`/`available` and `cached Evidence`/`fresh call` as distinct user concepts.
4. Design for narrow, color-limited, redirected, Thai-capable terminal use from the first interaction, not as a later adaptation.
5. Make all interruption, unknown-outcome, conflict, partial, blocked, unavailable, and unprotected outcomes visibly honest and actionable without implying a stronger guarantee than Evidence supports.
6. Preserve user inspection: immutable transcript, Active Context decisions, payload/manifest identity, activity/Evidence, rollback coverage, and Session/Workspace associations must remain discoverable.
7. Do not close the listed gaps by inventing endpoint values, budgets, policy decisions, command syntax, or unsupported capabilities; those require source/product decisions or explicit design artifacts.
