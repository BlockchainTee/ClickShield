import type { RiskLevel } from "../../engine/types.js";
import type {
  WalletReport,
  WalletScanRequest,
  WalletScanResult,
  WalletScanSnapshot,
  WalletSummary,
} from "../types.js";

/**
 * Supported EVM token standards evaluated by the Phase 4B scanner.
 */
export type EvmTokenStandard = "erc20" | "erc721" | "erc1155";

/**
 * Stable approval shapes recognized by the Phase 4B scanner.
 */
export type EvmApprovalKind =
  | "erc20_allowance"
  | "erc721_token"
  | "erc721_operator"
  | "erc1155_operator";

/**
 * Deterministic counterparty disposition labels used after normalization.
 */
export type EvmCounterpartyDisposition = "trusted" | "unknown" | "flagged";

/**
 * Contract exposure areas accepted in the hydrated EVM snapshot payload.
 */
export type EvmContractExposureType =
  | "token_contract"
  | "spender_contract"
  | "interaction_contract";

/**
 * Amount classification derived from a normalized approval record.
 */
export type EvmApprovalAmountKind = "limited" | "unlimited" | "not_applicable";

/**
 * Raw approval-like record supplied to the Phase 4B EVM scanner.
 */
export interface EvmApprovalRecordInput {
  readonly tokenStandard: EvmTokenStandard;
  readonly tokenAddress: string;
  readonly spenderAddress: string;
  readonly amount?: string | null;
  readonly tokenId?: string | null;
  readonly isApproved?: boolean | null;
  readonly approvedAt?: string | null;
  readonly sourceSectionId?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Optional caller-supplied spender reputation input.
 */
export interface EvmSpenderRiskInput {
  readonly spenderAddress: string;
  readonly trusted?: boolean;
  readonly riskLevel?: RiskLevel | null;
  readonly flags?: readonly string[];
  readonly label?: string | null;
  readonly sourceSectionId?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Optional caller-supplied risky contract exposure input.
 */
export interface EvmContractExposureInput {
  readonly contractAddress: string;
  readonly exposureType: EvmContractExposureType;
  readonly riskLevel?: RiskLevel | null;
  readonly flags?: readonly string[];
  readonly label?: string | null;
  readonly sourceSectionId?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Fully hydrated EVM snapshot payload evaluated by the Phase 4B scanner.
 */
export interface EvmWalletHydratedSnapshot {
  readonly approvals: readonly EvmApprovalRecordInput[];
  readonly spenders?: readonly EvmSpenderRiskInput[];
  readonly contractExposures?: readonly EvmContractExposureInput[];
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Normalized spender reputation record used during deterministic evaluation.
 */
export interface NormalizedEvmSpenderRisk {
  readonly resourceId: string;
  readonly spenderAddress: string;
  readonly disposition: EvmCounterpartyDisposition;
  readonly riskLevel: RiskLevel | null;
  readonly flags: readonly string[];
  readonly label: string | null;
  readonly sourceSectionId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Normalized risky-contract record used during deterministic evaluation.
 */
export interface NormalizedEvmContractExposure {
  readonly resourceId: string;
  readonly contractAddress: string;
  readonly exposureType: EvmContractExposureType;
  readonly riskLevel: RiskLevel | null;
  readonly flags: readonly string[];
  readonly label: string | null;
  readonly isRisky: boolean;
  readonly sourceSectionId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Normalized approval state evaluated by the Phase 4B scanner.
 */
export interface NormalizedEvmApprovalState {
  readonly approvalId: string;
  readonly walletAddress: string;
  readonly tokenStandard: EvmTokenStandard;
  readonly approvalKind: EvmApprovalKind;
  readonly tokenAddress: string;
  readonly spenderAddress: string;
  readonly spenderDisposition: EvmCounterpartyDisposition;
  readonly spenderRiskLevel: RiskLevel | null;
  readonly spenderFlags: readonly string[];
  readonly amount: string | null;
  readonly amountKind: EvmApprovalAmountKind;
  readonly tokenId: string | null;
  readonly isUnlimited: boolean;
  readonly approvedAt: string | null;
  readonly ageDays: number | null;
  readonly isStale: boolean;
  readonly riskyContractExposureIds: readonly string[];
  readonly hasRiskyContractExposure: boolean;
  readonly sourceSectionId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Stable normalized EVM snapshot shape used across signals, rules, and scoring.
 */
export interface NormalizedEvmWalletSnapshot {
  readonly walletAddress: string;
  readonly networkId: string;
  readonly capturedAt: string;
  readonly approvals: readonly NormalizedEvmApprovalState[];
  readonly spenders: readonly NormalizedEvmSpenderRisk[];
  readonly contractExposures: readonly NormalizedEvmContractExposure[];
}

/**
 * Pure wallet-exposure signals derived from a normalized EVM snapshot.
 */
export interface EvmWalletSignals {
  readonly approvalCount: number;
  readonly erc20ApprovalCount: number;
  readonly erc721ApprovalCount: number;
  readonly erc1155ApprovalCount: number;
  readonly unlimitedApprovalCount: number;
  readonly unlimitedApprovalIds: readonly string[];
  readonly unknownUnlimitedApprovalCount: number;
  readonly unknownUnlimitedApprovalIds: readonly string[];
  readonly flaggedSpenderCount: number;
  readonly flaggedSpenderApprovalIds: readonly string[];
  readonly staleApprovalCount: number;
  readonly staleApprovalIds: readonly string[];
  readonly riskyContractExposureCount: number;
  readonly riskyContractExposureIds: readonly string[];
  readonly hasExcessiveApprovals: boolean;
}

/**
 * High-level input accepted by the exported Phase 4B EVM evaluator.
 */
export interface EvmWalletScanEvaluationInput {
  readonly request: WalletScanRequest;
  readonly snapshot: WalletScanSnapshot;
  readonly hydratedSnapshot: EvmWalletHydratedSnapshot;
  readonly evaluatedAt: string;
  readonly reportVersion?: WalletReport["reportVersion"];
}

/**
 * Final deterministic Phase 4B evaluation surface for an EVM wallet snapshot.
 */
export interface EvmWalletScanEvaluation {
  readonly score: number;
  readonly riskLevel: RiskLevel;
  readonly normalizedSnapshot: NormalizedEvmWalletSnapshot;
  readonly signals: EvmWalletSignals;
  readonly result: WalletScanResult;
  readonly summary: WalletSummary;
  readonly report: WalletReport;
}

