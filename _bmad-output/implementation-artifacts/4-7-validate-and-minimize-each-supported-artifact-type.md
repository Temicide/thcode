---
title: 'Story 4.7: Validate and minimize each supported artifact type'
type: 'feature'
created: '2026-07-17'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Story 4.6 prepares an artifact and fail-closes when it EXCEEDS a service's input limits (`too-large`). But the epic requires that supported artifacts be VALIDATED per-type (image resolution, audio duration, text length) and MINIMIZED to fit the service's constraints where possible — producing a new immutable prepared artifact with the minimization recorded as a transformation, rather than rejecting outright whenever minimization is feasible. Today there is no per-type minimizer: text cannot be safely truncated (Thai grapheme clusters would be split), image resolution cannot be validated against `maxResolution`, and over-limit binary artifacts cannot be honestly reported as `minimization-unavailable` (fail-closed, never silently sent over-limit).

**Approach:** Add a per-type artifact minimizer under `cli/src/core/specialists/artifacts/minimization/`. A `ArtifactMinimizerRegistry` selects a minimizer by media-type family. `TextMinimizer` is fully implemented (grapheme-aware truncation via `Intl.Segmenter` so Thai combining/tone marks are never split, records a `text-truncate` transformation, recomputes the content hash). `ImageMinimizer` parses PNG/JPEG/GIF/BMP/WebP dimensions from header bytes (pure, no image lib), validates against `inputLimits.maxResolution` (`WxH`), and fail-closes with `minimization-unavailable` when the image exceeds the resolution limit (downscaling needs an image library not bundled in Release 1 — never silently sent over-limit). `AudioMinimizer` pass-through validates: when `inputLimits.maxDuration` is present and the duration cannot be reliably measured without a codec library, it fail-closes `minimization-unavailable`; otherwise pass-through. The minimizer produces a new immutable `PreparedArtifact` (minimized) with the transformation recorded and the content hash recomputed over the minimized content; the original source identity is preserved. All minimization is pure/local — no remote call, no `new Date()`/`Math.random()`.

## Boundaries & Constraints

**Always:**
- Minimization is pure and local; no remote call, no network, no fs write. The minimizer reads the already-prepared artifact's bytes/text and produces a new immutable manifest.
- An over-limit artifact is NEVER silently sent: if minimization is feasible (text truncation), it is applied; if not (image downscale, audio transcode without a bundled lib), the result is a typed `minimization-unavailable` fail-closed cause — never a silent pass-through of over-limit bytes.
- Text truncation is grapheme-aware: uses `Intl.Segmenter({granularity:'grapheme'})` so Thai base+combining+tone mark clusters (e.g. `กี้`) are never split mid-cluster; the truncation point is the last grapheme boundary at or before `maxTextLength` characters (counted by UTF-16 code units? — NO: counted by grapheme clusters to respect Thai; see Design Notes).
- The minimized manifest is immutable (`readonly`/`Object.freeze`), carries the new content hash over the minimized content, records the transformation (`text-truncate`, `image-resize-skipped`, etc.), and PRESERVES the original source identity (canonical path, display path, ResourceIdentity, original content hash is kept as `originalContentHash`).
- Validation per type: image dimensions vs `maxResolution`; text length vs `maxTextLength`; audio duration vs `maxDuration` (when measurable). A within-limit artifact passes through with `transformations: []` (no-op) and the original content hash.
- Missing/unparseable limits → skip that check (pass-through, not a failure), matching Story 4.6's limit semantics.
- The minimizer never mutates the input artifact; it returns a new manifest.
- Injectable clock for `createdAt`; no `new Date()`/`Date.now()`/`Math.random()` in pure logic.

**Block If:** (none unattended — deterministic from the prepared artifact + the target service's inputLimits)

**Never:**
- Never silently send an over-limit artifact.
- Never split a Thai grapheme cluster during text truncation.
- Never claim minimization succeeded when it didn't; over-limit + no minimizer → `minimization-unavailable`.
- Never mutate the original artifact or write to the filesystem.
- Never invent a content hash; the minimized manifest's hash is recomputed over the actual minimized content.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Text within limit | text length ≤ maxTextLength | Pass-through; `transformations:[]`; same content hash | No error |
| Text over limit, truncatable | text length > maxTextLength | Truncate at last grapheme boundary ≤ limit; `transformations:['text-truncate']`; recomputed hash; `originalContentHash` preserved | No error; minimized manifest |
| Text over limit, Thai graphemes | Thai text with combining/tone marks exceeding limit | Truncates at grapheme cluster boundary; no split marks; valid Thai remains | No error; no corrupted cluster |
| Text over limit, no maxTextLength set | inputLimits has no maxTextLength | Pass-through (skip) | No error |
| Image within resolution | PNG 2000x2000, maxResolution=4000x4000 | Pass-through; `transformations:[]` | No error |
| Image over resolution | PNG 5000x5000, maxResolution=4000x4000 | `minimization-unavailable` (can't downscale without lib); detail with measured dims vs limit | Typed cause; no over-limit send |
| Image, no maxResolution set | inputLimits has no maxResolution | Pass-through (skip dimension check) | No error |
| Unparseable image header | corrupt/truncated image bytes | `validation-failed` (cannot read dimensions); fail-closed | Typed cause |
| Audio, no maxDuration set | audio bytes, no duration limit | Pass-through | No error |
| Audio, maxDuration set, duration unmeasurable | audio/mp3 with maxDuration=30s | `minimization-unavailable` (duration can't be measured without codec lib) | Typed cause |
| Audio WAV with maxDuration, duration measurable | WAV bytes, maxDuration set, duration parseable from header | Validate duration; over → `minimization-unavailable`; within → pass-through | Typed cause or pass-through |
| Unsupported media type family | media type with no registered minimizer | Pass-through with `transformations:[]` (no per-type limits to enforce) OR `unsupported-type` if a limit is set that can't be validated — prefer pass-through when no relevant limit | No error |
| No target service | minimize without targetEntry | Pass-through; `compatibility` unchanged | No error |
| Determinism | same input twice | Identical minimized manifest (same hash, same transformations) | Deterministic |

</intent-contract>

## Code Map

- `cli/src/core/specialists/artifacts/minimization/types.ts` -- NEW. `MinimizationResult` discriminated union: `{ok:true, artifact: PreparedArtifact, transformations: readonly string[]}` | `{ok:false, cause:'minimization-unavailable'|'validation-failed'|'unsupported-type', detail}`. `ArtifactMinimizer` interface `minimize(artifact, targetEntry?): MinimizationResult` (sync, pure). `ArtifactMinimizerRegistry` `register(mediaTypePrefix, minimizer)` / `resolve(mediaType): ArtifactMinimizer | undefined`.
- `cli/src/core/specialists/artifacts/minimization/textMinimizer.ts` -- NEW. `TextMinimizer` — grapheme-aware truncation. `truncateTextAtGrapheme(text, maxChars): {text, truncated:boolean}` using `Intl.Segmenter({granularity:'grapheme'})`; counts grapheme clusters (NOT UTF-16 code units) so Thai is respected; truncates at the boundary ≤ maxChars. Recomputes SHA-256 over the truncated text; builds a new immutable `PreparedArtifact` preserving source identity + `originalContentHash` (add `originalContentHash?: string` to `PreparedArtifact` in `../types.ts` — see below). Records `text-truncate` when truncated, else no-op.
- `cli/src/core/specialists/artifacts/minimization/imageMinimizer.ts` -- NEW. `ImageMinimizer` — pure dimension parsing: `parseImageDimensions(bytes, mediaType): {width,height}|null` for PNG (IHDR at offset 16), JPEG (SOF0/C0 markers), GIF (logical screen descriptor), BMP (header), WebP (VP8/VP8L/VP8X). Validates against `parseResolutionLimit(inputLimits.maxResolution)` (`WxH` → {width,height}). Within → pass-through; over → `minimization-unavailable` with measured-vs-limit detail; unparseable header → `validation-failed`. No downscale (no image lib in Release 1).
- `cli/src/core/specialists/artifacts/minimization/audioMinimizer.ts` -- NEW. `AudioMinimizer` — for WAV (`audio/wav`), parse duration from the RIFF header (data chunk size / sampleRate / channels / bitsPerSample); for other audio types, duration is not measurable without a codec lib. If `inputLimits.maxDuration` is set: WAV → measure + validate (over → `minimization-unavailable`); non-WAV → `minimization-unavailable` (can't measure). If no `maxDuration` → pass-through.
- `cli/src/core/specialists/artifacts/minimization/registry.ts` -- NEW. `createDefaultMinimizerRegistry()` registering `text/`→TextMinimizer, `image/`→ImageMinimizer, `audio/`→AudioMinimizer. `minimizeArtifact(artifact, targetEntry?, registry?): MinimizationResult` — resolves the minimizer by media-type prefix; no minimizer + no relevant limit → pass-through (returns the artifact unchanged with `transformations:[]`); no minimizer + a relevant limit that can't be enforced → `unsupported-type`.
- `cli/src/core/specialists/artifacts/minimization/index.ts` -- NEW. Barrel.
- `cli/src/core/specialists/artifacts/types.ts` -- MODIFY. Add `originalContentHash?: string` to `PreparedArtifact` (the hash before minimization; the main `contentHash` is the post-minimization hash).
- `cli/src/core/specialists/artifacts/resolver.ts` -- MODIFY (minimal). After building the `PreparedArtifact` in `resolveArtifact`, the resolver does NOT minimize (4.6 contract unchanged); expose the prepared artifact. Minimization is a separate explicit step (4.7) invoked by the caller (app.ts / 4.9 adapter). Optionally: if `targetEntry` is supplied and the artifact is over a text/image limit, the resolver may OPTIONALLY call the minimizer to return the minimized manifest directly — but PREFER keeping 4.6's fail-closed `too-large` behavior and let the caller minimize explicitly (so 4.6 tests stay valid). Decision: keep resolver as-is (fail-closed too-large); minimization is opt-in via the new app accessor. (Do NOT change 4.6's too-large behavior.)
- `cli/src/core/app.ts` -- MODIFY. Add `minimizeSpecialistArtifact(artifact, serviceId?): MinimizationResult` accessor using the default minimizer registry + the target entry. Reuses `this.clock`.
- `cli/test/specialistArtifactMinimization.test.ts` -- NEW. All ACs + I/O matrix rows: text within-limit pass-through; text over-limit truncate + transformation + recomputed hash + originalContentHash preserved; Thai grapheme truncation (assert no split combining/tone marks — feed a string ending mid-cluster and assert the result is a valid grapheme boundary, e.g. counts via Intl.Segmenter match); text no-limit skip; image within-resolution pass-through; image over-resolution → minimization-unavailable; image no-maxResolution skip; unparseable image → validation-failed; audio no-maxDuration pass-through; audio maxDuration + non-WAV → minimization-unavailable; WAV maxDuration measurable; no-target pass-through; determinism; immutability + original source identity preserved; originalContentHash equals the pre-minimization contentHash.

## Tasks & Acceptance

**Execution:**
- [ ] `cli/src/core/specialists/artifacts/minimization/types.ts` -- `MinimizationResult` + `ArtifactMinimizer` + registry interface.
- [ ] `cli/src/core/specialists/artifacts/minimization/textMinimizer.ts` -- grapheme-aware truncation via `Intl.Segmenter` + recompute hash + preserve originalContentHash.
- [ ] `cli/src/core/specialists/artifacts/minimization/imageMinimizer.ts` -- pure PNG/JPEG/GIF/BMP/WebP dimension parsing + maxResolution validation + fail-closed minimization-unavailable/validation-failed.
- [ ] `cli/src/core/specialists/artifacts/minimization/audioMinimizer.ts` -- WAV duration parse + maxDuration validation + fail-closed for non-WAV/unmeasurable.
- [ ] `cli/src/core/specialists/artifacts/minimization/registry.ts` -- default registry + `minimizeArtifact` dispatch.
- [ ] `cli/src/core/specialists/artifacts/minimization/index.ts` -- barrel.
- [ ] `cli/src/core/specialists/artifacts/types.ts` -- add `originalContentHash?: string` to `PreparedArtifact`.
- [ ] `cli/src/core/app.ts` -- `minimizeSpecialistArtifact(artifact, serviceId?)` accessor.
- [ ] `cli/test/specialistArtifactMinimization.test.ts` -- unit-test every I/O matrix row + AC.

**Acceptance Criteria:**
- Given a prepared text artifact that exceeds the target service's `maxTextLength`, when thcode minimizes it, then it truncates at the last grapheme-cluster boundary at or before the limit (Thai combining/tone marks are never split), records a `text-truncate` transformation, recomputes the content hash over the truncated text, preserves the original content hash as `originalContentHash`, and returns an immutable minimized `PreparedArtifact` — never silently sending the over-limit text.
- Given a prepared image artifact, when thcode minimizes it, then it parses the image dimensions from the header bytes (PNG/JPEG/GIF/BMP/WebP), validates against `maxResolution`, passes through when within limit, and fail-closes with `minimization-unavailable` (over limit, no downscale lib) or `validation-failed` (unparseable header) — never silently sending an over-resolution image.
- Given a prepared audio artifact with a `maxDuration` limit, when thcode minimizes it, then it measures WAV duration from the RIFF header and validates; for audio types whose duration cannot be measured without a codec library, it fail-closes with `minimization-unavailable` — never silently sending an over-duration audio artifact.
- Given an artifact within all relevant limits or with no relevant limit set, when thcode minimizes it, then it returns the artifact unchanged with `transformations: []` and the original content hash; given no target service, it passes through. The minimized manifest is immutable, deterministic, preserves source identity, and canonical tokens are emitted unchanged across all output modes.

## Design Notes

`Intl.Segmenter` is available in Node 22 (`node:>=22`) — use `{granularity:'grapheme'}` for Thai-safe truncation. Count LIMIT in grapheme clusters, not UTF-16 code units, so that `maxTextLength: "10000"` means 10000 user-visible characters; document this choice. The text minimizer recomputes `contentHash` over the truncated string via the same SHA-256 helper used in 4.6 (`createHash('sha256').update(text,'utf8')`). Image dimension parsing is pure byte-header reading (no `sharp`/`jimp` dependency): PNG width/height at byte offset 16 (big-endian uint32 each) after the 8-byte signature; JPEG scans for SOF0 (0xC0)…(0xCF) markers and reads width/height; GIF logical screen descriptor at offset 6–9 (little-endian); BMP width at offset 18, height at 22 (little-endian int32); WebP RIFF with VP8/VP8L/VP8X chunks. Audio: WAV is RIFF (`52 49 46 46`); find the `data` chunk (size) + `fmt ` chunk (sampleRate, channels, bitsPerSample) → duration = dataSize / (sampleRate * channels * bitsPerSample/8). Reuse `cli/src/core/specialists/artifacts/limits.ts` `parseSizeLimit` for any byte-based limits and add `parseResolutionLimit(value): {width,height}|null` (`4000x4000` → {4000,4000}; also accept `WxH` case-insensitive `x`) and `parseDurationLimit(value): number|null` (seconds: `30`, `30s`, `2m` → 120). Keep 4.6's `resolveArtifact` fail-closed `too-large` behavior unchanged — minimization is an explicit separate step, not auto-applied inside the resolver (so 4.6 tests remain valid). The minimized `PreparedArtifact` reuses the same type as 4.6 (plus `originalContentHash`); do not duplicate the type. Inject `clock` for `createdAt`; no `new Date()`/`Date.now()`/`Math.random()` in pure logic. Tests: vitest, hand-crafted byte fixtures for image/audio headers, no real fs/network.

## Verification

**Commands:**
- `npm run build` -- expected: tsc compiles with no errors.
- `npm test -- specialistArtifactMinimization` -- expected: all cases pass.
- `npm test` -- expected: full suite green, no regressions.