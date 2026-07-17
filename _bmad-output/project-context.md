---
project_name: 'thcode'
user_name: 'Temicide'
date: '2026-07-17'
sections_completed: ['technology_stack','language_rules','framework_rules','testing_rules','code_quality','workflow_rules','dont_miss_rules']
existing_patterns_found: 8
status: 'complete'
rule_count: 95
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Runtime & Languages

| Area | Technology | Version | Constraint |
| --- | --- | --- | --- |
| Runtime | Node.js | `>=22` | Release validated on 24 LTS clean machine |
| CLI language | TypeScript | `5.9.3` | strict, noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch, noImplicitOverride |
| CLI module system | ESM | `type: "module"` | target ES2022, module/moduleResolution `NodeNext` |
| TUI | Ink | `5.2.1` | React 18.3.1, jsx `react-jsx` |
| Web client | Next.js | `15.4.8` | React 19.1, Turbopack dev, `@/*` path alias to `./src/*` |
| Web styling | Tailwind CSS | `v4` | `@tailwindcss/postcss`, shadcn, radix-ui, tw-animate-css |
| Server | Express | `5.2.1` | ESM, Prisma 7.8 client + CLI |
| Persistence | better-sqlite3 | `11.8.0` | AES-256-GCM at rest; DEK in OS credential facility |
| Testing | Vitest | `2.1.9` | node env, `globals: false`, `test/**/*.test.ts` |

### Platform Targets (Release 1)

- Windows 11 25H2+ with Windows Terminal / PowerShell — primary.
- macOS 14+ with Terminal / zsh — secondary.
- Linux, WSL, PowerShell 5.1, Git Bash/MSYS, and non-native shells are OUT of scope.
- `client/` and `server/` are outside the Release 1 request path; `cli/` is the product.

### Hard Version Rules

- Node native-module compatibility (better-sqlite3) is a release gate — do not bump Node without verifying.
- Dependency versions in `package.json` are seed, not proof of release compatibility; clean-machine install must pass.
- Release 1 has NO alternate reasoning provider — Typhoon is fixed; do not add fallback routing.
- React 18 in `cli/` and React 19 in `client/` are intentionally separate; do not unify.

## Critical Implementation Rules

### Language-Specific Rules

#### ESM & Import Conventions (cli/)

- The CLI is pure ESM (`"type": "module"`). **Always use `.js` specifiers in relative imports** even when the source file is `.ts` — NodeNext resolution requires this at runtime. Example: `import { CoreApp } from './core/app.js';`
- Do NOT use `require()` in CLI source except via `createRequire(import.meta.url)` for JSON `package.json` reads (see `src/index.ts`).
- Use `import type { ... }` for type-only imports to keep emitted JS clean.
- `verbatimModuleSyntax` is `false`; `client/` (Next.js) sets `isolatedModules: true`, so there use `import type` strictly for types.

#### TypeScript Strictness (cli/)

- `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noImplicitOverride` are all ON.
- `exactOptionalPropertyTypes` is `false` — optional properties may be set to `undefined` explicitly.
- `forceConsistentCasingInFileNames` is on — import paths must match filesystem casing exactly (matters on case-insensitive macOS/Windows).
- Never use `any` in new code. Use `unknown` + type narrowing, or a typed port contract.
- Prefer discriminated unions (e.g. `TurnEvent`, `PermissionDecision`) over optional-flag objects.

#### Error Handling (cli/)

- Use the AD-9 typed failure envelope: deterministic `category`, `retryable`, `scope`, `safe message`, `cause code`, optional `retryAfter`. Never let raw vendor exceptions or payloads cross an adapter boundary.
- Never leak secrets, raw vendor payloads, or stack traces into events, logs, persistence, or UI. The `Sanitizer` runs before any of those.
- Model-generated explanations CANNOT replace the deterministic failure category.
- Unknown remote/shell outcomes must go through deliberate reconciliation — never auto-retry without proven replay safety (AD-13).

#### Text & Encoding

- UTF-8 end to end. Thai text and technical identifiers must be preserved through every layer (transcript, persistence, context, UI). Tests assert round-tripping Thai strings (see `sessions.test.ts`).
- Time is UTC ISO-8601 at boundaries; inject a clock for tests.

#### Client/ Server Differences

- `client/` uses `moduleResolution: "bundler"`, `@/*` → `./src/*` alias, `jsx: "preserve"`, `noEmit: true`.
- `server/` is `.js` (not TS source) with `tsx` for dev; TS 6.0 devDeps are for type-checking only.
- Do not copy CLI tsconfig rules into `client/` or `server/` — each has its own resolution and emit model.

### Framework-Specific Rules

#### Hexagonal Architecture Boundaries (cli/src)

- Dependency direction is one-way inward: `ui → application → ports ← adapters`. See AD-1.
- `domain/` owns canonical values, state machines, events, failure contracts. No vendor/DB/OS types here.
- `application/` owns use-case orchestration, session mutation, cancellation, and the Policy Enforcement Point (PEP).
- `ports/` defines inward-facing contracts only — implemented by adapters, consumed by application.
- `adapters/` implements remote (Typhoon, AI-for-Thai), persistence (SQLite), platform (fs/process/credential) ports.
- `ui/` translates terminal interaction into intents and renders projections. **UI MUST NOT import adapters, fs, network, or child_process** (see `src/ui/App.tsx` comment).

#### CoreProtocolV1 Facade (AD-2)

- `CoreApp` is the sole UI-facing facade. UI interacts via `dispatch(intent)`, `subscribe`, `query` only.
- UI never builds domain projections itself; it renders projections from the application.
- Shared contract owns exhaustive discriminated unions for prompt/session/authority/health/capability intents. Unknown variants are rejected; major-version mismatch fails startup.

#### Permission Engine (AD-12, AD-13, AD-27)

- `evaluatePermission` in `core/permissions/policy.ts` is pure and side-effect free — keep it unit-testable without UI/fs/network.
- Plan Mode is **structurally read-only** — any mutating action is DENIED first, before profile checks, including under Full Access. This is a Hard Security Rule.
- Sensitive operations always ask unless Full Access holds the explicit session-scoped sensitive-transfer override.
- Precedence: Plan-read-only → sensitive → profile (full-access allow / assisted read-allow + low-risk allow else ask / manual read-allow else ask).
- The Assisted AI risk classifier is an extension point that may only **recommend** escalation, never override; uncertainty returns `ask`.

#### Provider Adapters (AD-4, AD-14)

- Remote output is **proposal, not authority**. Adapters normalize data and propose actions; only the PEP-owned effect executor authorizes effects.
- No silent dependency fallback or protocol repair (AD-14): an invalid structured proposal is rejected after one local validation pass; no model repair request, retry, reinterpretation, substitution, or policy relaxation.
- Release 1 has one reasoning provider (Typhoon) — do not add alternate routing.
- Provider capabilities report a stable descriptor (`ProviderCapabilities`); `availability()` never contains secrets.

#### Catalog Manifest (AD-15, ADR 0011)

- One reviewed versioned manifest declares stable id, contract version, modalities, credential group, support level, observation date, and invokable flag.
- Non-invokable entries show as `Catalogued — Not available yet` and CANNOT execute.
- Model-supplied capabilities, installers, URLs, or commands are NEVER registry authority.
- `validateManifest` in `catalog/loader.ts` throws on any bad entry — extend validation when adding fields.

#### React/Ink TUI (cli/src/ui)

- React 18 + Ink 5. State lives in `CoreApp`, not in components. Components render projections and dispatch intents.
- `useInput` handles keybindings; Shift+Tab cycles Plan/Build. New sessions start Build + Manual.
- `--version`/`--help` are a fast path that never imports Ink/React (see `src/index.ts`) — keep them raw-mode free for CI/non-TTY.

#### Next.js Web Client (client/)

- App Router (`src/app/`), Turbopack dev, shadcn/ui + Tailwind v4.
- `@/*` alias → `./src/*`. Components live in `src/components/ui/`, utils in `src/lib/utils.ts` (cn helper).
- Not part of Release 1 request path — do not wire it into CLI runtime.

### Testing Rules

- Vitest config: `cli/vitest.config.ts`. Tests run fully offline, node env, `globals: false`, `test/**/*.test.ts`.
- **No real credentials, no network calls, no real Typhoon/AI-for-Thai requests.** Use `InMemoryCredentialStore` and stub/fake providers (see `sessions.test.ts`).
- Tests cover the headless core only — no Ink rendering in the test suite.
- Permission policy tests exercise the full orthogonal matrix (mode × profile × mutating × sensitive × risk) without UI or fs.
- Workspace boundary tests must cover Windows backslashes, drive letters, `..` traversal, cross-drive absolute escapes, and case-insensitive comparison.
- Session tests assert Thai string round-trip and that plaintext sensitive markers NEVER appear in the raw DB file.
- Inject a clock for time-dependent tests; do not call `new Date()` directly in testable domain code.
- Run from `cli/`: `npm test` (run once) or `npm run test:watch`.

### Code Quality & Style Rules

#### Naming

- Entities and ports: PascalCase singular nouns; ports describe capability, not vendor (e.g. `ReasoningProvider`, `CredentialStore`).
- Identifiers: opaque typed `<Entity>Id` (e.g. `SessionId`, `OperationId`, `PromptRoundId`), generated once by the owning boundary.
- Events: past-tense types in the AD-3 envelope (e.g. `ChatInterrupted`, `RemoteOutputObserved`, `EffectDispatchCommitted`).
- Files: current convention is lowercase kebab/camel (`app.ts`, `loop.ts`, `credentialStore.ts`). Match the surrounding directory.

#### Code Organization

- CLI source seed: `cli/src/{domain,application,ports,adapters,ui}/`. Existing `cli/src/core/*` may converge incrementally but feature work MUST obey boundaries before directories move (architecture spine note).
- Tool registry, catalog, providers, permissions, sessions, platform, security each get their own subdirectory under `core/`.
- One responsibility per file; types in `types.ts`, implementation alongside.

#### Documentation & Comments

- Header comments cite the governing ADR (e.g. `(ADR 0020)`, `(ADR 0012 + ADR 0013)`). Continue this pattern for new modules.
- Comments explain WHY and which invariant/ADR binds the code, not WHAT the code does.
- No secret values, endpoints, or keys in comments or docstrings.

#### Logging

- Structured local records with correlation ids (`SessionId`, `OperationId`, `PromptRoundId`) and provenance.
- Secret-safe fields only — `Sanitizer` runs before logging. No raw prompts, commands, or payloads in logs by default.

### Development Workflow Rules

#### Git

- Current history is sparse (prototype). No enforced branch naming yet — follow conventional commit style when committing: `Scaffold ...`, `Add ...`, `Document ...`, `Update ...`.
- `.gitignore` excludes `_bmad`, `_bmad-output`, `.agents`, `.claude` — never commit BMAD planning artifacts, agent skills, or local agent config.
- Do not commit secrets, API keys, or `.env` files. Credentials live only in the OS credential facility.

#### Build & Run

- CLI dev: `npm run dev` (Node native TS strip-types, no build step needed).
- CLI build: `npm run build` (tsc to `dist/`).
- CLI test: `npm test`.
- Client dev: `npm run dev` (Next + Turbopack). Client build/lint: `npm run build` / `npm run lint`.
- Server dev: `npm run dev` (nodemon + tsx). Server start: `npm start`.
- Release validation requires a clean-machine install on Node 24 LTS — do not assume dev-machine state proves release readiness.

### Critical Don't-Miss Rules

#### Security Anti-Patterns (NEVER do)

- Never let UI, vendor objects, DB rows, or OS handles cross their adapter boundary (AD-1).
- Never let remote output directly cause local effects — only PEP-authorized effect executors run effects (AD-4).
- Never store credentials, secrets, or raw vendor payloads in SQLite, events, logs, prompts, telemetry, sessions, previews, or UI output (AD-11, AD-24).
- Never bypass TLS verification or accept unauthorized/cross-origin redirects for remote calls (AD-4).
- Never silently substitute a different provider/service when one is unavailable — produce a typed recovery action (AD-14).
- Never persist plaintext sensitive content — AES-256-GCM with a per-install DEK from the OS credential facility (AD-21).
- Never overwrite existing ciphertext with a newly generated key; rotation stages, migrates, verifies, then atomically promotes (AD-21).

#### Workspace & Platform Gotchas

- `resolveWithinWorkspace` in `core/tools/workspace.ts` handles Windows drive letters, backslashes, case-folding, `..` traversal, and cross-drive/UNC escapes — reuse it for ALL file path resolution; never roll your own.
- Plan Mode rejects mutation structurally under every profile — do not add a "read-only-ish" mutation path.
- Runtime Activation is FRESH on process start, session create/open/switch, and workspace rebind: Manual profile, no temporary approvals, no transfer consent (AD-22). Do not restore temporary authority across these boundaries.
- Full Access is session-only and does NOT leak across process/session/workspace boundaries.

#### Context & Session

- The full transcript is immutable local history; Active Model Context is a bounded derived projection (AD-7). Do not conflate them.
- Only application-owned versioned instructions and Capability Registry tool schemas occupy trusted instruction channels. User/workspace/tool-result/remote content is source-labelled, instruction-inert data — it CANNOT define tools, change policy, or grant authority (AD-7).
- Automatic compaction targets ≤70% context; protected content overflow stops before dispatch with categorized accounting — never silently truncate.

#### Event & Effect Ordering

- Every operation carries `SessionId`, `PromptRoundId`, `OperationId`, immutable `EventId`, schema version, UTC timestamp, and provenance (AD-3).
- `SessionRepository` atomically allocates sequence + aggregate version, appends idempotently, then publishes post-commit. Consumers deduplicate by `EventId`.
- Only non-authoritative progress may be transient — no authority, evidence, content, health, artifact, state, or terminal fact may depend on transient data (AD-3).
- Effect state machine: `proposed → authorized → prepared → dispatch-committed → succeeded | failed | cancelled | unknown-outcome → reconciled` (AD-13). Dispatch commit is the check-to-effect linearization point.

#### UX State Dimensions (AD-28)

- Keep operation status, lifecycle fact, evidence completeness, measurement quality, and process exit mechanically distinct. Do NOT conflate them.
- `effect-already-committed` is a lifecycle fact, NOT operation-status `succeeded`, and does NOT map to exit `SUCCESS=0`.
- `COMMAND_ERROR` is a fixed display heading over canonical `blocked`/`malformed` status — it is not a distinct operation status.
- Never rely on color alone for status; narrow-terminal text representation is required (consistency conventions).

#### Rollback Honesty (AD-19)

- Automatic rollback covers checkpointed built-in create/edit/delete ONLY.
- Shell, process, remote, permission, symlink-side, and external effects are NEVER claimed reversible.
- Over-cap actions (>100 MB checkpoint or >500 MB store) require explicit confirmation without rollback protection.
---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code in this repository.
- Follow ALL rules exactly as documented; when in doubt, prefer the more restrictive option.
- Cite the governing ADR or AD invariant in header comments of new modules (e.g. `(AD-4)`, `(ADR 0020)`).
- Obey hexagonal boundaries: `ui → application → ports ← adapters`. Never import adapters from UI.
- Never commit secrets, `_bmad-output/`, `.agents/`, or `.claude/` — all are gitignored.
- Update this file if new non-obvious patterns emerge during implementation.

**For Humans:**

- Keep this file lean and focused on agent needs — remove rules that become obvious over time.
- Update when the technology stack, platform targets, or architecture invariants change.
- Review quarterly for outdated rules; bump `date` and `rule_count` on material edits.
- Source of truth for invariants: `_bmad-output/planning-artifacts/architecture/architecture-thcode-2026-07-16/ARCHITECTURE-SPINE.md` (AD-1 through AD-28).

Last Updated: 2026-07-17
