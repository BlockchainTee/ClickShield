// ── Engine ──
export { evaluate } from "./engine/evaluate.js";
export { RULE_SET_VERSION } from "./engine/verdict.js";
export type {
  RiskLevel,
  RuleOutcome,
  Verdict,
  EngineResult,
  NavigationInput,
  NavigationContext,
  DomainContext,
} from "./engine/types.js";

// ── Context Builder ──
export {
  buildNavigationContext,
  contextToInput,
} from "./context-builder.js";
export type { BuildContextOptions } from "./context-builder.js";

// ── Reason Messages ──
export {
  getReasonMessage,
  getVerdictTitle,
  riskBadgeLabel,
} from "./reason-messages.js";
export type { ReasonMessage } from "./reason-messages.js";

// ── Normalize ──
export { normalizeUrl, isValidUrl } from "./normalize/url.js";
export {
  extractHostname,
  extractRegistrableDomain,
  extractTld,
} from "./normalize/domain.js";

// ── Signals ──
export {
  isNewDomain,
  looksLikeProtocolImpersonation,
  containsMintKeyword,
  containsAirdropKeyword,
  isKnownMaliciousDomain,
  domainSimilarityScore,
  hasSuspiciousTld,
  matchedLureKeywords,
  isIpHost,
  containsWalletConnectPattern,
  hasHomoglyphs,
  deconfuseHostname,
  KNOWN_PROTOCOL_DOMAINS,
  SUSPICIOUS_TLDS,
} from "./signals/domain-signals.js";

// ── Policy Codes ──
export { PHISHING_CODES } from "./policies/phishing/codes.js";
export type { PhishingCode } from "./policies/phishing/codes.js";
