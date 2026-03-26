import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAuditRecord,
  normalizeTransactionRequest,
  type TransactionInput,
} from "../../src/index.js";
import {
  assembleTransactionVerdict,
  type MatchedRuleData,
} from "../../src/engine/verdict.js";

const WALLET_METADATA = {
  providerType: "injected",
  walletName: "Example Wallet",
  walletVersion: null,
  platform: "web",
} as const;

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

function buildCalldata(selector: string, words: readonly string[]): string {
  return `0x${selector.replace(/^0x/, "")}${words.join("")}`;
}

function buildTransactionContext(): TransactionInput {
  return normalizeTransactionRequest({
    eventKind: "transaction",
    rpcMethod: "eth_sendTransaction",
    chainFamily: "evm",
    chainId: 1,
    from: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    value: "0x1",
    calldata: buildCalldata("0x095ea7b3", [
      encodeAddress("0x3333333333333333333333333333333333333333"),
      encodeUint(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      ),
    ]),
    originDomain: "app.example.com",
    walletProvider: "injected",
    walletMetadata: WALLET_METADATA,
    surface: "extension",
    counterparty: {
      spenderTrusted: false,
      recipientIsNew: true,
    },
  });
}

function match(
  input: Pick<
    MatchedRuleData,
    "ruleId" | "priority" | "outcome" | "severity" | "reasonCodes" | "evidence"
  >
): MatchedRuleData {
  return {
    ruleId: input.ruleId,
    priority: input.priority,
    outcome: input.outcome,
    severity: input.severity,
    reasonCodes: [...input.reasonCodes],
    evidence: { ...input.evidence },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("transaction audit logging", () => {
  it("creates a structured audit record with all required fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));

    const context = buildTransactionContext();
    const verdict = assembleTransactionVerdict(context, [
      match({
        ruleId: "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
        priority: 120,
        outcome: "warn",
        severity: "high",
        reasonCodes: ["TX_UNLIMITED_APPROVAL", "TX_UNKNOWN_SPENDER"],
        evidence: {
          approval: {
            spenderTrusted: false,
          },
        },
      }),
    ]).verdict;

    const audit = createAuditRecord(context, verdict);

    expect(audit.id).toMatch(/^[0-9a-f]{64}$/);
    expect(audit.timestamp).toBe("2026-03-26T12:00:00.000Z");
    expect(audit.status).toBe("warn");
    expect(audit.explanation).toEqual(verdict.explanation);
    expect(audit.signals).toEqual(context.signals);
    expect(audit.classification).toEqual(context.riskClassification);
    expect(audit.metadata).toEqual({
      source: "extension",
    });
  });

  it("uses a deterministic ID for the same transaction and verdict", () => {
    vi.useFakeTimers();

    const context = buildTransactionContext();
    const verdict = assembleTransactionVerdict(context, [
      match({
        ruleId: "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT",
        priority: 10,
        outcome: "block",
        severity: "critical",
        reasonCodes: ["TX_KNOWN_MALICIOUS_CONTRACT"],
        evidence: {
          maliciousContract: {
            address: "0x2222222222222222222222222222222222222222",
          },
        },
      }),
    ]).verdict;

    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));
    const first = createAuditRecord(context, verdict);
    vi.setSystemTime(new Date("2026-03-26T12:05:00.000Z"));
    const second = createAuditRecord(context, verdict);

    expect(second.id).toBe(first.id);
    expect(second.timestamp).toBe("2026-03-26T12:05:00.000Z");
  });

  it("does not mutate the verdict while recording the audit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));

    const context = buildTransactionContext();
    const verdict = assembleTransactionVerdict(context, [
      match({
        ruleId: "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
        priority: 120,
        outcome: "warn",
        severity: "high",
        reasonCodes: ["TX_UNLIMITED_APPROVAL", "TX_UNKNOWN_SPENDER"],
        evidence: {
          approval: {
            spenderTrusted: false,
          },
        },
      }),
    ]).verdict;

    const before = JSON.stringify(verdict);
    const audit = createAuditRecord(context, verdict);

    expect(JSON.stringify(verdict)).toBe(before);
    expect(verdict.status).toBe("WARN");
    expect(audit.status).toBe("warn");
  });

  it("attaches the audit record to the assembled verdict", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));

    const context = buildTransactionContext();
    const result = assembleTransactionVerdict(context, [
      match({
        ruleId: "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
        priority: 120,
        outcome: "warn",
        severity: "high",
        reasonCodes: ["TX_UNLIMITED_APPROVAL", "TX_UNKNOWN_SPENDER"],
        evidence: {
          approval: {
            spenderTrusted: false,
          },
        },
      }),
    ]);

    expect(result.verdict.audit).toEqual(
      createAuditRecord(context, result.verdict)
    );
    expect(result.verdict.status).toBe("WARN");
  });
});
