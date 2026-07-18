---
story_id: "2.6"
story_key: "2-6-define-generic-prepared-payload-and-remote-transfer-consent-contracts"
epic: 2
baseline_commit: 99cc689
status: review
created: 2026-07-17
project: thcode
dependsOn: "2.4 (consent bound to activation/authority revision); 1.5 (Sanitizer boundary)"
---

# Story 2.6: Prepared-payload + remote-transfer consent contracts

Status: review

## Implementation
- cli/src/core/permissions/transferConsent.ts — PreparedPayloadManifest (sources/hashes, classification, purpose, transformation, recipient cap/ver + verified endpoint + method, call count, retention, op/round scope, expiry, canonical manifest digest + exact payload-byte digest). evaluateTransferConsent fails closed on unresolved classification/retention/destination, manifest-digest or payload-byte-digest mismatch, expired, unsafe payload — independent of local approval/Work Mode/Profile/Full Access. TransferConsent bound to both digests + recipient + endpoint + purpose + call count + expiry + op/round scope + activation/authority revision + policy version; revalidateTransferConsent before transport. assessPreparedPayloadSafety (complete/sanitized-with-omissions/not-authoritative), detectUnsafePreparedContent (credentials/unresolved paths/active content). CONTRACTS ONLY — no specialist adapter/registry/transport.
- cli/test/transferConsent.test.ts — 14 cases.

## Verify
- npm run build clean; npm test green.
