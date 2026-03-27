import { describe, expect, it, vi } from "vitest";

import {
  buildWalletLayer4Output,
  runWalletLayer4Scan,
  type BitcoinWalletScanEvaluationInput,
  type EvmWalletScanEvaluationInput,
  type SolanaWalletScanEvaluationInput,
  type WalletLayer4ScanEvaluation,
  type WalletScanMode,
  type WalletSnapshotSection,
} from "../../src/index.js";

const CAPTURED_AT = "2026-03-23T12:00:00.000Z";
const EVALUATED_AT = "2026-03-23T12:05:00.000Z";
const EVM_WALLET_ADDRESS = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const SOLANA_WALLET_ADDRESS = "5D6xPj5vXvGkGEXUXMaLLq5yRvCNr4CemGYGAaHo9dZY";
const BITCOIN_WALLET_ADDRESS =
  "BC1QCLICKSHIELDMAINWALLET000000000000000000000";
const MAX_UINT256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

function repeatHexPair(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function buildEvmAddress(seed: number): string {
  return `0x${repeatHexPair(seed).repeat(20)}`;
}

function buildSolAddress(seed: number): string {
  const prefix = String(seed).padStart(2, "1");
  return `${prefix}SolanaAddressSeed${prefix}AlphaBetaGamma`;
}

function buildBitcoinAddress(seed: number): string {
  return `bc1qclickshieldseed${String(seed).padStart(4, "0")}walletaddress0000000000`;
}

function createEvmSections(): readonly WalletSnapshotSection[] {
  return [
    {
      sectionId: "section_evm_approvals",
      sectionType: "evm_approvals",
      label: "EVM approvals",
      itemCount: 1,
      contentHash: "hash_evm_approvals",
      metadata: {},
    },
  ];
}

function createSolanaSections(): readonly WalletSnapshotSection[] {
  return [
    {
      sectionId: "section_sol_connections",
      sectionType: "solana_connections",
      label: "Solana connected apps",
      itemCount: 1,
      contentHash: "hash_sol_connections",
      metadata: {},
    },
  ];
}

function createBitcoinSections(): readonly WalletSnapshotSection[] {
  return [
    {
      sectionId: "section_btc_addresses",
      sectionType: "bitcoin_addresses",
      label: "Bitcoin addresses",
      itemCount: 1,
      contentHash: "hash_btc_addresses",
      metadata: {},
    },
  ];
}

function createEvmInput(
  scanMode: WalletScanMode
): EvmWalletScanEvaluationInput {
  return {
    request: {
      requestId: `request_evm_${scanMode}`,
      walletChain: "evm",
      walletAddress: EVM_WALLET_ADDRESS,
      networkId: "1",
      scanMode,
      requestedAt: CAPTURED_AT,
      metadata: {
        source: "output-test",
      },
    },
    snapshot: {
      snapshotId: `snapshot_evm_${scanMode}`,
      requestId: `request_evm_${scanMode}`,
      walletChain: "evm",
      walletAddress: EVM_WALLET_ADDRESS,
      networkId: "1",
      capturedAt: CAPTURED_AT,
      sections: createEvmSections(),
      metadata: {
        source: "output-test",
      },
    },
    hydratedSnapshot: {
      approvals: [
        {
          tokenStandard: "erc20",
          tokenAddress: buildEvmAddress(10),
          spenderAddress: buildEvmAddress(11),
          amount: MAX_UINT256,
          approvedAt: "2026-03-22T12:00:00.000Z",
        },
      ],
      spenders: [],
      contractExposures: [],
      metadata: {
        source: "output-test",
      },
    },
    evaluatedAt: EVALUATED_AT,
  };
}

function createSolanaInput(
  scanMode: WalletScanMode
): SolanaWalletScanEvaluationInput {
  return {
    request: {
      requestId: `request_solana_${scanMode}`,
      walletChain: "solana",
      walletAddress: SOLANA_WALLET_ADDRESS,
      networkId: "mainnet-beta",
      scanMode,
      requestedAt: CAPTURED_AT,
      metadata: {
        source: "output-test",
      },
    },
    snapshot: {
      snapshotId: `snapshot_solana_${scanMode}`,
      requestId: `request_solana_${scanMode}`,
      walletChain: "solana",
      walletAddress: SOLANA_WALLET_ADDRESS,
      networkId: "mainnet-beta",
      capturedAt: CAPTURED_AT,
      sections: createSolanaSections(),
      metadata: {
        source: "output-test",
      },
    },
    hydratedSnapshot: {
      tokenAccounts: [],
      authorityAssignments: [],
      connections: [
        {
          appName: "Broad app",
          origin: "https://broad-solana.example",
          permissions: ["sign_all_transactions", "account_access_all"],
          permissionLevel: "broad",
        },
      ],
      programExposures: [
        {
          programAddress: buildSolAddress(10),
          label: "Unknown program",
          riskLevel: "high",
          flags: ["drainer"],
        },
      ],
      metadata: {
        source: "output-test",
      },
    },
    evaluatedAt: EVALUATED_AT,
  };
}

function createBitcoinInput(
  scanMode: WalletScanMode
): BitcoinWalletScanEvaluationInput {
  return {
    request: {
      requestId: `request_bitcoin_${scanMode}`,
      walletChain: "bitcoin",
      walletAddress: BITCOIN_WALLET_ADDRESS,
      networkId: "bitcoin-mainnet",
      scanMode,
      requestedAt: CAPTURED_AT,
      metadata: {
        source: "output-test",
      },
    },
    snapshot: {
      snapshotId: `snapshot_bitcoin_${scanMode}`,
      requestId: `request_bitcoin_${scanMode}`,
      walletChain: "bitcoin",
      walletAddress: BITCOIN_WALLET_ADDRESS,
      networkId: "bitcoin-mainnet",
      capturedAt: CAPTURED_AT,
      sections: createBitcoinSections(),
      metadata: {
        source: "output-test",
      },
    },
    hydratedSnapshot: {
      addresses: [
        {
          address: buildBitcoinAddress(71),
          addressType: "segwit",
          role: "receive",
          receiveCount: 4,
          reuseCount: 3,
          exposedPublicly: true,
          balanceSats: "300000",
        },
      ],
      utxos: [
        {
          txid: "7".repeat(64),
          vout: 0,
          address: buildBitcoinAddress(71),
          valueSats: "300000",
        },
      ],
      hygieneRecords: [
        {
          issueType: "poor_hygiene",
          riskLevel: "medium",
          note: "Legacy receive address remains in routine use.",
        },
      ],
      metadata: {
        source: "output-test",
      },
    },
    evaluatedAt: EVALUATED_AT,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("buildWalletLayer4Output", () => {
  it("returns the exact report object produced by the scan entrypoint", async () => {
    const input = createEvmInput("full");
    const evaluation = runWalletLayer4Scan(input);
    const orchestratorModule = await import("../../src/wallet/orchestrator.js");
    const scanSpy = vi.spyOn(orchestratorModule, "runWalletLayer4Scan");

    try {
      scanSpy.mockReturnValueOnce(evaluation as WalletLayer4ScanEvaluation);

      const output = buildWalletLayer4Output(input);

      expect(output).toBe(evaluation.report);
      expect(scanSpy).toHaveBeenCalledOnce();
    } finally {
      scanSpy.mockRestore();
    }
  });

  it("preserves every report field without loss or reinterpretation", () => {
    const input = createSolanaInput("basic");
    const evaluation = runWalletLayer4Scan(input);

    expect(buildWalletLayer4Output(input)).toEqual(evaluation.report);
  });

  it("does not mutate the request payload while producing output", () => {
    const input = createBitcoinInput("basic");
    const before = clone(input);

    buildWalletLayer4Output(input);

    expect(input).toEqual(before);
  });

  it("returns identical output for repeated identical requests", () => {
    const input = createBitcoinInput("basic");

    const first = buildWalletLayer4Output(input);
    const second = buildWalletLayer4Output(input);

    expect(first).toEqual(second);
  });

  it("fails unsupported requests through the same truthful error path", () => {
    expect(() => buildWalletLayer4Output(createSolanaInput("full"))).toThrowError(
      'Layer 4 solana capability does not support request.scanMode "full"; supported values: "basic".'
    );
  });

  it("throws for an invalid walletChain instead of returning undefined", () => {
    const invalidInput = {
      ...createEvmInput("full"),
      request: {
        ...createEvmInput("full").request,
        walletChain: "dogecoin",
      },
      snapshot: {
        ...createEvmInput("full").snapshot,
        walletChain: "dogecoin",
      },
    } as unknown as EvmWalletScanEvaluationInput;

    const sentinel = Symbol("unset");
    let output: unknown = sentinel;
    let thrown: unknown;

    try {
      output = buildWalletLayer4Output(invalidInput);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(output).toBe(sentinel);
  });
});
