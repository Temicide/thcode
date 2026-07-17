---
story_id: "2.7"
story_key: "2-7-enforce-credential-identity-and-service-host-isolation"
epic: 2
baseline_commit: 5783bcd
status: review
created: 2026-07-17
project: thcode
dependsOn: "1.6 (Typhoon credential onboarding); 2.4 (changed credential staleates prior authorization)"
---

# Story 2.7: Credential identity + service-host isolation

Status: review

## Implementation
- cli/src/core/permissions/credentialIdentity.ts — CredentialGroupId (typhoon/aiforthai/scbx), CredentialIdentity (group + service identity + verified host + revision + secret-free fingerprint), validateCredentialRequest (rejects cross-origin redirect / TLS bypass / host mismatch), checkCredentialBoundary (group-mismatch violation denied without contact), isCredentialAuthorityStale (revision/health-generation change staleates approval/consent), projectConnectionInfo (secret-free; TYPHOON_VERSION_UNVERIFIED non-affirmative pin), scrubConnectionSecrets (defense-in-depth Authorization/Bearer/api-key/credential-in-URL scrub).
- cli/test/credentialIdentity.test.ts — 15 cases across all 6 ACs.

## Verify
- npm run build clean; npm test green.
