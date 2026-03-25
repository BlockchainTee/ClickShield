import { describe, expect, it } from "vitest";

import {
  evaluateBitcoinWalletScan,
  type BitcoinAddressSummaryInput,
  type BitcoinHygieneRecordInput,
  type BitcoinUtxoSummaryInput,
  type BitcoinWalletScanEvaluationInput,
  type WalletScanRequest,
  type WalletScanSnapshot,
  type WalletSnapshotSection,
} from "../../src/index.js";

const WALLET_ADDRESS = "BC1QCLICKSHIELDMAINWALLET000000000000000000000";
const NORMALIZED_WALLET_ADDRESS = WALLET_ADDRESS.toLowerCase();
const CAPTURED_AT = "2026-03-23T12:00:00.000Z";
const EVALUATED_AT = "2026-03-23T12:05:00.000Z";

function buildBitcoinAddress(seed: number): string {
  return `bc1qclickshieldseed${String(seed).padStart(4, "0")}walletaddress0000000000`;
}

function createSections(): readonly WalletSnapshotSection[] {
  return [
    {
      sectionId: "section_btc_addresses",
      sectionType: "bitcoin_addresses",
      label: "Bitcoin addresses",
      itemCount: 0,
      contentHash: "hash_btc_addresses",
      metadata: {},
    },
    {
      sectionId: "section_btc_utxos",
      sectionType: "bitcoin_utxos",
      label: "Bitcoin utxos",
      itemCount: 0,
      contentHash: "hash_btc_utxos",
      metadata: {},
    },
    {
      sectionId: "section_btc_hygiene",
      sectionType: "bitcoin_hygiene",
      label: "Bitcoin hygiene",
      itemCount: 0,
      contentHash: "hash_btc_hygiene",
      metadata: {},
    },
  ];
}

function createRequest(): WalletScanRequest {
  return {
    requestId: "request_btc_phase4e",
    walletChain: "bitcoin",
    walletAddress: WALLET_ADDRESS,
    networkId: "bitcoin-mainnet",
    scanMode: "basic",
    requestedAt: CAPTURED_AT,
    metadata: {
      source: "test",
    },
  };
}

function createSnapshot(request: WalletScanRequest): WalletScanSnapshot {
  return {
    snapshotId: "snapshot_btc_phase4e",
    requestId: request.requestId,
    walletChain: request.walletChain,
    walletAddress: request.walletAddress,
    networkId: request.networkId,
    capturedAt: CAPTURED_AT,
    sections: createSections(),
    metadata: {
      source: "test",
    },
  };
}

function createInput(overrides?: {
  readonly addresses?: readonly BitcoinAddressSummaryInput[];
  readonly utxos?: readonly BitcoinUtxoSummaryInput[];
  readonly hygieneRecords?: readonly BitcoinHygieneRecordInput[];
  readonly requestWalletChain?: WalletScanRequest["walletChain"];
  readonly snapshotWalletChain?: WalletScanSnapshot["walletChain"];
  readonly sections?: readonly WalletSnapshotSection[];
  readonly scanMode?: WalletScanRequest["scanMode"];
  readonly requestId?: WalletScanRequest["requestId"];
  readonly snapshotRequestId?: WalletScanSnapshot["requestId"];
  readonly requestWalletAddress?: WalletScanRequest["walletAddress"];
  readonly snapshotWalletAddress?: WalletScanSnapshot["walletAddress"];
  readonly requestNetworkId?: WalletScanRequest["networkId"];
  readonly snapshotNetworkId?: WalletScanSnapshot["networkId"];
}): BitcoinWalletScanEvaluationInput {
  const request = {
    ...createRequest(),
    walletChain: overrides?.requestWalletChain ?? "bitcoin",
    requestId: overrides?.requestId ?? "request_btc_phase4e",
    walletAddress: overrides?.requestWalletAddress ?? WALLET_ADDRESS,
    networkId: overrides?.requestNetworkId ?? "bitcoin-mainnet",
    scanMode: overrides?.scanMode ?? "basic",
  };

  return {
    request,
    snapshot: {
      ...createSnapshot(request),
      walletChain: overrides?.snapshotWalletChain ?? "bitcoin",
      requestId: overrides?.snapshotRequestId ?? request.requestId,
      walletAddress: overrides?.snapshotWalletAddress ?? request.walletAddress,
      networkId: overrides?.snapshotNetworkId ?? request.networkId,
      sections: overrides?.sections ?? createSections(),
    },
    hydratedSnapshot: {
      addresses: overrides?.addresses ?? [],
      utxos: overrides?.utxos ?? [],
      hygieneRecords: overrides?.hygieneRecords ?? [],
      metadata: {
        source: "test",
      },
    },
    evaluatedAt: EVALUATED_AT,
  };
}

function listFindingCodes(
  evaluation: ReturnType<typeof evaluateBitcoinWalletScan>
): readonly string[] {
  return evaluation.result.findings.map((finding) => finding.metadata.code ?? "");
}

describe("Layer 4 Phase 4E Bitcoin scan foundation", () => {
  it("rejects malformed Bitcoin request wallet addresses fail-safe", () => {
    expect(() =>
      evaluateBitcoinWalletScan(
        createInput({
          requestWalletAddress: "not-a-bitcoin-address",
        })
      )
    ).toThrowError(
      "Bitcoin wallet evaluation requires request.walletAddress to be a valid Bitcoin address."
    );
  });

  it("rejects request and snapshot requestId mismatches before cleanup planning", () => {
    expect(() =>
      evaluateBitcoinWalletScan(
        createInput({
          snapshotRequestId: "snapshot_btc_other_request",
          hygieneRecords: [
            {
              issueType: "poor_hygiene",
              riskLevel: "high",
              note: "Shared support address remains active.",
            },
          ],
        })
      )
    ).toThrowError(
      "Bitcoin wallet evaluation requires request and snapshot requestId values to match."
    );
  });

  it("rejects request and snapshot wallet mismatches before cleanup planning", () => {
    expect(() =>
      evaluateBitcoinWalletScan(
        createInput({
          snapshotWalletAddress: buildBitcoinAddress(99),
          addresses: [
            {
              address: buildBitcoinAddress(98),
              addressType: "segwit",
              role: "receive",
              receiveCount: 4,
              reuseCount: 3,
              exposedPublicly: true,
              balanceSats: "250000",
            },
          ],
          utxos: [
            {
              txid: "9".repeat(64),
              vout: 0,
              address: buildBitcoinAddress(98),
              valueSats: "250000",
            },
          ],
        })
      )
    ).toThrowError(
      "Bitcoin wallet evaluation requires request and snapshot walletAddress values to match."
    );
  });

  it("rejects request and snapshot network mismatches fail-safe", () => {
    expect(() =>
      evaluateBitcoinWalletScan(
        createInput({
          snapshotNetworkId: "bitcoin-testnet",
        })
      )
    ).toThrowError(
      "Bitcoin wallet evaluation requires request and snapshot networkId values to match."
    );
  });

  it("coerces unsupported full scan requests to truthful basic scope", () => {
    const coerced = evaluateBitcoinWalletScan(
      createInput({
        scanMode: "full",
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
      })
    );
    const basic = evaluateBitcoinWalletScan(
      createInput({
        scanMode: "basic",
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
      })
    );

    expect(coerced.summary.scanMode).toBe("basic");
    expect(coerced.report.summary.scanMode).toBe("basic");
    expect(coerced.report.request.scanMode).toBe("basic");
    expect(coerced.report.request).toEqual(basic.report.request);
    expect(coerced.report.result).toEqual(basic.report.result);
    expect(coerced.report.summary).toEqual(basic.report.summary);
    expect(coerced.report.cleanupExecution).toBeNull();
    expect(coerced.report.result.capabilityBoundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "cleanup_plan",
          capabilityKey: "deterministic_bitcoin_guidance",
          status: "supported",
        }),
        expect.objectContaining({
          area: "cleanup_execution",
          capabilityKey: "bitcoin_cleanup_execution",
          status: "not_supported",
        }),
      ])
    );
    expect(
      coerced.report.result.cleanupPlan?.actions.every(
        (action) =>
          action.supportStatus === "partial" &&
          action.executionMode === "manual" &&
          action.executionType === "manual_review" &&
          action.status === "planned" &&
          action.kind !== "revoke_authorization" &&
          action.supportDetail.includes("does not construct transactions")
      )
    ).toBe(true);
    expect(coerced.report.reportId).toBe(basic.report.reportId);
  });

  it("rejects non-Bitcoin request chain input before report assembly", () => {
    expect(() =>
      evaluateBitcoinWalletScan(
        createInput({
          requestWalletChain: "evm",
        })
      )
    ).toThrowError(
      'Bitcoin wallet evaluation requires request.walletChain to be "bitcoin"; received "evm".'
    );
  });

  it("rejects non-Bitcoin snapshot chain input before report assembly", () => {
    expect(() =>
      evaluateBitcoinWalletScan(
        createInput({
          snapshotWalletChain: "solana",
        })
      )
    ).toThrowError(
      'Bitcoin wallet evaluation requires snapshot.walletChain to be "bitcoin"; received "solana".'
    );
  });

  it("returns a clean result for a safe Bitcoin wallet snapshot", () => {
    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        addresses: [
          {
            address: buildBitcoinAddress(1),
            addressType: "segwit",
            role: "receive",
            receiveCount: 1,
            balanceSats: "450000",
          },
          {
            address: buildBitcoinAddress(2),
            addressType: "segwit",
            role: "change",
            spendCount: 1,
            balanceSats: "350000",
          },
        ],
        utxos: [
          {
            txid: "a".repeat(64),
            vout: 0,
            address: buildBitcoinAddress(1),
            valueSats: "450000",
          },
          {
            txid: "b".repeat(64),
            vout: 1,
            address: buildBitcoinAddress(2),
            valueSats: "350000",
          },
        ],
      })
    );

    expect(evaluation.score).toBe(100);
    expect(evaluation.riskLevel).toBe("low");
    expect(evaluation.result.findings).toHaveLength(0);
    expect(evaluation.result.riskFactors).toHaveLength(0);
    expect(evaluation.result.cleanupPlan).toBeNull();
    expect(evaluation.result.walletAddress).toBe(NORMALIZED_WALLET_ADDRESS);
    expect(evaluation.report.request.walletAddress).toBe(NORMALIZED_WALLET_ADDRESS);
  });

  it("detects Bitcoin address reuse exposure deterministically", () => {
    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        addresses: [
          {
            address: buildBitcoinAddress(3),
            addressType: "segwit",
            role: "receive",
            receiveCount: 3,
            reuseCount: 2,
            balanceSats: "200000",
          },
        ],
        utxos: [
          {
            txid: "c".repeat(64),
            vout: 0,
            address: buildBitcoinAddress(3),
            valueSats: "200000",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "BITCOIN_ADDRESS_REUSE_EXPOSURE",
    ]);
    expect(evaluation.score).toBe(92);
    expect(evaluation.riskLevel).toBe("medium");
    expect(evaluation.result.cleanupPlan?.actions[0]?.metadata.recommendationType).toBe(
      "rotate_address"
    );
  });

  it("detects Bitcoin privacy exposure from public address visibility", () => {
    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        addresses: [
          {
            address: buildBitcoinAddress(4),
            addressType: "taproot",
            role: "receive",
            receiveCount: 1,
            exposedPublicly: true,
            balanceSats: "500000",
          },
        ],
        utxos: [
          {
            txid: "d".repeat(64),
            vout: 0,
            address: buildBitcoinAddress(4),
            valueSats: "500000",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "BITCOIN_PRIVACY_EXPOSURE",
    ]);
    expect(evaluation.score).toBe(93);
    expect(evaluation.riskLevel).toBe("medium");
  });

  it("does not use generic sections as Bitcoin fallback evidence", () => {
    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        sections: [
          {
            sectionId: "section_generic_addresses",
            sectionType: "addresses",
            label: "Addresses",
            itemCount: 0,
            contentHash: "hash_generic_addresses",
            metadata: {},
          },
          {
            sectionId: "section_generic_privacy",
            sectionType: "privacy",
            label: "Privacy",
            itemCount: 0,
            contentHash: "hash_generic_privacy",
            metadata: {},
          },
        ],
        addresses: [
          {
            address: buildBitcoinAddress(5),
            addressType: "segwit",
            role: "receive",
            receiveCount: 4,
            reuseCount: 3,
            exposedPublicly: true,
            balanceSats: "250000",
          },
        ],
        utxos: [
          {
            txid: "g".repeat(64),
            vout: 0,
            address: buildBitcoinAddress(5),
            valueSats: "250000",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "BITCOIN_ADDRESS_REUSE_EXPOSURE",
      "BITCOIN_PRIVACY_EXPOSURE",
      "BITCOIN_REPEATED_EXPOSED_RECEIVE_BEHAVIOR",
    ]);
    expect(
      evaluation.result.findings.every((finding) =>
        finding.evidence.every((evidence) => evidence.sourceType === "derived")
      )
    ).toBe(true);
  });

  it("does not use foreign-chain sections as Bitcoin fallback evidence", () => {
    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        sections: [
          {
            sectionId: "section_evm_btc_addresses",
            sectionType: "evm_btc_addresses",
            label: "EVM BTC Addresses",
            itemCount: 0,
            contentHash: "hash_evm_btc_addresses",
            metadata: {},
          },
          {
            sectionId: "section_solana_btc_addresses",
            sectionType: "solana_btc_addresses",
            label: "Solana BTC Addresses",
            itemCount: 0,
            contentHash: "hash_solana_btc_addresses",
            metadata: {},
          },
          {
            sectionId: "section_solana_btc_privacy",
            sectionType: "solana_btc_privacy",
            label: "Solana BTC Privacy",
            itemCount: 0,
            contentHash: "hash_solana_btc_privacy",
            metadata: {},
          },
        ],
        addresses: [
          {
            address: buildBitcoinAddress(52),
            addressType: "segwit",
            role: "receive",
            receiveCount: 4,
            reuseCount: 3,
            exposedPublicly: true,
            balanceSats: "250000",
          },
        ],
        utxos: [
          {
            txid: "8".repeat(64),
            vout: 0,
            address: buildBitcoinAddress(52),
            valueSats: "250000",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "BITCOIN_ADDRESS_REUSE_EXPOSURE",
      "BITCOIN_PRIVACY_EXPOSURE",
      "BITCOIN_REPEATED_EXPOSED_RECEIVE_BEHAVIOR",
    ]);
    expect(
      evaluation.result.findings.every((finding) =>
        finding.evidence.every((evidence) => evidence.sourceType === "derived")
      )
    ).toBe(true);
  });

  it("uses Bitcoin-specific sections for fallback evidence when sourceSectionId is absent", () => {
    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        sections: [
          {
            sectionId: "section_generic_addresses",
            sectionType: "addresses",
            label: "Addresses",
            itemCount: 0,
            contentHash: "hash_generic_addresses",
            metadata: {},
          },
          {
            sectionId: "section_btc_addresses",
            sectionType: "bitcoin_addresses",
            label: "Bitcoin addresses",
            itemCount: 0,
            contentHash: "hash_btc_addresses",
            metadata: {},
          },
          {
            sectionId: "section_generic_privacy",
            sectionType: "privacy",
            label: "Privacy",
            itemCount: 0,
            contentHash: "hash_generic_privacy",
            metadata: {},
          },
          {
            sectionId: "section_btc_hygiene",
            sectionType: "bitcoin_hygiene",
            label: "Bitcoin hygiene",
            itemCount: 0,
            contentHash: "hash_btc_hygiene",
            metadata: {},
          },
        ],
        addresses: [
          {
            address: buildBitcoinAddress(6),
            addressType: "segwit",
            role: "receive",
            receiveCount: 4,
            reuseCount: 3,
            exposedPublicly: true,
            balanceSats: "250000",
          },
        ],
        utxos: [
          {
            txid: "h".repeat(64),
            vout: 0,
            address: buildBitcoinAddress(6),
            valueSats: "250000",
          },
        ],
      })
    );

    const privacyFinding = evaluation.result.findings.find(
      (finding) => finding.metadata.code === "BITCOIN_PRIVACY_EXPOSURE"
    );

    expect(privacyFinding?.evidence.some((evidence) => evidence.sourceId === "section_btc_addresses")).toBe(true);
    expect(
      privacyFinding?.evidence.some(
        (evidence) => evidence.sourceId === "section_generic_privacy"
      )
    ).toBe(false);
  });

  it("detects fragmented Bitcoin UTXO structure", () => {
    const utxos: BitcoinUtxoSummaryInput[] = Array.from({ length: 10 }, (_, index) => ({
      txid: `${String(index).padStart(2, "0")}fragment`.padEnd(64, "f"),
      vout: index,
      address: buildBitcoinAddress(10 + index),
      valueSats: "1000",
    }));

    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        utxos,
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "BITCOIN_FRAGMENTED_UTXO_STRUCTURE",
    ]);
    expect(evaluation.score).toBe(80);
    expect(evaluation.riskLevel).toBe("high");
    expect(evaluation.result.cleanupPlan?.actions[0]?.metadata.recommendationType).toBe(
      "consolidate_utxos"
    );
  });

  it("detects concentrated Bitcoin UTXO structure", () => {
    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        utxos: [
          {
            txid: "e".repeat(64),
            vout: 0,
            address: buildBitcoinAddress(21),
            valueSats: "950000",
          },
          {
            txid: "f".repeat(64),
            vout: 1,
            address: buildBitcoinAddress(22),
            valueSats: "50000",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "BITCOIN_CONCENTRATED_UTXO_STRUCTURE",
    ]);
    expect(evaluation.score).toBe(85);
    expect(evaluation.riskLevel).toBe("high");
    expect(evaluation.result.cleanupPlan?.actions[0]?.metadata.recommendationType).toBe(
      "move_funds"
    );
  });

  it("detects caller-supplied poor wallet hygiene exposure", () => {
    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        hygieneRecords: [
          {
            issueType: "poor_hygiene",
            riskLevel: "high",
            note: "Shared donation address is still used for routine deposits.",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "BITCOIN_POOR_WALLET_HYGIENE",
    ]);
    expect(evaluation.score).toBe(93);
    expect(evaluation.riskLevel).toBe("high");
  });

  it("detects repeated exposed address behavior without non-Bitcoin semantics", () => {
    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        addresses: [
          {
            address: buildBitcoinAddress(30),
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
            txid: "1".repeat(64),
            vout: 0,
            address: buildBitcoinAddress(30),
            valueSats: "300000",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "BITCOIN_ADDRESS_REUSE_EXPOSURE",
      "BITCOIN_PRIVACY_EXPOSURE",
      "BITCOIN_REPEATED_EXPOSED_RECEIVE_BEHAVIOR",
    ]);
    expect(evaluation.score).toBe(77);
    expect(evaluation.riskLevel).toBe("high");
    expect(
      evaluation.result.findings.every(
        (finding) =>
          finding.walletChain === "bitcoin" &&
          !finding.title.toLowerCase().includes("approval") &&
          !finding.title.toLowerCase().includes("authority")
      )
    ).toBe(true);
  });

  it("produces consistent score and report output for identical Bitcoin input", () => {
    const input = createInput({
      addresses: [
        {
          address: buildBitcoinAddress(40),
          addressType: "segwit",
          role: "receive",
          receiveCount: 2,
          reuseCount: 1,
          balanceSats: "220000",
        },
      ],
      utxos: [
        {
          txid: "2".repeat(64),
          vout: 0,
          address: buildBitcoinAddress(40),
          valueSats: "220000",
        },
      ],
      hygieneRecords: [
        {
          issueType: "poor_hygiene",
          note: "Routine receive address reuse documented in wallet ops.",
        },
      ],
    });

    const first = evaluateBitcoinWalletScan(input);
    const second = evaluateBitcoinWalletScan(input);

    expect(first).toEqual(second);
    expect(first.report.reportId).toBe(second.report.reportId);
    expect(first.normalizedSnapshot.addresses[0]?.resourceId).toBe(
      second.normalizedSnapshot.addresses[0]?.resourceId
    );
  });

  it("keeps remediation guidance manual-only with no EVM or Solana leakage", () => {
    const evaluation = evaluateBitcoinWalletScan(
      createInput({
        addresses: [
          {
            address: buildBitcoinAddress(50),
            addressType: "segwit",
            role: "receive",
            receiveCount: 4,
            reuseCount: 3,
            exposedPublicly: true,
            balanceSats: "310000",
          },
        ],
        utxos: Array.from({ length: 10 }, (_, index) => ({
          txid: `${String(index).padStart(2, "0")}manual`.padEnd(64, "c"),
          vout: index,
          address: buildBitcoinAddress(60 + index),
          valueSats: "1000",
        })),
        hygieneRecords: [
          {
            issueType: "poor_hygiene",
            riskLevel: "medium",
            note: "Public support address remains in routine operational use.",
          },
        ],
      })
    );

    expect(evaluation.result.cleanupPlan).not.toBeNull();
    expect(
      evaluation.result.cleanupPlan?.actions.every((action) => {
        const text = `${action.title} ${action.description}`.toLowerCase();
        return (
          action.walletChain === "bitcoin" &&
          action.executionMode === "manual" &&
          action.executionType === "manual_review" &&
          action.status === "planned" &&
          action.requiresSignature === false &&
          action.supportStatus === "partial" &&
          action.kind !== "revoke_authorization" &&
          !text.includes("approve(") &&
          !text.includes("erc") &&
          !text.includes("authority") &&
          !text.includes("delegate") &&
          !text.includes("disconnect") &&
          !text.includes("solana") &&
          !text.includes("revoke")
        );
      })
    ).toBe(true);
  });
});
