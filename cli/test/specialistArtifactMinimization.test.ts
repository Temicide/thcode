// Specialist Artifact Minimization tests (Story 4.7).
// Covers every I/O matrix row + every AC with hand-crafted byte fixtures.
// No real fs/network — pure in-memory PreparedArtifact fixtures.

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  TextMinimizer,
  countGraphemes,
  truncateTextAtGrapheme,
  ImageMinimizer,
  parseImageDimensions,
  AudioMinimizer,
  createDefaultMinimizerRegistry,
  minimizeArtifact,
  parseResolutionLimit,
  parseDurationLimit,
} from '../src/core/specialists/artifacts/index.js';
import type { PreparedArtifact } from '../src/core/specialists/artifacts/types.js';
import type { CapabilityRegistryEntry } from '../src/core/specialists/registry/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fixedClock = () => '2026-07-17T12:00:00.000Z';

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Build a minimal PreparedArtifact fixture for testing. */
function makeTextArtifact(
  text: string,
  overrides: Partial<PreparedArtifact> = {},
): PreparedArtifact {
  const contentHash = sha256(text);
  return Object.freeze({
    reference: { raw: '@test.txt', canonical: '/workspace/test.txt' },
    sourceIdentity: {
      canonicalPath: '/workspace/test.txt',
      displayPath: 'test.txt',
      type: 'file',
      sizeBytes: new TextEncoder().encode(text).length,
      identityProven: true,
      digest: contentHash,
      version: null,
    },
    mediaType: 'text/plain',
    sizeBytes: new TextEncoder().encode(text).length,
    contentHash,
    contentKind: 'text',
    text,
    bytes: undefined,
    transformations: Object.freeze(['utf8-decode']),
    privacyClassification: 'internal',
    compatibility: { status: 'unverified' },
    createdAt: '2026-07-17T12:00:00.000Z',
    ...overrides,
  });
}

function makeBinaryArtifact(
  bytes: Uint8Array,
  mediaType: string,
  overrides: Partial<PreparedArtifact> = {},
): PreparedArtifact {
  const contentHash = sha256Bytes(bytes);
  return Object.freeze({
    reference: { raw: '@test', canonical: '/workspace/test' },
    sourceIdentity: {
      canonicalPath: '/workspace/test',
      displayPath: 'test',
      type: 'file',
      sizeBytes: bytes.length,
      identityProven: true,
      digest: contentHash,
      version: null,
    },
    mediaType,
    sizeBytes: bytes.length,
    contentHash,
    contentKind: 'bytes',
    bytes,
    text: undefined,
    transformations: Object.freeze([]),
    privacyClassification: 'internal',
    compatibility: { status: 'unverified' },
    createdAt: '2026-07-17T12:00:00.000Z',
    ...overrides,
  });
}

// --- Target service entries ---

const TEXT_SERVICE: CapabilityRegistryEntry = {
  id: 'text-service',
  upstreamId: 'text',
  nameThai: 'บริการข้อความ',
  nameEnglish: 'Text Service',
  searchTerms: ['text'],
  capabilities: ['text-processing'],
  supportedInputs: ['text/plain'],
  inputLimits: { maxFileSize: '1MB', maxTextLength: '5000' },
  entitlement: 'test',
  evidenceLevel: 'deterministic',
  observationDate: '2026-07-17',
  endpoint: 'https://example.com/text',
  transportRules: { allowedProtocols: ['https'], requiresTls: true, allowedMethods: ['POST'] },
  privacyClassification: { category: 'standard', dataClasses: ['text'], requiresConsent: false },
  retentionClassification: { policy: 'delete-after-30-days', providerDeletionSupported: true, defaultRetentionDays: 30 },
  confirmationPolicy: { requiresExplicitConsent: false, scope: 'none' },
  manifestVersion: 1,
  contractVersion: '1.0.0',
  adapterVersion: '1.0.0',
  latestContractTestResult: { passed: true, testedAt: '2026-07-17T08:00:00.000Z', summary: 'ok' },
  invokable: true,
  invokableStateReason: null,
};

const IMAGE_SERVICE: CapabilityRegistryEntry = {
  ...TEXT_SERVICE,
  id: 'image-service',
  nameEnglish: 'Image Service',
  supportedInputs: ['image/png', 'image/jpeg'],
  inputLimits: { maxFileSize: '5MB', maxResolution: '4000x4000' },
};

const AUDIO_SERVICE: CapabilityRegistryEntry = {
  ...TEXT_SERVICE,
  id: 'audio-service',
  nameEnglish: 'Audio Service',
  supportedInputs: ['audio/wav', 'audio/mpeg'],
  inputLimits: { maxFileSize: '10MB', maxDuration: '30' },
};

const NO_LIMIT_SERVICE: CapabilityRegistryEntry = {
  ...TEXT_SERVICE,
  id: 'no-limit-service',
  nameEnglish: 'No Limit Service',
  supportedInputs: ['text/plain', 'image/png', 'audio/wav'],
  inputLimits: {},
};

// ---------------------------------------------------------------------------
// parseResolutionLimit
// ---------------------------------------------------------------------------

describe('parseResolutionLimit', () => {
  it('parses 4000x4000', () => {
    expect(parseResolutionLimit('4000x4000')).toEqual({ width: 4000, height: 4000 });
  });

  it('parses 1920X1080 (uppercase X)', () => {
    expect(parseResolutionLimit('1920X1080')).toEqual({ width: 1920, height: 1080 });
  });

  it('parses 800x600 with spaces', () => {
    expect(parseResolutionLimit('800 x 600')).toEqual({ width: 800, height: 600 });
  });

  it('returns null for invalid format', () => {
    expect(parseResolutionLimit('not-a-resolution')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseResolutionLimit('')).toBeNull();
  });

  it('returns null for negative values', () => {
    expect(parseResolutionLimit('-100x-200')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseDurationLimit
// ---------------------------------------------------------------------------

describe('parseDurationLimit', () => {
  it('parses plain seconds', () => {
    expect(parseDurationLimit('30')).toBe(30);
  });

  it('parses seconds with s suffix', () => {
    expect(parseDurationLimit('30s')).toBe(30);
  });

  it('parses minutes', () => {
    expect(parseDurationLimit('2m')).toBe(120);
  });

  it('parses hours', () => {
    expect(parseDurationLimit('1h')).toBe(3600);
  });

  it('parses fractional minutes', () => {
    expect(parseDurationLimit('1.5m')).toBe(90);
  });

  it('returns null for invalid format', () => {
    expect(parseDurationLimit('not-a-duration')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDurationLimit('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// countGraphemes
// ---------------------------------------------------------------------------

describe('countGraphemes', () => {
  it('counts ASCII characters correctly', () => {
    expect(countGraphemes('hello')).toBe(5);
  });

  it('counts Thai grapheme clusters correctly', () => {
    // ก (base) + ี (combining) + ้ (tone) = 1 grapheme cluster
    // กี้ is one grapheme cluster
    expect(countGraphemes('กี้')).toBe(1);
  });

  it('counts mixed Thai and ASCII', () => {
    // สวัสดี = 4 grapheme clusters (ส, ว, ส, ดี)
    expect(countGraphemes('สวัสดี')).toBe(4);
  });

  it('counts emoji sequences as single clusters', () => {
    // Each emoji is typically one grapheme cluster
    expect(countGraphemes('😀🎉')).toBe(2);
  });

  it('counts empty string as 0', () => {
    expect(countGraphemes('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// truncateTextAtGrapheme
// ---------------------------------------------------------------------------

describe('truncateTextAtGrapheme', () => {
  it('returns original text when within limit', () => {
    const result = truncateTextAtGrapheme('hello', 10);
    expect(result.text).toBe('hello');
    expect(result.truncated).toBe(false);
  });

  it('truncates at exact boundary when at limit', () => {
    const result = truncateTextAtGrapheme('hello', 5);
    expect(result.text).toBe('hello');
    expect(result.truncated).toBe(false);
  });

  it('truncates ASCII text when over limit', () => {
    const result = truncateTextAtGrapheme('hello world', 5);
    expect(result.text).toBe('hello');
    expect(result.truncated).toBe(true);
  });

  it('truncates Thai text at grapheme boundary (no split combining marks)', () => {
    // "กี้" is 1 grapheme cluster (ก + ี + ้)
    // "กี้hello" is 6 grapheme clusters
    const text = 'กี้hello';
    expect(countGraphemes(text)).toBe(6);

    // Truncate to 3 grapheme clusters.
    const result = truncateTextAtGrapheme(text, 3);
    expect(result.truncated).toBe(true);

    // The result should be exactly 3 grapheme clusters.
    const resultClusters = countGraphemes(result.text);
    expect(resultClusters).toBe(3);

    // The result should not end with a lone combining mark.
    // "กี้" is one cluster, so truncating to 3 should give "กี้he"
    // Let's verify the result is valid by re-segmenting.
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(result.text));
    expect(segments.length).toBe(3);
    // Each segment should be a complete grapheme cluster.
    for (const seg of segments) {
      expect(seg.segment.length).toBeGreaterThan(0);
    }
  });

  it('truncates Thai text with multiple combining marks correctly', () => {
    // "กี้" is 1 cluster, "hello" is 5 clusters = 6 total
    const text = 'กี้hello';
    // Truncate to 1 cluster → should get just "กี้"
    const result = truncateTextAtGrapheme(text, 1);
    expect(result.truncated).toBe(true);
    expect(countGraphemes(result.text)).toBe(1);
    // The result should be the first grapheme cluster only.
    expect(result.text).toBe('กี้');
  });

  it('handles empty string', () => {
    const result = truncateTextAtGrapheme('', 10);
    expect(result.text).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('handles zero maxClusters', () => {
    const result = truncateTextAtGrapheme('hello', 0);
    expect(result.text).toBe('');
    expect(result.truncated).toBe(true);
  });

  it('handles negative maxClusters', () => {
    const result = truncateTextAtGrapheme('hello', -1);
    expect(result.text).toBe('');
    expect(result.truncated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TextMinimizer
// ---------------------------------------------------------------------------

describe('TextMinimizer', () => {
  const minimizer = new TextMinimizer();

  it('passes through text within maxTextLength', () => {
    const artifact = makeTextArtifact('Hello, world!');
    const result = minimizer.minimize(artifact, TEXT_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
    expect(result.artifact.contentHash).toBe(artifact.contentHash);
    expect(result.artifact.text).toBe('Hello, world!');
    expect(result.artifact.originalContentHash).toBeUndefined();
  });

  it('truncates text over maxTextLength', () => {
    // maxTextLength is 5000, so create text > 5000 grapheme clusters.
    const longText = 'a'.repeat(6000);
    const artifact = makeTextArtifact(longText);
    const result = minimizer.minimize(artifact, TEXT_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual(['text-truncate']);
    expect(result.artifact.text).toBe('a'.repeat(5000));
    expect(result.artifact.text!.length).toBe(5000);
    // Content hash should be recomputed over the truncated text.
    expect(result.artifact.contentHash).toBe(sha256('a'.repeat(5000)));
    // originalContentHash should be the pre-minimization hash.
    expect(result.artifact.originalContentHash).toBe(artifact.contentHash);
    // sizeBytes should be updated.
    expect(result.artifact.sizeBytes).toBe(5000);
  });

  it('preserves source identity after truncation', () => {
    const longText = 'x'.repeat(6000);
    const artifact = makeTextArtifact(longText);
    const result = minimizer.minimize(artifact, TEXT_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.reference.raw).toBe(artifact.reference.raw);
    expect(result.artifact.reference.canonical).toBe(artifact.reference.canonical);
    expect(result.artifact.sourceIdentity.canonicalPath).toBe(artifact.sourceIdentity.canonicalPath);
    expect(result.artifact.sourceIdentity.displayPath).toBe(artifact.sourceIdentity.displayPath);
    expect(result.artifact.mediaType).toBe(artifact.mediaType);
    expect(result.artifact.privacyClassification).toBe(artifact.privacyClassification);
    expect(result.artifact.compatibility).toBe(artifact.compatibility);
  });

  it('passes through when no maxTextLength is set', () => {
    const longText = 'x'.repeat(10000);
    const artifact = makeTextArtifact(longText);
    const result = minimizer.minimize(artifact, NO_LIMIT_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
    expect(result.artifact.text).toBe(longText);
    expect(result.artifact.contentHash).toBe(artifact.contentHash);
  });

  it('passes through when no target entry is provided', () => {
    const longText = 'x'.repeat(10000);
    const artifact = makeTextArtifact(longText);
    const result = minimizer.minimize(artifact, undefined, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
    expect(result.artifact.text).toBe(longText);
  });

  it('passes through binary artifacts', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const artifact = makeBinaryArtifact(bytes, 'image/png');
    const result = minimizer.minimize(artifact, TEXT_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
    expect(result.artifact.bytes).toEqual(bytes);
  });

  it('truncates Thai text at grapheme boundary', () => {
    // Build a Thai string with combining marks that exceeds the limit.
    // "กี้" is 1 grapheme cluster. Create 100 of them = 100 clusters.
    const thaiCluster = 'กี้'; // base + combining + tone = 1 cluster
    const thaiText = thaiCluster.repeat(100); // 100 grapheme clusters
    expect(countGraphemes(thaiText)).toBe(100);

    const serviceWithSmallLimit: CapabilityRegistryEntry = {
      ...TEXT_SERVICE,
      inputLimits: { maxTextLength: '50' },
    };

    const artifact = makeTextArtifact(thaiText);
    const result = minimizer.minimize(artifact, serviceWithSmallLimit, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The result should be exactly 50 grapheme clusters.
    const resultClusters = countGraphemes(result.artifact.text!);
    expect(resultClusters).toBe(50);

    // The result should not end with a lone combining mark.
    // Re-segment and verify each segment is a complete grapheme cluster.
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(result.artifact.text!));
    expect(segments.length).toBe(50);
    for (const seg of segments) {
      expect(seg.segment.length).toBeGreaterThan(0);
    }

    // Verify the result is a prefix of the original (no corruption).
    expect(thaiText.startsWith(result.artifact.text!)).toBe(true);
  });

  it('is deterministic (same input → same output)', () => {
    const longText = 'x'.repeat(6000);
    const artifact = makeTextArtifact(longText);
    const r1 = minimizer.minimize(artifact, TEXT_SERVICE, fixedClock);
    const r2 = minimizer.minimize(artifact, TEXT_SERVICE, fixedClock);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.artifact.contentHash).toBe(r2.artifact.contentHash);
    expect(r1.artifact.text).toBe(r2.artifact.text);
    expect(r1.transformations).toEqual(r2.transformations);
  });

  it('returns immutable (frozen) artifact', () => {
    const longText = 'x'.repeat(6000);
    const artifact = makeTextArtifact(longText);
    const result = minimizer.minimize(artifact, TEXT_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.artifact)).toBe(true);
    expect(Object.isFrozen(result.artifact.transformations)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ImageMinimizer
// ---------------------------------------------------------------------------

describe('ImageMinimizer', () => {
  const minimizer = new ImageMinimizer();

  /** Build a minimal valid PNG header with given dimensions.
   * PNG signature (8) + IHDR chunk length (4) + "IHDR" (4) + width (4) + height (4) + bit depth (1) + color type (1) + ... */
  function makePngHeader(width: number, height: number): Uint8Array {
    const buf = new Uint8Array(33);
    // PNG signature
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) buf[i] = sig[i];
    // IHDR chunk length = 13 (big-endian uint32)
    buf[8] = 0x00; buf[9] = 0x00; buf[10] = 0x00; buf[11] = 0x0d;
    // IHDR type
    buf[12] = 0x49; buf[13] = 0x48; buf[14] = 0x44; buf[15] = 0x52;
    // Width (big-endian uint32)
    buf[16] = (width >> 24) & 0xff;
    buf[17] = (width >> 16) & 0xff;
    buf[18] = (width >> 8) & 0xff;
    buf[19] = width & 0xff;
    // Height (big-endian uint32)
    buf[20] = (height >> 24) & 0xff;
    buf[21] = (height >> 16) & 0xff;
    buf[22] = (height >> 8) & 0xff;
    buf[23] = height & 0xff;
    // Bit depth = 8, color type = 2 (RGB)
    buf[24] = 8;
    buf[25] = 2;
    // CRC placeholder
    buf[26] = 0; buf[27] = 0; buf[28] = 0; buf[29] = 0;
    // Extra bytes to make it look more complete
    buf[30] = 0; buf[31] = 0; buf[32] = 0;
    return buf;
  }

  it('passes through image within maxResolution', () => {
    const bytes = makePngHeader(2000, 2000);
    const artifact = makeBinaryArtifact(bytes, 'image/png');
    const result = minimizer.minimize(artifact, IMAGE_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
    expect(result.artifact.contentHash).toBe(artifact.contentHash);
  });

  it('returns minimization-unavailable for image over maxResolution', () => {
    const bytes = makePngHeader(5000, 5000);
    const artifact = makeBinaryArtifact(bytes, 'image/png');
    const result = minimizer.minimize(artifact, IMAGE_SERVICE, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('minimization-unavailable');
    expect(result.detail).toContain('5000x5000');
    expect(result.detail).toContain('4000x4000');
  });

  it('passes through when no maxResolution is set', () => {
    const bytes = makePngHeader(5000, 5000);
    const artifact = makeBinaryArtifact(bytes, 'image/png');
    const result = minimizer.minimize(artifact, NO_LIMIT_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
  });

  it('returns validation-failed for unparseable image header', () => {
    // Garbage bytes with image/png media type.
    const garbage = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const artifact = makeBinaryArtifact(garbage, 'image/png');
    const result = minimizer.minimize(artifact, IMAGE_SERVICE, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('validation-failed');
  });

  it('passes through non-image artifacts', () => {
    const artifact = makeTextArtifact('hello');
    const result = minimizer.minimize(artifact, IMAGE_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
  });

  it('returns validation-failed when no bytes available', () => {
    const artifact = makeTextArtifact('hello', { mediaType: 'image/png', bytes: undefined, contentKind: 'bytes' });
    const result = minimizer.minimize(artifact, IMAGE_SERVICE, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('validation-failed');
  });

  it('is deterministic', () => {
    const bytes = makePngHeader(5000, 5000);
    const artifact = makeBinaryArtifact(bytes, 'image/png');
    const r1 = minimizer.minimize(artifact, IMAGE_SERVICE, fixedClock);
    const r2 = minimizer.minimize(artifact, IMAGE_SERVICE, fixedClock);
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (r1.ok || r2.ok) return;
    expect(r1.cause).toBe(r2.cause);
    expect(r1.detail).toBe(r2.detail);
  });
});

// ---------------------------------------------------------------------------
// parseImageDimensions
// ---------------------------------------------------------------------------

describe('parseImageDimensions', () => {
  it('parses PNG dimensions from header', () => {
    const bytes = new Uint8Array(33);
    // PNG signature
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) bytes[i] = sig[i];
    // IHDR chunk
    bytes[8] = 0x00; bytes[9] = 0x00; bytes[10] = 0x00; bytes[11] = 0x0d;
    bytes[12] = 0x49; bytes[13] = 0x48; bytes[14] = 0x44; bytes[15] = 0x52;
    // Width = 1920, Height = 1080
    bytes[16] = 0x00; bytes[17] = 0x00; bytes[18] = 0x07; bytes[19] = 0x80; // 1920
    bytes[20] = 0x00; bytes[21] = 0x00; bytes[22] = 0x04; bytes[23] = 0x38; // 1080
    bytes[24] = 8; bytes[25] = 2;

    const dims = parseImageDimensions(bytes, 'image/png');
    expect(dims).toEqual({ width: 1920, height: 1080 });
  });

  it('parses JPEG dimensions from SOF0 marker', () => {
    // Minimal JPEG: SOI (FF D8) + APP0 (FF E0) + SOF0 (FF C0) + EOI (FF D9)
    const bytes = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xe0, // APP0 marker
      0x00, 0x10, // APP0 length = 16
      0x4a, 0x46, 0x49, 0x46, 0x00, // JFIF identifier
      0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // JFIF data
      0xff, 0xc0, // SOF0 marker
      0x00, 0x11, // SOF0 length = 17
      0x08,       // precision = 8
      0x04, 0x38, // height = 1080 (big-endian)
      0x07, 0x80, // width = 1920 (big-endian)
      0x03,       // number of components = 3
      0x01, 0x11, 0x00, // component 1
      0x02, 0x11, 0x01, // component 2
      0x03, 0x11, 0x01, // component 3
      0xff, 0xd9, // EOI
    ]);

    const dims = parseImageDimensions(bytes, 'image/jpeg');
    expect(dims).toEqual({ width: 1920, height: 1080 });
  });

  it('parses GIF dimensions', () => {
    // Minimal GIF: GIF89a + logical screen descriptor
    const bytes = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      0x00, 0x02, // width = 512 (little-endian)
      0x00, 0x01, // height = 256 (little-endian)
      0x70, 0x00, 0x00, // packed fields + bg color index + aspect ratio
    ]);

    const dims = parseImageDimensions(bytes, 'image/gif');
    expect(dims).toEqual({ width: 512, height: 256 });
  });

  it('parses BMP dimensions', () => {
    // Minimal BMP: signature + header
    const bytes = new Uint8Array(30);
    bytes[0] = 0x42; bytes[1] = 0x4d; // "BM"
    // Width at offset 18 = 800 (little-endian)
    bytes[18] = 0x20; bytes[19] = 0x03; bytes[20] = 0x00; bytes[21] = 0x00;
    // Height at offset 22 = 600 (little-endian)
    bytes[22] = 0x58; bytes[23] = 0x02; bytes[24] = 0x00; bytes[25] = 0x00;

    const dims = parseImageDimensions(bytes, 'image/bmp');
    expect(dims).toEqual({ width: 800, height: 600 });
  });

  it('parses top-down BMP dimensions (negative signed height)', () => {
    // Top-down BMP stores height as a negative signed int32 (height = -600).
    const bytes = new Uint8Array(30);
    bytes[0] = 0x42; bytes[1] = 0x4d; // "BM"
    // Width at offset 18 = 800 (little-endian)
    bytes[18] = 0x20; bytes[19] = 0x03; bytes[20] = 0x00; bytes[21] = 0x00;
    // Height at offset 22 = -600 (signed int32 little-endian = 0xFFFFFDA8)
    bytes[22] = 0xa8; bytes[23] = 0xfd; bytes[24] = 0xff; bytes[25] = 0xff;

    const dims = parseImageDimensions(bytes, 'image/bmp');
    // Math.abs(-600) === 600 — must NOT be the huge unsigned value 4294966696.
    expect(dims).toEqual({ width: 800, height: 600 });
  });

  it('parses WebP VP8 dimensions', () => {
    // Minimal WebP: RIFF + WEBP + VP8 chunk
    const bytes = new Uint8Array(40);
    // RIFF header
    bytes[0] = 0x52; bytes[1] = 0x49; bytes[2] = 0x46; bytes[3] = 0x46; // "RIFF"
    bytes[4] = 0x20; bytes[5] = 0x00; bytes[6] = 0x00; bytes[7] = 0x00; // file size
    bytes[8] = 0x57; bytes[9] = 0x45; bytes[10] = 0x42; bytes[11] = 0x50; // "WEBP"
    // VP8 chunk
    bytes[12] = 0x56; bytes[13] = 0x50; bytes[14] = 0x38; bytes[15] = 0x20; // "VP8 "
    bytes[16] = 0x0a; bytes[17] = 0x00; bytes[18] = 0x00; bytes[19] = 0x00; // chunk size = 10
    // VP8 key frame header (10 bytes)
    bytes[20] = 0x9d; bytes[21] = 0x01; bytes[22] = 0x2a; // frame tag
    bytes[23] = 0x00; bytes[24] = 0x00; bytes[25] = 0x00; // padding
    // Width = ((data[6] | (data[7] << 8)) & 0x3fff) + 1
    // data[6] = bytes[26], data[7] = bytes[27]
    // 640 = 0x0280 → low 14 bits: 0x0280 → bytes[26]=0x80, bytes[27]=0x02
    bytes[26] = 0x80; bytes[27] = 0x02; // width = 0x0280 & 0x3fff = 640, +1 = 641
    // Height = ((data[8] | (data[9] << 8)) & 0x3fff) + 1
    // 480 = 0x01E0 → bytes[28]=0xE0, bytes[29]=0x01
    bytes[28] = 0xe0; bytes[29] = 0x01; // height = 0x01E0 & 0x3fff = 480, +1 = 481

    const dims = parseImageDimensions(bytes, 'image/webp');
    expect(dims).toEqual({ width: 641, height: 481 });
  });

  it('returns null for unsupported media type', () => {
    const bytes = new Uint8Array([0x00]);
    const dims = parseImageDimensions(bytes, 'image/tiff');
    expect(dims).toBeNull();
  });

  it('returns null for too-short bytes', () => {
    const bytes = new Uint8Array(2);
    const dims = parseImageDimensions(bytes, 'image/png');
    expect(dims).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AudioMinimizer
// ---------------------------------------------------------------------------

describe('AudioMinimizer', () => {
  const minimizer = new AudioMinimizer();

  /** Build a minimal WAV header with given duration.
   * RIFF header (12) + fmt chunk (24) + data chunk (8 + data).
   * Duration = dataSize / (sampleRate * channels * bitsPerSample/8) */
  function makeWavBytes(durationSeconds: number): Uint8Array {
    const sampleRate = 44100;
    const channels = 2;
    const bitsPerSample = 16;
    const bytesPerSample = channels * (bitsPerSample / 8);
    const dataSize = Math.round(durationSeconds * sampleRate * bytesPerSample);
    const totalSize = 44 + dataSize;

    const buf = new Uint8Array(totalSize);
    let offset = 0;

    // RIFF header
    buf[offset++] = 0x52; buf[offset++] = 0x49; buf[offset++] = 0x46; buf[offset++] = 0x46; // "RIFF"
    const riffSize = totalSize - 8;
    buf[offset++] = riffSize & 0xff;
    buf[offset++] = (riffSize >> 8) & 0xff;
    buf[offset++] = (riffSize >> 16) & 0xff;
    buf[offset++] = (riffSize >> 24) & 0xff;
    buf[offset++] = 0x57; buf[offset++] = 0x41; buf[offset++] = 0x56; buf[offset++] = 0x45; // "WAVE"

    // "fmt " chunk
    buf[offset++] = 0x66; buf[offset++] = 0x6d; buf[offset++] = 0x74; buf[offset++] = 0x20; // "fmt "
    const fmtSize = 16;
    buf[offset++] = fmtSize & 0xff;
    buf[offset++] = (fmtSize >> 8) & 0xff;
    buf[offset++] = (fmtSize >> 16) & 0xff;
    buf[offset++] = (fmtSize >> 24) & 0xff;
    // audioFormat = 1 (PCM)
    buf[offset++] = 0x01; buf[offset++] = 0x00;
    // channels = 2
    buf[offset++] = channels & 0xff; buf[offset++] = (channels >> 8) & 0xff;
    // sampleRate = 44100
    buf[offset++] = sampleRate & 0xff;
    buf[offset++] = (sampleRate >> 8) & 0xff;
    buf[offset++] = (sampleRate >> 16) & 0xff;
    buf[offset++] = (sampleRate >> 24) & 0xff;
    // byteRate = sampleRate * channels * bitsPerSample/8
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    buf[offset++] = byteRate & 0xff;
    buf[offset++] = (byteRate >> 8) & 0xff;
    buf[offset++] = (byteRate >> 16) & 0xff;
    buf[offset++] = (byteRate >> 24) & 0xff;
    // blockAlign = channels * bitsPerSample/8
    const blockAlign = channels * (bitsPerSample / 8);
    buf[offset++] = blockAlign & 0xff; buf[offset++] = (blockAlign >> 8) & 0xff;
    // bitsPerSample = 16
    buf[offset++] = bitsPerSample & 0xff; buf[offset++] = (bitsPerSample >> 8) & 0xff;

    // "data" chunk
    buf[offset++] = 0x64; buf[offset++] = 0x61; buf[offset++] = 0x74; buf[offset++] = 0x61; // "data"
    buf[offset++] = dataSize & 0xff;
    buf[offset++] = (dataSize >> 8) & 0xff;
    buf[offset++] = (dataSize >> 16) & 0xff;
    buf[offset++] = (dataSize >> 24) & 0xff;

    // Fill data with silence.
    for (let i = offset; i < totalSize; i++) {
      buf[i] = 0;
    }

    return buf;
  }

  it('passes through audio when no maxDuration is set', () => {
    const bytes = makeWavBytes(60);
    const artifact = makeBinaryArtifact(bytes, 'audio/wav');
    const result = minimizer.minimize(artifact, NO_LIMIT_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
  });

  it('returns minimization-unavailable for non-WAV audio with maxDuration', () => {
    const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00]); // MP3 sync
    const artifact = makeBinaryArtifact(bytes, 'audio/mpeg');
    const result = minimizer.minimize(artifact, AUDIO_SERVICE, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('minimization-unavailable');
    expect(result.detail).toContain('audio/mpeg');
  });

  it('passes through WAV within maxDuration', () => {
    const bytes = makeWavBytes(10); // 10 seconds
    const artifact = makeBinaryArtifact(bytes, 'audio/wav');
    const result = minimizer.minimize(artifact, AUDIO_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
    expect(result.artifact.contentHash).toBe(artifact.contentHash);
  });

  it('returns minimization-unavailable for WAV over maxDuration', () => {
    const bytes = makeWavBytes(60); // 60 seconds > 30
    const artifact = makeBinaryArtifact(bytes, 'audio/wav');
    const result = minimizer.minimize(artifact, AUDIO_SERVICE, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('minimization-unavailable');
    expect(result.detail).toContain('60');
    expect(result.detail).toContain('30');
  });

  it('passes through non-audio artifacts', () => {
    const artifact = makeTextArtifact('hello');
    const result = minimizer.minimize(artifact, AUDIO_SERVICE, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
  });

  it('returns validation-failed when no bytes available', () => {
    const artifact = makeTextArtifact('hello', { mediaType: 'audio/wav', bytes: undefined, contentKind: 'bytes' });
    const result = minimizer.minimize(artifact, AUDIO_SERVICE, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('validation-failed');
  });

  it('is deterministic', () => {
    const bytes = makeWavBytes(60);
    const artifact = makeBinaryArtifact(bytes, 'audio/wav');
    const r1 = minimizer.minimize(artifact, AUDIO_SERVICE, fixedClock);
    const r2 = minimizer.minimize(artifact, AUDIO_SERVICE, fixedClock);
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (r1.ok || r2.ok) return;
    expect(r1.cause).toBe(r2.cause);
    expect(r1.detail).toBe(r2.detail);
  });
});

// ---------------------------------------------------------------------------
// minimizeArtifact (registry dispatch)
// ---------------------------------------------------------------------------

describe('minimizeArtifact (registry dispatch)', () => {
  it('dispatches text artifacts to TextMinimizer', () => {
    const longText = 'x'.repeat(6000);
    const artifact = makeTextArtifact(longText);
    const result = minimizeArtifact(artifact, TEXT_SERVICE, undefined, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual(['text-truncate']);
    expect(result.artifact.text!.length).toBe(5000);
  });

  it('dispatches image artifacts to ImageMinimizer', () => {
    // Build a PNG with 5000x5000
    const bytes = new Uint8Array(33);
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) bytes[i] = sig[i];
    bytes[8] = 0x00; bytes[9] = 0x00; bytes[10] = 0x00; bytes[11] = 0x0d;
    bytes[12] = 0x49; bytes[13] = 0x48; bytes[14] = 0x44; bytes[15] = 0x52;
    bytes[16] = 0x00; bytes[17] = 0x00; bytes[18] = 0x13; bytes[19] = 0x88; // 5000
    bytes[20] = 0x00; bytes[21] = 0x00; bytes[22] = 0x13; bytes[23] = 0x88; // 5000
    bytes[24] = 8; bytes[25] = 2;

    const artifact = makeBinaryArtifact(bytes, 'image/png');
    const result = minimizeArtifact(artifact, IMAGE_SERVICE, undefined, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('minimization-unavailable');
  });

  it('passes through when no target entry is provided', () => {
    const longText = 'x'.repeat(10000);
    const artifact = makeTextArtifact(longText);
    const result = minimizeArtifact(artifact, undefined, undefined, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
    expect(result.artifact.text).toBe(longText);
  });

  it('passes through unsupported media type with no relevant limit', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02]);
    const artifact = makeBinaryArtifact(bytes, 'application/octet-stream');
    const result = minimizeArtifact(artifact, TEXT_SERVICE, undefined, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transformations).toEqual([]);
  });

  it('returns unsupported-type for media type with relevant limit but no minimizer', () => {
    // Create a custom registry without video minimizer.
    const registry = createDefaultMinimizerRegistry();
    // video/ is not registered by default.
    const bytes = new Uint8Array([0x00]);
    const artifact = makeBinaryArtifact(bytes, 'video/mp4');
    const videoService: CapabilityRegistryEntry = {
      ...TEXT_SERVICE,
      id: 'video-service',
      supportedInputs: ['video/mp4'],
      inputLimits: { maxFileSize: '100MB', maxDuration: '60' },
    };
    const result = minimizeArtifact(artifact, videoService, registry, fixedClock);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('unsupported-type');
  });

  it('is deterministic', () => {
    const longText = 'x'.repeat(6000);
    const artifact = makeTextArtifact(longText);
    const r1 = minimizeArtifact(artifact, TEXT_SERVICE, undefined, fixedClock);
    const r2 = minimizeArtifact(artifact, TEXT_SERVICE, undefined, fixedClock);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.artifact.contentHash).toBe(r2.artifact.contentHash);
    expect(r1.transformations).toEqual(r2.transformations);
  });
});

// ---------------------------------------------------------------------------
// Immutability and source identity preservation
// ---------------------------------------------------------------------------

describe('Immutability and source identity', () => {
  it('minimized artifact is frozen (immutable)', () => {
    const longText = 'x'.repeat(6000);
    const artifact = makeTextArtifact(longText);
    const result = minimizeArtifact(artifact, TEXT_SERVICE, undefined, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.artifact)).toBe(true);
    expect(Object.isFrozen(result.artifact.transformations)).toBe(true);
  });

  it('source identity is preserved after minimization', () => {
    const longText = 'x'.repeat(6000);
    const artifact = makeTextArtifact(longText);
    const result = minimizeArtifact(artifact, TEXT_SERVICE, undefined, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.reference.raw).toBe(artifact.reference.raw);
    expect(result.artifact.reference.canonical).toBe(artifact.reference.canonical);
    expect(result.artifact.sourceIdentity.canonicalPath).toBe(artifact.sourceIdentity.canonicalPath);
    expect(result.artifact.sourceIdentity.displayPath).toBe(artifact.sourceIdentity.displayPath);
    expect(result.artifact.mediaType).toBe(artifact.mediaType);
    expect(result.artifact.privacyClassification).toBe(artifact.privacyClassification);
    expect(result.artifact.compatibility).toBe(artifact.compatibility);
  });

  it('originalContentHash equals pre-minimization contentHash', () => {
    const longText = 'x'.repeat(6000);
    const artifact = makeTextArtifact(longText);
    const preHash = artifact.contentHash;
    const result = minimizeArtifact(artifact, TEXT_SERVICE, undefined, fixedClock);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.originalContentHash).toBe(preHash);
    // Post-minimization hash should be different.
    expect(result.artifact.contentHash).not.toBe(preHash);
  });

  it('original artifact is never mutated', () => {
    const longText = 'x'.repeat(6000);
    const artifact = makeTextArtifact(longText);
    const preHash = artifact.contentHash;
    const preText = artifact.text;
    minimizeArtifact(artifact, TEXT_SERVICE, undefined, fixedClock);
    // Original artifact should be unchanged.
    expect(artifact.contentHash).toBe(preHash);
    expect(artifact.text).toBe(preText);
    expect(artifact.originalContentHash).toBeUndefined();
  });
});
