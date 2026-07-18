# Input Reconciliation — Production Restructuring Brainstorm

## Input reviewed

- `_bmad-output/brainstorming/brainstorm-restructure-thcode-production-foundation-2026-07-14/brainstorm-intent.md`
- `_bmad-output/brainstorming/brainstorm-restructure-thcode-production-foundation-2026-07-14/brainstorm.html`

Compared with:

- `prd.md`
- `addendum.md`

This report extracts reconciliation findings only. It does not modify or reinterpret the source artifacts.

## Verdict

**Substantially reconciled, with one material behavioral gap and two documentation/qualitative clarifications.** The PRD and addendum preserve nearly all explicit trust, safety, health, observability, recovery, rollback, and extension-architecture decisions. Later user decisions correctly narrow the first public release to Typhoon, four working AI-for-Thai services, Windows and macOS, and local endpoint invocation. The remaining gaps do not change the confirmed product scope, but addressing them would preserve the brainstorm's trust contract more precisely.

## Material gaps

### 1. Every proposed tool call is not explicitly guaranteed to remain visible

**Source signal.** The brainstorm requires every proposed tool call to appear in a compact, visible approval log. The HTML reinforces the qualitative promise that every action is legible. Approval has progressive depth: plain-language purpose first, then exact arguments, destination, selected data, side effects, and exact command where applicable.

**Current coverage.** FR-23 specifies progressive disclosure only “for an action requiring approval.” FR-38 links Evidence for “significant actions and demonstrations.” UJ-4 says Nok sees tool activity. These cover approved mutations and significant actions well, but they do not unambiguously require visibility for automatically permitted in-workspace list, read, and search calls or other calls that do not interrupt the user.

**Risk.** An implementation could satisfy the PRD while executing automatically eligible read/search calls invisibly. That would weaken the source's explicit “every action is legible” trust contract and make it harder to audit what Typhoon asked the harness to do.

**Recommended reconciliation.** State that every proposed and executed tool call appears in a compact activity/evidence log regardless of whether it requires an approval prompt. Policy determines whether execution pauses; it does not determine whether the action is visible. Preserve progressive inspection for authoritative details and continue hiding credentials.

### 2. The brainstorm's qualitative trust thesis is present but dispersed

**Source signal.** The HTML gives the intended product feel unusual clarity: “Trust the call,” every extension/action/failure/recovery should be legible, “evidence before explanation,” “bound the blast radius,” and uncertainty should be preserved rather than guessed away. The core proposition is that connectivity makes the CLI functional while safety, observability, recovery, and the TUI make it trustworthy.

**Current coverage.** The Vision, journeys, FR-16 through FR-25, FR-32 through FR-39, non-functional requirements, risks, and addendum collectively implement this thesis. The PRD explicitly says that credentials, boundaries, consent, health, recovery, rollback, context governance, and explanations must remain trustworthy even when upstream performance is poor.

**Gap.** The behavioral pieces are present, but the product/UX principle that unifies them is not stated as a concise design standard. A downstream UX or architecture team could treat evidence, failure states, and recovery as separate features rather than one consistent interaction contract.

**Recommended reconciliation.** Add a short product-experience principle in the PRD or UX handoff: every extension, proposed action, transfer, result, failure, interruption, and rollback outcome must be legible; deterministic evidence leads, explanation follows; unknown state remains visibly unknown. This preserves tone and intent without adding implementation detail.

### 3. Generic end-user extension configuration needs an explicit post-launch label

**Source signal.** The brainstorm originally envisioned post-install declarative configuration of Ollama, vLLM, private OCR, and private speech endpoints, with generic metadata-driven discovery and no extension-specific UI.

**Later decisions.** The user subsequently fixed the first release to Typhoon as the only reasoning model; four reviewed AI-for-Thai integrations as the only working Specialist Services; remaining catalog entries visible but not invokable; and direct local calls to official AI-for-Thai endpoints. Those decisions supersede arbitrary end-user provider/service configuration as a first-release capability, while preserving an extensible internal foundation.

**Current coverage.** The PRD clearly limits launch scope and the addendum preserves metadata-driven discovery, generic components, protocol profiles, and declarative mappings as architecture direction. However, the addendum's “Extension architecture direction” does not explicitly say that end-user addition of arbitrary providers/private services is post-launch rather than a first-release requirement.

**Risk.** Downstream readers may interpret the addendum as requiring user-configurable Ollama, vLLM, private OCR, and speech endpoints at launch, conflicting with the PRD's Typhoon-only and four-service boundaries.

**Recommended reconciliation.** Annotate the addendum direction: the first release uses the extension architecture internally for Typhoon and the four reviewed AI-for-Thai services; arbitrary post-install provider and private-service configuration is a future capability unless separately promoted into scope.

## Coverage and conflict audit

| Brainstorm decision or idea | Reconciliation status | PRD/addendum treatment |
|---|---|---|
| Production-grade harness owns safety, UX, observability, and recovery; upstream output quality remains variable | Captured | Vision, Promise Boundary, Constraints, NFRs, and Risks clearly separate harness guarantees from model/service quality. |
| Metadata-driven extensions and generic reusable TUI | Captured as downstream architecture | Addendum preserves zero provider-specific UI direction and generic rendering. |
| Named OpenAI-compatible and Anthropic profiles; declarative specialist mappings; reviewed adapters | Captured as downstream architecture | Addendum preserves the mechanism without presenting other reasoning providers as launch scope. |
| Non-executable configuration and product-controlled TypeScript slash commands | Captured | Constraints, Non-Goals, and addendum cover both rules. |
| Live health gate proves connectivity, not tool-call compatibility | Captured | FR-2 and FR-4 define connectivity/authentication health; addendum explicitly records rejection of tool-call compatibility as the availability gate. |
| Real-use protocol failure becomes unhealthy, cannot be silently repaired, and requires explicit retest | Captured and refined | UJ-3 and FR-18 through FR-20 add evidence-scoped quarantine and distinguish deterministic failures from transient conditions. |
| Deterministic network evidence precedes model explanation | Captured | FR-19 and FR-39 preserve separate provenance; addendum retains sanitized underlying evidence. |
| Progressive action disclosure, exact command, verified endpoint/method/service/payload summary, no credentials | Captured except universal tool-call visibility | FR-16, FR-23, FR-25, and FR-38 cover disclosure and credential isolation; finding 1 addresses calls not requiring approval. |
| Dangerous actions visibly marked; host OS and out-of-workspace actions hard-refused | Captured | UJ-4, FR-9, FR-10, FR-23, FR-24, and NFR-3. |
| Workspace, command, network, service, and quota boundaries survive Full Access | Captured | FR-24 and glossary define non-overridable boundaries. |
| Approved boundary expansions persist across activations | Captured and later clarified | UJ-5, FR-24, FR-28, and addendum separate durable expansions from temporary authority. |
| Prompt Round is the user-facing performance unit; subsystem timings remain diagnostic | Captured | FR-39, NFR-12, and addendum. Numeric budgets are correctly deferred. |
| Active Context Utilization remains distinct from cumulative token usage | Captured and expanded | Context scope, FR-29 through FR-31, FR-39, and addendum. |
| Unknown remote outcome is never automatically retried; known output and exact interruption marker are preserved | Captured | UJ-6, FR-6, FR-32, NFR-6, and addendum. |
| Rollback uses before hashes/exact patches, reverses only matching changes, stops on overlap, retains binaries temporarily, and expires after five prompts | Captured and bounded | UJ-7, FR-33 through FR-35, and addendum. Later decisions add encryption and size limits and correctly exclude untracked effects. |
| Append-only incident recorder shown in HTML | Correctly not promoted to commitment | Addendum labels it as an unconfirmed mechanism because it was presentation language rather than an explicit intent-file decision. |
| Arbitrary Ollama/vLLM/private-service configuration at launch | Correctly superseded for first release | Later user choices establish Typhoon-only and four AI-for-Thai integrations. Finding 3 recommends making the post-launch status explicit in the addendum. |
| AI-for-Thai examples were not initially firm launch commitments | Superseded by later confirmation | PRD correctly makes T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition launch requirements. |
| Windows-only implication from older project material | Superseded by later confirmation | PRD correctly requires native Windows and macOS. |

## Source ideas correctly preserved outside the PRD narrative

The following technical depth belongs in the addendum and is already placed there appropriately:

- Metadata-driven discovery and reusable generic TUI components.
- Named reasoning-provider protocol profiles and declarative Specialist Service mappings.
- Reviewed adapters for protocols outside the declarative model.
- Before hashes, exact patches, encrypted binary originals, and checkpoint storage limits.
- Extension registry ownership, versioning, revocation, schema migration, and endpoint-verification questions.
- Local session-store and encryption direction.

## Conclusion

No major source requirement is missing from launch scope after applying later user overrides. The only direct behavioral omission is universal tool-call visibility. The qualitative trust principle and the post-launch status of arbitrary extension configuration should be made explicit to keep downstream UX and architecture aligned with the brainstorm's original intent.
