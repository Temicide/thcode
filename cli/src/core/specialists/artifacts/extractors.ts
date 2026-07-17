// Default TextExtractorRegistry with built-in UTF-8 decoders for text-like
// media types (Story 4.6). PDF/DOCX slots are left empty by default — lookup
// returns undefined, and the caller emits `extraction-unavailable`.

import type { TextExtractor, TextExtractionResult, TextExtractorRegistry } from './types.js';

// --- UTF-8 decode helper ---

/**
 * Decode a Uint8Array as UTF-8 text. Returns the decoded string on success,
 * or `null` on decode failure (malformed UTF-8).
 */
export function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

// --- Built-in text extractor ---

/**
 * Create a TextExtractor that decodes bytes as UTF-8 text.
 */
function createUtf8TextExtractor(): TextExtractor {
  return {
    extract(_mediaType: string, bytes: Uint8Array): TextExtractionResult {
      const text = decodeUtf8(bytes);
      if (text === null) {
        return { ok: false, cause: 'failed' };
      }
      return { ok: true, text };
    },
  };
}

// --- Default extractor registry ---

/**
 * Create a default TextExtractorRegistry with built-in extractors for common
 * text-like media types. PDF/DOCX/DOC slots are left empty (lookup returns
 * undefined → `extraction-unavailable`).
 */
export function createDefaultExtractorRegistry(): TextExtractorRegistry {
  const map = new Map<string, TextExtractor>();
  const utf8Extractor = createUtf8TextExtractor();

  // Register for all text-like types.
  const textLikeTypes = [
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/xml',
    'text/html',
    'text/yaml',
    'text/toml',
    'application/json',
    'application/csv',
    'application/xml',
  ];

  for (const mt of textLikeTypes) {
    map.set(mt, utf8Extractor);
  }

  return {
    register(mediaType: string, extractor: TextExtractor): void {
      map.set(mediaType, extractor);
    },
    lookup(mediaType: string): TextExtractor | undefined {
      return map.get(mediaType);
    },
  };
}
