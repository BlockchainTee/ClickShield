import { assembleEvmWalletEvaluation } from "./assemble.js";
import { normalizeEvmWalletSnapshot } from "./normalize.js";
import { buildEvmWalletFindings } from "./rules.js";
import { buildEvmWalletSignals } from "./signals.js";
import type {
  EvmWalletScanEvaluation,
  EvmWalletScanEvaluationInput,
} from "./types.js";

/**
 * Evaluates a fully hydrated EVM wallet snapshot into deterministic Phase 4B report output.
 */
export function evaluateEvmWalletScan(
  input: EvmWalletScanEvaluationInput
): EvmWalletScanEvaluation {
  const normalizedSnapshot = normalizeEvmWalletSnapshot(input);
  const signals = buildEvmWalletSignals(normalizedSnapshot);
  const findingDrafts = buildEvmWalletFindings(normalizedSnapshot, signals);

  return assembleEvmWalletEvaluation({
    request: input.request,
    snapshot: input.snapshot,
    normalizedSnapshot,
    signals,
    findingDrafts,
    evaluatedAt: input.evaluatedAt,
    reportVersion: input.reportVersion ?? "1",
  });
}

