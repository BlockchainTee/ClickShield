import { describe, expect, it } from "vitest";

import {
  evaluateBitcoinWalletScan,
  evaluateEvmWalletScan,
  evaluateSolanaWalletScan,
  runWalletLayer4Scan,
  type BitcoinWalletScanEvaluationInput,
  type EvmWalletScanEvaluationInput,
  type SolanaWalletScanEvaluationInput,
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
        source: "orchestrator-test",
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
        source: "orchestrator-test",
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
        source: "orchestrator-test",
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
        source: "orchestrator-test",
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
        source: "orchestrator-test",
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
        source: "orchestrator-test",
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
        source: "orchestrator-test",
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
        source: "orchestrator-test",
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
        source: "orchestrator-test",
      },
    },
    evaluatedAt: EVALUATED_AT,
  };
}

describe("Layer 4 wallet runtime orchestrator", () => {
  it("dispatches EVM full requests to the EVM full-capable evaluator", () => {
    const input = createEvmInput("full");

    const runtimeEvaluation = runWalletLayer4Scan(input);
    const directEvaluation = evaluateEvmWalletScan(input);

    expect(runtimeEvaluation).toEqual(directEvaluation);
    expect(runtimeEvaluation.summary.capabilityTier).toBe("full");
    expect(runtimeEvaluation.report.request.scanMode).toBe("full");
  });

  it("dispatches EVM basic requests to the EVM basic-capable evaluator", () => {
    const input = createEvmInput("basic");

    const runtimeEvaluation = runWalletLayer4Scan(input);
    const directEvaluation = evaluateEvmWalletScan(input);

    expect(runtimeEvaluation).toEqual(directEvaluation);
    expect(runtimeEvaluation.summary.capabilityTier).toBe("basic");
    expect(runtimeEvaluation.report.request.scanMode).toBe("basic");
  });

  it("dispatches Solana basic requests to the Solana evaluator", () => {
    const input = createSolanaInput("basic");

    const runtimeEvaluation = runWalletLayer4Scan(input);
    const directEvaluation = evaluateSolanaWalletScan(input);

    expect(runtimeEvaluation).toEqual(directEvaluation);
    expect(runtimeEvaluation.report.request.walletChain).toBe("solana");
    expect(runtimeEvaluation.result.walletChain).toBe("solana");
  });

  it("dispatches Bitcoin basic requests to the Bitcoin evaluator", () => {
    const input = createBitcoinInput("basic");

    const runtimeEvaluation = runWalletLayer4Scan(input);
    const directEvaluation = evaluateBitcoinWalletScan(input);

    expect(runtimeEvaluation).toEqual(directEvaluation);
    expect(runtimeEvaluation.report.request.walletChain).toBe("bitcoin");
    expect(runtimeEvaluation.result.walletChain).toBe("bitcoin");
  });

  it("rejects unsupported Solana full requests explicitly", () => {
    expect(() => runWalletLayer4Scan(createSolanaInput("full"))).toThrowError(
      'Layer 4 solana capability does not support request.scanMode "full"; supported values: "basic".'
    );
  });

  it("rejects unsupported Bitcoin full requests explicitly", () => {
    expect(() => runWalletLayer4Scan(createBitcoinInput("full"))).toThrowError(
      'Layer 4 bitcoin capability does not support request.scanMode "full"; supported values: "basic".'
    );
  });

  it("rejects invalid request and snapshot contract mismatches before dispatch", () => {
    const input = createEvmInput("full");

    expect(() =>
      runWalletLayer4Scan({
        ...input,
        snapshot: {
          ...input.snapshot,
          walletChain: "bitcoin",
        },
      })
    ).toThrowError(
      "Layer 4 wallet runtime requires snapshot.walletChain to match request.walletChain before dispatch."
    );
  });

  it("dispatches repeated identical runs identically", () => {
    const input = createBitcoinInput("basic");

    const first = runWalletLayer4Scan(input);
    const second = runWalletLayer4Scan(input);

    expect(first).toEqual(second);
  });

  it("returns one truthful and stable result/report path", () => {
    const input = createSolanaInput("basic");

    const runtimeEvaluation = runWalletLayer4Scan(input);

    expect(runtimeEvaluation.result).toEqual(runtimeEvaluation.report.result);
    expect(runtimeEvaluation.summary).toEqual(runtimeEvaluation.report.summary);
    expect(runtimeEvaluation.report.request.walletChain).toBe(
      runtimeEvaluation.result.walletChain
    );
    expect(runtimeEvaluation.report.request.scanMode).toBe(
      runtimeEvaluation.result.capabilityTier
    );
  });
});
