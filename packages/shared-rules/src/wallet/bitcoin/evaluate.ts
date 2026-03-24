import { assembleBitcoinWalletEvaluation } from "./assemble.js";
import { normalizeBitcoinWalletSnapshot } from "./normalize.js";
import { buildBitcoinWalletFindings } from "./rules.js";
import { buildBitcoinWalletSignals } from "./signals.js";
import type {
  BitcoinWalletScanEvaluation,
  BitcoinWalletScanEvaluationInput,
} from "./types.js";

function assertBitcoinChainContext(
  input: BitcoinWalletScanEvaluationInput
): void {
  if (input.request.walletChain !== "bitcoin") {
    throw new Error(
      `Bitcoin wallet evaluation requires request.walletChain to be "bitcoin"; received "${input.request.walletChain}".`
    );
  }

  if (input.snapshot.walletChain !== "bitcoin") {
    throw new Error(
      `Bitcoin wallet evaluation requires snapshot.walletChain to be "bitcoin"; received "${input.snapshot.walletChain}".`
    );
  }
}

/**
 * Evaluates a fully hydrated Bitcoin wallet snapshot into deterministic Phase 4E report output.
 */
export function evaluateBitcoinWalletScan(
  input: BitcoinWalletScanEvaluationInput
): BitcoinWalletScanEvaluation {
  assertBitcoinChainContext(input);
  const normalizedSnapshot = normalizeBitcoinWalletSnapshot(input);
  const signals = buildBitcoinWalletSignals(normalizedSnapshot);
  const findingDrafts = buildBitcoinWalletFindings(normalizedSnapshot, signals);

  return assembleBitcoinWalletEvaluation({
    request: input.request,
    snapshot: input.snapshot,
    normalizedSnapshot,
    signals,
    findingDrafts,
    evaluatedAt: input.evaluatedAt,
    reportVersion: input.reportVersion ?? "1",
  });
}
