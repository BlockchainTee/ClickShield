import type {
  NormalizedTransactionContext,
  TransactionExplanation,
  TransactionRiskClassification,
  TransactionSignals,
} from "../transaction/types.js";

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
  /**
   * Action determined by centralized verdict ordering over all matches:
   * outcome precedence, then severity, then rule priority, then stable rule ID tie-break.
   */
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

/** Input for normalized transaction requests. */
export type TransactionInput = NormalizedTransactionContext & {
  readonly eventKind: "transaction";
};

/** Input for normalized signature requests. */
export type SignatureInput = NormalizedTransactionContext & {
  readonly eventKind: "signature";
};

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

export type TransactionVerdictStatus = "ALLOW" | "WARN" | "BLOCK";

export type TransactionOverrideLevel =
  | "none"
  | "confirm"
  | "high_friction_confirm";

export interface TransactionIntelVersions {
  readonly contractFeedVersion: string | null;
  readonly allowlistFeedVersion: string | null;
  readonly signatureFeedVersion: string | null;
}

export interface TransactionMatchedReason {
  readonly ruleId: string;
  readonly outcome: RuleOutcome;
  readonly severity: RiskLevel;
  readonly priority: number;
  readonly reasonCodes: readonly string[];
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface TransactionVerdict {
  readonly status: TransactionVerdictStatus;
  readonly riskLevel: RiskLevel;
  readonly reasonCodes: string[];
  readonly matchedRules: string[];
  readonly primaryRuleId: string | null;
  readonly primaryReason: TransactionMatchedReason | null;
  readonly secondaryReasons: readonly TransactionMatchedReason[];
  readonly evidence: Record<string, unknown>;
  readonly explanation: TransactionExplanation;
  readonly ruleSetVersion: string;
  readonly intelVersions: TransactionIntelVersions;
  readonly overrideAllowed: boolean;
  readonly overrideLevel: TransactionOverrideLevel;
}

export interface TransactionEvaluationResult {
  readonly verdict: TransactionVerdict;
  readonly matchedRules: string[];
  readonly reasonCodes: string[];
  readonly evidence: Record<string, unknown>;
  readonly signals: TransactionSignals;
  readonly riskClassification: TransactionRiskClassification;
}

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
