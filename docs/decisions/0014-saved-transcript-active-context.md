# ADR 0014: Preserve Complete Chat, Optimize Active Context

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

A Saved Session retains and redisplays its complete Chat Transcript, but that transcript is not synonymous with the prompt sent to the Reasoning Model. thcode builds a bounded Active Model Context from current instructions, recent turns, pinned turns, selected workspace evidence, tool definitions, and inspectable summaries of older content.

While the transcript fits comfortably inside the Context Budget, it may remain verbatim in Active Model Context. As it approaches the budget, Context Compaction summarizes older unpinned material while keeping recent and pinned turns verbatim. Compaction never deletes or rewrites the locally retained Chat Transcript, and users must be able to inspect which content is verbatim, summarized, or excluded from the next request.

Before every model request, thcode estimates the projected Active Model Context including the new user input, selected evidence, tool schemas, and required reserves. If the projection would exceed Effective Context Capacity, Automatic Compaction runs without an approval prompt in every Work Mode and Permission Profile. It targets at most 70% utilization to create useful headroom, records the event, and then recalculates before sending. `/compact` remains available for an earlier manual compaction.

If protected content still exceeds Effective Context Capacity after compaction, thcode enters Irreducible Context Overflow and stops before the provider call. It must show a token breakdown and offer explicit remedies such as unpinning selected turns, reducing attached evidence, lowering reserved output when valid, or switching to a larger-context model. It never silently unpins, truncates, or drops protected content.

## Consequences

- Users can resume and browse complete historical conversations without automatically paying to resend every historical token.
- Long sessions remain usable across models with different context limits.
- Summarization can lose detail, so pinning and context inspection are required controls.
- Stored transcript size, active context usage, and cumulative provider token usage must be reported as different measurements.
- An oversized protected context blocks progress until the developer changes context requirements or model capacity.
