/**
 * Known multi-part TLDs. A small list covering common cases
 * without requiring a full Public Suffix List library.
 */
const MULTI_PART_TLDS: ReadonlySet<string> = new Set([
  "co.uk", "co.jp", "co.kr", "co.nz", "co.za", "co.in",
  "com.au", "com.br", "com.cn", "com.mx", "com.sg", "com.tw",
  "org.uk", "org.au", "net.au", "gov.uk", "ac.uk",
  "ne.jp", "or.jp",
]);

/**
 * Extract the hostname from a URL string.
 *
 * @param rawUrl - A URL or hostname string.
 * @returns The lowercase hostname, or empty string on failure.
 */
export function extractHostname(rawUrl: string): string {
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

/**
 * Extract the registrable domain (eTLD+1) from a hostname.
 *
 * @example
 * extractRegistrableDomain("app.uniswap.org") // => "uniswap.org"
 * extractRegistrableDomain("foo.bar.co.uk")   // => "bar.co.uk"
 * extractRegistrableDomain("localhost")        // => "localhost"
 *
 * @param hostname - A hostname string (no protocol).
 * @returns The registrable domain.
 */
export function extractRegistrableDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length <= 2) return hostname.toLowerCase();

  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return parts.length >= 3
      ? parts.slice(-3).join(".")
      : hostname.toLowerCase();
  }

  return parts.slice(-2).join(".");
}

/**
 * Extract the TLD from a hostname.
 * Returns multi-part TLDs where applicable (e.g., "co.uk").
 *
 * @param hostname - A hostname string (no protocol).
 * @returns The TLD string, or empty string for single-label hosts.
 */
export function extractTld(hostname: string): string {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length < 2) return "";

  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return lastTwo;
  }

  return parts[parts.length - 1];
}

/**
 * Compute Levenshtein edit distance between two strings.
 * Pure, synchronous, O(n*m) time, O(min(n,m)) space.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns The edit distance (number of insertions, deletions, substitutions).
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const aLen = a.length;
  const bLen = b.length;

  let prev = new Array<number>(aLen + 1);
  let curr = new Array<number>(aLen + 1);

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

/**
 * Compute string similarity as a ratio from 0 to 1.
 * 1 means identical, 0 means completely different.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns Similarity ratio between 0 and 1.
 */
export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}
