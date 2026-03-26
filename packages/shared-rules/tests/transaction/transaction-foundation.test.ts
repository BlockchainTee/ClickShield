import { describe, expect, it } from "vitest";

import {
  buildTransactionSignals,
  getTransactionSelectorDefinition,
  normalizeTransactionRequest,
  normalizeTypedDataRequest,
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

function encodeBool(value: boolean): string {
  return padWord(value ? "1" : "0");
}

function encodeBytes(data: string): string {
  const clean = data.startsWith("0x") ? data.slice(2) : data;
  const byteLength = clean.length / 2;
  const padded = clean.padEnd(Math.ceil(clean.length / 64) * 64, "0");
  return `${encodeUint(byteLength)}${padded}`;
}

function encodeBytesArray(items: readonly string[]): string {
  const encodedItems = items.map((item) => encodeBytes(item));
  const headSizeBytes = 32 + items.length * 32;

  let currentOffsetBytes = headSizeBytes;
  const offsets = encodedItems.map((encoded) => {
    const offset = currentOffsetBytes;
    currentOffsetBytes += encoded.length / 2;
    return encodeUint(offset);
  });

  return `${encodeUint(items.length)}${offsets.join("")}${encodedItems.join("")}`;
}

function buildCalldata(selector: string, words: readonly string[]): string {
  return `0x${selector.replace(/^0x/, "")}${words.join("")}`;
}

const WALLET_METADATA = {
  providerType: "injected",
  walletName: "Example Wallet",
  walletVersion: null,
  platform: "web",
} as const;

describe("Layer 3 transaction foundation", () => {
  it("maps required selectors deterministically", () => {
    expect(getTransactionSelectorDefinition("0x095ea7b3")?.functionName).toBe(
      "approve"
    );
    expect(getTransactionSelectorDefinition("0xa22cb465")?.functionName).toBe(
      "setApprovalForAll"
    );
    expect(getTransactionSelectorDefinition("0xd505accf")?.functionName).toBe(
      "permit"
    );
    expect(getTransactionSelectorDefinition("0xac9650d8")?.functionName).toBe(
      "multicall"
    );
  });

  it("decodes approve transactions", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0x0",
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
      },
    });

    expect(context.actionType).toBe("approve");
    expect(context.decoded.spender).toBe(
      "0x3333333333333333333333333333333333333333"
    );
    expect(context.decoded.amountKind).toBe("unlimited");
  });

  it("decodes setApprovalForAll transactions", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x4444444444444444444444444444444444444444",
      value: "0x0",
      calldata: buildCalldata("0xa22cb465", [
        encodeAddress("0x5555555555555555555555555555555555555555"),
        encodeBool(true),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    expect(context.actionType).toBe("setApprovalForAll");
    expect(context.decoded.operator).toBe(
      "0x5555555555555555555555555555555555555555"
    );
    expect(context.decoded.approvalScope).toBe("collection_all");
    expect(context.decoded.approvalDirection).toBe("grant");
  });

  it("distinguishes setApprovalForAll revocations from grants", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x4444444444444444444444444444444444444444",
      value: "0x0",
      calldata: buildCalldata("0xa22cb465", [
        encodeAddress("0x5555555555555555555555555555555555555555"),
        encodeBool(false),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    const signals = buildTransactionSignals(context);
    expect(context.decoded.params.approved).toBe(false);
    expect(context.decoded.approvalDirection).toBe("revoke");
    expect(signals.isSetApprovalForAll).toBe(true);
    expect(signals.approvalDirection).toBe("revoke");
    expect(signals.containsApproval).toBe(false);
  });

  it("decodes permit transactions", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x6666666666666666666666666666666666666666",
      value: "0x0",
      calldata: buildCalldata("0xd505accf", [
        encodeAddress("0x7777777777777777777777777777777777777777"),
        encodeAddress("0x8888888888888888888888888888888888888888"),
        encodeUint(25n),
        encodeUint(999999n),
        encodeUint(27n),
        padWord("0x1"),
        padWord("0x2"),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    expect(context.actionType).toBe("permit");
    expect(context.decoded.owner).toBe(
      "0x7777777777777777777777777777777777777777"
    );
    expect(context.decoded.spender).toBe(
      "0x8888888888888888888888888888888888888888"
    );
    expect(context.decoded.amount).toBe("25");
  });

  it("decodes multicall boundaries and inner actions", () => {
    const approve = buildCalldata("0x095ea7b3", [
      encodeAddress("0x3333333333333333333333333333333333333333"),
      encodeUint(123n),
    ]);
    const transferFrom = buildCalldata("0x23b872dd", [
      encodeAddress("0x4444444444444444444444444444444444444444"),
      encodeAddress("0x5555555555555555555555555555555555555555"),
      encodeUint(456n),
    ]);
    const encodedCalls = encodeBytesArray([approve, transferFrom]);
    const calldata = `0xac9650d8${encodeUint(32n)}${encodedCalls}`;

    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x9999999999999999999999999999999999999999",
      value: "0x0",
      calldata,
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    expect(context.batch.isMulticall).toBe(true);
    expect(context.batch.actions).toHaveLength(2);
    expect(context.batch.actions[0]?.actionType).toBe("approve");
    expect(context.batch.actions[1]?.actionType).toBe("transferFrom");
  });

  it("extracts deterministic approval signals", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0x0",
      calldata: buildCalldata("0x095ea7b3", [
        encodeAddress("0xabcabcabcabcabcabcabcabcabcabcabcabcabca"),
        encodeUint(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        ),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    const signals = buildTransactionSignals(context);

    expect(signals.methodName).toBe("approve");
    expect(signals.isApprovalMethod).toBe(true);
    expect(signals.isUnlimitedApproval).toBe(true);
  });

  it("normalizes typed-data requests with missing domain fields", () => {
    const context = normalizeTypedDataRequest({
      eventKind: "signature",
      rpcMethod: "eth_signTypedData_v4",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      typedData: {
        domain: {
          name: "Permit2",
        },
        types: {
          EIP712Domain: [{ name: "name", type: "string" }],
          PermitSingle: [{ name: "spender", type: "address" }],
        },
        primaryType: "PermitSingle",
        message: {
          spender: "0x3333333333333333333333333333333333333333",
        },
      },
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    expect(context.signature.domainChainId).toBeNull();
    expect(context.signature.verifyingContract).toBeNull();
    expect(context.signature.domainChainIdPresent).toBe(false);
    expect(context.signature.verifyingContractPresent).toBe(false);
    expect(context.signature.normalizationState).toBe("missing_domain_fields");
  });

  it("marks invalid typed-data domain chainId as invalid rather than normalized", () => {
    const context = normalizeTypedDataRequest({
      eventKind: "signature",
      rpcMethod: "eth_signTypedData_v4",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      typedData: {
        domain: {
          name: "Permit2",
          chainId: "abc",
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

    expect(context.signature.domainChainId).toBeNull();
    expect(context.signature.domainChainIdPresent).toBe(false);
    expect(context.signature.invalidDomainFields).toContain("domain.chainId");
    expect(context.signature.normalizationState).toBe("invalid_domain_fields");
    expect(context.meta.typedDataNormalized).toBe(false);
  });

  it("marks empty or invalid verifyingContract as invalid rather than valid presence", () => {
    const emptyVerifier = normalizeTypedDataRequest({
      eventKind: "signature",
      rpcMethod: "eth_signTypedData_v4",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      typedData: {
        domain: {
          name: "Permit2",
          chainId: 1,
          verifyingContract: "",
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

    expect(emptyVerifier.signature.verifyingContract).toBeNull();
    expect(emptyVerifier.signature.verifyingContractPresent).toBe(false);
    expect(emptyVerifier.signature.invalidDomainFields).toContain(
      "domain.verifyingContract"
    );
    expect(emptyVerifier.signature.normalizationState).toBe(
      "invalid_domain_fields"
    );
  });

  it("extracts factual signals without decision leakage", () => {
    const approve = buildCalldata("0x095ea7b3", [
      encodeAddress("0x000000000022d473030f116ddee9f6b43ac78ba3"),
      encodeUint(1n),
    ]);
    const transferFrom = buildCalldata("0x23b872dd", [
      encodeAddress("0x4444444444444444444444444444444444444444"),
      encodeAddress("0x5555555555555555555555555555555555555555"),
      encodeUint(456n),
    ]);
    const encodedCalls = encodeBytesArray([approve, transferFrom]);
    const calldata = `0xac9650d8${encodeUint(32n)}${encodedCalls}`;

    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x9999999999999999999999999999999999999999",
      value: "0x0",
      calldata,
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
      counterparty: {
        recipientIsNew: true,
      },
    });

    const signals = buildTransactionSignals(context);

    expect(signals.isMulticall).toBe(true);
    expect(signals.containsApprovalAndTransfer).toBe(true);
    expect(signals.spenderTrusted).toBeNull();
    expect(signals.recipientIsNew).toBe(true);
    expect(signals.approvalDirection).toBe("not_applicable");
    expect("status" in signals).toBe(false);
    expect("verdict" in signals).toBe(false);
    expect("riskLevel" in signals).toBe(false);
    expect("outcome" in signals).toBe(false);
  });

  it("detects permit signatures factually", () => {
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

    const signals = buildTransactionSignals(context);

    expect(signals.isPermitSignature).toBe(true);
    expect(signals.isApprovalMethod).toBe(false);
  });

  it("keeps spenderTrusted null when the caller does not supply it", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0x0",
      calldata: buildCalldata("0x095ea7b3", [
        encodeAddress("0x000000000022d473030f116ddee9f6b43ac78ba3"),
        encodeUint(1n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    const signals = buildTransactionSignals(context);

    expect(signals.spenderTrusted).toBeNull();
  });

  it("marks opaque interactions as contract interactions", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "123",
      calldata: "0xdeadbeef",
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    const signals = buildTransactionSignals(context);

    expect(signals.isContractInteraction).toBe(true);
    expect(signals.methodName).toBeUndefined();
    expect(signals.targetAddress).toBe(
      "0x2222222222222222222222222222222222222222"
    );
  });
});
