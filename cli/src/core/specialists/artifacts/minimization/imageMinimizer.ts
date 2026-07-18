// ImageMinimizer: pure dimension parsing for PNG/JPEG/GIF/BMP/WebP (Story 4.7).
// No image library dependency — reads dimensions from header bytes only.
// Pure, sync, deterministic. No fs/network/Date/random.

import type { PreparedArtifact } from '../types.js';
import type { CapabilityRegistryEntry } from '../../registry/types.js';
import type { ArtifactMinimizer, MinimizationResult } from './types.js';
import { parseResolutionLimit } from '../limits.js';

// --- PNG dimension parsing ---

/**
 * Parse PNG dimensions from the IHDR chunk.
 * PNG signature: 89 50 4E 47 0D 0A 1A 0A (8 bytes)
 * IHDR chunk: 4 bytes length + "IHDR" + 4 bytes width (big-endian) + 4 bytes height (big-endian)
 * IHDR starts at offset 16 (8 sig + 4 len + 4 type).
 */
function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  // Check PNG signature.
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== sig[i]) return null;
  }
  // IHDR chunk type at offset 12.
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) {
    return null;
  }
  const width = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
  const height = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

// --- JPEG dimension parsing ---

/**
 * Parse JPEG dimensions by scanning for SOF (Start Of Frame) markers.
 * JPEG starts with FF D8. SOF markers are 0xC0..0xCF (except 0xC4=DHT, 0xC8=JPG, 0xCC=DAC).
 * SOF segment: marker (2) + length (2) + precision (1) + height (2 big-endian) + width (2 big-endian).
 */
function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4) return null;
  // Check JPEG SOI marker: FF D8.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < bytes.length - 1) {
    // Scan for marker: FF followed by a non-FF, non-00 byte.
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    if (offset + 1 >= bytes.length) return null;
    const marker = bytes[offset + 1];
    if (marker === 0x00 || marker === 0xff) {
      offset += 2;
      continue;
    }
    // Parameterless markers: restart markers (0xD0-0xD7) and TEM (0x01)
    // have no length field — just the marker byte.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // SOS (Start Of Scan, 0xDA) — compressed data follows; stop scanning
    // because entropy-coded bytes can mimic markers.
    if (marker === 0xda) {
      return null;
    }
    // Check if this is an SOF marker (0xC0..0xCF, excluding 0xC4, 0xC8, 0xCC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (offset + 8 >= bytes.length) return null;
      const segLen = ((bytes[offset + 2] << 8) | bytes[offset + 3]) & 0xffff;
      // Minimum valid SOF segment: 2 (length) + 1 (precision) + 2 (height) + 2 (width) + 1 (components) = 8
      if (segLen < 8) return null;
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      if (width <= 0 || height <= 0) return null;
      return { width, height };
    }
    // Skip this segment: read length and advance.
    if (offset + 3 >= bytes.length) return null;
    const segLen = ((bytes[offset + 2] << 8) | bytes[offset + 3]) & 0xffff;
    if (segLen < 2) return null;
    offset += 2 + segLen;
  }
  return null;
}

// --- GIF dimension parsing ---

/**
 * Parse GIF dimensions from the Logical Screen Descriptor.
 * GIF signature: GIF87a or GIF89a (6 bytes)
 * Logical Screen Descriptor: width (2 bytes little-endian) + height (2 bytes little-endian) at offset 6.
 */
function parseGifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10) return null;
  // Check GIF signature.
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) return null;
  if (bytes[3] !== 0x38 || (bytes[4] !== 0x37 && bytes[4] !== 0x39) || bytes[5] !== 0x61) return null;
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

// --- BMP dimension parsing ---

/**
 * Parse BMP dimensions from the BITMAPINFOHEADER.
 * BMP signature: 42 4D (2 bytes)
 * Width at offset 18 (4 bytes little-endian int32), height at offset 22 (4 bytes little-endian int32).
 */
function parseBmpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 26) return null;
  // Check BMP signature.
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) return null;
  const width = (bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24)) >>> 0;
  // BMP height is a signed int32 — negative for top-down bitmaps. Keep it
  // signed (no >>> 0) so Math.abs recovers the magnitude correctly.
  const height = bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24);
  const absHeight = Math.abs(height);
  if (width <= 0 || absHeight <= 0) return null;
  return { width, height: absHeight };
}

// --- WebP dimension parsing ---

/**
 * Parse WebP dimensions from the VP8/VP8L/VP8X chunk.
 * WebP is a RIFF container: "RIFF" + fileSize + "WEBP" (12 bytes header).
 * Then a chunk: chunkId (4) + chunkSize (4 little-endian) + chunkData.
 *
 * VP8 (lossy): 10 bytes after chunk header. Width/height are 14-bit little-endian
 *   at offset 6 of VP8 data: ((data[6] | (data[7] << 8)) & 0x3fff) + 1 for width,
 *   ((data[8] | (data[9] << 8)) & 0x3fff) + 1 for height.
 *
 * VP8L (lossless): 5 bytes after chunk header. Width = (data[1] | ((data[2] & 0x3f) << 8)) + 1,
 *   Height = ((data[2] >> 6) | (data[3] << 2) | ((data[4] & 0x0f) << 10)) + 1.
 *
 * VP8X (extended): 10 bytes after chunk header. Width/height are 24-bit little-endian
 *   at offset 4: width = (data[4] | (data[5] << 8) | (data[6] << 16)) + 1,
 *   height = (data[7] | (data[8] << 8) | (data[9] << 16)) + 1.
 */
function parseWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  // Check RIFF header.
  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) return null;
  // Check WEBP identifier at offset 8.
  if (bytes[8] !== 0x57 || bytes[9] !== 0x45 || bytes[10] !== 0x42 || bytes[11] !== 0x50) return null;

  // Parse the first chunk after the RIFF header.
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkSize = (bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24)) >>> 0;
    const dataOffset = offset + 8;

    if (chunkId === 'VP8 ' && dataOffset + 10 <= bytes.length) {
      // VP8 key frame header: 10 bytes of uncompressed data.
      // Bit 0 of the first byte is the key-frame flag (0 = key frame).
      const isKeyFrame = (bytes[dataOffset] & 0x01) === 0;
      if (!isKeyFrame) return null;
      const w = ((bytes[dataOffset + 6] | (bytes[dataOffset + 7] << 8)) & 0x3fff) + 1;
      const h = ((bytes[dataOffset + 8] | (bytes[dataOffset + 9] << 8)) & 0x3fff) + 1;
      if (w > 0 && h > 0) return { width: w, height: h };
      return null;
    }

    if (chunkId === 'VP8L' && dataOffset + 5 <= bytes.length) {
      const w = ((bytes[dataOffset + 1] | ((bytes[dataOffset + 2] & 0x3f) << 8)) & 0x3fff) + 1;
      const h = (((bytes[dataOffset + 2] >> 6) | (bytes[dataOffset + 3] << 2) | ((bytes[dataOffset + 4] & 0x0f) << 10)) & 0x3fff) + 1;
      if (w > 0 && h > 0) return { width: w, height: h };
      return null;
    }

    if (chunkId === 'VP8X' && dataOffset + 10 <= bytes.length) {
      const w = ((bytes[dataOffset + 4] | (bytes[dataOffset + 5] << 8) | (bytes[dataOffset + 6] << 16)) & 0xffffff) + 1;
      const h = ((bytes[dataOffset + 7] | (bytes[dataOffset + 8] << 8) | (bytes[dataOffset + 9] << 16)) & 0xffffff) + 1;
      if (w > 0 && h > 0) return { width: w, height: h };
      return null;
    }

    // Advance to next chunk (chunks are padded to even byte boundaries).
    const paddedSize = chunkSize + (chunkSize % 2);
    offset = dataOffset + paddedSize;
  }

  return null;
}

// --- Main parser dispatch ---

/**
 * Parse image dimensions from raw bytes for known image formats.
 * Returns `null` when the format is not supported or the header is unparseable.
 */
export function parseImageDimensions(
  bytes: Uint8Array,
  mediaType: string,
): { width: number; height: number } | null {
  // Normalize to lowercase for case-insensitive comparison.
  const normalized = mediaType.toLowerCase();
  switch (normalized) {
    case 'image/png':
      return parsePngDimensions(bytes);
    case 'image/jpeg':
      return parseJpegDimensions(bytes);
    case 'image/gif':
      return parseGifDimensions(bytes);
    case 'image/bmp':
      return parseBmpDimensions(bytes);
    case 'image/webp':
      return parseWebpDimensions(bytes);
    default:
      return null;
  }
}

/**
 * ImageMinimizer: validates image dimensions against maxResolution.
 * Within limit → pass-through. Over limit → minimization-unavailable (no
 * downscale lib in Release 1). Unparseable header → validation-failed.
 */
export class ImageMinimizer implements ArtifactMinimizer {
  minimize(
    artifact: PreparedArtifact,
    targetEntry?: CapabilityRegistryEntry,
    _clock?: () => string,
  ): MinimizationResult {
    // Only minimize image artifacts.
    if (!artifact.mediaType.startsWith('image/')) {
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    const raw = targetEntry?.inputLimits?.maxResolution;
    if (raw === undefined) {
      // No resolution limit set → pass-through.
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    const limit = parseResolutionLimit(raw);
    if (limit === null) {
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
        detail: 'No image bytes available for dimension parsing.',
      };
    }

    const dims = parseImageDimensions(bytes, artifact.mediaType);
    if (dims === null) {
      return {
        ok: false,
        cause: 'validation-failed',
        detail: `Cannot parse dimensions for ${artifact.mediaType}.`,
      };
    }

    if (dims.width <= limit.width && dims.height <= limit.height) {
      // Within resolution limit → pass-through.
      return {
        ok: true,
        artifact,
        transformations: [],
      };
    }

    // Over resolution limit → minimization-unavailable (no downscale lib).
    return {
      ok: false,
      cause: 'minimization-unavailable',
      detail: `Image dimensions ${dims.width}x${dims.height} exceed limit ${limit.width}x${limit.height}. Downscaling is not available in Release 1.`,
    };
  }
}
