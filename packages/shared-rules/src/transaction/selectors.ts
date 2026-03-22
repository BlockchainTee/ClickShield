import type { TransactionActionType } from "./types.js";

export interface TransactionSelectorDefinition {
  readonly selector: string;
  readonly functionName:
    | "approve"
    | "setApprovalForAll"
    | "increaseAllowance"
    | "permit"
    | "transfer"
    | "transferFrom"
    | "multicall";
  readonly actionType: TransactionActionType;
  readonly variant:
    | "standard"
    | "allowed_bool"
    | "bytes_array"
    | "deadline_bytes_array";
}

/** ERC-20 approve(address,uint256) selector. */
export const APPROVE_SELECTOR = "0x095ea7b3";

/** ERC-721/1155 setApprovalForAll(address,bool) selector. */
export const SET_APPROVAL_FOR_ALL_SELECTOR = "0xa22cb465";

/** ERC-20 increaseAllowance(address,uint256) selector. */
export const INCREASE_ALLOWANCE_SELECTOR = "0x39509351";

/** ERC-20 transfer(address,uint256) selector. */
export const TRANSFER_SELECTOR = "0xa9059cbb";

/** ERC-20 transferFrom(address,address,uint256) selector. */
export const TRANSFER_FROM_SELECTOR = "0x23b872dd";

/** ERC-2612-style permit selector. */
export const ERC20_PERMIT_SELECTOR = "0xd505accf";

/** DAI-style permit selector. */
export const ALLOWED_BOOL_PERMIT_SELECTOR = "0x8fcbaf0c";

/** multicall(bytes[]) selector. */
export const MULTICALL_BYTES_SELECTOR = "0xac9650d8";

/** multicall(uint256,bytes[]) selector. */
export const MULTICALL_DEADLINE_BYTES_SELECTOR = "0x5ae401dc";

export const PERMIT_SELECTORS: readonly string[] = [
  ERC20_PERMIT_SELECTOR,
  ALLOWED_BOOL_PERMIT_SELECTOR,
];

export const MULTICALL_SELECTORS: readonly string[] = [
  MULTICALL_BYTES_SELECTOR,
  MULTICALL_DEADLINE_BYTES_SELECTOR,
];

export const TRANSACTION_SELECTOR_REGISTRY: Readonly<
  Record<string, TransactionSelectorDefinition>
> = Object.freeze({
  [APPROVE_SELECTOR]: {
    selector: APPROVE_SELECTOR,
    functionName: "approve",
    actionType: "approve",
    variant: "standard",
  },
  [SET_APPROVAL_FOR_ALL_SELECTOR]: {
    selector: SET_APPROVAL_FOR_ALL_SELECTOR,
    functionName: "setApprovalForAll",
    actionType: "setApprovalForAll",
    variant: "standard",
  },
  [INCREASE_ALLOWANCE_SELECTOR]: {
    selector: INCREASE_ALLOWANCE_SELECTOR,
    functionName: "increaseAllowance",
    actionType: "increaseAllowance",
    variant: "standard",
  },
  [TRANSFER_SELECTOR]: {
    selector: TRANSFER_SELECTOR,
    functionName: "transfer",
    actionType: "transfer",
    variant: "standard",
  },
  [TRANSFER_FROM_SELECTOR]: {
    selector: TRANSFER_FROM_SELECTOR,
    functionName: "transferFrom",
    actionType: "transferFrom",
    variant: "standard",
  },
  [ERC20_PERMIT_SELECTOR]: {
    selector: ERC20_PERMIT_SELECTOR,
    functionName: "permit",
    actionType: "permit",
    variant: "standard",
  },
  [ALLOWED_BOOL_PERMIT_SELECTOR]: {
    selector: ALLOWED_BOOL_PERMIT_SELECTOR,
    functionName: "permit",
    actionType: "permit",
    variant: "allowed_bool",
  },
  [MULTICALL_BYTES_SELECTOR]: {
    selector: MULTICALL_BYTES_SELECTOR,
    functionName: "multicall",
    actionType: "multicall",
    variant: "bytes_array",
  },
  [MULTICALL_DEADLINE_BYTES_SELECTOR]: {
    selector: MULTICALL_DEADLINE_BYTES_SELECTOR,
    functionName: "multicall",
    actionType: "multicall",
    variant: "deadline_bytes_array",
  },
});

export function getTransactionSelectorDefinition(
  selector: string
): TransactionSelectorDefinition | null {
  const normalized = selector.toLowerCase();
  return TRANSACTION_SELECTOR_REGISTRY[normalized] ?? null;
}

export function classifyTransactionSelector(
  selector: string
): TransactionActionType {
  return getTransactionSelectorDefinition(selector)?.actionType ?? "unknown";
}

export function listTransactionSelectors(): readonly TransactionSelectorDefinition[] {
  return Object.values(TRANSACTION_SELECTOR_REGISTRY);
}

