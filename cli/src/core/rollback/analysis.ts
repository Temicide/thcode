// Three-way rollback target analysis (Story 3.13, AD-6, AD-19, AD-20, AD-24,
// AD-28). Compares recorded pre-image, recorded agent post-image/patch, and
// current content/deletion state for each rollback target. Pure/injectable:
// an AnalysisFsProbe + CheckpointRepository + ArtifactStore + clock. No
// `new Date()` in domain. AD-9 failures. UTF-8/Thai preserved. No raw bytes
// in any output (AD-24).
//
// AD-19 rollback honesty: automatic rollback covers checkpointed built-in
// create/edit/delete ONLY. Shell, process, remote, permission, symlink-side,
// and external effects are NEVER claimed reversible.

import { createHash } from 'node:crypto';
import type { CheckpointRecord } from '../checkpoints/types.js';
import type {
  AnalysisContext,
  AnalysisFailure,
  AnalysisOutcome,
  AnalyzeRollbackResult,
  InverseOperation,
  RollbackAnalysis,
  RollbackTarget,
  SafeChoice,
  TargetAnalysis,
  ThreeWayState,
} from './types.js';

// --- Helpers ---

function computeDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeConflictChoices(): readonly SafeChoice[] {
  return [
    { kind: 'skip-target' },
    { kind: 'export-sanitized-patch' },
    { kind: 'user-authored-resolution' },
  ];
}

// --- Three-way state builders ---

function preImageState(target: RollbackTarget): ThreeWayState {
  if (target.preImageDigest === null) return { kind: 'absent' };
  return { kind: 'present', digest: target.preImageDigest, version: null };
}

function postImageState(target: RollbackTarget): ThreeWayState {
  if (target.postImageDigest === null) return { kind: 'absent' };
  return { kind: 'present', digest: target.postImageDigest, version: null };
}

function currentStateFromFs(target: RollbackTarget, ctx: AnalysisContext): ThreeWayState {
  try {
    const bytes = ctx.fsProbe.readFile(target.canonicalPath);
    const digest = computeDigest(bytes);
    const statResult = ctx.fsProbe.stat(target.canonicalPath);
    const version = String(statResult.size);
    return { kind: 'present', digest, version };
  } catch {
    return { kind: 'absent' };
  }
}

// --- Identity resolution ---

interface ResolvedIdentity {
  readonly canonicalPath: string;
  readonly displayPath: string;
  readonly identityChanged: boolean;
  readonly isSymlink: boolean;
}

function resolveCurrentIdentity(target: RollbackTarget, ctx: AnalysisContext): ResolvedIdentity {
  try {
    const lstatResult = ctx.fsProbe.lstat(target.canonicalPath);
    if (lstatResult.isSymbolicLink) {
      // Target is behind a symlink — identity is changed.
      const realPath = ctx.fsProbe.realpath(target.canonicalPath);
      return {
        canonicalPath: realPath,
        displayPath: realPath,
        identityChanged: realPath !== target.canonicalPath,
        isSymlink: true,
      };
    }
    const realPath = ctx.fsProbe.realpath(target.canonicalPath);
    return {
      canonicalPath: realPath,
      displayPath: realPath,
      identityChanged: realPath !== target.canonicalPath,
      isSymlink: false,
    };
  } catch {
    // File doesn't exist or can't be resolved.
    return {
      canonicalPath: target.canonicalPath,
      displayPath: target.displayPath,
      identityChanged: false,
      isSymlink: false,
    };
  }
}

// --- Accessibility checks ---

type AccessibilityResult =
  | { readonly kind: 'accessible' }
  | { readonly kind: 'inaccessible'; readonly reason: string; readonly causeCode: string }
  | { readonly kind: 'unknown-outcome'; readonly reason: string }
  | { readonly kind: 'behind-symlink'; readonly reason: string };

function checkAccessibility(
  target: RollbackTarget,
  identity: ResolvedIdentity,
  ctx: AnalysisContext,
): AccessibilityResult {
  // Check for symlink first.
  if (identity.isSymlink) {
    return {
      kind: 'behind-symlink',
      reason: 'target is behind a symlink — rollback would follow the symlink, not the original path',
    };
  }

  // Check accessibility.
  if (!ctx.fsProbe.isAccessible(target.canonicalPath)) {
    // Check if the file exists at all.
    try {
      ctx.fsProbe.lstat(target.canonicalPath);
      // File exists but is not readable — check for open handles.
      if (ctx.fsProbe.hasOpenHandles(target.canonicalPath)) {
        return {
          kind: 'unknown-outcome',
          reason: 'target has open handles — concurrency state uncertain',
        };
      }
      return {
        kind: 'inaccessible',
        reason: 'target exists but is not readable',
        causeCode: 'not-readable',
      };
    } catch {
      // File doesn't exist — this is fine, current state is absent.
      return { kind: 'accessible' };
    }
  }

  // Check for open handles.
  if (ctx.fsProbe.hasOpenHandles(target.canonicalPath)) {
    return {
      kind: 'unknown-outcome',
      reason: 'target has open handles — concurrency state uncertain',
    };
  }

  return { kind: 'accessible' };
}

// --- Outcome determination ---

function determineOutcome(
  target: RollbackTarget,
  identity: ResolvedIdentity,
  preImage: ThreeWayState,
  postImage: ThreeWayState,
  currentState: ThreeWayState,
  accessibility: AccessibilityResult,
): AnalysisOutcome {
  // Handle accessibility issues first.
  if (accessibility.kind === 'inaccessible') {
    return {
      kind: 'inaccessible',
      reason: accessibility.reason,
      causeCode: accessibility.causeCode,
    };
  }
  if (accessibility.kind === 'unknown-outcome') {
    return { kind: 'unknown-outcome', reason: accessibility.reason };
  }
  if (accessibility.kind === 'behind-symlink') {
    return {
      kind: 'conflict',
      reason: accessibility.reason,
      reasonCode: 'behind-symlink',
      safeChoices: safeConflictChoices(),
    };
  }

  // Check for identity changes (renamed, recreated, case/unicode).
  if (identity.identityChanged) {
    return {
      kind: 'mismatch',
      reason: `target identity changed: expected ${target.canonicalPath}, resolved to ${identity.canonicalPath}`,
      reasonCode: 'identity-changed',
    };
  }

  // AC #2: current state matches post-image AND identity unchanged.
  if (
    currentState.kind === 'present' &&
    postImage.kind === 'present' &&
    currentState.digest === postImage.digest
  ) {
    // Build the concrete inverse operation.
    const inverseOperation = buildInverseOperation(target, preImage);
    return {
      kind: 'applied-eligible',
      inverseOperation,
      expectedCurrentDigest: currentState.digest,
      expectedCurrentVersion: currentState.version,
      renameHandling: null,
    };
  }

  // Current state matches pre-image (no change since checkpoint — still eligible).
  if (
    currentState.kind === 'present' &&
    preImage.kind === 'present' &&
    currentState.digest === preImage.digest
  ) {
    // The file is back to its pre-image state — the inverse is a no-op or
    // re-apply the post-image. This is still applied-eligible.
    const inverseOperation = buildInverseOperation(target, preImage);
    return {
      kind: 'applied-eligible',
      inverseOperation,
      expectedCurrentDigest: currentState.digest,
      expectedCurrentVersion: currentState.version,
      renameHandling: null,
    };
  }

  // Current state is absent but post-image was present (file was deleted).
  if (currentState.kind === 'absent' && postImage.kind === 'present') {
    return {
      kind: 'conflict',
      reason: 'target was deleted after the checkpoint — cannot restore without user input',
      reasonCode: 'target-deleted',
      safeChoices: safeConflictChoices(),
    };
  }

  // Current state is present but post-image was absent (file was recreated after deletion).
  if (currentState.kind === 'present' && postImage.kind === 'absent') {
    return {
      kind: 'conflict',
      reason: 'target was recreated after deletion — rollback would delete user work',
      reasonCode: 'target-recreated',
      safeChoices: safeConflictChoices(),
    };
  }

  // Current state differs from both pre-image and post-image (later edit).
  if (currentState.kind === 'present') {
    return {
      kind: 'conflict',
      reason: 'current content differs from recorded post-image — a later edit overlaps the patch',
      reasonCode: 'content-conflict',
      safeChoices: safeConflictChoices(),
    };
  }

  // Fallback: unknown state.
  return {
    kind: 'unknown-outcome',
    reason: 'cannot determine outcome from current state',
  };
}

function buildInverseOperation(target: RollbackTarget, preImage: ThreeWayState): InverseOperation {
  if (target.effectKind === 'create_file') {
    return { kind: 'delete-file' };
  }
  if (target.isBinary && target.artifactId !== null) {
    return { kind: 'restore-from-artifact', artifactId: target.artifactId };
  }
  return {
    kind: 'restore-pre-image',
    preImageDigest: preImage.kind === 'present' ? preImage.digest : '',
  };
}

// --- Binary original handling (AC #4) ---

interface BinaryAnalysisResult {
  readonly preImageDigest: string | null;
  readonly isBinary: boolean;
  readonly binaryAvailable: boolean;
  readonly binaryCorrupt: boolean;
}

function analyzeBinaryOriginal(
  target: RollbackTarget,
  ctx: AnalysisContext,
): BinaryAnalysisResult {
  if (!target.isBinary || target.artifactId === null) {
    return { preImageDigest: target.preImageDigest, isBinary: target.isBinary, binaryAvailable: true, binaryCorrupt: false };
  }

  if (!ctx.artifactStore) {
    return { preImageDigest: target.preImageDigest, isBinary: target.isBinary, binaryAvailable: false, binaryCorrupt: false };
  }

  // Read via integrity-verified path (Story 3.2).
  const readResult = ctx.artifactStore.read(target.artifactId as import('../checkpoints/types.js').ArtifactId);
  if (!readResult.ok) {
    if (readResult.failure.category === 'corrupt') {
      return { preImageDigest: target.preImageDigest, isBinary: target.isBinary, binaryAvailable: false, binaryCorrupt: true };
    }
    return { preImageDigest: target.preImageDigest, isBinary: target.isBinary, binaryAvailable: false, binaryCorrupt: false };
  }

  // Verify integrity by comparing digest (no raw bytes exposed — AD-24).
  const actualDigest = computeDigest(readResult.bytes);
  if (target.preImageDigest !== null && actualDigest !== target.preImageDigest) {
    return { preImageDigest: target.preImageDigest, isBinary: target.isBinary, binaryAvailable: false, binaryCorrupt: true };
  }

  return { preImageDigest: actualDigest, isBinary: target.isBinary, binaryAvailable: true, binaryCorrupt: false };
}

// --- Public API ---

/**
 * Analyze a single rollback target against its pre-image, post-image, and
 * current state (three-way). Resolves stable current identity and captures
 * current digest/version BEFORE any effect (AC #1).
 *
 * AC #2: current state matches post-image AND identity unchanged → applied-eligible
 * with concrete inverse operation, expected current digest/version, rename
 * handling, and no unrelated target included.
 *
 * AC #3: current state differs, later edit overlaps, renamed/deleted/recreated,
 * case/unicode changed, behind symlink/mount, or concurrency uncertain →
 * conflict/skipped/inaccessible/mismatch/unknown-outcome; NO overwrite or
 * best-effort reversal prepared.
 *
 * AC #4: binary original in encrypted ArtifactStore → reads via integrity-
 * verified path, verifies integrity + compares digests WITHOUT exposing raw
 * bytes in UI/logs/Evidence; missing or corrupt originals are NOT apply-eligible.
 */
export function analyzeRollbackTarget(
  target: RollbackTarget,
  _checkpoint: CheckpointRecord,
  ctx: AnalysisContext,
): TargetAnalysis {
  // AC #4: Handle binary original first.
  const binaryResult = analyzeBinaryOriginal(target, ctx);
  if (binaryResult.isBinary && (!binaryResult.binaryAvailable || binaryResult.binaryCorrupt)) {
    const preImage = preImageState(target);
    const postImage = postImageState(target);
    return {
      target: { canonicalPath: target.canonicalPath, displayPath: target.displayPath },
      preImage,
      postImage,
      currentState: { kind: 'unknown' },
      outcome: {
        kind: binaryResult.binaryCorrupt ? 'conflict' : 'inaccessible',
        reason: binaryResult.binaryCorrupt
          ? 'binary original is corrupt — integrity verification failed'
          : 'binary original is missing from artifact store',
        reasonCode: binaryResult.binaryCorrupt ? 'binary-corrupt' : 'binary-missing',
        ...(binaryResult.binaryCorrupt ? { safeChoices: safeConflictChoices() } : { causeCode: 'binary-missing' }),
      } as AnalysisOutcome,
      identityChanged: false,
      isBinary: true,
    };
  }

  // Use the verified digest from the artifact store if available.
  const effectiveTarget: RollbackTarget = binaryResult.binaryAvailable && binaryResult.preImageDigest !== null
    ? { ...target, preImageDigest: binaryResult.preImageDigest }
    : target;

  // AC #1: Resolve stable current identity.
  const identity = resolveCurrentIdentity(effectiveTarget, ctx);

  // Check accessibility.
  const accessibility = checkAccessibility(effectiveTarget, identity, ctx);

  // Build three-way states.
  const preImage = preImageState(effectiveTarget);
  const postImage = postImageState(effectiveTarget);
  const currentState = currentStateFromFs(effectiveTarget, ctx);

  // Determine outcome.
  const outcome = determineOutcome(effectiveTarget, identity, preImage, postImage, currentState, accessibility);

  return {
    target: { canonicalPath: identity.canonicalPath, displayPath: identity.displayPath },
    preImage,
    postImage,
    currentState,
    outcome,
    identityChanged: identity.identityChanged,
    isBinary: effectiveTarget.isBinary,
  };
}

/**
 * Analyze a set of rollback targets for a given checkpoint.
 * Aggregates per-target outcomes into a RollbackAnalysis with overall
 * eligibility and per-category counts.
 *
 * Returns an AD-9 typed failure when the checkpoint cannot be read.
 */
export function analyzeRollbackSet(
  checkpointId: string,
  selectedTargets: readonly RollbackTarget[],
  ctx: AnalysisContext,
): AnalyzeRollbackResult {
  try {
    // Read the checkpoint record.
    const readResult = ctx.checkpointRepo.read(
      checkpointId as import('../checkpoints/types.js').CheckpointId,
    );
    if (!readResult.ok) {
      return {
        ok: false,
        failure: analysisFailure(
          readResult.failure.category === 'corrupt' ? 'checkpoint-unreadable' : 'checkpoint-not-found',
          readResult.failure.message,
          readResult.failure.causeCode,
        ),
      };
    }

    const checkpoint = readResult.record;

    // Analyze each target.
    const perTarget: TargetAnalysis[] = selectedTargets.map((target) =>
      analyzeRollbackTarget(target, checkpoint, ctx),
    );

    // Aggregate counts.
    const eligibleCount = perTarget.filter((t) => t.outcome.kind === 'applied-eligible').length;
    const conflictCount = perTarget.filter((t) => t.outcome.kind === 'conflict').length;
    const skippedCount = perTarget.filter((t) => t.outcome.kind === 'skipped').length;
    const inaccessibleCount = perTarget.filter((t) => t.outcome.kind === 'inaccessible').length;
    const mismatchCount = perTarget.filter((t) => t.outcome.kind === 'mismatch').length;
    const unknownCount = perTarget.filter((t) => t.outcome.kind === 'unknown-outcome').length;

    const analysis: RollbackAnalysis = {
      checkpointId: checkpointId as import('../checkpoints/types.js').CheckpointId,
      perTarget,
      overallEligible: eligibleCount === selectedTargets.length,
      eligibleCount,
      conflictCount,
      skippedCount,
      inaccessibleCount,
      mismatchCount,
      unknownCount,
    };

    return { ok: true, analysis };
  } catch (e) {
    return {
      ok: false,
      failure: analysisFailure('internal-error', `analysis failed: ${(e as Error).message}`, 'analysis-failed'),
    };
  }
}

// --- Failure helper ---

function analysisFailure(
  category: import('./types.js').AnalysisFailureCategory,
  message: string,
  causeCode: string,
): AnalysisFailure {
  return {
    category,
    retryable: false,
    scope: 'rollback-analysis',
    message,
    causeCode,
  };
}
