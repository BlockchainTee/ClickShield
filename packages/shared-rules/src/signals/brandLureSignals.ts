import { toUnicode } from "punycode/";
import type { NavigationInput } from "../engine/types.js";

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

const LURE_KEYWORDS: readonly string[] = [
  "login",
  "verify",
  "secure",
  "auth",
  "wallet",
  "connect",
  "claim",
  "airdrop",
  "recovery",
  "support",
  "update",
];

export interface BrandLureSignals {
  hostname: string;
  normalized: string;
  tokens: readonly string[];
  matchedBrand: string | null;
  matchedLure: string | null;
  hasBrandLure: boolean;
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}

function extractHostname(input: NavigationInput): string {
  try {
    const parsed = new URL(input.rawUrl);
    return toUnicode(parsed.hostname);
  } catch {
    return "";
  }
}

export function getBrandLureSignals(input: NavigationInput): BrandLureSignals {
  const hostname = extractHostname(input);
  const normalized = normalizeHostname(hostname);
  const tokens = normalized.split(/[.\-]/).filter(Boolean);

  let matchedBrand: string | null = null;
  for (const brand of TARGET_BRANDS) {
    if (tokens.includes(brand)) {
      matchedBrand = brand;
      break;
    }
  }

  let matchedLure: string | null = null;
  for (const lure of LURE_KEYWORDS) {
    if (tokens.includes(lure)) {
      matchedLure = lure;
      break;
    }
  }

  return {
    hostname,
    normalized,
    tokens,
    matchedBrand,
    matchedLure,
    hasBrandLure: matchedBrand !== null && matchedLure !== null,
  };
}
