/**
 * Stable finding codes emitted by the Phase 4D Solana wallet scanner.
 */
export const SOLANA_WALLET_FINDING_CODES = Object.freeze({
  DELEGATE_AUTHORITY: "SOLANA_DELEGATE_AUTHORITY_EXPOSURE",
  AUTHORITY_ASSIGNMENT: "SOLANA_AUTHORITY_ASSIGNMENT_EXPOSURE",
  BROAD_PERMISSION: "SOLANA_BROAD_PERMISSION_EXPOSURE",
  RISKY_CONNECTION: "SOLANA_RISKY_CONNECTION_EXPOSURE",
  STALE_RISKY_CONNECTION: "SOLANA_STALE_RISKY_CONNECTION_EXPOSURE",
  SUSPICIOUS_PROGRAM: "SOLANA_SUSPICIOUS_PROGRAM_INTERACTION",
} as const);

/**
 * Union of deterministic Phase 4D Solana wallet finding codes.
 */
export type SolanaWalletFindingCode =
  (typeof SOLANA_WALLET_FINDING_CODES)[keyof typeof SOLANA_WALLET_FINDING_CODES];

/**
 * Connection age threshold, in days, after which a risky Solana connection is marked stale.
 */
export const SOLANA_CONNECTION_STALE_DAYS = 45;

/**
 * Permission scopes that should be treated as broad Solana wallet exposure.
 */
export const SOLANA_BROAD_PERMISSION_SCOPES = Object.freeze([
  "account_access_all",
  "program_access",
  "sign_all_transactions",
  "sign_and_send_transactions",
  "token_account_management",
] as const);

/**
 * Fixed component score budgets for the deterministic Phase 4D score model.
 */
export const SOLANA_WALLET_SCORE_COMPONENT_MAX = Object.freeze({
  delegateExposure: 25,
  authorityControl: 15,
  permissionBreadth: 20,
  connectionRisk: 20,
  programActivity: 20,
} as const);
