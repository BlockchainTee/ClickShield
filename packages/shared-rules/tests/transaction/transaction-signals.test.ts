import { describe, expect, it } from "vitest";

import {
  buildTransactionSignals,
  getTransactionSignals,
  normalizeTransactionRequest,
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

const WALLET_METADATA = {
  providerType: "injected",
  walletName: "Example Wallet",
  walletVersion: null,
  platform: "web",
} as const;

describe("transaction signal extraction", () => {
  it("marks empty calldata as a native transfer", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "1",
      calldata: "0x",
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    expect(context.signals.isNativeTransfer).toBe(true);
    expect(context.signals.isContractInteraction).toBe(false);
    expect(context.signals.targetAddress).toBe(
      "0x2222222222222222222222222222222222222222"
    );
  });

  it("extracts the ERC20 transfer selector deterministically", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0",
      calldata: buildCalldata("0xa9059cbb", [
        encodeAddress("0x3333333333333333333333333333333333333333"),
        encodeUint(42n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    expect(context.signals.methodName).toBe("transfer");
    expect(context.signals.isContractInteraction).toBe(true);
    expect(context.signals.isNativeTransfer).toBe(false);
  });

  it("detects approve calls", () => {
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
    });

    expect(context.signals.methodName).toBe("approve");
    expect(context.signals.isApproval).toBe(true);
    expect(context.signals.isApprovalMethod).toBe(true);
  });

  it("detects unlimited approvals", () => {
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

    expect(context.signals.isUnlimitedApproval).toBe(true);
  });

  it("flags high-value native transfers at the 1 ETH threshold", () => {
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

    expect(context.signals.hasValueTransfer).toBe(true);
    expect(context.signals.isHighValue).toBe(true);
  });

  it("returns the same signal object for the same normalized input", () => {
    const context = normalizeTransactionRequest({
      eventKind: "transaction",
      rpcMethod: "eth_sendTransaction",
      chainFamily: "evm",
      chainId: 1,
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      value: "0",
      calldata: buildCalldata("0xa9059cbb", [
        encodeAddress("0x3333333333333333333333333333333333333333"),
        encodeUint(42n),
      ]),
      originDomain: "app.example.com",
      walletProvider: "injected",
      walletMetadata: WALLET_METADATA,
    });

    const first = getTransactionSignals(context);
    const second = getTransactionSignals(context);

    expect(first).toEqual(second);
    expect(buildTransactionSignals(context)).toEqual(first);
  });
});
