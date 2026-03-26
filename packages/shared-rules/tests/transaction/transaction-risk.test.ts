import { describe, expect, it } from "vitest";

import {
  classifyTransactionRisk,
  evaluateTransaction,
  normalizeTransactionRequest,
  normalizeTypedDataRequest,
  type TransactionIntelProvider,
} from "../../src/index.js";

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

function buildStaticIntelProvider(overrides: {
  readonly contractDisposition?: "malicious" | "no_match" | "unavailable";
  readonly contractFeedVersion?: string | null;
  readonly contractSectionState?: "fresh" | "stale" | "missing";
  readonly signatureDisposition?: "malicious" | "no_match" | "unavailable";
  readonly signatureFeedVersion?: string | null;
  readonly signatureSectionState?: "fresh" | "stale" | "missing";
} = {}): TransactionIntelProvider {
  const maliciousContract = Object.freeze({
    lookupFamily: "contract" as const,
    matched: overrides.contractDisposition === "malicious",
    disposition: overrides.contractDisposition ?? "no_match",
    matchedSection:
      overrides.contractDisposition === "malicious"
        ? ("maliciousContracts" as const)
        : undefined,
    feedVersion: overrides.contractFeedVersion ?? "layer2.static-provider",
    sectionState: overrides.contractSectionState ?? "fresh",
    record:
      overrides.contractDisposition === "malicious"
        ? Object.freeze({
            chain: "evm" as const,
            address: "0x3333333333333333333333333333333333333333",
            source: "ofac" as const,
            disposition: "block" as const,
            confidence: "high" as const,
            reason: "Known malicious contract",
            reasonCodes: Object.freeze(["OFAC_SANCTIONS_ADDRESS"]),
          })
        : null,
  });
  const scamSignature = Object.freeze({
    lookupFamily: "scam_signature" as const,
    matched: overrides.signatureDisposition === "malicious",
    disposition: overrides.signatureDisposition ?? "no_match",
    matchedSection:
      overrides.signatureDisposition === "malicious"
        ? ("scamSignatures" as const)
        : undefined,
    feedVersion: overrides.signatureFeedVersion ?? "layer2.static-provider",
    sectionState: overrides.signatureSectionState ?? "fresh",
  });
  const canonicalResult = Object.freeze({
    maliciousContract,
    scamSignature,
  });

  return {
    snapshotVersion: "layer2.static-provider",
    generatedAt: "2026-03-24T00:00:00.000Z",
    lookupCanonicalTransactionIntel: () => canonicalResult,
    lookupMaliciousContract: () => maliciousContract,
    lookupScamSignature: () => scamSignature,
  };
}

const WALLET_METADATA = {
  providerType: "injected",
  walletName: "Example Wallet",
  walletVersion: null,
  platform: "web",
} as const;

describe("transaction risk classification", () => {
  it("classifies malicious target risk from hydrated intel", () => {
    const context = normalizeTransactionRequest(
      {
        eventKind: "transaction",
        rpcMethod: "eth_sendTransaction",
        chainFamily: "evm",
        chainId: 1,
        from: "0x1111111111111111111111111111111111111111",
        to: "0x9999999999999999999999999999999999999999",
        value: "0",
        calldata: buildCalldata("0xa9059cbb", [
          encodeAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
          encodeUint(5n),
        ]),
        originDomain: "app.example.com",
        walletProvider: "injected",
        walletMetadata: WALLET_METADATA,
      },
      {
        intelProvider: buildStaticIntelProvider({
          contractDisposition: "malicious",
        }),
      }
    );

    expect(context.riskClassification.hasMaliciousTarget).toBe(true);
    expect(context.riskClassification.requiresUserAttention).toBe(true);
  });

  it("classifies known scam signature risk from hydrated intel", () => {
    const context = normalizeTypedDataRequest(
      {
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
      },
      {
        intelProvider: buildStaticIntelProvider({
          signatureDisposition: "malicious",
        }),
      }
    );

    expect(context.riskClassification.hasKnownScamSignature).toBe(true);
    expect(context.riskClassification.requiresUserAttention).toBe(true);
  });

  it("classifies approval risk for approval-style transactions", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0",
      calldata: buildCalldata("0x095ea7b3", [
        encodeAddress("0x3333333333333333333333333333333333333333"),
        encodeUint(7n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
      counterparty: {
        spenderTrusted: false,
      },
    });

    const result = evaluateTransaction(context);

    expect(context.riskClassification.isApprovalRisk).toBe(true);
    expect(result.riskClassification).toEqual(context.riskClassification);
  });

  it("classifies unlimited approval risk", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0",
      calldata: buildCalldata("0x095ea7b3", [
        encodeAddress("0x3333333333333333333333333333333333333333"),
        encodeUint(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        ),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    expect(context.riskClassification.isUnlimitedApprovalRisk).toBe(true);
  });

  it("classifies permit signature risk", () => {
    const context = normalizeTypedDataRequest({
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

    expect(context.riskClassification.isPermitRisk).toBe(true);
  });

  it("classifies unknown method risk for unclassified contract interactions", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0",
      calldata: "0x12345678",
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    expect(context.riskClassification.isUnknownMethodRisk).toBe(true);
    expect(context.riskClassification.requiresUserAttention).toBe(true);
  });

  it("classifies high-value transfer risk", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "1000000000000000000",
      calldata: "0x",
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    expect(context.riskClassification.isHighValueTransferRisk).toBe(true);
  });

  it("rolls up meaningful risk into requiresUserAttention", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0",
      calldata: buildCalldata("0x095ea7b3", [
        encodeAddress("0x3333333333333333333333333333333333333333"),
        encodeUint(7n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
      counterparty: {
        spenderTrusted: false,
      },
    });

    expect(context.riskClassification.requiresUserAttention).toBe(true);
  });

  it("returns deterministic repeated output for the same input", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0",
      calldata: buildCalldata("0x095ea7b3", [
        encodeAddress("0x3333333333333333333333333333333333333333"),
        encodeUint(7n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
      counterparty: {
        spenderTrusted: false,
      },
    });

    const first = classifyTransactionRisk(context);
    const second = classifyTransactionRisk(context);

    expect(first).toEqual(second);
    expect(first).toEqual(context.riskClassification);
  });
});
