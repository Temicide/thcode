---
story_id: "3.1"
story_key: "3-1-resolve-workspace-platform-resource-identity"
epic: 3
status: review
created: 2026-07-17
project: thcode
dependsOn: "PR-3;1.3;2.2;2.3"
---

# Story 3.1: Resolve Workspace, platform, and resource identity with bounded read policy

Status: review

## Implementation

- `cli/src/core/workspace/types.ts` — typed contracts: `WorkspaceId` (opaque branded), `WorkspaceIdentity` (workspaceId, platform identity, canonical root, case/Unicode policy, volume/device identity, binding status), `ResourceIdentity` (canonical path, display path, type, size, expected digest, version, identity-proven flag), `ContainmentDecision` (allowed/denied/conflict/enforcement-unverified), `EnforcementStatus`, `Failure` (AD-9 envelope), `FsProbe` and `PlatformProbe` injectable ports. Discriminated unions; opaque typed ids; no `any`.

- `cli/src/core/workspace/identity.ts` — `establishWorkspaceBinding(root, opts)`: records stable WorkspaceIdentity with platform identity (from injectable platformProbe), canonical root identity (realpath), case/Unicode policy per platform, volume/device identity (fs.statfs/fs.stat dev/ino, gracefully degraded), and explicit binding status. Missing/inaccessible root → `blocked` with deterministic workspaceId from string-level path. Pure/injectable: accepts `platformProbe` and `fsProbe` ports. Exports `defaultPlatformProbe()` and `defaultFsProbe()` for production use.

- `cli/src/core/workspace/resourceResolver.ts` — `resolveResource(ws, candidate, opts)`: produces canonical ResourceIdentity + display path + type + size + expected digest/version WITHOUT treating a display string as authority. Reuses `resolveWithinWorkspace` from `tools/workspace.ts` for containment. Identity-proven flag is false when no fsProbe is available. Throws `WorkspaceBoundaryError` on escape.

- `cli/src/core/workspace/containment.ts` — `checkContainment(ws, target, opts)`: follows only the explicitly allowed no-follow policy for symlinks/junctions/mount points/reparse points; revalidates the target immediately before use; returns `denied`/`conflict`/`enforcement-unverified` rather than claiming containment when identity cannot be proven. Walks each path component checking for symlinks. Uses `fs.lstat`/`fs.readlink` via injectable fsProbe; never silently follow.

- `cli/src/core/workspace/enforcement.ts` — PR-3 platform/action enforcement matrix as a versioned, frozen data structure. `enforcementAvailable(platform, action)` → boolean. `enforcementStatus(platform, action)` → `EnforcementStatus` with safe inspectable reason. Covers win32 and darwin for filesystem-write, filesystem-delete, command-exec, network-transfer. Unsupported platforms/actions return unavailable.

- `cli/src/core/workspace/boundedReadPolicy.ts` — `evaluateBoundedRead(input)`: evaluates list/read/search through the local PEP/PermissionMatrix: permits only bounded, non-sensitive in-Workspace inspection. Composes hard boundary check (workspace containment) + PEP evaluation. Plan stays structurally read-only (DENY mutating first). Manual does not interrupt eligible inspection when no material transfer occurs. Full Access cannot expand the Workspace or bypass platform checks. Delegates to `permissions/policy.ts` `evaluatePermission` (pure) — does not re-implement precedence.

- `cli/src/core/app.ts` — added `workspaceBinding()` returning the established `WorkspaceIdentity`; `resolveWorkspaceResource(candidate, opts)` producing `ResourceIdentity`; `checkWorkspaceContainment(target, opts)` returning `ContainmentDecision`. Updated constructor and `beginNewActivation` to use `establishWorkspaceBinding` instead of the old `workspaceIdentity`. `enforcementVerified: false` semantics remain consistent with existing projections.

- `cli/test/workspaceIdentity.test.ts` — 31 test cases across all 6 ACs. Uses injectable in-memory fs/platform probes for offline deterministic tests. Real fs (tmp dir) used only for symlink containment test. Covers: bound vs blocked root (4), canonical resource identity vs display string (5), symlink/junction containment (6), bounded read PEP (6), enforcement unverified (7), cross-cutting (3).

## Verify

- `npm run build` clean (tsc, strict).
- `npm test` green (432 tests, 33 files).
