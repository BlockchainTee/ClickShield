import { describe, expect, it } from "vitest";

import {
  explainTransaction,
  normalizeTransactionRequest,
  normalizeTypedDataRequest,
  type SignatureInput,
  type TransactionInput,
} from "../../src/index.js";
import {
  assembleTransactionVerdict,
  type MatchedRuleData,
} from "../../src/engine/verdict.js";

const WALLET_METADATA = {
  providerType: "injected",
  walletName: "Example Wallet",
  walletVersion: null,
  platform: "web",
} as const;

function padWord(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return clean.padStart(64, "0");
}

function encodeAddress(address: string): string {
  return padWord(address.toLowerCase().replace(/^0x/, ""));
}

function encodeUint(value: bigint | number | string): string {
  return padWord(BigInt(value).toString(16));
}

function buildCalldata(selector: string, words: readonly string[]): string {
  return `0x${selector.replace(/^0x/, "")}${words.join("")}`;
}

function buildTransactionContext(): TransactionInput {
  return normalizeTransactionRequest({
    eventKind: "transaction",
    rpcMethod: "eth_sendTransaction",
    chainFamily: "evm",
    chainId: 1,
    from: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    value: "0x1",
    calldata: buildCalldata("0x095ea7b3", [
      encodeAddress("0x3333333333333333333333333333333333333333"),
      encodeUint(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      ),
    ]),
    originDomain: "app.example.com",
    walletProvider: "injected",
    walletMetadata: WALLET_METADATA,
    counterparty: {
      spenderTrusted: false,
      recipientIsNew: true,
    },
  });
}

function buildSignatureContext(): SignatureInput {
  return normalizeTypedDataRequest({
    eventKind: "signature",
    rpcMethod: "eth_signTypedData_v4",
    chainFamily: "evm",
    chainId: 1,
    from: "0x1111111111111111111111111111111111111111",
    typedData: {
      domain: {
        name: "Permit2",
        chainId: 1,
        verifyingContract: "0x3333333333333333333333333333333333333333",
      },
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        PermitSingle: [{ name: "spender", type: "address" }],
      },
      primaryType: "PermitSingle",
      message: {
        spender: "0x4444444444444444444444444444444444444444",
      },
    },
    originDomain: "app.example.com",
    walletProvider: "injected",
    walletMetadata: WALLET_METADATA,
  });
}

function match(
  input: Pick<
    MatchedRuleData,
    "ruleId" | "priority" | "outcome" | "severity" | "reasonCodes" | "evidence"
  >
): MatchedRuleData {
  return {
    ruleId: input.ruleId,
    priority: input.priority,
    outcome: input.outcome,
    severity: input.severity,
    reasonCodes: [...input.reasonCodes],
    evidence: { ...input.evidence },
  };
}

describe("transaction explainability", () => {
  it("builds a block explanation with summary, risk level, and primary reason", () => {
    const context = buildTransactionContext();
    const result = assembleTransactionVerdict(context, [
      match({
        ruleId: "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT",
        priority: 10,
        outcome: "block",
        severity: "critical",
        reasonCodes: ["TX_KNOWN_MALICIOUS_CONTRACT"],
        evidence: {
          maliciousContract: {
            address: "0x2222222222222222222222222222222222222222",
          },
        },
      }),
    ]);

    expect(result.verdict.explanation).toEqual({
      status: "block",
      summary: "This transaction is dangerous and has been blocked",
      primaryReason: "Known malicious contract",
      secondaryReasons: [],
      riskLevel: "high",
      details: {
        method: "approve",
        target: "0x2222222222222222222222222222222222222222",
        value: "1",
        isContractInteraction: true,
      },
    });
  });

  it("builds a warn explanation with readable secondary reasons", () => {
    const context = buildTransactionContext();
    const result = assembleTransactionVerdict(context, [
      match({
        ruleId: "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
        priority: 120,
        outcome: "warn",
        severity: "high",
        reasonCodes: ["TX_UNLIMITED_APPROVAL", "TX_UNKNOWN_SPENDER"],
        evidence: {
          approval: {
            spenderTrusted: false,
          },
        },
      }),
      match({
        ruleId: "TX_WARN_TRANSFER_FROM_NEW_RECIPIENT",
        priority: 220,
        outcome: "warn",
        severity: "medium",
        reasonCodes: ["TX_UNKNOWN_CONTRACT_INTERACTION", "TX_NEW_RECIPIENT"],
        evidence: {
          delegatedTransfer: {
            recipientIsNew: true,
          },
        },
      }),
    ]);

    expect(result.verdict.explanation.status).toBe("warn");
    expect(result.verdict.explanation.summary).toBe(
      "This transaction may be risky"
    );
    expect(result.verdict.explanation.primaryReason).toBe(
      "Unlimited token approval"
    );
    expect(result.verdict.explanation.secondaryReasons).toEqual([
      "Unknown contract interaction",
    ]);
    expect(result.verdict.explanation.riskLevel).toBe("medium");
  });

  it("builds an allow explanation with minimal noise", () => {
    const context = buildTransactionContext();
    const result = assembleTransactionVerdict(context, []);

    expect(result.verdict.explanation).toEqual({
      status: "allow",
      summary: "This transaction appears safe",
      primaryReason: "No blocking or warning conditions were detected",
      secondaryReasons: [],
      riskLevel: "low",
      details: {
        method: "approve",
        target: "0x2222222222222222222222222222222222222222",
        value: "1",
        isContractInteraction: true,
      },
    });
  });

  it("is deterministic for identical inputs", () => {
    const context = buildSignatureContext();
    const result = assembleTransactionVerdict(context, [
      match({
        ruleId: "TX_BLOCK_SCAM_SIGNATURE_MATCH",
        priority: 5,
        outcome: "block",
        severity: "critical",
        reasonCodes: ["TX_SCAM_SIGNATURE_MATCH", "TX_PERMIT_SIGNATURE"],
        evidence: {
          scamSignature: {
            primaryType: "PermitSingle",
          },
        },
      }),
      match({
        ruleId: "TX_WARN_PERMIT_SIGNATURE_TO_UNTRUSTED_CONTRACT",
        priority: 140,
        outcome: "warn",
        severity: "high",
        reasonCodes: ["TX_PERMIT_SIGNATURE"],
        evidence: {
          permitSignature: {
            normalizationState: "normalized",
          },
        },
      }),
    ]);

    const first = explainTransaction(context, result.verdict);
    const second = explainTransaction(context, result.verdict);

    expect(second).toEqual(first);
  });

  it("deduplicates readable secondary reasons", () => {
    const context = buildTransactionContext();
    const result = assembleTransactionVerdict(context, [
      match({
        ruleId: "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT",
        priority: 10,
        outcome: "block",
        severity: "critical",
        reasonCodes: ["TX_KNOWN_MALICIOUS_CONTRACT"],
        evidence: {
          maliciousContract: {
            address: "0x2222222222222222222222222222222222222222",
          },
        },
      }),
      match({
        ruleId: "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
        priority: 120,
        outcome: "warn",
        severity: "high",
        reasonCodes: ["TX_UNKNOWN_SPENDER", "TX_UNLIMITED_APPROVAL"],
        evidence: {
          approval: {
            spenderTrusted: false,
          },
        },
      }),
      match({
        ruleId: "TX_WARN_INCREASE_ALLOWANCE_UNKNOWN_SPENDER",
        priority: 135,
        outcome: "warn",
        severity: "high",
        reasonCodes: ["TX_UNKNOWN_SPENDER"],
        evidence: {
          increaseAllowance: {
            spenderTrusted: false,
          },
        },
      }),
    ]);

    expect(result.verdict.explanation.secondaryReasons).toEqual([
      "Unknown spender",
    ]);
  });
});
