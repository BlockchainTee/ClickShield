import type { RiskLevel } from "../../engine/types.js";
import type {
  WalletReport,
  WalletScanRequest,
  WalletScanResult,
  WalletScanSnapshot,
  WalletSummary,
} from "../types.js";

/**
 * Address categories accepted in the hydrated Bitcoin wallet snapshot.
 */
export type BitcoinAddressType =
  | "legacy"
  | "nested_segwit"
  | "segwit"
  | "taproot"
  | "script"
  | "other";

/**
 * Wallet address roles accepted in the hydrated Bitcoin wallet snapshot.
 */
export type BitcoinAddressRole =
  | "receive"
  | "change"
  | "mixed"
  | "external"
  | "unknown";

/**
 * Hygiene issue categories accepted in the hydrated Bitcoin wallet snapshot.
 */
export type BitcoinHygieneIssueType =
  | "privacy_exposure"
  | "poor_hygiene"
  | "repeated_exposed_receive";

/**
 * Fragmentation levels emitted by the deterministic Bitcoin signal layer.
 */
export type BitcoinFragmentationLevel = "low" | "medium" | "high";

/**
 * Concentration levels emitted by the deterministic Bitcoin signal layer.
 */
export type BitcoinConcentrationLevel = "low" | "medium" | "high";

/**
 * Raw Bitcoin address summary supplied to the Phase 4E scanner.
 */
export interface BitcoinAddressSummaryInput {
  readonly address: string;
  readonly addressType?: BitcoinAddressType | null;
  readonly role?: BitcoinAddressRole | null;
  readonly receivedSats?: string | null;
  readonly spentSats?: string | null;
  readonly balanceSats?: string | null;
  readonly receiveCount?: number | null;
  readonly spendCount?: number | null;
  readonly reuseCount?: number | null;
  readonly exposedPublicly?: boolean | null;
  readonly lastReceivedAt?: string | null;
  readonly lastSpentAt?: string | null;
  readonly sourceSectionId?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Raw Bitcoin UTXO summary supplied to the Phase 4E scanner.
 */
export interface BitcoinUtxoSummaryInput {
  readonly txid: string;
  readonly vout: number;
  readonly address: string;
  readonly valueSats: string;
  readonly confirmations?: number | null;
  readonly sourceSectionId?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Raw hygiene or privacy observation supplied to the Phase 4E scanner.
 */
export interface BitcoinHygieneRecordInput {
  readonly issueType: BitcoinHygieneIssueType;
  readonly address?: string | null;
  readonly count?: number | null;
  readonly riskLevel?: RiskLevel | null;
  readonly note?: string | null;
  readonly sourceSectionId?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Fully hydrated Bitcoin snapshot payload evaluated by Phase 4E.
 */
export interface BitcoinWalletHydratedSnapshot {
  readonly addresses: readonly BitcoinAddressSummaryInput[];
  readonly utxos: readonly BitcoinUtxoSummaryInput[];
  readonly hygieneRecords?: readonly BitcoinHygieneRecordInput[];
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Normalized Bitcoin address summary used during deterministic evaluation.
 */
export interface NormalizedBitcoinAddressSummary {
  readonly resourceId: string;
  readonly address: string;
  readonly addressType: BitcoinAddressType;
  readonly role: BitcoinAddressRole;
  readonly receivedSats: string | null;
  readonly spentSats: string | null;
  readonly balanceSats: string | null;
  readonly receiveCount: number;
  readonly spendCount: number;
  readonly reuseCount: number;
  readonly exposedPublicly: boolean;
  readonly hasReuse: boolean;
  readonly lastReceivedAt: string | null;
  readonly lastSpentAt: string | null;
  readonly sourceSectionId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Normalized Bitcoin UTXO summary used during deterministic evaluation.
 */
export interface NormalizedBitcoinUtxoSummary {
  readonly resourceId: string;
  readonly txid: string;
  readonly vout: number;
  readonly address: string;
  readonly valueSats: string;
  readonly confirmations: number | null;
  readonly sourceSectionId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Normalized hygiene observation used during deterministic evaluation.
 */
export interface NormalizedBitcoinHygieneRecord {
  readonly resourceId: string;
  readonly issueType: BitcoinHygieneIssueType;
  readonly address: string | null;
  readonly count: number;
  readonly riskLevel: RiskLevel;
  readonly note: string | null;
  readonly sourceSectionId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Stable normalized Bitcoin snapshot shape used across Phase 4E evaluation steps.
 */
export interface NormalizedBitcoinWalletSnapshot {
  readonly walletAddress: string;
  readonly networkId: string;
  readonly capturedAt: string;
  readonly addresses: readonly NormalizedBitcoinAddressSummary[];
  readonly utxos: readonly NormalizedBitcoinUtxoSummary[];
  readonly hygieneRecords: readonly NormalizedBitcoinHygieneRecord[];
}

/**
 * Pure Bitcoin wallet signals derived from a normalized snapshot.
 */
export interface BitcoinWalletSignals {
  readonly addressCount: number;
  readonly reusedAddressCount: number;
  readonly reusedAddressIds: readonly string[];
  readonly publiclyExposedAddressCount: number;
  readonly publiclyExposedAddressIds: readonly string[];
  readonly privacyExposureCount: number;
  readonly privacyExposureIds: readonly string[];
  readonly totalUtxoCount: number;
  readonly smallUtxoCount: number;
  readonly fragmentedUtxoIds: readonly string[];
  readonly fragmentationLevel: BitcoinFragmentationLevel;
  readonly concentrationLevel: BitcoinConcentrationLevel;
  readonly largestUtxoShareBasisPoints: number;
  readonly largestUtxoId: string | null;
  readonly poorHygieneCount: number;
  readonly poorHygieneIds: readonly string[];
  readonly exposedReceivingPatternCount: number;
  readonly exposedReceivingPatternIds: readonly string[];
}

/**
 * High-level input accepted by the exported Phase 4E Bitcoin evaluator.
 */
export interface BitcoinWalletScanEvaluationInput {
  readonly request: WalletScanRequest;
  readonly snapshot: WalletScanSnapshot;
  readonly hydratedSnapshot: BitcoinWalletHydratedSnapshot;
  readonly evaluatedAt: string;
  readonly reportVersion?: WalletReport["reportVersion"];
}

/**
 * Final deterministic Phase 4E evaluation surface for a Bitcoin wallet snapshot.
 */
export interface BitcoinWalletScanEvaluation {
  readonly score: number;
  readonly riskLevel: RiskLevel;
  readonly normalizedSnapshot: NormalizedBitcoinWalletSnapshot;
  readonly signals: BitcoinWalletSignals;
  readonly result: WalletScanResult;
  readonly summary: WalletSummary;
  readonly report: WalletReport;
}
