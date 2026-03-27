export const DEFAULT_CHAINABUSE_CONFIDENCE_THRESHOLD = 0.7;

const EVM_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EVM_ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/g;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type Layer2SectionState = "ready" | "stale" | "missing";

export interface OfacRecord {
  readonly address: string;
  readonly source: "ofac";
  readonly disposition: "block";
  readonly confidence: 1;
  readonly reasonCodes: readonly ["OFAC_SANCTIONS_ADDRESS"];
}

export interface ChainabuseRecord {
  readonly address: string;
  readonly source: "chainabuse";
  readonly confidence: number;
  readonly disposition: "warn";
  readonly reportCount: number;
  readonly reasonCodes: readonly ["CHAINABUSE_CHECKED_REPORT"];
}

export type Layer2CompilerSource = "chainabuse" | "ofac";
export type Layer2CanonicalConfidence = "high" | "medium" | "low";

export interface Layer2MaliciousContract {
  readonly chain: "evm";
  readonly address: string;
  readonly source: Layer2CompilerSource;
  readonly disposition: "block" | "warn";
  readonly confidence: Layer2CanonicalConfidence;
  readonly reason: string;
  readonly reasonCodes: readonly string[];
}

export interface Layer2Snapshot {
  readonly version: string;
  readonly generatedAt: string;
  readonly maliciousContracts: readonly Layer2MaliciousContract[];
  readonly scamSignatures: readonly [];
  readonly metadata: {
    readonly generatedAt: string;
    readonly sources: readonly Layer2CompilerSource[];
  };
  readonly sectionStates: {
    readonly maliciousContracts: Layer2SectionState;
    readonly scamSignatures: "missing";
  };
}

export interface NormalizeLayer2RecordsResult {
  readonly records: readonly Layer2MaliciousContract[];
  readonly sources: readonly Layer2CompilerSource[];
}

const OFAC_REASON_CODES = ["OFAC_SANCTIONS_ADDRESS"] as const;
const CHAINABUSE_REASON_CODES = ["CHAINABUSE_CHECKED_REPORT"] as const;

// Compiler precedence is deterministic and source-driven:
// OFAC block entries outrank Chainabuse warn entries for the same address.
const SOURCE_PRECEDENCE: Readonly<Record<Layer2CompilerSource, number>> =
  Object.freeze({
    chainabuse: 1,
    ofac: 2,
  });

const DISPOSITION_PRECEDENCE: Readonly<
  Record<Layer2MaliciousContract["disposition"], number>
> = Object.freeze({
  warn: 1,
  block: 2,
});

const CONFIDENCE_PRECEDENCE: Readonly<Record<Layer2CanonicalConfidence, number>> =
  Object.freeze({
    low: 1,
    medium: 2,
    high: 3,
  });

function failNormalization(message: string): never {
  throw new Error(`Layer 2 normalization rejected malformed input: ${message}`);
}

function assertExactReasonCodes(
  actual: readonly string[],
  expected: readonly string[],
  sourceLabel: string
): void {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    failNormalization(
      `${sourceLabel} reasonCodes must be exactly ${expected.join(", ")}.`
    );
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePotentialEvmAddress(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(trimmed)) {
    return null;
  }

  if (trimmed === EVM_ZERO_ADDRESS) {
    return null;
  }

  return trimmed;
}

export function extractEvmAddressesFromText(text: string): readonly string[] {
  const matches = text.match(EVM_ADDRESS_PATTERN) ?? [];
  const addresses = new Set<string>();

  for (const match of matches) {
    const normalized = normalizePotentialEvmAddress(match);
    if (normalized) {
      addresses.add(normalized);
    }
  }

  return [...addresses].sort();
}

export function readBoolean(
  record: Record<string, unknown>,
  keys: readonly string[]
): boolean | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

export function readNumber(
  record: Record<string, unknown>,
  keys: readonly string[]
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function readArray(
  record: Record<string, unknown>,
  keys: readonly string[]
): readonly unknown[] | null {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
}

function mapOfacRecordToCanonicalContract(
  record: OfacRecord,
  index: number
): Layer2MaliciousContract {
  const normalizedAddress = normalizePotentialEvmAddress(record.address);
  if (normalizedAddress === null || normalizedAddress !== record.address) {
    failNormalization(
      `OFAC record[${index}] address must be a lowercase canonical EVM address.`
    );
  }

  if (record.source !== "ofac") {
    failNormalization(`OFAC record[${index}] source must be "ofac".`);
  }

  if (record.disposition !== "block") {
    failNormalization(`OFAC record[${index}] disposition must be "block".`);
  }

  if (record.confidence !== 1) {
    failNormalization(`OFAC record[${index}] confidence must be 1.`);
  }

  assertExactReasonCodes(record.reasonCodes, OFAC_REASON_CODES, `OFAC record[${index}]`);

  // OFAC is limited to sanctioned address/entity intelligence.
  return {
    chain: "evm",
    address: normalizedAddress,
    source: "ofac",
    disposition: "block",
    confidence: "high",
    reason: "OFAC sanctions list match",
    reasonCodes: [...record.reasonCodes],
  };
}

function mapChainabuseConfidence(
  record: ChainabuseRecord
): Layer2CanonicalConfidence {
  return record.reportCount > 1 ? "medium" : "low";
}

function mapChainabuseRecordToCanonicalContract(
  record: ChainabuseRecord,
  index: number
): Layer2MaliciousContract {
  const normalizedAddress = normalizePotentialEvmAddress(record.address);
  if (normalizedAddress === null || normalizedAddress !== record.address) {
    failNormalization(
      `Chainabuse record[${index}] address must be a lowercase canonical EVM address.`
    );
  }

  if (record.source !== "chainabuse") {
    failNormalization(
      `Chainabuse record[${index}] source must be "chainabuse".`
    );
  }

  if (record.disposition !== "warn") {
    failNormalization(
      `Chainabuse record[${index}] disposition must be "warn".`
    );
  }

  if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) {
    failNormalization(
      `Chainabuse record[${index}] confidence must be a finite number between 0 and 1.`
    );
  }

  if (!Number.isInteger(record.reportCount) || record.reportCount < 1) {
    failNormalization(
      `Chainabuse record[${index}] reportCount must be a positive integer.`
    );
  }

  assertExactReasonCodes(
    record.reasonCodes,
    CHAINABUSE_REASON_CODES,
    `Chainabuse record[${index}]`
  );

  // Chainabuse is limited to scam/suspicious-address intelligence.
  return {
    chain: "evm",
    address: normalizedAddress,
    source: "chainabuse",
    disposition: "warn",
    confidence: mapChainabuseConfidence(record),
    reason:
      record.reportCount > 1
        ? "Chainabuse checked reports indicate suspicious activity"
        : "Chainabuse checked report indicates suspicious activity",
    reasonCodes: [...record.reasonCodes],
  };
}

function compareReasonCodes(
  left: readonly string[],
  right: readonly string[]
): number {
  return left.join("\u0000").localeCompare(right.join("\u0000"));
}

function compareMaliciousContractPrecedence(
  left: Layer2MaliciousContract,
  right: Layer2MaliciousContract
): number {
  const sourceDelta = SOURCE_PRECEDENCE[left.source] - SOURCE_PRECEDENCE[right.source];
  if (sourceDelta !== 0) {
    return sourceDelta;
  }

  const dispositionDelta =
    DISPOSITION_PRECEDENCE[left.disposition] -
    DISPOSITION_PRECEDENCE[right.disposition];
  if (dispositionDelta !== 0) {
    return dispositionDelta;
  }

  const confidenceDelta =
    CONFIDENCE_PRECEDENCE[left.confidence] -
    CONFIDENCE_PRECEDENCE[right.confidence];
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  const reasonDelta = left.reason.localeCompare(right.reason);
  if (reasonDelta !== 0) {
    return reasonDelta;
  }

  return compareReasonCodes(left.reasonCodes, right.reasonCodes);
}

export function normalizeLayer2Records(input: {
  readonly ofacRecords: readonly OfacRecord[];
  readonly chainabuseRecords: readonly ChainabuseRecord[];
}): NormalizeLayer2RecordsResult {
  const ordered = new Map<string, Layer2MaliciousContract>();
  const sources = new Set<Layer2CompilerSource>();

  for (const [index, record] of [...input.ofacRecords]
    .sort((left, right) => left.address.localeCompare(right.address))
    .entries()) {
    const mapped = mapOfacRecordToCanonicalContract(record, index);
    sources.add(mapped.source);
    const current = ordered.get(mapped.address);
    if (
      current === undefined ||
      compareMaliciousContractPrecedence(mapped, current) > 0
    ) {
      ordered.set(mapped.address, mapped);
    }
  }

  for (const [index, record] of [...input.chainabuseRecords]
    .sort((left, right) => left.address.localeCompare(right.address))
    .entries()) {
    const mapped = mapChainabuseRecordToCanonicalContract(record, index);
    sources.add(mapped.source);
    const current = ordered.get(mapped.address);
    if (
      current === undefined ||
      compareMaliciousContractPrecedence(mapped, current) > 0
    ) {
      ordered.set(mapped.address, mapped);
    }
  }

  return {
    records: [...ordered.values()].sort((left, right) =>
      left.address.localeCompare(right.address)
    ),
    sources: [...sources].sort(),
  };
}

export function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }

  if (isRecord(value)) {
    const sortedEntries = Object.keys(value)
      .sort()
      .map((key) => [key, sortJsonValue(value[key] as JsonValue)] as const);

    const sortedObject: Record<string, JsonValue> = {};
    for (const [key, entryValue] of sortedEntries) {
      sortedObject[key] = entryValue;
    }

    return sortedObject;
  }

  return value;
}

export function toCanonicalJson(value: JsonValue): string {
  return JSON.stringify(sortJsonValue(value));
}

export function toPrettyJson(value: JsonValue): string {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}
