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

export type CanonicalTransactionSnapshotSectionState =
  | "ready"
  | "stale"
  | "missing";

export interface TransactionLayer2SnapshotValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface TransactionLayer2MaliciousContract {
  readonly chain: "evm";
  readonly address: string;
  readonly source: "ofac" | "chainabuse";
  readonly disposition: "block" | "warn";
  readonly confidence: number;
  readonly reasonCodes: readonly string[];
}

export interface TransactionLayer2Snapshot {
  readonly version: string;
  readonly generatedAt: string;
  readonly maliciousContracts: readonly TransactionLayer2MaliciousContract[];
  readonly scamSignatures: readonly [];
  readonly sectionStates: {
    readonly maliciousContracts: CanonicalTransactionSnapshotSectionState;
    readonly scamSignatures: "missing";
  };
}

export interface ValidatedTransactionLayer2Snapshot
  extends TransactionLayer2Snapshot {
  readonly maliciousContractIndex: Readonly<
    Record<string, TransactionLayer2MaliciousContract>
  >;
}

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
}

export interface TrustedTransactionOriginIntel {
  readonly originDisposition: TransactionIntelContext["originDisposition"];
  readonly allowlistFeedVersion: string | null;
  readonly allowlistsState: TransactionLayer2SectionState;
}

const ROOT_KEYS = [
  "version",
  "generatedAt",
  "maliciousContracts",
  "scamSignatures",
  "sectionStates",
] as const;

const MALICIOUS_CONTRACT_KEYS = [
  "chain",
  "address",
  "source",
  "disposition",
  "confidence",
  "reasonCodes",
] as const;

const SECTION_STATE_KEYS = ["maliciousContracts", "scamSignatures"] as const;
const ZERO_EVM_ADDRESS = "0x0000000000000000000000000000000000000000";

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

function readRequiredNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): number | null {
  const candidate = value[key];

  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    pushIssue(
      issues,
      failureKinds,
      path === "" ? key : `${path}.${key}`,
      "Expected a finite number"
    );
    return null;
  }

  return candidate;
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
        reasonCodes: entry.reasonCodes,
      })),
      scamSignatures: snapshotBody.scamSignatures,
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

  if (scamSignatures !== "missing") {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates.scamSignatures",
      "Unsupported scamSignatures state for this snapshot schema",
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
    scamSignatures: "missing",
  };
}

function parseMaliciousContracts(
  value: unknown,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): readonly TransactionLayer2MaliciousContract[] | null {
  if (!Array.isArray(value)) {
    pushIssue(
      issues,
      failureKinds,
      "maliciousContracts",
      "Expected maliciousContracts array"
    );
    return null;
  }

  const parsed: TransactionLayer2MaliciousContract[] = [];
  const seenKeys = new Set<string>();
  let previousAddress = "";

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
    const confidence = readRequiredNumber(
      rawEntry,
      "confidence",
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
      confidence === null
    ) {
      return;
    }

    if (chain !== "evm") {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.chain`,
        "Unsupported chain in transaction snapshot",
        "incompatible"
      );
    }

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

    if (source !== "ofac" && source !== "chainabuse") {
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

    if (confidence < 0 || confidence > 1) {
      pushIssue(
        issues,
        failureKinds,
        `${entryPath}.confidence`,
        "Expected confidence to be between 0 and 1"
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

    if (address < previousAddress) {
      pushIssue(
        issues,
        failureKinds,
        entryPath,
        "maliciousContracts entries must be sorted by address",
        "incompatible"
      );
    }
    previousAddress = address;

    parsed.push({
      chain: "evm",
      address,
      source: source === "ofac" ? "ofac" : "chainabuse",
      disposition: disposition === "block" ? "block" : "warn",
      confidence,
      reasonCodes,
    });
  });

  return parsed;
}

function parseScamSignatures(
  value: unknown,
  issues: TransactionLayer2SnapshotValidationIssue[],
  failureKinds: Array<"malformed" | "incompatible">
): readonly [] | null {
  if (!Array.isArray(value)) {
    pushIssue(
      issues,
      failureKinds,
      "scamSignatures",
      "Expected scamSignatures array"
    );
    return null;
  }

  if (value.length > 0) {
    pushIssue(
      issues,
      failureKinds,
      "scamSignatures",
      "Unsupported non-empty scamSignatures section for this snapshot schema",
      "incompatible"
    );
  }

  return [];
}

function toFailureStatus(
  failureKinds: readonly ("malformed" | "incompatible")[]
): "malformed" | "incompatible" {
  return failureKinds.includes("incompatible") ? "incompatible" : "malformed";
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

  if (
    maliciousContracts.length === 0 &&
    sectionStates.maliciousContracts !== "missing"
  ) {
    pushIssue(
      issues,
      failureKinds,
      "sectionStates.maliciousContracts",
      "Empty maliciousContracts snapshots must declare a missing section",
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

  const snapshotBody: Omit<TransactionLayer2Snapshot, "version"> = {
    generatedAt,
    maliciousContracts,
    scamSignatures,
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

  const maliciousContractIndex = maliciousContracts.reduce<
    Record<string, TransactionLayer2MaliciousContract>
  >((accumulator, entry) => {
    accumulator[`${entry.chain}:${entry.address}`] = entry;
    return accumulator;
  }, {});

  const snapshot: ValidatedTransactionLayer2Snapshot = deepFreeze({
    version,
    generatedAt,
    maliciousContracts,
    scamSignatures,
    sectionStates,
    maliciousContractIndex,
  });

  return {
    ok: true,
    status: maliciousContracts.length === 0 ? "empty" : "valid",
    snapshot,
    issues,
  };
}

function normalizeLookupAddress(value: string | null): string | null {
  if (value === null || !isValidEvmAddress(value)) {
    return null;
  }

  const normalized = normalizeEvmAddress(value);
  return normalized === ZERO_EVM_ADDRESS ? null : normalized;
}

export function resolveCanonicalTransactionIntel(
  snapshot: ValidatedTransactionLayer2Snapshot | null,
  lookup: CanonicalTransactionIntelLookup,
  trustedOriginIntel: TrustedTransactionOriginIntel
): TransactionIntelContext {
  const defaultSectionStates = {
    maliciousContracts: "missing",
    scamSignatures: "missing",
    allowlists: trustedOriginIntel.allowlistsState,
  } as const;

  if (snapshot === null) {
    return {
      contractDisposition: "unavailable",
      contractFeedVersion: null,
      allowlistFeedVersion: trustedOriginIntel.allowlistFeedVersion,
      signatureDisposition: "unavailable",
      signatureFeedVersion: null,
      originDisposition: trustedOriginIntel.originDisposition,
      sectionStates: defaultSectionStates,
    };
  }

  const targetAddress = normalizeLookupAddress(lookup.targetAddress);
  const maliciousContractsState = mapSnapshotSectionState(
    snapshot.sectionStates.maliciousContracts
  );
  const scamSignaturesState = mapSnapshotSectionState(
    snapshot.sectionStates.scamSignatures
  );

  const contractDisposition =
    snapshot.sectionStates.maliciousContracts === "missing"
      ? "unavailable"
      : targetAddress !== null &&
          snapshot.maliciousContractIndex[`evm:${targetAddress}`] !== undefined
        ? "malicious"
        : "no_match";

  const signatureDisposition =
    snapshot.sectionStates.scamSignatures === "missing"
      ? "unavailable"
      : "no_match";

  return {
    contractDisposition,
    contractFeedVersion:
      snapshot.sectionStates.maliciousContracts === "missing"
        ? null
        : snapshot.version,
    allowlistFeedVersion: trustedOriginIntel.allowlistFeedVersion,
    signatureDisposition,
    signatureFeedVersion:
      snapshot.sectionStates.scamSignatures === "missing"
        ? null
        : snapshot.version,
    originDisposition: trustedOriginIntel.originDisposition,
    sectionStates: {
      maliciousContracts: maliciousContractsState,
      scamSignatures: scamSignaturesState,
      allowlists: trustedOriginIntel.allowlistsState,
    },
  };
}
