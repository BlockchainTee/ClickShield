import { describe, expect, it } from "vitest";

import {
  evaluateTransaction,
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

describe("Layer 3 Phase B transaction evaluation", () => {
  it("warns on unlimited approval to an unknown spender", () => {
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
      intel: {
        contractDisposition: "no_match",
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("WARN");
    expect(result.verdict.overrideAllowed).toBe(true);
    expect(result.verdict.overrideLevel).toBe("confirm");
    expect(result.verdict.primaryRuleId).toBe(
      "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER"
    );
    expect(result.reasonCodes).toEqual([
      "TX_UNLIMITED_APPROVAL",
      "TX_UNKNOWN_SPENDER",
    ]);
  });

  it("warns on exact increaseAllowance to a non-trusted spender", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0x0",
      calldata: buildCalldata("0x39509351", [
        encodeAddress("0x3333333333333333333333333333333333333333"),
        encodeUint(1n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
      counterparty: {
        spenderTrusted: false,
      },
      intel: {
        contractDisposition: "no_match",
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("WARN");
    expect(result.verdict.primaryRuleId).toBe(
      "TX_WARN_INCREASE_ALLOWANCE_UNKNOWN_SPENDER"
    );
    expect(result.reasonCodes).toEqual(["TX_UNKNOWN_SPENDER"]);
  });

  it("does not warn on exact increaseAllowance to a trusted spender", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0x0",
      calldata: buildCalldata("0x39509351", [
        encodeAddress("0x3333333333333333333333333333333333333333"),
        encodeUint(1n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
      counterparty: {
        spenderTrusted: true,
      },
      intel: {
        contractDisposition: "no_match",
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("ALLOW");
    expect(result.verdict.primaryRuleId).toBeNull();
    expect(result.reasonCodes).toEqual([]);
  });

  it("keeps unlimited increaseAllowance on the unlimited-approval rule", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0x0",
      calldata: buildCalldata("0x39509351", [
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
      intel: {
        contractDisposition: "no_match",
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("WARN");
    expect(result.verdict.primaryRuleId).toBe(
      "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER"
    );
    expect(result.reasonCodes).toEqual([
      "TX_UNLIMITED_APPROVAL",
      "TX_UNKNOWN_SPENDER",
    ]);
  });

  it("warns on setApprovalForAll to an unknown operator", () => {
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
      counterparty: {
        spenderTrusted: null,
      },
      intel: {
        contractDisposition: "no_match",
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("WARN");
    expect(result.reasonCodes).toEqual([
      "TX_SET_APPROVAL_FOR_ALL",
      "TX_UNKNOWN_SPENDER",
    ]);
    expect(result.verdict.primaryRuleId).toBe(
      "TX_WARN_SET_APPROVAL_FOR_ALL_UNKNOWN_OPERATOR"
    );
  });

  it("warns on permit signatures to untrusted contracts", () => {
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
      intel: {
        contractDisposition: "no_match",
        signatureDisposition: "no_match",
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("WARN");
    expect(result.reasonCodes).toEqual(["TX_PERMIT_SIGNATURE"]);
    expect(result.verdict.primaryRuleId).toBe(
      "TX_WARN_PERMIT_SIGNATURE_TO_UNTRUSTED_CONTRACT"
    );
  });

  it("blocks malicious contract interactions from Layer 2 intel", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x9999999999999999999999999999999999999999",
      value: "0x0",
      calldata: buildCalldata("0xa9059cbb", [
        encodeAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        encodeUint(5n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
      intel: {
        contractDisposition: "malicious",
        contractFeedVersion: "contracts@2026-03-22",
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("BLOCK");
    expect(result.verdict.overrideAllowed).toBe(true);
    expect(result.verdict.overrideLevel).toBe("high_friction_confirm");
    expect(result.reasonCodes).toContain("TX_KNOWN_MALICIOUS_CONTRACT");
    expect(result.verdict.primaryRuleId).toBe(
      "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT"
    );
  });

  it("does not let increaseAllowance warnings outrank malicious-contract blocks", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x9999999999999999999999999999999999999999",
      value: "0x0",
      calldata: buildCalldata("0x39509351", [
        encodeAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        encodeUint(1n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
      counterparty: {
        spenderTrusted: false,
      },
      intel: {
        contractDisposition: "malicious",
        contractFeedVersion: "contracts@2026-03-22",
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("BLOCK");
    expect(result.verdict.primaryRuleId).toBe(
      "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT"
    );
    expect(result.matchedRules).toEqual([
      "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT",
      "TX_WARN_INCREASE_ALLOWANCE_UNKNOWN_SPENDER",
    ]);
    expect(result.reasonCodes).toEqual([
      "TX_KNOWN_MALICIOUS_CONTRACT",
      "TX_UNKNOWN_SPENDER",
    ]);
  });

  it("warns on multicalls that combine approval and transfer", () => {
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
      intel: {
        contractDisposition: "no_match",
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("WARN");
    expect(result.reasonCodes).toEqual(["TX_MULTICALL_APPROVAL_AND_TRANSFER"]);
    expect(result.verdict.primaryRuleId).toBe(
      "TX_WARN_MULTICALL_APPROVAL_AND_TRANSFER"
    );
  });

  it("allows low-risk known transfers without escalation", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0x0",
      calldata: buildCalldata("0xa9059cbb", [
        encodeAddress("0x3333333333333333333333333333333333333333"),
        encodeUint(1n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
      intel: {
        contractDisposition: "allowlisted",
      },
      counterparty: {
        recipientIsNew: false,
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("ALLOW");
    expect(result.verdict.primaryRuleId).toBeNull();
    expect(result.reasonCodes).toEqual([]);
    expect(result.verdict.overrideAllowed).toBe(false);
    expect(result.verdict.overrideLevel).toBe("none");
  });

  it("uses priority ordering when multiple block rules match", () => {
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
      intel: {
        contractDisposition: "malicious",
        contractFeedVersion: "contracts@2026-03-22",
        signatureDisposition: "malicious",
        signatureFeedVersion: "signatures@2026-03-22",
      },
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("BLOCK");
    expect(result.verdict.primaryRuleId).toBe("TX_BLOCK_SCAM_SIGNATURE_MATCH");
    expect(result.matchedRules).toEqual([
      "TX_BLOCK_SCAM_SIGNATURE_MATCH",
      "TX_BLOCK_MALICIOUS_SIGNATURE_CONTRACT",
    ]);
    expect(result.reasonCodes).toEqual([
      "TX_SCAM_SIGNATURE_MATCH",
      "TX_PERMIT_SIGNATURE",
      "TX_KNOWN_MALICIOUS_CONTRACT",
    ]);
  });

  it("does not drift across repeated evaluations of the same normalized input", () => {
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
      intel: {
        contractDisposition: "no_match",
      },
    });

    const first = evaluateTransaction(context);
    const second = evaluateTransaction(
      JSON.parse(JSON.stringify(context)) as typeof context
    );

    expect(second).toEqual(first);
  });
});
