# ADR 0004: Typhoon Default with Pluggable Reasoning Models

- Status: Amended by ADR 0007
- Date: 11 July 2026
- Decision owner: Applicant

## Context

The applicant currently has Typhoon API access and wants Typhoon to be the primary reasoning model. The longer-term product should support other Thai models without redesigning the CLI or agent protocol.

AI for Thai also exposes specialized services. These services are agent tools rather than interchangeable reasoning models and need separate capability, quota, and policy handling.

## Decision

Typhoon will be the default reasoning model for the competition MVP.

The original decision placed provider adapters in the hosted orchestrator. ADR 0007 moves provider adapters into the local CLI. The CLI will expose `/models` to list adapters and select the reasoning model for the current session.

The initial model-selection behavior is:

- `typhoon-v2.5` is selected by default;
- a user may inspect available adapters with `/models`;
- a user may select an available adapter explicitly;
- an unavailable or unconfigured adapter is shown with a reason and cannot be selected;
- the selected model remains stable for the session unless the user changes it;
- the service never silently substitutes a different model.

AI for Thai OCR, captioning, language, and vision services live in a separate server-tool registry. A future `/tools` command may expose their status and capabilities.

## Provider-adapter contract

Each reasoning adapter must report:

- stable model identifier and provider;
- availability and authentication state;
- supported input modalities;
- context limit;
- structured-output or native tool-call support;
- streaming support;
- data-handling notes;
- retryable errors and rate-limit metadata.

Each adapter must accept thcode's normalized message and tool schemas and return either a normalized tool-call proposal or a final response.

## Consequences

- The competition implementation can remain focused on one proven model.
- Future Thai models can be added behind a stable protocol.
- Cross-model evaluation becomes possible.
- Model-specific differences cannot be completely hidden; the CLI must show capability differences.
- Session replay must record the exact model and adapter version used.
- User-supplied provider API keys remain in the local operating system credential store and are never sent to the thcode server.

## MVP limit

Only the Typhoon adapter is required for the competition demonstration. Pathumma and THaLLE adapters are roadmap items until access and validation are complete.
