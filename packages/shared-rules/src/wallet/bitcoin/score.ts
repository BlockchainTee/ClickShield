import type { RiskLevel } from "../../engine/types.js";
import type {
  WalletFinding,
  WalletRiskFactor,
  WalletScoreBreakdown,
  WalletScoreComponent,
} from "../types.js";
import {
  BITCOIN_WALLET_FINDING_CODES,
  BITCOIN_WALLET_SCORE_COMPONENT_MAX,
} from "./constants.js";
import { buildStableId } from "./ids.js";
import type { BitcoinWalletSignals } from "./types.js";
import { maxRiskLevel } from "./utils.js";

function scoreBand(totalScore: number): RiskLevel {
  if (totalScore >= 85) {
    return "low";
  }
  if (totalScore >= 60) {
    return "medium";
  }
  if (totalScore >= 35) {
    return "high";
  }
  return "critical";
}

function findItemsByCode<T extends { readonly metadata: Readonly<Record<string, string>> }>(
  items: readonly T[],
  code: string
): readonly T[] {
  return items.filter((item) => item.metadata.code === code);
}

function buildComponent(
  label: string,
  maxScore: number,
  score: number,
  rationale: string,
  findings: readonly WalletFinding[],
  riskFactors: readonly WalletRiskFactor[]
): WalletScoreComponent {
  return {
    componentId: buildStableId("wallet_component", {
      label,
      maxScore,
      score,
    }),
    label,
    score,
    maxScore,
    riskLevel: maxRiskLevel(
      [
        ...findings.map((finding) => finding.riskLevel),
        ...riskFactors.map((riskFactor) => riskFactor.riskLevel),
      ],
      score === maxScore ? "low" : "medium"
    ),
    rationale,
    findingIds: findings.map((finding) => finding.findingId),
    riskFactorIds: riskFactors.map((riskFactor) => riskFactor.factorId),
  };
}

/**
 * Builds the deterministic 0-100 score breakdown for a Phase 4E Bitcoin scan result.
 */
export function buildBitcoinWalletScoreBreakdown(
  signals: BitcoinWalletSignals,
  findings: readonly WalletFinding[],
  riskFactors: readonly WalletRiskFactor[]
): WalletScoreBreakdown {
  const addressReuseFindings = findItemsByCode(
    findings,
    BITCOIN_WALLET_FINDING_CODES.ADDRESS_REUSE
  );
  const privacyFindings = findItemsByCode(
    findings,
    BITCOIN_WALLET_FINDING_CODES.PRIVACY_EXPOSURE
  );
  const fragmentedUtxoFindings = findItemsByCode(
    findings,
    BITCOIN_WALLET_FINDING_CODES.FRAGMENTED_UTXO_STRUCTURE
  );
  const concentratedUtxoFindings = findItemsByCode(
    findings,
    BITCOIN_WALLET_FINDING_CODES.CONCENTRATED_UTXO_STRUCTURE
  );
  const hygieneFindings = findItemsByCode(
    findings,
    BITCOIN_WALLET_FINDING_CODES.POOR_WALLET_HYGIENE
  );
  const exposedReceiveFindings = findItemsByCode(
    findings,
    BITCOIN_WALLET_FINDING_CODES.REPEATED_EXPOSED_RECEIVE
  );

  const addressReusePenalty = Math.min(
    signals.reusedAddressCount * 8,
    BITCOIN_WALLET_SCORE_COMPONENT_MAX.addressReuse
  );
  const privacyPenalty = Math.min(
    signals.privacyExposureCount * 7,
    BITCOIN_WALLET_SCORE_COMPONENT_MAX.privacyExposure
  );
  const fragmentationPenalty =
    signals.fragmentationLevel === "high"
      ? BITCOIN_WALLET_SCORE_COMPONENT_MAX.utxoFragmentation
      : signals.fragmentationLevel === "medium"
        ? 10
        : 0;
  const concentrationPenalty =
    signals.concentrationLevel === "high"
      ? BITCOIN_WALLET_SCORE_COMPONENT_MAX.concentration
      : signals.concentrationLevel === "medium"
        ? 7
        : 0;
  const hygienePenalty = Math.min(
    signals.poorHygieneCount * 7,
    BITCOIN_WALLET_SCORE_COMPONENT_MAX.operationalHygiene
  );
  const exposedReceivePenalty = Math.min(
    signals.exposedReceivingPatternCount * 8,
    BITCOIN_WALLET_SCORE_COMPONENT_MAX.exposedReceiveBehavior
  );

  const components = [
    buildComponent(
      "Address reuse",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.addressReuse,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.addressReuse - addressReusePenalty,
      `${signals.reusedAddressCount} reused Bitcoin address(es) drive this component.`,
      addressReuseFindings,
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code === BITCOIN_WALLET_FINDING_CODES.ADDRESS_REUSE
      )
    ),
    buildComponent(
      "Privacy exposure",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.privacyExposure,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.privacyExposure - privacyPenalty,
      `${signals.privacyExposureCount} privacy exposure indicator(s) were supplied or derived from the hydrated snapshot.`,
      privacyFindings,
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code ===
          BITCOIN_WALLET_FINDING_CODES.PRIVACY_EXPOSURE
      )
    ),
    buildComponent(
      "UTXO fragmentation",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.utxoFragmentation,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.utxoFragmentation - fragmentationPenalty,
      `${signals.smallUtxoCount} small UTXO(s) across ${signals.totalUtxoCount} visible UTXO(s) drive this component.`,
      fragmentedUtxoFindings,
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code ===
          BITCOIN_WALLET_FINDING_CODES.FRAGMENTED_UTXO_STRUCTURE
      )
    ),
    buildComponent(
      "UTXO concentration",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.concentration,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.concentration - concentrationPenalty,
      `The largest UTXO represents ${signals.largestUtxoShareBasisPoints / 100}% of the visible wallet balance.`,
      concentratedUtxoFindings,
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code ===
          BITCOIN_WALLET_FINDING_CODES.CONCENTRATED_UTXO_STRUCTURE
      )
    ),
    buildComponent(
      "Operational hygiene",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.operationalHygiene,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.operationalHygiene - hygienePenalty,
      `${signals.poorHygieneCount} caller-supplied wallet hygiene record(s) drive this component.`,
      hygieneFindings,
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code ===
          BITCOIN_WALLET_FINDING_CODES.POOR_WALLET_HYGIENE
      )
    ),
    buildComponent(
      "Exposed receive behavior",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.exposedReceiveBehavior,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.exposedReceiveBehavior -
        exposedReceivePenalty,
      `${signals.exposedReceivingPatternCount} repeated exposed receive pattern(s) drive this component.`,
      exposedReceiveFindings,
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code ===
          BITCOIN_WALLET_FINDING_CODES.REPEATED_EXPOSED_RECEIVE
      )
    ),
  ];

  const totalScore = components.reduce((sum, component) => sum + component.score, 0);
  const findingRiskLevel = maxRiskLevel(
    findings.map((finding) => finding.riskLevel),
    "low"
  );
  const riskLevel = maxRiskLevel([scoreBand(totalScore), findingRiskLevel], "low");

  return {
    totalScore,
    riskLevel,
    rationale:
      findings.length === 0
        ? "No deterministic Bitcoin wallet findings were produced from the hydrated snapshot."
        : "Score starts at 100 and applies fixed deductions for address reuse, privacy exposure, UTXO fragmentation, UTXO concentration, operational hygiene, and exposed receive behavior.",
    components,
  };
}
