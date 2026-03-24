import { BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD } from "./constants.js";
import { buildStableId } from "./ids.js";
import type {
  BitcoinAddressRole,
  BitcoinAddressSummaryInput,
  BitcoinAddressType,
  BitcoinHygieneRecordInput,
  BitcoinWalletScanEvaluationInput,
  BitcoinUtxoSummaryInput,
  NormalizedBitcoinAddressSummary,
  NormalizedBitcoinHygieneRecord,
  NormalizedBitcoinUtxoSummary,
  NormalizedBitcoinWalletSnapshot,
} from "./types.js";
import {
  normalizeBitcoinAddress,
  normalizeMetadata,
} from "./utils.js";

function parseIntegerString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !/^[0-9]+$/.test(trimmed)) {
    return null;
  }

  return BigInt(trimmed).toString(10);
}

function parseNonNegativeInteger(
  value: number | null | undefined,
  fallback: number
): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function pickSourceSectionId(
  explicitSectionId: string | null | undefined,
  candidates: readonly string[]
): string | null {
  if (explicitSectionId) {
    return explicitSectionId;
  }

  return candidates[0] ?? null;
}

function findSectionIds(
  input: BitcoinWalletScanEvaluationInput,
  keywords: readonly string[]
): readonly string[] {
  const foreignChainMarkers = new Set(["evm", "solana"]);
  const bitcoinMarkers = new Set(["bitcoin", "btc"]);

  return input.snapshot.sections
    .filter((section) => {
      const haystacks = [
        section.sectionId,
        section.sectionType,
        section.label,
      ].map((value) => value.toLowerCase());
      const tokenLists = haystacks.map((haystack) =>
        haystack.split(/[^a-z0-9]+/).filter(Boolean)
      );
      const hasForeignChainMarker = tokenLists.some((tokens) =>
        tokens.some((token) => foreignChainMarkers.has(token))
      );

      if (hasForeignChainMarker) {
        return false;
      }

      const isBitcoinNativeSection = tokenLists.some(
        (tokens) => tokens[0] !== undefined && bitcoinMarkers.has(tokens[0])
      );

      if (!isBitcoinNativeSection) {
        return false;
      }

      return keywords.some((keyword) =>
        tokenLists.some((tokens) =>
          tokens.some((token) => token === keyword || token.startsWith(keyword))
        )
      );
    })
    .map((section) => section.sectionId)
    .sort();
}

function normalizeRole(
  role: BitcoinAddressSummaryInput["role"]
): BitcoinAddressRole {
  return role ?? "unknown";
}

function normalizeAddressType(
  addressType: BitcoinAddressSummaryInput["addressType"]
): BitcoinAddressType {
  return addressType ?? "other";
}

function normalizeAddressSummary(
  input: BitcoinAddressSummaryInput,
  walletAddress: string,
  defaultSectionIds: readonly string[]
): NormalizedBitcoinAddressSummary {
  const address = normalizeBitcoinAddress(input.address);
  const receiveCount = parseNonNegativeInteger(input.receiveCount, 0);
  const reuseCount = parseNonNegativeInteger(input.reuseCount, 0);
  const sourceSectionId = pickSourceSectionId(
    input.sourceSectionId,
    defaultSectionIds
  );

  return {
    resourceId: buildStableId("wallet_btc_address", {
      address,
      role: normalizeRole(input.role),
      walletAddress,
    }),
    address,
    addressType: normalizeAddressType(input.addressType),
    role: normalizeRole(input.role),
    receivedSats: parseIntegerString(input.receivedSats),
    spentSats: parseIntegerString(input.spentSats),
    balanceSats: parseIntegerString(input.balanceSats),
    receiveCount,
    spendCount: parseNonNegativeInteger(input.spendCount, 0),
    reuseCount,
    exposedPublicly: input.exposedPublicly === true,
    hasReuse:
      reuseCount > 0 ||
      (input.exposedPublicly === true &&
        receiveCount >= BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD) ||
      receiveCount > 1,
    lastReceivedAt: input.lastReceivedAt ?? null,
    lastSpentAt: input.lastSpentAt ?? null,
    sourceSectionId,
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeUtxoSummary(
  input: BitcoinUtxoSummaryInput,
  defaultSectionIds: readonly string[]
): NormalizedBitcoinUtxoSummary {
  const txid = input.txid.trim().toLowerCase();
  const sourceSectionId = pickSourceSectionId(
    input.sourceSectionId,
    defaultSectionIds
  );

  return {
    resourceId: buildStableId("wallet_btc_utxo", {
      address: normalizeBitcoinAddress(input.address),
      txid,
      vout: parseNonNegativeInteger(input.vout, 0),
    }),
    txid,
    vout: parseNonNegativeInteger(input.vout, 0),
    address: normalizeBitcoinAddress(input.address),
    valueSats: parseIntegerString(input.valueSats) ?? "0",
    confirmations:
      input.confirmations === null || input.confirmations === undefined
        ? null
        : parseNonNegativeInteger(input.confirmations, 0),
    sourceSectionId,
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeHygieneRecord(
  input: BitcoinHygieneRecordInput,
  defaultSectionIds: readonly string[]
): NormalizedBitcoinHygieneRecord {
  const sourceSectionId = pickSourceSectionId(
    input.sourceSectionId,
    defaultSectionIds
  );

  return {
    resourceId: buildStableId("wallet_btc_hygiene", {
      address:
        input.address === undefined || input.address === null
          ? null
          : normalizeBitcoinAddress(input.address),
      count: parseNonNegativeInteger(input.count, 1),
      issueType: input.issueType,
      note: input.note ?? null,
      riskLevel: input.riskLevel ?? "medium",
    }),
    issueType: input.issueType,
    address:
      input.address === undefined || input.address === null
        ? null
        : normalizeBitcoinAddress(input.address),
    count: parseNonNegativeInteger(input.count, 1),
    riskLevel: input.riskLevel ?? "medium",
    note: input.note ?? null,
    sourceSectionId,
    metadata: normalizeMetadata(input.metadata),
  };
}

/**
 * Normalizes a hydrated Bitcoin wallet snapshot into a deterministic Phase 4E state model.
 */
export function normalizeBitcoinWalletSnapshot(
  input: BitcoinWalletScanEvaluationInput
): NormalizedBitcoinWalletSnapshot {
  const walletAddress = normalizeBitcoinAddress(input.request.walletAddress);
  const addressSectionIds = findSectionIds(input, ["address"]);
  const utxoSectionIds = findSectionIds(input, ["utxo"]);
  const hygieneSectionIds = findSectionIds(input, ["hygiene", "privacy"]);

  return {
    walletAddress,
    networkId: input.request.networkId,
    capturedAt: input.snapshot.capturedAt,
    addresses: [...input.hydratedSnapshot.addresses]
      .map((address) =>
        normalizeAddressSummary(address, walletAddress, addressSectionIds)
      )
      .sort(
        (left, right) =>
          left.address.localeCompare(right.address) ||
          left.role.localeCompare(right.role) ||
          left.resourceId.localeCompare(right.resourceId)
      ),
    utxos: [...input.hydratedSnapshot.utxos]
      .map((utxo) => normalizeUtxoSummary(utxo, utxoSectionIds))
      .sort(
        (left, right) =>
          left.address.localeCompare(right.address) ||
          left.txid.localeCompare(right.txid) ||
          left.vout - right.vout ||
          left.resourceId.localeCompare(right.resourceId)
      ),
    hygieneRecords: [...(input.hydratedSnapshot.hygieneRecords ?? [])]
      .map((record) => normalizeHygieneRecord(record, hygieneSectionIds))
      .sort(
        (left, right) =>
          left.issueType.localeCompare(right.issueType) ||
          (left.address ?? "").localeCompare(right.address ?? "") ||
          left.resourceId.localeCompare(right.resourceId)
      ),
  };
}
