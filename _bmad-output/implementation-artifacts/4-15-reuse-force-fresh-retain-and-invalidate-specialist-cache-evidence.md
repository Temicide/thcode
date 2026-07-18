---
title: 'Story 4.15: Reuse, force-fresh, retain, and invalidate Specialist cache Evidence'
type: 'feature'
created: '2026-07-18'
status: 'done'
review_loop_iteration: 0
baseline_revision: 'ebef35f'
final_revision: 'b2f70ea'
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-14-persist-immutable-specialist-evidence-and-versioned-cachemanifest-identity.md'
  - '{project-root}/_bmad-output/implementation-artifacts/4-9-establish-shared-specialist-adapter-result-and-failure-contracts.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** 4.14 ships an immutable `SpecialistEvidence` envelope, a deterministic `CacheManifest` identity digest, an `EvidenceRepository` port + `InMemoryEvidenceRepository`, and reuse/fresh projections — but nothing LOOKS UP prior Evidence by cache identity, nothing bypasses the cache on demand, nothing expires/retains records, and nothing invalidates affected identities when bound fields change. So a repeat prompt re-dispatches live (wasting a transfer and depending on a possibly-unhealthy service), and a contract/credential/endpoint change can still serve a stale cached result. 4.15 makes the cache *usable*: lookup precedes live-health gating, force-fresh bypasses safely, retention/TTL hides expired records, and scoped invalidation drops only affected identities.

**Approach:** Add a `CacheIndex` (in-memory `cacheManifestDigest → {evidenceId, observationTime, expiresAt?, state}`) with a typed `CacheInvalidationPort`, a retention evaluator, a scoped invalidator, and a `resolveCacheHit` resolver that encodes the gating order. Wire `invokeSpecialist` (app.ts) to: compute the `CacheManifest` → `resolveCacheHit` (lookup BEFORE health gating) → on a valid, non-expired, non-invalidated hit with `forceFresh:false`, return the prior Evidence labeled `reuseState:'reused'` (original observation time + provenance preserved) even if the service is `unavailable`/`unhealthy`/`quarantined`; on `forceFresh:true` or a miss, proceed to the existing health gate + adapter dispatch + `sealSpecialistEvidence`, then `record` the new evidence in the index. Force-fresh requires a current `available` health check for the exact generation before any transfer and NEVER deletes prior Evidence. Retention evaluation marks expired records `expired` and hides them from reuse (deletion is NOT in this epic — a typed invalidation/deletion port exposes stable reference behavior without claiming deletion occurred). Scoped invalidation marks affected identities `invalidated` without touching unrelated service Evidence. Cache lookup/invalidation failure projects `stale`/`corrupt`/`expired`/`unavailable` and never silently falls through to a live transfer or substitutes a service.

## Boundaries & Constraints

**Always:**
- Cache lookup runs BEFORE live-health gating. A valid hit (non-expired, non-invalidated, `forceFresh:false`) returns the prior Evidence as `reuseState:'reused'` with original `observationTime` + provenance + `cacheManifestDigest` — EVEN if the service is currently `unavailable`/`unhealthy`/`quarantined` (AC #1). No outbound transfer occurs on a hit.
- `forceFresh:true` bypasses cache lookup, preserves prior Evidence (the index entry is NOT deleted), and requires a current `available` health check for the EXACT `EffectiveConfigurationGeneration` before any transfer. No force-fresh result is returned while the service is `unavailable`/`unhealthy`/`quarantined` — that surfaces as the typed `unavailable` outcome, not a cached result (AC #2).
- Retention/TTL: each indexed record carries `expiresAt?` (from a retention policy bound at record time) and `retention` metadata. `evaluateRetention` marks a record `expired` at/after its boundary; expired records are hidden from reuse and their retention/deletion state is visible. Marking expired does NOT delete the Evidence record (deletion is out of this epic) (AC #3).
- Invalidation is scoped: `CacheInvalidationScope` is one of `serviceId` | `effectiveConfigurationId` | `credentialRevision` | `contractVersion` | `sourceContentHash` | `endpoint` | `all`. Invalidating a scope marks ONLY matching index entries `invalidated`; unrelated service Evidence is untouched (AC #4).
- A typed `CacheInvalidationPort` (interface + in-memory impl) exposes `invalidate(scope): InvalidationReceipt` and `deletionCoordination(ref): DeletionReceipt`. Because session/durable deletion is NOT in this epic, `DeletionReceipt` carries a typed `deletion-not-supported`/`invalidated-only` state — stable reference behavior, NEVER claiming deletion has occurred (AC #5).
- Cache lookup or invalidation failure projects exactly one of `stale` | `corrupt` | `expired` | `unavailable` as applicable, and NEVER silently falls through to a live transfer or substitutes a service (AD-14) (AC #6).
- The `CacheManifest` digest is computed from REQUEST inputs (via `computeSpecialistCacheManifest` / `computeCacheManifestDigest`) BEFORE dispatch so a lookup can match prior evidence. ANY bound-field difference → different digest → no match (inherited from 4.14).
- `.js` import specifiers; `readonly` interfaces; discriminated `ok` unions; typed errors; injectable clock for `now`/`expiresAt`/observation time; no `Date.now()`/`Math.random()` in pure logic; deterministic SHA-256 (inherited). Sanitizer before any persisted/displayed derived field (AD-24). The raw key never enters the cache index, retention metadata, invalidation receipts, or projections (AD-11).
- Reused Evidence is the SAME immutable frozen record from the `EvidenceRepository` (loaded by id) — it is relabeled via `projectReusedEvidence` (4.14), never mutated, never re-sealed as fresh.

**Block If:** (none unattended — deterministic from the request inputs + cache index + clock + health state)

**Never:**
- Never present a reused Evidence as fresh, or a fresh result as reused.
- Never delete prior Evidence on force-fresh (prior Evidence is preserved; only the lookup is bypassed).
- Never claim deletion occurred (deletion is not in this epic; the port reports `invalidated-only`/`deletion-not-supported`).
- Never serve an expired or invalidated record as a reuse hit.
- Never let a force-fresh result return while the service is unavailable/quarantined.
- Never broaden invalidation beyond the proven scope (smallest known safe scope — AD-18); never invalidate unrelated service Evidence.
- Never silently fall through to a live transfer or substitute a service when cache lookup/invalidation fails.
- Never store the raw key in the cache index, retention metadata, invalidation receipts, or projections.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Cache hit (healthy) | repeat request, valid non-expired index entry, `forceFresh:false`, service `available` | reused Evidence (`reuseState:'reused'`, original observationTime + provenance + cacheId), no transfer | ok |
| Cache hit while unhealthy | repeat request, valid entry, service `unavailable`/`unhealthy`/`quarantined` | reused Evidence returned anyway (lookup precedes health gating); no transfer; visibly labeled reused | ok (reused) |
| Force-fresh | same request, `forceFresh:true`, service `available` for exact generation | cache bypassed; prior Evidence preserved (index entry kept); live dispatch → fresh Evidence; recorded in index | ok |
| Force-fresh while unavailable | `forceFresh:true`, service `unavailable`/`quarantined` | NO force-fresh result; typed `unavailable` outcome; prior Evidence preserved | typed `unavailable` |
| Expired record | repeat request, entry `expiresAt < now` | entry marked `expired`; hidden from reuse; retention/expiry state visible; falls through to live gate (or `expired` projection if service also unavailable) | `expired` |
| Invalidation by serviceId | scope `{serviceId:'t-ocr'}` | only `t-ocr` index entries marked `invalidated`; other services untouched; subsequent lookup for `t-ocr` → miss | ok |
| Invalidation by generation/credential/contract/source/endpoint | scope matching one bound field | only entries whose manifest binds that field value marked `invalidated`; unrelated Evidence intact | ok |
| Invalidation `all` | scope `{all:true}` | all entries `invalidated`; Evidence records NOT deleted | ok |
| Deletion coordination | `deletionCoordination(ref)` | `DeletionReceipt` with `deletion-not-supported`/`invalidated-only`; stable reference; does not claim deletion occurred | typed receipt |
| Cache lookup failure (corrupt) | `EvidenceRepository.load(id)` returns `{ok:false,cause:'corrupt'}` | `corrupt` projection; index entry marked invalid; no silent live fallthrough; no service substitution | `corrupt` |
| Miss (no entry) | first request or invalidated/expired entry | miss → proceed to health gate + live dispatch + seal + record | ok (fresh) |
| Raw key never leaks | any path | cache index, retention metadata, invalidation receipts, projections contain no `Bearer`/`sk-`/raw key | secret-free (asserted) |

</intent-contract>

## Code Map

- `cli/src/core/specialists/evidence/cacheIndex.ts` -- NEW. `CacheIndexEntry` {cacheManifestDigest, evidenceId, serviceId, effectiveConfigurationId, contractVersion, credentialRevision?, sourceContentHash, endpoint, observationTime, expiresAt?, retention, state: 'valid'|'expired'|'invalidated'}. `CacheIndex` (in-memory Map<digest, entry>): `record(manifest, evidenceId, opts:{retention,ttlMs?,clock})`, `lookup(digest, now): {ok:true, entry} | {ok:false, cause:'miss'|'expired'|'invalidated'}`, `markExpired(now)`, `invalidate(scope)`, `list()`. Deterministic; injectable clock; no raw key.
- `cli/src/core/specialists/evidence/retention.ts` -- NEW. `RetentionPolicy` {kind:'ttl'|'none', ttlMs?}. `evaluateRetention(entry, now): {state:'valid'|'expired', expiresAt?, reason?}` — TTL boundary logic; marks `expired` at/after `expiresAt`; never deletes. `applyRetention(index, now)` sweeps.
- `cli/src/core/specialists/evidence/invalidation.ts` -- NEW. `CacheInvalidationScope` (discriminated: `{kind:'serviceId', serviceId}` | `{kind:'effectiveConfigurationId', id}` | `{kind:'credentialRevision', revision}` | `{kind:'contractVersion', version}` | `{kind:'sourceContentHash', hash}` | `{kind:'endpoint', endpoint}` | `{kind:'all'}`). `matchesEntry(scope, entry): boolean`. `invalidateCache(index, scope): InvalidationReceipt` — marks ONLY matching entries `invalidated`; unrelated Evidence untouched. Smallest-proven-scope semantics (AD-18).
- `cli/src/core/specialists/evidence/cachePort.ts` -- NEW. `CacheInvalidationPort` interface {`invalidate(scope): Promise<InvalidationReceipt>`, `deletionCoordination(ref): Promise<DeletionReceipt>`}. `DeletionReceipt` {ref, state:'deletion-not-supported'|'invalidated-only', affectedDigests: readonly string[], deletionClaimed:false}. `InMemoryCacheInvalidationPort implements CacheInvalidationPort` (wraps a `CacheIndex`). Typed; never claims deletion occurred (AC #5).
- `cli/src/core/specialists/evidence/cacheLookup.ts` -- NEW. `resolveCacheHit({index, repo, manifest, forceFresh, now, healthState}): {ok:true, kind:'reused', evidence: SpecialistEvidence} | {ok:true, kind:'miss'} | {ok:false, cause:'expired'|'corrupt'|'unavailable'}`. Encodes: lookup BEFORE health gating; `forceFresh:true` → miss (bypass) but requires `healthState==='available'` else `unavailable`; expired entry → `expired`; corrupt load → `corrupt`. Returns the loaded immutable Evidence for reuse (caller relabels via `projectReusedEvidence`).
- `cli/src/core/specialists/evidence/index.ts` -- MODIFY. Re-export the new cache symbols.
- `cli/src/core/app.ts` -- MODIFY. Wire cache into `invokeSpecialist`: compute `CacheManifest` (via existing `computeSpecialistCacheManifest`), `resolveCacheHit` BEFORE the health gate + adapter dispatch; on `kind:'reused'` return `projectReusedEvidence(...)` (no transfer); on `kind:'miss'` proceed to health gate (force-fresh requires `available`) → adapter dispatch → `sealSpecialistEvidence` → `cacheIndex.record(...)`. Add `specialistCacheIndex()`, `invalidateSpecialistCache(scope): InvalidationReceipt`, `specialistCacheInvalidationPort(): CacheInvalidationPort` accessors (lazy `_specialistCacheIndex`, `_specialistCacheInvalidationPort`). The `forceFresh` flag flows from the request options. No raw key in any cache structure.
- `cli/test/specialistCache.test.ts` -- NEW. Every I/O matrix row + AC. Reuse 4.14 evidence/manifest fixtures + 4.10–4.13 InMemory transport + the app `setSpecialistTransportForTest` seam. Assert: hit returns reused (original observationTime, no transfer) even while service unhealthy; force-fresh bypasses + preserves prior Evidence + requires `available` (unavailable → typed `unavailable`, no fresh result); expiry hides from reuse + visible state; scoped invalidation touches only matching entries (one scope kind per test) and unrelated Evidence intact; `all` invalidates all without deleting Evidence; deletion port returns `deletion-not-supported`/`invalidated-only` with `deletionClaimed:false`; corrupt load → `corrupt` projection, no silent fallthrough; raw key never in cache structures. Use deterministic clock + offline transport.

## Tasks & Acceptance

**Execution:**
- [x] `cli/src/core/specialists/evidence/cacheIndex.ts` -- `CacheIndex` (record/lookup/markExpired/invalidate/list); deterministic; injectable clock; no raw key.
- [x] `cli/src/core/specialists/evidence/retention.ts` -- `RetentionPolicy` + `evaluateRetention` + `applyRetention` (TTL boundary; marks expired, never deletes).
- [x] `cli/src/core/specialists/evidence/invalidation.ts` -- `CacheInvalidationScope` + `matchesEntry` + `invalidateCache` (smallest proven scope; unrelated Evidence untouched).
- [x] `cli/src/core/specialists/evidence/cachePort.ts` -- `CacheInvalidationPort` + `InMemoryCacheInvalidationPort` + `DeletionReceipt`/`InvalidationReceipt` (typed; never claims deletion occurred).
- [x] `cli/src/core/specialists/evidence/cacheLookup.ts` -- `resolveCacheHit` (lookup before health gating; force-fresh requires `available`; expired/corrupt/unavailable causes).
- [x] `cli/src/core/specialists/evidence/index.ts` -- re-export new cache symbols.
- [x] `cli/src/core/app.ts` -- wire cache lookup into `invokeSpecialist` (reused → no transfer; miss → health gate + dispatch + seal + record); `forceFresh` from request options; `specialistCacheIndex`/`invalidateSpecialistCache`/`specialistCacheInvalidationPort` accessors.
- [x] `cli/test/specialistCache.test.ts` -- unit-test every I/O matrix row + AC offline.

**Acceptance Criteria:**
- Given a valid CacheManifest match exists, when a prompt requests the same service input, then cache lookup runs before live-health gating and returns the immutable Evidence even if the current service is `unavailable`, `unhealthy`, or `quarantined`; the result is visibly labeled reused with original observation time.
- Given the user selects force-fresh, when the request is evaluated, then the prior Evidence is preserved, the cache is bypassed, and a current `available` health check for the exact generation is required before any transfer; no force-fresh result is returned while the service is unavailable.
- Given cache Evidence reaches its retention or TTL boundary, when retention evaluation runs, then the record is marked expired and hidden from reuse with retention metadata and the defined deletion/invalidation state visible.
- Given a service contract, registry manifest, endpoint, credential revision, mapping, preprocessing policy, source hash, or quarantine scope changes, when invalidation is triggered, then affected cache identities are invalidated without deleting unrelated service Evidence.
- Given Session deletion is not implemented in this epic, when cache ownership needs deletion coordination, then the system exposes a typed invalidation/deletion port and stable reference behavior without claiming that deletion has occurred.
- Given cache lookup or invalidation fails, when the result is projected, then thcode reports `stale`, `corrupt`, `expired`, or `unavailable` as applicable and never silently falls through to a live transfer or substitutes a service.

## Spec Change Log

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (medium 2, low 1)
- defer: 0
- reject: 12: (low 12)
- addressed_findings:
  - `[medium]` `[patch]` `resolveCacheHit` corrupt-Evidence handling and `InMemoryCacheInvalidationPort.deletionCoordination` used an `invalidate({kind:'all'})` + re-record pattern. Because `CacheIndex.record` always sets `state:'valid'`, re-recorded entries that were previously `expired`/`invalidated` were resurrected to `valid` — an expired/invalidated record could be re-served as a reuse hit, violating "Never serve an expired or invalidated record as a reuse hit" and AD-18 smallest-proven-scope (one corrupt Evidence touched every entry). Added `CacheIndex.invalidateDigest(digest)` (per-digest invalidation) and rewrote both paths to invalidate ONLY the specific digest(s). The dead double-`invalidate({kind:'all'})` in the corrupt path is removed. Added a corrupt-path test with a fake `EvidenceRepository` returning `cause:'corrupt'` + a per-digest `deletionCoordination` test asserting an unrelated entry stays `valid`.
  - `[medium]` `[patch]` `invokeSpecialist` sealed the adapter outcome via `invocation as SpecialistOutcome` unconditionally. `SpecialistInvocation = SpecialistOutcome | SpecialistAdapterRefusal`, so a refusal (handler-not-registered / stale-generation / unsupported-input / consent-manifest-mismatch) was unsoundly cast and sealed as a service-failure Evidence — mis-attributing a routing/health/consent refusal as a service failure (the 4.14 Evidence contract wraps `SpecialistResult | SpecialistFailure`, not refusals). Added `if ('refused' in invocation) return invocation;` before sealing and removed both `as` casts; TypeScript narrowing now enforces that `sealSpecialistEvidence` receives only a `SpecialistOutcome`. Service failures are still sealed (correct) but no longer recorded in the cache index (`if (invocation.ok)` guard).
  - `[low]` `[patch]` The test "returns corrupt when EvidenceRepository.load returns corrupt" actually exercised the `not-found`→`miss` path (InMemoryEvidenceRepository never returns `corrupt`) — misleading name + zero corrupt-path coverage. Renamed to "returns miss when load returns not-found" and added a real corrupt-path test (see the medium patch above).
  - `[low]` `[reject]` ISO-8601 lexicographic comparison in `markExpired`/`evaluateRetention` (`expiresAt < now`) — the clock contract is `() => new Date().toISOString()` (canonical `.sssZ` UTC, fixed precision), so all timestamps share one format and lexicographic compare is equivalent to numeric compare; the mixed-precision / `Z`-vs-`+00:00` scenario is unreachable.
  - `[low]` `[reject]` `resolveCacheHit` calls `index.markExpired(now)` on each lookup (mutates the index) — this is intended lazy TTL evaluation (entries expire over time), not a defect; `resolveCacheHit` is a resolver, not a pure function (the spec binds purity to cacheIndex/retention/invalidation, not the resolver).
  - `[low]` `[reject]` `invokeSpecialist` records with `retention:{kind:'none'}` — there is no cache-TTL policy source in this epic (the registry's `retentionClassification` is provider retention, not cache TTL), so `none` is the correct default; the TTL mechanism exists and is unit-tested with explicit `expiresAt` (AC #3 covered at the unit level).
  - `[low]` `[reject]` `loadResult.cause` other than `corrupt`/`not-found` silently treated as `not-found` — `EvidenceLoadCause` is a closed union `'not-found' | 'corrupt'`; no other cause exists in the type system, so the fallthrough is unreachable.
  - `[low]` `[reject]` `matchesEntry` (invalidation.ts) and `CacheIndex._matchesScope` are duplicate switches — cosmetic duplication; both are correct, no behavior impact.
  - `[low]` `[reject]` `SpecialistCacheHit` exposes the raw `evidence` (`reuseState:'fresh'`) alongside the `projection` (`reuseState:'reused'`) — the raw record is the immutable original (correctly `'fresh'`); the projection carries the `'reused'` label and the `reused:true` discriminator is the canonical reuse signal; exposing the raw record preserves inspectability (original observation time/provenance).
  - `[low]` `[reject]` `resolveCacheHit` does not re-validate that the loaded Evidence matches the index entry — the `EvidenceRepository` contract guarantees `load(id)` returns the record for that id or `not-found`/`corrupt`; re-validating is redundant defensive code.
  - `[low]` `[reject]` `deletionCoordination` matches by `evidenceId` OR `cacheManifestDigest` via one `ref` — evidence ids (`ev-{sha256}`) and manifest digests (sha256 hex) do not collide; dual-match is intentional convenience (caller passes whichever handle they hold).
  - `[low]` `[reject]` empty-string `expiresAt` / empty-string scope fields / empty `manifest.digest` — degenerate inputs no path produces (`expiresAt` is only set when a TTL is bound; scopes/digests are built from real service/generation/credential values; `computeCacheManifestDigest` always yields a non-empty sha256).
  - `[low]` `[reject]` TTL policy entry with undefined `expiresAt` never expires — a TTL entry must be recorded with `expiresAt` (the record contract); the integration uses `none`, and the TTL path is unit-tested with explicit `expiresAt`; a TTL-without-`expiresAt` is a degenerate caller input not produced by any path.

## Design Notes

**Gating order (the core invariant):** `computeCacheManifest` → `resolveCacheHit` (cache) → [on reused: return `projectReusedEvidence`, STOP] → health gate (force-fresh requires `available`) → adapter dispatch → `sealSpecialistEvidence` → `cacheIndex.record`. Cache lookup precedes health gating so a valid hit is returned even while unhealthy/quarantined. Force-fresh inverts only the cache step (bypass) and tightens the health step (requires `available`); it does NOT delete the prior index entry or Evidence.

**Reuse vs fresh labeling:** a reused result is the SAME immutable Evidence loaded from the `EvidenceRepository`, relabeled via 4.14's `projectReusedEvidence` (`reuseState:'reused'`, original `observationTime` + `cacheManifestDigest` preserved). It is never re-sealed, never mutated, never presented as `fresh`. A fresh live result is sealed with `reuseState:'fresh'` and then recorded in the index.

**Retention/TTL without deletion (AC #3, #5):** `evaluateRetention` compares `now` to `expiresAt`; at/after the boundary the entry state becomes `expired` and `lookup` returns `{ok:false,cause:'expired'}`. The Evidence record in the repository is NOT removed — deletion is out of this epic. The `CacheInvalidationPort.deletionCoordination(ref)` returns a `DeletionReceipt` with `state:'deletion-not-supported'` (or `'invalidated-only'` when an invalidation was applied) and `deletionClaimed:false`, exposing stable reference behavior without over-claiming.

**Scoped invalidation (AC #4, AD-18):** `CacheInvalidationScope` is discriminated by `kind`; `matchesEntry` compares only the scope's bound field against the entry's recorded bound field (each entry records the manifest's `serviceId`/`effectiveConfigurationId`/`contractVersion`/`credentialRevision`/`sourceContentHash`/`endpoint` at record time). `invalidateCache` marks ONLY matching entries `invalidated`; entries for other services or other generations are untouched. `kind:'all'` invalidates every entry but still does NOT delete Evidence records. Quarantine-scope changes route through the `serviceId`/`all` scope (quarantine itself is 4.16's concern; 4.15 only provides the invalidation primitive).

**Failure projection (AC #6):** `resolveCacheHit` returns a typed `cause` (`miss`|`expired`|`corrupt`|`unavailable`); the caller maps `expired`/`corrupt` to the canonical token and NEVER falls through to a live transfer or substitutes a service. `corrupt` arises when `EvidenceRepository.load(id)` returns `{ok:false,cause:'corrupt'}`; the index entry is marked invalid and the lookup fails closed. `unavailable` arises only on force-fresh with a non-`available` health state.

**Health-state source:** the current service health state is read from the existing health lifecycle (4.4) at lookup/force-fresh time; `resolveCacheHit` takes `healthState` as a parameter so the gating logic is pure and testable offline. The exact health accessor is confirmed during implementation; the spec binds only the behavior (force-fresh requires `available` for the exact generation).

**Test seam reuse:** reuse `setSpecialistTransportForTest` (4.10) + the 4.14 evidence/manifest fixtures + a deterministic clock. No real network/credentials. Build the cache index by seeding a prior sealed Evidence, then exercise hit / force-fresh / expiry / invalidation / corrupt paths.

## Verification

**Commands:**
- `npm run build` -- expected: tsc clean.
- `npm test -- specialistCache` -- expected: all pass.
- `npm test` -- expected: full suite green, no regressions.

## Auto Run Result

**Summary:** Implemented Story 4.15 — the Specialist cache reuse/force-fresh/retention/invalidation layer. Added a `CacheIndex` (in-memory `cacheManifestDigest → entry` with `record`/`lookup`/`markExpired`/`invalidate`/`invalidateDigest`/`list`), `retention.ts` (`RetentionPolicy` + `evaluateRetention`/`applyRetention`), `invalidation.ts` (`CacheInvalidationScope` + `matchesEntry`/`invalidateCache`), `cachePort.ts` (`CacheInvalidationPort` + `InMemoryCacheInvalidationPort` + `DeletionReceipt`/`InvalidationReceipt`), and `cacheLookup.ts` (`resolveCacheHit` encoding the gating order). Wired `invokeSpecialist` to compute the `CacheManifest` → `resolveCacheHit` BEFORE the health gate → return `projectReusedEvidence` on a hit (no transfer, even while unhealthy/quarantined) → else health gate (force-fresh requires `available`) → adapter dispatch → `sealSpecialistEvidence` → `cacheIndex.record`. Added `forceFresh` to the request opts and `specialistCacheIndex`/`invalidateSpecialistCache`/`specialistCacheInvalidationPort` accessors. Then applied 3 review-driven patches.

**Files changed:**
- `cli/src/core/specialists/evidence/cacheIndex.ts` (NEW) — `CacheIndex` with per-digest `invalidateDigest` + scoped `invalidate` + `markExpired`; deterministic; injectable clock; no raw key.
- `cli/src/core/specialists/evidence/retention.ts` (NEW) — `RetentionPolicy` + `evaluateRetention` + `applyRetention` (TTL boundary; marks expired, never deletes).
- `cli/src/core/specialists/evidence/invalidation.ts` (NEW) — `CacheInvalidationScope` + `matchesEntry` + `invalidateCache` (smallest proven scope; unrelated Evidence untouched).
- `cli/src/core/specialists/evidence/cachePort.ts` (NEW) — `CacheInvalidationPort` + `InMemoryCacheInvalidationPort` + `DeletionReceipt`/`InvalidationReceipt` (per-digest invalidation; never claims deletion).
- `cli/src/core/specialists/evidence/cacheLookup.ts` (NEW) — `resolveCacheHit` (lookup before health gating; force-fresh requires `available`; per-digest corrupt invalidation; expired/corrupt/unavailable causes).
- `cli/src/core/specialists/evidence/types.ts` (MOD) — `SpecialistCacheHit` interface.
- `cli/src/core/specialists/evidence/index.ts` (MOD) — re-export new cache symbols.
- `cli/src/core/app.ts` (MOD) — cache wiring in `invokeSpecialist` (reused → no transfer; miss → health gate + dispatch + seal + record); refusal early-return before seal (no mis-attribution); `forceFresh` opt; `specialistCacheIndex`/`invalidateSpecialistCache`/`specialistCacheInvalidationPort` accessors.
- `cli/test/specialistCache.test.ts` (NEW) — 53 offline tests covering every I/O matrix row + AC.

**Review findings breakdown:** 3 patches applied (2 medium: corrupt/deletionCoordination resurrect + smallest-scope violation fixed via per-digest invalidation; refusal mis-sealed as service failure fixed via early-return + cast removal; 1 low: misleading corrupt test renamed + real corrupt-path test added), 0 deferred, 12 rejected (all low).

**Follow-up review recommendation:** `true` — the final pass made two review-driven changes with data-integrity impact: (1) the corrupt/deletionCoordination `invalidate-all + re-record` pattern resurrected expired/invalidated entries as `valid` (an expired record could be re-served as a reuse hit) and violated AD-18 smallest-proven-scope; (2) a `SpecialistAdapterRefusal` was unsoundly cast to `SpecialistOutcome` and sealed as a service-failure Evidence, mis-attributing routing/health/consent refusals. An independent follow-up review would confirm the per-digest invalidation semantics and the refusal-guard.

**Verification performed:**
- `npm run build` → tsc clean.
- `npx vitest run specialistCache` → 53/53 pass.
- `npx vitest run` → 63 files / 1767 tests pass (baseline 62/1714; +1 file, +53 tests, 0 regressions).

**Residual risks:** The TTL/retention subsystem is unit-tested with explicit `expiresAt` but the integration path records with `retention:{kind:'none'}` (no cache-TTL policy source exists in this epic — the registry `retentionClassification` is provider retention, not cache TTL); wiring a real cache-TTL policy is a later concern. Durable Evidence/cache persistence remains a later epic (4.15 ships in-memory index + port). The refusal-guard is enforced by TypeScript narrowing (the unsound `as` casts were removed); a full CoreApp-level refusal-through-cache runtime test is not included (the existing 4.10–4.13 tests cover the success path through `invokeSpecialist`).