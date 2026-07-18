---
name: thcode
status: final
sources:
  - ../../prds/prd-thcode-2026-07-14/prd.md
  - ../../prds/prd-thcode-2026-07-14/addendum.md
  - ../../epics.md
  - ../../architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md
updated: 2026-07-17
---

# thcode — Experience Spine

> Fast-path contract for a commercial external-user product: local terminal/Ink TUI with headless parity. The spines win on conflict with mockups or imports. No mockups are produced in this fast path. The design and experience spines win-on-conflict once; this sentence is the sole conflict rule.

## Foundation

Release 1 is a native terminal CLI/TUI launched with `thcode`, with a headless execution path for noninteractive use. Native support is Windows 11 25H2+ with Windows Terminal/PowerShell via `pwsh.exe`, and macOS 14+ with Terminal/zsh. Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, web, desktop GUI, mobile, and IDE surfaces are out of scope.

The UI does not own authority or effects. Interactive, redirected, linearized, and headless modes use one canonical projection-to-text contract. The architecture spine is authoritative for internal mechanics; this document specifies only resulting user-visible identity, disclosure, control, state, and recovery consequences.

The visual identity is in `DESIGN.md`: use `{components.shell}`, `{components.status-bar}`, `{components.prompt-composer}`, and `{colors.ink-primary}`. The product follows Claude Code-style terminal familiarity for control model, slash discovery, rhythm, and keyboard operation, but this is not a provider, model, capability, or guarantee-equivalence claim.

## Information Architecture

| Surface | Reached from | Purpose | Safe entry/exit |
|---|---|---|---|
| startup-preflight | `thcode` launch | Check runtime, platform, shell, store, and supported dependency posture before effects | Entry focus is `startup-actions`; exit/continue returns to `startup-actions` |
| onboarding-credential | first launch or `/connections` | Disclose provider/host/storage, masked secret entry, check, replace/remove, recovery | Entry focus `credential-input` only after disclosure; Esc returns to `onboarding-actions` |
| main-conversation | passing Typhoon check | Composer, transcript, streaming, activity, approvals, completion | Entry focus `prompt-composer`; overlays return to logical owner |
| status-bar | persistent or `/status` | Persistent authority, health, context, warning index | `/status` opens `status-inspection`; Esc returns to prior owner |
| command-completion | `/` or completion key | Categorized, product-controlled command discovery | Entry focus `completion-input`; Esc returns to composer |
| approval-dialog | proposed local effect | Purpose/risk then exact effect, bounded decision | Initial focus `approval-review` or `approval-cancel`; never Approve |
| transfer-consent-dialog | prepared remote transfer | Recipient, exact payload summary, policy, explicit consent | Initial focus `consent-review` or `consent-cancel`; never Consent |
| activity-log | main conversation or `/activity` | Grouped calls with every call inspectable | Entry focus `activity-filter`; Esc returns to owner |
| evidence-panel | activity/result/recovery | Deterministic Evidence, provenance, completeness, and explanation separation | Entry focus `evidence-close`; Esc returns to source row |
| models-inspection | `/models` | Typhoon identity, pin, capability, auth, health; never model selection | Entry focus `models-close` |
| tools-catalog | `/tools` | Reviewed capability registry and honest availability states | Entry focus `tools-search`; `Catalogued — Not available yet` entries are not invokable |
| dependency-check | `/check` or blocker | Read-only prerequisite/platform check and rerun | Entry focus `check-rerun` if available, otherwise `check-close` |
| sessions-browser | `/session` or alias `/sessions` | Create/list/open/rename/inspect/delete machine-local sessions | Entry focus `session-search`, return to command owner |
| context-governance | `/context` | Active Model Context, manifest, pins, compaction, protected overflow | Entry focus `context-close`; actions are explicit and consequence-labeled |
| usage-ledger | `/usage` | Cumulative Token Usage only, separate from context | Entry focus `usage-close` |
| rollback-panel | `/rollback` or completion | Eligible checkpoint preview, conflicts, safe resolution, outcomes | Entry focus `rollback-close` until a target is explicitly selected |
| recovery-center | startup or affected operation; `/recover` | One navigable entry for locked, incomplete, unknown, conflict, or migration states | Entry focus `recovery-inspect`; read-only until safe action is selected |

### Surface-by-state closure matrix

Canonical state terms are stable across visual, linearized, redirected, headless, Evidence, and completion surfaces. Each cell lists `copy → action → next step`; `—` means the state does not apply.

| Surface | cold/empty | loading/checking | success/available | error/unavailable | denied/blocked | cancelled | unknown | narrow/noninteractive |
|---|---|---|---|---|---|---|---|---|
| startup-preflight | `No prior preflight.` → Run check → inspect result | `Checking environment…` → wait/cancel → result | `Environment supported.` → Continue → onboarding/main | typed cause → Inspect/Exit → remediation | `Unsupported environment.` → Inspect → install supported runtime/shell | `Preflight cancelled.` → Retry/Exit | `Preflight status unknown.` → Inspect → `/recover` | one ordered record; no effects; nonzero if blocked |
| onboarding-credential | `No credential configured.` → Enter/Help → masked form | `Checking effective configuration…` → wait/cancel → result | `configured` then `available` only after pass → Continue → main | typed storage/auth/health cause → Inspect/Retry/Replace/Remove/Exit → action | `Credential action blocked.` → Inspect → safe remediation | `Credential check cancelled.` → Retry/Exit | `Credential outcome unknown.` → Inspect; no provider use | no secret prompt when noninteractive; refusal on stderr |
| main-conversation | `No Prompt Rounds yet.` → focus composer → prompt | `Prompt Round in progress.` → Interrupt/Inspect → stream/outcome | verified or limitation summary → Inspect/Follow up → composer | typed outcome → Evidence/Retry only when safe → composer/recovery | policy/hard-boundary block → Inspect → revise/Plan | `Cancellation requested.` → Inspect → durable outcome | `unknown-outcome` → Reconcile/Inspect; no equivalent reprompt | canonical text only; interactive gate fails closed |
| status-bar | `Status unavailable.` → `/status` → inspect | `Health checking.` → wait/Inspect → result | labeled fields → `/status` → owner | warning index → Inspect → affected surface | `ENFORCEMENT UNVERIFIED` → Inspect → no effect | null | `UNKNOWN OUTCOME` stays pinned → Reconcile → recovery | pinned fields plus warning count; JSON/text projection |
| command-completion | `No commands match.` → `/help` → categories | `Loading commands…` → wait/Esc → list | `selected, n of m` → Enter/Tab → command | `Completion unavailable.` → type exact command/help | disabled item says reason → Inspect → supported alternative | `Completion cancelled.` → composer | null | one-line rows; no hidden commands; noninteractive does not open |
| approval-dialog | `No approval.` → close → owner | `Refreshing proposal…` → wait/Cancel → review | exact proposal → Approve/Deny/Cancel → operation | stale/mismatch → Review → fresh evaluation | blocked by policy → Inspect/Cancel → revise | `Approval cancelled.` → owner; no dispatch | `Proposal identity unknown.` → Cancel/Recover | refusal record; no approval or preparation |
| transfer-consent-dialog | `No prepared transfer.` → close → owner | `Preparing local payload…` → Cancel → review | exact recipient/payload → Consent/Deny → dispatch | classification/destination/retention uncertain → Inspect/Cancel → local-only alternative | `Transfer denied.` → inspect → no send | `Consent cancelled.` → owner; no send | `Transfer outcome unknown.` → Reconcile; no retry | no consent prompt; machine-readable refusal/nonzero |
| activity-log | `No activity yet.` → close → owner | `Activity updating…` → inspect → current group | grouped calls → Open/Evidence → source | failed rows with cause → Evidence/Recovery → next | denied rows retain policy reason → inspect → revise | cancelled row → inspect → terminal state | unknown row pinned → reconcile | counts + `show all`; exact safe copy |
| evidence-panel | `No Evidence.` → close → source | `Collecting Evidence…` → wait/Cancel → panel | `complete` or labeled completeness → copy/close → source | sanitized/omitted/stale/corrupt → inspect limitation → recovery | `not-authoritative` → close → no success claim | cancelled collection → close → source | unknown provenance → reconcile/retain unknown | headings and lines only; no raw secrets |
| models-inspection | `Typhoon not configured.` → Connections → onboarding | `Checking Typhoon…` → wait → result | identity/version/capabilities/health → close → owner | typed health → Retest/Connections → result | no model-selection action → close → help | check cancelled → retry/close | identity unverified → inspect; no model claim | stable text; no selection controls |
| tools-catalog | empty registry → Help → catalog explanation | `Loading reviewed catalog…` → wait → list | `working` service → Inspect/Invoke if policy permits | unavailable/unhealthy/quarantined → Diagnose/Retest → service state | `Catalogued — Not available yet` → Inspect only → no invoke | catalog load cancelled → retry/close | capability metadata unknown → no invoke | every row has state token and reason |
| dependency-check | no checks run → Run `/check` → results | `Checking prerequisites…` → Cancel → results | verified/missing list → Inspect/Rerun → owner | probe-failed/incompatible → Inspect/Rerun → remediation | unsupported/denied → Inspect → no install | check cancelled → rerun/close | unknown probe → no effect; `/recover` | one record per check; nonzero if blocker |
| sessions-browser | `No Saved Sessions.` → Create/Help → browser | `Restoring session…` → Cancel only before commit → result | selected session → Open/Inspect → fresh activation | missing/locked/conflicted → Inspect/Recover → read-only | delete/open cancelled → browser | restore outcome unknown → Recovery → no rebind | current/other/missing explicit; text table |
| context-governance | `No Active Model Context.` → close → owner | `Projecting context…` → Cancel → prior projection | manifest/capacity/contributors → Pin/Unpin/Compact → owner | compaction failed/protected overflow → Inspect remedy → no dispatch | action denied → reason → safe remedy | compaction cancelled → preserve prior → owner | capacity unknown → no provider dispatch | text accounting; no donut dependency |
| usage-ledger | `No usage recorded.` → close → owner | `Loading usage…` → wait → ledger | labeled ledger → Inspect/close → owner | unavailable/estimated → Inspect → no invented percentage | null | load cancelled → retry/close | usage unknown → state token | cumulative values only; no percentage |
| rollback-panel | no eligible checkpoint → Help/close → owner | `Loading checkpoints…` → wait → list | eligible preview → Inspect/Select → confirm | expired/corrupt/locked → Evidence/close → recovery | over-cap/unprotected requires explicit confirmation → review → proceed/deny | rollback cancelled → no changes | conflict/unknown → Inspect conflict → skip/export/rebase | one target per section; no generic continue |
| recovery-center | `No recovery items.` → close → owner | `Recovering records…` → wait → list | reconciled outcome → Inspect/close → owner | locked/migration/incomplete → Inspect/Export/Exit → read-only | recovery cancelled → remain blocked → exit | unknown operation → Reconcile/Inspect → no retry | permanent `unknown-outcome` if no safe probe | action matrix emitted; nonzero for unresolved |

## Voice and Tone

Microcopy is plain, calm, actionable, and Thai-capable. Canonical English state tokens remain unchanged in Thai or mixed output. Explanatory Thai may be added, but never translates away `unknown-outcome`, `configured`, `Catalogued — Not available yet`, `Chat interrupted`, `percentage unavailable`, `DESTRUCTIVE`, `FULL ACCESS`, or `ENFORCEMENT UNVERIFIED`.

| Do | Don't |
|---|---|
| `Purpose: extract text. Recipient: T-OCR at <verified host>. Payload: 1 image, redactions: none. Consent is required.` | `Sending image to AI.` |
| `configured. Availability has not been verified.` | `Connected!` after storage only |
| `UNKNOWN OUTCOME: response may have started. Do not retry an equivalent request.` | `Request failed — retrying.` |
| `Evidence: protocol incompatibility. Retest after correcting Service Configuration.` | Model-only diagnosis |
| `Rollback: partial. 2 applied; 1 conflict; shell effects excluded.` | `Everything rolled back.` |

## Component Patterns

Behavioral rules; visual specifications live in `DESIGN.md §Components`. Canonical identifiers are lowercase kebab-case everywhere: `shell`, `status-bar`, `prompt-composer`, `transcript`, `activity-log`, `approval-dialog`, `transfer-consent-dialog`, `evidence-panel`, `specialist-card`, `context-donut`, `session-browser`, `rollback-panel`, `command-completion`, `credential-form`, `completion-summary`, `warning-index`, `recovery-center`.

| Component | Behavioral contract |
|---|---|
| `shell` | Stable logical order: status, warning-index, transcript/activity, overlay/result, composer. Never hides durable facts in redirected/headless forms. |
| `status-bar` | Persistent authority summary: Workspace fingerprint, Runtime Activation revision, Work Mode, Permission Profile, Full Access, Boundary Expansion count/expiry, transfer-consent state, enforcement state, Typhoon/service health, context, unresolved outcome. |
| `prompt-composer` | State machine below; preserves preedit, graphemes, technical tokens, draft, cursor, selection, and cell-width wrapping across events/resizes. |
| `transcript` | Durable chunks once; specialist output, Typhoon explanation, Evidence, progress, and `Chat interrupted` have separate headings. |
| `activity-log` | Group by Prompt Round and operation class by default; every call remains available through `show all`, filters, counts, correlation, and copy. |
| `approval-dialog` | Purpose/risk first, exact effect second; initial focus non-committing; stale invalidation prevents approval; Esc never authorizes. |
| `transfer-consent-dialog` | Independent explicit consent for every remote transfer; shows recipient, payload identity, classification, retention, transformation, expiry, and exact digests. |
| `evidence-panel` | Shows deterministic classification before explanation, completeness/provenance, omission reasons, observation/display times, and safe copy. |
| `specialist-card` | Separates `working`, `Catalogued — Not available yet`, `disabled`, `unconfigured`, `unhealthy`, `quarantined`; Release 1 has four reviewed invokable services only. |
| `context-donut` | Percentage plus text severity; `percentage unavailable` and categorized tokens replace the visual at narrow/unknown widths. |
| `session-browser` | `/session` canonical, `/sessions` alias; stable search/sort/navigation, duplicate-name disambiguation, Workspace state, lifecycle, and restore progress. |
| `rollback-panel` | Three-way conflict inspection and safe skip/export/rebase or user-authored resolution; never generic overwrite/continue. |
| `command-completion` | Categorized essential-first results; selected row says `selected, n of m`; async result set freezes during key activation. |
| `credential-form` | Masked/non-echoing, no accessible value, no clipboard/scrollback/log/snapshot/error leakage; cancel clears buffers. |
| `completion-summary` | Separate operation and Prompt Round status; aggregate uses strongest unresolved state; post-commit only. |
| `warning-index` | Stable warning IDs, severity/authority order, count, inspect action, deterministic traversal, and linearized/redirected representation. |
| `recovery-center` | One entry point and action matrix for inspect, reconcile, reprompt, retry-disabled, export-safe Evidence, and exit. |

## State Patterns

### Canonical state/status dimensions

The canonical state vocabulary is divided into **five mechanically distinct dimensions** that must never be conflated (see Architecture AD-28 and `ux-state-v1`):

1. **Operation status** (terminal outcome of an operation): `succeeded`, `failed`, `blocked`, `malformed`, `denied`, `refused`, `cancelled`, `unknown-outcome`, `reconciled`, `partial`, `accepted-limitation`, `not sent`, `possibly dispatched`, `response started`, `interruption-cancelled`, `interruption-unknown`, `full`, `conflict`, `expired`, `corrupt`, `locked`, `partially protected`, `unprotected`, `never-protected`, `over-cap`, `probe-failed`, `inaccessible`, `incompatible`, `migration-failed`, `excluded`, `dismissed`, `authority-revoked`, `deleted`, `recovery-locked`.
2. **Lifecycle fact** (nonterminal observation about a state transition; never itself a terminal outcome): `unconfigured`, `configured`, `checking`, `available`, `unhealthy`, `quarantined`, `working`, `Catalogued — Not available yet`, `disabled`, `stale`, `mismatch`, `proposed`, `authorized`, `prepared`, `dispatch-committed`, `cancel-requested`, `cancel-acknowledged`, `still-running`, `deletion-pending`, `migration-pending`, `cancellation-requested`, `effect-already-committed`, `DESTRUCTIVE`, `FULL ACCESS`, `ENFORCEMENT UNVERIFIED`, `fully protected`.
3. **Evidence completeness** (qualifier of an Evidence record; never a terminal operation state): `complete`, `partial`, `sanitized-with-omissions`, `stale`, `unavailable`, `corrupt`, `not-authoritative`.
4. **Measurement quality** (qualifier of a measured value; never a terminal operation state): `estimated`, `provider-reported`, `locally-measured`, `fallback`, `unknown`, `percentage unavailable`.
5. **Provider-deletion lifecycle** (conditional on a verified provider contract that supports it; see Sensitive-data transfer policy below): `upstream-no-retention-verified`, `deletion-not-required`, `deletion-pending`, `deletion-confirmed`, `deletion-failed`.

Display tokens are emitted unchanged in English, Thai, mixed output, Evidence, completion, redirected text, and headless JSON; localized explanation follows each token. `configured` never means `available`. `succeeded` is only observed success. `complete` describes a sealed stream or complete Evidence, not necessarily a successful Prompt Round. `effect-already-committed` means dispatch commit was observed before cancellation/revocation; the underlying effect may still succeed, fail, or remain unknown, and it is a **lifecycle fact**, never a terminal `succeeded` outcome. Unknown, partial, blocked, cancelled, and unverified states never lead with affirmative success language.

`COMMAND_ERROR` is a fixed error display heading layered over a canonical operation status of `blocked` or `malformed`; it is not itself a registry row, not a distinct operation status, and not a 74th state. Aliases are not additional states: `unconfigured` is the sole canonical token for the display alias `not-configured`; `Catalogued — Not available yet` is the sole canonical catalog token for `catalogued` and `not-available-yet`; `percentage unavailable` is the sole measurement token for `not-measured`; `stale` is used for both proposal and Evidence freshness; `interrupted` is a display alias resolved to `interruption-cancelled` or `interruption-unknown` and is shown to users under the `Chat interrupted` heading; `applied`, `skipped`, `conflict`, `blocked`, `excluded`, `failed`, and `never-protected` are canonical rollback target outcomes without contextual suffixes. `working` remains distinct from `available` and never maps to it.

### Versioned state/copy catalog

Catalog version `ux-state-v1` is the single cross-surface vocabulary. Each canonical token is emitted unchanged in English, Thai, mixed output, Evidence, completion, redirected text, and headless JSON; localized explanation follows it. Every catalog entry carries cause-code mapping, retryability, recovery action, exit class, narrow form, and noninteractive form.

The complete `ux-state-v1` projection contract below is authoritative. It groups rows by the five dimensions above (operation status, lifecycle fact, Evidence completeness, measurement quality, provider-deletion lifecycle) so that a row's dimension determines whether it is a terminal operation outcome, a nonterminal lifecycle fact, or a qualifier that never independently terminates an operation. Aliases are not additional states: `unconfigured` is the sole canonical token for the display alias `not-configured`; `Catalogued — Not available yet` is the sole canonical catalog token for `catalogued` and `not-available-yet`; `percentage unavailable` is the sole measurement token for `not-measured`; `stale` is used for both proposal and Evidence freshness; `interrupted` is a display alias resolved to `interruption-cancelled` or `interruption-unknown` and is shown to users under the `Chat interrupted` heading; `applied`, `skipped`, `conflict`, `blocked`, `excluded`, `failed`, and `never-protected` are canonical rollback target outcomes without contextual suffixes. `working` remains distinct from `available` and never maps to it. Every operation-status row has exactly one English token, explicit terminality, exactly one symbolic exit class (`NONE` for every nonterminal row), narrow/noninteractive form, and Thai-capable localized explanation. Lifecycle-fact and qualifier rows carry `NONE` exit class unless they are also emitted as a terminal operation outcome in the same row. Its JSON status is the lowercase hyphenated token in the first column, except `Catalogued — Not available yet` → `catalogued-not-available-yet`, `Chat interrupted` → `chat-interrupted`, and uppercase authority labels → their lowercase hyphenated forms. The catalog is versioned as `ux-state-v1` and snapshots are required across Ink, linearized, redirected, headless, Evidence, and completion outputs.

#### Mechanical status registry

The registry below is the machine contract. The behavior rows that follow are keyed by these exact display tokens and add cause, retry, recovery, narrow, and localized guidance.

| Display token | JSON status | Terminality | Exit class | Exit code |
|---|---|---|---|---:|
| `unconfigured` | `unconfigured` | terminal | `BLOCKED` | 20 |
| `configured` | `configured` | nonterminal | `NONE` | null |
| `checking` | `checking` | nonterminal | `NONE` | null |
| `available` | `available` | nonterminal | `NONE` | null |
| `unavailable` | `unavailable` | terminal | `BLOCKED` | 20 |
| `unhealthy` | `unhealthy` | terminal | `FAILED` | 1 |
| `quarantined` | `quarantined` | terminal | `BLOCKED` | 20 |
| `working` | `working` | nonterminal | `NONE` | null |
| `Catalogued — Not available yet` | `catalogued-not-available-yet` | terminal | `BLOCKED` | 20 |
| `disabled` | `disabled` | terminal | `BLOCKED` | 20 |
| `stale` | `stale` | terminal | `BLOCKED` | 20 |
| `mismatch` | `mismatch` | terminal | `BLOCKED` | 20 |
| `blocked` | `blocked` | terminal | `BLOCKED` | 20 |
| `denied` | `denied` | terminal | `BLOCKED` | 20 |
| `refused` | `refused` | terminal | `BLOCKED` | 20 |
| `malformed` | `malformed` | terminal | `FAILED` | 1 |
| `proposed` | `proposed` | nonterminal | `NONE` | null |
| `authorized` | `authorized` | nonterminal | `NONE` | null |
| `prepared` | `prepared` | nonterminal | `NONE` | null |
| `dispatch-committed` | `dispatch-committed` | nonterminal | `NONE` | null |
| `succeeded` | `succeeded` | terminal | `SUCCESS` | 0 |
| `failed` | `failed` | terminal | `FAILED` | 1 |
| `cancel-requested` | `cancel-requested` | nonterminal | `NONE` | null |
| `cancel-acknowledged` | `cancel-acknowledged` | nonterminal | `NONE` | null |
| `still-running` | `still-running` | nonterminal | `NONE` | null |
| `cancelled` | `cancelled` | terminal | `CANCELLED` | 130 |
| `unknown-outcome` | `unknown-outcome` | terminal | `UNKNOWN_OUTCOME` | 70 |
| `reconciled` | `reconciled` | terminal | `SUCCESS` | 0 |
| `not sent` | `not-sent` | terminal | `BLOCKED` | 20 |
| `possibly dispatched` | `possibly-dispatched` | terminal | `UNKNOWN_OUTCOME` | 70 |
| `response started` | `response-started` | terminal | `UNKNOWN_OUTCOME` | 70 |
| `interruption-cancelled` | `interruption-cancelled` | terminal | `CANCELLED` | 130 |
| `interruption-unknown` | `interruption-unknown` | terminal | `UNKNOWN_OUTCOME` | 70 |
| `complete` | `complete` | nonterminal | `NONE` | null |
| `partial` | `partial` | terminal | `PARTIAL` | 30 |
| `accepted-limitation` | `accepted-limitation` | terminal | `ACCEPTED_LIMITATION` | 10 |
| `percentage unavailable` | `percentage-unavailable` | nonterminal (measurement qualifier) | `NONE` | null |
| `Chat interrupted` | `chat-interrupted` | terminal | `UNKNOWN_OUTCOME` | 70 |
| `full` | `full` | terminal | `SUCCESS` | 0 |
| `conflict` | `conflict` | terminal | `BLOCKED` | 20 |
| `expired` | `expired` | terminal | `BLOCKED` | 20 |
| `corrupt` | `corrupt` | terminal | `FAILED` | 1 |
| `locked` | `locked` | terminal | `BLOCKED` | 20 |
| `fully protected` | `fully-protected` | nonterminal | `NONE` | null |
| `partially protected` | `partially-protected` | terminal | `PARTIAL` | 30 |
| `unprotected` | `unprotected` | terminal | `BLOCKED` | 20 |
| `DESTRUCTIVE` | `destructive` | nonterminal | `NONE` | null |
| `FULL ACCESS` | `full-access` | nonterminal | `NONE` | null |
| `ENFORCEMENT UNVERIFIED` | `enforcement-unverified` | terminal | `BLOCKED` | 20 |
| `probe-failed` | `probe-failed` | terminal | `FAILED` | 1 |
| `inaccessible` | `inaccessible` | terminal | `BLOCKED` | 20 |
| `incompatible` | `incompatible` | terminal | `BLOCKED` | 20 |
| `over-cap` | `over-cap` | terminal | `BLOCKED` | 20 |
| `never-protected` | `never-protected` | terminal | `BLOCKED` | 20 |
| `deleted` | `deleted` | terminal | `BLOCKED` | 20 |
| `recovery-locked` | `recovery-locked` | terminal | `BLOCKED` | 20 |
| `migration-pending` | `migration-pending` | nonterminal | `NONE` | null |
| `migration-failed` | `migration-failed` | terminal | `FAILED` | 1 |
| `sanitized-with-omissions` | `sanitized-with-omissions` | nonterminal (Evidence-completeness qualifier) | `NONE` | null |
| `estimated` | `estimated` | nonterminal (measurement-quality qualifier) | `NONE` | null |
| `not-authoritative` | `not-authoritative` | terminal | `BLOCKED` | 20 |
| `applied` | `applied` | terminal | `SUCCESS` | 0 |
| `skipped` | `skipped` | terminal | `PARTIAL` | 30 |
| `excluded` | `excluded` | terminal | `BLOCKED` | 20 |
| `upstream-no-retention-verified` | `upstream-no-retention-verified` | nonterminal (provider-deletion lifecycle fact; conditional on verified provider contract) | `NONE` | null |
| `deletion-not-required` | `deletion-not-required` | nonterminal (provider-deletion lifecycle fact; conditional on verified provider contract) | `NONE` | null |
| `deletion-pending` | `deletion-pending` | nonterminal | `NONE` | null |
| `deletion-confirmed` | `deletion-confirmed` | nonterminal (provider-deletion lifecycle fact; conditional on verified provider contract) | `NONE` | null |
| `deletion-failed` | `deletion-failed` | terminal | `FAILED` | 1 |
| `dismissed` | `dismissed` | terminal | `BLOCKED` | 20 |
| `authority-revoked` | `authority-revoked` | terminal | `BLOCKED` | 20 |
| `cancellation-requested` | `cancellation-requested` | nonterminal | `NONE` | null |
| `effect-already-committed` | `effect-already-committed` | nonterminal (lifecycle fact; the underlying effect outcome is observed separately) | `NONE` | null |

| Token | JSON status | Cause | Retry | Recovery | Exit class (terminality; exactly one) | Narrow/noninteractive | Localized form |
|---|---|---|---|---|---|---|---|
| `unconfigured` | `unconfigured` | missing configuration | user may configure | `/connections` | terminal; BLOCKED | `UNCONFIGURED`; JSON `unconfigured` | token + Thai setup explanation |
| `configured` | `configured` | stored configuration only | no implicit check | inspect or explicit retest | nonterminal; NONE | `CONFIGURED`; JSON `configured` | token + Thai availability distinction |
| `checking` | `checking` | explicit check in progress | wait/cancel | inspect result | nonterminal; NONE | `CHECKING`; JSON `checking` | token + Thai progress explanation |
| `available` | `available` | verified health | no retry needed | inspect generation | nonterminal; NONE | `AVAILABLE`; JSON `available` | token + Thai verified-health explanation |
| `unavailable` | `unavailable` | typed dependency/config cause | only typed safe retry | correct config/retest | terminal; BLOCKED | `UNAVAILABLE`; stderr/JSON cause field | token + Thai cause/remedy |
| `unhealthy` | `unhealthy` | deterministic service evidence | explicit retest only | inspect Evidence/correct/retest | terminal; FAILED | `UNHEALTHY` | token + Thai evidence explanation |
| `quarantined` | `quarantined` | proven scoped health failure | no invoke until retest | correct and retest | terminal; BLOCKED | `QUARANTINED` | token + Thai scope explanation |
| `working` | `working` | reviewed invokable capability | operation-specific | inspect/invoke if authorized | nonterminal; NONE | `WORKING`; JSON `working` | token + Thai capability explanation |
| `Catalogued — Not available yet` | `catalogued-not-available-yet` | known but not Release 1 invokable | never invoke | inspect manifest only | terminal; BLOCKED | exact token; JSON `catalogued-not-available-yet` | exact token + Thai availability explanation |
| `disabled` | `disabled` | user/system disabled capability | explicit enable only if reviewed | inspect/enable | terminal; BLOCKED | `DISABLED` | token + Thai control explanation |
| `stale` | `stale` | identity or authority changed | fresh review required | review current proposal | terminal; BLOCKED | `STALE: review required` | token + Thai mismatch explanation |
| `mismatch` | `mismatch` | digest/manifest differs | never reuse approval | regenerate and review | terminal; BLOCKED | `MISMATCH: no send` | token + Thai identity explanation |
| `blocked` | `blocked` | policy, boundary, or missing interaction | no automatic retry | inspect/revise/re-run interactively | terminal; BLOCKED | `BLOCKED` | token + Thai remedy |
| `denied` | `denied` | explicit policy/user denial | user may revise | inspect decision | terminal; BLOCKED | `DENIED` | token + Thai decision explanation |
| `refused` | `refused` | hard refusal or unsupported request | no retry without changed input | inspect limitation | terminal; BLOCKED | `REFUSED` | token + Thai limitation |
| `malformed` | `malformed` | invalid proposal/command | no model/provider repair | inspect validation | terminal; FAILED | `MALFORMED` | token + Thai validation explanation |
| `proposed` | `proposed` | untrusted proposal awaiting review | no retry | review exact identity | nonterminal; NONE | `PROPOSED` | token + Thai review instruction |
| `authorized` | `authorized` | bounded approval recorded | no retry | prepare same identity | nonterminal; NONE | `AUTHORIZED` | token + Thai authority explanation |
| `prepared` | `prepared` | local preparation complete | cancel before dispatch | inspect manifest/cancel | nonterminal; NONE | `PREPARED`; noninteractive blocked | token + Thai prepared-state explanation |
| `dispatch-committed` | `dispatch-committed` | effect may have started | no cancel guarantee | inspect/reconcile | nonterminal; NONE | `DISPATCH COMMITTED` | token + Thai residual-risk explanation |
| `succeeded` | `succeeded` | observed verification passed | no retry | inspect Evidence | terminal; SUCCESS | `SUCCEEDED`; JSON `succeeded` | token + Thai verified result |
| `failed` | `failed` | typed terminal failure | only cause-marked safe retry | inspect Evidence/recovery | terminal; FAILED | `FAILED` | token + Thai cause/remedy |
| `cancel-requested` | `cancel-requested` | user requested cancellation | do not duplicate | await acknowledgement | nonterminal; NONE | `CANCEL REQUESTED` | token + Thai lifecycle explanation |
| `cancel-acknowledged` | `cancel-acknowledged` | cancellation accepted | no duplicate | inspect cleanup | nonterminal; NONE | `CANCEL ACKNOWLEDGED` | token + Thai acknowledgement |
| `still-running` | `still-running` | cancellation/cleanup pending | no duplicate | wait/inspect/exit | nonterminal; NONE | `STILL RUNNING` | token + Thai wait explanation |
| `cancelled` | `cancelled` | cancellation completed | no retry unless new intent | inspect cleanup | terminal; CANCELLED | `CANCELLED` | token + Thai cancellation |
| `unknown-outcome` | `unknown-outcome` | possible remote effect | never automatic/equivalent retry | reconcile or retain | terminal; UNKNOWN_OUTCOME | `UNKNOWN OUTCOME: do not retry` | token + Thai residual risk |
| `reconciled` | `reconciled` | provider/service lookup or safe probe closed state | no retry | inspect reconciliation Evidence | terminal; SUCCESS | `RECONCILED`; JSON `reconciled` | token + Thai reconciliation |
| `not sent` | `not-sent` | dispatch not begun | safe to revise | inspect and reprompt | terminal; BLOCKED | `NOT SENT`; JSON `not-sent` | token + Thai no-send explanation |
| `possibly dispatched` | `possibly-dispatched` | dispatch status uncertain | no equivalent retry | reconcile | terminal; UNKNOWN_OUTCOME | `POSSIBLY DISPATCHED`; JSON `possibly-dispatched` | token + Thai uncertainty |
| `response started` | `response-started` | remote output observed | no automatic retry | inspect/reconcile | terminal; UNKNOWN_OUTCOME | `RESPONSE STARTED`; JSON `response-started` | token + Thai partial-output explanation |
| `interruption-cancelled` | `interruption-cancelled` | stream stopped and cancellation confirmed | no automatic retry | inspect cleanup/reprompt | terminal; CANCELLED | `INTERRUPTION-CANCELLED`; JSON `interruption-cancelled` | token + Thai interruption |
| `interruption-unknown` | `interruption-unknown` | stream stopped with remote effect unresolved | no automatic retry | inspect/reconcile | terminal; UNKNOWN_OUTCOME | `INTERRUPTION-UNKNOWN`; JSON `interruption-unknown` | token + Thai interruption |
| `complete` | `complete` | stream/Evidence sealed | no retry implied | inspect result | nonterminal; NONE | `COMPLETE` | token + Thai sealed-state explanation |
| `partial` | `partial` | some scope completed, some unresolved | only explicit safe follow-up | inspect exclusions | terminal; PARTIAL | `PARTIAL` | token + Thai limitation |
| `accepted-limitation` | `accepted-limitation` | user explicitly accepted disclosed limitation | no automatic retry | inspect accepted scope and residual risk | terminal; ACCEPTED_LIMITATION | `accepted-limitation`; JSON `accepted-limitation` | token + Thai acceptance explanation |
| `percentage unavailable` | `percentage-unavailable` | denominator/source unavailable | no invented value | inspect `/context` source | nonterminal (measurement qualifier); NONE | exact token | token + Thai measurement explanation |
| `Chat interrupted` | `chat-interrupted` | durable transcript boundary | no automatic retry | `/recover` | terminal; UNKNOWN_OUTCOME | exact phrase; JSON `chat-interrupted` | exact phrase + Thai explanation |
| `full` | `full` | rollback aggregate all eligible targets applied | no retry | inspect per-target Evidence | terminal; SUCCESS | `FULL ROLLBACK`; JSON `full` | token + Thai result |
| `conflict` | `conflict` | current state differs from checkpoint | never overwrite | three-way inspect/skip/export/rebase | terminal; BLOCKED | `CONFLICT: resolve target` | token + Thai resolution |
| `expired` | `expired` | retention window elapsed | not recoverable by retry | inspect retention | terminal; BLOCKED | `EXPIRED` | token + Thai retention |
| `corrupt` | `corrupt` | Evidence/checkpoint integrity failure | no retry | recovery/export safe metadata | terminal; FAILED | `CORRUPT` | token + Thai integrity |
| `locked` | `locked` | store/key unavailable | no effect retry | read-only recovery/exit | terminal; BLOCKED | `LOCKED` | token + Thai recovery |
| `fully protected` | `fully-protected` | complete built-in checkpoint coverage | no retry implied | inspect checkpoint | nonterminal; NONE | `PROTECTED` | token + Thai coverage |
| `partially protected` | `partially-protected` | some changes excluded/unprotected | no retry implied | inspect exclusions/confirm | terminal; PARTIAL | `PARTIAL PROTECTION` | token + Thai limitation |
| `unprotected` | `unprotected` | no rollback protection | no retry implied | inspect and explicit confirm | terminal; BLOCKED | `UNPROTECTED` | token + Thai consequence |
| `DESTRUCTIVE` | `destructive` | deletion or destructive scope | never implicit | review exact scope | nonterminal; NONE | exact token; JSON `destructive` | token + Thai risk |
| `FULL ACCESS` | `full-access` | active broad eligible authority | no implicit grant | inspect/revoke | nonterminal; NONE | exact token; JSON `full-access` | token + Thai scope/expiry |
| `ENFORCEMENT UNVERIFIED` | `enforcement-unverified` | platform/action matrix absent | never proceed with affected effect | inspect dependency | terminal; BLOCKED | exact token | token + Thai unavailable explanation |
| `probe-failed` | `probe-failed` | prerequisite probe failed | explicit rerun after correction | `/check`/Evidence | terminal; FAILED | `PROBE FAILED` | token + Thai remediation |
| `inaccessible` | `inaccessible` | path/resource cannot be read safely | no automatic retry | inspect Workspace/permissions | terminal; BLOCKED | `INACCESSIBLE` | token + Thai access explanation |
| `incompatible` | `incompatible` | version/protocol/platform mismatch | no retry without changed dependency | inspect and correct | terminal; BLOCKED | `INCOMPATIBLE` | token + Thai compatibility |
| `over-cap` | `over-cap` | rollback checkpoint/store cap exceeded | only explicit unprotected confirmation | inspect capacity/confirm | terminal; BLOCKED | `OVER CAP` | token + Thai retention consequence |
| `never-protected` | `never-protected` | effect excluded from rollback scope | cannot restore through thcode | inspect exclusions | terminal; BLOCKED | `NEVER PROTECTED`; JSON `never-protected` | token + Thai limitation |
| `deleted` | `deleted` | session deletion completed | not recoverable through session | create/open another session | terminal; BLOCKED | `DELETED` | token + Thai deletion |
| `recovery-locked` | `recovery-locked` | recovery requires unavailable key/store | no effect retry | read-only inspect/export/exit | terminal; BLOCKED | `RECOVERY LOCKED` | token + Thai recovery |
| `migration-pending` | `migration-pending` | store migration not complete | wait/cancel | inspect migration state | nonterminal; NONE | `MIGRATION PENDING` | token + Thai migration |
| `migration-failed` | `migration-failed` | store migration failed | no overwrite/retry loop | read-only recovery/export/exit | terminal; FAILED | `MIGRATION FAILED` | token + Thai migration failure |
| `sanitized-with-omissions` | `sanitized-with-omissions` | sensitive/raw material removed | no retry to reveal secrets | inspect omission reasons | nonterminal (Evidence qualifier); NONE | `SANITIZED: omissions`; JSON `sanitized-with-omissions` | token + Thai Evidence limit |
| `estimated` | `estimated` | value is not provider-verified | no claim of certainty | inspect estimate source | nonterminal (measurement qualifier); NONE | `ESTIMATED`; JSON `estimated` | token + Thai estimate |
| `not-authoritative` | `not-authoritative` | model explanation or incomplete proof | never treat as proof | inspect deterministic Evidence | terminal; BLOCKED | `NOT AUTHORITATIVE`; JSON `not-authoritative` | token + Thai authority limit |
| `applied` | `applied` | conflict-free reversal verified | no retry | inspect target Evidence | terminal; SUCCESS | `APPLIED` | token + Thai target result |
| `skipped` | `skipped` | user skipped target | no retry implied | inspect reason/export patch | terminal; PARTIAL | `SKIPPED` | token + Thai target result |
| `excluded` | `excluded` | effect outside built-in scope | never claim reversed | inspect exclusions | terminal; BLOCKED | `EXCLUDED`; JSON `excluded` | token + Thai scope |
| `upstream-no-retention-verified` | `upstream-no-retention-verified` | exact provider handling verified for this contract, recipient, capability/version, generation, and scope | no retry needed | inspect recipient/generation Evidence | nonterminal (provider-deletion lifecycle fact; conditional on verified provider contract); NONE | `NO RETENTION VERIFIED`; JSON `upstream-no-retention-verified` | token + Thai scope-qualified explanation |
| `deletion-not-required` | `deletion-not-required` | verified provider contract requires no deletion | no retry | inspect provider policy Evidence | nonterminal (provider-deletion lifecycle fact; conditional on verified provider contract); NONE | `DELETION NOT REQUIRED`; JSON `deletion-not-required` | token + Thai scope-qualified explanation |
| `deletion-pending` | `deletion-pending` | Saved Session deletion or disclosed provider buffer requires deletion | wait; no reopen or new transfer | inspect actor/trigger/status | nonterminal; NONE | `DELETION PENDING` | token + Thai pending explanation |
| `deletion-confirmed` | `deletion-confirmed` | provider-confirmed deletion Evidence for this contract | no retry | inspect confirmation | nonterminal (provider-deletion lifecycle fact; conditional on verified provider contract); NONE | `DELETION CONFIRMED`; JSON `deletion-confirmed` | token + Thai confirmation |
| `deletion-failed` | `deletion-failed` | provider deletion failed or cannot be confirmed | only explicitly safe deletion retry | quarantine, inspect, reconcile/escalate | terminal; FAILED | `DELETION FAILED`; JSON `deletion-failed` | token + Thai failure/no-claim explanation |
| `dismissed` | `dismissed` | user dismissed a pending decision | no automatic resume | reopen exact operation for fresh review | terminal; BLOCKED | `DISMISSED`; JSON `dismissed` | token + Thai non-authorizing explanation |
| `authority-revoked` | `authority-revoked` | Full Access or Boundary Expansion revoked | no automatic retry | inspect affected operation and re-review | terminal; BLOCKED | `AUTHORITY REVOKED`; JSON `authority-revoked` | token + Thai revocation |
| `cancellation-requested` | `cancellation-requested` | user requested cancellation | no duplicate operation | await acknowledgement | nonterminal; NONE | `CANCELLATION REQUESTED`; JSON `cancellation-requested` | token + Thai lifecycle |
| `effect-already-committed` | `effect-already-committed` | dispatch commit observed before cancellation/revocation | no retry | inspect committed effect Evidence and the operation's actual terminal outcome | nonterminal (lifecycle fact; NOT a success outcome); NONE | `EFFECT ALREADY COMMITTED`; JSON `effect-already-committed` | token + Thai residual-effect explanation |

### Composer state machine

`empty → editing → composing-ime → editing`; `editing → completion-open → editing`; `editing → submitted → streaming`; `streaming → interrupted | completed`; any state → `overlay-blocked` while a topmost overlay owns focus; `overlay-blocked → prior state` only by deterministic logical control ID; `interrupted → editing` only after the user chooses reprompt; `interrupted → recovery` for reconcile.

- IME preedit is separate from committed text. `Enter`, `Ctrl+D`, and prompt submit do nothing to the provider while preedit is active; `Esc` first cancels preedit, preserving committed text.
- Cursor, delete, selection, and history operate on grapheme clusters, never code units. Thai combining marks, emoji/ZWJ sequences, and mixed-script clusters remain indivisible.
- Wrapping and cursor placement use terminal cell width, not string length. Normalization is not applied to user text; committed bytes are preserved.
- Multiline paste preserves line breaks and bytes. Normatively, `Enter` submits committed text when no completion, overlay, or IME composition owns the key; `Shift+Enter` inserts a newline. On terminals that cannot distinguish `Shift+Enter`, the configurable alternate `Ctrl+J` inserts a newline by default; the setting is visible in `/settings` and never changes IME precedence. While IME preedit is active, neither submit nor newline is dispatched to the provider; the IME handles the key first.
- Up/Down history is available when the cursor is at the first/last visual line; draft is saved and restored when leaving history. History never stores secrets.
- While streaming, composer remains editable only for a separate draft; it never queues or dispatches automatically. `Esc` first dismisses completion/overlay, then requests interruption according to precedence; it never discards a draft without confirmation.
- Technical tokens are atomic spans for wrapping; an expanded view may scroll horizontally. Copy/export returns original bytes with no inserted wrap markers.

### Keyboard, focus, and overlay matrix

Focus is logical-ID based, not row-index based. A topmost overlay owns a one-level focus trap; nested overlays are prohibited except a bounded Evidence inspector opened from an overlay, which replaces the prior overlay and returns to its logical control. Entry focus is deterministic; disabled/unavailable controls are skipped and their reason remains inspectable.

| Surface/state | Initial focus | Tab / Shift+Tab | Arrows | Enter / Space | Esc | Return focus |
|---|---|---|---|---|---|---|
| main-conversation | `prompt-composer` | composer-local controls then `warning-index`, activity, transcript inspect, status | cursor/history; otherwise list movement | Enter submits only committed text | dismiss completion/overlay; otherwise cancel/interrupt per lifecycle | same logical ID |
| command-completion | `completion-input` | cycles input → results → close; reverse with Shift+Tab | move result; announces `selected, n of m` | run selected command | close; composer restored | `prompt-composer` |
| approval-dialog | `approval-cancel` if present, else `approval-review` | review → details → deny → cancel → approve last | choice/details sections; no implicit approve | Space activates focused control; Enter activates only focused control and announces action/identity | non-authorizing dismiss/cancel; stale or prepared operation becomes `dismissed` | owner logical ID or fresh review |
| transfer-consent-dialog | `consent-cancel` or `consent-review` | review → details → deny → cancel → consent last | detail sections | Enter/Space only focused control; Consent announces recipient and digest | cancel/dismiss; no send | owner logical ID |
| evidence-panel | `evidence-close` | close → sections → copy → source links | section navigation | open/copy focused section | close | source row/control |
| session-browser | `session-search` | search → rows → actions | row movement; stable selection | open/inspect focused row | close | command owner |
| recovery-center | `recovery-inspect` | inspect → reconcile → export → exit | recovery item/action movement | activate selected safe action | return to owner only if no unresolved destructive state | affected operation row |
| credential-form | `credential-input` after disclosure | input → check/replace/remove/cancel | field movement | submit only after disclosure; Space toggles nonsecret options | clear secret buffer and cancel current form | onboarding action |

`Ctrl+C` and `Ctrl+D` follow the lifecycle matrix below. `Shift+Tab` toggles Plan/Build only when no overlay, completion, IME preedit, or text selection owns the key. `Tab` accepts completion only when completion is open; elsewhere it traverses. Space never submits the composer. All activation controls have visible text labels and non-color selected state.

### Stale approval and safe initial focus

Approval/consent becomes `stale` immediately when OperationId, action/payload/manifest/context digest, target pre-image, Workspace identity, Runtime Activation revision, Work Mode, Permission Profile, Boundary Expansion, Full Access, endpoint/origin, Service Configuration generation, classification, retention policy, or expiry changes. The active Approve/Consent control is disabled before the next key event. The overlay announces `Proposal stale: details changed; no effect was authorized.` It shows prior and current short identities, preserves the stale decision in Evidence as non-authorizing, and moves focus to `Review` or `Cancel`. Fresh policy evaluation and a new review are required. Enter/Space cannot bypass this state.

### Warning composition and width tiers

Warnings are never overwritten. `warning-index` orders by: (1) `UNKNOWN OUTCOME`/possible remote effect, (2) stale approval or transfer-consent mismatch, (3) hard-boundary/enforcement-unverified, (4) active `FULL ACCESS`, (5) rollback conflict, (6) protected context overflow, (7) destructive pending decision, (8) quarantined/unhealthy dependency, (9) ordinary context pressure. Every warning has a stable ID, canonical token, one-line summary, count, inspect action, and acknowledgement state. Acknowledgement never clears a safety warning; it only suppresses repeat announcement until state changes.

Always-pinned expanded fields: Workspace, Work Mode, Permission Profile, Full Access, transfer-consent state, Runtime Activation revision, and enforcement state. The alert slot shows the highest-priority warning plus `+N warnings`; `/status` and `warning-index` traversal expose all in the stated order. Redirected/headless output emits the full ordered list.

| Width | Layout contract |
|---|---|
| 40 columns | Minimum supported tier. One-column status labels; pinned fields use stable abbreviations `WS`, `MODE`, `PROFILE`, `FA`, `XFER`, `ACT`, `ENF`; alert line is separate; composer and focused action remain reachable; details scroll vertically; donut is text `CTX 82% 70–84%`. |
| 60 columns | Pinned fields use two compact rows; alert slot shows token + count; transcript/activity group to one-line summaries; approval actions remain in a separate final row. |
| 80 columns | Pinned fields fit in status rows; alert slot shows token + summary; activity groups and composer remain visible when not inspecting. |
| 120 columns | Full labels, short fingerprints, service/endpoint summary, and expanded activity columns may appear; no additional authority is introduced. |

Below 40 columns the UI switches to command-oriented text mode, preserving heading, purpose, risk, exact target, action, outcome, next step; it does not clip or silently hide safety fields. Golden fixtures exist at 40/60/80/120 columns, truecolor/256/16/monochrome/inverted/invisible-color modes.

### Streaming, activity, and long output

The viewport auto-follows live output until the user moves upward. Scrolling preserves position; a `N new output` control appears with `g` jump-to-live and `b` jump-to-interruption-boundary. `j/k` or arrows move by logical line/row; `PageUp/PageDown` page; `Home/End` move to transcript bounds. Replay and resize preserve the logical anchor, not a row index.

Activity is grouped by Prompt Round, then operation class, with count, first/last state, and duration. `show all` expands every call; `/activity --all`, `/activity --filter <state>`, and copy/detail actions are explicit command contracts. Truncation always states `showing x of y lines` and offers `expand`, `next`, `previous`, and `copy`; expanded output retains safe redaction and original bytes. No visual affordance is mouse-only.

A linearized/screen-reader stream emits durable headings and state transitions once, deduplicated by immutable EventId. Token deltas are quiet by default; a completed chunk group, approval stale event, cancellation transition, `Chat interrupted`, and terminal outcome are polite announcements. `quiet` suppresses transient progress but never durable warnings/outcomes; `live` announces each grouped update. Ink redraw never becomes the semantic source.

Motion is optional and nonsemantic. Reduced-motion or `THCODE_REDUCED_MOTION=1` uses static `checking…`, elapsed time, and one transition line; no blink and no spinner is required. Redraw cannot erase durable facts.

### Interruption and cancellation lifecycle

Two phases are always visible: request and acknowledgement. `prepared → cancel-requested → cancel-acknowledged → cancelled` when no dispatch committed; after commit, cancellation can become `still-running`, `succeeded`, `failed`, or `unknown-outcome`, never an unsupported claim of cancellation. Acknowledgement timeout shows `still-running`; the durable operation row stays visible. Local commands show process-tree cleanup Evidence; remote work shows dispatch classification. Repeated Ctrl+C does not start a duplicate operation. A new equivalent attempt is blocked while unresolved unless the user explicitly chooses a separately identified operation and accepts the residual risk.

`Ctrl+C`: in IME preedit cancels preedit; in completion/overlay cancels the topmost surface; in prepared work requests cancellation; in running work requests cancellation and announces phase; at idle clears nonempty draft once, then a second press within the terminal convention exits. `Ctrl+D`: at nonempty composer deletes/acts according to terminal EOF only when not composing; at empty idle exits after cleanup; during a running/unknown operation requests cancellation/exit only after the operation row is durable and terminal restoration is safe. `Esc`: composition → completion → overlay → draft/operation lifecycle, never authorizes and never background-dispatches. Terminal restoration and child cleanup are reported, not assumed.

### Headless, redirected, and noninteractive contract

TTY and output mode are detected before any interactive gate. Interactive Ink, redirected text, and headless JSON use the same canonical ordered record: heading, purpose, risk, recipient/target, exact safe summary, authority decision, operation identity, Evidence completeness, outcome, next step. stdout carries normal result records; stderr carries warnings, refusal reasons, diagnostics, and progress. Secrets, raw payloads, unresolved local paths as fetch authority, and unsafe environment values never appear on either stream.

If approval, transfer consent, Boundary Expansion, credential entry, or uncertain classification is required without a TTY, thcode fails closed before preparation/dispatch or secret read. It emits a stable machine-readable record with canonical `status`, `reason`, `cause`, `target` when applicable, `operationId` when available, `exitClass`, `exitCode` (`null` for `NONE`), and `next: rerun interactively`; `cause` and `target` are structured fields, never interpolated into the canonical display token. Human text goes to stderr. The normative numeric mapping is `SUCCESS=0`, `FAILED=1`, `ACCEPTED_LIMITATION=10`, `BLOCKED=20`, `PARTIAL=30`, `UNKNOWN_OUTCOME=70`, and `CANCELLED=130`; `NONE` means nonterminal and has no process exit. The symbolic class and JSON status are emitted together, and callers must not infer a different outcome from stream text. No pending authority is left behind. A documented headless intent/API path may use pre-authorized test fixtures, never ambient approval or secrets.

### Credential secrecy

Secret values are never exposed in rendered text, accessible names/values, preedit announcements, snapshots, diagnostics, logs, errors, clipboard, scrollback, persistence, headless output, or crash reports. Only `secret entered` / `secret not entered` and an opaque reference/revision may be announced. Paste, resize, IME, cancel, error, replace, remove, and interrupt clear transient buffers. Noninteractive mode never reads a secret from stdin implicitly.

## Authority & Control

Authority dimensions are independent: Work Mode (`Plan`/`Build`), Permission Profile (`Manual`/`Assisted`/`Full Access`), one-shot operation approval, transfer consent, durable Boundary Expansion, Workspace, and Runtime Activation. The persistent summary shows all safety-critical dimensions; `/status` is deterministic inspection, not a substitute for persistent visibility.

Every proposed effect displays exact short/expandable `OperationId`, action digest, `ContextManifest` digest, target/payload manifest digest, recipient capability/version, endpoint/origin, method, Service Configuration generation, Workspace fingerprint, authority profile, expiry, and policy result. The same identities recur in activity, Evidence, and terminal outcome. Any change forces fresh evaluation and approval/consent.

Full Access grant shows scope, Workspace, expiry, affected action classes, and a prominent `FULL ACCESS` warning. Revocation is explicit and immediate for pending eligible approvals/prepared work; it does not claim to cancel committed effects. Activity distinguishes `authority revoked`, `cancellation requested`, and `effect already committed`. Boundary Expansions persist across Runtime Activations only after revalidation and are separately inventoried with resource identity, platform/Workspace binding, allowed actions, provenance, revision, expiry, and revoke control. The Boundary Expansion inventory is reachable from `/boundaries` and `/status`.

### Sensitive-data transfer policy

This policy is **approved as a runtime prerequisite before Epic 4 begins** (PRD §12.1 PR-2, Architecture AD-26.1). It is not created by a later release-certification story, and it is not a universal no-retention guarantee. thcode classifies and minimizes locally; shows recipient and exact payload summary; requires explicit consent for every remote transfer; and fails closed when classification, destination policy, or retention is uncertain. Classification includes `non-sensitive`, `sensitive`, `redacted-sensitive`, and `unknown`; `unknown` cannot be sent. Transformations state what was removed and whether residual sensitivity remains.

A transfer is permitted only when the provider's upstream retention/deletion handling is **verified and permitted by the approved policy matrix for the exact configuration and data class**. No-retention is preferred but not universally required. The consent disclosure states the verified handling for the named recipient, endpoint, capability/version, configuration generation, and operation scope. If either the policy matrix or the provider contract does not support verified no-retention or deletion handling for that configuration, the transfer is `BLOCKED`, no payload is prepared for transport, no cache is written, and no secret or payload bytes are read in a redirected/headless run. Provider-deletion lifecycle states apply only when the verified provider contract supports them; if the contract does not support a deletion lifecycle, no provider-deletion lifecycle state is published and the transfer remains `BLOCKED`. Full Access, local read permission, cache reuse, or prior approval never implies transfer consent.

Outbound payload bytes are never persisted by thcode before, during, or after transport. The UI may retain only a safe manifest/digest and classification metadata needed for Evidence. Sanitized result and Evidence may follow the Saved Session retention policy and are labeled with their retention scope. thcode-managed caches contain no outbound payload bytes; they may contain sanitized derived result, Evidence, source hash, configuration generation, consent reference, and retention metadata only.

The transfer, result, cache, Evidence, export, recovery, and Saved Session surfaces disclose classification, upstream verification, retention scope, observation time, and deletion status (when the provider contract supports a deletion lifecycle). Deleting a Saved Session immediately invalidates and cascades through thcode-managed caches, sanitized derived records, exports, and recovery artifacts linked to that session; inaccessible shared bytes are not presented as retained session content. Revoking/deleting a source or consent invalidates dependent derived records and cache entries, marks them `stale`/`unavailable`, removes export and recovery references, and records only a non-sensitive deletion outcome. Force-fresh states that a new remote transfer may occur, repeats the upstream verification disclosure, and never silently falls back to cache.

#### Upstream retention/deletion lifecycle

The canonical lifecycle statuses are `upstream-no-retention-verified`, `deletion-not-required`, `deletion-pending`, `deletion-confirmed`, and `deletion-failed`. **All five are conditional on a verified provider contract that supports them for the exact recipient, endpoint, capability/version, configuration generation, and operation scope** (Architecture AD-26.1). If the provider contract does not support a deletion lifecycle or no-retention verification for that configuration, none of these statuses is published and the transfer is `BLOCKED`. `upstream-no-retention-verified` is shown after the provider policy and deletion handling are verified for the exact recipient, endpoint, capability/version, configuration generation, and operation scope. For that status, the surrounding copy is: `Provider handling verified: no provider-stored copy is expected or verified.` It is not a claim about data outside the verified scope and it is not a terminal `SUCCESS` outcome. `deletion-not-required` is shown only when the verified provider contract says no provider-stored copy exists or no deletion action is applicable.

If a provider discloses a transient buffer or requires deletion, the transfer/result surfaces show `deletion-pending` after a user or system deletion trigger, then `deletion-confirmed` only after provider-confirmed deletion Evidence. The actor and trigger are recorded in user-visible Evidence: actor is `user`, `Saved Session deletion`, `source/consent revocation`, or `provider policy`; trigger includes timestamp, operation/transfer identity, recipient, scope, and reason. Transfer, result, cache, Evidence, export, and recovery surfaces show the status, actor, trigger, observation time, provider confirmation reference, and sanitized Evidence.

`deletion-failed` is terminal for that deletion attempt: thcode quarantines the affected Specialist Service, blocks future transfers to that recipient/configuration, preserves only sanitized Evidence and the failure reason, invalidates dependent cache/derived/export/recovery references, and exposes `Inspect Evidence`, `Retry deletion` only when the provider contract explicitly permits a safe retry, `Reconcile`, and escalation/recovery guidance. It never claims deletion or no retention. Unknown provider handling is treated as `BLOCKED`, not as `upstream-no-retention-verified`. These statuses are canonical in visual, redirected, headless, Evidence, completion, and Saved Session deletion output **where the provider contract supports them**; they are not universal across all providers.

## Evidence & Observability

Evidence has completeness/provenance states `complete`, `sanitized-with-omissions`, `estimated`, `stale`, `unavailable`, `corrupt`, and `not-authoritative`. It names omitted material and why, observation time versus display time, source hash, generation, consent/operation/context identity, and correlation. Model explanation is always a separate labeled layer and cannot fill missing deterministic Evidence. `complete` means complete for the declared contract, never complete raw vendor material.

Completion semantics separate operation terminal status from Prompt Round status. `succeeded` requires observed verification; `partial`, `blocked`, `failed`, `cancelled`, `unknown-outcome`, and `accepted-limitation` use those exact headings. The Prompt Round aggregate carries the strongest unresolved state; no checkmark or affirmative `completed` lead appears for unknown, partial, blocked, cancelled, or unverified work. Completion is published only after durable post-commit Evidence.

## Specialists & Service Routing

Release 1 is Typhoon-only for reasoning and four reviewed AI-for-Thai integrations: T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition. `/tools`, help, onboarding, completion, `/models`, and summaries repeat that `Catalogued — Not available yet` entries are non-invokable and that near-clone familiarity does not imply provider/capability parity. States are `working`, `Catalogued — Not available yet`, `disabled`, `unconfigured`, `unhealthy`, and `quarantined`; `Catalogued — Not available yet` cannot be enabled or invoked in Release 1.

Routing shows selected service, reason, schema/modality, health, recipient identity/version, verified host, and configuration generation. Artifact resolution is local and shows path/type/size/hash/Workspace relation before preparation. Exact payload identity and consent rules above apply.

## Context & Usage

`/context` shows ranked contributors, inclusion (`verbatim`, `summarized`, `compacted`, `pinned`, `protected`, `excluded`, `unavailable`), provenance, token contribution, digest, compaction history, Effective Context Capacity, reserves, and final `ContextManifest` identity. Direct actions are `inspect`, `pin`, `unpin`, `compact`, `new session`, and `retry`; each states its consequence before activation. Protected overflow stops before provider invocation.

`/usage` is separate and shows Cumulative Token Usage by input/output/cache/calls, source, period, session, and configured budget only when real. It never invents a percentage. Values are labeled provider-reported, locally measured, estimated, fallback, or unknown.

## Sessions & Continuity

`/session` is canonical; `/sessions` is an explicit alias to the same browser. Default sort is most recently active, then stable Session ID; search matches name, Workspace fingerprint, and model. Duplicate names display a disambiguating short ID. Arrow/j/k moves rows; Enter opens; `i` inspects; `r` renames; `d` opens typed delete confirmation; Esc closes. Missing/changed Workspace is never rebound and blocks dependent effects. Restore progress is durable and cancellable before activation commit.

Opening restores history, Evidence, context decisions, usage, artifacts, and checkpoint lineage, then starts a fresh Runtime Activation in Manual. Full Access, temporary approvals, transfer consent, and in-flight authority do not restore. Boundary Expansions are separately shown and revalidated. Onboarding recovery always offers `/help`, inspect, retry, replace, remove, safe diagnostics, and exit; failure never traps the user in a form loop.

## Rollback & Recovery

Rollback covers only built-in create/edit/delete. Before apply, identify path/resource identity, before/post/current digests, renames, symlink/junction/mount uncertainty, and concurrent-writer detection. A conflict opens a three-way inspection of recorded pre-image, agent post-image/patch, and current content. Safe actions are `skip target`, `export patch`, `rebase/apply to new path`, or explicit user-authored resolution. There is no generic `continue`, overwrite, or blind retry. Every resolution records actor, chosen action, resulting digest, and residual conflict.

`/recover` is the single entry point. Its matrix is: inspect any state; reconcile unknown remote only through a supported provider/service reconciliation identity or status lookup; reprompt only when equivalence is proven safe; retry is disabled for unknown effects and explains why; export-safe Evidence is always redacted; exit leaves the state visibly unresolved. If no safe reconciliation exists, `unknown-outcome` remains terminally unresolved, equivalent reprompt is prohibited, and residual risk is stated.

## Compatibility & Command Contract

Near-clone compatibility is deliberate and bounded. Commands are product-controlled reviewed TypeScript; user-defined executable commands and arbitrary adapters are unsupported.

| Familiar control | thcode contract | Deviation |
|---|---|---|
| `/` slash discovery | categorized completion, `/help`, descriptions/examples | no user-defined executable slash commands |
| `Tab` completion | accepts selected completion only; otherwise focus traversal | differs from a universal submit key |
| `Shift+Tab` | toggles Plan/Build only in idle composer | blocked while overlay, completion, preedit, or stream owns focus |
| `Enter` | submits committed composer text when no completion/overlay/IME owns focus; activates focused control otherwise | never activates stale approval or consent |
| `Shift+Enter` | inserts newline in composer | terminals without distinguishable Shift use configurable `Ctrl+J` alternate by default |
| `Space` | activates focused button/selection | never submits composer |
| `Esc` | topmost dismissal/cancel precedence | never authorizes; prepared work becomes dismissed/cancel-requested |
| `Ctrl+C` | composition/overlay/cancellation/exit precedence by lifecycle | never silently means all-purpose kill |
| `Ctrl+D` | EOF/exit only at empty idle; lifecycle-safe cancellation while active | nonempty composer is not implicit submit |
| Up/Down | history at composer boundary; row movement in lists | preserves draft and never stores secrets |
| `j/k`, arrows, PageUp/PageDown | logical list/viewport navigation | available in text mode, no mouse dependency |
| `/session` | canonical Saved Sessions browser | `/sessions` is alias, not a second surface |
| `/models` | Typhoon inspection only | no model selection |
| `/tools` | reviewed Release 1 registry | no arbitrary provider/tool extensibility |
| `/context` vs `/usage` | context governance vs cumulative ledger | no combined usage percentage |
| approval/consent | exact identity, fresh review, safe initial focus | no default Approve/Consent |

## Interaction Primitives

### Command grammar and compatibility

The canonical grammar is:

```text
command        := '/' name (SP argument)*
name           := lower (lower | digit | '-')*
argument       := option | artifact-ref | bare | single-quoted | double-quoted
option         := '--' name [ '=' option-value ] | '--' name SP option-value
option-value   := bare | single-quoted | double-quoted
artifact-ref   := '@' path | '@"' path-with-spaces '"'
bare           := one or more characters other than SP, TAB, CR, LF, quote, or '@' at token start
single-quoted  := "'" (any character except unescaped "'")* "'"
double-quoted  := '"' (any character except unescaped '"')* '"'
SP             := one ASCII space
TAB/CR/LF      := the corresponding ASCII control character
lower/digit    := ASCII lowercase letter / ASCII decimal digit
```

`--` terminates option parsing; following tokens are positional arguments, including tokens beginning with `-`. Inside either quoted form, backslash escapes the matching quote and backslash; a backslash before any other character is literal. `@path` references a file/directory path exactly as typed after `@`; `@"path with spaces"` removes only the delimiters and preserves every path byte inside. Completion recognizes `@` references, resolves them only within the declared Workspace, displays canonical path/type/size/hash, and never expands a glob. Copy/export returns the original reference/path bytes, not the display abbreviation.

Options use `--name` for booleans and `--name=<value>` or `--name <value>` for valued options. Option names are lowercase kebab-case; values are validated by command schema. Repeated options are rejected unless the schema marks them repeatable. Empty arguments, unclosed quotes, dangling escapes, invalid `@` references, unknown options, missing values, missing required arguments, duplicate nonrepeatable options, and extra positional arguments are `blocked` with error code, canonical command name, usage, and `/help <command>` next step. Alias resolution is recorded in Evidence (`/sessions` resolves to `/session list`) before authorization. No shell expansion, glob expansion, environment interpolation, command substitution, or implicit current-Workspace rebinding occurs in slash arguments. Technical values are byte-preserving after parsing.

- `/` opens categorized completion; `/help [topic]` explains a category. Commands use lowercase kebab-case names and space-separated subcommands. Quoted arguments preserve bytes; paths and artifact references use the `@path` forms above. Unknown commands, malformed quoting, missing arguments, and unsupported options return a stable `blocked` record with usage and `/help` next step; they never dispatch.

| Command schema | Positional arguments | Options | Repeatability / errors |
|---|---|---|---|
| `/status` | none | `--json` boolean | duplicates/values blocked |
| `/models` | none | `--json` boolean | inspection only; selection args blocked |
| `/tools` | `search <text>`, `inspect|diagnose|retest <id>` | `--json` | one action; unavailable IDs blocked |
| `/check` | none | `--json` | rerun is explicit; extra args blocked |
| `/session` | `create [name]`, `list`, `open|inspect|rename|delete <id>` | `--sort=<field>`, `--json` | one action; `/sessions` alias is `/session list` |
| `/context` | `inspect`, `pin|unpin <id>`, `compact`, `new-session` | `--json` | one action; protected changes require explicit review |
| `/usage` | none | `--period=<scope>`, `--json` | one period; no invented percentage |
| `/rollback` | `list`, `inspect|apply <id>`, `resolve <id> <action>` | `--json` | one target/action; generic continue blocked |
| `/recover` | `inspect`, `reconcile|export <operation-id>`, `exit` | `--json` | one action; equivalent retry blocked |
| `/connections` | `inspect`, `replace|remove|retest <provider>` | `--json` | one provider; secrets never positional |
| `/boundaries` | `list`, `inspect <id>`, `grant`, `revoke <id>` | `--json` | one authority action; stale grants blocked |
| `/permissions` | `show`, `set <profile>` | `--json` | one profile; Full Access remains bounded |
| `/mode` | `show`, `plan`, `build` | none | one mode; blocked while overlay owns focus |
| `/compaction` | `inspect`, `run` | `--json` | one action; protected overflow stops dispatch |
| `/activity` | none | `--all`, `--filter=<state>`, `--json` | `--filter` may repeat only when schema declares AND semantics |
| `/clear` | `draft` or `screen` | none | one target; transcript deletion is not implied |
| `/help` | optional topic | `--json` | one topic; unknown topic returns help error |
| `/exit` | none | none | extra args blocked; lifecycle cleanup first |

Every schema has completion descriptions/examples, loading/empty/error/cancelled/narrow forms, a safe text projection, and a JSON form. Errors use fixed display heading `COMMAND_ERROR` layered over a canonical operation status of `blocked` or `malformed`; the heading carries structured `cause`, canonical command, argument position, and usage, but is not itself a distinct operation status or a registry row. Aliases resolve before authorization and are recorded in Evidence. Unsupported familiar controls—mouse-only activation, shell expansion, arbitrary executable slash commands, implicit retries, and model-selection commands—produce `blocked` with the exact reason and no effect.
- `Tab` accepts the selected completion only when completion is open; otherwise it traverses focus. `Shift+Tab` toggles Plan/Build only at an idle composer. `Enter` submits committed composer text or activates the focused control; `Space` activates the focused control but never submits the composer. `Esc`, `Ctrl+C`, and `Ctrl+D` follow the stateful precedence and cancellation contract above.
- Slash completion is grouped Essential, Conversation, Authority, Context & Usage, Services, Sessions, Recovery, and Diagnostics. First-run ranking shows Essential and Conversation first; advanced commands remain discoverable through categories and `/help`.
- `show all`, `expand`, `next`, `previous`, `copy`, `inspect`, `reconcile`, `reprompt`, `retest`, `force-fresh`, `pin`, `unpin`, `replace`, `remove`, `grant`, `revoke`, `skip target`, `export patch`, and `rebase` are explicit actions, never hidden gestures. Mouse is optional.

## Accessibility Floor

- Contrast targets: load-bearing text achieves at least 4.5:1 against its surface; large label text at least 3:1; focus indicator has at least 3:1 against adjacent surfaces and remains visible as a two-cell/text-label change in monochrome. [ASSUMPTION] These are conservative terminal acceptance targets where the terminal supports measurable color.
- Every consequential state has canonical text in all modes: `FULL ACCESS`, `DESTRUCTIVE`, `UNKNOWN OUTCOME`, `ENFORCEMENT UNVERIFIED`, `BLOCKED`, `CANCELLED`, `Catalogued — Not available yet`.
- Keyboard-only operation covers every surface, with deterministic entry, traversal, traps, activation, disabled behavior, Esc precedence, return focus, and logical-ID restoration.
- Screen-reader/linearized output follows heading → purpose → risk → exact target → authority → action → outcome → next step; EventId deduplication prevents replay duplication. Supported terminal/assistive-tech fixtures are Windows Terminal/PowerShell and macOS Terminal/zsh in plain-text/redirected modes; native screen-reader behavior is supplemental, never the only contract.
- Thai IME preedit, grapheme clusters, combining marks, emoji/ZWJ, cell width, copy bytes, paste, resize, persistence, and replay are tested on both native platforms.
- Reduced motion is static and nonsemantic; no blink, spinner dependence, or redraw erasure.
- Secrets are absent from visual, accessibility, diagnostics, snapshots, logs, scrollback, clipboard, errors, persistence, and headless output.
- Long output has explicit counts, truncation, expand/navigation/copy controls, and redirected detail levels.

## Key Flows

### UJ-1 — Nok’s curiosity-driven first experience

1. Nok launches `thcode`; startup-preflight checks supported runtime/platform/shell without effects.
2. The onboarding surface identifies Typhoon/SCBx, verified host, OS credential storage, and the separate AI-for-Thai credential/service boundary.
3. Nok enters a masked Typhoon key; `configured` is shown, then an explicit availability check runs.
4. On `available`, the main-conversation opens in Build + Manual with authority summary visible.
5. Nok enters Thai/mixed Thai-English text; IME and technical tokens remain intact and receives a low-risk Typhoon response.
6. Nok prompts an image-document OCR task; thcode pauses at AI-for-Thai `unconfigured`, explains the requested capability, and opens the separate masked AI-for-Thai setup.
7. thcode discloses the verified AI-for-Thai host, shared four-service scope, storage, classification, and upstream no-retention/deletion verification before Nok enters the second key.
8. After an explicit generation-bound check, thcode routes to T-OCR, resolves the image, shows recipient and exact minimized payload summary, and asks independent transfer consent.
9. Nok inspects the consent identity, grants consent, and sees Specialist Service result, empty/uncertain fields, source hash, provenance, and Typhoon explanation separately.
10. **Climax:** the end-to-end first experience streams and seals an attributable Prompt Round whose Typhoon and T-OCR identities, consent, Evidence, and outcome are visible without fabrication.

Failure: storage/auth/health, missing AI-for-Thai setup, classification/retention uncertainty, transfer denial, unsupported input, interruption, or unknown outcome is typed, safe, recoverable, and never fallback/fabrication; onboarding always exposes help, inspect, retry, replace/remove, retest, and exit.

### UJ-2 — Nok explores the AI-for-Thai service catalog

1. Nok opens `/tools` through categorized completion.
2. The reviewed catalog distinguishes four `working` services—T-OCR, Speech-to-Text, Extract Address, and Named Entity Recognition—from `Catalogued — Not available yet`, `disabled`, `unconfigured`, `unhealthy`, and `quarantined` entries.
3. Search and inspect show capability, modality/schema, health, generation, verified recipient host, entitlement/quota state, and a non-invokable reason where applicable.
4. Nok selects an available service for a natural Thai/mixed prompt; routing names the service, reason, artifact type, and recipient before any transfer.
5. If AI-for-Thai is unconfigured, Nok completes separate masked setup and an explicit check; if configured, the catalog reuses the verified connection without implying Typhoon equivalence.
6. Nok supplies an artifact using `@path` or `@"path with spaces"`; thcode shows canonical path, type, size, hash, Workspace relation, classification, minimization, and exact prepared payload summary.
7. The transfer-consent surface discloses upstream no-retention/deletion verification, destination, capability/version, generation, call count, expiry, and digests; Nok grants independent consent.
8. thcode invokes only the selected reviewed service, returns immutable Specialist Result and sanitized Evidence, and makes cache/freshness and force-fresh behavior inspectable.
9. **Climax:** Nok can identify which reviewed service acted, what data left the machine, the exact consent identity, and what came from the service versus Typhoon, then inspect the result without implying unrestricted capability parity.

Failure: unavailable, unsupported, unhealthy, entitlement, quota, classification unknown, unverifiable provider handling, consent cancellation, or unknown outcome remains typed; no substitution, enablement, retry duplication, or fabricated result.

### UJ-3 — Nok diagnoses and recovers an unhealthy specialist service

1. Nok opens the affected `specialist-card` or `/tools` diagnosis.
2. thcode shows deterministic category, sanitized Evidence, configuration generation, timestamp, and scope.
3. Nok uses replace/remove or corrects configuration; dependent services remain accurately scoped.
4. Nok explicitly chooses retest; background activity never masquerades as retest.
5. **Climax:** a passing generation-bound retest returns only the affected capability to `available` and makes the Evidence traceable.

Failure: shared-key rejection scopes to the shared connection; protocol failure quarantines only the proven service; no silent reinterpretation or retry loop.

### UJ-4 — Nok proves a Thai model can complete a bounded CLI-agent task

1. Nok declares Workspace and starts Build + Manual.
2. thcode checks the C++ compiler without installation.
3. It previews exact target/diff, checkpoint coverage, and operation identity.
4. Nok reviews safe initial approval focus and approves the unchanged exact mutation.
5. Exact compile/run commands and stdout/stderr stream with cancellation states.
6. **Climax:** completion-summary reports observed exit codes, expected stdout, file, tool, Typhoon, Evidence, exclusions, and strongest outcome.

Failure: missing prerequisite, conflict, denied policy, cancellation, unknown, or failed verification never reads as success.

### UJ-5 — Nok safely resumes a Saved Session

1. Nok opens `/sessions` (alias) from any directory.
2. Browser shows name, stable ID, Workspace `current`/`other`/`missing`, model, mode, context, lifecycle.
3. Nok opens after restore is committed; no silent rebind occurs.
4. New Runtime Activation starts Manual; Full Access/temporary approvals/transfer consent are absent; Boundary Expansions are separate.
5. **Climax:** Nok sees restored Evidence and chooses inspect, reprompt, or reconcile without stale authority.

Failure: missing Workspace, locked store, missing key, stale source, or incomplete stage is read-only/blocked and actionable.

### UJ-6 — Nok recovers from an interrupted remote request

1. Nok enters `/recover` after `Chat interrupted`.
2. Known chunks and Evidence are shown once in reliable order.
3. The state is classified `not sent`, `possibly dispatched`, or `response started`; OperationId and residual risk are visible.
4. Nok chooses inspect or supported reconciliation; equivalent reprompt is disabled unless replay safety is proven.
5. **Climax:** the operation becomes `reconciled` with Evidence, or remains honestly `unknown-outcome` with no duplicate path.

Failure: crash, replay race, or unavailable lookup preserves the unknown state; no synthesized completion.

### UJ-7 — Nok safely rolls back an agent change

1. Nok invokes `/rollback` and inspects retention, caps, coverage, and exclusions.
2. thcode compares pre/post/current identities and detects rename/concurrency/symlink uncertainty.
3. Nok confirms only eligible conflict-free built-in changes.
4. A conflict opens three-way inspection and safe skip/export/rebase/user-authored resolution.
5. **Climax:** per-target and aggregate results state exactly what changed and what remains; no external effect is claimed reversed.

Failure: expired, corrupt, locked, over-cap, mismatched, or unprotected data stays unavailable/blocked and never overwrites later work.

## Inspiration & Anti-patterns

- Lifted from Claude Code CLI: terminal-first rhythm, prompt-led control, slash discovery, familiar keyboard navigation, and compact TUI behavior.
- Deliberate deviations: no model-selection flow, no arbitrary provider/tool configuration, no user-defined executable slash commands, no default approval action, explicit two-phase cancellation, separate transfer consent, and stricter unknown-outcome handling.
- Rejected: silent fallback, model authority, one universal permission switch, automatic unknown retry, blind rollback, color-only status, hidden secrets, and dashboard/web-first behavior.

## Responsive & Platform

| Mode | Contract |
|---|---|
| Windows 11 25H2+ / Windows Terminal / `pwsh.exe` | Thai UTF-8, PowerShell-safe exact commands, masked secrets, resize, process-tree cleanup; platform/action enforcement remains a named dependency. |
| macOS 14+ / Terminal / zsh | Thai UTF-8, zsh-safe exact commands, masked secrets, resize, process-tree cleanup; platform/action enforcement remains a named dependency. |
| 40/60/80/120 columns | Use width-tier contract and golden fixtures; never clip safety fields. |
| redirected/noninteractive | Canonical stdout/stderr and machine-readable refusal; no interactive authority, secret read, preparation, or dispatch. |
| headless | Same projections, state vocabulary, Evidence, terminal outcome, and exit semantics without visual rendering; duplicate events never duplicate visible facts. |

### Named downstream dependencies

These are dependencies, not UX ambiguity. Until each artifact is present, UI behavior is safe and truthful:

- **Exact Typhoon Release 1 version pin:** display `Typhoon version: unverified` and block claims of verified identity/capability; do not invent a version.
- **Windows/macOS platform/action enforcement matrix:** display `ENFORCEMENT UNVERIFIED`; deny affected effects and allow inspection only.
- **Numeric NFR-14 performance budgets:** display observed timing with `budget not set`; never claim compliance or fabricate thresholds.
- **Security-reporting channel artifact:** display `security reporting route unavailable` in release/help surfaces; do not invent a channel or imply support coverage.

These dependencies may be closed downstream without changing the interaction contracts above. 
