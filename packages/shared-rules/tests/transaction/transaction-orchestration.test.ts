import { describe, expect, it } from "vitest";

import type { TransactionVerdict } from "../../src/engine/types.js";
import {
  analyzeTransactions,
  buildTransactionDecisionPackage,
  deriveUserProtectionProfile,
  type TransactionAuditRecord,
  type TransactionDecisionPackage,
} from "../../src/index.js";

function buildAuditRecord(
  overrides: Partial<TransactionAuditRecord> = {}
): TransactionAuditRecord {
  const target =
    overrides.signals?.targetAddress ??
    overrides.explanation?.details.target ??
    "0x1111111111111111111111111111111111111111";
  const status = overrides.status ?? "allow";

  return {
    id: overrides.id ?? `audit-${status}`,
    timestamp: overrides.timestamp ?? "2026-03-26T12:00:00.000Z",
    status,
    explanation: overrides.explanation ?? {
      status,
      summary: `${status} summary`,
      primaryReason: `${status} reason`,
      secondaryReasons: [],
      riskLevel:
        status === "block" ? "high" : status === "warn" ? "medium" : "low",
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
      isUnlimitedApproval: status === "block",
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
      touchesMaliciousContract: status === "block",
      targetAllowlisted: status === "allow",
      signatureIntelMatch: false,
      verifyingContractKnown: false,
      hasUnknownInnerCall: false,
    },
    classification: overrides.classification ?? {
      hasMaliciousTarget: status === "block",
      hasKnownScamSignature: false,
      isApprovalRisk: true,
      isUnlimitedApprovalRisk: status === "block",
      isPermitRisk: false,
      isHighValueTransferRisk: false,
      isUnknownMethodRisk: false,
      requiresUserAttention: status !== "allow",
    },
    metadata: overrides.metadata ?? {
      source: "extension",
    },
  };
}

function buildVerdict(overrides: Partial<TransactionVerdict> = {}): TransactionVerdict {
  const audit =
    overrides.audit ??
    buildAuditRecord({
      id: "verdict-audit",
      status: "warn",
      timestamp: "2026-03-26T12:04:00.000Z",
    });
  const explanation = overrides.explanation ?? audit.explanation;

  return {
    status: overrides.status ?? "WARN",
    riskLevel: overrides.riskLevel ?? "high",
    reasonCodes: overrides.reasonCodes ?? ["TX_UNLIMITED_APPROVAL"],
    matchedRules:
      overrides.matchedRules ?? ["TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER"],
    primaryRuleId:
      overrides.primaryRuleId ?? "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
    primaryReason:
      overrides.primaryReason ?? {
        ruleId: "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
        outcome: "warn",
        severity: "high",
        priority: 120,
        reasonCodes: ["TX_UNLIMITED_APPROVAL"],
        evidence: {
          approval: {
            spenderTrusted: false,
          },
        },
      },
    secondaryReasons: overrides.secondaryReasons ?? [],
    evidence: overrides.evidence ?? {
      approval: {
        spenderTrusted: false,
      },
    },
    explanation,
    ruleSetVersion: overrides.ruleSetVersion ?? "test-rule-set",
    intelVersions: overrides.intelVersions ?? {
      contractFeedVersion: "contracts-v1",
      allowlistFeedVersion: "allowlist-v1",
      signatureFeedVersion: "signatures-v1",
    },
    overrideAllowed: overrides.overrideAllowed ?? true,
    overrideLevel: overrides.overrideLevel ?? "confirm",
    audit,
  };
}

function buildRuntimeVerdict(
  overrides: Record<string, unknown>
): TransactionVerdict {
  return {
    ...buildVerdict(),
    ...overrides,
  } as unknown as TransactionVerdict;
}

describe("transaction orchestration", () => {
  it("assembles the full decision package without reinterpreting verdict output", () => {
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({
        id: "warn-1",
        status: "warn",
        timestamp: "2026-03-26T12:01:00.000Z",
        signals: {
          ...buildAuditRecord().signals,
          targetAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      }),
      buildAuditRecord({
        id: "block-1",
        status: "block",
        timestamp: "2026-03-26T12:02:00.000Z",
        signals: {
          ...buildAuditRecord().signals,
          targetAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      }),
      buildAuditRecord({
        id: "allow-1",
        status: "allow",
        timestamp: "2026-03-26T12:03:00.000Z",
        signals: {
          ...buildAuditRecord().signals,
          targetAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      }),
    ];
    const verdict = buildVerdict();

    const decisionPackage = buildTransactionDecisionPackage(records, verdict);

    expect(decisionPackage.verdict).toBe(verdict);
    expect(decisionPackage.explanation).toBe(verdict.explanation);
    expect(decisionPackage.audit).toBe(verdict.audit);
    expect(decisionPackage.analytics).toEqual(analyzeTransactions(records));
    expect(decisionPackage.protection).toEqual(
      deriveUserProtectionProfile(records)
    );
    expect(decisionPackage.readiness).toEqual({
      hasExplanation: true,
      hasAudit: true,
      hasAnalytics: true,
      hasProtectionProfile: true,
      complete: true,
    });
  });

  it("includes analytics derived from audit history", () => {
    const repeatedTarget = "0xcccccccccccccccccccccccccccccccccccccccc";
    const baseSignals = buildAuditRecord().signals;
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({
        id: "r1",
        status: "block",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({
        id: "r2",
        status: "warn",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({
        id: "r3",
        status: "block",
        signals: { ...baseSignals, targetAddress: repeatedTarget },
      }),
      buildAuditRecord({
        id: "r4",
        status: "allow",
        signals: {
          ...baseSignals,
          targetAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
        },
      }),
    ];

    const decisionPackage = buildTransactionDecisionPackage(
      records,
      buildVerdict()
    );

    expect(decisionPackage.analytics).toEqual({
      totalTransactions: 4,
      blockedCount: 2,
      warnedCount: 1,
      repeatedTargetCount: {
        "0xcccccccccccccccccccccccccccccccccccccccc": 3,
        "0xdddddddddddddddddddddddddddddddddddddddd": 1,
      },
      highRiskFrequency: 0.5,
      patterns: {
        repeatedTarget: false,
        frequentHighRisk: false,
      },
    });
  });

  it("includes a protection profile derived from audit history", () => {
    const baseSignals = buildAuditRecord().signals;
    const records: TransactionAuditRecord[] = [
      buildAuditRecord({
        id: "warn-1",
        status: "warn",
        timestamp: "2026-03-26T12:01:00.000Z",
        signals: {
          ...baseSignals,
          targetAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      }),
      buildAuditRecord({
        id: "warn-2",
        status: "warn",
        timestamp: "2026-03-26T12:02:00.000Z",
        signals: {
          ...baseSignals,
          targetAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      }),
      buildAuditRecord({
        id: "warn-3",
        status: "warn",
        timestamp: "2026-03-26T12:03:00.000Z",
        signals: {
          ...baseSignals,
          targetAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
        },
      }),
      buildAuditRecord({
        id: "block-1",
        status: "block",
        timestamp: "2026-03-26T12:04:00.000Z",
        signals: {
          ...baseSignals,
          targetAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
        },
      }),
      buildAuditRecord({
        id: "warn-4",
        status: "warn",
        timestamp: "2026-03-26T12:05:00.000Z",
        signals: {
          ...baseSignals,
          targetAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        },
      }),
    ];

    const decisionPackage = buildTransactionDecisionPackage(
      records,
      buildVerdict()
    );

    expect(decisionPackage.protection).toEqual({
      heightenedProtection: true,
      controls: {
        repeatedTargetCaution: false,
        frequentHighRiskCaution: false,
        warnEscalationSuggested: true,
        cooldownSuggested: true,
      },
      summary: {
        totalTransactions: 5,
        blockedCount: 1,
        warnedCount: 4,
        repeatedTargetCount: 1,
        highRiskFrequency: 0.2,
      },
    });
  });

  it("returns the same package for the same inputs on repeated runs", () => {
    const baseSignals = buildAuditRecord().signals;
    const records = Object.freeze([
      Object.freeze(
        buildAuditRecord({
          id: "one",
          status: "block",
          signals: {
            ...baseSignals,
            targetAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
        })
      ),
      Object.freeze(
        buildAuditRecord({
          id: "two",
          status: "warn",
          signals: {
            ...baseSignals,
            targetAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          },
        })
      ),
    ]);
    const verdict = buildVerdict();

    const first = buildTransactionDecisionPackage(records, verdict);
    const second = buildTransactionDecisionPackage(records, verdict);

    expect(first).toEqual<TransactionDecisionPackage>(second);
  });

  it("marks explanation readiness false when explanation is missing", () => {
    const decisionPackage = buildTransactionDecisionPackage(
      [],
      buildRuntimeVerdict({
        explanation: undefined,
      })
    );

    expect(decisionPackage.readiness.hasExplanation).toBe(false);
    expect(decisionPackage.readiness.hasAudit).toBe(true);
    expect(decisionPackage.readiness.complete).toBe(false);
  });

  it("marks explanation readiness false when explanation is incomplete", () => {
    const decisionPackage = buildTransactionDecisionPackage(
      [],
      buildRuntimeVerdict({
        explanation: {
          status: "warn",
          summary: "",
          primaryReason: "   ",
          secondaryReasons: [],
          riskLevel: "medium",
          details: {
            isContractInteraction: true,
          },
        },
      })
    );

    expect(decisionPackage.readiness.hasExplanation).toBe(false);
    expect(decisionPackage.readiness.hasAudit).toBe(true);
    expect(decisionPackage.readiness.complete).toBe(false);
  });

  it("marks audit readiness false when audit is missing", () => {
    const decisionPackage = buildTransactionDecisionPackage(
      [],
      buildRuntimeVerdict({
        audit: undefined,
      })
    );

    expect(decisionPackage.readiness.hasExplanation).toBe(true);
    expect(decisionPackage.readiness.hasAudit).toBe(false);
    expect(decisionPackage.readiness.complete).toBe(false);
  });

  it("marks audit readiness false when audit is incomplete", () => {
    const decisionPackage = buildTransactionDecisionPackage(
      [],
      buildRuntimeVerdict({
        audit: {
          id: "",
          timestamp: "",
          status: "warn",
          explanation: buildVerdict().explanation,
          signals: {},
          classification: {},
          metadata: {
            source: "",
          },
        },
      })
    );

    expect(decisionPackage.readiness.hasExplanation).toBe(true);
    expect(decisionPackage.readiness.hasAudit).toBe(false);
    expect(decisionPackage.readiness.complete).toBe(false);
  });

  it("handles empty history safely while preserving finalized verdict data", () => {
    const verdict = buildVerdict({
      status: "ALLOW",
      overrideAllowed: false,
      overrideLevel: "none",
      audit: buildAuditRecord({
        id: "allow-audit",
        status: "allow",
      }),
    });

    const decisionPackage = buildTransactionDecisionPackage([], verdict);

    expect(decisionPackage.verdict).toBe(verdict);
    expect(decisionPackage.analytics).toEqual({
      totalTransactions: 0,
      blockedCount: 0,
      warnedCount: 0,
      repeatedTargetCount: {},
      highRiskFrequency: 0,
      patterns: {
        repeatedTarget: false,
        frequentHighRisk: false,
      },
    });
    expect(decisionPackage.protection).toEqual({
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
    expect(decisionPackage.readiness.complete).toBe(true);
  });

  it("remains read-only and does not mutate the verdict or records", () => {
    const frozenRecord = Object.freeze(
      buildAuditRecord({
        id: "frozen-record",
        status: "warn",
      })
    );
    const records = Object.freeze([frozenRecord]);
    const verdict = Object.freeze(
      buildVerdict({
        audit: Object.freeze(
          buildAuditRecord({
            id: "frozen-audit",
            status: "block",
          })
        ),
      })
    );
    const originalReasonCodes = [...verdict.reasonCodes];

    const decisionPackage = buildTransactionDecisionPackage(records, verdict);

    expect(decisionPackage.verdict).toBe(verdict);
    expect(decisionPackage.audit).toBe(verdict.audit);
    expect(verdict.reasonCodes).toEqual(originalReasonCodes);
    expect(records).toEqual([frozenRecord]);
  });
});
