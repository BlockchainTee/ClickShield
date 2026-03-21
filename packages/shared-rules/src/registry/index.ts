import type {
  EventKind,
  Rule,
  NavigationInput,
} from "../engine/types.js";
import { PHISHING_RULES } from "../policies/phishing/rules.js";
const NAVIGATION_RULES: readonly Rule<NavigationInput>[] = PHISHING_RULES;

/**
 * Get the registered Layer 1 rules for a given event kind.
 *
 * Only navigation rules are intentionally wired today. Other event kinds
 * resolve to an empty rule list until their packages are intentionally
 * promoted into the public engine surface.
 */
export function getRulesForEventKind(
  eventKind: "navigation"
): readonly Rule<NavigationInput>[];
export function getRulesForEventKind(
  eventKind: EventKind
): readonly Rule<NavigationInput>[] | readonly Rule<unknown>[] {
  if (eventKind === "navigation") {
    return NAVIGATION_RULES;
  }
  return [];
}

/**
 * Get all event kinds that have at least one rule registered.
 *
 * @returns Array of event kinds with active rules.
 */
export function getActiveEventKinds(): EventKind[] {
  return NAVIGATION_RULES.length > 0 ? ["navigation"] : [];
}
