import {
  APPROVE_SELECTOR,
  SET_APPROVAL_FOR_ALL_SELECTOR,
} from "../../transaction/selectors.js";
import { buildStableId } from "./ids.js";
import type {
  EvmCleanupAction,
  EvmCleanupExecutionRequest,
  EvmPreparedCleanupArgument,
  EvmPreparedCleanupTransaction,
  EvmWalletCleanupPlan,
} from "./cleanup-types.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_VALUE = "0x0";
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function encodeWord(hexValue: string): string {
  return hexValue.padStart(64, "0");
}

function encodeAddressWord(address: string): string | null {
  if (!ADDRESS_PATTERN.test(address)) {
    return null;
  }

  return encodeWord(stripHexPrefix(address));
}

function encodeUint256Word(value: string): string | null {
  try {
    return encodeWord(BigInt(value).toString(16));
  } catch {
    return null;
  }
}

function encodeBoolWord(value: boolean): string {
  return encodeWord(value ? "1" : "0");
}

function buildPreparedTransaction(
  action: EvmCleanupAction,
  walletAddress: string,
  networkId: string
): EvmPreparedCleanupTransaction {
  let functionName: EvmPreparedCleanupTransaction["functionName"] = null;
  let methodSelector: string | null = null;
  let args: readonly EvmPreparedCleanupArgument[] = [];
  let data: string | null = null;
  let supportStatus: EvmPreparedCleanupTransaction["supportStatus"] = "supported";
  let supportDetail: string | null =
    "Prepared from normalized approval data only. User signature, submission, and confirmation happen outside this layer.";

  switch (action.revocationMethod) {
    case "erc20_approve_zero": {
      const spenderWord = encodeAddressWord(action.approval.spenderAddress);
      const amountWord = encodeUint256Word("0");
      functionName = "approve";
      methodSelector = APPROVE_SELECTOR;
      args = [
        {
          name: "spender",
          type: "address",
          value: action.approval.spenderAddress,
        },
        {
          name: "amount",
          type: "uint256",
          value: "0",
        },
      ];
      if (spenderWord === null || amountWord === null) {
        supportStatus = "not_supported";
        supportDetail = "ERC-20 revoke payload is missing a valid spender address or allowance value.";
        break;
      }
      data = `${methodSelector}${spenderWord}${amountWord}`;
      break;
    }
    case "erc721_approve_zero": {
      const zeroWord = encodeAddressWord(ZERO_ADDRESS);
      const tokenIdWord =
        action.approval.tokenId === null
          ? null
          : encodeUint256Word(action.approval.tokenId);
      functionName = "approve";
      methodSelector = APPROVE_SELECTOR;
      args = [
        {
          name: "to",
          type: "address",
          value: ZERO_ADDRESS,
        },
        {
          name: "tokenId",
          type: "uint256",
          value: action.approval.tokenId ?? "",
        },
      ];
      if (zeroWord === null || tokenIdWord === null) {
        supportStatus = "not_supported";
        supportDetail =
          "ERC-721 token revoke payload requires a deterministic tokenId.";
        break;
      }
      data = `${methodSelector}${zeroWord}${tokenIdWord}`;
      break;
    }
    case "erc721_set_approval_for_all_false":
    case "erc1155_set_approval_for_all_false": {
      const operatorWord = encodeAddressWord(action.approval.spenderAddress);
      functionName = "setApprovalForAll";
      methodSelector = SET_APPROVAL_FOR_ALL_SELECTOR;
      args = [
        {
          name: "operator",
          type: "address",
          value: action.approval.spenderAddress,
        },
        {
          name: "approved",
          type: "bool",
          value: "false",
        },
      ];
      if (operatorWord === null) {
        supportStatus = "not_supported";
        supportDetail =
          "Operator revoke payload requires a valid normalized operator address.";
        break;
      }
      data = `${methodSelector}${operatorWord}${encodeBoolWord(false)}`;
      break;
    }
  }

  const executable =
    supportStatus === "supported" &&
    functionName !== null &&
    methodSelector !== null &&
    data !== null &&
    ADDRESS_PATTERN.test(action.approval.tokenAddress);

  return {
    transactionId: buildStableId("wallet_cleanup_tx", {
      actionId: action.actionId,
      networkId,
      walletAddress,
    }),
    actionId: action.actionId,
    walletChain: "evm",
    networkId,
    walletAddress,
    to: executable ? action.approval.tokenAddress : null,
    value: ZERO_VALUE,
    data: executable ? data : null,
    functionName: executable ? functionName : null,
    methodSelector: executable ? methodSelector : null,
    args,
    approvalKind: action.approval.approvalKind,
    revocationMethod: action.revocationMethod,
    intendedState: action.approval.intendedState,
    executable,
    supportStatus: executable ? "supported" : "not_supported",
    supportDetail:
      executable
        ? supportDetail
        : supportDetail ?? "Required transaction fields were incomplete.",
  };
}

function getSelectedActions(
  plan: EvmWalletCleanupPlan,
  actionIds: readonly string[]
): readonly EvmCleanupAction[] {
  const requested = new Set(actionIds);
  return plan.actions.filter((action) => requested.has(action.actionId));
}

/**
 * Prepares a single EVM revoke payload for explicit user-selected review.
 */
export function prepareEvmCleanupTransaction(
  action: EvmCleanupAction,
  walletAddress: string,
  networkId: string
): EvmPreparedCleanupTransaction {
  return buildPreparedTransaction(action, walletAddress, networkId);
}

/**
 * Prepares an explicit cleanup execution request for one or more selected EVM revoke actions.
 */
export function prepareEvmCleanupExecutionRequest(
  plan: EvmWalletCleanupPlan,
  actionIds: readonly string[],
  createdAt: string
): EvmCleanupExecutionRequest {
  const actions = getSelectedActions(plan, actionIds);
  const preparedTransactions = actions.map((action) =>
    prepareEvmCleanupTransaction(action, plan.walletAddress, plan.networkId)
  );
  const allExecutable =
    preparedTransactions.length > 0 &&
    preparedTransactions.every((transaction) => transaction.executable);
  const selectionKind =
    preparedTransactions.length <= 1 ? "single_action" : "batch_actions";
  const packaging =
    !allExecutable
      ? "not_supported"
      : preparedTransactions.length <= 1
        ? "single_transaction"
        : "multiple_transactions";

  return {
    requestId: buildStableId("wallet_cleanup_request", {
      actionIds: actions.map((action) => action.actionId),
      createdAt,
      planId: plan.planId,
    }),
    planId: plan.planId,
    walletChain: "evm",
    walletAddress: plan.walletAddress,
    networkId: plan.networkId,
    createdAt,
    selectionKind,
    packaging,
    actionIds: actions.map((action) => action.actionId),
    preparedTransactions,
    requiresSignature: true,
    supportStatus:
      !allExecutable
        ? "not_supported"
        : preparedTransactions.length <= 1
          ? "supported"
          : "partial",
    supportDetail:
      !allExecutable
        ? "At least one selected revoke action could not be converted into a complete transaction payload."
        : preparedTransactions.length <= 1
          ? "Prepared one revoke transaction for explicit wallet signature."
          : `Prepared ${preparedTransactions.length} ordered revoke transaction(s). Execution remains reviewable and may require multiple wallet signatures or confirmations.`,
  };
}
