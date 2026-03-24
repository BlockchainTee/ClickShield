import {
  BITCOIN_CONCENTRATION_HIGH_BPS,
  BITCOIN_CONCENTRATION_MEDIUM_BPS,
  BITCOIN_FRAGMENTATION_HIGH_SMALL_UTXO_COUNT,
  BITCOIN_FRAGMENTATION_HIGH_UTXO_COUNT,
  BITCOIN_FRAGMENTATION_MEDIUM_SMALL_UTXO_COUNT,
  BITCOIN_FRAGMENTATION_MEDIUM_UTXO_COUNT,
  BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD,
  BITCOIN_SMALL_UTXO_SATS,
} from "./constants.js";
import type {
  BitcoinWalletSignals,
  NormalizedBitcoinWalletSnapshot,
} from "./types.js";
import { uniqueSorted } from "./utils.js";

function classifyFragmentation(
  totalUtxoCount: number,
  smallUtxoCount: number
): BitcoinWalletSignals["fragmentationLevel"] {
  if (
    totalUtxoCount >= BITCOIN_FRAGMENTATION_HIGH_UTXO_COUNT ||
    smallUtxoCount >= BITCOIN_FRAGMENTATION_HIGH_SMALL_UTXO_COUNT
  ) {
    return "high";
  }

  if (
    totalUtxoCount >= BITCOIN_FRAGMENTATION_MEDIUM_UTXO_COUNT ||
    smallUtxoCount >= BITCOIN_FRAGMENTATION_MEDIUM_SMALL_UTXO_COUNT
  ) {
    return "medium";
  }

  return "low";
}

function classifyConcentration(
  largestShareBasisPoints: number,
  totalUtxoCount: number
): BitcoinWalletSignals["concentrationLevel"] {
  if (totalUtxoCount < 2) {
    return "low";
  }

  if (largestShareBasisPoints >= BITCOIN_CONCENTRATION_HIGH_BPS) {
    return "high";
  }

  if (largestShareBasisPoints >= BITCOIN_CONCENTRATION_MEDIUM_BPS) {
    return "medium";
  }

  return "low";
}

/**
 * Builds pure deterministic wallet signals from a normalized Bitcoin snapshot.
 */
export function buildBitcoinWalletSignals(
  snapshot: NormalizedBitcoinWalletSnapshot
): BitcoinWalletSignals {
  const reusedAddresses = snapshot.addresses.filter((address) => address.hasReuse);
  const publiclyExposedAddresses = snapshot.addresses.filter(
    (address) => address.exposedPublicly
  );
  const explicitPrivacyRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "privacy_exposure"
  );
  const explicitPoorHygieneRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "poor_hygiene"
  );
  const explicitExposedReceiveRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "repeated_exposed_receive"
  );
  const repeatedExposedAddresses = snapshot.addresses.filter(
    (address) =>
      address.exposedPublicly &&
      address.receiveCount >= BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD
  );
  const smallUtxos = snapshot.utxos.filter(
    (utxo) => BigInt(utxo.valueSats) <= BITCOIN_SMALL_UTXO_SATS
  );
  const totalValue = snapshot.utxos.reduce(
    (sum, utxo) => sum + BigInt(utxo.valueSats),
    0n
  );
  const largestUtxo = [...snapshot.utxos].sort(
    (left, right) =>
      Number(BigInt(right.valueSats) - BigInt(left.valueSats)) ||
      left.resourceId.localeCompare(right.resourceId)
  )[0];
  const largestShareBasisPoints =
    largestUtxo === undefined || totalValue === 0n
      ? 0
      : Number((BigInt(largestUtxo.valueSats) * 10_000n) / totalValue);
  const fragmentationLevel = classifyFragmentation(
    snapshot.utxos.length,
    smallUtxos.length
  );
  const concentrationLevel = classifyConcentration(
    largestShareBasisPoints,
    snapshot.utxos.length
  );

  return {
    addressCount: snapshot.addresses.length,
    reusedAddressCount: reusedAddresses.length,
    reusedAddressIds: reusedAddresses.map((address) => address.resourceId),
    publiclyExposedAddressCount: publiclyExposedAddresses.length,
    publiclyExposedAddressIds: publiclyExposedAddresses.map(
      (address) => address.resourceId
    ),
    privacyExposureCount: uniqueSorted([
      ...publiclyExposedAddresses.map((address) => address.resourceId),
      ...explicitPrivacyRecords.map((record) => record.resourceId),
    ]).length,
    privacyExposureIds: uniqueSorted([
      ...publiclyExposedAddresses.map((address) => address.resourceId),
      ...explicitPrivacyRecords.map((record) => record.resourceId),
    ]),
    totalUtxoCount: snapshot.utxos.length,
    smallUtxoCount: smallUtxos.length,
    fragmentedUtxoIds:
      fragmentationLevel === "low"
        ? []
        : smallUtxos.map((utxo) => utxo.resourceId),
    fragmentationLevel,
    concentrationLevel,
    largestUtxoShareBasisPoints: largestShareBasisPoints,
    largestUtxoId: largestUtxo?.resourceId ?? null,
    poorHygieneCount: explicitPoorHygieneRecords.length,
    poorHygieneIds: explicitPoorHygieneRecords.map((record) => record.resourceId),
    exposedReceivingPatternCount: uniqueSorted([
      ...repeatedExposedAddresses.map((address) => address.resourceId),
      ...explicitExposedReceiveRecords.map((record) => record.resourceId),
    ]).length,
    exposedReceivingPatternIds: uniqueSorted([
      ...repeatedExposedAddresses.map((address) => address.resourceId),
      ...explicitExposedReceiveRecords.map((record) => record.resourceId),
    ]),
  };
}
