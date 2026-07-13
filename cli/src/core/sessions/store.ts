import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { CredentialStore } from '../platform/credentialStore.js';
import { SESSION_DATA_KEY_ID } from '../platform/credentialStore.js';
import { sessionsDbPath } from '../platform/paths.js';
import {
  decryptField,
  encryptField,
  generateDataKey,
  workspaceBindingIndex,
  type EncryptedField,
} from './crypto.js';

// Global Session Store (ADR 0017): one machine-local SQLite database under
// %LOCALAPPDATA%\thcode, scoped to the OS user, browsable from any directory.
// Sensitive columns (session name, workspace path, transcript content) are
// AES-256-GCM encrypted (ADR 0018) with a per-install data key held in the
// CredentialStore — the key is NEVER a database field. Only opaque ids, schema
// versions, and operational timestamps remain plaintext.
//
// This is a scaffold-level implementation: schema + encrypt/decrypt helpers +
// basic CRUD. Deferred to later phases (extension points, do not build here):
// - session browser UX (ADR 0016/0017)          -> src/core/sessions/browser.ts (TODO)
// - compaction records / pins (ADR 0014)        -> transcript schema will grow
// - export/import/recovery archives (Phase 2)

const SCHEMA_VERSION = 1;

export interface SessionRecord {
  readonly id: string;
  readonly name: string;
  readonly workspacePath: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type TranscriptRole = 'user' | 'assistant' | 'tool' | 'system';

export interface TranscriptEntry {
  readonly id: string;
  readonly sessionId: string;
  readonly seq: number;
  readonly role: TranscriptRole;
  readonly content: string;
  readonly createdAt: string;
}

export interface TokenLedgerEntry {
  readonly sessionId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly modelId: string;
  readonly createdAt: string;
}

function enc(field: EncryptedField): string {
  return JSON.stringify(field);
}
function dec(json: string): EncryptedField {
  return JSON.parse(json) as EncryptedField;
}

export class SessionStore {
  private constructor(
    private readonly db: Database.Database,
    private readonly dataKey: Buffer,
  ) {}

  /**
   * Open (creating if needed) the Global Session Store. The per-install data
   * key is fetched from the CredentialStore; when absent, a fresh key is
   * generated and stored there. Losing that key makes encrypted content
   * unrecoverable (ADR 0018) — the CLI must disclose this, not imply backup.
   */
  static async open(
    credentials: CredentialStore,
    dbPath: string = sessionsDbPath(),
  ): Promise<SessionStore> {
    mkdirSync(path.dirname(dbPath), { recursive: true });

    let keyB64 = await credentials.get(SESSION_DATA_KEY_ID);
    if (!keyB64) {
      const fresh = generateDataKey();
      keyB64 = fresh.toString('base64');
      await credentials.set(SESSION_DATA_KEY_ID, keyB64);
    }
    const key = Buffer.from(keyB64, 'base64');

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        name_enc TEXT NOT NULL,            -- encrypted session name (ADR 0018)
        workspace_enc TEXT NOT NULL,       -- encrypted Workspace Binding path
        workspace_index TEXT NOT NULL,     -- keyed non-reversible equality index
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_index);
      CREATE TABLE IF NOT EXISTS transcript_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL,
        content_enc TEXT NOT NULL,         -- encrypted turn content (ADR 0018)
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_transcript_session ON transcript_entries(session_id, seq);
      CREATE TABLE IF NOT EXISTS token_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cached_tokens INTEGER NOT NULL DEFAULT 0,
        model_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    db.prepare('INSERT OR IGNORE INTO meta (k, v) VALUES (?, ?)').run(
      'schema_version',
      String(SCHEMA_VERSION),
    );
    return new SessionStore(db, key);
  }

  createSession(name: string, workspacePath: string): SessionRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO sessions (id, schema_version, name_enc, workspace_enc, workspace_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        SCHEMA_VERSION,
        enc(encryptField(name, this.dataKey, `session:${id}:name`)),
        enc(encryptField(workspacePath, this.dataKey, `session:${id}:workspace`)),
        workspaceBindingIndex(workspacePath, this.dataKey),
        now,
        now,
      );
    return { id, name, workspacePath, createdAt: now, updatedAt: now };
  }

  getSession(id: string): SessionRecord | undefined {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | Record<string, string>
      | undefined;
    if (!row) return undefined;
    return this.decodeSession(row);
  }

  /** Equality-filter by Workspace Binding without exposing the plaintext path. */
  listSessionsForWorkspace(workspacePath: string): SessionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM sessions WHERE workspace_index = ? ORDER BY updated_at DESC')
      .all(workspaceBindingIndex(workspacePath, this.dataKey)) as Record<string, string>[];
    return rows.map((r) => this.decodeSession(r));
  }

  listSessions(): SessionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM sessions ORDER BY updated_at DESC')
      .all() as Record<string, string>[];
    return rows.map((r) => this.decodeSession(r));
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM transcript_entries WHERE session_id = ?').run(id);
    this.db.prepare('DELETE FROM token_ledger WHERE session_id = ?').run(id);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  appendTranscript(sessionId: string, role: TranscriptRole, content: string): TranscriptEntry {
    const id = randomUUID();
    const now = new Date().toISOString();
    const seqRow = this.db
      .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM transcript_entries WHERE session_id = ?')
      .get(sessionId) as { next: number };
    this.db
      .prepare(
        `INSERT INTO transcript_entries (id, session_id, seq, role, content_enc, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        sessionId,
        seqRow.next,
        role,
        enc(encryptField(content, this.dataKey, `transcript:${id}`)),
        now,
      );
    this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);
    return { id, sessionId, seq: seqRow.next, role, content, createdAt: now };
  }

  getTranscript(sessionId: string): TranscriptEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM transcript_entries WHERE session_id = ? ORDER BY seq ASC')
      .all(sessionId) as Record<string, string | number>[];
    return rows.map((r) => ({
      id: String(r.id),
      sessionId: String(r.session_id),
      seq: Number(r.seq),
      role: String(r.role) as TranscriptRole,
      content: decryptField(dec(String(r.content_enc)), this.dataKey, `transcript:${String(r.id)}`),
      createdAt: String(r.created_at),
    }));
  }

  recordTokens(entry: Omit<TokenLedgerEntry, 'createdAt'>): void {
    this.db
      .prepare(
        `INSERT INTO token_ledger (session_id, input_tokens, output_tokens, cached_tokens, model_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.sessionId,
        entry.inputTokens,
        entry.outputTokens,
        entry.cachedTokens,
        entry.modelId,
        new Date().toISOString(),
      );
  }

  /** Cumulative Token Usage (ADR 0015 — distinct from context utilization). */
  tokenTotals(sessionId: string): { input: number; output: number; cached: number } {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(input_tokens),0) AS i, COALESCE(SUM(output_tokens),0) AS o, COALESCE(SUM(cached_tokens),0) AS c
         FROM token_ledger WHERE session_id = ?`,
      )
      .get(sessionId) as { i: number; o: number; c: number };
    return { input: row.i, output: row.o, cached: row.c };
  }

  close(): void {
    this.db.close();
  }

  private decodeSession(row: Record<string, string>): SessionRecord {
    return {
      id: row.id,
      name: decryptField(dec(row.name_enc), this.dataKey, `session:${row.id}:name`),
      workspacePath: decryptField(dec(row.workspace_enc), this.dataKey, `session:${row.id}:workspace`),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
