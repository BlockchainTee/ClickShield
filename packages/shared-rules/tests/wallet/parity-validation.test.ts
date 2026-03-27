import { describe, expect, it } from "vitest";

import {
  evaluateBitcoinWalletScan,
  evaluateEvmWalletScan,
  evaluateSolanaWalletScan,
  type BitcoinWalletScanEvaluationInput,
  type EvmWalletScanEvaluationInput,
  type SolanaWalletScanEvaluationInput,
  type WalletReport,
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
        source: "parity-test",
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
        source: "parity-test",
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
        source: "parity-test",
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
        source: "parity-test",
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
        source: "parity-test",
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
        source: "parity-test",
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
        source: "parity-test",
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
        source: "parity-test",
      },
    },
    hydratedSnapshot: {
      addresses: [
        {
          address: buildBitcoinAddress(10),
          addressType: "segwit",
          role: "receive",
          receiveCount: 3,
          reuseCount: 2,
          exposedPublicly: true,
          balanceSats: "250000",
        },
      ],
      utxos: [
        {
          txid: "1".repeat(64),
          vout: 0,
          address: buildBitcoinAddress(10),
          valueSats: "250000",
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
        source: "parity-test",
      },
    },
    evaluatedAt: EVALUATED_AT,
  };
}

function expectSharedTruthFields(
  report: WalletReport,
  expectedTier: WalletScanMode,
  expectedClassification: WalletReport["result"]["classification"],
  expectedStatusLabel: string
): void {
  expect(report.result.capabilityTier).toBe(expectedTier);
  expect(report.summary.capabilityTier).toBe(expectedTier);
  expect(report.result.executionPerformed).toBe(false);
  expect(report.summary.executionPerformed).toBe(false);
  expect(report.result.actionable).toBe(report.summary.actionable);
  expect(report.result.classification).toBe(expectedClassification);
  expect(report.summary.classification).toBe(expectedClassification);
  expect(report.result.statusLabel).toBe(expectedStatusLabel);
  expect(report.summary.statusLabel).toBe(expectedStatusLabel);
}

describe("Layer 4 parity validation", () => {
  it("enforces the wallet capability matrix without silent downgrade", () => {
    const evmFull = evaluateEvmWalletScan(createEvmInput("full"));
    const evmBasic = evaluateEvmWalletScan(createEvmInput("basic"));
    const solanaBasic = evaluateSolanaWalletScan(createSolanaInput("basic"));
    const bitcoinBasic = evaluateBitcoinWalletScan(createBitcoinInput("basic"));

    expect(evmFull.report.request.scanMode).toBe("full");
    expect(evmBasic.report.request.scanMode).toBe("basic");
    expect(solanaBasic.report.request.scanMode).toBe("basic");
    expect(bitcoinBasic.report.request.scanMode).toBe("basic");

    expect(() => evaluateSolanaWalletScan(createSolanaInput("full"))).toThrowError(
      'Layer 4 solana capability does not support request.scanMode "full"; supported values: "basic".'
    );
    expect(() => evaluateBitcoinWalletScan(createBitcoinInput("full"))).toThrowError(
      'Layer 4 bitcoin capability does not support request.scanMode "full"; supported values: "basic".'
    );
  });

  it("keeps the shared report truth fields aligned across all chains", () => {
    const evm = evaluateEvmWalletScan(createEvmInput("full"));
    const solana = evaluateSolanaWalletScan(createSolanaInput("basic"));
    const bitcoin = evaluateBitcoinWalletScan(createBitcoinInput("basic"));

    expectSharedTruthFields(
      evm.report,
      "full",
      "issues_detected",
      "Scan completed. Issues detected. Follow-up action is available."
    );
    expectSharedTruthFields(
      solana.report,
      "basic",
      "manual_action_required",
      "Scan completed. Issues detected. Manual action required."
    );
    expectSharedTruthFields(
      bitcoin.report,
      "basic",
      "manual_action_required",
      "Scan completed. Issues detected. Manual action required."
    );

    expect(evm.report.cleanupExecution).toBeNull();
    expect(solana.report.cleanupExecution).toBeNull();
    expect(bitcoin.report.cleanupExecution).toBeNull();
  });

  it("prevents executable cleanup claims on basic-only chains", () => {
    const solana = evaluateSolanaWalletScan(createSolanaInput("basic"));
    const bitcoin = evaluateBitcoinWalletScan(createBitcoinInput("basic"));

    expect(
      solana.report.result.cleanupPlan?.actions.every(
        (action) =>
          action.supportStatus === "partial" &&
          action.executionType === "manual_review" &&
          action.executionMode !== "automated" &&
          action.status === "planned"
      )
    ).toBe(true);
    expect(
      bitcoin.report.result.cleanupPlan?.actions.every(
        (action) =>
          action.supportStatus === "partial" &&
          action.executionType === "manual_review" &&
          action.executionMode !== "automated" &&
          action.status === "planned"
      )
    ).toBe(true);
  });

  it("produces stable report identities for identical evaluation input", () => {
    const evmFirst = evaluateEvmWalletScan(createEvmInput("full"));
    const evmSecond = evaluateEvmWalletScan(createEvmInput("full"));
    const solanaFirst = evaluateSolanaWalletScan(createSolanaInput("basic"));
    const solanaSecond = evaluateSolanaWalletScan(createSolanaInput("basic"));
    const bitcoinFirst = evaluateBitcoinWalletScan(createBitcoinInput("basic"));
    const bitcoinSecond = evaluateBitcoinWalletScan(createBitcoinInput("basic"));

    expect(evmFirst.report.reportId).toBe(evmSecond.report.reportId);
    expect(solanaFirst.report.reportId).toBe(solanaSecond.report.reportId);
    expect(bitcoinFirst.report.reportId).toBe(bitcoinSecond.report.reportId);
  });
});
