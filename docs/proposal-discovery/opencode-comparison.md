# thcode versus OpenCode Baseline

## What OpenCode already provides

The proposal must not use these as headline differentiators:

| Capability | OpenCode evidence |
| --- | --- |
| Terminal coding agent | Core product |
| Many model providers and local models | More than 75 providers; custom OpenAI-compatible endpoints |
| `/models` selection | Provider documentation |
| Repository read/search/edit/shell tools | Tools documentation |
| Local and remote MCP tools | MCP documentation |
| Custom tools | Custom-tools documentation |
| Tool permissions | Allow, ask, or deny policies with patterns |
| Images and PDFs | Attachment and read-tool support in current source |
| Headless server/API | `opencode serve` with OpenAPI |

## Proposed thcode advantages

| Mechanism | OpenCode + Typhoon + raw MCP baseline | thcode target |
| --- | --- | --- |
| Thai request handling | Passed directly to model | Compile to typed task spec; detect ambiguity and Thai-specific requirements |
| AI for Thai tool surface | MCP schemas configured and exposed | Search capability registry and reveal only relevant schemas |
| Text-only model + image | Requires provider support or explicit tool use | Automatically derive normalized OCR/caption evidence through AI for Thai |
| Tool-call reliability | Depends primarily on model/provider behavior | Validate, repair, retry, or reject against typed schemas and local policy |
| Repository context | Generic read/search loop | Rank and budget context for selected Thai model; cache artifact evidence |
| Evaluation | General product behavior | Thai coding and Thai tool-use benchmark with adapter-specific results |
| User setup | Configure provider, keys, MCP servers, tools | Guided CLI setup with isolated Typhoon and AI for Thai credentials, plus a curated Thai-service toolset; Phase 2 gateway behavior remains subject to onboarding confirmation |

## Fair benchmark design

### Baseline

- Current OpenCode release
- Typhoon 2.5 as reasoning model
- The same selected AI for Thai services exposed as MCP tools
- Equivalent local permissions

### Treatment

- thcode CLI and hosted compatibility layer
- The same Typhoon model
- The same selected AI for Thai services
- Equivalent local permissions

### Task set

At least 20 reproducible tasks covering:

- Thai-only and Thai-English code-switched requests;
- an intentionally ambiguous requirement;
- image or document context;
- repository search and multi-file editing;
- one Thailand-specific application requirement;
- unsafe or out-of-workspace action attempts.

### Measurements

- tests or acceptance checks passed;
- relevant files selected;
- valid versus invalid tool calls;
- AI for Thai tool-selection accuracy;
- prompt and tool-schema tokens;
- model turns and service calls;
- wall-clock completion time;
- user intervention count;
- policy violations blocked.

## Go/no-go condition

Do not claim that thcode is better than OpenCode unless the same-model, same-tools benchmark shows a material improvement. Until then, use "designed to improve" rather than "better."
