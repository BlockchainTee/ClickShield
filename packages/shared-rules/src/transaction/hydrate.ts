import { classifyTransactionRisk } from "../signals/transaction-risk.js";
import canonicalTransactionSnapshot from "../intel/generated/layer2-snapshot.json";
import { buildTransactionSignals } from "../signals/transaction-signals.js";
import {
  createTransactionIntelProvider,
  resolveCanonicalTransactionIntel,
} from "./intel-provider.js";
import {
  validateTransactionLayer2Snapshot,
  type ValidatedTransactionLayer2Snapshot,
} from "./intel-snapshot.js";
import type {
  NormalizedTransactionContext,
  TransactionIntelContext,
} from "./types.js";
import type { TransactionIntelProvider } from "./intel-provider.js";

const UNAVAILABLE_ORIGIN_INTEL: Pick<
  TransactionIntelContext,
  "allowlistFeedVersion" | "originDisposition"
> = Object.freeze({
  allowlistFeedVersion: null,
  originDisposition: "unavailable",
});

function loadCanonicalTransactionSnapshot():
  | ValidatedTransactionLayer2Snapshot
  | null {
  const result = validateTransactionLayer2Snapshot(canonicalTransactionSnapshot);
  return result.ok ? result.snapshot : null;
}

const CANONICAL_TRANSACTION_SNAPSHOT = loadCanonicalTransactionSnapshot();
const CANONICAL_TRANSACTION_INTEL_PROVIDER = createTransactionIntelProvider(
  CANONICAL_TRANSACTION_SNAPSHOT
);

function isTransactionIntelProvider(provider: unknown): provider is TransactionIntelProvider {
  return (
    provider !== null &&
    typeof provider === "object" &&
    "lookupCanonicalTransactionIntel" in provider &&
    typeof provider.lookupCanonicalTransactionIntel === "function"
  );
}

function getLookupProvider(
  provider: TransactionIntelProvider | null | undefined
): TransactionIntelProvider {
  if (provider === undefined || provider === null) {
    return CANONICAL_TRANSACTION_INTEL_PROVIDER;
  }

  if (!isTransactionIntelProvider(provider)) {
    throw new TypeError(
      "Transaction intel runtime overrides must be prebuilt providers."
    );
  }

  return provider;
}

function buildHydratedIntel(
  input: NormalizedTransactionContext,
  provider: TransactionIntelProvider | null | undefined
): TransactionIntelContext {
  const lookup = {
    eventKind: input.eventKind,
    targetAddress:
      input.eventKind === "signature" ? input.signature.verifyingContract : input.to,
  } as const;
  const resolved = resolveCanonicalTransactionIntel(
    getLookupProvider(provider),
    lookup
  );

  return {
    contractDisposition: resolved.maliciousContract.disposition,
    contractFeedVersion: resolved.maliciousContract.feedVersion,
    allowlistFeedVersion: UNAVAILABLE_ORIGIN_INTEL.allowlistFeedVersion,
    signatureDisposition: resolved.scamSignature.disposition,
    signatureFeedVersion: resolved.scamSignature.feedVersion,
    originDisposition: UNAVAILABLE_ORIGIN_INTEL.originDisposition,
    sectionStates: {
      maliciousContracts: resolved.maliciousContract.sectionState,
      scamSignatures: resolved.scamSignature.sectionState,
    },
  };
}

export function hydrateNormalizedTransactionContext(
  input: NormalizedTransactionContext,
  provider?: TransactionIntelProvider | null
): NormalizedTransactionContext {
  const hydrated = {
    ...input,
    intel: buildHydratedIntel(input, provider),
  };
  const {
    signals: _signals,
    riskClassification: _riskClassification,
    ...signalInput
  } = hydrated;
  const signals = buildTransactionSignals(signalInput);

  return {
    ...hydrated,
    signals,
    riskClassification: classifyTransactionRisk({
      ...signalInput,
      signals,
    }),
  };
}

export function getDefaultTransactionIntelProvider(): TransactionIntelProvider {
  return CANONICAL_TRANSACTION_INTEL_PROVIDER;
}
