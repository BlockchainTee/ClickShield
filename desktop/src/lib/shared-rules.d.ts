// GENERATED FILE - sourced from packages/shared-rules/dist/index.d.ts via npm run sync:surfaces.
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

export { type BuildContextOptions, type CompileDomainIntelSnapshotOptions, type CompiledDomainAllowlistItem, type CompiledDomainAllowlistsSection, type CompiledDomainIntelSnapshot, type CompiledMaliciousDomainItem, type CompiledMaliciousDomainsSection, type DomainAllowlistFeedItem, type DomainAllowlistsSection, type DomainContext, type DomainIntelBundle, type DomainIntelCompileFailure, type DomainIntelCompileResult, type DomainIntelCompileSuccess, type DomainIntelSectionMetadata, type DomainIntelSectionName, type DomainIntelSectionValidationReport, type DomainIntelSignatureEnvelope, type DomainIntelValidationOptions, type DomainIntelValidationReport, type DomainLookupDisposition, type DomainLookupResult, type EngineResult, type IntelValidationIssue, KNOWN_PROTOCOL_DOMAINS, type Layer2SectionState, type MaliciousDomainFeedItem, type MaliciousDomainsSection, type NavigationContext, type NavigationInput, PHISHING_CODES, type PhishingCode, RULE_SET_VERSION, type ReasonMessage, type RiskLevel, type RuleOutcome, SUSPICIOUS_TLDS, type Verdict, buildNavigationContext, compileDomainIntelSnapshot, containsAirdropKeyword, containsMintKeyword, containsWalletConnectPattern, contextToInput, deconfuseHostname, domainSimilarityScore, evaluate, extractHostname, extractRegistrableDomain, extractTld, getReasonMessage, getVerdictTitle, hasHomoglyphs, hasSuspiciousTld, isIpHost, isKnownMaliciousDomain, isNewDomain, isValidUrl, looksLikeProtocolImpersonation, matchedLureKeywords, normalizeUrl, resolveDomainIntel, riskBadgeLabel, validateDomainIntelBundle };
