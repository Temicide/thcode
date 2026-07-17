// Store format version gate (AD-6, NFR-6). One version gates the database,
// journal, projections, artifact envelopes, and future checkpoint envelopes.
// Migration intent/progress/checksum are persisted before promotion.

export const STORE_FORMAT_VERSION = 1;