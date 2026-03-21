// GENERATED FILE - sourced from packages/shared-rules/dist/index.js via npm run sync:surfaces.
// src/engine/priorities.ts
var SEVERITY_WEIGHT = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};
function compareRules(a, b) {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  const aWeight = SEVERITY_WEIGHT[a.severity];
  const bWeight = SEVERITY_WEIGHT[b.severity];
  if (aWeight !== bWeight) {
    return bWeight - aWeight;
  }
  return a.id.localeCompare(b.id);
}
function sortRules(rules) {
  return [...rules].sort(compareRules);
}

// src/engine/verdict.ts
var RULE_SET_VERSION = "0.1.0";
var SEVERITY_WEIGHT2 = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};
function assembleVerdict(matches) {
  if (matches.length === 0) {
    return {
      status: "allow",
      riskLevel: "low",
      reasonCodes: [],
      matchedRules: [],
      evidence: {},
      ruleSetVersion: RULE_SET_VERSION
    };
  }
  const primary = matches[0];
  const status = primary.outcome;
  let highestRisk = "low";
  for (const match of matches) {
    if (SEVERITY_WEIGHT2[match.severity] > SEVERITY_WEIGHT2[highestRisk]) {
      highestRisk = match.severity;
    }
  }
  const seenCodes = /* @__PURE__ */ new Set();
  const reasonCodes = [];
  for (const match of matches) {
    for (const code of match.reasonCodes) {
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        reasonCodes.push(code);
      }
    }
  }
  const matchedRules = matches.map((m) => m.ruleId);
  const evidence = {};
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
    ruleSetVersion: RULE_SET_VERSION
  };
}
function collectMatches(rules, input) {
  const matches = [];
  for (const rule of rules) {
    if (rule.predicate(input)) {
      const reasonCodes = rule.buildReasonCodes(input);
      const evidence = rule.buildEvidence ? rule.buildEvidence(input) : {};
      matches.push({
        ruleId: rule.id,
        outcome: rule.outcome,
        severity: rule.severity,
        reasonCodes,
        evidence
      });
    }
  }
  return matches;
}

// src/policies/phishing/codes.ts
var PHISHING_CODES = {
  PHISH_IMPERSONATION_NEW_DOMAIN: "PHISH_IMPERSONATION_NEW_DOMAIN",
  PHISH_SUSPICIOUS_TLD_MINT_KEYWORD: "PHISH_SUSPICIOUS_TLD_MINT_KEYWORD",
  PHISH_KNOWN_MALICIOUS_DOMAIN: "PHISH_KNOWN_MALICIOUS_DOMAIN",
  DOMAIN_IMPERSONATION: "DOMAIN_IMPERSONATION",
  NEW_DOMAIN: "NEW_DOMAIN",
  WALLET_CONNECT_PATTERN: "WALLET_CONNECT_PATTERN",
  SUSPICIOUS_TLD: "SUSPICIOUS_TLD",
  MINT_KEYWORD: "MINT_KEYWORD",
  KNOWN_MALICIOUS: "KNOWN_MALICIOUS",
  DIRECT_IP_ACCESS: "DIRECT_IP_ACCESS",
  NEW_DOMAIN_WALLET_CONNECT: "NEW_DOMAIN_WALLET_CONNECT",
  HOMOGLYPH_ATTACK: "HOMOGLYPH_ATTACK",
  SUSPICIOUS_REDIRECT_CHAIN: "SUSPICIOUS_REDIRECT_CHAIN"
};

// src/normalize/domain.ts
var MULTI_PART_TLDS = /* @__PURE__ */ new Set([
  "co.uk",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.za",
  "co.in",
  "com.au",
  "com.br",
  "com.cn",
  "com.mx",
  "com.sg",
  "com.tw",
  "org.uk",
  "org.au",
  "net.au",
  "gov.uk",
  "ac.uk",
  "ne.jp",
  "or.jp"
]);
function extractHostname(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  let urlStr = trimmed;
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = "https://" + urlStr;
  }
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return "";
  }
}
function extractRegistrableDomain(hostname) {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length <= 2) return hostname.toLowerCase();
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return parts.length >= 3 ? parts.slice(-3).join(".") : hostname.toLowerCase();
  }
  return parts.slice(-2).join(".");
}
function extractTld(hostname) {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length < 2) return "";
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return lastTwo;
  }
  return parts[parts.length - 1];
}
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a.length > b.length) {
    [a, b] = [b, a];
  }
  const aLen = a.length;
  const bLen = b.length;
  let prev = new Array(aLen + 1);
  let curr = new Array(aLen + 1);
  for (let i = 0; i <= aLen; i++) {
    prev[i] = i;
  }
  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1,
        prev[i] + 1,
        prev[i - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[aLen];
}
function stringSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

// src/signals/domain-signals.ts
var KNOWN_PROTOCOL_DOMAINS = [
  "uniswap.org",
  "opensea.io",
  "blur.io",
  "aave.com",
  "compound.finance",
  "lido.fi",
  "metamask.io",
  "phantom.app",
  "trustwallet.com",
  "rainbow.me",
  "coinbase.com"
];
var SUSPICIOUS_TLDS = /* @__PURE__ */ new Set([
  "xyz",
  "site",
  "click",
  "top",
  "buzz",
  "tk",
  "ml",
  "ga",
  "cf",
  "gq"
]);
var MINT_KEYWORDS = [
  "mint",
  "claim",
  "airdrop",
  "reward",
  "free-nft",
  "giveaway",
  "freemint"
];
var WALLET_CONNECT_PATTERNS = [
  "walletconnect",
  "wc?uri=",
  "wc=",
  "wallet-connect",
  "connect-wallet"
];
var CONFUSABLE_MAP = /* @__PURE__ */ new Map([
  // Cyrillic
  ["\u0430", "a"],
  // а → a
  ["\u0435", "e"],
  // е → e
  ["\u043E", "o"],
  // о → o
  ["\u0440", "p"],
  // р → p
  ["\u0441", "c"],
  // с → c
  ["\u0443", "y"],
  // у → y
  ["\u0445", "x"],
  // х → x
  ["\u043A", "k"],
  // к → k
  ["\u041C", "M"],
  // М → M
  ["\u0422", "T"],
  // Т → T
  ["\u041D", "H"],
  // Н → H
  ["\u0412", "B"],
  // В → B
  ["\u0410", "A"],
  // А → A
  ["\u0421", "C"],
  // С → C
  ["\u0415", "E"],
  // Е → E
  ["\u041E", "O"],
  // О → O
  // Greek
  ["\u03B1", "a"],
  // α → a
  ["\u03BF", "o"],
  // ο → o
  ["\u03B5", "e"],
  // ε → e
  ["\u03C1", "p"],
  // ρ → p
  // Latin look-alikes
  ["\u0131", "i"],
  // ı (dotless i) → i
  ["\u1D00", "A"],
  // ᴀ → A
  ["\u0250", "a"],
  // ɐ → a
  ["\u0261", "g"]
  // ɡ → g
]);
function isNewDomain(ageHours, thresholdHours = 72) {
  if (ageHours === null) return false;
  return ageHours >= 0 && ageHours < thresholdHours;
}
function looksLikeProtocolImpersonation(rawUrl) {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return null;
  const registrable = extractRegistrableDomain(hostname);
  let bestTarget = "";
  let bestScore = 0;
  for (const protocol of KNOWN_PROTOCOL_DOMAINS) {
    if (registrable === protocol) return null;
    const score = stringSimilarity(registrable, protocol);
    if (score > bestScore) {
      bestScore = score;
      bestTarget = protocol;
    }
  }
  if (bestScore >= 0.8 && bestTarget) {
    return { target: bestTarget, similarityScore: bestScore };
  }
  return null;
}
function containsMintKeyword(rawUrl) {
  const lower = rawUrl.toLowerCase();
  return MINT_KEYWORDS.some((kw) => lower.includes(kw));
}
function containsAirdropKeyword(rawUrl) {
  const lower = rawUrl.toLowerCase();
  return lower.includes("airdrop");
}
function isKnownMaliciousDomain(isKnownMalicious) {
  return isKnownMalicious;
}
function domainSimilarityScore(rawUrl) {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return 0;
  const registrable = extractRegistrableDomain(hostname);
  let best = 0;
  for (const protocol of KNOWN_PROTOCOL_DOMAINS) {
    const score = stringSimilarity(registrable, protocol);
    if (score > best) {
      best = score;
    }
  }
  return best;
}
function hasSuspiciousTld(rawUrl) {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return false;
  const tld = extractTld(hostname);
  return SUSPICIOUS_TLDS.has(tld);
}
function matchedLureKeywords(rawUrl) {
  const lower = rawUrl.toLowerCase();
  return MINT_KEYWORDS.filter((kw) => lower.includes(kw));
}
function isIpHost(rawUrl) {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (hostname.startsWith("[") || hostname.includes(":")) return true;
  return false;
}
function containsWalletConnectPattern(rawUrl) {
  const lower = rawUrl.toLowerCase();
  return WALLET_CONNECT_PATTERNS.some((p) => lower.includes(p));
}
function hasHomoglyphs(rawUrl) {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return false;
  for (const char of hostname) {
    if (CONFUSABLE_MAP.has(char)) return true;
  }
  return false;
}
function deconfuseHostname(hostname) {
  let result = "";
  for (const char of hostname) {
    const replacement = CONFUSABLE_MAP.get(char);
    result += replacement ?? char;
  }
  return result;
}

// src/policies/phishing/rules.ts
var PHISH_IMPERSONATION_NEW_DOMAIN = {
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
      domainAgeHours: ctx.domainContext.ageHours
    };
  }
};
var PHISH_SUSPICIOUS_TLD_MINT_KEYWORD = {
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
      matchedKeywords: matchedLureKeywords(ctx.rawUrl)
    };
  }
};
var PHISH_KNOWN_MALICIOUS_DOMAIN = {
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
      domain: extractHostname(ctx.rawUrl)
    };
  }
};
var PHISH_IP_HOST_URL = {
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
      hostname: extractHostname(ctx.rawUrl)
    };
  }
};
var PHISH_NEW_DOMAIN_WALLET_CONNECT = {
  id: "PHISH_NEW_DOMAIN_WALLET_CONNECT",
  name: "New domain with WalletConnect pattern",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 8,
  predicate(ctx) {
    const hasWcPattern = ctx.containsWalletConnectPattern ?? containsWalletConnectPattern(ctx.rawUrl);
    if (!hasWcPattern) return false;
    return isNewDomain(ctx.domainContext.ageHours, 168);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.NEW_DOMAIN_WALLET_CONNECT];
  },
  buildEvidence(ctx) {
    return {
      domainAgeHours: ctx.domainContext.ageHours,
      domain: extractHostname(ctx.rawUrl)
    };
  }
};
var PHISH_HOMOGLYPH_DOMAIN = {
  id: "PHISH_HOMOGLYPH_DOMAIN",
  name: "Homoglyph domain impersonation",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 7,
  predicate(ctx) {
    const detected = ctx.hasHomoglyphs ?? hasHomoglyphs(ctx.rawUrl);
    return detected;
  },
  buildReasonCodes() {
    return [PHISHING_CODES.HOMOGLYPH_ATTACK];
  },
  buildEvidence(ctx) {
    const hostname = extractHostname(ctx.rawUrl);
    return {
      hostname,
      deconfused: deconfuseHostname(hostname)
    };
  }
};
var PHISH_REDIRECT_CHAIN = {
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
      redirectCount: ctx.redirectCount ?? 0
    };
  }
};
var PHISHING_RULES = [
  PHISH_KNOWN_MALICIOUS_DOMAIN,
  PHISH_HOMOGLYPH_DOMAIN,
  PHISH_NEW_DOMAIN_WALLET_CONNECT,
  PHISH_IMPERSONATION_NEW_DOMAIN,
  PHISH_SUSPICIOUS_TLD_MINT_KEYWORD,
  PHISH_IP_HOST_URL,
  PHISH_REDIRECT_CHAIN
];

// src/policies/transaction/rules.ts
var TRANSACTION_RULES = [];

// src/policies/wallet/rules.ts
var WALLET_RULES = [];

// src/policies/download/rules.ts
var DOWNLOAD_RULES = [];

// src/registry/index.ts
var REGISTRY = {
  navigation: PHISHING_RULES,
  transaction: TRANSACTION_RULES,
  wallet_scan: WALLET_RULES,
  download: DOWNLOAD_RULES
};
function getRulesForEventKind(eventKind) {
  if (eventKind in REGISTRY) {
    return REGISTRY[eventKind];
  }
  return [];
}
function getActiveEventKinds() {
  return Object.keys(REGISTRY).filter(
    (kind) => REGISTRY[kind].length > 0
  );
}

// src/engine/evaluate.ts
function evaluateTyped(rules, input) {
  const sorted = sortRules(rules);
  const matches = collectMatches(sorted, input);
  const verdict = assembleVerdict(matches);
  return {
    verdict,
    matchedRules: verdict.matchedRules,
    reasonCodes: verdict.reasonCodes,
    evidence: verdict.evidence
  };
}
function evaluate(input) {
  switch (input.eventKind) {
    case "navigation": {
      const rules = getRulesForEventKind("navigation");
      return evaluateTyped(rules, input);
    }
    case "transaction": {
      const rules = getRulesForEventKind("transaction");
      return evaluateTyped(rules, input);
    }
    case "signature": {
      const rules = getRulesForEventKind("signature");
      return evaluateTyped(rules, input);
    }
    case "wallet_scan": {
      const rules = getRulesForEventKind("wallet_scan");
      return evaluateTyped(rules, input);
    }
    case "download": {
      const rules = getRulesForEventKind("download");
      return evaluateTyped(rules, input);
    }
    case "clipboard": {
      const rules = getRulesForEventKind("clipboard");
      return evaluateTyped(rules, input);
    }
  }
}

// src/normalize/url.ts
var TRACKING_PARAMS = /* @__PURE__ */ new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid"
]);
function normalizeUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  let urlStr = trimmed;
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = "https://" + urlStr;
  }
  try {
    const parsed = new URL(urlStr);
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    parsed.searchParams.sort();
    parsed.hash = "";
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}
function isValidUrl(rawUrl) {
  try {
    new URL(rawUrl);
    return true;
  } catch {
    return false;
  }
}

// src/context-builder.ts
function buildNavigationContext(opts) {
  const hostname = extractHostname(opts.rawUrl);
  const normalized = normalizeUrl(opts.rawUrl);
  let path = "";
  try {
    path = new URL(normalized).pathname;
  } catch {
  }
  const impersonation = looksLikeProtocolImpersonation(opts.rawUrl);
  return {
    eventKind: "navigation",
    normalized: {
      url: normalized,
      hostname,
      path,
      registrableDomain: extractRegistrableDomain(hostname)
    },
    signals: {
      looksLikeProtocolImpersonation: impersonation !== null,
      impersonatedProtocol: impersonation?.target,
      domainAgeHours: opts.domainAgeHours ?? null,
      containsWalletConnectPattern: containsWalletConnectPattern(opts.rawUrl),
      containsMintKeyword: containsMintKeyword(opts.rawUrl),
      isKnownMaliciousDomain: opts.isKnownMaliciousDomain ?? false,
      isIpHost: isIpHost(opts.rawUrl),
      hasHomoglyphs: hasHomoglyphs(opts.rawUrl),
      redirectCount: opts.redirectCount ?? 0,
      finalDomain: opts.finalDomain ?? hostname
    },
    intel: {
      feedVersion: opts.feedVersion,
      domainAllowlistVersion: opts.domainAllowlistVersion
    },
    meta: {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ruleSetVersion: RULE_SET_VERSION
    }
  };
}
function contextToInput(ctx) {
  const domainContext = {
    ageHours: ctx.signals.domainAgeHours,
    isKnownMalicious: ctx.signals.isKnownMaliciousDomain
  };
  return {
    eventKind: "navigation",
    rawUrl: ctx.normalized.url,
    domainContext,
    containsWalletConnectPattern: ctx.signals.containsWalletConnectPattern,
    hasHomoglyphs: ctx.signals.hasHomoglyphs,
    redirectCount: ctx.signals.redirectCount,
    finalDomain: ctx.signals.finalDomain
  };
}

// src/reason-messages.ts
var REASON_MESSAGES = {
  [PHISHING_CODES.PHISH_KNOWN_MALICIOUS_DOMAIN]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Known malicious site",
    reason: "This domain appears on a known malicious threat feed. It has been flagged for phishing, scams, or malware distribution.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway"
  },
  [PHISHING_CODES.PHISH_IMPERSONATION_NEW_DOMAIN]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Suspicious impersonation detected",
    reason: "This domain closely resembles a known Web3 protocol and was recently registered. It may be impersonating a legitimate service to steal your credentials or funds.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway"
  },
  [PHISHING_CODES.PHISH_SUSPICIOUS_TLD_MINT_KEYWORD]: {
    blockedTitle: "Suspicious site detected",
    warningTitle: "Suspicious site detected",
    reason: "This site uses a suspicious domain extension and contains crypto-related lure keywords like mint, claim, or airdrop. Exercise caution.",
    goBackLabel: "Go Back",
    proceedLabel: "Continue to Site"
  },
  [PHISHING_CODES.DIRECT_IP_ACCESS]: {
    blockedTitle: "Direct IP access detected",
    warningTitle: "Direct IP access detected",
    reason: "You are navigating to a raw IP address instead of a domain name. Legitimate Web3 services use domain names. This may indicate a phishing attempt.",
    goBackLabel: "Go Back",
    proceedLabel: "Continue to Site"
  },
  [PHISHING_CODES.NEW_DOMAIN_WALLET_CONNECT]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Suspicious wallet connection",
    reason: "This recently-registered domain is attempting to initiate a wallet connection. New domains requesting wallet access are a common phishing tactic.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway"
  },
  [PHISHING_CODES.HOMOGLYPH_ATTACK]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Unicode impersonation detected",
    reason: "This domain uses lookalike Unicode characters to impersonate a legitimate site. This is a sophisticated phishing technique known as a homoglyph attack.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway"
  },
  [PHISHING_CODES.SUSPICIOUS_REDIRECT_CHAIN]: {
    blockedTitle: "Suspicious redirects detected",
    warningTitle: "Suspicious redirects detected",
    reason: "This URL passed through multiple redirects and landed on a different domain than expected. Redirect chains are commonly used to disguise malicious destinations.",
    goBackLabel: "Go Back",
    proceedLabel: "Continue to Site"
  }
};
function getReasonMessage(reasonCode) {
  return REASON_MESSAGES[reasonCode] ?? {
    blockedTitle: "This site has been blocked",
    warningTitle: "Potential risk detected",
    reason: "ClickShield detected a potential security risk with this site.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway"
  };
}
function getVerdictTitle(outcome, reasonCode) {
  const msg = getReasonMessage(reasonCode);
  return outcome === "block" ? msg.blockedTitle : msg.warningTitle;
}
function riskBadgeLabel(riskLevel) {
  switch (riskLevel) {
    case "critical":
      return "Critical Risk";
    case "high":
      return "High Risk";
    case "medium":
      return "Medium Risk";
    case "low":
      return "Low Risk";
  }
}

// src/normalize/address.ts
var EVM_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
function normalizeEvmAddress(address) {
  const trimmed = address.trim().toLowerCase();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}
function normalizeSolAddress(address) {
  return address.trim();
}
function isValidEvmAddress(address) {
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}
function isValidSolAddress(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}
function leadingZeroNibbles(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  let count = 0;
  for (const ch of clean) {
    if (ch === "0") count++;
    else break;
  }
  return count;
}

// src/normalize/transaction.ts
var APPROVE_SELECTOR = "0x095ea7b3";
var SET_APPROVAL_FOR_ALL_SELECTOR = "0xa22cb465";
var INCREASE_ALLOWANCE_SELECTOR = "0x39509351";
var PERMIT_SELECTORS = [
  "0xd505accf",
  // permit(address,address,uint256,uint256,uint8,bytes32,bytes32)
  "0x8fcbaf0c"
  // permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)
];
var MAX_UINT256_HEX = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
var KNOWN_SELECTORS = {
  [APPROVE_SELECTOR]: "approve",
  [SET_APPROVAL_FOR_ALL_SELECTOR]: "setApprovalForAll",
  [INCREASE_ALLOWANCE_SELECTOR]: "increaseAllowance"
};
function extractSelector(calldata) {
  const clean = calldata.startsWith("0x") ? calldata : `0x${calldata}`;
  return clean.slice(0, 10).toLowerCase();
}
function classifySelector(selector) {
  const lower = selector.toLowerCase();
  if (lower === APPROVE_SELECTOR) return "approve";
  if (lower === SET_APPROVAL_FOR_ALL_SELECTOR) return "setApprovalForAll";
  if (lower === INCREASE_ALLOWANCE_SELECTOR) return "increaseAllowance";
  if (PERMIT_SELECTORS.includes(lower)) return "permit";
  return "unknown";
}
function parseApprovalAmount(calldata) {
  const clean = calldata.startsWith("0x") ? calldata.slice(2) : calldata;
  if (clean.length < 136) return "";
  return clean.slice(72, 136).toLowerCase();
}
function isUnlimitedApprovalAmount(amount) {
  return amount.toLowerCase() === MAX_UINT256_HEX;
}

// src/signals/transaction-signals.ts
var TRUSTED_SPENDERS = /* @__PURE__ */ new Set([
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad",
  // Uniswap Universal Router
  "0x000000000022d473030f116ddee9f6b43ac78ba3"
  // Permit2
]);
function isApprovalMethod(calldata) {
  const selector = extractSelector(calldata);
  const kind = classifySelector(selector);
  return kind === "approve" || kind === "setApprovalForAll" || kind === "increaseAllowance";
}
function isUnlimitedApproval(calldata) {
  if (!isApprovalMethod(calldata)) return false;
  const amount = parseApprovalAmount(calldata);
  return isUnlimitedApprovalAmount(amount);
}
function isPermitSignature(typedData) {
  if (!typedData) return false;
  try {
    const parsed = JSON.parse(typedData);
    const primaryType = parsed?.primaryType?.toLowerCase() ?? "";
    return primaryType.includes("permit");
  } catch {
    return false;
  }
}
function isUnknownSpender(spenderAddress) {
  if (!spenderAddress) return true;
  return !TRUSTED_SPENDERS.has(spenderAddress.toLowerCase());
}
function spenderTrustLevel(spenderAddress) {
  if (!spenderAddress || spenderAddress.length < 42) return "invalid";
  const normalized = spenderAddress.toLowerCase();
  return TRUSTED_SPENDERS.has(normalized) ? "trusted" : "unknown";
}

// src/signals/wallet-signals.ts
function hasUnlimitedApprovals(_walletAddress, _chainId) {
  return false;
}
function hasInteractedWithFlaggedContract(_walletAddress, _chainId) {
  return false;
}
function approvalExposureScore(_walletAddress, _chainId) {
  return { hasUnlimited: false, score: 0 };
}

// src/signals/download-signals.ts
var EXECUTABLE_EXTENSIONS = /* @__PURE__ */ new Set([
  "exe",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "pif",
  "sh",
  "bash",
  "app",
  "dmg",
  "pkg",
  "apk",
  "deb",
  "rpm",
  "jar",
  "ps1",
  "vbs",
  "wsf"
]);
function isExecutableFile(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXECUTABLE_EXTENSIONS.has(ext);
}
function hasValidSignature(_sha256) {
  return false;
}
function matchesKnownMalwareHash(_sha256) {
  return false;
}

// src/policies/transaction/codes.ts
var TRANSACTION_CODES = {};

// src/policies/wallet/codes.ts
var WALLET_CODES = {};

// src/policies/download/codes.ts
var DOWNLOAD_CODES = {};
export {
  APPROVE_SELECTOR,
  DOWNLOAD_CODES,
  DOWNLOAD_RULES,
  EVM_ZERO_ADDRESS,
  INCREASE_ALLOWANCE_SELECTOR,
  KNOWN_PROTOCOL_DOMAINS,
  KNOWN_SELECTORS,
  MAX_UINT256_HEX,
  PERMIT_SELECTORS,
  PHISHING_CODES,
  PHISHING_RULES,
  RULE_SET_VERSION,
  SET_APPROVAL_FOR_ALL_SELECTOR,
  SUSPICIOUS_TLDS,
  TRANSACTION_CODES,
  TRANSACTION_RULES,
  WALLET_CODES,
  WALLET_RULES,
  approvalExposureScore,
  assembleVerdict,
  buildNavigationContext,
  classifySelector,
  collectMatches,
  compareRules,
  containsAirdropKeyword,
  containsMintKeyword,
  containsWalletConnectPattern,
  contextToInput,
  deconfuseHostname,
  domainSimilarityScore,
  evaluate,
  extractHostname,
  extractRegistrableDomain,
  extractSelector,
  extractTld,
  getActiveEventKinds,
  getReasonMessage,
  getRulesForEventKind,
  getVerdictTitle,
  hasHomoglyphs,
  hasInteractedWithFlaggedContract,
  hasSuspiciousTld,
  hasUnlimitedApprovals,
  hasValidSignature,
  isApprovalMethod,
  isExecutableFile,
  isIpHost,
  isKnownMaliciousDomain,
  isNewDomain,
  isPermitSignature,
  isUnknownSpender,
  isUnlimitedApproval,
  isUnlimitedApprovalAmount,
  isValidEvmAddress,
  isValidSolAddress,
  isValidUrl,
  leadingZeroNibbles,
  levenshteinDistance,
  looksLikeProtocolImpersonation,
  matchedLureKeywords,
  matchesKnownMalwareHash,
  normalizeEvmAddress,
  normalizeSolAddress,
  normalizeUrl,
  parseApprovalAmount,
  riskBadgeLabel,
  sortRules,
  spenderTrustLevel,
  stringSimilarity
};
//# sourceMappingURL=index.js.map