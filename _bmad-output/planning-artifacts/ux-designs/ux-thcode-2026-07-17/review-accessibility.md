# Adversarial Accessibility Review — thcode UX Spine Pair

**Artifacts reviewed**

- `/Users/temicide/Documents/thcode/_bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/DESIGN.md`
- `/Users/temicide/Documents/thcode/_bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md`
- `/Users/temicide/Documents/thcode/_bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/.memlog.md`
- All four `.working/source-extract-*.md` files in the same directory

**Verdict: FAIL — release-blocking accessibility contract gaps remain.**

The spines have the right slogans—text fallback, no color-only status, Thai preservation, headless parity—but slogans are not an accessible terminal product. The critical interaction machinery is explicitly left open: focus traversal, modal behavior, minimum width, screen-reader semantics, live announcements, redirected authority, and warning composition. A commercial Ink TUI cannot ship on the assumption that a future implementation will guess correctly. The findings below are ranked by downstream impact, not by how polished the prose sounds.

## Findings

### A11 — Critical: Keyboard-only focus and traversal are not a contract

**Location:** `EXPERIENCE.md:24`, `EXPERIENCE.md:100`, `EXPERIENCE.md:176`, `DESIGN.md:178`

**Failure scenario:** A keyboard-only user opens command completion, then an approval overlay appears while the composer has focus. The spines specify `Tab` as “accept completion,” `Shift+Tab` as Plan/Build switching, `Esc` as dismissal, and several independent controls, but never define a focus order, focus trap, focus return target, how `Tab` differs between composer/completion/dialog, or how a user reaches Evidence and hidden activity. The same key can therefore accept a completion, move focus, or submit/alter a control depending on an implementation guess. A user can approve the wrong control or become trapped in an overlay with no discoverable escape.

**Fix:** Define a keyboard interaction matrix for every surface: entry focus, tab order, roving versus sequential focus, focus trap, `Tab`/`Shift+Tab` semantics by state, arrow-key behavior, activation keys, disabled/unavailable items, escape/cancel behavior, and deterministic focus restoration. Add fixtures for composer → completion → approval → Evidence → composer, including nested overlays and stale proposals.

### A12 — Critical: Approval safety is visually described but not keyboard-safe

**Location:** `EXPERIENCE.md:76`, `EXPERIENCE.md:170`, `DESIGN.md:201`, `EXPERIENCE.md:115`

**Failure scenario:** An approval dialog opens while the underlying operation becomes stale or its action digest changes. The user presses Enter expecting the already reviewed action to be approved. The spine says approval is bound to `OperationId`/digest and stale proposals require reevaluation, but it does not define which control receives initial focus, whether approve is ever the default, how a stale overlay is announced, or whether focus is prevented from activating an invalid button. A keyboard user can receive a misleading “approved” interaction result even though the backend later rejects or refreshes it, with no clear announcement of the changed target.

**Fix:** Make the safe default explicit: initial focus must be on a non-committing action such as Cancel/Review, never Approve. Define visible and linearized stale/mismatch states, disable or remove approval when the digest changes, return focus to the refreshed purpose/risk heading, and require a fresh bounded decision. Specify Enter/Space behavior and announce the exact selected action before commit.

### A13 — Critical: Redirected/noninteractive approval and secret-entry behavior is explicitly unresolved

**Location:** `EXPERIENCE.md:276`, `EXPERIENCE.md:279`, `EXPERIENCE.md:189`, `.working/source-extract-epics.md:361-362`

**Failure scenario:** `thcode` is piped into a CI log or launched without a TTY and reaches a mutation approval, transfer consent, or credential form. The contract says it “must fail safely” but does not define the exit status, machine-readable/text output, whether the proposed action is withheld, how much safe context is emitted, or how a caller can supply an approval. A script can see an incomplete stream and misclassify a blocked action as a successful no-op; a secret can be requested with no safe input path.

**Fix:** Specify a noninteractive contract before release: TTY detection, stable stdout/stderr routing, explicit refusal reason, nonzero exit codes, no effect/no secret read guarantee, redaction rules, one-record logical order, and a documented headless intent/API path for pre-authorized test fixtures. Add redirected tests for each approval class, credential entry, unknown outcome, and partial output.

### A14 — High: Screen-reader and linearized output semantics are deferred, so live output is inaccessible by design

**Location:** `EXPERIENCE.md:178-189`, `DESIGN.md:196-209`, `.working/source-extract-architecture.md:78-84`

**Failure scenario:** A screen-reader user receives a streaming response, a progress update, a status-bar health change, and an interruption marker. Ink redraws the same terminal region; the reader announces duplicated lines, misses the changed status, or reads transient token deltas as durable facts. The spine only requires stable noninteractive text and admits that screen-reader behavior and live-announcement semantics are open.

**Fix:** Define an assistive-technology matrix for supported Windows Terminal/macOS Terminal modes and text/redirected rendering. Specify a linearized event stream separate from visual redraw, durable versus transient announcement rules, headings/landmarks, live-region politeness, deduplication by `EventId`, interruption announcement text, and a user-controlled quiet/live verbosity mode. Test with a screen reader and captured plain-text output, not just snapshots.

### A15 — High: Focus can be lost during streaming, resize, cancellation, and overlay races

**Location:** `EXPERIENCE.md:73`, `EXPERIENCE.md:100`, `EXPERIENCE.md:149`, `EXPERIENCE.md:176`, `DESIGN.md:178`

**Failure scenario:** While the user is typing Thai text, a progress event arrives and the terminal resizes. The TUI rerenders, the composer remounts, the IME composition is lost, and focus moves to a newly inserted activity row. Alternatively, cancellation completes while an approval overlay is open and focus returns to an unrelated command. The documents name resize/IME/cancellation but provide no preservation invariant or focus restoration algorithm.

**Fix:** Require stable component identity and cursor/selection/IME preservation across every projection/event update. Define focus restoration by logical control ID, not row index, and define behavior when the focused control disappears, becomes disabled, or is replaced by a terminal outcome. Add resize-at-every-state tests with active composition and pending approval.

### A16 — High: Thai IME and grapheme behavior is a requirement without an implementable editing model

**Location:** `EXPERIENCE.md:73`, `EXPERIENCE.md:185`, `DESIGN.md:198`, `.working/source-extract-prd.md:217-220`

**Failure scenario:** In Windows Terminal with a Thai IME, the user composes a cluster containing combining marks, pastes mixed Thai-English text, presses Left/Delete, and submits during composition. A code-unit cursor can split a grapheme, display a misplaced combining mark, delete only part of a cluster, or submit preedit text. Ink’s display width can also disagree with JavaScript string length, causing the cursor to drift and wrap technical tokens incorrectly.

**Fix:** Specify the input model and test oracle: preserve IME preedit versus committed text, never submit while composition is active, use grapheme segmentation for cursor/delete/selection, use terminal-cell width for wrapping/cursor placement, preserve bidi-neutral technical tokens, and define normalization (or explicitly forbid it). Add Thai combining-mark, emoji/ZWJ, mixed-script, paste, delete, wrap, resize, persistence, and streamed-replay fixtures on both supported platforms.

### A17 — High: Mixed Thai-English and exact-token wrapping has no collision rule

**Location:** `DESIGN.md:164-172`, `DESIGN.md:180`, `EXPERIENCE.md:50`, `EXPERIENCE.md:184-187`

**Failure scenario:** An explanation in Thai contains a long Windows path, a URL, a hash, or a PowerShell command. The renderer wraps at arbitrary string boundaries, splits a technical identifier, or visually merges Thai punctuation with the command. Copying the apparent line yields a changed command/path, while the prose claims exact tokens are preserved.

**Fix:** Define token-aware wrapping and copy semantics: technical spans are atomic for display or have an explicit continuation marker; visual wrapping never inserts bytes into copy output; paths/URLs/commands use horizontal inspection or a safe expanded view; labels and prose have a locale fallback. Verify rendered cell widths and clipboard/text export against the original bytes.

### A18 — High: Narrow-terminal behavior is asserted but has no minimum width or overflow policy

**Location:** `DESIGN.md:176-180`, `EXPERIENCE.md:274-279`, `.working/source-extract-epics.md:343-345`

**Failure scenario:** At 40 or 60 columns, the status row contains Work Mode, Permission Profile, Full Access, provider health, service health, context, interruption, and rollback conflict. The implementation stacks fields but pushes the composer or approval action below the viewport, wraps labels into ambiguity, or truncates the only warning. “Immediately inspectable” is not a guarantee when no minimum width, priority, or overflow order exists.

**Fix:** Define tested width tiers and a deterministic degradation order. At each tier, specify which fields remain inline, which move to `/status`, how headings/actions remain visible, how scrolling works, and what exact text replaces the donut. Reject or degrade safely below the minimum; never silently clip an authority or outcome state. Add golden plain-text fixtures at 40, 60, 80, and 120 columns.

### A19 — High: Simultaneous warnings can overwrite one another

**Location:** `EXPERIENCE.md:72`, `EXPERIENCE.md:115`, `DESIGN.md:197`, `DESIGN.md:204`, `.working/source-extract-epics.md:370-374`

**Failure scenario:** Full Access is active while AI-for-Thai is quarantined, context is in protected overflow, a prior operation is unknown, and rollback has a conflict. The status bar has one row and the source explicitly leaves priority/composition open. A compact renderer may show only the last warning or color a single accent, hiding the more urgent unknown outcome or authority warning from keyboard and linearized users.

**Fix:** Define a severity/authority ordering and a persistent warning index. Each warning needs a stable ID, text label, count/summary, inspect action, and deterministic traversal order; no warning may disappear because another arrives. Specify how warnings are announced once, revisited, acknowledged, and represented in redirected/headless output.

### A20 — High: Color/no-color and contrast requirements have no measurable acceptance criteria

**Location:** `DESIGN.md:149-160`, `DESIGN.md:215-222`, `EXPERIENCE.md:182-184`, `.working/source-extract-prd.md:181-183`

**Failure scenario:** A terminal theme remaps colors, uses monochrome output, or renders the gold focus outline indistinguishably from surrounding text. The prose says labels and ordering supplement color, but does not define contrast, minimum focus visibility, icon/shape semantics, or whether the same state label appears in every projection. A user misses Full Access, danger, or unknown-outcome despite nominal “no color alone” compliance.

**Fix:** Establish a terminal-appropriate contrast/focus target and a semantic no-color rendering contract. Every consequential state must have a canonical text token (for example `DESTRUCTIVE`, `UNKNOWN OUTCOME`, `FULL ACCESS`) in visual, redirected, and headless forms. Test truecolor, 256-color, 16-color, monochrome, theme inversion, and invisible-color environments; validate focus and selected-state distinction without relying on hue.

### A21 — High: Motion and redraw behavior is unspecified, including reduced-motion and interruption feedback

**Location:** `DESIGN.md:182-190`, `DESIGN.md:196-209`, `EXPERIENCE.md:188`, `.working/source-extract-architecture.md:22-32`

**Failure scenario:** A spinner or continuously redrawn progress region is added to make health checks and streaming feel responsive. A user with motion sensitivity, a slow terminal, screen magnifier, or screen reader gets flicker, repeated announcements, or no stable indication that cancellation/unknown outcome has completed. The spines say animation is not required, but do not prohibit it or define a static alternative.

**Fix:** Make motion optional and nonsemantic. Define a static progress representation, frame/update budgets, no-blink policy, reduced-motion/environment setting, and a one-time textual transition for checking → result, cancellation, and interruption. Ensure redraw never erases durable facts in captured or assistive output.

### A22 — High: Interruption announcements do not define timing, ownership, or reliable-boundary presentation

**Location:** `EXPERIENCE.md:96`, `EXPERIENCE.md:149`, `EXPERIENCE.md:188-189`, `DESIGN.md:199`, `.working/source-extract-architecture.md:24-32`

**Failure scenario:** The network drops after partial output. The user hears or sees the partial transcript, but `Chat interrupted` appears off-screen or is appended after a late replayed chunk. The user cannot tell whether the remote request was not sent, possibly dispatched, or response-started, and may reprompt into a duplicate side effect. The durable event model is sound; the user-facing announcement contract is not.

**Fix:** Define the exact ordered terminal sequence: preserved chunks, one `Chat interrupted` heading, outcome classification (`not sent`/`possibly dispatched`/`response started`), Evidence link, and explicit inspect/reprompt/reconcile controls. Announce it once through linearized output, keep it visible in narrow mode, and specify behavior for duplicate/reordered subscription events and cancellation racing with dispatch commit.

### A23 — High: Headless parity is stated as shared state, not proven as accessible output parity

**Location:** `EXPERIENCE.md:20`, `EXPERIENCE.md:277`, `DESIGN.md:196`, `.working/source-extract-architecture.md:15-18`

**Failure scenario:** Headless validation exercises the same intents and terminal outcomes but emits a different message order, omits warnings, or exposes raw paths that the Ink UI redacts. A release test passes because the core reaches `succeeded`, while a redirected user never sees the approval, Evidence, limitation, or unknown outcome that an interactive user would see.

**Fix:** Define a canonical projection-to-text contract owned below Ink: stable event/state labels, logical order, redaction, exit codes, correlation IDs, and terminal outcomes. Require parity fixtures that compare Ink linearization, redirected output, and headless output for every state and key flow. Test at-least-once replay and duplicate `EventId` handling so no action or durable fact is duplicated.

### A24 — Medium: `Ctrl+C`, `Ctrl+D`, and Escape semantics collide across input, approval, and process cancellation

**Location:** `EXPERIENCE.md:163-176`, `EXPERIENCE.md:168`, `.working/source-extract-epics.md:264-276`

**Failure scenario:** `Ctrl+C` is pressed during IME composition, while a command is running, or while an approval is awaiting a decision. Depending on terminal and Ink handling it may clear the line, cancel the operation, terminate the process, or leave a child process running. `Esc` similarly has modal, form, and completion meanings without a state precedence rule.

**Fix:** Define a stateful key precedence table and confirmation/announcement behavior. Preserve composition when cancellation is not intended; distinguish interrupt-requested from terminated; make `Ctrl+D` behavior explicit for empty versus nonempty composer; ensure terminal restoration and child cleanup are reported as outcomes, not assumed. Add race tests for keys during every lifecycle phase.

### A25 — Medium: Completion and selectable controls lack a nonvisual selection announcement

**Location:** `EXPERIENCE.md:34`, `EXPERIENCE.md:82`, `EXPERIENCE.md:167`, `DESIGN.md:207`

**Failure scenario:** A user navigates slash completion in a color-limited terminal or through a screen reader. The active result is distinguished by accent plus “textual selection state,” but no exact selected/not-selected syntax, result count, loading announcement, or acceptance feedback is specified. `Tab` can accept the wrong command, especially when results update asynchronously.

**Fix:** Specify a canonical row format such as `selected, 2 of 5`, stable result identity, keyboard navigation, loading/empty/error/cancelled announcements, and acceptance confirmation. Freeze or reconcile the result set while a key event is being applied; never let async ranking move the selected item under the user.

### A26 — Medium: Credentials are promised hidden, but accessibility and diagnostics leakage paths are not closed

**Location:** `EXPERIENCE.md:83`, `EXPERIENCE.md:186`, `DESIGN.md:208`, `.working/source-extract-prd.md:233-243`

**Failure scenario:** A user pastes a key, resizes the terminal, hits an input error, or captures a screen-reader/diagnostic snapshot. The normal field is masked, but the preedit buffer, accessibility label, validation message, terminal scrollback, or exception includes the secret or a revealing length/value. The source lists these risks but provides no secret-field rendering contract.

**Fix:** Define secret input invariants: never expose value to rendered text, accessibility name/value, snapshots, logs, errors, clipboard, scrollback, or headless output; announce only “secret entered”/“secret not entered”; clear buffers on cancel/error; and test paste, IME, resize, redraw, interrupt, crash, and replace/remove flows.

### A27 — Medium: Status vocabulary is not canonical across visual, linearized, redirected, and Thai surfaces

**Location:** `EXPERIENCE.md:48-63`, `EXPERIENCE.md:88-102`, `DESIGN.md:151-160`, `.working/source-extract-epics.md:321-324`, `.working/source-extract-epics.md:363-364`

**Failure scenario:** The visual UI says `unhealthy`, the redirected stream says “service failed,” and a Thai explanation says “connected” after only `configured`. A screen-reader or support engineer cannot reliably map the state, and exact terms such as `unknown-outcome`, `percentage unavailable`, or `Catalogued — Not available yet` drift across surfaces.

**Fix:** Create a versioned state/copy catalog with exact tokens, localized explanatory text, fallback language, cause-code mapping, and a rule that canonical state tokens remain unchanged in Thai and English mixed output. Snapshot every state across TUI, plain text, headless, Evidence, and completion summary.

### A28 — Medium: Long output inspection is not keyboard- or reader-addressable

**Location:** `EXPERIENCE.md:74`, `EXPERIENCE.md:123-124`, `EXPERIENCE.md:174`, `DESIGN.md:180`, `.working/source-extract-epics.md:274-275`

**Failure scenario:** A command output or Evidence panel is summarized to fit the terminal. The “inspection affordance” is an unspecified icon, mouse target, or visual expansion. A keyboard-only or linearized user cannot reach the omitted lines, cannot tell where the summary ends, and may copy a truncated command as if complete.

**Fix:** Specify an explicit text command/key for expand, collapse, next/previous section, and copy; expose total item/line counts and truncation markers; preserve logical reading order and safe redaction in expanded output. Ensure inspection works in redirected/headless mode via an explicit detail level rather than silently dropping content.

## Required release gates

Before calling Release 1 accessible, the team needs at minimum:

1. A keyboard/focus matrix and executable fixtures for every modal, completion list, form, stream, and recovery state.
2. A canonical linearized/plain-text projection contract shared by Ink, redirected output, and headless execution.
3. A supported terminal/assistive-technology matrix with live-update, replay, and announcement behavior.
4. Width-tier, color-mode, resize, and no-motion test fixtures.
5. Thai IME/grapheme/cell-width tests on Windows Terminal/PowerShell and macOS Terminal/zsh.
6. Noninteractive approval/consent/credential contracts with fail-closed exit behavior.
7. Approval stale-state and interruption race tests proving that focus and authority cannot drift.
8. A versioned copy/state catalog preserving exact technical tokens and canonical outcomes.

## Severity count

- **Critical:** 3
- **High:** 10
- **Medium:** 5
- **Low:** 0
- **Total:** 19
