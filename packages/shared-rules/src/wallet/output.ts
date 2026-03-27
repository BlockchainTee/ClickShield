import type {
  BitcoinWalletScanEvaluationInput,
} from "./bitcoin/types.js";
import type { EvmWalletScanEvaluationInput } from "./evm/types.js";
import {
  runWalletLayer4Scan,
  type WalletLayer4ScanEvaluation,
  type WalletLayer4ScanInput,
} from "./orchestrator.js";
import type { SolanaWalletScanEvaluationInput } from "./solana/types.js";
import type { WalletReport } from "./types.js";

/**
 * Canonical Layer 4 consumer output contract.
 *
 * This remains the exact report produced by the runtime scan entrypoint.
 */
export type WalletLayer4Output = WalletReport;

/**
 * Builds the one canonical Layer 4 output path for downstream consumers.
 */
export function buildWalletLayer4Output(
  input: EvmWalletScanEvaluationInput
): WalletLayer4Output;
export function buildWalletLayer4Output(
  input: SolanaWalletScanEvaluationInput
): WalletLayer4Output;
export function buildWalletLayer4Output(
  input: BitcoinWalletScanEvaluationInput
): WalletLayer4Output;
export function buildWalletLayer4Output(
  input: WalletLayer4ScanInput
): WalletLayer4Output {
  const runWalletLayer4ScanPassThrough = runWalletLayer4Scan as (
    value: WalletLayer4ScanInput
  ) => WalletLayer4ScanEvaluation;

  return runWalletLayer4ScanPassThrough(input).report;
}
