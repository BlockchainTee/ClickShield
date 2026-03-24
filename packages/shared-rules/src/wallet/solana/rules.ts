import type { RiskLevel } from "../../engine/types.js";
import type {
  WalletEvidenceRef,
  WalletExposureCategory,
} from "../types.js";
import {
  SOLANA_CONNECTION_STALE_DAYS,
  SOLANA_WALLET_FINDING_CODES,
  type SolanaWalletFindingCode,
} from "./constants.js";
import { buildStableId } from "./ids.js";
import type {
  NormalizedSolanaAuthorityAssignment,
  NormalizedSolanaConnectionRecord,
  NormalizedSolanaProgramExposure,
  NormalizedSolanaTokenAccountState,
  NormalizedSolanaWalletSnapshot,
  SolanaWalletSignals,
} from "./types.js";
import { hasSevereFlag, uniqueSorted } from "./utils.js";

/**
 * Internal finding draft assembled before shared Layer 4A identifiers are attached.
 */
export interface SolanaWalletFindingDraft {
  readonly code: SolanaWalletFindingCode;
  readonly category: WalletExposureCategory;
  readonly riskLevel: RiskLevel;
  readonly title: string;
  readonly summary: string;
  readonly resourceIds: readonly string[];
  readonly evidence: readonly WalletEvidenceRef[];
  readonly metadata: Readonly<Record<string, string>>;
}

function buildEvidenceRefs(
  sourceSectionIds: readonly string[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  const sectionIds = uniqueSorted(sourceSectionIds.filter(Boolean));
  if (sectionIds.length > 0) {
    return sectionIds.map((sectionId) => ({
      evidenceId: buildStableId("wallet_evidence", {
        fallbackLabel,
        sectionId,
      }),
      sourceType: "snapshot_section",
      sourceId: sectionId,
      label: `Snapshot section: ${sectionId}`,
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

function tokenAccountEvidence(
  tokenAccounts: readonly NormalizedSolanaTokenAccountState[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  return buildEvidenceRefs(
    tokenAccounts.map((tokenAccount) => tokenAccount.sourceSectionId ?? ""),
    fallbackLabel
  );
}

function authorityEvidence(
  assignments: readonly NormalizedSolanaAuthorityAssignment[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  return buildEvidenceRefs(
    assignments.map((assignment) => assignment.sourceSectionId ?? ""),
    fallbackLabel
  );
}

function connectionEvidence(
  connections: readonly NormalizedSolanaConnectionRecord[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  return buildEvidenceRefs(
    connections.map((connection) => connection.sourceSectionId ?? ""),
    fallbackLabel
  );
}

function programEvidence(
  programExposures: readonly NormalizedSolanaProgramExposure[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  return buildEvidenceRefs(
    programExposures.map((programExposure) => programExposure.sourceSectionId ?? ""),
    fallbackLabel
  );
}

/**
 * Builds deterministic Solana wallet findings from normalized Solana exposure state.
 */
export function buildSolanaWalletFindings(
  snapshot: NormalizedSolanaWalletSnapshot,
  signals: SolanaWalletSignals
): readonly SolanaWalletFindingDraft[] {
  const drafts: SolanaWalletFindingDraft[] = [];
  const delegatedAccounts = snapshot.tokenAccounts.filter(
    (tokenAccount) => tokenAccount.hasDelegate
  );
  const riskyDelegates = delegatedAccounts.filter(
    (tokenAccount) => tokenAccount.isRiskyDelegate
  );
  const broadConnections = snapshot.connections.filter(
    (connection) => connection.isBroadPermission
  );
  const riskyConnections = snapshot.connections.filter(
    (connection) => connection.isRisky
  );
  const staleRiskyConnections = riskyConnections.filter(
    (connection) => connection.isStaleRisky
  );
  const suspiciousPrograms = snapshot.programExposures.filter(
    (programExposure) => programExposure.isSuspicious
  );
  const authorityAssignments = snapshot.authorityAssignments;
  const riskyAuthorityAssignments = authorityAssignments.filter(
    (assignment) => assignment.isRisky
  );

  if (delegatedAccounts.length > 0) {
    const severe = riskyDelegates.some(
      (tokenAccount) =>
        tokenAccount.delegateRiskLevel === "critical" ||
        hasSevereFlag(tokenAccount.delegateFlags)
    );
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.DELEGATE_AUTHORITY,
      category: "authorization",
      riskLevel: severe ? "critical" : riskyDelegates.length > 0 ? "high" : "medium",
      title: "Delegate authority exposure",
      summary: `${delegatedAccounts.length} token account${
        delegatedAccounts.length === 1 ? "" : "s"
      } still grant delegate authority${
        riskyDelegates.length > 0
          ? `, including ${riskyDelegates.length} marked risky`
          : ""
      }.`,
      resourceIds: uniqueSorted(
        delegatedAccounts.map((tokenAccount) => tokenAccount.resourceId)
      ),
      evidence: tokenAccountEvidence(
        delegatedAccounts,
        "Solana delegate authority exposure"
      ),
      metadata: {
        code: SOLANA_WALLET_FINDING_CODES.DELEGATE_AUTHORITY,
        delegateCount: String(delegatedAccounts.length),
        riskyDelegateCount: String(riskyDelegates.length),
      },
    });
  }

  if (authorityAssignments.length > 0) {
    const severe = riskyAuthorityAssignments.some(
      (assignment) =>
        assignment.riskLevel === "critical" || hasSevereFlag(assignment.flags)
    );
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.AUTHORITY_ASSIGNMENT,
      category: "authorization",
      riskLevel:
        severe ? "critical" : riskyAuthorityAssignments.length > 0 ? "high" : "medium",
      title: "Authority assignment exposure",
      summary: `${authorityAssignments.length} authority assignment${
        authorityAssignments.length === 1 ? "" : "s"
      } were supplied for manual review.`,
      resourceIds: uniqueSorted(
        authorityAssignments.map((assignment) => assignment.resourceId)
      ),
      evidence: authorityEvidence(
        authorityAssignments,
        "Solana authority assignment exposure"
      ),
      metadata: {
        authorityAssignmentCount: String(authorityAssignments.length),
        code: SOLANA_WALLET_FINDING_CODES.AUTHORITY_ASSIGNMENT,
        riskyAuthorityAssignmentCount: String(riskyAuthorityAssignments.length),
      },
    });
  }

  if (broadConnections.length > 0) {
    const riskyBroadConnections = broadConnections.filter(
      (connection) => connection.isRisky
    );
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.BROAD_PERMISSION,
      category: "authorization",
      riskLevel:
        riskyBroadConnections.length > 0 || broadConnections.length > 1
          ? "high"
          : "medium",
      title: "Broad wallet permission exposure",
      summary: `${broadConnections.length} connected app${
        broadConnections.length === 1 ? "" : "s"
      } retain broad Solana wallet permissions and should be reviewed.`,
      resourceIds: uniqueSorted(
        broadConnections.map((connection) => connection.resourceId)
      ),
      evidence: connectionEvidence(
        broadConnections,
        "Solana broad permission exposure"
      ),
      metadata: {
        broadPermissionCount: String(signals.broadPermissionCount),
        code: SOLANA_WALLET_FINDING_CODES.BROAD_PERMISSION,
      },
    });
  }

  if (riskyConnections.length > 0) {
    const severe = riskyConnections.some(
      (connection) =>
        connection.riskLevel === "critical" || hasSevereFlag(connection.flags)
    );
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.RISKY_CONNECTION,
      category: "counterparty",
      riskLevel: severe ? "critical" : "high",
      title: "Risky connected app exposure",
      summary: `${riskyConnections.length} connected app${
        riskyConnections.length === 1 ? "" : "s"
      } were marked risky in the hydrated Solana snapshot.`,
      resourceIds: uniqueSorted(
        riskyConnections.map((connection) => connection.resourceId)
      ),
      evidence: connectionEvidence(
        riskyConnections,
        "Solana risky connection exposure"
      ),
      metadata: {
        code: SOLANA_WALLET_FINDING_CODES.RISKY_CONNECTION,
        riskyConnectionCount: String(signals.riskyConnectionCount),
      },
    });
  }

  if (staleRiskyConnections.length > 0) {
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.STALE_RISKY_CONNECTION,
      category: "counterparty",
      riskLevel: staleRiskyConnections.length >= 3 ? "high" : "medium",
      title: "Stale risky connection remains linked",
      summary: `${staleRiskyConnections.length} risky connection${
        staleRiskyConnections.length === 1 ? "" : "s"
      } have been inactive for at least ${SOLANA_CONNECTION_STALE_DAYS} days.`,
      resourceIds: uniqueSorted(
        staleRiskyConnections.map((connection) => connection.resourceId)
      ),
      evidence: connectionEvidence(
        staleRiskyConnections,
        "Solana stale risky connection exposure"
      ),
      metadata: {
        code: SOLANA_WALLET_FINDING_CODES.STALE_RISKY_CONNECTION,
        staleRiskyConnectionCount: String(signals.staleRiskyConnectionCount),
      },
    });
  }

  if (suspiciousPrograms.length > 0) {
    const severe = suspiciousPrograms.some(
      (programExposure) =>
        programExposure.riskLevel === "critical" ||
        hasSevereFlag(programExposure.flags)
    );
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.SUSPICIOUS_PROGRAM,
      category: "activity",
      riskLevel: severe ? "critical" : "high",
      title: "Suspicious program interaction",
      summary: `${suspiciousPrograms.length} risky program interaction summary${
        suspiciousPrograms.length === 1 ? "" : "s"
      } were supplied for review.`,
      resourceIds: uniqueSorted(
        suspiciousPrograms.map((programExposure) => programExposure.resourceId)
      ),
      evidence: programEvidence(
        suspiciousPrograms,
        "Solana suspicious program interaction"
      ),
      metadata: {
        code: SOLANA_WALLET_FINDING_CODES.SUSPICIOUS_PROGRAM,
        suspiciousProgramCount: String(signals.suspiciousProgramCount),
      },
    });
  }

  return drafts;
}
