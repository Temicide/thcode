---
story_id: "3.8"
story_key: "3-8-run-non-mutating-dependency-preflight"
epic: 3
baseline_commit: 9765947
status: review
created: 2026-07-17
project: thcode
dependsOn: "3.1"
---

# Story 3.8: Run non-mutating dependency preflight

Status: review

## Implementation
- `cli/src/core/depPreflight/types.ts` — `EnvironmentProbe` port (injectable for tests); `PrerequisiteProbe` (id, displayName, category, platform, pure probe function); `PrerequisiteProbeResult` (verified|prerequisite-blocker|probe-failed|incompatible); `ProbeOutputClassification`; `PrerequisiteGuidance`; `DepPreflightResult` (platform, workspaceId, workspaceGeneration, fresh evidenceId per run, timestamp, per-probe results, overall, guidance); `DepPreflightFailure` (AD-9 envelope). No `any`.
- `cli/src/core/depPreflight/registry.ts` — maintained versioned registry (`DEP_PREFLIGHT_REGISTRY_VERSION=1`) of 4 approved probes: `node-runtime`, `cpp-compiler` (clang++/g++ on macOS, cl.exe on Windows), `npm`, `echo-command`. Each probe is a pure function over `EnvironmentProbe`. `runApprovedProbes` runs only matching-platform probes. `computeOverall` aggregates per-probe status. `PLATFORM_GUIDANCE` for darwin/win32. No invented URLs, no installers, no silent dependencies (AD-14, AD-15).
- `cli/src/core/depPreflight/run.ts` — `runDependencyPreflight(workspace, env, clock)`: fresh `randomUUID()` evidence identity per call (AC #4); runs approved probes; collects platform guidance; returns canonical `DepPreflightResult`. `defaultEnvironmentProbe()` uses real `child_process` for production. Pure/injectable: tests use fakes, never run real compilers.
- `cli/src/core/app.ts` — `runCheck()` method calls `runDependencyPreflight` with workspace binding + default env + clock. `executeCommand` `check` case replaced: calls `this.runCheck()`, renders `all-verified` as `succeeded` or anything else as `blocked` via `renderCommandOutput`.
- `cli/test/depPreflight.test.ts` — 30 test cases across all 5 ACs + registry integrity + output safety.

## AC coverage
- **AC #1** (bounded metadata, approved probes only, no install/modify): 4 tests — runs all approved probes, only approved probes, no install/modify, bounded workspace metadata.
- **AC #2** (C++ compiler present → verified + identity/version + platform/Workspace binding, no source/task claim): 4 tests — clang++ on macOS, g++ fallback, cl.exe on Windows, no source/task success claim.
- **AC #3** (missing/inaccessible/incompatible → blocker + platform guidance, no blame/invent/install): 6 tests — missing on macOS, missing on Windows, inaccessible, no source blame, no invented URLs, no privileged installers, no silent install.
- **AC #4** (rerun → fresh evidence, no stale reuse, unknown stays probe-failed): 4 tests — fresh evidence identity, environment change not stale, probe-failed on throw, incompatible preserved.
- **AC #5** (read-only across all modes, narrow/headless, no interactive gate, cannot authorize mutation): 4 tests — read-only, narrow/headless result, no mutation authorization, no mode/profile parameter.
- **Registry integrity**: 6 tests — version, required fields, unique ids, platform guidance, computeOverall variants.
- **Output safety (AD-24)**: 1 test — no raw errors/stacks/secrets in JSON.

## Verify
- `npm run build` clean; `npm test` green (existing + 30 new tests).
