<p align="center">
  <img src="thcode_logo.png" alt="thcode" width="300">
</p>

<p align="center"><strong>A Thai-first coding agent for the terminal.</strong></p>

<p align="center">
  thcode explores how Thai language models can support practical, multi-step software engineering workflows—not only conversation, but inspecting a workspace, planning changes, and carrying out guarded coding tasks.
</p>

> [!WARNING]
> thcode is an active prototype. The supported product surface is the Windows-first CLI in [`cli/`](cli/). The [`client/`](client/) and [`server/`](server/) directories are separate early-stage web/API scaffolds and are not part of the CLI release path.

## Highlights

- **Thai-first agent workflow** — an agent loop backed by a pluggable provider registry, with Typhoon as the initial configured integration.
- **Guarded local work** — explicit Plan and Build modes, permission profiles, workspace containment checks, and per-effect authorization.
- **Inspectable operations** — bounded file inspection, previews for mutations and deletions, checkpoints, rollback analysis, and recovery-oriented result states.
- **Local-first secrets and sessions** — OS credential storage for provider keys, redacted tool output, and encrypted SQLite session storage.
- **Thai AI services** — a discoverable AI for Thai catalog with OCR, speech-to-text, address extraction, and named-entity recognition capabilities.

## Quick start

### Prerequisites

The CLI currently supports **Windows 11** with:

- [Node.js](https://nodejs.org/) **22 or newer**
- [PowerShell 7.4+](https://learn.microsoft.com/powershell/) available as `pwsh.exe`

> [!NOTE]
> This is deliberately a Windows-first prototype. PowerShell 5.1, Git Bash, and WSL are not supported execution environments at this stage.

### Build and run the CLI

```powershell
cd cli
npm install
npm run build
npm test

# Verify the non-interactive entry point
node dist/index.js --version

# Start the interactive terminal UI
node dist/index.js
```

For local development without compiling first:

```powershell
cd cli
npm run dev
```

The test suite runs offline and does not need provider credentials.

## Using thcode

Start in the workspace you want thcode to operate on. New sessions open in **Build** mode with the **Manual** permission profile. Switch between Plan and Build with `Shift+Tab`; use `Ctrl+C` to quit.

| Command | Purpose |
| --- | --- |
| `/help` | List the supported command grammar. |
| `/status` | Show the current mode, provider, health, and context state. |
| `/plan`, `/build` | Switch the active work mode. |
| `/permissions` | Inspect the active permission matrix. |
| `/models` | Inspect the selected model configuration. |
| `/tools` | Inspect catalog and diagnostic controls. |
| `/context`, `/usage` | Inspect active model context and cumulative provider usage. |
| `/rollback`, `/recover` | Inspect rollback checkpoints and interrupted operations. |

Commands are parsed through a fixed grammar; shell expansion, command substitution, and arbitrary executable dispatch are intentionally refused.

## Providers and credentials

Typhoon is the primary provider integration. Its adapter uses the OpenAI-compatible Typhoon API endpoint and reports an unconfigured state until a key is available. The provider registry also includes placeholders for Pathumma, OpenThaiGPT, and ThaLLE; those adapters do not yet have configured endpoints.

Keep provider credentials out of source control. thcode is designed to obtain keys through its credential-store interface rather than configuration files, logs, or session data. On the supported Windows path, the credential store uses DPAPI-backed local storage.

> [!IMPORTANT]
> A configured key alone does not mean a provider or specialist service is available: thcode performs explicit health checks and fails closed when configuration, consent, or authority is missing.

## AI for Thai catalog

The catalog currently exposes the following services for discovery and inspection:

| Service | Capability | Status |
| --- | --- | --- |
| T-OCR | Recognize Thai text in images | Catalogued |
| Speech-to-Text | Transcribe Thai audio | Catalogued |
| Extract Address | Parse Thai free-text addresses | Catalogued |
| Named Entity Recognition | Identify people, places, and organizations | Catalogued |

“Catalogued” means a service is known and inspectable; it is not a claim that every service is configured, entitled, or ready for live invocation. Specialist use requires a separately configured AI for Thai credential, an available health state, and explicit transfer consent.

## Project layout

```text
.
├── cli/                    # Supported TypeScript + Ink terminal application
│   ├── src/core/           # Headless agent, policy, provider, storage, and tool core
│   ├── src/ui/             # React/Ink terminal interface
│   ├── test/               # Offline Vitest suite
│   └── catalog-manifest.json
├── client/                 # Early-stage Next.js web scaffold
├── server/                 # Early-stage Express/Prisma API scaffold
├── docs/                   # Architecture decisions and discovery material
└── _bmad-output/           # Product, architecture, and implementation artifacts
```

The CLI keeps its user interface separate from the core so future desktop, web, or IDE surfaces can use the same controlled application interface.

## Development

Most implementation work happens in `cli/`.

```powershell
cd cli
npm run build   # Type-check and emit dist/
npm test        # Run the offline test suite
npm run test:watch
```

The CLI package is prepared for npm distribution as `thcode`; its published command resolves to `dist/index.js`.

For design decisions and planned behavior, start with [`docs/decisions/`](docs/decisions/) and the project context in [`_bmad-output/project-context.md`](_bmad-output/project-context.md).

## Current status

The prototype already includes the controlled agent loop, provider registry, permission policy engine, workspace protections, local inspection and mutation pathways, specialist-service architecture, session/context governance, recovery, and rollback foundations.

Some features remain intentionally incomplete or conditional: live provider access needs credentials, integrations depend on service availability, and the interactive experience continues to evolve. Check the CLI-specific details in [`cli/README.md`](cli/README.md) and the implementation artifacts for the most granular status.
