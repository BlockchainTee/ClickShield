import { assertWalletScanRequestCapabilityTruth } from "../capabilities.js";
import { assembleSolanaWalletEvaluation } from "./assemble.js";
import { normalizeSolanaWalletSnapshot } from "./normalize.js";
import { buildSolanaWalletFindings } from "./rules.js";
import { buildSolanaWalletSignals } from "./signals.js";
import type {
  SolanaWalletScanEvaluation,
  SolanaWalletScanEvaluationInput,
} from "./types.js";

/**
 * Evaluates a fully hydrated Solana wallet snapshot into deterministic Phase 4D report output.
 */
export function evaluateSolanaWalletScan(
  input: SolanaWalletScanEvaluationInput
): SolanaWalletScanEvaluation {
  assertWalletScanRequestCapabilityTruth(input.request);
  const normalizedSnapshot = normalizeSolanaWalletSnapshot(input);
  const signals = buildSolanaWalletSignals(normalizedSnapshot);
  const findingDrafts = buildSolanaWalletFindings(normalizedSnapshot, signals);

  return assembleSolanaWalletEvaluation({
    request: input.request,
    snapshot: input.snapshot,
    normalizedSnapshot,
    signals,
    findingDrafts,
    evaluatedAt: input.evaluatedAt,
    reportVersion: input.reportVersion ?? "1",
  });
}
