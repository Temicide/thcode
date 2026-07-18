# Competitive Landscape and Novelty Claims

## Evidence reviewed

### Claude Code and Codex

Mature foreign-model coding agents already provide repository exploration, file editing, shell execution, permissions, and verification. They establish the expected user experience but do not establish a Thai-model or AI for Thai service.

### OpenCode and similar generic harnesses

OpenCode is a terminal coding agent with a modular provider architecture and support for self-hosted OpenAI-compatible endpoints. Its current documentation describes more than 75 providers, `/models`, built-in repository tools, custom tools, local and remote MCP servers, image and PDF attachment paths, configurable permissions, and a headless server. Because Typhoon exposes an OpenAI-compatible API, a generic harness can be configured to call Typhoon.

Primary source: https://github.com/opencode-ai/opencode

Additional primary sources:

- Providers: https://opencode.ai/docs/providers
- MCP servers: https://opencode.ai/docs/mcp-servers
- Tools and permissions: https://opencode.ai/docs/tools
- Server: https://opencode.ai/docs/server

OpenCode's MCP documentation warns that tool definitions add to model context and that a large MCP surface can exceed context limits. This creates an opportunity for thcode to use server-side dynamic tool discovery and reveal only relevant AI for Thai schemas to the reasoning model.

### Typhoon MCP example

Typhoon publishes a tutorial that connects a Typhoon model to MCP tools, creates a LangGraph ReAct agent, and wraps it in a simple CLI chat loop. This directly disproves a broad claim that Thai models have never been placed in a CLI tool-using harness.

Primary source: https://docs.opentyphoon.ai/en/mcp/

### AI for Thai catalog

The reviewed catalog contains language, vision, conversation, and specialist APIs. No developer-oriented repository coding-agent service was found in the current catalog review.

Primary source: https://aiforthai.in.th/

## Claims to avoid

- "The first Thai LLM CLI agent ever created."
- "No Thai developer has built a coding-agent harness."
- "Thai models cannot currently use tools."
- "Existing coding agents cannot connect to Typhoon."

These claims are broader than the available evidence and at least partly contradicted by existing documentation.

## Defensible working claim

> thcode proposes a new developer-oriented service category for AI for Thai: a Thai Agent Compatibility Layer that makes Thai reasoning models reliably usable in coding-agent loops through Thai intent compilation, mixed-artifact conversion, dynamic AI for Thai tool routing, context governance, and validated local actions.

This wording is still a working claim. Before submission, verify the current AI for Thai catalog again and describe the search scope rather than claiming universal novelty.

## Differentiation that must be demonstrated

1. **Mixed repository artifacts:** typed handling for code, Markdown, images, DOCX, PDF, and directory manifests.
2. **Capability-aware routing:** models and AI for Thai tools are selected according to verified modality and task support.
3. **Distributed safety boundary:** server-side AI tools cannot directly access the repository; local tools remain permission-controlled.
4. **Thai developer interaction:** requests, ambiguity handling, tool explanations, and completion summaries work naturally in Thai.
5. **AI for Thai-native service composition:** the hosted API calls selected AI for Thai services rather than requiring every CLI user to build MCP adapters.
6. **Evaluation:** reproducible Thai coding tasks show task success, structured tool-call reliability, image/document usefulness, latency, and safe rejection.

## Likely reviewer objection

> Why not configure OpenCode with the Typhoon API and add an AI for Thai MCP server?

The proposal needs an evidence-backed response. The current answer is that thcode is not merely a preconfigured harness: it adapts Thai models through dynamic tool-schema selection, artifact conversion for text-only models, structured-action repair and validation, context budgeting, and Thai-specific evaluations. These mechanisms must be tested directly against the OpenCode baseline. If they do not materially improve measured outcomes, the objection remains valid.
