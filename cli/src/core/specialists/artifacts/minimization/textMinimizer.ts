// TextMinimizer: grapheme-aware text truncation (Story 4.7).
// Uses Intl.Segmenter({granularity:'grapheme'}) so Thai base+combining+tone
// mark clusters (e.g. กี้) are NEVER split. Pure, sync, deterministic.

import { createHash } from 'node:crypto';
import type { PreparedArtifact } from '../types.js';
import type { CapabilityRegistryEntry } from '../../registry/types.js';
import type { ArtifactMinimizer, MinimizationResult } from './types.js';
import { parseTextLengthLimit } from '../limits.js';

/**
 * Count the number of grapheme clusters in a string using Intl.Segmenter.
 * This is the correct way to count user-visible characters in Thai and other
 * scripts with combining marks.
 */
export function countGraphemes(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const segments = segmenter.segment(text);
  let count = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of segments) {
    count++;
  }
  return count;
}

/**
 * Truncate text at a grapheme cluster boundary. Uses Intl.Segmenter so that
 * Thai combining/tone marks (e.g. กี้) are never split mid-cluster.
 *
 * @param text - The text to truncate.
 * @param maxClusters - Maximum number of grapheme clusters allowed.
 * @returns The truncated text and whether truncation occurred.
 */
export function truncateTextAtGrapheme(
  text: string,
  maxClusters: number,
): { text: string; truncated: boolean } {
  if (maxClusters < 0) {
    return { text: '', truncated: text.length > 0 };
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const segments = Array.from(segmenter.segment(text));

  if (segments.length <= maxClusters) {
    return { text, truncated: false };
  }

  // Truncate at the last complete grapheme cluster boundary at or before maxClusters.
  const truncated = segments
    .slice(0, maxClusters)
    .map((s) => s.segment)
    .join('');

  return { text: truncated, truncated: true };
}

/**
 * Compute a SHA-256 hex digest over a string.
 */
function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * TextMinimizer: truncates text artifacts to fit within maxTextLength.
 * Truncation is grapheme-aware via Intl.Segmenter.
 */
export class TextMinimizer implements ArtifactMinimizer {
  minimize(
    artifact: PreparedArtifact,
    targetEntry?: CapabilityRegistryEntry,
    clock?: () => string,
  ): MinimizationResult {
    // Only minimize text-like artifacts.
    if (artifact.contentKind !== 'text') {
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    const text = artifact.text ?? '';
    const raw = targetEntry?.inputLimits?.maxTextLength;
    if (raw === undefined) {
      // No text length limit set → pass-through.
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    const maxClusters = parseTextLengthLimit(raw);
    if (maxClusters === null) {
      // Unparseable limit → skip (matching 4.6's limit semantics).
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    const clusterCount = countGraphemes(text);
    if (clusterCount <= maxClusters) {
      // Within limit → pass-through.
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    // Truncate at grapheme boundary.
    const { text: truncatedText, truncated } = truncateTextAtGrapheme(text, maxClusters);
    if (!truncated) {
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    // Recompute content hash over the truncated text.
    const newHash = computeContentHash(truncatedText);

    const minimized: PreparedArtifact = Object.freeze({
      reference: artifact.reference,
      sourceIdentity: artifact.sourceIdentity,
      mediaType: artifact.mediaType,
      sizeBytes: new TextEncoder().encode(truncatedText).length,
      contentHash: newHash,
      originalContentHash: artifact.contentHash,
      contentKind: 'text',
      bytes: undefined,
      text: truncatedText,
      extractedText: artifact.extractedText,
      transformations: Object.freeze(['text-truncate']),
      privacyClassification: artifact.privacyClassification,
      compatibility: artifact.compatibility,
      createdAt: clock ? clock() : artifact.createdAt,
    });

    return {
      ok: true,
      artifact: minimized,
      transformations: ['text-truncate'],
    };
  }
}
