import { assertWalletScanRequestCapabilityTruth } from "./capabilities.js";
import { evaluateBitcoinWalletScan } from "./bitcoin/evaluate.js";
import type {
  BitcoinWalletScanEvaluation,
  BitcoinWalletScanEvaluationInput,
} from "./bitcoin/types.js";
import { evaluateEvmWalletScan } from "./evm/evaluate.js";
import type {
  EvmWalletScanEvaluation,
  EvmWalletScanEvaluationInput,
} from "./evm/types.js";
import { evaluateSolanaWalletScan } from "./solana/evaluate.js";
import type {
  SolanaWalletScanEvaluation,
  SolanaWalletScanEvaluationInput,
} from "./solana/types.js";

/**
 * Canonical Layer 4 runtime input accepted by the wallet orchestrator.
 */
export type WalletLayer4ScanInput =
  | EvmWalletScanEvaluationInput
  | SolanaWalletScanEvaluationInput
  | BitcoinWalletScanEvaluationInput;

/**
 * Truthful Layer 4 runtime output returned by the chain-specific evaluator.
 */
export type WalletLayer4ScanEvaluation =
  | EvmWalletScanEvaluation
  | SolanaWalletScanEvaluation
  | BitcoinWalletScanEvaluation;

function assertWalletLayer4RuntimeInput(
  input: WalletLayer4ScanInput
): WalletLayer4ScanInput {
  assertWalletScanRequestCapabilityTruth(input.request);

  if (input.snapshot.requestId !== input.request.requestId) {
    throw new Error(
      "Layer 4 wallet runtime requires snapshot.requestId to match request.requestId before dispatch."
    );
  }

  if (input.snapshot.walletChain !== input.request.walletChain) {
    throw new Error(
      "Layer 4 wallet runtime requires snapshot.walletChain to match request.walletChain before dispatch."
    );
  }

  if (input.snapshot.walletAddress !== input.request.walletAddress) {
    throw new Error(
      "Layer 4 wallet runtime requires snapshot.walletAddress to match request.walletAddress before dispatch."
    );
  }

  if (input.snapshot.networkId !== input.request.networkId) {
    throw new Error(
      "Layer 4 wallet runtime requires snapshot.networkId to match request.networkId before dispatch."
    );
  }

  return input;
}

function isEvmWalletLayer4ScanInput(
  input: WalletLayer4ScanInput
): input is EvmWalletScanEvaluationInput {
  return input.request.walletChain === "evm";
}

function isSolanaWalletLayer4ScanInput(
  input: WalletLayer4ScanInput
): input is SolanaWalletScanEvaluationInput {
  return input.request.walletChain === "solana";
}

function isBitcoinWalletLayer4ScanInput(
  input: WalletLayer4ScanInput
): input is BitcoinWalletScanEvaluationInput {
  return input.request.walletChain === "bitcoin";
}

/**
 * Runs the one canonical Layer 4 wallet scan path with explicit chain dispatch.
 */
export function runWalletLayer4Scan(
  input: EvmWalletScanEvaluationInput
): EvmWalletScanEvaluation;
export function runWalletLayer4Scan(
  input: SolanaWalletScanEvaluationInput
): SolanaWalletScanEvaluation;
export function runWalletLayer4Scan(
  input: BitcoinWalletScanEvaluationInput
): BitcoinWalletScanEvaluation;
export function runWalletLayer4Scan(
  input: WalletLayer4ScanInput
): WalletLayer4ScanEvaluation {
  const validatedInput = assertWalletLayer4RuntimeInput(input);

  if (isEvmWalletLayer4ScanInput(validatedInput)) {
    return evaluateEvmWalletScan(validatedInput);
  }

  if (isSolanaWalletLayer4ScanInput(validatedInput)) {
    return evaluateSolanaWalletScan(validatedInput);
  }

  if (isBitcoinWalletLayer4ScanInput(validatedInput)) {
    return evaluateBitcoinWalletScan(validatedInput);
  }

  throw new Error(
    "Layer 4 wallet runtime dispatch exhausted without a supported walletChain."
  );
}
