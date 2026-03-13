import {
  extractHostname,
  extractRegistrableDomain,
  extractTld,
  stringSimilarity,
} from "../normalize/domain.js";

/**
 * Known Web3 protocol domains that phishers commonly impersonate.
 */
export const KNOWN_PROTOCOL_DOMAINS: readonly string[] = [
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
  "coinbase.com",
];

/** TLDs commonly associated with phishing sites. */
export const SUSPICIOUS_TLDS: ReadonlySet<string> = new Set([
  "xyz", "site", "click", "top", "buzz",
  "tk", "ml", "ga", "cf", "gq",
]);

/** Keywords indicating crypto lure / mint pages. */
const MINT_KEYWORDS: readonly string[] = [
  "mint", "claim", "airdrop", "reward",
  "free-nft", "giveaway", "freemint",
];

/** Patterns indicating WalletConnect usage. */
const WALLET_CONNECT_PATTERNS: readonly string[] = [
  "walletconnect",
  "wc?uri=",
  "wc=",
  "wallet-connect",
  "connect-wallet",
];

/**
 * Unicode confusable character mappings for homoglyph detection.
 * Maps confusable codepoints to their ASCII lookalikes.
 */
const CONFUSABLE_MAP: ReadonlyMap<string, string> = new Map([
  // Cyrillic
  ["\u0430", "a"], // а → a
  ["\u0435", "e"], // е → e
  ["\u043E", "o"], // о → o
  ["\u0440", "p"], // р → p
  ["\u0441", "c"], // с → c
  ["\u0443", "y"], // у → y
  ["\u0445", "x"], // х → x
  ["\u043A", "k"], // к → k
  ["\u041C", "M"], // М → M
  ["\u0422", "T"], // Т → T
  ["\u041D", "H"], // Н → H
  ["\u0412", "B"], // В → B
  ["\u0410", "A"], // А → A
  ["\u0421", "C"], // С → C
  ["\u0415", "E"], // Е → E
  ["\u041E", "O"], // О → O
  // Greek
  ["\u03B1", "a"], // α → a
  ["\u03BF", "o"], // ο → o
  ["\u03B5", "e"], // ε → e
  ["\u03C1", "p"], // ρ → p
  // Latin look-alikes
  ["\u0131", "i"], // ı (dotless i) → i
  ["\u1D00", "A"], // ᴀ → A
  ["\u0250", "a"], // ɐ → a
  ["\u0261", "g"], // ɡ → g
]);

/**
 * Check if a domain was recently registered (considered "new" if under threshold).
 *
 * @param ageHours - Domain age in hours. Null if unknown.
 * @param thresholdHours - Maximum age to consider "new" (default: 72 hours).
 * @returns True if the domain is newer than the threshold.
 */
export function isNewDomain(
  ageHours: number | null,
  thresholdHours: number = 72
): boolean {
  if (ageHours === null) return false;
  return ageHours >= 0 && ageHours < thresholdHours;
}

/**
 * Detect if a URL's domain looks like it is impersonating a known protocol.
 * Returns the best-match protocol domain and similarity score.
 *
 * Only flags when similarity is >= 0.8 but NOT an exact match
 * (exact matches are legitimate).
 *
 * @param rawUrl - The URL to check.
 * @returns Match info with target and similarityScore, or null.
 */
export function looksLikeProtocolImpersonation(
  rawUrl: string
): { target: string; similarityScore: number } | null {
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

  if (bestScore >= 0.80 && bestTarget) {
    return { target: bestTarget, similarityScore: bestScore };
  }

  return null;
}

/**
 * Check if a URL contains mint/claim/airdrop/reward keywords.
 *
 * @param rawUrl - The URL to check.
 * @returns True if any mint-related keyword is found.
 */
export function containsMintKeyword(rawUrl: string): boolean {
  const lower = rawUrl.toLowerCase();
  return MINT_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Check if a URL contains airdrop-related keywords.
 *
 * @param rawUrl - The URL to check.
 * @returns True if any airdrop-related keyword is found.
 */
export function containsAirdropKeyword(rawUrl: string): boolean {
  const lower = rawUrl.toLowerCase();
  return lower.includes("airdrop");
}

/**
 * Check if a domain is flagged in a known-malicious feed.
 * This is a pass-through signal; the actual lookup is done externally.
 *
 * @param isKnownMalicious - Whether the domain is flagged in the feed.
 * @returns The same boolean value.
 */
export function isKnownMaliciousDomain(isKnownMalicious: boolean): boolean {
  return isKnownMalicious;
}

/**
 * Compute the best similarity score between a URL's domain
 * and known protocol domains.
 *
 * @param rawUrl - The URL to check.
 * @returns The highest similarity score (0 to 1), or 0 on failure.
 */
export function domainSimilarityScore(rawUrl: string): number {
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

/**
 * Check if a domain has a TLD commonly associated with phishing.
 *
 * @param rawUrl - The URL to check.
 * @returns True if the TLD is in the suspicious set.
 */
export function hasSuspiciousTld(rawUrl: string): boolean {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return false;
  const tld = extractTld(hostname);
  return SUSPICIOUS_TLDS.has(tld);
}

/**
 * Get the matched lure keywords from a URL.
 *
 * @param rawUrl - The URL to check.
 * @returns Array of matched keyword strings.
 */
export function matchedLureKeywords(rawUrl: string): string[] {
  const lower = rawUrl.toLowerCase();
  return MINT_KEYWORDS.filter((kw) => lower.includes(kw));
}

/**
 * Check if a hostname is a raw IP address.
 * Excludes localhost and 127.0.0.1.
 *
 * @param rawUrl - The URL to check.
 * @returns True if hostname is a non-localhost IP address.
 */
export function isIpHost(rawUrl: string): boolean {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return false;

  // Exclude localhost
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;

  // IPv4 pattern
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

  // IPv6 pattern (bracketed in URLs, extracted without brackets)
  if (hostname.startsWith("[") || hostname.includes(":")) return true;

  return false;
}

/**
 * Check if a URL contains WalletConnect-related patterns.
 *
 * @param rawUrl - The URL to check.
 * @returns True if any wallet-connect pattern is found.
 */
export function containsWalletConnectPattern(rawUrl: string): boolean {
  const lower = rawUrl.toLowerCase();
  return WALLET_CONNECT_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Detect homoglyph/confusable characters in a hostname.
 * Returns true if any characters in the hostname map to
 * ASCII lookalikes via the confusable character table.
 *
 * @param rawUrl - The URL to check.
 * @returns True if confusable characters are detected.
 */
export function hasHomoglyphs(rawUrl: string): boolean {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return false;

  for (const char of hostname) {
    if (CONFUSABLE_MAP.has(char)) return true;
  }

  return false;
}

/**
 * Deconfuse a hostname by replacing confusable characters
 * with their ASCII equivalents. Used to find the intended
 * target domain of a homoglyph attack.
 *
 * @param hostname - The hostname to deconfuse.
 * @returns The deconfused hostname with ASCII substitutions.
 */
export function deconfuseHostname(hostname: string): string {
  let result = "";
  for (const char of hostname) {
    const replacement = CONFUSABLE_MAP.get(char);
    result += replacement ?? char;
  }
  return result;
}
