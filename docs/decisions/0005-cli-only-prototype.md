# ADR 0005: CLI-Only Competition Prototype

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

## Context

Mature coding-agent products may offer terminal, desktop, web, and IDE interfaces. Building several interfaces during the competition would dilute effort from the agent loop, Thai-model adaptation, AI for Thai integration, safety, and evaluation.

The CLI is also the natural environment for repository work, shell commands, file references, tests, Git inspection, and developer approval flows.

## Decision

The competition prototype will provide one end-user interface: the thcode CLI.

Per ADR 0008, the first supported platform is Windows. macOS and Linux support are deferred in that order.

The CLI will be the primary surface for:

- starting, resuming, and stopping an agent session;
- entering Thai or Thai-English coding requests;
- mentioning repository files and directories;
- selecting an available reasoning model;
- inspecting available AI for Thai tools;
- reviewing plans, tool calls, patches, and verification results;
- approving or denying sensitive operations;
- inspecting session status, context usage, and errors.

The hosted Thai Agent Compatibility Layer will expose an API used by the CLI. It will not have a separate end-user interface in the prototype.

## Candidate MVP commands

```text
thcode                         Start an interactive session in the current repository
/models                        List and select configured reasoning models
/tools                         Show available AI for Thai and local tools
/status                        Show session, model, workspace, and context status
/permissions                   Open the interactive Permission Selector
/plan                          Select read-only Plan Work Mode
/build                         Select executable Build Work Mode
/context                       Show artifacts and repository context shared with the service
/diff                          Review pending or completed file changes
/test                          Request the project verification workflow
/session                       Open the interactive Saved Session browser
/sessions                      Alias for the Saved Session browser
/clear                         Start a fresh context while remaining in the workspace
/exit                          End the interactive session
```

The `/session` namespace provides `new`, `list`, `open <id>`, `rename <id>`, `delete <id>`, and `info`. `/resume` and separate plural commands such as `/new-sessions` are not part of the command surface.

The exact command set remains subject to user-flow design. Only commands required for the headline demonstration belong in the first implementation milestone.

Interactive key behavior:

- `Shift+Tab` cycles Plan and Build Work Modes.
- `Tab` accepts `/command` and `@file` completion.
- `Enter` submits the Prompt Composer or confirms the active modal selection.
- `Esc` closes a modal without changing its setting.

## Deferred interfaces

- Web application
- Desktop application
- Mobile application
- IDE extension
- Consumer or nontechnical work-agent UI

## Consequences

- Engineering effort stays focused on the core agent and service boundary.
- The demo has one coherent workflow.
- Accessibility for nonterminal users is deferred.
- Future interfaces should reuse the hosted service protocol and session model rather than reimplementing agent logic.

## Exit criterion

A developer can install thcode, open a repository, complete the headline Thai multimodal coding task, review every material action under the Manual Profile, and verify the result without leaving the terminal.
