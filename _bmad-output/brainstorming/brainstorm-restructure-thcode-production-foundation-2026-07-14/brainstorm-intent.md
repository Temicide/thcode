# Production Restructuring Intent

## Objective

Restructure **thcode** into a production-grade, scalable foundation centered on a provider and specialist-service extension platform. Usable model and service connectivity is the architectural core; safety, UX, observability, and recovery must be built around it.

## Architectural Foundation

- Treat reasoning-model providers and specialist AI services as discoverable extension points. Adding one must not require UI changes or modifications to existing implementations.
- Drive the TUI from extension metadata and reusable generic components.
- Allow post-installation, declarative configuration of providers, including local or private OpenAI-compatible endpoints such as Ollama and vLLM.
- Support end-user configuration of specialist services such as private OCR and speech-to-text endpoints.
- Use named protocol profiles: built-in OpenAI-compatible and Anthropic profiles for reasoning providers, declarative HTTP request/response mappings for specialist services, and reviewed built-in adapters for unsupported protocols.
- Keep user configuration non-executable: it may define endpoints, models, and service mappings, but cannot supply custom adapter code.
- Keep slash commands product-controlled: reviewed TypeScript shipped by thcode, not user-defined configuration.

## Availability Gate and Failure Lifecycle

- Run a live API health check whenever a model is configured; expose it as available only after the check passes.
- Availability requires only the API health check, not a tool-calling compatibility test.
- If real use reveals a protocol failure, report the specific error, mark the provider unhealthy, and prevent reuse until the configuration is fixed and the user explicitly retests it.
- Never silently repair or reinterpret a failing protocol configuration.
- Classify remote-service failures deterministically from network evidence. Show users a clear model-generated explanation while retaining access to the deterministic category and sanitized raw evidence.

## Trust and Safety Requirements

- thcode owns a reliable structured tool-execution harness and polished, consistent TUI; upstream model and service output quality remains the dependency provider's responsibility.
- Present every proposed tool call in a compact visible approval log. Lead with a plain-language purpose and allow inspection of exact transfer details and side effects.
- For executable local actions, show the exact command before approval. For specialist-service calls, show method, verified endpoint, service, safe payload summary, and purpose; never expose credentials.
- Visibly mark dangerous actions and require approve/deny review.
- Hard-refuse actions that threaten the host OS or out-of-workspace resources. Declared workspace, command, network, service, and quota boundaries remain effective even under Full Access; separately approved boundary expansions persist across later activations.

## Observability

- Use one prompt round as the primary user-facing performance unit and record total end-to-end duration.
- Retain subsystem timings for developers while ordinary users see the round total.
- Record token usage while keeping Active Context Utilization distinct from Cumulative Token Usage.

## Recovery and Change Reversal

- After a crash leaves a remote request outcome uncertain, do not retry automatically. Preserve received model output and append an explicit `Chat interrupted` marker at the interruption point; the user must deliberately reprompt.
- Maintain prompt-level rollback checkpoints using before hashes and exact agent patches. Reverse only matching agent changes and stop for manual resolution when later edits overlap.
- Temporarily preserve complete originals of changed or deleted binary files.
- Retain rollback checkpoints for five subsequent prompts by default, make retention configurable, and delete expired data.

## Architecture Success Conditions

The resulting structure must make the full extension lifecycle explicit and separable: configuration, protocol selection, discovery, generic UI rendering, API health gating, invocation, observable failure handling, and explicit retesting. Supporting safety, metrics, crash recovery, and rollback capabilities must integrate with that lifecycle without coupling the UI to any specific provider or service.
