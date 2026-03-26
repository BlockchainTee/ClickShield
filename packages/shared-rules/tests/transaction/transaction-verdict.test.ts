import { describe, expect, it } from "vitest";

import {
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

describe("transaction verdict consolidation", () => {
  it("block beats warn and keeps the block reason primary", () => {
    const result = assembleTransactionVerdict(buildTransactionContext(), [
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
        ruleId: "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT",
        priority: 999,
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

    expect(result.verdict.status).toBe("BLOCK");
    expect(result.verdict.primaryRuleId).toBe(
      "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT"
    );
    expect(result.verdict.primaryReason?.ruleId).toBe(
      "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT"
    );
    expect(result.verdict.secondaryReasons.map((reason) => reason.ruleId)).toEqual([
      "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
    ]);
  });

  it("warn beats allow", () => {
    const result = assembleTransactionVerdict(buildTransactionContext(), [
      match({
        ruleId: "TX_ALLOW_BENIGN_APPROVAL",
        priority: 1,
        outcome: "allow",
        severity: "low",
        reasonCodes: ["TX_BENIGN_APPROVAL"],
        evidence: {
          benign: {
            allowlisted: true,
          },
        },
      }),
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
    ]);

    expect(result.verdict.status).toBe("WARN");
    expect(result.verdict.primaryRuleId).toBe(
      "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER"
    );
    expect(result.verdict.secondaryReasons.map((reason) => reason.ruleId)).toEqual([
      "TX_ALLOW_BENIGN_APPROVAL",
    ]);
  });

  it("selects a stable primary winner across multiple block rules", () => {
    const context = buildSignatureContext();
    const matches = [
      match({
        ruleId: "TX_BLOCK_MALICIOUS_SIGNATURE_CONTRACT",
        priority: 10,
        outcome: "block",
        severity: "critical",
        reasonCodes: ["TX_KNOWN_MALICIOUS_CONTRACT", "TX_PERMIT_SIGNATURE"],
        evidence: {
          maliciousVerifier: {
            address: "0x3333333333333333333333333333333333333333",
          },
        },
      }),
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
    ] as const;

    const first = assembleTransactionVerdict(context, matches);
    const second = assembleTransactionVerdict(context, [...matches].reverse());

    expect(first.verdict.primaryRuleId).toBe("TX_BLOCK_SCAM_SIGNATURE_MATCH");
    expect(second.verdict.primaryRuleId).toBe("TX_BLOCK_SCAM_SIGNATURE_MATCH");
    expect(first.verdict.secondaryReasons.map((reason) => reason.ruleId)).toEqual([
      "TX_BLOCK_MALICIOUS_SIGNATURE_CONTRACT",
    ]);
    expect(second.verdict.secondaryReasons.map((reason) => reason.ruleId)).toEqual([
      "TX_BLOCK_MALICIOUS_SIGNATURE_CONTRACT",
    ]);
  });

  it("selects a stable primary winner across multiple warn rules", () => {
    const context = buildTransactionContext();
    const matches = [
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
    ] as const;

    const first = assembleTransactionVerdict(context, matches);
    const second = assembleTransactionVerdict(context, [...matches].reverse());

    expect(first.verdict.primaryRuleId).toBe(
      "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER"
    );
    expect(second.verdict.primaryRuleId).toBe(
      "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER"
    );
    expect(first.verdict.secondaryReasons.map((reason) => reason.ruleId)).toEqual([
      "TX_WARN_TRANSFER_FROM_NEW_RECIPIENT",
    ]);
    expect(second.verdict.secondaryReasons.map((reason) => reason.ruleId)).toEqual([
      "TX_WARN_TRANSFER_FROM_NEW_RECIPIENT",
    ]);
  });

  it("preserves secondary reasons in stable order and deduplicates noisy reason codes", () => {
    const result = assembleTransactionVerdict(buildTransactionContext(), [
      match({
        ruleId: "TX_ALLOW_BENIGN_APPROVAL",
        priority: 1,
        outcome: "allow",
        severity: "low",
        reasonCodes: ["TX_SHARED_REASON", "TX_SHARED_REASON"],
        evidence: {
          benign: {
            note: "allowlisted",
          },
        },
      }),
      match({
        ruleId: "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
        priority: 120,
        outcome: "warn",
        severity: "high",
        reasonCodes: [
          "TX_UNLIMITED_APPROVAL",
          "TX_SHARED_REASON",
          "TX_SHARED_REASON",
        ],
        evidence: {
          shared: {
            source: "warn",
          },
        },
      }),
      match({
        ruleId: "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT",
        priority: 10,
        outcome: "block",
        severity: "critical",
        reasonCodes: ["TX_KNOWN_MALICIOUS_CONTRACT", "TX_SHARED_REASON"],
        evidence: {
          shared: {
            source: "block",
          },
          maliciousContract: {
            address: "0x2222222222222222222222222222222222222222",
          },
        },
      }),
    ]);

    expect(result.verdict.primaryRuleId).toBe(
      "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT"
    );
    expect(result.verdict.secondaryReasons.map((reason) => reason.ruleId)).toEqual([
      "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
      "TX_ALLOW_BENIGN_APPROVAL",
    ]);
    expect(result.reasonCodes).toEqual([
      "TX_KNOWN_MALICIOUS_CONTRACT",
      "TX_SHARED_REASON",
      "TX_UNLIMITED_APPROVAL",
    ]);
    expect(result.verdict.evidence).toEqual({
      maliciousContract: {
        address: "0x2222222222222222222222222222222222222222",
      },
      shared: {
        source: "block",
      },
      benign: {
        note: "allowlisted",
      },
    });
  });

  it("is deterministic across repeated verdict assembly and preserves truthful context", () => {
    const context = buildSignatureContext();
    const matches = [
      match({
        ruleId: "TX_BLOCK_SCAM_SIGNATURE_MATCH",
        priority: 5,
        outcome: "block",
        severity: "critical",
        reasonCodes: ["TX_SCAM_SIGNATURE_MATCH", "TX_PERMIT_SIGNATURE"],
        evidence: {
          scamSignature: {
            verifyingContract: "0x3333333333333333333333333333333333333333",
            zeta: true,
            alpha: true,
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
    ] as const;

    const first = assembleTransactionVerdict(context, matches);
    const second = assembleTransactionVerdict(context, matches);

    expect(second).toEqual(first);
    expect(first.signals).toEqual(context.signals);
    expect(first.riskClassification).toEqual(context.riskClassification);
    expect(first.verdict.intelVersions).toEqual({
      contractFeedVersion: context.intel.contractFeedVersion,
      allowlistFeedVersion: context.intel.allowlistFeedVersion,
      signatureFeedVersion: context.intel.signatureFeedVersion,
    });
    expect(first.verdict.primaryReason).toEqual({
      ruleId: "TX_BLOCK_SCAM_SIGNATURE_MATCH",
      outcome: "block",
      severity: "critical",
      priority: 5,
      reasonCodes: ["TX_SCAM_SIGNATURE_MATCH", "TX_PERMIT_SIGNATURE"],
      evidence: {
        scamSignature: {
          alpha: true,
          verifyingContract: "0x3333333333333333333333333333333333333333",
          zeta: true,
        },
      },
    });
    expect(first.verdict.secondaryReasons).toEqual([
      {
        ruleId: "TX_WARN_PERMIT_SIGNATURE_TO_UNTRUSTED_CONTRACT",
        outcome: "warn",
        severity: "high",
        priority: 140,
        reasonCodes: ["TX_PERMIT_SIGNATURE"],
        evidence: {
          permitSignature: {
            normalizationState: "normalized",
          },
        },
      },
    ]);
  });
});
