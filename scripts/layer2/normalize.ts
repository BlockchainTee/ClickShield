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

export interface Layer2MaliciousContract {
  readonly chain: "evm";
  readonly address: string;
  readonly source: "ofac" | "chainabuse";
  readonly disposition: "block" | "warn";
  readonly confidence: number;
  readonly reasonCodes: readonly string[];
}

export interface Layer2Snapshot {
  readonly version: string;
  readonly generatedAt: string;
  readonly maliciousContracts: readonly Layer2MaliciousContract[];
  readonly scamSignatures: readonly [];
  readonly sectionStates: {
    readonly maliciousContracts: Layer2SectionState;
    readonly scamSignatures: "missing";
  };
}

export interface NormalizeLayer2RecordsResult {
  readonly records: readonly Layer2MaliciousContract[];
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

export function normalizeLayer2Records(input: {
  readonly ofacRecords: readonly OfacRecord[];
  readonly chainabuseRecords: readonly ChainabuseRecord[];
}): NormalizeLayer2RecordsResult {
  const ordered = new Map<string, Layer2MaliciousContract>();

  for (const record of [...input.ofacRecords].sort((left, right) =>
    left.address.localeCompare(right.address)
  )) {
    ordered.set(record.address, {
      chain: "evm",
      address: record.address,
      source: record.source,
      disposition: record.disposition,
      confidence: record.confidence,
      reasonCodes: [...record.reasonCodes],
    });
  }

  for (const record of [...input.chainabuseRecords].sort((left, right) =>
    left.address.localeCompare(right.address)
  )) {
    if (ordered.has(record.address)) {
      continue;
    }

    ordered.set(record.address, {
      chain: "evm",
      address: record.address,
      source: record.source,
      disposition: record.disposition,
      confidence: record.confidence,
      reasonCodes: [...record.reasonCodes],
    });
  }

  return {
    records: [...ordered.values()].sort((left, right) =>
      left.address.localeCompare(right.address)
    ),
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
