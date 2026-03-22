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

declare function decodeTransactionCalldata(calldata: string, toAddress?: string | null): {
    readonly decoded: DecodedTransactionAction;
    readonly batch: TransactionBatchContext;
};
declare function normalizeTransactionRequest(input: RawTransactionRequest): NormalizedTransactionContext;
declare function normalizeTypedDataRequest(input: RawSignatureRequest): NormalizedTransactionContext;

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

export { type ApprovalAmountKind, type ApprovalDirection, type ApprovalScope, type BuildContextOptions, type ChainFamily, type CompileDomainIntelSnapshotOptions, type CompiledDomainAllowlistItem, type CompiledDomainAllowlistsSection, type CompiledDomainIntelSnapshot, type CompiledMaliciousDomainItem, type CompiledMaliciousDomainsSection, type DecodedTransactionAction, type DomainAllowlistFeedItem, type DomainAllowlistsSection, type DomainContext, type DomainIntelBundle, type DomainIntelCompileFailure, type DomainIntelCompileResult, type DomainIntelCompileSuccess, type DomainIntelSectionMetadata, type DomainIntelSectionName, type DomainIntelSectionValidationReport, type DomainIntelSignatureEnvelope, type DomainIntelValidationOptions, type DomainIntelValidationReport, type DomainLookupDisposition, type DomainLookupResult, type EngineResult, type IntelValidationIssue, KNOWN_PROTOCOL_DOMAINS, type Layer2SectionState, type Layer3RpcMethod, type MaliciousDomainFeedItem, type MaliciousDomainsSection, type NavigationContext, type NavigationInput, type NormalizedTransactionContext, type NormalizedTypedData, PHISHING_CODES, type PermitKind, type PhishingCode, RULE_SET_VERSION, type RawSignatureRequest, type RawTransactionRequest, type RawTypedDataPayload, type ReasonMessage, type RiskLevel, type RuleOutcome, SUSPICIOUS_TLDS, type SignatureInput, type SignatureRpcMethod, TRANSACTION_SELECTOR_REGISTRY, type TransactionActionType, type TransactionBatchContext, type TransactionCounterpartyContext, type TransactionEvaluationResult, type TransactionEventKind, type TransactionExplanation, type TransactionInput, type TransactionIntelContext, type TransactionIntelDisposition, type TransactionIntelVersions, type Layer2SectionState$1 as TransactionLayer2SectionState, type Layer3RpcMethod as TransactionLayer3RpcMethod, type TransactionMeta, type TransactionOverrideLevel, type TransactionParamValue, type TransactionProviderContext, type TransactionRpcMethod, type TransactionSelectorDefinition, type TransactionSignals, type TransactionVerdict, type TransactionVerdictStatus, type TypedDataField, type TypedDataNormalizationState, type TypedDataTypes, type TypedDataValue, type Verdict, type WalletProviderMetadata, buildNavigationContext, buildTransactionExplanation, buildTransactionSignals, classifyPermitKind, classifyTransactionSelector, compileDomainIntelSnapshot, containsAirdropKeyword, containsMintKeyword, containsWalletConnectPattern, contextToInput, decodeTransactionCalldata, deconfuseHostname, domainSimilarityScore, evaluate, evaluateTransaction, extractHostname, extractRegistrableDomain, extractTld, getReasonMessage, getTransactionSelectorDefinition, getVerdictTitle, hasHomoglyphs, hasSuspiciousTld, isIpHost, isKnownMaliciousDomain, isNewDomain, isValidUrl, listTransactionSelectors, looksLikeProtocolImpersonation, matchedLureKeywords, normalizeTransactionRequest, normalizeTypedData, normalizeTypedDataRequest, normalizeUrl, resolveDomainIntel, riskBadgeLabel, validateDomainIntelBundle };
