import type { RiskLevel } from "../../engine/types.js";
import type {
  WalletCapabilityStatus,
  WalletCleanupAction,
  WalletCleanupPlan,
} from "../types.js";
import type { EvmApprovalKind } from "./types.js";

/**
 * Supported revoke methods for deterministic EVM cleanup preparation.
 */
export type EvmCleanupRevocationMethod =
  | "erc20_approve_zero"
  | "erc721_approve_zero"
  | "erc721_set_approval_for_all_false"
  | "erc1155_set_approval_for_all_false";

/**
 * Exact approval target represented by a cleanup action.
 */
export interface EvmRevocableApprovalTarget {
  /** Stable approval identifier from normalized Phase 4B output. */
  readonly approvalId: string;
  /** Approval kind being revoked. */
  readonly approvalKind: EvmApprovalKind;
  /** Token contract that receives the revoke call. */
  readonly tokenAddress: string;
  /** Spender or operator that currently holds approval. */
  readonly spenderAddress: string;
  /** Token identifier for ERC-721 token approvals, else null. */
  readonly tokenId: string | null;
  /** Current approval state as represented in normalized input. */
  readonly currentState: string;
  /** Intended post-revoke state. */
  readonly intendedState: string;
}

/**
 * EVM-specific cleanup action with explicit revoke semantics.
 */
export interface EvmCleanupAction extends WalletCleanupAction {
  /** Chain family this action belongs to. */
  readonly walletChain: "evm";
  /** Guided payload review remains the only supported execution mode. */
  readonly executionMode: "guided";
  /** Cleanup requires a wallet-signed transaction. */
  readonly executionType: "wallet_signature";
  /** Supported cleanup actions are ready for signature preparation. */
  readonly status: "ready";
  /** EVM revoke execution always requires a user signature. */
  readonly requiresSignature: true;
  /** Phase 4C supports deterministic revoke payload preparation. */
  readonly supportStatus: "supported";
  /** Exact revoke method that will be prepared. */
  readonly revocationMethod: EvmCleanupRevocationMethod;
  /** Exact approval target that will be revoked. */
  readonly approval: EvmRevocableApprovalTarget;
  /** Estimated risk reduction if the revoke later confirms on-chain. */
  readonly estimatedRiskReduction: RiskLevel;
  /** Human-readable explanation of the revoke effect. */
  readonly explanation: string;
}

/**
 * Honest logical batch grouping for reviewable EVM cleanup actions.
 */
export interface EvmCleanupBatchPlan {
  /** Stable batch identifier. */
  readonly batchId: string;
  /** Chain family this batch belongs to. */
  readonly walletChain: "evm";
  /** Wallet identifier the batch applies to. */
  readonly walletAddress: string;
  /** Network scope the batch applies to. */
  readonly networkId: string;
  /** ISO-8601 timestamp when the batch was assembled. */
  readonly createdAt: string;
  /** Honest support level for executing the selected batch. */
  readonly supportStatus: WalletCapabilityStatus;
  /** Honest batch execution packaging model. */
  readonly executionKind: "multiple_transactions";
  /** Audit-friendly batch title. */
  readonly title: string;
  /** Human-readable batch summary. */
  readonly summary: string;
  /** Ordered action identifiers included in the batch. */
  readonly actionIds: readonly string[];
  /** Ordered actions included in the batch. */
  readonly actions: readonly EvmCleanupAction[];
}

/**
 * EVM cleanup plan produced from normalized approvals and findings.
 */
export interface EvmWalletCleanupPlan extends WalletCleanupPlan {
  /** Chain family this plan belongs to. */
  readonly walletChain: "evm";
  /** Ordered EVM revoke actions. */
  readonly actions: readonly EvmCleanupAction[];
  /** Deterministic logical batch groupings for review. */
  readonly batches: readonly EvmCleanupBatchPlan[];
}

/**
 * Eligibility decision for whether a normalized approval may produce a revoke.
 */
export interface EvmCleanupEligibility {
  /** Whether the approval can safely produce a cleanup action. */
  readonly eligible: boolean;
  /** Stable reason code describing the eligibility decision. */
  readonly reasonCode:
    | "supported"
    | "inactive"
    | "missing_amount"
    | "missing_token_id"
    | "unsupported_approval_kind";
  /** Revoke method selected for supported approvals, else null. */
  readonly revocationMethod: EvmCleanupRevocationMethod | null;
  /** Honest support level for the decision. */
  readonly supportStatus: WalletCapabilityStatus;
  /** Human-readable explanation of the decision. */
  readonly detail: string;
}

/**
 * Prepared EVM transaction argument included in a reviewable revoke payload.
 */
export interface EvmPreparedCleanupArgument {
  /** ABI parameter name. */
  readonly name: string;
  /** Solidity parameter type. */
  readonly type: "address" | "uint256" | "bool";
  /** Canonical string value supplied to the payload. */
  readonly value: string;
}

/**
 * Deterministic revoke transaction payload prepared for explicit user review.
 */
export interface EvmPreparedCleanupTransaction {
  /** Stable prepared transaction identifier. */
  readonly transactionId: string;
  /** Cleanup action identifier this payload belongs to. */
  readonly actionId: string;
  /** Chain family this payload belongs to. */
  readonly walletChain: "evm";
  /** Network scope this payload belongs to. */
  readonly networkId: string;
  /** Wallet that must sign the payload. */
  readonly walletAddress: string;
  /** Target contract that receives the call, else null when unsupported. */
  readonly to: string | null;
  /** Native value attached to the transaction. */
  readonly value: "0x0";
  /** ABI-encoded calldata, else null when unsupported. */
  readonly data: string | null;
  /** Prepared function name, else null when unsupported. */
  readonly functionName: "approve" | "setApprovalForAll" | null;
  /** Prepared 4-byte selector, else null when unsupported. */
  readonly methodSelector: string | null;
  /** Ordered ABI arguments. */
  readonly args: readonly EvmPreparedCleanupArgument[];
  /** Approval kind the payload revokes. */
  readonly approvalKind: EvmApprovalKind;
  /** Revoke method the payload applies. */
  readonly revocationMethod: EvmCleanupRevocationMethod;
  /** Intended post-revoke approval state. */
  readonly intendedState: string;
  /** Whether the payload contains every required transaction field. */
  readonly executable: boolean;
  /** Honest support level for this payload. */
  readonly supportStatus: WalletCapabilityStatus;
  /** Human-readable explanation when support is partial or unavailable. */
  readonly supportDetail: string | null;
}

/**
 * Explicit user selection shape for prepared EVM cleanup execution.
 */
export type EvmCleanupSelectionKind = "single_action" | "batch_actions";

/**
 * Honest packaging model for explicit cleanup execution preparation.
 */
export type EvmCleanupPackaging =
  | "single_transaction"
  | "multiple_transactions"
  | "not_supported";

/**
 * Request contract representing explicit user-selected cleanup preparation.
 */
export interface EvmCleanupExecutionRequest {
  /** Stable execution request identifier. */
  readonly requestId: string;
  /** Cleanup plan identifier this request belongs to. */
  readonly planId: string;
  /** Chain family this request belongs to. */
  readonly walletChain: "evm";
  /** Wallet that must sign the request payloads. */
  readonly walletAddress: string;
  /** Network scope this request belongs to. */
  readonly networkId: string;
  /** ISO-8601 timestamp when the request was prepared. */
  readonly createdAt: string;
  /** Whether the request targets one action or multiple actions. */
  readonly selectionKind: EvmCleanupSelectionKind;
  /** Honest packaging model for the prepared payloads. */
  readonly packaging: EvmCleanupPackaging;
  /** Ordered action identifiers selected by the caller. */
  readonly actionIds: readonly string[];
  /** Ordered prepared transactions for explicit review. */
  readonly preparedTransactions: readonly EvmPreparedCleanupTransaction[];
  /** EVM cleanup always requires a wallet signature. */
  readonly requiresSignature: true;
  /** Honest support level for the prepared request. */
  readonly supportStatus: WalletCapabilityStatus;
  /** Human-readable explanation of the packaging boundary. */
  readonly supportDetail: string | null;
}

/**
 * Stable execution status values for externally signed cleanup attempts.
 */
export type EvmCleanupExecutionStatus =
  | "pending_signature"
  | "submitted"
  | "confirmed"
  | "failed"
  | "rejected"
  | "unknown";

/**
 * Deterministic result contract for one cleanup action execution attempt.
 */
export interface EvmCleanupActionExecutionResult {
  /** Cleanup action identifier. */
  readonly actionId: string;
  /** Normalized external execution status. */
  readonly status: EvmCleanupExecutionStatus;
  /** Transaction hash when available, else null. */
  readonly txHash: string | null;
  /** Stable error code when available, else null. */
  readonly errorCode: string | null;
  /** Human-readable error message when available, else null. */
  readonly errorMessage: string | null;
  /** Whether later re-scan is required before claiming remediation. */
  readonly requiresRescan: boolean;
  /** Finalization timestamp when available, else null. */
  readonly finalizedAt: string | null;
}

/**
 * Minimal rescan snapshot used to compare confirmed execution with later state.
 */
export interface EvmCleanupRescanSnapshot {
  /** Chain family this rescan belongs to. */
  readonly walletChain: "evm";
  /** Wallet that was rescanned. */
  readonly walletAddress: string;
  /** Network scope that was rescanned. */
  readonly networkId: string;
  /** ISO-8601 timestamp when the re-scan completed. */
  readonly rescannedAt: string;
  /** Active approval identifiers still present after re-scan. */
  readonly activeApprovalIds: readonly string[];
}

/**
 * Re-scan comparison status for a cleanup action.
 */
export type EvmCleanupRescanStatus =
  | "not_requested"
  | "cleared"
  | "still_active";

/**
 * Reconciliation item tying an action to execution and later re-scan state.
 */
export interface EvmCleanupReconciliationItem {
  /** Cleanup action identifier. */
  readonly actionId: string;
  /** Approval identifier the action targets. */
  readonly approvalId: string;
  /** Execution status recorded for the action. */
  readonly executionStatus: EvmCleanupExecutionStatus;
  /** Re-scan comparison status for the targeted approval. */
  readonly rescanStatus: EvmCleanupRescanStatus;
  /** Findings linked to the action. */
  readonly findingIds: readonly string[];
  /** Transaction hash when available, else null. */
  readonly txHash: string | null;
  /** Whether another re-scan is still required. */
  readonly requiresRescan: boolean;
}

/**
 * Summary view for later comparing plan actions, execution results, and re-scan output.
 */
export interface EvmCleanupReconciliationSummary {
  /** Cleanup plan identifier. */
  readonly planId: string;
  /** Chain family this reconciliation belongs to. */
  readonly walletChain: "evm";
  /** Wallet identifier this reconciliation belongs to. */
  readonly walletAddress: string;
  /** Network scope this reconciliation belongs to. */
  readonly networkId: string;
  /** Whether any action still requires a re-scan before remediation can be claimed. */
  readonly requiresRescan: boolean;
  /** Whether the supplied re-scan snapshot matched the cleanup plan context. */
  readonly rescanSnapshotAccepted: boolean;
  /** Explicit mismatch reason when a supplied re-scan snapshot was rejected. */
  readonly rescanMismatchReason:
    | "wallet_chain_mismatch"
    | "wallet_address_mismatch"
    | "network_id_mismatch"
    | null;
  /** Confirmed action identifiers recorded so far. */
  readonly confirmedActionIds: readonly string[];
  /** Action identifiers that remain unresolved after reconciliation. */
  readonly outstandingActionIds: readonly string[];
  /** Per-action reconciliation items. */
  readonly items: readonly EvmCleanupReconciliationItem[];
  /** Re-scan snapshot used for comparison, else null. */
  readonly rescanSnapshot: EvmCleanupRescanSnapshot | null;
}
