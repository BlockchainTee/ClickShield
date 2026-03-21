import type {
  EngineInput,
  EngineResult,
  NavigationInput,
  TransactionInput,
  SignatureInput,
  WalletScanInput,
  DownloadInput,
  ClipboardInput,
  Rule,
} from "./types.js";
import { sortRules } from "./priorities.js";
import { assembleVerdict, collectMatches } from "./verdict.js";
import { getRulesForEventKind } from "../registry/index.js";

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
 * Main entry point: evaluate an engine input against all registered rules.
 *
 * Narrows the discriminated union by eventKind, selects the appropriate
 * typed rule set from the registry, runs all rules synchronously, and
 * assembles a deterministic verdict.
 *
 * @param input - A discriminated EngineInput (navigation, transaction, etc.).
 * @returns EngineResult with verdict, matchedRules, reasonCodes, and evidence.
 */
export function evaluate(input: EngineInput): EngineResult {
  switch (input.eventKind) {
    case "navigation": {
      const rules = getRulesForEventKind("navigation") as Rule<NavigationInput>[];
      return evaluateTyped(rules, input);
    }
    case "transaction": {
      const rules = getRulesForEventKind("transaction") as Rule<TransactionInput>[];
      return evaluateTyped(rules, input);
    }
    case "signature": {
      const rules = getRulesForEventKind("signature") as Rule<SignatureInput>[];
      return evaluateTyped(rules, input);
    }
    case "wallet_scan": {
      const rules = getRulesForEventKind("wallet_scan") as Rule<WalletScanInput>[];
      return evaluateTyped(rules, input);
    }
    case "download": {
      const rules = getRulesForEventKind("download") as Rule<DownloadInput>[];
      return evaluateTyped(rules, input);
    }
    case "clipboard": {
      const rules = getRulesForEventKind("clipboard") as Rule<ClipboardInput>[];
      return evaluateTyped(rules, input);
    }
  }
}
