import type { RiskLevel } from "../engine/types.js";

/**
 * Supported wallet chain families for Layer 4 reports.
 */
export type WalletChain = "evm" | "solana" | "bitcoin";

/**
 * Shared scan depth requested for a wallet review.
 */
export type WalletScanMode = "basic" | "full";

/**
 * Broad chain-agnostic exposure categories used across findings and factors.
 */
export type WalletExposureCategory =
  | "asset"
  | "authorization"
  | "counterparty"
  | "activity"
  | "recovery"
  | "operational"
  | "other";

/**
 * Coverage areas where the report can declare honest capability boundaries.
 */
export type WalletCapabilityArea =
  | "snapshot"
  | "finding"
  | "cleanup_plan"
  | "cleanup_execution";

/**
 * Shared support status used for capability and action availability reporting.
 */
export type WalletCapabilityStatus = "supported" | "partial" | "not_supported";

/**
 * Lifecycle state for an individual wallet finding.
 */
export type WalletFindingStatus = "open" | "mitigated" | "accepted";

/**
 * Broad cleanup action families that remain chain-agnostic.
 */
export type WalletCleanupActionKind =
  | "revoke_authorization"
  | "close_resource"
  | "move_assets"
  | "rotate_wallet"
  | "monitor_wallet"
  | "manual_review"
  | "other";

/**
 * Execution style for a cleanup action.
 */
export type WalletCleanupExecutionMode = "automated" | "guided" | "manual";

/**
 * Readiness state for an individual cleanup action.
 */
export type WalletCleanupActionStatus =
  | "planned"
  | "ready"
  | "blocked"
  | "not_supported";

/**
 * Concrete execution mechanism expected for a cleanup action.
 */
export type WalletCleanupExecutionType = "wallet_signature" | "manual_review";

/**
 * Shared cleanup target categories.
 */
export type WalletCleanupTargetKind =
  | "wallet"
  | "asset"
  | "authorization"
  | "counterparty"
  | "resource"
  | "activity"
  | "other";

/**
 * Aggregate execution status for a cleanup plan.
 */
export type WalletCleanupExecutionStatus =
  | "not_started"
  | "completed"
  | "partial"
  | "blocked"
  | "failed";

/**
 * Per-action execution state within a cleanup result.
 */
export type WalletCleanupActionExecutionStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "skipped"
  | "blocked";

/**
 * Caller-supplied request contract for a wallet scan.
 */
export interface WalletScanRequest {
  /** Stable caller correlation identifier for the scan request. */
  readonly requestId: string;
  /** Chain family being evaluated. */
  readonly walletChain: WalletChain;
  /** Chain-specific wallet identifier, represented as an opaque string. */
  readonly walletAddress: string;
  /** Chain-agnostic network identifier such as "1" or "mainnet". */
  readonly networkId: string;
  /** Requested scan depth. */
  readonly scanMode: WalletScanMode;
  /** ISO-8601 timestamp describing when the request was created. */
  readonly requestedAt: string;
  /** Deterministic string metadata supplied by the caller. */
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Snapshot section metadata for a fully hydrated wallet snapshot.
 */
export interface WalletSnapshotSection {
  /** Stable identifier for the snapshot section. */
  readonly sectionId: string;
  /** Opaque section type label for later chain-specific implementations. */
  readonly sectionType: string;
  /** Human-readable label for audit output. */
  readonly label: string;
  /** Number of records represented by this section. */
  readonly itemCount: number;
  /** Deterministic content hash for the section payload. */
  readonly contentHash: string;
  /** Deterministic metadata for the section. */
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Shared contract describing the wallet snapshot used for evaluation.
 */
export interface WalletScanSnapshot {
  /** Stable snapshot identifier. */
  readonly snapshotId: string;
  /** Request identifier the snapshot belongs to. */
  readonly requestId: string;
  /** Chain family the snapshot was captured for. */
  readonly walletChain: WalletChain;
  /** Wallet identifier represented in the snapshot. */
  readonly walletAddress: string;
  /** Network scope the snapshot applies to. */
  readonly networkId: string;
  /** ISO-8601 timestamp describing when capture completed. */
  readonly capturedAt: string;
  /** Fully hydrated snapshot sections included in the evaluation payload. */
  readonly sections: readonly WalletSnapshotSection[];
  /** Deterministic snapshot metadata. */
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Reference to evidence used by a finding or execution result.
 */
export interface WalletEvidenceRef {
  /** Stable evidence identifier. */
  readonly evidenceId: string;
  /** Source category for this evidence reference. */
  readonly sourceType: "snapshot_section" | "derived";
  /** Section or derived source identifier. */
  readonly sourceId: string;
  /** Human-readable audit label. */
  readonly label: string;
}

/**
 * Honest coverage statement describing what the report could or could not do.
 */
export interface WalletCapabilityBoundary {
  /** Stable capability boundary identifier. */
  readonly boundaryId: string;
  /** Coverage area being described. */
  readonly area: WalletCapabilityArea;
  /** Stable capability key such as "cleanup_execution". */
  readonly capabilityKey: string;
  /** Support level for the named capability. */
  readonly status: WalletCapabilityStatus;
  /** Human-readable explanation of the current boundary. */
  readonly detail: string;
}

/**
 * Shared contract for an individual wallet finding.
 */
export interface WalletFinding {
  /** Stable finding identifier. */
  readonly findingId: string;
  /** Chain family this finding belongs to. */
  readonly walletChain: WalletChain;
  /** Chain-agnostic exposure category. */
  readonly category: WalletExposureCategory;
  /** Severity assigned to the finding. */
  readonly riskLevel: RiskLevel;
  /** Finding lifecycle state. */
  readonly status: WalletFindingStatus;
  /** Short audit-friendly title. */
  readonly title: string;
  /** Human-readable summary of the issue. */
  readonly summary: string;
  /** ISO-8601 timestamp describing when the finding was produced. */
  readonly detectedAt: string;
  /** Related snapshot resources or opaque chain-specific identifiers. */
  readonly resourceIds: readonly string[];
  /** Linked risk factors. */
  readonly riskFactorIds: readonly string[];
  /** Linked cleanup actions. */
  readonly cleanupActionIds: readonly string[];
  /** Supporting evidence references. */
  readonly evidence: readonly WalletEvidenceRef[];
  /** Deterministic finding metadata. */
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Shared contract for a normalized wallet risk factor.
 */
export interface WalletRiskFactor {
  /** Stable risk factor identifier. */
  readonly factorId: string;
  /** Chain family this factor belongs to. */
  readonly walletChain: WalletChain;
  /** Chain-agnostic exposure category. */
  readonly category: WalletExposureCategory;
  /** Severity assigned to the factor. */
  readonly riskLevel: RiskLevel;
  /** Audit-friendly factor title. */
  readonly title: string;
  /** Human-readable explanation of the factor. */
  readonly summary: string;
  /** Findings that contributed to this factor. */
  readonly findingIds: readonly string[];
  /** Related snapshot resources or opaque chain-specific identifiers. */
  readonly resourceIds: readonly string[];
  /** Deterministic factor metadata. */
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Score component used to explain how a wallet score was assembled.
 */
export interface WalletScoreComponent {
  /** Stable score component identifier. */
  readonly componentId: string;
  /** Human-readable component label. */
  readonly label: string;
  /** Component points awarded within the 0-100 score model. */
  readonly score: number;
  /** Maximum component points within the 0-100 score model. */
  readonly maxScore: number;
  /** Severity implied by this score component. */
  readonly riskLevel: RiskLevel;
  /** Human-readable reason for the assigned points. */
  readonly rationale: string;
  /** Findings that contributed to this component. */
  readonly findingIds: readonly string[];
  /** Risk factors that contributed to this component. */
  readonly riskFactorIds: readonly string[];
}

/**
 * Deterministic score breakdown for a wallet report.
 */
export interface WalletScoreBreakdown {
  /** Final wallet score in the inclusive 0-100 range. */
  readonly totalScore: number;
  /** Aggregate severity corresponding to the score. */
  readonly riskLevel: RiskLevel;
  /** Human-readable explanation of the overall score. */
  readonly rationale: string;
  /** Components that explain the score. */
  readonly components: readonly WalletScoreComponent[];
}

/**
 * Chain-agnostic target reference for a cleanup action.
 */
export interface WalletCleanupTarget {
  /** Stable cleanup target identifier. */
  readonly targetId: string;
  /** Broad target kind for the action. */
  readonly targetKind: WalletCleanupTargetKind;
  /** Human-readable label for the target. */
  readonly label: string;
  /** Deterministic target metadata. */
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Shared contract for a cleanup or remediation action.
 */
export interface WalletCleanupAction {
  /** Stable cleanup action identifier. */
  readonly actionId: string;
  /** Chain family this action belongs to. */
  readonly walletChain: WalletChain;
  /** Broad cleanup action kind. */
  readonly kind: WalletCleanupActionKind;
  /** How the action is expected to be carried out. */
  readonly executionMode: WalletCleanupExecutionMode;
  /** Concrete execution mechanism required for this action. */
  readonly executionType: WalletCleanupExecutionType;
  /** Current readiness state for this action. */
  readonly status: WalletCleanupActionStatus;
  /** Whether the action requires an external wallet signature. */
  readonly requiresSignature: boolean;
  /** Honest support level for the action in the current phase. */
  readonly supportStatus: WalletCapabilityStatus;
  /** Audit-friendly action title. */
  readonly title: string;
  /** Human-readable action description. */
  readonly description: string;
  /** Priority for this action using the shared risk ladder. */
  readonly priority: RiskLevel;
  /** Target reference for the action. */
  readonly target: WalletCleanupTarget;
  /** Findings this action addresses. */
  readonly findingIds: readonly string[];
  /** Risk factors this action addresses. */
  readonly riskFactorIds: readonly string[];
  /** Explanation when support is partial or unavailable. */
  readonly supportDetail: string | null;
  /** Deterministic action metadata. */
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Ordered cleanup plan generated from a wallet scan result.
 */
export interface WalletCleanupPlan {
  /** Stable cleanup plan identifier. */
  readonly planId: string;
  /** Chain family the plan applies to. */
  readonly walletChain: WalletChain;
  /** Wallet identifier the plan applies to. */
  readonly walletAddress: string;
  /** Network scope the plan applies to. */
  readonly networkId: string;
  /** ISO-8601 timestamp describing when the plan was created. */
  readonly createdAt: string;
  /** Human-readable plan summary. */
  readonly summary: string;
  /** Ordered actions included in the plan. */
  readonly actions: readonly WalletCleanupAction[];
  /** Optional projected score after successful remediation, else null. */
  readonly projectedScore: number | null;
  /** Optional projected risk level after successful remediation, else null. */
  readonly projectedRiskLevel: RiskLevel | null;
}

/**
 * Per-action execution outcome captured for a cleanup plan.
 */
export interface WalletCleanupActionResult {
  /** Cleanup action identifier. */
  readonly actionId: string;
  /** Execution status for the action. */
  readonly status: WalletCleanupActionExecutionStatus;
  /** ISO-8601 timestamp describing when the attempt finished, else null. */
  readonly executedAt: string | null;
  /** Human-readable execution detail. */
  readonly detail: string;
  /** Evidence references collected during execution. */
  readonly evidence: readonly WalletEvidenceRef[];
}

/**
 * Shared contract describing the outcome of cleanup execution.
 */
export interface WalletCleanupExecutionResult {
  /** Cleanup plan identifier. */
  readonly planId: string;
  /** Chain family the execution result belongs to. */
  readonly walletChain: WalletChain;
  /** Wallet identifier the execution result belongs to. */
  readonly walletAddress: string;
  /** Network scope the execution result belongs to. */
  readonly networkId: string;
  /** Aggregate execution status for the plan. */
  readonly status: WalletCleanupExecutionStatus;
  /** ISO-8601 timestamp describing when execution started, else null. */
  readonly startedAt: string | null;
  /** ISO-8601 timestamp describing when execution completed, else null. */
  readonly completedAt: string | null;
  /** Per-action execution outcomes. */
  readonly actionResults: readonly WalletCleanupActionResult[];
}

/**
 * Aggregated result produced from evaluating a wallet snapshot.
 */
export interface WalletScanResult {
  /** Request identifier that produced this result. */
  readonly requestId: string;
  /** Snapshot identifier used for evaluation. */
  readonly snapshotId: string;
  /** Chain family that was evaluated. */
  readonly walletChain: WalletChain;
  /** Wallet identifier that was evaluated. */
  readonly walletAddress: string;
  /** Network scope that was evaluated. */
  readonly networkId: string;
  /** ISO-8601 timestamp describing when evaluation completed. */
  readonly evaluatedAt: string;
  /** Findings produced by the scan. */
  readonly findings: readonly WalletFinding[];
  /** Normalized risk factors produced by the scan. */
  readonly riskFactors: readonly WalletRiskFactor[];
  /** Deterministic score explanation. */
  readonly scoreBreakdown: WalletScoreBreakdown;
  /** Ordered cleanup plan, if the phase produced one. */
  readonly cleanupPlan: WalletCleanupPlan | null;
  /** Honest capability boundaries for the current report. */
  readonly capabilityBoundaries: readonly WalletCapabilityBoundary[];
}

/**
 * High-level summary for wallet reporting and UI-agnostic consumption.
 */
export interface WalletSummary {
  /** Chain family being summarized. */
  readonly walletChain: WalletChain;
  /** Wallet identifier being summarized. */
  readonly walletAddress: string;
  /** Network scope being summarized. */
  readonly networkId: string;
  /** Scan depth used for the report. */
  readonly scanMode: WalletScanMode;
  /** ISO-8601 timestamp describing when the summary was produced. */
  readonly generatedAt: string;
  /** Snapshot capture timestamp used in the report. */
  readonly snapshotCapturedAt: string;
  /** Final wallet score in the inclusive 0-100 range. */
  readonly score: number;
  /** Aggregate risk level for the wallet. */
  readonly riskLevel: RiskLevel;
  /** Total number of findings in the report. */
  readonly findingCount: number;
  /** Number of findings that remain open. */
  readonly openFindingCount: number;
  /** Number of cleanup actions available in the plan. */
  readonly cleanupActionCount: number;
  /** Number of findings with at least one linked cleanup action. */
  readonly actionableFindingCount: number;
}

/**
 * Final deterministic wallet report contract for Layer 4.
 */
export interface WalletReport {
  /** Deterministic report identifier. */
  readonly reportId: string;
  /** Version of the shared Layer 4 report contract. */
  readonly reportVersion: string;
  /** ISO-8601 timestamp describing when the report was assembled. */
  readonly generatedAt: string;
  /** Original wallet scan request. */
  readonly request: WalletScanRequest;
  /** Snapshot used for evaluation. */
  readonly snapshot: WalletScanSnapshot;
  /** Scan result derived from the snapshot. */
  readonly result: WalletScanResult;
  /** High-level summary derived from the result. */
  readonly summary: WalletSummary;
  /** Cleanup execution outcome, if any execution occurred. */
  readonly cleanupExecution: WalletCleanupExecutionResult | null;
}
