// Story 2.8: ux-state-v1 frozen registry + mechanical validation (AD-28).
import { describe, expect, it } from 'vitest';
import {
  COMMAND_ERROR_HEADING,
  EXIT_CODES,
  UX_STATE_ROWS,
  UX_STATE_VERSION,
  commandErrorOver,
  exitCodeForStatus,
  lookupUxState,
  uxStateDimension,
  validateUxStateRegistry,
} from '../src/core/protocol/uxState.js';

describe('ux-state-v1 — registry is mechanically valid (AC #7, #8)', () => {
  it('validates with zero errors on the frozen registry', () => {
    expect(validateUxStateRegistry()).toEqual([]);
  });

  it('every row has a unique display token and unique JSON token', () => {
    const display = new Set(UX_STATE_ROWS.map((r) => r.displayToken));
    const json = new Set(UX_STATE_ROWS.map((r) => r.jsonToken));
    expect(display.size).toBe(UX_STATE_ROWS.length);
    expect(json.size).toBe(UX_STATE_ROWS.length);
  });

  it('every row carries the required cause/retry/recovery/narrow/localized fields', () => {
    for (const r of UX_STATE_ROWS) {
      expect(typeof r.cause).toBe('string');
      expect(r.cause.length).toBeGreaterThan(0);
      expect(typeof r.retry).toBe('boolean');
      expect(typeof r.recovery).toBe('string');
      expect(r.recovery.length).toBeGreaterThan(0);
      expect(typeof r.narrow).toBe('boolean');
      expect(r.localized).toBe(true);
      expect(r.thaiLabel.length).toBeGreaterThan(0);
    }
  });

  it('terminal rows have a non-NONE exit class + numeric code; nonterminal rows are NONE + null', () => {
    for (const r of UX_STATE_ROWS) {
      if (r.terminal) {
        expect(r.exitClass).not.toBe('NONE');
        expect(r.exitCode).toBe(EXIT_CODES[r.exitClass as Exclude<typeof r.exitClass, 'NONE'>]);
      } else {
        expect(r.exitClass).toBe('NONE');
        expect(r.exitCode).toBe(null);
      }
    }
  });
});

describe('ux-state-v1 — AD-28 dimension membership is explicit and distinct', () => {
  it('the five dimensions are all represented', () => {
    const dims = new Set(UX_STATE_ROWS.map((r) => r.dimension));
    expect(dims).toEqual(
      new Set(['operation-status', 'lifecycle-fact', 'evidence-completeness', 'measurement-quality', 'provider-deletion-lifecycle']),
    );
  });

  it('effect-already-committed is a nonterminal lifecycle fact, never terminal SUCCESS', () => {
    const r = lookupUxState('effect-already-committed')!;
    expect(r.dimension).toBe('lifecycle-fact');
    expect(r.terminal).toBe(false);
    expect(r.exitClass).toBe('NONE');
  });

  it('percentage unavailable / estimated / sanitized-with-omissions are nonterminal qualifiers', () => {
    for (const t of ['percentage unavailable', 'estimated', 'sanitized-with-omissions']) {
      const r = lookupUxState(t)!;
      expect(r.terminal).toBe(false);
      expect(r.exitClass).toBe('NONE');
      expect(r.dimension).not.toBe('operation-status');
    }
  });

  it('provider-deletion rows are nonterminal and conditional on a verified provider contract', () => {
    const rows = uxStateDimension('provider-deletion-lifecycle');
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const r of rows) {
      expect(r.terminal).toBe(false);
      expect(r.exitClass).toBe('NONE');
      expect(r.providerContractConditional).toBe(true);
    }
  });
});

describe('ux-state-v1 — COMMAND_ERROR is a heading, not a status (AC #7)', () => {
  it('COMMAND_ERROR is not a registry row', () => {
    expect(UX_STATE_ROWS.find((r) => r.displayToken === COMMAND_ERROR_HEADING)).toBeUndefined();
  });

  it('layers over blocked and malformed, supplying the canonical exit class/code', () => {
    const blocked = commandErrorOver('blocked');
    expect(blocked.heading).toBe(COMMAND_ERROR_HEADING);
    expect(blocked.row.exitClass).toBe('BLOCKED');
    expect(blocked.row.exitCode).toBe(20);
    const malformed = commandErrorOver('malformed');
    expect(malformed.row.exitClass).toBe('FAILED');
    expect(malformed.row.exitCode).toBe(1);
  });

  it('refuses to layer over a non-blocked/malformed status', () => {
    expect(() => commandErrorOver('succeeded' as 'blocked')).toThrow();
  });
});

describe('ux-state-v1 — canonical exit mapping (Story 2.12 AC #6)', () => {
  it('maps succeeded/reconciled → SUCCESS=0', () => {
    expect(exitCodeForStatus('succeeded')).toBe(0);
    expect(exitCodeForStatus('reconciled')).toBe(0);
  });
  it('maps failed/malformed → FAILED=1', () => {
    expect(exitCodeForStatus('failed')).toBe(1);
    expect(exitCodeForStatus('malformed')).toBe(1);
  });
  it('maps blocked/denied/refused/stale/not-authoritative → BLOCKED=20', () => {
    for (const t of ['blocked', 'denied', 'refused']) expect(exitCodeForStatus(t)).toBe(20);
  });
  it('maps unknown-outcome → UNKNOWN_OUTCOME=70', () => {
    expect(exitCodeForStatus('unknown-outcome')).toBe(70);
  });
  it('maps cancelled → CANCELLED=130', () => {
    expect(exitCodeForStatus('cancelled')).toBe(130);
  });
  it('nonterminal tokens use NONE and null', () => {
    expect(exitCodeForStatus('proposed')).toBe(null);
    expect(exitCodeForStatus('dispatch-committed')).toBe(null);
    expect(exitCodeForStatus('idle')).toBe(null);
  });

  it('registry version is pinned', () => {
    expect(UX_STATE_VERSION).toBe(1);
  });
});