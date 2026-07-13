import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { SessionStore } from '../src/core/sessions/store.js';
import { InMemoryCredentialStore, SESSION_DATA_KEY_ID } from '../src/core/platform/credentialStore.js';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'thcode-test-'));
const dbPath = path.join(tmp, 'sessions.db');

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('SessionStore (SQLite + AES-256-GCM at rest)', () => {
  it('creates the data key in the CredentialStore on first open', async () => {
    const creds = new InMemoryCredentialStore();
    expect(await creds.has(SESSION_DATA_KEY_ID)).toBe(false);
    const store = await SessionStore.open(creds, dbPath);
    expect(await creds.has(SESSION_DATA_KEY_ID)).toBe(true);
    store.close();
  });

  it('round-trips sessions, transcript, and token ledger', async () => {
    const creds = new InMemoryCredentialStore();
    const store = await SessionStore.open(creds, path.join(tmp, 'crud.db'));

    const s = store.createSession('งานแข่ง thcode', 'D:\\Projects\\Active\\TH_CODE');
    expect(store.getSession(s.id)?.name).toBe('งานแข่ง thcode');
    expect(store.getSession(s.id)?.workspacePath).toBe('D:\\Projects\\Active\\TH_CODE');

    store.appendTranscript(s.id, 'user', 'สวัสดี');
    store.appendTranscript(s.id, 'assistant', 'สวัสดีครับ');
    const transcript = store.getTranscript(s.id);
    expect(transcript.map((t) => t.content)).toEqual(['สวัสดี', 'สวัสดีครับ']);
    expect(transcript.map((t) => t.seq)).toEqual([1, 2]);

    store.recordTokens({ sessionId: s.id, inputTokens: 100, outputTokens: 50, cachedTokens: 0, modelId: 'typhoon-v2.5-instruct' });
    store.recordTokens({ sessionId: s.id, inputTokens: 20, outputTokens: 5, cachedTokens: 10, modelId: 'typhoon-v2.5-instruct' });
    expect(store.tokenTotals(s.id)).toEqual({ input: 120, output: 55, cached: 10 });

    expect(store.listSessionsForWorkspace('D:\\Projects\\Active\\TH_CODE').length).toBe(1);
    expect(store.listSessionsForWorkspace('D:\\Elsewhere').length).toBe(0);

    store.deleteSession(s.id);
    expect(store.getSession(s.id)).toBeUndefined();
    store.close();
  });

  it('never stores plaintext sensitive content in the database file', async () => {
    const creds = new InMemoryCredentialStore();
    const file = path.join(tmp, 'privacy.db');
    const store = await SessionStore.open(creds, file);
    const s = store.createSession('SECRET-NAME-MARKER', 'D:\\SECRET-PATH-MARKER');
    store.appendTranscript(s.id, 'user', 'SECRET-CONTENT-MARKER');
    store.close();

    const raw = readFileSync(file, 'latin1');
    expect(raw).not.toContain('SECRET-NAME-MARKER');
    expect(raw).not.toContain('SECRET-PATH-MARKER');
    expect(raw).not.toContain('SECRET-CONTENT-MARKER');
  });
});
