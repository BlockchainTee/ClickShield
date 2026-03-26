import type {
  Rule,
  RiskLevel,
  RuleOutcome,
  SignatureInput,
  TransactionEvaluationResult,
  TransactionInput,
  TransactionOverrideLevel,
  TransactionVerdict,
  TransactionVerdictStatus,
  Verdict,
} from "./types.js";
import { buildTransactionExplanation } from "../transaction/explain.js";

/** Current version of the rule set. */
export const RULE_SET_VERSION = "0.1.0";

/** Numeric weight for risk level comparison (higher = more severe). */
const SEVERITY_WEIGHT: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/**
 * Matched rule data collected during evaluation.
 */
export interface MatchedRuleData {
  /** The rule that matched. */
  readonly ruleId: string;
  /** The outcome of the matched rule. */
  readonly outcome: RuleOutcome;
  /** The severity of the matched rule. */
  readonly severity: RiskLevel;
  /** Reason codes produced by the matched rule. */
  readonly reasonCodes: string[];
  /** Evidence produced by the matched rule. */
  readonly evidence: Record<string, unknown>;
}

/**
 * Assemble a Verdict from a list of matched rule data.
 *
 * Winning-rule contract:
 *   The first element in `matches` is the winning rule — the one with the
 *   lowest numeric priority value (strongest priority). Its outcome becomes
 *   the verdict's `status`.
 *
 * Risk-level contract:
 *   The verdict's `riskLevel` is the maximum severity across ALL matched
 *   rules, regardless of priority ordering. A weaker-priority rule with
 *   `critical` severity still escalates the overall risk level.
 *
 * Aggregation:
 *   All matched rules contribute their reasonCodes, matchedRules, and
 *   evidence to the final verdict.
 *
 * If no rules matched, returns an "allow" verdict at "low" risk.
 *
 * @param matches - Array of matched rule data, pre-sorted strongest-first
 *   (lowest numeric priority value first).
 * @returns The assembled Verdict.
 */
export function assembleVerdict(matches: readonly MatchedRuleData[]): Verdict {
  if (matches.length === 0) {
    return {
      status: "allow",
      riskLevel: "low",
      reasonCodes: [],
      matchedRules: [],
      evidence: {},
      ruleSetVersion: RULE_SET_VERSION,
    };
  }

  // Status from the winning rule (first = lowest numeric priority = strongest)
  const primary = matches[0];
  const status: RuleOutcome = primary.outcome;

  // Risk level is the max severity across ALL matched rules
  let highestRisk: RiskLevel = "low";
  for (const match of matches) {
    if (SEVERITY_WEIGHT[match.severity] > SEVERITY_WEIGHT[highestRisk]) {
      highestRisk = match.severity;
    }
  }

  // Aggregate reason codes deterministically (preserve order, deduplicate)
  const seenCodes = new Set<string>();
  const reasonCodes: string[] = [];
  for (const match of matches) {
    for (const code of match.reasonCodes) {
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        reasonCodes.push(code);
      }
    }
  }

  // Collect all matched rule IDs
  const matchedRules = matches.map((m) => m.ruleId);

  // Merge evidence from all matched rules
  const evidence: Record<string, unknown> = {};
  for (const match of matches) {
    for (const [key, value] of Object.entries(match.evidence)) {
      evidence[key] = value;
    }
  }

  return {
    status,
    riskLevel: highestRisk,
    reasonCodes,
    matchedRules,
    evidence,
    ruleSetVersion: RULE_SET_VERSION,
  };
}

/**
 * Evaluate rules against an input and collect matched rule data.
 *
 * @param rules - Rules to evaluate (should already be sorted).
 * @param input - The typed input context.
 * @returns Array of matched rule data.
 */
export function collectMatches<T>(
  rules: readonly Rule<T>[],
  input: T
): MatchedRuleData[] {
  const matches: MatchedRuleData[] = [];

  for (const rule of rules) {
    if (rule.predicate(input)) {
      const reasonCodes = rule.buildReasonCodes(input);
      const evidence = rule.buildEvidence ? rule.buildEvidence(input) : {};
      matches.push({
        ruleId: rule.id,
        outcome: rule.outcome,
        severity: rule.severity,
        reasonCodes,
        evidence,
      });
    }
  }

  return matches;
}

function toTransactionStatus(status: RuleOutcome): TransactionVerdictStatus {
  switch (status) {
    case "allow":
      return "ALLOW";
    case "warn":
      return "WARN";
    case "block":
      return "BLOCK";
  }
}

function overrideLevelForStatus(
  status: TransactionVerdictStatus
): TransactionOverrideLevel {
  switch (status) {
    case "ALLOW":
      return "none";
    case "WARN":
      return "confirm";
    case "BLOCK":
      return "high_friction_confirm";
  }
}

export function assembleTransactionVerdict(
  input: TransactionInput | SignatureInput,
  matches: readonly MatchedRuleData[]
): TransactionEvaluationResult {
  const base = assembleVerdict(matches);
  const status = toTransactionStatus(base.status);
  const overrideLevel = overrideLevelForStatus(status);
  const signals = input.signals;
  const explanation = buildTransactionExplanation(input);
  const verdict: TransactionVerdict = {
    status,
    riskLevel: base.riskLevel,
    reasonCodes: base.reasonCodes,
    matchedRules: base.matchedRules,
    primaryRuleId: base.matchedRules[0] ?? null,
    evidence: base.evidence,
    explanation,
    ruleSetVersion: base.ruleSetVersion,
    intelVersions: {
      contractFeedVersion: input.intel.contractFeedVersion,
      allowlistFeedVersion: input.intel.allowlistFeedVersion,
      signatureFeedVersion: input.intel.signatureFeedVersion,
    },
    overrideAllowed: status !== "ALLOW",
    overrideLevel,
  };

  return {
    verdict,
    matchedRules: verdict.matchedRules,
    reasonCodes: verdict.reasonCodes,
    evidence: verdict.evidence,
    signals,
  };
}
