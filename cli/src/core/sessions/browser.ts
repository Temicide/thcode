// Session Browser (ADR 0016/0017). EXTENSION POINT: interface only.
// `/session` opens an interactive browser over the Global Session Store with
// filters: current workspace, other workspaces, or no workspace association.
// Opening a Saved Session creates a fresh Runtime Activation in Manual profile
// (ADR 0016) — restored sessions never inherit prior approvals.

import type { SessionRecord } from './store.js';

export type SessionFilter = 'current-workspace' | 'other-workspaces' | 'unbound' | 'all';

/**
 * TODO(session-browser): implement listing/filtering/opening/renaming/deleting
 * over SessionStore, plus the Runtime Activation reset semantics of ADR 0016.
 */
export interface SessionBrowser {
  list(filter: SessionFilter, currentWorkspace?: string): Promise<readonly SessionRecord[]>;
  open(sessionId: string): Promise<SessionRecord>;
  rename(sessionId: string, name: string): Promise<void>;
  remove(sessionId: string): Promise<void>;
}
