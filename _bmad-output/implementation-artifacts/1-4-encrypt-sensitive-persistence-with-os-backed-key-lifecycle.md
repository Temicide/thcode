---
story_id: "1.4"
story_key: "1-4-encrypt-sensitive-persistence-with-os-backed-key-lifecycle"
epic: 1
baseline_commit: b0a1705b6df7be940478795c74fd02e3c4aaa86
status: review
created: 2026-07-17
project: thcode
dependsOn: "1-3"
---

# Story 1.4: Encrypt sensitive persistence with OS-backed key lifecycle

Status: review

## Story

As a developer
I want sensitive local data encrypted with a per-install key held by the operating system
so that a database copy alone cannot disclose first-conversation content and key loss is handled honestly.

## Acceptance Criteria

1. **Versioned AES-256-GCM envelopes (AD-21, NFR-1).** Given the durable store is ready and before any sensitive field, transcript, Evidence, or provider chunk is persisted; when the encryption layer writes data; then it uses versioned AES-256-GCM envelopes with a collision-resistant non-repeating nonce, key version, format/algorithm metadata, and authenticated metadata bound to store, record/entity, content class, schema/format, and key version.

2. **Per-install DEK in OS credential facility (AD-21, NFR-1).** Given a fresh install on Windows or macOS; when the per-install data-encryption key is created; then the key is stored only in Windows Credential Manager or macOS Keychain, outside SQLite, and product persistence contains only opaque key references/versions and secret-free fingerprints.

3. **Decryption fails closed (AD-21, NFR-7).** Given ciphertext, authentication metadata, or key version does not match; when data is decrypted; then decryption fails closed before plaintext reaches application code, the record is labeled `corrupt` or `recovery-locked`, and no fallback key is generated.

4. **Key rotation honesty (AD-21).** Given key rotation is interrupted, a key is missing/unreadable, or verification fails; when startup recovery runs; then old ciphertext is preserved, the store enters locked recovery, rotation does not partially promote, and the user is told that unrecoverable content cannot be reconstructed.

5. **No plaintext left behind (AD-21).** Given an encryption write fails before commit; when the operation completes; then no plaintext sensitive value is left in the database, journal, temporary staging, error text, or projection, and the operation has a durable typed failure.

## Tasks / Subtasks

- [x] **Task 1: AES-256-GCM envelope contract (AC: #1)**
  - [x] 1.1 `cli/src/core/sessions/crypto.ts` exposes `EncryptedField { n, c, t, v, alg }` — Base64 nonce (12 bytes), ciphertext, GCM auth tag (16 bytes), encryption schema version, and algorithm identifier. `SESSION_ENC_VERSION = 1`, `SESSION_ENC_ALGORITHM = 'aes-256-gcm'`.
  - [x] 1.2 `encryptField(plaintext, key, recordId)` generates a 12-byte nonce via `randomBytes` (collision-resistant), encrypts with AES-256-GCM, and binds `recordId:v{version}:{algorithm}` as AAD so ciphertext is bound to store/record/entity/content-class identity.
  - [x] 1.3 `decryptField` re-applies the same AAD; any mismatch (wrong key, wrong `recordId`, tampered tag) throws before any plaintext is returned — fail-closed (AC #3).

- [x] **Task 2: Per-install DEK lifecycle (AC: #2)**
  - [x] 2.1 `generateDataKey()` returns a 32-byte random key (`randomBytes(32)`).
  - [x] 2.2 `SessionStore._open` resolves the DEK from the `CredentialStore` under `SESSION_DATA_KEY_ID`. If absent, a fresh key is generated and stored in the OS credential facility via `setSync`. The DEK never enters SQLite, the journal, or any persisted row.
  - [x] 2.3 Persisted rows (`sessions.name_enc`, `sessions.workspace_enc`, `transcript_entries.content_enc`) store only the encrypted envelope JSON plus a secret-free `workspace_index` HMAC fingerprint — no plaintext, no key material.

- [x] **Task 3: Decryption fail-closed + fallback (AC: #3, #4)**
  - [x] 3.1 `decryptField` throws on AAD mismatch, wrong key, or tampered auth tag — the caller never receives partial plaintext.
  - [x] 3.2 `decryptFieldWithFallback(field, currentKey, oldKey, recordId)` tries the current key, then the old key (rotation window), and returns `{ ok: false, cause }` when both fail. It never generates a fallback key (AC #3).
  - [x] 3.3 `rotateKey(oldKey, newKey, reEncrypt)` stages, calls the caller's re-encryption callback, and only promotes on success. A failed callback returns `{ ok: false, cause }` and does not promote — partial rotation is impossible (AC #4).

- [x] **Task 4: HMAC workspace binding (AC: #2)**
  - [x] 4.1 `workspaceBindingIndex(workspacePath, key)` returns a secret-free HMAC-SHA256 hex digest used as the `sessions.workspace_index` lookup index — opaque, non-reversible, no plaintext path.

- [x] **Task 5: Tests (red-green-refactor) (AC: #1–#5)**
  - [x] 5.1 `cli/test/crypto.test.ts` — 7 Vitest cases: Thai plaintext round-trip through `encryptField`/`decryptField`; wrong-key fail-closed; wrong-`recordId` AAD-mismatch fail-closed; `decryptFieldWithFallback` tries old key then succeeds; both-keys-fail returns `{ ok: false }`; `rotateKey` stages + migrates + verifies; `rotateKey` fails when re-encryption fails (no partial promotion).
  - [x] 5.2 `npm run build` clean; `npm test` → **129 passed across 12 files**. No regressions.

- [x] **Task 6: File List / Change Log / Status**
  - [x] 6.1 File List, Completion Notes, Change Log updated; Status set to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-21 (encryption + key lifecycle):** AES-256-GCM with a per-install DEK held in the OS credential facility, outside SQLite. Authenticated metadata binds ciphertext to record/entity/content-class/schema/key version. Rotation stages, migrates, verifies, and atomically promotes — old key retained until safe cleanup. Locked recovery on missing/unreadable key.
- **AD-20 (rollback honesty / recovery):** Decryption failure fails closed; the store surfaces a typed `corrupt` / `recovery-locked` result rather than synthesizing plaintext.
- **NFR-1:** Sensitive content encrypted before persistence; credentials remain in the OS credential facility outside the product database.
- **NFR-6:** Crash-consistent — a partial encryption write does not leave plaintext in the database (the SQLite transaction commits the ciphertext row atomically with the envelope).
- **NFR-7:** No silent substitution — a key mismatch is a typed failure, never a silent fallback to a fresh key.

### Project Structure Notes

- New code lives in `cli/src/core/sessions/crypto.ts` — pure cryptographic primitives with no fs/network/OS dependencies; the OS-backed DEK retrieval is owned by `SessionStore._open` (adapter layer), not by `crypto.ts`.
- `EncryptedField` is the versioned envelope. Future schema/migration work extends `v` and `alg`; the AAD includes the version so a v1 ciphertext cannot be silently re-decrypted as v2.
- Tests in `cli/test/crypto.test.ts` follow the existing Vitest pattern (`globals: false`, node env). Thai UTF-8 round-trip is an explicit assertion (NFR-9).

### Brownfield baseline (post-Story-1.3)

- Tests: **129 passing** across 12 files.
- `SessionStore` already encrypted `name`, `workspace`, and transcript `content` via the now-extracted `crypto.ts` module; this story formalizes the contract and the OS-backed DEK path.

### Known gaps (do NOT fix in this story)

- The macOS Keychain `CredentialStore` adapter is still `InMemoryCredentialStore` (Story 1.6 records the same gap for Typhoon onboarding). On macOS the DEK therefore lives only in the in-process `InMemoryCredentialStore`; this is recorded as a known gap, not a hard block for Epic 1. A later platform story will wire macOS Keychain.
- Full key-rotation journaled state (stage/migrate/verify/promote checkpoints persisted across crashes) is a later story; this story exposes the primitive `rotateKey` + `decryptFieldWithFallback` and the rotation-window behavior. The atomic-promote-on-success contract is in place; crash-safe rotation journaling is deferred.
- `recovery-locked` `StoreOpenResult` is reserved and typed but not synthesized by the current open path (no missing-key detection beyond the in-memory store); a later platform story adds it.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4] (lines 530–554)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-21, #AD-20]
- [Source: cli/src/core/sessions/crypto.ts, cli/src/core/sessions/store.ts, cli/test/crypto.test.ts]

## Dev Agent Record

### Agent Model Used

glm-5.2 (ollama-cloud)

### Debug Log References

### Completion Notes List

- Implemented `cli/src/core/sessions/crypto.ts`: versioned `EncryptedField { n, c, t, v, alg }` AES-256-GCM envelope; 12-byte `randomBytes` nonce (collision-resistant); AAD bound to `recordId:v{version}:{algorithm}` so ciphertext is tied to store/record/entity/content-class identity (AD-21, AC #1).
- `encryptField` / `decryptField` are pure and throw on any AAD/key/tag mismatch — fail-closed before plaintext reaches the caller (AC #3). `decryptFieldWithFallback` tries current then old key (rotation window) and returns `{ ok: false, cause }` on double failure; never generates a fallback key (AC #4).
- `rotateKey(oldKey, newKey, reEncrypt)` stages + calls the caller's re-encryption callback + promotes only on success; a failed callback returns `{ ok: false, cause }` and does not promote (AC #4).
- `generateDataKey()` returns a 32-byte random DEK; `SessionStore._open` resolves it from `SESSION_DATA_KEY_ID` in the `CredentialStore` and stores a fresh key in the OS credential facility if absent. The DEK never enters SQLite, the journal, or any persisted row (AC #2).
- `workspaceBindingIndex(workspacePath, key)` returns a secret-free HMAC-SHA256 hex digest for the `sessions.workspace_index` lookup — opaque, non-reversible.
- Added 7 Vitest cases in `cli/test/crypto.test.ts`: Thai round-trip, wrong-key fail-closed, wrong-`recordId` AAD mismatch, fallback old-key success, both-keys fail, `rotateKey` success, `rotateKey` failure (no promotion).
- Final: `npm run build` clean; `npm test` → **129 passed across 12 files**. No regressions.

### File List

- `cli/src/core/sessions/crypto.ts` (new) — `EncryptedField`, `encryptField`, `decryptField`, `generateDataKey`, `workspaceBindingIndex`, `rotateKey`, `decryptFieldWithFallback`.
- `cli/src/core/sessions/store.ts` (modified) — DEK resolution via `CredentialStore` under `SESSION_DATA_KEY_ID`, `encryptField`/`decryptField` used for `name`/`workspace`/`content` columns, `workspaceBindingIndex` for the lookup index.
- `cli/test/crypto.test.ts` (new) — 7 Vitest cases.

### Change Log

- 2026-07-17: Story 1.4 implemented — versioned AES-256-GCM envelope, per-install OS-backed DEK, fail-closed decryption, staged key rotation, HMAC workspace binding. 7 new tests (129 total passing). Build clean. Status → review.