# Reconciliation Report — `docs/decisions/`

## Scope and precedence

Compared every Markdown file in `docs/decisions/` (ADR 0001 through ADR 0020 and the directory README) with `prd.md` and `addendum.md`.

Precedence applied:

1. Later confirmed user decisions recorded in the current PRD and `.memlog.md`.
2. Explicit ADR supersession and amendment metadata.
3. Accepted, non-superseded ADR content.
4. Earlier source language only where it does not conflict with the above.

Rejected alternatives, deferred roadmap items, candidate command ideas, and stale delivery assumptions were not treated as launch requirements.

## Verdict

**Substantially reconciled, with five material carry-forward gaps.** The PRD correctly reflects the current launch boundary: a curiosity-driven but production-quality harness; Typhoon-only reasoning; four callable AI-for-Thai services; local execution and credentials; Windows and macOS; npm distribution; Build + Manual defaults; durable Boundary Expansions but reset runtime authority; no Git tools; and no hosted AI-for-Thai request path. No stale ADR contradiction currently changes that scope.

The gaps below should be resolved before final status because one affects reproducibility, two affect observable trust behavior, and two are accepted technical contracts that belong in the addendum.

## Material gaps

### 1. Exact launch Typhoon model identifier is not fixed

**Source:** ADR 0004 selects `typhoon-v2.5` as the default and requires exact model and adapter version recording for replay. The ADR was amended by ADR 0007 only to relocate provider adapters and credentials; its model identifier was not superseded.

**Current artifact:** The PRD says only “Typhoon” and makes `/models` inspection-only, but does not name a required model ID or define how the release pins/validates it. FR-27 restores the Typhoon selection, while FR-38 records the model, but the release fixture remains under-specified.

**Gap:** SM-1 cannot be reproduced across releases or provider-side model changes without an exact launch model ID and adapter/contract version. If `typhoon-v2.5` is no longer intended, that older decision needs an explicit override rather than silent omission.

**Recommended destination:** PRD Reasoning Model scope and SM-1; preserve adapter-version recording details in the addendum.

### 2. Permission-profile behavior omits two explicit trust rules

**Source:** ADR 0012 requires (a) uncertainty under Assisted to ask the developer and (b) Full Access to require a separate explicit sensitive-transfer override. It also requires a prominent, session-scoped Full Access warning.

**Current artifact:** FR-22 correctly says an AI risk signal cannot authorize an action, and FR-24 keeps sensitive-transfer boundaries independent. FR-16 requires authority appropriate to risk. These statements imply but do not explicitly guarantee the ADR behaviors.

**Gap:** The PRD does not state that Assisted uncertainty must resolve to **ask**, nor that Full Access by itself cannot approve a sensitive transfer and must surface a separate explicit override/warning. These are externally observable safety semantics, not merely implementation details.

**Recommended destination:** FR-22 and/or FR-23, with acceptance fixtures under SM-C1.

### 3. Credential onboarding does not fully preserve pre-entry disclosure

**Source:** ADR 0007 requires the CLI, before accepting a provider key, to explain where the credential will be stored and the exact host it will contact; input must be masked/non-echoing. The same ADR requires explicit removal and rotation and exact host binding.

**Current artifact:** FR-2 requires a protected form, OS credential storage, and health feedback. FR-3 covers separate AI-for-Thai storage, removal, and rotation. FR-25 covers verified-host binding and non-disclosure.

**Gap:** “Protected terminal form” does not explicitly require masked/non-echoing entry, and the onboarding flow does not explicitly require storage-location and destination-host disclosure **before** the user pastes each credential. The requirements cover the resulting security state but not the accepted consent experience.

**Recommended destination:** FR-2 and FR-3.

### 4. Capability Registry implementation contract is only partially retained

**Source:** ADR 0011 defines a detailed, versioned registry record: stable thcode and upstream identifiers, source URL and observation date, Thai/English search terms, modality and media limits, normalized schemas, endpoint/transport/timeout/retry/quota behavior, credential scope and entitlement, privacy classification, confirmation policy, support level, adapter version, and latest contract-test result. It also defines reusable adapter families and an offline checked-in manifest rather than runtime scraping.

**Current artifact:** FR-13 preserves identity, capability, inputs, entitlement, evidence level, manifest version, observation date, launch-service status, and non-invokable catalog entries. The addendum preserves a general versioned registry and reusable mappings but not the complete accepted field and adapter-family contract.

**Gap:** Downstream architecture could satisfy the shorter PRD shape while omitting transport behavior, privacy/confirmation metadata, last-test evidence, search metadata, or one of the required artifact/async/streaming adapter families. This belongs in the addendum rather than expanding the product narrative.

**Recommended destination:** Addendum “Product schemas and evaluation mechanics” or a dedicated Capability Registry contract section.

### 5. Session-encryption, TUI isolation, and npm release contracts are incompletely preserved

**Sources:**

- ADR 0017 requires one per-user SQLite store at native platform locations, safe handling of corruption/migration failures, and deliberate non-copying of source artifacts.
- ADR 0018 requires unique AES-256-GCM nonces per record, record identity and schema version as authenticated metadata, minimum plaintext metadata, keyed/non-reversible workspace indexes, and local-only decryption.
- ADR 0020 requires UI components to dispatch typed intents and never call provider/filesystem/shell/AI-for-Thai APIs directly; it also calls for separate headless-core and Ink interaction/snapshot tests and pinned versions.
- ADR 0019 requires declared Node engine enforcement, rejection of Node 20 and earlier with actionable guidance, and release attention to npm lifecycle-script risk, dependency integrity, version pinning, install/update/uninstall behavior.

**Current artifact:** The addendum captures the per-user SQLite direction, AES-256-GCM at-rest encryption, OS credential-held key, headless TypeScript core, React/Ink TUI, npm distribution, and Node baselines. FR-1 captures install/update/uninstall documentation. NFR-6 captures crash consistency generally.

**Gap:** The accepted mechanism-level guarantees above are not fully retained. They should not burden the main PRD, but their omission from the addendum leaves important security and testability constraints vulnerable to being lost during architecture work.

**Recommended destination:** Addendum sections for session-store security, headless-core/TUI boundaries, and distribution/release engineering.

## Correctly applied amendments, supersessions, and user overrides

- **ADR 0006 superseded by ADR 0013:** The PRD correctly uses directly selectable Plan/Build modes, a Build + Manual fresh-session default, and no mandatory plan-acceptance gate.
- **ADRs 0001, 0003, 0007, and 0010 amended by later routing decisions and user confirmation:** The launch path correctly keeps both provider calls and AI-for-Thai calls local. Hosted artifact orchestration remains downstream only.
- **ADR 0004 launch extensibility narrowed by user confirmation:** `/models` is correctly inspection-only and other reasoning models are not launch commitments. The unresolved point is the exact Typhoon model identifier, not provider breadth.
- **ADR 0008 Windows-only delivery overridden:** The PRD correctly adds native macOS 14 while retaining Windows PowerShell requirements and deferring Linux/WSL/Git Bash.
- **ADR 0003/0005 Git inspection removed by user override:** Git status and diff are correctly excluded, despite their presence in earlier local-tool and candidate-command lists.
- **ADR 0011 demo scope expanded by user confirmation:** All four launch integrations now require prompt-driven end-to-end proof, overriding the earlier three-service public demo portfolio and NER-only contract-test distinction.
- **ADR 0016 amended by user confirmation:** Runtime Permission Profile, Full Access, sensitive-transfer authority, and temporary approvals reset, while durable Boundary Expansions correctly persist until revoked.
- **Original production-coding and competition wording narrowed by user clarification:** The PRD correctly makes the release a technical feasibility and curiosity experience, not a frontier-agent productivity claim.

## Accepted content already covered adequately

- Local ownership of the Agent Loop, workspace policy, tool validation, execution, verification, and secret redaction.
- Type-specific artifact handling, deliberate transfers, local path non-authority, and no fabricated service results.
- Dependency preflight, curated installation guidance, `/check`, and no silent toolchain installation.
- Three orthogonal Permission Profiles, structurally read-only Plan mode, and bounded Full Access.
- Full Chat Transcript versus bounded Active Model Context; pins; inspectable compaction; irreducible-overflow stop; separate cumulative usage.
- Effective Context Capacity formulas and severity guidance (preserved between PRD and addendum).
- Global machine-local Saved Sessions, no cloud synchronization/export/import, explicit Workspace Binding, and loss-of-key disclosure.
- npm global CLI, Node.js 22 minimum, Node.js 24 LTS clean-machine baseline, and TypeScript/Ink direction.
- Windows path/process/encoding and PowerShell baselines at the appropriate PRD/addendum level, plus the later macOS launch expansion.

## Non-gaps

- Candidate commands in ADR 0005 are explicitly subject to user-flow design. The generic discoverable command requirement is sufficient; `/diff` is intentionally removed with Git scope.
- Hosted Docker packaging, gateway credentials, and Phase 2 service orchestration remain downstream work and are preserved as such in the addendum.
- Exact performance budgets, sensitive-data policy, repository governance, and cross-platform enforcement details are intentionally tracked as deferred release gates in PRD section 12 rather than missing silently.
- Rejected alternatives and deferred web/desktop/mobile/IDE/Linux/cloud-session features do not belong in first-release requirements.

