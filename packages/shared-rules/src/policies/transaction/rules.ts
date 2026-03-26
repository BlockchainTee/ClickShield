import type {
  Rule,
  SignatureInput,
  TransactionInput,
} from "../../engine/types.js";
import type { TransactionCode } from "./codes.js";
import { TRANSACTION_CODES } from "./codes.js";

type TransactionPolicyInput = TransactionInput | SignatureInput;

function isNonTrustedCounterparty(input: TransactionPolicyInput): boolean {
  return input.counterparty.spenderTrusted !== true;
}

const BLOCK_MALICIOUS_TRANSACTION_CONTRACT: Rule<TransactionPolicyInput> = {
  id: "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT",
  name: "Block malicious transaction target",
  eventKind: "transaction",
  severity: "critical",
  outcome: "block",
  priority: 10,
  predicate: (ctx) =>
    ctx.eventKind === "transaction" && ctx.intel.contractDisposition === "malicious",
  buildReasonCodes: () => [TRANSACTION_CODES.KNOWN_MALICIOUS_CONTRACT],
  buildEvidence: (ctx) => ({
    maliciousContract: {
      address: ctx.to,
      disposition: ctx.intel.contractDisposition,
      contractFeedVersion: ctx.intel.contractFeedVersion,
    },
  }),
};

const BLOCK_MALICIOUS_SIGNATURE_CONTRACT: Rule<TransactionPolicyInput> = {
  id: "TX_BLOCK_MALICIOUS_SIGNATURE_CONTRACT",
  name: "Block malicious verifying contract",
  eventKind: "signature",
  severity: "critical",
  outcome: "block",
  priority: 10,
  predicate: (ctx) =>
    ctx.eventKind === "signature" && ctx.intel.contractDisposition === "malicious",
  buildReasonCodes: (ctx) => {
    const codes: TransactionCode[] = [TRANSACTION_CODES.KNOWN_MALICIOUS_CONTRACT];
    if (ctx.signature.permitKind !== "none") {
      codes.push(TRANSACTION_CODES.PERMIT_SIGNATURE);
    }
    return codes;
  },
  buildEvidence: (ctx) => ({
    maliciousVerifier: {
      address: ctx.signature.verifyingContract,
      disposition: ctx.intel.contractDisposition,
      contractFeedVersion: ctx.intel.contractFeedVersion,
    },
  }),
};

const BLOCK_SCAM_SIGNATURE_MATCH: Rule<TransactionPolicyInput> = {
  id: "TX_BLOCK_SCAM_SIGNATURE_MATCH",
  name: "Block known scam signature intel match",
  eventKind: "signature",
  severity: "critical",
  outcome: "block",
  priority: 5,
  predicate: (ctx) =>
    ctx.eventKind === "signature" && ctx.intel.signatureDisposition === "malicious",
  buildReasonCodes: (ctx) => {
    const codes: TransactionCode[] = [TRANSACTION_CODES.SCAM_SIGNATURE_MATCH];
    if (ctx.signature.permitKind !== "none") {
      codes.push(TRANSACTION_CODES.PERMIT_SIGNATURE);
    }
    return codes;
  },
  buildEvidence: (ctx) => ({
    scamSignature: {
      primaryType: ctx.signature.primaryType,
      signatureDisposition: ctx.intel.signatureDisposition,
      signatureFeedVersion: ctx.intel.signatureFeedVersion,
      verifyingContract: ctx.signature.verifyingContract,
    },
  }),
};

const WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER: Rule<TransactionPolicyInput> = {
  id: "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
  name: "Warn on unlimited approval to non-trusted spender",
  eventKind: "transaction",
  severity: "high",
  outcome: "warn",
  priority: 120,
  predicate: (ctx) => {
    const signals = ctx.signals;
    return (
      ctx.eventKind === "transaction" &&
      signals.isApprovalMethod &&
      signals.isUnlimitedApproval &&
      signals.approvalDirection === "grant" &&
      isNonTrustedCounterparty(ctx) &&
      !signals.targetAllowlisted
    );
  },
  buildReasonCodes: () => [
    TRANSACTION_CODES.UNLIMITED_APPROVAL,
    TRANSACTION_CODES.UNKNOWN_SPENDER,
  ],
  buildEvidence: (ctx) => ({
    approval: {
      spender: ctx.decoded.spender,
      amountKind: ctx.decoded.amountKind,
      spenderTrusted: ctx.counterparty.spenderTrusted,
    },
  }),
};

const WARN_SET_APPROVAL_FOR_ALL_UNKNOWN_OPERATOR: Rule<TransactionPolicyInput> = {
  id: "TX_WARN_SET_APPROVAL_FOR_ALL_UNKNOWN_OPERATOR",
  name: "Warn on full NFT collection approval to non-trusted operator",
  eventKind: "transaction",
  severity: "high",
  outcome: "warn",
  priority: 130,
  predicate: (ctx) => {
    const signals = ctx.signals;
    return (
      ctx.eventKind === "transaction" &&
      signals.isSetApprovalForAll &&
      signals.approvalDirection === "grant" &&
      isNonTrustedCounterparty(ctx) &&
      !signals.targetAllowlisted
    );
  },
  buildReasonCodes: () => [
    TRANSACTION_CODES.SET_APPROVAL_FOR_ALL,
    TRANSACTION_CODES.UNKNOWN_SPENDER,
  ],
  buildEvidence: (ctx) => ({
    approvalForAll: {
      operator: ctx.decoded.operator,
      spenderTrusted: ctx.counterparty.spenderTrusted,
    },
  }),
};

const WARN_INCREASE_ALLOWANCE_UNKNOWN_SPENDER: Rule<TransactionPolicyInput> = {
  id: "TX_WARN_INCREASE_ALLOWANCE_UNKNOWN_SPENDER",
  name: "Warn on increaseAllowance to a non-trusted spender",
  eventKind: "transaction",
  severity: "high",
  outcome: "warn",
  priority: 135,
  predicate: (ctx) => {
    const signals = ctx.signals;
    return (
      ctx.eventKind === "transaction" &&
      ctx.actionType === "increaseAllowance" &&
      signals.approvalDirection === "grant" &&
      !signals.isUnlimitedApproval &&
      isNonTrustedCounterparty(ctx) &&
      !signals.targetAllowlisted
    );
  },
  buildReasonCodes: () => [TRANSACTION_CODES.UNKNOWN_SPENDER],
  buildEvidence: (ctx) => ({
    increaseAllowance: {
      spender: ctx.decoded.spender,
      amount: ctx.decoded.amount,
      amountKind: ctx.decoded.amountKind,
      spenderTrusted: ctx.counterparty.spenderTrusted,
    },
  }),
};

const WARN_PERMIT_SIGNATURE_TO_UNTRUSTED_CONTRACT: Rule<TransactionPolicyInput> = {
  id: "TX_WARN_PERMIT_SIGNATURE_TO_UNTRUSTED_CONTRACT",
  name: "Warn on permit signature to untrusted verifier",
  eventKind: "signature",
  severity: "high",
  outcome: "warn",
  priority: 140,
  predicate: (ctx) => {
    const signals = ctx.signals;
    return (
      ctx.eventKind === "signature" &&
      signals.isPermitSignature &&
      !signals.signatureIntelMatch &&
      !signals.touchesMaliciousContract &&
      !signals.targetAllowlisted
    );
  },
  buildReasonCodes: () => [TRANSACTION_CODES.PERMIT_SIGNATURE],
  buildEvidence: (ctx) => ({
    permitSignature: {
      permitKind: ctx.signature.permitKind,
      verifyingContract: ctx.signature.verifyingContract,
      verifyingContractPresent: ctx.signature.verifyingContractPresent,
      normalizationState: ctx.signature.normalizationState,
      contractDisposition: ctx.intel.contractDisposition,
    },
  }),
};

const WARN_MULTICALL_APPROVAL_AND_TRANSFER: Rule<TransactionPolicyInput> = {
  id: "TX_WARN_MULTICALL_APPROVAL_AND_TRANSFER",
  name: "Warn on multicall that both grants approval and moves assets",
  eventKind: "transaction",
  severity: "high",
  outcome: "warn",
  priority: 150,
  predicate: (ctx) => {
    const signals = ctx.signals;
    return (
      ctx.eventKind === "transaction" &&
      signals.isMulticall &&
      signals.containsApprovalAndTransfer
    );
  },
  buildReasonCodes: () => [
    TRANSACTION_CODES.MULTICALL_APPROVAL_AND_TRANSFER,
  ],
  buildEvidence: (ctx) => ({
    multicall: {
      batchSelector: ctx.batch.batchSelector,
      actionCount: ctx.batch.actions.length,
      actions: ctx.batch.actions.map((action) => action.actionType),
    },
  }),
};

const WARN_TRANSFER_FROM_NEW_RECIPIENT: Rule<TransactionPolicyInput> = {
  id: "TX_WARN_TRANSFER_FROM_NEW_RECIPIENT",
  name: "Warn on delegated transfer to a new recipient through a contract",
  eventKind: "transaction",
  severity: "medium",
  outcome: "warn",
  priority: 220,
  predicate: (ctx) =>
    ctx.eventKind === "transaction" &&
    ctx.actionType === "transferFrom" &&
    ctx.counterparty.recipientIsNew === true &&
    ctx.intel.contractDisposition !== "allowlisted" &&
    ctx.intel.contractDisposition !== "malicious",
  buildReasonCodes: () => [
    TRANSACTION_CODES.UNKNOWN_CONTRACT_INTERACTION,
    TRANSACTION_CODES.NEW_RECIPIENT,
  ],
  buildEvidence: (ctx) => ({
    delegatedTransfer: {
      owner: ctx.decoded.owner,
      recipient: ctx.decoded.recipient,
      recipientIsNew: ctx.counterparty.recipientIsNew,
    },
  }),
};

const WARN_UNKNOWN_CONTRACT_INTERACTION_WITH_VALUE: Rule<TransactionPolicyInput> = {
  id: "TX_WARN_UNKNOWN_CONTRACT_INTERACTION_WITH_VALUE",
  name: "Warn on opaque contract interaction carrying native value",
  eventKind: "transaction",
  severity: "medium",
  outcome: "warn",
  priority: 240,
  predicate: (ctx) => {
    const signals = ctx.signals;
    return (
      ctx.eventKind === "transaction" &&
      ctx.actionType === "unknown" &&
      signals.hasNativeValue &&
      ctx.intel.contractDisposition !== "allowlisted" &&
      ctx.intel.contractDisposition !== "malicious"
    );
  },
  buildReasonCodes: (ctx) => {
    const codes: TransactionCode[] = [TRANSACTION_CODES.UNKNOWN_CONTRACT_INTERACTION];
    if (ctx.counterparty.recipientIsNew === true) {
      codes.push(TRANSACTION_CODES.NEW_RECIPIENT);
    }
    return codes;
  },
  buildEvidence: (ctx) => ({
    unknownInteraction: {
      target: ctx.to,
      valueWei: ctx.valueWei,
      recipientIsNew: ctx.counterparty.recipientIsNew,
    },
  }),
};

export const TRANSACTION_RULES: readonly Rule<TransactionPolicyInput>[] = [
  BLOCK_SCAM_SIGNATURE_MATCH,
  BLOCK_MALICIOUS_TRANSACTION_CONTRACT,
  BLOCK_MALICIOUS_SIGNATURE_CONTRACT,
  WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER,
  WARN_SET_APPROVAL_FOR_ALL_UNKNOWN_OPERATOR,
  WARN_INCREASE_ALLOWANCE_UNKNOWN_SPENDER,
  WARN_PERMIT_SIGNATURE_TO_UNTRUSTED_CONTRACT,
  WARN_MULTICALL_APPROVAL_AND_TRANSFER,
  WARN_TRANSFER_FROM_NEW_RECIPIENT,
  WARN_UNKNOWN_CONTRACT_INTERACTION_WITH_VALUE,
];
