# thcode CLI (prototype scaffold)

Thai-first coding agent CLI. TypeScript headless core + React/Ink terminal UI
(ADR 0020), Windows-first (ADR 0008), distributed later as the `thcode` npm
global package (ADR 0019). Requires **Node.js >= 22** and, on Windows,
**PowerShell 7.4+ (`pwsh.exe`)** for command execution and credential storage.

## Quick start

```powershell
cd cli
npm install        # install dependencies
npm run build      # tsc -> dist/ (zero errors expected)
npm test           # vitest, fully offline, no credentials needed
node dist/index.js --version   # fast path, works in CI / non-TTY
node dist/index.js             # interactive Ink UI
```

Interactive commands: `/plan` `/build` `/models` `/permissions` `/tools` `/exit`.
`Shift+Tab` cycles Plan/Build. `Ctrl+C` quits. New sessions start in
**Build + Manual** (ADR 0012/0013).

## Folder map

```
cli/
  catalog-manifest.json      versioned AI for Thai Catalog Manifest (ADR 0011)
  src/
    index.ts                 entry; --version/--help never import Ink
    core/                    headless core — ZERO React/Ink imports (ADR 0020)
      app.ts                 CoreApp facade: the only surface the UI may call
      agent/loop.ts          runTurn(): context -> provider -> permission -> tool -> loop
      providers/             ProviderAdapter contract (ADR 0004)
        typhoon.ts           real skeleton: OpenAI-compatible request/stream/tool-call parse
        stubs.ts             pathumma / openthaigpt / thalle ("no endpoint configured")
        registry.ts          explicit selection, session-stable, NO silent fallback
      permissions/           WorkMode x PermissionProfile policy engine (ADR 0012/0013)
      tools/                 local tools + workspace boundary + plan-mode refusal
        builtin/             read_file, list_dir, search, write_file, run_command (pwsh)
      platform/              CredentialStore interface (ADR 0007)
        windowsCredentialStore.ts  DPAPI-encrypted files under %LOCALAPPDATA%\thcode\credentials
      sessions/              SQLite Global Session Store (ADR 0017) + AES-256-GCM (ADR 0018)
      catalog/               Catalog Manifest loader + typed accessors (ADR 0011)
      context/               Effective Context Capacity + Ctx% math (ADR 0014/0015) [extension point]
      artifacts/             artifact resolver + consent flow interfaces (ADR 0003) [extension point]
      aiforthai/             adapter-family interfaces + stub executor (ADR 0011) [extension point]
      security/redact.ts     credential-pattern redaction for tool output (ADR 0007)
    ui/                      Ink components; dispatch typed intents into CoreApp only
      App.tsx                status row, transcript, prompt composer, Ctx% placeholder
  test/                      vitest — offline, no network, no real credentials
```

## What is real vs stubbed

Real (working now):
- Permission policy engine with the full Plan/Build x Manual/Assisted/Full-Access matrix.
- Structural Plan-Mode read-only enforcement in the tool registry.
- Workspace boundary resolution (drive letters, `..`, cross-drive, case-insensitive).
- Local tools: `read_file`, `list_dir`, `search` (naive substring), `write_file`,
  `run_command` (PowerShell 7 child process with timeout/cancel).
- Typhoon adapter skeleton: request building, SSE streaming parse, tool-call
  extraction against `https://api.opentyphoon.ai/v1`. Without a key it reports
  unavailable and never crashes (untested against the live API from here).
- Windows credential store: per-secret DPAPI-encrypted files via `pwsh`
  `ConvertFrom-SecureString` (choice documented in the source; no native deps).
- SQLite session store: schema (sessions, transcript, token ledger, workspace
  binding), AES-256-GCM encryption of sensitive columns, basic CRUD, keyed
  non-reversible workspace index.
- Agent loop skeleton `runTurn()` with permission gating and tool execution.
- Catalog Manifest loader/validator with the four Phase-1 services.

Stubbed / placeholder:
- `pathumma`, `openthaigpt`, `thalle` provider adapters (report "no endpoint configured").
- AI for Thai service execution (`catalogued` only; stub returns "not yet integrated").
- `/permissions` prints state — the interactive Permission Selector is a TODO.
- Approval prompts: "ask" outcomes currently auto-reject in the UI scaffold.
- Context compaction / Context Donut, session browser, artifact resolver +
  consent flow, macOS/Linux platform adapters: interfaces + TODO comments only.

## Security notes

- Provider keys live only behind the `CredentialStore` interface (Windows: DPAPI
  files under `%LOCALAPPDATA%\thcode\credentials`), never in config, logs, or SQLite.
- The per-install session data key (AES-256-GCM) is held in the CredentialStore;
  losing it makes encrypted session content unrecoverable (ADR 0018).
- Tool output passes a best-effort credential-pattern redactor before display.
