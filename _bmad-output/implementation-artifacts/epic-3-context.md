# Epic 3 Context: Complete and Reverse a Verified Local Coding Task

Cached epic context for Epic 3 implementation. Source: `_bmad-output/planning-artifacts/epics.md` (lines 1141–1572). Do not reload raw PRD/architecture/UX docs — this file + the cited source lines are the planning context.

## Epic goal

A developer can inspect a declared Workspace, establish encrypted rollback protection before mutation, create/edit/delete bounded files, execute controlled commands, verify results, and reverse eligible built-in changes through the canonical cross-platform C++ `Hello, World!` proof. Builds on Epics 1–2 (CoreProtocolV1, durable journal + post-commit events, encrypted persistence + OS-backed DEK, Sanitizer, Runtime Activation, PermissionMatrix, PEP, exact operation authorization, headless parity, canonical UX state/output).

**Prerequisite:** PR-3 platform/action enforcement matrix (PRD §12.1 PR-3, AD-12). Stories 3.1, 3.7, 3.11 fail closed with `ENFORCEMENT UNVERIFIED` only when an already-approved matrix mechanism is unavailable — they do not wait on Epic 7.

**FRs covered:** FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-33, FR-34, FR-35.

## Implementation conventions (from epics.md Overview + project-context.md)

- Pure ESM, `.js` specifiers in relative imports, strict TS, no `any` (use `unknown` + narrowing or typed ports), discriminated unions over optional flags.
- Hexagonal boundaries: `ui → application → ports ← adapters`. UI must not import fs/network/child_process. `CoreApp` (`cli/src/core/app.ts`) is the sole UI-facing facade.
- AD-9 typed failure envelope: deterministic `category`, `retryable`, `scope`, safe message, cause code, optional `retryAfter`. Never leak raw vendor exceptions/secrets/stacks.
- AD-13 effect state machine: `proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled`. `EffectDispatchCommitted` is the check-to-effect linearization point.
- AD-19 rollback honesty: automatic rollback covers checkpointed built-in create/edit/delete ONLY. Shell/process/remote/permission/symlink-side/external effects are NEVER claimed reversible. Over-cap (>100 MB checkpoint or >500 MB store) requires explicit confirmation without rollback protection.
- AD-21 encryption: AES-256-GCM, per-install DEK from OS credential facility, collision-resistant nonce, authenticated metadata; plaintext originals never enter SQLite/logs/UI/Evidence/unencrypted temp.
- AD-22 Runtime Activation is FRESH on process start / session create-open-switch / workspace rebind: Manual profile, no temporary approvals, no transfer consent. Full Access is session-only.
- AD-28: keep operation status, lifecycle fact, Evidence completeness, measurement quality, process exit mechanically distinct. `effect-already-committed` is a lifecycle fact, not `succeeded`. `COMMAND_ERROR` is a display heading over `blocked`/`malformed`.
- Tests: Vitest, offline, node env, `globals: false`, `cli/test/**/*.test.ts`. No real creds/network/Typhoon. Inject a clock; never `new Date()` in testable domain code. Run from `cli/`: `npm run build` then `npm test`.
- One responsibility per file; types in `types.ts`; header comments cite governing AD/ADR. Files lowercase kebab/camel matching the directory.
- Per-story deliverable (match `2-13-...md` format): code under `cli/src/core/...`, tests under `cli/test/`, compact implementation-artifact md here. Build + test must be green.

## Existing seams to build on (do NOT rewrite; converge incrementally)

- `cli/src/core/app.ts` — `CoreApp` facade. Already wires: RuntimeActivation, PEP + EffectExecutor (`evaluateEffect`/`authorizeEffect`), AuthorizationRegistry (`grantApproval`/`revalidateAuthorization`/`consumeAuthorization`/`revokeAuthorization`), BoundaryExpansionRegistry, workspace identity, command grammar dispatch (`dispatchCommand`/`executeCommand`). Epic 3 adds checkpoint/mutation/rollback/command surfaces here.
- `cli/src/core/tools/workspace.ts` — `resolveWithinWorkspace(root, candidate)` + `WorkspaceBoundaryError`. Handles drive letters, backslashes, case, `..`, cross-drive/UNC. REUSE for all path resolution.
- `cli/src/core/tools/registry.ts` + `tools/types.ts` + `tools/builtin/{listDir,readFile,search,writeFile,runCommand}.ts` — existing builtin tools (prototype). Epic 3 hardens them with identity/digest/checkpoint/PEP mediation.
- `cli/src/core/sessions/repository.ts` — `SessionRepository` (append idempotent, post-commit publish, dedup by EventId). Journal is the sole commit-visibility authority.
- `cli/src/core/sessions/crypto.ts` — AES-256-GCM envelope helpers (Story 1.4). Reuse for ArtifactStore encryption.
- `cli/src/core/sessions/{store,operationState,formatVersion,journal}.ts` — store + operation lifecycle.
- `cli/src/core/permissions/{policy,pep,matrix,authorization,boundary,runtimeActivation,credentialIdentity,transferConsent,approval}.ts` — PEP, PermissionMatrix, exact-proposal authorization, hard boundaries.
- `cli/src/core/protocol/{ids,events,projections,evidence,provenance,activity,completion,uxState,commandGrammar,...}.ts` — protocol contracts. `newOperationId`, `asSessionId`, `durableEvent`, projections.
- `cli/src/core/artifacts/types.ts` — artifact type definitions (extend here for checkpoint/artifact stores).
- `cli/src/core/preflight/{run,probes,types}.ts` — startup preflight (Story 1.1). `/check` dependency preflight (3.8) is a separate non-mutating probe surface.
- `cli/src/core/security/{sanitizer,redact,onboarding}.ts` — Sanitizer runs before any persistence/UI/log.
- `cli/src/core/agent/{loop,dispatch,intent}.ts` — AgentLoop (tool-call mediation) + durable Typhoon dispatch. Epic 3 hardens loop validation (3.9/3.10).

## Story AC source lines in epics.md

- 3.1: 1149–1173 · 3.2: 1175–1199 · 3.3: 1201–1225 · 3.4: 1227–1251 · 3.5: 1253–1277 · 3.6: 1279–1303 · 3.7: 1305–1329 · 3.8: 1331–1355 · 3.9: 1357–1381 · 3.10: 1383–1407 · 3.11: 1409–1436 · 3.12: 1438–1462 · 3.13: 1464–1488 · 3.14: 1490–1514 · 3.15: 1516–1543 · 3.16: 1545–1572.

## dependsOn (forward edges only — all producers are complete Epic 1/2 stories)

3.1→PR-3,1.3,2.2,2.3 · 3.2→3.1,1.3,1.4 · 3.3→3.2,2.4,3.1 · 3.4→3.1,2.2 · 3.5→3.3,2.4,3.2 · 3.6→3.5,3.2 · 3.7→3.3,2.4,PR-3 · 3.8→3.1 · 3.9→3.4,3.5,3.7,2.2 · 3.10→3.9,2.1,2.4 · 3.11→3.8,3.9,3.10,3.5,3.7 · 3.12→3.2,3.5 · 3.13→3.12,3.2 · 3.14→3.13,2.4 · 3.15→3.10,3.2 · 3.16→3.14,3.2.