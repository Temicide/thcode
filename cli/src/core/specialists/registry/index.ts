// Capability Registry barrel export (Story 4.1).

export {
  CATALOGUED_NOT_AVAILABLE,
  type CapabilityRegistryEntry,
  type CapabilityRegistryManifest,
  type ContractTestResult,
  type PrivacyClassification,
  type RetentionClassification,
  type ConfirmationPolicy,
  type TransportRules,
  type RegistryFailClosedEvidence,
  type RegistryLoadResult,
  type InvokableStateReason,
} from './types.js';

export {
  validateManifest,
  parseManifest,
  RegistryManifestError,
} from './manifest.js';

export {
  CapabilityRegistry,
  loadRegistryManifest,
  defaultManifestPath,
  type InvocationCheckResult,
} from './registry.js';
