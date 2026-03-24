import type {
  WalletCleanupAction,
  WalletCleanupPlan,
  WalletFinding,
  WalletRiskFactor,
} from "../types.js";
import { SOLANA_WALLET_FINDING_CODES } from "./constants.js";
import { buildStableId } from "./ids.js";
import type {
  NormalizedSolanaAuthorityAssignment,
  NormalizedSolanaConnectionRecord,
  NormalizedSolanaTokenAccountState,
  NormalizedSolanaWalletSnapshot,
} from "./types.js";
import { compareRiskLevel, hasSevereFlag, uniqueSorted } from "./utils.js";

const PHASE_4D_SUPPORT_DETAIL =
  "Phase 4D only provides deterministic Solana review guidance. Manual wallet or app action is required because this layer does not build transactions or disconnect apps automatically.";

type SolanaRecommendationType =
  | "disconnect_permission"
  | "remove_authority"
  | "remove_delegate"
  | "review_connection"
  | "review_program_access";

function comparePriority(left: WalletCleanupAction["priority"], right: WalletCleanupAction["priority"]): number {
  return compareRiskLevel(left, right);
}

function requiresSignatureForRecommendation(
  recommendationType: SolanaRecommendationType
): boolean {
  switch (recommendationType) {
    case "disconnect_permission":
    case "remove_authority":
    case "remove_delegate":
    case "review_connection":
    case "review_program_access":
      return true;
  }
}

function buildActionBase(input: {
  readonly actionId: string;
  readonly findingIds: readonly string[];
  readonly riskFactorIds: readonly string[];
  readonly priority: WalletCleanupAction["priority"];
  readonly kind: WalletCleanupAction["kind"];
  readonly recommendationType: SolanaRecommendationType;
  readonly title: string;
  readonly description: string;
  readonly label: string;
  readonly metadata: Readonly<Record<string, string>>;
}): WalletCleanupAction {
  return {
    actionId: input.actionId,
    walletChain: "solana",
    kind: input.kind,
    executionMode: "guided",
    executionType: "manual_review",
    status: "planned",
    requiresSignature: requiresSignatureForRecommendation(input.recommendationType),
    supportStatus: "partial",
    title: input.title,
    description: input.description,
    priority: input.priority,
    target: {
      targetId: buildStableId("wallet_target", {
        actionId: input.actionId,
        label: input.label,
      }),
      targetKind: "authorization",
      label: input.label,
      metadata: input.metadata,
    },
    findingIds: input.findingIds,
    riskFactorIds: input.riskFactorIds,
    supportDetail: PHASE_4D_SUPPORT_DETAIL,
    metadata: input.metadata,
  };
}

function collectRiskFactorIds(
  findings: readonly WalletFinding[]
): readonly string[] {
  return uniqueSorted(findings.flatMap((finding) => finding.riskFactorIds));
}

function matchFindings(
  findings: readonly WalletFinding[],
  resourceId: string,
  codes: readonly string[]
): readonly WalletFinding[] {
  return findings
    .filter(
      (finding) =>
        codes.includes(finding.metadata.code ?? "") &&
        finding.resourceIds.includes(resourceId)
    )
    .sort((left, right) => left.findingId.localeCompare(right.findingId));
}

function connectionPriority(connection: NormalizedSolanaConnectionRecord): WalletCleanupAction["priority"] {
  if (connection.riskLevel === "critical" || hasSevereFlag(connection.flags)) {
    return "critical";
  }
  if (connection.isRisky || connection.isStaleRisky) {
    return "high";
  }
  return connection.isBroadPermission ? "medium" : "low";
}

function authorityPriority(
  assignment: NormalizedSolanaAuthorityAssignment
): WalletCleanupAction["priority"] {
  if (assignment.riskLevel === "critical" || hasSevereFlag(assignment.flags)) {
    return "critical";
  }
  return assignment.isRisky ? "high" : "medium";
}

function delegatePriority(
  tokenAccount: NormalizedSolanaTokenAccountState
): WalletCleanupAction["priority"] {
  if (
    tokenAccount.delegateRiskLevel === "critical" ||
    hasSevereFlag(tokenAccount.delegateFlags)
  ) {
    return "critical";
  }
  return tokenAccount.isRiskyDelegate ? "high" : "medium";
}

/**
 * Builds the deterministic Solana cleanup recommendation plan for Phase 4D.
 */
export function buildSolanaCleanupPlan(
  walletAddress: string,
  networkId: string,
  evaluatedAt: string,
  snapshot: NormalizedSolanaWalletSnapshot,
  findings: readonly WalletFinding[],
  _riskFactors: readonly WalletRiskFactor[]
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

  const actions: WalletCleanupAction[] = [];
  const actionIdsByFindingId = new Map<string, Set<string>>();

  for (const tokenAccount of snapshot.tokenAccounts.filter(
    (entry) => entry.hasDelegate
  )) {
    const linkedFindings = matchFindings(findings, tokenAccount.resourceId, [
      SOLANA_WALLET_FINDING_CODES.DELEGATE_AUTHORITY,
    ]);
    if (linkedFindings.length === 0) {
      continue;
    }

    const action = buildActionBase({
      actionId: buildStableId("wallet_action", {
        recommendationType: "remove_delegate",
        resourceId: tokenAccount.resourceId,
      }),
      findingIds: linkedFindings.map((finding) => finding.findingId),
      riskFactorIds: collectRiskFactorIds(linkedFindings),
      priority: delegatePriority(tokenAccount),
      kind: "revoke_authorization",
      recommendationType: "remove_delegate",
      title: "Remove token delegate",
      description: `Review token account ${tokenAccount.tokenAccountAddress} for mint ${tokenAccount.mintAddress} and remove delegate ${tokenAccount.delegateAddress ?? "unknown"}. Manual wallet action is required.`,
      label: `delegate:${tokenAccount.tokenAccountAddress}`,
      metadata: {
        delegateAddress: tokenAccount.delegateAddress ?? "",
        mintAddress: tokenAccount.mintAddress,
        recommendationType: "remove_delegate",
        tokenAccountAddress: tokenAccount.tokenAccountAddress,
      },
    });
    actions.push(action);
  }

  for (const assignment of snapshot.authorityAssignments) {
    const linkedFindings = matchFindings(findings, assignment.resourceId, [
      SOLANA_WALLET_FINDING_CODES.AUTHORITY_ASSIGNMENT,
    ]);
    if (linkedFindings.length === 0) {
      continue;
    }

    const action = buildActionBase({
      actionId: buildStableId("wallet_action", {
        authorityType: assignment.authorityType,
        recommendationType: "remove_authority",
        resourceId: assignment.resourceId,
      }),
      findingIds: linkedFindings.map((finding) => finding.findingId),
      riskFactorIds: collectRiskFactorIds(linkedFindings),
      priority: authorityPriority(assignment),
      kind: "revoke_authorization",
      recommendationType: "remove_authority",
      title: "Remove authority assignment",
      description: `Review ${assignment.authorityType} on ${assignment.subjectAddress} and remove authority ${assignment.authorityAddress} if it is no longer required. Manual wallet or protocol action is required.`,
      label: `authority:${assignment.subjectAddress}:${assignment.authorityType}`,
      metadata: {
        authorityAddress: assignment.authorityAddress,
        authorityType: assignment.authorityType,
        recommendationType: "remove_authority",
        subjectAddress: assignment.subjectAddress,
      },
    });
    actions.push(action);
  }

  for (const connection of snapshot.connections) {
    const linkedFindings = matchFindings(findings, connection.resourceId, [
      SOLANA_WALLET_FINDING_CODES.BROAD_PERMISSION,
      SOLANA_WALLET_FINDING_CODES.RISKY_CONNECTION,
      SOLANA_WALLET_FINDING_CODES.STALE_RISKY_CONNECTION,
    ]);
    if (linkedFindings.length === 0) {
      continue;
    }

    const recommendationType = connection.isBroadPermission
      ? "disconnect_permission"
      : "review_connection";
    const kind = connection.isBroadPermission
      ? "revoke_authorization"
      : "manual_review";
    const label =
      connection.appName ?? connection.origin ?? connection.connectionId ?? connection.resourceId;
    const description = connection.isBroadPermission
      ? `Review permissions for ${label} and disconnect the connection if the app no longer needs broad wallet access. Manual wallet or app action is required.`
      : `Review the connection for ${label} and disconnect it if it remains risky or no longer needed. Manual wallet or app action is required.`;

    const action = buildActionBase({
      actionId: buildStableId("wallet_action", {
        recommendationType,
        resourceId: connection.resourceId,
      }),
      findingIds: linkedFindings.map((finding) => finding.findingId),
      riskFactorIds: collectRiskFactorIds(linkedFindings),
      priority: connectionPriority(connection),
      kind,
      recommendationType,
      title:
        recommendationType === "disconnect_permission"
          ? "Disconnect wallet permission"
          : "Review risky wallet connection",
      description,
      label: `connection:${label}`,
      metadata: {
        appName: connection.appName ?? "",
        origin: connection.origin ?? "",
        recommendationType,
      },
    });
    actions.push(action);
  }

  for (const programExposure of snapshot.programExposures) {
    const linkedFindings = matchFindings(findings, programExposure.resourceId, [
      SOLANA_WALLET_FINDING_CODES.SUSPICIOUS_PROGRAM,
    ]);
    if (linkedFindings.length === 0) {
      continue;
    }

    const action = buildActionBase({
      actionId: buildStableId("wallet_action", {
        recommendationType: "review_program_access",
        resourceId: programExposure.resourceId,
      }),
      findingIds: linkedFindings.map((finding) => finding.findingId),
      riskFactorIds: collectRiskFactorIds(linkedFindings),
      priority:
        programExposure.riskLevel === "critical" || hasSevereFlag(programExposure.flags)
          ? "critical"
          : "high",
      kind: "manual_review",
      recommendationType: "review_program_access",
      title: "Review suspicious program access",
      description: `Review program ${programExposure.programAddress} and remove related permissions or account exposure if the access is unexpected. Manual wallet or protocol action is required.`,
      label: `program:${programExposure.programAddress}`,
      metadata: {
        programAddress: programExposure.programAddress,
        recommendationType: "review_program_access",
      },
    });
    actions.push(action);
  }

  if (actions.length === 0) {
    return {
      cleanupPlan: null,
      actionIdsByFindingId: {},
    };
  }

  const orderedActions = [...actions].sort(
    (left, right) =>
      comparePriority(right.priority, left.priority) ||
      left.title.localeCompare(right.title) ||
      left.actionId.localeCompare(right.actionId)
  );

  for (const action of orderedActions) {
    for (const findingId of action.findingIds) {
      const existing = actionIdsByFindingId.get(findingId) ?? new Set<string>();
      existing.add(action.actionId);
      actionIdsByFindingId.set(findingId, existing);
    }
  }

  return {
    cleanupPlan: {
      planId: buildStableId("wallet_plan", {
        actionIds: orderedActions.map((action) => action.actionId),
        networkId,
        walletAddress,
      }),
      walletChain: "solana",
      walletAddress,
      networkId,
      createdAt: evaluatedAt,
      summary: `${orderedActions.length} Solana review recommendation${
        orderedActions.length === 1 ? "" : "s"
      } were generated. Manual wallet or app action is required because Phase 4D does not build Solana transactions or disconnect apps automatically.`,
      actions: orderedActions,
      projectedScore: null,
      projectedRiskLevel: null,
    },
    actionIdsByFindingId: Object.fromEntries(
      [...actionIdsByFindingId.entries()].map(([findingId, actionIds]) => [
        findingId,
        [...actionIds].sort(),
      ])
    ),
  };
}
