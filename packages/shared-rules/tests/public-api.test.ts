import { describe, expect, it } from "vitest";

import {
  RULE_SET_VERSION,
  buildNavigationContext,
  buildTransactionExplanation,
  buildTransactionSignals,
  classifyTransactionSelector,
  contextToInput,
  evaluateEvmWalletScan,
  evaluateSolanaWalletScan,
  evaluateTransaction,
  getTransactionSelectorDefinition,
  evaluate,
  getReasonMessage,
  normalizeTransactionRequest,
  normalizeTypedDataRequest,
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

  it("exports Layer 3 Phase A transaction foundation helpers through the root import", () => {
    expect(typeof getTransactionSelectorDefinition).toBe("function");
    expect(typeof classifyTransactionSelector).toBe("function");
    expect(typeof normalizeTransactionRequest).toBe("function");
    expect(typeof normalizeTypedDataRequest).toBe("function");
    expect(typeof buildTransactionExplanation).toBe("function");
    expect(typeof buildTransactionSignals).toBe("function");
    expect(typeof evaluateTransaction).toBe("function");
    expect(typeof evaluateEvmWalletScan).toBe("function");
    expect(typeof evaluateSolanaWalletScan).toBe("function");

    const selector = getTransactionSelectorDefinition("0x095ea7b3");
    expect(selector?.functionName).toBe("approve");
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

  it("normalizes transaction and signature requests through the public entrypoint", () => {
    const tx = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0x0",
      calldata:
        "0x095ea7b3" +
        "0000000000000000000000003333333333333333333333333333333333333333" +
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: {
        providerType: "injected",
        walletName: "Example Wallet",
        walletVersion: null,
        platform: "web",
      },
    });

    const sig = normalizeTypedDataRequest({
      eventKind: "signature",
      rpcMethod: "eth_signTypedData_v4",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      typedData: {
        domain: {
          name: "Permit",
        },
        types: {
          EIP712Domain: [{ name: "name", type: "string" }],
          Permit: [{ name: "spender", type: "address" }],
        },
        primaryType: "Permit",
        message: {
          spender: "0x3333333333333333333333333333333333333333",
        },
      },
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: {
        providerType: "injected",
        walletName: "Example Wallet",
        walletVersion: null,
        platform: "web",
      },
    });

    expect(tx.actionType).toBe("approve");
    expect(sig.eventKind).toBe("signature");
    expect(sig.signature.normalizationState).toBe("missing_domain_fields");
  });
});
