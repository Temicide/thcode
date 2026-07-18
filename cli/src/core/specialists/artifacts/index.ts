// Specialist Artifact resolution barrel export (Story 4.6).

export {
  SpecialistArtifactResolver,
  ArtifactResolutionError,
  classifyPrivacy,
  type SpecialistArtifactResolverOptions,
} from './resolver.js';

export type {
  PreparedArtifact,
  ArtifactResolutionCause,
  ArtifactResolutionResult,
  PrivacyClassification,
  ContentKind,
  ArtifactCompatibility,
  ArtifactReference,
  TextExtractor,
  TextExtractionResult,
  TextExtractorRegistry,
} from './types.js';

export {
  detectMediaType,
  isTextLike,
  KNOWN_MEDIA_TYPES,
  EXTENSION_MAP,
} from './mediaType.js';

export {
  parseSizeLimit,
  parseTextLengthLimit,
  parseResolutionLimit,
  parseDurationLimit,
  checkSizeLimit,
} from './limits.js';

export {
  createDefaultExtractorRegistry,
  decodeUtf8,
} from './extractors.js';

export * from './minimization/index.js';
