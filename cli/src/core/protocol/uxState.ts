// ux-state-v1: the single frozen mechanical contract across the five distinct
// UX state dimensions (Architecture AD-28; Story 2.8). One versioned registry
// owns every canonical state token, its dimension membership, terminality,
// and exact symbolic exit class + exit code. Story 7.18 certifies surface
// parity against THIS already-frozen contract; it is not the first validator
// (AC #8). `COMMAND_ERROR` is a fixed display heading layered over a canonical
// operation status of `blocked` or `malformed` — it is NOT a distinct operation
// status and NOT an additional registry row (AC #7). `effect-already-committed`
// is a nonterminal lifecycle fact whose underlying effect outcome is observed
// separately, never a terminal SUCCESS (AC #7). `percentage unavailable`,
// `estimated`, and `sanitized-with-omissions` are nonterminal
// Evidence/measurement qualifiers, never terminal operation outcomes (AC #7).
// Provider-deletion lifecycle rows are nonterminal facts conditional on a
// verified provider contract (AC #7).
//
// Mechanically validated: every row is checked for unique display token, unique
// JSON token, explicit dimension membership, explicit terminality, exactly one
// symbolic exit class (`NONE` for nonterminal rows), one exit code, and the
// required cause/retry/recovery/narrow/localized fields. A validation failure
// blocks the change — later epics cannot break the dimension, terminality, or
// exit-class contract (AC #8).

export const UX_STATE_VERSION = 1;

export type UxStateDimension =
  | 'operation-status'
  | 'lifecycle-fact'
  | 'evidence-completeness'
  | 'measurement-quality'
  | 'provider-deletion-lifecycle';

/** Symbolic exit class (Story 2.12 AC #6). `NONE` for nonterminal rows. */
export type ExitClass = 'NONE' | 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'UNKNOWN_OUTCOME' | 'CANCELLED';

/** Canonical exit codes (Story 2.12 AC #6 — exact and stable). */
export const EXIT_CODES: Readonly<Record<Exclude<ExitClass, 'NONE'>, number>> = Object.freeze({
  SUCCESS: 0,
  FAILED: 1,
  BLOCKED: 20,
  UNKNOWN_OUTCOME: 70,
  CANCELLED: 130,
});

/** A fixed display heading layered over a canonical `blocked`/`malformed`
 * operation status — NOT a distinct operation status and NOT a registry row
 * (AC #7). Callers render this heading while the underlying row supplies the
 * canonical status, exit class, and exit code. */
export const COMMAND_ERROR_HEADING = 'COMMAND_ERROR';

export interface UxStateRow {
  readonly displayToken: string;
  readonly jsonToken: string;
  readonly dimension: UxStateDimension;
  readonly terminal: boolean;
  readonly exitClass: ExitClass;
  /** `null` for nonterminal rows (JSON `null`, per Story 2.12 AC #6). */
  readonly exitCode: number | null;
  /** Stable machine-readable cause label (safe to log/journal — AD-24). */
  readonly cause: string;
  /** Whether a transient form of this state is retryable. */
  readonly retry: boolean;
  /** Deterministic next step / remedy. */
  readonly recovery: string;
  /** Whether the state is scoped to the smallest proven scope (AD-19). */
  readonly narrow: boolean;
  /** Whether a natural-Thai label is available (FR-37). */
  readonly localized: boolean;
  /** The natural-Thai label (FR-37); technical identifiers stay exact. */
  readonly thaiLabel: string;
  /** True only for provider-deletion rows conditional on a verified provider
   * contract (AC #7). `false` for every other dimension. */
  readonly providerContractConditional: boolean;
}

/** True when the row's exit mapping is consistent with its terminality
 * (terminal → non-NONE class + numeric code; nonterminal → NONE + null). */
function consistentExit(row: UxStateRow): boolean {
  if (row.terminal) {
    return row.exitClass !== 'NONE' && row.exitCode !== null && EXIT_CODES[row.exitClass as Exclude<ExitClass, 'NONE'>] === row.exitCode;
  }
  return row.exitClass === 'NONE' && row.exitCode === null;
}

function row(
  displayToken: string,
  dimension: UxStateDimension,
  terminal: boolean,
  exitClass: ExitClass,
  fields: { cause: string; retry: boolean; recovery: string; narrow: boolean; thaiLabel: string; providerContractConditional?: boolean },
): UxStateRow {
  return {
    displayToken,
    jsonToken: displayToken,
    dimension,
    terminal,
    exitClass,
    exitCode: terminal ? EXIT_CODES[exitClass as Exclude<ExitClass, 'NONE'>] : null,
    cause: fields.cause,
    retry: fields.retry,
    recovery: fields.recovery,
    narrow: fields.narrow,
    localized: true,
    thaiLabel: fields.thaiLabel,
    providerContractConditional: fields.providerContractConditional ?? false,
  };
}

const ROWS: readonly UxStateRow[] = Object.freeze([
  // --- Dimension 1: operation-status (AD-28 dimension 1) ---
  row('idle', 'operation-status', false, 'NONE', { cause: 'no-active-operation', retry: false, recovery: 'submit a prompt', narrow: true, thaiLabel: 'ไม่มีงานทำอยู่' }),
  row('succeeded', 'operation-status', true, 'SUCCESS', { cause: 'durable-terminal-success', retry: false, recovery: 'continue', narrow: true, thaiLabel: 'สำเร็จ' }),
  row('failed', 'operation-status', true, 'FAILED', { cause: 'durable-terminal-failure', retry: false, recovery: 'review evidence and retry with a corrected request', narrow: true, thaiLabel: 'ล้มเหลว' }),
  row('blocked', 'operation-status', true, 'BLOCKED', { cause: 'blocked-requires-user-action', retry: false, recovery: 'address the blocker and rerun interactively', narrow: true, thaiLabel: 'ถูกบล็อก' }),
  row('malformed', 'operation-status', true, 'FAILED', { cause: 'invalid-proposal-terminal', retry: false, recovery: 'correct the proposal and resubmit', narrow: true, thaiLabel: 'รูปแบบผิด' }),
  row('denied', 'operation-status', true, 'BLOCKED', { cause: 'policy-deny', retry: false, recovery: 'change policy inputs and re-evaluate', narrow: true, thaiLabel: 'ถูกปฏิเสธ' }),
  row('refused', 'operation-status', true, 'BLOCKED', { cause: 'hard-boundary-refusal', retry: false, recovery: 'the action is out of scope', narrow: true, thaiLabel: 'ถูกปฏิเสธขั้นสุดท้าย' }),
  row('cancelled', 'operation-status', true, 'CANCELLED', { cause: 'cancelled-before-dispatch-commit', retry: false, recovery: 'rerun if still intended', narrow: true, thaiLabel: 'ยกเลิก' }),
  row('unknown-outcome', 'operation-status', true, 'UNKNOWN_OUTCOME', { cause: 'dispatch-committed-no-terminal-proof', retry: false, recovery: 'reconcile explicitly; do not auto-retry', narrow: true, thaiLabel: 'ผลลัพธ์ไม่แน่นอน' }),
  row('reconciled', 'operation-status', true, 'SUCCESS', { cause: 'unknown-outcome-reconciled', retry: false, recovery: 'continue', narrow: true, thaiLabel: 'กระทบยอดแล้ว' }),

  // --- Dimension 2: lifecycle-fact (AD-28 dimension 2 — nonterminal) ---
  row('proposed', 'lifecycle-fact', false, 'NONE', { cause: 'proposal-received', retry: false, recovery: 'await authorization', narrow: true, thaiLabel: 'ถูกเสนอ' }),
  row('authorized', 'lifecycle-fact', false, 'NONE', { cause: 'authorization-bound', retry: false, recovery: 'await preparation', narrow: true, thaiLabel: 'ได้รับอนุญาต' }),
  row('prepared', 'lifecycle-fact', false, 'NONE', { cause: 'effect-prepared', retry: false, recovery: 'await dispatch commit', narrow: true, thaiLabel: 'เตรียมพร้อม' }),
  row('dispatch-committed', 'lifecycle-fact', false, 'NONE', { cause: 'effect-dispatch-linearized', retry: false, recovery: 'await terminal outcome', narrow: true, thaiLabel: 'ส่งงานแล้ว' }),
  row('effect-already-committed', 'lifecycle-fact', false, 'NONE', { cause: 'duplicate-dispatch-rejected', retry: false, recovery: 'observe the existing outcome', narrow: true, thaiLabel: 'ส่งงานไปก่อนแล้ว' }),
  row('cancel-requested', 'lifecycle-fact', false, 'NONE', { cause: 'cancel-before-commit', retry: false, recovery: 'await cancel acknowledgement', narrow: true, thaiLabel: 'ขอยกเลิก' }),
  row('cancel-acknowledged', 'lifecycle-fact', false, 'NONE', { cause: 'cancel-before-commit-ack', retry: false, recovery: 'operation ends cancelled', narrow: true, thaiLabel: 'ยืนยันยกเลิก' }),
  row('still-running', 'lifecycle-fact', false, 'NONE', { cause: 'dispatch-committed-running', retry: false, recovery: 'await terminal outcome or reconcile', narrow: true, thaiLabel: 'กำลังทำงาน' }),
  row('interruption-cancelled', 'lifecycle-fact', false, 'NONE', { cause: 'interrupted-cancel-proven', retry: false, recovery: 'reprompt if intended', narrow: true, thaiLabel: 'ถูกขัดจังหวะและยกเลิก' }),
  row('interruption-unknown', 'lifecycle-fact', false, 'NONE', { cause: 'interrupted-no-proof', retry: false, recovery: 'reconcile; do not assume no effect', narrow: true, thaiLabel: 'ถูกขัดจังหวะ ผลไม่แน่นอน' }),

  // --- Dimension 3: evidence-completeness (AD-28 dimension 3 — qualifier) ---
  row('complete', 'evidence-completeness', false, 'NONE', { cause: 'evidence-complete', retry: false, recovery: 'none', narrow: true, thaiLabel: 'หลักฐานครบ' }),
  row('partial', 'evidence-completeness', false, 'NONE', { cause: 'evidence-partial', retry: false, recovery: 'gather missing evidence', narrow: true, thaiLabel: 'หลักฐานบางส่วน' }),
  row('sanitized-with-omissions', 'evidence-completeness', false, 'NONE', { cause: 'sanitizer-omitted-unsafe-content', retry: false, recovery: 'review omission details', narrow: true, thaiLabel: 'ปลอดภัยแล้วแต่มีการละเว้น' }),
  row('stale', 'evidence-completeness', false, 'NONE', { cause: 'evidence-stale-vs-current', retry: false, recovery: 're-evaluate with current inputs', narrow: true, thaiLabel: 'ล้าสมัย' }),
  row('unavailable', 'evidence-completeness', false, 'NONE', { cause: 'evidence-not-available', retry: false, recovery: 'rerun when source is available', narrow: true, thaiLabel: 'ไม่พร้อมใช้งาน' }),
  row('corrupt', 'evidence-completeness', false, 'NONE', { cause: 'evidence-corrupt', retry: false, recovery: 'mark gap and recover', narrow: true, thaiLabel: 'ชำรุด' }),
  row('not-authoritative', 'evidence-completeness', false, 'NONE', { cause: 'evidence-not-authoritative', retry: false, recovery: 'require authoritative source', narrow: true, thaiLabel: 'ไม่น่าเชื่อถือ' }),

  // --- Dimension 4: measurement-quality (AD-28 dimension 4 — qualifier) ---
  row('estimated', 'measurement-quality', false, 'NONE', { cause: 'measurement-estimated', retry: false, recovery: 'verify when possible', narrow: true, thaiLabel: 'ประมาณการ' }),
  row('provider-reported', 'measurement-quality', false, 'NONE', { cause: 'measurement-provider-reported', retry: false, recovery: 'verify locally when possible', narrow: true, thaiLabel: 'ผู้ให้บริการรายงาน' }),
  row('locally-measured', 'measurement-quality', false, 'NONE', { cause: 'measurement-local', retry: false, recovery: 'none', narrow: true, thaiLabel: 'วัดเอง' }),
  row('fallback', 'measurement-quality', false, 'NONE', { cause: 'measurement-fallback', retry: false, recovery: 'verify when possible', narrow: true, thaiLabel: 'ค่าสำรอง' }),
  row('unknown', 'measurement-quality', false, 'NONE', { cause: 'measurement-unknown', retry: false, recovery: 'measure when possible', narrow: true, thaiLabel: 'ไม่ทราบ' }),
  row('percentage unavailable', 'measurement-quality', false, 'NONE', { cause: 'no-real-budget', retry: false, recovery: 'set a real budget or report unavailable', narrow: true, thaiLabel: 'ไม่มีค่าเปอร์เซ็นต์' }),

  // --- Dimension 5: provider-deletion-lifecycle (AD-28 dimension 5 —
  // nonterminal, conditional on a verified provider contract; AC #7) ---
  row('upstream-no-retention-verified', 'provider-deletion-lifecycle', false, 'NONE', { cause: 'provider-contract-no-retention', retry: false, recovery: 'nothing to delete locally-tracked', narrow: true, thaiLabel: 'ผู้ให้บริการยืนยันไม่เก็บรักษา', providerContractConditional: true }),
  row('deletion-not-required', 'provider-deletion-lifecycle', false, 'NONE', { cause: 'no-upstream-retention-to-delete', retry: false, recovery: 'none', narrow: true, thaiLabel: 'ไม่ต้องลบ', providerContractConditional: true }),
  row('deletion-confirmed', 'provider-deletion-lifecycle', false, 'NONE', { cause: 'provider-deletion-confirmed', retry: false, recovery: 'none', narrow: true, thaiLabel: 'ยืนยันการลบแล้ว', providerContractConditional: true }),
]);

export const UX_STATE_ROWS: readonly UxStateRow[] = ROWS;

export interface UxStateValidationError {
  readonly row: string;
  readonly cause: string;
}

/** Mechanically validate the registry (AC #7, AC #8). Returns every violation;
 * an empty array means the contract is sound. A later epic that adds a row
 * violating dimension/terminality/exit-class rules fails this check. */
export function validateUxStateRegistry(): readonly UxStateValidationError[] {
  const errors: UxStateValidationError[] = [];
  const seenDisplay = new Map<string, number>();
  const seenJson = new Map<string, number>();

  const require = (token: string, field: string, cond: boolean, msg: string) => {
    if (!cond) errors.push({ row: token, cause: `${field}: ${msg}` });
  };

  for (const r of ROWS) {
    require(r.displayToken, 'displayToken', typeof r.displayToken === 'string' && r.displayToken.length > 0, 'non-empty string');
    require(r.jsonToken, 'jsonToken', typeof r.jsonToken === 'string' && r.jsonToken.length > 0, 'non-empty string');
    require(r.displayToken, 'dimension', ['operation-status', 'lifecycle-fact', 'evidence-completeness', 'measurement-quality', 'provider-deletion-lifecycle'].includes(r.dimension), 'explicit dimension membership');
    require(r.displayToken, 'terminal', typeof r.terminal === 'boolean', 'explicit terminality');
    require(r.displayToken, 'exitClass', ['NONE', 'SUCCESS', 'FAILED', 'BLOCKED', 'UNKNOWN_OUTCOME', 'CANCELLED'].includes(r.exitClass), 'exactly one symbolic exit class');
    require(r.displayToken, 'exitMapping', consistentExit(r), 'exit class/code consistent with terminality');
    require(r.displayToken, 'cause', typeof r.cause === 'string' && r.cause.length > 0, 'required cause field');
    require(r.displayToken, 'retry', typeof r.retry === 'boolean', 'required retry field');
    require(r.displayToken, 'recovery', typeof r.recovery === 'string' && r.recovery.length > 0, 'required recovery field');
    require(r.displayToken, 'narrow', typeof r.narrow === 'boolean', 'required narrow field');
    require(r.displayToken, 'localized', typeof r.localized === 'boolean' && r.localized, 'required localized field');
    require(r.displayToken, 'thaiLabel', typeof r.thaiLabel === 'string' && r.thaiLabel.length > 0, 'required Thai label');
    // AC #7 invariants for specific tokens.
    if (r.displayToken === 'effect-already-committed') {
      require(r.displayToken, 'effect-already-committed', !r.terminal && r.exitClass === 'NONE', 'nonterminal lifecycle fact, never terminal SUCCESS');
    }
    if (['percentage unavailable', 'estimated', 'sanitized-with-omissions'].includes(r.displayToken)) {
      require(r.displayToken, 'qualifier-terminality', !r.terminal && r.exitClass === 'NONE', 'nonterminal Evidence/measurement qualifier, never terminal outcome');
    }
    if (r.dimension === 'provider-deletion-lifecycle') {
      require(r.displayToken, 'provider-deletion', !r.terminal && r.exitClass === 'NONE' && r.providerContractConditional, 'nonterminal lifecycle fact conditional on a verified provider contract');
    }
    seenDisplay.set(r.displayToken, (seenDisplay.get(r.displayToken) ?? 0) + 1);
    seenJson.set(r.jsonToken, (seenJson.get(r.jsonToken) ?? 0) + 1);
  }
  for (const [tok, n] of seenDisplay) require(tok, 'displayToken-unique', n === 1, 'duplicate display token');
  for (const [tok, n] of seenJson) require(tok, 'jsonToken-unique', n === 1, 'duplicate JSON token');
  // COMMAND_ERROR must NOT be a registry row (AC #7).
  require(COMMAND_ERROR_HEADING, 'command-error-not-a-row', !ROWS.some((r) => r.displayToken === COMMAND_ERROR_HEADING), 'COMMAND_ERROR is a heading, not a row');
  return errors;
}

/** Look up a row by its (display) token, or `undefined`. */
export function lookupUxState(token: string): UxStateRow | undefined {
  return ROWS.find((r) => r.displayToken === token || r.jsonToken === token);
}

/** All rows in a dimension. */
export function uxStateDimension(dimension: UxStateDimension): readonly UxStateRow[] {
  return ROWS.filter((r) => r.dimension === dimension);
}

/** The canonical exit code for a terminal operation-status token, or `null` for
 * nonterminal/unknown tokens (Story 2.12 AC #6). */
export function exitCodeForStatus(token: string): number | null {
  const r = lookupUxState(token);
  if (!r || !r.terminal) return null;
  return r.exitCode;
}

/** Render a status with the COMMAND_ERROR heading layered over a canonical
 * `blocked`/`malformed` operation status (AC #7). Returns the heading plus the
 * canonical underlying row; throws if the underlying status is not
 * `blocked`/`malformed` (COMMAND_ERROR is only a heading over those). */
export function commandErrorOver(underlyingStatus: 'blocked' | 'malformed'): {
  readonly heading: typeof COMMAND_ERROR_HEADING;
  readonly row: UxStateRow;
} {
  const r = lookupUxState(underlyingStatus);
  if (!r || r.dimension !== 'operation-status' || !((underlyingStatus === 'blocked' || underlyingStatus === 'malformed'))) {
    throw new Error(`COMMAND_ERROR is only a heading over blocked/malformed, not ${underlyingStatus}`);
  }
  return { heading: COMMAND_ERROR_HEADING, row: r };
}