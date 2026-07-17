---
name: thcode
description: Terminal-first visual identity for a legible, locally governed Thai-model CLI agent.
status: final
sources:
  - ../../prds/prd-thcode-2026-07-14/prd.md
  - ../../prds/prd-thcode-2026-07-14/addendum.md
  - ../../epics.md
  - ../../architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md
updated: 2026-07-17
colors:
  surface-base: '#101214'
  surface-raised: '#171A1E'
  surface-overlay: '#20252B'
  ink-primary: '#F1F3F5'
  ink-secondary: '#AEB6BF'
  ink-muted: '#78818B'
  ink-disabled: '#555E67'
  accent: '#D6A85C'
  accent-foreground: '#17120A'
  info: '#79B8FF'
  success: '#7FD39A'
  warning: '#E8B86A'
  danger: '#F28B82'
  outline: '#39414A'
  outline-focus: '#D6A85C'
  surface-base-light: '#F7F8F9'
  surface-raised-light: '#FFFFFF'
  surface-overlay-light: '#EEF1F3'
  ink-primary-light: '#171A1E'
  ink-secondary-light: '#4F5963'
  ink-muted-light: '#68737D'
  outline-light: '#68737D'
  accent-light: '#7A4F16'
  accent-foreground-light: '#FFFFFF'
  outline-focus-light: '#7A4F16'
  info-light: '#005EA8'
  success-light: '#1B6E3C'
  warning-light: '#7A4F00'
  danger-light: '#B42318'
typography:
  prompt:
    fontFamily: 'Terminal monospace'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.45'
  body:
    fontFamily: 'Terminal monospace'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  label:
    fontFamily: 'Terminal monospace'
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.02em
  meta:
    fontFamily: 'Terminal monospace'
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.3'
  code:
    fontFamily: 'Terminal monospace'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.35'
rounded:
  sm: 2px
  md: 4px
  lg: 6px
  full: 9999px
  DEFAULT: 2px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  gutter: 2ch
  row: 1lh
  section: 2lh
components:
  shell:
    background: '{colors.surface-base}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-base-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    padding: '{spacing.gutter}'
  status-bar:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-raised-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    info: '{colors.info}'
    success: '{colors.success}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    info-light: '{colors.info-light}'
    success-light: '{colors.success-light}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
    height: '{spacing.row}'
  prompt-composer:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-raised-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    radius: '{rounded.sm}'
  transcript:
    background: '{colors.surface-base}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-base-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
  activity-log:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink-secondary}'
    secondary: '{colors.ink-muted}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-raised-light}'
    foreground-light: '{colors.ink-secondary-light}'
    secondary-light: '{colors.ink-muted-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
  approval-dialog:
    background: '{colors.surface-overlay}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-overlay-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
    radius: '{rounded.md}'
  transfer-consent-dialog:
    background: '{colors.surface-overlay}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-overlay-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    info: '{colors.info}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    info-light: '{colors.info-light}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
    radius: '{rounded.md}'
  evidence-panel:
    background: '{colors.surface-overlay}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-overlay-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    info: '{colors.info}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    info-light: '{colors.info-light}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
  specialist-card:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-raised-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    info: '{colors.info}'
    info-light: '{colors.info-light}'
    success: '{colors.success}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    success-light: '{colors.success-light}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
  context-donut:
    background: '{colors.surface-raised}'
    foreground: '{colors.accent}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    info: '{colors.info}'
    success: '{colors.success}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    background-light: '{colors.surface-raised-light}'
    foreground-light: '{colors.accent-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    info-light: '{colors.info-light}'
    success-light: '{colors.success-light}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
  session-browser:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-raised-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
  rollback-panel:
    background: '{colors.surface-overlay}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-overlay-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
  command-completion:
    background: '{colors.surface-overlay}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    active: '{colors.accent}'
    background-light: '{colors.surface-overlay-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    active-light: '{colors.accent-light}'
  credential-form:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-raised-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
  completion-summary:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-raised-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    info: '{colors.info}'
    success: '{colors.success}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    partial: '{colors.warning}'
    info-light: '{colors.info-light}'
    success-light: '{colors.success-light}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
    partial-light: '{colors.warning-light}'
  warning-index:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-raised-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    info: '{colors.info}'
    success: '{colors.success}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    info-light: '{colors.info-light}'
    success-light: '{colors.success-light}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
  recovery-center:
    background: '{colors.surface-overlay}'
    foreground: '{colors.ink-primary}'
    secondary: '{colors.ink-secondary}'
    border: '{colors.outline}'
    focus: '{colors.outline-focus}'
    background-light: '{colors.surface-overlay-light}'
    foreground-light: '{colors.ink-primary-light}'
    secondary-light: '{colors.ink-secondary-light}'
    border-light: '{colors.outline-light}'
    focus-light: '{colors.outline-focus-light}'
    info: '{colors.info}'
    success: '{colors.success}'
    warning: '{colors.warning}'
    danger: '{colors.danger}'
    recovery: '{colors.info}'
    info-light: '{colors.info-light}'
    success-light: '{colors.success-light}'
    warning-light: '{colors.warning-light}'
    danger-light: '{colors.danger-light}'
    recovery-light: '{colors.info-light}'
---

## Brand & Style

thcode is a serious terminal tool with a curious, Thai-first spirit: familiar enough to feel like a trusted CLI, polished enough for a commercial external-user product, and explicit enough that users can tell what happened. The visual posture is **legibility under consequence**: terminal rhythm, compact rows, durable text, progressive disclosure, and a quiet accent over decorative chrome.

The explicit direction is a near-clone of Claude Code CLI in control model, layout rhythm, prompts, and TUI familiarity, branded as thcode. This is a control and visual-rhythm reference, not a provider, model, capability, or implementation-equivalence claim. Release 1 has Typhoon reasoning and four reviewed AI-for-Thai Specialist Services only; a `Catalogued — Not available yet` item is not an implied extension point.

[ASSUMPTION] The dark palette is the default because the primary surface is a local terminal. Light tokens support configured terminal themes; exact theme inheritance remains runtime-owned.

The spines win on conflict with mockups or imports. Fast path produces no creative-tool artifacts or mockups.

## Colors

Color is a supporting signal, never the sole carrier of status. Every consequential state also receives a canonical text token, position, shape, or explicit verb.

- **Surfaces** `{colors.surface-base}`, `{colors.surface-raised}`, and `{colors.surface-overlay}` create shell, persistent status/composer, and focused inspection layers. They are structural, not decorative cards.
- **Ink** `{colors.ink-primary}` and `{colors.ink-secondary}` preserve commands, paths, service names, identifiers, and Thai explanations. `{colors.ink-muted}` is non-authoritative metadata only; disabled text is never the sole state signal.
- **Accent** `{colors.accent}` marks focus, active completion, or selected control. It never means permission, success, availability, or consent.
- **State colors** `{colors.info}`, `{colors.success}`, `{colors.warning}`, and `{colors.danger}` emphasize labeled states on dark surfaces. Light surfaces use only `{colors.info-light}`, `{colors.success-light}`, `{colors.warning-light}`, and `{colors.danger-light}` for the same semantic roles; dark semantic tokens never render on light surfaces.
- **Outlines** `{colors.outline}` and `{colors.outline-focus}` define dark-theme boundaries and focus. Light themes use `{colors.accent-light}` for selected/active emphasis and `{colors.outline-focus-light}` for focus, with explicit light mappings in `status-bar`, `prompt-composer`, `approval-dialog`, `transfer-consent-dialog`, `context-donut`, `command-completion`, `credential-form`, and `warning-index`.

### Terminal acceptance targets

Where the terminal supports measurable color, primary ink on base/raised/overlay and all body state labels target at least 4.5:1 contrast; large labels target 3:1. Focus outline and selected-row treatment target at least 3:1 against adjacent surfaces and must also add a two-cell/text-label distinction. The light focus/active amber-brown `{colors.outline-focus-light}` / `{colors.accent-light}` (`#7A4F16`) measures 6.68:1 against `{colors.surface-base-light}` (`#F7F8F9`) and 7.10:1 against `{colors.surface-raised-light}` (`#FFFFFF`). Light semantic tokens measure above 5.9:1 on both light backgrounds: info 6.24/6.63, success 5.91/6.28, warning 6.70/7.13, danger 6.18/6.57. State colors are never accepted without their canonical text. Fixtures cover truecolor, 256-color, 16-color, monochrome, inverted, and invisible-color modes at 40/60/80/120 columns. If color cannot meet the target, the renderer falls back to canonical labels and ordering rather than remapping meaning.

Theme mapping is deterministic: dark fields are used only on dark surfaces; `*-light` fields are used only on light surfaces. There is no implicit substitution between themes, and a missing theme field is a contract failure. Avoid gradients, decorative chroma, color-only severity, filled status pills that hide meaning, and red-only error language. Never use accent to imply authorization or verified remote success.

## Typography

[ASSUMPTION] Terminal monospace is the default semantic role so exact identifiers, commands, paths, hashes, and mixed Thai/English remain aligned and copyable. The runtime honors the host's readable monospace face rather than forcing a bundled font.

- `prompt` `{typography.prompt}` is conversational/composer rhythm.
- `body` `{typography.body}` is transcript, explanation, approval purpose, and result summary.
- `label` `{typography.label}` is stable state names, action classes, and headings.
- `meta` `{typography.meta}` is safe fingerprints, correlation IDs, timestamps, and non-authoritative timing.
- `code` `{typography.code}` preserves exact executable/argv/cwd, target paths, endpoint hosts, reason codes, and technical output.

Technical tokens are atomic spans for wrapping or have an explicit expanded inspection view. Visual wrapping never inserts bytes into copy/export. Thai prose may explain a state, but canonical labels and exact identifiers remain verbatim.

## Layout & Spacing

The layout follows CLI rhythm: one primary vertical conversation stream, persistent status and warning projection, compact grouped activity, and in-place overlays only for bounded decisions. `{spacing.row}` is the baseline dense row, `{spacing.section}` separates durable groups, and `{spacing.gutter}` protects terminal edges.

Width tiers are behavioral contracts: 40 columns is the minimum supported one-column text tier; 60 stacks compact status; 80 restores ordinary grouping; 120 permits expanded identity/detail columns. Below 40, the shell switches to command-oriented text mode and never clips authority, risk, outcome, or next step. Composer and focused action remain reachable at every tier. The Context Donut becomes labeled text when space or color is insufficient.

Persistent layout order is status-bar → warning-index → transcript/activity → focused overlay/result → prompt-composer. Overlay precedence is positional and textual, not shadow-driven. Streaming auto-follows until the user scrolls; an explicit new-output/jump control restores the live boundary.

## Elevation & Depth

Depth is tonal and positional, not glossy. `{colors.surface-raised}` separates status/composer/activity from `{colors.surface-base}`; `{colors.surface-overlay}` marks approval, consent, Evidence, recovery, or rollback inspection. `{colors.outline}` supplies boundaries instead of shadows.

[ASSUMPTION] Shadows are unavailable or unreliable in terminal rendering and are not a primary hierarchy device. Focus, selection, modal state, and warning priority use tone, outline, heading, stable placement, and canonical text.

Motion is optional and nonsemantic. Reduced-motion renders static checking/progress and one transition line; no blink or spinner is required, and redraw never erases durable facts.

## Shapes

Use `{rounded.sm}` for fields and row focus, `{rounded.md}` for approval/consent/inspection overlays, `{rounded.lg}` only for a larger bounded surface when the terminal preserves it, and `{rounded.full}` only for a small semantic marker. Shapes never replace labels.

Avoid card-heavy dashboards, pill-only vocabularies, ornamental borders, and rounded containers that consume scarce columns.

## Components

Component identifiers are canonical lowercase kebab-case and match EXPERIENCE.md exactly.

- **`shell`** — Terminal canvas and primary stream. Uses `{components.shell}`. Reading order is status, warning-index, transcript/activity, current decision/result, composer. It remains legible without color and in redirected/headless modes.
- **`status-bar`** — Persistent authority and health projection. Uses `{components.status-bar}`. Expanded fields are Workspace, Runtime Activation, Work Mode, Permission Profile, Full Access, Boundary Expansions, transfer consent, enforcement, Typhoon/service health, context, and unresolved outcome.
- **`prompt-composer`** — Focused prompt input. Uses `{components.prompt-composer}` and `{typography.prompt}`. Cursor/focus never displaces Thai preedit, graphemes, multiline text, or technical-token integrity.
- **`transcript`** — Durable conversation stream. Uses `{components.transcript}`. Typhoon explanation, Specialist Service output, deterministic Evidence, progress, and `Chat interrupted` are headed separately.
- **`activity-log`** — Compact grouped record of every proposed/executed call, including auto-permitted list/read/search. Uses `{components.activity-log}`. Full inspection, count, state, timing, provenance, and safe target remain available.
- **`approval-dialog`** — Local effect decision. Uses `{components.approval-dialog}`. Purpose/risk precedes exact identity; safe initial focus is Review/Cancel, never Approve; stale state is visibly non-committing.
- **`transfer-consent-dialog`** — Remote transfer decision. Uses `{components.transfer-consent-dialog}`. Recipient, endpoint, payload summary, classification, retention, transformation, call count, expiry, and digests are visible before independent consent.
- **`evidence-panel`** — Deterministic inspection. Uses `{components.evidence-panel}`. Completeness/provenance, omissions, observation/display time, hashes, and model explanation separation are visually explicit.
- **`specialist-card`** — Metadata-driven service summary. Uses `{components.specialist-card}`. It distinguishes `working`, `Catalogued — Not available yet`, `disabled`, `unconfigured`, `unhealthy`, and `quarantined`; `Catalogued — Not available yet` is visibly non-invokable.
- **`context-donut`** — Utilization indicator. Uses `{components.context-donut}` with percentage and text severity; narrow/unknown output uses `percentage unavailable` and categorized tokens.
- **`session-browser`** — Saved Session list/inspection. Uses `{components.session-browser}`. Rows show name, stable ID, Workspace state, model, Work Mode, context, lifecycle, and safe timestamps.
- **`rollback-panel`** — Checkpoint preview/outcome. Uses `{components.rollback-panel}`. It shows coverage, exclusions, retention, conflicts, three-way inspection, and per-target outcomes without implying whole-round reversal.
- **`command-completion`** — Slash discovery. Uses `{components.command-completion}`. Active rows use accent plus `selected, n of m`; loading, empty, unavailable, cancelled, and narrow forms are explicit.
- **`credential-form`** — Protected onboarding form. Uses `{components.credential-form}`. Provider, verified host, storage, and purpose precede masked input; no value appears in UI, accessibility, logs, snapshots, clipboard, scrollback, or headless output.
- **`completion-summary`** — Post-commit result. Uses `{components.completion-summary}`. Operation status and Prompt Round status are separate; strongest unresolved state leads.
- **`warning-index`** — Stable warning list. Uses `{components.warning-index}`. It shows priority, token, count, acknowledgement, inspect action, and deterministic traversal without hiding concurrent warnings.
- **`recovery-center`** — Unified recovery surface. Uses `{components.recovery-center}`. Inspect, reconcile, reprompt, retry-disabled, export-safe Evidence, and exit actions are visibly bounded.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep status, risk, action, Evidence, and outcome legible in text | Depend on color, icons, animation, or a single badge |
| Follow familiar Claude Code CLI-like rhythm while retaining thcode terminology | Claim provider, model, or capability parity |
| Show purpose/risk before exact authoritative details | Put raw commands, payloads, or sensitive details in first glance |
| Preserve exact Thai, commands, paths, IDs, hashes, and service names | Split, normalize, or truncate technical tokens without an expanded view |
| Separate deterministic Evidence, completeness, and model explanation | Let model prose overwrite failure categories or fill missing proof |
| Keep Full Access, transfer consent, Boundary Expansion, and Workspace distinct | Collapse authority into one permission color or badge |
| Compose simultaneous warnings with stable priority and `+N warnings` | Let a new warning overwrite an older unknown/conflict/authority warning |
| Use static progress, reduced motion, and linearized durable output | Make a spinner or redraw the semantic source |
| Show `DESTRUCTIVE`, `UNKNOWN OUTCOME`, `FULL ACCESS`, and `ENFORCEMENT UNVERIFIED` in every output mode | Assume a color-rich, wide, interactive terminal |
| Use text fallback for Context Donut and redirected output | Invent endpoint values, budgets, platform enforcement, release pins, or security channels |
| Keep `Catalogued — Not available yet` capabilities visibly non-invokable | Imply unrestricted provider/tool extensibility |
| Keep rollback conflict-safe and explicit | Offer generic overwrite, continue, or blind retry |
