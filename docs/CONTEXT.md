# thcode Domain Language

thcode is a Thai-first developer agent that combines a local coding workflow with Thai reasoning providers and specialist AI services. This glossary distinguishes catalog visibility from proven operational support.

## People

**First Target User**:
A Thai-speaking student, junior developer, or member of a small development team who uses native Windows and primarily works with Node.js, TypeScript, or web repositories while giving coding instructions and artifact context in Thai.
_Avoid_: Normal people, all developers, general consumers

## Agent

**Local Agent Runtime**:
The trusted thcode process that conducts a developer's coding session within an approved workspace.
_Avoid_: CLI UI, hosted agent

**Reasoning Provider**:
An external provider through which thcode accesses one or more reasoning models.
_Avoid_: Tool provider, AI service

**Reasoning Model**:
The session-selected model that interprets the developer's intent and proposes actions.
_Avoid_: Tool, service

**Workspace Artifact**:
A developer-selected repository item used as task context, such as source code, a document, or an image.
_Avoid_: Attachment, arbitrary file

**Plan Mode**:
A read-only Work Mode that uses planning-focused instructions to inspect approved context, reason about the task, and propose work without changing the workspace.

**Build Mode**:
A Work Mode in which thcode may inspect context, change the workspace, run permitted actions, and verify results under the active Permission Profile.

**Work Mode**:
The independently selected operating state that determines whether the agent is limited to planning or may execute changes; it does not determine how approvals are handled.
_Avoid_: Permission profile, workflow stage

**Mode Instruction Set**:
The system-level behavioral guidance attached to a Work Mode, emphasizing analysis and non-mutation in Plan Mode or execution and verification in Build Mode.
_Avoid_: User prompt, permission policy

## Authority and Approval

**Permission Profile**:
The session-selected policy governing when thcode executes an otherwise permitted action automatically and when it asks the developer.
_Avoid_: Mode, role, access level

**Manual Profile**:
The default Permission Profile in which material remote transfers, workspace changes, commands, and sensitive operations require developer approval.
_Avoid_: Safe mode

**Assisted Profile**:
A Permission Profile in which deterministic policy may approve low-risk actions and an AI risk classifier may recommend escalation, while uncertainty returns authority to the developer.
_Avoid_: AI permission, autonomous mode

**Full Access Profile**:
A session-only Permission Profile that automatically approves every action allowed by the active Work Mode and declared boundaries while retaining non-negotiable security rules and a separate sensitive-transfer override.
_Avoid_: No security, unrestricted machine access

**Hard Security Rule**:
A non-negotiable restriction that no Permission Profile or AI recommendation can override, such as preventing credential disclosure or provider-host confusion.
_Avoid_: Approval preference

**Prompt Composer**:
The terminal input area in which the developer enters prompts and slash commands.
_Avoid_: Chat bar, command line

**Permission Selector**:
The interactive terminal control opened by `/permissions` for inspecting and choosing a Permission Profile.
_Avoid_: Inline-only command, operating-system dialog

**New Session Default**:
The initial state for a newly created interactive session: Build Mode with the Manual Profile.
_Avoid_: Restored session state, global preference

## Session and Context

**Global Session Store**:
The machine-local, operating-system-user-scoped home for all Saved Sessions, regardless of their associated workspace.
_Avoid_: Cloud sync, project-local history, shared account storage

**Saved Session**:
A locally retained agent session that includes its complete previous chat and enough task state to browse or continue the work later.
_Avoid_: Resume pointer, active model context

**Workspace Binding**:
The explicit association between a Saved Session and the repository location and identity against which its local tools may operate.
_Avoid_: Current directory, implicit project selection

**Runtime Activation**:
One live opening of a Saved Session during which temporary permissions and approvals may exist; reopening creates a new Runtime Activation.
_Avoid_: Saved session, chat transcript

**Session Browser**:
The interactive terminal control opened by `/session` or `/sessions` for finding, opening, creating, renaming, inspecting, or deleting Saved Sessions.
_Avoid_: Resume picker, file browser

**Chat Transcript**:
The complete chronological record of user and assistant messages belonging to a Saved Session, displayed again when that session is opened.
_Avoid_: Active context, model prompt

**Active Model Context**:
The bounded selection of instructions, chat turns, summaries, tool definitions, and workspace evidence prepared for the next Reasoning Model request.
_Avoid_: Chat transcript, saved session

**Context Budget**:
The maximum share of a selected model's context window that thcode may allocate before reserving space for the expected response and safety margin.
_Avoid_: Transcript size, token bill

**Effective Context Capacity**:
The selected model's context limit minus reserved response space and a safety margin; this is the 100% denominator for Active Context Utilization.
_Avoid_: Raw context window, cumulative tokens

**Active Context Utilization**:
Active Model Context tokens divided by Effective Context Capacity, expressed as the percentage shown by the Context Donut.
_Avoid_: Session token usage, transcript size

**Context Donut**:
The numeric and graphical Active Context Utilization indicator at the lower-right edge of the Prompt Composer.
_Avoid_: Token bill meter, cumulative usage ring

**Cumulative Token Usage**:
Provider-reported or explicitly estimated input, output, and cached tokens consumed across completed model calls in a Saved Session.
_Avoid_: Context utilization, transcript size

**Context Compaction**:
The inspectable replacement of older Active Model Context content with a smaller summary while preserving the complete Chat Transcript locally.
_Avoid_: Chat deletion, session truncation

**Automatic Compaction**:
Context Compaction performed before a model call when the projected request would exceed Effective Context Capacity.
_Avoid_: Provider truncation, transcript deletion

**Irreducible Context Overflow**:
The blocked state in which required instructions, Pinned Turns, new input, and other protected context still exceed Effective Context Capacity after compaction.
_Avoid_: Provider error, silent truncation

**Pinned Turn**:
A Chat Transcript turn the developer requires thcode to preserve verbatim in Active Model Context during compaction.
_Avoid_: Saved message, permanent system prompt

## AI Service Coverage

**AI Service**:
An upstream AI for Thai capability that accepts a defined input and produces a specialized result.
_Avoid_: Model, MCP

**Agent Tool**:
The normalized, policy-controlled form in which an AI Service is made available to a Reasoning Model.
_Avoid_: Raw endpoint, AI service

**Tool Catalog**:
The complete set of AI for Thai services known to thcode, including services that are not yet callable or accessible to the current user.
_Avoid_: Available tools, supported services

**Catalog Manifest**:
The versioned snapshot from which thcode presents the Tool Catalog, with an upstream source and observation date for every service entry.
_Avoid_: Live service discovery, scraped catalog

**Catalogued Service**:
An AI Service that appears in the Tool Catalog with enough metadata to be discovered and inspected.
_Avoid_: Supported service

**Integrated Service**:
A Catalogued Service for which thcode has a callable mapping and defined credential policy.
_Avoid_: Verified service

**Verified Service**:
An Integrated Service that passes a repeatable live contract test using representative input.
_Avoid_: Catalogued service, assumed-working service

**Demo-Certified Service**:
A Verified Service that passes a complete Typhoon-driven user scenario selected for public demonstration.
_Avoid_: Strong service, featured service

**Service Entitlement**:
Permission associated with an AI for Thai credential to invoke a particular AI Service.
_Avoid_: Catalog visibility, integration status

**Category Coverage**:
The Phase 1 requirement that at least one service in each AI for Thai category—Language, Vision, Conversation, and Other—is Verified.
_Avoid_: Full catalog support

**Verification Quartet**:
The four Phase 1 services selected to prove Category Coverage: Named Entity Recognition, T-OCR, Speech-to-Text, and Extract Address.
_Avoid_: Demo set, all supported services

**Demo Portfolio**:
The Demo-Certified Services selected for public scenarios: T-OCR, Speech-to-Text, and Extract Address.
_Avoid_: Strongest services, verification quartet

**Demo Scenario**:
An independent, reproducible Typhoon-driven coding task that proves one Demo-Certified Service without depending on another demo service.
_Avoid_: Feature tour, combined showcase

## Platform

**Onboarded thcode Service**:
The thcode-owned AI service accepted for publication and access through the AI for Thai platform.
_Avoid_: Typhoon provider, local agent runtime
