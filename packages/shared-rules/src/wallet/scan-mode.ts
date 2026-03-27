import { assertWalletScanModeSupported } from "./capabilities.js";
import type { WalletChain, WalletScanMode } from "./types.js";

/**
 * Validates the V1 per-chain scan scope contract before reports are assembled.
 */
export function enforceWalletScanMode(
  walletChain: WalletChain,
  requestedScanMode: WalletScanMode
): WalletScanMode {
  return assertWalletScanModeSupported(walletChain, requestedScanMode);
}
