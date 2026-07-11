# ADR 0008: Windows-First Platform Delivery

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

## Context

A cross-platform coding agent must handle credential stores, shells, path syntax, subprocesses, signals, permissions, installation, and terminal behavior differently across operating systems. Attempting full parity during the competition would increase implementation and testing risk.

## Decision

The platform delivery order is:

1. Windows
2. macOS
3. Linux

Only the Windows target is required for the competition prototype and demonstration. The proposal may describe macOS and Linux as planned expansion, not completed support.

The competition target is native Windows running in Windows Terminal with PowerShell command execution. WSL is not a supported or tested prototype environment.

ADR 0019 distributes this native Windows CLI through npm rather than a standalone executable.

## Windows prototype requirements

- Render correctly in Windows Terminal.
- Require PowerShell 7.4 or newer through `pwsh.exe`, with PowerShell 7.6 LTS as the clean-machine competition baseline.
- Store provider credentials through a Windows credential-store adapter.
- Correctly handle drive letters, backslashes, UNC paths, spaces, and case-insensitive path behavior.
- Resolve the workspace boundary before permitting file operations.
- Execute, stream, cancel, and time out child processes reliably.
- Redact secrets from PowerShell output and error streams.
- Support UTF-8 Thai input and output without corrupting text.
- Detect required build tools and report missing dependencies clearly.
- Avoid assuming Unix commands such as `bash`, `grep`, `sed`, `chmod`, or `/tmp` exist.
- Reject legacy Windows PowerShell 5.1 rather than silently changing shell and encoding semantics. If `pwsh.exe` is missing or too old, show a documented WinGet recommendation without installing it automatically.

## Deferred adapters

### macOS

- macOS Keychain
- zsh/bash process adapter
- macOS path and permission behavior

### Linux

- Secret Service or another documented credential-store backend
- distribution and shell variations
- Linux sandbox and filesystem behavior

## Explicit exclusions

- WSL execution and Linux path translation
- Git Bash or MSYS as the required command environment
- Unix-only process, signal, path, or command assumptions
- Claims of macOS or Linux parity during the competition prototype

## Acceptance criteria

- Fresh installation succeeds on the documented Windows version.
- PowerShell preflight passes on 7.6 LTS and reports an actionable error for missing `pwsh.exe`, PowerShell below 7.4, or Windows PowerShell 5.1-only environments.
- First-run onboarding stores and retrieves the Typhoon key without writing it to disk as plaintext.
- Thai prompts render and submit correctly.
- A referenced image is resolved within the Windows workspace and processed only after consent.
- Plan mode remains read-only.
- Build mode creates and runs the selected demonstration program using an available, documented toolchain.
- Process output streams live and cancellation leaves no orphaned child process.
- The verification result is reproducible on a second clean Windows machine or VM.
