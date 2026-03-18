import { NavigationInput, Rule } from "../../engine/types";
import { getRedirectChainSignals } from "../../signals/redirectChainSignals";

/**
 * PHISH_REDIRECT_CHAIN_ABUSE
 *
 * Detects suspicious redirect chains commonly used in phishing attacks.
 */
export const PHISH_REDIRECT_CHAIN_ABUSE: Rule<NavigationInput> = {
  id: "PHISH_REDIRECT_CHAIN_ABUSE",
  name: "Suspicious redirect chain abuse",
  eventKind: "navigation",
  priority: 80,
  severity: "high",
  outcome: "block",

  predicate(input: NavigationInput): boolean {
    const signals = getRedirectChainSignals(input);

    if (signals.hasInvalidUrl) return true;
    if (signals.hasSuspiciousProtocol) return true;
    if (signals.hasIpHost && signals.hasRedirects) return true;
    if (signals.isLongChain) return true;

    return false;
  },

  buildReasonCodes() {
    return ["PHISH_REDIRECT_CHAIN_ABUSE"];
  },
};
