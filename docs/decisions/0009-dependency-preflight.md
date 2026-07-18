# ADR 0009: Detect Dependencies Before Build

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

## Context

Coding tasks may require compilers, runtimes, package managers, SDKs, project dependencies, and environment variables that are not installed on a user's machine. The prototype must support multiple coding tasks without making C++ or any other language a global prerequisite.

Allowing the model to discover missing tools only after a failed command produces a poor first-run experience. Automatically installing development toolchains also creates security, licensing, disk-space, and administrative-permission risks.

## Decision

thcode will perform dependency preflight during Plan mode.

The preflight layer will:

- inspect repository manifests and documented project commands;
- identify required runtimes, compilers, package managers, and environment variables;
- test executable availability and versions through non-mutating probes;
- compare detected versions with explicit project or adapter requirements;
- show missing capabilities in the plan;
- provide platform-specific, curated setup guidance;
- re-run checks through `/check` after the user changes the environment.

The MVP will not silently install a runtime, compiler, SDK, or package manager. Any future assisted installation must be a separate, explicit Build-mode action with command preview and approval.

## Trust rule

Installation instructions must come from a maintained thcode toolchain registry or verified project documentation. The reasoning model may explain the instructions but cannot invent an unverified download URL or privileged installation command.

## Candidate CLI output

```text
/check

Environment
  node      22.14.0      ready
  npm       10.9.2       ready
  git       2.49.0       ready
  c++       not found    optional for current task

Current task can run with Node.js. No additional setup required.
```

## Consequences

- The CLI can support many languages without bundling every toolchain.
- Plans disclose whether verification is actually possible.
- Windows guidance must be curated and tested separately from macOS and Linux.
- Maintaining the toolchain registry becomes an ongoing responsibility.

## Acceptance criteria

- A missing compiler is detected before file mutation.
- A task that does not need the compiler proceeds normally.
- The recommendation names a supported toolchain and expected verification command.
- No installation occurs without an explicit, separate approval.
- `/check` reflects the new environment after installation.
