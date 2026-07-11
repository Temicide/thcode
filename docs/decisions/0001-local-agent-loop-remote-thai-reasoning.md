# ADR 0001: Local Agent Loop with Remote Thai Reasoning

- Status: Amended by ADR 0007
- Date: 11 July 2026
- Decision owner: Applicant

## Context

thcode is intended to be a downloadable Thai-first alternative to terminal coding agents such as Claude Code and Codex. The competition additionally requires an applicant-owned service that can be deployed on AI for Thai as a Dockerized API.

Keeping the entire agent in the cloud would require remote repository access and a hosted tool-execution environment. Calling an existing Pathumma endpoint directly from a CLI would be simpler, but would not establish a sufficiently original service boundary for onboarding.

## Decision

The downloadable thcode CLI will own:

- the agent loop and stop conditions;
- local session history;
- repository discovery and context selection;
- secret detection and redaction;
- tool definitions and local tool execution;
- filesystem, shell, network, and approval policies;
- verification through tests, builds, or other local checks.

The original decision placed reasoning-provider calls behind the hosted thcode API. ADR 0007 moves reasoning-provider adapters and calls into the local CLI so user-supplied provider credentials never reach the thcode server.

The thcode API deployed on AI for Thai will own:

- specialist artifact processing through AI for Thai services;
- normalized OCR, caption, language, or other evidence responses;
- server-side AI for Thai credential management;
- bounded orchestration of AI for Thai tools during an artifact-processing request.

The hosted service will not connect directly to a developer machine. A tool call returned by the service is an untrusted proposal until the local CLI validates and authorizes it.

The hosted service may execute a bounded internal sub-loop over server-side AI for Thai tools. The local CLI remains the owner of the outer loop, calls the selected reasoning provider directly, and is the only component permitted to execute repository, filesystem, shell, or test tools on the developer's computer.

## Consequences

### Positive

- Source control operations and shell commands remain on the developer's machine.
- The CLI can minimize and audit the repository context sent remotely.
- Local permissions remain effective even when the model proposes an unsafe command.
- The onboarded API has a clear Docker deployment boundary.
- A single reasoning API can support a CLI, IDE extension, or other future clients.

### Negative

- Every reasoning turn requires network access and adds latency.
- The service must generate structured tool calls reliably enough for an automated loop.
- Context selection becomes a core local capability and a major determinant of model performance.
- The team must define what is original about the hosted intelligence beyond forwarding prompts to Pathumma.
- Offline operation requires a future local-model adapter and is not part of the initial decision.

## Rejected alternatives

### Complete cloud agent

Rejected for the initial version because it expands the infrastructure, repository-access, credential, and isolation scope beyond the competition timeline.

### CLI calling an existing model API directly

Rejected as the complete competition submission because it leaves no clear applicant-owned AI service to onboard.

### MCP gateway only

Rejected as the complete product boundary because protocol adaptation alone does not yet provide differentiated Thai coding intelligence.

## Validation required

- Demonstrate reliable structured output or tool-call generation from the selected Thai model.
- Establish coding-task success on a small Thai-language evaluation set.
- Measure the number of reasoning turns, end-to-end latency, and API cost or quota usage.
- Verify that secret redaction and workspace boundaries hold under adversarial prompts.
- Package the hosted API as a documented Docker image and produce basic load-test results.
