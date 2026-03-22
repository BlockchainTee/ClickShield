import { isValidEvmAddress, normalizeEvmAddress } from "../normalize/address.js";
import type {
  NormalizedTypedData,
  PermitKind,
  RawTypedDataPayload,
  TypedDataField,
  TypedDataTypes,
  TypedDataValue,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTypedDataField(value: unknown): value is TypedDataField {
  if (!isRecord(value)) return false;
  return typeof value.name === "string" && typeof value.type === "string";
}

function parseTypedDataPayload(
  input: string | RawTypedDataPayload
): RawTypedDataPayload {
  if (typeof input === "string") {
    const parsed: unknown = JSON.parse(input);
    if (!isRecord(parsed)) {
      throw new Error("Typed data payload must be an object.");
    }
    return parsed;
  }

  return input;
}

function normalizeTypes(value: RawTypedDataPayload["types"]): TypedDataTypes {
  if (!value || !isRecord(value)) {
    return {};
  }

  const entries: Array<[string, readonly TypedDataField[]]> = [];
  for (const key of Object.keys(value).sort()) {
    const fields = value[key];
    if (!Array.isArray(fields)) continue;
    const normalizedFields = fields.filter(isTypedDataField).map((field) => ({
      name: field.name,
      type: field.type,
    }));
    entries.push([key, normalizedFields]);
  }

  return Object.fromEntries(entries);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeNumericString(value: unknown): string | null {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "bigint"
  ) {
    return null;
  }

  const raw = typeof value === "string" ? value.trim() : `${value}`;
  if (raw === "") return null;

  try {
    if (/^0x[0-9a-fA-F]+$/.test(raw)) {
      return BigInt(raw).toString(10);
    }

    if (/^-?[0-9]+$/.test(raw)) {
      return BigInt(raw).toString(10);
    }
  } catch {
    return raw;
  }

  return raw;
}

function isCanonicalDecimalString(value: string | null): boolean {
  return value !== null && /^[0-9]+$/.test(value);
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function stripArraySuffix(type: string): string | null {
  const match = type.match(/^(.*)\[[0-9]*\]$/);
  return match ? match[1] : null;
}

function normalizeUnknownObject(value: Record<string, unknown>): {
  readonly [key: string]: TypedDataValue;
} {
  const entries: Array<[string, TypedDataValue]> = [];
  for (const key of Object.keys(value).sort()) {
    entries.push([key, normalizeTypedDataValue(value[key], null, {})]);
  }
  return Object.fromEntries(entries);
}

function normalizeStructuredValue(
  value: Record<string, unknown>,
  structName: string,
  types: TypedDataTypes
): { readonly [key: string]: TypedDataValue } {
  const fieldMap = new Map<string, string>();
  for (const field of types[structName] ?? []) {
    fieldMap.set(field.name, field.type);
  }

  const entries: Array<[string, TypedDataValue]> = [];
  for (const key of Object.keys(value).sort()) {
    entries.push([
      key,
      normalizeTypedDataValue(value[key], fieldMap.get(key) ?? null, types),
    ]);
  }

  return Object.fromEntries(entries);
}

function normalizeTypedDataValue(
  value: unknown,
  solidityType: string | null,
  types: TypedDataTypes
): TypedDataValue {
  if (value === null || value === undefined) return null;

  if (solidityType !== null) {
    const arrayInnerType = stripArraySuffix(solidityType);
    if (arrayInnerType !== null) {
      if (!Array.isArray(value)) return [];
      return value.map((item) =>
        normalizeTypedDataValue(item, arrayInnerType, types)
      );
    }

    if (solidityType === "address") {
      const normalized = normalizeString(value);
      return normalized === null ? null : normalizeEvmAddress(normalized);
    }

    if (
      solidityType.startsWith("uint") ||
      solidityType.startsWith("int")
    ) {
      return normalizeNumericString(value);
    }

    if (solidityType === "bool") {
      return normalizeBoolean(value);
    }

    if (solidityType === "string" || solidityType.startsWith("bytes")) {
      return normalizeString(value);
    }

    if (types[solidityType] && isRecord(value)) {
      return normalizeStructuredValue(value, solidityType, types);
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTypedDataValue(item, null, types));
  }

  if (isRecord(value)) {
    return normalizeUnknownObject(value);
  }

  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return `${value}`;
  }

  return `${value}`;
}

function stableStringify(value: TypedDataValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as { readonly [key: string]: TypedDataValue };
  const parts = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${parts.join(",")}}`;
}

function serializeTypesForCanonical(types: TypedDataTypes): {
  readonly [key: string]: TypedDataValue;
} {
  const entries: Array<[string, TypedDataValue]> = [];

  for (const key of Object.keys(types).sort()) {
    const fields = types[key] ?? [];
    entries.push([
      key,
      fields.map((field) => ({
        name: field.name,
        type: field.type,
      })),
    ]);
  }

  return Object.fromEntries(entries);
}

export function classifyPermitKind(primaryType: string | null): PermitKind {
  if (primaryType === null) return "none";

  const normalized = primaryType.trim().toLowerCase();
  if (normalized === "") return "none";
  if (normalized === "permit") return "erc20_permit";
  if (normalized === "permitsingle") return "permit2_single";
  if (normalized === "permitbatch") return "permit2_batch";
  if (normalized.includes("permit")) return "unknown_permit";
  return "none";
}

export function normalizeTypedData(
  input: string | RawTypedDataPayload
): NormalizedTypedData {
  const payload = parseTypedDataPayload(input);
  const types = normalizeTypes(payload.types ?? null);
  const primaryType = normalizeString(payload.primaryType);
  const domainInput = isRecord(payload.domain) ? payload.domain : {};
  const messageInput = isRecord(payload.message) ? payload.message : {};

  const domainType = types.EIP712Domain ? "EIP712Domain" : null;
  const normalizedDomain = normalizeTypedDataValue(
    domainInput,
    domainType,
    types
  );
  const normalizedMessage = normalizeTypedDataValue(
    messageInput,
    primaryType,
    types
  );

  const domain = (
    normalizedDomain !== null &&
    !Array.isArray(normalizedDomain) &&
    typeof normalizedDomain === "object"
      ? normalizedDomain
      : {}
  ) as { readonly [key: string]: TypedDataValue };

  const message = (
    normalizedMessage !== null &&
    !Array.isArray(normalizedMessage) &&
    typeof normalizedMessage === "object"
      ? normalizedMessage
      : {}
  ) as { readonly [key: string]: TypedDataValue };

  const domainName =
    typeof domain.name === "string" ? domain.name : normalizeString(domainInput.name);
  const domainVersion =
    typeof domain.version === "string"
      ? domain.version
      : normalizeString(domainInput.version);

  const domainChainIdPresent = Object.prototype.hasOwnProperty.call(
    domainInput,
    "chainId"
  );
  const normalizedDomainChainId = domainChainIdPresent
    ? normalizeNumericString(domainInput.chainId)
    : null;

  const verifyingContractPresent = Object.prototype.hasOwnProperty.call(
    domainInput,
    "verifyingContract"
  );
  const verifyingContractRaw = verifyingContractPresent
    ? normalizeString(domainInput.verifyingContract)
    : null;

  const missingDomainFields: string[] = [];
  const invalidDomainFields: string[] = [];
  if (!domainChainIdPresent) {
    missingDomainFields.push("domain.chainId");
  }
  if (!verifyingContractPresent) {
    missingDomainFields.push("domain.verifyingContract");
  }

  const domainChainId =
    domainChainIdPresent && isCanonicalDecimalString(normalizedDomainChainId)
      ? normalizedDomainChainId
      : null;
  const hasValidDomainChainId = domainChainId !== null;
  if (domainChainIdPresent && !hasValidDomainChainId) {
    invalidDomainFields.push("domain.chainId");
  }

  const verifyingContract =
    verifyingContractRaw !== null && isValidEvmAddress(verifyingContractRaw)
      ? normalizeEvmAddress(verifyingContractRaw)
      : null;
  const hasValidVerifyingContract = verifyingContract !== null;
  if (verifyingContractPresent && !hasValidVerifyingContract) {
    invalidDomainFields.push("domain.verifyingContract");
  }

  const normalizationState =
    invalidDomainFields.length > 0
      ? "invalid_domain_fields"
      : missingDomainFields.length > 0
        ? "missing_domain_fields"
        : "normalized";

  const canonicalRoot = {
    domain,
    message,
    primaryType,
    types: serializeTypesForCanonical(types),
  } as const;

  return {
    isTypedData: true,
    primaryType,
    domainName,
    domainVersion,
    domainChainId,
    domainChainIdPresent: hasValidDomainChainId,
    verifyingContract,
    verifyingContractPresent: hasValidVerifyingContract,
    message,
    domain,
    types,
    canonicalJson: stableStringify(canonicalRoot),
    normalizationState,
    missingDomainFields,
    invalidDomainFields,
    permitKind: classifyPermitKind(primaryType),
  };
}
