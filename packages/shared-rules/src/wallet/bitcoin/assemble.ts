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
import { buildBitcoinCleanupPlan } from "./cleanup.js";
import { buildStableId } from "./ids.js";
import type { BitcoinWalletFindingDraft } from "./rules.js";
import { buildBitcoinWalletScoreBreakdown } from "./score.js";
import type {
  BitcoinWalletScanEvaluation,
  BitcoinWalletSignals,
  NormalizedBitcoinWalletSnapshot,
} from "./types.js";
import { enforceWalletScanMode } from "../scan-mode.js";

function buildCapabilityBoundaries(): readonly WalletCapabilityBoundary[] {
  return [
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "snapshot",
        capabilityKey: "hydrated_bitcoin_snapshot",
      }),
      area: "snapshot",
      capabilityKey: "hydrated_bitcoin_snapshot",
      status: "supported",
      detail:
        "Phase 4E evaluates only caller-supplied hydrated Bitcoin snapshot data and performs no live lookups during normalization, scoring, or remediation planning.",
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "finding",
        capabilityKey: "deterministic_bitcoin_findings",
      }),
      area: "finding",
      capabilityKey: "deterministic_bitcoin_findings",
      status: "supported",
      detail:
        "Phase 4E emits deterministic Bitcoin findings, risk factors, and score breakdowns from the supplied snapshot only.",
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "cleanup_plan",
        capabilityKey: "deterministic_bitcoin_guidance",
      }),
      area: "cleanup_plan",
      capabilityKey: "deterministic_bitcoin_guidance",
      status: "supported",
      detail:
        "Phase 4E builds deterministic recommendation-only Bitcoin remediation guidance. It does not claim revoke support, one-click cleanup, or automatic fixes.",
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "cleanup_execution",
        capabilityKey: "bitcoin_cleanup_execution",
      }),
      area: "cleanup_execution",
      capabilityKey: "bitcoin_cleanup_execution",
      status: "not_supported",
      detail:
        "Phase 4E does not construct Bitcoin transactions, request signatures, move funds, or broadcast remediation actions.",
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

function buildRiskFactor(finding: WalletFinding): WalletRiskFactor {
  return {
    factorId: buildStableId("wallet_factor", {
      code: finding.metadata.code ?? "",
      findingId: finding.findingId,
      resourceIds: finding.resourceIds,
    }),
    walletChain: "bitcoin",
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
  };
}

/**
 * Assembles the shared Layer 4A result, summary, and report contracts for Phase 4E.
 */
export function assembleBitcoinWalletEvaluation(input: {
  readonly request: WalletScanRequest;
  readonly snapshot: WalletScanSnapshot;
  readonly normalizedSnapshot: NormalizedBitcoinWalletSnapshot;
  readonly signals: BitcoinWalletSignals;
  readonly findingDrafts: readonly BitcoinWalletFindingDraft[];
  readonly evaluatedAt: string;
  readonly reportVersion: string;
}): BitcoinWalletScanEvaluation {
  const normalizedRequest: WalletScanRequest = {
    ...input.request,
    walletChain: "bitcoin",
    walletAddress: input.normalizedSnapshot.walletAddress,
    scanMode: enforceWalletScanMode("bitcoin", input.request.scanMode),
  };
  const normalizedSnapshotContract: WalletScanSnapshot = {
    ...input.snapshot,
    walletChain: "bitcoin",
    walletAddress: input.normalizedSnapshot.walletAddress,
  };

  const findingsWithoutActions: WalletFinding[] = input.findingDrafts.map((draft) => ({
    findingId: buildFindingId(
      input.normalizedSnapshot.walletAddress,
      draft.code,
      draft.resourceIds
    ),
    walletChain: "bitcoin",
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

  const riskFactors = findingsWithoutActions.map(buildRiskFactor);
  const findingsWithFactors = findingsWithoutActions.map((finding, index) => ({
    ...finding,
    riskFactorIds: [riskFactors[index]?.factorId ?? ""].filter(Boolean),
  }));
  const scoreBreakdown = buildBitcoinWalletScoreBreakdown(
    input.signals,
    findingsWithFactors,
    riskFactors
  );
  const { cleanupPlan, actionIdsByFindingId } = buildBitcoinCleanupPlan(
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
    walletChain: "bitcoin",
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
    walletChain: "bitcoin",
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
