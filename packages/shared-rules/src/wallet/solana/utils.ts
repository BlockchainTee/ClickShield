import type { RiskLevel } from "../../engine/types.js";

const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const SEVERE_FLAGS = new Set([
  "compromised",
  "drainer",
  "exploit",
  "malicious",
  "phishing",
]);

/**
 * Returns string values in sorted unique order.
 */
export function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

/**
 * Returns a metadata record with deterministically sorted keys.
 */
export function normalizeMetadata(
  metadata?: Readonly<Record<string, string>>
): Readonly<Record<string, string>> {
  if (!metadata) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const key of Object.keys(metadata).sort()) {
    normalized[key] = metadata[key];
  }
  return normalized;
}

/**
 * Normalizes a list of strings to sorted, trimmed, lowercase values.
 */
export function normalizeStringList(values?: readonly string[]): readonly string[] {
  return uniqueSorted(
    (values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)
  );
}

/**
 * Compares two risk levels using the shared severity ladder.
 */
export function compareRiskLevel(left: RiskLevel, right: RiskLevel): number {
  return RISK_LEVEL_ORDER[left] - RISK_LEVEL_ORDER[right];
}

/**
 * Returns the highest risk level in a list, or the fallback when empty.
 */
export function maxRiskLevel(
  levels: readonly RiskLevel[],
  fallback: RiskLevel
): RiskLevel {
  return levels.reduce(
    (current, candidate) =>
      compareRiskLevel(candidate, current) > 0 ? candidate : current,
    fallback
  );
}

/**
 * Returns true when any supplied flag is treated as severe.
 */
export function hasSevereFlag(flags: readonly string[]): boolean {
  return flags.some((flag) => SEVERE_FLAGS.has(flag));
}

/**
 * Computes the age in whole days between a subject timestamp and the snapshot timestamp.
 */
export function computeAgeDays(
  subjectTimestamp: string | null,
  capturedAt: string
): number | null {
  if (subjectTimestamp === null) {
    return null;
  }

  const subjectMs = Date.parse(subjectTimestamp);
  const capturedMs = Date.parse(capturedAt);
  if (Number.isNaN(subjectMs) || Number.isNaN(capturedMs) || subjectMs > capturedMs) {
    return null;
  }

  return Math.floor((capturedMs - subjectMs) / 86_400_000);
}
