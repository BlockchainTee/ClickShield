import type {
  EventKind,
  Rule,
  NavigationInput,
  TransactionInput,
  WalletScanInput,
  DownloadInput,
} from "../engine/types.js";
import { PHISHING_RULES } from "../policies/phishing/rules.js";
import { TRANSACTION_RULES } from "../policies/transaction/rules.js";
import { WALLET_RULES } from "../policies/wallet/rules.js";
import { DOWNLOAD_RULES } from "../policies/download/rules.js";

/**
 * Type-safe registry mapping event kinds to their rule arrays.
 */
interface RuleRegistry {
  readonly navigation: readonly Rule<NavigationInput>[];
  readonly transaction: readonly Rule<TransactionInput>[];
  readonly wallet_scan: readonly Rule<WalletScanInput>[];
  readonly download: readonly Rule<DownloadInput>[];
}

const REGISTRY: RuleRegistry = {
  navigation: PHISHING_RULES,
  transaction: TRANSACTION_RULES,
  wallet_scan: WALLET_RULES,
  download: DOWNLOAD_RULES,
};

/**
 * Event kinds that have rule arrays registered.
 * Signature and clipboard are not yet wired to rules.
 */
type RuleEventKind = keyof RuleRegistry;

/**
 * Get all registered rules for a given event kind.
 *
 * Returns an empty array for event kinds without rules (signature, clipboard).
 *
 * @param eventKind - The event kind to look up.
 * @returns The typed rule array for that event kind.
 */
export function getRulesForEventKind(
  eventKind: EventKind
): readonly Rule<unknown>[] {
  if (eventKind in REGISTRY) {
    return REGISTRY[eventKind as RuleEventKind] as readonly Rule<unknown>[];
  }
  return [];
}

/**
 * Get all event kinds that have at least one rule registered.
 *
 * @returns Array of event kinds with active rules.
 */
export function getActiveEventKinds(): EventKind[] {
  return (Object.keys(REGISTRY) as RuleEventKind[]).filter(
    (kind) => REGISTRY[kind].length > 0
  );
}
