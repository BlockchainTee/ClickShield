import { describe, expect, it } from "vitest";

import {
  evaluateEvmWalletScan,
  getEvmCleanupEligibility,
  interpretEvmCleanupExecutionResult,
  prepareEvmCleanupExecutionRequest,
  prepareEvmCleanupTransaction,
  reconcileEvmCleanupPlanResults,
  type EvmApprovalRecordInput,
  type EvmSpenderRiskInput,
  type EvmWalletCleanupPlan,
  type EvmWalletScanEvaluationInput,
  type NormalizedEvmApprovalState,
  type WalletScanRequest,
  type WalletScanSnapshot,
  type WalletSnapshotSection,
} from "../../src/index.js";

const WALLET_ADDRESS = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const CAPTURED_AT = "2026-03-23T12:00:00.000Z";
const EVALUATED_AT = "2026-03-23T12:05:00.000Z";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

function repeatHexPair(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function buildAddress(seed: number): string {
  return `0x${repeatHexPair(seed).repeat(20)}`;
}

function padWord(hexValue: string): string {
  return hexValue.padStart(64, "0");
}

function encodeAddressWord(address: string): string {
  return padWord(address.slice(2).toLowerCase());
}

function encodeUintWord(value: string): string {
  return padWord(BigInt(value).toString(16));
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
  ];
}

function createRequest(): WalletScanRequest {
  return {
    requestId: "request_evm_phase4c",
    walletChain: "evm",
    walletAddress: WALLET_ADDRESS,
    networkId: "1",
    scanMode: "full",
    requestedAt: CAPTURED_AT,
    metadata: {
      source: "test",
    },
  };
}

function createSnapshot(request: WalletScanRequest): WalletScanSnapshot {
  return {
    snapshotId: "snapshot_evm_phase4c",
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
}): EvmWalletScanEvaluationInput {
  const request = createRequest();

  return {
    request,
    snapshot: createSnapshot(request),
    hydratedSnapshot: {
      approvals: overrides?.approvals ?? [],
      spenders: overrides?.spenders ?? [],
      contractExposures: [],
      metadata: {
        source: "test",
      },
    },
    evaluatedAt: EVALUATED_AT,
  };
}

function getCleanupPlan(
  input: EvmWalletScanEvaluationInput
): EvmWalletCleanupPlan {
  const cleanupPlan = evaluateEvmWalletScan(input).result.cleanupPlan;
  expect(cleanupPlan).not.toBeNull();
  return cleanupPlan as EvmWalletCleanupPlan;
}

describe("Layer 4 Phase 4C EVM cleanup", () => {
  it("builds a revoke action for an active ERC-20 allowance", () => {
    const spenderAddress = buildAddress(2);
    const tokenAddress = buildAddress(1);
    const cleanupPlan = getCleanupPlan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc20",
            tokenAddress,
            spenderAddress,
            amount: MAX_UINT256,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })
    );

    expect(cleanupPlan.actions).toHaveLength(1);
    expect(cleanupPlan.actions[0]?.approval.approvalKind).toBe("erc20_allowance");
    expect(cleanupPlan.actions[0]?.revocationMethod).toBe("erc20_approve_zero");
    expect(cleanupPlan.actions[0]?.executionType).toBe("wallet_signature");
    expect(cleanupPlan.actions[0]?.requiresSignature).toBe(true);
    expect(cleanupPlan.actions[0]?.status).toBe("ready");
  });

  it("builds revoke actions for ERC-721 operator and token approvals", () => {
    const spenderAddress = buildAddress(12);
    const cleanupPlan = getCleanupPlan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc721",
            tokenAddress: buildAddress(10),
            spenderAddress,
            isApproved: true,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
          {
            tokenStandard: "erc721",
            tokenAddress: buildAddress(11),
            spenderAddress,
            tokenId: "42",
            isApproved: true,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
        spenders: [
          {
            spenderAddress,
            riskLevel: "critical",
            flags: ["drainer"],
          },
        ],
      })
    );

    expect(cleanupPlan.actions).toHaveLength(2);
    expect(cleanupPlan.actions[0]?.approval.approvalKind).toBe("erc721_operator");
    expect(cleanupPlan.actions[1]?.approval.approvalKind).toBe("erc721_token");
    expect(cleanupPlan.actions[0]?.revocationMethod).toBe(
      "erc721_set_approval_for_all_false"
    );
    expect(cleanupPlan.actions[1]?.revocationMethod).toBe("erc721_approve_zero");
  });

  it("does not produce cleanup actions for inactive approvals", () => {
    const evaluation = evaluateEvmWalletScan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc721",
            tokenAddress: buildAddress(20),
            spenderAddress: buildAddress(21),
            tokenId: "7",
            isApproved: false,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })
    );

    expect(evaluation.normalizedSnapshot.approvals).toHaveLength(0);
    expect(evaluation.result.cleanupPlan).toBeNull();
  });

  it("treats unsupported approval kinds as ineligible", () => {
    const unsupportedApproval = {
      approvalId: "approval_unsupported",
      walletAddress: WALLET_ADDRESS.toLowerCase(),
      tokenStandard: "erc20",
      approvalKind: "unsupported_kind",
      tokenAddress: buildAddress(30).toLowerCase(),
      spenderAddress: buildAddress(31).toLowerCase(),
      spenderDisposition: "unknown",
      spenderRiskLevel: null,
      spenderFlags: [],
      amount: "1",
      amountKind: "limited",
      tokenId: null,
      isUnlimited: false,
      approvedAt: null,
      ageDays: null,
      isStale: false,
      riskyContractExposureIds: [],
      hasRiskyContractExposure: false,
      sourceSectionId: null,
      metadata: {},
    } as unknown as NormalizedEvmApprovalState;

    const eligibility = getEvmCleanupEligibility(unsupportedApproval);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasonCode).toBe("unsupported_approval_kind");
    expect(eligibility.revocationMethod).toBeNull();
  });

  it("keeps cleanup ordering and IDs stable", () => {
    const input = createInput({
      approvals: [
        {
          tokenStandard: "erc721",
          tokenAddress: buildAddress(40),
          spenderAddress: buildAddress(41),
          isApproved: true,
          approvedAt: "2026-03-22T12:00:00.000Z",
        },
        {
          tokenStandard: "erc20",
          tokenAddress: buildAddress(42),
          spenderAddress: buildAddress(43),
          amount: MAX_UINT256,
          approvedAt: "2026-03-22T12:00:00.000Z",
        },
        {
          tokenStandard: "erc20",
          tokenAddress: buildAddress(44),
          spenderAddress: buildAddress(45),
          amount: "5",
          approvedAt: "2025-11-01T12:00:00.000Z",
        },
      ],
      spenders: [
        {
          spenderAddress: buildAddress(41),
          riskLevel: "critical",
          flags: ["drainer"],
        },
        {
          spenderAddress: buildAddress(45),
          trusted: true,
        },
      ],
    });

    const first = getCleanupPlan(input);
    const second = getCleanupPlan(input);

    expect(first.actions.map((action) => action.actionId)).toEqual(
      second.actions.map((action) => action.actionId)
    );
    expect(first.actions.map((action) => action.priority)).toEqual([
      "critical",
      "high",
      "medium",
    ]);
  });

  it("keeps action identity stable when finding linkage changes", () => {
    const approval: EvmApprovalRecordInput = {
      tokenStandard: "erc20",
      tokenAddress: buildAddress(46),
      spenderAddress: buildAddress(47),
      amount: MAX_UINT256,
      approvedAt: "2026-03-22T12:00:00.000Z",
    };

    const baseline = getCleanupPlan(
      createInput({
        approvals: [approval],
      })
    );
    const withAdditionalFinding = getCleanupPlan(
      createInput({
        approvals: [approval],
        spenders: [
          {
            spenderAddress: approval.spenderAddress,
            riskLevel: "critical",
            flags: ["drainer"],
          },
        ],
      })
    );

    expect(baseline.actions[0]?.actionId).toBe(withAdditionalFinding.actions[0]?.actionId);
    expect(baseline.actions[0]?.findingIds).not.toEqual(
      withAdditionalFinding.actions[0]?.findingIds
    );
  });

  it("de-duplicates duplicate approvals into one cleanup action", () => {
    const duplicateApproval: EvmApprovalRecordInput = {
      tokenStandard: "erc20",
      tokenAddress: buildAddress(48),
      spenderAddress: buildAddress(49),
      amount: MAX_UINT256,
      approvedAt: "2026-03-22T12:00:00.000Z",
    };

    const cleanupPlan = getCleanupPlan(
      createInput({
        approvals: [duplicateApproval, duplicateApproval],
      })
    );

    expect(cleanupPlan.actions).toHaveLength(1);
    expect(new Set(cleanupPlan.actions.map((action) => action.actionId)).size).toBe(1);
  });

  it("prepares a deterministic single revoke payload", () => {
    const spenderAddress = buildAddress(52).toLowerCase();
    const tokenAddress = buildAddress(51).toLowerCase();
    const cleanupPlan = getCleanupPlan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc20",
            tokenAddress,
            spenderAddress,
            amount: MAX_UINT256,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })
    );
    const action = cleanupPlan.actions[0];
    expect(action).toBeDefined();

    const payload = prepareEvmCleanupTransaction(
      action as EvmWalletCleanupPlan["actions"][number],
      cleanupPlan.walletAddress,
      cleanupPlan.networkId
    );

    expect(payload.executable).toBe(true);
    expect(payload.functionName).toBe("approve");
    expect(payload.to).toBe(tokenAddress);
    expect(payload.data).toBe(
      `0x095ea7b3${encodeAddressWord(spenderAddress)}${encodeUintWord("0")}`
    );
    expect(payload.intendedState).toBe("0");
  });

  it("prepares honest batch requests as multiple ordered transactions", () => {
    const cleanupPlan = getCleanupPlan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc20",
            tokenAddress: buildAddress(60),
            spenderAddress: buildAddress(61),
            amount: MAX_UINT256,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
          {
            tokenStandard: "erc721",
            tokenAddress: buildAddress(62),
            spenderAddress: buildAddress(63),
            isApproved: true,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })
    );

    const request = prepareEvmCleanupExecutionRequest(
      cleanupPlan,
      cleanupPlan.actions.map((action) => action.actionId),
      EVALUATED_AT
    );

    expect(request.selectionKind).toBe("batch_actions");
    expect(request.packaging).toBe("multiple_transactions");
    expect(request.supportStatus).toBe("partial");
    expect(request.preparedTransactions).toHaveLength(2);
    expect(request.actionIds).toEqual(cleanupPlan.actions.map((action) => action.actionId));
  });

  it("does not treat submitted execution as confirmed", () => {
    const cleanupPlan = getCleanupPlan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc20",
            tokenAddress: buildAddress(70),
            spenderAddress: buildAddress(71),
            amount: MAX_UINT256,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })
    );
    const actionId = cleanupPlan.actions[0]?.actionId ?? "";
    const submitted = interpretEvmCleanupExecutionResult({
      actionId,
      status: "submitted",
      txHash: "0xABCDEF",
    });
    const reconciliation = reconcileEvmCleanupPlanResults(cleanupPlan, [submitted]);

    expect(submitted.requiresRescan).toBe(false);
    expect(reconciliation.items[0]?.executionStatus).toBe("submitted");
    expect(reconciliation.requiresRescan).toBe(false);
    expect(reconciliation.outstandingActionIds).toContain(actionId);
  });

  it("requires a later rescan after confirmed execution", () => {
    const cleanupPlan = getCleanupPlan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc721",
            tokenAddress: buildAddress(80),
            spenderAddress: buildAddress(81),
            tokenId: "11",
            isApproved: true,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
        spenders: [
          {
            spenderAddress: buildAddress(81),
            riskLevel: "high",
            flags: ["exploit"],
          },
        ],
      })
    );
    const action = cleanupPlan.actions[0];
    expect(action).toBeDefined();
    const confirmed = interpretEvmCleanupExecutionResult({
      actionId: action?.actionId ?? "",
      status: "confirmed",
      txHash: "0x1234",
      finalizedAt: "2026-03-23T12:10:00.000Z",
    });

    const pendingRescan = reconcileEvmCleanupPlanResults(cleanupPlan, [confirmed]);
    const cleared = reconcileEvmCleanupPlanResults(cleanupPlan, [confirmed], {
      walletChain: "evm",
      walletAddress: cleanupPlan.walletAddress,
      networkId: cleanupPlan.networkId,
      rescannedAt: "2026-03-23T12:20:00.000Z",
      activeApprovalIds: [],
    });

    expect(confirmed.requiresRescan).toBe(true);
    expect(pendingRescan.requiresRescan).toBe(true);
    expect(pendingRescan.items[0]?.rescanStatus).toBe("not_requested");
    expect(cleared.requiresRescan).toBe(false);
    expect(cleared.items[0]?.rescanStatus).toBe("cleared");
    expect(cleared.outstandingActionIds).toEqual([]);
  });

  it("rejects mismatched re-scan snapshot context", () => {
    const cleanupPlan = getCleanupPlan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc20",
            tokenAddress: buildAddress(82),
            spenderAddress: buildAddress(83),
            amount: MAX_UINT256,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
      })
    );
    const actionId = cleanupPlan.actions[0]?.actionId ?? "";
    const confirmed = interpretEvmCleanupExecutionResult({
      actionId,
      status: "confirmed",
      txHash: "0x9999",
    });

    const wrongWalletAddress = reconcileEvmCleanupPlanResults(cleanupPlan, [confirmed], {
      walletChain: "evm",
      walletAddress: buildAddress(200).toLowerCase(),
      networkId: cleanupPlan.networkId,
      rescannedAt: "2026-03-23T12:20:00.000Z",
      activeApprovalIds: [],
    });
    const wrongWalletChain = reconcileEvmCleanupPlanResults(cleanupPlan, [confirmed], {
      walletChain: "bitcoin",
      walletAddress: cleanupPlan.walletAddress,
      networkId: cleanupPlan.networkId,
      rescannedAt: "2026-03-23T12:20:00.000Z",
      activeApprovalIds: [],
    } as unknown as Parameters<typeof reconcileEvmCleanupPlanResults>[2]);
    const wrongNetworkId = reconcileEvmCleanupPlanResults(cleanupPlan, [confirmed], {
      walletChain: "evm",
      walletAddress: cleanupPlan.walletAddress,
      networkId: "137",
      rescannedAt: "2026-03-23T12:20:00.000Z",
      activeApprovalIds: [],
    });

    expect(wrongWalletAddress.rescanSnapshotAccepted).toBe(false);
    expect(wrongWalletAddress.rescanMismatchReason).toBe("wallet_address_mismatch");
    expect(wrongWalletAddress.items[0]?.rescanStatus).toBe("not_requested");
    expect(wrongWalletAddress.outstandingActionIds).toContain(actionId);

    expect(wrongWalletChain.rescanSnapshotAccepted).toBe(false);
    expect(wrongWalletChain.rescanMismatchReason).toBe("wallet_chain_mismatch");
    expect(wrongWalletChain.items[0]?.rescanStatus).toBe("not_requested");

    expect(wrongNetworkId.rescanSnapshotAccepted).toBe(false);
    expect(wrongNetworkId.rescanMismatchReason).toBe("network_id_mismatch");
    expect(wrongNetworkId.items[0]?.rescanStatus).toBe("not_requested");
  });

  it("prepares ERC-721 token cleanup against the zero address target", () => {
    const cleanupPlan = getCleanupPlan(
      createInput({
        approvals: [
          {
            tokenStandard: "erc721",
            tokenAddress: buildAddress(90),
            spenderAddress: buildAddress(91),
            tokenId: "19",
            isApproved: true,
            approvedAt: "2026-03-22T12:00:00.000Z",
          },
        ],
        spenders: [
          {
            spenderAddress: buildAddress(91),
            riskLevel: "high",
            flags: ["malicious"],
          },
        ],
      })
    );
    const action = cleanupPlan.actions[0];
    expect(action?.approval.approvalKind).toBe("erc721_token");

    const payload = prepareEvmCleanupTransaction(
      action as EvmWalletCleanupPlan["actions"][number],
      cleanupPlan.walletAddress,
      cleanupPlan.networkId
    );

    expect(payload.functionName).toBe("approve");
    expect(payload.args).toEqual([
      {
        name: "to",
        type: "address",
        value: ZERO_ADDRESS,
      },
      {
        name: "tokenId",
        type: "uint256",
        value: "19",
      },
    ]);
  });
});
