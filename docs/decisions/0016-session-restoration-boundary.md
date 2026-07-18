# ADR 0016: Restore Session Knowledge, Reset Runtime Authority

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

Opening a Saved Session restores its complete Chat Transcript, selected model, Work Mode, Pinned Turns, compaction history, referenced-artifact manifest, plans, tool and verification history, Cumulative Token Usage, and associated workspace path. This preserves continuity of knowledge and context engineering.

Opening also creates a fresh Runtime Activation. Its Permission Profile resets to Manual, and Full Access, sensitive-transfer authorization, and temporary action approvals are never restored. API keys remain separate in the operating-system credential store and are referenced by provider identity rather than copied into session storage.

## Consequences

- A historical Full Access choice cannot silently regain authority after thcode is closed and reopened.
- Token and context history remains continuous even though approval state resets.
- The UI must distinguish restored Work Mode from reset Permission Profile when opening a session.
