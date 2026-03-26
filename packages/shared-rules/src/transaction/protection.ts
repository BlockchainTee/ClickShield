import { analyzeTransactions } from "./analytics.js";
import type { TransactionAuditRecord } from "./audit.js";

const WARN_ESCALATION_MIN_COUNT = 3;
const WARN_ESCALATION_MIN_RATIO = 0.5;
const COOLDOWN_RECENT_WINDOW_SIZE = 5;
const COOLDOWN_MIN_RECENT_RECORDS = 4;
const COOLDOWN_MIN_RISK_RATIO = 0.8;

export interface UserProtectionProfile {
  heightenedProtection: boolean;
  controls: {
    repeatedTargetCaution: boolean;
    frequentHighRiskCaution: boolean;
    warnEscalationSuggested: boolean;
    cooldownSuggested: boolean;
  };
  summary: {
    totalTransactions: number;
    blockedCount: number;
    warnedCount: number;
    repeatedTargetCount: number;
    highRiskFrequency: number;
  };
}

function getMaxRepeatedTargetCount(records: Record<string, number>): number {
  let maxCount = 0;

  for (const count of Object.values(records)) {
    if (count > maxCount) {
      maxCount = count;
    }
  }

  return maxCount;
}

function compareRecordsByRecency(
  left: TransactionAuditRecord,
  right: TransactionAuditRecord
): number {
  if (left.timestamp === right.timestamp) {
    if (left.id === right.id) {
      return 0;
    }

    return left.id < right.id ? -1 : 1;
  }

  return left.timestamp < right.timestamp ? 1 : -1;
}

function getRecentRiskRatio(records: TransactionAuditRecord[]): number {
  const recentRecords = [...records]
    .sort(compareRecordsByRecency)
    .slice(0, COOLDOWN_RECENT_WINDOW_SIZE);

  if (recentRecords.length < COOLDOWN_MIN_RECENT_RECORDS) {
    return 0;
  }

  let riskyCount = 0;

  for (const record of recentRecords) {
    if (record.status !== "allow") {
      riskyCount += 1;
    }
  }

  return riskyCount / recentRecords.length;
}

/**
 * Derives deterministic, advisory-only user protection controls from local
 * audit history. Thresholds are intentionally fixed:
 * - warn escalation: at least 3 warnings and warnings are >= 50% of history
 * - cooldown suggestion: at least 4 of the 5 most recent records are risky
 */
export function deriveUserProtectionProfile(
  records: TransactionAuditRecord[]
): UserProtectionProfile {
  const analytics = analyzeTransactions(records);
  const repeatedTargetCount = getMaxRepeatedTargetCount(
    analytics.repeatedTargetCount
  );
  const warnEscalationSuggested =
    analytics.warnedCount >= WARN_ESCALATION_MIN_COUNT &&
    analytics.totalTransactions > 0 &&
    analytics.warnedCount / analytics.totalTransactions >=
      WARN_ESCALATION_MIN_RATIO;
  const cooldownSuggested =
    getRecentRiskRatio(records) >= COOLDOWN_MIN_RISK_RATIO;

  const controls = {
    repeatedTargetCaution: analytics.patterns.repeatedTarget,
    frequentHighRiskCaution: analytics.patterns.frequentHighRisk,
    warnEscalationSuggested,
    cooldownSuggested,
  };

  return {
    heightenedProtection: Object.values(controls).some(Boolean),
    controls,
    summary: {
      totalTransactions: analytics.totalTransactions,
      blockedCount: analytics.blockedCount,
      warnedCount: analytics.warnedCount,
      repeatedTargetCount,
      highRiskFrequency: analytics.highRiskFrequency,
    },
  };
}
