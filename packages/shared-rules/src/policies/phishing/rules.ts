import type {
  NavigationInput,
  RiskLevel,
  Rule,
  RuleOutcome,
} from "../../engine/types.js";
import {
  extractHostname,
  extractRegistrableDomain,
  extractTld,
} from "../../normalize/domain.js";
import {
  containsMintKeyword,
  containsWalletConnectPattern,
  deconfuseHostname,
  getDomainSignals,
  getSubdomainBrandImpersonationSignal,
  hasHomoglyphs,
  hasSuspiciousTld,
  isIpHost,
  isKnownMaliciousDomain,
  isNewDomain,
  looksLikeProtocolImpersonation,
  matchedLureKeywords,
} from "../../signals/domain-signals.js";
import { evaluateDomainRiskRule } from "./domainRiskRule.js";
import { lookalikeRules } from "./lookalikeRules.js";
import { PHISHING_CODES } from "./codes.js";
import { punycodeRules } from "./punycodeRules.js";
import { PHISH_REDIRECT_CHAIN_ABUSE } from "./redirectChainRules.js";

const PHISH_IMPERSONATION_NEW_DOMAIN: Rule<NavigationInput> = {
  id: "PHISH_IMPERSONATION_NEW_DOMAIN",
  name: "New domain impersonating known protocol",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 10,
  predicate(ctx) {
    const impersonation = looksLikeProtocolImpersonation(ctx.rawUrl);
    if (!impersonation) return false;
    return isNewDomain(ctx.domainContext.ageHours);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.PHISH_IMPERSONATION_NEW_DOMAIN];
  },
  buildEvidence(ctx) {
    const impersonation = looksLikeProtocolImpersonation(ctx.rawUrl);
    return {
      similarityScore: impersonation?.similarityScore ?? 0,
      target: impersonation?.target ?? "unknown",
      domainAgeHours: ctx.domainContext.ageHours,
    };
  },
};

const PHISH_SUSPICIOUS_TLD_MINT_KEYWORD: Rule<NavigationInput> = {
  id: "PHISH_SUSPICIOUS_TLD_MINT_KEYWORD",
  name: "Suspicious TLD with crypto lure keywords",
  eventKind: "navigation",
  severity: "high",
  outcome: "warn",
  priority: 20,
  predicate(ctx) {
    if (!hasSuspiciousTld(ctx.rawUrl)) return false;
    return containsMintKeyword(ctx.rawUrl);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.PHISH_SUSPICIOUS_TLD_MINT_KEYWORD];
  },
  buildEvidence(ctx) {
    const hostname = extractHostname(ctx.rawUrl);
    return {
      tld: extractTld(hostname),
      matchedKeywords: matchedLureKeywords(ctx.rawUrl),
    };
  },
};

const PHISH_KNOWN_MALICIOUS_DOMAIN: Rule<NavigationInput> = {
  id: "PHISH_KNOWN_MALICIOUS_DOMAIN",
  name: "Domain in known-malicious threat feed",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 5,
  predicate(ctx) {
    return isKnownMaliciousDomain(ctx.domainContext.isKnownMalicious);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.PHISH_KNOWN_MALICIOUS_DOMAIN];
  },
  buildEvidence(ctx) {
    return {
      domain: extractHostname(ctx.rawUrl),
    };
  },
};

const PHISH_IP_HOST_URL: Rule<NavigationInput> = {
  id: "PHISH_IP_HOST_URL",
  name: "Direct IP address access",
  eventKind: "navigation",
  severity: "high",
  outcome: "warn",
  priority: 25,
  predicate(ctx) {
    return isIpHost(ctx.rawUrl);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.DIRECT_IP_ACCESS];
  },
  buildEvidence(ctx) {
    return {
      hostname: extractHostname(ctx.rawUrl),
    };
  },
};

const PHISH_NEW_DOMAIN_WALLET_CONNECT: Rule<NavigationInput> = {
  id: "PHISH_NEW_DOMAIN_WALLET_CONNECT",
  name: "New domain with WalletConnect pattern",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 8,
  predicate(ctx) {
    const hasWcPattern =
      ctx.containsWalletConnectPattern ?? containsWalletConnectPattern(ctx.rawUrl);
    if (!hasWcPattern) return false;
    return isNewDomain(ctx.domainContext.ageHours, 168);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.NEW_DOMAIN_WALLET_CONNECT];
  },
  buildEvidence(ctx) {
    return {
      domainAgeHours: ctx.domainContext.ageHours,
      domain: extractHostname(ctx.rawUrl),
    };
  },
};

const PHISH_HOMOGLYPH_DOMAIN: Rule<NavigationInput> = {
  id: "PHISH_HOMOGLYPH_DOMAIN",
  name: "Homoglyph domain impersonation",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 7,
  predicate(ctx) {
    return ctx.hasHomoglyphs ?? hasHomoglyphs(ctx.rawUrl);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.HOMOGLYPH_ATTACK];
  },
  buildEvidence(ctx) {
    const hostname = extractHostname(ctx.rawUrl);
    return {
      hostname,
      deconfused: deconfuseHostname(hostname),
    };
  },
};

const PHISH_REDIRECT_CHAIN: Rule<NavigationInput> = {
  id: "PHISH_REDIRECT_CHAIN",
  name: "Suspicious redirect chain",
  eventKind: "navigation",
  severity: "medium",
  outcome: "warn",
  priority: 30,
  predicate(ctx) {
    const redirectCount = ctx.redirectCount ?? 0;
    if (redirectCount < 3) return false;
    const finalDomain = ctx.finalDomain;
    if (!finalDomain) return false;

    const originalHostname = extractHostname(ctx.rawUrl);
    const originalRegistrable = extractRegistrableDomain(originalHostname);
    const finalRegistrable = extractRegistrableDomain(finalDomain);

    return originalRegistrable !== finalRegistrable;
  },
  buildReasonCodes() {
    return [PHISHING_CODES.SUSPICIOUS_REDIRECT_CHAIN];
  },
  buildEvidence(ctx) {
    const originalHostname = extractHostname(ctx.rawUrl);
    return {
      originalDomain: extractRegistrableDomain(originalHostname),
      finalDomain: ctx.finalDomain ?? "unknown",
      redirectCount: ctx.redirectCount ?? 0,
    };
  },
};

function mapLegacySeverityToRiskLevel(severity: "WARN" | "BLOCK"): RiskLevel {
  return severity === "BLOCK" ? "critical" : "high";
}

function mapLegacySeverityToOutcome(severity: "WARN" | "BLOCK"): RuleOutcome {
  return severity === "BLOCK" ? "block" : "warn";
}

const LOOKALIKE_RULES: Rule<NavigationInput>[] = lookalikeRules.map((definition, index) => ({
  id: definition.ruleId,
  name: `Lookalike phishing rule: ${definition.ruleId}`,
  eventKind: "navigation",
  severity: mapLegacySeverityToRiskLevel(
    definition.ruleId === "PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD"
      ? "BLOCK"
      : "WARN"
  ),
  outcome: mapLegacySeverityToOutcome(
    definition.ruleId === "PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD"
      ? "BLOCK"
      : "WARN"
  ),
  priority: 40 + index,
  predicate(ctx) {
    const domain = extractHostname(ctx.rawUrl);
    const result = definition.evaluate({
      domain,
      hostname: domain,
      host: domain,
      url: ctx.rawUrl,
    });

    if (!result.matched) {
      return false;
    }

    if (
      definition.ruleId === "PHISH_LOOKALIKE_BRAND_DOMAIN" &&
      result.evidence.similarityMethod === "EXACT_SUBSTRING"
    ) {
      return false;
    }

    return true;
  },
  buildReasonCodes() {
    return [definition.ruleId];
  },
  buildEvidence(ctx) {
    const domain = extractHostname(ctx.rawUrl);
    const result = definition.evaluate({
      domain,
      hostname: domain,
      host: domain,
      url: ctx.rawUrl,
    });
    return result.evidence;
  },
}));

interface PunycodeRuleDefinition {
  id: string;
  severity: "BLOCK";
  match: (input: { domain?: string | null }) => {
    ruleId: string;
    severity: "BLOCK";
    evidence: Record<string, unknown>;
  } | null;
}

const PUNYCODE_RULES: Rule<NavigationInput>[] = punycodeRules
  .filter((rule): rule is PunycodeRuleDefinition => {
    return (
      typeof rule === "object" &&
      rule !== null &&
      "id" in rule &&
      "severity" in rule &&
      "match" in rule &&
      typeof rule.id === "string" &&
      typeof rule.match === "function"
    );
  })
  .map((rule, index) => ({
    id: rule.id,
    name: `Punycode phishing rule: ${rule.id}`,
    eventKind: "navigation",
    severity: "critical",
    outcome: "block",
    priority: 6 + index,
    predicate(ctx) {
      const domain = extractHostname(ctx.rawUrl);
      return rule.match({ domain, rawUrl: ctx.rawUrl }) !== null;
    },
    buildReasonCodes() {
      return [rule.id];
    },
    buildEvidence(ctx) {
      const domain = extractHostname(ctx.rawUrl);
      return rule.match({ domain, rawUrl: ctx.rawUrl })?.evidence ?? {};
    },
  }));

const PHISH_DOMAIN_RISK_SCORE: Rule<NavigationInput> = {
  id: "PHISH_DOMAIN_RISK_SCORE",
  name: "Domain risk score threshold exceeded",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 60,
  predicate(ctx) {
    const domain = extractHostname(ctx.rawUrl);
    const result = evaluateDomainRiskRule({
      domain,
      domainAgeHours: ctx.domainContext.ageHours,
      redirectCount: ctx.redirectCount ?? 0,
    });
    return result.severity === "BLOCK";
  },
  buildReasonCodes() {
    return ["PHISH_DOMAIN_RISK_SCORE"];
  },
  buildEvidence(ctx) {
    const domain = extractHostname(ctx.rawUrl);
    const result = evaluateDomainRiskRule({
      domain,
      domainAgeHours: ctx.domainContext.ageHours,
      redirectCount: ctx.redirectCount ?? 0,
    });
    return result.evidence;
  },
};

const PHISH_SUBDOMAIN_BRAND_IMPERSONATION: Rule<NavigationInput> = {
  id: "PHISH_SUBDOMAIN_BRAND_IMPERSONATION",
  name: "Brand token found in subdomain on non-brand registrable domain",
  eventKind: "navigation",
  priority: 70,
  severity: "high",
  outcome: "block",
  predicate(ctx) {
    const signals = getDomainSignals(ctx.rawUrl);
    const { hostname, registrableDomain } = signals;
    const signal = getSubdomainBrandImpersonationSignal(
      hostname,
      registrableDomain,
    );
    return signal !== null;
  },
  buildReasonCodes() {
    return ["PHISH_SUBDOMAIN_BRAND_IMPERSONATION"];
  },
  buildEvidence(ctx) {
    const signals = getDomainSignals(ctx.rawUrl);
    const { hostname, registrableDomain } = signals;
    const signal = getSubdomainBrandImpersonationSignal(
      hostname,
      registrableDomain,
    );

    if (!signal) {
      return {};
    }

    return {
      hostname,
      registrableDomain,
      matchedBrand: signal.matchedBrand,
      subdomainLabel: signal.subdomainLabel,
    };
  },
};

/** All phishing rules, exported for registry consumption. */
export const PHISHING_RULES: readonly Rule<NavigationInput>[] = [
  PHISH_KNOWN_MALICIOUS_DOMAIN,
  PHISH_HOMOGLYPH_DOMAIN,
  PHISH_NEW_DOMAIN_WALLET_CONNECT,
  PHISH_IMPERSONATION_NEW_DOMAIN,
  PHISH_SUSPICIOUS_TLD_MINT_KEYWORD,
  PHISH_IP_HOST_URL,
  PHISH_REDIRECT_CHAIN,
  ...LOOKALIKE_RULES,
  ...PUNYCODE_RULES,
  PHISH_DOMAIN_RISK_SCORE,
  PHISH_SUBDOMAIN_BRAND_IMPERSONATION,
  PHISH_REDIRECT_CHAIN_ABUSE,
];
