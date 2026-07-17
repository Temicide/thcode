// SpecialistArtifactResolver: resolves explicit in-workspace references to
// immutable PreparedArtifact manifests (Story 4.6). Implements the existing
// ArtifactResolver interface from core/artifacts/types.ts. Fail-closed flow:
// containment → stat → privacy → media-type → extraction → size → compatibility
// → content hash → source identity → immutable manifest.

import { createHash } from 'node:crypto';
import { resolveWithinWorkspace, WorkspaceBoundaryError } from '../../tools/workspace.js';
import { platformForRoot } from '../../workspace/platformPath.js';
import { resolveResource } from '../../workspace/resourceResolver.js';
import type { FsProbe, WorkspaceIdentity, ResourceIdentity } from '../../workspace/types.js';
import { asWorkspaceId } from '../../workspace/types.js';
import type {
  ArtifactResolver,
  ResolvedArtifact,
  ArtifactConsent,
} from '../../artifacts/types.js';
import type {
  ArtifactResolutionResult,
  ArtifactResolutionCause,
  PreparedArtifact,
  TextExtractorRegistry,
  PrivacyClassification,
  ArtifactCompatibility,
  ArtifactReference,
  ContentKind,
} from './types.js';
import { detectMediaType, isTextLike } from './mediaType.js';
import { checkSizeLimit } from './limits.js';
import { createDefaultExtractorRegistry } from './extractors.js';
import type { CapabilityRegistryEntry } from '../registry/types.js';

// --- Privacy classification helpers ---

const SECRET_PATTERNS: readonly RegExp[] = [
  /(?:^|\/)\.[^/]*\.env(?:$|\/)/,       // .env, .env.local, .env.production
  /(?:^|\/)\.env[^/]*$/,                  // .env* at any level
  /\.key$/i,                              // *.key
  /\.pem$/i,                              // *.pem
  /(?:^|\/)secrets\//,                    // **/secrets/**
  /(?:^|\/)\.ssh\//,                      // **/.ssh/**
  /(?:^|\/)id_rsa[^/]*$/,                 // id_rsa, id_rsa.pub
];

/**
 * Classify a resolved path for privacy. Returns `'secret'` when the path
 * matches known secret patterns, `'internal'` for workspace files, or
 * `'public'` for paths that are clearly non-sensitive.
 */
export function classifyPrivacy(path: string): PrivacyClassification {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(path)) return 'secret';
  }
  return 'internal';
}

// --- SpecialistArtifactResolver ---

export interface SpecialistArtifactResolverOptions {
  readonly fsProbe?: FsProbe;
  readonly extractors?: TextExtractorRegistry;
  readonly clock?: () => string;
}

export class SpecialistArtifactResolver implements ArtifactResolver {
  private readonly fsProbe?: FsProbe;
  private readonly extractors: TextExtractorRegistry;
  private readonly clock: () => string;

  constructor(opts: SpecialistArtifactResolverOptions = {}) {
    this.fsProbe = opts.fsProbe;
    this.extractors = opts.extractors ?? createDefaultExtractorRegistry();
    this.clock = opts.clock ?? (() => new Date().toISOString());
  }

  /**
   * Resolve an explicit artifact reference within the Workspace Binding.
   * Returns a typed `ArtifactResolutionResult` — never throws for expected
   * failure causes (not-found, out-of-bounds, etc.).
   *
   * @param reference - The raw reference string (e.g. `@path/to/file.txt`,
   *   `@"path with spaces"`, or a bare path).
   * @param workspaceRoot - The canonical workspace root path.
   * @param targetEntry - Optional CapabilityRegistryEntry for size/compatibility
   *   enforcement. When omitted, compatibility is `unverified` and size checks
   *   are skipped.
   * @param opts - Additional options.
   */
  async resolveArtifact(
    reference: string,
    workspaceRoot: string,
    targetEntry?: CapabilityRegistryEntry,
    _opts?: Record<string, unknown>,
  ): Promise<ArtifactResolutionResult> {
    // Step 1: Strip leading @ and surrounding quotes → candidate path.
    const candidate = normalizeReference(reference);

    // URL references are not workspace artifacts.
    if (/^https?:\/\//i.test(candidate)) {
      return { ok: false, cause: 'unsupported-type', detail: 'URL references are not workspace artifacts.' };
    }

    // Step 2: Resolve containment within the Workspace Binding.
    let canonicalPath: string;
    try {
      canonicalPath = resolveWithinWorkspace(workspaceRoot, candidate);
    } catch (e) {
      if (e instanceof WorkspaceBoundaryError) {
        return { ok: false, cause: 'out-of-bounds', detail: e.message };
      }
      return { ok: false, cause: 'unreadable', detail: `Containment check failed: ${(e as Error).message}` };
    }

    // Step 3: Stat the file.
    if (!this.fsProbe) {
      return { ok: false, cause: 'unreadable', detail: 'No filesystem probe available.' };
    }

    let statResult: { size: number; isFile: boolean };
    try {
      const stats = this.fsProbe.lstat(canonicalPath);
      if (!stats.isFile) {
        return { ok: false, cause: 'unsupported-type', detail: 'Not a regular file.' };
      }
      statResult = { size: stats.size, isFile: true };
    } catch {
      // lstat threw — check if it's a missing file vs. permission error.
      try {
        // Try stat as a fallback (follows symlinks).
        const s = this.fsProbe.stat(canonicalPath);
        if (!s.isFile) {
          return { ok: false, cause: 'unsupported-type', detail: 'Not a regular file.' };
        }
        statResult = { size: s.size, isFile: true };
      } catch {
        return { ok: false, cause: 'not-found', detail: `File not found: ${canonicalPath}` };
      }
    }

    // Step 4: Privacy classification.
    const privacy = classifyPrivacy(canonicalPath);
    if (privacy === 'secret') {
      return { ok: false, cause: 'privacy-blocked', detail: `Secret-class artifact: ${canonicalPath}` };
    }

    // Step 5: Read file bytes.
    let bytes: Uint8Array;
    try {
      bytes = this.fsProbe.readFile(canonicalPath);
    } catch {
      return { ok: false, cause: 'unreadable', detail: `Cannot read file: ${canonicalPath}` };
    }

    // Step 6: Detect media type.
    const mediaType = detectMediaType(canonicalPath, bytes);

    // If unknown/octet-stream and no target match, fail closed.
    if (mediaType === 'application/octet-stream') {
      if (!targetEntry || !targetEntry.supportedInputs.includes(mediaType)) {
        return { ok: false, cause: 'unsupported-type', detail: `Unknown media type for: ${canonicalPath}` };
      }
    }

    // Step 7: Text extraction. Attempt extraction for any media type that has
    // a registered extractor. For text-like types without an extractor, fail
    // closed with `extraction-unavailable`. For non-text-like types without
    // an extractor, treat as raw binary.
    let text: string | undefined;
    let extractedText: string | undefined;
    const transformations: string[] = [];
    let contentKind: ContentKind;
    let contentForHash: Uint8Array | string;

    const extractor = this.extractors.lookup(mediaType);
    if (extractor) {
      const result = extractor.extract(mediaType, bytes);
      if (!result.ok) {
        if (result.cause === 'failed') {
          return { ok: false, cause: 'unreadable', detail: `Text extraction failed for: ${canonicalPath}` };
        }
        return { ok: false, cause: 'extraction-unavailable', detail: `Text extraction unavailable for: ${canonicalPath}` };
      }
      text = result.text;
      transformations.push('utf8-decode');
      contentKind = 'text';
      contentForHash = text;
    } else if (isTextLike(mediaType)) {
      // Text-like type with no registered extractor → fail closed.
      return { ok: false, cause: 'extraction-unavailable', detail: `No text extractor for ${mediaType}: ${canonicalPath}` };
    } else {
      // Binary type with no extractor → pass through as raw bytes.
      contentKind = 'bytes';
      contentForHash = bytes;
    }

    // Step 8: Size check.
    const sizeForCheck = contentKind === 'text' ? (text?.length ?? 0) : statResult.size;
    const sizeCheckKind = contentKind === 'text' ? 'text' : 'file';
    if (targetEntry) {
      const sizeResult = checkSizeLimit(sizeForCheck, targetEntry.inputLimits, sizeCheckKind);
      if (!sizeResult.ok) {
        return {
          ok: false,
          cause: 'too-large',
          detail: `Artifact exceeds ${sizeResult.kind} size limit (${sizeForCheck} > ${sizeResult.limit} bytes)`,
        };
      }
    }

    // Step 9: Compatibility check.
    let compatibility: ArtifactCompatibility;
    if (!targetEntry) {
      compatibility = { status: 'unverified' };
    } else {
      // For extracted text, prefer matching text/plain over the original
      // binary media type.
      const checkMediaType = contentKind === 'text' ? 'text/plain' : mediaType;
      const matchedInput =
        targetEntry.supportedInputs.find((si) => si === checkMediaType) ??
        targetEntry.supportedInputs.find((si) => si === mediaType);
      if (matchedInput) {
        compatibility = { status: 'compatible', matchedInput };
      } else if (contentKind === 'bytes' && !isTextLike(mediaType)) {
        // Binary file with no extractor, and the service doesn't accept this
        // media type. If the service only accepts text-like types, the file
        // can't be converted → extraction-unavailable (fail-closed; no
        // raw-binary-as-text).
        const serviceAcceptsOnlyText = targetEntry.supportedInputs.every(
          (si) => si.startsWith('text/') || si === 'application/json' || si === 'application/csv' || si === 'application/xml',
        );
        if (serviceAcceptsOnlyText) {
          return {
            ok: false,
            cause: 'extraction-unavailable',
            detail: `No text extractor for ${mediaType}: ${canonicalPath}`,
          };
        }
        return {
          ok: false,
          cause: 'incompatible',
          detail: `Media type "${mediaType}" not in supported inputs: ${targetEntry.supportedInputs.join(', ')}`,
        };
      } else {
        return {
          ok: false,
          cause: 'incompatible',
          detail: `Media type "${mediaType}" not in supported inputs: ${targetEntry.supportedInputs.join(', ')}`,
        };
      }
    }

    // Step 10: Compute SHA-256 content hash.
    const contentHash = computeContentHash(contentForHash);

    // Step 11: Build source identity via resolveResource. Path semantics follow
    // the workspace root's own platform shape, not the host process — a POSIX
    // root must resolve with POSIX separators even on a Windows host.
    const rootPlatform = platformForRoot(workspaceRoot) ?? process.platform;
    const wsIdentity: WorkspaceIdentity = {
      workspaceId: asWorkspaceId(`ws-${workspaceRoot}`),
      platform: {
        platform: rootPlatform,
        casePolicy: rootPlatform === 'win32' ? 'case-insensitive' : 'case-sensitive',
        unicodePolicy: 'unknown',
      },
      canonicalRoot: workspaceRoot,
      volumeIdentity: null,
      bindingStatus: 'bound',
      blockedReason: null,
    };

    const sourceIdentity: ResourceIdentity = resolveResource(wsIdentity, candidate, {
      fsProbe: this.fsProbe,
      computeDigest: true,
    });

    // Step 12: Build immutable PreparedArtifact.
    const referenceInfo: ArtifactReference = {
      raw: reference,
      canonical: canonicalPath,
    };

    const artifact: PreparedArtifact = Object.freeze({
      reference: referenceInfo,
      sourceIdentity,
      mediaType,
      sizeBytes: statResult.size,
      contentHash,
      contentKind,
      bytes: contentKind === 'bytes' ? bytes : undefined,
      text: contentKind === 'text' ? text : undefined,
      extractedText,
      transformations: Object.freeze(transformations),
      privacyClassification: privacy,
      compatibility,
      createdAt: this.clock(),
    });

    return { ok: true, artifact };
  }

  /**
   * Legacy ArtifactResolver.resolve — delegates to resolveArtifact and maps
   * the ok result to a ResolvedArtifact. Throws on failure (legacy interface
   * is throw-based).
   */
  async resolve(reference: string, workspaceRoot: string): Promise<ResolvedArtifact> {
    const result = await this.resolveArtifact(reference, workspaceRoot);
    if (!result.ok) {
      throw new ArtifactResolutionError(result.cause, result.detail);
    }
    return {
      absolutePath: result.artifact.sourceIdentity.canonicalPath,
      mediaType: result.artifact.mediaType,
      sizeBytes: result.artifact.sizeBytes,
    };
  }

  /**
   * Legacy ArtifactResolver.requestConsent — Story 4.8 owns real consent.
   * Returns a typed "consent-not-implemented" result without throwing.
   */
  async requestConsent(_artifact: ResolvedArtifact, _destinationHost: string): Promise<ArtifactConsent> {
    return {
      artifact: _artifact,
      destinationHost: _destinationHost,
      granted: false,
    };
  }
}

// --- Helpers ---

/**
 * Normalize a reference string: strip leading `@` and surrounding quotes.
 */
function normalizeReference(reference: string): string {
  let s = reference.trim();

  // Strip leading @.
  if (s.startsWith('@')) {
    s = s.slice(1).trimStart();
  }

  // Strip surrounding quotes (@"..." or "...").
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }

  return s;
}

/**
 * Compute a SHA-256 hex digest over bytes or a string.
 */
function computeContentHash(content: Uint8Array | string): string {
  if (typeof content === 'string') {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }
  return createHash('sha256').update(content).digest('hex');
}

// --- Typed error for legacy resolve() ---

export class ArtifactResolutionError extends Error {
  readonly resolutionCause: ArtifactResolutionCause;

  constructor(resolutionCause: ArtifactResolutionCause, detail: string) {
    super(detail);
    this.name = 'ArtifactResolutionError';
    this.resolutionCause = resolutionCause;
  }
}
