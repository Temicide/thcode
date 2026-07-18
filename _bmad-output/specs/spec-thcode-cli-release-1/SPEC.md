---
id: SPEC-thcode-cli-release-1
companions:
  - ../../planning-artifacts/prds/prd-thcode-2026-07-14/prd.md
  - ../../planning-artifacts/prds/prd-thcode-2026-07-14/addendum.md
  - ../../planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# thcode CLI Release 1

## Why

Thai developers can already use mature frontier-model coding agents, but they lack one polished, trustworthy terminal experience for exploring a Thai reasoning model and Thai specialist AI services. Release 1 captures that curiosity opportunity: let a Thai or Thai-English developer prove that Typhoon can operate a bounded local tool loop and invoke four AI-for-Thai services, while making credentials, authority, evidence, failure, recovery, and model limitations more trustworthy than the underlying intelligence may be.

## Capabilities

- **CAP-1**
  - **intent:** A Thai or Thai-English developer can globally install and launch thcode on supported native Windows and macOS, then connect separate Typhoon and AI-for-Thai credentials through protected flows with evidence-backed connection state.
  - **success:** Clean-machine install and live connection checks pass on every release platform without exposing either credential in prompts, repositories, sessions, logs, previews, telemetry, or reports.

- **CAP-2**
  - **intent:** A user can ask Typhoon in Thai or mixed Thai-English to complete a bounded local observe–act–verify task using controlled workspace and command capabilities.
  - **success:** On both release platforms, the canonical fixture creates a C++ source file inside the declared workspace, compiles with exit code `0`, runs with exit code `0`, and emits `Hello, World!`; a missing compiler produces accurate guidance without mutation or false completion.

- **CAP-3**
  - **intent:** A prompt can select and invoke T-OCR, Speech-to-Text, Extract Address, or Named Entity Recognition through the local harness while the remaining AI-for-Thai catalog stays discoverable but non-invokable.
  - **success:** All four services pass repeatable contract tests and prompt-driven end-to-end flows with destination disclosure, attributable results, visible cache provenance, preserved uncertainty, and zero invocation of entries marked unavailable.

- **CAP-4**
  - **intent:** A user can diagnose deterministic remote failures, see unavailability or quarantine scoped to the configuration proven invalid, correct the condition, and explicitly retest it.
  - **success:** Four service-specific recovery fixtures and one rejected shared-key fixture pass without silently substituting a service, fabricating a result, reopening stale configuration, or disabling an unrelated healthy service.

- **CAP-5**
  - **intent:** A user can control Work Mode, Permission Profile, operation approvals, sensitive-transfer consent, and durable Boundary Expansions while the local harness independently enforces non-overridable boundaries.
  - **success:** Release validation observes zero Plan-mode mutations, workspace escapes, unauthorized commands, unapproved Manual mutations, unauthorized material transfers, or effects executed without current operation-bound authority.

- **CAP-6**
  - **intent:** A user can create, inspect, restore, and delete machine-local Saved Sessions while complete transcript history remains separate from the bounded Active Model Context sent to Typhoon.
  - **success:** Cross-platform fixtures restore attributable history and context decisions without restoring temporary authority, silently rebinding a workspace, dropping protected content, leaking credentials, or retaining unreferenced sensitive session artifacts after deletion.

- **CAP-7**
  - **intent:** A user can resume truthfully after an interrupted remote request and safely roll back recent file changes that thcode can prove were made through its built-in mutation tools.
  - **success:** Recovery restores durable received output and marks the reliable endpoint without automatic retry; rollback reverses matching attributable changes, stops on later conflicts, respects encryption and storage caps, expires by policy, and never claims reversal of untracked effects.

- **CAP-8**
  - **intent:** A user can inspect persistent state, action previews, activity, provenance, context usage, service contribution, verification, failures, and next steps through the terminal experience.
  - **success:** Every significant proposed and executed action has sanitized, correlated evidence and an accessible narrow-terminal representation; deterministic evidence remains distinct from model explanation, status never relies on color alone, and completion states what changed, what was verified, and what risk remains.

## Constraints

- The detailed product scope in the adopted PRD is exhaustive; architecture and other artifacts cannot add Release 1 product commitments.
- Typhoon is the only Release 1 reasoning model. T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition are the only invokable AI-for-Thai services.
- Typhoon and AI-for-Thai are called directly by the local CLI. No hosted thcode component may receive user credentials or execute repository, filesystem, shell, build, test, or launch-path specialist operations.
- Supported execution is native Windows 11 25H2+ with Windows Terminal and PowerShell, and macOS 14+ with Terminal and zsh. Node.js `>=22`, npm global distribution, and Node.js 24 LTS clean-machine validation are mandatory.
- Remote output is untrusted proposal data. One local Policy Enforcement Point is the sole effect authority and fails closed when workspace, command, process, network, quota, credential, consent, or platform enforcement cannot be proven.
- Credentials remain in OS credential facilities, are bound to exact dependency identity and verified host, never enter Active Model Context or product persistence, and cannot be reused across Typhoon and AI-for-Thai.
- Sensitive persisted content uses authenticated encryption with explicit key lifecycle. Sanitization occurs before persistence, display, logging, export, model context, or transfer preview.
- Authoritative operations, effects, events, artifacts, health transitions, cache reuse, interruptions, and rollback results are versioned, attributable, crash-consistent, and uncertainty-preserving.
- User configuration is declarative and non-executable. Invalid structured proposals are rejected after one local validation pass without model repair, protocol reinterpretation, policy relaxation, or silent fallback.
- Terminal presentation cannot bypass application policy or local effect authorization; the adopted Architecture Spine defines the required structural boundaries.
- Exact Typhoon and AI-for-Thai release contracts are frozen only after credentialed success and failure verification against current official APIs; prototype or documentation-only mappings are not release evidence.
- Numeric performance gates are frozen before release-candidate approval from supported-platform and live-service p95 benchmarks plus an explicit margin.
- Sensitive artifacts are classified and minimized locally; sensitive originals require destination-specific consent and upstream handling disclosure, and sensitive evidence remains only while referenced or explicitly retained.
- Windows and macOS effects use a verified native enforcement matrix and are denied whenever the required mechanism is unavailable.
- Repository governance is maintainer-led by Temicide; contributions require review and tests, vulnerabilities have a private reporting and response path, and support is best-effort for the latest release.
- Outside rollback retention, artifacts remain while referenced by a live session or explicit record; unreferenced sensitive content is purged immediately, other unreferenced cache entries expire 30 days after last use, and users can inspect, clear, disable, or shorten retention.
- Source code is released under the MIT License.

## Non-goals

- Replacing frontier-model coding agents, promising dependable production coding automation, or claiming coding parity or superiority.
- Supporting reasoning models other than Typhoon or making non-launch AI-for-Thai catalog entries invokable.
- Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, web, desktop GUI, mobile, IDE, or autonomous computer-use support.
- Git status or diff integration, silent installation of developer dependencies, or mutation outside controlled local tools.
- Cloud-synchronized sessions, cross-device identity, export/import, recovery archives, or migration.
- Proxying AI-for-Thai credentials or payloads through a hosted thcode service.
- Executable user adapters, user-defined slash-command code, silent protocol repair, or a Thai Agent Compatibility Layer that repairs invalid tool output.
- Automatic retry of uncertain remote effects or rollback guarantees for shell, process, remote, permission, symlink-side, or other untracked effects.
- Guaranteeing Typhoon judgment, specialist-service correctness or availability, upstream credentials, entitlement, quota, schemas, or third-party data quality.

## Success signal

- On clean supported Windows and macOS environments, Typhoon completes the C++ observe–act–verify proof; all four AI-for-Thai services complete attributable prompt-driven flows; scoped health recovery, Saved Session continuity, interruption recovery, context protection, and rollback fixtures pass; and counter-tests observe zero unauthorized effects, credential exposure, false service capability, fabricated fields, or inflated public positioning.

## Assumptions

- Users can obtain separate working Typhoon and AI-for-Thai credentials entitled for all four launch services.
- AI-for-Thai launch contracts remain stable enough for reviewed mappings, live health checks, deterministic fixtures, prompt routing, and content-hash evidence reuse.
- Supported OS credential facilities and encrypted local persistence can meet the confirmed credential, session, evidence, cache, and rollback boundaries.

## Open Questions

- Which exact Typhoon model identifier, verified endpoint contract, and adapter version will credentialed verification freeze before integration freeze?
- What exact startup, TUI, health-check, Prompt Round, compaction, session-restore, and specialist-service budgets result from supported-platform and live-service p95 benchmarks?
- What classification taxonomy, consent wording, and upstream handling disclosures implement the selected classify-and-minimize policy before affected services are enabled?
- Which verified native Windows and macOS mechanisms implement each row of the required workspace, filesystem, command, process, network, and fail-closed enforcement matrix?
- Which exact endpoints, request and response mappings, limits, error mappings, and credentialed fixtures will be frozen for the four AI-for-Thai launch adapters?
