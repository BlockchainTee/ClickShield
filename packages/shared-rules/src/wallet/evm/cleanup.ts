import type {
  WalletCleanupAction,
  WalletCleanupPlan,
  WalletFinding,
  WalletRiskFactor,
} from "../types.js";
import {
  EVM_WALLET_FINDING_CODES,
} from "./constants.js";
import { buildStableId } from "./ids.js";

const PHASE_4B_SUPPORT_DETAIL =
  "Phase 4B produces recommendation-only cleanup steps. Transaction construction and execution are deferred to Phase 4C.";

function buildActionTitle(code: string): string {
  switch (code) {
    case EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER:
      return "Review flagged spender approvals";
    case EVM_WALLET_FINDING_CODES.RISKY_CONTRACT:
      return "Review risky contract approvals";
    case EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL:
      return "Review unlimited approvals";
    case EVM_WALLET_FINDING_CODES.STALE_APPROVAL:
      return "Review stale approvals";
    default:
      return "Review approval footprint";
  }
}

function buildActionDescription(code: string): string {
  switch (code) {
    case EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER:
      return "Prioritize approvals tied to flagged spenders and revoke any authorization that is no longer required.";
    case EVM_WALLET_FINDING_CODES.RISKY_CONTRACT:
      return "Confirm whether risky contract exposures are expected and remove approvals that are no longer needed.";
    case EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL:
      return "Replace unlimited approvals with constrained allowances when possible, or revoke unused operator access.";
    case EVM_WALLET_FINDING_CODES.STALE_APPROVAL:
      return "Review older approvals for current relevance and revoke dormant access.";
    default:
      return "Trim redundant approvals and keep only currently required authorizations.";
  }
}

/**
 * Builds the recommendation-only cleanup plan for Phase 4B EVM scan output.
 */
export function buildEvmCleanupPlan(
  walletAddress: string,
  networkId: string,
  evaluatedAt: string,
  findings: readonly WalletFinding[],
  riskFactors: readonly WalletRiskFactor[]
): {
  readonly cleanupPlan: WalletCleanupPlan | null;
  readonly actionIdsByFindingId: Readonly<Record<string, readonly string[]>>;
} {
  if (findings.length === 0) {
    return {
      cleanupPlan: null,
      actionIdsByFindingId: {},
    };
  }

  const riskFactorByCode = new Map(
    riskFactors.map((factor) => [factor.metadata.code, factor])
  );
  const actions: WalletCleanupAction[] = findings.map((finding) => {
    const code = finding.metadata.code ?? "";
    const factor = riskFactorByCode.get(code);
    const kind =
      code === EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS
        ? "manual_review"
        : "revoke_authorization";

    return {
      actionId: buildStableId("wallet_action", {
        code,
        findingId: finding.findingId,
        walletAddress,
      }),
      walletChain: "evm",
      kind,
      executionMode: "guided",
      supportStatus: "partial",
      title: buildActionTitle(code),
      description: buildActionDescription(code),
      priority: finding.riskLevel,
      target: {
        targetId: buildStableId("wallet_target", {
          code,
          walletAddress,
        }),
        targetKind:
          finding.category === "counterparty" ? "counterparty" : "authorization",
        label:
          finding.category === "counterparty"
            ? "Impacted counterparties"
            : "Impacted approvals",
        metadata: {
          code,
        },
      },
      findingIds: [finding.findingId],
      riskFactorIds: factor ? [factor.factorId] : [],
      supportDetail: PHASE_4B_SUPPORT_DETAIL,
      metadata: {
        code,
      },
    };
  });

  const actionIdsByFindingId: Record<string, readonly string[]> = {};
  for (const action of actions) {
    for (const findingId of action.findingIds) {
      actionIdsByFindingId[findingId] = [...(actionIdsByFindingId[findingId] ?? []), action.actionId];
    }
  }

  return {
    cleanupPlan: {
      planId: buildStableId("wallet_plan", {
        networkId,
        walletAddress,
        actions: actions.map((action) => action.actionId),
      }),
      walletChain: "evm",
      walletAddress,
      networkId,
      createdAt: evaluatedAt,
      summary: `Review ${actions.length} recommendation-only cleanup action(s). Execution remains deferred to Phase 4C.`,
      actions,
      projectedScore: null,
      projectedRiskLevel: null,
    },
    actionIdsByFindingId,
  };
}
