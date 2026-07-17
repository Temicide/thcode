# Story 3.6: Apply Guarded Destructive Deletion with Quarantine

## Goal

Make destructive deletion visibly scoped and safely quarantined, so recursive
removal cannot traverse changed content or claim protection it did not establish.

## Acceptance Criteria

### AC #1: DESTRUCTIVE preview with ordered manifest; Plan denies under every profile

- `previewDeletion()` returns a `DeletionPreview` with `label: 'DESTRUCTIVE'`
- Includes: root identity (canonical + display path), expected pre-image
  (digest/version/absent), ordered descendant identity/content manifest,
  count/size bounds, symlink/junction/mount/open-handle policy,
  checkpoint coverage, exclusions, OperationId, authority
- Plan mode returns `deny` under every profile
- Non-existent target returns preview with exclusions
- Target outside workspace returns `deny`

### AC #2: Manual profile requires explicit approval; Full Access cannot bypass rules

- Authorization binding must match exact target + digest
- Stale/mismatched authorization returns `stale-approval`
- Full Access profile cannot bypass destructive rules (Plan still denies)
- Full Access cannot bypass identity rules (stale approval still blocks)
- Full Access cannot bypass checkpoint rules (checkpoint always staged)

### AC #3: Ordered effect with EffectDispatchCommitted before quarantine+remove

- Exact 10-step ordered execution:
  1. Resolve stable identity
  2. Capture expected digest/version
  3. PEP/PermissionMatrix checks
  4-5. Stage + commit checkpoint
  6. Consume authorization + append EffectDispatchCommitted
  7. Atomic rename/quarantine on same filesystem
  8. Remove quarantined content
  9. Durable result/post-image/deletion Evidence
  10. Terminal event POST-COMMIT
- `EffectDispatchCommitted` appears in journal before quarantine
- `OperationSucceeded` is the last event (post-commit)
- Authorization consumed after checkpoint stage, before quarantine

### AC #4: Revalidation stops before removal on conflicts

- Non-existent target: stale-approval (digest mismatch)
- Symlink target: stale-approval (digest mismatch)
- Quarantine rename failure: `enforcement-unverified` with `quarantine-failed`
- Containment change: `conflict` with `containment-changed`
- Expired authorization: `stale-approval`
- No best-effort recursion on conflict
- Deterministic Evidence recorded on conflict

### AC #5: Success result records all fields; terminal result post-commit

- `deletedRoot` with canonical + display path
- `manifestIdentity` with descendant count + manifest digest
- `encryptedRecoverability`: `'retained'` when artifact store available
- `exclusions`: empty for clean execution
- `checkpointReference` with checkpointId + coverageState
- `completedAt` timestamp
- `OperationSucceeded` is last journal event (post-commit)
- Shell/process/remote effects never claimed reversible (AD-19)

## Files Changed

### New files

- `src/core/effects/deletionTypes.ts` — All deletion types:
  `DescendantIdentity`, `DeletionProposal`, `DeletionPreview`,
  `DeletionExecutionResult`, `DeletionConflict`, `QuarantineProvider`,
  `DeletionEffectContext`, `DeletionFailure`
- `src/core/effects/deletionPreview.ts` — `previewDeletion()` function
- `src/core/effects/deletionEffect.ts` — `applyDeletionEffect()` function
- `test/deletionEffect.test.ts` — 32 test cases covering all 5 ACs

### Modified files

- `src/core/effects/index.ts` — Added exports for deletion modules
- `src/core/app.ts` — Added `previewDelete()`, `applyDeleteEffect()`,
  `defaultQuarantineProvider()`

## Test Coverage

32 test cases across 5 AC groups + edge cases:

| Group | Tests | Coverage |
|-------|-------|----------|
| AC #1: DESTRUCTIVE preview | 7 | Label, fields, Plan deny, non-existent, outside workspace, manifest |
| AC #2: Manual approval | 4 | Binding match, Full Access limitations |
| AC #3: Ordered execution | 5 | Step ordering, journal events, quarantine |
| AC #4: Revalidation | 7 | Conflicts, quarantine failure, containment, expiry |
| AC #5: Success result | 7 | All result fields, terminal event, AD-19 |
| Edge cases | 2 | Thai UTF-8 content |

## Build & Test Results

- `npm run build`: Clean (0 errors)
- `npm test`: 603 passed, 0 failed (38 test files)
