import type { ThreatDashboardScanSource } from "../../src/dashboard/adapters";
import type {
  ThreatDashboardFilterState,
  ThreatSystemStatus,
} from "../../src/dashboard/types";
import type { WalletLayer4Output } from "../../src/lib/shared-rules";

export const DEFAULT_DASHBOARD_FILTERS: ThreatDashboardFilterState = {
  layer: "all",
  severity: "all",
  decision: "all",
  timeWindow: "all",
  sourceSurface: "all",
};

export function createThreatSystemStatus(): ThreatSystemStatus {
  return {
    dashboardTruthState: "available",
    dataTruthState: "available",
    intelState: "available",
    snapshotVersion: "dashboard-test-snapshot",
    lastRefresh: "2026-03-26T12:00:00.000Z",
    providerState: "rule-only",
    failSafeState: "active",
    engineState: "active",
    shieldMode: "normal",
    databaseState: "available",
    truthSummary: "Desktop test status is available.",
    truthSignals: [],
  };
}

export function createLayer3ScanSource(
  overrides: Partial<ThreatDashboardScanSource> = {},
): ThreatDashboardScanSource {
  return {
    id: overrides.id ?? "layer3-scan-1",
    url: overrides.url ?? "https://drainer.example",
    riskLevel: overrides.riskLevel ?? "DANGEROUS",
    riskScore: overrides.riskScore ?? 92,
    threatType: overrides.threatType ?? "wallet drainer",
    checkedAt: overrides.checkedAt ?? "2026-03-26T12:00:00.000Z",
    source: overrides.source ?? "extension",
    engine: overrides.engine ?? "rules",
    userEmail: overrides.userEmail ?? "analyst@clickshield.app",
    userType: overrides.userType ?? "business",
    orgName: overrides.orgName ?? "ClickShield",
    deviceId: overrides.deviceId ?? "desktop-device",
    ruleReason:
      overrides.ruleReason ??
      "Transaction request matched a known wallet-drainer pattern.",
    shortAdvice:
      overrides.shortAdvice ??
      "Do not approve the transaction until the contract is independently verified.",
    detectedBy: overrides.detectedBy ?? "wallet-drainer-rule",
    detectedByType: overrides.detectedByType ?? "rule",
    ruleName: overrides.ruleName ?? "LAYER3_WALLET_DRAINER",
    filename: overrides.filename,
    mimeType: overrides.mimeType,
    layer: overrides.layer ?? "layer3",
    decision: overrides.decision ?? "blocked",
    severity: overrides.severity ?? "high",
    surface: overrides.surface ?? "wallet",
  };
}

export function createWalletLayer4Report(
  overrides: {
    readonly reportId?: string;
    readonly generatedAt?: string;
    readonly walletAddress?: string;
    readonly classification?: WalletLayer4Output["result"]["classification"];
    readonly statusLabel?: string;
    readonly findingCodes?: readonly string[];
    readonly findingSpecs?: readonly {
      readonly code?: string;
      readonly findingId?: string;
    }[];
    readonly cleanupActionCount?: number;
  } = {},
): WalletLayer4Output {
  const generatedAt = overrides.generatedAt ?? "2026-03-26T12:05:00.000Z";
  const reportId = overrides.reportId ?? "wallet-report-1";
  const walletAddress = overrides.walletAddress ?? "0x1111111111111111111111111111111111111111";
  const classification = overrides.classification ?? "issues_detected";
  const statusLabel =
    overrides.statusLabel ??
    "Scan completed. Issues detected. Follow-up action is available.";
  const findingCodes =
    overrides.findingCodes ?? ["ALLOWANCE_UNLIMITED", "SUSPICIOUS_SPENDER"];
  const findingSpecs =
    overrides.findingSpecs ??
    findingCodes.map((code, index) => ({
      code,
      findingId: `finding:${reportId}:${index + 1}`,
    }));
  const cleanupActionCount = overrides.cleanupActionCount ?? 1;
  const requestId = `request:${reportId}`;
  const snapshotId = `snapshot:${reportId}`;
  const planId = `cleanup-plan:${reportId}`;
  const executionPerformed = classification === "execution_reported";
  const actionable = cleanupActionCount > 0;

  const findings = findingSpecs.map((findingSpec, index) => {
    const code = findingSpec.code ?? "";
    const findingId = findingSpec.findingId ?? `finding:${reportId}:${index + 1}`;

    return {
      findingId,
      walletChain: "evm" as const,
      category: "authorization" as const,
      riskLevel: "medium" as const,
      status: "open" as const,
      title:
        index === 0 ? "Unlimited approval" : `Finding ${String(index + 1)}`,
      summary:
        index === 0
          ? "Approval allows an unlimited third-party spend."
          : `Summary for ${code || findingId}.`,
      detectedAt: generatedAt,
      resourceIds: [`resource:${reportId}:${index + 1}`],
      riskFactorIds: [`factor:${reportId}:${index + 1}`],
      cleanupActionIds: actionable ? [`action:${reportId}:${index + 1}`] : [],
      evidence: [
        {
          evidenceId: `evidence:${reportId}:${index + 1}`,
          sourceType: "derived" as const,
          sourceId: `source:${reportId}:${index + 1}`,
          label: `Evidence for ${code || findingId}`,
        },
      ],
      metadata: code ? { code } : {},
    };
  });

  const cleanupPlan =
    actionable
      ? {
          planId,
          walletChain: "evm" as const,
          walletAddress,
          networkId: "1",
          createdAt: generatedAt,
          summary: "Follow-up action is available.",
          actions: [
            {
              actionId: `action:${reportId}:1`,
              walletChain: "evm" as const,
              kind: "revoke_authorization" as const,
              executionMode: "automated" as const,
              executionType: "wallet_signature" as const,
              status: "ready" as const,
              requiresSignature: true,
              supportStatus: "supported" as const,
              title: "Revoke unlimited approval",
              description: "Revoke the spender authorization.",
              priority: "medium" as const,
              target: {
                targetId: `target:${reportId}:1`,
                targetKind: "authorization" as const,
                label: "Token approval",
                metadata: {},
              },
              findingIds: findings.map((finding) => finding.findingId),
              riskFactorIds: findings.map((finding) => finding.riskFactorIds[0]),
              supportDetail: null,
              metadata: {},
            },
          ],
          projectedScore: 30,
          projectedRiskLevel: "low" as const,
        }
      : null;

  return {
    reportId,
    reportVersion: "wallet-report-v1",
    generatedAt,
    request: {
      requestId,
      walletChain: "evm",
      walletAddress,
      networkId: "1",
      scanMode: "full",
      requestedAt: generatedAt,
      metadata: {},
    },
    snapshot: {
      snapshotId,
      requestId,
      walletChain: "evm",
      walletAddress,
      networkId: "1",
      capturedAt: generatedAt,
      sections: [],
      metadata: {},
    },
    result: {
      requestId,
      snapshotId,
      walletChain: "evm",
      walletAddress,
      networkId: "1",
      evaluatedAt: generatedAt,
      findings,
      riskFactors: [],
      scoreBreakdown: {
        totalScore: actionable ? 72 : 10,
        riskLevel: actionable ? "medium" : "low",
        rationale: "Deterministic dashboard test fixture.",
        components: [],
      },
      cleanupPlan,
      capabilityTier: "full",
      executionPerformed,
      actionable,
      classification,
      statusLabel,
      capabilityBoundaries: [],
    },
    summary: {
      walletChain: "evm",
      walletAddress,
      networkId: "1",
      scanMode: "full",
      generatedAt,
      snapshotCapturedAt: generatedAt,
      capabilityTier: "full",
      score: actionable ? 72 : 10,
      riskLevel: actionable ? "medium" : "low",
      findingCount: findings.length,
      openFindingCount: findings.length,
      cleanupActionCount,
      actionableFindingCount: actionable ? findings.length : 0,
      executionPerformed,
      actionable,
      classification,
      statusLabel,
    },
    cleanupExecution:
      executionPerformed && cleanupPlan
        ? {
            planId,
            walletChain: "evm",
            walletAddress,
            networkId: "1",
            status: "completed",
            startedAt: generatedAt,
            completedAt: generatedAt,
            actionResults: cleanupPlan.actions.map((action) => ({
              actionId: action.actionId,
              status: "succeeded" as const,
              executedAt: generatedAt,
              detail: "Execution was reported.",
              evidence: [
                {
                  evidenceId: `execution:${action.actionId}`,
                  sourceType: "derived" as const,
                  sourceId: action.actionId,
                  label: "Execution record",
                },
              ],
            })),
          }
        : null,
  };
}
