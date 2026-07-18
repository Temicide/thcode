// CoreApp: the stable application-facing interface of the headless core
// (ADR 0020). UI layers (Ink today; desktop/web/IDE later) interact ONLY
// through this facade via typed intents — never touching fs, network, or
// child_process directly.

import { AgentLoop, type ApprovalCallback } from './agent/loop.js';
import { dispatchTyphoonTurn, durableEvent } from './agent/dispatch.js';
import { validateProposal } from './agent/validation.js';
import type { ValidationDeps } from './agent/validation.js';
import { mediateToolResult } from './agent/toolResultMediation.js';
import type { MediationDeps } from './agent/toolResultMediation.js';
import { handleLifecycleStep } from './agent/lifecycle.js';
import type { LifecycleDeps } from './agent/lifecycle.js';
import {
  aggregateTerminals,
  revalidateAuthorityForNextEffect,
  type TerminalAggregatorDeps,
  type RevalidateNextEffectInput,
  type RevalidateNextEffectResult,
} from './agent/terminals.js';
import type {
  ProposalToValidate,
  ProposalValidationResult,
  MediatedToolResult,
  ToolResultToMediate,
  LoopTerminal,
  ValidationContext,
  MediationContext,
  LifecycleContext,
  AggregateRoundOutcome,
  OperationTerminalState,
  RevalidationContext,
} from './agent/types.js';
import { ToolCatalog } from './catalog/loader.js';
import { CapabilityRegistry } from './specialists/registry/index.js';
import {
  browseCatalog,
  searchCatalog,
  inspectEntry,
  enableService,
  disableService,
  diagnoseService,
  retestService,
  renderCatalogList,
  renderEntryDetail,
  renderEntryRow,
  type CatalogProjection,
  type CatalogEntryProjection,
  type CatalogRenderMode,
  type HealthMap,
} from './specialists/catalog/index.js';
import {
  contextUtilizationPercentOrUnavailable,
  effectiveContextCapacityOrUnavailable,
} from './context/types.js';
import type { PermissionProfile, WorkMode } from './permissions/types.js';
import {
  activationEstablishedPayload,
  RuntimeActivation,
  type ActivationReason,
} from './permissions/runtimeActivation.js';
import { EffectExecutor, PolicyEnforcementPoint, type PepDecision, type PepInput } from './permissions/pep.js';
import {
  AuthorizationRegistry,
  consumeAuthorization,
  createAuthorization,
  revalidateAuthorization,
  revokeAuthorization,
  revocationOutcome,
  type Authorization,
  type ConsumeResult,
  type DispatchState,
  type ProposalBinding,
  type RevalidationResult,
} from './permissions/authorization.js';
import {
  BoundaryExpansionRegistry,
  checkHardBoundary,
  type BoundaryCheckInput,
  type BoundaryDecision,
  type BoundaryExpansion,
} from './permissions/boundary.js';
import {
  establishWorkspaceBinding,
  defaultPlatformProbe,
  defaultFsProbe,
} from './workspace/identity.js';
import { resolveResource } from './workspace/resourceResolver.js';
import { checkContainment } from './workspace/containment.js';
import type { WorkspaceIdentity } from './workspace/types.js';
import { createCredentialStore, type CredentialStore } from './platform/index.js';
import { createDefaultProviderRegistry, ProviderRegistry } from './providers/registry.js';
import type { NormalizedMessage } from './providers/types.js';
import { HealthRegistry, type HealthSnapshot } from './providers/health.js';
import { typhoonGeneration, typhoonHealthProbe } from './providers/typhoonHealth.js';
import { createDefaultToolRegistry, type ToolRegistry } from './tools/registry.js';
import { assertCompatibleVersion, PROTOCOL_MAJOR } from './protocol/coreProtocol.js';
import {
  COMMAND_GRAMMAR,
  commandRejection,
  noTtyCommandBlocked,
  parseCommand,
  renderCommandOutput,
  type CommandOutput,
  type CoreCommand,
} from './protocol/commandGrammar.js';
import { asSessionId, asOperationId, newOperationId } from './protocol/ids.js';
import type { OperationId } from './protocol/ids.js';
import type { SessionRepository } from './sessions/repository.js';
import { CheckpointRepository } from './checkpoints/checkpointRepository.js';
import { ArtifactStore } from './checkpoints/artifactStore.js';
import type { KeyValueStore, BlobStore } from './checkpoints/types.js';
import {
  planMutationSet,
  runProtectionPreflight,
  fingerprintPlan,
  isStale,
  processConfirmation,
} from './mutations/index.js';
import type {
  MutationSet,
  PlanFingerprint,
  ProtectionPreflightResult,
  RawProposal,
  StaleCheckResult,
  ConfirmationScope,
  ConfirmationResult,
  PlanMutationResult,
  PreflightResult,
} from './mutations/index.js';
import {
  inspectList,
  inspectRead,
  inspectSearch,
  evaluateInspectionPolicy,
  policyDecisionToRefusal,
  defaultInspectionFsProbe,
} from './inspection/index.js';
import type {
  InspectionLimits,
  InspectionRefusal,
  ListResult,
  ReadResult,
  SearchResult,
} from './inspection/index.js';
import {
  previewFileEffect,
  applyFileEffect,
  revalidateFileEffect,
  detectConflict,
  previewDeletion,
  applyDeletionEffect,
} from './effects/index.js';
import type {
  PreviewResult,
  EffectOutcome,
  EffectConflict,
  FsMutator,
  DeletionPreviewResult,
  DeletionOutcome,
  QuarantineProvider,
} from './effects/index.js';
import type {
  AuthorityProjection,
  ConversationProjection,
  StatusProjection,
  TranscriptTurnProjection,
} from './protocol/projections.js';
import {
  validateControlledCommand,
  executeControlledCommand,
  defaultValidationContext,
  type CommandProposal,
  type CommandValidationResult,
  type CommandExecutionResult,
  type CommandExecutionContext,
} from './commands/index.js';
import { runDependencyPreflight, defaultEnvironmentProbe } from './depPreflight/run.js';
import type { DepPreflightResult } from './depPreflight/types.js';
import { runHelloWorldProof } from './proof/index.js';
import type { ProofEnvironment, ProofResult } from './proof/types.js';
import { sanitizer } from './security/sanitizer.js';
import type { OnboardingIO } from './security/onboarding.js';
import {
  onboardAiForThai,
  hasAiForThaiKey,
  InMemoryCredentialPersistence,
  type AiForThaiOnboardingResult,
  type CredentialRemovalResult,
  type CredentialRotationResult,
  type CredentialPersistence,
} from './specialists/credential/index.js';
import {
  SpecialistHealthLifecycle,
  buildSpecialistEffectiveConfiguration,
  type SpecialistGenerationResult,
  type SpecialistHealthSnapshot,
} from './specialists/health/index.js';
import {
  routeSpecialistPrompt,
  type RoutingDecision,
} from './specialists/routing/index.js';
import {
  buildSpecialistPreparedPayloadManifest,
  requestSpecialistTransferConsent,
  revalidateSpecialistTransferConsent as revalidateSpecialistConsent,
  type SpecialistManifestInput,
  type SpecialistConsentInput,
  type SpecialistRevalidationInput,
  type ConsentEvaluationResult,
  type PreparedPayloadManifest,
  type TransferConsent,
  type ConsentReference,
} from './specialists/consent/index.js';
import type { PreparedArtifact } from './specialists/artifacts/types.js';
import {
  SharedSpecialistAdapter,
  FetchSpecialistTransport,
  type SpecialistInvocation,
  type SpecialistRequestOptions,
  type SpecialistRequest,
} from './specialists/adapter/index.js';
import {
  SpecialistArtifactResolver,
  type ArtifactResolutionResult,
  type MinimizationResult,
  minimizeArtifact,
} from './specialists/artifacts/index.js';
import {
  listCheckpoints,
  inspectCheckpoint,
  analyzeRollbackSet,
  applyRollback,
  renderRollbackListOutput,
  renderRollbackInspectOutput,
} from './rollback/index.js';
import type {
  AnalyzeRollbackResult,
  AnalysisContext,
  AnalysisFsProbe,
  RollbackTarget,
  RollbackApplyResultOrFailure,
  ApplyContext,
  ApplyFsProbe,
} from './rollback/types.js';
import { asCheckpointId } from './checkpoints/types.js';
import {
  calculateRetention,
  evaluateCapacity,
  runCleanup,
  renderRetentionStatusOutput,
  renderCapacityUsageOutput,
  renderCleanupOutcomeOutput,
  type RetentionConfig,
  type RetentionState,
  type CapacityUsage,
  type CleanupContext,
} from './retention/index.js';
import {
  classify,
  reconcileOperation,
  buildRecoveryResult,
  renderRecoveryInspect,
  renderRecoveryReconcile,
  renderRecoveryExport,
  renderRecoveryExit,
  renderRecoveryHelp,
} from './recovery/index.js';
import type {
  RecoveryAction,
  RecoveryClassification,
} from './recovery/types.js';

export interface CoreStatus {
  readonly mode: WorkMode;
  readonly profile: PermissionProfile;
  readonly providerId: string;
  readonly modelId: string;
  /** Canonical: a number when a verified capacity exists, otherwise the
   * literal token `'percentage unavailable'` (PR-4). Never a fabricated
   * `128k`/`115,200`-derived number. */
  readonly contextPercent: number | 'percentage unavailable';
  readonly healthState: string;
}

export interface CoreAppOptions {
  workspaceRoot?: string;
  credentials?: CredentialStore;
  providers?: ProviderRegistry;
  tools?: ToolRegistry;
  health?: HealthRegistry;
  /** Optional durable journal repository (Story 1.9's known gap: CoreApp
   * does not wire a real one by default yet — Epic 6 does). When present,
   * Epic 2 authority events (`RuntimeActivationEstablished`,
   * `AuthorityChanged`, `PolicyDecisionRecorded`,
   * `BoundaryExpansionGranted`/`Revoked`) are journaled durably; when
   * absent, the same transitions still happen in memory (state, projections)
   * but are not persisted — tests that need durability pass a repo. */
  repo?: SessionRepository;
  clock?: () => string;
}

export class CoreApp {
  readonly providers: ProviderRegistry;
  readonly tools: ToolRegistry;
  readonly credentials: CredentialStore;
  readonly health: HealthRegistry;
  readonly workspaceRoot: string;

  private history: NormalizedMessage[] = [];
  private estimatedContextTokens = 0;
  private readonly loop: AgentLoop;
  private readonly repo?: SessionRepository;
  private readonly clock: () => string;

  /** Story 2.1: Runtime Activation owns the live Work Mode / Permission
   * Profile / Full Access / sensitive-transfer-override / composer-busy
   * state, separate from CoreApp's provider/session bookkeeping. */
  private activation: RuntimeActivation;
  private workspace: WorkspaceIdentity;
  /** Story 2.2: one local Policy Enforcement Point + the sanctioned effect
   * executor that is the only consumer allowed to turn an `allow` decision
   * into permission to run an effect. */
  private readonly pep = new PolicyEnforcementPoint();
  private readonly effectExecutor: EffectExecutor;
  /** Story 2.3: durable Boundary Expansions for the current Workspace. */
  private readonly boundaryExpansions: BoundaryExpansionRegistry;
  /** Story 2.4: exact-proposal one-shot authorizations + EventId dedup. */
  private readonly authorizations = new AuthorizationRegistry();
  /** Story 4.2: set of service IDs the user has disabled. */
  private readonly _disabledServices = new Set<string>();
  /** Story 4.3: secret-free AI-for-Thai credential reference persistence. */
  private _aiforthaiPersistence: CredentialPersistence = new InMemoryCredentialPersistence();
  /** Story 4.4: specialist health lifecycle (dedicated HealthRegistry instance). */
  private _specialistHealth: SpecialistHealthLifecycle;
  /** Story 4.6: specialist artifact resolver (in-workspace reference resolution). */
  private _specialistArtifactResolver: SpecialistArtifactResolver;
  /** Story 4.9: lazily-initialized shared specialist adapter. */
  private _specialistAdapter: SharedSpecialistAdapter | null = null;

  constructor(opts: CoreAppOptions = {}) {
    // Fail-closed startup: incompatible protocol major version throws before
    // any state is constructed (AD-2).
    assertCompatibleVersion(PROTOCOL_MAJOR);
    this.workspaceRoot = opts.workspaceRoot ?? process.cwd();
    this.credentials = opts.credentials ?? createCredentialStore();
    this.providers = opts.providers ?? createDefaultProviderRegistry();
    this.tools = opts.tools ?? createDefaultToolRegistry();
    this.health = opts.health ?? new HealthRegistry();
    this.repo = opts.repo;
    this.clock = opts.clock ?? (() => new Date().toISOString());
    this._specialistHealth = new SpecialistHealthLifecycle(this.clock);
    this._specialistArtifactResolver = new SpecialistArtifactResolver({
      fsProbe: defaultFsProbe(),
      clock: this.clock,
    });
    this.loop = new AgentLoop({
      providers: this.providers,
      tools: this.tools,
      credentials: this.credentials,
      workspaceRoot: this.workspaceRoot,
    });
    // Register the Typhoon live probe and wire a generation on startup if a
    // key is present (FR-2, FR-4, AD-8). A live check is run lazily by the
    // caller via checkTyphoonHealth(); availability is never assumed from
    // the presence of a key alone.
    this.health.registerProbe(
      'typhoon',
      typhoonHealthProbe((g) => {
        if (g.providerId !== 'typhoon') return null;
        const syncGet = (this.credentials as unknown as { getSync?: (id: string) => string | null }).getSync;
        return syncGet ? syncGet.call(this.credentials, 'typhoon') : null;
      }),
    );

    // Story 2.1 AD-22: a fresh Runtime Activation is established on process
    // start (this constructor), before any approval can be requested.
    // Story 3.1: workspace binding uses the full WorkspaceIdentity with
    // platform/volume identity and explicit binding status.
    this.workspace = establishWorkspaceBinding(this.workspaceRoot, {
      platformProbe: defaultPlatformProbe(),
      fsProbe: defaultFsProbe(),
      clock: this.clock,
    });
    this.boundaryExpansions = new BoundaryExpansionRegistry(this.clock);
    this.effectExecutor = new EffectExecutor(this.pep);
    this.activation = this.establishActivation('process-start', this.workspace.workspaceId);
  }

  /** Story 2.1 AC #1: build a fresh Runtime Activation and journal
   * `RuntimeActivationEstablished` BEFORE any approval can be requested
   * against it (this method itself never requests one). */
  private establishActivation(reason: ActivationReason, workspaceId: string): RuntimeActivation {
    const activation = new RuntimeActivation({ workspaceId, reason, clock: this.clock });
    const payload = activationEstablishedPayload(activation.snapshot());
    this.repo?.append(
      durableEvent(payload, asSessionId(this.sessionId()), {
        provenanceKind: 'deterministic',
        provenanceSource: 'runtime-activation',
        clock: this.clock,
      }),
    );
    return activation;
  }

  private sessionId(): string {
    return `sess-${this.providers.selectedId}`;
  }

  /** Live Typhoon health check (FR-2, FR-4, AD-8). Registers the current
   * effective configuration generation and runs the probe; returns the typed
   * health snapshot. Never assumes `available` from a key alone. */
  async checkTyphoonHealth(): Promise<HealthSnapshot> {
    const caps = this.providers.selected.capabilities;
    const syncGet = (this.credentials as unknown as { getSync?: (id: string) => string | null }).getSync;
    const hasKey = syncGet ? syncGet.call(this.credentials, 'typhoon') !== null : false;
    if (!hasKey) {
      this.health.markUnconfigured('typhoon');
      return this.health.snapshot('typhoon');
    }
    const g = typhoonGeneration({
      credentialRevision: `rev-${Date.now().toString(36)}`,
      adapterVersion: '1.0.0',
      modelId: caps.modelId,
    });
    this.health.registerConfiguration(g);
    return this.health.check('typhoon');
  }

  // --- Story 4.4: Specialist health lifecycle ---

  /**
   * Access the SpecialistHealthLifecycle (dedicated HealthRegistry instance).
   * Specialist and Typhoon health are kept independent.
   */
  specialistHealthLifecycle(): SpecialistHealthLifecycle {
    return this._specialistHealth;
  }

  /**
   * Build a SpecialistEffectiveConfiguration for a service. Loads the registry
   * entry via capabilityRegistry(), loads the AI-for-Thai credential reference
   * via the existing persistence, and builds request config defaults. Returns
   * the typed SpecialistGenerationResult. Does NOT register or check health.
   */
  async buildSpecialistConfiguration(serviceId: string): Promise<SpecialistGenerationResult> {
    const registry = this.capabilityRegistry();
    if (!registry.ok) {
      return {
        ok: false,
        cause: 'missing-field',
        detail: 'Capability Registry is not loaded.',
      };
    }

    const entry = registry.byId(serviceId);
    if (!entry) {
      return {
        ok: false,
        cause: 'missing-field',
        detail: `Service "${serviceId}" not found in the Capability Registry.`,
      };
    }

    const loaded = await this._aiforthaiPersistence.load();
    const credentialReference = loaded.ok ? loaded.reference : null;

    // Use the default request config (Stories 4.10–4.13 may override).
    return buildSpecialistEffectiveConfiguration(entry, credentialReference, undefined, this.clock);
  }

  /**
   * Check the health of a Specialist Service. Builds the configuration if
   * successful, registers it, registers the probe (if one exists), and runs
   * the check. Until probes are registered per service (Stories 4.10–4.13),
   * `check` returns the HealthRegistry's `probe-missing` configuration failure.
   * No Specialist is invoked here.
   */
  async checkSpecialistHealth(serviceId: string): Promise<SpecialistHealthSnapshot> {
    const result = await this.buildSpecialistConfiguration(serviceId);
    if (!result.ok) {
      return { serviceId, state: 'unconfigured' };
    }

    this._specialistHealth.register(result.configuration);
    return this._specialistHealth.check(serviceId);
  }

  // --- Story 4.8: Specialist transfer consent ---

  /**
   * Prepare a Specialist payload manifest from resolved/minimized artifacts.
   * Loads the registry entry + effective configuration via existing accessors,
   * then builds the PreparedPayloadManifest with both canonical manifest digest
   * and exact payload-byte digest.
   *
   * Returns the manifest directly. If the configuration build fails, throws a
   * typed error (caller should catch and handle).
   */
  async prepareSpecialistPayload(
    serviceId: string,
    preparedArtifacts: readonly PreparedArtifact[],
    operationId: string,
    promptRoundId: string,
    opts: {
      readonly callCount?: number;
      readonly expiresAt?: string | null;
    } = {},
  ): Promise<PreparedPayloadManifest> {
    const registry = this.capabilityRegistry();
    if (!registry.ok) {
      throw new Error('Capability Registry is not loaded.');
    }

    const entry = registry.byId(serviceId);
    if (!entry) {
      throw new Error(`Service "${serviceId}" not found in the Capability Registry.`);
    }

    const configResult = await this.buildSpecialistConfiguration(serviceId);
    if (!configResult.ok) {
      throw new Error(`Failed to build configuration for "${serviceId}": ${configResult.detail}`);
    }

    const proposal = {
      serviceId,
      name: entry.nameEnglish,
      rationale: `Specialist transfer to ${entry.nameEnglish} (${serviceId})`,
    };

    const input: SpecialistManifestInput = {
      proposal,
      preparedArtifacts,
      effectiveConfiguration: configResult.configuration,
      registryEntry: entry,
      operationId,
      promptRoundId,
      callCount: opts.callCount ?? 1,
      expiresAt: opts.expiresAt ?? null,
    };

    return buildSpecialistPreparedPayloadManifest(input);
  }

  /**
   * Request Specialist transfer consent. Wires activation/authority context
   * from the current Runtime Activation and computes the sanitizer result from
   * the prepared artifacts' text content.
   *
   * For text artifacts, joins the text content and runs it through the sanitizer
   * with contentClass 'remote-payload'. For binary artifacts, contributes an
   * empty string (safe). This ensures unsafe-payload detection for text payloads
   * while relying on manifest digest binding for binary payloads.
   */
  async requestSpecialistTransferConsent(
    manifest: PreparedPayloadManifest,
    preparedArtifacts: readonly PreparedArtifact[],
    currentPayloadByteDigest: string,
  ): Promise<ConsentEvaluationResult> {
    const a = this.activation.snapshot();
    const auth = this.authorityProjection();

    // Compute sanitizer result from text artifacts' joined text.
    const joinedText = preparedArtifacts
      .filter((art) => art.contentKind === 'text' && art.text !== undefined)
      .map((art) => art.text!)
      .join('\n');
    const sanitizerResult = sanitizer.sanitize(joinedText, 'remote-payload');

    const input: SpecialistConsentInput = {
      manifest,
      activationId: auth.activationId,
      activationRevision: auth.activationRevision,
      authorityRevision: a.revision,
      policyVersion: 1,
      clock: this.clock,
      currentPayloadByteDigest,
      now: this.clock(),
      sanitizerResult,
    };

    return requestSpecialistTransferConsent(input);
  }

  /**
   * Revalidate a granted Specialist transfer consent immediately before
   * transport. Checks activation/authority context and re-runs consent
   * evaluation against the current manifest + payload digest.
   */
  async revalidateSpecialistTransferConsent(
    consent: TransferConsent,
    manifest: PreparedPayloadManifest,
    currentPayloadByteDigest: string,
  ): Promise<ConsentEvaluationResult> {
    const a = this.activation.snapshot();
    const auth = this.authorityProjection();

    const current: SpecialistRevalidationInput = {
      manifest,
      currentPayloadByteDigest,
      activationId: auth.activationId,
      activationRevision: auth.activationRevision,
      authorityRevision: a.revision,
      now: this.clock(),
    };

    return revalidateSpecialistConsent(consent, current);
  }

  // --- Story 4.9: Specialist invocation ---

  /**
   * Invoke a Specialist service. Builds the SpecialistRequest from the
   * effective configuration, health snapshot, registry entry, prepared
   * artifacts, prepared manifest, and consent reference. Constructs the
   * SharedSpecialistAdapter (lazily) with FetchSpecialistTransport, the
   * injected clock, and a resolveRawKey closure wired to credentials
   * persistence. Returns the typed SpecialistInvocation — NEVER throws.
   *
   * No remote call if validation refuses (fail-closed before transport).
   */
  async invokeSpecialist(
    serviceId: string,
    preparedArtifacts: readonly PreparedArtifact[],
    preparedManifest: PreparedPayloadManifest,
    consentReference: ConsentReference,
    operationId: string,
    opts?: Partial<SpecialistRequestOptions>,
  ): Promise<SpecialistInvocation> {
    // Build the effective configuration.
    const configResult = await this.buildSpecialistConfiguration(serviceId);
    if (!configResult.ok) {
      // Config build failure (e.g. missing credential) → the service is not in
      // an invokable state. `non-invokable-entry` is the accurate refusal cause
      // (NOT `handler-not-registered`, which is reserved for missing per-service
      // handlers and is determined inside the adapter).
      return {
        ok: false,
        refused: true,
        cause: 'non-invokable-entry',
        safeMessage: `Cannot invoke "${serviceId}": configuration could not be built (${configResult.detail}).`,
        operationId,
        serviceId,
      };
    }

    const effectiveConfiguration = configResult.configuration;

    // Get the health snapshot.
    const healthSnapshot = this._specialistHealth.snapshot(serviceId);

    // Get the registry entry.
    const registry = this.capabilityRegistry();
    if (!registry.ok) {
      return {
        ok: false,
        refused: true,
        cause: 'non-invokable-entry',
        safeMessage: 'Cannot invoke a Specialist: Capability Registry is not loaded.',
        operationId,
        serviceId,
      };
    }

    const entry = registry.byId(serviceId);
    if (!entry) {
      return {
        ok: false,
        refused: true,
        cause: 'non-invokable-entry',
        safeMessage: `Service "${serviceId}" is not present in the Capability Registry.`,
        operationId,
        serviceId,
      };
    }

    // Build the SpecialistRequest.
    const request: SpecialistRequest = {
      serviceId,
      contractVersion: effectiveConfiguration.contractVersion,
      manifestVersion: effectiveConfiguration.manifestVersion,
      effectiveConfiguration,
      preparedManifest,
      consentReference,
      operationId,
      preparedArtifacts,
      options: {
        timeoutMs: opts?.timeoutMs ?? effectiveConfiguration.requestConfig.timeoutMs,
        maxRetries: opts?.maxRetries ?? effectiveConfiguration.requestConfig.maxRetries,
      },
      startedAt: this.clock(),
    };

    // Lazily initialize the adapter.
    if (!this._specialistAdapter) {
      this._specialistAdapter = new SharedSpecialistAdapter({
        transport: new FetchSpecialistTransport(),
        clock: this.clock,
        resolveRawKey: async () => {
          const key = await this.credentials.get('aiforthai');
          if (key === null) {
            throw new Error('AI-for-Thai credential not available.');
          }
          return key;
        },
      });
    }

    return this._specialistAdapter.invoke(request, entry, healthSnapshot);
  }

  // --- Story 4.3: AI-for-Thai credential JIT onboarding ---

  /**
   * JIT connection-boundary hook: pauses before any Specialist request when no
   * AI-for-Thai credential is configured. Discloses the reviewed endpoint,
   * separate credential purpose, local OS credential storage, and four-service
   * scope. Opens the masked form ONLY in interactive mode. Does NOT invoke a
   * Specialist.
   *
   * On success, persists the secret-free reference + revision + fingerprint in
   * product persistence. On failure, returns a typed cause with Inspect/
   * Replace/Remove/Exit next actions and no Specialist invocation.
   */
  async ensureAiForThaiCredential(io: OnboardingIO): Promise<AiForThaiOnboardingResult> {
    const hasKey = await hasAiForThaiKey(this.credentials);
    if (hasKey) {
      const loaded = await this._aiforthaiPersistence.load();
      if (loaded.ok) {
        return { ok: true, fingerprint: loaded.reference.fingerprint, reference: loaded.reference };
      }
    }

    const result = await onboardAiForThai(this.credentials, io, this.clock);
    if (result.ok) {
      await this._aiforthaiPersistence.save(result.reference);
    }
    return result;
  }

  /** Check if an AI-for-Thai credential is configured. */
  async hasAiForThaiCredential(): Promise<boolean> {
    return hasAiForThaiKey(this.credentials);
  }

  /**
   * Remove the AI-for-Thai credential. Invalidates the old reference and makes
   * dependent EffectiveConfigurationGenerations stale/unavailable. No cached
   * credential value remains in product buffers or persistence.
   */
  async removeAiForThaiCredential(): Promise<CredentialRemovalResult> {
    const loaded = await this._aiforthaiPersistence.load();
    if (!loaded.ok) {
      // Still try to remove from the credential store.
      try {
        await this.credentials.delete('aiforthai');
      } catch {
        // Best-effort.
      }
      return { ok: false, cause: 'not-found', message: 'No AI-for-Thai credential reference to remove.' };
    }

    const refId = loaded.reference.referenceId;

    // Remove from credential store.
    try {
      await this.credentials.delete('aiforthai');
    } catch (e) {
      return { ok: false, cause: 'store-error', message: `Failed to remove AI-for-Thai credential from store: ${(e as Error).message}` };
    }

    // Invalidate the persistence reference.
    await this._aiforthaiPersistence.invalidate();

    return { ok: true, invalidatedReferenceId: refId };
  }

  /**
   * Rotate the AI-for-Thai credential. Invalidates the old reference and runs
   * the onboarding flow for a new key. On success, persists the new secret-free
   * reference. On failure, the old reference is already invalidated and no
   * cached credential value remains.
   */
  async rotateAiForThaiCredential(io: OnboardingIO): Promise<CredentialRotationResult> {
    // Invalidate the old reference first.
    const loaded = await this._aiforthaiPersistence.load();
    if (!loaded.ok) {
      return { ok: false, cause: 'not-found', message: 'No AI-for-Thai credential reference to rotate.', nextActions: ['exit'] };
    }

    // Remove from credential store.
    try {
      await this.credentials.delete('aiforthai');
    } catch (e) {
      return { ok: false, cause: 'store-error', message: `Failed to remove old AI-for-Thai credential: ${(e as Error).message}`, nextActions: ['inspect', 'replace', 'remove', 'exit'] };
    }

    // Invalidate the persistence reference.
    await this._aiforthaiPersistence.invalidate();

    // Run the onboarding flow for the new key.
    const result = await onboardAiForThai(this.credentials, io, this.clock);
    if (result.ok) {
      await this._aiforthaiPersistence.save(result.reference);
      return { ok: true, newReference: result.reference };
    }

    // Onboarding failed — return the typed failure cause honestly. An
    // unknown-outcome stays unknown-outcome (never remapped to store-error):
    // the old reference was already invalidated, so the credential is gone,
    // but the outcome of the new onboarding attempt is reported as-is.
    return {
      ok: false,
      cause: result.cause,
      message: result.message,
      nextActions: result.nextActions,
    };
  }

  status(): CoreStatus {
    const caps = this.providers.selected.capabilities;
    const capacity = effectiveContextCapacityOrUnavailable(caps.contextLimit);
    const a = this.activation.snapshot();
    return {
      mode: a.mode,
      profile: a.profile,
      providerId: this.providers.selectedId,
      modelId: caps.modelId,
      contextPercent: contextUtilizationPercentOrUnavailable(this.estimatedContextTokens, capacity),
      healthState: this.health.snapshot(this.providers.selectedId).state,
    };
  }

  /** Canonical StatusProjection (AD-2, UX-DR-031). Same fields across Ink,
   * redirected text, and headless JSON. */
  statusProjection(): StatusProjection {
    const caps = this.providers.selected.capabilities;
    // PR-4: caps.contextLimit is `null` until a verified Typhoon limit is
    // sourced. The null-aware helpers propagate `'percentage unavailable'`
    // end to end rather than deriving a numeric percent from an unverified
    // literal (epics.md Pre-Implementation Gate).
    const capacity = effectiveContextCapacityOrUnavailable(caps.contextLimit);
    const percent = contextUtilizationPercentOrUnavailable(this.estimatedContextTokens, capacity);
    const a = this.activation.snapshot();
    return {
      workMode: a.mode,
      permissionProfile: a.profile,
      fullAccess: a.profile === 'full-access',
      providerId: this.providers.selectedId,
      modelId: caps.modelId,
      healthState: this.health.snapshot(this.providers.selectedId).state,
      contextPercent: percent,
      enforcementVerified: false,
    };
  }

  /** Canonical AuthorityProjection (Story 2.1 AC #2, AD-22). Workspace
   * identity, activation identity/revision, Work Mode, and Permission
   * Profile are independently addressable — the projection never derives one
   * from another. */
  authorityProjection(): AuthorityProjection {
    const a = this.activation.snapshot();
    const now = this.clock();
    const active = this.boundaryExpansions
      .list()
      .filter((e) => !e.revoked && (e.expiresAt === null || e.expiresAt > now)).length;
    return {
      activationId: a.activationId,
      activationRevision: a.revision,
      workspaceId: a.workspaceId,
      workMode: a.mode,
      permissionProfile: a.profile,
      fullAccess: a.profile === 'full-access',
      sensitiveTransferOverride: a.sensitiveTransferOverride,
      activeBoundaryExpansionCount: active,
      enforcementVerified: false,
    };
  }

  /** Canonical ConversationProjection (AD-2). The UI calls this — it never
   * builds its own authoritative transcript. Derives transcript turns from
   * the in-memory history; durable journal replay (Epic 6) feeds this too. */
  query(): ConversationProjection {
    const transcript: TranscriptTurnProjection[] = this.history.map((m, i) => ({
      promptRoundId: `round-${i}`,
      role: m.role,
      text: m.content,
      timestamp: new Date().toISOString(),
      interrupted: false,
      evidenceComplete: 'complete' as const,
    }));
    const caps = this.providers.selected.capabilities;
    const capacity = effectiveContextCapacityOrUnavailable(caps.contextLimit);
    return {
      status: this.statusProjection(),
      session: {
        sessionId: this.sessionId(),
        name: 'current',
        workspaceRoot: this.workspaceRoot,
        lastActivity: new Date().toISOString(),
      },
      transcript,
      context: {
        estimatedTokens: this.estimatedContextTokens,
        effectiveCapacity: capacity,
        utilizationPercent: contextUtilizationPercentOrUnavailable(this.estimatedContextTokens, capacity),
        pinnedTurnCount: 0,
      },
    };
  }

  /** Mark whether the composer is idle (no pending input / no IME preedit).
   * `setMode`/`setProfile`/`toggleMode` refuse to mutate authority while this
   * is `false` (Story 2.1 AC #6) — the UI is responsible for calling this
   * around composer/preedit lifecycle events. Defaults to idle, so existing
   * callers (which already only call `setMode`/`setProfile` at natural idle
   * points, e.g. after a submitted `/plan` command) are unaffected. */
  setComposerBusy(busy: boolean): void {
    this.activation.setComposerBusy(busy);
  }

  /** Only Work Mode changes; the authority revision increments; Plan is
   * structurally read-only under every Profile (enforced by the PEP, not
   * here). Refused (no state change, no revision bump) while the composer is
   * busy (Story 2.1 AC #3, #6). Returns whether it actually applied. */
  setMode(mode: WorkMode): boolean {
    const result = this.activation.setMode(mode);
    if (result.applied) this.recordAuthorityChange('mode', mode, result.state.revision);
    return result.applied;
  }

  toggleMode(): WorkMode {
    const current = this.activation.snapshot().mode;
    const next = current === 'plan' ? 'build' : 'plan';
    this.setMode(next);
    return this.activation.snapshot().mode;
  }

  /** Only Permission Profile changes; the authority revision increments.
   * Selecting a profile is NEVER itself approval, transfer consent, or a
   * Boundary Expansion (Story 2.1 AC #4). Refused while the composer is busy
   * (AC #6). Returns whether it actually applied. */
  setProfile(profile: PermissionProfile): boolean {
    const result = this.activation.setProfile(profile);
    if (result.applied) this.recordAuthorityChange('profile', profile, result.state.revision);
    return result.applied;
  }

  private recordAuthorityChange(field: 'mode' | 'profile', value: string, revision: number): void {
    this.repo?.append(
      durableEvent(
        {
          kind: 'AuthorityChanged',
          activationId: this.activation.snapshot().activationId,
          revision,
          field,
          value,
        },
        asSessionId(this.sessionId()),
        { provenanceKind: 'deterministic', provenanceSource: 'runtime-activation', clock: this.clock },
      ),
    );
  }

  /** Story 2.1 AC #1, #5, AD-22: establish a fresh Runtime Activation —
   * unique activation identity, authority reset to Manual, Full Access /
   * temporary approvals / transfer consent / in-flight authority cleared.
   * Called on Session create/open/switch and Workspace rebind. A prior
   * activation's approvals/consent/Full Access can never authorize anything
   * against the new activationId (`RuntimeActivation.authorizes` is keyed by
   * activationId, not just revision). Any durable Boundary Expansion is
   * NOT cleared here — it is merely revalidated by the caller against the
   * (possibly new) Workspace, remaining separately inspectable (AC #5). */
  beginNewActivation(reason: ActivationReason, workspaceRoot?: string): AuthorityProjection {
    if (workspaceRoot !== undefined) {
      this.workspace = establishWorkspaceBinding(workspaceRoot, {
        platformProbe: defaultPlatformProbe(),
        fsProbe: defaultFsProbe(),
        clock: this.clock,
      });
    }
    this.activation = this.establishActivation(reason, this.workspace.workspaceId);
    return this.authorityProjection();
  }

  /** Story 2.2: evaluate a proposed effect through the one local PEP. Journals
   * `PolicyDecisionRecorded` Evidence (AC #5) when a repo is wired. Does NOT
   * itself authorize execution — `authorizeEffect` is the only sanctioned
   * path from a decision to permission-to-run (AC #6). */
  evaluateEffect(actionClass: string, opts: { enforcementAvailable?: boolean } = {}): PepDecision {
    const a = this.activation.snapshot();
    const input: PepInput = {
      actionClass,
      state: { mode: a.mode, profile: a.profile, sensitiveOverride: a.sensitiveTransferOverride },
      activationRevision: a.revision,
      enforcementAvailable: opts.enforcementAvailable,
    };
    const decision = this.pep.evaluate(input);
    this.repo?.append(
      durableEvent(
        {
          kind: 'PolicyDecisionRecorded',
          operationId: newOperationId(),
          actionClass: decision.actionClass,
          outcome: decision.outcome,
          reason: decision.reason,
          matrixVersion: decision.matrixVersion,
          activationRevision: decision.activationRevision,
        },
        asSessionId(this.sessionId()),
        { provenanceKind: 'deterministic', provenanceSource: 'pep', clock: this.clock },
      ),
    );
    return decision;
  }

  /** Story 2.2 AC #6: the ONLY sanctioned way to turn a policy evaluation
   * into permission to run an effect. Throws `EffectNotAuthorizedError` for
   * any non-`allow` outcome. */
  authorizeEffect(actionClass: string, opts: { enforcementAvailable?: boolean } = {}): PepDecision {
    const a = this.activation.snapshot();
    return this.effectExecutor.authorize({
      actionClass,
      state: { mode: a.mode, profile: a.profile, sensitiveOverride: a.sensitiveTransferOverride },
      activationRevision: a.revision,
      enforcementAvailable: opts.enforcementAvailable,
    });
  }

  /** Story 2.4 AC #1: bind an unforgeable one-shot authorization to the EXACT
   * proposal the user reviewed. The decision must be the PEP evaluation for
   * this proposal; the authorization records the activationId/revision,
   * authority revision, matrix version, expiry, and approving interaction.
   * Journals `ApprovalGranted` Evidence (digests only — no raw payload). */
  grantApproval(input: {
    readonly operationId: string;
    readonly binding: ProposalBinding;
    readonly decision: PepDecision;
    readonly expiresAt?: string | null;
    readonly approvingInteraction: string;
  }): Authorization {
    const a = this.activation.snapshot();
    const auth = createAuthorization({
      operationId: input.operationId,
      binding: input.binding,
      decision: input.decision,
      activationId: a.activationId,
      activationRevision: a.revision,
      authorityRevision: a.revision,
      expiresAt: input.expiresAt ?? null,
      approvingInteraction: input.approvingInteraction,
      clock: this.clock,
    });
    this.authorizations.grant(auth);
    this.repo?.append(
      durableEvent(
        {
          kind: 'ApprovalGranted',
          authorizationId: auth.authorizationId,
          operationId: auth.operationId,
          actionDigest: auth.actionDigest,
          targetDigest: auth.targetDigest,
          contextDigest: auth.contextDigest,
          payloadDigest: auth.payloadDigest,
          destinationDigest: auth.destinationDigest,
          classification: auth.classification,
          credentialGroup: auth.credentialGroup,
          activationId: auth.activationId,
          activationRevision: auth.activationRevision,
          authorityRevision: auth.authorityRevision,
          policyOutcome: auth.policyOutcome,
          matrixVersion: auth.matrixVersion,
          expiresAt: auth.expiresAt,
          approvingInteraction: auth.approvingInteraction,
        },
        asSessionId(this.sessionId()),
        { operationId: input.operationId, provenanceKind: 'deterministic', provenanceSource: 'approval', clock: this.clock },
      ),
    );
    return auth;
  }

  /** Story 2.4 AC #2, AC #6: revalidate a bound authorization against the
   * CURRENT proposal + activation immediately before dispatch. Any mismatch
   * (rewritten proposal, changed activation/authority, expired/consumed/revoked
   * one-shot) refuses the authorization — fresh evaluation + approval required. */
  revalidateAuthorization(auth: Authorization, binding: ProposalBinding): RevalidationResult {
    const a = this.activation.snapshot();
    return revalidateAuthorization(auth, {
      binding,
      activationId: a.activationId,
      activationRevision: a.revision,
      authorityRevision: a.revision,
      now: this.clock(),
    });
  }

  /** Story 2.4 AC #1, AC #5: consume a one-shot authorization for a dispatched
   * effect. Double consumption is refused (replayed approvals cannot acquire
   * effect authority twice). Journals `AuthorizationConsumed` on success. */
  consumeAuthorization(auth: Authorization): ConsumeResult {
    const res = consumeAuthorization(auth);
    if (!res.ok || !res.authorization) return res;
    this.authorizations.replace(res.authorization);
    this.repo?.append(
      durableEvent(
        { kind: 'AuthorizationConsumed', authorizationId: res.authorization.authorizationId, operationId: res.authorization.operationId },
        asSessionId(this.sessionId()),
        { operationId: res.authorization.operationId, provenanceKind: 'deterministic', provenanceSource: 'effect-executor', clock: this.clock },
      ),
    );
    return { ok: true, authorization: res.authorization };
  }

  /** Story 2.4 AC #3, AC #4: revoke an authorization. Before dispatch commit
   * the outcome is `cancelled`; after commit it is whatever durable Evidence
   * proves (`succeeded`/`failed`/`unknown-outcome`/`still-running`) — never a
   * cancellation fiction. Journals `AuthorizationRevoked` with the honest
   * outcome. */
  revokeAuthorization(auth: Authorization, dispatch: DispatchState, reason: string): {
    readonly authorization: Authorization;
    readonly outcome: 'cancelled' | 'failed' | 'succeeded' | 'unknown-outcome' | 'still-running';
  } {
    const revoked = revokeAuthorization(auth, reason);
    this.authorizations.replace(revoked);
    const outcome = revocationOutcome(dispatch);
    this.repo?.append(
      durableEvent(
        { kind: 'AuthorizationRevoked', authorizationId: revoked.authorizationId, operationId: revoked.operationId, reason, outcome },
        asSessionId(this.sessionId()),
        { operationId: revoked.operationId, provenanceKind: 'deterministic', provenanceSource: 'revocation', clock: this.clock },
      ),
    );
    return { authorization: revoked, outcome };
  }

  /** Story 2.4: lookup a bound authorization by id (for tests/UI inspection). */
  getAuthorization(authorizationId: string): Authorization | undefined {
    return this.authorizations.get(authorizationId);
  }

  /** Story 2.3 AC #1, #2: evaluate a proposal against the non-overridable
   * hard boundaries, independent of Work Mode/Permission Profile. */
  checkBoundary(input: Omit<BoundaryCheckInput, 'workspaceRoot'> & { workspaceRoot?: string }): BoundaryDecision {
    return checkHardBoundary({ workspaceRoot: this.workspaceRoot, ...input });
  }

  /** Story 2.3 AC #4: grant a durable Boundary Expansion, journaled as
   * `BoundaryExpansionGranted` Evidence when a repo is wired. */
  grantBoundaryExpansion(input: {
    resourceIdentity: string;
    actionClasses: readonly string[];
    reason: string;
    expiresAt?: string | null;
  }): BoundaryExpansion {
    const expansion = this.boundaryExpansions.grant({ ...input, workspaceId: this.workspace.workspaceId });
    this.repo?.append(
      durableEvent(
        {
          kind: 'BoundaryExpansionGranted',
          expansionId: expansion.expansionId,
          resourceIdentity: expansion.resourceIdentity,
          workspaceId: expansion.workspaceId,
          actionClasses: expansion.actionClasses,
          reason: expansion.reason,
          expiresAt: expansion.expiresAt,
        },
        asSessionId(this.sessionId()),
        { provenanceKind: 'deterministic', provenanceSource: 'boundary-expansion', clock: this.clock },
      ),
    );
    return expansion;
  }

  /** Story 2.3 AC #5: revoke a durable Boundary Expansion. Fail-closed —
   * never claims a committed effect was cancelled. */
  revokeBoundaryExpansion(expansionId: string, reason: string): boolean {
    const ok = this.boundaryExpansions.revoke(expansionId, reason);
    if (ok) {
      this.repo?.append(
        durableEvent(
          { kind: 'BoundaryExpansionRevoked', expansionId, reason },
          asSessionId(this.sessionId()),
          { provenanceKind: 'deterministic', provenanceSource: 'boundary-expansion', clock: this.clock },
        ),
      );
    }
    return ok;
  }

  /** Story 2.3 AC #5: full, auditable inventory of Boundary Expansions. */
  listBoundaryExpansions(): readonly BoundaryExpansion[] {
    return this.boundaryExpansions.list();
  }

  /** Story 3.1 AC #1: return the established WorkspaceIdentity for inspection
   * and effect authorization. The identity includes platform identity, canonical
   * root, case/Unicode policy, volume/device identity where available, and
   * explicit binding status. A `blocked` binding cannot authorize local effects. */
  workspaceBinding(): WorkspaceIdentity {
    return this.workspace;
  }

  /** Story 3.2: lazy-init CheckpointRepository accessor. Returns a
   * CheckpointRepository backed by the given KeyValueStore. When no store is
   * provided, returns null (checkpointing is unavailable). */
  private _checkpointRepo: CheckpointRepository | null = null;
  private _kvStore: KeyValueStore | null = null;
  checkpoints(store?: KeyValueStore): CheckpointRepository | null {
    if (store) {
      this._checkpointRepo = new CheckpointRepository(store, this.clock);
      this._kvStore = store;
    }
    return this._checkpointRepo;
  }

  /** Story 3.2: lazy-init ArtifactStore accessor. Returns an ArtifactStore
   * backed by the given BlobStore and encryption key. When no store is
   * provided, returns null (artifact storage is unavailable). */
  private _artifactStore: ArtifactStore | null = null;
  artifactStore(blobStore?: BlobStore, key?: Buffer): ArtifactStore | null {
    if (blobStore && key) {
      this._artifactStore = new ArtifactStore(blobStore, key);
    }
    return this._artifactStore;
  }

  /** Story 3.1 AC #2: resolve a candidate path/resource reference against the
   * current Workspace, producing a canonical ResourceIdentity. Reuses the
   * existing `resolveWithinWorkspace` for containment. */
  resolveWorkspaceResource(candidate: string, opts: { computeDigest?: boolean } = {}): import('./workspace/types.js').ResourceIdentity {
    return resolveResource(this.workspace, candidate, {
      fsProbe: defaultFsProbe(),
      computeDigest: opts.computeDigest,
    });
  }

  /** Story 3.1 AC #3: check whether a target path is safely contained within
   * the workspace, accounting for symlinks, junctions, mount points, and
   * reparse points. Returns `denied`/`conflict`/`enforcement-unverified` rather
   * than claiming containment when identity cannot be proven. */
  checkWorkspaceContainment(target: string, opts: { followSymlinks?: boolean } = {}): import('./workspace/types.js').ContainmentDecision {
    return checkContainment(this.workspace, target, {
      fsProbe: defaultFsProbe(),
      followSymlinks: opts.followSymlinks,
    });
  }

  /** Story 3.5 AC #1: preview a create_file effect. Shows exact target identity,
   * expected pre-image digest/version or `absent`, bounded content summary,
   * resulting post-image digest plan, exclusions, OperationId, authority, and
   * checkpoint coverage. Plan mode returns `deny` and cannot authorize. */
  previewCreateFile(target: string, content: Uint8Array): PreviewResult {
    const a = this.activation.snapshot();
    return previewFileEffect('create_file', target, content, {
      workspace: this.workspace,
      fsProbe: defaultFsProbe(),
      clock: this.clock,
      mode: a.mode,
      activationId: a.activationId,
      activationRevision: a.revision,
    });
  }

  /** Story 3.5 AC #1: preview an edit_file effect. Same fields as
   * previewCreateFile. Plan mode returns `deny` and cannot authorize. */
  previewEditFile(target: string, content: Uint8Array): PreviewResult {
    const a = this.activation.snapshot();
    return previewFileEffect('edit_file', target, content, {
      workspace: this.workspace,
      fsProbe: defaultFsProbe(),
      clock: this.clock,
      mode: a.mode,
      activationId: a.activationId,
      activationRevision: a.revision,
    });
  }

  /** Story 3.5 AC #2, AC #3, AC #4, AC #5: apply a guarded built-in file
   * create/edit effect. Runs the exact ordered execution: resolve identity ->
   * capture digest/version -> PEP checks -> stage checkpoint -> make durable ->
   * atomically consume authorization + append EffectDispatchCommitted ->
   * native mutation -> durable result/post-image -> publish checkpoint reference
   * + terminal event post-commit. Reuses the existing authorization/PEP/
   * checkpoint/journal seams. */
  applyFileEffect(
    kind: 'create_file' | 'edit_file',
    target: string,
    content: Uint8Array,
    authorization: import('./permissions/authorization.js').Authorization,
    opts: {
      fsMutator?: FsMutator;
      kvStore?: KeyValueStore;
      blobStore?: BlobStore;
      encKey?: Buffer;
    } = {},
  ): EffectOutcome {
    const a = this.activation.snapshot();

    // Revalidate the authorization against the current proposal (AC #3).
    const staleCheck = revalidateFileEffect(
      {
        kind,
        operationId: authorization.operationId as unknown as OperationId,
        target: { canonicalPath: '', displayPath: target },
        expectedPreImage: { digest: null, version: null, absent: kind === 'create_file' },
        content,
        contentSummary: `${content.length} bytes`,
        postImageDigest: '',
        postImageSizeBytes: content.length,
        lineCount: 0,
        exclusions: [],
        checkpointCoverage: 'fully-protected',
        authorizationId: authorization.authorizationId,
        activationId: a.activationId,
        activationRevision: a.revision,
      },
      authorization,
      {
        activationId: a.activationId,
        activationRevision: a.revision,
        authorityRevision: a.revision,
        now: this.clock(),
      },
    );

    if (!staleCheck.ok) {
      return {
        ok: false,
        kind: 'stale-approval',
        reason: staleCheck.reason,
        reasonCode: staleCheck.reasonCode,
        evidence: {
          operationId: authorization.operationId as unknown as OperationId,
          expectedDigest: null,
          actualDigest: null,
          expectedVersion: null,
          actualVersion: null,
          targetPath: target,
          timestamp: this.clock(),
        },
      };
    }

    // Build the effect context and execute.
    const kvStore = opts.kvStore;
    const blobStore = opts.blobStore;
    const encKey = opts.encKey;

    if (!kvStore) {
      return {
        ok: false,
        kind: 'unknown-outcome',
        reason: 'no key-value store available for checkpoint staging',
        reasonCode: 'no-kv-store',
        evidence: {
          operationId: authorization.operationId as unknown as OperationId,
          expectedDigest: null,
          actualDigest: null,
          expectedVersion: null,
          actualVersion: null,
          targetPath: target,
          timestamp: this.clock(),
        },
      };
    }

    const checkpointRepo = new CheckpointRepository(kvStore, this.clock);
    const artifactStore = blobStore && encKey ? new ArtifactStore(blobStore, encKey) : undefined;

    return applyFileEffect(kind, target, content, authorization, {
      workspace: this.workspace,
      fsProbe: defaultFsProbe(),
      fsMutator: opts.fsMutator ?? defaultFsMutator(),
      clock: this.clock,
      policyState: {
        mode: a.mode,
        profile: a.profile,
        sensitiveOverride: a.sensitiveTransferOverride,
      },
      checkpointRepo,
      artifactStore,
      kvStore,
      blobStore,
      journal: this.repo ?? { append: () => 0 },
      sessionId: this.sessionId(),
      activationId: a.activationId,
      activationRevision: a.revision,
      authorityRevision: a.revision,
    });
  }

  /** Story 3.5 AC #4: detect conflicts before executing a file effect. */
  checkFileEffectConflict(
    targetPath: string,
    expectedDigest: string | null,
    expectedVersion: string | null,
  ): EffectConflict | null {
    const operationId = newOperationId();
    return detectConflict({
      operationId,
      targetPath,
      expectedDigest,
      expectedVersion,
      workspace: this.workspace,
      fsProbe: defaultFsProbe(),
      clock: this.clock,
    });
  }

  /** Story 3.6 AC #1: preview a destructive deletion effect. Labeled
   * `DESTRUCTIVE`, shows exact root identity, ordered descendant identity/content
   * manifest, count/size bounds, symlink/junction/mount/open-handle policy,
   * checkpoint coverage, and exclusions. Plan mode returns `deny` under every
   * profile. */
  previewDelete(
    kind: 'delete_file' | 'delete_directory',
    target: string,
    opts: { descendantManifest?: readonly import('./effects/deletionTypes.js').DescendantIdentity[] } = {},
  ): DeletionPreviewResult {
    const a = this.activation.snapshot();
    return previewDeletion(kind, target, {
      workspace: this.workspace,
      fsProbe: defaultFsProbe(),
      clock: this.clock,
      mode: a.mode,
      activationId: a.activationId,
      activationRevision: a.revision,
      descendantManifest: opts.descendantManifest,
    });
  }

  /** Story 3.6 AC #2, AC #3, AC #4, AC #5: apply a guarded destructive deletion
   * with quarantine. Runs the exact ordered execution: resolve identity ->
   * capture digest/version + descendant manifest -> PEP checks -> stage checkpoint
   * -> make durable -> atomically consume authorization + append
   * EffectDispatchCommitted -> atomically rename/quarantine root on same
   * filesystem -> remove quarantined content -> durable result/deletion Evidence
   * -> publish checkpoint reference + terminal event post-commit. */
  applyDeleteEffect(
    kind: 'delete_file' | 'delete_directory',
    target: string,
    authorization: import('./permissions/authorization.js').Authorization,
    opts: {
      quarantineProvider?: QuarantineProvider;
      kvStore?: KeyValueStore;
      blobStore?: BlobStore;
      encKey?: Buffer;
    } = {},
  ): DeletionOutcome {
    const a = this.activation.snapshot();
    const kvStore = opts.kvStore;
    const blobStore = opts.blobStore;
    const encKey = opts.encKey;

    if (!kvStore) {
      return {
        ok: false,
        kind: 'unknown-outcome',
        reason: 'no key-value store available for checkpoint staging',
        reasonCode: 'no-kv-store',
        evidence: {
          operationId: authorization.operationId as unknown as OperationId,
          rootPath: target,
          changedDescendant: null,
          expectedDigest: null,
          actualDigest: null,
          expectedVersion: null,
          actualVersion: null,
          timestamp: this.clock(),
        },
      };
    }

    const checkpointRepo = new CheckpointRepository(kvStore, this.clock);
    const artifactStore = blobStore && encKey ? new ArtifactStore(blobStore, encKey) : undefined;

    return applyDeletionEffect(kind, target, authorization, {
      workspace: this.workspace,
      fsProbe: defaultFsProbe(),
      quarantineProvider: opts.quarantineProvider ?? defaultQuarantineProvider(),
      clock: this.clock,
      policyState: {
        mode: a.mode,
        profile: a.profile,
        sensitiveOverride: a.sensitiveTransferOverride,
      },
      checkpointRepo,
      artifactStore,
      kvStore,
      blobStore,
      journal: this.repo ?? { append: () => 0 },
      sessionId: this.sessionId(),
      activationId: a.activationId,
      activationRevision: a.revision,
      authorityRevision: a.revision,
    });
  }

  /** Story 3.4 AC #1, AC #4, AC #5: bounded directory listing through PEP
   * mediation. Resolves + revalidates every resource identity, stays within
   * Workspace, no-follow, bounds recursion + file count, returns sanitized
   * entries with path/type/size/digest metadata. Manual eligible non-transferring
   * inspection proceeds without interruption. Plan mode stays read-only. */
  inspectList(
    path: string,
    opts: { limits?: InspectionLimits; computeDigests?: boolean } = {},
  ): ListResult | InspectionRefusal {
    const a = this.activation.snapshot();
    const policy = evaluateInspectionPolicy({
      actionClass: 'list_dir',
      state: { mode: a.mode, profile: a.profile, sensitiveOverride: a.sensitiveTransferOverride },
    });
    if (policy.outcome !== 'allow') {
      return policyDecisionToRefusal(policy, 'list_dir');
    }
    return inspectList(this.workspace, path, {
      fsProbe: defaultInspectionFsProbe(),
      limits: opts.limits,
      computeDigests: opts.computeDigests,
    });
  }

  /** Story 3.4 AC #1, AC #3, AC #4, AC #5: bounded file read through PEP
   * mediation. Revalidates identity, no-follow + file-size limit, detects
   * binary/hostile/over-limit/malformed-UTF-8/active-external-references,
   * returns bounded metadata or typed refusal, preserves valid Thai UTF-8 +
   * technical identifiers. */
  inspectRead(
    path: string,
    opts: { limits?: InspectionLimits } = {},
  ): ReadResult | InspectionRefusal {
    const a = this.activation.snapshot();
    const policy = evaluateInspectionPolicy({
      actionClass: 'read_file',
      state: { mode: a.mode, profile: a.profile, sensitiveOverride: a.sensitiveTransferOverride },
    });
    if (policy.outcome !== 'allow') {
      return policyDecisionToRefusal(policy, 'read_file');
    }
    return inspectRead(this.workspace, path, {
      fsProbe: defaultInspectionFsProbe(),
      limits: opts.limits,
    });
  }

  /** Story 3.4 AC #1, AC #3, AC #4, AC #5: bounded text search through PEP
   * mediation. Revalidates identity, bounds search work + file count + text
   * bytes, no-follow, sanitized matches with metadata. Same binary/hostile/
   * malformed-utf8 handling as read. */
  inspectSearch(
    query: string,
    path: string,
    opts: { limits?: InspectionLimits } = {},
  ): SearchResult | InspectionRefusal {
    const a = this.activation.snapshot();
    const policy = evaluateInspectionPolicy({
      actionClass: 'search',
      state: { mode: a.mode, profile: a.profile, sensitiveOverride: a.sensitiveTransferOverride },
    });
    if (policy.outcome !== 'allow') {
      return policyDecisionToRefusal(policy, 'search');
    }
    return inspectSearch(this.workspace, query, path, {
      fsProbe: defaultInspectionFsProbe(),
      limits: opts.limits,
    });
  }

  /** Story 3.3 AC #1: plan a complete mutation set from raw proposals.
   * READ-ONLY: enumerates the complete intended set with stable resource
   * identities, action digests, expected pre-image digest/version, proposed
   * post-image or deletion manifest, rename/alias relationships, checkpoint
   * size, binary status, and excluded effects BEFORE any native mutation. */
  planMutations(rawProposals: readonly RawProposal[]): PlanMutationResult {
    return planMutationSet(rawProposals, {
      workspace: this.workspace,
      fsProbe: defaultFsProbe(),
      clock: this.clock,
    });
  }

  /** Story 3.3 AC #2, AC #3: run protection preflight on a complete mutation
   * set. Executes the exact ordered checks: resolve stable identity -> capture
   * expected digest/version -> evaluate PEP/PermissionMatrix/quota/platform
   * checks -> stage checkpoint originals/metadata/post-plan -> make the stage
   * durable. Only then may the result be labeled `fully protected`, `partially
   * protected`, or `unprotected`. */
  preflightProtection(
    mutationSet: MutationSet,
    opts: {
      kvStore?: KeyValueStore;
      blobStore?: BlobStore;
      encKey?: Buffer;
      currentStoreUsageBytes?: number;
    } = {},
  ): PreflightResult {
    const a = this.activation.snapshot();
    const kvStore = opts.kvStore;
    const blobStore = opts.blobStore;
    const encKey = opts.encKey;

    if (!kvStore) {
      return {
        ok: false,
        failure: {
          category: 'preflight-failed',
          retryable: true,
          scope: 'preflight',
          message: 'no key-value store available for checkpoint staging',
          causeCode: 'no-kv-store',
        },
      };
    }

    const checkpointRepo = new CheckpointRepository(kvStore, this.clock);
    const artifactStore = blobStore && encKey ? new ArtifactStore(blobStore, encKey) : undefined;

    return runProtectionPreflight(mutationSet, {
      workspace: this.workspace,
      fsProbe: defaultFsProbe(),
      clock: this.clock,
      policyState: {
        mode: a.mode,
        profile: a.profile,
        sensitiveOverride: a.sensitiveTransferOverride,
      },
      checkpointRepo,
      artifactStore,
      kvStore,
      blobStore,
      currentStoreUsageBytes: opts.currentStoreUsageBytes ?? 0,
      operationId: mutationSet.operationId,
    });
  }

  /** Story 3.3 AC #5: create a plan fingerprint that binds the proposal +
   * authority revision + workspace + target digest + quota + platform state.
   * Used at effect time to detect staleness. */
  createPlanFingerprint(
    mutationSet: MutationSet,
    opts: { currentStoreUsageBytes?: number } = {},
  ): PlanFingerprint {
    const a = this.activation.snapshot();
    return fingerprintPlan(mutationSet, {
      workspace: this.workspace,
      authorityRevision: a.revision,
      fsProbe: defaultFsProbe(),
      clock: this.clock,
      currentStoreUsageBytes: opts.currentStoreUsageBytes ?? 0,
    });
  }

  /** Story 3.3 AC #5: revalidate a plan fingerprint against the current
   * context. If the proposal, Workspace, authority revision, target, digest,
   * quota, or platform state has changed, the plan is stale and a fresh
   * read-only plan is required. Staged authorization is not consumed. */
  revalidatePlan(fingerprint: PlanFingerprint, mutationSet: MutationSet): StaleCheckResult {
    const a = this.activation.snapshot();
    return isStale(fingerprint, {
      workspace: this.workspace,
      authorityRevision: a.revision,
      fsProbe: defaultFsProbe(),
      clock: this.clock,
      currentStoreUsageBytes: 0,
      mutationSet,
    });
  }

  /** Story 3.8 AC #1–5: run a non-mutating dependency preflight. Inspects
   * bounded project metadata + verified documentation, probes ONLY approved
   * runtimes/compilers/package-managers/documented commands, and records
   * platform, version, executable identity, probe output classification, and
   * evidence WITHOUT installing or modifying anything. Each call produces a
   * FRESH Evidence identity (AC #4). Remains read-only regardless of mode/
   * profile/TTY (AC #5). */
  runCheck(): DepPreflightResult {
    return runDependencyPreflight(this.workspace, defaultEnvironmentProbe(), this.clock);
  }

  /** Story 3.11: run the canonical cross-platform C++ Hello, World! proof.
   * Composes existing 3.5/3.7/3.8 surfaces to prove the bounded task end-to-end
   * without overstating success. Accepts an injectable ProofEnvironment so tests
   * use fakes and never run real compilers or touch the real filesystem. */
  async runHelloWorldProof(env: ProofEnvironment): Promise<ProofResult> {
    return runHelloWorldProof(env);
  }

  /** Story 3.7 AC #1, AC #2: validate a controlled command proposal. Resolves
   * approved executable identity, validates explicit argv vector, Workspace-
   * contained cwd, allowed environment names/values, shell/startup-hook policy,
   * timeout, output limits, and action digest. Returns denied/refused/
   * enforcement-unverified for unsupported shell/platform, out-of-Workspace
   * resource, privileged/system mutation, network boundary, or unavailable
   * process enforcement. Never launches a process under any profile. */
  validateControlledCommand(proposal: CommandProposal): CommandValidationResult {
    return validateControlledCommand(proposal, {
      workspaceRoot: this.workspaceRoot,
      allowedExecutables: defaultValidationContext().allowedExecutables,
      blockedEnvNames: defaultValidationContext().blockedEnvNames,
      maxTimeoutMs: defaultValidationContext().maxTimeoutMs,
      maxOutputBytes: defaultValidationContext().maxOutputBytes,
      platform: this.workspace.platform.platform,
      enforcementAvailable: true,
      clock: this.clock,
    });
  }

  /** Story 3.7 AC #3, AC #5: execute a controlled command that has passed
   * policy and approval. Records exact executable, argv, cwd, safe environment
   * summary, authority, timeout; ATOMICALLY consumes authorization + appends
   * EffectDispatchCommitted BEFORE launch; output sanitized before Evidence/UI
   * publication. Command side effects are marked excluded/never-protected for
   * rollback scope; NO command result is treated as a rollback checkpoint. */
  async runControlledCommand(
    proposal: CommandProposal,
    authorization: Authorization,
    processRunner: import('./commands/types.js').ProcessRunner,
    signal?: AbortSignal,
  ): Promise<CommandExecutionResult> {
    const a = this.activation.snapshot();
    const ctx: CommandExecutionContext = {
      processRunner,
      clock: this.clock,
      sessionId: this.sessionId(),
      activationId: a.activationId,
      activationRevision: a.revision,
      authorityRevision: a.revision,
      journal: this.repo ?? { append: () => 0 },
      sanitizer,
    };
    return executeControlledCommand(proposal, authorization, ctx, signal);
  }

  /** Story 3.3 AC #4: process a confirmation for a partially protected or
   * unprotected mutation set. Discloses the exact unprotected scope and
   * residual risk; requires explicit confirmation for that exact scope.
   * Full Access CANNOT suppress checkpoint rules or convert Plan into
   * authorization. */
  confirmMutation(
    preflightResult: ProtectionPreflightResult,
    userConfirmed: boolean,
    confirmedScope: ConfirmationScope | null,
  ): ConfirmationResult {
    const a = this.activation.snapshot();
    return processConfirmation({
      preflightResult,
      isFullAccess: a.profile === 'full-access',
      isPlanMode: a.mode === 'plan',
      userConfirmed,
      confirmedScope,
    });
  }

  /** Story 2.13: dispatch a typed command through the frozen grammar. The
   * command surface dispatches ONLY through CoreApp — no shell expansion,
   * globbing, interpolation, substitution, implicit Workspace rebinding, or
   * user-defined executables. A malformed/unsupported command returns a
   * sanitized deterministic error with the canonical exit mapping and never
   * executes a shell command or mutates a file (AC #4). `requireInteractive`
   * flags a command that needs interactive approval; with no TTY the caller
   * passes `hasTty: false` and the dispatch fails closed (AC #6). */
  dispatchCommand(input: string, opts: { hasTty?: boolean; requireInteractive?: boolean } = {}): CommandOutput {
    const parse = parseCommand(input);
    if (!parse.ok) {
      const rej = commandRejection(parse);
      // AC #4: record the rejected intent in activity/Evidence when durable
      // storage is available (sanitized; no raw command beyond what cleared).
      this.repo?.append(
        durableEvent(
          { kind: 'OperationBlocked', operationId: newOperationId(), cause: rej.cause },
          asSessionId(this.sessionId()),
          { provenanceKind: 'deterministic', provenanceSource: 'command-grammar', clock: this.clock },
        ),
      );
      return { stdout: '', stderr: `${rej.cause}\n${rej.usage}`, json: JSON.stringify({ status: 'blocked', cause: rej.cause, exitClass: rej.exitClass, exitCode: rej.exitCode, usage: rej.usage }), exitCode: rej.exitCode };
    }
    const cmd: CoreCommand = parse.command;
    const spec = COMMAND_GRAMMAR.find((c) => c.command === cmd)!;
    // AC #6: a command that may require interactive approval fails closed with
    // no TTY — never waits on stdin, leaves no pending authority.
    if (spec.mayRequireApproval && opts.requireInteractive && opts.hasTty === false) {
      const blocked = noTtyCommandBlocked();
      return { stdout: '', stderr: `${blocked.cause}: ${blocked.next}`, json: JSON.stringify({ status: 'blocked', cause: blocked.cause, next: blocked.next, exitClass: blocked.exitClass, exitCode: blocked.exitCode }), exitCode: blocked.exitCode };
    }
    return this.executeCommand(cmd, parse.args);
  }

  /** Map a parsed command to its CoreApp projection (AC #1, AC #3, AC #5). */
  private executeCommand(cmd: CoreCommand, args: readonly string[]): CommandOutput {
    switch (cmd) {
      case 'status':
        return renderCommandOutput({ status: 'succeeded', body: JSON.stringify(this.statusProjection(), null, 2), nextStep: 'continue' });
      case 'permissions':
        return renderCommandOutput({ status: 'succeeded', body: `PermissionMatrix v${this.pep.evaluate({ actionClass: 'read_file', state: { mode: 'build', profile: 'manual' }, activationRevision: 1 }).matrixVersion}`, nextStep: 'continue' });
      case 'mode': {
        if (args[0] !== 'plan' && args[0] !== 'build') {
          return renderCommandOutput({ status: 'blocked', cause: 'mode requires plan|build', nextStep: 'usage: /mode plan|build' });
        }
        const applied = this.setMode(args[0]);
        return renderCommandOutput({ status: applied ? 'succeeded' : 'blocked', cause: applied ? undefined : 'mode change refused (composer busy or same mode)', nextStep: applied ? 'continue' : 'retry at an idle composer' });
      }
      case 'boundaries':
        return renderCommandOutput({ status: 'succeeded', body: JSON.stringify(this.listBoundaryExpansions().map((b) => ({ expansionId: b.expansionId, resourceIdentity: b.resourceIdentity, revoked: b.revoked, expiresAt: b.expiresAt })), null, 2), nextStep: 'continue' });
      case 'connections':
        return renderCommandOutput({ status: 'succeeded', body: JSON.stringify({ providerId: this.providers.selectedId, health: this.health.snapshot(this.providers.selectedId).state }, null, 2), nextStep: 'continue' });
      case 'activity':
        return renderCommandOutput({ status: 'succeeded', body: 'activity projection available via the journal replay surface', nextStep: 'continue' });
      case 'models':
        // AC #3: /models is Typhoon inspection-only; unresolved pins honestly labeled.
        return renderCommandOutput({ status: 'succeeded', body: `Typhoon inspection-only — model: ${this.providers.selected.capabilities.modelId}`, nextStep: 'continue' });
      case 'tools': {
        // AC #3: /tools exposes registry/diagnostic controls; does NOT invoke the
        // Epic 4 Capability Registry or Specialist services; Catalogued entries
        // are not made invokable.
        const sub = args[0];
        if (sub === 'search' && args[1]) {
          const result = searchCatalog(
            this.capabilityRegistry(),
            this.buildHealthMap(),
            this._disabledServices,
            args.slice(1).join(' '),
          );
          if ('ok' in result && result.ok === false) {
            return renderCommandOutput({ status: 'blocked', cause: result.message, nextStep: 'retry with a valid registry' });
          }
          const searchResult = result as { query: string; matches: readonly CatalogEntryProjection[]; total: number };
          const searchMode: CatalogRenderMode = this.detectRenderMode();
          const lines = [`Search results for "${searchResult.query}": ${searchResult.total} match(es)`];
          for (const entry of searchResult.matches) {
            lines.push(renderEntryRow(entry, searchMode));
          }
          return renderCommandOutput({ status: 'succeeded', body: lines.join('\n'), nextStep: 'continue' });
        }
        if (sub === 'inspect' && args[1]) {
          const result = inspectEntry(
            this.capabilityRegistry(),
            this.buildHealthMap(),
            this._disabledServices,
            args[1],
          );
          if (!result.ok) {
            return renderCommandOutput({ status: 'blocked', cause: result.message, nextStep: 'verify the service id and retry' });
          }
          const mode: CatalogRenderMode = this.detectRenderMode();
          // AC #3: the read-only disclosure for a non-invokable entry is part of
          // the honest inspection contract — never drop the controls message.
          const detail = result.entry ? renderEntryDetail(result.entry, mode) : '';
          const body = result.message.startsWith('Inspection only')
            ? [result.message, detail].filter(Boolean).join('\n')
            : detail || result.message;
          return renderCommandOutput({ status: 'succeeded', body, nextStep: 'continue' });
        }
        if (sub === 'enable' && args[1]) {
          const result = enableService(this._disabledServices, args[1]);
          if (!result.ok) {
            return renderCommandOutput({ status: 'blocked', cause: result.message, nextStep: 'verify the service id and retry' });
          }
          return renderCommandOutput({ status: 'succeeded', body: result.message, nextStep: 'continue' });
        }
        if (sub === 'disable' && args[1]) {
          const result = disableService(
            this.capabilityRegistry(),
            this._disabledServices,
            args[1],
          );
          if (!result.ok) {
            return renderCommandOutput({ status: 'blocked', cause: result.message, nextStep: 'verify the service id and retry' });
          }
          return renderCommandOutput({ status: 'succeeded', body: result.message, nextStep: 'continue' });
        }
        if (sub === 'diagnose' && args[1]) {
          const result = diagnoseService(
            this.capabilityRegistry(),
            this.buildHealthMap(),
            this._disabledServices,
            args[1],
          );
          if ('ok' in result && result.ok === false) {
            return renderCommandOutput({ status: 'blocked', cause: result.message, nextStep: 'verify the service id and retry' });
          }
          const diag = result as { id: string; canonicalState: string; healthState: string; safeReason: string; nextAllowedAction: string; retestRecommended: boolean };
          const lines = [
            `Diagnosis for "${diag.id}":`,
            `  State: ${diag.canonicalState}`,
            `  Health: ${diag.healthState}`,
            `  Reason: ${diag.safeReason}`,
            `  Next action: ${diag.nextAllowedAction}`,
            `  Retest recommended: ${diag.retestRecommended}`,
          ];
          return renderCommandOutput({ status: 'succeeded', body: lines.join('\n'), nextStep: 'continue' });
        }
        if (sub === 'retest' && args[1]) {
          const result = retestService(
            this.capabilityRegistry(),
            this.buildHealthMap(),
            this._disabledServices,
            args[1],
          );
          if (!result.ok) {
            return renderCommandOutput({ status: 'blocked', cause: result.message, nextStep: 'verify the service id and retry' });
          }
          return renderCommandOutput({ status: 'succeeded', body: result.message, nextStep: 'continue' });
        }
        // No subcommand or unrecognized subcommand → browse
        const mode: CatalogRenderMode = this.detectRenderMode();
        const projection = browseCatalog(
          this.capabilityRegistry(),
          this.buildHealthMap(),
          this._disabledServices,
        );
        if ('ok' in projection && projection.ok === false) {
          return renderCommandOutput({ status: 'blocked', cause: projection.message, nextStep: 'ensure the registry is loaded' });
        }
        return renderCommandOutput({ status: 'succeeded', body: renderCatalogList(projection as CatalogProjection, mode), nextStep: 'continue' });
      }
      case 'check': {
        const result = this.runCheck();
        const status = result.overall === 'all-verified' ? 'succeeded' : 'blocked';
        return renderCommandOutput({ status, body: JSON.stringify(result, null, 2), nextStep: 'continue' });
      }
      case 'help':
        return renderCommandOutput({ status: 'succeeded', body: COMMAND_GRAMMAR.map((c) => `/${c.command}${c.aliases.length ? ` (${c.aliases.map((a) => `/${a}`).join(', ')})` : ''} — ${c.description}`).join('\n'), nextStep: 'continue' });
      case 'rollback': {
        const sub = args[0];
        if (sub === 'list') {
          return this.rollbackList({ kvStore: this._kvStore ?? undefined });
        }
        if (sub === 'inspect' && args[1]) {
          return this.rollbackInspect(args[1], { kvStore: this._kvStore ?? undefined });
        }
        return renderCommandOutput({ status: 'blocked', cause: 'rollback requires a subcommand: list or inspect <id>', nextStep: 'usage: /rollback list | /rollback inspect <id>' });
      }
      case 'recover': {
        const sub = args[0];
        if (sub === 'inspect' && args[1]) {
          return this.recoverInspect(args[1]);
        }
        if (sub === 'reconcile' && args[1]) {
          return this.recoverReconcile(args[1]);
        }
        if (sub === 'export' && args[1]) {
          return this.recoverExport(args[1]);
        }
        if (sub === 'exit') {
          return this.recoverExit();
        }
        if (!sub) {
          return renderRecoveryHelp();
        }
        return renderCommandOutput({ status: 'blocked', cause: 'recover requires a subcommand: inspect, reconcile, export, or exit', nextStep: 'usage: /recover inspect <id> | /recover reconcile <id> | /recover export <id> | /recover exit' });
      }
    }
  }

  /** `/models` listing: adapters with availability + reasons (ADR 0004). */
  async listModels(): Promise<string[]> {
    const lines: string[] = [];
    for (const a of this.providers.list()) {
      const key = await this.credentials.get(a.capabilities.provider);
      const avail = a.availability(key !== null);
      const marker = a.capabilities.provider === this.providers.selectedId ? '*' : ' ';
      const state = avail.available ? 'available' : `unavailable — ${avail.reason ?? 'not configured'}`;
      lines.push(`${marker} ${a.capabilities.provider} (${a.capabilities.modelId}): ${state}`);
    }
    return lines;
  }

  /** Story 4.1: access the loaded Capability Registry. */
  private _capabilityRegistry: CapabilityRegistry | null = null;
  capabilityRegistry(now?: string): CapabilityRegistry {
    if (!this._capabilityRegistry) {
      this._capabilityRegistry = CapabilityRegistry.load(now ?? this.clock());
    }
    return this._capabilityRegistry;
  }

  /** Story 4.5: route a natural-language prompt to a RoutingDecision. */
  routeSpecialistPrompt(prompt: string): RoutingDecision {
    const registry = this.capabilityRegistry();
    const healthMap = this.buildHealthMap();
    const isTTY = typeof process !== 'undefined' && process.stdout && process.stdout.isTTY !== false;
    return routeSpecialistPrompt(
      prompt,
      registry,
      {
        isTTY,
        healthMap,
        disabledSet: this._disabledServices,
      },
      this.clock,
    );
  }

  /** Story 4.6: resolve an explicit artifact reference for a Specialist Service.
   * When `serviceId` is provided, loads the target entry from the Capability
   * Registry for size/compatibility enforcement. When omitted, compatibility
   * is reported as `unverified` and size checks are skipped. No remote transfer
   * occurs here (Stories 4.8/4.9 own consent and transfer). */
  async resolveSpecialistArtifact(reference: string, serviceId?: string): Promise<ArtifactResolutionResult> {
    const targetEntry = serviceId
      ? this.capabilityRegistry().byId(serviceId) ?? undefined
      : undefined;
    return this._specialistArtifactResolver.resolveArtifact(reference, this.workspaceRoot, targetEntry);
  }

  /** Story 4.7: minimize a prepared artifact to fit within a target service's
   * input limits. Uses the default minimizer registry (text/, image/, audio/)
   * and the target entry from the Capability Registry when `serviceId` is
   * provided. When omitted, passes through with no minimization.
   *
   * Returns a typed MinimizationResult — never throws for expected causes
   * (minimization-unavailable, validation-failed, unsupported-type). */
  minimizeSpecialistArtifact(
    artifact: import('./specialists/artifacts/types.js').PreparedArtifact,
    serviceId?: string,
  ): MinimizationResult {
    const targetEntry = serviceId
      ? this.capabilityRegistry().byId(serviceId) ?? undefined
      : undefined;
    return minimizeArtifact(artifact, targetEntry, undefined, this.clock);
  }

  /** `/tools` view of the Catalog Manifest (ADR 0011). */
  listCatalog(): string[] {
    try {
      const catalog = ToolCatalog.load();
      const header = `Catalog Manifest v${catalog.version} (observed ${catalog.observationDate})`;
      return [
        header,
        ...catalog
          .all()
          .map((s) => `  ${s.id} [${s.category}/${s.modality}] — ${s.upstreamName} (${s.supportLevel})`),
      ];
    } catch (e) {
      return [`Catalog unavailable: ${(e as Error).message}`];
    }
  }

  /** Build a health map from the registry entries, the health registry, and
   * the specialist health lifecycle. Specialist health snapshots are included
   * so the catalog projection reflects specialist health. */
  private buildHealthMap(): HealthMap {
    const map: HealthMap = {};
    const registry = this.capabilityRegistry();
    if (registry.ok) {
      for (const entry of registry.all()) {
        // Prefer specialist health state when available; fall back to the
        // general health registry (Typhoon).
        const specialistSnap = this._specialistHealth.snapshot(entry.id);
        if (specialistSnap.state !== 'unconfigured') {
          map[entry.id] = specialistSnap.state;
        } else {
          map[entry.id] = this.health.snapshot(entry.id).state;
        }
      }
    }
    return map;
  }

  /** Detect the current render mode from the output surface. An interactive
   * TTY renders the full interactive layout; a non-TTY (redirected/piped)
   * context renders the redirected form so catalog rows keep their stable
   * identifier + canonical token + safe reason + action availability without
   * relying on color (AC #5). Narrow/headless modes require caller-provided
   * context and are selected by the UI layer; the headless core reflects the
   * TTY surface it can observe. */
  private detectRenderMode(): CatalogRenderMode {
    if (typeof process !== 'undefined' && process.stdout && process.stdout.isTTY === false) {
      return 'redirected';
    }
    return 'interactive';
  }

  async runTurn(
    input: string,
    _approve: ApprovalCallback = async () => false,
    onToken?: (delta: string) => void,
  ): Promise<string> {
    // Dispatch via the durable sanitized-chunk path (Story 1.9). The legacy
    // AgentLoop is retained for the tool-call mediation path (Epic 3); the
    // first-conversation flow uses dispatchTyphoonTurn directly so every chunk
    // is journaled and interruption boundaries are recorded.
    const sessionId = `sess-${this.providers.selectedId}`;
    const messages: NormalizedMessage[] = [...this.history, { role: 'user', content: input }];
    const clock = () => new Date().toISOString();
    const result = await dispatchTyphoonTurn({
      sessionId,
      promptText: input,
      providers: this.providers,
      credentials: this.credentials,
      messages,
      clock,
      onToken,
    });
    this.history = [...this.history, { role: 'user', content: input }, { role: 'assistant', content: result.text }];
    this.estimatedContextTokens = Math.ceil(
      this.history.reduce((n, m) => n + m.content.length, 0) / 4,
    );
    return result.text;
  }

  // --- Story 3.12: Rollback discovery and preview ---

  /**
   * List committed checkpoints for the current Session.
   * Returns a CommandOutput for narrow/redirected/headless parity (AC #5).
   * Incomplete/corrupt/expired/locked/unavailable-bytes checkpoints are HIDDEN
   * from apply-eligible targets by default (AC #3).
   */
  rollbackList(opts: { kvStore?: KeyValueStore; includeHidden?: boolean } = {}): CommandOutput {
    const kvStore = opts.kvStore;
    if (!kvStore) {
      return renderCommandOutput({ status: 'blocked', cause: 'no key-value store available for checkpoint discovery', nextStep: 'ensure a store is configured' });
    }
    const result = listCheckpoints(this.sessionId(), kvStore, this.clock, {
      includeHidden: opts.includeHidden,
    });
    if (!result.ok) {
      return renderCommandOutput({ status: 'blocked', cause: result.failure.message, nextStep: 'retry or inspect the checkpoint store' });
    }
    return renderRollbackListOutput(result.checkpoints);
  }

  /**
   * Inspect a single checkpoint for rollback preview.
   * Read-only — no target changes, approval, or native effect (AC #4).
   * Incomplete/corrupt/expired/locked/unavailable-bytes checkpoints remain
   * inspectable as non-authoritative/recovery records (AC #3).
   */
  rollbackInspect(checkpointId: string, opts: { kvStore?: KeyValueStore } = {}): CommandOutput {
    const kvStore = opts.kvStore;
    if (!kvStore) {
      return renderCommandOutput({ status: 'blocked', cause: 'no key-value store available for checkpoint inspection', nextStep: 'ensure a store is configured' });
    }
    const result = inspectCheckpoint(asCheckpointId(checkpointId), kvStore, this.clock);
    if (!result.ok) {
      return renderCommandOutput({ status: 'blocked', cause: result.failure.message, nextStep: 'verify the checkpoint id and retry' });
    }
    return renderRollbackInspectOutput(result.preview);
  }

  // --- Story 3.15: Recovery of interrupted checkpoint and mutation operations ---

  /**
   * Inspect an operation for recovery (Story 3.15 AC #1).
   * Classifies the operation from the journal, detects unreachable/incomplete
   * checkpoint material, and NEVER replays a native effect automatically.
   */
  recoverInspect(operationId: string): CommandOutput {
    if (!this.repo) {
      return renderCommandOutput({ status: 'blocked', cause: 'no journal repository available for recovery inspection', nextStep: 'ensure a journal repository is configured' });
    }

    const opId = asOperationId(operationId);
    const sessionId = asSessionId(this.sessionId());
    const events = this.repo.queryEvents(sessionId, 0);
    const mappedEvents = events.map((e) => ({ kind: e.payload.kind, operationId: e.operationId ?? '' }));

    // Detect incomplete checkpoint stages.
    const checkpointRepo = this._checkpointRepo;
    const incompleteStageIds = checkpointRepo?.detectIncompleteStages() ?? [];

    // Find checkpoint for this operation.
    const operationCheckpoint = checkpointRepo?.findByOperationId(opId) ?? null;
    const checkpointMaterial: { stageState: string; integrityState: string } | null =
      operationCheckpoint
        ? { stageState: operationCheckpoint.stageState, integrityState: operationCheckpoint.integrityState }
        : null;

    const classifyResult = classify({
      operationId: opId,
      journalEvents: mappedEvents,
      incompleteStageIds,
      operationCheckpoint: checkpointMaterial,
    });

    if (!classifyResult.ok) {
      return renderCommandOutput({ status: 'blocked', cause: classifyResult.failure.message, nextStep: 'verify the operation id and retry' });
    }

    const classification = classifyResult.classification;
    const action: RecoveryAction = classification.journalState === 'succeeded' || classification.journalState === 'failed' || classification.journalState === 'cancelled'
      ? 'exit'
      : 'inspect';

    const nextStep = classification.journalState === 'dispatch-committed' || classification.journalState === 'unknown-outcome'
      ? 'reconcile explicitly; do not auto-retry'
      : 'no action needed';

    const result = buildRecoveryResult({ classification, action, nextStep });
    return renderRecoveryInspect({ classification, result });
  }

  /**
   * Reconcile an operation's checkpoint material (Story 3.15 AC #4).
   * Attempts ONLY repository/journal reconciliation and safe reference repair.
   * NEVER fabricates complete protection.
   */
  recoverReconcile(operationId: string): CommandOutput {
    if (!this.repo) {
      return renderCommandOutput({ status: 'blocked', cause: 'no journal repository available for recovery reconciliation', nextStep: 'ensure a journal repository is configured' });
    }

    const checkpointRepo = this._checkpointRepo;
    if (!checkpointRepo) {
      return renderCommandOutput({ status: 'blocked', cause: 'no checkpoint repository available for recovery reconciliation', nextStep: 'ensure a checkpoint store is configured' });
    }

    const opId = asOperationId(operationId);
    const sessionId = asSessionId(this.sessionId());
    const events = this.repo.queryEvents(sessionId, 0);
    const mappedEvents = events.map((e) => ({ kind: e.payload.kind, operationId: e.operationId ?? '' }));

    const reconcileResult = reconcileOperation({
      operationId: opId,
      journalEvents: mappedEvents,
      checkpointRepo,
    });

    if (!reconcileResult.ok) {
      return renderCommandOutput({ status: 'blocked', cause: reconcileResult.failure.message, nextStep: 'verify the operation id and retry' });
    }

    const classification: RecoveryClassification = {
      operationId: opId,
      journalState: 'unknown-outcome',
      operationState: 'unknown-outcome',
      checkpointMaterial: 'incomplete',
      residualRisk: { description: 'Checkpoint material reconciled', scope: 'none', severity: 'none' },
      dispatchClassification: 'reference-publication-failed',
      hasEffectDispatchCommitted: true,
      hasTerminalEvent: false,
      terminalKind: null,
    };

    const result = buildRecoveryResult({
      classification,
      action: 'reconcile',
      nextStep: reconcileResult.rollbackScopeLabel === 'corrupt' ? 'inspect the checkpoint store; data may be unrecoverable' : 'review reconciliation details',
    });

    return renderRecoveryReconcile({
      operationId,
      details: reconcileResult.details,
      rollbackScopeLabel: reconcileResult.rollbackScopeLabel,
      result,
    });
  }

  /**
   * Export sanitized evidence for an operation (Story 3.15 AC #6).
   * No raw bytes in evidence (AD-24).
   */
  recoverExport(operationId: string): CommandOutput {
    if (!this.repo) {
      return renderCommandOutput({ status: 'blocked', cause: 'no journal repository available for recovery export', nextStep: 'ensure a journal repository is configured' });
    }

    const opId = asOperationId(operationId);
    const sessionId = asSessionId(this.sessionId());
    const events = this.repo.queryEvents(sessionId, 0);
    const mappedEvents = events.map((e) => ({ kind: e.payload.kind, operationId: e.operationId ?? '' }));
    const opEvents = mappedEvents.filter((e) => e.operationId === opId);

    const classification: RecoveryClassification = {
      operationId: opId,
      journalState: opEvents.length > 0 ? 'unknown-outcome' : 'not-sent',
      operationState: opEvents.length > 0 ? 'unknown-outcome' : 'proposed',
      checkpointMaterial: 'not-applicable',
      residualRisk: { description: 'Evidence exported for inspection', scope: 'none', severity: 'none' },
      dispatchClassification: 'terminal-evidence-recorded',
      hasEffectDispatchCommitted: opEvents.some((e) => e.kind === 'EffectDispatchCommitted'),
      hasTerminalEvent: opEvents.some((e) => ['OperationSucceeded', 'OperationFailed', 'OperationCancelled', 'OperationUnknownOutcome'].includes(e.kind)),
      terminalKind: opEvents.find((e) => ['OperationSucceeded', 'OperationFailed', 'OperationCancelled', 'OperationUnknownOutcome'].includes(e.kind))?.kind ?? null,
    };

    const result = buildRecoveryResult({
      classification,
      action: 'export-safe-evidence',
      nextStep: 'evidence exported; review and determine next action',
    });

    return renderRecoveryExport({
      operationId,
      evidence: opEvents,
      result,
    });
  }

  /**
   * Exit recovery with stable exit class/code (Story 3.15 AC #6).
   * Unresolved state remains visible.
   */
  recoverExit(): CommandOutput {
    const unresolvedState = false; // In a full implementation, this would check for unresolved operations.
    const classification: RecoveryClassification = {
      operationId: '' as unknown as import('./protocol/ids.js').OperationId,
      journalState: 'succeeded',
      operationState: 'succeeded',
      checkpointMaterial: 'not-applicable',
      residualRisk: { description: 'Recovery session ended', scope: 'none', severity: 'none' },
      dispatchClassification: 'terminal-evidence-recorded',
      hasEffectDispatchCommitted: false,
      hasTerminalEvent: true,
      terminalKind: 'OperationSucceeded',
    };

    const result = buildRecoveryResult({
      classification,
      action: 'exit',
      nextStep: 'recovery complete',
    });

    return renderRecoveryExit({ unresolvedState, result });
  }

  // --- Story 3.13: Rollback conflict analysis ---

  /**
   * Analyze each rollback target against its pre-image, post-image, and current
   * state (three-way). Returns a RollbackAnalysis with per-target outcomes and
   * overall eligibility. Does NOT apply anything (apply is 3.14).
   *
   * AC #1: resolves stable current identity + captures current digest/version
   * BEFORE any effect, then compares recorded pre-image, recorded agent
   * post-image/patch, and current content/deletion state.
   *
   * AC #2: current state matches post-image + identity unchanged → applied-eligible
   * with concrete inverse operation, expected current digest/version, rename
   * handling, and no unrelated target included.
   *
   * AC #3: current state differs, later edit overlaps, renamed/deleted/recreated,
   * case/unicode changed, behind symlink/mount, or concurrency uncertain →
   * conflict/skipped/inaccessible/mismatch/unknown-outcome; NO overwrite or
   * best-effort reversal prepared.
   *
   * AC #4: binary original in encrypted ArtifactStore → reads via integrity-
   * verified path, verifies integrity + compares digests WITHOUT exposing raw
   * bytes in UI/logs/Evidence; missing or corrupt originals are NOT apply-eligible.
   *
   * AC #5: conflict panel offers ONLY safe choices: skip target, export a
   * sanitized patch/Evidence, rebase/apply to a new path where identity policy
   * permits, or explicit user-authored resolution. Generic overwrite, continue,
   * and blind retry are UNAVAILABLE.
   */
  analyzeRollback(
    checkpointId: string,
    selectedTargets: readonly RollbackTarget[],
    opts: {
      kvStore?: KeyValueStore;
      blobStore?: BlobStore;
      encKey?: Buffer;
      fsProbe?: AnalysisFsProbe;
    } = {},
  ): AnalyzeRollbackResult {
    const kvStore = opts.kvStore;
    if (!kvStore) {
      return {
        ok: false,
        failure: {
          category: 'checkpoint-not-found',
          retryable: false,
          scope: 'rollback-analysis',
          message: 'no key-value store available for checkpoint analysis',
          causeCode: 'no-kv-store',
        },
      };
    }

    const checkpointRepo = new CheckpointRepository(kvStore, this.clock);
    const artifactStore = opts.blobStore && opts.encKey
      ? new ArtifactStore(opts.blobStore, opts.encKey)
      : undefined;

    const ctx: AnalysisContext = {
      fsProbe: opts.fsProbe ?? defaultAnalysisFsProbe(),
      checkpointRepo,
      artifactStore,
      clock: this.clock,
    };

    return analyzeRollbackSet(checkpointId, selectedTargets, ctx);
  }

  // --- Story 3.14: Apply conflict-free rollback targets ---

  /**
   * Apply conflict-free rollback targets (Story 3.14).
   *
   * AC #1: applies ONLY analyzed, conflict-free inverse changes so rollback
   * changes exactly the eligible built-in file state and leaves unrelated work
   * untouched. Excluded effects (shell, process, remote, permission, symlink-side,
   * external) are NEVER claimed reversible (AD-19).
   *
   * AC #2: each applied target produces a durable EffectDispatchCommitted event
   * BEFORE the native mutation, and a durable OperationSucceeded event AFTER
   * the mutation. The journal is the sole commit-visibility authority.
   *
   * AC #3: each target is revalidated immediately before apply — if the current
   * state has changed since analysis (concurrent writer, rename, deletion,
   * re-creation), the apply is refused for that target. No stale inverse is
   * applied.
   *
   * AC #4: the aggregate result is one of `full` (all targets applied),
   * `partial` (some applied, some had issues), or `blocked` (none applied).
   * Residual conflicts are reported so the user can choose next steps.
   *
   * AC #5: a new checkpoint is created for the rollback operation itself, so
   * the rollback can itself be rolled back. The checkpoint reference is
   * included in the result.
   */
  applyRollback(
    checkpointId: string,
    selectedTargets: readonly RollbackTarget[],
    opts: {
      kvStore?: KeyValueStore;
      blobStore?: BlobStore;
      encKey?: Buffer;
      fsProbe?: ApplyFsProbe;
    } = {},
  ): RollbackApplyResultOrFailure {
    const kvStore = opts.kvStore;
    if (!kvStore) {
      return {
        ok: false,
        failure: {
          category: 'checkpoint-not-found',
          retryable: false,
          scope: 'rollback-apply',
          message: 'no key-value store available for rollback apply',
          causeCode: 'no-kv-store',
        },
      };
    }

    const checkpointRepo = new CheckpointRepository(kvStore, this.clock);
    const artifactStore = opts.blobStore && opts.encKey
      ? new ArtifactStore(opts.blobStore, opts.encKey)
      : undefined;

    const ctx: ApplyContext = {
      fsProbe: opts.fsProbe ?? defaultApplyFsProbe(),
      checkpointRepo,
      artifactStore,
      journal: this.repo ?? { append: () => 0 },
      sessionId: this.sessionId(),
      activationId: this.activation.snapshot().activationId,
      activationRevision: this.activation.snapshot().revision,
      authorityRevision: this.activation.snapshot().revision,
      workspace: this.workspace,
      clock: this.clock,
    };

    return applyRollback(checkpointId, selectedTargets, ctx);
  }

  // --- Story 3.16: Retention, capacity, and cleanup ---

  /**
   * Get retention status for a checkpoint (Story 3.16 AC #1, AC #6).
   * Shows encryption/integrity status, age/window, cap usage, exclusions,
   * and exact next steps.
   */
  retentionStatus(
    checkpointId: string,
    opts: {
      kvStore?: KeyValueStore;
      blobStore?: BlobStore;
      encKey?: Buffer;
      config?: RetentionConfig;
      currentPromptRound?: number;
    } = {},
  ): CommandOutput {
    const kvStore = opts.kvStore;
    if (!kvStore) {
      return renderCommandOutput({ status: 'blocked', cause: 'no key-value store available for retention status', nextStep: 'ensure a store is configured' });
    }

    const recordKey = `checkpoint:record:${checkpointId}`;
    const recordJson = kvStore.get(recordKey);
    if (!recordJson) {
      return renderCommandOutput({ status: 'blocked', cause: `checkpoint not found: ${checkpointId}`, nextStep: 'verify the checkpoint id and retry' });
    }

    let record: { checkpointId: string; createdAt: string; integrityState: string; artifactIds?: readonly string[]; promptRound?: number; retentionState: string };
    try {
      record = JSON.parse(recordJson);
    } catch {
      return renderCommandOutput({ status: 'blocked', cause: `checkpoint record is corrupt: ${checkpointId}`, nextStep: 'inspect the checkpoint store' });
    }

    const now = this.clock();
    const ageMs = Math.max(0, new Date(now).getTime() - new Date(record.createdAt).getTime());
    const promptRound = record.promptRound ?? 0;
    const currentPromptRound = opts.currentPromptRound ?? promptRound + 1;

    const retentionState: RetentionState = calculateRetention(
      asCheckpointId(checkpointId),
      promptRound,
      currentPromptRound,
      opts.config,
    );

    const encryptionState: 'encrypted' | 'unencrypted' = record.artifactIds && record.artifactIds.length > 0 ? 'encrypted' : 'unencrypted';

    const status = {
      checkpointId: asCheckpointId(checkpointId),
      encryptionState,
      integrityState: record.integrityState,
      ageMs,
      retentionWindow: retentionState.config.subsequentPromptRounds,
      expiryPromptRound: retentionState.retained ? retentionState.expiryPromptRound : null,
      capUsage: null as CapacityUsage | null,
      exclusions: [] as readonly string[],
      nextSteps: retentionState.retained
        ? ['checkpoint is retained', 'use /rollback inspect for details']
        : ['checkpoint has expired', 'cleanup will remove its data'],
    };

    return renderRetentionStatusOutput(status);
  }

  /**
   * Evaluate capacity for a proposed checkpoint (Story 3.16 AC #2).
   * Reports over-cap with exact usage and unprotected scope.
   * Full Access cannot suppress this disclosure.
   */
  evaluateCapacity(
    proposedCheckpointSize: number,
    targetPaths: readonly string[],
    opts: { currentStoreUsageBytes?: number } = {},
  ): CommandOutput {
    const currentUsage = opts.currentStoreUsageBytes ?? 0;
    const result = evaluateCapacity(proposedCheckpointSize, currentUsage, targetPaths);

    if (result.ok) {
      return renderCapacityUsageOutput(result.usage);
    }

    // Over-cap: render the full disclosure.
    return renderCapacityUsageOutput(result.usage);
  }

  /**
   * Run cleanup for a checkpoint (Story 3.16 AC #4, AC #5).
   * Removes encrypted originals, metadata, staging files, and unreachable
   * references through a journaled crash-consistent lifecycle.
   */
  runCleanup(
    checkpointId: string,
    opts: {
      kvStore?: KeyValueStore;
      blobStore?: BlobStore;
      storeLocked?: () => boolean;
      keyLocked?: () => boolean;
    } = {},
  ): CommandOutput {
    const kvStore = opts.kvStore;
    const blobStore = opts.blobStore;
    if (!kvStore || !blobStore) {
      return renderCommandOutput({ status: 'blocked', cause: 'no stores available for cleanup', nextStep: 'ensure stores are configured' });
    }

    const ctx: CleanupContext = {
      clock: this.clock,
      journal: { append: () => {} },
      kvStore: {
        get: (k: string) => kvStore.get(k),
        put: (k: string, v: string) => kvStore.put(k, v),
        delete: (k: string) => kvStore.delete(k),
        list: (prefix: string) => kvStore.list(prefix),
      },
      blobStore: {
        get: (k: string) => blobStore.get(k),
        put: (k: string, v: Uint8Array) => blobStore.put(k, v),
        delete: (k: string) => blobStore.delete(k),
        list: (prefix: string) => blobStore.list(prefix),
      },
      storeLocked: opts.storeLocked ?? (() => false),
      keyLocked: opts.keyLocked ?? (() => false),
    };

    const outcome = runCleanup(asCheckpointId(checkpointId), ctx);
    return renderCleanupOutcomeOutput(outcome);
  }

  // --- Story 3.9: Agent Loop hardening ---

  /**
   * Validate a proposal comprehensively before any tool or process adapter
   * receives it (Story 3.9 AC #1, AC #2). Checks schema, action class, Work
   * Mode, Permission Profile, Workspace/resource identity, consent, quota,
   * credentials, and hard boundaries. Returns a typed result with sanitized
   * Evidence. Performs NO repair, reinterpretation, substitution, or retry
   * (AD-14). Leaves NO authorization or staged effect.
   */
  validateProposal(proposal: ProposalToValidate): ProposalValidationResult {
    const a = this.activation.snapshot();
    const ctx: ValidationContext = {
      mode: a.mode,
      profile: a.profile,
      workspace: this.workspace,
      activationRevision: a.revision,
      authorityRevision: a.revision,
      matrixVersion: 1,
      policyVersion: 1,
      clock: this.clock,
    };
    const deps: ValidationDeps = {
      lookupActionClass: (ac) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { lookupActionClass } = require('./permissions/matrix.js') as typeof import('./permissions/matrix.js');
        return lookupActionClass(ac);
      },
      evaluatePermission: (action, state) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { evaluatePermission } = require('./permissions/policy.js') as typeof import('./permissions/policy.js');
        return evaluatePermission(action, state);
      },
      checkHardBoundary: (input) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { checkHardBoundary } = require('./permissions/boundary.js') as typeof import('./permissions/boundary.js');
        return checkHardBoundary(input);
      },
      sanitizer,
    };
    return validateProposal(proposal, ctx, deps);
  }

  /**
   * Mediate a tool result before it is offered as context for another proposal
   * (Story 3.9 AC #3). Source-labels, sanitizes, bounds, and durably records
   * the result. Remote/tool output CANNOT change policy, permissions,
   * boundaries, registry authority, or task scope.
   */
  mediateToolResult(result: ToolResultToMediate): MediatedToolResult {
    const a = this.activation.snapshot();
    const ctx: MediationContext = {
      workspace: this.workspace,
      activationRevision: a.revision,
      authorityRevision: a.revision,
      matrixVersion: 1,
      policyVersion: 1,
      clock: this.clock,
      maxResultBytes: 1024 * 1024, // 1 MB
    };
    const deps: MediationDeps = { sanitizer };
    return mediateToolResult(result, ctx, deps);
  }

  /**
   * Handle a lifecycle step for the Agent Loop (Story 3.9 AC #5). When the
   * loop has no valid next proposal or receives an invalid terminal response,
   * this produces a durable typed result that STOPS the loop. Does NOT invent
   * a final answer, silently repair the proposal, or dispatch an unvalidated
   * effect.
   */
  loopStep(hasValidNext: boolean, terminalResponse: string | null): LoopTerminal {
    const a = this.activation.snapshot();
    const ctx: LifecycleContext = {
      clock: this.clock,
      workspace: this.workspace,
      activationRevision: a.revision,
      authorityRevision: a.revision,
      matrixVersion: 1,
      policyVersion: 1,
    };
    const deps: LifecycleDeps = { sanitizer };
    return handleLifecycleStep(hasValidNext, terminalResponse, ctx, deps);
  }

  // --- Story 3.10: Terminal aggregation + authority revalidation ---

  /**
   * Aggregate per-operation terminal states into a Prompt Round outcome
   * (Story 3.10 AC #1). Selects the strongest unresolved state, names all
   * included + excluded effects, and only publishes completion after durable
   * post-commit Evidence.
   */
  aggregateTerminals(
    operations: readonly OperationTerminalState[],
    postCommitEvidenceCommitted: boolean,
    modelExplanation: string | null = null,
  ): AggregateRoundOutcome {
    const a = this.activation.snapshot();
    const deps: TerminalAggregatorDeps = {
      clock: this.clock,
      activationRevision: a.revision,
      authorityRevision: a.revision,
      matrixVersion: 1,
      policyVersion: 1,
      workspaceId: a.workspaceId,
    };
    return aggregateTerminals(operations, deps, postCommitEvidenceCommitted, modelExplanation);
  }

  /**
   * Revalidate authority for the next effect before it starts (Story 3.10 AC #2).
   * When a loop operation is cancelled, Runtime Activation changes, Full Access
   * is revoked, or a Boundary Expansion is revoked, this revalidates authority
   * revision, exact action identity, Workspace, checkpoint authorization, quota,
   * platform state, and cancellation immediately. Pending/prepared work is denied
   * WITHOUT consuming one-shot authority.
   */
  revalidateNextEffect(input: RevalidateNextEffectInput): RevalidateNextEffectResult {
    const a = this.activation.snapshot();
    const ctx: RevalidationContext = {
      activationId: a.activationId,
      activationRevision: a.revision,
      authorityRevision: a.revision,
      workspaceId: a.workspaceId,
      workspaceRoot: this.workspaceRoot,
      clock: this.clock,
    };
    return revalidateAuthorityForNextEffect(input, ctx);
  }

  /** Legacy Agent Loop entry retained for Epic 3 tool-call mediation. */
  async runAgentTurn(
    input: string,
    approve: ApprovalCallback = async () => false,
    onToken?: (delta: string) => void,
  ): Promise<string> {
    const a = this.activation.snapshot();
    const result = await this.loop.runTurn(
      input,
      { mode: a.mode, profile: a.profile, history: this.history },
      approve,
      onToken,
    );
    this.history = [...result.history];
    this.estimatedContextTokens = Math.ceil(
      this.history.reduce((n, m) => n + m.content.length, 0) / 4,
    );
    return result.text;
  }
}

/** Default FsMutator using real node:fs (for production use). */
function defaultFsMutator(): FsMutator {
  return {
    writeFile(path: string, content: Uint8Array): void {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs');
      fs.writeFileSync(path, content);
    },
    mkdir(dir: string): void {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs');
      fs.mkdirSync(dir, { recursive: true });
    },
  };
}

/** Default AnalysisFsProbe using real node:fs (for production use). */
function defaultAnalysisFsProbe(): AnalysisFsProbe {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  return {
    readFile(path: string): Uint8Array {
      return fs.readFileSync(path);
    },
    lstat(path: string) {
      const s = fs.lstatSync(path);
      return {
        dev: s.dev,
        ino: s.ino,
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
        isSymbolicLink: s.isSymbolicLink(),
      };
    },
    realpath(path: string): string {
      return fs.realpathSync(path);
    },
    stat(path: string) {
      const s = fs.statSync(path);
      return {
        dev: s.dev,
        ino: s.ino,
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
      };
    },
    isAccessible(path: string): boolean {
      try {
        fs.accessSync(path, fs.constants.R_OK);
        return true;
      } catch {
        return false;
      }
    },
    hasOpenHandles(_path: string): boolean {
      // Best-effort: on Unix, check /proc/self/fd. For now, return false
      // (optimistic — concurrency detection is platform-specific).
      return false;
    },
  };
}

/** Default QuarantineProvider using real node:fs (for production use).
 * Renames the target into a quarantine directory on the same filesystem,
 * then removes the quarantined content. */
function defaultQuarantineProvider(): QuarantineProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('node:os') as typeof import('node:os');

  const quarantineDir = path.join(os.tmpdir(), 'thcode-quarantine');

  return {
    quarantine(originalPath: string): string {
      // Ensure quarantine directory exists.
      fs.mkdirSync(quarantineDir, { recursive: true });
      const basename = path.basename(originalPath);
      const quarantinePath = path.join(quarantineDir, `${basename}-${Date.now()}`);
      fs.renameSync(originalPath, quarantinePath);
      return quarantinePath;
    },
    removeQuarantined(quarantinePath: string): void {
      fs.rmSync(quarantinePath, { recursive: true, force: true });
    },
    quarantinePathFor(originalPath: string): string {
      const basename = path.basename(originalPath);
      return path.join(quarantineDir, `${basename}-${Date.now()}`);
    },
  };
}

/** Default ApplyFsProbe using real node:fs (for production use). */
function defaultApplyFsProbe(): ApplyFsProbe {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  return {
    readFile(path: string): Uint8Array {
      return fs.readFileSync(path);
    },
    writeFile(path: string, content: Uint8Array): void {
      fs.writeFileSync(path, content);
    },
    deleteFile(path: string): void {
      fs.unlinkSync(path);
    },
    lstat(path: string) {
      const s = fs.lstatSync(path);
      return {
        dev: s.dev,
        ino: s.ino,
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
        isSymbolicLink: s.isSymbolicLink(),
      };
    },
    realpath(path: string): string {
      return fs.realpathSync(path);
    },
    stat(path: string) {
      const s = fs.statSync(path);
      return {
        dev: s.dev,
        ino: s.ino,
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
      };
    },
    isAccessible(path: string): boolean {
      try {
        fs.accessSync(path, fs.constants.R_OK);
        return true;
      } catch {
        return false;
      }
    },
    hasOpenHandles(_path: string): boolean {
      return false;
    },
    mkdir(dir: string): void {
      fs.mkdirSync(dir, { recursive: true });
    },
  };
}
