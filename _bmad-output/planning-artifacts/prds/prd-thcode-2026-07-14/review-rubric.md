# PRD Quality Review — thcode

## Overall verdict

This is a strategically coherent and unusually candid PRD: it draws a sharp line between a production-quality harness and noncompetitive model intelligence, and its journeys, requirements, non-goals, and counter-metrics reinforce that choice. It is adequate for UX and architecture kickoff, but not yet a final release contract because several safety- and continuity-critical requirements defer the definitions needed to prove them, and the scope interpretation rule makes the release boundary depend on documents outside the PRD.

## Decision-readiness — adequate

The major product choices are stated plainly and with their trade-offs: Typhoon-only reasoning, exactly four operational AI-for-Thai services, Windows and macOS support, local credential use, explicit limits on rollback, and a curiosity/feasibility promise instead of coding-productivity claims (§§1, 3, 4, 8–9). The rejected approaches in `addendum.md` also preserve the reasoning behind important safety and extensibility choices. Deferred decisions have owners and deadlines (§12), so they are not disguised as settled requirements.

### Findings

- **high** Hidden release scope can bypass the reviewed FR set (§4, “Scope interpretation rule”) — The statement that Release 1 includes “every current, accepted, non-superseded product capability in the project decision and proposal documents” makes the 39 FRs non-exhaustive. A reviewer cannot establish scope from this PRD alone, and an external document edit or disputed “accepted” status could silently create a release commitment. *Fix:* Make this PRD the authoritative and exhaustive Release 1 scope; reconcile every accepted external capability into an FR, NFR, explicit non-goal, or named deferred item, then remove the blanket import rule.

## Substance over theater — strong

The document earns its length. Nok is used inline to drive concrete decisions rather than as a decorative persona; the seven journeys cover distinct trust-bearing states; and the NFRs are specific to credential isolation, local boundaries, crash consistency, provenance, context limits, and supported terminal behavior. The vision cannot be swapped into a generic coding-agent PRD because it explicitly names the Thai-model capability gap and limits the product promise to a trustworthy harness (§1).

### Findings

No material findings.

## Strategic coherence — adequate

The thesis is consistent from Vision through Non-Goals: thcode offers a trustworthy first-hand proof that Typhoon can operate a bounded local agent loop and use four Thai specialist services, without claiming frontier-agent parity. Feature priority follows that thesis, and SM-1/SM-2 directly test its two technical proofs while SM-C1 through SM-C4 prevent safety shortcuts and inflated positioning (§10).

### Findings

- **medium** Success measures prove technical operation but not the promised first experience (§1, “one polished CLI”; UJ-1/UJ-2; §10) — The PRD also bets on legibility, curiosity, understandable provenance, and an experience “worth sharing,” yet every release measure is a system fixture. A CLI could pass SM-1 through SM-4 while first-run connection, transfer disclosure, or service provenance remains confusing. *Fix:* Add one usability/trust release gate, such as a small moderated first-run study or scenario-based comprehension test, with explicit completion and understanding criteria. This need not become an adoption or retention target.

## Done-ness clarity — thin

Most FRs include concrete consequences, and the headline C++ proof is especially testable: file existence, compilation and execution exit codes, and expected stdout are explicit (UJ-4, FR-12, SM-1). Service health states, rollback caps, context thresholds, supported platforms, and false-capability counter-metrics also create useful acceptance boundaries. However, several requirements central to the “production-quality harness” promise cannot yet be implemented or accepted without policy and fixture definitions that the PRD explicitly defers.

### Findings

- **high** Core boundary behavior has no acceptability matrix (§6.4 FR-24; §7 NFR-3; §12 item 4) — Workspace, command, process, network, service, quota, and fail-closed enforcement are central to SM-C1, but the platform/action matrix that says what is enforceable and what happens when enforcement is unavailable is deferred. “Commands threatening the host operating system” (FR-10) is not a testable boundary. *Fix:* Before story decomposition for execution tools, define a requirement-level matrix for each supported OS and action class: allowed scope, hard refusal, eligible durable expansion, unavailable-enforcement behavior, and release fixture.

- **high** Sensitive-transfer requirements depend on an undefined policy (§6.3 FR-15–FR-16; §7 NFR-1–NFR-2; §12 item 3) — Terms including “material,” “sensitive,” “privacy policy,” “appropriate to their risk,” and “sensitive local session content” determine when consent, transfer, encryption, retention, and deletion apply, but they have no classification or service-specific acceptance rules. This affects all four launch services and cannot be safely inferred by implementation teams. *Fix:* Define the requirement-level data classes and, for each launch service, the default local handling, outbound fields, explicit-consent trigger, retained evidence, deletion behavior, and required upstream disclosure; leave storage mechanisms and copy to downstream design.

- **high** The continuity gate refers to an undefined fixture set (§10 SM-4, “all critical fixtures pass”) — Neither “critical” nor the fixture inventory is defined, so the gate can change after implementation and does not prove the detailed behavior in FR-26 through FR-35. The same area contains high-risk cases such as missing workspaces, lost encryption keys, partial records, overlapping rollback edits, binary caps, and interrupted remote outcomes. *Fix:* Enumerate the required fixtures by FR and platform, including expected pass/fail evidence, or reference a versioned acceptance specification that is itself a release-controlled artifact.

- **medium** Numeric performance requirements are absent (§7 NFR-12–NFR-14; §12 item 2) — “Production quality” includes responsive startup, TUI interaction, session restore, compaction, and health checks, but NFR-14 explicitly leaves every budget unset. Measuring Prompt Round duration does not establish an acceptable result. *Fix:* Set stakes-appropriate percentile budgets and test conditions before release-candidate implementation is considered done, including separate handling for upstream service latency that thcode cannot control.

- **medium** Assisted permissions are named but not behaviorally specified (§5 “Permission Profile”; §6.4 FR-22) — Manual and Full Access have visible consequences, while Assisted is only described as applying “deterministic rules.” No action eligibility, prompt behavior, or transition rule distinguishes it enough for implementation or acceptance. *Fix:* Add a concise action-by-profile table covering list/read/search, file mutation, deletion, command execution, specialist transfer, and boundary expansion, or remove Assisted from Release 1.

## Scope honesty — adequate

The PRD is direct about non-users, non-goals, model limitations, supported environments, unavailable catalog entries, excluded rollback effects, and postponed provider extensibility (§§2.2, 3–4, 8–9). Deferred decisions are visible and milestone-bound rather than silently omitted (§12). Open-item density is reasonable for an architecture-bound draft, but the assumptions are not connected back to the claims that depend on them.

### Findings

- **medium** The Assumptions Index does not round-trip to inline claims (§13) — A-1 through A-5 appear only in the index; there are no inline `[ASSUMPTION: …]` markers showing where release scope, credentials, service contracts, or platform storage feasibility depend on them. In particular, A-3 through A-5 can invalidate major launch capabilities. *Fix:* Place each assumption inline at every material dependent claim, link it to its A-ID, and give release-critical assumptions an owner, validation event, and failure disposition.

## Downstream usability — adequate

The artifact is easy to extract into UX, architecture, and stories: domain terms are defined (§5), journeys have named protagonists, FRs are grouped and globally numbered, and the addendum keeps solution direction separate from product requirements. Feature descriptions link grouped FRs to journeys, and Success Measures name the FR ranges they validate. Downstream work will still need the missing authority, data-policy, fixture, and permission definitions identified above before release acceptance can be derived safely.

### Findings

No additional findings beyond Done-ness clarity.

## Shape fit — strong

Journey-led structure fits a terminal product whose main differentiation is the quality and trustworthiness of the experience across onboarding, external transfer, failure, restore, interruption, and rollback. The seven Nok journeys are not persona overhead: each carries distinct state transitions and trust requirements that directly source the FR groups. The technical depth is appropriately split, with product outcomes in `prd.md` and mechanisms, rejected alternatives, and post-launch architecture direction in `addendum.md`.

### Findings

No material findings.

## Mechanical notes

- IDs are contiguous and unique: UJ-1 through UJ-7, FR-1 through FR-39, NFR-1 through NFR-15, SM-1 through SM-4, and SM-C1 through SM-C4.
- The inspected UJ and FR/SM cross-references resolve; no broken “see above/below” references were found.
- Every UJ has Nok as a named protagonist with context inline.
- Glossary coverage is strong. Minor capitalization variation around generic “key,” “service,” and “evidence” does not currently change meaning.
- The Assumptions Index mechanical failure is substantive enough to appear under Scope honesty: all five index entries lack inline markers.
- Required sections for an open-source, chain-top technical product are present, including vision, target user, journeys, scoped FRs/NFRs, guardrails, non-goals, success and counter-metrics, risks, deferred decisions, and assumptions.
