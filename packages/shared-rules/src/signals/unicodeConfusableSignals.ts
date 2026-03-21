import punycode from "punycode/";
import type { NavigationInput } from "../engine/types.js";

export interface UnicodeConfusableSignals {
  hostname: string;
  asciiSkeleton: string;
  normalizedHostname: string;
  hasConfusable: boolean;
  hasMixedScript: boolean;
  matchedBrands: readonly string[];
}

const CONFUSABLE_MAP: ReadonlyMap<string, string> = new Map([
  ["\u0430", "a"],
  ["\u0435", "e"],
  ["\u043E", "o"],
  ["\u0440", "p"],
  ["\u0441", "c"],
  ["\u0443", "y"],
  ["\u0445", "x"],
  ["\u043A", "k"],
  ["\u041C", "M"],
  ["\u0422", "T"],
  ["\u041D", "H"],
  ["\u0412", "B"],
  ["\u0410", "A"],
  ["\u0421", "C"],
  ["\u0415", "E"],
  ["\u041E", "O"],
  ["\u0456", "i"],
  ["\u0458", "j"],
  ["\u04CF", "l"],
  ["\u03B1", "a"],
  ["\u03BF", "o"],
  ["\u03B5", "e"],
  ["\u03C1", "p"],
  ["\u03C4", "t"],
  ["\u03C5", "u"],
  ["\u03C7", "x"],
  ["\u0131", "i"],
  ["\u1D00", "A"],
  ["\u0250", "a"],
  ["\u0261", "g"],
  ["\u00DF", "ss"],
  ["\u0153", "oe"],
]);

const TARGET_BRANDS: readonly string[] = [
  "uniswap",
  "opensea",
  "metamask",
  "coinbase",
  "binance",
  "blur",
  "aave",
  "lido",
  "trustwallet",
  "phantom",
  "rainbow",
];

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}

function buildSkeleton(hostname: string): string {
  let result = "";
  for (const ch of hostname.normalize("NFKC")) {
    result += CONFUSABLE_MAP.get(ch) ?? ch;
  }
  return result.toLowerCase();
}

function isLatinChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (
    (code >= 0x0041 && code <= 0x007a) ||
    (code >= 0x00c0 && code <= 0x024f)
  );
}

function hasMixedScript(hostname: string): boolean {
  let hasLatin = false;
  let hasNonLatin = false;

  for (const ch of hostname) {
    if (!/[A-Za-z\u00C0-\u024F\u0080-\uFFFF]/.test(ch)) {
      continue;
    }

    if (isLatinChar(ch)) {
      hasLatin = true;
    } else if (ch.charCodeAt(0) > 127) {
      hasNonLatin = true;
    }

    if (hasLatin && hasNonLatin) {
      return true;
    }
  }

  return false;
}

function extractMatchedBrands(skeletonHostname: string): readonly string[] {
  return TARGET_BRANDS.filter((brand) => skeletonHostname.includes(brand));
}

function extractUnicodeHostname(input: NavigationInput): string {
  let hostname = "";

  try {
    const parsed = new URL(input.rawUrl);
    hostname = punycode.toUnicode(parsed.hostname);
  } catch {
    return "";
  }

  return normalizeHostname(hostname);
}

export function getUnicodeConfusableSignals(
  input: NavigationInput
): UnicodeConfusableSignals {
  const hostname = extractUnicodeHostname(input);
  const normalizedHostname = hostname.toLowerCase();
  const asciiSkeleton = buildSkeleton(hostname);
  const hasConfusable = asciiSkeleton !== normalizedHostname;
  const matchedBrands = extractMatchedBrands(asciiSkeleton);

  return {
    hostname,
    asciiSkeleton,
    normalizedHostname,
    hasConfusable,
    hasMixedScript: hasMixedScript(normalizedHostname),
    matchedBrands,
  };
}
