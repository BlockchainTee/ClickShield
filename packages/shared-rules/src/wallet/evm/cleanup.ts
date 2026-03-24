import type {
  WalletFinding,
  WalletRiskFactor,
} from "../types.js";
import { EVM_WALLET_FINDING_CODES } from "./constants.js";
import { getEvmCleanupEligibility } from "./cleanup-eligibility.js";
import type {
  EvmCleanupAction,
  EvmCleanupBatchPlan,
  EvmWalletCleanupPlan,
} from "./cleanup-types.js";
import { buildStableId } from "./ids.js";
import type { NormalizedEvmApprovalState } from "./types.js";

const PHASE_4C_SUPPORT_DETAIL =
  "Prepared from normalized approval data only. User review, signature, submission, and confirmation occur outside this layer.";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function compareRiskLevel(left: EvmCleanupAction["priority"], right: EvmCleanupAction["priority"]): number {
  const order = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  } as const;

  return order[left] - order[right];
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function compareApprovals(
  left: NormalizedEvmApprovalState,
  right: NormalizedEvmApprovalState
): number {
  return (
    left.approvalId.localeCompare(right.approvalId) ||
    left.tokenAddress.localeCompare(right.tokenAddress) ||
    left.spenderAddress.localeCompare(right.spenderAddress) ||
    (left.tokenId ?? "").localeCompare(right.tokenId ?? "")
  );
}

function deduplicateApprovals(
  approvals: readonly NormalizedEvmApprovalState[]
): readonly NormalizedEvmApprovalState[] {
  const uniqueApprovals = new Map<string, NormalizedEvmApprovalState>();
  for (const approval of [...approvals].sort(compareApprovals)) {
    if (!uniqueApprovals.has(approval.approvalId)) {
      uniqueApprovals.set(approval.approvalId, approval);
    }
  }

  return [...uniqueApprovals.values()];
}

function hasSevereSpenderFlag(approval: NormalizedEvmApprovalState): boolean {
  return approval.spenderFlags.some((flag) =>
    ["drainer", "malicious", "phishing", "exploit", "sanctioned"].includes(flag)
  );
}

function getFindingPriority(
  approval: NormalizedEvmApprovalState,
  finding: WalletFinding
): EvmCleanupAction["priority"] {
  switch (finding.metadata.code) {
    case EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER:
      return approval.spenderRiskLevel === "critical" || hasSevereSpenderFlag(approval)
        ? "critical"
        : "high";
    case EVM_WALLET_FINDING_CODES.RISKY_CONTRACT:
      return "high";
    case EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL:
      if (approval.spenderDisposition === "flagged" || approval.hasRiskyContractExposure) {
        return "critical";
      }
      return approval.spenderDisposition === "unknown" ? "high" : "medium";
    case EVM_WALLET_FINDING_CODES.STALE_APPROVAL:
      return "medium";
    case EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS:
      return "medium";
    default:
      return finding.riskLevel;
  }
}

function buildActionTitle(approval: NormalizedEvmApprovalState): string {
  switch (approval.approvalKind) {
    case "erc20_allowance":
      return "Revoke ERC-20 allowance";
    case "erc721_token":
      return "Clear ERC-721 token approval";
    case "erc721_operator":
      return "Revoke ERC-721 operator approval";
    case "erc1155_operator":
      return "Revoke ERC-1155 operator approval";
  }
}

function buildActionDescription(approval: NormalizedEvmApprovalState): string {
  switch (approval.approvalKind) {
    case "erc20_allowance":
      return `Prepare approve(spender, 0) for ${approval.spenderAddress} on token ${approval.tokenAddress}.`;
    case "erc721_token":
      return `Prepare approve(${ZERO_ADDRESS}, tokenId) to clear token ${approval.tokenId ?? ""} approval on ${approval.tokenAddress}.`;
    case "erc721_operator":
      return `Prepare setApprovalForAll(operator, false) for ${approval.spenderAddress} on ERC-721 contract ${approval.tokenAddress}.`;
    case "erc1155_operator":
      return `Prepare setApprovalForAll(operator, false) for ${approval.spenderAddress} on ERC-1155 contract ${approval.tokenAddress}.`;
  }
}

function buildApprovalCurrentState(approval: NormalizedEvmApprovalState): string {
  switch (approval.approvalKind) {
    case "erc20_allowance":
      return approval.amount ?? "0";
    case "erc721_token":
      return approval.spenderAddress;
    case "erc721_operator":
    case "erc1155_operator":
      return "true";
  }
}

function buildApprovalIntendedState(approval: NormalizedEvmApprovalState): string {
  switch (approval.approvalKind) {
    case "erc20_allowance":
      return "0";
    case "erc721_token":
      return ZERO_ADDRESS;
    case "erc721_operator":
    case "erc1155_operator":
      return "false";
  }
}

function buildTargetLabel(approval: NormalizedEvmApprovalState): string {
  return `${approval.approvalKind}:${approval.tokenAddress}`;
}

function approvalMatchesFinding(
  approval: NormalizedEvmApprovalState,
  finding: WalletFinding
): boolean {
  if (finding.resourceIds.includes(approval.approvalId)) {
    return true;
  }

  if (finding.metadata.code === EVM_WALLET_FINDING_CODES.RISKY_CONTRACT) {
    return approval.riskyContractExposureIds.some((resourceId) =>
      finding.resourceIds.includes(resourceId)
    );
  }

  return false;
}

function buildBatchPlans(
  actions: readonly EvmCleanupAction[],
  walletAddress: string,
  networkId: string,
  evaluatedAt: string
): readonly EvmCleanupBatchPlan[] {
  const grouped = new Map<string, EvmCleanupAction[]>();
  for (const action of actions) {
    const key = `${action.revocationMethod}:${action.approval.tokenAddress}`;
    const existing = grouped.get(key) ?? [];
    grouped.set(key, [...existing, action]);
  }

  return [...grouped.entries()].map(([, batchActions]) => ({
    batchId: buildStableId("wallet_batch", {
      actionIds: batchActions.map((action) => action.actionId),
      networkId,
      walletAddress,
    }),
    walletChain: "evm",
    walletAddress,
    networkId,
    createdAt: evaluatedAt,
    supportStatus: "partial",
    executionKind: "multiple_transactions",
    title: `Review ${batchActions.length} revoke action(s)`,
    summary: `Grouped by ${batchActions[0]?.revocationMethod ?? "revoke"} on ${batchActions[0]?.approval.tokenAddress ?? "unknown contract"}. Execution remains explicit and may require ${batchActions.length} separate transaction(s).`,
    actionIds: batchActions.map((action) => action.actionId),
    actions: batchActions,
  }));
}

/**
 * Builds the deterministic EVM cleanup plan for Phase 4C revoke preparation.
 */
export function buildEvmCleanupPlan(
  walletAddress: string,
  networkId: string,
  evaluatedAt: string,
  approvals: readonly NormalizedEvmApprovalState[],
  findings: readonly WalletFinding[],
  riskFactors: readonly WalletRiskFactor[]
): {
  readonly cleanupPlan: EvmWalletCleanupPlan | null;
  readonly actionIdsByFindingId: Readonly<Record<string, readonly string[]>>;
} {
  if (findings.length === 0 || approvals.length === 0) {
    return {
      cleanupPlan: null,
      actionIdsByFindingId: {},
    };
  }

  const riskFactorIds = new Set(riskFactors.map((factor) => factor.factorId));
  const actionIdsByFindingId = new Map<string, Set<string>>();
  const actions = deduplicateApprovals(approvals)
    .map((approval) => {
      const eligibility = getEvmCleanupEligibility(approval);
      if (!eligibility.eligible || eligibility.revocationMethod === null) {
        return null;
      }

      const linkedFindings = findings
        .filter((finding) => approvalMatchesFinding(approval, finding))
        .sort((left, right) => left.findingId.localeCompare(right.findingId));
      if (linkedFindings.length === 0) {
        return null;
      }
      const firstFinding = linkedFindings[0];
      if (!firstFinding) {
        return null;
      }

      const findingIds = linkedFindings.map((finding) => finding.findingId);
      const linkedRiskFactorIds = uniqueSorted(
        linkedFindings.flatMap((finding) => finding.riskFactorIds)
      );
      const priority = linkedFindings.reduce<EvmCleanupAction["priority"]>(
        (highest, finding) =>
          compareRiskLevel(getFindingPriority(approval, finding), highest) > 0
            ? getFindingPriority(approval, finding)
            : highest,
        getFindingPriority(approval, firstFinding)
      );
      const explanation = `Revoking ${approval.approvalKind} for ${approval.spenderAddress} on ${approval.tokenAddress} removes the currently active authorization. A later re-scan is still required before claiming remediation.`;
      const action: EvmCleanupAction = {
        actionId: buildStableId("wallet_action", {
          approvalId: approval.approvalId,
        }),
        walletChain: "evm",
        kind: "revoke_authorization",
        executionMode: "guided",
        executionType: "wallet_signature",
        status: "ready",
        requiresSignature: true,
        supportStatus: "supported",
        title: buildActionTitle(approval),
        description: buildActionDescription(approval),
        priority,
        target: {
          targetId: buildStableId("wallet_target", {
            approvalId: approval.approvalId,
            walletAddress,
          }),
          targetKind: "authorization",
          label: buildTargetLabel(approval),
          metadata: {
            approvalId: approval.approvalId,
            approvalKind: approval.approvalKind,
            spenderAddress: approval.spenderAddress,
            tokenAddress: approval.tokenAddress,
            tokenId: approval.tokenId ?? "",
          },
        },
        findingIds,
        riskFactorIds: linkedRiskFactorIds.filter((factorId) =>
          riskFactorIds.has(factorId)
        ),
        supportDetail: PHASE_4C_SUPPORT_DETAIL,
        metadata: {
          approvalId: approval.approvalId,
          approvalKind: approval.approvalKind,
          estimatedRiskReduction: priority,
          executionType: "wallet_signature",
          intendedState: buildApprovalIntendedState(approval),
          requiresSignature: "true",
          revocationMethod: eligibility.revocationMethod,
          spenderAddress: approval.spenderAddress,
          tokenAddress: approval.tokenAddress,
          tokenId: approval.tokenId ?? "",
        },
        revocationMethod: eligibility.revocationMethod,
        approval: {
          approvalId: approval.approvalId,
          approvalKind: approval.approvalKind,
          tokenAddress: approval.tokenAddress,
          spenderAddress: approval.spenderAddress,
          tokenId: approval.tokenId,
          currentState: buildApprovalCurrentState(approval),
          intendedState: buildApprovalIntendedState(approval),
        },
        estimatedRiskReduction: priority,
        explanation,
      };

      for (const findingId of findingIds) {
        const actionIds = actionIdsByFindingId.get(findingId) ?? new Set<string>();
        actionIds.add(action.actionId);
        actionIdsByFindingId.set(findingId, actionIds);
      }

      return action;
    })
    .filter((action): action is EvmCleanupAction => action !== null)
    .sort((left, right) => {
      const priorityDelta = compareRiskLevel(right.priority, left.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return (
        left.approval.tokenAddress.localeCompare(right.approval.tokenAddress) ||
        left.approval.spenderAddress.localeCompare(right.approval.spenderAddress) ||
        (left.approval.tokenId ?? "").localeCompare(right.approval.tokenId ?? "") ||
        left.actionId.localeCompare(right.actionId)
      );
    });

  if (actions.length === 0) {
    return {
      cleanupPlan: null,
      actionIdsByFindingId: {},
    };
  }

  const batches = buildBatchPlans(actions, walletAddress, networkId, evaluatedAt);
  const serializedActionIdsByFindingId: Record<string, readonly string[]> = {};
  for (const [findingId, actionIds] of actionIdsByFindingId.entries()) {
    serializedActionIdsByFindingId[findingId] = [...actionIds].sort();
  }

  const cleanupPlan: EvmWalletCleanupPlan = {
    planId: buildStableId("wallet_plan", {
      actionIds: actions.map((action) => action.actionId),
      networkId,
      walletAddress,
    }),
    walletChain: "evm",
    walletAddress,
    networkId,
    createdAt: evaluatedAt,
    summary: `Prepared ${actions.length} deterministic revoke action(s) across ${batches.length} logical batch group(s). Execution still requires explicit user review and signature outside this layer.`,
    actions,
    batches,
    projectedScore: null,
    projectedRiskLevel: null,
  };

  return {
    cleanupPlan,
    actionIdsByFindingId: serializedActionIdsByFindingId,
  };
}
