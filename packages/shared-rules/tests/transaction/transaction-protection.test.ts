import { describe, expect, it } from "vitest";

import {
  analyzeTransactions,
  deriveUserProtectionProfile,
  type TransactionAuditRecord,
  type UserProtectionProfile,
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

describe("transaction protection profile", () => {
  it("returns an empty, non-heightened profile for empty history", () => {
    expect(deriveUserProtectionProfile([])).toEqual<UserProtectionProfile>({
      heightenedProtection: false,
      controls: {
        repeatedTargetCaution: false,
        frequentHighRiskCaution: false,
        warnEscalationSuggested: false,
        cooldownSuggested: false,
      },
      summary: {
        totalTransactions: 0,
        blockedCount: 0,
        warnedCount: 0,
        repeatedTargetCount: 0,
        highRiskFrequency: 0,
      },
    });
  });

  it("keeps all controls false when history contains no warnings or risky patterns", () => {
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({ id: "allow-1", status: "allow" }),
      buildAuditRecord({
        id: "allow-2",
        status: "allow",
        signals: {
          ...buildAuditRecord().signals,
          targetAddress: "0x2222222222222222222222222222222222222222",
        },
      }),
      buildAuditRecord({
        id: "allow-3",
        status: "allow",
        signals: {
          ...buildAuditRecord().signals,
          targetAddress: "0x3333333333333333333333333333333333333333",
        },
      }),
    ];

    const profile = deriveUserProtectionProfile(records);

    expect(profile.heightenedProtection).toBe(false);
    expect(profile.controls).toEqual({
      repeatedTargetCaution: false,
      frequentHighRiskCaution: false,
      warnEscalationSuggested: false,
      cooldownSuggested: false,
    });
  });

  it("enables repeated-target caution for repeated target history", () => {
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
    ];

    const profile = deriveUserProtectionProfile(records);

    expect(profile.controls.repeatedTargetCaution).toBe(true);
    expect(profile.controls.frequentHighRiskCaution).toBe(false);
    expect(profile.summary.repeatedTargetCount).toBe(4);
  });

  it("enables frequent high-risk caution for a high blocked ratio", () => {
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({ id: "b1", status: "block" }),
      buildAuditRecord({ id: "b2", status: "block" }),
      buildAuditRecord({ id: "b3", status: "block" }),
      buildAuditRecord({ id: "a1", status: "allow" }),
      buildAuditRecord({ id: "w1", status: "warn" }),
    ];

    const profile = deriveUserProtectionProfile(records);

    expect(profile.controls.frequentHighRiskCaution).toBe(true);
    expect(profile.summary.highRiskFrequency).toBe(0.6);
  });

  it("suggests warn escalation for warn-heavy history", () => {
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({ id: "w1", status: "warn" }),
      buildAuditRecord({ id: "w2", status: "warn" }),
      buildAuditRecord({ id: "w3", status: "warn" }),
      buildAuditRecord({ id: "a1", status: "allow" }),
      buildAuditRecord({ id: "a2", status: "allow" }),
    ];

    const profile = deriveUserProtectionProfile(records);

    expect(profile.controls.warnEscalationSuggested).toBe(true);
    expect(profile.controls.cooldownSuggested).toBe(false);
  });

  it("suggests a cooldown when recent history is dominated by risky outcomes", () => {
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({
        id: "old-allow",
        status: "allow",
        timestamp: "2026-03-26T12:00:00.000Z",
      }),
      buildAuditRecord({
        id: "recent-warn-1",
        status: "warn",
        timestamp: "2026-03-26T12:01:00.000Z",
      }),
      buildAuditRecord({
        id: "recent-block-1",
        status: "block",
        timestamp: "2026-03-26T12:02:00.000Z",
      }),
      buildAuditRecord({
        id: "recent-warn-2",
        status: "warn",
        timestamp: "2026-03-26T12:03:00.000Z",
      }),
      buildAuditRecord({
        id: "recent-block-2",
        status: "block",
        timestamp: "2026-03-26T12:04:00.000Z",
      }),
    ];

    const profile = deriveUserProtectionProfile(records);

    expect(profile.controls.cooldownSuggested).toBe(true);
    expect(profile.controls.warnEscalationSuggested).toBe(false);
    expect(profile.controls.frequentHighRiskCaution).toBe(false);
  });

  it("rolls up any active advisory control into heightened protection", () => {
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({ id: "w1", status: "warn" }),
      buildAuditRecord({ id: "w2", status: "warn" }),
      buildAuditRecord({ id: "w3", status: "warn" }),
      buildAuditRecord({ id: "a1", status: "allow" }),
      buildAuditRecord({ id: "a2", status: "allow" }),
    ];

    expect(deriveUserProtectionProfile(records).heightenedProtection).toBe(true);
  });

  it("returns the same profile for the same records on every run", () => {
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

    const first = deriveUserProtectionProfile([...records]);
    const second = deriveUserProtectionProfile([...records]);

    expect(first).toEqual(second);
  });

  it("derives protection from audit history and analytics without runtime context", () => {
    const baseSignals = buildAuditRecord().signals;
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({
        id: "warn-1",
        status: "warn",
        signals: {
          ...baseSignals,
          targetAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      }),
      buildAuditRecord({
        id: "block-1",
        status: "block",
        signals: {
          ...baseSignals,
          targetAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      }),
      buildAuditRecord({
        id: "allow-1",
        status: "allow",
        signals: {
          ...baseSignals,
          targetAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
        },
      }),
    ];

    const analytics = analyzeTransactions(records);
    const profile = deriveUserProtectionProfile(records);

    expect(profile.summary).toEqual({
      totalTransactions: analytics.totalTransactions,
      blockedCount: analytics.blockedCount,
      warnedCount: analytics.warnedCount,
      repeatedTargetCount: 1,
      highRiskFrequency: analytics.highRiskFrequency,
    });
  });
});
