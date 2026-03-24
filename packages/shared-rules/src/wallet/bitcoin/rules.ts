import type { RiskLevel } from "../../engine/types.js";
import type {
  WalletEvidenceRef,
  WalletExposureCategory,
} from "../types.js";
import {
  BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD,
  BITCOIN_WALLET_FINDING_CODES,
  type BitcoinWalletFindingCode,
} from "./constants.js";
import { buildStableId } from "./ids.js";
import type {
  BitcoinWalletSignals,
  NormalizedBitcoinAddressSummary,
  NormalizedBitcoinHygieneRecord,
  NormalizedBitcoinUtxoSummary,
  NormalizedBitcoinWalletSnapshot,
} from "./types.js";
import { maxRiskLevel, uniqueSorted } from "./utils.js";

/**
 * Internal finding draft assembled before shared Layer 4A identifiers are attached.
 */
export interface BitcoinWalletFindingDraft {
  readonly code: BitcoinWalletFindingCode;
  readonly category: WalletExposureCategory;
  readonly riskLevel: RiskLevel;
  readonly title: string;
  readonly summary: string;
  readonly resourceIds: readonly string[];
  readonly evidence: readonly WalletEvidenceRef[];
  readonly metadata: Readonly<Record<string, string>>;
}

function buildEvidenceRefs(
  sourceSectionIds: readonly string[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  const sectionIds = uniqueSorted(sourceSectionIds.filter(Boolean));
  if (sectionIds.length > 0) {
    return sectionIds.map((sectionId) => ({
      evidenceId: buildStableId("wallet_evidence", {
        fallbackLabel,
        sectionId,
      }),
      sourceType: "snapshot_section",
      sourceId: sectionId,
      label: `Snapshot section: ${sectionId}`,
    }));
  }

  return [
    {
      evidenceId: buildStableId("wallet_evidence", {
        fallbackLabel,
      }),
      sourceType: "derived",
      sourceId: fallbackLabel.toLowerCase().replace(/\s+/g, "_"),
      label: fallbackLabel,
    },
  ];
}

function addressEvidence(
  addresses: readonly NormalizedBitcoinAddressSummary[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  return buildEvidenceRefs(
    addresses.map((address) => address.sourceSectionId ?? ""),
    fallbackLabel
  );
}

function utxoEvidence(
  utxos: readonly NormalizedBitcoinUtxoSummary[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  return buildEvidenceRefs(
    utxos.map((utxo) => utxo.sourceSectionId ?? ""),
    fallbackLabel
  );
}

function hygieneEvidence(
  records: readonly NormalizedBitcoinHygieneRecord[],
  fallbackLabel: string
): readonly WalletEvidenceRef[] {
  return buildEvidenceRefs(
    records.map((record) => record.sourceSectionId ?? ""),
    fallbackLabel
  );
}

/**
 * Builds deterministic Bitcoin wallet findings from normalized Bitcoin exposure state.
 */
export function buildBitcoinWalletFindings(
  snapshot: NormalizedBitcoinWalletSnapshot,
  signals: BitcoinWalletSignals
): readonly BitcoinWalletFindingDraft[] {
  const drafts: BitcoinWalletFindingDraft[] = [];
  const reusedAddresses = snapshot.addresses.filter((address) => address.hasReuse);
  const publiclyExposedAddresses = snapshot.addresses.filter(
    (address) => address.exposedPublicly
  );
  const poorHygieneRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "poor_hygiene"
  );
  const privacyRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "privacy_exposure"
  );
  const repeatedReceiveRecords = snapshot.hygieneRecords.filter(
    (record) => record.issueType === "repeated_exposed_receive"
  );
  const repeatedExposedAddresses = publiclyExposedAddresses.filter(
    (address) =>
      address.receiveCount >= BITCOIN_REPEATED_EXPOSED_RECEIVE_THRESHOLD
  );
  const fragmentedUtxos = snapshot.utxos.filter((utxo) =>
    signals.fragmentedUtxoIds.includes(utxo.resourceId)
  );
  const largestUtxo = snapshot.utxos.find(
    (utxo) => utxo.resourceId === signals.largestUtxoId
  );

  if (reusedAddresses.length > 0) {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.ADDRESS_REUSE,
      category: "operational",
      riskLevel:
        reusedAddresses.length >= 3 ||
        reusedAddresses.some((address) => address.exposedPublicly)
          ? "high"
          : "medium",
      title: "Address reuse exposure",
      summary: `${reusedAddresses.length} Bitcoin address${
        reusedAddresses.length === 1 ? "" : "es"
      } show repeated receiving behavior and should be rotated out of active use.`,
      resourceIds: uniqueSorted(
        reusedAddresses.map((address) => address.resourceId)
      ),
      evidence: addressEvidence(reusedAddresses, "Bitcoin address reuse exposure"),
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.ADDRESS_REUSE,
        reusedAddressCount: String(signals.reusedAddressCount),
      },
    });
  }

  if (signals.privacyExposureCount > 0) {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.PRIVACY_EXPOSURE,
      category: "operational",
      riskLevel: maxRiskLevel(
        [
          signals.exposedReceivingPatternCount > 0 ? "high" : "medium",
          ...privacyRecords.map((record) => record.riskLevel),
        ],
        "medium"
      ),
      title: "Privacy exposure",
      summary: `${signals.privacyExposureCount} Bitcoin privacy exposure indicator${
        signals.privacyExposureCount === 1 ? "" : "s"
      } were detected from public address visibility or caller-supplied hygiene records.`,
      resourceIds: uniqueSorted([
        ...publiclyExposedAddresses.map((address) => address.resourceId),
        ...privacyRecords.map((record) => record.resourceId),
      ]),
      evidence: [
        ...addressEvidence(publiclyExposedAddresses, "Bitcoin privacy exposure"),
        ...hygieneEvidence(privacyRecords, "Bitcoin privacy exposure record"),
      ],
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.PRIVACY_EXPOSURE,
        privacyExposureCount: String(signals.privacyExposureCount),
      },
    });
  }

  if (signals.fragmentationLevel !== "low") {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.FRAGMENTED_UTXO_STRUCTURE,
      category: "asset",
      riskLevel: signals.fragmentationLevel === "high" ? "high" : "medium",
      title: "Fragmented UTXO structure",
      summary: `${signals.smallUtxoCount} small UTXO${
        signals.smallUtxoCount === 1 ? "" : "s"
      } and ${signals.totalUtxoCount} total UTXO${
        signals.totalUtxoCount === 1 ? "" : "s"
      } indicate ${signals.fragmentationLevel} fragmentation.`,
      resourceIds: signals.fragmentedUtxoIds,
      evidence: utxoEvidence(fragmentedUtxos, "Bitcoin fragmented UTXO structure"),
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.FRAGMENTED_UTXO_STRUCTURE,
        fragmentationLevel: signals.fragmentationLevel,
        smallUtxoCount: String(signals.smallUtxoCount),
        totalUtxoCount: String(signals.totalUtxoCount),
      },
    });
  }

  if (signals.concentrationLevel !== "low" && largestUtxo !== undefined) {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.CONCENTRATED_UTXO_STRUCTURE,
      category: "asset",
      riskLevel: signals.concentrationLevel === "high" ? "high" : "medium",
      title: "Concentrated UTXO structure",
      summary: `The largest UTXO holds ${signals.largestUtxoShareBasisPoints / 100}% of the visible wallet balance, indicating ${signals.concentrationLevel} concentration.`,
      resourceIds: [largestUtxo.resourceId],
      evidence: utxoEvidence(
        [largestUtxo],
        "Bitcoin concentrated UTXO structure"
      ),
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.CONCENTRATED_UTXO_STRUCTURE,
        concentrationLevel: signals.concentrationLevel,
        largestUtxoShareBasisPoints: String(signals.largestUtxoShareBasisPoints),
      },
    });
  }

  if (poorHygieneRecords.length > 0) {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.POOR_WALLET_HYGIENE,
      category: "operational",
      riskLevel: maxRiskLevel(
        poorHygieneRecords.map((record) => record.riskLevel),
        "medium"
      ),
      title: "Poor wallet hygiene",
      summary: `${poorHygieneRecords.length} caller-supplied wallet hygiene issue${
        poorHygieneRecords.length === 1 ? "" : "s"
      } require manual operational review.`,
      resourceIds: poorHygieneRecords.map((record) => record.resourceId),
      evidence: hygieneEvidence(
        poorHygieneRecords,
        "Bitcoin poor wallet hygiene"
      ),
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.POOR_WALLET_HYGIENE,
        poorHygieneCount: String(signals.poorHygieneCount),
      },
    });
  }

  if (signals.exposedReceivingPatternCount > 0) {
    drafts.push({
      code: BITCOIN_WALLET_FINDING_CODES.REPEATED_EXPOSED_RECEIVE,
      category: "activity",
      riskLevel: maxRiskLevel(
        [
          repeatedExposedAddresses.length > 0 ? "high" : "medium",
          ...repeatedReceiveRecords.map((record) => record.riskLevel),
        ],
        "medium"
      ),
      title: "Repeated exposed receive behavior",
      summary: `${signals.exposedReceivingPatternCount} exposed receiving pattern${
        signals.exposedReceivingPatternCount === 1 ? "" : "s"
      } show repeat deposits landing on public Bitcoin receive addresses.`,
      resourceIds: uniqueSorted([
        ...repeatedExposedAddresses.map((address) => address.resourceId),
        ...repeatedReceiveRecords.map((record) => record.resourceId),
      ]),
      evidence: [
        ...addressEvidence(
          repeatedExposedAddresses,
          "Bitcoin repeated exposed receive behavior"
        ),
        ...hygieneEvidence(
          repeatedReceiveRecords,
          "Bitcoin repeated exposed receive record"
        ),
      ],
      metadata: {
        code: BITCOIN_WALLET_FINDING_CODES.REPEATED_EXPOSED_RECEIVE,
        exposedReceivingPatternCount: String(
          signals.exposedReceivingPatternCount
        ),
      },
    });
  }

  return drafts;
}
