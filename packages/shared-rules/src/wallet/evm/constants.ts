/**
 * Stable finding codes emitted by the Phase 4B EVM wallet scanner.
 */
export const EVM_WALLET_FINDING_CODES = Object.freeze({
  FLAGGED_SPENDER: "EVM_FLAGGED_SPENDER_EXPOSURE",
  RISKY_CONTRACT: "EVM_RISKY_CONTRACT_EXPOSURE",
  UNLIMITED_APPROVAL: "EVM_UNLIMITED_APPROVAL_EXPOSURE",
  STALE_APPROVAL: "EVM_STALE_APPROVAL_EXPOSURE",
  EXCESSIVE_APPROVALS: "EVM_EXCESSIVE_APPROVALS",
} as const);

/**
 * Union of deterministic Phase 4B EVM wallet finding codes.
 */
export type EvmWalletFindingCode =
  (typeof EVM_WALLET_FINDING_CODES)[keyof typeof EVM_WALLET_FINDING_CODES];

/**
 * Approval age threshold, in days, after which an approval is marked stale.
 */
export const EVM_APPROVAL_STALE_DAYS = 90;

/**
 * Active approval count threshold for the first excessive-approval deduction.
 */
export const EVM_EXCESSIVE_APPROVAL_THRESHOLD = 10;

/**
 * Active approval count threshold for the stronger excessive-approval deduction.
 */
export const EVM_SEVERE_APPROVAL_THRESHOLD = 20;

/**
 * Fixed component score budgets for the deterministic Phase 4B score model.
 */
export const EVM_WALLET_SCORE_COMPONENT_MAX = Object.freeze({
  authorizationHygiene: 40,
  spenderTrust: 25,
  approvalFreshness: 15,
  contractExposure: 20,
} as const);

