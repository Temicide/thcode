# ADR 0012: Three Permission Profiles with Non-Negotiable Boundaries

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

## Context

Developers need both reviewable operation and an efficient unattended path. Giving the same reasoning model unrestricted authority to approve its own actions would create a prompt-injection and self-authorization risk, while requiring confirmation for every safe read or repeated call would make the CLI frustrating.

## Decision

thcode provides three session-selectable Permission Profiles:

1. **Manual** is the default and requests developer approval for material transfers, changes, commands, and sensitive operations.
2. **Assisted** applies Hard Security Rules first, then deterministic policy. An AI risk classifier may recommend allow, ask, or deny for uncertain actions, but it cannot override policy or grant itself authority. Uncertainty asks the developer.
3. **Full Access** automatically approves every action allowed by the active Work Mode within the active workspace, configured command and network boundaries, enabled AI for Thai services, and quota limits. It is session-only and requires a separate explicit sensitive-transfer override.

Manual is the Permission Profile for every new interactive session unless an explicit startup option selects another profile.

Under ADR 0016, opening a Saved Session also creates a fresh Runtime Activation in Manual. Permission Profile changes apply only to that activation and are not persisted with the session.

Every profile preserves credential secrecy, provider-host binding, workspace boundaries, audit evidence, and emergency cancellation. Full Access means unattended operation inside declared boundaries, not unrestricted control of the machine.

`/permissions` opens an interactive terminal Permission Selector. The workflow must not require users to remember or type the profile name as an inline argument, although arguments may remain available for scripting. The exact combination of persistent indicator and modal picker is a subsequent interface decision.

Work Mode is orthogonal to Permission Profile under ADR 0013. Full Access in Plan Mode automatically approves permitted read-only actions but cannot authorize mutation. Full Access in Build Mode automatically approves every otherwise permitted action without a Plan-to-Build checkpoint or per-action prompt.

## Consequences

- Manual remains understandable for first-time and high-risk use.
- Assisted reduces interruptions without allowing the proposing model to become the permission authority.
- Full Access supports experienced and unattended workflows but requires prominent state visibility and a session-scoped warning.
- Permission decisions require structured action metadata, deterministic policies, risk classification, and an audit trail.
