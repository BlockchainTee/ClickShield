import { createHash } from "node:crypto";
import * as fs from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTransactionIntelProvider,
  evaluateTransaction,
  getDefaultTransactionIntelProvider,
  normalizeTransactionRequest,
  normalizeTypedDataRequest,
  validateTransactionLayer2Snapshot,
  type TransactionIntelProvider,
} from "../../src/index.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => {
    throw new Error("unexpected file read during evaluation");
  }),
}));

function serializeCanonicalJson(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonicalJson).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => {
    return `${JSON.stringify(key)}:${serializeCanonicalJson(record[key])}`;
  });

  return `{${entries.join(",")}}`;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function buildSnapshotVersion(snapshotBody: {
  readonly maliciousContracts: readonly unknown[];
  readonly scamSignatures: readonly unknown[];
  readonly metadata: {
    readonly generatedAt: string;
    readonly sources: readonly string[];
  };
  readonly sectionStates: {
    readonly maliciousContracts: string;
    readonly scamSignatures: string;
  };
}): string {
  return `layer2.${sha256Hex(
    serializeCanonicalJson({
      maliciousContracts: snapshotBody.maliciousContracts,
      scamSignatures: snapshotBody.scamSignatures,
      metadata: snapshotBody.metadata,
      sectionStates: snapshotBody.sectionStates,
    })
  ).slice(0, 16)}`;
}

function buildSnapshot(
  maliciousContracts: readonly unknown[],
  sectionState: "ready" | "stale" | "missing"
) {
  const snapshotBody = {
    generatedAt: "2026-03-24T00:00:00.000Z",
    maliciousContracts,
    scamSignatures: [],
    metadata: {
      generatedAt: "2026-03-24T00:00:00.000Z",
      sources:
        maliciousContracts.length === 0
          ? []
          : ["chainabuse", "internal", "ofac"].filter((source) =>
              maliciousContracts.some(
                (entry) =>
                  typeof entry === "object" &&
                  entry !== null &&
                  "source" in entry &&
                  entry.source === source
              )
            ),
    } as const,
    sectionStates: {
      maliciousContracts: sectionState,
      scamSignatures: "missing",
    } as const,
  };

  return {
    version: buildSnapshotVersion(snapshotBody),
    ...snapshotBody,
  };
}

function buildValidatedProvider(
  maliciousContracts: readonly unknown[]
): TransactionIntelProvider {
  const result = validateTransactionLayer2Snapshot(
    buildSnapshot(maliciousContracts, "ready")
  );

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected validated transaction snapshot");
  }

  return createTransactionIntelProvider(result.snapshot);
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

const POPULATED_PROVIDER = buildValidatedProvider([
  {
    chain: "evm",
    address: "0x9999999999999999999999999999999999999999",
    source: "ofac",
    disposition: "block",
    confidence: "high",
    reason: "OFAC sanctions address",
    reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
  },
]);

const SIGNATURE_MATCH_PROVIDER = buildStaticIntelProvider({
  contractDisposition: "malicious",
  contractFeedVersion: "contracts@2026-03-22",
  signatureDisposition: "malicious",
  signatureFeedVersion: "signatures@2026-03-22",
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Layer 3 Phase B transaction evaluation", () => {
  it("hydrates provider-fed no-match intel before warning on unlimited approval", () => {
    const context = normalizeTransactionRequest(
      {
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
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

    const result = evaluateTransaction(context);

    expect(context.intel.contractDisposition).toBe("no_match");
    expect(context.intel.sectionStates).toEqual({
      maliciousContracts: "fresh",
      scamSignatures: "missing",
    });
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
    const context = normalizeTransactionRequest(
      {
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
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("WARN");
    expect(result.verdict.primaryRuleId).toBe(
      "TX_WARN_INCREASE_ALLOWANCE_UNKNOWN_SPENDER"
    );
    expect(result.reasonCodes).toEqual(["TX_UNKNOWN_SPENDER"]);
  });

  it("does not warn on exact increaseAllowance to a trusted spender", () => {
    const context = normalizeTransactionRequest(
      {
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
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("ALLOW");
    expect(result.verdict.primaryRuleId).toBeNull();
    expect(result.reasonCodes).toEqual([]);
  });

  it("keeps unlimited increaseAllowance on the unlimited-approval rule", () => {
    const context = normalizeTransactionRequest(
      {
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
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

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
    const context = normalizeTransactionRequest(
      {
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
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

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
        intelProvider: POPULATED_PROVIDER,
      }
    );

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("WARN");
    expect(result.reasonCodes).toEqual(["TX_PERMIT_SIGNATURE"]);
    expect(result.verdict.primaryRuleId).toBe(
      "TX_WARN_PERMIT_SIGNATURE_TO_UNTRUSTED_CONTRACT"
    );
  });

  it("hydrates provider-fed malicious contract matches into Layer 3 before evaluation", () => {
    const context = normalizeTransactionRequest(
      {
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
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

    const result = evaluateTransaction(context);

    expect(context.intel.contractDisposition).toBe("malicious");
    expect(context.intel.contractFeedVersion).toBe(POPULATED_PROVIDER.snapshotVersion);
    expect(result.verdict.status).toBe("BLOCK");
    expect(result.verdict.overrideAllowed).toBe(false);
    expect(result.verdict.overrideLevel).toBe("none");
    expect(result.reasonCodes).toContain("TX_KNOWN_MALICIOUS_CONTRACT");
    expect(result.verdict.primaryRuleId).toBe(
      "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT"
    );
  });

  it("does not let increaseAllowance warnings outrank malicious-contract blocks", () => {
    const context = normalizeTransactionRequest(
      {
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
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

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
    const context = normalizeTransactionRequest(
      {
        eventKind: "transaction",
        rpcMethod: "eth_sendTransaction",
        chainFamily: "evm",
        chainId: 1,
        from: "0x1111111111111111111111111111111111111111",
        to: "0x2222222222222222222222222222222222222222",
        value: "0x0",
        calldata,
        originDomain: "app.example.com",
        walletProvider: "injected",
        walletMetadata: WALLET_METADATA,
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("WARN");
    expect(result.reasonCodes).toEqual(["TX_MULTICALL_APPROVAL_AND_TRANSFER"]);
    expect(result.verdict.primaryRuleId).toBe(
      "TX_WARN_MULTICALL_APPROVAL_AND_TRANSFER"
    );
  });

  it("allows low-risk transfers without request-supplied allowlist intel", () => {
    const context = normalizeTransactionRequest(
      {
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
        counterparty: {
          recipientIsNew: false,
        },
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

    const result = evaluateTransaction(context);

    expect(context.intel.contractDisposition).toBe("no_match");
    expect(result.verdict.status).toBe("ALLOW");
    expect(result.verdict.primaryRuleId).toBeNull();
    expect(result.reasonCodes).toEqual([]);
    expect(result.verdict.overrideAllowed).toBe(false);
    expect(result.verdict.overrideLevel).toBe("none");
  });

  it("uses provider-fed signature intel and contract intel for signature blocks", () => {
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
        intelProvider: SIGNATURE_MATCH_PROVIDER,
      }
    );

    const result = evaluateTransaction(context);

    expect(context.intel.contractDisposition).toBe("malicious");
    expect(context.intel.signatureDisposition).toBe("malicious");
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

  it("uses the hydrated input contract only during evaluation", () => {
    const baseContext = normalizeTransactionRequest(
      {
        eventKind: "transaction",
        rpcMethod: "eth_sendTransaction",
        chainFamily: "evm",
        chainId: 1,
        from: "0x1111111111111111111111111111111111111111",
        to: "0x2222222222222222222222222222222222222222",
        value: "0x0",
        calldata: buildCalldata("0xa9059cbb", [
          encodeAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
          encodeUint(5n),
        ]),
        originDomain: "app.example.com",
        walletProvider: "injected",
        walletMetadata: WALLET_METADATA,
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );
    const hydratedContext = {
      ...baseContext,
      intel: {
        ...baseContext.intel,
        contractDisposition: "malicious" as const,
        contractFeedVersion: "contracts@manual-hydrate",
      },
    };

    const result = evaluateTransaction(hydratedContext);

    expect(baseContext.intel.contractDisposition).toBe("no_match");
    expect(result.verdict.status).toBe("BLOCK");
    expect(result.reasonCodes).toContain("TX_KNOWN_MALICIOUS_CONTRACT");
  });

  it("does not let request-supplied intel override provider truth", () => {
    const context = normalizeTransactionRequest(
      {
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
          contractDisposition: "no_match",
          contractFeedVersion: "request@conflict",
        },
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

    const result = evaluateTransaction(context);

    expect(context.intel.contractDisposition).toBe("malicious");
    expect(context.intel.contractFeedVersion).toBe(POPULATED_PROVIDER.snapshotVersion);
    expect(result.verdict.status).toBe("BLOCK");
  });

  it("does not default populated provider lookups to unavailable", () => {
    const context = normalizeTransactionRequest(
      {
        eventKind: "transaction",
        rpcMethod: "eth_sendTransaction",
        chainFamily: "evm",
        chainId: 1,
        from: "0x1111111111111111111111111111111111111111",
        to: "0x2222222222222222222222222222222222222222",
        value: "0x0",
        calldata: buildCalldata("0xa9059cbb", [
          encodeAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
          encodeUint(5n),
        ]),
        originDomain: "app.example.com",
        walletProvider: "injected",
        walletMetadata: WALLET_METADATA,
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

    expect(context.intel.contractDisposition).toBe("no_match");
    expect(context.intel.signatureDisposition).toBe("unavailable");
    expect(context.intel.sectionStates.maliciousContracts).toBe("fresh");
  });

  it("does not drift across repeated hydration and evaluation with the same provider", () => {
    const input = {
      eventKind: "transaction" as const,
      rpcMethod: "eth_sendTransaction" as const,
      chainFamily: "evm" as const,
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
    };

    const firstContext = normalizeTransactionRequest(input, {
      intelProvider: POPULATED_PROVIDER,
    });
    const secondContext = normalizeTransactionRequest(input, {
      intelProvider: POPULATED_PROVIDER,
    });
    const first = evaluateTransaction(firstContext);
    const second = evaluateTransaction(secondContext);

    expect(secondContext).toEqual(firstContext);
    expect(second).toEqual(first);
  });

  it("reuses the canonical default provider lifecycle across repeated runtime calls", () => {
    const input = {
      eventKind: "transaction" as const,
      rpcMethod: "eth_sendTransaction" as const,
      chainFamily: "evm" as const,
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
    };

    const providerBefore = getDefaultTransactionIntelProvider();
    const firstContext = normalizeTransactionRequest(input);
    const secondContext = normalizeTransactionRequest(input);
    const providerAfter = getDefaultTransactionIntelProvider();

    expect(providerAfter).toBe(providerBefore);
    expect(secondContext).toEqual(firstContext);
  });

  it("rejects raw snapshots as runtime intel overrides", () => {
    const result = validateTransactionLayer2Snapshot(
      buildSnapshot(
        [
          {
            chain: "evm",
            address: "0x9999999999999999999999999999999999999999",
            source: "ofac",
            disposition: "block",
            confidence: "high",
            reason: "OFAC sanctions address",
            reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
          },
        ],
        "ready"
      )
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected validated transaction snapshot");
    }

    expect(() =>
      normalizeTransactionRequest(
        {
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
        },
        {
          intelProvider: result.snapshot as unknown as TransactionIntelProvider,
        }
      )
    ).toThrow("Transaction intel runtime overrides must be prebuilt providers.");
  });

  it("does not perform hidden file or network I/O during evaluation", () => {
    const context = normalizeTransactionRequest(
      {
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
      },
      {
        intelProvider: POPULATED_PROVIDER,
      }
    );

    vi.stubGlobal("fetch", () => {
      throw new Error("unexpected fetch during evaluation");
    });

    const result = evaluateTransaction(context);

    expect(result.verdict.status).toBe("BLOCK");
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });
});
