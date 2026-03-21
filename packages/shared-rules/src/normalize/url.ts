/**
 * Tracking parameters commonly appended to URLs for analytics.
 */
const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

/**
 * Normalize a URL for consistent comparison.
 *
 * Steps:
 * 1. Parse with the URL API (prepend https:// if no protocol).
 * 2. Lowercase the hostname.
 * 3. Strip fragment (#...).
 * 4. Remove known tracking query parameters.
 * 5. Sort remaining query parameters alphabetically.
 * 6. Remove trailing slash from pathname (except root "/").
 *
 * @param rawUrl - The raw URL string to normalize.
 * @returns The normalized URL string, or the original lowercased if parsing fails.
 */
export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  let urlStr = trimmed;
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = "https://" + urlStr;
  }

  try {
    const parsed = new URL(urlStr);

    // Strip tracking params
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // Sort remaining params
    parsed.searchParams.sort();

    // Strip fragment
    parsed.hash = "";

    // Remove trailing slash (but keep root "/")
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

/**
 * Validate that a string is a well-formed URL.
 *
 * @param rawUrl - The URL string to validate.
 * @returns True if the URL can be parsed by the URL API.
 */
export function isValidUrl(rawUrl: string): boolean {
  try {
    new URL(rawUrl);
    return true;
  } catch {
    return false;
  }
}
