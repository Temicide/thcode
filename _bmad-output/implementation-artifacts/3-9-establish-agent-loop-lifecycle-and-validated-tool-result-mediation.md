---
story_id: "3.9"
story_key: "3-9-establish-agent-loop-lifecycle-and-validated-tool-result-mediation"
epic: 3
baseline_commit: 9765947
status: review
created: 2026-07-17
project: thcode
dependsOn: "3.4; 3.5; 3.7; 2.2"
---

# Story 3.9: Establish Agent Loop lifecycle and validated tool-result mediation

Status: review

## Implementation
- cli/src/core/agent/types.ts — shared types for validation, mediation, and lifecycle (ProposalValidationResult, MediatedToolResult, LoopTerminal, ValidationContext, MediationContext, LifecycleContext, ProposalToValidate, ToolResultToMediate). Discriminated unions, opaque branded ids, no `any`.
- cli/src/core/agent/validation.ts — `validateProposal(proposal, ctx, deps)`: validates schema, action class, Work Mode, Permission Profile, Workspace/resource identity, consent, quota, credentials, and hard boundaries BEFORE any tool or process adapter receives it (AC #1). Malformed/unknown/unsupported/out-of-scope/policy-incomplete -> malformed/blocked/refused with sanitized deterministic Evidence (AC #2). Performs NO repair, reinterpretation, substitution, or retry (AD-14). Leaves NO authorization or staged effect. Pure/injectable via ValidationDeps port.
- cli/src/core/agent/toolResultMediation.ts — `mediateToolResult(result, ctx, deps)`: source-labels, sanitizes (AD-24), bounds, and durably records tool results in Evidence before they are offered as context (AC #3). Type-level `instructionInert: true` marker enforces AD-7. Remote/tool output CANNOT change policy, permissions, boundaries, registry authority, or task scope.
- cli/src/core/agent/lifecycle.ts — `handleLifecycleStep(hasValidNext, terminalResponse, ctx, deps)`: stops with durable typed result when no valid next proposal or invalid terminal response (AC #5). Does NOT invent a final answer, silently repair the proposal, or dispatch an unvalidated effect. Three terminal kinds: `completed`, `no-valid-proposal`, `invalid-terminal-response`.
- cli/src/core/app.ts — CoreApp facade exposes `validateProposal(proposal)`, `mediateToolResult(result)`, `loopStep(hasValidNext, terminalResponse)` delegating to the new modules with current activation state, workspace identity, and injected clock. Minimal convergent wiring; does not rewrite existing `runAgentTurn` or `dispatchTyphoonTurn`.
- cli/test/agentLoop.test.ts — 40 test cases across all 5 ACs + edge cases. Offline with stub/fake providers + injected clock + fake journal. Covers: schema/action-class/mode/profile/identity/consent/quota/credentials/boundaries validation; malformed/blocked/refused outcomes with sanitized Evidence; no repair/substitution/retry; no staged authorization; tool result source-labelled/inert/sanitized/bounded/durable; remote output cannot change policy; subsequent proposal fresh validation with own operation identity; lifecycle termination with durable typed result; no invented answer/repair/unvalidated dispatch; Thai UTF-8 preservation; empty output handling.

## Verify
- npm run build clean; npm test green (existing + new tests).
