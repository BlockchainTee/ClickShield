import type {
  WalletCleanupExecutionResult,
  WalletCleanupPlan,
  WalletFinding,
  WalletReportClassification,
  WalletScanMode,
} from "./types.js";

export interface WalletReportTruthFields {
  readonly capabilityTier: WalletScanMode;
  readonly executionPerformed: boolean;
  readonly actionable: boolean;
  readonly classification: WalletReportClassification;
  readonly statusLabel: string;
}

function buildExecutionReportedLabel(
  cleanupExecution: WalletCleanupExecutionResult | null
): string {
  switch (cleanupExecution?.status) {
    case "partial":
      return "Scan completed. Issues detected. Partial cleanup execution was reported.";
    case "blocked":
      return "Scan completed. Issues detected. Cleanup execution was blocked.";
    case "failed":
      return "Scan completed. Issues detected. Cleanup execution was attempted but did not complete.";
    case "completed":
      return "Scan completed. Issues detected. Cleanup execution was reported.";
    default:
      return "Scan completed. Issues detected. Cleanup execution was reported.";
  }
}

export function didWalletCleanupExecutionRun(
  cleanupExecution: WalletCleanupExecutionResult | null
): boolean {
  if (cleanupExecution === null) {
    return false;
  }

  if (
    cleanupExecution.startedAt !== null ||
    cleanupExecution.completedAt !== null ||
    cleanupExecution.status !== "not_started"
  ) {
    return true;
  }

  return cleanupExecution.actionResults.some(
    (actionResult) => actionResult.status !== "pending"
  );
}

export function buildWalletReportTruthFields(input: {
  readonly capabilityTier: WalletScanMode;
  readonly findings: readonly WalletFinding[];
  readonly cleanupPlan: WalletCleanupPlan | null;
  readonly cleanupExecution: WalletCleanupExecutionResult | null;
  readonly cleanupExecutionSupported: boolean;
}): WalletReportTruthFields {
  const actionable = (input.cleanupPlan?.actions.length ?? 0) > 0;
  const executionPerformed = didWalletCleanupExecutionRun(input.cleanupExecution);

  if (input.findings.length === 0) {
    return {
      capabilityTier: input.capabilityTier,
      executionPerformed,
      actionable,
      classification: "no_issues_detected",
      statusLabel: "Scan completed. No issues detected.",
    };
  }

  if (executionPerformed) {
    return {
      capabilityTier: input.capabilityTier,
      executionPerformed,
      actionable,
      classification: "execution_reported",
      statusLabel: buildExecutionReportedLabel(input.cleanupExecution),
    };
  }

  if (!input.cleanupExecutionSupported) {
    return {
      capabilityTier: input.capabilityTier,
      executionPerformed,
      actionable,
      classification: "manual_action_required",
      statusLabel: "Scan completed. Issues detected. Manual action required.",
    };
  }

  if (actionable) {
    return {
      capabilityTier: input.capabilityTier,
      executionPerformed,
      actionable,
      classification: "issues_detected",
      statusLabel: "Scan completed. Issues detected. Follow-up action is available.",
    };
  }

  return {
    capabilityTier: input.capabilityTier,
    executionPerformed,
    actionable,
    classification: "issues_detected",
    statusLabel: "Scan completed. Issues detected. Review recommended.",
  };
}
