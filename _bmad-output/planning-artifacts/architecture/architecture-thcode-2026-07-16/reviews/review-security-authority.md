# Security Authority Review — Clearance Recheck

**Verdict: PASS — no Critical or High security-authority invariant gaps remain.**

**Scope.** Clearance recheck of the current `ARCHITECTURE-SPINE.md` at invariant altitude. Reviewed remote transport, grants and PEP authority, quota handling, filesystem/process effects, event dispatch and unknown outcomes, context/cache provenance, persistence/migration/recovery, cryptographic envelopes and rotation, sanitization, and artifact preparation/retention.

## Verified bindings

- **Transport and transfer:** AD-4 requires HTTPS with standard certificate and hostname verification; prohibits TLS downgrade/bypass; rejects unauthorized or cross-origin redirects; and revalidates the final origin and transfer consent before transfer. AD-17 binds consent to content, verified recipient capability/version/endpoint, purpose, call count, scope, expiry, and operation; AD-25 provides prepared bytes/text rather than path or fetch authority.
- **Authority and PEP:** AD-4 makes remote output proposal-only and confines concrete adapters to the PEP-owned executor. AD-17 keeps work mode, profile, operation approval, transfer consent, and boundary expansion independent. AD-22 makes runtime activation fresh and revalidates its revision immediately before effect start.
- **Quota and unknown effects:** AD-4 atomically reserves quota and holds indeterminate reservations pending reconciliation. AD-13 defines authorization-consumption plus durable `EffectDispatchCommitted` as the dispatch linearization point, requires durable terminal outcomes, and prohibits unsafe automatic replay of unknown remote or shell outcomes.
- **Filesystem and process effects:** AD-12 binds authorization to stable resource identity and expected state, requires conditional compare-and-apply under cross-process locking or an equivalent primitive, requires symlink/junction/mount/rename/case/Unicode revalidation, constrains executable identity/argv/cwd/environment, contains process trees, and fails closed where enforcement is unavailable.
- **Event, context, and cache integrity:** AD-3 provides durable idempotent event append before publish and durable terminal facts. AD-7 records canonical transmitted-context manifests and bytes digests. AD-10 binds cache identity to a versioned canonical manifest and persists provenance with results.
- **Commit, migration, and recovery:** AD-20 stages durable artifacts/checkpoints before transactional visibility, uses a store-wide format gate, validates migrations before promotion, opens incompatible stores read-only, and never replays side effects during recovery.
- **Encryption lifecycle:** AD-21 requires AES-256-GCM, unique per-DEK nonces, versioned envelopes, canonical AAD bound to store/record/content/schema/key context, fail-closed decryption, staged verified rotation, old-key retention until safe cleanup, and locked recovery on key/rotation failure.
- **Sanitization and retention:** AD-24 requires the shared sanitizer on every stated persistence, presentation, export, model-context, evidence, and transfer path. AD-26 atomically cleans session references, reference-counted artifacts/cache entries, and unreferenced sensitive content with journaled recovery.

No further Critical or High authority-level gap is substantiated in the current spine.
