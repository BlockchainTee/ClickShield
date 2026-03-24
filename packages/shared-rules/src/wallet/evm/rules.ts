import type { RiskLevel } from "../../engine/types.js";
import type {
  WalletEvidenceRef,
  WalletExposureCategory,
} from "../types.js";
import {
  EVM_APPROVAL_STALE_DAYS,
  EVM_EXCESSIVE_APPROVAL_THRESHOLD,
  EVM_SEVERE_APPROVAL_THRESHOLD,
  EVM_WALLET_FINDING_CODES,
  type EvmWalletFindingCode,
} from "./constants.js";
import { buildStableId } from "./ids.js";
import type {
  EvmWalletSignals,
  NormalizedEvmApprovalState,
  NormalizedEvmContractExposure,
  NormalizedEvmWalletSnapshot,
} from "./types.js";

/**
 * Internal finding draft assembled before shared Layer 4A identifiers are attached.
 */
export interface EvmWalletFindingDraft {
  readonly code: EvmWalletFindingCode;
  readonly category: WalletExposureCategory;
  readonly riskLevel: RiskLevel;
  readonly title: string;
  readonly summary: string;
  readonly resourceIds: readonly string[];
  readonly evidence: readonly WalletEvidenceRef[];
  readonly metadata: Readonly<Record<string, string>>;
}

function compareRiskLevel(left: RiskLevel, right: RiskLevel): number {
  const order: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  return order[left] - order[right];
}

function maxRiskLevel(levels: readonly RiskLevel[], fallback: RiskLevel): RiskLevel {
  return levels.reduce(
    (current, candidate) =>
      compareRiskLevel(candidate, current) > 0 ? candidate : current,
    fallback
  );
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function isSevereFlag(flags: readonly string[]): boolean {
  return flags.some((flag) =>
    ["drainer", "malicious", "phishing", "exploit", "sanctioned"].includes(flag)
  );
}

function buildEvidenceRefs(
  snapshot: NormalizedEvmWalletSnapshot,
  sourceSectionIds: readonly string[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  const sectionIds = uniqueSorted(sourceSectionIds.filter(Boolean));
  if (sectionIds.length > 0) {
    return sectionIds.map((sectionId) => ({
      evidenceId: buildStableId("wallet_evidence", {
        sectionId,
        fallbackLabel,
      }),
      sourceType: "snapshot_section",
      sourceId: sectionId,
      label:
        snapshot.capturedAt && sectionId
          ? `Snapshot section: ${sectionId}`
          : fallbackLabel,
    }));
  }

  return [
    {
      evidenceId: buildStableId("wallet_evidence", {
        fallbackLabel,
      }),
      sourceType: "derived",
      sourceId: fallbackLabel.toLowerCase().replace(/\s+/g, "_"),
      label: fallbackLabel,
    },
  ];
}

function approvalEvidence(
  snapshot: NormalizedEvmWalletSnapshot,
  approvals: readonly NormalizedEvmApprovalState[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  return buildEvidenceRefs(
    snapshot,
    approvals.map((approval) => approval.sourceSectionId ?? ""),
    fallbackLabel
  );
}

function contractEvidence(
  snapshot: NormalizedEvmWalletSnapshot,
  exposures: readonly NormalizedEvmContractExposure[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  return buildEvidenceRefs(
    snapshot,
    exposures.map((exposure) => exposure.sourceSectionId ?? ""),
    fallbackLabel
  );
}

/**
 * Builds deterministic EVM wallet findings from normalized approvals and signals.
 */
export function buildEvmWalletFindings(
  snapshot: NormalizedEvmWalletSnapshot,
  signals: EvmWalletSignals
): readonly EvmWalletFindingDraft[] {
  const drafts: EvmWalletFindingDraft[] = [];
  const approvals = snapshot.approvals;
  const flaggedApprovals = approvals.filter(
    (approval) => approval.spenderDisposition === "flagged"
  );
  const riskyExposures = snapshot.contractExposures.filter(
    (exposure) => exposure.isRisky
  );
  const unlimitedApprovals = approvals.filter((approval) => approval.isUnlimited);
  const staleApprovals = approvals.filter((approval) => approval.isStale);

  if (flaggedApprovals.length > 0) {
    const severe = flaggedApprovals.some(
      (approval) =>
        approval.spenderRiskLevel === "critical" ||
        isSevereFlag(approval.spenderFlags)
    );
    drafts.push({
      code: EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER,
      category: "counterparty",
      riskLevel: severe ? "critical" : "high",
      title: "Flagged spender exposure",
      summary: `${flaggedApprovals.length} approval${
        flaggedApprovals.length === 1 ? "" : "s"
      } target flagged spenders and should be reviewed first.`,
      resourceIds: uniqueSorted(flaggedApprovals.map((approval) => approval.approvalId)),
      evidence: approvalEvidence(snapshot, flaggedApprovals, "Flagged spender exposure"),
      metadata: {
        approvalCount: String(flaggedApprovals.length),
        code: EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER,
        highestSpenderRisk: maxRiskLevel(
          flaggedApprovals
            .map((approval) => approval.spenderRiskLevel)
            .filter((level): level is RiskLevel => level !== null),
          severe ? "critical" : "high"
        ),
      },
    });
  }

  if (riskyExposures.length > 0) {
    const severe = riskyExposures.some(
      (exposure) =>
        exposure.riskLevel === "critical" || isSevereFlag(exposure.flags)
    );
    drafts.push({
      code: EVM_WALLET_FINDING_CODES.RISKY_CONTRACT,
      category: "counterparty",
      riskLevel: severe ? "critical" : "high",
      title: "Risky contract exposure",
      summary: `${riskyExposures.length} risky contract exposure${
        riskyExposures.length === 1 ? "" : "s"
      } were supplied in the hydrated snapshot.`,
      resourceIds: uniqueSorted(riskyExposures.map((exposure) => exposure.resourceId)),
      evidence: contractEvidence(snapshot, riskyExposures, "Risky contract exposure"),
      metadata: {
        code: EVM_WALLET_FINDING_CODES.RISKY_CONTRACT,
        exposureCount: String(riskyExposures.length),
      },
    });
  }

  if (unlimitedApprovals.length > 0) {
    const unknownCount = unlimitedApprovals.filter(
      (approval) => approval.spenderDisposition === "unknown"
    ).length;
    const hasCriticalExposure = unlimitedApprovals.some(
      (approval) =>
        approval.spenderDisposition === "flagged" ||
        approval.hasRiskyContractExposure
    );
    drafts.push({
      code: EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL,
      category: "authorization",
      riskLevel: hasCriticalExposure
        ? "critical"
        : unknownCount > 0
          ? "high"
          : "medium",
      title: "Unlimited approvals remain active",
      summary: `${unlimitedApprovals.length} unlimited approval${
        unlimitedApprovals.length === 1 ? "" : "s"
      } remain active; ${unknownCount} target unknown spenders.`,
      resourceIds: uniqueSorted(unlimitedApprovals.map((approval) => approval.approvalId)),
      evidence: approvalEvidence(snapshot, unlimitedApprovals, "Unlimited approval exposure"),
      metadata: {
        code: EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL,
        riskyApprovalCount: String(
          unlimitedApprovals.filter((approval) => approval.hasRiskyContractExposure).length
        ),
        unknownSpenderCount: String(unknownCount),
        unlimitedApprovalCount: String(unlimitedApprovals.length),
      },
    });
  }

  if (staleApprovals.length > 0) {
    drafts.push({
      code: EVM_WALLET_FINDING_CODES.STALE_APPROVAL,
      category: "authorization",
      riskLevel: staleApprovals.length >= 5 ? "high" : "medium",
      title: "Stale approvals still exist",
      summary: `${staleApprovals.length} approval${
        staleApprovals.length === 1 ? "" : "s"
      } are at least ${EVM_APPROVAL_STALE_DAYS} days old.`,
      resourceIds: uniqueSorted(staleApprovals.map((approval) => approval.approvalId)),
      evidence: approvalEvidence(snapshot, staleApprovals, "Stale approval exposure"),
      metadata: {
        code: EVM_WALLET_FINDING_CODES.STALE_APPROVAL,
        staleApprovalCount: String(staleApprovals.length),
      },
    });
  }

  if (signals.hasExcessiveApprovals) {
    drafts.push({
      code: EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS,
      category: "authorization",
      riskLevel:
        signals.approvalCount >= EVM_SEVERE_APPROVAL_THRESHOLD ? "high" : "medium",
      title: "Approval count exceeds review threshold",
      summary: `Wallet currently carries ${signals.approvalCount} active approvals, above the review threshold of ${EVM_EXCESSIVE_APPROVAL_THRESHOLD}.`,
      resourceIds: uniqueSorted(approvals.map((approval) => approval.approvalId)),
      evidence: approvalEvidence(snapshot, approvals, "Excessive approval exposure"),
      metadata: {
        approvalCount: String(signals.approvalCount),
        code: EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS,
      },
    });
  }

  return drafts;
}
