import {
  detectLookalikeDomain,
  type LookalikeDetection,
} from "../../utils/domainSimilarity";

export const PHISH_LOOKALIKE_BRAND_DOMAIN =
  "PHISH_LOOKALIKE_BRAND_DOMAIN" as const;
export const PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD =
  "PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD" as const;

export type RuleSeverity = "WARN" | "BLOCK";

export interface RuleResult {
  ruleId: string;
  severity: RuleSeverity;
  matched: boolean;
  evidence: Record<string, unknown>;
}

export interface RuleContext {
  domain?: string;
  hostname?: string;
  host?: string;
  url?: string;
  request?: {
    domain?: string;
    hostname?: string;
    host?: string;
    url?: string;
  };
  resource?: {
    domain?: string;
    hostname?: string;
    host?: string;
    url?: string;
  };
  event?: {
    domain?: string;
    hostname?: string;
    host?: string;
    url?: string;
  };
  [key: string]: unknown;
}

export interface RuleDefinition {
  ruleId: string;
  evaluate: (context: RuleContext) => RuleResult;
}

function extractDomainFromContext(context: RuleContext): string {
  const directCandidates = [
    context.domain,
    context.hostname,
    context.host,
    context.url,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  const nestedCandidates = [
    context.request,
    context.resource,
    context.event,
  ] as const;

  for (const container of nestedCandidates) {
    if (!container) {
      continue;
    }

    const values = [
      container.domain,
      container.hostname,
      container.host,
      container.url,
    ];

    for (const candidate of values) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
  }

  return "";
}

function buildEvidence(
  detection: LookalikeDetection,
): Record<string, unknown> {
  return {
    domain: detection.analysis.originalDomain,
    normalizedDomain: detection.analysis.normalizedDomain,
    registrableDomain: detection.analysis.registrableDomain,
    baseDomain: detection.analysis.baseDomain,
    protectedBrand: detection.brandMatch?.brand ?? null,
    matchedTarget: detection.brandMatch?.target ?? null,
    similarityMethod: detection.brandMatch?.matchedBy ?? null,
    levenshteinDistance:
      detection.brandMatch?.matchedBy === "LEVENSHTEIN"
        ? detection.brandMatch.distance
        : null,
    phishingKeywords: detection.phishingKeywordMatches,
  };
}

export function evaluateLookalikeBrandDomain(
  context: RuleContext,
): RuleResult {
  const domain = extractDomainFromContext(context);
  const detection = detectLookalikeDomain(domain);

  const matched =
    Boolean(detection.brandMatch) &&
    detection.phishingKeywordMatches.length === 0;

  return {
    ruleId: PHISH_LOOKALIKE_BRAND_DOMAIN,
    severity: "WARN",
    matched,
    evidence: buildEvidence(detection),
  };
}

export function evaluateLookalikeBrandWithPhishingKeyword(
  context: RuleContext,
): RuleResult {
  const domain = extractDomainFromContext(context);
  const detection = detectLookalikeDomain(domain);

  const matched =
    Boolean(detection.brandMatch) &&
    detection.phishingKeywordMatches.length > 0;

  return {
    ruleId: PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD,
    severity: "BLOCK",
    matched,
    evidence: buildEvidence(detection),
  };
}

export const lookalikeRules: RuleDefinition[] = [
  {
    ruleId: PHISH_LOOKALIKE_BRAND_DOMAIN,
    evaluate: evaluateLookalikeBrandDomain,
  },
  {
    ruleId: PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD,
    evaluate: evaluateLookalikeBrandWithPhishingKeyword,
  },
];

export default lookalikeRules;
