import type { NavigationInput, Rule } from "../../engine/types.js";
import { getBrandLureSignals } from "../../signals/brandLureSignals.js";

export const PHISH_BRAND_LURE: Rule<NavigationInput> = {
  id: "PHISH_BRAND_LURE",
  name: "Brand and lure token combination on hostname",
  eventKind: "navigation",
  severity: "high",
  outcome: "block",
  priority: 60,
  predicate(input) {
    const signals = getBrandLureSignals(input);
    return signals.hasBrandLure;
  },
  buildReasonCodes() {
    return ["PHISH_BRAND_LURE"];
  },
  buildEvidence(input) {
    const signals = getBrandLureSignals(input);
    if (!signals.hasBrandLure) {
      return {};
    }

    return {
      hostname: signals.hostname,
      matchedBrand: signals.matchedBrand,
      matchedLure: signals.matchedLure,
    };
  },
};
