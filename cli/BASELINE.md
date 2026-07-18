# thcode CLI — Brownfield Baseline Evidence

Captured by Story 1.1 on 2026-07-17 before any Story 1.x work changes the existing `cli/` prototype. The brownfield baseline rule (epics.md implementation conventions, project-context.md) requires the existing `cli/` package, headless `CoreApp`/Ink split, and current entry points to be inventoried and kept passing; no generated scaffold or wholesale rewrite is permitted.

## Baseline commands

| Command | Purpose | Result on 2026-07-17 |
| --- | --- | --- |
| `npm run build` | `tsc -p tsconfig.json` → `dist/` | Clean, no errors |
| `npm test` | `vitest run` (node env, `globals: false`, `test/**/*.test.ts`) | **77 passed** across 7 files after Story 1.1 (62 baseline + 15 new preflight tests) |
| `npm run dev` | `node --experimental-strip-types src/index.ts` | Interactive Ink path |

## Pre-Story-1.1 baseline (untouched prototype)

- Test count: **62 passed** across 6 files (`catalog` 10, `permissions` 19, `credentials` 11, `sessions` 3, `workspace` 11, `providers` 8).
- Build: `tsc -p tsconfig.json` clean.

## Entry points

- `src/index.ts` — CLI entry. `--version` / `--help` fast path (raw-mode free, never imports Ink/React). Startup preflight gate (Story 1.1) runs after the fast path and before `main()`. Interactive path lazily imports `ink`, `react`, `./ui/App.js`, `./core/app.js`.
- `src/core/app.ts` — `CoreApp`: the sole UI-facing facade (AD-2). UI layers interact only via this facade.
- `src/ui/App.tsx` — Ink root. Imports only `react`, `ink`, `../core/app.js` (type-only). No `fs` / `child_process` / network / adapter imports (preserved boundary, AD-1).

## Integration seams (preserve these; later stories converge incrementally)

- `CoreApp` facade (`cli/src/core/app.ts`) — dispatch surface for intents (full `CoreProtocolV1` arrives in Story 1.2).
- `AgentLoop` (`cli/src/core/agent/loop.ts`) — prompt-round loop.
- `ProviderRegistry` / `createDefaultProviderRegistry` (`cli/src/core/providers/registry.ts`) — Typhoon provider adapter.
- `ToolRegistry` / `createDefaultToolRegistry` (`cli/src/core/tools/registry.ts`).
- `ToolCatalog.load()` (`cli/src/core/catalog/loader.ts`) — Catalog Manifest (ADR 0011).
- `CredentialStore` + `createCredentialStore` (`cli/src/core/platform/index.ts`) — Windows DPAPI-file adapter; macOS Keychain is a known deferred gap (preflight reports `unavailable`, not a hard block for Epic 1).
- `thcodeStateDir()` / `credentialsDir()` / `sessionsDbPath()` (`cli/src/core/platform/paths.ts`).
- `redactSecrets()` (`cli/src/core/security/redact.ts`) — Sanitizer seed (AD-24 full Sanitizer is a later story).

## Core subdirectory inventory (brownfield, preserved)

```
cli/src/
  index.ts
  core/
    agent/
    aiforthai/
    app.ts
    artifacts/
    catalog/
    context/
    permissions/
    platform/
    providers/
    security/
    sessions/
    tools/
    preflight/        # added by Story 1.1
  ui/
    App.tsx
```

## Story 1.1 additions (converges incrementally; no wholesale rewrite)

- `cli/src/core/preflight/types.ts` — typed `PreflightResult` contract (AD-9, AD-24, AD-28).
- `cli/src/core/preflight/probes.ts` — pure, injectable environment probes (AD-23).
- `cli/src/core/preflight/run.ts` — `runPreflight(env)` composer + `runtimeEnvFromProcess`.
- `cli/test/preflight.test.ts` — 15 Vitest cases covering all six ACs.
- `cli/src/core/platform/credentialStore.ts` — added optional `availability()` probe and `CredentialStoreAvailability` type.
- `cli/src/core/platform/windowsCredentialStore.ts` — implements `availability()`.
- `cli/src/core/platform/credentialStore.ts` — `InMemoryCredentialStore` exposes `availability()` and a test-only `getCallCount()`.
- `cli/src/index.ts` — preflight gate wired between the fast path and `main()`.
- `cli/BASELINE.md` — this file.

## Install / update / uninstall determinism (AC #3)

- `cli/package.json` `bin.thcode` → `dist/index.js`; `files` includes `dist`, `catalog-manifest.json`, `README.md`; `engines.node` is `>=22`.
- npm uninstall does NOT delete encrypted user data or OS credentials. The local app-state dir (`thcodeStateDir()`) and the OS credential facility are owned by a separate user-data lifecycle, not the npm package lifecycle.
- First-run detection marker: `thcodeStateDir()/.installed`, written only on a supported, post-preflight first launch. Not removed by npm uninstall.