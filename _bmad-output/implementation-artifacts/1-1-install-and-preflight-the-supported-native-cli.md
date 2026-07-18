---
story_id: "1.1"
story_key: "1-1-install-and-preflight-the-supported-native-cli"
epic: 1
baseline_commit: b0a1705b6df7be940478795c74fd02e3c4aaa86
status: review
created: 2026-07-17
project: thcode
---

# Story 1.1: Install and preflight the supported native CLI

Status: review

<!-- Note: Validation is optional. Run validate-create-story for a quality check before dev-story. -->

## Story

As a developer
I want to install and launch `thcode` through npm with a startup preflight
so that I know before any effect whether this machine can run the supported product.

## Acceptance Criteria

1. **Clean-machine supported launch (FR-1, NFR-10, AD-23).** Given a clean machine running Windows 11 25H2+ with Windows Terminal/PowerShell through `pwsh.exe`, or macOS 14+ with Terminal/zsh, and Node.js `>=22`; when I run the documented global npm install and then `thcode`; then the command launches reproducibly and startup preflight reports the detected platform, shell, Node version, output mode, local store posture, and credential/key-store posture before any provider call or other effect.

2. **Unsupported environment blocks (FR-1, NFR-12, AD-23).** Given Node.js is below 22, the platform is unsupported, or the shell is Linux, WSL, Windows PowerShell 5.1, Git Bash/MSYS, or another non-native shell; when I launch `thcode`; then startup stops with the canonical `blocked`/typed unsupported-environment result, a safe remediation or exit action, the documented nonzero exit class/code, and no credential prompt, store write, network call, or effect.

3. **Install/update/uninstall deterministic (FR-1).** Given the CLI is installed globally; when I perform the supported npm update and uninstall procedures and reinstall cleanly; then the executable name, package behavior, and first-run detection are deterministic, and uninstall/update does not claim to delete encrypted user data or OS credentials unless that operation was explicitly requested through a separate supported lifecycle.

4. **Redirected/headless preflight (UX-DR-004, UX-DR-098–100, UX-DR-120).** Given the terminal is redirected or has no TTY; when startup requires an interactive action; then preflight emits the canonical ordered machine-readable/text record to stdout/stderr, reports `blocked` with `next: rerun interactively`, and never reads a secret or waits for an implicit prompt.

5. **Unknown/failed probe is typed (FR-1, AD-9, UX-DR-120).** Given a preflight probe fails or returns an unknown result; when the result is rendered; then it is labeled with a typed cause and recovery action, never presented as supported, and is safe to inspect without exposing environment secrets or raw errors.

6. **Brownfield baseline preserved (AD-1, AD-2, project-context.md brownfield rule).** Given the existing brownfield `cli/` prototype with its headless `CoreApp`/Ink split and current entry point; when Story 1.1 is implemented; then the work inventories the existing `cli/` package, establishes a passing baseline build and test run before changes, preserves the headless `CoreApp`/Ink boundary, does not replace the workspace with a generated scaffold or wholesale rewrite, and converges incrementally toward the target architecture. The baseline build/test command, expected passing count, current entry points, and integration seams are recorded as Evidence before any later Story 1.x work changes them.

## Tasks / Subtasks

- [x] **Task 1: Capture brownfield baseline Evidence (AC: #6)**
  - [x] 1.1 Run `npm run build` and `npm test` in `cli/` and record the exact passing test count (observed 62 passing across 6 files on 2026-07-17) into a new `cli/src/core/preflight/baseline.ts` Evidence record (or `cli/BASELINE.md`), including the commands used, Node version, OS, and entry points (`src/index.ts`, `src/core/app.ts`, `src/ui/App.tsx`).
  - [x] 1.2 Verify the headless `CoreApp`/Ink boundary is preserved: `src/ui/App.tsx` imports only `CoreApp` and Ink/React; it does NOT import `fs`, `child_process`, network, or adapter internals. Add a regression test asserting UI files import only `core/app.js`, `react`, `ink`.
  - [x] 1.3 Confirm no generated scaffold or wholesale rewrite is introduced; record a short inventory of existing `cli/src/core/*` subdirectories in the Evidence record.

- [x] **Task 2: Define the typed preflight result contract (AC: #1, #2, #5, #6)**
  - [x] 2.1 Create `cli/src/core/preflight/types.ts` with a discriminated union `PreflightResult` covering: `supported`, `blocked` (with cause), and `unknown` (with cause). Each variant carries: detected platform, shell, Node version (or `null`), output mode (`interactive` | `redirected` | `headless`), local store posture (`ok` | `unavailable` | `unknown`), credential/key-store posture (`ok` | `unavailable` | `unknown`), safe message, typed `cause` code, `recovery` action, and canonical exit class/code per AD-28.
  - [x] 2.2 Map the canonical exit codes from UX-DR-100: `SUCCESS=0`, `BLOCKED=20`, `FAILED=30` (use `BLOCKED=20` for unsupported-environment per AC #2). Document the mapping in a comment citing UX-DR-100 and AD-28.
  - [x] 2.3 Keep `PreflightResult` free of secrets: no env values, raw errors, or credential material. It is safe to render, persist, and log (AD-9, AD-24).

- [x] **Task 3: Implement deterministic environment probes (AC: #1, #2, #5)**
  - [x] 3.1 Create `cli/src/core/preflight/probes.ts` with pure functions that take an injectable `RuntimeEnv` (`{ platform: NodeJS.Platform; shell: string; nodeVersion: string; tty: boolean; localAppStateDir?: string; hasCredentialStore: boolean }`) and return typed probe results. No direct `process.*` access inside probes — pass everything in for testability.
  - [x] 3.2 `probePlatform()`: supported = `win32` and (shell is `pwsh.exe`/Windows Terminal) OR `darwin` and (shell is `zsh`/Terminal). Unsupported = `linux`, WSL indicators, PowerShell 5.1 (`powershell.exe` without `pwsh`), Git Bash/MSYS (`MSYSTEM` env set), or any non-native shell. Unknown probe failure → `unknown` variant.
  - [x] 3.3 `probeNodeVersion()`: parse `process.version` (or injected string); `<22` → blocked cause `unsupported-node-version` with remediation action; `>=22` → ok.
  - [x] 3.4 `probeOutputMode()`: `interactive` if `process.stdout.isTTY === true`; `redirected` if a TTY exists on stderr only or `--json` mode; `headless` if no TTY at all.
  - [x] 3.5 `probeLocalStorePosture()`: check `thcodeStateDir()` parent is writable (best-effort, typed; unknown on failure). Reuse existing `cli/src/core/platform/paths.ts`.
  - [x] 3.6 `probeCredentialStorePosture()`: use `createCredentialStore()` from `cli/src/core/platform/index.ts`; call a non-mutating `availability()` check (add one if missing) — NEVER write a credential during preflight. Return `ok` (Windows DPAPI-file adapter), `unavailable` (macOS in-memory fallback until Keychain ships — record as known gap, NOT a hard block for Epic 1), or `unknown` on probe failure.

- [x] **Task 4: Compose the preflight runner (AC: #1, #2, #4, #5)**
  - [x] 4.1 Create `cli/src/core/preflight/run.ts` exporting `runPreflight(env: RuntimeEnv): PreflightResult` that calls the probes in a fixed order (platform → node → output mode → local store → credential store), short-circuits to `blocked` on the first hard blocker (platform or node), and composes the aggregate result.
  - [x] 4.2 Fail closed: any probe that throws or returns unknown is folded into an `unknown` aggregate with a typed cause, NEVER rendered as `supported` (AC #5, NFR-12).
  - [x] 4.3 For headless/redirected mode (AC #4): if output mode is `headless` or `redirected` and any required interactive action is pending, the result is `blocked` with `next: rerun interactively`, exit code `BLOCKED=20`, and NO secret read or implicit prompt wait.

- [x] **Task 5: Wire preflight into the entry point (AC: #1, #2, #4, #6)**
  - [x] 5.1 In `cli/src/index.ts`, AFTER the existing `--version`/`--help` fast path, add a `runPreflight` call before `main()` (which imports Ink). The fast path must remain raw-mode free (do not import Ink/React before preflight passes).
  - [x] 5.2 On `supported`: continue to `main()` (interactive Ink path) or emit a one-line machine-readable supported record on `--json`/headless.
  - [x] 5.3 On `blocked`/`unknown`: emit the canonical ordered record to stdout (safe summary) and stderr (diagnostics per UX-DR-099), then `process.exit(exitCode)` with the mapped code. NEVER import Ink on a blocked path.
  - [x] 5.4 Preserve the existing `CoreApp({ workspaceRoot: process.cwd() })` construction and `App` render — do not restructure the headless/Ink split.

- [x] **Task 6: Install/update/uninstall determinism (AC: #3)**
  - [x] 6.1 Verify `cli/package.json` `bin.thcode` → `dist/index.js`, `files` includes `dist`, `catalog-manifest.json`, `README.md`, and `engines.node` is `>=22`. Adjust only if drifted; record current state in Evidence.
  - [x] 6.2 Add a `prepublishOnly`/`prepack` guard (or confirm `npm run build` produces `dist/index.js`) so the published artifact is deterministic. Do NOT add a postuninstall hook that deletes user data — document in `cli/README.md` that uninstall does not touch the OS credential facility or encrypted user data unless an explicit separate lifecycle is invoked.
  - [x] 6.3 Add a first-run detection marker file (`thcodeStateDir()/.installed`) written only on a supported, post-preflight first launch. Document that npm uninstall does not remove it (user data lifecycle is separate).

- [x] **Task 7: Tests (red-green-refactor) (AC: #1–#6)**
  - [x] 7.1 `cli/test/preflight.test.ts` — Vitest, node env, `globals: false`. Cases: supported Windows/pwsh + Node 24; supported macOS/zsh + Node 22; blocked Node 20; blocked Linux; blocked WSL (`MSYSTEM` set); blocked PowerShell 5.1 (`powershell.exe`); blocked Git Bash/MSYS; unknown probe failure folds to `unknown`; headless mode with pending interactive action → blocked `rerun interactively`; exit code mapping (0/20/30); no secret read on any blocked path (assert `credentialStore.get` never called during preflight).
  - [x] 7.2 Inject a fake `RuntimeEnv` and a fake `CredentialStore` with a `availability()` spy; assert no `set`/`get` of secret material during `runPreflight`. Reuse `InMemoryCredentialStore` from `cli/src/core/platform/credentialStore.ts`.
  - [x] 7.3 Boundary regression: assert `src/ui/App.tsx` (and any future UI file) imports only from `core/app.js`, `react`, `ink` — fail if `fs`, `child_process`, `net`, `https`, or `core/adapters/*` appear in UI imports.
  - [x] 7.4 Run `npm run build` and `npm test` from `cli/`; confirm the baseline passing count (62) is preserved or increased (no regressions). Record the new count in Dev Agent Record → Completion Notes.

- [x] **Task 8: Evidence record and completion (AC: #6)**
  - [x] 8.1 Write `cli/BASELINE.md` (or extend `cli/src/core/preflight/baseline.ts`) capturing: baseline commands (`npm run build`, `npm test`), baseline passing count, current entry points, integration seams (`CoreApp` facade, `AgentLoop`, `ProviderRegistry`, `ToolRegistry`, `CredentialStore`, `ToolCatalog`), and the brownfield inventory of `cli/src/core/*`.
  - [x] 8.2 Update File List and Change Log in this story file; set Status to `review` once all gates pass.

## Dev Notes

### Architecture & Invariants

- **AD-1 (inward dependency direction):** `ui → application → ports ← adapters`. Preflight is a platform/application concern; it MAY read `process`/`os` via injected `RuntimeEnv` but MUST NOT import concrete adapters into UI. Place preflight under `cli/src/core/preflight/` (application/core layer), NOT under `ui/`.
- **AD-2 (CoreApp facade):** Preflight runs BEFORE `CoreApp` construction on the entry path. It does not need `CoreApp`; it is a gate that decides whether `CoreApp`/Ink may start. Do not route preflight through `CoreApp.dispatch` — that contract is established in Story 1.2.
- **AD-9 (typed failure envelope):** `PreflightResult` is a small typed envelope; no raw `Error.message` crosses to UI/logs. Use deterministic `cause` codes (`unsupported-platform`, `unsupported-shell`, `unsupported-node-version`, `probe-failed`, `interactive-required-in-headless`).
- **AD-23 (two native platforms):** Windows 11 25H2+ (Windows Terminal/PowerShell via `pwsh.exe`) and macOS 14+ (Terminal/zsh). Linux, WSL, PowerShell 5.1, Git Bash/MSYS are OUT of scope and MUST block.
- **AD-24 (sanitization):** `PreflightResult` carries no env values, raw errors, or credential material — it is safe to render, persist, log.
- **AD-28 (five dimensions):** Preflight `blocked` is an operation status; `unsupported` is a cause, not a separate status. Exit class is `BLOCKED` (code 20) for unsupported-environment; `SUCCESS` (0) only for `supported`. Never emit `SUCCESS=0` for a blocked path.

### UX Requirements (UX-DR-001–004, 098–100, 120)

- **UX-DR-004:** headless path for noninteractive use exists.
- **UX-DR-098:** detect TTY/output mode before any interactive gate; without TTY, approval/consent/credential/uncertain-classification MUST fail closed before preparation/dispatch. Preflight applies the same rule: no secret read or implicit prompt wait when headless.
- **UX-DR-099:** normal results → stdout; warnings/refusals/diagnostics/progress → stderr. Preflight emits the safe summary to stdout and the typed diagnostic/cause to stderr on blocked paths.
- **UX-DR-100:** exit codes `0, 1, 10, 20, 30, 70, 130`. Use `0` (SUCCESS) for supported, `20` (BLOCKED) for unsupported-environment, `30` (FAILED) for unknown probe failure. Do not invent new codes.
- **UX-DR-120:** when downstream decisions are absent show `ENFORCEMENT UNVERIFIED`, `budget not set`, etc., never invent values. Preflight reports credential/key-store posture honestly as `ok | unavailable | unknown` — the macOS Keychain gap is `unavailable` (known, recorded), not invented as `ok`.

### Project Structure Notes

- New code lives in `cli/src/core/preflight/` (`types.ts`, `probes.ts`, `run.ts`, optional `baseline.ts`). This obeys the hexagonal boundary and the existing `cli/src/core/*` subdirectory convention.
- The entry point `cli/src/index.ts` gains a preflight call between the `--version`/`--help` fast path and `main()`. The fast path stays raw-mode free (no Ink import). The blocked path MUST NOT import Ink.
- Reuse existing platform helpers: `cli/src/core/platform/paths.ts` (`thcodeStateDir`), `cli/src/core/platform/index.ts` (`createCredentialStore`), `cli/src/core/platform/credentialStore.ts` (`InMemoryCredentialStore` for tests).
- Tests in `cli/test/preflight.test.ts` follow the existing Vitest pattern (`globals: false`, node env, no network, no real credentials). See `cli/test/credentials.test.ts` and `cli/test/workspace.test.ts` for style.
- TypeScript strictness: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `forceConsistentCasingInFileNames`. Use `import type` for type-only imports. Use `.js` specifiers in relative imports (NodeNext).

### Brownfield Baseline (recorded 2026-07-17)

- `cli/` package: `thcode@0.1.0`, ESM, Node `>=22`, Vitest 2.1.9, TS 5.9.3 strict.
- Entry points: `src/index.ts` (CLI entry, `--version`/`--help` fast path + lazy Ink import), `src/core/app.ts` (`CoreApp` facade), `src/ui/App.tsx` (Ink root).
- Core subdirectories: `core/{agent,aiforthai,app.ts,artifacts,catalog,context,permissions,platform,providers,security,sessions,tools}`.
- Baseline build: `npm run build` (tsc → `dist/`) passes clean.
- Baseline tests: `npm test` → **62 passed across 6 files** (`catalog` 10, `permissions` 19, `credentials` 11, `sessions` 3, `workspace` 11, `providers` 8).
- Headless/Ink boundary: `src/ui/App.tsx` imports only `react`, `ink`, `core/app.js` — preserve this.

### Known Gaps (do NOT fix in this story)

- macOS Keychain `CredentialStore` adapter is not yet implemented (`cli/src/core/platform/index.ts` falls back to `InMemoryCredentialStore`). Preflight reports this as `unavailable` with a recorded note; it is NOT a hard block for Epic 1 (no credential prompt happens during preflight). The Keychain adapter is a later platform story.
- `CoreProtocolV1` (Story 1.2) does not yet exist; preflight uses its own small typed `PreflightResult`, NOT the canonical protocol. Do not pre-build CoreProtocolV1 here.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1] (lines 445–473)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md#AD-1, #AD-23, #AD-28]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-thcode-2026-07-17/EXPERIENCE.md#UX-DR-098-100]
- [Source: _bmad-output/project-context.md#Technology-Stack, #Critical-Implementation-Rules, #Critical-Dont-Miss-Rules]
- [Source: cli/src/index.ts, cli/src/core/app.ts, cli/src/core/platform/*, cli/vitest.config.ts, cli/tsconfig.json]

## Dev Agent Record

### Agent Model Used

glm-5.2 (ollama-cloud)

### Debug Log References

### Completion Notes List

- Baseline captured on 2026-07-17: `npm run build` clean; `npm test` 62 passed across 6 files; headless `CoreApp`/Ink boundary verified. Written to `cli/BASELINE.md`.
- Implemented typed preflight gate under `cli/src/core/preflight/` (`types.ts`, `probes.ts`, `run.ts`) following AD-1/AD-9/AD-23/AD-24/AD-28 and UX-DR-004/098–100/120. Probes are pure and take an injectable `RuntimeEnv`; no direct `process.*` access inside probes.
- Added non-mutating `CredentialStore.availability()` probe (optional method) + `CredentialStoreAvailability` type; implemented on `InMemoryCredentialStore` and `WindowsCredentialStore`. Preflight never reads or writes a secret (asserted by `getCallCount() === 0` on blocked paths).
- Wired preflight into `cli/src/index.ts` between the `--version`/`--help` fast path and `main()`. Blocked/unknown path emits safe summary to stdout, typed diagnostics to stderr, and exits with canonical codes (0/20/30) — NEVER imports Ink on a blocked path.
- macOS Keychain gap recorded honestly as `unavailable` (not a hard block for Epic 1; no credential prompt happens during preflight).
- Added 15 Vitest cases in `cli/test/preflight.test.ts` covering all six ACs: supported Windows/macOS, blocked Node<22 / Linux / WSL / PowerShell 5.1 / Git Bash, unknown probe failure → `unknown`, headless → `interactive-required-in-headless`, exit-code mapping, secret-safety of serialized result, and UI boundary regression.
- Added UI boundary regression test asserting `src/ui/App.tsx` imports only `react`, `ink`, `../core/app.js`.
- Updated `cli/package.json`: added `prepublishOnly` guard (`npm run build && npm test`) and `BASELINE.md` to `files`.
- Final: `npm run build` clean; `npm test` → **77 passed across 7 files** (62 baseline + 15 new preflight). No regressions. Exit codes verified end-to-end via `node dist/index.js` (blocked headless → exit 20; `--version` → exit 0).

### File List

- `cli/src/core/preflight/types.ts` (new) — typed `PreflightResult` contract.
- `cli/src/core/preflight/probes.ts` (new) — pure, injectable environment probes.
- `cli/src/core/preflight/run.ts` (new) — `runPreflight(env)` composer + `runtimeEnvFromProcess`.
- `cli/test/preflight.test.ts` (new) — 15 Vitest cases.
- `cli/src/core/platform/credentialStore.ts` (modified) — added optional `availability()` probe, `CredentialStoreAvailability` type, `InMemoryCredentialStore.getCallCount()` test affordance.
- `cli/src/core/platform/windowsCredentialStore.ts` (modified) — implements `availability()`.
- `cli/src/index.ts` (modified) — preflight gate wired between fast path and `main()`.
- `cli/package.json` (modified) — `prepublishOnly` script, `BASELINE.md` in `files`.
- `cli/BASELINE.md` (new) — brownfield baseline Evidence record.

### Change Log

- 2026-07-17: Story created from epics.md Story 1.1 with comprehensive brownfield context, architecture ADs, UX-DRs, and red-green-refactor task breakdown.
- 2026-07-17: Story 1.1 implemented — typed startup preflight gate, pure injectable probes, headless/Ink boundary preserved, 15 new tests (77 total passing), build clean. Status → review.