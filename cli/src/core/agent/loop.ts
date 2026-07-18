import type { CredentialStore } from '../platform/credentialStore.js';
import type { ProviderRegistry } from '../providers/registry.js';
import type { NormalizedMessage, ProviderResult, ToolSchema } from '../providers/types.js';
import { DeterministicContextBuilder, contextCapacity } from '../context/builder.js';
import { compactContext } from '../context/compaction.js';
import { createContextManifest } from '../context/manifest.js';
import { newOperationId, newPromptRoundId } from '../protocol/ids.js';
import { evaluatePermission } from '../permissions/policy.js';
import type { PermissionProfile, WorkMode } from '../permissions/types.js';
import { PlanModeToolRefusedError, type ToolRegistry } from '../tools/registry.js';

// Agent loop skeleton (ADR 0001 local loop + ADR 0020 headless core).
// runTurn(): build Active Model Context -> call the selected provider adapter
// -> final text OR normalized tool-call proposal -> permission engine ->
// structural Plan-Mode check via the registry -> tool execution -> loop.
// With no API key it returns a clear "provider unavailable" message — never crashes.

export interface AgentDeps {
  readonly providers: ProviderRegistry;
  readonly tools: ToolRegistry;
  readonly credentials: CredentialStore;
  readonly workspaceRoot: string;
}

export interface TurnState {
  readonly mode: WorkMode;
  readonly profile: PermissionProfile;
  readonly history: readonly NormalizedMessage[];
  readonly sessionId?: string;
}

export type TurnEvent =
  | { kind: 'text'; text: string }
  | { kind: 'tool-start'; tool: string }
  | { kind: 'tool-result'; tool: string; ok: boolean; output: string }
  | { kind: 'ask'; tool: string; reason: string };

export interface TurnResult {
  /** Final assistant text (or an explicit unavailable/denied explanation). */
  readonly text: string;
  /** New history including this turn, for the caller to persist/reuse. */
  readonly history: readonly NormalizedMessage[];
  readonly events: readonly TurnEvent[];
}

/** Ask-callback: the UI resolves true (approve) / false (reject). The core
 * never renders prompts itself (ADR 0020). */
export type ApprovalCallback = (tool: string, input: Record<string, unknown>) => Promise<boolean>;

const MAX_TOOL_ITERATIONS = 8;

export class AgentLoop {
  constructor(private readonly deps: AgentDeps) {}

  private toolSchemas(mode: WorkMode): ToolSchema[] {
    return this.deps.tools.listForMode(mode).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: { type: 'object', properties: {}, additionalProperties: true },
    }));
  }

  async runTurn(
    input: string,
    state: TurnState,
    approve: ApprovalCallback = async () => false,
    onToken?: (delta: string) => void,
  ): Promise<TurnResult> {
    const events: TurnEvent[] = [];
    const adapter = this.deps.providers.selected;
    const contextBuilder = new DeterministicContextBuilder();
    const sessionId = state.sessionId ?? 'agent-loop-session';
    const providerId = adapter.capabilities.provider;

    const apiKey = await this.deps.credentials.get(providerId);
    const availability = adapter.availability(apiKey !== null);
    if (!availability.available || apiKey === null) {
      const reason = availability.reason ?? 'not configured';
      const text = `Provider "${providerId}" is unavailable: ${reason}`;
      return {
        text,
        history: [...state.history, { role: 'user', content: input }, { role: 'assistant', content: text }],
        events: [{ kind: 'text', text }],
      };
    }

    // `transcript` is immutable local conversation history. The bounded
    // request projection is rebuilt per iteration and must never replace it.
    let transcript: NormalizedMessage[] = [...state.history];
    let pendingInput = input;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const tools = this.toolSchemas(state.mode);
      const capacity = contextCapacity(adapter.capabilities.contextLimit, 2048);
      const built = contextBuilder.build({ history: transcript, newInput: pendingInput, sessionId, capacity });
      if (!adapter.finalize) {
        const text = 'Context blocked: provider does not expose exact request finalization.';
        events.push({ kind: 'text', text });
        return { text, history: transcript, events };
      }
      if (capacity.effective === 'percentage unavailable') {
        const text = 'Context capacity unavailable: provider verification is required before dispatch.';
        events.push({ kind: 'text', text });
        return { text, history: transcript, events };
      }
      let context = built;
      if (context.utilization.percent !== 'percentage unavailable' && context.utilization.percent > 70) {
        const compacted = compactContext(context);
        if (!compacted.ok) {
          const text = `Context blocked: ${compacted.overflow.category}; ${compacted.overflow.remedies.join('; ')}`;
          events.push({ kind: 'text', text });
          return { text, history: transcript, events };
        }
        context = compacted.context;
      }
      const requestMessages = [...context.messages];
      let finalized: import('../providers/types.js').FinalizedProviderRequest;
      {
        const operationId = newOperationId();
        const promptRoundId = newPromptRoundId();
        const provisional = createContextManifest({ sessionId, operationId, promptRoundId, providerId: adapter.capabilities.provider, modelId: adapter.capabilities.modelId, configurationGeneration: adapter.capabilities.modelId, requestBytes: new Uint8Array(), context });
        const first = adapter.finalize({ messages: context.messages, tools, maxOutputTokens: 2048, manifest: provisional });
        const manifest = createContextManifest({ sessionId, operationId, promptRoundId, providerId: adapter.capabilities.provider, modelId: adapter.capabilities.modelId, configurationGeneration: adapter.capabilities.modelId, requestBytes: first.bytes, context });
        finalized = { ...first, manifest };
      }

      let result: ProviderResult;
      try {
        result = await adapter.complete(
          { messages: requestMessages, tools, finalized },
          apiKey,
          onToken,
        );
      } catch (err) {
        const meta = adapter.classifyError(err);
        const text = `Provider "${providerId}" error (${meta.kind}${meta.retryable ? ', retryable' : ''}): ${(err as Error).message}`;
        events.push({ kind: 'text', text });
        return { text, history: [...transcript, { role: 'user', content: input }, { role: 'assistant', content: text }], events };
      }

      if (result.kind === 'final') {
        events.push({ kind: 'text', text: result.text });
        return {
          text: result.text,
          history: [...transcript, { role: 'user', content: input }, { role: 'assistant', content: result.text }],
          events,
        };
      }

      // Tool-call proposal: structural Plan-Mode enforcement first (ADR 0013),
      // then the permission engine (ADR 0012).
      const { toolName, input: toolInput } = result;
      let tool;
      try {
        tool = this.deps.tools.resolveForMode(toolName, state.mode);
      } catch (err) {
        const refusal =
          err instanceof PlanModeToolRefusedError
            ? `Tool "${toolName}" refused: Plan Mode is read-only.`
            : `Tool "${toolName}" is not available.`;
        events.push({ kind: 'tool-result', tool: toolName, ok: false, output: refusal });
        pendingInput = `[tool refused] ${refusal}`;
        transcript = [...transcript, { role: 'tool', content: refusal }];
        continue;
      }

      const decision = evaluatePermission(
        { tool: tool.name, mutating: tool.mutating, sensitive: tool.sensitive },
        { mode: state.mode, profile: state.profile },
      );

      if (decision.outcome === 'deny') {
        const denial = `Tool "${toolName}" denied by policy (${decision.reason}).`;
        events.push({ kind: 'tool-result', tool: toolName, ok: false, output: denial });
        pendingInput = `[tool denied] ${denial}`;
        transcript = [...transcript, { role: 'tool', content: denial }];
        continue;
      }

      if (decision.outcome === 'ask') {
        events.push({ kind: 'ask', tool: toolName, reason: decision.reason });
        const approved = await approve(toolName, toolInput);
        if (!approved) {
          const rejection = `Tool "${toolName}" was not approved by the developer.`;
          events.push({ kind: 'tool-result', tool: toolName, ok: false, output: rejection });
          pendingInput = `[tool rejected] ${rejection}`;
          transcript = [...transcript, { role: 'tool', content: rejection }];
          continue;
        }
      }

      events.push({ kind: 'tool-start', tool: toolName });
      let output: string;
      let ok: boolean;
      try {
        const toolResult = await tool.execute(toolInput, {
          workspaceRoot: this.deps.workspaceRoot,
          mode: state.mode,
        });
        ok = toolResult.ok;
        output = toolResult.output;
      } catch (err) {
        ok = false;
        output = `Tool "${toolName}" failed: ${(err as Error).message}`;
      }
      events.push({ kind: 'tool-result', tool: toolName, ok, output });
      pendingInput = `[tool result: ${toolName}] ${output}`;
      transcript = [...transcript, { role: 'tool', content: output }];
    }

    const text = `Stopped after ${MAX_TOOL_ITERATIONS} tool iterations without a final answer.`;
    events.push({ kind: 'text', text });
    return { text, history: [...transcript, { role: 'user', content: input }, { role: 'assistant', content: text }], events };
  }
}
