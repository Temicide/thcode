# ADR 0020: TypeScript Core with an Ink Terminal UI

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

The prototype is implemented in TypeScript on the accepted Node.js runtime, with React and Ink rendering the interactive terminal interface. Ink owns terminal presentation and input behavior—Chat Transcript rendering, Prompt Composer, modal selectors, Session Browser, Context Donut, diffs, and approval views—but it does not own agent policy or orchestration.

The agent core remains headless and independent of React and Ink. It owns provider adapters, the local agent loop, normalized tool calls, Work Mode enforcement, Permission Profiles, context construction, session persistence, and platform abstractions. Future desktop, web, mobile, or IDE clients may reuse this core through a stable application-facing interface.

OpenTUI and Bun are not prototype dependencies. Although OpenTUI is capable and used by OpenCode, introducing its Bun-oriented setup and native core would conflict with the accepted Node/npm distribution and add Windows packaging risk.

## Consequences

- The existing React experience in the repository transfers to the terminal UI.
- Core behavior can be tested without terminal rendering, while Ink components receive separate interaction and snapshot tests.
- UI components cannot call provider, filesystem, shell, or AI for Thai APIs directly; they dispatch typed intents to the headless core.
- React, Ink, and TypeScript versions must be pinned and validated on the Node.js 22 minimum and Node.js 24 LTS baseline.
