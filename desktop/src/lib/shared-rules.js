// GENERATED FILE - sourced from packages/shared-rules/dist/index.js via npm run sync:surfaces.
// src/engine/priorities.ts
var SEVERITY_WEIGHT = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};
function compareRules(a, b) {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  const aWeight = SEVERITY_WEIGHT[a.severity];
  const bWeight = SEVERITY_WEIGHT[b.severity];
  if (aWeight !== bWeight) {
    return bWeight - aWeight;
  }
  return a.id.localeCompare(b.id);
}
function sortRules(rules2) {
  return [...rules2].sort(compareRules);
}

// src/transaction/selectors.ts
var APPROVE_SELECTOR = "0x095ea7b3";
var SET_APPROVAL_FOR_ALL_SELECTOR = "0xa22cb465";
var INCREASE_ALLOWANCE_SELECTOR = "0x39509351";
var TRANSFER_SELECTOR = "0xa9059cbb";
var TRANSFER_FROM_SELECTOR = "0x23b872dd";
var ERC20_PERMIT_SELECTOR = "0xd505accf";
var ALLOWED_BOOL_PERMIT_SELECTOR = "0x8fcbaf0c";
var MULTICALL_BYTES_SELECTOR = "0xac9650d8";
var MULTICALL_DEADLINE_BYTES_SELECTOR = "0x5ae401dc";
var TRANSACTION_SELECTOR_REGISTRY = Object.freeze({
  [APPROVE_SELECTOR]: {
    selector: APPROVE_SELECTOR,
    functionName: "approve",
    actionType: "approve",
    variant: "standard"
  },
  [SET_APPROVAL_FOR_ALL_SELECTOR]: {
    selector: SET_APPROVAL_FOR_ALL_SELECTOR,
    functionName: "setApprovalForAll",
    actionType: "setApprovalForAll",
    variant: "standard"
  },
  [INCREASE_ALLOWANCE_SELECTOR]: {
    selector: INCREASE_ALLOWANCE_SELECTOR,
    functionName: "increaseAllowance",
    actionType: "increaseAllowance",
    variant: "standard"
  },
  [TRANSFER_SELECTOR]: {
    selector: TRANSFER_SELECTOR,
    functionName: "transfer",
    actionType: "transfer",
    variant: "standard"
  },
  [TRANSFER_FROM_SELECTOR]: {
    selector: TRANSFER_FROM_SELECTOR,
    functionName: "transferFrom",
    actionType: "transferFrom",
    variant: "standard"
  },
  [ERC20_PERMIT_SELECTOR]: {
    selector: ERC20_PERMIT_SELECTOR,
    functionName: "permit",
    actionType: "permit",
    variant: "standard"
  },
  [ALLOWED_BOOL_PERMIT_SELECTOR]: {
    selector: ALLOWED_BOOL_PERMIT_SELECTOR,
    functionName: "permit",
    actionType: "permit",
    variant: "allowed_bool"
  },
  [MULTICALL_BYTES_SELECTOR]: {
    selector: MULTICALL_BYTES_SELECTOR,
    functionName: "multicall",
    actionType: "multicall",
    variant: "bytes_array"
  },
  [MULTICALL_DEADLINE_BYTES_SELECTOR]: {
    selector: MULTICALL_DEADLINE_BYTES_SELECTOR,
    functionName: "multicall",
    actionType: "multicall",
    variant: "deadline_bytes_array"
  }
});
function getTransactionSelectorDefinition(selector) {
  const normalized = selector.toLowerCase();
  return TRANSACTION_SELECTOR_REGISTRY[normalized] ?? null;
}
function classifyTransactionSelector(selector) {
  return getTransactionSelectorDefinition(selector)?.actionType ?? "unknown";
}
function listTransactionSelectors() {
  return Object.values(TRANSACTION_SELECTOR_REGISTRY);
}

// src/normalize/transaction.ts
var MAX_UINT256_HEX = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
var KNOWN_SELECTORS = {
  [APPROVE_SELECTOR]: "approve",
  [SET_APPROVAL_FOR_ALL_SELECTOR]: "setApprovalForAll",
  [INCREASE_ALLOWANCE_SELECTOR]: "increaseAllowance",
  [TRANSFER_SELECTOR]: "transfer",
  [TRANSFER_FROM_SELECTOR]: "transferFrom",
  [ERC20_PERMIT_SELECTOR]: "permit",
  [MULTICALL_BYTES_SELECTOR]: "multicall",
  [MULTICALL_DEADLINE_BYTES_SELECTOR]: "multicall"
};
function extractSelector(calldata) {
  const clean = calldata.startsWith("0x") ? calldata : `0x${calldata}`;
  return clean.slice(0, 10).toLowerCase();
}

// src/signals/transaction-signals.ts
var HIGH_VALUE_THRESHOLD = 1000000000000000000n;
var MAX_UINT256_DECIMAL = BigInt(`0x${MAX_UINT256_HEX}`).toString(10);
function toMethodName(methodSelector, calldata) {
  const selector = methodSelector ?? (calldata === "0x" ? null : extractSelector(calldata));
  if (selector === null || selector === "0x") {
    return void 0;
  }
  return getTransactionSelectorDefinition(selector)?.functionName ?? void 0;
}
function isApprovalMethodAction(action) {
  return action.actionType === "approve" || action.actionType === "increaseAllowance" || action.actionType === "setApprovalForAll";
}
function approvalDirectionForAction(action) {
  return action.approvalDirection;
}
function isGrantApprovalAction(action) {
  return isApprovalMethodAction(action) && approvalDirectionForAction(action) === "grant";
}
function hasTransferAction(action) {
  return action.actionType === "transfer" || action.actionType === "transferFrom";
}
function isTransactionSignalInput(input) {
  return input.eventKind === "transaction";
}
function isSignatureSignalInput(input) {
  return input.eventKind === "signature";
}
function buildTransactionSignalsFromTransaction(input) {
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
    isUnlimitedApproval: isApprovalMethodAction(input.decoded) && input.decoded.amount === MAX_UINT256_DECIMAL,
    hasValueTransfer,
    isHighValue: BigInt(input.valueWei) >= HIGH_VALUE_THRESHOLD,
    targetAddress: input.to ?? void 0,
    isPermitSignature: false,
    isSetApprovalForAll: input.decoded.actionType === "setApprovalForAll",
    approvalDirection: approvalDirectionForAction(input.decoded),
    spenderTrusted: input.counterparty.spenderTrusted,
    recipientIsNew: input.counterparty.recipientIsNew,
    isTransfer: input.decoded.actionType === "transfer",
    isTransferFrom: input.decoded.actionType === "transferFrom",
    isMulticall: input.batch.isMulticall,
    containsApprovalAndTransfer: input.batch.isMulticall && containsApproval && actions.some((action) => hasTransferAction(action)),
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
    )
  };
}
function buildTransactionSignalsFromSignature(input) {
  return {
    isContractInteraction: false,
    isNativeTransfer: false,
    methodName: void 0,
    isApproval: false,
    actionType: input.actionType,
    isApprovalMethod: false,
    isUnlimitedApproval: false,
    hasValueTransfer: false,
    isHighValue: false,
    targetAddress: input.signature.verifyingContract ?? void 0,
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
    verifyingContractKnown: input.signature.verifyingContractPresent && input.signature.verifyingContract !== null,
    hasUnknownInnerCall: false
  };
}
function getTransactionSignals(input) {
  return buildTransactionSignalsFromTransaction(input);
}
function buildTransactionSignals(context) {
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

// src/transaction/explain.ts
var REASON_LABELS = Object.freeze({
  TX_UNLIMITED_APPROVAL: "Unlimited token approval",
  TX_UNKNOWN_SPENDER: "Unknown spender",
  TX_SET_APPROVAL_FOR_ALL: "Full NFT collection approval",
  TX_PERMIT_SIGNATURE: "Permit signature",
  TX_KNOWN_MALICIOUS_CONTRACT: "Known malicious contract",
  TX_SCAM_SIGNATURE_MATCH: "Known scam signature match",
  TX_MULTICALL_APPROVAL_AND_TRANSFER: "Batch approval and transfer",
  TX_UNKNOWN_CONTRACT_INTERACTION: "Unknown contract interaction",
  TX_NEW_RECIPIENT: "New recipient"
});
function humanizeIdentifier(value) {
  return value.replace(/^TX_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}
function toExplanationStatus(status) {
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
function summaryForStatus(status) {
  switch (status) {
    case "block":
      return "This transaction is dangerous and has been blocked";
    case "warn":
      return "This transaction may be risky";
    case "allow":
      return "This transaction appears safe";
  }
}
function explanationRiskLevel(status) {
  switch (status) {
    case "block":
      return "high";
    case "warn":
      return "medium";
    case "allow":
      return "low";
  }
}
function hasMatchedReasonFields(verdict) {
  return "primaryReason" in verdict && "secondaryReasons" in verdict;
}
function readableReasonLabel(reasonCode) {
  return REASON_LABELS[reasonCode] ?? humanizeIdentifier(reasonCode);
}
function readableMatchedReason(reason) {
  const reasonCode = reason.reasonCodes[0];
  if (typeof reasonCode === "string" && reasonCode.length > 0) {
    return readableReasonLabel(reasonCode);
  }
  return humanizeIdentifier(reason.ruleId);
}
function primaryReasonForVerdict(verdict, status) {
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
function secondaryReasonsForVerdict(verdict) {
  if (!hasMatchedReasonFields(verdict)) {
    return [];
  }
  const seen = /* @__PURE__ */ new Set();
  const readableReasons = [];
  for (const reason of verdict.secondaryReasons) {
    const label = readableMatchedReason(reason);
    if (!seen.has(label)) {
      seen.add(label);
      readableReasons.push(label);
    }
  }
  return readableReasons;
}
function detailMethod(context) {
  const signals = context.signals ?? buildTransactionSignals(context);
  if (signals.methodName) {
    return signals.methodName;
  }
  if (context.eventKind === "signature") {
    return context.signature.primaryType ?? void 0;
  }
  return void 0;
}
function detailTarget(context) {
  const signals = context.signals ?? buildTransactionSignals(context);
  return signals.targetAddress;
}
function detailValue(context) {
  if (context.eventKind !== "transaction") {
    return void 0;
  }
  return context.valueWei;
}
function explainTransaction(ctx, verdict) {
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
      isContractInteraction: signals.isContractInteraction
    }
  };
}

// src/intel/hash.ts
var SHA256_K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function rotateRight(value, bits) {
  return value >>> bits | value << 32 - bits;
}
function canonicalizeNumber(value) {
  if (!Number.isFinite(value)) {
    throw new Error("Canonical serialization does not support non-finite numbers");
  }
  return JSON.stringify(value);
}
function isCanonicalObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function serializeCanonicalJson(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return canonicalizeNumber(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonicalJson).join(",")}]`;
  }
  if (!isCanonicalObject(value)) {
    throw new Error("Canonical serialization received an unsupported object value");
  }
  const objectValue = value;
  const keys = Object.keys(objectValue).sort();
  const entries = keys.map((key) => {
    const nested = objectValue[key];
    return `${JSON.stringify(key)}:${serializeCanonicalJson(nested)}`;
  });
  return `{${entries.join(",")}}`;
}
function sha256Hex(input) {
  const source = new TextEncoder().encode(input);
  const bitLength = source.length * 8;
  const paddedLength = source.length + 9 + 63 >> 6 << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(source);
  padded[source.length] = 128;
  const view = new DataView(padded.buffer);
  const upperBits = Math.floor(bitLength / 4294967296);
  const lowerBits = bitLength >>> 0;
  view.setUint32(paddedLength - 8, upperBits, false);
  view.setUint32(paddedLength - 4, lowerBits, false);
  let h0 = 1779033703;
  let h1 = 3144134277;
  let h2 = 1013904242;
  let h3 = 2773480762;
  let h4 = 1359893119;
  let h5 = 2600822924;
  let h6 = 528734635;
  let h7 = 1541459225;
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(schedule[index - 15], 7) ^ rotateRight(schedule[index - 15], 18) ^ schedule[index - 15] >>> 3;
      const s1 = rotateRight(schedule[index - 2], 17) ^ rotateRight(schedule[index - 2], 19) ^ schedule[index - 2] >>> 10;
      schedule[index] = schedule[index - 16] + s0 + schedule[index - 7] + s1 >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = e & f ^ ~e & g;
      const temp1 = h + sum1 + choice + SHA256_K[index] + schedule[index] >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = a & b ^ a & c ^ b & c;
      const temp2 = sum0 + majority >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + temp1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2 >>> 0;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
    h5 = h5 + f >>> 0;
    h6 = h6 + g >>> 0;
    h7 = h7 + h >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((value) => value.toString(16).padStart(8, "0")).join("");
}

// src/transaction/audit.ts
var DETERMINISTIC_AUDIT_TIMESTAMP = "1970-01-01T00:00:00.000Z";
function toCanonicalJsonValue(value) {
  if (value === null) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString(10);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toCanonicalJsonValue(entry));
  }
  if (typeof value !== "object") {
    throw new Error("Audit serialization received an unsupported value");
  }
  const record = value;
  const canonicalRecord = {};
  for (const key of Object.keys(record)) {
    const entry = record[key];
    if (entry !== void 0) {
      canonicalRecord[key] = toCanonicalJsonValue(entry);
    }
  }
  return canonicalRecord;
}
function cloneCanonical(value) {
  return JSON.parse(
    serializeCanonicalJson(toCanonicalJsonValue(value))
  );
}
function toAuditStatus(status) {
  switch (status) {
    case "ALLOW":
    case "allow":
      return "allow";
    case "WARN":
    case "warn":
      return "warn";
    case "BLOCK":
    case "block":
      return "block";
  }
}
function hasTransactionExplanation(verdict) {
  return "explanation" in verdict;
}
function resolveExplanation(ctx, verdict) {
  if (hasTransactionExplanation(verdict)) {
    return verdict.explanation;
  }
  return explainTransaction(ctx, verdict);
}
function inferAuditSource(ctx) {
  const surface = ctx.provider.surface.trim().toLowerCase();
  const platform = ctx.provider.platform.trim().toLowerCase();
  if (surface.includes("mobile") || platform === "mobile" || platform === "ios" || platform === "android") {
    return "mobile";
  }
  if (surface.includes("desktop") || platform === "desktop" || platform === "electron") {
    return "desktop";
  }
  return "extension";
}
function buildAuditId(ctx, verdict, status, explanation, source) {
  const verdictPayload = {
    status,
    riskLevel: verdict.riskLevel,
    reasonCodes: verdict.reasonCodes,
    matchedRules: verdict.matchedRules,
    evidence: verdict.evidence,
    ruleSetVersion: verdict.ruleSetVersion,
    explanation,
    ...!("feedVersion" in verdict) || verdict.feedVersion === void 0 ? {} : { feedVersion: verdict.feedVersion },
    ...hasTransactionExplanation(verdict) ? {
      intelVersions: verdict.intelVersions,
      overrideAllowed: verdict.overrideAllowed,
      overrideLevel: verdict.overrideLevel,
      primaryReason: verdict.primaryReason,
      primaryRuleId: verdict.primaryRuleId,
      secondaryReasons: verdict.secondaryReasons
    } : {}
  };
  return sha256Hex(
    serializeCanonicalJson(
      toCanonicalJsonValue({
        transaction: ctx,
        verdict: verdictPayload,
        metadata: {
          source
        }
      })
    )
  );
}
function createAuditRecord(ctx, verdict) {
  const status = toAuditStatus(verdict.status);
  const explanation = cloneCanonical(resolveExplanation(ctx, verdict));
  const signals = cloneCanonical(ctx.signals);
  const classification = cloneCanonical(ctx.riskClassification);
  const source = inferAuditSource(ctx);
  return {
    id: buildAuditId(ctx, verdict, status, explanation, source),
    // The shipped evaluation contract must be time-invariant. Real telemetry
    // timestamps belong to the caller or persistence layer, not pure evaluation.
    timestamp: DETERMINISTIC_AUDIT_TIMESTAMP,
    status,
    explanation,
    signals,
    classification,
    metadata: {
      source
    }
  };
}

// src/engine/verdict.ts
var RULE_SET_VERSION = "0.1.0";
var SEVERITY_WEIGHT2 = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};
var OUTCOME_WEIGHT = {
  allow: 0,
  warn: 1,
  block: 2
};
function dedupeStable(values) {
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      deduped.push(value);
    }
  }
  return deduped;
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stabilizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stabilizeValue(entry));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const stable = {};
  for (const key of Object.keys(value).sort()) {
    stable[key] = stabilizeValue(value[key]);
  }
  return stable;
}
function normalizeMatchedRule(match) {
  return {
    ...match,
    reasonCodes: dedupeStable(match.reasonCodes),
    evidence: stabilizeValue(match.evidence)
  };
}
function compareMatchedRules(a, b) {
  const outcomeDelta = OUTCOME_WEIGHT[b.outcome] - OUTCOME_WEIGHT[a.outcome];
  if (outcomeDelta !== 0) {
    return outcomeDelta;
  }
  const severityDelta = SEVERITY_WEIGHT2[b.severity] - SEVERITY_WEIGHT2[a.severity];
  if (severityDelta !== 0) {
    return severityDelta;
  }
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  return a.ruleId.localeCompare(b.ruleId);
}
function orderMatchedRules(matches) {
  return matches.map(normalizeMatchedRule).sort(compareMatchedRules);
}
function toTransactionMatchedReason(match) {
  return {
    ruleId: match.ruleId,
    outcome: match.outcome,
    severity: match.severity,
    priority: match.priority,
    reasonCodes: match.reasonCodes,
    evidence: match.evidence
  };
}
function assembleVerdict(matches) {
  if (matches.length === 0) {
    return {
      status: "allow",
      riskLevel: "low",
      reasonCodes: [],
      matchedRules: [],
      evidence: {},
      ruleSetVersion: RULE_SET_VERSION
    };
  }
  const orderedMatches = orderMatchedRules(matches);
  const primary = orderedMatches[0];
  const status = primary.outcome;
  let highestRisk = "low";
  for (const match of orderedMatches) {
    if (SEVERITY_WEIGHT2[match.severity] > SEVERITY_WEIGHT2[highestRisk]) {
      highestRisk = match.severity;
    }
  }
  const reasonCodes = [];
  for (const match of orderedMatches) {
    reasonCodes.push(...match.reasonCodes);
  }
  const consolidatedReasonCodes = dedupeStable(reasonCodes);
  const matchedRules = orderedMatches.map((m) => m.ruleId);
  const evidence = {};
  for (const match of orderedMatches) {
    for (const [key, value] of Object.entries(match.evidence)) {
      if (!(key in evidence)) {
        evidence[key] = value;
      }
    }
  }
  return {
    status,
    riskLevel: highestRisk,
    reasonCodes: consolidatedReasonCodes,
    matchedRules,
    evidence,
    ruleSetVersion: RULE_SET_VERSION
  };
}
function collectMatches(rules2, input) {
  const matches = [];
  for (const rule of rules2) {
    if (rule.predicate(input)) {
      const reasonCodes = rule.buildReasonCodes(input);
      const evidence = rule.buildEvidence ? rule.buildEvidence(input) : {};
      matches.push({
        ruleId: rule.id,
        priority: rule.priority,
        outcome: rule.outcome,
        severity: rule.severity,
        reasonCodes,
        evidence
      });
    }
  }
  return matches;
}
function toTransactionStatus(status) {
  switch (status) {
    case "allow":
      return "ALLOW";
    case "warn":
      return "WARN";
    case "block":
      return "BLOCK";
  }
}
function overrideLevelForStatus(status) {
  switch (status) {
    case "ALLOW":
      return "none";
    case "WARN":
      return "confirm";
    case "BLOCK":
      return "none";
  }
}
function assembleTransactionVerdict(input, matches) {
  const base2 = assembleVerdict(matches);
  const orderedMatches = orderMatchedRules(matches);
  const primaryReason = orderedMatches[0] ? toTransactionMatchedReason(orderedMatches[0]) : null;
  const secondaryReasons = orderedMatches.slice(1).map((match) => toTransactionMatchedReason(match));
  const status = toTransactionStatus(base2.status);
  const overrideLevel = overrideLevelForStatus(status);
  const signals = input.signals;
  const riskClassification = input.riskClassification;
  const verdictBase = {
    status,
    riskLevel: base2.riskLevel,
    reasonCodes: base2.reasonCodes,
    matchedRules: base2.matchedRules,
    primaryRuleId: primaryReason?.ruleId ?? null,
    primaryReason,
    secondaryReasons,
    evidence: base2.evidence,
    ruleSetVersion: base2.ruleSetVersion,
    intelVersions: {
      contractFeedVersion: input.intel.contractFeedVersion,
      allowlistFeedVersion: input.intel.allowlistFeedVersion,
      signatureFeedVersion: input.intel.signatureFeedVersion
    },
    overrideAllowed: overrideLevel !== "none",
    overrideLevel
  };
  const explanation = explainTransaction(input, verdictBase);
  const audit = createAuditRecord(input, {
    ...verdictBase,
    explanation
  });
  const verdict = {
    ...verdictBase,
    explanation,
    audit
  };
  return {
    verdict,
    matchedRules: verdict.matchedRules,
    reasonCodes: verdict.reasonCodes,
    evidence: verdict.evidence,
    signals,
    riskClassification
  };
}

// src/normalize/domain.ts
var MULTI_PART_TLDS = /* @__PURE__ */ new Set([
  "co.uk",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.za",
  "co.in",
  "com.au",
  "com.br",
  "com.cn",
  "com.mx",
  "com.sg",
  "com.tw",
  "org.uk",
  "org.au",
  "net.au",
  "gov.uk",
  "ac.uk",
  "ne.jp",
  "or.jp"
]);
function extractHostname(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  let urlStr = trimmed;
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = "https://" + urlStr;
  }
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return "";
  }
}
function extractRegistrableDomain(hostname) {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length <= 2) return hostname.toLowerCase();
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return parts.length >= 3 ? parts.slice(-3).join(".") : hostname.toLowerCase();
  }
  return parts.slice(-2).join(".");
}
function extractTld(hostname) {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length < 2) return "";
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return lastTwo;
  }
  return parts[parts.length - 1];
}
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a.length > b.length) {
    [a, b] = [b, a];
  }
  const aLen = a.length;
  const bLen = b.length;
  let prev = new Array(aLen + 1);
  let curr = new Array(aLen + 1);
  for (let i = 0; i <= aLen; i++) {
    prev[i] = i;
  }
  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1,
        prev[i] + 1,
        prev[i - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[aLen];
}
function stringSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

// node_modules/.pnpm/punycode@2.3.1/node_modules/punycode/punycode.es6.js
var maxInt = 2147483647;
var base = 36;
var tMin = 1;
var tMax = 26;
var skew = 38;
var damp = 700;
var initialBias = 72;
var initialN = 128;
var delimiter = "-";
var regexPunycode = /^xn--/;
var regexNonASCII = /[^\0-\x7F]/;
var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
var errors = {
  "overflow": "Overflow: input needs wider integers to process",
  "not-basic": "Illegal input >= 0x80 (not a basic code point)",
  "invalid-input": "Invalid input"
};
var baseMinusTMin = base - tMin;
var floor = Math.floor;
var stringFromCharCode = String.fromCharCode;
function error(type) {
  throw new RangeError(errors[type]);
}
function map(array, callback) {
  const result = [];
  let length = array.length;
  while (length--) {
    result[length] = callback(array[length]);
  }
  return result;
}
function mapDomain(domain, callback) {
  const parts = domain.split("@");
  let result = "";
  if (parts.length > 1) {
    result = parts[0] + "@";
    domain = parts[1];
  }
  domain = domain.replace(regexSeparators, ".");
  const labels = domain.split(".");
  const encoded = map(labels, callback).join(".");
  return result + encoded;
}
function ucs2decode(string) {
  const output = [];
  let counter = 0;
  const length = string.length;
  while (counter < length) {
    const value = string.charCodeAt(counter++);
    if (value >= 55296 && value <= 56319 && counter < length) {
      const extra = string.charCodeAt(counter++);
      if ((extra & 64512) == 56320) {
        output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
      } else {
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}
var ucs2encode = (codePoints) => String.fromCodePoint(...codePoints);
var basicToDigit = function(codePoint) {
  if (codePoint >= 48 && codePoint < 58) {
    return 26 + (codePoint - 48);
  }
  if (codePoint >= 65 && codePoint < 91) {
    return codePoint - 65;
  }
  if (codePoint >= 97 && codePoint < 123) {
    return codePoint - 97;
  }
  return base;
};
var digitToBasic = function(digit, flag) {
  return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
};
var adapt = function(delta, numPoints, firstTime) {
  let k = 0;
  delta = firstTime ? floor(delta / damp) : delta >> 1;
  delta += floor(delta / numPoints);
  for (; delta > baseMinusTMin * tMax >> 1; k += base) {
    delta = floor(delta / baseMinusTMin);
  }
  return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};
var decode = function(input) {
  const output = [];
  const inputLength = input.length;
  let i = 0;
  let n = initialN;
  let bias = initialBias;
  let basic = input.lastIndexOf(delimiter);
  if (basic < 0) {
    basic = 0;
  }
  for (let j = 0; j < basic; ++j) {
    if (input.charCodeAt(j) >= 128) {
      error("not-basic");
    }
    output.push(input.charCodeAt(j));
  }
  for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      if (index >= inputLength) {
        error("invalid-input");
      }
      const digit = basicToDigit(input.charCodeAt(index++));
      if (digit >= base) {
        error("invalid-input");
      }
      if (digit > floor((maxInt - i) / w)) {
        error("overflow");
      }
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) {
        break;
      }
      const baseMinusT = base - t;
      if (w > floor(maxInt / baseMinusT)) {
        error("overflow");
      }
      w *= baseMinusT;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi == 0);
    if (floor(i / out) > maxInt - n) {
      error("overflow");
    }
    n += floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
};
var encode = function(input) {
  const output = [];
  input = ucs2decode(input);
  const inputLength = input.length;
  let n = initialN;
  let delta = 0;
  let bias = initialBias;
  for (const currentValue of input) {
    if (currentValue < 128) {
      output.push(stringFromCharCode(currentValue));
    }
  }
  const basicLength = output.length;
  let handledCPCount = basicLength;
  if (basicLength) {
    output.push(delimiter);
  }
  while (handledCPCount < inputLength) {
    let m = maxInt;
    for (const currentValue of input) {
      if (currentValue >= n && currentValue < m) {
        m = currentValue;
      }
    }
    const handledCPCountPlusOne = handledCPCount + 1;
    if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
      error("overflow");
    }
    delta += (m - n) * handledCPCountPlusOne;
    n = m;
    for (const currentValue of input) {
      if (currentValue < n && ++delta > maxInt) {
        error("overflow");
      }
      if (currentValue === n) {
        let q = delta;
        for (let k = base; ; k += base) {
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (q < t) {
            break;
          }
          const qMinusT = q - t;
          const baseMinusT = base - t;
          output.push(
            stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
          );
          q = floor(qMinusT / baseMinusT);
        }
        output.push(stringFromCharCode(digitToBasic(q, 0)));
        bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
        delta = 0;
        ++handledCPCount;
      }
    }
    ++delta;
    ++n;
  }
  return output.join("");
};
var toUnicode = function(input) {
  return mapDomain(input, function(string) {
    return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
  });
};
var toASCII = function(input) {
  return mapDomain(input, function(string) {
    return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
  });
};
var punycode = {
  /**
   * A string representing the current Punycode.js version number.
   * @memberOf punycode
   * @type String
   */
  "version": "2.3.1",
  /**
   * An object of methods to convert from JavaScript's internal character
   * representation (UCS-2) to Unicode code points, and back.
   * @see <https://mathiasbynens.be/notes/javascript-encoding>
   * @memberOf punycode
   * @type Object
   */
  "ucs2": {
    "decode": ucs2decode,
    "encode": ucs2encode
  },
  "decode": decode,
  "encode": encode,
  "toASCII": toASCII,
  "toUnicode": toUnicode
};
var punycode_es6_default = punycode;

// src/signals/domain-signals.ts
var KNOWN_PROTOCOL_DOMAINS = [
  "uniswap.org",
  "opensea.io",
  "blur.io",
  "aave.com",
  "compound.finance",
  "lido.fi",
  "metamask.io",
  "phantom.app",
  "trustwallet.com",
  "rainbow.me",
  "coinbase.com"
];
var SUSPICIOUS_TLDS = /* @__PURE__ */ new Set([
  "xyz",
  "site",
  "click",
  "top",
  "buzz",
  "tk",
  "ml",
  "ga",
  "cf",
  "gq"
]);
var MINT_KEYWORDS = [
  "mint",
  "claim",
  "airdrop",
  "reward",
  "free-nft",
  "giveaway",
  "freemint"
];
var WALLET_CONNECT_PATTERNS = [
  "walletconnect",
  "wc?uri=",
  "wc=",
  "wallet-connect",
  "connect-wallet"
];
var CONFUSABLE_MAP = /* @__PURE__ */ new Map([
  // Cyrillic
  ["\u0430", "a"],
  // а → a
  ["\u0435", "e"],
  // е → e
  ["\u043E", "o"],
  // о → o
  ["\u0440", "p"],
  // р → p
  ["\u0441", "c"],
  // с → c
  ["\u0443", "y"],
  // у → y
  ["\u0445", "x"],
  // х → x
  ["\u043A", "k"],
  // к → k
  ["\u041C", "M"],
  // М → M
  ["\u0422", "T"],
  // Т → T
  ["\u041D", "H"],
  // Н → H
  ["\u0412", "B"],
  // В → B
  ["\u0410", "A"],
  // А → A
  ["\u0421", "C"],
  // С → C
  ["\u0415", "E"],
  // Е → E
  ["\u041E", "O"],
  // О → O
  ["\u0456", "i"],
  // і → i
  ["\u0458", "j"],
  // ј → j
  ["\u04CF", "l"],
  // ӏ → l
  // Greek
  ["\u03B1", "a"],
  // α → a
  ["\u03BF", "o"],
  // ο → o
  ["\u03B5", "e"],
  // ε → e
  ["\u03C1", "p"],
  // ρ → p
  ["\u03C4", "t"],
  // τ → t
  ["\u03C5", "u"],
  // υ → u
  ["\u03C7", "x"],
  // χ → x
  // Latin look-alikes / compatibility
  ["\u0131", "i"],
  // ı (dotless i) → i
  ["\u1D00", "A"],
  // ᴀ → A
  ["\u0250", "a"],
  // ɐ → a
  ["\u0261", "g"],
  // ɡ → g
  ["\xDF", "ss"],
  // ß → ss
  ["\u0153", "oe"]
  // œ → oe
]);
function normalizeHostname(hostname) {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}
function toAsciiHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return "";
  try {
    return punycode_es6_default.toASCII(normalized);
  } catch {
    return normalized;
  }
}
function toUnicodeHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return "";
  try {
    return punycode_es6_default.toUnicode(normalized);
  } catch {
    return normalized;
  }
}
function uniqueNonEmpty(values) {
  const seen = /* @__PURE__ */ new Set();
  for (const value of values) {
    if (!value) continue;
    seen.add(value);
  }
  return [...seen];
}
function protocolBaseLabel(protocolDomain) {
  return protocolDomain.split(".")[0] ?? protocolDomain;
}
function registrableBaseLabel(registrableDomain) {
  return registrableDomain.split(".")[0] ?? registrableDomain;
}
function isPunycodeHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  return normalized.split(".").some((label) => label.startsWith("xn--"));
}
function getDomainSignals(rawUrl) {
  const extractedHostname = normalizeHostname(extractHostname(rawUrl));
  if (!extractedHostname) {
    return {
      hostname: "",
      asciiHostname: "",
      unicodeHostname: "",
      skeletonHostname: "",
      registrableDomain: "",
      unicodeRegistrableDomain: "",
      skeletonRegistrableDomain: "",
      tld: "",
      isPunycode: false
    };
  }
  const asciiHostname = toAsciiHostname(extractedHostname);
  const unicodeHostname = toUnicodeHostname(asciiHostname);
  const skeletonHostname = deconfuseHostname(unicodeHostname).toLowerCase();
  return {
    hostname: extractedHostname,
    asciiHostname,
    unicodeHostname,
    skeletonHostname,
    registrableDomain: extractRegistrableDomain(asciiHostname),
    unicodeRegistrableDomain: extractRegistrableDomain(unicodeHostname),
    skeletonRegistrableDomain: extractRegistrableDomain(skeletonHostname),
    tld: extractTld(asciiHostname),
    isPunycode: isPunycodeHostname(asciiHostname)
  };
}
function isNewDomain(ageHours, thresholdHours = 72) {
  if (ageHours === null) return false;
  return ageHours >= 0 && ageHours < thresholdHours;
}
function looksLikeProtocolImpersonation(rawUrl) {
  const signals = getDomainSignals(rawUrl);
  if (!signals.registrableDomain) return null;
  if (KNOWN_PROTOCOL_DOMAINS.includes(signals.registrableDomain)) {
    return null;
  }
  const registrableCandidates = uniqueNonEmpty([
    signals.registrableDomain,
    signals.unicodeRegistrableDomain,
    signals.skeletonRegistrableDomain
  ]);
  let bestTarget = "";
  let bestScore = 0;
  for (const protocol of KNOWN_PROTOCOL_DOMAINS) {
    for (const candidate of registrableCandidates) {
      const score = stringSimilarity(candidate, protocol);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = protocol;
      }
    }
  }
  if (bestScore >= 0.8 && bestTarget) {
    return { target: bestTarget, similarityScore: bestScore };
  }
  const baseLabelCandidates = uniqueNonEmpty(
    registrableCandidates.map(registrableBaseLabel)
  );
  for (const protocol of KNOWN_PROTOCOL_DOMAINS) {
    const protocolBase = protocolBaseLabel(protocol);
    for (const candidate of baseLabelCandidates) {
      if (candidate.includes(protocolBase) && candidate !== protocolBase) {
        return { target: protocol, similarityScore: 0.8 };
      }
    }
  }
  return null;
}
function containsMintKeyword(rawUrl) {
  const lower = rawUrl.toLowerCase();
  return MINT_KEYWORDS.some((kw) => lower.includes(kw));
}
function containsAirdropKeyword(rawUrl) {
  const lower = rawUrl.toLowerCase();
  return lower.includes("airdrop");
}
function isKnownMaliciousDomain(isKnownMalicious) {
  return isKnownMalicious;
}
function domainSimilarityScore(rawUrl) {
  const signals = getDomainSignals(rawUrl);
  if (!signals.registrableDomain) return 0;
  const registrableCandidates = uniqueNonEmpty([
    signals.registrableDomain,
    signals.unicodeRegistrableDomain,
    signals.skeletonRegistrableDomain
  ]);
  let best = 0;
  for (const protocol of KNOWN_PROTOCOL_DOMAINS) {
    for (const candidate of registrableCandidates) {
      const score = stringSimilarity(candidate, protocol);
      if (score > best) {
        best = score;
      }
    }
  }
  return best;
}
function hasSuspiciousTld(rawUrl) {
  const signals = getDomainSignals(rawUrl);
  if (!signals.tld) return false;
  return SUSPICIOUS_TLDS.has(signals.tld);
}
function matchedLureKeywords(rawUrl) {
  const lower = rawUrl.toLowerCase();
  return MINT_KEYWORDS.filter((kw) => lower.includes(kw));
}
function isIpHost(rawUrl) {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (hostname.startsWith("[") || hostname.includes(":")) return true;
  return false;
}
function containsWalletConnectPattern(rawUrl) {
  const lower = rawUrl.toLowerCase();
  return WALLET_CONNECT_PATTERNS.some((p) => lower.includes(p));
}
function hasHomoglyphs(rawUrl) {
  const signals = getDomainSignals(rawUrl);
  if (!signals.unicodeHostname) return false;
  for (const char of signals.unicodeHostname) {
    if (CONFUSABLE_MAP.has(char)) return true;
  }
  return false;
}
function deconfuseHostname(hostname) {
  let result = "";
  for (const char of hostname.normalize("NFKC")) {
    const replacement = CONFUSABLE_MAP.get(char);
    result += replacement ?? char;
  }
  return result;
}
var PROTECTED_BRAND_TOKENS = [
  "uniswap",
  "opensea",
  "metamask",
  "coinbase",
  "binance",
  "blur",
  "aave",
  "lido",
  "trustwallet",
  "phantom",
  "rainbow"
];
function getSubdomainBrandImpersonationSignal(hostname, registrableDomain) {
  const normalizedHostname = hostname.trim().toLowerCase();
  const normalizedRegistrableDomain = registrableDomain.trim().toLowerCase();
  if (!normalizedHostname || !normalizedRegistrableDomain) {
    return null;
  }
  if (normalizedHostname === normalizedRegistrableDomain) {
    return null;
  }
  const hostnameLabels = normalizedHostname.split(".").filter(Boolean);
  const registrableLabels = normalizedRegistrableDomain.split(".").filter(Boolean);
  if (hostnameLabels.length <= registrableLabels.length) {
    return null;
  }
  const suffix = hostnameLabels.slice(-registrableLabels.length).join(".");
  if (suffix !== normalizedRegistrableDomain) {
    return null;
  }
  const subdomainLabels = hostnameLabels.slice(0, hostnameLabels.length - registrableLabels.length);
  if (subdomainLabels.length === 0) {
    return null;
  }
  const registrableRootLabel = registrableLabels[0] ?? "";
  for (const subdomainLabel of subdomainLabels) {
    const normalizedLabel = subdomainLabel.toLowerCase();
    for (const matchedBrand of PROTECTED_BRAND_TOKENS) {
      if (!normalizedLabel.includes(matchedBrand)) {
        continue;
      }
      if (registrableRootLabel === matchedBrand) {
        continue;
      }
      return {
        hostname: normalizedHostname,
        matchedBrand,
        subdomainLabel: normalizedLabel,
        registrableDomain: normalizedRegistrableDomain
      };
    }
  }
  return null;
}

// src/signals/domainRiskScore.ts
var CRYPTO_BRAND_KEYWORDS = [
  "metamask",
  "walletconnect",
  "coinbase",
  "uniswap",
  "opensea",
  "ledger",
  "phantom"
];
var PHISHING_KEYWORDS = [
  "login",
  "verify",
  "secure",
  "auth",
  "recovery",
  "support",
  "update"
];
var SUSPICIOUS_TLDS2 = [
  ".xyz",
  ".top",
  ".live",
  ".site",
  ".click",
  ".link"
];
function extractDomainTokens(domain) {
  return domain.toLowerCase().split(/[.\-_]/g).filter(Boolean);
}
function calculateDomainRiskScore(domain, domainAgeHours, redirectCount) {
  const signals = [];
  let score = 0;
  const normalized = domain.toLowerCase();
  const domainTokens = extractDomainTokens(normalized);
  if (domainAgeHours !== null && domainAgeHours < 24) {
    score += 40;
    signals.push("NEW_DOMAIN_24H");
  } else if (domainAgeHours !== null && domainAgeHours < 168) {
    score += 20;
    signals.push("NEW_DOMAIN_7D");
  }
  if (CRYPTO_BRAND_KEYWORDS.some((k) => domainTokens.includes(k))) {
    score += 35;
    signals.push("CRYPTO_BRAND_KEYWORD");
  }
  if (PHISHING_KEYWORDS.some((k) => domainTokens.includes(k))) {
    score += 25;
    signals.push("PHISHING_KEYWORD");
  }
  const parts = normalized.split(".").filter(Boolean);
  const tld = parts.length > 0 ? parts[parts.length - 1] : "";
  if (tld && SUSPICIOUS_TLDS2.includes(`.${tld}`)) {
    score += 15;
    signals.push("SUSPICIOUS_TLD");
  }
  if (redirectCount > 1) {
    score += 20;
    signals.push("REDIRECT_CHAIN");
  }
  return {
    score,
    signals
  };
}

// src/policies/phishing/domainRiskRule.ts
var BLOCK_THRESHOLD = 80;
var WARN_THRESHOLD = 50;
function evaluateDomainRiskRule(ctx) {
  const result = calculateDomainRiskScore(
    ctx.domain,
    ctx.domainAgeHours,
    ctx.redirectCount
  );
  let severity = "ALLOW";
  if (result.score >= BLOCK_THRESHOLD) {
    severity = "BLOCK";
  } else if (result.score >= WARN_THRESHOLD) {
    severity = "WARN";
  }
  return {
    ruleId: "PHISH_DOMAIN_RISK_SCORE",
    severity,
    evidence: {
      score: result.score,
      signals: result.signals
    }
  };
}

// src/signals/brandLureSignals.ts
var TARGET_BRANDS = [
  "uniswap",
  "opensea",
  "metamask",
  "coinbase",
  "binance",
  "blur",
  "aave",
  "lido",
  "trustwallet",
  "phantom",
  "rainbow"
];
var LURE_KEYWORDS = [
  "login",
  "verify",
  "secure",
  "auth",
  "wallet",
  "connect",
  "claim",
  "airdrop",
  "recovery",
  "support",
  "update"
];
function normalizeHostname2(hostname) {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}
function extractHostname2(input) {
  try {
    const parsed = new URL(input.rawUrl);
    return punycode_es6_default.toUnicode(parsed.hostname);
  } catch {
    return "";
  }
}
function getBrandLureSignals(input) {
  const hostname = extractHostname2(input);
  const normalized = normalizeHostname2(hostname);
  const tokens = normalized.split(/[.\-]/).filter(Boolean);
  let matchedBrand = null;
  for (const brand of TARGET_BRANDS) {
    if (tokens.includes(brand)) {
      matchedBrand = brand;
      break;
    }
  }
  let matchedLure = null;
  for (const lure of LURE_KEYWORDS) {
    if (tokens.includes(lure)) {
      matchedLure = lure;
      break;
    }
  }
  return {
    hostname,
    normalized,
    tokens,
    matchedBrand,
    matchedLure,
    hasBrandLure: matchedBrand !== null && matchedLure !== null
  };
}

// src/policies/phishing/brandLureRules.ts
var PHISH_BRAND_LURE = {
  id: "PHISH_BRAND_LURE",
  name: "Brand and lure token combination on hostname",
  eventKind: "navigation",
  severity: "high",
  outcome: "block",
  priority: 60,
  predicate(input) {
    const signals = getBrandLureSignals(input);
    return signals.hasBrandLure;
  },
  buildReasonCodes() {
    return ["PHISH_BRAND_LURE"];
  },
  buildEvidence(input) {
    const signals = getBrandLureSignals(input);
    if (!signals.hasBrandLure) {
      return {};
    }
    return {
      hostname: signals.hostname,
      matchedBrand: signals.matchedBrand,
      matchedLure: signals.matchedLure
    };
  }
};

// src/utils/domainSimilarity.ts
var PROTECTED_CRYPTO_BRANDS = [
  "metamask",
  "walletconnect",
  "coinbase",
  "uniswap",
  "opensea",
  "ledger",
  "phantom"
];
var PHISHING_KEYWORDS2 = [
  "login",
  "verify",
  "secure",
  "wallet",
  "connect",
  "airdrop",
  "support"
];
var MULTI_PART_PUBLIC_SUFFIXES = /* @__PURE__ */ new Set([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "com.br",
  "com.mx",
  "co.jp",
  "co.kr",
  "co.in",
  "com.sg"
]);
var DOMAIN_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
var IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
var ALLOWED_DOMAIN_CHARS_RE = /[^a-z0-9.-]/g;
var HYPHEN_SPLIT_RE = /[-_.]+/g;
function normalizeDomain(input) {
  const trimmed = (input ?? "").trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  const withoutProtocol = trimmed.replace(DOMAIN_PROTOCOL_RE, "");
  const withoutPath = withoutProtocol.split("/")[0];
  const withoutAuth = withoutPath.includes("@") ? withoutPath.slice(withoutPath.lastIndexOf("@") + 1) : withoutPath;
  const withoutPort = withoutAuth.split(":")[0];
  const cleaned = withoutPort.replace(ALLOWED_DOMAIN_CHARS_RE, "");
  return cleaned.replace(/^\.+|\.+$/g, "");
}
function getRegistrableDomain(normalizedDomain) {
  if (!normalizedDomain) {
    return "";
  }
  if (IPV4_RE.test(normalizedDomain)) {
    return normalizedDomain;
  }
  const labels = normalizedDomain.split(".").filter(Boolean);
  if (labels.length <= 2) {
    return labels.join(".");
  }
  const lastTwo = labels.slice(-2).join(".");
  const lastThree = labels.slice(-3).join(".");
  if (MULTI_PART_PUBLIC_SUFFIXES.has(lastTwo)) {
    return lastThree;
  }
  return labels.slice(-2).join(".");
}
function getBaseDomain(registrableDomain) {
  if (!registrableDomain) {
    return "";
  }
  if (IPV4_RE.test(registrableDomain)) {
    return registrableDomain;
  }
  const firstDotIndex = registrableDomain.indexOf(".");
  return firstDotIndex === -1 ? registrableDomain : registrableDomain.slice(0, firstDotIndex);
}
function analyzeDomain(input) {
  const normalizedDomain = normalizeDomain(input);
  const registrableDomain = getRegistrableDomain(normalizedDomain);
  const baseDomain = getBaseDomain(registrableDomain);
  return {
    originalDomain: input,
    normalizedDomain,
    registrableDomain,
    baseDomain,
    labels: baseDomain ? baseDomain.split(HYPHEN_SPLIT_RE).filter(Boolean) : []
  };
}
function levenshteinDistance2(a, b) {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }
  return prev[b.length];
}
function findExactBrandSubstring(analysis) {
  for (const brand of PROTECTED_CRYPTO_BRANDS) {
    if (analysis.baseDomain.includes(brand)) {
      return {
        brand,
        target: analysis.baseDomain,
        distance: 0,
        matchedBy: "EXACT_SUBSTRING"
      };
    }
  }
  return null;
}
function findLevenshteinLookalike(analysis) {
  let bestMatch = null;
  const candidates = /* @__PURE__ */ new Set([analysis.baseDomain, ...analysis.labels]);
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    for (const brand of PROTECTED_CRYPTO_BRANDS) {
      const distance = levenshteinDistance2(candidate, brand);
      if (distance <= 2) {
        if (!bestMatch || distance < bestMatch.distance || distance === bestMatch.distance && brand.length > bestMatch.brand.length) {
          bestMatch = {
            brand,
            target: candidate,
            distance,
            matchedBy: "LEVENSHTEIN"
          };
        }
      }
    }
  }
  return bestMatch;
}
function detectLookalikeBrand(input) {
  const analysis = analyzeDomain(input);
  if (!analysis.baseDomain) {
    return null;
  }
  const exactSubstringMatch = findExactBrandSubstring(analysis);
  if (exactSubstringMatch) {
    return exactSubstringMatch;
  }
  return findLevenshteinLookalike(analysis);
}
function detectPhishingKeywords(input) {
  const analysis = analyzeDomain(input);
  const hits = [];
  if (!analysis.baseDomain) {
    return hits;
  }
  let keywordSource = analysis.baseDomain;
  for (const brand of PROTECTED_CRYPTO_BRANDS) {
    keywordSource = keywordSource.split(brand).join("");
  }
  for (const keyword of PHISHING_KEYWORDS2) {
    if (keywordSource.includes(keyword)) {
      hits.push(keyword);
    }
  }
  return hits;
}
function detectLookalikeDomain(input) {
  const analysis = analyzeDomain(input);
  const brandMatch = detectLookalikeBrand(input);
  const phishingKeywordMatches = detectPhishingKeywords(input);
  return {
    analysis,
    brandMatch,
    phishingKeywordMatches
  };
}

// src/policies/phishing/lookalikeRules.ts
var PHISH_LOOKALIKE_BRAND_DOMAIN = "PHISH_LOOKALIKE_BRAND_DOMAIN";
var PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD = "PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD";
function extractDomainFromContext(context) {
  const directCandidates = [
    context.domain,
    context.hostname,
    context.host,
    context.url
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  const nestedCandidates = [
    context.request,
    context.resource,
    context.event
  ];
  for (const container of nestedCandidates) {
    if (!container) {
      continue;
    }
    const values = [
      container.domain,
      container.hostname,
      container.host,
      container.url
    ];
    for (const candidate of values) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
  }
  return "";
}
function buildEvidence(detection) {
  return {
    domain: detection.analysis.originalDomain,
    normalizedDomain: detection.analysis.normalizedDomain,
    registrableDomain: detection.analysis.registrableDomain,
    baseDomain: detection.analysis.baseDomain,
    protectedBrand: detection.brandMatch?.brand ?? null,
    matchedTarget: detection.brandMatch?.target ?? null,
    similarityMethod: detection.brandMatch?.matchedBy ?? null,
    levenshteinDistance: detection.brandMatch?.matchedBy === "LEVENSHTEIN" ? detection.brandMatch.distance : null,
    phishingKeywords: detection.phishingKeywordMatches
  };
}
function evaluateLookalikeBrandDomain(context) {
  const domain = extractDomainFromContext(context);
  const detection = detectLookalikeDomain(domain);
  const matched = Boolean(detection.brandMatch) && detection.phishingKeywordMatches.length === 0;
  return {
    ruleId: PHISH_LOOKALIKE_BRAND_DOMAIN,
    severity: "WARN",
    matched,
    evidence: buildEvidence(detection)
  };
}
function evaluateLookalikeBrandWithPhishingKeyword(context) {
  const domain = extractDomainFromContext(context);
  const detection = detectLookalikeDomain(domain);
  const matched = Boolean(detection.brandMatch) && detection.phishingKeywordMatches.length > 0;
  return {
    ruleId: PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD,
    severity: "BLOCK",
    matched,
    evidence: buildEvidence(detection)
  };
}
var lookalikeRules = [
  {
    ruleId: PHISH_LOOKALIKE_BRAND_DOMAIN,
    evaluate: evaluateLookalikeBrandDomain
  },
  {
    ruleId: PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD,
    evaluate: evaluateLookalikeBrandWithPhishingKeyword
  }
];

// src/policies/phishing/codes.ts
var PHISHING_CODES = {
  PHISH_IMPERSONATION_NEW_DOMAIN: "PHISH_IMPERSONATION_NEW_DOMAIN",
  PHISH_SUSPICIOUS_TLD_MINT_KEYWORD: "PHISH_SUSPICIOUS_TLD_MINT_KEYWORD",
  PHISH_KNOWN_MALICIOUS_DOMAIN: "PHISH_KNOWN_MALICIOUS_DOMAIN",
  DOMAIN_IMPERSONATION: "DOMAIN_IMPERSONATION",
  NEW_DOMAIN: "NEW_DOMAIN",
  WALLET_CONNECT_PATTERN: "WALLET_CONNECT_PATTERN",
  SUSPICIOUS_TLD: "SUSPICIOUS_TLD",
  MINT_KEYWORD: "MINT_KEYWORD",
  KNOWN_MALICIOUS: "KNOWN_MALICIOUS",
  DIRECT_IP_ACCESS: "DIRECT_IP_ACCESS",
  NEW_DOMAIN_WALLET_CONNECT: "NEW_DOMAIN_WALLET_CONNECT",
  HOMOGLYPH_ATTACK: "HOMOGLYPH_ATTACK",
  SUSPICIOUS_REDIRECT_CHAIN: "SUSPICIOUS_REDIRECT_CHAIN"
};

// src/utils/punycodeDetection.ts
var PROTECTED_CRYPTO_BRANDS2 = [
  "metamask",
  "walletconnect",
  "coinbase",
  "uniswap",
  "opensea",
  "ledger",
  "phantom"
];
var CONFUSABLE_TO_ASCII = {
  // Cyrillic
  \u0430: "a",
  \u0435: "e",
  \u043E: "o",
  \u0440: "p",
  \u0441: "c",
  \u0443: "y",
  \u0445: "x",
  \u0456: "i",
  \u0457: "i",
  \u0458: "j",
  \u04A1: "k",
  \u04BB: "h",
  \u0475: "v",
  \u0461: "w",
  \u0473: "o",
  \u0455: "s",
  "\u04CF": "l",
  // Greek
  \u03B1: "a",
  \u03B2: "b",
  \u03B3: "y",
  \u03B4: "d",
  \u03B5: "e",
  \u03B7: "n",
  \u03B9: "i",
  \u03BA: "k",
  \u03BF: "o",
  \u03C1: "p",
  \u03C4: "t",
  \u03C5: "u",
  \u03C7: "x",
  \u03C9: "w",
  // Latin extended / IPA / compatibility
  \u00E6: "ae",
  \u0153: "oe",
  \u00DF: "ss",
  \u00FE: "p",
  \u00F0: "d",
  \u0142: "l",
  \u026B: "l",
  \u0269: "i",
  \u026A: "i",
  \u029F: "l",
  \u00F8: "o",
  // Fullwidth ASCII
  \uFF41: "a",
  \uFF42: "b",
  \uFF43: "c",
  \uFF44: "d",
  \uFF45: "e",
  \uFF46: "f",
  \uFF47: "g",
  \uFF48: "h",
  \uFF49: "i",
  \uFF4A: "j",
  \uFF4B: "k",
  \uFF4C: "l",
  \uFF4D: "m",
  \uFF4E: "n",
  \uFF4F: "o",
  \uFF50: "p",
  \uFF51: "q",
  \uFF52: "r",
  \uFF53: "s",
  \uFF54: "t",
  \uFF55: "u",
  \uFF56: "v",
  \uFF57: "w",
  \uFF58: "x",
  \uFF59: "y",
  \uFF5A: "z"
};
function stripTrailingDot(domain) {
  return domain.trim().replace(/\.+$/, "");
}
function extractAsciiPayloadFromPunycodeLabel(label) {
  return label.toLowerCase().startsWith("xn--") ? label.slice(4) : label;
}
function normalizeForBrandComparison(value) {
  const lower = value.toLowerCase().normalize("NFKC");
  let output = "";
  for (const char of lower) {
    output += CONFUSABLE_TO_ASCII[char] ?? char;
  }
  return output.replace(/[^a-z0-9.-]+/g, "");
}
function tokenizeCandidate(value) {
  return value.split(/[^a-z0-9]+/g).map((token) => token.trim()).filter(Boolean);
}
function levenshteinDistance3(a, b) {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }
  const previous = new Array(b.length + 1);
  const current = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) {
    previous[j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }
  return previous[b.length];
}
function matchesProtectedBrand(candidate, brand) {
  if (!candidate) {
    return false;
  }
  if (candidate === brand) {
    return true;
  }
  if (candidate.includes(brand)) {
    return true;
  }
  if (candidate.length >= brand.length - 1 && levenshteinDistance3(candidate, brand) <= 1) {
    return true;
  }
  return false;
}
function detectPunycodeDomain(domain) {
  const normalized = stripTrailingDot(domain).toLowerCase();
  if (!normalized) {
    return false;
  }
  return normalized.split(".").some((label) => label.startsWith("xn--"));
}
function decodePunycode(domain) {
  try {
    return punycode_es6_default.toUnicode(stripTrailingDot(domain).toLowerCase());
  } catch {
    return stripTrailingDot(domain).toLowerCase();
  }
}
function isHomographBrandAttack(decodedDomain, originalDomain) {
  const normalizedDecoded = normalizeForBrandComparison(decodedDomain);
  const decodedLabels = normalizedDecoded.split(".");
  const decodedCandidates = /* @__PURE__ */ new Set([
    normalizedDecoded,
    ...decodedLabels,
    ...tokenizeCandidate(normalizedDecoded)
  ]);
  if (originalDomain) {
    const normalizedOriginal = stripTrailingDot(originalDomain).toLowerCase();
    for (const label of normalizedOriginal.split(".")) {
      const asciiPayload = normalizeForBrandComparison(
        extractAsciiPayloadFromPunycodeLabel(label)
      );
      if (!asciiPayload) {
        continue;
      }
      decodedCandidates.add(asciiPayload);
      for (const token of tokenizeCandidate(asciiPayload)) {
        decodedCandidates.add(token);
      }
    }
  }
  for (const brand of PROTECTED_CRYPTO_BRANDS2) {
    for (const candidate of decodedCandidates) {
      if (matchesProtectedBrand(candidate, brand)) {
        return brand;
      }
    }
  }
  return null;
}

// src/policies/phishing/punycodeRules.ts
function extractDomainFromRawUrl(rawUrl) {
  const trimmed = rawUrl.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const withoutPath = withoutProtocol.split("/")[0] ?? "";
  const withoutAuth = withoutPath.includes("@") ? withoutPath.slice(withoutPath.lastIndexOf("@") + 1) : withoutPath;
  const withoutPort = withoutAuth.startsWith("[") ? withoutAuth.replace(/^\[|\]$/g, "") : withoutAuth.split(":")[0] ?? "";
  return withoutPort.replace(/\.+$/, "");
}
function extractBrandFromTarget(target) {
  return target.split(".")[0] ?? target;
}
function detectMatchedBrand(originalDomain, decodedDomain) {
  const directMatch = isHomographBrandAttack(decodedDomain, originalDomain);
  if (directMatch) {
    return directMatch;
  }
  const lookalikeOriginal = detectLookalikeBrand(originalDomain);
  if (lookalikeOriginal) {
    return lookalikeOriginal.brand;
  }
  const lookalikeDecoded = detectLookalikeBrand(decodedDomain);
  if (lookalikeDecoded) {
    return lookalikeDecoded.brand;
  }
  const impersonationOriginal = looksLikeProtocolImpersonation(
    `https://${originalDomain}`
  );
  if (impersonationOriginal) {
    return extractBrandFromTarget(impersonationOriginal.target);
  }
  const impersonationDecoded = looksLikeProtocolImpersonation(
    `https://${decodedDomain}`
  );
  if (impersonationDecoded) {
    return extractBrandFromTarget(impersonationDecoded.target);
  }
  return null;
}
var PHISH_PUNYCODE_HOMOGRAPH_BRAND = {
  id: "PHISH_PUNYCODE_HOMOGRAPH_BRAND",
  severity: "BLOCK",
  description: "Detects punycode homograph phishing domains impersonating protected crypto brands.",
  match(input) {
    const fallbackDomain = typeof input.rawUrl === "string" ? extractDomainFromRawUrl(input.rawUrl) : "";
    const domainFromInput = typeof input.domain === "string" ? input.domain.trim().toLowerCase() : "";
    const originalDomain = domainFromInput || fallbackDomain;
    if (!originalDomain) {
      return null;
    }
    if (!detectPunycodeDomain(originalDomain)) {
      return null;
    }
    const decodedDomain = decodePunycode(originalDomain);
    const matchedBrand = detectMatchedBrand(originalDomain, decodedDomain);
    if (!matchedBrand) {
      return null;
    }
    return {
      ruleId: "PHISH_PUNYCODE_HOMOGRAPH_BRAND",
      severity: "BLOCK",
      evidence: {
        originalDomain,
        decodedDomain,
        matchedBrand
      }
    };
  }
};
var punycodeRules = [PHISH_PUNYCODE_HOMOGRAPH_BRAND];

// src/signals/redirectChainSignals.ts
var MAX_CHAIN_LENGTH = 4;
var ALLOWED_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:"]);
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function readRedirectChain(input) {
  const value = input.redirectChain;
  return isStringArray(value) ? value : null;
}
function readUrl(input) {
  const value = input.url;
  return typeof value === "string" ? value : null;
}
function resolveRawChain(input) {
  const redirectChain = readRedirectChain(input);
  if (redirectChain !== null) {
    return redirectChain;
  }
  const url = readUrl(input);
  if (url !== null) {
    return [url];
  }
  return [input.rawUrl];
}
function isIpAddress(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return false;
    }
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      return false;
    }
  }
  return true;
}
function safeParseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
function getRedirectChainSignals(input) {
  const rawChain = resolveRawChain(input);
  const chain = [];
  let hasInvalidUrl = false;
  let hasIpHost = false;
  let hasSuspiciousProtocol = false;
  for (const raw of rawChain) {
    const parsed = safeParseUrl(raw);
    if (parsed === null) {
      hasInvalidUrl = true;
      chain.push({
        url: raw,
        hostname: "__INVALID__"
      });
      continue;
    }
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      hasSuspiciousProtocol = true;
    }
    if (isIpAddress(parsed.hostname)) {
      hasIpHost = true;
    }
    chain.push({
      url: parsed.href,
      hostname: parsed.hostname
    });
  }
  const length = chain.length;
  return {
    chain,
    length,
    hasRedirects: length > 1,
    hasIpHost,
    isLongChain: length >= MAX_CHAIN_LENGTH,
    hasInvalidUrl,
    hasSuspiciousProtocol
  };
}

// src/policies/phishing/redirectChainRules.ts
var PHISH_REDIRECT_CHAIN_ABUSE = {
  id: "PHISH_REDIRECT_CHAIN_ABUSE",
  name: "Suspicious redirect chain abuse",
  eventKind: "navigation",
  priority: 80,
  severity: "high",
  outcome: "block",
  predicate(input) {
    const signals = getRedirectChainSignals(input);
    if (signals.hasInvalidUrl) return true;
    if (signals.hasSuspiciousProtocol) return true;
    if (signals.hasIpHost && signals.hasRedirects) return true;
    if (signals.isLongChain) return true;
    return false;
  },
  buildReasonCodes() {
    return ["PHISH_REDIRECT_CHAIN_ABUSE"];
  }
};

// src/signals/unicodeConfusableSignals.ts
var CONFUSABLE_MAP2 = /* @__PURE__ */ new Map([
  ["\u0430", "a"],
  ["\u0435", "e"],
  ["\u043E", "o"],
  ["\u0440", "p"],
  ["\u0441", "c"],
  ["\u0443", "y"],
  ["\u0445", "x"],
  ["\u043A", "k"],
  ["\u041C", "M"],
  ["\u0422", "T"],
  ["\u041D", "H"],
  ["\u0412", "B"],
  ["\u0410", "A"],
  ["\u0421", "C"],
  ["\u0415", "E"],
  ["\u041E", "O"],
  ["\u0456", "i"],
  ["\u0458", "j"],
  ["\u04CF", "l"],
  ["\u03B1", "a"],
  ["\u03BF", "o"],
  ["\u03B5", "e"],
  ["\u03C1", "p"],
  ["\u03C4", "t"],
  ["\u03C5", "u"],
  ["\u03C7", "x"],
  ["\u0131", "i"],
  ["\u1D00", "A"],
  ["\u0250", "a"],
  ["\u0261", "g"],
  ["\xDF", "ss"],
  ["\u0153", "oe"]
]);
var TARGET_BRANDS2 = [
  "uniswap",
  "opensea",
  "metamask",
  "coinbase",
  "binance",
  "blur",
  "aave",
  "lido",
  "trustwallet",
  "phantom",
  "rainbow"
];
function normalizeHostname3(hostname) {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}
function buildSkeleton(hostname) {
  let result = "";
  for (const ch of hostname.normalize("NFKC")) {
    result += CONFUSABLE_MAP2.get(ch) ?? ch;
  }
  return result.toLowerCase();
}
function isLatinChar(ch) {
  const code = ch.charCodeAt(0);
  return code >= 65 && code <= 122 || code >= 192 && code <= 591;
}
function hasMixedScript(hostname) {
  let hasLatin = false;
  let hasNonLatin = false;
  for (const ch of hostname) {
    if (!/[A-Za-z\u00C0-\u024F\u0080-\uFFFF]/.test(ch)) {
      continue;
    }
    if (isLatinChar(ch)) {
      hasLatin = true;
    } else if (ch.charCodeAt(0) > 127) {
      hasNonLatin = true;
    }
    if (hasLatin && hasNonLatin) {
      return true;
    }
  }
  return false;
}
function extractMatchedBrands(skeletonHostname) {
  return TARGET_BRANDS2.filter((brand) => skeletonHostname.includes(brand));
}
function extractUnicodeHostname(input) {
  let hostname = "";
  try {
    const parsed = new URL(input.rawUrl);
    hostname = punycode_es6_default.toUnicode(parsed.hostname);
  } catch {
    return "";
  }
  return normalizeHostname3(hostname);
}
function getUnicodeConfusableSignals(input) {
  const hostname = extractUnicodeHostname(input);
  const normalizedHostname = hostname.toLowerCase();
  const asciiSkeleton = buildSkeleton(hostname);
  const hasConfusable = asciiSkeleton !== normalizedHostname;
  const matchedBrands = extractMatchedBrands(asciiSkeleton);
  return {
    hostname,
    asciiSkeleton,
    normalizedHostname,
    hasConfusable,
    hasMixedScript: hasMixedScript(normalizedHostname),
    matchedBrands
  };
}

// src/policies/phishing/unicodeConfusableRules.ts
var PHISH_UNICODE_CONFUSABLE = {
  id: "PHISH_UNICODE_CONFUSABLE",
  name: "Unicode confusable expansion",
  eventKind: "navigation",
  priority: 75,
  severity: "critical",
  outcome: "block",
  predicate(input) {
    const signals = getUnicodeConfusableSignals(input);
    if (!signals.hasConfusable) return false;
    return signals.hasMixedScript || signals.matchedBrands.length > 0;
  },
  buildReasonCodes() {
    return ["PHISH_UNICODE_CONFUSABLE"];
  }
};

// src/signals/domainEntropySignals.ts
function extractHostname3(input) {
  try {
    const parsed = new URL(input.rawUrl);
    return punycode_es6_default.toUnicode(parsed.hostname).toLowerCase();
  } catch {
    return "";
  }
}
function extractLabel(hostname) {
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return parts[0] ?? "";
}
function calculateDigitRatio(input) {
  if (input.length === 0) return 0;
  let digits = 0;
  for (const ch of input) {
    if (/\d/.test(ch)) {
      digits++;
    }
  }
  return digits / input.length;
}
function calculateConsonantStreak(input) {
  let maxStreak = 0;
  let current = 0;
  for (const ch of input) {
    if (/[bcdfghjklmnpqrstvwxyz]/i.test(ch)) {
      current++;
      if (current > maxStreak) {
        maxStreak = current;
      }
    } else {
      current = 0;
    }
  }
  return maxStreak;
}
function calculateEntropyScore(length, digitRatio, consonantStreak) {
  return length * 0.5 + digitRatio * 10 + consonantStreak * 1.5;
}
function getDomainEntropySignals(input) {
  const hostname = extractHostname3(input);
  const label = extractLabel(hostname);
  const length = label.length;
  const digitRatio = calculateDigitRatio(label);
  const consonantStreak = calculateConsonantStreak(label);
  const entropyScore = calculateEntropyScore(
    length,
    digitRatio,
    consonantStreak
  );
  const isHighEntropy = length >= 12 && (digitRatio >= 0.3 || consonantStreak >= 5 || entropyScore >= 15);
  return {
    hostname,
    label,
    length,
    digitRatio,
    consonantStreak,
    entropyScore,
    isHighEntropy
  };
}

// src/policies/phishing/domainEntropyRules.ts
var PHISH_DOMAIN_HIGH_ENTROPY = {
  id: "PHISH_DOMAIN_HIGH_ENTROPY",
  name: "High entropy domain detection",
  eventKind: "navigation",
  priority: 50,
  severity: "medium",
  outcome: "warn",
  predicate(input) {
    const signals = getDomainEntropySignals(input);
    return signals.isHighEntropy;
  },
  buildReasonCodes() {
    return ["PHISH_DOMAIN_HIGH_ENTROPY"];
  }
};

// src/policies/phishing/rules.ts
var PHISH_IMPERSONATION_NEW_DOMAIN = {
  id: "PHISH_IMPERSONATION_NEW_DOMAIN",
  name: "New domain impersonating known protocol",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 10,
  predicate(ctx) {
    const impersonation = looksLikeProtocolImpersonation(ctx.rawUrl);
    if (!impersonation) return false;
    return isNewDomain(ctx.domainContext.ageHours);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.PHISH_IMPERSONATION_NEW_DOMAIN];
  },
  buildEvidence(ctx) {
    const impersonation = looksLikeProtocolImpersonation(ctx.rawUrl);
    return {
      similarityScore: impersonation?.similarityScore ?? 0,
      target: impersonation?.target ?? "unknown",
      domainAgeHours: ctx.domainContext.ageHours
    };
  }
};
var PHISH_SUSPICIOUS_TLD_MINT_KEYWORD = {
  id: "PHISH_SUSPICIOUS_TLD_MINT_KEYWORD",
  name: "Suspicious TLD with crypto lure keywords",
  eventKind: "navigation",
  severity: "high",
  outcome: "warn",
  priority: 20,
  predicate(ctx) {
    if (!hasSuspiciousTld(ctx.rawUrl)) return false;
    return containsMintKeyword(ctx.rawUrl);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.PHISH_SUSPICIOUS_TLD_MINT_KEYWORD];
  },
  buildEvidence(ctx) {
    const hostname = extractHostname(ctx.rawUrl);
    return {
      tld: extractTld(hostname),
      matchedKeywords: matchedLureKeywords(ctx.rawUrl)
    };
  }
};
var PHISH_KNOWN_MALICIOUS_DOMAIN = {
  id: "PHISH_KNOWN_MALICIOUS_DOMAIN",
  name: "Domain in known-malicious threat feed",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 5,
  predicate(ctx) {
    return isKnownMaliciousDomain(ctx.domainContext.isKnownMalicious);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.PHISH_KNOWN_MALICIOUS_DOMAIN];
  },
  buildEvidence(ctx) {
    return {
      domain: extractHostname(ctx.rawUrl)
    };
  }
};
var PHISH_IP_HOST_URL = {
  id: "PHISH_IP_HOST_URL",
  name: "Direct IP address access",
  eventKind: "navigation",
  severity: "high",
  outcome: "warn",
  priority: 25,
  predicate(ctx) {
    return isIpHost(ctx.rawUrl);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.DIRECT_IP_ACCESS];
  },
  buildEvidence(ctx) {
    return {
      hostname: extractHostname(ctx.rawUrl)
    };
  }
};
var PHISH_NEW_DOMAIN_WALLET_CONNECT = {
  id: "PHISH_NEW_DOMAIN_WALLET_CONNECT",
  name: "New domain with WalletConnect pattern",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 8,
  predicate(ctx) {
    const hasWcPattern = ctx.containsWalletConnectPattern ?? containsWalletConnectPattern(ctx.rawUrl);
    if (!hasWcPattern) return false;
    return isNewDomain(ctx.domainContext.ageHours, 168);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.NEW_DOMAIN_WALLET_CONNECT];
  },
  buildEvidence(ctx) {
    return {
      domainAgeHours: ctx.domainContext.ageHours,
      domain: extractHostname(ctx.rawUrl)
    };
  }
};
var PHISH_HOMOGLYPH_DOMAIN = {
  id: "PHISH_HOMOGLYPH_DOMAIN",
  name: "Homoglyph domain impersonation",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 7,
  predicate(ctx) {
    return ctx.hasHomoglyphs ?? hasHomoglyphs(ctx.rawUrl);
  },
  buildReasonCodes() {
    return [PHISHING_CODES.HOMOGLYPH_ATTACK];
  },
  buildEvidence(ctx) {
    const hostname = extractHostname(ctx.rawUrl);
    return {
      hostname,
      deconfused: deconfuseHostname(hostname)
    };
  }
};
var PHISH_REDIRECT_CHAIN = {
  id: "PHISH_REDIRECT_CHAIN",
  name: "Suspicious redirect chain",
  eventKind: "navigation",
  severity: "medium",
  outcome: "warn",
  priority: 30,
  predicate(ctx) {
    const redirectCount = ctx.redirectCount ?? 0;
    if (redirectCount < 3) return false;
    const finalDomain = ctx.finalDomain;
    if (!finalDomain) return false;
    const originalHostname = extractHostname(ctx.rawUrl);
    const originalRegistrable = extractRegistrableDomain(originalHostname);
    const finalRegistrable = extractRegistrableDomain(finalDomain);
    return originalRegistrable !== finalRegistrable;
  },
  buildReasonCodes() {
    return [PHISHING_CODES.SUSPICIOUS_REDIRECT_CHAIN];
  },
  buildEvidence(ctx) {
    const originalHostname = extractHostname(ctx.rawUrl);
    return {
      originalDomain: extractRegistrableDomain(originalHostname),
      finalDomain: ctx.finalDomain ?? "unknown",
      redirectCount: ctx.redirectCount ?? 0
    };
  }
};
function mapLegacySeverityToRiskLevel(severity) {
  return severity === "BLOCK" ? "critical" : "high";
}
function mapLegacySeverityToOutcome(severity) {
  return severity === "BLOCK" ? "block" : "warn";
}
var LOOKALIKE_RULES = lookalikeRules.map((definition, index) => ({
  id: definition.ruleId,
  name: `Lookalike phishing rule: ${definition.ruleId}`,
  eventKind: "navigation",
  severity: mapLegacySeverityToRiskLevel(
    definition.ruleId === "PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD" ? "BLOCK" : "WARN"
  ),
  outcome: mapLegacySeverityToOutcome(
    definition.ruleId === "PHISH_LOOKALIKE_BRAND_WITH_PHISHING_KEYWORD" ? "BLOCK" : "WARN"
  ),
  priority: 40 + index,
  predicate(ctx) {
    const domain = extractHostname(ctx.rawUrl);
    const result = definition.evaluate({
      domain,
      hostname: domain,
      host: domain,
      url: ctx.rawUrl
    });
    if (!result.matched) {
      return false;
    }
    if (definition.ruleId === "PHISH_LOOKALIKE_BRAND_DOMAIN" && result.evidence.similarityMethod === "EXACT_SUBSTRING") {
      return false;
    }
    return true;
  },
  buildReasonCodes() {
    return [definition.ruleId];
  },
  buildEvidence(ctx) {
    const domain = extractHostname(ctx.rawUrl);
    const result = definition.evaluate({
      domain,
      hostname: domain,
      host: domain,
      url: ctx.rawUrl
    });
    return result.evidence;
  }
}));
var PUNYCODE_RULES = punycodeRules.map((rule, index) => ({
  id: rule.id,
  name: `Punycode phishing rule: ${rule.id}`,
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 6 + index,
  predicate(ctx) {
    const domain = extractHostname(ctx.rawUrl);
    return rule.match({ domain, rawUrl: ctx.rawUrl }) !== null;
  },
  buildReasonCodes() {
    return [rule.id];
  },
  buildEvidence(ctx) {
    const domain = extractHostname(ctx.rawUrl);
    return rule.match({ domain, rawUrl: ctx.rawUrl })?.evidence ?? {};
  }
}));
var PHISH_DOMAIN_RISK_SCORE = {
  id: "PHISH_DOMAIN_RISK_SCORE",
  name: "Domain risk score threshold exceeded",
  eventKind: "navigation",
  severity: "critical",
  outcome: "block",
  priority: 60,
  predicate(ctx) {
    const domain = extractHostname(ctx.rawUrl);
    const result = evaluateDomainRiskRule({
      domain,
      domainAgeHours: ctx.domainContext.ageHours,
      redirectCount: ctx.redirectCount ?? 0
    });
    return result.severity === "BLOCK";
  },
  buildReasonCodes() {
    return ["PHISH_DOMAIN_RISK_SCORE"];
  },
  buildEvidence(ctx) {
    const domain = extractHostname(ctx.rawUrl);
    const result = evaluateDomainRiskRule({
      domain,
      domainAgeHours: ctx.domainContext.ageHours,
      redirectCount: ctx.redirectCount ?? 0
    });
    return result.evidence;
  }
};
var PHISH_SUBDOMAIN_BRAND_IMPERSONATION = {
  id: "PHISH_SUBDOMAIN_BRAND_IMPERSONATION",
  name: "Brand token found in subdomain on non-brand registrable domain",
  eventKind: "navigation",
  priority: 70,
  severity: "high",
  outcome: "block",
  predicate(ctx) {
    const signals = getDomainSignals(ctx.rawUrl);
    const { hostname, registrableDomain } = signals;
    const signal = getSubdomainBrandImpersonationSignal(
      hostname,
      registrableDomain
    );
    return signal !== null;
  },
  buildReasonCodes() {
    return ["PHISH_SUBDOMAIN_BRAND_IMPERSONATION"];
  },
  buildEvidence(ctx) {
    const signals = getDomainSignals(ctx.rawUrl);
    const { hostname, registrableDomain } = signals;
    const signal = getSubdomainBrandImpersonationSignal(
      hostname,
      registrableDomain
    );
    if (!signal) {
      return {};
    }
    return {
      hostname,
      registrableDomain,
      matchedBrand: signal.matchedBrand,
      subdomainLabel: signal.subdomainLabel
    };
  }
};
var PHISHING_RULES = [
  PHISH_KNOWN_MALICIOUS_DOMAIN,
  PHISH_HOMOGLYPH_DOMAIN,
  PHISH_NEW_DOMAIN_WALLET_CONNECT,
  PHISH_IMPERSONATION_NEW_DOMAIN,
  PHISH_SUSPICIOUS_TLD_MINT_KEYWORD,
  PHISH_IP_HOST_URL,
  PHISH_REDIRECT_CHAIN,
  ...LOOKALIKE_RULES,
  ...PUNYCODE_RULES,
  PHISH_DOMAIN_RISK_SCORE,
  PHISH_BRAND_LURE,
  PHISH_SUBDOMAIN_BRAND_IMPERSONATION,
  PHISH_UNICODE_CONFUSABLE,
  PHISH_REDIRECT_CHAIN_ABUSE,
  PHISH_DOMAIN_HIGH_ENTROPY
];

// src/policies/transaction/codes.ts
var TRANSACTION_CODES = {
  UNLIMITED_APPROVAL: "TX_UNLIMITED_APPROVAL",
  UNKNOWN_SPENDER: "TX_UNKNOWN_SPENDER",
  SET_APPROVAL_FOR_ALL: "TX_SET_APPROVAL_FOR_ALL",
  PERMIT_SIGNATURE: "TX_PERMIT_SIGNATURE",
  KNOWN_MALICIOUS_CONTRACT: "TX_KNOWN_MALICIOUS_CONTRACT",
  SCAM_SIGNATURE_MATCH: "TX_SCAM_SIGNATURE_MATCH",
  MULTICALL_APPROVAL_AND_TRANSFER: "TX_MULTICALL_APPROVAL_AND_TRANSFER",
  UNKNOWN_CONTRACT_INTERACTION: "TX_UNKNOWN_CONTRACT_INTERACTION",
  NEW_RECIPIENT: "TX_NEW_RECIPIENT"
};

// src/policies/transaction/rules.ts
function isNonTrustedCounterparty(input) {
  return input.counterparty.spenderTrusted !== true;
}
var BLOCK_MALICIOUS_TRANSACTION_CONTRACT = {
  id: "TX_BLOCK_MALICIOUS_TRANSACTION_CONTRACT",
  name: "Block malicious transaction target",
  eventKind: "transaction",
  severity: "critical",
  outcome: "block",
  priority: 10,
  predicate: (ctx) => ctx.eventKind === "transaction" && ctx.riskClassification.hasMaliciousTarget,
  buildReasonCodes: () => [TRANSACTION_CODES.KNOWN_MALICIOUS_CONTRACT],
  buildEvidence: (ctx) => ({
    maliciousContract: {
      address: ctx.to,
      disposition: ctx.intel.contractDisposition,
      contractFeedVersion: ctx.intel.contractFeedVersion
    }
  })
};
var BLOCK_MALICIOUS_SIGNATURE_CONTRACT = {
  id: "TX_BLOCK_MALICIOUS_SIGNATURE_CONTRACT",
  name: "Block malicious verifying contract",
  eventKind: "signature",
  severity: "critical",
  outcome: "block",
  priority: 10,
  predicate: (ctx) => ctx.eventKind === "signature" && ctx.riskClassification.hasMaliciousTarget,
  buildReasonCodes: (ctx) => {
    const codes = [TRANSACTION_CODES.KNOWN_MALICIOUS_CONTRACT];
    if (ctx.signature.permitKind !== "none") {
      codes.push(TRANSACTION_CODES.PERMIT_SIGNATURE);
    }
    return codes;
  },
  buildEvidence: (ctx) => ({
    maliciousVerifier: {
      address: ctx.signature.verifyingContract,
      disposition: ctx.intel.contractDisposition,
      contractFeedVersion: ctx.intel.contractFeedVersion
    }
  })
};
var BLOCK_SCAM_SIGNATURE_MATCH = {
  id: "TX_BLOCK_SCAM_SIGNATURE_MATCH",
  name: "Block known scam signature intel match",
  eventKind: "signature",
  severity: "critical",
  outcome: "block",
  priority: 5,
  predicate: (ctx) => ctx.eventKind === "signature" && ctx.riskClassification.hasKnownScamSignature,
  buildReasonCodes: (ctx) => {
    const codes = [TRANSACTION_CODES.SCAM_SIGNATURE_MATCH];
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
      verifyingContract: ctx.signature.verifyingContract
    }
  })
};
var WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER = {
  id: "TX_WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER",
  name: "Warn on unlimited approval to non-trusted spender",
  eventKind: "transaction",
  severity: "high",
  outcome: "warn",
  priority: 120,
  predicate: (ctx) => {
    return ctx.eventKind === "transaction" && ctx.riskClassification.isApprovalRisk && ctx.riskClassification.isUnlimitedApprovalRisk && isNonTrustedCounterparty(ctx) && !ctx.signals.targetAllowlisted;
  },
  buildReasonCodes: () => [
    TRANSACTION_CODES.UNLIMITED_APPROVAL,
    TRANSACTION_CODES.UNKNOWN_SPENDER
  ],
  buildEvidence: (ctx) => ({
    approval: {
      spender: ctx.decoded.spender,
      amountKind: ctx.decoded.amountKind,
      spenderTrusted: ctx.counterparty.spenderTrusted
    }
  })
};
var WARN_SET_APPROVAL_FOR_ALL_UNKNOWN_OPERATOR = {
  id: "TX_WARN_SET_APPROVAL_FOR_ALL_UNKNOWN_OPERATOR",
  name: "Warn on full NFT collection approval to non-trusted operator",
  eventKind: "transaction",
  severity: "high",
  outcome: "warn",
  priority: 130,
  predicate: (ctx) => {
    return ctx.eventKind === "transaction" && ctx.riskClassification.isApprovalRisk && ctx.actionType === "setApprovalForAll" && isNonTrustedCounterparty(ctx) && !ctx.signals.targetAllowlisted;
  },
  buildReasonCodes: () => [
    TRANSACTION_CODES.SET_APPROVAL_FOR_ALL,
    TRANSACTION_CODES.UNKNOWN_SPENDER
  ],
  buildEvidence: (ctx) => ({
    approvalForAll: {
      operator: ctx.decoded.operator,
      spenderTrusted: ctx.counterparty.spenderTrusted
    }
  })
};
var WARN_INCREASE_ALLOWANCE_UNKNOWN_SPENDER = {
  id: "TX_WARN_INCREASE_ALLOWANCE_UNKNOWN_SPENDER",
  name: "Warn on increaseAllowance to a non-trusted spender",
  eventKind: "transaction",
  severity: "high",
  outcome: "warn",
  priority: 135,
  predicate: (ctx) => {
    return ctx.eventKind === "transaction" && ctx.actionType === "increaseAllowance" && ctx.riskClassification.isApprovalRisk && !ctx.riskClassification.isUnlimitedApprovalRisk && isNonTrustedCounterparty(ctx) && !ctx.signals.targetAllowlisted;
  },
  buildReasonCodes: () => [TRANSACTION_CODES.UNKNOWN_SPENDER],
  buildEvidence: (ctx) => ({
    increaseAllowance: {
      spender: ctx.decoded.spender,
      amount: ctx.decoded.amount,
      amountKind: ctx.decoded.amountKind,
      spenderTrusted: ctx.counterparty.spenderTrusted
    }
  })
};
var WARN_PERMIT_SIGNATURE_TO_UNTRUSTED_CONTRACT = {
  id: "TX_WARN_PERMIT_SIGNATURE_TO_UNTRUSTED_CONTRACT",
  name: "Warn on permit signature to untrusted verifier",
  eventKind: "signature",
  severity: "high",
  outcome: "warn",
  priority: 140,
  predicate: (ctx) => {
    return ctx.eventKind === "signature" && ctx.riskClassification.isPermitRisk && !ctx.riskClassification.hasKnownScamSignature && !ctx.riskClassification.hasMaliciousTarget && !ctx.signals.targetAllowlisted;
  },
  buildReasonCodes: () => [TRANSACTION_CODES.PERMIT_SIGNATURE],
  buildEvidence: (ctx) => ({
    permitSignature: {
      permitKind: ctx.signature.permitKind,
      verifyingContract: ctx.signature.verifyingContract,
      verifyingContractPresent: ctx.signature.verifyingContractPresent,
      normalizationState: ctx.signature.normalizationState,
      contractDisposition: ctx.intel.contractDisposition
    }
  })
};
var WARN_MULTICALL_APPROVAL_AND_TRANSFER = {
  id: "TX_WARN_MULTICALL_APPROVAL_AND_TRANSFER",
  name: "Warn on multicall that both grants approval and moves assets",
  eventKind: "transaction",
  severity: "high",
  outcome: "warn",
  priority: 150,
  predicate: (ctx) => {
    const signals = ctx.signals;
    return ctx.eventKind === "transaction" && signals.isMulticall && signals.containsApprovalAndTransfer;
  },
  buildReasonCodes: () => [
    TRANSACTION_CODES.MULTICALL_APPROVAL_AND_TRANSFER
  ],
  buildEvidence: (ctx) => ({
    multicall: {
      batchSelector: ctx.batch.batchSelector,
      actionCount: ctx.batch.actions.length,
      actions: ctx.batch.actions.map((action) => action.actionType)
    }
  })
};
var WARN_TRANSFER_FROM_NEW_RECIPIENT = {
  id: "TX_WARN_TRANSFER_FROM_NEW_RECIPIENT",
  name: "Warn on delegated transfer to a new recipient through a contract",
  eventKind: "transaction",
  severity: "medium",
  outcome: "warn",
  priority: 220,
  predicate: (ctx) => ctx.eventKind === "transaction" && ctx.actionType === "transferFrom" && ctx.counterparty.recipientIsNew === true && ctx.intel.contractDisposition !== "allowlisted" && ctx.intel.contractDisposition !== "malicious",
  buildReasonCodes: () => [
    TRANSACTION_CODES.UNKNOWN_CONTRACT_INTERACTION,
    TRANSACTION_CODES.NEW_RECIPIENT
  ],
  buildEvidence: (ctx) => ({
    delegatedTransfer: {
      owner: ctx.decoded.owner,
      recipient: ctx.decoded.recipient,
      recipientIsNew: ctx.counterparty.recipientIsNew
    }
  })
};
var WARN_UNKNOWN_CONTRACT_INTERACTION_WITH_VALUE = {
  id: "TX_WARN_UNKNOWN_CONTRACT_INTERACTION_WITH_VALUE",
  name: "Warn on opaque contract interaction carrying native value",
  eventKind: "transaction",
  severity: "medium",
  outcome: "warn",
  priority: 240,
  predicate: (ctx) => {
    return ctx.eventKind === "transaction" && ctx.riskClassification.isUnknownMethodRisk && ctx.signals.hasNativeValue && ctx.intel.contractDisposition !== "allowlisted" && ctx.intel.contractDisposition !== "malicious";
  },
  buildReasonCodes: (ctx) => {
    const codes = [TRANSACTION_CODES.UNKNOWN_CONTRACT_INTERACTION];
    if (ctx.counterparty.recipientIsNew === true) {
      codes.push(TRANSACTION_CODES.NEW_RECIPIENT);
    }
    return codes;
  },
  buildEvidence: (ctx) => ({
    unknownInteraction: {
      target: ctx.to,
      valueWei: ctx.valueWei,
      recipientIsNew: ctx.counterparty.recipientIsNew
    }
  })
};
var TRANSACTION_RULES = [
  BLOCK_SCAM_SIGNATURE_MATCH,
  BLOCK_MALICIOUS_TRANSACTION_CONTRACT,
  BLOCK_MALICIOUS_SIGNATURE_CONTRACT,
  WARN_UNLIMITED_APPROVAL_UNKNOWN_SPENDER,
  WARN_SET_APPROVAL_FOR_ALL_UNKNOWN_OPERATOR,
  WARN_INCREASE_ALLOWANCE_UNKNOWN_SPENDER,
  WARN_PERMIT_SIGNATURE_TO_UNTRUSTED_CONTRACT,
  WARN_MULTICALL_APPROVAL_AND_TRANSFER,
  WARN_TRANSFER_FROM_NEW_RECIPIENT,
  WARN_UNKNOWN_CONTRACT_INTERACTION_WITH_VALUE
];

// src/registry/index.ts
var NAVIGATION_RULES = PHISHING_RULES;
var TX_RULES = TRANSACTION_RULES.filter(
  (rule) => rule.eventKind === "transaction"
);
var SIG_RULES = TRANSACTION_RULES.filter(
  (rule) => rule.eventKind === "signature"
);
function getRulesForEventKind(eventKind) {
  if (eventKind === "navigation") {
    return NAVIGATION_RULES;
  }
  if (eventKind === "transaction") {
    return TX_RULES;
  }
  if (eventKind === "signature") {
    return SIG_RULES;
  }
  return [];
}

// src/signals/transaction-risk.ts
function isGrantApprovalDirection(direction) {
  return direction === "grant";
}
function isApprovalStyleAction(context) {
  if (context.eventKind !== "transaction") {
    return false;
  }
  return (context.signals.isApprovalMethod || context.signals.isSetApprovalForAll) && isGrantApprovalDirection(context.signals.approvalDirection);
}
function isPermitStyleAction(context) {
  return context.signals.isPermitSignature || context.eventKind === "transaction" && context.actionType === "permit" && isGrantApprovalDirection(context.decoded.approvalDirection);
}
function isNonBenignUnknownMethod(context) {
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
function isMeaningfulHighValueTransfer(context) {
  if (context.eventKind !== "transaction") {
    return false;
  }
  return context.signals.hasValueTransfer && context.signals.isHighValue;
}
function classifyTransactionRisk(context) {
  const hasMaliciousTarget = context.intel.contractDisposition === "malicious";
  const hasKnownScamSignature = context.intel.signatureDisposition === "malicious";
  const isApprovalRisk = isApprovalStyleAction(context) || isPermitStyleAction(context);
  const isUnlimitedApprovalRisk = isApprovalRisk && context.signals.isUnlimitedApproval && isGrantApprovalDirection(context.signals.approvalDirection);
  const isPermitRisk = isPermitStyleAction(context);
  const isHighValueTransferRisk = isMeaningfulHighValueTransfer(context);
  const isUnknownMethodRisk = isNonBenignUnknownMethod(context);
  const requiresUserAttention = hasMaliciousTarget || hasKnownScamSignature || isUnlimitedApprovalRisk || isApprovalRisk && context.counterparty.spenderTrusted !== true && !context.signals.targetAllowlisted || isPermitRisk && !context.signals.targetAllowlisted || isHighValueTransferRisk || isUnknownMethodRisk;
  return {
    hasMaliciousTarget,
    hasKnownScamSignature,
    isApprovalRisk,
    isUnlimitedApprovalRisk,
    isPermitRisk,
    isHighValueTransferRisk,
    isUnknownMethodRisk,
    requiresUserAttention
  };
}

// src/engine/evaluate.ts
function finalizeTransactionEvaluationInput(input) {
  const {
    signals: _signals,
    riskClassification: _riskClassification,
    ...base2
  } = input;
  const signals = buildTransactionSignals(base2);
  return {
    ...base2,
    signals,
    riskClassification: classifyTransactionRisk({
      ...base2,
      signals
    })
  };
}
function evaluateTyped(rules2, input) {
  const sorted = sortRules(rules2);
  const matches = collectMatches(sorted, input);
  const verdict = assembleVerdict(matches);
  return {
    verdict,
    matchedRules: verdict.matchedRules,
    reasonCodes: verdict.reasonCodes,
    evidence: verdict.evidence
  };
}
function evaluate(input) {
  const rules2 = getRulesForEventKind("navigation");
  return evaluateTyped(rules2, input);
}
function evaluateTransaction(input) {
  const finalizedInput = finalizeTransactionEvaluationInput(input);
  if (finalizedInput.eventKind === "transaction") {
    const rules3 = getRulesForEventKind("transaction");
    const sorted2 = sortRules(rules3);
    const matches2 = collectMatches(sorted2, finalizedInput);
    return assembleTransactionVerdict(finalizedInput, matches2);
  }
  const rules2 = getRulesForEventKind("signature");
  const sorted = sortRules(rules2);
  const matches = collectMatches(sorted, finalizedInput);
  return assembleTransactionVerdict(finalizedInput, matches);
}

// src/normalize/url.ts
var TRACKING_PARAMS = /* @__PURE__ */ new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid"
]);
function normalizeUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  let urlStr = trimmed;
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = "https://" + urlStr;
  }
  try {
    const parsed = new URL(urlStr);
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    parsed.searchParams.sort();
    parsed.hash = "";
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}
function isValidUrl(rawUrl) {
  try {
    new URL(rawUrl);
    return true;
  } catch {
    return false;
  }
}

// src/context-builder.ts
function buildNavigationContext(opts) {
  const hostname = extractHostname(opts.rawUrl);
  const normalized = normalizeUrl(opts.rawUrl);
  let path = "";
  try {
    path = new URL(normalized).pathname;
  } catch {
  }
  const impersonation = looksLikeProtocolImpersonation(opts.rawUrl);
  return {
    eventKind: "navigation",
    normalized: {
      url: normalized,
      hostname,
      path,
      registrableDomain: extractRegistrableDomain(hostname)
    },
    signals: {
      looksLikeProtocolImpersonation: impersonation !== null,
      impersonatedProtocol: impersonation?.target,
      domainAgeHours: opts.domainAgeHours ?? null,
      containsWalletConnectPattern: containsWalletConnectPattern(opts.rawUrl),
      containsMintKeyword: containsMintKeyword(opts.rawUrl),
      isKnownMaliciousDomain: opts.isKnownMaliciousDomain ?? false,
      isIpHost: isIpHost(opts.rawUrl),
      hasHomoglyphs: hasHomoglyphs(opts.rawUrl),
      redirectCount: opts.redirectCount ?? 0,
      finalDomain: opts.finalDomain ?? hostname
    },
    intel: {
      feedVersion: opts.feedVersion,
      domainAllowlistVersion: opts.domainAllowlistVersion
    },
    meta: {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ruleSetVersion: RULE_SET_VERSION
    }
  };
}
function contextToInput(ctx) {
  const domainContext = {
    ageHours: ctx.signals.domainAgeHours,
    isKnownMalicious: ctx.signals.isKnownMaliciousDomain
  };
  return {
    eventKind: "navigation",
    rawUrl: ctx.normalized.url,
    domainContext,
    containsWalletConnectPattern: ctx.signals.containsWalletConnectPattern,
    hasHomoglyphs: ctx.signals.hasHomoglyphs,
    redirectCount: ctx.signals.redirectCount,
    finalDomain: ctx.signals.finalDomain
  };
}

// src/reason-messages.ts
var DEFAULT_REASON_MESSAGE = {
  blockedTitle: "This site has been blocked",
  warningTitle: "Potential risk detected",
  reason: "ClickShield detected a potential security risk with this site.",
  goBackLabel: "Go Back",
  proceedLabel: "Proceed Anyway"
};
var REASON_MESSAGES = {
  [PHISHING_CODES.PHISH_KNOWN_MALICIOUS_DOMAIN]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Known malicious site",
    reason: "This domain appears on a known malicious threat feed. It has been flagged for phishing, scams, or malware distribution.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway"
  },
  [PHISHING_CODES.PHISH_IMPERSONATION_NEW_DOMAIN]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Suspicious impersonation detected",
    reason: "This domain closely resembles a known Web3 protocol and was recently registered. It may be impersonating a legitimate service to steal your credentials or funds.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway"
  },
  [PHISHING_CODES.PHISH_SUSPICIOUS_TLD_MINT_KEYWORD]: {
    blockedTitle: "Suspicious site detected",
    warningTitle: "Suspicious site detected",
    reason: "This site uses a suspicious domain extension and contains crypto-related lure keywords like mint, claim, or airdrop. Exercise caution.",
    goBackLabel: "Go Back",
    proceedLabel: "Continue to Site"
  },
  [PHISHING_CODES.DIRECT_IP_ACCESS]: {
    blockedTitle: "Direct IP access detected",
    warningTitle: "Direct IP access detected",
    reason: "You are navigating to a raw IP address instead of a domain name. Legitimate Web3 services use domain names. This may indicate a phishing attempt.",
    goBackLabel: "Go Back",
    proceedLabel: "Continue to Site"
  },
  [PHISHING_CODES.NEW_DOMAIN_WALLET_CONNECT]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Suspicious wallet connection",
    reason: "This recently-registered domain is attempting to initiate a wallet connection. New domains requesting wallet access are a common phishing tactic.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway"
  },
  [PHISHING_CODES.HOMOGLYPH_ATTACK]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Unicode impersonation detected",
    reason: "This domain uses lookalike Unicode characters to impersonate a legitimate site. This is a sophisticated phishing technique known as a homoglyph attack.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway"
  },
  [PHISHING_CODES.SUSPICIOUS_REDIRECT_CHAIN]: {
    blockedTitle: "Suspicious redirects detected",
    warningTitle: "Suspicious redirects detected",
    reason: "This URL passed through multiple redirects and landed on a different domain than expected. Redirect chains are commonly used to disguise malicious destinations.",
    goBackLabel: "Go Back",
    proceedLabel: "Continue to Site"
  }
};
function getReasonMessage(reasonCode) {
  return REASON_MESSAGES[reasonCode] ?? DEFAULT_REASON_MESSAGE;
}
function getVerdictTitle(outcome, reasonCode) {
  const msg = getReasonMessage(reasonCode);
  return outcome === "block" ? msg.blockedTitle : msg.warningTitle;
}
function riskBadgeLabel(riskLevel) {
  switch (riskLevel) {
    case "critical":
      return "Critical Risk";
    case "high":
      return "High Risk";
    case "medium":
      return "Medium Risk";
    case "low":
      return "Low Risk";
  }
}

// src/normalize/address.ts
function normalizeEvmAddress(address) {
  const trimmed = address.trim().toLowerCase();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}
function normalizeSolAddress(address) {
  return address.trim();
}
function isValidEvmAddress(address) {
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}
function isValidSolAddress(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}

// src/intel/generated/layer2-snapshot.json
var layer2_snapshot_default = {
  generatedAt: "2026-03-24T00:00:00.000Z",
  maliciousContracts: [],
  scamSignatures: [],
  metadata: {
    generatedAt: "2026-03-24T00:00:00.000Z",
    sources: []
  },
  sectionStates: {
    maliciousContracts: "missing",
    scamSignatures: "missing"
  },
  version: "layer2.0678fea2fb9bed9a"
};

// src/transaction/intel-provider.ts
var ZERO_EVM_ADDRESS = "0x0000000000000000000000000000000000000000";
function freezeObject(value) {
  return Object.freeze(value);
}
function freezeMaliciousContractRecord(entry) {
  return freezeObject({
    chain: entry.chain,
    address: entry.address,
    source: entry.source,
    disposition: entry.disposition,
    confidence: entry.confidence,
    reasonCodes: freezeObject([...entry.reasonCodes])
  });
}
function mapSnapshotSectionState(state) {
  switch (state) {
    case "ready":
      return "fresh";
    case "stale":
      return "stale";
    default:
      return "missing";
  }
}
function normalizeMaliciousContractAddress(value) {
  if (value === null || !isValidEvmAddress(value)) {
    return null;
  }
  const normalized = normalizeEvmAddress(value);
  return normalized === ZERO_EVM_ADDRESS ? null : normalized;
}
function createUnavailableMaliciousContractResult(sectionState) {
  return freezeObject({
    lookupFamily: "contract",
    matched: false,
    disposition: "unavailable",
    feedVersion: null,
    sectionState,
    record: null
  });
}
function createUnavailableScamSignatureResult(sectionState) {
  return freezeObject({
    lookupFamily: "scam_signature",
    matched: false,
    disposition: "unavailable",
    feedVersion: null,
    sectionState,
    record: null
  });
}
function createNoMatchMaliciousContractResult(feedVersion, sectionState) {
  return freezeObject({
    lookupFamily: "contract",
    matched: false,
    disposition: "no_match",
    feedVersion,
    sectionState,
    record: null
  });
}
function createNoMatchScamSignatureResult(feedVersion, sectionState) {
  return freezeObject({
    lookupFamily: "scam_signature",
    matched: false,
    disposition: "no_match",
    feedVersion,
    sectionState,
    record: null
  });
}
function createMatchedScamSignatureResult(entry, feedVersion, sectionState) {
  return freezeObject({
    lookupFamily: "scam_signature",
    matched: true,
    disposition: "malicious",
    matchedSection: "scamSignatures",
    feedVersion,
    sectionState,
    record: freezeObject({
      signatureHash: entry.signatureHash,
      source: entry.source,
      confidence: entry.confidence,
      reason: entry.reason
    })
  });
}
function createMatchedMaliciousContractResult(entry, feedVersion, sectionState) {
  return freezeObject({
    lookupFamily: "contract",
    matched: true,
    disposition: "malicious",
    matchedSection: "maliciousContracts",
    feedVersion,
    sectionState,
    record: freezeMaliciousContractRecord(entry)
  });
}
function createCanonicalTransactionIntelLookupResult(maliciousContract, scamSignature) {
  return freezeObject({
    maliciousContract,
    scamSignature
  });
}
function canonicalLookupCacheKey(eventKind, targetAddress, signatureHash) {
  return `${eventKind}:${targetAddress ?? "null"}:${signatureHash ?? "null"}`;
}
function normalizeScamSignatureKey(value) {
  if (value === null || !/^0x[0-9a-f]{64}$/.test(value)) {
    return null;
  }
  return value;
}
function createTransactionIntelProvider(snapshot) {
  if (snapshot === null) {
    const contractUnavailable = createUnavailableMaliciousContractResult("missing");
    const signatureUnavailable = createUnavailableScamSignatureResult("missing");
    const canonicalUnavailable = createCanonicalTransactionIntelLookupResult(
      contractUnavailable,
      signatureUnavailable
    );
    return freezeObject({
      snapshotVersion: null,
      generatedAt: null,
      lookupCanonicalTransactionIntel: () => canonicalUnavailable,
      lookupMaliciousContract: () => contractUnavailable,
      lookupScamSignature: () => signatureUnavailable
    });
  }
  const maliciousContractsState = mapSnapshotSectionState(
    snapshot.sectionStates.maliciousContracts
  );
  const scamSignaturesState = mapSnapshotSectionState(
    snapshot.sectionStates.scamSignatures
  );
  const maliciousContractResults = /* @__PURE__ */ new Map();
  snapshot.maliciousContracts.forEach((entry) => {
    maliciousContractResults.set(
      `${entry.chain}:${entry.address}`,
      createMatchedMaliciousContractResult(
        entry,
        snapshot.version,
        maliciousContractsState
      )
    );
  });
  const noMatchMaliciousContractResult = createNoMatchMaliciousContractResult(
    snapshot.version,
    maliciousContractsState
  );
  const lookupMaliciousContract = (lookup) => {
    const normalizedAddress = normalizeMaliciousContractAddress(lookup.address);
    if (normalizedAddress === null) {
      return noMatchMaliciousContractResult;
    }
    return maliciousContractResults.get(`${lookup.chain}:${normalizedAddress}`) ?? noMatchMaliciousContractResult;
  };
  const scamSignatureResults = /* @__PURE__ */ new Map();
  snapshot.scamSignatures.forEach((entry) => {
    scamSignatureResults.set(
      entry.signatureHash,
      createMatchedScamSignatureResult(
        entry,
        snapshot.version,
        scamSignaturesState
      )
    );
  });
  const noMatchScamSignatureResult = createNoMatchScamSignatureResult(
    snapshot.version,
    scamSignaturesState
  );
  const lookupScamSignature = (lookup) => {
    const normalizedKey = normalizeScamSignatureKey(lookup.normalizedKey);
    if (normalizedKey === null) {
      return noMatchScamSignatureResult;
    }
    return scamSignatureResults.get(normalizedKey) ?? noMatchScamSignatureResult;
  };
  const canonicalLookupResults = /* @__PURE__ */ new Map();
  const lookupCanonicalTransactionIntel = (lookup) => {
    const normalizedAddress = normalizeMaliciousContractAddress(lookup.targetAddress);
    const normalizedSignatureHash = normalizeScamSignatureKey(lookup.signatureHash);
    const cacheKey = canonicalLookupCacheKey(
      lookup.eventKind,
      normalizedAddress,
      normalizedSignatureHash
    );
    const cached = canonicalLookupResults.get(cacheKey);
    if (cached !== void 0) {
      return cached;
    }
    const canonicalResult = createCanonicalTransactionIntelLookupResult(
      lookupMaliciousContract({
        chain: "evm",
        address: lookup.targetAddress
      }),
      lookupScamSignature({
        normalizedKey: normalizedSignatureHash
      })
    );
    canonicalLookupResults.set(cacheKey, canonicalResult);
    return canonicalResult;
  };
  return freezeObject({
    snapshotVersion: snapshot.version,
    generatedAt: snapshot.generatedAt,
    lookupCanonicalTransactionIntel,
    lookupMaliciousContract,
    lookupScamSignature
  });
}
function resolveCanonicalTransactionIntel(provider, lookup) {
  return provider.lookupCanonicalTransactionIntel(lookup);
}

// src/transaction/intel-snapshot.ts
var EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT = "1970-01-01T00:00:00.000Z";
var ROOT_KEYS = [
  "version",
  "generatedAt",
  "maliciousContracts",
  "scamSignatures",
  "metadata",
  "sectionStates"
];
var MALICIOUS_CONTRACT_KEYS = [
  "chain",
  "address",
  "source",
  "disposition",
  "confidence",
  "reason",
  "reasonCodes"
];
var SCAM_SIGNATURE_KEYS = [
  "signatureHash",
  "source",
  "confidence",
  "reason"
];
var METADATA_KEYS = ["generatedAt", "sources"];
var SECTION_STATE_KEYS = ["maliciousContracts", "scamSignatures"];
var ZERO_EVM_ADDRESS2 = "0x0000000000000000000000000000000000000000";
var TRANSACTION_INTEL_SOURCES = ["chainabuse", "internal", "ofac"];
var TRANSACTION_INTEL_CONFIDENCES = ["high", "low", "medium"];
var MALICIOUS_CONTRACT_CHAINS = ["bitcoin", "evm", "solana"];
var SCAM_SIGNATURE_SOURCE_SET = /* @__PURE__ */ new Set([
  "chainabuse",
  "internal"
]);
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function deepFreeze(value) {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      deepFreeze(entry);
    });
    return Object.freeze(value);
  }
  if (isRecord(value)) {
    Object.values(value).forEach((entry) => {
      deepFreeze(entry);
    });
    return Object.freeze(value);
  }
  return value;
}
function isValidUtcTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}
function pushIssue(issues, failureKinds, path, message, kind = "malformed") {
  issues.push({ path, message });
  failureKinds.push(kind);
}
function assertExactKeys(value, allowedKeys, path, issues, failureKinds) {
  const allowed = new Set(allowedKeys);
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      pushIssue(
        issues,
        failureKinds,
        path === "" ? key : `${path}.${key}`,
        "Unknown field"
      );
    }
  });
}
function readRequiredString(value, key, path, issues, failureKinds) {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.trim() === "") {
    pushIssue(
      issues,
      failureKinds,
      path === "" ? key : `${path}.${key}`,
      "Expected a non-empty string"
    );
    return null;
  }
  return candidate;
}
function readRequiredStringArray(value, key, path, issues, failureKinds) {
  const candidate = value[key];
  if (!Array.isArray(candidate)) {
    pushIssue(
      issues,
      failureKinds,
      path === "" ? key : `${path}.${key}`,
      "Expected array of non-empty strings"
    );
    return null;
  }
  const parsed = candidate.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      pushIssue(
        issues,
        failureKinds,
        `${path === "" ? key : `${path}.${key}`}[${index}]`,
        "Expected a non-empty string"
      );
      return "";
    }
    return entry;
  });
  return parsed;
}
function isSortedUnique(values) {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] >= values[index]) {
      return false;
    }
  }
  return true;
}
function isTransactionIntelSource(value) {
  return TRANSACTION_INTEL_SOURCES.includes(value);
}
function isTransactionIntelConfidence(value) {
  return TRANSACTION_INTEL_CONFIDENCES.includes(value);
}
function isTransactionMaliciousContractChain(value) {
  return MALICIOUS_CONTRACT_CHAINS.includes(value);
}
function validateConfidenceForSource(source, confidence, path, issues, failureKinds) {
  if ((source === "ofac" || source === "internal") && confidence !== "high") {
    pushIssue(
      issues,
      failureKinds,
      path,
      `${source} entries must use high confidence`,
      "incompatible"
    );
  }
  if (source === "chainabuse" && confidence === "high") {
    pushIssue(
      issues,
      failureKinds,
      path,
      "chainabuse entries must use low or medium confidence",
      "incompatible"
    );
  }
}
function isValidSignatureHash(value) {
  return /^0x[0-9a-f]{64}$/.test(value);
}
function buildSnapshotVersion(snapshotBody) {
  const digest = sha256Hex(
    serializeCanonicalJson({
      maliciousContracts: snapshotBody.maliciousContracts.map((entry) => ({
        chain: entry.chain,
        address: entry.address,
        source: entry.source,
        disposition: entry.disposition,
        confidence: entry.confidence,
        reason: entry.reason,
        reasonCodes: entry.reasonCodes
      })),
      scamSignatures: snapshotBody.scamSignatures.map((entry) => ({
        signatureHash: entry.signatureHash,
        source: entry.source,
        confidence: entry.confidence,
        reason: entry.reason
      })),
      metadata: {
        generatedAt: snapshotBody.metadata.generatedAt,
        sources: snapshotBody.metadata.sources
      },
      sectionStates: snapshotBody.sectionStates
    })
  ).slice(0, 16);
  return `layer2.${digest}`;
}
function parseSectionStates(value, issues, failureKinds) {
  if (!isRecord(value)) {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates",
      "Expected sectionStates object"
    );
    return null;
  }
  assertExactKeys(value, SECTION_STATE_KEYS, "sectionStates", issues, failureKinds);
  const maliciousContracts = readRequiredString(
    value,
    "maliciousContracts",
    "sectionStates",
    issues,
    failureKinds
  );
  const scamSignatures = readRequiredString(
    value,
    "scamSignatures",
    "sectionStates",
    issues,
    failureKinds
  );
  if (maliciousContracts === null || scamSignatures === null) {
    return null;
  }
  if (maliciousContracts !== "ready" && maliciousContracts !== "stale" && maliciousContracts !== "missing") {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates.maliciousContracts",
      "Unsupported maliciousContracts state",
      "incompatible"
    );
  }
  if (scamSignatures !== "ready" && scamSignatures !== "stale" && scamSignatures !== "missing") {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates.scamSignatures",
      "Unsupported scamSignatures state",
      "incompatible"
    );
  }
  return {
    maliciousContracts: maliciousContracts === "ready" || maliciousContracts === "stale" || maliciousContracts === "missing" ? maliciousContracts : "missing",
    scamSignatures: scamSignatures === "ready" || scamSignatures === "stale" || scamSignatures === "missing" ? scamSignatures : "missing"
  };
}
function parseMetadata(value, issues, failureKinds) {
  if (!isRecord(value)) {
    pushIssue(
      issues,
      failureKinds,
      "metadata",
      "Expected metadata object"
    );
    return null;
  }
  assertExactKeys(value, METADATA_KEYS, "metadata", issues, failureKinds);
  const generatedAt = readRequiredString(
    value,
    "generatedAt",
    "metadata",
    issues,
    failureKinds
  );
  const sources = readRequiredStringArray(
    value,
    "sources",
    "metadata",
    issues,
    failureKinds
  );
  if (generatedAt === null || sources === null) {
    return null;
  }
  if (!isValidUtcTimestamp(generatedAt)) {
    pushIssue(
      issues,
      failureKinds,
      "metadata.generatedAt",
      "Expected an ISO-8601 UTC timestamp"
    );
  }
  sources.forEach((source, index) => {
    if (!isTransactionIntelSource(source)) {
      pushIssue(
        issues,
        failureKinds,
        `metadata.sources[${index}]`,
        "Unsupported snapshot source",
        "incompatible"
      );
    }
  });
  if (!isSortedUnique(sources)) {
    pushIssue(
      issues,
      failureKinds,
      "metadata.sources",
      "sources must be sorted and unique",
      "incompatible"
    );
  }
  return {
    generatedAt,
    sources: sources.filter(isTransactionIntelSource)
  };
}
function parseMaliciousContracts(value, issues, failureKinds) {
  if (!Array.isArray(value)) {
    pushIssue(
      issues,
      failureKinds,
      "maliciousContracts",
      "Expected maliciousContracts array"
    );
    return null;
  }
  const parsed = [];
  const seenKeys = /* @__PURE__ */ new Set();
  let previousKey = "";
  value.forEach((rawEntry, index) => {
    const entryPath = `maliciousContracts[${index}]`;
    if (!isRecord(rawEntry)) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "Expected malicious contract entry object"
      );
      return;
    }
    assertExactKeys(
      rawEntry,
      MALICIOUS_CONTRACT_KEYS,
      entryPath,
      issues,
      failureKinds
    );
    const chain = readRequiredString(
      rawEntry,
      "chain",
      entryPath,
      issues,
      failureKinds
    );
    const address = readRequiredString(
      rawEntry,
      "address",
      entryPath,
      issues,
      failureKinds
    );
    const source = readRequiredString(
      rawEntry,
      "source",
      entryPath,
      issues,
      failureKinds
    );
    const disposition = readRequiredString(
      rawEntry,
      "disposition",
      entryPath,
      issues,
      failureKinds
    );
    const confidence = readRequiredString(
      rawEntry,
      "confidence",
      entryPath,
      issues,
      failureKinds
    );
    const reason = readRequiredString(
      rawEntry,
      "reason",
      entryPath,
      issues,
      failureKinds
    );
    const reasonCodesRaw = rawEntry.reasonCodes;
    if (chain === null || address === null || source === null || disposition === null || confidence === null || reason === null) {
      return;
    }
    if (!isTransactionMaliciousContractChain(chain)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.chain`,
        "Unsupported chain in transaction snapshot",
        "incompatible"
      );
    }
    if (chain === "evm") {
      if (!isValidEvmAddress(address)) {
        pushIssue(
          issues,
          failureKinds,
          `${entryPath}.address`,
          "Expected a canonical EVM address",
          "incompatible"
        );
      }
      if (address !== normalizeEvmAddress(address)) {
        pushIssue(
          issues,
          failureKinds,
          `${entryPath}.address`,
          "Expected a lowercase canonical EVM address",
          "incompatible"
        );
      }
      if (address === ZERO_EVM_ADDRESS2) {
        pushIssue(
          issues,
          failureKinds,
          `${entryPath}.address`,
          "Zero address is not allowed in transaction snapshot",
          "incompatible"
        );
      }
    }
    if (!isTransactionIntelSource(source)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.source`,
        "Unsupported malicious contract source",
        "incompatible"
      );
    }
    if (disposition !== "block" && disposition !== "warn") {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.disposition`,
        "Unsupported malicious contract disposition",
        "incompatible"
      );
    }
    if (!isTransactionIntelConfidence(confidence)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.confidence`,
        "Unsupported malicious contract confidence",
        "incompatible"
      );
    }
    if (isTransactionIntelSource(source) && isTransactionIntelConfidence(confidence)) {
      validateConfidenceForSource(
        source,
        confidence,
        `${entryPath}.confidence`,
        issues,
        failureKinds
      );
    }
    if (!Array.isArray(reasonCodesRaw)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.reasonCodes`,
        "Expected reasonCodes array"
      );
      return;
    }
    const reasonCodes = reasonCodesRaw.map((reasonCode, reasonIndex) => {
      if (typeof reasonCode !== "string" || reasonCode.trim() === "") {
        pushIssue(
          issues,
          failureKinds,
          `${entryPath}.reasonCodes[${reasonIndex}]`,
          "Expected a non-empty reason code string"
        );
        return "";
      }
      return reasonCode;
    });
    if (reasonCodes.length === 0) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.reasonCodes`,
        "Expected at least one reason code"
      );
    }
    const dedupeKey = `${chain}:${address}`;
    if (seenKeys.has(dedupeKey)) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "Duplicate malicious contract entry",
        "incompatible"
      );
    } else {
      seenKeys.add(dedupeKey);
    }
    if (dedupeKey < previousKey) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "maliciousContracts entries must be sorted by chain and address",
        "incompatible"
      );
    }
    previousKey = dedupeKey;
    parsed.push({
      chain: isTransactionMaliciousContractChain(chain) ? chain : "evm",
      address,
      source: isTransactionIntelSource(source) ? source : "internal",
      disposition: disposition === "block" ? "block" : "warn",
      confidence: isTransactionIntelConfidence(confidence) ? confidence : "low",
      reason,
      reasonCodes
    });
  });
  return parsed;
}
function parseScamSignatures(value, issues, failureKinds) {
  if (!Array.isArray(value)) {
    pushIssue(
      issues,
      failureKinds,
      "scamSignatures",
      "Expected scamSignatures array"
    );
    return null;
  }
  const parsed = [];
  const seenHashes = /* @__PURE__ */ new Set();
  let previousHash = "";
  value.forEach((rawEntry, index) => {
    const entryPath = `scamSignatures[${index}]`;
    if (!isRecord(rawEntry)) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "Expected scam signature entry object"
      );
      return;
    }
    assertExactKeys(
      rawEntry,
      SCAM_SIGNATURE_KEYS,
      entryPath,
      issues,
      failureKinds
    );
    const signatureHash = readRequiredString(
      rawEntry,
      "signatureHash",
      entryPath,
      issues,
      failureKinds
    );
    const source = readRequiredString(
      rawEntry,
      "source",
      entryPath,
      issues,
      failureKinds
    );
    const confidence = readRequiredString(
      rawEntry,
      "confidence",
      entryPath,
      issues,
      failureKinds
    );
    const reason = readRequiredString(
      rawEntry,
      "reason",
      entryPath,
      issues,
      failureKinds
    );
    if (signatureHash === null || source === null || confidence === null || reason === null) {
      return;
    }
    if (!isValidSignatureHash(signatureHash)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.signatureHash`,
        "Expected a lowercase 32-byte hex signature hash",
        "incompatible"
      );
    }
    if (!SCAM_SIGNATURE_SOURCE_SET.has(source)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.source`,
        "Unsupported scam signature source",
        "incompatible"
      );
    }
    if (!isTransactionIntelConfidence(confidence)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.confidence`,
        "Unsupported scam signature confidence",
        "incompatible"
      );
    }
    if (SCAM_SIGNATURE_SOURCE_SET.has(source) && isTransactionIntelConfidence(confidence)) {
      validateConfidenceForSource(
        source,
        confidence,
        `${entryPath}.confidence`,
        issues,
        failureKinds
      );
    }
    if (seenHashes.has(signatureHash)) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "Duplicate scam signature entry",
        "incompatible"
      );
    } else {
      seenHashes.add(signatureHash);
    }
    if (signatureHash < previousHash) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "scamSignatures entries must be sorted by signatureHash",
        "incompatible"
      );
    }
    previousHash = signatureHash;
    parsed.push({
      signatureHash,
      source: source === "chainabuse" || source === "internal" ? source : "internal",
      confidence: isTransactionIntelConfidence(confidence) ? confidence : "low",
      reason
    });
  });
  return parsed;
}
function toFailureStatus(failureKinds) {
  return failureKinds.includes("incompatible") ? "incompatible" : "malformed";
}
function validateTransactionLayer2Snapshot(input) {
  const issues = [];
  const failureKinds = [];
  if (!isRecord(input)) {
    pushIssue(issues, failureKinds, "", "Expected snapshot object");
    return {
      ok: false,
      status: "malformed",
      issues
    };
  }
  assertExactKeys(input, ROOT_KEYS, "", issues, failureKinds);
  const version = readRequiredString(input, "version", "", issues, failureKinds);
  const generatedAt = readRequiredString(
    input,
    "generatedAt",
    "",
    issues,
    failureKinds
  );
  const maliciousContracts = parseMaliciousContracts(
    input.maliciousContracts,
    issues,
    failureKinds
  );
  const scamSignatures = parseScamSignatures(
    input.scamSignatures,
    issues,
    failureKinds
  );
  const metadata = parseMetadata(input.metadata, issues, failureKinds);
  const sectionStates = parseSectionStates(
    input.sectionStates,
    issues,
    failureKinds
  );
  if (generatedAt !== null && !isValidUtcTimestamp(generatedAt)) {
    pushIssue(
      issues,
      failureKinds,
      "generatedAt",
      "Expected an ISO-8601 UTC timestamp"
    );
  }
  if (version !== null && !/^layer2\.[0-9a-f]{16}$/.test(version)) {
    pushIssue(
      issues,
      failureKinds,
      "version",
      "Unsupported snapshot version format",
      "incompatible"
    );
  }
  if (maliciousContracts === null || scamSignatures === null || metadata === null || sectionStates === null || version === null || generatedAt === null) {
    return {
      ok: false,
      status: toFailureStatus(failureKinds),
      issues
    };
  }
  if (generatedAt !== metadata.generatedAt) {
    pushIssue(
      issues,
      failureKinds,
      "metadata.generatedAt",
      "metadata.generatedAt must match root generatedAt",
      "incompatible"
    );
  }
  if (maliciousContracts.length > 0 && sectionStates.maliciousContracts === "missing") {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates.maliciousContracts",
      "maliciousContracts section cannot be missing when entries are present",
      "incompatible"
    );
  }
  if (scamSignatures.length > 0 && sectionStates.scamSignatures === "missing") {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates.scamSignatures",
      "scamSignatures section cannot be missing when entries are present",
      "incompatible"
    );
  }
  maliciousContracts.forEach((entry, index) => {
    if (!metadata.sources.includes(entry.source)) {
      pushIssue(
        issues,
        failureKinds,
        `maliciousContracts[${index}].source`,
        "Entry source must appear in metadata.sources",
        "incompatible"
      );
    }
  });
  scamSignatures.forEach((entry, index) => {
    if (!metadata.sources.includes(entry.source)) {
      pushIssue(
        issues,
        failureKinds,
        `scamSignatures[${index}].source`,
        "Entry source must appear in metadata.sources",
        "incompatible"
      );
    }
  });
  const snapshotBody = {
    generatedAt,
    maliciousContracts,
    scamSignatures,
    metadata,
    sectionStates
  };
  const expectedVersion = buildSnapshotVersion(snapshotBody);
  if (version !== expectedVersion) {
    pushIssue(
      issues,
      failureKinds,
      "version",
      `Snapshot version does not match canonical content hash (${expectedVersion})`,
      "incompatible"
    );
  }
  if (issues.length > 0) {
    return {
      ok: false,
      status: toFailureStatus(failureKinds),
      issues
    };
  }
  const snapshot = deepFreeze({
    version,
    generatedAt,
    maliciousContracts,
    scamSignatures,
    metadata,
    sectionStates
  });
  return {
    ok: true,
    status: maliciousContracts.length === 0 && scamSignatures.length === 0 ? "empty" : "valid",
    snapshot,
    issues
  };
}
function buildEmptyValidatedTransactionLayer2Snapshot(generatedAt = EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT) {
  const canonicalGeneratedAt = isValidUtcTimestamp(generatedAt) ? generatedAt : EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT;
  const snapshotBody = {
    generatedAt: canonicalGeneratedAt,
    maliciousContracts: [],
    scamSignatures: [],
    metadata: {
      generatedAt: canonicalGeneratedAt,
      sources: []
    },
    sectionStates: {
      maliciousContracts: "missing",
      scamSignatures: "missing"
    }
  };
  return deepFreeze({
    version: buildSnapshotVersion(snapshotBody),
    ...snapshotBody
  });
}

// src/transaction/hydrate.ts
var UNAVAILABLE_ORIGIN_INTEL = Object.freeze({
  allowlistFeedVersion: null,
  originDisposition: "unavailable"
});
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isValidUtcTimestamp2(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}
function readFallbackGeneratedAt(value) {
  if (!isRecord2(value) || typeof value.generatedAt !== "string") {
    return EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT;
  }
  return isValidUtcTimestamp2(value.generatedAt) ? value.generatedAt : EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT;
}
function activateCanonicalTransactionSnapshot(snapshotSource) {
  const validation = validateTransactionLayer2Snapshot(snapshotSource);
  if (validation.ok) {
    const provider2 = createTransactionIntelProvider(validation.snapshot);
    return Object.freeze({
      state: validation.status === "empty" ? "empty" : "valid",
      rejectionStatus: null,
      issues: validation.issues,
      snapshot: validation.snapshot,
      provider: provider2
    });
  }
  const fallbackSnapshot = buildEmptyValidatedTransactionLayer2Snapshot(
    readFallbackGeneratedAt(snapshotSource)
  );
  const provider = createTransactionIntelProvider(fallbackSnapshot);
  return Object.freeze({
    state: "rejected",
    rejectionStatus: validation.status,
    issues: validation.issues,
    snapshot: fallbackSnapshot,
    provider
  });
}
function buildCanonicalSignatureHash(input) {
  if (input.eventKind !== "signature" || input.signature.isTypedData !== true) {
    return null;
  }
  return `0x${sha256Hex(input.signature.canonicalJson)}`;
}
var CANONICAL_TRANSACTION_SNAPSHOT_ACTIVATION = activateCanonicalTransactionSnapshot(layer2_snapshot_default);
var CANONICAL_TRANSACTION_INTEL_PROVIDER = CANONICAL_TRANSACTION_SNAPSHOT_ACTIVATION.provider;
function isTransactionIntelProvider(provider) {
  return provider !== null && typeof provider === "object" && "lookupCanonicalTransactionIntel" in provider && typeof provider.lookupCanonicalTransactionIntel === "function";
}
function getLookupProvider(provider) {
  if (provider === void 0 || provider === null) {
    return CANONICAL_TRANSACTION_INTEL_PROVIDER;
  }
  if (!isTransactionIntelProvider(provider)) {
    throw new TypeError(
      "Transaction intel runtime overrides must be prebuilt providers."
    );
  }
  return provider;
}
function buildHydratedIntel(input, provider) {
  const lookup = {
    eventKind: input.eventKind,
    targetAddress: input.eventKind === "signature" ? input.signature.verifyingContract : input.to,
    signatureHash: buildCanonicalSignatureHash(input)
  };
  const resolved = resolveCanonicalTransactionIntel(
    getLookupProvider(provider),
    lookup
  );
  return {
    contractDisposition: resolved.maliciousContract.disposition,
    contractFeedVersion: resolved.maliciousContract.feedVersion,
    allowlistFeedVersion: UNAVAILABLE_ORIGIN_INTEL.allowlistFeedVersion,
    signatureDisposition: resolved.scamSignature.disposition,
    signatureFeedVersion: resolved.scamSignature.feedVersion,
    originDisposition: UNAVAILABLE_ORIGIN_INTEL.originDisposition,
    sectionStates: {
      maliciousContracts: resolved.maliciousContract.sectionState,
      scamSignatures: resolved.scamSignature.sectionState
    }
  };
}
function hydrateNormalizedTransactionContext(input, provider) {
  const hydrated = {
    ...input,
    intel: buildHydratedIntel(input, provider)
  };
  const {
    signals: _signals,
    riskClassification: _riskClassification,
    ...signalInput
  } = hydrated;
  const signals = buildTransactionSignals(signalInput);
  return {
    ...hydrated,
    signals,
    riskClassification: classifyTransactionRisk({
      ...signalInput,
      signals
    })
  };
}
function getDefaultTransactionIntelProvider() {
  return CANONICAL_TRANSACTION_INTEL_PROVIDER;
}
function getCanonicalTransactionSnapshotActivation() {
  return CANONICAL_TRANSACTION_SNAPSHOT_ACTIVATION;
}

// src/transaction/typed-data.ts
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isTypedDataField(value) {
  if (!isRecord3(value)) return false;
  return typeof value.name === "string" && typeof value.type === "string";
}
function parseTypedDataPayload(input) {
  if (typeof input === "string") {
    const parsed = JSON.parse(input);
    if (!isRecord3(parsed)) {
      throw new Error("Typed data payload must be an object.");
    }
    return parsed;
  }
  return input;
}
function normalizeTypes(value) {
  if (!value || !isRecord3(value)) {
    return {};
  }
  const entries = [];
  for (const key of Object.keys(value).sort()) {
    const fields = value[key];
    if (!Array.isArray(fields)) continue;
    const normalizedFields = fields.filter(isTypedDataField).map((field) => ({
      name: field.name,
      type: field.type
    }));
    entries.push([key, normalizedFields]);
  }
  return Object.fromEntries(entries);
}
function normalizeString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
function normalizeNumericString(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    return null;
  }
  const raw = typeof value === "string" ? value.trim() : `${value}`;
  if (raw === "") return null;
  try {
    if (/^0x[0-9a-fA-F]+$/.test(raw)) {
      return BigInt(raw).toString(10);
    }
    if (/^-?[0-9]+$/.test(raw)) {
      return BigInt(raw).toString(10);
    }
  } catch {
    return raw;
  }
  return raw;
}
function isCanonicalDecimalString(value) {
  return value !== null && /^[0-9]+$/.test(value);
}
function normalizeBoolean(value) {
  return value === true;
}
function stripArraySuffix(type) {
  const match = type.match(/^(.*)\[[0-9]*\]$/);
  return match ? match[1] : null;
}
function normalizeUnknownObject(value) {
  const entries = [];
  for (const key of Object.keys(value).sort()) {
    entries.push([key, normalizeTypedDataValue(value[key], null, {})]);
  }
  return Object.fromEntries(entries);
}
function normalizeStructuredValue(value, structName, types) {
  const fieldMap = /* @__PURE__ */ new Map();
  for (const field of types[structName] ?? []) {
    fieldMap.set(field.name, field.type);
  }
  const entries = [];
  for (const key of Object.keys(value).sort()) {
    entries.push([
      key,
      normalizeTypedDataValue(value[key], fieldMap.get(key) ?? null, types)
    ]);
  }
  return Object.fromEntries(entries);
}
function normalizeTypedDataValue(value, solidityType, types) {
  if (value === null || value === void 0) return null;
  if (solidityType !== null) {
    const arrayInnerType = stripArraySuffix(solidityType);
    if (arrayInnerType !== null) {
      if (!Array.isArray(value)) return [];
      return value.map(
        (item) => normalizeTypedDataValue(item, arrayInnerType, types)
      );
    }
    if (solidityType === "address") {
      const normalized = normalizeString(value);
      return normalized === null ? null : normalizeEvmAddress(normalized);
    }
    if (solidityType.startsWith("uint") || solidityType.startsWith("int")) {
      return normalizeNumericString(value);
    }
    if (solidityType === "bool") {
      return normalizeBoolean(value);
    }
    if (solidityType === "string" || solidityType.startsWith("bytes")) {
      return normalizeString(value);
    }
    if (types[solidityType] && isRecord3(value)) {
      return normalizeStructuredValue(value, solidityType, types);
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeTypedDataValue(item, null, types));
  }
  if (isRecord3(value)) {
    return normalizeUnknownObject(value);
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return `${value}`;
  }
  return `${value}`;
}
function stableStringify(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value;
  const parts = Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${parts.join(",")}}`;
}
function serializeTypesForCanonical(types) {
  const entries = [];
  for (const key of Object.keys(types).sort()) {
    const fields = types[key] ?? [];
    entries.push([
      key,
      fields.map((field) => ({
        name: field.name,
        type: field.type
      }))
    ]);
  }
  return Object.fromEntries(entries);
}
function classifyPermitKind(primaryType) {
  if (primaryType === null) return "none";
  const normalized = primaryType.trim().toLowerCase();
  if (normalized === "") return "none";
  if (normalized === "permit") return "erc20_permit";
  if (normalized === "permitsingle") return "permit2_single";
  if (normalized === "permitbatch") return "permit2_batch";
  if (normalized.includes("permit")) return "unknown_permit";
  return "none";
}
function normalizeTypedData(input) {
  const payload = parseTypedDataPayload(input);
  const types = normalizeTypes(payload.types ?? null);
  const primaryType = normalizeString(payload.primaryType);
  const domainInput = isRecord3(payload.domain) ? payload.domain : {};
  const messageInput = isRecord3(payload.message) ? payload.message : {};
  const domainType = types.EIP712Domain ? "EIP712Domain" : null;
  const normalizedDomain = normalizeTypedDataValue(
    domainInput,
    domainType,
    types
  );
  const normalizedMessage = normalizeTypedDataValue(
    messageInput,
    primaryType,
    types
  );
  const domain = normalizedDomain !== null && !Array.isArray(normalizedDomain) && typeof normalizedDomain === "object" ? normalizedDomain : {};
  const message = normalizedMessage !== null && !Array.isArray(normalizedMessage) && typeof normalizedMessage === "object" ? normalizedMessage : {};
  const domainName = typeof domain.name === "string" ? domain.name : normalizeString(domainInput.name);
  const domainVersion = typeof domain.version === "string" ? domain.version : normalizeString(domainInput.version);
  const domainChainIdPresent = Object.prototype.hasOwnProperty.call(
    domainInput,
    "chainId"
  );
  const normalizedDomainChainId = domainChainIdPresent ? normalizeNumericString(domainInput.chainId) : null;
  const verifyingContractPresent = Object.prototype.hasOwnProperty.call(
    domainInput,
    "verifyingContract"
  );
  const verifyingContractRaw = verifyingContractPresent ? normalizeString(domainInput.verifyingContract) : null;
  const missingDomainFields = [];
  const invalidDomainFields = [];
  if (!domainChainIdPresent) {
    missingDomainFields.push("domain.chainId");
  }
  if (!verifyingContractPresent) {
    missingDomainFields.push("domain.verifyingContract");
  }
  const domainChainId = domainChainIdPresent && isCanonicalDecimalString(normalizedDomainChainId) ? normalizedDomainChainId : null;
  const hasValidDomainChainId = domainChainId !== null;
  if (domainChainIdPresent && !hasValidDomainChainId) {
    invalidDomainFields.push("domain.chainId");
  }
  const verifyingContract = verifyingContractRaw !== null && isValidEvmAddress(verifyingContractRaw) ? normalizeEvmAddress(verifyingContractRaw) : null;
  const hasValidVerifyingContract = verifyingContract !== null;
  if (verifyingContractPresent && !hasValidVerifyingContract) {
    invalidDomainFields.push("domain.verifyingContract");
  }
  const normalizationState = invalidDomainFields.length > 0 ? "invalid_domain_fields" : missingDomainFields.length > 0 ? "missing_domain_fields" : "normalized";
  const canonicalRoot = {
    domain,
    message,
    primaryType,
    types: serializeTypesForCanonical(types)
  };
  return {
    isTypedData: true,
    primaryType,
    domainName,
    domainVersion,
    domainChainId,
    domainChainIdPresent: hasValidDomainChainId,
    verifyingContract,
    verifyingContractPresent: hasValidVerifyingContract,
    message,
    domain,
    types,
    canonicalJson: stableStringify(canonicalRoot),
    normalizationState,
    missingDomainFields,
    invalidDomainFields,
    permitKind: classifyPermitKind(primaryType)
  };
}

// src/transaction/decode.ts
function normalizeHex(calldata) {
  const trimmed = calldata.trim().toLowerCase();
  if (trimmed === "") return "0x";
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}
function stripHexPrefix(value) {
  return value.startsWith("0x") ? value.slice(2) : value;
}
function getBody(calldata) {
  const clean = stripHexPrefix(normalizeHex(calldata));
  return clean.length <= 8 ? "" : clean.slice(8);
}
function getWord(body, index) {
  const start = index * 64;
  const end = start + 64;
  if (body.length < end) return null;
  return body.slice(start, end);
}
function decodeAddressWord(word) {
  if (word === null || word.length !== 64) return null;
  return normalizeEvmAddress(`0x${word.slice(24)}`);
}
function decodeUintWord(word) {
  if (word === null || word.length !== 64) return null;
  return BigInt(`0x${word}`).toString(10);
}
function decodeBoolWord(word) {
  if (word === null || word.length !== 64) return null;
  return BigInt(`0x${word}`) !== 0n;
}
function quantityToDecimal(value) {
  if (value === null || value === void 0) return "0";
  if (typeof value === "bigint") return value.toString(10);
  if (typeof value === "number") return BigInt(value).toString(10);
  const trimmed = value.trim();
  if (trimmed === "") return "0";
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    return BigInt(trimmed).toString(10);
  }
  return BigInt(trimmed).toString(10);
}
function defaultCounterparty(input) {
  return {
    spenderTrusted: input?.spenderTrusted ?? null,
    recipientIsNew: input?.recipientIsNew ?? null
  };
}
function buildProvider(surface, walletProvider, walletMetadata) {
  return {
    surface: surface ?? "unknown",
    walletProvider,
    walletName: walletMetadata.walletName,
    platform: walletMetadata.platform
  };
}
function buildDecodedAction(input) {
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
    approvalDirection: input.approvalDirection ?? "not_applicable"
  };
}
function buildApprovalAmountKind(amountHex) {
  if (amountHex === null) return "not_applicable";
  return amountHex.toLowerCase() === MAX_UINT256_HEX ? "unlimited" : "exact";
}
function decodeBytesArray(body, offsetWord) {
  if (offsetWord === null) return [];
  const arrayStart = Number(BigInt(`0x${offsetWord}`)) * 2;
  const lengthWord = body.slice(arrayStart, arrayStart + 64);
  if (lengthWord.length !== 64) return [];
  const itemCount = Number(BigInt(`0x${lengthWord}`));
  const results = [];
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
function decodeSimpleCall(selector, body, toAddress) {
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
            amount: decodeUintWord(word1)
          }
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] }
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
            approved
          }
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] }
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
            amount: decodeUintWord(word1)
          }
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] }
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
            amount: decodeUintWord(word1)
          }
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] }
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
            amount: decodeUintWord(word2)
          }
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] }
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
            s: word6 === null ? null : `0x${word6}`
          }
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] }
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
            s: getWord(body, 7) === null ? null : `0x${getWord(body, 7)}`
          }
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] }
      };
    }
    case MULTICALL_BYTES_SELECTOR:
    case MULTICALL_DEADLINE_BYTES_SELECTOR: {
      const bytesOffsetWord = selector === MULTICALL_BYTES_SELECTOR ? word0 : word1;
      const rawCalls = decodeBytesArray(body, bytesOffsetWord);
      const actions = rawCalls.map((rawCall) => decodeTransactionCalldata(rawCall).decoded);
      const params = {
        actionCount: `${actions.length}`
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
          params
        }),
        batch: {
          isMulticall: true,
          batchSelector: selector,
          actions
        }
      };
    }
    default:
      return {
        decoded: buildDecodedAction({
          selector,
          actionType: "unknown",
          tokenAddress: toAddress
        }),
        batch: { isMulticall: false, batchSelector: null, actions: [] }
      };
  }
}
function decodeTransactionCalldata(calldata, toAddress = null) {
  const normalizedCalldata = normalizeHex(calldata);
  const selector = extractSelector(normalizedCalldata);
  const definition = getTransactionSelectorDefinition(selector);
  const body = getBody(normalizedCalldata);
  if (definition === null) {
    return {
      decoded: buildDecodedAction({
        selector: selector === "0x" ? null : selector,
        actionType: "unknown",
        tokenAddress: toAddress
      }),
      batch: { isMulticall: false, batchSelector: null, actions: [] }
    };
  }
  return decodeSimpleCall(selector, body, toAddress);
}
function normalizeTransactionRequest(input, options) {
  const to = normalizeEvmAddress(input.to);
  const from = normalizeEvmAddress(input.from);
  const normalizedCalldata = normalizeHex(input.calldata);
  const methodSelector = normalizedCalldata === "0x" ? null : extractSelector(normalizedCalldata);
  const { decoded, batch } = decodeTransactionCalldata(normalizedCalldata, to);
  const normalized = {
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
      permitKind: "none"
    },
    intel: {
      contractDisposition: "unavailable",
      contractFeedVersion: null,
      allowlistFeedVersion: null,
      signatureDisposition: "unavailable",
      signatureFeedVersion: null,
      originDisposition: "unavailable",
      sectionStates: {}
    },
    provider: buildProvider(
      input.surface,
      input.walletProvider,
      input.walletMetadata
    ),
    counterparty: defaultCounterparty(input.counterparty),
    meta: {
      selectorRecognized: methodSelector !== null && getTransactionSelectorDefinition(methodSelector) !== null,
      typedDataNormalized: false
    }
  };
  const signals = getTransactionSignals(normalized);
  return hydrateNormalizedTransactionContext(
    {
      ...normalized,
      signals,
      riskClassification: classifyTransactionRisk({
        ...normalized,
        signals
      })
    },
    options?.intelProvider
  );
}
function normalizeTypedDataRequest(input, options) {
  const from = normalizeEvmAddress(input.from);
  const signature = normalizeTypedData(input.typedData);
  const normalized = {
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
      selector: null
    }),
    batch: {
      isMulticall: false,
      batchSelector: null,
      actions: []
    },
    signature,
    intel: {
      contractDisposition: "unavailable",
      contractFeedVersion: null,
      allowlistFeedVersion: null,
      signatureDisposition: "unavailable",
      signatureFeedVersion: null,
      originDisposition: "unavailable",
      sectionStates: {}
    },
    provider: buildProvider(
      input.surface,
      input.walletProvider,
      input.walletMetadata
    ),
    counterparty: defaultCounterparty(input.counterparty),
    meta: {
      selectorRecognized: false,
      typedDataNormalized: signature.normalizationState === "normalized"
    }
  };
  const signals = buildTransactionSignals(normalized);
  return hydrateNormalizedTransactionContext(
    {
      ...normalized,
      signals,
      riskClassification: classifyTransactionRisk({
        ...normalized,
        signals
      })
    },
    options?.intelProvider
  );
}

// src/transaction/analytics.ts
function getRecordTarget(record) {
  const target = record.signals.targetAddress ?? record.explanation.details.target;
  if (typeof target !== "string") {
    return null;
  }
  const normalizedTarget = target.trim().toLowerCase();
  return normalizedTarget.length > 0 ? normalizedTarget : null;
}
function analyzeTransactions(records) {
  let blockedCount = 0;
  let warnedCount = 0;
  const repeatedTargetMap = /* @__PURE__ */ new Map();
  for (const record of records) {
    if (record.status === "block") {
      blockedCount += 1;
    }
    if (record.status === "warn") {
      warnedCount += 1;
    }
    const target = getRecordTarget(record);
    if (target !== null) {
      repeatedTargetMap.set(target, (repeatedTargetMap.get(target) ?? 0) + 1);
    }
  }
  const repeatedTargetCount = Object.fromEntries(
    [...repeatedTargetMap.entries()].sort(
      ([left], [right]) => left.localeCompare(right)
    )
  );
  const totalTransactions = records.length;
  const highRiskFrequency = totalTransactions === 0 ? 0 : blockedCount / totalTransactions;
  const repeatedTarget = Object.values(repeatedTargetCount).some(
    (count) => count > 3
  );
  return {
    totalTransactions,
    blockedCount,
    warnedCount,
    repeatedTargetCount,
    highRiskFrequency,
    patterns: {
      repeatedTarget,
      frequentHighRisk: highRiskFrequency > 0.5
    }
  };
}

// src/transaction/protection.ts
var WARN_ESCALATION_MIN_COUNT = 3;
var WARN_ESCALATION_MIN_RATIO = 0.5;
var COOLDOWN_RECENT_WINDOW_SIZE = 5;
var COOLDOWN_MIN_RECENT_RECORDS = 4;
var COOLDOWN_MIN_RISK_RATIO = 0.8;
function getMaxRepeatedTargetCount(records) {
  let maxCount = 0;
  for (const count of Object.values(records)) {
    if (count > maxCount) {
      maxCount = count;
    }
  }
  return maxCount;
}
function compareRecordsByRecency(left, right) {
  if (left.timestamp === right.timestamp) {
    if (left.id === right.id) {
      return 0;
    }
    return left.id < right.id ? -1 : 1;
  }
  return left.timestamp < right.timestamp ? 1 : -1;
}
function getRecentRiskRatio(records) {
  const recentRecords = [...records].sort(compareRecordsByRecency).slice(0, COOLDOWN_RECENT_WINDOW_SIZE);
  if (recentRecords.length < COOLDOWN_MIN_RECENT_RECORDS) {
    return 0;
  }
  let riskyCount = 0;
  for (const record of recentRecords) {
    if (record.status !== "allow") {
      riskyCount += 1;
    }
  }
  return riskyCount / recentRecords.length;
}
function deriveUserProtectionProfile(records) {
  const analytics = analyzeTransactions(records);
  const repeatedTargetCount = getMaxRepeatedTargetCount(
    analytics.repeatedTargetCount
  );
  const warnEscalationSuggested = analytics.warnedCount >= WARN_ESCALATION_MIN_COUNT && analytics.totalTransactions > 0 && analytics.warnedCount / analytics.totalTransactions >= WARN_ESCALATION_MIN_RATIO;
  const cooldownSuggested = getRecentRiskRatio(records) >= COOLDOWN_MIN_RISK_RATIO;
  const controls = {
    repeatedTargetCaution: analytics.patterns.repeatedTarget,
    frequentHighRiskCaution: analytics.patterns.frequentHighRisk,
    warnEscalationSuggested,
    cooldownSuggested
  };
  return {
    heightenedProtection: Object.values(controls).some(Boolean),
    controls,
    summary: {
      totalTransactions: analytics.totalTransactions,
      blockedCount: analytics.blockedCount,
      warnedCount: analytics.warnedCount,
      repeatedTargetCount,
      highRiskFrequency: analytics.highRiskFrequency
    }
  };
}

// src/transaction/orchestration.ts
function isRecord4(value) {
  return typeof value === "object" && value !== null;
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isValidExplanationStatus(value) {
  return value === "block" || value === "warn" || value === "allow";
}
function isValidExplanationRiskLevel(value) {
  return value === "high" || value === "medium" || value === "low";
}
function isValidAuditStatus(value) {
  return value === "block" || value === "warn" || value === "allow";
}
function isValidSignalActionType(value) {
  return value === "approve" || value === "setApprovalForAll" || value === "increaseAllowance" || value === "permit" || value === "transfer" || value === "transferFrom" || value === "multicall" || value === "unknown";
}
function isValidApprovalDirection(value) {
  return value === "grant" || value === "revoke" || value === "not_applicable";
}
function isTransactionSignals(value) {
  return isRecord4(value) && typeof value.isContractInteraction === "boolean" && typeof value.isNativeTransfer === "boolean" && (value.methodName === void 0 || typeof value.methodName === "string") && typeof value.isApproval === "boolean" && isValidSignalActionType(value.actionType) && typeof value.isApprovalMethod === "boolean" && typeof value.isUnlimitedApproval === "boolean" && typeof value.hasValueTransfer === "boolean" && typeof value.isHighValue === "boolean" && (value.targetAddress === void 0 || typeof value.targetAddress === "string") && typeof value.isPermitSignature === "boolean" && typeof value.isSetApprovalForAll === "boolean" && isValidApprovalDirection(value.approvalDirection) && (typeof value.spenderTrusted === "boolean" || value.spenderTrusted === null) && (typeof value.recipientIsNew === "boolean" || value.recipientIsNew === null) && typeof value.isTransfer === "boolean" && typeof value.isTransferFrom === "boolean" && typeof value.isMulticall === "boolean" && typeof value.containsApprovalAndTransfer === "boolean" && typeof value.containsApproval === "boolean" && typeof value.containsTransfer === "boolean" && typeof value.containsTransferFrom === "boolean" && typeof value.batchActionCount === "number" && Number.isFinite(value.batchActionCount) && typeof value.hasNativeValue === "boolean" && typeof value.touchesMaliciousContract === "boolean" && typeof value.targetAllowlisted === "boolean" && typeof value.signatureIntelMatch === "boolean" && typeof value.verifyingContractKnown === "boolean" && typeof value.hasUnknownInnerCall === "boolean";
}
function isTransactionRiskClassification(value) {
  return isRecord4(value) && typeof value.hasMaliciousTarget === "boolean" && typeof value.hasKnownScamSignature === "boolean" && typeof value.isApprovalRisk === "boolean" && typeof value.isUnlimitedApprovalRisk === "boolean" && typeof value.isPermitRisk === "boolean" && typeof value.isHighValueTransferRisk === "boolean" && typeof value.isUnknownMethodRisk === "boolean" && typeof value.requiresUserAttention === "boolean";
}
function isTransactionExplanation(value) {
  if (!isRecord4(value) || !isRecord4(value.details)) {
    return false;
  }
  return isValidExplanationStatus(value.status) && isNonEmptyString(value.summary) && isNonEmptyString(value.primaryReason) && Array.isArray(value.secondaryReasons) && isValidExplanationRiskLevel(value.riskLevel) && typeof value.details.isContractInteraction === "boolean";
}
function isTransactionAuditRecord(value) {
  return isRecord4(value) && isNonEmptyString(value.id) && isNonEmptyString(value.timestamp) && isValidAuditStatus(value.status) && isTransactionExplanation(value.explanation) && isTransactionSignals(value.signals) && isTransactionRiskClassification(value.classification) && isRecord4(value.metadata) && (value.metadata.source === "extension" || value.metadata.source === "mobile" || value.metadata.source === "desktop");
}
function isTransactionAnalytics(value) {
  return isRecord4(value) && typeof value.totalTransactions === "number" && typeof value.blockedCount === "number" && typeof value.warnedCount === "number" && isRecord4(value.repeatedTargetCount) && typeof value.highRiskFrequency === "number" && isRecord4(value.patterns) && typeof value.patterns.repeatedTarget === "boolean" && typeof value.patterns.frequentHighRisk === "boolean";
}
function isUserProtectionProfile(value) {
  return isRecord4(value) && typeof value.heightenedProtection === "boolean" && isRecord4(value.controls) && typeof value.controls.repeatedTargetCaution === "boolean" && typeof value.controls.frequentHighRiskCaution === "boolean" && typeof value.controls.warnEscalationSuggested === "boolean" && typeof value.controls.cooldownSuggested === "boolean" && isRecord4(value.summary) && typeof value.summary.totalTransactions === "number" && typeof value.summary.blockedCount === "number" && typeof value.summary.warnedCount === "number" && typeof value.summary.repeatedTargetCount === "number" && typeof value.summary.highRiskFrequency === "number";
}
function buildTransactionDecisionPackage(records, verdict) {
  const analytics = analyzeTransactions([...records]);
  const protection = deriveUserProtectionProfile([...records]);
  const explanation = verdict.explanation;
  const audit = verdict.audit;
  const hasExplanation = isTransactionExplanation(explanation);
  const hasAudit = isTransactionAuditRecord(audit);
  const hasAnalytics = isTransactionAnalytics(analytics);
  const hasProtectionProfile = isUserProtectionProfile(protection);
  return {
    verdict,
    explanation,
    audit,
    analytics,
    protection,
    readiness: {
      hasExplanation,
      hasAudit,
      hasAnalytics,
      hasProtectionProfile,
      complete: hasExplanation && hasAudit && hasAnalytics && hasProtectionProfile
    }
  };
}

// node_modules/.pnpm/tldts-core@7.0.27/node_modules/tldts-core/dist/es6/src/domain.js
function shareSameDomainSuffix(hostname, vhost) {
  if (hostname.endsWith(vhost)) {
    return hostname.length === vhost.length || hostname[hostname.length - vhost.length - 1] === ".";
  }
  return false;
}
function extractDomainWithSuffix(hostname, publicSuffix) {
  const publicSuffixIndex = hostname.length - publicSuffix.length - 2;
  const lastDotBeforeSuffixIndex = hostname.lastIndexOf(".", publicSuffixIndex);
  if (lastDotBeforeSuffixIndex === -1) {
    return hostname;
  }
  return hostname.slice(lastDotBeforeSuffixIndex + 1);
}
function getDomain(suffix, hostname, options) {
  if (options.validHosts !== null) {
    const validHosts = options.validHosts;
    for (const vhost of validHosts) {
      if (
        /*@__INLINE__*/
        shareSameDomainSuffix(hostname, vhost)
      ) {
        return vhost;
      }
    }
  }
  let numberOfLeadingDots = 0;
  if (hostname.startsWith(".")) {
    while (numberOfLeadingDots < hostname.length && hostname[numberOfLeadingDots] === ".") {
      numberOfLeadingDots += 1;
    }
  }
  if (suffix.length === hostname.length - numberOfLeadingDots) {
    return null;
  }
  return (
    /*@__INLINE__*/
    extractDomainWithSuffix(hostname, suffix)
  );
}

// node_modules/.pnpm/tldts-core@7.0.27/node_modules/tldts-core/dist/es6/src/domain-without-suffix.js
function getDomainWithoutSuffix(domain, suffix) {
  return domain.slice(0, -suffix.length - 1);
}

// node_modules/.pnpm/tldts-core@7.0.27/node_modules/tldts-core/dist/es6/src/extract-hostname.js
function extractHostname4(url, urlIsValidHostname) {
  let start = 0;
  let end = url.length;
  let hasUpper = false;
  if (!urlIsValidHostname) {
    if (url.startsWith("data:")) {
      return null;
    }
    while (start < url.length && url.charCodeAt(start) <= 32) {
      start += 1;
    }
    while (end > start + 1 && url.charCodeAt(end - 1) <= 32) {
      end -= 1;
    }
    if (url.charCodeAt(start) === 47 && url.charCodeAt(start + 1) === 47) {
      start += 2;
    } else {
      const indexOfProtocol = url.indexOf(":/", start);
      if (indexOfProtocol !== -1) {
        const protocolSize = indexOfProtocol - start;
        const c0 = url.charCodeAt(start);
        const c1 = url.charCodeAt(start + 1);
        const c2 = url.charCodeAt(start + 2);
        const c3 = url.charCodeAt(start + 3);
        const c4 = url.charCodeAt(start + 4);
        if (protocolSize === 5 && c0 === 104 && c1 === 116 && c2 === 116 && c3 === 112 && c4 === 115) {
        } else if (protocolSize === 4 && c0 === 104 && c1 === 116 && c2 === 116 && c3 === 112) {
        } else if (protocolSize === 3 && c0 === 119 && c1 === 115 && c2 === 115) {
        } else if (protocolSize === 2 && c0 === 119 && c1 === 115) {
        } else {
          for (let i = start; i < indexOfProtocol; i += 1) {
            const lowerCaseCode = url.charCodeAt(i) | 32;
            if (!(lowerCaseCode >= 97 && lowerCaseCode <= 122 || // [a, z]
            lowerCaseCode >= 48 && lowerCaseCode <= 57 || // [0, 9]
            lowerCaseCode === 46 || // '.'
            lowerCaseCode === 45 || // '-'
            lowerCaseCode === 43)) {
              return null;
            }
          }
        }
        start = indexOfProtocol + 2;
        while (url.charCodeAt(start) === 47) {
          start += 1;
        }
      }
    }
    let indexOfIdentifier = -1;
    let indexOfClosingBracket = -1;
    let indexOfPort = -1;
    for (let i = start; i < end; i += 1) {
      const code = url.charCodeAt(i);
      if (code === 35 || // '#'
      code === 47 || // '/'
      code === 63) {
        end = i;
        break;
      } else if (code === 64) {
        indexOfIdentifier = i;
      } else if (code === 93) {
        indexOfClosingBracket = i;
      } else if (code === 58) {
        indexOfPort = i;
      } else if (code >= 65 && code <= 90) {
        hasUpper = true;
      }
    }
    if (indexOfIdentifier !== -1 && indexOfIdentifier > start && indexOfIdentifier < end) {
      start = indexOfIdentifier + 1;
    }
    if (url.charCodeAt(start) === 91) {
      if (indexOfClosingBracket !== -1) {
        return url.slice(start + 1, indexOfClosingBracket).toLowerCase();
      }
      return null;
    } else if (indexOfPort !== -1 && indexOfPort > start && indexOfPort < end) {
      end = indexOfPort;
    }
  }
  while (end > start + 1 && url.charCodeAt(end - 1) === 46) {
    end -= 1;
  }
  const hostname = start !== 0 || end !== url.length ? url.slice(start, end) : url;
  if (hasUpper) {
    return hostname.toLowerCase();
  }
  return hostname;
}

// node_modules/.pnpm/tldts-core@7.0.27/node_modules/tldts-core/dist/es6/src/is-ip.js
function isProbablyIpv4(hostname) {
  if (hostname.length < 7) {
    return false;
  }
  if (hostname.length > 15) {
    return false;
  }
  let numberOfDots = 0;
  for (let i = 0; i < hostname.length; i += 1) {
    const code = hostname.charCodeAt(i);
    if (code === 46) {
      numberOfDots += 1;
    } else if (code < 48 || code > 57) {
      return false;
    }
  }
  return numberOfDots === 3 && hostname.charCodeAt(0) !== 46 && hostname.charCodeAt(hostname.length - 1) !== 46;
}
function isProbablyIpv6(hostname) {
  if (hostname.length < 3) {
    return false;
  }
  let start = hostname.startsWith("[") ? 1 : 0;
  let end = hostname.length;
  if (hostname[end - 1] === "]") {
    end -= 1;
  }
  if (end - start > 39) {
    return false;
  }
  let hasColon = false;
  for (; start < end; start += 1) {
    const code = hostname.charCodeAt(start);
    if (code === 58) {
      hasColon = true;
    } else if (!(code >= 48 && code <= 57 || // 0-9
    code >= 97 && code <= 102 || // a-f
    code >= 65 && code <= 90)) {
      return false;
    }
  }
  return hasColon;
}
function isIp(hostname) {
  return isProbablyIpv6(hostname) || isProbablyIpv4(hostname);
}

// node_modules/.pnpm/tldts-core@7.0.27/node_modules/tldts-core/dist/es6/src/is-valid.js
function isValidAscii(code) {
  return code >= 97 && code <= 122 || code >= 48 && code <= 57 || code > 127;
}
function is_valid_default(hostname) {
  if (hostname.length > 255) {
    return false;
  }
  if (hostname.length === 0) {
    return false;
  }
  if (
    /*@__INLINE__*/
    !isValidAscii(hostname.charCodeAt(0)) && hostname.charCodeAt(0) !== 46 && // '.' (dot)
    hostname.charCodeAt(0) !== 95
  ) {
    return false;
  }
  let lastDotIndex = -1;
  let lastCharCode = -1;
  const len = hostname.length;
  for (let i = 0; i < len; i += 1) {
    const code = hostname.charCodeAt(i);
    if (code === 46) {
      if (
        // Check that previous label is < 63 bytes long (64 = 63 + '.')
        i - lastDotIndex > 64 || // Check that previous character was not already a '.'
        lastCharCode === 46 || // Check that the previous label does not end with a '-' (dash)
        lastCharCode === 45 || // Check that the previous label does not end with a '_' (underscore)
        lastCharCode === 95
      ) {
        return false;
      }
      lastDotIndex = i;
    } else if (!/*@__INLINE__*/
    (isValidAscii(code) || code === 45 || code === 95)) {
      return false;
    }
    lastCharCode = code;
  }
  return (
    // Check that last label is shorter than 63 chars
    len - lastDotIndex - 1 <= 63 && // Check that the last character is an allowed trailing label character.
    // Since we already checked that the char is a valid hostname character,
    // we only need to check that it's different from '-'.
    lastCharCode !== 45
  );
}

// node_modules/.pnpm/tldts-core@7.0.27/node_modules/tldts-core/dist/es6/src/options.js
function setDefaultsImpl({ allowIcannDomains = true, allowPrivateDomains = false, detectIp = true, extractHostname: extractHostname5 = true, mixedInputs = true, validHosts = null, validateHostname = true }) {
  return {
    allowIcannDomains,
    allowPrivateDomains,
    detectIp,
    extractHostname: extractHostname5,
    mixedInputs,
    validHosts,
    validateHostname
  };
}
var DEFAULT_OPTIONS = (
  /*@__INLINE__*/
  setDefaultsImpl({})
);
function setDefaults(options) {
  if (options === void 0) {
    return DEFAULT_OPTIONS;
  }
  return (
    /*@__INLINE__*/
    setDefaultsImpl(options)
  );
}

// node_modules/.pnpm/tldts-core@7.0.27/node_modules/tldts-core/dist/es6/src/subdomain.js
function getSubdomain(hostname, domain) {
  if (domain.length === hostname.length) {
    return "";
  }
  return hostname.slice(0, -domain.length - 1);
}

// node_modules/.pnpm/tldts-core@7.0.27/node_modules/tldts-core/dist/es6/src/factory.js
function getEmptyResult() {
  return {
    domain: null,
    domainWithoutSuffix: null,
    hostname: null,
    isIcann: null,
    isIp: null,
    isPrivate: null,
    publicSuffix: null,
    subdomain: null
  };
}
function resetResult(result) {
  result.domain = null;
  result.domainWithoutSuffix = null;
  result.hostname = null;
  result.isIcann = null;
  result.isIp = null;
  result.isPrivate = null;
  result.publicSuffix = null;
  result.subdomain = null;
}
function parseImpl(url, step, suffixLookup2, partialOptions, result) {
  const options = (
    /*@__INLINE__*/
    setDefaults(partialOptions)
  );
  if (typeof url !== "string") {
    return result;
  }
  if (!options.extractHostname) {
    result.hostname = url;
  } else if (options.mixedInputs) {
    result.hostname = extractHostname4(url, is_valid_default(url));
  } else {
    result.hostname = extractHostname4(url, false);
  }
  if (options.detectIp && result.hostname !== null) {
    result.isIp = isIp(result.hostname);
    if (result.isIp) {
      return result;
    }
  }
  if (options.validateHostname && options.extractHostname && result.hostname !== null && !is_valid_default(result.hostname)) {
    result.hostname = null;
    return result;
  }
  if (step === 0 || result.hostname === null) {
    return result;
  }
  suffixLookup2(result.hostname, options, result);
  if (step === 2 || result.publicSuffix === null) {
    return result;
  }
  result.domain = getDomain(result.publicSuffix, result.hostname, options);
  if (step === 3 || result.domain === null) {
    return result;
  }
  result.subdomain = getSubdomain(result.hostname, result.domain);
  if (step === 4) {
    return result;
  }
  result.domainWithoutSuffix = getDomainWithoutSuffix(result.domain, result.publicSuffix);
  return result;
}

// node_modules/.pnpm/tldts-core@7.0.27/node_modules/tldts-core/dist/es6/src/lookup/fast-path.js
function fast_path_default(hostname, options, out) {
  if (!options.allowPrivateDomains && hostname.length > 3) {
    const last = hostname.length - 1;
    const c3 = hostname.charCodeAt(last);
    const c2 = hostname.charCodeAt(last - 1);
    const c1 = hostname.charCodeAt(last - 2);
    const c0 = hostname.charCodeAt(last - 3);
    if (c3 === 109 && c2 === 111 && c1 === 99 && c0 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "com";
      return true;
    } else if (c3 === 103 && c2 === 114 && c1 === 111 && c0 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "org";
      return true;
    } else if (c3 === 117 && c2 === 100 && c1 === 101 && c0 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "edu";
      return true;
    } else if (c3 === 118 && c2 === 111 && c1 === 103 && c0 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "gov";
      return true;
    } else if (c3 === 116 && c2 === 101 && c1 === 110 && c0 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "net";
      return true;
    } else if (c3 === 101 && c2 === 100 && c1 === 46) {
      out.isIcann = true;
      out.isPrivate = false;
      out.publicSuffix = "de";
      return true;
    }
  }
  return false;
}

// node_modules/.pnpm/tldts@7.0.27/node_modules/tldts/dist/es6/src/data/trie.js
var exceptions = /* @__PURE__ */ (function() {
  const _0 = [1, {}], _1 = [0, { "city": _0 }];
  const exceptions2 = [0, { "ck": [0, { "www": _0 }], "jp": [0, { "kawasaki": _1, "kitakyushu": _1, "kobe": _1, "nagoya": _1, "sapporo": _1, "sendai": _1, "yokohama": _1 }] }];
  return exceptions2;
})();
var rules = /* @__PURE__ */ (function() {
  const _2 = [1, {}], _3 = [2, {}], _4 = [1, { "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2 }], _5 = [1, { "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2 }], _6 = [0, { "*": _3 }], _7 = [2, { "s": _6 }], _8 = [0, { "relay": _3 }], _9 = [2, { "id": _3 }], _10 = [1, { "gov": _2 }], _11 = [0, { "airflow": _6, "lambda-url": _3, "transfer-webapp": _3 }], _12 = [0, { "airflow": _6, "transfer-webapp": _3 }], _13 = [0, { "transfer-webapp": _3 }], _14 = [0, { "transfer-webapp": _3, "transfer-webapp-fips": _3 }], _15 = [0, { "notebook": _3, "studio": _3 }], _16 = [0, { "labeling": _3, "notebook": _3, "studio": _3 }], _17 = [0, { "notebook": _3 }], _18 = [0, { "labeling": _3, "notebook": _3, "notebook-fips": _3, "studio": _3 }], _19 = [0, { "notebook": _3, "notebook-fips": _3, "studio": _3, "studio-fips": _3 }], _20 = [0, { "shop": _3 }], _21 = [0, { "*": _2 }], _22 = [1, { "co": _3 }], _23 = [0, { "objects": _3 }], _24 = [2, { "eu-west-1": _3, "us-east-1": _3 }], _25 = [2, { "nodes": _3 }], _26 = [0, { "my": _3 }], _27 = [0, { "s3": _3, "s3-accesspoint": _3, "s3-website": _3 }], _28 = [0, { "s3": _3, "s3-accesspoint": _3 }], _29 = [0, { "direct": _3 }], _30 = [0, { "webview-assets": _3 }], _31 = [0, { "vfs": _3, "webview-assets": _3 }], _32 = [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "dualstack": _27, "s3": _3, "s3-accesspoint": _3, "s3-object-lambda": _3, "s3-website": _3, "aws-cloud9": _30, "cloud9": _31 }], _33 = [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "dualstack": _28, "s3": _3, "s3-accesspoint": _3, "s3-object-lambda": _3, "s3-website": _3, "aws-cloud9": _30, "cloud9": _31 }], _34 = [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "dualstack": _27, "s3": _3, "s3-accesspoint": _3, "s3-object-lambda": _3, "s3-website": _3, "analytics-gateway": _3, "aws-cloud9": _30, "cloud9": _31 }], _35 = [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "dualstack": _27, "s3": _3, "s3-accesspoint": _3, "s3-object-lambda": _3, "s3-website": _3 }], _36 = [0, { "s3": _3, "s3-accesspoint": _3, "s3-accesspoint-fips": _3, "s3-fips": _3, "s3-website": _3 }], _37 = [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "dualstack": _36, "s3": _3, "s3-accesspoint": _3, "s3-accesspoint-fips": _3, "s3-fips": _3, "s3-object-lambda": _3, "s3-website": _3, "aws-cloud9": _30, "cloud9": _31 }], _38 = [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "dualstack": _36, "s3": _3, "s3-accesspoint": _3, "s3-accesspoint-fips": _3, "s3-fips": _3, "s3-object-lambda": _3, "s3-website": _3 }], _39 = [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "dualstack": _36, "s3": _3, "s3-accesspoint": _3, "s3-accesspoint-fips": _3, "s3-deprecated": _3, "s3-fips": _3, "s3-object-lambda": _3, "s3-website": _3, "analytics-gateway": _3, "aws-cloud9": _30, "cloud9": _31 }], _40 = [0, { "auth": _3 }], _41 = [0, { "auth": _3, "auth-fips": _3 }], _42 = [0, { "auth-fips": _3 }], _43 = [0, { "apps": _3 }], _44 = [0, { "paas": _3 }], _45 = [2, { "eu": _3 }], _46 = [0, { "app": _3 }], _47 = [0, { "site": _3 }], _48 = [1, { "com": _2, "edu": _2, "net": _2, "org": _2 }], _49 = [0, { "j": _3 }], _50 = [0, { "dyn": _3 }], _51 = [2, { "web": _3 }], _52 = [1, { "co": _2, "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2 }], _53 = [0, { "p": _3 }], _54 = [0, { "user": _3 }], _55 = [1, { "ms": _3 }], _56 = [0, { "cdn": _3 }], _57 = [2, { "raw": _6 }], _58 = [0, { "cust": _3, "reservd": _3 }], _59 = [0, { "cust": _3 }], _60 = [0, { "s3": _3 }], _61 = [1, { "biz": _2, "com": _2, "edu": _2, "gov": _2, "info": _2, "net": _2, "org": _2 }], _62 = [0, { "ipfs": _3 }], _63 = [1, { "framer": _3 }], _64 = [0, { "forgot": _3 }], _65 = [0, { "blob": _3, "file": _3, "web": _3 }], _66 = [0, { "core": _65, "servicebus": _3 }], _67 = [1, { "gs": _2 }], _68 = [0, { "nes": _2 }], _69 = [1, { "k12": _2, "cc": _2, "lib": _2 }], _70 = [1, { "cc": _2 }], _71 = [1, { "cc": _2, "lib": _2 }];
  const rules2 = [0, { "ac": [1, { "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "drr": _3, "feedback": _3, "forms": _3 }], "ad": _2, "ae": [1, { "ac": _2, "co": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "sch": _2 }], "aero": [1, { "airline": _2, "airport": _2, "accident-investigation": _2, "accident-prevention": _2, "aerobatic": _2, "aeroclub": _2, "aerodrome": _2, "agents": _2, "air-surveillance": _2, "air-traffic-control": _2, "aircraft": _2, "airtraffic": _2, "ambulance": _2, "association": _2, "author": _2, "ballooning": _2, "broker": _2, "caa": _2, "cargo": _2, "catering": _2, "certification": _2, "championship": _2, "charter": _2, "civilaviation": _2, "club": _2, "conference": _2, "consultant": _2, "consulting": _2, "control": _2, "council": _2, "crew": _2, "design": _2, "dgca": _2, "educator": _2, "emergency": _2, "engine": _2, "engineer": _2, "entertainment": _2, "equipment": _2, "exchange": _2, "express": _2, "federation": _2, "flight": _2, "freight": _2, "fuel": _2, "gliding": _2, "government": _2, "groundhandling": _2, "group": _2, "hanggliding": _2, "homebuilt": _2, "insurance": _2, "journal": _2, "journalist": _2, "leasing": _2, "logistics": _2, "magazine": _2, "maintenance": _2, "marketplace": _2, "media": _2, "microlight": _2, "modelling": _2, "navigation": _2, "parachuting": _2, "paragliding": _2, "passenger-association": _2, "pilot": _2, "press": _2, "production": _2, "recreation": _2, "repbody": _2, "res": _2, "research": _2, "rotorcraft": _2, "safety": _2, "scientist": _2, "services": _2, "show": _2, "skydiving": _2, "software": _2, "student": _2, "taxi": _2, "trader": _2, "trading": _2, "trainer": _2, "union": _2, "workinggroup": _2, "works": _2 }], "af": _4, "ag": [1, { "co": _2, "com": _2, "net": _2, "nom": _2, "org": _2, "obj": _3 }], "ai": [1, { "com": _2, "net": _2, "off": _2, "org": _2, "uwu": _3, "framer": _3, "kiloapps": _3 }], "al": _5, "am": [1, { "co": _2, "com": _2, "commune": _2, "net": _2, "org": _2, "radio": _3 }], "ao": [1, { "co": _2, "ed": _2, "edu": _2, "gov": _2, "gv": _2, "it": _2, "og": _2, "org": _2, "pb": _2 }], "aq": _2, "ar": [1, { "bet": _2, "com": _2, "coop": _2, "edu": _2, "gob": _2, "gov": _2, "int": _2, "mil": _2, "musica": _2, "mutual": _2, "net": _2, "org": _2, "seg": _2, "senasa": _2, "tur": _2 }], "arpa": [1, { "e164": _2, "home": _2, "in-addr": _2, "ip6": _2, "iris": _2, "uri": _2, "urn": _2 }], "as": _10, "asia": [1, { "cloudns": _3, "daemon": _3, "dix": _3 }], "at": [1, { "4": _3, "ac": [1, { "sth": _2 }], "co": _2, "gv": _2, "or": _2, "funkfeuer": [0, { "wien": _3 }], "futurecms": [0, { "*": _3, "ex": _6, "in": _6 }], "futurehosting": _3, "futuremailing": _3, "ortsinfo": [0, { "ex": _6, "kunden": _6 }], "biz": _3, "info": _3, "123webseite": _3, "priv": _3, "my": _3, "myspreadshop": _3, "12hp": _3, "2ix": _3, "4lima": _3, "lima-city": _3 }], "au": [1, { "asn": _2, "com": [1, { "cloudlets": [0, { "mel": _3 }], "myspreadshop": _3 }], "edu": [1, { "act": _2, "catholic": _2, "nsw": _2, "nt": _2, "qld": _2, "sa": _2, "tas": _2, "vic": _2, "wa": _2 }], "gov": [1, { "qld": _2, "sa": _2, "tas": _2, "vic": _2, "wa": _2 }], "id": _2, "net": _2, "org": _2, "conf": _2, "oz": _2, "act": _2, "nsw": _2, "nt": _2, "qld": _2, "sa": _2, "tas": _2, "vic": _2, "wa": _2, "hrsn": [0, { "vps": _3 }] }], "aw": [1, { "com": _2 }], "ax": _2, "az": [1, { "biz": _2, "co": _2, "com": _2, "edu": _2, "gov": _2, "info": _2, "int": _2, "mil": _2, "name": _2, "net": _2, "org": _2, "pp": _2, "pro": _2 }], "ba": [1, { "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "brendly": _20, "rs": _3 }], "bb": [1, { "biz": _2, "co": _2, "com": _2, "edu": _2, "gov": _2, "info": _2, "net": _2, "org": _2, "store": _2, "tv": _2 }], "bd": [1, { "ac": _2, "ai": _2, "co": _2, "com": _2, "edu": _2, "gov": _2, "id": _2, "info": _2, "it": _2, "mil": _2, "net": _2, "org": _2, "sch": _2, "tv": _2 }], "be": [1, { "ac": _2, "cloudns": _3, "webhosting": _3, "interhostsolutions": [0, { "cloud": _3 }], "kuleuven": [0, { "ezproxy": _3 }], "my": _3, "123website": _3, "myspreadshop": _3, "transurl": _6 }], "bf": _10, "bg": [1, { "0": _2, "1": _2, "2": _2, "3": _2, "4": _2, "5": _2, "6": _2, "7": _2, "8": _2, "9": _2, "a": _2, "b": _2, "c": _2, "d": _2, "e": _2, "f": _2, "g": _2, "h": _2, "i": _2, "j": _2, "k": _2, "l": _2, "m": _2, "n": _2, "o": _2, "p": _2, "q": _2, "r": _2, "s": _2, "t": _2, "u": _2, "v": _2, "w": _2, "x": _2, "y": _2, "z": _2, "barsy": _3 }], "bh": _4, "bi": [1, { "co": _2, "com": _2, "edu": _2, "or": _2, "org": _2 }], "biz": [1, { "activetrail": _3, "cloud-ip": _3, "cloudns": _3, "jozi": _3, "dyndns": _3, "for-better": _3, "for-more": _3, "for-some": _3, "for-the": _3, "selfip": _3, "webhop": _3, "orx": _3, "mmafan": _3, "myftp": _3, "no-ip": _3, "dscloud": _3 }], "bj": [1, { "africa": _2, "agro": _2, "architectes": _2, "assur": _2, "avocats": _2, "co": _2, "com": _2, "eco": _2, "econo": _2, "edu": _2, "info": _2, "loisirs": _2, "money": _2, "net": _2, "org": _2, "ote": _2, "restaurant": _2, "resto": _2, "tourism": _2, "univ": _2 }], "bm": _4, "bn": [1, { "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "co": _3 }], "bo": [1, { "com": _2, "edu": _2, "gob": _2, "int": _2, "mil": _2, "net": _2, "org": _2, "tv": _2, "web": _2, "academia": _2, "agro": _2, "arte": _2, "blog": _2, "bolivia": _2, "ciencia": _2, "cooperativa": _2, "democracia": _2, "deporte": _2, "ecologia": _2, "economia": _2, "empresa": _2, "indigena": _2, "industria": _2, "info": _2, "medicina": _2, "movimiento": _2, "musica": _2, "natural": _2, "nombre": _2, "noticias": _2, "patria": _2, "plurinacional": _2, "politica": _2, "profesional": _2, "pueblo": _2, "revista": _2, "salud": _2, "tecnologia": _2, "tksat": _2, "transporte": _2, "wiki": _2 }], "br": [1, { "9guacu": _2, "abc": _2, "adm": _2, "adv": _2, "agr": _2, "aju": _2, "am": _2, "anani": _2, "aparecida": _2, "api": _2, "app": _2, "arq": _2, "art": _2, "ato": _2, "b": _2, "barueri": _2, "belem": _2, "bet": _2, "bhz": _2, "bib": _2, "bio": _2, "blog": _2, "bmd": _2, "boavista": _2, "bsb": _2, "campinagrande": _2, "campinas": _2, "caxias": _2, "cim": _2, "cng": _2, "cnt": _2, "com": [1, { "simplesite": _3 }], "contagem": _2, "coop": _2, "coz": _2, "cri": _2, "cuiaba": _2, "curitiba": _2, "def": _2, "des": _2, "det": _2, "dev": _2, "ecn": _2, "eco": _2, "edu": _2, "emp": _2, "enf": _2, "eng": _2, "esp": _2, "etc": _2, "eti": _2, "far": _2, "feira": _2, "flog": _2, "floripa": _2, "fm": _2, "fnd": _2, "fortal": _2, "fot": _2, "foz": _2, "fst": _2, "g12": _2, "geo": _2, "ggf": _2, "goiania": _2, "gov": [1, { "ac": _2, "al": _2, "am": _2, "ap": _2, "ba": _2, "ce": _2, "df": _2, "es": _2, "go": _2, "ma": _2, "mg": _2, "ms": _2, "mt": _2, "pa": _2, "pb": _2, "pe": _2, "pi": _2, "pr": _2, "rj": _2, "rn": _2, "ro": _2, "rr": _2, "rs": _2, "sc": _2, "se": _2, "sp": _2, "to": _2 }], "gru": _2, "ia": _2, "imb": _2, "ind": _2, "inf": _2, "jab": _2, "jampa": _2, "jdf": _2, "joinville": _2, "jor": _2, "jus": _2, "leg": [1, { "ac": _3, "al": _3, "am": _3, "ap": _3, "ba": _3, "ce": _3, "df": _3, "es": _3, "go": _3, "ma": _3, "mg": _3, "ms": _3, "mt": _3, "pa": _3, "pb": _3, "pe": _3, "pi": _3, "pr": _3, "rj": _3, "rn": _3, "ro": _3, "rr": _3, "rs": _3, "sc": _3, "se": _3, "sp": _3, "to": _3 }], "leilao": _2, "lel": _2, "log": _2, "londrina": _2, "macapa": _2, "maceio": _2, "manaus": _2, "maringa": _2, "mat": _2, "med": _2, "mil": _2, "morena": _2, "mp": _2, "mus": _2, "natal": _2, "net": _2, "niteroi": _2, "nom": _21, "not": _2, "ntr": _2, "odo": _2, "ong": _2, "org": _2, "osasco": _2, "palmas": _2, "poa": _2, "ppg": _2, "pro": _2, "psc": _2, "psi": _2, "pvh": _2, "qsl": _2, "radio": _2, "rec": _2, "recife": _2, "rep": _2, "ribeirao": _2, "rio": _2, "riobranco": _2, "riopreto": _2, "salvador": _2, "sampa": _2, "santamaria": _2, "santoandre": _2, "saobernardo": _2, "saogonca": _2, "seg": _2, "sjc": _2, "slg": _2, "slz": _2, "social": _2, "sorocaba": _2, "srv": _2, "taxi": _2, "tc": _2, "tec": _2, "teo": _2, "the": _2, "tmp": _2, "trd": _2, "tur": _2, "tv": _2, "udi": _2, "vet": _2, "vix": _2, "vlog": _2, "wiki": _2, "xyz": _2, "zlg": _2, "tche": _3 }], "bs": [1, { "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "we": _3 }], "bt": _4, "bv": _2, "bw": [1, { "ac": _2, "co": _2, "gov": _2, "net": _2, "org": _2 }], "by": [1, { "gov": _2, "mil": _2, "com": _2, "of": _2, "mediatech": _3 }], "bz": [1, { "co": _2, "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "za": _3, "mydns": _3, "gsj": _3 }], "ca": [1, { "ab": _2, "bc": _2, "mb": _2, "nb": _2, "nf": _2, "nl": _2, "ns": _2, "nt": _2, "nu": _2, "on": _2, "pe": _2, "qc": _2, "sk": _2, "yk": _2, "gc": _2, "barsy": _3, "awdev": _6, "co": _3, "no-ip": _3, "onid": _3, "myspreadshop": _3, "box": _3 }], "cat": _2, "cc": [1, { "cleverapps": _3, "cloud-ip": _3, "cloudns": _3, "ccwu": _3, "ftpaccess": _3, "game-server": _3, "myphotos": _3, "scrapping": _3, "twmail": _3, "csx": _3, "fantasyleague": _3, "spawn": [0, { "instances": _3 }], "ec": _3, "eu": _3, "gu": _3, "uk": _3, "us": _3 }], "cd": [1, { "gov": _2, "cc": _3 }], "cf": _2, "cg": _2, "ch": [1, { "square7": _3, "cloudns": _3, "cloudscale": [0, { "cust": _3, "lpg": _23, "rma": _23 }], "objectstorage": [0, { "lpg": _3, "rma": _3 }], "flow": [0, { "ae": [0, { "alp1": _3 }], "appengine": _3 }], "linkyard-cloud": _3, "gotdns": _3, "dnsking": _3, "123website": _3, "myspreadshop": _3, "firenet": [0, { "*": _3, "svc": _6 }], "12hp": _3, "2ix": _3, "4lima": _3, "lima-city": _3 }], "ci": [1, { "ac": _2, "xn--aroport-bya": _2, "a\xE9roport": _2, "asso": _2, "co": _2, "com": _2, "ed": _2, "edu": _2, "go": _2, "gouv": _2, "int": _2, "net": _2, "or": _2, "org": _2, "us": _3 }], "ck": _21, "cl": [1, { "co": _2, "gob": _2, "gov": _2, "mil": _2, "cloudns": _3 }], "cm": [1, { "co": _2, "com": _2, "gov": _2, "net": _2 }], "cn": [1, { "ac": _2, "com": [1, { "amazonaws": [0, { "cn-north-1": [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "rds": _6, "dualstack": _27, "s3": _3, "s3-accesspoint": _3, "s3-deprecated": _3, "s3-object-lambda": _3, "s3-website": _3 }], "cn-northwest-1": [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "rds": _6, "dualstack": _28, "s3": _3, "s3-accesspoint": _3, "s3-object-lambda": _3, "s3-website": _3 }], "compute": _6, "airflow": [0, { "cn-north-1": _6, "cn-northwest-1": _6 }], "eb": [0, { "cn-north-1": _3, "cn-northwest-1": _3 }], "elb": _6 }], "amazonwebservices": [0, { "on": [0, { "cn-north-1": _12, "cn-northwest-1": _12 }] }], "sagemaker": [0, { "cn-north-1": _15, "cn-northwest-1": _15 }] }], "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "xn--55qx5d": _2, "\u516C\u53F8": _2, "xn--od0alg": _2, "\u7DB2\u7D61": _2, "xn--io0a7i": _2, "\u7F51\u7EDC": _2, "ah": _2, "bj": _2, "cq": _2, "fj": _2, "gd": _2, "gs": _2, "gx": _2, "gz": _2, "ha": _2, "hb": _2, "he": _2, "hi": _2, "hk": _2, "hl": _2, "hn": _2, "jl": _2, "js": _2, "jx": _2, "ln": _2, "mo": _2, "nm": _2, "nx": _2, "qh": _2, "sc": _2, "sd": _2, "sh": [1, { "as": _3 }], "sn": _2, "sx": _2, "tj": _2, "tw": _2, "xj": _2, "xz": _2, "yn": _2, "zj": _2, "canva-apps": _3, "canvasite": _26, "myqnapcloud": _3, "quickconnect": _29 }], "co": [1, { "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "nom": _2, "org": _2, "carrd": _3, "crd": _3, "otap": _6, "hidns": _3, "leadpages": _3, "lpages": _3, "mypi": _3, "xmit": _6, "rdpa": [0, { "clusters": _6, "srvrless": _6 }], "firewalledreplit": _9, "repl": _9, "supabase": [2, { "realtime": _3, "storage": _3 }], "umso": _3 }], "com": [1, { "a2hosted": _3, "cpserver": _3, "adobeaemcloud": [2, { "dev": _6 }], "africa": _3, "auiusercontent": _6, "aivencloud": _3, "alibabacloudcs": _3, "kasserver": _3, "amazonaws": [0, { "af-south-1": _32, "ap-east-1": _33, "ap-northeast-1": _34, "ap-northeast-2": _34, "ap-northeast-3": _32, "ap-south-1": _34, "ap-south-2": _35, "ap-southeast-1": _34, "ap-southeast-2": _34, "ap-southeast-3": _35, "ap-southeast-4": _35, "ap-southeast-5": [0, { "execute-api": _3, "dualstack": _27, "s3": _3, "s3-accesspoint": _3, "s3-deprecated": _3, "s3-object-lambda": _3, "s3-website": _3 }], "ca-central-1": _37, "ca-west-1": _38, "eu-central-1": _34, "eu-central-2": _35, "eu-north-1": _33, "eu-south-1": _32, "eu-south-2": _35, "eu-west-1": [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "dualstack": _27, "s3": _3, "s3-accesspoint": _3, "s3-deprecated": _3, "s3-object-lambda": _3, "s3-website": _3, "analytics-gateway": _3, "aws-cloud9": _30, "cloud9": _31 }], "eu-west-2": _33, "eu-west-3": _32, "il-central-1": [0, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "dualstack": _27, "s3": _3, "s3-accesspoint": _3, "s3-object-lambda": _3, "s3-website": _3, "aws-cloud9": _30, "cloud9": [0, { "vfs": _3 }] }], "me-central-1": _35, "me-south-1": _33, "sa-east-1": _32, "us-east-1": [2, { "execute-api": _3, "emrappui-prod": _3, "emrnotebooks-prod": _3, "emrstudio-prod": _3, "dualstack": _36, "s3": _3, "s3-accesspoint": _3, "s3-accesspoint-fips": _3, "s3-deprecated": _3, "s3-fips": _3, "s3-object-lambda": _3, "s3-website": _3, "analytics-gateway": _3, "aws-cloud9": _30, "cloud9": _31 }], "us-east-2": _39, "us-gov-east-1": _38, "us-gov-west-1": _38, "us-west-1": _37, "us-west-2": _39, "compute": _6, "compute-1": _6, "airflow": [0, { "af-south-1": _6, "ap-east-1": _6, "ap-northeast-1": _6, "ap-northeast-2": _6, "ap-northeast-3": _6, "ap-south-1": _6, "ap-south-2": _6, "ap-southeast-1": _6, "ap-southeast-2": _6, "ap-southeast-3": _6, "ap-southeast-4": _6, "ap-southeast-5": _6, "ap-southeast-7": _6, "ca-central-1": _6, "ca-west-1": _6, "eu-central-1": _6, "eu-central-2": _6, "eu-north-1": _6, "eu-south-1": _6, "eu-south-2": _6, "eu-west-1": _6, "eu-west-2": _6, "eu-west-3": _6, "il-central-1": _6, "me-central-1": _6, "me-south-1": _6, "sa-east-1": _6, "us-east-1": _6, "us-east-2": _6, "us-west-1": _6, "us-west-2": _6 }], "rds": [0, { "af-south-1": _6, "ap-east-1": _6, "ap-east-2": _6, "ap-northeast-1": _6, "ap-northeast-2": _6, "ap-northeast-3": _6, "ap-south-1": _6, "ap-south-2": _6, "ap-southeast-1": _6, "ap-southeast-2": _6, "ap-southeast-3": _6, "ap-southeast-4": _6, "ap-southeast-5": _6, "ap-southeast-6": _6, "ap-southeast-7": _6, "ca-central-1": _6, "ca-west-1": _6, "eu-central-1": _6, "eu-central-2": _6, "eu-west-1": _6, "eu-west-2": _6, "eu-west-3": _6, "il-central-1": _6, "me-central-1": _6, "me-south-1": _6, "mx-central-1": _6, "sa-east-1": _6, "us-east-1": _6, "us-east-2": _6, "us-gov-east-1": _6, "us-gov-west-1": _6, "us-northeast-1": _6, "us-west-1": _6, "us-west-2": _6 }], "s3": _3, "s3-1": _3, "s3-ap-east-1": _3, "s3-ap-northeast-1": _3, "s3-ap-northeast-2": _3, "s3-ap-northeast-3": _3, "s3-ap-south-1": _3, "s3-ap-southeast-1": _3, "s3-ap-southeast-2": _3, "s3-ca-central-1": _3, "s3-eu-central-1": _3, "s3-eu-north-1": _3, "s3-eu-west-1": _3, "s3-eu-west-2": _3, "s3-eu-west-3": _3, "s3-external-1": _3, "s3-fips-us-gov-east-1": _3, "s3-fips-us-gov-west-1": _3, "s3-global": [0, { "accesspoint": [0, { "mrap": _3 }] }], "s3-me-south-1": _3, "s3-sa-east-1": _3, "s3-us-east-2": _3, "s3-us-gov-east-1": _3, "s3-us-gov-west-1": _3, "s3-us-west-1": _3, "s3-us-west-2": _3, "s3-website-ap-northeast-1": _3, "s3-website-ap-southeast-1": _3, "s3-website-ap-southeast-2": _3, "s3-website-eu-west-1": _3, "s3-website-sa-east-1": _3, "s3-website-us-east-1": _3, "s3-website-us-gov-west-1": _3, "s3-website-us-west-1": _3, "s3-website-us-west-2": _3, "elb": _6 }], "amazoncognito": [0, { "af-south-1": _40, "ap-east-1": _40, "ap-northeast-1": _40, "ap-northeast-2": _40, "ap-northeast-3": _40, "ap-south-1": _40, "ap-south-2": _40, "ap-southeast-1": _40, "ap-southeast-2": _40, "ap-southeast-3": _40, "ap-southeast-4": _40, "ap-southeast-5": _40, "ap-southeast-7": _40, "ca-central-1": _40, "ca-west-1": _40, "eu-central-1": _40, "eu-central-2": _40, "eu-north-1": _40, "eu-south-1": _40, "eu-south-2": _40, "eu-west-1": _40, "eu-west-2": _40, "eu-west-3": _40, "il-central-1": _40, "me-central-1": _40, "me-south-1": _40, "mx-central-1": _40, "sa-east-1": _40, "us-east-1": _41, "us-east-2": _41, "us-gov-east-1": _42, "us-gov-west-1": _42, "us-west-1": _41, "us-west-2": _41 }], "amplifyapp": _3, "awsapprunner": _6, "awsapps": _3, "elasticbeanstalk": [2, { "af-south-1": _3, "ap-east-1": _3, "ap-northeast-1": _3, "ap-northeast-2": _3, "ap-northeast-3": _3, "ap-south-1": _3, "ap-southeast-1": _3, "ap-southeast-2": _3, "ap-southeast-3": _3, "ap-southeast-5": _3, "ap-southeast-7": _3, "ca-central-1": _3, "eu-central-1": _3, "eu-north-1": _3, "eu-south-1": _3, "eu-south-2": _3, "eu-west-1": _3, "eu-west-2": _3, "eu-west-3": _3, "il-central-1": _3, "me-central-1": _3, "me-south-1": _3, "sa-east-1": _3, "us-east-1": _3, "us-east-2": _3, "us-gov-east-1": _3, "us-gov-west-1": _3, "us-west-1": _3, "us-west-2": _3 }], "awsglobalaccelerator": _3, "siiites": _3, "appspacehosted": _3, "appspaceusercontent": _3, "on-aptible": _3, "myasustor": _3, "balena-devices": _3, "boutir": _3, "bplaced": _3, "cafjs": _3, "canva-apps": _3, "canva-hosted-embed": _3, "canvacode": _3, "rice-labs": _3, "cdn77-storage": _3, "br": _3, "cn": _3, "de": _3, "eu": _3, "jpn": _3, "mex": _3, "ru": _3, "sa": _3, "uk": _3, "us": _3, "za": _3, "clever-cloud": [0, { "services": _6 }], "abrdns": _3, "dnsabr": _3, "ip-ddns": _3, "jdevcloud": _3, "wpdevcloud": _3, "cf-ipfs": _3, "cloudflare-ipfs": _3, "trycloudflare": _3, "co": _3, "devinapps": _6, "builtwithdark": _3, "datadetect": [0, { "demo": _3, "instance": _3 }], "dattolocal": _3, "dattorelay": _3, "dattoweb": _3, "mydatto": _3, "digitaloceanspaces": _6, "discordsays": _3, "discordsez": _3, "drayddns": _3, "dreamhosters": _3, "durumis": _3, "blogdns": _3, "cechire": _3, "dnsalias": _3, "dnsdojo": _3, "doesntexist": _3, "dontexist": _3, "doomdns": _3, "dyn-o-saur": _3, "dynalias": _3, "dyndns-at-home": _3, "dyndns-at-work": _3, "dyndns-blog": _3, "dyndns-free": _3, "dyndns-home": _3, "dyndns-ip": _3, "dyndns-mail": _3, "dyndns-office": _3, "dyndns-pics": _3, "dyndns-remote": _3, "dyndns-server": _3, "dyndns-web": _3, "dyndns-wiki": _3, "dyndns-work": _3, "est-a-la-maison": _3, "est-a-la-masion": _3, "est-le-patron": _3, "est-mon-blogueur": _3, "from-ak": _3, "from-al": _3, "from-ar": _3, "from-ca": _3, "from-ct": _3, "from-dc": _3, "from-de": _3, "from-fl": _3, "from-ga": _3, "from-hi": _3, "from-ia": _3, "from-id": _3, "from-il": _3, "from-in": _3, "from-ks": _3, "from-ky": _3, "from-ma": _3, "from-md": _3, "from-mi": _3, "from-mn": _3, "from-mo": _3, "from-ms": _3, "from-mt": _3, "from-nc": _3, "from-nd": _3, "from-ne": _3, "from-nh": _3, "from-nj": _3, "from-nm": _3, "from-nv": _3, "from-oh": _3, "from-ok": _3, "from-or": _3, "from-pa": _3, "from-pr": _3, "from-ri": _3, "from-sc": _3, "from-sd": _3, "from-tn": _3, "from-tx": _3, "from-ut": _3, "from-va": _3, "from-vt": _3, "from-wa": _3, "from-wi": _3, "from-wv": _3, "from-wy": _3, "getmyip": _3, "gotdns": _3, "hobby-site": _3, "homelinux": _3, "homeunix": _3, "iamallama": _3, "is-a-anarchist": _3, "is-a-blogger": _3, "is-a-bookkeeper": _3, "is-a-bulls-fan": _3, "is-a-caterer": _3, "is-a-chef": _3, "is-a-conservative": _3, "is-a-cpa": _3, "is-a-cubicle-slave": _3, "is-a-democrat": _3, "is-a-designer": _3, "is-a-doctor": _3, "is-a-financialadvisor": _3, "is-a-geek": _3, "is-a-green": _3, "is-a-guru": _3, "is-a-hard-worker": _3, "is-a-hunter": _3, "is-a-landscaper": _3, "is-a-lawyer": _3, "is-a-liberal": _3, "is-a-libertarian": _3, "is-a-llama": _3, "is-a-musician": _3, "is-a-nascarfan": _3, "is-a-nurse": _3, "is-a-painter": _3, "is-a-personaltrainer": _3, "is-a-photographer": _3, "is-a-player": _3, "is-a-republican": _3, "is-a-rockstar": _3, "is-a-socialist": _3, "is-a-student": _3, "is-a-teacher": _3, "is-a-techie": _3, "is-a-therapist": _3, "is-an-accountant": _3, "is-an-actor": _3, "is-an-actress": _3, "is-an-anarchist": _3, "is-an-artist": _3, "is-an-engineer": _3, "is-an-entertainer": _3, "is-certified": _3, "is-gone": _3, "is-into-anime": _3, "is-into-cars": _3, "is-into-cartoons": _3, "is-into-games": _3, "is-leet": _3, "is-not-certified": _3, "is-slick": _3, "is-uberleet": _3, "is-with-theband": _3, "isa-geek": _3, "isa-hockeynut": _3, "issmarterthanyou": _3, "likes-pie": _3, "likescandy": _3, "neat-url": _3, "saves-the-whales": _3, "selfip": _3, "sells-for-less": _3, "sells-for-u": _3, "servebbs": _3, "simple-url": _3, "space-to-rent": _3, "teaches-yoga": _3, "writesthisblog": _3, "1cooldns": _3, "bumbleshrimp": _3, "ddnsfree": _3, "ddnsgeek": _3, "ddnsguru": _3, "dynuddns": _3, "dynuhosting": _3, "giize": _3, "gleeze": _3, "kozow": _3, "loseyourip": _3, "ooguy": _3, "pivohosting": _3, "theworkpc": _3, "wiredbladehosting": _3, "emergentagent": [0, { "preview": _3 }], "mytuleap": _3, "tuleap-partners": _3, "encoreapi": _3, "evennode": [0, { "eu-1": _3, "eu-2": _3, "eu-3": _3, "eu-4": _3, "us-1": _3, "us-2": _3, "us-3": _3, "us-4": _3 }], "onfabrica": _3, "fastly-edge": _3, "fastly-terrarium": _3, "fastvps-server": _3, "mydobiss": _3, "firebaseapp": _3, "fldrv": _3, "framercanvas": _3, "freebox-os": _3, "freeboxos": _3, "freemyip": _3, "aliases121": _3, "gentapps": _3, "gentlentapis": _3, "githubusercontent": _3, "0emm": _6, "appspot": [2, { "r": _6 }], "blogspot": _3, "codespot": _3, "googleapis": _3, "googlecode": _3, "pagespeedmobilizer": _3, "withgoogle": _3, "withyoutube": _3, "grayjayleagues": _3, "hatenablog": _3, "hatenadiary": _3, "hercules-app": _3, "hercules-dev": _3, "herokuapp": _3, "gr": _3, "smushcdn": _3, "wphostedmail": _3, "wpmucdn": _3, "pixolino": _3, "apps-1and1": _3, "live-website": _3, "webspace-host": _3, "dopaas": _3, "hosted-by-previder": _44, "hosteur": [0, { "rag-cloud": _3, "rag-cloud-ch": _3 }], "ik-server": [0, { "jcloud": _3, "jcloud-ver-jpc": _3 }], "jelastic": [0, { "demo": _3 }], "massivegrid": _44, "wafaicloud": [0, { "jed": _3, "ryd": _3 }], "eu1-plenit": _3, "la1-plenit": _3, "us1-plenit": _3, "webadorsite": _3, "on-forge": _3, "on-vapor": _3, "lpusercontent": _3, "linode": [0, { "members": _3, "nodebalancer": _6 }], "linodeobjects": _6, "linodeusercontent": [0, { "ip": _3 }], "localtonet": _3, "lovableproject": _3, "barsycenter": _3, "barsyonline": _3, "lutrausercontent": _6, "magicpatternsapp": _3, "modelscape": _3, "mwcloudnonprod": _3, "polyspace": _3, "miniserver": _3, "atmeta": _3, "fbsbx": _43, "meteorapp": _45, "routingthecloud": _3, "same-app": _3, "same-preview": _3, "mydbserver": _3, "mochausercontent": _3, "hostedpi": _3, "mythic-beasts": [0, { "caracal": _3, "customer": _3, "fentiger": _3, "lynx": _3, "ocelot": _3, "oncilla": _3, "onza": _3, "sphinx": _3, "vs": _3, "x": _3, "yali": _3 }], "nospamproxy": [0, { "cloud": [2, { "o365": _3 }] }], "4u": _3, "nfshost": _3, "3utilities": _3, "blogsyte": _3, "ciscofreak": _3, "damnserver": _3, "ddnsking": _3, "ditchyourip": _3, "dnsiskinky": _3, "dynns": _3, "geekgalaxy": _3, "health-carereform": _3, "homesecuritymac": _3, "homesecuritypc": _3, "myactivedirectory": _3, "mysecuritycamera": _3, "myvnc": _3, "net-freaks": _3, "onthewifi": _3, "point2this": _3, "quicksytes": _3, "securitytactics": _3, "servebeer": _3, "servecounterstrike": _3, "serveexchange": _3, "serveftp": _3, "servegame": _3, "servehalflife": _3, "servehttp": _3, "servehumour": _3, "serveirc": _3, "servemp3": _3, "servep2p": _3, "servepics": _3, "servequake": _3, "servesarcasm": _3, "stufftoread": _3, "unusualperson": _3, "workisboring": _3, "myiphost": _3, "observableusercontent": [0, { "static": _3 }], "simplesite": _3, "oaiusercontent": _6, "orsites": _3, "operaunite": _3, "customer-oci": [0, { "*": _3, "oci": _6, "ocp": _6, "ocs": _6 }], "oraclecloudapps": _6, "oraclegovcloudapps": _6, "authgear-staging": _3, "authgearapps": _3, "outsystemscloud": _3, "ownprovider": _3, "pgfog": _3, "pagexl": _3, "gotpantheon": _3, "paywhirl": _6, "forgeblocks": _3, "upsunapp": _3, "postman-echo": _3, "prgmr": [0, { "xen": _3 }], "project-study": [0, { "dev": _3 }], "pythonanywhere": _45, "qa2": _3, "alpha-myqnapcloud": _3, "dev-myqnapcloud": _3, "mycloudnas": _3, "mynascloud": _3, "myqnapcloud": _3, "qualifioapp": _3, "ladesk": _3, "qualyhqpartner": _6, "qualyhqportal": _6, "qbuser": _3, "quipelements": _6, "rackmaze": _3, "readthedocs-hosted": _3, "rhcloud": _3, "onrender": _3, "render": _46, "subsc-pay": _3, "180r": _3, "dojin": _3, "sakuratan": _3, "sakuraweb": _3, "x0": _3, "code": [0, { "builder": _6, "dev-builder": _6, "stg-builder": _6 }], "salesforce": [0, { "platform": [0, { "code-builder-stg": [0, { "test": [0, { "001": _6 }] }] }] }], "logoip": _3, "scrysec": _3, "firewall-gateway": _3, "myshopblocks": _3, "myshopify": _3, "shopitsite": _3, "1kapp": _3, "appchizi": _3, "applinzi": _3, "sinaapp": _3, "vipsinaapp": _3, "streamlitapp": _3, "try-snowplow": _3, "playstation-cloud": _3, "myspreadshop": _3, "w-corp-staticblitz": _3, "w-credentialless-staticblitz": _3, "w-staticblitz": _3, "stackhero-network": _3, "stdlib": [0, { "api": _3 }], "strapiapp": [2, { "media": _3 }], "streak-link": _3, "streaklinks": _3, "streakusercontent": _3, "temp-dns": _3, "dsmynas": _3, "familyds": _3, "mytabit": _3, "taveusercontent": _3, "tb-hosting": _47, "reservd": _3, "thingdustdata": _3, "townnews-staging": _3, "typeform": [0, { "pro": _3 }], "hk": _3, "it": _3, "deus-canvas": _3, "vultrobjects": _6, "wafflecell": _3, "hotelwithflight": _3, "reserve-online": _3, "cprapid": _3, "pleskns": _3, "remotewd": _3, "wiardweb": [0, { "pages": _3 }], "drive-platform": _3, "base44-sandbox": _3, "wixsite": _3, "wixstudio": _3, "messwithdns": _3, "woltlab-demo": _3, "wpenginepowered": [2, { "js": _3 }], "xnbay": [2, { "u2": _3, "u2-local": _3 }], "xtooldevice": _3, "yolasite": _3 }], "coop": _2, "cr": [1, { "ac": _2, "co": _2, "ed": _2, "fi": _2, "go": _2, "or": _2, "sa": _2 }], "cu": [1, { "com": _2, "edu": _2, "gob": _2, "inf": _2, "nat": _2, "net": _2, "org": _2 }], "cv": [1, { "com": _2, "edu": _2, "id": _2, "int": _2, "net": _2, "nome": _2, "org": _2, "publ": _2 }], "cw": _48, "cx": [1, { "gov": _2, "cloudns": _3, "ath": _3, "info": _3, "assessments": _3, "calculators": _3, "funnels": _3, "paynow": _3, "quizzes": _3, "researched": _3, "tests": _3 }], "cy": [1, { "ac": _2, "biz": _2, "com": [1, { "scaleforce": _49 }], "ekloges": _2, "gov": _2, "ltd": _2, "mil": _2, "net": _2, "org": _2, "press": _2, "pro": _2, "tm": _2 }], "cz": [1, { "gov": _2, "contentproxy9": [0, { "rsc": _3 }], "realm": _3, "e4": _3, "co": _3, "metacentrum": [0, { "cloud": _6, "custom": _3 }], "muni": [0, { "cloud": [0, { "flt": _3, "usr": _3 }] }] }], "de": [1, { "bplaced": _3, "square7": _3, "bwcloud-os-instance": _6, "com": _3, "cosidns": _50, "dnsupdater": _3, "dynamisches-dns": _3, "internet-dns": _3, "l-o-g-i-n": _3, "ddnss": [2, { "dyn": _3, "dyndns": _3 }], "dyn-ip24": _3, "dyndns1": _3, "home-webserver": [2, { "dyn": _3 }], "myhome-server": _3, "dnshome": _3, "fuettertdasnetz": _3, "isteingeek": _3, "istmein": _3, "lebtimnetz": _3, "leitungsen": _3, "traeumtgerade": _3, "frusky": _6, "goip": _3, "xn--gnstigbestellen-zvb": _3, "g\xFCnstigbestellen": _3, "xn--gnstigliefern-wob": _3, "g\xFCnstigliefern": _3, "hs-heilbronn": [0, { "it": [0, { "pages": _3, "pages-research": _3 }] }], "dyn-berlin": _3, "in-berlin": _3, "in-brb": _3, "in-butter": _3, "in-dsl": _3, "in-vpn": _3, "iservschule": _3, "mein-iserv": _3, "schuldock": _3, "schulplattform": _3, "schulserver": _3, "test-iserv": _3, "keymachine": _3, "co": _3, "git-repos": _3, "lcube-server": _3, "svn-repos": _3, "barsy": _3, "webspaceconfig": _3, "123webseite": _3, "rub": _3, "ruhr-uni-bochum": [2, { "noc": [0, { "io": _3 }] }], "logoip": _3, "firewall-gateway": _3, "my-gateway": _3, "my-router": _3, "spdns": _3, "my": _3, "speedpartner": [0, { "customer": _3 }], "myspreadshop": _3, "taifun-dns": _3, "12hp": _3, "2ix": _3, "4lima": _3, "lima-city": _3, "virtual-user": _3, "virtualuser": _3, "community-pro": _3, "diskussionsbereich": _3, "xenonconnect": _6 }], "dj": _2, "dk": [1, { "biz": _3, "co": _3, "firm": _3, "reg": _3, "store": _3, "123hjemmeside": _3, "myspreadshop": _3 }], "dm": _52, "do": [1, { "art": _2, "com": _2, "edu": _2, "gob": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "sld": _2, "web": _2 }], "dz": [1, { "art": _2, "asso": _2, "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "pol": _2, "soc": _2, "tm": _2 }], "ec": [1, { "abg": _2, "adm": _2, "agron": _2, "arqt": _2, "art": _2, "bar": _2, "chef": _2, "com": _2, "cont": _2, "cpa": _2, "cue": _2, "dent": _2, "dgn": _2, "disco": _2, "doc": _2, "edu": _2, "eng": _2, "esm": _2, "fin": _2, "fot": _2, "gal": _2, "gob": _2, "gov": _2, "gye": _2, "ibr": _2, "info": _2, "k12": _2, "lat": _2, "loj": _2, "med": _2, "mil": _2, "mktg": _2, "mon": _2, "net": _2, "ntr": _2, "odont": _2, "org": _2, "pro": _2, "prof": _2, "psic": _2, "psiq": _2, "pub": _2, "rio": _2, "rrpp": _2, "sal": _2, "tech": _2, "tul": _2, "tur": _2, "uio": _2, "vet": _2, "xxx": _2, "base": _3, "official": _3 }], "edu": [1, { "rit": [0, { "git-pages": _3 }] }], "ee": [1, { "aip": _2, "com": _2, "edu": _2, "fie": _2, "gov": _2, "lib": _2, "med": _2, "org": _2, "pri": _2, "riik": _2 }], "eg": [1, { "ac": _2, "com": _2, "edu": _2, "eun": _2, "gov": _2, "info": _2, "me": _2, "mil": _2, "name": _2, "net": _2, "org": _2, "sci": _2, "sport": _2, "tv": _2 }], "er": _21, "es": [1, { "com": _2, "edu": _2, "gob": _2, "nom": _2, "org": _2, "123miweb": _3, "myspreadshop": _3 }], "et": [1, { "biz": _2, "com": _2, "edu": _2, "gov": _2, "info": _2, "name": _2, "net": _2, "org": _2 }], "eu": [1, { "amazonwebservices": [0, { "on": [0, { "eusc-de-east-1": [0, { "cognito-idp": _40 }] }] }], "cloudns": _3, "prvw": _3, "deuxfleurs": _3, "dogado": [0, { "jelastic": _3 }], "barsy": _3, "spdns": _3, "nxa": _6, "directwp": _3, "transurl": _6 }], "fi": [1, { "aland": _2, "dy": _3, "xn--hkkinen-5wa": _3, "h\xE4kkinen": _3, "iki": _3, "cloudplatform": [0, { "fi": _3 }], "datacenter": [0, { "demo": _3, "paas": _3 }], "kapsi": _3, "123kotisivu": _3, "myspreadshop": _3 }], "fj": [1, { "ac": _2, "biz": _2, "com": _2, "edu": _2, "gov": _2, "id": _2, "info": _2, "mil": _2, "name": _2, "net": _2, "org": _2, "pro": _2 }], "fk": _21, "fm": [1, { "com": _2, "edu": _2, "net": _2, "org": _2, "radio": _3, "user": _6 }], "fo": _2, "fr": [1, { "asso": _2, "com": _2, "gouv": _2, "nom": _2, "prd": _2, "tm": _2, "avoues": _2, "cci": _2, "greta": _2, "huissier-justice": _2, "fbx-os": _3, "fbxos": _3, "freebox-os": _3, "freeboxos": _3, "goupile": _3, "kdns": _3, "123siteweb": _3, "on-web": _3, "chirurgiens-dentistes-en-france": _3, "dedibox": _3, "aeroport": _3, "avocat": _3, "chambagri": _3, "chirurgiens-dentistes": _3, "experts-comptables": _3, "medecin": _3, "notaires": _3, "pharmacien": _3, "port": _3, "veterinaire": _3, "myspreadshop": _3, "ynh": _3 }], "ga": _2, "gb": _2, "gd": [1, { "edu": _2, "gov": _2 }], "ge": [1, { "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "pvt": _2, "school": _2 }], "gf": _2, "gg": [1, { "co": _2, "net": _2, "org": _2, "ply": [0, { "at": _6, "d6": _3 }], "botdash": _3, "kaas": _3, "stackit": _3, "panel": [2, { "daemon": _3 }] }], "gh": [1, { "biz": _2, "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2 }], "gi": [1, { "com": _2, "edu": _2, "gov": _2, "ltd": _2, "mod": _2, "org": _2 }], "gl": [1, { "co": _2, "com": _2, "edu": _2, "net": _2, "org": _2 }], "gm": _2, "gn": [1, { "ac": _2, "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2 }], "gov": _2, "gp": [1, { "asso": _2, "com": _2, "edu": _2, "mobi": _2, "net": _2, "org": _2 }], "gq": _2, "gr": [1, { "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "barsy": _3, "simplesite": _3 }], "gs": _2, "gt": [1, { "com": _2, "edu": _2, "gob": _2, "ind": _2, "mil": _2, "net": _2, "org": _2 }], "gu": [1, { "com": _2, "edu": _2, "gov": _2, "guam": _2, "info": _2, "net": _2, "org": _2, "web": _2 }], "gw": [1, { "nx": _3 }], "gy": _52, "hk": [1, { "com": _2, "edu": _2, "gov": _2, "idv": _2, "net": _2, "org": _2, "xn--ciqpn": _2, "\u4E2A\u4EBA": _2, "xn--gmqw5a": _2, "\u500B\u4EBA": _2, "xn--55qx5d": _2, "\u516C\u53F8": _2, "xn--mxtq1m": _2, "\u653F\u5E9C": _2, "xn--lcvr32d": _2, "\u654E\u80B2": _2, "xn--wcvs22d": _2, "\u6559\u80B2": _2, "xn--gmq050i": _2, "\u7B87\u4EBA": _2, "xn--uc0atv": _2, "\u7D44\u7E54": _2, "xn--uc0ay4a": _2, "\u7D44\u7EC7": _2, "xn--od0alg": _2, "\u7DB2\u7D61": _2, "xn--zf0avx": _2, "\u7DB2\u7EDC": _2, "xn--mk0axi": _2, "\u7EC4\u7E54": _2, "xn--tn0ag": _2, "\u7EC4\u7EC7": _2, "xn--od0aq3b": _2, "\u7F51\u7D61": _2, "xn--io0a7i": _2, "\u7F51\u7EDC": _2, "inc": _3, "ltd": _3 }], "hm": _2, "hn": [1, { "com": _2, "edu": _2, "gob": _2, "mil": _2, "net": _2, "org": _2 }], "hr": [1, { "com": _2, "from": _2, "iz": _2, "name": _2, "brendly": _20 }], "ht": [1, { "adult": _2, "art": _2, "asso": _2, "com": _2, "coop": _2, "edu": _2, "firm": _2, "gouv": _2, "info": _2, "med": _2, "net": _2, "org": _2, "perso": _2, "pol": _2, "pro": _2, "rel": _2, "shop": _2, "rt": _3 }], "hu": [1, { "2000": _2, "agrar": _2, "bolt": _2, "casino": _2, "city": _2, "co": _2, "erotica": _2, "erotika": _2, "film": _2, "forum": _2, "games": _2, "hotel": _2, "info": _2, "ingatlan": _2, "jogasz": _2, "konyvelo": _2, "lakas": _2, "media": _2, "news": _2, "org": _2, "priv": _2, "reklam": _2, "sex": _2, "shop": _2, "sport": _2, "suli": _2, "szex": _2, "tm": _2, "tozsde": _2, "utazas": _2, "video": _2 }], "id": [1, { "ac": _2, "biz": _2, "co": _2, "desa": _2, "go": _2, "kop": _2, "mil": _2, "my": _2, "net": _2, "or": _2, "ponpes": _2, "sch": _2, "web": _2, "xn--9tfky": _2, "\u1B29\u1B2E\u1B36": _2, "e": _3, "zone": _3 }], "ie": [1, { "gov": _2, "myspreadshop": _3 }], "il": [1, { "ac": _2, "co": [1, { "ravpage": _3, "mytabit": _3, "tabitorder": _3 }], "gov": _2, "idf": _2, "k12": _2, "muni": _2, "net": _2, "org": _2 }], "xn--4dbrk0ce": [1, { "xn--4dbgdty6c": _2, "xn--5dbhl8d": _2, "xn--8dbq2a": _2, "xn--hebda8b": _2 }], "\u05D9\u05E9\u05E8\u05D0\u05DC": [1, { "\u05D0\u05E7\u05D3\u05DE\u05D9\u05D4": _2, "\u05D9\u05E9\u05D5\u05D1": _2, "\u05E6\u05D4\u05DC": _2, "\u05DE\u05DE\u05E9\u05DC": _2 }], "im": [1, { "ac": _2, "co": [1, { "ltd": _2, "plc": _2 }], "com": _2, "net": _2, "org": _2, "tt": _2, "tv": _2 }], "in": [1, { "5g": _2, "6g": _2, "ac": _2, "ai": _2, "am": _2, "bank": _2, "bihar": _2, "biz": _2, "business": _2, "ca": _2, "cn": _2, "co": _2, "com": _2, "coop": _2, "cs": _2, "delhi": _2, "dr": _2, "edu": _2, "er": _2, "fin": _2, "firm": _2, "gen": _2, "gov": _2, "gujarat": _2, "ind": _2, "info": _2, "int": _2, "internet": _2, "io": _2, "me": _2, "mil": _2, "net": _2, "nic": _2, "org": _2, "pg": _2, "post": _2, "pro": _2, "res": _2, "travel": _2, "tv": _2, "uk": _2, "up": _2, "us": _2, "cloudns": _3, "barsy": _3, "web": _3, "indevs": _3, "supabase": _3 }], "info": [1, { "cloudns": _3, "dynamic-dns": _3, "barrel-of-knowledge": _3, "barrell-of-knowledge": _3, "dyndns": _3, "for-our": _3, "groks-the": _3, "groks-this": _3, "here-for-more": _3, "knowsitall": _3, "selfip": _3, "webhop": _3, "barsy": _3, "mayfirst": _3, "mittwald": _3, "mittwaldserver": _3, "typo3server": _3, "dvrcam": _3, "ilovecollege": _3, "no-ip": _3, "forumz": _3, "nsupdate": _3, "dnsupdate": _3, "v-info": _3 }], "int": [1, { "eu": _2 }], "io": [1, { "2038": _3, "co": _2, "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "nom": _2, "org": _2, "on-acorn": _6, "myaddr": _3, "apigee": _3, "b-data": _3, "beagleboard": _3, "bitbucket": _3, "bluebite": _3, "boxfuse": _3, "brave": _7, "browsersafetymark": _3, "bubble": _56, "bubbleapps": _3, "bigv": [0, { "uk0": _3 }], "cleverapps": _3, "cloudbeesusercontent": _3, "dappnode": [0, { "dyndns": _3 }], "darklang": _3, "definima": _3, "dedyn": _3, "icp0": _57, "icp1": _57, "qzz": _3, "fh-muenster": _3, "gitbook": _3, "github": _3, "gitlab": _3, "lolipop": _3, "hasura-app": _3, "hostyhosting": _3, "hypernode": _3, "moonscale": _6, "beebyte": _44, "beebyteapp": [0, { "sekd1": _3 }], "jele": _3, "keenetic": _3, "kiloapps": _3, "webthings": _3, "loginline": _3, "barsy": _3, "azurecontainer": _6, "ngrok": [2, { "ap": _3, "au": _3, "eu": _3, "in": _3, "jp": _3, "sa": _3, "us": _3 }], "nodeart": [0, { "stage": _3 }], "pantheonsite": _3, "forgerock": [0, { "id": _3 }], "pstmn": [2, { "mock": _3 }], "protonet": _3, "qcx": [2, { "sys": _6 }], "qoto": _3, "vaporcloud": _3, "myrdbx": _3, "rb-hosting": _47, "on-k3s": _6, "on-rio": _6, "readthedocs": _3, "resindevice": _3, "resinstaging": [0, { "devices": _3 }], "hzc": _3, "sandcats": _3, "scrypted": [0, { "client": _3 }], "mo-siemens": _3, "lair": _43, "stolos": _6, "musician": _3, "utwente": _3, "edugit": _3, "telebit": _3, "thingdust": [0, { "dev": _58, "disrec": _58, "prod": _59, "testing": _58 }], "tickets": _3, "webflow": _3, "webflowtest": _3, "drive-platform": _3, "editorx": _3, "wixstudio": _3, "basicserver": _3, "virtualserver": _3 }], "iq": _5, "ir": [1, { "ac": _2, "co": _2, "gov": _2, "id": _2, "net": _2, "org": _2, "sch": _2, "xn--mgba3a4f16a": _2, "\u0627\u06CC\u0631\u0627\u0646": _2, "xn--mgba3a4fra": _2, "\u0627\u064A\u0631\u0627\u0646": _2, "arvanedge": _3, "vistablog": _3 }], "is": _2, "it": [1, { "edu": _2, "gov": _2, "abr": _2, "abruzzo": _2, "aosta-valley": _2, "aostavalley": _2, "bas": _2, "basilicata": _2, "cal": _2, "calabria": _2, "cam": _2, "campania": _2, "emilia-romagna": _2, "emiliaromagna": _2, "emr": _2, "friuli-v-giulia": _2, "friuli-ve-giulia": _2, "friuli-vegiulia": _2, "friuli-venezia-giulia": _2, "friuli-veneziagiulia": _2, "friuli-vgiulia": _2, "friuliv-giulia": _2, "friulive-giulia": _2, "friulivegiulia": _2, "friulivenezia-giulia": _2, "friuliveneziagiulia": _2, "friulivgiulia": _2, "fvg": _2, "laz": _2, "lazio": _2, "lig": _2, "liguria": _2, "lom": _2, "lombardia": _2, "lombardy": _2, "lucania": _2, "mar": _2, "marche": _2, "mol": _2, "molise": _2, "piedmont": _2, "piemonte": _2, "pmn": _2, "pug": _2, "puglia": _2, "sar": _2, "sardegna": _2, "sardinia": _2, "sic": _2, "sicilia": _2, "sicily": _2, "taa": _2, "tos": _2, "toscana": _2, "trentin-sud-tirol": _2, "xn--trentin-sd-tirol-rzb": _2, "trentin-s\xFCd-tirol": _2, "trentin-sudtirol": _2, "xn--trentin-sdtirol-7vb": _2, "trentin-s\xFCdtirol": _2, "trentin-sued-tirol": _2, "trentin-suedtirol": _2, "trentino": _2, "trentino-a-adige": _2, "trentino-aadige": _2, "trentino-alto-adige": _2, "trentino-altoadige": _2, "trentino-s-tirol": _2, "trentino-stirol": _2, "trentino-sud-tirol": _2, "xn--trentino-sd-tirol-c3b": _2, "trentino-s\xFCd-tirol": _2, "trentino-sudtirol": _2, "xn--trentino-sdtirol-szb": _2, "trentino-s\xFCdtirol": _2, "trentino-sued-tirol": _2, "trentino-suedtirol": _2, "trentinoa-adige": _2, "trentinoaadige": _2, "trentinoalto-adige": _2, "trentinoaltoadige": _2, "trentinos-tirol": _2, "trentinostirol": _2, "trentinosud-tirol": _2, "xn--trentinosd-tirol-rzb": _2, "trentinos\xFCd-tirol": _2, "trentinosudtirol": _2, "xn--trentinosdtirol-7vb": _2, "trentinos\xFCdtirol": _2, "trentinosued-tirol": _2, "trentinosuedtirol": _2, "trentinsud-tirol": _2, "xn--trentinsd-tirol-6vb": _2, "trentins\xFCd-tirol": _2, "trentinsudtirol": _2, "xn--trentinsdtirol-nsb": _2, "trentins\xFCdtirol": _2, "trentinsued-tirol": _2, "trentinsuedtirol": _2, "tuscany": _2, "umb": _2, "umbria": _2, "val-d-aosta": _2, "val-daosta": _2, "vald-aosta": _2, "valdaosta": _2, "valle-aosta": _2, "valle-d-aosta": _2, "valle-daosta": _2, "valleaosta": _2, "valled-aosta": _2, "valledaosta": _2, "vallee-aoste": _2, "xn--valle-aoste-ebb": _2, "vall\xE9e-aoste": _2, "vallee-d-aoste": _2, "xn--valle-d-aoste-ehb": _2, "vall\xE9e-d-aoste": _2, "valleeaoste": _2, "xn--valleaoste-e7a": _2, "vall\xE9eaoste": _2, "valleedaoste": _2, "xn--valledaoste-ebb": _2, "vall\xE9edaoste": _2, "vao": _2, "vda": _2, "ven": _2, "veneto": _2, "ag": _2, "agrigento": _2, "al": _2, "alessandria": _2, "alto-adige": _2, "altoadige": _2, "an": _2, "ancona": _2, "andria-barletta-trani": _2, "andria-trani-barletta": _2, "andriabarlettatrani": _2, "andriatranibarletta": _2, "ao": _2, "aosta": _2, "aoste": _2, "ap": _2, "aq": _2, "aquila": _2, "ar": _2, "arezzo": _2, "ascoli-piceno": _2, "ascolipiceno": _2, "asti": _2, "at": _2, "av": _2, "avellino": _2, "ba": _2, "balsan": _2, "balsan-sudtirol": _2, "xn--balsan-sdtirol-nsb": _2, "balsan-s\xFCdtirol": _2, "balsan-suedtirol": _2, "bari": _2, "barletta-trani-andria": _2, "barlettatraniandria": _2, "belluno": _2, "benevento": _2, "bergamo": _2, "bg": _2, "bi": _2, "biella": _2, "bl": _2, "bn": _2, "bo": _2, "bologna": _2, "bolzano": _2, "bolzano-altoadige": _2, "bozen": _2, "bozen-sudtirol": _2, "xn--bozen-sdtirol-2ob": _2, "bozen-s\xFCdtirol": _2, "bozen-suedtirol": _2, "br": _2, "brescia": _2, "brindisi": _2, "bs": _2, "bt": _2, "bulsan": _2, "bulsan-sudtirol": _2, "xn--bulsan-sdtirol-nsb": _2, "bulsan-s\xFCdtirol": _2, "bulsan-suedtirol": _2, "bz": _2, "ca": _2, "cagliari": _2, "caltanissetta": _2, "campidano-medio": _2, "campidanomedio": _2, "campobasso": _2, "carbonia-iglesias": _2, "carboniaiglesias": _2, "carrara-massa": _2, "carraramassa": _2, "caserta": _2, "catania": _2, "catanzaro": _2, "cb": _2, "ce": _2, "cesena-forli": _2, "xn--cesena-forl-mcb": _2, "cesena-forl\xEC": _2, "cesenaforli": _2, "xn--cesenaforl-i8a": _2, "cesenaforl\xEC": _2, "ch": _2, "chieti": _2, "ci": _2, "cl": _2, "cn": _2, "co": _2, "como": _2, "cosenza": _2, "cr": _2, "cremona": _2, "crotone": _2, "cs": _2, "ct": _2, "cuneo": _2, "cz": _2, "dell-ogliastra": _2, "dellogliastra": _2, "en": _2, "enna": _2, "fc": _2, "fe": _2, "fermo": _2, "ferrara": _2, "fg": _2, "fi": _2, "firenze": _2, "florence": _2, "fm": _2, "foggia": _2, "forli-cesena": _2, "xn--forl-cesena-fcb": _2, "forl\xEC-cesena": _2, "forlicesena": _2, "xn--forlcesena-c8a": _2, "forl\xECcesena": _2, "fr": _2, "frosinone": _2, "ge": _2, "genoa": _2, "genova": _2, "go": _2, "gorizia": _2, "gr": _2, "grosseto": _2, "iglesias-carbonia": _2, "iglesiascarbonia": _2, "im": _2, "imperia": _2, "is": _2, "isernia": _2, "kr": _2, "la-spezia": _2, "laquila": _2, "laspezia": _2, "latina": _2, "lc": _2, "le": _2, "lecce": _2, "lecco": _2, "li": _2, "livorno": _2, "lo": _2, "lodi": _2, "lt": _2, "lu": _2, "lucca": _2, "macerata": _2, "mantova": _2, "massa-carrara": _2, "massacarrara": _2, "matera": _2, "mb": _2, "mc": _2, "me": _2, "medio-campidano": _2, "mediocampidano": _2, "messina": _2, "mi": _2, "milan": _2, "milano": _2, "mn": _2, "mo": _2, "modena": _2, "monza": _2, "monza-brianza": _2, "monza-e-della-brianza": _2, "monzabrianza": _2, "monzaebrianza": _2, "monzaedellabrianza": _2, "ms": _2, "mt": _2, "na": _2, "naples": _2, "napoli": _2, "no": _2, "novara": _2, "nu": _2, "nuoro": _2, "og": _2, "ogliastra": _2, "olbia-tempio": _2, "olbiatempio": _2, "or": _2, "oristano": _2, "ot": _2, "pa": _2, "padova": _2, "padua": _2, "palermo": _2, "parma": _2, "pavia": _2, "pc": _2, "pd": _2, "pe": _2, "perugia": _2, "pesaro-urbino": _2, "pesarourbino": _2, "pescara": _2, "pg": _2, "pi": _2, "piacenza": _2, "pisa": _2, "pistoia": _2, "pn": _2, "po": _2, "pordenone": _2, "potenza": _2, "pr": _2, "prato": _2, "pt": _2, "pu": _2, "pv": _2, "pz": _2, "ra": _2, "ragusa": _2, "ravenna": _2, "rc": _2, "re": _2, "reggio-calabria": _2, "reggio-emilia": _2, "reggiocalabria": _2, "reggioemilia": _2, "rg": _2, "ri": _2, "rieti": _2, "rimini": _2, "rm": _2, "rn": _2, "ro": _2, "roma": _2, "rome": _2, "rovigo": _2, "sa": _2, "salerno": _2, "sassari": _2, "savona": _2, "si": _2, "siena": _2, "siracusa": _2, "so": _2, "sondrio": _2, "sp": _2, "sr": _2, "ss": _2, "xn--sdtirol-n2a": _2, "s\xFCdtirol": _2, "suedtirol": _2, "sv": _2, "ta": _2, "taranto": _2, "te": _2, "tempio-olbia": _2, "tempioolbia": _2, "teramo": _2, "terni": _2, "tn": _2, "to": _2, "torino": _2, "tp": _2, "tr": _2, "trani-andria-barletta": _2, "trani-barletta-andria": _2, "traniandriabarletta": _2, "tranibarlettaandria": _2, "trapani": _2, "trento": _2, "treviso": _2, "trieste": _2, "ts": _2, "turin": _2, "tv": _2, "ud": _2, "udine": _2, "urbino-pesaro": _2, "urbinopesaro": _2, "va": _2, "varese": _2, "vb": _2, "vc": _2, "ve": _2, "venezia": _2, "venice": _2, "verbania": _2, "vercelli": _2, "verona": _2, "vi": _2, "vibo-valentia": _2, "vibovalentia": _2, "vicenza": _2, "viterbo": _2, "vr": _2, "vs": _2, "vt": _2, "vv": _2, "ibxos": _3, "iliadboxos": _3, "neen": [0, { "jc": _3 }], "123homepage": _3, "16-b": _3, "32-b": _3, "64-b": _3, "myspreadshop": _3, "syncloud": _3 }], "je": [1, { "co": _2, "net": _2, "org": _2, "of": _3 }], "jm": _21, "jo": [1, { "agri": _2, "ai": _2, "com": _2, "edu": _2, "eng": _2, "fm": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "per": _2, "phd": _2, "sch": _2, "tv": _2 }], "jobs": _2, "jp": [1, { "ac": _2, "ad": _2, "co": _2, "ed": _2, "go": _2, "gr": _2, "lg": _2, "ne": [1, { "aseinet": _54, "gehirn": _3, "ivory": _3, "mail-box": _3, "mints": _3, "mokuren": _3, "opal": _3, "sakura": _3, "sumomo": _3, "topaz": _3 }], "or": _2, "aichi": [1, { "aisai": _2, "ama": _2, "anjo": _2, "asuke": _2, "chiryu": _2, "chita": _2, "fuso": _2, "gamagori": _2, "handa": _2, "hazu": _2, "hekinan": _2, "higashiura": _2, "ichinomiya": _2, "inazawa": _2, "inuyama": _2, "isshiki": _2, "iwakura": _2, "kanie": _2, "kariya": _2, "kasugai": _2, "kira": _2, "kiyosu": _2, "komaki": _2, "konan": _2, "kota": _2, "mihama": _2, "miyoshi": _2, "nishio": _2, "nisshin": _2, "obu": _2, "oguchi": _2, "oharu": _2, "okazaki": _2, "owariasahi": _2, "seto": _2, "shikatsu": _2, "shinshiro": _2, "shitara": _2, "tahara": _2, "takahama": _2, "tobishima": _2, "toei": _2, "togo": _2, "tokai": _2, "tokoname": _2, "toyoake": _2, "toyohashi": _2, "toyokawa": _2, "toyone": _2, "toyota": _2, "tsushima": _2, "yatomi": _2 }], "akita": [1, { "akita": _2, "daisen": _2, "fujisato": _2, "gojome": _2, "hachirogata": _2, "happou": _2, "higashinaruse": _2, "honjo": _2, "honjyo": _2, "ikawa": _2, "kamikoani": _2, "kamioka": _2, "katagami": _2, "kazuno": _2, "kitaakita": _2, "kosaka": _2, "kyowa": _2, "misato": _2, "mitane": _2, "moriyoshi": _2, "nikaho": _2, "noshiro": _2, "odate": _2, "oga": _2, "ogata": _2, "semboku": _2, "yokote": _2, "yurihonjo": _2 }], "aomori": [1, { "aomori": _2, "gonohe": _2, "hachinohe": _2, "hashikami": _2, "hiranai": _2, "hirosaki": _2, "itayanagi": _2, "kuroishi": _2, "misawa": _2, "mutsu": _2, "nakadomari": _2, "noheji": _2, "oirase": _2, "owani": _2, "rokunohe": _2, "sannohe": _2, "shichinohe": _2, "shingo": _2, "takko": _2, "towada": _2, "tsugaru": _2, "tsuruta": _2 }], "chiba": [1, { "abiko": _2, "asahi": _2, "chonan": _2, "chosei": _2, "choshi": _2, "chuo": _2, "funabashi": _2, "futtsu": _2, "hanamigawa": _2, "ichihara": _2, "ichikawa": _2, "ichinomiya": _2, "inzai": _2, "isumi": _2, "kamagaya": _2, "kamogawa": _2, "kashiwa": _2, "katori": _2, "katsuura": _2, "kimitsu": _2, "kisarazu": _2, "kozaki": _2, "kujukuri": _2, "kyonan": _2, "matsudo": _2, "midori": _2, "mihama": _2, "minamiboso": _2, "mobara": _2, "mutsuzawa": _2, "nagara": _2, "nagareyama": _2, "narashino": _2, "narita": _2, "noda": _2, "oamishirasato": _2, "omigawa": _2, "onjuku": _2, "otaki": _2, "sakae": _2, "sakura": _2, "shimofusa": _2, "shirako": _2, "shiroi": _2, "shisui": _2, "sodegaura": _2, "sosa": _2, "tako": _2, "tateyama": _2, "togane": _2, "tohnosho": _2, "tomisato": _2, "urayasu": _2, "yachimata": _2, "yachiyo": _2, "yokaichiba": _2, "yokoshibahikari": _2, "yotsukaido": _2 }], "ehime": [1, { "ainan": _2, "honai": _2, "ikata": _2, "imabari": _2, "iyo": _2, "kamijima": _2, "kihoku": _2, "kumakogen": _2, "masaki": _2, "matsuno": _2, "matsuyama": _2, "namikata": _2, "niihama": _2, "ozu": _2, "saijo": _2, "seiyo": _2, "shikokuchuo": _2, "tobe": _2, "toon": _2, "uchiko": _2, "uwajima": _2, "yawatahama": _2 }], "fukui": [1, { "echizen": _2, "eiheiji": _2, "fukui": _2, "ikeda": _2, "katsuyama": _2, "mihama": _2, "minamiechizen": _2, "obama": _2, "ohi": _2, "ono": _2, "sabae": _2, "sakai": _2, "takahama": _2, "tsuruga": _2, "wakasa": _2 }], "fukuoka": [1, { "ashiya": _2, "buzen": _2, "chikugo": _2, "chikuho": _2, "chikujo": _2, "chikushino": _2, "chikuzen": _2, "chuo": _2, "dazaifu": _2, "fukuchi": _2, "hakata": _2, "higashi": _2, "hirokawa": _2, "hisayama": _2, "iizuka": _2, "inatsuki": _2, "kaho": _2, "kasuga": _2, "kasuya": _2, "kawara": _2, "keisen": _2, "koga": _2, "kurate": _2, "kurogi": _2, "kurume": _2, "minami": _2, "miyako": _2, "miyama": _2, "miyawaka": _2, "mizumaki": _2, "munakata": _2, "nakagawa": _2, "nakama": _2, "nishi": _2, "nogata": _2, "ogori": _2, "okagaki": _2, "okawa": _2, "oki": _2, "omuta": _2, "onga": _2, "onojo": _2, "oto": _2, "saigawa": _2, "sasaguri": _2, "shingu": _2, "shinyoshitomi": _2, "shonai": _2, "soeda": _2, "sue": _2, "tachiarai": _2, "tagawa": _2, "takata": _2, "toho": _2, "toyotsu": _2, "tsuiki": _2, "ukiha": _2, "umi": _2, "usui": _2, "yamada": _2, "yame": _2, "yanagawa": _2, "yukuhashi": _2 }], "fukushima": [1, { "aizubange": _2, "aizumisato": _2, "aizuwakamatsu": _2, "asakawa": _2, "bandai": _2, "date": _2, "fukushima": _2, "furudono": _2, "futaba": _2, "hanawa": _2, "higashi": _2, "hirata": _2, "hirono": _2, "iitate": _2, "inawashiro": _2, "ishikawa": _2, "iwaki": _2, "izumizaki": _2, "kagamiishi": _2, "kaneyama": _2, "kawamata": _2, "kitakata": _2, "kitashiobara": _2, "koori": _2, "koriyama": _2, "kunimi": _2, "miharu": _2, "mishima": _2, "namie": _2, "nango": _2, "nishiaizu": _2, "nishigo": _2, "okuma": _2, "omotego": _2, "ono": _2, "otama": _2, "samegawa": _2, "shimogo": _2, "shirakawa": _2, "showa": _2, "soma": _2, "sukagawa": _2, "taishin": _2, "tamakawa": _2, "tanagura": _2, "tenei": _2, "yabuki": _2, "yamato": _2, "yamatsuri": _2, "yanaizu": _2, "yugawa": _2 }], "gifu": [1, { "anpachi": _2, "ena": _2, "gifu": _2, "ginan": _2, "godo": _2, "gujo": _2, "hashima": _2, "hichiso": _2, "hida": _2, "higashishirakawa": _2, "ibigawa": _2, "ikeda": _2, "kakamigahara": _2, "kani": _2, "kasahara": _2, "kasamatsu": _2, "kawaue": _2, "kitagata": _2, "mino": _2, "minokamo": _2, "mitake": _2, "mizunami": _2, "motosu": _2, "nakatsugawa": _2, "ogaki": _2, "sakahogi": _2, "seki": _2, "sekigahara": _2, "shirakawa": _2, "tajimi": _2, "takayama": _2, "tarui": _2, "toki": _2, "tomika": _2, "wanouchi": _2, "yamagata": _2, "yaotsu": _2, "yoro": _2 }], "gunma": [1, { "annaka": _2, "chiyoda": _2, "fujioka": _2, "higashiagatsuma": _2, "isesaki": _2, "itakura": _2, "kanna": _2, "kanra": _2, "katashina": _2, "kawaba": _2, "kiryu": _2, "kusatsu": _2, "maebashi": _2, "meiwa": _2, "midori": _2, "minakami": _2, "naganohara": _2, "nakanojo": _2, "nanmoku": _2, "numata": _2, "oizumi": _2, "ora": _2, "ota": _2, "shibukawa": _2, "shimonita": _2, "shinto": _2, "showa": _2, "takasaki": _2, "takayama": _2, "tamamura": _2, "tatebayashi": _2, "tomioka": _2, "tsukiyono": _2, "tsumagoi": _2, "ueno": _2, "yoshioka": _2 }], "hiroshima": [1, { "asaminami": _2, "daiwa": _2, "etajima": _2, "fuchu": _2, "fukuyama": _2, "hatsukaichi": _2, "higashihiroshima": _2, "hongo": _2, "jinsekikogen": _2, "kaita": _2, "kui": _2, "kumano": _2, "kure": _2, "mihara": _2, "miyoshi": _2, "naka": _2, "onomichi": _2, "osakikamijima": _2, "otake": _2, "saka": _2, "sera": _2, "seranishi": _2, "shinichi": _2, "shobara": _2, "takehara": _2 }], "hokkaido": [1, { "abashiri": _2, "abira": _2, "aibetsu": _2, "akabira": _2, "akkeshi": _2, "asahikawa": _2, "ashibetsu": _2, "ashoro": _2, "assabu": _2, "atsuma": _2, "bibai": _2, "biei": _2, "bifuka": _2, "bihoro": _2, "biratori": _2, "chippubetsu": _2, "chitose": _2, "date": _2, "ebetsu": _2, "embetsu": _2, "eniwa": _2, "erimo": _2, "esan": _2, "esashi": _2, "fukagawa": _2, "fukushima": _2, "furano": _2, "furubira": _2, "haboro": _2, "hakodate": _2, "hamatonbetsu": _2, "hidaka": _2, "higashikagura": _2, "higashikawa": _2, "hiroo": _2, "hokuryu": _2, "hokuto": _2, "honbetsu": _2, "horokanai": _2, "horonobe": _2, "ikeda": _2, "imakane": _2, "ishikari": _2, "iwamizawa": _2, "iwanai": _2, "kamifurano": _2, "kamikawa": _2, "kamishihoro": _2, "kamisunagawa": _2, "kamoenai": _2, "kayabe": _2, "kembuchi": _2, "kikonai": _2, "kimobetsu": _2, "kitahiroshima": _2, "kitami": _2, "kiyosato": _2, "koshimizu": _2, "kunneppu": _2, "kuriyama": _2, "kuromatsunai": _2, "kushiro": _2, "kutchan": _2, "kyowa": _2, "mashike": _2, "matsumae": _2, "mikasa": _2, "minamifurano": _2, "mombetsu": _2, "moseushi": _2, "mukawa": _2, "muroran": _2, "naie": _2, "nakagawa": _2, "nakasatsunai": _2, "nakatombetsu": _2, "nanae": _2, "nanporo": _2, "nayoro": _2, "nemuro": _2, "niikappu": _2, "niki": _2, "nishiokoppe": _2, "noboribetsu": _2, "numata": _2, "obihiro": _2, "obira": _2, "oketo": _2, "okoppe": _2, "otaru": _2, "otobe": _2, "otofuke": _2, "otoineppu": _2, "oumu": _2, "ozora": _2, "pippu": _2, "rankoshi": _2, "rebun": _2, "rikubetsu": _2, "rishiri": _2, "rishirifuji": _2, "saroma": _2, "sarufutsu": _2, "shakotan": _2, "shari": _2, "shibecha": _2, "shibetsu": _2, "shikabe": _2, "shikaoi": _2, "shimamaki": _2, "shimizu": _2, "shimokawa": _2, "shinshinotsu": _2, "shintoku": _2, "shiranuka": _2, "shiraoi": _2, "shiriuchi": _2, "sobetsu": _2, "sunagawa": _2, "taiki": _2, "takasu": _2, "takikawa": _2, "takinoue": _2, "teshikaga": _2, "tobetsu": _2, "tohma": _2, "tomakomai": _2, "tomari": _2, "toya": _2, "toyako": _2, "toyotomi": _2, "toyoura": _2, "tsubetsu": _2, "tsukigata": _2, "urakawa": _2, "urausu": _2, "uryu": _2, "utashinai": _2, "wakkanai": _2, "wassamu": _2, "yakumo": _2, "yoichi": _2 }], "hyogo": [1, { "aioi": _2, "akashi": _2, "ako": _2, "amagasaki": _2, "aogaki": _2, "asago": _2, "ashiya": _2, "awaji": _2, "fukusaki": _2, "goshiki": _2, "harima": _2, "himeji": _2, "ichikawa": _2, "inagawa": _2, "itami": _2, "kakogawa": _2, "kamigori": _2, "kamikawa": _2, "kasai": _2, "kasuga": _2, "kawanishi": _2, "miki": _2, "minamiawaji": _2, "nishinomiya": _2, "nishiwaki": _2, "ono": _2, "sanda": _2, "sannan": _2, "sasayama": _2, "sayo": _2, "shingu": _2, "shinonsen": _2, "shiso": _2, "sumoto": _2, "taishi": _2, "taka": _2, "takarazuka": _2, "takasago": _2, "takino": _2, "tamba": _2, "tatsuno": _2, "toyooka": _2, "yabu": _2, "yashiro": _2, "yoka": _2, "yokawa": _2 }], "ibaraki": [1, { "ami": _2, "asahi": _2, "bando": _2, "chikusei": _2, "daigo": _2, "fujishiro": _2, "hitachi": _2, "hitachinaka": _2, "hitachiomiya": _2, "hitachiota": _2, "ibaraki": _2, "ina": _2, "inashiki": _2, "itako": _2, "iwama": _2, "joso": _2, "kamisu": _2, "kasama": _2, "kashima": _2, "kasumigaura": _2, "koga": _2, "miho": _2, "mito": _2, "moriya": _2, "naka": _2, "namegata": _2, "oarai": _2, "ogawa": _2, "omitama": _2, "ryugasaki": _2, "sakai": _2, "sakuragawa": _2, "shimodate": _2, "shimotsuma": _2, "shirosato": _2, "sowa": _2, "suifu": _2, "takahagi": _2, "tamatsukuri": _2, "tokai": _2, "tomobe": _2, "tone": _2, "toride": _2, "tsuchiura": _2, "tsukuba": _2, "uchihara": _2, "ushiku": _2, "yachiyo": _2, "yamagata": _2, "yawara": _2, "yuki": _2 }], "ishikawa": [1, { "anamizu": _2, "hakui": _2, "hakusan": _2, "kaga": _2, "kahoku": _2, "kanazawa": _2, "kawakita": _2, "komatsu": _2, "nakanoto": _2, "nanao": _2, "nomi": _2, "nonoichi": _2, "noto": _2, "shika": _2, "suzu": _2, "tsubata": _2, "tsurugi": _2, "uchinada": _2, "wajima": _2 }], "iwate": [1, { "fudai": _2, "fujisawa": _2, "hanamaki": _2, "hiraizumi": _2, "hirono": _2, "ichinohe": _2, "ichinoseki": _2, "iwaizumi": _2, "iwate": _2, "joboji": _2, "kamaishi": _2, "kanegasaki": _2, "karumai": _2, "kawai": _2, "kitakami": _2, "kuji": _2, "kunohe": _2, "kuzumaki": _2, "miyako": _2, "mizusawa": _2, "morioka": _2, "ninohe": _2, "noda": _2, "ofunato": _2, "oshu": _2, "otsuchi": _2, "rikuzentakata": _2, "shiwa": _2, "shizukuishi": _2, "sumita": _2, "tanohata": _2, "tono": _2, "yahaba": _2, "yamada": _2 }], "kagawa": [1, { "ayagawa": _2, "higashikagawa": _2, "kanonji": _2, "kotohira": _2, "manno": _2, "marugame": _2, "mitoyo": _2, "naoshima": _2, "sanuki": _2, "tadotsu": _2, "takamatsu": _2, "tonosho": _2, "uchinomi": _2, "utazu": _2, "zentsuji": _2 }], "kagoshima": [1, { "akune": _2, "amami": _2, "hioki": _2, "isa": _2, "isen": _2, "izumi": _2, "kagoshima": _2, "kanoya": _2, "kawanabe": _2, "kinko": _2, "kouyama": _2, "makurazaki": _2, "matsumoto": _2, "minamitane": _2, "nakatane": _2, "nishinoomote": _2, "satsumasendai": _2, "soo": _2, "tarumizu": _2, "yusui": _2 }], "kanagawa": [1, { "aikawa": _2, "atsugi": _2, "ayase": _2, "chigasaki": _2, "ebina": _2, "fujisawa": _2, "hadano": _2, "hakone": _2, "hiratsuka": _2, "isehara": _2, "kaisei": _2, "kamakura": _2, "kiyokawa": _2, "matsuda": _2, "minamiashigara": _2, "miura": _2, "nakai": _2, "ninomiya": _2, "odawara": _2, "oi": _2, "oiso": _2, "sagamihara": _2, "samukawa": _2, "tsukui": _2, "yamakita": _2, "yamato": _2, "yokosuka": _2, "yugawara": _2, "zama": _2, "zushi": _2 }], "kochi": [1, { "aki": _2, "geisei": _2, "hidaka": _2, "higashitsuno": _2, "ino": _2, "kagami": _2, "kami": _2, "kitagawa": _2, "kochi": _2, "mihara": _2, "motoyama": _2, "muroto": _2, "nahari": _2, "nakamura": _2, "nankoku": _2, "nishitosa": _2, "niyodogawa": _2, "ochi": _2, "okawa": _2, "otoyo": _2, "otsuki": _2, "sakawa": _2, "sukumo": _2, "susaki": _2, "tosa": _2, "tosashimizu": _2, "toyo": _2, "tsuno": _2, "umaji": _2, "yasuda": _2, "yusuhara": _2 }], "kumamoto": [1, { "amakusa": _2, "arao": _2, "aso": _2, "choyo": _2, "gyokuto": _2, "kamiamakusa": _2, "kikuchi": _2, "kumamoto": _2, "mashiki": _2, "mifune": _2, "minamata": _2, "minamioguni": _2, "nagasu": _2, "nishihara": _2, "oguni": _2, "ozu": _2, "sumoto": _2, "takamori": _2, "uki": _2, "uto": _2, "yamaga": _2, "yamato": _2, "yatsushiro": _2 }], "kyoto": [1, { "ayabe": _2, "fukuchiyama": _2, "higashiyama": _2, "ide": _2, "ine": _2, "joyo": _2, "kameoka": _2, "kamo": _2, "kita": _2, "kizu": _2, "kumiyama": _2, "kyotamba": _2, "kyotanabe": _2, "kyotango": _2, "maizuru": _2, "minami": _2, "minamiyamashiro": _2, "miyazu": _2, "muko": _2, "nagaokakyo": _2, "nakagyo": _2, "nantan": _2, "oyamazaki": _2, "sakyo": _2, "seika": _2, "tanabe": _2, "uji": _2, "ujitawara": _2, "wazuka": _2, "yamashina": _2, "yawata": _2 }], "mie": [1, { "asahi": _2, "inabe": _2, "ise": _2, "kameyama": _2, "kawagoe": _2, "kiho": _2, "kisosaki": _2, "kiwa": _2, "komono": _2, "kumano": _2, "kuwana": _2, "matsusaka": _2, "meiwa": _2, "mihama": _2, "minamiise": _2, "misugi": _2, "miyama": _2, "nabari": _2, "shima": _2, "suzuka": _2, "tado": _2, "taiki": _2, "taki": _2, "tamaki": _2, "toba": _2, "tsu": _2, "udono": _2, "ureshino": _2, "watarai": _2, "yokkaichi": _2 }], "miyagi": [1, { "furukawa": _2, "higashimatsushima": _2, "ishinomaki": _2, "iwanuma": _2, "kakuda": _2, "kami": _2, "kawasaki": _2, "marumori": _2, "matsushima": _2, "minamisanriku": _2, "misato": _2, "murata": _2, "natori": _2, "ogawara": _2, "ohira": _2, "onagawa": _2, "osaki": _2, "rifu": _2, "semine": _2, "shibata": _2, "shichikashuku": _2, "shikama": _2, "shiogama": _2, "shiroishi": _2, "tagajo": _2, "taiwa": _2, "tome": _2, "tomiya": _2, "wakuya": _2, "watari": _2, "yamamoto": _2, "zao": _2 }], "miyazaki": [1, { "aya": _2, "ebino": _2, "gokase": _2, "hyuga": _2, "kadogawa": _2, "kawaminami": _2, "kijo": _2, "kitagawa": _2, "kitakata": _2, "kitaura": _2, "kobayashi": _2, "kunitomi": _2, "kushima": _2, "mimata": _2, "miyakonojo": _2, "miyazaki": _2, "morotsuka": _2, "nichinan": _2, "nishimera": _2, "nobeoka": _2, "saito": _2, "shiiba": _2, "shintomi": _2, "takaharu": _2, "takanabe": _2, "takazaki": _2, "tsuno": _2 }], "nagano": [1, { "achi": _2, "agematsu": _2, "anan": _2, "aoki": _2, "asahi": _2, "azumino": _2, "chikuhoku": _2, "chikuma": _2, "chino": _2, "fujimi": _2, "hakuba": _2, "hara": _2, "hiraya": _2, "iida": _2, "iijima": _2, "iiyama": _2, "iizuna": _2, "ikeda": _2, "ikusaka": _2, "ina": _2, "karuizawa": _2, "kawakami": _2, "kiso": _2, "kisofukushima": _2, "kitaaiki": _2, "komagane": _2, "komoro": _2, "matsukawa": _2, "matsumoto": _2, "miasa": _2, "minamiaiki": _2, "minamimaki": _2, "minamiminowa": _2, "minowa": _2, "miyada": _2, "miyota": _2, "mochizuki": _2, "nagano": _2, "nagawa": _2, "nagiso": _2, "nakagawa": _2, "nakano": _2, "nozawaonsen": _2, "obuse": _2, "ogawa": _2, "okaya": _2, "omachi": _2, "omi": _2, "ookuwa": _2, "ooshika": _2, "otaki": _2, "otari": _2, "sakae": _2, "sakaki": _2, "saku": _2, "sakuho": _2, "shimosuwa": _2, "shinanomachi": _2, "shiojiri": _2, "suwa": _2, "suzaka": _2, "takagi": _2, "takamori": _2, "takayama": _2, "tateshina": _2, "tatsuno": _2, "togakushi": _2, "togura": _2, "tomi": _2, "ueda": _2, "wada": _2, "yamagata": _2, "yamanouchi": _2, "yasaka": _2, "yasuoka": _2 }], "nagasaki": [1, { "chijiwa": _2, "futsu": _2, "goto": _2, "hasami": _2, "hirado": _2, "iki": _2, "isahaya": _2, "kawatana": _2, "kuchinotsu": _2, "matsuura": _2, "nagasaki": _2, "obama": _2, "omura": _2, "oseto": _2, "saikai": _2, "sasebo": _2, "seihi": _2, "shimabara": _2, "shinkamigoto": _2, "togitsu": _2, "tsushima": _2, "unzen": _2 }], "nara": [1, { "ando": _2, "gose": _2, "heguri": _2, "higashiyoshino": _2, "ikaruga": _2, "ikoma": _2, "kamikitayama": _2, "kanmaki": _2, "kashiba": _2, "kashihara": _2, "katsuragi": _2, "kawai": _2, "kawakami": _2, "kawanishi": _2, "koryo": _2, "kurotaki": _2, "mitsue": _2, "miyake": _2, "nara": _2, "nosegawa": _2, "oji": _2, "ouda": _2, "oyodo": _2, "sakurai": _2, "sango": _2, "shimoichi": _2, "shimokitayama": _2, "shinjo": _2, "soni": _2, "takatori": _2, "tawaramoto": _2, "tenkawa": _2, "tenri": _2, "uda": _2, "yamatokoriyama": _2, "yamatotakada": _2, "yamazoe": _2, "yoshino": _2 }], "niigata": [1, { "aga": _2, "agano": _2, "gosen": _2, "itoigawa": _2, "izumozaki": _2, "joetsu": _2, "kamo": _2, "kariwa": _2, "kashiwazaki": _2, "minamiuonuma": _2, "mitsuke": _2, "muika": _2, "murakami": _2, "myoko": _2, "nagaoka": _2, "niigata": _2, "ojiya": _2, "omi": _2, "sado": _2, "sanjo": _2, "seiro": _2, "seirou": _2, "sekikawa": _2, "shibata": _2, "tagami": _2, "tainai": _2, "tochio": _2, "tokamachi": _2, "tsubame": _2, "tsunan": _2, "uonuma": _2, "yahiko": _2, "yoita": _2, "yuzawa": _2 }], "oita": [1, { "beppu": _2, "bungoono": _2, "bungotakada": _2, "hasama": _2, "hiji": _2, "himeshima": _2, "hita": _2, "kamitsue": _2, "kokonoe": _2, "kuju": _2, "kunisaki": _2, "kusu": _2, "oita": _2, "saiki": _2, "taketa": _2, "tsukumi": _2, "usa": _2, "usuki": _2, "yufu": _2 }], "okayama": [1, { "akaiwa": _2, "asakuchi": _2, "bizen": _2, "hayashima": _2, "ibara": _2, "kagamino": _2, "kasaoka": _2, "kibichuo": _2, "kumenan": _2, "kurashiki": _2, "maniwa": _2, "misaki": _2, "nagi": _2, "niimi": _2, "nishiawakura": _2, "okayama": _2, "satosho": _2, "setouchi": _2, "shinjo": _2, "shoo": _2, "soja": _2, "takahashi": _2, "tamano": _2, "tsuyama": _2, "wake": _2, "yakage": _2 }], "okinawa": [1, { "aguni": _2, "ginowan": _2, "ginoza": _2, "gushikami": _2, "haebaru": _2, "higashi": _2, "hirara": _2, "iheya": _2, "ishigaki": _2, "ishikawa": _2, "itoman": _2, "izena": _2, "kadena": _2, "kin": _2, "kitadaito": _2, "kitanakagusuku": _2, "kumejima": _2, "kunigami": _2, "minamidaito": _2, "motobu": _2, "nago": _2, "naha": _2, "nakagusuku": _2, "nakijin": _2, "nanjo": _2, "nishihara": _2, "ogimi": _2, "okinawa": _2, "onna": _2, "shimoji": _2, "taketomi": _2, "tarama": _2, "tokashiki": _2, "tomigusuku": _2, "tonaki": _2, "urasoe": _2, "uruma": _2, "yaese": _2, "yomitan": _2, "yonabaru": _2, "yonaguni": _2, "zamami": _2 }], "osaka": [1, { "abeno": _2, "chihayaakasaka": _2, "chuo": _2, "daito": _2, "fujiidera": _2, "habikino": _2, "hannan": _2, "higashiosaka": _2, "higashisumiyoshi": _2, "higashiyodogawa": _2, "hirakata": _2, "ibaraki": _2, "ikeda": _2, "izumi": _2, "izumiotsu": _2, "izumisano": _2, "kadoma": _2, "kaizuka": _2, "kanan": _2, "kashiwara": _2, "katano": _2, "kawachinagano": _2, "kishiwada": _2, "kita": _2, "kumatori": _2, "matsubara": _2, "minato": _2, "minoh": _2, "misaki": _2, "moriguchi": _2, "neyagawa": _2, "nishi": _2, "nose": _2, "osakasayama": _2, "sakai": _2, "sayama": _2, "sennan": _2, "settsu": _2, "shijonawate": _2, "shimamoto": _2, "suita": _2, "tadaoka": _2, "taishi": _2, "tajiri": _2, "takaishi": _2, "takatsuki": _2, "tondabayashi": _2, "toyonaka": _2, "toyono": _2, "yao": _2 }], "saga": [1, { "ariake": _2, "arita": _2, "fukudomi": _2, "genkai": _2, "hamatama": _2, "hizen": _2, "imari": _2, "kamimine": _2, "kanzaki": _2, "karatsu": _2, "kashima": _2, "kitagata": _2, "kitahata": _2, "kiyama": _2, "kouhoku": _2, "kyuragi": _2, "nishiarita": _2, "ogi": _2, "omachi": _2, "ouchi": _2, "saga": _2, "shiroishi": _2, "taku": _2, "tara": _2, "tosu": _2, "yoshinogari": _2 }], "saitama": [1, { "arakawa": _2, "asaka": _2, "chichibu": _2, "fujimi": _2, "fujimino": _2, "fukaya": _2, "hanno": _2, "hanyu": _2, "hasuda": _2, "hatogaya": _2, "hatoyama": _2, "hidaka": _2, "higashichichibu": _2, "higashimatsuyama": _2, "honjo": _2, "ina": _2, "iruma": _2, "iwatsuki": _2, "kamiizumi": _2, "kamikawa": _2, "kamisato": _2, "kasukabe": _2, "kawagoe": _2, "kawaguchi": _2, "kawajima": _2, "kazo": _2, "kitamoto": _2, "koshigaya": _2, "kounosu": _2, "kuki": _2, "kumagaya": _2, "matsubushi": _2, "minano": _2, "misato": _2, "miyashiro": _2, "miyoshi": _2, "moroyama": _2, "nagatoro": _2, "namegawa": _2, "niiza": _2, "ogano": _2, "ogawa": _2, "ogose": _2, "okegawa": _2, "omiya": _2, "otaki": _2, "ranzan": _2, "ryokami": _2, "saitama": _2, "sakado": _2, "satte": _2, "sayama": _2, "shiki": _2, "shiraoka": _2, "soka": _2, "sugito": _2, "toda": _2, "tokigawa": _2, "tokorozawa": _2, "tsurugashima": _2, "urawa": _2, "warabi": _2, "yashio": _2, "yokoze": _2, "yono": _2, "yorii": _2, "yoshida": _2, "yoshikawa": _2, "yoshimi": _2 }], "shiga": [1, { "aisho": _2, "gamo": _2, "higashiomi": _2, "hikone": _2, "koka": _2, "konan": _2, "kosei": _2, "koto": _2, "kusatsu": _2, "maibara": _2, "moriyama": _2, "nagahama": _2, "nishiazai": _2, "notogawa": _2, "omihachiman": _2, "otsu": _2, "ritto": _2, "ryuoh": _2, "takashima": _2, "takatsuki": _2, "torahime": _2, "toyosato": _2, "yasu": _2 }], "shimane": [1, { "akagi": _2, "ama": _2, "gotsu": _2, "hamada": _2, "higashiizumo": _2, "hikawa": _2, "hikimi": _2, "izumo": _2, "kakinoki": _2, "masuda": _2, "matsue": _2, "misato": _2, "nishinoshima": _2, "ohda": _2, "okinoshima": _2, "okuizumo": _2, "shimane": _2, "tamayu": _2, "tsuwano": _2, "unnan": _2, "yakumo": _2, "yasugi": _2, "yatsuka": _2 }], "shizuoka": [1, { "arai": _2, "atami": _2, "fuji": _2, "fujieda": _2, "fujikawa": _2, "fujinomiya": _2, "fukuroi": _2, "gotemba": _2, "haibara": _2, "hamamatsu": _2, "higashiizu": _2, "ito": _2, "iwata": _2, "izu": _2, "izunokuni": _2, "kakegawa": _2, "kannami": _2, "kawanehon": _2, "kawazu": _2, "kikugawa": _2, "kosai": _2, "makinohara": _2, "matsuzaki": _2, "minamiizu": _2, "mishima": _2, "morimachi": _2, "nishiizu": _2, "numazu": _2, "omaezaki": _2, "shimada": _2, "shimizu": _2, "shimoda": _2, "shizuoka": _2, "susono": _2, "yaizu": _2, "yoshida": _2 }], "tochigi": [1, { "ashikaga": _2, "bato": _2, "haga": _2, "ichikai": _2, "iwafune": _2, "kaminokawa": _2, "kanuma": _2, "karasuyama": _2, "kuroiso": _2, "mashiko": _2, "mibu": _2, "moka": _2, "motegi": _2, "nasu": _2, "nasushiobara": _2, "nikko": _2, "nishikata": _2, "nogi": _2, "ohira": _2, "ohtawara": _2, "oyama": _2, "sakura": _2, "sano": _2, "shimotsuke": _2, "shioya": _2, "takanezawa": _2, "tochigi": _2, "tsuga": _2, "ujiie": _2, "utsunomiya": _2, "yaita": _2 }], "tokushima": [1, { "aizumi": _2, "anan": _2, "ichiba": _2, "itano": _2, "kainan": _2, "komatsushima": _2, "matsushige": _2, "mima": _2, "minami": _2, "miyoshi": _2, "mugi": _2, "nakagawa": _2, "naruto": _2, "sanagochi": _2, "shishikui": _2, "tokushima": _2, "wajiki": _2 }], "tokyo": [1, { "adachi": _2, "akiruno": _2, "akishima": _2, "aogashima": _2, "arakawa": _2, "bunkyo": _2, "chiyoda": _2, "chofu": _2, "chuo": _2, "edogawa": _2, "fuchu": _2, "fussa": _2, "hachijo": _2, "hachioji": _2, "hamura": _2, "higashikurume": _2, "higashimurayama": _2, "higashiyamato": _2, "hino": _2, "hinode": _2, "hinohara": _2, "inagi": _2, "itabashi": _2, "katsushika": _2, "kita": _2, "kiyose": _2, "kodaira": _2, "koganei": _2, "kokubunji": _2, "komae": _2, "koto": _2, "kouzushima": _2, "kunitachi": _2, "machida": _2, "meguro": _2, "minato": _2, "mitaka": _2, "mizuho": _2, "musashimurayama": _2, "musashino": _2, "nakano": _2, "nerima": _2, "ogasawara": _2, "okutama": _2, "ome": _2, "oshima": _2, "ota": _2, "setagaya": _2, "shibuya": _2, "shinagawa": _2, "shinjuku": _2, "suginami": _2, "sumida": _2, "tachikawa": _2, "taito": _2, "tama": _2, "toshima": _2 }], "tottori": [1, { "chizu": _2, "hino": _2, "kawahara": _2, "koge": _2, "kotoura": _2, "misasa": _2, "nanbu": _2, "nichinan": _2, "sakaiminato": _2, "tottori": _2, "wakasa": _2, "yazu": _2, "yonago": _2 }], "toyama": [1, { "asahi": _2, "fuchu": _2, "fukumitsu": _2, "funahashi": _2, "himi": _2, "imizu": _2, "inami": _2, "johana": _2, "kamiichi": _2, "kurobe": _2, "nakaniikawa": _2, "namerikawa": _2, "nanto": _2, "nyuzen": _2, "oyabe": _2, "taira": _2, "takaoka": _2, "tateyama": _2, "toga": _2, "tonami": _2, "toyama": _2, "unazuki": _2, "uozu": _2, "yamada": _2 }], "wakayama": [1, { "arida": _2, "aridagawa": _2, "gobo": _2, "hashimoto": _2, "hidaka": _2, "hirogawa": _2, "inami": _2, "iwade": _2, "kainan": _2, "kamitonda": _2, "katsuragi": _2, "kimino": _2, "kinokawa": _2, "kitayama": _2, "koya": _2, "koza": _2, "kozagawa": _2, "kudoyama": _2, "kushimoto": _2, "mihama": _2, "misato": _2, "nachikatsuura": _2, "shingu": _2, "shirahama": _2, "taiji": _2, "tanabe": _2, "wakayama": _2, "yuasa": _2, "yura": _2 }], "yamagata": [1, { "asahi": _2, "funagata": _2, "higashine": _2, "iide": _2, "kahoku": _2, "kaminoyama": _2, "kaneyama": _2, "kawanishi": _2, "mamurogawa": _2, "mikawa": _2, "murayama": _2, "nagai": _2, "nakayama": _2, "nanyo": _2, "nishikawa": _2, "obanazawa": _2, "oe": _2, "oguni": _2, "ohkura": _2, "oishida": _2, "sagae": _2, "sakata": _2, "sakegawa": _2, "shinjo": _2, "shirataka": _2, "shonai": _2, "takahata": _2, "tendo": _2, "tozawa": _2, "tsuruoka": _2, "yamagata": _2, "yamanobe": _2, "yonezawa": _2, "yuza": _2 }], "yamaguchi": [1, { "abu": _2, "hagi": _2, "hikari": _2, "hofu": _2, "iwakuni": _2, "kudamatsu": _2, "mitou": _2, "nagato": _2, "oshima": _2, "shimonoseki": _2, "shunan": _2, "tabuse": _2, "tokuyama": _2, "toyota": _2, "ube": _2, "yuu": _2 }], "yamanashi": [1, { "chuo": _2, "doshi": _2, "fuefuki": _2, "fujikawa": _2, "fujikawaguchiko": _2, "fujiyoshida": _2, "hayakawa": _2, "hokuto": _2, "ichikawamisato": _2, "kai": _2, "kofu": _2, "koshu": _2, "kosuge": _2, "minami-alps": _2, "minobu": _2, "nakamichi": _2, "nanbu": _2, "narusawa": _2, "nirasaki": _2, "nishikatsura": _2, "oshino": _2, "otsuki": _2, "showa": _2, "tabayama": _2, "tsuru": _2, "uenohara": _2, "yamanakako": _2, "yamanashi": _2 }], "xn--ehqz56n": _2, "\u4E09\u91CD": _2, "xn--1lqs03n": _2, "\u4EAC\u90FD": _2, "xn--qqqt11m": _2, "\u4F50\u8CC0": _2, "xn--f6qx53a": _2, "\u5175\u5EAB": _2, "xn--djrs72d6uy": _2, "\u5317\u6D77\u9053": _2, "xn--mkru45i": _2, "\u5343\u8449": _2, "xn--0trq7p7nn": _2, "\u548C\u6B4C\u5C71": _2, "xn--5js045d": _2, "\u57FC\u7389": _2, "xn--kbrq7o": _2, "\u5927\u5206": _2, "xn--pssu33l": _2, "\u5927\u962A": _2, "xn--ntsq17g": _2, "\u5948\u826F": _2, "xn--uisz3g": _2, "\u5BAE\u57CE": _2, "xn--6btw5a": _2, "\u5BAE\u5D0E": _2, "xn--1ctwo": _2, "\u5BCC\u5C71": _2, "xn--6orx2r": _2, "\u5C71\u53E3": _2, "xn--rht61e": _2, "\u5C71\u5F62": _2, "xn--rht27z": _2, "\u5C71\u68A8": _2, "xn--nit225k": _2, "\u5C90\u961C": _2, "xn--rht3d": _2, "\u5CA1\u5C71": _2, "xn--djty4k": _2, "\u5CA9\u624B": _2, "xn--klty5x": _2, "\u5CF6\u6839": _2, "xn--kltx9a": _2, "\u5E83\u5CF6": _2, "xn--kltp7d": _2, "\u5FB3\u5CF6": _2, "xn--c3s14m": _2, "\u611B\u5A9B": _2, "xn--vgu402c": _2, "\u611B\u77E5": _2, "xn--efvn9s": _2, "\u65B0\u6F5F": _2, "xn--1lqs71d": _2, "\u6771\u4EAC": _2, "xn--4pvxs": _2, "\u6803\u6728": _2, "xn--uuwu58a": _2, "\u6C96\u7E04": _2, "xn--zbx025d": _2, "\u6ECB\u8CC0": _2, "xn--8pvr4u": _2, "\u718A\u672C": _2, "xn--5rtp49c": _2, "\u77F3\u5DDD": _2, "xn--ntso0iqx3a": _2, "\u795E\u5948\u5DDD": _2, "xn--elqq16h": _2, "\u798F\u4E95": _2, "xn--4it168d": _2, "\u798F\u5CA1": _2, "xn--klt787d": _2, "\u798F\u5CF6": _2, "xn--rny31h": _2, "\u79CB\u7530": _2, "xn--7t0a264c": _2, "\u7FA4\u99AC": _2, "xn--uist22h": _2, "\u8328\u57CE": _2, "xn--8ltr62k": _2, "\u9577\u5D0E": _2, "xn--2m4a15e": _2, "\u9577\u91CE": _2, "xn--32vp30h": _2, "\u9752\u68EE": _2, "xn--4it797k": _2, "\u9759\u5CA1": _2, "xn--5rtq34k": _2, "\u9999\u5DDD": _2, "xn--k7yn95e": _2, "\u9AD8\u77E5": _2, "xn--tor131o": _2, "\u9CE5\u53D6": _2, "xn--d5qv7z876c": _2, "\u9E7F\u5150\u5CF6": _2, "kawasaki": _21, "kitakyushu": _21, "kobe": _21, "nagoya": _21, "sapporo": _21, "sendai": _21, "yokohama": _21, "buyshop": _3, "fashionstore": _3, "handcrafted": _3, "kawaiishop": _3, "supersale": _3, "theshop": _3, "0am": _3, "0g0": _3, "0j0": _3, "0t0": _3, "mydns": _3, "pgw": _3, "wjg": _3, "usercontent": _3, "angry": _3, "babyblue": _3, "babymilk": _3, "backdrop": _3, "bambina": _3, "bitter": _3, "blush": _3, "boo": _3, "boy": _3, "boyfriend": _3, "but": _3, "candypop": _3, "capoo": _3, "catfood": _3, "cheap": _3, "chicappa": _3, "chillout": _3, "chips": _3, "chowder": _3, "chu": _3, "ciao": _3, "cocotte": _3, "coolblog": _3, "cranky": _3, "cutegirl": _3, "daa": _3, "deca": _3, "deci": _3, "digick": _3, "egoism": _3, "fakefur": _3, "fem": _3, "flier": _3, "floppy": _3, "fool": _3, "frenchkiss": _3, "girlfriend": _3, "girly": _3, "gloomy": _3, "gonna": _3, "greater": _3, "hacca": _3, "heavy": _3, "her": _3, "hiho": _3, "hippy": _3, "holy": _3, "hungry": _3, "icurus": _3, "itigo": _3, "jellybean": _3, "kikirara": _3, "kill": _3, "kilo": _3, "kuron": _3, "littlestar": _3, "lolipopmc": _3, "lolitapunk": _3, "lomo": _3, "lovepop": _3, "lovesick": _3, "main": _3, "mods": _3, "mond": _3, "mongolian": _3, "moo": _3, "namaste": _3, "nikita": _3, "nobushi": _3, "noor": _3, "oops": _3, "parallel": _3, "parasite": _3, "pecori": _3, "peewee": _3, "penne": _3, "pepper": _3, "perma": _3, "pigboat": _3, "pinoko": _3, "punyu": _3, "pupu": _3, "pussycat": _3, "pya": _3, "raindrop": _3, "readymade": _3, "sadist": _3, "schoolbus": _3, "secret": _3, "staba": _3, "stripper": _3, "sub": _3, "sunnyday": _3, "thick": _3, "tonkotsu": _3, "under": _3, "upper": _3, "velvet": _3, "verse": _3, "versus": _3, "vivian": _3, "watson": _3, "weblike": _3, "whitesnow": _3, "zombie": _3, "hateblo": _3, "hatenablog": _3, "hatenadiary": _3, "2-d": _3, "bona": _3, "crap": _3, "daynight": _3, "eek": _3, "flop": _3, "halfmoon": _3, "jeez": _3, "matrix": _3, "mimoza": _3, "netgamers": _3, "nyanta": _3, "o0o0": _3, "rdy": _3, "rgr": _3, "rulez": _3, "sakurastorage": [0, { "isk01": _60, "isk02": _60 }], "saloon": _3, "sblo": _3, "skr": _3, "tank": _3, "uh-oh": _3, "undo": _3, "webaccel": [0, { "rs": _3, "user": _3 }], "websozai": _3, "xii": _3 }], "ke": [1, { "ac": _2, "co": _2, "go": _2, "info": _2, "me": _2, "mobi": _2, "ne": _2, "or": _2, "sc": _2 }], "kg": [1, { "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "us": _3, "xx": _3, "ae": _3 }], "kh": _4, "ki": _61, "km": [1, { "ass": _2, "com": _2, "edu": _2, "gov": _2, "mil": _2, "nom": _2, "org": _2, "prd": _2, "tm": _2, "asso": _2, "coop": _2, "gouv": _2, "medecin": _2, "notaires": _2, "pharmaciens": _2, "presse": _2, "veterinaire": _2 }], "kn": [1, { "edu": _2, "gov": _2, "net": _2, "org": _2 }], "kp": [1, { "com": _2, "edu": _2, "gov": _2, "org": _2, "rep": _2, "tra": _2 }], "kr": [1, { "ac": _2, "ai": _2, "co": _2, "es": _2, "go": _2, "hs": _2, "io": _2, "it": _2, "kg": _2, "me": _2, "mil": _2, "ms": _2, "ne": _2, "or": _2, "pe": _2, "re": _2, "sc": _2, "busan": _2, "chungbuk": _2, "chungnam": _2, "daegu": _2, "daejeon": _2, "gangwon": _2, "gwangju": _2, "gyeongbuk": _2, "gyeonggi": _2, "gyeongnam": _2, "incheon": _2, "jeju": _2, "jeonbuk": _2, "jeonnam": _2, "seoul": _2, "ulsan": _2, "c01": _3, "eliv-api": _3, "eliv-cdn": _3, "eliv-dns": _3, "mmv": _3, "vki": _3 }], "kw": [1, { "com": _2, "edu": _2, "emb": _2, "gov": _2, "ind": _2, "net": _2, "org": _2 }], "ky": _48, "kz": [1, { "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "jcloud": _3 }], "la": [1, { "com": _2, "edu": _2, "gov": _2, "info": _2, "int": _2, "net": _2, "org": _2, "per": _2, "bnr": _3 }], "lb": _4, "lc": [1, { "co": _2, "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "oy": _3 }], "li": _2, "lk": [1, { "ac": _2, "assn": _2, "com": _2, "edu": _2, "gov": _2, "grp": _2, "hotel": _2, "int": _2, "ltd": _2, "net": _2, "ngo": _2, "org": _2, "sch": _2, "soc": _2, "web": _2 }], "lr": _4, "ls": [1, { "ac": _2, "biz": _2, "co": _2, "edu": _2, "gov": _2, "info": _2, "net": _2, "org": _2, "sc": _2 }], "lt": _10, "lu": [1, { "123website": _3 }], "lv": [1, { "asn": _2, "com": _2, "conf": _2, "edu": _2, "gov": _2, "id": _2, "mil": _2, "net": _2, "org": _2 }], "ly": [1, { "com": _2, "edu": _2, "gov": _2, "id": _2, "med": _2, "net": _2, "org": _2, "plc": _2, "sch": _2 }], "ma": [1, { "ac": _2, "co": _2, "gov": _2, "net": _2, "org": _2, "press": _2 }], "mc": [1, { "asso": _2, "tm": _2 }], "md": [1, { "ir": _3 }], "me": [1, { "ac": _2, "co": _2, "edu": _2, "gov": _2, "its": _2, "net": _2, "org": _2, "priv": _2, "c66": _3, "craft": _3, "edgestack": _3, "mybox": _3, "filegear": _3, "filegear-sg": _3, "lohmus": _3, "barsy": _3, "mcdir": _3, "brasilia": _3, "ddns": _3, "dnsfor": _3, "hopto": _3, "loginto": _3, "noip": _3, "webhop": _3, "soundcast": _3, "tcp4": _3, "vp4": _3, "diskstation": _3, "dscloud": _3, "i234": _3, "myds": _3, "synology": _3, "transip": _47, "nohost": _3 }], "mg": [1, { "co": _2, "com": _2, "edu": _2, "gov": _2, "mil": _2, "nom": _2, "org": _2, "prd": _2 }], "mh": _2, "mil": _2, "mk": [1, { "com": _2, "edu": _2, "gov": _2, "inf": _2, "name": _2, "net": _2, "org": _2 }], "ml": [1, { "ac": _2, "art": _2, "asso": _2, "com": _2, "edu": _2, "gouv": _2, "gov": _2, "info": _2, "inst": _2, "net": _2, "org": _2, "pr": _2, "presse": _2 }], "mm": _21, "mn": [1, { "edu": _2, "gov": _2, "org": _2, "nyc": _3 }], "mo": _4, "mobi": [1, { "barsy": _3, "dscloud": _3 }], "mp": [1, { "ju": _3 }], "mq": _2, "mr": _10, "ms": [1, { "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "minisite": _3 }], "mt": _48, "mu": [1, { "ac": _2, "co": _2, "com": _2, "gov": _2, "net": _2, "or": _2, "org": _2 }], "museum": _2, "mv": [1, { "aero": _2, "biz": _2, "com": _2, "coop": _2, "edu": _2, "gov": _2, "info": _2, "int": _2, "mil": _2, "museum": _2, "name": _2, "net": _2, "org": _2, "pro": _2 }], "mw": [1, { "ac": _2, "biz": _2, "co": _2, "com": _2, "coop": _2, "edu": _2, "gov": _2, "int": _2, "net": _2, "org": _2 }], "mx": [1, { "com": _2, "edu": _2, "gob": _2, "net": _2, "org": _2 }], "my": [1, { "biz": _2, "com": _2, "edu": _2, "gov": _2, "mil": _2, "name": _2, "net": _2, "org": _2 }], "mz": [1, { "ac": _2, "adv": _2, "co": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2 }], "na": [1, { "alt": _2, "co": _2, "com": _2, "gov": _2, "net": _2, "org": _2 }], "name": [1, { "her": _64, "his": _64, "ispmanager": _3, "keenetic": _3 }], "nc": [1, { "asso": _2, "nom": _2 }], "ne": _2, "net": [1, { "adobeaemcloud": _3, "adobeio-static": _3, "adobeioruntime": _3, "akadns": _3, "akamai": _3, "akamai-staging": _3, "akamaiedge": _3, "akamaiedge-staging": _3, "akamaihd": _3, "akamaihd-staging": _3, "akamaiorigin": _3, "akamaiorigin-staging": _3, "akamaized": _3, "akamaized-staging": _3, "edgekey": _3, "edgekey-staging": _3, "edgesuite": _3, "edgesuite-staging": _3, "alwaysdata": _3, "myamaze": _3, "cloudfront": _3, "appudo": _3, "atlassian-dev": [0, { "prod": _56 }], "myfritz": _3, "shopselect": _3, "blackbaudcdn": _3, "boomla": _3, "bplaced": _3, "square7": _3, "cdn77": [0, { "r": _3 }], "cdn77-ssl": _3, "gb": _3, "hu": _3, "jp": _3, "se": _3, "uk": _3, "clickrising": _3, "ddns-ip": _3, "dns-cloud": _3, "dns-dynamic": _3, "cloudaccess": _3, "cloudflare": [2, { "cdn": _3 }], "cloudflareanycast": _56, "cloudflarecn": _56, "cloudflareglobal": _56, "ctfcloud": _3, "feste-ip": _3, "knx-server": _3, "static-access": _3, "cryptonomic": _6, "dattolocal": _3, "mydatto": _3, "debian": _3, "definima": _3, "deno": [2, { "sandbox": _3 }], "icp": _6, "de5": _3, "at-band-camp": _3, "blogdns": _3, "broke-it": _3, "buyshouses": _3, "dnsalias": _3, "dnsdojo": _3, "does-it": _3, "dontexist": _3, "dynalias": _3, "dynathome": _3, "endofinternet": _3, "from-az": _3, "from-co": _3, "from-la": _3, "from-ny": _3, "gets-it": _3, "ham-radio-op": _3, "homeftp": _3, "homeip": _3, "homelinux": _3, "homeunix": _3, "in-the-band": _3, "is-a-chef": _3, "is-a-geek": _3, "isa-geek": _3, "kicks-ass": _3, "office-on-the": _3, "podzone": _3, "scrapper-site": _3, "selfip": _3, "sells-it": _3, "servebbs": _3, "serveftp": _3, "thruhere": _3, "webhop": _3, "casacam": _3, "dynu": _3, "dynuddns": _3, "mysynology": _3, "opik": _3, "spryt": _3, "dynv6": _3, "twmail": _3, "ru": _3, "channelsdvr": [2, { "u": _3 }], "fastly": [0, { "freetls": _3, "map": _3, "prod": [0, { "a": _3, "global": _3 }], "ssl": [0, { "a": _3, "b": _3, "global": _3 }] }], "fastlylb": [2, { "map": _3 }], "keyword-on": _3, "live-on": _3, "server-on": _3, "cdn-edges": _3, "heteml": _3, "cloudfunctions": _3, "grafana-dev": _3, "iobb": _3, "moonscale": _3, "in-dsl": _3, "in-vpn": _3, "oninferno": _3, "botdash": _3, "apps-1and1": _3, "ipifony": _3, "cloudjiffy": [2, { "fra1-de": _3, "west1-us": _3 }], "elastx": [0, { "jls-sto1": _3, "jls-sto2": _3, "jls-sto3": _3 }], "massivegrid": [0, { "paas": [0, { "fr-1": _3, "lon-1": _3, "lon-2": _3, "ny-1": _3, "ny-2": _3, "sg-1": _3 }] }], "saveincloud": [0, { "jelastic": _3, "nordeste-idc": _3 }], "scaleforce": _49, "kinghost": _3, "uni5": _3, "krellian": _3, "ggff": _3, "localto": _6, "barsy": _3, "luyani": _3, "memset": _3, "azure-api": _3, "azure-mobile": _3, "azureedge": _3, "azurefd": _3, "azurestaticapps": [2, { "1": _3, "2": _3, "3": _3, "4": _3, "5": _3, "6": _3, "7": _3, "centralus": _3, "eastasia": _3, "eastus2": _3, "westeurope": _3, "westus2": _3 }], "azurewebsites": _3, "cloudapp": _3, "trafficmanager": _3, "usgovcloudapi": _66, "usgovcloudapp": _3, "usgovtrafficmanager": _3, "windows": _66, "mynetname": [0, { "sn": _3 }], "routingthecloud": _3, "bounceme": _3, "ddns": _3, "eating-organic": _3, "mydissent": _3, "myeffect": _3, "mymediapc": _3, "mypsx": _3, "mysecuritycamera": _3, "nhlfan": _3, "no-ip": _3, "pgafan": _3, "privatizehealthinsurance": _3, "redirectme": _3, "serveblog": _3, "serveminecraft": _3, "sytes": _3, "dnsup": _3, "hicam": _3, "now-dns": _3, "ownip": _3, "vpndns": _3, "cloudycluster": _3, "ovh": [0, { "hosting": _6, "webpaas": _6 }], "rackmaze": _3, "myradweb": _3, "in": _3, "subsc-pay": _3, "squares": _3, "schokokeks": _3, "firewall-gateway": _3, "seidat": _3, "senseering": _3, "siteleaf": _3, "mafelo": _3, "myspreadshop": _3, "vps-host": [2, { "jelastic": [0, { "atl": _3, "njs": _3, "ric": _3 }] }], "srcf": [0, { "soc": _3, "user": _3 }], "supabase": _3, "dsmynas": _3, "familyds": _3, "ts": [2, { "c": _6 }], "torproject": [2, { "pages": _3 }], "tunnelmole": _3, "vusercontent": _3, "reserve-online": _3, "localcert": _3, "community-pro": _3, "meinforum": _3, "yandexcloud": [2, { "storage": _3, "website": _3 }], "za": _3, "zabc": _3 }], "nf": [1, { "arts": _2, "com": _2, "firm": _2, "info": _2, "net": _2, "other": _2, "per": _2, "rec": _2, "store": _2, "web": _2 }], "ng": [1, { "com": _2, "edu": _2, "gov": _2, "i": _2, "mil": _2, "mobi": _2, "name": _2, "net": _2, "org": _2, "sch": _2, "biz": [2, { "co": _3, "dl": _3, "go": _3, "lg": _3, "on": _3 }], "col": _3, "firm": _3, "gen": _3, "ltd": _3, "ngo": _3, "plc": _3 }], "ni": [1, { "ac": _2, "biz": _2, "co": _2, "com": _2, "edu": _2, "gob": _2, "in": _2, "info": _2, "int": _2, "mil": _2, "net": _2, "nom": _2, "org": _2, "web": _2 }], "nl": [1, { "co": _3, "hosting-cluster": _3, "gov": _3, "khplay": _3, "123website": _3, "myspreadshop": _3, "transurl": _6, "cistron": _3, "demon": _3 }], "no": [1, { "fhs": _2, "folkebibl": _2, "fylkesbibl": _2, "idrett": _2, "museum": _2, "priv": _2, "vgs": _2, "dep": _2, "herad": _2, "kommune": _2, "mil": _2, "stat": _2, "aa": _67, "ah": _67, "bu": _67, "fm": _67, "hl": _67, "hm": _67, "jan-mayen": _67, "mr": _67, "nl": _67, "nt": _67, "of": _67, "ol": _67, "oslo": _67, "rl": _67, "sf": _67, "st": _67, "svalbard": _67, "tm": _67, "tr": _67, "va": _67, "vf": _67, "akrehamn": _2, "xn--krehamn-dxa": _2, "\xE5krehamn": _2, "algard": _2, "xn--lgrd-poac": _2, "\xE5lg\xE5rd": _2, "arna": _2, "bronnoysund": _2, "xn--brnnysund-m8ac": _2, "br\xF8nn\xF8ysund": _2, "brumunddal": _2, "bryne": _2, "drobak": _2, "xn--drbak-wua": _2, "dr\xF8bak": _2, "egersund": _2, "fetsund": _2, "floro": _2, "xn--flor-jra": _2, "flor\xF8": _2, "fredrikstad": _2, "hokksund": _2, "honefoss": _2, "xn--hnefoss-q1a": _2, "h\xF8nefoss": _2, "jessheim": _2, "jorpeland": _2, "xn--jrpeland-54a": _2, "j\xF8rpeland": _2, "kirkenes": _2, "kopervik": _2, "krokstadelva": _2, "langevag": _2, "xn--langevg-jxa": _2, "langev\xE5g": _2, "leirvik": _2, "mjondalen": _2, "xn--mjndalen-64a": _2, "mj\xF8ndalen": _2, "mo-i-rana": _2, "mosjoen": _2, "xn--mosjen-eya": _2, "mosj\xF8en": _2, "nesoddtangen": _2, "orkanger": _2, "osoyro": _2, "xn--osyro-wua": _2, "os\xF8yro": _2, "raholt": _2, "xn--rholt-mra": _2, "r\xE5holt": _2, "sandnessjoen": _2, "xn--sandnessjen-ogb": _2, "sandnessj\xF8en": _2, "skedsmokorset": _2, "slattum": _2, "spjelkavik": _2, "stathelle": _2, "stavern": _2, "stjordalshalsen": _2, "xn--stjrdalshalsen-sqb": _2, "stj\xF8rdalshalsen": _2, "tananger": _2, "tranby": _2, "vossevangen": _2, "aarborte": _2, "aejrie": _2, "afjord": _2, "xn--fjord-lra": _2, "\xE5fjord": _2, "agdenes": _2, "akershus": _68, "aknoluokta": _2, "xn--koluokta-7ya57h": _2, "\xE1k\u014Boluokta": _2, "al": _2, "xn--l-1fa": _2, "\xE5l": _2, "alaheadju": _2, "xn--laheadju-7ya": _2, "\xE1laheadju": _2, "alesund": _2, "xn--lesund-hua": _2, "\xE5lesund": _2, "alstahaug": _2, "alta": _2, "xn--lt-liac": _2, "\xE1lt\xE1": _2, "alvdal": _2, "amli": _2, "xn--mli-tla": _2, "\xE5mli": _2, "amot": _2, "xn--mot-tla": _2, "\xE5mot": _2, "andasuolo": _2, "andebu": _2, "andoy": _2, "xn--andy-ira": _2, "and\xF8y": _2, "ardal": _2, "xn--rdal-poa": _2, "\xE5rdal": _2, "aremark": _2, "arendal": _2, "xn--s-1fa": _2, "\xE5s": _2, "aseral": _2, "xn--seral-lra": _2, "\xE5seral": _2, "asker": _2, "askim": _2, "askoy": _2, "xn--asky-ira": _2, "ask\xF8y": _2, "askvoll": _2, "asnes": _2, "xn--snes-poa": _2, "\xE5snes": _2, "audnedaln": _2, "aukra": _2, "aure": _2, "aurland": _2, "aurskog-holand": _2, "xn--aurskog-hland-jnb": _2, "aurskog-h\xF8land": _2, "austevoll": _2, "austrheim": _2, "averoy": _2, "xn--avery-yua": _2, "aver\xF8y": _2, "badaddja": _2, "xn--bdddj-mrabd": _2, "b\xE5d\xE5ddj\xE5": _2, "xn--brum-voa": _2, "b\xE6rum": _2, "bahcavuotna": _2, "xn--bhcavuotna-s4a": _2, "b\xE1hcavuotna": _2, "bahccavuotna": _2, "xn--bhccavuotna-k7a": _2, "b\xE1hccavuotna": _2, "baidar": _2, "xn--bidr-5nac": _2, "b\xE1id\xE1r": _2, "bajddar": _2, "xn--bjddar-pta": _2, "b\xE1jddar": _2, "balat": _2, "xn--blt-elab": _2, "b\xE1l\xE1t": _2, "balestrand": _2, "ballangen": _2, "balsfjord": _2, "bamble": _2, "bardu": _2, "barum": _2, "batsfjord": _2, "xn--btsfjord-9za": _2, "b\xE5tsfjord": _2, "bearalvahki": _2, "xn--bearalvhki-y4a": _2, "bearalv\xE1hki": _2, "beardu": _2, "beiarn": _2, "berg": _2, "bergen": _2, "berlevag": _2, "xn--berlevg-jxa": _2, "berlev\xE5g": _2, "bievat": _2, "xn--bievt-0qa": _2, "biev\xE1t": _2, "bindal": _2, "birkenes": _2, "bjerkreim": _2, "bjugn": _2, "bodo": _2, "xn--bod-2na": _2, "bod\xF8": _2, "bokn": _2, "bomlo": _2, "xn--bmlo-gra": _2, "b\xF8mlo": _2, "bremanger": _2, "bronnoy": _2, "xn--brnny-wuac": _2, "br\xF8nn\xF8y": _2, "budejju": _2, "buskerud": _68, "bygland": _2, "bykle": _2, "cahcesuolo": _2, "xn--hcesuolo-7ya35b": _2, "\u010D\xE1hcesuolo": _2, "davvenjarga": _2, "xn--davvenjrga-y4a": _2, "davvenj\xE1rga": _2, "davvesiida": _2, "deatnu": _2, "dielddanuorri": _2, "divtasvuodna": _2, "divttasvuotna": _2, "donna": _2, "xn--dnna-gra": _2, "d\xF8nna": _2, "dovre": _2, "drammen": _2, "drangedal": _2, "dyroy": _2, "xn--dyry-ira": _2, "dyr\xF8y": _2, "eid": _2, "eidfjord": _2, "eidsberg": _2, "eidskog": _2, "eidsvoll": _2, "eigersund": _2, "elverum": _2, "enebakk": _2, "engerdal": _2, "etne": _2, "etnedal": _2, "evenassi": _2, "xn--eveni-0qa01ga": _2, "even\xE1\u0161\u0161i": _2, "evenes": _2, "evje-og-hornnes": _2, "farsund": _2, "fauske": _2, "fedje": _2, "fet": _2, "finnoy": _2, "xn--finny-yua": _2, "finn\xF8y": _2, "fitjar": _2, "fjaler": _2, "fjell": _2, "fla": _2, "xn--fl-zia": _2, "fl\xE5": _2, "flakstad": _2, "flatanger": _2, "flekkefjord": _2, "flesberg": _2, "flora": _2, "folldal": _2, "forde": _2, "xn--frde-gra": _2, "f\xF8rde": _2, "forsand": _2, "fosnes": _2, "xn--frna-woa": _2, "fr\xE6na": _2, "frana": _2, "frei": _2, "frogn": _2, "froland": _2, "frosta": _2, "froya": _2, "xn--frya-hra": _2, "fr\xF8ya": _2, "fuoisku": _2, "fuossko": _2, "fusa": _2, "fyresdal": _2, "gaivuotna": _2, "xn--givuotna-8ya": _2, "g\xE1ivuotna": _2, "galsa": _2, "xn--gls-elac": _2, "g\xE1ls\xE1": _2, "gamvik": _2, "gangaviika": _2, "xn--ggaviika-8ya47h": _2, "g\xE1\u014Bgaviika": _2, "gaular": _2, "gausdal": _2, "giehtavuoatna": _2, "gildeskal": _2, "xn--gildeskl-g0a": _2, "gildesk\xE5l": _2, "giske": _2, "gjemnes": _2, "gjerdrum": _2, "gjerstad": _2, "gjesdal": _2, "gjovik": _2, "xn--gjvik-wua": _2, "gj\xF8vik": _2, "gloppen": _2, "gol": _2, "gran": _2, "grane": _2, "granvin": _2, "gratangen": _2, "grimstad": _2, "grong": _2, "grue": _2, "gulen": _2, "guovdageaidnu": _2, "ha": _2, "xn--h-2fa": _2, "h\xE5": _2, "habmer": _2, "xn--hbmer-xqa": _2, "h\xE1bmer": _2, "hadsel": _2, "xn--hgebostad-g3a": _2, "h\xE6gebostad": _2, "hagebostad": _2, "halden": _2, "halsa": _2, "hamar": _2, "hamaroy": _2, "hammarfeasta": _2, "xn--hmmrfeasta-s4ac": _2, "h\xE1mm\xE1rfeasta": _2, "hammerfest": _2, "hapmir": _2, "xn--hpmir-xqa": _2, "h\xE1pmir": _2, "haram": _2, "hareid": _2, "harstad": _2, "hasvik": _2, "hattfjelldal": _2, "haugesund": _2, "hedmark": [0, { "os": _2, "valer": _2, "xn--vler-qoa": _2, "v\xE5ler": _2 }], "hemne": _2, "hemnes": _2, "hemsedal": _2, "hitra": _2, "hjartdal": _2, "hjelmeland": _2, "hobol": _2, "xn--hobl-ira": _2, "hob\xF8l": _2, "hof": _2, "hol": _2, "hole": _2, "holmestrand": _2, "holtalen": _2, "xn--holtlen-hxa": _2, "holt\xE5len": _2, "hordaland": [0, { "os": _2 }], "hornindal": _2, "horten": _2, "hoyanger": _2, "xn--hyanger-q1a": _2, "h\xF8yanger": _2, "hoylandet": _2, "xn--hylandet-54a": _2, "h\xF8ylandet": _2, "hurdal": _2, "hurum": _2, "hvaler": _2, "hyllestad": _2, "ibestad": _2, "inderoy": _2, "xn--indery-fya": _2, "inder\xF8y": _2, "iveland": _2, "ivgu": _2, "jevnaker": _2, "jolster": _2, "xn--jlster-bya": _2, "j\xF8lster": _2, "jondal": _2, "kafjord": _2, "xn--kfjord-iua": _2, "k\xE5fjord": _2, "karasjohka": _2, "xn--krjohka-hwab49j": _2, "k\xE1r\xE1\u0161johka": _2, "karasjok": _2, "karlsoy": _2, "karmoy": _2, "xn--karmy-yua": _2, "karm\xF8y": _2, "kautokeino": _2, "klabu": _2, "xn--klbu-woa": _2, "kl\xE6bu": _2, "klepp": _2, "kongsberg": _2, "kongsvinger": _2, "kraanghke": _2, "xn--kranghke-b0a": _2, "kr\xE5anghke": _2, "kragero": _2, "xn--krager-gya": _2, "krager\xF8": _2, "kristiansand": _2, "kristiansund": _2, "krodsherad": _2, "xn--krdsherad-m8a": _2, "kr\xF8dsherad": _2, "xn--kvfjord-nxa": _2, "kv\xE6fjord": _2, "xn--kvnangen-k0a": _2, "kv\xE6nangen": _2, "kvafjord": _2, "kvalsund": _2, "kvam": _2, "kvanangen": _2, "kvinesdal": _2, "kvinnherad": _2, "kviteseid": _2, "kvitsoy": _2, "xn--kvitsy-fya": _2, "kvits\xF8y": _2, "laakesvuemie": _2, "xn--lrdal-sra": _2, "l\xE6rdal": _2, "lahppi": _2, "xn--lhppi-xqa": _2, "l\xE1hppi": _2, "lardal": _2, "larvik": _2, "lavagis": _2, "lavangen": _2, "leangaviika": _2, "xn--leagaviika-52b": _2, "lea\u014Bgaviika": _2, "lebesby": _2, "leikanger": _2, "leirfjord": _2, "leka": _2, "leksvik": _2, "lenvik": _2, "lerdal": _2, "lesja": _2, "levanger": _2, "lier": _2, "lierne": _2, "lillehammer": _2, "lillesand": _2, "lindas": _2, "xn--linds-pra": _2, "lind\xE5s": _2, "lindesnes": _2, "loabat": _2, "xn--loabt-0qa": _2, "loab\xE1t": _2, "lodingen": _2, "xn--ldingen-q1a": _2, "l\xF8dingen": _2, "lom": _2, "loppa": _2, "lorenskog": _2, "xn--lrenskog-54a": _2, "l\xF8renskog": _2, "loten": _2, "xn--lten-gra": _2, "l\xF8ten": _2, "lund": _2, "lunner": _2, "luroy": _2, "xn--lury-ira": _2, "lur\xF8y": _2, "luster": _2, "lyngdal": _2, "lyngen": _2, "malatvuopmi": _2, "xn--mlatvuopmi-s4a": _2, "m\xE1latvuopmi": _2, "malselv": _2, "xn--mlselv-iua": _2, "m\xE5lselv": _2, "malvik": _2, "mandal": _2, "marker": _2, "marnardal": _2, "masfjorden": _2, "masoy": _2, "xn--msy-ula0h": _2, "m\xE5s\xF8y": _2, "matta-varjjat": _2, "xn--mtta-vrjjat-k7af": _2, "m\xE1tta-v\xE1rjjat": _2, "meland": _2, "meldal": _2, "melhus": _2, "meloy": _2, "xn--mely-ira": _2, "mel\xF8y": _2, "meraker": _2, "xn--merker-kua": _2, "mer\xE5ker": _2, "midsund": _2, "midtre-gauldal": _2, "moareke": _2, "xn--moreke-jua": _2, "mo\xE5reke": _2, "modalen": _2, "modum": _2, "molde": _2, "more-og-romsdal": [0, { "heroy": _2, "sande": _2 }], "xn--mre-og-romsdal-qqb": [0, { "xn--hery-ira": _2, "sande": _2 }], "m\xF8re-og-romsdal": [0, { "her\xF8y": _2, "sande": _2 }], "moskenes": _2, "moss": _2, "muosat": _2, "xn--muost-0qa": _2, "muos\xE1t": _2, "naamesjevuemie": _2, "xn--nmesjevuemie-tcba": _2, "n\xE5\xE5mesjevuemie": _2, "xn--nry-yla5g": _2, "n\xE6r\xF8y": _2, "namdalseid": _2, "namsos": _2, "namsskogan": _2, "nannestad": _2, "naroy": _2, "narviika": _2, "narvik": _2, "naustdal": _2, "navuotna": _2, "xn--nvuotna-hwa": _2, "n\xE1vuotna": _2, "nedre-eiker": _2, "nesna": _2, "nesodden": _2, "nesseby": _2, "nesset": _2, "nissedal": _2, "nittedal": _2, "nord-aurdal": _2, "nord-fron": _2, "nord-odal": _2, "norddal": _2, "nordkapp": _2, "nordland": [0, { "bo": _2, "xn--b-5ga": _2, "b\xF8": _2, "heroy": _2, "xn--hery-ira": _2, "her\xF8y": _2 }], "nordre-land": _2, "nordreisa": _2, "nore-og-uvdal": _2, "notodden": _2, "notteroy": _2, "xn--nttery-byae": _2, "n\xF8tter\xF8y": _2, "odda": _2, "oksnes": _2, "xn--ksnes-uua": _2, "\xF8ksnes": _2, "omasvuotna": _2, "oppdal": _2, "oppegard": _2, "xn--oppegrd-ixa": _2, "oppeg\xE5rd": _2, "orkdal": _2, "orland": _2, "xn--rland-uua": _2, "\xF8rland": _2, "orskog": _2, "xn--rskog-uua": _2, "\xF8rskog": _2, "orsta": _2, "xn--rsta-fra": _2, "\xF8rsta": _2, "osen": _2, "osteroy": _2, "xn--ostery-fya": _2, "oster\xF8y": _2, "ostfold": [0, { "valer": _2 }], "xn--stfold-9xa": [0, { "xn--vler-qoa": _2 }], "\xF8stfold": [0, { "v\xE5ler": _2 }], "ostre-toten": _2, "xn--stre-toten-zcb": _2, "\xF8stre-toten": _2, "overhalla": _2, "ovre-eiker": _2, "xn--vre-eiker-k8a": _2, "\xF8vre-eiker": _2, "oyer": _2, "xn--yer-zna": _2, "\xF8yer": _2, "oygarden": _2, "xn--ygarden-p1a": _2, "\xF8ygarden": _2, "oystre-slidre": _2, "xn--ystre-slidre-ujb": _2, "\xF8ystre-slidre": _2, "porsanger": _2, "porsangu": _2, "xn--porsgu-sta26f": _2, "pors\xE1\u014Bgu": _2, "porsgrunn": _2, "rade": _2, "xn--rde-ula": _2, "r\xE5de": _2, "radoy": _2, "xn--rady-ira": _2, "rad\xF8y": _2, "xn--rlingen-mxa": _2, "r\xE6lingen": _2, "rahkkeravju": _2, "xn--rhkkervju-01af": _2, "r\xE1hkker\xE1vju": _2, "raisa": _2, "xn--risa-5na": _2, "r\xE1isa": _2, "rakkestad": _2, "ralingen": _2, "rana": _2, "randaberg": _2, "rauma": _2, "rendalen": _2, "rennebu": _2, "rennesoy": _2, "xn--rennesy-v1a": _2, "rennes\xF8y": _2, "rindal": _2, "ringebu": _2, "ringerike": _2, "ringsaker": _2, "risor": _2, "xn--risr-ira": _2, "ris\xF8r": _2, "rissa": _2, "roan": _2, "rodoy": _2, "xn--rdy-0nab": _2, "r\xF8d\xF8y": _2, "rollag": _2, "romsa": _2, "romskog": _2, "xn--rmskog-bya": _2, "r\xF8mskog": _2, "roros": _2, "xn--rros-gra": _2, "r\xF8ros": _2, "rost": _2, "xn--rst-0na": _2, "r\xF8st": _2, "royken": _2, "xn--ryken-vua": _2, "r\xF8yken": _2, "royrvik": _2, "xn--ryrvik-bya": _2, "r\xF8yrvik": _2, "ruovat": _2, "rygge": _2, "salangen": _2, "salat": _2, "xn--slat-5na": _2, "s\xE1lat": _2, "xn--slt-elab": _2, "s\xE1l\xE1t": _2, "saltdal": _2, "samnanger": _2, "sandefjord": _2, "sandnes": _2, "sandoy": _2, "xn--sandy-yua": _2, "sand\xF8y": _2, "sarpsborg": _2, "sauda": _2, "sauherad": _2, "sel": _2, "selbu": _2, "selje": _2, "seljord": _2, "siellak": _2, "sigdal": _2, "siljan": _2, "sirdal": _2, "skanit": _2, "xn--sknit-yqa": _2, "sk\xE1nit": _2, "skanland": _2, "xn--sknland-fxa": _2, "sk\xE5nland": _2, "skaun": _2, "skedsmo": _2, "ski": _2, "skien": _2, "skierva": _2, "xn--skierv-uta": _2, "skierv\xE1": _2, "skiptvet": _2, "skjak": _2, "xn--skjk-soa": _2, "skj\xE5k": _2, "skjervoy": _2, "xn--skjervy-v1a": _2, "skjerv\xF8y": _2, "skodje": _2, "smola": _2, "xn--smla-hra": _2, "sm\xF8la": _2, "snaase": _2, "xn--snase-nra": _2, "sn\xE5ase": _2, "snasa": _2, "xn--snsa-roa": _2, "sn\xE5sa": _2, "snillfjord": _2, "snoasa": _2, "sogndal": _2, "sogne": _2, "xn--sgne-gra": _2, "s\xF8gne": _2, "sokndal": _2, "sola": _2, "solund": _2, "somna": _2, "xn--smna-gra": _2, "s\xF8mna": _2, "sondre-land": _2, "xn--sndre-land-0cb": _2, "s\xF8ndre-land": _2, "songdalen": _2, "sor-aurdal": _2, "xn--sr-aurdal-l8a": _2, "s\xF8r-aurdal": _2, "sor-fron": _2, "xn--sr-fron-q1a": _2, "s\xF8r-fron": _2, "sor-odal": _2, "xn--sr-odal-q1a": _2, "s\xF8r-odal": _2, "sor-varanger": _2, "xn--sr-varanger-ggb": _2, "s\xF8r-varanger": _2, "sorfold": _2, "xn--srfold-bya": _2, "s\xF8rfold": _2, "sorreisa": _2, "xn--srreisa-q1a": _2, "s\xF8rreisa": _2, "sortland": _2, "sorum": _2, "xn--srum-gra": _2, "s\xF8rum": _2, "spydeberg": _2, "stange": _2, "stavanger": _2, "steigen": _2, "steinkjer": _2, "stjordal": _2, "xn--stjrdal-s1a": _2, "stj\xF8rdal": _2, "stokke": _2, "stor-elvdal": _2, "stord": _2, "stordal": _2, "storfjord": _2, "strand": _2, "stranda": _2, "stryn": _2, "sula": _2, "suldal": _2, "sund": _2, "sunndal": _2, "surnadal": _2, "sveio": _2, "svelvik": _2, "sykkylven": _2, "tana": _2, "telemark": [0, { "bo": _2, "xn--b-5ga": _2, "b\xF8": _2 }], "time": _2, "tingvoll": _2, "tinn": _2, "tjeldsund": _2, "tjome": _2, "xn--tjme-hra": _2, "tj\xF8me": _2, "tokke": _2, "tolga": _2, "tonsberg": _2, "xn--tnsberg-q1a": _2, "t\xF8nsberg": _2, "torsken": _2, "xn--trna-woa": _2, "tr\xE6na": _2, "trana": _2, "tranoy": _2, "xn--trany-yua": _2, "tran\xF8y": _2, "troandin": _2, "trogstad": _2, "xn--trgstad-r1a": _2, "tr\xF8gstad": _2, "tromsa": _2, "tromso": _2, "xn--troms-zua": _2, "troms\xF8": _2, "trondheim": _2, "trysil": _2, "tvedestrand": _2, "tydal": _2, "tynset": _2, "tysfjord": _2, "tysnes": _2, "xn--tysvr-vra": _2, "tysv\xE6r": _2, "tysvar": _2, "ullensaker": _2, "ullensvang": _2, "ulvik": _2, "unjarga": _2, "xn--unjrga-rta": _2, "unj\xE1rga": _2, "utsira": _2, "vaapste": _2, "vadso": _2, "xn--vads-jra": _2, "vads\xF8": _2, "xn--vry-yla5g": _2, "v\xE6r\xF8y": _2, "vaga": _2, "xn--vg-yiab": _2, "v\xE5g\xE5": _2, "vagan": _2, "xn--vgan-qoa": _2, "v\xE5gan": _2, "vagsoy": _2, "xn--vgsy-qoa0j": _2, "v\xE5gs\xF8y": _2, "vaksdal": _2, "valle": _2, "vang": _2, "vanylven": _2, "vardo": _2, "xn--vard-jra": _2, "vard\xF8": _2, "varggat": _2, "xn--vrggt-xqad": _2, "v\xE1rgg\xE1t": _2, "varoy": _2, "vefsn": _2, "vega": _2, "vegarshei": _2, "xn--vegrshei-c0a": _2, "veg\xE5rshei": _2, "vennesla": _2, "verdal": _2, "verran": _2, "vestby": _2, "vestfold": [0, { "sande": _2 }], "vestnes": _2, "vestre-slidre": _2, "vestre-toten": _2, "vestvagoy": _2, "xn--vestvgy-ixa6o": _2, "vestv\xE5g\xF8y": _2, "vevelstad": _2, "vik": _2, "vikna": _2, "vindafjord": _2, "voagat": _2, "volda": _2, "voss": _2, "co": _3, "123hjemmeside": _3, "myspreadshop": _3 }], "np": _21, "nr": _61, "nu": [1, { "merseine": _3, "mine": _3, "shacknet": _3, "enterprisecloud": _3 }], "nz": [1, { "ac": _2, "co": _2, "cri": _2, "geek": _2, "gen": _2, "govt": _2, "health": _2, "iwi": _2, "kiwi": _2, "maori": _2, "xn--mori-qsa": _2, "m\u0101ori": _2, "mil": _2, "net": _2, "org": _2, "parliament": _2, "school": _2, "cloudns": _3 }], "om": [1, { "co": _2, "com": _2, "edu": _2, "gov": _2, "med": _2, "museum": _2, "net": _2, "org": _2, "pro": _2 }], "onion": _2, "org": [1, { "altervista": _3, "pimienta": _3, "poivron": _3, "potager": _3, "sweetpepper": _3, "cdn77": [0, { "c": _3, "rsc": _3 }], "cdn77-secure": [0, { "origin": [0, { "ssl": _3 }] }], "ae": _3, "cloudns": _3, "ip-dynamic": _3, "ddnss": _3, "dpdns": _3, "duckdns": _3, "tunk": _3, "blogdns": _3, "blogsite": _3, "boldlygoingnowhere": _3, "dnsalias": _3, "dnsdojo": _3, "doesntexist": _3, "dontexist": _3, "doomdns": _3, "dvrdns": _3, "dynalias": _3, "dyndns": [2, { "go": _3, "home": _3 }], "endofinternet": _3, "endoftheinternet": _3, "from-me": _3, "game-host": _3, "gotdns": _3, "hobby-site": _3, "homedns": _3, "homeftp": _3, "homelinux": _3, "homeunix": _3, "is-a-bruinsfan": _3, "is-a-candidate": _3, "is-a-celticsfan": _3, "is-a-chef": _3, "is-a-geek": _3, "is-a-knight": _3, "is-a-linux-user": _3, "is-a-patsfan": _3, "is-a-soxfan": _3, "is-found": _3, "is-lost": _3, "is-saved": _3, "is-very-bad": _3, "is-very-evil": _3, "is-very-good": _3, "is-very-nice": _3, "is-very-sweet": _3, "isa-geek": _3, "kicks-ass": _3, "misconfused": _3, "podzone": _3, "readmyblog": _3, "selfip": _3, "sellsyourhome": _3, "servebbs": _3, "serveftp": _3, "servegame": _3, "stuff-4-sale": _3, "webhop": _3, "accesscam": _3, "camdvr": _3, "freeddns": _3, "mywire": _3, "roxa": _3, "webredirect": _3, "twmail": _3, "eu": [2, { "al": _3, "asso": _3, "at": _3, "au": _3, "be": _3, "bg": _3, "ca": _3, "cd": _3, "ch": _3, "cn": _3, "cy": _3, "cz": _3, "de": _3, "dk": _3, "edu": _3, "ee": _3, "es": _3, "fi": _3, "fr": _3, "gr": _3, "hr": _3, "hu": _3, "ie": _3, "il": _3, "in": _3, "int": _3, "is": _3, "it": _3, "jp": _3, "kr": _3, "lt": _3, "lu": _3, "lv": _3, "me": _3, "mk": _3, "mt": _3, "my": _3, "net": _3, "ng": _3, "nl": _3, "no": _3, "nz": _3, "pl": _3, "pt": _3, "ro": _3, "ru": _3, "se": _3, "si": _3, "sk": _3, "tr": _3, "uk": _3, "us": _3 }], "fedorainfracloud": _3, "fedorapeople": _3, "fedoraproject": [0, { "cloud": _3, "os": _46, "stg": [0, { "os": _46 }] }], "freedesktop": _3, "hatenadiary": _3, "hepforge": _3, "in-dsl": _3, "in-vpn": _3, "js": _3, "barsy": _3, "mayfirst": _3, "routingthecloud": _3, "bmoattachments": _3, "cable-modem": _3, "collegefan": _3, "couchpotatofries": _3, "hopto": _3, "mlbfan": _3, "myftp": _3, "mysecuritycamera": _3, "nflfan": _3, "no-ip": _3, "read-books": _3, "ufcfan": _3, "zapto": _3, "dynserv": _3, "now-dns": _3, "is-local": _3, "httpbin": _3, "pubtls": _3, "jpn": _3, "my-firewall": _3, "myfirewall": _3, "spdns": _3, "small-web": _3, "dsmynas": _3, "familyds": _3, "teckids": _60, "tuxfamily": _3, "hk": _3, "us": _3, "toolforge": _3, "wmcloud": [2, { "beta": _3 }], "wmflabs": _3, "za": _3 }], "pa": [1, { "abo": _2, "ac": _2, "com": _2, "edu": _2, "gob": _2, "ing": _2, "med": _2, "net": _2, "nom": _2, "org": _2, "sld": _2 }], "pe": [1, { "com": _2, "edu": _2, "gob": _2, "mil": _2, "net": _2, "nom": _2, "org": _2 }], "pf": [1, { "com": _2, "edu": _2, "org": _2 }], "pg": _21, "ph": [1, { "com": _2, "edu": _2, "gov": _2, "i": _2, "mil": _2, "net": _2, "ngo": _2, "org": _2, "cloudns": _3 }], "pk": [1, { "ac": _2, "biz": _2, "com": _2, "edu": _2, "fam": _2, "gkp": _2, "gob": _2, "gog": _2, "gok": _2, "gop": _2, "gos": _2, "gov": _2, "net": _2, "org": _2, "web": _2 }], "pl": [1, { "com": _2, "net": _2, "org": _2, "agro": _2, "aid": _2, "atm": _2, "auto": _2, "biz": _2, "edu": _2, "gmina": _2, "gsm": _2, "info": _2, "mail": _2, "media": _2, "miasta": _2, "mil": _2, "nieruchomosci": _2, "nom": _2, "pc": _2, "powiat": _2, "priv": _2, "realestate": _2, "rel": _2, "sex": _2, "shop": _2, "sklep": _2, "sos": _2, "szkola": _2, "targi": _2, "tm": _2, "tourism": _2, "travel": _2, "turystyka": _2, "gov": [1, { "ap": _2, "griw": _2, "ic": _2, "is": _2, "kmpsp": _2, "konsulat": _2, "kppsp": _2, "kwp": _2, "kwpsp": _2, "mup": _2, "mw": _2, "oia": _2, "oirm": _2, "oke": _2, "oow": _2, "oschr": _2, "oum": _2, "pa": _2, "pinb": _2, "piw": _2, "po": _2, "pr": _2, "psp": _2, "psse": _2, "pup": _2, "rzgw": _2, "sa": _2, "sdn": _2, "sko": _2, "so": _2, "sr": _2, "starostwo": _2, "ug": _2, "ugim": _2, "um": _2, "umig": _2, "upow": _2, "uppo": _2, "us": _2, "uw": _2, "uzs": _2, "wif": _2, "wiih": _2, "winb": _2, "wios": _2, "witd": _2, "wiw": _2, "wkz": _2, "wsa": _2, "wskr": _2, "wsse": _2, "wuoz": _2, "wzmiuw": _2, "zp": _2, "zpisdn": _2 }], "augustow": _2, "babia-gora": _2, "bedzin": _2, "beskidy": _2, "bialowieza": _2, "bialystok": _2, "bielawa": _2, "bieszczady": _2, "boleslawiec": _2, "bydgoszcz": _2, "bytom": _2, "cieszyn": _2, "czeladz": _2, "czest": _2, "dlugoleka": _2, "elblag": _2, "elk": _2, "glogow": _2, "gniezno": _2, "gorlice": _2, "grajewo": _2, "ilawa": _2, "jaworzno": _2, "jelenia-gora": _2, "jgora": _2, "kalisz": _2, "karpacz": _2, "kartuzy": _2, "kaszuby": _2, "katowice": _2, "kazimierz-dolny": _2, "kepno": _2, "ketrzyn": _2, "klodzko": _2, "kobierzyce": _2, "kolobrzeg": _2, "konin": _2, "konskowola": _2, "kutno": _2, "lapy": _2, "lebork": _2, "legnica": _2, "lezajsk": _2, "limanowa": _2, "lomza": _2, "lowicz": _2, "lubin": _2, "lukow": _2, "malbork": _2, "malopolska": _2, "mazowsze": _2, "mazury": _2, "mielec": _2, "mielno": _2, "mragowo": _2, "naklo": _2, "nowaruda": _2, "nysa": _2, "olawa": _2, "olecko": _2, "olkusz": _2, "olsztyn": _2, "opoczno": _2, "opole": _2, "ostroda": _2, "ostroleka": _2, "ostrowiec": _2, "ostrowwlkp": _2, "pila": _2, "pisz": _2, "podhale": _2, "podlasie": _2, "polkowice": _2, "pomorskie": _2, "pomorze": _2, "prochowice": _2, "pruszkow": _2, "przeworsk": _2, "pulawy": _2, "radom": _2, "rawa-maz": _2, "rybnik": _2, "rzeszow": _2, "sanok": _2, "sejny": _2, "skoczow": _2, "slask": _2, "slupsk": _2, "sosnowiec": _2, "stalowa-wola": _2, "starachowice": _2, "stargard": _2, "suwalki": _2, "swidnica": _2, "swiebodzin": _2, "swinoujscie": _2, "szczecin": _2, "szczytno": _2, "tarnobrzeg": _2, "tgory": _2, "turek": _2, "tychy": _2, "ustka": _2, "walbrzych": _2, "warmia": _2, "warszawa": _2, "waw": _2, "wegrow": _2, "wielun": _2, "wlocl": _2, "wloclawek": _2, "wodzislaw": _2, "wolomin": _2, "wroclaw": _2, "zachpomor": _2, "zagan": _2, "zarow": _2, "zgora": _2, "zgorzelec": _2, "art": _3, "gliwice": _3, "krakow": _3, "poznan": _3, "wroc": _3, "zakopane": _3, "beep": _3, "ecommerce-shop": _3, "cfolks": _3, "dfirma": _3, "dkonto": _3, "you2": _3, "shoparena": _3, "homesklep": _3, "sdscloud": _3, "unicloud": _3, "lodz": _3, "pabianice": _3, "plock": _3, "sieradz": _3, "skierniewice": _3, "zgierz": _3, "krasnik": _3, "leczna": _3, "lubartow": _3, "lublin": _3, "poniatowa": _3, "swidnik": _3, "co": _3, "torun": _3, "simplesite": _3, "myspreadshop": _3, "gda": _3, "gdansk": _3, "gdynia": _3, "med": _3, "sopot": _3, "bielsko": _3 }], "pm": [1, { "own": _3, "name": _3 }], "pn": [1, { "co": _2, "edu": _2, "gov": _2, "net": _2, "org": _2 }], "post": _2, "pr": [1, { "biz": _2, "com": _2, "edu": _2, "gov": _2, "info": _2, "isla": _2, "name": _2, "net": _2, "org": _2, "pro": _2, "ac": _2, "est": _2, "prof": _2 }], "pro": [1, { "aaa": _2, "aca": _2, "acct": _2, "avocat": _2, "bar": _2, "cpa": _2, "eng": _2, "jur": _2, "law": _2, "med": _2, "recht": _2, "cloudns": _3, "keenetic": _3, "barsy": _3, "ngrok": _3 }], "ps": [1, { "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "plo": _2, "sec": _2 }], "pt": [1, { "com": _2, "edu": _2, "gov": _2, "int": _2, "net": _2, "nome": _2, "org": _2, "publ": _2, "123paginaweb": _3 }], "pw": [1, { "gov": _2, "cloudns": _3, "x443": _3 }], "py": [1, { "com": _2, "coop": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2 }], "qa": [1, { "com": _2, "edu": _2, "gov": _2, "mil": _2, "name": _2, "net": _2, "org": _2, "sch": _2 }], "re": [1, { "asso": _2, "com": _2, "netlib": _3, "can": _3 }], "ro": [1, { "arts": _2, "com": _2, "firm": _2, "info": _2, "nom": _2, "nt": _2, "org": _2, "rec": _2, "store": _2, "tm": _2, "www": _2, "co": _3, "shop": _3, "barsy": _3 }], "rs": [1, { "ac": _2, "co": _2, "edu": _2, "gov": _2, "in": _2, "org": _2, "brendly": _20, "barsy": _3, "ox": _3 }], "ru": [1, { "ac": _3, "edu": _3, "gov": _3, "int": _3, "mil": _3, "eurodir": _3, "adygeya": _3, "bashkiria": _3, "bir": _3, "cbg": _3, "com": _3, "dagestan": _3, "grozny": _3, "kalmykia": _3, "kustanai": _3, "marine": _3, "mordovia": _3, "msk": _3, "mytis": _3, "nalchik": _3, "nov": _3, "pyatigorsk": _3, "spb": _3, "vladikavkaz": _3, "vladimir": _3, "na4u": _3, "mircloud": _3, "myjino": [2, { "hosting": _6, "landing": _6, "spectrum": _6, "vps": _6 }], "cldmail": [0, { "hb": _3 }], "mcdir": [2, { "vps": _3 }], "mcpre": _3, "net": _3, "org": _3, "pp": _3, "ras": _3 }], "rw": [1, { "ac": _2, "co": _2, "coop": _2, "gov": _2, "mil": _2, "net": _2, "org": _2 }], "sa": [1, { "com": _2, "edu": _2, "gov": _2, "med": _2, "net": _2, "org": _2, "pub": _2, "sch": _2 }], "sb": _4, "sc": _4, "sd": [1, { "com": _2, "edu": _2, "gov": _2, "info": _2, "med": _2, "net": _2, "org": _2, "tv": _2 }], "se": [1, { "a": _2, "ac": _2, "b": _2, "bd": _2, "brand": _2, "c": _2, "d": _2, "e": _2, "f": _2, "fh": _2, "fhsk": _2, "fhv": _2, "g": _2, "h": _2, "i": _2, "k": _2, "komforb": _2, "kommunalforbund": _2, "komvux": _2, "l": _2, "lanbib": _2, "m": _2, "n": _2, "naturbruksgymn": _2, "o": _2, "org": _2, "p": _2, "parti": _2, "pp": _2, "press": _2, "r": _2, "s": _2, "t": _2, "tm": _2, "u": _2, "w": _2, "x": _2, "y": _2, "z": _2, "com": _3, "iopsys": _3, "123minsida": _3, "itcouldbewor": _3, "myspreadshop": _3 }], "sg": [1, { "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "enscaled": _3 }], "sh": [1, { "com": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "hashbang": _3, "botda": _3, "lovable": _3, "platform": [0, { "ent": _3, "eu": _3, "us": _3 }], "teleport": _3, "now": _3 }], "si": [1, { "f5": _3, "gitapp": _3, "gitpage": _3 }], "sj": _2, "sk": [1, { "org": _2 }], "sl": _4, "sm": _2, "sn": [1, { "art": _2, "com": _2, "edu": _2, "gouv": _2, "org": _2, "univ": _2 }], "so": [1, { "com": _2, "edu": _2, "gov": _2, "me": _2, "net": _2, "org": _2, "surveys": _3 }], "sr": _2, "ss": [1, { "biz": _2, "co": _2, "com": _2, "edu": _2, "gov": _2, "me": _2, "net": _2, "org": _2, "sch": _2 }], "st": [1, { "co": _2, "com": _2, "consulado": _2, "edu": _2, "embaixada": _2, "mil": _2, "net": _2, "org": _2, "principe": _2, "saotome": _2, "store": _2, "helioho": _3, "cn": _6, "kirara": _3, "noho": _3 }], "su": [1, { "abkhazia": _3, "adygeya": _3, "aktyubinsk": _3, "arkhangelsk": _3, "armenia": _3, "ashgabad": _3, "azerbaijan": _3, "balashov": _3, "bashkiria": _3, "bryansk": _3, "bukhara": _3, "chimkent": _3, "dagestan": _3, "east-kazakhstan": _3, "exnet": _3, "georgia": _3, "grozny": _3, "ivanovo": _3, "jambyl": _3, "kalmykia": _3, "kaluga": _3, "karacol": _3, "karaganda": _3, "karelia": _3, "khakassia": _3, "krasnodar": _3, "kurgan": _3, "kustanai": _3, "lenug": _3, "mangyshlak": _3, "mordovia": _3, "msk": _3, "murmansk": _3, "nalchik": _3, "navoi": _3, "north-kazakhstan": _3, "nov": _3, "obninsk": _3, "penza": _3, "pokrovsk": _3, "sochi": _3, "spb": _3, "tashkent": _3, "termez": _3, "togliatti": _3, "troitsk": _3, "tselinograd": _3, "tula": _3, "tuva": _3, "vladikavkaz": _3, "vladimir": _3, "vologda": _3 }], "sv": [1, { "com": _2, "edu": _2, "gob": _2, "org": _2, "red": _2 }], "sx": _10, "sy": _5, "sz": [1, { "ac": _2, "co": _2, "org": _2 }], "tc": _2, "td": _2, "tel": _2, "tf": [1, { "sch": _3 }], "tg": _2, "th": [1, { "ac": _2, "co": _2, "go": _2, "in": _2, "mi": _2, "net": _2, "or": _2, "online": _3, "shop": _3 }], "tj": [1, { "ac": _2, "biz": _2, "co": _2, "com": _2, "edu": _2, "go": _2, "gov": _2, "int": _2, "mil": _2, "name": _2, "net": _2, "nic": _2, "org": _2, "test": _2, "web": _2 }], "tk": _2, "tl": _10, "tm": [1, { "co": _2, "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "nom": _2, "org": _2 }], "tn": [1, { "com": _2, "ens": _2, "fin": _2, "gov": _2, "ind": _2, "info": _2, "intl": _2, "mincom": _2, "nat": _2, "net": _2, "org": _2, "perso": _2, "tourism": _2, "orangecloud": _3 }], "to": [1, { "611": _3, "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "oya": _3, "x0": _3, "quickconnect": _29, "vpnplus": _3, "nett": _3 }], "tr": [1, { "av": _2, "bbs": _2, "bel": _2, "biz": _2, "com": _2, "dr": _2, "edu": _2, "gen": _2, "gov": _2, "info": _2, "k12": _2, "kep": _2, "mil": _2, "name": _2, "net": _2, "org": _2, "pol": _2, "tel": _2, "tsk": _2, "tv": _2, "web": _2, "nc": _10 }], "tt": [1, { "biz": _2, "co": _2, "com": _2, "edu": _2, "gov": _2, "info": _2, "mil": _2, "name": _2, "net": _2, "org": _2, "pro": _2 }], "tv": [1, { "better-than": _3, "dyndns": _3, "on-the-web": _3, "worse-than": _3, "from": _3, "sakura": _3 }], "tw": [1, { "club": _2, "com": [1, { "mymailer": _3 }], "ebiz": _2, "edu": _2, "game": _2, "gov": _2, "idv": _2, "mil": _2, "net": _2, "org": _2, "url": _3, "mydns": _3 }], "tz": [1, { "ac": _2, "co": _2, "go": _2, "hotel": _2, "info": _2, "me": _2, "mil": _2, "mobi": _2, "ne": _2, "or": _2, "sc": _2, "tv": _2 }], "ua": [1, { "com": _2, "edu": _2, "gov": _2, "in": _2, "net": _2, "org": _2, "cherkassy": _2, "cherkasy": _2, "chernigov": _2, "chernihiv": _2, "chernivtsi": _2, "chernovtsy": _2, "ck": _2, "cn": _2, "cr": _2, "crimea": _2, "cv": _2, "dn": _2, "dnepropetrovsk": _2, "dnipropetrovsk": _2, "donetsk": _2, "dp": _2, "if": _2, "ivano-frankivsk": _2, "kh": _2, "kharkiv": _2, "kharkov": _2, "kherson": _2, "khmelnitskiy": _2, "khmelnytskyi": _2, "kiev": _2, "kirovograd": _2, "km": _2, "kr": _2, "kropyvnytskyi": _2, "krym": _2, "ks": _2, "kv": _2, "kyiv": _2, "lg": _2, "lt": _2, "lugansk": _2, "luhansk": _2, "lutsk": _2, "lv": _2, "lviv": _2, "mk": _2, "mykolaiv": _2, "nikolaev": _2, "od": _2, "odesa": _2, "odessa": _2, "pl": _2, "poltava": _2, "rivne": _2, "rovno": _2, "rv": _2, "sb": _2, "sebastopol": _2, "sevastopol": _2, "sm": _2, "sumy": _2, "te": _2, "ternopil": _2, "uz": _2, "uzhgorod": _2, "uzhhorod": _2, "vinnica": _2, "vinnytsia": _2, "vn": _2, "volyn": _2, "yalta": _2, "zakarpattia": _2, "zaporizhzhe": _2, "zaporizhzhia": _2, "zhitomir": _2, "zhytomyr": _2, "zp": _2, "zt": _2, "cc": _3, "inf": _3, "ltd": _3, "cx": _3, "biz": _3, "co": _3, "pp": _3, "v": _3 }], "ug": [1, { "ac": _2, "co": _2, "com": _2, "edu": _2, "go": _2, "gov": _2, "mil": _2, "ne": _2, "or": _2, "org": _2, "sc": _2, "us": _2 }], "uk": [1, { "ac": _2, "co": [1, { "bytemark": [0, { "dh": _3, "vm": _3 }], "layershift": _49, "barsy": _3, "barsyonline": _3, "retrosnub": _59, "nh-serv": _3, "no-ip": _3, "adimo": _3, "myspreadshop": _3 }], "gov": [1, { "api": _3, "campaign": _3, "service": _3 }], "ltd": _2, "me": _2, "net": _2, "nhs": _2, "org": [1, { "glug": _3, "lug": _3, "lugs": _3, "affinitylottery": _3, "raffleentry": _3, "weeklylottery": _3 }], "plc": _2, "police": _2, "sch": _21, "conn": _3, "copro": _3, "hosp": _3, "independent-commission": _3, "independent-inquest": _3, "independent-inquiry": _3, "independent-panel": _3, "independent-review": _3, "public-inquiry": _3, "royal-commission": _3, "pymnt": _3, "barsy": _3, "nimsite": _3, "oraclegovcloudapps": _6 }], "us": [1, { "dni": _2, "isa": _2, "nsn": _2, "ak": _69, "al": _69, "ar": _69, "as": _69, "az": _69, "ca": _69, "co": _69, "ct": _69, "dc": _69, "de": _70, "fl": _69, "ga": _69, "gu": _69, "hi": _71, "ia": _69, "id": _69, "il": _69, "in": _69, "ks": _69, "ky": _69, "la": _69, "ma": [1, { "k12": [1, { "chtr": _2, "paroch": _2, "pvt": _2 }], "cc": _2, "lib": _2 }], "md": _69, "me": _69, "mi": [1, { "k12": _2, "cc": _2, "lib": _2, "ann-arbor": _2, "cog": _2, "dst": _2, "eaton": _2, "gen": _2, "mus": _2, "tec": _2, "washtenaw": _2 }], "mn": _69, "mo": _69, "ms": [1, { "k12": _2, "cc": _2 }], "mt": _69, "nc": _69, "nd": _71, "ne": _69, "nh": _69, "nj": _69, "nm": _69, "nv": _69, "ny": _69, "oh": _69, "ok": _69, "or": _69, "pa": _69, "pr": _69, "ri": _71, "sc": _69, "sd": _71, "tn": _69, "tx": _69, "ut": _69, "va": _69, "vi": _69, "vt": _69, "wa": _69, "wi": _69, "wv": _70, "wy": _69, "cloudns": _3, "is-by": _3, "land-4-sale": _3, "stuff-4-sale": _3, "heliohost": _3, "enscaled": [0, { "phx": _3 }], "mircloud": _3, "azure-api": _3, "azurewebsites": _3, "ngo": _3, "golffan": _3, "noip": _3, "pointto": _3, "freeddns": _3, "srv": [2, { "gh": _3, "gl": _3 }], "servername": _3 }], "uy": [1, { "com": _2, "edu": _2, "gub": _2, "mil": _2, "net": _2, "org": _2, "gv": _3 }], "uz": [1, { "co": _2, "com": _2, "net": _2, "org": _2 }], "va": _2, "vc": [1, { "com": _2, "edu": _2, "gov": _2, "mil": _2, "net": _2, "org": _2, "gv": [2, { "d": _3 }], "0e": _6, "mydns": _3 }], "ve": [1, { "arts": _2, "bib": _2, "co": _2, "com": _2, "e12": _2, "edu": _2, "emprende": _2, "firm": _2, "gob": _2, "gov": _2, "ia": _2, "info": _2, "int": _2, "mil": _2, "net": _2, "nom": _2, "org": _2, "rar": _2, "rec": _2, "store": _2, "tec": _2, "web": _2 }], "vg": [1, { "edu": _2 }], "vi": [1, { "co": _2, "com": _2, "k12": _2, "net": _2, "org": _2 }], "vn": [1, { "ac": _2, "ai": _2, "biz": _2, "com": _2, "edu": _2, "gov": _2, "health": _2, "id": _2, "info": _2, "int": _2, "io": _2, "name": _2, "net": _2, "org": _2, "pro": _2, "angiang": _2, "bacgiang": _2, "backan": _2, "baclieu": _2, "bacninh": _2, "baria-vungtau": _2, "bentre": _2, "binhdinh": _2, "binhduong": _2, "binhphuoc": _2, "binhthuan": _2, "camau": _2, "cantho": _2, "caobang": _2, "daklak": _2, "daknong": _2, "danang": _2, "dienbien": _2, "dongnai": _2, "dongthap": _2, "gialai": _2, "hagiang": _2, "haiduong": _2, "haiphong": _2, "hanam": _2, "hanoi": _2, "hatinh": _2, "haugiang": _2, "hoabinh": _2, "hue": _2, "hungyen": _2, "khanhhoa": _2, "kiengiang": _2, "kontum": _2, "laichau": _2, "lamdong": _2, "langson": _2, "laocai": _2, "longan": _2, "namdinh": _2, "nghean": _2, "ninhbinh": _2, "ninhthuan": _2, "phutho": _2, "phuyen": _2, "quangbinh": _2, "quangnam": _2, "quangngai": _2, "quangninh": _2, "quangtri": _2, "soctrang": _2, "sonla": _2, "tayninh": _2, "thaibinh": _2, "thainguyen": _2, "thanhhoa": _2, "thanhphohochiminh": _2, "thuathienhue": _2, "tiengiang": _2, "travinh": _2, "tuyenquang": _2, "vinhlong": _2, "vinhphuc": _2, "yenbai": _2 }], "vu": _48, "wf": [1, { "biz": _3, "sch": _3 }], "ws": [1, { "com": _2, "edu": _2, "gov": _2, "net": _2, "org": _2, "advisor": _6, "cloud66": _3, "dyndns": _3, "mypets": _3 }], "yt": [1, { "org": _3 }], "xn--mgbaam7a8h": _2, "\u0627\u0645\u0627\u0631\u0627\u062A": _2, "xn--y9a3aq": _2, "\u0570\u0561\u0575": _2, "xn--54b7fta0cc": _2, "\u09AC\u09BE\u0982\u09B2\u09BE": _2, "xn--90ae": _2, "\u0431\u0433": _2, "xn--mgbcpq6gpa1a": _2, "\u0627\u0644\u0628\u062D\u0631\u064A\u0646": _2, "xn--90ais": _2, "\u0431\u0435\u043B": _2, "xn--fiqs8s": _2, "\u4E2D\u56FD": _2, "xn--fiqz9s": _2, "\u4E2D\u570B": _2, "xn--lgbbat1ad8j": _2, "\u0627\u0644\u062C\u0632\u0627\u0626\u0631": _2, "xn--wgbh1c": _2, "\u0645\u0635\u0631": _2, "xn--e1a4c": _2, "\u0435\u044E": _2, "xn--qxa6a": _2, "\u03B5\u03C5": _2, "xn--mgbah1a3hjkrd": _2, "\u0645\u0648\u0631\u064A\u062A\u0627\u0646\u064A\u0627": _2, "xn--node": _2, "\u10D2\u10D4": _2, "xn--qxam": _2, "\u03B5\u03BB": _2, "xn--j6w193g": [1, { "xn--gmqw5a": _2, "xn--55qx5d": _2, "xn--mxtq1m": _2, "xn--wcvs22d": _2, "xn--uc0atv": _2, "xn--od0alg": _2 }], "\u9999\u6E2F": [1, { "\u500B\u4EBA": _2, "\u516C\u53F8": _2, "\u653F\u5E9C": _2, "\u6559\u80B2": _2, "\u7D44\u7E54": _2, "\u7DB2\u7D61": _2 }], "xn--2scrj9c": _2, "\u0CAD\u0CBE\u0CB0\u0CA4": _2, "xn--3hcrj9c": _2, "\u0B2D\u0B3E\u0B30\u0B24": _2, "xn--45br5cyl": _2, "\u09AD\u09BE\u09F0\u09A4": _2, "xn--h2breg3eve": _2, "\u092D\u093E\u0930\u0924\u092E\u094D": _2, "xn--h2brj9c8c": _2, "\u092D\u093E\u0930\u094B\u0924": _2, "xn--mgbgu82a": _2, "\u0680\u0627\u0631\u062A": _2, "xn--rvc1e0am3e": _2, "\u0D2D\u0D3E\u0D30\u0D24\u0D02": _2, "xn--h2brj9c": _2, "\u092D\u093E\u0930\u0924": _2, "xn--mgbbh1a": _2, "\u0628\u0627\u0631\u062A": _2, "xn--mgbbh1a71e": _2, "\u0628\u06BE\u0627\u0631\u062A": _2, "xn--fpcrj9c3d": _2, "\u0C2D\u0C3E\u0C30\u0C24\u0C4D": _2, "xn--gecrj9c": _2, "\u0AAD\u0ABE\u0AB0\u0AA4": _2, "xn--s9brj9c": _2, "\u0A2D\u0A3E\u0A30\u0A24": _2, "xn--45brj9c": _2, "\u09AD\u09BE\u09B0\u09A4": _2, "xn--xkc2dl3a5ee0h": _2, "\u0B87\u0BA8\u0BCD\u0BA4\u0BBF\u0BAF\u0BBE": _2, "xn--mgba3a4f16a": _2, "\u0627\u06CC\u0631\u0627\u0646": _2, "xn--mgba3a4fra": _2, "\u0627\u064A\u0631\u0627\u0646": _2, "xn--mgbtx2b": _2, "\u0639\u0631\u0627\u0642": _2, "xn--mgbayh7gpa": _2, "\u0627\u0644\u0627\u0631\u062F\u0646": _2, "xn--3e0b707e": _2, "\uD55C\uAD6D": _2, "xn--80ao21a": _2, "\u049B\u0430\u0437": _2, "xn--q7ce6a": _2, "\u0EA5\u0EB2\u0EA7": _2, "xn--fzc2c9e2c": _2, "\u0DBD\u0D82\u0D9A\u0DCF": _2, "xn--xkc2al3hye2a": _2, "\u0B87\u0BB2\u0B99\u0BCD\u0B95\u0BC8": _2, "xn--mgbc0a9azcg": _2, "\u0627\u0644\u0645\u063A\u0631\u0628": _2, "xn--d1alf": _2, "\u043C\u043A\u0434": _2, "xn--l1acc": _2, "\u043C\u043E\u043D": _2, "xn--mix891f": _2, "\u6FB3\u9580": _2, "xn--mix082f": _2, "\u6FB3\u95E8": _2, "xn--mgbx4cd0ab": _2, "\u0645\u0644\u064A\u0633\u064A\u0627": _2, "xn--mgb9awbf": _2, "\u0639\u0645\u0627\u0646": _2, "xn--mgbai9azgqp6j": _2, "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646": _2, "xn--mgbai9a5eva00b": _2, "\u067E\u0627\u0643\u0633\u062A\u0627\u0646": _2, "xn--ygbi2ammx": _2, "\u0641\u0644\u0633\u0637\u064A\u0646": _2, "xn--90a3ac": [1, { "xn--80au": _2, "xn--90azh": _2, "xn--d1at": _2, "xn--c1avg": _2, "xn--o1ac": _2, "xn--o1ach": _2 }], "\u0441\u0440\u0431": [1, { "\u0430\u043A": _2, "\u043E\u0431\u0440": _2, "\u043E\u0434": _2, "\u043E\u0440\u0433": _2, "\u043F\u0440": _2, "\u0443\u043F\u0440": _2 }], "xn--p1ai": _2, "\u0440\u0444": _2, "xn--wgbl6a": _2, "\u0642\u0637\u0631": _2, "xn--mgberp4a5d4ar": _2, "\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629": _2, "xn--mgberp4a5d4a87g": _2, "\u0627\u0644\u0633\u0639\u0648\u062F\u06CC\u0629": _2, "xn--mgbqly7c0a67fbc": _2, "\u0627\u0644\u0633\u0639\u0648\u062F\u06CC\u06C3": _2, "xn--mgbqly7cvafr": _2, "\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0647": _2, "xn--mgbpl2fh": _2, "\u0633\u0648\u062F\u0627\u0646": _2, "xn--yfro4i67o": _2, "\u65B0\u52A0\u5761": _2, "xn--clchc0ea0b2g2a9gcd": _2, "\u0B9A\u0BBF\u0B99\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0BC2\u0BB0\u0BCD": _2, "xn--ogbpf8fl": _2, "\u0633\u0648\u0631\u064A\u0629": _2, "xn--mgbtf8fl": _2, "\u0633\u0648\u0631\u064A\u0627": _2, "xn--o3cw4h": [1, { "xn--o3cyx2a": _2, "xn--12co0c3b4eva": _2, "xn--m3ch0j3a": _2, "xn--h3cuzk1di": _2, "xn--12c1fe0br": _2, "xn--12cfi8ixb8l": _2 }], "\u0E44\u0E17\u0E22": [1, { "\u0E17\u0E2B\u0E32\u0E23": _2, "\u0E18\u0E38\u0E23\u0E01\u0E34\u0E08": _2, "\u0E40\u0E19\u0E47\u0E15": _2, "\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25": _2, "\u0E28\u0E36\u0E01\u0E29\u0E32": _2, "\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23": _2 }], "xn--pgbs0dh": _2, "\u062A\u0648\u0646\u0633": _2, "xn--kpry57d": _2, "\u53F0\u7063": _2, "xn--kprw13d": _2, "\u53F0\u6E7E": _2, "xn--nnx388a": _2, "\u81FA\u7063": _2, "xn--j1amh": _2, "\u0443\u043A\u0440": _2, "xn--mgb2ddes": _2, "\u0627\u0644\u064A\u0645\u0646": _2, "xxx": _2, "ye": _5, "za": [0, { "ac": _2, "agric": _2, "alt": _2, "co": _2, "edu": _2, "gov": _2, "grondar": _2, "law": _2, "mil": _2, "net": _2, "ngo": _2, "nic": _2, "nis": _2, "nom": _2, "org": _2, "school": _2, "tm": _2, "web": _2 }], "zm": [1, { "ac": _2, "biz": _2, "co": _2, "com": _2, "edu": _2, "gov": _2, "info": _2, "mil": _2, "net": _2, "org": _2, "sch": _2 }], "zw": [1, { "ac": _2, "co": _2, "gov": _2, "mil": _2, "org": _2 }], "aaa": _2, "aarp": _2, "abb": _2, "abbott": _2, "abbvie": _2, "abc": _2, "able": _2, "abogado": _2, "abudhabi": _2, "academy": [1, { "official": _3 }], "accenture": _2, "accountant": _2, "accountants": _2, "aco": _2, "actor": _2, "ads": _2, "adult": _2, "aeg": _2, "aetna": _2, "afl": _2, "africa": _2, "agakhan": _2, "agency": _2, "aig": _2, "airbus": _2, "airforce": _2, "airtel": _2, "akdn": _2, "alibaba": _2, "alipay": _2, "allfinanz": _2, "allstate": _2, "ally": _2, "alsace": _2, "alstom": _2, "amazon": _2, "americanexpress": _2, "americanfamily": _2, "amex": _2, "amfam": _2, "amica": _2, "amsterdam": _2, "analytics": _2, "android": _2, "anquan": _2, "anz": _2, "aol": _2, "apartments": _2, "app": [1, { "adaptable": _3, "aiven": _3, "beget": _6, "brave": _7, "clerk": _3, "clerkstage": _3, "cloudflare": _3, "wnext": _3, "csb": [2, { "preview": _3 }], "convex": _3, "corespeed": _3, "deta": _3, "ondigitalocean": _3, "easypanel": _3, "encr": [2, { "frontend": _3 }], "evervault": _8, "expo": [2, { "on": _3, "staging": [2, { "on": _3 }] }], "edgecompute": _3, "on-fleek": _3, "flutterflow": _3, "sprites": _3, "e2b": _3, "framer": _3, "gadget": _3, "github": _3, "hosted": _6, "run": [0, { "*": _3, "mtls": _6 }], "web": _3, "hackclub": _3, "hasura": _3, "onhercules": _3, "botdash": _3, "shiptoday": _3, "leapcell": _3, "loginline": _3, "lovable": _3, "luyani": _3, "magicpatterns": _3, "medusajs": _3, "messerli": _3, "miren": _3, "mocha": _3, "netlify": _3, "ngrok": _3, "ngrok-free": _3, "developer": _6, "noop": _3, "northflank": _6, "upsun": _6, "railway": [0, { "up": _3 }], "replit": _9, "nyat": _3, "snowflake": [0, { "*": _3, "privatelink": _6 }], "streamlit": _3, "spawnbase": _3, "telebit": _3, "typedream": _3, "vercel": _3, "wal": _3, "wasmer": _3, "bookonline": _3, "windsurf": _3, "base44": _3, "zeabur": _3, "zerops": _6 }], "apple": [1, { "int": [2, { "cloud": [0, { "*": _3, "r": [0, { "*": _3, "ap-north-1": _6, "ap-south-1": _6, "ap-south-2": _6, "eu-central-1": _6, "eu-north-1": _6, "us-central-1": _6, "us-central-2": _6, "us-east-1": _6, "us-east-2": _6, "us-west-1": _6, "us-west-2": _6, "us-west-3": _6 }] }] }] }], "aquarelle": _2, "arab": _2, "aramco": _2, "archi": _2, "army": _2, "art": _2, "arte": _2, "asda": _2, "associates": _2, "athleta": _2, "attorney": _2, "auction": _2, "audi": _2, "audible": _2, "audio": _2, "auspost": _2, "author": _2, "auto": _2, "autos": _2, "aws": [1, { "on": [0, { "af-south-1": _11, "ap-east-1": _11, "ap-northeast-1": _11, "ap-northeast-2": _11, "ap-northeast-3": _11, "ap-south-1": _11, "ap-south-2": _12, "ap-southeast-1": _11, "ap-southeast-2": _11, "ap-southeast-3": _11, "ap-southeast-4": _12, "ap-southeast-5": _12, "ca-central-1": _11, "ca-west-1": _12, "eu-central-1": _11, "eu-central-2": _12, "eu-north-1": _11, "eu-south-1": _11, "eu-south-2": _12, "eu-west-1": _11, "eu-west-2": _11, "eu-west-3": _11, "il-central-1": _12, "me-central-1": _12, "me-south-1": _11, "sa-east-1": _11, "us-east-1": _11, "us-east-2": _11, "us-west-1": _11, "us-west-2": _11, "ap-southeast-7": _13, "mx-central-1": _13, "us-gov-east-1": _14, "us-gov-west-1": _14 }], "sagemaker": [0, { "ap-northeast-1": _16, "ap-northeast-2": _16, "ap-south-1": _16, "ap-southeast-1": _16, "ap-southeast-2": _16, "ca-central-1": _18, "eu-central-1": _16, "eu-west-1": _16, "eu-west-2": _16, "us-east-1": _18, "us-east-2": _18, "us-west-2": _18, "af-south-1": _15, "ap-east-1": _15, "ap-northeast-3": _15, "ap-south-2": _17, "ap-southeast-3": _15, "ap-southeast-4": _17, "ca-west-1": [0, { "notebook": _3, "notebook-fips": _3 }], "eu-central-2": _15, "eu-north-1": _15, "eu-south-1": _15, "eu-south-2": _15, "eu-west-3": _15, "il-central-1": _15, "me-central-1": _15, "me-south-1": _15, "sa-east-1": _15, "us-gov-east-1": _19, "us-gov-west-1": _19, "us-west-1": [0, { "notebook": _3, "notebook-fips": _3, "studio": _3 }], "experiments": _6 }], "repost": [0, { "private": _6 }] }], "axa": _2, "azure": _2, "baby": _2, "baidu": _2, "banamex": _2, "band": _2, "bank": _2, "bar": _2, "barcelona": _2, "barclaycard": _2, "barclays": _2, "barefoot": _2, "bargains": _2, "baseball": _2, "basketball": [1, { "aus": _3, "nz": _3 }], "bauhaus": _2, "bayern": _2, "bbc": _2, "bbt": _2, "bbva": _2, "bcg": _2, "bcn": _2, "beats": _2, "beauty": _2, "beer": _2, "berlin": _2, "best": _2, "bestbuy": _2, "bet": _2, "bharti": _2, "bible": _2, "bid": _2, "bike": _2, "bing": _2, "bingo": _2, "bio": _2, "black": _2, "blackfriday": _2, "blockbuster": _2, "blog": _2, "bloomberg": _2, "blue": _2, "bms": _2, "bmw": _2, "bnpparibas": _2, "boats": _2, "boehringer": _2, "bofa": _2, "bom": _2, "bond": _2, "boo": _2, "book": _2, "booking": _2, "bosch": _2, "bostik": _2, "boston": _2, "bot": _2, "boutique": _2, "box": _2, "bradesco": _2, "bridgestone": _2, "broadway": _2, "broker": _2, "brother": _2, "brussels": _2, "build": [1, { "shiptoday": _3, "v0": _3, "windsurf": _3 }], "builders": [1, { "cloudsite": _3 }], "business": _22, "buy": _2, "buzz": _2, "bzh": _2, "cab": _2, "cafe": _2, "cal": _2, "call": _2, "calvinklein": _2, "cam": _2, "camera": _2, "camp": [1, { "emf": [0, { "at": _3 }] }], "canon": _2, "capetown": _2, "capital": _2, "capitalone": _2, "car": _2, "caravan": _2, "cards": _2, "care": _2, "career": _2, "careers": _2, "cars": _2, "casa": [1, { "nabu": [0, { "ui": _3 }] }], "case": [1, { "sav": _3 }], "cash": _2, "casino": _2, "catering": _2, "catholic": _2, "cba": _2, "cbn": _2, "cbre": _2, "center": _2, "ceo": _2, "cern": _2, "cfa": _2, "cfd": _2, "chanel": _2, "channel": _2, "charity": _2, "chase": _2, "chat": _2, "cheap": _2, "chintai": _2, "christmas": _2, "chrome": _2, "church": _2, "cipriani": _2, "circle": _2, "cisco": _2, "citadel": _2, "citi": _2, "citic": _2, "city": _2, "claims": _2, "cleaning": _2, "click": _2, "clinic": _2, "clinique": _2, "clothing": _2, "cloud": [1, { "antagonist": _3, "begetcdn": _6, "convex": _24, "elementor": _3, "emergent": _3, "encoway": [0, { "eu": _3 }], "statics": _6, "ravendb": _3, "axarnet": [0, { "es-1": _3 }], "diadem": _3, "jelastic": [0, { "vip": _3 }], "jele": _3, "jenv-aruba": [0, { "aruba": [0, { "eur": [0, { "it1": _3 }] }], "it1": _3 }], "keliweb": [2, { "cs": _3 }], "oxa": [2, { "tn": _3, "uk": _3 }], "primetel": [2, { "uk": _3 }], "reclaim": [0, { "ca": _3, "uk": _3, "us": _3 }], "trendhosting": [0, { "ch": _3, "de": _3 }], "jote": _3, "jotelulu": _3, "kuleuven": _3, "laravel": _3, "linkyard": _3, "magentosite": _6, "matlab": _3, "observablehq": _3, "perspecta": _3, "vapor": _3, "on-rancher": _6, "scw": [0, { "baremetal": [0, { "fr-par-1": _3, "fr-par-2": _3, "nl-ams-1": _3 }], "fr-par": [0, { "cockpit": _3, "ddl": _3, "dtwh": _3, "fnc": [2, { "functions": _3 }], "ifr": _3, "k8s": _25, "kafk": _3, "mgdb": _3, "rdb": _3, "s3": _3, "s3-website": _3, "scbl": _3, "whm": _3 }], "instances": [0, { "priv": _3, "pub": _3 }], "k8s": _3, "nl-ams": [0, { "cockpit": _3, "ddl": _3, "dtwh": _3, "ifr": _3, "k8s": _25, "kafk": _3, "mgdb": _3, "rdb": _3, "s3": _3, "s3-website": _3, "scbl": _3, "whm": _3 }], "pl-waw": [0, { "cockpit": _3, "ddl": _3, "dtwh": _3, "ifr": _3, "k8s": _25, "kafk": _3, "mgdb": _3, "rdb": _3, "s3": _3, "s3-website": _3, "scbl": _3 }], "scalebook": _3, "smartlabeling": _3 }], "servebolt": _3, "onstackit": [0, { "runs": _3 }], "trafficplex": _3, "unison-services": _3, "urown": _3, "voorloper": _3, "zap": _3 }], "club": [1, { "cloudns": _3, "jele": _3, "barsy": _3 }], "clubmed": _2, "coach": _2, "codes": [1, { "owo": _6 }], "coffee": _2, "college": _2, "cologne": _2, "commbank": _2, "community": [1, { "nog": _3, "ravendb": _3, "myforum": _3 }], "company": [1, { "mybox": _3 }], "compare": _2, "computer": _2, "comsec": _2, "condos": _2, "construction": _2, "consulting": _2, "contact": _2, "contractors": _2, "cooking": _2, "cool": [1, { "elementor": _3, "de": _3 }], "corsica": _2, "country": _2, "coupon": _2, "coupons": _2, "courses": _2, "cpa": _2, "credit": _2, "creditcard": _2, "creditunion": _2, "cricket": _2, "crown": _2, "crs": _2, "cruise": _2, "cruises": _2, "cuisinella": _2, "cymru": _2, "cyou": _2, "dad": _2, "dance": _2, "data": _2, "date": _2, "dating": _2, "datsun": _2, "day": _2, "dclk": _2, "dds": _2, "deal": _2, "dealer": _2, "deals": _2, "degree": _2, "delivery": _2, "dell": _2, "deloitte": _2, "delta": _2, "democrat": _2, "dental": _2, "dentist": _2, "desi": _2, "design": [1, { "graphic": _3, "bss": _3 }], "dev": [1, { "myaddr": _3, "panel": _3, "bearblog": _3, "brave": _7, "lcl": _6, "lclstage": _6, "stg": _6, "stgstage": _6, "pages": _3, "r2": _3, "workers": _3, "deno": _3, "deno-staging": _3, "deta": _3, "lp": [2, { "api": _3, "objects": _3 }], "evervault": _8, "fly": _3, "githubpreview": _3, "gateway": _6, "grebedoc": _3, "botdash": _3, "inbrowser": _6, "is-a-good": _3, "iserv": _3, "leapcell": _3, "runcontainers": _3, "localcert": [0, { "user": _6 }], "loginline": _3, "barsy": _3, "mediatech": _3, "mocha-sandbox": _3, "modx": _3, "ngrok": _3, "ngrok-free": _3, "is-a-fullstack": _3, "is-cool": _3, "is-not-a": _3, "localplayer": _3, "xmit": _3, "platter-app": _3, "replit": [2, { "archer": _3, "bones": _3, "canary": _3, "global": _3, "hacker": _3, "id": _3, "janeway": _3, "kim": _3, "kira": _3, "kirk": _3, "odo": _3, "paris": _3, "picard": _3, "pike": _3, "prerelease": _3, "reed": _3, "riker": _3, "sisko": _3, "spock": _3, "staging": _3, "sulu": _3, "tarpit": _3, "teams": _3, "tucker": _3, "wesley": _3, "worf": _3 }], "crm": [0, { "aa": _6, "ab": _6, "ac": _6, "ad": _6, "ae": _6, "af": _6, "ci": _6, "d": _6, "pa": _6, "pb": _6, "pc": _6, "pd": _6, "pe": _6, "pf": _6, "w": _6, "wa": _6, "wb": _6, "wc": _6, "wd": _6, "we": _6, "wf": _6 }], "erp": _51, "vercel": _3, "webhare": _6, "hrsn": _3, "is-a": _3 }], "dhl": _2, "diamonds": _2, "diet": _2, "digital": [1, { "cloudapps": [2, { "london": _3 }] }], "direct": [1, { "libp2p": _3 }], "directory": _2, "discount": _2, "discover": _2, "dish": _2, "diy": [1, { "discourse": _3, "imagine": _3 }], "dnp": _2, "docs": _2, "doctor": _2, "dog": _2, "domains": _2, "dot": _2, "download": _2, "drive": _2, "dtv": _2, "dubai": _2, "dupont": _2, "durban": _2, "dvag": _2, "dvr": _2, "earth": _2, "eat": _2, "eco": _2, "edeka": _2, "education": _22, "email": [1, { "crisp": [0, { "on": _3 }], "intouch": _3, "tawk": _53, "tawkto": _53 }], "emerck": _2, "energy": _2, "engineer": _2, "engineering": _2, "enterprises": _2, "epson": _2, "equipment": _2, "ericsson": _2, "erni": _2, "esq": _2, "estate": [1, { "compute": _6 }], "eurovision": _2, "eus": [1, { "party": _54 }], "events": [1, { "koobin": _3, "co": _3 }], "exchange": _2, "expert": _2, "exposed": _2, "express": _2, "extraspace": _2, "fage": _2, "fail": _2, "fairwinds": _2, "faith": _2, "family": _2, "fan": _2, "fans": _2, "farm": [1, { "storj": _3 }], "farmers": _2, "fashion": _2, "fast": _2, "fedex": _2, "feedback": _2, "ferrari": _2, "ferrero": _2, "fidelity": _2, "fido": _2, "film": _2, "final": _2, "finance": _2, "financial": _22, "fire": _2, "firestone": _2, "firmdale": _2, "fish": _2, "fishing": _2, "fit": _2, "fitness": _2, "flickr": _2, "flights": _2, "flir": _2, "florist": _2, "flowers": _2, "fly": _2, "foo": _2, "food": _2, "football": _2, "ford": _2, "forex": _2, "forsale": _2, "forum": _2, "foundation": _2, "fox": _2, "free": _2, "fresenius": _2, "frl": _2, "frogans": _2, "frontier": _2, "ftr": _2, "fujitsu": _2, "fun": _55, "fund": _2, "furniture": _2, "futbol": _2, "fyi": _2, "gal": _2, "gallery": _2, "gallo": _2, "gallup": _2, "game": _2, "games": [1, { "pley": _3, "sheezy": _3 }], "gap": _2, "garden": _2, "gay": [1, { "pages": _3 }], "gbiz": _2, "gdn": [1, { "cnpy": _3 }], "gea": _2, "gent": _2, "genting": _2, "george": _2, "ggee": _2, "gift": _2, "gifts": _2, "gives": _2, "giving": _2, "glass": _2, "gle": _2, "global": [1, { "appwrite": _3 }], "globo": _2, "gmail": _2, "gmbh": _2, "gmo": _2, "gmx": _2, "godaddy": _2, "gold": _2, "goldpoint": _2, "golf": _2, "goodyear": _2, "goog": [1, { "cloud": _3, "translate": _3, "usercontent": _6 }], "google": _2, "gop": _2, "got": _2, "grainger": _2, "graphics": _2, "gratis": _2, "green": _2, "gripe": _2, "grocery": _2, "group": [1, { "discourse": _3 }], "gucci": _2, "guge": _2, "guide": _2, "guitars": _2, "guru": _2, "hair": _2, "hamburg": _2, "hangout": _2, "haus": _2, "hbo": _2, "hdfc": _2, "hdfcbank": _2, "health": [1, { "hra": _3 }], "healthcare": _2, "help": _2, "helsinki": _2, "here": _2, "hermes": _2, "hiphop": _2, "hisamitsu": _2, "hitachi": _2, "hiv": _2, "hkt": _2, "hockey": _2, "holdings": _2, "holiday": _2, "homedepot": _2, "homegoods": _2, "homes": _2, "homesense": _2, "honda": _2, "horse": _2, "hospital": _2, "host": [1, { "cloudaccess": _3, "freesite": _3, "easypanel": _3, "emergent": _3, "fastvps": _3, "myfast": _3, "gadget": _3, "tempurl": _3, "wpmudev": _3, "iserv": _3, "jele": _3, "mircloud": _3, "bolt": _3, "wp2": _3, "half": _3 }], "hosting": [1, { "opencraft": _3 }], "hot": _2, "hotel": _2, "hotels": _2, "hotmail": _2, "house": _2, "how": _2, "hsbc": _2, "hughes": _2, "hyatt": _2, "hyundai": _2, "ibm": _2, "icbc": _2, "ice": _2, "icu": _2, "ieee": _2, "ifm": _2, "ikano": _2, "imamat": _2, "imdb": _2, "immo": _2, "immobilien": _2, "inc": _2, "industries": _2, "infiniti": _2, "ing": _2, "ink": _2, "institute": _2, "insurance": _2, "insure": _2, "international": _2, "intuit": _2, "investments": _2, "ipiranga": _2, "irish": _2, "ismaili": _2, "ist": _2, "istanbul": _2, "itau": _2, "itv": _2, "jaguar": _2, "java": _2, "jcb": _2, "jeep": _2, "jetzt": _2, "jewelry": _2, "jio": _2, "jll": _2, "jmp": _2, "jnj": _2, "joburg": _2, "jot": _2, "joy": _2, "jpmorgan": _2, "jprs": _2, "juegos": _2, "juniper": _2, "kaufen": _2, "kddi": _2, "kerryhotels": _2, "kerryproperties": _2, "kfh": _2, "kia": _2, "kids": _2, "kim": _2, "kindle": _2, "kitchen": _2, "kiwi": _2, "koeln": _2, "komatsu": _2, "kosher": _2, "kpmg": _2, "kpn": _2, "krd": [1, { "co": _3, "edu": _3 }], "kred": _2, "kuokgroup": _2, "kyoto": _2, "lacaixa": _2, "lamborghini": _2, "lamer": _2, "land": _2, "landrover": _2, "lanxess": _2, "lasalle": _2, "lat": _2, "latino": _2, "latrobe": _2, "law": _2, "lawyer": _2, "lds": _2, "lease": _2, "leclerc": _2, "lefrak": _2, "legal": _2, "lego": _2, "lexus": _2, "lgbt": _2, "lidl": _2, "life": _2, "lifeinsurance": _2, "lifestyle": _2, "lighting": _2, "like": _2, "lilly": _2, "limited": _2, "limo": _2, "lincoln": _2, "link": [1, { "myfritz": _3, "cyon": _3, "joinmc": _3, "dweb": _6, "inbrowser": _6, "keenetic": _3, "nftstorage": _62, "mypep": _3, "storacha": _62, "w3s": _62 }], "live": [1, { "aem": _3, "hlx": _3, "ewp": _6 }], "living": _2, "llc": _2, "llp": _2, "loan": _2, "loans": _2, "locker": _2, "locus": _2, "lol": [1, { "omg": _3 }], "london": _2, "lotte": _2, "lotto": _2, "love": _2, "lpl": _2, "lplfinancial": _2, "ltd": _2, "ltda": _2, "lundbeck": _2, "luxe": _2, "luxury": _2, "madrid": _2, "maif": _2, "maison": _2, "makeup": _2, "man": _2, "management": _2, "mango": _2, "map": _2, "market": _2, "marketing": _2, "markets": _2, "marriott": _2, "marshalls": _2, "mattel": _2, "mba": _2, "mckinsey": _2, "med": _2, "media": _63, "meet": _2, "melbourne": _2, "meme": _2, "memorial": _2, "men": _2, "menu": [1, { "barsy": _3, "barsyonline": _3 }], "merck": _2, "merckmsd": _2, "miami": _2, "microsoft": _2, "mini": _2, "mint": _2, "mit": _2, "mitsubishi": _2, "mlb": _2, "mls": _2, "mma": _2, "mobile": _2, "moda": _2, "moe": _2, "moi": _2, "mom": _2, "monash": _2, "money": _2, "monster": _2, "mormon": _2, "mortgage": _2, "moscow": _2, "moto": _2, "motorcycles": _2, "mov": _2, "movie": _2, "msd": _2, "mtn": _2, "mtr": _2, "music": _2, "nab": _2, "nagoya": _2, "navy": _2, "nba": _2, "nec": _2, "netbank": _2, "netflix": _2, "network": [1, { "aem": _3, "alces": _6, "appwrite": _3, "co": _3, "arvo": _3, "azimuth": _3, "tlon": _3 }], "neustar": _2, "new": _2, "news": [1, { "noticeable": _3 }], "next": _2, "nextdirect": _2, "nexus": _2, "nfl": _2, "ngo": _2, "nhk": _2, "nico": _2, "nike": _2, "nikon": _2, "ninja": _2, "nissan": _2, "nissay": _2, "nokia": _2, "norton": _2, "now": _2, "nowruz": _2, "nowtv": _2, "nra": _2, "nrw": _2, "ntt": _2, "nyc": _2, "obi": _2, "observer": _2, "office": _2, "okinawa": _2, "olayan": _2, "olayangroup": _2, "ollo": _2, "omega": _2, "one": [1, { "kin": _6, "service": _3, "website": _3 }], "ong": _2, "onl": _2, "online": [1, { "eero": _3, "eero-stage": _3, "websitebuilder": _3, "leapcell": _3, "barsy": _3 }], "ooo": _2, "open": _2, "oracle": _2, "orange": [1, { "tech": _3 }], "organic": _2, "origins": _2, "osaka": _2, "otsuka": _2, "ott": _2, "ovh": [1, { "nerdpol": _3 }], "page": [1, { "aem": _3, "hlx": _3, "codeberg": _3, "deuxfleurs": _3, "mybox": _3, "heyflow": _3, "prvcy": _3, "rocky": _3, "statichost": _3, "pdns": _3, "plesk": _3 }], "panasonic": _2, "paris": _2, "pars": _2, "partners": _2, "parts": _2, "party": _2, "pay": _2, "pccw": _2, "pet": _2, "pfizer": _2, "pharmacy": _2, "phd": _2, "philips": _2, "phone": _2, "photo": _2, "photography": _2, "photos": _63, "physio": _2, "pics": _2, "pictet": _2, "pictures": [1, { "1337": _3 }], "pid": _2, "pin": _2, "ping": _2, "pink": _2, "pioneer": _2, "pizza": [1, { "ngrok": _3 }], "place": _22, "play": _2, "playstation": _2, "plumbing": _2, "plus": [1, { "playit": [2, { "at": _6, "with": _3 }] }], "pnc": _2, "pohl": _2, "poker": _2, "politie": _2, "porn": _2, "praxi": _2, "press": _2, "prime": _2, "prod": _2, "productions": _2, "prof": _2, "progressive": _2, "promo": _2, "properties": _2, "property": _2, "protection": _2, "pru": _2, "prudential": _2, "pub": [1, { "id": _6, "kin": _6, "barsy": _3 }], "pwc": _2, "qpon": _2, "quebec": _2, "quest": _2, "racing": _2, "radio": _2, "read": _2, "realestate": _2, "realtor": _2, "realty": _2, "recipes": _2, "red": _2, "redumbrella": _2, "rehab": _2, "reise": _2, "reisen": _2, "reit": _2, "reliance": _2, "ren": _2, "rent": _2, "rentals": _2, "repair": _2, "report": _2, "republican": _2, "rest": _2, "restaurant": _2, "review": _2, "reviews": [1, { "aem": _3 }], "rexroth": _2, "rich": _2, "richardli": _2, "ricoh": _2, "ril": _2, "rio": _2, "rip": [1, { "clan": _3 }], "rocks": [1, { "myddns": _3, "stackit": _3, "lima-city": _3, "webspace": _3 }], "rodeo": _2, "rogers": _2, "room": _2, "rsvp": _2, "rugby": _2, "ruhr": _2, "run": [1, { "appwrite": _6, "canva": _3, "development": _3, "ravendb": _3, "liara": [2, { "iran": _3 }], "lovable": _3, "needle": _3, "build": _6, "code": _6, "database": _6, "migration": _6, "onporter": _3, "repl": _3, "stackit": _3, "val": _51, "vercel": _3, "wix": _3 }], "rwe": _2, "ryukyu": _2, "saarland": _2, "safe": _2, "safety": _2, "sakura": _2, "sale": _2, "salon": _2, "samsclub": _2, "samsung": _2, "sandvik": _2, "sandvikcoromant": _2, "sanofi": _2, "sap": _2, "sarl": _2, "sas": _2, "save": _2, "saxo": _2, "sbi": _2, "sbs": _2, "scb": _2, "schaeffler": _2, "schmidt": _2, "scholarships": _2, "school": _2, "schule": _2, "schwarz": _2, "science": _2, "scot": [1, { "co": _3, "me": _3, "org": _3, "gov": [2, { "service": _3 }] }], "search": _2, "seat": _2, "secure": _2, "security": _2, "seek": _2, "select": _2, "sener": _2, "services": [1, { "loginline": _3 }], "seven": _2, "sew": _2, "sex": _2, "sexy": _2, "sfr": _2, "shangrila": _2, "sharp": _2, "shell": _2, "shia": _2, "shiksha": _2, "shoes": _2, "shop": [1, { "base": _3, "hoplix": _3, "barsy": _3, "barsyonline": _3, "shopware": _3 }], "shopping": _2, "shouji": _2, "show": _55, "silk": _2, "sina": _2, "singles": _2, "site": [1, { "square": _3, "canva": _26, "cloudera": _6, "convex": _24, "cyon": _3, "caffeine": _3, "fastvps": _3, "figma": _3, "figma-gov": _3, "preview": _3, "heyflow": _3, "jele": _3, "jouwweb": _3, "loginline": _3, "barsy": _3, "co": _3, "notion": _3, "omniwe": _3, "opensocial": _3, "madethis": _3, "support": _3, "platformsh": _6, "tst": _6, "byen": _3, "sol": _3, "srht": _3, "novecore": _3, "cpanel": _3, "wpsquared": _3, "sourcecraft": _3 }], "ski": _2, "skin": _2, "sky": _2, "skype": _2, "sling": _2, "smart": _2, "smile": _2, "sncf": _2, "soccer": _2, "social": _2, "softbank": _2, "software": _2, "sohu": _2, "solar": _2, "solutions": _2, "song": _2, "sony": _2, "soy": _2, "spa": _2, "space": [1, { "myfast": _3, "heiyu": _3, "hf": [2, { "static": _3 }], "app-ionos": _3, "project": _3, "uber": _3, "xs4all": _3 }], "sport": _2, "spot": _2, "srl": _2, "stada": _2, "staples": _2, "star": _2, "statebank": _2, "statefarm": _2, "stc": _2, "stcgroup": _2, "stockholm": _2, "storage": _2, "store": [1, { "barsy": _3, "sellfy": _3, "shopware": _3, "storebase": _3 }], "stream": _2, "studio": _2, "study": _2, "style": _2, "sucks": _2, "supplies": _2, "supply": _2, "support": [1, { "barsy": _3 }], "surf": _2, "surgery": _2, "suzuki": _2, "swatch": _2, "swiss": _2, "sydney": _2, "systems": [1, { "knightpoint": _3, "miren": _3 }], "tab": _2, "taipei": _2, "talk": _2, "taobao": _2, "target": _2, "tatamotors": _2, "tatar": _2, "tattoo": _2, "tax": _2, "taxi": _2, "tci": _2, "tdk": _2, "team": [1, { "discourse": _3, "jelastic": _3 }], "tech": [1, { "cleverapps": _3 }], "technology": _22, "temasek": _2, "tennis": _2, "teva": _2, "thd": _2, "theater": _2, "theatre": _2, "tiaa": _2, "tickets": _2, "tienda": _2, "tips": _2, "tires": _2, "tirol": _2, "tjmaxx": _2, "tjx": _2, "tkmaxx": _2, "tmall": _2, "today": [1, { "prequalifyme": _3 }], "tokyo": _2, "tools": [1, { "addr": _50, "myaddr": _3 }], "top": [1, { "ntdll": _3, "wadl": _6 }], "toray": _2, "toshiba": _2, "total": _2, "tours": _2, "town": _2, "toyota": _2, "toys": _2, "trade": _2, "trading": _2, "training": _2, "travel": _2, "travelers": _2, "travelersinsurance": _2, "trust": _2, "trv": _2, "tube": _2, "tui": _2, "tunes": _2, "tushu": _2, "tvs": _2, "ubank": _2, "ubs": _2, "unicom": _2, "university": _2, "uno": _2, "uol": _2, "ups": _2, "vacations": _2, "vana": _2, "vanguard": _2, "vegas": _2, "ventures": _2, "verisign": _2, "versicherung": _2, "vet": _2, "viajes": _2, "video": _2, "vig": _2, "viking": _2, "villas": _2, "vin": _2, "vip": [1, { "hidns": _3 }], "virgin": _2, "visa": _2, "vision": _2, "viva": _2, "vivo": _2, "vlaanderen": _2, "vodka": _2, "volvo": _2, "vote": _2, "voting": _2, "voto": _2, "voyage": _2, "wales": _2, "walmart": _2, "walter": _2, "wang": _2, "wanggou": _2, "watch": _2, "watches": _2, "weather": _2, "weatherchannel": _2, "webcam": _2, "weber": _2, "website": _63, "wed": _2, "wedding": _2, "weibo": _2, "weir": _2, "whoswho": _2, "wien": _2, "wiki": _63, "williamhill": _2, "win": _2, "windows": _2, "wine": _2, "winners": _2, "wme": _2, "woodside": _2, "work": [1, { "imagine-proxy": _3 }], "works": _2, "world": _2, "wow": _2, "wtc": _2, "wtf": _2, "xbox": _2, "xerox": _2, "xihuan": _2, "xin": _2, "xn--11b4c3d": _2, "\u0915\u0949\u092E": _2, "xn--1ck2e1b": _2, "\u30BB\u30FC\u30EB": _2, "xn--1qqw23a": _2, "\u4F5B\u5C71": _2, "xn--30rr7y": _2, "\u6148\u5584": _2, "xn--3bst00m": _2, "\u96C6\u56E2": _2, "xn--3ds443g": _2, "\u5728\u7EBF": _2, "xn--3pxu8k": _2, "\u70B9\u770B": _2, "xn--42c2d9a": _2, "\u0E04\u0E2D\u0E21": _2, "xn--45q11c": _2, "\u516B\u5366": _2, "xn--4gbrim": _2, "\u0645\u0648\u0642\u0639": _2, "xn--55qw42g": _2, "\u516C\u76CA": _2, "xn--55qx5d": _2, "\u516C\u53F8": _2, "xn--5su34j936bgsg": _2, "\u9999\u683C\u91CC\u62C9": _2, "xn--5tzm5g": _2, "\u7F51\u7AD9": _2, "xn--6frz82g": _2, "\u79FB\u52A8": _2, "xn--6qq986b3xl": _2, "\u6211\u7231\u4F60": _2, "xn--80adxhks": _2, "\u043C\u043E\u0441\u043A\u0432\u0430": _2, "xn--80aqecdr1a": _2, "\u043A\u0430\u0442\u043E\u043B\u0438\u043A": _2, "xn--80asehdb": _2, "\u043E\u043D\u043B\u0430\u0439\u043D": _2, "xn--80aswg": _2, "\u0441\u0430\u0439\u0442": _2, "xn--8y0a063a": _2, "\u8054\u901A": _2, "xn--9dbq2a": _2, "\u05E7\u05D5\u05DD": _2, "xn--9et52u": _2, "\u65F6\u5C1A": _2, "xn--9krt00a": _2, "\u5FAE\u535A": _2, "xn--b4w605ferd": _2, "\u6DE1\u9A6C\u9521": _2, "xn--bck1b9a5dre4c": _2, "\u30D5\u30A1\u30C3\u30B7\u30E7\u30F3": _2, "xn--c1avg": _2, "\u043E\u0440\u0433": _2, "xn--c2br7g": _2, "\u0928\u0947\u091F": _2, "xn--cck2b3b": _2, "\u30B9\u30C8\u30A2": _2, "xn--cckwcxetd": _2, "\u30A2\u30DE\u30BE\u30F3": _2, "xn--cg4bki": _2, "\uC0BC\uC131": _2, "xn--czr694b": _2, "\u5546\u6807": _2, "xn--czrs0t": _2, "\u5546\u5E97": _2, "xn--czru2d": _2, "\u5546\u57CE": _2, "xn--d1acj3b": _2, "\u0434\u0435\u0442\u0438": _2, "xn--eckvdtc9d": _2, "\u30DD\u30A4\u30F3\u30C8": _2, "xn--efvy88h": _2, "\u65B0\u95FB": _2, "xn--fct429k": _2, "\u5BB6\u96FB": _2, "xn--fhbei": _2, "\u0643\u0648\u0645": _2, "xn--fiq228c5hs": _2, "\u4E2D\u6587\u7F51": _2, "xn--fiq64b": _2, "\u4E2D\u4FE1": _2, "xn--fjq720a": _2, "\u5A31\u4E50": _2, "xn--flw351e": _2, "\u8C37\u6B4C": _2, "xn--fzys8d69uvgm": _2, "\u96FB\u8A0A\u76C8\u79D1": _2, "xn--g2xx48c": _2, "\u8D2D\u7269": _2, "xn--gckr3f0f": _2, "\u30AF\u30E9\u30A6\u30C9": _2, "xn--gk3at1e": _2, "\u901A\u8CA9": _2, "xn--hxt814e": _2, "\u7F51\u5E97": _2, "xn--i1b6b1a6a2e": _2, "\u0938\u0902\u0917\u0920\u0928": _2, "xn--imr513n": _2, "\u9910\u5385": _2, "xn--io0a7i": _2, "\u7F51\u7EDC": _2, "xn--j1aef": _2, "\u043A\u043E\u043C": _2, "xn--jlq480n2rg": _2, "\u4E9A\u9A6C\u900A": _2, "xn--jvr189m": _2, "\u98DF\u54C1": _2, "xn--kcrx77d1x4a": _2, "\u98DE\u5229\u6D66": _2, "xn--kput3i": _2, "\u624B\u673A": _2, "xn--mgba3a3ejt": _2, "\u0627\u0631\u0627\u0645\u0643\u0648": _2, "xn--mgba7c0bbn0a": _2, "\u0627\u0644\u0639\u0644\u064A\u0627\u0646": _2, "xn--mgbab2bd": _2, "\u0628\u0627\u0632\u0627\u0631": _2, "xn--mgbca7dzdo": _2, "\u0627\u0628\u0648\u0638\u0628\u064A": _2, "xn--mgbi4ecexp": _2, "\u0643\u0627\u062B\u0648\u0644\u064A\u0643": _2, "xn--mgbt3dhd": _2, "\u0647\u0645\u0631\u0627\u0647": _2, "xn--mk1bu44c": _2, "\uB2F7\uCEF4": _2, "xn--mxtq1m": _2, "\u653F\u5E9C": _2, "xn--ngbc5azd": _2, "\u0634\u0628\u0643\u0629": _2, "xn--ngbe9e0a": _2, "\u0628\u064A\u062A\u0643": _2, "xn--ngbrx": _2, "\u0639\u0631\u0628": _2, "xn--nqv7f": _2, "\u673A\u6784": _2, "xn--nqv7fs00ema": _2, "\u7EC4\u7EC7\u673A\u6784": _2, "xn--nyqy26a": _2, "\u5065\u5EB7": _2, "xn--otu796d": _2, "\u62DB\u8058": _2, "xn--p1acf": [1, { "xn--90amc": _3, "xn--j1aef": _3, "xn--j1ael8b": _3, "xn--h1ahn": _3, "xn--j1adp": _3, "xn--c1avg": _3, "xn--80aaa0cvac": _3, "xn--h1aliz": _3, "xn--90a1af": _3, "xn--41a": _3 }], "\u0440\u0443\u0441": [1, { "\u0431\u0438\u0437": _3, "\u043A\u043E\u043C": _3, "\u043A\u0440\u044B\u043C": _3, "\u043C\u0438\u0440": _3, "\u043C\u0441\u043A": _3, "\u043E\u0440\u0433": _3, "\u0441\u0430\u043C\u0430\u0440\u0430": _3, "\u0441\u043E\u0447\u0438": _3, "\u0441\u043F\u0431": _3, "\u044F": _3 }], "xn--pssy2u": _2, "\u5927\u62FF": _2, "xn--q9jyb4c": _2, "\u307F\u3093\u306A": _2, "xn--qcka1pmc": _2, "\u30B0\u30FC\u30B0\u30EB": _2, "xn--rhqv96g": _2, "\u4E16\u754C": _2, "xn--rovu88b": _2, "\u66F8\u7C4D": _2, "xn--ses554g": _2, "\u7F51\u5740": _2, "xn--t60b56a": _2, "\uB2F7\uB137": _2, "xn--tckwe": _2, "\u30B3\u30E0": _2, "xn--tiq49xqyj": _2, "\u5929\u4E3B\u6559": _2, "xn--unup4y": _2, "\u6E38\u620F": _2, "xn--vermgensberater-ctb": _2, "verm\xF6gensberater": _2, "xn--vermgensberatung-pwb": _2, "verm\xF6gensberatung": _2, "xn--vhquv": _2, "\u4F01\u4E1A": _2, "xn--vuq861b": _2, "\u4FE1\u606F": _2, "xn--w4r85el8fhu5dnra": _2, "\u5609\u91CC\u5927\u9152\u5E97": _2, "xn--w4rs40l": _2, "\u5609\u91CC": _2, "xn--xhq521b": _2, "\u5E7F\u4E1C": _2, "xn--zfr164b": _2, "\u653F\u52A1": _2, "xyz": [1, { "caffeine": _3, "exe": _3, "botdash": _3, "telebit": _6 }], "yachts": _2, "yahoo": _2, "yamaxun": _2, "yandex": _2, "yodobashi": _2, "yoga": _2, "yokohama": _2, "you": _2, "youtube": _2, "yun": _2, "zappos": _2, "zara": _2, "zero": _2, "zip": _2, "zone": [1, { "stackit": _3, "lima": _3, "triton": _6 }], "zuerich": _2 }];
  return rules2;
})();

// node_modules/.pnpm/tldts@7.0.27/node_modules/tldts/dist/es6/src/suffix-trie.js
function lookupInTrie(parts, trie, index, allowedMask) {
  let result = null;
  let node = trie;
  while (node !== void 0) {
    if ((node[0] & allowedMask) !== 0) {
      result = {
        index: index + 1,
        isIcann: (node[0] & 1) !== 0,
        isPrivate: (node[0] & 2) !== 0
      };
    }
    if (index === -1) {
      break;
    }
    const succ = node[1];
    node = Object.prototype.hasOwnProperty.call(succ, parts[index]) ? succ[parts[index]] : succ["*"];
    index -= 1;
  }
  return result;
}
function suffixLookup(hostname, options, out) {
  var _a;
  if (fast_path_default(hostname, options, out)) {
    return;
  }
  const hostnameParts = hostname.split(".");
  const allowedMask = (options.allowPrivateDomains ? 2 : 0) | (options.allowIcannDomains ? 1 : 0);
  const exceptionMatch = lookupInTrie(hostnameParts, exceptions, hostnameParts.length - 1, allowedMask);
  if (exceptionMatch !== null) {
    out.isIcann = exceptionMatch.isIcann;
    out.isPrivate = exceptionMatch.isPrivate;
    out.publicSuffix = hostnameParts.slice(exceptionMatch.index + 1).join(".");
    return;
  }
  const rulesMatch = lookupInTrie(hostnameParts, rules, hostnameParts.length - 1, allowedMask);
  if (rulesMatch !== null) {
    out.isIcann = rulesMatch.isIcann;
    out.isPrivate = rulesMatch.isPrivate;
    out.publicSuffix = hostnameParts.slice(rulesMatch.index).join(".");
    return;
  }
  out.isIcann = false;
  out.isPrivate = false;
  out.publicSuffix = (_a = hostnameParts[hostnameParts.length - 1]) !== null && _a !== void 0 ? _a : null;
}

// node_modules/.pnpm/tldts@7.0.27/node_modules/tldts/dist/es6/index.js
var RESULT = getEmptyResult();
function getDomain2(url, options = {}) {
  resetResult(RESULT);
  return parseImpl(url, 3, suffixLookup, options, RESULT).domain;
}

// src/intel/normalize.ts
function stripTrailingDots(value) {
  return value.replace(/\.+$/, "");
}
function hasHostSeparators(value) {
  return value.includes("://") || value.includes("/") || value.includes("?") || value.includes("#");
}
function normalizeCandidate(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const extractedHostname = extractHostname(trimmed);
  const candidate = extractedHostname || (hasHostSeparators(trimmed) ? "" : trimmed);
  if (!candidate) {
    return "";
  }
  const normalized = stripTrailingDots(candidate.toLowerCase());
  if (!normalized) {
    return "";
  }
  try {
    return punycode_es6_default.toASCII(normalized).toLowerCase();
  } catch {
    return "";
  }
}
function isValidDomainLabel(label) {
  if (!label) {
    return false;
  }
  if (label.length > 63) {
    return false;
  }
  if (label.startsWith("-") || label.endsWith("-")) {
    return false;
  }
  return /^[a-z0-9-]+$/.test(label);
}
function isValidHostname(hostname) {
  if (!hostname || hostname.length > 253) {
    return false;
  }
  const labels = hostname.split(".");
  return labels.every(isValidDomainLabel);
}
function normalizeIntelDomain(value) {
  const normalized = normalizeCandidate(value);
  if (!isValidHostname(normalized)) {
    return null;
  }
  return normalized;
}
function toRegistrableIntelDomain(value) {
  const normalized = normalizeIntelDomain(value);
  if (!normalized) {
    return null;
  }
  return getDomain2(normalized, {
    allowPrivateDomains: false,
    extractHostname: false
  }) ?? null;
}
function buildMaliciousDomainIdentity(scope, domain) {
  return `${scope}:${domain}`;
}
function buildDomainAllowlistIdentity(scope, domain) {
  const prefix = scope === "exact_host" ? "domain_exact_host" : "domain_registrable_domain";
  return `${prefix}:${domain}`;
}
function normalizeDomainLookupTarget(value) {
  const hostname = normalizeIntelDomain(value);
  if (!hostname) {
    return null;
  }
  return {
    hostname,
    registrableDomain: getDomain2(hostname, {
      allowPrivateDomains: false,
      extractHostname: false
    }) ?? hostname
  };
}

// src/intel/validate.ts
var ENVELOPE_KEYS = [
  "schemaVersion",
  "bundleVersion",
  "generatedAt",
  "publisher",
  "signingKeyId",
  "sections",
  "signature",
  "maliciousDomains",
  "allowlists"
];
var SECTION_METADATA_KEYS = [
  "feedVersion",
  "itemCount",
  "sha256",
  "staleAfter",
  "expiresAt"
];
var MALICIOUS_SECTION_KEYS = [
  "feedType",
  "feedVersion",
  "itemCount",
  "sha256",
  "staleAfter",
  "expiresAt",
  "items"
];
var ALLOWLIST_SECTION_KEYS = MALICIOUS_SECTION_KEYS;
var MALICIOUS_ITEM_KEYS = [
  "id",
  "type",
  "identity",
  "source",
  "reasonCode",
  "confidence",
  "firstSeenAt",
  "lastSeenAt",
  "domain",
  "scope",
  "classification"
];
var ALLOWLIST_ITEM_KEYS = [
  "id",
  "type",
  "identity",
  "source",
  "reasonCode",
  "confidence",
  "firstSeenAt",
  "lastSeenAt",
  "targetKind",
  "target",
  "scope",
  "justification"
];
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function pushIssue2(issues, path, message) {
  issues.push({ path, message });
}
function assertExactKeys2(value, allowedKeys, path, issues) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      pushIssue2(issues, `${path}.${key}`, "Unknown field");
    }
  }
}
function readRequiredString2(value, key, path, issues) {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.trim() === "") {
    pushIssue2(issues, `${path}.${key}`, "Expected a non-empty string");
    return null;
  }
  return candidate;
}
function readRequiredNumber(value, key, path, issues) {
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    pushIssue2(issues, `${path}.${key}`, "Expected a finite number");
    return null;
  }
  return candidate;
}
function isValidUtcTimestamp3(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}
function readRequiredTimestamp(value, key, path, issues) {
  const candidate = readRequiredString2(value, key, path, issues);
  if (candidate === null) {
    return null;
  }
  if (!isValidUtcTimestamp3(candidate)) {
    pushIssue2(issues, `${path}.${key}`, "Expected an ISO-8601 UTC timestamp");
    return null;
  }
  return candidate;
}
function readMetadata(value, path, issues) {
  if (!isRecord5(value)) {
    pushIssue2(issues, path, "Expected section metadata object");
    return null;
  }
  assertExactKeys2(value, SECTION_METADATA_KEYS, path, issues);
  const feedVersion = readRequiredString2(value, "feedVersion", path, issues);
  const itemCount = readRequiredNumber(value, "itemCount", path, issues);
  const sha256 = readRequiredString2(value, "sha256", path, issues);
  const staleAfter = readRequiredTimestamp(value, "staleAfter", path, issues);
  const expiresAt = readRequiredTimestamp(value, "expiresAt", path, issues);
  if (feedVersion === null || itemCount === null || sha256 === null || staleAfter === null || expiresAt === null) {
    return null;
  }
  if (!Number.isInteger(itemCount) || itemCount < 0) {
    pushIssue2(issues, `${path}.itemCount`, "Expected a non-negative integer");
  }
  if (Date.parse(staleAfter) >= Date.parse(expiresAt)) {
    pushIssue2(issues, path, "Expected staleAfter to be earlier than expiresAt");
  }
  return {
    feedVersion,
    itemCount,
    sha256,
    staleAfter,
    expiresAt
  };
}
function parseSchemaVersion(value, issues) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) {
    pushIssue2(issues, "schemaVersion", "Expected semantic version format");
    return;
  }
  if (match[1] !== "1") {
    pushIssue2(issues, "schemaVersion", "Unsupported schema major version");
  }
}
function parseEnvelope(bundle, options) {
  const issues = [];
  if (!isRecord5(bundle)) {
    pushIssue2(issues, "", "Expected bundle object");
    return {
      metadata: {
        schemaVersion: "",
        bundleVersion: "",
        generatedAt: "",
        publisher: "",
        signingKeyId: "",
        sections: {},
        signature: ""
      },
      issues,
      rawBundle: {
        schemaVersion: "",
        bundleVersion: "",
        generatedAt: "",
        publisher: "",
        signingKeyId: "",
        sections: {},
        signature: ""
      }
    };
  }
  assertExactKeys2(bundle, ENVELOPE_KEYS, "", issues);
  const schemaVersion = readRequiredString2(bundle, "schemaVersion", "", issues);
  const bundleVersion = readRequiredString2(bundle, "bundleVersion", "", issues);
  const generatedAt = readRequiredTimestamp(bundle, "generatedAt", "", issues);
  const publisher = readRequiredString2(bundle, "publisher", "", issues);
  const signingKeyId = readRequiredString2(bundle, "signingKeyId", "", issues);
  const signature = readRequiredString2(bundle, "signature", "", issues);
  if (typeof options.signatureVerifier !== "function") {
    pushIssue2(
      issues,
      "signatureVerifier",
      "Signature verification function is required"
    );
  }
  if (schemaVersion !== null) {
    parseSchemaVersion(schemaVersion, issues);
  }
  const rawSections = bundle.sections;
  const sections = {};
  if (!isRecord5(rawSections)) {
    pushIssue2(issues, "sections", "Expected sections metadata object");
  } else {
    const allowedSections = [
      "maliciousDomains",
      "allowlists"
    ];
    assertExactKeys2(rawSections, allowedSections, "sections", issues);
    for (const sectionName of allowedSections) {
      const metadata = rawSections[sectionName];
      if (metadata === void 0) {
        continue;
      }
      const parsedMetadata = readMetadata(
        metadata,
        `sections.${sectionName}`,
        issues
      );
      if (parsedMetadata) {
        sections[sectionName] = parsedMetadata;
      }
    }
  }
  if (signature !== null && schemaVersion !== null && bundleVersion !== null && generatedAt !== null && publisher !== null && signingKeyId !== null && typeof options.signatureVerifier === "function" && !options.signatureVerifier({
    schemaVersion,
    bundleVersion,
    generatedAt,
    publisher,
    signingKeyId,
    sections,
    signature
  })) {
    pushIssue2(issues, "signature", "Signature verification failed");
  }
  return {
    metadata: {
      schemaVersion: schemaVersion ?? "",
      bundleVersion: bundleVersion ?? "",
      generatedAt: generatedAt ?? "",
      publisher: publisher ?? "",
      signingKeyId: signingKeyId ?? "",
      sections,
      signature: signature ?? ""
    },
    issues,
    rawBundle: bundle
  };
}
function readItemsArray(value, path, issues) {
  const items = value.items;
  if (!Array.isArray(items)) {
    pushIssue2(issues, `${path}.items`, "Expected items array");
    return null;
  }
  return items;
}
function canonicalMaliciousSection(section) {
  return serializeCanonicalJson({
    feedType: section.feedType,
    feedVersion: section.feedVersion,
    itemCount: section.itemCount,
    staleAfter: section.staleAfter,
    expiresAt: section.expiresAt,
    items: section.items.map((item) => ({
      id: item.id,
      type: item.type,
      identity: item.identity,
      source: item.source,
      reasonCode: item.reasonCode,
      confidence: item.confidence,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt,
      domain: item.domain,
      scope: item.scope,
      classification: item.classification
    }))
  });
}
function canonicalAllowlistSection(section) {
  return serializeCanonicalJson({
    feedType: section.feedType,
    feedVersion: section.feedVersion,
    itemCount: section.itemCount,
    staleAfter: section.staleAfter,
    expiresAt: section.expiresAt,
    items: section.items.map((item) => ({
      id: item.id,
      type: item.type,
      identity: item.identity,
      source: item.source,
      reasonCode: item.reasonCode,
      confidence: item.confidence,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt,
      targetKind: item.targetKind,
      target: item.target,
      scope: item.scope,
      justification: item.justification
    }))
  });
}
function validateSectionHeader(section, metadata, path, issues) {
  const feedVersion = readRequiredString2(section, "feedVersion", path, issues);
  const itemCount = readRequiredNumber(section, "itemCount", path, issues);
  const sha256 = readRequiredString2(section, "sha256", path, issues);
  const staleAfter = readRequiredTimestamp(section, "staleAfter", path, issues);
  const expiresAt = readRequiredTimestamp(section, "expiresAt", path, issues);
  if (feedVersion === null || itemCount === null || sha256 === null || staleAfter === null || expiresAt === null) {
    return null;
  }
  if (feedVersion !== metadata.feedVersion) {
    pushIssue2(issues, `${path}.feedVersion`, "Section feedVersion does not match bundle metadata");
  }
  if (itemCount !== metadata.itemCount) {
    pushIssue2(issues, `${path}.itemCount`, "Section itemCount does not match bundle metadata");
  }
  if (sha256 !== metadata.sha256) {
    pushIssue2(issues, `${path}.sha256`, "Section sha256 does not match bundle metadata");
  }
  if (staleAfter !== metadata.staleAfter) {
    pushIssue2(issues, `${path}.staleAfter`, "Section staleAfter does not match bundle metadata");
  }
  if (expiresAt !== metadata.expiresAt) {
    pushIssue2(issues, `${path}.expiresAt`, "Section expiresAt does not match bundle metadata");
  }
  return {
    feedVersion,
    itemCount,
    sha256,
    staleAfter,
    expiresAt
  };
}
function parseMaliciousItems(rawItems, path, issues) {
  const normalizedItems = [];
  const seenIds = /* @__PURE__ */ new Set();
  const seenIdentities = /* @__PURE__ */ new Set();
  rawItems.forEach((rawItem, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isRecord5(rawItem)) {
      pushIssue2(issues, itemPath, "Expected malicious-domain item object");
      return;
    }
    assertExactKeys2(rawItem, MALICIOUS_ITEM_KEYS, itemPath, issues);
    const id = readRequiredString2(rawItem, "id", itemPath, issues);
    const type = readRequiredString2(rawItem, "type", itemPath, issues);
    const identity = readRequiredString2(rawItem, "identity", itemPath, issues);
    const source = readRequiredString2(rawItem, "source", itemPath, issues);
    const reasonCode = readRequiredString2(rawItem, "reasonCode", itemPath, issues);
    const confidence = readRequiredNumber(rawItem, "confidence", itemPath, issues);
    const firstSeenAt = readRequiredTimestamp(rawItem, "firstSeenAt", itemPath, issues);
    const lastSeenAt = readRequiredTimestamp(rawItem, "lastSeenAt", itemPath, issues);
    const domain = readRequiredString2(rawItem, "domain", itemPath, issues);
    const scope = readRequiredString2(rawItem, "scope", itemPath, issues);
    const classification = readRequiredString2(rawItem, "classification", itemPath, issues);
    if (id === null || type === null || identity === null || source === null || reasonCode === null || confidence === null || firstSeenAt === null || lastSeenAt === null || domain === null || scope === null || classification === null) {
      return;
    }
    if (confidence < 0 || confidence > 1) {
      pushIssue2(issues, `${itemPath}.confidence`, "Expected confidence within [0, 1]");
    }
    if (Date.parse(firstSeenAt) > Date.parse(lastSeenAt)) {
      pushIssue2(issues, itemPath, "Expected firstSeenAt to be earlier than or equal to lastSeenAt");
    }
    if (type !== "exact_host" && type !== "registrable_domain") {
      pushIssue2(issues, `${itemPath}.type`, "Unsupported malicious-domain item type");
      return;
    }
    if (scope !== type) {
      pushIssue2(issues, `${itemPath}.scope`, "Scope must match malicious-domain type");
      return;
    }
    const normalizedDomain = normalizeIntelDomain(domain);
    if (!normalizedDomain) {
      pushIssue2(issues, `${itemPath}.domain`, "Expected a valid normalized hostname");
      return;
    }
    const registrableDomain = toRegistrableIntelDomain(normalizedDomain);
    if (!registrableDomain) {
      pushIssue2(issues, `${itemPath}.domain`, "Could not derive registrable domain");
      return;
    }
    const canonicalDomain = type === "registrable_domain" ? registrableDomain : normalizedDomain;
    const canonicalIdentity = buildMaliciousDomainIdentity(type, canonicalDomain);
    if (type === "registrable_domain" && normalizedDomain !== registrableDomain) {
      pushIssue2(
        issues,
        `${itemPath}.domain`,
        "Registrable-domain indicators must store the registrable domain"
      );
    }
    if (identity !== canonicalIdentity) {
      pushIssue2(issues, `${itemPath}.identity`, "Identity does not match canonical malicious-domain identity");
    }
    if (seenIds.has(id)) {
      pushIssue2(issues, `${itemPath}.id`, "Duplicate item id");
    }
    if (seenIdentities.has(canonicalIdentity)) {
      pushIssue2(issues, `${itemPath}.identity`, "Duplicate malicious-domain identity");
    }
    seenIds.add(id);
    seenIdentities.add(canonicalIdentity);
    normalizedItems.push({
      id,
      type,
      identity: canonicalIdentity,
      source,
      reasonCode,
      confidence,
      firstSeenAt,
      lastSeenAt,
      domain: canonicalDomain,
      scope: type,
      classification,
      registrableDomain
    });
  });
  return issues.some((issue) => issue.path.startsWith(path)) ? null : normalizedItems;
}
function parseAllowlistItems(rawItems, path, issues) {
  const normalizedItems = [];
  const seenIds = /* @__PURE__ */ new Set();
  const seenIdentities = /* @__PURE__ */ new Set();
  rawItems.forEach((rawItem, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isRecord5(rawItem)) {
      pushIssue2(issues, itemPath, "Expected allowlist item object");
      return;
    }
    assertExactKeys2(rawItem, ALLOWLIST_ITEM_KEYS, itemPath, issues);
    const id = readRequiredString2(rawItem, "id", itemPath, issues);
    const type = readRequiredString2(rawItem, "type", itemPath, issues);
    const identity = readRequiredString2(rawItem, "identity", itemPath, issues);
    const source = readRequiredString2(rawItem, "source", itemPath, issues);
    const reasonCode = readRequiredString2(rawItem, "reasonCode", itemPath, issues);
    const confidence = readRequiredNumber(rawItem, "confidence", itemPath, issues);
    const firstSeenAt = readRequiredTimestamp(rawItem, "firstSeenAt", itemPath, issues);
    const lastSeenAt = readRequiredTimestamp(rawItem, "lastSeenAt", itemPath, issues);
    const targetKind = readRequiredString2(rawItem, "targetKind", itemPath, issues);
    const target = readRequiredString2(rawItem, "target", itemPath, issues);
    const scope = readRequiredString2(rawItem, "scope", itemPath, issues);
    const justification = readRequiredString2(rawItem, "justification", itemPath, issues);
    if (id === null || type === null || identity === null || source === null || reasonCode === null || confidence === null || firstSeenAt === null || lastSeenAt === null || targetKind === null || target === null || scope === null || justification === null) {
      return;
    }
    if (confidence < 0 || confidence > 1) {
      pushIssue2(issues, `${itemPath}.confidence`, "Expected confidence within [0, 1]");
    }
    if (Date.parse(firstSeenAt) > Date.parse(lastSeenAt)) {
      pushIssue2(issues, itemPath, "Expected firstSeenAt to be earlier than or equal to lastSeenAt");
    }
    if (targetKind !== "domain") {
      pushIssue2(issues, `${itemPath}.targetKind`, "Phase A allowlists only support domain targets");
      return;
    }
    const normalizedTarget = normalizeIntelDomain(target);
    if (!normalizedTarget) {
      pushIssue2(issues, `${itemPath}.target`, "Expected a valid normalized hostname");
      return;
    }
    const registrableDomain = toRegistrableIntelDomain(normalizedTarget);
    if (!registrableDomain) {
      pushIssue2(issues, `${itemPath}.target`, "Could not derive registrable domain");
      return;
    }
    let canonicalScope;
    if (type === "domain_exact_host" && scope === "exact_host") {
      canonicalScope = "exact_host";
    } else if (type === "domain_registrable_domain" && scope === "registrable_domain") {
      canonicalScope = "registrable_domain";
    } else {
      pushIssue2(issues, `${itemPath}.type`, "Allowlist type and scope must align");
      return;
    }
    const canonicalTarget = canonicalScope === "registrable_domain" ? registrableDomain : normalizedTarget;
    if (canonicalScope === "registrable_domain" && normalizedTarget !== registrableDomain) {
      pushIssue2(
        issues,
        `${itemPath}.target`,
        "Registrable-domain allowlists must store the registrable domain"
      );
    }
    const canonicalIdentity = buildDomainAllowlistIdentity(
      canonicalScope,
      canonicalTarget
    );
    if (identity !== canonicalIdentity) {
      pushIssue2(issues, `${itemPath}.identity`, "Identity does not match canonical allowlist identity");
    }
    if (seenIds.has(id)) {
      pushIssue2(issues, `${itemPath}.id`, "Duplicate item id");
    }
    if (seenIdentities.has(canonicalIdentity)) {
      pushIssue2(issues, `${itemPath}.identity`, "Duplicate allowlist identity");
    }
    seenIds.add(id);
    seenIdentities.add(canonicalIdentity);
    normalizedItems.push({
      id,
      type,
      identity: canonicalIdentity,
      source,
      reasonCode,
      confidence,
      firstSeenAt,
      lastSeenAt,
      targetKind: "domain",
      target: canonicalTarget,
      scope: canonicalScope,
      justification,
      registrableDomain
    });
  });
  return issues.some((issue) => issue.path.startsWith(path)) ? null : normalizedItems;
}
function parseMaliciousDomainsSection(bundle, metadata) {
  const path = "maliciousDomains";
  const issues = [];
  const section = bundle.maliciousDomains;
  const sectionMetadata = metadata;
  if (!sectionMetadata && !section) {
    return { state: "missing", items: [], issues };
  }
  if (!sectionMetadata && section) {
    pushIssue2(issues, path, "Section payload exists without bundle metadata");
    return { state: "invalid", items: [], issues };
  }
  if (sectionMetadata && !section) {
    return {
      state: "missing",
      metadata: sectionMetadata,
      items: [],
      issues: [{ path, message: "Section metadata exists but payload is missing" }]
    };
  }
  if (!isRecord5(section)) {
    pushIssue2(issues, path, "Expected maliciousDomains section object");
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }
  if (!sectionMetadata) {
    pushIssue2(issues, path, "Missing section metadata");
    return { state: "invalid", items: [], issues };
  }
  assertExactKeys2(section, MALICIOUS_SECTION_KEYS, path, issues);
  const feedType = readRequiredString2(section, "feedType", path, issues);
  if (feedType !== "maliciousDomains") {
    pushIssue2(issues, `${path}.feedType`, "Expected feedType to equal maliciousDomains");
  }
  const header = validateSectionHeader(section, sectionMetadata, path, issues);
  const items = readItemsArray(section, path, issues);
  if (!header || !items) {
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }
  const parsedItems = parseMaliciousItems(items, path, issues);
  if (!parsedItems) {
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }
  if (header.itemCount !== parsedItems.length) {
    pushIssue2(issues, `${path}.itemCount`, "itemCount does not match actual item count");
  }
  const canonicalSha = sha256Hex(
    canonicalMaliciousSection({
      feedType: "maliciousDomains",
      feedVersion: header.feedVersion,
      itemCount: parsedItems.length,
      staleAfter: header.staleAfter,
      expiresAt: header.expiresAt,
      items: parsedItems
    })
  );
  if (header.sha256 !== canonicalSha) {
    pushIssue2(issues, `${path}.sha256`, "sha256 does not match canonical serialized content");
  }
  return issues.length > 0 ? { state: "invalid", metadata: sectionMetadata, items: [], issues } : { state: "valid", metadata: sectionMetadata, items: parsedItems, issues };
}
function parseAllowlistsSection(bundle, metadata) {
  const path = "allowlists";
  const issues = [];
  const section = bundle.allowlists;
  const sectionMetadata = metadata;
  if (!sectionMetadata && !section) {
    return { state: "missing", items: [], issues };
  }
  if (!sectionMetadata && section) {
    pushIssue2(issues, path, "Section payload exists without bundle metadata");
    return { state: "invalid", items: [], issues };
  }
  if (sectionMetadata && !section) {
    return {
      state: "missing",
      metadata: sectionMetadata,
      items: [],
      issues: [{ path, message: "Section metadata exists but payload is missing" }]
    };
  }
  if (!isRecord5(section)) {
    pushIssue2(issues, path, "Expected allowlists section object");
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }
  if (!sectionMetadata) {
    pushIssue2(issues, path, "Missing section metadata");
    return { state: "invalid", items: [], issues };
  }
  assertExactKeys2(section, ALLOWLIST_SECTION_KEYS, path, issues);
  const feedType = readRequiredString2(section, "feedType", path, issues);
  if (feedType !== "allowlists") {
    pushIssue2(issues, `${path}.feedType`, "Expected feedType to equal allowlists");
  }
  const header = validateSectionHeader(section, sectionMetadata, path, issues);
  const items = readItemsArray(section, path, issues);
  if (!header || !items) {
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }
  const parsedItems = parseAllowlistItems(items, path, issues);
  if (!parsedItems) {
    return { state: "invalid", metadata: sectionMetadata, items: [], issues };
  }
  if (header.itemCount !== parsedItems.length) {
    pushIssue2(issues, `${path}.itemCount`, "itemCount does not match actual item count");
  }
  const canonicalSha = sha256Hex(
    canonicalAllowlistSection({
      feedType: "allowlists",
      feedVersion: header.feedVersion,
      itemCount: parsedItems.length,
      staleAfter: header.staleAfter,
      expiresAt: header.expiresAt,
      items: parsedItems
    })
  );
  if (header.sha256 !== canonicalSha) {
    pushIssue2(issues, `${path}.sha256`, "sha256 does not match canonical serialized content");
  }
  return issues.length > 0 ? { state: "invalid", metadata: sectionMetadata, items: [], issues } : { state: "valid", metadata: sectionMetadata, items: parsedItems, issues };
}
function parseDomainIntelBundle(bundle, options) {
  const envelope = parseEnvelope(bundle, options);
  const rawBundle = envelope.rawBundle;
  const metadata = envelope.metadata.sections;
  return {
    envelope,
    maliciousDomains: parseMaliciousDomainsSection(
      rawBundle,
      metadata.maliciousDomains
    ),
    allowlists: parseAllowlistsSection(rawBundle, metadata.allowlists)
  };
}
function toSectionReport(section) {
  return {
    state: section.state,
    issues: section.issues
  };
}
function validateDomainIntelBundle(bundle, options) {
  const parsed = parseDomainIntelBundle(bundle, options);
  const issues = [
    ...parsed.envelope.issues,
    ...parsed.maliciousDomains.issues,
    ...parsed.allowlists.issues
  ];
  return {
    isEnvelopeValid: parsed.envelope.issues.length === 0,
    issues,
    sections: {
      maliciousDomains: toSectionReport(parsed.maliciousDomains),
      allowlists: toSectionReport(parsed.allowlists)
    }
  };
}

// src/intel/compile.ts
function resolveNow(input) {
  if (input instanceof Date) {
    return input.getTime();
  }
  if (typeof input === "number") {
    return input;
  }
  if (typeof input === "string") {
    return Date.parse(input);
  }
  return Date.now();
}
function deriveFreshnessState(metadata) {
  const staleAfterMs = Date.parse(metadata.staleAfter);
  const expiresAtMs = Date.parse(metadata.expiresAt);
  return (nowMs) => {
    if (nowMs >= expiresAtMs) {
      return "expired";
    }
    if (nowMs >= staleAfterMs) {
      return "stale";
    }
    return "fresh";
  };
}
function buildMaliciousDomainsSection(parsed, nowMs) {
  if (parsed.state === "missing") {
    return {
      name: "maliciousDomains",
      state: "missing",
      itemCount: 0,
      issues: parsed.issues,
      items: [],
      exactHostIndex: /* @__PURE__ */ new Map(),
      registrableDomainIndex: /* @__PURE__ */ new Map()
    };
  }
  if (parsed.state === "invalid" || !parsed.metadata) {
    return {
      name: "maliciousDomains",
      state: "invalid",
      itemCount: 0,
      issues: parsed.issues,
      items: [],
      exactHostIndex: /* @__PURE__ */ new Map(),
      registrableDomainIndex: /* @__PURE__ */ new Map(),
      feedVersion: parsed.metadata?.feedVersion,
      staleAfter: parsed.metadata?.staleAfter,
      expiresAt: parsed.metadata?.expiresAt
    };
  }
  const exactHostIndex = /* @__PURE__ */ new Map();
  const registrableDomainIndex = /* @__PURE__ */ new Map();
  for (const item of parsed.items) {
    if (item.type === "exact_host") {
      exactHostIndex.set(item.domain, item);
    } else {
      registrableDomainIndex.set(item.domain, item);
    }
  }
  return {
    name: "maliciousDomains",
    state: deriveFreshnessState(parsed.metadata)(nowMs),
    feedVersion: parsed.metadata.feedVersion,
    staleAfter: parsed.metadata.staleAfter,
    expiresAt: parsed.metadata.expiresAt,
    itemCount: parsed.items.length,
    issues: parsed.issues,
    items: parsed.items,
    exactHostIndex,
    registrableDomainIndex
  };
}
function buildAllowlistsSection(parsed, nowMs) {
  if (parsed.state === "missing") {
    return {
      name: "allowlists",
      state: "missing",
      itemCount: 0,
      issues: parsed.issues,
      items: [],
      exactHostIndex: /* @__PURE__ */ new Map(),
      registrableDomainIndex: /* @__PURE__ */ new Map()
    };
  }
  if (parsed.state === "invalid" || !parsed.metadata) {
    return {
      name: "allowlists",
      state: "invalid",
      itemCount: 0,
      issues: parsed.issues,
      items: [],
      exactHostIndex: /* @__PURE__ */ new Map(),
      registrableDomainIndex: /* @__PURE__ */ new Map(),
      feedVersion: parsed.metadata?.feedVersion,
      staleAfter: parsed.metadata?.staleAfter,
      expiresAt: parsed.metadata?.expiresAt
    };
  }
  const exactHostIndex = /* @__PURE__ */ new Map();
  const registrableDomainIndex = /* @__PURE__ */ new Map();
  for (const item of parsed.items) {
    if (item.scope === "exact_host") {
      exactHostIndex.set(item.target, item);
    } else {
      registrableDomainIndex.set(item.target, item);
    }
  }
  return {
    name: "allowlists",
    state: deriveFreshnessState(parsed.metadata)(nowMs),
    feedVersion: parsed.metadata.feedVersion,
    staleAfter: parsed.metadata.staleAfter,
    expiresAt: parsed.metadata.expiresAt,
    itemCount: parsed.items.length,
    issues: parsed.issues,
    items: parsed.items,
    exactHostIndex,
    registrableDomainIndex
  };
}
function compileDomainIntelSnapshot(bundle, options) {
  const parsed = parseDomainIntelBundle(bundle, options);
  const issues = [
    ...parsed.envelope.issues,
    ...parsed.maliciousDomains.issues,
    ...parsed.allowlists.issues
  ];
  if (parsed.envelope.issues.length > 0) {
    return {
      ok: false,
      issues
    };
  }
  const nowMs = resolveNow(options.now);
  const snapshot = {
    schemaVersion: parsed.envelope.metadata.schemaVersion,
    bundleVersion: parsed.envelope.metadata.bundleVersion,
    generatedAt: parsed.envelope.metadata.generatedAt,
    publisher: parsed.envelope.metadata.publisher,
    signingKeyId: parsed.envelope.metadata.signingKeyId,
    signature: parsed.envelope.metadata.signature,
    sections: {
      maliciousDomains: buildMaliciousDomainsSection(
        parsed.maliciousDomains,
        nowMs
      ),
      allowlists: buildAllowlistsSection(parsed.allowlists, nowMs)
    }
  };
  return {
    ok: true,
    snapshot,
    issues
  };
}

// src/intel/resolve-domain.ts
function isUsableMaliciousState(state) {
  return state === "fresh" || state === "stale";
}
function isUsableAllowlistState(state) {
  return state === "fresh";
}
function resolveDomainIntel(snapshot, input) {
  const domainSection = snapshot.sections.maliciousDomains;
  const allowlistSection = snapshot.sections.allowlists;
  const maliciousUsable = isUsableMaliciousState(domainSection.state);
  const allowlistUsable = isUsableAllowlistState(allowlistSection.state);
  const degradedProtection = !maliciousUsable || !allowlistUsable;
  if (!maliciousUsable) {
    return {
      lookupFamily: "domain",
      matched: false,
      disposition: "unavailable",
      sectionState: domainSection.state,
      degradedProtection
    };
  }
  const target = normalizeDomainLookupTarget(input);
  if (!target) {
    return {
      lookupFamily: "domain",
      matched: false,
      disposition: "no_match",
      sectionState: domainSection.state,
      degradedProtection,
      allowlistFeedVersion: allowlistUsable ? allowlistSection.feedVersion : void 0
    };
  }
  const maliciousExact = domainSection.exactHostIndex.get(target.hostname);
  const maliciousRegistrable = domainSection.registrableDomainIndex.get(
    target.registrableDomain
  );
  const allowlistExact = allowlistUsable ? allowlistSection.exactHostIndex.get(target.hostname) : void 0;
  const allowlistRegistrable = allowlistUsable ? allowlistSection.registrableDomainIndex.get(target.registrableDomain) : void 0;
  const allowlistFeedVersion = allowlistUsable ? allowlistSection.feedVersion : void 0;
  if (maliciousExact) {
    return {
      lookupFamily: "domain",
      matched: true,
      disposition: "malicious",
      matchType: maliciousExact.type,
      matchedSection: "maliciousDomains",
      matchedItemId: maliciousExact.id,
      identity: maliciousExact.identity,
      feedVersion: domainSection.feedVersion,
      allowlistFeedVersion,
      sectionState: domainSection.state,
      degradedProtection
    };
  }
  if (allowlistExact && maliciousRegistrable) {
    return {
      lookupFamily: "domain",
      matched: true,
      disposition: "allowlisted",
      matchType: allowlistExact.type,
      matchedSection: "allowlists",
      matchedItemId: allowlistExact.id,
      identity: allowlistExact.identity,
      feedVersion: allowlistSection.feedVersion,
      allowlistFeedVersion,
      sectionState: domainSection.state,
      degradedProtection
    };
  }
  if (maliciousRegistrable) {
    return {
      lookupFamily: "domain",
      matched: true,
      disposition: "malicious",
      matchType: maliciousRegistrable.type,
      matchedSection: "maliciousDomains",
      matchedItemId: maliciousRegistrable.id,
      identity: maliciousRegistrable.identity,
      feedVersion: domainSection.feedVersion,
      allowlistFeedVersion,
      sectionState: domainSection.state,
      degradedProtection
    };
  }
  if (allowlistExact) {
    return {
      lookupFamily: "domain",
      matched: true,
      disposition: "allowlisted",
      matchType: allowlistExact.type,
      matchedSection: "allowlists",
      matchedItemId: allowlistExact.id,
      identity: allowlistExact.identity,
      feedVersion: allowlistSection.feedVersion,
      allowlistFeedVersion,
      sectionState: domainSection.state,
      degradedProtection
    };
  }
  if (allowlistRegistrable) {
    return {
      lookupFamily: "domain",
      matched: true,
      disposition: "allowlisted",
      matchType: allowlistRegistrable.type,
      matchedSection: "allowlists",
      matchedItemId: allowlistRegistrable.id,
      identity: allowlistRegistrable.identity,
      feedVersion: allowlistSection.feedVersion,
      allowlistFeedVersion,
      sectionState: domainSection.state,
      degradedProtection
    };
  }
  return {
    lookupFamily: "domain",
    matched: false,
    disposition: "no_match",
    sectionState: domainSection.state,
    degradedProtection,
    allowlistFeedVersion
  };
}

// src/wallet/report-id.ts
function canonicalizeStringRecord(record) {
  const canonicalRecord = {};
  for (const key of Object.keys(record).sort()) {
    canonicalRecord[key] = record[key];
  }
  return canonicalRecord;
}
function copyStringList(values) {
  return values.map((value) => value);
}
function canonicalizeSnapshotSection(section) {
  return {
    contentHash: section.contentHash,
    itemCount: section.itemCount,
    label: section.label,
    metadata: canonicalizeStringRecord(section.metadata),
    sectionId: section.sectionId,
    sectionType: section.sectionType
  };
}
function canonicalizeEvidenceRef(evidence) {
  return {
    evidenceId: evidence.evidenceId,
    label: evidence.label,
    sourceId: evidence.sourceId,
    sourceType: evidence.sourceType
  };
}
function canonicalizeCapabilityBoundary(boundary) {
  return {
    area: boundary.area,
    boundaryId: boundary.boundaryId,
    capabilityKey: boundary.capabilityKey,
    detail: boundary.detail,
    status: boundary.status
  };
}
function canonicalizeFinding(finding) {
  return {
    category: finding.category,
    cleanupActionIds: copyStringList(finding.cleanupActionIds),
    detectedAt: finding.detectedAt,
    evidence: finding.evidence.map(canonicalizeEvidenceRef),
    findingId: finding.findingId,
    metadata: canonicalizeStringRecord(finding.metadata),
    resourceIds: copyStringList(finding.resourceIds),
    riskFactorIds: copyStringList(finding.riskFactorIds),
    riskLevel: finding.riskLevel,
    status: finding.status,
    summary: finding.summary,
    title: finding.title,
    walletChain: finding.walletChain
  };
}
function canonicalizeRiskFactor(factor) {
  return {
    category: factor.category,
    factorId: factor.factorId,
    findingIds: copyStringList(factor.findingIds),
    metadata: canonicalizeStringRecord(factor.metadata),
    resourceIds: copyStringList(factor.resourceIds),
    riskLevel: factor.riskLevel,
    summary: factor.summary,
    title: factor.title,
    walletChain: factor.walletChain
  };
}
function canonicalizeScoreComponent(component) {
  return {
    componentId: component.componentId,
    findingIds: copyStringList(component.findingIds),
    label: component.label,
    maxScore: component.maxScore,
    rationale: component.rationale,
    riskFactorIds: copyStringList(component.riskFactorIds),
    riskLevel: component.riskLevel,
    score: component.score
  };
}
function canonicalizeScoreBreakdown(breakdown) {
  return {
    components: breakdown.components.map(canonicalizeScoreComponent),
    rationale: breakdown.rationale,
    riskLevel: breakdown.riskLevel,
    totalScore: breakdown.totalScore
  };
}
function canonicalizeCleanupTarget(target) {
  return {
    label: target.label,
    metadata: canonicalizeStringRecord(target.metadata),
    targetId: target.targetId,
    targetKind: target.targetKind
  };
}
function isEvmCleanupAction(action) {
  return action.walletChain === "evm" && "approval" in action && "estimatedRiskReduction" in action && "explanation" in action && "revocationMethod" in action;
}
function isEvmWalletCleanupPlan(plan) {
  return plan.walletChain === "evm" && "batches" in plan;
}
function canonicalizeEvmApprovalTarget(approval) {
  return {
    approvalId: approval.approvalId,
    approvalKind: approval.approvalKind,
    currentState: approval.currentState,
    intendedState: approval.intendedState,
    spenderAddress: approval.spenderAddress,
    tokenAddress: approval.tokenAddress,
    tokenId: approval.tokenId
  };
}
function canonicalizeCleanupAction(action) {
  const canonicalAction = {
    actionId: action.actionId,
    description: action.description,
    executionMode: action.executionMode,
    executionType: action.executionType,
    findingIds: copyStringList(action.findingIds),
    kind: action.kind,
    metadata: canonicalizeStringRecord(action.metadata),
    priority: action.priority,
    requiresSignature: action.requiresSignature,
    riskFactorIds: copyStringList(action.riskFactorIds),
    status: action.status,
    supportDetail: action.supportDetail,
    supportStatus: action.supportStatus,
    target: canonicalizeCleanupTarget(action.target),
    title: action.title,
    walletChain: action.walletChain
  };
  if (!isEvmCleanupAction(action)) {
    return canonicalAction;
  }
  return {
    ...canonicalAction,
    approval: canonicalizeEvmApprovalTarget(action.approval),
    estimatedRiskReduction: action.estimatedRiskReduction,
    explanation: action.explanation,
    revocationMethod: action.revocationMethod
  };
}
function canonicalizeEvmCleanupBatch(batch) {
  return {
    actionIds: copyStringList(batch.actionIds),
    actions: batch.actions.map(canonicalizeCleanupAction),
    batchId: batch.batchId,
    createdAt: batch.createdAt,
    executionKind: batch.executionKind,
    networkId: batch.networkId,
    summary: batch.summary,
    supportStatus: batch.supportStatus,
    title: batch.title,
    walletAddress: batch.walletAddress,
    walletChain: batch.walletChain
  };
}
function canonicalizeCleanupPlan(plan) {
  if (plan === null) {
    return null;
  }
  const canonicalPlan = {
    actions: plan.actions.map(canonicalizeCleanupAction),
    createdAt: plan.createdAt,
    networkId: plan.networkId,
    planId: plan.planId,
    projectedRiskLevel: plan.projectedRiskLevel,
    projectedScore: plan.projectedScore,
    summary: plan.summary,
    walletAddress: plan.walletAddress,
    walletChain: plan.walletChain
  };
  if (!isEvmWalletCleanupPlan(plan)) {
    return canonicalPlan;
  }
  return {
    ...canonicalPlan,
    batches: plan.batches.map(canonicalizeEvmCleanupBatch)
  };
}
function canonicalizeCleanupActionResult(actionResult) {
  return {
    actionId: actionResult.actionId,
    detail: actionResult.detail,
    evidence: actionResult.evidence.map(canonicalizeEvidenceRef),
    executedAt: actionResult.executedAt,
    status: actionResult.status
  };
}
function canonicalizeCleanupExecution(cleanupExecution) {
  if (cleanupExecution === null) {
    return null;
  }
  return {
    actionResults: cleanupExecution.actionResults.map(
      canonicalizeCleanupActionResult
    ),
    completedAt: cleanupExecution.completedAt,
    networkId: cleanupExecution.networkId,
    planId: cleanupExecution.planId,
    startedAt: cleanupExecution.startedAt,
    status: cleanupExecution.status,
    walletAddress: cleanupExecution.walletAddress,
    walletChain: cleanupExecution.walletChain
  };
}
function canonicalizeRequest(request) {
  return {
    metadata: canonicalizeStringRecord(request.metadata),
    networkId: request.networkId,
    requestId: request.requestId,
    requestedAt: request.requestedAt,
    scanMode: request.scanMode,
    walletAddress: request.walletAddress,
    walletChain: request.walletChain
  };
}
function canonicalizeSnapshot(snapshot) {
  return {
    capturedAt: snapshot.capturedAt,
    metadata: canonicalizeStringRecord(snapshot.metadata),
    networkId: snapshot.networkId,
    requestId: snapshot.requestId,
    sections: snapshot.sections.map(canonicalizeSnapshotSection),
    snapshotId: snapshot.snapshotId,
    walletAddress: snapshot.walletAddress,
    walletChain: snapshot.walletChain
  };
}
function canonicalizeResult(result) {
  return {
    capabilityBoundaries: result.capabilityBoundaries.map(
      canonicalizeCapabilityBoundary
    ),
    cleanupPlan: canonicalizeCleanupPlan(result.cleanupPlan),
    evaluatedAt: result.evaluatedAt,
    findings: result.findings.map(canonicalizeFinding),
    networkId: result.networkId,
    requestId: result.requestId,
    riskFactors: result.riskFactors.map(canonicalizeRiskFactor),
    scoreBreakdown: canonicalizeScoreBreakdown(result.scoreBreakdown),
    snapshotId: result.snapshotId,
    walletAddress: result.walletAddress,
    walletChain: result.walletChain
  };
}
function canonicalizeSummary(summary) {
  return {
    actionableFindingCount: summary.actionableFindingCount,
    cleanupActionCount: summary.cleanupActionCount,
    findingCount: summary.findingCount,
    generatedAt: summary.generatedAt,
    networkId: summary.networkId,
    openFindingCount: summary.openFindingCount,
    riskLevel: summary.riskLevel,
    scanMode: summary.scanMode,
    score: summary.score,
    snapshotCapturedAt: summary.snapshotCapturedAt,
    walletAddress: summary.walletAddress,
    walletChain: summary.walletChain
  };
}
function canonicalizeReportIdInput(input) {
  return {
    cleanupExecution: canonicalizeCleanupExecution(input.cleanupExecution),
    generatedAt: input.generatedAt,
    reportVersion: input.reportVersion,
    request: canonicalizeRequest(input.request),
    result: canonicalizeResult(input.result),
    snapshot: canonicalizeSnapshot(input.snapshot),
    summary: canonicalizeSummary(input.summary)
  };
}
function buildWalletReportId(input) {
  const canonicalPayload = serializeCanonicalJson(canonicalizeReportIdInput(input));
  return `wallet_report_${sha256Hex(canonicalPayload)}`;
}

// src/wallet/evm/ids.ts
function buildStableId(prefix, payload) {
  return `${prefix}_${sha256Hex(serializeCanonicalJson(payload)).slice(0, 24)}`;
}

// src/wallet/evm/constants.ts
var EVM_WALLET_FINDING_CODES = Object.freeze({
  FLAGGED_SPENDER: "EVM_FLAGGED_SPENDER_EXPOSURE",
  RISKY_CONTRACT: "EVM_RISKY_CONTRACT_EXPOSURE",
  UNLIMITED_APPROVAL: "EVM_UNLIMITED_APPROVAL_EXPOSURE",
  STALE_APPROVAL: "EVM_STALE_APPROVAL_EXPOSURE",
  EXCESSIVE_APPROVALS: "EVM_EXCESSIVE_APPROVALS"
});
var EVM_APPROVAL_STALE_DAYS = 90;
var EVM_EXCESSIVE_APPROVAL_THRESHOLD = 10;
var EVM_SEVERE_APPROVAL_THRESHOLD = 20;
var EVM_WALLET_SCORE_COMPONENT_MAX = Object.freeze({
  authorizationHygiene: 40,
  spenderTrust: 25,
  approvalFreshness: 15,
  contractExposure: 20
});

// src/wallet/evm/cleanup-eligibility.ts
function isActiveApproval(approval) {
  if (approval.approvalKind === "erc20_allowance") {
    return approval.amount !== null && approval.amount !== "0";
  }
  return true;
}
function getEvmCleanupRevocationMethod(approval) {
  switch (approval.approvalKind) {
    case "erc20_allowance":
      return "erc20_approve_zero";
    case "erc721_token":
      return "erc721_approve_zero";
    case "erc721_operator":
      return "erc721_set_approval_for_all_false";
    case "erc1155_operator":
      return "erc1155_set_approval_for_all_false";
    default:
      return null;
  }
}
function getEvmCleanupEligibility(approval) {
  if (!isActiveApproval(approval)) {
    return {
      eligible: false,
      reasonCode: "inactive",
      revocationMethod: null,
      supportStatus: "not_supported",
      detail: "Inactive approvals must not produce cleanup actions or revoke payloads."
    };
  }
  const revocationMethod = getEvmCleanupRevocationMethod(approval);
  if (revocationMethod === null) {
    return {
      eligible: false,
      reasonCode: "unsupported_approval_kind",
      revocationMethod: null,
      supportStatus: "not_supported",
      detail: "This approval kind does not have a supported deterministic revoke method."
    };
  }
  if (approval.approvalKind === "erc20_allowance" && approval.amount === null) {
    return {
      eligible: false,
      reasonCode: "missing_amount",
      revocationMethod: null,
      supportStatus: "not_supported",
      detail: "ERC-20 cleanup requires a normalized allowance amount before a revoke can be prepared."
    };
  }
  if (approval.approvalKind === "erc721_token" && approval.tokenId === null) {
    return {
      eligible: false,
      reasonCode: "missing_token_id",
      revocationMethod: null,
      supportStatus: "not_supported",
      detail: "ERC-721 token approval cleanup requires a tokenId before a revoke can be prepared."
    };
  }
  return {
    eligible: true,
    reasonCode: "supported",
    revocationMethod,
    supportStatus: "supported",
    detail: "Active approval has a supported deterministic revoke method and can be prepared for wallet signature."
  };
}

// src/wallet/evm/cleanup.ts
var PHASE_4C_SUPPORT_DETAIL = "Prepared from normalized approval data only. User review, signature, submission, and confirmation occur outside this layer.";
var ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
function compareRiskLevel(left, right) {
  const order = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };
  return order[left] - order[right];
}
function uniqueSorted(values) {
  return [...new Set(values)].sort();
}
function compareApprovals(left, right) {
  return left.approvalId.localeCompare(right.approvalId) || left.tokenAddress.localeCompare(right.tokenAddress) || left.spenderAddress.localeCompare(right.spenderAddress) || (left.tokenId ?? "").localeCompare(right.tokenId ?? "");
}
function deduplicateApprovals(approvals) {
  const uniqueApprovals = /* @__PURE__ */ new Map();
  for (const approval of [...approvals].sort(compareApprovals)) {
    if (!uniqueApprovals.has(approval.approvalId)) {
      uniqueApprovals.set(approval.approvalId, approval);
    }
  }
  return [...uniqueApprovals.values()];
}
function hasSevereSpenderFlag(approval) {
  return approval.spenderFlags.some(
    (flag) => ["drainer", "malicious", "phishing", "exploit", "sanctioned"].includes(flag)
  );
}
function getFindingPriority(approval, finding) {
  switch (finding.metadata.code) {
    case EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER:
      return approval.spenderRiskLevel === "critical" || hasSevereSpenderFlag(approval) ? "critical" : "high";
    case EVM_WALLET_FINDING_CODES.RISKY_CONTRACT:
      return "high";
    case EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL:
      if (approval.spenderDisposition === "flagged" || approval.hasRiskyContractExposure) {
        return "critical";
      }
      return approval.spenderDisposition === "unknown" ? "high" : "medium";
    case EVM_WALLET_FINDING_CODES.STALE_APPROVAL:
      return "medium";
    case EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS:
      return "medium";
    default:
      return finding.riskLevel;
  }
}
function buildActionTitle(approval) {
  switch (approval.approvalKind) {
    case "erc20_allowance":
      return "Revoke ERC-20 allowance";
    case "erc721_token":
      return "Clear ERC-721 token approval";
    case "erc721_operator":
      return "Revoke ERC-721 operator approval";
    case "erc1155_operator":
      return "Revoke ERC-1155 operator approval";
  }
}
function buildActionDescription(approval) {
  switch (approval.approvalKind) {
    case "erc20_allowance":
      return `Prepare approve(spender, 0) for ${approval.spenderAddress} on token ${approval.tokenAddress}.`;
    case "erc721_token":
      return `Prepare approve(${ZERO_ADDRESS}, tokenId) to clear token ${approval.tokenId ?? ""} approval on ${approval.tokenAddress}.`;
    case "erc721_operator":
      return `Prepare setApprovalForAll(operator, false) for ${approval.spenderAddress} on ERC-721 contract ${approval.tokenAddress}.`;
    case "erc1155_operator":
      return `Prepare setApprovalForAll(operator, false) for ${approval.spenderAddress} on ERC-1155 contract ${approval.tokenAddress}.`;
  }
}
function buildApprovalCurrentState(approval) {
  switch (approval.approvalKind) {
    case "erc20_allowance":
      return approval.amount ?? "0";
    case "erc721_token":
      return approval.spenderAddress;
    case "erc721_operator":
    case "erc1155_operator":
      return "true";
  }
}
function buildApprovalIntendedState(approval) {
  switch (approval.approvalKind) {
    case "erc20_allowance":
      return "0";
    case "erc721_token":
      return ZERO_ADDRESS;
    case "erc721_operator":
    case "erc1155_operator":
      return "false";
  }
}
function buildTargetLabel(approval) {
  return `${approval.approvalKind}:${approval.tokenAddress}`;
}
function approvalMatchesFinding(approval, finding) {
  if (finding.resourceIds.includes(approval.approvalId)) {
    return true;
  }
  if (finding.metadata.code === EVM_WALLET_FINDING_CODES.RISKY_CONTRACT) {
    return approval.riskyContractExposureIds.some(
      (resourceId) => finding.resourceIds.includes(resourceId)
    );
  }
  return false;
}
function buildBatchPlans(actions, walletAddress, networkId, evaluatedAt) {
  const grouped = /* @__PURE__ */ new Map();
  for (const action of actions) {
    const key = `${action.revocationMethod}:${action.approval.tokenAddress}`;
    const existing = grouped.get(key) ?? [];
    grouped.set(key, [...existing, action]);
  }
  return [...grouped.entries()].map(([, batchActions]) => ({
    batchId: buildStableId("wallet_batch", {
      actionIds: batchActions.map((action) => action.actionId),
      networkId,
      walletAddress
    }),
    walletChain: "evm",
    walletAddress,
    networkId,
    createdAt: evaluatedAt,
    supportStatus: "partial",
    executionKind: "multiple_transactions",
    title: `Review ${batchActions.length} revoke action(s)`,
    summary: `Grouped by ${batchActions[0]?.revocationMethod ?? "revoke"} on ${batchActions[0]?.approval.tokenAddress ?? "unknown contract"}. Execution remains explicit and may require ${batchActions.length} separate transaction(s).`,
    actionIds: batchActions.map((action) => action.actionId),
    actions: batchActions
  }));
}
function buildEvmCleanupPlan(walletAddress, networkId, evaluatedAt, approvals, findings, riskFactors) {
  if (findings.length === 0 || approvals.length === 0) {
    return {
      cleanupPlan: null,
      actionIdsByFindingId: {}
    };
  }
  const riskFactorIds = new Set(riskFactors.map((factor) => factor.factorId));
  const actionIdsByFindingId = /* @__PURE__ */ new Map();
  const actions = deduplicateApprovals(approvals).map((approval) => {
    const eligibility = getEvmCleanupEligibility(approval);
    if (!eligibility.eligible || eligibility.revocationMethod === null) {
      return null;
    }
    const linkedFindings = findings.filter((finding) => approvalMatchesFinding(approval, finding)).sort((left, right) => left.findingId.localeCompare(right.findingId));
    if (linkedFindings.length === 0) {
      return null;
    }
    const firstFinding = linkedFindings[0];
    if (!firstFinding) {
      return null;
    }
    const findingIds = linkedFindings.map((finding) => finding.findingId);
    const linkedRiskFactorIds = uniqueSorted(
      linkedFindings.flatMap((finding) => finding.riskFactorIds)
    );
    const priority = linkedFindings.reduce(
      (highest, finding) => compareRiskLevel(getFindingPriority(approval, finding), highest) > 0 ? getFindingPriority(approval, finding) : highest,
      getFindingPriority(approval, firstFinding)
    );
    const explanation = `Revoking ${approval.approvalKind} for ${approval.spenderAddress} on ${approval.tokenAddress} removes the currently active authorization. A later re-scan is still required before claiming remediation.`;
    const action = {
      actionId: buildStableId("wallet_action", {
        approvalId: approval.approvalId
      }),
      walletChain: "evm",
      kind: "revoke_authorization",
      executionMode: "guided",
      executionType: "wallet_signature",
      status: "ready",
      requiresSignature: true,
      supportStatus: "supported",
      title: buildActionTitle(approval),
      description: buildActionDescription(approval),
      priority,
      target: {
        targetId: buildStableId("wallet_target", {
          approvalId: approval.approvalId,
          walletAddress
        }),
        targetKind: "authorization",
        label: buildTargetLabel(approval),
        metadata: {
          approvalId: approval.approvalId,
          approvalKind: approval.approvalKind,
          spenderAddress: approval.spenderAddress,
          tokenAddress: approval.tokenAddress,
          tokenId: approval.tokenId ?? ""
        }
      },
      findingIds,
      riskFactorIds: linkedRiskFactorIds.filter(
        (factorId) => riskFactorIds.has(factorId)
      ),
      supportDetail: PHASE_4C_SUPPORT_DETAIL,
      metadata: {
        approvalId: approval.approvalId,
        approvalKind: approval.approvalKind,
        estimatedRiskReduction: priority,
        executionType: "wallet_signature",
        intendedState: buildApprovalIntendedState(approval),
        requiresSignature: "true",
        revocationMethod: eligibility.revocationMethod,
        spenderAddress: approval.spenderAddress,
        tokenAddress: approval.tokenAddress,
        tokenId: approval.tokenId ?? ""
      },
      revocationMethod: eligibility.revocationMethod,
      approval: {
        approvalId: approval.approvalId,
        approvalKind: approval.approvalKind,
        tokenAddress: approval.tokenAddress,
        spenderAddress: approval.spenderAddress,
        tokenId: approval.tokenId,
        currentState: buildApprovalCurrentState(approval),
        intendedState: buildApprovalIntendedState(approval)
      },
      estimatedRiskReduction: priority,
      explanation
    };
    for (const findingId of findingIds) {
      const actionIds = actionIdsByFindingId.get(findingId) ?? /* @__PURE__ */ new Set();
      actionIds.add(action.actionId);
      actionIdsByFindingId.set(findingId, actionIds);
    }
    return action;
  }).filter((action) => action !== null).sort((left, right) => {
    const priorityDelta = compareRiskLevel(right.priority, left.priority);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return left.approval.tokenAddress.localeCompare(right.approval.tokenAddress) || left.approval.spenderAddress.localeCompare(right.approval.spenderAddress) || (left.approval.tokenId ?? "").localeCompare(right.approval.tokenId ?? "") || left.actionId.localeCompare(right.actionId);
  });
  if (actions.length === 0) {
    return {
      cleanupPlan: null,
      actionIdsByFindingId: {}
    };
  }
  const batches = buildBatchPlans(actions, walletAddress, networkId, evaluatedAt);
  const serializedActionIdsByFindingId = {};
  for (const [findingId, actionIds] of actionIdsByFindingId.entries()) {
    serializedActionIdsByFindingId[findingId] = [...actionIds].sort();
  }
  const cleanupPlan = {
    planId: buildStableId("wallet_plan", {
      actionIds: actions.map((action) => action.actionId),
      networkId,
      walletAddress
    }),
    walletChain: "evm",
    walletAddress,
    networkId,
    createdAt: evaluatedAt,
    summary: `Prepared ${actions.length} deterministic revoke action(s) across ${batches.length} logical batch group(s). Execution still requires explicit user review and signature outside this layer.`,
    actions,
    batches,
    projectedScore: null,
    projectedRiskLevel: null
  };
  return {
    cleanupPlan,
    actionIdsByFindingId: serializedActionIdsByFindingId
  };
}

// src/wallet/evm/score.ts
var RISK_LEVEL_ORDER = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};
function maxRiskLevel(levels, fallback) {
  return levels.reduce(
    (current, candidate) => RISK_LEVEL_ORDER[candidate] > RISK_LEVEL_ORDER[current] ? candidate : current,
    fallback
  );
}
function scoreBand(totalScore) {
  if (totalScore >= 85) {
    return "low";
  }
  if (totalScore >= 60) {
    return "medium";
  }
  if (totalScore >= 35) {
    return "high";
  }
  return "critical";
}
function findItemsByCode(items, code) {
  return items.filter((item) => item.metadata.code === code);
}
function buildComponent(label, maxScore, score, rationale, findings, factors) {
  return {
    componentId: buildStableId("wallet_component", {
      label,
      score,
      maxScore
    }),
    label,
    score,
    maxScore,
    riskLevel: maxRiskLevel(
      [...findings.map((finding) => finding.riskLevel), ...factors.map((factor) => factor.riskLevel)],
      score === maxScore ? "low" : "medium"
    ),
    rationale,
    findingIds: findings.map((finding) => finding.findingId),
    riskFactorIds: factors.map((factor) => factor.factorId)
  };
}
function buildEvmWalletScoreBreakdown(_snapshot, signals, findings, riskFactors) {
  const unlimitedFindings = findItemsByCode(
    findings,
    EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL
  );
  const flaggedFindings = findItemsByCode(
    findings,
    EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER
  );
  const staleFindings = findItemsByCode(
    findings,
    EVM_WALLET_FINDING_CODES.STALE_APPROVAL
  );
  const excessiveFindings = findItemsByCode(
    findings,
    EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS
  );
  const contractFindings = findItemsByCode(
    findings,
    EVM_WALLET_FINDING_CODES.RISKY_CONTRACT
  );
  const unlimitedPenalty = Math.min(signals.unlimitedApprovalCount * 10, 24);
  const approvalCountPenalty = signals.approvalCount >= EVM_SEVERE_APPROVAL_THRESHOLD ? 16 : signals.approvalCount >= EVM_EXCESSIVE_APPROVAL_THRESHOLD ? 8 : 0;
  const authorizationScore = EVM_WALLET_SCORE_COMPONENT_MAX.authorizationHygiene - Math.min(
    EVM_WALLET_SCORE_COMPONENT_MAX.authorizationHygiene,
    unlimitedPenalty + approvalCountPenalty
  );
  const flaggedPenalty = Math.min(signals.flaggedSpenderCount * 12, 25);
  const unknownUnlimitedPenalty = Math.min(
    signals.unknownUnlimitedApprovalCount * 6,
    12
  );
  const spenderTrustScore = EVM_WALLET_SCORE_COMPONENT_MAX.spenderTrust - Math.min(
    EVM_WALLET_SCORE_COMPONENT_MAX.spenderTrust,
    flaggedPenalty + unknownUnlimitedPenalty
  );
  const stalePenalty = Math.min(signals.staleApprovalCount * 5, 15);
  const freshnessScore = EVM_WALLET_SCORE_COMPONENT_MAX.approvalFreshness - stalePenalty;
  const contractPenalty = Math.min(signals.riskyContractExposureCount * 10, 20);
  const contractExposureScore = EVM_WALLET_SCORE_COMPONENT_MAX.contractExposure - contractPenalty;
  const components = [
    buildComponent(
      "Authorization hygiene",
      EVM_WALLET_SCORE_COMPONENT_MAX.authorizationHygiene,
      authorizationScore,
      `${signals.unlimitedApprovalCount} unlimited approval(s) and ${signals.approvalCount} active approval(s) drive this component.`,
      [...unlimitedFindings, ...excessiveFindings],
      riskFactors.filter(
        (factor) => factor.metadata.code === EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL || factor.metadata.code === EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS
      )
    ),
    buildComponent(
      "Spender trust",
      EVM_WALLET_SCORE_COMPONENT_MAX.spenderTrust,
      spenderTrustScore,
      `${signals.flaggedSpenderCount} approval(s) point to flagged spenders and ${signals.unknownUnlimitedApprovalCount} unlimited approval(s) point to unknown spenders.`,
      [...flaggedFindings, ...unlimitedFindings],
      riskFactors.filter(
        (factor) => factor.metadata.code === EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER || factor.metadata.code === EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL
      )
    ),
    buildComponent(
      "Approval freshness",
      EVM_WALLET_SCORE_COMPONENT_MAX.approvalFreshness,
      freshnessScore,
      `${signals.staleApprovalCount} approval(s) exceeded the stale threshold.`,
      staleFindings,
      riskFactors.filter(
        (factor) => factor.metadata.code === EVM_WALLET_FINDING_CODES.STALE_APPROVAL
      )
    ),
    buildComponent(
      "Contract exposure",
      EVM_WALLET_SCORE_COMPONENT_MAX.contractExposure,
      contractExposureScore,
      `${signals.riskyContractExposureCount} risky contract exposure(s) were supplied in the hydrated snapshot.`,
      contractFindings,
      riskFactors.filter(
        (factor) => factor.metadata.code === EVM_WALLET_FINDING_CODES.RISKY_CONTRACT
      )
    )
  ];
  const totalScore = components.reduce((sum, component) => sum + component.score, 0);
  const findingRiskLevel = maxRiskLevel(
    findings.map((finding) => finding.riskLevel),
    "low"
  );
  const riskLevel = maxRiskLevel([scoreBand(totalScore), findingRiskLevel], "low");
  return {
    totalScore,
    riskLevel,
    rationale: findings.length === 0 ? "No deterministic EVM approval findings were produced from the hydrated snapshot." : `Score starts at 100 and applies fixed deductions for authorization hygiene, spender trust, approval freshness, and risky contract exposure.`,
    components
  };
}

// src/wallet/evm/assemble.ts
function buildCapabilityBoundaries() {
  return [
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "snapshot",
        capabilityKey: "hydrated_evm_snapshot"
      }),
      area: "snapshot",
      capabilityKey: "hydrated_evm_snapshot",
      status: "supported",
      detail: "Phase 4B evaluates only caller-supplied hydrated EVM snapshot data and performs no live lookups during normalization or scoring."
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "finding",
        capabilityKey: "deterministic_evm_findings"
      }),
      area: "finding",
      capabilityKey: "deterministic_evm_findings",
      status: "supported",
      detail: "Phase 4B emits deterministic EVM approval findings, factors, and score breakdowns from the supplied snapshot only."
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "cleanup_plan",
        capabilityKey: "deterministic_evm_cleanup_plan"
      }),
      area: "cleanup_plan",
      capabilityKey: "deterministic_evm_cleanup_plan",
      status: "supported",
      detail: "Phase 4C builds deterministic EVM revoke actions and logical batch groupings from normalized approval data only."
    },
    {
      boundaryId: buildStableId("wallet_boundary", {
        area: "cleanup_execution",
        capabilityKey: "evm_cleanup_execution"
      }),
      area: "cleanup_execution",
      capabilityKey: "evm_cleanup_execution",
      status: "partial",
      detail: "Phase 4C prepares deterministic revoke payloads and normalizes externally supplied execution results, but it does not request signatures or broadcast transactions."
    }
  ];
}
function buildFindingId(walletAddress, code, resourceIds) {
  return buildStableId("wallet_finding", {
    code,
    resourceIds,
    walletAddress
  });
}
function buildRiskFactors(findings) {
  return findings.map((finding) => ({
    factorId: buildStableId("wallet_factor", {
      code: finding.metadata.code ?? "",
      findingId: finding.findingId,
      resourceIds: finding.resourceIds
    }),
    walletChain: "evm",
    category: finding.category,
    riskLevel: finding.riskLevel,
    title: finding.title,
    summary: finding.summary,
    findingIds: [finding.findingId],
    resourceIds: finding.resourceIds,
    metadata: {
      code: finding.metadata.code ?? "",
      sourceFindingId: finding.findingId
    }
  }));
}
function assembleEvmWalletEvaluation(input) {
  const normalizedRequest = {
    ...input.request,
    walletAddress: input.normalizedSnapshot.walletAddress
  };
  const normalizedSnapshotContract = {
    ...input.snapshot,
    walletAddress: input.normalizedSnapshot.walletAddress
  };
  const findingsWithoutActions = input.findingDrafts.map((draft) => ({
    findingId: buildFindingId(
      input.normalizedSnapshot.walletAddress,
      draft.code,
      draft.resourceIds
    ),
    walletChain: "evm",
    category: draft.category,
    riskLevel: draft.riskLevel,
    status: "open",
    title: draft.title,
    summary: draft.summary,
    detectedAt: input.evaluatedAt,
    resourceIds: draft.resourceIds,
    riskFactorIds: [],
    cleanupActionIds: [],
    evidence: draft.evidence,
    metadata: draft.metadata
  }));
  const riskFactors = buildRiskFactors(findingsWithoutActions);
  const riskFactorByCode = new Map(
    riskFactors.map((factor) => [factor.metadata.code, factor.factorId])
  );
  const findingsWithFactors = findingsWithoutActions.map((finding) => ({
    ...finding,
    riskFactorIds: riskFactorByCode.get(finding.metadata.code ?? "") ? [riskFactorByCode.get(finding.metadata.code ?? "")] : []
  }));
  const scoreBreakdown = buildEvmWalletScoreBreakdown(
    input.normalizedSnapshot,
    input.signals,
    findingsWithFactors,
    riskFactors
  );
  const { cleanupPlan, actionIdsByFindingId } = buildEvmCleanupPlan(
    input.normalizedSnapshot.walletAddress,
    normalizedRequest.networkId,
    input.evaluatedAt,
    input.normalizedSnapshot.approvals,
    findingsWithFactors,
    riskFactors
  );
  const findings = findingsWithFactors.map((finding) => ({
    ...finding,
    cleanupActionIds: actionIdsByFindingId[finding.findingId] ?? []
  }));
  const capabilityBoundaries = buildCapabilityBoundaries();
  const result = {
    requestId: normalizedRequest.requestId,
    snapshotId: normalizedSnapshotContract.snapshotId,
    walletChain: "evm",
    walletAddress: input.normalizedSnapshot.walletAddress,
    networkId: normalizedRequest.networkId,
    evaluatedAt: input.evaluatedAt,
    findings,
    riskFactors,
    scoreBreakdown,
    cleanupPlan,
    capabilityBoundaries
  };
  const summary = {
    walletChain: "evm",
    walletAddress: input.normalizedSnapshot.walletAddress,
    networkId: normalizedRequest.networkId,
    scanMode: normalizedRequest.scanMode,
    generatedAt: input.evaluatedAt,
    snapshotCapturedAt: normalizedSnapshotContract.capturedAt,
    score: scoreBreakdown.totalScore,
    riskLevel: scoreBreakdown.riskLevel,
    findingCount: findings.length,
    openFindingCount: findings.length,
    cleanupActionCount: cleanupPlan?.actions.length ?? 0,
    actionableFindingCount: findings.filter(
      (finding) => finding.cleanupActionIds.length > 0
    ).length
  };
  const report = {
    reportId: buildWalletReportId({
      reportVersion: input.reportVersion,
      generatedAt: input.evaluatedAt,
      request: normalizedRequest,
      snapshot: normalizedSnapshotContract,
      result,
      summary,
      cleanupExecution: null
    }),
    reportVersion: input.reportVersion,
    generatedAt: input.evaluatedAt,
    request: normalizedRequest,
    snapshot: normalizedSnapshotContract,
    result,
    summary,
    cleanupExecution: null
  };
  return {
    score: scoreBreakdown.totalScore,
    riskLevel: scoreBreakdown.riskLevel,
    normalizedSnapshot: input.normalizedSnapshot,
    signals: input.signals,
    result,
    summary,
    report
  };
}

// src/wallet/evm/normalize.ts
var MAX_UINT256 = (1n << 256n) - 1n;
function normalizeMetadata(metadata) {
  if (!metadata) {
    return {};
  }
  const normalized = {};
  for (const key of Object.keys(metadata).sort()) {
    normalized[key] = metadata[key];
  }
  return normalized;
}
function normalizeFlags(flags) {
  return [...new Set((flags ?? []).map((flag) => flag.trim().toLowerCase()).filter(Boolean))].sort();
}
function parseIntegerString(value) {
  if (value === null || value === void 0) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    return BigInt(trimmed).toString(10);
  }
  if (/^[0-9]+$/.test(trimmed)) {
    return BigInt(trimmed).toString(10);
  }
  return trimmed;
}
function compareNullable(left, right) {
  return (left ?? "").localeCompare(right ?? "");
}
function pickSourceSectionId(explicitSectionId, candidates) {
  if (explicitSectionId) {
    return explicitSectionId;
  }
  return candidates[0] ?? null;
}
function findSectionIds(input, matcher) {
  return input.snapshot.sections.filter((section) => {
    const haystacks = [
      section.sectionId,
      section.sectionType,
      section.label
    ].map((value) => value.toLowerCase());
    return haystacks.some(matcher);
  }).map((section) => section.sectionId).sort();
}
function normalizeSpender(input, defaultSectionIds) {
  const flags = normalizeFlags(input.flags);
  const riskLevel = input.riskLevel ?? (flags.length > 0 ? "high" : null);
  const disposition = flags.length > 0 || riskLevel !== null && riskLevel !== "low" ? "flagged" : input.trusted ? "trusted" : "unknown";
  const spenderAddress = normalizeEvmAddress(input.spenderAddress);
  const sourceSectionId = pickSourceSectionId(input.sourceSectionId, defaultSectionIds);
  const metadata = normalizeMetadata(input.metadata);
  return {
    resourceId: buildStableId("wallet_spender", {
      disposition,
      riskLevel,
      sourceSectionId,
      spenderAddress
    }),
    spenderAddress,
    disposition,
    riskLevel,
    flags,
    label: input.label ?? null,
    sourceSectionId,
    metadata
  };
}
function normalizeContractExposure(input, defaultSectionIds) {
  const flags = normalizeFlags(input.flags);
  const riskLevel = input.riskLevel ?? (flags.length > 0 ? "high" : null);
  const contractAddress = normalizeEvmAddress(input.contractAddress);
  const sourceSectionId = pickSourceSectionId(input.sourceSectionId, defaultSectionIds);
  const metadata = normalizeMetadata(input.metadata);
  const isRisky = flags.length > 0 || riskLevel !== null && riskLevel !== "low";
  return {
    resourceId: buildStableId("wallet_contract", {
      contractAddress,
      exposureType: input.exposureType,
      riskLevel,
      sourceSectionId
    }),
    contractAddress,
    exposureType: input.exposureType,
    riskLevel,
    flags,
    label: input.label ?? null,
    isRisky,
    sourceSectionId,
    metadata
  };
}
function deriveApprovalKind(input) {
  if (input.tokenStandard === "erc20") {
    return "erc20_allowance";
  }
  if (input.tokenStandard === "erc721" && input.tokenId) {
    return "erc721_token";
  }
  return input.tokenStandard === "erc721" ? "erc721_operator" : "erc1155_operator";
}
function isInactiveApproval(approvalKind, amount, isApproved) {
  if (approvalKind === "erc20_allowance") {
    return amount === "0";
  }
  if (approvalKind === "erc721_token" || approvalKind === "erc721_operator" || approvalKind === "erc1155_operator") {
    return isApproved === false;
  }
  return false;
}
function computeAgeDays(approvedAt, capturedAt) {
  if (!approvedAt) {
    return null;
  }
  const approvedAtMs = Date.parse(approvedAt);
  const capturedAtMs = Date.parse(capturedAt);
  if (Number.isNaN(approvedAtMs) || Number.isNaN(capturedAtMs) || approvedAtMs > capturedAtMs) {
    return null;
  }
  return Math.floor((capturedAtMs - approvedAtMs) / 864e5);
}
function normalizeApproval(input, walletAddress, capturedAt, spenderMap, contractMap, defaultSectionIds) {
  const approvalKind = deriveApprovalKind(input);
  const tokenAddress = normalizeEvmAddress(input.tokenAddress);
  const spenderAddress = normalizeEvmAddress(input.spenderAddress);
  const amount = parseIntegerString(input.amount);
  if (isInactiveApproval(approvalKind, amount, input.isApproved)) {
    return null;
  }
  const spender = spenderMap.get(spenderAddress);
  const contractMatches = [tokenAddress, spenderAddress].map((address) => contractMap.get(address)).filter(
    (exposure) => exposure !== void 0 && exposure.isRisky
  ).sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  const riskyContractExposureIds = contractMatches.map((match) => match.resourceId);
  const ageDays = computeAgeDays(input.approvedAt ?? null, capturedAt);
  const amountKind = approvalKind === "erc20_allowance" ? amount === MAX_UINT256.toString(10) ? "unlimited" : "limited" : approvalKind === "erc721_token" ? "not_applicable" : "unlimited";
  const metadata = normalizeMetadata(input.metadata);
  const sourceSectionId = pickSourceSectionId(input.sourceSectionId, defaultSectionIds);
  return {
    approvalId: buildStableId("wallet_approval", {
      amount: amount ?? "",
      approvalKind,
      approvedAt: input.approvedAt ?? "",
      spenderAddress,
      tokenAddress,
      tokenId: input.tokenId ?? "",
      walletAddress
    }),
    walletAddress,
    tokenStandard: input.tokenStandard,
    approvalKind,
    tokenAddress,
    spenderAddress,
    spenderDisposition: spender?.disposition ?? "unknown",
    spenderRiskLevel: spender?.riskLevel ?? null,
    spenderFlags: spender?.flags ?? [],
    amount,
    amountKind,
    tokenId: input.tokenId ?? null,
    isUnlimited: amountKind === "unlimited",
    approvedAt: input.approvedAt ?? null,
    ageDays,
    isStale: ageDays !== null && ageDays >= EVM_APPROVAL_STALE_DAYS,
    riskyContractExposureIds,
    hasRiskyContractExposure: riskyContractExposureIds.length > 0,
    sourceSectionId,
    metadata
  };
}
function normalizeEvmWalletSnapshot(input) {
  if (input.request.walletChain !== "evm" || input.snapshot.walletChain !== "evm") {
    throw new Error("Phase 4B EVM evaluation requires evm request and snapshot contracts.");
  }
  if (!isValidEvmAddress(input.request.walletAddress)) {
    throw new Error(
      "EVM wallet evaluation requires request.walletAddress to be a valid EVM address."
    );
  }
  if (!isValidEvmAddress(input.snapshot.walletAddress)) {
    throw new Error(
      "EVM wallet evaluation requires snapshot.walletAddress to be a valid EVM address."
    );
  }
  const requestWallet = normalizeEvmAddress(input.request.walletAddress);
  const snapshotWallet = normalizeEvmAddress(input.snapshot.walletAddress);
  if (requestWallet !== snapshotWallet) {
    throw new Error("Wallet request and snapshot addresses must match for EVM evaluation.");
  }
  if (input.request.requestId !== input.snapshot.requestId) {
    throw new Error("Wallet request and snapshot requestId values must match.");
  }
  if (input.request.networkId !== input.snapshot.networkId) {
    throw new Error("Wallet request and snapshot networkId values must match.");
  }
  const spenderSectionIds = findSectionIds(input, (value) => value.includes("spender"));
  const contractSectionIds = findSectionIds(input, (value) => value.includes("contract"));
  const approvalSectionIds = findSectionIds(input, (value) => value.includes("approval"));
  const spenders = (input.hydratedSnapshot.spenders ?? []).map((spender) => normalizeSpender(spender, spenderSectionIds)).sort((left, right) => left.spenderAddress.localeCompare(right.spenderAddress));
  const contractExposures = (input.hydratedSnapshot.contractExposures ?? []).map((exposure) => normalizeContractExposure(exposure, contractSectionIds)).sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  const spenderMap = new Map(spenders.map((spender) => [spender.spenderAddress, spender]));
  const contractMap = new Map(
    contractExposures.map((exposure) => [exposure.contractAddress, exposure])
  );
  const approvals = input.hydratedSnapshot.approvals.map(
    (approval) => normalizeApproval(
      approval,
      requestWallet,
      input.snapshot.capturedAt,
      spenderMap,
      contractMap,
      approvalSectionIds
    )
  ).filter(
    (approval) => approval !== null
  ).sort((left, right) => {
    return left.approvalKind.localeCompare(right.approvalKind) || left.tokenAddress.localeCompare(right.tokenAddress) || left.spenderAddress.localeCompare(right.spenderAddress) || compareNullable(left.tokenId, right.tokenId) || compareNullable(left.approvedAt, right.approvedAt) || left.approvalId.localeCompare(right.approvalId);
  });
  return {
    walletAddress: requestWallet,
    networkId: input.request.networkId,
    capturedAt: input.snapshot.capturedAt,
    approvals,
    spenders,
    contractExposures
  };
}

// src/wallet/evm/rules.ts
function compareRiskLevel2(left, right) {
  const order = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };
  return order[left] - order[right];
}
function maxRiskLevel2(levels, fallback) {
  return levels.reduce(
    (current, candidate) => compareRiskLevel2(candidate, current) > 0 ? candidate : current,
    fallback
  );
}
function uniqueSorted2(values) {
  return [...new Set(values)].sort();
}
function isSevereFlag(flags) {
  return flags.some(
    (flag) => ["drainer", "malicious", "phishing", "exploit", "sanctioned"].includes(flag)
  );
}
function buildEvidenceRefs(snapshot, sourceSectionIds, fallbackLabel) {
  const sectionIds = uniqueSorted2(sourceSectionIds.filter(Boolean));
  if (sectionIds.length > 0) {
    return sectionIds.map((sectionId) => ({
      evidenceId: buildStableId("wallet_evidence", {
        sectionId,
        fallbackLabel
      }),
      sourceType: "snapshot_section",
      sourceId: sectionId,
      label: snapshot.capturedAt && sectionId ? `Snapshot section: ${sectionId}` : fallbackLabel
    }));
  }
  return [
    {
      evidenceId: buildStableId("wallet_evidence", {
        fallbackLabel
      }),
      sourceType: "derived",
      sourceId: fallbackLabel.toLowerCase().replace(/\s+/g, "_"),
      label: fallbackLabel
    }
  ];
}
function approvalEvidence(snapshot, approvals, fallbackLabel) {
  return buildEvidenceRefs(
    snapshot,
    approvals.map((approval) => approval.sourceSectionId ?? ""),
    fallbackLabel
  );
}
function contractEvidence(snapshot, exposures, fallbackLabel) {
  return buildEvidenceRefs(
    snapshot,
    exposures.map((exposure) => exposure.sourceSectionId ?? ""),
    fallbackLabel
  );
}
function buildEvmWalletFindings(snapshot, signals) {
  const drafts = [];
  const approvals = snapshot.approvals;
  const flaggedApprovals = approvals.filter(
    (approval) => approval.spenderDisposition === "flagged"
  );
  const riskyExposures = snapshot.contractExposures.filter(
    (exposure) => exposure.isRisky
  );
  const unlimitedApprovals = approvals.filter((approval) => approval.isUnlimited);
  const staleApprovals = approvals.filter((approval) => approval.isStale);
  if (flaggedApprovals.length > 0) {
    const severe = flaggedApprovals.some(
      (approval) => approval.spenderRiskLevel === "critical" || isSevereFlag(approval.spenderFlags)
    );
    drafts.push({
      code: EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER,
      category: "counterparty",
      riskLevel: severe ? "critical" : "high",
      title: "Flagged spender exposure",
      summary: `${flaggedApprovals.length} approval${flaggedApprovals.length === 1 ? "" : "s"} target flagged spenders and should be reviewed first.`,
      resourceIds: uniqueSorted2(flaggedApprovals.map((approval) => approval.approvalId)),
      evidence: approvalEvidence(snapshot, flaggedApprovals, "Flagged spender exposure"),
      metadata: {
        approvalCount: String(flaggedApprovals.length),
        code: EVM_WALLET_FINDING_CODES.FLAGGED_SPENDER,
        highestSpenderRisk: maxRiskLevel2(
          flaggedApprovals.map((approval) => approval.spenderRiskLevel).filter((level) => level !== null),
          severe ? "critical" : "high"
        )
      }
    });
  }
  if (riskyExposures.length > 0) {
    const severe = riskyExposures.some(
      (exposure) => exposure.riskLevel === "critical" || isSevereFlag(exposure.flags)
    );
    drafts.push({
      code: EVM_WALLET_FINDING_CODES.RISKY_CONTRACT,
      category: "counterparty",
      riskLevel: severe ? "critical" : "high",
      title: "Risky contract exposure",
      summary: `${riskyExposures.length} risky contract exposure${riskyExposures.length === 1 ? "" : "s"} were supplied in the hydrated snapshot.`,
      resourceIds: uniqueSorted2(riskyExposures.map((exposure) => exposure.resourceId)),
      evidence: contractEvidence(snapshot, riskyExposures, "Risky contract exposure"),
      metadata: {
        code: EVM_WALLET_FINDING_CODES.RISKY_CONTRACT,
        exposureCount: String(riskyExposures.length)
      }
    });
  }
  if (unlimitedApprovals.length > 0) {
    const unknownCount = unlimitedApprovals.filter(
      (approval) => approval.spenderDisposition === "unknown"
    ).length;
    const hasCriticalExposure = unlimitedApprovals.some(
      (approval) => approval.spenderDisposition === "flagged" || approval.hasRiskyContractExposure
    );
    drafts.push({
      code: EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL,
      category: "authorization",
      riskLevel: hasCriticalExposure ? "critical" : unknownCount > 0 ? "high" : "medium",
      title: "Unlimited approvals remain active",
      summary: `${unlimitedApprovals.length} unlimited approval${unlimitedApprovals.length === 1 ? "" : "s"} remain active; ${unknownCount} target unknown spenders.`,
      resourceIds: uniqueSorted2(unlimitedApprovals.map((approval) => approval.approvalId)),
      evidence: approvalEvidence(snapshot, unlimitedApprovals, "Unlimited approval exposure"),
      metadata: {
        code: EVM_WALLET_FINDING_CODES.UNLIMITED_APPROVAL,
        riskyApprovalCount: String(
          unlimitedApprovals.filter((approval) => approval.hasRiskyContractExposure).length
        ),
        unknownSpenderCount: String(unknownCount),
        unlimitedApprovalCount: String(unlimitedApprovals.length)
      }
    });
  }
  if (staleApprovals.length > 0) {
    drafts.push({
      code: EVM_WALLET_FINDING_CODES.STALE_APPROVAL,
      category: "authorization",
      riskLevel: staleApprovals.length >= 5 ? "high" : "medium",
      title: "Stale approvals still exist",
      summary: `${staleApprovals.length} approval${staleApprovals.length === 1 ? "" : "s"} are at least ${EVM_APPROVAL_STALE_DAYS} days old.`,
      resourceIds: uniqueSorted2(staleApprovals.map((approval) => approval.approvalId)),
      evidence: approvalEvidence(snapshot, staleApprovals, "Stale approval exposure"),
      metadata: {
        code: EVM_WALLET_FINDING_CODES.STALE_APPROVAL,
        staleApprovalCount: String(staleApprovals.length)
      }
    });
  }
  if (signals.hasExcessiveApprovals) {
    drafts.push({
      code: EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS,
      category: "authorization",
      riskLevel: signals.approvalCount >= EVM_SEVERE_APPROVAL_THRESHOLD ? "high" : "medium",
      title: "Approval count exceeds review threshold",
      summary: `Wallet currently carries ${signals.approvalCount} active approvals, above the review threshold of ${EVM_EXCESSIVE_APPROVAL_THRESHOLD}.`,
      resourceIds: uniqueSorted2(approvals.map((approval) => approval.approvalId)),
      evidence: approvalEvidence(snapshot, approvals, "Excessive approval exposure"),
      metadata: {
        approvalCount: String(signals.approvalCount),
        code: EVM_WALLET_FINDING_CODES.EXCESSIVE_APPROVALS
      }
    });
  }
  return drafts;
}

// src/wallet/evm/signals.ts
function buildEvmWalletSignals(snapshot) {
  const approvals = snapshot.approvals;
  const unlimitedApprovals = approvals.filter((approval) => approval.isUnlimited);
  const unknownUnlimitedApprovals = unlimitedApprovals.filter(
    (approval) => approval.spenderDisposition === "unknown"
  );
  const flaggedSpenderApprovals = approvals.filter(
    (approval) => approval.spenderDisposition === "flagged"
  );
  const staleApprovals = approvals.filter((approval) => approval.isStale);
  const riskyContractExposures = snapshot.contractExposures.filter(
    (exposure) => exposure.isRisky
  );
  return {
    approvalCount: approvals.length,
    erc20ApprovalCount: approvals.filter((approval) => approval.tokenStandard === "erc20").length,
    erc721ApprovalCount: approvals.filter((approval) => approval.tokenStandard === "erc721").length,
    erc1155ApprovalCount: approvals.filter((approval) => approval.tokenStandard === "erc1155").length,
    unlimitedApprovalCount: unlimitedApprovals.length,
    unlimitedApprovalIds: unlimitedApprovals.map((approval) => approval.approvalId),
    unknownUnlimitedApprovalCount: unknownUnlimitedApprovals.length,
    unknownUnlimitedApprovalIds: unknownUnlimitedApprovals.map(
      (approval) => approval.approvalId
    ),
    flaggedSpenderCount: flaggedSpenderApprovals.length,
    flaggedSpenderApprovalIds: flaggedSpenderApprovals.map(
      (approval) => approval.approvalId
    ),
    staleApprovalCount: staleApprovals.length,
    staleApprovalIds: staleApprovals.map((approval) => approval.approvalId),
    riskyContractExposureCount: riskyContractExposures.length,
    riskyContractExposureIds: riskyContractExposures.map(
      (exposure) => exposure.resourceId
    ),
    hasExcessiveApprovals: approvals.length >= EVM_EXCESSIVE_APPROVAL_THRESHOLD
  };
}

// src/wallet/evm/evaluate.ts
function evaluateEvmWalletScan(input) {
  const normalizedSnapshot = normalizeEvmWalletSnapshot(input);
  const signals = buildEvmWalletSignals(normalizedSnapshot);
  const findingDrafts = buildEvmWalletFindings(normalizedSnapshot, signals);
  return assembleEvmWalletEvaluation({
    request: input.request,
    snapshot: input.snapshot,
    normalizedSnapshot,
    signals,
    findingDrafts,
    evaluatedAt: input.evaluatedAt,
    reportVersion: input.reportVersion ?? "1"
  });
}

// src/wallet/solana/constants.ts
var SOLANA_WALLET_FINDING_CODES = Object.freeze({
  DELEGATE_AUTHORITY: "SOLANA_DELEGATE_AUTHORITY_EXPOSURE",
  AUTHORITY_ASSIGNMENT: "SOLANA_AUTHORITY_ASSIGNMENT_EXPOSURE",
  BROAD_PERMISSION: "SOLANA_BROAD_PERMISSION_EXPOSURE",
  RISKY_CONNECTION: "SOLANA_RISKY_CONNECTION_EXPOSURE",
  STALE_RISKY_CONNECTION: "SOLANA_STALE_RISKY_CONNECTION_EXPOSURE",
  SUSPICIOUS_PROGRAM: "SOLANA_SUSPICIOUS_PROGRAM_INTERACTION"
});
var SOLANA_CONNECTION_STALE_DAYS = 45;
var SOLANA_BROAD_PERMISSION_SCOPES = Object.freeze([
  "account_access_all",
  "program_access",
  "sign_all_transactions",
  "sign_and_send_transactions",
  "token_account_management"
]);
var SOLANA_WALLET_SCORE_COMPONENT_MAX = Object.freeze({
  delegateExposure: 25,
  authorityControl: 15,
  permissionBreadth: 20,
  connectionRisk: 20,
  programActivity: 20
});

// src/wallet/solana/ids.ts
function buildStableId2(prefix, payload) {
  return `${prefix}_${sha256Hex(serializeCanonicalJson(payload)).slice(0, 24)}`;
}

// src/wallet/solana/utils.ts
var RISK_LEVEL_ORDER2 = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};
var SEVERE_FLAGS = /* @__PURE__ */ new Set([
  "compromised",
  "drainer",
  "exploit",
  "malicious",
  "phishing"
]);
function uniqueSorted3(values) {
  return [...new Set(values)].sort();
}
function normalizeMetadata2(metadata) {
  if (!metadata) {
    return {};
  }
  const normalized = {};
  for (const key of Object.keys(metadata).sort()) {
    normalized[key] = metadata[key];
  }
  return normalized;
}
function normalizeStringList(values) {
  return uniqueSorted3(
    (values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)
  );
}
function compareRiskLevel3(left, right) {
  return RISK_LEVEL_ORDER2[left] - RISK_LEVEL_ORDER2[right];
}
function maxRiskLevel3(levels, fallback) {
  return levels.reduce(
    (current, candidate) => compareRiskLevel3(candidate, current) > 0 ? candidate : current,
    fallback
  );
}
function hasSevereFlag(flags) {
  return flags.some((flag) => SEVERE_FLAGS.has(flag));
}
function computeAgeDays2(subjectTimestamp, capturedAt) {
  if (subjectTimestamp === null) {
    return null;
  }
  const subjectMs = Date.parse(subjectTimestamp);
  const capturedMs = Date.parse(capturedAt);
  if (Number.isNaN(subjectMs) || Number.isNaN(capturedMs) || subjectMs > capturedMs) {
    return null;
  }
  return Math.floor((capturedMs - subjectMs) / 864e5);
}

// src/wallet/solana/cleanup.ts
var PHASE_4D_SUPPORT_DETAIL = "Phase 4D only provides deterministic Solana review guidance. Manual wallet or app action is required because this layer does not build transactions or disconnect apps automatically.";
function comparePriority(left, right) {
  return compareRiskLevel3(left, right);
}
function requiresSignatureForRecommendation(recommendationType) {
  switch (recommendationType) {
    case "disconnect_permission":
    case "remove_authority":
    case "remove_delegate":
    case "review_connection":
    case "review_program_access":
      return true;
  }
}
function buildActionBase(input) {
  return {
    actionId: input.actionId,
    walletChain: "solana",
    kind: input.kind,
    executionMode: "guided",
    executionType: "manual_review",
    status: "planned",
    requiresSignature: requiresSignatureForRecommendation(input.recommendationType),
    supportStatus: "partial",
    title: input.title,
    description: input.description,
    priority: input.priority,
    target: {
      targetId: buildStableId2("wallet_target", {
        actionId: input.actionId,
        label: input.label
      }),
      targetKind: "authorization",
      label: input.label,
      metadata: input.metadata
    },
    findingIds: input.findingIds,
    riskFactorIds: input.riskFactorIds,
    supportDetail: PHASE_4D_SUPPORT_DETAIL,
    metadata: input.metadata
  };
}
function collectRiskFactorIds(findings) {
  return uniqueSorted3(findings.flatMap((finding) => finding.riskFactorIds));
}
function matchFindings(findings, resourceId, codes) {
  return findings.filter(
    (finding) => codes.includes(finding.metadata.code ?? "") && finding.resourceIds.includes(resourceId)
  ).sort((left, right) => left.findingId.localeCompare(right.findingId));
}
function connectionPriority(connection) {
  if (connection.riskLevel === "critical" || hasSevereFlag(connection.flags)) {
    return "critical";
  }
  if (connection.isRisky || connection.isStaleRisky) {
    return "high";
  }
  return connection.isBroadPermission ? "medium" : "low";
}
function authorityPriority(assignment) {
  if (assignment.riskLevel === "critical" || hasSevereFlag(assignment.flags)) {
    return "critical";
  }
  return assignment.isRisky ? "high" : "medium";
}
function delegatePriority(tokenAccount) {
  if (tokenAccount.delegateRiskLevel === "critical" || hasSevereFlag(tokenAccount.delegateFlags)) {
    return "critical";
  }
  return tokenAccount.isRiskyDelegate ? "high" : "medium";
}
function buildSolanaCleanupPlan(walletAddress, networkId, evaluatedAt, snapshot, findings, _riskFactors) {
  if (findings.length === 0) {
    return {
      cleanupPlan: null,
      actionIdsByFindingId: {}
    };
  }
  const actions = [];
  const actionIdsByFindingId = /* @__PURE__ */ new Map();
  for (const tokenAccount of snapshot.tokenAccounts.filter(
    (entry) => entry.hasDelegate
  )) {
    const linkedFindings = matchFindings(findings, tokenAccount.resourceId, [
      SOLANA_WALLET_FINDING_CODES.DELEGATE_AUTHORITY
    ]);
    if (linkedFindings.length === 0) {
      continue;
    }
    const action = buildActionBase({
      actionId: buildStableId2("wallet_action", {
        recommendationType: "remove_delegate",
        resourceId: tokenAccount.resourceId
      }),
      findingIds: linkedFindings.map((finding) => finding.findingId),
      riskFactorIds: collectRiskFactorIds(linkedFindings),
      priority: delegatePriority(tokenAccount),
      kind: "revoke_authorization",
      recommendationType: "remove_delegate",
      title: "Remove token delegate",
      description: `Review token account ${tokenAccount.tokenAccountAddress} for mint ${tokenAccount.mintAddress} and remove delegate ${tokenAccount.delegateAddress ?? "unknown"}. Manual wallet action is required.`,
      label: `delegate:${tokenAccount.tokenAccountAddress}`,
      metadata: {
        delegateAddress: tokenAccount.delegateAddress ?? "",
        mintAddress: tokenAccount.mintAddress,
        recommendationType: "remove_delegate",
        tokenAccountAddress: tokenAccount.tokenAccountAddress
      }
    });
    actions.push(action);
  }
  for (const assignment of snapshot.authorityAssignments) {
    const linkedFindings = matchFindings(findings, assignment.resourceId, [
      SOLANA_WALLET_FINDING_CODES.AUTHORITY_ASSIGNMENT
    ]);
    if (linkedFindings.length === 0) {
      continue;
    }
    const action = buildActionBase({
      actionId: buildStableId2("wallet_action", {
        authorityType: assignment.authorityType,
        recommendationType: "remove_authority",
        resourceId: assignment.resourceId
      }),
      findingIds: linkedFindings.map((finding) => finding.findingId),
      riskFactorIds: collectRiskFactorIds(linkedFindings),
      priority: authorityPriority(assignment),
      kind: "revoke_authorization",
      recommendationType: "remove_authority",
      title: "Remove authority assignment",
      description: `Review ${assignment.authorityType} on ${assignment.subjectAddress} and remove authority ${assignment.authorityAddress} if it is no longer required. Manual wallet or protocol action is required.`,
      label: `authority:${assignment.subjectAddress}:${assignment.authorityType}`,
      metadata: {
        authorityAddress: assignment.authorityAddress,
        authorityType: assignment.authorityType,
        recommendationType: "remove_authority",
        subjectAddress: assignment.subjectAddress
      }
    });
    actions.push(action);
  }
  for (const connection of snapshot.connections) {
    const linkedFindings = matchFindings(findings, connection.resourceId, [
      SOLANA_WALLET_FINDING_CODES.BROAD_PERMISSION,
      SOLANA_WALLET_FINDING_CODES.RISKY_CONNECTION,
      SOLANA_WALLET_FINDING_CODES.STALE_RISKY_CONNECTION
    ]);
    if (linkedFindings.length === 0) {
      continue;
    }
    const recommendationType = connection.isBroadPermission ? "disconnect_permission" : "review_connection";
    const kind = connection.isBroadPermission ? "revoke_authorization" : "manual_review";
    const label = connection.appName ?? connection.origin ?? connection.connectionId ?? connection.resourceId;
    const description = connection.isBroadPermission ? `Review permissions for ${label} and disconnect the connection if the app no longer needs broad wallet access. Manual wallet or app action is required.` : `Review the connection for ${label} and disconnect it if it remains risky or no longer needed. Manual wallet or app action is required.`;
    const action = buildActionBase({
      actionId: buildStableId2("wallet_action", {
        recommendationType,
        resourceId: connection.resourceId
      }),
      findingIds: linkedFindings.map((finding) => finding.findingId),
      riskFactorIds: collectRiskFactorIds(linkedFindings),
      priority: connectionPriority(connection),
      kind,
      recommendationType,
      title: recommendationType === "disconnect_permission" ? "Disconnect wallet permission" : "Review risky wallet connection",
      description,
      label: `connection:${label}`,
      metadata: {
        appName: connection.appName ?? "",
        origin: connection.origin ?? "",
        recommendationType
      }
    });
    actions.push(action);
  }
  for (const programExposure of snapshot.programExposures) {
    const linkedFindings = matchFindings(findings, programExposure.resourceId, [
      SOLANA_WALLET_FINDING_CODES.SUSPICIOUS_PROGRAM
    ]);
    if (linkedFindings.length === 0) {
      continue;
    }
    const action = buildActionBase({
      actionId: buildStableId2("wallet_action", {
        recommendationType: "review_program_access",
        resourceId: programExposure.resourceId
      }),
      findingIds: linkedFindings.map((finding) => finding.findingId),
      riskFactorIds: collectRiskFactorIds(linkedFindings),
      priority: programExposure.riskLevel === "critical" || hasSevereFlag(programExposure.flags) ? "critical" : "high",
      kind: "manual_review",
      recommendationType: "review_program_access",
      title: "Review suspicious program access",
      description: `Review program ${programExposure.programAddress} and remove related permissions or account exposure if the access is unexpected. Manual wallet or protocol action is required.`,
      label: `program:${programExposure.programAddress}`,
      metadata: {
        programAddress: programExposure.programAddress,
        recommendationType: "review_program_access"
      }
    });
    actions.push(action);
  }
  if (actions.length === 0) {
    return {
      cleanupPlan: null,
      actionIdsByFindingId: {}
    };
  }
  const orderedActions = [...actions].sort(
    (left, right) => comparePriority(right.priority, left.priority) || left.title.localeCompare(right.title) || left.actionId.localeCompare(right.actionId)
  );
  for (const action of orderedActions) {
    for (const findingId of action.findingIds) {
      const existing = actionIdsByFindingId.get(findingId) ?? /* @__PURE__ */ new Set();
      existing.add(action.actionId);
      actionIdsByFindingId.set(findingId, existing);
    }
  }
  return {
    cleanupPlan: {
      planId: buildStableId2("wallet_plan", {
        actionIds: orderedActions.map((action) => action.actionId),
        networkId,
        walletAddress
      }),
      walletChain: "solana",
      walletAddress,
      networkId,
      createdAt: evaluatedAt,
      summary: `${orderedActions.length} Solana review recommendation${orderedActions.length === 1 ? "" : "s"} were generated. Manual wallet or app action is required because Phase 4D does not build Solana transactions or disconnect apps automatically.`,
      actions: orderedActions,
      projectedScore: null,
      projectedRiskLevel: null
    },
    actionIdsByFindingId: Object.fromEntries(
      [...actionIdsByFindingId.entries()].map(([findingId, actionIds]) => [
        findingId,
        [...actionIds].sort()
      ])
    )
  };
}

// src/wallet/solana/score.ts
function scoreBand2(totalScore) {
  if (totalScore >= 85) {
    return "low";
  }
  if (totalScore >= 60) {
    return "medium";
  }
  if (totalScore >= 35) {
    return "high";
  }
  return "critical";
}
function findItemsByCode2(items, code) {
  return items.filter((item) => item.metadata.code === code);
}
function buildComponent2(label, maxScore, score, rationale, findings, riskFactors) {
  return {
    componentId: buildStableId2("wallet_component", {
      label,
      maxScore,
      score
    }),
    label,
    score,
    maxScore,
    riskLevel: maxRiskLevel3(
      [
        ...findings.map((finding) => finding.riskLevel),
        ...riskFactors.map((riskFactor) => riskFactor.riskLevel)
      ],
      score === maxScore ? "low" : "medium"
    ),
    rationale,
    findingIds: findings.map((finding) => finding.findingId),
    riskFactorIds: riskFactors.map((riskFactor) => riskFactor.factorId)
  };
}
function buildSolanaWalletScoreBreakdown(signals, findings, riskFactors) {
  const delegateFindings = findItemsByCode2(
    findings,
    SOLANA_WALLET_FINDING_CODES.DELEGATE_AUTHORITY
  );
  const authorityFindings = findItemsByCode2(
    findings,
    SOLANA_WALLET_FINDING_CODES.AUTHORITY_ASSIGNMENT
  );
  const broadPermissionFindings = findItemsByCode2(
    findings,
    SOLANA_WALLET_FINDING_CODES.BROAD_PERMISSION
  );
  const riskyConnectionFindings = findItemsByCode2(
    findings,
    SOLANA_WALLET_FINDING_CODES.RISKY_CONNECTION
  );
  const staleConnectionFindings = findItemsByCode2(
    findings,
    SOLANA_WALLET_FINDING_CODES.STALE_RISKY_CONNECTION
  );
  const suspiciousProgramFindings = findItemsByCode2(
    findings,
    SOLANA_WALLET_FINDING_CODES.SUSPICIOUS_PROGRAM
  );
  const delegatePenalty = Math.min(
    signals.delegateCount * 6 + signals.riskyDelegateCount * 8,
    SOLANA_WALLET_SCORE_COMPONENT_MAX.delegateExposure
  );
  const authorityPenalty = Math.min(
    signals.authorityAssignmentCount * 4 + signals.riskyAuthorityAssignmentCount * 5,
    SOLANA_WALLET_SCORE_COMPONENT_MAX.authorityControl
  );
  const permissionPenalty = Math.min(
    signals.broadPermissionCount * 10,
    SOLANA_WALLET_SCORE_COMPONENT_MAX.permissionBreadth
  );
  const connectionPenalty = Math.min(
    signals.riskyConnectionCount * 10 + signals.staleRiskyConnectionCount * 4,
    SOLANA_WALLET_SCORE_COMPONENT_MAX.connectionRisk
  );
  const programPenalty = Math.min(
    signals.suspiciousProgramCount * 12,
    SOLANA_WALLET_SCORE_COMPONENT_MAX.programActivity
  );
  const components = [
    buildComponent2(
      "Delegate exposure",
      SOLANA_WALLET_SCORE_COMPONENT_MAX.delegateExposure,
      SOLANA_WALLET_SCORE_COMPONENT_MAX.delegateExposure - delegatePenalty,
      `${signals.delegateCount} delegated token account(s) and ${signals.riskyDelegateCount} risky delegate exposure(s) drive this component.`,
      delegateFindings,
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.DELEGATE_AUTHORITY
      )
    ),
    buildComponent2(
      "Authority control",
      SOLANA_WALLET_SCORE_COMPONENT_MAX.authorityControl,
      SOLANA_WALLET_SCORE_COMPONENT_MAX.authorityControl - authorityPenalty,
      `${signals.authorityAssignmentCount} authority assignment(s) and ${signals.riskyAuthorityAssignmentCount} risky authority assignment(s) drive this component.`,
      authorityFindings,
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.AUTHORITY_ASSIGNMENT
      )
    ),
    buildComponent2(
      "Permission breadth",
      SOLANA_WALLET_SCORE_COMPONENT_MAX.permissionBreadth,
      SOLANA_WALLET_SCORE_COMPONENT_MAX.permissionBreadth - permissionPenalty,
      `${signals.broadPermissionCount} broad Solana permission record(s) were supplied in the hydrated snapshot.`,
      broadPermissionFindings,
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.BROAD_PERMISSION
      )
    ),
    buildComponent2(
      "Connection risk",
      SOLANA_WALLET_SCORE_COMPONENT_MAX.connectionRisk,
      SOLANA_WALLET_SCORE_COMPONENT_MAX.connectionRisk - connectionPenalty,
      `${signals.riskyConnectionCount} risky connection(s) and ${signals.staleRiskyConnectionCount} stale risky connection(s) drive this component.`,
      [...riskyConnectionFindings, ...staleConnectionFindings],
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.RISKY_CONNECTION || riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.STALE_RISKY_CONNECTION
      )
    ),
    buildComponent2(
      "Program activity",
      SOLANA_WALLET_SCORE_COMPONENT_MAX.programActivity,
      SOLANA_WALLET_SCORE_COMPONENT_MAX.programActivity - programPenalty,
      `${signals.suspiciousProgramCount} suspicious program interaction summary record(s) were supplied in the hydrated snapshot.`,
      suspiciousProgramFindings,
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === SOLANA_WALLET_FINDING_CODES.SUSPICIOUS_PROGRAM
      )
    )
  ];
  const totalScore = components.reduce((sum, component) => sum + component.score, 0);
  const findingRiskLevel = maxRiskLevel3(
    findings.map((finding) => finding.riskLevel),
    "low"
  );
  const riskLevel = maxRiskLevel3([scoreBand2(totalScore), findingRiskLevel], "low");
  return {
    totalScore,
    riskLevel,
    rationale: findings.length === 0 ? "No deterministic Solana wallet findings were produced from the hydrated snapshot." : "Score starts at 100 and applies fixed deductions for delegate exposure, authority control, permission breadth, risky connections, and suspicious program activity.",
    components
  };
}

// src/wallet/scan-mode.ts
function enforceWalletScanMode(walletChain, requestedScanMode) {
  switch (walletChain) {
    case "solana":
    case "bitcoin":
      return "basic";
    case "evm":
      return requestedScanMode;
  }
}

// src/wallet/solana/assemble.ts
function buildCapabilityBoundaries2() {
  return [
    {
      boundaryId: buildStableId2("wallet_boundary", {
        area: "snapshot",
        capabilityKey: "hydrated_solana_snapshot"
      }),
      area: "snapshot",
      capabilityKey: "hydrated_solana_snapshot",
      status: "supported",
      detail: "Phase 4D evaluates only caller-supplied hydrated Solana snapshot data and performs no live lookups during normalization, scoring, or recommendation planning."
    },
    {
      boundaryId: buildStableId2("wallet_boundary", {
        area: "finding",
        capabilityKey: "deterministic_solana_findings"
      }),
      area: "finding",
      capabilityKey: "deterministic_solana_findings",
      status: "supported",
      detail: "Phase 4D emits deterministic Solana findings, factors, and score breakdowns from the supplied snapshot only."
    },
    {
      boundaryId: buildStableId2("wallet_boundary", {
        area: "cleanup_plan",
        capabilityKey: "deterministic_solana_cleanup_guidance"
      }),
      area: "cleanup_plan",
      capabilityKey: "deterministic_solana_cleanup_guidance",
      status: "supported",
      detail: "Phase 4D builds deterministic recommendation-only Solana cleanup guidance. It does not claim automatic revoke or disconnect support."
    },
    {
      boundaryId: buildStableId2("wallet_boundary", {
        area: "cleanup_execution",
        capabilityKey: "solana_cleanup_execution"
      }),
      area: "cleanup_execution",
      capabilityKey: "solana_cleanup_execution",
      status: "not_supported",
      detail: "Phase 4D does not construct Solana transactions, request signatures, or broadcast cleanup actions."
    }
  ];
}
function buildFindingId2(walletAddress, code, resourceIds) {
  return buildStableId2("wallet_finding", {
    code,
    resourceIds,
    walletAddress
  });
}
function buildRiskFactor(finding) {
  return {
    factorId: buildStableId2("wallet_factor", {
      code: finding.metadata.code ?? "",
      findingId: finding.findingId,
      resourceIds: finding.resourceIds
    }),
    walletChain: "solana",
    category: finding.category,
    riskLevel: finding.riskLevel,
    title: finding.title,
    summary: finding.summary,
    findingIds: [finding.findingId],
    resourceIds: finding.resourceIds,
    metadata: {
      code: finding.metadata.code ?? "",
      sourceFindingId: finding.findingId
    }
  };
}
function assembleSolanaWalletEvaluation(input) {
  const normalizedRequest = {
    ...input.request,
    walletAddress: input.normalizedSnapshot.walletAddress,
    scanMode: enforceWalletScanMode("solana", input.request.scanMode)
  };
  const normalizedSnapshotContract = {
    ...input.snapshot,
    walletAddress: input.normalizedSnapshot.walletAddress
  };
  const findingsWithoutActions = input.findingDrafts.map((draft) => ({
    findingId: buildFindingId2(
      input.normalizedSnapshot.walletAddress,
      draft.code,
      draft.resourceIds
    ),
    walletChain: "solana",
    category: draft.category,
    riskLevel: draft.riskLevel,
    status: "open",
    title: draft.title,
    summary: draft.summary,
    detectedAt: input.evaluatedAt,
    resourceIds: draft.resourceIds,
    riskFactorIds: [],
    cleanupActionIds: [],
    evidence: draft.evidence,
    metadata: draft.metadata
  }));
  const riskFactors = findingsWithoutActions.map(buildRiskFactor);
  const findingsWithFactors = findingsWithoutActions.map((finding, index) => ({
    ...finding,
    riskFactorIds: [riskFactors[index]?.factorId ?? ""].filter(Boolean)
  }));
  const scoreBreakdown = buildSolanaWalletScoreBreakdown(
    input.signals,
    findingsWithFactors,
    riskFactors
  );
  const { cleanupPlan, actionIdsByFindingId } = buildSolanaCleanupPlan(
    input.normalizedSnapshot.walletAddress,
    normalizedRequest.networkId,
    input.evaluatedAt,
    input.normalizedSnapshot,
    findingsWithFactors,
    riskFactors
  );
  const findings = findingsWithFactors.map((finding) => ({
    ...finding,
    cleanupActionIds: actionIdsByFindingId[finding.findingId] ?? []
  }));
  const capabilityBoundaries = buildCapabilityBoundaries2();
  const result = {
    requestId: normalizedRequest.requestId,
    snapshotId: normalizedSnapshotContract.snapshotId,
    walletChain: "solana",
    walletAddress: input.normalizedSnapshot.walletAddress,
    networkId: normalizedRequest.networkId,
    evaluatedAt: input.evaluatedAt,
    findings,
    riskFactors,
    scoreBreakdown,
    cleanupPlan,
    capabilityBoundaries
  };
  const summary = {
    walletChain: "solana",
    walletAddress: input.normalizedSnapshot.walletAddress,
    networkId: normalizedRequest.networkId,
    scanMode: normalizedRequest.scanMode,
    generatedAt: input.evaluatedAt,
    snapshotCapturedAt: normalizedSnapshotContract.capturedAt,
    score: scoreBreakdown.totalScore,
    riskLevel: scoreBreakdown.riskLevel,
    findingCount: findings.length,
    openFindingCount: findings.length,
    cleanupActionCount: cleanupPlan?.actions.length ?? 0,
    actionableFindingCount: findings.filter(
      (finding) => finding.cleanupActionIds.length > 0
    ).length
  };
  const report = {
    reportId: buildWalletReportId({
      reportVersion: input.reportVersion,
      generatedAt: input.evaluatedAt,
      request: normalizedRequest,
      snapshot: normalizedSnapshotContract,
      result,
      summary,
      cleanupExecution: null
    }),
    reportVersion: input.reportVersion,
    generatedAt: input.evaluatedAt,
    request: normalizedRequest,
    snapshot: normalizedSnapshotContract,
    result,
    summary,
    cleanupExecution: null
  };
  return {
    score: scoreBreakdown.totalScore,
    riskLevel: scoreBreakdown.riskLevel,
    normalizedSnapshot: input.normalizedSnapshot,
    signals: input.signals,
    result,
    summary,
    report
  };
}

// src/wallet/solana/normalize.ts
function parseIntegerString2(value) {
  if (value === null || value === void 0) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^[0-9]+$/.test(trimmed)) {
    return BigInt(trimmed).toString(10);
  }
  return trimmed;
}
function compareNullable2(left, right) {
  return (left ?? "").localeCompare(right ?? "");
}
function pickSourceSectionId2(explicitSectionId, candidates) {
  if (explicitSectionId) {
    return explicitSectionId;
  }
  return candidates[0] ?? null;
}
function findSectionIds2(input, keywords) {
  return input.snapshot.sections.filter((section) => {
    const haystacks = [
      section.sectionId,
      section.sectionType,
      section.label
    ].map((value) => value.toLowerCase());
    return keywords.some(
      (keyword) => haystacks.some((haystack) => haystack.includes(keyword))
    );
  }).map((section) => section.sectionId).sort();
}
function normalizePermissionLevel(input, permissions) {
  if (input.permissionLevel === "broad") {
    return "broad";
  }
  if (permissions.length >= 3 || permissions.some(
    (permission) => SOLANA_BROAD_PERMISSION_SCOPES.includes(
      permission
    )
  )) {
    return "broad";
  }
  return "limited";
}
function normalizeTokenAccount(input, walletAddress, defaultSectionIds) {
  const tokenAccountAddress = normalizeSolAddress(input.tokenAccountAddress);
  const mintAddress = normalizeSolAddress(input.mintAddress);
  const ownerAddress = input.ownerAddress === void 0 || input.ownerAddress === null ? null : normalizeSolAddress(input.ownerAddress);
  const delegateAddress = input.delegateAddress === void 0 || input.delegateAddress === null ? null : normalizeSolAddress(input.delegateAddress);
  const delegateFlags = normalizeStringList(input.delegateFlags);
  const delegateRiskLevel = delegateAddress === null ? null : input.delegateRiskLevel ?? (delegateFlags.length > 0 ? "high" : null);
  const sourceSectionId = pickSourceSectionId2(
    input.sourceSectionId,
    defaultSectionIds
  );
  return {
    resourceId: buildStableId2("wallet_sol_token_account", {
      delegateAddress,
      mintAddress,
      tokenAccountAddress,
      walletAddress
    }),
    tokenAccountAddress,
    mintAddress,
    ownerAddress,
    balanceLamports: parseIntegerString2(input.balanceLamports),
    delegateAddress,
    delegateAmount: parseIntegerString2(input.delegateAmount),
    delegateRiskLevel,
    delegateFlags,
    delegateLabel: input.delegateLabel ?? null,
    hasDelegate: delegateAddress !== null,
    isRiskyDelegate: delegateAddress !== null && delegateRiskLevel !== null && delegateRiskLevel !== "low",
    closeAuthorityAddress: input.closeAuthorityAddress === void 0 || input.closeAuthorityAddress === null ? null : normalizeSolAddress(input.closeAuthorityAddress),
    permanentDelegateAddress: input.permanentDelegateAddress === void 0 || input.permanentDelegateAddress === null ? null : normalizeSolAddress(input.permanentDelegateAddress),
    sourceSectionId,
    metadata: normalizeMetadata2(input.metadata)
  };
}
function normalizeAuthorityAssignment(input, defaultSectionIds) {
  const flags = normalizeStringList(input.flags);
  const riskLevel = input.riskLevel ?? (flags.length > 0 ? "high" : null);
  const sourceSectionId = pickSourceSectionId2(input.sourceSectionId, defaultSectionIds);
  return {
    resourceId: buildStableId2("wallet_sol_authority", {
      authorityAddress: normalizeSolAddress(input.authorityAddress),
      authorityType: input.authorityType,
      programAddress: input.programAddress === void 0 || input.programAddress === null ? null : normalizeSolAddress(input.programAddress),
      subjectAddress: normalizeSolAddress(input.subjectAddress)
    }),
    subjectAddress: normalizeSolAddress(input.subjectAddress),
    authorityAddress: normalizeSolAddress(input.authorityAddress),
    authorityType: input.authorityType,
    programAddress: input.programAddress === void 0 || input.programAddress === null ? null : normalizeSolAddress(input.programAddress),
    riskLevel,
    flags,
    label: input.label ?? null,
    isRisky: riskLevel !== null && riskLevel !== "low",
    sourceSectionId,
    metadata: normalizeMetadata2(input.metadata)
  };
}
function normalizeConnectionRecord(input, capturedAt, defaultSectionIds) {
  const connectionId = input.connectionId?.trim() || null;
  const appName = input.appName?.trim() || null;
  const origin = input.origin === void 0 || input.origin === null ? null : input.origin.trim().toLowerCase();
  const permissions = normalizeStringList(input.permissions);
  const permissionLevel = normalizePermissionLevel(input, permissions);
  const programAddresses = (input.programAddresses ?? []).map((address) => normalizeSolAddress(address)).sort();
  const flags = normalizeStringList(input.flags);
  const riskLevel = input.riskLevel ?? (flags.length > 0 ? "high" : null);
  const sourceSectionId = pickSourceSectionId2(input.sourceSectionId, defaultSectionIds);
  const connectedAt = input.connectedAt ?? null;
  const lastUsedAt = input.lastUsedAt ?? null;
  const connectedAgeDays = computeAgeDays2(connectedAt, capturedAt);
  const lastUsedAgeDays = computeAgeDays2(lastUsedAt, capturedAt);
  const activityAgeDays = lastUsedAgeDays ?? connectedAgeDays;
  const isRisky = riskLevel !== null && riskLevel !== "low";
  const isBroadPermission = permissionLevel === "broad";
  return {
    resourceId: buildStableId2("wallet_sol_connection", {
      appName,
      connectedAt,
      connectionId,
      flags,
      lastUsedAt,
      origin,
      permissionLevel,
      permissions,
      programAddresses,
      riskLevel
    }),
    connectionId,
    appName,
    origin,
    permissions,
    permissionLevel,
    programAddresses,
    riskLevel,
    flags,
    connectedAt,
    lastUsedAt,
    connectedAgeDays,
    lastUsedAgeDays,
    isBroadPermission,
    isRisky,
    isStaleRisky: isRisky && activityAgeDays !== null && activityAgeDays >= SOLANA_CONNECTION_STALE_DAYS,
    sourceSectionId,
    metadata: normalizeMetadata2(input.metadata)
  };
}
function normalizeProgramExposure(input, defaultSectionIds) {
  const flags = normalizeStringList(input.flags);
  const riskLevel = input.riskLevel ?? (flags.length > 0 ? "high" : null);
  const sourceSectionId = pickSourceSectionId2(input.sourceSectionId, defaultSectionIds);
  return {
    resourceId: buildStableId2("wallet_sol_program", {
      programAddress: normalizeSolAddress(input.programAddress),
      sourceSectionId
    }),
    programAddress: normalizeSolAddress(input.programAddress),
    label: input.label ?? null,
    riskLevel,
    flags,
    interactionCount: input.interactionCount ?? null,
    lastInteractedAt: input.lastInteractedAt ?? null,
    isSuspicious: riskLevel !== null && riskLevel !== "low",
    sourceSectionId,
    metadata: normalizeMetadata2(input.metadata)
  };
}
function assertNonEmptyString(value, label) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return trimmed;
}
function assertSolanaRequestSnapshotParity(input) {
  if (input.request.walletChain !== "solana" || input.snapshot.walletChain !== "solana") {
    throw new Error(
      "Phase 4D Solana evaluation requires solana request and snapshot contracts."
    );
  }
  const requestId = assertNonEmptyString(
    input.request.requestId,
    "Solana request.requestId"
  );
  const snapshotRequestId = assertNonEmptyString(
    input.snapshot.requestId,
    "Solana snapshot.requestId"
  );
  if (requestId !== snapshotRequestId) {
    throw new Error(
      "Solana wallet evaluation requires request and snapshot requestId values to match."
    );
  }
  const requestNetworkId = assertNonEmptyString(
    input.request.networkId,
    "Solana request.networkId"
  );
  const snapshotNetworkId = assertNonEmptyString(
    input.snapshot.networkId,
    "Solana snapshot.networkId"
  );
  if (requestNetworkId !== snapshotNetworkId) {
    throw new Error(
      "Solana wallet evaluation requires request and snapshot networkId values to match."
    );
  }
  const requestWallet = normalizeSolAddress(
    assertNonEmptyString(input.request.walletAddress, "Solana request.walletAddress")
  );
  if (!isValidSolAddress(requestWallet)) {
    throw new Error(
      "Solana wallet evaluation requires request.walletAddress to be a valid Solana address."
    );
  }
  const snapshotWallet = normalizeSolAddress(
    assertNonEmptyString(input.snapshot.walletAddress, "Solana snapshot.walletAddress")
  );
  if (!isValidSolAddress(snapshotWallet)) {
    throw new Error(
      "Solana wallet evaluation requires snapshot.walletAddress to be a valid Solana address."
    );
  }
  if (requestWallet !== snapshotWallet) {
    throw new Error(
      "Solana wallet evaluation requires request and snapshot walletAddress values to match."
    );
  }
  return {
    walletAddress: requestWallet,
    networkId: requestNetworkId
  };
}
function normalizeSolanaWalletSnapshot(input) {
  const { walletAddress, networkId } = assertSolanaRequestSnapshotParity(input);
  const tokenSectionIds = findSectionIds2(input, ["token", "account"]);
  const authoritySectionIds = findSectionIds2(input, ["authorit"]);
  const connectionSectionIds = findSectionIds2(input, ["connection", "permission", "app"]);
  const programSectionIds = findSectionIds2(input, ["program", "interaction"]);
  const tokenAccounts = input.hydratedSnapshot.tokenAccounts.map(
    (tokenAccount) => normalizeTokenAccount(tokenAccount, walletAddress, tokenSectionIds)
  ).sort(
    (left, right) => left.tokenAccountAddress.localeCompare(right.tokenAccountAddress) || left.mintAddress.localeCompare(right.mintAddress) || compareNullable2(left.delegateAddress, right.delegateAddress)
  );
  const authorityAssignments = (input.hydratedSnapshot.authorityAssignments ?? []).map((assignment) => normalizeAuthorityAssignment(assignment, authoritySectionIds)).sort(
    (left, right) => left.authorityType.localeCompare(right.authorityType) || left.subjectAddress.localeCompare(right.subjectAddress) || left.authorityAddress.localeCompare(right.authorityAddress)
  );
  const connections = (input.hydratedSnapshot.connections ?? []).map(
    (connection) => normalizeConnectionRecord(connection, input.snapshot.capturedAt, connectionSectionIds)
  ).sort(
    (left, right) => compareNullable2(left.appName, right.appName) || compareNullable2(left.origin, right.origin) || compareNullable2(left.connectionId, right.connectionId) || left.resourceId.localeCompare(right.resourceId)
  );
  const programExposures = (input.hydratedSnapshot.programExposures ?? []).map(
    (programExposure) => normalizeProgramExposure(programExposure, programSectionIds)
  ).sort(
    (left, right) => left.programAddress.localeCompare(right.programAddress) || left.resourceId.localeCompare(right.resourceId)
  );
  return {
    walletAddress,
    networkId,
    capturedAt: input.snapshot.capturedAt,
    tokenAccounts,
    authorityAssignments,
    connections,
    programExposures
  };
}

// src/wallet/solana/rules.ts
function buildEvidenceRefs2(sourceSectionIds, fallbackLabel) {
  const sectionIds = uniqueSorted3(sourceSectionIds.filter(Boolean));
  if (sectionIds.length > 0) {
    return sectionIds.map((sectionId) => ({
      evidenceId: buildStableId2("wallet_evidence", {
        fallbackLabel,
        sectionId
      }),
      sourceType: "snapshot_section",
      sourceId: sectionId,
      label: `Snapshot section: ${sectionId}`
    }));
  }
  return [
    {
      evidenceId: buildStableId2("wallet_evidence", {
        fallbackLabel
      }),
      sourceType: "derived",
      sourceId: fallbackLabel.toLowerCase().replace(/\s+/g, "_"),
      label: fallbackLabel
    }
  ];
}
function tokenAccountEvidence(tokenAccounts, fallbackLabel) {
  return buildEvidenceRefs2(
    tokenAccounts.map((tokenAccount) => tokenAccount.sourceSectionId ?? ""),
    fallbackLabel
  );
}
function authorityEvidence(assignments, fallbackLabel) {
  return buildEvidenceRefs2(
    assignments.map((assignment) => assignment.sourceSectionId ?? ""),
    fallbackLabel
  );
}
function connectionEvidence(connections, fallbackLabel) {
  return buildEvidenceRefs2(
    connections.map((connection) => connection.sourceSectionId ?? ""),
    fallbackLabel
  );
}
function programEvidence(programExposures, fallbackLabel) {
  return buildEvidenceRefs2(
    programExposures.map((programExposure) => programExposure.sourceSectionId ?? ""),
    fallbackLabel
  );
}
function buildSolanaWalletFindings(snapshot, signals) {
  const drafts = [];
  const delegatedAccounts = snapshot.tokenAccounts.filter(
    (tokenAccount) => tokenAccount.hasDelegate
  );
  const riskyDelegates = delegatedAccounts.filter(
    (tokenAccount) => tokenAccount.isRiskyDelegate
  );
  const broadConnections = snapshot.connections.filter(
    (connection) => connection.isBroadPermission
  );
  const riskyConnections = snapshot.connections.filter(
    (connection) => connection.isRisky
  );
  const staleRiskyConnections = riskyConnections.filter(
    (connection) => connection.isStaleRisky
  );
  const suspiciousPrograms = snapshot.programExposures.filter(
    (programExposure) => programExposure.isSuspicious
  );
  const authorityAssignments = snapshot.authorityAssignments;
  const riskyAuthorityAssignments = authorityAssignments.filter(
    (assignment) => assignment.isRisky
  );
  if (delegatedAccounts.length > 0) {
    const severe = riskyDelegates.some(
      (tokenAccount) => tokenAccount.delegateRiskLevel === "critical" || hasSevereFlag(tokenAccount.delegateFlags)
    );
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.DELEGATE_AUTHORITY,
      category: "authorization",
      riskLevel: severe ? "critical" : riskyDelegates.length > 0 ? "high" : "medium",
      title: "Delegate authority exposure",
      summary: `${delegatedAccounts.length} token account${delegatedAccounts.length === 1 ? "" : "s"} still grant delegate authority${riskyDelegates.length > 0 ? `, including ${riskyDelegates.length} marked risky` : ""}.`,
      resourceIds: uniqueSorted3(
        delegatedAccounts.map((tokenAccount) => tokenAccount.resourceId)
      ),
      evidence: tokenAccountEvidence(
        delegatedAccounts,
        "Solana delegate authority exposure"
      ),
      metadata: {
        code: SOLANA_WALLET_FINDING_CODES.DELEGATE_AUTHORITY,
        delegateCount: String(delegatedAccounts.length),
        riskyDelegateCount: String(riskyDelegates.length)
      }
    });
  }
  if (authorityAssignments.length > 0) {
    const severe = riskyAuthorityAssignments.some(
      (assignment) => assignment.riskLevel === "critical" || hasSevereFlag(assignment.flags)
    );
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.AUTHORITY_ASSIGNMENT,
      category: "authorization",
      riskLevel: severe ? "critical" : riskyAuthorityAssignments.length > 0 ? "high" : "medium",
      title: "Authority assignment exposure",
      summary: `${authorityAssignments.length} authority assignment${authorityAssignments.length === 1 ? "" : "s"} were supplied for manual review.`,
      resourceIds: uniqueSorted3(
        authorityAssignments.map((assignment) => assignment.resourceId)
      ),
      evidence: authorityEvidence(
        authorityAssignments,
        "Solana authority assignment exposure"
      ),
      metadata: {
        authorityAssignmentCount: String(authorityAssignments.length),
        code: SOLANA_WALLET_FINDING_CODES.AUTHORITY_ASSIGNMENT,
        riskyAuthorityAssignmentCount: String(riskyAuthorityAssignments.length)
      }
    });
  }
  if (broadConnections.length > 0) {
    const riskyBroadConnections = broadConnections.filter(
      (connection) => connection.isRisky
    );
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.BROAD_PERMISSION,
      category: "authorization",
      riskLevel: riskyBroadConnections.length > 0 || broadConnections.length > 1 ? "high" : "medium",
      title: "Broad wallet permission exposure",
      summary: `${broadConnections.length} connected app${broadConnections.length === 1 ? "" : "s"} retain broad Solana wallet permissions and should be reviewed.`,
      resourceIds: uniqueSorted3(
        broadConnections.map((connection) => connection.resourceId)
      ),
      evidence: connectionEvidence(
        broadConnections,
        "Solana broad permission exposure"
      ),
      metadata: {
        broadPermissionCount: String(signals.broadPermissionCount),
        code: SOLANA_WALLET_FINDING_CODES.BROAD_PERMISSION
      }
    });
  }
  if (riskyConnections.length > 0) {
    const severe = riskyConnections.some(
      (connection) => connection.riskLevel === "critical" || hasSevereFlag(connection.flags)
    );
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.RISKY_CONNECTION,
      category: "counterparty",
      riskLevel: severe ? "critical" : "high",
      title: "Risky connected app exposure",
      summary: `${riskyConnections.length} connected app${riskyConnections.length === 1 ? "" : "s"} were marked risky in the hydrated Solana snapshot.`,
      resourceIds: uniqueSorted3(
        riskyConnections.map((connection) => connection.resourceId)
      ),
      evidence: connectionEvidence(
        riskyConnections,
        "Solana risky connection exposure"
      ),
      metadata: {
        code: SOLANA_WALLET_FINDING_CODES.RISKY_CONNECTION,
        riskyConnectionCount: String(signals.riskyConnectionCount)
      }
    });
  }
  if (staleRiskyConnections.length > 0) {
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.STALE_RISKY_CONNECTION,
      category: "counterparty",
      riskLevel: staleRiskyConnections.length >= 3 ? "high" : "medium",
      title: "Stale risky connection remains linked",
      summary: `${staleRiskyConnections.length} risky connection${staleRiskyConnections.length === 1 ? "" : "s"} have been inactive for at least ${SOLANA_CONNECTION_STALE_DAYS} days.`,
      resourceIds: uniqueSorted3(
        staleRiskyConnections.map((connection) => connection.resourceId)
      ),
      evidence: connectionEvidence(
        staleRiskyConnections,
        "Solana stale risky connection exposure"
      ),
      metadata: {
        code: SOLANA_WALLET_FINDING_CODES.STALE_RISKY_CONNECTION,
        staleRiskyConnectionCount: String(signals.staleRiskyConnectionCount)
      }
    });
  }
  if (suspiciousPrograms.length > 0) {
    const severe = suspiciousPrograms.some(
      (programExposure) => programExposure.riskLevel === "critical" || hasSevereFlag(programExposure.flags)
    );
    drafts.push({
      code: SOLANA_WALLET_FINDING_CODES.SUSPICIOUS_PROGRAM,
      category: "activity",
      riskLevel: severe ? "critical" : "high",
      title: "Suspicious program interaction",
      summary: `${suspiciousPrograms.length} risky program interaction summary${suspiciousPrograms.length === 1 ? "" : "s"} were supplied for review.`,
      resourceIds: uniqueSorted3(
        suspiciousPrograms.map((programExposure) => programExposure.resourceId)
      ),
      evidence: programEvidence(
        suspiciousPrograms,
        "Solana suspicious program interaction"
      ),
      metadata: {
        code: SOLANA_WALLET_FINDING_CODES.SUSPICIOUS_PROGRAM,
        suspiciousProgramCount: String(signals.suspiciousProgramCount)
      }
    });
  }
  return drafts;
}

// src/wallet/solana/signals.ts
function buildSolanaWalletSignals(snapshot) {
  const delegatedAccounts = snapshot.tokenAccounts.filter(
    (tokenAccount) => tokenAccount.hasDelegate
  );
  const riskyDelegates = delegatedAccounts.filter(
    (tokenAccount) => tokenAccount.isRiskyDelegate
  );
  const riskyAuthorityAssignments = snapshot.authorityAssignments.filter(
    (assignment) => assignment.isRisky
  );
  const broadConnections = snapshot.connections.filter(
    (connection) => connection.isBroadPermission
  );
  const riskyConnections = snapshot.connections.filter(
    (connection) => connection.isRisky
  );
  const staleRiskyConnections = riskyConnections.filter(
    (connection) => connection.isStaleRisky
  );
  const suspiciousPrograms = snapshot.programExposures.filter(
    (programExposure) => programExposure.isSuspicious
  );
  return {
    tokenAccountCount: snapshot.tokenAccounts.length,
    delegateCount: delegatedAccounts.length,
    delegateIds: delegatedAccounts.map((tokenAccount) => tokenAccount.resourceId),
    riskyDelegateCount: riskyDelegates.length,
    riskyDelegateIds: riskyDelegates.map((tokenAccount) => tokenAccount.resourceId),
    authorityAssignmentCount: snapshot.authorityAssignments.length,
    riskyAuthorityAssignmentCount: riskyAuthorityAssignments.length,
    riskyAuthorityAssignmentIds: riskyAuthorityAssignments.map(
      (assignment) => assignment.resourceId
    ),
    broadPermissionCount: broadConnections.length,
    broadPermissionConnectionIds: broadConnections.map(
      (connection) => connection.resourceId
    ),
    riskyConnectionCount: riskyConnections.length,
    riskyConnectionIds: riskyConnections.map((connection) => connection.resourceId),
    staleRiskyConnectionCount: staleRiskyConnections.length,
    staleRiskyConnectionIds: staleRiskyConnections.map(
      (connection) => connection.resourceId
    ),
    suspiciousProgramCount: suspiciousPrograms.length,
    suspiciousProgramIds: suspiciousPrograms.map(
      (programExposure) => programExposure.resourceId
    )
  };
}

// src/wallet/solana/evaluate.ts
function evaluateSolanaWalletScan(input) {
  const normalizedSnapshot = normalizeSolanaWalletSnapshot(input);
  const signals = buildSolanaWalletSignals(normalizedSnapshot);
  const findingDrafts = buildSolanaWalletFindings(normalizedSnapshot, signals);
  return assembleSolanaWalletEvaluation({
    request: input.request,
    snapshot: input.snapshot,
    normalizedSnapshot,
    signals,
    findingDrafts,
    evaluatedAt: input.evaluatedAt,
    reportVersion: input.reportVersion ?? "1"
  });
}

// src/wallet/bitcoin/constants.ts
var BITCOIN_WALLET_FINDING_CODES = Object.freeze({
  ADDRESS_REUSE: "BITCOIN_ADDRESS_REUSE_EXPOSURE",
  PRIVACY_EXPOSURE: "BITCOIN_PRIVACY_EXPOSURE",
  FRAGMENTED_UTXO_STRUCTURE: "BITCOIN_FRAGMENTED_UTXO_STRUCTURE",
  CONCENTRATED_UTXO_STRUCTURE: "BITCOIN_CONCENTRATED_UTXO_STRUCTURE",
  POOR_WALLET_HYGIENE: "BITCOIN_POOR_WALLET_HYGIENE",
  REPEATED_EXPOSED_RECEIVE: "BITCOIN_REPEATED_EXPOSED_RECEIVE_BEHAVIOR"
});
var BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD = 3;
var BITCOIN_SMALL_UTXO_SATS = 100000n;
var BITCOIN_FRAGMENTATION_MEDIUM_UTXO_COUNT = 8;
var BITCOIN_FRAGMENTATION_HIGH_UTXO_COUNT = 16;
var BITCOIN_FRAGMENTATION_MEDIUM_SMALL_UTXO_COUNT = 5;
var BITCOIN_FRAGMENTATION_HIGH_SMALL_UTXO_COUNT = 10;
var BITCOIN_CONCENTRATION_MEDIUM_BPS = 7e3;
var BITCOIN_CONCENTRATION_HIGH_BPS = 8500;
var BITCOIN_WALLET_SCORE_COMPONENT_MAX = Object.freeze({
  addressReuse: 20,
  privacyExposure: 15,
  utxoFragmentation: 20,
  concentration: 15,
  operationalHygiene: 15,
  exposedReceiveBehavior: 15
});

// src/wallet/bitcoin/ids.ts
function buildStableId3(prefix, payload) {
  return `${prefix}_${sha256Hex(serializeCanonicalJson(payload)).slice(0, 24)}`;
}

// src/wallet/bitcoin/utils.ts
var RISK_LEVEL_ORDER3 = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};
function uniqueSorted4(values) {
  return [...new Set(values)].sort();
}
function normalizeMetadata3(metadata) {
  if (!metadata) {
    return {};
  }
  const normalized = {};
  for (const key of Object.keys(metadata).sort()) {
    normalized[key] = metadata[key];
  }
  return normalized;
}
function normalizeBitcoinAddress(address) {
  const trimmed = address.trim();
  return /^(bc1|tb1|bcrt1)/i.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}
function isValidBitcoinAddress(address) {
  const trimmed = address.trim();
  return /^(bc1|tb1|bcrt1)[a-z0-9]{11,87}$/i.test(trimmed) || /^[13mn2][1-9A-HJ-NP-Za-km-z]{25,62}$/.test(trimmed);
}
function compareRiskLevel4(left, right) {
  return RISK_LEVEL_ORDER3[left] - RISK_LEVEL_ORDER3[right];
}
function maxRiskLevel4(levels, fallback) {
  return levels.reduce(
    (current, candidate) => compareRiskLevel4(candidate, current) > 0 ? candidate : current,
    fallback
  );
}

// src/wallet/bitcoin/cleanup.ts
var PHASE_4E_SUPPORT_DETAIL = "Phase 4E only provides deterministic Bitcoin remediation guidance. Manual wallet action is required because this layer does not construct transactions, request signatures, or broadcast Bitcoin activity.";
function buildActionBase2(input) {
  return {
    actionId: input.actionId,
    walletChain: "bitcoin",
    kind: input.kind,
    executionMode: "manual",
    executionType: "manual_review",
    status: "planned",
    requiresSignature: false,
    supportStatus: "partial",
    title: input.title,
    description: input.description,
    priority: input.priority,
    target: {
      targetId: buildStableId3("wallet_target", {
        actionId: input.actionId,
        label: input.label
      }),
      targetKind: input.targetKind,
      label: input.label,
      metadata: {
        recommendationType: input.recommendationType
      }
    },
    findingIds: [input.finding.findingId],
    riskFactorIds: input.riskFactorIds,
    supportDetail: PHASE_4E_SUPPORT_DETAIL,
    metadata: {
      code: input.finding.metadata.code ?? "",
      recommendationType: input.recommendationType
    }
  };
}
function buildActionForFinding(finding, riskFactors) {
  const recommendationType = (() => {
    switch (finding.metadata.code) {
      case BITCOIN_WALLET_FINDING_CODES.ADDRESS_REUSE:
      case BITCOIN_WALLET_FINDING_CODES.PRIVACY_EXPOSURE:
      case BITCOIN_WALLET_FINDING_CODES.REPEATED_EXPOSED_RECEIVE:
        return "rotate_address";
      case BITCOIN_WALLET_FINDING_CODES.FRAGMENTED_UTXO_STRUCTURE:
        return "consolidate_utxos";
      case BITCOIN_WALLET_FINDING_CODES.CONCENTRATED_UTXO_STRUCTURE:
        return "move_funds";
      case BITCOIN_WALLET_FINDING_CODES.POOR_WALLET_HYGIENE:
        return "harden_wallet";
      default:
        return null;
    }
  })();
  if (recommendationType === null) {
    return null;
  }
  const riskFactorIds = riskFactors.filter((riskFactor) => riskFactor.findingIds.includes(finding.findingId)).map((riskFactor) => riskFactor.factorId).sort();
  switch (recommendationType) {
    case "rotate_address":
      return buildActionBase2({
        actionId: buildStableId3("wallet_action", {
          findingId: finding.findingId,
          recommendationType
        }),
        finding,
        riskFactorIds,
        kind: "rotate_wallet",
        priority: finding.riskLevel,
        recommendationType,
        targetKind: "wallet",
        label: "bitcoin_receive_addresses",
        title: "Rotate exposed receive addresses",
        description: "Generate fresh Bitcoin receive addresses for future deposits and manually move exposed funds if continued public visibility or reuse creates avoidable privacy risk."
      });
    case "consolidate_utxos":
      return buildActionBase2({
        actionId: buildStableId3("wallet_action", {
          findingId: finding.findingId,
          recommendationType
        }),
        finding,
        riskFactorIds,
        kind: "move_assets",
        priority: finding.riskLevel,
        recommendationType,
        targetKind: "asset",
        label: "bitcoin_utxo_set",
        title: "Consolidate fragmented UTXOs",
        description: "Manually consolidate excess small Bitcoin UTXOs when fee conditions and operational policy allow. This phase provides guidance only and does not prepare transactions."
      });
    case "move_funds":
      return buildActionBase2({
        actionId: buildStableId3("wallet_action", {
          findingId: finding.findingId,
          recommendationType
        }),
        finding,
        riskFactorIds,
        kind: "move_assets",
        priority: finding.riskLevel,
        recommendationType,
        targetKind: "asset",
        label: "bitcoin_balance_distribution",
        title: "Reduce concentrated balance structure",
        description: "Review whether a dominant Bitcoin UTXO should be split or moved to fresh receive addresses to reduce concentration and improve operational resilience."
      });
    case "harden_wallet":
      return buildActionBase2({
        actionId: buildStableId3("wallet_action", {
          findingId: finding.findingId,
          recommendationType
        }),
        finding,
        riskFactorIds,
        kind: "manual_review",
        priority: finding.riskLevel,
        recommendationType,
        targetKind: "wallet",
        label: "bitcoin_wallet_hygiene",
        title: "Harden wallet hygiene practices",
        description: "Review operational wallet practices, public address handling, and receive/change separation to reduce avoidable Bitcoin privacy and hygiene exposure."
      });
  }
}
function buildBitcoinCleanupPlan(walletAddress, networkId, evaluatedAt, findings, riskFactors) {
  const actions = findings.map((finding) => buildActionForFinding(finding, riskFactors)).filter((action) => action !== null).sort(
    (left, right) => compareRiskLevel4(right.priority, left.priority) || left.title.localeCompare(right.title) || left.actionId.localeCompare(right.actionId)
  );
  if (actions.length === 0) {
    return {
      cleanupPlan: null,
      actionIdsByFindingId: {}
    };
  }
  return {
    cleanupPlan: {
      planId: buildStableId3("wallet_plan", {
        actionIds: actions.map((action) => action.actionId),
        networkId,
        walletAddress
      }),
      walletChain: "bitcoin",
      walletAddress,
      networkId,
      createdAt: evaluatedAt,
      summary: `${actions.length} Bitcoin remediation recommendation${actions.length === 1 ? "" : "s"} were generated. Manual action is required because Phase 4E does not construct or broadcast Bitcoin transactions.`,
      actions,
      projectedScore: null,
      projectedRiskLevel: null
    },
    actionIdsByFindingId: Object.fromEntries(
      actions.map((action) => [action.findingIds[0] ?? "", [action.actionId]])
    )
  };
}

// src/wallet/bitcoin/score.ts
function scoreBand3(totalScore) {
  if (totalScore >= 85) {
    return "low";
  }
  if (totalScore >= 60) {
    return "medium";
  }
  if (totalScore >= 35) {
    return "high";
  }
  return "critical";
}
function findItemsByCode3(items, code) {
  return items.filter((item) => item.metadata.code === code);
}
function buildComponent3(label, maxScore, score, rationale, findings, riskFactors) {
  return {
    componentId: buildStableId3("wallet_component", {
      label,
      maxScore,
      score
    }),
    label,
    score,
    maxScore,
    riskLevel: maxRiskLevel4(
      [
        ...findings.map((finding) => finding.riskLevel),
        ...riskFactors.map((riskFactor) => riskFactor.riskLevel)
      ],
      score === maxScore ? "low" : "medium"
    ),
    rationale,
    findingIds: findings.map((finding) => finding.findingId),
    riskFactorIds: riskFactors.map((riskFactor) => riskFactor.factorId)
  };
}
function buildBitcoinWalletScoreBreakdown(signals, findings, riskFactors) {
  const addressReuseFindings = findItemsByCode3(
    findings,
    BITCOIN_WALLET_FINDING_CODES.ADDRESS_REUSE
  );
  const privacyFindings = findItemsByCode3(
    findings,
    BITCOIN_WALLET_FINDING_CODES.PRIVACY_EXPOSURE
  );
  const fragmentedUtxoFindings = findItemsByCode3(
    findings,
    BITCOIN_WALLET_FINDING_CODES.FRAGMENTED_UTXO_STRUCTURE
  );
  const concentratedUtxoFindings = findItemsByCode3(
    findings,
    BITCOIN_WALLET_FINDING_CODES.CONCENTRATED_UTXO_STRUCTURE
  );
  const hygieneFindings = findItemsByCode3(
    findings,
    BITCOIN_WALLET_FINDING_CODES.POOR_WALLET_HYGIENE
  );
  const exposedReceiveFindings = findItemsByCode3(
    findings,
    BITCOIN_WALLET_FINDING_CODES.REPEATED_EXPOSED_RECEIVE
  );
  const addressReusePenalty = Math.min(
    signals.reusedAddressCount * 8,
    BITCOIN_WALLET_SCORE_COMPONENT_MAX.addressReuse
  );
  const privacyPenalty = Math.min(
    signals.privacyExposureCount * 7,
    BITCOIN_WALLET_SCORE_COMPONENT_MAX.privacyExposure
  );
  const fragmentationPenalty = signals.fragmentationLevel === "high" ? BITCOIN_WALLET_SCORE_COMPONENT_MAX.utxoFragmentation : signals.fragmentationLevel === "medium" ? 10 : 0;
  const concentrationPenalty = signals.concentrationLevel === "high" ? BITCOIN_WALLET_SCORE_COMPONENT_MAX.concentration : signals.concentrationLevel === "medium" ? 7 : 0;
  const hygienePenalty = Math.min(
    signals.poorHygieneCount * 7,
    BITCOIN_WALLET_SCORE_COMPONENT_MAX.operationalHygiene
  );
  const exposedReceivePenalty = Math.min(
    signals.exposedReceivingPatternCount * 8,
    BITCOIN_WALLET_SCORE_COMPONENT_MAX.exposedReceiveBehavior
  );
  const components = [
    buildComponent3(
      "Address reuse",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.addressReuse,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.addressReuse - addressReusePenalty,
      `${signals.reusedAddressCount} reused Bitcoin address(es) drive this component.`,
      addressReuseFindings,
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === BITCOIN_WALLET_FINDING_CODES.ADDRESS_REUSE
      )
    ),
    buildComponent3(
      "Privacy exposure",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.privacyExposure,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.privacyExposure - privacyPenalty,
      `${signals.privacyExposureCount} privacy exposure indicator(s) were supplied or derived from the hydrated snapshot.`,
      privacyFindings,
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === BITCOIN_WALLET_FINDING_CODES.PRIVACY_EXPOSURE
      )
    ),
    buildComponent3(
      "UTXO fragmentation",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.utxoFragmentation,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.utxoFragmentation - fragmentationPenalty,
      `${signals.smallUtxoCount} small UTXO(s) across ${signals.totalUtxoCount} visible UTXO(s) drive this component.`,
      fragmentedUtxoFindings,
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === BITCOIN_WALLET_FINDING_CODES.FRAGMENTED_UTXO_STRUCTURE
      )
    ),
    buildComponent3(
      "UTXO concentration",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.concentration,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.concentration - concentrationPenalty,
      `The largest UTXO represents ${signals.largestUtxoShareBasisPoints / 100}% of the visible wallet balance.`,
      concentratedUtxoFindings,
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === BITCOIN_WALLET_FINDING_CODES.CONCENTRATED_UTXO_STRUCTURE
      )
    ),
    buildComponent3(
      "Operational hygiene",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.operationalHygiene,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.operationalHygiene - hygienePenalty,
      `${signals.poorHygieneCount} caller-supplied wallet hygiene record(s) drive this component.`,
      hygieneFindings,
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === BITCOIN_WALLET_FINDING_CODES.POOR_WALLET_HYGIENE
      )
    ),
    buildComponent3(
      "Exposed receive behavior",
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.exposedReceiveBehavior,
      BITCOIN_WALLET_SCORE_COMPONENT_MAX.exposedReceiveBehavior - exposedReceivePenalty,
      `${signals.exposedReceivingPatternCount} repeated exposed receive pattern(s) drive this component.`,
      exposedReceiveFindings,
      riskFactors.filter(
        (riskFactor) => riskFactor.metadata.code === BITCOIN_WALLET_FINDING_CODES.REPEATED_EXPOSED_RECEIVE
      )
    )
  ];
  const totalScore = components.reduce((sum, component) => sum + component.score, 0);
  const findingRiskLevel = maxRiskLevel4(
    findings.map((finding) => finding.riskLevel),
    "low"
  );
  const riskLevel = maxRiskLevel4([scoreBand3(totalScore), findingRiskLevel], "low");
  return {
    totalScore,
    riskLevel,
    rationale: findings.length === 0 ? "No deterministic Bitcoin wallet findings were produced from the hydrated snapshot." : "Score starts at 100 and applies fixed deductions for address reuse, privacy exposure, UTXO fragmentation, UTXO concentration, operational hygiene, and exposed receive behavior.",
    components
  };
}

// src/wallet/bitcoin/assemble.ts
function buildCapabilityBoundaries3() {
  return [
    {
      boundaryId: buildStableId3("wallet_boundary", {
        area: "snapshot",
        capabilityKey: "hydrated_bitcoin_snapshot"
      }),
      area: "snapshot",
      capabilityKey: "hydrated_bitcoin_snapshot",
      status: "supported",
      detail: "Phase 4E evaluates only caller-supplied hydrated Bitcoin snapshot data and performs no live lookups during normalization, scoring, or remediation planning."
    },
    {
      boundaryId: buildStableId3("wallet_boundary", {
        area: "finding",
        capabilityKey: "deterministic_bitcoin_findings"
      }),
      area: "finding",
      capabilityKey: "deterministic_bitcoin_findings",
      status: "supported",
      detail: "Phase 4E emits deterministic Bitcoin findings, risk factors, and score breakdowns from the supplied snapshot only."
    },
    {
      boundaryId: buildStableId3("wallet_boundary", {
        area: "cleanup_plan",
        capabilityKey: "deterministic_bitcoin_guidance"
      }),
      area: "cleanup_plan",
      capabilityKey: "deterministic_bitcoin_guidance",
      status: "supported",
      detail: "Phase 4E builds deterministic recommendation-only Bitcoin remediation guidance. It does not claim revoke support, one-click cleanup, or automatic fixes."
    },
    {
      boundaryId: buildStableId3("wallet_boundary", {
        area: "cleanup_execution",
        capabilityKey: "bitcoin_cleanup_execution"
      }),
      area: "cleanup_execution",
      capabilityKey: "bitcoin_cleanup_execution",
      status: "not_supported",
      detail: "Phase 4E does not construct Bitcoin transactions, request signatures, move funds, or broadcast remediation actions."
    }
  ];
}
function buildFindingId3(walletAddress, code, resourceIds) {
  return buildStableId3("wallet_finding", {
    code,
    resourceIds,
    walletAddress
  });
}
function buildRiskFactor2(finding) {
  return {
    factorId: buildStableId3("wallet_factor", {
      code: finding.metadata.code ?? "",
      findingId: finding.findingId,
      resourceIds: finding.resourceIds
    }),
    walletChain: "bitcoin",
    category: finding.category,
    riskLevel: finding.riskLevel,
    title: finding.title,
    summary: finding.summary,
    findingIds: [finding.findingId],
    resourceIds: finding.resourceIds,
    metadata: {
      code: finding.metadata.code ?? "",
      sourceFindingId: finding.findingId
    }
  };
}
function assembleBitcoinWalletEvaluation(input) {
  const normalizedRequest = {
    ...input.request,
    walletChain: "bitcoin",
    walletAddress: input.normalizedSnapshot.walletAddress,
    scanMode: enforceWalletScanMode("bitcoin", input.request.scanMode)
  };
  const normalizedSnapshotContract = {
    ...input.snapshot,
    walletChain: "bitcoin",
    walletAddress: input.normalizedSnapshot.walletAddress
  };
  const findingsWithoutActions = input.findingDrafts.map((draft) => ({
    findingId: buildFindingId3(
      input.normalizedSnapshot.walletAddress,
      draft.code,
      draft.resourceIds
    ),
    walletChain: "bitcoin",
    category: draft.category,
    riskLevel: draft.riskLevel,
    status: "open",
    title: draft.title,
    summary: draft.summary,
    detectedAt: input.evaluatedAt,
    resourceIds: draft.resourceIds,
    riskFactorIds: [],
    cleanupActionIds: [],
    evidence: draft.evidence,
    metadata: draft.metadata
  }));
  const riskFactors = findingsWithoutActions.map(buildRiskFactor2);
  const findingsWithFactors = findingsWithoutActions.map((finding, index) => ({
    ...finding,
    riskFactorIds: [riskFactors[index]?.factorId ?? ""].filter(Boolean)
  }));
  const scoreBreakdown = buildBitcoinWalletScoreBreakdown(
    input.signals,
    findingsWithFactors,
    riskFactors
  );
  const { cleanupPlan, actionIdsByFindingId } = buildBitcoinCleanupPlan(
    input.normalizedSnapshot.walletAddress,
    normalizedRequest.networkId,
    input.evaluatedAt,
    findingsWithFactors,
    riskFactors
  );
  const findings = findingsWithFactors.map((finding) => ({
    ...finding,
    cleanupActionIds: actionIdsByFindingId[finding.findingId] ?? []
  }));
  const capabilityBoundaries = buildCapabilityBoundaries3();
  const result = {
    requestId: normalizedRequest.requestId,
    snapshotId: normalizedSnapshotContract.snapshotId,
    walletChain: "bitcoin",
    walletAddress: input.normalizedSnapshot.walletAddress,
    networkId: normalizedRequest.networkId,
    evaluatedAt: input.evaluatedAt,
    findings,
    riskFactors,
    scoreBreakdown,
    cleanupPlan,
    capabilityBoundaries
  };
  const summary = {
    walletChain: "bitcoin",
    walletAddress: input.normalizedSnapshot.walletAddress,
    networkId: normalizedRequest.networkId,
    scanMode: normalizedRequest.scanMode,
    generatedAt: input.evaluatedAt,
    snapshotCapturedAt: normalizedSnapshotContract.capturedAt,
    score: scoreBreakdown.totalScore,
    riskLevel: scoreBreakdown.riskLevel,
    findingCount: findings.length,
    openFindingCount: findings.length,
    cleanupActionCount: cleanupPlan?.actions.length ?? 0,
    actionableFindingCount: findings.filter(
      (finding) => finding.cleanupActionIds.length > 0
    ).length
  };
  const report = {
    reportId: buildWalletReportId({
      reportVersion: input.reportVersion,
      generatedAt: input.evaluatedAt,
      request: normalizedRequest,
      snapshot: normalizedSnapshotContract,
      result,
      summary,
      cleanupExecution: null
    }),
    reportVersion: input.reportVersion,
    generatedAt: input.evaluatedAt,
    request: normalizedRequest,
    snapshot: normalizedSnapshotContract,
    result,
    summary,
    cleanupExecution: null
  };
  return {
    score: scoreBreakdown.totalScore,
    riskLevel: scoreBreakdown.riskLevel,
    normalizedSnapshot: input.normalizedSnapshot,
    signals: input.signals,
    result,
    summary,
    report
  };
}

// src/wallet/bitcoin/normalize.ts
function parseIntegerString3(value) {
  if (value === null || value === void 0) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !/^[0-9]+$/.test(trimmed)) {
    return null;
  }
  return BigInt(trimmed).toString(10);
}
function parseNonNegativeInteger(value, fallback) {
  if (value === null || value === void 0 || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}
function pickSourceSectionId3(explicitSectionId, candidates) {
  if (explicitSectionId) {
    return explicitSectionId;
  }
  return candidates[0] ?? null;
}
function findSectionIds3(input, keywords) {
  const foreignChainMarkers = /* @__PURE__ */ new Set(["evm", "solana"]);
  const bitcoinMarkers = /* @__PURE__ */ new Set(["bitcoin", "btc"]);
  return input.snapshot.sections.filter((section) => {
    const haystacks = [
      section.sectionId,
      section.sectionType,
      section.label
    ].map((value) => value.toLowerCase());
    const tokenLists = haystacks.map(
      (haystack) => haystack.split(/[^a-z0-9]+/).filter(Boolean)
    );
    const hasForeignChainMarker = tokenLists.some(
      (tokens) => tokens.some((token) => foreignChainMarkers.has(token))
    );
    if (hasForeignChainMarker) {
      return false;
    }
    const isBitcoinNativeSection = tokenLists.some(
      (tokens) => tokens[0] !== void 0 && bitcoinMarkers.has(tokens[0])
    );
    if (!isBitcoinNativeSection) {
      return false;
    }
    return keywords.some(
      (keyword) => tokenLists.some(
        (tokens) => tokens.some((token) => token === keyword || token.startsWith(keyword))
      )
    );
  }).map((section) => section.sectionId).sort();
}
function normalizeRole(role) {
  return role ?? "unknown";
}
function normalizeAddressType(addressType) {
  return addressType ?? "other";
}
function normalizeAddressSummary(input, walletAddress, defaultSectionIds) {
  const address = normalizeBitcoinAddress(input.address);
  const receiveCount = parseNonNegativeInteger(input.receiveCount, 0);
  const reuseCount = parseNonNegativeInteger(input.reuseCount, 0);
  const sourceSectionId = pickSourceSectionId3(
    input.sourceSectionId,
    defaultSectionIds
  );
  return {
    resourceId: buildStableId3("wallet_btc_address", {
      address,
      role: normalizeRole(input.role),
      walletAddress
    }),
    address,
    addressType: normalizeAddressType(input.addressType),
    role: normalizeRole(input.role),
    receivedSats: parseIntegerString3(input.receivedSats),
    spentSats: parseIntegerString3(input.spentSats),
    balanceSats: parseIntegerString3(input.balanceSats),
    receiveCount,
    spendCount: parseNonNegativeInteger(input.spendCount, 0),
    reuseCount,
    exposedPublicly: input.exposedPublicly === true,
    hasReuse: reuseCount > 0 || input.exposedPublicly === true && receiveCount >= BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD || receiveCount > 1,
    lastReceivedAt: input.lastReceivedAt ?? null,
    lastSpentAt: input.lastSpentAt ?? null,
    sourceSectionId,
    metadata: normalizeMetadata3(input.metadata)
  };
}
function normalizeUtxoSummary(input, defaultSectionIds) {
  const txid = input.txid.trim().toLowerCase();
  const sourceSectionId = pickSourceSectionId3(
    input.sourceSectionId,
    defaultSectionIds
  );
  return {
    resourceId: buildStableId3("wallet_btc_utxo", {
      address: normalizeBitcoinAddress(input.address),
      txid,
      vout: parseNonNegativeInteger(input.vout, 0)
    }),
    txid,
    vout: parseNonNegativeInteger(input.vout, 0),
    address: normalizeBitcoinAddress(input.address),
    valueSats: parseIntegerString3(input.valueSats) ?? "0",
    confirmations: input.confirmations === null || input.confirmations === void 0 ? null : parseNonNegativeInteger(input.confirmations, 0),
    sourceSectionId,
    metadata: normalizeMetadata3(input.metadata)
  };
}
function normalizeHygieneRecord(input, defaultSectionIds) {
  const sourceSectionId = pickSourceSectionId3(
    input.sourceSectionId,
    defaultSectionIds
  );
  return {
    resourceId: buildStableId3("wallet_btc_hygiene", {
      address: input.address === void 0 || input.address === null ? null : normalizeBitcoinAddress(input.address),
      count: parseNonNegativeInteger(input.count, 1),
      issueType: input.issueType,
      note: input.note ?? null,
      riskLevel: input.riskLevel ?? "medium"
    }),
    issueType: input.issueType,
    address: input.address === void 0 || input.address === null ? null : normalizeBitcoinAddress(input.address),
    count: parseNonNegativeInteger(input.count, 1),
    riskLevel: input.riskLevel ?? "medium",
    note: input.note ?? null,
    sourceSectionId,
    metadata: normalizeMetadata3(input.metadata)
  };
}
function assertNonEmptyString2(value, label) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return trimmed;
}
function assertBitcoinRequestSnapshotParity(input) {
  if (input.request.walletChain !== "bitcoin") {
    throw new Error(
      `Bitcoin wallet evaluation requires request.walletChain to be "bitcoin"; received "${input.request.walletChain}".`
    );
  }
  if (input.snapshot.walletChain !== "bitcoin") {
    throw new Error(
      `Bitcoin wallet evaluation requires snapshot.walletChain to be "bitcoin"; received "${input.snapshot.walletChain}".`
    );
  }
  const requestId = assertNonEmptyString2(
    input.request.requestId,
    "Bitcoin request.requestId"
  );
  const snapshotRequestId = assertNonEmptyString2(
    input.snapshot.requestId,
    "Bitcoin snapshot.requestId"
  );
  if (requestId !== snapshotRequestId) {
    throw new Error(
      "Bitcoin wallet evaluation requires request and snapshot requestId values to match."
    );
  }
  const requestNetworkId = assertNonEmptyString2(
    input.request.networkId,
    "Bitcoin request.networkId"
  );
  const snapshotNetworkId = assertNonEmptyString2(
    input.snapshot.networkId,
    "Bitcoin snapshot.networkId"
  );
  if (requestNetworkId !== snapshotNetworkId) {
    throw new Error(
      "Bitcoin wallet evaluation requires request and snapshot networkId values to match."
    );
  }
  const requestWallet = normalizeBitcoinAddress(
    assertNonEmptyString2(input.request.walletAddress, "Bitcoin request.walletAddress")
  );
  if (!isValidBitcoinAddress(requestWallet)) {
    throw new Error(
      "Bitcoin wallet evaluation requires request.walletAddress to be a valid Bitcoin address."
    );
  }
  const snapshotWallet = normalizeBitcoinAddress(
    assertNonEmptyString2(input.snapshot.walletAddress, "Bitcoin snapshot.walletAddress")
  );
  if (!isValidBitcoinAddress(snapshotWallet)) {
    throw new Error(
      "Bitcoin wallet evaluation requires snapshot.walletAddress to be a valid Bitcoin address."
    );
  }
  if (requestWallet !== snapshotWallet) {
    throw new Error(
      "Bitcoin wallet evaluation requires request and snapshot walletAddress values to match."
    );
  }
  return {
    walletAddress: requestWallet,
    networkId: requestNetworkId
  };
}
function normalizeBitcoinWalletSnapshot(input) {
  const { walletAddress, networkId } = assertBitcoinRequestSnapshotParity(input);
  const addressSectionIds = findSectionIds3(input, ["address"]);
  const utxoSectionIds = findSectionIds3(input, ["utxo"]);
  const hygieneSectionIds = findSectionIds3(input, ["hygiene", "privacy"]);
  return {
    walletAddress,
    networkId,
    capturedAt: input.snapshot.capturedAt,
    addresses: [...input.hydratedSnapshot.addresses].map(
      (address) => normalizeAddressSummary(address, walletAddress, addressSectionIds)
    ).sort(
      (left, right) => left.address.localeCompare(right.address) || left.role.localeCompare(right.role) || left.resourceId.localeCompare(right.resourceId)
    ),
    utxos: [...input.hydratedSnapshot.utxos].map((utxo) => normalizeUtxoSummary(utxo, utxoSectionIds)).sort(
      (left, right) => left.address.localeCompare(right.address) || left.txid.localeCompare(right.txid) || left.vout - right.vout || left.resourceId.localeCompare(right.resourceId)
    ),
    hygieneRecords: [...input.hydratedSnapshot.hygieneRecords ?? []].map((record) => normalizeHygieneRecord(record, hygieneSectionIds)).sort(
      (left, right) => left.issueType.localeCompare(right.issueType) || (left.address ?? "").localeCompare(right.address ?? "") || left.resourceId.localeCompare(right.resourceId)
    )
  };
}

// src/wallet/bitcoin/rules.ts
function buildEvidenceRefs3(sourceSectionIds, fallbackLabel) {
  const sectionIds = uniqueSorted4(sourceSectionIds.filter(Boolean));
  if (sectionIds.length > 0) {
    return sectionIds.map((sectionId) => ({
      evidenceId: buildStableId3("wallet_evidence", {
        fallbackLabel,
        sectionId
      }),
      sourceType: "snapshot_section",
      sourceId: sectionId,
      label: `Snapshot section: ${sectionId}`
    }));
  }
  return [
    {
      evidenceId: buildStableId3("wallet_evidence", {
        fallbackLabel
      }),
      sourceType: "derived",
      sourceId: fallbackLabel.toLowerCase().replace(/\s+/g, "_"),
      label: fallbackLabel
    }
  ];
}
function addressEvidence(addresses, fallbackLabel) {
  return buildEvidenceRefs3(
    addresses.map((address) => address.sourceSectionId ?? ""),
    fallbackLabel
  );
}
function utxoEvidence(utxos, fallbackLabel) {
  return buildEvidenceRefs3(
    utxos.map((utxo) => utxo.sourceSectionId ?? ""),
    fallbackLabel
  );
}
function hygieneEvidence(records, fallbackLabel) {
  return buildEvidenceRefs3(
    records.map((record) => record.sourceSectionId ?? ""),
    fallbackLabel
  );
}
function buildBitcoinWalletFindings(snapshot, signals) {
  const drafts = [];
  const reusedAddresses = snapshot.addresses.filter((address) => address.hasReuse);
  const publiclyExposedAddresses = snapshot.addresses.filter(
    (address) => address.exposedPublicly
  );
  const poorHygieneRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "poor_hygiene"
  );
  const privacyRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "privacy_exposure"
  );
  const repeatedReceiveRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "repeated_exposed_receive"
  );
  const repeatedExposedAddresses = publiclyExposedAddresses.filter(
    (address) => address.receiveCount >= BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD
  );
  const fragmentedUtxos = snapshot.utxos.filter(
    (utxo) => signals.fragmentedUtxoIds.includes(utxo.resourceId)
  );
  const largestUtxo = snapshot.utxos.find(
    (utxo) => utxo.resourceId === signals.largestUtxoId
  );
  if (reusedAddresses.length > 0) {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.ADDRESS_REUSE,
      category: "operational",
      riskLevel: reusedAddresses.length >= 3 || reusedAddresses.some((address) => address.exposedPublicly) ? "high" : "medium",
      title: "Address reuse exposure",
      summary: `${reusedAddresses.length} Bitcoin address${reusedAddresses.length === 1 ? "" : "es"} show repeated receiving behavior and should be rotated out of active use.`,
      resourceIds: uniqueSorted4(
        reusedAddresses.map((address) => address.resourceId)
      ),
      evidence: addressEvidence(reusedAddresses, "Bitcoin address reuse exposure"),
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.ADDRESS_REUSE,
        reusedAddressCount: String(signals.reusedAddressCount)
      }
    });
  }
  if (signals.privacyExposureCount > 0) {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.PRIVACY_EXPOSURE,
      category: "operational",
      riskLevel: maxRiskLevel4(
        [
          signals.exposedReceivingPatternCount > 0 ? "high" : "medium",
          ...privacyRecords.map((record) => record.riskLevel)
        ],
        "medium"
      ),
      title: "Privacy exposure",
      summary: `${signals.privacyExposureCount} Bitcoin privacy exposure indicator${signals.privacyExposureCount === 1 ? "" : "s"} were detected from public address visibility or caller-supplied hygiene records.`,
      resourceIds: uniqueSorted4([
        ...publiclyExposedAddresses.map((address) => address.resourceId),
        ...privacyRecords.map((record) => record.resourceId)
      ]),
      evidence: [
        ...addressEvidence(publiclyExposedAddresses, "Bitcoin privacy exposure"),
        ...hygieneEvidence(privacyRecords, "Bitcoin privacy exposure record")
      ],
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.PRIVACY_EXPOSURE,
        privacyExposureCount: String(signals.privacyExposureCount)
      }
    });
  }
  if (signals.fragmentationLevel !== "low") {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.FRAGMENTED_UTXO_STRUCTURE,
      category: "asset",
      riskLevel: signals.fragmentationLevel === "high" ? "high" : "medium",
      title: "Fragmented UTXO structure",
      summary: `${signals.smallUtxoCount} small UTXO${signals.smallUtxoCount === 1 ? "" : "s"} and ${signals.totalUtxoCount} total UTXO${signals.totalUtxoCount === 1 ? "" : "s"} indicate ${signals.fragmentationLevel} fragmentation.`,
      resourceIds: signals.fragmentedUtxoIds,
      evidence: utxoEvidence(fragmentedUtxos, "Bitcoin fragmented UTXO structure"),
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.FRAGMENTED_UTXO_STRUCTURE,
        fragmentationLevel: signals.fragmentationLevel,
        smallUtxoCount: String(signals.smallUtxoCount),
        totalUtxoCount: String(signals.totalUtxoCount)
      }
    });
  }
  if (signals.concentrationLevel !== "low" && largestUtxo !== void 0) {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.CONCENTRATED_UTXO_STRUCTURE,
      category: "asset",
      riskLevel: signals.concentrationLevel === "high" ? "high" : "medium",
      title: "Concentrated UTXO structure",
      summary: `The largest UTXO holds ${signals.largestUtxoShareBasisPoints / 100}% of the visible wallet balance, indicating ${signals.concentrationLevel} concentration.`,
      resourceIds: [largestUtxo.resourceId],
      evidence: utxoEvidence(
        [largestUtxo],
        "Bitcoin concentrated UTXO structure"
      ),
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.CONCENTRATED_UTXO_STRUCTURE,
        concentrationLevel: signals.concentrationLevel,
        largestUtxoShareBasisPoints: String(signals.largestUtxoShareBasisPoints)
      }
    });
  }
  if (poorHygieneRecords.length > 0) {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.POOR_WALLET_HYGIENE,
      category: "operational",
      riskLevel: maxRiskLevel4(
        poorHygieneRecords.map((record) => record.riskLevel),
        "medium"
      ),
      title: "Poor wallet hygiene",
      summary: `${poorHygieneRecords.length} caller-supplied wallet hygiene issue${poorHygieneRecords.length === 1 ? "" : "s"} require manual operational review.`,
      resourceIds: poorHygieneRecords.map((record) => record.resourceId),
      evidence: hygieneEvidence(
        poorHygieneRecords,
        "Bitcoin poor wallet hygiene"
      ),
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.POOR_WALLET_HYGIENE,
        poorHygieneCount: String(signals.poorHygieneCount)
      }
    });
  }
  if (signals.exposedReceivingPatternCount > 0) {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.REPEATED_EXPOSED_RECEIVE,
      category: "activity",
      riskLevel: maxRiskLevel4(
        [
          repeatedExposedAddresses.length > 0 ? "high" : "medium",
          ...repeatedReceiveRecords.map((record) => record.riskLevel)
        ],
        "medium"
      ),
      title: "Repeated exposed receive behavior",
      summary: `${signals.exposedReceivingPatternCount} exposed receiving pattern${signals.exposedReceivingPatternCount === 1 ? "" : "s"} show repeat deposits landing on public Bitcoin receive addresses.`,
      resourceIds: uniqueSorted4([
        ...repeatedExposedAddresses.map((address) => address.resourceId),
        ...repeatedReceiveRecords.map((record) => record.resourceId)
      ]),
      evidence: [
        ...addressEvidence(
          repeatedExposedAddresses,
          "Bitcoin repeated exposed receive behavior"
        ),
        ...hygieneEvidence(
          repeatedReceiveRecords,
          "Bitcoin repeated exposed receive record"
        )
      ],
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.REPEATED_EXPOSED_RECEIVE,
        exposedReceivingPatternCount: String(
          signals.exposedReceivingPatternCount
        )
      }
    });
  }
  return drafts;
}

// src/wallet/bitcoin/signals.ts
function classifyFragmentation(totalUtxoCount, smallUtxoCount) {
  if (totalUtxoCount >= BITCOIN_FRAGMENTATION_HIGH_UTXO_COUNT || smallUtxoCount >= BITCOIN_FRAGMENTATION_HIGH_SMALL_UTXO_COUNT) {
    return "high";
  }
  if (totalUtxoCount >= BITCOIN_FRAGMENTATION_MEDIUM_UTXO_COUNT || smallUtxoCount >= BITCOIN_FRAGMENTATION_MEDIUM_SMALL_UTXO_COUNT) {
    return "medium";
  }
  return "low";
}
function classifyConcentration(largestShareBasisPoints, totalUtxoCount) {
  if (totalUtxoCount < 2) {
    return "low";
  }
  if (largestShareBasisPoints >= BITCOIN_CONCENTRATION_HIGH_BPS) {
    return "high";
  }
  if (largestShareBasisPoints >= BITCOIN_CONCENTRATION_MEDIUM_BPS) {
    return "medium";
  }
  return "low";
}
function buildBitcoinWalletSignals(snapshot) {
  const reusedAddresses = snapshot.addresses.filter((address) => address.hasReuse);
  const publiclyExposedAddresses = snapshot.addresses.filter(
    (address) => address.exposedPublicly
  );
  const explicitPrivacyRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "privacy_exposure"
  );
  const explicitPoorHygieneRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "poor_hygiene"
  );
  const explicitExposedReceiveRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "repeated_exposed_receive"
  );
  const repeatedExposedAddresses = snapshot.addresses.filter(
    (address) => address.exposedPublicly && address.receiveCount >= BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD
  );
  const smallUtxos = snapshot.utxos.filter(
    (utxo) => BigInt(utxo.valueSats) <= BITCOIN_SMALL_UTXO_SATS
  );
  const totalValue = snapshot.utxos.reduce(
    (sum, utxo) => sum + BigInt(utxo.valueSats),
    0n
  );
  const largestUtxo = [...snapshot.utxos].sort(
    (left, right) => Number(BigInt(right.valueSats) - BigInt(left.valueSats)) || left.resourceId.localeCompare(right.resourceId)
  )[0];
  const largestShareBasisPoints = largestUtxo === void 0 || totalValue === 0n ? 0 : Number(BigInt(largestUtxo.valueSats) * 10000n / totalValue);
  const fragmentationLevel = classifyFragmentation(
    snapshot.utxos.length,
    smallUtxos.length
  );
  const concentrationLevel = classifyConcentration(
    largestShareBasisPoints,
    snapshot.utxos.length
  );
  return {
    addressCount: snapshot.addresses.length,
    reusedAddressCount: reusedAddresses.length,
    reusedAddressIds: reusedAddresses.map((address) => address.resourceId),
    publiclyExposedAddressCount: publiclyExposedAddresses.length,
    publiclyExposedAddressIds: publiclyExposedAddresses.map(
      (address) => address.resourceId
    ),
    privacyExposureCount: uniqueSorted4([
      ...publiclyExposedAddresses.map((address) => address.resourceId),
      ...explicitPrivacyRecords.map((record) => record.resourceId)
    ]).length,
    privacyExposureIds: uniqueSorted4([
      ...publiclyExposedAddresses.map((address) => address.resourceId),
      ...explicitPrivacyRecords.map((record) => record.resourceId)
    ]),
    totalUtxoCount: snapshot.utxos.length,
    smallUtxoCount: smallUtxos.length,
    fragmentedUtxoIds: fragmentationLevel === "low" ? [] : smallUtxos.map((utxo) => utxo.resourceId),
    fragmentationLevel,
    concentrationLevel,
    largestUtxoShareBasisPoints: largestShareBasisPoints,
    largestUtxoId: largestUtxo?.resourceId ?? null,
    poorHygieneCount: explicitPoorHygieneRecords.length,
    poorHygieneIds: explicitPoorHygieneRecords.map((record) => record.resourceId),
    exposedReceivingPatternCount: uniqueSorted4([
      ...repeatedExposedAddresses.map((address) => address.resourceId),
      ...explicitExposedReceiveRecords.map((record) => record.resourceId)
    ]).length,
    exposedReceivingPatternIds: uniqueSorted4([
      ...repeatedExposedAddresses.map((address) => address.resourceId),
      ...explicitExposedReceiveRecords.map((record) => record.resourceId)
    ])
  };
}

// src/wallet/bitcoin/evaluate.ts
function evaluateBitcoinWalletScan(input) {
  const normalizedSnapshot = normalizeBitcoinWalletSnapshot(input);
  const signals = buildBitcoinWalletSignals(normalizedSnapshot);
  const findingDrafts = buildBitcoinWalletFindings(normalizedSnapshot, signals);
  return assembleBitcoinWalletEvaluation({
    request: input.request,
    snapshot: input.snapshot,
    normalizedSnapshot,
    signals,
    findingDrafts,
    evaluatedAt: input.evaluatedAt,
    reportVersion: input.reportVersion ?? "1"
  });
}

// src/wallet/evm/cleanup-prepare.ts
var ZERO_ADDRESS2 = "0x0000000000000000000000000000000000000000";
var ZERO_VALUE = "0x0";
var ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;
function stripHexPrefix2(value) {
  return value.startsWith("0x") ? value.slice(2) : value;
}
function encodeWord(hexValue) {
  return hexValue.padStart(64, "0");
}
function encodeAddressWord(address) {
  if (!ADDRESS_PATTERN.test(address)) {
    return null;
  }
  return encodeWord(stripHexPrefix2(address));
}
function encodeUint256Word(value) {
  try {
    return encodeWord(BigInt(value).toString(16));
  } catch {
    return null;
  }
}
function encodeBoolWord(value) {
  return encodeWord(value ? "1" : "0");
}
function buildPreparedTransaction(action, walletAddress, networkId) {
  let functionName = null;
  let methodSelector = null;
  let args = [];
  let data = null;
  let supportStatus = "supported";
  let supportDetail = "Prepared from normalized approval data only. User signature, submission, and confirmation happen outside this layer.";
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
          value: action.approval.spenderAddress
        },
        {
          name: "amount",
          type: "uint256",
          value: "0"
        }
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
      const zeroWord = encodeAddressWord(ZERO_ADDRESS2);
      const tokenIdWord = action.approval.tokenId === null ? null : encodeUint256Word(action.approval.tokenId);
      functionName = "approve";
      methodSelector = APPROVE_SELECTOR;
      args = [
        {
          name: "to",
          type: "address",
          value: ZERO_ADDRESS2
        },
        {
          name: "tokenId",
          type: "uint256",
          value: action.approval.tokenId ?? ""
        }
      ];
      if (zeroWord === null || tokenIdWord === null) {
        supportStatus = "not_supported";
        supportDetail = "ERC-721 token revoke payload requires a deterministic tokenId.";
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
          value: action.approval.spenderAddress
        },
        {
          name: "approved",
          type: "bool",
          value: "false"
        }
      ];
      if (operatorWord === null) {
        supportStatus = "not_supported";
        supportDetail = "Operator revoke payload requires a valid normalized operator address.";
        break;
      }
      data = `${methodSelector}${operatorWord}${encodeBoolWord(false)}`;
      break;
    }
  }
  const executable = supportStatus === "supported" && functionName !== null && methodSelector !== null && data !== null && ADDRESS_PATTERN.test(action.approval.tokenAddress);
  return {
    transactionId: buildStableId("wallet_cleanup_tx", {
      actionId: action.actionId,
      networkId,
      walletAddress
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
    supportDetail: executable ? supportDetail : supportDetail ?? "Required transaction fields were incomplete."
  };
}
function getSelectedActions(plan, actionIds) {
  const requested = new Set(actionIds);
  return plan.actions.filter((action) => requested.has(action.actionId));
}
function prepareEvmCleanupTransaction(action, walletAddress, networkId) {
  return buildPreparedTransaction(action, walletAddress, networkId);
}
function prepareEvmCleanupExecutionRequest(plan, actionIds, createdAt) {
  const actions = getSelectedActions(plan, actionIds);
  const preparedTransactions = actions.map(
    (action) => prepareEvmCleanupTransaction(action, plan.walletAddress, plan.networkId)
  );
  const allExecutable = preparedTransactions.length > 0 && preparedTransactions.every((transaction) => transaction.executable);
  const selectionKind = preparedTransactions.length <= 1 ? "single_action" : "batch_actions";
  const packaging = !allExecutable ? "not_supported" : preparedTransactions.length <= 1 ? "single_transaction" : "multiple_transactions";
  return {
    requestId: buildStableId("wallet_cleanup_request", {
      actionIds: actions.map((action) => action.actionId),
      createdAt,
      planId: plan.planId
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
    supportStatus: !allExecutable ? "not_supported" : preparedTransactions.length <= 1 ? "supported" : "partial",
    supportDetail: !allExecutable ? "At least one selected revoke action could not be converted into a complete transaction payload." : preparedTransactions.length <= 1 ? "Prepared one revoke transaction for explicit wallet signature." : `Prepared ${preparedTransactions.length} ordered revoke transaction(s). Execution remains reviewable and may require multiple wallet signatures or confirmations.`
  };
}

// src/wallet/evm/cleanup-execution.ts
function normalizeNullableString(value) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}
function interpretEvmCleanupExecutionResult(input) {
  return {
    actionId: input.actionId,
    status: input.status,
    txHash: normalizeNullableString(input.txHash)?.toLowerCase() ?? null,
    errorCode: normalizeNullableString(input.errorCode),
    errorMessage: normalizeNullableString(input.errorMessage),
    requiresRescan: input.status === "confirmed",
    finalizedAt: normalizeNullableString(input.finalizedAt)
  };
}
function buildPendingResult(actionId) {
  return {
    actionId,
    status: "pending_signature",
    txHash: null,
    errorCode: null,
    errorMessage: null,
    requiresRescan: false,
    finalizedAt: null
  };
}
function validateRescanSnapshotContext(plan, rescanSnapshot) {
  if (rescanSnapshot === null) {
    return {
      acceptedSnapshot: null,
      accepted: true,
      mismatchReason: null
    };
  }
  if (rescanSnapshot.walletChain !== plan.walletChain) {
    return {
      acceptedSnapshot: null,
      accepted: false,
      mismatchReason: "wallet_chain_mismatch"
    };
  }
  if (rescanSnapshot.walletAddress !== plan.walletAddress) {
    return {
      acceptedSnapshot: null,
      accepted: false,
      mismatchReason: "wallet_address_mismatch"
    };
  }
  if (rescanSnapshot.networkId !== plan.networkId) {
    return {
      acceptedSnapshot: null,
      accepted: false,
      mismatchReason: "network_id_mismatch"
    };
  }
  return {
    acceptedSnapshot: rescanSnapshot,
    accepted: true,
    mismatchReason: null
  };
}
function buildReconciliationItem(action, result, rescanSnapshot) {
  let rescanStatus = "not_requested";
  if (result.status === "confirmed" && rescanSnapshot !== null) {
    rescanStatus = rescanSnapshot.activeApprovalIds.includes(action.approval.approvalId) ? "still_active" : "cleared";
  }
  return {
    actionId: action.actionId,
    approvalId: action.approval.approvalId,
    executionStatus: result.status,
    rescanStatus,
    findingIds: action.findingIds,
    txHash: result.txHash,
    requiresRescan: result.status === "confirmed" && rescanSnapshot === null
  };
}
function reconcileEvmCleanupPlanResults(plan, results, rescanSnapshot) {
  const resultMap = new Map(results.map((result) => [result.actionId, result]));
  const validation = validateRescanSnapshotContext(plan, rescanSnapshot ?? null);
  const normalizedRescanSnapshot = validation.acceptedSnapshot;
  const items = plan.actions.map(
    (action) => buildReconciliationItem(
      action,
      resultMap.get(action.actionId) ?? buildPendingResult(action.actionId),
      normalizedRescanSnapshot
    )
  );
  return {
    planId: plan.planId,
    walletChain: "evm",
    walletAddress: plan.walletAddress,
    networkId: plan.networkId,
    requiresRescan: items.some((item) => item.requiresRescan),
    rescanSnapshotAccepted: validation.accepted,
    rescanMismatchReason: validation.mismatchReason,
    confirmedActionIds: items.filter((item) => item.executionStatus === "confirmed").map((item) => item.actionId),
    outstandingActionIds: items.filter(
      (item) => item.executionStatus !== "confirmed" || item.rescanStatus !== "cleared"
    ).map((item) => item.actionId),
    items,
    rescanSnapshot: normalizedRescanSnapshot
  };
}
export {
  KNOWN_PROTOCOL_DOMAINS,
  PHISHING_CODES,
  RULE_SET_VERSION,
  SUSPICIOUS_TLDS,
  TRANSACTION_SELECTOR_REGISTRY,
  analyzeTransactions,
  buildEmptyValidatedTransactionLayer2Snapshot,
  buildEvmCleanupPlan,
  buildNavigationContext,
  buildTransactionDecisionPackage,
  buildTransactionSignals,
  buildWalletReportId,
  classifyPermitKind,
  classifyTransactionRisk,
  classifyTransactionSelector,
  compileDomainIntelSnapshot,
  containsAirdropKeyword,
  containsMintKeyword,
  containsWalletConnectPattern,
  contextToInput,
  createAuditRecord,
  createTransactionIntelProvider,
  decodeTransactionCalldata,
  deconfuseHostname,
  deriveUserProtectionProfile,
  domainSimilarityScore,
  evaluate,
  evaluateBitcoinWalletScan,
  evaluateEvmWalletScan,
  evaluateSolanaWalletScan,
  evaluateTransaction,
  explainTransaction,
  extractHostname,
  extractRegistrableDomain,
  extractTld,
  getCanonicalTransactionSnapshotActivation,
  getDefaultTransactionIntelProvider,
  getEvmCleanupEligibility,
  getReasonMessage,
  getTransactionSelectorDefinition,
  getTransactionSignals,
  getVerdictTitle,
  hasHomoglyphs,
  hasSuspiciousTld,
  interpretEvmCleanupExecutionResult,
  isIpHost,
  isKnownMaliciousDomain,
  isNewDomain,
  isValidUrl,
  listTransactionSelectors,
  looksLikeProtocolImpersonation,
  matchedLureKeywords,
  normalizeTransactionRequest,
  normalizeTypedData,
  normalizeTypedDataRequest,
  normalizeUrl,
  prepareEvmCleanupExecutionRequest,
  prepareEvmCleanupTransaction,
  reconcileEvmCleanupPlanResults,
  resolveCanonicalTransactionIntel,
  resolveDomainIntel,
  riskBadgeLabel,
  validateDomainIntelBundle,
  validateTransactionLayer2Snapshot
};
//# sourceMappingURL=index.js.map