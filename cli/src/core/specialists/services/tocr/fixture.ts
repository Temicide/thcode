// Reviewed T-OCR fixture for Story 4.10. Provides deterministic image bytes,
// expected recognized Thai text, and a helper to build the defined AI-for-Thai
// T-OCR response JSON for tests. No network, no Math.random, no Date.now.

// ---------------------------------------------------------------------------
// Deterministic minimal valid 1x1 red PNG (70 bytes)
// ---------------------------------------------------------------------------

export const FIXTURE_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth=8, color type=2 (RGB)
  0xDE,                                           // IHDR CRC (partial)
  0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk length + type
  0x08, 0xD7, 0x63, 0x68, 0x60, 0x60, 0x60,       // compressed data
  0x00, 0x00, 0x00, 0x04, 0x00, 0x01,             // more compressed data
  0x27, 0x53, 0x1F, 0xBC,                         // IDAT CRC
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
  0xAE, 0x42, 0x60, 0x82,                         // IEND CRC
]);

// ---------------------------------------------------------------------------
// Expected recognized Thai text
// ---------------------------------------------------------------------------

/** Expected recognized text from the T-OCR fixture. */
export const EXPECTED_TEXT = 'สวัสดีชาวโลก';

/** Expected confidence from the T-OCR fixture. */
export const EXPECTED_CONFIDENCE = 0.95;

/** Expected words from the T-OCR fixture. */
export const EXPECTED_WORDS: readonly string[] = ['สวัสดี', 'ชาวโลก'];

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

/**
 * T-OCR response shape. All fields are optional to allow tests to omit keys
 * (simulating a missing field from the service).
 */
export interface TocrResponse {
  readonly result?: string | null;
  readonly confidence?: number | null;
  readonly words?: readonly string[] | null;
}

/**
 * Build a T-OCR response object for tests. Overrides any field by passing a
 * value; pass `undefined` to omit a key from the response (simulating a
 * missing field from the service). Returns a plain object suitable for
 * JSON.stringify and InMemorySpecialistTransport.
 */
export function buildTocrResponse(
  overrides?: Partial<TocrResponse>,
): Record<string, unknown> {
  const response: Record<string, unknown> = {};

  // Only set result if not explicitly omitted (undefined = use default,
  // but we always include result by default; to omit, pass a sentinel).
  // Since we can't distinguish "not provided" from "set to undefined" in
  // a plain object, we use a simple rule: if the override key is present
  // in the overrides object (even as undefined), we respect it.
  if (overrides != null) {
    if ('result' in overrides) {
      response.result = overrides.result;
    } else {
      response.result = EXPECTED_TEXT;
    }
    if ('confidence' in overrides) {
      response.confidence = overrides.confidence;
    } else {
      response.confidence = EXPECTED_CONFIDENCE;
    }
    if ('words' in overrides) {
      response.words = overrides.words;
    } else {
      response.words = [...EXPECTED_WORDS];
    }
  } else {
    response.result = EXPECTED_TEXT;
    response.confidence = EXPECTED_CONFIDENCE;
    response.words = [...EXPECTED_WORDS];
  }

  return response;
}
