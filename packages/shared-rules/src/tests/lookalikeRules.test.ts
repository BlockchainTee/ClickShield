import { describe, expect, it } from "vitest";
import {
  detectLookalikeBrand,
  detectLookalikeDomain,
  detectPhishingKeywords,
  levenshteinDistance,
} from "../utils/domainSimilarity";
import {
  PHISH_LOOKALIKE_BRAND_DOMAIN,
  PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD,
  evaluateLookalikeBrandDomain,
  evaluateLookalikeBrandWithPhishingKeyword,
} from "../policies/phishing/lookalikeRules";

describe("domainSimilarity", () => {
  it("computes deterministic Levenshtein distance", () => {
    expect(levenshteinDistance("metarnask", "metamask")).toBe(2);
    expect(levenshteinDistance("coinbasse", "coinbase")).toBe(1);
    expect(levenshteinDistance("ledger", "ledger")).toBe(0);
  });

  it("does not flag the safe brand domain", () => {
    const brandMatch = detectLookalikeBrand("metamask.io");
    const keywords = detectPhishingKeywords("metamask.io");
    const detection = detectLookalikeDomain("metamask.io");

    expect(brandMatch?.brand).toBe("metamask");
    expect(brandMatch?.matchedBy).toBe("EXACT_SUBSTRING");
    expect(keywords).toEqual([]);
    expect(detection.analysis.baseDomain).toBe("metamask");
  });

  it("flags a look-alike typo domain", () => {
    const brandMatch = detectLookalikeBrand("metarnask.io");

    expect(brandMatch).not.toBeNull();
    expect(brandMatch?.brand).toBe("metamask");
    expect(brandMatch?.matchedBy).toBe("LEVENSHTEIN");
    expect(brandMatch?.distance).toBeLessThanOrEqual(2);
  });

  it("flags look-alike or exact-brand domains that include phishing keywords", () => {
    expect(detectPhishingKeywords("metamask-airdrop.xyz")).toEqual(["airdrop"]);
    expect(detectPhishingKeywords("walletconnect-login.xyz")).toEqual(["login"]);
    expect(detectPhishingKeywords("coinbasse-support.net")).toEqual(["support"]);
  });
});

describe("lookalikeRules", () => {
  it("returns WARN=false for safe domain on the generic lookalike rule", () => {
    const warnResult = evaluateLookalikeBrandDomain({ domain: "metamask.io" });
    const blockResult = evaluateLookalikeBrandWithPhishingKeyword({
      domain: "metamask.io",
    });

    expect(warnResult).toEqual({
      ruleId: PHISH_LOOKALIKE_BRAND_DOMAIN,
      severity: "WARN",
      matched: true,
      evidence: expect.objectContaining({
        domain: "metamask.io",
        protectedBrand: "metamask",
        similarityMethod: "EXACT_SUBSTRING",
        phishingKeywords: [],
      }),
    });

    expect(blockResult).toEqual({
      ruleId: PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD,
      severity: "BLOCK",
      matched: false,
      evidence: expect.objectContaining({
        domain: "metamask.io",
        protectedBrand: "metamask",
        phishingKeywords: [],
      }),
    });
  });

  it("matches the WARN rule for a typo-only look-alike domain", () => {
    const result = evaluateLookalikeBrandDomain({ domain: "metarnask.io" });

    expect(result.ruleId).toBe(PHISH_LOOKALIKE_BRAND_DOMAIN);
    expect(result.severity).toBe("WARN");
    expect(result.matched).toBe(true);
    expect(result.evidence).toEqual(
      expect.objectContaining({
        domain: "metarnask.io",
        protectedBrand: "metamask",
        similarityMethod: "LEVENSHTEIN",
      }),
    );
  });

  it("matches the BLOCK rule for look-alike + phishing keyword", () => {
    const result = evaluateLookalikeBrandWithPhishingKeyword({
      domain: "metamask-airdrop.xyz",
    });

    expect(result.ruleId).toBe(PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD);
    expect(result.severity).toBe("BLOCK");
    expect(result.matched).toBe(true);
    expect(result.evidence).toEqual(
      expect.objectContaining({
        domain: "metamask-airdrop.xyz",
        protectedBrand: "metamask",
        similarityMethod: "EXACT_SUBSTRING",
        phishingKeywords: ["airdrop"],
      }),
    );
  });

  it("matches the BLOCK rule for coinbase typo with support keyword", () => {
    const result = evaluateLookalikeBrandWithPhishingKeyword({
      domain: "coinbasse-support.net",
    });

    expect(result.ruleId).toBe(PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD);
    expect(result.severity).toBe("BLOCK");
    expect(result.matched).toBe(true);
    expect(result.evidence).toEqual(
      expect.objectContaining({
        domain: "coinbasse-support.net",
        protectedBrand: "coinbase",
        phishingKeywords: ["support"],
      }),
    );
  });

  it("matches the BLOCK rule for walletconnect phishing", () => {
    const result = evaluateLookalikeBrandWithPhishingKeyword({
      domain: "walletconnect-login.xyz",
    });

    expect(result.ruleId).toBe(PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD);
    expect(result.severity).toBe("BLOCK");
    expect(result.matched).toBe(true);
    expect(result.evidence).toEqual(
      expect.objectContaining({
        domain: "walletconnect-login.xyz",
        protectedBrand: "walletconnect",
        phishingKeywords: ["login"],
      }),
    );
  });

  it("supports extracting the domain from url-like contexts", () => {
    const result = evaluateLookalikeBrandWithPhishingKeyword({
      request: {
        url: "https://ledger-secure-login.com/reset",
      },
    });

    expect(result.ruleId).toBe(PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD);
    expect(result.severity).toBe("BLOCK");
    expect(result.matched).toBe(true);
    expect(result.evidence).toEqual(
      expect.objectContaining({
        protectedBrand: "ledger",
        phishingKeywords: expect.arrayContaining(["secure", "login"]),
      }),
    );
  });
});
