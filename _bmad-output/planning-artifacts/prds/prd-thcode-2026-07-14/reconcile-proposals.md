# Input Reconciliation: `docs/proposal-discovery/`

## Scope and precedence

This report compares every Markdown file in `docs/proposal-discovery/` with the current `prd.md` and `addendum.md`:

- `README.md`
- `access-validation-plan.md`
- `competitive-landscape.md`
- `delivery-plan.md`
- `differentiation-options.md`
- `domain-model.md`
- `glossary.md`
- `model-capabilities.md`
- `opencode-comparison.md`
- `prototype-demo.md`
- `terminal-interface.md`

Later user decisions and accepted ADR precedence are authoritative. Competition-only schedules, superseded Windows-only scope, hosted first-release request paths, multiple launch reasoning models, Git status/diff requirements, and broad novelty or productivity claims are therefore not treated as gaps merely because they appeared in proposal discovery.

## Verdict

**Substantially reconciled, with four material gaps or unresolved dispositions.** The PRD accurately carries forward the local agent-loop boundary, local credential isolation, Thai/code-switched interaction, prompt-first specialist routing, four-service launch scope, safe tool authority, Windows and macOS npm distribution, sessions, context governance, recovery, rollback, and honest positioning. The addendum appropriately retains the major architecture mechanisms and defers the hosted Docker boundary.

The remaining material issues are not broad missing scope. They concern strategic continuity, the exact Thai-model adaptation contract, release demonstration evidence, and a source-derived caching commitment.

## Material gaps

### G-1 — Accepted long-term product ladder is absent

**Source:** `README.md` (“Accepted product ladder”) states that the long-term vision is a Thai-first general-purpose agent for building applications, understanding images, and completing computer-based work through natural Thai instructions, with the developer CLI as the first wedge and its harness as a foundation for future clients.

**Current artifact:** The PRD correctly narrows the first release to a curiosity-driven developer CLI and lists nontechnical/general computer-use users as non-users. It does not preserve the accepted long-term direction anywhere in the vision, roadmap context, or addendum.

**Why it matters:** This is qualitative product direction rather than a first-release requirement. Omitting it makes the release boundary clear, but loses the reason the local harness, multimodal artifacts, permissions, and reusable headless core are being built as a platform-shaped foundation.

**Recommended disposition:** Preserve one clearly non-binding paragraph in the PRD vision or addendum: the first-release CLI is the wedge toward a possible broader Thai-first agent, while desktop computer use, no-code building, and non-developer surfaces remain outside this PRD. If that direction is no longer wanted, explicitly mark the proposal statement superseded.

### G-2 — Structured-action repair behavior is neither required nor rejected

**Sources:** `differentiation-options.md`, `competitive-landscape.md`, `opencode-comparison.md`, and `README.md` present a Thai Agent Compatibility Layer whose core behavior includes converting or repairing imperfect Thai-model output into typed local tool calls, then validating, retrying, or rejecting invalid tool names, arguments, paths, schemas, and policy violations. `access-validation-plan.md` calls for measuring invalid JSON, invalid tool names, argument errors, and retry behavior.

**Current artifact:** FR-5 covers normalized intent and material ambiguity; FR-6 validates Typhoon proposals; FR-13/14 minimize relevant tool schemas; FR-15 normalizes artifact evidence; FR-29/31 govern context. The addendum also preserves structured validation. Neither artifact defines whether malformed-but-unambiguous Typhoon tool output may be deterministically repaired or re-prompted, which fields may be repaired, how many retries are allowed, how repair remains inspectable, or whether the feature is intentionally excluded. The rejection of **silent protocol repair** concerns service configuration and must not be assumed to settle model-output repair.

**Why it matters:** This was the proposal's main answer to “why thcode instead of a generic harness with Typhoon,” and it is especially relevant to the admitted limitations of current Thai models. Validation alone safely rejects bad actions but does not define the compatibility behavior the source repeatedly proposed.

**Recommended disposition:** Either add a capability-level requirement for bounded, inspectable structured-action recovery (deterministic normalization where semantics are unchanged; otherwise a model re-prompt or user clarification; never policy relaxation), or explicitly reject/defer action repair and narrow the differentiation claim accordingly. Exact parser and retry algorithms belong in architecture.

### G-3 — Exact disposition of the accepted independent demo portfolio is unclear

**Sources:** `README.md` and `prototype-demo.md` accept three independent, detailed service demonstrations:

1. Speech-to-Text converts a Thai audio request into a tested Express `GET /info` endpoint.
2. Extract Address converts a synthetic Thai address fixture into a typed Next.js `/address-preview` page with a passing production build.
3. T-OCR supports the existing-repository landing-page/logo task.

Named Entity Recognition was required to pass a live contract test but not a public demo. The documents contain detailed privacy, fixture isolation, Plan/Build, provenance, and acceptance criteria for each scenario.

**Current artifact:** The later user-approved primary journey replaces the headline coding proof with the bounded C++ `Hello, World!` loop, and SM-2 strengthens service evidence to require all four integrations to pass a live contract test plus at least one prompt-driven end-to-end flow. However, neither the PRD nor addendum says whether the three source demonstrations remain first-release fixtures, are replaced by simpler four-service flows, or are discarded as stale competition work. Their exact acceptance criteria are not retained.

**Why it matters:** The high-level success target is stronger in breadth but weaker in reproducibility. Engineering and QA cannot infer whether the old repository-changing scenarios are mandatory, and the curiosity-focused positioning may intentionally make them too ambitious. This needs an explicit disposition, not silent omission.

**Recommended disposition:** Decide one of the following before release-test planning: (a) retain the three detailed scenarios as normative release fixtures and add a fourth NER flow; (b) retain them as optional demonstration assets while defining smaller normative end-to-end fixtures for all four services; or (c) mark the competition portfolio superseded by the C++ proof plus new service-only journeys. Keep detailed fixture mechanics in a QA/demo addendum rather than expanding the PRD narrative.

### G-4 — Content-hash evidence caching was downgraded from required to optional

**Sources:** `README.md`, `model-capabilities.md`, `differentiation-options.md`, `delivery-plan.md`, and `prototype-demo.md` repeatedly require hashing an artifact and caching derived evidence so an unchanged file is processed once. The rationale includes quota protection, consistent provenance, context efficiency, and avoiding unnecessary repeat transfer.

**Current artifact:** FR-17 says derived Evidence **may** be cached by source-content hash. The addendum mentions context and evidence mechanics but does not restore this as a committed behavior.

**Why it matters:** For user-supplied API keys and potentially low AI-for-Thai quotas, optional caching weakens a concrete accepted behavior and can cause repeat transfers or charges for unchanged artifacts. Caching also affects privacy and retention, which must be coordinated with the deferred sensitive-data policy.

**Recommended disposition:** Make content-hash deduplication a first-release outcome for unchanged inputs, subject to an explicit freshness/re-run control and the final sensitive-data retention policy. If caching is intentionally postponed, mark the older accepted statements superseded and retain only attributable hashing.

## Non-blocking handoff details

These source details are largely represented at the correct abstraction level, but should be preserved in downstream UX, architecture, or QA work rather than silently lost:

- `terminal-interface.md` specifies the exact `/session` command hierarchy, `/session info` fields, session-browser filters and key bindings, Full Access warning view, and narrow-terminal context states. FR-26, FR-30, FR-36, and FR-37 cover the product outcomes but not all interaction details. These belong in the UX specification.
- `prototype-demo.md` contains useful scenario-level privacy rules: synthetic address fixtures, no transfer before destination-specific consent, preservation of missing/uncertain fields, independent clean fixtures, and credential-free evidence reports. The PRD provides the general requirements, while QA should retain the concrete fixtures if their scenarios survive G-3.
- `model-capabilities.md` lists endpoint-level modality, quota, format, latency, response-schema, licensing, and retention validation. FR-4, FR-13, FR-15, and the deferred sensitive-data policy cover the need, but the actual per-service contract checklist belongs in release validation.
- `opencode-comparison.md` defines a 20-task same-model/same-tools benchmark. Because the current PRD makes no superiority claim and explicitly forbids one without substantiation, the benchmark is conditional evidence rather than a release requirement. It should be revived only if comparative marketing claims are planned.

## Correctly reconciled or superseded source material

### `README.md`

**Carried forward:** local CLI ownership of the agent loop and local authority; distinct Typhoon and AI-for-Thai credentials; explicit artifact handling; CLI/TUI form factor; Plan/Build and Permission Profile orthogonality; Saved Sessions; context meter and compaction; dependency guidance; four-service catalog scope; defensive novelty language; npm/Node/TypeScript/Ink baseline in the addendum.

**Later-authoritative changes correctly applied:** Windows plus macOS first release, Typhoon only, `/models` inspection-only, C++ proof as the headline local-agent task, no Git status/diff requirement, direct local AI-for-Thai calls, and curiosity/technical-feasibility positioning.

**Not yet preserved:** the accepted long-term product ladder (G-1) and exact demo-portfolio disposition (G-3).

### `access-validation-plan.md`

**Carried forward:** Typhoon as the required primary path, separate API-key setup, live connectivity/contract checks, operational evidence before claims, and a complete reasoning → specialist-service → local action → evidence loop.

**Correctly superseded:** “keep the Typhoon key server-side and out of the downloadable CLI” conflicts with the later local-BYOK ADR and user decision; the PRD correctly stores and uses it locally. Typhoon OCR as a temporary fallback and optional Pathumma/THaLLE adapters are not first-release commitments. Selecting only one AI-for-Thai endpoint was superseded by the confirmed four-service launch scope.

**Remaining issue:** invalid structured-call and retry validation feeds G-2.

### `competitive-landscape.md`

**Carried forward:** no “first Thai CLI agent,” tool-use impossibility, or unsupported superiority claims; dynamic relevant-schema exposure; Thai interaction; distributed safety; reproducible evidence; and explicit OpenCode claim restraint.

**Correctly narrowed:** hosted AI-for-Thai-native composition is absent from the launch path, and the PRD promises a production-quality harness rather than coding competitiveness.

**Remaining issue:** the proposed compatibility-layer action recovery component is not dispositioned (G-2). The exact OpenCode benchmark is conditional rather than missing because no comparative claim is made.

### `delivery-plan.md`

**Carried forward:** npm packaging, Node.js baselines, headless TypeScript core with Ink presentation, clean-machine evidence, explicit prerequisite guidance, and risk tied to passing checks rather than elapsed coding time.

**Correctly superseded or deferred:** application/finalist dates, Windows-only competition execution, a one-to-two-day spike, Dockerized hosted API, hosted load tests/API documentation, and macOS as later roadmap work. The addendum properly preserves Docker/API/load-testing work only for a future hosted boundary.

**Remaining issue:** accepted hash-based artifact reuse is optional in the PRD (G-4).

### `differentiation-options.md`

**Carried forward:** Thai/code-switched intent, material ambiguity handling, task-relevant schema exposure, type-specific artifact conversion, structured validation, context governance, Thai trust explanations, and honest comparative claims.

**Correctly narrowed:** the public release is not positioned as a hosted Artifact Intelligence API or as demonstrably better than generic agents. Thailand-specific application rules remain contextual rather than fabricated automatic behavior.

**Remaining issue:** structured-action repair/re-prompt semantics are absent (G-2), and the future general-purpose product direction is not preserved (G-1).

### `domain-model.md`

**Carried forward:** Workspace, Agent Loop, model/provider boundary, Capability Registry, Specialist Service, tool calls, policy, Evidence, explicit artifact resolution, evaluation evidence, and the invariant that remote components cannot execute local actions.

**Correctly superseded:** the first release has no onboarded Dockerized service or server sub-loop. Multiple reasoning model adapters and competition actors are not launch product requirements.

**No additional material gap found.** Domain-model implementation detail can be regenerated downstream from the PRD and addendum.

### `glossary.md`

**Carried forward:** the key product vocabulary is normalized in the PRD, including Agent Loop, Capability Registry, local BYOK boundaries, Specialist Services, Evidence, Work Mode, Permission Profile, and Saved Session/context distinctions.

**Correctly superseded:** hosted reasoning turns, server tools/sub-loops, multiple reasoning models, competition MVP terminology, and unresolved “alternative to Codex” wording do not belong in the current first-release glossary.

**No additional material gap found.** The catalogued/integrated/verified/demo-certified evidence taxonomy is represented functionally through FR-13 and SM-2, although QA may choose to preserve the four explicit labels.

### `model-capabilities.md`

**Carried forward:** Typhoon-only launch selection, `/models` separated from `/tools`, endpoint-specific modality proof, specialist-service routing for text-only reasoning, service capability metadata, and explicit format/quota/schema/data-term validation.

**Correctly superseded:** Pathumma, THaLLE, Typhoon OCR, native-vision ensemble routing, and multi-model selection are not first-release requirements.

**Remaining issue:** mandatory unchanged-artifact cache reuse became optional (G-4).

### `opencode-comparison.md`

**Carried forward:** terminal/repository primitives are not claimed as unique; PRD differentiation emphasizes Thai intent, bounded routing, artifact evidence, validation, context governance, and transparent limits. SM-C4 prevents unsupported superiority claims.

**Correctly conditional:** the 20-task benchmark is not required unless thcode intends to claim materially better outcomes than OpenCode. The addendum preserves fair same-model/same-tool evaluation mechanics.

**Remaining issue:** the treatment's structured-call recovery behavior remains under-specified (G-2).

### `prototype-demo.md`

**Carried forward:** T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition must all work; prompt-driven routing, explicit consent, normalized evidence, no missing-field invention, Plan/Build separation, dependency preflight, verification evidence, key isolation, and the missing-C++-compiler branch are all covered.

**Correctly superseded:** onboarding no longer displays unavailable reasoning models; Typhoon is the sole `/models` entry. The C++ task is now the canonical local Agent Loop proof and prints `Hello, World!` without requiring OCR. Git diff integration is not required. The hosted Phase 2 path is deferred.

**Remaining issue:** the exact three-scenario demonstration portfolio and detailed fixtures have no explicit retain/replace/supersede decision (G-3).

### `terminal-interface.md`

**Carried forward:** persistent Work Mode/Permission/connection/context state, Shift+Tab and Tab behavior, `/permissions`, orthogonal modes, session browser, full transcript versus Active Model Context, permission reset, Context Donut bands, automatic compaction, and blocked protected-context behavior.

**Later-authoritative addition correctly applied:** durable Boundary Expansions remain across Runtime Activations, while Permission Profile, Full Access, sensitive-transfer authority, and temporary approvals reset.

**No material PRD gap found.** Remaining exact interaction behavior is a UX-spec handoff.

## Reconciliation conclusion

The proposal-discovery input is not missing from the PRD in bulk. Most apparent differences are deliberate later decisions: public open-source release rather than competition prototype, Windows and macOS rather than Windows only, Typhoon only, curiosity and feasibility rather than production coding, direct local AI-for-Thai calls, and no Git tooling requirement.

Before final polish, the product owner should explicitly resolve G-1 through G-4 or record why each source statement is superseded/deferred. G-2 and G-3 are the most consequential because they determine what makes thcode more than a generic Typhoon harness and what reproducible evidence will prove the four integrations actually work.
