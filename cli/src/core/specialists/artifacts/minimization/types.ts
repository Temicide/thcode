// Minimization result types and minimizer interfaces (Story 4.7).
// Pure, local, deterministic — no fs/network/Date/random.

import type { PreparedArtifact } from '../types.js';
import type { CapabilityRegistryEntry } from '../../registry/types.js';

// --- Minimization result (discriminated union) ---

export type MinimizationResult =
  | {
      readonly ok: true;
      readonly artifact: PreparedArtifact;
      readonly transformations: readonly string[];
    }
  | {
      readonly ok: false;
      readonly cause: 'minimization-unavailable' | 'validation-failed' | 'unsupported-type';
      readonly detail: string;
    };

// --- ArtifactMinimizer interface ---

export interface ArtifactMinimizer {
  /**
   * Minimize a prepared artifact to fit within the target service's limits.
   * Pure, sync, deterministic. Never mutates the input artifact.
   *
   * @param artifact - The immutable PreparedArtifact to minimize.
   * @param targetEntry - Optional CapabilityRegistryEntry with inputLimits.
   * @param clock - Optional clock function for createdAt timestamps.
   */
  minimize(
    artifact: PreparedArtifact,
    targetEntry?: CapabilityRegistryEntry,
    clock?: () => string,
  ): MinimizationResult;
}

// --- ArtifactMinimizerRegistry ---

export interface ArtifactMinimizerRegistry {
  /**
   * Register a minimizer for a media type prefix (e.g. `text/`, `image/`).
   * Longer prefixes take priority over shorter ones during resolution.
   */
  register(mediaTypePrefix: string, minimizer: ArtifactMinimizer): void;

  /**
   * Resolve a minimizer for the given media type by longest-prefix match.
   * Returns `undefined` when no minimizer matches.
   */
  resolve(mediaType: string): ArtifactMinimizer | undefined;
}
