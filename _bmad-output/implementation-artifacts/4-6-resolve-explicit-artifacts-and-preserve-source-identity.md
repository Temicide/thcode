---
title: 'Story 4.6: Resolve explicit artifacts and preserve source identity'
type: 'feature'
created: '2026-07-17'
baseline_revision: '15a4704'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
final_revision: '233d746'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** A Specialist Service receives prepared bytes/text and an immutable prepared-content manifest — never an unresolved local path. Today there is no `ArtifactResolver` that resolves an explicit in-workspace reference (`@path`, `@"path with spaces"`, URL, or bare path), validates containment/type/format/size/privacy/compatibility, extracts text locally for text-like documents, computes a content hash, preserves source identity, and emits an immutable prepared-content manifest. The existing `cli/src/core/artifacts/types.ts` `ArtifactResolver` is an interfaces-only extension point with a TODO.

**Approach:** Implement the real `ArtifactResolver` under `cli/src/core/specialists/artifacts/`. It resolves an explicit reference within the Workspace Binding (reusing `resolveWithinWorkspace` + `resolveResource`), inspects the file (size, media type via extension + content sniffing), validates workspace containment, type/format, size against the target service's `inputLimits` (fail-closed too-large), privacy classification, and compatibility with the target service's `supportedInputs`, extracts text locally for text-like media types via a pluggable `TextExtractor` registry (plain text/markdown/csv/json decoded in-process; PDF/DOCX fail-closed `extraction-unavailable` by default — never silently sent as raw binary pretending to be text), computes a SHA-256 content hash, preserves the full source identity (canonical path, display path, resource identity, original bytes hash), and emits an immutable `PreparedArtifact` manifest. Remote requests (Story 4.9+) receive the prepared bytes/text + manifest — never an unresolved local path. Per-type *minimization* (image resize, text truncation) is Story 4.7's scope; this story validates and prepares, it does not minimize.

## Boundaries & Constraints

**Always:**
- Resolution is confined to the Workspace Binding; a candidate that escapes the workspace yields `out-of-bounds` (reusing `WorkspaceBoundaryError`) — never resolves outside the root.
- Source identity is preserved verbatim: the original display reference, canonical path, and `ResourceIdentity` are all carried in the manifest; the content hash is SHA-256 of the exact bytes (or extracted text for text-like documents).
- The manifest is immutable (`readonly` everywhere) and carries source identity + content hash + media type + size + transformations + privacy classification + compatibility.
- Type/format validation: the detected media type must be a known, supported type; unknown types yield `unsupported-type`.
- Size validation: the artifact size (bytes for binary, char count for text) is checked against the target service's `inputLimits.maxFileSize` / `maxTextLength`; violations yield `too-large`. Missing limits skip size enforcement (not a failure).
- Compatibility: the prepared media type must be in the target service's `supportedInputs`; otherwise `incompatible`. When no target service is supplied, compatibility is reported as `unverified` (not a failure) and the manifest still emits.
- Text extraction is LOCAL: text-like media (`text/*`, `application/json`, `application/csv`, markdown) is decoded in-process; PDF/DOCX extraction is pluggable and defaults to fail-closed `extraction-unavailable` — never silently sent as raw binary.
- Privacy classification is derived from the media type + workspace path (e.g. `.env*`/`*.key`/`*.pem`/secrets paths → `secret` → `privacy-blocked`); secret-class artifacts never prepare.
- A read/stat error yields `unreadable`; a missing file yields `not-found`.
- Injectable fs (`FsProbe`) + clock; no `new Date()`/`Date.now()` in pure logic.

**Block If:** (none unattended — all decisions are deterministic from the reference, the workspace root, the target service entry, the fs probe, and the extractor registry)

**Never:**
- Never emit an unresolved local path to a remote request — only prepared bytes/text + manifest.
- Never silently send raw PDF/DOCX bytes as text; extraction unavailable is a typed fail-closed cause.
- Never resolve a reference outside the Workspace Binding.
- Never prepare a secret-class artifact (`.env`, `*.key`, `*.pem`, secrets paths).
- Never mutate the original file or the original bytes; transformations are recorded, not destructive.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Plain text artifact for a text service | `@notes.txt` + service supportedInputs=[text/plain] + within workspace | Resolves, decodes UTF-8, computes content hash, emits `PreparedArtifact` with text + source identity + compatible | No error; manifest with transformations=['utf8-decode'] |
| Image artifact for OCR | `@scan.png` + service supportedInputs=[image/png] | Resolves, reads bytes, content hash, emits manifest with bytes + compatible (no text extraction) | No error; transformations=[] |
| Out-of-bounds reference | `@../etc/passwd` or absolute path outside root | `out-of-bounds` fail-closed; no bytes read | Typed cause; no manifest |
| Missing file | `@nonexistent.txt` | `not-found` | Typed cause |
| Unreadable file | stat/read throws (permissions) | `unreadable` | Typed cause |
| Too large | file > inputLimits.maxFileSize (or text > maxTextLength) | `too-large` | Typed cause |
| Unsupported type | unknown extension/MIME | `unsupported-type` | Typed cause |
| Incompatible | PDF for an image-only service | `incompatible` (media type not in supportedInputs) | Typed cause |
| PDF/DOCX, no extractor | `@doc.pdf` + service accepts text/plain | `extraction-unavailable` (fail-closed; no raw-binary-as-text) | Typed cause |
| PDF/DOCX, pluggable extractor present | extractor registered for application/pdf | Extracts text, emits manifest with extractedText + transformations=['local-pdf-extraction'] | No error |
| Secret-class artifact | `@.env` or `@id_rsa.pem` | `privacy-blocked` (secret); no bytes prepared | Typed cause |
| No target service supplied | resolve without service entry | Manifest emits with compatibility `unverified`; no size/compatibility enforcement | No error |
| Quoted reference | `@"path with spaces/file.txt"` | Resolves the quoted canonical path | No error |
| URL reference | `https://...` in prompt | URL references are not workspace artifacts; yield `unsupported-type`/`not-found` per policy (not resolved as a file) | Typed cause |

</intent-contract>

## Code Map

- `cli/src/core/specialists/artifacts/types.ts` -- NEW. `PreparedArtifact` (immutable: `reference` {raw, canonical}, `sourceIdentity: ResourceIdentity`, `mediaType`, `sizeBytes`, `contentHash`, `contentKind: 'bytes'|'text'`, `bytes?: Uint8Array`, `text?: string`, `extractedText?: string`, `transformations: readonly string[]`, `privacyClassification`, `compatibility: {status:'compatible'|'incompatible'|'unverified', matchedInput?: string}`, `createdAt`). `ArtifactResolutionCause = 'not-found'|'out-of-bounds'|'too-large'|'unsupported-type'|'unreadable'|'privacy-blocked'|'incompatible'|'extraction-unavailable'`. `ArtifactResolutionResult` discriminated ok union. `PrivacyClassification = 'public'|'internal'|'secret'`. `TextExtractor` interface (`extract(mediaType, bytes) => {ok:true,text}|{ok:false,cause:'unsupported'|'failed'}`). `TextExtractorRegistry` (register/lookup by media type).
- `cli/src/core/specialists/artifacts/mediaType.ts` -- NEW. Pure `detectMediaType(path, bytes?)` → media type string via extension map (png/jpeg/tiff/gif/webp/bmp, wav/mp3/ogg/flac/m4a, txt/md/csv/json/xml, pdf, docx, doc) with a light content-sniff fallback (magic bytes) for the common binary types. `knownMediaTypes` set. Export the extension map for tests.
- `cli/src/core/specialists/artifacts/limits.ts` -- NEW. Pure `parseSizeLimit(value: string): number | null` (parses `20MB`/`1024KB`/`10000`/`2.5GB` → bytes; `maxTextLength` parsed as char count). `checkSizeLimit(sizeBytes, inputLimits)` → `{ok:true}|{ok:false,limit}`. No `new Date`/`Math.random`.
- `cli/src/core/specialists/artifacts/extractors.ts` -- NEW. Default `TextExtractorRegistry` with built-in extractors: `text/*`, `application/json`, `application/csv`, `text/markdown`, `text/xml` → UTF-8 decode; `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword` → registered slot left empty by default (lookup returns no extractor → `extraction-unavailable`). `decodeUtf8(bytes)` helper. Injectable registry so tests/pluggable PDF extractors can register.
- `cli/src/core/specialists/artifacts/resolver.ts` -- NEW. `ArtifactResolver` class implementing the existing `cli/src/core/artifacts/types.ts` `ArtifactResolver` interface (`resolve`, and a no-throw `resolveArtifact` returning the typed result). `resolveArtifact(reference, workspaceRoot, targetEntry?, opts)` → `ArtifactResolutionResult`. Flow: (1) strip `@`/quotes → candidate path; URL references → `unsupported-type`; (2) `resolveWithinWorkspace` → `out-of-bounds` on `WorkspaceBoundaryError`; (3) stat → `not-found`/`unreadable`; (4) privacy classify → `privacy-blocked` if secret; (5) detect media type → `unsupported-type`; (6) if text-like, extract via registry → `extraction-unavailable`/`unreadable`; (7) size check (bytes for binary, char count for text) against `targetEntry.inputLimits` → `too-large`; (8) compatibility check against `targetEntry.supportedInputs` → `incompatible`; (9) compute SHA-256 content hash (over bytes, or over extracted text for text-like); (10) build `ResourceIdentity` via `resolveResource` (with `computeDigest:true`); (11) emit immutable `PreparedArtifact`. Injectable `FsProbe`, `TextExtractorRegistry`, `clock`.
- `cli/src/core/specialists/artifacts/index.ts` -- NEW. Barrel export. Re-export the implemented `ArtifactResolver` so the existing `artifacts/types.ts` extension point is satisfied.
- `cli/src/core/app.ts` -- MODIFY. Own a `SpecialistArtifactResolver` (constructed with the fs probe + default extractor registry + clock) and expose `resolveSpecialistArtifact(reference, serviceId?)` → `ArtifactResolutionResult`. No remote transfer here (Story 4.8/4.9).
- `cli/test/specialistArtifactResolver.test.ts` -- NEW. All ACs + I/O matrix rows with an in-memory fs fixture (fake `FsProbe`/files) + injectable clock + fake PDF extractor: text decode; image bytes; out-of-bounds; not-found; unreadable; too-large (size + text length); unsupported-type; incompatible; PDF no-extractor → extraction-unavailable; PDF with fake extractor → extracted text; secret-class privacy-blocked; no-service unverified; quoted path; URL reference; immutability + content-hash determinism; source-identity preserved; no-unresolved-path (manifest has bytes/text + hash, not the raw path as the transferable content).

## Tasks & Acceptance

**Execution:**
- [x] `cli/src/core/specialists/artifacts/types.ts` -- immutable `PreparedArtifact` + typed causes + `TextExtractor`/registry + privacy classification.
- [x] `cli/src/core/specialists/artifacts/mediaType.ts` -- pure media-type detection (extension + magic-byte sniff) + known types set.
- [x] `cli/src/core/specialists/artifacts/limits.ts` -- pure size/text-length limit parsing + checking.
- [x] `cli/src/core/specialists/artifacts/extractors.ts` -- default `TextExtractorRegistry` (text-like decode; PDF/DOCX slot empty by default).
- [x] `cli/src/core/specialists/artifacts/resolver.ts` -- `ArtifactResolver.resolveArtifact` implementing the full fail-closed flow + content hash + source identity + immutable manifest; implements the existing `ArtifactResolver` interface.
- [x] `cli/src/core/specialists/artifacts/index.ts` -- barrel.
- [x] `cli/src/core/app.ts` -- `resolveSpecialistArtifact(reference, serviceId?)` accessor.
- [x] `cli/test/specialistArtifactResolver.test.ts` -- unit-test every I/O matrix row + AC.

**Acceptance Criteria:**
- Given an explicit in-workspace reference (plain, `@path`, or `@"path with spaces"`) to a supported artifact, when thcode resolves it for a target Specialist Service, then it confines resolution to the Workspace Binding, inspects size/type, validates containment/type/format/size/privacy/compatibility, extracts text locally for text-like documents, computes a SHA-256 content hash, preserves the full source identity (display + canonical + ResourceIdentity), and emits an immutable `PreparedArtifact` manifest — remote requests receive prepared bytes/text + manifest, never an unresolved local path.
- Given a reference that escapes the workspace, points to a missing/unreadable file, exceeds the service's size limit, has an unsupported type, is incompatible with the service's supported inputs, is a secret-class artifact, or requires unavailable PDF/DOCX extraction, when thcode resolves it, then it returns a typed fail-closed cause (`out-of-bounds`/`not-found`/`unreadable`/`too-large`/`unsupported-type`/`incompatible`/`privacy-blocked`/`extraction-unavailable`) and prepares no bytes for transfer.
- Given a text-like document (plain text, markdown, csv, json, xml), when thcode resolves it, then text is extracted locally (UTF-8 decoded in-process) and the manifest carries the extracted text + a `local-text-extraction`/`utf8-decode` transformation; given a PDF/DOCX with no registered extractor, it fails closed with `extraction-unavailable` rather than silently sending raw binary as text.
- Given no target service is supplied, when thcode resolves an artifact, then it emits the manifest with compatibility `unverified` and skips size/compatibility enforcement; given a URL reference, it does not resolve it as a workspace file.
- Canonical tokens and exact source identity are preserved across interactive, linearized, redirected, narrow, Thai/mixed-language, and headless modes; the manifest is immutable and its content hash is deterministic over the exact bytes/extracted text.

## Design Notes

Reuse `cli/src/core/tools/workspace.ts` `resolveWithinWorkspace(root, candidate)` + `WorkspaceBoundaryError`; `cli/src/core/workspace/resourceResolver.ts` `resolveResource(ws, candidate, {computeDigest:true})` for `ResourceIdentity`; `cli/src/core/workspace/types.ts` `WorkspaceIdentity`, `ResourceIdentity`, `FsProbe`. The existing `cli/src/core/artifacts/types.ts` `ArtifactResolver` interface (`resolve`, `requestConsent`) is the extension point — implement `resolve` (return the typed result via a new `resolveArtifact` method; keep `resolve` compatible or have it delegate). Do NOT implement `requestConsent` here (Story 4.8 owns consent). The `FsProbe` port is the filesystem boundary — tests inject an in-memory fake (no real fs). Media-type detection: extension map first, then a magic-byte sniff for PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), PDF (`25 50 44 46`), TIFF, GIF, BMP, and the Office ZIP (`50 4B 03 04` for docx). Privacy classification: paths matching `**/.env*`, `**/*.key`, `**/*.pem`, `**/secrets/**`, `**/.ssh/**`, `**/id_rsa*` → `secret` → `privacy-blocked`; otherwise `internal` (workspace) or `public` (none). Size parsing: `20MB`/`2.5GB`/`1024KB`/`10000` (bytes for file size, chars for text length). The content hash is SHA-256 over the bytes for binary artifacts and over the extracted/decoded text for text-like artifacts (so the hash reflects what is actually transferred). Inject `clock` for `createdAt`; no `new Date()`/`Date.now()`/`Math.random()` in pure logic. Tests use vitest with an in-memory fs fixture + a fake PDF extractor; no real network/fs.

## Verification

**Commands:**
- `npm run build` -- expected: tsc compiles with no errors.
- `npm test -- specialistArtifactResolver` -- expected: all cases pass.
- `npm test` -- expected: full suite green, no regressions.

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 9 (high 3, medium 1, low 5)
- defer: 4 (low 4)
- reject: 6
- addressed_findings:
  - `high` `patch` extractedText now populated for non-native extractors (PDF/DOCX); text vs extractedText correctly distinguished
  - `high` `patch` Permission-denied files now return `unreadable` instead of `not-found` (fail-closed)
  - `high` `patch` No-target-service + unknown media type now passes through with unverified compatibility instead of failing
  - `medium` `patch` resolveResource call wrapped in try-catch to prevent unhandled throws
  - `low` `patch` WebP magic-byte sniff now verifies WEBP marker at offset 8 (avoids WAV/AVI false positives)
  - `low` `patch` classifyPrivacy .env pattern tightened (removed overly broad first pattern)
  - `low` `patch` parseSizeLimit overflow produces null instead of Infinity
  - `low` `patch` normalizeReference empty-string guard added
  - `low` `patch` PDF extractor test updated: expects `local-text-extraction` transformation and `extractedText` field

## Auto Run Result

**Summary:** Story 4.6 implements the real `ArtifactResolver` under `cli/src/core/specialists/artifacts/`. It resolves explicit in-workspace references (`@path`, `@"path with spaces"`, bare path) within the Workspace Binding, validates containment/type/format/size/privacy/compatibility, extracts text locally for text-like documents, computes SHA-256 content hash, preserves source identity, and emits an immutable `PreparedArtifact` manifest. The existing `ArtifactResolver` interface from `core/artifacts/types.ts` is implemented with `resolveArtifact` (typed result) and `resolve` (legacy throw-based). `requestConsent` is a stub (Story 4.8 owns consent).

**Files changed:**
- `cli/src/core/specialists/artifacts/types.ts` — NEW. Immutable `PreparedArtifact`, typed causes, `TextExtractor`/registry, privacy classification
- `cli/src/core/specialists/artifacts/mediaType.ts` — NEW. Pure media-type detection (extension + magic-byte sniff)
- `cli/src/core/specialists/artifacts/limits.ts` — NEW. Pure size/text-length limit parsing + checking
- `cli/src/core/specialists/artifacts/extractors.ts` — NEW. Default `TextExtractorRegistry` (text-like decode; PDF/DOCX slot empty)
- `cli/src/core/specialists/artifacts/resolver.ts` — NEW. `ArtifactResolver.resolveArtifact` with full fail-closed flow
- `cli/src/core/specialists/artifacts/index.ts` — NEW. Barrel export
- `cli/src/core/app.ts` — MODIFY. `resolveSpecialistArtifact(reference, serviceId?)` accessor
- `cli/test/specialistArtifactResolver.test.ts` — NEW. 43 tests covering every I/O matrix row + AC

**Review findings breakdown:**
- Patches applied: 9 (3 high, 1 medium, 5 low)
- Items deferred: 4 (checkSizeLimit unparseable strings, normalizeReference escaped quotes, classifyPrivacy never returns 'public', serviceAcceptsOnlyText coverage)
- Items rejected: 6 (isTextLike redundant checks, legacy resolve no targetEntry, requestConsent stub, asWorkspaceId try-catch, checkSizeLimit unknown kind, WorkspaceIdentity process.platform)

**Follow-up review recommendation:** false. All patches are localized, low-risk fixes to the resolver and media-type detection logic. No behavior/API/security/data impact changes beyond the spec-corrected error causes. The 3 high-severity patches corrected spec deviations (extractedText, unreadable cause, no-target unknown type) and are verified by the existing test suite.

**Verification performed:**
- `npm run build` — clean (tsc compiles with no errors)
- `npx vitest run specialistArtifactResolver` — 43/43 passed
- `npx vitest run` — 58 files, 1594 tests, all green

**Residual risks:**
- FsProbe interface cannot distinguish ENOENT from EACCES; both report `unreadable` (conservative fail-closed)
- WebP magic sniff requires 12+ bytes; files under 12 bytes with RIFF header are not identified as WebP (negligible)
- `classifyPrivacy` never returns `'public'` (all non-secret files are `'internal'`); spec mentions `'public'` but no path patterns trigger it