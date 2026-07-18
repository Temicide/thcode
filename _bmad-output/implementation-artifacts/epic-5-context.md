# Epic 5 Context: Govern Active Context and Usage

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give developers an inspectable, bounded, and trustworthy Active Model Context for each Typhoon request while preserving the complete transcript as immutable local history. Epic 5 separates current context utilization from cumulative usage, protects pinned and required material, compacts safely before dispatch, stops honestly when protected content cannot fit, and records context governance through the existing encrypted journal without taking ownership of Saved Session browsing or full restoration.

## Stories

- Story 5.1: Define immutable transcript and Active Model Context contracts
- Story 5.2: Establish durable PinId and pin persistence before context building
- Story 5.3: Build a bounded, provenance-aware Active Model Context
- Story 5.4: Compute Effective Context Capacity with verified and fallback measurements
- Story 5.5: Finalize ContextManifest and transmitted identity before dispatch
- Story 5.6: Expose `/context` inspection and explicit context actions
- Story 5.7: Separate `/usage` cumulative ledger from Active Context
- Story 5.8: Compact deterministically before over-capacity dispatch
- Story 5.9: Stop protected overflow with categorized accounting and remedies
- Story 5.10: Persist context decisions, manifests, compaction, and usage crash-consistently
- Story 5.11: Define versioned context extension envelopes and ownership
- Story 5.12: Recover current-session context governance safely
- Story 5.13: Render recovered context and usage accessibly and invalidate stale authority

## Requirements & Constraints

- Preserve the full transcript byte-for-byte as immutable local history; Active Model Context is a separately versioned, bounded, derived projection with explicit inclusion, exclusion, compaction, pinning, protection, provenance, trust, measurement, and transformation state.
- Only application-owned instructions and reviewed Capability Registry schemas may occupy trusted instruction channels. User, Workspace, artifact, tool-result, Specialist, and remote/provider content remains source-labelled, delimited, provenance-bound, and instruction-inert.
- Context projection, trust checks, capacity checks, manifest finalization, policy checks, and applicable consent/approval validation are mandatory pre-dispatch gates in every Work Mode and Permission Profile. No provider, adapter, retry, or UI path may bypass them.
- Effective Context Capacity uses a verified model limit minus response reserve and safety margin. Use the greater of configured max output or 8% of raw context for response reserve, and the greater of 2,048 tokens or 2% of raw context for safety margin. Until a named provider/product decision supplies a verified limit, do not assume `128k` or `115,200`; show `percentage unavailable`, emit no numeric utilization, and fail closed for dispatch where authority or fit cannot be established.
- Utilization severity is text-labelled: green `<70%`, amber `70–84%`, orange `85–94%`, red `95–100%`. Provider-reported counts remain distinct from local measurements, estimates, fallback values, and unknown values.
- Automatic compaction is deterministic and cannot be bypassed. It may transform older unpinned material, preserves current instructions, required recent turns, pins, and protected content, targets no more than 70% when possible, and records immutable source identities, provenance, policy/version, measurements, and manifest linkage. Protected overflow stops before provider invocation with categorized accounting and explicit remedies; no silent truncation, unpinning, or blind retry.
- Persist only sanitized, permitted representations, source identities/hashes, decision metadata, and Evidence references. Never persist credentials, raw provider payloads, or unapproved outbound bytes. Context/usage records must be crash-consistent, encrypted with the existing OS-held key, versioned, idempotent, and visible only after post-commit events.
- Context extension records require explicit kind, schema/format version, stable identity, SessionId and ownership boundary, checksum, provenance, and forward-compatibility metadata. Unknown valid extensions remain opaque and non-authoritative rather than being dropped or guessed into current state.
- NFR-14 numeric performance budgets remain a release gate; Epic 5 must not invent them. Safety/resource caps used by implementation must be versioned before consuming stories.

## Technical Decisions

- The persisted Session is the aggregate root for transcript, pins, context decisions, manifests, Evidence, and usage; Runtime Activation owns live authority, temporary approvals, and transfer consent.
- Use the existing CoreProtocolV1 facade and canonical domain/port boundaries. `ContextBuilder` selects and ranks content; the provider adapter performs final serialization and returns an immutable `ContextManifest` plus exact transmitted-byte digest before dispatch.
- Bind manifests, transmitted bytes, approvals, consent, model/configuration generation, and operation identity together. Recompute identity immediately before dispatch; any byte, destination, classification, authority revision, or expiry change makes prior authority stale.
- Use the Epic 1 operation journal, aggregate versioning, EventId/operation/PinId/manifest deduplication, sanitizer boundary, AES-256-GCM persistence, and locked recovery semantics. Recovery never replays provider dispatch or compaction side effects and never generates a fallback key/plaintext.

## UX & Interaction Patterns

- `/context` exposes ranked contributors, inclusion mode, provenance, token contribution, digest, capacity/reserves, measurement source, compaction history, and final ContextManifest identity. Explicit actions are inspect, pin, unpin, compact, new-session, and retry; consequence is stated before activation.
- `/usage` is a separate cumulative ledger for input, output, cached input, calls, period, model, source, and observation. It never borrows context contributors or shows a percentage without a real configured budget.
- Ink, redirected, monochrome, headless JSON, screen-reader, reduced-motion, and narrow-terminal output use the same canonical fields and labels. The Context Donut degrades to text accounting; color and durable redraw are never required for meaning. Stale approvals/consent are disabled before the next key event, retained as non-authorizing Evidence, and require fresh review.

## Cross-Story Dependencies

- Epic 5 requires Epic 1's CoreProtocolV1, encrypted store, journal, post-commit event protocol, sanitizer, and recovery foundations, plus the provider/registry and authority contracts established by Epics 2–4.
- PR-4 (verified context-capacity source) is approved before Epic 5; it is a prerequisite, not a later Epic 7 decision. Epic 5 must honor the context-envelope and persistence ordering convention: Stories 5.11 and 5.10 establish contracts and storage before consumers in Stories 5.2, 5.7–5.9, 5.12, and 5.13.
- Epic 6 later consumes Epic 5's extension envelopes and current-session records for Saved Session restoration, but Epic 5 does not implement session browsing, deletion, Workspace rebinding, or complete restoration.
