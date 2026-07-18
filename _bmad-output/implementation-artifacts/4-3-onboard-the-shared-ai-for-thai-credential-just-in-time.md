---
title: 'Story 4.3: Onboard the shared AI-for-Thai credential just in time'
type: 'feature'
created: '2026-07-17'
baseline_revision: '10a4452'
status: 'done'
final_revision: '2d358d9'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Specialist Services require an AI-for-Thai API key, but there is no just-in-time, protected onboarding flow that pauses before any Specialist request, discloses the reviewed endpoint + separate credential purpose + local OS storage + four-service scope, and stores only a secret-free reference/revision/fingerprint shared by all four launch services — never reaching Typhoon, SCBx, hosted components, logs, prompts, sessions, previews, or output.

**Approach:** Add a JIT AI-for-Thai credential onboarding flow under `cli/src/core/specialists/credential/`. It pauses at the connection boundary when an invokable Specialist is requested and no AI-for-Thai credential is configured, discloses the reviewed endpoint + separate credential purpose + OS credential storage + four-service scope, opens the masked form ONLY in interactive mode, stores the key in the OS `CredentialStore` under the single shared `aiforthai` CredentialGroupId, and persists ONLY a secret-free reference + revision + fingerprint in product persistence. Storage/auth/connectivity/quota/origin-verification failures yield a typed `unavailable`/`unhealthy` cause with Inspect/Replace/Remove/Exit actions and no Specialist invocation. Remove/rotate invalidates the old reference and makes dependent configuration generations stale/unavailable with no cached credential value left in product buffers or persistence. Cancelled/noninteractive/unknown outcomes report `cancelled`/`unknown-outcome`, claim no provider use, and never auto-retry.

## Boundaries & Constraints

**Always:**
- One distinct opaque `CredentialGroupId` (`aiforthai`) is shared by the four launch services (T-OCR, Speech-to-Text, Extract Address, NER); never reaches Typhoon or SCBx.
- Product persistence stores ONLY the credential reference, revision, and secret-free fingerprint — never the secret value.
- The masked credential form opens ONLY in interactive mode; headless/noninteractive fails closed before any Specialist request.
- Failure causes are typed: `unavailable` (connectivity/quota/origin) or `unhealthy` (auth/storage), with Inspect/Replace/Remove/Exit next actions; no Specialist invocation occurs on failure.
- Remove/rotate invalidates the old reference; dependent EffectiveConfigurationGenerations become stale/unavailable; no cached credential value remains in product buffers or persistence.
- Cancelled/noninteractive/unknown outcomes report `cancelled`/`unknown-outcome`, claim no provider use, and never auto-retry.

**Block If:** (none unattended — all decisions are deterministic from store availability + interactive flag + verify outcome)

**Never:**
- Never send the AI-for-Thai key to Typhoon, SCBx, a hosted component, logs, prompts, sessions, previews, or output.
- Never persist the raw secret value in product persistence or buffers.
- Never auto-retry an unknown onboarding outcome or claim provider use when none occurred.
- Never open the masked form in noninteractive/headless mode.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| JIT onboarding, no credential configured | invokable Specialist requested + no aiforthai key + interactive | Pauses, discloses endpoint/purpose/storage/scope, opens masked form, stores key, records reference+revision+fingerprint | No error; success result with fingerprint |
| Headless / noninteractive | no key + isTTY false | Fails closed before any Specialist request; `headless-blocked`/`cancelled` cause; no form, no invocation | Typed cause, no provider use claimed |
| Storage/auth/connectivity/quota/origin failure | verify or store fails | Typed `unavailable`/`unhealthy` cause with Inspect/Replace/Remove/Exit actions; no Specialist invocation | Typed cause + next actions |
| Remove / rotate key | remove or rotate operation | Old reference invalidated; dependent generations stale/unavailable; no cached credential value in buffers/persistence | Invalidation result |
| Cancelled / unknown outcome | user cancels or outcome unknown | `cancelled`/`unknown-outcome`; no provider use claimed; no auto-retry | Typed cause |

</intent-contract>

## Code Map

- `cli/src/core/specialists/credential/types.ts` -- NEW. `AiForThaiCredentialReference` (reference id, revision, secret-free fingerprint, stored-at timestamp — no secret), `CredentialRevision`, typed `AiForThaiOnboardingResult` (ok + fingerprint/reference, or typed cause among `cancelled|headless-blocked|unavailable|unhealthy|unknown-outcome`), `CredentialRemovalResult`, `CredentialRotationResult`, disclosure text constant.
- `cli/src/core/specialists/credential/onboarding.ts` -- NEW. JIT onboarding flow: boundary pause + disclosure + interactive-only masked form + store via `CredentialStore` under `aiforthai` + verify + record reference/revision/fingerprint. Reuse `buildCredentialIdentity`/`credentialFingerprint` from `permissions/credentialIdentity.ts` and the `OnboardingIO`/`CredentialStore` interfaces.
- `cli/src/core/specialists/credential/persistence.ts` -- NEW. Persist/load/invalidate the secret-free credential reference + revision + fingerprint in product persistence (sanitized; never the secret). Invalidation removes the reference and signals dependent generations are stale.
- `cli/src/core/specialists/credential/index.ts` -- NEW. Barrel export.
- `cli/src/core/app.ts` -- MODIFY. Expose an AI-for-Thai credential onboarding accessor + the JIT connection boundary hook used by routing (pauses before any Specialist request when no credential is configured). Do NOT invoke a Specialist here.
- `cli/test/specialistCredentialOnboarding.test.ts` -- NEW. All ACs + I/O matrix rows (use `InMemoryCredentialStore` + a fake `OnboardingIO`).

## Tasks & Acceptance

**Execution:**
- [x] `cli/src/core/specialists/credential/types.ts` -- typed reference/revision/fingerprint + typed onboarding/removal/rotation results + disclosure constant.
- [x] `cli/src/core/specialists/credential/onboarding.ts` -- JIT flow: pause + disclosure + interactive-only masked form + store + verify + record; typed failure causes with Inspect/Replace/Remove/Exit; never to Typhoon/logs/etc.
- [x] `cli/src/core/specialists/credential/persistence.ts` -- secret-free reference persistence + invalidation (no cached secret in buffers/persistence).
- [x] `cli/src/core/specialists/credential/index.ts` -- barrel export.
- [x] `cli/src/core/app.ts` -- AI-for-Thai onboarding accessor + JIT connection boundary hook.
- [x] `cli/test/specialistCredentialOnboarding.test.ts` -- unit-test the I/O matrix edge cases + all ACs.

**Acceptance Criteria:**
- Given a prompt requires an invokable Specialist Service and no AI-for-Thai credential is configured, when routing reaches the connection boundary, then thcode pauses before any Specialist request, explains the reviewed endpoint, separate credential purpose, local OS credential storage, and four-service scope, and opens the masked credential form only in an interactive mode.
- Given a key is entered, when thcode stores and verifies it, then it uses one distinct opaque `CredentialGroupId` shared by the four launch services, stores only its reference, revision, and secret-free fingerprint in product persistence, and never sends it to Typhoon, SCBx, a hosted component, logs, prompts, sessions, previews, or output.
- Given credential storage, authentication, connectivity, quota, or origin verification fails, when onboarding ends, then the user receives a typed sanitized cause and `unavailable` or `unhealthy` state with Inspect, Replace, Remove, or Exit actions; no Specialist invocation occurs.
- Given a user removes or rotates the key, when the operation commits, then the old credential reference is invalidated, dependent configuration generations become stale or unavailable, and no cached credential value remains in product buffers or persistence.
- Given onboarding is cancelled, noninteractive, or its outcome is unknown, when the flow ends, then the state is reported as cancelled or `unknown-outcome` as applicable, no provider use is claimed, and no automatic retry occurs.

## Design Notes

Reuse `cli/src/core/permissions/credentialIdentity.ts` (`CredentialGroupId = 'typhoon'|'aiforthai'|'scbx'`, `buildCredentialIdentity`, `credentialFingerprint`) so the AI-for-Thai group is the existing `aiforthai` id and the fingerprint is the existing secret-free hash. Reuse `cli/src/core/platform/credentialStore.ts` `CredentialStore` + `InMemoryCredentialStore` and the `OnboardingIO` shape from `cli/src/core/security/onboarding.ts`. The secret-free reference persisted in product storage mirrors how Typhoon onboarding records a fingerprint without the key. Inject a `clock` for timestamps in pure logic; do not call `new Date()`/`Date.now()` directly in the testable functions (the existing onboarding.ts uses Date.now in the I/O path — prefer an injectable clock for the new pure helpers).

## Verification

**Commands:**
- `npm run build` -- expected: tsc compiles with no errors.
- `npm test -- specialistCredentialOnboarding` -- expected: all cases pass.
- `npm test` -- expected: full suite green, no regressions.

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 14: (high 3, medium 6, low 5)
- defer: 4: (medium 2, low 2)
- reject: 4
- addressed_findings:
  - `[high]` `[patch]` Raw error messages leaked via `(e as Error).message` in app.ts and onboarding.ts — replaced with safe static messages.
  - `[high]` `[patch]` `persistence.invalidate()` return value unchecked in `removeAiForThaiCredential` — now checked; failure returns `store-error`.
  - `[high]` `[patch]` `persistence.invalidate()` return value unchecked in `rotateAiForThaiCredential` — now checked; failure returns `store-error`.
  - `[medium]` `[patch]` Hardcoded `'aiforthai'` string in app.ts `store.delete()` calls — replaced with imported `AI_FOR_THAI_CREDENTIAL_ID` constant.
  - `[medium]` `[patch]` No test coverage for `unavailable` cause path — added `validateCredentialRequest` host-mismatch test.
  - `[medium]` `[patch]` `removeAiForThaiCredential` masks store errors as `not-found` — improved error handling with clearer separation.
  - `[medium]` `[patch]` No direct test of CoreApp credential methods — added 6 integration tests for `hasAiForThaiCredential`, `removeAiForThaiCredential`, `rotateAiForThaiCredential`.
  - `[medium]` `[patch]` `io.readMasked()` throws unhandled — wrapped in try-catch, returns `unknown-outcome`.
  - `[medium]` `[patch]` `clock()` throws after `store.set` — wrapped in try-catch, cleans up key, returns `unknown-outcome`.
  - `[low]` `[patch]` `unknown-outcome` cause defined but never produced — now produced by readMasked-throw and clock-throw paths.
  - `[low]` `[patch]` `ensureAiForThaiCredential` falls through to re-onboarding without explanation — added `io.out` message explaining re-onboarding reason.
  - `[low]` `[patch]` `store.delete` cleanup after verification failure fails silently — added warning message via `io.err`.
  - `[low]` `[patch]` `io.out()`/`io.err()` throws EPIPE in redirected mode — wrapped all I/O calls in try-catch.
  - `[low]` `[patch]` `CredentialRemovalResult` missing `nextActions` on failure — not patched (deferred).

## Auto Run Result

**Summary:** Story 4.3 implements JIT AI-for-Thai credential onboarding under `cli/src/core/specialists/credential/`. The flow pauses at the connection boundary, discloses endpoint/purpose/storage/scope, opens a masked form only in interactive mode, stores the key in the OS CredentialStore under the shared `aiforthai` CredentialGroupId, and persists only a secret-free reference + revision + fingerprint. Typed failure causes (`cancelled`, `headless-blocked`, `unavailable`, `unhealthy`, `unknown-outcome`) with Inspect/Replace/Remove/Exit next actions. Remove/rotate invalidates the old reference and signals dependent generations stale.

**Files changed:**
- `cli/src/core/specialists/credential/types.ts` — NEW. Typed reference/revision/fingerprint, onboarding/removal/rotation results, disclosure constant.
- `cli/src/core/specialists/credential/onboarding.ts` — NEW. JIT onboarding flow with EPIPE-safe I/O, try-catch around readMasked/clock, unknown-outcome paths.
- `cli/src/core/specialists/credential/persistence.ts` — NEW. Secret-free reference persistence + invalidation interface and in-memory implementation.
- `cli/src/core/specialists/credential/index.ts` — NEW. Barrel export.
- `cli/src/core/app.ts` — MODIFY. Added `ensureAiForThaiCredential`, `hasAiForThaiCredential`, `removeAiForThaiCredential`, `rotateAiForThaiCredential`. Fixed hardcoded credential id string, raw error message leaks, unchecked invalidation results.
- `cli/test/specialistCredentialOnboarding.test.ts` — NEW. 37 tests covering all ACs, I/O matrix rows, unknown-outcome paths, CoreApp integration.

**Review findings breakdown:**
- Patches applied: 13 code fixes (3 high, 6 medium, 4 low severity)
- Items deferred: 4 (CredentialRemovalResult nextActions, InMemoryPersistence durability, destructive rotation ordering, hardcoded tlsVerified)
- Items rejected: 4 (JIT boundary wiring scope, readMasked interface contract, credentialRevision derivation, stderr diagnostics)

**Follow-up review recommendation:** false — all patches were localized, low-consequence fixes within the credential module. No API, security, or data-impact changes beyond the reviewed scope.

**Verification performed:**
- `npm run build` — tsc compiles with no errors.
- `npx vitest run specialistCredentialOnboarding credentialIdentity credentials` — 63 tests passed (3 files).
- `npx vitest run` — 58 files / 1586 tests passed, no regressions.

**Residual risks:**
- Rotation is destructive (old reference invalidated before new onboarding succeeds) — acknowledged in code comment; a future story could implement two-phase rotation.
- `tlsVerified: true` is asserted without actual TLS verification — the onboarding flow does not make network calls; verification happens at request time in the adapter.
- `InMemoryCredentialPersistence` is the default — a durable persistence implementation is a separate story.