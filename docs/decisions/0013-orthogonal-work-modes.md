# ADR 0013: Plan and Build Are Independent Work Modes

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant
- Supersedes: ADR 0006

Plan and Build are directly selectable Work Modes rather than mandatory sequential workflow stages. Plan Mode is structurally read-only and uses a planning-focused Mode Instruction Set; no Permission Profile, including Full Access, may turn a Plan action into a mutation. Build Mode enables execution and verification, while the independently selected Permission Profile determines whether eligible actions ask for approval or run automatically.

The developer may enter either Work Mode directly and switch between them without first producing or accepting a plan. Full Access in Build Mode skips all approval prompts and automatically approves every action inside the previously declared hard boundaries. Manual and Assisted retain their profile-specific approval behavior.

A new interactive session starts in Build Mode. Combined with ADR 0012, the New Session Default is therefore Build plus Manual.

The interactive terminal keeps the current Work Mode visible. `Shift+Tab` cycles directly between Plan and Build, while plain `Tab` remains available for `/command` and `@file` completion. `/plan` and `/build` remain explicit alternatives.

## Consequences

- Users can use Plan Mode only for analysis, Build Mode directly for execution, or move between them as needed.
- The Mode Instruction Set changes reasoning behavior, while structural tool restrictions enforce the read-only boundary independently of model compliance.
- Permission Profile and Work Mode must be shown as separate UI state because neither implies the other.
