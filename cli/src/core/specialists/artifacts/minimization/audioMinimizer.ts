// AudioMinimizer: WAV duration parsing and maxDuration validation (Story 4.7).
// For WAV, parses the RIFF header to compute duration. For other audio types,
// duration is not measurable without a codec library → minimization-unavailable
// when maxDuration is set. Pure, sync, deterministic.

import type { PreparedArtifact } from '../types.js';
import type { CapabilityRegistryEntry } from '../../registry/types.js';
import type { ArtifactMinimizer, MinimizationResult } from './types.js';
import { parseDurationLimit } from '../limits.js';

// --- WAV duration parsing ---

/**
 * Parse WAV duration from the RIFF header.
 * WAV is a RIFF container: "RIFF" (4) + fileSize (4) + "WAVE" (4)
 * Then chunks: "fmt " (4) + chunkSize (4) + audioFormat (2) + channels (2) +
 *   sampleRate (4) + byteRate (4) + blockAlign (2) + bitsPerSample (2)
 * Then "data" (4) + dataSize (4) + data bytes
 *
 * Duration (seconds) = dataSize / (sampleRate * channels * bitsPerSample/8)
 *
 * Returns null when the header cannot be parsed or the format is not PCM.
 */
function parseWavDuration(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;

  // Check RIFF header.
  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) return null;
  // Check WAVE identifier at offset 8.
  if (bytes[8] !== 0x57 || bytes[9] !== 0x41 || bytes[10] !== 0x56 || bytes[11] !== 0x45) return null;

  // Scan for "fmt " and "data" chunks (order is not guaranteed in RIFF).
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let foundFmt = false;
  let dataSize = 0;
  let foundData = false;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = (bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24)) >>> 0;
    const dataOffset = offset + 8;

    if (chunkId === 'fmt ' && dataOffset + 16 <= bytes.length) {
      audioFormat = bytes[dataOffset] | (bytes[dataOffset + 1] << 8);
      channels = bytes[dataOffset + 2] | (bytes[dataOffset + 3] << 8);
      sampleRate = (bytes[dataOffset + 4] | (bytes[dataOffset + 5] << 8) | (bytes[dataOffset + 6] << 16) | (bytes[dataOffset + 7] << 24)) >>> 0;
      bitsPerSample = bytes[dataOffset + 14] | (bytes[dataOffset + 15] << 8);
      foundFmt = true;
    }

    if (chunkId === 'data') {
      dataSize = chunkSize;
      foundData = true;
    }

    // Compute duration once both fmt and data are available (order-independent).
    if (foundFmt && foundData) {
      if (channels === 0 || sampleRate === 0 || bitsPerSample === 0) return null;
      // Only PCM (audioFormat === 1) or IEEE float (audioFormat === 3) are reliably measurable.
      if (audioFormat !== 1 && audioFormat !== 3) return null;
      const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
      if (bytesPerSecond === 0) return null;
      const duration = dataSize / bytesPerSecond;
      return duration;
    }

    // Advance to next chunk (padded to even byte boundary).
    const paddedSize = chunkSize + (chunkSize % 2);
    offset = dataOffset + paddedSize;
  }

  return null;
}

/**
 * AudioMinimizer: validates audio duration against maxDuration.
 * For WAV, parses the RIFF header to compute duration. For other audio types,
 * duration is not measurable without a codec library → minimization-unavailable
 * when maxDuration is set. If no maxDuration → pass-through.
 */
export class AudioMinimizer implements ArtifactMinimizer {
  minimize(
    artifact: PreparedArtifact,
    targetEntry?: CapabilityRegistryEntry,
    _clock?: () => string,
  ): MinimizationResult {
    // Only minimize audio artifacts.
    if (!artifact.mediaType.startsWith('audio/')) {
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    const raw = targetEntry?.inputLimits?.maxDuration;
    if (raw === undefined) {
      // No duration limit set → pass-through.
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    const maxDuration = parseDurationLimit(raw);
    if (maxDuration === null) {
      // Unparseable limit → skip.
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    const bytes = artifact.bytes;
    if (!bytes || bytes.length === 0) {
      return {
        ok: false,
        cause: 'validation-failed',
        detail: 'No audio bytes available for duration parsing.',
      };
    }

    // For WAV (including audio/x-wav), parse duration from the RIFF header.
    const normalizedType = artifact.mediaType.toLowerCase();
    if (normalizedType === 'audio/wav' || normalizedType === 'audio/x-wav') {
      const duration = parseWavDuration(bytes);
      if (duration === null) {
        return {
          ok: false,
          cause: 'validation-failed',
          detail: 'Cannot parse WAV duration from header.',
        };
      }

      if (duration <= maxDuration) {
        // Within duration limit → pass-through.
        return {
          ok: true,
          artifact,
          transformations: [],
        };
      }

      // Over duration limit → minimization-unavailable.
      return {
        ok: false,
        cause: 'minimization-unavailable',
        detail: `Audio duration ${duration.toFixed(1)}s exceeds limit ${maxDuration}s. Audio transcoding is not available in Release 1.`,
      };
    }

    // Non-WAV audio with maxDuration set → can't measure without codec lib.
    return {
      ok: false,
      cause: 'minimization-unavailable',
      detail: `Duration cannot be measured for ${artifact.mediaType} without a codec library.`,
    };
  }
}
