import { normalizeDomainLookupTarget } from "./normalize.js";
import type {
  CompiledDomainIntelSnapshot,
  DomainLookupResult,
} from "./types.js";

function isUsableMaliciousState(state: string): boolean {
  return state === "fresh" || state === "stale";
}

function isUsableAllowlistState(state: string): boolean {
  return state === "fresh";
}

export function resolveDomainIntel(
  snapshot: CompiledDomainIntelSnapshot,
  input: string
): DomainLookupResult {
  const domainSection = snapshot.sections.maliciousDomains;
  const allowlistSection = snapshot.sections.allowlists;
  const maliciousUsable = isUsableMaliciousState(domainSection.state);
  const allowlistUsable = isUsableAllowlistState(allowlistSection.state);
  const degradedProtection = !maliciousUsable || !allowlistUsable;

  if (!maliciousUsable) {
    return {
      lookupFamily: "domain",
      matched: false,
      disposition: "unavailable",
      sectionState: domainSection.state,
      degradedProtection,
    };
  }

  const target = normalizeDomainLookupTarget(input);
  if (!target) {
    return {
      lookupFamily: "domain",
      matched: false,
      disposition: "no_match",
      sectionState: domainSection.state,
      degradedProtection,
      allowlistFeedVersion: allowlistUsable
        ? allowlistSection.feedVersion
        : undefined,
    };
  }

  const maliciousExact = domainSection.exactHostIndex.get(target.hostname);
  const maliciousRegistrable = domainSection.registrableDomainIndex.get(
    target.registrableDomain
  );
  const allowlistExact = allowlistUsable
    ? allowlistSection.exactHostIndex.get(target.hostname)
    : undefined;
  const allowlistRegistrable = allowlistUsable
    ? allowlistSection.registrableDomainIndex.get(target.registrableDomain)
    : undefined;
  const allowlistFeedVersion = allowlistUsable
    ? allowlistSection.feedVersion
    : undefined;

  if (maliciousExact) {
    return {
      lookupFamily: "domain",
      matched: true,
      disposition: "malicious",
      matchType: maliciousExact.type,
      matchedSection: "maliciousDomains",
      matchedItemId: maliciousExact.id,
      identity: maliciousExact.identity,
      feedVersion: domainSection.feedVersion,
      allowlistFeedVersion,
      sectionState: domainSection.state,
      degradedProtection,
    };
  }

  if (allowlistExact && maliciousRegistrable) {
    return {
      lookupFamily: "domain",
      matched: true,
      disposition: "allowlisted",
      matchType: allowlistExact.type,
      matchedSection: "allowlists",
      matchedItemId: allowlistExact.id,
      identity: allowlistExact.identity,
      feedVersion: allowlistSection.feedVersion,
      allowlistFeedVersion,
      sectionState: domainSection.state,
      degradedProtection,
    };
  }

  if (maliciousRegistrable) {
    return {
      lookupFamily: "domain",
      matched: true,
      disposition: "malicious",
      matchType: maliciousRegistrable.type,
      matchedSection: "maliciousDomains",
      matchedItemId: maliciousRegistrable.id,
      identity: maliciousRegistrable.identity,
      feedVersion: domainSection.feedVersion,
      allowlistFeedVersion,
      sectionState: domainSection.state,
      degradedProtection,
    };
  }

  if (allowlistExact) {
    return {
      lookupFamily: "domain",
      matched: true,
      disposition: "allowlisted",
      matchType: allowlistExact.type,
      matchedSection: "allowlists",
      matchedItemId: allowlistExact.id,
      identity: allowlistExact.identity,
      feedVersion: allowlistSection.feedVersion,
      allowlistFeedVersion,
      sectionState: domainSection.state,
      degradedProtection,
    };
  }

  if (allowlistRegistrable) {
    return {
      lookupFamily: "domain",
      matched: true,
      disposition: "allowlisted",
      matchType: allowlistRegistrable.type,
      matchedSection: "allowlists",
      matchedItemId: allowlistRegistrable.id,
      identity: allowlistRegistrable.identity,
      feedVersion: allowlistSection.feedVersion,
      allowlistFeedVersion,
      sectionState: domainSection.state,
      degradedProtection,
    };
  }

  return {
    lookupFamily: "domain",
    matched: false,
    disposition: "no_match",
    sectionState: domainSection.state,
    degradedProtection,
    allowlistFeedVersion,
  };
}
