---
title: 'Story 4.3: Onboard the shared AI-for-Thai credential just in time'
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
- [ ] `cli/src/core/specialists/credential/types.ts` -- typed reference/revision/fingerprint + typed onboarding/removal/rotation results + disclosure constant.
- [ ] `cli/src/core/specialists/credential/onboarding.ts` -- JIT flow: pause + disclosure + interactive-only masked form + store + verify + record; typed failure causes with Inspect/Replace/Remove/Exit; never to Typhoon/logs/etc.
- [ ] `cli/src/core/specialists/credential/persistence.ts` -- secret-free reference persistence + invalidation (no cached secret in buffers/persistence).
- [ ] `cli/src/core/specialists/credential/index.ts` -- barrel export.
- [ ] `cli/src/core/app.ts` -- AI-for-Thai onboarding accessor + JIT connection boundary hook.
- [ ] `cli/test/specialistCredentialOnboarding.test.ts` -- unit-test the I/O matrix edge cases + all ACs.

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