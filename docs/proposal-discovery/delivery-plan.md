# Delivery Plan and Risk Boundary

## Current evidence

- The repository describes the idea but contains no working CLI or agent loop.
- The server exposes only a health endpoint.
- The web client is the default Next.js starter and is not part of the CLI-only prototype.
- Typhoon API access is confirmed by the applicant.
- AI for Thai API access and selected service quota are not yet verified.
- One additional builder is expected to use Claude Code and Codex for implementation.
- The builder has access to a native Windows machine and relevant implementation experience, allowing the vertical slice and clean-machine behavior to be tested on the target platform.
- Native Windows Terminal and PowerShell are the sole competition execution environment; WSL is not part of prototype testing or support.
- Package the CLI through npm with a `thcode` bin entry and test global installation, update, and uninstall on the clean Windows machine; do not build a parallel standalone executable.
- Use Node.js 24 LTS for the clean-machine release test while keeping the declared minimum at Node.js 22.
- Use PowerShell 7.6 LTS for the clean-machine release test while keeping the declared minimum at PowerShell 7.4; verify that legacy 5.1-only and missing-`pwsh` cases fail with actionable guidance.
- Build the CLI presentation with TypeScript, React, and Ink over a headless TypeScript agent core; test core policy independently from terminal interaction.

## Estimate interpretation

The applicant estimates one to two days. Treat this as the target for a vertical integration spike, not completion of the competition product.

AI coding agents can accelerate scaffolding, adapters, tests, and documentation. They do not eliminate:

- API registration and external access delays;
- behavior validation against real provider responses;
- Windows-specific credential, path, process, and terminal testing;
- security and privacy review;
- clean-machine installation testing;
- Docker packaging and platform compatibility;
- load tests and API documentation;
- benchmark execution and analysis;
- proposal writing and visual verification.

## Tier 0: one-to-two-day vertical slice

The spike is complete only if one narrow path works end to end:

1. Start a minimal CLI on the development machine.
2. Select Typhoon and retrieve a locally stored credential or use a temporary development secret that is not committed.
3. Resolve one image reference inside the workspace.
4. Obtain normalized OCR evidence from one real AI for Thai endpoint, or use a clearly labeled temporary stub only while access is pending.
5. Send the Thai request and OCR evidence to Typhoon.
6. Produce a visible read-only plan.
7. Require explicit Build-mode approval.
8. Modify the known Next.js fixture locally.
9. Run `npm run build` and display evidence.

This spike may omit the polished TUI, full Windows credential adapter, multiple models, dynamic service catalog, general sandbox, benchmark suite, and production Docker hardening.

## Tier 1: proposal-ready evidence before submission

- Capture the working or partially working vertical slice honestly.
- Obtain and test the AI for Thai key.
- Confirm the selected AI for Thai service, quota, payload, and response schema.
- Finalize the system architecture and security boundary.
- Define the OpenCode baseline and benchmark tasks.
- Produce a credible development schedule for finalist work.
- Complete and visually verify the required proposal PDF before the 17 July 2026 18:00 deadline.

## Tier 2: finalist prototype, 23 July to 17 August 2026

- Native Windows TUI and clean installation path
- Windows credential-store adapter
- Typhoon provider adapter with streaming and retry handling
- AI for Thai Artifact Intelligence API in Docker
- Plan/build state machine and local permission policy
- Dependency preflight and curated Windows guidance
- Artifact consent, hashing, caching, size limits, and redaction
- Headline thcode-repository demo
- Error recovery, audit trail, and session resume
- API documentation and load-test evidence
- Same-model, same-tools comparison against OpenCode
- Reproducible tests on a clean Windows machine or VM

## Tier 3: roadmap

- Pathumma, OpenThaiGPT, and THaLLE provider adapters
- Additional AI for Thai tools
- macOS support
- Linux support
- IDE, desktop, web, or general work-agent interfaces

## Delivery risk statement

The proposal should claim that AI coding tools accelerate implementation, not that they guarantee completion. Completion claims should be tied to passing acceptance checks and external-service access, not elapsed coding time.
