import {
  isValidEvmAddress,
  normalizeEvmAddress,
} from "../normalize/address.js";
import type {
  CanonicalTransactionIntelLookup,
  CanonicalTransactionSnapshotSectionState,
  TransactionLayer2MaliciousContract,
  ValidatedTransactionLayer2Snapshot,
} from "./intel-snapshot.js";
import type {
  Layer2SectionState as TransactionLayer2SectionState,
  TransactionEventKind,
  TransactionIntelContext,
} from "./types.js";

const ZERO_EVM_ADDRESS = "0x0000000000000000000000000000000000000000";

export type TransactionIntelLookupDisposition = Extract<
  TransactionIntelContext["contractDisposition"],
  "malicious" | "no_match" | "unavailable"
>;

export interface TransactionMaliciousContractLookup {
  readonly chain: "evm";
  readonly address: string | null;
}

export interface TransactionScamSignatureLookup {
  readonly normalizedKey: string | null;
}

export interface TransactionMaliciousContractLookupResult {
  readonly lookupFamily: "contract";
  readonly matched: boolean;
  readonly disposition: TransactionIntelLookupDisposition;
  readonly matchedSection?: "maliciousContracts";
  readonly feedVersion: string | null;
  readonly sectionState: TransactionLayer2SectionState;
  readonly record: TransactionLayer2MaliciousContract | null;
}

export interface TransactionScamSignatureLookupResult {
  readonly lookupFamily: "scam_signature";
  readonly matched: boolean;
  readonly disposition: TransactionIntelLookupDisposition;
  readonly matchedSection?: "scamSignatures";
  readonly feedVersion: string | null;
  readonly sectionState: TransactionLayer2SectionState;
}

export interface CanonicalTransactionIntelLookupResult {
  readonly maliciousContract: TransactionMaliciousContractLookupResult;
  readonly scamSignature: TransactionScamSignatureLookupResult;
}

export interface TransactionIntelProvider {
  readonly snapshotVersion: string | null;
  readonly generatedAt: string | null;
  lookupCanonicalTransactionIntel(
    lookup: CanonicalTransactionIntelLookup
  ): CanonicalTransactionIntelLookupResult;
  lookupMaliciousContract(
    lookup: TransactionMaliciousContractLookup
  ): TransactionMaliciousContractLookupResult;
  lookupScamSignature(
    lookup: TransactionScamSignatureLookup
  ): TransactionScamSignatureLookupResult;
}

function freezeObject<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeMaliciousContractRecord(
  entry: TransactionLayer2MaliciousContract
): TransactionLayer2MaliciousContract {
  return freezeObject({
    chain: entry.chain,
    address: entry.address,
    source: entry.source,
    disposition: entry.disposition,
    confidence: entry.confidence,
    reasonCodes: freezeObject([...entry.reasonCodes]),
  });
}

function mapSnapshotSectionState(
  state: CanonicalTransactionSnapshotSectionState
): TransactionLayer2SectionState {
  switch (state) {
    case "ready":
      return "fresh";
    case "stale":
      return "stale";
    default:
      return "missing";
  }
}

function normalizeMaliciousContractAddress(value: string | null): string | null {
  if (value === null || !isValidEvmAddress(value)) {
    return null;
  }

  const normalized = normalizeEvmAddress(value);
  return normalized === ZERO_EVM_ADDRESS ? null : normalized;
}

function createUnavailableMaliciousContractResult(
  sectionState: TransactionLayer2SectionState
): TransactionMaliciousContractLookupResult {
  return freezeObject({
    lookupFamily: "contract",
    matched: false,
    disposition: "unavailable",
    feedVersion: null,
    sectionState,
    record: null,
  });
}

function createUnavailableScamSignatureResult(
  sectionState: TransactionLayer2SectionState
): TransactionScamSignatureLookupResult {
  return freezeObject({
    lookupFamily: "scam_signature",
    matched: false,
    disposition: "unavailable",
    feedVersion: null,
    sectionState,
  });
}

function createNoMatchMaliciousContractResult(
  feedVersion: string,
  sectionState: TransactionLayer2SectionState
): TransactionMaliciousContractLookupResult {
  return freezeObject({
    lookupFamily: "contract",
    matched: false,
    disposition: "no_match",
    feedVersion,
    sectionState,
    record: null,
  });
}

function createNoMatchScamSignatureResult(
  feedVersion: string,
  sectionState: TransactionLayer2SectionState
): TransactionScamSignatureLookupResult {
  return freezeObject({
    lookupFamily: "scam_signature",
    matched: false,
    disposition: "no_match",
    feedVersion,
    sectionState,
  });
}

function createMatchedMaliciousContractResult(
  entry: TransactionLayer2MaliciousContract,
  feedVersion: string,
  sectionState: TransactionLayer2SectionState
): TransactionMaliciousContractLookupResult {
  return freezeObject({
    lookupFamily: "contract",
    matched: true,
    disposition: "malicious",
    matchedSection: "maliciousContracts",
    feedVersion,
    sectionState,
    record: freezeMaliciousContractRecord(entry),
  });
}

function createCanonicalTransactionIntelLookupResult(
  maliciousContract: TransactionMaliciousContractLookupResult,
  scamSignature: TransactionScamSignatureLookupResult
): CanonicalTransactionIntelLookupResult {
  return freezeObject({
    maliciousContract,
    scamSignature,
  });
}

function isTransactionIntelProvider(
  value: TransactionIntelProvider | ValidatedTransactionLayer2Snapshot | null
): value is TransactionIntelProvider {
  return (
    value !== null &&
    typeof value === "object" &&
    "lookupCanonicalTransactionIntel" in value &&
    typeof value.lookupCanonicalTransactionIntel === "function"
  );
}

function canonicalLookupCacheKey(
  eventKind: TransactionEventKind,
  targetAddress: string | null
): string {
  return `${eventKind}:${targetAddress ?? "null"}`;
}

export function createTransactionIntelProvider(
  snapshot: ValidatedTransactionLayer2Snapshot | null
): TransactionIntelProvider {
  if (snapshot === null) {
    const contractUnavailable = createUnavailableMaliciousContractResult("missing");
    const signatureUnavailable = createUnavailableScamSignatureResult("missing");
    const canonicalUnavailable = createCanonicalTransactionIntelLookupResult(
      contractUnavailable,
      signatureUnavailable
    );

    return freezeObject({
      snapshotVersion: null,
      generatedAt: null,
      lookupCanonicalTransactionIntel: () => canonicalUnavailable,
      lookupMaliciousContract: () => contractUnavailable,
      lookupScamSignature: () => signatureUnavailable,
    });
  }

  const maliciousContractsState = mapSnapshotSectionState(
    snapshot.sectionStates.maliciousContracts
  );
  const scamSignaturesState = mapSnapshotSectionState(
    snapshot.sectionStates.scamSignatures
  );
  const maliciousContractsMissing =
    snapshot.sectionStates.maliciousContracts === "missing";
  const scamSignaturesMissing = snapshot.sectionStates.scamSignatures === "missing";

  const maliciousContractResults = new Map<
    string,
    TransactionMaliciousContractLookupResult
  >();
  snapshot.maliciousContracts.forEach((entry) => {
    maliciousContractResults.set(
      `${entry.chain}:${entry.address}`,
      createMatchedMaliciousContractResult(
        entry,
        snapshot.version,
        maliciousContractsState
      )
    );
  });

  const lookupMaliciousContract = maliciousContractsMissing
    ? (() => {
        const unavailableResult =
          createUnavailableMaliciousContractResult(maliciousContractsState);

        return (): TransactionMaliciousContractLookupResult => unavailableResult;
      })()
    : (() => {
        const noMatchResult = createNoMatchMaliciousContractResult(
          snapshot.version,
          maliciousContractsState
        );

        return (
          lookup: TransactionMaliciousContractLookup
        ): TransactionMaliciousContractLookupResult => {
          const normalizedAddress = normalizeMaliciousContractAddress(
            lookup.address
          );
          if (normalizedAddress === null) {
            return noMatchResult;
          }

          return (
            maliciousContractResults.get(`${lookup.chain}:${normalizedAddress}`) ??
            noMatchResult
          );
        };
      })();

  const lookupScamSignature = scamSignaturesMissing
    ? (() => {
        const unavailableResult =
          createUnavailableScamSignatureResult(scamSignaturesState);

        return (): TransactionScamSignatureLookupResult => unavailableResult;
      })()
    : (() => {
        const noMatchResult = createNoMatchScamSignatureResult(
          snapshot.version,
          scamSignaturesState
        );

        return (
          lookup: TransactionScamSignatureLookup
        ): TransactionScamSignatureLookupResult => {
          void lookup;
          return noMatchResult;
        };
      })();

  const canonicalLookupResults = new Map<
    string,
    CanonicalTransactionIntelLookupResult
  >();
  const lookupCanonicalTransactionIntel = (
    lookup: CanonicalTransactionIntelLookup
  ): CanonicalTransactionIntelLookupResult => {
    const normalizedAddress = normalizeMaliciousContractAddress(lookup.targetAddress);
    const cacheKey = canonicalLookupCacheKey(lookup.eventKind, normalizedAddress);
    const cached = canonicalLookupResults.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const canonicalResult = createCanonicalTransactionIntelLookupResult(
      lookupMaliciousContract({
        chain: "evm",
        address: lookup.targetAddress,
      }),
      lookupScamSignature({
        normalizedKey: null,
      })
    );
    canonicalLookupResults.set(cacheKey, canonicalResult);
    return canonicalResult;
  };

  return freezeObject({
    snapshotVersion: snapshot.version,
    generatedAt: snapshot.generatedAt,
    lookupCanonicalTransactionIntel,
    lookupMaliciousContract,
    lookupScamSignature,
  });
}

export function resolveCanonicalTransactionIntel(
  provider: TransactionIntelProvider,
  lookup: CanonicalTransactionIntelLookup
): CanonicalTransactionIntelLookupResult;
export function resolveCanonicalTransactionIntel(
  snapshot: ValidatedTransactionLayer2Snapshot | null,
  lookup: CanonicalTransactionIntelLookup
): CanonicalTransactionIntelLookupResult;
export function resolveCanonicalTransactionIntel(
  input: TransactionIntelProvider | ValidatedTransactionLayer2Snapshot | null,
  lookup: CanonicalTransactionIntelLookup
): CanonicalTransactionIntelLookupResult {
  const provider = isTransactionIntelProvider(input)
    ? input
    : createTransactionIntelProvider(input);
  return provider.lookupCanonicalTransactionIntel(lookup);
}
