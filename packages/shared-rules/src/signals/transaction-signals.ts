import {
  classifySelector,
  extractSelector,
  isUnlimitedApprovalAmount,
  parseApprovalAmount,
} from "../normalize/transaction.js";
import { classifyPermitKind } from "../transaction/typed-data.js";
import type {
  ApprovalDirection,
  DecodedTransactionAction,
  NormalizedTransactionContext,
  TransactionSignals,
} from "../transaction/types.js";

/**
 * Check if calldata is an approval method (approve, setApprovalForAll, increaseAllowance).
 */
export function isApprovalMethod(calldata: string): boolean {
  const selector = extractSelector(calldata);
  const kind = classifySelector(selector);
  return (
    kind === "approve" ||
    kind === "setApprovalForAll" ||
    kind === "increaseAllowance"
  );
}

/**
 * Check if calldata contains an unlimited approval (max uint256).
 */
export function isUnlimitedApproval(calldata: string): boolean {
  if (!isApprovalMethod(calldata)) return false;
  const amount = parseApprovalAmount(calldata);
  return isUnlimitedApprovalAmount(amount);
}

/**
 * Check if a typed data object is a permit-style signature.
 */
export function isPermitSignature(typedData: string): boolean {
  if (!typedData) return false;
  try {
    const parsed: unknown = JSON.parse(typedData);
    const primaryType =
      typeof parsed === "object" &&
      parsed !== null &&
      "primaryType" in parsed &&
      typeof parsed.primaryType === "string"
        ? parsed.primaryType
        : null;
    return classifyPermitKind(primaryType) !== "none";
  } catch {
    return false;
  }
}

function isApprovalMethodAction(action: DecodedTransactionAction): boolean {
  return (
    action.actionType === "approve" ||
    action.actionType === "increaseAllowance" ||
    action.actionType === "setApprovalForAll"
  );
}

function approvalDirectionForAction(
  action: DecodedTransactionAction
): ApprovalDirection {
  return action.approvalDirection;
}

function isGrantApprovalAction(action: DecodedTransactionAction): boolean {
  return isApprovalMethodAction(action) && approvalDirectionForAction(action) === "grant";
}

function hasTransferAction(action: DecodedTransactionAction): boolean {
  return action.actionType === "transfer" || action.actionType === "transferFrom";
}

export function buildTransactionSignals(
  context: NormalizedTransactionContext
): TransactionSignals {
  const actions = context.batch.isMulticall
    ? context.batch.actions
    : [context.decoded];
  const containsApproval = actions.some((action) => isGrantApprovalAction(action));
  const containsTransfer = actions.some((action) => action.actionType === "transfer");
  const containsTransferFrom = actions.some(
    (action) => action.actionType === "transferFrom"
  );

  return {
    actionType: context.actionType,
    isApprovalMethod: isApprovalMethodAction(context.decoded),
    isUnlimitedApproval: context.decoded.amount !== null
      ? isUnlimitedApprovalAmount(
          BigInt(context.decoded.amount).toString(16).padStart(64, "0")
        )
      : false,
    isPermitSignature:
      context.eventKind === "signature" && context.signature.permitKind !== "none",
    isSetApprovalForAll: context.decoded.actionType === "setApprovalForAll",
    approvalDirection: approvalDirectionForAction(context.decoded),
    spenderTrusted: context.counterparty.spenderTrusted,
    recipientIsNew: context.counterparty.recipientIsNew,
    isTransfer: context.decoded.actionType === "transfer",
    isTransferFrom: context.decoded.actionType === "transferFrom",
    isContractInteraction:
      context.eventKind === "transaction" &&
      context.to !== null &&
      context.decoded.actionType !== "transfer",
    isMulticall: context.batch.isMulticall,
    containsApprovalAndTransfer:
      context.batch.isMulticall &&
      containsApproval &&
      actions.some((action) => hasTransferAction(action)),
    containsApproval,
    containsTransfer,
    containsTransferFrom,
    batchActionCount: context.batch.actions.length,
    hasNativeValue: context.valueWei !== "0",
    touchesMaliciousContract: context.intel.contractDisposition === "malicious",
    targetAllowlisted: context.intel.contractDisposition === "allowlisted",
    signatureIntelMatch: context.intel.signatureDisposition === "malicious",
    verifyingContractKnown:
      context.eventKind === "signature" &&
      context.signature.verifyingContractPresent &&
      context.signature.verifyingContract !== null,
    hasUnknownInnerCall: context.batch.actions.some(
      (action) => action.actionType === "unknown"
    ),
  };
}
