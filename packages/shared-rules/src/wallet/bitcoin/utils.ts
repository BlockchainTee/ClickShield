import type { RiskLevel } from "../../engine/types.js";

const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

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
 * Normalizes a Bitcoin address without corrupting case-sensitive legacy/base58 forms.
 */
export function normalizeBitcoinAddress(address: string): string {
  const trimmed = address.trim();
  return /^(bc1|tb1|bcrt1)/i.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

/**
 * Validate a Bitcoin address format conservatively without requiring checksum IO.
 */
export function isValidBitcoinAddress(address: string): boolean {
  const trimmed = address.trim();

  return (
    /^(bc1|tb1|bcrt1)[a-z0-9]{11,87}$/i.test(trimmed) ||
    /^[13mn2][1-9A-HJ-NP-Za-km-z]{25,62}$/.test(trimmed)
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
