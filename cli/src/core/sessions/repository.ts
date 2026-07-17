// SessionRepository — atomic append, idempotent replay, optimistic versioning
// (AD-3, AD-6, AD-13). Wraps a SessionStore + journal table. Every durable
// event is appended in one SQLite transaction; re-appending the same EventId
// is a no-op. Recovery marks incomplete operations as unknown-outcome.

import { validateDurableEvent, type DurableEvent } from '../protocol/coreProtocol.js';
import type { SessionId } from '../protocol/ids.js';
import { newEventId, asOperationId, asSessionId } from '../protocol/ids.js';
import type { SessionStore } from './store.js';

export type Clock = () => string;

export class SessionRepository {
  constructor(
    private readonly store: SessionStore,
    private readonly clock: Clock,
  ) {
    this.runRecovery();
  }

  /** Append a durable event atomically. Allocates next (session_id, seq) and
   * aggregate_version inside one transaction. Idempotent by event_id. */
  append(event: DurableEvent): number {
    const validation = validateDurableEvent(event);
    if (!validation.ok) {
      throw new Error(`invalid durable event: ${validation.cause}`);
    }
    const db = this.store.db();
    const insert = db.prepare(
      `INSERT OR IGNORE INTO journal (event_id, session_id, seq, aggregate_version, operation_id, payload_kind, payload_json, envelope_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const getSeq = db.prepare(
      'SELECT seq FROM journal WHERE event_id = ?',
    );
    const maxSeq = db.prepare(
      'SELECT COALESCE(MAX(seq), 0) AS m FROM journal WHERE session_id = ?',
    );
    const maxVer = db.prepare(
      'SELECT COALESCE(MAX(aggregate_version), 0) AS m FROM journal WHERE session_id = ?',
    );

    const txn = db.transaction(() => {
      const existing = getSeq.get(event.id) as { seq: number } | undefined;
      if (existing) return existing.seq;
      const { m: prevSeq } = maxSeq.get(event.sessionId) as { m: number };
      const { m: prevVer } = maxVer.get(event.sessionId) as { m: number };
      const seq = prevSeq + 1;
      const ver = prevVer + 1;
      insert.run(
        event.id,
        event.sessionId,
        seq,
        ver,
        event.operationId ?? '',
        event.payload.kind,
        JSON.stringify(event.payload),
        JSON.stringify(event),
        this.clock(),
      );
      return seq;
    });
    return txn();
  }

  /** Query durable events for a session after a given sequence (ordered). */
  queryEvents(sessionId: SessionId, afterSequence: number): DurableEvent[] {
    const db = this.store.db();
    const rows = db.prepare(
      'SELECT envelope_json FROM journal WHERE session_id = ? AND seq > ? ORDER BY seq ASC',
    ).all(sessionId, afterSequence) as { envelope_json: string }[];
    return rows.map((r) => JSON.parse(r.envelope_json) as DurableEvent);
  }

  /** Replay ordered events to a callback (at-least-once). */
  subscribe(
    sessionId: SessionId,
    afterSequence: number,
    cb: (event: DurableEvent) => void,
  ): void {
    for (const event of this.queryEvents(sessionId, afterSequence)) {
      cb(event);
    }
  }

  /** Current aggregate version for a session. */
  aggregateVersion(sessionId: SessionId): number {
    const db = this.store.db();
    const row = db.prepare(
      'SELECT COALESCE(MAX(aggregate_version), 0) AS m FROM journal WHERE session_id = ?',
    ).get(sessionId) as { m: number };
    return row.m;
  }

  /** True if an event_id exists in the journal (post-commit visibility). */
  isCommitted(eventId: string): boolean {
    const db = this.store.db();
    const row = db.prepare(
      'SELECT 1 FROM journal WHERE event_id = ?',
    ).get(eventId);
    return row !== undefined;
  }

  /** Recovery pass: mark incomplete operations as unknown-outcome (AD-3, AD-20).
   * An operation is incomplete if it has a lifecycle-fact event (proposed,
   * authorized, prepared, dispatch-committed) but no terminal event. */
  private runRecovery(): void {
    const db = this.store.db();
    const lifecycleKinds = ['EffectDispatchCommitted'];
    const terminalKinds = [
      'OperationSucceeded', 'OperationFailed', 'OperationBlocked',
      'OperationCancelled', 'OperationUnknownOutcome',
    ];

    const rows = db.prepare(
      `SELECT DISTINCT j.operation_id, j.session_id FROM journal j
       WHERE j.payload_kind IN (${lifecycleKinds.map(() => '?').join(',')})
       AND j.operation_id IS NOT NULL
       AND j.operation_id != ''
       AND NOT EXISTS (
         SELECT 1 FROM journal j2
         WHERE j2.operation_id = j.operation_id
         AND j2.payload_kind IN (${terminalKinds.map(() => '?').join(',')})
       )`,
    ).all(...lifecycleKinds, ...terminalKinds) as { operation_id: string; session_id: string }[];

    for (const row of rows) {
      const event: DurableEvent = {
        id: newEventId(),
        sessionId: asSessionId(row.session_id),
        operationId: asOperationId(row.operation_id),
        schemaVersion: '1.0',
        timestamp: this.clock(),
        provenance: { kind: 'deterministic', source: 'recovery' },
        payload: { kind: 'OperationUnknownOutcome', operationId: row.operation_id },
      };
      this.append(event);
    }
  }
}