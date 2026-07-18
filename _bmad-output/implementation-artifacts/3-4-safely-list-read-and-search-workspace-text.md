---
story_id: "3.4"
story_key: "3-4-safely-list-read-and-search-workspace-text"
epic: 3
baseline_commit: 9765947
status: review
created: 2026-07-17
project: thcode
dependsOn: "3.1;2.2"
---

# Story 3.4: Safely list, read, and search Workspace text

Status: review

## Implementation

- `cli/src/core/inspection/types.ts` — `InspectionRequest` (list/read/search discriminated union), `InspectionResult` (sanitized; path/type/size/digest metadata; bounded content or typed refusal), `InspectionRefusal` (discriminated: `denied`|`inaccessible`|`conflict`|`enforcement-unverified`|`over-limit`|`binary-refused`|`malformed-utf8`), `InspectionLimits` (maxRecursionDepth, maxFileCount, maxTextBytes, maxSearchWork, maxFileSize), `InspectionFsProbe` (extends FsProbe with readdirSync/readFileSync), `defaultInspectionFsProbe()`. No `any`. AD-9 failures.

- `cli/src/core/inspection/list.ts` — `inspectList()`: bounded directory listing. Resolves + revalidates every resource identity via Story 3.1 (`resolveWithinWorkspace` + `checkContainment`), stays within Workspace, no-follow (symlinks/junctions/mount points not traversed), bounds recursion + file count, returns sanitized entries with path/type/size/digest metadata. Refusals per AC #2.

- `cli/src/core/inspection/read.ts` — `inspectRead()`: bounded file read. Revalidates identity, applies no-follow + file-size limit, detects binary (null bytes in first 4KB), hostile (extremely long lines >10K chars), over-limit, malformed-UTF-8 (round-trip verification), active-external-references (require/import/fetch/exec/spawn/eval/URL patterns). Returns bounded metadata or typed refusal. Preserves valid Thai UTF-8 + technical identifiers. Never silently decodes/expands/transfers.

- `cli/src/core/inspection/search.ts` — `inspectSearch()`: bounded text search. Revalidates identity, bounds search work + file count + text bytes, no-follow, sanitized matches with metadata. Same binary/hostile/malformed-utf8 handling as read. Skips binary/hostile/malformed/active-ref files silently.

- `cli/src/core/inspection/policy.ts` — `evaluateInspectionPolicy()`: mediate each request through the local PEP/PermissionMatrix. AC #4: Manual profile + eligible/in-Workspace/non-transferring inspection proceeds WITHOUT approval interruption (PEP allows non-mutating actions in Manual). AC #5: Plan mode is structurally read-only (PEP denies mutating actions in Plan before any profile check). Resulting plan/Evidence cannot be consumed as mutation authorization.

- `cli/src/core/inspection/index.ts` — barrel export.

- `cli/src/core/app.ts` — `inspectList(path, opts)`, `inspectRead(path, opts)`, `inspectSearch(query, path, opts)` methods that run through PEP + return sanitized results/refusals. Uses `defaultInspectionFsProbe()` for production.

- `cli/test/inspection.test.ts` — 40 test cases across all 5 ACs with injectable in-memory fs + clock. Covers: valid list/read/search with metadata + no-follow + bounds; out-of-Workspace/ambiguous/inaccessible/symlink → denied/inaccessible/conflict/enforcement-unverified; binary/hostile/over-limit/malformed-UTF-8/active-external-refs → typed refusal + Thai preserved + no silent decode; Manual eligible non-transferring inspection proceeds without interruption; Plan read-only + plan/Evidence cannot be consumed as authorization.

## Verify

- `npm run build` clean
- `npm test` green (536 tests, 40 new)
