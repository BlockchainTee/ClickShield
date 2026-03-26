import { serializeCanonicalJson, sha256Hex } from "../intel/hash.js";
import {
  isValidEvmAddress,
  normalizeEvmAddress,
} from "../normalize/address.js";
import type {
  Layer2SectionState as TransactionLayer2SectionState,
  TransactionEventKind,
  TransactionIntelContext,
} from "./types.js";
export { resolveCanonicalTransactionIntel } from "./intel-provider.js";

export type CanonicalTransactionSnapshotSectionState =
  | "ready"
  | "stale"
  | "missing";

export type TransactionIntelSource = "ofac" | "chainabuse" | "internal";

export type TransactionIntelConfidence = "high" | "medium" | "low";

export type TransactionMaliciousContractChain =
  | "evm"
  | "solana"
  | "bitcoin";

export interface TransactionLayer2SnapshotValidationIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * OFAC -> Snapshot Mapping
 *
 * source: "ofac"
 * confidence: "high"
 *
 * Currently populated by Layer 2 compiler into:
 * - maliciousContracts only
 *
 * OFAC does not populate scamSignatures in the current compiler path.
 */
/**
 * Chainabuse -> Snapshot Mapping
 *
 * source: "chainabuse"
 *
 * confidence rules:
 * - multiple reports -> "medium"
 * - single report -> "low"
 *
 * Currently populated by Layer 2 compiler into:
 * - maliciousContracts only
 *
 * scamSignatures may be present in validated snapshots from other producers,
 * but the current Layer 2 compiler does not populate them from Chainabuse.
 */
/**
 * Internal Snapshot Entries
 *
 * source: "internal"
 * confidence: "high"
 *
 * This source is accepted by the validation schema for compatibility with
 * validated snapshots, including scamSignatures when present.
 *
 * It is not populated by the current Layer 2 compiler path.
 */
export interface TransactionLayer2MaliciousContract {
  readonly chain: TransactionMaliciousContractChain;
  readonly address: string;
  readonly source: TransactionIntelSource;
  readonly disposition: "block" | "warn";
  readonly confidence: TransactionIntelConfidence;
  readonly reasonCodes: readonly string[];
  readonly reason?: string;
}

export interface TransactionLayer2MaliciousContractEntry
  extends TransactionLayer2MaliciousContract {
  readonly reason: string;
}

export interface TransactionLayer2ScamSignature {
  readonly signatureHash: string;
  readonly source: Extract<TransactionIntelSource, "chainabuse" | "internal">;
  readonly confidence: TransactionIntelConfidence;
  readonly reason: string;
}

export interface TransactionLayer2SnapshotMetadata {
  readonly generatedAt: string;
  readonly sources: readonly TransactionIntelSource[];
}

export interface TransactionLayer2Snapshot {
  readonly version: string;
  /**
   * Compatibility alias for the current provider surface.
   * metadata.generatedAt is the canonical schema field.
   */
  readonly generatedAt: string;
  readonly maliciousContracts: readonly TransactionLayer2MaliciousContractEntry[];
  /**
   * Currently populated by validated snapshots when available.
   * The current Layer 2 compiler may leave this empty and mark the section
   * state as "missing".
   */
  readonly scamSignatures: readonly TransactionLayer2ScamSignature[];
  readonly metadata: TransactionLayer2SnapshotMetadata;
  readonly sectionStates: {
    readonly maliciousContracts: CanonicalTransactionSnapshotSectionState;
    /**
     * Provider treats "missing" as unavailable rather than no_match.
     */
    readonly scamSignatures: CanonicalTransactionSnapshotSectionState;
  };
}

export interface ValidatedTransactionLayer2Snapshot
  extends TransactionLayer2Snapshot {}

export interface ValidateTransactionLayer2SnapshotSuccess {
  readonly ok: true;
  readonly status: "valid" | "empty";
  readonly snapshot: ValidatedTransactionLayer2Snapshot;
  readonly issues: readonly TransactionLayer2SnapshotValidationIssue[];
}

export interface ValidateTransactionLayer2SnapshotFailure {
  readonly ok: false;
  readonly status: "malformed" | "incompatible";
  readonly issues: readonly TransactionLayer2SnapshotValidationIssue[];
}

export type ValidateTransactionLayer2SnapshotResult =
  | ValidateTransactionLayer2SnapshotSuccess
  | ValidateTransactionLayer2SnapshotFailure;

export interface CanonicalTransactionIntelLookup {
  readonly eventKind: TransactionEventKind;
  readonly targetAddress: string | null;
  readonly signatureHash: string | null;
}

export interface TrustedTransactionOriginIntel {
  readonly originDisposition: TransactionIntelContext["originDisposition"];
  readonly allowlistFeedVersion: string | null;
  readonly allowlistsState: TransactionLayer2SectionState;
}

const EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT =
  "1970-01-01T00:00:00.000Z";

const ROOT_KEYS = [
  "version",
  "generatedAt",
  "maliciousContracts",
  "scamSignatures",
  "metadata",
  "sectionStates",
] as const;

const MALICIOUS_CONTRACT_KEYS = [
  "chain",
  "address",
  "source",
  "disposition",
  "confidence",
  "reason",
  "reasonCodes",
] as const;

const SCAM_SIGNATURE_KEYS = [
  "signatureHash",
  "source",
  "confidence",
  "reason",
] as const;

const METADATA_KEYS = ["generatedAt", "sources"] as const;
const SECTION_STATE_KEYS = ["maliciousContracts", "scamSignatures"] as const;
const ZERO_EVM_ADDRESS = "0x0000000000000000000000000000000000000000";
const TRANSACTION_INTEL_SOURCES = ["chainabuse", "internal", "ofac"] as const;
const TRANSACTION_INTEL_CONFIDENCES = ["high", "low", "medium"] as const;
const MALICIOUS_CONTRACT_CHAINS = ["bitcoin", "evm", "solana"] as const;
const SCAM_SIGNATURE_SOURCE_SET = new Set<TransactionIntelSource>([
  "chainabuse",
  "internal",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      deepFreeze(entry);
    });
    return Object.freeze(value);
  }

  if (isRecord(value)) {
    Object.values(value).forEach((entry) => {
      deepFreeze(entry);
    });
    return Object.freeze(value);
  }

  return value;
}

function isValidUtcTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function pushIssue(
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">,
  path: string,
  message: string,
  kind: "malformed" | "incompatible" = "malformed"
): void {
  issues.push({ path, message });
  failureKinds.push(kind);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): void {
  const allowed = new Set(allowedKeys);

  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      pushIssue(
        issues,
        failureKinds,
        path === "" ? key : `${path}.${key}`,
        "Unknown field"
      );
    }
  });
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): string | null {
  const candidate = value[key];

  if (typeof candidate !== "string" || candidate.trim() === "") {
    pushIssue(
      issues,
      failureKinds,
      path === "" ? key : `${path}.${key}`,
      "Expected a non-empty string"
    );
    return null;
  }

  return candidate;
}

function readRequiredStringArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): readonly string[] | null {
  const candidate = value[key];

  if (!Array.isArray(candidate)) {
    pushIssue(
      issues,
      failureKinds,
      path === "" ? key : `${path}.${key}`,
      "Expected array of non-empty strings"
    );
    return null;
  }

  const parsed = candidate.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      pushIssue(
        issues,
        failureKinds,
        `${path === "" ? key : `${path}.${key}`}[${index}]`,
        "Expected a non-empty string"
      );
      return "";
    }

    return entry;
  });

  return parsed;
}

function isSortedUnique(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] >= values[index]) {
      return false;
    }
  }

  return true;
}

function isTransactionIntelSource(
  value: string
): value is TransactionIntelSource {
  return (TRANSACTION_INTEL_SOURCES as readonly string[]).includes(value);
}

function isTransactionIntelConfidence(
  value: string
): value is TransactionIntelConfidence {
  return (TRANSACTION_INTEL_CONFIDENCES as readonly string[]).includes(value);
}

function isTransactionMaliciousContractChain(
  value: string
): value is TransactionMaliciousContractChain {
  return (MALICIOUS_CONTRACT_CHAINS as readonly string[]).includes(value);
}

function validateConfidenceForSource(
  source: TransactionIntelSource,
  confidence: TransactionIntelConfidence,
  path: string,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): void {
  if (
    (source === "ofac" || source === "internal") &&
    confidence !== "high"
  ) {
    pushIssue(
      issues,
      failureKinds,
      path,
      `${source} entries must use high confidence`,
      "incompatible"
    );
  }

  if (source === "chainabuse" && confidence === "high") {
    pushIssue(
      issues,
      failureKinds,
      path,
      "chainabuse entries must use low or medium confidence",
      "incompatible"
    );
  }
}

function isValidSignatureHash(value: string): boolean {
  return /^0x[0-9a-f]{64}$/.test(value);
}

function buildSnapshotVersion(
  snapshotBody: Omit<TransactionLayer2Snapshot, "version">
): string {
  const digest = sha256Hex(
    serializeCanonicalJson({
      maliciousContracts: snapshotBody.maliciousContracts.map((entry) => ({
        chain: entry.chain,
        address: entry.address,
        source: entry.source,
        disposition: entry.disposition,
        confidence: entry.confidence,
        reason: entry.reason,
        reasonCodes: entry.reasonCodes,
      })),
      scamSignatures: snapshotBody.scamSignatures.map((entry) => ({
        signatureHash: entry.signatureHash,
        source: entry.source,
        confidence: entry.confidence,
        reason: entry.reason,
      })),
      metadata: {
        generatedAt: snapshotBody.metadata.generatedAt,
        sources: snapshotBody.metadata.sources,
      },
      sectionStates: snapshotBody.sectionStates,
    })
  ).slice(0, 16);

  return `layer2.${digest}`;
}

function parseSectionStates(
  value: unknown,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): TransactionLayer2Snapshot["sectionStates"] | null {
  if (!isRecord(value)) {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates",
      "Expected sectionStates object"
    );
    return null;
  }

  assertExactKeys(value, SECTION_STATE_KEYS, "sectionStates", issues, failureKinds);

  const maliciousContracts = readRequiredString(
    value,
    "maliciousContracts",
    "sectionStates",
    issues,
    failureKinds
  );
  const scamSignatures = readRequiredString(
    value,
    "scamSignatures",
    "sectionStates",
    issues,
    failureKinds
  );

  if (maliciousContracts === null || scamSignatures === null) {
    return null;
  }

  if (
    maliciousContracts !== "ready" &&
    maliciousContracts !== "stale" &&
    maliciousContracts !== "missing"
  ) {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates.maliciousContracts",
      "Unsupported maliciousContracts state",
      "incompatible"
    );
  }

  if (
    scamSignatures !== "ready" &&
    scamSignatures !== "stale" &&
    scamSignatures !== "missing"
  ) {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates.scamSignatures",
      "Unsupported scamSignatures state",
      "incompatible"
    );
  }

  return {
    maliciousContracts:
      maliciousContracts === "ready" ||
      maliciousContracts === "stale" ||
      maliciousContracts === "missing"
        ? maliciousContracts
        : "missing",
    scamSignatures:
      scamSignatures === "ready" ||
      scamSignatures === "stale" ||
      scamSignatures === "missing"
        ? scamSignatures
        : "missing",
  };
}

function parseMetadata(
  value: unknown,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): TransactionLayer2SnapshotMetadata | null {
  if (!isRecord(value)) {
    pushIssue(
      issues,
      failureKinds,
      "metadata",
      "Expected metadata object"
    );
    return null;
  }

  assertExactKeys(value, METADATA_KEYS, "metadata", issues, failureKinds);

  const generatedAt = readRequiredString(
    value,
    "generatedAt",
    "metadata",
    issues,
    failureKinds
  );
  const sources = readRequiredStringArray(
    value,
    "sources",
    "metadata",
    issues,
    failureKinds
  );

  if (generatedAt === null || sources === null) {
    return null;
  }

  if (!isValidUtcTimestamp(generatedAt)) {
    pushIssue(
      issues,
      failureKinds,
      "metadata.generatedAt",
      "Expected an ISO-8601 UTC timestamp"
    );
  }

  sources.forEach((source, index) => {
    if (!isTransactionIntelSource(source)) {
      pushIssue(
        issues,
        failureKinds,
        `metadata.sources[${index}]`,
        "Unsupported snapshot source",
        "incompatible"
      );
    }
  });

  if (!isSortedUnique(sources)) {
    pushIssue(
      issues,
      failureKinds,
      "metadata.sources",
      "sources must be sorted and unique",
      "incompatible"
    );
  }

  return {
    generatedAt,
    sources: sources.filter(isTransactionIntelSource),
  };
}

function parseMaliciousContracts(
  value: unknown,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): readonly TransactionLayer2MaliciousContractEntry[] | null {
  if (!Array.isArray(value)) {
    pushIssue(
      issues,
      failureKinds,
      "maliciousContracts",
      "Expected maliciousContracts array"
    );
    return null;
  }

  const parsed: TransactionLayer2MaliciousContractEntry[] = [];
  const seenKeys = new Set<string>();
  let previousKey = "";

  value.forEach((rawEntry, index) => {
    const entryPath = `maliciousContracts[${index}]`;

    if (!isRecord(rawEntry)) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "Expected malicious contract entry object"
      );
      return;
    }

    assertExactKeys(
      rawEntry,
      MALICIOUS_CONTRACT_KEYS,
      entryPath,
      issues,
      failureKinds
    );

    const chain = readRequiredString(
      rawEntry,
      "chain",
      entryPath,
      issues,
      failureKinds
    );
    const address = readRequiredString(
      rawEntry,
      "address",
      entryPath,
      issues,
      failureKinds
    );
    const source = readRequiredString(
      rawEntry,
      "source",
      entryPath,
      issues,
      failureKinds
    );
    const disposition = readRequiredString(
      rawEntry,
      "disposition",
      entryPath,
      issues,
      failureKinds
    );
    const confidence = readRequiredString(
      rawEntry,
      "confidence",
      entryPath,
      issues,
      failureKinds
    );
    const reason = readRequiredString(
      rawEntry,
      "reason",
      entryPath,
      issues,
      failureKinds
    );
    const reasonCodesRaw = rawEntry.reasonCodes;

    if (
      chain === null ||
      address === null ||
      source === null ||
      disposition === null ||
      confidence === null ||
      reason === null
    ) {
      return;
    }

    if (!isTransactionMaliciousContractChain(chain)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.chain`,
        "Unsupported chain in transaction snapshot",
        "incompatible"
      );
    }

    if (chain === "evm") {
      if (!isValidEvmAddress(address)) {
        pushIssue(
          issues,
          failureKinds,
          `${entryPath}.address`,
          "Expected a canonical EVM address",
          "incompatible"
        );
      }

      if (address !== normalizeEvmAddress(address)) {
        pushIssue(
          issues,
          failureKinds,
          `${entryPath}.address`,
          "Expected a lowercase canonical EVM address",
          "incompatible"
        );
      }

      if (address === ZERO_EVM_ADDRESS) {
        pushIssue(
          issues,
          failureKinds,
          `${entryPath}.address`,
          "Zero address is not allowed in transaction snapshot",
          "incompatible"
        );
      }
    }

    if (!isTransactionIntelSource(source)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.source`,
        "Unsupported malicious contract source",
        "incompatible"
      );
    }

    if (disposition !== "block" && disposition !== "warn") {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.disposition`,
        "Unsupported malicious contract disposition",
        "incompatible"
      );
    }

    if (!isTransactionIntelConfidence(confidence)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.confidence`,
        "Unsupported malicious contract confidence",
        "incompatible"
      );
    }

    if (
      isTransactionIntelSource(source) &&
      isTransactionIntelConfidence(confidence)
    ) {
      validateConfidenceForSource(
        source,
        confidence,
        `${entryPath}.confidence`,
        issues,
        failureKinds
      );
    }

    if (!Array.isArray(reasonCodesRaw)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.reasonCodes`,
        "Expected reasonCodes array"
      );
      return;
    }

    const reasonCodes = reasonCodesRaw.map((reasonCode, reasonIndex) => {
      if (typeof reasonCode !== "string" || reasonCode.trim() === "") {
        pushIssue(
          issues,
          failureKinds,
          `${entryPath}.reasonCodes[${reasonIndex}]`,
          "Expected a non-empty reason code string"
        );
        return "";
      }

      return reasonCode;
    });

    if (reasonCodes.length === 0) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.reasonCodes`,
        "Expected at least one reason code"
      );
    }

    const dedupeKey = `${chain}:${address}`;
    if (seenKeys.has(dedupeKey)) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "Duplicate malicious contract entry",
        "incompatible"
      );
    } else {
      seenKeys.add(dedupeKey);
    }

    if (dedupeKey < previousKey) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "maliciousContracts entries must be sorted by chain and address",
        "incompatible"
      );
    }
    previousKey = dedupeKey;

    parsed.push({
      chain: isTransactionMaliciousContractChain(chain) ? chain : "evm",
      address,
      source: isTransactionIntelSource(source) ? source : "internal",
      disposition: disposition === "block" ? "block" : "warn",
      confidence: isTransactionIntelConfidence(confidence)
        ? confidence
        : "low",
      reason,
      reasonCodes,
    });
  });

  return parsed;
}

function parseScamSignatures(
  value: unknown,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): readonly TransactionLayer2ScamSignature[] | null {
  if (!Array.isArray(value)) {
    pushIssue(
      issues,
      failureKinds,
      "scamSignatures",
      "Expected scamSignatures array"
    );
    return null;
  }

  const parsed: TransactionLayer2ScamSignature[] = [];
  const seenHashes = new Set<string>();
  let previousHash = "";

  value.forEach((rawEntry, index) => {
    const entryPath = `scamSignatures[${index}]`;

    if (!isRecord(rawEntry)) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "Expected scam signature entry object"
      );
      return;
    }

    assertExactKeys(
      rawEntry,
      SCAM_SIGNATURE_KEYS,
      entryPath,
      issues,
      failureKinds
    );

    const signatureHash = readRequiredString(
      rawEntry,
      "signatureHash",
      entryPath,
      issues,
      failureKinds
    );
    const source = readRequiredString(
      rawEntry,
      "source",
      entryPath,
      issues,
      failureKinds
    );
    const confidence = readRequiredString(
      rawEntry,
      "confidence",
      entryPath,
      issues,
      failureKinds
    );
    const reason = readRequiredString(
      rawEntry,
      "reason",
      entryPath,
      issues,
      failureKinds
    );

    if (
      signatureHash === null ||
      source === null ||
      confidence === null ||
      reason === null
    ) {
      return;
    }

    if (!isValidSignatureHash(signatureHash)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.signatureHash`,
        "Expected a lowercase 32-byte hex signature hash",
        "incompatible"
      );
    }

    if (!SCAM_SIGNATURE_SOURCE_SET.has(source as TransactionIntelSource)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.source`,
        "Unsupported scam signature source",
        "incompatible"
      );
    }

    if (!isTransactionIntelConfidence(confidence)) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.confidence`,
        "Unsupported scam signature confidence",
        "incompatible"
      );
    }

    if (
      SCAM_SIGNATURE_SOURCE_SET.has(source as TransactionIntelSource) &&
      isTransactionIntelConfidence(confidence)
    ) {
      validateConfidenceForSource(
        source as TransactionIntelSource,
        confidence,
        `${entryPath}.confidence`,
        issues,
        failureKinds
      );
    }

    if (seenHashes.has(signatureHash)) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "Duplicate scam signature entry",
        "incompatible"
      );
    } else {
      seenHashes.add(signatureHash);
    }

    if (signatureHash < previousHash) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "scamSignatures entries must be sorted by signatureHash",
        "incompatible"
      );
    }
    previousHash = signatureHash;

    parsed.push({
      signatureHash,
      source:
        source === "chainabuse" || source === "internal"
          ? source
          : "internal",
      confidence: isTransactionIntelConfidence(confidence)
        ? confidence
        : "low",
      reason,
    });
  });

  return parsed;
}

function toFailureStatus(
  failureKinds: readonly ("malformed" | "incompatible")[]
): "malformed" | "incompatible" {
  return failureKinds.includes("incompatible") ? "incompatible" : "malformed";
}

export function validateTransactionLayer2Snapshot(
  input: unknown
): ValidateTransactionLayer2SnapshotResult {
  const issues: TransactionLayer2SnapshotValidationIssue[] = [];
  const failureKinds: Array<"malformed" | "incompatible"> = [];

  if (!isRecord(input)) {
    pushIssue(issues, failureKinds, "", "Expected snapshot object");
    return {
      ok: false,
      status: "malformed",
      issues,
    };
  }

  assertExactKeys(input, ROOT_KEYS, "", issues, failureKinds);

  const version = readRequiredString(input, "version", "", issues, failureKinds);
  const generatedAt = readRequiredString(
    input,
    "generatedAt",
    "",
    issues,
    failureKinds
  );
  const maliciousContracts = parseMaliciousContracts(
    input.maliciousContracts,
    issues,
    failureKinds
  );
  const scamSignatures = parseScamSignatures(
    input.scamSignatures,
    issues,
    failureKinds
  );
  const metadata = parseMetadata(input.metadata, issues, failureKinds);
  const sectionStates = parseSectionStates(
    input.sectionStates,
    issues,
    failureKinds
  );

  if (generatedAt !== null && !isValidUtcTimestamp(generatedAt)) {
    pushIssue(
      issues,
      failureKinds,
      "generatedAt",
      "Expected an ISO-8601 UTC timestamp"
    );
  }

  if (version !== null && !/^layer2\.[0-9a-f]{16}$/.test(version)) {
    pushIssue(
      issues,
      failureKinds,
      "version",
      "Unsupported snapshot version format",
      "incompatible"
    );
  }

  if (
    maliciousContracts === null ||
    scamSignatures === null ||
    metadata === null ||
    sectionStates === null ||
    version === null ||
    generatedAt === null
  ) {
    return {
      ok: false,
      status: toFailureStatus(failureKinds),
      issues,
    };
  }

  if (generatedAt !== metadata.generatedAt) {
    pushIssue(
      issues,
      failureKinds,
      "metadata.generatedAt",
      "metadata.generatedAt must match root generatedAt",
      "incompatible"
    );
  }

  if (
    maliciousContracts.length > 0 &&
    sectionStates.maliciousContracts === "missing"
  ) {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates.maliciousContracts",
      "maliciousContracts section cannot be missing when entries are present",
      "incompatible"
    );
  }

  if (
    scamSignatures.length > 0 &&
    sectionStates.scamSignatures === "missing"
  ) {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates.scamSignatures",
      "scamSignatures section cannot be missing when entries are present",
      "incompatible"
    );
  }

  maliciousContracts.forEach((entry, index) => {
    if (!metadata.sources.includes(entry.source)) {
      pushIssue(
        issues,
        failureKinds,
        `maliciousContracts[${index}].source`,
        "Entry source must appear in metadata.sources",
        "incompatible"
      );
    }
  });

  scamSignatures.forEach((entry, index) => {
    if (!metadata.sources.includes(entry.source)) {
      pushIssue(
        issues,
        failureKinds,
        `scamSignatures[${index}].source`,
        "Entry source must appear in metadata.sources",
        "incompatible"
      );
    }
  });

  const snapshotBody: Omit<TransactionLayer2Snapshot, "version"> = {
    generatedAt,
    maliciousContracts,
    scamSignatures,
    metadata,
    sectionStates,
  };

  const expectedVersion = buildSnapshotVersion(snapshotBody);
  if (version !== expectedVersion) {
    pushIssue(
      issues,
      failureKinds,
      "version",
      `Snapshot version does not match canonical content hash (${expectedVersion})`,
      "incompatible"
    );
  }

  if (issues.length > 0) {
    return {
      ok: false,
      status: toFailureStatus(failureKinds),
      issues,
    };
  }

  const snapshot: ValidatedTransactionLayer2Snapshot = deepFreeze({
    version,
    generatedAt,
    maliciousContracts,
    scamSignatures,
    metadata,
    sectionStates,
  });

  return {
    ok: true,
    status:
      maliciousContracts.length === 0 && scamSignatures.length === 0
        ? "empty"
        : "valid",
    snapshot,
    issues,
  };
}

export function buildEmptyValidatedTransactionLayer2Snapshot(
  generatedAt: string = EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT
): ValidatedTransactionLayer2Snapshot {
  const canonicalGeneratedAt = isValidUtcTimestamp(generatedAt)
    ? generatedAt
    : EMPTY_TRANSACTION_LAYER2_SNAPSHOT_GENERATED_AT;
  const snapshotBody: Omit<TransactionLayer2Snapshot, "version"> = {
    generatedAt: canonicalGeneratedAt,
    maliciousContracts: [],
    scamSignatures: [],
    metadata: {
      generatedAt: canonicalGeneratedAt,
      sources: [],
    },
    sectionStates: {
      maliciousContracts: "missing",
      scamSignatures: "missing",
    },
  };

  return deepFreeze({
    version: buildSnapshotVersion(snapshotBody),
    ...snapshotBody,
  });
}
