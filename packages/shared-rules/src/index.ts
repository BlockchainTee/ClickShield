// ── Engine ──
export { evaluate, evaluateTransaction } from "./engine/evaluate.js";
export { RULE_SET_VERSION } from "./engine/verdict.js";
export type {
  RiskLevel,
  RuleOutcome,
  Verdict,
  EngineResult,
  NavigationInput,
  NavigationContext,
  DomainContext,
  SignatureInput,
  TransactionEvaluationResult,
  TransactionInput,
  TransactionIntelVersions,
  TransactionOverrideLevel,
  TransactionVerdict,
  TransactionVerdictStatus,
} from "./engine/types.js";

// ── Context Builder ──
export {
  buildNavigationContext,
  contextToInput,
} from "./context-builder.js";
export type { BuildContextOptions } from "./context-builder.js";

// ── Reason Messages ──
export {
  getReasonMessage,
  getVerdictTitle,
  riskBadgeLabel,
} from "./reason-messages.js";
export type { ReasonMessage } from "./reason-messages.js";

// ── Normalize ──
export { normalizeUrl, isValidUrl } from "./normalize/url.js";
export {
  extractHostname,
  extractRegistrableDomain,
  extractTld,
} from "./normalize/domain.js";

// ── Signals ──
export {
  isNewDomain,
  looksLikeProtocolImpersonation,
  containsMintKeyword,
  containsAirdropKeyword,
  isKnownMaliciousDomain,
  domainSimilarityScore,
  hasSuspiciousTld,
  matchedLureKeywords,
  isIpHost,
  containsWalletConnectPattern,
  hasHomoglyphs,
  deconfuseHostname,
  KNOWN_PROTOCOL_DOMAINS,
  SUSPICIOUS_TLDS,
} from "./signals/domain-signals.js";

// ── Layer 3 Transaction Foundation (Phase A) ──
export {
  getTransactionSelectorDefinition,
  listTransactionSelectors,
  classifyTransactionSelector,
  TRANSACTION_SELECTOR_REGISTRY,
} from "./transaction/selectors.js";
export type { TransactionSelectorDefinition } from "./transaction/selectors.js";
export {
  decodeTransactionCalldata,
  normalizeTransactionRequest,
  normalizeTypedDataRequest,
} from "./transaction/decode.js";
export { normalizeTypedData, classifyPermitKind } from "./transaction/typed-data.js";
export { buildTransactionExplanation } from "./transaction/explain.js";
export { buildTransactionSignals } from "./signals/transaction-signals.js";
export type {
  ApprovalDirection,
  ApprovalAmountKind,
  ApprovalScope,
  ChainFamily,
  DecodedTransactionAction,
  Layer3RpcMethod,
  Layer2SectionState as TransactionLayer2SectionState,
  Layer3RpcMethod as TransactionLayer3RpcMethod,
  NormalizedTransactionContext,
  NormalizedTypedData,
  PermitKind,
  RawSignatureRequest,
  RawTransactionRequest,
  RawTypedDataPayload,
  SignatureRpcMethod,
  TransactionActionType,
  TransactionBatchContext,
  TransactionCounterpartyContext,
  TransactionEventKind,
  TransactionExplanation,
  TransactionIntelContext,
  TransactionIntelDisposition,
  TransactionMeta,
  TransactionParamValue,
  TransactionProviderContext,
  TransactionRpcMethod,
  TransactionSignals,
  TypedDataField,
  TypedDataNormalizationState,
  TypedDataTypes,
  TypedDataValue,
  WalletProviderMetadata,
} from "./transaction/types.js";

// ── Policy Codes ──
export { PHISHING_CODES } from "./policies/phishing/codes.js";
export type { PhishingCode } from "./policies/phishing/codes.js";

// ── Layer 2 Intel (Phase A) ──
export {
  compileDomainIntelSnapshot,
} from "./intel/compile.js";
export { resolveDomainIntel } from "./intel/resolve-domain.js";
export { validateDomainIntelBundle } from "./intel/validate.js";
export type {
  CompileDomainIntelSnapshotOptions,
  CompiledDomainAllowlistItem,
  CompiledDomainAllowlistsSection,
  CompiledDomainIntelSnapshot,
  CompiledMaliciousDomainItem,
  CompiledMaliciousDomainsSection,
  DomainAllowlistsSection,
  DomainIntelBundle,
  DomainIntelCompileFailure,
  DomainIntelCompileResult,
  DomainIntelCompileSuccess,
  DomainIntelSectionMetadata,
  DomainIntelSectionName,
  DomainIntelSectionValidationReport,
  DomainIntelSignatureEnvelope,
  DomainIntelValidationOptions,
  DomainIntelValidationReport,
  DomainAllowlistFeedItem,
  DomainLookupDisposition,
  DomainLookupResult,
  IntelValidationIssue,
  Layer2SectionState,
  MaliciousDomainFeedItem,
  MaliciousDomainsSection,
} from "./intel/types.js";

// ── Layer 4 Wallet Framework (Phase 4A) ──
export { buildWalletReportId } from "./wallet/report-id.js";
export { evaluateEvmWalletScan } from "./wallet/evm/evaluate.js";
export type { WalletReportIdInput } from "./wallet/report-id.js";
export type {
  EvmApprovalAmountKind,
  EvmApprovalKind,
  EvmApprovalRecordInput,
  EvmContractExposureInput,
  EvmContractExposureType,
  EvmCounterpartyDisposition,
  EvmTokenStandard,
  EvmWalletHydratedSnapshot,
  EvmWalletScanEvaluation,
  EvmWalletScanEvaluationInput,
  EvmWalletSignals,
  NormalizedEvmApprovalState,
  NormalizedEvmContractExposure,
  NormalizedEvmSpenderRisk,
  NormalizedEvmWalletSnapshot,
} from "./wallet/evm/types.js";
export type {
  WalletCapabilityArea,
  WalletCapabilityBoundary,
  WalletCapabilityStatus,
  WalletChain,
  WalletCleanupAction,
  WalletCleanupActionExecutionStatus,
  WalletCleanupActionKind,
  WalletCleanupActionResult,
  WalletCleanupExecutionMode,
  WalletCleanupExecutionResult,
  WalletCleanupExecutionStatus,
  WalletCleanupPlan,
  WalletCleanupTarget,
  WalletCleanupTargetKind,
  WalletEvidenceRef,
  WalletExposureCategory,
  WalletFinding,
  WalletFindingStatus,
  WalletReport,
  WalletRiskFactor,
  WalletScanMode,
  WalletScanRequest,
  WalletScanResult,
  WalletScanSnapshot,
  WalletScoreBreakdown,
  WalletScoreComponent,
  WalletSnapshotSection,
  WalletSummary,
} from "./wallet/types.js";
