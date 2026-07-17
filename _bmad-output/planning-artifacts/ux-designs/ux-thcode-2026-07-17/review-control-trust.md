# Adversarial Review — Control, Trust, and Authority

**Verdict:** Not ready to treat as a release-grade human-control contract. The spines describe the right authority vocabulary and many safe states, but several critical decisions are still left to implementation. In consequence, a user can lose the ability to see which authority is active, approve the exact effect actually dispatched, understand whether a remote effect happened, or recover safely from races and conflicts. The unresolved sensitive-data policy is a release blocker for the specialist flows.

**Severity counts:** Critical 1 · High 11 · Medium 5 · Low 0 (17 findings)

## Findings

### 1. Critical — Sensitive-data policy is explicitly unresolved while transfer UX is presented as launch-ready

**Location:** `/Users/temicide/Documents/thcode/_bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md:125-133`; `/Users/temicide/Documents/thcode/_bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/.working/source-extract-prd.md:233-243,263-274`; `DESIGN.md:202-208`.

**Failure scenario:** Nok sends an image, audio file, or document containing an address or personal identifier. The transfer overlay can show a “safe payload summary,” but the product has no closed classification, consent language, retention/deletion rule, upstream handling disclosure, or cache-retention policy. Nok may consent without knowing that derived evidence or cached bytes remain locally, or that a transformation still contains sensitive content.

**Fix:** Close a normative sensitive-data policy before enabling affected services. Define classifications, detection/uncertainty behavior, redaction/transformation semantics, local retention/cache deletion, upstream handling disclosure, consent copy, and fail-closed rules. Add those exact states and disclosures to the transfer, result, cache, Evidence, export, and recovery surfaces.

### 2. High — Simultaneous warnings have no priority or guaranteed visible composition

**Location:** `DESIGN.md:196-207`; `EXPERIENCE.md:104-115`; `.working/source-extract-epics.md:368-374`.

**Failure scenario:** Full Access is active while the service is quarantined, context is at 96%, a remote operation is unknown, and a rollback conflict exists. The status bar has no ordering, interruption rule, or minimum visible set. A narrow terminal can show the Full Access warning while hiding the unknown outcome, or show context pressure while the user misses that transfer consent is not granted.

**Fix:** Specify a severity/authority composition algorithm: mandatory persistent warnings, ordering, replacement versus stacking, narrow-terminal rendering, and focus behavior. Never allow a lower-priority status to displace Full Access, unknown outcome, stale approval, transfer-consent, hard-boundary, or rollback-conflict warnings.

### 3. High — Approval dialogs do not define stale/raced proposal behavior

**Location:** `EXPERIENCE.md:69-84,163-176`; `.working/source-extract-epics.md:344-346,368-374`; `.working/source-extract-addendum.md:133-140`.

**Failure scenario:** Nok opens an approval, then changes Work Mode, revokes a Boundary Expansion, switches sessions, a file changes, the endpoint generation changes, or the payload is re-prepared. The dialog still presents an Approve control. The backend may reject the digest, but the UI has no specified stale state, refresh/review transition, or guarantee that the old details cannot be mistaken for the new effect.

**Fix:** Define modal invalidation triggers and a visible `stale`/`mismatch` state. Disable approval immediately, show the old and current identities/reasons, require a fresh policy evaluation and re-review, and preserve the stale decision in Evidence without treating it as authorization.

### 4. High — Exact effect identity is required by architecture but not made human-verifiable in the approval surface

**Location:** `EXPERIENCE.md:69-84,104-115`; `.working/source-extract-architecture.md:43-52`; `.working/source-extract-epics.md:48-58,272-275`.

**Failure scenario:** A model proposal is rewritten after validation, a retry resumes an operation, or an adapter transforms a command/payload. Nok sees a readable command or summary and approves, but cannot compare the approved action digest, `OperationId`, prepared manifest/byte digest, endpoint/configuration generation, and final dispatched identity. A technically different effect can appear to be the approved one.

**Fix:** Make exact identity a first-class approval contract. Show stable short fingerprints plus expandable exact values for `OperationId`, action digest, prepared payload/manifest digest, destination, configuration generation, and expiry. Echo the same identities in activity, Evidence, and terminal outcome; any identity change must force a new approval/consent.

### 5. High — Authority separation is described, but the persistent projection omits enough scope to make authority actionable

**Location:** `DESIGN.md:196-208`; `EXPERIENCE.md:31-44,104-115`; `.working/source-extract-architecture.md:43-55`.

**Failure scenario:** The status bar shows Work Mode, Permission Profile, Full Access, and service health, but the current Workspace identity, active Boundary Expansions, transfer-consent status, Runtime Activation revision, and hard-boundary/enforcement status are only “immediately inspectable.” During a destructive prompt or session switch, Nok believes `Build + Full Access` is the operative authority and misses that the workspace is missing, a boundary is expired, or transfer consent is absent.

**Fix:** Define a persistent authority summary with current Workspace fingerprint, Runtime Activation revision, Work Mode, Permission Profile, Full Access warning, Boundary Expansion scope/expiry, transfer-consent state, and hard-boundary enforcement state. “Immediately inspectable” needs a deterministic key/action and must not be used for safety-critical state.

### 6. High — Full Access activation and revocation semantics are not sufficiently explicit

**Location:** `DESIGN.md:221-222`; `EXPERIENCE.md:90-115`; `.working/source-extract-prd.md:168-177`; `.working/source-extract-addendum.md:52-57`.

**Failure scenario:** Nok activates Full Access, then starts a long-running operation or opens an approval overlay. The spines say the warning persists and activation resets on a new Runtime Activation, but do not say whether revocation cancels pending approvals, blocks prepared-but-not-dispatched effects, or leaves already authorized operations running. A user can revoke Full Access yet still observe an effect they reasonably believed was stopped.

**Fix:** Specify Full Access grant/revoke confirmation, scope, expiry, and effect on every operation lifecycle stage. Revocation must invalidate pending eligible approvals, be visible in the activity log, and distinguish “authority revoked” from “operation cancellation requested” and “effect already committed.”

### 7. High — Specialist routing is legible, but transfer consent lacks the complete recipient and payload identity contract

**Location:** `EXPERIENCE.md:125-133,219-230`; `.working/source-extract-architecture.md:45-55`; `.working/source-extract-epics.md:83-93,173-183`.

**Failure scenario:** T-OCR is selected from a metadata registry. The UI shows service and verified host, but not the recipient capability/version, exact adapter/configuration generation, or a user-inspectable payload-byte digest. The adapter changes a transformation or endpoint between consent and transport; Nok sees the same service label and assumes the consent still covers the bytes sent.

**Fix:** Require the consent view and final preflight to show recipient service/capability/version, endpoint/origin, method, configuration generation, source manifest, transformations/redactions, call count, expiry, and short payload/manifest digests. Recompute and compare immediately before transport; mismatch must produce `consent stale` and no send.

### 8. High — Specialist transfer, cached Evidence, and force-fresh do not close the sensitive-data/cache boundary

**Location:** `EXPERIENCE.md:125-133`; `.working/source-extract-addendum.md:69-75,109-115`; `.working/source-extract-epics.md:89-93,181-183`.

**Failure scenario:** A prior OCR result is reused from cache for unchanged content. Nok sees “cached Evidence” and a force-fresh action, but cannot tell whether raw material, derived fields, or only hashes were retained, how long they persist, who can inspect them, or whether deletion of the source invalidates the cache. The cache can become an unacknowledged second data destination.

**Fix:** Define cache object classes and retention. Show whether each cache entry contains source bytes, derived output, metadata, or hashes; expose age, configuration generation, sensitivity classification, deletion controls, and invalidation behavior. Force-fresh must explicitly state that it may create a new remote transfer and must not silently fall back to cache.

### 9. High — Pause, interrupt, and cancel lack a user-visible two-phase contract

**Location:** `EXPERIENCE.md:69-84,90-102,163-176`; `.working/source-extract-architecture.md:24-32`; `.working/source-extract-epics.md:264-276`.

**Failure scenario:** Nok presses Esc or Ctrl+C while a shell command is in `prepared`, `dispatch-committed`, or a remote request has started. The architecture correctly says cancellation is not necessarily immediate, but the UX does not define `cancel requested`, acknowledgement timeout, process-tree state, or what remains possible. Nok may press again, launch a duplicate request, or read a transient spinner as cancellation.

**Fix:** Define explicit controls and states: `pause requested`, `cancellation requested`, `cancellation acknowledged`, `still running`, `committed`, `cancelled`, and `unknown-outcome`. Keep a durable operation row visible until terminal outcome; show child-process cleanup evidence and forbid a new attempt while the prior operation is unresolved unless the user explicitly chooses a separate operation.

### 10. High — Unknown remote outcomes have no closed reconciliation path

**Location:** `EXPERIENCE.md:143-151,232-241`; `.working/source-extract-architecture.md:30-32,57-65`; `.working/source-extract-addendum.md:41-50,131-140`.

**Failure scenario:** The process crashes after dispatch and receives no response. On restart, the UI restores `Chat interrupted` and offers inspect/reprompt/reconcile, but reconciliation mechanics are explicitly open. Nok cannot determine whether the remote service performed the work, and a reprompt can duplicate a side effect despite the stated no-retry rule.

**Fix:** Define reconciliation protocols per remote operation: provider/service idempotency key, status lookup where supported, bounded user-directed probe, evidence needed to close the state, and terminal `reconciled` outcomes. If no safe reconciliation exists, keep the operation permanently `unknown-outcome`, clearly prohibit equivalent reprompting, and explain the residual risk.

### 11. High — Evidence can be inspected, but incomplete, stale, or sanitized-away authority is not surfaced as such

**Location:** `DESIGN.md:199-209`; `EXPERIENCE.md:117-123`; `.working/source-extract-architecture.md:57-65`; `.working/source-extract-epics.md:117-126,236-262`.

**Failure scenario:** Raw vendor output, headers, environment values, or command output is removed by sanitization. The Evidence panel still presents deterministic classification, model explanation, hashes, and timing in the same inspection surface. Nok treats the remaining record as complete proof, even though the omitted material may be exactly what limits diagnosis or verification.

**Fix:** Add explicit Evidence completeness/provenance states: complete, sanitized-with-omissions, estimated, stale, unavailable, corrupt, and not-authoritative. State what was omitted and why, distinguish observation time from display time, and prevent model explanation from appearing to fill missing deterministic evidence.

### 12. High — Checkpoint and rollback conflicts are named but manual resolution is not an executable safety flow

**Location:** `DESIGN.md:205-206`; `EXPERIENCE.md:153-161,243-252`; `.working/source-extract-addendum.md:41-50,131-140`; `.working/source-extract-epics.md:130-144,202-208`.

**Failure scenario:** A later edit overlaps an agent patch, a file is renamed, a symlink/junction changes, or another process writes between preview and apply. The UI reports `conflict` and says manual resolution is required, but does not define how Nok sees the competing pre-image/post-image/current content, selects a safe resolution, or records that resolution. The only practical action may be blind external editing.

**Fix:** Define conflict inspection and resolution primitives: three-way/digest comparison, path identity and rename handling, concurrent-writer detection, safe “skip target,” export patch, rebase/apply-to-new-path, and explicit user-authored resolution. Never offer a generic “continue” that can overwrite a changed target. Close the unresolved platform/concurrency matrix before claiming rollback coverage.

### 13. Medium — Context provenance is available in `/context` but not guaranteed at the moment of authority or transfer decisions

**Location:** `DESIGN.md:204,207-209`; `EXPERIENCE.md:135-141`; `.working/source-extract-epics.md:113-128,194-200`.

**Failure scenario:** Automatic compaction runs immediately before a provider call. The main approval or transfer surface shows the prompt and target but not the final Active Model Context inclusion/exclusion decisions, protected overflow status, destination, or context manifest digest. Nok approves an operation based on a context state that is no longer the state sent.

**Fix:** Bind approval and Evidence to the final `ContextManifest` identity. Show a compact “context at dispatch” summary and digest in the approval/transfer and final outcome surfaces; invalidate approval if compaction, pinning, model limit, reserve, or destination changes.

### 14. Medium — “Completion” semantics mix local post-commit, remote completion, and accepted limitation

**Location:** `DESIGN.md:208-209`; `EXPERIENCE.md:48-63,188-194,206-217`; `.working/source-extract-epics.md:8-17,63-77`.

**Failure scenario:** A local file write commits, but compilation is cancelled or a remote specialist call is unknown. A generic completion summary can still appear because the Prompt Round has post-commit Evidence, while a user scanning for “done” interprets the summary as task success. The spines say limitations and uncertainty should be stated, but do not reserve “success/completed” for a defined outcome class across the whole round.

**Fix:** Separate operation terminal status from Prompt Round status. Define exact allowed success language for verified success, accepted limitation, partial, blocked, failed, cancelled, and unknown. Make the aggregate heading carry the strongest unresolved state and prohibit “completed,” checkmarks, or affirmative lead copy for unknown/partial/blocked work.

### 15. Medium — Approval/consent dismissal and terminal interruption may silently preserve dangerous pending state

**Location:** `EXPERIENCE.md:69-84,163-176`; `.working/source-extract-epics.md:264-276`; `DESIGN.md:200-202`.

**Failure scenario:** Nok presses Esc to dismiss a transfer or destructive-action overlay, then the underlying prepared operation remains queued. The spines say Esc does not change unrelated settings, but do not say whether dismissal cancels preparation, leaves an approval pending, or allows background dispatch. A later Enter/Tab or focus change can authorize an old proposal unintentionally.

**Fix:** Define dismissal per operation state. Esc must be a non-authorizing action; pending/prepared operations must become visibly `dismissed` or require an explicit resume, and may never dispatch in the background. Preserve the exact operation identity and show a clear re-open/review action.

### 16. Medium — Boundary Expansion discovery/revocation is too underspecified to preserve durable authority

**Location:** `EXPERIENCE.md:104-115,143-151`; `.working/source-extract-addendum.md:52-57,116-140`; `.working/source-extract-epics.md:42-58,97-110`.

**Failure scenario:** A durable Boundary Expansion remains active across sessions. The browser shows that boundaries exist, but the user cannot readily find its resource identity, allowed actions, expiry, grant provenance, or revoke control. A session resume can therefore regain durable authority that looks like ordinary workspace capability.

**Fix:** Add a dedicated boundary inventory and lifecycle: grant preview, exact resource/platform identity, allowed action classes, reason, grant time, expiry, effective configuration/runtime revision, invalidation, and revoke confirmation. Surface active boundary coverage beside every affected proposal and record revocation as a durable event.

### 17. Medium — Redirected/noninteractive authority handling is only “fail safely,” not a usable control contract

**Location:** `EXPERIENCE.md:266-279`; `.working/source-extract-epics.md:325-365`; `.working/source-extract-architecture.md:78-84`.

**Failure scenario:** A script invokes thcode with output redirected and a mutation or transfer consent is required. The UI cannot ask interactively, but the exact exit code, machine-readable refusal, pending-operation behavior, and recovery instruction are unspecified. A wrapper may treat the process as successful because it emitted a prompt-like line, or rerun it and duplicate an unknown effect.

**Fix:** Define noninteractive authority behavior: fail closed before preparation/dispatch, stable refusal reason and exit code, no pending authority, machine-readable safe summary, and an explicit command to resume interactively. Test redirected output for secrets, exact target identity, and misleading success text.
