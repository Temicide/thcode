# Spine Pair Review — thcode

## Overall verdict

The pair is a strong, source-grounded downstream contract for the primary terminal journeys, authority model, visual tokens, component behavior, and platform posture. It is not yet a clean release handoff: several source journeys are only embedded in other flows, state coverage is asserted generically rather than closed per IA surface, and cross-spine naming/traceability needs normalization. No critical token-definition or visual-reference failure was found.

## 1. Flow coverage — adequate

### Pass 1 — mechanical coverage

Extracted source journeys UJ-1 through UJ-7 and the source-defined canonical workflows from the PRD, addendum, and epics. EXPERIENCE.md provides five named-protagonist flows with numbered steps, climax beats, and failure paths: first conversation (lines 193–204), C++ proof (206–217), T-OCR consent (219–230), Session resume (232–241), and rollback (243–252). UJ-1, UJ-4, UJ-5, and UJ-7 are directly represented; UJ-2, UJ-3, and UJ-6 are not represented as dedicated Key Flows. UJ-6 is only nested inside Flow 4's failure/step treatment, and UJ-1's later slash-command/catalog exploration is not landed in a climax-bearing flow.

### Pass 2 — adequate

The five supplied flows are usable, but consumers cannot map every source UJ to one canonical journey without inference.

### Findings

- **high** UJ-2 (catalog exploration), UJ-3 (unhealthy specialist recovery), and UJ-6 (interrupted remote request) lack dedicated Key Flows with explicit source names, complete numbered journeys, climax beats, and independently checkable failure paths (EXPERIENCE.md §§Key Flows, lines 191–252; source extract `.working/source-extract-prd.md` UJ-2/UJ-3/UJ-6). *Fix:* add one Key Flow per omitted UJ, or explicitly map each source UJ to a named flow and make its climax/failure path independently auditable.

## 2. Token completeness — adequate

### Pass 1 — mechanical coverage

Extracted all DESIGN.md YAML tokens and prose references. The color values are hex strings; typography, rounded, spacing, and component objects conform to the design-md-spec shape. Component token references resolve to defined `colors`, `rounded`, and `spacing` paths. EXPERIENCE.md references `{components.shell}`, `{components.status-bar}`, `{components.prompt-composer}`, and `{colors.ink-primary}`, all of which resolve in DESIGN.md. No critical missing-hex color token was found.

### Pass 2 — adequate

The token inventory is complete enough to mirror downstream, but the contract leaves contrast validation qualitative rather than measurable.

### Findings

- **medium** DESIGN.md describes legibility and color-limited fallback but states no explicit contrast target for load-bearing combinations such as primary ink/surface, secondary ink/surface, focus outline/surface, or status colors (DESIGN.md §§Colors and Do's and Don'ts, lines 149–160 and 211–223). *Fix:* state the applicable contrast target or terminal-specific validation rule for each load-bearing combination, while retaining the semantic fallback rules.

## 3. Component coverage — adequate

### Pass 1 — mechanical coverage

The 14 named frontmatter components have visual rows in DESIGN.md §Components (lines 194–209) and behavioral rows in EXPERIENCE.md §Component Patterns (lines 65–84): shell, status-bar, prompt-composer, transcript, activity-log, approval-dialog, evidence-panel, specialist-card, context-donut, session-browser, rollback-panel, command-completion, credential-form, and completion-summary. Each row contains more than a one-word description and the visual/behavioral split is explicit.

### Pass 2 — adequate

Coverage is broad and useful, but name identity is not fully normalized across the two documents.

### Findings

- **medium** Component labels vary between DESIGN.md prose and EXPERIENCE.md/frontmatter (`Status bar` vs `status-bar`, `Prompt composer` vs `prompt-composer`, `Context Donut` vs `context-donut`, and similar capitalization changes), while the rubric requires identical component names across both spines (DESIGN.md §Components, lines 196–209; EXPERIENCE.md §Component Patterns, lines 69–84). *Fix:* choose one canonical identifier for each component and use it in frontmatter, prose, tables, and downstream references; human-readable labels can be supplied separately.

## 4. State coverage — thin

### Pass 1 — mechanical coverage

The State Patterns table covers provider/service health, catalog, authority, operation lifecycle, remote interruption, context, sessions/recovery, rollback, and input/focus (EXPERIENCE.md lines 86–102). The IA lists 17 surfaces, including startup/preflight, onboarding, main conversation, `/models`, `/tools`, `/check`, sessions, context, usage, rollback, and recovery (lines 26–46). The document then requires generic empty/cold-load/loading/success/error/cancelled/denied/unavailable/unknown/narrow forms “where the state applies,” but does not enumerate or verify those states per surface. Startup/preflight, Typhoon onboarding, `/models`, `/check`, `/usage`, and several recovery/management surfaces have no surface-specific state rows or complete state paths.

### Pass 2 — thin

The state vocabulary is strong, but the generic assertion is not a downstream closure contract: an implementer still has to infer which state applies to which surface and what action/next step each one exposes.

### Findings

- **high** The IA surface set is not mechanically closed against state treatments; the contract does not give per-surface cold-load/loading/empty/success/error/cancelled/denied/unavailable/unknown/narrow behavior for startup/preflight, credential onboarding, `/models`, `/check`, `/usage`, `/context`, and recovery/management surfaces (EXPERIENCE.md §§Information Architecture and State Patterns, lines 26–46 and 86–102). *Fix:* add a surface-by-state matrix or explicit state rows for every applicable IA surface, including stable copy, action, and next step.

## 5. Visual reference coverage — strong

### Pass 1 — mechanical coverage

The workspace contains no `mockups/`, `wireframes/`, or `imports/` files. Both spines explicitly record that fast path produced no creative-tool artifacts or mockups (DESIGN.md lines 145–147; EXPERIENCE.md lines 12–14). There are therefore no orphaned visual references or unlinked artifacts.

### Pass 2 — strong

No visual-reference gap exists for this fast-path run. The explicit no-artifact decision is clear and does not pretend that a visual reference exists.

## 6. Bloat & overspecification — thin

### Pass 1 — mechanical coverage

The pair contains repeated source/architecture constraints: CoreProtocolV1 boundaries, PEP authority, durable event semantics, encryption/credential rules, platform limitations, and detailed rollback mechanics appear in both the source extracts and the spines (EXPERIENCE.md §§Foundation, Component Patterns, Evidence & Observability, Context & Usage, Sessions & Continuity, and Rollback & Recovery; DESIGN.md §§Brand & Style, Components, and Do's and Don'ts).

### Pass 2 — thin

The repetition improves safety for high-consequence behavior, but EXPERIENCE.md frequently reads as an architecture contract rather than an experience contract. This increases extraction cost and makes unresolved UX decisions harder to distinguish from implementation invariants.

### Findings

- **medium** EXPERIENCE.md restates implementation-level protocol and persistence detail that downstream UX consumers do not need in every behavioral section, including CoreProtocol operations, durable event semantics, and encryption/storage mechanics (EXPERIENCE.md lines 18–24, 117–123, 137–151, and 153–161). *Fix:* retain the user-visible invariant and cross-reference the authoritative architecture source for mechanism-level detail; keep only behavior, state, disclosure, and recovery consequences in the experience spine.

## 7. Inheritance discipline — adequate

### Pass 1 — mechanical coverage

DESIGN.md and EXPERIENCE.md `sources:` paths resolve from the UX workspace to the PRD, addendum, epics, and architecture spine. Source terminology such as Active Model Context, Active Context Utilization, Cumulative Token Usage, Boundary Expansions, Runtime Activation, Evidence, Service Configuration, and unknown-outcome is carried into the spines. EXPERIENCE.md token references resolve to DESIGN.md. No mockup/import references require resolution.

### Pass 2 — adequate

The source inheritance is generally disciplined, but traceability and naming are weaker than the content quality.

### Findings

- **medium** Key Flow headings use local names (“trusted first conversation,” “canonical C++ Hello World proof,” etc.) without preserving the source UJ identifiers, so a downstream consumer cannot mechanically prove UJ/flow correspondence; the same issue compounds the omitted dedicated UJ-2/UJ-3/UJ-6 flows (EXPERIENCE.md lines 193, 206, 219, 232, 243; source PRD UJ headings). *Fix:* include the verbatim source identifier in each heading or add an explicit source-to-flow mapping table.

## 8. Shape fit — strong

### Pass 1 — mechanical coverage

DESIGN.md sections appear in canonical order: Brand & Style, Colors, Typography, Layout & Spacing, Elevation & Depth, Shapes, Components, Do's and Don'ts (lines 139–223). EXPERIENCE.md includes all required defaults: Foundation, Information Architecture, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, and Key Flows (lines 16–252). Inspiration & Anti-patterns and Responsive & Platform are present and justified by the source reference products and multi-platform/terminal output modes (lines 254–280).

### Pass 2 — strong

The pair fits the required spine shapes. Invented sections (Authority & Control, Evidence & Observability, Specialists & Service Routing, Context & Usage, Sessions & Continuity, Rollback & Recovery) carry clear product-specific downstream value and are not dropped defaults.

## Mechanical notes

- DESIGN.md and EXPERIENCE.md remain unmodified by this review.
- Frontmatter status is `draft` in both spines; updated date is `2026-07-17`.
- No critical missing-hex token, broken EXPERIENCE.md token reference, broken source path, Mermaid block, mockup/import link, or visual-reference orphan was found.
- The pair consistently states that the spines win on conflict with mockups/imports and that no mockups were produced in fast path.
- Severity counts: **critical 0, high 2, medium 4, low 0**.
