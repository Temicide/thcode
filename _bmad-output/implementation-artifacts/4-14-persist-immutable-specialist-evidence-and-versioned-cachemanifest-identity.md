---
title: 'Story 4.14: Persist immutable Specialist Evidence and versioned CacheManifest identity'
type: 'feature'
created: '2026-07-17'
status: 'done'
baseline_revision: '12d1a38'
final_revision: 'c99f1ad'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Service integrations (4.10–4.13) need an already-owned immutable Evidence envelope and a versioned CacheManifest identity to seal results/failures and key cache reuse — defining them per-service would diverge. Today there is no `SpecialistEvidence` envelope, no `CacheManifest` identity digest, no Evidence store port, and no reuse-state projection. Story 4.14 establishes these contracts BEFORE the service integrations so 4.10–4.13 consume an already-owned envelope.

**Approach:** Add `cli/src/core/specialists/evidence/`. `SpecialistEvidence` is an immutable, sanitized, sealed envelope wrapping a `SpecialistResult` or `SpecialistFailure` (from 4.9) plus: source-content hash, service/capability identity, effective configuration generation, returned + empty fields, confidence/uncertainty, provenance, ConsentReference, timing, normalized failure (if any), schema version, completeness state, observation time, and a deterministic Evidence id. It NEVER carries raw payload bytes (only hashes/references/sanitized summaries — raw payload bytes are not persisted as outbound transfer records). `CacheManifest` is a versioned deterministic identity digest over: service/capability contract, verified origin, ordered semantic inputs + content hashes, request options, preprocessing, mapping/schema version, effective configuration generation, transformation/redaction policy, and source identity. Any field difference → the candidate is invalid (no match). An `EvidenceRepository` port + an `InMemoryEvidenceRepository` (durable persistence is a later epic; 4.14 ships the contract + in-memory store + port). `CacheManifestRegistry` computes + compares CacheManifest identity. Reuse projection: a reused Evidence carries its original observation time, source/configuration provenance, cache identity, and `reuseState: 'reused'` — NEVER presented as a fresh live result.

## Boundaries & Constraints

**Always:**
- Evidence is immutable and sealed (Object.freeze). Any change produces a new Evidence record with a new id; the prior record is never mutated.
- Evidence NEVER carries raw payload bytes — only source-content hash, sanitized summaries, references, hashes, and policy-approved derived fields. Raw payload bytes are not persisted as outbound transfer records (AD-24, AC #5).
- `CacheManifest` identity is a deterministic SHA-256 over a stable canonical JSON of ALL bound fields (service/capability contract, verified origin, ordered semantic inputs + content hashes, request options, preprocessing, mapping/schema version, effective configuration generation, transformation/redaction policy, source identity). ANY differing field → different digest → no match (AC #4). Order of semantic inputs is part of the identity.
- Reused Evidence is visibly labeled `reuseState: 'reused'` with original observation time + provenance + cache identity; NEVER presented as a fresh live result (AC #3). A fresh live result is `reuseState: 'fresh'`.
- Evidence id, CacheManifest digest, and timestamps are deterministic given inputs (SHA-256 over canonical fields; `crypto.randomUUID()` is acceptable for Evidence ids since they are opaque handles, but the CacheManifest digest MUST be deterministic SHA-256, not UUID).
- The Evidence envelope carries the ConsentReference (secret-free, from 4.8) — never the raw key.
- Sanitization runs on any human-readable derived field before it enters Evidence (AD-24): use `sanitizer.sanitize(value, 'remote-payload')` / `'error-message'` / `'tool-output'` as appropriate.
- Injectable clock for observation/display timestamps; no `new Date()`/`Date.now()`/`Math.random()` in pure logic.
- `.js` import extensions; `readonly` interfaces; discriminated `ok` unions; typed errors.

**Block If:** (none unattended — deterministic from the result/failure + configuration + manifest)

**Never:**
- Never persist raw payload bytes in Evidence.
- Never mutate a sealed Evidence record.
- Never present reused Evidence as fresh.
- Never let a CacheManifest match succeed when any bound field differs.
- Never store the raw key in Evidence (ConsentReference is secret-free).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Seal a result | SpecialistResult (4.9) + config gen + observation time | Immutable SpecialistEvidence with all attribution + schemaVersion + completeness 'complete' + fresh reuseState + deterministic id | ok |
| Seal a failure | SpecialistFailure (4.9) + config gen | SpecialistEvidence with normalized failure + completeness 'failed'/'incomplete' + fresh reuseState | ok |
| CacheManifest identity | service contract + origin + ordered inputs+hashes + options + preprocessing + mapping version + gen + transform policy + source id | Deterministic SHA-256 digest; same inputs → same digest | ok |
| Cache identity differs on any field | one bound field changed | Different digest → no match (candidate invalid) | no match |
| Input order differs | inputs [A,B] vs [B,A] | Different digests (order is part of identity) | no match |
| Reuse evidence | prior Evidence returned from cache | reuseState='reused', original observationTime + provenance + cacheId preserved; not labeled fresh | labeled reused |
| Sensitive content in derived fields | result contains text fields | Evidence stores sanitized summaries + hashes, NOT raw bytes | sanitized |
| Evidence repository store/load | seal then load by id | Returns the same immutable record (frozen) | ok |
| Evidence not found | load unknown id | typed not-found | typed error |
| Raw key never in evidence | any path | Evidence JSON contains no raw key/secret; ConsentReference is the only credential handle | secret-free (asserted) |
| Completeness states | result with omissions / failure / complete | completeness: 'complete'|'sanitized-with-omissions'|'failed'|'incomplete' | typed |

</intent-contract>

## Code Map

- `cli/src/core/specialists/evidence/types.ts` -- NEW. `SpecialistEvidenceSchemaVersion = 1` (const). `EvidenceReuseState = 'fresh'|'reused'`. `EvidenceCompleteness = 'complete'|'sanitized-with-omissions'|'failed'|'incomplete'`. `SpecialistEvidence` {id, schemaVersion, reuseState, completeness, serviceIdentity {serviceId, nameThai, nameEnglish, contractVersion, adapterVersion}, configurationGenerationId, sourceContentHash, consentReference, fields: Readonly<Record<string,SpecialistFieldValue>>, emptyFields: readonly string[], confidence?, uncertainty?, provenance {endpoint, method, status, transportVersion}, timing {startedAt, completedAt, elapsedMs}, normalizedFailure?: SpecialistFailure, cacheManifestDigest?, observationTime, displayTime, sanitizedRawResponseRef, evidenceRef}. ALL readonly. `CacheManifest` {manifestVersion, serviceId, contractVersion, verifiedOrigin, semanticInputs: readonly {mediaType, contentHash}[], requestOptions, preprocessing: readonly string[], mappingVersion, schemaVersion, effectiveConfigurationId, transformationPolicy, sourceIdentity, digest}. `CacheManifestInput` (the fields minus digest). `EvidenceRepository` port {store(evidence): Promise<void>, load(id): Promise<{ok:true,evidence}|{ok:false,cause:'not-found'|'corrupt'}>, list(): Promise<readonly SpecialistEvidence[]>, has(id): Promise<boolean>}. `CacheManifestError` typed.
- `cli/src/core/specialists/evidence/cacheManifest.ts` -- NEW. `computeCacheManifestDigest(input: CacheManifestInput): string` — canonical JSON SHA-256 over ALL fields in a fixed order (semanticInputs as `mediaType:contentHash` joined in order). `buildCacheManifest(input): CacheManifest`. `cacheManifestMatches(a: CacheManifest, bInput: CacheManifestInput): boolean` — recompute digest for bInput and compare; ANY field diff → false. Pure, no Date/random.
- `cli/src/core/specialists/evidence/seal.ts` -- NEW. `sealSpecialistEvidence({outcome: SpecialistResult|SpecialistFailure, configurationGenerationId, cacheManifestDigest?, observationTime, displayTime, clock}): SpecialistEvidence`. Build the immutable envelope: if outcome.ok → result evidence (fields, emptyFields, confidence, uncertainty, provenance, completeness from omissions); else → failure evidence (normalizedFailure, completeness 'failed'). Object.freeze deeply. Deterministic id = `ev-${sha256(canonical evidence fields)}` OR `ev-${randomUUID()}` — use deterministic SHA-256 id over the canonical sealed fields (NOT uuid) so the same sealed content yields the same id (idempotent sealing). Sanitize any derived text via sanitizer. NEVER include raw bytes.
- `cli/src/core/specialists/evidence/repository.ts` -- NEW. `InMemoryEvidenceRepository implements EvidenceRepository` (Map<id, frozen evidence>). `store`, `load`, `list`, `has`. Returns frozen records. Pure-ish (in-memory). 
- `cli/src/core/specialists/evidence/projection.ts` -- NEW. `projectReusedEvidence(evidence): ReusedEvidenceProjection` — reuseState='reused', original observationTime, provenance, cacheId (cacheManifestDigest), completeness; visibly labeled reused, not fresh. `projectFreshEvidence(evidence): FreshEvidenceProjection`. Stable canonical tokens.
- `cli/src/core/specialists/evidence/index.ts` -- NEW. Barrel.
- `cli/src/core/app.ts` -- MODIFY. Add `sealSpecialistEvidence(outcome, serviceId, opts?): Promise<SpecialistEvidence>` — builds the cacheManifestDigest from the request inputs (service contract + origin + ordered inputs+hashes from preparedArtifacts + request options + preprocessing transforms + mapping/schema version + effective config id + transformation policy + source identity), seals the evidence, stores in an in-memory EvidenceRepository (lazy field `_specialistEvidenceRepo`), returns the immutable evidence. Also expose `specialistEvidenceRepository(): EvidenceRepository` and `computeSpecialistCacheManifest(serviceId, preparedArtifacts, opts): CacheManifest` for cache lookup (4.15).
- `cli/test/specialistEvidence.test.ts` -- NEW. Every I/O matrix row + AC. Build SpecialistResult/SpecialistFailure fixtures (reuse 4.9 types). Verify: seal result → immutable frozen evidence with all attribution + schemaVersion + completeness; seal failure → normalizedFailure + completeness 'failed'; CacheManifest deterministic (same inputs → same digest); ANY field diff → no match (contract, origin, inputs, options, preprocessing, mappingVersion, schemaVersion, gen, transform policy, source identity — one changed each → different digest); input order [A,B] vs [B,A] → different digest; reused evidence labeled 'reused' with original observationTime + cacheId, not 'fresh'; raw key never in evidence JSON (scan for Bearer/sk-/raw key); evidence store/load idempotent (load returns same frozen record); load unknown id → not-found; sensitive derived fields sanitized; completeness states; deterministic evidence id (same content → same id).

## Tasks & Acceptance

**Execution:**
- [ ] `cli/src/core/specialists/evidence/types.ts` -- all contracts.
- [ ] `cli/src/core/specialists/evidence/cacheManifest.ts` -- `computeCacheManifestDigest` + `buildCacheManifest` + `cacheManifestMatches` (deterministic, order-sensitive).
- [ ] `cli/src/core/specialists/evidence/seal.ts` -- `sealSpecialistEvidence` (immutable, sanitized, deterministic id, no raw bytes).
- [ ] `cli/src/core/specialists/evidence/repository.ts` -- `InMemoryEvidenceRepository`.
- [ ] `cli/src/core/specialists/evidence/projection.ts` -- reuse/fresh projections.
- [ ] `cli/src/core/specialists/evidence/index.ts` -- barrel.
- [ ] `cli/src/core/app.ts` -- `sealSpecialistEvidence` + `computeSpecialistCacheManifest` + `specialistEvidenceRepository` accessors.
- [ ] `cli/test/specialistEvidence.test.ts` -- unit-test every I/O matrix row + AC.

**Acceptance Criteria:**
- Given a Specialist call completes or fails, when Evidence is sealed, then it includes source-content hash, service/capability identity, effective configuration generation, returned and empty fields, confidence/uncertainty, provenance, ConsentReference, timing, normalized failure if any, schema version, and completeness state — and is immutable + secret-free (no raw payload bytes, no raw key).
- Given a cache candidate is created, when CacheManifest is generated, then its versioned identity includes service/capability contract, verified origin, ordered semantic inputs and content hashes, request options, preprocessing, mapping/schema version, effective configuration generation, transformation/redaction policy, and source identity — and is a deterministic digest where any differing field invalidates the match.
- Given Evidence is reused, when it is displayed, then the original observation time, source/configuration provenance, cache identity, and reuse state are visible and it is NEVER presented as a fresh live result.
- Given source bytes, service contract, endpoint, mapping, generation, preprocessing, redaction, or request options differ, when cache identity is compared, then the candidate is invalid and cannot be returned as a match.
- Given Evidence contains sensitive content, when it is persisted or rendered, then only sanitized summaries, hashes, references, and policy-approved derived fields remain; raw payload bytes are not persisted as outbound transfer records.

## Design Notes

Reuse the 4.9 `SpecialistResult`/`SpecialistFailure`/`SpecialistFieldValue`/`ConsentReference` types directly — Evidence wraps them, it does not redefine them. `sourceContentHash` = the result's `sourceContentHash` (= preparedManifest.payloadByteDigest). `normalizedFailure` = the SpecialistFailure verbatim (already sanitized by 4.9). `cacheManifestDigest` is computed from the REQUEST inputs (the cache key), NOT from the response — so a cache lookup can compute the manifest BEFORE dispatch and match prior evidence. The canonical JSON for `computeCacheManifestDigest` must use a STABLE field order (sorted keys, semanticInputs in their declared order) so the digest is deterministic across runs. `semanticInputs` = the prepared artifacts' `{mediaType, contentHash}` in their prepared order (the order matters — it's part of identity). `requestOptions` = {timeoutMs, maxRetries}. `preprocessing` = the union of artifacts' transformations (sorted). `mappingVersion`/`schemaVersion` = from the registry entry's contractVersion/manifestVersion (or dedicated fields if present — use contractVersion for mappingVersion, manifestVersion for schemaVersion). `transformationPolicy` = the manifest's transformation (from 4.8). `sourceIdentity` = the primary artifact's sourceIdentity.canonicalPath OR a digest over all source identities. `verifiedOrigin` = effectiveConfiguration.endpoint. The Evidence id: use `ev-${sha256(canonical sealed fields)}` so identical seals are idempotent (store is idempotent on re-seal). `observationTime`/`displayTime` from the injected clock. Deep-freeze with a recursive freeze helper (readonly interfaces + Object.freeze on the root; nested readonly arrays/objects are frozen at construction via Object.freeze on each). The EvidenceRepository is a PORT (interface) — durable persistence is a later epic; 4.14 ships InMemoryEvidenceRepository + the interface. app.ts holds a lazy `_specialistEvidenceRepo: InMemoryEvidenceRepository`. Sanitize derived text fields (field values that are text) via `sanitizer.sanitize(value, 'remote-payload')` before storing — but note the result FIELDS come from the service response and represent service output; sanitize them with 'remote-payload' to strip any echoed secrets. Keep the original field structure (kind/value/present) but sanitize the `value` strings. Inject clock; no `new Date()`/`Date.now()`/`Math.random()` in pure functions (seal/cacheManifest/projection). `crypto.randomUUID()` is NOT needed since evidence id is deterministic SHA-256.

## Verification

**Commands:**
- `npm run build` -- expected: tsc clean.
- `npm test -- specialistEvidence` -- expected: all pass.
- `npm test` -- expected: full suite green, no regressions.

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (medium 4)
- defer: 0
- reject: 11
- addressed_findings:
  - `[medium]` `[patch]` seal.ts synthesized a placeholder `ConsentReference` (all-empty) for failure outcomes — invented data in a provenance-critical immutable envelope. Removed the synthesis; `consentReference` is now required for failure outcomes (throws a typed error if absent). Results still default it from `outcome.consentReference`.
  - `[medium]` `[patch]` seal.ts synthesized a placeholder `serviceIdentity` (empty Thai/English names + versions) for failure outcomes. Removed; `serviceIdentity` is now required for failure outcomes (throws if absent). Results still default from `outcome.serviceIdentity`.
  - `[medium]` `[patch]` Structured-field sanitization stringified→sanitized→re-parsed the whole object; on a secret-named key (`token`/`secret`/`password`) the sanitizer produced invalid JSON and the catch replaced the ENTIRE object with `{ '[sanitized]': true }`, destroying all legitimate sibling data — violating the spec's "keep the original field structure." Replaced with a recursive `sanitizeStringLeaves` walk that redacts only string leaves and preserves all non-string values and shape; completeness still downgrades on omissions.
  - `[medium]` `[patch]` app.ts `sealSpecialistEvidence` injected a silent default `requestOptions {30000,2}` when computing `cacheManifestDigest`, which would make the evidence digest mismatch the real request's manifest (breaking 4.15 cache reuse). Now the digest is computed only when `requestOptions` (and the other request-input fields) are explicitly provided; otherwise `cacheManifestDigest` is left `undefined`.
  - `[low]` `[reject]` Timestamps (`observationTime`/`displayTime`) included in the evidence id hash — correct by design; the id identifies the sealed record (incl. when observed) and `cacheManifestDigest` is the content cache key. Idempotent for exact re-seals.
  - `[low]` `[reject]` `sourceContentHash = effectiveGenerationId` for failures — explicitly sanctioned by spec Design Notes (no source content on a failure).
  - `[low]` `[reject]` Cycle guards in `deepFreeze`/`canonicalJson` — unreachable: evidence/cache data crosses a `JSON` boundary (parse/stringify) so it is acyclic by construction.
  - `[low]` `[reject]` Structured field value being an array/null — the `SpecialistFieldValue` structured variant's `value` is typed `Readonly<Record<string,unknown>>`; not a real edge within contract.
  - `[low]` `[reject]` `preparedArtifacts[0]?.sourceIdentity.canonicalPath` — `PreparedArtifact.sourceIdentity` is a required (non-optional) field, so the `?.` guard is sufficient.
  - `[low]` `[reject]` ConsentReference test checking property names only — the existing raw-key-never-in-evidence test already `JSON.stringify`-scans for `Bearer`/`sk-`/raw-key patterns.
  - `[low]` `[reject]` `\x00` field separator not length-prefixed — `canonicalJson` JSON-encodes all values, so no field can contain a raw null byte; delimiter collisions are unreachable.
  - `[low]` `[reject]` `preprocessing` stored unsorted while digest sorts — `cacheManifestMatches(a, bInput)` recomputes from an INPUT (which sorts), so matching is correct within contract.
  - `[low]` `[reject]` `canonicalJson` treats `undefined` and absent keys identically — correct, deterministic behavior for optional fields.
  - `[low]` `[reject]` `InMemoryEvidenceRepository.store` does not assert frozen — `sealSpecialistEvidence` always deep-freezes and the port is only consumed via `app.ts`; defensive-only, not a real gap.

## Auto Run Result

**Summary:** Implemented the Story 4.14 Specialist Evidence + versioned CacheManifest identity contracts. `types.ts` and `cacheManifest.ts` already existed (committed at `36a11b7`); this run added the sealing, in-memory repository, reuse/fresh projections, barrel, CoreApp accessors, and the test suite — then applied 4 review-driven patches.

**Files changed:**
- `cli/src/core/specialists/evidence/seal.ts` (NEW) — `sealSpecialistEvidence()`: immutable, sanitized, deterministic `ev-${sha256}` id, deep-freeze; result + failure paths; no invented data.
- `cli/src/core/specialists/evidence/repository.ts` (NEW) — `InMemoryEvidenceRepository` (port + in-memory store; frozen records).
- `cli/src/core/specialists/evidence/projection.ts` (NEW) — `projectReusedEvidence` / `projectFreshEvidence`.
- `cli/src/core/specialists/evidence/index.ts` (NEW) — barrel.
- `cli/src/core/specialists/evidence/cacheManifest.ts` (MOD) — exported `canonicalJson` for reuse by seal.
- `cli/src/core/app.ts` (MOD) — `specialistEvidenceRepository()`, `computeSpecialistCacheManifest()`, `sealSpecialistEvidence()` accessors; lazy `_specialistEvidenceRepo`.
- `cli/test/specialistEvidence.test.ts` (NEW) — 42 tests covering every I/O matrix row + AC.

**Review findings breakdown:** 4 patches applied (invented-data removal ×2, structured-sanitization structure preservation, cache-digest option fabrication), 0 deferred, 11 rejected.

**Follow-up review recommendation:** `true` — the final pass made review-driven changes with data-integrity (no invented provenance data), sanitization (structured-field structure preservation), and cache-correctness (no fabricated request options) impact; an independent follow-up review would confirm the patch quality.

**Verification performed:**
- `npm run build` → tsc clean (no errors, no unused locals/params).
- `npx vitest run specialistEvidence` → 42/42 pass.
- `npx vitest run` → 58 files / 1577 tests pass (baseline 57 files / 1535 tests; +1 file, +42 tests).

**Residual risks:** Failure-outcome sealing now requires the caller to supply a real `ConsentReference` and `serviceIdentity`; callers that cannot (e.g. a pre-consent refusal path) must not call `sealSpecialistEvidence` for a failure. Durable Evidence persistence remains a later epic (4.14 ships the port + in-memory store only).