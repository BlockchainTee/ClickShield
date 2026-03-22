import type {
  EventKind,
  SignatureInput,
  Rule,
  NavigationInput,
  TransactionInput,
} from "../engine/types.js";
import { PHISHING_RULES } from "../policies/phishing/rules.js";
import { TRANSACTION_RULES } from "../policies/transaction/rules.js";

const NAVIGATION_RULES: readonly Rule<NavigationInput>[] = PHISHING_RULES;
const TX_RULES = TRANSACTION_RULES.filter(
  (rule) => rule.eventKind === "transaction"
) as readonly Rule<TransactionInput>[];
const SIG_RULES = TRANSACTION_RULES.filter(
  (rule) => rule.eventKind === "signature"
) as readonly Rule<SignatureInput>[];

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
  eventKind: "transaction"
): readonly Rule<TransactionInput>[];
export function getRulesForEventKind(
  eventKind: "signature"
): readonly Rule<SignatureInput>[];
export function getRulesForEventKind(
  eventKind: EventKind
):
  | readonly Rule<NavigationInput>[]
  | readonly Rule<TransactionInput>[]
  | readonly Rule<SignatureInput>[]
  | readonly Rule<unknown>[] {
  if (eventKind === "navigation") {
    return NAVIGATION_RULES;
  }
  if (eventKind === "transaction") {
    return TX_RULES;
  }
  if (eventKind === "signature") {
    return SIG_RULES;
  }
  return [];
}

/**
 * Get all event kinds that have at least one rule registered.
 *
 * @returns Array of event kinds with active rules.
 */
export function getActiveEventKinds(): EventKind[] {
  const kinds: EventKind[] = [];
  if (NAVIGATION_RULES.length > 0) {
    kinds.push("navigation");
  }
  if (TX_RULES.length > 0) {
    kinds.push("transaction");
  }
  if (SIG_RULES.length > 0) {
    kinds.push("signature");
  }
  return kinds;
}
