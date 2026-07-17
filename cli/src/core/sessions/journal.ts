// Journal table DDL and helpers (AD-3, AD-6). The journal is the single
// authority for commit visibility and replay. Every durable event is appended
// atomically with an allocated sequence number and aggregate version.

export const JOURNAL_DDL = `
  CREATE TABLE IF NOT EXISTS journal (
    event_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    aggregate_version INTEGER NOT NULL,
    operation_id TEXT NOT NULL DEFAULT '',
    payload_kind TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    envelope_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(session_id, seq)
  );
  CREATE INDEX IF NOT EXISTS idx_journal_session_seq ON journal(session_id, seq);
  CREATE INDEX IF NOT EXISTS idx_journal_operation ON journal(operation_id);
`;

export interface JournalRow {
  event_id: string;
  session_id: string;
  seq: number;
  aggregate_version: number;
  payload_kind: string;
  payload_json: string;
  envelope_json: string;
  created_at: string;
}