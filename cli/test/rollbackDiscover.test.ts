// Rollback discovery tests (Story 3.12, all 5 ACs). Uses in-memory
// KeyValueStore + injected clock. Covers: list/inspect shows all summary
// fields + coverage; excluded effects explicitly excluded/never-protected +
// no whole-round-reversible implication; incomplete/corrupt/expired/locked/
// unavailable-bytes hidden from apply-eligible but inspectable as recovery
// record with only safe actions; selection stages nothing (read-only);
// narrow/headless canonical order preserved + exact rollback tokens + no
// color-only meaning. >=20 cases. No network/real creds.

import { describe, expect, it } from 'vitest';
import { CheckpointRepository } from '../src/core/checkpoints/checkpointRepository.js';
import type { KeyValueStore, CheckpointRecord } from '../src/core/checkpoints/types.js';
import { asCheckpointId, asArtifactId } from '../src/core/checkpoints/types.js';
import { newOperationId, asPromptRoundId } from '../src/core/protocol/ids.js';
import {
  listCheckpoints,
  inspectCheckpoint,
  buildRollbackPreview,
} from '../src/core/rollback/discover.js';
import {
  renderCheckpointSummary,
  renderRollbackPreview,
  renderCheckpointList,
  renderRollbackListOutput,
  renderRollbackInspectOutput,
} from '../src/core/rollback/preview.js';
import type {
  CheckpointSummary,
  ExcludedEffects,
  RollbackPreview,
} from '../src/core/rollback/types.js';

// --- In-memory KeyValueStore (reuse from checkpoints.test.ts pattern) ---

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

// --- Helpers ---

function fixedClock(): () => string {
  let t = 0;
  return () => {
    t += 1;
    return `2026-07-17T00:00:00.${String(t).padStart(3, '0')}Z`;
  };
}

function makeSessionId(): string {
  return 'sess-test-session';
}

function storeExcludedEffects(store: KeyValueStore, checkpointId: string, effects: ExcludedEffects): void {
  store.put(`excluded:checkpoint:${checkpointId}`, JSON.stringify(effects));
}

function stageAndCommitCheckpoint(
  repo: CheckpointRepository,
  store: KeyValueStore,
  overrides: Partial<{
    artifactIds: readonly string[];
    parentCheckpointIds: readonly string[];
    coverageState: 'fully-protected' | 'partially-protected' | 'unprotected';
    retentionState: 'retained' | 'eligible-for-eviction' | 'evicted';
    integrityState: 'verified' | 'corrupt' | 'recovery-locked';
  }> = {},
): string {
  const opId = newOperationId();
  const result = repo.stage({
    operationId: opId,
    aggregateVersion: 1,
    artifactIds: overrides.artifactIds ?? [],
    parentCheckpointIds: overrides.parentCheckpointIds ?? [],
    coverageState: overrides.coverageState ?? 'fully-protected',
  });
  if (!result.ok) throw new Error('stage failed');
  const commitResult = repo.commit(result.checkpointId, opId);
  if (!commitResult.ok) throw new Error('commit failed');

  // Apply overrides that CheckpointRepository doesn't directly support.
  if (overrides.retentionState || overrides.integrityState) {
    const recordKey = `checkpoint:record:${result.checkpointId}`;
    const recordJson = store.get(recordKey);
    if (recordJson) {
      const record = JSON.parse(recordJson);
      if (overrides.retentionState) record.retentionState = overrides.retentionState;
      if (overrides.integrityState) record.integrityState = overrides.integrityState;
      store.put(recordKey, JSON.stringify(record));
    }
  }

  return result.checkpointId;
}

// --- Tests ---

describe('Rollback discovery (Story 3.12)', () => {
  // ==========================================================================
  // AC #1: /rollback list or /rollback inspect <id> shows all fields + coverage
  // ==========================================================================
  describe('AC #1: List and inspect show all summary fields + coverage', () => {
    it('listCheckpoints returns committed checkpoints with all summary fields', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const cpId = stageAndCommitCheckpoint(repo, store, {
        artifactIds: [asArtifactId('art-1'), asArtifactId('art-2')],
        coverageState: 'fully-protected',
      });

      // Register the checkpoint for this session.
      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify([cpId]));

      const result = listCheckpoints(sessionId, store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.checkpoints.length).toBe(1);
      const summary = result.checkpoints[0];
      expect(summary.checkpointId).toBe(cpId);
      expect(summary.promptRoundId).toBeTruthy();
      expect(summary.createdAt).toBeTruthy();
      expect(summary.observedAt).toBeTruthy();
      expect(typeof summary.subsequentPromptAgeMs).toBe('number');
      expect(summary.targetCount).toBe(2);
      expect(Array.isArray(summary.preDigests)).toBe(true);
      expect(Array.isArray(summary.postDigests)).toBe(true);
      expect(Array.isArray(summary.renameInfo)).toBe(true);
      expect(typeof summary.perCheckpointUsageBytes).toBe('number');
      expect(typeof summary.storeUsageBytes).toBe('number');
      expect(['encrypted', 'unencrypted']).toContain(summary.encryptionState);
      expect(['verified', 'corrupt', 'recovery-locked']).toContain(summary.integrityState);
      expect(['fully protected', 'partially protected', 'unprotected', 'expired', 'corrupt', 'locked']).toContain(summary.coverage);
    });

    it('inspectCheckpoint returns full preview with all fields', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store, {
        artifactIds: [asArtifactId('art-1')],
        coverageState: 'fully-protected',
      });

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      expect(preview.heading).toBe('ROLLBACK INSPECT');
      expect(preview.purpose).toBeTruthy();
      expect(preview.risk).toBeTruthy();
      expect(preview.target).toContain(cpId);
      expect(preview.authority).toBeTruthy();
      expect(preview.evidenceCompleteness).toBeTruthy();
      expect(preview.outcome).toBeTruthy();
      expect(preview.nextStep).toBeTruthy();
      expect(preview.rollbackTokens.length).toBeGreaterThan(0);
      expect(preview.summary).toBeTruthy();
      expect(preview.eligibility.kind).toBe('apply-eligible');
    });

    it('list shows coverage states: fully protected, partially protected, unprotected', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const cpIds: string[] = [];
      for (const cs of ['fully-protected', 'partially-protected', 'unprotected'] as const) {
        const id = stageAndCommitCheckpoint(repo, store, { coverageState: cs });
        cpIds.push(id);
      }
      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify(cpIds));

      const result = listCheckpoints(sessionId, store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const coverages = result.checkpoints.map((c) => c.coverage);
      expect(coverages).toContain('fully protected');
      expect(coverages).toContain('partially protected');
      expect(coverages).toContain('unprotected');
    });

    it('list shows coverage states: expired, corrupt, locked', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const cpIds: string[] = [];

      // Expired (evicted retention).
      const expiredId = stageAndCommitCheckpoint(repo, store, {
        coverageState: 'fully-protected',
        retentionState: 'evicted',
      });
      cpIds.push(expiredId);

      // Corrupt integrity.
      const corruptId = stageAndCommitCheckpoint(repo, store, {
        coverageState: 'fully-protected',
        integrityState: 'corrupt',
      });
      cpIds.push(corruptId);

      // Recovery-locked integrity.
      const lockedId = stageAndCommitCheckpoint(repo, store, {
        coverageState: 'fully-protected',
        integrityState: 'recovery-locked',
      });
      cpIds.push(lockedId);

      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify(cpIds));

      // With includeHidden: true, all should appear.
      const result = listCheckpoints(sessionId, store, clock, { includeHidden: true });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const coverages = result.checkpoints.map((c) => c.coverage);
      expect(coverages).toContain('expired');
      expect(coverages).toContain('corrupt');
      expect(coverages).toContain('locked');
    });

    it('inspect shows retention expiry when set', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store, {
        retentionState: 'eligible-for-eviction',
      });

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.preview.summary.retentionExpiry).toBeTruthy();
    });

    it('inspect shows indefinite retention when retained', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.preview.summary.retentionExpiry).toBeNull();
    });
  });

  // ==========================================================================
  // AC #2: Excluded effects explicitly excluded/never-protected + no whole-round
  //        reversible implication
  // ==========================================================================
  describe('AC #2: Excluded effects are explicitly excluded/never-protected (AD-19)', () => {
    it('excluded effects are listed with explicit excluded/never-protected status', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const cpId = stageAndCommitCheckpoint(repo, store);

      // Store excluded effects.
      const effects: ExcludedEffects = {
        shell: [{ target: '/bin/sh', reason: 'shell command', reasonCode: 'shell', status: 'excluded' }],
        remote: [{ target: 'api.example.com', reason: 'remote call', reasonCode: 'remote', status: 'excluded' }],
        permission: [{ target: 'chmod', reason: 'permission change', reasonCode: 'permission', status: 'never-protected' }],
        process: [{ target: 'subprocess', reason: 'child process', reasonCode: 'process', status: 'excluded' }],
        symlinkSide: [{ target: '/link', reason: 'symlink side effect', reasonCode: 'symlink', status: 'never-protected' }],
        external: [{ target: '/outside', reason: 'external tool', reasonCode: 'external', status: 'excluded' }],
        unknown: [{ target: 'mystery', reason: 'unknown effect', reasonCode: 'unknown', status: 'excluded' }],
      };
      storeExcludedEffects(store, cpId, effects);

      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify([cpId]));

      const result = listCheckpoints(sessionId, store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const summary = result.checkpoints[0];
      expect(summary.excludedEffects.shell.length).toBe(1);
      expect(summary.excludedEffects.shell[0].status).toBe('excluded');
      expect(summary.excludedEffects.remote.length).toBe(1);
      expect(summary.excludedEffects.permission.length).toBe(1);
      expect(summary.excludedEffects.permission[0].status).toBe('never-protected');
      expect(summary.excludedEffects.process.length).toBe(1);
      expect(summary.excludedEffects.symlinkSide.length).toBe(1);
      expect(summary.excludedEffects.symlinkSide[0].status).toBe('never-protected');
      expect(summary.excludedEffects.external.length).toBe(1);
      expect(summary.excludedEffects.unknown.length).toBe(1);
    });

    it('preview risk disclosure mentions excluded effects and AD-19', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);
      const effects: ExcludedEffects = {
        shell: [{ target: '/bin/sh', reason: 'shell command', reasonCode: 'shell', status: 'excluded' }],
        remote: [],
        permission: [],
        process: [],
        symlinkSide: [],
        external: [],
        unknown: [],
      };
      storeExcludedEffects(store, cpId, effects);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      // AD-19: excluded effects are NEVER claimed reversible.
      expect(preview.risk).toContain('excluded effect');
      expect(preview.risk).toContain('NEVER claimed reversible');
      expect(preview.risk).toContain('AD-19');
    });

    it('preview NEVER implies the whole Prompt Round is reversible', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      // The risk disclosure must mention that only built-in create/edit/delete
      // are covered, and shell/process/remote/permission/symlink-side/external
      // effects are NEVER claimed reversible.
      expect(preview.risk).toContain('Automatic rollback covers checkpointed built-in create/edit/delete ONLY');
      expect(preview.risk).toContain('Shell, process, remote, permission, symlink-side, and external effects are NEVER claimed reversible');
    });

    it('rendered summary shows excluded effects with status', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);
      const effects: ExcludedEffects = {
        shell: [{ target: '/bin/sh', reason: 'shell command', reasonCode: 'shell', status: 'excluded' }],
        remote: [],
        permission: [{ target: 'chmod', reason: 'permission change', reasonCode: 'permission', status: 'never-protected' }],
        process: [],
        symlinkSide: [],
        external: [],
        unknown: [],
      };
      storeExcludedEffects(store, cpId, effects);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const rendered = renderCheckpointSummary(result.preview.summary);
      expect(rendered).toContain('shell');
      expect(rendered).toContain('excluded');
      expect(rendered).toContain('permission');
      expect(rendered).toContain('never-protected');
      expect(rendered).toContain('NEVER claimed reversible');
    });
  });

  // ==========================================================================
  // AC #3: Incomplete/corrupt/expired/locked/unavailable-bytes hidden from
  //        apply-eligible but inspectable as recovery record
  // ==========================================================================
  describe('AC #3: Hidden from apply-eligible, inspectable as recovery record', () => {
    it('corrupt checkpoints are hidden from default list (apply-eligible)', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const goodId = stageAndCommitCheckpoint(repo, store, { coverageState: 'fully-protected' });
      const corruptId = stageAndCommitCheckpoint(repo, store, {
        coverageState: 'fully-protected',
        integrityState: 'corrupt',
      });

      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify([goodId, corruptId]));

      // Default list (includeHidden: false) should only show apply-eligible.
      const result = listCheckpoints(sessionId, store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.checkpoints.length).toBe(1);
      expect(result.checkpoints[0].checkpointId).toBe(goodId);
    });

    it('expired checkpoints are hidden from default list', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const goodId = stageAndCommitCheckpoint(repo, store);
      const expiredId = stageAndCommitCheckpoint(repo, store, {
        retentionState: 'evicted',
      });

      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify([goodId, expiredId]));

      const result = listCheckpoints(sessionId, store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.checkpoints.length).toBe(1);
      expect(result.checkpoints[0].checkpointId).toBe(goodId);
    });

    it('locked checkpoints are hidden from default list', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const goodId = stageAndCommitCheckpoint(repo, store);
      const lockedId = stageAndCommitCheckpoint(repo, store, {
        integrityState: 'recovery-locked',
      });

      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify([goodId, lockedId]));

      const result = listCheckpoints(sessionId, store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.checkpoints.length).toBe(1);
      expect(result.checkpoints[0].checkpointId).toBe(goodId);
    });

    it('corrupt checkpoints are inspectable as non-authoritative recovery record', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store, {
        integrityState: 'corrupt',
      });

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      expect(preview.eligibility.kind).toBe('non-authoritative-recovery-record');
      expect(preview.eligibility.reason).toContain('corrupt');
      expect(preview.nextStep).toContain('safe Evidence review, recovery, or exit');
      expect(preview.nextStep).not.toContain('rollback apply');
    });

    it('locked checkpoints are inspectable as non-authoritative recovery record', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store, {
        integrityState: 'recovery-locked',
      });

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      expect(preview.eligibility.kind).toBe('non-authoritative-recovery-record');
      expect(preview.eligibility.reason).toContain('recovery-locked');
    });

    it('expired checkpoints are inspectable as hidden record', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store, {
        retentionState: 'evicted',
      });

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      expect(preview.eligibility.kind).toBe('hidden');
      expect(preview.eligibility.reason).toContain('expired');
    });

    it('includeHidden: true shows all checkpoints including non-apply-eligible', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const goodId = stageAndCommitCheckpoint(repo, store);
      const corruptId = stageAndCommitCheckpoint(repo, store, {
        integrityState: 'corrupt',
      });

      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify([goodId, corruptId]));

      const result = listCheckpoints(sessionId, store, clock, { includeHidden: true });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.checkpoints.length).toBe(2);
    });

    it('non-authoritative recovery record offers only safe Evidence/recovery/exit actions', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store, {
        integrityState: 'corrupt',
      });

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      // Only safe actions: no rollback apply token.
      expect(preview.rollbackTokens).not.toContain(`rollback apply ${cpId}`);
      // Next step mentions safe actions only.
      expect(preview.nextStep).toContain('safe Evidence review, recovery, or exit');
    });
  });

  // ==========================================================================
  // AC #4: Selecting a checkpoint stages NOTHING — read-only preview
  // ==========================================================================
  describe('AC #4: Selection stages nothing — read-only preview', () => {
    it('inspectCheckpoint does not mutate the store', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);

      // Count keys before inspection.
      const keysBefore = store.list('').length;

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);

      // Count keys after inspection — should be unchanged.
      const keysAfter = store.list('').length;
      expect(keysAfter).toBe(keysBefore);
    });

    it('listCheckpoints does not mutate the store', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const cpId = stageAndCommitCheckpoint(repo, store);
      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify([cpId]));

      const keysBefore = store.list('').length;

      const result = listCheckpoints(sessionId, store, clock);
      expect(result.ok).toBe(true);

      const keysAfter = store.list('').length;
      expect(keysAfter).toBe(keysBefore);
    });

    it('preview next step says read-only and refers to future stories', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const preview = result.preview;
      expect(preview.nextStep).toContain('read-only');
      expect(preview.nextStep).toContain('no changes have been staged');
      expect(preview.nextStep).toContain('Story 3.13/3.14');
    });

    it('rendered preview body does not contain mutation or approval language', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const rendered = renderRollbackPreview(result.preview);
      // Should not contain language suggesting changes were made.
      expect(rendered).not.toContain('approved');
      expect(rendered).not.toContain('applied');
      expect(rendered).not.toContain('mutated');
    });
  });

  // ==========================================================================
  // AC #5: Narrow/redirected/headless preserves canonical order + exact rollback
  //        tokens + no color-only meaning
  // ==========================================================================
  describe('AC #5: Narrow/headless canonical order + exact tokens + no color-only meaning', () => {
    it('rendered preview preserves canonical order: heading, purpose, risk, target, authority, Evidence, outcome, next step', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const rendered = renderRollbackPreview(result.preview);
      const lines = rendered.split('\n').filter((l) => l.trim().length > 0);

      // Find the position of each canonical section.
      const headingIdx = lines.findIndex((l) => l === 'ROLLBACK INSPECT');
      const purposeIdx = lines.findIndex((l) => l.startsWith('Purpose:'));
      const riskIdx = lines.findIndex((l) => l.startsWith('Risk:'));
      const targetIdx = lines.findIndex((l) => l.startsWith('Target:'));
      const authorityIdx = lines.findIndex((l) => l.startsWith('Authority:'));
      const evidenceIdx = lines.findIndex((l) => l.startsWith('Evidence:'));
      const outcomeIdx = lines.findIndex((l) => l.startsWith('Outcome:'));
      const nextIdx = lines.findIndex((l) => l.startsWith('Next:'));

      expect(headingIdx).toBeGreaterThanOrEqual(0);
      expect(purposeIdx).toBeGreaterThan(headingIdx);
      expect(riskIdx).toBeGreaterThan(purposeIdx);
      expect(targetIdx).toBeGreaterThan(riskIdx);
      expect(authorityIdx).toBeGreaterThan(targetIdx);
      expect(evidenceIdx).toBeGreaterThan(authorityIdx);
      expect(outcomeIdx).toBeGreaterThan(evidenceIdx);
      expect(nextIdx).toBeGreaterThan(outcomeIdx);
    });

    it('rendered preview contains exact rollback tokens', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const rendered = renderRollbackPreview(result.preview);
      expect(rendered).toContain(`rollback inspect ${cpId}`);
      expect(rendered).toContain(`rollback apply ${cpId}`);
    });

    it('rendered preview has no color-only meaning (no ANSI escape codes)', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const rendered = renderRollbackPreview(result.preview);
      // No ANSI escape sequences.
      expect(rendered).not.toContain('\x1b[');
      // No color-only meaning — all information is conveyed in text.
    });

    it('renderRollbackListOutput produces CommandOutput with stdout/stderr/json', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const cpId = stageAndCommitCheckpoint(repo, store);
      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify([cpId]));

      const listResult = listCheckpoints(sessionId, store, clock);
      expect(listResult.ok).toBe(true);
      if (!listResult.ok) return;

      const output = renderRollbackListOutput(listResult.checkpoints);
      expect(output.stdout).toBeTruthy();
      expect(output.json).toBeTruthy();
      expect(output.exitCode).toBe(0);
      expect(output.stderr).toBe('');
    });

    it('renderRollbackInspectOutput produces CommandOutput with canonical fields', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const output = renderRollbackInspectOutput(result.preview);
      expect(output.stdout).toBeTruthy();
      expect(output.json).toContain('"status":"succeeded"');
      expect(output.exitCode).toBe(0);
    });

    it('renderCheckpointList shows all summary fields in text form', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const cpId = stageAndCommitCheckpoint(repo, store, {
        artifactIds: [asArtifactId('art-1')],
        coverageState: 'fully-protected',
      });
      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify([cpId]));

      const listResult = listCheckpoints(sessionId, store, clock);
      expect(listResult.ok).toBe(true);
      if (!listResult.ok) return;

      const rendered = renderCheckpointList(listResult.checkpoints);
      expect(rendered).toContain(cpId);
      expect(rendered).toContain('fully protected');
      expect(rendered).toContain('verified');
      expect(rendered).toContain('indefinite');
    });
  });

  // ==========================================================================
  // Edge cases and error handling
  // ==========================================================================
  describe('Edge cases and error handling', () => {
    it('listCheckpoints returns empty array when no checkpoints exist', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const sessionId = makeSessionId();

      const result = listCheckpoints(sessionId, store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.checkpoints).toEqual([]);
    });

    it('inspectCheckpoint returns failure for non-existent checkpoint', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();

      const result = inspectCheckpoint(asCheckpointId('nonexistent'), store, clock);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.category).toBe('checkpoint-not-found');
      }
    });

    it('inspectCheckpoint returns failure for unreadable checkpoint record', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();

      store.put('checkpoint:record:bad-cp', 'not-valid-json');

      const result = inspectCheckpoint(asCheckpointId('bad-cp'), store, clock);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.category).toBe('checkpoint-unreadable');
      }
    });

    it('listCheckpoints skips uncommitted (staging) checkpoints', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      // Stage but don't commit.
      const opId = newOperationId();
      const stageResult = repo.stage({
        operationId: opId,
        aggregateVersion: 1,
        artifactIds: [],
      });
      expect(stageResult.ok).toBe(true);
      if (!stageResult.ok) return;

      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify([stageResult.checkpointId]));

      const result = listCheckpoints(sessionId, store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.checkpoints).toEqual([]);
    });

    it('listCheckpoints respects maxCheckpoints option', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const cpIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = stageAndCommitCheckpoint(repo, store);
        cpIds.push(id);
      }
      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify(cpIds));

      const result = listCheckpoints(sessionId, store, clock, { maxCheckpoints: 3 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.checkpoints.length).toBeLessThanOrEqual(3);
    });

    it('checkpoints are sorted by createdAt descending (most recent first)', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);
      const sessionId = makeSessionId();

      const cpIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const id = stageAndCommitCheckpoint(repo, store);
        cpIds.push(id);
      }
      store.put(`session:checkpoint-list:${sessionId}`, JSON.stringify(cpIds));

      const result = listCheckpoints(sessionId, store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Most recent first (the clock increments, so later checkpoints have later timestamps).
      for (let i = 1; i < result.checkpoints.length; i++) {
        expect(result.checkpoints[i - 1].createdAt.localeCompare(result.checkpoints[i].createdAt)).toBeGreaterThanOrEqual(0);
      }
    });

    it('renderCheckpointSummary includes all fields', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store, {
        artifactIds: [asArtifactId('art-1')],
        coverageState: 'fully-protected',
      });

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const rendered = renderCheckpointSummary(result.preview.summary);
      expect(rendered).toContain('Checkpoint:');
      expect(rendered).toContain('Prompt Round:');
      expect(rendered).toContain('Created:');
      expect(rendered).toContain('Observed:');
      expect(rendered).toContain('Age:');
      expect(rendered).toContain('Targets:');
      expect(rendered).toContain('Coverage:');
      expect(rendered).toContain('Integrity:');
      expect(rendered).toContain('Encryption:');
      expect(rendered).toContain('Checkpoint usage:');
    });

    it('empty list renders a meaningful message', () => {
      const rendered = renderCheckpointList([]);
      expect(rendered).toContain('No checkpoints found');
    });

    it('buildRollbackPreview produces correct eligibility for apply-eligible', () => {
      const store = new InMemoryKeyValueStore();
      const clock = fixedClock();
      const repo = new CheckpointRepository(store, clock);

      const cpId = stageAndCommitCheckpoint(repo, store);

      const result = inspectCheckpoint(asCheckpointId(cpId), store, clock);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.preview.eligibility.kind).toBe('apply-eligible');
      expect(result.preview.rollbackTokens).toContain(`rollback apply ${cpId}`);
    });
  });
});
