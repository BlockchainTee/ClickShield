import { looksLikeProtocolImpersonation } from "../../signals/domain-signals.js";
import { detectLookalikeBrand } from "../../utils/domainSimilarity";
import {
  decodePunycode,
  detectPunycodeDomain,
  isHomographBrandAttack,
} from "../../utils/punycodeDetection";

export interface PunycodeRuleMatchInput {
  domain?: string | null;
  rawUrl?: string | null;
}

function extractDomainFromRawUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const withoutPath = withoutProtocol.split("/")[0] ?? "";
  const withoutAuth = withoutPath.includes("@")
    ? withoutPath.slice(withoutPath.lastIndexOf("@") + 1)
    : withoutPath;
  const withoutPort = withoutAuth.startsWith("[")
    ? withoutAuth.replace(/^\[|\]$/g, "")
    : (withoutAuth.split(":")[0] ?? "");

  return withoutPort.replace(/\.+$/, "");
}

function extractBrandFromTarget(target: string): string {
  return target.split(".")[0] ?? target;
}

function detectMatchedBrand(
  originalDomain: string,
  decodedDomain: string,
): string | null {
  const directMatch = isHomographBrandAttack(decodedDomain, originalDomain);
  if (directMatch) {
    return directMatch;
  }

  const lookalikeOriginal = detectLookalikeBrand(originalDomain);
  if (lookalikeOriginal) {
    return lookalikeOriginal.brand;
  }

  const lookalikeDecoded = detectLookalikeBrand(decodedDomain);
  if (lookalikeDecoded) {
    return lookalikeDecoded.brand;
  }

  const impersonationOriginal = looksLikeProtocolImpersonation(
    `https://${originalDomain}`,
  );
  if (impersonationOriginal) {
    return extractBrandFromTarget(impersonationOriginal.target);
  }

  const impersonationDecoded = looksLikeProtocolImpersonation(
    `https://${decodedDomain}`,
  );
  if (impersonationDecoded) {
    return extractBrandFromTarget(impersonationDecoded.target);
  }

  return null;
}

export const PHISH_PUNYCODE_HOMOGRAPH_BRAND = {
  id: "PHISH_PUNYCODE_HOMOGRAPH_BRAND",
  severity: "BLOCK" as const,
  description:
    "Detects punycode homograph phishing domains impersonating protected crypto brands.",
  match(input: PunycodeRuleMatchInput) {
    const fallbackDomain =
      typeof input.rawUrl === "string" ? extractDomainFromRawUrl(input.rawUrl) : "";
    const domainFromInput =
      typeof input.domain === "string" ? input.domain.trim().toLowerCase() : "";
    const originalDomain = domainFromInput || fallbackDomain;

    if (!originalDomain) {
      return null;
    }

    if (!detectPunycodeDomain(originalDomain)) {
      return null;
    }

    const decodedDomain = decodePunycode(originalDomain);
    const matchedBrand = detectMatchedBrand(originalDomain, decodedDomain);

    if (!matchedBrand) {
      return null;
    }

    return {
      ruleId: "PHISH_PUNYCODE_HOMOGRAPH_BRAND",
      severity: "BLOCK" as const,
      evidence: {
        originalDomain,
        decodedDomain,
        matchedBrand,
      },
    };
  },
};

export const punycodeRules = [PHISH_PUNYCODE_HOMOGRAPH_BRAND];

export function evaluatePunycodeHomographRule(domain: string) {
  return PHISH_PUNYCODE_HOMOGRAPH_BRAND.match({ domain });
}
