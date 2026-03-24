import { buildWalletReportId } from "../report-id.js";
import type {
  WalletCapabilityBoundary,
  WalletFinding,
  WalletReport,
  WalletRiskFactor,
  WalletScanRequest,
  WalletScanResult,
  WalletScanSnapshot,
  WalletSummary,
} from "../types.js";
import { buildStableId } from "./ids.js";
import { buildEvmCleanupPlan } from "./cleanup.js";
import type { EvmWalletFindingDraft } from "./rules.js";
import type {
  EvmWalletScanEvaluation,
  EvmWalletSignals,
  NormalizedEvmWalletSnapshot,
} from "./types.js";
import { buildEvmWalletScoreBreakdown } from "./score.js";

function buildCapabilityBoundaries(): readonly WalletCapabilityBoundary[] {
  return [
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "snapshot",
        capabilityKey: "hydrated_evm_snapshot",
      }),
      area: "snapshot",
      capabilityKey: "hydrated_evm_snapshot",
      status: "supported",
      detail:
        "Phase 4B evaluates only caller-supplied hydrated EVM snapshot data and performs no live lookups during normalization or scoring.",
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "finding",
        capabilityKey: "deterministic_evm_findings",
      }),
      area: "finding",
      capabilityKey: "deterministic_evm_findings",
      status: "supported",
      detail:
        "Phase 4B emits deterministic EVM approval findings, factors, and score breakdowns from the supplied snapshot only.",
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "cleanup_plan",
        capabilityKey: "recommendation_only_cleanup_plan",
      }),
      area: "cleanup_plan",
      capabilityKey: "recommendation_only_cleanup_plan",
      status: "partial",
      detail:
        "Phase 4B produces recommendation-only cleanup actions. It does not construct or submit revoke transactions.",
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "cleanup_execution",
        capabilityKey: "evm_cleanup_execution",
      }),
      area: "cleanup_execution",
      capabilityKey: "evm_cleanup_execution",
      status: "not_supported",
      detail:
        "Cleanup execution is intentionally out of scope for Phase 4B and is deferred to Phase 4C.",
    },
  ];
}

function buildFindingId(
  walletAddress: string,
  code: string,
  resourceIds: readonly string[]
): string {
  return buildStableId("wallet_finding", {
    code,
    resourceIds,
    walletAddress,
  });
}

function buildRiskFactors(findings: readonly WalletFinding[]): readonly WalletRiskFactor[] {
  return findings.map((finding) => ({
    factorId: buildStableId("wallet_factor", {
      code: finding.metadata.code ?? "",
      findingId: finding.findingId,
      resourceIds: finding.resourceIds,
    }),
    walletChain: "evm",
    category: finding.category,
    riskLevel: finding.riskLevel,
    title: finding.title,
    summary: finding.summary,
    findingIds: [finding.findingId],
    resourceIds: finding.resourceIds,
    metadata: {
      code: finding.metadata.code ?? "",
      sourceFindingId: finding.findingId,
    },
  }));
}

/**
 * Assembles the shared Layer 4A result, summary, and report contracts for Phase 4B.
 */
export function assembleEvmWalletEvaluation(input: {
  readonly request: WalletScanRequest;
  readonly snapshot: WalletScanSnapshot;
  readonly normalizedSnapshot: NormalizedEvmWalletSnapshot;
  readonly signals: EvmWalletSignals;
  readonly findingDrafts: readonly EvmWalletFindingDraft[];
  readonly evaluatedAt: string;
  readonly reportVersion: string;
}): EvmWalletScanEvaluation {
  const normalizedRequest: WalletScanRequest = {
    ...input.request,
    walletAddress: input.normalizedSnapshot.walletAddress,
  };
  const normalizedSnapshotContract: WalletScanSnapshot = {
    ...input.snapshot,
    walletAddress: input.normalizedSnapshot.walletAddress,
  };
  const findingsWithoutActions: WalletFinding[] = input.findingDrafts.map((draft) => ({
    findingId: buildFindingId(
      input.normalizedSnapshot.walletAddress,
      draft.code,
      draft.resourceIds
    ),
    walletChain: "evm",
    category: draft.category,
    riskLevel: draft.riskLevel,
    status: "open",
    title: draft.title,
    summary: draft.summary,
    detectedAt: input.evaluatedAt,
    resourceIds: draft.resourceIds,
    riskFactorIds: [],
    cleanupActionIds: [],
    evidence: draft.evidence,
    metadata: draft.metadata,
  }));
  const riskFactors = buildRiskFactors(findingsWithoutActions);
  const riskFactorByCode = new Map(
    riskFactors.map((factor) => [factor.metadata.code, factor.factorId])
  );
  const findingsWithFactors = findingsWithoutActions.map((finding) => ({
    ...finding,
    riskFactorIds: riskFactorByCode.get(finding.metadata.code ?? "")
      ? [riskFactorByCode.get(finding.metadata.code ?? "") as string]
      : [],
  }));
  const scoreBreakdown = buildEvmWalletScoreBreakdown(
    input.normalizedSnapshot,
    input.signals,
    findingsWithFactors,
    riskFactors
  );
  const { cleanupPlan, actionIdsByFindingId } = buildEvmCleanupPlan(
    input.normalizedSnapshot.walletAddress,
    normalizedRequest.networkId,
    input.evaluatedAt,
    findingsWithFactors,
    riskFactors
  );
  const findings = findingsWithFactors.map((finding) => ({
    ...finding,
    cleanupActionIds: actionIdsByFindingId[finding.findingId] ?? [],
  }));
  const capabilityBoundaries = buildCapabilityBoundaries();

  const result: WalletScanResult = {
    requestId: normalizedRequest.requestId,
    snapshotId: normalizedSnapshotContract.snapshotId,
    walletChain: "evm",
    walletAddress: input.normalizedSnapshot.walletAddress,
    networkId: normalizedRequest.networkId,
    evaluatedAt: input.evaluatedAt,
    findings,
    riskFactors,
    scoreBreakdown,
    cleanupPlan,
    capabilityBoundaries,
  };

  const summary: WalletSummary = {
    walletChain: "evm",
    walletAddress: input.normalizedSnapshot.walletAddress,
    networkId: normalizedRequest.networkId,
    scanMode: normalizedRequest.scanMode,
    generatedAt: input.evaluatedAt,
    snapshotCapturedAt: normalizedSnapshotContract.capturedAt,
    score: scoreBreakdown.totalScore,
    riskLevel: scoreBreakdown.riskLevel,
    findingCount: findings.length,
    openFindingCount: findings.length,
    cleanupActionCount: cleanupPlan?.actions.length ?? 0,
    actionableFindingCount: findings.filter(
      (finding) => finding.cleanupActionIds.length > 0
    ).length,
  };

  const report: WalletReport = {
    reportId: buildWalletReportId({
      reportVersion: input.reportVersion,
      generatedAt: input.evaluatedAt,
      request: normalizedRequest,
      snapshot: normalizedSnapshotContract,
      result,
      summary,
      cleanupExecution: null,
    }),
    reportVersion: input.reportVersion,
    generatedAt: input.evaluatedAt,
    request: normalizedRequest,
    snapshot: normalizedSnapshotContract,
    result,
    summary,
    cleanupExecution: null,
  };

  return {
    score: scoreBreakdown.totalScore,
    riskLevel: scoreBreakdown.riskLevel,
    normalizedSnapshot: input.normalizedSnapshot,
    signals: input.signals,
    result,
    summary,
    report,
  };
}
