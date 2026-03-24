import type {
  EvmCleanupActionExecutionResult,
  EvmCleanupExecutionStatus,
  EvmCleanupReconciliationItem,
  EvmCleanupReconciliationSummary,
  EvmCleanupRescanSnapshot,
  EvmWalletCleanupPlan,
} from "./cleanup-types.js";

function normalizeNullableString(value?: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

/**
 * Normalizes externally supplied cleanup execution status into a deterministic action result.
 */
export function interpretEvmCleanupExecutionResult(input: {
  /** Cleanup action identifier. */
  readonly actionId: string;
  /** External execution status to normalize. */
  readonly status: EvmCleanupExecutionStatus;
  /** Transaction hash when available. */
  readonly txHash?: string | null;
  /** Stable error code when available. */
  readonly errorCode?: string | null;
  /** Human-readable error message when available. */
  readonly errorMessage?: string | null;
  /** Finalization timestamp when available. */
  readonly finalizedAt?: string | null;
}): EvmCleanupActionExecutionResult {
  return {
    actionId: input.actionId,
    status: input.status,
    txHash: normalizeNullableString(input.txHash)?.toLowerCase() ?? null,
    errorCode: normalizeNullableString(input.errorCode),
    errorMessage: normalizeNullableString(input.errorMessage),
    requiresRescan: input.status === "confirmed",
    finalizedAt: normalizeNullableString(input.finalizedAt),
  };
}

function buildPendingResult(actionId: string): EvmCleanupActionExecutionResult {
  return {
    actionId,
    status: "pending_signature",
    txHash: null,
    errorCode: null,
    errorMessage: null,
    requiresRescan: false,
    finalizedAt: null,
  };
}

function validateRescanSnapshotContext(
  plan: EvmWalletCleanupPlan,
  rescanSnapshot: EvmCleanupRescanSnapshot | null
): {
  readonly acceptedSnapshot: EvmCleanupRescanSnapshot | null;
  readonly accepted: boolean;
  readonly mismatchReason:
    | "wallet_chain_mismatch"
    | "wallet_address_mismatch"
    | "network_id_mismatch"
    | null;
} {
  if (rescanSnapshot === null) {
    return {
      acceptedSnapshot: null,
      accepted: true,
      mismatchReason: null,
    };
  }

  if (rescanSnapshot.walletChain !== plan.walletChain) {
    return {
      acceptedSnapshot: null,
      accepted: false,
      mismatchReason: "wallet_chain_mismatch",
    };
  }

  if (rescanSnapshot.walletAddress !== plan.walletAddress) {
    return {
      acceptedSnapshot: null,
      accepted: false,
      mismatchReason: "wallet_address_mismatch",
    };
  }

  if (rescanSnapshot.networkId !== plan.networkId) {
    return {
      acceptedSnapshot: null,
      accepted: false,
      mismatchReason: "network_id_mismatch",
    };
  }

  return {
    acceptedSnapshot: rescanSnapshot,
    accepted: true,
    mismatchReason: null,
  };
}

function buildReconciliationItem(
  action: EvmWalletCleanupPlan["actions"][number],
  result: EvmCleanupActionExecutionResult,
  rescanSnapshot: EvmCleanupRescanSnapshot | null
): EvmCleanupReconciliationItem {
  let rescanStatus: EvmCleanupReconciliationItem["rescanStatus"] = "not_requested";
  if (result.status === "confirmed" && rescanSnapshot !== null) {
    rescanStatus = rescanSnapshot.activeApprovalIds.includes(action.approval.approvalId)
      ? "still_active"
      : "cleared";
  }

  return {
    actionId: action.actionId,
    approvalId: action.approval.approvalId,
    executionStatus: result.status,
    rescanStatus,
    findingIds: action.findingIds,
    txHash: result.txHash,
    requiresRescan: result.status === "confirmed" && rescanSnapshot === null,
  };
}

/**
 * Reconciles a cleanup plan against recorded execution results and an optional later re-scan snapshot.
 */
export function reconcileEvmCleanupPlanResults(
  plan: EvmWalletCleanupPlan,
  results: readonly EvmCleanupActionExecutionResult[],
  rescanSnapshot?: EvmCleanupRescanSnapshot | null
): EvmCleanupReconciliationSummary {
  const resultMap = new Map(results.map((result) => [result.actionId, result]));
  const validation = validateRescanSnapshotContext(plan, rescanSnapshot ?? null);
  const normalizedRescanSnapshot = validation.acceptedSnapshot;
  const items = plan.actions.map((action) =>
    buildReconciliationItem(
      action,
      resultMap.get(action.actionId) ?? buildPendingResult(action.actionId),
      normalizedRescanSnapshot
    )
  );

  return {
    planId: plan.planId,
    walletChain: "evm",
    walletAddress: plan.walletAddress,
    networkId: plan.networkId,
    requiresRescan: items.some((item) => item.requiresRescan),
    rescanSnapshotAccepted: validation.accepted,
    rescanMismatchReason: validation.mismatchReason,
    confirmedActionIds: items
      .filter((item) => item.executionStatus === "confirmed")
      .map((item) => item.actionId),
    outstandingActionIds: items
      .filter(
        (item) =>
          item.executionStatus !== "confirmed" || item.rescanStatus !== "cleared"
      )
      .map((item) => item.actionId),
    items,
    rescanSnapshot: normalizedRescanSnapshot,
  };
}
