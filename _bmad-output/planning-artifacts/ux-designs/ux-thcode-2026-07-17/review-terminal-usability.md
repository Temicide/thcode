# Terminal Usability and Near-Clone Familiarity Review

**Scope:** adversarial review of `DESIGN.md` and `EXPERIENCE.md`, checked against `.memlog.md`, the frontmatter source extracts in `.working/`, and the architecture constraints. The review treats the requested Claude Code CLI resemblance as an implementation contract, not as a claim of provider or capability equivalence.

## Verdict

**Not implementation-ready for terminal interaction.** The spines establish a strong trust, legibility, and bounded-authority direction, but leave the highest-frequency terminal behaviors open: command grammar, keyboard/focus state, composer editing, streaming viewport behavior, status priority, overlay races, narrow-width rules, noninteractive behavior, and recovery navigation. The phrase “near-clone” is directionally clear but not specific enough to implement consistently and risks misleading users about Release 1 capability breadth.

**Severity counts:** 11 High, 5 Medium, 0 Low. **Total: 16 findings.**

## Findings

### H-01 — Simultaneous status warnings have no composition policy

**Location:** `EXPERIENCE.md:104-115`; `DESIGN.md:194-205`.

**Failure scenario:** Full Access is active while a Specialist Service is unhealthy, protected context is overflowing, a round was interrupted, and a rollback conflict exists. The spines require all of these to remain visible or immediately inspectable, but define neither priority nor composition. Implementations will either wrap the status row into the transcript/composer or hide a consequential warning.

**Fix:** Define a deterministic status policy: always-pinned fields, one-line alert-slot priority, overflow notation, and `/status` drill-down ordering. Provide exact layouts for at least 40-, 60-, 80-, and 120-column terminals, including monochrome and redirected forms.

### H-02 — “Near-clone familiarity” lacks a Claude Code-compatible command and keyboard contract

**Location:** `DESIGN.md:141-145, 196-208`; `EXPERIENCE.md:163-176`; `.working/source-extract-epics.md:264-277`; `.memlog.md:6-10`.

**Failure scenario:** A Claude Code-familiar user expects predictable slash-command discovery, help, history, interrupt/cancel, session controls, completion, and focus traversal. The spine only commits to `/`, `Tab`, `Shift+Tab`, `Esc`, `Ctrl+C`, and `Ctrl+D`; aliases, argument grammar, quoting, history keys, modal traversal, and deliberate deviations are open.

**Fix:** Add a canonical compatibility table for every supported command and key: syntax, aliases, argument completion, submit behavior, history navigation, interrupt/cancel semantics, focus traversal, and unsupported familiar controls. State explicitly where thcode intentionally diverges from Claude Code.

### H-03 — Composer editing is not a usable state machine

**Location:** `DESIGN.md:196-199`; `EXPERIENCE.md:69-75, 163-176`; `.working/source-extract-epics.md:273-277`.

**Failure scenario:** A user pastes a multiline Thai prompt, presses `Esc` during IME composition, or attempts to edit while a response streams. The documents require preservation of IME, graphemes, paste, multiline content, and exact tokens, but do not define whether `Esc` cancels composition, clears the draft, dismisses an overlay, or interrupts the round; they also omit history and submit rules.

**Fix:** Specify composer states and key precedence: composing, editing, completion-open, streaming, interrupted, and overlay-blocked. Define newline/submit keys, draft preservation, up/down history, paste normalization, IME cancellation, and whether input is disabled or queued during streaming.

### H-04 — Streaming transcript follow, scroll, and viewport behavior are undefined

**Location:** `DESIGN.md:196-200`; `EXPERIENCE.md:69-75, 117-123, 163-176`; `.working/source-extract-epics.md:343-349`.

**Failure scenario:** A long response streams while activity rows and progress events arrive. Without follow-mode rules, the viewport either jumps away from a user inspecting earlier text or pushes the composer and `Chat interrupted` boundary off screen. Replay and durable chunk restoration add duplicate/focus risks.

**Fix:** Define auto-follow until the user scrolls, a visible “new output” indicator, jump-to-live and jump-to-boundary controls, scroll preservation across replay/restore, chunk grouping, and whether activity is interleaved or collapsible/separate. Specify how the UI reconciles transient chunks with the durable transcript.

### H-05 — “Every call” activity logging conflicts with compactness at realistic volume

**Location:** `DESIGN.md:199-200`; `EXPERIENCE.md:74-77, 117-123`; `.working/source-extract-epics.md:348-349`.

**Failure scenario:** One Prompt Round performs dozens of auto-permitted reads/searches, retries a health check, invokes a Specialist Service, and runs verification. “Every call” plus compact rows consumes the terminal, while progressive disclosure has no grouping, filtering, pagination, or copy contract.

**Fix:** Define a default grouped representation by Prompt Round and operation class with counts and first/last status, plus an explicit “show all” view. Specify row height, truncation markers, filters, pagination/scroll, correlation navigation, copy behavior, and durable full-log retention.

### H-06 — Approval overlays lack focus, default, and stale-refresh rules

**Location:** `DESIGN.md:200-202`; `EXPERIENCE.md:75-77, 163-176`; `.working/source-extract-epics.md:345-347, 372-373`.

**Failure scenario:** An approval is open when the target file changes, a Boundary Expansion is revoked, or the prepared payload digest changes. The backend invalidates the proposal, but the UX does not say whether the overlay refreshes, closes, preserves focus, or explains the controlling reason. Keyboard users cannot predict initial focus or Enter’s action.

**Fix:** Define initial focus, focus order, `Tab`/arrow traversal, safe default/no-default behavior, Enter semantics, detail expansion, and stale-proposal treatment. Specify exact copy for digest mismatch, authority revocation, target mutation, and underlying state refresh.

### H-07 — Recovery is a taxonomy, not a navigable recovery experience

**Location:** `EXPERIENCE.md:43-46, 143-151, 153-161`; `.working/source-extract-epics.md:256-262, 360-364`.

**Failure scenario:** After a crash, the user sees `unknown-outcome`, `recovery-locked`, or `incomplete stage` but cannot tell which command opens reconciliation, whether the session is read-only, or whether continuing is safe. “Inspect, reprompt, or reconcile” is not itself a discoverable interaction contract.

**Fix:** Define one recovery entry point and an action matrix per state: inspect, reconcile, reprompt, retry-disabled explanation, export-safe evidence, exit, and read-only restrictions. Specify startup priority, command names, exit codes, unavailable actions, and the next-step copy.

### H-08 — Redirected and noninteractive behavior is explicitly unresolved

**Location:** `EXPERIENCE.md:266-279`; `.working/source-extract-epics.md:360-362`; `.working/source-extract-prd.md:276-279`.

**Failure scenario:** `thcode` is piped in CI or redirected to a file and reaches approval, credential entry, or transfer consent. “Fail safely” does not say whether it exits, emits a stable refusal, offers a noninteractive flag, or hangs waiting for input. A Claude Code-like CLI also creates an expectation of usable automation/headless behavior.

**Fix:** Define TTY detection, noninteractive flags, approval/consent policy, stable text or JSON output, secret-entry behavior, exit codes, and the exact rerun-interactively message. Include tests for each interactive gate in redirected mode.

### H-09 — Narrow-terminal guidance is qualitative and cannot guarantee operability

**Location:** `DESIGN.md:174-180, 204-207`; `EXPERIENCE.md:178-189, 266-279`; `.working/source-extract-epics.md:280-292`.

**Failure scenario:** At 40–60 columns, the 2-character gutter, status fields, warning copy, long service names, and approval details wrap repeatedly. The composer can be pushed below the viewport and exact commands become unreadable despite “wrap safely.”

**Fix:** Establish width tiers, minimum usable width, snapshot fixtures, collapsing order, stable abbreviations, one-column overlay rules, vertical/horizontal scrolling behavior, and the point at which the UI switches to a command-oriented text mode. Preserve exact tokens in copyable expanded views.

### H-10 — Session navigation is named but not learnable

**Location:** `EXPERIENCE.md:40-41, 79-81, 143-151`; `.working/source-extract-epics.md:101-109, 341-352`.

**Failure scenario:** A user types `/session` expecting either a command or a browser, while `/sessions` opens a different surface. Duplicate names, missing Workspaces, deletion-pending sessions, and current/other sessions have no defined sorting, search, selection, or keyboard behavior.

**Fix:** Choose one canonical command and make the other an explicit alias. Define browser columns, default sort, search/filter, selection movement, open/inspect/delete confirmation, duplicate-name handling, restore progress, and behavior for missing or changed Workspaces.

### H-11 — Specialist discovery risks implying provider/capability parity

**Location:** `DESIGN.md:141-145, 203-208`; `EXPERIENCE.md:22-24, 37-38, 125-133`; `.working/source-extract-addendum.md:7-21, 23-31`.

**Failure scenario:** `/tools` offers browse/search/enable/disable/diagnose/retest and a catalog of future services. Together with “near-clone” positioning, this can read as unrestricted Claude Code-like tool extensibility, although Release 1 has four reviewed AI-for-Thai integrations and rejects arbitrary adapters/configuration.

**Fix:** Define separate states for `working`, `catalogued`, `disabled`, `unconfigured`, and `quarantined`; make catalogued items visibly non-invokable and non-enableable in Release 1. Repeat the capability-equivalence boundary in onboarding, `/tools`, `/models`, help, completion summaries, and command completion.

### M-12 — The command surface is too broad for first-run learnability

**Location:** `EXPERIENCE.md:26-46, 163-176`; `.working/source-extract-epics.md:52-59, 304-306`.

**Failure scenario:** A new user encounters boundaries, context, compaction, rollback, tools, sessions, usage, connections, permissions, and authority terms before learning the basic prompt flow. A flat completion list provides discovery but not a progressive learning path; terms such as `Runtime Activation` and `Effective Context Capacity` are not explained in place.

**Fix:** Define categorized completion sections, short descriptions, examples, contextual ranking, `/help` topics, and an essential first-run subset. Add one-line explanations for unfamiliar authority/context terms without changing exact labels.

### M-13 — Context and usage controls measure state but do not guide action

**Location:** `DESIGN.md:203-205`; `EXPERIENCE.md:135-141`; `.working/source-extract-epics.md:113-126`.

**Failure scenario:** The user sees `82% (70–84%, provider-reported)` or `percentage unavailable`, but cannot immediately inspect largest contributors, pin/unpin, compare summarized content, or choose a remedy after protected overflow. The Context Donut communicates measurement but not decision support.

**Fix:** Define a compact `/context` summary with ranked contributors and direct actions, and the exact flows for inspect summary, pin/unpin, compact, create Session, and retry. State consequences before each remedy and keep `/usage` separate.

### M-14 — Authority labels lack canonical compact wording

**Location:** `DESIGN.md:196-207, 215-222`; `EXPERIENCE.md:90-115`; `.working/source-extract-epics.md:46-59, 321-323`.

**Failure scenario:** The persistent row must show Build/Plan, Permission Profile, Full Access warning, transfer consent, Boundary Expansion, and Workspace. Without canonical narrow/expanded labels, implementations invent inconsistent abbreviations, making consequential states hard to scan and unlike the intended familiar CLI rhythm.

**Fix:** Provide canonical narrow and expanded labels, with exact warning copy for color and monochrome output. Keep Full Access, transfer consent, Boundary Expansion, and Workspace as separate visible fields rather than one permission badge.

### M-15 — Credential onboarding has no command-discovery or recovery path while blocked

**Location:** `EXPERIENCE.md:28-35, 193-204`; `.working/source-extract-epics.md:214-220, 455-510`.

**Failure scenario:** A Typhoon or AI-for-Thai live check fails, or a user wants to replace/remove a key. The normal TUI is not opened until a passing check, but onboarding does not define available help, evidence inspection, retry, replace, remove, or exit controls. Users can be trapped in a form/retry loop.

**Fix:** Define an onboarding shell with `/help`, inspect, retry, replace, remove, exit, and safe diagnostics. State whether limited offline inspection is possible; otherwise make the required exit path and failure evidence visible in every typed failure.

### M-16 — Error vocabulary lacks one cross-surface copy and localization contract

**Location:** `EXPERIENCE.md:48-63, 86-102`; `.working/source-extract-epics.md:236-262, 363-365`; `.working/source-extract-prd.md:263-274`.

**Failure scenario:** The same underlying event is rendered as `unavailable`, `unhealthy`, `quarantined`, `failed health`, `protocol incompatibility`, `unknown-outcome`, or `blocked` across status, activity, transcript, completion, recovery, and redirected output. Thai translation or English fallback can drift from deterministic state semantics.

**Fix:** Create a versioned copy deck mapping every state/cause code to stable English and Thai-capable text, retryability, recovery action, exit behavior, and narrow/noninteractive form. Keep model explanation subordinate to deterministic classification and Evidence.

## Implementation gates before claiming “near-clone” readiness

1. Freeze the command/keyboard compatibility table and list deliberate Claude Code deviations.
2. Freeze the composer, overlay, streaming, and focus state machines, including IME and paste behavior.
3. Freeze status priority and width-tier snapshots; test 40/60/80/120 columns and redirected output.
4. Freeze recovery, session-browser, context-remedy, credential-onboarding, and noninteractive action contracts.
5. Freeze the capability-equivalence disclaimer and catalog states so “near-clone” cannot be read as “same providers, tools, or execution guarantees.”
6. Add text snapshots for deterministic states across interactive, narrow, monochrome, and noninteractive modes; verify replay does not duplicate visible transcript or actions.
