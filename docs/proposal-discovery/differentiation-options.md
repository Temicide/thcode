# Differentiation Options

## Strongest recommendation: Thai Agent Compatibility Layer

### Competitive thesis

OpenCode connects many models to many tools. thcode should instead specialize in making Thai models and AI for Thai services reliable, efficient, and measurable for software-engineering agent loops.

The compatibility layer combines the intent compiler below with four additional mechanisms:

1. **Dynamic tool router:** expose only the small subset of AI for Thai tool schemas relevant to the current task instead of loading every MCP tool into model context.
2. **Artifact adapters:** turn images, PDFs, DOCX, and other referenced artifacts into normalized evidence that a text-only Thai reasoning model can consume.
3. **Action compiler and validator:** convert or repair model output into typed local tool calls; reject unknown tools, invalid paths, schema errors, and policy violations before execution.
4. **Context governor:** select, rank, compress, cache, and budget repository and tool context for the selected Thai model.

The runtime is distributed after ADR 0007:

- **Local CLI:** reasoning-provider adapters and keys, intent compilation, repository context, action validation, permissions, and execution.
- **Phase 1 local AI for Thai adapter:** separately stored user credential, selected external-service calls, and normalized evidence.
- **Phase 2 onboarded Artifact Intelligence API:** mixed-artifact conversion, specialist-service routing, and normalized evidence. Whether it receives a caller key through the AI for Thai gateway or uses another credential arrangement must be confirmed with the organizers.

### Strong comparison statement

> OpenCode is a general harness that exposes providers and MCP tools to a model. thcode is a Thai-model adaptation runtime that compiles Thai developer intent and mixed artifacts into a minimal, validated agent context, then produces safe local coding actions using AI for Thai services.

### Required proof

Use the same Typhoon model, the same repository tasks, and the same AI for Thai services in both systems. thcode must improve at least one meaningful outcome without materially worsening the others:

- end-to-end task success;
- correct AI for Thai tool selection;
- valid local tool-call rate;
- context tokens per completed task;
- number of model and AI for Thai calls;
- time to passing tests;
- detection of ambiguous Thai requirements;
- unsafe action rejection.

If the benchmark shows no advantage, the differentiation claim fails and the proposal must be revised.

## Component: Thai Developer Intent Compiler and AI Tool Router

### Problem

Thai developer requests often mix colloquial Thai, English technical terms, implicit subjects, screenshots, documents, and local business rules. A generic coding-agent prompt may proceed with a wrong interpretation or require the user to translate the request into formal English.

### Service behavior

Input:

- Thai or Thai-English developer request;
- repository manifest and selected context;
- mentioned artifact metadata;
- available local and server tool schemas;
- active policy and reasoning-model capabilities.

Output:

- normalized `CodingTaskSpec`;
- clarification questions for material ambiguity;
- artifact-processing and repository-context plan;
- Thailand-specific requirement flags;
- AI for Thai tool calls or safe local tool-call proposals;
- verification criteria.

### Why it is more than a prompt

- Versioned structured schemas
- Thai/code-switch terminology normalization
- Deterministic validation and policy checks
- Capability-aware model and tool routing
- Explicit ambiguity detection
- Thailand-specific requirement rules
- Evaluation against a Thai coding-task benchmark

### Candidate measurements

- Intent-field extraction accuracy
- Material ambiguity detection precision/recall
- Valid structured tool-call rate
- Correct file-selection rate
- End-to-end task pass rate
- Unsafe action rejection rate
- Thai user-rated explanation clarity

## Supporting differentiators

### Multimodal repository context

Resolve code, Markdown, images, DOCX, PDF, and directory mentions through type-specific policies and AI for Thai vision/language services.

Best role: prominent feature and demo input, but insufficient as the only novelty claim.

### Thailand-aware application engineering

Recognize requirements involving Thai language and local conventions, such as:

- Buddhist Era display versus ISO storage;
- Thai address structure and text normalization;
- Thai fonts and localization;
- PromptPay-related integration patterns;
- PDPA-sensitive data handling;
- Thai document and OCR workflows.

Best role: differentiating benchmark category and source of real user value.

### Thai safety and permission explanation

Explain shell commands, data uploads, secrets, destructive actions, and consequences in clear Thai before asking for approval.

Best role: required trust feature and evaluation axis.

### AI for Thai service discovery

Given a desired app feature, recommend and invoke an appropriate AI for Thai service with normalized schemas and error handling.

Best role: competition-aligned tool feature. It must be combined with the intent compiler and coding loop to avoid becoming only an API directory.

### Thai-model evaluation router

Compare configured Thai reasoning models per task and expose capability evidence through `/models`.

Best role: research and transparency feature. Multi-model routing should not expand the MVP beyond the available Typhoon adapter.

### Context optimization for smaller Thai models

Select and compress repository context so smaller or lower-cost Thai models can complete useful coding tasks without receiving an entire repository.

Best role: important technical differentiator after a baseline loop works; requires careful evaluation.

## Recommended product statement

> thcode is a downloadable Thai-first coding agent powered by an AI for Thai-onboarded Agent Compatibility Layer. It adapts Thai models for software-engineering loops by compiling Thai intent, converting mixed artifacts, dynamically routing Thai AI services, and validating safe local coding actions.

## Recommended headline demonstration

The user provides one colloquial Thai request containing English technical terms, one referenced specification or screenshot, and one Thailand-specific requirement. thcode should:

1. normalize the request into a visible task specification;
2. ask about one intentionally ambiguous requirement;
3. process the referenced artifact through an AI for Thai service;
4. inspect only relevant repository files;
5. implement the change locally;
6. run a verification command;
7. explain the result and any remaining risk in Thai.
