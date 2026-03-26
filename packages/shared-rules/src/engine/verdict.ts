import type {
  Rule,
  RiskLevel,
  RuleOutcome,
  SignatureInput,
  TransactionMatchedReason,
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

/** Numeric weight for outcome comparison (higher = stronger). */
const OUTCOME_WEIGHT: Record<RuleOutcome, number> = {
  allow: 0,
  warn: 1,
  block: 2,
};

/**
 * Matched rule data collected during evaluation.
 */
export interface MatchedRuleData {
  /** The rule that matched. */
  readonly ruleId: string;
  /** Lower number = stronger rule-level priority within the same outcome/severity. */
  readonly priority: number;
  /** The outcome of the matched rule. */
  readonly outcome: RuleOutcome;
  /** The severity of the matched rule. */
  readonly severity: RiskLevel;
  /** Reason codes produced by the matched rule. */
  readonly reasonCodes: string[];
  /** Evidence produced by the matched rule. */
  readonly evidence: Record<string, unknown>;
}

function dedupeStable(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      deduped.push(value);
    }
  }

  return deduped;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stabilizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stabilizeValue(entry));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const stable: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    stable[key] = stabilizeValue(value[key]);
  }

  return stable;
}

function normalizeMatchedRule(match: MatchedRuleData): MatchedRuleData {
  return {
    ...match,
    reasonCodes: dedupeStable(match.reasonCodes),
    evidence: stabilizeValue(match.evidence) as Record<string, unknown>,
  };
}

function compareMatchedRules(a: MatchedRuleData, b: MatchedRuleData): number {
  const outcomeDelta = OUTCOME_WEIGHT[b.outcome] - OUTCOME_WEIGHT[a.outcome];
  if (outcomeDelta !== 0) {
    return outcomeDelta;
  }

  const severityDelta = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
  if (severityDelta !== 0) {
    return severityDelta;
  }

  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }

  return a.ruleId.localeCompare(b.ruleId);
}

function orderMatchedRules(
  matches: readonly MatchedRuleData[]
): MatchedRuleData[] {
  return matches.map(normalizeMatchedRule).sort(compareMatchedRules);
}

function toTransactionMatchedReason(
  match: MatchedRuleData
): TransactionMatchedReason {
  return {
    ruleId: match.ruleId,
    outcome: match.outcome,
    severity: match.severity,
    priority: match.priority,
    reasonCodes: match.reasonCodes,
    evidence: match.evidence,
  };
}

/**
 * Assemble a Verdict from a list of matched rule data.
 *
 * Winning-rule contract:
 *   The winning rule is selected centrally from all matches using explicit
 *   outcome/severity/priority tie-breaks:
 *   1. Outcome priority: block > warn > allow
 *   2. Severity: critical > high > medium > low
 *   3. Rule priority: lower numeric value wins within the same outcome/severity
 *   4. Rule ID: lexicographic ascending fallback for deterministic ties
 *   Its outcome becomes the verdict's `status`.
 *
 * Risk-level contract:
 *   The verdict's `riskLevel` is the maximum severity across ALL matched
 *   rules, regardless of priority ordering. A weaker-priority rule with
 *   `critical` severity still escalates the overall risk level.
 *
 * Aggregation:
 *   All matched rules contribute their reasonCodes, matchedRules, and
 *   evidence to the final verdict. Evidence keys are merged strongest-first,
 *   so weaker matches cannot overwrite stronger evidence.
 *
 * If no rules matched, returns an "allow" verdict at "low" risk.
 *
 * @param matches - Array of matched rule data in any order.
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

  const orderedMatches = orderMatchedRules(matches);
  const primary = orderedMatches[0];
  const status: RuleOutcome = primary.outcome;

  // Risk level is the max severity across ALL matched rules
  let highestRisk: RiskLevel = "low";
  for (const match of orderedMatches) {
    if (SEVERITY_WEIGHT[match.severity] > SEVERITY_WEIGHT[highestRisk]) {
      highestRisk = match.severity;
    }
  }

  // Aggregate reason codes deterministically (preserve order, deduplicate)
  const reasonCodes: string[] = [];
  for (const match of orderedMatches) {
    reasonCodes.push(...match.reasonCodes);
  }
  const consolidatedReasonCodes = dedupeStable(reasonCodes);

  // Collect all matched rule IDs
  const matchedRules = orderedMatches.map((m) => m.ruleId);

  // Merge evidence from all matched rules without letting weaker matches
  // override stronger evidence keys.
  const evidence: Record<string, unknown> = {};
  for (const match of orderedMatches) {
    for (const [key, value] of Object.entries(match.evidence)) {
      if (!(key in evidence)) {
        evidence[key] = value;
      }
    }
  }

  return {
    status,
    riskLevel: highestRisk,
    reasonCodes: consolidatedReasonCodes,
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
        priority: rule.priority,
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
  const orderedMatches = orderMatchedRules(matches);
  const primaryReason = orderedMatches[0]
    ? toTransactionMatchedReason(orderedMatches[0])
    : null;
  const secondaryReasons = orderedMatches
    .slice(1)
    .map((match) => toTransactionMatchedReason(match));
  const status = toTransactionStatus(base.status);
  const overrideLevel = overrideLevelForStatus(status);
  const signals = input.signals;
  const riskClassification = input.riskClassification;
  const explanation = buildTransactionExplanation(input);
  const verdict: TransactionVerdict = {
    status,
    riskLevel: base.riskLevel,
    reasonCodes: base.reasonCodes,
    matchedRules: base.matchedRules,
    primaryRuleId: primaryReason?.ruleId ?? null,
    primaryReason,
    secondaryReasons,
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
    riskClassification,
  };
}
