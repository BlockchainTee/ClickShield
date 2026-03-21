import type { NavigationInput } from "../engine/types.js";
import punycode from "punycode/";

/**
 * Output of domain entropy signal extraction.
 */
export interface DomainEntropySignals {
  hostname: string;
  label: string;
  length: number;
  digitRatio: number;
  consonantStreak: number;
  entropyScore: number;
  isHighEntropy: boolean;
}

/**
 * Extract hostname safely with IDN normalization.
 */
function extractHostname(input: NavigationInput): string {
  try {
    const parsed = new URL(input.rawUrl);
    return punycode.toUnicode(parsed.hostname).toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Extract second-level label for entropy analysis.
 */
function extractLabel(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return parts[0] ?? "";
}

/**
 * Calculates digit ratio.
 */
function calculateDigitRatio(input: string): number {
  if (input.length === 0) return 0;

  let digits = 0;

  for (const ch of input) {
    if (/\d/.test(ch)) {
      digits++;
    }
  }

  return digits / input.length;
}

/**
 * Calculates maximum consonant streak.
 */
function calculateConsonantStreak(input: string): number {
  let maxStreak = 0;
  let current = 0;

  for (const ch of input) {
    if (/[bcdfghjklmnpqrstvwxyz]/i.test(ch)) {
      current++;
      if (current > maxStreak) {
        maxStreak = current;
      }
    } else {
      current = 0;
    }
  }

  return maxStreak;
}

/**
 * Calculates entropy score.
 */
function calculateEntropyScore(
  length: number,
  digitRatio: number,
  consonantStreak: number
): number {
  return length * 0.5 + digitRatio * 10 + consonantStreak * 1.5;
}

/**
 * Extract entropy signals.
 */
export function getDomainEntropySignals(
  input: NavigationInput
): DomainEntropySignals {
  const hostname = extractHostname(input);
  const label = extractLabel(hostname);

  const length = label.length;
  const digitRatio = calculateDigitRatio(label);
  const consonantStreak = calculateConsonantStreak(label);

  const entropyScore = calculateEntropyScore(
    length,
    digitRatio,
    consonantStreak
  );

  const isHighEntropy =
    length >= 12 &&
    (digitRatio >= 0.3 ||
      consonantStreak >= 5 ||
      entropyScore >= 15);

  return {
    hostname,
    label,
    length,
    digitRatio,
    consonantStreak,
    entropyScore,
    isHighEntropy,
  };
}
