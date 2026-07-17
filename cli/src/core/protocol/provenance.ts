// Provenance: deterministic vs model (AD-3). Every event carries provenance so
// a deterministic failure category can never be contradicted by a model
// explanation (AD-9). Provenance is safe to log; it never carries secrets.

export type Provenance =
  | { readonly kind: 'deterministic'; readonly source: string }
  | { readonly kind: 'model'; readonly source: string; readonly adapterId?: string };