import {
  EVM_EXCESSIVE_APPROVAL_THRESHOLD,
} from "./constants.js";
import type {
  EvmWalletSignals,
  NormalizedEvmWalletSnapshot,
} from "./types.js";

/**
 * Builds pure deterministic wallet signals from a normalized EVM snapshot.
 */
export function buildEvmWalletSignals(
  snapshot: NormalizedEvmWalletSnapshot
): EvmWalletSignals {
  const approvals = snapshot.approvals;
  const unlimitedApprovals = approvals.filter((approval) => approval.isUnlimited);
  const unknownUnlimitedApprovals = unlimitedApprovals.filter(
    (approval) => approval.spenderDisposition === "unknown"
  );
  const flaggedSpenderApprovals = approvals.filter(
    (approval) => approval.spenderDisposition === "flagged"
  );
  const staleApprovals = approvals.filter((approval) => approval.isStale);
  const riskyContractExposures = snapshot.contractExposures.filter(
    (exposure) => exposure.isRisky
  );

  return {
    approvalCount: approvals.length,
    erc20ApprovalCount: approvals.filter((approval) => approval.tokenStandard === "erc20").length,
    erc721ApprovalCount: approvals.filter((approval) => approval.tokenStandard === "erc721").length,
    erc1155ApprovalCount: approvals.filter((approval) => approval.tokenStandard === "erc1155").length,
    unlimitedApprovalCount: unlimitedApprovals.length,
    unlimitedApprovalIds: unlimitedApprovals.map((approval) => approval.approvalId),
    unknownUnlimitedApprovalCount: unknownUnlimitedApprovals.length,
    unknownUnlimitedApprovalIds: unknownUnlimitedApprovals.map(
      (approval) => approval.approvalId
    ),
    flaggedSpenderCount: flaggedSpenderApprovals.length,
    flaggedSpenderApprovalIds: flaggedSpenderApprovals.map(
      (approval) => approval.approvalId
    ),
    staleApprovalCount: staleApprovals.length,
    staleApprovalIds: staleApprovals.map((approval) => approval.approvalId),
    riskyContractExposureCount: riskyContractExposures.length,
    riskyContractExposureIds: riskyContractExposures.map(
      (exposure) => exposure.resourceId
    ),
    hasExcessiveApprovals: approvals.length >= EVM_EXCESSIVE_APPROVAL_THRESHOLD,
  };
}

