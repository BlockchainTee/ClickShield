import { classifyTransactionRisk } from "../signals/transaction-risk.js";
import canonicalTransactionSnapshot from "../intel/generated/layer2-snapshot.json";
import { sha256Hex } from "../intel/hash.js";
import { buildTransactionSignals } from "../signals/transaction-signals.js";
import {
  createTransactionIntelProvider,
  resolveCanonicalTransactionIntel,
} from "./intel-provider.js";
import {
  buildEmptyValidatedTransactionLayer2Snapshot,
  validateTransactionLayer2Snapshot,
  type TransactionLayer2SnapshotValidationIssue,
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
const EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT =
  "1970-01-01T00:00:00.000Z";

interface CanonicalTransactionSnapshotActivation {
  readonly state: "valid" | "empty" | "rejected";
  readonly rejectionStatus: "malformed" | "incompatible" | null;
  readonly issues: readonly TransactionLayer2SnapshotValidationIssue[];
  readonly snapshot: ValidatedTransactionLayer2Snapshot;
  readonly provider: TransactionIntelProvider;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidUtcTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function readFallbackGeneratedAt(value: unknown): string {
  if (!isRecord(value) || typeof value.generatedAt !== "string") {
    return EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT;
  }

  return isValidUtcTimestamp(value.generatedAt)
    ? value.generatedAt
    : EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT;
}

function activateCanonicalTransactionSnapshot(
  snapshotSource: unknown
): CanonicalTransactionSnapshotActivation {
  const validation = validateTransactionLayer2Snapshot(snapshotSource);
  if (validation.ok) {
    const provider = createTransactionIntelProvider(validation.snapshot);

    return Object.freeze({
      state: validation.status === "empty" ? "empty" : "valid",
      rejectionStatus: null,
      issues: validation.issues,
      snapshot: validation.snapshot,
      provider,
    });
  }

  const fallbackSnapshot = buildEmptyValidatedTransactionLayer2Snapshot(
    readFallbackGeneratedAt(snapshotSource)
  );
  const provider = createTransactionIntelProvider(fallbackSnapshot);

  return Object.freeze({
    state: "rejected",
    rejectionStatus: validation.status,
    issues: validation.issues,
    snapshot: fallbackSnapshot,
    provider,
  });
}

function buildCanonicalSignatureHash(
  input: NormalizedTransactionContext
): string | null {
  if (input.eventKind !== "signature" || input.signature.isTypedData !== true) {
    return null;
  }

  return `0x${sha256Hex(input.signature.canonicalJson)}`;
}

const CANONICAL_TRANSACTION_SNAPSHOT_ACTIVATION =
  activateCanonicalTransactionSnapshot(canonicalTransactionSnapshot);
const CANONICAL_TRANSACTION_INTEL_PROVIDER =
  CANONICAL_TRANSACTION_SNAPSHOT_ACTIVATION.provider;

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
    signatureHash: buildCanonicalSignatureHash(input),
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
