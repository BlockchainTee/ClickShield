import { assertWalletReportCapabilityTruth } from "./capabilities.js";
import { serializeCanonicalJson, sha256Hex } from "../intel/hash.js";
import type {
  EvmCleanupAction as EvmCleanupActionContract,
  EvmCleanupBatchPlan,
  EvmRevocableApprovalTarget,
  EvmWalletCleanupPlan,
} from "./evm/cleanup-types.js";
import type {
  WalletCapabilityBoundary,
  WalletCleanupAction,
  WalletCleanupActionResult,
  WalletCleanupExecutionResult,
  WalletCleanupPlan,
  WalletCleanupTarget,
  WalletEvidenceRef,
  WalletFinding,
  WalletReport,
  WalletRiskFactor,
  WalletScanRequest,
  WalletScanResult,
  WalletScanSnapshot,
  WalletScoreBreakdown,
  WalletScoreComponent,
  WalletSnapshotSection,
  WalletSummary,
} from "./types.js";

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

type CanonicalJsonObject = { readonly [key: string]: CanonicalJsonValue };

function canonicalizeStringRecord(
  record: Readonly<Record<string, string>>
): CanonicalJsonObject {
  const canonicalRecord: Record<string, string> = {};

  for (const key of Object.keys(record).sort()) {
    canonicalRecord[key] = record[key];
  }

  return canonicalRecord;
}

function copyStringList(values: readonly string[]): readonly string[] {
  return values.map((value) => value);
}

function canonicalizeSnapshotSection(
  section: WalletSnapshotSection
): CanonicalJsonObject {
  return {
    contentHash: section.contentHash,
    itemCount: section.itemCount,
    label: section.label,
    metadata: canonicalizeStringRecord(section.metadata),
    sectionId: section.sectionId,
    sectionType: section.sectionType,
  };
}

function canonicalizeEvidenceRef(evidence: WalletEvidenceRef): CanonicalJsonObject {
  return {
    evidenceId: evidence.evidenceId,
    label: evidence.label,
    sourceId: evidence.sourceId,
    sourceType: evidence.sourceType,
  };
}

function canonicalizeCapabilityBoundary(
  boundary: WalletCapabilityBoundary
): CanonicalJsonObject {
  return {
    area: boundary.area,
    boundaryId: boundary.boundaryId,
    capabilityKey: boundary.capabilityKey,
    detail: boundary.detail,
    status: boundary.status,
  };
}

function canonicalizeFinding(finding: WalletFinding): CanonicalJsonObject {
  return {
    category: finding.category,
    cleanupActionIds: copyStringList(finding.cleanupActionIds),
    detectedAt: finding.detectedAt,
    evidence: finding.evidence.map(canonicalizeEvidenceRef),
    findingId: finding.findingId,
    metadata: canonicalizeStringRecord(finding.metadata),
    resourceIds: copyStringList(finding.resourceIds),
    riskFactorIds: copyStringList(finding.riskFactorIds),
    riskLevel: finding.riskLevel,
    status: finding.status,
    summary: finding.summary,
    title: finding.title,
    walletChain: finding.walletChain,
  };
}

function canonicalizeRiskFactor(factor: WalletRiskFactor): CanonicalJsonObject {
  return {
    category: factor.category,
    factorId: factor.factorId,
    findingIds: copyStringList(factor.findingIds),
    metadata: canonicalizeStringRecord(factor.metadata),
    resourceIds: copyStringList(factor.resourceIds),
    riskLevel: factor.riskLevel,
    summary: factor.summary,
    title: factor.title,
    walletChain: factor.walletChain,
  };
}

function canonicalizeScoreComponent(
  component: WalletScoreComponent
): CanonicalJsonObject {
  return {
    componentId: component.componentId,
    findingIds: copyStringList(component.findingIds),
    label: component.label,
    maxScore: component.maxScore,
    rationale: component.rationale,
    riskFactorIds: copyStringList(component.riskFactorIds),
    riskLevel: component.riskLevel,
    score: component.score,
  };
}

function canonicalizeScoreBreakdown(
  breakdown: WalletScoreBreakdown
): CanonicalJsonObject {
  return {
    components: breakdown.components.map(canonicalizeScoreComponent),
    rationale: breakdown.rationale,
    riskLevel: breakdown.riskLevel,
    totalScore: breakdown.totalScore,
  };
}

function canonicalizeCleanupTarget(target: WalletCleanupTarget): CanonicalJsonObject {
  return {
    label: target.label,
    metadata: canonicalizeStringRecord(target.metadata),
    targetId: target.targetId,
    targetKind: target.targetKind,
  };
}

function isEvmCleanupAction(
  action: WalletCleanupAction
): action is EvmCleanupActionContract {
  return (
    action.walletChain === "evm" &&
    "approval" in action &&
    "estimatedRiskReduction" in action &&
    "explanation" in action &&
    "revocationMethod" in action
  );
}

function isEvmWalletCleanupPlan(plan: WalletCleanupPlan): plan is EvmWalletCleanupPlan {
  return plan.walletChain === "evm" && "batches" in plan;
}

function canonicalizeEvmApprovalTarget(
  approval: EvmRevocableApprovalTarget
): CanonicalJsonObject {
  return {
    approvalId: approval.approvalId,
    approvalKind: approval.approvalKind,
    currentState: approval.currentState,
    intendedState: approval.intendedState,
    spenderAddress: approval.spenderAddress,
    tokenAddress: approval.tokenAddress,
    tokenId: approval.tokenId,
  };
}

function canonicalizeCleanupAction(
  action: WalletCleanupAction
): CanonicalJsonObject {
  const canonicalAction: CanonicalJsonObject = {
    actionId: action.actionId,
    description: action.description,
    executionMode: action.executionMode,
    executionType: action.executionType,
    findingIds: copyStringList(action.findingIds),
    kind: action.kind,
    metadata: canonicalizeStringRecord(action.metadata),
    priority: action.priority,
    requiresSignature: action.requiresSignature,
    riskFactorIds: copyStringList(action.riskFactorIds),
    status: action.status,
    supportDetail: action.supportDetail,
    supportStatus: action.supportStatus,
    target: canonicalizeCleanupTarget(action.target),
    title: action.title,
    walletChain: action.walletChain,
  };

  if (!isEvmCleanupAction(action)) {
    return canonicalAction;
  }

  return {
    ...canonicalAction,
    approval: canonicalizeEvmApprovalTarget(action.approval),
    estimatedRiskReduction: action.estimatedRiskReduction,
    explanation: action.explanation,
    revocationMethod: action.revocationMethod,
  };
}

function canonicalizeEvmCleanupBatch(batch: EvmCleanupBatchPlan): CanonicalJsonObject {
  return {
    actionIds: copyStringList(batch.actionIds),
    actions: batch.actions.map(canonicalizeCleanupAction),
    batchId: batch.batchId,
    createdAt: batch.createdAt,
    executionKind: batch.executionKind,
    networkId: batch.networkId,
    summary: batch.summary,
    supportStatus: batch.supportStatus,
    title: batch.title,
    walletAddress: batch.walletAddress,
    walletChain: batch.walletChain,
  };
}

function canonicalizeCleanupPlan(
  plan: WalletCleanupPlan | null
): CanonicalJsonValue {
  if (plan === null) {
    return null;
  }

  const canonicalPlan: CanonicalJsonObject = {
    actions: plan.actions.map(canonicalizeCleanupAction),
    createdAt: plan.createdAt,
    networkId: plan.networkId,
    planId: plan.planId,
    projectedRiskLevel: plan.projectedRiskLevel,
    projectedScore: plan.projectedScore,
    summary: plan.summary,
    walletAddress: plan.walletAddress,
    walletChain: plan.walletChain,
  };

  if (!isEvmWalletCleanupPlan(plan)) {
    return canonicalPlan;
  }

  return {
    ...canonicalPlan,
    batches: plan.batches.map(canonicalizeEvmCleanupBatch),
  };
}

function canonicalizeCleanupActionResult(
  actionResult: WalletCleanupActionResult
): CanonicalJsonObject {
  return {
    actionId: actionResult.actionId,
    detail: actionResult.detail,
    evidence: actionResult.evidence.map(canonicalizeEvidenceRef),
    executedAt: actionResult.executedAt,
    status: actionResult.status,
  };
}

function canonicalizeCleanupExecution(
  cleanupExecution: WalletCleanupExecutionResult | null
): CanonicalJsonValue {
  if (cleanupExecution === null) {
    return null;
  }

  return {
    actionResults: cleanupExecution.actionResults.map(
      canonicalizeCleanupActionResult
    ),
    completedAt: cleanupExecution.completedAt,
    networkId: cleanupExecution.networkId,
    planId: cleanupExecution.planId,
    startedAt: cleanupExecution.startedAt,
    status: cleanupExecution.status,
    walletAddress: cleanupExecution.walletAddress,
    walletChain: cleanupExecution.walletChain,
  };
}

function canonicalizeRequest(request: WalletScanRequest): CanonicalJsonObject {
  return {
    metadata: canonicalizeStringRecord(request.metadata),
    networkId: request.networkId,
    requestId: request.requestId,
    requestedAt: request.requestedAt,
    scanMode: request.scanMode,
    walletAddress: request.walletAddress,
    walletChain: request.walletChain,
  };
}

function canonicalizeSnapshot(snapshot: WalletScanSnapshot): CanonicalJsonObject {
  return {
    capturedAt: snapshot.capturedAt,
    metadata: canonicalizeStringRecord(snapshot.metadata),
    networkId: snapshot.networkId,
    requestId: snapshot.requestId,
    sections: snapshot.sections.map(canonicalizeSnapshotSection),
    snapshotId: snapshot.snapshotId,
    walletAddress: snapshot.walletAddress,
    walletChain: snapshot.walletChain,
  };
}

function canonicalizeResult(result: WalletScanResult): CanonicalJsonObject {
  return {
    capabilityBoundaries: result.capabilityBoundaries.map(
      canonicalizeCapabilityBoundary
    ),
    cleanupPlan: canonicalizeCleanupPlan(result.cleanupPlan),
    evaluatedAt: result.evaluatedAt,
    findings: result.findings.map(canonicalizeFinding),
    networkId: result.networkId,
    requestId: result.requestId,
    riskFactors: result.riskFactors.map(canonicalizeRiskFactor),
    scoreBreakdown: canonicalizeScoreBreakdown(result.scoreBreakdown),
    snapshotId: result.snapshotId,
    walletAddress: result.walletAddress,
    walletChain: result.walletChain,
  };
}

function canonicalizeSummary(summary: WalletSummary): CanonicalJsonObject {
  return {
    actionableFindingCount: summary.actionableFindingCount,
    cleanupActionCount: summary.cleanupActionCount,
    findingCount: summary.findingCount,
    generatedAt: summary.generatedAt,
    networkId: summary.networkId,
    openFindingCount: summary.openFindingCount,
    riskLevel: summary.riskLevel,
    scanMode: summary.scanMode,
    score: summary.score,
    snapshotCapturedAt: summary.snapshotCapturedAt,
    walletAddress: summary.walletAddress,
    walletChain: summary.walletChain,
  };
}

function canonicalizeReportIdInput(input: WalletReportIdInput): CanonicalJsonObject {
  return {
    cleanupExecution: canonicalizeCleanupExecution(input.cleanupExecution),
    generatedAt: input.generatedAt,
    reportVersion: input.reportVersion,
    request: canonicalizeRequest(input.request),
    result: canonicalizeResult(input.result),
    snapshot: canonicalizeSnapshot(input.snapshot),
    summary: canonicalizeSummary(input.summary),
  };
}

/**
 * Canonical input shape for deterministic wallet report identifier generation.
 */
export interface WalletReportIdInput {
  /** Version of the shared report contract. */
  readonly reportVersion: WalletReport["reportVersion"];
  /** ISO-8601 timestamp describing when the report was assembled. */
  readonly generatedAt: WalletReport["generatedAt"];
  /** Original request included in the report. */
  readonly request: WalletScanRequest;
  /** Snapshot included in the report. */
  readonly snapshot: WalletScanSnapshot;
  /** Evaluation result included in the report. */
  readonly result: WalletScanResult;
  /** Summary included in the report. */
  readonly summary: WalletSummary;
  /** Cleanup execution outcome included in the report, if any. */
  readonly cleanupExecution: WalletCleanupExecutionResult | null;
}

/**
 * Builds a deterministic wallet report identifier from declared Layer 4 contract fields only.
 */
export function buildWalletReportId(input: WalletReportIdInput): string {
  assertWalletReportCapabilityTruth(input);
  const canonicalPayload = serializeCanonicalJson(canonicalizeReportIdInput(input));
  return `wallet_report_${sha256Hex(canonicalPayload)}`;
}
