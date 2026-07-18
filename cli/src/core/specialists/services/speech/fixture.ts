// Reviewed Speech-to-Text fixture for Story 4.11. Provides deterministic minimal
// WAV bytes (valid WAV header + tiny silent zero PCM chunk), expected Thai
// transcript, expected segments, and a helper to build the defined AI-for-Thai
// Speech-to-Text response JSON for tests. No network, no Math.random, no Date.now.

// ---------------------------------------------------------------------------
// Deterministic minimal valid WAV bytes (44-byte header + 200 zero PCM bytes)
// ---------------------------------------------------------------------------
// WAV: RIFF header, fmt chunk (PCM, mono, 8000 Hz, 16-bit), data chunk with
// 100 zero samples (200 bytes). Total = 244 bytes.

const WAV_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0xEC, 0x00, 0x00, 0x00, // chunk size = 236 (244 - 8), LE
  0x57, 0x41, 0x56, 0x45, // "WAVE"
  0x66, 0x6D, 0x74, 0x20, // "fmt "
  0x10, 0x00, 0x00, 0x00, // chunk size = 16 (PCM), LE
  0x01, 0x00,             // audio format = 1 (PCM), LE
  0x01, 0x00,             // channels = 1 (mono), LE
  0x40, 0x1F, 0x00, 0x00, // sample rate = 8000, LE
  0x80, 0x3E, 0x00, 0x00, // byte rate = 16000, LE
  0x02, 0x00,             // block align = 2, LE
  0x10, 0x00,             // bits per sample = 16, LE
  0x64, 0x61, 0x74, 0x61, // "data"
  0xC8, 0x00, 0x00, 0x00, // data chunk size = 200, LE
]);

const WAV_PCM_ZEROS = new Uint8Array(200); // 100 zero samples (16-bit mono)

export const FIXTURE_WAV_BYTES = new Uint8Array([...WAV_HEADER, ...WAV_PCM_ZEROS]);

// ---------------------------------------------------------------------------
// Expected Thai transcript and segments
// ---------------------------------------------------------------------------

/** Expected transcript from the Speech-to-Text fixture. */
export const EXPECTED_TRANSCRIPT = 'สวัสดีชาวโลก';

/** Expected confidence from the Speech-to-Text fixture. */
export const EXPECTED_CONFIDENCE = 0.92;

/** Expected segments from the Speech-to-Text fixture. */
export const EXPECTED_SEGMENTS: readonly SpeechSegment[] = [
  { text: 'สวัสดี', start: 0.0, end: 0.8 },
  { text: 'ชาวโลก', start: 0.9, end: 1.5 },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single segment in the Speech-to-Text response. */
export interface SpeechSegment {
  readonly text: string;
  readonly start?: number;
  readonly end?: number;
}

/**
 * Speech-to-Text response shape. All fields are optional to allow tests to omit
 * keys (simulating a missing field from the service).
 */
export interface SpeechResponse {
  readonly transcript?: string | null;
  readonly segments?: readonly SpeechSegment[] | null;
  readonly confidence?: number | null;
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

/**
 * Build a Speech-to-Text response object for tests. Overrides any field by
 * passing a value; pass `undefined` to omit a key from the response (simulating
 * a missing field from the service). Returns a plain object suitable for
 * JSON.stringify and InMemorySpecialistTransport.
 */
export function buildSpeechResponse(
  overrides?: Partial<SpeechResponse>,
): Record<string, unknown> {
  const response: Record<string, unknown> = {};

  if (overrides != null) {
    if ('transcript' in overrides) {
      response.transcript = overrides.transcript;
    } else {
      response.transcript = EXPECTED_TRANSCRIPT;
    }
    if ('segments' in overrides) {
      response.segments = overrides.segments;
    } else {
      response.segments = EXPECTED_SEGMENTS.map(s => ({ ...s }));
    }
    if ('confidence' in overrides) {
      response.confidence = overrides.confidence;
    } else {
      response.confidence = EXPECTED_CONFIDENCE;
    }
  } else {
    response.transcript = EXPECTED_TRANSCRIPT;
    response.segments = EXPECTED_SEGMENTS.map(s => ({ ...s }));
    response.confidence = EXPECTED_CONFIDENCE;
  }

  return response;
}
