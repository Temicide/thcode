- source_spec: `_bmad-output/implementation-artifacts/4-2-browse-search-inspect-and-honestly-disable-catalog-entries.md`
  summary: `/tools <subcommand>` without an id argument silently falls through to browse instead of a usage error.
  evidence: `cli/src/core/app.ts` /tools handler guards each subcommand with `sub && args[1]`; `/tools inspect` (no id) renders the full catalog. Pre-existing behavior; spec is silent on argumentless controls.
- source_spec: `_bmad-output/implementation-artifacts/4-4-generate-effective-configuration-and-enforce-the-health-lifecycle.md`
  summary: `registerProbe` double-registration for the same service silently overwrites the stored probe and re-registers with HealthRegistry.
  evidence: `cli/src/core/specialists/health/lifecycle.ts` `registerProbe` unconditionally sets `this.probes.set(serviceId, probe)` and calls `this.registry.registerProbe(serviceId, adapter)` without checking for existing registration. Pre-existing design question; HealthRegistry handles this.
- source_spec: `_bmad-output/implementation-artifacts/4-4-generate-effective-configuration-and-enforce-the-health-lifecycle.md`
  summary: `quarantine` on an unconfigured service creates a quarantine state without prior registration.
  evidence: `cli/src/core/specialists/health/lifecycle.ts` `quarantine` calls `this.registry.quarantine(serviceId, cause)` without checking whether the service was registered first. Edge case; service is already unselectable as `unconfigured`.
- source_spec: `_bmad-output/implementation-artifacts/4-4-generate-effective-configuration-and-enforce-the-health-lifecycle.md`
  summary: `buildSpecialistConfiguration` accepts any serviceId including non-specialist services (e.g. Typhoon).
  evidence: `cli/src/core/app.ts` `buildSpecialistConfiguration` does not validate that the service belongs to the specialist category. Pre-existing design question; spec does not define specialist-only validation.
