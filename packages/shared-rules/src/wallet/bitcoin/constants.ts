/**
 * Stable finding codes emitted by the Phase 4E Bitcoin wallet scanner.
 */
export const BITCOIN_WALLET_FINDING_CODES = Object.freeze({
  ADDRESS_REUSE: "BITCOIN_ADDRESS_REUSE_EXPOSURE",
  PRIVACY_EXPOSURE: "BITCOIN_PRIVACY_EXPOSURE",
  FRAGMENTED_UTXO_STRUCTURE: "BITCOIN_FRAGMENTED_UTXO_STRUCTURE",
  CONCENTRATED_UTXO_STRUCTURE: "BITCOIN_CONCENTRATED_UTXO_STRUCTURE",
  POOR_WALLET_HYGIENE: "BITCOIN_POOR_WALLET_HYGIENE",
  REPEATED_EXPOSED_RECEIVE: "BITCOIN_REPEATED_EXPOSED_RECEIVE_BEHAVIOR",
} as const);

/**
 * Union of deterministic Phase 4E Bitcoin wallet finding codes.
 */
export type BitcoinWalletFindingCode =
  (typeof BITCOIN_WALLET_FINDING_CODES)[keyof typeof BITCOIN_WALLET_FINDING_CODES];

/**
 * Receive count threshold used to flag repeated receiving behavior on a public address.
 */
export const BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD = 3;

/**
 * Small-UTXO threshold, in satoshis, used for fragmentation heuristics.
 */
export const BITCOIN_SMALL_UTXO_SATS = 100_000n;

/**
 * Medium fragmentation threshold based on total UTXO count.
 */
export const BITCOIN_FRAGMENTATION_MEDIUM_UTXO_COUNT = 8;

/**
 * High fragmentation threshold based on total UTXO count.
 */
export const BITCOIN_FRAGMENTATION_HIGH_UTXO_COUNT = 16;

/**
 * Medium fragmentation threshold based on small UTXO count.
 */
export const BITCOIN_FRAGMENTATION_MEDIUM_SMALL_UTXO_COUNT = 5;

/**
 * High fragmentation threshold based on small UTXO count.
 */
export const BITCOIN_FRAGMENTATION_HIGH_SMALL_UTXO_COUNT = 10;

/**
 * Medium concentration threshold expressed in basis points for the largest UTXO share.
 */
export const BITCOIN_CONCENTRATION_MEDIUM_BPS = 7_000;

/**
 * High concentration threshold expressed in basis points for the largest UTXO share.
 */
export const BITCOIN_CONCENTRATION_HIGH_BPS = 8_500;

/**
 * Fixed component score budgets for the deterministic Phase 4E score model.
 */
export const BITCOIN_WALLET_SCORE_COMPONENT_MAX = Object.freeze({
  addressReuse: 20,
  privacyExposure: 15,
  utxoFragmentation: 20,
  concentration: 15,
  operationalHygiene: 15,
  exposedReceiveBehavior: 15,
} as const);
