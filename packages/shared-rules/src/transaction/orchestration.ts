import type { TransactionVerdict } from "../engine/types.js";
import { analyzeTransactions, type TransactionAnalytics } from "./analytics.js";
import type { TransactionAuditRecord } from "./audit.js";
import { deriveUserProtectionProfile, type UserProtectionProfile } from "./protection.js";
import type {
  TransactionExplanation,
  TransactionRiskClassification,
  TransactionSignals,
} from "./types.js";

export interface TransactionDecisionPackage {
  readonly verdict: TransactionVerdict;
  readonly explanation: TransactionExplanation;
  readonly audit: TransactionAuditRecord;
  readonly analytics: TransactionAnalytics;
  readonly protection: UserProtectionProfile;
  readonly readiness: {
    readonly hasExplanation: boolean;
    readonly hasAudit: boolean;
    readonly hasAnalytics: boolean;
    readonly hasProtectionProfile: boolean;
    readonly complete: boolean;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidExplanationStatus(
  value: unknown
): value is TransactionExplanation["status"] {
  return value === "block" || value === "warn" || value === "allow";
}

function isValidExplanationRiskLevel(
  value: unknown
): value is TransactionExplanation["riskLevel"] {
  return value === "high" || value === "medium" || value === "low";
}

function isValidAuditStatus(
  value: unknown
): value is TransactionAuditRecord["status"] {
  return value === "block" || value === "warn" || value === "allow";
}

function isValidSignalActionType(value: unknown): boolean {
  return (
    value === "approve" ||
    value === "setApprovalForAll" ||
    value === "increaseAllowance" ||
    value === "permit" ||
    value === "transfer" ||
    value === "transferFrom" ||
    value === "multicall" ||
    value === "unknown"
  );
}

function isValidApprovalDirection(value: unknown): boolean {
  return (
    value === "grant" || value === "revoke" || value === "not_applicable"
  );
}

function isTransactionSignals(value: unknown): value is TransactionSignals {
  return (
    isRecord(value) &&
    typeof value.isContractInteraction === "boolean" &&
    typeof value.isNativeTransfer === "boolean" &&
    (value.methodName === undefined || typeof value.methodName === "string") &&
    typeof value.isApproval === "boolean" &&
    isValidSignalActionType(value.actionType) &&
    typeof value.isApprovalMethod === "boolean" &&
    typeof value.isUnlimitedApproval === "boolean" &&
    typeof value.hasValueTransfer === "boolean" &&
    typeof value.isHighValue === "boolean" &&
    (value.targetAddress === undefined || typeof value.targetAddress === "string") &&
    typeof value.isPermitSignature === "boolean" &&
    typeof value.isSetApprovalForAll === "boolean" &&
    isValidApprovalDirection(value.approvalDirection) &&
    (typeof value.spenderTrusted === "boolean" || value.spenderTrusted === null) &&
    (typeof value.recipientIsNew === "boolean" ||
      value.recipientIsNew === null) &&
    typeof value.isTransfer === "boolean" &&
    typeof value.isTransferFrom === "boolean" &&
    typeof value.isMulticall === "boolean" &&
    typeof value.containsApprovalAndTransfer === "boolean" &&
    typeof value.containsApproval === "boolean" &&
    typeof value.containsTransfer === "boolean" &&
    typeof value.containsTransferFrom === "boolean" &&
    typeof value.batchActionCount === "number" &&
    Number.isFinite(value.batchActionCount) &&
    typeof value.hasNativeValue === "boolean" &&
    typeof value.touchesMaliciousContract === "boolean" &&
    typeof value.targetAllowlisted === "boolean" &&
    typeof value.signatureIntelMatch === "boolean" &&
    typeof value.verifyingContractKnown === "boolean" &&
    typeof value.hasUnknownInnerCall === "boolean"
  );
}

function isTransactionRiskClassification(
  value: unknown
): value is TransactionRiskClassification {
  return (
    isRecord(value) &&
    typeof value.hasMaliciousTarget === "boolean" &&
    typeof value.hasKnownScamSignature === "boolean" &&
    typeof value.isApprovalRisk === "boolean" &&
    typeof value.isUnlimitedApprovalRisk === "boolean" &&
    typeof value.isPermitRisk === "boolean" &&
    typeof value.isHighValueTransferRisk === "boolean" &&
    typeof value.isUnknownMethodRisk === "boolean" &&
    typeof value.requiresUserAttention === "boolean"
  );
}

function isTransactionExplanation(value: unknown): value is TransactionExplanation {
  if (!isRecord(value) || !isRecord(value.details)) {
    return false;
  }

  return (
    isValidExplanationStatus(value.status) &&
    isNonEmptyString(value.summary) &&
    isNonEmptyString(value.primaryReason) &&
    Array.isArray(value.secondaryReasons) &&
    isValidExplanationRiskLevel(value.riskLevel) &&
    typeof value.details.isContractInteraction === "boolean"
  );
}

function isTransactionAuditRecord(value: unknown): value is TransactionAuditRecord {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.timestamp) &&
    isValidAuditStatus(value.status) &&
    isTransactionExplanation(value.explanation) &&
    isTransactionSignals(value.signals) &&
    isTransactionRiskClassification(value.classification) &&
    isRecord(value.metadata) &&
    (value.metadata.source === "extension" ||
      value.metadata.source === "mobile" ||
      value.metadata.source === "desktop")
  );
}

function isTransactionAnalytics(value: unknown): value is TransactionAnalytics {
  return (
    isRecord(value) &&
    typeof value.totalTransactions === "number" &&
    typeof value.blockedCount === "number" &&
    typeof value.warnedCount === "number" &&
    isRecord(value.repeatedTargetCount) &&
    typeof value.highRiskFrequency === "number" &&
    isRecord(value.patterns) &&
    typeof value.patterns.repeatedTarget === "boolean" &&
    typeof value.patterns.frequentHighRisk === "boolean"
  );
}

function isUserProtectionProfile(value: unknown): value is UserProtectionProfile {
  return (
    isRecord(value) &&
    typeof value.heightenedProtection === "boolean" &&
    isRecord(value.controls) &&
    typeof value.controls.repeatedTargetCaution === "boolean" &&
    typeof value.controls.frequentHighRiskCaution === "boolean" &&
    typeof value.controls.warnEscalationSuggested === "boolean" &&
    typeof value.controls.cooldownSuggested === "boolean" &&
    isRecord(value.summary) &&
    typeof value.summary.totalTransactions === "number" &&
    typeof value.summary.blockedCount === "number" &&
    typeof value.summary.warnedCount === "number" &&
    typeof value.summary.repeatedTargetCount === "number" &&
    typeof value.summary.highRiskFrequency === "number"
  );
}

export function buildTransactionDecisionPackage(
  records: readonly TransactionAuditRecord[],
  verdict: TransactionVerdict
): TransactionDecisionPackage {
  const analytics = analyzeTransactions([...records]);
  const protection = deriveUserProtectionProfile([...records]);
  const explanation = verdict.explanation;
  const audit = verdict.audit;
  const hasExplanation = isTransactionExplanation(explanation);
  const hasAudit = isTransactionAuditRecord(audit);
  const hasAnalytics = isTransactionAnalytics(analytics);
  const hasProtectionProfile = isUserProtectionProfile(protection);

  return {
    verdict,
    explanation,
    audit,
    analytics,
    protection,
    readiness: {
      hasExplanation,
      hasAudit,
      hasAnalytics,
      hasProtectionProfile,
      complete:
        hasExplanation &&
        hasAudit &&
        hasAnalytics &&
        hasProtectionProfile,
    },
  };
}
