# Landscape Research: Production-Grade Agentic CLI/TUI Foundations

**Research date:** 2026-07-14  
**Scope:** Agentic terminal products and protocols relevant to thcode's proposed metadata-driven provider/service extensions, health gating, approval and sandbox boundaries, observability, crash recovery, and rollback.  
**Source policy:** Official product documentation, specifications, and official project repositories only. The landscape is time-sensitive; release/version observations are point-in-time.

## Executive synthesis

The current market has converged on several foundation patterns:

1. **Approval and sandboxing are separate layers.** Codex and Claude Code explicitly distinguish policy decisions from OS-enforced filesystem/network isolation. This is now table stakes for a production agentic CLI, not an advanced option.
2. **OpenTelemetry is becoming the common export layer.** Claude Code, Codex, and Gemini CLI all document OTel support, with privacy-sensitive content disabled or separately gated. A product-specific internal event model is still necessary because the broader GenAI and CLI semantic conventions remain partly developmental.
3. **Recovery exists, but its guarantees are narrow and product-specific.** Claude Code and Gemini CLI offer conversation/file checkpoints, and Aider offers Git-backed undo. Their official documentation also exposes important gaps, especially changes made through shell commands or external/concurrent writers.
4. **Extension protocols provide discovery, not product trust.** MCP standardizes initialization, capability negotiation, schemas, tool listing, and structured errors, but deliberately does not prescribe a UI, approval model, extension health lifecycle, rollback, or safe default policy.
5. **thcode's clearest differentiator is the complete trust lifecycle across heterogeneous extensions.** None of the reviewed systems documents the exact combination of non-executable post-install configuration, generic TUI rendering, live availability gating, deterministic quarantine after protocol failure, and explicit user retest across both reasoning models and specialist AI services.

## Systems compared

| System | Current point-in-time signal | Positioning relevant to thcode | Most relevant patterns | Material gap relative to thcode intent |
|---|---|---|---|---|
| Claude Code | Official repository latest release was [v2.1.209 on 2026-07-14](https://github.com/anthropics/claude-code/releases/tag/v2.1.209) | Mature agentic coding CLI with granular permissions, OS-level sandboxing, MCP, checkpoints, session persistence, hooks, and enterprise telemetry | Defense in depth; managed fail-closed sandbox option; rich permission rules; OTel audit events; code/conversation rewind | File checkpointing excludes Bash and external changes; no documented health-quarantine-and-explicit-retest state machine for model/service extensions |
| OpenAI Codex CLI | Official repository latest stable release was [0.144.4 on 2026-07-14](https://github.com/openai/codex/releases/tag/rust-v0.144.4) | Agentic coding CLI with reusable permission profiles, approval policy, sandbox modes, custom model providers, MCP, sessions, and OTel | Approval/sandbox separation; organization-enforced constraints; provider transport reliability controls; required MCP dependencies | Custom provider wire protocol is constrained; official reviewed pages do not define thcode-style specialist-service mappings, protocol quarantine, or precise prompt rollback |
| Gemini CLI | Official repository latest stable release was [v0.50.0 on 2026-07-08](https://github.com/google-gemini/gemini-cli/releases/tag/v0.50.0) | Extensible agentic CLI with sandboxing, permissions, MCP, shareable extensions, checkpoints, and OTel | Extensions as packages; local shadow-Git checkpoints; configurable sandbox backends; OTel logs/metrics | Checkpointing and sandboxing are not universally on by default; product is in transition toward Antigravity CLI, creating comparability and maintenance risk |
| Aider | Official releases page currently lists [v0.86.0 as latest](https://github.com/Aider-AI/aider/releases/tag/v0.86.0) | Git-centric terminal pair programmer with broad provider coverage, model metadata/settings, lint/test loops, and automatic commits | Separate model metadata and behavioral settings; provider-qualified model names; Git-backed undo; automated quality gates | Unknown models can proceed with permissive fallback metadata; lacks the richer sandbox, extension-health, structured service, and audit model thcode targets |
| Model Context Protocol (MCP) | Latest published specification is [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) | Open protocol substrate for tools, resources, prompts, capability negotiation, and authorization | Explicit lifecycle; capability/version negotiation; JSON Schema contracts; dynamic tool-list changes; timeouts; security guidance | It is a substrate, not a trust policy: no mandated UI, risk taxonomy, health gate, quarantine/retest semantics, crash policy, or rollback |
| OpenTelemetry semantic conventions | Core semantic conventions [v1.43.0](https://opentelemetry.io/docs/specs/semconv/) at research time | Vendor-neutral observability vocabulary rather than an agent product | Standard trace/log/metric transport and correlation; emerging CLI and GenAI conventions | CLI spans are marked Development and GenAI conventions have moved to a separate evolving repository; product schemas cannot blindly depend on them |

## Detailed findings

### 1. Metadata-driven model and service extension patterns

#### Codex: transport/provider metadata with explicit reliability settings

Codex separates the selected model from a named provider definition. Its current [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) supports custom provider display name, base URL, environment-backed keys and headers, command-backed short-lived bearer tokens, query parameters, HTTP retry counts, stream retry counts, stream idle timeouts, and WebSocket capability. It also supports a startup-loaded model catalog. This is a strong precedent for keeping provider transport behavior out of UI code and for treating retry/timeout policy as provider metadata.

However, the same reference says the custom provider `wire_api` supports only the Responses protocol. Codex therefore demonstrates a metadata-driven provider layer, but not thcode's broader proposition of reasoning-provider profiles plus declarative request/response mappings for arbitrary specialist services such as OCR and speech-to-text.

**Implication for thcode:** split extension metadata into at least three concepts rather than one overloaded object: identity/display metadata, transport/protocol contract, and capability/behavior metadata. Make retryability and timeout semantics explicit; do not infer them from HTTP status alone.

#### Aider: model facts and behavioral settings are separate override layers

Aider's [advanced model settings](https://aider.chat/docs/config/adv-model-settings.html) distinguish factual metadata (context window, token limits, costs, provider) from behavioral settings (edit format, weak/editor model, streaming, reasoning handling, prompt behavior). Files load from home, repository root, and current directory with later sources taking precedence. Provider-qualified model names avoid ambiguity.

This is a useful schema-separation pattern, but Aider's [model warnings](https://aider.chat/docs/troubleshooting/warnings.html) say an unknown model may continue using fallback assumptions such as unlimited context and zero cost, and missing environment variables may fail only when the user starts chatting. That permissiveness is suitable for experimentation but conflicts with thcode's production trust posture.

**Implication for thcode:** use explicit, versioned precedence and provenance for every effective metadata value, but fail closed when required operational metadata or credentials are absent. “Unknown” must remain a first-class state; it must not silently become “unlimited/free/compatible.”

#### Gemini CLI: shareable extension packages, but restart-bound activation

Gemini CLI's [extension documentation](https://google-gemini.github.io/gemini-cli/docs/extensions/) describes extensions that package prompts, MCP servers, and custom commands for installation and sharing. Installed or updated extensions become active after session restart. The same product supports configuration-driven MCP servers and tool discovery.

This validates packaging multiple contribution types behind one installable unit. It also shows the operational cost of restart-bound activation and the potential for mixed-trust payloads: an “extension” may contain declarative content plus executable server launch configuration.

**Implication for thcode:** preserve the brainstorm's distinction between safe declarative user configuration and reviewed executable adapters/commands. The UI should surface origin, version, trust class, and activation requirements. Do not call all contribution types “extensions” without showing whether they can execute code.

#### MCP: interoperable discovery and schema, but annotations are untrusted

MCP's [lifecycle specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) requires initialization first, including protocol-version agreement, capability negotiation, and implementation identity. Its [tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) defines dynamic listing, JSON Schema inputs/outputs, list-changed notifications, task-support metadata, structured tool results, and explicit separation between protocol errors and tool-execution errors. It also states that clients must treat tool annotations as untrusted unless the server is trusted.

MCP explicitly leaves the user interaction model to clients while recommending visible tool exposure, invocation indicators, and human confirmation for sensitive operations. This is exactly the boundary thcode must own: protocol metadata can render a generic UI, but metadata alone cannot establish risk, truthfulness, or approval policy.

**Differentiator:** thcode can position itself as the policy and trust harness above interoperable protocols—not another discovery protocol. Its deterministic risk classification, health state, safe previews, and recovery guarantees should remain host-owned even when a server supplies metadata.

### 2. Health gating and extension lifecycle

The reviewed products have pieces of dependency readiness but not thcode's full lifecycle:

- Codex's [MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) supports startup and tool-call timeouts, enable/disable flags, tool allow/deny lists, and `required = true`, which makes startup fail when an enabled server cannot initialize.
- Claude Code's [MCP documentation](https://code.claude.com/docs/en/mcp) says MCP startup is normally non-blocking. `alwaysLoad: true` makes selected tools block startup until connection, capped by a connection timeout. It also exposes an MCP startup timeout.
- MCP itself requires successful initialization and capability negotiation before normal operation and recommends configurable request timeouts and cancellation, but it does not define a durable healthy/unhealthy product state.
- Aider warns about missing model environment variables and unknown metadata, but its documented workflow may defer actual failure until invocation.

No reviewed official source documents the state machine thcode proposes:

`configured → validating → healthy/available → runtime protocol failure → quarantined/unavailable → configuration changed → explicit retest → healthy`

Nor do the reviewed products document a single common lifecycle spanning both model providers and non-model specialist services.

**Differentiator:** health is not merely a connection icon. thcode can make it an auditable state transition system with evidence, reason codes, timestamps, configuration version/fingerprint, and an explicit recovery action.

**Cautions for requirements:**

- Define health at the smallest correct scope. A bad model identifier should not necessarily quarantine every model using the same endpoint; an authentication or protocol-shape failure may be provider-wide.
- Separate `reachable`, `authenticated`, `protocol-compatible`, and `capability-compatible`. The brainstorm intentionally gates availability on connectivity rather than tool compatibility, so the UI must not imply more than was tested.
- Specify transient failure policy. Automatically quarantining on any timeout would convert ordinary network instability into operator toil; silently retrying protocol-shape errors would violate the stated trust model.
- Bind each result to the exact effective configuration fingerprint so a stale pass cannot validate a later edit.
- Make “explicit retest” a real user action with progress and evidence, not an automatic background retry disguised as one.

### 3. Approval, sandbox, and boundary enforcement

#### Separation of policy and enforcement is established practice

Codex's [config basics](https://learn.chatgpt.com/docs/config-file/config-basic) separate `approval_policy` from `sandbox_mode`. Current documentation also exposes reusable named permission profiles such as read-only, workspace, and danger-full-access, with custom per-path read/write/deny rules. Managed machines can enforce constraints that prohibit dangerous approval or sandbox settings.

Claude Code's [sandbox documentation](https://code.claude.com/docs/en/sandboxing) likewise states that permissions decide which tools may run, while sandboxing applies OS-level filesystem and network restrictions to Bash and its children. It uses Seatbelt on macOS and bubblewrap on Linux/WSL2, with a proxy for domain restrictions. It distinguishes auto-allow from regular permission flow while keeping the same isolation boundary.

Gemini CLI's [sandbox documentation](https://google-gemini.github.io/gemini-cli/docs/cli/sandbox.html) supports macOS Seatbelt and Docker/Podman isolation, and its [configuration documentation](https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html) separates approval modes, allowed tools, and sandbox settings.

**Implication for thcode:** model approval state, product policy state, and enforcement result separately. “User approved” must never be recorded as proof that an operation actually stayed within filesystem/network/service/quota boundaries.

#### Fail-open behavior is a major requirement trap

Claude Code documents that if its sandbox is unavailable, it warns and runs commands unsandboxed by default; managed deployments can set `sandbox.failIfUnavailable` to hard-fail. Its sandbox also includes an optional escape hatch for commands that need to run unsandboxed, routed back through permission flow. Gemini CLI documents sandboxing as disabled by default in ordinary operation, although its broad auto-approval mode enables a sandbox by default.

These are deliberate product tradeoffs, but they demonstrate why a PRD cannot merely say “sandboxed.” It must state:

- what happens when isolation cannot initialize;
- which tools are actually covered (Claude's sandbox does not cover built-in file tools or computer-use tools);
- whether an escape hatch exists and who can use it;
- whether network DNS/domain filtering includes TLS inspection (Claude explicitly says its built-in proxy does not inspect encrypted contents);
- how symlinks, Unix sockets, subprocesses, and container/daemon control sockets are treated.

**Implication for thcode:** if “hard-refuse host OS and out-of-workspace threats” is a product guarantee, the relevant enforcement path must fail closed. “Full Access” needs a precise ceiling: it may relax approval prompts or named scoped permissions, but cannot disable the non-overridable boundary.

#### MCP raises the extension-host threat, not just tool-call risk

The official MCP [security best-practices guide](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) warns that local MCP server configuration can itself launch malicious commands with client privileges. It recommends sandboxing local server processes with minimal filesystem/network privileges, explicit grants, and use of stdio or restricted IPC. The MCP [authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) requires OAuth discovery, resource indicators, PKCE, audience validation, and forbids token passthrough for HTTP authorization flows.

**Implication for thcode:** distinguish approval to install/start an executable adapter from approval to invoke one of its tools. Credentials must be audience-bound and scoped to the configured service; a generic “API key works” check is not an authorization model.

### 4. Observability and evidence

Claude Code's [monitoring documentation](https://code.claude.com/docs/en/monitoring-usage) exports metrics, events/logs, and optional traces through OTel. It documents events for permission decisions, permission-mode escalation, hook blocks, authentication failures, MCP connection failures, and optionally command/file details. Prompt content and tool details are opt-in. It explicitly says anomaly detection and alerting belong to the downstream observability backend.

Codex's [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) supports OTel log, metric, and trace exporters over OTLP HTTP/gRPC, TLS client credentials, an environment tag, and an explicit option to export raw user prompts. Gemini CLI's [telemetry documentation](https://google-gemini.github.io/gemini-cli/docs/cli/telemetry.html) similarly emits configuration, prompt, tool, API, token, timing, extension, and MCP-related signals with a session identifier.

This makes vendor-neutral export an expected capability. However, OpenTelemetry's [CLI span conventions](https://opentelemetry.io/docs/specs/semconv/cli/cli-spans/) are still marked Development, while GenAI conventions have moved to a separate evolving repository. Content fields may contain prompts, code, PII, credentials, or service payloads.

**Implications for thcode:**

- Own a stable, versioned internal event schema, then map to OTel at the export boundary.
- Treat deterministic evidence and model-generated explanations as separate fields with separate provenance.
- Record one round-level correlation ID spanning model calls, tool approvals, local execution, specialist services, rollback checkpointing, and final render.
- Make prompt/tool/payload content collection off by default and independently configurable; sanitization must happen before persistence or export, not only in the TUI.
- Expose event-schema version, effective redaction policy, and dropped/filtered-field counts so investigators know what evidence is absent.
- Keep Active Context Utilization and cumulative token consumption as distinct measures; competitor telemetry commonly tracks tokens, but this conceptual distinction is a useful user-facing design choice.

### 5. Crash recovery and rollback

#### Claude Code: strong session rewind with explicit coverage gaps

Claude Code's [checkpointing documentation](https://code.claude.com/docs/en/checkpointing) captures code state before edits and persists checkpoints across resumed sessions. Users can restore code, conversation, or both, and can summarize or fork. Crucially, the same document states that Bash-command changes are not tracked, external changes are not tracked, and checkpointing is not a replacement for version control.

This limitation is directly relevant to thcode: an agentic CLI that can execute arbitrary approved commands cannot claim complete prompt rollback by observing only its built-in edit tool.

#### Gemini CLI: shadow-Git snapshots plus conversation/tool-call state

Gemini CLI's [checkpointing documentation](https://google-gemini.github.io/gemini-cli/docs/cli/checkpointing.html) creates a snapshot before approved file-modification tools, stores it in a separate shadow Git repository, and saves conversation history plus the proposed tool call. `/restore` can return files and conversation to the checkpoint and repropose the original call. Checkpointing is disabled by default in the documented configuration.

This is a strong precedent for separating recovery storage from the user's Git history. It still does not establish that every side effect of arbitrary shell commands or remote services is reversible.

#### Aider: Git-first undo and preexisting-work separation

Aider's [Git integration](https://aider.chat/docs/git.html) automatically commits AI edits, first commits preexisting dirty changes to keep them separate, and offers `/diff` and `/undo`. Its [lint/test workflow](https://aider.chat/docs/usage/lint-test.html) can automatically lint edited files and run test commands after changes, turning verification failures into repair loops.

This is operationally simple and auditable, but it depends on Git semantics and a coding-oriented file model. It does not solve remote effects, untracked binary lifecycle, out-of-repository resources, or safe reversal after overlapping later edits.

#### thcode's proposed recovery contract is meaningfully stronger

The brainstorm's “unknown remote outcome means no automatic retry; preserve received output and insert an interruption marker” is not documented as a comparable product guarantee in the reviewed systems. Likewise, exact-patch and before-hash rollback with a safe stop on overlap is more conservative than a blunt worktree reset or commit reversal.

**Cautions for requirements:**

- Define the durable write-ahead boundary for remote dispatch. To know whether an outcome is “not sent,” “sent/unknown,” or “response partially received,” the event must be persisted before and after transport transitions.
- Assign an idempotency classification to every remote operation. “Never retry unknown outcomes” is safest, but the UI should distinguish operations where a provider-supported idempotency key can prove replay safety.
- Inventory local mutation channels: built-in editor, shell, subprocess, symlink, permission changes, rename/delete, generated directories, external formatter, Git hook, and concurrent agent/user changes.
- Specify crash consistency of the checkpoint itself. A partially written rollback journal must be detectable and must never be treated as complete.
- Avoid promising semantic conflict detection if the mechanism proves only byte/patch overlap. A later non-overlapping edit can still make reversal semantically unsafe.
- Treat binary originals as sensitive data with size quotas, encryption/access controls, expiration evidence, and secure cleanup semantics.

## Clear gaps and differentiators for thcode

### Differentiators worth preserving in the PRD

1. **A unified extension lifecycle for reasoning and specialist services.** Current systems tend to have model-provider configuration, MCP servers, or packaged extensions as separate concepts. thcode can make configuration, validation, generic presentation, invocation, evidence, quarantine, and retest uniform while retaining type-specific protocols.
2. **Availability as an explicit, evidence-backed state machine.** “Configured” and “healthy” are different, runtime protocol failure causes durable quarantine, and re-entry requires a deliberate retest tied to the corrected configuration.
3. **Non-executable user extensibility.** Declarative endpoint/model/service mappings remain a lower-trust contribution class than product-reviewed adapters and slash commands.
4. **Two-level approval disclosure with authoritative exact details.** A plain-language purpose helps comprehension, but the verified endpoint, exact command, transfer summary, and side effects—not model prose—drive policy and consent.
5. **Conservative uncertainty preservation.** Unknown remote outcomes are represented as unknown, partial output is preserved, and the product does not invent completion or retry silently.
6. **Conflict-aware prompt rollback.** Reverse only proven matching agent changes; preserve later user work; stop on ambiguity.
7. **Round-oriented UX over full-fidelity diagnostics.** One understandable end-to-end prompt-round duration for users, with correlated subsystem evidence available on demand.

### Areas that are table stakes rather than differentiators

- Workspace-scoped filesystem permissions and network controls
- Separate approval and sandbox policies
- Resumable sessions
- MCP support or an equivalent structured tool protocol
- OTel-compatible telemetry export
- Model/provider configuration through files and environment variables
- Test/lint integration and visible diffs

## PRD implications and open questions

1. **What exactly is the health contract?** Define probe types, tested claims, state transitions, evidence retention, configuration fingerprints, scope of quarantine, and transient-failure thresholds. The current “connectivity only” decision needs UI wording that cannot be mistaken for capability certification.
2. **Which boundary is truly non-overridable?** Specify the exact host-OS/out-of-workspace refusal model, sandbox-unavailable behavior, covered mutation channels, network/TLS limitations, and whether reviewed adapters run in the same or a stricter sandbox than tool commands.
3. **What is the extension trust taxonomy?** At minimum distinguish declarative provider/service records, remote MCP servers, local executable servers, reviewed built-in adapters, and product slash commands. Define provenance, signing/review expectations, update/revocation, and activation rules for each.
4. **What durability guarantee supports “unknown means unknown”?** Define the event journal/write-ahead protocol, crash points, partial-stream persistence, idempotency metadata, and restart presentation before committing to no-loss/no-duplicate claims.
5. **What does prompt rollback cover?** Name supported local mutation types, concurrency behavior, binary quotas, retention semantics, and the difference between syntactic overlap detection and semantic safety.
6. **Which observability data is safe by default?** Define the internal schema, correlation IDs, redaction-before-storage rules, prompt/tool-content defaults, export controls, and retention. OTel should be an adapter, not the canonical data model.
7. **What is launch scope?** Competitors are cross-platform but their enforcement differs materially across macOS, Linux, WSL2, containers, and native Windows. A credible hard-boundary promise may require narrowing initial OS/platform support.

## Requirement cautions from the comparison

- Do not use “supports sandboxing” as a binary requirement; require an enforcement matrix by action type and platform.
- Do not trust extension-supplied risk annotations or natural-language purposes as policy inputs without host validation.
- Do not equate successful initialization, reachability, authentication, protocol compatibility, and functional capability.
- Do not silently substitute guessed model metadata, request mappings, costs, limits, or capabilities.
- Do not let “Full Access” collapse the independently declared filesystem, command, network, service, credential, and quota boundaries.
- Do not claim rollback for effects the harness cannot observe, journal, and verify.
- Do not automatically retry a remote mutation after a lost response unless idempotency and outcome reconciliation are proven.
- Do not export raw prompts, commands, payloads, or tool parameters by default; credentials can leak in headers, URLs, environment variables, and error evidence even when the normal preview is redacted.
- Do not bind the product's durable audit contract to unstable external semantic conventions without versioning the mapping.
- Do not assume “local” means safe: local extension processes may inherit the CLI user's full privileges unless independently sandboxed.

## Source index

### Claude Code

- [Permissions](https://code.claude.com/docs/en/permissions)
- [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- [Checkpointing](https://code.claude.com/docs/en/checkpointing)
- [Monitoring with OpenTelemetry](https://code.claude.com/docs/en/monitoring-usage)
- [MCP integration](https://code.claude.com/docs/en/mcp)
- [Official releases](https://github.com/anthropics/claude-code/releases)

### OpenAI Codex CLI

- [Config basics](https://learn.chatgpt.com/docs/config-file/config-basic)
- [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [MCP integration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [CLI features and session resume](https://learn.chatgpt.com/docs/codex/cli)
- [Official releases](https://github.com/openai/codex/releases)

### Gemini CLI

- [Configuration](https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html)
- [Sandboxing](https://google-gemini.github.io/gemini-cli/docs/cli/sandbox.html)
- [Checkpointing](https://google-gemini.github.io/gemini-cli/docs/cli/checkpointing.html)
- [Extensions](https://google-gemini.github.io/gemini-cli/docs/extensions/)
- [OpenTelemetry](https://google-gemini.github.io/gemini-cli/docs/cli/telemetry.html)
- [Official releases](https://github.com/google-gemini/gemini-cli/releases)
- [Official transition announcement to Antigravity CLI, 2026-05-19](https://github.com/google-gemini/gemini-cli/discussions/27274)

### Aider

- [Advanced model settings](https://aider.chat/docs/config/adv-model-settings.html)
- [Model warnings](https://aider.chat/docs/troubleshooting/warnings.html)
- [Chat modes](https://aider.chat/docs/usage/modes.html)
- [Git integration](https://aider.chat/docs/git.html)
- [Linting and testing](https://aider.chat/docs/usage/lint-test.html)
- [Official releases](https://github.com/Aider-AI/aider/releases)

### Protocol and observability standards

- [MCP lifecycle, specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)
- [OpenTelemetry semantic conventions v1.43.0](https://opentelemetry.io/docs/specs/semconv/)
- [OpenTelemetry CLI spans](https://opentelemetry.io/docs/specs/semconv/cli/cli-spans/)

