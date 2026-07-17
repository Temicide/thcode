// Inspection types for bounded, identity-validated, PEP-mediated, sanitized
// workspace inspection (Story 3.4, AD-4, AD-12, AD-13, AD-24, AD-27).
// Discriminated unions, opaque branded ids, no `any`. Every refusal uses a
// typed discriminated union. AD-9 failures are deterministic.

import type { FsProbe, ResourceType } from '../workspace/types.js';

// ---------------------------------------------------------------------------
// Inspection-specific fs probe (extends FsProbe with readdir/readFile)
// ---------------------------------------------------------------------------

export interface InspectionFsProbe extends FsProbe {
  readdirSync(path: string): string[];
  readFileSync(path: string): Buffer;
}

/**
 * Create a default InspectionFsProbe backed by the real node:fs module.
 * Wraps the default FsProbe with readdirSync and readFileSync.
 */
export function defaultInspectionFsProbe(): InspectionFsProbe {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeFs = require('node:fs') as typeof import('node:fs');
  return {
    realpath(p: string): string {
      return fs.realpathSync(p);
    },
    lstat(p: string) {
      const s = fs.lstatSync(p);
      return {
        dev: s.dev,
        ino: s.ino,
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
        isSymbolicLink: s.isSymbolicLink(),
      };
    },
    stat(p: string) {
      const s = fs.statSync(p);
      return {
        dev: s.dev,
        ino: s.ino,
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
      };
    },
    readlink(p: string): string {
      return fs.readlinkSync(p);
    },
    statfs(p: string): { type: number } | null {
      try {
        const s = fs.statfsSync(p);
        return { type: s.type };
      } catch {
        return null;
      }
    },
    readdirSync(p: string): string[] {
      return nodeFs.readdirSync(p);
    },
    readFileSync(p: string): Buffer {
      return nodeFs.readFileSync(p);
    },
  };
}

// ---------------------------------------------------------------------------
// Inspection limits
// ---------------------------------------------------------------------------

export interface InspectionLimits {
  readonly maxRecursionDepth: number;
  readonly maxFileCount: number;
  readonly maxTextBytes: number;
  readonly maxSearchWork: number;
  readonly maxFileSize: number;
}

export const DEFAULT_INSPECTION_LIMITS: InspectionLimits = {
  maxRecursionDepth: 5,
  maxFileCount: 1000,
  maxTextBytes: 256 * 1024,
  maxSearchWork: 5000,
  maxFileSize: 512 * 1024,
};

// ---------------------------------------------------------------------------
// Inspection request
// ---------------------------------------------------------------------------

export type InspectionKind = 'list' | 'read' | 'search';

export interface ListRequest {
  readonly kind: 'list';
  readonly path: string;
}

export interface ReadRequest {
  readonly kind: 'read';
  readonly path: string;
}

export interface SearchRequest {
  readonly kind: 'search';
  readonly query: string;
  readonly path?: string;
}

export type InspectionRequest = ListRequest | ReadRequest | SearchRequest;

// ---------------------------------------------------------------------------
// Inspection refusal (discriminated union — AD-9)
// ---------------------------------------------------------------------------

export type InspectionRefusalKind =
  | 'denied'
  | 'inaccessible'
  | 'conflict'
  | 'enforcement-unverified'
  | 'over-limit'
  | 'binary-refused'
  | 'malformed-utf8';

export interface DeniedRefusal {
  readonly kind: 'denied';
  readonly reason: string;
  readonly nextStep: string;
}

export interface InaccessibleRefusal {
  readonly kind: 'inaccessible';
  readonly reason: string;
  readonly nextStep: string;
}

export interface ConflictRefusal {
  readonly kind: 'conflict';
  readonly reason: string;
  readonly nextStep: string;
}

export interface EnforcementUnverifiedRefusal {
  readonly kind: 'enforcement-unverified';
  readonly reason: string;
  readonly nextStep: string;
}

export interface OverLimitRefusal {
  readonly kind: 'over-limit';
  readonly reason: string;
  readonly limit: string;
  readonly actual: number;
  readonly nextStep: string;
}

export interface BinaryRefusedRefusal {
  readonly kind: 'binary-refused';
  readonly reason: string;
  readonly path: string;
  readonly nextStep: string;
}

export interface MalformedUtf8Refusal {
  readonly kind: 'malformed-utf8';
  readonly reason: string;
  readonly path: string;
  readonly nextStep: string;
}

export type InspectionRefusal =
  | DeniedRefusal
  | InaccessibleRefusal
  | ConflictRefusal
  | EnforcementUnverifiedRefusal
  | OverLimitRefusal
  | BinaryRefusedRefusal
  | MalformedUtf8Refusal;

// ---------------------------------------------------------------------------
// Entry metadata (sanitized — path/type/size/digest)
// ---------------------------------------------------------------------------

export interface EntryMetadata {
  readonly path: string;
  readonly type: ResourceType;
  readonly sizeBytes: number | null;
  readonly digest: string | null;
}

// ---------------------------------------------------------------------------
// Successful inspection results
// ---------------------------------------------------------------------------

export interface ListResult {
  readonly outcome: 'allowed';
  readonly kind: 'list';
  readonly entries: readonly EntryMetadata[];
  readonly truncated: boolean;
  readonly totalEntries: number;
}

export interface ReadResult {
  readonly outcome: 'allowed';
  readonly kind: 'read';
  readonly content: string;
  readonly metadata: EntryMetadata;
  readonly truncated: boolean;
}

export interface SearchMatch {
  readonly path: string;
  readonly lineNumber: number;
  readonly text: string;
}

export interface SearchResult {
  readonly outcome: 'allowed';
  readonly kind: 'search';
  readonly matches: readonly SearchMatch[];
  readonly truncated: boolean;
  readonly totalMatches: number;
  readonly filesSearched: number;
}

export type InspectionSuccess = ListResult | ReadResult | SearchResult;

// ---------------------------------------------------------------------------
// Top-level inspection result
// ---------------------------------------------------------------------------

export interface InspectionResult {
  readonly ok: boolean;
  readonly result: InspectionSuccess | null;
  readonly refusal: InspectionRefusal | null;
}
