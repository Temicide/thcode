import { existsSync, mkdirSync, statSync } from 'node:fs';
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
import { STORE_FORMAT_VERSION } from './formatVersion.js';
import { JOURNAL_DDL } from './journal.js';
import type { ContextExtensionEnvelope } from '../context/extensions.js';
import { validateExtension } from '../context/extensions.js';
import { recoverContextExtensions, type ContextRecoveryState } from '../context/recovery.js';
import { newSessionId } from '../protocol/ids.js';

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

export interface ContextExtensionRecord { readonly id: string; readonly sessionId: string; readonly seq: number; readonly envelope: ContextExtensionEnvelope; readonly createdAt: string }

export type StoreOpenResult =
  | { ok: true; store: SessionStore }
  | { ok: false; mode: 'migration-failed' | 'recovery-locked'; cause: string };

function enc(field: EncryptedField): string {
  return JSON.stringify(field);
}
function dec(json: string): EncryptedField {
  return JSON.parse(json) as EncryptedField;
}

export class SessionStore {
  private constructor(
    private readonly _db: Database.Database,
    private readonly dataKey: Buffer,
  ) {}

  /** Expose the raw database handle for the journal repository. */
  db(): Database.Database {
    return this._db;
  }

  /** Read a meta value by key. */
  meta(key: string): string | undefined {
    const row = this._db.prepare('SELECT v FROM meta WHERE k = ?').get(key) as
      | { v: string }
      | undefined;
    return row?.v;
  }

  /** Write a meta value. */
  setMeta(key: string, value: string): void {
    this._db.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').run(key, value);
  }

  static async open(
    credentials: CredentialStore,
    dbPath: string = sessionsDbPath(),
  ): Promise<StoreOpenResult> {
    return SessionStore._open(credentials, dbPath, true);
  }

  /** Synchronous open for tests (InMemoryCredentialStore is sync-safe). */
  static openSync(
    credentials: CredentialStore,
    dbPath: string,
  ): StoreOpenResult {
    return SessionStore._open(credentials, dbPath, false);
  }

  private static _open(
    credentials: CredentialStore,
    dbPath: string,
    _async: boolean,
  ): StoreOpenResult {
    mkdirSync(path.dirname(dbPath), { recursive: true });

    const keyB64 = (credentials as unknown as { getSync?: (id: string) => string | null }).getSync
      ? (credentials as unknown as { getSync: (id: string) => string | null }).getSync!(SESSION_DATA_KEY_ID)
      : null;

    const databaseExists = (() => { try { return existsSync(dbPath) && statSync(dbPath).size > 0; } catch { return false; } })();
    let finalKeyB64: string;
    if (keyB64) {
      finalKeyB64 = keyB64;
    } else if (databaseExists) {
      return { ok: false, mode: 'recovery-locked', cause: 'session encryption key unavailable; refusing replacement key' };
    } else {
      const fresh = generateDataKey();
      finalKeyB64 = fresh.toString('base64');
      if ((credentials as unknown as { setSync?: (id: string, secret: string) => void }).setSync) {
        (credentials as unknown as { setSync: (id: string, secret: string) => void }).setSync!(SESSION_DATA_KEY_ID, finalKeyB64);
      }
    }
    const key = Buffer.from(finalKeyB64, 'base64');
    if (key.length !== 32) return { ok: false, mode: 'recovery-locked', cause: 'session encryption key has invalid length' };

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
        name_enc TEXT NOT NULL,
        workspace_enc TEXT NOT NULL,
        workspace_index TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_index);
      CREATE TABLE IF NOT EXISTS transcript_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL,
        content_enc TEXT NOT NULL,
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
      CREATE TABLE IF NOT EXISTS context_extensions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        envelope_enc TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(session_id, seq)
      );
    `);
    db.exec(JOURNAL_DDL);

    db.prepare('INSERT OR IGNORE INTO meta (k, v) VALUES (?, ?)').run(
      'schema_version',
      String(SCHEMA_VERSION),
    );

    const existingFormat = db.prepare('SELECT v FROM meta WHERE k = ?').get('format_version') as
      | { v: string }
      | undefined;
    if (existingFormat) {
      const existing = Number.parseInt(existingFormat.v, 10);
      if (Number.isNaN(existing) || existing > STORE_FORMAT_VERSION) {
        db.close();
        return {
          ok: false,
          mode: 'migration-failed',
          cause: `Store format version ${existingFormat.v} is newer than current ${STORE_FORMAT_VERSION}`,
        };
      }
    }
    db.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').run(
      'format_version',
      String(STORE_FORMAT_VERSION),
    );

    return { ok: true, store: new SessionStore(db, key) };
  }

  createSession(name: string, workspacePath: string): SessionRecord {
    const id = newSessionId();
    const now = new Date().toISOString();
    this._db
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
    const row = this._db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | Record<string, string>
      | undefined;
    if (!row) return undefined;
    return this.decodeSession(row);
  }

  listSessionsForWorkspace(workspacePath: string): SessionRecord[] {
    const rows = this._db
      .prepare('SELECT * FROM sessions WHERE workspace_index = ? ORDER BY updated_at DESC')
      .all(workspaceBindingIndex(workspacePath, this.dataKey)) as Record<string, string>[];
    return rows.map((r) => this.decodeSession(r));
  }

  listSessions(): SessionRecord[] {
    const rows = this._db
      .prepare('SELECT * FROM sessions ORDER BY updated_at DESC')
      .all() as Record<string, string>[];
    return rows.map((r) => this.decodeSession(r));
  }

  deleteSession(id: string): void {
    this._db.prepare('DELETE FROM transcript_entries WHERE session_id = ?').run(id);
    this._db.prepare('DELETE FROM token_ledger WHERE session_id = ?').run(id);
    this._db.prepare('DELETE FROM journal WHERE session_id = ?').run(id);
    this._db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  appendTranscript(sessionId: string, role: TranscriptRole, content: string): TranscriptEntry {
    const id = randomUUID();
    const now = new Date().toISOString();
    const seqRow = this._db
      .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM transcript_entries WHERE session_id = ?')
      .get(sessionId) as { next: number };
    this._db
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
    this._db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);
    return { id, sessionId, seq: seqRow.next, role, content, createdAt: now };
  }

  getTranscript(sessionId: string): TranscriptEntry[] {
    const rows = this._db
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
    this._db
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

  tokenTotals(sessionId: string): { input: number; output: number; cached: number } {
    const row = this._db
      .prepare(
        `SELECT COALESCE(SUM(input_tokens),0) AS i, COALESCE(SUM(output_tokens),0) AS o, COALESCE(SUM(cached_tokens),0) AS c
         FROM token_ledger WHERE session_id = ?`,
      )
      .get(sessionId) as { i: number; o: number; c: number };
    return { input: row.i, output: row.o, cached: row.c };
  }

  appendContextExtension(envelope: ContextExtensionEnvelope): number {
    const checked = validateExtension(envelope, envelope.sessionId);
    if (!checked.ok) throw new Error(`invalid context extension: ${checked.cause}`);
    const tx = this._db.transaction(() => {
      const existing = this._db.prepare('SELECT seq, envelope_enc FROM context_extensions WHERE id = ?').get(envelope.id) as { seq: number; envelope_enc: string } | undefined;
      if (existing) {
        // Idempotent publication is only safe when the replay is byte-identical;
        // an identifier collision must never replace committed evidence.
        const existingJson = decryptField(dec(existing.envelope_enc), this.dataKey, `extension:${envelope.id}`);
        if (existingJson !== JSON.stringify(envelope)) throw new Error('context extension id collision');
        return existing.seq;
      }
      const row = this._db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM context_extensions WHERE session_id = ?').get(envelope.sessionId) as { m: number };
      const seq = row.m + 1;
      this._db.prepare('INSERT INTO context_extensions (id, session_id, seq, envelope_enc, created_at) VALUES (?, ?, ?, ?, ?)').run(envelope.id, envelope.sessionId, seq, enc(encryptField(JSON.stringify(envelope), this.dataKey, `extension:${envelope.id}`)), envelope.provenance.at);
      return seq;
    });
    return tx();
  }
  listContextExtensions(sessionId: string): ContextExtensionRecord[] {
    const rows = this._db.prepare('SELECT * FROM context_extensions WHERE session_id = ? ORDER BY seq ASC').all(sessionId) as Array<Record<string, string | number>>;
    return rows.map((row) => ({ id: String(row.id), sessionId: String(row.session_id), seq: Number(row.seq), envelope: JSON.parse(decryptField(dec(String(row.envelope_enc)), this.dataKey, `extension:${String(row.id)}`)) as ContextExtensionEnvelope, createdAt: String(row.created_at) }));
  }
  recoverContextGovernance(sessionId: string): ContextRecoveryState {
    try {
      return recoverContextExtensions(this.listContextExtensions(sessionId).map((record) => record.envelope), sessionId);
    } catch {
      return Object.freeze({ pins: [], manifests: [], usage: [], compactions: [], overflows: [], opaque: [], highWater: 0, status: 'recovery-locked' });
    }
  }

  close(): void {
    this._db.close();
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