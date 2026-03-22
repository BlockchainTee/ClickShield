import { buildTransactionSignals } from "../signals/transaction-signals.js";
import type {
  NormalizedTransactionContext,
  TransactionExplanation,
  TransactionSignals,
} from "./types.js";

function shortAddress(address: string | null): string {
  return address ?? "unknown contract";
}

function buildTechnicalFacts(
  context: NormalizedTransactionContext
): readonly string[] {
  const technical: string[] = [];

  if (context.methodSelector !== null) {
    technical.push(`Selector: ${context.methodSelector}`);
  }

  if (context.signature.primaryType !== null) {
    technical.push(`Primary type: ${context.signature.primaryType}`);
  }

  if (context.to !== null) {
    technical.push(`Target: ${context.to}`);
  }

  if (context.signature.verifyingContract !== null) {
    technical.push(`Verifier: ${context.signature.verifyingContract}`);
  }

  return technical;
}

function buildUnknowns(
  context: NormalizedTransactionContext
): readonly string[] {
  const unknowns: string[] = [];

  if (context.eventKind === "transaction" && context.actionType === "unknown") {
    unknowns.push("ClickShield could not fully decode this contract call.");
  }

  if (
    context.eventKind === "signature" &&
    context.signature.normalizationState === "missing_domain_fields"
  ) {
    unknowns.push(
      `Important signature domain fields were missing: ${context.signature.missingDomainFields.join(", ")}`
    );
  }

  if (
    context.eventKind === "signature" &&
    context.signature.normalizationState === "invalid_domain_fields"
  ) {
    unknowns.push(
      `Important signature domain fields were invalid: ${context.signature.invalidDomainFields.join(", ")}`
    );
  }

  return unknowns;
}

function explainApprove(
  context: NormalizedTransactionContext,
  signals: TransactionSignals
): TransactionExplanation {
  const spender = shortAddress(context.decoded.spender);
  const summary = signals.isUnlimitedApproval
    ? `Approve unlimited token spending by contract ${spender}`
    : `Approve token spending by contract ${spender}`;

  return {
    headline: signals.isUnlimitedApproval
      ? "Unlimited token approval"
      : "Token approval",
    summary,
    details: [
      "This gives the contract permission to spend this token balance without another approval.",
    ],
    unknowns: buildUnknowns(context),
    technical: buildTechnicalFacts(context),
  };
}

function explainSetApprovalForAll(
  context: NormalizedTransactionContext
): TransactionExplanation {
  const approved = context.decoded.params.approved === true;
  return {
    headline: approved ? "Full NFT collection access" : "NFT collection approval revoked",
    summary: approved
      ? "Allow this contract to transfer all NFTs in this collection."
      : "Remove this contract's permission to transfer NFTs in this collection.",
    details: [
      `Operator: ${shortAddress(context.decoded.operator)}`,
      approved
        ? "This grants collection-wide NFT transfer permission."
        : "This removes collection-wide NFT transfer permission.",
    ],
    unknowns: buildUnknowns(context),
    technical: buildTechnicalFacts(context),
  };
}

function explainPermitSignature(
  context: NormalizedTransactionContext
): TransactionExplanation {
  return {
    headline: "Token permission signature",
    summary: `Sign a permission that lets contract ${shortAddress(
      context.signature.verifyingContract
    )} spend tokens without an on-chain approval transaction.`,
    details: [
      "This signature can authorize token spending without sending a separate approval transaction first.",
    ],
    unknowns: buildUnknowns(context),
    technical: buildTechnicalFacts(context),
  };
}

function explainMulticall(
  context: NormalizedTransactionContext,
  signals: TransactionSignals
): TransactionExplanation {
  const summary = signals.containsApprovalAndTransfer
    ? "This batch both grants token permission and moves assets in one request."
    : `Execute a batch of ${context.batch.actions.length} contract actions in one request.`;

  return {
    headline: signals.containsApprovalAndTransfer
      ? "Batch transaction with approval and transfer"
      : "Batch contract transaction",
    summary,
    details: [`Batch action count: ${context.batch.actions.length}`],
    unknowns: buildUnknowns(context),
    technical: buildTechnicalFacts(context),
  };
}

function explainUnknown(
  context: NormalizedTransactionContext
): TransactionExplanation {
  return {
    headline:
      context.eventKind === "signature"
        ? "Unknown typed-data signature"
        : "Unknown contract interaction",
    summary:
      context.eventKind === "signature"
        ? "ClickShield could not fully normalize this typed-data request."
        : "ClickShield could not fully decode this contract call.",
    details: [
      `Destination contract: ${shortAddress(context.to)}`,
      `Chain: ${context.chainId}`,
      `Origin: ${context.originDomain}`,
      `Native value: ${context.valueWei}`,
      `Malicious-contract intel match: ${context.intel.contractDisposition === "malicious" ? "yes" : "no"}`,
    ],
    unknowns: buildUnknowns(context),
    technical: buildTechnicalFacts(context),
  };
}

export function buildTransactionExplanation(
  context: NormalizedTransactionContext
): TransactionExplanation {
  const signals = buildTransactionSignals(context);

  if (context.eventKind === "signature" && signals.isPermitSignature) {
    return explainPermitSignature(context);
  }

  switch (context.actionType) {
    case "approve":
    case "increaseAllowance":
      return explainApprove(context, signals);
    case "setApprovalForAll":
      return explainSetApprovalForAll(context);
    case "multicall":
      return explainMulticall(context, signals);
    case "permit":
      return {
        headline: "Token permission transaction",
        summary: `Submit an on-chain permit that grants token spending permission to contract ${shortAddress(
          context.decoded.spender
        )}.`,
        details: [],
        unknowns: buildUnknowns(context),
        technical: buildTechnicalFacts(context),
      };
    case "transfer":
      return {
        headline: "Token transfer",
        summary: `Transfer tokens to ${shortAddress(context.decoded.recipient)}.`,
        details: [],
        unknowns: buildUnknowns(context),
        technical: buildTechnicalFacts(context),
      };
    case "transferFrom":
      return {
        headline: "Delegated token transfer",
        summary: `Transfer tokens from ${shortAddress(
          context.decoded.owner
        )} to ${shortAddress(context.decoded.recipient)}.`,
        details: [],
        unknowns: buildUnknowns(context),
        technical: buildTechnicalFacts(context),
      };
    default:
      return explainUnknown(context);
  }
}
