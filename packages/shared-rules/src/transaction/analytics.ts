import type { TransactionAuditRecord } from "./audit.js";

export interface TransactionAnalytics {
  totalTransactions: number;
  blockedCount: number;
  warnedCount: number;
  repeatedTargetCount: Record<string, number>;
  highRiskFrequency: number;
  patterns: {
    repeatedTarget: boolean;
    frequentHighRisk: boolean;
  };
}

function getRecordTarget(record: TransactionAuditRecord): string | null {
  const target = record.signals.targetAddress ?? record.explanation.details.target;

  if (typeof target !== "string") {
    return null;
  }

  const normalizedTarget = target.trim().toLowerCase();
  return normalizedTarget.length > 0 ? normalizedTarget : null;
}

export function analyzeTransactions(
  records: TransactionAuditRecord[]
): TransactionAnalytics {
  let blockedCount = 0;
  let warnedCount = 0;

  const repeatedTargetMap = new Map<string, number>();

  for (const record of records) {
    if (record.status === "block") {
      blockedCount += 1;
    }

    if (record.status === "warn") {
      warnedCount += 1;
    }

    const target = getRecordTarget(record);
    if (target !== null) {
      repeatedTargetMap.set(target, (repeatedTargetMap.get(target) ?? 0) + 1);
    }
  }

  const repeatedTargetCount = Object.fromEntries(
    [...repeatedTargetMap.entries()].sort(([left], [right]) =>
      left.localeCompare(right)
    )
  );

  const totalTransactions = records.length;
  const highRiskFrequency =
    totalTransactions === 0 ? 0 : blockedCount / totalTransactions;
  const repeatedTarget = Object.values(repeatedTargetCount).some(
    (count) => count > 3
  );

  return {
    totalTransactions,
    blockedCount,
    warnedCount,
    repeatedTargetCount,
    highRiskFrequency,
    patterns: {
      repeatedTarget,
      frequentHighRisk: highRiskFrequency > 0.5,
    },
  };
}
