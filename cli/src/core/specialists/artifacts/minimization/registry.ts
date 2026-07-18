// Default minimizer registry and dispatch (Story 4.7).
// Registers minimizers by media-type prefix and dispatches minimizeArtifact.

import type { PreparedArtifact } from '../types.js';
import type { CapabilityRegistryEntry } from '../../registry/types.js';
import type { MinimizationResult, ArtifactMinimizer, ArtifactMinimizerRegistry } from './types.js';
import { TextMinimizer } from './textMinimizer.js';
import { ImageMinimizer } from './imageMinimizer.js';
import { AudioMinimizer } from './audioMinimizer.js';

// --- In-memory minimizer registry ---

class MapMinimizerRegistry implements ArtifactMinimizerRegistry {
  private readonly map = new Map<string, ArtifactMinimizer>();

  register(mediaTypePrefix: string, minimizer: ArtifactMinimizer): void {
    this.map.set(mediaTypePrefix, minimizer);
  }

  resolve(mediaType: string): ArtifactMinimizer | undefined {
    // Longest prefix match.
    let best: { prefix: string; minimizer: ArtifactMinimizer } | null = null;
    for (const [prefix, minimizer] of this.map) {
      if (mediaType.startsWith(prefix)) {
        if (best === null || prefix.length > best.prefix.length) {
          best = { prefix, minimizer };
        }
      }
    }
    return best?.minimizer;
  }
}

/**
 * Create a default minimizer registry with minimizers for text/, image/, and
 * audio/ media type families.
 */
export function createDefaultMinimizerRegistry(): ArtifactMinimizerRegistry {
  const registry = new MapMinimizerRegistry();
  registry.register('text/', new TextMinimizer());
  registry.register('image/', new ImageMinimizer());
  registry.register('audio/', new AudioMinimizer());
  return registry;
}

/**
 * Determine whether a given input limit key is relevant to a media type family.
 * Used to decide whether an unsupported type should fail-closed.
 * `maxFileSize` is a general limit that applies to all types and does NOT
 * trigger `unsupported-type` — only per-type format-specific limits do.
 * `application/*` is a broad category that includes many binary formats
 * (PDF, ZIP, gzip) where text-length limits are not meaningful.
 */
function isRelevantLimit(limitKey: string, mediaType: string): boolean {
  if (mediaType.startsWith('text/')) {
    return limitKey === 'maxTextLength';
  }
  if (mediaType.startsWith('image/')) {
    return limitKey === 'maxResolution';
  }
  if (mediaType.startsWith('audio/') || mediaType.startsWith('video/')) {
    return limitKey === 'maxDuration' || limitKey === 'maxSampleRate';
  }
  return false;
}

/**
 * Check whether any relevant per-type limit is set in the target entry's
 * inputLimits that cannot be enforced without a minimizer.
 */
function hasUnenforceableLimit(targetEntry: CapabilityRegistryEntry, mediaType: string): boolean {
  const limits = targetEntry.inputLimits;
  for (const key of Object.keys(limits)) {
    if (isRelevantLimit(key, mediaType)) {
      return true;
    }
  }
  return false;
}

/**
 * Minimize a prepared artifact against a target service's limits.
 *
 * Resolution order:
 * 1. Resolve minimizer by media-type prefix (longest prefix match).
 * 2. If minimizer found → delegate to it.
 * 3. If no minimizer AND a relevant per-type limit is set that can't be enforced
 *    → return `unsupported-type`.
 * 4. If no minimizer AND no relevant limit → pass-through (artifact unchanged,
 *    transformations: []).
 *
 * @param artifact - The immutable PreparedArtifact to minimize.
 * @param targetEntry - Optional CapabilityRegistryEntry with inputLimits.
 * @param registry - Optional minimizer registry (defaults to createDefaultMinimizerRegistry()).
 * @param clock - Optional clock function for createdAt timestamps.
 */
export function minimizeArtifact(
  artifact: PreparedArtifact,
  targetEntry?: CapabilityRegistryEntry,
  registry?: ArtifactMinimizerRegistry,
  clock?: () => string,
): MinimizationResult {
  const reg = registry ?? createDefaultMinimizerRegistry();
  const minimizer = reg.resolve(artifact.mediaType);

  if (minimizer) {
    return minimizer.minimize(artifact, targetEntry, clock);
  }

  // No minimizer for this media type.
  if (targetEntry && hasUnenforceableLimit(targetEntry, artifact.mediaType)) {
    return {
      ok: false,
      cause: 'unsupported-type',
      detail: `No minimizer available for ${artifact.mediaType} and a relevant limit is set that cannot be enforced.`,
    };
  }

  // No minimizer and no relevant limit → pass-through.
  return {
    ok: true,
    artifact,
    transformations: [],
  };
}
