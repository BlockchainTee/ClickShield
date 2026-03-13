import { describe, expect, it } from "vitest";
import { evaluatePunycodeHomographRule } from "../policies/phishing/punycodeRules";

describe("PHISH_PUNYCODE_HOMOGRAPH_BRAND", () => {
  it("returns SAFE for a normal domain", () => {
    const result = evaluatePunycodeHomographRule("google.com");
    expect(result).toBeNull();
  });

  it("returns BLOCK for a punycode metamask homograph domain", () => {
    const result = evaluatePunycodeHomographRule("xn--metamask-login-5ib.com");

    expect(result).not.toBeNull();
    expect(result?.severity).toBe("BLOCK");
    expect(result?.evidence).toEqual(
      expect.objectContaining({
        originalDomain: "xn--metamask-login-5ib.com",
        matchedBrand: "metamask",
      }),
    );
  });

  it("returns BLOCK for a punycode coinbase homograph domain", () => {
    const result = evaluatePunycodeHomographRule("xn--coinbase-secure-login.com");

    expect(result).not.toBeNull();
    expect(result?.severity).toBe("BLOCK");
    expect(result?.evidence).toEqual(
      expect.objectContaining({
        originalDomain: "xn--coinbase-secure-login.com",
        matchedBrand: "coinbase",
      }),
    );
  });

  it("returns SAFE for a punycode domain with no protected brand similarity", () => {
    const result = evaluatePunycodeHomographRule("xn--example-domain.com");
    expect(result).toBeNull();
  });
});
