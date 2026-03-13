import {
  decodePunycode,
  detectPunycodeDomain,
  isHomographBrandAttack,
} from "../../utils/punycodeDetection";

export const PHISH_PUNYCODE_HOMOGRAPH_BRAND = {
  id: "PHISH_PUNYCODE_HOMOGRAPH_BRAND",
  severity: "BLOCK" as const,
  description:
    "Detects punycode homograph phishing domains impersonating protected crypto brands.",
  match(input: { domain?: string | null }) {
    const originalDomain = (input.domain ?? "").trim().toLowerCase();

    if (!originalDomain) {
      return null;
    }

    if (!detectPunycodeDomain(originalDomain)) {
      return null;
    }

    const decodedDomain = decodePunycode(originalDomain);
    const matchedBrand = isHomographBrandAttack(decodedDomain, originalDomain);

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
