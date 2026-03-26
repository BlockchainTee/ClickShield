import { describe, expect, it } from "vitest";

import {
  analyzeTransactions,
  type TransactionAnalytics,
  type TransactionAuditRecord,
} from "../../src/index.js";

function buildAuditRecord(
  overrides: Partial<TransactionAuditRecord> = {}
): TransactionAuditRecord {
  const target =
    overrides.signals?.targetAddress ??
    overrides.explanation?.details.target ??
    "0x1111111111111111111111111111111111111111";

  return {
    id: overrides.id ?? "audit-id",
    timestamp: overrides.timestamp ?? "2026-03-26T12:00:00.000Z",
    status: overrides.status ?? "allow",
    explanation: overrides.explanation ?? {
      status: overrides.status ?? "allow",
      summary: "summary",
      primaryReason: "primary reason",
      secondaryReasons: [],
      riskLevel: "low",
      details: {
        method: "approve",
        target,
        value: "0",
        isContractInteraction: true,
      },
    },
    signals: overrides.signals ?? {
      isContractInteraction: true,
      isNativeTransfer: false,
      methodName: "approve",
      isApproval: true,
      actionType: "approve",
      isApprovalMethod: true,
      isUnlimitedApproval: false,
      hasValueTransfer: false,
      isHighValue: false,
      targetAddress: target,
      isPermitSignature: false,
      isSetApprovalForAll: false,
      approvalDirection: "grant",
      spenderTrusted: null,
      recipientIsNew: null,
      isTransfer: false,
      isTransferFrom: false,
      isMulticall: false,
      containsApprovalAndTransfer: false,
      containsApproval: true,
      containsTransfer: false,
      containsTransferFrom: false,
      batchActionCount: 1,
      hasNativeValue: false,
      touchesMaliciousContract: false,
      targetAllowlisted: false,
      signatureIntelMatch: false,
      verifyingContractKnown: false,
      hasUnknownInnerCall: false,
    },
    classification: overrides.classification ?? {
      hasMaliciousTarget: false,
      hasKnownScamSignature: false,
      isApprovalRisk: false,
      isUnlimitedApprovalRisk: false,
      isPermitRisk: false,
      isHighValueTransferRisk: false,
      isUnknownMethodRisk: false,
      requiresUserAttention: false,
    },
    metadata: overrides.metadata ?? {
      source: "extension",
    },
  };
}

describe("transaction analytics", () => {
  it("counts totals, blocked records, and warned records correctly", () => {
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({ id: "allow-1", status: "allow" }),
      buildAuditRecord({ id: "warn-1", status: "warn" }),
      buildAuditRecord({ id: "warn-2", status: "warn" }),
      buildAuditRecord({ id: "block-1", status: "block" }),
    ];

    const analytics = analyzeTransactions(records);

    expect(analytics.totalTransactions).toBe(4);
    expect(analytics.blockedCount).toBe(1);
    expect(analytics.warnedCount).toBe(2);
  });

  it("detects repeated targets from audit-record target addresses", () => {
    const repeatedTarget = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const baseSignals = buildAuditRecord().signals;
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({
        id: "r1",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({
        id: "r2",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({
        id: "r3",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({
        id: "r4",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({
        id: "other",
        signals: {
          ...baseSignals,
          targetAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      }),
    ];

    const analytics = analyzeTransactions(records);

    expect(analytics.repeatedTargetCount).toEqual({
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": 4,
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": 1,
    });
    expect(analytics.patterns.repeatedTarget).toBe(true);
  });

  it("calculates high-risk frequency from blocked transactions", () => {
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({ id: "b1", status: "block" }),
      buildAuditRecord({ id: "b2", status: "block" }),
      buildAuditRecord({ id: "a1", status: "allow" }),
      buildAuditRecord({ id: "w1", status: "warn" }),
    ];

    const analytics = analyzeTransactions(records);

    expect(analytics.highRiskFrequency).toBe(0.5);
  });

  it("sets pattern flags from repeated-target and high-risk thresholds", () => {
    const repeatedTarget = "0xcccccccccccccccccccccccccccccccccccccccc";
    const baseSignals = buildAuditRecord().signals;
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({
        id: "1",
        status: "block",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({
        id: "2",
        status: "block",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({
        id: "3",
        status: "block",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({
        id: "4",
        status: "block",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({ id: "5", status: "warn" }),
      buildAuditRecord({ id: "6", status: "allow" }),
    ];

    const analytics = analyzeTransactions(records);

    expect(analytics.patterns).toEqual({
      repeatedTarget: true,
      frequentHighRisk: true,
    });
  });

  it("returns deterministic output for the same audit history", () => {
    const baseSignals = buildAuditRecord().signals;
    const records = Object.freeze([
      Object.freeze(
        buildAuditRecord({
          id: "one",
          status: "block",
          signals: {
            ...baseSignals,
            targetAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
          },
        })
      ),
      Object.freeze(
        buildAuditRecord({
          id: "two",
          status: "warn",
          signals: {
            ...baseSignals,
            targetAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          },
        })
      ),
    ]);

    const first = analyzeTransactions([...records]);
    const second = analyzeTransactions([...records]);

    expect(first).toEqual(second);
    expect(first).toEqual<TransactionAnalytics>({
      totalTransactions: 2,
      blockedCount: 1,
      warnedCount: 1,
      repeatedTargetCount: {
        "0xdddddddddddddddddddddddddddddddddddddddd": 1,
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": 1,
      },
      highRiskFrequency: 0.5,
      patterns: {
        repeatedTarget: false,
        frequentHighRisk: false,
      },
    });
  });
});
