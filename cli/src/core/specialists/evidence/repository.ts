// InMemoryEvidenceRepository (Story 4.14). In-memory implementation of the
// EvidenceRepository port. Stores frozen SpecialistEvidence records in a
// private Map. store is idempotent — storing the same id overwrites with an
// identical frozen record. Returns frozen records from all accessors.

import type {
  EvidenceRepository,
  EvidenceLoadResult,
  SpecialistEvidence,
} from './types.js';

/**
 * In-memory EvidenceRepository. Durable persistence is a later epic; 4.14
 * ships the port + this in-memory implementation.
 *
 * - store: idempotent — storing the same id overwrites with the identical
 *   frozen record.
 * - load: returns the frozen record or a typed not-found.
 * - list: returns all frozen records.
 * - has: returns whether the id exists.
 */
export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly _store: Map<string, SpecialistEvidence>;

  constructor() {
    this._store = new Map<string, SpecialistEvidence>();
  }

  async store(evidence: SpecialistEvidence): Promise<void> {
    this._store.set(evidence.id, evidence);
  }

  async load(id: string): Promise<EvidenceLoadResult> {
    const evidence = this._store.get(id);
    if (evidence === undefined) {
      return { ok: false, cause: 'not-found' };
    }
    return { ok: true, evidence };
  }

  async list(): Promise<readonly SpecialistEvidence[]> {
    return [...this._store.values()];
  }

  async has(id: string): Promise<boolean> {
    return this._store.has(id);
  }
}
