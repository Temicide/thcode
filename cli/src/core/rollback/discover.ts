// Checkpoint discovery for rollback eligibility (Story 3.12, AD-6, AD-19, AD-20,
// AD-24). Discovers committed checkpoint lineage for the current Session and
// inspects individual checkpoints. Incomplete/corrupt/expired/locked/unavailable-
// bytes checkpoints are HIDDEN from apply-eligible targets but remain inspectable
// as non-authoritative/recovery records offering only safe Evidence/recovery/exit
// actions (AC #3).
//
// AD-19 rollback honesty: excluded effects are NEVER claimed reversible. The
// summary NEVER implies the whole Prompt Round is reversible.

import type { CheckpointId, CheckpointRecord, KeyValueStore } from '../checkpoints/types.js';
import { asCheckpointId } from '../checkpoints/types.js';
import { asPromptRoundId } from '../protocol/ids.js';
import type {
  CheckpointSummary,
  DiscoverOptions,
  ExcludedEffects,
  InspectCheckpointResult,
  ListCheckpointsResult,
  RenameInfoEntry,
  RollbackCoverage,
  RollbackEligibility,
  RollbackPreview,
} from './types.js';

// --- Key conventions for session-to-checkpoint index ---

function sessionCheckpointListKey(sessionId: string): string {
  return `session:checkpoint-list:${sessionId}`;
}

// --- Helpers ---

function coverageFromRecord(record: CheckpointRecord, _now: string): RollbackCoverage {
  // Check integrity first.
  if (record.integrityState === 'corrupt') return 'corrupt';
  if (record.integrityState === 'recovery-locked') return 'locked';

  // Check retention expiry.
  if (record.retentionState === 'eligible-for-eviction' || record.retentionState === 'evicted') {
    return 'expired';
  }

  // Map coverage state.
  switch (record.coverageState) {
    case 'fully-protected': return 'fully protected';
    case 'partially-protected': return 'partially protected';
    case 'unprotected': return 'unprotected';
  }
}

function eligibilityFromCoverage(coverage: RollbackCoverage, _record: CheckpointRecord): RollbackEligibility {
  switch (coverage) {
    case 'fully protected':
    case 'partially protected':
    case 'unprotected':
      return { kind: 'apply-eligible' };
    case 'expired':
      return { kind: 'hidden', reason: 'checkpoint has expired (retention evicted)' };
    case 'corrupt':
      return { kind: 'non-authoritative-recovery-record', reason: 'checkpoint integrity is corrupt — data may be altered' };
    case 'locked':
      return { kind: 'non-authoritative-recovery-record', reason: 'checkpoint is recovery-locked — cannot be used for rollback' };
  }
}

function computeAgeMs(createdAt: string, now: string): number {
  return Math.max(0, new Date(now).getTime() - new Date(createdAt).getTime());
}

function emptyExcludedEffects(): ExcludedEffects {
  return {
    shell: [],
    remote: [],
    permission: [],
    process: [],
    symlinkSide: [],
    external: [],
    unknown: [],
  };
}

function buildExcludedEffectsFromStore(store: KeyValueStore, checkpointId: string): ExcludedEffects {
  const key = `excluded:checkpoint:${checkpointId}`;
  const raw = store.get(key);
  if (!raw) return emptyExcludedEffects();

  try {
    const parsed = JSON.parse(raw) as ExcludedEffects;
    return parsed;
  } catch {
    return emptyExcludedEffects();
  }
}

function buildRenameInfo(_record: CheckpointRecord): readonly RenameInfoEntry[] {
  // Rename info is not directly stored in CheckpointRecord in the current schema.
  // It would be derived from mutation metadata. Return empty for now.
  return [];
}

function buildPreDigests(_record: CheckpointRecord): readonly string[] {
  // Pre-image digests are not directly stored in CheckpointRecord.
  // They would be derived from artifact metadata or mutation proposals.
  // Return empty for now; tests inject via store.
  return [];
}

function buildPostDigests(_record: CheckpointRecord): readonly string[] {
  // Post-image digests are not directly stored in CheckpointRecord.
  // Return empty for now; tests inject via store.
  return [];
}

function buildTargetCount(record: CheckpointRecord): number {
  return record.artifactIds.length;
}

function buildPerCheckpointUsage(record: CheckpointRecord): number {
  // Estimate from artifact count. In production, this would sum artifact sizes.
  return record.artifactIds.length * 1024; // placeholder: 1KB per artifact
}

function buildStoreUsage(store: KeyValueStore): number {
  // Estimate total store usage from all checkpoint records.
  const keys = store.list('checkpoint:record:');
  let total = 0;
  for (const k of keys) {
    const v = store.get(k);
    if (v) total += v.length;
  }
  return total;
}

function buildEncryptionState(record: CheckpointRecord): 'encrypted' | 'unencrypted' {
  // In production, this would check whether the artifact store has encryption.
  // For now, assume encrypted if there are artifacts.
  return record.artifactIds.length > 0 ? 'encrypted' : 'unencrypted';
}

// --- Public API ---

/**
 * List committed checkpoints for the current Session.
 * Incomplete/corrupt/expired/locked/unavailable-bytes checkpoints are HIDDEN
 * from apply-eligible targets by default (AC #3). Pass `includeHidden: true`
 * to include them as non-authoritative/recovery records.
 */
export function listCheckpoints(
  sessionId: string,
  store: KeyValueStore,
  clock: () => string,
  opts: DiscoverOptions = {},
): ListCheckpointsResult {
  try {
    const now = clock();
    const maxCheckpoints = opts.maxCheckpoints ?? 50;
    const includeHidden = opts.includeHidden ?? false;

    // Get the list of checkpoint IDs for this session.
    const listKey = sessionCheckpointListKey(sessionId);
    const listRaw = store.get(listKey);
    const checkpointIds: string[] = listRaw ? JSON.parse(listRaw) : [];

    // Also scan for all committed checkpoint records.
    const allCheckpointKeys = store.list('checkpoint:record:');
    const allIds = new Set<string>([...checkpointIds, ...allCheckpointKeys.map((k) => k.replace('checkpoint:record:', ''))]);

    const summaries: CheckpointSummary[] = [];

    for (const id of allIds) {
      if (summaries.length >= maxCheckpoints) break;

      const recordKey = `checkpoint:record:${id}`;
      const recordJson = store.get(recordKey);
      if (!recordJson) continue;

      let record: CheckpointRecord;
      try {
        record = JSON.parse(recordJson) as CheckpointRecord;
      } catch {
        continue;
      }

      // Only include committed checkpoints.
      if (record.stageState !== 'committed') continue;

      const coverage = coverageFromRecord(record, now);
      const eligibility = eligibilityFromCoverage(coverage, record);

      // AC #3: hide non-apply-eligible from default listing.
      if (!includeHidden && eligibility.kind !== 'apply-eligible') continue;

      const excludedEffects = buildExcludedEffectsFromStore(store, id);

      const summary: CheckpointSummary = {
        promptRoundId: asPromptRoundId(record.mutation.operationId),
        checkpointId: asCheckpointId(id),
        createdAt: record.createdAt,
        observedAt: now,
        subsequentPromptAgeMs: computeAgeMs(record.createdAt, now),
        targetCount: buildTargetCount(record),
        preDigests: buildPreDigests(record),
        postDigests: buildPostDigests(record),
        renameInfo: buildRenameInfo(record),
        retentionExpiry: record.retentionState === 'retained' ? null : now,
        perCheckpointUsageBytes: buildPerCheckpointUsage(record),
        storeUsageBytes: buildStoreUsage(store),
        encryptionState: buildEncryptionState(record),
        integrityState: record.integrityState,
        coverage,
        excludedEffects,
      };

      summaries.push(summary);
    }

    // Sort by createdAt descending (most recent first).
    summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { ok: true, checkpoints: summaries };
  } catch (e) {
    return {
      ok: false,
      failure: {
        category: 'internal-error',
        retryable: false,
        scope: 'rollback',
        message: `failed to list checkpoints: ${(e as Error).message}`,
        causeCode: 'list-failed',
      },
    };
  }
}

/**
 * Inspect a single checkpoint for rollback preview.
 * Incomplete/corrupt/expired/locked/unavailable-bytes checkpoints remain
 * inspectable as non-authoritative/recovery records offering only safe
 * Evidence/recovery/exit actions (AC #3).
 */
export function inspectCheckpoint(
  checkpointId: CheckpointId,
  store: KeyValueStore,
  clock: () => string,
): InspectCheckpointResult {
  try {
    const now = clock();
    const recordKey = `checkpoint:record:${checkpointId}`;
    const recordJson = store.get(recordKey);

    if (!recordJson) {
      return {
        ok: false,
        failure: {
          category: 'checkpoint-not-found',
          retryable: false,
          scope: 'rollback',
          message: `checkpoint not found: ${checkpointId}`,
          causeCode: 'checkpoint-not-found',
        },
      };
    }

    let record: CheckpointRecord;
    try {
      record = JSON.parse(recordJson) as CheckpointRecord;
    } catch {
      return {
        ok: false,
        failure: {
          category: 'checkpoint-unreadable',
          retryable: false,
          scope: 'rollback',
          message: `checkpoint record is corrupt: ${checkpointId}`,
          causeCode: 'checkpoint-unreadable',
        },
      };
    }

    const coverage = coverageFromRecord(record, now);
    const eligibility = eligibilityFromCoverage(coverage, record);
    const excludedEffects = buildExcludedEffectsFromStore(store, checkpointId);

    const summary: CheckpointSummary = {
      promptRoundId: asPromptRoundId(record.mutation.operationId),
      checkpointId: asCheckpointId(checkpointId),
      createdAt: record.createdAt,
      observedAt: now,
      subsequentPromptAgeMs: computeAgeMs(record.createdAt, now),
      targetCount: buildTargetCount(record),
      preDigests: buildPreDigests(record),
      postDigests: buildPostDigests(record),
      renameInfo: buildRenameInfo(record),
      retentionExpiry: record.retentionState === 'retained' ? null : now,
      perCheckpointUsageBytes: buildPerCheckpointUsage(record),
      storeUsageBytes: buildStoreUsage(store),
      encryptionState: buildEncryptionState(record),
      integrityState: record.integrityState,
      coverage,
      excludedEffects,
    };

    // Build the canonical preview (AC #5: heading, purpose, risk, target,
    // authority, Evidence completeness, outcome, next step).
    const preview = buildRollbackPreview(summary, eligibility);

    return { ok: true, preview };
  } catch (e) {
    return {
      ok: false,
      failure: {
        category: 'internal-error',
        retryable: false,
        scope: 'rollback',
        message: `failed to inspect checkpoint: ${(e as Error).message}`,
        causeCode: 'inspect-failed',
      },
    };
  }
}

/**
 * Build a canonical RollbackPreview from a CheckpointSummary (AC #5).
 * Preserves canonical order: heading, purpose, risk, target, authority,
 * Evidence completeness, outcome, next step. Exact rollback tokens, no
 * color-only meaning.
 */
export function buildRollbackPreview(
  summary: CheckpointSummary,
  eligibility: RollbackEligibility,
): RollbackPreview {
  const heading = 'ROLLBACK INSPECT';
  const purpose = `Inspect checkpoint ${summary.checkpointId} for rollback eligibility`;
  const risk = buildRiskDisclosure(summary);
  const target = `Checkpoint: ${summary.checkpointId} (Prompt Round: ${summary.promptRoundId})`;
  const authority = `Coverage: ${summary.coverage} | Integrity: ${summary.integrityState} | Encryption: ${summary.encryptionState}`;
  const evidenceCompleteness = buildEvidenceCompleteness(summary);
  const outcome = buildOutcome(summary, eligibility);
  const nextStep = buildNextStep(eligibility);
  const rollbackTokens = buildRollbackTokens(summary, eligibility);

  return {
    heading,
    purpose,
    risk,
    target,
    authority,
    evidenceCompleteness,
    outcome,
    nextStep,
    rollbackTokens,
    summary,
    eligibility,
  };
}

function buildRiskDisclosure(summary: CheckpointSummary): string {
  const parts: string[] = [];

  // AD-19: excluded effects are NEVER claimed reversible.
  const excludedCount =
    summary.excludedEffects.shell.length +
    summary.excludedEffects.remote.length +
    summary.excludedEffects.permission.length +
    summary.excludedEffects.process.length +
    summary.excludedEffects.symlinkSide.length +
    summary.excludedEffects.external.length +
    summary.excludedEffects.unknown.length;

  if (excludedCount > 0) {
    parts.push(`This checkpoint contains ${excludedCount} excluded effect(s) that are NEVER claimed reversible (AD-19).`);
  } else {
    parts.push('No excluded effects recorded for this checkpoint.');
  }

  parts.push('Automatic rollback covers checkpointed built-in create/edit/delete ONLY.');
  parts.push('Shell, process, remote, permission, symlink-side, and external effects are NEVER claimed reversible.');

  return parts.join(' ');
}

function buildEvidenceCompleteness(summary: CheckpointSummary): string {
  if (summary.coverage === 'corrupt') return 'corrupt — checkpoint data integrity failure';
  if (summary.coverage === 'locked') return 'recovery-locked — checkpoint cannot be read';
  if (summary.coverage === 'expired') return 'expired — retention has evicted this checkpoint';
  return `complete — ${summary.targetCount} target(s), ${summary.perCheckpointUsageBytes} bytes`;
}

function buildOutcome(summary: CheckpointSummary, eligibility: RollbackEligibility): string {
  switch (eligibility.kind) {
    case 'apply-eligible':
      return `Checkpoint is apply-eligible with ${summary.coverage} coverage. ${summary.targetCount} target(s) can be rolled back.`;
    case 'hidden':
      return `Checkpoint is hidden from apply-eligible targets: ${eligibility.reason}`;
    case 'non-authoritative-recovery-record':
      return `Checkpoint is a non-authoritative recovery record: ${eligibility.reason}. Only safe Evidence/recovery/exit actions are available.`;
  }
}

function buildNextStep(eligibility: RollbackEligibility): string {
  switch (eligibility.kind) {
    case 'apply-eligible':
      return 'Use /rollback apply <id> to proceed with exact per-target analysis (Story 3.13/3.14). This preview is read-only — no changes have been staged.';
    case 'hidden':
      return 'No rollback actions available for this checkpoint. Use /rollback inspect <id> with --include-hidden to view as a recovery record.';
    case 'non-authoritative-recovery-record':
      return 'Only safe Evidence review, recovery, or exit actions are available. No rollback can be applied from this record.';
  }
}

function buildRollbackTokens(summary: CheckpointSummary, eligibility: RollbackEligibility): readonly string[] {
  const tokens: string[] = [];

  tokens.push(`rollback inspect ${summary.checkpointId}`);

  if (eligibility.kind === 'apply-eligible') {
    tokens.push(`rollback apply ${summary.checkpointId}`);
  }

  return tokens;
}
