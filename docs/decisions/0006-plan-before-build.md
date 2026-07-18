# ADR 0006: Plan Before Build

- Status: Superseded by ADR 0013
- Date: 12 July 2026
- Decision owner: Applicant

## Context

thcode will interpret Thai requests, process remote artifacts, and propose local repository actions. Smaller or less-tested Thai models may misunderstand intent or produce malformed tool calls. Allowing immediate edits would make those failures harder to catch and reduce user trust.

## Decision

Every new interactive task begins in Plan mode. Build mode requires explicit user acceptance of a visible plan.

### Plan mode

Plan mode may:

- parse Thai developer intent;
- resolve referenced artifact metadata;
- request permission to upload a selected artifact;
- call approved read-only AI for Thai tools such as OCR;
- read or search permitted repository content;
- ask clarification questions;
- show intended files, tools, commands, risks, and verification criteria.
- run non-mutating dependency and toolchain discovery.

Plan mode may not:

- create, modify, move, or delete repository files;
- run commands that mutate project or external state;
- install dependencies;
- commit or push changes.

### Build mode

After explicit approval, Build mode may propose and execute local edits and commands under the configured permission policy. It must preserve the approved goal and disclose material deviations.

The task ends only after verification succeeds, the user accepts a disclosed limitation, or the system reports a blocker.

If a required toolchain is missing, thcode pauses before Build mode and provides a platform-specific setup recommendation. It does not treat the missing dependency as permission to install software automatically.

## Required plan display

```text
Goal
Referenced artifacts and remote services
Repository files to inspect or change
Commands expected to run
Risks and required approvals
Verification checks
```

## Consequences

- Users can catch misinterpreted Thai requirements before mutation.
- The demo clearly separates AI reasoning from local authority.
- Simple tasks require one additional approval step.
- Plans must be concise enough that users actually review them.
