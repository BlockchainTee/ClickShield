import type { RiskLevel } from "../../engine/types.js";
import type {
  WalletFinding,
  WalletRiskFactor,
  WalletScoreBreakdown,
  WalletScoreComponent,
} from "../types.js";
import {
  SOLANA_WALLET_FINDING_CODES,
  SOLANA_WALLET_SCORE_COMPONENT_MAX,
} from "./constants.js";
import { buildStableId } from "./ids.js";
import type { SolanaWalletSignals } from "./types.js";
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
 * Builds the deterministic 0-100 score breakdown for a Phase 4D Solana scan result.
 */
export function buildSolanaWalletScoreBreakdown(
  signals: SolanaWalletSignals,
  findings: readonly WalletFinding[],
  riskFactors: readonly WalletRiskFactor[]
): WalletScoreBreakdown {
  const delegateFindings = findItemsByCode(
    findings,
    SOLANA_WALLET_FINDING_CODES.DELEGATE_AUTHORITY
  );
  const authorityFindings = findItemsByCode(
    findings,
    SOLANA_WALLET_FINDING_CODES.AUTHORITY_ASSIGNMENT
  );
  const broadPermissionFindings = findItemsByCode(
    findings,
    SOLANA_WALLET_FINDING_CODES.BROAD_PERMISSION
  );
  const riskyConnectionFindings = findItemsByCode(
    findings,
    SOLANA_WALLET_FINDING_CODES.RISKY_CONNECTION
  );
  const staleConnectionFindings = findItemsByCode(
    findings,
    SOLANA_WALLET_FINDING_CODES.STALE_RISKY_CONNECTION
  );
  const suspiciousProgramFindings = findItemsByCode(
    findings,
    SOLANA_WALLET_FINDING_CODES.SUSPICIOUS_PROGRAM
  );

  const delegatePenalty = Math.min(
    signals.delegateCount * 6 + signals.riskyDelegateCount * 8,
    SOLANA_WALLET_SCORE_COMPONENT_MAX.delegateExposure
  );
  const authorityPenalty = Math.min(
    signals.authorityAssignmentCount * 4 + signals.riskyAuthorityAssignmentCount * 5,
    SOLANA_WALLET_SCORE_COMPONENT_MAX.authorityControl
  );
  const permissionPenalty = Math.min(
    signals.broadPermissionCount * 10,
    SOLANA_WALLET_SCORE_COMPONENT_MAX.permissionBreadth
  );
  const connectionPenalty = Math.min(
    signals.riskyConnectionCount * 10 + signals.staleRiskyConnectionCount * 4,
    SOLANA_WALLET_SCORE_COMPONENT_MAX.connectionRisk
  );
  const programPenalty = Math.min(
    signals.suspiciousProgramCount * 12,
    SOLANA_WALLET_SCORE_COMPONENT_MAX.programActivity
  );

  const components = [
    buildComponent(
      "Delegate exposure",
      SOLANA_WALLET_SCORE_COMPONENT_MAX.delegateExposure,
      SOLANA_WALLET_SCORE_COMPONENT_MAX.delegateExposure - delegatePenalty,
      `${signals.delegateCount} delegated token account(s) and ${signals.riskyDelegateCount} risky delegate exposure(s) drive this component.`,
      delegateFindings,
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.DELEGATE_AUTHORITY
      )
    ),
    buildComponent(
      "Authority control",
      SOLANA_WALLET_SCORE_COMPONENT_MAX.authorityControl,
      SOLANA_WALLET_SCORE_COMPONENT_MAX.authorityControl - authorityPenalty,
      `${signals.authorityAssignmentCount} authority assignment(s) and ${signals.riskyAuthorityAssignmentCount} risky authority assignment(s) drive this component.`,
      authorityFindings,
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.AUTHORITY_ASSIGNMENT
      )
    ),
    buildComponent(
      "Permission breadth",
      SOLANA_WALLET_SCORE_COMPONENT_MAX.permissionBreadth,
      SOLANA_WALLET_SCORE_COMPONENT_MAX.permissionBreadth - permissionPenalty,
      `${signals.broadPermissionCount} broad Solana permission record(s) were supplied in the hydrated snapshot.`,
      broadPermissionFindings,
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.BROAD_PERMISSION
      )
    ),
    buildComponent(
      "Connection risk",
      SOLANA_WALLET_SCORE_COMPONENT_MAX.connectionRisk,
      SOLANA_WALLET_SCORE_COMPONENT_MAX.connectionRisk - connectionPenalty,
      `${signals.riskyConnectionCount} risky connection(s) and ${signals.staleRiskyConnectionCount} stale risky connection(s) drive this component.`,
      [...riskyConnectionFindings, ...staleConnectionFindings],
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.RISKY_CONNECTION ||
          riskFactor.metadata.code ===
            SOLANA_WALLET_FINDING_CODES.STALE_RISKY_CONNECTION
      )
    ),
    buildComponent(
      "Program activity",
      SOLANA_WALLET_SCORE_COMPONENT_MAX.programActivity,
      SOLANA_WALLET_SCORE_COMPONENT_MAX.programActivity - programPenalty,
      `${signals.suspiciousProgramCount} suspicious program interaction summary record(s) were supplied in the hydrated snapshot.`,
      suspiciousProgramFindings,
      riskFactors.filter(
        (riskFactor) =>
          riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.SUSPICIOUS_PROGRAM
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
        ? "No deterministic Solana wallet findings were produced from the hydrated snapshot."
        : "Score starts at 100 and applies fixed deductions for delegate exposure, authority control, permission breadth, risky connections, and suspicious program activity.",
    components,
  };
}
