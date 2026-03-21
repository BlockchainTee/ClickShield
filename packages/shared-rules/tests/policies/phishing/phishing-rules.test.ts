import { describe, it, expect } from "vitest";
import { evaluate } from "../../../src/engine/evaluate.js";
import type { NavigationInput } from "../../../src/engine/types.js";

// ── Helpers ──

function navInput(
  rawUrl: string,
  opts: {
    ageHours?: number | null;
    isKnownMalicious?: boolean;
    containsWalletConnectPattern?: boolean;
    hasHomoglyphs?: boolean;
    redirectCount?: number;
    finalDomain?: string;
  } = {}
): NavigationInput {
  return {
    eventKind: "navigation",
    rawUrl,
    domainContext: {
      ageHours: opts.ageHours ?? null,
      isKnownMalicious: opts.isKnownMalicious ?? false,
    },
    containsWalletConnectPattern: opts.containsWalletConnectPattern,
    hasHomoglyphs: opts.hasHomoglyphs,
    redirectCount: opts.redirectCount,
    finalDomain: opts.finalDomain,
  };
}

// ── Individual Rule Tests ──

describe("PHISH_KNOWN_MALICIOUS_DOMAIN", () => {
  it("blocks domains flagged as known-malicious", () => {
    const result = evaluate(
      navInput("https://evil-phish.xyz/drain", { isKnownMalicious: true })
    );
    expect(result.verdict.status).toBe("block");
    expect(result.verdict.riskLevel).toBe("critical");
    expect(result.reasonCodes).toContain("PHISH_KNOWN_MALICIOUS_DOMAIN");
  });

  it("does not fire for non-malicious domains", () => {
    const result = evaluate(
      navInput("https://safe-site.com", { isKnownMalicious: false })
    );
    expect(result.verdict.status).toBe("allow");
  });
});

describe("PHISH_IMPERSONATION_NEW_DOMAIN", () => {
  it("blocks new domains impersonating known protocols", () => {
    // un1swap.org has similarity ~0.91 to uniswap.org (1 char edit)
    const result = evaluate(
      navInput("https://un1swap.org/claim", { ageHours: 24 })
    );
    expect(result.verdict.status).toBe("block");
    expect(result.reasonCodes).toContain("PHISH_IMPERSONATION_NEW_DOMAIN");
    expect(result.evidence).toHaveProperty("target");
  });

  it("does not fire for old domains", () => {
    const result = evaluate(
      navInput("https://un1swap.org", { ageHours: 500 })
    );
    expect(result.reasonCodes).not.toContain("PHISH_IMPERSONATION_NEW_DOMAIN");
  });

  it("does not fire for exact protocol domains", () => {
    const result = evaluate(
      navInput("https://uniswap.org", { ageHours: 2 })
    );
    expect(result.verdict.status).toBe("allow");
  });
});

describe("PHISH_SUSPICIOUS_TLD_MINT_KEYWORD", () => {
  it("warns on suspicious TLD with mint keyword", () => {
    const result = evaluate(
      navInput("https://crypto-claim.xyz/mint-nft")
    );
    expect(result.verdict.status).toBe("warn");
    expect(result.reasonCodes).toContain("PHISH_SUSPICIOUS_TLD_MINT_KEYWORD");
    expect(result.evidence).toHaveProperty("tld", "xyz");
  });

  it("does not fire for .com domains", () => {
    const result = evaluate(navInput("https://mintsite.com/mint"));
    expect(result.reasonCodes).not.toContain("PHISH_SUSPICIOUS_TLD_MINT_KEYWORD");
  });

  it("does not fire without mint keywords", () => {
    const result = evaluate(navInput("https://example.xyz/about"));
    expect(result.verdict.status).toBe("allow");
  });
});

describe("PHISH_IP_HOST_URL", () => {
  it("warns on direct IP access", () => {
    const result = evaluate(navInput("http://192.168.1.1/admin"));
    expect(result.verdict.status).toBe("warn");
    expect(result.reasonCodes).toContain("DIRECT_IP_ACCESS");
    expect(result.evidence).toHaveProperty("hostname", "192.168.1.1");
  });

  it("does not fire for localhost", () => {
    const result = evaluate(navInput("http://localhost:3000"));
    expect(result.reasonCodes).not.toContain("DIRECT_IP_ACCESS");
  });

  it("does not fire for 127.0.0.1", () => {
    const result = evaluate(navInput("http://127.0.0.1:4000/health"));
    expect(result.reasonCodes).not.toContain("DIRECT_IP_ACCESS");
  });

  it("warns on public IP addresses", () => {
    const result = evaluate(navInput("http://45.33.32.156/phish"));
    expect(result.verdict.status).toBe("warn");
    expect(result.reasonCodes).toContain("DIRECT_IP_ACCESS");
  });
});

describe("PHISH_NEW_DOMAIN_WALLET_CONNECT", () => {
  it("blocks new domains with wallet-connect patterns", () => {
    const result = evaluate(
      navInput("https://dapp-walletconnect.xyz/connect", {
        ageHours: 48,
        containsWalletConnectPattern: true,
      })
    );
    expect(result.verdict.status).toBe("block");
    expect(result.verdict.riskLevel).toBe("critical");
    expect(result.reasonCodes).toContain("NEW_DOMAIN_WALLET_CONNECT");
  });

  it("does not fire for old domains with wallet-connect", () => {
    const result = evaluate(
      navInput("https://trusted-dapp.com/walletconnect", {
        ageHours: 500,
        containsWalletConnectPattern: true,
      })
    );
    expect(result.reasonCodes).not.toContain("NEW_DOMAIN_WALLET_CONNECT");
  });

  it("does not fire for new domains without wallet-connect patterns", () => {
    const result = evaluate(
      navInput("https://new-safe-site.com", {
        ageHours: 24,
        containsWalletConnectPattern: false,
      })
    );
    expect(result.reasonCodes).not.toContain("NEW_DOMAIN_WALLET_CONNECT");
  });

  it("detects wallet-connect patterns from URL when signal not provided", () => {
    const result = evaluate(
      navInput("https://fake-dapp.xyz/walletconnect", { ageHours: 12 })
    );
    expect(result.reasonCodes).toContain("NEW_DOMAIN_WALLET_CONNECT");
  });
});

describe("PHISH_HOMOGLYPH_DOMAIN", () => {
  it("blocks domains with homoglyph characters", () => {
    const result = evaluate(
      navInput("https://\u043Epensea.io", { hasHomoglyphs: true })
    );
    expect(result.verdict.status).toBe("block");
    expect(result.verdict.riskLevel).toBe("critical");
    expect(result.reasonCodes).toContain("HOMOGLYPH_ATTACK");
  });

  it("does not fire for normal ASCII domains", () => {
    const result = evaluate(navInput("https://opensea.io"));
    expect(result.reasonCodes).not.toContain("HOMOGLYPH_ATTACK");
  });
});

describe("PHISH_REDIRECT_CHAIN", () => {
  it("warns on suspicious redirect chains", () => {
    const result = evaluate(
      navInput("https://click-tracker.com/r/abc", {
        redirectCount: 4,
        finalDomain: "evil-phish.xyz",
      })
    );
    expect(result.verdict.status).toBe("warn");
    expect(result.reasonCodes).toContain("SUSPICIOUS_REDIRECT_CHAIN");
    expect(result.evidence).toHaveProperty("redirectCount", 4);
  });

  it("does not fire with fewer than 3 redirects", () => {
    const result = evaluate(
      navInput("https://short-redirect.com", {
        redirectCount: 2,
        finalDomain: "different.com",
      })
    );
    expect(result.reasonCodes).not.toContain("SUSPICIOUS_REDIRECT_CHAIN");
  });

  it("fires when redirect count hits the threshold exactly", () => {
    const result = evaluate(
      navInput("https://click-tracker.com/r/abc", {
        redirectCount: 3,
        finalDomain: "evil-phish.xyz",
      })
    );

    expect(result.verdict.status).toBe("warn");
    expect(result.reasonCodes).toContain("SUSPICIOUS_REDIRECT_CHAIN");
    expect(result.evidence).toHaveProperty("redirectCount", 3);
  });

  it("does not fire when final domain matches original", () => {
    const result = evaluate(
      navInput("https://app.example.com/auth", {
        redirectCount: 5,
        finalDomain: "example.com",
      })
    );
    expect(result.reasonCodes).not.toContain("SUSPICIOUS_REDIRECT_CHAIN");
  });
});

// ── Layer 1 precedence integration ──

describe("Layer 1 precedence integration", () => {
  it("uses rule priority order when a single navigation matches multiple rules", () => {
    const result = evaluate(
      navInput("https://un1swap.xyz/walletconnect/mint", {
        ageHours: 6,
        isKnownMalicious: true,
        hasHomoglyphs: true,
        containsWalletConnectPattern: true,
      })
    );

    expect(result.verdict.status).toBe("block");
    expect(result.verdict.riskLevel).toBe("critical");
    expect(result.matchedRules[0]).toBe("PHISH_KNOWN_MALICIOUS_DOMAIN");
    expect(result.matchedRules).toContain("PHISH_HOMOGLYPH_DOMAIN");
    expect(result.matchedRules).toContain("PHISH_NEW_DOMAIN_WALLET_CONNECT");
    expect(result.matchedRules).toContain("PHISH_SUSPICIOUS_TLD_MINT_KEYWORD");
    expect(
      result.matchedRules.indexOf("PHISH_KNOWN_MALICIOUS_DOMAIN")
    ).toBeLessThan(result.matchedRules.indexOf("PHISH_HOMOGLYPH_DOMAIN"));
    expect(
      result.matchedRules.indexOf("PHISH_HOMOGLYPH_DOMAIN")
    ).toBeLessThan(result.matchedRules.indexOf("PHISH_NEW_DOMAIN_WALLET_CONNECT"));
    expect(
      result.matchedRules.indexOf("PHISH_NEW_DOMAIN_WALLET_CONNECT")
    ).toBeLessThan(
      result.matchedRules.indexOf("PHISH_SUSPICIOUS_TLD_MINT_KEYWORD")
    );
    expect(result.reasonCodes).toContain("PHISH_KNOWN_MALICIOUS_DOMAIN");
    expect(result.reasonCodes).toContain("HOMOGLYPH_ATTACK");
    expect(result.reasonCodes).toContain("NEW_DOMAIN_WALLET_CONNECT");
    expect(result.reasonCodes).toContain("PHISH_SUSPICIOUS_TLD_MINT_KEYWORD");
  });

  it("keeps homoglyph ahead of impersonation when both rules match", () => {
    const result = evaluate(
      navInput("https://un1swap.org/claim", {
        ageHours: 12,
        hasHomoglyphs: true,
      })
    );

    expect(result.verdict.status).toBe("block");
    expect(result.matchedRules).toContain("PHISH_HOMOGLYPH_DOMAIN");
    expect(result.matchedRules).toContain("PHISH_IMPERSONATION_NEW_DOMAIN");
    expect(
      result.matchedRules.indexOf("PHISH_HOMOGLYPH_DOMAIN")
    ).toBeLessThan(
      result.matchedRules.indexOf("PHISH_IMPERSONATION_NEW_DOMAIN")
    );
  });

  it("keeps block precedence above warn precedence on the same navigation input", () => {
    const result = evaluate(
      navInput("https://crypto-claim.xyz/mint", {
        isKnownMalicious: true,
      })
    );

    expect(result.verdict.status).toBe("block");
    expect(result.matchedRules[0]).toBe("PHISH_KNOWN_MALICIOUS_DOMAIN");
    expect(result.reasonCodes).toContain("PHISH_KNOWN_MALICIOUS_DOMAIN");
    expect(result.reasonCodes).toContain("PHISH_SUSPICIOUS_TLD_MINT_KEYWORD");
  });
});

describe("Layer 1 degraded protection contract", () => {
  it("operates when domainAgeHours is null", () => {
    const result = evaluate(
      navInput("https://crypto-claim.xyz/mint", {
        ageHours: null,
      }),
    );

    expect(result.verdict.status).not.toBe("allow");
  });

  it("operates when malicious feed data missing", () => {
    const result = evaluate(
      navInput("https://crypto-claim.xyz/mint", {
        isKnownMalicious: false,
        ageHours: null,
      }),
    );

    expect(result.verdict.status).toBe("warn");
  });

  it("still blocks critical signals without feeds", () => {
    const result = evaluate(
      navInput("https://оpensea.io", {
        ageHours: null,
        isKnownMalicious: false,
        hasHomoglyphs: true,
      }),
    );

    expect(result.verdict.status).toBe("block");
  });

  it("redirect detection works without feed data", () => {
    const result = evaluate(
      navInput("https://click-tracker.com/r/abc", {
        redirectCount: 4,
        finalDomain: "evil-phish.xyz",
        ageHours: null,
        isKnownMalicious: false,
      }),
    );

    expect(result.verdict.status).toBe("warn");
  });

  it("never fails open with missing signals", () => {
    const result = evaluate(
      navInput("https://crypto-claim.xyz/mint", {
        ageHours: null,
        redirectCount: undefined,
        finalDomain: undefined,
      }),
    );

    expect(result.verdict.status).not.toBe("allow");
  });
});

describe("Layer 1 punycode and IDN non-regression", () => {
  it("blocks Unicode homoglyph domains", () => {
    const result = evaluate(
      navInput("https://оpensea.io", {
        hasHomoglyphs: true,
      }),
    );

    expect(result.verdict.status).toBe("block");
    expect(result.reasonCodes).toContain("HOMOGLYPH_ATTACK");
  });

  it("blocks punycode encoded domains", () => {
    const result = evaluate(navInput("https://xn--pensea-3ya.io"));

    expect(result.verdict.status).toBe("block");
  });

  it("does not allow punycode decoding to bypass homoglyph detection", () => {
    const result = evaluate(navInput("https://xn--opnsea-9za.io"));

    expect(result.verdict.status).toBe("block");
  });

  it("does not falsely block normal ASCII domains", () => {
    const result = evaluate(navInput("https://opensea.io"));

    expect(result.verdict.status).toBe("allow");
  });

  it("still triggers impersonation for IDN brand spoofing", () => {
    const result = evaluate(
      navInput("https://uniswap-secure-login.xyz", {
        ageHours: 12,
      }),
    );

    expect(result.reasonCodes).toContain("PHISH_IMPERSONATION_NEW_DOMAIN");
  });
});

describe("Layer 1 evidence schema contract", () => {
  it("returns empty evidence for safe allow verdicts", () => {
    const result = evaluate(
      navInput("https://opensea.io/collection/boredapes", {
        ageHours: 50000,
        isKnownMalicious: false,
      })
    );

    expect(result.verdict.status).toBe("allow");
    expect(result.evidence).toEqual({});
    expect(result.verdict.evidence).toEqual({});
  });

  it("locks known-malicious evidence fields", () => {
    const result = evaluate(
      navInput("https://crypto-drainer-scam.net/steal", {
        isKnownMalicious: true,
      })
    );

    expect(result.reasonCodes).toContain("PHISH_KNOWN_MALICIOUS_DOMAIN");
    expect(Object.keys(result.evidence).sort()).toEqual(["domain"]);
    expect(result.evidence.domain).toBe("crypto-drainer-scam.net");
  });

  it("locks suspicious-tld mint evidence fields", () => {
    const result = evaluate(navInput("https://crypto-claim.xyz/mint-nft"));

    expect(result.reasonCodes).toContain("PHISH_SUSPICIOUS_TLD_MINT_KEYWORD");
    expect(Object.keys(result.evidence).sort()).toEqual([
      "matchedKeywords",
      "tld",
    ]);
    expect(result.evidence.tld).toBe("xyz");
    expect(Array.isArray(result.evidence.matchedKeywords)).toBe(true);
  });

  it("locks homoglyph evidence fields", () => {
    const result = evaluate(
      navInput("https://\u043Epensea.io", { hasHomoglyphs: true })
    );

    expect(result.reasonCodes).toContain("HOMOGLYPH_ATTACK");
    expect(Object.keys(result.evidence).sort()).toEqual([
      "baseDomain",
      "decodedDomain",
      "deconfused",
      "domain",
      "hostname",
      "levenshteinDistance",
      "matchedBrand",
      "matchedTarget",
      "normalizedDomain",
      "originalDomain",
      "phishingKeywords",
      "protectedBrand",
      "registrableDomain",
      "similarityMethod",
    ]);
    expect(result.evidence.hostname).toBe("xn--pensea-vqf.io");
  });

  it("locks redirect-chain evidence fields", () => {
    const result = evaluate(
      navInput("https://click-tracker.com/r/abc", {
        redirectCount: 4,
        finalDomain: "evil-phish.xyz",
      })
    );

    expect(result.reasonCodes).toContain("SUSPICIOUS_REDIRECT_CHAIN");
    expect(Object.keys(result.evidence).sort()).toEqual([
      "finalDomain",
      "originalDomain",
      "redirectCount",
    ]);
    expect(result.evidence.redirectCount).toBe(4);
  });

  it("locks merged evidence keys for a multi-match navigation", () => {
    const result = evaluate(
      navInput("https://un1swap.xyz/walletconnect/mint", {
        ageHours: 6,
        isKnownMalicious: true,
        hasHomoglyphs: true,
        containsWalletConnectPattern: true,
      })
    );

    expect(result.verdict.status).toBe("block");
    expect(result.reasonCodes).toContain("PHISH_KNOWN_MALICIOUS_DOMAIN");
    expect(result.reasonCodes).toContain("HOMOGLYPH_ATTACK");
    expect(result.reasonCodes).toContain("NEW_DOMAIN_WALLET_CONNECT");
    expect(result.reasonCodes).toContain("PHISH_SUSPICIOUS_TLD_MINT_KEYWORD");
    expect(Object.keys(result.evidence).sort()).toEqual([
      "baseDomain",
      "deconfused",
      "domain",
      "domainAgeHours",
      "hostname",
      "levenshteinDistance",
      "matchedKeywords",
      "matchedTarget",
      "normalizedDomain",
      "phishingKeywords",
      "protectedBrand",
      "registrableDomain",
      "similarityMethod",
      "tld",
    ]);
    expect(result.evidence.domain).toBe("un1swap.xyz");
    expect(result.evidence.domainAgeHours).toBe(6);
    expect(result.evidence.tld).toBe("xyz");
  });
});

// ── Golden Fixtures ──

describe("golden fixtures", () => {
  it("fixture 1: un1swap.org (impersonation + new domain) → block", () => {
    // un1swap.org impersonates uniswap.org (1-char edit, similarity ~0.91)
    const result = evaluate(
      navInput("https://un1swap.org/airdrop", { ageHours: 12 })
    );
    expect(result.verdict.status).toBe("block");
    expect(result.verdict.riskLevel).toBe("critical");
    expect(result.reasonCodes).toContain("PHISH_IMPERSONATION_NEW_DOMAIN");
    expect(result.evidence).toHaveProperty("target", "uniswap.org");
  });

  it("fixture 2: 192.168.1.1/mint → IP host", () => {
    const result = evaluate(navInput("http://192.168.1.1/mint"));
    expect(result.verdict.status).toBe("warn");
    expect(result.reasonCodes).toContain("DIRECT_IP_ACCESS");
  });

  it("fixture 3: opensea with Cyrillic homoglyph → homoglyph block", () => {
    // Using Cyrillic 'о' (U+043E) instead of Latin 'o'
    const result = evaluate(
      navInput("https://\u043Epensea.io", { hasHomoglyphs: true })
    );
    expect(result.verdict.status).toBe("block");
    expect(result.verdict.riskLevel).toBe("critical");
    expect(result.reasonCodes).toContain("HOMOGLYPH_ATTACK");
  });

  it("fixture 4: known malicious feed domain", () => {
    const result = evaluate(
      navInput("https://crypto-drainer-scam.net/steal", {
        isKnownMalicious: true,
      })
    );
    expect(result.verdict.status).toBe("block");
    expect(result.verdict.riskLevel).toBe("critical");
    expect(result.reasonCodes).toContain("PHISH_KNOWN_MALICIOUS_DOMAIN");
    expect(result.evidence).toHaveProperty("domain");
  });

  it("fixture 5: safe domain opensea.io → allow", () => {
    const result = evaluate(
      navInput("https://opensea.io/collection/boredapes", {
        ageHours: 50000,
        isKnownMalicious: false,
      })
    );
    expect(result.verdict.status).toBe("allow");
    expect(result.verdict.riskLevel).toBe("low");
    expect(result.reasonCodes).toHaveLength(0);
    expect(result.matchedRules).toHaveLength(0);
  });
});

// ── Full evaluate() pipeline tests ──

describe("evaluate() pipeline for navigation events", () => {
  it("returns allow for completely safe URLs", () => {
    const result = evaluate(
      navInput("https://google.com", {
        ageHours: 100000,
        isKnownMalicious: false,
      })
    );
    expect(result.verdict.status).toBe("allow");
    expect(result.verdict.riskLevel).toBe("low");
    expect(result.verdict.ruleSetVersion).toBe("0.1.0");
  });

  it("aggregates evidence from multiple matched rules", () => {
    const result = evaluate(
      navInput("https://uniswap-claim.xyz/mint", {
        ageHours: 12,
        isKnownMalicious: true,
      })
    );
    // Should have evidence from multiple rules
    expect(result.evidence).toHaveProperty("domain");
    expect(result.evidence).toHaveProperty("tld");
    expect(result.matchedRules.length).toBeGreaterThan(1);
  });

  it("verdict shape is complete", () => {
    const result = evaluate(navInput("https://safe.com"));
    expect(result.verdict).toHaveProperty("status");
    expect(result.verdict).toHaveProperty("riskLevel");
    expect(result.verdict).toHaveProperty("reasonCodes");
    expect(result.verdict).toHaveProperty("matchedRules");
    expect(result.verdict).toHaveProperty("evidence");
    expect(result.verdict).toHaveProperty("ruleSetVersion");
  });
});
describe("PHISH_SUBDOMAIN_BRAND_IMPERSONATION", () => {
  it("blocks brand in subdomain", () => {
    const result = evaluate(
      navInput("https://metamask-login.secureportal-example.com")
    );

    expect(result.verdict.status).toBe("block");
    expect(result.reasonCodes).toContain(
      "PHISH_SUBDOMAIN_BRAND_IMPERSONATION"
    );
  });

  it("blocks walletconnect phishing subdomain", () => {
    const result = evaluate(
      navInput("https://wallet.opensea.verify-user.net")
    );

    expect(result.verdict.status).toBe("block");
    expect(result.reasonCodes).toContain(
      "PHISH_SUBDOMAIN_BRAND_IMPERSONATION"
    );
  });

  it("does not trigger for legitimate subdomain", () => {
    const result = evaluate(
      navInput("https://app.uniswap.org")
    );

    expect(result.reasonCodes).not.toContain(
      "PHISH_SUBDOMAIN_BRAND_IMPERSONATION"
    );

    expect(result.verdict.status).toBe("allow");
  });
});
