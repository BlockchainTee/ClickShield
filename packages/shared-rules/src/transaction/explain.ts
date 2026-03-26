import type {
  NormalizedTransactionContext,
  TransactionExplanation,
} from "./types.js";
import { buildTransactionSignals } from "../signals/transaction-signals.js";
import type {
  TransactionMatchedReason,
  TransactionVerdict,
  Verdict,
} from "../engine/types.js";

type ExplainableTransactionVerdict =
  | Verdict
  | Pick<TransactionVerdict, "status" | "primaryReason" | "secondaryReasons">;

const REASON_LABELS: Readonly<Record<string, string>> = Object.freeze({
  TX_UNLIMITED_APPROVAL: "Unlimited token approval",
  TX_UNKNOWN_SPENDER: "Unknown spender",
  TX_SET_APPROVAL_FOR_ALL: "Full NFT collection approval",
  TX_PERMIT_SIGNATURE: "Permit signature",
  TX_KNOWN_MALICIOUS_CONTRACT: "Known malicious contract",
  TX_SCAM_SIGNATURE_MATCH: "Known scam signature match",
  TX_MULTICALL_APPROVAL_AND_TRANSFER: "Batch approval and transfer",
  TX_UNKNOWN_CONTRACT_INTERACTION: "Unknown contract interaction",
  TX_NEW_RECIPIENT: "New recipient",
});

function humanizeIdentifier(value: string): string {
  return value
    .replace(/^TX_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toExplanationStatus(
  status: Verdict["status"] | TransactionVerdict["status"]
): TransactionExplanation["status"] {
  switch (status) {
    case "BLOCK":
    case "block":
      return "block";
    case "WARN":
    case "warn":
      return "warn";
    case "ALLOW":
    case "allow":
      return "allow";
  }
}

function summaryForStatus(
  status: TransactionExplanation["status"]
): string {
  switch (status) {
    case "block":
      return "This transaction is dangerous and has been blocked";
    case "warn":
      return "This transaction may be risky";
    case "allow":
      return "This transaction appears safe";
  }
}

function explanationRiskLevel(
  status: TransactionExplanation["status"]
): TransactionExplanation["riskLevel"] {
  switch (status) {
    case "block":
      return "high";
    case "warn":
      return "medium";
    case "allow":
      return "low";
  }
}

function hasMatchedReasonFields(
  verdict: ExplainableTransactionVerdict
): verdict is Pick<TransactionVerdict, "status" | "primaryReason" | "secondaryReasons"> {
  return "primaryReason" in verdict && "secondaryReasons" in verdict;
}

function readableReasonLabel(reasonCode: string): string {
  return REASON_LABELS[reasonCode] ?? humanizeIdentifier(reasonCode);
}

function readableMatchedReason(reason: TransactionMatchedReason): string {
  const reasonCode = reason.reasonCodes[0];
  if (typeof reasonCode === "string" && reasonCode.length > 0) {
    return readableReasonLabel(reasonCode);
  }

  return humanizeIdentifier(reason.ruleId);
}

function primaryReasonForVerdict(
  verdict: ExplainableTransactionVerdict,
  status: TransactionExplanation["status"]
): string {
  if (hasMatchedReasonFields(verdict) && verdict.primaryReason !== null) {
    return readableMatchedReason(verdict.primaryReason);
  }

  switch (status) {
    case "block":
      return "Transaction blocked by policy";
    case "warn":
      return "Transaction requires review";
    case "allow":
      return "No blocking or warning conditions were detected";
  }
}

function secondaryReasonsForVerdict(
  verdict: ExplainableTransactionVerdict
): readonly string[] {
  if (!hasMatchedReasonFields(verdict)) {
    return [];
  }

  const seen = new Set<string>();
  const readableReasons: string[] = [];

  for (const reason of verdict.secondaryReasons) {
    const label = readableMatchedReason(reason);
    if (!seen.has(label)) {
      seen.add(label);
      readableReasons.push(label);
    }
  }

  return readableReasons;
}

function detailMethod(
  context: NormalizedTransactionContext
): string | undefined {
  const signals = context.signals ?? buildTransactionSignals(context);

  if (signals.methodName) {
    return signals.methodName;
  }

  if (context.eventKind === "signature") {
    return context.signature.primaryType ?? undefined;
  }

  return undefined;
}

function detailTarget(
  context: NormalizedTransactionContext
): string | undefined {
  const signals = context.signals ?? buildTransactionSignals(context);
  return signals.targetAddress;
}

function detailValue(
  context: NormalizedTransactionContext
): string | undefined {
  if (context.eventKind !== "transaction") {
    return undefined;
  }

  return context.valueWei;
}

export function explainTransaction(
  ctx: NormalizedTransactionContext,
  verdict: Verdict
): TransactionExplanation;
export function explainTransaction(
  ctx: NormalizedTransactionContext,
  verdict: ExplainableTransactionVerdict
): TransactionExplanation;
export function explainTransaction(
  ctx: NormalizedTransactionContext,
  verdict: ExplainableTransactionVerdict
): TransactionExplanation {
  const signals = ctx.signals ?? buildTransactionSignals(ctx);
  const status = toExplanationStatus(verdict.status);

  return {
    status,
    summary: summaryForStatus(status),
    primaryReason: primaryReasonForVerdict(verdict, status),
    secondaryReasons: secondaryReasonsForVerdict(verdict),
    riskLevel: explanationRiskLevel(status),
    details: {
      method: detailMethod(ctx),
      target: detailTarget(ctx),
      value: detailValue(ctx),
      isContractInteraction: signals.isContractInteraction,
    },
  };
}
