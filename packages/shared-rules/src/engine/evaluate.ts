import type {
  EngineResult,
  NavigationInput,
  Rule,
  SignatureInput,
  TransactionEvaluationResult,
  TransactionInput,
} from "./types.js";
import { sortRules } from "./priorities.js";
import {
  assembleTransactionVerdict,
  assembleVerdict,
  collectMatches,
} from "./verdict.js";
import { getRulesForEventKind } from "../registry/index.js";
import { buildTransactionSignals } from "../signals/transaction-signals.js";
import { classifyTransactionRisk } from "../signals/transaction-risk.js";

function finalizeTransactionEvaluationInput(
  input: TransactionInput | SignatureInput
): TransactionInput | SignatureInput {
  const {
    signals: _signals,
    riskClassification: _riskClassification,
    ...base
  } = input;
  const signals = buildTransactionSignals(base);

  return {
    ...base,
    signals,
    riskClassification: classifyTransactionRisk({
      ...base,
      signals,
    }),
  };
}

/**
 * Evaluate typed rules against a narrowed input.
 * Sorts rules deterministically, runs all predicates, and assembles a verdict.
 *
 * @param rules - Rules for the specific event kind.
 * @param input - The typed input context.
 * @returns The assembled EngineResult.
 */
function evaluateTyped<T>(
  rules: readonly Rule<T>[],
  input: T
): EngineResult {
  const sorted = sortRules(rules);
  const matches = collectMatches(sorted, input);
  const verdict = assembleVerdict(matches);

  return {
    verdict,
    matchedRules: verdict.matchedRules,
    reasonCodes: verdict.reasonCodes,
    evidence: verdict.evidence,
  };
}

/**
 * Main entry point: evaluate a navigation input against the registered rules.
 *
 * The current public package surface is intentionally navigation-only.
 * Evaluation is synchronous, deterministic, and side-effect free.
 *
 * @param input - A navigation input built by the caller.
 * @returns EngineResult with verdict, matchedRules, reasonCodes, and evidence.
 */
export function evaluate(input: NavigationInput): EngineResult {
  const rules = getRulesForEventKind("navigation");
  return evaluateTyped(rules, input);
}

/**
 * Evaluate a normalized Layer 3 transaction or signature input.
 *
 * Rules are sorted deterministically, evaluated synchronously, and assembled
 * into the Layer 3 verdict contract.
 *
 * @param input - A normalized transaction or signature context.
 * @returns TransactionEvaluationResult with Layer 3 verdict metadata.
 */
export function evaluateTransaction(
  input: TransactionInput | SignatureInput
): TransactionEvaluationResult {
  const finalizedInput = finalizeTransactionEvaluationInput(input);

  if (finalizedInput.eventKind === "transaction") {
    const rules = getRulesForEventKind("transaction");
    const sorted = sortRules(rules);
    const matches = collectMatches(sorted, finalizedInput);
    return assembleTransactionVerdict(finalizedInput, matches);
  }

  const rules = getRulesForEventKind("signature");
  const sorted = sortRules(rules);
  const matches = collectMatches(sorted, finalizedInput);
  return assembleTransactionVerdict(finalizedInput, matches);
}
