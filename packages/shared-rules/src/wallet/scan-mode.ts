import type { WalletChain, WalletScanMode } from "./types.js";

/**
 * Enforces the V1 per-chain scan scope contract before reports are assembled.
 */
export function enforceWalletScanMode(
  walletChain: WalletChain,
  requestedScanMode: WalletScanMode
): WalletScanMode {
  switch (walletChain) {
    case "solana":
    case "bitcoin":
      return "basic";
    case "evm":
      return requestedScanMode;
  }
}
