import type { TransactionInput } from "../engine/types.js";
import { MAX_UINT256_HEX, extractSelector } from "../normalize/transaction.js";
import { getTransactionSelectorDefinition } from "../transaction/selectors.js";
import type {
  ApprovalDirection,
  DecodedTransactionAction,
  NormalizedTransactionContext,
  TransactionSignals,
} from "../transaction/types.js";

const HIGH_VALUE_THRESHOLD = 1_000_000_000_000_000_000n;
const MAX_UINT256_DECIMAL = BigInt(`0x${MAX_UINT256_HEX}`).toString(10);

type TransactionSignalContext = Omit<
  NormalizedTransactionContext,
  "signals" | "riskClassification"
>;
type TransactionSignalInput = TransactionSignalContext & {
  readonly eventKind: "transaction";
};
type SignatureSignalInput = TransactionSignalContext & {
  readonly eventKind: "signature";
};

function toMethodName(
  methodSelector: string | null,
  calldata: string
): string | undefined {
  const selector =
    methodSelector ?? (calldata === "0x" ? null : extractSelector(calldata));

  if (selector === null || selector === "0x") {
    return undefined;
  }

  return getTransactionSelectorDefinition(selector)?.functionName ?? undefined;
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

function isTransactionSignalInput(
  input: TransactionSignalContext
): input is TransactionSignalInput {
  return input.eventKind === "transaction";
}

function isSignatureSignalInput(
  input: TransactionSignalContext
): input is SignatureSignalInput {
  return input.eventKind === "signature";
}

function buildTransactionSignalsFromTransaction(
  input: TransactionSignalInput
): TransactionSignals {
  const actions = input.batch.isMulticall ? input.batch.actions : [input.decoded];
  const containsApproval = actions.some((action) => isGrantApprovalAction(action));
  const containsTransfer = actions.some((action) => action.actionType === "transfer");
  const containsTransferFrom = actions.some(
    (action) => action.actionType === "transferFrom"
  );
  const hasValueTransfer = BigInt(input.valueWei) > 0n;
  const methodName = toMethodName(input.methodSelector, input.calldata);
  const isApproval = methodName === "approve";

  return {
    isContractInteraction: input.calldata !== "0x",
    isNativeTransfer: input.calldata === "0x",
    methodName,
    isApproval,
    actionType: input.actionType,
    isApprovalMethod: isApprovalMethodAction(input.decoded),
    isUnlimitedApproval:
      isApprovalMethodAction(input.decoded) &&
      input.decoded.amount === MAX_UINT256_DECIMAL,
    hasValueTransfer,
    isHighValue: BigInt(input.valueWei) >= HIGH_VALUE_THRESHOLD,
    targetAddress: input.to ?? undefined,
    isPermitSignature: false,
    isSetApprovalForAll: input.decoded.actionType === "setApprovalForAll",
    approvalDirection: approvalDirectionForAction(input.decoded),
    spenderTrusted: input.counterparty.spenderTrusted,
    recipientIsNew: input.counterparty.recipientIsNew,
    isTransfer: input.decoded.actionType === "transfer",
    isTransferFrom: input.decoded.actionType === "transferFrom",
    isMulticall: input.batch.isMulticall,
    containsApprovalAndTransfer:
      input.batch.isMulticall &&
      containsApproval &&
      actions.some((action) => hasTransferAction(action)),
    containsApproval,
    containsTransfer,
    containsTransferFrom,
    batchActionCount: input.batch.actions.length,
    hasNativeValue: hasValueTransfer,
    touchesMaliciousContract: input.intel.contractDisposition === "malicious",
    targetAllowlisted: input.intel.contractDisposition === "allowlisted",
    signatureIntelMatch: input.intel.signatureDisposition === "malicious",
    verifyingContractKnown: false,
    hasUnknownInnerCall: input.batch.actions.some(
      (action) => action.actionType === "unknown"
    ),
  };
}

function buildTransactionSignalsFromSignature(
  input: SignatureSignalInput
): TransactionSignals {
  return {
    isContractInteraction: false,
    isNativeTransfer: false,
    methodName: undefined,
    isApproval: false,
    actionType: input.actionType,
    isApprovalMethod: false,
    isUnlimitedApproval: false,
    hasValueTransfer: false,
    isHighValue: false,
    targetAddress: input.signature.verifyingContract ?? undefined,
    isPermitSignature: input.signature.permitKind !== "none",
    isSetApprovalForAll: false,
    approvalDirection: "not_applicable",
    spenderTrusted: input.counterparty.spenderTrusted,
    recipientIsNew: input.counterparty.recipientIsNew,
    isTransfer: false,
    isTransferFrom: false,
    isMulticall: false,
    containsApprovalAndTransfer: false,
    containsApproval: false,
    containsTransfer: false,
    containsTransferFrom: false,
    batchActionCount: 0,
    hasNativeValue: false,
    touchesMaliciousContract: input.intel.contractDisposition === "malicious",
    targetAllowlisted: input.intel.contractDisposition === "allowlisted",
    signatureIntelMatch: input.intel.signatureDisposition === "malicious",
    verifyingContractKnown:
      input.signature.verifyingContractPresent &&
      input.signature.verifyingContract !== null,
    hasUnknownInnerCall: false,
  };
}

export function getTransactionSignals(input: TransactionInput): TransactionSignals;
export function getTransactionSignals(
  input: TransactionSignalInput
): TransactionSignals;
export function getTransactionSignals(
  input: TransactionInput | TransactionSignalInput
): TransactionSignals {
  return buildTransactionSignalsFromTransaction(input);
}

export function buildTransactionSignals(
  context: NormalizedTransactionContext | TransactionSignalContext
): TransactionSignals {
  if ("signals" in context) {
    return context.signals;
  }

  if (isTransactionSignalInput(context)) {
    return buildTransactionSignalsFromTransaction(context);
  }

  if (isSignatureSignalInput(context)) {
    return buildTransactionSignalsFromSignature(context);
  }

  throw new TypeError(`Unsupported transaction event kind: ${context.eventKind}`);
}
