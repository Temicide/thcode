# Glossary

## Accepted terms

- **AI for Thai**: NECTEC's platform for Thai AI APIs and externally onboarded AI services.
- **Coding agent**: software that uses a model in a loop to inspect a repository, plan work, invoke tools, modify code, and verify results.
- **CLI**: the local command-line client through which a developer interacts with thcode.
- **MCP**: Model Context Protocol, a protocol for exposing tools and contextual resources to model-driven clients.
- **Pathumma**: the Thai large-language-model family explicitly named in the proposal form.
- **Tool**: an operation the agent may invoke, such as reading files, applying a patch, running tests, or calling an API.
- **Onboarded service**: the applicant-owned API packaged and reviewed for publication on AI for Thai.
- **Agent loop**: the repeated cycle of sending task context to a model, receiving a proposed tool call, executing it under policy, returning the result, and continuing until completion.
- **Local harness**: the downloadable thcode CLI components that manage sessions, permissions, context, tools, and verification on the developer's computer.
- **Reasoning turn**: one request from the local harness to the hosted thcode API and its response, which is either a structured tool-call proposal or a final answer.
- **Structured tool call**: a machine-readable request containing a tool name, validated arguments, and an identifier; it is a proposal rather than direct access to the user's machine.
- **Artifact reference**: an explicit repository mention such as `@README.md`, `@src/app.ts`, `@screen.png`, or `@proposal.docx` that the local CLI resolves under policy.
- **Local tool**: a tool executed on the developer's computer under the CLI's sandbox and approval policy.
- **Server tool**: an AI for Thai or approved remote service called by the hosted orchestrator without access to the developer's filesystem.
- **Outer agent loop**: the local CLI cycle that sends a reasoning turn, executes approved local tool requests, and returns their results.
- **Server sub-loop**: the hosted orchestrator's internal sequence of calls to AI for Thai services before it requests a local action or returns a final response.
- **Capability registry**: verified metadata used to decide whether an endpoint can accept a modality or reliably perform a required behavior.
- **Native vision route**: direct image-and-text input to a verified vision-language model.
- **Tool-assisted vision route**: AI for Thai vision services convert an image into OCR, captions, or other structured evidence before a text-only Thai LLM reasons over it.
- **Reasoning model**: the session-selected LLM that interprets context and proposes actions; Typhoon is the competition MVP default.
- **Provider adapter**: the local implementation that maps thcode's normalized reasoning protocol to a specific model endpoint without disclosing the user's provider credential to thcode's hosted service.
- **Model selector**: the CLI `/models` interface for viewing available reasoning models and selecting one for a session.
- **Local BYOK**: bring-your-own-key authentication in which the provider credential is stored by the operating system and used directly by the local CLI.
- **CLI-only prototype**: the competition deliverable in which every user-facing workflow occurs in the terminal; the hosted service has an API but no separate end-user UI.
- **Product wedge**: the first narrowly scoped product used to prove demand and core technology before expanding toward the broader vision.
- **Competition MVP**: the downloadable thcode developer CLI plus the Dockerized Thai coding-reasoning API; it excludes the later general-purpose work-agent experience.
- **Image context**: an image explicitly selected by the developer for a coding task; thcode must not assume permission to upload arbitrary repository images.
- **Visual coding context**: OCR text, captions, detected regions or objects, and task-specific interpretation derived from an image for use in the coding loop.
- **Tool catalog**: the user-visible collection of AI for Thai services known to thcode; catalog presence does not imply that the user's account can invoke the service.
- **Catalogued service**: a service represented in thcode's registry with descriptive metadata but not necessarily an implemented endpoint mapping.
- **Integrated service**: a catalogued service with an implemented endpoint mapping, normalized schema, and credential policy.
- **Verified service**: an integrated service with a passing repeatable contract test against the live endpoint.
- **Demo-certified service**: a verified service that has passed an end-to-end Typhoon agent-loop scenario and is approved for demonstration.

## Terms needing sharper definitions

- **Thai-first**: Open - could mean Thai user interaction, Thai code/domain understanding, Thai-owned models, Thai data governance, or all four.
- **Alternative to Codex/Claude Code/OpenCode**: Open - could mean feature parity, a narrower Thai-specialized workflow, or protocol compatibility.
- **Better**: Open - must name a measurable outcome and comparison baseline.
- **Thai model**: Open - must distinguish Thai-developed, Thai-trained, Thai-language-capable, and hosted-in-Thailand.
- **Thai coding intelligence**: Open - must be defined as an original capability and measurable result beyond proxying an existing model.
- **First Target User**: Accepted - a Thai-speaking student, junior developer, or small-team developer using native Windows and primarily working with Node.js, TypeScript, or web repositories while providing Thai instructions and artifact context.
- **Vision**: Open - must name a supported image class and task; OCR, captioning, layout understanding, and general visual reasoning are not interchangeable.
