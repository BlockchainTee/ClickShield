import { normalizeEvmAddress } from "../normalize/address.js";
import { MAX_UINT256_HEX, extractSelector } from "../normalize/transaction.js";
import {
  ALLOWED_BOOL_PERMIT_SELECTOR,
  APPROVE_SELECTOR,
  ERC20_PERMIT_SELECTOR,
  getTransactionSelectorDefinition,
  INCREASE_ALLOWANCE_SELECTOR,
  MULTICALL_BYTES_SELECTOR,
  MULTICALL_DEADLINE_BYTES_SELECTOR,
  SET_APPROVAL_FOR_ALL_SELECTOR,
  TRANSFER_FROM_SELECTOR,
  TRANSFER_SELECTOR,
} from "./selectors.js";
import { hydrateNormalizedTransactionContext } from "./hydrate.js";
import { normalizeTypedData } from "./typed-data.js";
import type { TransactionIntelProvider } from "./intel-provider.js";
import type {
  ApprovalAmountKind,
  DecodedTransactionAction,
  NormalizedTransactionContext,
  RawSignatureRequest,
  RawTransactionRequest,
  TransactionBatchContext,
  TransactionCounterpartyContext,
  TransactionProviderContext,
  TransactionParamValue,
} from "./types.js";

function normalizeHex(calldata: string): string {
  const trimmed = calldata.trim().toLowerCase();
  if (trimmed === "") return "0x";
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function getBody(calldata: string): string {
  const clean = stripHexPrefix(normalizeHex(calldata));
  return clean.length <= 8 ? "" : clean.slice(8);
}

function getWord(body: string, index: number): string | null {
  const start = index * 64;
  const end = start + 64;
  if (body.length < end) return null;
  return body.slice(start, end);
}

function decodeAddressWord(word: string | null): string | null {
  if (word === null || word.length !== 64) return null;
  return normalizeEvmAddress(`0x${word.slice(24)}`);
}

function decodeUintWord(word: string | null): string | null {
  if (word === null || word.length !== 64) return null;
  return BigInt(`0x${word}`).toString(10);
}

function decodeBoolWord(word: string | null): boolean | null {
  if (word === null || word.length !== 64) return null;
  return BigInt(`0x${word}`) !== 0n;
}

function quantityToDecimal(
  value: string | number | bigint | null | undefined
): string {
  if (value === null || value === undefined) return "0";
  if (typeof value === "bigint") return value.toString(10);
  if (typeof value === "number") return BigInt(value).toString(10);
  const trimmed = value.trim();
  if (trimmed === "") return "0";
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    return BigInt(trimmed).toString(10);
  }
  return BigInt(trimmed).toString(10);
}

function defaultCounterparty(
  input: Partial<TransactionCounterpartyContext> | undefined
): TransactionCounterpartyContext {
  return {
    spenderTrusted: input?.spenderTrusted ?? null,
    recipientIsNew: input?.recipientIsNew ?? null,
  };
}

function buildProvider(
  surface: string | undefined,
  walletProvider: string,
  walletMetadata: RawTransactionRequest["walletMetadata"] | RawSignatureRequest["walletMetadata"]
): TransactionProviderContext {
  return {
    surface: surface ?? "unknown",
    walletProvider,
    walletName: walletMetadata.walletName,
    platform: walletMetadata.platform,
  };
}

function buildDecodedAction(
  input: Partial<DecodedTransactionAction> & {
    readonly actionType: DecodedTransactionAction["actionType"];
  }
): DecodedTransactionAction {
  return {
    functionName: input.functionName ?? null,
    selector: input.selector ?? null,
    actionType: input.actionType,
    params: input.params ?? {},
    tokenAddress: input.tokenAddress ?? null,
    spender: input.spender ?? null,
    operator: input.operator ?? null,
    recipient: input.recipient ?? null,
    owner: input.owner ?? null,
    amount: input.amount ?? null,
    amountKind: input.amountKind ?? "not_applicable",
    approvalScope: input.approvalScope ?? "not_applicable",
    approvalDirection: input.approvalDirection ?? "not_applicable",
  };
}

function buildApprovalAmountKind(amountHex: string | null): ApprovalAmountKind {
  if (amountHex === null) return "not_applicable";
  return amountHex.toLowerCase() === MAX_UINT256_HEX ? "unlimited" : "exact";
}

function decodeBytesArray(body: string, offsetWord: string | null): string[] {
  if (offsetWord === null) return [];
  const arrayStart = Number(BigInt(`0x${offsetWord}`)) * 2;
  const lengthWord = body.slice(arrayStart, arrayStart + 64);
  if (lengthWord.length !== 64) return [];
  const itemCount = Number(BigInt(`0x${lengthWord}`));
  const results: string[] = [];

  for (let index = 0; index < itemCount; index += 1) {
    const itemOffsetWord = body.slice(
      arrayStart + 64 + index * 64,
      arrayStart + 64 + (index + 1) * 64
    );
    if (itemOffsetWord.length !== 64) {
      results.push("0x");
      continue;
    }

    const relativeOffset = Number(BigInt(`0x${itemOffsetWord}`)) * 2;
    const itemStart = arrayStart + relativeOffset;
    const itemLengthWord = body.slice(itemStart, itemStart + 64);
    if (itemLengthWord.length !== 64) {
      results.push("0x");
      continue;
    }

    const byteLength = Number(BigInt(`0x${itemLengthWord}`));
    const dataStart = itemStart + 64;
    const dataEnd = dataStart + byteLength * 2;
    if (body.length < dataEnd) {
      results.push("0x");
      continue;
    }

    results.push(`0x${body.slice(dataStart, dataEnd)}`);
  }

  return results;
}

function decodeSimpleCall(
  selector: string,
  body: string,
  toAddress: string | null
): { readonly decoded: DecodedTransactionAction; readonly batch: TransactionBatchContext } {
  const word0 = getWord(body, 0);
  const word1 = getWord(body, 1);
  const word2 = getWord(body, 2);
  const word3 = getWord(body, 3);
  const word4 = getWord(body, 4);
  const word5 = getWord(body, 5);
  const word6 = getWord(body, 6);

  switch (selector) {
    case APPROVE_SELECTOR: {
      const amountHex = word1?.toLowerCase() ?? null;
      return {
        decoded: buildDecodedAction({
          functionName: "approve",
          selector,
          actionType: "approve",
          tokenAddress: toAddress,
          spender: decodeAddressWord(word0),
          amount: decodeUintWord(word1),
          amountKind: buildApprovalAmountKind(amountHex),
          approvalScope: "single_token",
          approvalDirection: "grant",
          params: {
            spender: decodeAddressWord(word0),
            amount: decodeUintWord(word1),
          },
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] },
      };
    }
    case SET_APPROVAL_FOR_ALL_SELECTOR: {
      const approved = decodeBoolWord(word1);
      return {
        decoded: buildDecodedAction({
          functionName: "setApprovalForAll",
          selector,
          actionType: "setApprovalForAll",
          tokenAddress: toAddress,
          operator: decodeAddressWord(word0),
          approvalScope: "collection_all",
          approvalDirection: approved === false ? "revoke" : "grant",
          params: {
            operator: decodeAddressWord(word0),
            approved,
          },
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] },
      };
    }
    case INCREASE_ALLOWANCE_SELECTOR: {
      const amountHex = word1?.toLowerCase() ?? null;
      return {
        decoded: buildDecodedAction({
          functionName: "increaseAllowance",
          selector,
          actionType: "increaseAllowance",
          tokenAddress: toAddress,
          spender: decodeAddressWord(word0),
          amount: decodeUintWord(word1),
          amountKind: buildApprovalAmountKind(amountHex),
          approvalScope: "single_token",
          approvalDirection: "grant",
          params: {
            spender: decodeAddressWord(word0),
            amount: decodeUintWord(word1),
          },
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] },
      };
    }
    case TRANSFER_SELECTOR: {
      return {
        decoded: buildDecodedAction({
          functionName: "transfer",
          selector,
          actionType: "transfer",
          tokenAddress: toAddress,
          recipient: decodeAddressWord(word0),
          amount: decodeUintWord(word1),
          amountKind: "exact",
          approvalScope: "not_applicable",
          params: {
            recipient: decodeAddressWord(word0),
            amount: decodeUintWord(word1),
          },
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] },
      };
    }
    case TRANSFER_FROM_SELECTOR: {
      return {
        decoded: buildDecodedAction({
          functionName: "transferFrom",
          selector,
          actionType: "transferFrom",
          tokenAddress: toAddress,
          owner: decodeAddressWord(word0),
          recipient: decodeAddressWord(word1),
          amount: decodeUintWord(word2),
          amountKind: "exact",
          approvalScope: "not_applicable",
          params: {
            owner: decodeAddressWord(word0),
            recipient: decodeAddressWord(word1),
            amount: decodeUintWord(word2),
          },
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] },
      };
    }
    case ERC20_PERMIT_SELECTOR: {
      return {
        decoded: buildDecodedAction({
          functionName: "permit",
          selector,
          actionType: "permit",
          tokenAddress: toAddress,
          owner: decodeAddressWord(word0),
          spender: decodeAddressWord(word1),
          amount: decodeUintWord(word2),
          amountKind: "exact",
          approvalScope: "single_token",
          approvalDirection: "grant",
          params: {
            owner: decodeAddressWord(word0),
            spender: decodeAddressWord(word1),
            amount: decodeUintWord(word2),
            deadline: decodeUintWord(word3),
            v: decodeUintWord(word4),
            r: word5 === null ? null : `0x${word5}`,
            s: word6 === null ? null : `0x${word6}`,
          },
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] },
      };
    }
    case ALLOWED_BOOL_PERMIT_SELECTOR: {
      return {
        decoded: buildDecodedAction({
          functionName: "permit",
          selector,
          actionType: "permit",
          tokenAddress: toAddress,
          owner: decodeAddressWord(word0),
          spender: decodeAddressWord(word1),
          amount: null,
          amountKind: "not_applicable",
          approvalScope: "single_token",
          approvalDirection: "grant",
          params: {
            owner: decodeAddressWord(word0),
            spender: decodeAddressWord(word1),
            nonce: decodeUintWord(word2),
            expiry: decodeUintWord(word3),
            allowed: decodeBoolWord(word4),
            v: decodeUintWord(word5),
            r: word6 === null ? null : `0x${word6}`,
            s: getWord(body, 7) === null ? null : `0x${getWord(body, 7)}`,
          },
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] },
      };
    }
    case MULTICALL_BYTES_SELECTOR:
    case MULTICALL_DEADLINE_BYTES_SELECTOR: {
      const bytesOffsetWord = selector === MULTICALL_BYTES_SELECTOR ? word0 : word1;
      const rawCalls = decodeBytesArray(body, bytesOffsetWord);
      const actions = rawCalls.map((rawCall) => decodeTransactionCalldata(rawCall).decoded);
      const params: Record<string, TransactionParamValue> = {
        actionCount: `${actions.length}`,
      };
      if (selector === MULTICALL_DEADLINE_BYTES_SELECTOR) {
        params.deadline = decodeUintWord(word0);
      }
      return {
        decoded: buildDecodedAction({
          functionName: "multicall",
          selector,
          actionType: "multicall",
          tokenAddress: toAddress,
          params,
        }),
        batch: {
          isMulticall: true,
          batchSelector: selector,
          actions,
        },
      };
    }
    default:
      return {
        decoded: buildDecodedAction({
          selector,
          actionType: "unknown",
          tokenAddress: toAddress,
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] },
      };
  }
}

export function decodeTransactionCalldata(
  calldata: string,
  toAddress: string | null = null
): {
  readonly decoded: DecodedTransactionAction;
  readonly batch: TransactionBatchContext;
} {
  const normalizedCalldata = normalizeHex(calldata);
  const selector = extractSelector(normalizedCalldata);
  const definition = getTransactionSelectorDefinition(selector);
  const body = getBody(normalizedCalldata);

  if (definition === null) {
    return {
      decoded: buildDecodedAction({
        selector: selector === "0x" ? null : selector,
        actionType: "unknown",
        tokenAddress: toAddress,
      }),
      batch: { isMulticall: false, batchSelector: null, actions: [] },
    };
  }

  return decodeSimpleCall(selector, body, toAddress);
}

export function normalizeTransactionRequest(
  input: RawTransactionRequest,
  options?: {
    readonly intelProvider?: TransactionIntelProvider | null;
  }
): NormalizedTransactionContext {
  const to = normalizeEvmAddress(input.to);
  const from = normalizeEvmAddress(input.from);
  const normalizedCalldata = normalizeHex(input.calldata);
  const methodSelector = normalizedCalldata === "0x" ? null : extractSelector(normalizedCalldata);
  const { decoded, batch } = decodeTransactionCalldata(normalizedCalldata, to);

  return hydrateNormalizedTransactionContext(
    {
    eventKind: "transaction",
    rpcMethod: input.rpcMethod,
    chainFamily: input.chainFamily,
    chainId: input.chainId,
    originDomain: input.originDomain,
    from,
    to,
    valueWei: quantityToDecimal(input.value),
    calldata: normalizedCalldata,
    methodSelector,
    actionType: decoded.actionType,
    decoded,
    batch,
    signature: {
      isTypedData: false,
      primaryType: null,
      domainName: null,
      domainVersion: null,
      domainChainId: null,
      domainChainIdPresent: false,
      verifyingContract: null,
      verifyingContractPresent: false,
      message: {},
      domain: {},
      types: {},
      canonicalJson: "{}",
      normalizationState: "normalized",
      missingDomainFields: [],
      invalidDomainFields: [],
      permitKind: "none",
    },
    intel: {
      contractDisposition: "unavailable",
      contractFeedVersion: null,
      allowlistFeedVersion: null,
      signatureDisposition: "unavailable",
      signatureFeedVersion: null,
      originDisposition: "unavailable",
      sectionStates: {},
    },
    provider: buildProvider(
      input.surface,
      input.walletProvider,
      input.walletMetadata
    ),
    counterparty: defaultCounterparty(input.counterparty),
    meta: {
      selectorRecognized: methodSelector !== null && getTransactionSelectorDefinition(methodSelector) !== null,
      typedDataNormalized: false,
    },
    },
    options?.intelProvider
  );
}

export function normalizeTypedDataRequest(
  input: RawSignatureRequest,
  options?: {
    readonly intelProvider?: TransactionIntelProvider | null;
  }
): NormalizedTransactionContext {
  const from = normalizeEvmAddress(input.from);
  const signature = normalizeTypedData(input.typedData);

  return hydrateNormalizedTransactionContext(
    {
    eventKind: "signature",
    rpcMethod: input.rpcMethod,
    chainFamily: input.chainFamily,
    chainId: input.chainId,
    originDomain: input.originDomain,
    from,
    to: signature.verifyingContract,
    valueWei: "0",
    calldata: "0x",
    methodSelector: null,
    actionType: signature.permitKind === "none" ? "unknown" : "permit",
    decoded: buildDecodedAction({
      actionType: signature.permitKind === "none" ? "unknown" : "permit",
      functionName: signature.permitKind === "none" ? null : "permit",
      tokenAddress: signature.verifyingContract,
      selector: null,
    }),
    batch: {
      isMulticall: false,
      batchSelector: null,
      actions: [],
    },
    signature,
    intel: {
      contractDisposition: "unavailable",
      contractFeedVersion: null,
      allowlistFeedVersion: null,
      signatureDisposition: "unavailable",
      signatureFeedVersion: null,
      originDisposition: "unavailable",
      sectionStates: {},
    },
    provider: buildProvider(
      input.surface,
      input.walletProvider,
      input.walletMetadata
    ),
    counterparty: defaultCounterparty(input.counterparty),
    meta: {
      selectorRecognized: false,
      typedDataNormalized: signature.normalizationState === "normalized",
    },
    },
    options?.intelProvider
  );
}
