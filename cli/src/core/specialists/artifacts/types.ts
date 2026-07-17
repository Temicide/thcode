// Specialist Artifact resolution types (Story 4.6). Immutable PreparedArtifact
// manifest, typed resolution causes, TextExtractor/registry, and privacy
// classification. Every field is readonly; the manifest is never mutated.

import type { ResourceIdentity } from '../../workspace/types.js';

// --- Privacy classification ---

export type PrivacyClassification = 'public' | 'internal' | 'secret';

// --- Content kind ---

export type ContentKind = 'bytes' | 'text';

// --- Compatibility ---

export interface ArtifactCompatibility {
  readonly status: 'compatible' | 'incompatible' | 'unverified';
  readonly matchedInput?: string;
}

// --- Reference identity ---

export interface ArtifactReference {
  /** The raw reference string as provided (e.g. `@path/to/file.txt`). */
  readonly raw: string;
  /** The canonicalized path after stripping @/quotes and resolving. */
  readonly canonical: string;
}

// --- Immutable PreparedArtifact manifest ---

export interface PreparedArtifact {
  /** The original reference and its canonical resolved path. */
  readonly reference: ArtifactReference;
  /** Full source identity from the workspace resource resolver. */
  readonly sourceIdentity: ResourceIdentity;
  /** Detected media type (e.g. `text/plain`, `image/png`). */
  readonly mediaType: string;
  /** File size in bytes (from stat). */
  readonly sizeBytes: number;
  /** SHA-256 hex digest of the content that will be transferred (bytes for
   * binary, extracted/decoded text for text-like). */
  readonly contentHash: string;
  /** Whether the transferable content is raw bytes or extracted text. */
  readonly contentKind: ContentKind;
  /** Raw file bytes (present for binary artifacts). */
  readonly bytes?: Uint8Array;
  /** Decoded/extracted text (present for text-like artifacts). */
  readonly text?: string;
  /** Extracted text when a non-native text extractor was used (e.g. PDF). */
  readonly extractedText?: string;
  /** Ordered list of transformations applied (e.g. `utf8-decode`,
   * `local-text-extraction`). Empty for raw binary passthrough. */
  readonly transformations: readonly string[];
  /** Privacy classification derived from path + media type. */
  readonly privacyClassification: PrivacyClassification;
  /** Compatibility with the target service (unverified when no target). */
  readonly compatibility: ArtifactCompatibility;
  /** ISO-8601 timestamp of when this artifact was resolved. */
  readonly createdAt: string;
}

// --- Typed resolution causes ---

export type ArtifactResolutionCause =
  | 'not-found'
  | 'out-of-bounds'
  | 'too-large'
  | 'unsupported-type'
  | 'unreadable'
  | 'privacy-blocked'
  | 'incompatible'
  | 'extraction-unavailable';

// --- Resolution result (discriminated ok union) ---

export type ArtifactResolutionResult =
  | { readonly ok: true; readonly artifact: PreparedArtifact }
  | { readonly ok: false; readonly cause: ArtifactResolutionCause; readonly detail: string };

// --- TextExtractor interface ---

export type TextExtractionResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly cause: 'unsupported' | 'failed' };

export interface TextExtractor {
  extract(mediaType: string, bytes: Uint8Array): TextExtractionResult;
}

// --- TextExtractorRegistry ---

export interface TextExtractorRegistry {
  register(mediaType: string, extractor: TextExtractor): void;
  lookup(mediaType: string): TextExtractor | undefined;
}
