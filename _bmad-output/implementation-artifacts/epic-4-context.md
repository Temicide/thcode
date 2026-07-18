# Epic 4 Context: Use Thai Specialist Services with Informed Consent

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A developer can discover the reviewed AI-for-Thai catalog, connect just in time, route natural prompts to one of exactly four working services, resolve and minimize local artifacts, consent to exact transfers, receive attributable results, reuse valid cache Evidence, and recover from scoped failures. The official AI-for-Thai endpoint is called directly from the local CLI; no hosted proxy, client/server path, or compatibility layer is used. One local AI-for-Thai key group serves the four launch services and never reaches Typhoon.

## Stories

- Story 4.1: Define and publish the versioned Capability Registry contract
- Story 4.2: Browse, search, inspect, and honestly disable catalog entries
- Story 4.3: Onboard the shared AI-for-Thai credential just in time
- Story 4.4: Generate effective configuration and enforce the health lifecycle
- Story 4.5: Route natural prompts with only task-relevant schemas
- Story 4.6: Resolve explicit artifacts and preserve source identity
- Story 4.7: Validate and minimize each supported artifact type
- Story 4.8: Prepare exact payload identity and independent transfer consent
- Story 4.9: Establish shared Specialist adapter, result, and failure contracts
- Story 4.10: Integrate T-OCR as a working Specialist Service
- Story 4.11: Integrate Speech-to-Text as a working Specialist Service
- Story 4.12: Integrate Extract Address as a working Specialist Service
- Story 4.13: Integrate Named Entity Recognition as a working Specialist Service
- Story 4.14: Persist immutable Specialist Evidence and versioned CacheManifest identity
- Story 4.15: Reuse, force-fresh, retain, and invalidate Specialist cache Evidence
- Story 4.16: Classify failures and quarantine the smallest proven scope
- Story 4.17: Provide explicit retest and scoped recovery
- Story 4.18: Verify the deterministic registry and shared-adapter contract matrix
- Story 4.19: Verify per-service prompt-driven end-to-end flows
- Story 4.20: Verify failure, cache, quarantine, retest, and output parity

## Requirements & Constraints

- **Implementation prerequisite PR-2:** The approved sensitive-data and Remote Data Authority policy matrix must exist before Epic 4 begins. Provider retention/deletion handling must be verified and permitted for the exact configuration and data class before any payload is prepared for transport. No-retention is preferred but not universally required; provider-side deletion lifecycle states apply only when the provider contract supports them. If the contract does not support deletion, transfer is `BLOCKED` rather than assumed safe.
- **Capability Registry:** A reviewed, versioned, offline manifest (AD-15). Only the four launch services have `invokable: true`; every other known entry carries `Catalogued — Not available yet` and cannot be invoked. Malformed, stale, revoked, or missing-contract manifests fail closed for invocation.
- **Credential isolation (AD-11):** One AI-for-Thai key forms one canonical `CredentialGroupId` for its four services. Keys never enter prompts, repositories, logs, telemetry, crash reports, sessions, previews, or output. Product persistence stores only opaque references/revisions and secret-free fingerprints.
- **No silent fallback (AD-14):** Unavailable/quarantined dependencies produce typed recovery actions. A different dependency requires an explicit recorded routing decision. Release 1 has no alternate reasoning provider. Invalid structured proposals are rejected after one local validation pass.
- **Health lifecycle (AD-8):** States are `unconfigured` -> `configured` -> `checking` -> `available | unavailable | unhealthy | quarantined`. Only explicit retest exits quarantine. `configured` never implies `available`. Canonical tokens are used in all output modes; color is never the sole carrier.
- **Failure classification (AD-9, AD-18):** Deterministic categories: entitlement, quota/rate limit, unsupported input, transient network, failed health, authentication, protocol incompatibility, configuration failure, or unknown outcome. Quarantine applies the smallest proven scope. Shared-key rejection atomically affects all four services. Transient failures, quota, and unsupported input do not quarantine after one occurrence.
- **Consent (AD-17):** Full Access, local approval, cache reuse, or prior consent never substitute for a fresh exact consent decision per transfer. `PreparedPayloadManifest` has a canonical digest and exact payload-byte digest; transfer consent binds both. Any change after consent marks it `mismatch`/`stale` and blocks sending.
- **Sanitization (AD-24):** One versioned `Sanitizer` runs before potentially sensitive content is persisted, displayed, logged, exported, included in model context, or summarized. Policies are content-class-specific.
- **Artifact resolution (AD-25):** `ArtifactResolver` resolves explicit in-workspace references, validates containment/type/format/size/privacy/compatibility, and emits an immutable prepared-content manifest. PDF/DOCX text is extracted locally by default. Remote requests receive prepared bytes/text and manifest, never unresolved local paths.
- **Output parity:** Every Specialist output, failure, and state must be semantically equivalent across interactive, linearized, redirected, narrow, Thai/mixed-language, and headless modes. Canonical tokens and exact service identifiers remain unchanged; color is never the sole meaning.

## Technical Decisions

- **Capability Registry schema:** Each entry carries stable thcode and upstream identity, Thai and canonical-English names/search terms, capabilities, supported inputs and limits, entitlement, evidence level, observation date, endpoint/transport rules, privacy and retention classification, confirmation policy, manifest/contract/adapter versions, latest contract-test result, and explicit invokable status.
- **EffectiveConfigurationGeneration:** An immutable fingerprint binding endpoint/origin, service mapping, credential reference and revision, registry manifest version, contract version, adapter version, transport policy, and relevant request configuration. Health results are valid only for the generation they were checked against.
- **PreparedPayloadManifest:** A versioned record containing purpose, recipient service identity, verified final origin, method, ordered semantic inputs, source identities and hashes, transformations/redactions, retention/deletion classification, call count, scope, expiry, contract/capability versions, and exact payload-byte digest.
- **Specialist Evidence (AD-10):** Immutable record containing source-content hash, service/capability identity, effective configuration generation, returned and empty fields, confidence/uncertainty, provenance, ConsentReference, timing, normalized failure if any, schema version, and completeness state. Raw payload bytes are never persisted as outbound transfer records.
- **CacheManifest identity:** Versioned digest of service/capability contract, verified origin, ordered semantic inputs and content hashes, request options, preprocessing, mapping/schema version, effective configuration generation, transformation/redaction policy, and source identity. Cache lookup precedes live-health gating; valid cached Evidence is reusable even when the service is quarantined. Force-fresh requires current availability and never deletes prior Evidence.
- **Shared adapter contract:** One adapter accepts exact service identity, contract/manifest versions, EffectiveConfigurationGeneration, PreparedPayloadManifest, ConsentReference, OperationId, and bounded request options. It calls the official AI-for-Thai endpoint directly from the local CLI. Results preserve returned fields, empty fields, confidence/uncertainty, source hash, and provenance without inventing fields. Failures emit a common sanitized envelope with deterministic category, retryability, smallest proven scope, and safe message.
- **Provider-deletion lifecycle (AD-26.1):** States (`upstream-no-retention-verified`, `deletion-not-required`, `deletion-pending`, `deletion-confirmed`, `deletion-failed`) are conditional on the verified provider contract supporting them for the exact recipient, endpoint, capability/version, configuration generation, and data class. If unsupported, transfer is `BLOCKED`.

## UX & Interaction Patterns

- **`/tools` catalog:** Supports browse, Thai/English search, inspect, enablement where permitted, disablement, diagnosis, and retest. `Catalogued — Not available yet` entries offer inspection only and cannot produce an invocation proposal, adapter call, prepared payload, or consent prompt.
- **`specialist-card` component:** Distinguishes `working`, `Catalogued — Not available yet`, `disabled`, `unconfigured`, `unhealthy`, and `quarantined` with canonical state tokens and non-color meaning.
- **`transfer-consent-dialog`:** Shows recipient, verified HTTPS endpoint, purpose, method, safe payload summary, source identity, classification, retention/deletion status, side effects, manifest digest, payload digest, and ConsentReference. Credentials and raw secrets never appear. Initial focus is `consent-review` or `consent-cancel`; never Consent.
- **`credential-form`:** Provider, verified host, storage, and purpose precede masked input. No value appears in UI, accessibility, logs, snapshots, clipboard, scrollback, or headless output. Cancel clears secret buffers.
- **`evidence-panel`:** Shows deterministic classification before explanation, completeness/provenance, omission reasons, observation/display times, and safe copy. Specialist output, Typhoon explanation, Evidence, and failure provenance have separate headings.
- **Routing disclosure:** Before any remote call, thcode proposes the selected service with service identity and plain-language rationale. Only task-relevant schemas enter Active Model Context. Ambiguous or unsupported prompts produce clarification or `refused`/`blocked`; no silent substitution.
- **Canonical state tokens (color-independent):** `working`, `Catalogued — Not available yet`, `disabled`, `unconfigured`, `configured`, `checking`, `available`, `unavailable`, `unhealthy`, `quarantined`, `stale`, `mismatch`, `denied`, `refused`, `blocked`, `not sent`, `unknown-outcome`. These are emitted unchanged in English, Thai, mixed output, Evidence, completion, redirected text, and headless JSON.

## Cross-Story Dependencies

- **Story 4.14 (immutable Evidence + CacheManifest) must precede Stories 4.10-4.13** (service integrations). Service integrations consume the already-owned envelope rather than defining it.
- **Story 4.1 (Capability Registry) precedes** 4.2 (browse/search), 4.4 (health lifecycle), 4.5 (routing), and 4.9 (adapter contract).
- **Story 4.3 (credential onboarding) precedes** 4.4 (health lifecycle), 4.10-4.13 (service integrations).
- **Stories 4.6 (artifact resolution) and 4.7 (validation/minimization) precede** 4.8 (payload/consent).
- **Story 4.8 (payload/consent) precedes** 4.9 (adapter contract) and 4.10-4.13 (service integrations).
- **Story 4.9 (shared adapter contract) precedes** 4.10-4.13 (service integrations).
- **Stories 4.10-4.13** (T-OCR, Speech-to-Text, Extract Address, NER) are independent of each other.
- **Story 4.15 (cache reuse) depends on** 4.14 (Evidence/CacheManifest).
- **Story 4.16 (failure classification/quarantine) depends on** 4.9 (adapter contract).
- **Story 4.17 (retest/recovery) depends on** 4.16 (failure classification).
- **Stories 4.18-4.20 (verification) depend on** all preceding stories.
