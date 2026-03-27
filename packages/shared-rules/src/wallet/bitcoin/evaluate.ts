import { assertWalletScanRequestCapabilityTruth } from "../capabilities.js";
import { assembleBitcoinWalletEvaluation } from "./assemble.js";
import { normalizeBitcoinWalletSnapshot } from "./normalize.js";
import { buildBitcoinWalletFindings } from "./rules.js";
import { buildBitcoinWalletSignals } from "./signals.js";
import type {
  BitcoinWalletScanEvaluation,
  BitcoinWalletScanEvaluationInput,
} from "./types.js";

/**
 * Evaluates a fully hydrated Bitcoin wallet snapshot into deterministic Phase 4E report output.
 */
export function evaluateBitcoinWalletScan(
  input: BitcoinWalletScanEvaluationInput
): BitcoinWalletScanEvaluation {
  assertWalletScanRequestCapabilityTruth(input.request);
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
