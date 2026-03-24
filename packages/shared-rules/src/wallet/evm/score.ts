import type { RiskLevel } from "../../engine/types.js";
import type {
  WalletFinding,
  WalletRiskFactor,
  WalletScoreBreakdown,
  WalletScoreComponent,
} from "../types.js";
import {
  EVM_EXCESSIVE_APPROVAL_THRESHOLD,
  EVM_SEVERE_APPROVAL_THRESHOLD,
  EVM_WALLET_FINDING_CODES,
  EVM_WALLET_SCORE_COMPONENT_MAX,
} from "./constants.js";
import { buildStableId } from "./ids.js";
import type {
  EvmWalletSignals,
  NormalizedEvmWalletSnapshot,
} from "./types.js";

const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function maxRiskLevel(levels: readonly RiskLevel[], fallback: RiskLevel): RiskLevel {
  return levels.reduce(
    (current, candidate) =>
      RISK_LEVEL_ORDER[candidate] > RISK_LEVEL_ORDER[current] ? candidate : current,
    fallback
  );
}

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
  factors: readonly WalletRiskFactor[]
): WalletScoreComponent {
  return {
    componentId: buildStableId("wallet_component", {
      label,
      score,
      maxScore,
    }),
    label,
    score,
    maxScore,
    riskLevel: maxRiskLevel(
      [...findings.map((finding) => finding.riskLevel), ...factors.map((factor) => factor.riskLevel)],
      score === maxScore ? "low" : "medium"
    ),
    rationale,
    findingIds: findings.map((finding) => finding.findingId),
    riskFactorIds: factors.map((factor) => factor.factorId),
  };
}

/**
 * Builds the deterministic 0-100 score breakdown for a Phase 4B EVM scan result.
 */
export function buildEvmWalletScoreBreakdown(
  _snapshot: NormalizedEvmWalletSnapshot,
  signals: EvmWalletSignals,
  findings: readonly WalletFinding[],
  riskFactors: readonly WalletRiskFactor[]
): WalletScoreBreakdown {
  const unlimitedFindings = findItemsByCode(
    findings,
    EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL
  );
  const flaggedFindings = findItemsByCode(
    findings,
    EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER
  );
  const staleFindings = findItemsByCode(
    findings,
    EVM_WALLET_FINDING_CODES.STALE_APPROVAL
  );
  const excessiveFindings = findItemsByCode(
    findings,
    EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS
  );
  const contractFindings = findItemsByCode(
    findings,
    EVM_WALLET_FINDING_CODES.RISKY_CONTRACT
  );

  const unlimitedPenalty = Math.min(signals.unlimitedApprovalCount * 10, 24);
  const approvalCountPenalty =
    signals.approvalCount >= EVM_SEVERE_APPROVAL_THRESHOLD
      ? 16
      : signals.approvalCount >= EVM_EXCESSIVE_APPROVAL_THRESHOLD
        ? 8
        : 0;
  const authorizationScore =
    EVM_WALLET_SCORE_COMPONENT_MAX.authorizationHygiene -
    Math.min(
      EVM_WALLET_SCORE_COMPONENT_MAX.authorizationHygiene,
      unlimitedPenalty + approvalCountPenalty
    );

  const flaggedPenalty = Math.min(signals.flaggedSpenderCount * 12, 25);
  const unknownUnlimitedPenalty = Math.min(
    signals.unknownUnlimitedApprovalCount * 6,
    12
  );
  const spenderTrustScore =
    EVM_WALLET_SCORE_COMPONENT_MAX.spenderTrust -
    Math.min(
      EVM_WALLET_SCORE_COMPONENT_MAX.spenderTrust,
      flaggedPenalty + unknownUnlimitedPenalty
    );

  const stalePenalty = Math.min(signals.staleApprovalCount * 5, 15);
  const freshnessScore =
    EVM_WALLET_SCORE_COMPONENT_MAX.approvalFreshness - stalePenalty;

  const contractPenalty = Math.min(signals.riskyContractExposureCount * 10, 20);
  const contractExposureScore =
    EVM_WALLET_SCORE_COMPONENT_MAX.contractExposure - contractPenalty;

  const components = [
    buildComponent(
      "Authorization hygiene",
      EVM_WALLET_SCORE_COMPONENT_MAX.authorizationHygiene,
      authorizationScore,
      `${signals.unlimitedApprovalCount} unlimited approval(s) and ${signals.approvalCount} active approval(s) drive this component.`,
      [...unlimitedFindings, ...excessiveFindings],
      riskFactors.filter(
        (factor) =>
          factor.metadata.code === EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL ||
          factor.metadata.code === EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS
      )
    ),
    buildComponent(
      "Spender trust",
      EVM_WALLET_SCORE_COMPONENT_MAX.spenderTrust,
      spenderTrustScore,
      `${signals.flaggedSpenderCount} approval(s) point to flagged spenders and ${signals.unknownUnlimitedApprovalCount} unlimited approval(s) point to unknown spenders.`,
      [...flaggedFindings, ...unlimitedFindings],
      riskFactors.filter(
        (factor) =>
          factor.metadata.code === EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER ||
          factor.metadata.code === EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL
      )
    ),
    buildComponent(
      "Approval freshness",
      EVM_WALLET_SCORE_COMPONENT_MAX.approvalFreshness,
      freshnessScore,
      `${signals.staleApprovalCount} approval(s) exceeded the stale threshold.`,
      staleFindings,
      riskFactors.filter(
        (factor) => factor.metadata.code === EVM_WALLET_FINDING_CODES.STALE_APPROVAL
      )
    ),
    buildComponent(
      "Contract exposure",
      EVM_WALLET_SCORE_COMPONENT_MAX.contractExposure,
      contractExposureScore,
      `${signals.riskyContractExposureCount} risky contract exposure(s) were supplied in the hydrated snapshot.`,
      contractFindings,
      riskFactors.filter(
        (factor) => factor.metadata.code === EVM_WALLET_FINDING_CODES.RISKY_CONTRACT
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
        ? "No deterministic EVM approval findings were produced from the hydrated snapshot."
        : `Score starts at 100 and applies fixed deductions for authorization hygiene, spender trust, approval freshness, and risky contract exposure.`,
    components,
  };
}
