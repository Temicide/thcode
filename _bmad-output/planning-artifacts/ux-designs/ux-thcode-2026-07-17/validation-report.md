# Validation Report — thcode

- **DESIGN.md:** `/Users/temicide/Documents/thcode/_bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/DESIGN.md`
- **EXPERIENCE.md:** `/Users/temicide/Documents/thcode/_bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md`
- **Run at:** 2026-07-17

## Overall verdict
The pair is a strong, source-grounded downstream contract for the primary terminal journeys, authority model, visual tokens, component behavior, and platform posture. It is not yet a clean release handoff: several source journeys are only embedded in other flows, state coverage is asserted generically rather than closed per IA surface, and cross-spine naming/traceability needs normalization. No critical token-definition or visual-reference failure was found.
Extra reviewers materially shift the picture: accessibility, terminal usability, and control/trust reviews expose four deduplicated critical release blockers and a broad set of high-severity interaction, authority, output-parity, and recovery gaps. The design direction is coherent, but the implementation contract is not ready for release-grade accessibility, near-clone terminal interaction, or human-control guarantees.

## Category verdicts
- Flow coverage — adequate
- Token completeness — adequate
- Component coverage — adequate
- State coverage — thin
- Visual reference coverage — strong
- Bloat & overspecification — thin
- Inheritance discipline — adequate
- Shape fit — strong

## Findings by severity
### Critical (4)
**[F1] [State coverage]** Keyboard focus and traversal are not a contract — `EXPERIENCE.md 24,100,176; DESIGN.md 178`
Completion, composer, and approval reuse keys without focus order, trap, return target, or nested-overlay rules; a user can approve the wrong control or become trapped.
Fix: Define a keyboard matrix, entry/return focus, tab/arrow semantics, disabled behavior, escape precedence, and fixtures through composer → completion → approval → Evidence.
Sources: `accessibility A11; terminal H-02/H-03/H-06; control 3,15`

**[F2] [State coverage]** Approval safety and stale proposals are not keyboard-safe — `EXPERIENCE.md 69–84,115,163–176; DESIGN.md 200–202`
A changed digest, target, authority, or endpoint can leave an active Approve control; Enter may commit a stale proposal.
Fix: Focus Cancel/Review initially, disable approval on mismatch, announce stale state, require fresh evaluation, and define Enter/Space.
Sources: `accessibility A12; terminal H-06; control 3`

**[F3] [State coverage]** Redirected approval, consent, and secret entry are unresolved — `EXPERIENCE.md 266–279; epics 361–362; PRD 276–279`
“Fail safely” omits TTY detection, refusal output, exit codes, pending behavior, and safe secret input; automation can misclassify a block.
Fix: Specify stable stdout/stderr and machine-readable refusal, nonzero exits, redaction/no-secret guarantees, and a headless intent path; test every gate.
Sources: `accessibility A13; terminal H-08; control 17`

**[F4] [State coverage]** Sensitive-data transfer policy is unresolved — `EXPERIENCE.md 125–133; DESIGN.md 202–208; PRD 233–243,263–274`
Transfer consent lacks closed classification, uncertainty, retention/deletion, upstream handling, and cache policy for personal data.
Fix: Close classification, transformation, retention, disclosure, consent, and fail-closed states across transfer/result/cache/Evidence/export/recovery.
Sources: `control 1`

### High (24)
**[R1] [Flow coverage]** Missing dedicated source journeys — `EXPERIENCE.md §§Key Flows, lines 191–252; `.working/source-extract-prd.md` UJ-2/UJ-3/UJ-6`
Catalog exploration, unhealthy-specialist recovery, and interrupted remote request are omitted or nested, so their climax and failure path require inference.
Fix: Add a Key Flow per omitted UJ or an explicit auditable source-to-flow mapping.
Sources: `review-rubric.md`

**[R2] [Token completeness]** Contrast and focus visibility lack measurable criteria — `DESIGN.md §§Colors and Do’s and Don’ts, lines 149–160,211–223; EXPERIENCE.md 182–184`
Theme remapping or monochrome output can hide Full Access, danger, unknown outcome, or focus despite nominal labels.
Fix: Define terminal contrast/focus targets and canonical no-color labels; test truecolor, 256/16-color, monochrome, inverted, and invisible-color modes.
Sources: `review-rubric.md; accessibility A20`

**[R4] [State coverage]** IA surfaces lack per-state closure — `EXPERIENCE.md 26–46,86–102`
Startup, onboarding, `/models`, `/check`, `/usage`, `/context`, and recovery lack explicit applicable loading/empty/error/denied/unknown/narrow behavior, action, and next step.
Fix: Add a surface-by-state matrix with stable copy, action, and next step.
Sources: `review-rubric.md`

**[F5] [State coverage]** Simultaneous warnings have no composition policy — `EXPERIENCE.md 72,104–115; DESIGN.md 194–205; epics 368–374`
Full Access, quarantine, overflow, unknown outcome, and rollback conflict can coexist but one row has no priority or minimum visible set.
Fix: Define pinned fields, authority/severity order, alert slot, overflow notation, `/status` traversal, and 40/60/80/120-column layouts.
Sources: `accessibility A19; terminal H-01; control 2`

**[F6] [Shape fit]** Near-clone command and keyboard contract is open — `DESIGN.md 141–145,196–208; EXPERIENCE.md 163–176; epics 264–277`
Slash grammar, aliases, quoting, history, completion, submit, interruption, and deliberate Claude Code deviations are unspecified.
Fix: Publish a compatibility table for every command/key and unsupported familiar control.
Sources: `terminal H-02`

**[F7] [Component coverage]** Composer editing is not a usable state machine — `DESIGN.md 196–199; EXPERIENCE.md 69–75,163–176`
IME cancellation, multiline paste, editing during streaming, Esc, history, and submit can behave differently by implementation guess.
Fix: Specify composing/editing/completion/streaming/interrupted/overlay-blocked states and key precedence.
Sources: `terminal H-03; accessibility A16,A24`

**[F8] [State coverage]** Streaming viewport and activity volume lack bounded behavior — `DESIGN.md 196–200; EXPERIENCE.md 69–77,117–123; epics 343–349`
Streaming and “every call” activity can push composer/interruption boundaries away or fill the terminal without grouping or inspection rules.
Fix: Define auto-follow, scroll preservation, new-output/jump controls, grouping/counts, show-all, filtering, pagination, and durable copy.
Sources: `terminal H-04,H-05`

**[F9] [State coverage]** Screen-reader and linearized live-output semantics are deferred — `EXPERIENCE.md 178–189; DESIGN.md 196–209; architecture 78–84`
Ink redraw can duplicate streaming lines, hide status changes, or make transient deltas sound durable.
Fix: Define a linearized event stream, announcement politeness, headings, EventId deduplication, interruption copy, and quiet/live mode.
Sources: `accessibility A14`

**[F10] [State coverage]** Focus can be lost during streaming, resize, cancellation, and races — `EXPERIENCE.md 73,100,149,176; DESIGN.md 178`
Rerender/remount during Thai composition or cancellation can lose cursor/IME and return focus to an unrelated control.
Fix: Preserve stable identity and restore focus by logical control ID, including disappearance/disable/replacement rules.
Sources: `accessibility A15`

**[F11] [Component coverage]** Thai IME, grapheme, and cell-width editing lacks an implementable model — `EXPERIENCE.md 73,185; DESIGN.md 198; PRD 217–220`
Code-unit cursoring can split Thai/emoji clusters, submit preedit text, and disagree with terminal-cell wrapping.
Fix: Specify preedit/committed text, no submit during composition, grapheme segmentation, cell widths, normalization, and Windows/macOS fixtures.
Sources: `accessibility A16`

**[F12] [Component coverage]** Mixed Thai-English technical tokens lack wrapping/copy rules — `DESIGN.md 164–172,180; EXPERIENCE.md 50,184–187`
Paths, URLs, hashes, and commands can split or merge with Thai prose; copied output can differ from original bytes.
Fix: Use atomic technical spans or explicit expanded views; never alter copy bytes; verify widths and clipboard/export.
Sources: `accessibility A17`

**[F13] [State coverage]** Narrow-terminal behavior has no minimum width or degradation order — `DESIGN.md 174–180,204–207; EXPERIENCE.md 178–189,266–279`
At 40–60 columns, status and approval content can wrap ambiguously, clip warnings, or push the composer away.
Fix: Define width tiers, minimum width, priority, scrolling, text fallback, and 40/60/80/120 golden fixtures.
Sources: `accessibility A18; terminal H-09`

**[F14] [State coverage]** Motion and redraw lack reduced-motion and static rules — `DESIGN.md 182–190,196–209; EXPERIENCE.md 188`
Spinner/redraw can flicker, repeat announcements, or erase stable cancellation/unknown status.
Fix: Make motion optional/nonsemantic; define static progress, budgets, no-blink, reduced-motion, and one-time transitions.
Sources: `accessibility A21`

**[F15] [State coverage]** Interruption boundaries and announcements are underspecified — `EXPERIENCE.md 96,149,188–189; DESIGN.md 199; architecture 24–32`
Partial remote output can leave users unsure whether work was not sent, possibly dispatched, or response-started.
Fix: Define ordered chunks → one interruption heading → classification → Evidence → inspect/reprompt/reconcile, including replay races.
Sources: `accessibility A22`

**[F16] [State coverage]** Headless, redirected, and Ink output parity is asserted, not contracted — `EXPERIENCE.md 20,277; DESIGN.md 196; architecture 15–18`
Headless may reach the same state while omitting warnings, Evidence, redaction, or logical order.
Fix: Define canonical text projection, labels, order, redaction, exit codes, IDs, and parity fixtures with replay deduplication.
Sources: `accessibility A23; control 17`

**[F17] [State coverage]** Recovery is a taxonomy, not a navigable experience — `EXPERIENCE.md 43–46,143–161; epics 256–262,360–364`
Unknown/recovery-locked states do not identify entry command, read-only limits, safe next action, or duplicate-effect risk.
Fix: Define one recovery entry point and action matrix for inspect/reconcile/reprompt/retry-disabled/export/exit with commands and exit codes.
Sources: `terminal H-07; control 10`

**[F18] [State coverage]** Exact effect identity is not human-verifiable — `EXPERIENCE.md 69–84,104–115,125–133; architecture 43–55; epics 48–58,83–93`
Rewritten proposals, retries, or adapter changes can look like the approved readable action despite a different dispatched effect.
Fix: Show short/expandable OperationId, action/payload/manifest/context digests, destination, generation, expiry; any change forces fresh review.
Sources: `control 4,7,13`

**[F19] [State coverage]** Persistent authority projection omits safety-critical scope — `DESIGN.md 196–208; EXPERIENCE.md 31–44,104–115; architecture 43–55`
Build + Full Access can hide Workspace, boundary scope/expiry, transfer consent, Runtime Activation, or enforcement state.
Fix: Define a persistent authority summary and deterministic inspect action; safety-critical state cannot be merely immediately inspectable.
Sources: `control 5`

**[F20] [State coverage]** Full Access revocation has no lifecycle semantics — `DESIGN.md 221–222; EXPERIENCE.md 90–115; PRD 168–177`
Revocation during approval or a long-running operation does not define what is invalidated, cancelled, or already committed.
Fix: Define grant/revoke scope, expiry, lifecycle effects, invalidation, and durable distinction between revocation, cancellation, and commit.
Sources: `control 6`

**[F21] [State coverage]** Specialist recipient and payload identity is incomplete — `EXPERIENCE.md 125–133,219–230; architecture 45–55; epics 83–93,173–183`
Service/host labels do not verify capability/version, adapter generation, transformations, call count, or exact bytes before transport.
Fix: Show recipient/version, endpoint, method, generation, manifest, transformations, call count, expiry, and digests; fail closed on preflight mismatch.
Sources: `control 7`

**[F22] [State coverage]** Pause, interrupt, and cancel lack a two-phase contract — `EXPERIENCE.md 69–102,163–176; architecture 24–32; epics 264–276`
Esc/Ctrl+C during prepared, committed, or remote-started work gives no durable requested/acknowledged/still-running/committed state.
Fix: Define cancellation states, acknowledgement timeout, cleanup evidence, durable operation row, and duplicate-attempt prohibition.
Sources: `control 9; accessibility A24`

**[F23] [State coverage]** Unknown remote outcomes lack reconciliation protocol — `EXPERIENCE.md 143–151,232–241; architecture 30–32,57–65`
Inspect/reprompt/reconcile is offered without idempotency, lookup/probe, evidence requirements, or terminal reconciled state.
Fix: Define provider/service reconciliation; if impossible, retain unknown-outcome, prohibit equivalent reprompt, and explain residual risk.
Sources: `control 10`

**[F24] [State coverage]** Evidence completeness and authority are not surfaced — `DESIGN.md 199–209; EXPERIENCE.md 117–123; architecture 57–65`
Sanitized, stale, estimated, or missing output can appear as complete proof beside deterministic classification.
Fix: Add completeness/provenance states, omission reasons, observation/display times, and keep model explanation separate.
Sources: `control 11`

**[F25] [State coverage]** Rollback conflicts lack executable safe resolution — `DESIGN.md 205–206; EXPERIENCE.md 153–161,243–252; addendum 41–50,131–140`
Changed files, renames, symlinks, or concurrent writers yield conflict without three-way inspection, safe skip/export/rebase, or durable resolution.
Fix: Define digest/path identity, three-way comparison, rename/concurrency handling, explicit resolution, and no generic overwrite/continue.
Sources: `control 12`

### Medium (18)
**[R3] [Component coverage]** Component identifiers drift between spines — `DESIGN.md 196–209; EXPERIENCE.md 69–84`
`Status bar`/`status-bar` and similar variants prevent mechanical joins and downstream traceability.
Fix: Choose canonical identifiers for frontmatter, prose, tables, and references; separate human labels.
Sources: `review-rubric.md`

**[R5] [Bloat & overspecification]** Architecture mechanics are repeated in the experience spine — `EXPERIENCE.md 18–24,117–123,137–161`
Protocol, durable-event, encryption, and storage detail obscures user-visible behavior and unresolved UX decisions.
Fix: Keep invariants and consequences in EXPERIENCE.md; cross-reference architecture for mechanisms.
Sources: `review-rubric.md`

**[R6] [Inheritance discipline]** Key Flows do not preserve source UJ identifiers — `EXPERIENCE.md 193,206,219,232,243; source PRD UJ headings`
Local flow names prevent mechanical proof of source correspondence.
Fix: Put verbatim UJ identifiers in headings or add a mapping table.
Sources: `review-rubric.md`

**[F26] [Component coverage]** Completion and selection feedback lack nonvisual contracts — `EXPERIENCE.md 34,82,167; DESIGN.md 207`
Color-limited or screen-reader users cannot tell selected item, count, loading/error state, or acceptance; async ranking can move selection.
Fix: Use “selected, 2 of 5”, stable identity, state announcements, acceptance confirmation, and freeze/reconcile during key handling.
Sources: `accessibility A25`

**[F27] [Component coverage]** Credential secrecy does not cover accessibility and diagnostics — `EXPERIENCE.md 83,186; DESIGN.md 208; PRD 233–243`
Paste, resize, preedit, labels, snapshots, scrollback, and exceptions can expose a secret despite masking.
Fix: Never expose secret values in UI, accessibility, logs, snapshots, errors, clipboard, scrollback, or headless output; clear buffers and test.
Sources: `accessibility A26`

**[F28] [State coverage]** Status and error vocabulary lack a canonical catalog — `EXPERIENCE.md 48–63,86–102; DESIGN.md 151–160; epics 321–324,363–365`
Visual, redirected, Evidence, completion, and Thai output can drift among configured/unhealthy/unavailable/unknown/blocked.
Fix: Create versioned English/Thai-capable state/copy catalog with cause, retryability, recovery, exit, and narrow/noninteractive forms.
Sources: `accessibility A27; terminal M-16`

**[F29] [State coverage]** Long-output inspection is not keyboard- or reader-addressable — `EXPERIENCE.md 74,123–124,174; DESIGN.md 180; epics 274–275`
An unspecified visual affordance can hide lines from keyboard/linearized users with no count or truncation semantics.
Fix: Define text commands/keys for expand, navigation, copy, counts, truncation, reading order, redaction, and redirected detail levels.
Sources: `accessibility A28`

**[F30] [State coverage]** Session navigation is named but not learnable — `EXPERIENCE.md 40–41,79–81,143–151; epics 101–109,341–352`
`/session` versus `/sessions`, duplicate names, missing Workspaces, and deletion-pending records lack canonical browser behavior.
Fix: Choose one command plus alias; define columns, sort/search, movement, confirmation, duplicate names, restore progress, and missing Workspace handling.
Sources: `terminal H-10`

**[F31] [Shape fit]** Specialist discovery risks implying capability parity — `DESIGN.md 141–145,203–208; EXPERIENCE.md 22–24,37–38,125–133; addendum 7–31`
Near-clone language and `/tools` catalog can imply unrestricted provider/tool extensibility despite four reviewed Release 1 integrations.
Fix: Distinguish working/catalogued/disabled/unconfigured/quarantined and repeat non-invokable boundaries in help, completion, tools, models, onboarding, and summaries.
Sources: `terminal H-11`

**[F32] [Shape fit]** First-run command surface is too broad — `EXPERIENCE.md 26–46,163–176; epics 52–59,304–306`
Flat completion exposes authority/context/rollback/tools/session terms before basic prompt flow is learned.
Fix: Add categorized completion, descriptions/examples, contextual ranking, help topics, and an essential first-run subset.
Sources: `terminal M-12`

**[F33] [State coverage]** Context and usage controls measure state without guiding action — `DESIGN.md 203–205; EXPERIENCE.md 135–141; epics 113–126`
`82%` or unavailable percentage gives no contributors or direct remedy after protected overflow.
Fix: Define ranked `/context` contributors and actions with consequences; keep `/usage` separate.
Sources: `terminal M-13`

**[F34] [State coverage]** Authority labels lack canonical compact wording — `DESIGN.md 196–207,215–222; EXPERIENCE.md 90–115; epics 46–59,321–323`
Narrow layouts may merge Full Access, transfer consent, Boundary Expansion, Workspace, and Work Mode into an ambiguous badge.
Fix: Provide canonical narrow/expanded labels and separate visible authority fields.
Sources: `terminal M-14`

**[F35] [State coverage]** Credential onboarding lacks discovery and recovery — `EXPERIENCE.md 28–35,193–204; epics 214–220,455–510`
A failed live check or replace/remove request can trap users without help, evidence, exit, or safe diagnostics.
Fix: Define onboarding help, inspect, retry, replace, remove, exit, and safe diagnostics; make offline limits explicit.
Sources: `terminal M-15`

**[F36] [State coverage]** Control-key precedence is undefined — `EXPERIENCE.md 163–176; epics 264–276`
Ctrl+C, Ctrl+D, and Esc can clear, cancel, terminate, dismiss, or orphan child work depending on lifecycle.
Fix: Publish stateful precedence, confirmation/announcement, empty/nonempty Ctrl+D, terminal restoration, cleanup, and race tests.
Sources: `accessibility A24`

**[F37] [State coverage]** Context provenance is not bound to authority decisions — `DESIGN.md 204,207–209; EXPERIENCE.md 135–141; epics 113–128,194–200`
Compaction or pin changes before dispatch can make approval refer to a different context than the one sent.
Fix: Bind approval/Evidence to final ContextManifest identity and invalidate on context/destination changes.
Sources: `control 13`

**[F38] [State coverage]** Completion language conflates round and operation outcomes — `DESIGN.md 208–209; EXPERIENCE.md 48–63,188–194,206–217; epics 8–17,63–77`
A local commit plus cancelled verification or unknown remote call can read as generic success.
Fix: Separate operation and Prompt Round status; reserve affirmative success for verified success and carry strongest unresolved state.
Sources: `control 14`

**[F39] [State coverage]** Dismissal can preserve dangerous pending state — `EXPERIENCE.md 69–84,163–176; DESIGN.md 200–202; epics 264–276`
Esc can dismiss an overlay while a prepared operation remains queued for later accidental or background authorization.
Fix: Make Esc non-authorizing; mark pending work dismissed or explicitly resumable, never auto-dispatch, and require re-review.
Sources: `control 15`

**[F40] [State coverage]** Boundary Expansion lifecycle is not discoverable — `EXPERIENCE.md 104–115,143–151; addendum 52–57,116–140; epics 42–58,97–110`
Durable authority can persist across sessions without inventory for resource, scope, expiry, provenance, revision, or revoke control.
Fix: Add inventory, grant preview, lifecycle/revalidation/revoke controls, affected-proposal coverage, and durable revocation events.
Sources: `control 16`

### Low (0)
None.
## Reviewer files
- `review-rubric.md`
- `review-accessibility.md`
- `review-terminal-usability.md`
- `review-control-trust.md`

## Reviewer synthesis
### Accessibility review
Slogans about text fallback, Thai preservation, and headless parity are not an accessible terminal product. The review’s release-blocking gaps in focus, stale approval, noninteractive behavior, live announcements, IME, widths, warnings, and secret handling are consolidated above.
Consolidated references: A11–A28 → F1–F5, F7, F9–F16, F22, F26–F29.

### Terminal usability review
Not implementation-ready for terminal interaction. Near-clone familiarity is directionally clear, but command grammar, composer, viewport, status priority, recovery navigation, narrow widths, and noninteractive behavior remain open.
Consolidated references: H-01–H-11 and M-12–M-16 → F5–F8, F13, F17, F30–F35.

### Control, trust, and authority review
Not release-grade as a human-control contract: users can lose sight of authority, approve a different dispatched effect, misunderstand remote outcomes, or fail to recover from races. The sensitive-data policy is a release blocker.
Consolidated references: Findings 1–17 → F2–F5, F18–F25, F37–F40.

## Mechanical notes
- Deduplicated severity totals: critical 4, high 24, medium 18, low 0.
- Category verdicts lift `review-rubric.md`; overlapping extra-reviewer findings are merged by failure scenario and cross-referenced.
- `DESIGN.md`, `EXPERIENCE.md`, and individual review files were not modified.
