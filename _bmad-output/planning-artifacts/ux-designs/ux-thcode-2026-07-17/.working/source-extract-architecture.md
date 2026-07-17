# UX Source Extract: Architecture Spine

Source: `ARCHITECTURE-SPINE.md` (architecture spine, updated 2026-07-16). This extract records architecture facts that constrain or enable UX; it does not add product assumptions.

## Form factors and platform scope

- Release 1 is a local, direct-call product distributed through npm, running as a CLI with Ink TUI and a headless core.
- Supported native environments are Windows 11 25H2+ with Windows Terminal/PowerShell and macOS 14+ with Terminal/zsh.
- Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, and non-native shells are out of scope.
- Runtime is Node.js 22+; release validation includes Node.js 24 LTS and current supported OS versions.
- The stack names Ink 5.2.1 and React 18.3.1. The exact Ink component tree and visual styling remain UI-local/deferred.

## CLI, TUI, web, and architectural boundaries

- `CoreApp` is the sole UI-facing facade. UI communicates only through versioned `CoreProtocolV1`: `dispatch(intent)`, `subscribe({ sessionId, afterSequence })`, and `query(query)`.
- The shared protocol owns exhaustive intent unions for prompt/session/authority/health/capability actions; projections for Session/Status/Context/Artifact/Capability; durable lifecycle/evidence events; and transient `TokenDelta`/`Progress` events.
- Ink UI translates terminal interaction into application intents and renders application projections/events. It must not own runtime state, build domain projections, import adapters, or bypass policy.
- Existing `cli/src/core/*` may converge incrementally toward the seeded `domain/`, `application/`, `ports/`, `adapters/`, and `ui/` structure; UX must follow the boundaries before directory migration.
- `client/`, `server/`, proxy, and Compatibility Layer components are outside the Release 1 request path. The hosted web scaffold therefore does not define Release 1 interaction behavior.
- Concrete adapter concerns (vendor objects, database rows, OS handles, Ink values) do not cross their adapter boundary.

## Latency, streaming, replay, and interruption

- Reasoning/provider output is streamed through sanitized provider chunks. Chunks include upstream sequence/high-water identity and are idempotently appended as durable `RemoteOutputObserved` events before UI publication.
- `TokenDelta` and `Progress` are transient; only non-authoritative progress may be transient. Authority, evidence, content, health, artifact, state, and terminal facts must not depend on transient events.
- Completion seals the stream. Interruption restores durable chunks and appends `ChatInterrupted` at the reliable high-water mark.
- Every accepted operation has exactly one durable terminal outcome.
- Subscription replay is ordered and at-least-once; consumers deduplicate by immutable `EventId`. UI must support replay from a sequence cursor and tolerate duplicate events.
- Every operation carries `SessionId`, `PromptRoundId`, `OperationId`, `EventId`, schema version, UTC timestamp, and deterministic/model provenance; UX can expose correlation/provenance where needed.
- Cancellation, approval, consent, and retest are correlated intents/events, not callbacks. Cancellation is not necessarily immediate or optimistic after dispatch.
- Effects use `proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled`. After dispatch commit, cancellation/revocation cannot claim success unless the adapter proves no effect occurred; unknown outcome outranks optimistic cancellation.
- No automatic retry is permitted for unknown remote or shell outcomes without proven replay safety. Invalid structured proposals receive one local validation pass and then a surfaced terminal failure; no model repair/provider retry/protocol reinterpretation follows.

## Offline and remote-dependency behavior

- The architecture does not promise general offline operation; remote calls are direct from local adapters to Typhoon and four AI-for-Thai services.
- Dependency health is explicit and generation-bound: `unconfigured → configured → checking → available | unavailable | unhealthy | quarantined`.
- Credentials being present does not imply health. Quarantine can be exited only by an explicit, visible, generation-bound retest.
- Request-local unsupported input, timeout, network loss, rate limit, quota exhaustion, and upstream server failure remain request/quota states after one occurrence; they do not immediately quarantine a dependency.
- Specialist cache lookup precedes live-health gating and may return attributable prior evidence while a service is quarantined/unavailable. Force-fresh requires current availability and is blocked with a typed recovery action until explicit retest succeeds.
- There is no silent dependency fallback. A different dependency requires an explicit recorded routing decision; Release 1 has no alternate reasoning provider.

## Trust, authority, consent, and transfer boundaries

- Remote provider/service output is untrusted proposal/data, never effect authority. The local Policy Enforcement Point (PEP) is the sole effect authority and owns the authorized effect executor.
- UX cannot imply that model output directly performed an action. Effects require local validation plus Work Mode, Permission Profile, consent, workspace, network, command, quota, credential, and hard-boundary checks.
- Authority dimensions remain independent: Work Mode, Permission Profile, operation approval, transfer consent, and durable Boundary Expansion. Full Access, sensitive transfer, operation approval, and durable boundary authority must not be conflated.
- `PermissionMatrix` maps action class × Work Mode × Permission Profile × risk/sensitivity × hard-boundary state to `allow | ask | deny`. Manual allows bounded non-sensitive reads and asks for eligible mutations/sensitive actions; Assisted asks on uncertainty; Full Access suppresses only eligible prompts inside declared boundaries; Plan denies mutation; sensitive transfer always requires consent; hard boundaries and unknown action classes deny.
- Operation approval binds the exact action digest and `OperationId`; retries or rewritten proposals require new approval unless the same idempotent operation resumes.
- Transfer consent binds exact prepared payload and bytes, recipient capability/version/endpoint, purpose, call count, expiry, and operation/prompt scope. The PEP recomputes both digests immediately before transport; any mismatch/transformation requires new consent.
- Runtime Activation is fresh on process start, session create/open/switch, and workspace rebind. It starts at Manual with no temporary approval or transfer consent. Temporary authority must not leak across process, session, or workspace boundaries.
- Boundary grants bind stable resource identity, platform/workspace identity, allowed actions, expiry, and revocation. Opening a missing workspace blocks affected actions; sessions never silently rebind.
- Remote calls require HTTPS, standard certificate/hostname verification, no TLS bypass/downgrade, rejected unauthorized/cross-origin redirects, and final-origin revalidation before material is sent.
- Credentials stay local and identity-bound. Keys never appear in prompts, repositories, logs, telemetry, crash reports, sessions, previews, or UI output; UX may expose only opaque references/revisions and secret-free fingerprints.
- `ArtifactResolver` prepares explicit in-workspace references and sends prepared bytes/text plus an immutable manifest, never unresolved local paths or fetch authority. Originals transfer only when required and exactly consented; PDF/DOCX text extraction is local by default.

## Errors, recovery, and status

- All remote failures use one safe envelope: deterministic category, retryability, scope, dependency/configuration generation, operation id, safe message, cause code, evidence reference, and optional retry-after. Raw vendor payloads/secrets are excluded; model explanations cannot replace or contradict deterministic categories.
- Recovery actions must be typed and visible for unavailable/quarantined dependencies, force-fresh blocking, invalid proposals, unknown outcomes, conflicts, migration/key failures, and other categorized failures.
- Platform/resource mismatches, changed descendants, symlink/junction/mount/rename/case/Unicode uncertainty, open-handle uncertainty, and unsupported enforcement produce conflict/unknown/deny—not best-effort mutation.
- Startup recovery detects incomplete stages, marks unknown outcomes, cleans unreachable staged data, and never replays side effects. UI completion is visible only from post-commit events.
- Persistence migration failure/incompatibility opens read-only recovery without running effects or overwriting data; missing/unreadable encryption keys or interrupted rotation enter locked recovery and disclose unrecoverability.
- Rollback is limited to checkpointed built-in create/edit/delete. It compares current content with the recorded post-image; conflicts stop affected reversal and report partial rollback. Shell, process, remote, permission, and external effects are never presented as reversible.
- Raw prompt, command, and payload export is disabled by default. Sanitization is mandatory before display, persistence, logs/telemetry, export, model context, previews, evidence, or action summaries.

## Permissions, persistence, and retention

- Session is the persisted aggregate root containing transcript, prompt rounds, Typhoon selection, Work Mode, pins, context decisions, artifacts/evidence, tool and verification history, token ledger, interruption markers, durable Boundary Expansions, workspace association, and checkpoint lineage.
- Runtime Activation owns live Permission Profile, temporary approvals, and transfer consent. Application commands serialize mutation per session; optimistic aggregate versioning applies on append.
- Full transcript is immutable local history. Active Model Context is a bounded derived projection with recorded inclusion, exclusion, and compaction decisions. Protected-content overflow stops before dispatch with categorized accounting and remedies; automatic compaction targets no more than 70%.
- One local operation journal governs commit visibility. Artifacts/checkpoint originals are durable before references and terminal events publish. UI must not show completion before post-commit event publication.
- Sensitive SQLite fields and retained originals use AES-256-GCM with a per-install DEK in the OS credential facility outside SQLite. Minimum metadata and a keyed workspace equality index remain plaintext.
- Checkpoints default to five subsequent prompts, are capped at 100 MB each and 500 MB total, and encrypt binary originals. Over-cap actions require explicit confirmation without rollback protection; expiry removes originals and metadata.
- Session deletion is a journaled tombstone operation that immediately makes the session, transcript/events, context manifests, token ledger, checkpoints, projections, and evidence inaccessible; shared referenced bytes remain. Only a non-sensitive deletion audit tombstone persists.
- Specialist results are immutable artifacts with source hash, service/configuration generation, fields, confidence/uncertainty, empty fields, consent reference, timing, and normalized failure. Cache reuse must visibly retain provenance and original evidence.

## Accessibility- and terminal-relevant technical limits

- Status must never rely on color alone; a narrow-terminal text representation is required.
- The product is terminal-first on Windows Terminal/PowerShell and macOS Terminal/zsh, so layouts must work within narrow terminal widths and text-only status affordances.
- UTF-8 is required end to end; Thai and technical identifiers must be preserved.
- Event/projection rendering must distinguish durable facts from transient token/progress updates; replay/duplicate delivery cannot create duplicate visible history or actions.
- The architecture does not specify a screen-reader model, color palette, exact component tree, visual styling, or detailed keyboard interaction; those remain UX-local/deferred.

## Named UI systems and UI-facing concepts

- Ink TUI (React-based), npm CLI, headless `CoreApp`, `CoreProtocolV1`.
- UI-facing projections: Session, Status, Context, Artifact, Capability.
- UI-facing intent categories: prompt, session, authority, health, capability.
- Durable lifecycle/evidence events and transient `TokenDelta`/`Progress` events.
- Named authority/status concepts likely requiring explicit UI representation: Work Mode, Permission Profile, operation approval, transfer consent, Boundary Expansion, Runtime Activation revision, dependency health lifecycle, Effective Configuration Generation, cache freshness/provenance, QuotaLedger state, and operation uncertainty state.
- Capability Registry display includes unavailable catalog entries as `Catalogued — Not available yet`; such entries cannot execute.
