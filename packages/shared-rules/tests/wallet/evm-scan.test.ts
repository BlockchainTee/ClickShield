import { describe, expect, it } from "vitest";

import {
  evaluateEvmWalletScan,
  type EvmApprovalRecordInput,
  type EvmContractExposureInput,
  type EvmSpenderRiskInput,
  type EvmWalletScanEvaluationInput,
  type WalletScanRequest,
  type WalletScanSnapshot,
  type WalletSnapshotSection,
} from "../../src/index.js";

const WALLET_ADDRESS = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const NORMALIZED_WALLET_ADDRESS = WALLET_ADDRESS.toLowerCase();
const CAPTURED_AT = "2026-03-23T12:00:00.000Z";
const EVALUATED_AT = "2026-03-23T12:05:00.000Z";
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

function repeatHexPair(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function buildAddress(seed: number): string {
  return `0x${repeatHexPair(seed).repeat(20)}`;
}

function createSections(): readonly WalletSnapshotSection[] {
  return [
    {
      sectionId: "section_evm_approvals",
      sectionType: "evm_approvals",
      label: "EVM approvals",
      itemCount: 0,
      contentHash: "hash_approvals",
      metadata: {},
    },
    {
      sectionId: "section_evm_spenders",
      sectionType: "evm_spenders",
      label: "EVM spender risk",
      itemCount: 0,
      contentHash: "hash_spenders",
      metadata: {},
    },
    {
      sectionId: "section_evm_contracts",
      sectionType: "evm_contract_exposures",
      label: "EVM contract exposure",
      itemCount: 0,
      contentHash: "hash_contracts",
      metadata: {},
    },
  ];
}

function createRequest(
  scanMode: WalletScanRequest["scanMode"] = "full"
): WalletScanRequest {
  return {
    requestId: "request_evm_phase4b",
    walletChain: "evm",
    walletAddress: WALLET_ADDRESS,
    networkId: "1",
    scanMode,
    requestedAt: "2026-03-23T12:00:00.000Z",
    metadata: {
      source: "test",
    },
  };
}

function createSnapshot(request: WalletScanRequest): WalletScanSnapshot {
  return {
    snapshotId: "snapshot_evm_phase4b",
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
  readonly approvals?: readonly EvmApprovalRecordInput[];
  readonly spenders?: readonly EvmSpenderRiskInput[];
  readonly contractExposures?: readonly EvmContractExposureInput[];
  readonly scanMode?: WalletScanRequest["scanMode"];
  readonly requestWalletAddress?: WalletScanRequest["walletAddress"];
  readonly snapshotWalletAddress?: WalletScanSnapshot["walletAddress"];
}): EvmWalletScanEvaluationInput {
  const request = {
    ...createRequest(overrides?.scanMode),
    walletAddress: overrides?.requestWalletAddress ?? WALLET_ADDRESS,
  };

  return {
    request,
    snapshot: {
      ...createSnapshot(request),
      walletAddress: overrides?.snapshotWalletAddress ?? request.walletAddress,
    },
    hydratedSnapshot: {
      approvals: overrides?.approvals ?? [],
      spenders: overrides?.spenders ?? [],
      contractExposures: overrides?.contractExposures ?? [],
      metadata: {
        source: "test",
      },
    },
    evaluatedAt: EVALUATED_AT,
  };
}

function listFindingCodes(
  input: ReturnType<typeof evaluateEvmWalletScan>
): readonly string[] {
  return input.result.findings.map((finding) => finding.metadata.code ?? "");
}

describe("Layer 4 Phase 4B EVM scan foundation", () => {
  it("rejects malformed request wallet addresses at normalize time", () => {
    expect(() =>
      evaluateEvmWalletScan(
        createInput({
          requestWalletAddress: "0x1234",
        })
      )
    ).toThrowError(
      "EVM wallet evaluation requires request.walletAddress to be a valid EVM address."
    );
  });

  it("rejects malformed snapshot wallet addresses at normalize time", () => {
    expect(() =>
      evaluateEvmWalletScan(
        createInput({
          snapshotWalletAddress: "not-an-evm-address",
        })
      )
    ).toThrowError(
      "EVM wallet evaluation requires snapshot.walletAddress to be a valid EVM address."
    );
  });

  it("preserves both supported EVM scan modes in the final report", () => {
    const fullEvaluation = evaluateEvmWalletScan(
      createInput({
        scanMode: "full",
        approvals: [
          {
            tokenStandard: "erc20",
            tokenAddress: buildAddress(250),
            spenderAddress: buildAddress(251),
            amount: MAX_UINT256,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })
    );
    const basicEvaluation = evaluateEvmWalletScan(
      createInput({
        scanMode: "basic",
        approvals: [
          {
            tokenStandard: "erc20",
            tokenAddress: buildAddress(250),
            spenderAddress: buildAddress(251),
            amount: MAX_UINT256,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })
    );

    expect(fullEvaluation.summary.scanMode).toBe("full");
    expect(fullEvaluation.summary.capabilityTier).toBe("full");
    expect(fullEvaluation.report.summary.scanMode).toBe("full");
    expect(fullEvaluation.report.summary.capabilityTier).toBe("full");
    expect(fullEvaluation.report.request.scanMode).toBe("full");
    expect(basicEvaluation.summary.scanMode).toBe("basic");
    expect(basicEvaluation.summary.capabilityTier).toBe("basic");
    expect(basicEvaluation.report.request.scanMode).toBe("basic");
    expect(fullEvaluation.report.result.executionPerformed).toBe(false);
    expect(basicEvaluation.report.result.executionPerformed).toBe(false);
    expect(fullEvaluation.report.result.actionable).toBe(true);
    expect(basicEvaluation.report.result.actionable).toBe(true);
    expect(fullEvaluation.report.result.classification).toBe("issues_detected");
    expect(basicEvaluation.report.result.classification).toBe("issues_detected");
    expect(fullEvaluation.report.result.statusLabel).toBe(
      "Scan completed. Issues detected. Follow-up action is available."
    );
    expect(basicEvaluation.report.result.statusLabel).toBe(
      "Scan completed. Issues detected. Follow-up action is available."
    );
    expect(fullEvaluation.report.result.statusLabel).not.toMatch(
      /\b(cleaned|resolved|fixed)\b/i
    );
    expect(basicEvaluation.report.result.statusLabel).not.toMatch(
      /\b(cleanup|cleaned|resolved|fixed)\b/i
    );
    expect(fullEvaluation.report.result.cleanupPlan?.actions[0]?.supportStatus).toBe(
      "supported"
    );
    expect(fullEvaluation.report.result.cleanupPlan?.actions[0]?.executionType).toBe(
      "wallet_signature"
    );
    expect(fullEvaluation.report.result.capabilityBoundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          area: "cleanup_plan",
          capabilityKey: "deterministic_evm_cleanup_plan",
          status: "supported",
        }),
        expect.objectContaining({
          area: "cleanup_execution",
          capabilityKey: "evm_cleanup_execution",
          status: "partial",
        }),
      ])
    );
    expect(fullEvaluation.report.reportId).not.toBe(basicEvaluation.report.reportId);
  });

  it("returns a clean result for a safe wallet snapshot", () => {
    const evaluation = evaluateEvmWalletScan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc20",
            tokenAddress: buildAddress(1),
            spenderAddress: buildAddress(2),
            amount: "1000",
            approvedAt: "2026-03-20T12:00:00.000Z",
          },
        ],
        spenders: [
          {
            spenderAddress: buildAddress(2),
            trusted: true,
            label: "Trusted router",
          },
        ],
      })
    );

    expect(evaluation.score).toBe(100);
    expect(evaluation.riskLevel).toBe("low");
    expect(evaluation.result.findings).toHaveLength(0);
    expect(evaluation.result.riskFactors).toHaveLength(0);
    expect(evaluation.result.cleanupPlan).toBeNull();
    expect(evaluation.result.classification).toBe("no_issues_detected");
    expect(evaluation.result.statusLabel).toBe("Scan completed. No issues detected.");
    expect(evaluation.result.walletAddress).toBe(NORMALIZED_WALLET_ADDRESS);
    expect(evaluation.report.request.walletAddress).toBe(NORMALIZED_WALLET_ADDRESS);
  });

  it("flags unlimited approvals to unknown spenders deterministically", () => {
    const evaluation = evaluateEvmWalletScan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc20",
            tokenAddress: buildAddress(3),
            spenderAddress: buildAddress(4),
            amount: MAX_UINT256,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual(["EVM_UNLIMITED_APPROVAL_EXPOSURE"]);
    expect(evaluation.score).toBe(84);
    expect(evaluation.riskLevel).toBe("high");
    expect(evaluation.result.cleanupPlan?.actions).toHaveLength(1);
  });

  it("detects stale approvals using the fixed age threshold", () => {
    const evaluation = evaluateEvmWalletScan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc20",
            tokenAddress: buildAddress(5),
            spenderAddress: buildAddress(6),
            amount: "250",
            approvedAt: "2025-11-01T12:00:00.000Z",
          },
        ],
        spenders: [
          {
            spenderAddress: buildAddress(6),
            trusted: true,
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual(["EVM_STALE_APPROVAL_EXPOSURE"]);
    expect(evaluation.score).toBe(95);
    expect(evaluation.riskLevel).toBe("medium");
  });

  it("detects excessive approval counts without mixing in other chains", () => {
    const approvals: EvmApprovalRecordInput[] = Array.from({ length: 10 }, (_, index) => ({
      tokenStandard: "erc20",
      tokenAddress: buildAddress(index + 10),
      spenderAddress: buildAddress(index + 40),
      amount: "1",
      approvedAt: "2026-03-22T12:00:00.000Z",
    }));

    const evaluation = evaluateEvmWalletScan(createInput({ approvals }));

    expect(listFindingCodes(evaluation)).toEqual(["EVM_EXCESSIVE_APPROVALS"]);
    expect(evaluation.score).toBe(92);
    expect(evaluation.riskLevel).toBe("medium");
  });

  it("excludes revoked ERC-721 token approvals from active approval output", () => {
    const revokedTokenApprovals: EvmApprovalRecordInput[] = Array.from(
      { length: 10 },
      (_, index) => ({
        tokenStandard: "erc721",
        tokenAddress: buildAddress(index + 100),
        spenderAddress: buildAddress(index + 120),
        tokenId: String(index + 1),
        isApproved: false,
        approvedAt: "2026-03-22T12:00:00.000Z",
      })
    );

    const revokedOnlyEvaluation = evaluateEvmWalletScan(
      createInput({
        approvals: revokedTokenApprovals,
      })
    );

    expect(revokedOnlyEvaluation.normalizedSnapshot.approvals).toHaveLength(0);
    expect(revokedOnlyEvaluation.signals.approvalCount).toBe(0);
    expect(listFindingCodes(revokedOnlyEvaluation)).toEqual([]);
    expect(revokedOnlyEvaluation.score).toBe(100);
    expect(revokedOnlyEvaluation.result.cleanupPlan).toBeNull();

    const mixedEvaluation = evaluateEvmWalletScan(
      createInput({
        approvals: [
          ...revokedTokenApprovals,
          {
            tokenStandard: "erc721",
            tokenAddress: buildAddress(200),
            spenderAddress: buildAddress(201),
            tokenId: "999",
            isApproved: true,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })
    );

    expect(mixedEvaluation.normalizedSnapshot.approvals).toHaveLength(1);
    expect(mixedEvaluation.signals.approvalCount).toBe(1);
    expect(mixedEvaluation.normalizedSnapshot.approvals[0]?.approvalKind).toBe(
      "erc721_token"
    );
    expect(listFindingCodes(mixedEvaluation)).toEqual([]);
    expect(mixedEvaluation.score).toBe(100);
  });

  it("captures flagged spender and risky contract exposure in the same scan", () => {
    const evaluation = evaluateEvmWalletScan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc721",
            tokenAddress: buildAddress(70),
            spenderAddress: buildAddress(71),
            isApproved: true,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
        spenders: [
          {
            spenderAddress: buildAddress(71),
            riskLevel: "critical",
            flags: ["drainer"],
            label: "Known drainer",
          },
        ],
        contractExposures: [
          {
            contractAddress: buildAddress(70),
            exposureType: "token_contract",
            riskLevel: "high",
            flags: ["exploit"],
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "EVM_FLAGGED_SPENDER_EXPOSURE",
      "EVM_RISKY_CONTRACT_EXPOSURE",
      "EVM_UNLIMITED_APPROVAL_EXPOSURE",
    ]);
    expect(evaluation.score).toBe(68);
    expect(evaluation.riskLevel).toBe("critical");
    expect(evaluation.result.cleanupPlan?.actions).toHaveLength(1);
  });

  it("produces consistent score and report output for identical input", () => {
    const input = createInput({
      approvals: [
        {
          tokenStandard: "erc20",
          tokenAddress: buildAddress(90),
          spenderAddress: buildAddress(91),
          amount: MAX_UINT256,
          approvedAt: "2026-03-22T12:00:00.000Z",
        },
      ],
    });

    const first = evaluateEvmWalletScan(input);
    const second = evaluateEvmWalletScan(input);

    expect(first).toEqual(second);
    expect(first.report.reportId).toBe(second.report.reportId);
  });
});
