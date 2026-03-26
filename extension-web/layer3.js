import {
  evaluateTransaction,
  normalizeTransactionRequest,
  normalizeTypedDataRequest,
} from "./lib/shared-rules.js";

export const LAYER3_RPC_METHODS = Object.freeze([
  "eth_sendTransaction",
  "eth_signTypedData",
  "eth_signTypedData_v4",
]);

const LAYER3_RPC_METHOD_SET = new Set(LAYER3_RPC_METHODS);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const LAYER3_USER_REJECTED_ERROR = Object.freeze({
  code: 4001,
  message: "User rejected the request.",
});

export const LAYER3_BLOCK_ACKNOWLEDGEMENT =
  "I understand ClickShield flagged this request as high risk and I still want to continue.";

const REASON_BADGE_LABELS = Object.freeze({
  TX_UNLIMITED_APPROVAL: "Unlimited approval",
  TX_UNKNOWN_SPENDER: "Unknown spender",
  TX_SET_APPROVAL_FOR_ALL: "Collection-wide NFT access",
  TX_PERMIT_SIGNATURE: "Permit signature",
  TX_KNOWN_MALICIOUS_CONTRACT: "Known malicious contract",
  TX_SCAM_SIGNATURE_MATCH: "Known scam signature",
  TX_MULTICALL_APPROVAL_AND_TRANSFER: "Batch approval and transfer",
  TX_UNKNOWN_CONTRACT_INTERACTION: "Unknown contract interaction",
  TX_NEW_RECIPIENT: "New recipient",
});

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAddress(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

function readString(value, fallback = "") {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function readNullableString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function stableStringify(value) {
  if (value === null) {
    return "null";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (!isRecord(value)) {
    return JSON.stringify(value);
  }

  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildDeterministicRequestId(input) {
  return `clickshield-${hashString(
    stableStringify({
      rpcMethod: input.rpcMethod,
      rpcParams: input.rpcParams,
      originUrl: input.originUrl,
      originDomain: input.originDomain,
      walletProvider: input.walletProvider,
      walletMetadata: input.walletMetadata,
      selectedAddress: input.selectedAddress,
      chainId: input.chainId,
      counterparty: input.counterparty,
    }),
  )}`;
}

function safeHostname(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function sanitizeJsonValue(value) {
  if (typeof value === "bigint") {
    return value.toString(10);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry));
  }

  if (isRecord(value)) {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "undefined") {
        continue;
      }
      output[key] = sanitizeJsonValue(entry);
    }
    return output;
  }

  return value;
}

function parseChainIdCandidate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  try {
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 16);
    }

    if (/^[0-9]+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 10);
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeWalletMetadata(value) {
  if (!isRecord(value)) {
    return {
      providerType: "injected",
      walletName: "Unknown Wallet",
      walletVersion: null,
      platform: "web",
    };
  }

  return {
    providerType: readString(value.providerType, "injected"),
    walletName: readString(value.walletName, "Unknown Wallet"),
    walletVersion: readNullableString(value.walletVersion),
    platform: readString(value.platform, "web"),
  };
}

function normalizeCounterparty(value) {
  if (!isRecord(value)) {
    return {
      spenderTrusted: null,
      recipientIsNew: null,
    };
  }

  return {
    spenderTrusted:
      typeof value.spenderTrusted === "boolean" ? value.spenderTrusted : null,
    recipientIsNew:
      typeof value.recipientIsNew === "boolean" ? value.recipientIsNew : null,
  };
}

function readTypedDataParam(rpcParams) {
  if (!Array.isArray(rpcParams) || rpcParams.length === 0) {
    return {};
  }

  if (isAddress(rpcParams[0]) && rpcParams.length > 1) {
    return rpcParams[1];
  }

  if (rpcParams.length > 1 && isAddress(rpcParams[1])) {
    return rpcParams[0];
  }

  return rpcParams[0];
}

function extractSignatureFromParams(rpcParams, fallbackAddress) {
  if (!Array.isArray(rpcParams)) {
    return fallbackAddress;
  }

  for (const param of rpcParams) {
    if (isAddress(param)) {
      return param.trim();
    }
  }

  return fallbackAddress;
}

function coerceTypedDataPayload(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? value : {};
    } catch {
      return {};
    }
  }

  return isRecord(value) ? value : {};
}

function extractTypedDataChainId(value) {
  if (typeof value === "string") {
    try {
      return extractTypedDataChainId(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!isRecord(value) || !isRecord(value.domain)) {
    return null;
  }

  return parseChainIdCandidate(value.domain.chainId);
}

function buildRawRequest(rawRequest) {
  const originUrl = readString(rawRequest?.originUrl);
  const originDomain = readString(rawRequest?.originDomain, safeHostname(originUrl));
  const rpcParams = Array.isArray(rawRequest?.rpcParams)
    ? sanitizeJsonValue(rawRequest.rpcParams)
    : [];
  const walletMetadata = normalizeWalletMetadata(rawRequest?.walletMetadata);
  const counterparty = normalizeCounterparty(rawRequest?.counterparty);

  return {
    requestId:
      readString(rawRequest?.requestId) ||
      buildDeterministicRequestId({
        rpcMethod: readString(rawRequest?.rpcMethod),
        rpcParams,
        originUrl,
        originDomain,
        walletProvider: readString(rawRequest?.walletProvider, "unknown_injected"),
        walletMetadata,
        selectedAddress: isAddress(rawRequest?.selectedAddress)
          ? rawRequest.selectedAddress.trim()
          : ZERO_ADDRESS,
        chainId: rawRequest?.chainId ?? null,
        counterparty,
      }),
    surface: "extension",
    rpcMethod: readString(rawRequest?.rpcMethod),
    rpcParams,
    originUrl,
    originDomain,
    walletProvider: readString(rawRequest?.walletProvider, "unknown_injected"),
    walletMetadata,
    selectedAddress: isAddress(rawRequest?.selectedAddress)
      ? rawRequest.selectedAddress.trim()
      : ZERO_ADDRESS,
    chainId: rawRequest?.chainId ?? null,
    counterparty,
  };
}

function buildNormalizedContext(rawRequest, options = {}) {
  const baseRequest = buildRawRequest(rawRequest);
  if (!isLayer3RpcMethod(baseRequest.rpcMethod)) {
    throw new Error(`Unsupported Layer 3 RPC method: ${baseRequest.rpcMethod}`);
  }

  if (baseRequest.rpcMethod === "eth_sendTransaction") {
    const tx = isRecord(baseRequest.rpcParams[0]) ? baseRequest.rpcParams[0] : {};
    const chainId =
      parseChainIdCandidate(baseRequest.chainId) ??
      parseChainIdCandidate(tx.chainId) ??
      0;

    return {
      rawRequest: baseRequest,
      normalizedContext: normalizeTransactionRequest({
        eventKind: "transaction",
        rpcMethod: "eth_sendTransaction",
        chainFamily: "evm",
        chainId,
        from: isAddress(tx.from) ? tx.from : baseRequest.selectedAddress,
        to: isAddress(tx.to) ? tx.to : ZERO_ADDRESS,
        value:
          typeof tx.value === "string" ||
          typeof tx.value === "number" ||
          typeof tx.value === "bigint"
            ? tx.value
            : "0x0",
        calldata:
          typeof tx.data === "string"
            ? tx.data
            : typeof tx.input === "string"
              ? tx.input
              : "0x",
        originDomain: baseRequest.originDomain,
        walletProvider: baseRequest.walletProvider,
        walletMetadata: baseRequest.walletMetadata,
        surface: "extension",
        counterparty: baseRequest.counterparty,
      }, {
        intelProvider: options.intelProvider ?? null,
      }),
    };
  }

  const typedDataPayload = coerceTypedDataPayload(readTypedDataParam(baseRequest.rpcParams));
  const chainId =
    parseChainIdCandidate(baseRequest.chainId) ??
    extractTypedDataChainId(typedDataPayload) ??
    0;

  return {
    rawRequest: baseRequest,
    normalizedContext: normalizeTypedDataRequest({
      eventKind: "signature",
      rpcMethod: baseRequest.rpcMethod,
      chainFamily: "evm",
      chainId,
      from: extractSignatureFromParams(baseRequest.rpcParams, baseRequest.selectedAddress),
      typedData: typedDataPayload,
      originDomain: baseRequest.originDomain,
      walletProvider: baseRequest.walletProvider,
      walletMetadata: baseRequest.walletMetadata,
      surface: "extension",
      counterparty: baseRequest.counterparty,
    }, {
      intelProvider: options.intelProvider ?? null,
    }),
  };
}

function buildReasonBadges(reasonCodes) {
  return reasonCodes.map((code) => ({
    code,
    label: REASON_BADGE_LABELS[code] ?? code,
  }));
}

function buildPrimaryAddress(context) {
  if (context.eventKind === "signature") {
    return context.signature.verifyingContract;
  }

  return context.to;
}

function buildPrimaryAddressLabel(context) {
  return context.eventKind === "signature" ? "Verifying contract" : "Target contract";
}

function buildSelectorLabel(context) {
  if (context.eventKind === "signature") {
    return context.signature.primaryType;
  }

  return context.methodSelector;
}

function buildSelectorLabelTitle(context) {
  return context.eventKind === "signature" ? "Primary type" : "Method selector";
}

function buildScopeSummary(context) {
  if (context.eventKind === "signature") {
    return context.signature.permitKind === "none"
      ? "Typed-data signature request"
      : "Signature can authorize token permissions";
  }

  switch (context.actionType) {
    case "approve":
    case "increaseAllowance":
      return context.decoded.amountKind === "unlimited"
        ? "Unlimited token spending permission"
        : `Token spending amount: ${context.decoded.amount ?? "unknown"}`;
    case "setApprovalForAll":
      return "All NFTs in this collection";
    case "transfer":
    case "transferFrom":
      return `Asset movement amount: ${context.decoded.amount ?? "unknown"}`;
    case "multicall":
      return `Batch action count: ${context.batch.actions.length}`;
    default:
      return context.valueWei !== "0"
        ? `Native value: ${context.valueWei}`
        : "Opaque contract interaction";
  }
}

function buildHighestRiskConsequence(verdict, context) {
  if (
    verdict.reasonCodes.includes("TX_KNOWN_MALICIOUS_CONTRACT") ||
    verdict.reasonCodes.includes("TX_SCAM_SIGNATURE_MATCH")
  ) {
    return "ClickShield believes this request may be malicious and could expose funds or approvals.";
  }

  if (verdict.reasonCodes.includes("TX_UNLIMITED_APPROVAL")) {
    return "This request can give a contract ongoing permission to spend tokens.";
  }

  if (verdict.reasonCodes.includes("TX_SET_APPROVAL_FOR_ALL")) {
    return "This request can grant collection-wide NFT transfer access.";
  }

  if (verdict.reasonCodes.includes("TX_PERMIT_SIGNATURE")) {
    return "This signature can authorize token permissions without another on-chain approval.";
  }

  if (verdict.reasonCodes.includes("TX_MULTICALL_APPROVAL_AND_TRANSFER")) {
    return "This request batches permissions and asset movement in one wallet action.";
  }

  if (verdict.reasonCodes.includes("TX_UNKNOWN_CONTRACT_INTERACTION")) {
    return "ClickShield could not fully decode this request.";
  }

  return context.eventKind === "signature"
    ? "This signature request carries non-trivial wallet risk."
    : "This transaction request carries non-trivial wallet risk.";
}

function buildConfirmationContract(verdict, context) {
  const consequence = buildHighestRiskConsequence(verdict, context);

  if (verdict.overrideLevel === "high_friction_confirm") {
    return {
      kind: "typed_acknowledgement",
      title: "Type the acknowledgement to continue",
      prompt: "ClickShield requires a typed acknowledgement before forwarding this blocked request.",
      consequence,
      expectedText: LAYER3_BLOCK_ACKNOWLEDGEMENT,
      confirmLabel: "Type and Continue",
    };
  }

  return {
    kind: "confirm",
    title: "Confirm override",
    prompt: "Review the risk and confirm you want to continue.",
    consequence,
    expectedText: null,
    confirmLabel: "Confirm and Continue",
  };
}

function buildModalContract(context, verdict) {
  return {
    verdictLabel: verdict.status === "BLOCK" ? "Blocked" : "Warning",
    headline: verdict.explanation.headline,
    summary: verdict.explanation.summary,
    details: verdict.explanation.details,
    unknowns: verdict.explanation.unknowns,
    technical: verdict.explanation.technical,
    originDomain: context.originDomain,
    chainId: context.chainId,
    chainLabel: context.chainId > 0 ? `Chain ${context.chainId}` : "Unknown chain",
    walletAccount: context.from,
    primaryAddressLabel: buildPrimaryAddressLabel(context),
    primaryAddress: buildPrimaryAddress(context),
    selectorLabel: buildSelectorLabelTitle(context),
    selectorValue: buildSelectorLabel(context),
    approvalScope: buildScopeSummary(context),
    reasonBadges: buildReasonBadges(verdict.reasonCodes),
    overrideAllowed: verdict.overrideAllowed,
    overrideLevel: verdict.overrideLevel,
    confirmation: buildConfirmationContract(verdict, context),
    evidence: verdict.evidence,
    matchedRules: verdict.matchedRules,
  };
}

function confirmationModeForOverrideLevel(overrideLevel) {
  switch (overrideLevel) {
    case "confirm":
      return "confirm";
    case "high_friction_confirm":
      return "typed_acknowledgement";
    default:
      return "none";
  }
}

function buildAuditRecord(rawRequest, context, verdict) {
  return {
    requestId: rawRequest.requestId,
    surface: "extension",
    rpcMethod: rawRequest.rpcMethod,
    originDomain: rawRequest.originDomain,
    chainId: context.chainId,
    from: context.from,
    targetOrVerifier: buildPrimaryAddress(context),
    selectorOrPrimaryType: buildSelectorLabel(context),
    verdictStatus: verdict.status,
    riskLevel: verdict.riskLevel,
    reasonCodes: verdict.reasonCodes,
    matchedRules: verdict.matchedRules,
    ruleSetVersion: verdict.ruleSetVersion,
    intelVersions: verdict.intelVersions,
    finalUserAction: verdict.status === "ALLOW" ? "auto-allowed" : "pending",
    confirmationMode: confirmationModeForOverrideLevel(verdict.overrideLevel),
  };
}

export function isLayer3RpcMethod(method) {
  return LAYER3_RPC_METHOD_SET.has(method);
}

export function evaluateLayer3RpcRequest(rawRequest, options = {}) {
  const { rawRequest: normalizedRawRequest, normalizedContext } = buildNormalizedContext(
    rawRequest,
    options,
  );
  const evaluation = evaluateTransaction(normalizedContext);
  const verdict = evaluation.verdict;

  return {
    requestId: normalizedRawRequest.requestId,
    rawRequest: normalizedRawRequest,
    normalizedContext,
    evaluation,
    verdict,
    signals: evaluation.signals,
    action: verdict.status === "ALLOW" ? "allow" : "gate",
    modal: verdict.status === "ALLOW" ? null : buildModalContract(normalizedContext, verdict),
    audit: buildAuditRecord(normalizedRawRequest, normalizedContext, verdict),
  };
}
