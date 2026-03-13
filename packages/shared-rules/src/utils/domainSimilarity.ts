export const PROTECTED_CRYPTO_BRANDS = [
  "metamask",
  "walletconnect",
  "coinbase",
  "uniswap",
  "opensea",
  "ledger",
  "phantom",
] as const;

export type ProtectedCryptoBrand = (typeof PROTECTED_CRYPTO_BRANDS)[number];

export const PHISHING_KEYWORDS = [
  "login",
  "verify",
  "secure",
  "wallet",
  "connect",
  "airdrop",
  "support",
] as const;

export type PhishingKeyword = (typeof PHISHING_KEYWORDS)[number];

export interface DomainAnalysis {
  originalDomain: string;
  normalizedDomain: string;
  registrableDomain: string;
  baseDomain: string;
  labels: string[];
}

export interface LookalikeBrandMatch {
  brand: ProtectedCryptoBrand;
  target: string;
  distance: number;
  matchedBy: "LEVENSHTEIN" | "EXACT_SUBSTRING";
}

export interface LookalikeDetection {
  analysis: DomainAnalysis;
  brandMatch: LookalikeBrandMatch | null;
  phishingKeywordMatches: string[];
}

const MULTI_PART_PUBLIC_SUFFIXES = new Set<string>([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "com.br",
  "com.mx",
  "co.jp",
  "co.kr",
  "co.in",
  "com.sg",
]);

const DOMAIN_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const ALLOWED_DOMAIN_CHARS_RE = /[^a-z0-9.-]/g;
const HYPHEN_SPLIT_RE = /[-_.]+/g;

/**
 * Normalize raw input into a lowercase hostname-like string.
 * This function is deterministic and intentionally conservative.
 */
export function normalizeDomain(input: string): string {
  const trimmed = (input ?? "").trim().toLowerCase();

  if (!trimmed) {
    return "";
  }

  const withoutProtocol = trimmed.replace(DOMAIN_PROTOCOL_RE, "");
  const withoutPath = withoutProtocol.split("/")[0];
  const withoutAuth = withoutPath.includes("@")
    ? withoutPath.slice(withoutPath.lastIndexOf("@") + 1)
    : withoutPath;
  const withoutPort = withoutAuth.split(":")[0];
  const cleaned = withoutPort.replace(ALLOWED_DOMAIN_CHARS_RE, "");

  return cleaned.replace(/^\.+|\.+$/g, "");
}

/**
 * Extract the registrable domain from a normalized hostname.
 * For common multi-part public suffixes, the registrable domain is last 3 labels.
 * Otherwise it is the last 2 labels.
 */
export function getRegistrableDomain(normalizedDomain: string): string {
  if (!normalizedDomain) {
    return "";
  }

  if (IPV4_RE.test(normalizedDomain)) {
    return normalizedDomain;
  }

  const labels = normalizedDomain.split(".").filter(Boolean);

  if (labels.length <= 2) {
    return labels.join(".");
  }

  const lastTwo = labels.slice(-2).join(".");
  const lastThree = labels.slice(-3).join(".");

  if (MULTI_PART_PUBLIC_SUFFIXES.has(lastTwo)) {
    return lastThree;
  }

  return labels.slice(-2).join(".");
}

/**
 * Extract the base domain label from a registrable domain.
 * Example:
 *   metamask.io -> metamask
 *   secure-ledger-login.com -> secure-ledger-login
 */
export function getBaseDomain(registrableDomain: string): string {
  if (!registrableDomain) {
    return "";
  }

  if (IPV4_RE.test(registrableDomain)) {
    return registrableDomain;
  }

  const firstDotIndex = registrableDomain.indexOf(".");
  return firstDotIndex === -1
    ? registrableDomain
    : registrableDomain.slice(0, firstDotIndex);
}

export function analyzeDomain(input: string): DomainAnalysis {
  const normalizedDomain = normalizeDomain(input);
  const registrableDomain = getRegistrableDomain(normalizedDomain);
  const baseDomain = getBaseDomain(registrableDomain);

  return {
    originalDomain: input,
    normalizedDomain,
    registrableDomain,
    baseDomain,
    labels: baseDomain ? baseDomain.split(HYPHEN_SPLIT_RE).filter(Boolean) : [],
  };
}

/**
 * Deterministic Levenshtein implementation.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function findExactBrandSubstring(
  analysis: DomainAnalysis,
): LookalikeBrandMatch | null {
  for (const brand of PROTECTED_CRYPTO_BRANDS) {
    if (analysis.baseDomain.includes(brand)) {
      return {
        brand,
        target: analysis.baseDomain,
        distance: 0,
        matchedBy: "EXACT_SUBSTRING",
      };
    }
  }

  return null;
}

function findLevenshteinLookalike(
  analysis: DomainAnalysis,
): LookalikeBrandMatch | null {
  let bestMatch: LookalikeBrandMatch | null = null;

  const candidates = new Set<string>([analysis.baseDomain, ...analysis.labels]);

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    for (const brand of PROTECTED_CRYPTO_BRANDS) {
      const distance = levenshteinDistance(candidate, brand);

      if (distance <= 2) {
        if (
          !bestMatch ||
          distance < bestMatch.distance ||
          (distance === bestMatch.distance && brand.length > bestMatch.brand.length)
        ) {
          bestMatch = {
            brand,
            target: candidate,
            distance,
            matchedBy: "LEVENSHTEIN",
          };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Determine whether a domain is visually similar to a protected brand
 * by exact brand substring or Levenshtein distance <= 2.
 */
export function detectLookalikeBrand(input: string): LookalikeBrandMatch | null {
  const analysis = analyzeDomain(input);

  if (!analysis.baseDomain) {
    return null;
  }

  const exactSubstringMatch = findExactBrandSubstring(analysis);
  if (exactSubstringMatch) {
    return exactSubstringMatch;
  }

  return findLevenshteinLookalike(analysis);
}

/**
 * Detect phishing keywords anywhere in the base domain label.
 * Example:
 *   metamask-airdrop -> ["airdrop"]
 *   walletconnect-login -> ["login"]
 */
export function detectPhishingKeywords(input: string): string[] {
  const analysis = analyzeDomain(input);
  const hits: string[] = [];

  if (!analysis.baseDomain) {
    return hits;
  }

  let keywordSource = analysis.baseDomain;
  for (const brand of PROTECTED_CRYPTO_BRANDS) {
    keywordSource = keywordSource.split(brand).join("");
  }

  for (const keyword of PHISHING_KEYWORDS) {
    if (keywordSource.includes(keyword)) {
      hits.push(keyword);
    }
  }

  return hits;
}

export function detectLookalikeDomain(input: string): LookalikeDetection {
  const analysis = analyzeDomain(input);
  const brandMatch = detectLookalikeBrand(input);
  const phishingKeywordMatches = detectPhishingKeywords(input);

  return {
    analysis,
    brandMatch,
    phishingKeywordMatches,
  };
}
