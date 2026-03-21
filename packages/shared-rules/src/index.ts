// ── Engine ──
export { evaluate } from "./engine/evaluate.js";
export { assembleVerdict, collectMatches, RULE_SET_VERSION } from "./engine/verdict.js";
export type { MatchedRuleData } from "./engine/verdict.js";
export { sortRules, compareRules } from "./engine/priorities.js";
export type {
  EventKind,
  RiskLevel,
  RuleOutcome,
  Rule,
  Verdict,
  EngineResult,
  EngineInput,
  NavigationInput,
  NavigationContext,
  TransactionInput,
  SignatureInput,
  WalletScanInput,
  DownloadInput,
  ClipboardInput,
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
  levenshteinDistance,
  stringSimilarity,
} from "./normalize/domain.js";
export {
  normalizeEvmAddress,
  normalizeSolAddress,
  isValidEvmAddress,
  isValidSolAddress,
  leadingZeroNibbles,
  EVM_ZERO_ADDRESS,
} from "./normalize/address.js";
export {
  extractSelector,
  classifySelector,
  parseApprovalAmount,
  isUnlimitedApprovalAmount,
  KNOWN_SELECTORS,
  APPROVE_SELECTOR,
  SET_APPROVAL_FOR_ALL_SELECTOR,
  INCREASE_ALLOWANCE_SELECTOR,
  PERMIT_SELECTORS,
  MAX_UINT256_HEX,
} from "./normalize/transaction.js";

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
export {
  isApprovalMethod,
  isUnlimitedApproval,
  isPermitSignature,
  isUnknownSpender,
  spenderTrustLevel,
} from "./signals/transaction-signals.js";
export {
  hasUnlimitedApprovals,
  hasInteractedWithFlaggedContract,
  approvalExposureScore,
} from "./signals/wallet-signals.js";
export type { ApprovalExposure } from "./signals/wallet-signals.js";
export {
  isExecutableFile,
  hasValidSignature,
  matchesKnownMalwareHash,
} from "./signals/download-signals.js";

// ── Registry ──
export { getRulesForEventKind, getActiveEventKinds } from "./registry/index.js";

// ── Policy Rule Arrays ──
export { PHISHING_RULES } from "./policies/phishing/rules.js";
export { TRANSACTION_RULES } from "./policies/transaction/rules.js";
export { WALLET_RULES } from "./policies/wallet/rules.js";
export { DOWNLOAD_RULES } from "./policies/download/rules.js";

// ── Policy Codes ──
export { PHISHING_CODES } from "./policies/phishing/codes.js";
export type { PhishingCode } from "./policies/phishing/codes.js";
export { TRANSACTION_CODES } from "./policies/transaction/codes.js";
export { WALLET_CODES } from "./policies/wallet/codes.js";
export { DOWNLOAD_CODES } from "./policies/download/codes.js";
