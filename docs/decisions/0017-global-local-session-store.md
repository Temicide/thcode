# ADR 0017: Sessions Are Global to the Local OS User

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

thcode stores Saved Sessions in a Global Session Store belonging to the current operating-system user rather than writing chat history into each repository. `/session` can therefore browse sessions from any working directory and filter them by current workspace, other workspaces, or missing workspace association.

Global means machine-local, not cloud synchronized. Each workspace-aware Saved Session retains an explicit Workspace Binding; opening it from another directory does not silently rebind it to that directory. API keys remain in the operating-system credential store, and repository source files are not copied into the Global Session Store merely because they were referenced.

The Global Session Store is one local SQLite database. It stores session metadata, Chat Transcripts, pins, compaction records, token ledgers, workspace bindings, plans, audit records, and derived evidence. Referenced repository artifacts remain in their workspaces; the database stores paths, hashes, metadata, and deliberately retained derived evidence rather than copying source files, images, audio, or documents by default. API keys are never database fields.

ADR 0018 encrypts sensitive session content before it is written to SQLite; the corresponding per-install key remains in the operating-system credential store.

Platform locations follow native user-state conventions: `%LOCALAPPDATA%\thcode` on Windows, `~/Library/Application Support/thcode` on macOS, and `$XDG_STATE_HOME/thcode` with an appropriate home fallback on Linux.

The competition prototype is machine-local only. It supports session deletion but does not provide export, import, recovery archives, cloud synchronization, or cross-device migration. Portable encrypted archives and their passphrase, versioning, and recovery contracts are deferred to Phase 2.

## Consequences

- Developers can find all prior chats without remembering which repository directory created them.
- Repository deletion or movement does not delete the transcript.
- Local session data requires its own retention, deletion, backup, and privacy rules.
- Cloud synchronization and multi-device identity are explicitly outside the prototype.
- Loss of the machine or session-encryption key can make prototype sessions unrecoverable; the CLI must disclose this limitation rather than imply backup exists.
- SQLite provides atomic updates, filtering, schema migration, and token-ledger queries, but the application must handle database corruption and migration failures safely.
