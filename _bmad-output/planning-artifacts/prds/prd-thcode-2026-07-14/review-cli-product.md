# thcode PRD Review — CLI and Developer Product

**Reviewer:** Senior developer-product / CLI-TUI reviewer  
**Artifact:** `prd.md` and `addendum.md`  
**Date:** 2026-07-15  
**Verdict:** **Not implementation-ready without resolving three phase blockers.** The PRD has an unusually clear product boundary, strong trust language, coherent journeys, and stable FR IDs. It is usable for high-level architecture and UX exploration, but not yet safe for detailed UX specification, implementation stories, or release acceptance: the actual command/sandbox contract, sensitive-transfer policy, and Typhoon tool-loop feasibility are still deferred even though they determine the core experience.

## Severity summary

| Severity | Count |
|---|---:|
| Critical | 3 |
| High | 10 |
| Medium | 8 |
| Low | 3 |
| **Total** | **24** |

## What is already strong

- The positioning is honest and internally consistent: production quality belongs to the harness, not to Typhoon's coding ability.
- UJ-1 through UJ-7 cover first use, exploration, failure, the headline agent proof, continuity, interruption, and reversal. The journeys map cleanly into grouped FRs.
- Credential isolation, evidence provenance, no silent fallback, service-scoped quarantine, explicit retest, and uncertainty-preserving recovery are strong trust foundations.
- The PRD separates Work Mode from Permission Profile and distinguishes durable Boundary Expansions from temporary runtime authority.
- The four supported AI-for-Thai services and unavailable catalog entries have a clear launch boundary.
- The document is close to being usable for downstream work because IDs are stable and most consequences are observable. The problems below are concentrated in a few unresolved state machines and release contracts.

## Critical findings

### CLI-C1 — The local command and boundary contract is a core requirement but remains undefined

**Location:** UJ-4; FR-7 through FR-10; FR-22 through FR-24; NFR-3 and NFR-5; Deferred Decision 4; addendum “Architecture questions to resolve downstream.”

The headline proof depends on reading files, mutating files, running a compiler, cancelling processes, and refusing host-threatening operations on both Windows and macOS. Yet the platform/action enforcement matrix is deferred until implementation sign-off, and the PRD never defines the minimum enforceable outcome for each action class. “Validated command,” “host-operating-system threat,” “hard boundary,” “orphan-process prevention,” and “Boundary Expansion” cannot currently be converted into acceptance tests. Approval is also not explicitly bound to an immutable executable, argument vector, working directory, environment delta, and target set; a preview could therefore differ from the executed payload while still technically satisfying the prose.

This blocks architecture and story creation, not merely final release testing. Windows and macOS do not offer identical filesystem, process-tree, shell, symlink, and network controls. A product requirement that says “fail closed” is incomplete until the user-visible behavior when enforcement is unavailable is specified.

**Concrete fix:** Move a product-level enforcement matrix ahead of implementation sign-off. For each built-in action (`list`, `read`, `search`, `create/edit`, `delete`, `run`, remote transfer), define: default scope, approval requirement under Manual/Assisted/Full Access, expansion eligibility, non-overridable refusal conditions, evidence shown, and fail-closed user outcome on Windows and macOS. Require command approvals to authorize the exact executable, argument vector or exact shell program, working directory, environment additions/removals, timeout, and declared side-effect boundary; any change must invalidate approval. Explicitly decide whether commands execute directly or through `pwsh`/`zsh`, including quoting and interactive-process behavior.

### CLI-C2 — Sensitive-data and consent decisions are deferred even though they shape launch UX and all four service stories

**Location:** UJ-1 through UJ-3; FR-15 through FR-18; FR-22; NFR-1, NFR-2, and NFR-4; Deferred Decision 3.

T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition necessarily process content that may contain personal or sensitive information. FR-16 requires “authority appropriate to risk,” while FR-22 says sensitive transfer always requires distinct authority, but the PRD defers classification, consent language, local retention/deletion, and upstream disclosure until immediately before services are enabled. Those choices determine the prompt flow, preview content, cache rules, transcript behavior, session persistence, and deletion UX. They therefore cannot be postponed past detailed UX or story creation.

The current text is also ambiguous about consent frequency: every call, first call per service, first call per artifact, one Runtime Activation, or a durable preference. It does not state whether derived OCR/STT/address/NER Evidence is considered sensitive, whether it is cached by default, or how users delete it.

**Concrete fix:** Define a minimum Release 1 transfer policy before UX specification. At minimum, specify the data classes for each service, when per-call confirmation is mandatory, what authority can and cannot be remembered, what appears in the concise and expanded preview, what is persisted or cached by default, retention and deletion controls, and where current upstream terms are linked. Add acceptance tests proving a rejected consent causes zero dispatch and that clearing a session/cache removes retained derived Evidence without touching credentials.

### CLI-C3 — The single reasoning model's tool-loop feasibility is still a late release pin

**Location:** First Public Release Scope “Reasoning model”; FR-2, FR-5, FR-6, FR-12, FR-14; SM-1; Deferred Decision 5.

Typhoon is the only reasoning model and the whole product objective depends on it reliably emitting a valid local-tool or Specialist Service proposal. The exact model, endpoint contract, context limit, streaming behavior, structured-output/tool-call mechanism, and adapter version are postponed until integration freeze. The fallback language permits “schema repair or retry,” but no attempt limit or failure UX is defined. If the selected Typhoon variant cannot perform the C++ tool loop or prompt-first routing consistently, the headline release objective fails after architecture and UX work has already been committed.

**Concrete fix:** Turn the release pin into an early feasibility gate. Before detailed architecture/story breakdown, pin a candidate model and adapter and demonstrate: Thai/mixed-language prompts, valid structured local tool calls, valid Specialist Service calls, streamed text mixed with tool proposals, invalid-schema handling, context-limit discovery, cancellation, and the C++ proof over a defined repeat count. Record native tool-call support versus prompt-constrained JSON, retry/repair maximums, deterministic terminal failure, model/context identifiers, and observed success rate. Integration freeze may change the pin only by rerunning the gate.

## High findings

### CLI-H1 — The launch scope is not self-contained

**Location:** First Public Release Scope, “Scope interpretation rule”; Assumption A-1.

The rule that Release 1 includes every current, accepted, non-superseded capability in project decision and proposal documents makes scope depend on an external, mutable corpus. A UX designer, architect, developer, or tester cannot know the full release contract from the PRD and addendum. It also defeats change control: a newly edited source note could silently become a requirement without a new FR or acceptance criterion.

**Concrete fix:** Remove the scope interpretation rule after reconciliation. State that the finalized PRD plus explicitly referenced addendum decisions are authoritative. Any omitted source idea is out of scope until promoted through a PRD change that adds or changes a stable FR and memlog decision.

### CLI-H2 — npm identity, exact install commands, and supported-runtime detection are unresolved

**Location:** Platform and distribution; FR-1; Constraints; addendum “Delivery baseline” and “Release engineering direction.”

The canonical product/command is `thcode`, but the npm package may be unscoped or organization-scoped depending on availability. Those have different install commands, documentation, update commands, and trust signals. Package-name ownership is itself deferred to release validation. The PRD also names Windows Terminal/PowerShell and Terminal/zsh but does not specify how thcode detects and responds to Node below 22, unsupported PowerShell, WSL, Git Bash, another terminal emulator, a non-interactive terminal, or a redirected stdin/stdout stream. PowerShell 7.4+/7.6 LTS appears only in the addendum, not the normative platform requirement.

**Concrete fix:** Resolve and reserve the npm package name before onboarding UX. Put the exact install, update, uninstall, version-check, and launch commands in FR-1. Define supported shell/runtime versions normatively and a startup compatibility check with actionable diagnostics. Distinguish terminal emulator from shell; state whether other emulators running the supported shell are unsupported, best-effort, or blocked. Add package metadata assertions for `bin`, `engines`, included files, license, provenance, and unsupported-OS messaging.

### CLI-H3 — The slash-command surface is a topic list, not an interaction contract

**Location:** UJ-1; FR-11; FR-14; FR-26; FR-30; FR-36 and FR-37.

FR-36 promises controls for models, tools, status, settings, permissions, Work Mode, context, sessions, dependency checks, connections, compaction, clearing, and exit, but only `/models`, `/tools`, `/session`, `/sessions`, `/context`, and `/check` are partly named. There are no canonical commands or subcommands for connection rotation/removal, service retest, mode/profile changes, persistent boundary inspection/revocation, pinning, compaction, cache clearing, rollback, usage, or recovery. Command completion cannot be designed or tested without this information. Keyboard shortcuts also have no command-equivalent requirement, which hurts discoverability and accessibility.

**Concrete fix:** Add a Release 1 command table with command, aliases, arguments, available states, destructive confirmation, output, errors, and command-equivalent shortcuts. A coherent minimum would cover `/help`, `/status`, `/models`, `/connections`, `/tools`, `/mode`, `/permissions`, `/boundaries`, `/session`, `/context`, `/usage`, `/check`, `/rollback`, `/clear`, and `/exit`; exact names are a product choice, but all promised capabilities need one canonical route. Require every shortcut to be discoverable and to have a command alternative.

### CLI-H4 — “Upload/references an image” has no terminal interaction definition

**Location:** UJ-1 steps 6–9; UJ-2; FR-5; FR-14 through FR-16.

The first specialist-service moment depends on Nok referencing a document image, but the PRD never says how a terminal user attaches or references an artifact. FR-15 says “explicit in-Workspace references,” which does not define whether users use `@path`, paste/drag a path, quote it, browse it, or write natural language. The ambiguity is worse on Windows paths with drive letters, spaces, backslashes, and Unicode Thai filenames. It also is not clear whether an artifact outside the current Workspace may be selected through an explicit one-time transfer flow or requires a durable Boundary Expansion.

**Concrete fix:** Add an artifact-reference UX requirement: at least one explicit syntax and an interactive picker/completion route; resolution relative to the Workspace; display of normalized path, type, size, hash, and selected service before transfer; unambiguous handling of spaces, quotes, Thai filenames, symlinks, and pasted absolute Windows/macOS paths; and a clear refusal/expansion flow for out-of-Workspace artifacts. Add end-to-end fixtures for image, audio, PDF, DOCX, and unsupported binary references.

### CLI-H5 — Permission Profiles and durable Boundary Expansions lack a complete user-visible state machine

**Location:** UJ-4 approval behavior; UJ-5; FR-21 through FR-24; FR-28; glossary.

Manual is reasonably described, but Assisted is only “deterministic rules,” and Full Access suppresses “eligible prompts” without defining eligibility. Deletion under Full Access is not explicitly prompt-required or prompt-free. Sensitive transfer authority is distinct but its lifetime is not defined. Durable Boundary Expansions survive restarts, yet no required UI or slash command lets users see their origin, scope, expiry (if any), last use, or revoke them. “Boundary” also groups filesystem, commands, network, services, and quotas even though these need different scopes and previews.

**Concrete fix:** Add an action-by-profile matrix and a separate authority-lifetime matrix. Define Assisted's exact deterministic rules or remove Assisted from Release 1. Specify whether deletion, directory deletion, executable launch, network destinations, and sensitive transfer can ever be auto-approved. Require a persistent boundary manager showing scope, creation time, creator action, last use, and revoke control; every expansion must show its durable lifetime at creation. Add restore tests proving only durable expansions persist.

### CLI-H6 — The four service integrations do not yet have testable product contracts

**Location:** UJ-1 through UJ-3; FR-13 through FR-20; SM-2 and SM-3; Assumptions A-3/A-4.

The PRD names four services but does not define the minimum accepted formats, size/duration limits, language expectations, required output fields, confidence behavior, quota display, endpoint evidence, or canonical Thai fixtures. “Prompt requires a supported Specialist Service” is also ambiguous when multiple services could apply, the prompt is vague, or the user explicitly names a different service. The model proposes a tool call, but there is no user override, routing-confidence, or clarification rule specific to service selection.

**Concrete fix:** Add a per-service release-contract appendix or linked artifact containing accepted modalities/formats/limits, required/optional result fields, empty and partial result behavior, entitlement check, contract fixture, live smoke fixture, and prompt examples in Thai and mixed language. Require explicit service naming by the user to win when valid; require clarification when routing is materially ambiguous; never send merely because an artifact is mentioned. Define how a user can inspect and override a proposed service before dispatch.

### CLI-H7 — Thai UX quality is asserted but not acceptance-testable

**Location:** Vision; FR-5; FR-37; NFR-9 and NFR-10.

Valid UTF-8 does not ensure a usable Thai TUI. The PRD does not define the interface language strategy, default/fallback language, language-switch control, Thai translations for consent/errors, or behavior for Thai IME composition, grapheme-aware cursoring, combining marks, line wrapping, selection, copy/paste, search, and mixed Thai-English/code layout. “Supports natural Thai” has no representative tasks or review bar.

**Concrete fix:** Define whether the product UI is Thai-first, bilingual, or locale-selectable, and which strings must be localized at launch. Add a Thai TUI acceptance pack covering IME composition, editing/cursor movement, wrapping and truncation, wide/narrow terminals, streaming, persistence/restore, search/completion, clipboard paste, and mixed Thai/English/code/paths. Include native-speaker review for onboarding, consent, error, dependency, quarantine, and recovery copy.

### CLI-H8 — Saved Session creation, autosave, workspace recovery, and concurrency are underspecified

**Location:** UJ-5; Saved Sessions scope; FR-26 through FR-29; addendum “Session and context mechanisms.”

The PRD lists lifecycle verbs but does not say when a session begins, whether every chat is autosaved, when it becomes visible in `/session`, what happens on normal exit versus crash, how users handle a missing/moved workspace, or whether rebind is ever allowed. “Complete transcript” and global storage also create retention and storage-growth questions. Multiple thcode processes could open the same session or Workspace, but conflict/read-only behavior is not defined.

**Concrete fix:** Add a session state model: transient/new, autosaving, saved, interrupted, read-only/locked, missing-workspace, and deleted. Define default autosave, naming, normal-exit behavior, crash behavior, restore/rebind/copy choices, concurrent-open behavior, and deletion scope (transcript, Evidence, cache, rollback data). Add acceptance criteria for process crash during every write phase, moved/missing workspace, lost key, schema migration, and two-process access.

### CLI-H9 — Crash recovery covers remote uncertainty but not interrupted local actions

**Location:** UJ-6; FR-10; FR-32; NFR-5 and NFR-6; addendum recovery direction.

FR-32 handles a dispatched remote request, but thcode can also crash during a file patch, directory deletion, compiler command, checkpoint write, compaction, or session migration. Those states matter to the core agent loop and rollback promise. “Crash-consistent” records do not say what the user sees or what is safe to resume. Command child processes are especially important: after the parent crashes, thcode may not be able to prove whether a child still runs or what it changed.

**Concrete fix:** Add a general interrupted-action requirement. Persist proposed/approved/started/completed/failed/unknown states around every significant action. On restore, surface unknown local effects, reconcile built-in file changes against checkpoint hashes, never auto-repeat an unknown command, and provide platform-specific orphan/process guidance. Add fault-injection acceptance points before and after approval, dispatch, first output, mutation commit, verification, and evidence commit.

### CLI-H10 — Release acceptance does not define a reproducible matrix or model/service variability policy

**Location:** FR-1, FR-11, FR-12; NFR-11 and NFR-14; SM-1 through SM-4; addendum “Product schemas and evaluation mechanics” and “Release engineering direction.”

NFR-11 requires minimum and newest Windows/macOS versions, but SM-1 says “both release environments,” which can be read as only two machines. The C++ proof has no exact filename, compiler/toolchain versions, compile command, source encoding, output normalization, prompt text, temperature, repeat count, or pass-rate threshold. A one-off successful Typhoon run is not a reliable release gate. The service proofs similarly mix repeatable contract tests with live upstream calls without separating deterministic fixture tests from availability-dependent smoke tests. “All critical fixtures” in SM-4 is circular because the fixture inventory is not enumerated.

**Concrete fix:** Publish a normative release matrix with four OS-version cells (minimum and newest for each OS), Node/npm/PowerShell/zsh/toolchain versions, fresh-install and upgrade paths, exact C++ prompt and expected artifacts, model parameters, repetition count and allowed failure rate, plus offline deterministic adapter fixtures and separately reported live smoke tests for all providers/services. Enumerate the “critical fixtures” by ID and map each to FRs. A live upstream outage should block or waive release through an explicit policy, not produce an ad hoc interpretation.

## Medium findings

### CLI-M1 — First-run and credential lifecycle edge paths are missing

**Location:** UJ-1; FR-2 through FR-4; FR-25.

The happy path is good, but there is no required route for obtaining a key, reviewing provider terms/hosts before entry, cancelling setup, retrying later, editing a mistyped key, rotating/removing a key from the TUI, or handling a locked/unavailable OS credential store. It is also unclear whether users may enter a local-only interface without a valid Typhoon key.

**Concrete fix:** Add onboarding states and recovery actions: acquisition/help link, provider/host disclosure, masked paste behavior, verify/retry/edit/cancel, credential-store failure, rotation/removal, and `/connections` re-entry. Decide whether no-key mode can show help/settings/sessions or whether launch hard-blocks before the main TUI.

### CLI-M2 — Health-state vocabulary and transitions need one canonical model

**Location:** UJ-3; FR-4; FR-18 through FR-20; FR-37.

The document uses configured, checking, available, unavailable, unhealthy, quarantined, entitlement, quota, and temporary state, but does not define all transitions or display precedence. A user could see a connection as available while one service is quarantined, or a stale health pass after a mapping update, without a defined summary label.

**Concrete fix:** Add a small state machine for provider connection and per-service state, including timestamp/staleness, reason code, retryability, user action, catalog visibility, routing eligibility, and aggregation into the persistent status area.

### CLI-M3 — Context controls are measurable internally but incomplete as user interactions

**Location:** Context scope; FR-29 through FR-31; FR-36.

The Donut thresholds and hard stop are clear, but pin/unpin syntax, pin granularity, summary inspection, manual compaction, undo/retry behavior, and `/clear` semantics are undefined. “Inspectable” does not say whether users can see the exact next-call payload or only categories. Cached token counts and estimates may also diverge by adapter.

**Concrete fix:** Define context actions and states: pin/unpin turn or Evidence, inspect included/summarized/excluded items, trigger compaction, view summary provenance, respond to hard stop, and clear transcript versus model context versus caches. Require every estimate to show its source and confidence, and define behavior when the provider reports a different token count.

### CLI-M4 — Rollback units and cap-exceeding behavior have edge-case ambiguity

**Location:** UJ-7; FR-33 through FR-35; addendum recovery mechanisms.

“Five subsequent prompts” does not say whether cancelled, refused, clarification-only, failed, or slash-command turns count. A Prompt Round can contain multiple edits, a partial failure, a rename, or a directory deletion. The user can confirm an unprotected action, but the UI does not require a list of which files/effects will lose protection or whether an existing checkpoint remains partially protected.

**Concrete fix:** Define the retention counter and checkpoint lifecycle precisely. Require rollback preview to list reversible, conflicted, expired, excluded, and unprotected effects before execution. Specify atomic/partial rollback behavior and how rename, directory deletion, permission-only changes, and a crash during rollback are represented.

### CLI-M5 — Evidence visibility is strong, but retention and inspection routes are not defined

**Location:** FR-17; FR-38 and FR-39; NFR-1, NFR-2, NFR-6, and NFR-15.

The activity log promises extensive Evidence but does not define the user command/view for inspecting it, default retention, redaction indicators, truncation, storage caps, or deletion behavior. “Raw export disabled by default” implies an export setting might exist even though session export is a non-goal.

**Concrete fix:** Define the Evidence viewer, compact versus expanded fields, redaction markers, output truncation with access to safe full output, retention relationship to sessions and rollback, storage limits, deletion, and whether any export exists in Release 1. If export is out of scope, say unavailable rather than disabled by default.

### CLI-M6 — Performance and telemetry policies are too late or ambiguous for a production-quality TUI

**Location:** FR-39; NFR-12 through NFR-15; Deferred Decision 2.

Numeric budgets can be finalized before RC, but architecture still needs provisional goals for startup, keypress-to-render, streaming, cancellation, and session restore. External telemetry behavior is not stated; “external telemetry convention” and “raw export disabled by default” leave an open-source user unsure whether thcode sends diagnostics anywhere.

**Concrete fix:** Add provisional UX budgets before TUI architecture and tighten them through measurement. State a clear outbound telemetry policy—preferably no telemetry by default, with explicit opt-in if later added—and distinguish local Evidence from external diagnostics.

### CLI-M7 — Terminal accessibility and input behavior need more than color and narrow-width fallbacks

**Location:** FR-36 and FR-37; NFR-9 and NFR-10.

Shift+Tab and Esc can conflict with terminal settings, IMEs, and modal conventions. The PRD does not cover resize, scrollback, screen readers, reduced animation, keyboard-only navigation, mouse assumptions, bracketed paste, large pasted prompts, `Ctrl+C`, `Ctrl+D`, or terminal disconnect.

**Concrete fix:** Add a TUI input/accessibility baseline with command alternatives to shortcuts, safe paste confirmation thresholds, resize preservation, scrollback/copy behavior, focus order, screen-reader-friendly text mode, cancellation semantics, and tests for disconnect/reconnect where applicable.

### CLI-M8 — Release 1 has too many independent high-risk systems without milestone sequencing

**Location:** First Public Release Scope; FR-1 through FR-39; Principal Risk “Scope concentration.”

The release simultaneously includes a new cross-platform TUI, credentials, model tool calling, four service adapters, permissions/sandboxing, encrypted global sessions, context compaction, crash recovery, and conflict-safe rollback. “Independent acceptance fixtures and stable FR ownership” is useful but does not create an integration order or protect the headline proof from being delayed by secondary systems.

**Concrete fix:** Keep the committed scope if desired, but add vertical release milestones and exit gates: install/onboard/chat; bounded C++ loop; four services and consent; sessions/context; recovery/rollback; hardening. Require each milestone to run on both platforms and preserve the user-visible trust contract. This improves story creation without changing the public promise.

## Low findings

### CLI-L1 — Normative FRs switch between “Nok,” “developer,” and “user”

**Location:** FR-3, FR-5, FR-20 through FR-39.

Named protagonists are effective in journeys, but normative requirements and acceptance tests are clearer with one actor term.

**Concrete fix:** Keep Nok in UJs and use “the user” consistently in FRs, consequences, NFRs, and acceptance criteria.

### CLI-L2 — Some names and labels need a canonical copy/style sheet

**Location:** Throughout, especially “AI-for-Thai Key,” “Specialist Service,” “Reasoning Model,” “Evidence,” “Saved Session,” and “Full Access.”

Concept capitalization is mostly intentional but can read like inconsistent product branding. Exact labels matter in a bilingual terminal, documentation, logs, and tests.

**Concrete fix:** Add a short product-language glossary specifying canonical English/Thai UI labels, capitalization, abbreviations, and whether protocol/service names are translated.

### CLI-L3 — Post-launch adapter direction may leak into Release 1 architecture

**Location:** addendum “Extension architecture direction.”

Built-in OpenAI-compatible and Anthropic profiles are described as an architecture direction while the PRD says Typhoon-only. A team could spend Release 1 effort generalizing adapters that have no acceptance value.

**Concrete fix:** Label those profiles explicitly as post-launch constraints, not Release 1 deliverables. Require only the seams needed to prevent hard-coding Typhoon secrets or UI, and defer additional protocol implementations until a new FR exists.

## Readiness recommendation

Do not send the current artifact directly into detailed UX, architecture sign-off, or story generation. First resolve CLI-C1 through CLI-C3 and CLI-H2 through CLI-H7; these decisions define the executable and visible product contract. CLI-H1 should be fixed during final PRD polish so the artifact becomes self-contained. The remaining high findings should be resolved before implementation stories are accepted, while the medium/low findings can be scheduled as owned specification tasks with milestone gates.

After those fixes, the PRD's structure, journeys, stable FR IDs, success measures, and explicit non-goals should support UX, architecture, and epic/story creation well.
