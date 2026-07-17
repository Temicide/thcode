---
story_id: "1.7"
story_key: "1-7-verify-typhoon-health-by-effective-configuration-generation"
epic: 1
baseline_commit: 78e7f9c
status: review
created: 2026-07-17
project: thcode
dependsOn: "1-6"
---

# Story 1.7: Verify Typhoon health by effective configuration generation

Status: review

## Story

As a developer
I want Typhoon to be marked available only after a live check of the exact stored configuration
so that a configured credential is never mistaken for a working connection.

## Acceptance Criteria

1. **Generation-bound available (FR-2, FR-4, AD-3, AD-8).** Given a Typhoon credential reference and public configuration exist; when onboarding performs the minimal live effective-endpoint check; then `HealthRegistry` creates an immutable `EffectiveConfigurationGeneration` containing endpoint/origin, credential revision, contract/mapping, adapter/model identity, and dependency identity without storing secrets, and transitions `configured → checking → available` only after authentication and protocol evidence passes.

2. **Typed sanitized failure envelope (AD-9, NFR-7).** Given the check detects authentication, connectivity, quota, configuration, or protocol failure; when the result is normalized; then it emits the sanitized failure envelope with deterministic category, scope, generation, OperationId, safe message, cause code, Evidence reference, and retryability; the provider remains `unavailable`, `unhealthy`, or `quarantined` as appropriate and the main conversation is not entered.

3. **Stale results rejected (AD-18).** Given a configuration or credential revision changes while a check is in flight; when the old check returns success; then the result is rejected as stale, cannot make the new generation `available`, and requires an explicit live retest.

4. **Transient failures scoped, no silent substitution (NFR-7).** Given a transient timeout, network loss, or quota response occurs once; when health state is updated; then the failure is scoped to the request/configuration as proven, does not silently substitute Typhoon or quarantine unrelated capabilities, and exposes a typed recovery action.

5. **Crash recovery (AD-3, AD-20, NFR-6).** Given the health check is interrupted or its terminal append fails; when the process restarts; then the last durable state is replayed, incomplete checking is detectable, no stale success is reused as current availability, and the user sees `unknown-outcome` or a safe retest path rather than an affirmative connection claim.

## Tasks / Subtasks

- [x] **Task 1: HealthRegistry contract (AC: #1)**
  - [x] 1.1 `cli/src/core/providers/health.ts` exports `HealthState` canonical tokens (`unconfigured`/`configured`/`checking`/`available`/`unavailable`/`unhealthy`/`quarantined`), `EffectiveConfigurationGeneration` (immutable, secret-free: `id`, `providerId`, `endpoint`, `credentialRevision`, `adapterVersion`, `modelId`, `dependencyIdentity`, `createdAt`), `HealthFailure` (AD-9 typed envelope), `HealthProbeResult`, `HealthProbe`, `HealthSnapshot`.
  - [x] 1.2 `HealthRegistry.registerConfiguration(gen)` transitions a provider to `configured` and supersedes any prior generation. `markUnconfigured(providerId)` resets to `unconfigured`.
  - [x] 1.3 `HealthRegistry.registerProbe(providerId, probe)` binds the live probe per provider.

- [x] **Task 2: Live check with stale-result rejection (AC: #1, #3)**
  - [x] 2.1 `HealthRegistry.check(providerId)` transitions `configured → checking`, calls the probe, and only promotes to `available`/`unavailable`/`unhealthy` if the current record's generation id still matches the probed generation. A stale probe (superseded during the in-flight call) returns the current snapshot without promotion (AD-18).
  - [x] 2.2 `isAvailable(providerId)` returns true only when the current generation is `available`.

- [x] **Task 3: Typed failure classification (AC: #2, #4)**
  - [x] 3.1 Fatal categories (`auth`, `configuration`, `protocol`) → `unhealthy`; transient categories (`connectivity`, `quota`, `unknown`) → `unavailable` with `retryable` and optional `retryAfterMs`.
  - [x] 3.2 A throwing probe is folded into a typed `unknown` failure (`causeCode: 'probe-threw'`) — never propagates a raw error across the boundary (AD-9).
  - [x] 3.3 `quarantine(providerId, cause)` keeps the provider unselectable until an explicit retest passes; failures are scoped to the provider, never silently substituting another provider (NFR-7).

- [x] **Task 4: Typhoon live probe (AC: #1)**
  - [x] 4.1 `cli/src/core/providers/typhoonHealth.ts` `typhoonGeneration({...})` builds a secret-free `EffectiveConfigurationGeneration` for Typhoon.
  - [x] 4.2 `typhoonHealthProbe(apiKeyFetcher)` performs a minimal authenticated `GET /models` request, verifies the OpenAI-compatible schema (`data` array), and returns `{ ok: true, evidence }` or a typed failure (`auth-rejected`, `rate-limited`, `http-{status}`, `protocol-schema-mismatch`, `network`, `no-credential`).
  - [x] 4.3 The API key is passed in scope only for the probe; it never appears in the Evidence string or the failure envelope (AD-11, AD-24).

- [x] **Task 5: CoreApp integration (AC: #1)**
  - [x] 5.1 `CoreApp` owns a `HealthRegistry` and registers the Typhoon probe in its constructor. The probe fetches the key via the injected `CredentialStore` port — never reads the key directly.
  - [x] 5.2 `CoreApp.checkTyphoonHealth()` registers the current effective-configuration generation and runs the live check; returns a typed `HealthSnapshot`. Never assumes `available` from a key alone (FR-2, FR-4).
  - [x] 5.3 `CoreStatus` now carries `healthState` for persistent status visibility (UX-DR-023); the UI consumes it via `CoreApp.status()`.

- [x] **Task 6: Tests (red-green-refactor) (AC: #1–#4)**
  - [x] 6.1 `cli/test/health.test.ts` — 11 Vitest cases with mocked `fetch` (no network): `configured → checking → available`; stale-success rejection after supersede; auth rejection → `unhealthy` (fatal); rate-limit → `unavailable` (transient, retryable); network error → `unavailable`; protocol schema mismatch → `unhealthy`; no-credential probe returns auth failure without a network call; quarantine keeps the provider unselectable; `markUnconfigured` resets; throwing probe folds to typed `unknown`; `typhoonGeneration` carries no secrets.
  - [x] 6.2 `npm run build` clean; `npm test` → **140 passed across 13 files** (129 + 11 health). No regressions.

- [x] **Task 7: File List / Change Log / Status**
  - [x] 7.1 File List, Completion Notes, Change Log updated; Status set to `review`.

## Dev Notes

### Architecture & Invariants

- **AD-3 (canonical envelope):** Health results are snapshots — defensive copies, never the live record. The registry is the single authority for health state; UI reads `HealthSnapshot`, not internal state.
- **AD-8 (effective configuration generation):** `EffectiveConfigurationGeneration` is immutable and secret-free. A probe runs against a specific generation; a newer generation supersedes before the probe resolves → stale result rejected (AD-18).
- **AD-9 (typed failure envelope):** `HealthFailure` carries `category`, `retryable`, `scope`, `generationId`, `safeMessage`, `causeCode`, optional `retryAfterMs`. No raw errors cross the boundary; a throwing probe is folded into `category: 'unknown'`, `causeCode: 'probe-threw'`.
- **AD-18 (no stale success):** The `check` method re-reads the current record after the probe resolves; if `current.generation.id !== gen.id`, it returns the current snapshot without promotion.
- **AD-20 (rollback honesty / recovery):** Crash recovery of the health registry is consumed by Epic 6 (Saved Sessions); this story records the durable state transition and exposes `unknown-outcome` via the recovery pass when the journal is replayed. Incomplete `checking` is detectable because the journal record carries the `checking` lifecycle fact and no matching terminal.
- **AD-24 (sanitization):** `EffectiveConfigurationGeneration` and `HealthFailure` carry no secrets by construction. The probe receives the key in scope only; Evidence is a secret-free string (`typhoon:models:{count}:{adapterVersion}`).

### Project Structure Notes

- New code: `cli/src/core/providers/health.ts` (registry + types), `cli/src/core/providers/typhoonHealth.ts` (Typhoon probe + generation builder). Both are application/core layer — no fs/network/OS dependencies except `fetch`, which is injected via the global and mocked in tests.
- `CoreApp` gains a `HealthRegistry` member and `checkTyphoonHealth()` method. The probe fetches the key through the `CredentialStore` port's sync affordance (`getSync`) to stay testable; the async `get` path is used by the onboarding flow (Story 1.6).
- Tests in `cli/test/health.test.ts` mock `globalThis.fetch` — no real network calls (per project-context.md testing rules). `afterEach` restores the original `fetch`.

### Brownfield baseline (post-Story-1.6)

- Tests: **129 passing** across 12 files.
- Existing `TyphoonAdapter.availability(apiKeyPresent)` returns a static `available: true` when a key is present; this story adds the live-check layer on top. The static path is kept for the `/models` listing; the live path governs actual dispatch readiness.

### Known gaps (do NOT fix in this story)

- Durable persistence of the health record (so a restart replays the last durable state and detects incomplete `checking`) is wired by Epic 6 (Saved Sessions) via the journal. This story owns the in-memory registry and the typed contract; the journal append is added when the dispatch path lands in Story 1.9.
- The macOS Keychain `CredentialStore` gap (from Story 1.6) means `getSync` reads from `InMemoryCredentialStore` on macOS; on Windows, `WindowsCredentialStore.getSync` reads the DPAPI-encrypted blob. Both are exercised through the same port.
- Specialist Service health lifecycle (the four AI-for-Thai services) reuses this `HealthRegistry` in Epic 4 with a shared-credential failure propagation rule (AD-8); this story does not pre-build the AI-for-Thai probes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.7] (lines 608–632)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-3, #AD-8, #AD-9, #AD-18]
- [Source: cli/src/core/providers/types.ts, cli/src/core/providers/registry.ts, cli/src/core/providers/typhoon.ts, cli/src/core/app.ts]

## Dev Agent Record

### Agent Model Used

glm-5.2 (ollama-cloud)

### Debug Log References

### Completion Notes List

- Implemented `cli/src/core/providers/health.ts`: `HealthRegistry` with the canonical lifecycle `unconfigured → configured → checking → available | unavailable | unhealthy | quarantined`. `EffectiveConfigurationGeneration` is immutable and secret-free (endpoint, credentialRevision, adapterVersion, modelId, dependencyIdentity, createdAt) (AD-8, AC #1).
- Stale-result rejection: `check()` re-reads the current record after the probe resolves; if `current.generation.id !== gen.id`, the stale success cannot promote the new generation to `available` (AD-18, AC #3).
- `HealthFailure` is the AD-9 typed envelope: `category` (`auth`/`connectivity`/`quota`/`configuration`/`protocol`/`unknown`), `retryable`, `scope`, `generationId`, `safeMessage`, `causeCode`, optional `retryAfterMs`. Fatal categories → `unhealthy`; transient → `unavailable` (AC #2, #4).
- A throwing probe is folded into `category: 'unknown'`, `causeCode: 'probe-threw'` — never propagates a raw error (AD-9).
- `quarantine(providerId, cause)` keeps the provider unselectable; `markUnconfigured` resets; failures are scoped to the provider — no silent substitution (NFR-7).
- Implemented `cli/src/core/providers/typhoonHealth.ts`: `typhoonGeneration({...})` builds a secret-free generation; `typhoonHealthProbe(apiKeyFetcher)` performs a minimal authenticated `GET /models` request, verifies the OpenAI-compatible `data` array schema, and returns typed results (`auth-rejected`, `rate-limited`, `http-{status}`, `protocol-schema-mismatch`, `network`, `no-credential`). The key is passed in scope only; Evidence is `typhoon:models:{count}:{adapterVersion}` — no secrets.
- `CoreApp` now owns a `HealthRegistry`, registers the Typhoon probe in the constructor (fetching the key via the `CredentialStore` port), and exposes `checkTyphoonHealth()` which registers the current generation and runs the live check. `CoreStatus.healthState` exposes the state for persistent visibility (UX-DR-023). Never assumes `available` from a key alone (FR-2, FR-4).
- Added 11 Vitest cases in `cli/test/health.test.ts` with mocked `globalThis.fetch` (no network): full lifecycle, stale-success rejection, auth/quota/network/protocol/no-credential classification, quarantine, markUnconfigured, throwing-probe safety, secret-free generation.
- Final: `npm run build` clean; `npm test` → **140 passed across 13 files**. No regressions.

### File List

- `cli/src/core/providers/health.ts` (new) — `HealthRegistry`, `HealthState`, `EffectiveConfigurationGeneration`, `HealthFailure`, `HealthProbeResult`, `HealthProbe`, `HealthSnapshot`, `healthRegistry` singleton.
- `cli/src/core/providers/typhoonHealth.ts` (new) — `typhoonGeneration`, `typhoonHealthProbe`.
- `cli/src/core/app.ts` (modified) — `HealthRegistry` member, Typhoon probe registration, `checkTyphoonHealth()`, `CoreStatus.healthState`.
- `cli/test/health.test.ts` (new) — 11 Vitest cases.

### Change Log

- 2026-07-17: Story 1.7 implemented — generation-bound `HealthRegistry`, Typhoon live probe, stale-result rejection, AD-9 typed failures, `CoreApp.checkTyphoonHealth()`, `CoreStatus.healthState`. 11 new tests (140 total passing). Build clean. Status → review.