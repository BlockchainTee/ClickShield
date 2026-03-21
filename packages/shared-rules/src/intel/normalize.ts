import punycode from "punycode/";
import { getDomain } from "tldts";

import { extractHostname } from "../normalize/domain.js";

function stripTrailingDots(value: string): string {
  return value.replace(/\.+$/, "");
}

function hasHostSeparators(value: string): boolean {
  return value.includes("://") || value.includes("/") || value.includes("?") || value.includes("#");
}

function normalizeCandidate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const extractedHostname = extractHostname(trimmed);
  const candidate = extractedHostname || (hasHostSeparators(trimmed) ? "" : trimmed);
  if (!candidate) {
    return "";
  }

  const normalized = stripTrailingDots(candidate.toLowerCase());
  if (!normalized) {
    return "";
  }

  try {
    return punycode.toASCII(normalized).toLowerCase();
  } catch {
    return "";
  }
}

function isValidDomainLabel(label: string): boolean {
  if (!label) {
    return false;
  }

  if (label.length > 63) {
    return false;
  }

  if (label.startsWith("-") || label.endsWith("-")) {
    return false;
  }

  return /^[a-z0-9-]+$/.test(label);
}

function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) {
    return false;
  }

  const labels = hostname.split(".");
  return labels.every(isValidDomainLabel);
}

export function normalizeIntelDomain(value: string): string | null {
  const normalized = normalizeCandidate(value);
  if (!isValidHostname(normalized)) {
    return null;
  }

  return normalized;
}

export function toRegistrableIntelDomain(value: string): string | null {
  const normalized = normalizeIntelDomain(value);
  if (!normalized) {
    return null;
  }

  return (
    getDomain(normalized, {
      allowPrivateDomains: false,
      extractHostname: false,
    }) ?? null
  );
}

export function buildMaliciousDomainIdentity(
  scope: "exact_host" | "registrable_domain",
  domain: string
): string {
  return `${scope}:${domain}`;
}

export function buildDomainAllowlistIdentity(
  scope: "exact_host" | "registrable_domain",
  domain: string
): string {
  const prefix =
    scope === "exact_host"
      ? "domain_exact_host"
      : "domain_registrable_domain";

  return `${prefix}:${domain}`;
}

export function normalizeDomainLookupTarget(
  value: string
): { readonly hostname: string; readonly registrableDomain: string } | null {
  const hostname = normalizeIntelDomain(value);
  if (!hostname) {
    return null;
  }

  return {
    hostname,
    registrableDomain:
      getDomain(hostname, {
        allowPrivateDomains: false,
        extractHostname: false,
      }) ?? hostname,
  };
}
