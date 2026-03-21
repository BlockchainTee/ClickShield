import type { RiskLevel, RuleOutcome } from "./engine/types.js";
import { PHISHING_CODES, type PhishingCode } from "./policies/phishing/codes.js";

/**
 * Human-readable UX fields for a verdict reason code.
 */
export interface ReasonMessage {
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
 * Map of reason codes to human-readable UX text.
 * Shared across extension, desktop, and mobile clients.
 */
const DEFAULT_REASON_MESSAGE: ReasonMessage = {
  blockedTitle: "This site has been blocked",
  warningTitle: "Potential risk detected",
  reason: "ClickShield detected a potential security risk with this site.",
  goBackLabel: "Go Back",
  proceedLabel: "Proceed Anyway",
};

const REASON_MESSAGES = {
  [PHISHING_CODES.PHISH_KNOWN_MALICIOUS_DOMAIN]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Known malicious site",
    reason: "This domain appears on a known malicious threat feed. It has been flagged for phishing, scams, or malware distribution.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway",
  },
  [PHISHING_CODES.PHISH_IMPERSONATION_NEW_DOMAIN]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Suspicious impersonation detected",
    reason: "This domain closely resembles a known Web3 protocol and was recently registered. It may be impersonating a legitimate service to steal your credentials or funds.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway",
  },
  [PHISHING_CODES.PHISH_SUSPICIOUS_TLD_MINT_KEYWORD]: {
    blockedTitle: "Suspicious site detected",
    warningTitle: "Suspicious site detected",
    reason: "This site uses a suspicious domain extension and contains crypto-related lure keywords like mint, claim, or airdrop. Exercise caution.",
    goBackLabel: "Go Back",
    proceedLabel: "Continue to Site",
  },
  [PHISHING_CODES.DIRECT_IP_ACCESS]: {
    blockedTitle: "Direct IP access detected",
    warningTitle: "Direct IP access detected",
    reason: "You are navigating to a raw IP address instead of a domain name. Legitimate Web3 services use domain names. This may indicate a phishing attempt.",
    goBackLabel: "Go Back",
    proceedLabel: "Continue to Site",
  },
  [PHISHING_CODES.NEW_DOMAIN_WALLET_CONNECT]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Suspicious wallet connection",
    reason: "This recently-registered domain is attempting to initiate a wallet connection. New domains requesting wallet access are a common phishing tactic.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway",
  },
  [PHISHING_CODES.HOMOGLYPH_ATTACK]: {
    blockedTitle: "This site has been blocked",
    warningTitle: "Unicode impersonation detected",
    reason: "This domain uses lookalike Unicode characters to impersonate a legitimate site. This is a sophisticated phishing technique known as a homoglyph attack.",
    goBackLabel: "Go Back",
    proceedLabel: "Proceed Anyway",
  },
  [PHISHING_CODES.SUSPICIOUS_REDIRECT_CHAIN]: {
    blockedTitle: "Suspicious redirects detected",
    warningTitle: "Suspicious redirects detected",
    reason: "This URL passed through multiple redirects and landed on a different domain than expected. Redirect chains are commonly used to disguise malicious destinations.",
    goBackLabel: "Go Back",
    proceedLabel: "Continue to Site",
  },
} satisfies Partial<Record<PhishingCode, ReasonMessage>>;

/**
 * Get the human-readable message for a reason code.
 * Falls back to a generic message if the code is unknown.
 */
export function getReasonMessage(reasonCode: string): ReasonMessage {
  return REASON_MESSAGES[reasonCode as keyof typeof REASON_MESSAGES] ?? DEFAULT_REASON_MESSAGE;
}

/**
 * Get the display title based on verdict outcome and reason code.
 */
export function getVerdictTitle(
  outcome: RuleOutcome,
  reasonCode: string
): string {
  const msg = getReasonMessage(reasonCode);
  return outcome === "block" ? msg.blockedTitle : msg.warningTitle;
}

/**
 * Map risk level to a display badge label.
 */
export function riskBadgeLabel(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "critical": return "Critical Risk";
    case "high": return "High Risk";
    case "medium": return "Medium Risk";
    case "low": return "Low Risk";
  }
}
