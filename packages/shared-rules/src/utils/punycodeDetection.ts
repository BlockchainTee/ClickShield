import punycode from "punycode/";

export const PROTECTED_CRYPTO_BRANDS = [
  "metamask",
  "walletconnect",
  "coinbase",
  "uniswap",
  "opensea",
  "ledger",
  "phantom",
] as const;

type ProtectedBrand = (typeof PROTECTED_CRYPTO_BRANDS)[number];

const CONFUSABLE_TO_ASCII: Record<string, string> = {
  // Cyrillic
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  і: "i",
  ї: "i",
  ј: "j",
  ҡ: "k",
  һ: "h",
  ѵ: "v",
  ѡ: "w",
  ѳ: "o",
  ѕ: "s",
  ӏ: "l",

  // Greek
  α: "a",
  β: "b",
  γ: "y",
  δ: "d",
  ε: "e",
  η: "n",
  ι: "i",
  κ: "k",
  ο: "o",
  ρ: "p",
  τ: "t",
  υ: "u",
  χ: "x",
  ω: "w",

  // Latin extended / IPA / compatibility
  æ: "ae",
  œ: "oe",
  ß: "ss",
  þ: "p",
  ð: "d",
  ł: "l",
  ɫ: "l",
  ɩ: "i",
  ɪ: "i",
  ʟ: "l",
  ø: "o",

  // Fullwidth ASCII
  ａ: "a",
  ｂ: "b",
  ｃ: "c",
  ｄ: "d",
  ｅ: "e",
  ｆ: "f",
  ｇ: "g",
  ｈ: "h",
  ｉ: "i",
  ｊ: "j",
  ｋ: "k",
  ｌ: "l",
  ｍ: "m",
  ｎ: "n",
  ｏ: "o",
  ｐ: "p",
  ｑ: "q",
  ｒ: "r",
  ｓ: "s",
  ｔ: "t",
  ｕ: "u",
  ｖ: "v",
  ｗ: "w",
  ｘ: "x",
  ｙ: "y",
  ｚ: "z",
};

function stripTrailingDot(domain: string): string {
  return domain.trim().replace(/\.+$/, "");
}

function extractAsciiPayloadFromPunycodeLabel(label: string): string {
  return label.toLowerCase().startsWith("xn--") ? label.slice(4) : label;
}

function normalizeForBrandComparison(value: string): string {
  const lower = value.toLowerCase().normalize("NFKC");
  let output = "";

  for (const char of lower) {
    output += CONFUSABLE_TO_ASCII[char] ?? char;
  }

  return output.replace(/[^a-z0-9.-]+/g, "");
}

function tokenizeCandidate(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function matchesProtectedBrand(candidate: string, brand: ProtectedBrand): boolean {
  if (!candidate) {
    return false;
  }

  if (candidate === brand) {
    return true;
  }

  if (candidate.includes(brand)) {
    return true;
  }

  if (
    candidate.length >= brand.length - 1 &&
    levenshteinDistance(candidate, brand) <= 1
  ) {
    return true;
  }

  return false;
}

export function detectPunycodeDomain(domain: string): boolean {
  const normalized = stripTrailingDot(domain).toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized.split(".").some((label) => label.startsWith("xn--"));
}

export function decodePunycode(domain: string): string {
  try {
    return punycode.toUnicode(stripTrailingDot(domain).toLowerCase());
  } catch {
    return stripTrailingDot(domain).toLowerCase();
  }
}

export function isHomographBrandAttack(
  decodedDomain: string,
  originalDomain?: string,
): ProtectedBrand | null {
  const normalizedDecoded = normalizeForBrandComparison(decodedDomain);
  const decodedLabels = normalizedDecoded.split(".");
  const decodedCandidates = new Set<string>([
    normalizedDecoded,
    ...decodedLabels,
    ...tokenizeCandidate(normalizedDecoded),
  ]);

  if (originalDomain) {
    const normalizedOriginal = stripTrailingDot(originalDomain).toLowerCase();
    for (const label of normalizedOriginal.split(".")) {
      const asciiPayload = normalizeForBrandComparison(
        extractAsciiPayloadFromPunycodeLabel(label),
      );
      if (!asciiPayload) {
        continue;
      }

      decodedCandidates.add(asciiPayload);

      for (const token of tokenizeCandidate(asciiPayload)) {
        decodedCandidates.add(token);
      }
    }
  }

  for (const brand of PROTECTED_CRYPTO_BRANDS) {
    for (const candidate of decodedCandidates) {
      if (matchesProtectedBrand(candidate, brand)) {
        return brand;
      }
    }
  }

  return null;
}
