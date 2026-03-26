import type {
  ApprovalDirection,
  NormalizedTransactionContext,
  TransactionRiskClassification,
} from "../transaction/types.js";

type TransactionRiskContext = Omit<
  NormalizedTransactionContext,
  "riskClassification"
>;

function isGrantApprovalDirection(direction: ApprovalDirection): boolean {
  return direction === "grant";
}

function isApprovalStyleAction(context: TransactionRiskContext): boolean {
  if (context.eventKind !== "transaction") {
    return false;
  }

  return (
    (context.signals.isApprovalMethod || context.signals.isSetApprovalForAll) &&
    isGrantApprovalDirection(context.signals.approvalDirection)
  );
}

function isPermitStyleAction(context: TransactionRiskContext): boolean {
  return (
    context.signals.isPermitSignature ||
    (context.eventKind === "transaction" &&
      context.actionType === "permit" &&
      isGrantApprovalDirection(context.decoded.approvalDirection))
  );
}

function isNonBenignUnknownMethod(context: TransactionRiskContext): boolean {
  if (context.eventKind !== "transaction") {
    return false;
  }

  if (!context.signals.isContractInteraction) {
    return false;
  }

  if (context.intel.contractDisposition === "allowlisted") {
    return false;
  }

  return context.actionType === "unknown" || context.signals.hasUnknownInnerCall;
}

function isMeaningfulHighValueTransfer(context: TransactionRiskContext): boolean {
  if (context.eventKind !== "transaction") {
    return false;
  }

  return context.signals.hasValueTransfer && context.signals.isHighValue;
}

export function classifyTransactionRisk(
  context: NormalizedTransactionContext
): TransactionRiskClassification;
export function classifyTransactionRisk(
  context: TransactionRiskContext
): TransactionRiskClassification;
export function classifyTransactionRisk(
  context: NormalizedTransactionContext | TransactionRiskContext
): TransactionRiskClassification {
  const hasMaliciousTarget = context.intel.contractDisposition === "malicious";
  const hasKnownScamSignature = context.intel.signatureDisposition === "malicious";
  const isApprovalRisk =
    isApprovalStyleAction(context) || isPermitStyleAction(context);
  const isUnlimitedApprovalRisk =
    isApprovalRisk &&
    context.signals.isUnlimitedApproval &&
    isGrantApprovalDirection(context.signals.approvalDirection);
  const isPermitRisk = isPermitStyleAction(context);
  const isHighValueTransferRisk = isMeaningfulHighValueTransfer(context);
  const isUnknownMethodRisk = isNonBenignUnknownMethod(context);
  const requiresUserAttention =
    hasMaliciousTarget ||
    hasKnownScamSignature ||
    isUnlimitedApprovalRisk ||
    (isApprovalRisk &&
      context.counterparty.spenderTrusted !== true &&
      !context.signals.targetAllowlisted) ||
    (isPermitRisk && !context.signals.targetAllowlisted) ||
    isHighValueTransferRisk ||
    isUnknownMethodRisk;

  return {
    hasMaliciousTarget,
    hasKnownScamSignature,
    isApprovalRisk,
    isUnlimitedApprovalRisk,
    isPermitRisk,
    isHighValueTransferRisk,
    isUnknownMethodRisk,
    requiresUserAttention,
  };
}
