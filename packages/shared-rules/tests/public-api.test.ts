import { describe, expect, it } from "vitest";

import {
  RULE_SET_VERSION,
  buildNavigationContext,
  contextToInput,
  evaluate,
  getReasonMessage,
} from "../src/index.js";
import * as SharedRules from "../src/index.js";

describe("root public API", () => {
  it("evaluates Layer 1 navigation flows through the root import path", () => {
    const ctx = buildNavigationContext({
      rawUrl: "https://xn--pensea-3ya.io",
    });

    const result = evaluate(contextToInput(ctx));

    expect(result.verdict.status).toBe("block");
    expect(result.verdict.ruleSetVersion).toBe(RULE_SET_VERSION);
    expect(result.reasonCodes.length).toBeGreaterThan(0);
    expect(getReasonMessage(result.reasonCodes[0] ?? "").blockedTitle).toBe(
      "This site has been blocked"
    );
  });

  it("does not leak future-layer helpers through the root export", () => {
    expect("TRANSACTION_RULES" in SharedRules).toBe(false);
    expect("WALLET_RULES" in SharedRules).toBe(false);
    expect("DOWNLOAD_RULES" in SharedRules).toBe(false);
    expect("TRANSACTION_CODES" in SharedRules).toBe(false);
    expect("WALLET_CODES" in SharedRules).toBe(false);
    expect("DOWNLOAD_CODES" in SharedRules).toBe(false);
    expect("isApprovalMethod" in SharedRules).toBe(false);
    expect("hasUnlimitedApprovals" in SharedRules).toBe(false);
    expect("isExecutableFile" in SharedRules).toBe(false);
    expect("normalizeEvmAddress" in SharedRules).toBe(false);
    expect("DomainIntelFeedManager" in SharedRules).toBe(false);
    expect("DomainIntelFeedStorage" in SharedRules).toBe(false);
    expect("DomainIntelFeedStorageMetadata" in SharedRules).toBe(false);
  });

  it("handles malformed raw URLs deterministically through the public entrypoint", () => {
    const ctx = buildNavigationContext({
      rawUrl: "not a valid url",
    });

    const result = evaluate(contextToInput(ctx));

    expect(ctx.normalized.hostname).toBe("");
    expect(result.verdict.status).toBe("block");
    expect(result.reasonCodes).toContain("PHISH_REDIRECT_CHAIN_ABUSE");
    expect(result.evidence).toEqual({});
  });
});
