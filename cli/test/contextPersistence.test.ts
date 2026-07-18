import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { InMemoryCredentialStore } from '../src/core/platform/credentialStore.js';
import { SessionStore } from '../src/core/sessions/store.js';
import { createExtension } from '../src/core/context/extensions.js';
import { asSessionId } from '../src/core/protocol/ids.js';
import { recoverContextExtensions } from '../src/core/context/recovery.js';

describe('Epic 5 encrypted context persistence', () => {
  it('is idempotent and retains extensions after reopen', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'thcode-context-'));
    const db = path.join(dir, 'sessions.db');
    const credentials = new InMemoryCredentialStore();
    const first = SessionStore.openSync(credentials, db);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const session = first.store.createSession('current', dir);
    const ext = createExtension({ kind: 'pin', sessionId: asSessionId(session.id), owner: session.id, payload: { itemId: 'x' }, now: '2026-07-18T00:00:00.000Z' });
    expect(first.store.appendContextExtension(ext)).toBe(1);
    expect(first.store.appendContextExtension(ext)).toBe(1);
    expect(first.store.listContextExtensions(session.id)).toHaveLength(1);
    first.store.close();
    const reopened = SessionStore.openSync(credentials, db);
    expect(reopened.ok).toBe(true);
    if (reopened.ok) { expect(reopened.store.listContextExtensions(session.id)[0]?.envelope.id).toBe(ext.id); reopened.store.close(); }
    rmSync(dir, { recursive: true, force: true });
  });
  it('keeps corruption sticky while retaining later valid evidence and high-water', () => {
    const sessionId = asSessionId('session-recovery');
    const first = createExtension({ kind: 'usage', sessionId, owner: sessionId, payload: { id: 'first', operationId: 'op', requestDigest: 'request-a' }, now: '2026-07-18T00:00:00.000Z' });
    const later = createExtension({ kind: 'usage', sessionId, owner: sessionId, payload: { id: 'later', operationId: 'op', requestDigest: 'request-a' }, now: '2026-07-18T00:01:00.000Z' });
    const state = recoverContextExtensions([first, { broken: true }, later], sessionId);
    expect(state.status).toBe('corrupt');
    expect(state.highWater).toBe(3);
    expect(state.usage).toHaveLength(1);
    expect((state.usage[0] as { id: string }).id).toBe('later');
  });
  it('locks an existing encrypted database when the key is unavailable', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'thcode-context-lock-'));
    const db = path.join(dir, 'sessions.db');
    const credentials = new InMemoryCredentialStore();
    const first = SessionStore.openSync(credentials, db);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    first.store.close();
    const missing = new InMemoryCredentialStore();
    expect(SessionStore.openSync(missing, db)).toMatchObject({ ok: false, mode: 'recovery-locked' });
    rmSync(dir, { recursive: true, force: true });
  });
});
