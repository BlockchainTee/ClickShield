import type { NormalizedEvmApprovalState } from "./types.js";
import type {
  EvmCleanupEligibility,
  EvmCleanupRevocationMethod,
} from "./cleanup-types.js";

function isActiveApproval(approval: NormalizedEvmApprovalState): boolean {
  if (approval.approvalKind === "erc20_allowance") {
    return approval.amount !== null && approval.amount !== "0";
  }

  return true;
}

/**
 * Returns the deterministic revoke method for a supported approval kind.
 */
export function getEvmCleanupRevocationMethod(
  approval: NormalizedEvmApprovalState
): EvmCleanupRevocationMethod | null {
  switch (approval.approvalKind) {
    case "erc20_allowance":
      return "erc20_approve_zero";
    case "erc721_token":
      return "erc721_approve_zero";
    case "erc721_operator":
      return "erc721_set_approval_for_all_false";
    case "erc1155_operator":
      return "erc1155_set_approval_for_all_false";
    default:
      return null;
  }
}

/**
 * Evaluates whether a normalized approval can safely produce a Phase 4C cleanup action.
 */
export function getEvmCleanupEligibility(
  approval: NormalizedEvmApprovalState
): EvmCleanupEligibility {
  if (!isActiveApproval(approval)) {
    return {
      eligible: false,
      reasonCode: "inactive",
      revocationMethod: null,
      supportStatus: "not_supported",
      detail: "Inactive approvals must not produce cleanup actions or revoke payloads.",
    };
  }

  const revocationMethod = getEvmCleanupRevocationMethod(approval);
  if (revocationMethod === null) {
    return {
      eligible: false,
      reasonCode: "unsupported_approval_kind",
      revocationMethod: null,
      supportStatus: "not_supported",
      detail: "This approval kind does not have a supported deterministic revoke method.",
    };
  }

  if (approval.approvalKind === "erc20_allowance" && approval.amount === null) {
    return {
      eligible: false,
      reasonCode: "missing_amount",
      revocationMethod: null,
      supportStatus: "not_supported",
      detail: "ERC-20 cleanup requires a normalized allowance amount before a revoke can be prepared.",
    };
  }

  if (approval.approvalKind === "erc721_token" && approval.tokenId === null) {
    return {
      eligible: false,
      reasonCode: "missing_token_id",
      revocationMethod: null,
      supportStatus: "not_supported",
      detail: "ERC-721 token approval cleanup requires a tokenId before a revoke can be prepared.",
    };
  }

  return {
    eligible: true,
    reasonCode: "supported",
    revocationMethod,
    supportStatus: "supported",
    detail: "Active approval has a supported deterministic revoke method and can be prepared for wallet signature.",
  };
}
