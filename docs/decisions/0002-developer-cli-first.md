# ADR 0002: Developer CLI as the First Product Wedge

- Status: Accepted
- Date: 11 July 2026
- Decision owner: Applicant

## Context

The long-term product vision extends beyond software developers. thcode may eventually help Thai-speaking users build applications, understand images, and complete general computer-based work, combining coding-agent and broader work-agent experiences.

Attempting to deliver all of those experiences in the competition period would create multiple user groups, interfaces, tool sets, safety models, and evaluation methods. The agent loop and local tool harness must be proven before that expansion.

## Decision

The competition MVP will prioritize developers using a downloadable CLI.

The prototype will not include a separate web, desktop, mobile, or IDE interface. This narrower interface decision is recorded in ADR 0005.

The CLI will establish the shared foundation for future clients:

- local tool execution and permissions;
- agent-loop and session management;
- context selection and secret redaction;
- structured calls to the hosted Thai reasoning service;
- task verification and audit history.

The long-term general-purpose Thai work agent remains the product vision, but it is not an initial implementation commitment.

## Consequences

### In scope for the competition MVP

- A terminal interface for Thai-language coding tasks
- Repository search and file reading
- Patch application under local policy
- Local shell commands and test execution
- A hosted Thai coding-reasoning API
- A small, reproducible developer-task evaluation set

### Deferred

- General desktop computer use
- Broad image-reading workflows unrelated to code
- Nontechnical no-code application generation
- Mobile or consumer user interfaces
- A complete replacement for every Claude Code or work-agent feature

## Remaining decision

"Developers" is still too broad for a testable proposal. The first segment and painful recurring job must be selected before the value proposition, evaluation set, and implementation plan can be finalized.
