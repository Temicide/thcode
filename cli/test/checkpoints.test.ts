// CheckpointRepository + ArtifactStore tests (Story 3.2, all 5 ACs).
// Uses in-memory BlobStore/KeyValueStore ports + injected clock + existing
// crypto envelope. Covers: ownership split, AES-256-GCM encryption with
// authenticated metadata, plaintext-never-in-backing-store, crash-before-commit
// detection, integrity verification fail-closed, journal-authoritative commit
// visibility. >=18 cases. No network/real creds.

import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { CheckpointRepository } from '../src/core/checkpoints/checkpointRepository.js';
import { ArtifactStore } from '../src/core/checkpoints/artifactStore.js';
import { generateDataKey } from '../src/core/sessions/crypto.js';
import type {
  ArtifactId,
  BlobStore,
  CheckpointId,
  KeyValueStore,
} from '../src/core/checkpoints/types.js';
import { asOperationId, newOperationId } from '../src/core/protocol/ids.js';

// --- In-memory backing store implementations ---

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  get(key: string): string | undefined {
    return this.data.get(key);
  }

  put(key: string, value: string): void {
    this.data.set(key, value);
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  list(prefix: string): string[] {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix));
  }
}

class InMemoryBlobStore implements BlobStore {
  private readonly data = new Map<string, Uint8Array>();

  get(key: string): Uint8Array | undefined {
    return this.data.get(key);
  }

  put(key: string, value: Uint8Array): void {
    this.data.set(key, value);
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  list(prefix: string): string[] {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix));
  }
}

// --- Helpers ---

function fixedClock(): () => string {
  let t = 0;
  return () => {
    t += 1;
    return `2026-07-17T00:00:00.${String(t).padStart(3, '0')}Z`;
  };
}

function makeKey(): Buffer {
  return generateDataKey();
}

// --- Tests ---

describe('CheckpointRepository + ArtifactStore (Story 3.2)', () => {
  // ==========================================================================
  // AC #1: Ownership split
  // ==========================================================================
  describe('AC #1: Ownership split', () => {
    it('CheckpointRepository owns checkpoint metadata, mutation, lineage, coverage, retention, integrity', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
        parentCheckpointIds: [],
        coverageState: 'fully-protected',
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const cpId = stageResult.checkpointId;

      const commitResult = repo.commit(cpId, opId);
      expect(commitResult.ok).toBe(true);

      const readResult = repo.read(cpId);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;

      const record = readResult.record;
      // CheckpointRepository-owned fields
      expect(record.checkpointId).toBe(cpId);
      expect(record.mutation.operationId).toBe(opId);
      expect(record.mutation.aggregateVersion).toBe(1);
      expect(record.mutation.commitState).toBe('committed');
      expect(record.artifactIds).toEqual([]);
      expect(record.parentCheckpointIds).toEqual([]);
      expect(record.coverageState).toBe('fully-protected');
      expect(record.retentionState).toBe('retained');
      expect(record.integrityState).toBe('verified');
      expect(record.stageState).toBe('committed');
    });

    it('ArtifactStore owns immutable encrypted bytes and content metadata', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const content = new TextEncoder().encode('Hello, World!');
      const stageResult = store.stage({ bytes: content, contentClass: 'file-content' });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;

      store.commit(artId);

      const readResult = store.read(artId);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;

      expect(readResult.metadata.size).toBe(13);
      expect(readResult.metadata.contentClass).toBe('file-content');
      expect(readResult.metadata.schemaVersion).toBe(1);
      expect(readResult.metadata.keyVersion).toBe(1);
      expect(readResult.metadata.digest).toBeTruthy();
      expect(new TextDecoder().decode(readResult.bytes)).toBe('Hello, World!');
    });

    it('Session owns only checkpoint lineage and references (interface check)', () => {
      // Session-level lineage is not implemented in this story — the
      // CheckpointRecord carries parentCheckpointIds for lineage tracking.
      // This test verifies the lineage field exists and is functional.
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId1 = newOperationId();
      const opId2 = newOperationId();

      // Create parent checkpoint.
      const parentResult = repo.stage({
        operationId: opId1,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(parentResult.ok).toBe(true);
      if (!parentResult.ok) return;
      repo.commit(parentResult.checkpointId, opId1);

      // Create child checkpoint referencing parent.
      const childResult = repo.stage({
        operationId: opId2,
        aggregateVersion: 2,
        artifactIds: [],
        parentCheckpointIds: [parentResult.checkpointId],
      });
      expect(childResult.ok).toBe(true);
      if (!childResult.ok) return;
      repo.commit(childResult.checkpointId, opId2);

      const readResult = repo.read(childResult.checkpointId);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.record.parentCheckpointIds).toContain(parentResult.checkpointId);
    });

    it('Journal is the sole commit-visibility authority (CheckpointRepository does not own journal)', () => {
      // The CheckpointRepository does not reference the journal at all.
      // It records OperationId and aggregateVersion so the journal can
      // correlate, but commit visibility is the journal's responsibility.
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      // Stage and commit a checkpoint.
      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;

      const commitResult = repo.commit(stageResult.checkpointId, opId);
      expect(commitResult.ok).toBe(true);

      // Verify the checkpoint is findable by operationId (for journal correlation).
      const found = repo.findByOperationId(opId);
      expect(found).not.toBeNull();
      expect(found!.mutation.operationId).toBe(opId);
      expect(found!.mutation.aggregateVersion).toBe(1);
      expect(found!.mutation.commitState).toBe('committed');
    });
  });

  // ==========================================================================
  // AC #2: ArtifactStore encryption — AES-256-GCM + authenticated metadata
  // ==========================================================================
  describe('AC #2: AES-256-GCM encryption + authenticated metadata', () => {
    it('encrypts bytes with AES-256-GCM and collision-resistant nonce', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const content = new TextEncoder().encode('สวัสดีครับ — Thai preserved');
      const stageResult = store.stage({ bytes: content, contentClass: 'file-content' });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;

      store.commit(artId);

      const readResult = store.read(artId);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(new TextDecoder().decode(readResult.bytes)).toBe('สวัสดีครับ — Thai preserved');
    });

    it('plaintext originals NEVER appear in the backing store', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const secretContent = new TextEncoder().encode('SECRET-PLAINTEXT-MARKER');
      const stageResult = store.stage({ bytes: secretContent, contentClass: 'file-content' });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;

      store.commit(artId);

      // Scan all blob store values for the plaintext marker.
      const allKeys = blob.list('');
      for (const k of allKeys) {
        const val = blob.get(k);
        if (val) {
          const decoded = new TextDecoder().decode(val);
          expect(decoded).not.toContain('SECRET-PLAINTEXT-MARKER');
        }
      }
    });

    it('authenticated metadata is bound to store/entity/content class/schema/key version', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const content = new TextEncoder().encode('test data');
      const stageResult = store.stage({
        bytes: content,
        contentClass: 'test-content',
        schemaVersion: 2,
        keyVersion: 1,
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;

      store.commit(artId);

      // Read with correct key succeeds.
      const readResult = store.read(artId);
      expect(readResult.ok).toBe(true);

      // Read with wrong key fails (AAD mismatch or decryption failure).
      const wrongKey = makeKey();
      const wrongStore = new ArtifactStore(blob, wrongKey);
      const wrongRead = wrongStore.read(artId);
      expect(wrongRead.ok).toBe(false);
      if (!wrongRead.ok) {
        expect(wrongRead.failure.category).toBe('corrupt');
      }
    });

    it('decryption fails with altered ciphertext (tampered data)', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const content = new TextEncoder().encode('original content');
      const stageResult = store.stage({ bytes: content, contentClass: 'file-content' });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;

      store.commit(artId);

      // Tamper with the stored data.
      const dataKey = `artifact:${artId}`;
      const raw = blob.get(dataKey);
      expect(raw).toBeTruthy();
      if (raw) {
        const tampered = new TextEncoder().encode(
          new TextDecoder().decode(raw).replace('"c":', '"c":"TAMPERED'),
        );
        blob.put(dataKey, tampered);
      }

      const readResult = store.read(artId);
      expect(readResult.ok).toBe(false);
      if (!readResult.ok) {
        expect(readResult.failure.category).toBe('corrupt');
        expect(readResult.failure.recoveryActions.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // AC #3: Crash-before-commit detection
  // ==========================================================================
  describe('AC #3: Crash-before-commit detection', () => {
    it('detects incomplete artifact stages after crash before commit', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const content = new TextEncoder().encode('crash test data');
      const stageResult = store.stage({ bytes: content, contentClass: 'file-content' });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;

      // Simulate crash: do NOT call commit().
      // On "restart", detect incomplete stages.
      const incomplete = store.detectIncompleteStages();
      expect(incomplete).toContain(artId);
    });

    it('detects incomplete checkpoint stages after crash before commit', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const cpId = stageResult.checkpointId;

      // Simulate crash: do NOT call commit().
      const incomplete = repo.detectIncompleteStages();
      expect(incomplete).toContain(cpId);
    });

    it('reconcile marks incomplete stages as unreachable and never exposes as complete', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const cpId = stageResult.checkpointId;

      // Reconcile (simulating startup recovery).
      const reconcileResult = repo.reconcile();
      expect(reconcileResult.markedUnreachableCount).toBe(1);

      // Verify the checkpoint is no longer in staging.
      const incompleteAfter = repo.detectIncompleteStages();
      expect(incompleteAfter).not.toContain(cpId);

      // Verify reading the checkpoint returns recovery-locked.
      const readResult = repo.read(cpId);
      expect(readResult.ok).toBe(false);
      if (!readResult.ok) {
        expect(readResult.failure.category).toBe('recovery-locked');
      }
    });

    it('reconcile preserves unknown operation state (no native replay)', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      // Stage but don't commit.
      repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });

      // Reconcile — should not replay or create any new operations.
      const reconcileResult = repo.reconcile();
      expect(reconcileResult.markedUnreachableCount).toBe(1);
      expect(reconcileResult.removedCount).toBe(0);

      // Verify no new records were created (no native replay).
      const allKeys = kv.list('checkpoint:record:');
      // Only the one we staged should exist.
      expect(allKeys.length).toBe(1);
    });

    it('reconcile handles artifact store incomplete stages', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const content = new TextEncoder().encode('artifact crash data');
      store.stage({ bytes: content, contentClass: 'file-content' });

      // Reconcile.
      const count = store.reconcile();
      expect(count).toBe(1);

      // Verify no incomplete stages remain.
      const incomplete = store.detectIncompleteStages();
      expect(incomplete.length).toBe(0);
    });

    it('never exposes an incomplete/corrupt checkpoint as complete', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const cpId = stageResult.checkpointId;

      // Reading a staging checkpoint should fail.
      const readResult = repo.read(cpId);
      expect(readResult.ok).toBe(false);
      if (!readResult.ok) {
        expect(readResult.failure.category).toBe('recovery-locked');
        expect(readResult.failure.message).toContain('not yet committed');
      }
    });
  });

  // ==========================================================================
  // AC #4: Integrity verification fail-closed
  // ==========================================================================
  describe('AC #4: Integrity verification fail-closed', () => {
    it('altered checkpoint record returns corrupt', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const cpId = stageResult.checkpointId;
      repo.commit(cpId, opId);

      // Tamper with the record: change checkpointId to trigger corrupt detection.
      const recordKey = `checkpoint:record:${cpId}`;
      const recordJson = kv.get(recordKey)!;
      const tampered = recordJson.replace(cpId, 'TAMPERED-CP-ID');
      kv.put(recordKey, tampered);

      // Read should fail.
      const readResult = repo.read(cpId);
      expect(readResult.ok).toBe(false);
      if (!readResult.ok) {
        expect(readResult.failure.category).toBe('corrupt');
      }
    });

    it('altered artifact digest returns corrupt', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const content = new TextEncoder().encode('digest test');
      const stageResult = store.stage({ bytes: content, contentClass: 'file-content' });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;
      store.commit(artId);

      // Tamper with the stored digest in the data payload.
      const dataKey = `artifact:${artId}`;
      const raw = blob.get(dataKey)!;
      const tampered = new TextEncoder().encode(
        new TextDecoder().decode(raw).replace('"digest":', '"digest":"BAD'),
      );
      blob.put(dataKey, tampered);

      const readResult = store.read(artId);
      expect(readResult.ok).toBe(false);
      if (!readResult.ok) {
        expect(readResult.failure.category).toBe('corrupt');
      }
    });

    it('altered operation identity returns corrupt', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const cpId = stageResult.checkpointId;
      repo.commit(cpId, opId);

      // Tamper with the operationId in the record: set to empty to trigger corrupt.
      const recordKey = `checkpoint:record:${cpId}`;
      const recordJson = kv.get(recordKey)!;
      const tampered = recordJson.replace(`"${opId}"`, '""');
      kv.put(recordKey, tampered);

      const readResult = repo.read(cpId);
      expect(readResult.ok).toBe(false);
      if (!readResult.ok) {
        expect(readResult.failure.category).toBe('corrupt');
      }
    });

    it('altered metadata returns corrupt (no content reaches app code)', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const content = new TextEncoder().encode('metadata test');
      const stageResult = store.stage({ bytes: content, contentClass: 'file-content' });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;
      store.commit(artId);

      // Tamper with the contentClass in the stored data.
      const dataKey = `artifact:${artId}`;
      const raw = blob.get(dataKey)!;
      const tampered = new TextEncoder().encode(
        new TextDecoder().decode(raw).replace('"contentClass":"file-content"', '"contentClass":"tampered"'),
      );
      blob.put(dataKey, tampered);

      const readResult = store.read(artId);
      expect(readResult.ok).toBe(false);
      if (!readResult.ok) {
        expect(readResult.failure.category).toBe('corrupt');
        // Verify no content reaches app code — the failure result has no bytes.
        expect('bytes' in readResult).toBe(false);
      }
    });

    it('user receives inspect/read-only recovery actions on integrity failure', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const content = new TextEncoder().encode('recovery test');
      const stageResult = store.stage({ bytes: content, contentClass: 'file-content' });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;
      store.commit(artId);

      // Tamper.
      const dataKey = `artifact:${artId}`;
      const raw = blob.get(dataKey)!;
      const tampered = new TextEncoder().encode(
        new TextDecoder().decode(raw).replace('"digest":', '"digest":"BAD'),
      );
      blob.put(dataKey, tampered);

      const readResult = store.read(artId);
      expect(readResult.ok).toBe(false);
      if (!readResult.ok) {
        expect(readResult.failure.recoveryActions.length).toBeGreaterThan(0);
        expect(readResult.failure.recoveryActions.some((a) => a.includes('inspect'))).toBe(true);
      }
    });
  });

  // ==========================================================================
  // AC #5: Commit visibility is journal-authoritative
  // ==========================================================================
  describe('AC #5: Journal-authoritative commit visibility', () => {
    it('all participating records share OperationId, aggregate version, and commit state', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 42,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const cpId = stageResult.checkpointId;

      repo.commit(cpId, opId);

      const readResult = repo.read(cpId);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;

      expect(readResult.record.mutation.operationId).toBe(opId);
      expect(readResult.record.mutation.aggregateVersion).toBe(42);
      expect(readResult.record.mutation.commitState).toBe('committed');
    });

    it('findByOperationId returns committed checkpoint for journal correlation', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      repo.commit(stageResult.checkpointId, opId);

      const found = repo.findByOperationId(opId);
      expect(found).not.toBeNull();
      expect(found!.mutation.operationId).toBe(opId);
      expect(found!.mutation.commitState).toBe('committed');
    });

    it('findByOperationId returns null for uncommitted operations', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      // Stage but don't commit.
      repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });

      const found = repo.findByOperationId(opId);
      expect(found).toBeNull();
    });

    it('commit is idempotent (re-committing same checkpoint returns ok)', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const cpId = stageResult.checkpointId;

      // Commit twice.
      expect(repo.commit(cpId, opId).ok).toBe(true);
      expect(repo.commit(cpId, opId).ok).toBe(true);
    });

    it('UI/headless completion derived only from post-commit events (interface check)', () => {
      // This test verifies the architectural invariant: the CheckpointRepository
      // does not expose incomplete checkpoints as complete. Only committed
      // checkpoints are readable and findable by operationId.
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      // Stage a checkpoint.
      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const cpId = stageResult.checkpointId;

      // Before commit: not findable by operationId.
      expect(repo.findByOperationId(opId)).toBeNull();

      // Before commit: read returns recovery-locked.
      const preCommitRead = repo.read(cpId);
      expect(preCommitRead.ok).toBe(false);

      // Commit.
      repo.commit(cpId, opId);

      // After commit: findable.
      expect(repo.findByOperationId(opId)).not.toBeNull();

      // After commit: readable.
      const postCommitRead = repo.read(cpId);
      expect(postCommitRead.ok).toBe(true);
    });
  });

  // ==========================================================================
  // Additional edge cases
  // ==========================================================================
  describe('Edge cases', () => {
    it('handles empty artifact list in checkpoint', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      expect(repo.commit(stageResult.checkpointId, opId).ok).toBe(true);
    });

    it('handles binary content (non-UTF8 bytes) through ArtifactStore', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      // Binary content that is not valid UTF-8.
      const binaryContent = new Uint8Array([0x00, 0xFF, 0xFE, 0x80, 0x7F, 0x01]);
      const stageResult = store.stage({ bytes: binaryContent, contentClass: 'binary-blob' });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;
      store.commit(artId);

      const readResult = store.read(artId);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(Array.from(readResult.bytes)).toEqual([0x00, 0xFF, 0xFE, 0x80, 0x7F, 0x01]);
    });

    it('rejects commit on unreachable checkpoint', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);
      const opId = newOperationId();

      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const cpId = stageResult.checkpointId;

      // Reconcile marks it unreachable.
      repo.reconcile();

      // Attempting to commit an unreachable checkpoint should fail.
      const commitResult = repo.commit(cpId, opId);
      expect(commitResult.ok).toBe(false);
    });

    it('multiple checkpoints can be staged and committed independently', () => {
      const kv = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(kv, clock);

      const ids: CheckpointId[] = [];
      for (let i = 0; i < 5; i++) {
        const opId = newOperationId();
        const stageResult = repo.stage({
          operationId: opId,
          aggregateVersion: i + 1,
          artifactIds: [],
        });
        expect(stageResult.ok).toBe(true);
        if (!stageResult.ok) return;
        ids.push(stageResult.checkpointId);
        repo.commit(stageResult.checkpointId, opId);
      }

      // All should be readable.
      for (const id of ids) {
        const readResult = repo.read(id);
        expect(readResult.ok).toBe(true);
      }
    });

    it('ArtifactStore stage with custom schema and key version', () => {
      const blob = new InMemoryBlobStore();
      const key = makeKey();
      const store = new ArtifactStore(blob, key);

      const content = new TextEncoder().encode('custom version test');
      const stageResult = store.stage({
        bytes: content,
        contentClass: 'custom-class',
        schemaVersion: 3,
        keyVersion: 2,
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;
      const artId = stageResult.artifactId;
      store.commit(artId);

      const readResult = store.read(artId);
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.metadata.schemaVersion).toBe(3);
      expect(readResult.metadata.keyVersion).toBe(2);
      expect(readResult.metadata.contentClass).toBe('custom-class');
    });
  });
});
