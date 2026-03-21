import type { Rule, RiskLevel } from "./types.js";

/** Numeric weight for risk levels (higher = more severe). */
const SEVERITY_WEIGHT: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/**
 * Compare two rules for deterministic ordering.
 *
 * Priority contract (immutable):
 *   Strongest priority = lowest numeric value.
 *   A rule with priority 5 always beats a rule with priority 10.
 *
 * Sort order:
 * 1. Priority — lowest numeric value first (strongest).
 * 2. Severity — when priorities are equal, higher severity first
 *    (critical > high > medium > low). This is a tiebreak only.
 * 3. Rule ID — when both priority and severity are equal,
 *    lexicographic ascending for deterministic tie-break.
 *
 * @param a - First rule to compare.
 * @param b - Second rule to compare.
 * @returns Negative if a sorts before b, positive if after, zero if equal.
 */
export function compareRules<T>(a: Rule<T>, b: Rule<T>): number {
  // 1. Priority: lowest numeric value = strongest
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }

  // 2. Severity tiebreak: critical > high > medium > low
  const aWeight = SEVERITY_WEIGHT[a.severity];
  const bWeight = SEVERITY_WEIGHT[b.severity];
  if (aWeight !== bWeight) {
    return bWeight - aWeight;
  }

  // 3. Rule ID tiebreak: alphabetical ascending
  return a.id.localeCompare(b.id);
}

/**
 * Sort an array of rules deterministically.
 * Returns a new sorted array (does not mutate input).
 *
 * The first element after sorting is the strongest rule
 * (lowest numeric priority value). See {@link compareRules} for the full contract.
 *
 * @param rules - The rules to sort.
 * @returns A new array sorted strongest-first.
 */
export function sortRules<T>(rules: readonly Rule<T>[]): Rule<T>[] {
  return [...rules].sort(compareRules);
}
