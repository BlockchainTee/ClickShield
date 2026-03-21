/**
 * Discriminator for event categories the engine handles.
 */
export type EventKind =
  | "navigation"
  | "transaction"
  | "signature"
  | "wallet_scan"
  | "download"
  | "clipboard";

/**
 * Risk severity levels, ordered from least to most severe.
 */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/**
 * Outcome when a rule matches an input.
 */
export type RuleOutcome = "allow" | "warn" | "block";

/**
 * Generic rule interface. Each rule targets a specific event kind
 * and receives the corresponding typed context.
 *
 * @typeParam TContext - The input type this rule evaluates.
 */
export interface Rule<TContext> {
  /** Unique rule identifier (e.g., "PHISH_IMPERSONATION_NEW_DOMAIN"). */
  readonly id: string;
  /** Human-readable rule name. */
  readonly name: string;
  /** Which event kind this rule applies to. */
  readonly eventKind: EventKind;
  /** Severity assigned when this rule matches. */
  readonly severity: RiskLevel;
  /** Action to take when this rule matches. */
  readonly outcome: RuleOutcome;
  /** Lower number = stronger priority. A rule at priority 5 always wins over priority 10. */
  readonly priority: number;
  /** Pure, synchronous predicate. Returns true if the rule matches. */
  readonly predicate: (ctx: TContext) => boolean;
  /** Build the list of reason codes when this rule fires. */
  readonly buildReasonCodes: (ctx: TContext) => string[];
  /** Optionally build structured evidence when this rule fires. */
  readonly buildEvidence?: (ctx: TContext) => Record<string, unknown>;
}

/**
 * The final verdict after all rules have been evaluated.
 */
export interface Verdict {
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
export interface EngineResult {
  /** The assembled verdict. */
  readonly verdict: Verdict;
  /** IDs of all rules that matched (convenience duplicate of verdict.matchedRules). */
  readonly matchedRules: string[];
  /** Aggregated reason codes (convenience duplicate of verdict.reasonCodes). */
  readonly reasonCodes: string[];
  /** Merged evidence (convenience duplicate of verdict.evidence). */
  readonly evidence: Record<string, unknown>;
}

// ── Domain context (passed in by caller, never fetched) ──

/**
 * External domain context data. Must be preloaded before calling evaluate().
 */
export interface DomainContext {
  /** Domain age in hours. Null if unknown. */
  readonly ageHours: number | null;
  /** Whether this domain appears in a known-malicious feed. */
  readonly isKnownMalicious: boolean;
}

// ── Input types (discriminated union on eventKind) ──

/** Input for URL navigation events. */
export interface NavigationInput {
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

/** Input for transaction signing events. */
export interface TransactionInput {
  readonly eventKind: "transaction";
  /** Hex-encoded calldata (e.g., "0x095ea7b3..."). */
  readonly calldata: string;
  /** Target contract address. */
  readonly toAddress: string;
  /** Spender address (for approvals). Empty string if not applicable. */
  readonly spenderAddress: string;
  /** Value in wei (as string to avoid bigint in types). */
  readonly value: string;
  /** Chain ID. */
  readonly chainId: number;
}

/** Input for signature request events (EIP-712 typed data, personal_sign, etc.). */
export interface SignatureInput {
  readonly eventKind: "signature";
  /** Raw message to sign (hex or plaintext). */
  readonly message: string;
  /** EIP-712 typed data JSON string, or empty if not typed. */
  readonly typedData: string;
  /** Origin domain requesting the signature. */
  readonly origin: string;
  /** Chain ID. */
  readonly chainId: number;
}

/** Input for wallet review/scan events. */
export interface WalletScanInput {
  readonly eventKind: "wallet_scan";
  /** Wallet address being reviewed. */
  readonly walletAddress: string;
  /** Chain ID. */
  readonly chainId: number;
}

/** Input for download events. */
export interface DownloadInput {
  readonly eventKind: "download";
  /** Filename including extension. */
  readonly filename: string;
  /** MIME type if known. */
  readonly mimeType: string;
  /** File size in bytes. */
  readonly sizeBytes: number;
  /** SHA-256 hash of file content, hex-encoded. Empty string if not yet computed. */
  readonly sha256: string;
  /** Download source URL. */
  readonly sourceUrl: string;
}

/** Input for clipboard monitoring events. */
export interface ClipboardInput {
  readonly eventKind: "clipboard";
  /** Clipboard content. */
  readonly content: string;
  /** Content type (e.g., "text/plain", "text/html"). */
  readonly contentType: string;
  /** Origin domain the content came from, if known. */
  readonly sourceOrigin: string;
}

/**
 * Discriminated union of all engine inputs.
 * The eventKind field narrows the type in evaluate().
 */
export type EngineInput =
  | NavigationInput
  | TransactionInput
  | SignatureInput
  | WalletScanInput
  | DownloadInput
  | ClipboardInput;

// ── NavigationContext — rich client-side context shape ──

/**
 * Rich navigation context built by clients before calling evaluate().
 * Clients build this from browser/webview navigation events,
 * then map it to NavigationInput for the engine.
 */
export interface NavigationContext {
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
