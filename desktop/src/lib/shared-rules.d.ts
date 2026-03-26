// GENERATED FILE - sourced from packages/shared-rules/dist/index.d.ts via npm run sync:surfaces.
type ChainFamily = "evm";
type TransactionEventKind = "transaction" | "signature";
type TransactionRpcMethod = "eth_sendTransaction";
type SignatureRpcMethod = "eth_signTypedData" | "eth_signTypedData_v4";
type Layer3RpcMethod = TransactionRpcMethod | SignatureRpcMethod;
type TransactionActionType = "approve" | "setApprovalForAll" | "increaseAllowance" | "permit" | "transfer" | "transferFrom" | "multicall" | "unknown";
type ApprovalAmountKind = "exact" | "unlimited" | "not_applicable";
type ApprovalScope = "single_token" | "collection_all" | "not_applicable";
type ApprovalDirection = "grant" | "revoke" | "not_applicable";
type PermitKind = "none" | "erc20_permit" | "permit2_single" | "permit2_batch" | "unknown_permit";
type TypedDataNormalizationState = "normalized" | "missing_domain_fields" | "invalid_domain_fields";
type TransactionIntelDisposition = "malicious" | "allowlisted" | "no_match" | "unavailable";
type Layer2SectionState$1 = "fresh" | "stale" | "expired" | "missing" | "invalid";
type TransactionParamValue = string | boolean | null;
interface WalletProviderMetadata {
    readonly providerType: string;
    readonly walletName: string;
    readonly walletVersion: string | null;
    readonly platform: string;
}
interface TransactionCounterpartyContext {
    readonly spenderTrusted: boolean | null;
    readonly recipientIsNew: boolean | null;
}
interface TransactionIntelContext {
    readonly contractDisposition: TransactionIntelDisposition;
    readonly contractFeedVersion: string | null;
    readonly allowlistFeedVersion: string | null;
    readonly signatureDisposition: TransactionIntelDisposition;
    readonly signatureFeedVersion: string | null;
    readonly originDisposition: "allowlisted" | "no_match" | "unavailable";
    readonly sectionStates: Readonly<Record<string, Layer2SectionState$1>>;
}
interface TransactionProviderContext {
    readonly surface: string;
    readonly walletProvider: string;
    readonly walletName: string;
    readonly platform: string;
}
interface TransactionMeta {
    readonly selectorRecognized: boolean;
    readonly typedDataNormalized: boolean;
}
interface DecodedTransactionAction {
    readonly functionName: string | null;
    readonly selector: string | null;
    readonly actionType: TransactionActionType;
    readonly params: Readonly<Record<string, TransactionParamValue>>;
    readonly tokenAddress: string | null;
    readonly spender: string | null;
    readonly operator: string | null;
    readonly recipient: string | null;
    readonly owner: string | null;
    readonly amount: string | null;
    readonly amountKind: ApprovalAmountKind;
    readonly approvalScope: ApprovalScope;
    readonly approvalDirection: ApprovalDirection;
}
interface TransactionBatchContext {
    readonly isMulticall: boolean;
    readonly batchSelector: string | null;
    readonly actions: readonly DecodedTransactionAction[];
}
type TypedDataValue = string | boolean | null | readonly TypedDataValue[] | {
    readonly [key: string]: TypedDataValue;
};
interface TypedDataField {
    readonly name: string;
    readonly type: string;
}
type TypedDataTypes = Readonly<Record<string, readonly TypedDataField[]>>;
interface NormalizedTypedData {
    readonly isTypedData: boolean;
    readonly primaryType: string | null;
    readonly domainName: string | null;
    readonly domainVersion: string | null;
    readonly domainChainId: string | null;
    readonly domainChainIdPresent: boolean;
    readonly verifyingContract: string | null;
    readonly verifyingContractPresent: boolean;
    readonly message: {
        readonly [key: string]: TypedDataValue;
    };
    readonly domain: {
        readonly [key: string]: TypedDataValue;
    };
    readonly types: TypedDataTypes;
    readonly canonicalJson: string;
    readonly normalizationState: TypedDataNormalizationState;
    readonly missingDomainFields: readonly string[];
    readonly invalidDomainFields: readonly string[];
    readonly permitKind: PermitKind;
}
interface RawTransactionRequest {
    readonly eventKind: "transaction";
    readonly rpcMethod: TransactionRpcMethod;
    readonly chainFamily: ChainFamily;
    readonly chainId: number;
    readonly from: string;
    readonly to: string;
    readonly value: string | number | bigint | null | undefined;
    readonly calldata: string;
    readonly originDomain: string;
    readonly walletProvider: string;
    readonly walletMetadata: WalletProviderMetadata;
    readonly surface?: string;
    readonly intel?: Partial<TransactionIntelContext>;
    readonly counterparty?: Partial<TransactionCounterpartyContext>;
}
interface RawTypedDataPayload {
    readonly domain?: Readonly<Record<string, unknown>> | null;
    readonly types?: Readonly<Record<string, readonly TypedDataField[]>> | null;
    readonly primaryType?: string | null;
    readonly message?: Readonly<Record<string, unknown>> | null;
}
interface RawSignatureRequest {
    readonly eventKind: "signature";
    readonly rpcMethod: SignatureRpcMethod;
    readonly chainFamily: ChainFamily;
    readonly chainId: number;
    readonly from: string;
    readonly typedData: string | RawTypedDataPayload;
    readonly originDomain: string;
    readonly walletProvider: string;
    readonly walletMetadata: WalletProviderMetadata;
    readonly surface?: string;
    readonly intel?: Partial<TransactionIntelContext>;
    readonly counterparty?: Partial<TransactionCounterpartyContext>;
}
interface NormalizedTransactionContext {
    readonly eventKind: TransactionEventKind;
    readonly rpcMethod: Layer3RpcMethod;
    readonly chainFamily: ChainFamily;
    readonly chainId: number;
    readonly originDomain: string;
    readonly from: string;
    readonly to: string | null;
    readonly valueWei: string;
    readonly calldata: string;
    readonly methodSelector: string | null;
    readonly actionType: TransactionActionType;
    readonly decoded: DecodedTransactionAction;
    readonly batch: TransactionBatchContext;
    readonly signature: NormalizedTypedData;
    readonly intel: TransactionIntelContext;
    readonly provider: TransactionProviderContext;
    readonly counterparty: TransactionCounterpartyContext;
    readonly meta: TransactionMeta;
}
interface TransactionExplanation {
    readonly headline: string;
    readonly summary: string;
    readonly details: readonly string[];
    readonly unknowns: readonly string[];
    readonly technical: readonly string[];
}
interface TransactionSignals {
    readonly actionType: TransactionActionType;
    readonly isApprovalMethod: boolean;
    readonly isUnlimitedApproval: boolean;
    readonly isPermitSignature: boolean;
    readonly isSetApprovalForAll: boolean;
    readonly approvalDirection: ApprovalDirection;
    readonly spenderTrusted: boolean | null;
    readonly recipientIsNew: boolean | null;
    readonly isTransfer: boolean;
    readonly isTransferFrom: boolean;
    readonly isContractInteraction: boolean;
    readonly isMulticall: boolean;
    readonly containsApprovalAndTransfer: boolean;
    readonly containsApproval: boolean;
    readonly containsTransfer: boolean;
    readonly containsTransferFrom: boolean;
    readonly batchActionCount: number;
    readonly hasNativeValue: boolean;
    readonly touchesMaliciousContract: boolean;
    readonly targetAllowlisted: boolean;
    readonly signatureIntelMatch: boolean;
    readonly verifyingContractKnown: boolean;
    readonly hasUnknownInnerCall: boolean;
}

/**
 * Risk severity levels, ordered from least to most severe.
 */
type RiskLevel = "low" | "medium" | "high" | "critical";
/**
 * Outcome when a rule matches an input.
 */
type RuleOutcome = "allow" | "warn" | "block";
/**
 * The final verdict after all rules have been evaluated.
 */
interface Verdict {
    /** Action determined by the strongest-priority matched rule (lowest numeric value wins). */
    readonly status: RuleOutcome;
    /** Highest severity among all matched rules. */
    readonly riskLevel: RiskLevel;
    /** Aggregated reason codes from all matched rules. */
    readonly reasonCodes: string[];
    /** IDs of all rules that matched. */
    readonly matchedRules: string[];
    /** Merged evidence from all matched rules. */
    readonly evidence: Record<string, unknown>;
    /** Version of the rule set used for this evaluation. */
    readonly ruleSetVersion: string;
    /** Version of the threat feed data, if applicable. */
    readonly feedVersion?: string;
}
/**
 * Full engine result returned from evaluate().
 */
interface EngineResult {
    /** The assembled verdict. */
    readonly verdict: Verdict;
    /** IDs of all rules that matched (convenience duplicate of verdict.matchedRules). */
    readonly matchedRules: string[];
    /** Aggregated reason codes (convenience duplicate of verdict.reasonCodes). */
    readonly reasonCodes: string[];
    /** Merged evidence (convenience duplicate of verdict.evidence). */
    readonly evidence: Record<string, unknown>;
}
/**
 * External domain context data. Must be preloaded before calling evaluate().
 */
interface DomainContext {
    /** Domain age in hours. Null if unknown. */
    readonly ageHours: number | null;
    /** Whether this domain appears in a known-malicious feed. */
    readonly isKnownMalicious: boolean;
}
/** Input for URL navigation events. */
interface NavigationInput {
    readonly eventKind: "navigation";
    /** Raw URL string as navigated by the user. */
    readonly rawUrl: string;
    /** Domain context (age, feed status). */
    readonly domainContext: DomainContext;
    /** Whether the hostname contains wallet-connect patterns. */
    readonly containsWalletConnectPattern?: boolean;
    /** Whether the hostname contains homoglyph/confusable characters. */
    readonly hasHomoglyphs?: boolean;
    /** Number of redirects in the chain. */
    readonly redirectCount?: number;
    /** Final domain after redirect chain. */
    readonly finalDomain?: string;
}
/** Input for normalized transaction requests. */
type TransactionInput = NormalizedTransactionContext & {
    readonly eventKind: "transaction";
};
/** Input for normalized signature requests. */
type SignatureInput = NormalizedTransactionContext & {
    readonly eventKind: "signature";
};
type TransactionVerdictStatus = "ALLOW" | "WARN" | "BLOCK";
type TransactionOverrideLevel = "none" | "confirm" | "high_friction_confirm";
interface TransactionIntelVersions {
    readonly contractFeedVersion: string | null;
    readonly allowlistFeedVersion: string | null;
    readonly signatureFeedVersion: string | null;
}
interface TransactionVerdict {
    readonly status: TransactionVerdictStatus;
    readonly riskLevel: RiskLevel;
    readonly reasonCodes: string[];
    readonly matchedRules: string[];
    readonly primaryRuleId: string | null;
    readonly evidence: Record<string, unknown>;
    readonly explanation: TransactionExplanation;
    readonly ruleSetVersion: string;
    readonly intelVersions: TransactionIntelVersions;
    readonly overrideAllowed: boolean;
    readonly overrideLevel: TransactionOverrideLevel;
}
interface TransactionEvaluationResult {
    readonly verdict: TransactionVerdict;
    readonly matchedRules: string[];
    readonly reasonCodes: string[];
    readonly evidence: Record<string, unknown>;
    readonly signals: TransactionSignals;
}
/**
 * Rich navigation context built by clients before calling evaluate().
 * Clients build this from browser/webview navigation events,
 * then map it to NavigationInput for the engine.
 */
interface NavigationContext {
    eventKind: "navigation";
    normalized: {
        url: string;
        hostname: string;
        path: string;
        registrableDomain: string;
    };
    signals: {
        looksLikeProtocolImpersonation: boolean;
        impersonatedProtocol?: string;
        domainAgeHours: number | null;
        containsWalletConnectPattern: boolean;
        containsMintKeyword: boolean;
        isKnownMaliciousDomain: boolean;
        isIpHost: boolean;
        hasHomoglyphs: boolean;
        redirectCount: number;
        finalDomain: string;
    };
    intel: {
        feedVersion?: string;
        domainAllowlistVersion?: string;
    };
    meta: {
        timestamp: string;
        ruleSetVersion: string;
    };
}

/**
 * Main entry point: evaluate a navigation input against the registered rules.
 *
 * The current public package surface is intentionally navigation-only.
 * Evaluation is synchronous, deterministic, and side-effect free.
 *
 * @param input - A navigation input built by the caller.
 * @returns EngineResult with verdict, matchedRules, reasonCodes, and evidence.
 */
declare function evaluate(input: NavigationInput): EngineResult;
/**
 * Evaluate a normalized Layer 3 transaction or signature input.
 *
 * Rules are sorted deterministically, evaluated synchronously, and assembled
 * into the Layer 3 verdict contract.
 *
 * @param input - A normalized transaction or signature context.
 * @returns TransactionEvaluationResult with Layer 3 verdict metadata.
 */
declare function evaluateTransaction(input: TransactionInput | SignatureInput): TransactionEvaluationResult;

/** Current version of the rule set. */
declare const RULE_SET_VERSION = "0.1.0";

/**
 * Options for building a NavigationContext.
 * Clients provide what they know; signals are computed automatically.
 */
interface BuildContextOptions {
    /** The raw URL being navigated to. */
    rawUrl: string;
    /** Domain age in hours. Null if unknown. */
    domainAgeHours?: number | null;
    /** Whether this domain is in a known-malicious feed. */
    isKnownMaliciousDomain?: boolean;
    /** Number of redirects observed. */
    redirectCount?: number;
    /** Final domain after redirect chain. */
    finalDomain?: string;
    /** Threat feed version, if available. */
    feedVersion?: string;
    /** Domain allowlist version, if available. */
    domainAllowlistVersion?: string;
}
/**
 * Build a NavigationContext from client-provided options.
 * Computes all signals automatically from the URL.
 *
 * @param opts - Options from the client.
 * @returns A fully-populated NavigationContext.
 */
declare function buildNavigationContext(opts: BuildContextOptions): NavigationContext;
/**
 * Convert a NavigationContext to a NavigationInput for the engine.
 * This is the bridge between the rich client context and the
 * engine's simpler input type.
 *
 * @param ctx - The NavigationContext to convert.
 * @returns A NavigationInput suitable for evaluate().
 */
declare function contextToInput(ctx: NavigationContext): NavigationInput;

/**
 * Human-readable UX fields for a verdict reason code.
 */
interface ReasonMessage {
    /** Title for blocked state. */
    readonly blockedTitle: string;
    /** Title for warning state. */
    readonly warningTitle: string;
    /** Plain-English explanation of the risk. */
    readonly reason: string;
    /** Label for the primary "go back" action. */
    readonly goBackLabel: string;
    /** Label for the secondary "proceed" action. */
    readonly proceedLabel: string;
}
/**
 * Get the human-readable message for a reason code.
 * Falls back to a generic message if the code is unknown.
 */
declare function getReasonMessage(reasonCode: string): ReasonMessage;
/**
 * Get the display title based on verdict outcome and reason code.
 */
declare function getVerdictTitle(outcome: RuleOutcome, reasonCode: string): string;
/**
 * Map risk level to a display badge label.
 */
declare function riskBadgeLabel(riskLevel: RiskLevel): string;

/**
 * Normalize a URL for consistent comparison.
 *
 * Steps:
 * 1. Parse with the URL API (prepend https:// if no protocol).
 * 2. Lowercase the hostname.
 * 3. Strip fragment (#...).
 * 4. Remove known tracking query parameters.
 * 5. Sort remaining query parameters alphabetically.
 * 6. Remove trailing slash from pathname (except root "/").
 *
 * @param rawUrl - The raw URL string to normalize.
 * @returns The normalized URL string, or the original lowercased if parsing fails.
 */
declare function normalizeUrl(rawUrl: string): string;
/**
 * Validate that a string is a well-formed URL.
 *
 * @param rawUrl - The URL string to validate.
 * @returns True if the URL can be parsed by the URL API.
 */
declare function isValidUrl(rawUrl: string): boolean;

/**
 * Extract the hostname from a URL string.
 *
 * @param rawUrl - A URL or hostname string.
 * @returns The lowercase hostname, or empty string on failure.
 */
declare function extractHostname(rawUrl: string): string;
/**
 * Extract the registrable domain (eTLD+1) from a hostname.
 *
 * @example
 * extractRegistrableDomain("app.uniswap.org") // => "uniswap.org"
 * extractRegistrableDomain("foo.bar.co.uk")   // => "bar.co.uk"
 * extractRegistrableDomain("localhost")        // => "localhost"
 *
 * @param hostname - A hostname string (no protocol).
 * @returns The registrable domain.
 */
declare function extractRegistrableDomain(hostname: string): string;
/**
 * Extract the TLD from a hostname.
 * Returns multi-part TLDs where applicable (e.g., "co.uk").
 *
 * @param hostname - A hostname string (no protocol).
 * @returns The TLD string, or empty string for single-label hosts.
 */
declare function extractTld(hostname: string): string;

/**
 * Known Web3 protocol domains that phishers commonly impersonate.
 */
declare const KNOWN_PROTOCOL_DOMAINS: readonly string[];
/** TLDs commonly associated with phishing sites. */
declare const SUSPICIOUS_TLDS: ReadonlySet<string>;
/**
 * Check if a domain was recently registered (considered "new" if under threshold).
 *
 * @param ageHours - Domain age in hours. Null if unknown.
 * @param thresholdHours - Maximum age to consider "new" (default: 72 hours).
 * @returns True if the domain is newer than the threshold.
 */
declare function isNewDomain(ageHours: number | null, thresholdHours?: number): boolean;
/**
 * Detect if a URL's domain looks like it is impersonating a known protocol.
 * Returns the best-match protocol domain and similarity score.
 *
 * Only flags when similarity is >= 0.8 but NOT an exact match
 * (exact matches are legitimate).
 *
 * @param rawUrl - The URL to check.
 * @returns Match info with target and similarityScore, or null.
 */
declare function looksLikeProtocolImpersonation(rawUrl: string): {
    target: string;
    similarityScore: number;
} | null;
/**
 * Check if a URL contains mint/claim/airdrop/reward keywords.
 *
 * @param rawUrl - The URL to check.
 * @returns True if any mint-related keyword is found.
 */
declare function containsMintKeyword(rawUrl: string): boolean;
/**
 * Check if a URL contains airdrop-related keywords.
 *
 * @param rawUrl - The URL to check.
 * @returns True if any airdrop-related keyword is found.
 */
declare function containsAirdropKeyword(rawUrl: string): boolean;
/**
 * Check if a domain is flagged in a known-malicious feed.
 * This is a pass-through signal; the actual lookup is done externally.
 *
 * @param isKnownMalicious - Whether the domain is flagged in the feed.
 * @returns The same boolean value.
 */
declare function isKnownMaliciousDomain(isKnownMalicious: boolean): boolean;
/**
 * Compute the best similarity score between a URL's domain
 * and known protocol domains.
 *
 * @param rawUrl - The URL to check.
 * @returns The highest similarity score (0 to 1), or 0 on failure.
 */
declare function domainSimilarityScore(rawUrl: string): number;
/**
 * Check if a domain has a TLD commonly associated with phishing.
 *
 * @param rawUrl - The URL to check.
 * @returns True if the TLD is in the suspicious set.
 */
declare function hasSuspiciousTld(rawUrl: string): boolean;
/**
 * Get the matched lure keywords from a URL.
 *
 * @param rawUrl - The URL to check.
 * @returns Array of matched keyword strings.
 */
declare function matchedLureKeywords(rawUrl: string): string[];
/**
 * Check if a hostname is a raw IP address.
 * Excludes localhost and 127.0.0.1.
 *
 * @param rawUrl - The URL to check.
 * @returns True if hostname is a non-localhost IP address.
 */
declare function isIpHost(rawUrl: string): boolean;
/**
 * Check if a URL contains WalletConnect-related patterns.
 *
 * @param rawUrl - The URL to check.
 * @returns True if any wallet-connect pattern is found.
 */
declare function containsWalletConnectPattern(rawUrl: string): boolean;
/**
 * Detect homoglyph/confusable characters in a hostname.
 * Returns true if any characters in the hostname map to
 * ASCII lookalikes via the confusable character table.
 *
 * @param rawUrl - The URL to check.
 * @returns True if confusable characters are detected.
 */
declare function hasHomoglyphs(rawUrl: string): boolean;
/**
 * Deconfuse a hostname by replacing confusable characters
 * with their ASCII equivalents. Used to find the intended
 * target domain of a homoglyph attack.
 *
 * @param hostname - The hostname to deconfuse.
 * @returns The deconfused hostname with ASCII substitutions.
 */
declare function deconfuseHostname(hostname: string): string;

interface TransactionSelectorDefinition {
    readonly selector: string;
    readonly functionName: "approve" | "setApprovalForAll" | "increaseAllowance" | "permit" | "transfer" | "transferFrom" | "multicall";
    readonly actionType: TransactionActionType;
    readonly variant: "standard" | "allowed_bool" | "bytes_array" | "deadline_bytes_array";
}
declare const TRANSACTION_SELECTOR_REGISTRY: Readonly<Record<string, TransactionSelectorDefinition>>;
declare function getTransactionSelectorDefinition(selector: string): TransactionSelectorDefinition | null;
declare function classifyTransactionSelector(selector: string): TransactionActionType;
declare function listTransactionSelectors(): readonly TransactionSelectorDefinition[];

type CanonicalTransactionSnapshotSectionState = "ready" | "stale" | "missing";
interface TransactionLayer2SnapshotValidationIssue {
    readonly path: string;
    readonly message: string;
}
interface TransactionLayer2MaliciousContract {
    readonly chain: "evm";
    readonly address: string;
    readonly source: "ofac" | "chainabuse";
    readonly disposition: "block" | "warn";
    readonly confidence: number;
    readonly reasonCodes: readonly string[];
}
interface TransactionLayer2Snapshot {
    readonly version: string;
    readonly generatedAt: string;
    readonly maliciousContracts: readonly TransactionLayer2MaliciousContract[];
    readonly scamSignatures: readonly [];
    readonly sectionStates: {
        readonly maliciousContracts: CanonicalTransactionSnapshotSectionState;
        readonly scamSignatures: "missing";
    };
}
interface ValidatedTransactionLayer2Snapshot extends TransactionLayer2Snapshot {
}
interface ValidateTransactionLayer2SnapshotSuccess {
    readonly ok: true;
    readonly status: "valid" | "empty";
    readonly snapshot: ValidatedTransactionLayer2Snapshot;
    readonly issues: readonly TransactionLayer2SnapshotValidationIssue[];
}
interface ValidateTransactionLayer2SnapshotFailure {
    readonly ok: false;
    readonly status: "malformed" | "incompatible";
    readonly issues: readonly TransactionLayer2SnapshotValidationIssue[];
}
type ValidateTransactionLayer2SnapshotResult = ValidateTransactionLayer2SnapshotSuccess | ValidateTransactionLayer2SnapshotFailure;
interface CanonicalTransactionIntelLookup {
    readonly eventKind: TransactionEventKind;
    readonly targetAddress: string | null;
}
interface TrustedTransactionOriginIntel {
    readonly originDisposition: TransactionIntelContext["originDisposition"];
    readonly allowlistFeedVersion: string | null;
    readonly allowlistsState: Layer2SectionState$1;
}
declare function validateTransactionLayer2Snapshot(input: unknown): ValidateTransactionLayer2SnapshotResult;

type TransactionIntelLookupDisposition = Extract<TransactionIntelContext["contractDisposition"], "malicious" | "no_match" | "unavailable">;
interface TransactionMaliciousContractLookup {
    readonly chain: "evm";
    readonly address: string | null;
}
interface TransactionScamSignatureLookup {
    readonly normalizedKey: string | null;
}
interface TransactionMaliciousContractLookupResult {
    readonly lookupFamily: "contract";
    readonly matched: boolean;
    readonly disposition: TransactionIntelLookupDisposition;
    readonly matchedSection?: "maliciousContracts";
    readonly feedVersion: string | null;
    readonly sectionState: Layer2SectionState$1;
    readonly record: TransactionLayer2MaliciousContract | null;
}
interface TransactionScamSignatureLookupResult {
    readonly lookupFamily: "scam_signature";
    readonly matched: boolean;
    readonly disposition: TransactionIntelLookupDisposition;
    readonly matchedSection?: "scamSignatures";
    readonly feedVersion: string | null;
    readonly sectionState: Layer2SectionState$1;
}
interface CanonicalTransactionIntelLookupResult {
    readonly maliciousContract: TransactionMaliciousContractLookupResult;
    readonly scamSignature: TransactionScamSignatureLookupResult;
}
interface TransactionIntelProvider {
    readonly snapshotVersion: string | null;
    readonly generatedAt: string | null;
    lookupCanonicalTransactionIntel(lookup: CanonicalTransactionIntelLookup): CanonicalTransactionIntelLookupResult;
    lookupMaliciousContract(lookup: TransactionMaliciousContractLookup): TransactionMaliciousContractLookupResult;
    lookupScamSignature(lookup: TransactionScamSignatureLookup): TransactionScamSignatureLookupResult;
}
declare function createTransactionIntelProvider(snapshot: ValidatedTransactionLayer2Snapshot | null): TransactionIntelProvider;
declare function resolveCanonicalTransactionIntel(provider: TransactionIntelProvider, lookup: CanonicalTransactionIntelLookup): CanonicalTransactionIntelLookupResult;

declare function decodeTransactionCalldata(calldata: string, toAddress?: string | null): {
    readonly decoded: DecodedTransactionAction;
    readonly batch: TransactionBatchContext;
};
declare function normalizeTransactionRequest(input: RawTransactionRequest, options?: {
    readonly intelProvider?: TransactionIntelProvider | null;
}): NormalizedTransactionContext;
declare function normalizeTypedDataRequest(input: RawSignatureRequest, options?: {
    readonly intelProvider?: TransactionIntelProvider | null;
}): NormalizedTransactionContext;

declare function getDefaultTransactionIntelProvider(): TransactionIntelProvider;

declare function classifyPermitKind(primaryType: string | null): PermitKind;
declare function normalizeTypedData(input: string | RawTypedDataPayload): NormalizedTypedData;

declare function buildTransactionExplanation(context: NormalizedTransactionContext): TransactionExplanation;

declare function buildTransactionSignals(context: NormalizedTransactionContext): TransactionSignals;

/**
 * Reason codes for phishing detection rules.
 */
declare const PHISHING_CODES: {
    readonly PHISH_IMPERSONATION_NEW_DOMAIN: "PHISH_IMPERSONATION_NEW_DOMAIN";
    readonly PHISH_SUSPICIOUS_TLD_MINT_KEYWORD: "PHISH_SUSPICIOUS_TLD_MINT_KEYWORD";
    readonly PHISH_KNOWN_MALICIOUS_DOMAIN: "PHISH_KNOWN_MALICIOUS_DOMAIN";
    readonly DOMAIN_IMPERSONATION: "DOMAIN_IMPERSONATION";
    readonly NEW_DOMAIN: "NEW_DOMAIN";
    readonly WALLET_CONNECT_PATTERN: "WALLET_CONNECT_PATTERN";
    readonly SUSPICIOUS_TLD: "SUSPICIOUS_TLD";
    readonly MINT_KEYWORD: "MINT_KEYWORD";
    readonly KNOWN_MALICIOUS: "KNOWN_MALICIOUS";
    readonly DIRECT_IP_ACCESS: "DIRECT_IP_ACCESS";
    readonly NEW_DOMAIN_WALLET_CONNECT: "NEW_DOMAIN_WALLET_CONNECT";
    readonly HOMOGLYPH_ATTACK: "HOMOGLYPH_ATTACK";
    readonly SUSPICIOUS_REDIRECT_CHAIN: "SUSPICIOUS_REDIRECT_CHAIN";
};
/** Union type of all phishing reason codes. */
type PhishingCode = typeof PHISHING_CODES[keyof typeof PHISHING_CODES];

type DomainIntelSectionName = "maliciousDomains" | "allowlists";
type Layer2SectionState = "fresh" | "stale" | "expired" | "missing" | "invalid";
type DomainLookupDisposition = "malicious" | "allowlisted" | "no_match" | "unavailable";
interface DomainIntelSectionMetadata {
    readonly feedVersion: string;
    readonly itemCount: number;
    readonly sha256: string;
    readonly staleAfter: string;
    readonly expiresAt: string;
}
interface MaliciousDomainFeedItem {
    readonly id: string;
    readonly type: "exact_host" | "registrable_domain";
    readonly identity: string;
    readonly source: string;
    readonly reasonCode: string;
    readonly confidence: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly domain: string;
    readonly scope: "exact_host" | "registrable_domain";
    readonly classification: string;
}
interface DomainAllowlistFeedItem {
    readonly id: string;
    readonly type: "domain_exact_host" | "domain_registrable_domain";
    readonly identity: string;
    readonly source: string;
    readonly reasonCode: string;
    readonly confidence: number;
    readonly firstSeenAt: string;
    readonly lastSeenAt: string;
    readonly targetKind: "domain";
    readonly target: string;
    readonly scope: "exact_host" | "registrable_domain";
    readonly justification: string;
}
interface MaliciousDomainsSection extends DomainIntelSectionMetadata {
    readonly feedType: "maliciousDomains";
    readonly items: readonly MaliciousDomainFeedItem[];
}
interface DomainAllowlistsSection extends DomainIntelSectionMetadata {
    readonly feedType: "allowlists";
    readonly items: readonly DomainAllowlistFeedItem[];
}
interface DomainIntelBundle {
    readonly schemaVersion: string;
    readonly bundleVersion: string;
    readonly generatedAt: string;
    readonly publisher: string;
    readonly signingKeyId: string;
    readonly sections: Partial<Readonly<Record<DomainIntelSectionName, DomainIntelSectionMetadata>>>;
    readonly signature: string;
    readonly maliciousDomains?: MaliciousDomainsSection;
    readonly allowlists?: DomainAllowlistsSection;
}
interface IntelValidationIssue {
    readonly path: string;
    readonly message: string;
}
interface DomainIntelSectionValidationReport {
    readonly state: "valid" | "missing" | "invalid";
    readonly issues: readonly IntelValidationIssue[];
}
interface DomainIntelValidationReport {
    readonly isEnvelopeValid: boolean;
    readonly issues: readonly IntelValidationIssue[];
    readonly sections: Readonly<Record<DomainIntelSectionName, DomainIntelSectionValidationReport>>;
}
interface CompiledMaliciousDomainItem extends MaliciousDomainFeedItem {
    readonly domain: string;
    readonly registrableDomain: string;
}
interface CompiledDomainAllowlistItem extends DomainAllowlistFeedItem {
    readonly target: string;
    readonly registrableDomain: string;
}
interface CompiledMaliciousDomainsSection {
    readonly name: "maliciousDomains";
    readonly state: Layer2SectionState;
    readonly feedVersion?: string;
    readonly staleAfter?: string;
    readonly expiresAt?: string;
    readonly itemCount: number;
    readonly issues: readonly IntelValidationIssue[];
    readonly items: readonly CompiledMaliciousDomainItem[];
    readonly exactHostIndex: ReadonlyMap<string, CompiledMaliciousDomainItem>;
    readonly registrableDomainIndex: ReadonlyMap<string, CompiledMaliciousDomainItem>;
}
interface CompiledDomainAllowlistsSection {
    readonly name: "allowlists";
    readonly state: Layer2SectionState;
    readonly feedVersion?: string;
    readonly staleAfter?: string;
    readonly expiresAt?: string;
    readonly itemCount: number;
    readonly issues: readonly IntelValidationIssue[];
    readonly items: readonly CompiledDomainAllowlistItem[];
    readonly exactHostIndex: ReadonlyMap<string, CompiledDomainAllowlistItem>;
    readonly registrableDomainIndex: ReadonlyMap<string, CompiledDomainAllowlistItem>;
}
interface CompiledDomainIntelSnapshot {
    readonly schemaVersion: string;
    readonly bundleVersion: string;
    readonly generatedAt: string;
    readonly publisher: string;
    readonly signingKeyId: string;
    readonly signature: string;
    readonly sections: {
        readonly maliciousDomains: CompiledMaliciousDomainsSection;
        readonly allowlists: CompiledDomainAllowlistsSection;
    };
}
interface DomainIntelCompileSuccess {
    readonly ok: true;
    readonly snapshot: CompiledDomainIntelSnapshot;
    readonly issues: readonly IntelValidationIssue[];
}
interface DomainIntelCompileFailure {
    readonly ok: false;
    readonly issues: readonly IntelValidationIssue[];
}
type DomainIntelCompileResult = DomainIntelCompileSuccess | DomainIntelCompileFailure;
interface DomainLookupResult {
    readonly lookupFamily: "domain";
    readonly matched: boolean;
    readonly disposition: DomainLookupDisposition;
    readonly matchType?: MaliciousDomainFeedItem["type"] | DomainAllowlistFeedItem["type"];
    readonly matchedSection?: DomainIntelSectionName;
    readonly matchedItemId?: string;
    readonly identity?: string;
    readonly feedVersion?: string;
    readonly allowlistFeedVersion?: string;
    readonly sectionState: Layer2SectionState;
    readonly degradedProtection: boolean;
}
interface DomainIntelSignatureEnvelope {
    readonly schemaVersion: string;
    readonly bundleVersion: string;
    readonly generatedAt: string;
    readonly publisher: string;
    readonly signingKeyId: string;
    readonly sections: Partial<Readonly<Record<DomainIntelSectionName, DomainIntelSectionMetadata>>>;
    readonly signature: string;
}
interface DomainIntelValidationOptions {
    readonly signatureVerifier: (envelope: DomainIntelSignatureEnvelope) => boolean;
}
interface CompileDomainIntelSnapshotOptions extends DomainIntelValidationOptions {
    readonly now?: Date | number | string;
}

declare function compileDomainIntelSnapshot(bundle: unknown, options: CompileDomainIntelSnapshotOptions): DomainIntelCompileResult;

declare function resolveDomainIntel(snapshot: CompiledDomainIntelSnapshot, input: string): DomainLookupResult;

declare function validateDomainIntelBundle(bundle: unknown, options: DomainIntelValidationOptions): DomainIntelValidationReport;

/**
 * Supported wallet chain families for Layer 4 reports.
 */
type WalletChain = "evm" | "solana" | "bitcoin";
/**
 * Shared scan depth requested for a wallet review.
 */
type WalletScanMode = "basic" | "full";
/**
 * Broad chain-agnostic exposure categories used across findings and factors.
 */
type WalletExposureCategory = "asset" | "authorization" | "counterparty" | "activity" | "recovery" | "operational" | "other";
/**
 * Coverage areas where the report can declare honest capability boundaries.
 */
type WalletCapabilityArea = "snapshot" | "finding" | "cleanup_plan" | "cleanup_execution";
/**
 * Shared support status used for capability and action availability reporting.
 */
type WalletCapabilityStatus = "supported" | "partial" | "not_supported";
/**
 * Lifecycle state for an individual wallet finding.
 */
type WalletFindingStatus = "open" | "mitigated" | "accepted";
/**
 * Broad cleanup action families that remain chain-agnostic.
 */
type WalletCleanupActionKind = "revoke_authorization" | "close_resource" | "move_assets" | "rotate_wallet" | "monitor_wallet" | "manual_review" | "other";
/**
 * Execution style for a cleanup action.
 */
type WalletCleanupExecutionMode = "automated" | "guided" | "manual";
/**
 * Readiness state for an individual cleanup action.
 */
type WalletCleanupActionStatus = "planned" | "ready" | "blocked" | "not_supported";
/**
 * Concrete execution mechanism expected for a cleanup action.
 */
type WalletCleanupExecutionType = "wallet_signature" | "manual_review";
/**
 * Shared cleanup target categories.
 */
type WalletCleanupTargetKind = "wallet" | "asset" | "authorization" | "counterparty" | "resource" | "activity" | "other";
/**
 * Aggregate execution status for a cleanup plan.
 */
type WalletCleanupExecutionStatus = "not_started" | "completed" | "partial" | "blocked" | "failed";
/**
 * Per-action execution state within a cleanup result.
 */
type WalletCleanupActionExecutionStatus = "pending" | "succeeded" | "failed" | "skipped" | "blocked";
/**
 * Caller-supplied request contract for a wallet scan.
 */
interface WalletScanRequest {
    /** Stable caller correlation identifier for the scan request. */
    readonly requestId: string;
    /** Chain family being evaluated. */
    readonly walletChain: WalletChain;
    /** Chain-specific wallet identifier, represented as an opaque string. */
    readonly walletAddress: string;
    /** Chain-agnostic network identifier such as "1" or "mainnet". */
    readonly networkId: string;
    /** Requested scan depth. */
    readonly scanMode: WalletScanMode;
    /** ISO-8601 timestamp describing when the request was created. */
    readonly requestedAt: string;
    /** Deterministic string metadata supplied by the caller. */
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Snapshot section metadata for a fully hydrated wallet snapshot.
 */
interface WalletSnapshotSection {
    /** Stable identifier for the snapshot section. */
    readonly sectionId: string;
    /** Opaque section type label for later chain-specific implementations. */
    readonly sectionType: string;
    /** Human-readable label for audit output. */
    readonly label: string;
    /** Number of records represented by this section. */
    readonly itemCount: number;
    /** Deterministic content hash for the section payload. */
    readonly contentHash: string;
    /** Deterministic metadata for the section. */
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Shared contract describing the wallet snapshot used for evaluation.
 */
interface WalletScanSnapshot {
    /** Stable snapshot identifier. */
    readonly snapshotId: string;
    /** Request identifier the snapshot belongs to. */
    readonly requestId: string;
    /** Chain family the snapshot was captured for. */
    readonly walletChain: WalletChain;
    /** Wallet identifier represented in the snapshot. */
    readonly walletAddress: string;
    /** Network scope the snapshot applies to. */
    readonly networkId: string;
    /** ISO-8601 timestamp describing when capture completed. */
    readonly capturedAt: string;
    /** Fully hydrated snapshot sections included in the evaluation payload. */
    readonly sections: readonly WalletSnapshotSection[];
    /** Deterministic snapshot metadata. */
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Reference to evidence used by a finding or execution result.
 */
interface WalletEvidenceRef {
    /** Stable evidence identifier. */
    readonly evidenceId: string;
    /** Source category for this evidence reference. */
    readonly sourceType: "snapshot_section" | "derived";
    /** Section or derived source identifier. */
    readonly sourceId: string;
    /** Human-readable audit label. */
    readonly label: string;
}
/**
 * Honest coverage statement describing what the report could or could not do.
 */
interface WalletCapabilityBoundary {
    /** Stable capability boundary identifier. */
    readonly boundaryId: string;
    /** Coverage area being described. */
    readonly area: WalletCapabilityArea;
    /** Stable capability key such as "cleanup_execution". */
    readonly capabilityKey: string;
    /** Support level for the named capability. */
    readonly status: WalletCapabilityStatus;
    /** Human-readable explanation of the current boundary. */
    readonly detail: string;
}
/**
 * Shared contract for an individual wallet finding.
 */
interface WalletFinding {
    /** Stable finding identifier. */
    readonly findingId: string;
    /** Chain family this finding belongs to. */
    readonly walletChain: WalletChain;
    /** Chain-agnostic exposure category. */
    readonly category: WalletExposureCategory;
    /** Severity assigned to the finding. */
    readonly riskLevel: RiskLevel;
    /** Finding lifecycle state. */
    readonly status: WalletFindingStatus;
    /** Short audit-friendly title. */
    readonly title: string;
    /** Human-readable summary of the issue. */
    readonly summary: string;
    /** ISO-8601 timestamp describing when the finding was produced. */
    readonly detectedAt: string;
    /** Related snapshot resources or opaque chain-specific identifiers. */
    readonly resourceIds: readonly string[];
    /** Linked risk factors. */
    readonly riskFactorIds: readonly string[];
    /** Linked cleanup actions. */
    readonly cleanupActionIds: readonly string[];
    /** Supporting evidence references. */
    readonly evidence: readonly WalletEvidenceRef[];
    /** Deterministic finding metadata. */
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Shared contract for a normalized wallet risk factor.
 */
interface WalletRiskFactor {
    /** Stable risk factor identifier. */
    readonly factorId: string;
    /** Chain family this factor belongs to. */
    readonly walletChain: WalletChain;
    /** Chain-agnostic exposure category. */
    readonly category: WalletExposureCategory;
    /** Severity assigned to the factor. */
    readonly riskLevel: RiskLevel;
    /** Audit-friendly factor title. */
    readonly title: string;
    /** Human-readable explanation of the factor. */
    readonly summary: string;
    /** Findings that contributed to this factor. */
    readonly findingIds: readonly string[];
    /** Related snapshot resources or opaque chain-specific identifiers. */
    readonly resourceIds: readonly string[];
    /** Deterministic factor metadata. */
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Score component used to explain how a wallet score was assembled.
 */
interface WalletScoreComponent {
    /** Stable score component identifier. */
    readonly componentId: string;
    /** Human-readable component label. */
    readonly label: string;
    /** Component points awarded within the 0-100 score model. */
    readonly score: number;
    /** Maximum component points within the 0-100 score model. */
    readonly maxScore: number;
    /** Severity implied by this score component. */
    readonly riskLevel: RiskLevel;
    /** Human-readable reason for the assigned points. */
    readonly rationale: string;
    /** Findings that contributed to this component. */
    readonly findingIds: readonly string[];
    /** Risk factors that contributed to this component. */
    readonly riskFactorIds: readonly string[];
}
/**
 * Deterministic score breakdown for a wallet report.
 */
interface WalletScoreBreakdown {
    /** Final wallet score in the inclusive 0-100 range. */
    readonly totalScore: number;
    /** Aggregate severity corresponding to the score. */
    readonly riskLevel: RiskLevel;
    /** Human-readable explanation of the overall score. */
    readonly rationale: string;
    /** Components that explain the score. */
    readonly components: readonly WalletScoreComponent[];
}
/**
 * Chain-agnostic target reference for a cleanup action.
 */
interface WalletCleanupTarget {
    /** Stable cleanup target identifier. */
    readonly targetId: string;
    /** Broad target kind for the action. */
    readonly targetKind: WalletCleanupTargetKind;
    /** Human-readable label for the target. */
    readonly label: string;
    /** Deterministic target metadata. */
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Shared contract for a cleanup or remediation action.
 */
interface WalletCleanupAction {
    /** Stable cleanup action identifier. */
    readonly actionId: string;
    /** Chain family this action belongs to. */
    readonly walletChain: WalletChain;
    /** Broad cleanup action kind. */
    readonly kind: WalletCleanupActionKind;
    /** How the action is expected to be carried out. */
    readonly executionMode: WalletCleanupExecutionMode;
    /** Concrete execution mechanism required for this action. */
    readonly executionType: WalletCleanupExecutionType;
    /** Current readiness state for this action. */
    readonly status: WalletCleanupActionStatus;
    /** Whether the action requires an external wallet signature. */
    readonly requiresSignature: boolean;
    /** Honest support level for the action in the current phase. */
    readonly supportStatus: WalletCapabilityStatus;
    /** Audit-friendly action title. */
    readonly title: string;
    /** Human-readable action description. */
    readonly description: string;
    /** Priority for this action using the shared risk ladder. */
    readonly priority: RiskLevel;
    /** Target reference for the action. */
    readonly target: WalletCleanupTarget;
    /** Findings this action addresses. */
    readonly findingIds: readonly string[];
    /** Risk factors this action addresses. */
    readonly riskFactorIds: readonly string[];
    /** Explanation when support is partial or unavailable. */
    readonly supportDetail: string | null;
    /** Deterministic action metadata. */
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Ordered cleanup plan generated from a wallet scan result.
 */
interface WalletCleanupPlan {
    /** Stable cleanup plan identifier. */
    readonly planId: string;
    /** Chain family the plan applies to. */
    readonly walletChain: WalletChain;
    /** Wallet identifier the plan applies to. */
    readonly walletAddress: string;
    /** Network scope the plan applies to. */
    readonly networkId: string;
    /** ISO-8601 timestamp describing when the plan was created. */
    readonly createdAt: string;
    /** Human-readable plan summary. */
    readonly summary: string;
    /** Ordered actions included in the plan. */
    readonly actions: readonly WalletCleanupAction[];
    /** Optional projected score after successful remediation, else null. */
    readonly projectedScore: number | null;
    /** Optional projected risk level after successful remediation, else null. */
    readonly projectedRiskLevel: RiskLevel | null;
}
/**
 * Per-action execution outcome captured for a cleanup plan.
 */
interface WalletCleanupActionResult {
    /** Cleanup action identifier. */
    readonly actionId: string;
    /** Execution status for the action. */
    readonly status: WalletCleanupActionExecutionStatus;
    /** ISO-8601 timestamp describing when the attempt finished, else null. */
    readonly executedAt: string | null;
    /** Human-readable execution detail. */
    readonly detail: string;
    /** Evidence references collected during execution. */
    readonly evidence: readonly WalletEvidenceRef[];
}
/**
 * Shared contract describing the outcome of cleanup execution.
 */
interface WalletCleanupExecutionResult {
    /** Cleanup plan identifier. */
    readonly planId: string;
    /** Chain family the execution result belongs to. */
    readonly walletChain: WalletChain;
    /** Wallet identifier the execution result belongs to. */
    readonly walletAddress: string;
    /** Network scope the execution result belongs to. */
    readonly networkId: string;
    /** Aggregate execution status for the plan. */
    readonly status: WalletCleanupExecutionStatus;
    /** ISO-8601 timestamp describing when execution started, else null. */
    readonly startedAt: string | null;
    /** ISO-8601 timestamp describing when execution completed, else null. */
    readonly completedAt: string | null;
    /** Per-action execution outcomes. */
    readonly actionResults: readonly WalletCleanupActionResult[];
}
/**
 * Aggregated result produced from evaluating a wallet snapshot.
 */
interface WalletScanResult {
    /** Request identifier that produced this result. */
    readonly requestId: string;
    /** Snapshot identifier used for evaluation. */
    readonly snapshotId: string;
    /** Chain family that was evaluated. */
    readonly walletChain: WalletChain;
    /** Wallet identifier that was evaluated. */
    readonly walletAddress: string;
    /** Network scope that was evaluated. */
    readonly networkId: string;
    /** ISO-8601 timestamp describing when evaluation completed. */
    readonly evaluatedAt: string;
    /** Findings produced by the scan. */
    readonly findings: readonly WalletFinding[];
    /** Normalized risk factors produced by the scan. */
    readonly riskFactors: readonly WalletRiskFactor[];
    /** Deterministic score explanation. */
    readonly scoreBreakdown: WalletScoreBreakdown;
    /** Ordered cleanup plan, if the phase produced one. */
    readonly cleanupPlan: WalletCleanupPlan | null;
    /** Honest capability boundaries for the current report. */
    readonly capabilityBoundaries: readonly WalletCapabilityBoundary[];
}
/**
 * High-level summary for wallet reporting and UI-agnostic consumption.
 */
interface WalletSummary {
    /** Chain family being summarized. */
    readonly walletChain: WalletChain;
    /** Wallet identifier being summarized. */
    readonly walletAddress: string;
    /** Network scope being summarized. */
    readonly networkId: string;
    /** Scan depth used for the report. */
    readonly scanMode: WalletScanMode;
    /** ISO-8601 timestamp describing when the summary was produced. */
    readonly generatedAt: string;
    /** Snapshot capture timestamp used in the report. */
    readonly snapshotCapturedAt: string;
    /** Final wallet score in the inclusive 0-100 range. */
    readonly score: number;
    /** Aggregate risk level for the wallet. */
    readonly riskLevel: RiskLevel;
    /** Total number of findings in the report. */
    readonly findingCount: number;
    /** Number of findings that remain open. */
    readonly openFindingCount: number;
    /** Number of cleanup actions available in the plan. */
    readonly cleanupActionCount: number;
    /** Number of findings with at least one linked cleanup action. */
    readonly actionableFindingCount: number;
}
/**
 * Final deterministic wallet report contract for Layer 4.
 */
interface WalletReport {
    /** Deterministic report identifier. */
    readonly reportId: string;
    /** Version of the shared Layer 4 report contract. */
    readonly reportVersion: string;
    /** ISO-8601 timestamp describing when the report was assembled. */
    readonly generatedAt: string;
    /** Original wallet scan request. */
    readonly request: WalletScanRequest;
    /** Snapshot used for evaluation. */
    readonly snapshot: WalletScanSnapshot;
    /** Scan result derived from the snapshot. */
    readonly result: WalletScanResult;
    /** High-level summary derived from the result. */
    readonly summary: WalletSummary;
    /** Cleanup execution outcome, if any execution occurred. */
    readonly cleanupExecution: WalletCleanupExecutionResult | null;
}

/**
 * Canonical input shape for deterministic wallet report identifier generation.
 */
interface WalletReportIdInput {
    /** Version of the shared report contract. */
    readonly reportVersion: WalletReport["reportVersion"];
    /** ISO-8601 timestamp describing when the report was assembled. */
    readonly generatedAt: WalletReport["generatedAt"];
    /** Original request included in the report. */
    readonly request: WalletScanRequest;
    /** Snapshot included in the report. */
    readonly snapshot: WalletScanSnapshot;
    /** Evaluation result included in the report. */
    readonly result: WalletScanResult;
    /** Summary included in the report. */
    readonly summary: WalletSummary;
    /** Cleanup execution outcome included in the report, if any. */
    readonly cleanupExecution: WalletCleanupExecutionResult | null;
}
/**
 * Builds a deterministic wallet report identifier from declared Layer 4 contract fields only.
 */
declare function buildWalletReportId(input: WalletReportIdInput): string;

/**
 * Supported EVM token standards evaluated by the Phase 4B scanner.
 */
type EvmTokenStandard = "erc20" | "erc721" | "erc1155";
/**
 * Stable approval shapes recognized by the Phase 4B scanner.
 */
type EvmApprovalKind = "erc20_allowance" | "erc721_token" | "erc721_operator" | "erc1155_operator";
/**
 * Deterministic counterparty disposition labels used after normalization.
 */
type EvmCounterpartyDisposition = "trusted" | "unknown" | "flagged";
/**
 * Contract exposure areas accepted in the hydrated EVM snapshot payload.
 */
type EvmContractExposureType = "token_contract" | "spender_contract" | "interaction_contract";
/**
 * Amount classification derived from a normalized approval record.
 */
type EvmApprovalAmountKind = "limited" | "unlimited" | "not_applicable";
/**
 * Raw approval-like record supplied to the Phase 4B EVM scanner.
 */
interface EvmApprovalRecordInput {
    readonly tokenStandard: EvmTokenStandard;
    readonly tokenAddress: string;
    readonly spenderAddress: string;
    readonly amount?: string | null;
    readonly tokenId?: string | null;
    readonly isApproved?: boolean | null;
    readonly approvedAt?: string | null;
    readonly sourceSectionId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Optional caller-supplied spender reputation input.
 */
interface EvmSpenderRiskInput {
    readonly spenderAddress: string;
    readonly trusted?: boolean;
    readonly riskLevel?: RiskLevel | null;
    readonly flags?: readonly string[];
    readonly label?: string | null;
    readonly sourceSectionId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Optional caller-supplied risky contract exposure input.
 */
interface EvmContractExposureInput {
    readonly contractAddress: string;
    readonly exposureType: EvmContractExposureType;
    readonly riskLevel?: RiskLevel | null;
    readonly flags?: readonly string[];
    readonly label?: string | null;
    readonly sourceSectionId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Fully hydrated EVM snapshot payload evaluated by the Phase 4B scanner.
 */
interface EvmWalletHydratedSnapshot {
    readonly approvals: readonly EvmApprovalRecordInput[];
    readonly spenders?: readonly EvmSpenderRiskInput[];
    readonly contractExposures?: readonly EvmContractExposureInput[];
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Normalized spender reputation record used during deterministic evaluation.
 */
interface NormalizedEvmSpenderRisk {
    readonly resourceId: string;
    readonly spenderAddress: string;
    readonly disposition: EvmCounterpartyDisposition;
    readonly riskLevel: RiskLevel | null;
    readonly flags: readonly string[];
    readonly label: string | null;
    readonly sourceSectionId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Normalized risky-contract record used during deterministic evaluation.
 */
interface NormalizedEvmContractExposure {
    readonly resourceId: string;
    readonly contractAddress: string;
    readonly exposureType: EvmContractExposureType;
    readonly riskLevel: RiskLevel | null;
    readonly flags: readonly string[];
    readonly label: string | null;
    readonly isRisky: boolean;
    readonly sourceSectionId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Normalized approval state evaluated by the Phase 4B scanner.
 */
interface NormalizedEvmApprovalState {
    readonly approvalId: string;
    readonly walletAddress: string;
    readonly tokenStandard: EvmTokenStandard;
    readonly approvalKind: EvmApprovalKind;
    readonly tokenAddress: string;
    readonly spenderAddress: string;
    readonly spenderDisposition: EvmCounterpartyDisposition;
    readonly spenderRiskLevel: RiskLevel | null;
    readonly spenderFlags: readonly string[];
    readonly amount: string | null;
    readonly amountKind: EvmApprovalAmountKind;
    readonly tokenId: string | null;
    readonly isUnlimited: boolean;
    readonly approvedAt: string | null;
    readonly ageDays: number | null;
    readonly isStale: boolean;
    readonly riskyContractExposureIds: readonly string[];
    readonly hasRiskyContractExposure: boolean;
    readonly sourceSectionId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Stable normalized EVM snapshot shape used across signals, rules, and scoring.
 */
interface NormalizedEvmWalletSnapshot {
    readonly walletAddress: string;
    readonly networkId: string;
    readonly capturedAt: string;
    readonly approvals: readonly NormalizedEvmApprovalState[];
    readonly spenders: readonly NormalizedEvmSpenderRisk[];
    readonly contractExposures: readonly NormalizedEvmContractExposure[];
}
/**
 * Pure wallet-exposure signals derived from a normalized EVM snapshot.
 */
interface EvmWalletSignals {
    readonly approvalCount: number;
    readonly erc20ApprovalCount: number;
    readonly erc721ApprovalCount: number;
    readonly erc1155ApprovalCount: number;
    readonly unlimitedApprovalCount: number;
    readonly unlimitedApprovalIds: readonly string[];
    readonly unknownUnlimitedApprovalCount: number;
    readonly unknownUnlimitedApprovalIds: readonly string[];
    readonly flaggedSpenderCount: number;
    readonly flaggedSpenderApprovalIds: readonly string[];
    readonly staleApprovalCount: number;
    readonly staleApprovalIds: readonly string[];
    readonly riskyContractExposureCount: number;
    readonly riskyContractExposureIds: readonly string[];
    readonly hasExcessiveApprovals: boolean;
}
/**
 * High-level input accepted by the exported Phase 4B EVM evaluator.
 */
interface EvmWalletScanEvaluationInput {
    readonly request: WalletScanRequest;
    readonly snapshot: WalletScanSnapshot;
    readonly hydratedSnapshot: EvmWalletHydratedSnapshot;
    readonly evaluatedAt: string;
    readonly reportVersion?: WalletReport["reportVersion"];
}
/**
 * Final deterministic Phase 4B evaluation surface for an EVM wallet snapshot.
 */
interface EvmWalletScanEvaluation {
    readonly score: number;
    readonly riskLevel: RiskLevel;
    readonly normalizedSnapshot: NormalizedEvmWalletSnapshot;
    readonly signals: EvmWalletSignals;
    readonly result: WalletScanResult;
    readonly summary: WalletSummary;
    readonly report: WalletReport;
}

/**
 * Evaluates a fully hydrated EVM wallet snapshot into deterministic Phase 4B report output.
 */
declare function evaluateEvmWalletScan(input: EvmWalletScanEvaluationInput): EvmWalletScanEvaluation;

/**
 * Authority kinds that can be represented in a hydrated Solana wallet snapshot.
 */
type SolanaAuthorityType = "account_owner" | "close_authority" | "freeze_authority" | "mint_authority" | "stake_staker" | "stake_withdrawer" | "upgrade_authority" | "other";
/**
 * Permission breadth labels accepted for Solana connection records.
 */
type SolanaPermissionLevel = "limited" | "broad";
/**
 * Raw token account exposure supplied to the Phase 4D Solana scanner.
 */
interface SolanaTokenAccountInput {
    readonly tokenAccountAddress: string;
    readonly mintAddress: string;
    readonly ownerAddress?: string | null;
    readonly balanceLamports?: string | null;
    readonly delegateAddress?: string | null;
    readonly delegateAmount?: string | null;
    readonly delegateRiskLevel?: RiskLevel | null;
    readonly delegateFlags?: readonly string[];
    readonly delegateLabel?: string | null;
    readonly closeAuthorityAddress?: string | null;
    readonly permanentDelegateAddress?: string | null;
    readonly sourceSectionId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Raw authority assignment supplied to the Phase 4D Solana scanner.
 */
interface SolanaAuthorityAssignmentInput {
    readonly subjectAddress: string;
    readonly authorityAddress: string;
    readonly authorityType: SolanaAuthorityType;
    readonly programAddress?: string | null;
    readonly riskLevel?: RiskLevel | null;
    readonly flags?: readonly string[];
    readonly label?: string | null;
    readonly sourceSectionId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Raw wallet connection or permission record supplied to the Phase 4D Solana scanner.
 */
interface SolanaConnectionRecordInput {
    readonly connectionId?: string | null;
    readonly appName?: string | null;
    readonly origin?: string | null;
    readonly permissions?: readonly string[];
    readonly permissionLevel?: SolanaPermissionLevel | null;
    readonly programAddresses?: readonly string[];
    readonly riskLevel?: RiskLevel | null;
    readonly flags?: readonly string[];
    readonly connectedAt?: string | null;
    readonly lastUsedAt?: string | null;
    readonly sourceSectionId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Raw risky-program summary supplied to the Phase 4D Solana scanner.
 */
interface SolanaProgramExposureInput {
    readonly programAddress: string;
    readonly label?: string | null;
    readonly riskLevel?: RiskLevel | null;
    readonly flags?: readonly string[];
    readonly interactionCount?: number | null;
    readonly lastInteractedAt?: string | null;
    readonly sourceSectionId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Fully hydrated Solana wallet snapshot payload evaluated by Phase 4D.
 */
interface SolanaWalletHydratedSnapshot {
    readonly tokenAccounts: readonly SolanaTokenAccountInput[];
    readonly authorityAssignments?: readonly SolanaAuthorityAssignmentInput[];
    readonly connections?: readonly SolanaConnectionRecordInput[];
    readonly programExposures?: readonly SolanaProgramExposureInput[];
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Normalized Solana token account state used during deterministic evaluation.
 */
interface NormalizedSolanaTokenAccountState {
    readonly resourceId: string;
    readonly tokenAccountAddress: string;
    readonly mintAddress: string;
    readonly ownerAddress: string | null;
    readonly balanceLamports: string | null;
    readonly delegateAddress: string | null;
    readonly delegateAmount: string | null;
    readonly delegateRiskLevel: RiskLevel | null;
    readonly delegateFlags: readonly string[];
    readonly delegateLabel: string | null;
    readonly hasDelegate: boolean;
    readonly isRiskyDelegate: boolean;
    readonly closeAuthorityAddress: string | null;
    readonly permanentDelegateAddress: string | null;
    readonly sourceSectionId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Normalized authority assignment used during deterministic evaluation.
 */
interface NormalizedSolanaAuthorityAssignment {
    readonly resourceId: string;
    readonly subjectAddress: string;
    readonly authorityAddress: string;
    readonly authorityType: SolanaAuthorityType;
    readonly programAddress: string | null;
    readonly riskLevel: RiskLevel | null;
    readonly flags: readonly string[];
    readonly label: string | null;
    readonly isRisky: boolean;
    readonly sourceSectionId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Normalized Solana connection record used during deterministic evaluation.
 */
interface NormalizedSolanaConnectionRecord {
    readonly resourceId: string;
    readonly connectionId: string | null;
    readonly appName: string | null;
    readonly origin: string | null;
    readonly permissions: readonly string[];
    readonly permissionLevel: SolanaPermissionLevel;
    readonly programAddresses: readonly string[];
    readonly riskLevel: RiskLevel | null;
    readonly flags: readonly string[];
    readonly connectedAt: string | null;
    readonly lastUsedAt: string | null;
    readonly connectedAgeDays: number | null;
    readonly lastUsedAgeDays: number | null;
    readonly isBroadPermission: boolean;
    readonly isRisky: boolean;
    readonly isStaleRisky: boolean;
    readonly sourceSectionId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Normalized Solana program exposure used during deterministic evaluation.
 */
interface NormalizedSolanaProgramExposure {
    readonly resourceId: string;
    readonly programAddress: string;
    readonly label: string | null;
    readonly riskLevel: RiskLevel | null;
    readonly flags: readonly string[];
    readonly interactionCount: number | null;
    readonly lastInteractedAt: string | null;
    readonly isSuspicious: boolean;
    readonly sourceSectionId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Stable normalized Solana snapshot shape used across Phase 4D evaluation steps.
 */
interface NormalizedSolanaWalletSnapshot {
    readonly walletAddress: string;
    readonly networkId: string;
    readonly capturedAt: string;
    readonly tokenAccounts: readonly NormalizedSolanaTokenAccountState[];
    readonly authorityAssignments: readonly NormalizedSolanaAuthorityAssignment[];
    readonly connections: readonly NormalizedSolanaConnectionRecord[];
    readonly programExposures: readonly NormalizedSolanaProgramExposure[];
}
/**
 * Pure Solana wallet signals derived from a normalized snapshot.
 */
interface SolanaWalletSignals {
    readonly tokenAccountCount: number;
    readonly delegateCount: number;
    readonly delegateIds: readonly string[];
    readonly riskyDelegateCount: number;
    readonly riskyDelegateIds: readonly string[];
    readonly authorityAssignmentCount: number;
    readonly riskyAuthorityAssignmentCount: number;
    readonly riskyAuthorityAssignmentIds: readonly string[];
    readonly broadPermissionCount: number;
    readonly broadPermissionConnectionIds: readonly string[];
    readonly riskyConnectionCount: number;
    readonly riskyConnectionIds: readonly string[];
    readonly staleRiskyConnectionCount: number;
    readonly staleRiskyConnectionIds: readonly string[];
    readonly suspiciousProgramCount: number;
    readonly suspiciousProgramIds: readonly string[];
}
/**
 * High-level input accepted by the exported Phase 4D Solana evaluator.
 */
interface SolanaWalletScanEvaluationInput {
    readonly request: WalletScanRequest;
    readonly snapshot: WalletScanSnapshot;
    readonly hydratedSnapshot: SolanaWalletHydratedSnapshot;
    readonly evaluatedAt: string;
    readonly reportVersion?: WalletReport["reportVersion"];
}
/**
 * Final deterministic Phase 4D evaluation surface for a Solana wallet snapshot.
 */
interface SolanaWalletScanEvaluation {
    readonly score: number;
    readonly riskLevel: RiskLevel;
    readonly normalizedSnapshot: NormalizedSolanaWalletSnapshot;
    readonly signals: SolanaWalletSignals;
    readonly result: WalletScanResult;
    readonly summary: WalletSummary;
    readonly report: WalletReport;
}

/**
 * Evaluates a fully hydrated Solana wallet snapshot into deterministic Phase 4D report output.
 */
declare function evaluateSolanaWalletScan(input: SolanaWalletScanEvaluationInput): SolanaWalletScanEvaluation;

/**
 * Address categories accepted in the hydrated Bitcoin wallet snapshot.
 */
type BitcoinAddressType = "legacy" | "nested_segwit" | "segwit" | "taproot" | "script" | "other";
/**
 * Wallet address roles accepted in the hydrated Bitcoin wallet snapshot.
 */
type BitcoinAddressRole = "receive" | "change" | "mixed" | "external" | "unknown";
/**
 * Hygiene issue categories accepted in the hydrated Bitcoin wallet snapshot.
 */
type BitcoinHygieneIssueType = "privacy_exposure" | "poor_hygiene" | "repeated_exposed_receive";
/**
 * Fragmentation levels emitted by the deterministic Bitcoin signal layer.
 */
type BitcoinFragmentationLevel = "low" | "medium" | "high";
/**
 * Concentration levels emitted by the deterministic Bitcoin signal layer.
 */
type BitcoinConcentrationLevel = "low" | "medium" | "high";
/**
 * Raw Bitcoin address summary supplied to the Phase 4E scanner.
 */
interface BitcoinAddressSummaryInput {
    readonly address: string;
    readonly addressType?: BitcoinAddressType | null;
    readonly role?: BitcoinAddressRole | null;
    readonly receivedSats?: string | null;
    readonly spentSats?: string | null;
    readonly balanceSats?: string | null;
    readonly receiveCount?: number | null;
    readonly spendCount?: number | null;
    readonly reuseCount?: number | null;
    readonly exposedPublicly?: boolean | null;
    readonly lastReceivedAt?: string | null;
    readonly lastSpentAt?: string | null;
    readonly sourceSectionId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Raw Bitcoin UTXO summary supplied to the Phase 4E scanner.
 */
interface BitcoinUtxoSummaryInput {
    readonly txid: string;
    readonly vout: number;
    readonly address: string;
    readonly valueSats: string;
    readonly confirmations?: number | null;
    readonly sourceSectionId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Raw hygiene or privacy observation supplied to the Phase 4E scanner.
 */
interface BitcoinHygieneRecordInput {
    readonly issueType: BitcoinHygieneIssueType;
    readonly address?: string | null;
    readonly count?: number | null;
    readonly riskLevel?: RiskLevel | null;
    readonly note?: string | null;
    readonly sourceSectionId?: string | null;
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Fully hydrated Bitcoin snapshot payload evaluated by Phase 4E.
 */
interface BitcoinWalletHydratedSnapshot {
    readonly addresses: readonly BitcoinAddressSummaryInput[];
    readonly utxos: readonly BitcoinUtxoSummaryInput[];
    readonly hygieneRecords?: readonly BitcoinHygieneRecordInput[];
    readonly metadata?: Readonly<Record<string, string>>;
}
/**
 * Normalized Bitcoin address summary used during deterministic evaluation.
 */
interface NormalizedBitcoinAddressSummary {
    readonly resourceId: string;
    readonly address: string;
    readonly addressType: BitcoinAddressType;
    readonly role: BitcoinAddressRole;
    readonly receivedSats: string | null;
    readonly spentSats: string | null;
    readonly balanceSats: string | null;
    readonly receiveCount: number;
    readonly spendCount: number;
    readonly reuseCount: number;
    readonly exposedPublicly: boolean;
    readonly hasReuse: boolean;
    readonly lastReceivedAt: string | null;
    readonly lastSpentAt: string | null;
    readonly sourceSectionId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Normalized Bitcoin UTXO summary used during deterministic evaluation.
 */
interface NormalizedBitcoinUtxoSummary {
    readonly resourceId: string;
    readonly txid: string;
    readonly vout: number;
    readonly address: string;
    readonly valueSats: string;
    readonly confirmations: number | null;
    readonly sourceSectionId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Normalized hygiene observation used during deterministic evaluation.
 */
interface NormalizedBitcoinHygieneRecord {
    readonly resourceId: string;
    readonly issueType: BitcoinHygieneIssueType;
    readonly address: string | null;
    readonly count: number;
    readonly riskLevel: RiskLevel;
    readonly note: string | null;
    readonly sourceSectionId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
}
/**
 * Stable normalized Bitcoin snapshot shape used across Phase 4E evaluation steps.
 */
interface NormalizedBitcoinWalletSnapshot {
    readonly walletAddress: string;
    readonly networkId: string;
    readonly capturedAt: string;
    readonly addresses: readonly NormalizedBitcoinAddressSummary[];
    readonly utxos: readonly NormalizedBitcoinUtxoSummary[];
    readonly hygieneRecords: readonly NormalizedBitcoinHygieneRecord[];
}
/**
 * Pure Bitcoin wallet signals derived from a normalized snapshot.
 */
interface BitcoinWalletSignals {
    readonly addressCount: number;
    readonly reusedAddressCount: number;
    readonly reusedAddressIds: readonly string[];
    readonly publiclyExposedAddressCount: number;
    readonly publiclyExposedAddressIds: readonly string[];
    readonly privacyExposureCount: number;
    readonly privacyExposureIds: readonly string[];
    readonly totalUtxoCount: number;
    readonly smallUtxoCount: number;
    readonly fragmentedUtxoIds: readonly string[];
    readonly fragmentationLevel: BitcoinFragmentationLevel;
    readonly concentrationLevel: BitcoinConcentrationLevel;
    readonly largestUtxoShareBasisPoints: number;
    readonly largestUtxoId: string | null;
    readonly poorHygieneCount: number;
    readonly poorHygieneIds: readonly string[];
    readonly exposedReceivingPatternCount: number;
    readonly exposedReceivingPatternIds: readonly string[];
}
/**
 * High-level input accepted by the exported Phase 4E Bitcoin evaluator.
 */
interface BitcoinWalletScanEvaluationInput {
    readonly request: WalletScanRequest;
    readonly snapshot: WalletScanSnapshot;
    readonly hydratedSnapshot: BitcoinWalletHydratedSnapshot;
    readonly evaluatedAt: string;
    readonly reportVersion?: WalletReport["reportVersion"];
}
/**
 * Final deterministic Phase 4E evaluation surface for a Bitcoin wallet snapshot.
 */
interface BitcoinWalletScanEvaluation {
    readonly score: number;
    readonly riskLevel: RiskLevel;
    readonly normalizedSnapshot: NormalizedBitcoinWalletSnapshot;
    readonly signals: BitcoinWalletSignals;
    readonly result: WalletScanResult;
    readonly summary: WalletSummary;
    readonly report: WalletReport;
}

/**
 * Evaluates a fully hydrated Bitcoin wallet snapshot into deterministic Phase 4E report output.
 */
declare function evaluateBitcoinWalletScan(input: BitcoinWalletScanEvaluationInput): BitcoinWalletScanEvaluation;

/**
 * Supported revoke methods for deterministic EVM cleanup preparation.
 */
type EvmCleanupRevocationMethod = "erc20_approve_zero" | "erc721_approve_zero" | "erc721_set_approval_for_all_false" | "erc1155_set_approval_for_all_false";
/**
 * Exact approval target represented by a cleanup action.
 */
interface EvmRevocableApprovalTarget {
    /** Stable approval identifier from normalized Phase 4B output. */
    readonly approvalId: string;
    /** Approval kind being revoked. */
    readonly approvalKind: EvmApprovalKind;
    /** Token contract that receives the revoke call. */
    readonly tokenAddress: string;
    /** Spender or operator that currently holds approval. */
    readonly spenderAddress: string;
    /** Token identifier for ERC-721 token approvals, else null. */
    readonly tokenId: string | null;
    /** Current approval state as represented in normalized input. */
    readonly currentState: string;
    /** Intended post-revoke state. */
    readonly intendedState: string;
}
/**
 * EVM-specific cleanup action with explicit revoke semantics.
 */
interface EvmCleanupAction extends WalletCleanupAction {
    /** Chain family this action belongs to. */
    readonly walletChain: "evm";
    /** Guided payload review remains the only supported execution mode. */
    readonly executionMode: "guided";
    /** Cleanup requires a wallet-signed transaction. */
    readonly executionType: "wallet_signature";
    /** Supported cleanup actions are ready for signature preparation. */
    readonly status: "ready";
    /** EVM revoke execution always requires a user signature. */
    readonly requiresSignature: true;
    /** Phase 4C supports deterministic revoke payload preparation. */
    readonly supportStatus: "supported";
    /** Exact revoke method that will be prepared. */
    readonly revocationMethod: EvmCleanupRevocationMethod;
    /** Exact approval target that will be revoked. */
    readonly approval: EvmRevocableApprovalTarget;
    /** Estimated risk reduction if the revoke later confirms on-chain. */
    readonly estimatedRiskReduction: RiskLevel;
    /** Human-readable explanation of the revoke effect. */
    readonly explanation: string;
}
/**
 * Honest logical batch grouping for reviewable EVM cleanup actions.
 */
interface EvmCleanupBatchPlan {
    /** Stable batch identifier. */
    readonly batchId: string;
    /** Chain family this batch belongs to. */
    readonly walletChain: "evm";
    /** Wallet identifier the batch applies to. */
    readonly walletAddress: string;
    /** Network scope the batch applies to. */
    readonly networkId: string;
    /** ISO-8601 timestamp when the batch was assembled. */
    readonly createdAt: string;
    /** Honest support level for executing the selected batch. */
    readonly supportStatus: WalletCapabilityStatus;
    /** Honest batch execution packaging model. */
    readonly executionKind: "multiple_transactions";
    /** Audit-friendly batch title. */
    readonly title: string;
    /** Human-readable batch summary. */
    readonly summary: string;
    /** Ordered action identifiers included in the batch. */
    readonly actionIds: readonly string[];
    /** Ordered actions included in the batch. */
    readonly actions: readonly EvmCleanupAction[];
}
/**
 * EVM cleanup plan produced from normalized approvals and findings.
 */
interface EvmWalletCleanupPlan extends WalletCleanupPlan {
    /** Chain family this plan belongs to. */
    readonly walletChain: "evm";
    /** Ordered EVM revoke actions. */
    readonly actions: readonly EvmCleanupAction[];
    /** Deterministic logical batch groupings for review. */
    readonly batches: readonly EvmCleanupBatchPlan[];
}
/**
 * Eligibility decision for whether a normalized approval may produce a revoke.
 */
interface EvmCleanupEligibility {
    /** Whether the approval can safely produce a cleanup action. */
    readonly eligible: boolean;
    /** Stable reason code describing the eligibility decision. */
    readonly reasonCode: "supported" | "inactive" | "missing_amount" | "missing_token_id" | "unsupported_approval_kind";
    /** Revoke method selected for supported approvals, else null. */
    readonly revocationMethod: EvmCleanupRevocationMethod | null;
    /** Honest support level for the decision. */
    readonly supportStatus: WalletCapabilityStatus;
    /** Human-readable explanation of the decision. */
    readonly detail: string;
}
/**
 * Prepared EVM transaction argument included in a reviewable revoke payload.
 */
interface EvmPreparedCleanupArgument {
    /** ABI parameter name. */
    readonly name: string;
    /** Solidity parameter type. */
    readonly type: "address" | "uint256" | "bool";
    /** Canonical string value supplied to the payload. */
    readonly value: string;
}
/**
 * Deterministic revoke transaction payload prepared for explicit user review.
 */
interface EvmPreparedCleanupTransaction {
    /** Stable prepared transaction identifier. */
    readonly transactionId: string;
    /** Cleanup action identifier this payload belongs to. */
    readonly actionId: string;
    /** Chain family this payload belongs to. */
    readonly walletChain: "evm";
    /** Network scope this payload belongs to. */
    readonly networkId: string;
    /** Wallet that must sign the payload. */
    readonly walletAddress: string;
    /** Target contract that receives the call, else null when unsupported. */
    readonly to: string | null;
    /** Native value attached to the transaction. */
    readonly value: "0x0";
    /** ABI-encoded calldata, else null when unsupported. */
    readonly data: string | null;
    /** Prepared function name, else null when unsupported. */
    readonly functionName: "approve" | "setApprovalForAll" | null;
    /** Prepared 4-byte selector, else null when unsupported. */
    readonly methodSelector: string | null;
    /** Ordered ABI arguments. */
    readonly args: readonly EvmPreparedCleanupArgument[];
    /** Approval kind the payload revokes. */
    readonly approvalKind: EvmApprovalKind;
    /** Revoke method the payload applies. */
    readonly revocationMethod: EvmCleanupRevocationMethod;
    /** Intended post-revoke approval state. */
    readonly intendedState: string;
    /** Whether the payload contains every required transaction field. */
    readonly executable: boolean;
    /** Honest support level for this payload. */
    readonly supportStatus: WalletCapabilityStatus;
    /** Human-readable explanation when support is partial or unavailable. */
    readonly supportDetail: string | null;
}
/**
 * Explicit user selection shape for prepared EVM cleanup execution.
 */
type EvmCleanupSelectionKind = "single_action" | "batch_actions";
/**
 * Honest packaging model for explicit cleanup execution preparation.
 */
type EvmCleanupPackaging = "single_transaction" | "multiple_transactions" | "not_supported";
/**
 * Request contract representing explicit user-selected cleanup preparation.
 */
interface EvmCleanupExecutionRequest {
    /** Stable execution request identifier. */
    readonly requestId: string;
    /** Cleanup plan identifier this request belongs to. */
    readonly planId: string;
    /** Chain family this request belongs to. */
    readonly walletChain: "evm";
    /** Wallet that must sign the request payloads. */
    readonly walletAddress: string;
    /** Network scope this request belongs to. */
    readonly networkId: string;
    /** ISO-8601 timestamp when the request was prepared. */
    readonly createdAt: string;
    /** Whether the request targets one action or multiple actions. */
    readonly selectionKind: EvmCleanupSelectionKind;
    /** Honest packaging model for the prepared payloads. */
    readonly packaging: EvmCleanupPackaging;
    /** Ordered action identifiers selected by the caller. */
    readonly actionIds: readonly string[];
    /** Ordered prepared transactions for explicit review. */
    readonly preparedTransactions: readonly EvmPreparedCleanupTransaction[];
    /** EVM cleanup always requires a wallet signature. */
    readonly requiresSignature: true;
    /** Honest support level for the prepared request. */
    readonly supportStatus: WalletCapabilityStatus;
    /** Human-readable explanation of the packaging boundary. */
    readonly supportDetail: string | null;
}
/**
 * Stable execution status values for externally signed cleanup attempts.
 */
type EvmCleanupExecutionStatus = "pending_signature" | "submitted" | "confirmed" | "failed" | "rejected" | "unknown";
/**
 * Deterministic result contract for one cleanup action execution attempt.
 */
interface EvmCleanupActionExecutionResult {
    /** Cleanup action identifier. */
    readonly actionId: string;
    /** Normalized external execution status. */
    readonly status: EvmCleanupExecutionStatus;
    /** Transaction hash when available, else null. */
    readonly txHash: string | null;
    /** Stable error code when available, else null. */
    readonly errorCode: string | null;
    /** Human-readable error message when available, else null. */
    readonly errorMessage: string | null;
    /** Whether later re-scan is required before claiming remediation. */
    readonly requiresRescan: boolean;
    /** Finalization timestamp when available, else null. */
    readonly finalizedAt: string | null;
}
/**
 * Minimal rescan snapshot used to compare confirmed execution with later state.
 */
interface EvmCleanupRescanSnapshot {
    /** Chain family this rescan belongs to. */
    readonly walletChain: "evm";
    /** Wallet that was rescanned. */
    readonly walletAddress: string;
    /** Network scope that was rescanned. */
    readonly networkId: string;
    /** ISO-8601 timestamp when the re-scan completed. */
    readonly rescannedAt: string;
    /** Active approval identifiers still present after re-scan. */
    readonly activeApprovalIds: readonly string[];
}
/**
 * Re-scan comparison status for a cleanup action.
 */
type EvmCleanupRescanStatus = "not_requested" | "cleared" | "still_active";
/**
 * Reconciliation item tying an action to execution and later re-scan state.
 */
interface EvmCleanupReconciliationItem {
    /** Cleanup action identifier. */
    readonly actionId: string;
    /** Approval identifier the action targets. */
    readonly approvalId: string;
    /** Execution status recorded for the action. */
    readonly executionStatus: EvmCleanupExecutionStatus;
    /** Re-scan comparison status for the targeted approval. */
    readonly rescanStatus: EvmCleanupRescanStatus;
    /** Findings linked to the action. */
    readonly findingIds: readonly string[];
    /** Transaction hash when available, else null. */
    readonly txHash: string | null;
    /** Whether another re-scan is still required. */
    readonly requiresRescan: boolean;
}
/**
 * Summary view for later comparing plan actions, execution results, and re-scan output.
 */
interface EvmCleanupReconciliationSummary {
    /** Cleanup plan identifier. */
    readonly planId: string;
    /** Chain family this reconciliation belongs to. */
    readonly walletChain: "evm";
    /** Wallet identifier this reconciliation belongs to. */
    readonly walletAddress: string;
    /** Network scope this reconciliation belongs to. */
    readonly networkId: string;
    /** Whether any action still requires a re-scan before remediation can be claimed. */
    readonly requiresRescan: boolean;
    /** Whether the supplied re-scan snapshot matched the cleanup plan context. */
    readonly rescanSnapshotAccepted: boolean;
    /** Explicit mismatch reason when a supplied re-scan snapshot was rejected. */
    readonly rescanMismatchReason: "wallet_chain_mismatch" | "wallet_address_mismatch" | "network_id_mismatch" | null;
    /** Confirmed action identifiers recorded so far. */
    readonly confirmedActionIds: readonly string[];
    /** Action identifiers that remain unresolved after reconciliation. */
    readonly outstandingActionIds: readonly string[];
    /** Per-action reconciliation items. */
    readonly items: readonly EvmCleanupReconciliationItem[];
    /** Re-scan snapshot used for comparison, else null. */
    readonly rescanSnapshot: EvmCleanupRescanSnapshot | null;
}

/**
 * Evaluates whether a normalized approval can safely produce a Phase 4C cleanup action.
 */
declare function getEvmCleanupEligibility(approval: NormalizedEvmApprovalState): EvmCleanupEligibility;

/**
 * Builds the deterministic EVM cleanup plan for Phase 4C revoke preparation.
 */
declare function buildEvmCleanupPlan(walletAddress: string, networkId: string, evaluatedAt: string, approvals: readonly NormalizedEvmApprovalState[], findings: readonly WalletFinding[], riskFactors: readonly WalletRiskFactor[]): {
    readonly cleanupPlan: EvmWalletCleanupPlan | null;
    readonly actionIdsByFindingId: Readonly<Record<string, readonly string[]>>;
};

/**
 * Prepares a single EVM revoke payload for explicit user-selected review.
 */
declare function prepareEvmCleanupTransaction(action: EvmCleanupAction, walletAddress: string, networkId: string): EvmPreparedCleanupTransaction;
/**
 * Prepares an explicit cleanup execution request for one or more selected EVM revoke actions.
 */
declare function prepareEvmCleanupExecutionRequest(plan: EvmWalletCleanupPlan, actionIds: readonly string[], createdAt: string): EvmCleanupExecutionRequest;

/**
 * Normalizes externally supplied cleanup execution status into a deterministic action result.
 */
declare function interpretEvmCleanupExecutionResult(input: {
    /** Cleanup action identifier. */
    readonly actionId: string;
    /** External execution status to normalize. */
    readonly status: EvmCleanupExecutionStatus;
    /** Transaction hash when available. */
    readonly txHash?: string | null;
    /** Stable error code when available. */
    readonly errorCode?: string | null;
    /** Human-readable error message when available. */
    readonly errorMessage?: string | null;
    /** Finalization timestamp when available. */
    readonly finalizedAt?: string | null;
}): EvmCleanupActionExecutionResult;
/**
 * Reconciles a cleanup plan against recorded execution results and an optional later re-scan snapshot.
 */
declare function reconcileEvmCleanupPlanResults(plan: EvmWalletCleanupPlan, results: readonly EvmCleanupActionExecutionResult[], rescanSnapshot?: EvmCleanupRescanSnapshot | null): EvmCleanupReconciliationSummary;

export { type ApprovalAmountKind, type ApprovalDirection, type ApprovalScope, type BitcoinAddressRole, type BitcoinAddressSummaryInput, type BitcoinAddressType, type BitcoinConcentrationLevel, type BitcoinFragmentationLevel, type BitcoinHygieneIssueType, type BitcoinHygieneRecordInput, type BitcoinUtxoSummaryInput, type BitcoinWalletHydratedSnapshot, type BitcoinWalletScanEvaluation, type BitcoinWalletScanEvaluationInput, type BitcoinWalletSignals, type BuildContextOptions, type CanonicalTransactionIntelLookup, type CanonicalTransactionIntelLookupResult, type CanonicalTransactionSnapshotSectionState, type ChainFamily, type CompileDomainIntelSnapshotOptions, type CompiledDomainAllowlistItem, type CompiledDomainAllowlistsSection, type CompiledDomainIntelSnapshot, type CompiledMaliciousDomainItem, type CompiledMaliciousDomainsSection, type DecodedTransactionAction, type DomainAllowlistFeedItem, type DomainAllowlistsSection, type DomainContext, type DomainIntelBundle, type DomainIntelCompileFailure, type DomainIntelCompileResult, type DomainIntelCompileSuccess, type DomainIntelSectionMetadata, type DomainIntelSectionName, type DomainIntelSectionValidationReport, type DomainIntelSignatureEnvelope, type DomainIntelValidationOptions, type DomainIntelValidationReport, type DomainLookupDisposition, type DomainLookupResult, type EngineResult, type EvmApprovalAmountKind, type EvmApprovalKind, type EvmApprovalRecordInput, type EvmCleanupAction, type EvmCleanupActionExecutionResult, type EvmCleanupBatchPlan, type EvmCleanupEligibility, type EvmCleanupExecutionRequest, type EvmCleanupExecutionStatus, type EvmCleanupPackaging, type EvmCleanupReconciliationItem, type EvmCleanupReconciliationSummary, type EvmCleanupRescanSnapshot, type EvmCleanupRescanStatus, type EvmCleanupRevocationMethod, type EvmCleanupSelectionKind, type EvmContractExposureInput, type EvmContractExposureType, type EvmCounterpartyDisposition, type EvmPreparedCleanupArgument, type EvmPreparedCleanupTransaction, type EvmRevocableApprovalTarget, type EvmTokenStandard, type EvmWalletCleanupPlan, type EvmWalletHydratedSnapshot, type EvmWalletScanEvaluation, type EvmWalletScanEvaluationInput, type EvmWalletSignals, type IntelValidationIssue, KNOWN_PROTOCOL_DOMAINS, type Layer2SectionState, type Layer3RpcMethod, type MaliciousDomainFeedItem, type MaliciousDomainsSection, type NavigationContext, type NavigationInput, type NormalizedBitcoinAddressSummary, type NormalizedBitcoinHygieneRecord, type NormalizedBitcoinUtxoSummary, type NormalizedBitcoinWalletSnapshot, type NormalizedEvmApprovalState, type NormalizedEvmContractExposure, type NormalizedEvmSpenderRisk, type NormalizedEvmWalletSnapshot, type NormalizedSolanaAuthorityAssignment, type NormalizedSolanaConnectionRecord, type NormalizedSolanaProgramExposure, type NormalizedSolanaTokenAccountState, type NormalizedSolanaWalletSnapshot, type NormalizedTransactionContext, type NormalizedTypedData, PHISHING_CODES, type PermitKind, type PhishingCode, RULE_SET_VERSION, type RawSignatureRequest, type RawTransactionRequest, type RawTypedDataPayload, type ReasonMessage, type RiskLevel, type RuleOutcome, SUSPICIOUS_TLDS, type SignatureInput, type SignatureRpcMethod, type SolanaAuthorityAssignmentInput, type SolanaAuthorityType, type SolanaConnectionRecordInput, type SolanaPermissionLevel, type SolanaProgramExposureInput, type SolanaTokenAccountInput, type SolanaWalletHydratedSnapshot, type SolanaWalletScanEvaluation, type SolanaWalletScanEvaluationInput, type SolanaWalletSignals, TRANSACTION_SELECTOR_REGISTRY, type TransactionActionType, type TransactionBatchContext, type TransactionCounterpartyContext, type TransactionEvaluationResult, type TransactionEventKind, type TransactionExplanation, type TransactionInput, type TransactionIntelContext, type TransactionIntelDisposition, type TransactionIntelLookupDisposition, type TransactionIntelProvider, type TransactionIntelVersions, type TransactionLayer2MaliciousContract, type Layer2SectionState$1 as TransactionLayer2SectionState, type TransactionLayer2Snapshot, type TransactionLayer2SnapshotValidationIssue, type Layer3RpcMethod as TransactionLayer3RpcMethod, type TransactionMaliciousContractLookup, type TransactionMaliciousContractLookupResult, type TransactionMeta, type TransactionOverrideLevel, type TransactionParamValue, type TransactionProviderContext, type TransactionRpcMethod, type TransactionScamSignatureLookup, type TransactionScamSignatureLookupResult, type TransactionSelectorDefinition, type TransactionSignals, type TransactionVerdict, type TransactionVerdictStatus, type TrustedTransactionOriginIntel, type TypedDataField, type TypedDataNormalizationState, type TypedDataTypes, type TypedDataValue, type ValidateTransactionLayer2SnapshotFailure, type ValidateTransactionLayer2SnapshotResult, type ValidateTransactionLayer2SnapshotSuccess, type ValidatedTransactionLayer2Snapshot, type Verdict, type WalletCapabilityArea, type WalletCapabilityBoundary, type WalletCapabilityStatus, type WalletChain, type WalletCleanupAction, type WalletCleanupActionExecutionStatus, type WalletCleanupActionKind, type WalletCleanupActionResult, type WalletCleanupActionStatus, type WalletCleanupExecutionMode, type WalletCleanupExecutionResult, type WalletCleanupExecutionStatus, type WalletCleanupExecutionType, type WalletCleanupPlan, type WalletCleanupTarget, type WalletCleanupTargetKind, type WalletEvidenceRef, type WalletExposureCategory, type WalletFinding, type WalletFindingStatus, type WalletProviderMetadata, type WalletReport, type WalletReportIdInput, type WalletRiskFactor, type WalletScanMode, type WalletScanRequest, type WalletScanResult, type WalletScanSnapshot, type WalletScoreBreakdown, type WalletScoreComponent, type WalletSnapshotSection, type WalletSummary, buildEvmCleanupPlan, buildNavigationContext, buildTransactionExplanation, buildTransactionSignals, buildWalletReportId, classifyPermitKind, classifyTransactionSelector, compileDomainIntelSnapshot, containsAirdropKeyword, containsMintKeyword, containsWalletConnectPattern, contextToInput, createTransactionIntelProvider, decodeTransactionCalldata, deconfuseHostname, domainSimilarityScore, evaluate, evaluateBitcoinWalletScan, evaluateEvmWalletScan, evaluateSolanaWalletScan, evaluateTransaction, extractHostname, extractRegistrableDomain, extractTld, getDefaultTransactionIntelProvider, getEvmCleanupEligibility, getReasonMessage, getTransactionSelectorDefinition, getVerdictTitle, hasHomoglyphs, hasSuspiciousTld, interpretEvmCleanupExecutionResult, isIpHost, isKnownMaliciousDomain, isNewDomain, isValidUrl, listTransactionSelectors, looksLikeProtocolImpersonation, matchedLureKeywords, normalizeTransactionRequest, normalizeTypedData, normalizeTypedDataRequest, normalizeUrl, prepareEvmCleanupExecutionRequest, prepareEvmCleanupTransaction, reconcileEvmCleanupPlanResults, resolveCanonicalTransactionIntel, resolveDomainIntel, riskBadgeLabel, validateDomainIntelBundle, validateTransactionLayer2Snapshot };
