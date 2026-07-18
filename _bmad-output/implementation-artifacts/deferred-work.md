- source_spec: `_bmad-output/implementation-artifacts/4-2-browse-search-inspect-and-honestly-disable-catalog-entries.md`
  summary: `/tools <subcommand>` without an id argument silently falls through to browse instead of a usage error.
  evidence: `cli/src/core/app.ts` /tools handler guards each subcommand with `sub && args[1]`; `/tools inspect` (no id) renders the full catalog. Pre-existing behavior; spec is silent on argumentless controls.
