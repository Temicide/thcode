# Final Reviewer Gate — Architecture Spine

**Artifact reviewed:** `ARCHITECTURE-SPINE.md`, current 2026-07-16 revision  
**Authoritative source:** `../../../prds/prd-thcode-2026-07-14/prd.md`  
**Method:** Good-spine rubric; PRD coverage and enforceability review.  
**Verdict:** **PASS — no verified Critical or High architecture gap remains.**

`[ADOPTED]` decisions were assessed as architecture commitments, not implementation-completeness claims. Mandatory release-policy, platform-fixture, and clean-machine validation work remains a release gate; it is not an unbound Critical/High architecture contract in this spine.

## Clearance recheck

The five prior high-severity findings are now bound by the following enforceable shared contracts:

- **Exact prepared-payload consent (former H1):** AD-17 requires an immutable `PreparedPayloadManifest` canonical digest and exact payload-byte digest in transfer consent, scoped to the verified recipient capability/version/endpoint, purpose, call count, expiry, and operation/prompt. The PEP recomputes both immediately before transport; any transformation or mismatch requires fresh consent. Together with AD-25's sole `ArtifactResolver` preparation authority and no-path dispatch boundary, this prevents a source artifact or preliminary representation from authorizing substituted outbound bytes.
- **Durable remote-stream recovery (former H2):** AD-3 requires sanitized, idempotent `RemoteOutputObserved` chunks to be durably appended with upstream sequence/high-water identity before UI publication. Completion seals the stream; recovery restores those durable chunks and places `ChatInterrupted` at the reliable high-water mark, satisfying FR-32's known-output and exact-boundary requirement.
- **Transient/quota quarantine (former H3):** AD-18 expressly retains unsupported input, timeout, network loss, rate limit, quota exhaustion, and upstream-server failure as request/quota states after one occurrence. Only deterministic authentication, protocol, or configuration evidence can quarantine, with smallest-proven scope and explicit generation-bound retest.
- **Permission-profile eligibility (former H4):** AD-27 assigns a versioned PEP-owned `PermissionMatrix` over action class, Work Mode, Permission Profile, risk/sensitivity, and hard-boundary state. It defines `allow | ask | deny`, Plan-mode mutation denial, Assisted uncertainty prompts, Full Access limits, non-overridable hard boundaries, consent for sensitive transfer, and fail-closed unknown action classes.
- **Instruction-inert untrusted context (former H5):** AD-7 reserves trusted instruction channels for application-owned versioned instructions and Capability Registry tool schemas. User, workspace, artifact, tool-result, and remote content are source-labelled, delimited, provenance-bound data that cannot alter tools, policy, authority, or executable registry metadata. The immutable `ContextManifest` and transmitted-byte digest preserve the applied projection at dispatch.

## Other previously scrutinized contracts

- **Quota and uncertain dispatch:** AD-4 atomically reserves scoped allowance before dispatch and holds indeterminate reservations pending reconciliation; AD-13 makes durable authorization consumption plus `EffectDispatchCommitted` the effect linearization point and forbids unsafe replay of unknown remote or shell outcomes.
- **Deletion, commit, and recovery:** AD-20 provides staged durable artifacts/checkpoints, transactional visibility, format gating, migration validation, read-only incompatible recovery, and no recovery-time effect replay. AD-26 makes session-reference removal, reference counting, sensitive-artifact/cache cleanup, explicit retention, and partial-cleanup recovery one lifecycle.
- **Encryption and native mutation correctness:** AD-21 binds sensitive persistence to versioned AES-256-GCM envelopes, non-repeating per-DEK nonces, record-context AAD, staged verified rotation, and locked key-loss recovery. AD-12 binds filesystem authority to stable identity and expected state, then requires fail-closed cross-process compare-and-apply with effect-time revalidation.
- **Transfer preparation and sanitization:** AD-24 supplies a versioned mandatory pre-sink `Sanitizer`; AD-25 centralizes bounded in-workspace resolution, validation, minimization/extraction, immutable preparation, and prohibition on remote path/fetch authority.

## Good-spine gate checks

| Rubric test | Result | Basis |
| --- | --- | --- |
| Fixes all real Release-1 divergence points | Pass | The shared protocol, PEP/effect state machine, durable commit/recovery path, authority model, platform boundary, context boundary, and artifact lifecycle define compatible epic seams. |
| Every AD Rule is enforceable and prevents its divergence | Pass | The rules identify owners and binding inputs/outputs; explicit policy/matrix and contract-test deliverables remain implementation/release work under their governing ADs. |
| Deferred permits no incompatible builds | Pass | Deferred wire/schema/mechanism details remain behind fixed canonical contracts; AD-12 requires its platform/action matrix and AD-25/AD-17 constrain affected transfer behavior before dispatch. |
| PRD capabilities are covered | Pass | FR-15–16, FR-18–24, FR-26–35, NFR-1–3, and NFR-6 are covered by the resolver/consent, health, PEP/profile, session/recovery, encryption, sanitization, and platform rules. |
| Every owned structural/operational dimension is decided, deferred, or open | Pass | The spine explicitly assigns ownership for protocol, persistence, authority, health, effects, context, transfers, encryption, retention, platform enforcement, and UI boundaries. |

## Final determination

**PASS.** No further Critical or High architecture finding is verified against the current spine and authoritative PRD. This gate does not waive the PRD's required release fixtures, sensitive-data-policy completion, platform/action-matrix completion, service-contract verification, or clean-machine validation.
