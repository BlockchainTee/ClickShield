import type { NavigationInput, Rule } from "../../engine/types.js";
import { getUnicodeConfusableSignals } from "../../signals/unicodeConfusableSignals.js";

export const PHISH_UNICODE_CONFUSABLE: Rule<NavigationInput> = {
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
  },
};
