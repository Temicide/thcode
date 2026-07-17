# Security, Privacy, Safety, and Reliability Review

**Artifact reviewed:** `prd.md` and `addendum.md` in `prd-thcode-2026-07-14`  
**Review perspective:** adversarial security/trust reviewer  
**Date:** 2026-07-15  
**Verdict:** **NOT READY FOR IMPLEMENTATION SIGN-OFF OR PUBLIC RELEASE.** The product intent is unusually explicit about distrust of model proposals, credential isolation, evidence provenance, fail-closed behavior, and honest uncertainty. However, three core promises currently exceed the contracts that the PRD makes observable and testable: host containment for arbitrary commands and file operations, authority over workspace content sent to Typhoon, and crash-safe recording of possibly dispatched remote requests. These are release blockers, not optional architecture polish.

## Severity summary

| Severity | Count |
|---|---:|
| Critical | 3 |
| High | 10 |
| Medium | 5 |
| Low | 2 |

## What is already strong

- Typhoon proposals are explicitly untrusted, and the local harness remains authoritative over execution.
- Typhoon and AI-for-Thai credentials are separate, locally stored, and excluded from model context, sessions, logs, and telemetry.
- The PRD separates deterministic service evidence from model explanation and refuses silent fallback.
- Runtime authority resets are distinct from durable Boundary Expansions rather than being conflated.
- Unknown remote outcomes, rollback exclusions, and unsupported services are described honestly.
- The success section includes counter-metrics for unauthorized effects, credential exposure, false capability, and inflated positioning.

These strengths should remain. The fixes below make them enforceable rather than changing the product direction.

## Critical findings

### C-1 — Arbitrary command execution makes the claimed hard Workspace boundary unenforceable as written

**Locations:** UJ-4; FR-7 through FR-10; FR-24; NFR-3; SM-C1; Principal Risk “Cross-platform boundary gaps”; Deferred Decision 4; addendum “Architecture questions to resolve downstream.”

FR-10 permits a validated local command while FR-24 promises that Workspace, command, network, service, quota, credential, and sensitive-transfer boundaries are non-overridable. A string-level command validator cannot prove those boundaries for PowerShell or zsh. A permitted executable can follow symlinks or junctions, spawn detached descendants, read outside the Workspace, write through shell redirection, load plugins/configuration from the user profile, access the network, or invoke another interpreter. The same gap exists for built-in file tools unless containment is handle-based and race-resistant. “Refuse threatening commands” is not an implementable security boundary.

The platform/action enforcement matrix is currently deferred until implementation sign-off, but it is the missing definition of the product’s principal safety claim. If implementation begins without it, Full Access and even Manual-approved commands can escape the stated boundary while the UI claims they cannot.

**Required fix:** Promote the platform/action enforcement matrix to an architecture-entry and release-blocking contract. For every built-in tool and supported platform, specify:

1. the OS mechanism that enforces filesystem, process, environment, and network boundaries;
2. whether commands run as executable-plus-argv or through a shell, with authoritative quoting semantics;
3. canonicalization and no-follow handling for symlinks, hard links, Windows junctions/reparse points, alternate data streams, case changes, mount changes, and time-of-check/time-of-use races;
4. child-process containment and teardown using platform process groups/job objects;
5. a minimal environment allowlist and network-deny/default endpoint policy;
6. fail-closed behavior when any mechanism is unavailable; and
7. an adversarial release fixture set covering path, shell, process, and network escape attempts on both minimum and newest supported OS versions.

Until a platform primitive can enforce a class of boundary, the PRD must either prohibit that action or downgrade the promise from containment to disclosure. Approval must never be described as containment.

### C-2 — Local reads can become unapproved remote transfers to Typhoon

**Locations:** UJ-4 approval behavior; FR-6; FR-7; FR-14 through FR-17; FR-22; FR-25; NFR-4; Deferred Decision 3.

FR-7 allows in-Workspace list/read/search without interruption under Manual when they do not trigger a “material remote transfer.” In the Agent Loop, however, the result of a model-proposed read or search is normally returned to Typhoon. FR-15 says selected code and Markdown may be sent, FR-16 governs material leaving the machine, and FR-22 says sensitive transfer requires distinct authority. The PRD does not define when a read result crosses from local Evidence into Active Model Context, what “material” or “sensitive” means, or what authority covers routine source-code transfer to SCBx.

This creates a fail-open privacy path: a user can reasonably interpret “read without interrupting” as local-only while workspace source, secrets embedded in files, filenames, command output, or extracted document text is sent to Typhoon. Credential redaction alone does not solve source-code and personal-data disclosure. The deferred sensitive-data policy cannot remain unresolved while model-backed local tools are enabled.

**Required fix:** Add a normative **Remote Data Authority** contract before implementation:

- local permission to read is not permission to send;
- every provider-bound payload is assembled by the local harness from explicitly selected fields and receives destination-specific policy evaluation;
- define the scope and lifetime of authority (one call, prompt round, artifact, workspace, provider), with the narrowest safe default;
- show a safe payload summary and exact inspectable content before first transfer in scope;
- never let Typhoon select hidden content or broaden the approved payload;
- classify source, document, image, audio, address, NER input/output, filenames, tool output, and extracted text;
- scan for likely secrets before dispatch and block or require explicit override without displaying the secret itself;
- make denial leave the local read result unsent and the model informed only that access was denied; and
- add release tests proving that automatically permitted local reads do not imply remote transfer.

Move Deferred Decision 3 to a hard gate before *any* public Typhoon or AI-for-Thai artifact transfer, not only before “affected AI-for-Thai services” are enabled.

### C-3 — “Never retry an unknown remote outcome” lacks a crash-safe dispatch state machine

**Locations:** UJ-6; FR-6; FR-32; NFR-6; SM-4; addendum “Failure evidence and observability direction” and “Recovery and rollback mechanisms.”

The PRD promises that a remotely dispatched request with unknown outcome is never retried automatically, but does not require a durable marker to be committed before network I/O. A crash after bytes leave the machine but before “dispatched” is persisted can restore the operation as not sent and allow an automatic retry. A crash during streaming can also lose the exact boundary between durable response content and volatile terminal output. The current wording cannot guarantee the stated behavior.

**Required fix:** Require a crash-consistent remote-operation state machine, for both Typhoon and AI-for-Thai calls:

1. persist and flush a unique operation identity plus sanitized request fingerprint in `prepared`/`possibly-dispatched` state before attempting network send;
2. treat every unresolved state after that point as possibly dispatched and never automatically replay it;
3. journal received chunks/evidence before presenting them as recoverable;
4. distinguish `not-sent`, `possibly-dispatched`, `response-started`, `completed`, and `reconciled` states;
5. use provider idempotency or status reconciliation only when the exact provider contract proves it safe; and
6. add kill-point tests around every state transition, database commit, socket write, and streamed response boundary.

The “Chat interrupted” marker must be derived from that durable state, not inferred from an incomplete transcript after restart.

## High findings

### H-1 — Durable Boundary Expansions can preserve stale or overbroad authority

**Locations:** UJ-5 step 6; Glossary; FR-24; FR-28; addendum “Architecture questions to resolve downstream.”

Boundary Expansions can widen Workspace, command, network, service, or quota boundaries and persist indefinitely across Runtime Activations. No requirement binds an expansion to a specific user, canonical resource identity, workspace fingerprint, provider endpoint, policy version, or package version. A path can be replaced, a symlink/junction can retarget, a domain can change ownership or resolve differently, and a previously reasonable quota expansion can remain active after context changes. Persisting these while advertising a “fresh” Manual activation can surprise the user even if the distinction is technically documented.

**Required fix:** Keep persistence, as the product decision requires, but make it capability-like: exact typed scope; canonical resource/endpoint identity; creator, reason, timestamp, workspace/session binding, and policy version; no wildcards by default; high-friction approval; visible activation-time summary; one-command revocation; optional expiry; invalidation on identity or enforcement-version change; and fail-closed migration. Add tests proving an expansion cannot silently broaden through path replacement, redirect, DNS change, manifest update, or malformed stored data.

### H-2 — Credential host binding omits redirect, proxy, and origin rules

**Locations:** FR-2 through FR-4; FR-14; FR-16; FR-25; Deferred Decision 5; addendum “Architecture questions to resolve downstream.”

“Verified host” and “official endpoint” are not enough to prevent credential forwarding. HTTP clients can follow redirects, inherit proxy configuration, resolve a host to unexpected destinations, or log authorization material through debugging hooks. Endpoint changes can also outlive a stale health result.

**Required fix:** Define an exact HTTPS origin allowlist per credential; reject cross-origin redirects and strip authorization on every redirect; disable downgrade to HTTP; define proxy/custom-CA behavior and disclose it; revalidate origin after redirects and configuration changes; avoid credentials in URLs; and ensure error/evidence capture happens after header redaction. Pin the launch Typhoon origin and four AI-for-Thai origins/contracts before any credentialed integration test. Add redirect, proxy, certificate, malformed URL, and endpoint-substitution fixtures.

### H-3 — Tool and service outputs are untrusted prompt-injection inputs

**Locations:** FR-5 through FR-6; FR-14; FR-17; FR-38; NFR-7 and NFR-8.

The PRD treats Typhoon proposals as untrusted but does not apply the same rule to file content, OCR text, transcripts, extracted documents, command output, service errors, or service results before they enter Active Model Context. An image or repository file can contain instructions designed to make Typhoon propose destructive or exfiltrating actions. Harness validation prevents some direct escapes but not a proposal that is technically in-bounds yet contrary to the user’s goal.

**Required fix:** Require provenance-tagged, instruction-inert encoding of all tool/service content; explicitly state that retrieved content cannot change policy, permissions, destinations, or the user’s task; separate data from instructions in prompt construction; preserve origin labels through compaction; and require fresh user approval for consequential actions whose rationale depends on untrusted content. Add adversarial prompt-injection fixtures across source files, OCR, audio transcription, NER/address results, command output, and error bodies.

### H-4 — Artifact parsing and filesystem handling lack hostile-input limits

**Locations:** FR-7 through FR-9; FR-15; FR-17; NFR-3, NFR-4, NFR-6; addendum rollback questions.

PDF, DOCX, images, audio, directory manifests, recursive deletion, and binary rollback introduce parser exploitation, decompression bombs, excessive resource use, external-reference fetching, macro/package content, race conditions, and link traversal. “Type, format, size, privacy policy” is not enough unless the checks occur on the same object that is later read or changed.

**Required fix:** Add MIME/signature verification, compressed/decompressed and page/duration/dimension limits, parser time/memory limits, no external references or active content, sandboxed parsing where available, bounded directory traversal, and handle-based open/no-follow semantics. Built-in edit/delete/rollback must reject or explicitly constrain symlinks, hard links, junctions, reparse points, and aliases. Verify hashes over the exact bytes sent and bind the open handle through authorization and use. Add malicious/archive-bomb/link-race fixtures on both platforms.

### H-5 — Permission Profiles and command semantics are not complete enough to test

**Locations:** UJ-4 “Approval behavior”; FR-10; FR-21 through FR-24; FR-36; SM-C1.

Manual is partly specified in UJ-4, but Assisted is only described as “deterministic rules,” and Full Access as suppressing “eligible” prompts. The PRD lacks an action-by-profile matrix, and exact command disclosure does not specify whether the authoritative action is an executable/argv tuple or a shell string. Plan-mode preflight also risks executing commands that are believed to be read-only but have side effects.

**Required fix:** Define the complete mode × profile × action matrix, including local reads, file mutations, recursive deletion, process execution, network access, specialist calls, cache reuse, boundary expansion, and rollback-disabled actions. Prefer executable-plus-argv; if shell execution is required, disclose the shell and exact parsed form and apply separate policy. Plan must use a reviewed read-only probe registry or a sandbox that makes mutation impossible. Any missing/unknown rule asks in Manual or denies; it never inherits a broader default.

### H-6 — The Agent Loop has no normative call, cost, or iteration bound

**Locations:** FR-6; FR-14; FR-18; FR-24; FR-32; FR-39; Success Measures.

FR-6 enumerates semantic stop conditions but no maximum iterations, token/cost ceiling, wall-clock duration, repeated-tool detection, cancellation contract, or rule for model-requested retries. A poor Typhoon model can loop valid in-bound calls, repeatedly transfer data, consume quota, or keep processes alive. A persistent quota Boundary Expansion magnifies the risk.

**Required fix:** Require configurable conservative defaults for per-Prompt-Round model calls, specialist calls, tool calls, transferred bytes, tokens/cost where known, and wall time; detect repeated identical proposals; expose immediate cancellation; stop safely on budget exhaustion; and require explicit, non-durable approval to extend a running Prompt Round. Do not let schema repair or transient retry bypass the same budget. Add loop, cancellation, and quota-exhaustion fixtures.

### H-7 — Specialist Evidence cache identity is underspecified and can reuse stale or wrong results

**Locations:** FR-17; FR-19; FR-20; NFR-8.

FR-17 says derived Evidence is cached by source-content hash. Content hash alone cannot distinguish service, endpoint, request parameters, preprocessing, mapping/contract version, effective configuration, or policy/consent scope. Reusing an OCR result for a changed mapping or across a quarantined configuration can contradict exact provenance and live health semantics.

**Required fix:** Key cache entries by source hash **and** normalized service identity, verified origin, request parameters, preprocessing version, mapping/contract version, effective configuration fingerprint excluding secrets, and result schema version. Define TTL/invalidation, quarantine interaction, session deletion behavior, and whether reuse itself requires destination/data authority. Display the original observation time and never present cache reuse as a new live success.

### H-8 — Rollback encryption and “proceed unprotected” semantics are contradictory

**Locations:** UJ-7; FR-8, FR-9; FR-33 through FR-35; NFR-1 and NFR-6; addendum “Recovery and rollback mechanisms.”

FR-33 says a checkpoint is recorded before eligible mutation, while FR-35 allows a user to proceed when caps prevent rollback protection. The UI could therefore offer a prompt-level rollback that is only partially protected. Only binary originals are explicitly required to be encrypted; text patches, deleted text, paths, and metadata can contain equally sensitive content. Multi-file Prompt Rounds can exceed the cap after earlier mutations have already occurred unless total footprint is preflighted.

**Required fix:** Encrypt all rollback content and sensitive metadata, not only binary originals. Preflight the complete known mutation set before the first mutation; if later expansion would exceed a cap, pause before that mutation. Mark a Prompt Round as fully protected, partially protected, or unprotected, list exactly which operations are covered, and never offer whole-round rollback wording for partial coverage. Consider disallowing unprotected destructive deletion by default. Define atomic checkpoint/data commit ordering and add cap, crash, partial-round, concurrent-edit, rename, and deletion fixtures.

### H-9 — Session, Evidence, and telemetry retention/deletion are not release-safe yet

**Locations:** FR-25 through FR-27; FR-38 and FR-39; NFR-1, NFR-2, NFR-15; Deferred Decision 3; addendum “Session and context mechanisms.”

Sessions can contain transcripts, source excerpts, paths, addresses, NER results, command output, and specialist artifacts. The PRD defines session deletion but not deletion of related cache entries, SQLite WAL/journal/temp files, rollback data, logs, crash records, or backups. “Raw export disabled by default” still leaves external telemetry behavior ambiguous. Encryption protects content at rest but not retention or unintended export.

**Required fix:** Make external telemetry off by default for Release 1 unless the user opts in with an inspectable field list and destination. Define per-store retention, deletion cascade, file permissions, WAL/temp handling, crash-report behavior, cache lifecycle, and what secure deletion can and cannot guarantee on modern filesystems. Session deletion must revoke/index-delete all linked Evidence and cache data or explain retained shared entries. The sensitive-data policy must be signed off before release fixtures use real personal data.

### H-10 — Mandatory security decisions are listed as “deferred” but not wired into go/no-go acceptance

**Locations:** NFR-14; Section 12 Deferred Release Decisions; SM-1 through SM-4; addendum architecture questions.

The PRD correctly assigns owners and milestones, but the primary/secondary release gates do not state that public release is impossible without the sensitive-data policy, enforcement matrix, exact endpoint/model pins, private security-reporting channel, and applicable performance/resource-abuse limits. “Do not block initial architecture” also conflicts with the enforcement matrix being foundational to safe architecture.

**Required fix:** Add a release-readiness checklist with named approver, required artifact, acceptance evidence, and blocking milestone for each deferred decision. The enforcement matrix and Remote Data Authority policy must block architecture sign-off; endpoint pins must block credentialed integration; the data policy and security-reporting channel must block public enablement/publication. Unresolved items must fail the release pipeline rather than remain prose notes.

## Medium findings

### M-1 — Context compaction has no trusted mechanism or provenance-preservation rule

**Locations:** FR-29 through FR-31; NFR-13; addendum “Session and context mechanisms.”

The PRD does not say whether compaction is local/deterministic or performed by Typhoon. Model-mediated compaction can itself transfer older protected content, consume quota, introduce prompt injection, or alter provenance. A summary can also convert untrusted retrieved text into apparently trusted instructions.

**Fix:** Define the compactor, its remote-transfer authority, deterministic inputs/outputs, provenance labels, failure behavior, and tests for protected-content retention, injection markers, and reconstruction/display. Summaries must never acquire higher trust than their sources.

### M-2 — “Sanitize before display” conflicts with exact local Evidence and reliable diagnosis

**Locations:** FR-38; NFR-2; UJ-3.

NFR-2 requires sanitization before content is displayed, including command output and errors. Over-redaction can make the locally observed command output differ from the evidence used for verification; under-redaction can expose secrets. The PRD does not distinguish a raw in-memory local stream from persisted/exported sanitized Evidence.

**Fix:** Define separate representations: ephemeral authoritative local bytes, safe terminal display, persisted sanitized Evidence, and export/telemetry payload. Verification may operate on authoritative local bytes but must record a safe hash and bounded diagnostic excerpt. Add seeded-secret redaction tests and false-positive tests.

### M-3 — Encrypted local storage lacks minimum access-control and key-lifecycle requirements

**Locations:** FR-27; NFR-1; addendum “Session and context mechanisms.”

AES-256-GCM is a mechanism, but there are no normative requirements for file permissions/ACLs, nonce uniqueness, authenticated associated data, record versioning, key rotation, concurrent writes, database backups, or handling of credential-store denial. “Loss is unrecoverable” is honest but insufficient for implementation safety.

**Fix:** Require OS-user-only permissions, unique nonces, authenticated record identity/version, atomic writes, key-rotation/migration behavior, fail-closed reads on authentication failure, and tests for corruption, replay, swapped records, key loss, and concurrent process access.

### M-4 — Service health taxonomy needs precedence and anti-flapping behavior

**Locations:** UJ-3; FR-4; FR-18 through FR-20; SM-3.

The taxonomy is directionally good but ambiguous where failures overlap: a 401 from one endpoint may mean shared-key rejection, service entitlement, wrong endpoint, or protocol mismatch. Repeated transient failures have no circuit-breaker or stale-health semantics. A stale “available” badge can remain visible after endpoint or mapping changes until invoked.

**Fix:** Define deterministic precedence from transport/status/body evidence, confidence/unknown category, health TTL, invalidation triggers, repeated-transient backoff/circuit state, and anti-flapping rules. Unknown must not become a model-selected category or a shared quarantine without evidence.

### M-5 — The headline proof can pass without proving the intended executable was run

**Locations:** UJ-4 headline evidence; FR-12; SM-1.

“Source exists, compiler exits 0, execution exits 0, stdout contains the greeting” can be satisfied by a command that merely echoes the expected string or runs a stale binary. It does not bind source hash to compiler input and resulting executable to the run.

**Fix:** Record the source hash, exact compiler executable/argv, output artifact identity/hash where feasible, exact run executable/argv, exit statuses, and stdout. The fixture should clean the workspace first and reject shell-only `echo` as verification.

## Low findings

### L-1 — Confidence and uncertainty fields need explicit “not provided” semantics

**Locations:** FR-17; FR-38.

Not every AI-for-Thai service will return calibrated confidence. Requiring “confidence or uncertainty” could encourage thcode to synthesize a number.

**Fix:** Define provider-reported confidence, harness-derived validation state, and “not provided” as separate fields; never convert absence into a score.

### L-2 — Catalog observation date does not define freshness or revocation behavior

**Locations:** Section 4 AI-for-Thai specialist services; FR-13; FR-36.

The UI shows manifest version/observation date, but does not define when old evidence becomes stale or how a compromised/withdrawn integration is disabled.

**Fix:** Define a signed/bundled registry version, staleness wording, release/update path, emergency revocation behavior, and fail-closed handling of invalid registry data. Release 1 can use package updates rather than a remote registry.

## Required gate disposition

The PRD can be finalized as a planning artifact only if the three critical findings and H-10 are explicitly carried as blockers. It should not be marked implementation-ready until C-1 and C-2 have normative contracts. It should not be marked release-ready until C-3 and all High findings have acceptance evidence or an explicit scope cut that removes the affected capability.

Recommended minimum security gate artifacts:

1. Windows/macOS platform-action enforcement matrix and adversarial boundary tests.
2. Remote Data Authority and sensitive-data policy covering both Typhoon and AI-for-Thai.
3. Credential origin/redirect/proxy contract and pinned provider/service endpoints.
4. Durable remote-dispatch and rollback state-machine specifications with kill-point tests.
5. Permission/profile/action matrix plus Prompt Round resource budgets.
6. Session/Evidence/cache/rollback retention, encryption, deletion, and telemetry policy.
7. Prompt-injection and hostile-artifact test suite.
8. Signed release-readiness checklist with named owners and blocking milestones.
