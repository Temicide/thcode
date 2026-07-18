# Terminal Interface Contract

## Persistent composer state

The interactive terminal displays Work Mode and Permission Profile as separate state immediately above the Prompt Composer. Model and AI for Thai connection state may share the same compact row.

```text
[BUILD] [Typhoon] [Permissions: Assisted] [AI for Thai: connected]

┌─────────────────────────────────────────────────────────┐
│ > Ask thcode, use @file, or type /command       ◑ 72%  │
└─────────────────────────────────────────────────────────┘
```

- `Shift+Tab` cycles Plan and Build.
- `Tab` accepts the active slash-command or file-reference completion.
- `/plan` and `/build` select a Work Mode explicitly.
- A mode switch updates the Mode Instruction Set before the next reasoning turn.
- The lower-right Context Donut shows Active Context Utilization with a numeric percentage; narrow terminals fall back to `Ctx 72%`.

## Permission Selector

Typing `/permissions` opens a terminal modal instead of requiring an inline argument:

```text
┌ Permission Profile ───────────────────────────┐
│  Manual       Ask before material actions     │
│› Assisted     Automatically allow low risk    │
│  Full Access  Approve all within boundaries   │
└ ↑/↓ Select · Enter Confirm · Esc Cancel ──────┘
```

- Arrow keys change the highlighted profile.
- `Enter` confirms the selection.
- `Esc` closes the selector without changing the profile.
- Full Access opens a second warning view describing its declared boundaries and session-only duration before activation.
- Scripted or headless use may accept an explicit profile argument even though interactive users are not required to remember one.

## Orthogonal state examples

| Work Mode | Permission Profile | Effective behavior |
| --- | --- | --- |
| Plan | Manual | Read-only tools may ask; mutation is structurally unavailable |
| Plan | Full Access | Read-only actions are auto-approved; mutation remains structurally unavailable |
| Build | Manual | Mutation is available but material actions ask |
| Build | Assisted | Low-risk permitted actions may run automatically; uncertainty asks |
| Build | Full Access | Every otherwise permitted action runs without an approval prompt |

Every new interactive session starts in Build Mode with the Manual Permission Profile. Plan is immediately available through `Shift+Tab` or `/plan`, and other Permission Profiles require deliberate selection or an explicit startup argument.

## Saved transcript and active context

Opening a Saved Session redisplays its complete Chat Transcript. The transcript remains local history; the status row and `/context` report the smaller Active Model Context prepared for the next request. Older content may be summarized or excluded from Active Model Context without disappearing from the visible transcript.

## Session Browser

Saved Sessions live in one machine-local SQLite Global Session Store for the current OS user. Sensitive fields are encrypted before storage with a per-install key held in the OS credential store. `/session` and `/sessions` open the same browser from any directory, with filters for all sessions, the current workspace, other workspaces, and missing workspace bindings:

```text
┌ Saved Sessions ──────────────────────────────────────────┐
│› thcode landing page   Typhoon · BUILD · 31% context    │
│  Express audio demo    Typhoon · PLAN  · 18% context    │
│  Address preview       Typhoon · BUILD · 24% context    │
└ Enter Open · N New · R Rename · Del Delete · Esc Close ─┘
```

The canonical command hierarchy is:

```text
/session new
/session list
/session open <id>
/session rename <id>
/session delete <id>
/session info
```

`/session info` includes the active session identifier, name, workspace, model, Work Mode, timestamps, Active Context Utilization, Cumulative Token Usage, and compaction count. `/resume` and `/new-sessions` are not aliases.

Opening from a different directory never silently changes a session's Workspace Binding. Cloud synchronization is outside the prototype.

The prototype does not expose session export or import commands. If the local encryption key is unavailable, the session browser reports that encrypted content cannot be recovered rather than offering a false recovery path.

Opening a Saved Session restores its model, Work Mode, pins, context history, artifact references, audit history, token ledger, and workspace association. The status row must make the reset authority visible:

```text
Session restored · Work Mode: PLAN · Permissions reset: MANUAL
```

Full Access, sensitive-transfer authorization, and temporary approvals never survive a Runtime Activation. Provider keys remain in the operating-system credential store.

## Context meter

The Context Donut uses Active Model Context tokens divided by Effective Context Capacity. Effective capacity is the selected model's verified context limit minus response and safety reserves, so 100% is the safe input ceiling rather than the raw advertised context window.

| Utilization | Indicator state |
| --- | --- |
| 0–69% | Green |
| 70–84% | Amber |
| 85–94% | Orange |
| 95–100% | Red |

`/context` expands the donut into token counts for system instructions, recent chat, pinned turns, summaries, workspace evidence, tool schemas/results, response reserve, safety margin, and cumulative provider usage. Exact provider counts and local estimates must be visually distinguishable.

Before a provider call, the footer may show a projected over-capacity state followed by automatic compaction:

```text
◉ >100%  Compacting active context…
◑   68%  Compacted · full transcript preserved
```

Automatic Compaction requires no permission prompt, preserves the complete Chat Transcript, keeps Pinned Turns verbatim, targets no more than 70% utilization, and adds an inspectable compaction event. `/compact` lets the developer compact earlier.

If compaction cannot fit protected content, the composer remains available but the provider request is blocked:

```text
● BLOCKED  Required context is 108% of safe capacity
Pinned turns       41,200
New input          38,600
System and tools   20,900
Selected evidence  23,700

Open /context to unpin, reduce evidence, or switch models.
```

No protected item is silently removed.
