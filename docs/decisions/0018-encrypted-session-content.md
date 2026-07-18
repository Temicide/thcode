# ADR 0018: Encrypt Sensitive Session Content at Rest

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

Sensitive Global Session Store fields are encrypted with authenticated AES-256-GCM before being written to SQLite. This includes Chat Transcript content, session names, workspace paths, plans, tool inputs and results, derived evidence, and other content capable of revealing source code or personal data. Each encrypted record uses a unique nonce and binds its record identity and schema version as authenticated metadata so ciphertext cannot be silently moved between records.

A random per-install data-encryption key lives in Windows Credential Manager for the Windows-first prototype and never in SQLite, project files, logs, prompts, or telemetry. Later macOS and Linux implementations use their native credential stores. API-provider keys remain separate credentials and are never reused as session-encryption keys.

SQLite retains only the minimum plaintext needed to open and migrate the store, such as opaque record identifiers, schema versions, encryption versions, and operational timestamps. Any equality index required for a Workspace Binding uses a keyed, non-reversible value rather than the plaintext path. Session browsing and content search decrypt locally inside the trusted thcode process.

## Consequences

- Copying the SQLite file alone does not reveal transcript or workspace content.
- Losing the data-encryption key makes encrypted session content unrecoverable.
- Key rotation, corruption recovery, export, and backup require explicit designs.
- Full-text search is more complex because plaintext content is not available to SQLite indexing.
- Export, import, recovery archives, and key portability are deferred to Phase 2 under ADR 0017.
