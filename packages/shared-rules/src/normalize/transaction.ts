import {
  APPROVE_SELECTOR,
  ERC20_PERMIT_SELECTOR,
  getTransactionSelectorDefinition,
  INCREASE_ALLOWANCE_SELECTOR,
  MULTICALL_DEADLINE_BYTES_SELECTOR,
  MULTICALL_BYTES_SELECTOR,
  PERMIT_SELECTORS,
  SET_APPROVAL_FOR_ALL_SELECTOR,
  TRANSFER_FROM_SELECTOR,
  TRANSFER_SELECTOR,
} from "../transaction/selectors.js";

export {
  APPROVE_SELECTOR,
  INCREASE_ALLOWANCE_SELECTOR,
  SET_APPROVAL_FOR_ALL_SELECTOR,
  PERMIT_SELECTORS,
};

/** Max uint256 in hex (unlimited approval). */
export const MAX_UINT256_HEX =
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

/** Known function selectors mapped to human-readable names. */
export const KNOWN_SELECTORS: Record<string, string> = {
  [APPROVE_SELECTOR]: "approve",
  [SET_APPROVAL_FOR_ALL_SELECTOR]: "setApprovalForAll",
  [INCREASE_ALLOWANCE_SELECTOR]: "increaseAllowance",
  [TRANSFER_SELECTOR]: "transfer",
  [TRANSFER_FROM_SELECTOR]: "transferFrom",
  [ERC20_PERMIT_SELECTOR]: "permit",
  [MULTICALL_BYTES_SELECTOR]: "multicall",
  [MULTICALL_DEADLINE_BYTES_SELECTOR]: "multicall",
};

/**
 * Extract the 4-byte function selector from calldata.
 */
export function extractSelector(calldata: string): string {
  const clean = calldata.startsWith("0x") ? calldata : `0x${calldata}`;
  return clean.slice(0, 10).toLowerCase();
}

/**
 * Classify a selector as approval, permit, or unknown.
 */
export function classifySelector(
  selector: string
):
  | "approve"
  | "setApprovalForAll"
  | "increaseAllowance"
  | "transfer"
  | "transferFrom"
  | "permit"
  | "multicall"
  | "unknown" {
  return getTransactionSelectorDefinition(selector)?.actionType ?? "unknown";
}

/**
 * Parse the approval amount from calldata (for approve/increaseAllowance).
 * Returns the hex-encoded amount string.
 */
export function parseApprovalAmount(calldata: string): string {
  const clean = calldata.startsWith("0x") ? calldata.slice(2) : calldata;
  // selector (8) + address (64) + amount (64)
  if (clean.length < 136) return "";
  return clean.slice(72, 136).toLowerCase();
}

/**
 * Check if an approval amount represents unlimited (max uint256).
 */
export function isUnlimitedApprovalAmount(amount: string): boolean {
  return amount.toLowerCase() === MAX_UINT256_HEX;
}
