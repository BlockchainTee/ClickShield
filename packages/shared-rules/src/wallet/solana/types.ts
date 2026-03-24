import type { RiskLevel } from "../../engine/types.js";
import type {
  WalletReport,
  WalletScanRequest,
  WalletScanResult,
  WalletScanSnapshot,
  WalletSummary,
} from "../types.js";

/**
 * Authority kinds that can be represented in a hydrated Solana wallet snapshot.
 */
export type SolanaAuthorityType =
  | "account_owner"
  | "close_authority"
  | "freeze_authority"
  | "mint_authority"
  | "stake_staker"
  | "stake_withdrawer"
  | "upgrade_authority"
  | "other";

/**
 * Permission breadth labels accepted for Solana connection records.
 */
export type SolanaPermissionLevel = "limited" | "broad";

/**
 * Raw token account exposure supplied to the Phase 4D Solana scanner.
 */
export interface SolanaTokenAccountInput {
  readonly tokenAccountAddress: string;
  readonly mintAddress: string;
  readonly ownerAddress?: string | null;
  readonly balanceLamports?: string | null;
  readonly delegateAddress?: string | null;
  readonly delegateAmount?: string | null;
  readonly delegateRiskLevel?: RiskLevel | null;
  readonly delegateFlags?: readonly string[];
  readonly delegateLabel?: string | null;
  readonly closeAuthorityAddress?: string | null;
  readonly permanentDelegateAddress?: string | null;
  readonly sourceSectionId?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Raw authority assignment supplied to the Phase 4D Solana scanner.
 */
export interface SolanaAuthorityAssignmentInput {
  readonly subjectAddress: string;
  readonly authorityAddress: string;
  readonly authorityType: SolanaAuthorityType;
  readonly programAddress?: string | null;
  readonly riskLevel?: RiskLevel | null;
  readonly flags?: readonly string[];
  readonly label?: string | null;
  readonly sourceSectionId?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Raw wallet connection or permission record supplied to the Phase 4D Solana scanner.
 */
export interface SolanaConnectionRecordInput {
  readonly connectionId?: string | null;
  readonly appName?: string | null;
  readonly origin?: string | null;
  readonly permissions?: readonly string[];
  readonly permissionLevel?: SolanaPermissionLevel | null;
  readonly programAddresses?: readonly string[];
  readonly riskLevel?: RiskLevel | null;
  readonly flags?: readonly string[];
  readonly connectedAt?: string | null;
  readonly lastUsedAt?: string | null;
  readonly sourceSectionId?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Raw risky-program summary supplied to the Phase 4D Solana scanner.
 */
export interface SolanaProgramExposureInput {
  readonly programAddress: string;
  readonly label?: string | null;
  readonly riskLevel?: RiskLevel | null;
  readonly flags?: readonly string[];
  readonly interactionCount?: number | null;
  readonly lastInteractedAt?: string | null;
  readonly sourceSectionId?: string | null;
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Fully hydrated Solana wallet snapshot payload evaluated by Phase 4D.
 */
export interface SolanaWalletHydratedSnapshot {
  readonly tokenAccounts: readonly SolanaTokenAccountInput[];
  readonly authorityAssignments?: readonly SolanaAuthorityAssignmentInput[];
  readonly connections?: readonly SolanaConnectionRecordInput[];
  readonly programExposures?: readonly SolanaProgramExposureInput[];
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Normalized Solana token account state used during deterministic evaluation.
 */
export interface NormalizedSolanaTokenAccountState {
  readonly resourceId: string;
  readonly tokenAccountAddress: string;
  readonly mintAddress: string;
  readonly ownerAddress: string | null;
  readonly balanceLamports: string | null;
  readonly delegateAddress: string | null;
  readonly delegateAmount: string | null;
  readonly delegateRiskLevel: RiskLevel | null;
  readonly delegateFlags: readonly string[];
  readonly delegateLabel: string | null;
  readonly hasDelegate: boolean;
  readonly isRiskyDelegate: boolean;
  readonly closeAuthorityAddress: string | null;
  readonly permanentDelegateAddress: string | null;
  readonly sourceSectionId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Normalized authority assignment used during deterministic evaluation.
 */
export interface NormalizedSolanaAuthorityAssignment {
  readonly resourceId: string;
  readonly subjectAddress: string;
  readonly authorityAddress: string;
  readonly authorityType: SolanaAuthorityType;
  readonly programAddress: string | null;
  readonly riskLevel: RiskLevel | null;
  readonly flags: readonly string[];
  readonly label: string | null;
  readonly isRisky: boolean;
  readonly sourceSectionId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Normalized Solana connection record used during deterministic evaluation.
 */
export interface NormalizedSolanaConnectionRecord {
  readonly resourceId: string;
  readonly connectionId: string | null;
  readonly appName: string | null;
  readonly origin: string | null;
  readonly permissions: readonly string[];
  readonly permissionLevel: SolanaPermissionLevel;
  readonly programAddresses: readonly string[];
  readonly riskLevel: RiskLevel | null;
  readonly flags: readonly string[];
  readonly connectedAt: string | null;
  readonly lastUsedAt: string | null;
  readonly connectedAgeDays: number | null;
  readonly lastUsedAgeDays: number | null;
  readonly isBroadPermission: boolean;
  readonly isRisky: boolean;
  readonly isStaleRisky: boolean;
  readonly sourceSectionId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Normalized Solana program exposure used during deterministic evaluation.
 */
export interface NormalizedSolanaProgramExposure {
  readonly resourceId: string;
  readonly programAddress: string;
  readonly label: string | null;
  readonly riskLevel: RiskLevel | null;
  readonly flags: readonly string[];
  readonly interactionCount: number | null;
  readonly lastInteractedAt: string | null;
  readonly isSuspicious: boolean;
  readonly sourceSectionId: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Stable normalized Solana snapshot shape used across Phase 4D evaluation steps.
 */
export interface NormalizedSolanaWalletSnapshot {
  readonly walletAddress: string;
  readonly networkId: string;
  readonly capturedAt: string;
  readonly tokenAccounts: readonly NormalizedSolanaTokenAccountState[];
  readonly authorityAssignments: readonly NormalizedSolanaAuthorityAssignment[];
  readonly connections: readonly NormalizedSolanaConnectionRecord[];
  readonly programExposures: readonly NormalizedSolanaProgramExposure[];
}

/**
 * Pure Solana wallet signals derived from a normalized snapshot.
 */
export interface SolanaWalletSignals {
  readonly tokenAccountCount: number;
  readonly delegateCount: number;
  readonly delegateIds: readonly string[];
  readonly riskyDelegateCount: number;
  readonly riskyDelegateIds: readonly string[];
  readonly authorityAssignmentCount: number;
  readonly riskyAuthorityAssignmentCount: number;
  readonly riskyAuthorityAssignmentIds: readonly string[];
  readonly broadPermissionCount: number;
  readonly broadPermissionConnectionIds: readonly string[];
  readonly riskyConnectionCount: number;
  readonly riskyConnectionIds: readonly string[];
  readonly staleRiskyConnectionCount: number;
  readonly staleRiskyConnectionIds: readonly string[];
  readonly suspiciousProgramCount: number;
  readonly suspiciousProgramIds: readonly string[];
}

/**
 * High-level input accepted by the exported Phase 4D Solana evaluator.
 */
export interface SolanaWalletScanEvaluationInput {
  readonly request: WalletScanRequest;
  readonly snapshot: WalletScanSnapshot;
  readonly hydratedSnapshot: SolanaWalletHydratedSnapshot;
  readonly evaluatedAt: string;
  readonly reportVersion?: WalletReport["reportVersion"];
}

/**
 * Final deterministic Phase 4D evaluation surface for a Solana wallet snapshot.
 */
export interface SolanaWalletScanEvaluation {
  readonly score: number;
  readonly riskLevel: RiskLevel;
  readonly normalizedSnapshot: NormalizedSolanaWalletSnapshot;
  readonly signals: SolanaWalletSignals;
  readonly result: WalletScanResult;
  readonly summary: WalletSummary;
  readonly report: WalletReport;
}
