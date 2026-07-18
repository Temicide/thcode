// Shared types for Agent Loop hardening (Story 3.9, AD-4, AD-7, AD-14, AD-24).
// Discriminated unions, opaque branded ids, no `any`.

import type { WorkMode, PermissionProfile } from '../permissions/types.js';
import type { WorkspaceIdentity } from '../workspace/types.js';
import type { AuthorityEvidence } from '../protocol/evidence.js';
import type { OperationId } from '../protocol/ids.js';

// --- Validation types ---

export type ValidationOutcome = 'malformed' | 'blocked' | 'refused';

export interface ValidProposal {
  readonly valid: true;
  readonly operationId: OperationId;
}

export interface InvalidProposal {
  readonly valid: false;
  readonly outcome: ValidationOutcome;
  readonly reason: string;
  readonly evidence: AuthorityEvidence;
}

export type ProposalValidationResult = ValidProposal | InvalidProposal;

export interface ValidationContext {
  readonly mode: WorkMode;
  readonly profile: PermissionProfile;
  readonly workspace: WorkspaceIdentity;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly matrixVersion: number;
  readonly policyVersion: number;
  readonly clock: () => string;
}

export interface ProposalToValidate {
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly actionClass: string;
  readonly target?: string;
  readonly credentialGroup?: string;
  readonly requiresConsent?: boolean;
  readonly consentGiven?: boolean;
  readonly quotaExceeded?: boolean;
  readonly mutating: boolean;
  readonly sensitive?: boolean;
}

// --- Tool result mediation types ---

export interface MediatedToolResult {
  readonly source: string;
  readonly sanitizedOutput: string;
  readonly bounded: boolean;
  readonly evidence: AuthorityEvidence;
  /** Type-level marker: this result is instruction-inert data (AD-7). It
   * CANNOT define tools, change policy, or grant authority. */
  readonly instructionInert: true;
}

export interface MediationContext {
  readonly workspace: WorkspaceIdentity;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly matrixVersion: number;
  readonly policyVersion: number;
  readonly clock: () => string;
  readonly maxResultBytes: number;
}

export interface ToolResultToMediate {
  readonly toolName: string;
  readonly output: string;
  readonly ok: boolean;
  readonly operationId: string;
}

// --- Lifecycle types ---

export type LoopTerminalKind = 'completed' | 'no-valid-proposal' | 'invalid-terminal-response';

export interface LoopTerminal {
  readonly kind: LoopTerminalKind;
  readonly reason: string;
  readonly evidence: AuthorityEvidence;
  /** Type-level marker: this is a durable typed result (AD-3). */
  readonly durable: true;
}

export interface LifecycleContext {
  readonly clock: () => string;
  readonly workspace: WorkspaceIdentity;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly matrixVersion: number;
  readonly policyVersion: number;
}

// --- Terminal aggregation types (Story 3.10, AD-3, AD-13, AD-19, AD-22, AD-28) ---

import type { EvidenceCompleteness } from '../protocol/events.js';

export type OperationTerminalKind =
  | 'succeeded'
  | 'failed'
  | 'blocked'
  | 'malformed'
  | 'denied'
  | 'refused'
  | 'cancelled'
  | 'unknown-outcome'
  | 'still-running'
  | 'reconciled';

export interface OperationTerminalState {
  readonly operationId: string;
  readonly kind: OperationTerminalKind;
  readonly effectName: string;
  readonly evidenceCompleteness: EvidenceCompleteness;
  readonly residualRisk?: string;
  readonly dispatchClassification?: string;
  readonly timestamp: string;
}

export type AggregateStatus = 'succeeded' | 'partial' | 'blocked' | 'failed' | 'unknown-outcome';

export interface AggregateRoundOutcome {
  readonly strongestUnresolved: OperationTerminalKind;
  readonly includedEffects: readonly string[];
  readonly excludedEffects: readonly string[];
  readonly blockedEffects: readonly string[];
  readonly cancelledEffects: readonly string[];
  readonly unresolvedEffects: readonly string[];
  readonly operationStatus: OperationTerminalKind;
  readonly aggregateStatus: AggregateStatus;
  readonly evidence: AuthorityEvidence;
  readonly evidenceCompleteness: EvidenceCompleteness;
  readonly modelExplanation: string | null;
  readonly residualRisks: readonly string[];
  readonly blindRetryBlocked: boolean;
  readonly onlyInspectReconcileExit: boolean;
  readonly committed: boolean;
}

export interface RevalidationContext {
  readonly activationId: string;
  readonly activationRevision: number;
  readonly authorityRevision: number;
  readonly workspaceId: string;
  readonly workspaceRoot: string;
  readonly clock: () => string;
}
