---
story_id: "3.2"
story_key: "3-2-establish-encrypted-checkpoint-repository-and-artifactstore-foundations"
epic: 3
baseline_commit: 9765947
status: review
created: 2026-07-17
project: thcode
dependsOn: "3.1;1.3;1.4"
---

# Story 3.2: Establish encrypted CheckpointRepository and ArtifactStore foundations

Status: review

## Implementation
- `cli/src/core/checkpoints/types.ts` — typed contracts: `CheckpointId`, `ArtifactId` (branded opaque ids), `CheckpointRecord`, `ArtifactRecord`, `ContentMetadata` (digest, size, content class, schema/key version), `CoverageState`, `RetentionState`, `IntegrityState` (`verified`|`corrupt`|`recovery-locked`), `StageState` (`staging`|`staged`|`committed`|`unreachable`), `MutationMetadata` (OperationId, aggregate version, commit state), `IntegrityFailure` (AD-9 typed envelope), `KeyValueStore`/`BlobStore` injectable ports, `Mutable<T>` helper. Discriminated unions; no `any`.
- `cli/src/core/checkpoints/artifactStore.ts` — `ArtifactStore` implementation: stages original bytes encrypted with AES-256-GCM (reuses `sessions/crypto.ts` pattern), collision-resistant 12-byte random nonce, authenticated metadata bound to store/entity/content class/schema/key version via AAD. Plaintext originals NEVER enter the backing store (asserted in tests). Injectable `BlobStore` port. Crash-before-commit leaves staged material detectable via `detectIncompleteStages()`/`reconcile()`. `read()` verifies digest, size, AAD binding; fails closed as `corrupt`/`recovery-locked`.
- `cli/src/core/checkpoints/checkpointRepository.ts` — `CheckpointRepository` implementation: owns checkpoint content references, mutation metadata, lineage references, coverage/retention/integrity state. `stage(...)` creates staging record; `commit(checkpointId, operationId)` atomically transitions to committed + indexes by operationId; `read(checkpointId)` with integrity verification (checkpointId match, mutation metadata present, artifactIds field present, integrityState verified); `detectIncompleteStages()`/`reconcile()` marks unreachable, preserves unknown operation state, never replays native effects; `findByOperationId(operationId)` for journal correlation. Injectable `KeyValueStore` port. Journal is the SOLE commit-visibility authority.
- `cli/src/core/checkpoints/integrity.ts` — `verifyCheckpointIntegrity`, `verifyArtifactIntegrity`, `readCheckpointWithArtifacts` (combined read fails closed on any artifact failure). Fails closed as `corrupt`/`recovery-locked` on any altered record/digest/operation-identity/metadata mismatch.
- `cli/src/core/artifacts/types.ts` — re-exports checkpoint types for the artifacts boundary.
- `cli/src/core/app.ts` — minimal wiring: `checkpoints(store?)` and `artifactStore(blobStore?, key?)` lazy-init accessors on `CoreApp`.
- `cli/test/checkpoints.test.ts` — 29 test cases across all 5 ACs + edge cases.

## Verify
- npm run build clean; npm test green (461 tests, 34 files).
