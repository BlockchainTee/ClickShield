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
import { buildSolanaCleanupPlan } from "./cleanup.js";
import { buildStableId } from "./ids.js";
import type { SolanaWalletFindingDraft } from "./rules.js";
import { buildSolanaWalletScoreBreakdown } from "./score.js";
import type {
  NormalizedSolanaWalletSnapshot,
  SolanaWalletScanEvaluation,
  SolanaWalletSignals,
} from "./types.js";
import { enforceWalletScanMode } from "../scan-mode.js";

function buildCapabilityBoundaries(): readonly WalletCapabilityBoundary[] {
  return [
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "snapshot",
        capabilityKey: "hydrated_solana_snapshot",
      }),
      area: "snapshot",
      capabilityKey: "hydrated_solana_snapshot",
      status: "supported",
      detail:
        "Phase 4D evaluates only caller-supplied hydrated Solana snapshot data and performs no live lookups during normalization, scoring, or recommendation planning.",
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "finding",
        capabilityKey: "deterministic_solana_findings",
      }),
      area: "finding",
      capabilityKey: "deterministic_solana_findings",
      status: "supported",
      detail:
        "Phase 4D emits deterministic Solana findings, factors, and score breakdowns from the supplied snapshot only.",
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "cleanup_plan",
        capabilityKey: "deterministic_solana_cleanup_guidance",
      }),
      area: "cleanup_plan",
      capabilityKey: "deterministic_solana_cleanup_guidance",
      status: "supported",
      detail:
        "Phase 4D builds deterministic recommendation-only Solana cleanup guidance. It does not claim automatic revoke or disconnect support.",
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "cleanup_execution",
        capabilityKey: "solana_cleanup_execution",
      }),
      area: "cleanup_execution",
      capabilityKey: "solana_cleanup_execution",
      status: "not_supported",
      detail:
        "Phase 4D does not construct Solana transactions, request signatures, or broadcast cleanup actions.",
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
    walletChain: "solana",
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
 * Assembles the shared Layer 4A result, summary, and report contracts for Phase 4D.
 */
export function assembleSolanaWalletEvaluation(input: {
  readonly request: WalletScanRequest;
  readonly snapshot: WalletScanSnapshot;
  readonly normalizedSnapshot: NormalizedSolanaWalletSnapshot;
  readonly signals: SolanaWalletSignals;
  readonly findingDrafts: readonly SolanaWalletFindingDraft[];
  readonly evaluatedAt: string;
  readonly reportVersion: string;
}): SolanaWalletScanEvaluation {
  const normalizedRequest: WalletScanRequest = {
    ...input.request,
    walletAddress: input.normalizedSnapshot.walletAddress,
    scanMode: enforceWalletScanMode("solana", input.request.scanMode),
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
    walletChain: "solana",
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
  const scoreBreakdown = buildSolanaWalletScoreBreakdown(
    input.signals,
    findingsWithFactors,
    riskFactors
  );
  const { cleanupPlan, actionIdsByFindingId } = buildSolanaCleanupPlan(
    input.normalizedSnapshot.walletAddress,
    normalizedRequest.networkId,
    input.evaluatedAt,
    input.normalizedSnapshot,
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
    walletChain: "solana",
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
    walletChain: "solana",
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
