import type {
  WalletCleanupAction,
  WalletCleanupPlan,
  WalletFinding,
  WalletRiskFactor,
} from "../types.js";
import { BITCOIN_WALLET_FINDING_CODES } from "./constants.js";
import { buildStableId } from "./ids.js";
import { compareRiskLevel } from "./utils.js";

const PHASE_4E_SUPPORT_DETAIL =
  "Phase 4E only provides deterministic Bitcoin remediation guidance. Manual wallet action is required because this layer does not construct transactions, request signatures, or broadcast Bitcoin activity.";

type BitcoinRecommendationType =
  | "move_funds"
  | "consolidate_utxos"
  | "rotate_address"
  | "harden_wallet";

function buildActionBase(input: {
  readonly actionId: string;
  readonly finding: WalletFinding;
  readonly riskFactorIds: readonly string[];
  readonly kind: WalletCleanupAction["kind"];
  readonly priority: WalletCleanupAction["priority"];
  readonly recommendationType: BitcoinRecommendationType;
  readonly targetKind: WalletCleanupAction["target"]["targetKind"];
  readonly label: string;
  readonly title: string;
  readonly description: string;
}): WalletCleanupAction {
  return {
    actionId: input.actionId,
    walletChain: "bitcoin",
    kind: input.kind,
    executionMode: "manual",
    executionType: "manual_review",
    status: "planned",
    requiresSignature: false,
    supportStatus: "partial",
    title: input.title,
    description: input.description,
    priority: input.priority,
    target: {
      targetId: buildStableId("wallet_target", {
        actionId: input.actionId,
        label: input.label,
      }),
      targetKind: input.targetKind,
      label: input.label,
      metadata: {
        recommendationType: input.recommendationType,
      },
    },
    findingIds: [input.finding.findingId],
    riskFactorIds: input.riskFactorIds,
    supportDetail: PHASE_4E_SUPPORT_DETAIL,
    metadata: {
      code: input.finding.metadata.code ?? "",
      recommendationType: input.recommendationType,
    },
  };
}

function buildActionForFinding(
  finding: WalletFinding,
  riskFactors: readonly WalletRiskFactor[]
): WalletCleanupAction | null {
  const recommendationType = (() => {
    switch (finding.metadata.code) {
      case BITCOIN_WALLET_FINDING_CODES.ADDRESS_REUSE:
      case BITCOIN_WALLET_FINDING_CODES.PRIVACY_EXPOSURE:
      case BITCOIN_WALLET_FINDING_CODES.REPEATED_EXPOSED_RECEIVE:
        return "rotate_address";
      case BITCOIN_WALLET_FINDING_CODES.FRAGMENTED_UTXO_STRUCTURE:
        return "consolidate_utxos";
      case BITCOIN_WALLET_FINDING_CODES.CONCENTRATED_UTXO_STRUCTURE:
        return "move_funds";
      case BITCOIN_WALLET_FINDING_CODES.POOR_WALLET_HYGIENE:
        return "harden_wallet";
      default:
        return null;
    }
  })();

  if (recommendationType === null) {
    return null;
  }

  const riskFactorIds = riskFactors
    .filter((riskFactor) => riskFactor.findingIds.includes(finding.findingId))
    .map((riskFactor) => riskFactor.factorId)
    .sort();

  switch (recommendationType) {
    case "rotate_address":
      return buildActionBase({
        actionId: buildStableId("wallet_action", {
          findingId: finding.findingId,
          recommendationType,
        }),
        finding,
        riskFactorIds,
        kind: "rotate_wallet",
        priority: finding.riskLevel,
        recommendationType,
        targetKind: "wallet",
        label: "bitcoin_receive_addresses",
        title: "Rotate exposed receive addresses",
        description:
          "Generate fresh Bitcoin receive addresses for future deposits and manually move exposed funds if continued public visibility or reuse creates avoidable privacy risk.",
      });
    case "consolidate_utxos":
      return buildActionBase({
        actionId: buildStableId("wallet_action", {
          findingId: finding.findingId,
          recommendationType,
        }),
        finding,
        riskFactorIds,
        kind: "move_assets",
        priority: finding.riskLevel,
        recommendationType,
        targetKind: "asset",
        label: "bitcoin_utxo_set",
        title: "Consolidate fragmented UTXOs",
        description:
          "Manually consolidate excess small Bitcoin UTXOs when fee conditions and operational policy allow. This phase provides guidance only and does not prepare transactions.",
      });
    case "move_funds":
      return buildActionBase({
        actionId: buildStableId("wallet_action", {
          findingId: finding.findingId,
          recommendationType,
        }),
        finding,
        riskFactorIds,
        kind: "move_assets",
        priority: finding.riskLevel,
        recommendationType,
        targetKind: "asset",
        label: "bitcoin_balance_distribution",
        title: "Reduce concentrated balance structure",
        description:
          "Review whether a dominant Bitcoin UTXO should be split or moved to fresh receive addresses to reduce concentration and improve operational resilience.",
      });
    case "harden_wallet":
      return buildActionBase({
        actionId: buildStableId("wallet_action", {
          findingId: finding.findingId,
          recommendationType,
        }),
        finding,
        riskFactorIds,
        kind: "manual_review",
        priority: finding.riskLevel,
        recommendationType,
        targetKind: "wallet",
        label: "bitcoin_wallet_hygiene",
        title: "Harden wallet hygiene practices",
        description:
          "Review operational wallet practices, public address handling, and receive/change separation to reduce avoidable Bitcoin privacy and hygiene exposure.",
      });
  }
}

/**
 * Builds the deterministic Bitcoin remediation guidance plan for Phase 4E.
 */
export function buildBitcoinCleanupPlan(
  walletAddress: string,
  networkId: string,
  evaluatedAt: string,
  findings: readonly WalletFinding[],
  riskFactors: readonly WalletRiskFactor[]
): {
  readonly cleanupPlan: WalletCleanupPlan | null;
  readonly actionIdsByFindingId: Readonly<Record<string, readonly string[]>>;
} {
  const actions = findings
    .map((finding) => buildActionForFinding(finding, riskFactors))
    .filter((action): action is WalletCleanupAction => action !== null)
    .sort(
      (left, right) =>
        compareRiskLevel(right.priority, left.priority) ||
        left.title.localeCompare(right.title) ||
        left.actionId.localeCompare(right.actionId)
    );

  if (actions.length === 0) {
    return {
      cleanupPlan: null,
      actionIdsByFindingId: {},
    };
  }

  return {
    cleanupPlan: {
      planId: buildStableId("wallet_plan", {
        actionIds: actions.map((action) => action.actionId),
        networkId,
        walletAddress,
      }),
      walletChain: "bitcoin",
      walletAddress,
      networkId,
      createdAt: evaluatedAt,
      summary: `${actions.length} Bitcoin remediation recommendation${
        actions.length === 1 ? "" : "s"
      } were generated. Manual action is required because Phase 4E does not construct or broadcast Bitcoin transactions.`,
      actions,
      projectedScore: null,
      projectedRiskLevel: null,
    },
    actionIdsByFindingId: Object.fromEntries(
      actions.map((action) => [action.findingIds[0] ?? "", [action.actionId]])
    ),
  };
}
