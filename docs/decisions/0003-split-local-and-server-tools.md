# ADR 0003: Split Local Repository Tools from Server AI Tools

- Status: Amended by ADR 0010
- Date: 11 July 2026
- Decision owner: Applicant

## Context

thcode should let developers reference many repository artifact types, including source code, Markdown, images, and office documents. The hosted model orchestrator should also be able to use AI for Thai services such as OCR and other language or vision APIs.

A hosted orchestrator cannot safely or directly open a path on a developer's computer. Conversely, repeatedly returning every AI for Thai tool call to the CLI would expose service credentials and add unnecessary round trips.

## Decision

thcode will use two tool classes and two nested loops.

### Local tools

Local tools execute only through the downloadable CLI:

- list and search repository files;
- read and extract referenced artifacts;
- apply patches;
- run shell commands, builds, and tests;
- inspect git state;
- enforce workspace, permission, and secret policies.

The hosted service can request a local tool call, but it cannot execute one. Every local request is treated as untrusted structured data until the CLI validates it.

### Server tools

The long-term design executes server tools through the hosted thcode orchestrator:

- Pathumma or another approved Thai LLM;
- AI for Thai OCR, captioning, language, or other selected APIs;
- future remote dependencies explicitly documented in the proposal.

Server tools receive only content deliberately transferred by the CLI. They never receive an unresolved local filesystem path as authority to fetch a file.

Before onboarding, Phase 1 calls selected AI for Thai tools through a local adapter using the user's locally stored AI for Thai API key. ADR 0010 defines the transition to the hosted path.

### Nested loop model

The local CLI owns the outer agent loop. For each reasoning turn, the hosted service may run a bounded server-side sub-loop over AI for Thai tools. It then returns either:

- a structured request for a local tool;
- a request for additional user input;
- or a final response.

## Artifact-reference policy

- Code and Markdown: validate the path, enforce size limits, detect secrets, then send selected text.
- Images: validate type and size, show that the image will leave the machine, then upload with explicit consent.
- DOCX and PDF: extract text locally by default; upload the original only when layout or embedded images are required and the user consents.
- Unsupported binary files: send metadata only or reject with a clear explanation.
- Directories: send a bounded manifest first; read individual files only through subsequent local tool calls.

## Consequences

- The security boundary is understandable and testable.
- In Phase 1, the user's AI for Thai key remains in the local operating-system credential store and is used only by the local adapter. In Phase 2, credential handling depends on the AI for Thai onboarding gateway and must be confirmed with the organizers.
- Multimodal files can be supported without uploading the entire repository.
- The protocol must support resumable turns because a server response may pause for a local tool result.
- The team must define limits for server sub-loop calls, time, payload size, and failure handling.
