// Specialist Artifact Resolver tests (Story 4.6).
// Covers every I/O matrix row + every AC with an in-memory fake FsProbe,
// injectable clock, and fake PDF extractor.

import { describe, expect, it } from 'vitest';
import { SpecialistArtifactResolver, classifyPrivacy } from '../src/core/specialists/artifacts/index.js';
import type { FsProbe } from '../src/core/workspace/types.js';
import type { CapabilityRegistryEntry } from '../src/core/specialists/registry/types.js';
import type { TextExtractorRegistry, TextExtractor, TextExtractionResult } from '../src/core/specialists/artifacts/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fixedClock = () => '2026-07-17T12:00:00.000Z';

/** In-memory fake FsProbe backed by a map of path → {bytes, stat}. */
interface FakeFileEntry {
  bytes: Uint8Array;
  stat: { dev: number; ino: number; size: number; isDirectory: boolean; isFile: boolean; isSymbolicLink: boolean };
}

function createFakeFsProbe(files: Record<string, FakeFileEntry>): FsProbe {
  return {
    realpath(path: string): string {
      return path;
    },
    lstat(path: string) {
      const entry = files[path];
      if (!entry) throw new Error(`ENOENT: ${path}`);
      return { ...entry.stat };
    },
    stat(path: string) {
      const entry = files[path];
      if (!entry) throw new Error(`ENOENT: ${path}`);
      return { dev: entry.stat.dev, ino: entry.stat.ino, size: entry.stat.size, isDirectory: entry.stat.isDirectory, isFile: entry.stat.isFile };
    },
    readlink(_path: string): string {
      throw new Error('readlink not implemented in fake');
    },
    statfs(_path: string): { type: number } | null {
      return { type: 0 };
    },
    readFile(path: string): Uint8Array {
      const entry = files[path];
      if (!entry) throw new Error(`ENOENT: ${path}`);
      return entry.bytes;
    },
  };
}

function makeFileEntry(content: string | Uint8Array, overrides: Partial<FakeFileEntry['stat']> = {}): FakeFileEntry {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  return {
    bytes,
    stat: {
      dev: 1,
      ino: 100,
      size: bytes.length,
      isDirectory: false,
      isFile: true,
      isSymbolicLink: false,
      ...overrides,
    },
  };
}

function makeDirEntry(): FakeFileEntry {
  return {
    bytes: new Uint8Array(0),
    stat: {
      dev: 1,
      ino: 200,
      size: 0,
      isDirectory: true,
      isFile: false,
      isSymbolicLink: false,
    },
  };
}

const WORKSPACE_ROOT = '/workspace';

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
  inputLimits: { maxFileSize: '5MB' },
};

const PDF_SERVICE: CapabilityRegistryEntry = {
  ...TEXT_SERVICE,
  id: 'pdf-service',
  nameEnglish: 'PDF Service',
  supportedInputs: ['application/pdf', 'text/plain'],
  inputLimits: { maxFileSize: '10MB', maxTextLength: '100000' },
};

const NO_LIMIT_SERVICE: CapabilityRegistryEntry = {
  ...TEXT_SERVICE,
  id: 'no-limit-service',
  nameEnglish: 'No Limit Service',
  supportedInputs: ['text/plain', 'image/png'],
  inputLimits: {},
};

// --- Fake PDF extractor ---

function createFakePdfExtractor(): TextExtractor {
  return {
    extract(_mediaType: string, bytes: Uint8Array): TextExtractionResult {
      // Fake PDF extraction: just decode as UTF-8 and prefix.
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return { ok: true, text: `[pdf-extracted] ${text}` };
    },
  };
}

// ---------------------------------------------------------------------------
// classifyPrivacy
// ---------------------------------------------------------------------------

describe('classifyPrivacy', () => {
  it('classifies .env as secret', () => {
    expect(classifyPrivacy('/workspace/.env')).toBe('secret');
  });

  it('classifies .env.local as secret', () => {
    expect(classifyPrivacy('/workspace/.env.local')).toBe('secret');
  });

  it('classifies .env.production as secret', () => {
    expect(classifyPrivacy('/workspace/config/.env.production')).toBe('secret');
  });

  it('classifies *.key as secret', () => {
    expect(classifyPrivacy('/workspace/keys/private.key')).toBe('secret');
  });

  it('classifies *.pem as secret', () => {
    expect(classifyPrivacy('/workspace/certs/cert.pem')).toBe('secret');
  });

  it('classifies secrets/ path as secret', () => {
    expect(classifyPrivacy('/workspace/secrets/db_password.txt')).toBe('secret');
  });

  it('classifies .ssh/ path as secret', () => {
    expect(classifyPrivacy('/workspace/.ssh/id_rsa')).toBe('secret');
  });

  it('classifies id_rsa as secret', () => {
    expect(classifyPrivacy('/workspace/.ssh/id_rsa.pub')).toBe('secret');
  });

  it('classifies normal files as internal', () => {
    expect(classifyPrivacy('/workspace/src/main.ts')).toBe('internal');
  });

  it('classifies public paths as internal (no public classification in current impl)', () => {
    expect(classifyPrivacy('/workspace/public/index.html')).toBe('internal');
  });
});

// ---------------------------------------------------------------------------
// SpecialistArtifactResolver — resolveArtifact
// ---------------------------------------------------------------------------

describe('SpecialistArtifactResolver.resolveArtifact', () => {
  // --- Plain text artifact for a text service ---

  it('resolves a plain text file for a text service', async () => {
    const fs = createFakeFsProbe({
      '/workspace/notes.txt': makeFileEntry('Hello, world!'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@notes.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.artifact;
    expect(a.mediaType).toBe('text/plain');
    expect(a.contentKind).toBe('text');
    expect(a.text).toBe('Hello, world!');
    expect(a.contentHash).toBe(sha256Str('Hello, world!'));
    expect(a.transformations).toEqual(['utf8-decode']);
    expect(a.privacyClassification).toBe('internal');
    expect(a.compatibility.status).toBe('compatible');
    expect(a.compatibility.matchedInput).toBe('text/plain');
    expect(a.reference.raw).toBe('@notes.txt');
    expect(a.reference.canonical).toBe('/workspace/notes.txt');
    expect(a.sourceIdentity.canonicalPath).toBe('/workspace/notes.txt');
    expect(a.sourceIdentity.displayPath).toBe('notes.txt');
    expect(a.sourceIdentity.type).toBe('file');
    expect(a.sourceIdentity.sizeBytes).toBe(13);
    expect(a.createdAt).toBe('2026-07-17T12:00:00.000Z');
  });

  // --- Image artifact for OCR ---

  it('resolves a PNG image for an image service', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    const fs = createFakeFsProbe({
      '/workspace/scan.png': makeFileEntry(pngBytes),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@scan.png', WORKSPACE_ROOT, IMAGE_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.artifact;
    expect(a.mediaType).toBe('image/png');
    expect(a.contentKind).toBe('bytes');
    expect(a.bytes).toEqual(pngBytes);
    expect(a.text).toBeUndefined();
    expect(a.transformations).toEqual([]);
    expect(a.compatibility.status).toBe('compatible');
    expect(a.compatibility.matchedInput).toBe('image/png');
  });

  // --- Out-of-bounds reference ---

  it('returns out-of-bounds for ../ traversal', async () => {
    const fs = createFakeFsProbe({});
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@../etc/passwd', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('out-of-bounds');
  });

  it('returns out-of-bounds for absolute path outside root', async () => {
    const fs = createFakeFsProbe({});
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('/etc/passwd', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('out-of-bounds');
  });

  // --- Missing file ---

  it('returns unreadable for a missing file (FsProbe cannot distinguish ENOENT from EACCES)', async () => {
    const fs = createFakeFsProbe({});
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@nonexistent.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('unreadable');
  });

  // --- Unreadable file (stat throws) ---

  it('returns unreadable when stat throws (permissions)', async () => {
    const fs = createFakeFsProbe({
      '/workspace/secret.txt': makeFileEntry('data'),
    });
    // Override lstat to throw for this path.
    fs.lstat = () => { throw new Error('EACCES'); };
    fs.stat = () => { throw new Error('EACCES'); };
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@secret.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('unreadable');
  });

  // --- Too large (file size > maxFileSize) ---

  it('returns too-large when file exceeds maxFileSize', async () => {
    const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
    const fs = createFakeFsProbe({
      '/workspace/large.txt': makeFileEntry(largeContent),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@large.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('too-large');
  });

  // --- Too large (text length > maxTextLength) ---

  it('returns too-large when text exceeds maxTextLength', async () => {
    const longText = 'Hello, world! '.repeat(400); // ~6000 chars
    const fs = createFakeFsProbe({
      '/workspace/long.txt': makeFileEntry(longText),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@long.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('too-large');
  });

  // --- Unsupported type ---

  it('returns unsupported-type for unknown extension', async () => {
    const fs = createFakeFsProbe({
      '/workspace/file.xyz': makeFileEntry('some data'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@file.xyz', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('unsupported-type');
  });

  // --- Incompatible (PDF for image-only service) ---

  it('returns incompatible when media type not in supportedInputs', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x68, 0x65, 0x6c, 0x6c, 0x6f]); // %PDFhello
    const fs = createFakeFsProbe({
      '/workspace/doc.pdf': makeFileEntry(pdfBytes),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@doc.pdf', WORKSPACE_ROOT, IMAGE_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('incompatible');
  });

  // --- PDF no extractor → extraction-unavailable ---

  it('returns extraction-unavailable for PDF with no extractor', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x68, 0x65, 0x6c, 0x6c, 0x6f]); // %PDFhello
    const fs = createFakeFsProbe({
      '/workspace/doc.pdf': makeFileEntry(pdfBytes),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    // Service accepts text/plain only — PDF has no text extractor by default,
    // so extraction-unavailable is expected (fail-closed; no raw-binary-as-text).
    const textOnlyService: CapabilityRegistryEntry = {
      ...TEXT_SERVICE,
      id: 'text-only',
      supportedInputs: ['text/plain'],
    };
    const result = await resolver.resolveArtifact('@doc.pdf', WORKSPACE_ROOT, textOnlyService);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('extraction-unavailable');
  });

  // --- PDF with fake extractor → extracted text ---

  it('resolves PDF with registered extractor, returns extracted text', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x68, 0x65, 0x6c, 0x6c, 0x6f]); // %PDFhello
    const fs = createFakeFsProbe({
      '/workspace/doc.pdf': makeFileEntry(pdfBytes),
    });
    const extractors = new MapTextExtractorRegistry();
    extractors.register('application/pdf', createFakePdfExtractor());
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, extractors, clock: fixedClock });
    const result = await resolver.resolveArtifact('@doc.pdf', WORKSPACE_ROOT, PDF_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.artifact;
    expect(a.mediaType).toBe('application/pdf');
    expect(a.contentKind).toBe('text');
    expect(a.text).toContain('[pdf-extracted]');
    expect(a.extractedText).toContain('[pdf-extracted]');
    expect(a.transformations).toContain('local-text-extraction');
    expect(a.compatibility.status).toBe('compatible');
    expect(a.compatibility.matchedInput).toBe('text/plain');
  });

  // --- Secret-class privacy-blocked ---

  it('returns privacy-blocked for .env file', async () => {
    const fs = createFakeFsProbe({
      '/workspace/.env': makeFileEntry('SECRET=value'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@.env', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('privacy-blocked');
  });

  it('returns privacy-blocked for id_rsa.pem', async () => {
    const fs = createFakeFsProbe({
      '/workspace/.ssh/id_rsa.pem': makeFileEntry('PRIVATE KEY'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@.ssh/id_rsa.pem', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('privacy-blocked');
  });

  it('returns privacy-blocked for secrets/x.key', async () => {
    const fs = createFakeFsProbe({
      '/workspace/secrets/x.key': makeFileEntry('key data'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@secrets/x.key', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('privacy-blocked');
  });

  // --- No service → compatibility unverified, no size enforcement ---

  it('returns unverified compatibility when no target service', async () => {
    const fs = createFakeFsProbe({
      '/workspace/notes.txt': makeFileEntry('Hello!'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@notes.txt', WORKSPACE_ROOT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.artifact;
    expect(a.compatibility.status).toBe('unverified');
    expect(a.compatibility.matchedInput).toBeUndefined();
  });

  it('skips size enforcement when no target service', async () => {
    const hugeContent = 'x'.repeat(100 * 1024 * 1024); // 100MB
    const fs = createFakeFsProbe({
      '/workspace/huge.txt': makeFileEntry(hugeContent),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@huge.txt', WORKSPACE_ROOT);

    expect(result.ok).toBe(true);
  });

  // --- Quoted reference ---

  it('resolves a quoted reference with spaces', async () => {
    const fs = createFakeFsProbe({
      '/workspace/a b/file.txt': makeFileEntry('quoted path content'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@"a b/file.txt"', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.artifact;
    expect(a.reference.canonical).toBe('/workspace/a b/file.txt');
    expect(a.text).toBe('quoted path content');
  });

  // --- URL reference → unsupported-type ---

  it('returns unsupported-type for URL reference', async () => {
    const fs = createFakeFsProbe({});
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('https://example.com/file.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('unsupported-type');
  });

  // --- Immutability ---

  it('returns a frozen (immutable) PreparedArtifact', async () => {
    const fs = createFakeFsProbe({
      '/workspace/notes.txt': makeFileEntry('immutable test'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@notes.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.artifact;
    // Object.freeze is shallow — the top-level object and arrays are frozen.
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.transformations)).toBe(true);
    // Nested objects (reference, sourceIdentity, compatibility) are not
    // frozen by the shallow freeze, but the TypeScript types enforce
    // readonly at compile time.
  });

  // --- Content hash determinism ---

  it('produces the same content hash for the same bytes', async () => {
    const fs = createFakeFsProbe({
      '/workspace/a.txt': makeFileEntry('same content'),
      '/workspace/b.txt': makeFileEntry('same content'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const r1 = await resolver.resolveArtifact('@a.txt', WORKSPACE_ROOT, TEXT_SERVICE);
    const r2 = await resolver.resolveArtifact('@b.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.artifact.contentHash).toBe(r2.artifact.contentHash);
  });

  // --- Source identity preserved ---

  it('preserves source identity (display + canonical + ResourceIdentity)', async () => {
    const fs = createFakeFsProbe({
      '/workspace/src/main.ts': makeFileEntry('console.log("hi");'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@src/main.ts', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.artifact;
    expect(a.reference.raw).toBe('@src/main.ts');
    expect(a.reference.canonical).toBe('/workspace/src/main.ts');
    expect(a.sourceIdentity.displayPath).toBe('src/main.ts');
    expect(a.sourceIdentity.canonicalPath).toBe('/workspace/src/main.ts');
    expect(a.sourceIdentity.type).toBe('file');
    expect(a.sourceIdentity.sizeBytes).toBe(18);
    expect(a.sourceIdentity.identityProven).toBe(true);
  });

  // --- No unresolved path in transferable content ---

  it('transferable content is bytes/text + hash, not the raw path', async () => {
    const fs = createFakeFsProbe({
      '/workspace/data.txt': makeFileEntry('content bytes'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@data.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.artifact;
    // The transferable content is text, not the path.
    expect(a.text).toBe('content bytes');
    expect(a.text).not.toContain('/workspace');
    // The path is in the manifest metadata, not in the transferable content.
    expect(a.reference.canonical).toBe('/workspace/data.txt');
  });

  // --- Bare path (no @ prefix) ---

  it('resolves a bare path without @ prefix', async () => {
    const fs = createFakeFsProbe({
      '/workspace/file.txt': makeFileEntry('bare path'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('file.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.text).toBe('bare path');
  });

  // --- Directory (not a regular file) ---

  it('returns unsupported-type for a directory', async () => {
    const fs = createFakeFsProbe({
      '/workspace/mydir': makeDirEntry(),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@mydir', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('unsupported-type');
  });

  // --- No fsProbe → unreadable ---

  it('returns unreadable when no fsProbe is provided', async () => {
    const resolver = new SpecialistArtifactResolver({ clock: fixedClock });
    const result = await resolver.resolveArtifact('@file.txt', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cause).toBe('unreadable');
  });

  // --- JSON file ---

  it('resolves a JSON file as text', async () => {
    const json = JSON.stringify({ key: 'value' });
    const fs = createFakeFsProbe({
      '/workspace/data.json': makeFileEntry(json),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@data.json', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.mediaType).toBe('application/json');
    expect(result.artifact.text).toBe(json);
    expect(result.artifact.contentHash).toBe(sha256Str(json));
  });

  // --- CSV file ---

  it('resolves a CSV file as text', async () => {
    const csv = 'a,b,c\n1,2,3';
    const fs = createFakeFsProbe({
      '/workspace/data.csv': makeFileEntry(csv),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@data.csv', WORKSPACE_ROOT, TEXT_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.mediaType).toBe('text/csv');
    expect(result.artifact.text).toBe(csv);
  });

  // --- No limit service → no size enforcement ---

  it('skips size enforcement when service has no limits', async () => {
    const largeContent = 'x'.repeat(100 * 1024 * 1024); // 100MB
    const fs = createFakeFsProbe({
      '/workspace/huge.txt': makeFileEntry(largeContent),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@huge.txt', WORKSPACE_ROOT, NO_LIMIT_SERVICE);

    expect(result.ok).toBe(true);
  });

  // --- Binary file (no text extraction) ---

  it('resolves a binary file without text extraction', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fs = createFakeFsProbe({
      '/workspace/image.png': makeFileEntry(pngBytes),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const result = await resolver.resolveArtifact('@image.png', WORKSPACE_ROOT, IMAGE_SERVICE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.contentKind).toBe('bytes');
    expect(result.artifact.bytes).toEqual(pngBytes);
    expect(result.artifact.text).toBeUndefined();
    expect(result.artifact.transformations).toEqual([]);
  });

  // --- Legacy resolve() method ---

  it('legacy resolve() returns ResolvedArtifact on success', async () => {
    const fs = createFakeFsProbe({
      '/workspace/notes.txt': makeFileEntry('Hello!'),
    });
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    const resolved = await resolver.resolve('@notes.txt', WORKSPACE_ROOT);

    expect(resolved.absolutePath).toBe('/workspace/notes.txt');
    expect(resolved.mediaType).toBe('text/plain');
    expect(resolved.sizeBytes).toBe(6);
  });

  it('legacy resolve() throws on failure', async () => {
    const fs = createFakeFsProbe({});
    const resolver = new SpecialistArtifactResolver({ fsProbe: fs, clock: fixedClock });
    await expect(resolver.resolve('@nonexistent.txt', WORKSPACE_ROOT)).rejects.toThrow();
  });

  // --- requestConsent stub ---

  it('requestConsent returns granted:false without throwing', async () => {
    const resolver = new SpecialistArtifactResolver({ clock: fixedClock });
    const consent = await resolver.requestConsent(
      { absolutePath: '/workspace/file.txt', mediaType: 'text/plain', sizeBytes: 10 },
      'https://example.com',
    );
    expect(consent.granted).toBe(false);
    expect(consent.destinationHost).toBe('https://example.com');
  });
});

// ---------------------------------------------------------------------------
// Helper: in-memory TextExtractorRegistry
// ---------------------------------------------------------------------------

class MapTextExtractorRegistry implements TextExtractorRegistry {
  private readonly map = new Map<string, TextExtractor>();

  register(mediaType: string, extractor: TextExtractor): void {
    this.map.set(mediaType, extractor);
  }

  lookup(mediaType: string): TextExtractor | undefined {
    return this.map.get(mediaType);
  }
}

// ---------------------------------------------------------------------------
// Helper: SHA-256
// ---------------------------------------------------------------------------

function sha256Str(s: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('node:crypto') as typeof import('node:crypto');
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
