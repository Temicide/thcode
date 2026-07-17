# Source Extract: Production Restructuring Brainstorm

## Source and scope

- Primary source: `brainstorm-intent.md` in `brainstorm-restructure-thcode-production-foundation-2026-07-14`.
- Secondary source: `brainstorm.html`, consulted only for details absent from the intent document.
- This is a distilled input extract for PRD discovery, not a proposed PRD or a commitment beyond the source.

## Product vision and problem

thcode is to be restructured into a production-grade foundation for an agentic CLI with a polished terminal UI. Its architectural center is a provider and specialist-service extension platform: reasoning models and services such as OCR and speech-to-text should be connectable, discoverable, testable, and usable without coupling the UI or existing extensions to individual implementations.

The trust problem is broader than connectivity. A production system must make extension configuration, actions, risk, failures, performance, interruption, and reversal legible. thcode cannot guarantee the quality or judgment of upstream models and services, but it intends to own a reliable execution harness, explicit boundaries, consistent UI behavior, observable failure handling, and conservative recovery.

The source's central proposition is: connectivity makes the agent useful; safety, observability, failure handling, recovery, and UX make that connectivity trustworthy.

## Target users and stakeholders

The source does not define personas or market segments. It implies the following stakeholders, which should be confirmed rather than treated as final:

- **End users/operators:** configure models and specialist services after installation, select healthy extensions, inspect and approve proposed actions, diagnose failures, explicitly retest corrected configurations, recover interrupted work, and roll back agent changes.
- **Users in private/local environments:** connect local or private OpenAI-compatible endpoints such as Ollama and vLLM, plus private OCR and speech-to-text services.
- **thcode product and extension developers:** ship reviewed slash commands and built-in adapters, publish extension metadata, and add providers/services without creating provider-specific UI or changing existing implementations.
- **Developers/maintainers and incident investigators:** inspect subsystem timing, deterministic failure categories, sanitized evidence, protocol health, token data, and rollback conflicts.
- **Security or platform owners:** define and govern workspace, command, network, service, quota, and sensitive-transfer boundaries, including persistent approved expansions.

The HTML also mentions AI-for-Thai availability and SCB X/Typhoon credentials as examples of upstream variability. It does not clearly commit these as launch integrations.

## Desired outcomes and success signals

### Explicit architectural success conditions

- The entire extension lifecycle is explicit and separable: configuration, protocol selection, discovery, generic UI rendering, live API health gating, invocation, observable failure handling, and explicit retesting.
- A reasoning provider or specialist service can be added without changes to the UI or to existing implementations.
- The TUI is driven by extension metadata and reusable generic components.
- Users can declaratively configure local/private providers and specialist services after installation without injecting executable adapter code.
- Only extensions that pass a live API health check appear available.
- A provider that fails its protocol during real use becomes visibly unhealthy, cannot be reused, and returns only after configuration repair plus explicit user retest.
- Every proposed tool or service action is inspectable and subject to an appropriate approval/refusal flow.
- Remote-service failures preserve deterministic evidence while giving the user an understandable explanation.
- User-visible performance is measured as one total end-to-end prompt round; developer diagnostics preserve subsystem detail.
- Crash recovery preserves known output and uncertainty instead of guessing or retrying.
- Rollback reverses only provably matching agent changes and stops safely on overlap.

### Quantitative success measures not yet supplied

No adoption, reliability, latency, health-check, recovery, rollback-success, security, or extension-development metrics are defined. Candidate measurement areas can be derived from the outcomes above, but target values and counter-metrics require product-owner input.

## Capabilities and feature requirements present in the source

### 1. Extensible provider and specialist-service platform

- Treat reasoning-model providers and specialist AI services as discoverable extension points.
- Drive discovery and rendering from extension metadata through generic TUI components.
- Permit post-install, declarative provider configuration, including local/private OpenAI-compatible endpoints.
- Permit end-user configuration of private specialist endpoints, explicitly including OCR and speech-to-text examples.
- Support named protocol profiles:
  - built-in OpenAI-compatible and Anthropic profiles for reasoning providers;
  - declarative HTTP request/response mappings for specialist services;
  - reviewed built-in adapters when a protocol cannot fit a declarative profile.
- Keep configuration non-executable: endpoints, models, and service field mappings are allowed; custom adapter code is not.
- Keep slash commands product-controlled and shipped as reviewed TypeScript, not user configuration.

### 2. Availability, health, and protocol-failure lifecycle

- Run a live API health check whenever a model is configured.
- Expose the configured model as available only after that check passes.
- Do not make tool-calling compatibility part of the availability gate; health proves connectivity only.
- If a real invocation reveals a protocol failure:
  - report the specific failure;
  - mark the provider unhealthy;
  - block reuse;
  - require configuration correction and an explicit user-initiated retest.
- Never silently repair, reinterpret, or work around a failing protocol configuration.
- Classify remote-service failures deterministically from network evidence.
- Show a clear model-generated explanation while retaining the deterministic category and sanitized underlying evidence for inspection.

### 3. Approval, boundaries, and safety

- Present every proposed tool call in a compact, visible approval log.
- Use two disclosure depths: plain-language purpose first, then exact transfer details and side effects on inspection.
- For local executable actions, show the exact command before approval.
- For specialist-service calls, show method, verified endpoint, service, safe payload summary, and purpose.
- Never display credentials.
- Visibly mark dangerous actions and require explicit approve/deny review.
- Hard-refuse actions threatening the host OS or resources outside the declared workspace.
- Keep declared workspace, command, network, service, and quota boundaries effective even under Full Access.
- Treat sensitive transfer or boundary expansion as a separate approval; previously approved boundary expansions persist across later activations.

### 4. Observability

- Define one prompt round as the main user-facing performance unit and record total end-to-end duration.
- Retain subsystem timing for developers without burdening ordinary users with that detail.
- Record token usage while keeping Active Context Utilization distinct from Cumulative Token Usage.

### 5. Crash recovery and uncertainty preservation

- When a crash makes the outcome of a dispatched remote request uncertain, never retry automatically.
- Preserve all model output received before interruption.
- Append an explicit `Chat interrupted` marker at the exact interruption point.
- Require the user to deliberately reprompt; do not invent a missing ending or assume the remote side did not act.

### 6. Prompt-level rollback

- Create prompt-level rollback checkpoints based on before hashes and exact agent patches.
- Reverse only changes whose current state still matches the recorded agent change.
- Stop for manual resolution if subsequent edits overlap a change to be reversed.
- Temporarily preserve full originals of changed or deleted binary files.
- Retain rollback checkpoints for five subsequent prompts by default.
- Make retention configurable and delete expired rollback data.

## User journeys and workflows to carry into discovery

The source contains workflows but no named protagonists or real-session narratives. These should be elicited and then structured as journeys if the PRD warrants them.

### Configure-to-use extension lifecycle

1. An operator adds an endpoint/model or specialist-service definition after installation.
2. The operator selects a named protocol profile or declarative service mapping.
3. thcode runs a live API health check.
4. A passing extension is registered/discovered and rendered by the generic TUI as available.
5. The user invokes it through the common harness.
6. If the protocol fails in real use, the user sees a specific error and the extension becomes unavailable.
7. The operator fixes the configuration and explicitly retests before reuse.

### Inspect-and-approve action flow

1. The model proposes a local tool action or specialist-service call.
2. The user first sees its plain-language purpose and risk level in a compact log.
3. The user may inspect exact command or safe remote-call transfer details and side effects.
4. thcode omits credentials, enforces declared boundaries, and marks dangerous actions.
5. The user approves or denies; host-OS and out-of-workspace threats are refused regardless of broad access mode.

### Diagnose remote-service failure

1. A remote call fails.
2. The harness derives a deterministic failure category from network evidence.
3. The UI presents an understandable model-generated explanation.
4. A developer or investigating user can inspect the deterministic category and sanitized raw evidence.

### Recover after interrupted remote work

1. A crash occurs after remote dispatch and the remote outcome is unknown.
2. thcode restores all response content known to have arrived.
3. The chat displays an interruption marker at the point execution stopped.
4. thcode does not retry; the user deliberately decides whether and how to reprompt.

### Roll back a prompt

1. The user requests reversal of agent changes associated with a prior prompt.
2. thcode compares recorded before hashes and exact patches with current content.
3. Matching agent changes are reversed.
4. Overlapping later edits cause a safe stop and manual-resolution handoff.
5. Binary originals remain available within the retention window; expired checkpoint data is removed.

## Constraints and product concerns

### Trust boundary and ownership

- thcode owns deterministic behavior of its harness, UI, permissions, evidence, health state, and recovery.
- Model reasoning quality, provider output behavior, provider availability, and third-party credentials remain upstream dependencies and must not be represented as thcode guarantees.

### Security and governance

- User configuration cannot execute code or define slash-command implementations.
- Credentials must never enter action previews.
- Full Access is not boundary-free; the product retains independently declared scopes.
- Host-OS and out-of-workspace threats are non-overridable hard refusals as currently stated.
- Persisted boundary expansions create governance, revocation, audit, and scope-lifetime questions not answered by the source.

### Integration density and protocol contracts

- The product spans reasoning providers and heterogeneous specialist HTTP services.
- Protocol behavior must remain explicit; failed configurations cannot be silently normalized.
- Health status proves API reachability, not downstream capability compatibility.
- Unsupported protocols require reviewed product code, which places an ongoing maintenance and review obligation on thcode.

### Reliability and operational safety

- Remote effects may be unknowable after a crash, so retries must favor correctness over convenience.
- Failure classification and sanitized evidence must remain available even when explanations are model-generated.
- Rollback must preserve user work and avoid reversing later overlapping edits.
- Binary recovery and checkpoint expiry imply storage, cleanup, privacy, and capacity concerns.

### UX

- The TUI must stay consistent and generic across extensions.
- Approval must be compact by default but sufficiently inspectable for informed consent.
- Ordinary users should see round-level performance; diagnostic complexity should be progressively disclosed.
- Unhealthy state, dangerous action state, interruption, and rollback conflict all require unmistakable presentation.

## Explicit decisions

- Provider/service connectivity is the architectural core of the restructuring.
- Providers and specialist services are extension points rendered generically from metadata.
- Adding an extension must not require provider/service-specific UI changes or changes to existing implementations.
- Post-install configuration is declarative and non-executable.
- OpenAI-compatible and Anthropic are built-in reasoning protocol profiles; specialist services use declarative HTTP mappings where possible; unsupported protocols use reviewed built-in adapters.
- Slash commands remain product-controlled reviewed TypeScript.
- Configuration triggers a live API health check, and only passing models are available.
- The health gate checks API connectivity only, not tool-call compatibility.
- Real-use protocol failure makes a provider unhealthy and unusable until correction plus explicit retest.
- Protocol failures are never silently repaired or reinterpreted.
- Approval previews expose purpose and inspectable action details while hiding credentials.
- Host-OS and out-of-workspace threats are hard-refused; Full Access does not erase declared boundaries.
- Remote failures are deterministically classified; model-generated explanations supplement rather than replace evidence.
- The prompt round is the main user-facing latency unit.
- Active Context Utilization and Cumulative Token Usage remain distinct.
- Unknown remote outcomes after a crash are not retried automatically; known output and an interruption marker are preserved.
- Rollback uses before hashes and exact patches, stops on overlap, temporarily preserves binary originals, and defaults to a five-subsequent-prompt retention window.

## Assumptions and ambiguities

The following are reasonable readings of the source, not confirmed decisions:

- thcode is primarily a terminal/CLI product rather than a multi-surface product.
- End users may have enough technical knowledge to configure endpoints, protocols, and service mappings.
- Reasoning providers and specialist services share one extension lifecycle but may have different health checks and invocation contracts.
- An extension registry/metadata contract exists or will exist, though its ownership and distribution model are unspecified.
- “Verified endpoint” means thcode can establish that the preview destination matches the configured/approved endpoint; the exact verification semantics are undefined.
- “Prompt” is the rollback checkpoint boundary and “round” is the performance boundary; their behavior under multi-turn tool execution needs clarification.
- Full Access may permit scoped expansions, but not the stated hard-refusal classes.

## Material open questions

### Product scope and users

- Who is the primary launch user, what job are they doing with thcode, and what concrete pain in the current product/repository prompts this restructuring?
- Is this an internal tool, open-source developer product, commercial launch, or another stakes level?
- Which operating systems, shells, deployment modes, and hardware environments are in scope?
- Which providers and specialist-service types must ship in the initial release? Are AI for Thai, SCB X/Typhoon, Ollama, and vLLM requirements or examples?
- What does a successful real user session look like from start to finish?

### Extension and configuration lifecycle

- Who authors, distributes, reviews, versions, updates, and revokes extensions and built-in adapters?
- What fields may metadata and declarative HTTP mappings express, and how are they validated/migrated?
- How are credentials entered, stored, referenced, rotated, and redacted?
- Are specialist services health-gated exactly like models, and what does a valid health check prove for each service type?
- What happens on transient health failure versus protocol incompatibility, and how is unhealthy state scoped when multiple models share one provider endpoint?
- What are the discovery ordering, naming-collision, duplicate, and version-compatibility rules?

### Safety and approval

- What is the complete tool/action taxonomy and which categories are safe, dangerous, or always refused?
- What exactly qualifies as a host-OS threat, out-of-workspace resource, sensitive transfer, or separately approvable boundary expansion?
- Where are approvals and persistent expansions stored, how are they audited/revoked, and are they scoped by workspace, service, command pattern, user, or session?
- What quotas exist and what happens when a quota is approached or exceeded?
- How should the product resist misleading model-generated purposes or payload summaries while ensuring exact details remain authoritative?

### Reliability, recovery, and rollback

- Which local state and remote operations are crash-recoverable, and what durability guarantees apply to chat/event recording?
- How does the user reconcile a remote outcome that remains unknown after reprompting?
- How are checkpoints sized, encrypted/protected, garbage-collected, and surfaced to users?
- Are generated files, renames, directory operations, permissions, symlinks, and large/binary files all reversible?
- How does rollback behave across Git changes, concurrent processes, multiple agents, or manual edits that do not overlap textually but alter semantics?

### Success measures and release quality

- What numeric SLOs apply to health checks, prompt-round latency, crash recovery, failure classification, rollback accuracy, and UI responsiveness?
- What adoption or usability signals prove users can configure and trust a new extension without help?
- What security review, protocol conformance, test coverage, supported-version, and incident-response gates define “production-grade”?
- What counter-metrics will guard against approval fatigue, excessive hard refusals, false unhealthy states, storage growth, or slower prompt rounds?

## Rejected alternatives and rationale

- **Provider/service-specific UI:** rejected because each new integration would couple product surfaces to implementations and force UI/existing-extension changes.
- **Executable user configuration or custom adapter code:** rejected to preserve a reviewed execution boundary and reduce arbitrary-code risk.
- **User-defined slash commands in configuration:** rejected in favor of product-reviewed TypeScript.
- **Tool-calling compatibility as part of initial availability:** explicitly not required; availability proves API connectivity, while incompatible behavior is handled when actually encountered.
- **Silent protocol repair or reinterpretation:** rejected because it hides configuration errors and makes behavior/evidence untrustworthy.
- **Treating Full Access as unrestricted:** rejected because declared workspace, command, network, service, quota, and sensitive-transfer boundaries remain meaningful.
- **Model-only failure diagnosis:** rejected because deterministic classification and sanitized evidence must anchor the explanation.
- **Automatic retry after an uncertain remote outcome:** rejected because the remote side may already have acted, risking duplicate side effects.
- **Synthesizing the missing end of interrupted output:** rejected; preserve received content and mark interruption explicitly.
- **Blind rollback through later edits:** rejected because it could destroy user work; only provably matching hunks are reversed and conflicts stop for manual handling.
- **Permanent checkpoint retention:** not selected; default retention is five subsequent prompts with configurable expiry, implying a deliberate limit on storage exposure.

## Technical and implementation depth for `addendum.md`

The PRD should keep the user-visible contracts and capabilities above. The following mechanism-level content is valuable but should be preserved in an architecture/solution addendum rather than dominate the PRD narrative:

- Protocol strategy and transport detail: OpenAI-compatible and Anthropic built-ins, declarative HTTP request/response mappings, and reviewed adapter fallback.
- Metadata-driven registry/discovery and reusable generic TUI component architecture.
- Product implementation language for reviewed slash commands (TypeScript).
- Deterministic classification derived from network evidence, sanitized raw-evidence storage, and the separation between classifier and model explanation.
- Round-level versus subsystem-level instrumentation and token-accounting model.
- Prompt rollback mechanics using before hashes and exact agent patches.
- Temporary complete copies of changed/deleted binaries and checkpoint garbage collection.
- Append-only incident/event-record implications suggested by the HTML's incident-recorder framing; append-only storage is presentation language there, not an explicit requirement in the primary intent and should be confirmed.

## Discovery handoff

The source is unusually strong on architecture, trust contracts, and failure semantics, but sparse on product context. The next elicitation should establish the primary user and job, current pain, stakes, initial release scope, real-session journeys, supported environments, and measurable outcomes before turning these architectural decisions into prioritized product requirements.
