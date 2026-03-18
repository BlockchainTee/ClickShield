import { NavigationInput, Rule } from "../../engine/types";
import { getDomainEntropySignals } from "../../signals/domainEntropySignals";

/**
 * PHISH_DOMAIN_HIGH_ENTROPY
 *
 * Detects high-entropy domains typical of phishing infrastructure.
 */
export const PHISH_DOMAIN_HIGH_ENTROPY: Rule<NavigationInput> = {
  id: "PHISH_DOMAIN_HIGH_ENTROPY",
  name: "High entropy domain detection",
  eventKind: "navigation",
  priority: 50,
  severity: "medium",
  outcome: "warn",

  predicate(input: NavigationInput): boolean {
    const signals = getDomainEntropySignals(input);
    return signals.isHighEntropy;
  },

  buildReasonCodes() {
    return ["PHISH_DOMAIN_HIGH_ENTROPY"];
  },
};
