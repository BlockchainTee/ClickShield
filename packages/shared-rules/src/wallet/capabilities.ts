import type {
  WalletCapabilityArea,
  WalletCapabilityBoundary,
  WalletCapabilityStatus,
  WalletChain,
  WalletCleanupAction,
  WalletCleanupExecutionResult,
  WalletScanMode,
  WalletScanRequest,
  WalletScanResult,
  WalletScanSnapshot,
  WalletSummary,
} from "./types.js";
import {
  buildWalletReportTruthFields,
  didWalletCleanupExecutionRun,
} from "./report-truth.js";

/**
 * Layer 4 capability tiers exposed through the wallet contract.
 */
export type WalletCapabilityTier = WalletScanMode;

/**
 * Machine-readable operation names used in the canonical capability contract.
 */
export type WalletCapabilityOperation =
  | "snapshot"
  | "finding"
  | "cleanup_plan"
  | "cleanup_execution";

/**
 * Honest support declaration for a single Layer 4 wallet operation.
 */
export interface WalletCapabilityOperationContract {
  /** Operation governed by this support declaration. */
  readonly operation: WalletCapabilityOperation;
  /** Truthful support status for the operation. */
  readonly status: WalletCapabilityStatus;
  /** Whether this operation can execute remediation inside Layer 4 today. */
  readonly remediationSupported: boolean;
}

/**
 * Canonical per-chain Layer 4 capability contract.
 */
export interface WalletChainCapabilityContract {
  /** Chain family covered by the contract. */
  readonly walletChain: WalletChain;
  /** Capability tiers currently supported for this chain. */
  readonly supportedTiers: readonly WalletCapabilityTier[];
  /** Whether this chain currently supports full Layer 4 capability. */
  readonly fullCapabilitySupported: boolean;
  /** Whether Layer 4 can produce deterministic cleanup guidance for this chain. */
  readonly cleanupPlanSupported: boolean;
  /** Whether Layer 4 can execute cleanup/remediation for this chain today. */
  readonly cleanupExecutionSupported: boolean;
  /** Truthful support declaration per operation area. */
  readonly operations: readonly WalletCapabilityOperationContract[];
}

const WALLET_CHAIN_CAPABILITY_CONTRACTS: Record<
  WalletChain,
  WalletChainCapabilityContract
> = {
  evm: {
    walletChain: "evm",
    supportedTiers: ["basic", "full"],
    fullCapabilitySupported: true,
    cleanupPlanSupported: true,
    cleanupExecutionSupported: true,
    operations: [
      {
        operation: "snapshot",
        status: "supported",
        remediationSupported: false,
      },
      {
        operation: "finding",
        status: "supported",
        remediationSupported: false,
      },
      {
        operation: "cleanup_plan",
        status: "supported",
        remediationSupported: true,
      },
      {
        operation: "cleanup_execution",
        status: "partial",
        remediationSupported: true,
      },
    ],
  },
  solana: {
    walletChain: "solana",
    supportedTiers: ["basic"],
    fullCapabilitySupported: false,
    cleanupPlanSupported: true,
    cleanupExecutionSupported: false,
    operations: [
      {
        operation: "snapshot",
        status: "supported",
        remediationSupported: false,
      },
      {
        operation: "finding",
        status: "supported",
        remediationSupported: false,
      },
      {
        operation: "cleanup_plan",
        status: "supported",
        remediationSupported: false,
      },
      {
        operation: "cleanup_execution",
        status: "not_supported",
        remediationSupported: false,
      },
    ],
  },
  bitcoin: {
    walletChain: "bitcoin",
    supportedTiers: ["basic"],
    fullCapabilitySupported: false,
    cleanupPlanSupported: true,
    cleanupExecutionSupported: false,
    operations: [
      {
        operation: "snapshot",
        status: "supported",
        remediationSupported: false,
      },
      {
        operation: "finding",
        status: "supported",
        remediationSupported: false,
      },
      {
        operation: "cleanup_plan",
        status: "supported",
        remediationSupported: false,
      },
      {
        operation: "cleanup_execution",
        status: "not_supported",
        remediationSupported: false,
      },
    ],
  },
};

const CAPABILITY_STATUS_RANK: Record<WalletCapabilityStatus, number> = {
  not_supported: 0,
  partial: 1,
  supported: 2,
};

function formatSupportedTiers(
  supportedTiers: readonly WalletCapabilityTier[]
): string {
  return supportedTiers.map((tier) => `"${tier}"`).join(", ");
}

function getOperationContract(
  contract: WalletChainCapabilityContract,
  area: WalletCapabilityArea
): WalletCapabilityOperationContract | undefined {
  return contract.operations.find((operation) => operation.operation === area);
}

function assertCapabilityBoundariesDoNotOverclaim(
  contract: WalletChainCapabilityContract,
  capabilityBoundaries: readonly WalletCapabilityBoundary[]
): void {
  for (const boundary of capabilityBoundaries) {
    const operation = getOperationContract(contract, boundary.area);

    if (operation === undefined) {
      continue;
    }

    if (
      CAPABILITY_STATUS_RANK[boundary.status] >
      CAPABILITY_STATUS_RANK[operation.status]
    ) {
      throw new Error(
        `Layer 4 ${contract.walletChain} capability boundary "${boundary.capabilityKey}" overclaims ${boundary.area} support as "${boundary.status}".`
      );
    }
  }
}

function assertCleanupActionsDoNotOverclaim(
  contract: WalletChainCapabilityContract,
  cleanupActions: readonly WalletCleanupAction[]
): void {
  if (contract.walletChain === "evm") {
    return;
  }

  for (const action of cleanupActions) {
    if (action.executionType !== "manual_review") {
      throw new Error(
        `Layer 4 ${contract.walletChain} cleanup action "${action.actionId}" cannot advertise executionType "${action.executionType}".`
      );
    }

    if (action.supportStatus === "supported") {
      throw new Error(
        `Layer 4 ${contract.walletChain} cleanup action "${action.actionId}" cannot advertise fully supported remediation.`
      );
    }
  }
}

/**
 * Returns the canonical Layer 4 capability contract for a wallet chain.
 */
export function getWalletChainCapabilityContract(
  walletChain: WalletChain
): WalletChainCapabilityContract {
  return WALLET_CHAIN_CAPABILITY_CONTRACTS[walletChain];
}

/**
 * Validates that the requested Layer 4 capability tier is actually supported for the chain.
 */
export function assertWalletScanModeSupported(
  walletChain: WalletChain,
  scanMode: WalletScanMode,
  fieldName = "scanMode"
): WalletScanMode {
  const contract = getWalletChainCapabilityContract(walletChain);

  if (contract.supportedTiers.includes(scanMode)) {
    return scanMode;
  }

  throw new Error(
    `Layer 4 ${walletChain} capability does not support ${fieldName} "${scanMode}"; supported values: ${formatSupportedTiers(contract.supportedTiers)}.`
  );
}

/**
 * Validates a wallet scan request against the canonical Layer 4 capability contract.
 */
export function assertWalletScanRequestCapabilityTruth(
  request: WalletScanRequest
): WalletScanRequest {
  assertWalletScanModeSupported(
    request.walletChain,
    request.scanMode,
    "request.scanMode"
  );
  return request;
}

/**
 * Validates that report-facing Layer 4 contracts do not overclaim capability for a chain.
 */
export function assertWalletReportCapabilityTruth(input: {
  /** Request included in the report surface. */
  readonly request: WalletScanRequest;
  /** Snapshot included in the report surface. */
  readonly snapshot: WalletScanSnapshot;
  /** Result included in the report surface. */
  readonly result: WalletScanResult;
  /** Summary included in the report surface. */
  readonly summary: WalletSummary;
  /** Cleanup execution outcome included in the report surface. */
  readonly cleanupExecution: WalletCleanupExecutionResult | null;
}): void {
  const contract = getWalletChainCapabilityContract(input.request.walletChain);
  const expectedChain = contract.walletChain;

  assertWalletScanModeSupported(
    input.request.walletChain,
    input.request.scanMode,
    "request.scanMode"
  );
  assertWalletScanModeSupported(
    input.summary.walletChain,
    input.summary.scanMode,
    "summary.scanMode"
  );

  const expectedTruth = buildWalletReportTruthFields({
    capabilityTier: input.request.scanMode,
    findings: input.result.findings,
    cleanupPlan: input.result.cleanupPlan,
    cleanupExecution: input.cleanupExecution,
    cleanupExecutionSupported: contract.cleanupExecutionSupported,
  });

  if (input.snapshot.walletChain !== expectedChain) {
    throw new Error(
      `Wallet report capability truth requires snapshot.walletChain to be "${expectedChain}".`
    );
  }

  if (input.result.walletChain !== expectedChain) {
    throw new Error(
      `Wallet report capability truth requires result.walletChain to be "${expectedChain}".`
    );
  }

  if (input.summary.walletChain !== expectedChain) {
    throw new Error(
      `Wallet report capability truth requires summary.walletChain to be "${expectedChain}".`
    );
  }

  if (
    input.cleanupExecution !== null &&
    input.cleanupExecution.walletChain !== expectedChain
  ) {
    throw new Error(
      `Wallet report capability truth requires cleanupExecution.walletChain to be "${expectedChain}".`
    );
  }

  if (!contract.cleanupExecutionSupported && input.cleanupExecution !== null) {
    throw new Error(
      `Layer 4 ${expectedChain} capability does not support cleanup execution results.`
    );
  }

  if (
    !contract.fullCapabilitySupported &&
    input.result.cleanupPlan !== null &&
    (input.result.cleanupPlan.projectedScore !== null ||
      input.result.cleanupPlan.projectedRiskLevel !== null)
  ) {
    throw new Error(
      `Layer 4 ${expectedChain} cleanup guidance cannot advertise projected post-remediation outcomes.`
    );
  }

  if (input.result.capabilityTier !== input.request.scanMode) {
    throw new Error(
      "Wallet report capability truth requires result.capabilityTier to match request.scanMode."
    );
  }

  if (input.summary.capabilityTier !== input.request.scanMode) {
    throw new Error(
      "Wallet report capability truth requires summary.capabilityTier to match request.scanMode."
    );
  }

  const expectedActionable = (input.result.cleanupPlan?.actions.length ?? 0) > 0;
  if (input.result.actionable !== expectedActionable) {
    throw new Error(
      "Wallet report capability truth requires result.actionable to match cleanup plan availability."
    );
  }

  if (input.summary.actionable !== expectedActionable) {
    throw new Error(
      "Wallet report capability truth requires summary.actionable to match cleanup plan availability."
    );
  }

  if (
    input.summary.actionableFindingCount > 0 &&
    !input.summary.actionable
  ) {
    throw new Error(
      "Wallet report capability truth requires summary.actionable to remain true when actionable findings are present."
    );
  }

  const executionPerformed = didWalletCleanupExecutionRun(input.cleanupExecution);
  if (input.result.executionPerformed !== executionPerformed) {
    throw new Error(
      "Wallet report capability truth requires result.executionPerformed to match actual cleanup execution."
    );
  }

  if (input.summary.executionPerformed !== executionPerformed) {
    throw new Error(
      "Wallet report capability truth requires summary.executionPerformed to match actual cleanup execution."
    );
  }

  if (input.result.classification !== expectedTruth.classification) {
    throw new Error(
      "Wallet report capability truth requires result.classification to match actual execution truth."
    );
  }

  if (input.summary.classification !== expectedTruth.classification) {
    throw new Error(
      "Wallet report capability truth requires summary.classification to match actual execution truth."
    );
  }

  if (input.result.statusLabel !== expectedTruth.statusLabel) {
    throw new Error(
      "Wallet report capability truth requires result.statusLabel to match actual execution truth."
    );
  }

  if (input.summary.statusLabel !== expectedTruth.statusLabel) {
    throw new Error(
      "Wallet report capability truth requires summary.statusLabel to match actual execution truth."
    );
  }

  assertCapabilityBoundariesDoNotOverclaim(
    contract,
    input.result.capabilityBoundaries
  );
  assertCleanupActionsDoNotOverclaim(
    contract,
    input.result.cleanupPlan?.actions ?? []
  );
}
