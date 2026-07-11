# Provisional Domain Model

This model will be revised after each interview answer. The local/remote product boundary is now accepted; user and value boundaries remain provisional.

## Actors

- **First Target User**: a Thai-speaking student, junior developer, or small-team developer using native Windows and primarily working with Node.js, TypeScript, or web repositories; asks for software work in Thai, supplies referenced artifacts, reviews plans and diffs, and approves risky actions.
- **Service operator**: deploys and monitors the onboarded API.
- **AI for Thai platform**: hosts the submitted service and may also supply upstream Thai AI APIs.
- **Model/API provider**: performs inference or a specialized Thai-language task.
- **Competition reviewer**: evaluates usefulness, Thai-technology use, feasibility, safety, and readiness.

## Candidate core entities

- **Workspace**: the repository and its permitted file boundary.
- **Coding task**: the user's desired software outcome plus constraints and acceptance checks.
- **Agent session**: state for one task across model calls and tool executions.
- **Model adapter**: a normalized local interface to Typhoon, Pathumma, or another Thai reasoning provider.
- **Capability registry**: versioned metadata describing catalog identity, modalities, entitlement, policy, and evidence for each reasoning model or AI service.
- **Model router**: the local component that selects the explicit reasoning provider and chooses native or AI for Thai-assisted artifact context based on capability evidence and policy.
- **Reasoning model selection**: the explicit model adapter chosen for an agent session; Typhoon is the MVP default.
- **Provider adapter**: a normalized local interface for sending reasoning turns to one model provider while preserving provider-specific capability metadata.
- **Credential store**: the operating system facility used to retain provider API keys outside project files, configuration files, logs, and session transcripts.
- **Tool**: a capability available to the agent, such as file search, patching, tests, or an AI for Thai API.
- **Local tool**: a capability executed by the CLI against the developer's workspace, such as repository search, file reading, patching, shell commands, or tests.
- **Remote AI service**: an external specialist capability invoked through the Phase 1 local adapter or the Phase 2 onboarded thcode service, without authority over the developer's workspace.
- **Tool call**: a proposed invocation with arguments, authorization state, output, and audit data.
- **Policy**: rules governing filesystem, shell, network, secrets, and human approval.
- **Artifact**: a plan, patch, explanation, test report, or generated file produced by a session.
- **Image context**: a developer-selected screenshot, mockup, diagram, or other image supplied for one coding task.
- **Artifact reference**: an explicit mention of a repository path such as `@README.md`, `@src/app.ts`, `@screen.png`, or `@proposal.docx`.
- **Artifact resolver**: the local component that validates a referenced path, detects its type, enforces size and privacy rules, and prepares permitted content for the hosted service.
- **Vision adapter**: an interface to specialized services such as OCR, captioning, object recognition, or image-text matching.
- **Visual coding context**: structured text and regions derived from image context for use by the Thai reasoning service.
- **Evaluation case**: a reproducible coding task with expected outcomes and measurements.
- **Onboarded service**: the Dockerized thcode Artifact Intelligence API that routes approved artifacts through AI for Thai services and returns normalized developer context.

## Candidate relationships

1. A developer submits a coding task against a workspace.
2. The local artifact resolver validates explicit file mentions and prepares permitted text, metadata, or uploaded binary content.
3. When specialist processing is needed in Phase 1, the CLI calls an entitled AI for Thai service through its local adapter and returns normalized evidence to the agent loop; Phase 2 may route this through the onboarded thcode service.
4. The local model router resolves the session's explicit reasoning-model selection and checks the capability registry.
5. The local provider adapter sends the Thai request, prepared artifact evidence, local tool schemas, and prior tool results directly to the selected reasoning provider using the locally stored credential.
6. The reasoning provider returns a final response or a structured local tool-call request.
7. Local policy and action validation reject, repair, request approval for, or permit each proposed local tool call.
8. The local CLI executes permitted local tools and returns their results in the next direct provider turn.
9. The loop continues locally until the provider returns a final response or a local stop condition is reached.
10. Evaluation cases measure task completion, correctness, safety, latency, context disclosure, and cost.

## Accepted boundary

### Local agent loop with remote Thai reasoning

The downloadable CLI owns session state, provider adapters, direct reasoning-provider calls, the agent loop, permissions, repository access, tool-call validation, execution, and verification. The onboarded service processes explicitly approved artifacts through AI for Thai tools and returns normalized evidence; it does not own the user's reasoning-provider credential or local tool loop.

## Rejected boundary alternatives

### Complete hosted agent loop

Rejected for the initial version because it would require uploading or cloning substantially more repository state, increases security scope, and makes local-tool integration harder.

### Direct Pathumma wrapper

Rejected as the complete submission because it does not yet demonstrate an original onboardable AI capability.

## Invariants to test

- No repository mutation occurs outside the declared workspace.
- A user can inspect the intended action before a high-impact tool call.
- Secrets and source code are not sent to an upstream API without an explicit data-handling policy.
- A session remains reproducible enough to audit failures.
- The submitted service can run as a documented Dockerized API and sustain a stated load target.
- The hosted API cannot execute a local tool directly; only the local CLI can authorize and execute it.
- Repository content sent to the hosted API is selected deliberately and can be audited.
- A server tool cannot be given implicit access to local paths; all content crosses the boundary through the artifact resolver.
- A raw image cannot be sent to an endpoint unless the capability registry explicitly marks that endpoint as accepting image input.
