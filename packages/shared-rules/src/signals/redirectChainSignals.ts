import type { NavigationInput } from "../engine/types.js";

/**
 * Represents a normalized redirect hop.
 */
export interface RedirectHop {
  url: string;
  hostname: string;
}

/**
 * Output of redirect chain signal extraction.
 */
export interface RedirectChainSignals {
  chain: RedirectHop[];
  length: number;
  hasRedirects: boolean;
  hasIpHost: boolean;
  isLongChain: boolean;
  hasInvalidUrl: boolean;
  hasSuspiciousProtocol: boolean;
}

const MAX_CHAIN_LENGTH = 4;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

interface RedirectChainInput extends NavigationInput {
  readonly redirectChain?: readonly string[];
  readonly url?: string;
}

function readRedirectChain(input: NavigationInput): readonly string[] | null {
  const value = (input as RedirectChainInput).redirectChain;
  return isStringArray(value) ? value : null;
}

function readUrl(input: NavigationInput): string | null {
  const value = (input as RedirectChainInput).url;
  return typeof value === "string" ? value : null;
}

function resolveRawChain(input: NavigationInput): readonly string[] {
  const redirectChain = readRedirectChain(input);
  if (redirectChain !== null) {
    return redirectChain;
  }

  const url = readUrl(input);
  if (url !== null) {
    return [url];
  }

  return [input.rawUrl];
}

/**
 * Determines if a hostname is an IPv4 address.
 */
function isIpAddress(hostname: string): boolean {
  const parts = hostname.split(".");

  if (parts.length !== 4) {
    return false;
  }

  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return false;
    }

    const value = Number(part);

    if (!Number.isInteger(value) || value < 0 || value > 255) {
      return false;
    }
  }

  return true;
}

/**
 * Safely parses a URL string.
 */
function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Extracts redirect chain signals from NavigationInput.
 *
 * Deterministic and side-effect free.
 */
export function getRedirectChainSignals(
  input: NavigationInput
): RedirectChainSignals {
  const rawChain = resolveRawChain(input);

  const chain: RedirectHop[] = [];
  let hasInvalidUrl = false;
  let hasIpHost = false;
  let hasSuspiciousProtocol = false;

  for (const raw of rawChain) {
    const parsed = safeParseUrl(raw);

    if (parsed === null) {
      hasInvalidUrl = true;
      chain.push({
        url: raw,
        hostname: "__INVALID__",
      });
      continue;
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      hasSuspiciousProtocol = true;
    }

    if (isIpAddress(parsed.hostname)) {
      hasIpHost = true;
    }

    chain.push({
      url: parsed.href,
      hostname: parsed.hostname,
    });
  }

  const length = chain.length;

  return {
    chain,
    length,
    hasRedirects: length > 1,
    hasIpHost,
    isLongChain: length >= MAX_CHAIN_LENGTH,
    hasInvalidUrl,
    hasSuspiciousProtocol,
  };
}
