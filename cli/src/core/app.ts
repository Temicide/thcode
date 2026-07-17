// CoreApp: the stable application-facing interface of the headless core
// (ADR 0020). UI layers (Ink today; desktop/web/IDE later) interact ONLY
// through this facade via typed intents — never touching fs, network, or
// child_process directly.

import { AgentLoop, type ApprovalCallback } from './agent/loop.js';
import { dispatchTyphoonTurn, durableEvent } from './agent/dispatch.js';
import { ToolCatalog } from './catalog/loader.js';
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
import { asSessionId, newOperationId } from './protocol/ids.js';
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
import type {
  AuthorityProjection,
  ConversationProjection,
  StatusProjection,
  TranscriptTurnProjection,
} from './protocol/projections.js';

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
  checkpoints(store?: KeyValueStore): CheckpointRepository | null {
    if (store) {
      this._checkpointRepo = new CheckpointRepository(store, this.clock);
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
      case 'tools':
        // AC #3: /tools exposes registry/diagnostic controls; does NOT invoke the
        // Epic 4 Capability Registry or Specialist services; Catalogued entries
        // are not made invokable.
        return renderCommandOutput({ status: 'succeeded', body: this.listCatalog().join('\n'), nextStep: 'continue' });
      case 'check':
        return renderCommandOutput({ status: 'succeeded', body: 'dependency preflight is a non-mutating probe (Epic 3 surface)', nextStep: 'continue' });
      case 'help':
        return renderCommandOutput({ status: 'succeeded', body: COMMAND_GRAMMAR.map((c) => `/${c.command}${c.aliases.length ? ` (${c.aliases.map((a) => `/${a}`).join(', ')})` : ''} — ${c.description}`).join('\n'), nextStep: 'continue' });
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
