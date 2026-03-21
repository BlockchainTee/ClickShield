import type {
  EngineResult,
  NavigationInput,
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
